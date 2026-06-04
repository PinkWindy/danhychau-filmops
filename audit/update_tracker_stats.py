import re
import sys

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def update_tracker_stats():
    tracker_path = r"d:\Quản lý vận hành DYC\build-tracker.md"
    
    with open(tracker_path, mode='r', encoding='utf-8') as f:
        content = f.read()

    # Find all status occurrences in markdown table rows
    # Rows look like: | Group | File Name | Purpose | Status | Created | Reviewed | Notes |
    # Status column is usually at index 4 (1-indexed: Group=1, FileName=2, Purpose=3, Status=4)
    # We can match rows with `✅ Completed` or `⏳ Pending`
    
    completed_count = len(re.findall(r'`✅ Completed`', content))
    pending_count = len(re.findall(r'`⏳ Pending`', content))
    total_files = completed_count + pending_count
    
    print(f"Counted Completed: {completed_count}")
    print(f"Counted Pending: {pending_count}")
    print(f"Total counted: {total_files}")
    
    # Let's replace the project status summary
    # Format is:
    # ## Trạng thái dự án
    # - **Tổng số file**: 88
    # - **Đã hoàn thành**: 51/88
    # - **Đang thực hiện**: 0/88 (Không có file dở dang)
    # - **Chưa bắt đầu (Pending)**: 37/88
    
    # But note that in resume summary, it says 89 files. Let's check why there's a difference.
    # Ah, in Ghi chú & Quy định cập nhật, it says:
    # "8 Agent, 4 Human Personas, 11 Modules + 1 mapping table, 13 Knowledge Base files, 10 Rules, 14 Schemas + 1 schema-relationship-map.md, 10 Outputs, 7 Audit files và 3 Root files."
    # Let's calculate: 8 + 4 + 11 + 1 + 13 + 10 + 14 + 1 + 10 + 7 + 3 = 82 files? Wait.
    # Let's list groups in build-tracker.md.
    # Let's read build-tracker.md table rows.
    lines = content.split('\n')
    rows_completed = 0
    rows_pending = 0
    for line in lines:
        if '`✅ Completed`' in line:
            rows_completed += 1
        elif '`⏳ Pending`' in line:
            rows_pending += 1
            
    print(f"Rows Completed: {rows_completed}")
    print(f"Rows Pending: {rows_pending}")
    total_rows = rows_completed + rows_pending
    print(f"Total Rows: {total_rows}")
    
    # Update project status text
    status_block_pattern = (
        r'## Trạng thái dự án\n'
        r'- \*\*Tổng số file\*\*:\s*\d+\n'
        r'- \*\*Đã hoàn thành\*\*:\s*\d+/\d+\n'
        r'- \*\*Đang thực hiện\*\*:\s*\d+/\d+.*?\n'
        r'- \*\*Chưa bắt đầu \(Pending\)\*\*:\s*\d+/\d+'
    )
    
    new_status_block = (
        f"## Trạng thái dự án\n"
        f"- **Tổng số file**: {total_rows}\n"
        f"- **Đã hoàn thành**: {rows_completed}/{total_rows}\n"
        f"- **Đang thực hiện**: 0/{total_rows} (Không có file dở dang)\n"
        f"- **Chưa bắt đầu (Pending)**: {rows_pending}/{total_rows}"
    )
    
    # Let's also check if there's any other status block style
    content_updated = re.sub(status_block_pattern, new_status_block, content, flags=re.DOTALL)
    
    # Let's write the file back
    with open(tracker_path, mode='w', encoding='utf-8', newline='') as f:
        f.write(content_updated)
        
    print("Successfully updated build-tracker.md status statistics!")

if __name__ == "__main__":
    update_tracker_stats()
