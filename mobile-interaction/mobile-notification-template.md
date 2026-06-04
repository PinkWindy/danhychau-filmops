# Mobile Notification Templates

Tài liệu này đặc tả chi tiết 10 mẫu thông báo tương tác nhanh trên thiết bị di động (Telegram/PWA) phục vụ vận hành xưởng dán phim DYC. Mọi dữ liệu giả lập sử dụng thông tin của xe Lexus RX350.

---

## 1. Manager Approval Message (Thông báo chờ Quản lý duyệt)
* **Trigger**: Hệ thống tạo thành công `Material Allocation Proposal` ở **WF4**.
* **Recipient**: Quản lý Kho Kỹ thuật (`QL-002`)
* **Message Body**:
  ```text
  🔔 ĐỀ XUẤT PHÂN BỔ VẬT TƯ CHỜ DUYỆT (REQ-20260603-001)
  
  • Đại lý: DEALER_LEXUS_SG
  • Khách hàng: KH_MASKED_001
  • Dòng xe: LEXUS_RX350 (Số khung: VIN_MASKED_RX350_001)
  • Mã phim: JB20
  • Nhóm cắt: CG_RX350_SIDE_REAR (Planned Cut Block: 152x143 cm)
  
  👉 PHƯƠNG ÁN ĐỀ XUẤT:
  - Nguồn cấp: LOT GỐC (LOT-JB20-001)
  - Tồn kho khả dụng: 12.50m
  - planned_deduction_length_m: 1.43m
  ```
* **Buttons**:
  * `[✅ Duyệt Nhanh]` -> Gọi `POST /api/mobile/approvals/REQ-20260603-001/approve`
  * `[❌ Từ Chối]` -> Gọi `POST /api/mobile/approvals/REQ-20260603-001/reject`
  * `[✏️ Sửa phương án]` -> Deep Link mở PWA Screen 1
* **Audit Event**: `MOBILE_NOTIFICATION_SENT`

---

## 2. Manager Approval Success Message (Quản lý duyệt thành công)
* **Trigger**: Quản lý click duyệt phương án thành công, hệ thống đã thiết lập Soft Lock.
* **Recipient**: Quản lý Kho Kỹ thuật (`QL-002`)
* **Message Body**:
  ```text
  ✅ PHÊ DUYỆT THÀNH CÔNG (REQ-20260603-001)
  
  Hệ thống đã ghi nhận phê duyệt phương án cho xe LEXUS_RX350.
  • Nguồn giữ chỗ: LOT-JB20-001 (Khổ 1.52m)
  • Trạng thái: Soft Lock / Reserved đã kích hoạt (is_locked = true).
  • Hành động tiếp theo: Đã tự động gửi Job Card thi công cho KTV-003.
  ```
* **Buttons**: Không có (Tin nhắn xác nhận trạng thái).
* **API Called**: Không có.
* **Audit Event**: `MOBILE_APPROVAL_GRANTED`

---

## 3. Manager Rejection Message (Quản lý từ chối)
* **Trigger**: Quản lý click từ chối phương án đề xuất.
* **Recipient**: Quản lý Kho Kỹ thuật (`QL-002`) và Admin kho
* **Message Body**:
  ```text
  ❌ ĐỀ XUẤT PHÂN BỔ BỊ TỪ CHỐI (REQ-20260603-001)
  
  • Người thực hiện: QL-002
  • Lý do từ chối: Đề xuất ưu tiên dùng mảnh dư SUBLOT-JB20-001 để tối ưu hao hụt thay vì cắt cuộn gốc.
  • Hành động tiếp theo: Phiếu yêu cầu được đưa về trạng thái NORM_ASSIGNED để tính toán lại phương án phân bổ khác.
  ```
* **Buttons**: Không có.
* **API Called**: Không có.
* **Audit Event**: `MOBILE_APPROVAL_REJECTED`

---

## 4. Technician Job Card Message (Lệnh thi công gửi KTV)
* **Trigger**: Trạng thái phiếu dán chuyển sang `APPROVED` và Soft Lock được thiết lập thành công.
* **Recipient**: Kỹ thuật viên phụ trách (`KTV-003`)
* **Message Body**:
  ```text
  🛠️ LỆNH THI CÔNG (JOB CARD) - JOB-20260603-001
  
  • Mã phiếu: REQ-20260603-001
  • Dòng xe: LEXUS_RX350 (Số khung: VIN_MASKED_RX350_001)
  • Mã phim: JB20
  • Nguồn vật tư: LOT-JB20-001 (Soft Locked)
  • Vị trí kệ: A-RACK-03
  • Planned Cut Block: 152x143 cm
  • Layout dán gom: Kính hậu (60x130) + Sườn trước (92x130)
  ```
