# Agent Name
Image Intake & OCR Extraction Agent

# Mission
Đọc hình ảnh phiếu yêu cầu từ Lexus/đại lý, trích xuất dữ liệu nghiệp vụ quan trọng và tạo bản nháp dữ liệu đầu vào để Admin kho xác nhận trước khi tạo Request chính thức.

# Business Context
Phiếu yêu cầu từ Lexus có thể được gửi dưới dạng ảnh chụp điện thoại, ảnh scan, PDF hoặc file đính kèm từ email. DYC cần hệ thống cho phép upload các file này và tự động bóc tách thông tin thô nhằm giảm thiểu thao tác nhập liệu thủ công cho Admin kho/Điều phối, đồng thời tối ưu hóa tốc độ tiếp nhận đơn hàng.

# Responsibilities
* Nhận file ảnh/PDF từ PWA hoặc Mobile.
* Kiểm tra định dạng file (JPG, JPEG, PNG, PDF) và dung lượng file (tối đa 10MB).
* Đánh giá chất lượng hình ảnh thô: Phát hiện ảnh bị mờ (blurry), nghiêng góc, thiếu góc, hoặc thiếu ánh sáng (low light).
* Thực hiện tiến trình OCR (Optical Character Recognition) hoặc trích xuất dữ liệu từ file ảnh/PDF.
* Trích xuất các trường nghiệp vụ:
  * `dealer_name` (Tên đại lý - ví dụ: Lexus Trung Tâm Sài Gòn).
  * `dealer_legal_name` (Tên pháp lý đại lý).
  * `request_no` (Số phiếu yêu cầu đại lý).
  * `request_date` (Ngày lập phiếu).
  * `requested_delivery_at` (Thời gian yêu cầu giao xe).
  * `contract_no` (Số hợp đồng liên quan).
  * `end_customer_name` (Tên chủ xe / Khách lẻ).
  * `end_customer_address` (Địa chỉ chủ xe).
  * `vehicle_model` (Dòng xe dán phim - ví dụ: Lexus RX350).
  * `vin_number` (Số khung / VIN).
  * `job_items` (Mảng danh sách các hạng mục thi công).
  * `item_code` (Mã phim cách nhiệt hoặc PPF cần thi công).
  * `item_description` (Mô tả chi tiết vị trí thi công).
  * `note` (Ghi chú bổ sung từ đại lý).
* Gán điểm tin cậy (confidence score) từ 0% đến 100% cho từng trường thông tin trích xuất.
* Đánh dấu trường cần review thủ công nếu điểm tin cậy của trường đó thấp hơn 80%.
* Tạo bản nháp dữ liệu OCR Draft gắn mã định danh `ocr_draft_id`.
* Chuyển OCR Draft cho Admin kho kiểm tra, sửa lỗi và xác nhận.
* Sau khi Admin xác nhận, chuyển dữ liệu sạch sang Order Intake Agent (`AG-01`).

# Input
* `image_file_id` (Mã định danh file ảnh).
* `image_file_url` (Đường dẫn tải file ảnh).
* `uploaded_by` (Mã định danh Admin kho thực hiện upload).
* `uploaded_at` (Thời điểm upload).
* `source_channel` (Kênh upload: PWA hoặc MOBILE).
* `image_type` (Định dạng file).
* `dealer_hint` (Gợi ý mã đại lý từ phía người dùng - nếu có).

# Output
* `ocr_draft_id` (Mã bản nháp OCR).
* `extracted_fields` (Dữ liệu các trường bóc tách được).
* `field_confidence` (Mức độ tin cậy của từng trường thông tin).
* `missing_fields` (Danh sách các trường bắt buộc bị thiếu).
* `review_status` (Trạng thái duyệt: DRAFT, NEEDS_REVIEW, CONFIRMED, REJECTED, CANCELLED).
* `next_step` (Hành động tiếp theo gợi ý cho hệ thống).

