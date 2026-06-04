/**
 * Modal chung: chỉnh sửa phân bổ vật tư trước duyệt — PPF + Phim cách nhiệt.
 * PUT /api/workstreams/{id}/allocation
 */
(function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function normVm(value) {
    if (typeof window.normalizeVehicleModelCode === 'function') return window.normalizeVehicleModelCode(value);
    return String(value == null ? '' : value).trim();
  }

  async function loadWfActiveOptions(requestId, materialCode, stype, minLenM, minWidthM) {
    const mc = (materialCode || '').trim();
    if (!mc) return [];
    const p = new URLSearchParams({
      material_code: mc,
      min_length_m: String(minLenM != null ? minLenM : 0),
      min_width_m: String(minWidthM != null ? minWidthM : 0),
    });
    if (requestId) p.set('request_id', requestId);
    const path = (stype || 'LOT').toUpperCase() === 'OFFCUT' ? '/api/inventory/offcuts/active-options' : '/api/inventory/lots/active-options';
    try {
      const j = await fetch(path + '?' + p.toString()).then((r) => r.json());
      return j.items || [];
    } catch (e) {
      console.warn('[WF modal] active-options', e);
      return [];
    }
  }

  function wfOptsHtml(stype, items, curId) {
    const cur = curId || '';
    const st = (stype || 'LOT').toUpperCase();
    if (st === 'OFFCUT') {
      return (
        `<option value="">— Chọn mảnh dư —</option>` +
        (items || [])
          .map((o) => {
            const id = o.source_id || o.offcut_id || '';
            return `<option value="${esc(id)}" ${id === cur ? 'selected' : ''}>${esc(o.display_name || id)}</option>`;
          })
          .join('')
      );
    }
    return (
      `<option value="">— Chọn LOT —</option>` +
      (items || [])
        .map((l) => {
          const id = l.source_id || l.lot_id || '';
          return `<option value="${esc(id)}" ${id === cur ? 'selected' : ''}>${esc(l.display_name || id)}</option>`;
        })
        .join('')
    );
  }

  async function enrichWfAllocationFromNorm(ws, alloc, modelYearOverride, opts) {
    let req = {};
    try {
      req = await fetch(`/api/requests/${encodeURIComponent(ws.request_id)}`).then((r) => r.json());
    } catch (e) {
      return { req: {}, normRes: {} };
    }
    const vmRaw = (req.vehicle_model_code || '').trim() || (req.model_name || '').trim();
    const vm = normVm(vmRaw) || vmRaw;
    let my = null;
    if (modelYearOverride != null && modelYearOverride !== '' && !Number.isNaN(Number(modelYearOverride))) {
      my = Number(modelYearOverride);
    } else if (req.model_year != null && req.model_year !== '') {
      my = Number(req.model_year);
      if (Number.isNaN(my)) my = null;
    }
    const ft = 'Phim cách nhiệt';
    const q = new URLSearchParams({ vehicle_model_code: vm || vmRaw, film_type: ft });
    if (my != null && !Number.isNaN(my)) q.set('model_year', String(my));
    let normRes = {};
    try {
      normRes = await fetch('/api/vehicle-norms/resolve?' + q.toString()).then((r) => r.json());
    } catch (e) {
      console.warn('[WF modal] norm resolve', e);
    }
    const force = opts && opts.forceRefreshNormDims;
    const afBy = {};
    (normRes.auto_fill_items || []).forEach((x) => {
      if (x.job_item) afBy[x.job_item] = x;
    });
    const prefCache = {};
    async function pref(jobItem) {
      if (prefCache[jobItem] !== undefined) return prefCache[jobItem];
      prefCache[jobItem] = await fetch(
        '/api/material-preferences/resolve?' + new URLSearchParams({ film_type: ft, job_item: jobItem })
      ).then((r) => r.json());
      return prefCache[jobItem];
    }
    const MAIN = { WINDSHIELD: 1, REAR_WINDOW: 1, FRONT_SIDE: 1, REAR_SIDE_TRIANGLE: 1 };
    let svc = req.service_selection;
    if (!svc && req.service_selection_json) {
      try {
        svc = JSON.parse(req.service_selection_json);
      } catch (e) {
        svc = {};
      }
    }
    const wfSet = new Set((svc && svc.window_film_items ? svc.window_film_items : []).map(String));
    for (const it of alloc.items || []) {
      const ji = it.item_code;
      const af = afBy[ji];
      const pr = await pref(ji);
      const hasNormDims =
        af && (parseFloat(af.width_cm) || 0) > 0 && (parseFloat(af.length_cm) || 0) > 0;
      const defMc = ((af && af.material_code) || '').trim() || ((pr && pr.preferred_material_code) || '').trim();
      if (force && hasNormDims) {
        it.planned_size = af.size || '';
        it.required_width_cm = parseFloat(af.width_cm) || 0;
        it.required_length_cm = parseFloat(af.length_cm) || 0;
        if (defMc) it.material_code = defMc;
      } else if (hasNormDims) {
        if (!(it.planned_size || '').trim()) it.planned_size = af.size || '';
        if (!(parseFloat(it.required_width_cm) > 0)) it.required_width_cm = parseFloat(af.width_cm) || 0;
        if (!(parseFloat(it.required_length_cm) > 0)) it.required_length_cm = parseFloat(af.length_cm) || 0;
      }
      if (!(it.material_code || '').trim() && defMc) it.material_code = defMc;
      const inSvc = wfSet.size ? wfSet.has(ji) : true;
      const isMain = Object.prototype.hasOwnProperty.call(MAIN, ji);
      if (isMain && hasNormDims && inSvc) {
        it.is_selected = !!(it.material_code || '').trim();
        if (it.is_selected && (!it.quantity || parseInt(it.quantity, 10) < 1)) it.quantity = 1;
      } else if (!isMain && hasNormDims && inSvc && wfSet.has(ji)) {
        it.is_selected = !!(it.material_code || '').trim();
        if (it.is_selected && (!it.quantity || parseInt(it.quantity, 10) < 1)) it.quantity = 1;
      }
      if (it.is_selected) {
        const qtz = Math.max(1, parseInt(it.quantity, 10) || 1);
        it.quantity = qtz;
        const lcmF = parseFloat(it.required_length_cm) || 0;
        if (lcmF > 0) it.required_length_m = Math.round((lcmF / 100) * qtz * 10000) / 10000;
      }
    }
    return { req, normRes };
  }

  async function prefetchWfSourceDropdowns(ctx) {
    const rid = (ctx.ws.request_id || '').trim();
    ctx.wfRowOpts = ctx.wfRowOpts || {};
    const tasks = [];
    for (const it of ctx.alloc.items || []) {
      if (!it.is_selected) continue;
      const mc = (it.material_code || '').trim();
      if (!mc) continue;
      const minL = parseFloat(it.required_length_m) || 0;
      const minW = (parseFloat(it.required_width_cm) || 0) / 100;
      const srcs = it.sources && it.sources.length ? it.sources : [{ source_type: 'LOT', source_id: '' }];
      srcs.forEach((src, j) => {
        const st = (src.source_type || 'LOT').toUpperCase();
        const k = `${it.item_code}:${j}:${st}`;
        tasks.push(
          loadWfActiveOptions(rid, mc, st, minL, minW).then((rows) => {
            ctx.wfRowOpts[k] = rows;
          })
        );
      });
    }
    await Promise.all(tasks);
  }

  function isPpfCtx(ctx) {
    return ctx && ctx.ws && ctx.ws.workstream_type === 'PPF_INSTALLATION';
  }

  function autoSecondLot(alloc, lots) {
    if (!alloc.ppf_type) return;
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

  function sourceOptionsMat(materialCode, stype, lots, offcuts, curId) {
    const mc = (materialCode || '').trim();
    const id = curId || '';
    if (stype === 'OFFCUT') {
      const rows = (offcuts || []).filter((o) => (o.material_code || '') === mc);
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
    const rows = (lots || []).filter((l) => (l.material_code || '') === mc);
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

  function readAllocFromDom(ctx) {
    const alloc = JSON.parse(JSON.stringify(ctx.alloc));
    alloc.change_reason = document.getElementById('wa-alloc-reason')?.value?.trim() || '';
    if (isPpfCtx(ctx)) {
      alloc.ppf_type = document.getElementById('wa-ppf-type')?.value || alloc.ppf_type;
      alloc.required_total_length_m = parseFloat(document.getElementById('wa-ppf-req-total')?.value) || 13;
    }
    for (const it of alloc.items || []) {
      const sel = document.getElementById(`wa_sel_${it.item_code}`);
      if (sel && !sel.disabled) it.is_selected = !!sel.checked;
      if (isPpfCtx(ctx) && it.item_code === 'FULL_VEHICLE_PPF') it.is_selected = true;
      if (!isPpfCtx(ctx)) {
        if (sel && !sel.disabled && !sel.checked) {
          it.quantity = 0;
        } else {
          it.quantity = parseInt(document.getElementById(`wa_qty_${it.item_code}`)?.value || '0', 10) || 0;
        }
      } else {
        it.quantity = parseInt(document.getElementById(`wa_qty_${it.item_code}`)?.value || '0', 10) || 0;
      }
      it.planned_cut_block = document.getElementById(`wa_block_${it.item_code}`)?.value || it.planned_cut_block || '';
      const rq = document.getElementById(`wa_reqm_${it.item_code}`)?.value;
      it.required_length_m = rq === '' || rq == null ? it.required_length_m || 0 : parseFloat(rq);
      if (!isPpfCtx(ctx)) {
        it.material_code = (document.getElementById(`wa_mat_${it.item_code}`)?.value || '').trim();
        const wcm = document.getElementById(`wa_wcm_${it.item_code}`)?.value;
        const lcm = document.getElementById(`wa_lcm_${it.item_code}`)?.value;
        it.required_width_cm = wcm === '' || wcm == null ? it.required_width_cm || 0 : parseFloat(wcm);
        it.required_length_cm = lcm === '' || lcm == null ? it.required_length_cm || 0 : parseFloat(lcm);
        it.planned_size = it.planned_cut_block || '';
      }
      it.sources = [];
      if (!isPpfCtx(ctx)) {
        const trItem = document.querySelector(`tr[data-wa-item="${it.item_code}"]`);
        const stack = trItem && trItem.querySelector('.wa-src-stack');
        if (stack && it.is_selected) {
          stack.querySelectorAll('.wa-src-line').forEach((line) => {
            const stype = (line.querySelector('.wa-src-type')?.value || 'LOT').toUpperCase();
            const sid = (line.querySelector('.wa-src-id')?.value || '').trim();
            const len = parseFloat(line.querySelector('.wa-src-len')?.value || '0') || 0;
            const note = (line.querySelector('.wa-src-note')?.value || '').trim();
            if (sid && len > 0) it.sources.push({ source_type: stype, source_id: sid, allocated_length_m: len, note });
          });
        }
      } else {
        document.querySelectorAll(`tr[data-wa-src-item="${it.item_code}"]`).forEach((row) => {
          const stype = (row.querySelector('.wa-src-type')?.value || 'LOT').toUpperCase();
          const sid = (row.querySelector('.wa-src-id')?.value || '').trim();
          const len = parseFloat(row.querySelector('.wa-src-len')?.value || '0') || 0;
          const note = (row.querySelector('.wa-src-note')?.value || '').trim();
          if (sid && len > 0) it.sources.push({ source_type: stype, source_id: sid, allocated_length_m: len, note });
        });
      }
    }
    return alloc;
  }

  function renderPpfBody(ctx) {
    const { alloc, lots, offcuts, ws } = ctx;
    const pt = alloc.ppf_type || 'T-TYPE';
    let rows = '';
    for (const it of alloc.items || []) {
      const locked = it.item_code === 'FULL_VEHICLE_PPF';
      rows += `<tr style="background:rgba(255,255,255,0.03)">
        <td style="padding:6px"><input type="checkbox" id="wa_sel_${it.item_code}" ${it.is_selected ? 'checked' : ''} ${locked ? 'disabled' : ''}></td>
        <td style="padding:6px;font-weight:600">${esc(it.item_name)}</td>
        <td style="padding:6px"><input type="number" class="field-input" style="width:56px" id="wa_qty_${it.item_code}" min="0" value="${it.quantity || 0}"></td>
        <td style="padding:6px"><input type="text" class="field-input" style="width:88px" id="wa_block_${it.item_code}" value="${esc(it.planned_cut_block || '')}"></td>
        <td style="padding:6px"><input type="number" class="field-input" style="width:72px" id="wa_reqm_${it.item_code}" step="0.1" value="${it.required_length_m != null ? it.required_length_m : ''}"></td>
        <td colspan="5"></td></tr>`;
      if (!it.is_selected) continue;
      const srcs = it.sources && it.sources.length ? it.sources : [{ source_type: 'LOT', source_id: '', allocated_length_m: 0, note: '' }];
      srcs.forEach((src, j) => {
        const st = (src.source_type || 'LOT').toUpperCase();
        const opts = sourceOptionsMat(pt, st, lots, offcuts, src.source_id);
        rows += `<tr data-wa-src-item="${it.item_code}" data-wa-src-idx="${j}">
          <td colspan="10" style="padding:6px 10px 6px 28px;background:rgba(0,0,0,0.14)">
            <div style="display:grid;grid-template-columns:72px 110px minmax(180px,1.2fr) 88px minmax(120px,1fr) 40px;gap:8px;align-items:center">
              <span style="font-size:11px;color:var(--text-secondary)">↳ #${j + 1}</span>
              <select class="field-input wa-src-type"><option value="LOT" ${st === 'LOT' ? 'selected' : ''}>Cuộn LOT</option>
                <option value="OFFCUT" ${st === 'OFFCUT' ? 'selected' : ''}>Mảnh dư</option></select>
              <select class="field-input wa-src-id">${opts}</select>
              <input type="number" class="field-input wa-src-len" step="0.1" min="0" value="${src.allocated_length_m != null ? src.allocated_length_m : ''}" placeholder="m">
              <input type="text" class="field-input wa-src-note" placeholder="Ghi chú" value="${esc(src.note || '')}">
              <button type="button" class="btn btn-outline btn-sm wa-del-src"${srcs.length < 2 ? ' disabled' : ''}>✕</button>
            </div></td></tr>`;
      });
      rows += `<tr><td colspan="10" style="padding:4px 6px">
        <button type="button" class="btn btn-outline btn-sm" data-wa-add-src="${it.item_code}">+ Thêm nguồn</button>
        <button type="button" class="btn btn-outline btn-sm" data-wa-reset style="margin-left:8px">Reset</button></td></tr>`;
    }
    return `
      <div class="edit-guide-box"><i class="fa-solid fa-circle-info" style="color:var(--red)"></i><div>
        <strong style="color:var(--red)">Chỉnh sửa vật tư PPF trước duyệt</strong>
        <p class="edit-hint" style="margin:4px 0 0">Mặc định Full xe. Có thể chia nhiều LOT/OFFCUT. API: <code>/allocation</code></p></div></div>
      <div class="edit-section"><div class="edit-section-title"><i class="fa-solid fa-film" style="color:var(--red)"></i> Loại PPF</div>
        <div class="mat-selector">${['T-TYPE', 'M-TYPE'].map((pid) => {
          const lab = pid === 'T-TYPE' ? 'T-TYPE — PPF trong' : 'M-TYPE — PPF mờ';
          return `<div class="mat-option ${pt === pid ? 'selected' : ''}" data-wa-pick-ppf="${pid}"><div class="mat-option-title">${lab}</div></div>`;
        }).join('')}</div>
        <input type="hidden" id="wa-ppf-type" value="${esc(pt)}"></div>
      <div class="edit-section"><div class="edit-section-title"><i class="fa-solid fa-table" style="color:var(--red)"></i> Bảng hạng mục &amp; nguồn</div>
        <div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:12px"><thead><tr style="text-align:left;background:rgba(255,255,255,0.05)">
          <th style="padding:6px">Chọn</th><th>Hạng mục</th><th>SL</th><th>Kích thước (cm)</th><th>Chiều dài yêu cầu (m)</th>
          <th>Loại nguồn</th><th>Mã cuộn/mảnh dư</th><th>Lấy từ nguồn (m)</th><th>Ghi chú</th><th></th>
        </tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="edit-section" id="wa-summary-box"><div class="edit-section-title"><i class="fa-solid fa-scale-balanced" style="color:var(--teal-light)"></i> Kiểm tra (Full xe)</div>
        <div id="wa-alloc-summary"></div><div id="wa-alloc-warn" style="display:none;margin-top:8px;padding:8px;border-radius:8px;background:rgba(255,152,0,0.12);color:var(--amber);font-size:12px;font-weight:600"></div></div>
      <input type="hidden" id="wa-ppf-req-total" value="${alloc.required_total_length_m != null ? alloc.required_total_length_m : 13}">
      ${teamBlock(ws)}`;
  }

  function teamBlock(ws) {
    return `<div class="edit-section"><div class="edit-section-title"><i class="fa-solid fa-users"></i> Đội KTV</div>
      <div class="form-grid" style="gap:12px"><div class="field-group"><label>Tên đội</label>
        <input type="text" id="wa-edit-team" class="field-input" value="${esc(ws.technician_team || '')}"></div>
      <div class="field-group"><label>KTV</label><input type="text" id="wa-edit-tech" class="field-input" value="${esc(ws.assigned_technician_name || '')}"></div></div></div>`;
  }

  function wfSourceStackHtml(it, rowOpts) {
    if (!it.is_selected) return '<span style="opacity:0.55;font-size:11px">—</span>';
    const srcs =
      it.sources && it.sources.length
        ? it.sources
        : [{ source_type: 'LOT', source_id: '', allocated_length_m: 0, note: '' }];
    return srcs
      .map((src, j) => {
        const st = (src.source_type || 'LOT').toUpperCase();
        const optKey = `${it.item_code}:${j}:${st}`;
        const optItems = rowOpts[optKey] || [];
        const opts = wfOptsHtml(st, optItems, src.source_id);
        return `<div class="wa-src-line" data-wa-src-idx="${j}" style="display:grid;grid-template-columns:110px minmax(160px,1.1fr) 88px minmax(100px,1fr) 36px;gap:8px;align-items:center;margin-bottom:6px">
          <select class="field-input wa-src-type"><option value="LOT" ${st === 'LOT' ? 'selected' : ''}>Cuộn LOT</option>
            <option value="OFFCUT" ${st === 'OFFCUT' ? 'selected' : ''}>Mảnh dư</option></select>
          <select class="field-input wa-src-id">${opts}</select>
          <input type="number" class="field-input wa-src-len" step="0.01" min="0" value="${src.allocated_length_m != null ? src.allocated_length_m : ''}" placeholder="m">
          <input type="text" class="field-input wa-src-note" placeholder="Ghi chú" value="${esc(src.note || '')}">
          <button type="button" class="btn btn-outline btn-sm wa-del-src"${srcs.length < 2 ? ' disabled' : ''}>✕</button>
        </div>`;
      })
      .join('');
  }

  function renderWfBody(ctx) {
    const { alloc, lots, offcuts, ws } = ctx;
    const rowOpts = ctx.wfRowOpts || {};
    const nm = ctx.normMeta || {};
    const nid = (nm.norm_id && String(nm.norm_id)) || '';
    const strat = (nm.resolution_strategy && String(nm.resolution_strategy)) || '';
    const draftRaw = ctx.normYearDraft != null && ctx.normYearDraft !== '' ? String(ctx.normYearDraft) : '';
    const hint =
      nid || strat
        ? `Đề xuất: <code>${esc(nid || '—')}</code>${strat ? ` — <span style="opacity:0.9">${esc(strat)}</span>` : ''}`
        : 'Chưa khớp định mức — chỉnh năm model và bấm <strong>Áp dụng định mức</strong>, hoặc nhập tay trên phiếu / bảng.';
    let rows = '';
    for (const it of alloc.items || []) {
      const stackInner = wfSourceStackHtml(it, rowOpts);
      rows += `<tr data-wa-item="${it.item_code}">
        <td style="padding:6px;vertical-align:top"><input type="checkbox" id="wa_sel_${it.item_code}" ${it.is_selected ? 'checked' : ''}></td>
        <td style="padding:6px;font-weight:600;vertical-align:top">${esc(it.item_name)}</td>
        <td style="padding:6px;vertical-align:top"><input type="text" class="field-input" style="width:72px" id="wa_mat_${it.item_code}" value="${esc(it.material_code || '')}"></td>
        <td style="padding:6px;vertical-align:top"><input type="number" class="field-input" style="width:56px" id="wa_qty_${it.item_code}" min="0" value="${it.quantity || 0}"></td>
        <td style="padding:6px;vertical-align:top"><input type="text" class="field-input" style="width:80px" id="wa_block_${it.item_code}" value="${esc(it.planned_size || it.planned_cut_block || '')}"></td>
        <td style="padding:6px;vertical-align:top"><input type="number" class="field-input" style="width:52px" id="wa_wcm_${it.item_code}" step="0.1" value="${it.required_width_cm != null ? it.required_width_cm : ''}"></td>
        <td style="padding:6px;vertical-align:top"><input type="number" class="field-input" style="width:52px" id="wa_lcm_${it.item_code}" step="0.1" value="${it.required_length_cm != null ? it.required_length_cm : ''}"></td>
        <td style="padding:6px;vertical-align:top"><input type="number" class="field-input" style="width:72px" id="wa_reqm_${it.item_code}" step="0.01" value="${it.required_length_m != null ? it.required_length_m : ''}"></td>
        <td colspan="4" style="padding:6px;vertical-align:top;background:rgba(0,30,80,0.12)"><div class="wa-src-stack" data-wa-src-item="${it.item_code}">${stackInner}</div></td>
        <td style="padding:6px;vertical-align:top;white-space:nowrap">
          <button type="button" class="btn btn-outline btn-sm" data-wa-add-src="${it.item_code}"${it.is_selected ? '' : ' disabled'}>+ Nguồn</button>
          <button type="button" class="btn btn-outline btn-sm" data-wa-reset style="margin-left:6px">Reset</button>
        </td></tr>`;
    }
    return `
      <div class="edit-guide-box"><i class="fa-solid fa-circle-info" style="color:var(--blue-light)"></i><div>
        <strong style="color:var(--blue-light)">Chỉnh sửa vật tư Phim cách nhiệt trước duyệt</strong>
        <p class="edit-hint" style="margin:4px 0 0">Bảng hạng mục kính — mỗi hạng mục một hàng; chia nguồn theo mét cắt. API: <code>/allocation</code></p></div></div>
      <div class="edit-section" style="padding-bottom:4px">
        <div class="edit-section-title"><i class="fa-solid fa-calendar-days" style="color:var(--blue-light)"></i> Năm model &amp; định mức đề xuất</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-top:8px">
          <div class="field-group" style="margin:0;min-width:140px"><label style="font-size:11px">Năm model (phiếu YC + chỉnh tay)</label>
            <input type="number" class="field-input" id="wa-norm-model-year" min="1985" max="2035" step="1" placeholder="VD: 2022" value="${esc(draftRaw)}">
          </div>
          <button type="button" class="btn btn-sm" id="wa-apply-norm-year">Áp dụng định mức</button>
          <div class="edit-hint" id="wa-norm-resolve-hint" style="margin:0;flex:1;min-width:200px">${hint}</div>
        </div>
      </div>
      <div class="edit-section"><div class="edit-section-title"><i class="fa-solid fa-table" style="color:var(--blue-light)"></i> Bảng hạng mục &amp; nguồn</div>
        <div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:12px"><thead><tr style="text-align:left;background:rgba(255,255,255,0.05)">
          <th>Chọn</th><th>Hạng mục</th><th>Mã vật tư</th><th>SL</th><th>Size</th><th>Rộng cm</th><th>Dài cm</th><th>Yêu cầu (m)</th>
          <th colspan="4">Nguồn (LOT / mảnh dư)</th><th></th>
        </tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="edit-section" id="wa-summary-box"><div class="edit-section-title"><i class="fa-solid fa-scale-balanced" style="color:var(--teal-light)"></i> Kiểm tra từng hạng mục</div>
        <div id="wa-alloc-summary"></div><div id="wa-alloc-warn" style="display:none;margin-top:8px;padding:8px;border-radius:8px;background:rgba(255,152,0,0.12);color:var(--amber);font-size:12px;font-weight:600"></div></div>
      ${teamBlock(ws)}`;
  }

  function computeWfRollCutSummary(alloc) {
    const items = (alloc.items || []).filter((x) => x && x.item_code);
    const byCode = {};
    items.forEach((x) => {
      byCode[x.item_code] = x;
    });
    const blocks = [];
    const consumed = new Set();
    const mcn = (it) => String(it.material_code || '').trim().toUpperCase();
    const r = byCode.REAR_WINDOW;
    const f = byCode.FRONT_SIDE;
    if (r && f && r.is_selected && f.is_selected) {
      const mcR = mcn(r);
      const mcF = mcn(f);
      if (mcR && mcR === mcF) {
        const rw = parseFloat(r.required_width_cm) || 0;
        const rl = parseFloat(r.required_length_cm) || 0;
        const fw = parseFloat(f.required_width_cm) || 0;
        const fl = parseFloat(f.required_length_cm) || 0;
        if (rw > 0 && rl > 0 && fw > 0 && fl > 0 && Math.abs(rl - fl) <= 1) {
          const commonL = rl;
          const wsum = rw + fw;
          blocks.push({
            kind: 'MERGED_REAR_FRONT',
            material_code: mcR,
            label: 'Kính hậu + Sườn trước (gộp khổ)',
            block_cm: `${Math.round(commonL)}×${Math.round(wsum)}`,
            roll_strip_m: commonL / 100,
            item_codes: ['REAR_WINDOW', 'FRONT_SIDE'],
          });
          consumed.add('REAR_WINDOW');
          consumed.add('FRONT_SIDE');
        }
      }
    }
    const names = {
      WINDSHIELD: 'Kính lái',
      REAR_WINDOW: 'Kính hậu',
      FRONT_SIDE: 'Sườn trước',
      REAR_SIDE_TRIANGLE: 'Sườn sau + tam giác',
      TRIANGLE: 'Tam giác',
      REAR_SIDE: 'Sườn sau',
      SUNROOF: 'Kính trời',
    };
    const ORDER = ['WINDSHIELD', 'REAR_WINDOW', 'FRONT_SIDE', 'REAR_SIDE_TRIANGLE', 'TRIANGLE', 'REAR_SIDE', 'SUNROOF'];
    for (let i = 0; i < ORDER.length; i += 1) {
      const ji = ORDER[i];
      if (consumed.has(ji)) continue;
      const it = byCode[ji];
      if (!it || !it.is_selected) continue;
      const mc = mcn(it);
      if (!mc) continue;
      const w_cm = parseFloat(it.required_width_cm) || 0;
      const l_cm = parseFloat(it.required_length_cm) || 0;
      if (w_cm <= 0 || l_cm <= 0) continue;
      let strip;
      if (ji === 'WINDSHIELD') strip = Math.max(w_cm, l_cm) / 100;
      else {
        const hi = Math.max(w_cm, l_cm);
        const lo = Math.min(w_cm, l_cm);
        strip = hi >= 150 ? lo / 100 : hi / 100;
      }
      blocks.push({
        kind: 'SINGLE',
        material_code: mc,
        label: names[ji] || ji,
        block_cm: `${Math.round(w_cm)}×${Math.round(l_cm)}`,
        roll_strip_m: strip,
        item_codes: [ji],
      });
    }
    const byMaterial = {};
    blocks.forEach((b) => {
      const mc = b.material_code;
      if (!byMaterial[mc]) {
        byMaterial[mc] = { material_code: mc, blocks: [], total_roll_strip_m: 0 };
      }
      byMaterial[mc].blocks.push({
        kind: b.kind,
        label: b.label,
        block_cm: b.block_cm,
        roll_strip_m: b.roll_strip_m,
        item_codes: b.item_codes,
      });
      byMaterial[mc].total_roll_strip_m += b.roll_strip_m;
    });
    const linesParts = [];
    Object.keys(byMaterial)
      .sort()
      .forEach((mc) => {
        const row = byMaterial[mc];
        const parts = row.blocks.map((x) => `${esc(x.block_cm)} cm — ${esc(x.label)}`);
        linesParts.push(
          `${esc(mc)}: ${parts.join('; ')} → tổng mét trừ LOT (gộp khổ): <strong>${row.total_roll_strip_m.toFixed(2)} m</strong>`
        );
      });
    return { version: 1, blocks, by_material: byMaterial, lines_html: linesParts.join('<br>') };
  }

  function renderReasonBlock() {
    return `<div class="edit-section" style="border-color:rgba(229,57,53,0.3);background:rgba(229,57,53,0.04)">
      <div class="edit-section-title" style="color:var(--red-light)"><i class="fa-solid fa-pen-to-square"></i> Lý do chỉnh sửa <span style="color:var(--red)">*</span> (khi đổi nguồn / chia nguồn / vật tư)</div>
      <textarea id="wa-alloc-reason" class="field-input" rows="3" style="width:100%;resize:vertical" placeholder="Nhập lý do khi hệ thống yêu cầu."></textarea></div>`;
  }

  function refreshSummary(ctx) {
    const a = readAllocFromDom(ctx);
    const el = document.getElementById('wa-alloc-summary');
    const w = document.getElementById('wa-alloc-warn');
    if (!el) return;
    let html = '';
    let anyBad = false;
    if (isPpfCtx(ctx)) {
      const full = (a.items || []).find((x) => x.item_code === 'FULL_VEHICLE_PPF' && x.is_selected);
      const req = full ? parseFloat(full.required_length_m) || 13 : 13;
      const tot = full ? (full.sources || []).reduce((s, x) => s + (parseFloat(x.allocated_length_m) || 0), 0) : 0;
      const ok = tot + 1e-6 >= req;
      anyBad = !ok;
      html = `Full xe yêu cầu: <strong>${req}m</strong> — Đã phân bổ: <strong>${tot.toFixed(2)}m</strong> — <strong style="color:${ok ? 'var(--teal-light)' : 'var(--amber)'}">${ok ? 'Đủ' : 'Thiếu'}</strong>`;
      if (w) {
        w.style.display = ok ? 'none' : 'block';
        w.textContent = ok ? '' : `PPF Full xe cần ${req}m — nguồn chưa đủ.`;
      }
    } else {
      const sum = computeWfRollCutSummary(a);
      let matBad = false;
      html +=
        '<div style="margin-bottom:10px;padding:10px;background:rgba(0,60,120,0.22);border-radius:8px;font-size:12px;line-height:1.45"><div style="font-weight:700;margin-bottom:6px">Gộp khổ → tổng mét trừ LOT (theo mã vật tư)</div>' +
        (sum.lines_html || '') +
        '<div class="edit-hint" style="margin-top:6px">Tổng mét nhập theo từng hạng mục cùng mã vật tư phải ≥ tổng mét gộp khổ ở trên.</div></div>';
      const by = sum.by_material || {};
      Object.keys(by)
        .sort()
        .forEach((mc) => {
          const need = parseFloat(by[mc].total_roll_strip_m) || 0;
          let got = 0;
          (a.items || []).forEach((it) => {
            if (!it.is_selected || String(it.material_code || '').trim().toUpperCase() !== mc) return;
            (it.sources || []).forEach((s) => {
              got += parseFloat(s.allocated_length_m) || 0;
            });
          });
          const ok = need <= 1e-9 || got + 1e-6 >= need;
          if (!ok) matBad = true;
          const label = need <= 1e-9 ? '—' : ok ? 'Đủ' : 'Thiếu';
          const col = need <= 1e-9 ? 'var(--text-secondary)' : ok ? 'var(--teal-light)' : 'var(--amber)';
          html += `${esc(mc)}: gộp khổ cần <strong>${need.toFixed(2)}m</strong> — đã phân <strong>${got.toFixed(2)}m</strong> — <span style="color:${col}">${label}</span><br>`;
        });
      if (w) {
        w.style.display = matBad ? 'block' : 'none';
        w.textContent = matBad ? 'Tổng mét theo mã vật tư chưa đạt mức gộp khổ cần trừ LOT.' : '';
      }
    }
    el.innerHTML = html;
  }

  function wire(ctx) {
    const body = document.getElementById('ws-edit-body');
    body.querySelectorAll('[data-wa-pick-ppf]').forEach((el) => {
      el.onclick = () => {
        const v = el.getAttribute('data-wa-pick-ppf');
        document.getElementById('wa-ppf-type').value = v;
        body.querySelectorAll('[data-wa-pick-ppf]').forEach((x) => x.classList.remove('selected'));
        el.classList.add('selected');
        window._wsEditDirty = true;
        const a = readAllocFromDom(ctx);
        ctx.alloc = a;
        ctx.alloc.ppf_type = v;
        body.innerHTML = (isPpfCtx(ctx) ? renderPpfBody(ctx) : renderWfBody(ctx)) + renderReasonBlock();
        wire(ctx);
        refreshSummary(ctx);
      };
    });
    body.querySelectorAll('input,select,textarea').forEach((el) => {
      if (el.id === 'wa-alloc-reason') return;
      el.addEventListener('change', () => {
        window._wsEditDirty = true;
        if (el.classList.contains('wa-src-type')) {
          const ctx0 = window.__waEditorCtx;
          const rowPpf = el.closest('tr[data-wa-src-item]');
          const trWf = el.closest('tr[data-wa-item]');
          const row = isPpfCtx(ctx0) ? rowPpf : trWf;
          const code = row ? row.getAttribute(isPpfCtx(ctx0) ? 'data-wa-src-item' : 'data-wa-item') : '';
          const line = el.closest('.wa-src-line');
          const j = parseInt((line && line.getAttribute('data-wa-src-idx')) || row?.getAttribute('data-wa-src-idx') || '0', 10);
          const st = (el.value || 'LOT').toUpperCase();
          if (isPpfCtx(ctx0)) {
            const mat = document.getElementById('wa-ppf-type').value;
            const selRow = rowPpf && rowPpf.querySelector('.wa-src-id');
            if (selRow) selRow.innerHTML = sourceOptionsMat(mat, st, ctx0.lots, ctx0.offcuts, '');
            refreshSummary(ctx0);
            return;
          }
          const mat =
            (document.getElementById(`wa_mat_${code}`)?.value || '').trim() ||
            (ctx0.alloc.items.find((x) => x.item_code === code) || {}).material_code ||
            '';
          const it = ctx0.alloc.items.find((x) => x.item_code === code);
          const minL = it ? parseFloat(it.required_length_m) || 0 : 0;
          const minW = it && it.required_width_cm ? parseFloat(it.required_width_cm) / 100 : 0;
          const k = `${code}:${j}:${st}`;
          loadWfActiveOptions(ctx0.ws.request_id, mat, st, minL, minW).then((items) => {
            ctx0.wfRowOpts = ctx0.wfRowOpts || {};
            ctx0.wfRowOpts[k] = items;
            const sel = line && line.querySelector('.wa-src-id');
            if (sel) sel.innerHTML = wfOptsHtml(st, items, '');
            refreshSummary(ctx0);
          });
          refreshSummary(ctx0);
          return;
        }
        refreshSummary(ctx);
      });
      el.addEventListener('input', () => {
        window._wsEditDirty = true;
        refreshSummary(ctx);
      });
    });
    body.querySelectorAll('[id^="wa_sel_"]').forEach((bx) => {
      if (bx.disabled) return;
      bx.addEventListener('change', () => {
        window._wsEditDirty = true;
        const a = readAllocFromDom(ctx);
        for (const x of a.items || []) {
          const elx = document.getElementById(`wa_sel_${x.item_code}`);
          if (!isPpfCtx(ctx) && elx && !elx.disabled) {
            if (elx.checked) {
              if (!x.quantity || parseInt(x.quantity, 10) < 1) x.quantity = 1;
            } else x.quantity = 0;
          }
        }
        ctx.alloc = a;
        const afterChk = () => {
          body.innerHTML = (isPpfCtx(ctx) ? renderPpfBody(ctx) : renderWfBody(ctx)) + renderReasonBlock();
          wire(ctx);
          refreshSummary(ctx);
        };
        if (!isPpfCtx(ctx)) {
          ctx.wfRowOpts = {};
          prefetchWfSourceDropdowns(ctx).then(afterChk);
        } else {
          afterChk();
        }
      });
    });
    body.onclick = (e) => {
      const add = e.target.closest('[data-wa-add-src]');
      if (add) {
        const code = add.getAttribute('data-wa-add-src');
        const a = readAllocFromDom(ctx);
        const it = a.items.find((x) => x.item_code === code);
        if (it && it.is_selected) {
          if (!it.sources) it.sources = [];
          it.sources.push({ source_type: 'LOT', source_id: '', allocated_length_m: 0, note: '' });
        }
        ctx.alloc = a;
        const rerender = () => {
          body.innerHTML = (isPpfCtx(ctx) ? renderPpfBody(ctx) : renderWfBody(ctx)) + renderReasonBlock();
          wire(ctx);
          refreshSummary(ctx);
          window._wsEditDirty = true;
        };
        if (!isPpfCtx(ctx)) {
          ctx.wfRowOpts = {};
          prefetchWfSourceDropdowns(ctx).then(rerender);
        } else {
          rerender();
        }
        return;
      }
      const del = e.target.closest('.wa-del-src');
      if (del && !del.disabled) {
        const ctx0 = window.__waEditorCtx;
        const rowPpf = del.closest('tr[data-wa-src-item]');
        const stackWf = del.closest('.wa-src-stack');
        const code = isPpfCtx(ctx0)
          ? rowPpf?.getAttribute('data-wa-src-item')
          : stackWf?.getAttribute('data-wa-src-item');
        const line = del.closest('.wa-src-line');
        const idx = parseInt(line?.getAttribute('data-wa-src-idx') || rowPpf?.getAttribute('data-wa-src-idx') || '0', 10);
        const a = readAllocFromDom(ctx);
        const it = a.items.find((x) => x.item_code === code);
        if (it && it.sources && it.sources.length > idx && it.sources.length > 1) it.sources.splice(idx, 1);
        ctx.alloc = a;
        const rerenderDel = () => {
          body.innerHTML = (isPpfCtx(ctx) ? renderPpfBody(ctx) : renderWfBody(ctx)) + renderReasonBlock();
          wire(ctx);
          refreshSummary(ctx);
          window._wsEditDirty = true;
        };
        if (!isPpfCtx(ctx)) {
          ctx.wfRowOpts = {};
          prefetchWfSourceDropdowns(ctx).then(rerenderDel);
        } else {
          rerenderDel();
        }
        return;
      }
      if (e.target.closest('[data-wa-reset]')) {
        fetch(`/api/workstreams/${ctx.wsId}`)
          .then((r) => r.json())
          .then(async (ws2) => {
            const alloc = JSON.parse(
              JSON.stringify(ws2.workstream_type === 'PPF_INSTALLATION' ? ws2.ppf_allocation || {} : ws2.wf_allocation || {})
            );
            if (ws2.workstream_type === 'PPF_INSTALLATION') autoSecondLot(alloc, ctx.lots);
            ctx.alloc = alloc;
            ctx.ws = ws2;
            if (ws2.workstream_type !== 'PPF_INSTALLATION') {
              ctx.wfRowOpts = {};
              const { req, normRes } = await enrichWfAllocationFromNorm(ws2, ctx.alloc);
              ctx.normMeta = normRes || {};
              const rmy = req.model_year;
              ctx.normYearDraft =
                rmy != null && rmy !== '' && !Number.isNaN(Number(rmy)) ? String(Number(rmy)) : '';
              await prefetchWfSourceDropdowns(ctx);
            }
            body.innerHTML = (isPpfCtx(ctx) ? renderPpfBody(ctx) : renderWfBody(ctx)) + renderReasonBlock();
            wire(ctx);
            refreshSummary(ctx);
            window._wsEditDirty = true;
          });
      }
    };
    const applyNormBtn = document.getElementById('wa-apply-norm-year');
    if (applyNormBtn && !isPpfCtx(ctx)) {
      applyNormBtn.onclick = async () => {
        window._wsEditDirty = true;
        const yEl = document.getElementById('wa-norm-model-year');
        const rawY = yEl && yEl.value != null ? String(yEl.value).trim() : '';
        const yr = rawY === '' ? NaN : parseInt(rawY, 10);
        const a = readAllocFromDom(ctx);
        ctx.alloc = a;
        ctx.normYearDraft = rawY;
        ctx.wfRowOpts = {};
        const { normRes } = await enrichWfAllocationFromNorm(
          ctx.ws,
          ctx.alloc,
          Number.isFinite(yr) ? yr : null,
          { forceRefreshNormDims: true }
        );
        ctx.normMeta = normRes || {};
        await prefetchWfSourceDropdowns(ctx);
        body.innerHTML = renderWfBody(ctx) + renderReasonBlock();
        wire(ctx);
        refreshSummary(ctx);
      };
    }
  }

  async function saveAllocation() {
    const ctx = window.__waEditorCtx;
    if (!ctx) return;
    const payload = readAllocFromDom(ctx);
    payload.workstream_type = ctx.ws.workstream_type;
    payload.change_reason = document.getElementById('wa-alloc-reason')?.value?.trim() || '';
    payload.actor = 'QL-002';
    payload.technician_team = document.getElementById('wa-edit-team')?.value;
    payload.assigned_technician_name = document.getElementById('wa-edit-tech')?.value;
    if (isPpfCtx(ctx)) {
      payload.ppf_type = payload.ppf_type || ctx.ws.selected_material_code;
      payload.required_total_length_m = parseFloat(document.getElementById('wa-ppf-req-total')?.value) || 13;
      const full = (payload.items || []).find((x) => x.item_code === 'FULL_VEHICLE_PPF' && x.is_selected);
      const req = full ? parseFloat(full.required_length_m) || 13 : 13;
      const tot = full ? (full.sources || []).reduce((s, x) => s + (parseFloat(x.allocated_length_m) || 0), 0) : 0;
      if (tot + 1e-6 < req) {
        if (typeof toast === 'function') toast('warning', 'PPF', `Full xe cần ${req}m.`);
        return;
      }
    } else {
      const sum = computeWfRollCutSummary(payload);
      const by = sum.by_material || {};
      for (const mc of Object.keys(by).sort()) {
        const need = parseFloat(by[mc].total_roll_strip_m) || 0;
        if (need <= 1e-9) continue;
        let got = 0;
        (payload.items || []).forEach((it) => {
          if (!it.is_selected || String(it.material_code || '').trim().toUpperCase() !== mc) return;
          (it.sources || []).forEach((s) => {
            got += parseFloat(s.allocated_length_m) || 0;
          });
        });
        if (got + 1e-6 < need) {
          if (typeof toast === 'function') toast('warning', 'WF', `${mc}: tổng mét nguồn ${got.toFixed(2)}m < gộp khổ cần ${need.toFixed(2)}m.`);
          return;
        }
      }
    }
    try {
      const res = await fetch(`/api/workstreams/${ctx.wsId}/allocation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data.detail;
        const msg = typeof d === 'object' && d && d.message ? d.message : JSON.stringify(data);
        throw new Error(msg);
      }
      if (typeof toast === 'function') toast('success', 'Phân bổ', 'Đã lưu.');
      window._wsEditDirty = false;
      window._wsEditModePpf = false;
      if (typeof window.closeWsEdit === 'function') window.closeWsEdit();
      if (typeof taiDonThiCong === 'function') await taiDonThiCong();
      if (typeof taiBangLuong === 'function') await taiBangLuong();
    } catch (err) {
      if (typeof toast === 'function') toast('error', 'Lỗi lưu', err.message || String(err));
    }
  }

  window.openWorkstreamAllocationModal = async function (wsId, ws, lots, offcuts) {
    const isPpf = ws.workstream_type === 'PPF_INSTALLATION';
    const raw = isPpf ? ws.ppf_allocation : ws.wf_allocation;
    const alloc = JSON.parse(JSON.stringify(raw || { items: [] }));
    if (!alloc.items || !alloc.items.length) {
      if (typeof toast === 'function') toast('error', 'Allocation', 'Thiếu dữ liệu allocation từ server.');
      return;
    }
    if (isPpf) autoSecondLot(alloc, lots);
    window.__waEditorCtx = { wsId, ws, lots, offcuts, alloc, wfRowOpts: {}, normMeta: {}, normYearDraft: '' };
    if (!isPpf) {
      const { req, normRes } = await enrichWfAllocationFromNorm(ws, alloc);
      window.__waEditorCtx.normMeta = normRes || {};
      const rmy = req.model_year;
      window.__waEditorCtx.normYearDraft =
        rmy != null && rmy !== '' && !Number.isNaN(Number(rmy)) ? String(Number(rmy)) : '';
      await prefetchWfSourceDropdowns(window.__waEditorCtx);
    }
    document.getElementById('ws-edit-title').textContent = isPpf
      ? 'Chỉnh sửa vật tư PPF trước duyệt'
      : 'Chỉnh sửa vật tư Phim cách nhiệt trước duyệt';
    document.getElementById('ws-edit-subtitle').textContent = `${wsId} | Đơn: ${ws.request_id} | ${typeof TRANG_THAI_VI !== 'undefined' ? TRANG_THAI_VI[ws.status] || ws.status : ws.status}`;
    const inner = document.querySelector('.ws-edit-modal-inner');
    if (inner) inner.style.maxWidth = '1080px';
    const body = document.getElementById('ws-edit-body');
    body.innerHTML = (isPpf ? renderPpfBody(window.__waEditorCtx) : renderWfBody(window.__waEditorCtx)) + renderReasonBlock();
    wire(window.__waEditorCtx);
    refreshSummary(window.__waEditorCtx);
    document.getElementById('btn-ws-edit-save').onclick = () => saveAllocation();
    document.getElementById('ws-edit-modal').style.display = 'flex';
  };

  window.openPpfPreflightEditor = window.openWorkstreamAllocationModal;
})();
