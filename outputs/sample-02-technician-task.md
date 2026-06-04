# LỆNH THI CÔNG CHI TIẾT (TECHNICIAN JOB CARD)

**Mã yêu cầu (Request ID):** REQ-20260603-001  
**Mã nhóm cắt (Cut Group ID):** `CG_RX350_SIDE_REAR`  
**Dòng xe thi công (Vehicle Model):** Lexus RX350 (Số khung: VIN_MASKED_RX350_001)  
**Kỹ thuật viên thực hiện (Technician ID):** KTV-003  
**Người phê duyệt lệnh (Approved By):** QL-002  

---

### 1. Chỉ dẫn cắt phim kế hoạch (Planned Guidelines)
Kỹ thuật viên thực hiện lấy vật tư được chỉ định dưới đây từ kho vật lý và tiến hành cắt dán theo sơ đồ:

* **Mã nguồn vật tư (Source ID):** `LOT-JB20-001` (Cuộn phim gốc).
* **Mã phim (Material Code):** `JB20`
* **Vị trí kệ vật lý:** Kệ hàng `A-RACK-03`
* **Khối cắt dự kiến (Planned Cut Block):** **152 cm (Rộng) x 143 cm (Dài)**
* **Kích thước dự kiến trừ kho (Planned Size):**
  * Chiều rộng: 1.52 m
  * Chiều dài: 1.43 m (planned_deduction_length_m = 1.43m, đã bao gồm safety margin sấy dán)
  * Diện tích: 2.174 m²
* **Sơ đồ ghép cắt:** Cắt nguyên một khối dài 143cm từ cuộn khổ 152cm. Trên khối cắt đó, chia thành phẩm:
  * Mảnh kính sườn: 92 cm x 130 cm
  * Mảnh kính hậu: 60 cm x 130 cm
  * Phần margin còn lại phục vụ thao tác kỹ thuật và dung sai.

---

### 2. Xác nhận thực tế thi công (Technician Confirmation Inputs)
*Kỹ thuật viên bắt buộc đo đạc thực tế sau khi cắt dán và nhập thông tin dưới đây lên hệ thống:*

```markdown
[ ] Xác nhận đã lấy đúng cuộn phim LOT-JB20-001 từ kệ A-RACK-03.
[ ] Kích thước cắt thực tế (Actual Size):
    - Chiều rộng thực tế (actual_width_m): ______ m (mặc định 1.52m)
    - Chiều dài thực tế (actual_length_m): ______ m
[ ] Khối cắt thực tế (actual_cut_block): _____ cm (Rộng) x _____ cm (Dài) (ví dụ: 152x143)

[ ] Khai báo mảnh dư mới phát sinh (Offcut Created) - Nếu có phần dư đạt chuẩn:
    - Mã kệ cất mảnh dư (storage_location): ____________
    - Trạng thái chất lượng (quality_status): [ ] EXCELLENT  [ ] NORMAL  [ ] DEFECT
    - Kích thước mảnh dư: ______ cm (Rộng) x ______ cm (Dài)
    
[ ] Khai báo phế liệu phát sinh (Scrap Recorded) - Phần thừa nhỏ hoặc hỏng:
    - Kích thước phần phim thừa hỏng: ______ cm (Rộng) x ______ cm (Dài)
    
[ ] Lý do ngoại lệ/chênh lệch (exception_reason) - Bắt buộc nhập nếu kích thước thực tế khác kế hoạch:
    _______________________________________________________________________________
```

---

### 3. Nhắc nhở nghiệp vụ quan trọng
> [!WARNING]
> * **Cấm trừ kho tự động:** Hệ thống **tuyệt đối không trừ tồn kho** nếu Kỹ thuật viên chưa xác nhận và nhập đầy đủ kích thước thực tế (`actual_size`) và khối cắt thực tế (`actual_cut_block`).
> * **Cảnh báo sai lệch:** Mọi sự thay đổi về kích thước cắt thực tế vượt quá dung sai cho phép hoặc tự ý chia lẻ nhóm cắt đều yêu cầu phải gõ lý do ngoại lệ và sẽ bị hệ thống treo giao dịch để Quản lý đối soát.
