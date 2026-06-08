# BÁO CÁO HIỆU SUẤT VẬT TƯ VÀ HAO HỤT PHIM (YIELD & MATERIAL PERFORMANCE REPORT)
*Kỳ báo cáo: Tháng 05/2026*  
*Được lập bởi: [08-inventory-yield-analytics-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/08-inventory-yield-analytics-agent.md)*  

---

## 1. Thống kê hiệu suất sử dụng cuộn gốc (LOT Performance)

| Mã LOT (LOT ID) | Mã phim (Material) | Trạng thái (Status) | Chiều dài ban đầu (m) | Đã xuất dán (m) | Số đơn đã dán (Requests) | Số xe đã hoàn thành (Cars) | Phế liệu phát sinh (Scrap m) | Tỷ lệ hao hụt (Scrap %) |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `LOT-PPF-X-001` | `T-TYPE` (PPF) | Đang dở dang | 15.00 | 7.80 | 4 đơn | 4 xe | 0.40 m | 5.12% |
| `LOT-JB20-001` | `JB20` (Window) | Đang dở dang | 30.00 | 17.50 | 12 đơn | 12 xe | 1.15 m | 6.57% |
| `LOT-JB20-003` | `JB20` (Window) | Đang dở dang | 30.00 | 22.00 | 15 đơn | 15 xe | 1.80 m | 8.18% |
| `LOT-RS20-001` | `RS20` (Window) | Đang dở dang | 30.00 | 8.00 | 5 đơn | 5 xe | 0.55 m | 6.87% |

* **Tỷ lệ hao hụt trung bình toàn kho:** **6.68%** (Đạt mục tiêu đề ra là dưới 8.0%).
* **Tỷ lệ tái sử dụng mảnh dư (Offcut Reusability Rate):** **64.2%** (Tổng số 9/14 mảnh dư phát sinh đã được tái sử dụng thành công cho các đơn dán lẻ tiếp theo thay vì khui cuộn nguyên).

---

## 2. Phân tích tối ưu hóa Cutting Group (Tránh trừ kho lặp)
Báo cáo ghi nhận hiệu quả vượt trội từ logic gom nhóm cắt thực tế (Cutting Group) đối với xe Lexus RX350 và ES250:

* **Tình huống dán gom:** Thi công kính sườn và kính hậu cho Lexus RX350.
  * *Định mức lý thuyết đơn lẻ (Norm Matrix):* Kính sườn = 1.43m (safety margin 10%), Kính hậu = 0.99m (safety margin 10%). Tổng cộng lẻ = **2.42m**.
  * *Thực tế Cutting Group (`CG_RX350_SIDE_REAR`):* Gom cắt kính sườn (92x130) + kính hậu (60x130) trên block cuộn phim **152x143 cm** (đã bao gồm safety margin 10% từ kích thước phôi thực tế là 130 cm). Lượng phim trừ kho thực tế chỉ là **1.43m** từ cuộn gốc `LOT-JB20-001`.
* **Hiệu quả:**
  * Tiết kiệm được **0.99m** phim JB20 trên mỗi xe RX350 thi công dán gom (giảm 40.9% lượng tiêu hao).
  * **Tránh lỗi trừ lặp:** Giao dịch kho ảo chỉ thực hiện trừ một lần duy nhất 1.43m theo `actual_cut_block` 152x130 do KTV xác nhận. Tránh việc trừ hai lần 1.43m và 0.99m làm sai lệch nghiêm trọng số liệu tồn kho.

---

## 3. Cảnh báo kho và các mảnh dư tồn lâu (Inventory Alerts)

### 3.1. Các cuộn phim sắp hết (LOT Low Stock Alert)
Hệ thống phát hiện các cuộn phim dở dang có chiều dài còn lại dưới ngưỡng an toàn 5.0m:
1. `LOT-PPF-Y-001` (`T-TYPE`): Chiều dài còn lại **4.50 m** (Ngưỡng cảnh báo: 5.00m). Đề xuất Kế toán kho lên kế hoạch chuẩn bị khui cuộn `LOT-PPF-Y-002`.
2. `LOT-JB20-003` (`JB20`): Chiều dài còn lại **8.00 m**. Tốc độ tiêu thụ cao (trung bình 2.5m/ngày), dự kiến hết trong 3 ngày tới.

### 3.2. Mảnh dư tồn lâu trong kho (Aging Offcuts Alert)
Danh sách các mảnh dư (Sub-LOT) có thời gian lưu trữ kệ vượt quá 30 ngày chưa được tái sử dụng:
1. `SUBLOT-PPFX-002` (Kệ `OFFCUT-RACK-A`): Nhập kho ngày 2026-05-12 (đã lưu kho 22 ngày). Kích thước: 1.52m x 2.0m. Đề xuất thuật toán ưu tiên ghép cưỡng bức cho các đơn dán lẻ nắp capo hoặc cản trước có kích thước phù hợp.
2. `SUBLOT-JB20-002` (Kệ `OFFCUT-RACK-C`): Nhập kho ngày 2026-05-22. Kích thước dở dang: 1.0m x 2.5m.
