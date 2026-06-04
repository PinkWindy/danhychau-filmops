# BÁO CÁO NGOẠI LỆ: HẾT SẠCH TỒN KHO KHẢ DỤNG (EXCEPTION - OUT OF STOCK ALERT)
**Mã sự kiện kiểm toán:** `STOCK_EXHAUSTED`  
**Thời gian phát hiện:** 2026-06-03T10:15:22Z  

---

### 1. Chi tiết sự cố phát hiện bởi Agent
* **Agent phát hiện:** [06-lot-allocation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/06-lot-allocation-agent.md) phối hợp cùng [05-offcut-optimization-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/05-offcut-optimization-agent.md).
* **Phiếu yêu cầu liên quan:** `REQ-20260603-022`
* **Mã phim yêu cầu:** `RT40` (Window Film siêu cấp kính lái)
* **Chiều dài yêu cầu cần cắt dán (Planned Deduction):** **1.650 m**
* **Tình trạng tồn kho ảo tại thời điểm quét:**
  * **Mảnh dư (Offcuts):** Không có mảnh dư `RT40` nào chưa khóa có chiều rộng >= 1.52m và chiều dài >= 1.65m. Mảnh dư lớn nhất hiện tại chỉ dài 1.1m (Không đạt kích thước tối thiểu).
  * **Cuộn phim gốc (LOTs):** Cuộn dở dang duy nhất `LOT-3MCRY-001` chỉ còn lại **1.20 m** (Thiếu hụt 0.45m). Kho ảo không còn cuộn nguyên chưa khui nào khác cho mã vật tư `RT40`.
  * **Kết quả:** Hệ thống thiếu hụt **0.45m** phim `RT40` để đáp ứng đơn hàng.

---

### 2. Các quy tắc áp dụng (Rules Applied)
* **Rule 6.5 (R6 - Quy tắc phân bổ LOT):** *"Cấm tồn kho âm ảo. Nếu lượng tồn kho khả dụng của cuộn dở dang và cuộn nguyên trong kho ảo đều không đủ đáp ứng, LOT Allocation Agent bắt buộc phải dừng tiến trình ngay lập tức, không được phép gán phương án ảo và chuyển trạng thái phiếu sang OUT_OF_STOCK."*
* **Rule 5.6 (R5 - Quy tắc tối ưu mảnh dư):** Giao diện chuyển sang màn hình cảnh báo thiếu hụt hàng chờ cho Admin kho và Kế toán kho.

---

### 3. Phương án xử lý của Con người (Human Handoff Resolution)
Sự cố được chuyển đến Admin kho và Kế toán kho xử lý thông qua 3 bước đối soát:
1. **Kiểm tra kho vật lý:** Admin kho trực tiếp xuống kệ hàng kiểm tra cuộn `LOT-3MCRY-001` xem chiều dài thực tế cuộn dở dang có đúng 1.2m hay không (tránh sai lệch dữ liệu kho ảo). Kết quả: Thực tế cuộn chỉ còn đúng 1.2m.
2. **Kế toán kho làm thủ tục khẩn cấp:** Kế toán kho lập phiếu nhập bổ sung khẩn cấp 2 cuộn nguyên `RT40` mới về xưởng (Mã lô nhập mới: `LOT-3MCRY-002`, chiều dài 30.0m).
3. **Cập nhật hệ thống:** Sau khi hàng về, Admin kho nhập dữ liệu cuộn mới vào [lot_inventory.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/lot_inventory.csv) và chuyển trạng thái cuộn phim mới sang `ACTIVE`.
4. **Chạy lại thuật toán:** Hệ thống tự động nhận diện có cuộn mới, chạy lại thuật toán phân bổ FIFO cho yêu cầu `REQ-20260603-022`, chỉ định cuộn mới và chuyển sang WF5 bình thường.

#### Bản ghi nhật ký kiểm toán bổ sung hàng (`LOT_IMPORTED`):
```json
{
  "event_id": "AUD-20260603-102",
  "event_type": "LOT_IMPORTED",
  "actor": "KTK-004",
  "request_id": "REQ-20260603-022",
  "before_value": "RT40_STOCK = 1.20m",
  "after_value": "RT40_STOCK = 31.20m (Added LOT-3MCRY-002: 30.0m)",
  "reason": "Nhap bo sung khan cap cuon RT40 phuc vu yeu cau REQ-20260603-022",
  "timestamp": "2026-06-03T11:00:00Z"
}
```
