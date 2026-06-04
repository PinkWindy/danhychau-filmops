# Rule Set Name
R8 - Quy tắc cập nhật tồn kho và xử lý mảnh dư/scrap (Inventory Deduction Rules)

# Business Purpose
Đảm bảo số liệu tồn kho ảo trên hệ thống được cập nhật theo xác nhận thực tế, có khả năng đối soát với kho vật lý và phát hiện chênh lệch khi kiểm kê, tự động hóa việc định danh mảnh dư mới tái sử dụng và kiểm soát lượng phế liệu phát sinh sau thi công.

# Applied By Agent
* [08-inventory-yield-analytics-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/08-inventory-yield-analytics-agent.md)

# Trigger Conditions
Kích hoạt khi nhận được xác nhận hoàn thành thi công dán xe và phản hồi kích thước thực tế từ Kỹ thuật viên (HITL-2).

# Rules
* **Rule 8.1 - Chỉ trừ kho sau khi KTV xác nhận**: Tuyệt đối không trừ tồn kho vật lý tự động dựa trên định mức lý thuyết. Giao dịch trừ kho chỉ được thực thi sau khi Kỹ thuật viên bấm nút xác nhận hoàn thành công việc và nhập số liệu thực tế sử dụng.
* **Rule 8.2 - Trừ kho theo phân nhánh nguồn (Source Type) và Cut Block**:
  * **Cấm trừ lặp theo hạng mục**: Đối với các hạng mục thuộc cùng một nhóm cắt (`cut_group_id`), hệ thống chỉ thực hiện trừ kho một lần duy nhất theo kích thước khối cắt thực tế (`actual_cut_block` do KTV xác nhận) hoặc khối cắt dự kiến (`planned_cut_block`). Tuyệt đối không trừ kho lặp đi lặp lại cho từng hạng mục nhỏ trong cùng group.
  * **Quy tắc lấy định mức trừ kho**: Nếu `is_grouped_cut = TRUE`, hệ thống bắt buộc phải lấy chiều dài trừ kho (`deduction_length_m`) từ [cutting_group_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/cutting_group_matrix.csv) để thực hiện trừ tồn kho ảo/thực tế, tuyệt đối không lấy `required_length_m` của từng dòng hạng mục riêng lẻ trong [norm_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/norm_matrix.csv).
  * **Trường hợp source_type = LOT**: Trừ chiều dài còn lại (`remaining_length_m`) của LOT gốc đúng bằng chiều dài thực tế KTV đã cắt dán (`actual_length_m`).
  * **Trường hợp source_type = OFFCUT và dùng hết mảnh dư**: Chuyển trạng thái mảnh dư cũ thành `USED`.
  * **Trường hợp source_type = OFFCUT và còn phần dư dở dang**:
    * Nếu phần dư dở dang đủ điều kiện tái sử dụng (theo kích thước tối thiểu ở Rule 8.4): Chuyển trạng thái mảnh dư cũ thành `USED` (hoặc `PARTIALLY_USED`), đồng thời tự động tạo một mã mảnh dư (Sub-LOT) mới từ phần còn lại này.
    * Nếu phần dư dở dang không đủ điều kiện tái sử dụng: Chuyển trạng thái mảnh dư cũ thành `USED` và ghi nhận toàn bộ diện tích phần dư thừa vào Scrap.
