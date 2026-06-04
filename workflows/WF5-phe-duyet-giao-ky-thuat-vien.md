# Workflow Name
WF5 - Quy trình phê duyệt phương án xuất phim và bàn giao thi công (Manager Approval & Job Handoff Workflow)

# Business Purpose
Tạo chốt chặn kiểm soát (HITL-1) bắt buộc con người phê duyệt phương án cấp phát vật tư trước khi Kỹ thuật viên (KTV) tiến hành cắt dán thực tế. Bảo đảm tính chính xác, ngăn chặn lãng phí phim cao cấp và ghi chép bất biến lịch sử điều chỉnh phương án của Quản lý.

# Trigger
Kích hoạt khi hệ thống lập xong đề xuất phân bổ vật tư ở trạng thái `ALLOCATED` từ WF4.

# Actors
* Quản lý Kho Kỹ thuật (Con người - duyệt/chỉnh sửa phương án)
* Kỹ thuật viên (Con người - nhận lệnh thi công)

# Agents Involved
* [07-approval-handoff-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/07-approval-handoff-agent.md)

# Input
* JSON Request chứa phương án đề xuất phân bổ từ WF4.

# Output
* Lệnh thi công chi tiết (Job Card) được định dạng sẵn để gửi cho Kỹ thuật viên (theo `sample-02-technician-task.md`).
* Giao dịch Soft Lock được xác nhận trên cơ sở dữ liệu ảo.

# Main Flow
1. **Bước 1 (Agent)**: Approval Handoff Agent biên dịch phương án đề xuất (gồm thông tin xe, hạng mục dán, loại vật tư, mã LOT/mảnh dư đề xuất, vị trí lưu trữ kệ, Match Score) thành thông điệp trình duyệt chuẩn gửi đến Quản lý.
2. **Bước 2 (Con người - Quản lý duyệt)**: Quản lý Kho Kỹ thuật trực tiếp kiểm tra phương án trên màn hình làm việc (HITL-1).
   * **Nghiêm cấm Agent tự duyệt**: Trạng thái `APPROVED` chỉ được gán sau khi có thao tác bấm xác nhận của Quản lý.
   * **Cơ chế Soft Lock**: Khi Quản lý bấm Duyệt, hệ thống **chỉ tạo trạng thái giữ chỗ tạm thời ảo (Reserved/Soft Lock)** trên cuộn LOT/mảnh dư đó (`is_locked = true`). Hệ thống **tuyệt đối không trừ tồn kho vật lý** ở bước này.
3. **Bước 3 (Agent)**: Sau khi Quản lý duyệt, Agent tự động đóng gói lệnh và sinh ra Job Card chi tiết cho Kỹ thuật viên (chứa thông tin chỉ định rõ cuộn LOT/mảnh dư nào và vị trí kệ để KTV lấy phim).
4. **Bước 4 (KTV nhận lệnh)**: Lệnh thi công được gửi đến thiết bị hoặc in ra cho Kỹ thuật viên nhận dán xe. Chuyển sang WF6.

# Alternative Flows
* **Alternative Flow 5.1 - Quản lý điều chỉnh phương án cấp phát (LOT/Offcut Override)**:
  * Quản lý kiểm kho thực tế thấy cuộn dở dang đề xuất bị hỏng ngoài đời. Quản lý chọn thủ công cuộn gốc khác thay thế trên hệ thống, bắt buộc phải nhập lý do điều chỉnh dài >= 10 ký tự. Agent kiểm tra tính hợp lệ của lý do, thực hiện Soft Lock cuộn mới, giải phóng cuộn cũ và sinh Job Card.
* **Alternative Flow 5.2 - Quản lý điều chỉnh kích thước cắt (Size Correction)**:
  * Quản lý muốn tăng biên an toàn cắt thực tế cho KTV (từ 1.43m lên 1.48m). Quản lý nhập kích thước mới trực tiếp, gõ lý do điều chỉnh dài >= 10 ký tự và ký duyệt. Hệ thống cập nhật kích thước kế hoạch mới.
* **Alternative Flow 5.3 - Từ chối phiếu yêu cầu (Reject Request)**:
  * Quản lý phát hiện lỗi nghiêm trọng từ đại lý hoặc xe đã bị hủy lịch dán. Quản lý bấm từ chối phiếu yêu cầu. Agent giải phóng toàn bộ Soft Lock của vật tư liên quan và chuyển trạng thái yêu cầu thành `REJECTED`, gửi thông báo về cho Admin kho.

# Exception Flows
* **Exception Flow 5.1 - Quản lý điều chỉnh phương án nhưng gõ lý do quá ngắn**:
  * Quản lý thay đổi cuộn phim đề xuất nhưng nhập lý do dưới 10 ký tự (ví dụ: "đổi cuộn" hoặc "ok"). Agent báo lỗi, từ chối ghi nhận trạng thái phê duyệt và yêu cầu Quản lý nhập lại lý do chi tiết hơn.
* **Exception Flow 5.2 - Vật tư được chọn thủ công bị khóa bởi đơn hàng khác (Material Locked)**:
  * Quản lý chọn thủ công một cuộn LOT hoặc mảnh dư khác đang bị khóa Soft Lock bởi một đơn hàng khác trong hàng chờ. Agent báo lỗi `"Selected Material is Locked"`, từ chối phê duyệt và đề xuất Quản lý chọn vật tư khác.
* **Exception Flow 5.3 - Yêu cầu thi công bị quá hạn phê duyệt (Approval Timeout)**:
  * Phương án dán xe chờ duyệt quá 24 giờ mà không có phản hồi từ Quản lý. Agent tự động giải phóng Soft Lock ảo để giải phóng vật tư cho đơn hàng khác, chuyển trạng thái yêu cầu thành `PENDING_TIMEOUT` và gửi email nhắc nhở Quản lý.

# Human Checkpoints
* **Quản lý Kho Kỹ thuật (HITL-1)**: Trực tiếp ký phê duyệt phương án dán phim trên màn hình quản lý. Quản lý có toàn quyền chấp nhận đề xuất tự động hoặc ghi đè (override) chọn cuộn phim/mảnh dư khác theo tình hình kho vật lý thực tế.

# Rules Applied
* [R7-approval-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R7-approval-rules.md)

# Audit Events
* Log phê duyệt phương án: `APPROVAL_GRANTED` (ID người duyệt, request_id, trạng thái Soft Lock).
* Log điều chỉnh phương án: `APPROVAL_OVERRIDE` (ID người duyệt, trước thay đổi, sau thay đổi, lý do điều chỉnh, request_id).
* Log từ chối yêu cầu: `REQUEST_REJECTED` (ID người duyệt, lý do từ chối, request_id).

# Completion Criteria
* Phương án được Quản lý ký duyệt (`APPROVED`), vật tư ảo chuyển sang trạng thái Soft Lock được xác nhận và lệnh thi công Job Card được bàn giao cho Kỹ thuật viên.

# Status Flow
`ALLOCATED` -> `PENDING_APPROVAL` -> `APPROVED` (Đã duyệt và giao việc, sang WF6) hoặc `REJECTED` (Bị từ chối).
