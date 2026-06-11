# Hướng Dẫn Chạy Hệ Thống Quản Lý DYC

## Môi trường CSDL (Database)

- **Canonical DB:** `web_demo/warehouse_demo.db`
- **Lưu ý quan trọng:** Không dùng hoặc khởi tạo Database ở thư mục Root (nằm ngoài `web_demo`). Cơ sở dữ liệu chính và toàn bộ file backend, frontend tĩnh đều đặt bên trong thư mục `web_demo/`.
- Nếu bạn cần mở CSDL bằng phần mềm DB Viewer (DBeaver, SQLite DB Browser...), hãy đảm bảo bạn đang mở đúng file `web_demo/warehouse_demo.db`.
- **KHÔNG CHẠY** lệnh `python populate_db.py` nếu chưa backup cơ sở dữ liệu hiện tại vì điều này có nguy cơ ghi đè dữ liệu.

## Lệnh Chạy App Chuẩn

Để chạy ứng dụng bằng uvicorn, thực hiện các lệnh sau:

```bash
cd web_demo
python -m uvicorn main:app --reload --port 8000
```

Hoặc bạn có thể click đúp vào file `run_app.bat` nằm trong thư mục `web_demo` để khởi chạy máy chủ trên Windows.

## Đăng nhập (demo)

Trình duyệt mở `http://127.0.0.1:8000/` — **bắt buộc đăng nhập** trước khi gọi API.

| Tên đăng nhập | Mật khẩu | Vai trò |
|---------------|----------|---------|
| `admin` | `dyc123` | Admin — toàn quyền (gồm reset DB nếu bật env). |
| `quanly` | `dyc123` | Quản lý — không được lưu **Phân bổ LOT** / duyệt mã phim WF trên bảng phân bổ. |
| `ktv` | `dyc123` | KTV — không phê duyệt **đơn** / **luồng PPF chờ QL**; không sửa **Nhân sự** (chỉ xem). |

**Bảo mật:** trên môi trường thật hãy đặt biến môi trường `DYC_AUTH_SECRET` (chuỗi dài, ngẫu nhiên) và đổi mật khẩu tài khoản trong bảng `app_users`.

**Phiên & audit:** các thao tác phê duyệt / phân bổ / ghi nhận trên server lấy **username từ cookie phiên**; client không cần (và không nên) gửi `actor` giả mạo cho các API đó. Form kho (xuất/clear/sửa meta nhập) mặc định điền username đang đăng nhập.

## Kiểm tra RBAC (pytest)

Trong thư mục `web_demo`, sau khi `pip install -r requirements.txt`:

```bash
python -m pytest tests/test_rbac_auth.py -v
```

Các case kiểm tra: Quản lý bị chặn PUT phân bổ / POST duyệt mã phim WF; KTV bị chặn phê duyệt đơn, ghi HR, phê duyệt luồng PPF `PENDING_APPROVAL`; Admin không dính mã `MANAGER_NO_ALLOCATION_WRITE` trên PUT phân bổ (404 nếu WS không tồn tại).

```bash
python -m pytest tests/test_telegram_notification_service.py -v
```

```bash
python -m pytest tests/test_daily_report_api.py -v
```

## Báo cáo ngày (trong tab Báo cáo tháng)

- `GET /api/reports/daily?date=YYYY-MM-DD` — JSON dashboard ngày (cần đăng nhập).
- `GET /api/reports/daily/export-html?date=YYYY-MM-DD` — tải file HTML (cookie phiên).

## Telegram (thông báo group) & báo cáo định kỳ

- **Token không lộ ra frontend:** chỉ cấu hình trên server (Render / env). Tab **Telegram** (Admin) chỉ xem trạng thái, log, gửi tin thử — không nhập bot token trên UI.
- **Deep link SPA:** `/?tab=requests&request_id=…`, `…&workstream_id=…`, `…&job_card_id=…`, `…&tab=monthly&month=YYYY-MM` (cần set `DYC_PUBLIC_BASE_URL` đúng URL public).

**Biến môi trường (Render):**

| Biến | Ý nghĩa |
|------|---------|
| `TELEGRAM_ENABLED` | `true` / `false` — tắt thì chỉ ghi log `SKIPPED`, không gọi Bot API. |
| `TELEGRAM_BOT_TOKEN` | Token bot (bí mật). |
| `TELEGRAM_GROUP_CHAT_ID` | Chat ID nhóm nội bộ. |
| `TELEGRAM_GROUP_DISPLAY_NAME` | Tên hiển thị (mặc định: `DYC Vận hành Group`). |
| `DYC_PUBLIC_BASE_URL` | URL gốc website (không hard-code localhost trong tin nhắn). |
| `DYC_REPORT_TIMEZONE` | Mặc định `Asia/Ho_Chi_Minh`. |
| `DYC_DAILY_REPORT_TIME` | Tham chiếu tài liệu (cron ngoài quyết định giờ gọi). |
| `DYC_MONTHLY_REPORT_TIME` | Tham chiếu tài liệu. |
| `DYC_MONTHLY_REPORT_DAY` | Tham chiếu tài liệu. |

**Cron / scheduler ngoài app (khuyến nghị trên Render Free):** service có thể ngủ — gọi HTTP định kỳ từ bên ngoài (cron-job.org, GitHub Actions, v.v.) kèm cookie phiên Admin **hoặc** mở rộng sau bằng secret header riêng nếu cần.

- `POST /api/reports/telegram/daily` — báo cáo đầu ngày (dữ liệu “hôm qua + tồn hiện tại” theo logic service).
- `POST /api/reports/telegram/monthly` — gửi báo cáo **tháng trước** (phù hợp gọi ngày 01 hằng tháng).

Các endpoint test/log Telegram: `GET /api/integrations/telegram/status`, `POST …/test-group-message`, `GET …/message-logs`, `POST …/retry/{log_id}` — **chỉ Admin** (cookie phiên).

