# Workflow Name
WF4 - Quy trình tối ưu hóa sử dụng mảnh dư và phân bổ cuộn phim gốc (Offcut Optimization & LOT Allocation Workflow)

# Business Purpose
Tối ưu hóa chi phí vật tư bằng cách quét và so khớp khối cắt dán lý thuyết (đơn lẻ hoặc nhóm khối cắt) với các mảnh dư khả dụng trong kho trước khi đề xuất cắt cuộn gốc. Đề xuất cuộn gốc theo thứ tự cuộn dở dang trước, cuộn nguyên sau theo nguyên tắc FIFO.

# Trigger
Kích hoạt khi thông tin định mức lý thuyết được gán thành công ở trạng thái `NORM_ASSIGNED` từ WF3.

# Actors
* Quản lý Kho Kỹ thuật (Con người - Phê duyệt phương án sử dụng mảnh dư cân nhắc hoặc xử lý khớp một phần)

# Agents Involved
* [05-offcut-optimization-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/05-offcut-optimization-agent.md)
* [06-lot-allocation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/06-lot-allocation-agent.md)

# Input
* JSON Request chứa định mức lý thuyết.
* Danh sách tồn kho khả dụng từ `lot_inventory.csv` và `offcut_inventory.csv`.

# Output
* Đề xuất phương án cấp phát vật tư cụ thể: Sử dụng mã mảnh dư cụ thể (Sub-LOT) hoặc cắt từ cuộn phim gốc (LOT) nào, kèm theo chiều dài dự kiến trừ kho và vị trí lưu trữ kệ vật lý.

# Main Flow
1. **Bước 1 (Agent - Quét mảnh dư)**: Offcut Optimization Agent quét toàn bộ mảnh dư hoạt động và không khóa (`status = ACTIVE` và `is_locked = false`) có cùng `material_code` trong [offcut_inventory.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/offcut_inventory.csv).
2. **Bước 2 (Agent - Khớp khối cắt)**: Agent so khớp kích thước mảnh dư với kích thước khối cắt (`cut_block_width_cm` và `cut_block_length_cm` của group hoặc mảnh lẻ). Nếu `rotation_allowed = true`, Agent kiểm tra cả hai chiều xoay của mảnh dư.
3. **Bước 3 (Agent - Tính Match Score)**: Agent tính Match Score cho các mảnh dư đủ kích thước:
   * **Match Score >= 80%**: Đề xuất ưu tiên dùng mảnh dư này (hao hụt ít). Chuyển sang WF5.
   * **Match Score từ 60% đến 79%**: Đưa vào danh sách cân nhắc, yêu cầu Quản lý duyệt kỹ ở WF5.
   * **Match Score < 60%** hoặc không có mảnh nào vừa: Bỏ qua mảnh dư, chuyển sang luồng phân bổ LOT gốc.
4. **Bước 4 (Agent - Phân bổ LOT)**: LOT Allocation Agent tìm kiếm cuộn gốc trong [lot_inventory.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/lot_inventory.csv) theo thứ tự ưu tiên:
   * Cuộn cùng mã đang dở dang (`is_opened = true` và còn tồn).
   * Cuộn nguyên chưa khui (`is_opened = false`) xếp theo ngày nhập kho tăng dần (FIFO).
5. **Bước 5 (Agent)**: Tạo Material Allocation Proposal, chưa khóa vật tư. Proposal này sẽ được chuyển sang WF5 để Quản lý xác nhận. Chỉ sau khi Quản lý duyệt tại WF5, hệ thống mới tạo Reserved/Soft Lock.

# Alternative Flows
* **Alternative Flow 4.1 - Khớp một phần mảnh dư (Partial Match)**:
  * Mảnh dư trong kho không đủ cho cả khối cắt chung (ví dụ: cần 130x152, chỉ có mảnh 152x80). Tuy nhiên mảnh dư này vừa vặn cho 1 mảnh đơn lẻ kính hậu (`60x130` sau khi xoay). Agent đánh dấu phương án là `PARTIAL_MATCH` và tạo đề xuất kép: dùng mảnh dư này cho kính hậu và cắt cuộn gốc cho kính sườn. Yêu cầu Quản lý kỹ thuật duyệt.
