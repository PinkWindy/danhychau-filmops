# Rule - Agent - Workflow Mapping

## 1. Purpose
Tài liệu này dùng để thiết lập mối liên kết chặt chẽ và kiểm soát giữa Hệ thống Quy tắc nghiệp vụ (Rule Set từ `R1` đến `R9`), Tác nhân AI (Agents), Quy trình hoạt động (Workflows) và các Điểm kiểm soát con người (Human Checkpoints) trong dự án **DYC Film Warehouse Agentic Workspace**. Việc ánh xạ này đảm bảo:
* Mọi quy tắc nghiệp vụ đều có Agent chịu trách nhiệm thực thi và có Workflow cụ thể để kích hoạt.
* Không có quy tắc nào bị bỏ sót (orphan rules) hoặc không được áp dụng trong thực tế.
* Các điểm kiểm soát Human Checkpoints được cắm đúng chỗ để đảm bảo tính an toàn vật tư và dữ liệu.

---

## 2. Mapping Table

| Rule ID | Rule Name | Primary Agent | Supporting Agents | Applied Workflow | Human Checkpoint | Key Control Objective |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R1** | [R1-intake-validation-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R1-intake-validation-rules.md) | [01-order-intake-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/01-order-intake-agent.md) | [02-customer-dealer-master-data-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/02-customer-dealer-master-data-agent.md) | [WF1-tiep-nhan-phieu-dai-ly-lexus.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF1-tiep-nhan-phieu-dai-ly-lexus.md) | Admin kho / Điều phối kiểm tra các phiếu thiếu dữ liệu hoặc bị gắn nhãn lỗi `INVALID`. | Ngăn chặn các phiếu yêu cầu thiếu thông tin Đại lý (Dealer), loại xe (Model), hoặc hạng mục thi công đi tiếp vào hệ thống. |
| **R2** | [R2-customer-dealer-data-governance-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R2-customer-dealer-data-governance-rules.md) | [02-customer-dealer-master-data-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/02-customer-dealer-master-data-agent.md) | [01-order-intake-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/01-order-intake-agent.md) | [WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe.md) | Admin kho hoặc Quản lý CSKH xác nhận khi tạo Dealer mới, khách hàng nghi ngờ trùng lặp hoặc xe bị trùng số khung (VIN). | Phân định rõ ràng Dealer Account, End Customer và Vehicle Profile; nghiêm cấm tự động gộp (merge) hồ sơ nếu chỉ trùng tên thô. |
| **R3** | [R3-vehicle-film-mapping-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R3-vehicle-film-mapping-rules.md) | [03-vehicle-film-mapping-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/03-vehicle-film-mapping-agent.md) | [04-norm-calculation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/04-norm-calculation-agent.md) | [WF3-mapping-xe-hang-muc-phim-dinh-muc.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF3-mapping-xe-hang-muc-phim-dinh-muc.md) | Quản lý Kỹ thuật phê duyệt khi có hạng mục dán phức tạp, có nhiều loại phim dán thay thế hoặc mapping không rõ nghĩa. | Đảm bảo model xe, hạng mục thi công và mã vật tư phim cách nhiệt/PPF phải khớp chính xác trong danh mục chuẩn hóa. |
| **R4** | [R4-norm-calculation-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R4-norm-calculation-rules.md) | [04-norm-calculation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/04-norm-calculation-agent.md) | [03-vehicle-film-mapping-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/03-vehicle-film-mapping-agent.md) | [WF3-mapping-xe-hang-muc-phim-dinh-muc.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF3-mapping-xe-hang-muc-phim-dinh-muc.md) | Quản lý Kho Kỹ thuật ký duyệt thủ công khi phát hiện thiếu định mức chuẩn hoặc định mức tính toán ra giá trị bất thường. | Ngăn chặn việc Agent tự ý điều chỉnh định mức gốc của xưởng dán; bảo đảm hệ số an toàn (+5% PPF, +10% Window Film) áp dụng đúng chuẩn. |
| **R5** | [R5-offcut-optimization-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R5-offcut-optimization-rules.md) | [05-offcut-optimization-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/05-offcut-optimization-agent.md) | [06-lot-allocation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/06-lot-allocation-agent.md), [07-approval-handoff-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/07-approval-handoff-agent.md) | [WF4-toi-uu-manh-du-phan-bo-lot.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF4-toi-uu-manh-du-phan-bo-lot.md) | Quản lý duyệt phương án kiểm tra kỹ đối với các mảnh dư dán nhãn cân nhắc (Match Score từ 60 đến 79) hoặc có cảnh báo chất lượng vật lý. | Ưu tiên tối đa việc sử dụng mảnh dư (Sub-LOT) trước LOT gốc; chỉ chấp nhận các mảnh dư khớp chính xác mã phim, đủ kích thước dán, trạng thái ACTIVE và chất lượng đạt chuẩn. |
| **R6** | [R6-lot-allocation-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R6-lot-allocation-rules.md) | [06-lot-allocation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/06-lot-allocation-agent.md) | [05-offcut-optimization-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/05-offcut-optimization-agent.md), [07-approval-handoff-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/07-approval-handoff-agent.md) | [WF4-toi-uu-manh-du-phan-bo-lot.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF4-toi-uu-manh-du-phan-bo-lot.md) | Quản lý duyệt xác nhận khi Agent yêu cầu khui cuộn LOT mới nguyên seal, hoặc khi có nhiều cuộn dở dang đủ điều kiện. | Đảm bảo cuộn gốc được chọn có chiều dài tồn khả dụng lớn hơn định mức dán; ưu tiên cuộn đang sử dụng dở dang, sau đó mới áp dụng FIFO cho cuộn mới. |
| **R7** | [R7-approval-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R7-approval-rules.md) | [07-approval-handoff-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/07-approval-handoff-agent.md) | [05-offcut-optimization-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/05-offcut-optimization-agent.md), [06-lot-allocation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/06-lot-allocation-agent.md) | [WF5-phe-duyet-giao-ky-thuat-vien.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF5-phe-duyet-giao-ky-thuat-vien.md) | **[HITL-1]** Quản lý Kho Kỹ thuật phê duyệt phương án dán phim số hóa trước khi chuyển xuống xưởng. | Nghiêm cấm Agent tự ý phê duyệt thay con người; trạng thái Approved chỉ đóng vai trò Soft Lock/Reserved giữ chỗ vật tư, không được phép trừ tồn kho vật lý. |
| **R8** | [R8-inventory-deduction-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R8-inventory-deduction-rules.md) | [08-inventory-yield-analytics-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/08-inventory-yield-analytics-agent.md) | [07-approval-handoff-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/07-approval-handoff-agent.md) | [WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md) | **[HITL-2]** Kỹ thuật viên xác nhận kích thước thực tế sau khi cắt phim dán xe. | Không tự động trừ tồn kho khi chưa có chữ ký xác nhận của KTV; tự động nhập kho mảnh dư mới nếu đủ kích thước tối thiểu dán lại, nếu không gán là Scrap. |
| **R9** | [R9-audit-log-rules.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/rules/R9-audit-log-rules.md) | [08-inventory-yield-analytics-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/08-inventory-yield-analytics-agent.md) | Tất cả các Agent trong hệ thống | Toàn bộ các quy trình từ [WF1] đến [WF6] | Quản lý / Kế toán kho kiểm tra đối soát chênh lệch tồn kho định kỳ thông qua tệp Audit Log. | Ghi log bất biến mọi hành động chỉnh sửa dữ liệu kho hoặc phương án phê duyệt. Bản log phải lưu đầy đủ thông số trước/sau, người thực hiện, thời gian và lý do. |

