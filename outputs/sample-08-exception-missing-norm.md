# BÁO CÁO NGOẠI LỆ: THIẾU ĐỊNH MỨC XE/HẠNG MỤC (EXCEPTION - MISSING NORM ALERT)
**Mã sự kiện kiểm toán:** `NORM_LOOKUP_FAILED`  
**Thời gian phát hiện:** 2026-06-03T09:30:15Z  

---

### 1. Chi tiết sự cố phát hiện bởi Agent
* **Agent phát hiện:** [04-norm-calculation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/04-norm-calculation-agent.md)
* **Phiếu yêu cầu liên quan:** `REQ-20260603-015`
* **Dòng xe yêu cầu:** `LEXUS_LM500H` (Lexus LM500h dòng xe sang hoàn toàn mới)
* **Hạng mục thi công:** Dán phim cách nhiệt kính sườn (`JOB_FILM_SIDE`)
* **Mã phim yêu cầu:** `RS20`
* **Mô tả lỗi:** Khi truy vấn ma trận định mức dán [norm_matrix.csv](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/knowledge/norm_matrix.csv), Agent không tìm thấy bất kỳ dòng định mức nào khớp với tổ hợp khóa: `vehicle_model_code = LEXUS_LM500H`, `job_item_id = JOB_FILM_SIDE`, và `material_code = RS20`.

---

### 2. Các quy tắc áp dụng (Rules Applied)
* **Rule 4.5 (R4 - Quy tắc tính định mức):** *"Nếu hệ thống không tìm thấy định mức tương ứng trong ma trận cho dòng xe được yêu cầu, Agent không được phép tự ý suy diễn kích thước. Agent bắt buộc phải dừng tiến trình, đổi trạng thái phiếu sang NORM_PENDING và gửi cảnh báo đến Quản lý Kho Kỹ thuật."*
* **Rule 3.4 (R3 - Quy tắc ánh xạ):** Giao diện hệ thống bị tạm khóa luồng tự động (WF3) và chuyển giao sang luồng kiểm soát con người (Human-in-the-loop).

---

### 3. Chốt chặn kiểm soát con người (Human Checkpoint)
* **Người chịu trách nhiệm xử lý:** **Quản lý Kho Kỹ thuật** (Human Persona: `02-quan-ly-kho-ky-thuat.md`).
* **Hành động bắt buộc:** Quản lý phải trực tiếp vào màn hình điều khiển, tiến hành đối soát thủ công và thực hiện một trong hai cách xử lý dưới đây.

---

### 4. Phương án xử lý và Ghi nhật ký kiểm toán (Resolution & Audit Log)
Quản lý Kho Kỹ thuật đã xử lý bằng cách:
1. Đo đạc kích thước kính sườn thực tế của xe Lexus LM500h tại xưởng thi công.
2. Áp dụng biên an toàn 10% cho phim cách nhiệt. Kích thước cơ sở đo được là 95cm x 135cm. Kích thước yêu cầu sau cộng biên an toàn là 95cm x 148.5cm.
3. Nhập định mức tạm thời trực tiếp trên màn hình giao diện hệ thống cho yêu cầu `REQ-20260603-015`.
4. Điền lý do điều chỉnh: *"LM500h model 2026 moi ve xuong, da do kich thuoc kinh suon thuc te tai xuong la 95x135, ap dung safety margin 10% ra chieu dai can cat 1.485m"*.

#### Bản ghi log kiểm toán phát sinh (`NORM_MANUALLY_ASSIGNED`):
```json
{
  "event_id": "AUD-20260603-099",
  "event_type": "NORM_MANUALLY_ASSIGNED",
  "actor": "QL-002",
  "request_id": "REQ-20260603-015",
  "before_value": "null",
  "after_value": {
    "vehicle_model_code": "LEXUS_LM500H",
    "job_item_id": "JOB_FILM_SIDE",
    "material_code": "RS20",
    "required_width_m": 0.95,
    "required_length_m": 1.485,
    "required_area_m2": 1.41,
    "is_grouped_cut": false
  },
  "reason": "LM500h model 2026 moi ve xuong, da do kich thuoc kinh suon thuc te tai xuong la 95x135, ap dung safety margin 10% ra chieu dai can cat 1.485m",
  "timestamp": "2026-06-03T09:45:00Z"
}
```
Sau khi ghi log kiểm toán thành công, hệ thống mở khóa phiếu yêu cầu, cập nhật trạng thái từ `NORM_PENDING` sang `NORM_ASSIGNED` và đẩy tiếp sang WF4.
