# Module Name
Upload ảnh phiếu yêu cầu

# Business Purpose
Cho phép Admin kho/Điều phối upload hình ảnh hoặc file PDF phiếu yêu cầu từ đại lý (ví dụ: Lexus Toyotsu Samco), hệ thống tự động bóc tách chữ số bằng OCR và hiển thị bảng dữ liệu nháp để con người đối soát, sửa đổi trước khi chính thức đưa vào quy trình xử lý đơn hàng.

# Users
* **Admin kho / Điều phối**: Người tải ảnh lên, kiểm tra kết quả OCR, chỉnh sửa sai sót và phê duyệt tạo Request.
* **Quản lý Kho Kỹ thuật**: Giám sát nhật ký tải ảnh và đối chiếu ảnh gốc khi có tranh chấp số liệu.
* **Kế toán kho / Quản lý vận hành**: Xem báo cáo nguồn gốc đơn hàng (tỷ lệ đơn từ ảnh chụp, tỷ lệ gõ tay thủ công).

# Key Features
* **Tải lên hình ảnh/PDF (File Upload)**: Hỗ trợ kéo thả hoặc chọn file ảnh (JPG, JPEG, PNG) hoặc PDF có dung lượng lên đến 10MB.
* **Xem trước hình ảnh (Preview)**: Hiển thị hình ảnh gốc ngay cạnh biểu mẫu dữ liệu để Admin dễ dàng đối chiếu trực quan.
* **Kích hoạt OCR (OCR Execution)**: Tự động hoặc thủ công gửi ảnh sang công cụ trích xuất để phân tích văn bản.
* **So khớp & Điền dữ liệu (Form Mapping)**: Tự động ánh xạ dữ liệu OCR bóc tách được vào biểu mẫu nhập liệu có cấu trúc.
* **Cảnh báo độ tin cậy thấp (Confidence Highlighting)**: Tô màu đỏ hoặc vàng các trường có điểm tin cậy dưới 80% để thu hút sự chú ý của Admin.
* **Biểu mẫu chỉnh sửa dữ liệu (Correction Form)**: Cho phép Admin click trực tiếp vào bất kỳ ô nhập liệu nào để sửa đổi các ký tự đọc sai.
* **Xác nhận tạo yêu cầu (Draft Confirmation)**: Cơ chế ấn nút xác nhận để đóng gói dữ liệu đã chỉnh sửa sạch và gửi lệnh tạo Request chính thức.
* **Lưu trữ ảnh gốc (Original Image Storage)**: Đính kèm liên kết ảnh gốc vào Request ID để phục vụ kiểm toán và đối chiếu sau này.
* **Nhật ký kiểm toán (Audit Trail)**: Tự động ghi lại lịch sử chỉnh sửa các trường dữ liệu của Admin kho.

# Input Data
* `image_file`: File dữ liệu nhị phân (Binary) hoặc luồng upload từ thiết bị.
* `uploaded_by`: ID người thực hiện (ví dụ: `AD-001`).
* `source_channel`: Kênh tải lên (`PWA` hoặc `MOBILE`).
* `dealer_hint`: Gợi ý mã đại lý (nếu Admin chọn trước từ dropdown).
* `image_type`: Loại file (JPG, JPEG, PNG, PDF).

# Output Data
* `ocr_draft_id`: ID duy nhất của bản ghi nháp OCR.
* `extracted_request_data`: Object chứa toàn bộ thông tin phiếu yêu cầu bóc tách được (đã được làm sạch và chuẩn hóa định dạng).
* `review_status`: Trạng thái kiểm tra (`DRAFT`, `NEEDS_REVIEW`, `CONFIRMED`, `REJECTED`, `CANCELLED`).
* `request_id`: Mã phiếu yêu cầu chính thức được sinh ra sau khi Admin kho xác nhận thành công.

