# CivicResolve Evidence Image Validation Evaluation Report

- **Model Version**: `civic-imgval-clip-v1.0.0`
- **Evaluation Split**: `real_held_out_test_only (synthetic_samples excluded)`
- **Total Held-Out Real Test Images**: `159`

## Visual Classifier Performance (Real Held-Out Test Split)

- **Accuracy**: `0.9809`
- **Macro Precision**: `0.9443`
- **Macro Recall**: `0.9801`
- **Macro F1-Score**: `0.9598`
- **Weighted F1-Score**: `0.9813`

### Per-Class Breakdown

| Class | Precision | Recall | F1-Score | Support |
|---|---:|---:|---:|---:|
| `garbage` | 1.0000 | 0.9688 | 0.9841 | 32 |
| `drainage` | 0.8571 | 1.0000 | 0.9231 | 6 |
| `water_pollution` | 0.9756 | 1.0000 | 0.9877 | 40 |
| `road_damage` | 1.0000 | 0.9833 | 0.9916 | 60 |
| `sanitation` | 0.8333 | 1.0000 | 0.9091 | 5 |
| `unrelated` | 1.0000 | 0.9286 | 0.9630 | 14 |

### Confusion Matrix (Rows = Actual, Cols = Predicted)

| Actual \ Pred | garbage | drainage | water_pollution | road_damage | sanitation | unrelated |
|---|---:|---:|---:|---:|---:|---:|
| `garbage` | 31 | 0 | 1 | 0 | 0 | 0 |
| `drainage` | 0 | 6 | 0 | 0 | 0 | 0 |
| `water_pollution` | 0 | 0 | 40 | 0 | 0 | 0 |
| `road_damage` | 0 | 1 | 0 | 59 | 0 | 0 |
| `sanitation` | 0 | 0 | 0 | 0 | 5 | 0 |
| `unrelated` | 0 | 0 | 0 | 0 | 1 | 13 |

## End-to-End Validation Gate Metrics

- **False Rejection Rate (Valid Civic -> INVALID)**: `0.0000` (0/143)
- **False Acceptance Rate (Unrelated -> VALID)**: `0.0000` (0/14)
- **Off-Category Mismatch Detection (Blocked/Review)**: `1.0000` (143/143)
- **Mean CPU Inference Latency**: `237.2 ms` (P95: `620.0 ms`)
