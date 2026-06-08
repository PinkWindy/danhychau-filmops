# Workflow Name
WF0 - Upload ảnh phiếu yêu cầu và trích xuất dữ liệu OCR

## 1. Mục tiêu nghiệp vụ

WF0 dùng để tiếp nhận ảnh chụp hoặc file PDF scan phiếu yêu cầu thi công từ đại lý, ví dụ Lexus hoặc các đại lý khác. Hệ thống cần OCR để bóc tách dữ liệu, sau đó đối soát với dữ liệu master hiện có, cho Admin chỉnh sửa, rồi tạo Request chính thức để chuyển sang WF1.

Quy trình này cần giải quyết 4 việc chính:
- Đọc ảnh/PDF phiếu yêu cầu.
- Bóc tách đúng các trường thông tin theo mẫu phiếu.
- Dò tìm tương đối thông tin đại lý/khách hàng/xe/mã hàng trong master data.
- Cho Admin xác nhận hoặc chỉnh sửa trước khi tạo Request chính thức.

## 2. Nguyên tắc xử lý bắt buộc
### 2.1. Không tự tạo dữ liệu demo
Hệ thống không được tự sinh dữ liệu như: UNKNOWN, Demo Dealer, Sample Customer, Khách hàng mẫu, Lexus Demo, Dữ liệu giả.
Nếu OCR không đọc được trường nào thì để trống và đánh dấu NEEDS_REVIEW.

### 2.2. Không hiển thị ảnh upload trực tiếp trên màn hình chính
Sau khi upload, hệ thống không được tự động bung ảnh lớn ra màn hình.
Cách hiển thị đúng:
File đã tải lên:
[icon ảnh/pdf] phieu-lexus-001.jpg
Nút: [Xem ảnh gốc]
Khi Admin bấm [Xem ảnh gốc], hệ thống mới mở ảnh trong modal/side panel để đối chiếu.
Yêu cầu UI:
- Không show ảnh full size mặc định.
- Có nút Xem ảnh gốc.
- Có thể đóng ảnh bằng nút X.
- Nếu là PDF nhiều trang, hiển thị danh sách từng trang.
- Mỗi trang có nút Xem trang.

### 2.3. Bỏ trường “Loại phim yêu cầu”
Trong WF0 không dùng trường "Loại phim yêu cầu".
Nếu ảnh có thông tin này thì chỉ lưu vào raw OCR text để tham chiếu, không đưa vào form chính.
Thông tin thi công thực tế sẽ được thể hiện qua danh sách mã hàng/dịch vụ ở phần chi tiết hàng hóa.

## 3. Bộ trường OCR cần bóc tách
Hệ thống cần bóc tách các trường chính theo mẫu phiếu như sau:
- Đơn vị
- Địa chỉ đơn vị
- Điện thoại
- Fax
- Số đề nghị
- Ngày yêu cầu
- Số hợp đồng
- Tên khách hàng
- Địa chỉ khách hàng
- Số điện thoại khách hàng
- Loại xe
- Số khung
- Ngày giao xe
- Tư vấn bán hàng

## 4. Danh sách mã hàng động
Phiếu có thể có nhiều dòng mã hàng. Không được hard-code chỉ 01 hoặc 02.
Hệ thống cần bóc tách theo dạng mảng:
```json
"service_items": [
  {
    "line_no": 1,
    "item_code": "",
    "item_name": "",
    "unit": "",
    "quantity": null,
    "unit_price": null,
    "amount": null,
    "vat_amount": null,
    "total_with_vat": null
  }
]
```
Nếu phiếu có thêm mã hàng thứ 3 thì tự động thêm dòng thứ 3 vào service_items.

## 5. Entity Resolution — Dò tìm đại lý trong master data
Sau khi OCR xong, hệ thống không được dùng nguyên văn OCR để tạo ngay. Cần thực hiện bước dò tìm tương đối với master data.

