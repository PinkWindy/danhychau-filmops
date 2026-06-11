# Cập nhật Giao diện Quản lý Định mức phim (Film Norms)

Bản kế hoạch này mô tả các thay đổi frontend (`app.js` và `index.html`) để tách **Định mức phim** thành một menu độc lập cấp cao nhất (top-level menu) và bổ sung đầy đủ tính năng tra cứu, thêm, sửa, bật/tắt (như kết quả kiểm thử API đã pass).

## User Review Required

> [!IMPORTANT]
> - Do chúng ta đã di chuyển **Định mức phim** ra một Tab riêng (Menu `tab-norms`), toàn bộ logic cũ nằm trong tab con của "Hồ sơ xe" sẽ được loại bỏ và viết lại gọn gàng hơn.
> - **Chỉ chỉnh sửa Frontend**: Back-end (các API `/api/vehicle-norms`...) đã được xác nhận là hoàn chỉnh qua các file smoke test.
> - Vui lòng xem xét các thay đổi đề xuất bên dưới và xác nhận để tôi bắt đầu tiến hành code.

## Open Questions

> [!WARNING]
> - Các kích thước kính (`windshield_size`, `rear_windshield_size`, `front_side_size`, v.v.) hiện tại trong DB đang lưu dưới dạng chuỗi `WxH` (ví dụ `90x152`). Trong modal Thêm/Sửa, bạn có muốn tách riêng 2 ô input (Chiều rộng / Chiều cao) cho từng loại kính không, hay vẫn nhập 1 chuỗi `WxH` để thao tác nhanh hơn? (Mặc định tôi sẽ làm 1 ô nhập `WxH` theo đúng format hiện tại của DB).

## Proposed Changes

### Frontend (static/app.js)

Tạo mới toàn bộ logic cho tab "Định mức phim", liên kết với thẻ `#tab-norms` đã có sẵn.

#### [NEW] Hàm `taiDinhMucPhim()`
- Gắn vào `tabLoaders.norms`.
- Chịu trách nhiệm render thanh Filter Bar và Data Table vào thẻ `<div id="norms-container"></div>`.
- **Thanh Filter Bar** bao gồm:
  - Input `q` (tìm kiếm ID, dòng xe...).
  - Select `film_type` (Phim cách nhiệt / PPF).
  - Input `vehicle_model_code` (sử dụng `<datalist>` gọi từ `/api/vehicle-norms/model-options`).
  - Input `model_year`.
  - Select `status` (ALL, ACTIVE, INACTIVE).
  - Checkbox: `Có kính lái`, `Có kính trời`, `Có sườn sau + tam giác`.

#### [NEW] Bảng dữ liệu định mức phim (Data Table)
- Render bảng HTML (scrollable ngang) tương tự yêu cầu cũ: 
  - Cột: `Loại phim`, `Dòng xe`, `Khoảng năm`, `KL`, `KH`, `ST`, `SSTG`, `TG`, `SS`, `KT`, `Trạng thái`, `Thao tác`.
- Cột `Trạng thái` hiển thị badge (Xanh = ACTIVE, Xám = INACTIVE).
- Cột `Thao tác` chứa các nút icon:
  - Bật / Tắt (gọi `POST /api/vehicle-norms/{id}/activate` hoặc `deactivate` với lý do `reason`).
  - Sửa (mở modal cập nhật).

#### [NEW] Hệ thống Modal cho Định mức phim
- **Modal Thêm/Sửa Định mức**: Một form HTML động được chèn vào DOM khi người dùng click "+ Thêm định mức" hoặc "Sửa" trên từng dòng.
- Form gồm: `vehicle_model_code`, `model_year_start`, `model_year_end`, `film_type`, và các trường kích thước kính (`windshield_size`, `rear_windshield_size`, `front_side_size`, `rear_side_triangle_size`, `triangle_size`, `rear_side_size`, `sunroof_size`).
- Gửi payload tới `POST /api/vehicle-norms` (Thêm mới) hoặc `PUT /api/vehicle-norms/{id}` (Cập nhật). Bắt buộc kèm `reason` khi cập nhật.

### Frontend (static/index.html)

#### [MODIFY] index.html
- Loại bỏ các mã HTML thừa (nếu còn) của "Định mức phim" bên trong tab `Khách hàng` > `Hồ sơ xe` để tránh trùng lặp id và code.
- Thêm HTML template cho **Modal Thêm/Sửa Định mức phim** (hoặc tạo động hoàn toàn trong JS nếu muốn code tập trung hơn).

## Verification Plan

### Automated Tests
- Chạy lại `python customer_norm_smoke_test.py` và `python customer_filters_address_norm_smoke_test.py` để đảm bảo không làm vỡ API hiện tại.

### Manual Verification
- Mở giao diện trên trình duyệt web, click vào menu **Định mức phim**.
- Thử nghiệm việc filter các trường: Loại phim, Dòng xe, Trạng thái.
- Nhấn "+ Thêm định mức", điền dữ liệu (VD: Lexus RX350 2018-2022) và lưu, kiểm tra dữ liệu hiện trên bảng.
- Sửa/Bật/Tắt định mức vừa tạo và xem trạng thái cập nhật thành công (có popup nhập lý do).