* **Buttons**:
  * `[📝 Xác Nhận Thực Tế (Hoàn Tất)]` -> Mở Deep Link PWA Screen 3
  * `[⚠️ Báo Lỗi Vật Tư]` -> Gọi `POST /api/mobile/exceptions/report` (Lý do: Phim lỗi chất lượng)
* **Audit Event**: `MOBILE_NOTIFICATION_SENT`

---

## 5. Technician Confirmation Success Message (KTV báo cáo hoàn thành)
* **Trigger**: KTV điền form và gửi xác nhận thực tế thành công trên PWA Screen 3.
* **Recipient**: Kỹ thuật viên (`KTV-003`) và Quản lý (`QL-002`)
* **Message Body**:
  ```text
  🎉 THI CÔNG HOÀN TẤT & TRỪ KHO THÀNH CÔNG (REQ-20260603-001)
  
  • Xe dán: LEXUS_RX350 (VIN: VIN_MASKED_RX350_001)
  • KTV thi công: KTV-003
  • Khối cắt thực tế: 152x143 cm (Dài: 1.43m)
  • Trừ tồn cuộn LOT-JB20-001: Trừ 1.43m (Còn lại: 11.07m)
  • Thu hồi mảnh dư mới: SUBLOT-JB20-004 (1.52x1.20m, kệ OFFCUT-RACK-C)
  • Phế liệu phát sinh (Scrap): 0.35m²
  • Trạng thái Soft Lock: Đã giải phóng tự động.
  ```
* **Buttons**: Không có.
* **API Called**: Không có.
* **Audit Event**: `MOBILE_TECH_CONFIRMED`

---

## 6. Inventory Discrepancy Alert (Cảnh báo sai lệch tồn kho vật lý)
* **Trigger**: KTV click báo cáo thiếu phim thực tế hoặc không tìm thấy mảnh dư trên kệ.
* **Recipient**: Quản lý Kho Kỹ thuật (`QL-002`) và Thủ kho
* **Message Body**:
  ```text
  🚨 CẢNH BÁO LỆCH TỒN KHO THỰC TẾ (REQ-20260603-001)
  
  • Người báo cáo: KTV-003
  • Vật tư báo lỗi: Mảnh dư SUBLOT-JB20-001
  • Vị trí kệ chỉ định: OFFCUT-RACK-A
  • Mô tả sự cố: Không tìm thấy mảnh dư này trên kệ lưu trữ thực tế.
  • Hành động tiếp theo: Đơn hàng tự động chuyển sang trạng thái EXCEPTION_HOLD để Quản lý chỉ định nguồn vật tư khác.
  ```
* **Buttons**:
  * `[✏️ Đổi Nguồn Vật Tư]` -> Deep Link mở PWA Screen 1
* **Audit Event**: `MOBILE_EXCEPTION_REPORTED`

---

## 7. Offcut Quality Warning (Cảnh báo chất lượng mảnh dư kém)
* **Trigger**: KTV xác nhận thực tế dán xe có phát sinh mảnh dư nhưng chọn chất lượng mảnh dư là `DEFECT` (Hỏng/Không đạt chuẩn tái sử dụng).
* **Recipient**: Quản lý Kho Kỹ thuật (`QL-002`)
* **Message Body**:
  ```text
  ⚠️ MẢNH DƯ KHÔNG ĐẠT TIÊU CHUẨN LƯU KHO (REQ-20260603-001)
  
  • KTV thi công: KTV-003
  • Kích thước phim thừa: 1.52m x 0.8m
  • Đánh giá chất lượng: DEFECT (Có vết xước/gập keo)
  • Kết luận: Hệ thống từ chối nhập kho mảnh dư này. Toàn bộ diện tích thừa (1.216m²) được ghi nhận trực tiếp vào phế liệu (Scrap) của đơn hàng.
  ```
