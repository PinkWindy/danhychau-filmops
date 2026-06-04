# Module Name: Theo dõi thi công & SLA giao xe

## 1. Business Purpose
Mô-đun chức năng này quản lý, lưu vết tiến độ thi công thực tế từ lúc giao lệnh đến lúc KTV bắt đầu làm việc, báo hoàn thành và hệ thống đóng phiếu sau trừ kho thành công. Đồng thời, mô-đun chịu trách nhiệm tính toán SLA trễ hạn/đúng hạn và tổng hợp dữ liệu báo cáo tháng (Monthly Operations Dashboard) để tối ưu công suất xưởng DYC.

---

## 2. Target Users
* **Quản lý Kho Kỹ thuật**: Giám sát tiến trình thi công theo thời gian thực tại xưởng, xử lý các cảnh báo chậm trễ.
* **Kỹ thuật viên**: Nhận diện lệnh, thao tác bấm bắt đầu/hoàn tất thi công trên điện thoại.
* **Admin kho / Điều phối**: Theo dõi dòng chảy đơn hàng thô để phối hợp lịch hẹn giao xe.
* **Kế toán kho / Quản lý vận hành**: Sử dụng dashboard tổng hợp tháng để đối soát công suất KTV và hiệu quả vật tư.

---

## 3. Key Features (Tính năng chính)
* **Theo dõi thời hạn giao xe (SLA Tracking)**: Tiếp nhận dữ liệu thời hạn giao xe cam kết (`requested_delivery_at`) và so sánh liên tục với các mốc thời gian thực tế.
* **Ghi nhận mốc bắt đầu thi công**: Lưu vết thời điểm KTV bấm bắt đầu làm xe (`started_at`), chuyển trạng thái Job sang `IN_PROGRESS` và tự động gửi thông báo đẩy cho Quản lý.
* **Ghi nhận mốc hoàn tất kỹ thuật**: Lưu vết thời điểm KTV hoàn thành thi công vật lý (`completed_at`), chuyển trạng thái Job sang `COMPLETED_BY_TECHNICIAN` và gửi thông báo hoàn tất cho Quản lý.
* **Cảnh báo nguy cơ trễ hạn (Delay Alerts)**: Hệ thống tự động tính toán thời gian lùi và phát đi các cảnh báo trễ bắt đầu hoặc trễ hoàn thiện gửi trực tiếp đến Telegram Quản lý.
* **Tổng hợp Dashboard tháng (Monthly Ops Dashboard)**: Thu thập, gom nhóm dữ liệu thi công trong tháng để tính toán tổng đơn, tổng xe dán, tỷ lệ trễ hạn và xếp hạng KTV.
* **Hỗ trợ Bộ lọc nâng cao (Multi-filter query)**: Cho phép lọc dữ liệu dashboard theo Tháng, Đại lý gửi xe, Kỹ thuật viên phụ trách, Dòng xe ô tô, Mã phim cách nhiệt/PPF và trạng thái thi công.

---

## 4. Input & Output Data

### Input Data:
* `request_id` (Mã phiếu yêu cầu dán xe).
* `requested_delivery_at` (Thời gian giao xe cam kết).
* `job_card_id` (Mã lệnh thi công di động).
* `technician_id` (Mã KTV thi công).
* `assigned_at` (Thời điểm giao lệnh).
* `started_at` (Thời điểm KTV bắt đầu thi công).
* `completed_at` (Thời điểm KTV làm xong).
* `job_status` (Trạng thái lệnh thi công).

### Output Data:
* `job_progress_status` (Tiến độ: ASSIGNED, IN_PROGRESS, COMPLETED_BY_TECH, CLOSED).
* `delivery_sla_status` (SLA: NOT_DUE, AT_RISK, DELIVERED_ON_TIME, DELIVERED_LATE, OVERDUE).
* `monthly_dashboard_metrics` (Số liệu tổng hợp KPI và các biểu đồ cho Dashboard tháng).
* `delay_alerts` (Các cảnh báo trễ deadline).
* `manager_notifications` (Tin nhắn thông báo tiến độ gửi Quản lý).

