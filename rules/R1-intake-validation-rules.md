# Rule Set Name
R1 - Quy tắc kiểm toán phiếu yêu cầu đầu vào (Intake Validation Rules)

# Business Purpose
Bảo đảm mọi phiếu yêu cầu thi công dán phim nhận về từ đại lý hoặc khách lẻ đều có đầy đủ thông tin cốt lõi, ngăn chặn dữ liệu rác hoặc thiếu trường thông tin quan trọng đi sâu vào các bước xử lý nghiệp vụ của xưởng dán.

# Applied By Agent
* [01-order-intake-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/01-order-intake-agent.md)

# Trigger Conditions
Kích hoạt lập tức khi hệ thống nhận được một văn bản yêu cầu thi công hoặc email đặt hàng mới từ đại lý gửi đến DYC.

# Rules
* **Rule 1.1 - Trường bắt buộc**: Một yêu cầu dán xe hợp lệ từ đại lý bắt buộc phải chứa các trường thông tin: Số khung (VIN - bắt buộc đủ 17 ký tự chữ và số), Model xe (Dòng xe), Hạng mục thi công dán phim, và Mã đại lý gửi yêu cầu.
* **Rule 1.2 - Từ chối phiếu thiếu Dealer**: Đối với tất cả các phiếu yêu cầu được gửi qua cổng kết nối đại lý hoặc ghi danh nghĩa đại lý, nếu thiếu thông tin hoặc không xác định được Đại lý gửi phiếu, hệ thống dừng xử lý ngay lập tức và đánh dấu trạng thái `INVALID`.
* **Rule 1.3 - Quy tắc định dạng**: Ngày yêu cầu và ngày giao xe phải có định dạng ngày tháng hợp lệ. Ngày giao xe không được trước ngày yêu cầu.

# Validation Logic
* `IF length(vin_number) != 17 THEN status = INVALID, error = "VIN must be exactly 17 characters"`
* `IF dealer_raw_name IS NULL OR dealer_raw_name == "" THEN status = INVALID, error = "Missing Dealer Information"`
* `IF vehicle_model IS NULL OR vehicle_model == "" THEN status = INVALID, error = "Missing Vehicle Model"`
* `IF service_name IS NULL AND service_code IS NULL THEN status = INVALID, error = "Missing Service/Job Description"`

# Exception Handling
* Nếu phiếu thiếu thông tin khách lẻ (End Customer) nhưng có đầy đủ đại lý và xe, hệ thống vẫn chấp nhận xử lý tiếp (coi khách lẻ là ẩn danh thuộc đại lý) và gắn cảnh báo `Missing Customer Name`.
* Nếu ngày giao xe bị trống, hệ thống mặc định gán ngày giao xe = ngày yêu cầu + 2 ngày và ghi nhận cảnh báo.

# Human Checkpoint
* Admin kho/Điều phối trực tiếp mở giao diện phiếu bị lỗi `INVALID`, liên hệ đại lý đối tác để lấy bổ sung số khung hoặc làm rõ hạng mục dán, nhập chỉnh sửa thủ công để kích hoạt lại luồng xử lý.

# Audit Requirements
* Hệ thống tự động ghi nhật ký (Audit Log) thời điểm nhận phiếu, kết quả validation (VALID/INVALID), danh sách các trường lỗi cụ thể, và lịch sử sửa đổi phiếu của Admin kho.

# Examples
* **Đầu vào hợp lệ**: Phiếu từ đại lý Lexus Sài Gòn, Số khung `LJT1234567890VIN1`, Model `Lexus RX350`, Hạng mục dán PPF full xe -> Hệ thống đánh giá `VALID`.
* **Đầu vào lỗi (Bị loại bỏ)**: Phiếu yêu cầu dán xe Lexus RX350 nhưng bỏ trống trường đại lý gửi phiếu và không có số khung xe -> Hệ thống đánh dấu `INVALID` lỗi `"Missing Dealer"` và `"Missing VIN"`, dừng xử lý.
