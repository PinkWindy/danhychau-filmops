# Persona Name
Quản lý Vận hành & Kế toán Kho

# Role In Business Process
Chịu trách nhiệm kiểm soát khía cạnh tài chính, đối soát định kỳ, quản trị chứng từ nhập/xuất kho và phân tích hiệu suất sử dụng vật tư phim tại DYC. Persona này sử dụng các báo cáo hiệu quả LOT, phân tích hao hụt, scrap để đối soát chi phí, lập kế hoạch đặt mua cuộn phim mới và đảm bảo tính khớp số liệu giữa kho ảo và kho thực tế.

# Goals
* Đảm bảo tính chính xác 100% về mặt sổ sách chứng từ xuất nhập kho của xưởng DYC.
* Cân đối chi phí vật tư dán phim, tối ưu hóa dòng vốn lưu động tồn kho (không để tồn kho quá nhiều LOT gốc mới hoặc tồn quá nhiều mảnh dư chết lâu ngày).
* Phát hiện và xử lý kịp thời các sai lệch giữa số liệu tồn kho ảo trên hệ thống và số lượng cuộn phim, mảnh dư thực tế dán thẻ trong kho vật lý.

# Daily Tasks
* Kiểm tra và đối soát các chứng từ xuất kho ảo được sinh tự động sau khi Kỹ thuật viên hoàn thành dán xe.
* Thực hiện khai báo và phê duyệt các giao dịch nhập kho LOT gốc mới mua về từ nhà sản xuất.
* Tổ chức kiểm kê định kỳ (tuần/tháng) số lượng cuộn phim gốc và mảnh dư vật lý, cập nhật điều chỉnh chênh lệch tồn kho trên hệ thống.
* Phân tích Báo cáo hiệu suất LOT (LOT Yield Report) để đánh giá tỷ lệ hao hụt phim của từng kỹ thuật viên và từng dòng xe.
* Kiểm tra danh sách các mảnh dư tồn lâu ngày (Dead Stock) để lên phương án dán khuyến mãi hoặc thanh lý giải phóng mặt bằng kho.
* Đối soát số lượng dán xe thực tế với hóa đơn thanh toán/báo cáo doanh số gửi các đại lý đối tác (Dealer).

# Pain Points
* Sai lệch tồn kho ảo và thực tế phát sinh liên tục do kỹ thuật viên quên gõ báo cáo hoặc gõ sai số liệu thực tế sau cắt.
* Khó khăn trong việc định giá tài sản tồn kho đối với các mảnh phim dư (Sub-LOT) vì giá trị của chúng phụ thuộc vào diện tích hữu ích còn lại thay vì tính theo cuộn nguyên.
* Quá trình đối soát công nợ với các đại lý ô tô mất nhiều thời gian do thiếu liên kết giữa mã đơn hàng của đại lý và mã cuộn phim đã dùng.

# System Needs
* Các báo cáo phân tích hiệu suất vật tư trực quan, tự động kết xuất dưới dạng bảng biểu, đồ thị (hao hụt, tái sử dụng mảnh dư, cảnh báo kho).
* Tính năng kiểm kho (Stocktake) thông minh, cho phép nhập số liệu kiểm kê thực tế và tự động sinh giao dịch điều chỉnh đối ứng (Adjust Transaction) kèm ghi log chi tiết.
* Giao diện đối soát hóa đơn đại lý tích hợp thông tin lịch sử xe và mã phim sử dụng.

# Permissions
* Toàn quyền quản trị kho: Nhập kho LOT mới, điều chỉnh tồn kho, phê duyệt phiếu xuất kho chính thức.
* Quyền xem toàn bộ hệ thống báo cáo phân tích hiệu suất (`Yield/Waste Reports`).
* Quyền quản lý danh mục đại lý đối tác, chính sách giá và công nợ đại lý.
* Quyền xem toàn bộ nhật ký hệ thống (`Audit Log`).
* Không có quyền can thiệp vào quy trình phân công Kỹ thuật viên dán xe.

# Key Screens Needed
* Bảng điều khiển Báo cáo Hiệu suất Vật tư & Hao hụt (Inventory Analytics Dashboard).
* Giao diện Nhập kho LOT và quản trị chứng từ xuất nhập kho.
* Màn hình Kiểm kê và Điều chỉnh tồn kho (`Stocktake Portal`).
* Cổng thông tin Đối soát doanh thu Đại lý (Dealer Settlement).

# Decisions They Can Make
* Quyết định nhập kho các cuộn phim gốc mới và phân bổ vị trí lưu trữ.
* Quyết định thực hiện điều chỉnh số liệu tồn kho trên hệ thống sau khi kiểm kê thực tế phát hiện chênh lệch (cần ghi log lý do điều chỉnh).
* Quyết định thanh lý hoặc chuyển trạng thái của các mảnh dư tồn lâu ngày (trên 90 ngày) thành phế liệu (Scrap) nếu thấy chất lượng keo bị suy giảm.

# Decisions They Cannot Make
* Không thể can thiệp phê duyệt phương án dán phim cho từng xe cụ thể tại xưởng (đây thuộc quyền của Quản lý Kho Kỹ thuật).
* Không được phép tự ý thay đổi định mức chuẩn của xe trong ma trận kỹ thuật.
