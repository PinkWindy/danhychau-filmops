# DANH MỤC KIỂM TOÁN CHẤT LƯỢNG WORKSPACE (AUDIT CHECKLIST)
*Dành cho Kế toán kho, Admin hệ thống và Đội ngũ Giám sát Vận hành DYC*

---

## 1. Kiểm toán Cấu hình Hệ thống (System Configuration Gates)

### [ ] 1.1. AI Agents Integration (Hồ sơ AI Agents)
- [ ] Xác nhận đủ 8 tệp đặc tả Agent trong thư mục `agents/` (`01` đến `08`).
- [ ] Đảm bảo mỗi Agent có phân định rõ ràng về vai trò, đầu vào/đầu ra mong muốn và các tập luật được áp dụng trực tiếp.
- [ ] Không có sự chồng lấn quyền hạn xử lý giữa các Agent (đặc biệt là giữa Offcut Agent và LOT Agent).

### [ ] 1.2. Human Personas (Hồ sơ Người dùng)
- [ ] Xác nhận đủ 4 tệp Persona trong thư mục `human-personas/` (Admin kho, Quản lý, Kỹ thuật viên, Kế toán).
- [ ] Đảm bảo phân cấp quyền hạn rõ ràng:
  - [ ] Chỉ có Quản lý Kho Kỹ thuật mới có quyền duyệt phương án thi công (WF5 - HITL-1).
  - [ ] Chỉ có Kỹ thuật viên mới được quyền nhập kích thước thực tế sử dụng (WF6 - HITL-2).
  - [ ] Quyền đối soát chênh lệch và kiểm kê thuộc về Kế toán kho.

### [ ] 1.3. Business Modules
- [ ] Đảm bảo đủ 11 Modules nghiệp vụ từ `M1` đến `M11` trong `modules/`.
- [ ] Đảm bảo file [module-mapping-table.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/modules/module-mapping-table.md) phản ánh chính xác liên kết giữa các Module với con người, AI Agents và các bước quy trình.

---

## 2. Kiểm toán Dữ liệu Master & Định mức (Master Data & Norms)

### [ ] 2.1. Customer, Dealer & Vehicle Governance
- [ ] Kiểm tra [dealer_account_master.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/dealer_account_master.csv): Đã bọc dấu nháy kép `""` cho địa chỉ chứa dấu phẩy để tránh lỗi lệch cột.
- [ ] Kiểm tra [end_customer_master.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/end_customer_master.csv): Mọi thông tin khách hàng nhạy cảm (tên, số điện thoại, email) bắt buộc phải dán nhãn masked dạng `***` hoặc dữ liệu giả lập.
- [ ] Kiểm tra [vehicle_profile_master.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/vehicle_profile_master.csv): VIN xe phải được liên kết đúng với `request_id`, `dealer_id`, `customer_id`.

### [ ] 2.2. Norm Matrix & Cutting Group Config
- [ ] Kiểm tra [norm_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/norm_matrix.csv):
  - [ ] required_width_m bằng base_width_m.
  - [ ] safety_margin_percent = 5% đối với mã vật tư PPF (bắt đầu bằng PPF).
  - [ ] safety_margin_percent = 10% đối với Window Film cách nhiệt.
  - [ ] required_length_m tính đúng theo công thức: $base\_length\_m \times (1 + safety\_margin\_percent / 100)$.
- [ ] Kiểm tra [cutting_group_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/cutting_group_matrix.csv):
  - [ ] Toàn bộ trường `cut_group_id` là duy nhất, không trùng lặp.
  - [ ] Trường `deduction_area_m2` tính đúng theo: $cut\_block\_width\_cm / 100 \times deduction\_length\_m$ (sai số làm tròn cho phép tối đa 0.001).
- [ ] Ràng buộc nghiệp vụ: Nếu `is_grouped_cut = true` trong `norm_matrix.csv`, hệ thống bắt buộc phải bỏ qua required_length_m lẻ và sử dụng `deduction_length_m` từ `cutting_group_matrix.csv`.