# Business Rules Applied
* **Phân quyền thao tác**: Chỉ người dùng có vai trò Admin kho (`Admin kho`) hoặc Điều phối viên mới được phép upload ảnh phiếu đại lý.
* **Kiểm tra định dạng nghiêm ngặt**: Chỉ chấp nhận file JPG, JPEG, PNG, PDF. Mọi định dạng khác (như DOCX, HEIC, ZIP) đều bị chặn từ phía client và API.
* **Không tự động tạo Request**: Nghiêm cấm hệ thống tự động sinh Request chính thức (`request_id` dạng `REQ-...`) khi chưa có thao tác bấm Xác nhận thủ công từ Admin kho.
* **Ràng buộc dữ liệu bắt buộc**: Không cho phép xác nhận tạo Request nếu thiếu một trong ba thông tin: `dealer_name`, `vehicle_model`, hoặc danh sách `job_items`.
* **Ràng buộc số khung (VIN)**: Nếu thiếu số khung (VIN), trạng thái mặc định phải là `NEEDS_REVIEW`. Admin có quyền gõ nhập thủ công VIN hoặc bỏ qua nếu phiếu không có, nhưng hệ thống phải ghi nhận cảnh báo.
* **Ghi audit log đầy đủ**: Mọi thay đổi về dữ liệu do Admin sửa đổi so với kết quả bóc tách gốc của OCR bắt buộc phải ghi lại nhật ký thay đổi (`old_value` và `new_value`) để kiểm soát chất lượng OCR.

# Related Agents
* **Image Intake & OCR Extraction Agent (`AG-10`)**: Nhận ảnh, thực hiện phân tích và bóc tách dữ liệu thô.
* **Order Intake Agent (`AG-01`)**: Tiếp nhận dữ liệu sạch sau khi được xác nhận để khởi chạy luồng **WF1**.
* **Master Data Agent (`AG-02`)**: Thực hiện liên kết đại lý, khách hàng và xe sau khi Request được tạo ở **WF2**.

# Related Workflows
* **WF0-upload-anh-phieu-yeu-cau-ocr.md**
* **WF1-tiep-nhan-phieu-dai-ly-lexus.md**
* **WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe.md**

# Acceptance Criteria (Tiêu chí nghiệm thu)
1. **AC-M13-01**: Hệ thống cho phép chọn và tải lên thành công file định dạng JPG, JPEG, PNG, PDF dung lượng dưới 10MB từ cả thiết bị di động (mobile) và máy tính để bàn (PWA).
2. **AC-M13-02**: Hệ thống từ chối và hiển thị thông báo lỗi rõ ràng khi người dùng cố gắng tải lên file sai định dạng hoặc vượt quá 10MB.
3. **AC-M13-03**: Giao diện hiển thị song song ảnh gốc (có tính năng zoom, xoay) và form kết quả trích xuất trên cùng một màn hình để thuận tiện cho việc so sánh.
4. **AC-M13-04**: Tất cả các ô dữ liệu có điểm tin cậy (confidence score) dưới 80% phải được hiển thị với màu sắc cảnh báo đặc thù (viền đỏ/nền vàng) và hiển thị điểm tin cậy bên cạnh.
5. **AC-M13-05**: Cho phép Admin kho sửa đổi nội dung của bất kỳ trường thông tin nào trên form. Khi sửa, điểm tin cậy của trường đó tự động cập nhật thành 1.0 (100% - do con người xác nhận).
6. **AC-M13-06**: Nút **[Xác nhận tạo Request]** bị vô hiệu hóa (disabled) nếu thiếu thông tin đại lý, dòng xe hoặc hạng mục thi công.
7. **AC-M13-07**: Khi Admin bấm Xác nhận, hệ thống sinh ra một Request ID chính thức khớp cấu trúc `REQ-YYYYMMDD-XXX` và lưu trữ liên kết ảnh gốc vào bản ghi Request.
8. **AC-M13-08**: Mọi thao tác chỉnh sửa dữ liệu của Admin so với kết quả OCR gốc đều được ghi nhận chính xác vào bảng nhật ký kiểm toán với đầy đủ thông tin: tên trường, giá trị cũ, giá trị mới, và người sửa.