Trường OCR (Đơn vị, Địa chỉ đơn vị, Điện thoại, Fax) được hiểu là thông tin đại lý gửi phiếu.
Cơ chế matching: Normalize tiếng Việt, Bỏ các từ pháp lý phổ biến, Fuzzy match theo tên, ưu tiên điện thoại/địa chỉ.

**Case A — Match chắc chắn (>= 90%)**
Trạng thái: MATCHED. Form lưu: `"dealer_resolution_status": "MATCHED", "dealer_id": "DL-xxx"`.

**Case B — Nhiều kết quả (70% - 90%)**
Trạng thái: REVIEW_REQUIRED. Hiển thị danh sách gợi ý để Admin chọn.

**Case C — Không tìm thấy (< 70%)**
Hiển thị cảnh báo và nút `[Tạo mới đại lý từ dữ liệu OCR]`.
- Nếu Admin bấm: Tạo mới đại lý, gắn dealer_id.
- Nếu Admin bỏ qua và bấm `[Xác nhận tạo Request]`: Hệ thống tự động tạo mới đại lý từ dữ liệu OCR. Ghi audit log `DEALER_AUTO_CREATED_FROM_OCR_ON_CONFIRM`.

## 6. Dò tìm khách hàng cuối
Trường OCR (Tên khách hàng, Địa chỉ, Số điện thoại khách hàng).
Quy tắc dò tìm tương tự Đại lý (ưu tiên SĐT -> Họ tên + Địa chỉ).
Kết quả lưu: `end_customer_resolution_status` (MATCHED | REVIEW_REQUIRED | NOT_FOUND | AUTO_CREATED), `end_customer_id`.

## 7. Dò tìm xe và chuẩn hóa thông tin xe
Mapping: `vehicle_model_raw`, `vin_raw`, `requested_delivery_at`.
- VIN phải được normalize: uppercase, bỏ khoảng trắng, bỏ ký tự đặc biệt.
- Nếu VIN đọc sai/thiếu ký tự -> highlight vàng/đỏ. (Confidence < 80% -> NEEDS_REVIEW). Hiển thị 6 ký tự cuối VIN.
- Loại xe dò tìm với vehicle_profile/master model. Không tự suy luận nếu OCR không có.

## 8. Form Review OCR Draft
Sau khi OCR hoàn tất, màn hình chia thành 6 nhóm:
- Nhóm 1 — File nguồn (File đã tải lên, số trang, nút Xem ảnh gốc)
- Nhóm 2 — Thông tin đại lý (Kết quả dò tìm, Nút Tạo mới đại lý)
- Nhóm 3 — Thông tin phiếu (Số đề nghị, ngày yêu cầu, số hợp đồng, tư vấn bán hàng)
- Nhóm 4 — Thông tin khách hàng cuối (Kết quả dò tìm, Nút tạo mới)
- Nhóm 5 — Thông tin xe (Loại xe, số khung, ngày giao xe)
- Nhóm 6 — Danh sách mã hàng/dịch vụ (Hiển thị dạng bảng động có nút Thêm dòng/Xóa dòng)

## 9. Confidence và trạng thái từng trường
- >= 90%: màu bình thường.
- 80% <= confidence < 90%: highlight vàng.
- < 80%: highlight đỏ.
- Admin sửa tay: status = HUMAN_CONFIRMED, confidence = 100%.

## 10. Nút xác nhận tạo Request
Chỉ mở khi các trường bắt buộc đã hợp lệ (Đại lý final, Tên khách hàng final, Loại xe final, Số khung, Ngày yêu cầu, Ngày giao xe, ít nhất 1 dòng mã hàng). Thiếu -> Không cho xác nhận, báo lỗi từng trường, không dùng UNKNOWN.

## 11. Cơ chế tự tạo mới nếu user bỏ qua
Nếu OCR đọc được thông tin nhưng chưa có trong master, mà Admin bấm `[Xác nhận tạo Request]`, hệ thống tự tạo dealer/customer mới.

