# DYC — Web demo (FastAPI + SQLite + SPA)

Ứng dụng quản lý kho phim / đơn thi công / khách hàng / định mức. **Local:** SQLite mặc định. **Online vận hành:** nên cấu hình `DATABASE_URL` trỏ PostgreSQL (xem [`DEPLOY.md`](./DEPLOY.md) phần B2).

Chạy local:

```bash
cd web_demo
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Mở trình duyệt: `http://127.0.0.1:8000/static/index.html` (hoặc URL gốc tùy cấu hình `main.py`).

## Reset database demo (seed chuẩn)

Chạy trong thư mục `web_demo` (script tự kiểm tra cwd). Script backup `warehouse_demo.db` vào `backups/`, xóa file DB runtime (và `-wal`/`-shm` nếu xóa được), tạo schema + seed idempotent.

```bash
cd web_demo
python reset_database_full_seed.py
python database_seed_integrity_smoke_test.py
```

PowerShell (Windows) — nếu cần xóa file DB thủ công trước khi seed:

```powershell
cd "D:\Quản lý vận hành DYC\web_demo"
New-Item -ItemType Directory -Force -Path ".\backups" | Out-Null
Copy-Item ".\warehouse_demo.db" ".\backups\warehouse_demo_$(Get-Date -Format yyyyMMdd_HHmmss).db" -ErrorAction SilentlyContinue
Remove-Item ".\warehouse_demo.db" -Force -ErrorAction SilentlyContinue
Remove-Item ".\warehouse_demo.db-wal" -Force -ErrorAction SilentlyContinue
Remove-Item ".\warehouse_demo.db-shm" -Force -ErrorAction SilentlyContinue
python reset_database_full_seed.py
python database_seed_integrity_smoke_test.py
python generate_database_standard_seed_report.py
```

Script **`generate_database_standard_seed_report.py`** (không reset DB): đếm bảng + phân tích Excel + kiểm tra norm/PPF/material/OCR/demo request, chạy smoke subprocess, ghi [`audit/database-standard-seed-report.md`](./audit/database-standard-seed-report.md). Chạy khi cần nghiệm thu; **không cần reset** nếu DB đã seed chuẩn và bạn chỉ muốn làm mới báo cáo (script vẫn chạy smoke — có thể làm thay đổi tồn kho sau bước đếm, xem ghi chú trong báo cáo).

## Cấu trúc thư mục (tóm tắt)

| Mục | Mô tả |
|-----|--------|
| `main.py` | FastAPI app, mount router, static |
| `*_api.py`, `database.py`, `vehicle_norm_logic.py`, … | Backend Python |
| `static/` | `index.html`, `app.js`, `style.css` — **không** di chuyển |
| `data/` | Dữ liệu tĩnh phụ trợ (nếu có) — **không** di chuyển |
| `warehouse_demo.db` | SQLite — **ở root** `web_demo/` (có thể không commit; xem `DEPLOY.md`) |
| `*_smoke_test.py` | Script kiểm thử API — **ở root** `web_demo/` |
| **`audit/`** | Chỉ **tài liệu** nghiệm thu / báo cáo test (`.md`, tiền tố `BAOCAO-`). Xem [`audit/README.md`](./audit/README.md). |

### `audit/` vs audit log nghiệp vụ

- Thư mục **`audit/`** chỉ chứa file markdown báo cáo; **FastAPI không phụ thuộc** vào thư mục này để khởi động hay xử lý request.
- **Nhật ký nghiệp vụ thật** (ai đổi gì, lý do, v.v.) nằm trong database, bảng tương ứng ORM **`DbAuditLog`** (`audit_logs`). Tab **Nhật ký kiểm toán** trên UI đọc dữ liệu đó.

## Tài liệu thêm

- [`DEPLOY.md`](./DEPLOY.md) — đưa demo lên Render / GitHub  
- [`HUONG-DAN-GITHUB-NGUOI-MOI.md`](./HUONG-DAN-GITHUB-NGUOI-MOI.md) — Git cho người mới  

## Cập nhật danh mục Tỉnh/Thành phố — Phường/Xã

1. Đặt file **`Danh-muc-Phuong-xa_moi.csv`** vào `web_demo/data/` (UTF-8; cột **C** = Tên tỉnh/TP, cột **I** = Tên Phường/Xã — dòng 1 header). Có thể đặt bản sao cùng cấp thư mục gốc dự án; script sẽ tự tìm nếu thiếu trong `data/`. Chi tiết: [`data/README-DIA-BAN.txt`](./data/README-DIA-BAN.txt).
2. Trong thư mục `web_demo`: `python location_master_import.py`
3. Kiểm tra file sinh ra: `static/location_master.json`
4. Khởi động lại app (`uvicorn`).

Nếu chưa có `location_master.json`, app vẫn chạy; API `/api/location/*` trả danh sách rỗng và form vẫn cho gõ tay Tỉnh/TP và Phường/Xã.

## `.gitignore` (trong `web_demo/`)

Bỏ qua `__pycache__/`, `*.pyc`, `.venv/`, `*.bak`, … — xem file `.gitignore` tại đây.
