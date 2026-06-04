# KỊCH BẢN CHẠY DEMO TOÀN TRÌNH HỆ THỐNG (END-TO-END DEMO SCRIPT)
*Mục tiêu: Mô phỏng và nghiệm thu thực tế toàn bộ chuỗi quy trình tự động hóa kết hợp con người từ WF1 đến WF6*

---

## KỊCH BẢN DEMO: DÁN PHIM CAO CẤP CHO XE LEXUS RX350

### Tóm tắt kịch bản E2E:
Hệ thống tiếp nhận phiếu yêu cầu thi công dán sườn và dán kính hậu cho xe Lexus RX350 từ đại lý Lexus Trung Đông. Hệ thống sẽ chuẩn hóa dữ liệu, tra cứu định mức dán gom. Hệ thống tìm thấy mảnh dư phù hợp, tuy nhiên Quản lý quyết định dùng LOT gốc vì yêu cầu thẩm mỹ cao của xe Lexus. Hệ thống ghi nhận lý do phê duyệt và tạo Soft Lock cho LOT gốc sau khi Quản lý duyệt, gửi Job Card cho KTV, KTV báo cáo cắt thực tế thành công phát sinh mảnh dư mới, trừ tồn kho ảo, giải phóng lock và lập báo cáo.

---

### Bước 1: Tiếp nhận và Chuẩn hóa (WF1 & WF2)
* **Người thực hiện:** Admin kho
* **Thao tác:** Tải file yêu cầu thô lên hệ thống.
* **Hành động của Agent:**
  * **Order Intake Agent (WF1):** Quét file, bóc tách thông tin: Số khung `VIN_MASKED_RX350_001`, dòng xe `Lexus RX350`, đại lý `DEALER-001`, hạng mục dán: sườn + hậu, mã phim: `JB20`. Chuyển trạng thái phiếu thành `STANDARDIZED`.
  * **Master Data Agent (WF2):** Truy vấn master, xác nhận đại lý đã đăng ký, khách hàng `KH_MASKED_001` (Mã: `CUST-20260603-098`) đã có hồ sơ, số khung xe đã khớp profile. Chuyển sang WF3.
* **Tài liệu tham chiếu:** [sample-07-customer-vehicle-profile-created.json](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-07-customer-vehicle-profile-created.json).

---

### Bước 2: Mapping & Tra định mức dán gom (WF3)
* **Người thực hiện:** Tự động bởi hệ thống
* **Hành động của Agent:**
  * **Vehicle Film Mapping Agent:** Ánh xạ xe Lexus RX350 x dán sườn + hậu sang loại phim Window Film cao cấp mã chuẩn `JB20`.
  * **Norm Calculation Agent:** Tra cứu ma trận định mức dán, phát hiện sườn và hậu xe RX350 có cờ `is_grouped_cut = true` liên kết sang mã nhóm cắt `CG_RX350_SIDE_REAR` trong [cutting_group_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/cutting_group_matrix.csv).
  * **Kết quả:** Không lấy định mức lẻ, xác định khối cắt gom dự kiến (Planned Cut Block) là **152x143 cm**, chiều dài planned trừ kho là **1.43m** (planned_deduction_length_m = 1.43m, đã bao gồm safety margin 10%). Trong block 152x143, phần layout thành phẩm gồm kính hậu 60x130 và sườn trước 92x130; phần margin còn lại phục vụ thao tác kỹ thuật và dung sai. Chuyển sang WF4 ở trạng thái `NORM_ASSIGNED`.

---

### Bước 3: So khớp tối ưu mảnh dư và Phân bổ LOT gốc (WF4)
* **Người thực hiện:** Tự động bởi hệ thống
* **Hành động của Agent:**
  * **Offcut Optimization Agent:** Quét tồn kho mảnh dư dở dang `offcut_inventory.csv`. Có mảnh dư `SUBLOT-JB20-002` dài 2.5m nhưng chiều rộng chỉ 1.0m (Không vừa khối cắt 1.52x1.43m kể cả khi xoay). Mảnh dư khác `SUBLOT-JB20-001` dài 1.5m, rộng 1.52m có Match Score 86.6% (Đủ kích thước và hao phí ít). Đề xuất ưu tiên dùng mảnh dư này.
  * **LOT Allocation Agent (Phương án dự phòng):** Nếu Quản lý từ chối mảnh dư, đề xuất cắt từ cuộn dở dang cũ nhất `LOT-JB20-001` (đang dở dang, nhập kho ngày 2026-04-10) theo nguyên tắc FIFO.
  * **Lưu ý:** Tạo phương án đề xuất phân bổ, **chưa Soft Lock** vật tư trong kho ảo. Trạng thái phiếu là `ALLOCATED`.

