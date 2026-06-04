# Module Name
M6 - Quản lý File Định mức chuẩn (Norm Configuration)

# Business Purpose
Kết nối, đọc và truy vấn trực tiếp ma trận định mức vật tư tiêu hao chuẩn từ các file Excel (`Phim cách nhiệt - Định mức chuẩn.xlsx`, `Phim PPF - Định mức chuẩn.xlsx`) và tệp cấu hình để tính toán lượng phim lý thuyết cần cắt cho từng đơn hàng cụ thể.

# Users
* Quản lý Kho Kỹ thuật
* Quản lý Vận hành & Kế toán Kho

# Key Features
* Đọc và phân tích trực tiếp dữ liệu từ file định mức Excel.
* Tra cứu định mức lý thuyết (chiều rộng, chiều dài) theo tổ hợp Phân nhóm xe x Hạng mục thi công dán phim.
* Tự động áp dụng hệ số an toàn (Safety Margin) theo quy tắc nghiệp vụ cấu hình.

# Input Data
* Phân nhóm xe (`vehicle_category`), mã phim (`material_code`), hạng mục thi công (`job_item_id`).
* File định mức chuẩn Excel hoặc CSV tương đương trong `knowledge/norm_matrix.csv`.
* Quy tắc tính toán định mức `rules/R4-norm-calculation-rules.md`.

# Output Data
* Kích thước yêu cầu dán lý thuyết: `required_length_m`, `required_width_m`, `required_area_m2`.
* Hệ số an toàn đã áp dụng.

# Business Rules Applied
* Áp dụng hệ số an toàn: PPF cộng thêm 5% chiều dài dán; Phim cách nhiệt cộng thêm 10% chiều dài dán.
* Chiều rộng yêu cầu tối đa không được vượt quá khổ rộng tiêu chuẩn của vật tư phim (1.52m).

# Related Agents
* [04-norm-calculation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/04-norm-calculation-agent.md)

# Related Workflows
* [WF3-mapping-xe-hang-muc-phim-dinh-muc.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF3-mapping-xe-hang-muc-phim-dinh-muc.md)

# Acceptance Criteria
* Đọc đúng giá trị định mức từ file Excel/CSV chuẩn theo đúng cấu trúc cột.
* Áp dụng đúng công thức nhân hệ số an toàn theo quy định tại `R4` mà không làm tròn sai số quá mức quy định.
* Xuất cảnh báo `Norm Matrix Lookup Failed` nếu không tìm thấy dòng định mức phù hợp.
