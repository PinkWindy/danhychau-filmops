# Mobile API Contract

## 1. Purpose
Tài liệu này định nghĩa chi tiết các điểm kết nối API (Endpoints), cấu trúc dữ liệu gửi/nhận (Payload/Response), mã lỗi nghiệp vụ và hợp đồng kiểm toán (Audit Contract) phục vụ việc giao tiếp giữa Telegram Bot, ứng dụng PWA và hệ thống Backend quản lý kho DYC.

---

## 2. API Endpoints

### 2.1 POST /api/mobile/notifications/send-approval
* **Mục đích**: Được gọi tự động bởi hệ thống sau khi **WF4** đề xuất phương án phân bổ, nhằm đẩy thông tin phê duyệt về Telegram Bot của Quản lý.
* **Payload**:
  ```json
  {
    "request_id": "REQ-20260603-001",
    "manager_id": "QL-002",
    "proposal_id": "PROP-20260603-001",
    "dealer_name": "DEALER_LEXUS_SG",
    "customer_masked": "KH_MASKED_001",
    "vehicle_model": "LEXUS_RX350",
    "material_code": "JB20",
    "cut_group_id": "CG_RX350_SIDE_REAR",
    "planned_cut_block": "152x143",
    "proposed_source_type": "LOT",
    "proposed_source_id": "LOT-JB20-001",
    "deeplink_url": "https://pwa.dyc.vn/approvals/REQ-20260603-001?token=xyz123"
  }
  ```

### 2.2 POST /api/mobile/approvals/{request_id}/approve
* **Mục đích**: Ghi nhận hành động phê duyệt phương án cắt phim của Quản lý từ Telegram Bot hoặc PWA.
* **Payload**:
  ```json
  {
    "request_id": "REQ-20260603-001",
    "proposal_id": "PROP-20260603-001",
    "approved_by": "QL-002",
    "approval_channel": "TELEGRAM", // TELEGRAM hoặc PWA
    "approval_decision": "APPROVED",
    "approved_at": "2026-06-03T14:15:30Z"
  }
  ```
* **Response (Success - 200 OK)**:
  ```json
  {
    "approval_status": "SUCCESS",
    "soft_lock_status": "ACTIVE",
    "locked_source_id": "LOT-JB20-001",
    "next_step": "SEND_JOB_CARD_TO_TECHNICIAN"
  }
  ```
* **Quy tắc nghiệp vụ**:
  * Chỉ tài khoản có phân quyền Manager (`QL-002`) mới được gọi API này.
  * API này tự động kích hoạt trạng thái **Soft Lock** giữ chỗ vật tư, tuyệt đối không trừ tồn kho vật lý.

### 2.3 POST /api/mobile/approvals/{request_id}/reject
* **Mục đích**: Ghi nhận hành động từ chối phương án phân bổ đề xuất của Quản lý.
* **Payload**:
  ```json
  {
    "request_id": "REQ-20260603-001",
    "rejected_by": "QL-002",
    "rejection_reason": "Đại lý yêu cầu dán cuộn phim gốc mới, không dùng mảnh dư dở dang cũ.",
    "channel": "PWA"
  }
  ```
* **Ràng buộc validation**:
  * Trường lý do từ chối `rejection_reason` là **bắt buộc** nhập và không được để trống.

### 2.4 POST /api/mobile/approvals/{request_id}/modify
* **Mục đích**: Ghi nhận phương án phân bổ do Quản lý tùy chỉnh lại trên PWA (Đổi cuộn phim khác, đổi mảnh dư khác hoặc đổi kích thước block phim).
* **Payload**:
  ```json
  {
    "request_id": "REQ-20260603-001",
    "modified_by": "QL-002",
    "old_source_type": "OFFCUT",
    "old_source_id": "SUBLOT-JB20-001",
    "new_source_type": "LOT",
    "new_source_id": "LOT-JB20-001",
    "old_cut_block": "152x130",
    "new_cut_block": "152x143",
    "change_reason": "Chủ xe Lexus RX350 yêu cầu sử dụng cuộn gốc để đảm bảo chất lượng thẩm mỹ tốt nhất.",
    "channel": "PWA"
  }
  ```
