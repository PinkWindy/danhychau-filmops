# Inventory Admin Demo Script

Hướng dẫn demo trên web demo DYC (`web_demo/`) sau khi đã chạy API server và mở giao diện.

---

## Demo Flow 1 — Nhập LOT mới

* Mở tab Quản lý kho
* Chọn sub-tab LOT
* Bấm Nhập LOT mới
* Nhập LOT-JB20-DEMO-NEW
* Xác nhận
* Kiểm tra LOT xuất hiện trong bảng
* Kiểm tra transaction IMPORT_LOT
* Kiểm tra audit LOT_IMPORTED

---

## Demo Flow 2 — Nhập mảnh dư thủ công

* Mở sub-tab Mảnh dư
* Bấm Nhập mảnh dư thủ công
* Nhập SUBLOT-JB20-DEMO-MANUAL
* Chọn material_code JB20
* Nhập kích thước, quality_status, storage_location
* Xác nhận
* Kiểm tra transaction IMPORT_OFFCUT_MANUAL
* Kiểm tra audit OFFCUT_IMPORTED_MANUAL

---

## Demo Flow 3 — Xuất LOT thủ công

* Chọn một LOT còn tồn
* Bấm Xuất
* Nhập chiều dài xuất
* Nhập reason
* Xác nhận
* Kiểm tra remaining_length_m giảm
* Kiểm tra transaction MANUAL_ISSUE_LOT
* Kiểm tra audit LOT_MANUAL_ISSUED

---

## Demo Flow 4 — Clear LOT

* Chọn LOT demo gần hết
* Bấm Clear
* Chọn clear_mode
* Nhập reason
* Xác nhận
* Kiểm tra remaining_length_m = 0
* Kiểm tra status CLEARED/SCRAPPED/CLOSED
* Kiểm tra record vẫn còn trong database
* Kiểm tra transaction CLEAR_LOT
* Kiểm tra audit LOT_CLEARED

---

## Demo Flow 5 — Release Lock

* Mở sub-tab Đang khóa
* Chọn LOT hoặc OFFCUT đang locked
* Bấm **Mở khóa** (hoặc nút Mở khóa trên thanh công cụ LOT / Mảnh dư)
* Nhập reason
* Xác nhận
* Kiểm tra is_locked=false
* Kiểm tra transaction RELEASE_LOCK_MANUAL
* Kiểm tra audit SOFT_LOCK_RELEASED_MANUAL

---

## Demo Flow 6 — validate-sources

* Mở Request Detail REQ-20260604-001
* Kiểm tra không có blocker
* Nếu source bị clear/scrapped, màn hình phải hiển thị cảnh báo đỏ

---

*Báo cáo kiểm thử:* [inventory-admin-test-report.md](./inventory-admin-test-report.md)
