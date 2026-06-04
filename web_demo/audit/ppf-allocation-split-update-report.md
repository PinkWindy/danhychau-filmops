# PPF Allocation Split Update Report

## 1. Summary

* Đã sửa modal **Chỉnh sửa trước duyệt** của PPF (file `static/ppf_preflight_editor.js` + nhánh `chiinhSuaWs` trong `static/app.js`).
* PPF mặc định là **Full xe** (`FULL_VEHICLE_PPF`), block **152×1300 cm**, chiều dài trừ kho **13.0m**, số lượng **1**.
* Cho phép **chia nguồn** từ nhiều LOT hoặc OFFCUT nếu một cuộn không đủ; payload lưu trong `workstreams.ppf_allocation_json`.
* Các hạng mục PPF khác có trong bảng, mặc định **không tick** (theo `PPF_ITEM_DEFINITIONS` trong `ppf_allocation_service.py`).
* **Không trừ kho** ở bước chỉnh sửa; sau **duyệt** tạo **soft lock** cho từng nguồn; sau **KTV complete** (WF6) trừ kho **từng dòng nguồn** theo `allocated_length_m`.
* API mới: **`PUT /api/workstreams/{workstream_id}/ppf-allocation`** (body JSON như spec). Sửa lỗi **`db.refresh` trước `commit`** khiến `ppf_allocation_json` không được lưu.

## 2. Root Cause

* Thiết kế cũ: PPF chỉ một cặp `allocated_source_id` / một chiều dài; modal cũ không hỗ trợ **nhiều LOT/OFFCUT** cho cùng Full xe.
* Không phù hợp thực tế khi một LOT **không đủ 13m** và cần ghép nguồn.

## 3. UI Changes

* Modal PPF dạng **bảng**: cột **Hạng mục**, **SL**, **Kích thước (cm)**, **Chiều dài yêu cầu (m)**; mỗi hạng mục được chọn có các dòng **Loại nguồn / Mã / Lấy (m) / Ghi chú**.
* Section **Kiểm tra đủ vật tư** (tổng yêu cầu vs đã phân bổ, cảnh báo thiếu 13m).
* **Lý do chỉnh sửa** bắt buộc khi backend báo `PPF_CHANGE_REASON_REQUIRED`.
* Card phê duyệt (`hienThiThePheDuyet`) và **card luồng trong Request Detail** (`hienThiTheLuong`): hiển thị loại PPF, Full xe, nguồn từng dòng, trạng thái đủ/thiếu, badge **Chia nguồn** khi có ≥2 nguồn có mã.

## 4. Business Rules

* Full xe luôn được chọn (checkbox disabled).
* Tổng `allocated_length_m` của Full xe phải **≥** `required_length_m` (mặc định 13.0m).
* Mỗi nguồn: cùng `material_code` với `ppf_type`, không vượt `remaining_length_m` / `length_m`, không chọn nguồn **locked** bởi request khác (trừ `admin_override`).
* Đổi loại / nguồn / chia nguồn / size → **change_reason** bắt buộc (so với snapshot đã lưu).
* Soft lock **từng** LOT/OFFCUT sau approve; audit `SOFT_LOCK_RECORDED`, `PPF_SOURCE_SPLIT` khi >1 nguồn.

## 5. Smoke Test Result

* Script: `ppf_allocation_split_smoke_test.py`
* Result: **PASSED** (in ra `PPF ALLOCATION SPLIT SMOKE TEST PASSED`)
* Kèm gọi lại: `material_preference_manual_order_smoke_test.py`, `inventory_admin_smoke_test.py`, `manual_order_customer_smoke_test.py`.

## 6. Final Status

**PPF ALLOCATION SPLIT READY FOR DEMO**