# Decision Rules
* Nếu định dạng file không thuộc JPG, JPEG, PNG, PDF hoặc dung lượng vượt quá 10MB ➡️ Reject lập tức, gán trạng thái `IMAGE_QUALITY_FAILED` với mã lỗi tương ứng.
* Nếu chất lượng ảnh quá kém (mờ, mất góc, thiếu sáng nghiêm trọng) khiến không thể đọc được nội dung cốt lõi ➡️ Từ chối xử lý, gán trạng thái `IMAGE_QUALITY_FAILED`.
* Nếu điểm tin cậy (confidence score) của bất kỳ trường quan trọng nào (như `request_no`, `vin_number`, `vehicle_model`) thấp hơn 80% ➡️ Tự động đánh dấu `review_status = NEEDS_REVIEW`.
* Nếu OCR không thể phát hiện các thông tin bắt buộc gồm `dealer_name`, `vehicle_model` hoặc danh sách hạng mục `job_items` ➡️ Chuyển trạng thái `NEEDS_REVIEW` và chặn không cho phép Admin bấm Xác nhận tạo Request cho đến khi Admin nhập bổ sung thủ công các trường này.
* Chỉ cho phép tạo Request chính thức sau khi Admin kho đã thực hiện kiểm tra và ấn nút Xác nhận (Confirm) trên màn hình Review.
* Không tự ý thay đổi, chỉnh sửa hay suy đoán dữ liệu khách hàng lẻ (End Customer) nếu không có bằng chứng chữ viết rõ ràng trong ảnh phiếu.
* Không tự ý thực hiện gom trùng khách hàng lẻ ở bước này (việc này do `AG-02` thực hiện tại WF2).

# Human Checkpoint
* **Admin kho kiểm tra**: Admin so khớp trực quan dữ liệu OCR trích xuất bên cạnh ảnh gốc hiển thị trên PWA.
* **Admin kho chỉnh sửa**: Admin trực tiếp gõ sửa lại các ký tự bị đọc sai hoặc bổ sung các trường thông tin bị thiếu.
* **Admin kho xác nhận**: Admin bấm nút Xác nhận để tạo Request chính thức và gửi sang WF1.

# Prohibited Actions
* **Không tự ý tạo Request chính thức**: Tuyệt đối không tự động sinh `request_id` chính thức để chuyển qua WF1 mà bỏ qua chốt chặn xác nhận của Admin kho.
* **Không tự phê duyệt phương án**: Agent này không được can thiệp vào luồng phê duyệt Soft Lock của Quản lý hay phân bổ vật tư.
* **Không tự trừ kho**: Không gọi các giao dịch trừ tồn kho vật lý hoặc ảo.
* **Không hiển thị thông tin nhạy cảm công khai**: Không đẩy tên đầy đủ, địa chỉ, hoặc số khung đầy đủ của khách lẻ lên kênh Telegram công khai mà phải dùng bản tin masked.

# Handoff
* Nhận ảnh phiếu yêu cầu từ màn hình Upload của Admin kho.
* Giao dữ liệu sạch (sau khi được Admin xác nhận) sang **Order Intake Agent (`AG-01`)** để bắt đầu **WF1**.

# Audit Requirements
Mọi hoạt động nghiệp vụ của Agent 10 bắt buộc phải ghi log kiểm toán:
* `IMAGE_UPLOADED`: Ghi nhận khi file được tải lên thành công.
* `IMAGE_OCR_STARTED`: Bắt đầu tiến trình bóc tách OCR.
* `IMAGE_OCR_COMPLETED`: OCR hoàn tất bóc tách thô.
* `OCR_FIELD_CORRECTED`: Admin chỉnh sửa một trường thông tin bị sai.
* `OCR_DRAFT_CONFIRMED`: Admin bấm nút xác nhận tạo yêu cầu thành công.
* `OCR_DRAFT_REJECTED`: Admin từ chối/hủy bản nháp do chất lượng ảnh kém.
* `REQUEST_CREATED_FROM_IMAGE`: Request chính thức được tạo thành công từ ảnh nguồn.

# Sample Output JSON
```json
{
  "ocr_draft_id": "ODR-20260604-001",
  "image_file_id": "IMG-20260604-001",
  "uploaded_by": "AD-001",
  "uploaded_at": "2026-06-04T00:36:00Z",
  "review_status": "NEEDS_REVIEW",
  "extracted_fields": {
    "dealer_name": "Lexus Trung Tâm Sài Gòn",
    "dealer_legal_name": "Công Ty TNHH Ôtô Toyotsu Samco",
    "request_no": "REQ-LEX-20260604",
    "request_date": "2026-06-04",
    "requested_delivery_at": "2026-06-04T17:00:00+07:00",
    "contract_no": "HD-LEX-9982",
    "end_customer_name": "Nguyễn Văn A",
    "end_customer_address": "123 Nguyễn Huệ, Quận 1, TP.HCM",
    "vehicle_model": "Lexus RX350",
    "vin_number": "JTJBK11A9G200155",
    "job_items": [
      {
        "item_code": "JB20",
        "item_description": "Dán phim cách nhiệt sườn trước và kính hậu"
      }
    ],
    "note": "Khách hàng yêu cầu thi công kỹ lưỡng, tránh bọt khí."
  },
  "field_confidence": {
    "dealer_name": 0.98,
    "request_no": 0.95,
    "requested_delivery_at": 0.92,
    "end_customer_name": 0.88,
    "vehicle_model": 0.99,
    "vin_number": 0.74,
    "job_items": 0.90
  },
  "missing_fields": [],
  "suggested_next_action": "ADMIN_REVIEW_REQUIRED_LOW_CONFIDENCE_VIN"
}
```

