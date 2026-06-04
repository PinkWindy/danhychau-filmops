# DANH SÁCH TÍNH NĂNG VÀ LỖI CẦN NÂNG CẤP (PRODUCT BACKLOG)
*Phiên bản: Hậu MVP (Post-MVP)*

---

## 1. Must Have (Bắt buộc phải có trước khi golive)
*Các hạng mục sống còn để đưa vào chạy chính thức tại xưởng:*
* **[ ] BACKLOG-01 - Tích hợp thiết bị đo phim thông minh của KTV:**
  * *Mô tả:* Kết nối trực tiếp thiết bị đo chiều dài phim bằng cảm biến laser của KTV vào ứng dụng để tự động điền giá trị `actual_length_m` khi cắt, loại bỏ hoàn toàn việc gõ tay thủ công để giảm thiểu sai sót dữ liệu.
* **[ ] BACKLOG-02 - Đồng bộ cơ sở dữ liệu tồn kho thực tế:**
  * *Mô tả:* Đồng bộ hóa tự động dữ liệu trừ kho ảo từ `inventory-transaction-schema.json` sang phần mềm kế toán kho vật lý (SAP/ERP) của DYC thay vì xuất file Excel báo cáo đối soát thủ công định kỳ.
* **[ ] BACKLOG-03 - Cơ chế khôi phục giao dịch tự động (Automatic Transaction Rollback):**
  * *Mô tả:* Triển khai tính năng tự động rollback số dư kho ảo nếu phát hiện giao dịch ghi nhật ký kiểm toán (Audit Log) bị lỗi mạng hoặc crash phần cứng giữa chừng, đảm bảo tính toàn vẹn tuyệt đối cho cơ sở dữ liệu.

---

## 2. Should Have (Nên có để tối ưu trải nghiệm)
*Các tính năng giúp quy trình vận hành trơn tru và hiệu quả hơn:*
* **[ ] BACKLOG-04 - Nhận diện chữ viết tay phiếu đại lý (OCR Enhancements):**
  * *Mô tả:* Nâng cấp Order Intake Agent để nhận diện chữ viết tay hoặc ảnh chụp phiếu thi công bị mờ từ đại lý gửi qua Zalo/Email, giảm thời gian nhập phiếu thủ công của Admin xuống dưới 1 phút.
* **[ ] BACKLOG-05 - Gợi ý sơ đồ cắt trực quan (Visual Nesting Layout):**
  * *Mô tả:* Tự động dựng hình sơ đồ cắt (sơ đồ ghép mảnh dán lên khổ cuộn phim 1.52m) hiển thị trực tiếp trên màn hình máy tính của KTV, giúp KTV dễ dàng hình dung và thực hiện đúng sơ đồ dán gom được phê duyệt.
* **[ ] BACKLOG-06 - Cơ chế cảnh báo sớm hạn sử dụng mảnh dư (Offcut Expiry Alerts):**
  * *Mô tả:* Phát cảnh báo khi các mảnh dư dở dang lưu kho quá 60 ngày chưa sử dụng để tránh bụi bẩn làm giảm chất lượng keo dán của PPF/Window Film.

---

## 3. Could Have (Có thể có nếu dư dả nguồn lực)
*Các nâng cấp tăng tính thông minh và tự động hóa cao:*
* **[ ] BACKLOG-07 - Dự báo nhu cầu vật tư thông minh (Demand Forecasting Agent):**
  * *Mô tả:* Thêm Agent phân tích lịch sử dán xe và xu hướng thị trường để dự báo trước lượng phim cách nhiệt/PPF cần nhập kho trong tháng tiếp theo, giảm thiểu rủi ro hết hàng dở dang.
* **[ ] BACKLOG-08 - Tự động đề xuất phân nhóm xe mới:**
  * *Mô tả:* Sử dụng học máy để phân nhóm tự động các dòng xe mới ra mắt vào nhóm kích thước tương đương (ví dụ: gán Lexus RX2027 vào kích thước tương đương RX350) thay vì chuyển sang Quản lý duyệt thủ công.

---

## 4. Won’t Have for MVP (Không thực hiện trong giai đoạn này)
*Các tính năng tạm thời gác lại để tập trung vào cốt lõi quản lý kho phim:*
* **[ ] BACKLOG-09 - Tự động phê duyệt phương án cắt phim của Agent:**
  * *Mô tả:* Hệ thống tự động duyệt phương án cắt phim thay cho Quản lý nếu Match Score đạt 100% để tăng tốc độ.
  * *Lý do loại bỏ:* Vi phạm nguyên tắc an toàn kiểm soát (Human-in-the-loop). Việc phê duyệt bắt buộc phải do Quản lý Kho Kỹ thuật trực tiếp thực hiện bằng tay để chịu trách nhiệm về hao hụt vật tư.
* **[ ] BACKLOG-10 - Hệ thống camera giám sát kỹ thuật tự động:**
  * *Mô tả:* Dùng camera AI để giám sát KTV cắt dán phim tại xưởng thi công thực tế nhằm phát hiện lỗi kỹ thuật.
  * *Lý do loại bỏ:* Chi phí triển khai lớn, chưa cần thiết cho giai đoạn đầu quản trị kho ảo.
