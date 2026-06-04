# Module Name
M10 - Lệnh thi công dán phim (Job Card / Technician Tasks)

# Business Purpose
Đóng gói phương án dán phim đã phê duyệt thành Lệnh thi công chi tiết (Job Card) gửi xuống Kỹ thuật viên phụ trách, đồng thời thu thập phản hồi kích thước thực tế sau khi cắt dán tại xưởng.

# Users
* Quản lý Kho Kỹ thuật
* Kỹ thuật viên

# Key Features
* Khởi tạo Lệnh thi công (`Job Card`): Chứa thông tin xe, số khung, mã phim cách nhiệt/PPF yêu cầu, mã cuộn phim/mảnh dư được chỉ định cắt, kích thước dán lý thuyết, vị trí lưu trữ vật lý của vật tư.
* Giao việc cho Kỹ thuật viên cụ thể.
* Ghi nhận xác nhận kích thước cắt phim thực tế (`actual_length_m`, `actual_width_m`) từ Kỹ thuật viên sau khi hoàn thành.
* Khai báo sự cố thi công (ví dụ: phim bị rách, cần cấp bù tấm phim khác).

# Input Data
* Bản ghi phê duyệt từ module M9.
* Xác nhận kích thước thực tế của KTV.
* Quy tắc giao việc và an toàn kỹ thuật.

# Output Data
* Job Card ở trạng thái `COMPLETED` chứa dữ liệu cắt thực tế của KTV.
* Cảnh báo hỏng vật tư gửi Quản lý nếu có phát sinh sự cố thi công.

# Business Rules Applied
* Kỹ thuật viên phải đối chiếu và kiểm tra mã cuộn phim/mảnh dư vật lý khớp chính xác với mã chỉ định trên Job Card trước khi tiến hành cắt.

# Related Agents
* [07-approval-handoff-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/07-approval-handoff-agent.md)
* [08-inventory-yield-analytics-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/08-inventory-yield-analytics-agent.md)

# Related Workflows
* [WF5-phe-duyet-giao-ky-thuat-vien.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF5-phe-duyet-giao-ky-thuat-vien.md)
* [WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md)

# Acceptance Criteria
* Sinh thành công Job Card dạng Markdown và gửi thông báo đúng tài khoản Kỹ thuật viên được giao.
* Ghi nhận và khóa thông tin kích thước cắt thực tế sau khi Kỹ thuật viên ấn nút Xác nhận Hoàn thành (không cho phép KTV tự ý sửa đổi sau khi đã gửi).