---

## 3. Coverage Check

Dưới đây là bảng đánh giá mức độ bao phủ (Coverage Audit) để rà soát xem có cấu phần nào bị khuyết thiếu liên kết hay không:

* **Có Rule nào không có Agent áp dụng không?**
  * *Kết quả*: Không. 100% Rules (từ `R1` đến `R9`) đều được gán cho ít nhất một Tác nhân chịu trách nhiệm chính (`Primary Agent`).
* **Có Rule nào không được Workflow nào sử dụng không?**
  * *Kết quả*: Không. Tất cả các Rules đều được kích hoạt trong phạm vi các luồng hoạt động cụ thể (từ `WF1` đến `WF6`). Quy tắc `R9` được áp dụng xuyên suốt tất cả các quy trình có phát sinh sửa đổi dữ liệu.
* **Có Workflow nào không có Rule kiểm soát không?**
  * *Kết quả*: Không.
    * `WF1` được kiểm soát bởi quy tắc validation đầu vào `R1`.
    * `WF2` được kiểm soát bởi quy tắc quản trị dữ liệu khách hàng `R2`.
    * `WF3` được kiểm soát bởi quy tắc ánh xạ phim `R3` và quy tắc tính định mức chuẩn `R4`.
    * `WF4` được kiểm soát bởi quy tắc tối ưu mảnh dư `R5` và quy tắc phân bổ cuộn gốc `R6`.
    * `WF5` được kiểm soát bởi quy tắc phê duyệt Soft Lock `R7`.
    * `WF6` được kiểm soát bởi quy tắc trừ kho thực tế `R8` và ghi log audit `R9`.
* **Có Human Checkpoint nào bị thiếu không?**
  * *Kết quả*: Không. Các điểm kiểm soát cứng của con người đều được phân bổ đúng tại các chặng rủi ro cao:
    * Kiểm tra chất lượng dữ liệu đầu vào (Admin kho).
    * Xác nhận trùng lặp hoặc mâu thuẫn Master Data (Admin / Quản lý).
    * Phê duyệt Soft Lock phương án xuất vật tư, ngăn thất thoát (Quản lý Kỹ thuật).
    * Xác nhận số liệu cắt phim thực tế ngoài xưởng, ngăn sai lệch kho ảo (Kỹ thuật viên).
    * Đối soát chênh lệch và kiểm kho thực tế (Kế toán kho).

---

## 4. Findings
Dựa trên kết quả rà soát Coverage Check:
> [!NOTE]
> **All Rules are mapped to at least one Agent and one Workflow.**
> Hệ thống đạt mức độ toàn vẹn cao, không tồn tại quy tắc mồ côi (orphan rules) và không có quy trình nào vận hành tự do mà không có các điều kiện ràng buộc kiểm soát.

---

## 5. Recommendations
Khuyến nghị ban dự án thực hiện rà soát và cập nhật lại tệp ánh xạ này mỗi khi:
1. **Thêm Agent mới** vào không gian làm việc.
2. **Thiết lập Workflow mới** hoặc điều chỉnh thứ tự phối hợp giữa các Agent.
3. **Bổ sung Rule mới** hoặc sửa đổi các tham số trong Rule hiện tại (ví dụ: thay đổi kích thước tối thiểu để nhập kho mảnh dư tại `R8`).
4. **Thay đổi cơ chế phê duyệt** (ví dụ: bổ sung thêm quyền phê duyệt của Kế toán kho cho các đơn hàng giá trị cao).
5. **Thay đổi cơ chế trừ kho**, quy trình nhập mảnh dư dở dang hoặc điều kiện phân loại phế liệu (Scrap).
