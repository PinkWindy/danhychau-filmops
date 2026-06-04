# Workflow Name: WF7 - Theo dõi tiến độ thi công và thời gian giao xe

## 1. Business Purpose
Quy trình này theo dõi tiến độ thi công thực tế tại xưởng dán phim kể từ thời điểm giao Job Card, ghi nhận các mốc bắt đầu/hoàn tất thi công, kiểm soát SLA giao xe cam kết từ phiếu đại lý Lexus, và tự động đồng bộ dữ liệu hiệu suất để cập nhật Dashboard tháng.

## 2. Trigger
**WF5** hoàn thành phê duyệt đề xuất phân bổ, tự động tạo lệnh thi công (Job Card) và thiết lập khóa ảo (Soft Lock) thành công.

## 3. Actors
* **Kỹ thuật viên (KTV)**: Người nhận xe, bấm bắt đầu/hoàn thành thi công, thực hiện cắt dán phim và báo cáo thông số thực tế.
* **Quản lý Kho Kỹ thuật**: Người giám sát tiến độ thực tế, nhận thông tin SLA, xử lý cảnh báo trễ deadline.
* **Admin kho / Điều phối**: Nhận tin trạng thái đơn để cập nhật lịch làm việc với đại lý.
* **Kế toán kho / Quản lý vận hành**: Đọc Dashboard báo cáo tháng để thống kê công suất xưởng.

## 4. Agents Involved
* **Approval & Handoff Agent (`AG-07`)**: Giao Job Card cho KTV.
* **Job Progress & Delivery Monitoring Agent (`AG-09`)**: Nhận và theo dõi tiến trình Job, đối soát thời gian giao xe, tính toán SLA và phát cảnh báo trễ hạn.
* **Inventory & Yield Analytics Agent (`AG-08`)**: Thực thi trừ kho ảo và nhập mảnh dư mới ở WF6 sau khi KTV báo hoàn tất thi công.

## 5. Input & Output

### Input:
* `request_id` (Mã phiếu dán xe).
* `job_card_id` (Mã lệnh thi công).
* `technician_id` (Mã KTV thi công).
* `requested_delivery_at` (Giờ giao xe cam kết).
* `planned_cut_block` (Kích thước planned block).
* `source_id` (LOT/OFFCUT giữ chỗ).

### Output:
* `started_at` (Thời điểm bắt đầu thi công).
* `completed_at` (Thời điểm hoàn thành thi công).
* `job_status` (Trạng thái lệnh thi công di động).
* `delivery_sla_status` (Trạng thái SLA giao xe).
* `manager_notification` (Thông báo tiến độ gửi Telegram Quản lý).
* `dashboard_metrics` (Số liệu hiệu suất đẩy về dashboard tháng).

---

## 6. Main Flow (Luồng xử lý chính)
1. **WF5** phê duyệt phương án phân bổ và giao Lệnh thi công (Job Card) cho KTV phụ trách.
2. Hệ thống tự động ghi nhận thời điểm giao lệnh (`assigned_at`).
3. Telegram Bot gửi Lệnh thi công chi tiết kèm link Deep PWA đến thiết bị di động của KTV.
4. KTV nhận xe thi công và click nút **[Bắt Đầu Thi Công]** trên ứng dụng di động.
5. Hệ thống ghi nhận mốc thời gian bắt đầu thực tế (`started_at`), đồng thời chuyển trạng thái đơn sang `IN_PROGRESS`.
6. Hệ thống tự động gửi thông báo đến Telegram của Quản lý: *"KTV-003 đã bắt đầu thi công đơn REQ-20260603-001 (Lexus RX350) lúc [Thời gian]"*.
7. KTV thực hiện cắt phim, dán xe hoàn tất và nhập biểu mẫu xác nhận kích thước thực tế (actual size/block, mảnh dư thu hồi, scrap) trên PWA Screen 3.
8. KTV click nút **[Đã Thi Công Xong]** trên ứng dụng di động.
9. Hệ thống ghi nhận mốc thời gian hoàn thành thực tế (`completed_at`), chuyển trạng thái Job sang `COMPLETED_BY_TECHNICIAN`.
10. Hệ thống tự động gửi thông báo hoàn tất đến Telegram của Quản lý: *"KTV-003 đã thi công xong đơn REQ-20260603-001. Thời lượng: 105 phút. Trạng thái SLA: Đúng hạn"*.
11. Hệ thống tự động chuyển tiếp dữ liệu xác nhận thực tế sang **WF6** để commit giao dịch trừ kho ảo, giải phóng Soft Lock và ghi audit log.
12. Sau khi giao dịch kho thành công ở WF6, trạng thái đơn dán xe tự động chuyển sang `CLOSED`.
13. Số liệu hiệu suất vận hành (số đơn, số xe, SLA đúng hạn, hiệu suất KTV) được tự động cập nhật vào Dashboard tháng.

