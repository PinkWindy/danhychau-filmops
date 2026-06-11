# Hướng dẫn từng bước — đưa web demo DYC lên online

> **Bạn chưa từng dùng Git/GitHub?** Đọc file riêng, giải thích rất chậm và ưu tiên bấm chuột:  
> **[HUONG-DAN-GITHUB-NGUOI-MOI.md](./HUONG-DAN-GITHUB-NGUOI-MOI.md)**

## Thư mục `web_demo/audit/` (báo cáo — không phải runtime)

- **`audit/`** nằm **cùng cấp** với `main.py`, `static/`, `data/`: chỉ dùng cho **tài liệu nghiệm thu**, **báo cáo smoke/UAT**, file markdown tiền tố **`BAOCAO-`**. Chi tiết: [`audit/README.md`](./audit/README.md).
- **Audit log nghiệp vụ thật** (thao tác user, thay đổi dữ liệu có `reason`, v.v.) nằm trong DB (SQLite `warehouse_demo.db` hoặc PostgreSQL khi bạn cấu hình `DATABASE_URL`), bảng **`audit_logs`** (ORM: `DbAuditLog`) — xem trên UI tab **Nhật ký kiểm toán**. Việc có/không có thư mục `audit/` **không ảnh hưởng** tới việc khởi động hay chạy FastAPI.
- Các script Python `*_smoke_test.py` vẫn ở **root** `web_demo/` (không đặt trong `audit/`).

Mục tiêu: có một **URL công khai** (HTTPS) mở được ứng dụng, API chạy ổn, dữ liệu có thể cấu hình **demo (SQLite)** hoặc **vận hành (PostgreSQL)** — xem **Phần B2**.

**Công cụ dùng trong bài này:** GitHub (lưu code) + Render (chạy server Python). **Vercel** chỉ nhắc ở cuối (tùy chọn), vì app của bạn là FastAPI — phù hợp Render; DB nên dùng **PostgreSQL** nếu cần lưu trữ lâu dài.

**Quan trọng:** Trong repo phải có **cả hai** thư mục `web_demo/` **và** `knowledge/` (cùng cấp). Script `populate_db.py` đọc CSV từ `knowledge/`. Không được chỉ upload mỗi thư mục `web_demo` nếu thiếu `knowledge/`.

---

## Cập nhật danh mục Tỉnh/Thành phố — Phường/Xã

**Bước 1:** Đặt file CSV danh mục vào:

`web_demo/data/Danh-muc-Phuong-xa_moi.csv`

(Cột **C** = Tên tỉnh/Thành phố, cột **I** = Tên Phường/Xã; dòng đầu là header. UTF-8.)

**Bước 2:** Trên máy build/deploy, trong thư mục `web_demo`:

```bash
python location_master_import.py
```

**Bước 3:** Kiểm tra file sinh ra:

`web_demo/static/location_master.json`

**Bước 4:** Khởi động lại dịch vụ (Render: **Manual Deploy** hoặc push trigger tùy cấu hình).

**Lưu ý:**

- App vẫn khởi động nếu chưa có `location_master.json`; API `/api/location/provinces` và `/api/location/wards` trả `{ "items": [] }` và server ghi log cảnh báo.
- Người dùng vẫn có thể gõ tay Tỉnh/Thành phố và Phường/Xã; danh mục chỉ phục vụ gợi ý (datalist), không ép validate.

---

## Phần A — Đưa code lên GitHub (từng bước)

### Bước A1 — Tạo tài khoản / đăng nhập GitHub