---

### Bước 4: Trình Quản lý Kho duyệt & Soft Lock (WF5)
* **Người thực hiện:** **Quản lý Kho Kỹ thuật (HITL-1)**
* **Thao tác:** 
  * Quản lý nhận tin nhắn trình duyệt phương án trên Dashboard.
  * Quản lý xem xét và bấm nút **[PHÊ DUYỆT]** đặc cách dùng cuộn phim gốc `LOT-JB20-001` thay vì dùng mảnh dư để dán kính xe Luxury.
* **Hành động của Agent:**
  * **Approval Handoff Agent:** Chuyển trạng thái phiếu sang `APPROVED`. Thực hiện chuyển cuộn phim `LOT-JB20-001` sang Reserved/Soft Lock ảo (`is_locked = true`). Tồn kho vật lý **chưa bị trừ**.
  * Hệ thống tự động sinh Lệnh thi công (Job Card) gửi xuống màn hình thiết bị của Kỹ thuật viên.
* **Tài liệu tham chiếu:** [sample-01-manager-approval-message.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-01-manager-approval-message.md) và [sample-02-technician-task.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-02-technician-task.md).

---

### Bước 5: KTV thi công thực tế và Xác nhận số đo (WF6)
* **Người thực hiện:** **Kỹ thuật viên (HITL-2)**
* **Thao tác:**
  * KTV xuống kệ `A-RACK-03` lấy cuộn phim `LOT-JB20-001`.
  * Thực hiện cắt khối phim thực tế dài đúng 1.43m từ cuộn gốc khổ 1.52m (Khối cắt thực tế: 152x143 cm). Trong block 152x143, phần layout thành phẩm gồm kính hậu 60x130 và sườn trước 92x130; phần margin còn lại phục vụ thao tác kỹ thuật và dung sai. Dán sườn và hậu xe RX350 thành công.
  * Đo phần dở dang còn lại của cuộn: Chiều dài dư thừa rơi ra dài 1.20m (Đạt chuẩn mảnh dư Window Film). KTV đặt phần dư này lên kệ `OFFCUT-RACK-C`.
  * KTV bấm xác nhận hoàn thành trên thiết bị, nhập số liệu thực tế: `actual_length_m = 1.43m` (planned_deduction_length_m = 1.43m), `actual_cut_block = 152x143`, tạo mảnh dư mới dài 1.2m chất lượng EXCELLENT trên kệ `OFFCUT-RACK-C`.

---

### Bước 6: Cập nhật Tồn kho, Giải phóng Lock & Ghi Audit Trail (WF6)
* **Người thực hiện:** Tự động bởi hệ thống
* **Hành động của Agent:**
  * **Inventory Yield & Analytics Agent:**
    * Tiếp nhận xác nhận thực tế. Tính toán chênh lệch (khớp 100%, không lệch).
    * Thực thi trừ chiều dài còn lại của cuộn `LOT-JB20-001` trên kho ảo (trừ 1.43m).
    * Tự động khởi tạo mã mảnh dư mới `SUBLOT-JB20-003` ở trạng thái `ACTIVE` với kích thước 1.52m x 1.20m.
    * Giải phóng trạng thái khóa ảo của cuộn `LOT-JB20-001` (`is_locked = false`).
    * Ghi nhận 2 bản ghi log kiểm toán bất biến (1 log xuất trừ kho, 1 log nhập mảnh dư mới).
    * Đổi trạng thái phiếu dán xe thành `COMPLETED`.
* **Tài liệu tham chiếu:** [sample-03-warehouse-issue-note.json](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-03-warehouse-issue-note.json) và [sample-05-inventory-transaction-log.json](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-05-inventory-transaction-log.json).

---

### Bước 7: Xuất báo cáo kiểm toán hiệu suất (Yield Reporting)
* **Người thực hiện:** Kế toán kho / Quản lý vận hành
* **Thao tác:** Xem báo cáo hiệu suất vật tư định kỳ trên hệ thống dashboard.
* **Hành động của Agent:** Agent tự động kết xuất dữ liệu giao dịch trong ngày và cập nhật báo cáo hiệu suất [sample-06-yield-report.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-06-yield-report.md) hiển thị tỷ lệ hao hụt đạt mức tối ưu 6.68%, lượng mảnh dư tái sử dụng đạt 64.2%, giúp tiết kiệm đáng kể chi phí vật tư dán xe.