* **Ràng buộc validation**:
  * Trường lý do thay đổi `change_reason` là **bắt buộc** nhập và phải chứa ít nhất 10 ký tự.

### 2.5 POST /api/mobile/job-cards/send
* **Mục đích**: Backend đẩy Lệnh thi công chi tiết (Job Card) về Telegram Bot của KTV sau khi Soft Lock hoàn tất ở **WF5**.

### 2.6 GET /api/mobile/job-cards/{job_card_id}
* **Mục đích**: KTV mở liên kết xem chi tiết sơ đồ layout dán gom xe và thông số Planned block.

### 2.7 POST /api/mobile/technician-confirmations
* **Mục đích**: Ghi nhận xác nhận kích thước thực tế và khai báo mảnh dư/scrap của Kỹ thuật viên sau thi công từ PWA.
* **Payload**:
  ```json
  {
    "request_id": "REQ-20260603-001",
    "job_card_id": "JOB-20260603-001",
    "technician_id": "KTV-003",
    "source_type": "LOT",
    "source_id": "LOT-JB20-001",
    "cut_group_id": "CG_RX350_SIDE_REAR",
    "planned_cut_block": "152x143",
    "actual_cut_block": "152x143",
    "actual_width_m": 1.52,
    "actual_length_m": 1.43,
    "actual_area_m2": 2.174,
    "exception_reason": "",
    "has_new_offcut": true,
    "new_offcut": {
      "width_m": 1.52,
      "length_m": 1.20,
      "quality_status": "EXCELLENT",
      "storage_location": "OFFCUT-RACK-C"
    },
    "has_scrap": true,
    "scrap_area_m2": 0.35,
    "technician_note": "Thi công kính sườn + hậu RX350 thành công, phát sinh mảnh dư 1.2m.",
    "confirmed_at": "2026-06-03T16:00:00Z"
  }
  ```
* **Ràng buộc validation**:
  * Trường `actual_cut_block` là **bắt buộc** nhập nếu đơn hàng có `cut_group_id`.
  * Các trường `actual_width_m` và `actual_length_m` bắt buộc phải lớn hơn 0.
  * Nếu kích thước thực tế khác so với kế hoạch vượt ngoài khoảng dung sai, trường lý do ngoại lệ `exception_reason` **bắt buộc** phải điền.
  * Nếu tích chọn có mảnh dư `has_new_offcut = true`, các trường con `new_offcut.quality_status` và `new_offcut.storage_location` **bắt buộc** phải điền.
  * Nếu tích chọn có phế liệu `has_scrap = true`, trường `scrap_area_m2` **bắt buộc** phải lớn hơn 0.

### 2.8 POST /api/mobile/inventory-transactions/commit
* **Mục đích**: Giao dịch nội bộ của Backend để commit giao dịch trừ tồn kho ảo và sinh chứng từ/nhật ký đối soát kho vật lý và giải phóng Soft Lock sau khi nhận xác nhận KTV hợp lệ.
* **Quy tắc nghiệp vụ**:
  * Chỉ được kích hoạt tự động sau khi có Technician Confirmation hợp lệ.
  * Ghi nhận giao dịch theo đúng schema kiểm toán kho.
  * Thực hiện **Release Soft Lock** (`is_locked = false`) để đưa phần còn lại của cuộn phim về trạng thái khả dụng.

### 2.9 POST /api/mobile/exceptions/report
* **Mục đích**: Báo cáo sự cố từ thiết bị di động (Thiếu phim, cuộn hỏng, lệch vị trí kệ).

### 2.10 POST /api/mobile/job-progress/{job_card_id}/start
* **Mục đích**: KTV báo bắt đầu thi công thực tế trên xe.
* **Payload**:
  ```json
  {
    "job_card_id": "JOB-20260603-001",
    "request_id": "REQ-20260603-001",
    "technician_id": "KTV-003",
    "started_at": "2026-06-03T14:30:00Z"
  }
  ```
* **Response**:
  ```json
  {
    "job_status": "IN_PROGRESS",
    "delivery_sla_status": "NOT_DUE"
  }
  ```
