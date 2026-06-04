# DYC — Web demo (FastAPI + SQLite + SPA)

Ứng dụng demo quản lý kho phim / đơn thi công / khách hàng / định mức. Chạy local:

```bash
cd web_demo
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Mở trình duyệt: `http://127.0.0.1:8000/static/index.html` (hoặc URL gốc tùy cấu hình `main.py`).

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

1. Đặt file Excel chính thức vào `web_demo/data/Danh-muc-Phuong-xa_moi.xlsx` (hoặc đặt cùng cấp thư mục gốc dự án — script import sẽ tự tìm). Chi tiết sheet/cột: xem [`data/README-DIA-BAN.txt`](./data/README-DIA-BAN.txt).
2. Trong thư mục `web_demo`: `python location_master_import.py`
3. Kiểm tra file sinh ra: `static/location_master.json`
4. Khởi động lại app (`uvicorn`).

Nếu chưa có `location_master.json`, app vẫn chạy; API `/api/location/*` trả danh sách rỗng và form vẫn cho gõ tay Tỉnh/TP và Phường/Xã.

## `.gitignore` (trong `web_demo/`)

Bỏ qua `__pycache__/`, `*.pyc`, `.venv/`, `*.bak`, … — xem file `.gitignore` tại đây.
