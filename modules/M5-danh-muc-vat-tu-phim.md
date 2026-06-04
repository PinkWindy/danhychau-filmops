# Module Name
M5 - Danh mục vật tư phim cách nhiệt và PPF (Material Master)

# Business Purpose
Quản lý tập trung thông tin kỹ thuật của các dòng phim cách nhiệt, phim PPF và các vật tư chính hãng đang sử dụng tại xưởng DYC, phục vụ đối chiếu và so khớp tồn kho ảo.

# Users
* Quản lý Kho Kỹ thuật
* Quản lý Vận hành & Kế toán Kho

# Key Features
* Quản lý danh mục mã phim chuẩn (`Material ID/Code`), thông số kỹ thuật (hãng sản xuất, dòng phim, độ dày, màu sắc, khổ rộng tiêu chuẩn).
* Phân loại vật tư rõ ràng thành 2 nhóm chính: Phim cách nhiệt (`WINDOW_FILM`) và Phim bảo vệ sơn (`PPF`).
* Định nghĩa đơn vị tính chuẩn (ví dụ: mét dài - m, mét vuông - m2).

# Input Data
* Tên phim/quy cách trên phiếu yêu cầu.
* Cơ sở dữ liệu danh mục vật tư `knowledge/material_master.csv`.

# Output Data
* Mã vật tư phim tiêu chuẩn (`material_code`) và loại vật tư (`material_type`).

# Business Rules Applied
* Ánh xạ chính xác các tên gọi thương mại (ví dụ: "Cool N Lite Premier") sang đúng mã vật tư kỹ thuật lưu kho (ví dụ: `CNL-PRE-1.52`).

# Related Agents
* [03-vehicle-film-mapping-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/03-vehicle-film-mapping-agent.md)

# Related Workflows
* [WF3-mapping-xe-hang-muc-phim-dinh-muc.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF3-mapping-xe-hang-muc-phim-dinh-muc.md)

# Acceptance Criteria
* Phân loại chính xác 100% các dòng phim nhập vào thành đúng nhóm `WINDOW_FILM` hoặc `PPF`.
* Đảm bảo mọi mã vật tư phim cách nhiệt/PPF đều liên kết được với khổ rộng tiêu chuẩn vật lý của nhà sản xuất.