* **Business Rules & Validation**:
  * Chỉ Kỹ thuật viên (KTV) được phân công trong Job Card mới được Start (nếu sai trả lỗi `JOB_NOT_ASSIGNED_TO_TECHNICIAN`).
  * Chỉ Start khi `job_status` = `ASSIGNED_TO_TECHNICIAN` hoặc `READY_TO_START` (nếu sai trả lỗi `JOB_PROGRESS_INVALID_STATUS`).
  * Không cho Start nếu Soft Lock đã hết hạn (`SOFT_LOCK_EXPIRED`) hoặc chưa được phê duyệt (`APPROVAL_REQUIRED`) bởi Quản lý.
  * Nếu Job đã ở trạng thái `IN_PROGRESS` thì trả lỗi `JOB_ALREADY_STARTED`.

### 2.11 POST /api/mobile/job-progress/{job_card_id}/pause
* **Mục đích**: KTV báo tạm dừng thi công do sự cố vật tư hoặc kỹ thuật.
* **Payload**:
  ```json
  {
    "job_card_id": "JOB-20260603-001",
    "technician_id": "KTV-003",
    "pause_reason": "Lỗi chất lượng cuộn phim dở dang",
    "paused_at": "2026-06-03T15:00:00Z"
  }
  ```
* **Business Rules & Validation**:
  * Lý do tạm dừng `pause_reason` là **bắt buộc** (nếu không nhập trả lỗi `REASON_REQUIRED`).
  * Chỉ cho phép Pause khi `job_status` = `IN_PROGRESS` (nếu sai trả lỗi `JOB_NOT_IN_PROGRESS`).
  * Nếu tạm dừng do thiếu vật tư, hệ thống tự động gửi thông báo cảnh báo cho Quản lý và Admin kho.

### 2.12 POST /api/mobile/job-progress/{job_card_id}/complete
* **Mục đích**: KTV báo hoàn tất thi công. Yêu cầu đã điền actual confirmation hợp lệ.
* **Payload**:
  ```json
  {
    "job_card_id": "JOB-20260603-001",
    "technician_id": "KTV-003",
    "completed_at": "2026-06-03T16:15:00Z"
  }
  ```
* **Business Rules & Validation**:
  * Chỉ cho phép Complete khi `job_status` = `IN_PROGRESS` (nếu sai trả lỗi `JOB_NOT_IN_PROGRESS`).
  * Chỉ cho phép Complete khi `actual_confirmation_status` = `COMPLETED`.
  * Nếu `actual_confirmation_status != COMPLETED`, chặn hành động hoàn thành và trả lỗi `ACTUAL_CONFIRMATION_REQUIRED`.
  * Complete chỉ ghi nhận mốc thời gian `completed_at` thực tế và cập nhật trạng thái `COMPLETED_BY_TECHNICIAN`; việc trừ kho vẫn do phân hệ **WF6** xử lý sau đó.
  * Nếu `completed_at` > `requested_delivery_at` thì `delivery_sla_status = DELIVERED_LATE` và số phút trễ `delay_minutes` phải lớn hơn 0.

### 2.13 GET /api/mobile/dashboards/monthly-operations
* **Mục đích**: Lấy số liệu KPI và biểu đồ dashboard hiệu suất tháng.
* **Params**: `month=06-2026`, `dealer_id`, `technician_id`, `vehicle_model`, `material_code`, `job_status`, `sla_status`.

### 2.14 POST /api/mobile/image-intake/upload
* **Mục đích**: Admin kho tải file ảnh chụp hoặc PDF phiếu yêu cầu lên hệ thống.
* **Payload**: Form-Data gồm `image_file` (Binary), `dealer_hint` (Tùy chọn), `uploaded_by` (AD-001).
* **Response (Success - 201 Created)**:
  ```json
  {
    "image_file_id": "IMG-20260604-001",
    "original_file_name": "phieu_lexus_rx350.jpg",
    "file_size_mb": 2.4,
    "image_quality_status": "GOOD",
    "next_step": "TRIGGER_OCR_PROCESSING"
  }
  ```
* **Validation**:
  * Chỉ nhận JPG, JPEG, PNG, PDF. Nếu sai định dạng trả lỗi `IMAGE_INVALID_FORMAT`.
  * Dung lượng file tối đa 10MB. Nếu quá lớn trả lỗi `IMAGE_FILE_TOO_LARGE`.
  * Nếu chất lượng ảnh quá mờ hoặc thiếu sáng nghiêm trọng, trả lỗi `IMAGE_QUALITY_FAILED`.

