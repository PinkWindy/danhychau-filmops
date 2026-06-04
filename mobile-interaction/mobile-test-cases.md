# Mobile Test Cases

Tài liệu này định nghĩa 20 kịch bản kiểm thử (Test Cases) chi tiết cho lớp Mobile Interaction Layer của hệ thống quản lý kho phim DYC.

---

## I. Nhóm Quản lý (Manager Test Cases)

### TC-MOB-01: Manager nhận thông báo approval
* **Scenario**: Kiểm tra việc đẩy tin thông báo đề xuất phê duyệt lên Telegram Bot của Quản lý sau khi WF4 chạy.
* **Input**: Đơn hàng `REQ-20260603-001` được phân bổ thành công.
* **Expected Output**: Telegram Bot của Quản lý nhận được đúng mẫu thông báo `Manager Approval Message` có che mask thông tin khách hàng và số VIN xe, hiển thị đúng ID cuộn gốc đề xuất `LOT-JB20-001`.
* **Rule Applied**: Che giấu thông tin nhạy cảm.
* **Audit Expected**: `MOBILE_NOTIFICATION_SENT` ghi nhận log.
* **Pass/Fail Criteria**: Pass nếu tin nhắn hiển thị đúng nội dung và 4 nút bấm tương tác đi kèm.

### TC-MOB-02: Manager bấm Duyệt nhanh trên Telegram
* **Scenario**: Quản lý nhấn nút Duyệt nhanh trực tiếp trên tin nhắn Telegram.
* **Input**: Chat ID của Manager gửi yêu cầu duyệt đơn `REQ-20260603-001`.
* **Expected Output**: Hệ thống trả về mã 200 OK, thiết lập trạng thái Soft Lock ảo cho cuộn `LOT-JB20-001` (`is_locked = true`), và bot gửi tin nhắn xác nhận duyệt thành công.
* **Rule Applied**: WF5 duyệt tạo Soft Lock, không trừ kho.
* **Audit Expected**: `MOBILE_APPROVAL_GRANTED` và `SOFT_LOCK_RECORDED` (is_locked = true) được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu cuộn phim chuyển trạng thái locked ảo và KTV nhận được Job Card.

### TC-MOB-03: Manager bấm Từ chối nhưng thiếu lý do (rejection_reason)
* **Scenario**: Quản lý bấm Từ chối đề xuất nhưng bỏ qua trường nhập lý do từ chối.
* **Input**: Yêu cầu từ chối đơn `REQ-20260603-001` với trường lý do rỗng.
* **Expected Output**: Hệ thống báo lỗi mã `REASON_REQUIRED` và hiển thị cảnh báo đỏ yêu cầu bắt buộc phải nhập lý do từ chối.
* **Rule Applied**: Quy tắc bắt buộc nhập lý do từ chối.
* **Audit Expected**: Không ghi nhận giao dịch từ chối trong log audit kho.
* **Pass/Fail Criteria**: Pass nếu nút bấm bị chặn và cảnh báo yêu cầu nhập lý do xuất hiện.

### TC-MOB-04: Manager mở PWA chỉnh sửa LOT nguồn cấp
* **Scenario**: Quản lý thay đổi cuộn phim được đề xuất ban đầu sang một cuộn phim khác trên PWA Screen 1.
* **Input**: Thay đổi nguồn từ `LOT-JB20-001` sang `LOT-JB20-002`, kèm lý do chỉnh sửa.
* **Expected Output**: Đề xuất phân bổ của đơn được cập nhật nguồn mới thành công trên hệ thống.
* **Rule Applied**: Cho phép thay đổi phương án trước khi duyệt.
* **Audit Expected**: `MOBILE_PROPOSAL_MODIFIED` ghi nhận sự thay đổi giá trị nguồn.
* **Pass/Fail Criteria**: Pass nếu thông tin nguồn trong request được lưu lại chính xác.

### TC-MOB-05: Manager chỉnh cut block nhưng thiếu lý do (change_reason)
* **Scenario**: Quản lý thay đổi kích thước Planned Cut Block trên PWA nhưng không nhập lý do thay đổi.
* **Input**: Sửa block từ `152x143` thành `152x150`, trường `change_reason` để trống.
* **Expected Output**: Nút gửi bị khóa, PWA báo lỗi `REASON_REQUIRED` yêu cầu Quản lý điền lý do thay đổi.
* **Rule Applied**: Quy tắc bắt buộc nhập lý do khi thay đổi kế hoạch.
* **Audit Expected**: Giao dịch thay đổi bị chặn.
* **Pass/Fail Criteria**: Pass nếu hệ thống chặn thành công hành động thiếu lý do.