---

## 7. Alternative Flows (Luồng rẽ nhánh)

### AF-01: KTV tạm dừng thi công vì thiếu vật tư/sự cố kỹ thuật
- *Bước 4*: KTV bấm bắt đầu thi công.
- *Bước rẽ*: Trong quá trình làm xe, KTV phát hiện cuộn phim bị lỗi hoặc thiếu phim thực tế, KTV bấm nút **[Tạm dừng thi công]** (Pause) trên điện thoại và chọn lý do (Thiếu phim/Lỗi phim).
- *Xử lý*: Hệ thống ghi nhận trạng thái Job là `PAUSED`, lưu vết thời gian tạm dừng và gửi cảnh báo khẩn cấp đến Telegram Quản lý.

### AF-02: KTV hoàn tất thi công nhưng chưa nhập form actual confirmation
- *Bước 8*: KTV click nút "Đã thi công xong".
- *Bước rẽ*: Hệ thống phát hiện trường `actual_confirmation_status` của KTV vẫn là `PENDING` (chưa điền form).
- *Xử lý*: Hệ thống không được chuyển trạng thái sang `COMPLETED_BY_TECHNICIAN` mà chuyển Job sang trạng thái `ACTUAL_CONFIRMATION_REQUIRED` (hoặc giữ Job ở `IN_PROGRESS`), chặn hành động hoàn thành, và hiển thị yêu cầu KTV nhập đầy đủ thông số thực tế cắt dán. Trạng thái `COMPLETED_BY_TECHNICIAN` chỉ được gán khi `actual_confirmation_status` chuyển sang `COMPLETED`.

### AF-03: Quản lý thay đổi Kỹ thuật viên phụ trách giữa chừng
- *Bước 5*: Đơn hàng đang ở trạng thái `IN_PROGRESS` do KTV-001 phụ trách.
- *Bước rẽ*: Do KTV-001 có ca khẩn cấp hoặc xin nghỉ đột xuất, Quản lý mở PWA và thực hiện chỉ định KTV-003 thay thế.
- *Xử lý*: Hệ thống cập nhật `technician_id = KTV-003` trong Job Card, ghi audit log thay đổi KTV và gửi lại Job Card sang Telegram của KTV-003. Thời gian `started_at` cũ được giữ nguyên hoặc reset tùy quyết định của Quản lý.

### AF-04: Đơn hàng bị hủy do xe chưa bàn giao đến xưởng
- *Bước 3*: Job Card đã giao cho KTV ở trạng thái `ASSIGNED_TO_TECHNICIAN`.
- *Bước rẽ*: Đại lý báo hủy lịch dán xe hoặc lùi lịch sang tuần sau.
- *Xử lý*: Admin kho thực hiện hủy đơn trên hệ thống, chuyển trạng thái Job sang `CANCELLED`, tự động giải phóng Soft Lock vật tư liên quan và ghi audit log hủy đơn.

---

## 8. Exception Flows (Luồng ngoại lệ)

### EF-01: Job quá hạn giao xe nhưng chưa bắt đầu thi công
- *Điều kiện*: Thời gian hiện tại vượt quá `requested_delivery_at` nhưng `job_status` vẫn là `ASSIGNED_TO_TECHNICIAN` (chưa start).
- *Xử lý*: Hệ thống tự động chuyển trạng thái SLA của Job sang `OVERDUE`, phát cảnh báo đỏ nguy cấp đến Telegram Quản lý và Admin kho để xử lý điều phối khẩn cấp.

### EF-02: Job quá hạn giao xe nhưng đang thi công dở dang
- *Điều kiện*: Thời gian hiện tại vượt quá `requested_delivery_at` nhưng `job_status` đang là `IN_PROGRESS` (chưa bấm complete).
- *Xử lý*: Hệ thống tự động chuyển trạng thái SLA sang `OVERDUE`, tính toán số phút trễ hạn lũy tiến và gửi thông báo cảnh báo tiến độ trễ đến Quản lý.

