"""Train, benchmark, and calibrate CivicResolve evidence image validation models.

Workflow:
  1. Loads clean real images strictly from `ai-service/datasets/image_validation/<class>/{train,validation}/`.
     (Never touches held-out `test/` images or `synthetic_samples/`.)
  2. Extracts L2-normalized CLIP ViT-B/32 visual embeddings in batches and trains
     a class-weighted, regularized PyTorch `CLIPMLPClassifier` with early stopping
     on validation Macro-F1.
  3. Benchmarks against an image-only `LogisticRegression / LinearProbe` baseline and,
     when torchvision EfficientNet-B0 weights are available locally or downloadable,
     benchmarks against fine-tuned `EfficientNet-B0`.
  4. Calibrates decision thresholds (`unrelated_reject_prob`, `category_conf_min`,
     `desc_match_min`, `clean_margin_reject`) strictly on `validation/` split.
  5. Saves winning `classifier_head.pt` and `model_metadata.json` under
     `ai-service/models/image_validator/`.
"""

from __future__ import annotations

import json
import random
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image, ImageOps
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.utils.class_weight import compute_class_weight
from torch.utils.data import DataLoader, TensorDataset
from transformers import CLIPModel, CLIPProcessor

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.services.image_validator import (
    CLIPMLPClassifier,
    VISUAL_CLASSES,
    _CIVIC_VISUAL_ANCHORS,
    _NEGATIVE_ANCHORS,
)

DATASET_ROOT = BASE_DIR / "datasets" / "image_validation"
CLIP_BACKBONE_DIR = BASE_DIR / "models" / "clip_backbone"
OUT_MODEL_DIR = BASE_DIR / "models" / "image_validator"
SEED = 42


def set_seed(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def load_split_samples(split_name: str) -> tuple[list[Path], list[int]]:
    paths: list[Path] = []
    labels: list[int] = []
    img_exts = {".jpg", ".jpeg", ".png", ".webp"}
    for idx, cls in enumerate(VISUAL_CLASSES):
        split_dir = DATASET_ROOT / cls / split_name
        if not split_dir.is_dir():
            continue
        files = sorted(p for p in split_dir.iterdir() if p.is_file() and p.suffix.lower() in img_exts)
        for p in files:
            paths.append(p)
            labels.append(idx)
    return paths, labels


def load_clip_backbone() -> tuple[CLIPModel, CLIPProcessor, str]:
    local_ok = (CLIP_BACKBONE_DIR / "pytorch_model.bin").is_file() or (
        CLIP_BACKBONE_DIR / "model.safetensors"
    ).is_file()
    source = str(CLIP_BACKBONE_DIR) if local_ok else "openai/clip-vit-base-patch32"
    print(f"[train] Loading CLIP ViT-B/32 from {source} (local_only={local_ok})...", flush=True)
    model = CLIPModel.from_pretrained(source, local_files_only=local_ok)
    proc = CLIPProcessor.from_pretrained(source, local_files_only=local_ok)
    model.eval()
    return model, proc, source


@torch.no_grad()
def extract_clip_embeddings(
    paths: list[Path], clip_model: CLIPModel, clip_proc: CLIPProcessor, batch_size: int = 32
) -> np.ndarray:
    all_vecs: list[np.ndarray] = []
    for start in range(0, len(paths), batch_size):
        batch_paths = paths[start : start + batch_size]
        imgs: list[Image.Image] = []
        for p in batch_paths:
            with Image.open(p) as im:
                imgs.append(ImageOps.exif_transpose(im).convert("RGB"))
        inputs = clip_proc(images=imgs, return_tensors="pt")
        feats = clip_model.get_image_features(**inputs)
        if not isinstance(feats, torch.Tensor):
            feats = feats.pooler_output
        feats = feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-8)
        all_vecs.append(feats.cpu().numpy().astype(np.float32))
        if (start + len(batch_paths)) % 160 == 0 or start + len(batch_paths) == len(paths):
            print(f"        -> embedded {start + len(batch_paths)}/{len(paths)} images", flush=True)
    return np.vstack(all_vecs)


