Đặt file danh mục chính thức tại đây:

  Danh-muc-Phuong-xa_moi.csv

Cấu trúc CSV (dòng 1 = header, dữ liệu từ dòng 2):
  - Cột C — Tên tỉnh/Thành phố mới
  - Cột I — Tên Phường/Xã mới

Encoding: UTF-8 (có BOM cũng được).

Sau đó từ thư mục web_demo chạy:

  python location_master_import.py

File sinh ra: static/location_master.json

(Tùy chọn: có thể đặt CSV cùng cấp thư mục gốc dự án với tên trên — script sẽ tự tìm nếu thiếu trong data/.)

Legacy Excel (.xlsx, sheet "1.DM Phường xã mới", cột D/J) vẫn đọc được nếu truyền:
  python location_master_import.py --input path/to/file.xlsx
