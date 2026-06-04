# Mobile Interaction Layer Specification

## 1. Purpose
Lớp tương tác di động (**Mobile Interaction Layer**) được bổ sung nhằm hỗ trợ Quản lý kho kỹ thuật và Kỹ thuật viên thao tác nghiệp vụ nhanh chóng, trực quan ngay trên điện thoại cá nhân tại xưởng dán xe, phục vụ mục tiêu go-live online nhanh chóng cho dự án quản lý kho phim DYC.

## 2. Design Principles
* **Telegram Bot làm kênh thông báo & tác vụ nhanh**: Chỉ sử dụng Telegram Bot cho mục đích đẩy thông báo tức thời (Push Notification) và cung cấp các nút bấm tác vụ nhanh (Quick Actions) như Phê duyệt/Từ chối trực tiếp.
* **PWA (Progressive Web App) / Mobile Web cho biểu mẫu chi tiết**: Toàn bộ thao tác điền thông số phức tạp, chỉnh sửa thông tin chi tiết hoặc báo cáo ngoại lệ được dẫn link (Deep Link) từ Telegram sang PWA để tối ưu trải nghiệm nhập liệu.
* **Backend API/Core tập trung**: Mọi quyết định nghiệp vụ, kiểm tra ràng buộc dữ liệu và ghi log giao dịch bắt buộc phải xử lý tập trung tại Backend API. Lớp Mobile/Bot đóng vai trò là giao diện hiển thị và thu thập đầu vào, tuyệt đối không được tự ý bypass bất kỳ bước workflow, quy tắc kiểm tra (Rules) hay cơ chế ghi nhật ký kiểm toán (Audit) nào đã chốt.

## 3. Supported Mobile Users
* **Quản lý Kho Kỹ thuật**: Người phê duyệt các đề xuất phân bổ, quyết định sử dụng cuộn gốc hay mảnh dư và theo dõi hiệu suất sử dụng vật tư.
* **Kỹ thuật viên (KTV)**: Người nhận lệnh cắt phim (Job Card) và xác nhận kích thước cắt thực tế sau thi công dán xe.
* **Admin kho / Điều phối**: Nhận thông tin trạng thái luồng để kịp thời xử lý các ách tắc hoặc điều chỉnh thông tin đơn thô.
* **Kế toán kho / Quản lý vận hành**: Theo dõi nhanh báo cáo hao hụt và cảnh báo tồn kho trên giao diện di động.

## 4. Interaction Channels
* **Telegram Bot**: Cổng giao tiếp đẩy tin và nút tương tác nhanh qua webhook.
* **PWA / Mobile Web**: Ứng dụng web tối ưu cho di động chạy trực tiếp trên trình duyệt điện thoại không cần cài đặt qua App Store/Google Play.
* **Backend API / Webhook**: Hệ thống máy chủ xử lý dữ liệu và tích hợp các kênh di động.

## 5. Mobile Flow Overview
Luồng vận hành E2E kết hợp Mobile Layer được thực hiện như sau:
1. Hệ thống chạy tự động đến **WF4** và tạo đề xuất phân bổ vật tư (**Material Allocation Proposal**).
2. **Telegram Bot** tự động gửi thông báo phê duyệt kèm thông tin chi tiết đến Quản lý Kho Kỹ thuật.
3. Quản lý bấm nút **[Duyệt Nhanh]** trên Telegram hoặc click deep link mở **PWA** để xem chi tiết và chỉnh sửa.
4. Sau khi Quản lý duyệt, hệ thống chuyển sang **WF5** và tự động tạo khóa ảo giữ chỗ (**Reserved/Soft Lock**) cho LOT/OFFCUT tương ứng.
5. **Telegram Bot** tự động gửi Lệnh thi công (**Job Card**) chi tiết đến Kỹ thuật viên phụ trách.
6. KTV nhận cuộn phim, thực hiện thi công dán xe và click nút **[Xác Nhận Thực Tế]** trên Telegram để mở form nhập liệu trên **PWA**.
7. KTV điền thực tế và bấm gửi. Hệ thống chuyển sang **WF6**, thực thi trừ tồn kho vật lý ảo, thu hồi mảnh dư mới (nếu có), ghi nhận phế liệu (scrap), giải phóng Soft Lock và ghi nhật ký kiểm toán bất biến (**Audit Log**).

## 6. Boundary Rules
* **Telegram Bot không tự trừ kho**: Mọi tác vụ trừ kho vật lý chỉ xảy ra ở Backend sau khi có xác nhận kích thước thực tế của KTV ở bước cuối.
* **Telegram Bot không tự duyệt thay con người**: Không tự động phê duyệt các trường hợp tranh chấp/đề xuất phân bổ mà không có action phê duyệt chủ động từ tài khoản Quản lý.
* **Yêu cầu bắt buộc khi xác nhận thực tế**: KTV không thể gửi xác nhận nếu thiếu thông tin kích thước cắt thực tế (`actual_cut_block` và `actual_length_m`/`actual_width_m`).
* **Bắt buộc nhập lý do khi thay đổi kế hoạch**: Nếu Quản lý chỉnh sửa thông tin phân bổ (sửa mã LOT/mã Offcut) hoặc thay đổi block so với đề xuất, bắt buộc phải nhập trường lý do chỉnh sửa (`change_reason`).
* **Bắt buộc nhập lý do ngoại lệ**: Nếu kích thước cắt thực tế của KTV lệch so với kích thước kế hoạch vượt quá dung sai quy định, hệ thống sẽ đưa phiếu vào trạng thái `EXCEPTION_HOLD` và bắt buộc KTV phải điền trường lý do ngoại lệ (`exception_reason`).
* **Ghi nhận Audit đầy đủ**: 100% tương tác di động (bao gồm cả gửi thông báo, click nút, mở link, submit form) đều phải ghi nhận log kiểm toán để theo dõi lịch sử vết thao tác.

## 7. MVP Scope
### In Scope:
* Đẩy thông báo phê duyệt và nút Quick Action (Duyệt/Từ chối) lên Telegram Quản lý.
* Deep link chuyển từ Telegram sang PWA phê duyệt chi tiết.
* Gửi Job Card kèm thông tin vị trí kệ cuộn phim cho KTV qua Telegram.
* Form nhập liệu xác nhận thực tế (actual block, actual length, mảnh dư mới, scrap) trên PWA cho KTV.
* Biểu mẫu báo lỗi vật tư và ghi nhận phế liệu.
* Ghi log kiểm toán cho mọi thao tác từ thiết bị di động.

### Out of Scope:
* Phát triển ứng dụng Native App cài đặt qua store (iOS/Android).
* Tích hợp Discord Bot, Zalo Bot hoặc SMS Gateways trong giai đoạn MVP.
* Tự động in tem nhãn/barcode cho cuộn gốc và mảnh dư qua Bluetooth/Wifi.
* Đồng bộ dữ liệu kế toán tài chính và ERP thời gian thực.

## 8. Future Enhancements
* Xây dựng Native App đa nền tảng bằng Flutter/React Native.
* Tích hợp tính năng quét mã QR/Barcode bằng camera điện thoại trên PWA để tự động nhận diện cuộn phim và kệ lưu kho.
* Kết nối Bluetooth với thước đo laser/máy đo để tự động nhập kích thước phim thực tế không cần gõ phím.
* Đồng bộ API 2 chiều với hệ thống ERP trung tâm của DYC.
* Tích hợp Zalo OA (Zalo Official Account) làm kênh thông báo chính thức thay Telegram nếu DYC yêu cầu.
