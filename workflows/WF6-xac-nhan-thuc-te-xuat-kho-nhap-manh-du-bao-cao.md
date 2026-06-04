# Workflow Name
WF6 - Quy trình xác nhận thực tế thi công, trừ tồn kho và ghi nhận phế liệu/mảnh dư (Technician Confirmation, Inventory Transaction & Reporting Workflow)

# Business Purpose
Ghi nhận kết quả cắt dán thực tế từ Kỹ thuật viên (HITL-2), thực thi giao dịch trừ kho chính xác theo thực tế, tự động sinh mã nhập kho cho mảnh dư mới đạt tiêu chuẩn hoặc ghi nhận phế liệu (Scrap) cho phần phim thừa nhỏ, giải phóng Soft Lock ảo và ghi Audit Log bất biến phục vụ đối soát định kỳ.

# Trigger
Kỹ thuật viên dán xong xe, đo đạc kích thước thực tế sử dụng và bấm nút xác nhận hoàn thành Job Card trên thiết bị.

# Actors
* Kỹ thuật viên (Con người - trực tiếp xác nhận thực tế dán xe và đo phần dư)
* Kế toán kho / Quản lý vận hành (Con người - truy vấn báo cáo, đối soát kho vật lý)

# Agents Involved
* [08-inventory-yield-analytics-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/08-inventory-yield-analytics-agent.md)

# Input
* Job Card đã được duyệt từ WF5.
* Kích thước cắt dán thực tế, chất lượng và vị trí kệ của phần dư dở dang do KTV nhập.

# Output
* Giao dịch kho ảo hoàn tất thành công (cập nhật `lot_inventory.csv` và `offcut_inventory.csv`).
* Bản ghi log giao dịch bất biến được lưu vết (theo `audit-log-schema.json`).
* Báo cáo hiệu quả sử dụng vật tư (Yield Report).

# Main Flow
1. **Bước 1 (Con người - KTV confirm)**: Kỹ thuật viên thi công thực hiện đo đạc thực tế chiều dài đã cắt từ cuộn gốc hoặc mảnh dư được chỉ định. KTV bắt buộc phải nhập kích thước thực tế (`actual_length_m`, `actual_width_m`) và xác nhận khối cắt thực tế (`actual_cut_block`, ví dụ: 152x130) trên hệ thống, đồng thời khai báo chất lượng và kệ lưu kho của phần dư dở dang (nếu có). **Tuyệt đối không thực hiện trừ kho nếu KTV chưa xác nhận và nhập đầy đủ actual_cut_block hoặc actual_size.**
2. **Bước 2 (Agent - Trừ tồn kho thực tế)**: Inventory Yield Analytics Agent tiếp nhận dữ liệu và thực hiện đối soát:
    * **Phân biệt Planned vs Actual**: Chiều dài trừ kho định mức `deduction_length_m` từ [cutting_group_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/cutting_group_matrix.csv) là số liệu dự kiến (planned). Giao dịch trừ kho thực tế bắt buộc phải sử dụng số liệu thực tế sử dụng (`actual_length_m` hoặc `actual_cut_block`) do KTV xác nhận tại Bước 1, không được tự động trừ theo định mức planned.
    * **Cấm trừ lặp theo hạng mục**: Nếu các hạng mục thuộc cùng một `cut_group_id` (với `is_grouped_cut = true`), Agent tuyệt đối không được trừ kho lẻ theo `required_length_m` từng dòng lẻ trong [norm_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/norm_matrix.csv). Hệ thống chỉ thực hiện trừ tồn kho một lần duy nhất cho cả nhóm cắt theo chiều dài khối cắt thực tế KTV xác nhận.
    * **Kiểm tra chênh lệch & Cảnh báo**: Nếu `actual_cut_block` khác `planned_cut_block` hoặc lượng tiêu hao thực tế vượt quá dung sai cho phép (`tolerance_percent`), hệ thống bắt buộc KTV nhập lý do ngoại lệ (`exception_reason`) và phát cảnh báo đến Quản lý và Kế toán kho để rà soát.
    * Thực hiện trừ chiều dài còn lại (`remaining_length_m`) của cuộn gốc hoặc cập nhật mảnh dư cũ thành `USED`.
    * Kiểm tra tồn kho âm: Nếu chiều dài thực tế báo cáo vượt quá chiều dài còn lại trong kho ảo -> Báo lỗi và dừng giao dịch (Rule 8.3).
3. **Bước 3 (Agent - Phân loại phần dư thừa)**: Agent đánh giá phần dư rơi ra dựa trên kích thước tối thiểu (Rule 8.4):
   * **Đạt điều kiện mảnh dư (Sub-LOT)**: Tự động khởi tạo mã mảnh dư mới dạng `[LOT-ID]-SUB[STT]` với trạng thái `ACTIVE` và ghi nhận vị trí lưu trữ kệ do KTV xác nhận vào [offcut_inventory.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/offcut_inventory.csv).
   * **Không đạt điều kiện**: Tính toán diện tích dở dang và ghi nhận vào Scrap.