* **Buttons**: Không có.
* **API Called**: Không có.
* **Audit Event**: `MOBILE_EXCEPTION_REPORTED`

---

## 8. Out Of Stock Alert (Cảnh báo hết kho ảo)
* **Trigger**: Hệ thống chạy thuật toán ở **WF4** phát hiện không còn cuộn gốc hoặc mảnh dư nào đủ kích thước planned.
* **Recipient**: Admin kho và Quản lý Kho Kỹ thuật (`QL-002`)
* **Message Body**:
  ```text
  🚨 HẾT SẠCH TỒN KHO KHẢ DỤNG ẢO (REQ-20260603-001)
  
  • Phim yêu cầu: JB20
  • Kích thước cần cắt: 1.52m x 1.43m
  • Trạng thái kho ảo: Không tìm thấy cuộn gốc hoạt động hoặc mảnh dư nào còn đủ chiều dài 1.43m.
  • Hành động tiếp theo: Đơn hàng chuyển sang EXCEPTION_HOLD. Vui lòng kiểm tra nhập kho cuộn phim mới hoặc đối soát kho vật lý.
  ```
* **Buttons**:
  * `[📦 Xem Tồn Kho Di Động]` -> Mở PWA Screen 5
* **Audit Event**: `MOBILE_NOTIFICATION_SENT`

---

## 9. Soft Lock Expired Alert (Khóa ảo giữ chỗ hết hạn)
* **Trigger**: Quá 30 phút kể từ lúc duyệt mà KTV chưa click bắt đầu thi công, Soft Lock tự động giải phóng.
* **Recipient**: Quản lý Kho Kỹ thuật (`QL-002`)
* **Message Body**:
  ```text
  ⏳ KHÓA ẢO GIỮ CHỖ HẾT HẠN (REQ-20260603-001)
  
  • Đơn hàng: REQ-20260603-001 (Lexus RX350)
  • Vật tư giữ chỗ: LOT-JB20-001
  • Lý do hết hạn: Quá 30 phút kể từ lúc duyệt phương án nhưng Kỹ thuật viên chưa thi công.
  • Trạng thái hiện tại: Đã giải phóng lock ảo. Cuộn phim LOT-JB20-001 đã quay lại trạng thái khả dụng cho đơn khác. Vui lòng duyệt lại để thiết lập khóa mới.
  ```
* **Buttons**:
  * `[✅ Duyệt Lại]` -> Gọi `POST /api/mobile/approvals/REQ-20260603-001/approve`
* **Audit Event**: `MOBILE_NOTIFICATION_SENT`

---

## 10. Yield Summary Daily Message (Báo cáo hiệu suất ngày)
* **Trigger**: Tự động gửi lúc 18:00 hàng ngày.
* **Recipient**: Kế toán kho (`KT-004`) và Quản lý vận hành
* **Message Body**:
  ```text
  📊 BÁO CÁO HIỆU SUẤT VẬT TƯ NGÀY (03/06/2026)
  
  • Số đơn dán xe đã hoàn tất: 8 đơn
  • Tổng diện tích phim tiêu thụ: 18.50 m²
  • Tổng diện tích phế liệu (Scrap): 1.25 m²
  • Tỷ lệ hao hụt ngày (Scrap Rate): 6.75%
  • Số mảnh dư thu hồi mới: 3 mảnh
  • Tỷ lệ tái sử dụng mảnh dư (Offcut Reuse Rate): 64.2%
  
  ⚠️ Cảnh báo kho: Cuộn phim LOT-JB20-001 còn lại 2.30m (Dưới hạn an toàn).
  ```
* **Buttons**:
  * `[📊 Mở Dashboard Yield]` -> Deep Link mở PWA Screen 5
* **Audit Event**: `MOBILE_NOTIFICATION_SENT`

---

## 11. Technician Start Confirmed (KTV xác nhận bắt đầu)
* **Trigger**: KTV click bắt đầu thi công thực tế trên điện thoại.
* **Recipient**: Kỹ thuật viên (`KTV-003`)
* **Message Body**:
  ```text
  ▶️ ĐÃ BẮT ĐẦU THI CÔNG (REQ-20260603-001)
  
  Hệ thống ghi nhận bắt đầu thi công dán xe lúc 14:30:00.
  • KTV phụ trách: KTV-003
  • Xe: LEXUS_RX350 (Số khung: VIN_MASKED_RX350_001)
  • Phim: JB20 (LOT-JB20-001)
  • Hạn giao xe: 17:00:00 (Thời gian còn lại: 150 phút)
  ```
