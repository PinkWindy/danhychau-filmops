# KỊCH BẢN KIỂM THỬ CHI TIẾT (TEST CASES SPECIFICATION)
*Lập bởi: Đội kiểm soát chất lượng tích hợp (QA/QC)*  
*Hệ thống kiểm thử: DYC Film Warehouse Agentic Workspace*  

---

## 1. Nhóm Intake & Customer (Chuẩn hóa đầu vào & Khách hàng)

### Bảng Kiểm thử Nhóm 1: Chuẩn hóa dữ liệu thô (TC-01 đến TC-08)

| TC ID | Kịch bản kiểm thử (Scenario) | Dữ liệu đầu vào (Input) | Agent xử lý chính | Kết quả mong đợi (Expected Output) | Quy tắc áp dụng (Rule ID) | Điểm chốt chặn con người (Human Checkpoint) | Sự kiện kiểm toán (Audit Event) | Tiêu chí Đạt/Hỏng (Pass/Fail) |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **TC-01** | Phiếu Lexus B2B hợp lệ | File PDF Lexus RX350 có VIN `VIN_MASKED_RX350_001`, mã đại lý `DEALER-001`. | Intake Agent | Trích xuất thành công JSON dạng STANDARDIZED. | R1.1, R1.2 | Không cần can thiệp. | `REQ_RECEIVED` | **Pass:** Trích xuất đủ 100% VIN, model, dealer. |
| **TC-02** | Phiếu thiếu đại lý | Yêu cầu B2B trống thông tin đại lý. | Intake Agent | Báo lỗi trích xuất dữ liệu, chuyển trạng thái `INTAKE_FAILED`. | R1.3 | Admin kho xử lý thủ công, điền mã đại lý thích hợp. | `INTAKE_ERROR_LOG` | **Pass:** Dừng luồng, báo đỏ trường dealer_id. |
| **TC-03** | Đại lý mới chưa có trong master | Mã đại lý `DEALER-999` chưa được đăng ký. | Master Data Agent | Tạm dừng luồng, đổi trạng thái phiếu thành `DEALER_PENDING`. | R2.1 | Admin kho/Kế toán duyệt tạo mới dealer trên Master Data. | `DEALER_CREATED` | **Pass:** Chặn đi tiếp cho đến khi cập nhật dealer_master.csv. |
| **TC-04** | Đại lý đã tồn tại trong master | Phiếu gửi kèm mã `DEALER-001`. | Master Data Agent | Tự động liên kết `DEALER-001` và đi tiếp sang chuẩn hóa khách hàng. | R2.1 | Không cần can thiệp. | `DEALER_LINKED` | **Pass:** Khớp 100% thông tin đối tác tự động. |
| **TC-05** | Khách hàng lẻ mới hoàn toàn | Khách hàng `KH_MASKED_001`, số điện thoại `PHONE_MASKED_001` chưa có trong master. | Master Data Agent | Tự động tạo mã `CUST-20260603-xxx` mới trên end_customer_master.csv. | R2.3 | Không cần can thiệp. | `CUSTOMER_CREATED` | **Pass:** Sinh ID mới, ghi nhận vào master data thành công. |
| **TC-06** | Khách hàng nghi ngờ trùng lặp | Khách hàng `KH_MASKED_001` trùng tên nhưng số điện thoại khác (`PHONE_MASKED_002`). | Master Data Agent | **Cấm tự động gộp**. Tạo khách hàng mới và ghi log ứng viên khử trùng lặp. | R2.4 | Admin kho rà soát danh sách trùng lặp định kỳ để làm sạch. | `DEDUP_CANDIDATE_LOG` | **Pass:** Không gộp đè các khách hàng khác nhau. |
| **TC-07** | Xe có số khung (VIN) mới | Xe Lexus RX350 có VIN `VIN_MASKED_RX350_002` lần đầu dán phim. | Master Data Agent | Khởi tạo hồ sơ xe mới trên vehicle_profile_master.csv. | R2.5 | Không cần can thiệp. | `VEHICLE_PROFILE_CREATED` | **Pass:** Tạo mới hồ sơ xe liên kết customer_id thành công. |
| **TC-08** | Xe có số khung đã tồn tại | VIN `VIN_MASKED_RX350_001` đã dán kính lái 2 tháng trước, nay yêu cầu dán sườn. | Master Data Agent | Liên kết hồ sơ xe cũ, ghi nhận thêm lịch sử thi công dán sườn mới. | R2.6 | Admin kho duyệt kiểm tra chênh lệch chủ xe nếu đổi tên chủ. | `VEHICLE_HISTORY_UPDATED` | **Pass:** Không nhân đôi profile xe, chỉ cập nhật lịch sử dán. |

