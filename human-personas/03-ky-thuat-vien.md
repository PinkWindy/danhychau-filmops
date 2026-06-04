# Persona Name
Kỹ thuật viên (KTV thi công dán phim)

# Role In Business Process
Là người trực tiếp thực thi thao tác vật lý trên vật tư tại xưởng dán phim: nhận lệnh cắt phim (Job Card), tiến hành đo đạc, cắt phim thực tế từ cuộn gốc hoặc mảnh dư, thi công dán lên xe và phản hồi kích thước thực tế sử dụng để hệ thống làm cơ sở trừ kho ảo (HITL-2).

# Goals
* Thực hiện dán phim đẹp, chuẩn xác theo đúng yêu cầu kỹ thuật của từng loại xe và gói dịch vụ.
* Tối thiểu hóa việc cắt hỏng phim; tận dụng tối đa lượng phim được cấp phát.
* Khai báo chính xác 100% kích thước phim cắt thực tế và chất lượng mảnh dư phát sinh để bảo vệ tính chính xác của kho ảo.

# Daily Tasks
* Xem danh sách Lệnh thi công (Job Card) được giao trong ngày trên giao diện làm việc.
* Nhận cuộn phim gốc hoặc mảnh dư được chỉ định từ kệ vật lý, đối chiếu mã LOT/Sub-LOT trên tem dán.
* Tiến hành đo đạc và cắt phim thực tế phục vụ dán xe.
* Thực hiện dán phim cách nhiệt (kính sườn, kính lái) hoặc PPF (thân vỏ) cho xe.
* Đo kích thước của phần phim thực tế đã cắt và phần dư rời còn lại.
* Nhập báo cáo kích thước thực tế sử dụng (`actual_length_m`, `actual_width_m`) và gửi xác nhận hoàn thành công việc lên hệ thống.
* Báo cáo các sự cố kỹ thuật (cắt lệch, phim lỗi, làm hỏng tấm phim cần xin cấp phát lại).

# Pain Points
* Đang thi công tay chân bám keo, nước dán phim, rất bất tiện khi phải chạm vào màn hình thiết bị hoặc nhập liệu ký tự phức tạp.
* Đôi khi định mức lý thuyết quá khít, không đủ để kéo căng phim dán bo góc mép đối với các dòng xe có kính cong lớn.
* Mất thời gian tìm kiếm mảnh dư vật lý trong kho nếu chúng không được dán nhãn hoặc xếp gọn gàng theo mã số.

# System Needs
* Giao diện số hóa cực kỳ tối giản, nút nhấn to, hỗ trợ giọng nói hoặc quét mã QR/Barcode trên cuộn phim/mảnh dư để xác nhận nhanh.
* Hộp thoại nhập kích thước cắt thực tế nhanh (chỉ cần điền 2 số: chiều dài và chiều rộng thực tế).
* Quy trình báo lỗi thi công (cắt hỏng) đơn giản để nhanh chóng được cấp phát bù tấm phim mới.

# Permissions
* Quyền xem Lệnh thi công được giao (`Read Job Card`).
* Quyền cập nhật trạng thái Lệnh thi công (In Progress -> Completed).
* Quyền nhập và gửi Xác nhận kích thước thực tế sử dụng (`Confirm Actual Usage`).
* Quyền báo cáo sự cố hư hỏng vật tư (`Report Scrap/Issue`).
* Không có quyền xem tồn kho tổng thể hoặc công nợ khách hàng.
* Không có quyền tự duyệt phương án cắt phim.

# Key Screens Needed
* Giao diện Lệnh thi công của Kỹ thuật viên (Technician Job Portal).
* Màn hình Quét mã vạch xác nhận vật tư và Nhập số liệu cắt thực tế.
* Form báo cáo sự cố cắt hỏng phim (Request Reprint/New Material).

# Decisions They Can Make
* Quyết định từ chối sử dụng cuộn phim hoặc mảnh dư được chỉ định dán nếu phát hiện vật tư bị trầy xước, nhăn nheo hoặc lỗi keo từ nhà sản xuất.
* Quyết định khai báo phần phim dư thừa còn lại là Scrap (phế liệu vứt đi) nếu thấy nó bị méo mó, không thể dán cho bất kỳ chi tiết nhỏ nào khác.

# Decisions They Cannot Make
* Không được phép tự ý thay đổi loại phim dán (ví dụ: đổi mã phim cách nhiệt 3M sang mã phim LLumar) mà không được Quản lý phê duyệt.
* Không được phép tự ý xuất kho cuộn phim mới từ kệ kho mà không có Job Card được phê duyệt trên hệ thống.
