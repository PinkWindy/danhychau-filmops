# Rule Set Name
R4 - Quy tắc tính toán định mức vật tư tiêu hao (Norm Calculation Rules)

# Business Purpose
Đảm bảo việc tính toán lượng phim cách nhiệt/PPF lý thuyết cần cấp phát dựa trên ma trận định mức của xưởng và hệ số an toàn chuẩn hóa, đồng thời áp dụng cơ chế Cutting Group để gom các hạng mục cùng cuộn cắt nhằm tối ưu hóa vật tư và tránh cộng lặp chiều dài trừ kho.

# Applied By Agent
* [04-norm-calculation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/04-norm-calculation-agent.md)

# Trigger Conditions
Kích hoạt khi thông tin xe, hạng mục và mã phim đã được mapping chuẩn hóa ở bước trước.

# Rules
* **Rule 4.1 - Kiểm tra sự tồn tại của Định mức**: Bắt buộc phải tồn tại một dòng định mức hợp lệ khớp với tổ hợp: Phân nhóm xe (`vehicle_category`) x Hạng mục thi công (`job_item_id`) x Mã phim (`material_code`) trong ma trận định mức [norm_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/norm_matrix.csv).
* **Rule 4.2 - Cấm tự ý thay đổi định mức gốc**: Nghiêm cấm Agent tự ý tăng hoặc giảm các thông số định mức gốc lấy từ ma trận chuẩn của xưởng. Mọi thay đổi định mức chỉ được phép thực hiện thủ công bởi Quản lý có thẩm quyền.
* **Rule 4.3 - Công thức áp dụng hệ số an toàn**:
  * Phim cách nhiệt (`WINDOW_FILM`): Chiều dài yêu cầu dán = Chiều dài định mức x 1.10 (+10% an toàn để sấy phim).
  * Phim PPF bảo vệ sơn (`PPF`): Chiều dài yêu cầu dán = Chiều dài định mức x 1.05 (+5% an toàn để gấp mép bọc).
  * Chiều rộng yêu cầu giữ nguyên theo khổ cuộn phim chuẩn (ví dụ: 1.52m).
* **Rule 4.4 - Quy định Cutting Group và kích thước trừ kho**:
  * Định mức của từng hạng mục riêng lẻ không đồng nghĩa với kích thước trừ kho.
  * Nếu các hạng mục thi công thuộc cùng một `cut_group_id` (quy định tại [cutting_group_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/cutting_group_matrix.csv)), hệ thống phải gom chúng lại để tính kích thước khối cắt (`cut_block`) thực tế.
  * **Cấm cộng lặp**: Không được cộng dồn chiều dài tiêu hao (`deduction_length_m`) cho từng hạng mục riêng lẻ trong cùng một `cut_group_id`. Chiều dài trừ kho của cả group sẽ được tính một lần duy nhất theo chiều dài khối cắt chung (`cut_block_length_cm` đã quy đổi kèm margin).
  * **Quy tắc gom theo khổ rộng (SUM_WIDTH_EQUALS_ROLL_WIDTH)**: Nếu tổng chiều rộng của các mảnh nhỏ trong group bằng đúng chiều rộng khổ cuộn phim (`roll_width_cm`), hệ thống tạo một cut block chung có chiều rộng bằng `roll_width_cm` và chiều dài bằng chiều dài của mảnh dài nhất trong group.
  * Nếu xuất hiện tổ hợp hạng mục dán mà không xác định được Cutting Group phù hợp trên hệ thống, Agent dừng xử lý và chuyển giao diện về cho Quản lý kỹ thuật xác nhận phương án cắt thủ công.

# Validation Logic
* `IF lookup_norm(vehicle_category, job_item_id, material_code) IS NULL THEN status = ABORT, error = "Norm Matrix Lookup Failed"`
* `IF is_grouped_cut == true THEN lookup_cutting_group(vehicle_model_code, cut_group_id)`
* `IF grouping_rule == 'SUM_WIDTH_EQUALS_ROLL_WIDTH' AND sum(piece_width_cm) == roll_width_cm THEN cut_block_width = roll_width_cm, cut_block_length = max(piece_length_cm)`
* `IF is_grouped_cut == true THEN deduction_length = cut_block_length * (1 + safety_margin_percent / 100) / 100`
* `IF is_grouped_cut == false THEN deduction_length = base_length_m * (1 + safety_margin_percent / 100)`
* `IF lookup_norm_is_grouped_cut_but_no_group_found THEN status = PENDING_HUMAN, action = ESCALATE_TO_MANAGER`

# Exception Handling
* Nếu không tìm thấy định mức cho tổ hợp xe x hạng mục x mã phim, Agent báo lỗi `"Missing Norm Alert"`, dừng luồng tự động và chuyển phiếu yêu cầu sang chế độ chờ nhập định mức thủ công.

# Human Checkpoint
* Quản lý Kho Kỹ thuật trực tiếp kiểm tra, phê duyệt nhập định mức dán thủ công hoặc xác nhận cấu hình Cutting Group mới cho các dòng xe mới phát sinh.

# Audit Requirements
* Ghi log lại các giá trị định mức chuẩn, mã `cut_group_id` được áp dụng, kích thước khối cắt dự kiến (`cut_block`), hệ số an toàn được áp dụng, và chiều dài trừ kho được tính toán để phục vụ kiểm toán vật tư.

# Examples
* **Tính toán theo Cutting Group**: Lexus RX350 dán kính hậu (`JOB_FILM_REAR` size 60x130) và sườn trước (`JOB_FILM_SIDE` size 92x130) cùng sử dụng mã phim `JB20` khổ 1.52m. Do `60 + 92 = 152cm` (bằng khổ cuộn), hệ thống gom vào `CG_RX350_SIDE_REAR` với `grouping_rule = SUM_WIDTH_EQUALS_ROLL_WIDTH`. Block cắt thực tế là 130x152. Chiều dài yêu cầu dán cho cả group là `1.30 * 1.10 = 1.43m` (chỉ trừ kho 1.43m một lần duy nhất, không trừ riêng lẻ `60x130` và `92x130`).
