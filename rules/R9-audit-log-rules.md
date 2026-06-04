# Rule Set Name
R9 - Quy tắc ghi nhật ký hệ thống và kiểm toán dữ liệu (Audit Log Rules)

# Business Purpose
Bảo đảm tính minh bạch, khả năng truy vết và ngăn chặn các hành vi gian lận dữ liệu vật tư kho hoặc thay đổi thông tin trái phép trong hệ thống quản lý kho phim DYC.

# Applied By Agent
* [08-inventory-yield-analytics-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/08-inventory-yield-analytics-agent.md)
* Tất cả các Agent phụ trách cập nhật dữ liệu trong workspace.

# Trigger Conditions
Kích hoạt lập tức khi có bất kỳ hành động tạo mới, cập nhật hoặc xóa dữ liệu đối với các đối tượng: Phiếu yêu cầu (`Request`), Phương án phê duyệt (`Approval`), Hồ sơ tồn kho (`LOT/Sub-LOT`), và Lệnh thi công (`Job Card`).

# Rules
* **Rule 9.1 - Bắt buộc ghi nhận mọi chỉnh sửa**: Mọi hành vi sửa đổi dữ liệu (đặc biệt là việc sửa đổi phương án phân bổ của Quản lý hoặc điều chỉnh tồn kho vật lý của Kế toán) bắt buộc phải được ghi nhận vào nhật ký hệ thống.
* **Rule 9.2 - Cấu trúc bắt buộc của bản ghi log**: Một bản ghi audit log hợp lệ bắt buộc phải chứa đầy đủ các trường thông tin:
  * `timestamp`: Thời gian ghi nhận giao dịch (định dạng ISO 8601).
  * `actor`: Mã tài khoản thực hiện hành động (Con người hoặc Agent ID).
  * `action_type`: Loại hành động (`CREATE`, `UPDATE`, `DELETE`, `LOCK`, `UNLOCK`).
  * `target_entity`: Đối tượng chịu tác động (ví dụ: `LOT-PPF-001`, `CUST_001`).
  * `before_value`: Giá trị cũ trước khi thay đổi (chứa toàn bộ JSON hoặc chuỗi giá trị cũ).
  * `after_value`: Giá trị mới sau khi thay đổi (chứa toàn bộ JSON hoặc chuỗi giá trị mới).
  * `reason`: Lý do thay đổi (độ dài >= 10 ký tự đối với các chỉnh sửa kho và phương án của Quản lý).
* **Rule 9.3 - Tính bất biến (Immutability) của Log**: File nhật ký hệ thống là tệp tin chỉ cho phép ghi thêm (Append-Only). Nghiêm cấm mọi hành vi chỉnh sửa, ghi đè hoặc xóa bỏ dữ liệu log lịch sử đã lưu.

# Validation Logic
* `IF audit_record.timestamp IS NULL OR audit_record.actor IS NULL THEN reject_write_log`
* `IF action_type == 'UPDATE' AND audit_record.before_value == audit_record.after_value THEN skip_log`

# Exception Handling
* Nếu hệ thống ghi log gặp sự cố kỹ thuật (lỗi ghi đĩa, mất kết nối cơ sở dữ liệu), toàn bộ tiến trình thay đổi dữ liệu kho ảo bắt buộc phải rollback và dừng lại, không được phép thực thi giao dịch nếu không lưu được log.

# Human Checkpoint
* Kế toán kho hoặc Quản lý Kho Kỹ thuật trực tiếp truy vấn, đối chiếu nhật ký audit log định kỳ để phát hiện các bất thường về mặt xuất nhập tồn vật tư.

# Audit Requirements
* Bản ghi log phải được bảo mật, lưu trữ định dạng JSON sạch trong thư mục [audit/](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/audit) để sẵn sàng xuất trình cho các đợt kiểm toán nội bộ của DYC.

# Examples
* **Log giao dịch điều chỉnh**: Quản lý điều chỉnh chiều dài dán từ 5.46m thành 5.60m. Hệ thống tạo bản ghi log:
```json
{
  "timestamp": "2026-06-03T22:48:30Z",
  "actor": "MGR-LE-MINH",
  "action_type": "UPDATE",
  "target_entity": "REQ-20260603-001",
  "before_value": { "required_length_m": 5.46 },
  "after_value": { "required_length_m": 5.60 },
  "reason": "Them 0.14m chieu dai de KTV bo ky hon can truoc."
}
```
