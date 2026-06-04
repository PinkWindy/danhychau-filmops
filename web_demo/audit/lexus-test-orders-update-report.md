# Lexus Test Orders Update Report

## 1. Summary

* Đã tạo 2 OCR draft test từ phiếu Lexus thực tế (metadata + ảnh placeholder trong `static/test_orders/`, có thể thay bằng ảnh thật).
* Mục tiêu là test end-to-end flow từ đầu: Upload / seed OCR → Admin confirm → Request → định mức + Material Preference → Manager → KTV → kho → Dashboard.
* Dữ liệu khách hàng/VIN hiển thị dạng masked (`customer_masked`, `vin_masked`).
* Hai request test (`REQ-TEST-LEXUS-115`, `REQ-TEST-LEXUS-117`) không tự approve; workstream ở `PENDING_APPROVAL`.
* Chỉ tạo luồng `WINDOW_FILM_INSTALLATION` (không PPF mặc định).
* Norm resolve qua API `/api/vehicle-norms/resolve` dùng logic có **fallback theo khoảng năm model gần nhất** nếu không khớp chính xác năm 2026.
* Vật tư theo hạng mục kính lấy từ **Material Preference** trong DB (không hardcode RT40/JB20 trong luồng Lexus).

## 2. Test Orders

| OCR Draft ID | Request ID | Request No | Vehicle | Customer Masked | Requested Delivery | Service | Expected Next Step |
|----------------|------------|------------|---------|-------------------|----------------------|---------|---------------------|
| OCR-DRAFT-LEXUS-115-NEW | REQ-TEST-LEXUS-115 | 01.2600115 | RX350H PREMIUM CE | KH_MASKED_LEXUS_115 | 2026-06-05 15:30 +07 | Phim cách nhiệt | Manager Approval |
| OCR-DRAFT-LEXUS-117-NEW | REQ-TEST-LEXUS-117 | 01.2600117 | RX350H PREMIUM CE | KH_MASKED_LEXUS_117 | 2026-06-06 10:00 +07 | Phim cách nhiệt | Manager Approval |

## 3. Business Rules

* OCR chỉ tạo draft; Admin bấm **Xác nhận tạo đơn** (hoặc API confirm) mới tạo request.
* Không tự approve (`approved_by` rỗng trên request; workstream `PENDING_APPROVAL`).
* Không hardcode mã vật tư trong module Lexus — resolve qua định mức + Material Preference.
* Định mức lấy từ `vehicle_film_norms` (seed demo `NORM-DEMO-RX350-WF-2024-2027` cho `RX350` + import Excel nếu có).
* Dữ liệu nhạy cảm ưu tiên masked trên UI.

## 4. Smoke Test Result

* Script: `lexus_test_orders_smoke_test.py`
* Result: **PASSED** (kết thúc bằng dòng `LEXUS TEST ORDERS SMOKE TEST PASSED`)

## 5. Final Status

**LEXUS TEST ORDERS READY FOR END-TO-END DEMO**
