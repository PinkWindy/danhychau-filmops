# Lịch sử cập nhật dự án (Phiên làm việc gần nhất)

File này lưu trữ lại các thay đổi đã được thực hiện để khi mở phiên chat (conversation) mới, AI có thể đọc và nắm bắt ngay tình trạng dự án mà không bị mất context.

---

## Phiên 08/06/2026 — UI DYC + Báo cáo ngày + Tạo đơn (đã lưu)

### A. Brand — Operations Portal (tổng thể)
- Theme **nền sáng** (`#F7F7F7` / trắng), chữ `#111`, viền `#E5E5E5`, nhấn **đỏ DYC `#D71920`**, CTA đen bo tròn, tab active **gạch đỏ**; biến `--dyc-*` trong `web_demo/static/style.css`.
- `web_demo/static/index.html`: logo/wordmark Operations Portal, hero, login, FAB; kiểm tra `style.css?v=` / `app.js?v=` trên `<head>` / cuối body.
- `web_demo/static/app.js`: Chart.js màu nền sáng; FAB Telegram chỉ Admin; giữ nguyên id / `data-tab` / logic nghiệp vụ theo cam kết phiên.

### B. Báo cáo ngày — dashboard quản lý
- **`manager_daily_rows`** trong `build_daily_report` (`daily_report_service.py`): 1 dòng / đơn (STT tháng, khung thời gian, TVBH, SK, dòng xe, PPF/PCN, hoàn tất, ghi chú luồng, nhóm hạn D, link). Gộp **hạn giao ngày D** + **đơn còn luồng mở**.
- UI tab **Báo cáo tháng → Báo cáo ngày**: hero, KPI, bảng `#daily-manager-body`, 4 panel phụ, bảng chi tiết luồng; class `daily-dash-*`; export HTML có mục theo dõi xe.
- Test: `web_demo/tests/test_daily_report_api.py`.

### C. Tab Tạo đơn (thủ công) — đọc chữ rõ
- Toàn bộ khối `.manual-create-shell` / bước wizard / input / thẻ dịch vụ: chuyển **nền sáng, tương phản cao** (bỏ vỏ form tối). `index.html`: sửa dòng mô tả intro phiếu nhập đơn.

### File chính (phiên này)
`web_demo/static/style.css`, `web_demo/static/index.html`, `web_demo/static/app.js`, `web_demo/daily_report_service.py`, `web_demo/tests/test_daily_report_api.py`.

### Khi quay lại
- Smoke: login, tab, dashboard, OCR, tạo đơn, workstream, modal PPF/WF, báo cáo ngày/tháng, console.
- **Git**: không tự commit; bạn `git add` + commit khi muốn snapshot.

---

## Các tính năng đã hoàn thiện gần đây trên giao diện `web_demo/static/`

### 1. Tab Mảnh Dư (Offcuts)
- Đã việt hóa bảng Danh Sách Mảnh Dư.
- Thêm cột **Người nhập** và **Ngày nhập** vào bảng Mảnh Dư.
- Chỉnh sửa logic bộ lọc (filter): Bỏ nút "Tải lại", thay bằng nút **Làm mới**. Khi chọn filter trạng thái từ Dropdown thì bảng sẽ tự động lọc ngay lập tức thông qua hàm `taiManhDu()`.

### 2. Tab Cuộn Phim (LOT)
- Đã việt hóa bảng Danh Sách Cuộn LOT.
- Thêm cột **Người nhập** và **Ngày nhập** vào bảng LOT.
- Chỉnh sửa logic bộ lọc (filter):
  - Đổi ô tìm kiếm "Loại phim" từ dạng nhập Text sang dạng danh sách thả xuống (**Dropdown Select**) gồm: RT40, JB20, T-TYPE, M-TYPE, RS20.
  - Sửa lại logic trạng thái thực tế: Nếu `Còn lại (m) <= 0`, trạng thái sẽ tự động hiển thị là **CẠN (DEPLETED)** thay vì Đang hoạt động.
  - Thêm nút **Làm mới** tương tự tab Mảnh dư.

