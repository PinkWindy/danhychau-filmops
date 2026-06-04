# Rule Set Name
R3 - Quy tắc ánh xạ Dòng xe và Mã vật tư (Vehicle & Film Mapping Rules)

# Business Purpose
Đảm bảo mọi dòng xe thi công và dịch vụ yêu cầu đều được chuẩn hóa chính xác thành phân nhóm kích thước xe và mã phim cách nhiệt/PPF thực tế trong kho, tránh việc sử dụng sai mã hàng hoặc tính sai kích thước do không khớp dòng xe.

# Applied By Agent
* [03-vehicle-film-mapping-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/03-vehicle-film-mapping-agent.md)

# Trigger Conditions
Kích hoạt sau khi thông tin Master Data của đại lý và xe được liên kết thành công.

# Rules
* **Rule 3.1 - Kiểm soát sự tồn tại của Xe**: Xe thi công bắt buộc phải tồn tại trong danh mục đời xe chuẩn [vehicle_master.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/vehicle_master.csv) để lấy đúng phân nhóm xe (`vehicle_category`).
* **Rule 3.2 - Kiểm soát sự tồn tại của Hạng mục**: Hạng mục thi công yêu cầu trên phiếu bắt buộc phải ánh xạ được sang một `job_item_id` hợp lệ có trong danh mục [job_item_master.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/job_item_master.csv).
* **Rule 3.3 - Phân loại vật tư**: Ánh xạ đúng tên dịch vụ ra loại vật tư và mã phim dán tương ứng trong `material_master.csv`. Nếu dịch vụ dán kính -> Loại vật tư là `WINDOW_FILM`. Nếu dịch vụ dán bảo vệ thân vỏ -> Loại vật tư là `PPF`.

# Validation Logic
* `IF vehicle_model_code NOT IN vehicle_master THEN action = TRIGGER_WARNING, code = "VEHICLE_NOT_IN_MASTER"`
* `IF job_item_id NOT IN job_item_master THEN action = ABORT, error = "Unknown Job Item"`
* `IF material_code NOT IN material_master THEN action = ABORT, error = "Unknown Material Code"`

# Exception Handling
* Nếu dòng xe thi công mới chưa có trong `vehicle_master.csv`, Agent cho phép tạm gán nhóm xe (Sedan/SUV) dựa trên từ khóa gợi ý và gắn cảnh báo `Assumed Vehicle Category`. Yêu cầu Quản lý kỹ thuật duyệt xác nhận lại phân nhóm xe này.

# Human Checkpoint
* Quản lý Kho Kỹ thuật xem xét và phê duyệt việc tạm gán phân nhóm xe đối với các dòng xe mới chưa có trong danh mục chuẩn của hệ thống.

# Audit Requirements
* Lưu lại lịch sử các từ khóa thô của model xe được ánh xạ thành công và các cảnh báo dòng xe lạ để phục vụ bổ sung danh mục chuẩn định kỳ.

# Examples
* **Mapping hợp lệ**: Lexus RX350 dán kính lái -> Phân nhóm xe: `SUV_LARGE`; Hạng mục: `JOB_FILM_WINDSHIELD`; Loại vật tư: `WINDOW_FILM`; Mã phim: `3M-CRYSTAL-1.52`.
* **Mapping lỗi**: "Dán xe Lexus RX" dán phim Class A -> Model xe "Lexus RX" chung chung không khớp đời xe cụ thể trong master, Agent phát cảnh báo yêu cầu làm rõ đời xe (ví dụ: RX350 hay RX450h).
