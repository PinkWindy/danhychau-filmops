# Module Name
M11 - Phiếu xuất kho và Báo cáo Hiệu suất (Stock Transaction & Yield Reporting)

# Business Purpose
Thực thi các giao dịch trừ kho ảo chính thức, sinh phiếu xuất kho, tự động tạo mảnh dư mới hoặc ghi scrap phát sinh. Đồng thời tổng hợp toàn bộ lịch sử giao dịch để xuất các báo cáo phân tích hiệu suất vật tư phim cho Ban quản lý và Kế toán.

# Users
* Quản lý Vận hành & Kế toán Kho

# Key Features
* Sinh phiếu xuất kho vật tư (`Warehouse Issue Note`): Chứng từ kế toán ghi nhận lượng phim thực tế đã tiêu hao cho xe (mô phỏng tại [sample-03-warehouse-issue-note.json](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-03-warehouse-issue-note.json)).
* Ghi nhận giao dịch trừ tồn kho ảo: Trừ chiều dài cuộn LOT gốc tương ứng hoặc đánh dấu mảnh dư Sub-LOT cũ đã dùng thành `USED`.
* Nhập kho mảnh dư mới phát sinh: Đánh giá phần dư dở dang sau vết cắt thực tế, nếu đủ kích thước tái sử dụng thì tự động tạo bản ghi mảnh dư mới với trạng thái `ACTIVE`.
* Ghi nhận phế liệu (`Scrap`): Lưu vết diện tích phế liệu bỏ đi nếu phần dư không đạt chuẩn kích thước tái sử dụng.
* Kết xuất báo cáo phân tích hiệu quả vật tư:
  * **Báo cáo LOT**: Theo dõi hiệu suất sử dụng của cuộn phim (LOT Yield) - một cuộn dán được bao nhiêu đơn/xe, tổng diện tích phim có ích đã dán.
  * **Báo cáo Mảnh dư**: Danh sách mảnh dư trong kho, tỷ lệ tái sử dụng mảnh dư, cảnh báo mảnh dư tồn lâu ngày (Dead Stock).
  * **Yield & Tỷ lệ hao hụt (Waste Rate)**: Tính toán phần trăm diện tích Scrap phát sinh trên tổng diện tích cuộn phim gốc tiêu thụ.

# Input Data
* Xác nhận hoàn thành và kích thước cắt thực tế của KTV từ module M10.
* Dữ liệu tồn kho ảo `knowledge/lot_inventory.csv`, `knowledge/offcut_inventory.csv`.
* Quy tắc trừ kho và phân loại mảnh dư `rules/R8-inventory-deduction-rules.md`.

# Output Data
* Phiếu xuất kho vật tư JSON và bản ghi nhật ký giao dịch kho [inventory-transaction-log.json](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-05-inventory-transaction-log.json).
* Báo cáo hiệu suất sử dụng phim Markdown [sample-06-yield-report.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/outputs/sample-06-yield-report.md).

# Business Rules Applied
* Chỉ được thực hiện trừ kho và sinh phiếu xuất kho sau khi có xác nhận hoàn thành thi công từ Kỹ thuật viên (HITL-2).
* Phân loại mảnh dư và scrap tự động theo quy tắc kích thước tối thiểu đã định tại `R8`.

# Related Agents
* [08-inventory-yield-analytics-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/08-inventory-yield-analytics-agent.md)

# Related Workflows
* [WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md)

# Acceptance Criteria
* Trừ chính xác chiều dài cuộn LOT gốc và tạo mới mảnh dư / phế liệu tương ứng sau khi nhận xác nhận thi công.
* Tổng chênh lệch số lượng tồn kho ảo luôn bằng chênh lệch toán học giữa tồn kho trước và lượng xuất thực tế.
* Kết xuất thành công báo cáo hiệu suất vật tư định kỳ với các chỉ số: LOT Yield, Waste Rate, Offcut Reuse Rate chính xác theo toán học.
