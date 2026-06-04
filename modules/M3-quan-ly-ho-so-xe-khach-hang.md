# Module Name
M3 - Quản lý Hồ sơ xe Khách hàng (Vehicle Profile Master)

# Business Purpose
Định danh và theo dõi lịch sử dịch vụ của từng phương tiện (ô tô) thi công dán phim tại DYC. Hồ sơ xe đóng vai trò là cầu nối liên kết lịch sử dịch vụ và là cơ sở để tra cứu thời hạn bảo hành phim dán theo số khung.

# Users
* Admin kho / Điều phối Tiếp nhận
* Quản lý Kho Kỹ thuật
* Quản lý Vận hành & Kế toán Kho

# Key Features
* Quản lý Hồ sơ xe (`Vehicle Profile`): Lưu trữ chi tiết thông tin xe gồm Số khung (VIN - Khóa chính), Model xe, Ngày giao xe dự kiến, Ngày thi công, danh sách các mã phim đã dán và lịch sử bảo hành.
* Liên kết dữ liệu đa chiều: Mỗi Vehicle Profile phải liên kết được với mã yêu cầu dán phim (`request_id`), mã đại lý dán xe (`dealer_id` - nếu có) và mã chủ xe (`customer_id`).
* Cảnh báo thay đổi chủ sở hữu xe: Phát hiện nếu số khung xe đã có trên hệ thống dưới tên chủ xe khác và thông báo cho người dùng xử lý.

# Input Data
* JSON phiếu yêu cầu từ module M1 và dữ liệu khách hàng từ M2.
* Cơ sở dữ liệu hồ sơ xe `knowledge/vehicle_profile_master.csv`.
* Quy tắc đặt mã và liên kết dữ liệu hồ sơ xe `rules/R2-customer-dealer-data-governance-rules.md`.

# Output Data
* Bản ghi hồ sơ xe mới hoặc cập nhật lịch sử xe trong `knowledge/vehicle_profile_master.csv`.
* JSON hồ sơ xe được tạo thành công theo mẫu [sample-07-customer-vehicle-profile-created.json](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-07-customer-vehicle-profile-created.json).

# Business Rules Applied
* Số khung (VIN) là duy nhất cho mỗi phương tiện. Không cho phép tạo mới xe nếu trùng số khung.
* Một End Customer có thể sở hữu nhiều xe (nhiều VIN khác nhau liên kết chung một `customer_id`).
* Xe từ đại lý gửi phải liên kết đồng thời cả `dealer_id` và `customer_id` (chủ xe dán qua đại lý).

# Related Agents
* [02-customer-dealer-master-data-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/02-customer-dealer-master-data-agent.md)

# Related Workflows
* [WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe.md)

# Acceptance Criteria
* Ghi nhận thành công thông tin xe mới vào `vehicle_profile_master.csv` với số khung VIN làm khóa chính.
* Liên kết chính xác và hiển thị đầy đủ thông tin: `request_id`, `dealer_id`, `customer_id` trên chi tiết hồ sơ xe.
* Báo động `"Vehicle Owner Change Detected"` nếu VIN đã có trong cơ sở dữ liệu dán cho khách hàng cũ nhưng phiếu yêu cầu mới ghi tên chủ xe khác.
