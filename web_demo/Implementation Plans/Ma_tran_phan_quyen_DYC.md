# Ma trận phân quyền — DYC (3 vai trò chuẩn)

Tài liệu mô tả **chính sách phân quyền mục tiêu** theo 3 role do nghiệp vụ định nghĩa.  
**Bản demo hiện tại:** API chưa gắn middleware RBAC — ma trận dùng khi triển khai đăng nhập + kiểm tra quyền trên FastAPI và ẩn nút trên UI.

---

## 1. Ba vai trò

| Role | Mô tả ngắn |
|------|------------|
| **Admin** | Toàn quyền mọi thao tác nghiệp vụ + vận hành hạ tầng (reset DB seed, v.v.). |
| **Quản lý** | Toàn quyền **trừ** toàn bộ thao tác thuộc nhóm **Phân bổ LOT** (xem mục 2). Các phần còn lại tương đương Admin. |
| **KTV** | Gần như toàn quyền **trừ**: (1) **Duyệt đơn thi công** (bước phê duyệt để thực hiện đơn — xem mục 4), (2) **Phân quyền / quản trị nhân sự** (HR, gán role). **Được tạo đơn** và **xác nhận phiếu OCR / đơn** để **đẩy lên luồng chờ duyệt**; chỉ không được **duyệt** đơn đó. **Được xem tất cả màn hình** — ô không có quyền ghi thì chỉ **xem (R)**. |

---

## 2. Nhóm «Phân bổ LOT» — Quản lý **không** được (chỉ Admin + KTV thực hiện)

Ánh xạ gần đúng với API / luồng trong `main.py` + service `wf_allocation_service` / `ppf_allocation_service`:

| Thao tác | Admin | Quản lý | KTV |
|----------|:-----:|:-------:|:---:|
| Lưu / cập nhật phân bổ PPF (`PUT /api/workstreams/{ws_id}/ppf-allocation`) | X | **—** | X\* |
| Lưu / cập nhật phân bổ WF + chọn LOT/OFFCUT theo hạng mục (`PUT /api/workstreams/{ws_id}/allocation`) | X | **—** | X\* |
| Duyệt mã phim WF gắn với bảng phân bổ (`POST /api/workstreams/{ws_id}/approve-wf-materials`) | X | **—** | X\* |
| Đọc gợi ý mã vật tư phân bổ (`GET /api/workstreams/{ws_id}/allocation-material-codes`) | X | R | R |

\*KTV: chỉ trên luồng được gán (`assigned_technician_id` / đội), theo rule nghiệp vụ hiện tại.

**Ghi chú:** Các bước khác trên luồng (ví dụ `POST .../approve` tổng thể, `POST .../start`, `POST .../complete`, đăng ký cắt thêm…) **không** thuộc bảng «chỉnh phân bổ LOT» ở trên — **Quản lý vẫn X** như Admin (trừ khi nghiệp vụ sau này tách riêng).

---

## 3. Đơn thi công & OCR — KTV **được** tạo / xác nhận đẩy duyệt; **không** được duyệt

| Thao tác | Admin | Quản lý | KTV |
|----------|:-----:|:-------:|:---:|
| Tạo đơn thủ công (`POST /api/requests/manual-create`) | X | X | **X** |
| Xác nhận phiếu OCR → tạo đơn / cập nhật master, **đưa đơn vào trạng thái chờ duyệt / thực hiện** (luồng OCR confirm) | X | X | **X** |
| Xem danh sách / chi tiết đơn | X | X | **X** / R theo policy dữ liệu |
| **Duyệt** đơn (phê duyệt thực hiện, chuyển trạng thái sau bước «chờ Quản lý», xử lý NEEDS_REVIEW mang tính phê duyệt) | X | X | **—** |

**Phân biệt nghiệp vụ:** *Tạo đơn / xác nhận để đẩy tới luồng* = KTV **được**; *Duyệt đơn* = chỉ Admin & Quản lý (KTV **không** bấm duyệt / không gọi API đổi trạng thái kiểu phê duyệt cuối).

Các thao tác kho & thi công khác (nhập LOT, mảnh dư, định mức, v.v.): KTV **X** như ma trận tổng (mục 6).

---

## 4. Duyệt Đơn thi công (chỉ bước phê duyệt) — chỉ Admin & Quản lý

