# Checkpoint — Web vận hành (PostgreSQL) & làm tiếp sau

**Lưu ngày:** có thể cập nhật khi tiếp tục.

## Đã xong trong code (đã push `main`)

| Commit / nội dung | Ghi chú |
|-------------------|--------|
| `8dc41be` | WF: kính lái / gộp khổ — mét chạy cuộn đúng tận khổ (vd 87×152 → 0,87m); modal JS đồng bộ; `roll_cut_summary` kèm cm chạy cuộn. |
| `40aef37` | Deploy: `DATABASE_URL` → PostgreSQL (`psycopg2-binary`); SQLite giữ mặc định. Seed demo startup: mặc định **không** seed trên Postgres; `DYC_STARTUP_SEED_DEMO` để ghi đè. Reset API chỉ SQLite. `DEPLOY.md` **Phần B2**, `README`, `.env.example`, `.gitignore` (cho phép `.env.example`). |

## Việc còn lại (bạn / lúc khác) — Render

1. Tạo **PostgreSQL** trên Render (hoặc DB ngoài).
2. Web Service → **Environment** → thêm **`DATABASE_URL`** = Internal URL (hoặc link DB vào service).
3. **Deploy lại** (build cài `psycopg2-binary`).
4. DB trống lần đầu: Shell `cd web_demo && python populate_db.py` **hoặc** nhập tay qua UI (tùy quy trình).
5. **Không** bật `ALLOW_DB_RESET` trên môi trường thật. Reset qua API **chỉ** hỗ trợ SQLite.

Chi tiết từng bước: [`../DEPLOY.md`](../DEPLOY.md) — mục **Phần B2 — Vận hành thật (production)**.

## Biến môi trường nhớ nhanh

- `DATABASE_URL` — Postgres (bỏ trống = SQLite file `web_demo/warehouse_demo.db`).
- `DYC_STARTUP_SEED_DEMO` — `true` / `false`; trống: SQLite có thể seed nếu DB trống; Postgres mặc định không seed.

## File local thường không commit

`warehouse_demo.db`, `Danh-muc-*`, `web_demo/backups/`, file Excel tạm `~$...` — chỉ máy bạn; khôngnh hưởng GitHub/Render nếu không `git add`.

---

*Mở file này khi quay lại để nối việc triển khai production trên Render.*
