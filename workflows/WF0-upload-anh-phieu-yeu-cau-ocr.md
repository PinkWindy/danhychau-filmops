# Workflow Name
WF0 - Upload ảnh phiếu yêu cầu và trích xuất dữ liệu OCR

# Business Purpose
Quy trình này hướng dẫn cách tiếp nhận phiếu yêu cầu thi công dán xe từ đại lý dưới dạng hình ảnh chụp hoặc bản scan PDF, thực hiện tự động trích xuất chữ viết bằng công cụ OCR, tổ chức cho Admin kho đối soát sửa lỗi, và chuyển đổi dữ liệu sạch thành phiếu yêu cầu chính thức để đưa vào luồng xử lý đơn hàng.

# Trigger
Admin kho tải lên (upload) một hoặc nhiều file ảnh/PDF phiếu yêu cầu từ Lexus hoặc các đại lý khác thông qua giao diện PWA hoặc Mobile.

# Actors
* **Admin kho / Điều phối**: Người upload file, kiểm tra trực quan dữ liệu bóc tách được và ấn nút Xác nhận.
* **Image Intake & OCR Extraction Agent (`AG-10`)**: Hệ thống tự động kiểm tra định dạng, đánh giá chất lượng ảnh, thực hiện bóc tách và gán độ tin cậy.
* **Order Intake Agent (`AG-01`)**: Nhận dữ liệu sạch sau khi Admin xác nhận để tiến hành lập Request chính thức ở WF1.

# Agents Involved
* **Image Intake & OCR Extraction Agent (`AG-10`)**
* **Order Intake Agent (`AG-01`)**

# Input
* `image_file` (Luồng dữ liệu ảnh/PDF gốc).
* `uploaded_by` (ID tài khoản Admin kho upload).
* `uploaded_at` (Thời điểm upload).
* `source_channel` (Kênh tải lên: PWA/MOBILE).
* `dealer_hint` (Gợi ý mã đại lý dán xe - nếu có).

# Output
* `ocr_draft_id` (Mã định danh bản nháp OCR).
* `extracted_fields` (Dữ liệu đã trích xuất).
* `request_id` (Mã phiếu yêu cầu chính thức được tạo).
* `audit_events` (Nhật ký các sự kiện kiểm toán).

---

# Main Flow (Luồng xử lý chính)
1. Admin kho mở màn hình **Tải ảnh phiếu yêu cầu** trên ứng dụng di động hoặc PWA.
2. Admin chọn file ảnh chụp phiếu Lexus hoặc chọn file PDF scan từ máy tính và bấm **[Tải lên]**.
3. Hệ thống tiếp nhận file, ghi nhận sự kiện `IMAGE_UPLOADED` và tiến hành kiểm tra định dạng file cùng dung lượng.
4. Hệ thống kiểm tra chất lượng ảnh thô (độ mờ, góc nghiêng, ánh sáng). Ghi nhận `IMAGE_VALIDATED`.
5. Hệ thống gọi **Image Intake & OCR Extraction Agent (`AG-10`)** để khởi chạy tiến trình bóc tách OCR. Ghi nhận `IMAGE_OCR_STARTED`.
6. Agent 10 thực hiện trích xuất toàn bộ các trường thông tin ghi trên phiếu (đại lý, số phiếu, ngày tháng, khách hàng, xe, hạng mục thi công...) và gán độ tin cậy (confidence score) cho từng trường.
7. Agent 10 đóng gói dữ liệu thành bản nháp OCR Draft (`ocr_draft_id`) kèm theo danh sách trường thiếu hoặc trường có confidence thấp. Ghi nhận `IMAGE_OCR_COMPLETED`.
8. Hệ thống điều hướng Admin kho sang màn hình **Review OCR Draft**. Màn hình hiển thị song song file ảnh gốc và biểu mẫu nhập liệu với các trường confidence thấp được highlight màu đỏ/vàng cảnh báo.
9. Admin kho đối chiếu mắt trực tiếp giữa ảnh gốc và kết quả trích xuất, thực hiện gõ sửa lại các ký tự bị đọc sai (nếu có). Hệ thống ghi nhận sự kiện `OCR_FIELD_CORRECTED` kèm chi tiết thay đổi.
10. Sau khi đảm bảo toàn bộ dữ liệu chính xác, Admin bấm nút **[Xác nhận tạo Request]**.
11. Hệ thống tự động gửi dữ liệu sạch sang **Order Intake Agent (`AG-01`)**. Agent 01 kiểm tra hợp lệ nghiệp vụ theo Rule `R1`, cấp mã `request_id` chính thức, chuyển trạng thái đơn sang `DRAFT_APPROVED` và lưu trữ liên kết ảnh gốc để đối chiếu. Ghi nhận `OCR_DRAFT_CONFIRMED` và `REQUEST_CREATED_FROM_IMAGE`.
12. Hệ thống chuyển tiếp dữ liệu yêu cầu sạch sang **WF1** để bắt đầu chuỗi xử lý tự động (WF1 ➡️ WF2 ➡️ WF3... ➡️ WF7).