### TC-MOB-06: Manager duyệt thành công tạo Soft Lock
* **Scenario**: Kiểm tra xem duyệt xong có đúng là chỉ tạo Soft Lock ảo chứ không trừ tồn kho vật lý.
* **Input**: Lệnh duyệt từ PWA cho đơn `REQ-20260603-001` dùng cuộn gốc `LOT-JB20-001`.
* **Expected Output**: Trạng thái cuộn phim `LOT-JB20-001` chuyển sang `is_locked = true`. Chiều dài còn lại giữ nguyên `12.5m`.
* **Rule Applied**: Approved = Soft Lock, không phải trừ kho.
* **Audit Expected**: Audit log ghi nhận thiết lập lock thành công.
* **Pass/Fail Criteria**: Pass nếu chiều dài cuộn gốc không bị giảm đi tại bước duyệt của Quản lý.

### TC-MOB-07: Manager action hết hạn token link
* **Scenario**: Quản lý click nút duyệt trên Telegram sau khi tin nhắn đã được gửi đi quá 30 phút.
* **Input**: Click nút duyệt của tin nhắn phê duyệt gửi từ 45 phút trước.
* **Expected Output**: Hệ thống báo lỗi `SOFT_LOCK_EXPIRED` hoặc `Token Expired`, yêu cầu Quản lý tải lại danh sách chờ duyệt mới để lấy link bảo mật mới.
* **Rule Applied**: Quy tắc hết hạn Token 30 phút.
* **Audit Expected**: Không thực thi thay đổi dữ liệu nào trong DB.
* **Pass/Fail Criteria**: Pass nếu hệ thống chặn và thông báo liên kết hết hạn thành công.

---

## II. Nhóm Kỹ thuật viên (Technician Test Cases)

### TC-MOB-08: KTV nhận Job Card trên Telegram
* **Scenario**: KTV nhận được tin nhắn Lệnh thi công chi tiết sau khi Quản lý duyệt đơn dán xe.
* **Input**: Đơn `REQ-20260603-001` chuyển sang trạng thái `APPROVED`.
* **Expected Output**: Telegram KTV nhận được tin nhắn mẫu `Technician Job Card Message` hiển thị đúng mã phim `JB20`, cuộn gốc cần lấy `LOT-JB20-001` và kệ cất phim `A-RACK-03`.
* **Rule Applied**: Tự động chuyển giao Job Card cho KTV.
* **Audit Expected**: `MOBILE_NOTIFICATION_SENT` được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu KTV nhận đúng nội dung lệnh cắt phim dán gom.

### TC-MOB-09: KTV mở form actual confirmation
* **Scenario**: KTV bấm nút xác nhận thực tế trên Telegram để mở biểu mẫu PWA Screen 3.
* **Input**: Click nút `Xác nhận thực tế` trên Telegram Bot.
* **Expected Output**: Trình duyệt điện thoại mở ra đúng form xác nhận thực tế của đơn hàng, điền sẵn các giá trị mặc định của planned block (`152x143`) và planned length (`1.43m`).
* **Rule Applied**: Deep Link bảo mật dẫn tới đúng màn hình PWA đơn hàng.
* **Audit Expected**: `MOBILE_TECH_CONFIRM_OPENED` được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu form tải lên thành công đúng thông số mặc định của request.

### TC-MOB-10: KTV submit thiếu actual_cut_block
* **Scenario**: KTV cố tình xóa trường `actual_cut_block` và bấm gửi xác nhận trên PWA.
* **Input**: Trường `actual_cut_block` để trống, các trường khác nhập đầy đủ.
* **Expected Output**: Hệ thống báo lỗi `ACTUAL_CUT_BLOCK_REQUIRED` và chặn giao dịch gửi.
* **Rule Applied**: Kích thước block cắt thực tế là bắt buộc nhập cho đơn dán nhóm.
* **Audit Expected**: Giao dịch cập nhật kho bị chặn.
* **Pass/Fail Criteria**: Pass nếu KTV bị chặn và hiển thị yêu cầu nhập block cắt thực tế.

