# Module Name
M7 - Quản lý cuộn phim gốc (LOT gốc - Original Rolls)

# Business Purpose
Theo dõi chi tiết số lượng, thông số kỹ thuật, ngày nhập kho và lượng tồn chiều dài còn lại của các cuộn phim gốc (LOT) trong kho DYC. Module này là cơ sở để Agent 6 tính toán và đề xuất cắt cuộn gốc khi kho hết mảnh dư phù hợp.

# Users
* Quản lý Kho Kỹ thuật
* Quản lý Vận hành & Kế toán Kho

# Key Features
* Đăng ký mới cuộn phim gốc khi nhập kho: tự động gán mã `lot_id`, ghi nhận mã phim, chiều dài ban đầu (15m/30m), khổ rộng (1.52m), đơn giá, nhà sản xuất và ngày nhập kho.
* Theo dõi trạng thái cuộn phim: `ACTIVE` (đang sử dụng), `CLOSED` (đã dùng hết), `LOCKED` (đang có đơn giữ chỗ).
* Theo dõi trạng thái dở dang (`is_opened`): Xác định xem cuộn đã từng bị cắt chưa.
* Kiểm tra và cảnh báo tồn kho an toàn khi tổng lượng phim gốc của một mã phim trong kho xuống thấp hơn 15m.

# Input Data
* Thông tin cuộn phim gốc mới nhập hoặc yêu cầu truy vấn từ Agent 6.
* Cơ sở dữ liệu tồn kho cuộn gốc `knowledge/lot_inventory.csv`.
* Quy tắc phân bổ LOT gốc `rules/R6-lot-allocation-rules.md`.

# Output Data
* Bản ghi LOT gốc được cập nhật hoặc tạo mới trong `knowledge/lot_inventory.csv`.
* Danh sách LOT đề xuất khả dụng.

# Business Rules Applied
* Áp dụng nguyên tắc FIFO đối với các cuộn phim nguyên chưa mở.
* Ưu tiên sử dụng cuộn dở dang (`is_opened == true`) trước khi khui cuộn phim nguyên mới.

# Related Agents
* [06-lot-allocation-agent.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/agents/06-lot-allocation-agent.md)

# Related Workflows
* [WF4-toi-uu-manh-du-phan-bo-lot.md](file:///d:/Qu%E1%BA%A3n%20l%C3%BD%20v%E1%BA%ADn%20h%C3%A0nh%20DYC/workflows/WF4-toi-uu-manh-du-phan-bo-lot.md)

# Acceptance Criteria
* Ghi nhận và lưu trữ chính xác thông tin nhập kho LOT mới.
* Truy vấn đúng danh sách LOT gốc khả dụng thỏa mãn chiều rộng và chiều dài cắt tối thiểu.
* Trả về cảnh báo `"Low Inventory Alert"` chính xác khi tổng lượng tồn kho dưới ngưỡng an toàn.