* **Buttons**:
  * `[📝 Xác Nhận Thực Tế (Hoàn Tất)]` -> Mở Deep Link PWA Screen 3
* **Audit Event**: `JOB_STARTED`

---

## 12. Technician Completed Job (KTV xác nhận hoàn tất thi công)
* **Trigger**: KTV click báo cáo thi công hoàn tất trên điện thoại.
* **Recipient**: Kỹ thuật viên (`KTV-003`)
* **Message Body**:
  ```text
  🏁 ĐÃ THI CÔNG XONG (REQ-20260603-001)
  
  Hệ thống ghi nhận hoàn thành thi công lúc 16:15:00.
  • KTV phụ trách: KTV-003
  • Thời lượng thi công: 105 phút
  • Trạng thái SLA: Đúng hạn (DELIVERED_ON_TIME)
  • Hành động tiếp theo: Hệ thống chuyển tiếp dữ liệu sang WF6 để commit trừ kho ảo.
  ```
* **Buttons**: Không có.
* **Audit Event**: `JOB_COMPLETED_BY_TECH`

---

## 13. Manager Start Notification (Thông báo Manager khi KTV start)
* **Trigger**: KTV click bắt đầu thi công thực tế trên điện thoại.
* **Recipient**: Quản lý Kho Kỹ thuật (`QL-002`)
* **Message Body**:
  ```text
  📢 KTV BẮT ĐẦU LÀM XE (REQ-20260603-001)
  
  • KTV thực hiện: KTV-003
  • Xe dán: LEXUS_RX350 (Lexus Sài Gòn)
  • Vật tư: JB20 (LOT-JB20-001)
  • Bắt đầu lúc: 14:30:00 (Hạn giao xe: 17:00:00)
  ```
* **Buttons**:
  * `[👁️ Xem Tiến Độ]` -> Mở PWA Screen 6
* **Audit Event**: `MANAGER_START_NOTIFIED`

---

## 14. Manager Completion Notification (Thông báo Manager khi KTV complete)
* **Trigger**: KTV click báo cáo hoàn thành dán xe trên điện thoại.
* **Recipient**: Quản lý Kho Kỹ thuật (`QL-002`)
* **Message Body**:
  ```text
  📢 KTV HOÀN TẤT THI CÔNG (REQ-20260603-001)
  
  • KTV thực hiện: KTV-003
  • Xe dán: LEXUS_RX350
  • Hoàn thành lúc: 16:15:00 (Thời lượng: 105 phút)
  • Trạng thái SLA: Đúng hạn (DELIVERED_ON_TIME)
  • Mảnh dư thu hồi: SUBLOT-JB20-004 (1.52x1.20m, kệ OFFCUT-RACK-C)
  ```
* **Buttons**:
  * `[📊 Xem Chi Tiết Giao Dịch]` -> Mở PWA Screen 6
* **Audit Event**: `MANAGER_COMPLETION_NOTIFIED`

---

## 15. Delivery Delay Warning (Cảnh báo trễ deadline giao xe)
* **Trigger**: Còn 60 phút đến hạn giao xe nhưng Job Card chưa được start, hoặc đang IN_PROGRESS nhưng quá 120 phút.
* **Recipient**: Quản lý Kho Kỹ thuật (`QL-002`) và Admin
* **Message Body**:
  ```text
  ⚠️ CẢNH BÁO NGUY CƠ TRỄ DEADLINE (REQ-20260603-001)
  
  • Xe dán: LEXUS_RX350 (Đại lý: Lexus Sài Gòn)
  • Hạn giao xe: 17:00:00 (Chỉ còn lại 60 phút)
  • Trạng thái: ASSIGNED_TO_TECHNICIAN (Chưa bắt đầu thi công!)
  • Đề xuất hành động: Kiểm tra đốc thúc KTV-003 bắt đầu thi công ngay hoặc liên hệ đại lý dời giờ dán xe.
  ```
* **Buttons**:
  * `[📞 Liên Hệ KTV]` -> Thực hiện gọi điện thoại nhanh cho KTV-003
  * `[✏️ Đổi KTV Phụ Trách]` -> Mở PWA Screen 6