### EF-03: KTV cố tình thao tác trên Job Card của người khác
- *Điều kiện*: KTV bấm Start/Complete trên link PWA của một Job Card không được chỉ định cho mình.
- *Xử lý*: Hệ thống đối chiếu mã `technician_id` trong Job Card với ID thiết bị/chat ID thực tế. Từ chối thực thi thao tác và trả về mã lỗi `MOBILE_UNAUTHORIZED`.

### EF-04: Mất kết nối mạng/thiết bị di động khi KTV đang thi công dán xe
- *Điều kiện*: Thiết bị di động của KTV bị mất sóng/hết pin trong quá trình làm xe.
- *Xử lý*: KTV tiến hành dán xe vật lý bình thường. Sau khi có kết nối trở lại, KTV thực hiện bấm Start (lùi thời gian thực tế nếu cần) và bấm Complete, hệ thống ghi nhận và cập nhật bình thường. Nếu trễ do lỗi hệ thống mạng, KTV nhập lý do vào ghi chú.

---

## 9. Human Checkpoints (Điểm kiểm soát con người)
* **KTV bắt đầu Job**: Bấm Start Job thực tế để ghi nhận mốc bắt đầu.
* **KTV hoàn tất Job**: Bấm Complete Job và điền thông số thực tế để kích hoạt trừ kho ảo.
* **Quản lý xử lý cảnh báo trễ (SLA Action)**: Can thiệp điều phối khi nhận tin nhắn cảnh báo đỏ từ Telegram Bot.

## 10. Rules Applied
* [Mobile Security & Audit Rules](file:///d:/Quản lý vận hành DYC/mobile-interaction/mobile-security-audit-rules.md)
* [R7-approval-rules.md](file:///d:/Quản lý vận hành DYC/rules/R7-approval-rules.md)
* [R8-inventory-deduction-rules.md](file:///d:/Quản lý vận hành DYC/rules/R8-inventory-deduction-rules.md)
* [R9-audit-log-rules.md](file:///d:/Quản lý vận hành DYC/rules/R9-audit-log-rules.md)

## 11. Audit Events
* `JOB_ASSIGNED`
* `JOB_STARTED`
* `JOB_PAUSED`
* `JOB_COMPLETED_BY_TECH`
* `DELIVERY_DELAY_WARNING_SENT`
* `MANAGER_START_NOTIFIED`
* `MANAGER_COMPLETION_NOTIFIED`
* `JOB_CLOSED_AFTER_INVENTORY_COMMIT`

## 12. Completion Criteria
* Job Card ghi nhận đầy đủ mốc `started_at` và `completed_at`.
* Quản lý nhận được tin nhắn thông báo hoàn tất thi công trên Telegram.
* **WF6** thực thi thành công giao dịch trừ tồn kho ảo, giải phóng Soft Lock và ghi audit log.
* Số liệu dashboard tháng được cập nhật chính xác.

## 13. Status Flow (Luồng Trạng Thái)
* **Luồng chuẩn và luồng rẽ nhánh**:
  * `ASSIGNED_TO_TECHNICIAN` ➡️ `IN_PROGRESS` ➡️ `ACTUAL_CONFIRMATION_REQUIRED` (nếu KTV bấm Complete nhưng thiếu actual)
  * `IN_PROGRESS` ➡️ `COMPLETED_BY_TECHNICIAN` (khi `actual_confirmation_status` = `COMPLETED`)
  * `COMPLETED_BY_TECHNICIAN` ➡️ `CLOSED` (nếu WF6 inventory commit thành công)
  * `COMPLETED_BY_TECHNICIAN` ➡️ `EXCEPTION_HOLD` (nếu WF6 commit kho hoặc audit log thất bại)
* **Luồng trễ hạn / ngoại lệ bổ sung**:
  * `ASSIGNED_TO_TECHNICIAN` ➡️ `DELAYED` (Nếu quá deadline mà chưa start)
  * `IN_PROGRESS` ➡️ `PAUSED` (KTV tạm dừng thi công)
  * `IN_PROGRESS` ➡️ `DELAYED` (Quá deadline dán xe khi đang làm)