### TC-MOB-11: KTV submit actual khác planned, thiếu exception_reason
* **Scenario**: KTV thay đổi kích thước block cắt thực tế lệch so với kế hoạch nhưng không nhập lý do ngoại lệ chênh lệch.
* **Input**: Nhập `actual_cut_block = 152x150` (kế hoạch là `152x143`) nhưng để trống trường lý do `exception_reason`.
* **Expected Output**: Hệ thống báo lỗi `REASON_REQUIRED` và chuyển trạng thái phiếu sang `EXCEPTION_HOLD` chờ Quản lý xử lý.
* **Rule Applied**: Thay đổi kích thước vượt dung sai bắt buộc nhập lý do ngoại lệ.
* **Audit Expected**: Ghi nhận trạng thái `EXCEPTION_HOLD` của phiếu dán.
* **Pass/Fail Criteria**: Pass nếu đơn hàng chuyển sang trạng thái giữ ngoại lệ thành công.

### TC-MOB-12: KTV submit có offcut mới nhưng thiếu storage_location
* **Scenario**: KTV xác nhận dán xe dở thừa mảnh phim lớn, chọn thu hồi mảnh dư đạt tiêu chuẩn nhưng không nhập kệ cất mảnh dư.
* **Input**: Tích chọn `has_new_offcut = true`, nhập chiều dài/chiều rộng mảnh dư mới, nhưng để trống trường vị trí kệ lưu trữ.
* **Expected Output**: PWA báo lỗi `OFFCUT_LOCATION_REQUIRED` và chặn hành động gửi cho đến khi KTV chọn vị trí kệ cất mảnh phim dở dang.
* **Rule Applied**: Thu hồi mảnh dư bắt buộc phải chọn vị trí lưu kho vật lý.
* **Audit Expected**: Giao dịch trừ/nhập kho bị chặn.
* **Pass/Fail Criteria**: Pass nếu hệ thống chặn thành công hành động thiếu vị trí kệ cất.

### TC-MOB-13: KTV submit scrap phát sinh nhưng thiếu scrap_area_m2
* **Scenario**: KTV khai báo có phát sinh phế liệu vụn nhưng không nhập diện tích scrap.
* **Input**: Tích chọn `has_scrap = true` nhưng để trống hoặc nhập diện tích scrap bằng 0.
* **Expected Output**: Hệ thống báo lỗi yêu cầu nhập diện tích phế liệu lớn hơn 0 mới được gửi.
* **Rule Applied**: Khai báo scrap bắt buộc nhập diện tích scrap cụ thể.
* **Audit Expected**: Giao dịch bị chặn.
* **Pass/Fail Criteria**: Pass nếu KTV bị chặn thành công.

### TC-MOB-14: KTV confirm thành công và trigger inventory transaction
* **Scenario**: KTV gửi xác nhận thực tế dán sườn + hậu xe Lexus RX350 đầy đủ thông số chính xác.
* **Input**: actual block `152x143`, actual length `1.43m`, offcut mới `1.52x1.20m` kệ `OFFCUT-RACK-C` chất lượng `EXCELLENT`, scrap `0.35m²`.
* **Expected Output**: Trừ tồn kho cuộn gốc `LOT-JB20-001` đi đúng `1.43m`, tạo mảnh dư mới mã `SUBLOT-JB20-004` (kích thước `1.52x1.20m`), ghi nhận phế liệu scrap `0.35m²`, và giải phóng Soft Lock thành công.
* **Rule Applied**: Trừ kho thực tế 3 chiều theo xác nhận của KTV ở WF6.
* **Audit Expected**: `ISSUE_FROM_LOT`, `CREATE_OFFCUT`, `RECORD_SCRAP`, `RELEASE_LOCK` ghi nhận.
* **Pass/Fail Criteria**: Pass nếu số dư cuộn gốc và mảnh dư mới được ghi nhận chính xác trong cơ sở dữ liệu.

### TC-MOB-15: Giao dịch thành công giải phóng Soft Lock
* **Scenario**: Kiểm tra việc giải phóng khóa ảo giữ chỗ của cuộn gốc sau khi KTV hoàn thành thi công thành công.
* **Input**: Giao dịch hoàn tất đơn `REQ-20260603-001` thành công.
* **Expected Output**: Cờ `is_locked` của cuộn gốc `LOT-JB20-001` tự động trả về `false` để đưa lượng phim còn lại về trạng thái khả dụng cho đơn khác.
* **Rule Applied**: Tự động giải phóng lock ảo sau khi giao dịch kho commit thành công.
* **Audit Expected**: `RELEASE_LOCK` được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu cờ `is_locked` của cuộn gốc được đưa về 0 thành công.

