/**
 * Modal "Chỉnh sửa vật tư PPF trước duyệt" — bảng hạng mục + nhiều nguồn LOT/OFFCUT.
 * Gọi PUT /api/workstreams/{id}/ppf-allocation
 */
(function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function autoSecondLot(alloc, lots) {
    const pt = alloc.ppf_type || 'T-TYPE';
    const full = (alloc.items || []).find((x) => x.item_code === 'FULL_VEHICLE_PPF');
    if (!full || !full.is_selected) return;
    const srcs = full.sources || [];
    if (srcs.length !== 1) return;
    const sid = (srcs[0].source_id || '').trim();
    if (!sid) return;
    const need = parseFloat(full.required_length_m) || 13;
    const lo = (lots || [])
      .filter((l) => (l.material_code || '') === pt)
      .sort((a, b) => String(a.lot_id).localeCompare(String(b.lot_id)));
    const cur = lo.find((l) => l.lot_id === sid);
    const r0 = cur ? parseFloat(cur.remaining_length_m) : 0;
    if (r0 + 1e-6 >= need) return;
    const short = need - r0;
    const second = lo.find((l) => l.lot_id !== sid && parseFloat(l.remaining_length_m || 0) + 1e-6 >= short);
    if (!second) return;
    srcs[0].allocated_length_m = Math.round(Math.min(r0, need) * 10) / 10;
    srcs.push({
      source_type: 'LOT',
      source_id: second.lot_id,
      allocated_length_m: Math.round(short * 10) / 10,
      note: 'Gợi ý tự động — LOT đầu không đủ 13m.',
    });
    full.sources = srcs;
  }

  function readAllocFromDom(base) {
    const alloc = JSON.parse(JSON.stringify(base));
    alloc.ppf_type = document.getElementById('ppf-alloc-ppf-type')?.value || alloc.ppf_type;
    alloc.change_reason = document.getElementById('ppf-alloc-reason')?.value?.trim() || '';
    alloc.required_total_length_m = parseFloat(document.getElementById('ppf-alloc-req-total')?.value) || 13;
    for (const it of alloc.items) {
      const sel = document.getElementById(`ppf_sel_${it.item_code}`);
      if (sel && !sel.disabled) it.is_selected = !!sel.checked;
      if (it.item_code === 'FULL_VEHICLE_PPF') it.is_selected = true;
      it.quantity = parseInt(document.getElementById(`ppf_qty_${it.item_code}`)?.value || '0', 10) || 0;
      it.planned_cut_block = document.getElementById(`ppf_block_${it.item_code}`)?.value || '';
      const rq = document.getElementById(`ppf_reqm_${it.item_code}`)?.value;
      it.required_length_m = rq === '' || rq == null ? 0 : parseFloat(rq);
      it.sources = [];
      document.querySelectorAll(`tr[data-ppf-src-item="${it.item_code}"]`).forEach((row) => {
        const stype = (row.querySelector('.ppf-src-type')?.value || 'LOT').toUpperCase();
        const sid = (row.querySelector('.ppf-src-id')?.value || '').trim();
        const len = parseFloat(row.querySelector('.ppf-src-len')?.value || '0') || 0;
        const note = (row.querySelector('.ppf-src-note')?.value || '').trim();
        if (sid && len > 0) it.sources.push({ source_type: stype, source_id: sid, allocated_length_m: len, note });
      });
    }
    return alloc;
  }

  function sourceOptions(ppfType, stype, lots, offcuts, curId) {
    const id = curId || '';
    if (stype === 'OFFCUT') {
      const rows = (offcuts || []).filter((o) => (o.material_code || '') === ppfType);
      return (
        `<option value="">— Chọn mảnh dư —</option>` +
        rows
          .map(
            (o) =>
              `<option value="${esc(o.offcut_id)}" ${o.offcut_id === id ? 'selected' : ''}>${esc(o.offcut_id)} (${o.length_m}m)</option>`
          )
          .join('')
      );
    }
    const rows = (lots || []).filter((l) => (l.material_code || '') === ppfType);
    return (
      `<option value="">— Chọn LOT —</option>` +
      rows
        .map(
          (l) =>
            `<option value="${esc(l.lot_id)}" ${l.lot_id === id ? 'selected' : ''}>${esc(l.lot_id)} (${l.remaining_length_m}m)</option>`
        )
        .join('')
    );
  }

  function renderBody(ctx) {
    const { alloc, lots, offcuts, ws } = ctx;
    const pt = alloc.ppf_type || 'T-TYPE';
    let rows = '';
    for (const it of alloc.items || []) {
      const locked = it.item_code === 'FULL_VEHICLE_PPF';
      rows += `<tr style="background:rgba(255,255,255,0.03)">
        <td style="padding:6px;vertical-align:middle">
          <input type="checkbox" id="ppf_sel_${it.item_code}" ${it.is_selected ? 'checked' : ''} ${locked ? 'disabled' : ''}>
        </td>
        <td style="padding:6px;font-weight:600;vertical-align:middle">${esc(it.item_name)}</td>
        <td style="padding:6px"><input type="number" class="field-input" style="width:56px" id="ppf_qty_${it.item_code}" min="0" step="1" value="${it.quantity || 0}"></td>
        <td style="padding:6px"><input type="text" class="field-input" style="width:88px" id="ppf_block_${it.item_code}" value="${esc(it.planned_cut_block || '')}" placeholder="vd 152x1300"></td>
        <td style="padding:6px"><input type="number" class="field-input" style="width:72px" id="ppf_reqm_${it.item_code}" min="0" step="0.1" value="${it.required_length_m != null ? it.required_length_m : ''}"></td>
        <td colspan="5"></td>
      </tr>`;
      if (!it.is_selected) continue;
      const srcs = it.sources && it.sources.length ? it.sources : [{ source_type: 'LOT', source_id: '', allocated_length_m: 0, note: '' }];
      srcs.forEach((src, j) => {
        const st = (src.source_type || 'LOT').toUpperCase();
        const opts = sourceOptions(pt, st, lots, offcuts, src.source_id);
        rows += `<tr data-ppf-src-item="${it.item_code}" data-ppf-src-idx="${j}">
          <td colspan="10" style="padding:6px 10px 6px 28px;background:rgba(0,0,0,0.14)">
            <div style="display:grid;grid-template-columns:72px 110px minmax(180px,1.2fr) 88px minmax(120px,1fr) 40px;gap:8px;align-items:center">
              <span style="font-size:11px;color:var(--text-secondary)">↳ #${j + 1}</span>
              <select class="field-input ppf-src-type">
                <option value="LOT" ${st === 'LOT' ? 'selected' : ''}>Cuộn LOT</option>
                <option value="OFFCUT" ${st === 'OFFCUT' ? 'selected' : ''}>Mảnh dư</option>
              </select>
              <select class="field-input ppf-src-id">${opts}</select>
              <input type="number" class="field-input ppf-src-len" step="0.1" min="0" value="${src.allocated_length_m != null ? src.allocated_length_m : ''}" placeholder="m">
              <input type="text" class="field-input ppf-src-note" placeholder="Ghi chú" value="${esc(src.note || '')}">
              <button type="button" class="btn btn-outline btn-sm ppf-del-src"${srcs.length < 2 ? ' disabled' : ''}>✕</button>
            </div>
          </td>
        </tr>`;
      });
      rows += `<tr><td colspan="10" style="padding:4px 6px">
        <button type="button" class="btn btn-outline btn-sm" data-ppf-add-src="${it.item_code}">+ Thêm nguồn</button>
        <button type="button" class="btn btn-outline btn-sm" data-ppf-reset style="margin-left:8px">Reset về đề xuất</button>
      </td></tr>`;
    }
    return `
      <div class="edit-guide-box">
        <i class="fa-solid fa-circle-info" style="color:var(--red);font-size:16px;flex-shrink:0;margin-top:2px"></i>
        <div>
          <strong style="color:var(--red)">Chỉnh sửa vật tư PPF trước duyệt</strong>
          <p style="margin:4px 0 0;color:var(--text-secondary);font-size:12px;line-height:1.6">
            Mặc định PPF thi công <strong>Full xe</strong>. Có thể chia nguồn từ nhiều cuộn LOT hoặc mảnh dư nếu một cuộn không đủ chiều dài.
          </p>
        </div>
      </div>
      <div class="edit-section">
        <div class="edit-section-title"><i class="fa-solid fa-film" style="color:var(--red)"></i> Loại PPF</div>
        <div class="mat-selector" id="ppf-mat-selector-pref">
          ${['T-TYPE', 'M-TYPE']
            .map((pid) => {
              const lab = pid === 'T-TYPE' ? 'T-TYPE — PPF trong' : 'M-TYPE — PPF mờ';
              const sel = pt === pid ? 'selected' : '';
              return `<div class="mat-option ${sel}" data-ppf-pick-type="${pid}"><div class="mat-option-title">${lab}</div></div>`;
            })
            .join('')}
        </div>
        <input type="hidden" id="ppf-alloc-ppf-type" value="${esc(pt)}">
      </div>
      <div class="edit-section">
        <div class="edit-section-title"><i class="fa-solid fa-table" style="color:var(--red)"></i> Bảng hạng mục &amp; nguồn vật tư</div>
        <div style="overflow-x:auto">
          <table class="data-table" style="width:100%;font-size:12px;border-collapse:collapse">
            <thead>
              <tr style="text-align:left;background:rgba(255,255,255,0.05)">
                <th style="padding:6px;width:36px">Chọn</th>
                <th style="padding:6px">Hạng mục thi công</th>
                <th style="padding:6px;width:64px">SL</th>
                <th style="padding:6px;width:96px">Kích thước (cm)</th>
                <th style="padding:6px;width:88px">Chiều dài yêu cầu (m)</th>
                <th style="padding:6px;width:108px">Loại nguồn</th>
                <th style="padding:6px;min-width:200px">Mã cuộn / mảnh dư</th>
                <th style="padding:6px;width:88px">Lấy từ nguồn (m)</th>
                <th style="padding:6px">Ghi chú</th>
                <th style="padding:6px;width:44px"></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
      <div class="edit-section" id="ppf-alloc-summary-box" style="border-color:rgba(0,188,212,0.35)">
        <div class="edit-section-title"><i class="fa-solid fa-scale-balanced" style="color:var(--teal-light)"></i> Kiểm tra đủ vật tư (Full xe)</div>
        <div id="ppf-alloc-summary" style="font-size:12px;color:var(--text-secondary);line-height:1.7"></div>
        <div id="ppf-alloc-warn" style="display:none;margin-top:8px;padding:8px;border-radius:8px;background:rgba(255,152,0,0.12);color:var(--amber);font-size:12px;font-weight:600"></div>
      </div>
      <div class="edit-section">
        <div class="edit-section-title"><i class="fa-solid fa-users"></i> Đội KTV</div>
        <div class="form-grid" style="gap:12px">
          <div class="field-group">
            <label>Tên đội</label>
            <input type="text" id="ppf-edit-team" class="field-input" value="${esc(ws.technician_team || '')}">
          </div>
          <div class="field-group">
            <label>KTV phụ trách</label>
            <input type="text" id="ppf-edit-tech" class="field-input" value="${esc(ws.assigned_technician_name || '')}">
          </div>
        </div>
      </div>
      <input type="hidden" id="ppf-alloc-req-total" value="${alloc.required_total_length_m != null ? alloc.required_total_length_m : 13}">
      <div class="edit-section" style="border-color:rgba(229,57,53,0.3);background:rgba(229,57,53,0.04)">
        <div class="edit-section-title" style="color:var(--red-light)"><i class="fa-solid fa-pen-to-square"></i> Lý do chỉnh sửa <span style="color:var(--red)">*</span></div>
        <p class="edit-hint">Bắt buộc khi đổi loại PPF, nguồn, chia nguồn, chỉnh kích thước/chiều dài, hoặc tick thêm hạng mục.</p>
        <textarea id="ppf-alloc-reason" class="field-input" rows="3" style="width:100%;resize:vertical" placeholder="Ví dụ: LOT đầu không đủ, chia thêm từ LOT mới."></textarea>
      </div>
    `;
  }

  function refreshSummary() {
    const ctx = window.__ppfEditorCtx;
    if (!ctx) return;
    const a = readAllocFromDom(ctx.alloc);
    const full = (a.items || []).find((x) => x.item_code === 'FULL_VEHICLE_PPF' && x.is_selected);
    const req = full ? parseFloat(full.required_length_m) || 13 : 13;
    const tot = full ? (full.sources || []).reduce((s, x) => s + (parseFloat(x.allocated_length_m) || 0), 0) : 0;
    const miss = Math.max(0, req - tot);
    const ok = tot + 1e-6 >= req;
    const el = document.getElementById('ppf-alloc-summary');
    const w = document.getElementById('ppf-alloc-warn');
    if (el) {
      el.innerHTML = `Tổng chiều dài yêu cầu (Full xe): <strong>${req}m</strong><br>
        Tổng đã phân bổ: <strong>${tot.toFixed(2)}m</strong><br>
        Còn thiếu: <strong>${miss.toFixed(2)}m</strong><br>
        Trạng thái: <strong style="color:${ok ? 'var(--teal-light)' : 'var(--amber)'}">${ok ? 'Đủ vật tư' : 'Thiếu vật tư'}</strong>`;
    }
    if (w) {
      if (!ok) {
        w.style.display = 'block';
        w.textContent = `PPF Full xe cần ${req}m. Nguồn đã chọn chưa đủ chiều dài.`;
      } else w.style.display = 'none';
    }
  }

  function wire(ctx) {
    const body = document.getElementById('ws-edit-body');
    body.querySelectorAll('[data-ppf-pick-type]').forEach((el) => {
      el.onclick = () => {
        const v = el.getAttribute('data-ppf-pick-type');
        document.getElementById('ppf-alloc-ppf-type').value = v;
        body.querySelectorAll('[data-ppf-pick-type]').forEach((x) => x.classList.remove('selected'));
        el.classList.add('selected');
        window._wsEditDirty = true;
        const a = readAllocFromDom(ctx.alloc);
        ctx.alloc = a;
        ctx.alloc.ppf_type = v;
        body.innerHTML = renderBody(ctx);
        wire(ctx);
        refreshSummary();
      };
    });
    body.querySelectorAll('input,select,textarea').forEach((el) => {
      if (el.id === 'ppf-alloc-reason') return;
      el.addEventListener('change', () => {
        window._wsEditDirty = true;
        if (el.classList.contains('ppf-src-type')) {
          const row = el.closest('tr[data-ppf-src-item]');
          const pt = document.getElementById('ppf-alloc-ppf-type').value;
          const st = el.value;
          const sel = row.querySelector('.ppf-src-id');
          sel.innerHTML = sourceOptions(pt, st, ctx.lots, ctx.offcuts, '');
        }
        refreshSummary();
      });
      el.addEventListener('input', () => {
        window._wsEditDirty = true;
        refreshSummary();
      });
    });
    body.querySelectorAll('[id^="ppf_sel_"]').forEach((bx) => {
      if (bx.disabled) return;
      bx.addEventListener('change', () => {
        window._wsEditDirty = true;
        const a = readAllocFromDom(ctx.alloc);
        ctx.alloc = a;
        body.innerHTML = renderBody(ctx);
        wire(ctx);
        refreshSummary();
      });
    });
    body.onclick = (e) => {
      const add = e.target.closest('[data-ppf-add-src]');
      if (add) {
        const code = add.getAttribute('data-ppf-add-src');
        const a = readAllocFromDom(ctx.alloc);
        const it = a.items.find((x) => x.item_code === code);
        if (it && it.is_selected) {
          if (!it.sources) it.sources = [];
          it.sources.push({ source_type: 'LOT', source_id: '', allocated_length_m: 0, note: '' });
        }
        ctx.alloc = a;
        body.innerHTML = renderBody(ctx);
        wire(ctx);
        refreshSummary();
        window._wsEditDirty = true;
        return;
      }
      const del = e.target.closest('.ppf-del-src');
      if (del && !del.disabled) {
        const row = del.closest('tr[data-ppf-src-item]');
        const code = row?.getAttribute('data-ppf-src-item');
        const idx = parseInt(row?.getAttribute('data-ppf-src-idx') || '0', 10);
        const a = readAllocFromDom(ctx.alloc);
        const it = a.items.find((x) => x.item_code === code);
        if (it && it.sources && it.sources.length > idx && it.sources.length > 1) {
          it.sources.splice(idx, 1);
        }
        ctx.alloc = a;
        body.innerHTML = renderBody(ctx);
        wire(ctx);
        refreshSummary();
        window._wsEditDirty = true;
      }
      if (e.target.closest('[data-ppf-reset]')) {
        fetch(`/api/workstreams/${ctx.wsId}`)
          .then((r) => r.json())
          .then((ws2) => {
            let alloc = JSON.parse(JSON.stringify(ws2.ppf_allocation || {}));
            autoSecondLot(alloc, ctx.lots);
            ctx.alloc = alloc;
            ctx.ws = ws2;
            body.innerHTML = renderBody(ctx);
            wire(ctx);
            refreshSummary();
            window._wsEditDirty = true;
          });
      }
    };
  }

  window.openPpfPreflightEditor = async function (wsId, ws, lots, offcuts) {
    const alloc = JSON.parse(JSON.stringify(ws.ppf_allocation || { items: [] }));
    if (!alloc.items || !alloc.items.length) {
      if (typeof toast === 'function') toast('error', 'PPF', 'Thiếu dữ liệu ppf_allocation từ server.');
      return;
    }
    autoSecondLot(alloc, lots);
    window.__ppfEditorCtx = { wsId, ws, lots, offcuts, alloc };
    document.getElementById('ws-edit-title').textContent = 'Chỉnh sửa vật tư PPF trước duyệt';
    document.getElementById('ws-edit-subtitle').textContent = `${wsId} | Đơn: ${ws.request_id} | ${typeof TRANG_THAI_VI !== 'undefined' ? TRANG_THAI_VI[ws.status] || ws.status : ws.status}`;
    const inner = document.querySelector('.ws-edit-modal-inner');
    if (inner) inner.style.maxWidth = '1020px';
    const body = document.getElementById('ws-edit-body');
    body.innerHTML = renderBody(window.__ppfEditorCtx);
    wire(window.__ppfEditorCtx);
    refreshSummary();
    document.getElementById('btn-ws-edit-save').onclick = () => window.savePpfPreflightEditor();
    document.getElementById('ws-edit-modal').style.display = 'flex';
  };

  window.savePpfPreflightEditor = async function () {
    const ctx = window.__ppfEditorCtx;
    if (!ctx) return;
    if (typeof window.dycPerm === 'function' && !window.dycPerm('can_write_allocation')) {
      if (typeof toast === 'function') toast('warning', 'Quyền', 'Tài khoản không được lưu phân bổ LOT.');
      return;
    }
    const reason = document.getElementById('ppf-alloc-reason')?.value?.trim() || '';
    const payload = readAllocFromDom(ctx.alloc);
    payload.change_reason = reason;
    payload.technician_team = document.getElementById('ppf-edit-team')?.value;
    payload.assigned_technician_name = document.getElementById('ppf-edit-tech')?.value;
    const full = (payload.items || []).find((x) => x.item_code === 'FULL_VEHICLE_PPF' && x.is_selected);
    const req = full ? parseFloat(full.required_length_m) || 13 : 13;
    const tot = full ? (full.sources || []).reduce((s, x) => s + (parseFloat(x.allocated_length_m) || 0), 0) : 0;
    if (tot + 1e-6 < req) {
      if (typeof toast === 'function') {
        toast('warning', 'PPF', `PPF Full xe cần ${req}m. Nguồn đã chọn chưa đủ chiều dài.`);
      }
      return;
    }
    try {
      const res = await fetch(`/api/workstreams/${ctx.wsId}/ppf-allocation`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data.detail;
        const msg =
          typeof d === 'object' && d && d.message
            ? d.message
            : typeof d === 'string'
              ? d
              : data.message || JSON.stringify(data);
        const code = typeof d === 'object' && d && d.error ? d.error : res.status;
        throw new Error(`[${code}] ${msg}`);
      }
      if (typeof toast === 'function') toast('success', 'PPF', 'Đã lưu phân bổ PPF trước duyệt.');
      window._wsEditDirty = false;
      window._wsEditModePpf = false;
      if (typeof window.closeWsEdit === 'function') window.closeWsEdit();
      if (typeof taiDonThiCong === 'function') await taiDonThiCong();
      if (typeof taiBangLuong === 'function') await taiBangLuong();
    } catch (err) {
      if (typeof toast === 'function') toast('error', 'Lỗi lưu PPF', err.message || String(err));
    }
  };
})();
