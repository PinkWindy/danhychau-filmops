# BÁO CÁO CẢNH BÁO: CHẤT LƯỢNG MẢNH DƯ KHÔNG ĐẠT (EXCEPTION - OFFCUT QUALITY WARNING)
**Mã sự kiện kiểm toán:** `OFFCUT_QUALITY_ALERT`  
**Thời gian phát hiện:** 2026-06-03T14:20:10Z  

---

### 1. Chi tiết sự cố phát hiện bởi Agent
* **Agent phát hiện:** [05-offcut-optimization-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/05-offcut-optimization-agent.md)
* **Phiếu yêu cầu liên quan:** `REQ-20260603-029`
* **Mã phim yêu cầu:** `T-TYPE` (PPF bảo vệ Capo)
* **Kích thước khối dán yêu cầu:** 1.52m x 1.20m
* **Mảnh dư khớp kích thước tối ưu:** `SUBLOT-PPFX-001` (Kích thước: 1.52m x 1.20m)
* **Vấn đề chất lượng:** Mảnh dư `SUBLOT-PPFX-001` đang được lưu vết trên kho ảo với trạng thái chất lượng là `DEFECT` (Bị xước nhẹ bề mặt do KTV trước đó ghi nhận khi cất kho).
* **Ảnh hưởng thuật toán:** 
  * Định mức kích thước khớp 100% (Match Score lý thuyết ban đầu: 100%).
  * Tuy nhiên, do cờ chất lượng `quality_status = DEFECT`, Agent tự động trừ **40 điểm chất lượng** của mảnh dư này.
  * **Match Score thực tế sau hạ điểm:** **60%** (Lọt vào nhóm cân nhắc rủi ro hao hụt, Match Score từ 60% đến 79%).

---

### 2. Các quy tắc áp dụng (Rules Applied)
* **Rule 5.3 (R5 - Quy tắc tối ưu mảnh dư):** *"Tuyệt đối không tự động đề xuất sử dụng mảnh dư có chất lượng không đạt tiêu chuẩn (DEFECT) cho các đơn hàng dán xe chính hãng nếu không có sự phê duyệt trực tiếp bằng tay của Quản lý Kho Kỹ thuật. Mảnh dư xước chỉ được dùng cho mục đích đào tạo hoặc dán các bộ phận không quan trọng."*
* **Rule 7.2 (R7 - Quy tắc phê duyệt):** Chuyển giao diện cảnh báo đến Quản lý Kho Kỹ thuật (HITL-1) để phê duyệt phương án đặc cách hoặc từ chối chuyển sang cuộn nguyên.

---

### 3. Phương án xử lý của Quản lý (Human Checkpoint)
Quản lý Kho Kỹ thuật kiểm tra chi tiết yêu cầu dán xe:
* **Phương án A (Đặc cách):** Duyệt dùng mảnh dư nếu khách hàng đồng ý giảm giá hoặc dán ở vị trí ẩn khuất (cần gõ lý do).
* **Phương án B (Từ chối - Khuyên dùng cuộn nguyên):** Từ chối sử dụng mảnh dư xước này để đảm bảo chất lượng xe Lexus Luxury. Yêu cầu hệ thống chuyển sang đề xuất khui cuộn nguyên `LOT-PPF-X-001` theo FIFO.

#### Quyết định của Quản lý Kho Kỹ thuật:
Quản lý chọn **Phương án B** (Từ chối mảnh dư chất lượng thấp).
* **Lý do nhập tay:** *"Xe khach dán Lexus RX350 yeu cau chat luong cao nhat, khong su dung sublot defect bi xuoc de tranh khieu nai. Chuyen sang cat tu cuon goc LOT-PPF-X-001."*

#### Bản ghi log kiểm toán tương ứng (`OFFCUT_REJECTED`):
```json
{
  "event_id": "AUD-20260603-115",
  "event_type": "OFFCUT_REJECTED",
  "actor": "QL-002",
  "request_id": "REQ-20260603-029",
  "before_value": "SUBLOT-PPFX-001 (Match Score: 60%, status = DEFECT)",
  "after_value": "LOT-PPF-X-001 (FIFO Cuộn nguyên)",
  "reason": "Xe khach dán Lexus RX350 yeu cau chat luong cao nhat, khong su dung sublot defect bi xuoc de tranh khieu nai. Chuyen sang cat tu cuon goc LOT-PPF-X-001.",
  "timestamp": "2026-06-03T14:35:00Z"
}
```
Hệ thống tự động giải phóng mảnh dư `SUBLOT-PPFX-001` và gán khóa ảo Soft Lock cho cuộn `LOT-PPF-X-001` phục vụ lệnh dán xe.