### 2.15 POST /api/mobile/image-intake/{image_file_id}/run-ocr
* **Mục đích**: Yêu cầu Agent 10 thực hiện trích xuất dữ liệu OCR từ ảnh đã upload.
* **Response (Success - 200 OK)**:
  ```json
  {
    "ocr_draft_id": "ODR-20260604-001",
    "ocr_status": "COMPLETED",
    "review_status": "NEEDS_REVIEW",
    "suggested_next_action": "ADMIN_REVIEW_REQUIRED"
  }
  ```
* **Validation**:
  * Nếu OCR service gặp sự cố kỹ thuật, trả lỗi `OCR_PROCESSING_FAILED`.

### 2.16 GET /api/mobile/image-intake/{ocr_draft_id}/review
* **Mục đích**: Lấy thông tin chi tiết bản nháp OCR và so sánh điểm tin cậy từng trường để hiển thị lên PWA Screen 8.
* **Response**: Trả về cấu trúc JSON tương đương `sample-11-image-ocr-extraction-result.json`.

### 2.17 POST /api/mobile/image-intake/{ocr_draft_id}/confirm
* **Mục đích**: Admin kho xác nhận dữ liệu đã đối soát sạch để tạo Request chính thức.
* **Payload**: Chứa Object dữ liệu đã chỉnh sửa của `extracted_fields`.
* **Response (Success - 200 OK)**:
  ```json
  {
    "review_status": "CONFIRMED",
    "created_request_id": "REQ-20260604-001",
    "next_step": "HANDOFF_TO_WF1"
  }
  ```
* **Validation**:
  * Nếu thiếu thông tin bắt buộc (`dealer_name`, `vehicle_model`, `job_items`), chặn tạo phiếu và trả lỗi `OCR_REQUIRED_FIELD_MISSING`.
  * Chỉ có người dùng phân quyền Admin kho mới được gọi confirm.

### 2.18 POST /api/mobile/image-intake/{ocr_draft_id}/reject
* **Mục đích**: Admin kho từ chối và hủy bản nháp OCR do trùng lặp hoặc ảnh không hợp lệ.
* **Payload**: `{ "reason": "Ảnh phiếu trùng lặp với đơn REQ-001" }`
* **Response (Success - 200 OK)**:
  ```json
  {
    "ocr_draft_id": "ODR-20260604-001",
    "review_status": "CANCELLED"
  }
  ```

---