---

## 5. Business Rules Applied (Quy tắc Nghiệp vụ Áp dụng)
* **Điều kiện bắt đầu Job**: KTV chỉ được phép bấm bắt đầu thi công (`started_at`) khi phiếu yêu cầu tương ứng đang ở trạng thái `APPROVED` (đã được Quản lý duyệt phương án và Soft Lock cuộn gốc/mảnh dư thành công).
* **Điều kiện hoàn tất Job**: Lệnh thi công chỉ được chuyển sang trạng thái `COMPLETED_BY_TECHNICIAN` khi KTV đã hoàn thành và gửi biểu mẫu xác nhận kích thước thực tế (`actual_confirmation_status = COMPLETED`) hợp lệ trên PWA.
* **Quy tắc đóng phiếu cuối (Closed)**: Phiếu yêu cầu dán xe chỉ được chuyển sang trạng thái cuối cùng là `CLOSED` sau khi **WF6** thực thi giao dịch trừ kho ảo, thu hồi mảnh dư mới và ghi nhận audit log thành công trong DB.
* **Quy tắc tính trễ hạn**: Nếu thời điểm `completed_at` lớn hơn `requested_delivery_at` dù chỉ 1 phút, hệ thống bắt buộc phải tính trạng thái SLA là trễ hạn (`DELIVERED_LATE`) và ghi nhận số phút trễ (`delay_minutes`).

---

## 6. Related Components
* **Related Agents**:
  * [07-approval-handoff-agent.md](file:///d:/Quản lý vận hành DYC/agents/07-approval-handoff-agent.md) (Giao Job Card).
  * [08-inventory-yield-analytics-agent.md](file:///d:/Quản lý vận hành DYC/agents/08-inventory-yield-analytics-agent.md) (Trừ kho thực tế).
  * [09-job-progress-delivery-monitoring-agent.md](file:///d:/Quản lý vận hành DYC/agents/09-job-progress-delivery-monitoring-agent.md) (Theo dõi progress và SLA).
* **Related Workflows**:
  * [WF5-phe-duyet-giao-ky-thuat-vien.md](file:///d:/Quản lý vận hành DYC/workflows/WF5-phe-duyet-giao-ky-thuat-vien.md).
  * [WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md](file:///d:/Quản lý vận hành DYC/workflows/WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md).
  * [WF7-theo-doi-tien-do-thi-cong-va-giao-xe.md](file:///d:/Quản lý vận hành DYC/workflows/WF7-theo-doi-tien-do-thi-cong-va-giao-xe.md) (Quy trình tiến độ thi công).

---

## 7. Acceptance Criteria (Tiêu chí Nghiệm thu Module)
1. Ghi nhận chính xác `assigned_at` ngay khi Quản lý nhấn duyệt phương án và tạo Job Card ở WF5.
2. Ghi nhận đúng `started_at` thời gian thực và chuyển trạng thái đơn sang `IN_PROGRESS` khi KTV click nút Start Job trên điện thoại.
3. Kích hoạt thông báo Telegram đến Quản lý ngay khi Job chuyển sang `IN_PROGRESS`.
4. Ngăn chặn thành công hành động báo hoàn tất (Complete Job) nếu KTV chưa nhập form xác nhận kích thước thực tế (actual size/block).
5. Ghi nhận đúng `completed_at` thời gian thực và chuyển trạng thái đơn sang `COMPLETED_BY_TECHNICIAN` sau khi KTV hoàn thành form actual.
6. Tính toán chuẩn số phút trễ hạn `delay_minutes = completed_at - requested_delivery_at` nếu đơn hàng bị hoàn thành muộn hơn giờ hẹn.
7. Chuyển trạng thái phiếu dán sang `CLOSED` tự động và chỉ sau khi WF6 hoàn tất trừ kho ảo thành công.
8. Dashboard tháng kết xuất đúng tổng số đơn dán xe, tổng số xe, tỷ lệ đúng hạn/trễ hạn và xếp hạng KTV hiệu quả nhất mà không bị trùng lặp số liệu.
