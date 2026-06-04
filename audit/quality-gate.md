# CỔNG ĐÁNH GIÁ CHẤT LƯỢNG NGHIỆM THU (QUALITY GATES SPECIFICATION)
*Quy chuẩn đánh giá chất lượng và nghiệm thu các file đặc tả trong workspace*

---

## 1. Data Quality Gate (Cổng Chất lượng Dữ liệu)
* **Tiêu chí nghiệm thu:**
  - [ ] Toàn bộ các file cơ sở tri thức (Knowledge Base) dạng CSV phải parse được bằng thư viện Python chuẩn (`csv.DictReader`) mà không gây lỗi lệch cột.
  - [ ] Địa chỉ hoặc trường chứa dấu phẩy trong file CSV phải được bao bọc trong dấu nháy kép `""`.
  - [ ] Mã đời xe, mã vật tư và mã hạng mục thi công phải nhất quán 100% về khóa ngoại giữa các file CSV (ví dụ: `JB20`, `LEXUS_RX350`, `JOB_FILM_SIDE`).

---

## 2. Agent Output Quality Gate (Cổng Chất lượng Đầu ra của Agent)
* **Tiêu chí nghiệm thu:**
  - [ ] Các kết quả tính toán định mức, so khớp mảnh dư và đề xuất LOT của Agent phải được định dạng chính xác dưới dạng JSON khớp với schema tương ứng.
  - [ ] Mọi đề xuất lựa chọn mảnh dư phải ghi kèm điểm số Match Score tính theo dung sai chiều dài và diện tích để Quản lý dễ đối chiếu.

---

## 3. Workflow Quality Gate (Cổng Chất lượng Quy trình Tích hợp)
* **Tiêu chí nghiệm thu:**
  - [ ] Quy trình vận hành phải tuân thủ nghiêm ngặt tính liên tục: Đầu ra của Workflow này là đầu vào hợp lệ của Workflow tiếp theo.
  - [ ] Mỗi quy trình con (từ WF1 đến WF6) phải chứa ít nhất 3 luồng thay thế (Alternative Flows) và 3 luồng ngoại lệ (Exception Flows) để đảm bảo xử lý hết các tình huống lỗi thực tế.

---

## 4. Customer Data Governance Gate (Cổng Quản trị Dữ liệu Khách hàng)
* **Tiêu chí nghiệm thu:**
  - [ ] Tuyệt đối cấm sử dụng thông tin cá nhân thật (PII) của khách hàng hoặc đại lý trong toàn bộ dữ liệu mẫu và file mô phỏng.
  - [ ] Họ tên khách hàng phải được che giấu tối thiểu 60% ký tự (ví dụ: `Ngu*** Th* H**`), số điện thoại ẩn các số cuối (`0987.654.xxx`).

---

## 5. Cutting Group Logic Gate (Cổng Logic Gom Nhóm Cắt)
* **Tiêu chí nghiệm thu:**
  - [ ] Hệ thống bắt buộc phải nhận diện cờ `is_grouped_cut = true` của các hạng mục dán chung một loại phim để kích hoạt luồng gom nhóm cắt.
  - [ ] Cấm thực hiện trừ kho ảo theo từng dòng lẻ trong `norm_matrix.csv` đối với các hạng mục dán gom.
  - [ ] Giao dịch trừ kho thực tế chỉ được thực hiện một lần duy nhất theo mã nhóm cắt (`cut_group_id`) và chiều dài khối cắt thực tế.

---

## 6. Inventory Accuracy Gate (Cổng Kiểm soát Tồn kho Chính xác)
* **Tiêu chí nghiệm thu:**
  - [ ] Cấm thực hiện trừ kho tự động nếu chưa có xác nhận thực tế (`actual_size` và `actual_cut_block`) của Kỹ thuật viên (HITL-2).
  - [ ] Chặn tuyệt đối các giao dịch làm âm số dư của cuộn gốc hoặc mảnh dư trên hệ thống ảo (báo lỗi chênh lệch kho vật lý vs ảo).
  - [ ] Sau khi trừ kho thành công, Soft Lock giữ chỗ vật tư ảo phải được giải phóng hoàn toàn về trạng thái khả dụng cho các đơn hàng tiếp theo.

---

## 7. Human Approval Gate (Cổng Kiểm soát Duyệt của Con người)
* **Tiêu chí nghiệm thu:**
  - [ ] Cấm tuyệt đối Agent tự động ký duyệt phương án dán xe thay cho con người. Phương án bắt buộc phải do Quản lý Kho Kỹ thuật trực tiếp duyệt tay (HITL-1).
  - [ ] Trạng thái duyệt `APPROVED` ở WF5 chỉ được phép tạo trạng thái Reserved/Soft Lock giữ chỗ ảo, cấm trừ tồn kho vật lý.

---

## 8. Auditability Gate (Cổng Khả năng Kiểm toán Hệ thống)
* **Tiêu chí nghiệm thu:**
  - [ ] Mọi giao dịch thay đổi tồn kho thực tế, nhập mảnh dư, ghi nhận phế liệu, hoặc Quản lý tự ý điều chỉnh kích thước kế hoạch đều phải sinh log kiểm toán bất biến.
  - [ ] Bản ghi log kiểm toán bắt buộc phải chứa đầy đủ thông tin: giá trị trước thay đổi, giá trị sau thay đổi, lý do điều chỉnh, người thực hiện và mốc thời gian chi tiết.