* **Alternative Flow 4.2 - Không có cuộn gốc dở dang**:
  * Kho không còn cuộn gốc dở dang nào cùng mã vật tư. Agent tự động chuyển sang áp dụng nguyên tắc FIFO đối với danh sách các cuộn nguyên chưa khui và đề xuất cuộn cũ nhất.
* **Alternative Flow 4.3 - Đề xuất sử dụng nhiều mảnh dư nhỏ cho các kính sườn lẻ**:
  * Đơn hàng yêu cầu dán nhiều kính sườn lẻ. Agent tìm thấy nhiều mảnh dư nhỏ vừa vặn độc lập cho từng kính sườn. Agent tạo phương án phân bổ sử dụng nhiều mảnh dư nhỏ thay vì cắt cuộn gốc lớn, tối ưu hóa triệt để tồn kho dở dang.

# Exception Flows
* **Exception Flow 4.1 - Hết sạch tồn kho khả dụng (Out of Stock)**:
  * Cả mảnh dư và cuộn gốc trong kho đều không đủ chiều dài còn lại để cấp phát cho đơn hàng. Agent dừng luồng xử lý tự động, báo lỗi `"Insufficient Stock Alert"`, đổi trạng thái phiếu thành `SUSPENDED_OUT_OF_STOCK` và gửi báo động đến Kế toán kho/Quản lý.
* **Exception Flow 4.2 - Cảnh báo tồn kho an toàn (Safety Stock Level Triggered)**:
  * Giao dịch đề xuất phân bổ thành công nhưng làm cho lượng tồn kho khả dụng của mã vật tư đó giảm xuống dưới ngưỡng an toàn (15m). Agent gửi cảnh báo `"Safety Stock Alert"` đến Kế toán kho để lên kế hoạch đặt mua thêm cuộn gốc mới.
* **Exception Flow 4.3 - Vật tư chỉ định bị khóa trùng lặp**:
  * Cuộn LOT hoặc mảnh dư được chọn bị khóa bởi một tiến trình xử lý song song khác ngay trước khi thực hiện khóa. Agent tự động bỏ qua vật tư đó và thực hiện chạy lại thuật toán so khớp tìm vật tư thay thế khác.

# Human Checkpoints
* **Quản lý Kho Kỹ thuật (HITL)**:
  * Xem xét và quyết định phương án cấp phát khi hệ thống đề xuất `PARTIAL_MATCH` (quyết định xem nên tách cắt lẻ hay từ chối dùng mảnh dư để khui cuộn gốc mới).
  * Xem xét phê duyệt các đề xuất mảnh dư nằm trong nhóm cân nhắc (Match Score từ 60% đến 79%).

# Rules Applied
* [R5-offcut-optimization-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R5-offcut-optimization-rules.md)
* [R6-lot-allocation-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R6-lot-allocation-rules.md)

# Audit Events
* Ghi log so khớp mảnh dư: `OFFCUT_MATCHED` (Mã mảnh dư, Match Score, request_id).
* Cảnh báo hết kho: `STOCK_EXHAUSTED` (Mã vật tư, request_id).
* Log phân bổ cuộn gốc: `LOT_ALLOCATED` (Mã LOT, thứ tự FIFO áp dụng, request_id).

# Completion Criteria
* Phương án đề xuất phân bổ vật tư (cuộn gốc hoặc mảnh dư cụ thể) được tạo rõ ràng, chưa trừ kho và chưa Soft Lock cho đến khi được Quản lý duyệt tại WF5.

# Status Flow
`NORM_ASSIGNED` -> `ALLOCATING` -> `ALLOCATED` (Đã lập phương án, sang WF5) hoặc `OUT_OF_STOCK` (Chờ nhập hàng).