# Failure Cases
1. **Ảnh chụp bị mờ (Blurry Image)**: KTV hoặc đại lý chụp ảnh phiếu yêu cầu bị rung tay, không thể đọc rõ bất kỳ chữ số nào. Hệ thống từ chối xử lý, trả về lỗi `IMAGE_QUALITY_FAILED`.
2. **Ảnh thiếu phần thông tin xe**: Phiếu yêu cầu bị chụp mất phần cuối chứa model xe và số khung (VIN). OCR hoàn tất nhưng `vehicle_model` và `vin_number` bị rỗng, hệ thống chuyển sang `NEEDS_REVIEW` và chặn nút Xác nhận.
3. **Không đọc được số khung (VIN)**: Số khung viết tay bị nhòe mực hoặc dính ký tự đặc biệt, confidence score của `vin_number` chỉ đạt 45%. Hệ thống chuyển sang `NEEDS_REVIEW` và highlight trường VIN màu đỏ trên PWA.
4. **Không xác định được dealer**: Phiếu không có logo đại lý và không chứa dòng chữ pháp lý nào rõ ràng, `dealer_hint` cũng không được Admin cung cấp. Hệ thống chặn không cho tạo Request, bắt buộc Admin phải chọn đại lý thủ công từ dropdown list.
5. **OCR đọc sai định dạng thời gian giao xe**: Thời gian giao xe ghi "5h chiều ngày 4/6", OCR đọc thành "56/04". Trường `requested_delivery_at` có confidence 20% và sai định dạng. Hệ thống hiển thị cảnh báo định dạng ngày giờ và bắt buộc Admin phải chỉnh sửa thủ công.
6. **File không đúng định dạng**: Admin upload nhầm file ảnh định dạng `.heic` hoặc file tài liệu Word `.docx`. Hệ thống lập tức từ chối ở bước kiểm tra định dạng và báo lỗi `IMAGE_INVALID_FORMAT`.

# Test Cases
* **TC-OCR-01 (Upload ảnh chuẩn)**: Upload ảnh scan chất lượng cao của Lexus. OCR đọc chính xác 100% các trường, confidence trung bình >95%. Trạng thái `OCR_DRAFT_READY`, Admin bấm Xác nhận thành công.
* **TC-OCR-02 (Upload ảnh mờ)**: Upload ảnh chụp rung tay. Hệ thống phát hiện độ nhiễu/mờ cao, trả lỗi `IMAGE_QUALITY_FAILED` ngay sau khi upload, yêu cầu re-upload.
* **TC-OCR-03 (Thiếu trường bắt buộc)**: Upload ảnh thiếu dòng chữ mô tả hạng mục thi công. OCR bóc tách thành công các trường khác nhưng `job_items` rỗng. Trạng thái `NEEDS_REVIEW`, nút [Xác nhận] bị vô hiệu hóa, hiển thị thông báo lỗi yêu cầu nhập hạng mục.
* **TC-OCR-04 (Confidence VIN thấp)**: OCR đọc được số khung nhưng độ tin cậy chỉ đạt 72%. Hệ thống gán trạng thái `NEEDS_REVIEW`, tô đỏ trường VIN trên màn hình PWA để Admin tập trung kiểm tra.
* **TC-OCR-05 (Admin sửa và xác nhận)**: Admin phát hiện OCR đọc sai số phiếu từ `REQ-01` thành `REQ-O1`, Admin sửa lại ký tự 'O' thành '0' và bấm Xác nhận. Hệ thống ghi audit event `OCR_FIELD_CORRECTED` và tạo thành công Request.
* **TC-OCR-06 (Hủy bỏ OCR Draft)**: Admin phát hiện ảnh upload là phiếu cũ của tuần trước bị trùng lặp, Admin bấm [Hủy bỏ] (Cancel). Hệ thống xóa bản nháp, giải phóng bộ nhớ và ghi audit event `OCR_DRAFT_CANCELLED`.