---

## III. Nhóm Bảo mật & Kiểm toán (Security & Audit Test Cases)

### TC-MOB-16: Telegram Chat ID không whitelist bấm duyệt
* **Scenario**: Một tài khoản Telegram lạ (chưa đăng ký) cố tình click nút duyệt phương án.
* **Input**: Yêu cầu duyệt từ một chat_id lạ gửi tới Backend API.
* **Expected Output**: API trả về lỗi `MOBILE_UNAUTHORIZED` (mã 403 Forbidden). Không thay đổi trạng thái phiếu và cuộn phim.
* **Rule Applied**: Chỉ tài khoản whitelist mới được duyệt.
* **Audit Expected**: Cảnh báo truy cập trái phép được ghi nhận vào nhật ký bảo mật.
* **Pass/Fail Criteria**: Pass nếu yêu cầu duyệt bị từ chối thẳng thừng bởi Backend.

### TC-MOB-17: KTV cố mở Job Card của KTV khác
* **Scenario**: KTV đăng nhập bằng tài khoản của mình nhưng cố tình đổi ID trong URL PWA để mở Job Card được phân công cho người khác.
* **Input**: Yêu cầu GET `/api/mobile/job-cards/JOB-20260603-999` từ tài khoản `KTV-003` (đơn này được giao cho `KTV-001`).
* **Expected Output**: Hệ thống báo lỗi `MOBILE_UNAUTHORIZED` và chặn quyền xem chi tiết lệnh thi công.
* **Rule Applied**: Phân quyền Job Card cho cá nhân được phân công.
* **Audit Expected**: Ghi nhận log chặn truy cập Job Card trái phép.
* **Pass/Fail Criteria**: Pass nếu KTV không thể xem Job Card của người khác.

### TC-MOB-18: Kiểm tra bot token không lưu trong repository
* **Scenario**: Rà soát an toàn mã nguồn, đảm bảo thông tin nhạy cảm của bot Telegram không bị đẩy lên repo Git công khai.
* **Input**: File `.env` chứa token và file `main.py` đọc cấu hình.
* **Expected Output**: Trong toàn bộ file code nguồn không tồn tại bất kỳ chuỗi Telegram Bot Token hay mật khẩu database dạng hardcode nào. Tất cả được gọi qua `os.getenv()`.
* **Rule Applied**: Không lưu trữ token nhạy cảm trong repository.
* **Audit Expected**: Đạt tiêu chuẩn kiểm toán bảo mật mã nguồn.
* **Pass/Fail Criteria**: Pass nếu không tìm thấy chuỗi token thực tế trong git history và các file spec.

### TC-MOB-19: Audit write fail thì rollback tồn kho ảo
* **Scenario**: Kiểm tra việc rollback dữ liệu tồn kho ảo nếu ghi nhận log kiểm toán bất biến thất bại.
* **Input**: Mô phỏng lỗi mất kết nối bảng audit log hoặc đứt kết nối ghi log khi KTV đang xác nhận thực tế.
* **Expected Output**: Toàn bộ thao tác trừ kho cuộn gốc và thu hồi mảnh dư mới của đơn hàng bị hủy bỏ (Rollback), đưa số lượng tồn kho ảo về nguyên vẹn như trước khi KTV gửi xác nhận để tránh lệch kho ảo.
* **Rule Applied**: Rollback khi audit ghi thất bại.
* **Audit Expected**: `MOBILE_AUDIT_FAILED` được ghi nhận vào system error log / fallback error queue / monitoring channel. Không ghi vào audit log chính nếu audit log chính đang lỗi.
* **Pass/Fail Criteria**: Pass nếu giao dịch kho bị rollback, tồn kho ảo quay về trạng thái trước giao dịch, và lỗi audit được đẩy sang kênh fallback để xử lý sau.