## 3. Business Error Codes
Hệ thống trả về các mã lỗi chuẩn khi phát hiện vi phạm nghiệp vụ di động:
* `MOBILE_UNAUTHORIZED`: Tài khoản thiết bị di động / Chat ID chưa được đăng ký hoặc không có quyền thao tác tác vụ này.
* `APPROVAL_REQUIRED`: Trạng thái phiếu yêu cầu chưa sẵn sàng để giao cho kỹ thuật viên thi công (Chưa được Manager phê duyệt).
* `REASON_REQUIRED`: Bắt buộc điền lý do chỉnh sửa phương án hoặc từ chối đề xuất.
* `ACTUAL_SIZE_REQUIRED`: Bắt buộc điền chiều dài/chiều rộng cắt phim thực tế của KTV.
* `ACTUAL_CUT_BLOCK_REQUIRED`: Bắt buộc điền kích thước khối cắt thực tế (actual_cut_block) cho đơn dán nhóm.
* `OFFCUT_LOCATION_REQUIRED`: Thiếu vị trí kệ cất mảnh dư mới thu hồi.
* `NEGATIVE_STOCK_BLOCKED`: Trừ kho thất bại do chiều dài thực tế vượt quá chiều dài khả dụng còn lại của cuộn gốc.
* `SOFT_LOCK_NOT_FOUND`: Cuộn phim/Mảnh dư được chọn hiện không ở trạng thái Soft Lock cho đơn này.
* `SOFT_LOCK_EXPIRED`: Trạng thái khóa ảo của cuộn/mảnh dư đã hết hạn hiệu lực (quá 30 phút).
* `AUDIT_WRITE_FAILED`: Ghi nhận Audit log kiểm toán thất bại, giao dịch kho bị rollback tự động để bảo toàn dữ liệu.
* `JOB_ALREADY_STARTED`: Lệnh thi công đã được bấm bắt đầu trước đó và hiện đang được tiến hành.
* `JOB_NOT_IN_PROGRESS`: Lệnh thi công hiện không ở trạng thái đang tiến hành để thực hiện tạm dừng hoặc hoàn thành.
* `ACTUAL_CONFIRMATION_REQUIRED`: Yêu cầu KTV phải hoàn tất xác nhận thông số kích thước thực tế trước khi kết thúc công việc.
* `JOB_NOT_ASSIGNED_TO_TECHNICIAN`: KTV không được quyền thao tác trên Job Card không do mình phụ trách.
* `JOB_PROGRESS_INVALID_STATUS`: Trạng thái hiện tại của Lệnh thi công không cho phép thực hiện thao tác bắt đầu dán xe.
* `IMAGE_INVALID_FORMAT`: Định dạng file tải lên không hợp lệ, hệ thống chỉ hỗ trợ JPG, JPEG, PNG, PDF.
* `IMAGE_FILE_TOO_LARGE`: Dung lượng file vượt quá giới hạn tối đa 10MB cho phép.
* `IMAGE_QUALITY_FAILED`: Chất lượng ảnh quá mờ, mất góc hoặc thiếu sáng không thể bọc tách dữ liệu OCR.
* `OCR_PROCESSING_FAILED`: Dịch vụ bóc tách OCR gặp sự cố hệ thống hoặc không phản hồi.
* `OCR_REVIEW_REQUIRED`: Bản nháp OCR có độ tin cậy thấp hoặc có trường nghi vấn bắt buộc phải kiểm tra thủ công.
* `OCR_REQUIRED_FIELD_MISSING`: Thiếu trường thông tin bắt buộc (Đại lý, Model xe hoặc Hạng mục thi công) để tạo Request chính thức.

---

## 4. Audit Contract
Mọi tương tác qua thiết bị di động (Telegram/PWA) khi gọi API gửi về Backend bắt buộc phải đính kèm đầy đủ siêu dữ liệu kiểm toán sau để ghi nhận vào nhật ký kiểm toán bất biến:
* `actor_id`: Mã định danh người thực hiện (Ví dụ: `QL-002`, `KTV-003`).
* `actor_role`: Vai trò người thực hiện (Manager, Technician, Admin, Accountant).
* `channel`: Kênh thao tác (TELEGRAM, PWA).
* `action`: Tên hành động thực hiện (Ví dụ: `IMAGE_UPLOADED`, `MOBILE_APPROVAL_GRANTED`, `MOBILE_TECH_CONFIRMED`).
* `entity_type`: Loại thực thể kiểm toán - **bắt buộc** (Enum: `IMAGE_FILE`, `OCR_DRAFT`, `REQUEST`, `JOB_CARD`, `INVENTORY_TRANSACTION`).
* `entity_id`: Mã ID của thực thể kiểm toán tương ứng với `entity_type` - **bắt buộc**.
* `request_id`: Mã phiếu yêu cầu dán xe liên quan (Bắt buộc nếu Request chính thức đã được tạo).
* `image_file_id`: Mã file ảnh (Bắt buộc với các action thuộc Image Intake trước khi tạo Request, ví dụ: `IMAGE_UPLOADED`, `IMAGE_VALIDATED`).
* `ocr_draft_id`: Mã nháp OCR (Bắt buộc với các action thuộc OCR Draft/Review, ví dụ: `IMAGE_OCR_COMPLETED`, `OCR_FIELD_CORRECTED`, `OCR_DRAFT_CONFIRMED`, `OCR_DRAFT_CANCELLED`).
* `before_value`: Giá trị hoặc trạng thái trước khi thay đổi (Ví dụ: `is_locked = false`).
* `after_value`: Giá trị hoặc trạng thái sau khi thay đổi (Ví dụ: `is_locked = true`).
* `reason`: Lý do thay đổi (nếu có chỉnh sửa).
* `timestamp`: Thời gian ghi nhận giao dịch (ISO 8601 UTC).
