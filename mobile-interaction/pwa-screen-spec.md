# PWA / Mobile Web Screen Specification

## 1. Purpose
Ứng dụng Web lũy tiến (**PWA - Progressive Web App**) đóng vai trò là giao diện chính để người dùng (Quản lý và KTV) nhập dữ liệu, điều chỉnh thông số chi tiết và thực thi các giao dịch kho trực tiếp trên điện thoại một cách thuận tiện nhất tại xưởng.

## 2. Screens
Đặc tả chi tiết cấu trúc dữ liệu và hành động của 5 màn hình PWA cốt lõi:

### Screen 1: Manager Approval Detail (Phê duyệt chi tiết của Quản lý)
* **Mục đích**: Hiển thị đầy đủ thông tin kỹ thuật của đề xuất phân bổ để Quản lý kiểm tra kỹ lưỡng và cho phép thay đổi nguồn cấp vật tư hoặc kích thước cắt dự kiến trước khi duyệt.
* **Các trường thông tin (Fields)**:
  * `request_id` (Mã yêu cầu dán xe - Chỉ đọc).
  * `dealer_name` (Tên đại lý - Chỉ đọc).
  * `customer_masked` (Tên khách hàng che mask - Chỉ đọc).
  * `vehicle_model` (Model xe dán - Chỉ đọc).
  * `vin_masked` (Số khung che mask - Chỉ đọc).
  * `job_items` (Hạng mục dán sườn/hậu... - Chỉ đọc).
  * `material_code` (Mã phim cách nhiệt/PPF - Chỉ đọc).
  * `cut_group_id` (Mã nhóm cắt nếu dán gom - Chỉ đọc).
  * `planned_cut_block` (Khối Planned block dự kiến - Cho phép chỉnh sửa).
  * `proposed_source_type` (Loại nguồn đề xuất: LOT hoặc OFFCUT - Cho phép sửa).
  * `proposed_source_id` (Mã LOT hoặc OFFCUT đề xuất - Cho phép sửa).
  * `offcut_match_score` (Điểm số khớp mảnh dư nếu dùng Offcut - Chỉ đọc).
  * `allocation_reason` (Lý do hệ thống đề xuất nguồn này - Chỉ đọc).
  * `change_reason` (Lý do thay đổi đề xuất - Bắt buộc nhập nếu sửa).
* **Hành động (Actions)**:
  * `Approve` (Phê duyệt phương án gốc hoặc phương án đã chỉnh sửa).
  * `Reject` (Từ chối đề xuất và yêu cầu hệ thống tính toán lại).
  * `Change Source` (Mở modal chọn LOT gốc khác hoặc OFFCUT khác khả dụng).
  * `Change Cut Block` (Nhập kích thước Planned Block mới).
* **Ràng buộc & Kiểm tra (Validation)**:
  * Nếu Quản lý thay đổi cuộn LOT, mảnh dư hoặc đổi kích thước block so với đề xuất của Agent, hệ thống **bắt buộc** hiển thị modal yêu cầu nhập lý do chỉnh sửa (`change_reason`). Nút gửi sẽ bị khóa cho đến khi lý do được điền (tối thiểu 10 ký tự).
  * Việc bấm Phê duyệt (Approve) thành công chỉ kích hoạt **Soft Lock** giữ chỗ trong kho ảo, tuyệt đối không được thực hiện trừ kho tại màn hình này.

---

### Screen 2: Technician Job Card (Màn hình Lệnh thi công của KTV)
* **Mục đích**: KTV theo dõi nhiệm vụ cắt dán phim được phân công, chỉ rõ vật tư và vị trí kệ để lấy cuộn gốc/mảnh dư.
* **Các trường thông tin (Fields)**:
  * `job_card_id` (Mã lệnh thi công - Chỉ đọc).
  * `request_id` (Mã yêu cầu dán xe liên quan - Chỉ đọc).
  * `source_type` (LOT hoặc OFFCUT nguồn - Chỉ đọc).
  * `source_id` (Mã vật tư cụ thể cần lấy - Chỉ đọc).
  * `storage_location` (Vị trí kệ chứa vật tư vật lý, ví dụ: `A-RACK-03` - Chỉ đọc).
  * `planned_cut_block` (Kích thước block phim cần cắt - Chỉ đọc).
  * `job_items` (Danh sách kính cần dán - Chỉ đọc).
  * `layout_note` (Sơ đồ gợi ý xếp layout cắt gom sườn+hậu hoặc PPF - Chỉ đọc).
