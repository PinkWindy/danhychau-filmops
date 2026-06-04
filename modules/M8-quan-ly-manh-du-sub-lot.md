# Module Name
M8 - Quản lý mảnh dư phim (Sub-LOT / Offcut Management)

# Business Purpose
Theo dõi và quản lý vòng đời của các mảnh phim dư thừa (Sub-LOT) có kích thước lớn phát sinh sau quá trình cắt phim dán xe. Việc theo dõi chặt chẽ mảnh dư giúp tối đa hóa khả năng tái sử dụng, giảm chi phí tiêu hao vật tư phim cao cấp.

# Users
* Quản lý Kho Kỹ thuật
* Kỹ thuật viên
* Quản lý Vận hành & Kế toán Kho

# Key Features
* Nhập kho mảnh dư mới: Tự động đánh mã mảnh dư theo cấu trúc liên kết LOT gốc, lưu chiều dài, chiều rộng, vị trí kệ vật lý và trạng thái chất lượng.
* Đánh mã mảnh dư chuẩn: Định dạng mã `SUBLOT-ID` = `[Mã LOT gốc]-SUB[STT tăng dần]` (ví dụ: `LOT001-SUB01`) để liên kết và truy xuất nguồn gốc.
* Quản lý vị trí lưu trữ: Xác định vị trí lưu trữ vật lý của mảnh dư tại kệ riêng (ví dụ: kệ OFFCUT-ZONE-A) để KTV dễ dàng tìm kiếm.
* Đánh giá chất lượng mảnh dư: Phân loại chất lượng (đạt chuẩn tái sử dụng, nhăn nhẹ, xước nhẹ, phế liệu/scrap) để chọn xe dán phù hợp.
* Xuất kho mảnh dư: Khi dán xe thành công bằng mảnh dư, cập nhật trạng thái của mảnh dư thành `USED` trong kho ảo.

# Input Data
* Kích thước thực tế cắt phim dư từ phản hồi KTV.
* Mã LOT gốc sinh ra mảnh dư đó.
* Cơ sở dữ liệu kho mảnh dư `knowledge/offcut_inventory.csv`.
* Quy tắc phân loại mảnh dư và scrap `rules/R8-inventory-deduction-rules.md`.

# Output Data
* Bản ghi Sub-LOT mới được tạo trong `offcut_inventory.csv` hoặc cập nhật trạng thái bản ghi cũ thành `USED`/`LOCKED`.
* JSON mô tả mảnh dư mới dán thẻ theo [offcut-created-record.json](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-04-offcut-created-record.json).

# Business Rules Applied
* Điều kiện nhập kho mảnh dư mới: Chiều dài và chiều rộng phải lớn hơn hoặc bằng kích thước tối thiểu (PPF: dài >= 0.5m, rộng >= 0.3m; Phim cách nhiệt: dài >= 0.3m, rộng >= 0.2m). Nếu không đạt, tự động ghi nhận là Scrap.
* Liên kết LOT gốc bắt buộc: Mảnh dư phải mang mã gốc của cuộn phim sinh ra nó để theo dõi lịch sử hao hụt của cuộn phim đó.

# Related Agents
* [05-offcut-optimization-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/05-offcut-optimization-agent.md)
* [08-inventory-yield-analytics-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/08-inventory-yield-analytics-agent.md)

# Related Workflows
* [WF4-toi-uu-manh-du-phan-bo-lot.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF4-toi-uu-manh-du-phan-bo-lot.md)
* [WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md)

# Acceptance Criteria
* Sinh mã `SUBLOT-ID` đúng cấu trúc liên kết LOT gốc khi KTV báo cáo phát sinh mảnh dư đạt chuẩn.
* Cập nhật chính xác vị trí lưu trữ vật lý của mảnh dư trong file CSV.
* Loại bỏ chính xác các mảnh dư đã dán thành công ra khỏi trạng thái khả dụng (`status = 'USED'`).
