# Customer Filters, Address Auto-fill & Norm Edit Fix Report

## 1. Summary

- Bổ sung filter cho **Đại lý**, **Khách hàng lẻ**, **Hồ sơ xe**, **Định mức phim** (thanh lọc, tìm kiếm debounce, chip, tổng số kết quả, empty state nơi cần).
- Backend `GET` mở rộng query params; `with_meta=1` trả `{ items, total, filters_applied }`, không tham số thì vẫn trả **mảng** để tương thích.
- Sửa `GET /api/vehicles` trả **danh sách dict** (đã serialize) + cờ `has_active_norm` cho UX cảnh báo.
- Nút **Sửa** định mức: giữ cơ chế **delegation** + `data-norm-id`; modal load dữ liệu qua `normalizeListResponse` khi API trả object có `items`.
- Địa chỉ modal đại lý/KH: giữ `setupEditorAddress`, datalist TP/Phường, nút **Tự tạo lại địa chỉ**.
- Nhãn **Active / Inactive** (không dùng “Off”) + modal lý do cho activate/deactivate.

## 2. Root Cause — Norm Edit Button

**Nguyên nhân đã xác định trước đó (vẫn là căn cứ hiện tại):** nút Sửa dùng `onclick` với `JSON.stringify(norm_id)` trong attribute HTML → attribute vỡ / không gọi được handler đúng.

**Cách xử lý:** nút **Sửa** dùng `data-norm-id="..."` và listener **delegation** trên `#tab-customers` (không nhúng JSON vào `onclick`). Sau thay đổi API trả `{ items, total }`, bổ sung **`normalizeListResponse`** trong `moFormNorm` để `list.find` không trả `undefined` khi response là object.

## 3. Files Changed

| File |
|------|
| `web_demo/customer_api.py` |
| `web_demo/vehicle_norm_api.py` |
| `web_demo/static/app.js` |
| `web_demo/static/style.css` |
| `customer_filters_address_norm_smoke_test.py` (root `web_demo/`) |
| `audit/customer-filters-address-norm-fix-report.md` |

## 4. Filters Added

| Sub-tab | Filters added | Backend endpoint | Query params |
|--------|----------------|------------------|--------------|
| Đại lý | Tìm `q`, trạng thái, nhóm, TP, phường, có AMIS, có MST; chip; nút áp dụng/xóa/làm mới/tạo | `GET /api/dealers` | `q`, `status`, `dealer_group`, `city`, `ward`, `has_amis_code`, `has_tax_code`, `with_meta` |
| Khách hàng lẻ | `q`, `status`, `crm_status`, `source_channel`, `source_dealer_id`, `city`, `ward`, `has_phone`, `has_vehicle` | `GET /api/end-customers` | Tương ứng + `with_meta` |
| Hồ sơ xe | `q`, dòng xe, năm, đại lý, KH, TT xe, có KH, có định mức active | `GET /api/vehicles` | `q`, `vehicle_model_code`, `model_year`, `dealer_id`, `customer_id`, `vehicle_status`, `has_customer`, `has_active_norm`, `with_meta` |
| Định mức phim | `q`, loại phim, dòng xe, năm, TT, có kính lái/trời/sườn sau+TG | `GET /api/vehicle-norms` | `q`, `film_type`, `vehicle_model_code`, `model_year`, `status`, `has_windshield`, `has_sunroof`, `has_rear_side_triangle`, `with_meta` |

## 5. Address UX

- **TP:** input + `datalist` (`dyc-city-datalist`) từ `LOCATION_MASTER`.
- **Phường/Xã:** input + `dyc-ward-datalist` cập nhật theo TP; **cho phép gõ tay** (không validate cứng).
- **Địa chỉ đầy đủ:** `buildFullAddress` + `setupEditorAddress`; chỉnh tay `full_address` → không ghi đè cho đến khi bấm **Tự tạo lại địa chỉ**.
- Modal quick: nút **X**; ESC / đóng có confirm khi form dirty (đã có `_tryCloseQuickModal`).

## 6. Smoke Test Result

- **Test script:** `customer_filters_address_norm_smoke_test.py`
- **Passed:** 22
- **Failed:** 0
- **Result:** PASSED (dòng chuẩn: `CUSTOMER FILTERS ADDRESS & NORM UI SMOKE TEST PASSED`)

## 7. Remaining Notes

- `LOCATION_MASTER` là dữ liệu demo/local, chưa phải master hành chính production.
- Có thể nâng cấp sau bằng API địa bàn chính thức (VNPost / Bộ NV…).

## 8. Final Status

**CUSTOMER FILTERS + ADDRESS AUTO-FILL + NORM EDIT READY FOR DEMO**