---

## 3. Kiểm toán Quy trình Vận hành (Workflow Integration Gates)

### [ ] 3.1. WF4 - Offcut Optimization & Proposal Stage
- [ ] Đảm bảo ở WF4, hệ thống chỉ tạo **Material Allocation Proposal (Đề xuất cấp phát vật tư)**.
- [ ] Tuyệt đối **không tự động Soft Lock** cuộn phim/mảnh dư ảo tại bước này. Thuộc tính `is_locked` của vật tư trên database ảo phải giữ giá trị `false`.

### [ ] 3.2. WF5 - Approval & Soft Lock Stage
- [ ] Xác nhận hệ thống chặn hoàn toàn việc Agent tự động ký duyệt lệnh dán xe. Lệnh bắt buộc phải trình cho Quản lý phê duyệt thủ công (HITL-1).
- [ ] Kiểm tra xem sau khi Quản lý duyệt:
  - [ ] Trạng thái phiếu dán chuyển sang `APPROVED`.
  - [ ] Trạng thái cuộn gốc/mảnh dư tương ứng chuyển sang **Soft Lock / Reserved** (`is_locked = true`).
  - [ ] Số dư tồn kho thực tế (`remaining_length_m`) **chưa được trừ**.

### [ ] 3.3. WF6 - Tech Confirmation & Stock Deduction
- [ ] Đảm bảo hệ thống chặn hoàn toàn việc trừ tồn kho vật lý tự động dựa trên số liệu dự kiến (planned) của định mức.
- [ ] Giao dịch trừ tồn thực tế bắt buộc phải được kích hoạt bằng xác nhận đo đạc kích thước thực tế (`actual_size` và `actual_cut_block`) của Kỹ thuật viên (HITL-2).
- [ ] Nếu KTV chưa xác nhận hoàn thành và chưa nhập thực tế, cấm trừ kho dưới mọi hình thức.
- [ ] Rà soát logic loại bỏ trừ lặp: Đối với các hạng mục dán gom thuộc cùng `cut_group_id`, hệ thống chỉ trừ kho một lần duy nhất theo kích thước thực tế báo cáo của cả nhóm cắt.
- [ ] Xác nhận sau khi trừ kho thành công, trạng thái khóa của cuộn gốc/mảnh dư phải được giải phóng (`lock_released = true` và `is_locked = false`).

---

## 4. Kiểm toán Cấu trúc Dữ liệu Giao dịch (JSON Schemas & Audit Trail)

### [ ] 4.1. JSON Schemas Compliance
- [ ] Xác nhận tất cả 14 Schemas trong thư mục `schemas/` đều hợp lệ theo định dạng JSON Schema Draft-07.
- [ ] Kiểm tra [inventory-transaction-schema.json](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/schemas/inventory-transaction-schema.json):
  - [ ] `source_type` chỉ chứa các giá trị: `LOT`, `OFFCUT`, `MANUAL_ADJUSTMENT`. Tuyệt đối không chứa `SCRAP`.
  - [ ] Chứa đầy đủ trường bắt buộc mới: `transaction_type`, `transaction_status`, `balance_unit`.
  - [ ] Chứa conditional validation (allOf) quy định các trường bắt buộc theo từng loại giao dịch cụ thể (ví dụ: RECORD_SCRAP bắt buộc có scrap_area_m2, EXCEPTION_HOLD bắt buộc có exception_reason).

### [ ] 4.2. Audit Log & Immutability
- [ ] Đảm bảo mọi giao dịch làm thay đổi số dư kho hoặc sửa đổi kích thước định mức đều được ghi nhận bất biến vào nhật ký kiểm toán.
- [ ] Bản ghi log bắt buộc phải lưu vết đầy đủ các trường: `before_value`, `after_value`, `reason`, `actor`, và `timestamp` để sẵn sàng cho công tác hậu kiểm.