* **Hành động (Actions)**:
  * `Start Job` (Bắt đầu thi công dán xe, đổi trạng thái phiếu sang thi công).
  * `Open Actual Confirmation` (Mở form xác nhận thực tế sau khi cắt xong).
  * `Report Material Issue` (Báo lỗi chất lượng cuộn phim lấy trên kệ).

---

### Screen 3: Technician Actual Confirmation (KTV xác nhận thực tế)
* **Mục đích**: Ghi nhận kích thước thực tế KTV đã cắt từ cuộn gốc/mảnh dư để hệ thống thực hiện trừ kho chính xác, đồng thời khai báo mảnh dư thu hồi và phế liệu.
* **Các trường thông tin (Fields)**:
  * `actual_cut_block` (Khối cắt thực tế, ví dụ: `152x143` - Bắt buộc).
  * `actual_width_m` (Chiều rộng thực tế cắt, đơn vị mét - Bắt buộc).
  * `actual_length_m` (Chiều dài thực tế cắt, đơn vị mét - Bắt buộc).
  * `actual_area_m2` (Diện tích cắt thực tế - Tự động tính).
  * `is_same_as_planned` (Checkbox: Khớp hoàn toàn với kế hoạch).
  * `exception_reason` (Lý do ngoại lệ chênh lệch cắt thực tế - Bắt buộc nếu lệch).
  * `has_new_offcut` (Checkbox: Có thu hồi mảnh dư dở dang đạt chuẩn không).
  * `offcut_width_m` (Chiều rộng mảnh dư mới - Bắt buộc nếu có mảnh dư).
  * `offcut_length_m` (Chiều dài mảnh dư mới - Bắt buộc nếu có mảnh dư).
  * `offcut_quality_status` (Chất lượng mảnh dư: EXCELLENT/NORMAL/DEFECT - Bắt buộc nếu có).
  * `offcut_storage_location` (Kệ cất mảnh dư, ví dụ: `OFFCUT-RACK-C` - Bắt buộc nếu có).
  * `has_scrap` (Checkbox: Có phát sinh phế liệu vụn không).
  * `scrap_area_m2` (Diện tích phế liệu, đơn vị m² - Bắt buộc nếu có scrap).
  * `technician_note` (Ghi chú của Kỹ thuật viên - Tùy chọn).
* **Hành động (Actions)**:
  * `Submit Confirmation` (Gửi xác nhận hoàn tất thi công).
* **Ràng buộc & Kiểm tra (Validation)**:
  * Các trường kích thước thực tế (`actual_cut_block`, `actual_width_m`, `actual_length_m`) là bắt buộc nhập.
  * Nếu kích thước thực tế khác so với kế hoạch (planned) vượt quá dung sai cho phép (tolerance), trường lý do ngoại lệ (`exception_reason`) bắt buộc phải điền.
  * Nếu tích chọn `has_new_offcut = true`, bắt buộc phải chọn vị trí kệ lưu kho (`offcut_storage_location` - dropdown list) và chất lượng mảnh dư (`offcut_quality_status` - dropdown list).
  * Nếu tích chọn `has_scrap = true`, bắt buộc phải điền diện tích scrap lớn hơn 0.
  * Khi bấm Submit thành công, PWA sẽ kích hoạt lệnh API gọi **WF6** để trừ tồn kho vật lý ảo và ghi Audit Log.

---

### Screen 4: Inventory Exception Screen (Màn hình Báo cáo ngoại lệ kho di động)
* **Mục đích**: Cho phép KTV hoặc thủ kho báo cáo nhanh các lỗi bất thường vật lý tại xưởng dán phim để quản trị viên xử lý.
* **Các trường hợp sử dụng (Cases)**:
  * Thiếu hụt vật tư phim cách nhiệt/PPF thực tế so với sổ sách ảo.
  * Phát hiện cuộn phim bị lỗi chất lượng (xước, hỏng keo) không thể thi công.
  * Không tìm thấy mảnh dư (Offcut) ở đúng kệ lưu kho được chỉ định.
  * Sai lệch thông tin số lượng tồn kho âm trong quá trình đối soát thực tế.
  * Sự cố quét mã vạch/barcode không khớp thông tin cuộn phim.

---

