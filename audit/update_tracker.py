import re
import os

def update_tracker():
    tracker_path = r"d:\Quản lý vận hành DYC\build-tracker.md"
    
    with open(tracker_path, mode='r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update Workflows section
    old_workflows_pattern = (
        r'\| \*\*Workflows\*\* \| \[WF1-tiep-nhan-phieu-dai-ly-lexus\.md\].*?Sẽ triển khai \|\n'
        r'\| \*\*Workflows\*\* \| \[WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe\.md\].*?Sẽ triển khai \|\n'
        r'\| \*\*Workflows\*\* \| \[WF3-mapping-xe-hang-muc-phim-dinh-muc\.md\].*?Sẽ triển khai \|\n'
        r'\| \*\*Workflows\*\* \| \[WF4-toi-uu-manh-du-phan-bo-lot\.md\].*?Sẽ triển khai \|\n'
        r'\| \*\*Workflows\*\* \| \[WF5-phe-duyet-giao-ky-thuat-vien\.md\].*?Sẽ triển khai \|\n'
        r'\| \*\*Workflows\*\* \| \[WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao\.md\].*?Sẽ triển khai \|\n'
        r'\| \*\*Workflows\*\* \| \[workflow-overview\.md\].*?Sẽ triển khai \|'
    )
    
    new_workflows = (
        '| **Workflows** | [WF1-tiep-nhan-phieu-dai-ly-lexus.md](file:///d:/Quản lý vận hành DYC/workflows/WF1-tiep-nhan-phieu-dai-ly-lexus.md) | Luồng tiếp nhận và bóc tách thông tin thô từ phiếu yêu cầu của đại lý Lexus. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Xử lý tiếp nhận và bóc tách phiếu B2B/Lexus |\n'
        '| **Workflows** | [WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe.md](file:///d:/Quản lý vận hành DYC/workflows/WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe.md) | Luồng liên kết Master Data và khử trùng lặp khách hàng, cập nhật Vehicle Profile. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Chuẩn hóa và khử trùng lặp dữ liệu master |\n'
        '| **Workflows** | [WF3-mapping-xe-hang-muc-phim-dinh-muc.md](file:///d:/Quản lý vận hành DYC/workflows/WF3-mapping-xe-hang-muc-phim-dinh-muc.md) | Luồng ánh xạ xe x hạng mục thi công ra mã phim và tra định mức từ Excel. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Ánh xạ và tra định mức, phân biệt nhóm cắt |\n'
        '| **Workflows** | [WF4-toi-uu-manh-du-phan-bo-lot.md](file:///d:/Quản lý vận hành DYC/workflows/WF4-toi-uu-manh-du-phan-bo-lot.md) | Luồng chạy thuật toán so khớp mảnh dư trước, phân bổ LOT gốc sau theo FIFO. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Tối ưu mảnh dư theo cut block, phân bổ LOT FIFO |\n'
        '| **Workflows** | [WF5-phe-duyet-giao-ky-thuat-vien.md](file:///d:/Quản lý vận hành DYC/workflows/WF5-phe-duyet-giao-ky-thuat-vien.md) | Luồng trình quản lý duyệt phương án, điều chỉnh (nếu có) và phát lệnh cho KTV. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Duyệt phương án (Soft Lock) và tạo Job Card |\n'
        '| **Workflows** | [WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md](file:///d:/Quản lý vận hành DYC/workflows/WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md) | Luồng nhận xác nhận thực tế từ KTV, trừ kho, tạo mảnh dư, ghi scrap và tạo báo cáo. | `✅ Completed` | 2026-06-03 | 2026-06-03 | KTV confirm thực tế, trừ kho thực tế, ghi scrap và audit log |\n'
        '| **Workflows** | [workflow-overview.md](file:///d:/Quản lý vận hành DYC/workflows/workflow-overview.md) | Tài liệu hướng dẫn cách phối hợp toàn bộ 6 workflows trên thành chuỗi End-to-End. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Hướng dẫn phối hợp luồng E2E |'
    )
    
    content = re.sub(old_workflows_pattern, new_workflows, content, flags=re.DOTALL)

    # 2. Update Schemas section
    old_schemas_pattern = (
        r'\| \*\*Schemas\*\* \| \[request-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[dealer-account-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[end-customer-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[vehicle-profile-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[mapping-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[norm-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[cutting-group-schema\.json\].*?Sẽ triển khai trong bước tạo Schemas \|\n'
        r'\| \*\*Schemas\*\* \| \[offcut-recommendation-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[lot-allocation-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[approval-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[technician-confirmation-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[inventory-transaction-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[issue-note-schema\.json\].*?Sẽ triển khai \|\n'
        r'\| \*\*Schemas\*\* \| \[audit-log-schema\.json\].*?Sẽ triển khai \|'
    )
    
    new_schemas = (
        '| **Schemas** | [request-schema.json](file:///d:/Quản lý vận hành DYC/schemas/request-schema.json) | Schema JSON xác thực dữ liệu đầu vào của Phiếu yêu cầu thi công. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc phiếu yêu cầu dán xe |\n'
        '| **Schemas** | [dealer-account-schema.json](file:///d:/Quản lý vận hành DYC/schemas/dealer-account-schema.json) | Schema JSON cho đối tác đại lý doanh nghiệp. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc dữ liệu đại lý |\n'
        '| **Schemas** | [end-customer-schema.json](file:///d:/Quản lý vận hành DYC/schemas/end-customer-schema.json) | Schema JSON cho khách hàng lẻ/chủ xe. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc dữ liệu khách dán xe |\n'
        '| **Schemas** | [vehicle-profile-schema.json](file:///d:/Quản lý vận hành DYC/schemas/vehicle-profile-schema.json) | Schema JSON cho hồ sơ xe (VIN, model, lịch sử dán phim). | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc lịch sử và hồ sơ xe dán |\n'
        '| **Schemas** | [mapping-schema.json](file:///d:/Quản lý vận hành DYC/schemas/mapping-schema.json) | Schema JSON cho bảng ánh xạ dịch vụ x dòng xe -> mã vật tư phim. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc cấu hình ánh xạ xe dán |\n'
        '| **Schemas** | [norm-schema.json](file:///d:/Quản lý vận hành DYC/schemas/norm-schema.json) | Schema JSON cho định mức phim lý thuyết. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc định mức dán xe |\n'
        '| **Schemas** | [cutting-group-schema.json](file:///d:/Quản lý vận hành DYC/schemas/cutting-group-schema.json) | Schema JSON xác thực cấu trúc dữ liệu Cutting Group/Cut Block, gồm cut_group_id, job_items, piece_sizes, cut_block_width_cm, cut_block_length_cm, deduction_length_m và grouping_rule. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc nhóm cắt gom |\n'
        '| **Schemas** | [offcut-recommendation-schema.json](file:///d:/Quản lý vận hành DYC/schemas/offcut-recommendation-schema.json) | Schema JSON cho đề xuất chọn mảnh dư tối ưu. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc đề xuất sử dụng mảnh dư |\n'
        '| **Schemas** | [lot-allocation-schema.json](file:///d:/Quản lý vận hành DYC/schemas/lot-allocation-schema.json) | Schema JSON cho đề xuất cắt cuộn LOT gốc. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc đề xuất cắt cuộn gốc |\n'
        '| **Schemas** | [approval-schema.json](file:///d:/Quản lý vận hành DYC/schemas/approval-schema.json) | Schema JSON ghi nhận thông tin phê duyệt phương án cắt của Quản lý. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc phê duyệt (Soft Lock/Reserved) |\n'
        '| **Schemas** | [technician-confirmation-schema.json](file:///d:/Quản lý vận hành DYC/schemas/technician-confirmation-schema.json) | Schema JSON ghi nhận kích thước thực tế KTV xác nhận sau cắt. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc xác nhận kích thước thực tế của KTV |\n'
        '| **Schemas** | [inventory-transaction-schema.json](file:///d:/Quản lý vận hành DYC/schemas/inventory-transaction-schema.json) | Schema JSON ghi nhận giao dịch trừ/nhập kho ảo. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc giao dịch trừ kho thực tế |\n'
        '| **Schemas** | [issue-note-schema.json](file:///d:/Quản lý vận hành DYC/schemas/issue-note-schema.json) | Schema JSON định dạng Phiếu xuất kho vật tư. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc chứng từ xuất kho |\n'
        '| **Schemas** | [audit-log-schema.json](file:///d:/Quản lý vận hành DYC/schemas/audit-log-schema.json) | Schema JSON định cấu trúc bất biến của bản ghi nhật ký hệ thống. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Cấu trúc bản ghi nhật ký kiểm toán |\n'
        '| **Schemas** | [schema-relationship-map.md](file:///d:/Quản lý vận hành DYC/schemas/schema-relationship-map.md) | Tài liệu mô tả mối quan hệ và luồng dịch chuyển thông tin giữa các JSON Schema. | `✅ Completed` | 2026-06-03 | 2026-06-03 | Sơ đồ quan hệ giữa các schema |'
    )
    
    content = re.sub(old_schemas_pattern, new_schemas, content, flags=re.DOTALL)

    # 3. Update the description/note in Ghi chú & Quy định cập nhật
    content = content.replace(
        "8 Agent, 4 Human Personas, 11 Modules + 1 mapping table, 6 Workflows nghiệp vụ chính + 1 workflow-overview.md tổng hợp end-to-end, 12 Knowledge Base files, 10 Rules, 13 Schemas, 10 Outputs, 7 Audit files và 3 Root files.",
        "8 Agent, 4 Human Personas, 11 Modules + 1 mapping table, 6 Workflows nghiệp vụ chính + 1 workflow-overview.md tổng hợp end-to-end, 13 Knowledge Base files, 10 Rules, 14 Schemas + 1 schema-relationship-map.md, 10 Outputs, 7 Audit files và 3 Root files."
    )

    with open(tracker_path, mode='w', encoding='utf-8', newline='') as f:
        f.write(content)
        
    print("Successfully updated build-tracker.md!")

if __name__ == "__main__":
    update_tracker()
