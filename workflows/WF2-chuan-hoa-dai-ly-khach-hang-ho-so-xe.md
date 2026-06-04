# Workflow Name
WF2 - Quy trình chuẩn hóa dữ liệu Đại lý, Khách hàng và Hồ sơ xe (Dealer, Customer & Vehicle Profile Standardization Workflow)

# Business Purpose
Chuẩn hóa dữ liệu thô từ WF1 để liên kết chính xác với Master Data. Xác thực thông tin đại lý đối tác, thực hiện kiểm tra khử trùng lặp khách hàng (Dedup) một cách an toàn và lập hồ sơ quản lý xe dựa trên số khung (VIN) duy nhất, đảm bảo tính toàn vẹn của hồ sơ thi công.

# Trigger
Kích hoạt lập tức khi WF1 hoàn thành và xuất ra dữ liệu JSON hợp lệ trạng thái `VALIDATED`.

# Actors
* Admin kho/Điều phối (Con người - duyệt merge/ghi đè sở hữu xe khi xảy ra cảnh báo)

# Agents Involved
* [02-customer-dealer-master-data-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/02-customer-dealer-master-data-agent.md)

# Input
* JSON phiếu yêu cầu từ WF1 (Request).
* Sổ cái Master Data: `dealer_account_master.csv`, `end_customer_master.csv`, và `vehicle_profile_master.csv`.

# Output
* JSON Request đã được điền đầy đủ mã khóa chuẩn hóa: `dealer_id`, `customer_id`, và `vehicle_id` (nếu xe đã tồn tại).

# Main Flow
1. **Bước 1 (Agent)**: Master Data Agent tiếp nhận dữ liệu và thực hiện truy vấn `dealer_id` trong [dealer_account_master.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/dealer_account_master.csv). Nếu khớp, gán mã đại lý chuẩn.
2. **Bước 2 (Agent)**: Agent thực hiện kiểm tra trùng lặp khách lẻ (End Customer) trong [end_customer_master.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/end_customer_master.csv). 
   * Áp dụng quy tắc R2: Nếu khớp cả họ tên và số điện thoại -> Liên kết khách hàng cũ.
   * Nếu trùng tên nhưng khác số điện thoại hoặc địa chỉ -> Không được phép gộp chung. Tạo mới một tài khoản khách hàng tạm thời (`is_temp = true`) và tạo mã `customer_id` mới.
3. **Bước 3 (Agent)**: Agent kiểm tra sự tồn tại của số khung (VIN) trong [vehicle_profile_master.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/vehicle_profile_master.csv).
   * Nếu VIN không tồn tại -> Tạo mới hồ sơ xe dán phim.
   * Nếu VIN đã tồn tại và khớp chủ sở hữu (`customer_id`) -> Cho phép tiếp tục để cập nhật lịch sử.
4. **Bước 4 (Agent)**: Ghi nhận thông tin đã liên kết vào JSON Request và chuyển giao sang WF3.

# Alternative Flows
* **Alternative Flow 2.1 - Khớp trùng khách hàng gần tuyệt đối (Dedup Merge)**:
  * Khi quét phát hiện khách hàng trùng tên và số điện thoại chỉ lệch định dạng quốc gia (ví dụ: `0903...` vs `+84903...`). Agent tự động chuẩn hóa số điện thoại, thực hiện gộp và cập nhật hồ sơ khách hàng cũ.
* **Alternative Flow 2.2 - Xe vãng lai không thuộc đại lý**:
  * Yêu cầu dán xe vãng lai. Agent bỏ qua bước truy vấn `dealer_account_master.csv` và chỉ thực hiện tạo mới/liên kết hồ sơ khách hàng lẻ và hồ sơ xe.
* **Alternative Flow 2.3 - Khách hàng yêu cầu cập nhật thông tin email/địa chỉ**:
  * Khách hàng cũ đổi email hoặc địa chỉ liên hệ. Agent tự động ghi đè thông tin mới lên hồ sơ khách hàng hiện tại và lưu lại mốc lịch sử thay đổi thông tin.

# Exception Flows
* **Exception Flow 2.1 - Số khung (VIN) đã tồn tại nhưng khác chủ sở hữu (VIN Owner Conflict)**:
  * Số khung xe trùng khớp với một xe trong hệ thống nhưng tên chủ xe hoặc mã đại lý khác biệt. Agent dừng luồng xử lý tự động, phát tín hiệu cảnh báo xung đột sở hữu xe `"Vehicle Owner Conflict Detected"` và gửi yêu cầu rà soát sang Admin kho.
* **Exception Flow 2.2 - Không tìm thấy Đại lý (Dealer Account Not Found)**:
  * Mã đại lý ghi trong yêu cầu thi công B2B không tồn tại trong `dealer_account_master.csv`. Agent từ chối liên kết, dừng quy trình và thông báo cho bộ phận Admin kho/Kế toán để kiểm tra chứng từ đại lý.
* **Exception Flow 2.3 - Dữ liệu số điện thoại khách hàng không đúng định dạng**:
  * Số điện thoại khách hàng dán xe lẻ bị trống hoặc sai định dạng chữ số. Agent gán cờ lỗi dữ liệu khách hàng và chuyển sang Admin kho nhập sửa thủ công.

# Human Checkpoints
* **Admin kho (HITL)**: Thực hiện kiểm tra thực tế hồ sơ xe/đăng ký xe khi xảy ra cảnh báo xung đột số khung (`VIN Owner Conflict`). Admin kho có thẩm quyền duyệt ghi đè sở hữu xe (nếu xe đã chuyển nhượng chủ) hoặc yêu cầu KTV kiểm tra số khung vật lý trên xe dán để sửa lỗi gõ sai VIN.

# Rules Applied
* [R2-customer-dealer-data-governance-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R2-customer-dealer-data-governance-rules.md)

# Audit Events
* Ghi log merge khách hàng: `CUSTOMER_MERGED` (Mã cũ, mã mới, lý do).
* Cảnh báo xung đột số khung: `VIN_OWNER_CONFLICT_ALERT` (Số khung, chủ cũ, chủ mới, request_id).
* Ghi log tạo mới xe: `VEHICLE_PROFILE_CREATED` (Mã xe, số khung, model).

# Completion Criteria
* Yêu cầu dán xe được liên kết thành công với `dealer_id` và `customer_id` hợp lệ trong Master Data.

# Status Flow
`VALIDATED` -> `STANDARDIZING` -> `STANDARDIZED` (Chuẩn hóa xong, sang WF3) hoặc `CONFLICT_SUSPENDED` (Chờ đối soát xung đột VIN).
