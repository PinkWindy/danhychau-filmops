# BÁO CÁO HIỆU SUẤT VẬT TƯ & HAO HỤT (LOT YIELD REPORT)
**Kỳ báo cáo:** [Từ ngày YYYY-MM-DD đến ngày YYYY-MM-DD]
**Người lập báo cáo:** [Họ tên và Mã nhân viên]
**Ngày xuất báo cáo:** [YYYY-MM-DD]

---

## 1. Tóm tắt hiệu suất kho vật tư (Inventory Yield Executive Summary)
* **Tổng diện tích phim gốc đã tiêu thụ (m2):** [Tổng diện tích xuất kho thực tế]
* **Tổng diện tích phim có ích thực tế dán lên xe (m2):** [Tổng diện tích dán thực tế]
* **Tổng diện tích mảnh dư tạo mới lưu kho (m2):** [Diện tích Sub-LOT mới]
* **Tổng diện tích phế liệu phát sinh (Scrap) (m2):** [Diện tích phế liệu]
* **Tỷ lệ hao hụt trung bình (Average Waste Rate):** [Scrap / Phim gốc (%) ]
* **Tỷ lệ tái sử dụng mảnh dư (Offcut Reuse Rate):** [Số đơn dùng mảnh dư / Tổng số đơn (%) ]

---

## 2. Chi tiết hiệu suất sử dụng theo từng LOT phim gốc

| Mã LOT (LOT ID) | Mã vật tư (Material) | Diện tích đầu kỳ (m2) | Chiều dài dán thực tế (m) | Số lượng đơn dán (Cars) | Tỷ lệ hao hụt LOT (Waste %) | Trạng thái (Status) |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| [LOT_ID_1] | [Material_Code] | [Value] | [Value] | [Value] | [Value] | [Active/Closed] |
| [LOT_ID_2] | [Material_Code] | [Value] | [Value] | [Value] | [Value] | [Active/Closed] |

---

## 3. Thống kê mảnh dư phát sinh & Tồn kho mảnh dư (Offcut Management)
* **Số lượng mảnh dư đang khả dụng trong kho:** [Tổng số mảnh dư ACTIVE]
* **Mảnh dư phát sinh mới trong kỳ:** [Số lượng mảnh dư tạo mới]
* **Mảnh dư đã tái sử dụng thành công:** [Số lượng mảnh dư chuyển sang USED]

### Danh sách mảnh dư tồn lâu ngày cảnh báo (Dead Stock Warning - Trên 90 ngày)

| Mã mảnh dư (Sub-LOT ID) | Mã vật tư (Material) | Kích thước (RxD) | Vị trí lưu kho (Location) | Ngày nhập kho (Import Date) | Tuổi kho (Days) | Đề xuất xử lý (Action) |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| [SUB_LOT_1] | [Material_Code] | [RxD] | [Shelf] | [YYYY-MM-DD] | [Số ngày] | [Thanh lý / Dán KM] |

---

## 4. Chi tiết phế liệu phát sinh (Scrap Analysis)
* **Tổng lượng Scrap phát sinh trong kỳ (m2):** [Value]
* **Nguyên nhân chính gây Scrap:**
  1. Sai lệch kỹ thuật khi cắt (KTV cắt nhầm kích thước): [ % ]
  2. Phần thừa mép dán xe không đạt kích thước tối thiểu tái sử dụng: [ % ]
  3. Phim hỏng trong quá trình kéo dán bo góc mép: [ % ]

---

## 5. Kết luận & Đề xuất hành động
* **Đánh giá hao hụt:** [So sánh tỷ lệ hao hụt thực tế với mục tiêu cam kết]
* **Đề xuất mua hàng:** [Danh sách mã vật tư cần đặt thêm cuộn phim gốc mới dựa trên cảnh báo an toàn kho]
* **Đề xuất quy trình:** [Các điều chỉnh về định mức chuẩn nếu phát hiện xe dán liên tục bị thiếu hoặc thừa nhiều phim]