### Screen 5: Mobile Yield Dashboard (Bảng điều khiển hiệu suất di động)
* **Mục đích**: Cung cấp cho Quản lý và Kế toán kho cái nhìn nhanh về hiệu quả sử dụng vật tư của xưởng trong ngày.
* **Các chỉ số hiển thị (KPIs)**:
  * Danh sách các cuộn LOT gốc sắp hết (Remaining length dưới 2.0m).
  * Tổng số lượng mảnh dư (Offcuts) khả dụng đang lưu kho.
  * Danh sách mảnh dư tồn kho lâu ngày không sử dụng (Cảnh báo Dead Stock).
  * Tỷ lệ hao hụt trung bình trong ngày (Scrap Rate).
  * Tỷ lệ tái sử dụng mảnh dư dở dang (Offcut Reuse Rate).
  * Thống kê số lượng đơn dán xe đã hoàn tất thi công hôm nay.

---

### Screen 6: Technician Start/Complete Screen (Màn hình Ghi nhận Tiến độ thi công)
* **Mục đích**: KTV thao tác nhanh để ghi nhận thời gian bắt đầu thực tế và hoàn thành thi công vật lý cho xe dán.
* **Các trường thông tin (Fields)**:
  * `job_card_id` (Mã lệnh thi công - Chỉ đọc).
  * `request_id` (Mã yêu cầu dán xe - Chỉ đọc).
  * `technician_id` (Mã KTV - Chỉ đọc).
  * `requested_delivery_at` (Deadline giao xe cam kết - Chỉ đọc).
  * `started_at` (Thời điểm KTV bắt đầu thi công - Chỉ đọc sau khi click).
  * `completed_at` (Thời điểm KTV hoàn tất thi công - Chỉ đọc sau khi click).
  * `job_status` (Trạng thái thi công: ASSIGNED, IN_PROGRESS, COMPLETED_BY_TECH... - Chỉ đọc).
  * `delay_warning` (Cảnh báo trễ deadline - Chỉ hiển thị nếu sắp trễ/đã trễ).
* **Hành động (Actions)**:
  * `Start Job` (Bấm bắt đầu thi công thực tế).
  * `Pause Job` (Bấm tạm dừng thi công, chọn lý do ngoại lệ).
  * `Complete Job` (Bấm báo cáo hoàn thành dán xe).
  * `Report Delay` (Báo cáo nguy cơ chậm trễ).
  * `Open Actual Confirmation` (Mở form nhập thông số thực tế actual size/block ở Screen 3).
* **Ràng buộc & Kiểm tra (Validation)**:
  * Nút `Start Job` chỉ hiển thị và cho phép nhấn nếu Job Card đã được Quản lý phê duyệt ở WF5.
  * Nút `Complete Job` chỉ được bấm nếu KTV đã điền và gửi thành công biểu mẫu xác nhận kích thước thực tế (`actual_confirmation_status = COMPLETED`). Nếu chưa nhập actual, hệ thống khóa nút bấm và hiển thị thông báo yêu cầu nhập số liệu thực tế trước.
  * Nếu thời điểm bấm complete vượt quá thời gian giao xe yêu cầu (`completed_at > requested_delivery_at`), hệ thống tự động gắn cờ SLA giao xe là trễ hạn (`DELIVERED_LATE`).

---

### Screen 7: Image Upload Screen (Màn hình Tải ảnh phiếu yêu cầu)
* **Mục đích**: Cho phép Admin kho hoặc Điều phối tải lên hình ảnh chụp hoặc PDF của phiếu yêu cầu thi công dán phim từ các đại lý để hệ thống tiến hành OCR.
* **Các trường thông tin (Fields)**:
  * `image_file` (File chọn tải lên: JPG/JPEG/PNG/PDF - Bắt buộc).
  * `dealer_hint` (Dropdown gợi ý đại lý dán xe để tăng độ chính xác OCR - Tùy chọn).
  * `source_channel` (Kênh upload: PWA hoặc MOBILE - Tự động điền).
  * `note` (Ghi chú nhanh khi tải ảnh lên - Tùy chọn).
* **Hành động (Actions)**:
  * `Upload File` (Bấm chọn file từ thư viện hoặc chụp ảnh trực tiếp).
  * `Preview Image` (Hiển thị ảnh thu nhỏ sau khi chọn file).
  * `Run OCR` (Gửi ảnh sang Agent 10 bắt đầu bóc tách thông tin).
  * `Cancel` (Hủy bỏ và quay lại danh sách).
* **Ràng buộc & Kiểm tra (Validation)**:
  * Chỉ chấp nhận file định dạng JPG, JPEG, PNG, PDF có dung lượng tối đa 10MB.
  * Trả lỗi ngay tại màn hình nếu chọn file không đúng định dạng (`IMAGE_INVALID_FORMAT`) hoặc quá lớn (`IMAGE_FILE_TOO_LARGE`).
  * Nút `Run OCR` chỉ khả dụng sau khi file đã được tải lên thành công.

---

