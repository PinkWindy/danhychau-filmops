# Manual Order & Customer Management Demo Script

> **Ghi chú Web MVP:** Tab **Khách hàng** hiển thị bảng + KPI và nút **Xem / Lịch sử** (drawer JSON). Việc **tạo mới** Dealer / Khách / Xe trên UI demo thường dùng các nút **+ Tạo … nhanh** trên tab **Tạo đơn**, hoặc gọi trực tiếp API tương ứng (`POST /api/dealers`, `POST /api/end-customers`, `POST /api/vehicles`) nếu cần demo đúng payload tài liệu.

---

## Demo Flow 1 — Tạo đại lý mới

* Mở tab **Khách hàng**.
* Chọn sub-tab **Đại lý**.
* (UI MVP) Làm mới danh sách: chuyển tab rồi quay lại, hoặc dùng **+ Tạo đại lý nhanh** trên tab **Tạo đơn** / gọi `POST /api/dealers`.
* Nhập `dealer_id`, `dealer_name`, `legal_name`, `dealer_group` (và các field masked nếu có).
* Xác nhận.
* Kiểm tra dealer xuất hiện trong bảng (GET lại hoặc reload tab).
* Kiểm tra audit **DEALER_CREATED** trong **Nhật ký kiểm toán** (lọc theo `transaction_type` hoặc `entity`).

---

## Demo Flow 2 — Tạo khách hàng lẻ mới

* Mở sub-tab **Khách hàng lẻ**.
* (UI MVP) Dùng **+ Tạo KH nhanh** trên tab **Tạo đơn** hoặc `POST /api/end-customers`.
* Nhập `customer_masked`, `phone_masked`, `address_masked`, `source_dealer_id` (nếu kênh DEALER).
* Xác nhận.
* Kiểm tra customer xuất hiện trong bảng.
* Kiểm tra audit **CUSTOMER_CREATED**.

---

## Demo Flow 3 — Tạo hồ sơ xe mới

* Mở sub-tab **Hồ sơ xe**.
* (UI MVP) Dùng **+ Tạo xe nhanh** trên tab **Tạo đơn** hoặc `POST /api/vehicles`.
* Chọn dealer, customer (theo form / payload).
* Nhập `vehicle_model_code`, `model_name`, `vin_masked`.
* Xác nhận.
* Kiểm tra vehicle xuất hiện trong bảng.
* Kiểm tra audit **VEHICLE_CREATED**.

---

## Demo Flow 4 — Tạo đơn thủ công chỉ PPF

* Mở tab **Tạo đơn**.
* Chọn dealer, customer, vehicle (dropdown nạp từ API).
* Nhập `requested_delivery_at` (ngày + giờ trên form → ISO trong request).
* Chọn **Có phim PPF**.
* Chọn `ppf_type` = **T-TYPE** hoặc **M-TYPE**.
* Bỏ chọn **Có phim cách nhiệt** (nếu mặc định đang bật).
* Bấm **Tạo đơn**.
* Kiểm tra request được tạo (`source_channel` = MANUAL trên chi tiết đơn).
* Kiểm tra có workstream **PPF_INSTALLATION**.
* Kiểm tra request / workstream **không** tự approve (trạng thái chờ duyệt).
* Kiểm tra request đi tiếp được vào **Manager Approval** (tab Đơn / Tổng quan — phê duyệt từng luồng).

---

## Demo Flow 5 — Tạo đơn thủ công chỉ phim cách nhiệt

* Mở tab **Tạo đơn**.
* Chọn dealer, customer, vehicle.
* Bật **Có phim cách nhiệt**; tắt PPF nếu chỉ demo WF.
* Chọn các hạng mục: **WINDSHIELD**, **REAR_WINDOW**, **FRONT_SIDE**, **REAR_SIDE_TRIANGLE**, **SUNROOF** (tick từng ô).
* Kiểm tra mapping kế hoạch vật tư (theo rule backend / material plan):

  * **WINDSHIELD** → **RT40**.
  * Các hạng mục còn lại → **JB20**.
* Bấm **Tạo đơn**.
* Kiểm tra có workstream **WINDOW_FILM_INSTALLATION**.
* Kiểm tra request **không** tự approve.

---

## Demo Flow 6 — Tạo đơn cả PPF + Window Film

* Mở tab **Tạo đơn**.
* Chọn dealer, customer, vehicle.
* Chọn cả **Phim PPF** và **Phim cách nhiệt**.
* Chọn **PPF type**.
* Chọn **Window Film items**.
* Chọn đội thi công PPF và Window Film (dropdown đội).
* Bấm **Tạo đơn**.
* Kiểm tra request có **2** workstreams:

  * **PPF_INSTALLATION**
  * **WINDOW_FILM_INSTALLATION**
* Kiểm tra mỗi workstream có **status** riêng (thường cùng bước chờ duyệt ban đầu).
* Kiểm tra request đi tiếp vào **Manager Approval**.

---

## Demo Flow 7 — Xem lịch sử khách hàng / đại lý / xe

* Mở tab **Khách hàng**.
* Sub-tab **Khách hàng lẻ** → chọn một dòng → bấm **Xem**.
* Kiểm tra drawer hiển thị JSON: danh sách xe, request, vật tư gần đây (theo API `GET /api/customers/{customer_id}/history`).
* Sub-tab **Đại lý** → **Lịch sử** trên một dealer.
* Kiểm tra `GET /api/dealers/{dealer_id}/history` (requests theo dealer, KPI tổng hợp trong payload).
* Sub-tab **Hồ sơ xe** → **Xem**.
* Kiểm tra `GET /api/vehicles/{vehicle_id}/history` (request và dịch vụ đã thi công nếu có).

---

## Kết thúc demo

* Chạy smoke regression: `python manual_order_customer_smoke_test.py` trong thư mục `web_demo/`.
* Kỳ vọng: dòng kết **MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED**.
