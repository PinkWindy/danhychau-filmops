# Rule Set Name
R6 - Quy tắc phân bổ cuộn phim gốc (LOT Allocation Rules)

# Business Purpose
Đảm bảo việc cấp phát cuộn phim gốc để cắt mới diễn ra khoa học, tuân thủ nguyên tắc FIFO (nhập trước dùng trước), ưu tiên sử dụng các cuộn đang cắt dở dang, đồng thời tích hợp logic trừ kho theo nhóm cắt (Cutting Group) nhằm tránh trừ lặp chiều dài phim.

# Applied By Agent
* [06-lot-allocation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/06-lot-allocation-agent.md)

# Trigger Conditions
Kích hoạt khi Offcut Optimization Agent báo cáo không có mảnh dư nào phù hợp (Match Score < 60% hoặc không có mảnh nào khớp kích thước vật lý).

# Rules
* **Rule 6.1 - Điều kiện cuộn gốc khả dụng**: Cuộn phim gốc được đề xuất bắt buộc phải thỏa mãn:
  * Khớp chính xác 100% mã vật tư phim (`material_code`).
  * Trạng thái hoạt động (`status == 'ACTIVE'`).
  * Không bị khóa giữ chỗ (`is_locked == false`).
  * Có chiều dài tồn dở dang còn lại (`remaining_length_m`) >= Chiều dài yêu cầu dán của Khối cắt (`deduction_length_m` của Cutting Group hoặc `required_length_m` của hạng mục đơn lẻ).
* **Rule 6.2 - Phân bổ theo Cutting Group và cấm trừ lặp**:
  * Nếu các hạng mục thuộc cùng một `cut_group_id` (ví dụ: sườn và hậu chung nhóm), hệ thống chỉ thực hiện trừ kho một lần duy nhất theo `deduction_length_m` của cả Cutting Group trên cuộn phim được chỉ định. Nghiêm cấm trừ lặp cho từng hạng mục riêng lẻ trong group.
  * **Tách nhóm theo mã vật tư (Material Code Separation)**: Nếu một phiếu yêu cầu thi công có nhiều hạng mục dán sử dụng các mã vật tư phim khác nhau (ví dụ: kính lái dùng `RT40`, kính sườn dùng `JB20`), hệ thống bắt buộc phải tách và tạo các Cutting Group riêng biệt (hoặc lệnh cấp phát riêng lẻ) tương ứng với từng `material_code`. Không được phép gom các hạng mục khác mã vật tư vào cùng một Cutting Group.
* **Rule 6.3 - Thứ tự ưu tiên phân bổ**:
  * *Ưu tiên 1*: Cuộn gốc cùng mã đang được cắt dở dang (đã mở và sử dụng trước đó, `is_opened == true` và còn tồn chiều dài).
  * *Ưu tiên 2*: Áp dụng nguyên tắc FIFO (First In, First Out) dựa trên ngày nhập kho (`import_date`) đối với các cuộn nguyên chưa khui (`is_opened == false`).
* **Rule 6.4 - Khóa tạm thời**: Ngay khi đề xuất một cuộn LOT, hệ thống thực hiện Soft Lock (`is_locked = true`) để ngăn chặn việc phân bổ trùng lặp cho đơn hàng khác trong hàng chờ.

# Validation Logic
* `IF lot_status != 'ACTIVE' OR is_locked == true THEN skip_lot`
* `IF lot_remaining_length < group_deduction_length (or required_length_m) THEN skip_lot`
* `IF lot_is_opened == true THEN priority = 1`
* `IF lot_is_opened == false THEN priority = 2 (sort by import_date ASC)`
* `IF request_contains_multiple_materials THEN split_into_material_based_groups()`
* `IF items_share_cut_group_id THEN deduct_only_once_for_group(lot_id, group_deduction_length)`

# Exception Handling
* Nếu tổng lượng tồn kho khả dụng của mã vật tư xuống thấp dưới định mức tồn kho an toàn (15m), Agent phát báo động `"Safety Stock Alert"` đồng thời gửi đề xuất mua cuộn phim mới sang cho Kế toán kho.

# Human Checkpoint
* Quản lý Kho Kỹ thuật phê duyệt đề xuất phân bổ cuộn gốc và giải quyết chênh lệch kho vật lý khi xảy ra trường hợp cuộn dở dang được chỉ định bị hỏng ngoài đời.

# Audit Requirements
* Nhật ký giao dịch lưu lại danh sách các cuộn LOT được quét đối chiếu, thứ tự FIFO được áp dụng, ngày nhập kho của cuộn phim được chọn và mã `cut_group_id` liên kết (nếu có).

# Examples
* **Phân bổ theo nhóm cắt (Chỉ trừ một lần)**: Phiếu yêu cầu dán kính hậu và kính sườn Lexus RX350 (cùng nhóm `CG_RX350_SIDE_REAR`, mã phim `JB20`, cần chiều dài khối cắt là 1.43m). Cuộn gốc `LOT-JB20-001` đang dở dang còn 10m. Hệ thống chỉ thực hiện phân bổ và trừ 1.43m trên cuộn `LOT-JB20-001` một lần duy nhất, thay vì trừ `1.43m` cho kính sườn và tiếp tục trừ `1.43m` cho kính hậu.
* **Tách nhóm theo mã vật tư**: Phiếu yêu cầu dán kính lái (phim `RT40`) và kính sườn (phim `JB20`). Hệ thống tự động tách làm 2 lệnh cấp phát riêng biệt: 1 block cho kính lái sử dụng cuộn gốc `RT40`, và 1 block/group cho kính sườn sử dụng cuộn gốc `JB20`.
