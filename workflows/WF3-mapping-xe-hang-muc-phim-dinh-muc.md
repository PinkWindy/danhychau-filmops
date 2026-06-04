# Workflow Name
WF3 - Quy trình ánh xạ loại xe, hạng mục thi công và tra cứu định mức (Vehicle, Job Item & Film Norm Mapping Workflow)

# Business Purpose
Xác định dòng xe dán phim có nằm trong danh mục đời xe chuẩn hay không, ánh xạ dịch vụ dán sang hạng mục chuẩn và tra cứu kích thước phim định mức tiêu hao lý thuyết. Đặc biệt phân biệt rõ giữa định mức cắt lẻ từng hạng mục và định mức theo nhóm cắt chung (Cutting Group/Cut Block) để tối ưu vật tư.

# Trigger
Nhận dữ liệu phiếu yêu cầu dán xe đã được chuẩn hóa liên kết đối tác ở trạng thái `STANDARDIZED` từ WF2.

# Actors
* Quản lý Kho Kỹ thuật (Con người - Duyệt gán nhóm xe tạm thời hoặc nhập định mức thủ công)

# Agents Involved
* [03-vehicle-film-mapping-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/03-vehicle-film-mapping-agent.md)
* [04-norm-calculation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/04-norm-calculation-agent.md)

# Input
* JSON Request từ WF2.
* Tệp tham chiếu: `vehicle_master.csv`, `job_item_master.csv`, `norm_matrix.csv`, và `cutting_group_matrix.csv`.

# Output
* JSON Request chứa thông tin định mức chi tiết (gồm kích thước từng mảnh, cờ nhóm cắt, mã `cut_group_id`, kích thước khối cắt `cut_block` lý thuyết và chiều dài trừ kho tương ứng).

# Main Flow
1. **Bước 1 (Agent - Mapping)**: Vehicle Film Mapping Agent kiểm tra model xe dán trong [vehicle_master.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/vehicle_master.csv) và hạng mục dán trong [job_item_master.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/job_item_master.csv). 
2. **Bước 2 (Agent - Tra định mức)**: Norm Calculation Agent nhận mã xe và hạng mục thi công đã chuẩn hóa để tra cứu ma trận định mức dán [norm_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/norm_matrix.csv).
3. **Bước 3 (Agent - Phân biệt nhóm cắt)**: Agent kiểm tra trường `is_grouped_cut` trong dòng định mức tìm được:
   * **Nếu `is_grouped_cut == false`**: Hệ thống tính toán kích thước yêu cầu dán cho từng hạng mục riêng lẻ (bằng cách lấy định mức gốc nhân hệ số an toàn quy định tại Rule 4.3).
   * **Nếu `is_grouped_cut == true`**: Agent lấy mã `cut_group_id` và thực hiện truy vấn sang tệp [cutting_group_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/cutting_group_matrix.csv) để lấy kích thước khối cắt chung (`cut_block_width_cm`, `cut_block_length_cm`) và chiều dài tiêu hao (`deduction_length_m`) của cả nhóm. Hệ thống bắt buộc phải lấy `deduction_length_m` này để lập phương án và trừ tồn kho ảo, tuyệt đối không lấy `required_length_m` của từng dòng hạng mục riêng lẻ trong [norm_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/norm_matrix.csv).
4. **Bước 4 (Agent)**: Ghi nhận kích thước định mức lý thuyết cuối cùng vào JSON Request và chuyển sang WF4.

# Alternative Flows
* **Alternative Flow 3.1 - Áp dụng định mức nhóm cắt PPF Capo & Cản trước**:
  * Yêu cầu thi công đồng thời dán PPF cho cả nắp Capo và cản trước. Agent tự động tìm kiếm trong danh mục nhóm cắt PPF (nếu có) để gom block lớn nhằm tiết kiệm hao hụt phim, gán `cut_group_id` PPF tương ứng.
* **Alternative Flow 3.2 - Dán nhiều loại phim khác nhau trên cùng một xe**:
  * Yêu cầu dán phim cách nhiệt kính lái (phim RT40) và dán sườn (phim JB20). Agent tách làm 2 quy trình tính định mức độc lập (1 lẻ cho kính lái và 1 gom group cho kính sườn/hậu).
* **Alternative Flow 3.3 - Ánh xạ thành công từ khóa dòng xe viết tắt**:
  * Tên xe ghi "RX 350" hoặc "Lexus RX". Agent tự động ánh xạ thông minh thành đời xe chuẩn `LEXUS_RX350` thông qua bảng đối chiếu từ khóa và tiếp tục luồng xử lý chính.

# Exception Flows
* **Exception Flow 3.1 - Xe mới chưa có trong danh mục chuẩn (Vehicle Model Not Found)**:
  * Dòng xe dán phim hoàn toàn mới chưa được cập nhật vào `vehicle_master.csv`. Agent gán trạng thái `VEHICLE_PENDING_REVIEW`, đề xuất phân nhóm xe tạm thời dựa trên dòng tương đương và chuyển yêu cầu sang Quản lý duyệt.
* **Exception Flow 3.2 - Thiếu Định mức trong ma trận (Missing Norm Alert)**:
  * Không tìm thấy tổ hợp dòng xe x hạng mục x mã vật tư phim trong `norm_matrix.csv`. Agent báo lỗi `MISSING_NORM`, dừng quy trình và gửi yêu cầu nhập định mức thủ công đến Quản lý.
* **Exception Flow 3.3 - Kích thước yêu cầu vượt khổ phim tối đa**:
  * Kích thước yêu cầu dán đơn lẻ hoặc khối cắt nhóm có chiều rộng vượt quá khổ cuộn phim tối đa trong kho (1.52m). Agent dừng xử lý và gán trạng thái lỗi `WIDTH_EXCEEDS_ROLL_LIMIT`.

# Human Checkpoints
* **Quản lý Kho Kỹ thuật (HITL)**:
  * Phê duyệt việc phân nhóm xe tạm thời khi gặp xe mới chưa có trong master.
  * Trực tiếp nhập định mức dán thủ công (kèm lý do điều chỉnh) đối với các trường hợp bị lỗi thiếu định mức dán trên hệ thống.

# Rules Applied
* [R3-vehicle-film-mapping-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R3-vehicle-film-mapping-rules.md)
* [R4-norm-calculation-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R4-norm-calculation-rules.md)

# Audit Events
* Log lỗi thiếu định mức: `NORM_LOOKUP_FAILED` (Model xe, hạng mục dán, request_id).
* Log gán định mức thủ công: `NORM_MANUALLY_ASSIGNED` (Người duyệt, kích thước gán, lý do).

# Completion Criteria
* Toàn bộ các hạng mục dán trong phiếu yêu cầu đều được xác định rõ kích thước dán lý thuyết (lẻ hoặc theo nhóm khối cắt) và mã vật tư phim dán cụ thể.

# Status Flow
`STANDARDIZED` -> `MAPPING` -> `NORM_ASSIGNED` (Đã gán định mức, sang WF4) hoặc `NORM_PENDING` (Chờ Quản lý gán định mức thủ công).