---

## 2. Nhóm Mapping & Norm (Ánh xạ & Định mức)

### Bảng Kiểm thử Nhóm 2: Tra cứu định mức & Nhóm cắt (TC-09 đến TC-15)

| TC ID | Kịch bản kiểm thử (Scenario) | Dữ liệu đầu vào (Input) | Agent xử lý chính | Kết quả mong đợi (Expected Output) | Quy tắc áp dụng (Rule ID) | Điểm chốt chặn con người (Human Checkpoint) | Sự kiện kiểm toán (Audit Event) | Tiêu chí Đạt/Hỏng (Pass/Fail) |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **TC-09** | Dòng xe có sẵn trong master | Model xe `LEXUS_RX350` có trong vehicle_master.csv. | Mapping Agent | Ánh xạ chính xác loại xe sang mã chuẩn. | R3.1 | Không cần can thiệp. | `VEHICLE_MAPPED` | **Pass:** Tự động đi tiếp sang bước tra cứu định mức. |
| **TC-10** | Dòng xe không có trong master | Xe viết tắt "Lexus LM500" không có trong master. | Mapping Agent | Tạm khóa luồng, đổi trạng thái phiếu thành `MAPPING_PENDING`. | R3.3 | Quản lý Kho Kỹ thuật chọn dòng tương đương hoặc tạo mới model. | `MAPPING_MANUAL_RESOLVED` | **Pass:** Chặn xử lý tự động và gửi tin báo cho Quản lý. |
| **TC-11** | Hạng mục thi công có định mức | Hạng mục kính lái `JOB_FILM_FRONT` của xe Lexus RX350. | Calculation Agent | Trả về kích thước lý thuyết: rộng 90cm x dài 150cm. | R4.1 | Không cần can thiệp. | `NORM_FOUND` | **Pass:** Định mức dán được tra cứu chính xác. |
| **TC-12** | Hạng mục thi công thiếu định mức | Hạng mục dán Capo xe LM500h chưa có định mức trong csv. | Calculation Agent | Tạm khóa luồng, đổi trạng thái phiếu thành `MISSING_NORM`. | R4.5 | Quản lý trực tiếp đo thực tế tại xưởng và nhập định mức bằng tay. | `NORM_LOOKUP_FAILED` | **Pass:** Phát tín hiệu báo động thiếu định mức. |
| **TC-13** | Hạng mục thuộc nhóm dán gom (is_grouped_cut) | Dán sườn + hậu RX350 (`is_grouped_cut = true` trong norm). | Calculation Agent | Không lấy định mức lẻ, chuyển sang truy vấn `cutting_group_matrix.csv`. | R4.4 | Không cần can thiệp. | `CUTTING_GROUP_RESOLVED` | **Pass:** Nhận biết cờ dán nhóm để gom block. |
| **TC-14** | Logic gom nhóm cắt chuẩn | Kính hậu 60x130 và sườn trước 92x130 (RX350). | Calculation Agent | Trả về thông số block: **planned_cut_block = 152x143**, chiều dài planned trừ kho planned_deduction_length_m = **1.43m** (Phần layout thành phẩm gồm kính hậu 60x130 và sườn trước 92x130; phần margin còn lại phục vụ thao tác kỹ thuật và dung sai). | R4.4 | Không cần can thiệp. | `CUTTING_GROUP_RESOLVED` | **Pass:** Cấu hình gom block chính xác theo khổ phim 152cm và làm rõ chiều dài trừ kho. |
| **TC-15** | Kiểm tra cấm trừ lặp định mức | Cả 2 dòng sườn + hậu cùng chung mã `CG_RX350_SIDE_REAR`. | Calculation Agent | Sinh phương án xuất phim có 1 item duy nhất dài 1.43m (không nhân đôi, không trừ theo required_length_m từng dòng lẻ). | R4.4, R8.2 | Không cần can thiệp. | `CUTTING_GROUP_RESOLVED` | **Pass:** Đề xuất xuất phim không bị lặp chiều dài. |

---

## 3. Nhóm Offcut & LOT (Tối ưu mảnh dư & Cuộn gốc)

### Bảng Kiểm thử Nhóm 3: So khớp & Lập phương án (TC-16 đến TC-23)