### TC-MOB-20: Thao tác di động bắt buộc ghi nhận actor/channel/timestamp
* **Scenario**: Kiểm tra cấu hình log kiểm toán di động có đầy đủ các trường thông tin đối soát bất biến không.
* **Input**: Một bản ghi audit log phát sinh từ thao tác duyệt của Manager trên Telegram.
* **Expected Output**: Bản ghi chứa đầy đủ thông tin: `actor_id = QL-002`, `actor_role = Manager`, `channel = TELEGRAM`, `action = MOBILE_APPROVAL_GRANTED`, `timestamp` thời gian thực và lý do (nếu có).
* **Rule Applied**: Quy định cấu trúc Audit Log di động bắt buộc.
* **Audit Expected**: Bản ghi audit log di động hợp lệ.
* **Pass/Fail Criteria**: Pass nếu tất cả 5 trường siêu dữ liệu trên đều xuất hiện đầy đủ trong log.

### TC-MOB-21: KTV bấm Start Job thành công
* **Scenario**: Kiểm tra hành động ghi nhận mốc bắt đầu thi công thực tế của KTV trên điện thoại.
* **Input**: Đơn hàng `REQ-20260603-001`, KTV click nút `Start Job`.
* **Expected Output**: Hệ thống ghi nhận đúng `started_at` thời gian thực, đổi trạng thái Job thành `IN_PROGRESS` và đổi trạng thái SLA sang `NOT_DUE` (hoặc `AT_RISK` tùy deadline).
* **Rule Applied**: WF7 quy trình ghi nhận tiến độ bắt đầu.
* **Audit Expected**: `JOB_STARTED` được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu trạng thái đổi sang `IN_PROGRESS` và lưu mốc thời gian thực.

### TC-MOB-22: KTV bấm Complete Job khi chưa nhập actual confirmation
* **Scenario**: KTV cố ý bấm hoàn thành dán xe nhưng bỏ qua việc điền form xác nhận số đo thực tế.
* **Input**: Job Card `JOB-20260603-001`, click nút `Complete Job` khi cờ `actual_confirmation_status = PENDING`.
* **Expected Output**: Ứng dụng PWA báo lỗi, không cho phép Complete và yêu cầu KTV nhập kích thước actual trước.
* **Rule Applied**: Complete chỉ được bấm sau khi nhập actual.
* **Audit Expected**: Không ghi nhận giao dịch hoàn thành và không đổi trạng thái Job.
* **Pass/Fail Criteria**: Pass nếu hệ thống chặn thành công hành động báo hoàn thành sớm.

### TC-MOB-23: KTV hoàn tất sau requested_delivery_at
* **Scenario**: Kiểm tra việc tính toán SLA trễ hạn nếu KTV báo hoàn thành muộn hơn giờ giao xe.
* **Input**: Deadline `requested_delivery_at = 15:00:00`, KTV gửi complete lúc `15:30:00`.
* **Expected Output**: Hệ thống chuyển trạng thái SLA giao xe thành `DELIVERED_LATE` và tự động tính toán `delay_minutes = 30`.
* **Rule Applied**: Bấm complete sau deadline đánh dấu DELIVERED_LATE.
* **Audit Expected**: `JOB_COMPLETED_BY_TECH` được ghi nhận kèm số phút trễ.
* **Pass/Fail Criteria**: Pass nếu hệ thống tính đúng SLA trễ hạn và lưu số phút trễ.

### TC-MOB-24: Quản lý nhận thông báo KTV bắt đầu thi công
* **Scenario**: Kiểm tra tin nhắn Telegram tự động báo cho Quản lý khi KTV bấm start.
* **Input**: KTV-003 click Start Job cho xe Lexus RX350.
* **Expected Output**: Quản lý nhận được tin nhắn mẫu `Manager Start Notification` trên Telegram chỉ ra đúng KTV-003 đang làm đơn REQ-20260603-001.
* **Rule Applied**: Tự động thông báo Manager khi KTV start.
* **Audit Expected**: `MANAGER_START_NOTIFIED` được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu tin nhắn đẩy về Telegram Quản lý khớp thời gian thực.

### TC-MOB-25: Quản lý nhận thông báo KTV hoàn tất thi công
* **Scenario**: Kiểm tra tin nhắn Telegram tự động báo cho Quản lý khi KTV bấm complete.
* **Input**: KTV-003 gửi Complete Job thành công sau khi dán xong xe Lexus RX350.
* **Expected Output**: Quản lý nhận được tin nhắn mẫu `Manager Completion Notification` hiển thị thời gian, thời lượng thi công (105 phút) và ID mảnh dư mới thu hồi.
* **Rule Applied**: Tự động thông báo Manager khi KTV hoàn thành.
* **Audit Expected**: `MANAGER_COMPLETION_NOTIFIED` được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu tin nhắn đẩy về hiển thị đúng thời lượng thi công và mảnh dư.

