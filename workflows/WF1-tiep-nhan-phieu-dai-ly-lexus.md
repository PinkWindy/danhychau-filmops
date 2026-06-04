# Workflow Name
WF1 - Quy trình tiếp nhận phiếu yêu cầu thi công dán xe đại lý Lexus (Lexus Dealership Request Intake Workflow)

# Business Purpose
Tiếp nhận các yêu cầu dán xe từ đại lý Lexus hoặc các nguồn khách lẻ. Bóc tách và kiểm tra tính hợp lệ thô của phiếu (VIN, Model xe, mã đại lý, dịch vụ dán). Ngăn chặn ngay lập tức các phiếu rác hoặc thiếu dữ liệu trọng yếu đi sâu vào hệ thống.

# Trigger
Hệ thống nhận được yêu cầu thi công mới thông qua cổng thông tin đại lý hoặc do Admin kho nhập thủ công lên hệ thống.

# Actors
* Admin kho/Điều phối (Con người - Giám sát và sửa đổi khi xảy ra ngoại lệ)

# Agents Involved
* [01-order-intake-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/01-order-intake-agent.md)

# Input
* Email đặt hàng, file yêu cầu thi công PDF/Excel hoặc thông tin nhập tay thô.

# Output
* JSON chứa dữ liệu phiếu yêu cầu thi công dán xe đã được chuẩn hóa cấu trúc thô (theo `request-schema.json`).

# Main Flow
1. **Bước 1 (Agent)**: Order Intake Agent quét thư mục tiếp nhận phiếu hoặc cổng API đại lý để phát hiện yêu cầu thi công mới.
2. **Bước 2 (Agent)**: Agent thực hiện phân tích cú pháp (parsing) để bóc tách thông tin cốt lõi: số khung (VIN), dòng xe thô, hạng mục thi công thô, mã đại lý gửi, thông tin khách lẻ (nếu có).
3. **Bước 3 (Agent)**: Agent đối chiếu phiếu với quy tắc [R1-intake-validation-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R1-intake-validation-rules.md) để kiểm tra tính đầy đủ và hợp lệ.
4. **Bước 4 (Agent)**: Nếu mọi trường bắt buộc hợp lệ, Agent xuất file JSON yêu cầu đã được bóc tách và chuyển giao sang WF2.

# Alternative Flows
* **Alternative Flow 1.1 - Khách lẻ trực tiếp (Không qua đại lý)**: 
  * Nếu phiếu yêu cầu do khách lẻ mang xe trực tiếp đến xưởng, trường đại lý gửi phiếu sẽ trống. Agent ghi nhận `dealer_id = "WALK_IN"`, tự động đánh dấu và cho phép tiếp tục xử lý mà không bị loại bỏ bởi luật Rule 1.2.
* **Alternative Flow 1.2 - Phiếu thiếu thông tin khách lẻ (End Customer)**:
  * Phiếu từ đại lý gửi đến chỉ có VIN và Model xe, thiếu tên/số điện thoại chủ xe. Agent tự động điền `customer_name = "Anonymous Dealer Customer"`, gắn cờ cảnh báo `Missing Customer Info` và tiếp tục luồng xử lý chính.
* **Alternative Flow 1.3 - Phiếu từ đại lý phụ ngoài Lexus**:
  * Yêu cầu dán xe gửi từ đại lý không chính thức (không thuộc danh mục VIP). Agent tự động gán phân nhóm ưu tiên thấp cho phiếu và chuyển sang WF2 kèm ghi chú `Standard Priority`.

# Exception Flows
* **Exception Flow 1.1 - Thiếu mã đại lý gửi yêu cầu (Đại lý B2B)**:
  * Phiếu được gửi qua cổng kết nối đại lý nhưng trống thông tin định danh đại lý. Agent đánh dấu phiếu là `INVALID`, dừng luồng xử lý tự động, phát cảnh báo `"Missing Dealer Information"` và đẩy phiếu về hàng chờ xử lý của Admin kho.
* **Exception Flow 1.2 - Số khung (VIN) không hợp lệ**:
  * Số khung (VIN) bị thiếu hoặc không đủ 17 ký tự chữ và số. Agent chuyển trạng thái phiếu thành `INVALID_VIN`, tạm dừng luồng và thông báo cho Admin kho.
* **Exception Flow 1.3 - Trùng lặp Request ID trong hàng chờ**:
  * Phiếu gửi đến có mã `request_id` trùng khớp với một phiếu đang được xử lý trong hàng chờ. Agent từ chối tiếp nhận phiếu mới, ghi lỗi `"Duplicate Request ID Detected"` và lưu vết log.

# Human Checkpoints
* **Admin kho (HITL)**: Xem xét danh sách các phiếu bị lỗi `INVALID` (thiếu đại lý, VIN lỗi). Thực hiện liên hệ với đại lý để lấy thông tin bổ sung và chỉnh sửa trực tiếp trên giao diện để tái kích hoạt luồng xử lý tự động.

# Rules Applied
* [R1-intake-validation-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R1-intake-validation-rules.md)

# Audit Events
* Giao dịch ghi nhật ký nhận yêu cầu: `REQ_RECEIVED` (Mã phiếu, nguồn gửi, timestamp).
* Giao dịch ghi nhận lỗi validation: `REQ_VALIDATION_FAILED` (Mã phiếu, danh sách lỗi, người giám sát).

# Completion Criteria
* Phiếu được bóc tách hoàn chỉnh thành cấu trúc JSON hợp lệ và chuyển trạng thái thành `VALIDATED`.

# Status Flow
`DRAFT` -> `PROCESSING` -> `VALIDATED` (Hợp lệ, chuyển sang WF2) hoặc `INVALID` (Lỗi, chờ con người xử lý).
