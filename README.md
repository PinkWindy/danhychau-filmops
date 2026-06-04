# DYC Film Warehouse Agentic Workspace

Chào mừng bạn đến với **Agentic Workspace** quản lý và vận hành kho phim cách nhiệt, phim PPF dành cho ô tô của DYC. 

Không gian làm việc này được thiết kế để hỗ trợ quy trình tự động hóa phối hợp đa tác nhân (Multi-Agent) và con người (Human-in-the-Loop) từ khâu tiếp nhận phiếu yêu cầu thi công, tối ưu hóa kích thước cắt phim, kiểm soát kho cho đến phân tích báo cáo hiệu suất vật tư.

---

## 1. Workspace này dùng để làm gì?
Workspace này chứa toàn bộ các tài liệu đặc tả kiến trúc, mô hình tác nhân (Agent Personas), tài liệu chức năng (Modules), quy trình phối hợp (Workflows), luật nghiệp vụ (Rules), cơ sở dữ liệu tri thức (Knowledge Base) dạng CSV, và các file mẫu đầu ra (Outputs) cùng kịch bản kiểm thử (Audit).

Mục đích chính của Workspace là:
* **Tối ưu hóa hao hụt vật tư phim PPF/Cách nhiệt**: Tự động tra cứu định mức xe từ Excel, ưu tiên tìm kiếm và sử dụng mảnh dư (Sub-LOT) trước khi cắt cuộn gốc (LOT gốc).
* **Kiểm soát quy trình xuất nhập kho chặt chẽ**: Đảm bảo mọi giao dịch xuất kho đều có sự phê duyệt của Quản lý và sự xác nhận số liệu thực tế từ Kỹ thuật viên sau khi thi công.
* **Chuẩn hóa thông tin**: Liên kết chặt chẽ Đại lý (Dealer), Khách lẻ (End Customer) và Hồ sơ xe (Vehicle Profile).
* **Minh bạch hóa dữ liệu**: Ghi nhận nhật ký giao dịch không thể sửa xóa (Audit Log) và xuất báo cáo hiệu suất sử dụng vật tư định kỳ.

---

## 2. Cách đọc thư mục
Cấu trúc thư mục của Workspace được tổ chức như sau:

