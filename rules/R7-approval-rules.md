# Rule Set Name
R7 - Quy tắc phê duyệt phương án xuất phim (Approval Rules)

# Business Purpose
Thiết lập chốt chặn kiểm soát số lượng vật tư được phê duyệt cho từng đơn hàng (HITL-1), ngăn ngừa việc xuất kho sai lệch, thất thoát vật tư cao cấp và ghi chép minh bạch lịch sử sửa đổi phương án.

# Applied By Agent
* [07-approval-handoff-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/07-approval-handoff-agent.md)

# Trigger Conditions
Kích hoạt khi Agent hoàn thành việc lập phương án đề xuất phân bổ vật tư (dùng mảnh dư hoặc cuộn gốc).

# Rules
* **Rule 7.1 - Bắt buộc con người phê duyệt**: Mọi phương án đề xuất phân bổ vật tư dán phim (dùng mảnh dư Sub-LOT hoặc cắt cuộn gốc LOT) bắt buộc phải được Quản lý Kho Kỹ thuật kiểm tra và bấm nút xác nhận phê duyệt số.
* **Rule 7.2 - Nghiêm cấm tự động phê duyệt**: Hệ thống không cho phép Agent tự động duyệt thay Quản lý dưới bất kỳ hình thức nào. Trạng thái `APPROVED` chỉ được gán sau khi có chữ ký điện tử/mã xác nhận tài khoản của Quản lý.
* **Rule 7.3 - Cơ chế khóa tạm thời (Soft Lock / Reserved)**: Khi phương án được Quản lý phê duyệt (`APPROVED`), hệ thống chỉ gán trạng thái `is_locked = true` cho cuộn LOT hoặc mảnh dư được chỉ định để giữ chỗ tạm thời (Soft Lock). Thao tác này **tuyệt đối không được trừ tồn kho vật lý**. Việc trừ tồn chỉ được thực hiện ở bước sau khi KTV xác nhận thực tế.
* **Rule 7.4 - Bắt buộc nhập lý do điều chỉnh**: Nếu Quản lý chỉnh sửa thông số dán (thay đổi LOT, đổi mảnh dư, thay đổi kích thước cắt lý thuyết), hệ thống bắt buộc Quản lý phải điền lý do chỉnh sửa với độ dài tối thiểu là 10 ký tự. Nếu không đạt, hệ thống từ chối lưu phê duyệt.

# Validation Logic
* `IF approval_status == 'APPROVED' THEN lot_or_offcut_status = LOCKED, is_deducted = FALSE`
* `IF is_adjusted == true AND length(adjustment_reason) < 10 THEN action = REJECT_SUBMISSION, error = "Adjustment reason must be at least 10 characters"`

# Exception Handling
* Nếu cuộn LOT hoặc mảnh dư được Quản lý chọn thủ công bị khóa bởi một đơn hàng khác, hệ thống báo lỗi `"Selected Material is Locked"`, yêu cầu Quản lý chọn vật tư khác hoặc chờ giải phóng khóa đơn hàng kia.

# Human Checkpoint
* Quản lý Kho Kỹ thuật trực tiếp thực hiện rà soát, điều chỉnh kích thước và ký duyệt phương án dán phim trên màn hình làm việc (HITL-1).

# Audit Requirements
* Bản ghi log phê duyệt bắt buộc phải lưu trữ: ID người duyệt, mốc thời gian duyệt, trạng thái trước/sau điều chỉnh (before_value, after_value) và lý do chỉnh sửa cụ thể.

# Examples
* **Ký duyệt thành công**: Phương án đề xuất dùng mảnh dư `SUBLOT-PPFX-001` dán nắp capo Lexus RX350. Quản lý bấm duyệt không sửa gì -> Mảnh dư chuyển sang trạng thái `is_locked = true`. Lệnh thi công Job Card được sinh ra gửi cho KTV.
* **Lỗi thiếu lý do điều chỉnh**: Quản lý điều chỉnh chiều dài cắt từ 1.89m thành 1.95m và gõ lý do dán là "ok". Agent báo lỗi lý do quá ngắn và từ chối phê duyệt.
