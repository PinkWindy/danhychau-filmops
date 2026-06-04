# Persona Name
Admin kho / Điều phối Tiếp nhận & Vận hành Phiếu yêu cầu

# Role In Business Process
Đóng vai trò điều phối viên trung tâm của xưởng thi công DYC: tiếp nhận các yêu cầu dán phim từ các đại lý (Dealer) hoặc khách lẻ, khởi tạo yêu cầu lên hệ thống, theo dõi tiến độ phê duyệt và thực thi đơn hàng, đồng thời làm cầu nối liên lạc giữa đại lý, quản lý phê duyệt và kỹ thuật viên.

# Goals
* Đảm bảo 100% phiếu yêu cầu dán phim từ các đại lý đối tác được đưa lên hệ thống chính xác, không sót thông tin quan trọng.
* Phân phối và theo dõi tiến độ các yêu cầu thi công kịp tiến độ giao xe của đại lý.
* Xử lý nhanh các cảnh báo về phiếu không hợp lệ (`INVALID`) bằng cách đối chiếu thông tin hoặc liên hệ đối tác bổ sung.

# Daily Tasks
* Tiếp nhận phiếu yêu cầu dán phim từ các nguồn (Email, Zalo, Cổng thông tin của Lexus Trung Tâm Sài Gòn...).
* Đưa phiếu yêu cầu lên hệ thống (bằng cách upload file PDF/ảnh hoặc nhập trực tiếp các trường thông tin thô).
* Rà soát danh sách phiếu dán nhãn `INVALID` từ Order Intake Agent, phối hợp với đại lý để bổ sung số khung, model xe hoặc làm rõ hạng mục.
* Giám sát bảng điều khiển (Dashboard) trạng thái xử lý của các phiếu (Draft -> Pending Approval -> Approved -> In Progress -> Completed).
* Thông báo cho Quản lý kho kỹ thuật khi có các phương án phân bổ vật tư cần duyệt gấp để kịp tiến độ.

# Pain Points
* Phiếu yêu cầu từ các đại lý thường gửi sát giờ giao xe, gây áp lực xử lý thời gian.
* Thông tin do nhân viên đại lý ghi tay hoặc gửi thô hay bị khuyết số khung (VIN) hoặc ghi sai model xe (ví dụ: ghi RX thay vì RX350 Premium).
* Khó khăn trong việc theo dõi thủ công xem xe nào đã dán xong, xe nào đang chờ phê duyệt vật tư.

# System Needs
* Giao diện nhập phiếu đơn giản, hỗ trợ kéo thả file và tự động bóc tách (OCR/Parsing) tốc độ cao.
* Màn hình Dashboard hiển thị trực quan trạng thái của từng mã phiếu yêu cầu dán phim.
* Hệ thống thông báo cảnh báo tức thời (Notification) khi phát hiện phiếu lỗi thông tin cốt lõi.

# Permissions
* Quyền tạo mới, chỉnh sửa thông tin thô của Phiếu yêu cầu (`Request`).
* Quyền xem danh sách đối tác đại lý và danh mục xe tiêu chuẩn.
* Quyền xem (Read-Only) trạng thái tồn kho LOT và mảnh dư (Sub-LOT).
* Không có quyền phê duyệt phương án cắt phim.
* Không có quyền thực hiện giao dịch xuất nhập kho.

# Key Screens Needed
* Màn hình Upload & Parsing phiếu yêu cầu.
* Màn hình Quản lý Danh sách Phiếu yêu cầu (Request Dashboard).
* Màn hình Chi tiết Phiếu yêu cầu và cập nhật thông tin bổ sung.

# Decisions They Can Make
* Quyết định từ chối tiếp nhận phiếu yêu cầu dán phim nếu đại lý không cung cấp được số khung xe chính xác.
* Quyết định ưu tiên đẩy nhanh luồng xử lý của một phiếu yêu cầu dán phim cụ thể (gắn cờ Hỏa tốc).

# Decisions They Cannot Make
* Không thể quyết định việc dán phim bằng LOT gốc hay mảnh dư (đây là đề xuất của Agent và do Quản lý duyệt).
* Không thể phê duyệt xuất kho phim cách nhiệt/PPF.
* Không thể thay đổi ma trận định mức của xe.
