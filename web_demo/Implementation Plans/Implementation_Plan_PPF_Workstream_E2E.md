# Kế hoạch luồng PPF xuyên suốt (BODY · Sunroof · Kính lái)

Tài liệu này bổ sung **phân tích nghiệp vụ và lộ trình triển khai** cho dòng PPF sau khi UI form thủ công đã hiển thị tham chiếu kích thước / họ vật tư mặc định. Phần mã backend hiện tại vẫn coi PPF là một gói `include_ppf` + `ppf_type` (T-TYPE/M-TYPE) — **chưa** tách job_item PPF theo BODY / SUNROOF / WINDSHIELD.

---

## 1. Phạm vi hạng mục PPF (chuẩn hóa nghiệp vụ)

| Hạng mục | Kích thước mặc định (tham chiếu) | Họ vật tư thường dùng | Ghi chú |
|----------|-----------------------------------|------------------------|---------|
| **BODY** | 1300 × 152 cm | T-TYPE, M-TYPE | Gắn với chọn `ppf_type` hiện tại trên form. |
| **Sunroof** | 10 × 152 cm | S-TYPE | Tách khỏi BODY; có thể không có trên một số xe. |
| **Kính lái** | 122 × 165 cm | PET-TYPE, TPU-TYPE | **Gán theo LOT** nhập kho (quét batch / grade), không cố định một mã duy nhất lúc tạo đơn. |

**WF (phim cách nhiệt)** đã có `job_item` (WINDSHIELD, SUNROOF, …) và resolve định mức + vật tư ưu tiên. **PPF** cần mô hình tương đương nếu muốn cùng một pipeline: cắt — phê duyệt — bù hàng — audit.

---

## 2. Luồng xử lý đề xuất (end-to-end)

### Giai đoạn A — Tiếp nhận đơn

1. **Tạo đơn thủ công**  
   - Chọn dòng xe (đã có: gợi ý từ `GET /api/vehicle-norms/model-options?source=norms`).  
   - Bật PPF; chọn T-TYPE/M-TYPE cho BODY.  
   - *Mục tiêu tương lai:* lưu `ppf_scope[]` = `{ BODY, SUNROOF?, WINDSHIELD? }` + kích thước override + `material_resolution_mode` (LOT / preference).

2. **Tạo đơn OCR**  
   - Parser / HITL map sang cùng schema `ppf_scope` + `ppf_type_body`.  
   - Nếu OCR không tách được Sunroof / Kính lái → cờ `NEEDS_REVIEW` + task rà soát thủ công.

### Giai đoạn B — Chuẩn hóa & định mức

3. **Resolve định mức PPF** (chưa có API tương đương WF)  
   - Bảng mới hoặc mở rộng `DbVehicleFilmNorm` / bảng PPF riêng: mapping `(vehicle_model_code, model_year?) → { body, sunroof, windshield }`.  
   - Fallback: dùng default cố định như trên + cho phép sửa trên UI phê duyệt.

4. **Gán vật tư**  
   - BODY / Sunroof: preference table giống WF.  
   - Kính lái PPF: **bắt buộc** đọc từ LOT đang mở (FIFO / grade) hoặc rule “ưu tiên TPU nếu LOT X”.

### Giai đoạn C — Phê duyệt & chỉnh sửa

5. **Phê duyệt vật tư / định mức**  
   - Màn hình duyệt hiển thị từng hạng mục PPF + nguồn (NORM / DEFAULT / LOT).  
   - Mọi thay đổi mã so với gợi ý → `reason` bắt buộc (đã có pattern với WF `material_overrides`).

6. **Chỉnh sửa đơn sau duyệt**  
   - Version hóa `ppf_plan` (snapshot JSON) + audit `PPF_PLAN_UPDATED`.  
   - Nếu đã phát lệnh cắt: chỉ cho sửa qua luồng “hủy lệnh / tạo lệnh bù” (tránh lệch tồn kho).

### Giai đoạn D — Sản xuất kho

7. **Lệnh cắt & xuất vật tư**  
   - Một workstream PPF có thể tách thành 1–3 dòng lệnh (BODY / SUNROOF / WS) hoặc gộp bill-of-materials với nhiều dòng.  
   - Quy đổi cm → cuộn: reuse logic trừ kho như hiện có cho PPF “full”.

8. **Cắt bổ sung**  
   - Tạo request phụ `SUPPLEMENTARY_CUT` gắn `parent_workstream_id` + `ppf_job_item`.  
   - Trừ tồn / ghi nhận offcut theo quy tắc kho hiện tại.

### Giai đoạn E — Hoàn tất

9. **Hoàn tất đơn**  
   - Điều kiện: mọi `ppf_job_item` đã `ISSUED` + thi công xác nhận (nếu có module QC).  
   - Đóng workstream → cập nhật trạng thái request tổng.

---

## 3. Khác biệt so với trạng thái code hiện tại

- API `POST /api/requests/manual-create` nhận `service_selection.include_ppf`, `ppf_type`, không có mảng job PPF.  
- Không có `resolve` PPF theo từng kính / thân tương tự WF.  
- UI mới chỉ là **tham chiếu nghiệp vụ** (BODY / Sunroof / Kính lái), chưa đẩy xuống payload.

---

## 4. Lộ trình triển khai đề xuất (chia sprint)

| Sprint | Việc chính | Đầu ra |
|--------|-------------|--------|
| **S1** | Schema JSON `ppf_job_items[]` trên request / workstream (lưu snapshot, chưa bắt buộc UI chi tiết). | Migration + API nhận optional field, backward compatible. |
| **S2** | UI form thủ công + OCR: checkbox 3 hạng mục, override kích thước, validate. | Payload đầy đủ, vẫn tạo 1 workstream PPF nếu backend chưa tách. |
| **S3** | Bảng định mức PPF theo xe (hoặc reuse norm với `film_type = Phim PPF` + cột size theo job). | `GET /api/vehicle-norms/resolve` mở rộng hoặc `/api/ppf-norms/resolve`. |
| **S4** | Gán vật tư BODY/Sunroof + **Kính lái theo LOT**; màn hình duyệt. | Parity với WF về audit / override. |
| **S5** | Tách lệnh cắt theo job_item; cắt bổ sung; báo cáo. | E2E test + tài liệu vận hành. |

Nếu cần **rút gọn MVP**: S1 + S2 chỉ lưu `ppf_job_items` dạng audit, vẫn dùng một cuộn BODY duy nhất cho kho demo (rủi ro nghiệp vụ — cần sign-off BA).

---

## 5. Liên kết tài liệu / mã liên quan

- Định mức WF: `vehicle_norm_api.py`, `vehicle_norm_logic.py`.  
- Tạo đơn thủ công: `customer_api.py` (manual-create), `static/app.js` (payload `service_selection`).  
- Gợi ý dòng xe chỉ từ định mức: `GET /api/vehicle-norms/model-options?source=norms`.

---

*Tài liệu có thể cập nhật theo quyết định BA về tách workstream PPF (1 vs 3) và quy tắc LOT cho kính lái.*