### Screen 8: OCR Review Screen (Màn hình Đối soát & Duyệt dữ liệu OCR)
* **Mục đích**: Hiển thị so sánh song song giữa hình ảnh phiếu yêu cầu gốc và các trường thông tin do AI bóc tách được bằng OCR, cho phép Admin kho chỉnh sửa sai sót và phê duyệt tạo phiếu chính thức.
* **Các trường thông tin (Fields)**:
  * `ocr_draft_id` (ID bản nháp OCR - Chỉ đọc).
  * `dealer_name` (Tên đại lý - Bắt buộc - Highlight nếu confidence < 80%).
  * `dealer_legal_name` (Tên pháp lý đại lý - Highlight nếu confidence < 80%).
  * `request_no` (Số phiếu yêu cầu đại lý - Bắt buộc - Highlight nếu confidence < 80%).
  * `request_date` (Ngày lập phiếu - Highlight nếu confidence < 80%).
  * `requested_delivery_at` (Giờ giao xe yêu cầu - Highlight nếu confidence < 80%).
  * `contract_no` (Số hợp đồng - Highlight nếu confidence < 80%).
  * `end_customer_name_masked` (Tên khách hàng che mask - Highlight nếu confidence < 80%).
  * `end_customer_address_masked` (Địa chỉ khách hàng che mask - Highlight nếu confidence < 80%).
  * `vehicle_model` (Model dòng xe - Bắt buộc - Highlight nếu confidence < 80%).
  * `vin_masked` (Số khung che mask - Highlight nếu confidence < 80%).
  * `job_items` (Mảng danh sách các hạng mục dán phim bóc tách được - Bắt buộc).
  * `item_code` (Mã phim - Bắt buộc).
  * `item_description` (Mô tả chi tiết hạng mục).
  * `note` (Ghi chú bổ sung từ đại lý).
  * `confidence_score` (Điểm tin cậy của từng trường - Hiển thị dạng phần trăm ngay cạnh trường).
* **Hành động (Actions)**:
  * `Confirm Create Request` (Xác nhận dữ liệu sạch, tạo Request chính thức để chuyển sang WF1).
  * `Edit Field` (Click trực tiếp vào trường để chỉnh sửa nội dung đọc sai).
  * `Reject OCR Draft` (Hủy bỏ bản nháp OCR, xóa dữ liệu nháp).
  * `Upload Again` (Quay lại màn hình upload để tải ảnh khác rõ nét hơn).
* **Ràng buộc & Kiểm tra (Validation)**:
  * Nút `Confirm Create Request` bị vô hiệu hóa nếu thiếu bất kỳ trường bắt buộc nào gồm: `dealer_name`, `vehicle_model`, hoặc danh sách `job_items` dán phim.
  * Nếu thiếu số khung (VIN), hệ thống tự động cảnh báo màu vàng và gán trạng thái `NEEDS_REVIEW` để Admin đối chiếu kỹ hơn trên ảnh phiếu gốc.
  * Nếu thời gian giao xe yêu cầu (`requested_delivery_at`) bị trống hoặc sai định dạng ngày giờ, hiển thị cảnh báo đỏ và yêu cầu Admin bổ sung thủ công trước khi xác nhận.

---

## 3. UX / UI Design Rules
* **Nút bấm lớn (Touch-Friendly Target)**: Thiết kế các nút hành động (Approve, Submit, Start) có chiều cao tối thiểu 48px, khoảng cách rộng rãi, tránh click nhầm trên thiết bị di động.
* **Màu sắc cảnh báo tương phản cao**: Sử dụng màu đỏ nhấn sắc sảo cho các nút quan trọng (Complete/Submit), màu xanh lá cho phê duyệt (Approve), màu vàng cam cho trạng thái Exception/Cảnh báo lỗi.
* **Tối giản hóa nhập văn bản (Minimal Keyboard Input)**: Hạn chế tối đa việc bắt KTV gõ chữ dài trên điện thoại. Hầu hết các trường như kệ lưu kho, chất lượng mảnh dư, mã phim được cấu hình dạng Dropdown lựa chọn hoặc chọn nhanh trên danh sách có sẵn. Trường văn bản tự do chỉ áp dụng cho lý do ngoại lệ (`exception_reason`) hoặc ghi chú (`technician_note`).
* **Che giấu thông tin bảo mật mặc định**: Mọi màn hình PWA đều hiển thị thông tin khách hàng lẻ và số khung xe dưới dạng masked (`KH_MASKED_***`, `VIN_MASKED_***`) để đảm bảo an toàn thông tin tại môi trường xưởng thi công đông người.
