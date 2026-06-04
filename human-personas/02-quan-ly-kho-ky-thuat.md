# Persona Name
Quản lý Kho Kỹ thuật

# Role In Business Process
Chịu trách nhiệm giám sát toàn bộ kỹ thuật thi công và phân bổ vật tư phim cách nhiệt/PPF tại xưởng DYC. Là người phê duyệt cuối cùng (HITL-1) các phương án sử dụng vật tư (sử dụng mảnh dư hay cắt cuộn gốc) trước khi phát lệnh dán cho Kỹ thuật viên.

# Goals
* Kiểm soát hao hụt vật tư phim dán ở mức thấp nhất, tối đa hóa việc tái sử dụng mảnh dư (Sub-LOT).
* Phê duyệt các phương án dán phim nhanh chóng để kỹ thuật viên kịp thời tiến hành cắt dán.
* Đảm bảo kỹ thuật viên tuân thủ đúng quy trình cắt phim và khai báo số liệu thực tế chính xác.

# Daily Tasks
* Xem xét các đề xuất phân bổ vật tư do Agent tự động tính toán (đề xuất sử dụng mảnh dư Sub-LOT của Agent 5 hoặc cắt LOT gốc của Agent 6).
* Thực hiện chỉnh sửa phương án đề xuất (thay đổi cuộn LOT, thay đổi mảnh dư, hoặc điều chỉnh kích thước dán lý thuyết) nếu phát hiện bất hợp lý trên thực tế.
* Ký duyệt phê duyệt phương án (`APPROVED`) và nhập lý do điều chỉnh nếu có thay đổi.
* Phân công công việc (Job Card) cho các Kỹ thuật viên phụ trách thi công từng xe cụ thể.
* Giám sát các sự cố kỹ thuật phát sinh tại xưởng (ví dụ: KTV cắt hỏng phim, thiếu vật tư).

# Pain Points
* Hệ thống AI đề xuất mảnh dư trên giấy tờ rất khớp nhưng ngoài thực tế mảnh đó có thể đã bị xước nhẹ ở mép hoặc bụi bẩn, không dán được cho các chi tiết nhạy cảm (như nắp capo xe sang).
* Việc duyệt phương án thủ công tốn thời gian nếu số lượng xe dán tại xưởng trong ngày quá tải.
* Kỹ thuật viên đôi khi tự ý cắt phim mà không báo cáo, làm lệch tồn kho thực tế.

# System Needs
* Màn hình duyệt phương án trực quan, hiển thị rõ ràng sơ đồ vết cắt dự kiến và các thông số so sánh giữa phương án đề xuất của AI và phương án hiện tại.
* Cơ chế tự động khóa giữ chỗ (Soft Lock) vật tư trong lúc chờ duyệt để tránh tranh chấp kho.
* Cho phép ghi đè (Override) phương án nhanh kèm hộp thoại nhập lý do bắt buộc.

# Permissions
* Quyền phê duyệt hoặc từ chối Phương án phân bổ vật tư (`Approval/Rejection`).
* Quyền chỉnh sửa chi tiết phương án đề xuất (Đổi mã vật tư, chiều dài, chiều rộng, LOT, Sub-LOT).
* Quyền tạo và giao lệnh thi công (Job Card) cho Kỹ thuật viên.
* Quyền chỉnh sửa ma trận định mức xe (trong trường hợp khẩn cấp).

# Key Screens Needed
* Màn hình Duyệt Phương án Phân bổ Vật tư (Approval Portal).
* Bảng điều khiển giám sát hàng chờ thi công dán phim tại xưởng.
* Giao diện cấu hình định mức xe chuẩn (`Norm Matrix Manager`).

# Decisions They Can Make
* Quyết định phê duyệt hoặc bác bỏ phương án sử dụng vật tư do AI đề xuất.
* Quyết định thay đổi cuộn phim gốc được chỉ định cắt (ví dụ: đổi từ cuộn LOT cũ sang cuộn LOT mới do cuộn cũ bị lỗi vật lý).
* Quyết định tăng kích thước dán so với định mức tiêu chuẩn cho một xe cụ thể để đảm bảo an toàn kỹ thuật dán (cần nhập lý do chỉnh sửa).

# Decisions They Cannot Make
* Không thể tự ý thực hiện giao dịch trừ tồn kho trực tiếp trên hệ thống mà không có xác nhận thi công thực tế từ Kỹ thuật viên.
* Không thể tạo mới các tài khoản đại lý đối tác hoặc thay đổi công nợ đại lý.
