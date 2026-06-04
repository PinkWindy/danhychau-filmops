# Manual Order & Customer Management Test Report

## 1. Test Summary

* Test script: `manual_order_customer_smoke_test.py`
* Total test cases: 20
* Passed: 20
* Failed: 0
* Result: **PASSED**
* Final conclusion: **MANUAL ORDER & CUSTOMER MANAGEMENT READY FOR DEMO**

---

## 2. Test Scope

Phạm vi đã kiểm thử tự động (API + DB + tương thích luồng cũ):

* Dealer Account API (GET list, POST create, POST duplicate rejection)
* End Customer API (GET list, POST create)
* Vehicle Profile API (GET list, POST create)
* Manual Request Creation (`POST /api/requests/manual-create`)
* PPF-only request (chỉ PPF, có `ppf_type`)
* Window Film-only request (chỉ phim cách nhiệt)
* PPF + Window Film request (đa workstream)
* Service selection validation (không service → fail; PPF thiếu `ppf_type` → fail)
* Workstream generation sau manual-create (kiểm tra loại workstream tạo ra)
* No auto-approval sau tạo đơn thủ công (workstream vẫn `PENDING_APPROVAL` / không tự `APPROVED`)
* Audit log creation (`REQUEST_MANUAL_CREATED`, `CUSTOMER_CREATED`, `VEHICLE_CREATED`)
* Compatibility với luồng OCR hiện có (`GET /api/ocr-drafts`)
* Compatibility với Inventory Admin hiện có (`GET /api/inventory/summary`)
* `validate-sources` compatibility cho request demo `REQ-20260604-001` (không phát sinh ERROR)

---

## 3. Test Result Table

| # | Test case | Result |
|---:|---|:---:|
| 1 | GET /api/dealers trả danh sách dealer | PASS |
| 2 | POST /api/dealers tạo dealer mới thành công | PASS |
| 3 | POST /api/dealers trùng dealer_id phải fail | PASS |
| 4 | GET /api/end-customers trả danh sách customer | PASS |
| 5 | POST /api/end-customers tạo customer mới thành công | PASS |
| 6 | GET /api/vehicles trả danh sách vehicle | PASS |
| 7 | POST /api/vehicles tạo vehicle mới thành công | PASS |
| 8 | POST /api/requests/manual-create chỉ PPF thành công | PASS |
| 9 | POST /api/requests/manual-create chỉ Window Film thành công | PASS |
| 10 | POST /api/requests/manual-create cả PPF + Window Film thành công | PASS |
| 11 | POST /api/requests/manual-create không chọn service nào phải fail | PASS |
| 12 | POST /api/requests/manual-create chọn PPF nhưng thiếu ppf_type phải fail | PASS |
| 13 | Manual request tạo xong có workstream đúng | PASS |
| 14 | Manual request không tự approve workstream | PASS |
| 15 | Manual request có audit REQUEST_MANUAL_CREATED | PASS |
| 16 | Customer quick create có audit CUSTOMER_CREATED | PASS |
| 17 | Vehicle quick create có audit VEHICLE_CREATED | PASS |
| 18 | Existing OCR flow không lỗi | PASS |
| 19 | Existing inventory summary không lỗi | PASS |
| 20 | Existing REQ-20260604-001 validate-sources không ERROR | PASS |

---

## 4. Business Controls Verified

Các kiểm soát nghiệp vụ đã được smoke test xác minh:

* Không cho tạo dealer trùng mã (`dealer_id`).
* Không cho tạo đơn manual nếu không chọn ít nhất một dịch vụ (PPF và/hoặc Window Film).
* Không cho tạo PPF request nếu thiếu `ppf_type` (hoặc không thuộc T-TYPE / M-TYPE).
* Tạo đơn thủ công sinh đúng workstream (`PPF_INSTALLATION` và/hoặc `WINDOW_FILM_INSTALLATION` theo lựa chọn).
* Tạo đơn thủ công không tự động approve workstream (vẫn chờ bước Manager Approval trên luồng hiện tại).
* Tạo/sửa nghiệp vụ liên quan được ghi nhận qua audit log (các loại transaction_type tương ứng trong phạm vi test).
* Luồng OCR cũ không bị hỏng ở mức API được gọi trong test.
* Luồng Inventory Admin (summary) không bị hỏng ở mức API được gọi trong test.
* `validate-sources` của request demo chính `REQ-20260604-001` không phát sinh ERROR.

---

## 5. Known Notes

* Trên **Windows console**, có thể gặp lỗi hiển thị Unicode khi in bảng kết quả nếu không set `PYTHONIOENCODING=utf-8`. **Không ảnh hưởng** kết quả API hay logic PASS/FAIL của smoke test.
* Phạm vi chức năng đã test là **MVP-level**: chưa bao gồm phân quyền production-grade, SSO, hay kiểm thử tải (load test).
* Giao diện web tab **Khách hàng** / **Tạo đơn** là lớp demo; một số bước kịch bản demo chi tiết có thể dùng thêm API trực tiếp hoặc nút “Tạo nhanh” trên tab **Tạo đơn** — xem `audit/manual-order-customer-demo-script.md`.

---

## 6. Final Status

**MANUAL ORDER & CUSTOMER MANAGEMENT READY FOR DEMO**
