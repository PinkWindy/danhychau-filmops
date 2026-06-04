# Module Name
M4 - Danh mục xe ô tô tiêu chuẩn (Vehicle Master)

# Business Purpose
Quản lý danh sách các dòng xe, đời xe và phân loại phân nhóm kích thước xe tiêu chuẩn (Sedan, SUV, Hatchback, MPV...). Phân nhóm xe này là cơ sở quan trọng để tra ma trận định mức dán phim.

# Users
* Admin kho / Điều phối Tiếp nhận
* Quản lý Kho Kỹ thuật

# Key Features
* Quản lý danh mục các đời xe ô tô chuẩn hóa của các thương hiệu (Lexus, Toyota, Mercedes, BMW...).
* Phân nhóm kích thước xe dựa trên kích thước vật lý của phương tiện.
* Tra cứu nhanh phân nhóm xe dựa trên model xe đầu vào.

# Input Data
* Tên model xe thô từ phiếu yêu cầu.
* Cơ sở dữ liệu danh mục xe chuẩn `knowledge/vehicle_master.csv`.

# Output Data
* Phân nhóm kích thước xe tiêu chuẩn (ví dụ: `SUV_LARGE`, `SEDAN_MID`).

# Business Rules Applied
* Nếu xe dán không nằm trong danh mục chuẩn, hệ thống cho phép tạm gán nhóm kích thước dựa trên từ khóa dòng xe (`R3-vehicle-film-mapping-rules.md`) và yêu cầu cập nhật danh mục chuẩn.

# Related Agents
* [03-vehicle-film-mapping-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/03-vehicle-film-mapping-agent.md)

# Related Workflows
* [WF3-mapping-xe-hang-muc-phim-dinh-muc.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF3-mapping-xe-hang-muc-phim-dinh-muc.md)

# Acceptance Criteria
* Tìm kiếm chính xác phân nhóm xe của dòng xe đã được khai báo trong hệ thống.
* Trả về cảnh báo nếu dòng xe mới chưa được định nghĩa phân nhóm kích cỡ chuẩn trong `vehicle_master.csv`.
