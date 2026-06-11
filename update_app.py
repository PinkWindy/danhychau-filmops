import sys

path = 'd:/Quản lý vận hành DYC/web_demo/static/app.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_text = """        <div class="field-group">
          <label>Loại nguồn</label>
          <select id="edit-source-type" class="field-input">
            <option value="LOT" ${ws.allocated_source_type === 'LOT' ? 'selected' : ''}>Cuộn LOT (nguyên)</option>
            <option value="OFFCUT" ${ws.allocated_source_type === 'OFFCUT' ? 'selected' : ''}>Mảnh dư (Offcut)</option>
          </select>
        </div>
        <div class="field-group">
          <label>Mã cuộn LOT / Mảnh dư</label>
          <input type="text" id="edit-source-id" class="field-input" value="${ws.allocated_source_id || ''}" placeholder="vd: LOT-JB20-001">
          <small class="field-hint">Nhập mã LOT hoặc mảnh dư có trong kho. Xem tab "Kho cuộn LOT" để tra cứu.</small>
        </div>"""

new_text = """        <div class="field-group">
          <label>Loại nguồn</label>
          <select id="edit-source-type" class="field-input" onchange="window.updateEditSourceDropdown()">
            <option value="LOT" ${ws.allocated_source_type === 'LOT' ? 'selected' : ''}>Cuộn LOT (nguyên)</option>
            <option value="OFFCUT" ${ws.allocated_source_type === 'OFFCUT' ? 'selected' : ''}>Mảnh dư (Offcut)</option>
          </select>
        </div>
        <div class="field-group">
          <label>Mã cuộn LOT / Mảnh dư</label>
          <select id="edit-source-id" class="field-input">
             <!-- Options populated via JS -->
          </select>
          <small class="field-hint">Chọn nguồn khả dụng (đủ chiều dài tồn kho).</small>
        </div>"""

if old_text in content:
    content = content.replace(old_text, new_text)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced successfully!")
else:
    print("Old text not found!")
