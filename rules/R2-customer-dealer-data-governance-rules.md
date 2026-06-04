# Rule Set Name
R2 - Quy tắc quản trị dữ liệu khách hàng và xe (Customer & Dealer Data Governance Rules)

# Business Purpose
Đảm bảo tính toàn vẹn và sạch của cơ sở dữ liệu Master Data. Phân biệt rõ các thực thể pháp nhân (Đại lý) và cá nhân (Chủ xe lẻ), ngăn chặn việc gộp trùng sai lệch hồ sơ khách hàng và phát hiện các trường hợp tranh chấp số khung xe dán phim.

# Applied By Agent
* [02-customer-dealer-master-data-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/02-customer-dealer-master-data-agent.md)

# Trigger Conditions
Kích hoạt khi Order Intake Agent bàn giao JSON phiếu yêu cầu hợp lệ để liên kết thông tin Master Data.

# Rules
* **Rule 2.1 - Phân cấp và Phân biệt thực thể**: 
  * **Dealer Account**: Là khách hàng doanh nghiệp đối tác (Đại lý), có mã định danh `DEALER_` và được lưu giữ trong `dealer_account_master.csv`.
  * **End Customer**: Là khách lẻ hoặc chủ xe trực tiếp dán phim, có mã định danh `CUST_` và được lưu giữ trong `end_customer_master.csv`.
  * Một Dealer Account có mối quan hệ một-nhiều với End Customer (một đại lý gửi dán xe cho nhiều khách hàng khác nhau).
* **Rule 2.2 - Nghiêm cấm tự động gộp (Dedup)**: Nếu khách hàng lẻ trùng tên thô (ví dụ: "Nguyễn Văn A"), Agent không được phép tự ý gộp chung họ vào một `customer_id` có sẵn, trừ khi khớp đồng thời số điện thoại hoặc địa chỉ liên hệ. Nếu chỉ trùng tên, Agent bắt buộc phải tạo một hồ sơ khách hàng tạm thời (`is_temp = true`) mới.
* **Rule 2.3 - Tính duy nhất của Số khung (VIN)**: Số khung xe (VIN) là khóa chính duy nhất của thực thể xe. Nếu số khung xe nhập vào trùng khớp với số khung đã có trong `vehicle_profile_master.csv`:
  * Nếu trùng khớp cả chủ sở hữu (`customer_id`) -> Tiến hành cập nhật lịch sử dán phim cho xe này.
  * Nếu khác chủ sở hữu hoặc khác đại lý gửi xe -> Agent dừng xử lý và phát cảnh báo lỗi `"Vehicle Owner Conflict Detected"` để con người đối soát.

# Validation Logic
* `IF count(vin_number) > 0 AND customer_id_existing != customer_id_new THEN status = WARNING, code = "VIN_OWNER_CONFLICT"`
* `IF name_existing == name_new AND phone_existing != phone_new THEN action = CREATE_NEW_TEMP_CUSTOMER`

# Exception Handling
* Trong trường hợp đại lý ô tô mua xe cũ dán lại cho khách mới (VIN trùng nhưng chủ xe thay đổi thực tế), hệ thống cho phép ghi nhận lịch sử sở hữu mới sau khi có xác nhận ghi đè từ Admin kho.

# Human Checkpoint
* Admin kho hoặc Nhân viên CSKH đối soát thực tế và duyệt ghi đè hồ sơ xe khi hệ thống báo `"Vehicle Owner Conflict Detected"`.
* Kế toán kho duyệt phê duyệt tạo mới đại lý (Dealer Account) trên hệ thống sổ sách.

# Audit Requirements
* Ghi log chi tiết mọi giao dịch tạo mới khách hàng lẻ, tạo hồ sơ xe mới, hoặc các trường hợp merge/ghi đè sở hữu xe kèm theo mã `request_id` làm đối chứng.

# Examples
* **Tạo khách hàng mới (Không gộp bừa bãi)**: Hệ thống nhận phiếu dán xe cho "Trần Văn Nam". Trong kho đã có "Trần Văn Nam" ở Quận 1, phiếu mới ghi địa chỉ ở Quận 7. Agent tạo `CUST_011` mới có cờ `is_temp: true` thay vì gộp chung vào khách Quận 1.
* **Cảnh báo trùng số khung**: Xe Lexus RX350 số khung `LJT1234567890VIN1` dán năm 2025 dưới tên chủ xe "Nguyễn Văn An" nay quay lại dán cho khách hàng "Lê Minh". Agent báo động xung đột sở hữu.