1. Mở trình duyệt → [https://github.com](https://github.com).
2. Đăng ký hoặc **Sign in**.

### Bước A2 — Tạo repository mới

1. Góc phải trên cùng → dấu **+** → **New repository**.
2. **Repository name:** ví dụ `dyc-film-warehouse-demo` (tên tùy bạn).
3. Chọn **Public** hoặc **Private**.
4. **Không** tick “Add a README” nếu bạn đã có sẵn code trên máy (tránh conflict lần đầu).
5. Bấm **Create repository**.

### Bước A3 — Chuẩn bị thư mục trên máy Windows

1. Mở **File Explorer**, vào thư mục **gốc dự án** — tức thư mục cha của `web_demo`  
   (ví dụ: `d:\Quản lý vận hành DYC` — bên trong phải thấy được `web_demo` và `knowledge`).

2. Mở **PowerShell** tại thư mục đó:  
   Shift + chuột phải vào nền thư mục → **Open in Terminal** / **Open PowerShell window here**.

### Bước A4 — Kiểm tra Git

Trong PowerShell gõ:

```powershell
git --version
```

- Nếu báo lỗi không nhận lệnh: cài [Git for Windows](https://git-scm.com/download/win), cài xong mở lại PowerShell.

### Bước A5 — Khởi tạo Git và lần đầu commit

Chạy lần lượt (thay `YOUR_USER` và `YOUR_REPO` bằng tài khoản và tên repo GitHub của bạn):

```powershell
git init
git branch -M main
```

Tạo file `.gitignore` ở **gốc repo** (cùng cấp với `web_demo`) nếu chưa có, nội dung gợi ý:

```gitignore
__pycache__/
*.pyc
.env
.venv/
venv/
*.db-journal
.idea/
```

*(Trong thư mục `web_demo/` cũng có file `.gitignore` tương tự — tiện khi clone chỉ làm việc trong `web_demo` hoặc submodule.)*

Sau đó:

```powershell
git add .
git status
git commit -m "DYC web demo: initial push"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

- Lần đầu `git push`, GitHub có thể hỏi đăng nhập: dùng **Personal Access Token** (khuyến nghị) hoặc GitHub CLI.

### Bước A6 — Xác nhận trên GitHub

1. Mở repo trên GitHub trong trình duyệt.
2. Kiểm tra có thư mục **`web_demo`**, **`knowledge`**, và file **`web_demo/requirements.txt`**.

**Xong phần A** khi bạn thấy code đã lên GitHub đầy đủ.

---

## Phần B — Tạo Web Service trên Render (từng bước)

### Bước B1 — Tạo tài khoản Render

1. Mở [https://render.com](https://render.com) → **Get Started for Free**.
2. Chọn **Sign up with GitHub** (tiện nhất) và cho phép Render truy cập repo.

### Bước B2 — Tạo Web Service mới

1. Vào [Dashboard](https://dashboard.render.com).
2. **New +** → **Web Service**.
3. **Connect a repository:** chọn repo vừa push (nếu chưa thấy → **Configure account** và cấp quyền repo).

### Bước B3 — Điền thông tin service

Gợi ý điền như sau:

| Trường trên Render | Giá trị |
|--------------------|--------|
| **Name** | `dyc-web-demo` (hoặc tên bạn thích — sẽ nằm trong URL) |
| **Region** | Singapore / Oregon (tùy gần bạn) |
| **Branch** | `main` |
| **Root Directory** | *(để trống)* — dùng cả repo để có `knowledge/` |
| **Runtime** | **Python 3** |
| **Build Command** | `pip install -r web_demo/requirements.txt` |
| **Start Command** | `cd web_demo && uvicorn main:app --host 0.0.0.0 --port $PORT` |

**Lưu ý:** Phải có `--port $PORT` — Render tự gán cổng qua biến môi trường `PORT`.

### Bước B4 — Chọn gói (plan)

- **Free:** miễn phí, service có thể **ngủ** sau một lúc không có người truy cập; lần mở đầu sau khi ngủ có thể chậm 30–60 giây.
- Bấm **Create Web Service**.

### Bước B5 — Chờ build và deploy

1. Render hiển thị log **Build** rồi **Deploy**.
2. Nếu build lỗi (đỏ): đọc log — thường là thiếu file `web_demo/requirements.txt` hoặc sai đường dẫn.

### Bước B6 — Lấy URL

1. Trên trang service, phần trên có URL dạng:  
   `https://dyc-web-demo.onrender.com` (tùy **Name** bạn đặt).
2. Mở URL đó bằng trình duyệt.

**Xong phần B** khi trang web mở được (có thể lỗi dữ liệu nếu chưa seed — làm phần C).

---

## Phần B2 — Vận hành thật (production): PostgreSQL + không seed demo tự động

**Vì sao cần:** SQLite trên ổ instance Render (free) thường **không bền** — redeploy có thể làm mất file DB. Để mọi thao tác bạn làm trên web **được lưu ổn định**, nên gắn **PostgreSQL** (Render **PostgreSQL** hoặc DB ngoài) và trỏ app bằng biến môi trường.

### Bước B2.1 — Tạo PostgreSQL trên Render

1. Dashboard Render → **New +** → **PostgreSQL** (hoặc dùng DB có sẵn).
2. Sau khi tạo xong, copy **Internal Database URL** (dạng `postgresql://...` hoặc `postgres://...`).

### Bước B2.2 — Gắn vào Web Service

1. Mở **Web Service** (FastAPI) → **Environment**.
2. Thêm biến:
   - **`DATABASE_URL`** = URL vừa copy (Render thường tự inject nếu bạn **Link** Postgres vào service — tên biến có thể là `DATABASE_URL`; app đọc đúng tên này).
3. **Không** cần đặt `DYC_STARTUP_SEED_DEMO` trừ khi bạn muốn nạp bộ demo một lần trên DB trống (staging):
   - Mặc định với PostgreSQL: **không** tự seed demo khi khởi động — DB chỉ có dữ liệu bạn nhập / `populate_db.py` / import.
   - Một lần seed trên Postgres (DB trống): đặt `DYC_STARTUP_SEED_DEMO=true`, deploy, kiểm tra, rồi **xóa biến hoặc đặt `false`** để lần sau không ghi đè logic nghiệp vụ.

### Bước B2.3 — Deploy lại

Sau khi thêm `DATABASE_URL`, Render build lại (cài `psycopg2-binary` từ `requirements.txt`). Lần chạy đầu app gọi `create_all` — tạo đủ bảng trên Postgres.

### Bước B2.4 — Nạp dữ liệu ban đầu (nếu DB trống)

- Chạy **Shell** trên Web Service: `cd web_demo && python populate_db.py` **hoặc** nhập tay đại lý / kho trên UI — tùy quy trình của bạn.
- Endpoint **`POST /api/admin/reset-database-standard-seed`** chỉ dành cho **SQLite**; với PostgreSQL hãy dùng **backup/restore** (pg_dump) hoặc công cụ quản trị.

### Biến môi trường tóm tắt

| Biến | Ý nghĩa |
|------|--------|
| `DATABASE_URL` | Nếu có → dùng Postgres (hoặc URL khác SQLAlchemy hỗ trợ). Để trống → SQLite file `web_demo/warehouse_demo.db` (local / disk tạm). |
| `DYC_STARTUP_SEED_DEMO` | `true` / `false` / để trống. Trống: SQLite = seed nếu DB trống; PostgreSQL = **không** seed. |

---

## Phần C — Nạp dữ liệu mẫu (populate) trên Render

### Khi nào cần làm?

- Bạn **không** commit file `web_demo/warehouse_demo.db`, hoặc
- Mở web bị lỗi / trống dữ liệu.

### Bước C1 — Mở Shell trên Render

1. Vào service vừa tạo → menu **Shell** (hoặc **Connect** → shell — tùy giao diện Render).
2. Đợi shell khởi động.

### Bước C2 — Chạy seed

Gõ:

```bash
cd web_demo && python populate_db.py
```

Đợi báo `Database populated successfully.`

### Bước C3 — F5 lại trang web

Mở lại URL Render — danh sách đơn, kho, v.v. sẽ có dữ liệu demo.

**Xong phần C** khi web hoạt động bình thường với data.

---

## Reset database demo trên Render (tùy chọn — **chỉ môi trường demo**)

**Cảnh báo:** Không bật trên production thật. Endpoint xóa/seed lại toàn bộ SQLite.

1. Trên Render → Web Service → **Environment**, thêm tạm thời:
   - `ALLOW_DB_RESET=true`
   - `ADMIN_RESET_TOKEN=` (chuỗi bí mật dài, chỉ bạn biết)
2. Gọi (sau khi deploy):

   `POST /api/admin/reset-database-standard-seed`  
   Header: `X-Admin-Reset-Token: <cùng giá trị ADMIN_RESET_TOKEN>`

3. Sau khi reset xong: **tắt** `ALLOW_DB_RESET` hoặc **đổi** `ADMIN_RESET_TOKEN`.

Nếu thiếu env hoặc token sai → HTTP **403**.

---

## Phần D — Kiểm tra nhanh sau khi lên mạng

1. Mở URL `https://...onrender.com` — thấy giao diện chủ.
2. Thử chuyển tab **Quản lý kho**, **Đơn thi công** — có dữ liệu.
3. (Tùy chọn) Sau khi service “ngủ” lần đầu, mở lại URL — chờ vài chục giây để service dậy.

---

## Phần E1 — Telegram & báo cáo vận hành (tùy chọn)

- Cấu hình biến môi trường: `TELEGRAM_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`, `TELEGRAM_GROUP_DISPLAY_NAME`, `DYC_PUBLIC_BASE_URL`, `DYC_REPORT_TIMEZONE`, và các biến thời gian báo cáo (`DYC_DAILY_REPORT_TIME`, …). Chi tiết và lệnh pytest: **`RUN_APP.md`** (mục Telegram).
- Báo cáo định kỳ: dùng **cron bên ngoài** gọi `POST /api/reports/telegram/daily` và `POST /api/reports/telegram/monthly` (phiên Admin), vì instance Free có thể ngủ — scheduler trong process không đảm bảo chạy 24/7.

---

## Phần E — GitHub (tùy chọn): tự chạy test mỗi khi push

Nếu muốn CI kiểm tra trên GitHub:

1. Trong repo, tạo thư mục `.github/workflows/`.
2. Tạo file `web-demo-smoke.yml` với nội dung mẫu trong phần “GitHub Actions” bản cũ của tài liệu này (hoặc xem lại mục workflow trong repo nếu đã thêm).

---

## Phần F — Vercel (tùy chọn — không bắt buộc cho bản demo này)

- **Không khuyến nghị** host trực tiếp FastAPI + SQLite trên Vercel như một app serverless thuần — phức tạp và giới hạn thời gian chạy / file.
- **Nên dùng Vercel khi:** bạn muốn một **trang giới thiệu** tĩnh (HTML) có nút “Mở demo” trỏ sang URL Render.
- **Nếu sau này** tách frontend tĩnh lên Vercel và API ở Render: phải sửa mọi `fetch('/api/...')` trong `app.js` thành URL đầy đủ API và cấu hình CORS — làm thêm, không nằm trong bước tối thiểu.

---

## Ghi nhớ quan trọng

| Vấn đề | Giải thích ngắn |
|--------|------------------|
| **SQLite + Free Render** | Dữ liệu trên ổ instance có thể **mất khi redeploy** — chỉ phù hợp demo hoặc cần gắn **Persistent Disk** / chuyển **PostgreSQL** (xem Phần B2). |
| **PostgreSQL (DATABASE_URL)** | Dữ liệu bền theo DB; app **không** tự seed demo khi khởi động (trừ khi bật `DYC_STARTUP_SEED_DEMO=true`). |
| **HTTPS** | Render cấp sẵn — không cần cấu hình SSL thủ công. |
| **Bảo mật** | Repo demo không nên chứa mật khẩu thật, API key thật. |

---

## Checklist tổng hợp (làm lần lượt)

- [ ] A1–A6: Code có `web_demo` + `knowledge` đã push lên GitHub  
- [ ] B1–B6: Web Service Render build xanh, có URL  
- [ ] C1–C3: Đã chạy `populate_db.py` nếu cần  
- [ ] D: Đã mở URL và thử vài tab  

**File cần có trong repo:** `web_demo/requirements.txt` (đã có trong dự án để Render cài dependency).

Nếu bạn bị kẹt ở **một bước cụ thể** (ví dụ: `git push` lỗi, Render build đỏ), chụp/copy **dòng lỗi** gửi lại để xử lý đúng chỗ đó.
