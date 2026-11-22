"""Reproducible multi-source civic image dataset downloader for CivicResolve.

Downloads real publicly licensed datasets across all CivicResolve visual classes:
  - Mendeley WasteSegCluster (CC BY 4.0): urban water body waste & pollution
  - HuggingFace Akhila-9849/Garbage_Bin_overflow_images (CC BY 4.0)
  - HuggingFace keremberke/pothole-segmentation (Roboflow CC BY 4.0)
  - HuggingFace Arpitraj01/Pothole_classification (MIT): potholes + normal clean roads
  - TACO GitHub/Zenodo 3587843 (CC BY 4.0): real street & ground litter subset
  - Wikimedia Commons (CC0 / CC-BY / CC-BY-SA / Public Domain): drainage/sewage,
    water pollution, sanitation/hygiene, road damage, garbage, clean environments,
    personal selfies, mobile screenshots & documents.

Records exact license, attribution, URLs, download counts, and sizes to:
  ai-service/datasets/raw_downloads/download_manifest.json
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "datasets" / "raw_downloads"
MANIFEST_PATH = RAW_DIR / "download_manifest.json"
USER_AGENT = "CivicResolve-DatasetCollector/1.0 (+https://github.com/civicresolve)"

ALLOWED_WM_LICENSES = ("cc0", "cc-by", "cc by", "public domain", "pdm")


def http_get_json(url: str, timeout: int = 20) -> dict | list:
    res = subprocess.run(
        ["curl.exe", "-4", "-fsSL", "--max-time", str(timeout), "-A", USER_AGENT, "-H", "Accept: application/json", url],
        capture_output=True,
        timeout=timeout + 5,
    )
    if res.returncode == 0 and res.stdout:
        return json.loads(res.stdout.decode("utf-8"))
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _probe_url(url: str, timeout: int = 20) -> tuple[str, int, bool]:
    res = subprocess.run(
        ["curl.exe", "-4", "-fsSIL", "--max-time", str(timeout), "-A", USER_AGENT, "-w", "\nFINAL_URL:%{url_effective}\n", url],
        capture_output=True,
        timeout=timeout + 5,
    )
    if res.returncode != 0:
        return url, 0, False
    text = res.stdout.decode("utf-8", errors="ignore")
    final_url = url
    content_length = 0
    accept_ranges = False
    for line in text.splitlines():
        low = line.lower().strip()
        if line.startswith("FINAL_URL:"):
            final_url = line.split("FINAL_URL:", 1)[1].strip()
        elif low.startswith("content-length:"):
            try:
                content_length = int(low.split(":", 1)[1].strip())
            except ValueError:
                pass
        elif low.startswith("accept-ranges:") and "bytes" in low:
            accept_ranges = True
    return final_url, content_length, accept_ranges


def _download_parallel_ranges(url: str, tmp: Path, total_size: int, chunk_size: int = 1024 * 1024, workers: int = 12) -> bool:
    ranges: list[tuple[int, int, int]] = []
    idx = 0
    offset = 0
    while offset < total_size:
        end = min(total_size - 1, offset + chunk_size - 1)
        ranges.append((idx, offset, end))
        idx += 1
        offset = end + 1

    part_dir = tmp.parent / f".{tmp.name}.chunks"
    part_dir.mkdir(parents=True, exist_ok=True)
    completed = 0

    def _fetch_chunk(item: tuple[int, int, int]) -> bool:
        c_idx, start, end = item
        expected = end - start + 1
        c_path = part_dir / f"chunk_{c_idx:04d}"
        if c_path.exists() and c_path.stat().st_size == expected:
            return True
        for attempt in range(4):
            res = subprocess.run(
                [
                    "curl.exe", "-4", "-fsSL", "--connect-timeout", "15", "--max-time", "300",
                    "-A", USER_AGENT, "-r", f"{start}-{end}", "-o", str(c_path), url,
                ],
                capture_output=True,
                timeout=315,
            )
            if res.returncode == 0 and c_path.exists() and c_path.stat().st_size == expected:
                return True
            time.sleep(1.5 * (attempt + 1))
        return False

    ok_all = True
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for ok in pool.map(_fetch_chunk, ranges):
            completed += 1
            if completed % 10 == 0 or completed == len(ranges):
                print(f"      -> chunks {completed}/{len(ranges)} completed (ok={ok})", flush=True)
            if not ok:
                ok_all = False

    if not ok_all:
        return False

    with open(tmp, "wb") as out:
        for c_idx, _, _ in ranges:
            out.write((part_dir / f"chunk_{c_idx:04d}").read_bytes())

    if tmp.stat().st_size != total_size:
        tmp.unlink(missing_ok=True)
        return False

    for p in part_dir.glob("chunk_*"):
        p.unlink(missing_ok=True)
    part_dir.rmdir()
    return True


def download_file(url: str, dest: Path, timeout: int = 120, overwrite: bool = False, large_parallel: bool = False) -> tuple[bool, int, str]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 1024 and not overwrite:
        return True, dest.stat().st_size, "cached"

    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.unlink(missing_ok=True)

    if large_parallel:
        final_url, total_size, accept_ranges = _probe_url(url, timeout=20)
        if accept_ranges and total_size > 8 * 1024 * 1024:
            print(f"      -> Parallel range download ({total_size / (1024**2):.2f} MB)...", flush=True)
            if _download_parallel_ranges(final_url, tmp, total_size):
                tmp.replace(dest)
                return True, total_size, "downloaded_parallel"

    try:
        res = subprocess.run(
            [
                "curl.exe",
                "-4",
                "-fsSL",
                "--retry",
                "2",
                "--connect-timeout",
                "15",
                "--max-time",
                str(timeout),
                "-A",
                USER_AGENT,
                "-o",
                str(tmp),
                url,
            ],
            capture_output=True,
            timeout=timeout + 10,
        )
        if res.returncode == 0 and tmp.exists() and tmp.stat().st_size >= 32:
            total = tmp.stat().st_size
            tmp.replace(dest)
            return True, total, "downloaded"
        err_msg = res.stderr.decode("utf-8", errors="ignore").strip() or f"curl_exit_{res.returncode}"
        tmp.unlink(missing_ok=True)
        return False, 0, err_msg
    except Exception as exc:
        tmp.unlink(missing_ok=True)
        return False, 0, str(exc)


def collect_wastesegcluster() -> dict:
    """Download Mendeley WasteSegCluster (CC BY 4.0) urban water body waste dataset."""
    out_dir = RAW_DIR / "wastesegcluster"
    zip_path = out_dir / "wasteSegCluster.zip"
    extract_dir = out_dir / "extracted"
    url = (
        "https://data.mendeley.com/public-files/datasets/3wnf3n242s/files/"
        "f764a3a3-c8a4-47c9-b639-c2e12b79b984/file_downloaded"
    )
    print("[1/6] Downloading Mendeley WasteSegCluster (CC BY 4.0, ~96 MB)...", flush=True)
    ok, size_bytes, note = download_file(url, zip_path, timeout=480, large_parallel=True)
    if not ok:
        raise RuntimeError(f"Failed downloading WasteSegCluster: {note}")

    if not extract_dir.exists() or not any(extract_dir.rglob("*")):
        extract_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_dir)

    img_exts = {".jpg", ".jpeg", ".png", ".webp"}
    images = [p for p in extract_dir.rglob("*") if p.is_file() and p.suffix.lower() in img_exts]
    print(f"      -> WasteSegCluster ready: {len(images)} images extracted ({size_bytes / (1024**2):.2f} MB zip)")
    return {
        "name": "WasteSegCluster (Urban Water Bodies in Bangladesh)",
        "source_url": "https://data.mendeley.com/datasets/3wnf3n242s/4",
        "license": "CC BY 4.0",
        "target_classes": ["water_pollution", "garbage"],
        "zip_bytes": size_bytes,
        "extracted_images": len(images),
        "status": note,
    }


def collect_hf_pothole_segmentation() -> dict:
    """Download HuggingFace keremberke/pothole-segmentation zip splits."""
    out_dir = RAW_DIR / "hf_pothole_seg"
    out_dir.mkdir(parents=True, exist_ok=True)
    splits = ["train.zip", "valid.zip", "test.zip"]
    total_bytes = 0
    total_imgs = 0
    print("[2/6] Downloading HuggingFace keremberke/pothole-segmentation...")
    for split in splits:
        url = f"https://huggingface.co/datasets/keremberke/pothole-segmentation/resolve/main/data/{split}"
        zp = out_dir / split
        ok, sz, note = download_file(url, zp, timeout=90)
        if not ok:
            raise RuntimeError(f"Failed downloading {split} from keremberke/pothole-segmentation: {note}")
        total_bytes += sz
        ex = out_dir / split.replace(".zip", "")
        if not ex.exists():
            ex.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(zp, "r") as zf:
                zf.extractall(ex)
        imgs = [p for p in ex.rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
        total_imgs += len(imgs)

    print(f"      -> Pothole-segmentation ready: {total_imgs} images ({total_bytes / (1024**2):.2f} MB)")
    return {
        "name": "keremberke/pothole-segmentation",
        "source_url": "https://huggingface.co/datasets/keremberke/pothole-segmentation",
        "license": "CC BY 4.0 (Roboflow Universe)",
        "target_classes": ["road_damage"],
        "zip_bytes": total_bytes,
        "extracted_images": total_imgs,
        "status": "ok",
    }


def _hf_list_recursive(repo: str, subdir: str = "") -> list[dict]:
    path_part = f"/{urllib.parse.quote(subdir)}" if subdir else ""
    url = f"https://huggingface.co/api/datasets/{repo}/tree/main{path_part}"
    items = http_get_json(url, timeout=20)
    results = []
    for item in items:
        if item.get("type") == "directory":
            results.extend(_hf_list_recursive(repo, item["path"]))
        elif item.get("type") == "file":
            results.append(item)
    return results


def collect_hf_pothole_classification(per_subfolder_limit: int = 40) -> dict:
    """Download balanced sample of HuggingFace Arpitraj01/Pothole_classification (potholes + normal roads)."""
    repo = "Arpitraj01/Pothole_classification"
    out_dir = RAW_DIR / "hf_pothole_cls"
    print(f"[3/6] Listing & downloading balanced sample from {repo} (MIT license)...", flush=True)
    items = _hf_list_recursive(repo, "datasets")
    img_items = [x for x in items if Path(x["path"]).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]

    by_folder: dict[str, list[dict]] = {}
    for x in sorted(img_items, key=lambda d: d["path"]):
        parent = Path(x["path"]).parent.as_posix()
        by_folder.setdefault(parent, []).append(x)

    selected: list[dict] = []
    for parent, group in sorted(by_folder.items()):
        step = max(1, len(group) // per_subfolder_limit)
        selected.extend(group[::step][:per_subfolder_limit])

    def _fetch(item: dict) -> tuple[bool, int]:
        rel = item["path"]
        url = f"https://huggingface.co/datasets/{repo}/resolve/main/{urllib.parse.quote(rel)}"
        ok, sz, _ = download_file(url, out_dir / rel, timeout=30)
        return ok, sz

    ok_count = 0
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=10) as pool:
        for ok, sz in pool.map(_fetch, selected):
            if ok:
                ok_count += 1
                total_bytes += sz

    print(f"      -> Pothole_classification ready: {ok_count}/{len(selected)} images ({total_bytes / (1024**2):.2f} MB)", flush=True)
    return {
        "name": repo,
        "source_url": f"https://huggingface.co/datasets/{repo}",
        "license": "MIT",
        "target_classes": ["road_damage", "unrelated (clean normal roads)"],
        "downloaded_images": ok_count,
        "total_bytes": total_bytes,
    }


def collect_hf_garbage_bins(limit: int = 180) -> dict:
    """Download bounded sample of Akhila-9849/Garbage_Bin_overflow_images (CC BY 4.0)."""
    repo = "Akhila-9849/Garbage_Bin_overflow_images"
    out_dir = RAW_DIR / "hf_garbage_bins"
    print(f"[4/6] Listing & downloading up to {limit} images from {repo} (CC BY 4.0)...")
    items = http_get_json(f"https://huggingface.co/api/datasets/{repo}/tree/main", timeout=20)
    img_items = [x for x in items if Path(x["path"]).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
    img_items.sort(key=lambda x: x["path"])
    selected = img_items[:limit]

    def _fetch(item: dict) -> tuple[bool, int]:
        rel = item["path"]
        url = f"https://huggingface.co/datasets/{repo}/resolve/main/{urllib.parse.quote(rel)}"
        ok, sz, _ = download_file(url, out_dir / rel, timeout=30)
        return ok, sz

    ok_count = 0
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for ok, sz in pool.map(_fetch, selected):
            if ok:
                ok_count += 1
                total_bytes += sz

    print(f"      -> Garbage_Bin_overflow_images ready: {ok_count}/{len(selected)} images ({total_bytes / (1024**2):.2f} MB)")
    return {
        "name": repo,
        "source_url": f"https://huggingface.co/datasets/{repo}",
        "license": "CC BY 4.0",
        "target_classes": ["garbage"],
        "downloaded_images": ok_count,
        "total_bytes": total_bytes,
    }


def collect_taco_subset(limit: int = 140) -> dict:
    """Download outdoor street/wild trash subset from TACO annotations (CC BY 4.0)."""
    out_dir = RAW_DIR / "taco_subset"
    out_dir.mkdir(parents=True, exist_ok=True)
    ann_path = out_dir / "annotations.json"
    ann_url = "https://raw.githubusercontent.com/pedropro/TACO/master/data/annotations.json"
    print(f"[5/6] Downloading TACO annotations & up to {limit} street/outdoor litter images (CC BY 4.0)...", flush=True)
    ok, _, note = download_file(ann_url, ann_path, timeout=240, large_parallel=True)
    if not ok:
        print(f"      [WARN] Skipping TACO annotations ({note}); proceeding to Wikimedia corpus.", flush=True)
        return {
            "name": "TACO: Trash Annotations in Context (Zenodo 3587843 / GitHub pedropro/TACO)",
            "source_url": "https://zenodo.org/records/3587843",
            "license": "CC BY 4.0",
            "target_classes": ["garbage"],
            "downloaded_images": 0,
            "total_bytes": 0,
            "status": f"skipped:{note}",
        }

    data = json.loads(ann_path.read_text(encoding="utf-8"))
    images = [im for im in data.get("images", []) if im.get("flickr_url") or im.get("flickr_640_url")]
    # Take deterministically spaced sample across TACO batches for diverse backgrounds
    step = max(1, len(images) // limit)
    selected = images[::step][:limit]

    def _fetch(im: dict) -> tuple[bool, int]:
        url = im.get("flickr_640_url") or im.get("flickr_url")
        fname = f"taco_{im['id']:05d}.jpg"
        ok_dl, sz, _ = download_file(url, out_dir / "images" / fname, timeout=20)
        return ok_dl, sz

    ok_count = 0
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for ok_dl, sz in pool.map(_fetch, selected):
            if ok_dl:
                ok_count += 1
                total_bytes += sz

    print(f"      -> TACO subset ready: {ok_count}/{len(selected)} images ({total_bytes / (1024**2):.2f} MB)")
    return {
        "name": "TACO: Trash Annotations in Context (Zenodo 3587843 / GitHub pedropro/TACO)",
        "source_url": "https://zenodo.org/records/3587843",
        "license": "CC BY 4.0",
        "target_classes": ["garbage"],
        "downloaded_images": ok_count,
        "total_bytes": total_bytes,
    }


def _is_open_license(license_str: str) -> bool:
    low = (license_str or "").lower()
    if not low or "non-commercial" in low or "nc" in low or "copyright" in low or "fair use" in low:
        return False
    return any(tok in low for tok in ALLOWED_WM_LICENSES)


def _search_wikimedia_class(class_name: str, queries: list[str], target_count: int) -> dict:
    out_dir = RAW_DIR / "wikimedia" / class_name
    out_dir.mkdir(parents=True, exist_ok=True)
    candidates: list[dict] = []
    seen_titles: set[str] = set()

    for query in queries:
        if len(candidates) >= target_count * 2:
            break
        api_url = (
            "https://commons.wikimedia.org/w/api.php?"
            + urllib.parse.urlencode(
                {
                    "action": "query",
                    "generator": "search",
                    "gsrsearch": query,
                    "gsrnamespace": "6",
                    "gsrlimit": "30",
                    "prop": "imageinfo",
                    "iiprop": "url|size|mime|extmetadata",
                    "iiurlwidth": "640",
                    "format": "json",
                }
            )
        )
        try:
            payload = http_get_json(api_url, timeout=20)
        except Exception as exc:
            print(f"      [WARN] Wikimedia query '{query}' failed: {exc}")
            continue

        pages = (payload.get("query") or {}).get("pages") or {}
        for page in pages.values():
            title = page.get("title", "")
            if not title or title in seen_titles:
                continue
            ii_list = page.get("imageinfo") or []
            if not ii_list:
                continue
            ii = ii_list[0]
            mime = (ii.get("mime") or "").lower()
            if mime not in {"image/jpeg", "image/png", "image/webp"}:
                continue
            w = ii.get("width") or 0
            h = ii.get("height") or 0
            if w < 256 or h < 256:
                continue
            extmeta = ii.get("extmetadata") or {}
            lic = ((extmeta.get("LicenseShortName") or {}).get("value")) or ""
            if not _is_open_license(lic):
                continue
            url = ii.get("thumburl") or ii.get("url")
            if not url:
                continue
            seen_titles.add(title)
            candidates.append(
                {
                    "title": title,
                    "url": url,
                    "license": lic,
                    "query": query,
                    "pageid": page.get("pageid"),
                    "mime": mime,
                }
            )

    selected = candidates[:target_count]
    records = []
    total_bytes = 0

    def _dl(item: dict) -> tuple[bool, int, dict]:
        ext = ".png" if item["mime"] == "image/png" else ".webp" if item["mime"] == "image/webp" else ".jpg"
        safe_name = f"wm_{item['pageid']}{ext}"
        ok, sz, note = download_file(item["url"], out_dir / safe_name, timeout=25)
        if not ok:
            return False, 0, item
        rec = {
            "filename": safe_name,
            "class": class_name,
            "title": item["title"],
            "license": item["license"],
            "source_url": item["url"],
            "query": item["query"],
            "bytes": sz,
        }
        return True, sz, rec

    with ThreadPoolExecutor(max_workers=6) as pool:
        for ok, sz, rec in pool.map(_dl, selected):
            if ok:
                total_bytes += sz
                records.append(rec)

    return {
        "class": class_name,
        "downloaded": len(records),
        "total_bytes": total_bytes,
        "records": records,
    }


def collect_wikimedia_corpus() -> dict:
    """Download openly licensed Wikimedia Commons photographs for missing civic/unrelated classes."""
    print("[6/6] Collecting Wikimedia Commons CC-licensed images for drainage, water_pollution, sanitation, unrelated...")
    class_queries = {
        "drainage": (
            [
                "blocked storm drain street",
                "sewage overflow street",
                "clogged drain grate water",
                "urban street flooding drain",
                "sewer manhole overflow",
                "open sewage drain",
            ],
            120,
        ),
        "water_pollution": (
            [
                "polluted river garbage",
                "water pollution river plastic",
                "effluent industrial water pollution",
                "algae bloom polluted lake",
                "contaminated canal waste",
            ],
            100,
        ),
        "sanitation": (
            [
                "dirty public toilet",
                "unsanitary toilet urinal",
                "open defecation garbage alley",
                "filthy street gutter sanitation",
                "public restroom dirty",
            ],
            100,
        ),
        "road_damage": (
            [
                "asphalt road pothole",
                "broken cracked road surface",
                "damaged street pavement",
            ],
            50,
        ),
        "garbage": (
            [
                "garbage dump street pile",
                "overflowing public dustbin trash",
                "illegal waste dumping road",
            ],
            60,
        ),
        "unrelated": (
            [
                "selfie portrait person smiling",
                "mobile app screenshot interface",
                "paper receipt invoice document",
                "clean empty city street sidewalk",
                "green public park bench lawn",
                "houseplant flower pot indoor",
            ],
            170,
        ),
    }

    summary = {}
    all_records = []
    for cls, (queries, limit) in class_queries.items():
        res = _search_wikimedia_class(cls, queries, limit)
        summary[cls] = {"downloaded": res["downloaded"], "bytes": res["total_bytes"]}
        all_records.extend(res["records"])
        print(f"      -> Wikimedia [{cls}]: {res['downloaded']} verified CC images downloaded")

    wm_meta_path = RAW_DIR / "wikimedia" / "metadata.json"
    wm_meta_path.write_text(json.dumps(all_records, indent=2), encoding="utf-8")
    return {
        "name": "Wikimedia Commons Verified Open-License Corpus",
        "source_url": "https://commons.wikimedia.org",
        "license": "CC0 / CC-BY / CC-BY-SA / Public Domain (per-file verified)",
        "per_class": summary,
        "total_downloaded": len(all_records),
    }


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    manifest = {
        "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "datasets": [],
    }

    collectors = [
        collect_wastesegcluster,
        collect_hf_pothole_segmentation,
        collect_hf_pothole_classification,
        collect_hf_garbage_bins,
        collect_taco_subset,
        collect_wikimedia_corpus,
    ]

    for fn in collectors:
        info = fn()
        manifest["datasets"].append(info)

    manifest["elapsed_seconds"] = round(time.time() - t0, 2)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nDataset download complete in {manifest['elapsed_seconds']}s.")
    print(f"Manifest saved to: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