4. **Bước 4 (Agent - Giải phóng Soft Lock)**: Giải phóng trạng thái khóa ảo của cuộn gốc/mảnh dư gốc (`is_locked = false`) để đưa phần còn lại trở lại trạng thái khả dụng.
5. **Bước 5 (Agent - Ghi Audit Log)**: Ghi bản ghi log bất biến vào hệ thống kiểm toán (chứa đầy đủ 16 trường bắt buộc quy định tại Rule 8.7).

# Alternative Flows
* **Alternative Flow 6.1 - Không phát sinh phần dư thừa (Used All)**:
  * KTV cắt vừa khít hoặc dùng hết mảnh dư cũ dở dang mà không thừa lại gì. Agent cập nhật số dư cuộn gốc hoặc gán mảnh dư cũ thành `USED`, bỏ qua bước tạo mới mảnh dư và ghi nhận phế liệu = 0.
* **Alternative Flow 6.2 - KTV làm hỏng phim trong quá trình dán (Damaged during Application)**:
  * Phim bị hỏng trong quá trình thi công và KTV phải cắt lại miếng khác từ cuộn gốc. KTV báo cáo chiều dài hỏng và chiều dài cắt lại. Agent trừ tồn cuộn gốc cho cả hai phần cắt, đồng thời ghi nhận toàn bộ diện tích phần phim bị hỏng vào Scrap dán xe kèm ghi chú lỗi kỹ thuật.
* **Alternative Flow 6.3 - Kế toán kho điều chỉnh chênh lệch sau kiểm kê vật lý**:
  * Kế toán kho kiểm kho định kỳ phát hiện cuộn phim bị thiếu hụt thực tế so với kho ảo. Kế toán nhập giao dịch điều chỉnh số dư trực tiếp, gõ lý do kiểm kê dài >= 10 ký tự. Agent trừ kho ảo và lưu log kiểm toán bất biến.

# Exception Flows
* **Exception Flow 6.1 - Số lượng báo cáo vượt quá tồn kho khả dụng (Negative Stock Error)**:
  * Chiều dài thực tế KTV báo cắt vượt quá số dư còn lại của cuộn LOT/mảnh dư trên kho ảo. Agent dừng giao dịch kho, gán cờ lỗi `INVENTORY_DISCREPANCY` và gửi yêu cầu Kế toán kho kiểm kho đối soát thực tế.
* **Exception Flow 6.2 - KTV báo cáo thiếu thông tin bắt buộc của mảnh dư mới**:
  * Phần dư dở dang đủ kích thước tái sử dụng nhưng KTV bỏ trống trường chất lượng hoặc vị trí kệ lưu kho. Agent từ chối hoàn thành Job Card, yêu cầu KTV điền đầy đủ trước khi lưu.
* **Exception Flow 6.3 - Ghi log kiểm toán thất bại (Audit Write Failure)**:
  * Hệ thống gặp sự cố lưu trữ không ghi được log giao dịch kho. Agent thực hiện Rollback toàn bộ trạng thái trừ kho ảo, khóa lệnh dán và báo động lỗi hệ thống.

# Human Checkpoints
* **Kỹ thuật viên (HITL-2)**: Đo đạc và xác nhận chính xác các thông số thực tế sau thi công và chất lượng phần dư.
* **Kế toán kho (HITL)**: Thực hiện kiểm kho vật lý định kỳ và đối soát với nhật ký giao dịch kho (Audit Log) để xử lý các chênh lệch số liệu.

# Rules Applied
* [R8-inventory-deduction-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R8-inventory-deduction-rules.md)
* [R9-audit-log-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R9-audit-log-rules.md)

# Audit Events
* Log giao dịch kho: `INVENTORY_TRANSACTION_LOGGED` (Mã giao dịch, request_id, KTV, LOT-ID, lượng trừ, mảnh dư mới tạo, phế liệu ghi nhận, approved_by).
* Cảnh báo chênh lệch kho: `INVENTORY_DISCREPANCY_ALERT` (Mã LOT, số dư ảo, số dư KTV báo cáo, request_id).

# Completion Criteria
* Giao dịch trừ tồn kho ảo được ghi nhận thành công, giải phóng Soft Lock vật lý, tạo mảnh dư mới/scrap nếu có, và ghi nhật ký bất biến hoàn tất.

# Status Flow
`APPROVED` -> `TECH_CONFIRMING` -> `COMPLETED` (Hoàn tất đơn hàng và trừ kho) hoặc `DISCREPANCY_HOLD` (Tạm giữ do lệch kho thực tế).