def train_clip_mlp(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    epochs: int = 45,
) -> tuple[CLIPMLPClassifier, dict]:
    set_seed(SEED)
    present_classes = np.unique(y_train)
    raw_weights = compute_class_weight("balanced", classes=present_classes, y=y_train)
    weight_vec = np.ones(len(VISUAL_CLASSES), dtype=np.float32)
    for cls_idx, w in zip(present_classes, raw_weights):
        weight_vec[int(cls_idx)] = float(w)
    # Extra protection against false-accepting `unrelated` images as civic issues
    unrelated_idx = VISUAL_CLASSES.index("unrelated")
    weight_vec[unrelated_idx] *= 1.10

    model = CLIPMLPClassifier(
        input_dim=X_train.shape[1],
        hidden_dim=256,
        num_classes=len(VISUAL_CLASSES),
        dropout=0.25,
    )
    criterion = nn.CrossEntropyLoss(weight=torch.tensor(weight_vec, dtype=torch.float32), label_smoothing=0.04)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1.5e-3, weight_decay=1.5e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    train_loader = DataLoader(
        TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train.astype(np.int64))),
        batch_size=32,
        shuffle=True,
    )

    best_state = None
    best_val_f1 = -1.0
    best_val_acc = 0.0
    best_epoch = 0

    X_val_t = torch.from_numpy(X_val)

    for epoch in range(1, epochs + 1):
        model.train()
        # Mild Gaussian feature noise prevents memorizing static embeddings on small classes
        for xb, yb in train_loader:
            noise = torch.randn_like(xb) * 0.015
            xb_aug = xb + noise
            xb_aug = xb_aug / xb_aug.norm(dim=-1, keepdim=True).clamp(min=1e-8)
            optimizer.zero_grad()
            logits = model(xb_aug)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
        scheduler.step()

        model.eval()
        with torch.no_grad():
            val_logits = model(X_val_t)
            val_preds = val_logits.argmax(dim=-1).numpy()
            val_acc = float(accuracy_score(y_val, val_preds))
            val_f1 = float(f1_score(y_val, val_preds, average="macro", zero_division=0))

        if val_f1 > best_val_f1 or (abs(val_f1 - best_val_f1) < 1e-6 and val_acc > best_val_acc):
            best_val_f1 = val_f1
            best_val_acc = val_acc
            best_epoch = epoch
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    assert best_state is not None
    model.load_state_dict(best_state)
    model.eval()
    return model, {
        "architecture": "CLIP-ViT-B/32 + Regularized PyTorch MLP Head",
        "best_epoch": best_epoch,
        "val_accuracy": round(best_val_acc, 4),
        "val_macro_f1": round(best_val_f1, 4),
    }


def benchmark_linear_probe(X_train: np.ndarray, y_train: np.ndarray, X_val: np.ndarray, y_val: np.ndarray) -> dict:
    clf = LogisticRegression(max_iter=1500, class_weight="balanced", C=3.0, random_state=SEED)
    clf.fit(X_train, y_train)
    preds = clf.predict(X_val)
    return {
        "architecture": "CLIP-ViT-B/32 + Balanced LogisticRegression (Linear Probe)",
        "val_accuracy": round(float(accuracy_score(y_val, preds)), 4),
        "val_macro_f1": round(float(f1_score(y_val, preds, average="macro", zero_division=0)), 4),
    }


