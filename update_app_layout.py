import sys

path = 'd:/Quản lý vận hành DYC/web_demo/static/app.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_text = """    <!-- PHẦN 1: LOẠI PHIM -->
    <div class="edit-section">
      <div class="edit-section-title"><i class="fa-solid fa-film" style="color:${mauIcon}"></i> 1. Loại Phim</div>
      ${isPpf ? `
        <p class="edit-hint">Chọn loại phim PPF phù hợp theo yêu cầu của khách:</p>
        <div class="mat-selector" id="ppf-mat-selector">
          ${LOAI_PHIM_PPF.map(p => `
            <div class="mat-option ${ws.selected_material_code === p.id ? 'selected' : ''}" onclick="chonLoaiPhim('${p.id}',this,'ppf-mat-selector','edit-ppf-type')">
              <div class="mat-option-title">${p.label}</div>
              <div class="mat-option-mota">${p.mota}</div>
            </div>`).join('')}
        </div>
        <input type="hidden" id="edit-ppf-type" value="${ws.selected_material_code || 'T-TYPE'}">
        <div id="ppf-change-reason-box" class="edit-warn-box" style="display:${ws.selected_material_code === 'M-TYPE' ? 'flex' : 'none'}">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Đổi sang M-TYPE (Mờ) cần nhập lý do riêng bên dưới phần "Lý do thay đổi".</span>
        </div>
      ` : `
        <p class="edit-hint">Loại phim cho từng kính theo quy định bắt buộc:</p>
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:10px">
          <div class="wf-plan-row" style="padding:8px 12px;font-weight:700;font-size:11px;background:rgba(255,255,255,0.03)">
            <span style="color:var(--text-secondary)">Hạng mục</span><span style="color:var(--text-secondary)">Loại phim</span>
          </div>
          ${HANG_MUC_WF.map(h => `
            <div class="wf-plan-row" style="padding:8px 12px">
              <span class="job-name">${h.label}</span>
              <select class="field-input wf-mat-select" style="width:100px;padding:4px 6px" data-job="${h.id}">
                <option value="JB20" ${h.id !== 'WINDSHIELD' ? 'selected' : ''}>JB20</option>
                <option value="RT40" ${h.id === 'WINDSHIELD' ? 'selected' : ''}>RT40</option>
              </select>
            </div>`).join('')}
        </div>
        <div class="edit-warn-box">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span><strong>Kính lái (Windshield) bắt buộc dùng RT40</strong> theo quy định an toàn giao thông. Không được đổi sang JB20.</span>
        </div>
      `}
    </div>

    <!-- PHẦN 2: KÍCH THƯỚC & KHẤU TRỪ -->
    <div class="edit-section">
      <div class="edit-section-title"><i class="fa-solid fa-ruler-combined" style="color:${mauIcon}"></i> 2. Kích Thước & Khấu Trừ Phim</div>
      <p class="edit-hint">Kích thước block cắt và chiều dài khấu trừ phải phù hợp với định mức cho dòng xe này.</p>
      <div class="form-grid" style="gap:12px">
        <div class="field-group">
          <label>Kích thước block cắt (cm)</label>
          <input type="text" id="edit-cut-block" class="field-input" value="${ws.planned_cut_block || ''}" placeholder="vd: 152x143">
          <small class="field-hint">Định dạng: rộng × dài tính bằng cm. vd: 152x1300 (PPF toàn xe), 152x143 (cách nhiệt)</small>
        </div>
        <div class="field-group">
          <label>Chiều dài khấu trừ (m)</label>
          <input type="number" id="edit-deduction" class="field-input" value="${ws.planned_deduction_length_m || ''}" step="0.01" min="0.1" max="50">
          <small class="field-hint">Chiều dài phim dự kiến sử dụng. Phải ≤ tồn kho nguồn được chọn.</small>
        </div>
      </div>
    </div>

    <!-- PHẦN 3: NGUỒN VẬT TƯ -->
    <div class="edit-section">
      <div class="edit-section-title"><i class="fa-solid fa-box-open" style="color:${mauIcon}"></i> 3. Nguồn Vật Tư</div>
      <p class="edit-hint">Thay đổi cuộn LOT hoặc mảnh dư được phân bổ cho luồng này:</p>
      <div class="form-grid" style="gap:12px">
        <div class="field-group">
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
        </div>
      </div>
    </div>

    <!-- PHẦN 4: HẠNG MỤC THI CÔNG -->
    <div class="edit-section">
      <div class="edit-section-title"><i class="fa-solid fa-list-check" style="color:${mauIcon}"></i> 4. Hạng Mục Thi Công</div>
      <p class="edit-hint">Tích chọn các hạng mục thi công. Có thể thêm hoặc bỏ hạng mục:</p>
      <div class="hang-muc-grid" id="hang-muc-grid">
        ${(isPpf ? HANG_MUC_PPF : HANG_MUC_WF).map(h => `
          <label class="hang-muc-item ${hangMucHienTai.includes(h.id) ? 'checked' : ''}">
            <input type="checkbox" value="${h.id}" ${hangMucHienTai.includes(h.id) ? 'checked' : ''} onchange="this.parentElement.classList.toggle('checked',this.checked)">
            <i class="fa-solid ${isPpf ? 'fa-shield-film' : 'fa-window-restore'}"></i>
            ${h.label}
          </label>`).join('')}
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-top:6px">Lưu ý: Thêm/bỏ hạng mục sẽ ảnh hưởng đến định mức vật tư. Kiểm tra lại chiều dài khấu trừ phía trên.</p>
    </div>"""

new_text = """    ${isPpf ? `
    <!-- LOẠI PHIM PPF -->
    <div class="edit-section">
      <div class="edit-section-title"><i class="fa-solid fa-film" style="color:${mauIcon}"></i> Loại Phim PPF</div>
      <div class="mat-selector" id="ppf-mat-selector">
        ${LOAI_PHIM_PPF.map(p => `
          <div class="mat-option ${ws.selected_material_code === p.id ? 'selected' : ''}" onclick="chonLoaiPhim('${p.id}',this,'ppf-mat-selector','edit-ppf-type')">
            <div class="mat-option-title">${p.label}</div>
            <div class="mat-option-mota">${p.mota}</div>
          </div>`).join('')}
      </div>
      <input type="hidden" id="edit-ppf-type" value="${ws.selected_material_code || 'T-TYPE'}">
    </div>
    ` : ''}

    <!-- BẢNG HẠNG MỤC & NGUỒN -->
    <div class="edit-section">
      <div class="edit-section-title"><i class="fa-solid fa-table" style="color:${mauIcon}"></i> Bảng hạng mục & nguồn</div>
      <div class="wf-table-container" style="background:var(--bg-card); border-radius:8px; border:1px solid var(--border); overflow:hidden; margin-bottom:12px">
        <table class="wf-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:13px">
          <thead style="background:rgba(255,255,255,0.03); font-size:11px; color:var(--text-secondary)">
            <tr>
              <th style="padding:10px; border-bottom:1px solid var(--border); text-align:center">CHỌN</th>
              <th style="padding:10px; border-bottom:1px solid var(--border)">HẠNG MỤC</th>
              ${isWf ? '<th style="padding:10px; border-bottom:1px solid var(--border)">MÃ VẬT TƯ</th>' : ''}
              <th style="padding:10px; border-bottom:1px solid var(--border)">NGUỒN (LOT / MẢNH DƯ)</th>
            </tr>
          </thead>
          <tbody id="hang-muc-grid">
            ${(isPpf ? HANG_MUC_PPF : HANG_MUC_WF).map((h, i) => `
              <tr>
                <td style="padding:10px; border-bottom:1px solid var(--border); text-align:center">
                  <input type="checkbox" value="${h.id}" ${hangMucHienTai.includes(h.id) ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
                </td>
                <td style="padding:10px; border-bottom:1px solid var(--border)"><strong>${h.label}</strong></td>
                ${isWf ? `
                <td style="padding:10px; border-bottom:1px solid var(--border)">
                  <select class="field-input wf-mat-select" style="width:90px;padding:4px 6px" data-job="${h.id}">
                    <option value="JB20" ${h.id !== 'WINDSHIELD' ? 'selected' : ''}>JB20</option>
                    <option value="RT40" ${h.id === 'WINDSHIELD' ? 'selected' : ''}>RT40</option>
                  </select>
                </td>
                ` : ''}
                ${i === 0 ? `
                <td rowspan="${isPpf ? HANG_MUC_PPF.length : HANG_MUC_WF.length}" style="padding:10px; vertical-align:top; border-left:1px solid var(--border); background:rgba(255,255,255,0.01)">
                  <div style="display:flex; flex-direction:column; gap:8px">
                    <select id="edit-source-type" class="field-input" onchange="window.updateEditSourceDropdown()" style="padding:6px; height: 32px">
                      <option value="LOT" ${ws.allocated_source_type === 'LOT' ? 'selected' : ''}>Cuộn LOT</option>
                      <option value="OFFCUT" ${ws.allocated_source_type === 'OFFCUT' ? 'selected' : ''}>Mảnh dư</option>
                    </select>
                    <select id="edit-source-id" class="field-input" style="padding:6px; height: 32px">
                    </select>
                  </div>
                </td>
                ` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Kích thước & Khấu trừ -->
      <div class="form-grid" style="gap:12px; background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; border:1px solid var(--border)">
        <div class="field-group">
          <label style="font-size:11px">Kích thước block cắt (cm)</label>
          <input type="text" id="edit-cut-block" class="field-input" value="${ws.planned_cut_block || ''}" placeholder="vd: 152x143">
        </div>
        <div class="field-group">
          <label style="font-size:11px">Chiều dài khấu trừ (m)</label>
          <input type="number" id="edit-deduction" class="field-input" value="${ws.planned_deduction_length_m || ''}" step="0.01" min="0.1" max="50">
        </div>
      </div>
    </div>"""

if old_text in content:
    content = content.replace(old_text, new_text)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced layout successfully!")
else:
    print("Old text not found!")
