# Mobile Security & Audit Rules

## 1. Purpose
Tài liệu này thiết lập các quy tắc bảo mật cứng, phân quyền người dùng di động, chính sách bảo vệ dữ liệu nhạy cảm và quy định kiểm toán bắt buộc đối với mọi hoạt động diễn ra trên lớp Telegram Bot và ứng dụng PWA.

---

## 2. Authentication Rules (Quy tắc Xác thực)
* **Đăng ký thiết bị và Whitelist Chat ID**: 100% người dùng Telegram Bot bắt buộc phải qua bước kích hoạt tài khoản nội bộ. Hệ thống chỉ xử lý lệnh từ các `chat_id` đã nằm trong danh sách Whitelist được lưu trong DB. Mọi tin nhắn từ số điện thoại lạ hoặc tài khoản chưa liên kết sẽ bị bot phớt lờ.
* **Thời hạn phiên làm việc (Session Expiry)**: Phiên đăng nhập PWA trên trình duyệt di động của nhân viên tự động hết hạn sau **8 tiếng** (hết ca làm việc). KTV hoặc Quản lý phải xác thực lại sau khi phiên hết hạn.
* **Deep Link Token dùng một lần**: Các đường liên kết chuyển tiếp từ Telegram Bot sang PWA (Deep Link) được mã hóa kèm Token xác thực có thời gian sống (TTL) tối đa là **30 phút** và chỉ được sử dụng tối đa **1 lần** cho một phiên duyệt/xác nhận cụ thể.

## 3. Authorization Rules (Quy tắc Phân quyền)
Hệ thống áp dụng ma trận phân quyền truy cập nghiêm ngặt trên thiết bị di động:
* **Quản lý Kho Kỹ thuật (Manager)**:
  * Quyền: Xem danh sách đề xuất chờ duyệt, Phê duyệt/Từ chối phương án, Chỉnh sửa nguồn vật tư (LOT/OFFCUT) và Planned block trên PWA, Xem dashboard hiệu suất Yield.
  * Cấm: Không được phép nhập xác nhận kích thước thực tế thi công (Actual Confirmation) thay cho KTV.
* **Kỹ thuật viên (Technician)**:
  * Quyền: Xem danh sách Job Card được phân công cho mình, Mở biểu mẫu xác nhận kích thước thực tế thi công và báo cáo mảnh dư/scrap trên PWA, Báo lỗi vật tư.
  * Cấm: Không được duyệt các đề xuất phân bổ phim, không được xem thông tin chi tiết của các Job Card giao cho KTV khác.
* **Admin kho / Điều phối**:
  * Quyền: Đẩy đơn hàng thô lên hệ thống, theo dõi tiến độ các bước của luồng.
  * Cấm: Không được tự duyệt phương án Soft Lock của Quản lý và không được tự xác nhận actual của KTV.
* **Kế toán kho / Quản lý vận hành**:
  * Quyền: Xem bảng điều khiển hiệu suất Yield, xem danh sách cảnh báo tồn kho và xem nhật ký audit log.
  * Cấm: Không can thiệp vào luồng phê duyệt và thi công thực tế.

## 4. Data Privacy Rules (Quy tắc Bảo mật Dữ liệu)
* **Nguyên tắc Che dấu thông tin nhạy cảm (Data Masking)**: 
  * Tin nhắn thông báo gửi qua Telegram Bot tuyệt đối không chứa tên đầy đủ của khách hàng lẻ, số điện thoại hoặc biển số xe.
  * Thông tin hiển thị mặc định phải che mask: Tên khách hàng hiển thị là `KH_MASKED_***`, số VIN hiển thị dạng `VIN_MASKED_RX350_***`.
* **Cấm đẩy dữ liệu nhạy cảm vào group chat công khai**: Mọi thông báo phê duyệt hoặc Job Card phải được gửi trực tiếp 1-1 (Direct Message) cho cá nhân phụ trách, nghiêm cấm cấu hình bot đẩy dữ liệu chi tiết vào các nhóm chat Telegram chung.
* **Bảo vệ Bot Token**: Không lưu trữ Telegram Bot Token hoặc API Keys dưới dạng văn bản thường trong source code hay đẩy lên Git Repository. Các thông tin này bắt buộc phải cấu hình qua biến môi trường bảo mật trên máy chủ Backend.

## 5. Audit Rules (Quy tắc Kiểm toán)
Tất cả các hành động tương tác qua thiết bị di động đều phải ghi nhật ký kiểm toán bất biến với các sự kiện chuẩn sau:
* `MOBILE_NOTIFICATION_SENT`: Ghi nhận khi hệ thống gửi tin nhắn phê duyệt hoặc lệnh thi công sang Telegram người dùng.
* `MOBILE_APPROVAL_GRANTED`: Quản lý bấm duyệt phương án phân bổ (qua Telegram hoặc PWA).
* `MOBILE_APPROVAL_REJECTED`: Quản lý từ chối phương án phân bổ.
* `MOBILE_PROPOSAL_MODIFIED`: Quản lý chỉnh sửa thông tin nguồn hoặc kích thước planned block trên PWA.
* `MOBILE_JOB_CARD_OPENED`: KTV click link mở xem lệnh thi công.
* `MOBILE_TECH_CONFIRMED`: KTV gửi thành công biểu mẫu xác nhận kích thước thực tế cắt phim.
* `MOBILE_EXCEPTION_REPORTED`: KTV báo lỗi phim hoặc sai lệch tồn kho vật lý.
* `MOBILE_AUDIT_FAILED`: Ghi nhận cảnh báo khi hệ thống không thể ghi log kiểm toán (Cần kích hoạt cảnh báo đỏ).

## 6. Failure Handling (Xử lý sự cố & Fallback)
* **Sự cố Telegram Bot**: Nếu API Webhook của Telegram Bot gặp sự cố không thể gửi/nhận tin nhắn, hệ thống tự động gửi thông báo qua email cho Admin và người dùng có thể truy cập trực tiếp vào link PWA Dashboard bằng trình duyệt điện thoại để xử lý công việc.
* **Lỗi ghi log kiểm toán**: Nếu giao dịch kho (Deduction/Offcut Creation) thành công nhưng bước ghi log kiểm toán (`DbAuditLog`) thất bại, toàn bộ giao dịch cập nhật kho ảo bắt buộc phải **Rollback** ngay lập tức để bảo vệ tính toàn vẹn của dữ liệu và hệ thống sẽ đưa ra thông báo lỗi `AUDIT_WRITE_FAILED` cho người dùng di động.
* **Nút bấm / Link hết hạn**: Khi người dùng click nút bấm hoặc Deep Link đã quá 30 phút, bot sẽ trả về tin nhắn: *"Rất tiếc, liên kết này đã hết hạn. Vui lòng gõ /pending_approval hoặc /my_tasks để nhận liên kết mới."*
* **Soft Lock hết hạn (Soft Lock Expired)**: Nếu quá 30 phút kể từ lúc Quản lý duyệt và tạo Soft Lock mà KTV vẫn chưa thi công xác nhận, Soft Lock sẽ tự động giải phóng. Khi KTV click bắt đầu, hệ thống sẽ báo lỗi `SOFT_LOCK_EXPIRED` và yêu cầu Quản lý phê duyệt lại để kích hoạt khóa mới.
