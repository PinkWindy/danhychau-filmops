# Location Master & Address Auto-build Update Report

## 1. Summary

- Đã import danh mục Tỉnh/Thành phố và Phường/Xã từ file Excel chính thức (`Danh-muc-Phuong-xa_moi.xlsx`).
- Cột **D** dùng cho Tỉnh/Thành phố; cột **J** dùng cho Phường/Xã (sheet `1.DM Phường xã mới`, header dòng 3, dữ liệu từ dòng 4).
- Dữ liệu được sinh ra thành `static/location_master.json`.
- UI dùng API `GET /api/location/provinces` và `GET /api/location/wards` để đổ datalist gợi ý; người dùng vẫn gõ tay được.
- Ghép **full_address** (frontend + backend) tránh lỗi dư tiền tố (ví dụ `Phường Phường`, `Đường Đường`, `Thành phố Thành phố`).
- Nút **Tự tạo lại địa chỉ** trong modal Tạo/Sửa đại lý và Sửa khách hàng ghi đè `full_address` sau khi user đã chỉnh tay trường đầy đủ.

## 2. Data Source

| Mục | Giá trị |
|-----|---------|
| File | `data/Danh-muc-Phuong-xa_moi.xlsx` (hoặc bản sao tại thư mục gốc dự án — xem `location_master_import.py`) |
| Sheet | `1.DM Phường xã mới` |
| Tỉnh/TP | Cột **D** |
| Phường/Xã | Cột **J** |
| Header | Dòng **3** |
| Dữ liệu | Từ dòng **4** |

## 3. Files Changed

| File | Mô tả |
|------|--------|
| `location_master_import.py` | Script đọc Excel → `static/location_master.json` |
| `location_api.py` | Router `/api/location/provinces`, `/api/location/wards` |
| `main.py` | Đăng ký `register_location_routes` |
| `vehicle_norm_logic.py` | `normalize_address_part`, `format_street`, `format_ward`, `format_province`, `build_full_address` |
| `customer_api.py` | POST/PUT dealer & end-customers: tự build `full_address` khi trống; cập nhật khi đổi thành phần địa chỉ |
| `static/app.js` | `DYC_LOCATION_MASTER`, load provinces/wards, datalist; `buildFullAddress` đồng bộ logic Python; nút tự tạo lại địa chỉ |
| `location_master_address_smoke_test.py` | Smoke import + API + `build_full_address` + POST/PUT |
| `data/README-DIA-BAN.txt` | Hướng dẫn đặt file Excel |
| `README.md`, `DEPLOY.md` | Mục cập nhật danh mục địa bàn |
| `audit/location-master-address-update-report.md` | Báo cáo này |

## 4. Address Build Rules

- Không thêm **Phường** nếu phường/xã đã bắt đầu (không phân biệt hoa thường) bằng: Phường, Xã, Thị trấn, Đặc khu.
- Không thêm **Đường** nếu đường đã bắt đầu bằng các dạng: Đường, Duong, Quốc lộ, QL, Tỉnh lộ, TL, Đại lộ, Hẻm, Ngõ, Ngách, Kiệt.
- **Tỉnh/Thành phố:** không thêm tiền tố trùng; giữ nguyên nếu đã có dạng Thành phố, TP., TP , Tỉnh (đồng bộ Python/JS).
- Bỏ qua phần rỗng; không tạo dấu phẩy dư giữa các phần.

## 5. Smoke Test Result

**Thời điểm chạy test (máy dev):** 2026-06-04 15:21:11 +07:00  

**Lệnh đã chạy (thư mục `web_demo/`):**

1. `python location_master_import.py`
2. `python location_master_address_smoke_test.py`

### 5.1 Kết quả `location_master_import.py`

| Chỉ số | Giá trị thực tế |
|--------|-----------------|
| Số tỉnh/thành phố import được | **3** |
| Số phường/xã import được (tổng sau dedupe, `items_count`) | **5** |
| File JSON đầu ra | `static/location_master.json` |

**5 tỉnh/thành phố mẫu** (trong lần import này chỉ có 3 bản ghi tỉnh/TP — liệt kê đủ):  
`Tỉnh Đồng Nai`, `Thành phố Hà Nội`, `Thành phố Hồ Chí Minh`  
*(Thứ tự in trên console import: sort locale — `Tỉnh Đồng Nai`, `Thành phố Hà Nội`, `Thành phố Hồ Chí Minh`.)*

**5 phường/xã mẫu Thành phố Hồ Chí Minh** (trong master hiện có **2** phường cho TP.HCM — liệt kê đủ):  
`Phường An Phú`, `Phường Cầu Ông Lãnh`

> *Ghi chú:* Con số 3 / 5 phản ánh file `data/Danh-muc-Phuong-xa_moi.xlsx` đang có trên máy (tập mẫu / tập rút gọn). Khi thay bằng file Excel danh mục đầy đủ và chạy lại import, cập nhật lại mục này.

### 5.2 Kết quả từng test case (`location_master_address_smoke_test.py`)

| # | Kết quả | Mô tả ngắn |
|---|---------|------------|
| 1 | PASS | File Excel tồn tại |
| 2 | PASS | Chạy import → `location_master.json` (provinces=3, wards=5) |
| 3 | PASS | JSON có key `data` |
| 4 | PASS | Có ít nhất 1 tỉnh/TP |
| 5 | PASS | Có ít nhất 1 phường/xã |
| 6 | PASS | `GET /api/location/provinces` → 200 |
| 7 | PASS | `provinces` có `items` |
| 8 | PASS | `GET /api/location/wards?province=Thành phố Hà Nội` → 200 |
| 9 | PASS | `GET /api/location/wards?province=Thành phố Hồ Chí Minh` có items |
| 10 | PASS | Province không tồn tại → `items: []` |
| 11 | PASS | `build_full_address` đủ phần, không `Phường Phường` |
| 12 | PASS | Ward thiếu tiền tố → thêm `Phường` đúng |
| 13 | PASS | Street đã có `Đường` → không `Đường Đường` |
| 14 | PASS | City đã có `Thành phố` → không lặp |
| 15 | PASS | `POST /api/dealers` — `full_address` tự build |
| 16 | PASS | `POST /api/end-customers` — `full_address` tự build |
| 17 | PASS | `PUT /api/dealers/{id}` — ward từ master |
| 18 | PASS | `PUT /api/end-customers/{id}` — ward gõ tay ngoài master |

**Dòng kết luận thực tế (stdout):**

```text
LOCATION MASTER & ADDRESS BUILD SMOKE TEST PASSED
```

**Trạng thái:** toàn bộ case PASS — không có case fail; không ghi nhận lỗi endpoint hay hàm trong lần chạy này.

## 6. Remaining Notes

- Danh mục phụ thuộc file Excel đầu vào; cần chạy lại import khi Bộ/Nhà nước cập nhật danh mục.
- Vẫn cho gõ tay để xử lý trường hợp đặc biệt hoặc chưa có trong master.
- Có thể nâng cấp sau thành bảng DB riêng nếu cần quản trị địa bàn từ backend.

## 7. Final Status

Đã có **smoke test thật** (mục 5) — toàn bộ PASS tại thời điểm ghi nhận.

**LOCATION MASTER & ADDRESS AUTO-BUILD READY FOR DEMO**
