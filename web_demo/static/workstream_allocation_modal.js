/**
 * Modal chung: chỉnh sửa phân bổ LOT/OFFCUT — PPF + Phim cách nhiệt (PUT /api/workstreams/{id}/allocation).
 */
(function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  /** Copy hộp hướng dẫn WF — khớp với tiêu đề modal theo trạng thái luồng. */
  function wfGuideCopy(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING_TECH_PREFLIGHT') {
      return {
        title: 'Chỉnh phân bổ — giai đoạn trước chốt (KTV)',
        hint:
          'Luồng đã qua <strong>duyệt mã phim</strong>; tại đây chọn LOT/mảnh dư và số <strong>cm lấy</strong> từng nguồn. Lưu = ghi <code>/allocation</code>.',
      };
    }
    if (s === 'APPROVED' || s === 'ASSIGNED_TO_TECHNICIAN') {
      return {
        title: 'Chỉnh phân bổ — sau phê duyệt luồng',
        hint:
          'Luồng <strong>đã phê duyệt</strong>; có thể chỉnh LOT/cm lấy cho tới khi hoàn tất thi công và đóng luồng (trừ khi đã trừ kho). Mọi thay đổi cần <strong>lý do</strong> (kiểm toán). API: <code>/allocation</code>.',
      };
    }
    if (s === 'IN_PROGRESS' || s === 'ACTUAL_CONFIRMATION_REQUIRED' || s === 'PARTIALLY_COMPLETED') {
      return {
        title: 'Chỉnh phân bổ — đang / sau thi công',
        hint:
          'Luồng <strong>đang thi công</strong> (hoặc chờ xác nhận thực tế); vẫn chỉnh được phân bổ LOT như lần duyệt trước — sửa trực tiếp trên bảng, nhập <strong>lý do</strong> khi có thay đổi. Sau khi hệ thống <strong>đã trừ kho</strong> thì không còn sửa allocation tại đây.',
      };
    }
    return {
      title: 'Chỉnh phân bổ phim cách nhiệt',
      hint:
        'Bảng theo từng hạng mục kính; mỗi hàng có thể có nhiều nguồn LOT/mảnh dư. API: <code>/allocation</code>.',
    };
  }

  /** Copy hộp hướng dẫn PPF theo trạng thái. */
  function ppfGuideCopy(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING_APPROVAL') {
      return {
        title: 'Chỉnh vật tư PPF — trước phê duyệt Quản lý',
        hint: 'Mặc định Full xe. Có thể chia nhiều LOT/OFFCUT. API: <code>/allocation</code>',
      };
    }
    return {
      title: 'Chỉnh phân bổ PPF',
      hint: 'Điều chỉnh nguồn và chiều dài lấy; thay đổi cần <strong>lý do</strong> (kiểm toán). API: <code>/allocation</code>',
    };
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

  /** Đồng bộ ROLL_WIDTH_FULL_CM=150 trong wf_allocation_service: tận khổ → mét chạy cuộn. */
  function wfRollStripM(w_cm, l_cm) {
    const w = parseFloat(w_cm) || 0;
    const l = parseFloat(l_cm) || 0;
    if (w <= 0 || l <= 0) return 0;
    const lo = w <= l ? w : l;
    const hi = w <= l ? l : w;
    return hi >= 150 ? lo / 100 : hi / 100;
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
        const wcmF = parseFloat(it.required_width_cm) || 0;
        const lcmF = parseFloat(it.required_length_cm) || 0;
        if (wcmF > 0 && lcmF > 0) {
          it.required_length_m = Math.round(wfRollStripM(wcmF, lcmF) * qtz * 10000) / 10000;
        } else if (lcmF > 0) {
          it.required_length_m = Math.round((lcmF / 100) * qtz * 10000) / 10000;
        }
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
      if (isPpfCtx(ctx)) {
        if (rq != null && String(rq).trim() !== '') {
          const v = parseFloat(rq);
          if (Number.isFinite(v)) it.required_length_m = v / 100;
        }
      } else {
        it.required_length_m = rq === '' || rq == null ? it.required_length_m || 0 : parseFloat(rq) / 100;
      }
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
            const lenCm = parseFloat(line.querySelector('.wa-src-len')?.value || '0') || 0;
            const note = (line.querySelector('.wa-src-note')?.value || '').trim();
            if (sid && lenCm > 0) it.sources.push({ source_type: stype, source_id: sid, allocated_length_m: lenCm / 100, note });
          });
        }
      } else {
        document.querySelectorAll(`tr[data-wa-src-item="${it.item_code}"]`).forEach((row) => {
          const stype = (row.querySelector('.wa-src-type')?.value || 'LOT').toUpperCase();
          const sid = (row.querySelector('.wa-src-id')?.value || '').trim();
          const lenCm = parseFloat(row.querySelector('.wa-src-len')?.value || '0') || 0;
          const note = (row.querySelector('.wa-src-note')?.value || '').trim();
          if (sid && lenCm > 0) it.sources.push({ source_type: stype, source_id: sid, allocated_length_m: lenCm / 100, note });
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
        <td style="padding:6px"><input type="number" class="field-input" style="width:56px" id="wa_qty_${it.item_code}" min="0" value="${it.quantity || 0}" placeholder="vd: 1" title="Số lượng hạng mục"></td>
        <td style="padding:6px"><input type="text" class="field-input" style="width:88px" id="wa_block_${it.item_code}" value="${esc(it.planned_cut_block || '')}" placeholder="vd: 152×1300" title="Khổ cắt dự kiến (cm)"></td>
        <td style="padding:6px"><input type="number" class="field-input" style="width:80px" id="wa_reqm_${it.item_code}" step="1" min="0" value="${it.required_length_m != null && Number(it.required_length_m) > 0 ? Math.round(Number(it.required_length_m) * 100) : ''}" placeholder="vd: 1300" title="Chiều dài phim cần cho hạng mục (cm); Full xe thường = chiều dài khổ (vd 1300)"></td>
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
              <input type="number" class="field-input wa-src-len" step="1" min="0" value="${src.allocated_length_m != null && Number(src.allocated_length_m) > 0 ? Math.round(src.allocated_length_m * 100) : ''}" placeholder="Số cm lấy" title="Chiều dài lấy từ LOT/mảnh dư (cm)">
              <input type="text" class="field-input wa-src-note" placeholder="vd: cắt đầu cuộn, ghép nguồn…" value="${esc(src.note || '')}" title="Ghi chú nguồn (không bắt buộc)">
              <button type="button" class="btn btn-outline btn-sm wa-del-src"${srcs.length < 2 ? ' disabled' : ''}>✕</button>
            </div></td></tr>`;
      });
      rows += `<tr><td colspan="10" style="padding:4px 6px">
        <button type="button" class="btn btn-outline btn-sm" data-wa-add-src="${it.item_code}">+ Thêm nguồn</button>
        <button type="button" class="btn btn-outline btn-sm" data-wa-reset style="margin-left:8px">Reset</button></td></tr>`;
    }
    const pg = ppfGuideCopy(ws.status);
    return `
      <div class="edit-guide-box"><i class="fa-solid fa-circle-info" style="color:var(--red)"></i><div>
        <strong style="color:var(--red)">${esc(pg.title)}</strong>
        <p class="edit-hint" style="margin:4px 0 0">${pg.hint}</p></div></div>
      <div class="edit-section"><div class="edit-section-title"><i class="fa-solid fa-film" style="color:var(--red)"></i> Loại PPF</div>
        <div class="mat-selector">${['T-TYPE', 'M-TYPE'].map((pid) => {
          const lab = pid === 'T-TYPE' ? 'T-TYPE — PPF trong' : 'M-TYPE — PPF mờ';
          return `<div class="mat-option ${pt === pid ? 'selected' : ''}" data-wa-pick-ppf="${pid}"><div class="mat-option-title">${lab}</div></div>`;
        }).join('')}</div>
        <input type="hidden" id="wa-ppf-type" value="${esc(pt)}"></div>
      <div class="edit-section"><div class="edit-section-title"><i class="fa-solid fa-table" style="color:var(--red)"></i> Bảng hạng mục &amp; nguồn</div>
        <div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:12px"><thead><tr style="text-align:left;background:rgba(255,255,255,0.05)">
          <th style="padding:6px">Chọn</th><th>Hạng mục</th><th>SL</th><th>Kích thước (cm)</th><th>Chiều dài yêu cầu (cm)</th>
          <th>Loại nguồn</th><th>Mã cuộn/mảnh dư</th><th>Lấy từ nguồn (cm)</th><th>Ghi chú</th><th></th>
        </tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="edit-section" id="wa-summary-box"><div class="edit-section-title"><i class="fa-solid fa-scale-balanced" style="color:var(--teal-light)"></i> Kiểm tra (Full xe)</div>
        <div id="wa-alloc-summary"></div><div id="wa-alloc-warn" style="display:none;margin-top:8px;padding:8px;border-radius:8px;background:rgba(255,152,0,0.12);color:var(--amber);font-size:12px;font-weight:600"></div></div>
      <input type="hidden" id="wa-ppf-req-total" value="${alloc.required_total_length_m != null ? alloc.required_total_length_m : 13}">
      ${teamBlock(ctx)}`;
  }

  function teamBlock(ctx) {
    const ws = ctx.ws || {};
    const isPpf = ws.workstream_type === 'PPF_INSTALLATION';
    const tgtType = isPpf ? 'PPF' : 'Phim cách nhiệt';
    
    let defaultTeam = ws.technician_team || '';
    let defaultTechName = ws.assigned_technician_name || '';
    
    const availTeams = (ctx.hrTeams || []).filter(t => t.team_type === tgtType || !t.team_type);
    if (!defaultTeam && availTeams.length > 0) {
      defaultTeam = availTeams[0].team_name;
    }
    
    let teamOpts = '<option value="">-- Chọn Đội --</option>';
    if (availTeams.length > 0) {
      availTeams.forEach(t => {
        const sel = t.team_name === defaultTeam ? 'selected' : '';
        teamOpts += `<option value="${esc(t.team_name)}" data-id="${t.team_id}" ${sel}>${esc(t.team_name)}</option>`;
      });
    } else {
      teamOpts += `<option value="${esc(defaultTeam)}" selected>${esc(defaultTeam)}</option>`;
    }

    let availTechs = [];
    const selT = availTeams.find(t => t.team_name === defaultTeam);
    if (selT && selT.members) {
      availTechs = selT.members;
    }
    if (!defaultTechName && availTechs.length > 0) {
      const leader = availTechs.find(m => m.role === 'LEADER') || availTechs[0];
      if (leader) defaultTechName = leader.full_name;
    }
    
    let techOpts = '<option value="">-- Chọn KTV --</option>';
    if (availTechs.length > 0) {
      availTechs.forEach(m => {
        const sel = m.full_name === defaultTechName ? 'selected' : '';
        techOpts += `<option value="${esc(m.full_name)}" data-id="${m.staff_id}" ${sel}>${esc(m.full_name)}</option>`;
      });
    } else {
      techOpts += `<option value="${esc(defaultTechName)}" selected>${esc(defaultTechName)}</option>`;
    }

    return `<div class="edit-section"><div class="edit-section-title"><i class="fa-solid fa-users"></i> Đội KTV</div>
      <div class="form-grid" style="gap:12px"><div class="field-group"><label>Tên Đội</label>
        <select id="wa-edit-team" class="field-input">${teamOpts}</select></div>
      <div class="field-group"><label>KTV</label><select id="wa-edit-tech" class="field-input">${techOpts}</select></div></div></div>`;
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
          <select class="field-input wa-src-id" style="min-width:140px;flex:1">${opts}</select>
          <input type="number" class="field-input wa-src-len" step="1" min="0" value="${src.allocated_length_m != null && Number(src.allocated_length_m) > 0 ? Math.round(src.allocated_length_m * 100) : ''}" placeholder="Số cm lấy" title="Chiều dài lấy từ nguồn (cm)" style="width:52px">
          <input type="text" class="field-input wa-src-note" placeholder="Ghi chú nguồn…" value="${esc(src.note || '')}" style="width:64px" title="Ghi chú (không bắt buộc)">
          <button type="button" class="btn btn-outline btn-sm wa-del-src"${srcs.length < 2 ? ' disabled' : ''}>✕</button>
        </div>`;
      })
      .join('');
  }

  function renderWfBody(ctx) {
    const { alloc, lots, offcuts, ws } = ctx;

    // --- RECALCULATE required_length_m ---
    const items = (alloc.items || []).filter(x => x && x.item_code);
    const byCode = {};
    items.forEach(x => byCode[x.item_code] = x);

    items.forEach(it => {
      const w = parseFloat(it.required_width_cm) || 0;
      const l = parseFloat(it.required_length_cm) || 0;
      if (w > 0 && l > 0) {
        it.required_length_m = Math.round(Math.min(w, l)) / 100;
      }
    });

    const r = byCode.REAR_WINDOW;
    const f = byCode.FRONT_SIDE;
    if (r && f && r.is_selected && f.is_selected) {
      const mcR = String(r.material_code || '').trim().toUpperCase();
      const mcF = String(f.material_code || '').trim().toUpperCase();
      if (mcR && mcR === mcF) {
        const rw = parseFloat(r.required_width_cm) || 0;
        const rl = parseFloat(r.required_length_cm) || 0;
        const fw = parseFloat(f.required_width_cm) || 0;
        const fl = parseFloat(f.required_length_cm) || 0;
        if (rw > 0 && rl > 0 && fw > 0 && fl > 0 && Math.abs(rl - fl) <= 1 && (rw + fw) <= 152) {
          const commonL = Math.max(rl, fl) / 100;
          r.required_length_m = Math.round((commonL / 2) * 100) / 100;
          f.required_length_m = commonL - r.required_length_m;
        }
      }
    }
    // -------------------------------------

    const rowOpts = ctx.wfRowOpts || {};
    const nm = ctx.normMeta || {};
    const nid = (nm.norm_id && String(nm.norm_id)) || '';
    const strat = (nm.resolution_strategy && String(nm.resolution_strategy)) || '';
    const draftRaw = ctx.normYearDraft != null && ctx.normYearDraft !== '' ? String(ctx.normYearDraft) : '';
    const hint =
      nid || strat
        ? `Đề xuất: <code>${esc(nid || '—')}</code>${strat ? ` — <span style="opacity:0.9">${esc(strat)}</span>` : ''}`
        : 'Chưa khớp định mức — chỉnh năm model và bấm <strong>Áp dụng định mức</strong>, hoặc nhập tay trên phiếu / bảng.';
    const wg = ctx.extraCutMode
      ? {
          title: 'Đăng ký cắt bổ sung — Phim cách nhiệt',
          hint:
            'Tick <strong>chỉ</strong> hạng mục bị hỏng cần cắt lại; chọn nguồn LOT/mảnh dư và mét lấy — cùng quy tắc <strong>gộp khổ</strong> như phân bổ. Hệ thống kiểm tra tổng mét <strong>cộng phân bổ ban đầu</strong> không vượt tồn kho.',
        }
      : wfGuideCopy(ws.status);
    const normSection =
      ctx.extraCutMode
        ? ''
        : `<div class="edit-section" style="padding-bottom:4px">
        <div class="edit-section-title"><i class="fa-solid fa-calendar-days" style="color:var(--blue-light)"></i> Năm model &amp; định mức đề xuất</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-top:8px">
          <div class="field-group" style="margin:0;min-width:140px"><label style="font-size:11px">Năm model (phiếu YC + chỉnh tay)</label>
            <input type="number" class="field-input" id="wa-norm-model-year" min="1985" max="2035" step="1" placeholder="VD: 2022" value="${esc(draftRaw)}">
          </div>
          <button type="button" class="btn btn-sm" id="wa-apply-norm-year">Áp dụng định mức</button>
          <div class="edit-hint" id="wa-norm-resolve-hint" style="margin:0;flex:1;min-width:200px">${hint}</div>
        </div>
      </div>`;
    const tableTitle = ctx.extraCutMode ? 'Bảng hạng mục &amp; nguồn cắt bổ sung' : 'Bảng hạng mục &amp; nguồn';
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
        <td style="padding:6px;vertical-align:top"><input type="number" class="field-input" style="width:68px" id="wa_lcm_${it.item_code}" step="0.1" value="${it.required_length_cm != null ? it.required_length_cm : ''}"></td>
        <td style="padding:6px;vertical-align:top"><input type="number" class="field-input" style="width:72px" id="wa_reqm_${it.item_code}" step="1" value="${it.required_length_m != null ? Math.round(it.required_length_m * 100) : ''}" title="Mét chạy cuộn 152cm (hiển thị cm): thường = min(rộng, dài) kính; có thể khác khi gộp khổ kính hậu + sườn trước (cùng mã phim)."></td>
        <td colspan="4" style="padding:6px;vertical-align:top;background:rgba(0,30,80,0.12)"><div class="wa-src-stack" data-wa-src-item="${it.item_code}">${stackInner}</div></td>
        <td style="padding:6px;vertical-align:top;white-space:nowrap">
          <button type="button" class="btn btn-outline btn-sm" data-wa-add-src="${it.item_code}"${it.is_selected ? '' : ' disabled'}>+ Nguồn</button>
          <button type="button" class="btn btn-outline btn-sm" data-wa-reset style="margin-left:6px">Reset</button>
        </td></tr>`;
    }
    return `
      <div class="edit-guide-box"><i class="fa-solid fa-circle-info" style="color:var(--blue-light)"></i><div>
        <strong style="color:var(--blue-light)">${esc(wg.title)}</strong>
        <p class="edit-hint" style="margin:4px 0 0">${wg.hint}</p></div></div>
      ${normSection}
      <div class="edit-section"><div class="edit-section-title"><i class="fa-solid fa-table" style="color:var(--blue-light)"></i> ${tableTitle}</div>
        <p class="edit-hint muted" style="font-size:10px;margin:0 0 8px;line-height:1.45">Cột <strong>Chạy cuộn (cm)</strong> là chiều dài cắt dọc cuộn phim (quy đổi cm), dùng khớp tổng mét LOT — không nhất thiết bằng một cạnh của <em>Size</em> khi có <strong>gộp khổ</strong> (vd. kính hậu + sườn trước cùng mã phim).</p>
        <div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:12px"><thead><tr style="text-align:left;background:rgba(255,255,255,0.05)">
          <th>Chọn</th><th>Hạng mục</th><th>Mã vật tư</th><th>SL</th><th>Size</th><th>Rộng cm</th><th>Dài cm</th><th title="Mét chạy cuộn 152cm (cm). Thường min(rộng,dài); có thể chia đôi khi gộp khổ hậu + sườn trước.">Chạy cuộn (cm)</th>
          <th colspan="4">Nguồn (LOT / mảnh dư)</th><th></th>
        </tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="edit-section" id="wa-summary-box"><div class="edit-section-title"><i class="fa-solid fa-scale-balanced" style="color:var(--teal-light)"></i> Kiểm tra từng hạng mục</div>
        <div id="wa-alloc-summary"></div><div id="wa-alloc-warn" style="display:none;margin-top:8px;padding:8px;border-radius:8px;background:rgba(255,152,0,0.12);color:var(--amber);font-size:12px;font-weight:600"></div></div>
      ${teamBlock(ctx)}`;
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
      const strip = wfRollStripM(w_cm, l_cm);
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
        const cmRun = Math.round(row.total_roll_strip_m * 100);
        linesParts.push(
          `${esc(mc)}: ${parts.join('; ')} → tổng mét trừ LOT (gộp khổ): <strong>${row.total_roll_strip_m.toFixed(2)} m</strong> (${cmRun} cm chạy cuộn)`
        );
      });
    return { version: 1, blocks, by_material: byMaterial, lines_html: linesParts.join('<br>') };
  }

  function renderReasonBlock() {
    const ec = window.__waEditorCtx && window.__waEditorCtx.extraCutMode;
    return `<div class="edit-section" style="border-color:rgba(229,57,53,0.3);background:rgba(229,57,53,0.04)">
      <div class="edit-section-title" style="color:var(--red-light)"><i class="fa-solid fa-pen-to-square"></i> ${
        ec ? 'Lý do phát sinh cắt thêm' : 'Lý do chỉnh sửa'
      } <span style="color:var(--red)">*</span>${
        ec
          ? ' <span style="font-size:11px;font-weight:500;opacity:0.9">(tối thiểu 5 ký tự)</span>'
          : ' <span style="font-size:11px;font-weight:500;opacity:0.9">(khi đổi nguồn / vật tư)</span>'
      }</div>
      <textarea id="wa-alloc-reason" class="field-input" rows="3" style="width:100%;resize:vertical" placeholder="${
        ec ? 'VD: phim gãy do vận chuyển; dán lỗi phải cắt lại kính hậu…' : 'Nhập lý do khi hệ thống yêu cầu.'
      }"></textarea></div>`;
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
      let matBad = false;
      const byLot = {};
      
      let tableHtml = `<table class="data-table" style="width:100%;font-size:12px;margin-bottom:12px">
        <thead>
          <tr style="text-align:left;background:rgba(255,255,255,0.05)">
            <th>Hạng mục</th>
            <th>Nguồn (LOT/Mảnh)</th>
            <th>Yêu cầu cắt gộp (m)</th>
            <th>Số mét cắt (m)</th>
            <th>Kết quả</th>
          </tr>
        </thead>
        <tbody>`;

      const sum = computeWfRollCutSummary(a);
      (sum.blocks || []).forEach((block) => {
        const reqM = parseFloat(block.roll_strip_m) || 0;
        let gotM = 0;
        let sourcesArr = [];

        (a.items || []).forEach((it) => {
          if (!it.is_selected || !block.item_codes.includes(it.item_code)) return;
          (it.sources || []).forEach((s) => {
            const len = parseFloat(s.allocated_length_m) || 0;
            gotM += len;
            if (len > 0) {
              const sid = (s.source_id || 'Chưa chọn LOT').toUpperCase();
              if (!sourcesArr.includes(sid)) sourcesArr.push(sid);
              if (!byLot[sid]) byLot[sid] = 0;
              byLot[sid] += len;
            }
          });
        });

        const ok = gotM + 1e-6 >= reqM;
        if (!ok && reqM > 0) matBad = true;

        const label = reqM <= 1e-9 ? '—' : ok ? 'Đủ' : 'Thiếu';
        const col = reqM <= 1e-9 ? 'var(--text-secondary)' : ok ? 'var(--teal-light)' : 'var(--amber)';
        const sourcesStr = sourcesArr.length > 0 ? sourcesArr.join(', ') : '—';

        tableHtml += `<tr>
          <td><strong>${esc(block.label)}</strong></td>
          <td>${esc(sourcesStr)}</td>
          <td>${reqM.toFixed(2)}</td>
          <td>${gotM.toFixed(2)}</td>
          <td style="color:${col};font-weight:600">${label}</td>
        </tr>`;
      });
      
      tableHtml += `</tbody></table>`;

      html += tableHtml;
      
      html += '<div style="margin-bottom:10px;padding:10px;background:rgba(0,60,120,0.22);border-radius:8px;font-size:12px;line-height:1.45"><div style="font-weight:700;margin-bottom:6px">Tổng hợp cắt khổ (152cm) theo LOT</div>';
      
      const lotKeys = Object.keys(byLot).sort();
      if (lotKeys.length > 0) {
        lotKeys.forEach(sid => {
          html += `<div style="margin-bottom:4px"><strong>LOT ${esc(sid)}</strong>: Tổng chiều dài cắt là <strong>${byLot[sid].toFixed(2)}m</strong> x 152cm</div>`;
        });
      } else {
        html += `<div>Chưa có dữ liệu phân bổ theo LOT</div>`;
      }
      html += '</div>';

      if (w) {
        w.style.display = matBad ? 'block' : 'none';
        w.textContent = matBad ? 'Vui lòng nhập số mét cắt khớp với Yêu cầu cắt gộp cho mỗi hạng mục.' : '';
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
        if (el.classList.contains('wa-src-id')) {
          const line = el.closest('.wa-src-line');
          const rowPpf = el.closest('tr[data-wa-src-item]');
          const trWf = el.closest('tr[data-wa-item]');
          const lenInput = (line || rowPpf).querySelector('.wa-src-len');
          if (lenInput && (!lenInput.value || parseFloat(lenInput.value) === 0) && el.value.trim() !== '') {
            const ctx0 = window.__waEditorCtx;
            if (isPpfCtx(ctx0)) {
              const reqTotal = document.getElementById('wa-ppf-req-total');
              if (reqTotal) lenInput.value = Math.round(parseFloat(reqTotal.value) * 100);
            } else {
              const code = trWf ? trWf.getAttribute('data-wa-item') : '';
              const reqInput = document.getElementById(`wa_reqm_${code}`);
              if (reqInput && reqInput.value) {
                lenInput.value = reqInput.value;
              }
            }
          }
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
        if (ctx.extraCutMode) {
          if (typeof toast === 'function')
            toast('info', 'Cắt thêm', 'Không reset về phân bổ đã duyệt — đóng modal rồi mở lại để nhập lại từ đầu.');
          return;
        }
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
    if (applyNormBtn && !isPpfCtx(ctx) && !ctx.extraCutMode) {
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

  async function saveExtraCut() {
    const ctx = window.__waEditorCtx;
    if (!ctx || !ctx.extraCutMode) return;
    const reason = document.getElementById('wa-alloc-reason')?.value?.trim() || '';
    if (reason.length < 5) {
      if (typeof toast === 'function') toast('error', 'Lý do', 'Tối thiểu 5 ký tự.');
      return;
    }
    const payload = readAllocFromDom(ctx);
    payload.workstream_type = ctx.ws.workstream_type;
    const selected = (payload.items || []).filter((x) => x.is_selected);
    if (!selected.length) {
      if (typeof toast === 'function') toast('warning', 'Cắt thêm', 'Chọn ít nhất một hạng mục cần cắt bổ sung.');
      return;
    }
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
        if (typeof toast === 'function')
          toast('warning', 'WF', `${mc}: tổng mét nguồn ${got.toFixed(2)}m < gộp khổ cần ${need.toFixed(2)}m.`);
        return;
      }
    }
    try {
      const res = await fetch(`/api/workstreams/${encodeURIComponent(ctx.wsId)}/extra-cut-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          wf_extra_allocation: payload,
          technician_id: (ctx.ws.assigned_technician_id || '').trim() || 'KTV-UNKNOWN',
          technician_name: (ctx.ws.assigned_technician_name || '').trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data.detail;
        const msg = typeof d === 'object' && d && d.message ? d.message : JSON.stringify(data);
        throw new Error(msg);
      }
      if (typeof toast === 'function') toast('success', 'Đã gửi', data.detail || 'Đăng ký cắt thêm đã lưu.');
      window._wsEditDirty = false;
      window.__waEditorCtx.extraCutMode = false;
      if (typeof window.closeWsEdit === 'function') window.closeWsEdit();
      if (typeof taiDonThiCong === 'function') await taiDonThiCong();
      if (typeof taiBangLuong === 'function') await taiBangLuong();
      if (typeof taiThongBao === 'function') taiThongBao();
      if (typeof taiTongQuan === 'function') taiTongQuan();
    } catch (err) {
      if (typeof toast === 'function') toast('error', 'Lỗi gửi', err.message || String(err));
    }
  }

  window.openExtraCutWfModal = async function (wsId) {
    let ws;
    try {
      ws = await fetch(`/api/workstreams/${encodeURIComponent(wsId)}`).then((r) => r.json());
    } catch (e) {
      if (typeof toast === 'function') toast('error', 'Luồng', e.message || String(e));
      return;
    }
    if (ws.workstream_type !== 'WINDOW_FILM_INSTALLATION') {
      if (typeof toast === 'function')
        toast('info', 'Chỉ PCN', 'Bảng phân bổ cắt thêm hiện chỉ áp dụng Phim cách nhiệt.');
      return;
    }
    if (!ws.wf_allocation || !Array.isArray(ws.wf_allocation.items) || !ws.wf_allocation.items.length) {
      if (typeof toast === 'function') toast('error', 'Thiếu phân bổ', 'Luồng chưa có wf_allocation.');
      return;
    }
    const [lots, offcuts] = await Promise.all([
      fetch('/api/lots').then((r) => r.json()),
      fetch('/api/offcuts').then((r) => r.json()),
    ]);
    let alloc;
    if (ws.extra_cut_wf_allocation && Array.isArray(ws.extra_cut_wf_allocation.items)) {
      alloc = JSON.parse(JSON.stringify(ws.extra_cut_wf_allocation));
    } else {
      const base = JSON.parse(JSON.stringify(ws.wf_allocation || { items: [] }));
      const items = (base.items || []).map((it) => ({
        ...it,
        is_selected: false,
        quantity: 0,
        sources: [],
        required_length_m: 0,
      }));
      alloc = { ...base, items, change_reason: '' };
    }
    window.__waEditorCtx = {
      wsId,
      ws,
      lots,
      offcuts,
      alloc,
      wfRowOpts: {},
      normMeta: {},
      normYearDraft: '',
      extraCutMode: true,
    };
    const { normRes } = await enrichWfAllocationFromNorm(ws, window.__waEditorCtx.alloc, null, {
      forceRefreshNormDims: false,
    });
    window.__waEditorCtx.normMeta = normRes || {};
    window.__waEditorCtx.wfRowOpts = {};
    await prefetchWfSourceDropdowns(window.__waEditorCtx);
    document.getElementById('ws-edit-title').textContent = 'Đăng ký cắt thêm — Phim cách nhiệt';
    const sts = typeof TRANG_THAI_VI !== 'undefined' ? TRANG_THAI_VI[ws.status] || ws.status : ws.status;
    const rid = ws.request_id || '';
    const subEl = document.getElementById('ws-edit-subtitle');
    subEl.innerHTML = `${esc(wsId)} | Đơn: <button type="button" class="ws-edit-jump-req" data-request-id=${JSON.stringify(
      rid,
    )} title="Mở tab Đơn thi công">${esc(rid)}</button> | ${esc(sts)}`;
    const inner = document.querySelector('.ws-edit-modal-inner');
    if (inner) inner.style.maxWidth = '1080px';
    const body = document.getElementById('ws-edit-body');
    body.innerHTML = renderWfBody(window.__waEditorCtx) + renderReasonBlock();
    wire(window.__waEditorCtx);
    refreshSummary(window.__waEditorCtx);
    const saveBtn = document.getElementById('btn-ws-edit-save');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi đăng ký cắt thêm';
      saveBtn.onclick = () => saveExtraCut();
    }
    document.getElementById('ws-edit-modal').style.display = 'flex';
    const ta = document.getElementById('wa-alloc-reason');
    if (ta && ws.extra_cut_reason) ta.value = String(ws.extra_cut_reason);
  };

  window.openWorkstreamAllocationModal = async function (wsId, ws, lots, offcuts) {
    const isPpf = ws.workstream_type === 'PPF_INSTALLATION';
    const raw = isPpf ? ws.ppf_allocation : ws.wf_allocation;
    const alloc = JSON.parse(JSON.stringify(raw || { items: [] }));
    if (!alloc.items || !alloc.items.length) {
      if (typeof toast === 'function') toast('error', 'Allocation', 'Thiếu dữ liệu allocation từ server.');
      return;
    }
    if (isPpf) autoSecondLot(alloc, lots);
    window.__waEditorCtx = { wsId, ws, lots, offcuts, alloc, wfRowOpts: {}, normMeta: {}, normYearDraft: '', extraCutMode: false };
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
      : (() => {
          const st = String(ws.status || '').toUpperCase();
          if (st === 'PENDING_TECH_PREFLIGHT') return 'Chỉnh sửa vật tư Phim cách nhiệt — trước chốt phân bổ';
          if (['IN_PROGRESS', 'ACTUAL_CONFIRMATION_REQUIRED', 'PARTIALLY_COMPLETED'].includes(st))
            return 'Chỉnh phân bổ LOT — đang / sau thi công';
          return 'Chỉnh sửa phân bổ LOT — Phim cách nhiệt';
        })();
    const sts = typeof TRANG_THAI_VI !== 'undefined' ? TRANG_THAI_VI[ws.status] || ws.status : ws.status;
    const rid = ws.request_id || '';
    const subEl = document.getElementById('ws-edit-subtitle');
    subEl.innerHTML = `${esc(wsId)} | Đơn: <button type="button" class="ws-edit-jump-req" data-request-id=${JSON.stringify(
      rid,
    )} title="Mở tab Đơn thi công">${esc(rid)}</button> | ${esc(sts)}`;
    const inner = document.querySelector('.ws-edit-modal-inner');
    if (inner) inner.style.maxWidth = '1080px';
    const body = document.getElementById('ws-edit-body');
    body.innerHTML = (isPpf ? renderPpfBody(window.__waEditorCtx) : renderWfBody(window.__waEditorCtx)) + renderReasonBlock();
    wire(window.__waEditorCtx);
    refreshSummary(window.__waEditorCtx);
    const saveBtn0 = document.getElementById('btn-ws-edit-save');
    if (saveBtn0) {
      saveBtn0.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi';
      saveBtn0.onclick = () => saveAllocation();
    }
    document.getElementById('ws-edit-modal').style.display = 'flex';
  };

  window.openPpfPreflightEditor = window.openWorkstreamAllocationModal;

  (function wireJumpReqFromAllocModal() {
    const modal = document.getElementById('ws-edit-modal');
    if (!modal || modal.dataset.wsEditJumpReqWired === '1') return;
    modal.dataset.wsEditJumpReqWired = '1';
    modal.addEventListener('click', (e) => {
      const b = e.target.closest('.ws-edit-jump-req');
      if (!b) return;
      const rid = (b.getAttribute('data-request-id') || '').trim();
      if (!rid) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.closeWsEdit === 'function') window.closeWsEdit();
      if (typeof window.chuyenDenDon === 'function') window.chuyenDenDon(rid);
    });
  })();
})();