| TC ID | Kịch bản kiểm thử (Scenario) | Dữ liệu đầu vào (Input) | Agent xử lý chính | Kết quả mong đợi (Expected Output) | Quy tắc áp dụng (Rule ID) | Điểm chốt chặn con người (Human Checkpoint) | Sự kiện kiểm toán (Audit Event) | Tiêu chí Đạt/Hỏng (Pass/Fail) |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **TC-16** | Có mảnh dư lý tưởng (Match Score >= 80) | Mảnh dư `SUBLOT-JB20-001` kích thước 1.52m x 1.5m (Cần block 1.52m x 1.43m). | Offcut Agent | Đề xuất sử dụng mảnh dư này (Match Score = 86.6%), chuyển sang WF5. | R5.1, R5.2 | Không cần can thiệp. | `OFFCUT_MATCHED` | **Pass:** Ưu tiên dùng mảnh dư tối ưu để tiết kiệm cuộn gốc. |
| **TC-17** | Mảnh dư Match Score 60-79 | Mảnh dư `SUBLOT-JB20-002` kích thước 1.0m x 2.5m (Cần dán lẻ 0.9m x 1.3m). | Offcut Agent | Đề xuất cân nhắc (Match Score = 72%). Chuyển sang WF5 chờ duyệt. | R5.2 | Quản lý Kho Kỹ thuật rà soát kỹ mảnh dư trước khi đồng ý. | `OFFCUT_WARNING_LOG` | **Pass:** Đưa vào diện chờ quản lý phê duyệt trực tiếp. |
| **TC-18** | Mảnh dư Match Score < 60 | Mảnh dư quá nhỏ hoặc quá lệch kích thước so với block dán. | Offcut Agent | Bỏ qua mảnh dư, tự động chuyển giao luồng sang phân bổ cuộn gốc (LOT). | R5.2 | Không cần can thiệp. | `OFFCUT_DISCARDED` | **Pass:** Không đề xuất mảnh dư hao phí lớn. |
| **TC-19** | Mảnh dư chỉ đủ 1 mảnh đơn (Partial Match) | Yêu cầu nhóm dán cần block 1.52x1.43. Chỉ có mảnh dư 1.52x0.8. | Offcut Agent | Tạo phương án đề xuất kép: dùng mảnh dư dán kính hậu, cắt cuộn gốc dán sườn. Đánh dấu `PARTIAL_MATCH`. | R5.4 | Quản lý duyệt quyết định xem có nên tách lẻ hay khui cuộn mới. | `PARTIAL_MATCH_ALERT` | **Pass:** Trả về mã lỗi đề xuất kép PARTIAL_MATCH thành công. |
| **TC-20** | Không có mảnh dư, LOT còn đủ | Kho không có mảnh dư khả dụng, cuộn dở dang `LOT-JB20-001` còn 12.5m. | LOT Agent | Đề xuất xuất cuộn dở dang `LOT-JB20-001` theo FIFO. | R6.1, R6.2 | Không cần can thiệp. | `LOT_ALLOCATED` | **Pass:** Chỉ định chính xác cuộn dở dang cũ nhất để cắt. |
| **TC-21** | Cuộn gốc dở dang sắp hết | Đơn hàng cần 2.5m, cuộn dở dang chỉ còn 3.0m (còn lại 0.5m sau cắt). | LOT Agent | Đề xuất xuất cuộn dở dang, đồng thời phát cảnh báo sắp hết cuộn. | R6.4 | Không cần can thiệp. | `LOT_LOW_STOCK_WARNING` | **Pass:** Phát cảnh báo lượng tồn kho sắp chạm đáy. |
| **TC-22** | Cuộn gốc không đủ tồn kho | Đơn hàng cần 1.65m, toàn bộ cuộn gốc dở dang và nguyên còn 1.2m. | LOT Agent | Chặn luồng, chuyển trạng thái yêu cầu sang `SUSPENDED_OUT_OF_STOCK`. | R6.5 | Kế toán kho duyệt nhập khẩn cấp cuộn phim mới. | `STOCK_EXHAUSTED` | **Pass:** Ngăn chặn tồn kho âm trên hệ thống ảo. |
| **TC-23** | Đề xuất ở WF4 chưa Soft Lock | Phương án phân bổ vật tư được tạo thành công ở WF4. | LOT/Offcut Agent | Trạng thái phiếu là `ALLOCATED`. Kiểm tra thuộc tính `is_locked` của cuộn gốc/mảnh dư vẫn là `false`. | Yêu cầu 1 | Không cần can thiệp. | `PROPOSAL_GENERATED` | **Pass:** Cấm tự động khóa vật tư khi chưa được quản lý duyệt. |

