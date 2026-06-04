# Material Preference & Manual Order Update Report

## 1. Summary

* Sửa filter **Dòng xe** ở Định mức phim: tải danh sách động từ API `GET /api/vehicle-norms/model-options` (DISTINCT từ định mức ∪ hồ sơ xe), datalist + fallback + `console.warn` khi lỗi mạng.
* Thiết kế lại tab **Tạo đơn**: tiếng Việt theo section, bảng hạng mục kính với auto-fill định mức + material preference, override có lý do, payload `material_source` / `material_overrides`.
* Bổ sung **DbMaterialPreference**, seed demo, API CRUD + resolve + activate/deactivate (audit `MATERIAL_PREFERENCE_*`).
* **Không hardcode RT40/JB20** trong resolve định mức và manual-create: mã vật tư lấy từ `DbMaterialPreference`; thiếu cấu hình → `MISSING_PREFERENCE` / `NEEDS_REVIEW` theo luật hiện tại.
* **Quản lý kho**: sub-tab **Vật tư ưu tiên** (lọc, bảng, thêm/sửa modal, Active/Inactive với reason).
* **Chi tiết đơn**: section **Vật tư áp dụng** theo workstream + cảnh báo vàng nếu có `MISSING_PREFERENCE`.
* Smoke: `material_preference_manual_order_smoke_test.py` — **PASSED** (kèm chạy lại các smoke liên quan).

## 2. Root Cause — Model Filter Not Complete

Nguyên nhân thực tế: frontend gán datalist **Dòng xe** từ mảng cố định `DYC_MODEL_CODES` (vài mã demo), trong khi dữ liệu định mức trong SQLite có nhiều `vehicle_model_code` khác (từ import Excel / seed). Filter API `GET /api/vehicle-norms` đã hỗ trợ `vehicle_model_code`, nhưng **nguồn gợi ý filter không đồng bộ với DB** nên người dùng không thấy đủ dòng xe và dễ hiểu nhầm là hệ thống chỉ có một số model (ví dụ chỉ thấy ES250 sau lọc).

## 3. Data Model

**DbMaterialPreference** (`material_preferences`):

* `preference_id` (unique), `film_type`, `job_item`, `preferred_material_code`, `material_name`, `priority`, `status` (ACTIVE/INACTIVE), `effective_from` / `effective_to`, `note`, timestamps.
* Nhiều bản ghi ACTIVE cùng `film_type` + `job_item`: sắp xếp `priority` tăng dần, chọn bản ghi đầu làm mặc định; resolve trả `options` cho dropdown.

## 4. APIs Added/Changed

**Mới / đã có và dùng chính thức:**

* `GET /api/vehicle-norms/model-options` — danh sách model cho filter (norms ∪ vehicle profiles).
* `GET /api/material-preferences` — lọc `film_type`, `job_item`, `status`, `q`.
* `GET /api/material-preferences/resolve` — `film_type`, `job_item` (+ optional PPF filter).
* `POST /api/material-preferences` — tạo; audit `MATERIAL_PREFERENCE_CREATED`.
* `PUT /api/material-preferences/{preference_id}` — cập nhật; **reason** bắt buộc; `MATERIAL_PREFERENCE_UPDATED`.
* `POST .../activate`, `POST .../deactivate` — **reason** bắt buộc; audit tương ứng.

**Đã chỉnh hành vi:**

* `GET /api/vehicle-norms/resolve` — `auto_fill_items[].material_code` từ material preference, `material_source` = `MATERIAL_PREFERENCE` | `MISSING_PREFERENCE`.
* `POST /api/requests/manual-create` — hydrate vật tư từ preference khi thiếu sau norm; cutting group theo material thực tế; override vật tư → `material_overrides` / `material_override_reason` + audit `REQUEST_MATERIAL_OVERRIDDEN`.

## 5. UI Changed

* **Định mức phim**: label **Dòng xe**, placeholder **Chọn hoặc nhập dòng xe**, empty state: *Chưa có định mức phù hợp với dòng xe đã chọn.*; datalist load từ API.
* **Tạo đơn**: card 7 bước tiếng Việt; PPF/WF; bảng hạng mục kính động; ghi chú SLA; nút **Làm mới form**.
* **Quản lý kho**: sub-tab **Vật tư ưu tiên** + toolbar lọc + bảng + modal thêm/sửa (dùng overlay kho hiện có).
* **Chi tiết đơn**: card **Vật tư áp dụng** + cảnh báo thiếu preference; luồng WF card hiển thị `material_source` nhỏ.

## 6. Business Rules

* Mã vật tư mặc định lấy từ **Material Preference** (ACTIVE, `priority` nhỏ nhất).
* Người dùng đổi mã vật tư so với mặc định → **bắt buộc lý do** (theo dòng hoặc `material_override_reason` chung) → audit `REQUEST_MATERIAL_OVERRIDDEN`.
* Thiếu preference hoặc thiếu mã sau hydrate → request có thể **NEEDS_REVIEW** (cờ trong `exception_reason` / review path hiện có).
* Không còn phụ thuộc logic cố định RT40/JB20 trong backend cho resolve / manual-create (demo seed vẫn tạo RT40/JB20 trong **DB** để demo ổn định).

## 7. Smoke Test Result

* Script: `material_preference_manual_order_smoke_test.py`
* Kết quả: **PASSED** (in stdout: `MATERIAL PREFERENCE & MANUAL ORDER SMOKE TEST PASSED`).
* Đồng thời gọi lại: `manual_order_customer_smoke_test.py`, `customer_filters_address_norm_smoke_test.py`, `inventory_admin_smoke_test.py` — pass trong cùng script.
* `customer_norm_smoke_test.py`: **PASSED** sau cập nhật assert `material_source`.

## 8. Final Status

**MATERIAL PREFERENCE & MANUAL ORDER READY FOR DEMO**
