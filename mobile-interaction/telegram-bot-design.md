# Telegram Bot Design

## 1. Purpose
Kênh Telegram Bot được sử dụng như một phương tiện tương tác nhanh giữa hệ thống Agentic và người dùng di động (Quản lý, KTV, Admin). Kênh này tối ưu hóa thời gian phản hồi bằng cách đẩy trực tiếp thông báo phê duyệt hoặc lệnh thi công kèm theo các nút bấm xử lý tức thời (Quick Interactive Buttons).

## 2. Bot Users
Hệ thống quản lý định danh người dùng qua tài khoản Telegram bằng cách liên kết `chat_id` của Telegram với `user_id` nội bộ:
* **Manager Chat ID**: Nhận thông tin đề xuất phê duyệt và thực hiện duyệt/từ chối từ xa.
* **Technician Chat ID**: Nhận Lệnh thi công (Job Card) và link biểu mẫu báo cáo.
* **Admin Chat ID**: Giám sát luồng và nhận các cảnh báo ngoại lệ hệ thống.
* **Inventory Accountant Chat ID**: Nhận các báo cáo hiệu suất và cảnh báo tồn kho an toàn hàng ngày.

## 3. Bot Commands
Các lệnh điều khiển cơ bản hỗ trợ người dùng tra cứu nhanh:
* `/start`: Khởi động bot, hướng dẫn đăng ký tài khoản và đồng bộ `chat_id`.
* `/my_tasks`: KTV tra cứu danh sách các Lệnh thi công (Job Cards) đang được giao cho mình.
* `/pending_approval`: Quản lý tra cứu danh sách các đề xuất phân bổ vật tư đang chờ phê duyệt.
* `/job_cards`: Admin/Quản lý xem nhanh danh sách lệnh thi công đang chạy tại xưởng.
* `/help`: Hiển thị danh sách câu lệnh và thông tin liên hệ hỗ trợ kỹ thuật.

## 4. Manager Approval Notification
Khi hệ thống chạy xong thuật toán phân bổ ở **WF4** và tạo đề xuất, Telegram Bot sẽ gửi tin nhắn sau đến chat ID của Quản lý:

### Template Tin Nhắn:
```text
🔔 ĐỀ XUẤT PHÂN BỔ VẬT TƯ CHỜ DUYỆT (REQ-20260603-001)

• Đại lý: DEALER_LEXUS_SG (Lexus Sài Gòn)
• Khách hàng: KH_MASKED_001
• Dòng xe: LEXUS_RX350 (Năm 2026)
• Số khung/VIN: VIN_MASKED_RX350_001
• Mã phim yêu cầu: JB20 (Window Film)
• Hạng mục thi công: Dán sườn + Kính hậu
• Nhóm cắt gom (Cutting Group): CG_RX350_SIDE_REAR
• Khối Planned Cut Block: 152x143 cm
• Chiều dài planned trừ kho: 1.43m (đã gồm 10% safety margin)

👉 ĐỀ XUẤT NGUỒN VẬT TƯ:
- Loại nguồn: LOT GỐC (Cuộn gốc dở dang cũ nhất - FIFO)
- ID Cuộn: LOT-JB20-001
- Tồn kho khả dụng hiện tại: 12.50m

⚠️ Ghi chú của Agent: Hệ thống phát hiện có mảnh dư SUBLOT-JB20-001 (khổ 1.52x1.50m) có Match Score 86.6%, nhưng do đơn hàng xe Luxury yêu cầu độ thẩm mỹ tối đa, hệ thống đề xuất ưu tiên cuộn gốc cũ nhất. Quyết định thuộc về Quản lý.
```

### Inline Buttons:
* `[✅ Duyệt Nhanh]`
* `[❌ Từ Chối]`
* `[✏️ Mở PWA Chỉnh Sửa]`
* `[👁️ Xem Chi Tiết]`

---

## 5. Manager Button Behavior
* **Nút [Duyệt Nhanh]**:
  * Gửi yêu cầu `POST /api/mobile/approvals/{request_id}/approve` về Backend.
  * Backend kiểm tra quyền Quản lý gắn với `chat_id`.
  * Thực hiện chuyển trạng thái LOT/OFFCUT được chọn sang Reserved/Soft Lock ảo (`is_locked = true`).
  * Trả về thông báo thành công cho Quản lý trên Telegram: *"Đã duyệt phương án cho REQ-20260603-001. Hệ thống đã Soft Lock cuộn LOT-JB20-001 thành công!"*
  * Ghi nhận audit event `MOBILE_APPROVAL_GRANTED`.
* **Nút [Từ Chối]**:
  * Gửi yêu cầu `POST /api/mobile/approvals/{request_id}/reject` về Backend.
  * Yêu cầu Quản lý điền lý do từ chối (trực tiếp qua phản hồi nhanh của bot hoặc mở mini-form PWA). Lý do từ chối là bắt buộc để hủy bỏ đề xuất.
