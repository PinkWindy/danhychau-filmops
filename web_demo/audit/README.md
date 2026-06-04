# Thư mục `audit/` (web_demo)

Đây là nơi lưu **tài liệu nghiệm thu**, **báo cáo smoke / UAT**, và các file markdown báo cáo có tiền tố **`BAOCAO-`**.

- **Không** chứa code Python chạy runtime (script smoke test vẫn nằm ở **root** `web_demo/`, ví dụ `*_smoke_test.py`).
- **Không** ảnh hưởng tới khởi động FastAPI: ứng dụng **không** mount hay đọc bắt buộc thư mục này để phục vụ API.

## Phân biệt với nhật ký nghiệp vụ (audit log thật)

| Khái niệm | Vị trí / cơ chế |
|-----------|------------------|
| Báo cáo markdown trong `audit/` | Chỉ để đọc bởi người / quy trình QA–BA. |
| **Audit log nghiệp vụ** (thao tác user, thay đổi dealer, norm, kho, …) | Bảng **`audit_logs`** (ORM: `DbAuditLog`) trong SQLite `warehouse_demo.db` — ghi qua API khi có `reason`, activate/deactivate, v.v. |

Xem dữ liệu nhật ký nghiệp vụ trên UI: tab **Nhật ký kiểm toán** trong ứng dụng demo.

## File trong thư mục

| File | Mô tả ngắn |
|------|------------|
| `BAOCAO-CUSTOMER-NORM-SMOKE.md` | Báo cáo smoke customer + vehicle norms |
| `customer-filters-address-norm-fix-report.md` | Báo cáo filter KH + địa chỉ + sửa norm |
| `inventory-admin-test-report.md` | Báo cáo / tham chiếu inventory admin smoke |