### 3. Việt hóa các Hộp thoại (Modals) trong `app.js`
- **Nhập LOT mới (`openImportLotModal`)**: Đã dịch toàn bộ tiếng Việt, đổi mặc định ô "Người nhập" (`performed_by`) thành `Admin`.
- **Xuất Mảnh Dư thủ công (`openManualIssueOffcutModal`)**: Dịch toàn bộ sang tiếng Việt.
- **Xuất LOT thủ công (`openManualIssueLotModal`)**: Dịch toàn bộ sang tiếng Việt.
- **Bỏ Mảnh Dư - Clear Offcut (`openClearOffcutModal`)**: Dịch các trường dữ liệu, nhãn hiển thị và thay đổi mặc định người thực hiện.
- **Mở khóa Soft Lock (`openReleaseLockModal`)**: Đã dịch và giải thích logic quy trình, đổi mặc định người thao tác thành `Admin`.

### 4. Nâng cấp tính năng bộ lọc (Filter)
- Cập nhật chức năng bộ lọc tự động:
  - Loại bỏ hoàn toàn các nút "Áp dụng lọc" và "Xóa lọc" rườm rà trên tất cả các tab (Đại lý, Khách hàng, Hồ sơ xe, Định mức phim).
  - Gắn sự kiện `change` và cập nhật `input` để hệ thống tự động tìm kiếm ngay khi người dùng chọn giá trị dropdown hoặc gõ phím.
  - Sửa lỗi không nhận giá trị lọc trên tab "Định mức phim" (hệ thống tự bỏ lựa chọn) do bị trùng lặp ID. Đã loại bỏ hoàn toàn phần code HTML thừa của định mức phim bị kẹt lại bên trong màn hình Hồ sơ xe.
  - Sửa lỗi lọc nâng cao không hoạt động (lọc nhiều điều kiện như dòng xe + năm model) do bộ code cũ tự động thay đổi sai tên trường dữ liệu khi lưu (VD: `model_year` bị lưu nhầm thành `year`).
  - Nâng cấp nút "Làm mới": Khi click sẽ đóng vai trò như nút "Xóa lọc" cũ, tức là đưa tất cả các bộ lọc về trạng thái mặc định (Tất cả) và tải lại dữ liệu mới nhất.
  - Cải thiện trải nghiệm người dùng (UX): Thêm tính năng giữ và khôi phục vị trí con trỏ chuột khi đang gõ vào ô tìm kiếm (Dòng xe, Mã xe...) ngay cả khi hệ thống tự động tải lại bảng dữ liệu bên dưới, giúp gõ chữ không bị ngắt quãng.
  - Sửa lỗi không hiển thị dữ liệu khi chuyển sang tab "Định mức phim". Thêm hàm `ensureCustFilters()` để tránh lỗi.
  - Sửa lỗi hiển thị sai thông tin kích thước và năm model trong danh sách định mức.
  - Hiển thị danh sách trỏ xuống (datalist) cho ô nhập "Dòng xe" trên tab Định mức phim và cho phép gõ tìm kiếm.

## Phiên 09/06/2026 — Tạo đơn: Dòng xe (list PCN) + gọn form

### Thay đổi
- Tab **Tạo đơn** — mục **Dòng xe**: chuyển từ ô gõ + datalist sang **`<select>`**; danh sách **DISTINCT** lấy từ định mức có `film_type = Phim cách nhiệt` qua `GET /api/vehicle-norms/model-options?source=norms&film_type=Phim%20cách%20nhiệt`. Khi chọn hồ sơ xe mà mã chưa có trong danh sách định mức, thêm tạm option **(hồ sơ xe)** để vẫn gửi đơn được.
- Ẩn ô **Loại phim (WF)** và dropdown **Loại PPF (BODY)** khỏi giao diện; giữ `Phim cách nhiệt` và **T-TYPE** bằng `<input type="hidden">` (logic API giữ nguyên).
- Backend **`vehicle_norm_api`**: tham số query tuỳ chọn **`film_type`** trên `/vehicle-norms/model-options` để lọc DISTINCT theo loại phim định mức.
- `app.js`: `refreshMcVehicleModelSelectFromApi`, gọi khi mở tab Tạo đơn (`taiTaoDonTay`) và khi tải tab Khách hàng / Định mức như trước.

### File
`web_demo/vehicle_norm_api.py`, `web_demo/static/index.html`, `web_demo/static/app.js`, `web_demo/project_changelog.md`.

---

---

## Phiên 11/06/2026 — UX form Tạo đơn + Phân loại phim + Dashboard

### A. Khắc phục trùng lặp "Hạn giao xe"
- **Xóa** trường "Ngày giao xe" khỏi modal **Tạo xe nhanh** (chỉ dùng khi cần, không bắt nhập ngay).
- **Thêm** `delivery_date` vào drawer **Chi tiết hồ sơ xe** (`histPropsConfig.vehicle`) với label "Ngày giao xe (đại lý → khách)".
- **Đổi tên** toàn bộ nhãn "Hạn giao xe" (trong form tạo đơn, bảng workstream, job card, OCR form) → **"Hạn hoàn tất thi công"** để phân biệt rõ với ngày giao xe của hồ sơ xe.