* **Audit Event**: `DELIVERY_DELAY_WARNING_SENT`

---

## 16. Monthly Operation Summary (Tóm tắt vận hành tháng gửi qua Bot)
* **Trigger**: Tự động gửi lúc 08:00 ngày đầu tiên của tháng sau.
* **Recipient**: Kế toán kho (`KT-004`) và Quản lý vận hành
* **Message Body**:
  ```text
  📊 BÁO CÁO VẬN HÀNH THÁNG (06/2026)
  
  • Tổng đơn dán xe: 48 đơn (Closed: 42 đơn)
  • Tỷ lệ đúng SLA giao xe: 91.6% (Mục tiêu: 90%)
  • Thời gian thi công trung bình: 110 phút/xe
  • Tỷ lệ tái sử dụng mảnh dư: 64.2% (Mục tiêu: 60%)
  • Tỷ lệ hao hụt scrap: 6.68% (Mục tiêu: <8%)
  • Top KTV hiệu suất cao: KTV-003 (18 xe hoàn thành)
  ```
* **Buttons**:
  * `[📊 Xem Dashboard Chi Tiết]` -> Deep Link mở PWA Screen 5
* **Audit Event**: `MOBILE_NOTIFICATION_SENT`

---

## 17. Image Upload Confirmed (Thông báo upload ảnh thành công)
* **Trigger**: Admin kho upload ảnh hoặc PDF phiếu yêu cầu dán xe thành công.
* **Recipient**: Admin kho (`AD-001`)
* **Message Body**:
  ```text
  📥 UPLOAD HÌNH ẢNH THÀNH CÔNG (IMG-20260604-001)
  
  • Tên file: phieu_lexus_rx350.jpg
  • Dung lượng: 2.4 MB
  • Trạng thái file: Hợp lệ (GOOD)
  • Hành động tiếp theo: Hệ thống đang bắt đầu tiến trình đọc dữ liệu OCR (OCR_PROCESSING). Vui lòng đợi trong giây lát.
  ```
* **Buttons**: Không có.
* **Audit Event**: `IMAGE_UPLOADED`

---

## 18. OCR Draft Ready For Review (Thông báo bản nháp OCR sẵn sàng review)
* **Trigger**: Agent 10 hoàn tất OCR bóc tách và tạo bản nháp thành công.
* **Recipient**: Admin kho (`AD-001`)
* **Message Body**:
  ```text
  🔍 BẢN NHÁP DỮ LIỆU OCR SẴN SÀNG REVIEW (ODR-20260604-001)
  
  • File ảnh gốc: IMG-20260604-001
  • Đại lý trích xuất: Lexus Trung Tâm Sài Gòn
  • Model xe: Lexus RX350
  • Trạng thái: NEEDS_REVIEW (Do điểm tin cậy số khung VIN thấp - 65%)
  • Hành động tiếp theo: Vui lòng kiểm tra đối chiếu trực quan và chỉnh sửa để tạo phiếu yêu cầu chính thức.
  ```
* **Buttons**:
  * `[✏️ Đối Soát & Duyệt Phiếu]` -> Mở Deep Link PWA Screen 8
* **Audit Event**: `IMAGE_OCR_COMPLETED`

---

## 19. Image Quality Failed Warning (Cảnh báo chất lượng ảnh kém)
* **Trigger**: Upload ảnh bị lỗi chất lượng (mờ, rung, thiếu góc) khiến OCR không thể thực hiện.
* **Recipient**: Admin kho (`AD-001`)
* **Message Body**:
  ```text
  ⚠️ ẢNH UPLOAD KHÔNG ĐẠT TIÊU CHUẨN OCR (IMG-20260604-002)
  
  • File ảnh gốc: lexus_camry_rung.png
  • Trạng thái lỗi: BLURRY (Ảnh chụp bị rung mờ nét chữ)
  • Kết luận: Tiến trình OCR bị hủy bỏ tự động do chất lượng ảnh quá kém.
  • Hành động tiếp theo: Vui lòng chụp lại ảnh rõ nét, đầy đủ góc và tải lên lại (Re-upload).
  ```
* **Buttons**:
  * `[📸 Tải Lên Lại]` -> Mở Deep Link PWA Screen 7
* **Audit Event**: `IMAGE_QUALITY_FAILED`