* **Nút [Mở PWA Chỉnh Sửa]**:
  * Trả về một liên kết bảo mật (Deep Link chứa token ngắn hạn) dẫn Quản lý đến màn hình PWA chi tiết để thay đổi LOT/OFFCUT hoặc tùy chỉnh kích thước planned block.

---

## 6. Technician Job Card Notification
Sau khi Quản lý phê duyệt và Soft Lock được thiết lập trong **WF5**, Bot sẽ tự động gửi Lệnh thi công chi tiết đến Kỹ thuật viên phụ trách dán xe:

### Template Tin Nhắn:
```text
🛠️ LỆNH THI CÔNG (JOB CARD) - JOB-20260603-001

• Mã phiếu: REQ-20260603-001
• Model xe: LEXUS_RX350 (Số khung: VIN_MASKED_RX350_001)
• Mã phim: JB20 (Khổ cuộn 1.52m)
• Nguồn cấp vật tư: LOT-JB20-001 (Soft Locked)
• Vị trí kệ lấy phim: A-RACK-03
• Khối Planned Cut Block: 152x143 cm
• Chiều dài cần cắt: 1.43m

📐 LAYOUT THÀNH PHẨM (CẮT GOM):
- Kính hậu: 60x130 cm
- Kính sườn trước: 92x130 cm
(Chú ý: Cắt nguyên block 152x143 cm, dán gom sườn + hậu, không cắt lẻ từng mảnh để tránh hao hụt phim).
```

### Inline Buttons:
* `[📝 Xác Nhận Thực Tế (Hoàn Tất)]`
* `[⚠️ Báo Lỗi Vật Tư]`
* `[🚨 Báo Thiếu Phim]`

---

## 7. Technician Button Behavior
* **Nút [Xác Nhận Thực Tế]**:
  * Trả về liên kết Deep Link mở màn hình xác nhận thực tế của KTV trên PWA để nhập kích thước cắt thực tế, thu hồi mảnh dư và khai báo phế liệu vụn.
* **Nút [Báo Lỗi Vật Tư]**:
  * Gửi thông tin báo lỗi chất lượng cuộn phim (xước, đục, lỗi keo) về Backend, tự động chuyển đơn sang trạng thái `EXCEPTION_HOLD` kèm lý do và bắn cảnh báo về cho Quản lý/Admin kho.
* **Nút [Báo Thiếu Phim]**:
  * Gửi cảnh báo tồn kho ảo sai lệch thực tế (Ví dụ: cuộn phim trên kệ ngắn hơn số liệu hiển thị trên hệ thống). Chuyển đơn sang trạng thái ngoại lệ xử lý thủ công.

---

## 8. Bot Security Rules
* **Xác thực Chat ID**: Chỉ các `chat_id` đã được whitelist và map với tài khoản nội bộ mới được phép click các nút bấm hành động. Tin nhắn từ các tài khoản lạ sẽ bị bot bỏ qua.
* **Hết hạn Token (Expiration)**: Mọi Deep Link hoặc nút bấm tác vụ nhanh chỉ có hiệu lực trong vòng **30 phút** kể từ lúc gửi. Quá thời gian này, user bắt buộc phải đăng nhập lại hoặc yêu cầu sinh link mới để đảm bảo an toàn.
* **Bảo mật thông tin Token**: Tuyệt đối không hardcode Telegram Bot Token hay API Keys trong repo. Các khóa bảo mật phải được load thông qua biến môi trường (`.env` bảo mật).
* **Ẩn thông tin nhạy cảm (Data Masking)**: Tin nhắn Telegram tuyệt đối không chứa thông tin chi tiết về khách hàng (họ tên thật, số điện thoại, biển số xe đầy đủ) mà bắt buộc phải che đi (`KH_MASKED_001`, `VIN_MASKED_...`) nhằm tránh rò rỉ dữ liệu qua màn hình thông báo điện thoại.

## 9. Audit Events
Mọi tương tác qua Telegram Bot phải được Backend ghi nhận lịch sử vào Audit Log:
* `MOBILE_NOTIFICATION_SENT`: Gửi thông báo phê duyệt/lệnh thi công thành công đến Telegram người dùng.
* `MOBILE_APPROVAL_CLICKED`: Quản lý bấm nút phê duyệt trực tiếp trên Telegram.
* `MOBILE_REJECTION_CLICKED`: Quản lý bấm nút từ chối trực tiếp trên Telegram.
* `MOBILE_DEEPLINK_OPENED`: Người dùng click link chuyển tiếp từ Telegram sang PWA.
* `MOBILE_TECH_CONFIRM_OPENED`: KTV mở form xác nhận thực tế từ Telegram.
* `MOBILE_EXCEPTION_REPORTED`: KTV báo lỗi phim hoặc thiếu phim qua nút bấm nhanh.
