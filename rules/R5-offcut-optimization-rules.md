# Rule Set Name
R5 - Quy tắc tối ưu hóa mảnh dư phim (Offcut Optimization Rules)

# Business Purpose
Tối đa hóa tỷ lệ tái sử dụng vật tư dở dang (Sub-LOT), giảm thiểu tối đa diện tích phim phế liệu đầu ra, đảm bảo tiết kiệm chi phí vật tư dán cho xưởng DYC thông qua việc so khớp khối cắt (Cut Block) của nhóm hoặc từng mảnh đơn lẻ với các mảnh dư hiện có.

# Applied By Agent
* [05-offcut-optimization-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/05-offcut-optimization-agent.md)

# Trigger Conditions
Kích hoạt ngay khi nhận được kích thước phim yêu cầu dán lý thuyết (đơn lẻ hoặc theo nhóm Cut Block) từ Norm Calculation Agent.

# Rules
* **Rule 5.1 - Ưu tiên mảnh dư tuyệt đối**: Hệ thống bắt buộc phải quét và kiểm tra toàn bộ danh sách mảnh dư trong kho trước khi thực hiện đề xuất cắt cuộn gốc.
* **Rule 5.2 - Điều kiện chấp nhận mảnh dư cho Khối cắt (Cut Block)**: Mảnh dư được chọn phải thỏa mãn đồng thời:
  * Trạng thái hoạt động (`status == 'ACTIVE'`).
  * Không bị khóa giữ chỗ (`is_locked == false`).
  * Chất lượng đạt yêu cầu sử dụng dán xe.
  * Trùng khớp 100% mã vật tư phim (`material_code`).
  * **So khớp theo khối cắt (Cut Block Matching)**: So khớp kích thước mảnh dư với kích thước khối cắt `cut_block_width_cm` và `cut_block_length_cm` (đã bao gồm safety margin), chứ không chỉ khớp theo từng mảnh nhỏ riêng lẻ.
  * **Quy tắc xoay khổ (Rotation Check)**: Nếu `rotation_allowed == true` trong `cutting_group_matrix.csv`, hệ thống được phép kiểm tra cả hai chiều xoay của mảnh dư để so khớp (Ví dụ: mảnh dư có kích thước Rộng x Dài là W x L, so khớp được với cả khối cắt có kích thước w x l và l x w).
* **Rule 5.3 - Khớp một phần (Partial Match)**: Nếu mảnh dư chỉ đủ kích thước cho một hoặc vài mảnh nhỏ trong Cutting Group nhưng không đủ cho cả khối cắt chung (Cut Block), hệ thống đánh dấu trạng thái đề xuất là `PARTIAL_MATCH`. Phương án này không được tự động áp dụng mà bắt buộc phải chuyển sang màn hình Quản lý kỹ thuật để xác nhận xem có tách nhóm cắt hay không.
* **Rule 5.4 - Phân loại đề xuất theo điểm tương thích (Match Score)**:
  * Điểm tương thích được tính theo công thức:
    $$Match\_Score = \frac{Diện\ tích\ khối\ cắt\ yêu\ cầu\ (required\_area\_m2)}{Diện\ tích\ mảnh\ dư\ (offcut\_area\_m2)} \times 100\%$$
  * Phân nhóm xử lý đề xuất:
    * **Match Score >= 80%**: Đề xuất ưu tiên dùng mảnh dư này (mảnh dư có kích thước rất vừa vặn, hao hụt ít).
    * **Match Score từ 60% đến 79%**: Đưa vào danh sách cân nhắc. Phương án này cần Quản lý kho xem xét và xác nhận kỹ trước khi duyệt.
    * **Match Score < 60%**: Không đề xuất sử dụng mảnh dư này (mảnh dư quá lớn so với yêu cầu dán, nếu dùng sẽ rất lãng phí mảnh lớn). Hệ thống tự động bỏ qua mảnh dư này và chuyển sang luồng đề xuất LOT gốc.

# Validation Logic
* `IF offcut_status != 'ACTIVE' OR is_locked == true THEN skip_offcut`
* `IF rotation_allowed == true THEN is_fit = (offcut_width >= block_width AND offcut_length >= block_length) OR (offcut_width >= block_length AND offcut_length >= block_width)`
* `IF rotation_allowed == false THEN is_fit = (offcut_width >= block_width AND offcut_length >= block_length)`
* `IF NOT is_fit AND fits_any_single_piece(offcut, job_items) THEN recommendation = PARTIAL_MATCH`
* `IF is_fit AND match_score >= 80 THEN recommendation = PRIORITIZED`
* `IF is_fit AND match_score >= 60 AND match_score < 80 THEN recommendation = CONSIDER`
* `IF is_fit AND match_score < 60 THEN recommendation = REJECT_OFFCUT`

# Exception Handling
* Nếu mảnh dư có Match Score cao nhưng bị đánh giá chất lượng là "xước nhẹ ở mép dán", hệ thống vẫn đưa vào đề xuất nhưng kèm cờ cảnh báo chất lượng vật lý để Quản lý kiểm tra tận nơi tại kho kệ.

# Human Checkpoint
* Quản lý Kho Kỹ thuật trực tiếp kiểm tra và phê duyệt phương án dán đối với các mảnh dư nằm trong nhóm cân nhắc (Match Score từ 60% đến 79%) hoặc các trường hợp khớp một phần (`PARTIAL_MATCH`).

# Audit Requirements
* Lưu vết toàn bộ danh sách mã mảnh dư được duyệt qua, chiều xoay được áp dụng (nếu có), điểm số tương thích tính toán, cờ khớp một phần và lý do chấp nhận hoặc loại bỏ mảnh dư.

# Examples
* **Khớp khối cắt có xoay**: Khối cắt nhóm sườn và hậu Lexus RX350 kích thước 130cm x 152cm (1.30m x 1.52m). Trong kho có mảnh dư `SUBLOT-JB20-01` kích thước 1.52m x 1.40m. Do `rotation_allowed = true`, hệ thống so khớp thành công (xoay ngang) và tính Match Score = `(1.30 * 1.52) / (1.52 * 1.40) * 100% = 92.8%` >= 80%. Hệ thống đề xuất ưu tiên dán mảnh dư này.
* **Khớp một phần (Partial Match)**: Khối cắt nhóm sườn và hậu cần 1.30m x 1.52m. Trong kho chỉ có mảnh dư nhỏ kích thước 1.52m x 0.8m. Mảnh dư này không vừa khối cắt chung nhưng vừa cho mảnh kính hậu (0.60m x 1.30m sau khi xoay). Hệ thống đánh dấu `PARTIAL_MATCH` và chuyển tiếp cho Quản lý kỹ thuật duyệt tách cắt lẻ.
