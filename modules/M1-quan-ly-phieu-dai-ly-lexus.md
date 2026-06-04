# Module Name
M1 - Quản lý Phiếu yêu cầu từ Đại lý Lexus và Đối tác

# Business Purpose
Tiếp nhận các yêu cầu dán phim cách nhiệt và PPF từ các đại lý ô tô (đặc biệt là Lexus Trung Tâm Sài Gòn) hoặc khách lẻ trực tiếp dưới dạng văn bản thô, ảnh quét hoặc email, sau đó bóc tách, chuẩn hóa dữ liệu thành cấu trúc thông tin sạch phục vụ các bước xử lý tự động tiếp theo.

# Users
* Admin kho / Điều phối Tiếp nhận
* Đại lý đối tác (thông qua API gửi phiếu tự động - nếu có)

# Key Features
* Upload file phiếu yêu cầu (dạng PDF, ảnh chụp, text thô).
* Trích xuất tự động dữ liệu (OCR kết hợp Parser) các thông tin cốt lõi của đơn dán xe.
* Kiểm tra lỗi dữ liệu (Data Validation): phát hiện thiếu số khung (VIN), thiếu hạng mục hoặc model xe.
* Gán mã định danh yêu cầu duy nhất `request_id` cho từng phiếu thành công.

# Input Data
* Phiếu yêu cầu thô (dạng text, PDF hoặc ảnh quét).
* Cấu hình quy tắc kiểm tra phiếu `rules/R1-intake-validation-rules.md`.

# Output Data
* JSON phiếu yêu cầu chuẩn hóa tuân thủ [request-schema.json](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/schemas/request-schema.json).
* Trạng thái phiếu (`VALID` hoặc `INVALID` kèm lý do lỗi).

# Business Rules Applied
* Bắt buộc có thông tin: Số khung (VIN), Model xe, Hạng mục thi công dán phim (Theo `R1`).
* Tự động gán loại khách hàng là `DIRECT_RETAIL` nếu phiếu không chỉ định đại lý gửi.

# Related Agents
* [01-order-intake-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/01-order-intake-agent.md)

# Related Workflows
* [WF1-tiep-nhan-phieu-dai-ly-lexus.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF1-tiep-nhan-phieu-dai-ly-lexus.md)

# Acceptance Criteria
* Trích xuất đúng 100% các trường thông tin từ phiếu yêu cầu mẫu của Lexus Sài Gòn.
* Phát hiện chính xác và gắn cờ `INVALID` cho các phiếu thử nghiệm bị khuyết số khung (VIN) hoặc model xe.
* Tự động sinh mã `request_id` theo đúng cấu trúc định dạng `REQ-[YYYYMMDD]-[Số tăng dần]`.