| Thao tác | Admin | Quản lý | KTV |
|----------|:-----:|:-------:|:---:|
| Phê duyệt / đổi trạng thái nghiệp vụ **sau** khi đơn đã nằm trong luồng chờ duyệt thực hiện | X | X | **—** |

*(Phần «Xem / tạo / xác nhận đơn» đã gộp ở mục 3.)*

---

## 5. Phân quyền nhân sự — chỉ Admin & Quản lý

| Thao tác | Admin | Quản lý | KTV |
|----------|:-----:|:-------:|:---:|
| Xem màn Nhân sự / danh sách staff, team | X | X | **R** |
| CRUD staff, team, gán thành viên, performance (`/api/hr/*`) | X | X | **—** |
| Gán **role** hệ thống (Admin / Quản lý / KTV) cho user — khi có bảng user_roles | X | X | **—** |

---

## 6. Ma trận tổng hợp theo menu (ghi tóm tắt)

Chú thích: **X** = ghi; **R** = chỉ xem; **—** = cấm.

| Nhóm chức năng / Menu | Admin | Quản lý | KTV |
|------------------------|:-----:|:-------:|:---:|
| Tổng quan, thông báo | X | X | R / X (đọc thông báo của mình) |
| Nhập phiếu OCR (upload, chỉnh trích xuất, **xác nhận → đẩy chờ duyệt**) | X | X | X |
| Tạo đơn (thủ công) | X | X | **X** |
| Khách hàng (đại lý / KH / xe) | X | X | X |
| Định mức phim | X | X | X |
| Đơn thi công — **tạo / xác nhận / xem** | X | X | **X** |
| Đơn thi công — **duyệt thực hiện** (Quản lý/Admin) | X | X | **—** |
| Luồng thi công — **Phân bổ LOT** (mục 2) | X | **—** | X\* |
| Luồng thi công — còn lại (bắt đầu, hoàn tất, hủy, cắt thêm, v.v.) | X | X | X\* |
| Lệnh thi công | X | X | X\* |
| Kho cuộn LOT & Quản lý kho (nhập/xuất/clear/lock/meta/vật tư ưu tiên) | X | X | X |
| Giao dịch kho, nhật ký kiểm toán | X | X | R |
| Master địa bàn | X | X | R |
| Reset DB + seed (`/api/admin/reset-database-standard-seed`) | X | **—** | **—** |

\*Giới hạn theo luồng/lệnh được gán.

**Reset DB:** chỉ **Admin** (và thực tế thêm token env — có thể gộp SYS riêng; Quản lý **không** reset).

---

## 7. KTV — «Xem tất cả màn hình»

- **Điều hướng:** mọi tab/menu vẫn mở được; không ẩn route chỉ vì role KTV.
- **Hành vi:** nếu không có quyền ghi → hiển thị dữ liệu ở chế độ **chỉ đọc** (ẩn nút Lưu/**Duyệt đơn**/phân quyền NS; vẫn hiện **Tạo đơn** / **Xác nhận OCR** cho KTV). Gọi API trả 403 nếu thử thao tác cấm.
- **Dữ liệu nhạy cảm:** có thể lọc theo `assigned_technician_id` sau này; ma trận mặc định **R toàn cục** cho màn không thuộc quyền ghi.

---

## 8. Gợi ý triển khai kỹ thuật

1. Bảng `user` + `role` ∈ `{ADMIN, MANAGER, TECHNICIAN}` (hoặc `KTV`).
2. Dependency FastAPI: `require_roles(...)`, nhóm `permission=allocation` cho các endpoint mục 2.
3. Frontend: `currentUser.role` → `canWrite('allocation')`, `canApproveRequest()` (chỉ Admin/QL), `canCreateRequest()` / `canConfirmOcrDraft()` (gồm KTV), v.v.
4. Giữ audit log cho mọi thao tác Admin trên vùng Quản lý bị cấm (nếu có chuyển quyền tạm).

---

## 9. Phiên bản

| Thuộc tính | Giá trị |
|------------|---------|
| Cập nhật | 2026-06-09 — 3 role; KTV: **được** tạo đơn + xác nhận OCR đẩy chờ duyệt, **không** duyệt đơn thi công; **không** phân quyền NS; Quản lý trừ Phân bổ LOT. |
| Căn cứ API phân bổ | `PUT .../ppf-allocation`, `PUT .../allocation`, `POST .../approve-wf-materials`, `GET .../allocation-material-codes` trong `main.py` |
