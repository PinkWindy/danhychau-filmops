# THÔNG BÁO TRÌNH DUYỆT PHƯƠNG ÁN CẤP PHÁT VẬT TƯ (MANAGER APPROVAL REQUEST)

**Mã yêu cầu (Request ID):** REQ-20260603-001  
**Đại lý gửi yêu cầu (Dealer):** Lexus Trung Đông (Mã: DEALER-001)  
**Khách hàng dán xe (Customer):** KH_MASKED_001 (Đã ẩn danh thông tin cá nhân)  
**Hồ sơ xe (Vehicle):** Lexus RX350 (Số khung/VIN: VIN_MASKED_RX350_001)  

---

### 1. Chi tiết định mức và hạng mục thi công
* **Hạng mục dán xe (Job Items):** Kính sườn (`JOB_FILM_SIDE`) và Kính hậu (`JOB_FILM_REAR`).
* **Mã vật tư dán (Material Code):** `JB20` (Window Film cao cấp).
* **Cấu hình gom nhóm cắt (Cutting Group):**
  * **Mã nhóm cắt (Cut Group ID):** `CG_RX350_SIDE_REAR` (Áp dụng cấu hình dán gom).
  * **Kích thước các mảnh lẻ:** 92x130 cm (kính sườn) & 60x130 cm (kính hậu).
  * **Khối cắt dự kiến (Planned Cut Block):** **152x143 cm** (Trong block 152x143, phần layout thành phẩm gồm kính hậu 60x130 và sườn trước 92x130; phần margin còn lại phục vụ thao tác kỹ thuật và dung sai).
  * **Chiều dài dự kiến trừ kho (Planned Deduction):** **1.430 m** (planned_deduction_length_m = 1.43m, đã bao gồm biên an toàn 10%).
  * **Diện tích dự kiến trừ kho (Planned Area):** **2.174 m²**.

---

### 2. Phương án cấp phát đề xuất (Allocation Proposal)
Hệ thống chạy thuật toán tối ưu so khớp và đề xuất phương án sau:

* **Phương án chọn:** **Cắt từ cuộn gốc (LOT)** (Mặc dù hệ thống tìm thấy mảnh dư phù hợp `SUBLOT-JB20-001` có Match Score = 86.6%, nhưng do yêu cầu thẩm mỹ cao của xe Lexus Luxury này, đề xuất chuyển sang khui cuộn gốc).
* **Mã cuộn gốc chỉ định (LOT ID):** `LOT-JB20-001` (Tồn kho dở dang khả dụng: 12.5m).
* **Vị trí vật lý của cuộn:** Kệ hàng `A-RACK-03`.
* **Thứ tự phân bổ:** Áp dụng nguyên tắc FIFO (Cuộn `LOT-JB20-001` nhập kho ngày 2026-04-10, cũ nhất trong danh mục JB20 dở dang).

---

### 3. Lưu ý phê duyệt quan trọng
> [!IMPORTANT]
> * **Soft Lock ảo:** Sau khi Quản lý nhấn nút **[PHÊ DUYỆT]** phương án này, hệ thống sẽ thực hiện chuyển trạng thái cuộn `LOT-JB20-001` sang **Reserved/Soft Lock** (`is_locked = true` trên kho ảo) để giữ chỗ cho xe này, ngăn các yêu cầu song song khác tranh chấp vật tư.
> * **Cấm tự động trừ kho:** Thao tác phê duyệt của Quản lý **chưa làm trừ tồn kho vật lý**. Việc trừ tồn kho thực tế chỉ được thực hiện sau khi Kỹ thuật viên hoàn tất cắt phim và đo đạc xác nhận kích thước thực tế sử dụng (WF6 - HITL-2).