---

# Alternative Flows (Luồng rẽ nhánh)

### AF-01: Dữ liệu bóc tách có độ tin cậy cao
* *Bước 8*: Hệ thống hiển thị màn hình Review OCR Draft.
* *Bước rẽ*: Mọi trường thông tin đều có confidence score trên 90%, không có trường bắt buộc nào bị thiếu hoặc nghi ngờ sai lệch.
* *Xử lý*: Admin kho kiểm tra nhanh bằng mắt và bấm nút **[Xác nhận]** ngay mà không cần chỉnh sửa bất kỳ ô nhập liệu nào.

### AF-02: Dữ liệu bóc tách bị lỗi nhẹ
* *Bước 8*: Hệ thống hiển thị màn hình Review OCR Draft.
* *Bước rẽ*: Số khung xe (VIN) bị đọc sai ký tự 'B' thành '8' (confidence score của trường VIN là 74%).
* *Xử lý*: Admin click vào trường VIN, sửa lại đúng ký tự 'B', hệ thống cập nhật confidence score của trường này thành 100% (Human Confirmed), ghi audit log sửa trường và mở khóa nút [Xác nhận].

### AF-03: File yêu cầu tải lên là PDF nhiều trang
* *Bước 3*: Admin upload file PDF chứa nhiều trang phiếu yêu cầu của nhiều xe khác nhau.
* *Xử lý*: Agent 10 thực hiện bóc tách PDF thành các trang đơn lẻ. Với mỗi trang, Agent 10 tự động tạo một `ocr_draft_id` độc lập để Admin kiểm tra và duyệt riêng biệt, tránh gom gộp nhầm lẫn thông tin.

### AF-04: Admin hủy bỏ bản nháp OCR
* *Bước 8*: Hệ thống hiển thị màn hình Review OCR Draft.
* *Bước rẽ*: Admin phát hiện ảnh tải lên là phiếu bị trùng lặp, hoặc chụp nhầm tài liệu không liên quan.
* *Xử lý*: Admin bấm nút **[Hủy bỏ]** (Cancel). Hệ thống xóa bản nháp, giải phóng bộ nhớ tạm, trả trạng thái ảnh gốc về `CANCELLED` và ghi nhận sự kiện `OCR_DRAFT_CANCELLED`.

---

# Exception Flows (Luồng ngoại lệ)

### EF-01: File tải lên không đúng định dạng
* *Bước 3*: Admin vô tình chọn file Word `.docx` hoặc ảnh định dạng Apple `.heic`.
* *Xử lý*: Hệ thống chặn upload ngay tại client hoặc API trả về lỗi `IMAGE_INVALID_FORMAT`. Tiến trình kết thúc, yêu cầu Admin chọn lại file.

### EF-02: Chất lượng hình ảnh quá kém
* *Bước 4*: Ảnh chụp bị rung mờ hoặc chụp thiếu góc quan trọng.
* *Xử lý*: Hệ thống gán trạng thái `IMAGE_QUALITY_FAILED`, hiển thị thông báo lỗi `IMAGE_QUALITY_FAILED` trên màn hình và yêu cầu Admin chụp lại ảnh rõ nét hơn để tải lên lại.

### EF-03: Không thể xác định thông tin đại lý (Dealer) từ ảnh
* *Bước 6*: OCR không tìm thấy từ khóa đại lý nào khớp với Master Data, và Admin không chọn `dealer_hint`.
* *Xử lý*: Hệ thống hiển thị cảnh báo, bôi đỏ trường `dealer_name`. Nút [Xác nhận] bị khóa. Admin bắt buộc phải chọn thủ công đại lý từ danh sách dropdown khả dụng trên PWA mới có thể đi tiếp.