### TC-MOB-26: Dashboard tháng tính đúng số đơn/xe/completed/delayed
* **Scenario**: Kiểm tra tính chính xác của các chỉ số KPI tổng hợp trên báo cáo tháng di động.
* **Input**: Đọc danh sách lịch sử thi công trong `job_progress_log.csv`.
* **Expected Output**: Dashboard PWA Screen 5 hiển thị đúng: Tổng đơn = 10, Số Closed = 7, Số In Progress = 1, Số Delayed/Overdue = 2, và tỷ lệ SLA đúng hạn = 70%.
* **Rule Applied**: Tổng hợp và hiển thị monthly dashboard metrics.
* **Audit Expected**: `DASHBOARD_METRIC_UPDATED` được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu các chỉ số tính toán khớp chính xác 100% với dữ liệu nguồn CSV.

---

## IV. Nhóm Upload Ảnh & OCR (Image Intake & OCR Test Cases)

### TC-MOB-27: Upload ảnh hợp lệ thành công
* **Scenario**: Admin kho upload file ảnh phiếu yêu cầu định dạng JPG rõ nét lên hệ thống.
* **Input**: File ảnh `phieu_lexus_rx350.jpg` dung lượng 2.4MB.
* **Expected Output**: API trả về 201 Created, hiển thị preview ảnh thô trên PWA Screen 7, chất lượng ảnh đánh giá `GOOD` và chuyển sang bước `PROCESSING`.
* **Rule Applied**: Hỗ trợ định dạng và dung lượng ảnh hợp lệ.
* **Audit Expected**: `IMAGE_UPLOADED` và `IMAGE_VALIDATED` được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu file upload lên thành công và không bị báo lỗi.

### TC-MOB-28: Upload file sai định dạng
* **Scenario**: Admin kho chọn nhầm file Word `.docx` tải lên.
* **Input**: File `phieu_yeu_cau.docx` tải lên từ máy tính.
* **Expected Output**: Hệ thống từ chối ngay lập tức, trả lỗi `IMAGE_INVALID_FORMAT` và hiển thị thông báo lỗi yêu cầu Admin chọn lại file.
* **Rule Applied**: Kiểm tra định dạng file nghiêm ngặt.
* **Audit Expected**: Không lưu trữ file và không ghi log audit kho.
* **Pass/Fail Criteria**: Pass nếu hệ thống chặn thành công file không hợp lệ.

### TC-MOB-29: Upload ảnh quá mờ
* **Scenario**: Admin chụp ảnh bị nhòe nét chữ và tải lên.
* **Input**: File ảnh `lexus_camry_rung.png`.
* **Expected Output**: Hệ thống kiểm tra chất lượng ảnh thô phát hiện rung mờ, trả lỗi `IMAGE_QUALITY_FAILED` và yêu cầu Admin chụp lại ảnh rõ nét.
* **Rule Applied**: Đánh giá chất lượng ảnh thô trước khi OCR.
* **Audit Expected**: Ghi nhận trạng thái `IMAGE_QUALITY_FAILED` của file.
* **Pass/Fail Criteria**: Pass nếu hệ thống phát hiện ảnh mờ và yêu cầu re-upload thành công.

### TC-MOB-30: OCR đọc thiếu trường bắt buộc (Dealer)
* **Scenario**: OCR hoàn tất trích xuất nhưng không nhận diện được đại lý dán xe và Admin không chọn dealer gợi ý.
* **Input**: Bản nháp `ODR-20260604-004` có trường `dealer_name` để trống.
* **Expected Output**: Màn hình PWA bôi đỏ trường Đại lý, nút **[Xác nhận tạo Request]** bị vô hiệu hóa (disabled), bắt buộc Admin phải chọn Dealer thủ công từ dropdown mới được confirm.
* **Rule Applied**: Chặn đi tiếp nếu thiếu thông tin đại lý bắt buộc.
* **Audit Expected**: `IMAGE_OCR_COMPLETED` ở trạng thái `NEEDS_REVIEW`.
* **Pass/Fail Criteria**: Pass nếu nút bấm bị khóa cứng và cảnh báo thiếu trường bắt buộc xuất hiện.