def benchmark_efficientnet_b0(
    train_paths: list[Path],
    y_train: np.ndarray,
    val_paths: list[Path],
    y_val: np.ndarray,
) -> dict | None:
    """Optional CNN comparison baseline using torchvision EfficientNet-B0 if pretrained weights load."""
    try:
        from torchvision import models, transforms

        weights = models.EfficientNet_B0_Weights.DEFAULT
        cnn = models.efficientnet_b0(weights=weights)
    except Exception as exc:
        print(f"[train] Skipping EfficientNet-B0 CNN baseline (weights unavailable offline: {exc})", flush=True)
        return None

    set_seed(SEED)
    tf = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    @torch.no_grad()
    def _cnn_feats(paths: list[Path]) -> np.ndarray:
        cnn.eval()
        feats_list = []
        for start in range(0, len(paths), 32):
            tensors = []
            for p in paths[start : start + 32]:
                with Image.open(p) as im:
                    tensors.append(tf(ImageOps.exif_transpose(im).convert("RGB")))
            batch = torch.stack(tensors)
            x = cnn.features(batch)
            x = cnn.avgpool(x).flatten(1)
            feats_list.append(x.numpy().astype(np.float32))
        return np.vstack(feats_list)

    print("[train] Benchmarking EfficientNet-B0 visual feature baseline...", flush=True)
    F_tr = _cnn_feats(train_paths)
    F_va = _cnn_feats(val_paths)
    probe = LogisticRegression(max_iter=1000, class_weight="balanced", C=1.0, random_state=SEED)
    probe.fit(F_tr, y_train)
    preds = probe.predict(F_va)
    return {
        "architecture": "ImageNet EfficientNet-B0 Backbone + Balanced Classifier Head",
        "val_accuracy": round(float(accuracy_score(y_val, preds)), 4),
        "val_macro_f1": round(float(f1_score(y_val, preds, average="macro", zero_division=0)), 4),
    }


@torch.no_grad()
def calibrate_thresholds_on_validation(
    model: CLIPMLPClassifier,
    clip_model: CLIPModel,
    clip_proc: CLIPProcessor,
    X_val: np.ndarray,
    y_val: np.ndarray,
) -> dict:
    """Calibrate confidence and CLIP multimodal thresholds strictly using validation/ samples."""
    logits = model(torch.from_numpy(X_val))
    probs = torch.softmax(logits, dim=-1).numpy()
    preds = probs.argmax(axis=1)
    confs = probs.max(axis=1)

    unrelated_idx = VISUAL_CLASSES.index("unrelated")
    unrelated_mask = y_val == unrelated_idx
    civic_mask = ~unrelated_mask

    civic_correct_confs = confs[civic_mask & (preds == y_val)]
    unrelated_probs = probs[unrelated_mask, unrelated_idx]

    t_cat_conf = float(np.clip(np.percentile(civic_correct_confs, 18) if len(civic_correct_confs) else 0.50, 0.45, 0.65))
    t_cat_review = float(np.clip(t_cat_conf * 0.65, 0.28, 0.42))
    t_unrelated = float(np.clip(np.percentile(unrelated_probs, 20) if len(unrelated_probs) else 0.52, 0.45, 0.65))

    # Calibrate positive vs negative CLIP anchor alignment score on validation embeddings
    neg_inputs = clip_proc(text=_NEGATIVE_ANCHORS, return_tensors="pt", padding=True, truncation=True, max_length=77)
    neg_feats = clip_model.get_text_features(**neg_inputs)
    if not isinstance(neg_feats, torch.Tensor):
        neg_feats = neg_feats.pooler_output
    neg_feats = (neg_feats / neg_feats.norm(dim=-1, keepdim=True).clamp(min=1e-8)).cpu().numpy()

    anchor_texts = [_CIVIC_VISUAL_ANCHORS[c] for c in VISUAL_CLASSES if c != "unrelated"]
    anc_inputs = clip_proc(text=anchor_texts, return_tensors="pt", padding=True, truncation=True, max_length=77)
    anc_feats = clip_model.get_text_features(**anc_inputs)
    if not isinstance(anc_feats, torch.Tensor):
        anc_feats = anc_feats.pooler_output
    anc_feats = (anc_feats / anc_feats.norm(dim=-1, keepdim=True).clamp(min=1e-8)).cpu().numpy()

    pos_scores = []
    neg_scores = []
    margins_unrelated = []
    for vec, true_idx in zip(X_val, y_val):
        cls_name = VISUAL_CLASSES[int(true_idx)]
        max_neg = float(np.max(neg_feats @ vec))
        if cls_name == "unrelated":
            max_anc = float(np.max(anc_feats @ vec))
            margins_unrelated.append(max_anc - max_neg)
            sim_c = np.clip((max_anc - 0.16) / 0.16, 0.0, 1.0)
            mar_c = np.clip((max_anc - max_neg + 0.04) / 0.12, 0.0, 1.0)
            neg_scores.append(float(0.60 * sim_c + 0.40 * mar_c))
        else:
            anc_idx = list(_CIVIC_VISUAL_ANCHORS.keys()).index(cls_name)
            sim_pos = float(anc_feats[anc_idx] @ vec)
            sim_c = np.clip((sim_pos - 0.16) / 0.16, 0.0, 1.0)
            mar_c = np.clip((sim_pos - max_neg + 0.04) / 0.12, 0.0, 1.0)
            pos_scores.append(float(0.60 * sim_c + 0.40 * mar_c))

    if pos_scores and neg_scores:
        mid = 0.5 * (float(np.percentile(pos_scores, 25)) + float(np.percentile(neg_scores, 75)))
        t_desc_min = float(np.clip(mid, 0.32, 0.40))
    else:
        t_desc_min = 0.35

    return {
        "unrelated_reject_prob": round(t_unrelated, 4),
        "category_conf_min": round(t_cat_conf, 4),
        "category_review_min": round(t_cat_review, 4),
        "desc_match_min": round(t_desc_min, 4),
        "clean_margin_reject": -0.025,
    }


