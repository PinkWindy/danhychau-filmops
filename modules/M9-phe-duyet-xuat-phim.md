# Module Name
M9 - Phê duyệt phương án xuất phim (Approval Workflow)

# Business Purpose
Quản trị quy trình tương tác phê duyệt (Human-in-the-loop) giữa Quản lý kho kỹ thuật và Agent AI. Module này cung cấp cơ chế khóa tạm thời vật tư để tránh tranh chấp và ghi nhận chữ ký phê duyệt số của Quản lý trước khi dán xe.

# Users
* Quản lý Kho Kỹ thuật

# Key Features
* Trình duyệt phương án dán phim (Draft -> Pending Approval).
* Tạo trạng thái **Reserved/Soft Lock** (Khóa giữ chỗ tạm thời): Khi một phương án được đưa ra trình duyệt hoặc vừa được Quản lý phê duyệt (`APPROVED`), mã cuộn LOT gốc hoặc Sub-LOT đề xuất sẽ bị gán trạng thái `is_locked = true`. Trạng thái này ngăn không cho các đơn hàng khác quét trúng vật tư này, nhưng **tuyệt đối chưa trừ tồn kho vật lý**.
* Ghi nhận phê duyệt (`APPROVED`) hoặc Từ chối (`REJECTED`) của Quản lý.
* Bắt buộc ghi nhận lý do điều chỉnh (`adjustment_reason`) khi Quản lý thay đổi phương án đề xuất của AI.
* Giải phóng Soft Lock: Nếu phương án bị hủy hoặc chuyển sang trạng thái `REJECTED`, trả lại trạng thái `is_locked = false` cho vật tư.

# Input Data
* JSON đề xuất vật tư của Agent 5 hoặc Agent 6.
* Phản hồi phê duyệt/từ chối từ Quản lý.
* Quy tắc phê duyệt `rules/R7-approval-rules.md`.

# Output Data
* Trạng thái phê duyệt phương án dán phim (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`).
* Bản log chỉnh sửa của Quản lý kèm lý do điều chỉnh.

# Business Rules Applied
* Bắt buộc có lý do điều chỉnh dài tối thiểu 10 ký tự nếu Quản lý thay đổi phương án dán của AI.
* Phân biệt rõ **Approved/Soft Lock** và **Deducted (Đã trừ kho)**: Việc phê duyệt phương án chỉ đóng vai trò giữ chỗ vật tư (`Reserved`). Tồn kho ảo chỉ bị trừ sau khi Kỹ thuật viên báo cáo thi công xong.

# Related Agents
* [07-approval-handoff-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/07-approval-handoff-agent.md)

# Related Workflows
* [WF5-phe-duyet-giao-ky-thuat-vien.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF5-phe-duyet-giao-ky-thuat-vien.md)

# Acceptance Criteria
* Gán nhãn `is_locked = true` thành công cho vật tư được phê duyệt/trình duyệt để giữ chỗ.
* Từ chối lưu phê duyệt nếu phát hiện Quản lý chỉnh sửa thông số dán nhưng để trống ô nhập lý do.
* Mở khóa giữ chỗ thành công khi phương án bị từ chối phê duyệt.