### EF-04: Thiếu thông tin model xe hoặc hạng mục thi công bắt buộc
* *Bước 6*: Phiếu viết tay bị thiếu nội dung dán xe hoặc bị rách mất phần thông tin xe dán.
* *Xử lý*: Hệ thống gán trạng thái `NEEDS_REVIEW`, khóa nút [Xác nhận]. Admin phải nhập bổ sung thủ công dòng xe hoặc các hạng mục dán phim. Nếu không có thông tin để nhập, Admin bắt buộc phải [Hủy bỏ] bản nháp và liên hệ lại đại lý để xác minh.

### EF-05: Thiếu thời gian giao xe yêu cầu (SLA)
* *Bước 6*: Phiếu đại lý không ghi rõ giờ cần lấy xe.
* *Xử lý*: Hệ thống hiển thị cảnh báo màu vàng tại trường `requested_delivery_at` nhưng không khóa cứng nút [Xác nhận]. Admin có thể tự thỏa thuận giờ giao xe với đại lý và nhập thủ công, hoặc hệ thống tự động gán thời gian mặc định (ví dụ: 17:00 ngày hôm sau).

### EF-06: Dịch vụ OCR gặp sự cố hệ thống
* *Bước 5*: Công cụ OCR bị lỗi kết nối mạng hoặc quá tải.
* *Xử lý*: Hệ thống ghi log lỗi `OCR_PROCESSING_FAILED`, hiển thị thông báo lỗi kỹ thuật và cho phép Admin chọn phương án: "Nhập liệu thủ công từ đầu" hoặc "Thử lại OCR sau 5 phút".

---

# Human Checkpoints (Điểm kiểm soát con người)
1. **Kiểm tra kết quả trích xuất OCR**: Admin kho đối chiếu trực tiếp giữa ảnh phiếu gốc và các trường thông tin do AI bóc tách được.
2. **Sửa đổi các trường dữ liệu nghi ngờ**: Admin gõ sửa các ký tự bị nhận diện sai hoặc bổ sung thông tin thiếu.
3. **Xác nhận tạo Request**: Hành động bấm nút bấm gửi để hệ thống tạo Request chính thức.

# Rules Applied
* [R1-intake-validation-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R1-intake-validation-rules.md)
* [R2-customer-dealer-data-governance-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R2-customer-dealer-data-governance-rules.md)
* [R9-audit-log-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R9-audit-log-rules.md)
* [Mobile Security & Audit Rules](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/mobile-interaction/mobile-security-audit-rules.md)

# Audit Events
* `IMAGE_UPLOADED`
* `IMAGE_VALIDATED`
* `IMAGE_OCR_STARTED`
* `IMAGE_OCR_COMPLETED`
* `OCR_FIELD_CORRECTED`
* `OCR_DRAFT_CONFIRMED`
* `OCR_DRAFT_CANCELLED`
* `REQUEST_CREATED_FROM_IMAGE`

# Completion Criteria
* Bản nháp OCR Draft chuyển sang trạng thái `OCR_CONFIRMED` thành công.
* Một bản ghi Request chính thức (`request_id`) được khởi tạo trong hệ thống với đầy đủ thông tin đại lý, dòng xe, hạng mục thi công.
* Liên kết file ảnh gốc được gắn chặt chẽ vào Request ID phục vụ đối soát.
* Dữ liệu sạch được bàn giao thành công cho **WF1**.
* Toàn bộ sự kiện tương tác của Admin và OCR được lưu trữ đầy đủ trong nhật ký kiểm toán.

# Status Flow (Luồng Trạng Thái)
* **Luồng xử lý chuẩn**:
  `IMAGE_UPLOADED` ➡️ `OCR_PROCESSING` ➡️ `OCR_DRAFT_READY` ➡️ `OCR_CONFIRMED` ➡️ `REQUEST_CREATED` ➡️ `SENT_TO_WF1`
* **Luồng phát hiện nghi ngờ / thiếu sót**:
  `IMAGE_UPLOADED` ➡️ `OCR_PROCESSING` ➡️ `OCR_DRAFT_READY` ➡️ `NEEDS_REVIEW` ➡️ (Admin sửa và bổ sung) ➡️ `OCR_CONFIRMED` ➡️ `REQUEST_CREATED` ➡️ `SENT_TO_WF1`
* **Luồng lỗi chất lượng / định dạng file**:
  `IMAGE_UPLOADED` ➡️ `IMAGE_QUALITY_FAILED` ➡️ `REUPLOAD_REQUIRED`
* **Luồng Admin từ chối**:
  `IMAGE_UPLOADED` ➡️ `OCR_PROCESSING` ➡️ `OCR_DRAFT_READY` ➡️ `OCR_DRAFT_CANCELLED`