### TC-MOB-31: OCR thiếu thời hạn giao xe (SLA)
* **Scenario**: Phiếu đại lý không ghi rõ giờ nhận xe khiến OCR trường `requested_delivery_at` bị rỗng.
* **Input**: Bản nháp OCR thiếu mốc thời gian giao xe yêu cầu.
* **Expected Output**: Hệ thống hiển thị cảnh báo màu vàng tại trường ngày giờ nhưng không khóa cứng nút confirm. Cho phép Admin gõ tay chọn giờ hoặc hệ thống tự động gán giờ mặc định 17:00 ngày tiếp theo.
* **Rule Applied**: Thiếu thời gian giao xe cảnh báo nhưng cho Admin nhập bổ sung.
* **Audit Expected**: Log ghi nhận cảnh báo thiếu SLA giao xe.
* **Pass/Fail Criteria**: Pass nếu hệ thống cho phép Admin tự bổ sung thủ công và không khóa cứng luồng.

### TC-MOB-32: Admin chỉnh sửa trường đọc sai và confirm tạo Request
* **Scenario**: OCR đọc sai số khung (VIN) do chữ viết tay xấu, Admin gõ sửa lại và confirm.
* **Input**: Sửa ký tự cuối của VIN từ `5` thành `6` và bấm **[Xác nhận]**.
* **Expected Output**: Hệ thống cập nhật số khung đúng, ghi audit thay đổi trường, tạo thành công Request ID chính thức và chuyển sang WF1.
* **Rule Applied**: Human checkpoint sửa lỗi và xác nhận tạo Request.
* **Audit Expected**: `OCR_FIELD_CORRECTED` và `REQUEST_CREATED_FROM_IMAGE` được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu Request tạo thành công chứa số khung đã được sửa.

### TC-MOB-33: Admin hủy bỏ bản nháp OCR draft
* **Scenario**: Admin phát hiện upload nhầm ảnh phiếu cũ của đơn hàng đã dán xong, bấm nút Hủy.
* **Input**: Click nút **[Reject OCR Draft]** hoặc **[Hủy bỏ]** trên PWA Screen 8.
* **Expected Output**: Hệ thống xóa dữ liệu bản nháp OCR, đổi trạng thái ảnh gốc sang `CANCELLED`.
* **Rule Applied**: Admin có quyền hủy bỏ bản nháp không hợp lệ.
* **Audit Expected**: `OCR_DRAFT_CANCELLED` được ghi nhận.
* **Pass/Fail Criteria**: Pass nếu dữ liệu nháp được dọn dẹp sạch sẽ khỏi bộ nhớ.

### TC-MOB-34: Chặn không cho tự động tạo Request chính thức khi chưa confirm
* **Scenario**: Kiểm tra việc bảo mật dữ liệu, cấm hệ thống tự ý nhảy thẳng sang WF1 khi chưa có con người duyệt dữ liệu OCR.
* **Input**: Tiến trình OCR vừa bóc tách xong bản nháp `ODR-20260604-001`.
* **Expected Output**: Không có bất kỳ Request ID chính thức (`REQ-...`) nào được tạo ra tự động trong DB. Trạng thái dừng lại ở `OCR_DRAFT_READY` hoặc `NEEDS_REVIEW`.
* **Rule Applied**: OCR chỉ tạo draft, không tự tạo Request chính thức.
* **Audit Expected**: Trạng thái đơn hàng dừng lại ở bước kiểm duyệt.
* **Pass/Fail Criteria**: Pass nếu Request ID chỉ được sinh ra sau sự kiện xác nhận của Admin.

### TC-MOB-35: Che mask thông tin khách hàng lẻ trên Telegram/PWA
* **Scenario**: Kiểm tra việc hiển thị thông tin bóc tách OCR trên các màn hình di động.
* **Input**: Dữ liệu khách hàng bóc tách được: Nguyễn Văn A, Số khung: JTJBK11A9G200155.
* **Expected Output**: Trên tin nhắn báo Telegram hoặc màn hình Review PWA, thông tin hiển thị phải là `Ngu*** Văn A`, `JTJBK11A9G******55` để bảo mật dữ liệu cá nhân.
* **Rule Applied**: Bảo mật thông tin khách hàng mặc định.
* **Audit Expected**: Tuân thủ chính sách che giấu dữ liệu.
* **Pass/Fail Criteria**: Pass nếu thông tin hiển thị ngoài đời thực được che mờ đúng quy chuẩn.