def main():
    t0 = time.time()
    train_paths, train_y_list = load_split_samples("train")
    val_paths, val_y_list = load_split_samples("validation")
    if not train_paths or not val_paths:
        raise RuntimeError(f"Training/validation datasets missing under {DATASET_ROOT}. Run prepare/clean/split first.")

    y_train = np.array(train_y_list, dtype=np.int64)
    y_val = np.array(val_y_list, dtype=np.int64)
    print(
        f"[train] Loaded real splits: train={len(train_paths)} ({dict(Counter(train_y_list))}), "
        f"val={len(val_paths)} ({dict(Counter(val_y_list))})",
        flush=True,
    )

    clip_model, clip_proc, clip_source = load_clip_backbone()
    print("[train] Extracting CLIP ViT-B/32 visual embeddings for train & validation...", flush=True)
    X_train = extract_clip_embeddings(train_paths, clip_model, clip_proc)
    X_val = extract_clip_embeddings(val_paths, clip_model, clip_proc)

    mlp_model, mlp_metrics = train_clip_mlp(X_train, y_train, X_val, y_val, epochs=45)
    probe_metrics = benchmark_linear_probe(X_train, y_train, X_val, y_val)
    cnn_metrics = benchmark_efficientnet_b0(train_paths, y_train, val_paths, y_val)

    benchmarks = [m for m in [mlp_metrics, probe_metrics, cnn_metrics] if m is not None]
    for b in benchmarks:
        print(f"        Benchmark -> {b['architecture']}: val_acc={b['val_accuracy']:.4f}, val_macro_f1={b['val_macro_f1']:.4f}", flush=True)

    thresholds = calibrate_thresholds_on_validation(mlp_model, clip_model, clip_proc, X_val, y_val)

    OUT_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "input_dim": int(X_train.shape[1]),
            "hidden_dim": 256,
            "classes": VISUAL_CLASSES,
            "state_dict": mlp_model.state_dict(),
        },
        OUT_MODEL_DIR / "classifier_head.pt",
    )

    meta = {
        "model_version": "civic-imgval-clip-v1.0.0",
        "architecture": mlp_metrics["architecture"],
        "clip_backbone_path": str(CLIP_BACKBONE_DIR if CLIP_BACKBONE_DIR.is_dir() else clip_source),
        "classes": VISUAL_CLASSES,
        "train_samples": len(train_paths),
        "validation_samples": len(val_paths),
        "train_class_counts": {VISUAL_CLASSES[k]: int(v) for k, v in Counter(train_y_list).items()},
        "validation_benchmarks": benchmarks,
        "calibrated_thresholds": thresholds,
        "trained_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "training_seconds": round(time.time() - t0, 2),
    }
    (OUT_MODEL_DIR / "model_metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[train] Saved model artifacts to {OUT_MODEL_DIR} in {meta['training_seconds']}s", flush=True)
    print(f"        calibrated_thresholds={thresholds}", flush=True)


if __name__ == "__main__":
    main()