* **[agents/](file:///d:/Quản lý vận hành DYC/agents)**: Chứa đặc tả vai trò, nhiệm vụ và công cụ của 8 Agent AI trong hệ thống.
* **[human-personas/](file:///d:/Quản lý vận hành DYC/human-personas)**: Mô tả vai trò, trách nhiệm và cách tương tác của các tác nhân con người (Admin kho/Điều phối, Quản lý, Kỹ thuật viên, Kế toán).
* **[modules/](file:///d:/Quản lý vận hành DYC/modules)**: Các mô-đun chức năng nghiệp vụ xử lý dữ liệu và thuật toán so khớp.
* **[workflows/](file:///d:/Quản lý vận hành DYC/workflows)**: Các kịch bản và quy trình tương tác phối hợp từng bước giữa các Agent và Con người.
* **[knowledge/](file:///d:/Quản lý vận hành DYC/knowledge)**: Chứa dữ liệu tri thức dạng CSV (đại lý, xe, vật tư, ma trận định mức, danh sách kho LOT và mảnh dư hiện tại).
* **[rules/](file:///d:/Quản lý vận hành DYC/rules)**: Các quy tắc nghiệp vụ cứng bắt buộc hệ thống phải tuân thủ (quy tắc khớp mảnh dư, quy tắc tính scrap, tồn kho an toàn...).
* **[schemas/](file:///d:/Quản lý vận hành DYC/schemas)**: Cấu trúc dữ liệu JSON dùng để xác thực thông tin đầu vào/đầu ra giữa các tác nhân.
* **[outputs/](file:///d:/Quản lý vận hành DYC/outputs)**: Các biểu mẫu và dữ liệu mẫu đầu ra sau khi chạy các workflows.
* **[audit/](file:///d:/Quản lý vận hành DYC/audit)**: Kịch bản kiểm thử giả lập, check-list chất lượng, demo script và báo cáo nghiệm thu tổng thể.
* **[mobile-interaction/](file:///d:/Quản lý vận hành DYC/mobile-interaction)**: Đặc tả lớp tương tác trên thiết bị di động phục vụ phê duyệt nhanh (Telegram Bot) và nhập dữ liệu thực tế chi tiết (PWA).

---

## Cách chạy smoke test Inventory Admin

Chạy trong thư mục `web_demo/` (cần `pip install httpx` cho FastAPI `TestClient`).

```bash
python inventory_admin_smoke_test.py
```

Expected result:

```text
INVENTORY ADMIN SMOKE TEST PASSED
```

Tài liệu: [audit/inventory-admin-test-report.md](audit/inventory-admin-test-report.md), [audit/inventory-admin-demo-script.md](audit/inventory-admin-demo-script.md).

---

## Cách chạy smoke test Manual Order & Customer Management

Chạy trong thư mục `web_demo/` (cần `httpx` cho FastAPI `TestClient`, đã khai trong `web_demo/requirements.txt`).

```bash
cd web_demo
python manual_order_customer_smoke_test.py
```

Trên Windows PowerShell, nếu bảng Markdown in ra lỗi encoding, có thể thêm:

```powershell
$env:PYTHONIOENCODING='utf-8'
python manual_order_customer_smoke_test.py
```

Expected result:

```text
MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED
```

Tài liệu: [audit/manual-order-customer-test-report.md](audit/manual-order-customer-test-report.md), [audit/manual-order-customer-demo-script.md](audit/manual-order-customer-demo-script.md).

---

## 3. Thứ tự đọc tài liệu
Để hiểu nhanh chóng và toàn diện hệ thống này, khuyến nghị đọc tài liệu theo thứ tự sau:

1. **Tài liệu đặc tả kiến trúc gốc**: Đọc [workspace-spec.md](file:///d:/Quản lý vận hành DYC/workspace-spec.md) tại thư mục gốc để nắm bức tranh toàn cảnh và các nguyên tắc nghiệp vụ cốt lõi.
2. **Quy trình hoạt động tổng quát**: Đọc [workflows/workflow-overview.md](file:///d:/Quản lý vận hành DYC/workflows/workflow-overview.md) để hiểu các workflows phối hợp với nhau như thế nào.
3. **Các luồng chi tiết & Quy tắc tương ứng**:
   * Đọc `WF1` và `WF2` cùng với các quy tắc `R1`, `R2` và các schema khách hàng/đại lý để hiểu phần tiếp nhận thông tin.
   * Đọc `WF3` và `WF4` cùng với định mức chuẩn (`norm_matrix.csv`), quy tắc tối ưu mảnh dư `R5` để hiểu thuật toán so khớp phim.
   * Đọc `WF5` và `WF6` cùng với quy tắc trừ kho `R8` để hiểu luồng thi công thực tế và cập nhật tồn kho ảo.
4. **Đặc tả Agents & Human Personas**: Đọc các file trong thư mục `agents/` và `human-personas/` để nắm rõ vai trò cụ thể của từng thực thể tham gia luồng.
5. **Kịch bản kiểm thử**: Đọc `audit/test-cases.md` và `audit/demo-script.md` để xem cách chạy thử nghiệm hệ thống trên thực tế.
6. **Lớp tương tác di động (Mobile Interaction Layer)**: Đọc các file trong thư mục [mobile-interaction/](file:///d:/Quản lý vận hành DYC/mobile-interaction) (bắt đầu từ [mobile-interaction-spec.md](file:///d:/Quản lý vận hành DYC/mobile-interaction/mobile-interaction-spec.md)) để hiểu cách Quản lý và Kỹ thuật viên tương tác từ xa qua Telegram Bot và PWA.

---

## 4. Cách kiểm tra build-tracker.md
File [build-tracker.md](file:///d:/Quản lý vận hành DYC/build-tracker.md) tại thư mục gốc là công cụ theo dõi tiến độ chi tiết của dự án. 
* Mỗi file trong danh sách đều có liên kết trực tiếp, mô tả mục đích và trạng thái hiện tại (`⏳ Pending` hoặc `✅ Completed`).
* Khi bắt đầu xây dựng hoặc cập nhật bất kỳ tài liệu nào, các Agent hoặc Kỹ sư hệ thống cần cập nhật lại trạng thái tương ứng trong file tracker này để đảm bảo toàn đội ngũ luôn đồng bộ thông tin.

---

## 5. Cách mở rộng sau MVP
Sau khi phiên bản MVP (Minimum Viable Product) được nghiệm thu và chạy ổn định, hệ thống có thể mở rộng theo các hướng sau:
* **Tích hợp OCR tự động**: Sử dụng Agent có khả năng quét ảnh (Vision Agent) để tự động đọc thông tin từ ảnh chụp phiếu yêu cầu thi công của đại lý thay vì nhập thủ công hoặc parser text đơn thuần.
* **Tối ưu thuật toán lồng ghép (Nesting Algorithm)**: Nâng cấp `mod-inventory-matching.md` từ so khớp chiều dài/chiều rộng đơn thuần sang thuật toán xếp hình học 2D (2D Bin Packing) để tối ưu hóa việc cắt các chi tiết phức tạp của phim PPF cho từng bộ phận xe (cản trước, cản sau, gương...).
* **Ứng dụng di động cho Kỹ thuật viên**: Xây dựng giao diện web/app đơn giản cho KTV để họ có thể quét mã QR của cuộn phim/mảnh dư khi cắt, xác nhận trực tiếp kích thước thực tế bằng điện thoại tại xưởng thi công.
* **Dự báo nhu cầu vật tư**: Sử dụng dữ liệu báo cáo hao hụt và lịch sử dán phim của các đại lý để dự báo xu hướng tiêu thụ vật tư theo mùa, từ đó tối ưu kế hoạch đặt mua cuộn phim gốc mới.