---

## 4. Nhóm Approval (Phê duyệt của Quản lý)

### Bảng Kiểm thử Nhóm 4: Phê duyệt phương án & Khóa ảo (TC-24 đến TC-27)

| TC ID | Kịch bản kiểm thử (Scenario) | Dữ liệu đầu vào (Input) | Agent xử lý chính | Kết quả mong đợi (Expected Output) | Quy tắc áp dụng (Rule ID) | Điểm chốt chặn con người (Human Checkpoint) | Sự kiện kiểm toán (Audit Event) | Tiêu chí Đạt/Hỏng (Pass/Fail) |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **TC-24** | Quản lý phê duyệt phương án | Nhấp duyệt đề xuất dùng cuộn `LOT-JB20-001` cho REQ-20260603-001. | Approval Agent | Trạng thái phiếu chuyển thành `APPROVED`. Ghi nhận Soft Lock cuộn phim ảo (`is_locked = true`). | R7.1, R7.2 | **Quản lý Kho Kỹ thuật (HITL-1)** trực tiếp nhấn nút duyệt phương án. | `APPROVAL_GRANTED` | **Pass:** Khóa cuộn phim thành công, cấm trừ tồn vật lý lúc này. |
| **TC-25** | Quản lý điều chỉnh cuộn gốc khác | Quản lý đổi đề xuất từ cuộn `LOT-JB20-001` sang cuộn nguyên `LOT-JB20-002`. | Approval Agent | Hệ thống cập nhật đề xuất mới, ghi log lý do điều chỉnh bắt buộc. | R7.3 | Quản lý thay đổi cuộn chỉ định và nhập lý do điều chỉnh dài >= 10 ký tự. | `ALLOCATION_OVERRIDDEN` | **Pass:** Cập nhật khóa ảo cuộn mới và giải phóng cuộn cũ. |
| **TC-26** | Quản lý điều chỉnh kích thước dán gom | Quản lý điều chỉnh chiều dài planned từ 1.43m thành 1.50m. | Approval Agent | Cập nhật chiều dài planned mới của nhóm cắt, yêu cầu nhập lý do. | R7.3 | Quản lý nhập lý do điều chỉnh chi tiết trên giao diện hệ thống. | `PLANNED_SIZE_MODIFIED` | **Pass:** Bắt buộc nhập lý do chênh lệch khi đổi kích thước. |
| **TC-27** | Approved tạo Soft Lock, cấm trừ kho | Phiếu dán xe có trạng thái `APPROVED` vừa được duyệt. | Approval Agent | Cuộn gốc chuyển sang khóa ảo, chiều dài còn lại (`remaining_length_m`) vẫn giữ nguyên. | R7.2, Yêu cầu 1 | Quản lý kiểm tra trạng thái Soft Lock trên dashboard. | `SOFT_LOCK_RECORDED` | **Pass:** Tồn kho vật lý không đổi cho đến khi KTV xác nhận. |

---

## 5. Nhóm Technician & Inventory (Kỹ thuật viên & Tồn kho thực tế)

### Bảng Kiểm thử Nhóm 5: Thi công thực tế, Trừ tồn & Nhật ký kiểm toán (TC-28 đến TC-36)

