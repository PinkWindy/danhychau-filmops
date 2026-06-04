# Norm Fallback & Window Film Modal Update Report

## 1. Summary

* Đã sửa rule resolve định mức theo `vehicle_model_code` (chuẩn hóa từ `model_name` khi cần), fallback năm: **EXACT_YEAR** → **LATEST_PRIOR_YEAR** → **LATEST_AVAILABLE_YEAR** → **NOT_FOUND**.
* API `GET /api/vehicle-norms/resolve` trả thêm trường **`norm_id`** ở cấp gốc (bên cạnh `norm.norm_id`).
* Đã bổ sung **Tư vấn khách hàng / TVBH** trên Request Detail (`sales_consultant`), merge chi tiết từ `GET /api/requests/{id}`.
* Card **Định mức áp dụng** hiển thị `requested year`, `resolved year`, `strategy`, `source`; cảnh báo vàng chỉ khi `strategy != EXACT_YEAR`.
* Modal **Chỉnh sửa vật tư Phim cách nhiệt trước duyệt**: khi mở — gọi resolve định mức + Material Preference để điền size/qty/SL; dropdown LOT/OFFCUT dùng **`/api/inventory/lots/active-options`** và **`/api/inventory/offcuts/active-options`**; tick mặc định bốn hạng mục chính (theo định mức + service); SL = 1 khi chọn.
* Backend: `_wf_snapshot_differs` so sánh thêm `planned_size`, `required_width_cm`, `required_length_cm` để bắt `change_reason` khi đổi size.
* **Lưu ý smoke `database_seed_integrity_smoke_test.py`**: test này yêu cầu bản ghi audit `DATABASE_RESET_SEEDED` (có sau luồng reset chuẩn). Script `norm_fallback_window_film_modal_smoke_test.py` gọi subprocess **`workstream_allocation_common_smoke_test.py`**; integrity nên chạy riêng sau `POST /api/admin/reset-database-standard-seed` nếu môi trường demo yêu cầu.

## 2. Root Cause

* Hệ thống có thể dùng chuỗi hiển thị dài (`RX350H PREMIUM CE`) thay vì mã dòng chuẩn (`RX350`) khi tra định mức nếu không normalize.
* Modal Window Film trước đây chủ yếu dựa vào snapshot `wf_allocation` tĩnh và danh sách `/api/lots` đầy đủ, không bootstrap từ resolve định mức + **active-options**, nên size/SL/nguồn dễ trống hoặc lệch.

## 3. Business Rules

* Ưu tiên `vehicle_model_code` (request → vehicle → normalize `model_name`).
* Fallback năm định mức: exact năm trong range → năm hiệu lực lớn nhất có `hi ≤ requested` → bản có `lo > requested` gần nhất → catalog fallback.
* Không hardcode kích thước phim; lấy từ định mức ACTIVE + Material Preference.
* User đổi nguồn/material/size so với snapshot đã lưu → bắt `change_reason` (đã mở rộng diff theo size/planned).

## 4. Smoke Test Result

* Script: `norm_fallback_window_film_modal_smoke_test.py`
* Result: **PASSED** (in ra dòng `NORM FALLBACK & WINDOW FILM MODAL SMOKE TEST PASSED`)
* Subprocess: `workstream_allocation_common_smoke_test.py` — **PASSED**

## 5. Final Status

**NORM FALLBACK & WINDOW FILM MODAL READY FOR DEMO**
