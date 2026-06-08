# Database Standard Seed Report

- **Generated (UTC):** `2026-06-05T17:54:14Z`
- **Integrity smoke:** `PASS` (exit 0) — chạy **sau** bước đếm DB; chi tiết mục 7.
- **Ghi chú:** Script **không** reset database. Bảng mục 1 / 2.1 đếm **trước** khi chạy smoke subprocess (smoke có thể thay đổi tồn kho). Nếu integrity FAIL: `python reset_database_full_seed.py` rồi chạy lại báo cáo.

## 1. Seed Summary Counts

| Nhóm | Số bản ghi |
|------|------------:|
| Dealers | 5 |
| End Customers (bảng `customers`) | 5 |
| Vehicle Profiles | 8 |
| Vehicle Film Norms | 118 |
| Material Preferences | 9 |
| LOTs | 25 |
| OFFCUTs | 8 |
| OCR Drafts | 2 |
| Requests | 8 |
| Workstreams | 10 |
| Job Cards | 6 |
| Inventory Transactions | 14 |
| Audit Logs | 23 |

## 2.1 Seed Summary Counts

(Trùng mục 1 — giữ heading theo yêu cầu nghiệm thu.)

## 2.2 Film Norm Import Result

- **File nguồn (chuẩn báo cáo):** `D:\Quản lý vận hành DYC\Phim cách nhiệt - Định mức chuẩn.xlsx`
- **File thực tế dùng phân tích:** `D:\Quản lý vận hành DYC\Phim cách nhiệt - Định mức chuẩn.xlsx`
- **Tổng dòng thân sheet (không gồm header):** 117
- **Dòng dữ liệu hợp lệ (sẽ import nếu chạy import):** 117
- **Skip — dòng trống:** 0
- **Skip — thiếu mã dòng xe:** 0
- **Skip — Năm Model không hợp lệ / rỗng:** 0
- **Số bản ghi trong DB gắn với import Excel (ước lượng):** `117` (norm_id `NORM-XLS%` hoặc note chứa `Import Excel`)

### 10 dòng định mức mẫu (sau seed, ưu tiên bản ghi từ Excel)

| film_type | vehicle_model_code | model_year (range) | windshield | rear_window | front_side | rear_side_triangle | sunroof | status |
|-----------|-------------------|---------------------|--------------|---------------|------------|---------------------|---------|--------|
| Phim cách nhiệt | ES250 | 2018 | 76x140 | 70x130 | 82x130 | 100x152 |  | ACTIVE |
| Phim cách nhiệt | ES250 | 2019 | 76x140 | 70x130 | 82x130 | 100x152 |  | ACTIVE |
| Phim cách nhiệt | ES250 | 2020 | 76x140 | 70x130 | 82x130 | 100x152 |  | ACTIVE |
| Phim cách nhiệt | ES250 | 2021 | 76x140 | 70x130 | 82x130 | 100x152 |  | ACTIVE |
| Phim cách nhiệt | ES250 | 2022 | 76x140 | 70x130 | 82x130 | 100x152 |  | ACTIVE |
| Phim cách nhiệt | ES250 | 2023 | 76x140 | 70x130 | 82x130 | 100x152 |  | ACTIVE |
| Phim cách nhiệt | ES250 | 2024 | 76x140 | 70x130 | 82x130 | 100x152 |  | ACTIVE |
| Phim cách nhiệt | ES250 | 2025 | 76x140 | 70x130 | 82x130 | 100x152 |  | ACTIVE |
| Phim cách nhiệt | ES250 | 2026 | 76x140 | 70x130 | 82x130 | 100x152 |  | ACTIVE |
| Phim cách nhiệt | ES300H | 2018 | 76x140 | 70x130 | 82x130 | 100x152 |  | ACTIVE |

### Resolve định mức (`vehicle_norm_logic.resolve_vehicle_norm_with_year_fallback`, tương đương GET `/api/vehicle-norms/resolve`)

**RX350 / 2026**
- `found`: **True**
- `norm_id`: `NORM-XLS-PHIM_CÁCH_NHIỆT-RX350-2026`
- Kính lái (windshield_size): `87x152`
- Kính hậu: `60x130`

**RX350 / 2023**
- `found`: **True**
- `norm_id`: `NORM-XLS-PHIM_CÁCH_NHIỆT-RX350-2023`
- Kính lái (windshield_size): `87x152`
- Kính hậu: `60x130`

**ES250 / 2024**
- `found`: **True**
- `norm_id`: `NORM-XLS-PHIM_CÁCH_NHIỆT-ES250-2024`
- Kính lái (windshield_size): `76x140`
- Kính hậu: `70x130`

**CAMRY / 2025**
- `found`: **False**
- API trả `found=false` — **không crash**.
- Khi tạo đơn: hệ thống có thể đặt `request_status = NEEDS_REVIEW` và cảnh báo thiếu định mức ACTIVE (theo logic `vehicle_norm_logic` / `customer_api`).

## 2.3 PPF Norm Result

- **Có định mức PPF Full xe (global):** Có (`norm_id=NORM-PPF-ALL-ALL-DEFAULT`).
- **item_code (note JSON):** `FULL_VEHICLE_PPF`
- **planned_size (note JSON):** `152x1300`
- **windshield_size (block PPF trên row):** `152x1300` → width_cm=152.0, length_cm=1300.0
- **required_length_m (note JSON):** 13.0
- **status:** `ACTIVE`
- **Kiểm tra tổng hợp (2.3):** `PASS`