| TC ID | Kịch bản kiểm thử (Scenario) | Dữ liệu đầu vào (Input) | Agent xử lý chính | Kết quả mong đợi (Expected Output) | Quy tắc áp dụng (Rule ID) | Điểm chốt chặn con người (Human Checkpoint) | Sự kiện kiểm toán (Audit Event) | Tiêu chí Đạt/Hỏng (Pass/Fail) |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **TC-28** | KTV xác nhận actual_cut_block khớp planned_cut_block | Nhập `actual_cut_block = 152x143`, `actual_length_m = 1.43` khớp planned. | Yield Agent | Thực thi trừ kho 1.43m trên cuộn `LOT-JB20-001`. Giải phóng Soft Lock. Trạng thái phiếu `COMPLETED`. | R8.1, R8.2 | **Kỹ thuật viên (HITL-2)** trực tiếp đo và nhập số liệu lên Job Card. | `INVENTORY_TRANSACTION_LOGGED` | **Pass:** Trừ tồn thành công và giải phóng khóa ảo tự động. |
| **TC-29** | KTV xác nhận actual_cut_block khác planned_cut_block | Nhập `actual_cut_block = 152x150` (Kế hoạch là 152x143). | Yield Agent | Tạm dừng giao dịch, chuyển trạng thái `EXCEPTION_HOLD`, yêu cầu nhập lý do ngoại lệ. | R8.7 | KTV nhập lý do, Quản lý/Kế toán kho duyệt thông qua. | `INVENTORY_TRANSACTION_HELD` | **Pass:** Phát hiện sai lệch khối cắt thực tế và khóa giao dịch. |
| **TC-30** | Trừ kho thực tế theo actual_length_m | Planned_deduction_length_m = 1.43m, KTV cắt thực tế `actual_length_m = 1.45m`. | Yield Agent | Hệ thống thực thi trừ tồn kho đúng **1.45m** từ cuộn gốc (Không tự động trừ theo planned 1.43m). | R8.1, R8.2 | KTV xác nhận đo thực tế chiều dài đã cắt sấy dán xe. | `INVENTORY_TRANSACTION_LOGGED` | **Pass:** Số lượng tồn kho thực tế bị trừ khớp số đo thực tế của KTV. |
| **TC-31** | Phát sinh mảnh dư mới đạt tiêu chuẩn | Cắt cuộn gốc dư mảnh 1.52m x 1.2m (Đạt chuẩn Window Film). | Yield Agent | Trừ cuộn gốc dở dang, tự động tạo mới mã `SUBLOT-JB20-003` ở trạng thái `ACTIVE` trên offcut_inventory.csv. | R8.4 | KTV xác nhận chất lượng mảnh dư và đặt lên vị trí kệ vật lý chỉ định. | `OFFCUT_CREATED` | **Pass:** Sinh mã mảnh dư tự động trên hệ thống ảo chính xác. |
| **TC-32** | Phát sinh Scrap do phần dư nhỏ | Cắt cuộn gốc dư mảnh 1.52m x 0.2m (Dưới chuẩn Window Film). | Yield Agent | Không tạo mảnh dư mới, tính diện tích `0.304 m²` ghi nhận phế liệu. | R8.5 | KTV trực tiếp xác nhận phần dư vụn bỏ vào thùng Scrap. | `SCRAP_RECORDED` | **Pass:** Tính toán diện tích phế liệu và lưu vết thành công. |
| **TC-33** | Chặn tồn kho âm ảo | KTV báo cáo cắt thực tế 15.0m từ cuộn gốc chỉ còn tồn ảo 12.5m. | Yield Agent | Ngăn chặn giao dịch lập tức, báo lỗi chênh lệch kho `Negative Stock Error`. | R8.3 | Kế toán kho kiểm kho vật lý thực tế xem cuộn phim bị lệch ở đâu. | `INVENTORY_DISCREPANCY_ALERT` | **Pass:** Không cho phép cập nhật số dư âm dưới mọi hình thức. |
| **TC-34** | Giải phóng Soft Lock sau giao dịch thành công | Giao dịch trừ kho hoàn tất thành công. | Yield Agent | Thuộc tính `is_locked` của cuộn gốc quay về trạng thái `false` trên kho ảo. | R8.6 | Không cần can thiệp. | `SOFT_LOCK_RELEASED` | **Pass:** Giải phóng giữ chỗ để đưa phần còn lại cuộn phim khả dụng. |
| **TC-35** | Ghi nhận Scrap không dùng source_type | Giao dịch `RECORD_SCRAP` được tạo ra để ghi nhận phế liệu. | Yield Agent | Kiểm tra transaction chứa `transaction_type = RECORD_SCRAP`, `source_type = LOT` (hoặc `OFFCUT`), không chứa `source_type = SCRAP`. | Yêu cầu 3 | Không cần can thiệp. | `INVENTORY_TRANSACTION_LOGGED` | **Pass:** Tuân thủ 100% cấu trúc transaction schema mới. |
| **TC-36** | Ghi log kiểm toán đầy đủ trường kiểm tra | Ghi nhật ký bất biến sau giao dịch thành công. | Yield Agent | Bản ghi log được đẩy vào audit-log-schema.json chứa đủ `before_value`, `after_value`, `reason`, `actor`, `timestamp`. | R9.1, R9.2 | Không cần can thiệp. | `AUDIT_LOG_COMMITTED` | **Pass:** Bản ghi log bất biến có thể truy vấn phục vụ đối soát. |
