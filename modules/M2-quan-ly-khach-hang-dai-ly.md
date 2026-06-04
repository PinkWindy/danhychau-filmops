# Module Name
M2 - Quản lý Khách hàng và Đại lý (Master Data Customers)

# Business Purpose
Đảm bảo quản lý tập trung và phân cấp dữ liệu khách hàng của DYC. Thực hiện đối sánh tên thô, khử trùng lặp và liên kết chính xác giữa Đại lý ô tô (Dealer) và Khách hàng lẻ/Chủ xe (End Customer) để hỗ trợ quá trình bảo hành và báo cáo tài chính.

# Users
* Admin kho / Điều phối Tiếp nhận
* Quản lý Vận hành & Kế toán Kho

# Key Features
* Quản lý danh mục Đại lý (`Dealer Account`): Khách hàng doanh nghiệp, có mã định danh duy nhất (ví dụ: `DEALER-LEXUS-SG`), chính sách đại lý và thông tin người liên hệ.
* Quản lý danh mục Khách lẻ (`End Customer`): Khách mua xe qua đại lý hoặc khách tự đến DYC. Một đại lý có thể phát sinh nhiều khách lẻ mua xe.
* Thuật toán khử trùng lặp khách hàng (Dedup): Sử dụng đối sánh đa trường (Tên + Điện thoại hoặc Tên + Địa chỉ) để tránh nhân bản hồ sơ khách hàng.
* Khởi tạo tài khoản khách hàng tạm thời (`is_temp: true`) và lưu trữ thông tin nguồn gốc yêu cầu (`created_from_request_id`, `source_dealer_id`).

# Input Data
* JSON phiếu yêu cầu từ module M1.
* Cơ sở dữ liệu khách hàng `knowledge/dealer_account_master.csv`, `knowledge/end_customer_master.csv`, `knowledge/customer_dedup_candidates.csv`.
* Quy tắc quản trị dữ liệu khách hàng `rules/R2-customer-dealer-data-governance-rules.md`.

# Output Data
* Bản ghi liên kết Master Data chứa ID đại lý chuẩn (`dealer_id`) và ID khách hàng chuẩn (`customer_id`).
* Danh mục khách lẻ mới được cập nhật tự động trong cơ sở dữ liệu ảo.

# Business Rules Applied
* Phân biệt rõ **Dealer Account** và **End Customer**. Một Dealer Account có mối quan hệ một-nhiều với End Customer.
* Không tự động gộp khách hàng lẻ trùng tên thô nếu không khớp số điện thoại hoặc địa chỉ.
* Khách lẻ mới từ phiếu đại lý được gán cờ `is_temp: true` để chờ bộ phận CSKH xác nhận cập nhật thông tin chính thức sau này.

# Related Agents
* [02-customer-dealer-master-data-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/02-customer-dealer-master-data-agent.md)

# Related Workflows
* [WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe.md)

# Acceptance Criteria
* Ánh xạ thành công tên đại lý thô thành `dealer_id` hợp lệ có trong danh mục.
* Tạo mới hồ sơ khách hàng lẻ tự động với đầy đủ liên kết `created_from_request_id` và `source_dealer_id` khi có khách hàng mới.
* Không xảy ra hiện tượng tự động merge (gộp) đối với 2 khách hàng lẻ trùng tên "Nguyễn Văn A" nếu thông tin liên hệ khác nhau.