## 12. Tạo Request chính thức
Sau khi Admin xác nhận, hệ thống gọi AG-01 để validate, gắn thông tin, cấp request_id, chuyển trạng thái `DRAFT_APPROVED` và sang WF1.

## 13. Quy tắc đặt mã Request
Mã Request tạo từ OCR phải theo format: **`DYC-YYMMDD-XXXXXX`**
Trong đó: YYMMDD = ngày tạo đơn, XXXXXX = 6 ký tự cuối VIN. (VD: `DYC-260606-123456`). Nếu VIN chưa đủ 6 ký tự thì bắt buộc Admin sửa.

## 14. Audit log bắt buộc
- `IMAGE_UPLOADED`, `IMAGE_VALIDATED`, `IMAGE_OCR_STARTED`, `IMAGE_OCR_COMPLETED`, `OCR_FIELD_CORRECTED`
- `DEALER_MATCHED_FROM_MASTER`, `DEALER_NOT_FOUND`, `DEALER_CREATED_FROM_OCR`, `DEALER_AUTO_CREATED_FROM_OCR_ON_CONFIRM`
- `CUSTOMER_MATCHED_FROM_MASTER`, `CUSTOMER_NOT_FOUND`, `CUSTOMER_CREATED_FROM_OCR`, `CUSTOMER_AUTO_CREATED_FROM_OCR_ON_CONFIRM`
- `OCR_DRAFT_CONFIRMED`, `OCR_DRAFT_CANCELLED`, `REQUEST_CREATED_FROM_IMAGE`, `SENT_TO_WF1`

## 15. Alternative Flow
- **AF-01: OCR tin cậy cao**: Nút Xác nhận mở sẵn.
- **AF-02: VIN OCR sai nhẹ**: Highlight, Admin sửa, field chuyển HUMAN_CONFIRMED.
- **AF-03: PDF nhiều trang**: Tách trang, mỗi trang tạo 1 ocr_draft_id riêng.
- **AF-04: Admin hủy bản nháp**: Bấm [Hủy bỏ], không tạo Request, ghi audit.

## 16. Exception Flow
- **EF-01: File sai định dạng**: Chặn upload, báo lỗi `IMAGE_INVALID_FORMAT`.
- **EF-02: Ảnh quá mờ**: Status `IMAGE_QUALITY_FAILED`.
- **EF-03: Không xác định được đại lý**: Bôi đỏ, yêu cầu chọn thủ công.
- **EF-04: Thiếu model xe / hạng mục**: Khóa Xác nhận, bắt buộc bổ sung.
- **EF-05: Thiếu ngày giao xe**: Cảnh báo vàng, cho nhập thủ công.
- **EF-06: OCR service lỗi**: Báo lỗi kỹ thuật, cho nhập tay hoặc thử lại.

## 17. Status Flow
- Luồng chuẩn: IMAGE_UPLOADED → OCR_PROCESSING → OCR_DRAFT_READY → OCR_CONFIRMED → REQUEST_CREATED → SENT_TO_WF1
- Luồng cần review: ... → NEEDS_REVIEW → HUMAN_CORRECTED → OCR_CONFIRMED → ...
- Luồng hủy: ... → OCR_DRAFT_READY → OCR_DRAFT_CANCELLED

## 18. Acceptance Criteria
1. Upload thành công, không tự show ảnh lớn.
2. OCR bóc tách đúng mẫu.
3. Không còn trường Loại phim yêu cầu.
4. Mã hàng động.
5. Dealer/Customer fuzzy match master data. Tự tạo nếu thiếu lúc xác nhận.
6. Không dùng UNKNOWN.
7. Request ID đúng format DYC-YYMMDD-XXXXXX.
8. File gốc gắn vào Request.
9. Toàn bộ có audit log. Dữ liệu sạch chuyển WF1.