* **Rule 8.3 - Cấm tồn kho âm**: Hệ thống không cho phép thực hiện giao dịch trừ kho nếu chiều dài thực tế báo cáo vượt quá chiều dài còn lại của cuộn phim hoặc mảnh dư dở dang trong kho ảo (tồn kho âm).
* **Rule 8.4 - Điều kiện tạo mảnh dư (OFFCUT/SUB-LOT) mới**: Hệ thống chỉ khởi tạo một mảnh dư (Sub-LOT) mới ở trạng thái `ACTIVE` khi Kỹ thuật viên đã xác nhận đầy đủ các thông tin: kích thước thực tế (chiều dài, chiều rộng), trạng thái chất lượng (`quality_status`), vị trí lưu trữ kệ (`storage_location`), mã nguồn gốc (`parent_lot_id` hoặc `parent_offcut_id`), và mã yêu cầu liên kết (`created_from_request_id`). Kích thước tối thiểu để tái sử dụng quy định như sau:
  * **Đối với PPF**: Chiều dài phần dư `length_m >= 0.5m` VÀ chiều rộng `width_m >= 0.3m`.
  * **Đối với Window Film**: Chiều dài phần dư `length_m >= 0.3m` VÀ chiều rộng `width_m >= 0.2m`.
* **Rule 8.5 - Ghi nhận phế liệu (Scrap)**: Mọi phần phim dư thừa sau khi cắt dán dở dang có kích thước nhỏ hơn ngưỡng tái sử dụng nêu trên, hoặc bị hỏng trong quá trình dán xe đều phải được tính toán diện tích dở dang và ghi nhận vào hồ sơ phế liệu (`Scrap`) của hệ thống.
* **Rule 8.6 - Giải phóng giữ chỗ (Soft Lock/Reserved)**: Sau khi giao dịch xuất kho trừ tồn hoàn tất thành công, hệ thống phải tự động giải phóng trạng thái Reserved/Soft Lock của LOT hoặc OFFCUT tương ứng (`is_locked = false`) để đưa phần còn lại của cuộn phim/mảnh dư trở lại trạng thái khả dụng cho các đơn hàng tiếp theo.
* **Rule 8.7 - Kiểm soát sai lệch so với Cutting Group đã duyệt**: Nếu thực tế KTV cắt dán khác biệt so với cấu hình Cutting Group hoặc phương án đã được duyệt (ví dụ: tự ý tách nhóm, thay đổi mã vật tư dán, hoặc chiều dài cắt thực tế chênh lệch vượt quá sai số `tolerance_percent` của định mức), hệ thống yêu cầu KTV bắt buộc phải nhập lý do ngoại lệ (`exception_reason`) và gửi cảnh báo đến Quản lý và Kế toán kho để rà soát thủ công.

# Validation Logic
* `IF actual_length_m > lot_remaining_length (or offcut_length) THEN abort_transaction, error = "Deduction exceeds stock"`
* `IF material_type == 'PPF' AND remaining_length >= 0.5 AND remaining_width >= 0.3 AND has_ktv_fields(dimensions, quality_status, storage_location, parent_id, request_id) THEN action = CREATE_SUBLOT`
* `IF material_type == 'PPF' AND (remaining_length < 0.5 OR remaining_width < 0.3) THEN action = RECORD_SCRAP`
* `IF material_type == 'WINDOW_FILM' AND remaining_length >= 0.3 AND remaining_width >= 0.2 AND has_ktv_fields(dimensions, quality_status, storage_location, parent_id, request_id) THEN action = CREATE_SUBLOT`
* `IF material_type == 'WINDOW_FILM' AND (remaining_length < 0.3 OR remaining_width < 0.2) THEN action = RECORD_SCRAP`
* `IF source_type == 'LOT' THEN deduct_lot_remaining(source_id, actual_length_m)`
* `IF source_type == 'OFFCUT' AND actual_used_all == TRUE THEN set_offcut_status(source_id, 'USED')`
* `IF source_type == 'OFFCUT' AND actual_used_all == FALSE THEN set_offcut_status(source_id, 'USED'), process_offcut_residual(source_id, remaining_length, remaining_width)`
* `IF is_grouped_cut == true THEN deduct_only_once_for_group(cut_group_id, actual_cut_block)`
* `IF actual_cut_block != planned_cut_block THEN trigger_warning, require_field = exception_reason`
* `AFTER inventory_transaction_success THEN set_lock_status(source_id, FALSE)`