### B. Mã vật tư dropdown lọc theo loại phim
- Thêm helper `_fetchLotMaterialCodes(filmType)` trong `app.js` — gọi `/api/lots?film_type=...` và cache theo session.
- **Phim cách nhiệt**: dropdown Mã vật tư chỉ hiện mã `film_type = WINDOW_FILM` từ kho LOT.
- **PPF**: chỉ hiện mã `film_type = PPF`.
- **Cường lực**: chỉ hiện mã `film_type = GLASS_FILM`; nâng cấp từ text tĩnh "GL-TYPE" lên `<select>` thực sự (lưu vào `window._mcGlDefaults`).

### C. Đội thi công ẩn/hiện theo dịch vụ
- Section "Đội thi công" mặc định **ẩn** (`style="display:none"`).
- Thêm hàm `_mcUpdateTeamVisibility()`: chỉ hiện đúng dropdown đội tương ứng với dịch vụ đã tích (PPF/WF/GL/FM).
- Gắn event vào tất cả 4 checkbox dịch vụ; gọi khi load tab và khi reset form.

### D. Số thứ tự (Theo dõi) — cấu trúc form mới
**Form Tạo đơn đổi thành 8 steps:**
1. Thông tin đại lý | 2. Khách hàng | 3. Thông tin xe
4. **Theo dõi** *(mới)* | 5. Thời gian & SLA | 6. Dịch vụ thi công | 7. Đội thi công | 8. Ghi chú nội bộ

**Logic Số thứ tự per-dealer:**
- 2 input **read-only** (tabindex="-1") trong Step 4.
- Khi chọn đại lý → gọi `/api/ocr/tracking-counters?dealer_id=...` → prefill gợi ý ngay.
- Hint text: "Đại lý X: xe thứ N trong năm, thứ M trong tháng."
- **Backend auto-assign** khi tạo đơn: đếm tổng số đơn của đại lý trong năm/tháng (không dùng `max(sequence_no)` nữa — tính cả đơn cũ không có field này).
- API `GET /api/ocr/tracking-counters` nhận thêm query param `dealer_id`.

### E. Dashboard — Biểu đồ xe/đại lý theo tháng
- API mới `GET /api/dashboard/dealer-monthly?month=YYYY-MM` trả về `{dealer_id, dealer_name, count, pct}`.
- Hàm `_renderDealerMonthlyChart(dm)` trong `app.js`: horizontal bar chart, màu phân biệt từng đại lý, hiển thị số xe + %.
- Thêm panel **"Xe thực hiện theo Đại lý (tháng này)"** vào dashboard (`index.html`).

### File thay đổi (phiên này)
- `web_demo/static/index.html` — restructure steps, labels, dealer-monthly panel
- `web_demo/static/app.js` — `_fetchLotMaterialCodes`, `_mcUpdateTeamVisibility`, `_mcRefreshSeqForDealer`, `_renderDealerMonthlyChart`, đổi labels
- `web_demo/main.py` — `_next_ocr_tracking_counters(dealer_id)`, `/api/dashboard/dealer-monthly`
- `web_demo/customer_api.py` — auto-assign sequence per dealer (count-based)

### Trạng thái khi kết thúc phiên
- Tất cả tính năng đã code xong, không có linter error.
- Server đang chạy tại `127.0.0.1:8000`.
- **Chưa có việc tồn đọng** trong to-do list — sẵn sàng nhận yêu cầu mới.

### Khi quay lại
1. Chạy server: `cd web_demo && uvicorn main:app --reload --port 8000`
2. Smoke test: login → Tab Tạo đơn → chọn đại lý → kiểm tra Step 4 (Số thứ tự cập nhật), Step 7 (Đội thi công ẩn/hiện), dropdown Mã vật tư phân loại đúng.
3. Dashboard: kiểm tra panel "Xe thực hiện theo Đại lý".
4. Muốn snapshot: `git add -A && git commit -m "feat: form restructure + seq per-dealer + dealer chart"`

---

## Ghi chú chung
- Đọc **`web_demo/project_changelog.md`**: phiên gần nhất ở trên cùng.
- Code đã ghi trên đĩa trong repo; muốn snapshot Git thì commit khi bạn sẵn sàng.