## 2.4 Material Preference Result

| job_item | Kỳ vọng | Kiểm tra |
|:---|:---|:---|
| WINDSHIELD | `RT40` | DB: `OK` | resolve: `OK` → `RT40` |
| REAR_WINDOW | `JB20` | DB: `OK` | resolve: `OK` → `JB20` |
| FRONT_SIDE | `JB20` | DB: `OK` | resolve: `OK` → `JB20` |
| REAR_SIDE_TRIANGLE | `JB20` | DB: `OK` | resolve: `OK` → `JB20` |
| TRIANGLE | `JB20` | DB: `OK` | resolve: `OK` → `JB20` |
| REAR_SIDE | `JB20` | DB: `OK` | resolve: `OK` → `JB20` |
| SUNROOF | `JB20` | DB: `OK` | resolve: `OK` → `JB20` |
| PPF_BODY (ưu tiên 1) | `T-TYPE` | DB: `OK` | resolve: `OK` → `T-TYPE` |
| PPF_BODY (ưu tiên 2) | `M-TYPE` | DB: `OK` | (API resolve chỉ trả một mã ưu tiên cao nhất) |

- **Quy tắc nghiệm thu:** Mã vật tư WF/PPF phải khớp bảng `material_preferences` và hàm `resolve_material_preference` (cùng logic GET `/api/material-preferences/resolve`).
- **Không hardcode RT40/JB20 trong luồng tạo đơn / OCR confirm / allocation:** logic tạo đơn và phân bổ dùng resolve & plan (xem `customer_api`, `wf_allocation_service`, `material_preference_logic`); smoke `material_preference_manual_order` và `workstream_allocation_common` xác nhận hành vi.

## 2.5 OCR Draft Check

### `OCR-DRAFT-LEXUS-115-NEW`
- **Tồn tại:** Có
- **review_status:** `NEEDS_REVIEW` (kỳ vọng NEEDS_REVIEW)
- **ocr_status:** `COMPLETED` (kỳ vọng COMPLETED)
- **Chưa tự tạo request:** `OK` (`created_request_id=''`)
- **Payload demo đầy đủ (không placeholder MASKED, VIN 17 ký tự):** `OK`
### `OCR-DRAFT-LEXUS-117-NEW`
- **Tồn tại:** Có
- **review_status:** `NEEDS_REVIEW` (kỳ vọng NEEDS_REVIEW)
- **ocr_status:** `COMPLETED` (kỳ vọng COMPLETED)
- **Chưa tự tạo request:** `OK` (`created_request_id=''`)
- **Payload demo đầy đủ (không placeholder MASKED, VIN 17 ký tự):** `OK`

- **OCR draft checks tổng:** `PASS`

## 6. Demo Request Check

| Request ID | Request Status | #WS | PPF Status | Window Film Status | Purpose | Next Step |
|---|---:|---:|---|---|---|---|
| REQ-DEMO-PENDING-PPF-WF | ALLOCATED | 2 | PENDING_APPROVAL | PENDING_APPROVAL | Đơn đã phân bổ PPF + Window Film, chờ QL duyệt | Phê duyệt từng workstream / kiểm tra allocation |
| REQ-DEMO-IN-PROGRESS | IN_PROGRESS | 2 | IN_PROGRESS | ASSIGNED_TO_TECHNICIAN | KTV đã bắt đầu thi công | Tiếp tục job / actual |
| REQ-DEMO-PARTIAL | PARTIALLY_COMPLETED | 2 | CLOSED | IN_PROGRESS | Một đội xong, một đội còn làm | Hoàn tất WF còn lại |
| REQ-DEMO-CLOSED | CLOSED | 2 | CLOSED | CLOSED | Đơn hoàn tất, có ledger + audit | Xem báo cáo / audit |
| REQ-DEMO-NEEDS-REVIEW | NEEDS_REVIEW | 0 | — | — | Thiếu norm hoặc preference | Bổ sung định mức / Material Preference |
| REQ-DEMO-EXCEPTION-HOLD | EXCEPTION_HOLD | 0 | — | — | Exception nguồn vật tư | QL xử lý exception |
| REQ-20260604-001 | ALLOCATED | 2 | PENDING_APPROVAL | PENDING_APPROVAL | Legacy VIP + validate-sources (smoke inventory) | Phê duyệt / thi công demo |

## 7. Smoke Test Detail

| Script | Result | Exit |
|--------|:------:|-----:|
| database_seed_integrity_smoke_test.py | **PASS** | 0 |
| workstream_allocation_common_smoke_test.py | **PASS** | 0 |
| material_preference_manual_order_smoke_test.py | **PASS** | 0 |
| inventory_admin_smoke_test.py | **PASS** | 0 |
| manual_order_customer_smoke_test.py | **PASS** | 0 |
| location_master_address_smoke_test.py (nếu có JSON) | **PASS** / rc=0, PASS=True | 0 |

## 8. Final Conclusion

**DATABASE STANDARD SEED READY FOR WEBSITE DEMO**