# Exception Handling
* Nếu chiều dài thực tế KTV báo vượt quá chiều dài còn lại của cuộn trên kho ảo (chênh lệch thực tế vs sổ sách), Agent dừng giao dịch, phát tín hiệu cảnh báo `"Inventory Discrepancy Alert"` để Kế toán kho kiểm kho vật lý đối soát thủ công.

# Human Checkpoint
* Kỹ thuật viên trực tiếp đo đạc, nhập chính xác kích thước thực tế sử dụng sau cắt dán, xác nhận chất lượng, vị trí lưu kho của phần dư (nếu có) và xác nhận hoàn thành Job Card (HITL-2).
* Kế toán kho hoặc Quản lý Kho Kỹ thuật trực tiếp đối soát các trường hợp KTV cắt lệch so với Cutting Group đã duyệt.

# Audit Requirements
Mỗi giao dịch xuất nhập kho ảo (Inventory Transaction) bắt buộc phải sinh mã duy nhất và ghi nhật ký bất biến với đầy đủ các trường thông tin sau:
* `transaction_id`: Mã định danh giao dịch kho.
* `request_id`: Mã yêu cầu dán xe liên quan.
* `cut_group_id`: Mã Cutting Group áp dụng (nếu có).
* `source_type`: Loại nguồn xuất phim (`LOT` hoặc `OFFCUT`).
* `source_id`: ID của LOT hoặc OFFCUT gốc được xuất.
* `material_code`: Mã vật tư phim cách nhiệt/PPF.
* `planned_size`: Kích thước dự kiến theo phương án (chiều dài, chiều rộng, diện tích).
* `planned_cut_block`: Kích thước khối cắt dự kiến (chiều rộng cm x chiều dài cm, ví dụ: 152x130).
* `actual_size`: Kích thước cắt thực tế (chiều dài, chiều rộng, diện tích).
* `actual_cut_block`: Kích thước khối cắt thực tế của KTV (chiều rộng cm x chiều dài cm, ví dụ: 152x130).
* `before_balance`: Số dư tồn kho trước giao dịch (ví dụ: `remaining_length_m` của LOT trước khi trừ).
* `after_balance`: Số dư tồn kho sau giao dịch (ví dụ: `remaining_length_m` của LOT sau khi trừ).
* `created_offcut_id`: ID của mảnh dư (Sub-LOT) mới được tạo (nếu có).
* `scrap_area_m2`: Diện tích phế liệu ghi nhận (nếu có).
* `technician_id`: Mã Kỹ thuật viên thực hiện thi công.
* `approved_by`: Mã Quản lý phê duyệt phương án dán ban đầu.
* `performed_at`: Thời gian thực thi giao dịch (ISO 8601).
* `exception_reason`: Lý do chênh lệch/ngoại lệ nếu KTV cắt khác Cutting Group được duyệt.

# Examples
* **Trừ kho theo nhóm cắt**: KTV thi công sườn và hậu Lexus RX350 (thuộc nhóm `CG_RX350_SIDE_REAR`). KTV xác nhận đã cắt nguyên một block `130x152` thực tế từ cuộn `LOT-JB20-001`. Hệ thống trừ tồn cuộn phim 1.43m (bao gồm safety margin), ghi nhận transaction với `cut_group_id = CG_RX350_SIDE_REAR`, `planned_cut_block = 152x130`, `actual_cut_block = 152x130`, không trừ lặp.
* **KTV tự ý tách cắt lẻ**: Do cuộn dở dang không đủ 1.43m, KTV tự ý xé nhóm để cắt lẻ kính hậu từ mảnh dư và kính sườn từ cuộn nguyên khác. Khi xác nhận, hệ thống báo đỏ do `actual_cut_block` khác biệt. KTV phải gõ lý do: "Cuon cu khong du chieu dai block, tu tach cat le kinh hau bang offcut" và gửi báo động đến Quản lý.
