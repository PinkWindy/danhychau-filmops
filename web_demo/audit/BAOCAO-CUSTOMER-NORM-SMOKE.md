# Báo cáo — Customer AMIS & Vehicle film norms

**Ngày:** 2026-06-04  
**Môi trường kiểm tra:** local (`python customer_norm_smoke_test.py` từ thư mục `web_demo`)  
**Trạng thái tổng thể:** không có lỗi runtime; kết thúc bằng dòng `CUSTOMER AMIS & VEHICLE NORM SMOKE TEST PASSED`.

---

## 1. Kết quả `customer_norm_smoke_test.py`

Script chạy **20 case**, tất cả **PASS**. Bảng tóm tắt:

| # | Nội dung case | Kết quả |
|---|----------------|---------|
| 1 | `GET /api/dealers` có field AMIS/address (`customer_category`, `full_address`, …) | PASS |
| 2 | `POST /api/dealers` tạo dealer đủ trường AMIS | PASS |
| 3 | `PUT /api/dealers/{id}` bắt buộc `reason` | PASS |
| 4 | `POST /api/dealers/{id}/deactivate` | PASS |
| 5 | `POST /api/dealers/{id}/activate` | PASS |
| 6 | `GET /api/end-customers` có field AMIS | PASS |
| 7 | `POST /api/end-customers` tạo KH đủ field | PASS |
| 8 | `PUT /api/end-customers/{id}` bắt buộc `reason` | PASS |
| 9 | `POST /api/end-customers/{id}/deactivate` | PASS |
| 10 | `POST /api/end-customers/{id}/activate` | PASS |
| 11 | `GET /api/vehicle-norms` có seed **RX300** / **RX350** | PASS |
| 12 | `POST /api/vehicle-norms` tạo norm mới | PASS |
| 13 | `POST` trùng bộ (dòng xe + loại phim + khoảng năm) khi cả hai **ACTIVE** → **409** | PASS |
| 14 | `PUT /api/vehicle-norms/{norm_id}` có `reason` | PASS |
| 15 | `POST .../deactivate` | PASS |
| 16 | `POST .../activate` | PASS |
| 17 | `GET /api/vehicle-norms/resolve` (RX350, 2022) → `found: true` | PASS |
| 18 | Auto-fill: WINDSHIELD **RT40** `90x152`; các kính khác **JB20** đúng size | PASS |
| 19 | `POST /api/requests/manual-create` chỉ Window Film → dùng norm (có `request_id` trả về) | PASS |
| 20 | Gọi lại `manual_order_customer_smoke_test.py` (subprocess) | PASS |

**Ghi chú:** Cột *Detail* của case 20 trên Windows đôi khi hiển thị ký tự lỗi encoding ở cuối buffer subprocess; **return code = 0** và chuỗi `MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED` vẫn có trong stdout → case được xem là PASS.

**Log lỗi:** *Không có* — lần chạy gần nhất `exit code 0`, không có traceback.

---

## 2. API mới nhóm **vehicle-norms**

Base path: **`/api`** (cùng prefix router hiện tại).

| Phương thức | Đường dẫn | Mô tả ngắn |
|--------------|-----------|------------|
| **GET** | `/api/vehicle-norms` | Danh sách định mức. Query tùy chọn: `vehicle_model_code`, `film_type`, `status`, `q` (tìm theo `norm_id`, mã xe, khoảng năm, loại phim). |
| **GET** | `/api/vehicle-norms/resolve` | Resolve định mức **ACTIVE**: bắt buộc `vehicle_model_code`, `film_type`; `model_year` tùy chọn. Trả `{ found, norm, auto_fill_items }`. |
| **POST** | `/api/vehicle-norms` | Tạo bản ghi mới; kiểm tra trùng **ACTIVE** cùng `(vehicle_model_code, film_type, model_year_range)` → 409. Audit: `VEHICLE_NORM_CREATED`. |
| **PUT** | `/api/vehicle-norms/{norm_id}` | Cập nhật; **bắt buộc** `reason` trong body; đồng bộ chuỗi size từ cm. Audit: `VEHICLE_NORM_UPDATED`. |
| **POST** | `/api/vehicle-norms/{norm_id}/activate` | `status = ACTIVE`; **bắt buộc** `reason`. Audit: `VEHICLE_NORM_ACTIVATED`. |
| **POST** | `/api/vehicle-norms/{norm_id}/deactivate` | `status = INACTIVE`; **bắt buộc** `reason`. Audit: `VEHICLE_NORM_DEACTIVATED`. |

**Nội dung JSON điển hình `auto_fill_items` (resolve):** mỗi phần tử có `job_item`, `material_code` (kính lái **RT40**, còn lại **JB20**), `size`, `width_cm`, `length_cm` — chỉ các cặp kích thước > 0.

---

## 3. Tab **Khách hàng** sau khi có định mức (mô tả giao diện)

*Không chụp ảnh màn hình thực tế từ máy bạn trong báo cáo này; mô tả theo code UI hiện tại (`static/app.js` + `static/index.html`).*

### 3.1. Thanh sub-tab chính

- **Đại lý** | **Khách hàng lẻ** | **Hồ sơ xe**  
- Mỗi tab có KPI nhỏ phía trên (tổng số, active, v.v. tùy tab).

### 3.2. Khi chọn **Hồ sơ xe**

Phía dưới KPI xuất hiện **hai nút phụ**:

- **Danh sách xe** — bảng: `vehicle_id`, model, VIN masked, dealer, customer, trạng thái; nút **Xem** (drawer JSON history), **Active / Inactive** (có prompt lý do).
- **Định mức phim** — bảng cuộn ngang (font nhỏ ~10px) gồm: loại phim, dòng xe, khoảng năm model, các cột **width/length** gom nhóm (KL = kính lái, KH = kính hậu, ST = sườn trước, SSTG = sườn sau + tam giác, TG, SS, KT = kính trời), **Trạng thái**, **Thao tác**.

Nút **+ Thêm định mức** mở modal nhanh (form: `norm_id`, loại phim, mã xe, khoảng năm, các size dạng `90x152`, …). Modal có nút **X** góc phải (cùng họ với các modal demo / quick / drawer).

Sau khi seed hoặc thêm norm (ví dụ **RX300**, **RX350**), bảng **Định mức phim** hiển thị các dòng tương ứng; có thể **Sửa** / **On** / **Off** từng dòng.

### 3.3. Sơ đồ bố cục (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│  [ Đại lý ]  [ Khách hàng lẻ ]  [ Hồ sơ xe ]                │
├─────────────────────────────────────────────────────────────┤
│  KPI: Tổng xe · Xe chưa gắn KH                               │
│  [ Danh sách xe ]  [ Định mức phim ]   ← sub-tab trong Xe  │
├─────────────────────────────────────────────────────────────┤
│  [ + Thêm định mức ]                                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Phim │ Dòng │ Năm │ KL │ KH │ ST │…│ TT │ Sửa│On/Off│   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Phim cách nhiệt │ RX350 │ 2013-2022 │ 90/152 │ … │ ACT │  │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Log lỗi

**Không phát sinh lỗi** trong lần chạy smoke test ghi nhận ở mục 1 (`exit code 0`).

Nếu sau này cần log đầy đủ khi FAIL, chạy:

```bash
cd web_demo
python customer_norm_smoke_test.py > customer_norm_smoke_log.txt 2>&1
```

và gửi file `customer_norm_smoke_log.txt`.

---

*Tệp nằm trong `web_demo/audit/` — tài liệu nghiệm thu / báo cáo test; có thể đính kèm email / Confluence / repo nội bộ.*
