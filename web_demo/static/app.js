/* ================================================================
   DYC Film Warehouse — App JS v3.1 — Thuần Việt + Form chỉnh sửa đầy đủ
   ================================================================ */
'use strict';

(function () {
  const orig = window.fetch;
  window.fetch = function (input, init) {
    const base = { ...(init || {}) };
    if (!base.credentials) base.credentials = 'same-origin';
    return orig.call(this, input, base);
  };
})();

function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Kích thước như file Excel: ưu tiên chuỗi (90x152), không có thì ghép từ cm. */
function _normSizeDisplay(n, sizeKey, wKey, lKey) {
  const raw = String(n[sizeKey] ?? '').trim();
  if (raw && raw !== '0') return _esc(raw);
  const w = parseFloat(n[wKey]) || 0;
  const l = parseFloat(n[lKey]) || 0;
  if (w > 0 && l > 0) {
    const wi = w === Math.floor(w) ? Math.floor(w) : w;
    const li = l === Math.floor(l) ? Math.floor(l) : l;
    return _esc(`${wi}x${li}`);
  }
  return '—';
}

/** Tab Định mức PPF — BODY: kích thước thân xe từ cặp windshield_* (hiển thị cạnh dài × cạnh ngắn, ví dụ 1300x152). */
function _ppfBodyDisplay(n) {
  const w = parseFloat(n.windshield_width_cm) || 0;
  const l = parseFloat(n.windshield_length_cm) || 0;
  if (w > 0 && l > 0) {
    const a = Math.round(Math.max(w, l));
    const b = Math.round(Math.min(w, l));
    return _esc(`${a}x${b}`);
  }
  const raw = String(n.windshield_size ?? '').trim();
  if (raw && raw !== '0') return _esc(raw);
  return '—';
}

function _normFilmTypeIsPpf(ft) {
  const v = String(ft ?? '')
    .trim()
    .toUpperCase();
  return v === 'PPF' || v === 'PHIM PPF' || v.includes('PPF');
}

/** Ẩn/hiện khối kích thước WF vs PPF trong modal định mức. */
function _normSyncNormSizeMode() {
  const ft = (document.getElementById('ed-n-ft')?.value || '').trim();
  const ppf = _normFilmTypeIsPpf(ft);
  const wfBlk = document.getElementById('ed-n-mode-wf');
  const ppfBlk = document.getElementById('ed-n-mode-ppf');
  if (wfBlk) wfBlk.style.display = ppf ? 'none' : '';
  if (ppfBlk) ppfBlk.style.display = ppf ? '' : 'none';
}

/** Master địa bàn: load từ GET /api/location (JSON sinh từ CSV/Excel qua location_master_import). */
window.DYC_LOCATION_MASTER = window.DYC_LOCATION_MASTER || {
  provinces: [],
  wardsByProvince: {},
  loaded: false,
};

function normalizeAddressPart(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function formatStreet(street) {
  const s = normalizeAddressPart(street);
  if (!s) return '';
  const sl = s.toLowerCase();
  const streetPrefixes = ['đường', 'duong', 'quốc lộ', 'ql ', 'ql.', 'tỉnh lộ', 'tl ', 'tl.', 'đại lộ', 'hẻm', 'ngõ', 'ngách', 'kiệt'];
  if (streetPrefixes.some((p) => sl.startsWith(p.toLowerCase()))) return s;
  return `Đường ${s}`;
}

function formatWard(ward) {
  const w = normalizeAddressPart(ward);
  if (!w) return '';
  const wl = w.toLowerCase();
  const wardPrefixes = ['phường', 'xã', 'thị trấn', 'đặc khu'];
  if (wardPrefixes.some((p) => wl.startsWith(p))) return w;
  return `Phường ${w}`;
}

function formatProvince(province) {
  const p = normalizeAddressPart(province);
  if (!p) return '';
  const pl = p.toLowerCase();
  if (['thành phố', 'tp.', 'tp ', 'tỉnh'].some((x) => pl.startsWith(x))) return p;
  return p;
}

/** Đồng bộ với vehicle_norm_logic.build_full_address (Python). */
function buildFullAddress(parts) {
  const no = normalizeAddressPart(parts.addressNo);
  const streetText = formatStreet(parts.street);
  const wardText = formatWard(parts.ward);
  const cityText = formatProvince(parts.city);
  const out = [];
  if (no) out.push(no);
  if (streetText) out.push(streetText);
  if (wardText) out.push(wardText);
  if (cityText) out.push(cityText);
  return out.join(', ');
}

/** Đồng bộ vehicle_norm_logic.normalize_vehicle_model_code (Python). */
window.normalizeVehicleModelCode = function normalizeVehicleModelCode(value) {
  if (value == null) return '';
  let raw = String(value).trim().toUpperCase();
  if (!raw) return '';
  let s = raw.replace(/\s+/g, '_');
  while (s.includes('__')) s = s.replace(/__/g, '_');
  if (s.startsWith('LEXUS_')) s = s.slice(6);
  if (s.includes('_')) {
    const parts = s.split('_').filter(Boolean);
    const hit = parts.find((p) => /^[A-Z]{2,12}\d{2,4}/.test(p));
    s = hit || parts[0] || s;
  }
  const m = s.match(/^([A-Z]{2,12})(\d{2,4})(H|PHEV|HYBRID)?$/);
  if (m) {
    const [, letters, digits, suf] = m;
    if (suf === 'H') return letters + digits;
    return letters + digits;
  }
  const m2 = s.match(/^([A-Z]{2,12})(\d{2,4})$/);
  if (m2) return m2[1] + m2[2];
  return s;
};

async function ensureLocationProvincesLoaded() {
  const st = window.DYC_LOCATION_MASTER;
  if (st.loaded) return;
  try {
    const r = await fetch('/api/location/provinces');
    const j = await r.json();
    st.provinces = Array.isArray(j.items) ? j.items : [];
    st.loaded = true;
  } catch (e) {
    console.warn('[location] provinces', e);
    st.provinces = [];
    st.loaded = true;
  }
  const { dlCity } = _ensureLocationDatalists();
  dlCity.innerHTML = (st.provinces || [])
    .map((c) => `<option value="${String(c).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></option>`)
    .join('');
}

function _ensureLocationDatalists() {
  let dlCity = document.getElementById('dyc-city-datalist');
  if (!dlCity) {
    dlCity = document.createElement('datalist');
    dlCity.id = 'dyc-city-datalist';
    document.body.appendChild(dlCity);
  }
  let dlWard = document.getElementById('dyc-ward-datalist');
  if (!dlWard) {
    dlWard = document.createElement('datalist');
    dlWard.id = 'dyc-ward-datalist';
    document.body.appendChild(dlWard);
  }
  if (window.DYC_LOCATION_MASTER.loaded && window.DYC_LOCATION_MASTER.provinces.length) {
    dlCity.innerHTML = window.DYC_LOCATION_MASTER.provinces
      .map((c) => `<option value="${String(c).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></option>`)
      .join('');
  }
  return { dlCity, dlWard };
}

function _fillWardDatalistForCity(cityVal) {
  const v = String(cityVal || '').trim();
  const { dlWard } = _ensureLocationDatalists();
  if (!v) {
    dlWard.innerHTML = '';
    return Promise.resolve();
  }
  const cache = window.DYC_LOCATION_MASTER.wardsByProvince;
  if (cache[v]) {
    dlWard.innerHTML = cache[v]
      .map((w) => `<option value="${String(w).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></option>`)
      .join('');
    return Promise.resolve();
  }
  return fetch(`/api/location/wards?province=${encodeURIComponent(v)}`)
    .then((r) => r.json())
    .then((j) => {
      const items = (j && j.items) || [];
      const prov = (j && j.province) || v;
      if (items.length) cache[prov] = items;
      dlWard.innerHTML = items
        .map((w) => `<option value="${String(w).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></option>`)
        .join('');
    })
    .catch(() => {
      dlWard.innerHTML = '';
    });
}

/**
 * Gắn gợi ý TP + Phường và auto full_address cho modal đại lý / KH.
 * @param {string} prefix ví dụ 'ed-d' hoặc 'ed-c' → #prefix-ano, #prefix-st, ...
 */
function setupEditorAddress(prefix) {
  _ensureLocationDatalists();
  const ano = document.getElementById(`${prefix}-ano`);
  const street = document.getElementById(`${prefix}-st`);
  const ward = document.getElementById(`${prefix}-ward`);
  const city = document.getElementById(`${prefix}-city`);
  const full = document.getElementById(`${prefix}-full`);
  const rebuild = document.getElementById(`${prefix}-rebuild-full`);
  if (!ano || !full) return;
  const state = { manual: false };
  const recompute = () => {
    if (state.manual) return;
    full.value = buildFullAddress({
      addressNo: ano.value,
      street: street ? street.value : '',
      ward: ward ? ward.value : '',
      city: city ? city.value : '',
    });
  };
  const onPart = () => {
    state.manual = false;
    recompute();
  };
  [ano, street, ward, city].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', () => {
      if (el === city) _fillWardDatalistForCity(el.value);
      onPart();
    });
  });
  full.addEventListener('input', () => {
    state.manual = true;
  });
  rebuild?.addEventListener('click', () => {
    state.manual = false;
    recompute();
  });
  if (city) city.setAttribute('list', 'dyc-city-datalist');
  if (ward) ward.setAttribute('list', 'dyc-ward-datalist');
  _fillWardDatalistForCity(city ? city.value : '');
}

const DYC_MODEL_CODES = ['RX300', 'RX350', 'ES250', 'LM500H', 'CAMRY', 'FORTUNER']; // fallback khi API model-options lỗi
const FILM_TYPE_VI = { WINDOW_FILM: 'Cách nhiệt', PPF: 'PPF', GLASS_FILM: 'Cường lực', OTHER: 'Khác' };
function filmTypeLabel(ft) { const k = (ft || '').trim().toUpperCase(); return FILM_TYPE_VI[k] || ft || '—'; }
const DYC_MODEL_YEAR_OPTS = (() => {
  const a = [];
  for (let y = 2013; y <= 2026; y += 1) a.push(y);
  return a;
})();

function normalizeListResponse(data) {
  if (Array.isArray(data)) return { items: data, total: data.length };
  if (data && typeof data === 'object' && Array.isArray(data.items)) {
    return { items: data.items, total: data.total != null ? data.total : data.items.length };
  }
  return { items: [], total: 0 };
}

function getFilterValue(id) {
  const els = Array.from(document.querySelectorAll('[id="' + id + '"]'));
  if (els.length === 0) return '';
  const visible = els.find(e => e.offsetParent !== null);
  return String((visible || els[0]).value ?? '').trim();
}

function buildQuery(params) {
  const u = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || String(v).trim() === '') return;
    u.append(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function ensureCustFilters() {
  if (typeof window._normsSubtab === 'undefined') {
    window._normsSubtab = 'wf';
  }
  window._custF ||= {
    dealers: { q: '', status: '', dealer_group: '', city: '', ward: '', has_amis_code: '', has_tax_code: '' },
    customers: {
      q: '', status: '', crm_status: '', source_channel: '', source_dealer_id: '', city: '', ward: '', has_phone: '', has_vehicle: '',
    },
    vehicles: {
      q: '', vehicle_model_code: '', model_year: '', dealer_id: '', customer_id: '', vehicle_status: '', has_customer: '', has_active_norm: '',
    },
    norms: {
      q: '', film_type: '', vehicle_model_code: '', model_year: '', status: '', has_windshield: '', has_sunroof: '', has_rear_side_triangle: '',
    },
  };
}

function clearCustomerFilters(scope) {
  ensureCustFilters();
  const blank = {
    dealers: { q: '', status: '', dealer_group: '', city: '', ward: '', has_amis_code: '', has_tax_code: '' },
    customers: {
      q: '', status: '', crm_status: '', source_channel: '', source_dealer_id: '', city: '', ward: '', has_phone: '', has_vehicle: '',
    },
    vehicles: {
      q: '', vehicle_model_code: '', model_year: '', dealer_id: '', customer_id: '', vehicle_status: '', has_customer: '', has_active_norm: '',
    },
    norms: {
      q: '', film_type: '', vehicle_model_code: '', model_year: '', status: '', has_windshield: '', has_sunroof: '', has_rear_side_triangle: '',
    },
  };
  window._custF[scope] = { ...blank[scope] };
}

function applyCustomerFilters(scope) {
  ensureCustFilters();
  const g = (id) => getFilterValue(id);
  if (scope === 'dealers') {
    window._custF.dealers = {
      q: g('flt-d-q'),
      status: g('flt-d-status'),
      dealer_group: g('flt-d-group'),
      city: g('flt-d-city'),
      ward: g('flt-d-ward'),
      has_amis_code: g('flt-d-has-amis'),
      has_tax_code: g('flt-d-has-tax'),
    };
  } else if (scope === 'customers') {
    window._custF.customers = {
      q: g('flt-c-q'),
      status: g('flt-c-status'),
      crm_status: g('flt-c-crm'),
      source_channel: g('flt-c-ch'),
      source_dealer_id: g('flt-c-src-dealer'),
      city: g('flt-c-city'),
      ward: g('flt-c-ward'),
      has_phone: g('flt-c-has-phone'),
      has_vehicle: g('flt-c-has-veh'),
    };
  } else if (scope === 'vehicles') {
    window._custF.vehicles = {
      q: g('flt-v-q'),
      vehicle_model_code: g('flt-v-model'),
      model_year: g('flt-v-year'),
      dealer_id: g('flt-v-dealer'),
      customer_id: g('flt-v-cust'),
      vehicle_status: g('flt-v-vst'),
      has_customer: g('flt-v-has-cust'),
      has_active_norm: g('flt-v-has-norm'),
    };
  } else if (scope === 'norms') {
    window._custF.norms = {
      q: g('flt-n-q'),
      film_type: g('flt-n-film'),
      vehicle_model_code: g('flt-n-model'),
      model_year: g('flt-n-year'),
      status: g('flt-n-status'),
      has_windshield: g('flt-n-ws'),
      has_sunroof: g('flt-n-sun'),
      has_rear_side_triangle: g('flt-n-sst'),
    };
  }
}

function renderFilterChips(containerId, chips, onRemove) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = (chips || [])
    .map(
      (c) =>
        `<span class="filter-chip" data-chip-key="${_esc(c.key)}"><span class="filter-chip-text">${_esc(c.label)}</span><button type="button" class="filter-chip-x" data-chip-key="${_esc(c.key)}" aria-label="Bỏ lọc">×</button></span>`,
    )
    .join('');
  el.querySelectorAll('.filter-chip-x').forEach((btn) => {
    btn.addEventListener('click', () => onRemove(btn.getAttribute('data-chip-key')));
  });
}

async function refreshModelDatalistFromApi() {
  let dl = document.getElementById('dyc-model-datalist');
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = 'dyc-model-datalist';
    document.body.appendChild(dl);
  }
  try {
    const j = await fetch('/api/vehicle-norms/model-options').then((r) => r.json());
    const items = (j.items || []).filter((x) => x != null && String(x).trim() !== '');
    if (items.length) {
      dl.innerHTML = items.map((m) => `<option value="${_esc(String(m))}"></option>`).join('');
      return;
    }
  } catch (e) {
    console.warn('[dyc-model-datalist] GET /api/vehicle-norms/model-options failed, using fallback', e);
  }
  console.warn('[dyc-model-datalist] Using local fallback model list (demo only)');
  dl.innerHTML = DYC_MODEL_CODES.map((m) => `<option value="${_esc(m)}"></option>`).join('');
}

const MC_WF_FILM_TYPE = 'Phim cách nhiệt';

/** Đảm bảo mã từ hồ sơ xe vẫn chọn được khi chưa có trong định mức PCN. */
function _mcEnsureVehicleModelOption(code) {
  const sel = document.getElementById('mc-veh-model');
  if (!sel || sel.tagName !== 'SELECT') return;
  const c = (code || '').trim();
  if (!c) return;
  if ([...sel.options].some((o) => o.value === c)) return;
  const opt = document.createElement('option');
  opt.value = c;
  opt.textContent = `${c} (hồ sơ xe)`;
  sel.appendChild(opt);
}

/** Select «Dòng xe» trên form Tạo đơn: DISTINCT từ định mức phim cách nhiệt. */
async function refreshMcVehicleModelSelectFromApi() {
  const sel = document.getElementById('mc-veh-model');
  if (!sel || sel.tagName !== 'SELECT') return;
  const prev = (sel.value || '').trim();
  const optsBase = '<option value="">— Chọn —</option>';
  try {
    const ps = new URLSearchParams({ source: 'norms', film_type: MC_WF_FILM_TYPE });
    const j = await fetch(`/api/vehicle-norms/model-options?${ps.toString()}`).then((r) => r.json());
    let items = (j.items || []).filter((x) => x != null && String(x).trim() !== '');
    if (!items.length) items = [...DYC_MODEL_CODES];
    sel.innerHTML = optsBase + items.map((m) => `<option value="${_esc(String(m))}">${_esc(String(m))}</option>`).join('');
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
    else if (prev) {
      _mcEnsureVehicleModelOption(prev);
      sel.value = prev;
    }
  } catch (e) {
    console.warn('[mc-veh-model] GET model-options (norms + Phim cách nhiệt) failed', e);
    sel.innerHTML = optsBase + DYC_MODEL_CODES.map((m) => `<option value="${_esc(m)}">${_esc(m)}</option>`).join('');
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }
}

function _ensureModelDatalist() {
  if (!document.getElementById('dyc-model-datalist')) {
    const dl = document.createElement('datalist');
    dl.id = 'dyc-model-datalist';
    document.body.appendChild(dl);
  }
}

function _yearOptionsHtml(selected) {
  return `<option value="">Tất cả</option>${DYC_MODEL_YEAR_OPTS.map((y) => `<option value="${y}"${String(selected) === String(y) ? ' selected' : ''}>${y}</option>`).join('')}`;
}

function _dealerFilterChips(fd, onRemove) {
  const chips = [];
  const L = {
    q: 'Tìm kiếm',
    status: 'TT',
    dealer_group: 'Nhóm',
    city: 'TP',
    ward: 'Phường/Xã',
    has_amis_code: 'AMIS',
    has_tax_code: 'MST',
  };
  Object.entries(fd).forEach(([k, v]) => {
    if (v === '' || v == null) return;
    chips.push({ key: k, label: `${L[k] || k}: ${v}` });
  });
  renderFilterChips('flt-d-chips', chips, onRemove);
}

function _customerFilterChips(fc, onRemove) {
  const chips = [];
  const L = {
    q: 'Tìm kiếm',
    status: 'TT KH',
    crm_status: 'CRM',
    source_channel: 'Nguồn',
    source_dealer_id: 'Đại lý nguồn',
    city: 'TP',
    ward: 'Phường/Xã',
    has_phone: 'SĐT',
    has_vehicle: 'Xe',
  };
  Object.entries(fc).forEach(([k, v]) => {
    if (v === '' || v == null) return;
    chips.push({ key: k, label: `${L[k] || k}: ${v}` });
  });
  renderFilterChips('flt-c-chips', chips, onRemove);
}

function _vehicleFilterChips(fv, onRemove) {
  const chips = [];
  const L = {
    q: 'Tìm kiếm',
    vehicle_model_code: 'Dòng xe',
    model_year: 'Năm',
    dealer_id: 'Đại lý',
    customer_id: 'KH',
    vehicle_status: 'TT xe',
    has_customer: 'KH liên kết',
    has_active_norm: 'Định mức',
  };
  Object.entries(fv).forEach(([k, v]) => {
    if (v === '' || v == null) return;
    chips.push({ key: k, label: `${L[k] || k}: ${v}` });
  });
  renderFilterChips('flt-v-chips', chips, onRemove);
}

function _normFilterChips(fn, onRemove) {
  const chips = [];
  const L = {
    q: 'Tìm kiếm',
    film_type: 'Loại phim',
    vehicle_model_code: 'Dòng xe',
    model_year: 'Năm',
    status: 'TT',
    has_windshield: 'Kính lái',
    has_sunroof: 'Kính trời',
    has_rear_side_triangle: 'Sườn sau+TG',
  };
  Object.entries(fn).forEach(([k, v]) => {
    if (v === '' || v == null) return;
    chips.push({ key: k, label: `${L[k] || k}: ${v}` });
  });
  renderFilterChips('flt-n-chips', chips, onRemove);
}

const __debDealerQ = debounce(() => {
  applyCustomerFilters('dealers');
  taiKhachHang();
}, 300);
const __debCustomerQ = debounce(() => {
  applyCustomerFilters('customers');
  taiKhachHang();
}, 300);
const __debVehicleQ = debounce(() => {
  applyCustomerFilters('vehicles');
  taiKhachHang();
}, 300);
const __debNormQ = debounce(() => {
  applyCustomerFilters('norms');
  if (document.getElementById('tab-norms')?.classList.contains('active')) {
    taiDinhMucPhim();
  } else {
    taiKhachHang();
  }
}, 300);

window._quickFormDirty = false;
const _QUICK_DIRTY_MODES = ['edit-norm', 'create-norm', 'edit-customer', 'edit-dealer'];

function _markQuickDirty() {
  window._quickFormDirty = true;
}

function _tryCloseQuickModal() {
  const ov = document.getElementById('modal-quick-overlay');
  if (ov.style.display !== 'flex') return;
  if (window._quickFormDirty && _QUICK_DIRTY_MODES.includes(window._mcQuickMode)) {
    if (!window.confirm('Bạn có thay đổi chưa lưu. Đóng cửa sổ?')) return;
  }
  _closeQuickModal();
}

let _reasonDialogResolve = null;

/** @returns {Promise<{reason:string,admin_override?:boolean}|null>} */
function openReasonModal(title, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    _reasonDialogResolve = resolve;
    const rov = document.getElementById('modal-reason-overlay');
    document.getElementById('modal-reason-title').textContent = title || 'Nhập lý do';
    const ta = document.getElementById('modal-reason-input');
    ta.value = '';
    document.getElementById('modal-reason-admin-wrap').style.display = opts.showAdminOverride ? 'block' : 'none';
    document.getElementById('modal-reason-admin-ov').checked = false;
    rov.style.display = 'flex';
    rov.setAttribute('aria-hidden', 'false');
    setTimeout(() => ta.focus(), 80);
  });
}

function _finishReasonModal(payload) {
  const rov = document.getElementById('modal-reason-overlay');
  rov.style.display = 'none';
  rov.setAttribute('aria-hidden', 'true');
  const fn = _reasonDialogResolve;
  _reasonDialogResolve = null;
  if (fn) fn(payload);
}

function _wireReasonModalOnce() {
  if (window._reasonModalWired) return;
  window._reasonModalWired = true;
  document.getElementById('modal-reason-ok')?.addEventListener('click', () => {
    const reason = (document.getElementById('modal-reason-input').value || '').trim();
    if (!reason) {
      toast('warning', 'Thiếu lý do', 'Vui lòng nhập lý do trước khi xác nhận.');
      return;
    }
    const admin_override = document.getElementById('modal-reason-admin-ov')?.checked || false;
    _finishReasonModal({ reason, admin_override });
  });
  document.getElementById('modal-reason-cancel')?.addEventListener('click', () => _finishReasonModal(null));
  document.getElementById('btn-x-modal-reason')?.addEventListener('click', () => _finishReasonModal(null));
}

// ─── DANH MỤC THI CÔNG ────────────────────────────────────────────────────────
const HANG_MUC_PPF = [
  { id: 'HOOD',          label: 'Nắp ca-pô' },
  { id: 'FENDERS',       label: 'Vè cánh (4 vè)' },
  { id: 'FRONT_BUMPER',  label: 'Cản trước' },
  { id: 'REAR_BUMPER',   label: 'Cản sau' },
  { id: 'DOORS_ALL',     label: 'Tất cả cánh cửa' },
  { id: 'DOOR_EDGES',    label: 'Cạnh cánh cửa' },
  { id: 'DOOR_HANDLES',  label: 'Tay nắm cửa' },
  { id: 'SIDE_MIRRORS',  label: 'Gương chiếu hậu' },
  { id: 'TRUNK_LID',     label: 'Nắp cốp sau' },
  { id: 'HEADLIGHTS',    label: 'Đèn pha' },
  { id: 'ROOF',          label: 'Mái xe' },
  { id: 'PPF_FULL',      label: 'Toàn bộ xe (Full PPF)' },
  { id: 'PPF_PARTIAL',   label: 'Phần trước xe' },
];

const HANG_MUC_WF = [
  { id: 'WINDSHIELD',         label: 'Kính chắn gió trước (Kính lái)' },
  { id: 'REAR_WINDOW',        label: 'Kính hậu' },
  { id: 'FRONT_SIDE',         label: 'Kính cửa trước (2 cánh)' },
  { id: 'REAR_SIDE_TRIANGLE', label: 'Kính cửa sau + tam giác' },
  { id: 'SUNROOF',            label: 'Cửa sổ trời' },
  { id: 'SIDE_QUARTER',       label: 'Kính tam giác cố định' },
];

const LOAI_PHIM_PPF = [
  { id: 'T-TYPE', label: 'T-TYPE — Trong suốt (tiêu chuẩn)', mota: 'Phim trong, giữ nguyên màu sơn xe. Phổ biến nhất.' },
  { id: 'M-TYPE', label: 'M-TYPE — Mờ (matte)', mota: 'Phim mờ, tạo hiệu ứng đổi màu xe. Cần ghi rõ lý do.' },
];

const LOAI_PHIM_WF = [
  { id: 'JB20', label: 'JB20 — Phim cách nhiệt tiêu chuẩn', mota: 'Dùng cho kính cửa, kính hậu, cửa sổ trời.' },
  { id: 'RT40', label: 'RT40 — Phim cách nhiệt kính lái', mota: 'Bắt buộc dùng cho kính chắn gió trước (đảm bảo tầm nhìn).' },
];

const TRANG_THAI_VI = {
  'DRAFT': 'Tiếp nhận',
  'STANDARDIZED': 'Đã chuẩn hóa',
  'NORM_ASSIGNED': 'Đã tra định mức',
  'ALLOCATED': 'Đã phân bổ vật tư',
  'APPROVED': 'Đã phê duyệt',
  'IN_PROGRESS': 'Đang thi công',
  'PARTIALLY_COMPLETED': 'Hoàn tất một phần',
  'WAITING_INVENTORY_COMMIT': 'Chờ xác nhận kho',
  'CLOSED': 'Đã hoàn tất',
  'EXCEPTION_HOLD': 'Ngoại lệ — Chờ xử lý',
  'NEEDS_REVIEW': 'Cần rà soát / thiếu dữ liệu hoặc kho',
  'PENDING_APPROVAL': 'Chờ phê duyệt',
  'PENDING_TECH_PREFLIGHT': 'KTV chỉnh LOT — chờ chốt phân bổ',
  'PENDING': 'Chờ KTV nhận',
  'COMPLETED_BY_TECHNICIAN': 'KTV đã hoàn tất',
  'ACTUAL_CONFIRMATION_REQUIRED': 'Cần xác nhận thực tế',
  'ACTIVE': 'Đang hoạt động',
  'USED': 'Đã sử dụng',
  'REVIEWING': 'Đang kiểm tra',
  'CONFIRMED': 'Đã xác nhận',
  'CANCELLED': 'Đã hủy',
  'COMPLETED': 'Hoàn tất',
  'NEW': 'Mới',
  'IN_USE': 'Đang dùng',
  'LOCKED': 'Đang khóa',
  'DEPLETED': 'Hết cuộn',
  'CLEARED': 'Đã clear',
  'SCRAPPED': 'Thanh lý',
  'AVAILABLE': 'Khả dụng',
  'RESERVED': 'Giữ chỗ',
  'PARTIALLY_USED': 'Dùng một phần',
  'QUALITY_FAILED': 'Lỗi chất lượng',
  'LOST': 'Mất kiểm kê',
};

const GIAO_DICH_VI = {
  'ISSUE_FROM_LOT': 'Xuất từ cuộn LOT',
  'ISSUE_FROM_OFFCUT': 'Xuất từ mảnh dư',
  'CREATE_OFFCUT': 'Tạo mảnh dư mới',
  'RECORD_SCRAP': 'Ghi nhận phế liệu',
  'RELEASE_LOCK': 'Giải phóng khóa tạm',
  'SOFT_LOCK_RECORDED': 'Ghi nhận khóa tạm (Soft Lock)',
  'WORKSTREAM_APPROVED': 'Phê duyệt luồng thi công',
  'PPF_TYPE_CHANGED': 'Đổi loại phim PPF',
  'WORKSTREAM_SOURCE_CHANGED': 'Đổi nguồn vật tư',
  'WORKSTREAM_EDIT_SELECTED_MATERIAL_CODE': 'Chỉnh sửa loại phim',
  'WORKSTREAM_EDIT_PLANNED_CUT_BLOCK': 'Chỉnh sửa kích thước block',
  'WORKSTREAM_EDIT_PLANNED_DEDUCTION_LENGTH_M': 'Chỉnh sửa chiều dài khấu',
  'EXTRA_CUT_REGISTERED': 'Đăng ký cắt thêm (KTV)',
  'IMPORT_LOT': 'Nhập LOT',
  'LOT_IMPORT_META_CORRECTED': 'Điều chỉnh thông tin nhập LOT',
  'IMPORT_OFFCUT_MANUAL': 'Nhập mảnh dư thủ công',
  'IMPORT_OFFCUT_WORKSTREAM': 'Nhập mảnh dư từ hoàn tất luồng (KTV)',
  'MANUAL_ISSUE_LOT': 'Xuất LOT thủ công',
  'MANUAL_ISSUE_OFFCUT': 'Xuất mảnh dư thủ công',
  'CLEAR_LOT': 'Clear LOT',
  'CLEAR_OFFCUT': 'Clear mảnh dư',
  'RELEASE_LOCK_MANUAL': 'Release lock thủ công',
  'LOT_IMPORTED': 'Nhập LOT (audit)',
  'OFFCUT_IMPORTED_MANUAL': 'Nhập mảnh dư (audit)',
  'OFFCUT_IMPORTED_WORKSTREAM': 'Nhập mảnh dư từ luồng (audit)',
  'LOT_MANUAL_ISSUED': 'Xuất LOT (audit)',
  'OFFCUT_MANUAL_ISSUED': 'Xuất mảnh dư (audit)',
  'LOT_CLEARED': 'Clear LOT (audit)',
  'LOT_IMPORT_META_UPDATED': 'Cập nhật meta nhập LOT (audit)',
  'OFFCUT_CLEARED': 'Clear mảnh dư (audit)',
  'SOFT_LOCK_RELEASED_MANUAL': 'Release lock (audit)',
  'REQUEST_MATERIAL_OVERRIDDEN': 'Đổi mã vật tư (Quản lý)',
  'OCR_DRAFT_CONFIRMED': 'Xác nhận phiếu OCR',
  'REQUEST_CREATED_FROM_IMAGE': 'Tạo đơn từ ảnh OCR',
  'CUSTOMER_CREATED_FROM_OCR': 'Tạo KH từ OCR',
  'VEHICLE_CREATED_FROM_OCR': 'Tạo xe từ OCR',
  'WORKSTREAM_CREATED': 'Tạo luồng thi công',
  'NORM_AUTO_FILLED': 'Tự điền định mức',
  'MATERIAL_PREFERENCE_APPLIED': 'Áp dụng vật tư ưu tiên',
};

// ─── TIỆN ÍCH ────────────────────────────────────────────────────────────────
function toast(type, title, message, duration = 4000) {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i>
    <div class="toast-content"><strong>${title}</strong><span>${message}</span></div>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }, duration);
}

/** Parse JSON an toàn — không gọi .json() trực tiếp khi server có thể trả HTML/text lỗi */
async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.headers || {}) },
  });
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();
  if (res.status === 401 && !String(url).includes('/api/auth/')) {
    try {
      window.dispatchEvent(new CustomEvent('dyc-auth-lost'));
    } catch (_) { /* ignore */ }
  }
  let data = null;
  if (contentType.includes('application/json')) {
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (e) {
      throw new Error(`API trả JSON không hợp lệ từ ${url}: ${rawText.slice(0, 120)}`);
    }
  } else {
    if (!res.ok) {
      throw new Error(`API lỗi ${res.status} từ ${url}: ${rawText.slice(0, 160)}`);
    }
    throw new Error(`API không trả JSON từ ${url}: ${rawText.slice(0, 160)}`);
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.detail)) || `API lỗi ${res.status} từ ${url}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 200));
  }
  return data;
}

/** Phiên đăng nhập (cookie) — role: ADMIN | MANAGER | TECHNICIAN */
window.__DYC_AUTH__ = window.__DYC_AUTH__ || { user: null, permissions: {} };

window.dycCurrentRole = function dycCurrentRole() {
  return String(window.__DYC_AUTH__?.user?.role || '').trim().toUpperCase();
};

/** Quyền từ GET /api/auth/me (permissions). */
window.dycPerm = function dycPerm(key) {
  return !!(window.__DYC_AUTH__?.permissions && window.__DYC_AUTH__.permissions[key]);
};

/** Username đăng nhập (phiên cookie) — dùng mặc định cho form kho / audit hiển thị. */
window.dycSessionUsername = function dycSessionUsername() {
  return String(window.__DYC_AUTH__?.user?.username || '').trim();
};

function applyDycUserChrome() {
  const u = window.__DYC_AUTH__?.user;
  const role = window.dycCurrentRole();
  const av = document.querySelector('.user-info .avatar');
  const lb = document.querySelector('.user-info .user-label');
  let initials = '—';
  if (role === 'ADMIN') initials = 'AD';
  else if (role === 'MANAGER') initials = 'QL';
  else if (role === 'TECHNICIAN') initials = 'KT';
  if (av) av.textContent = initials;
  if (lb) lb.textContent = u?.display_name || u?.username || '—';
  const hitl = document.getElementById('btn-hitl-approve');
  if (hitl) hitl.style.display = window.dycPerm('can_approve_request') ? '' : 'none';
  document.querySelectorAll('[data-dyc-require="hr_write"]').forEach((el) => {
    el.style.display = window.dycPerm('can_hr_write') ? '' : 'none';
  });
  document.querySelectorAll('[data-dyc-require="admin_only"]').forEach((el) => {
    el.style.display = window.dycCurrentRole() === 'ADMIN' ? '' : 'none';
  });
  const fabTg = document.getElementById('dyc-fab-telegram');
  if (fabTg) fabTg.style.display = window.dycCurrentRole() === 'ADMIN' ? 'flex' : 'none';
}

window.ensureDycLoggedIn = async function ensureDycLoggedIn() {
  const me = await fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => r.json());
  if (me.authenticated && me.user) {
    window.__DYC_AUTH__ = { user: me.user, permissions: me.permissions || {} };
    applyDycUserChrome();
    const ov = document.getElementById('login-overlay');
    if (ov) ov.style.display = 'none';
    return true;
  }
  window.__DYC_AUTH__ = { user: null, permissions: {} };
  applyDycUserChrome();
  return false;
};

window.dycFillLogin = function (u, p) {
  const iu = document.getElementById('login-username');
  const ip = document.getElementById('login-password');
  if (iu) iu.value = u || '';
  if (ip) ip.value = p || '';
};

document.addEventListener('dyc-auth-lost', () => {
  window.__DYC_AUTH__ = { user: null, permissions: {} };
  const ov = document.getElementById('login-overlay');
  if (ov) ov.style.display = 'flex';
  applyDycUserChrome();
});

const DASH_KPI_DEFAULTS = {
  total_lots: 0,
  active_offcuts: 0,
  ppf_completed: 0,
  wf_completed: 0,
  pending_approval_workstreams: 0,
  closed_requests: 0,
  total_customers: 0,
  total_dealers: 0,
  total_vehicles: 0,
  manual_requests_today: 0,
  ocr_requests_today: 0,
};

function trangThaiBadge(status) {
  if (!status) return '<span class="status-badge">—</span>';
  const nhan = TRANG_THAI_VI[status] || status;
  return `<span class="status-badge status-${status.toLowerCase().replace(/_/g,'-')}" title="${status}">${nhan}</span>`;
}

function loaiLuongBadge(wsType) {
  if (!wsType) return '';
  if (wsType === 'PPF_INSTALLATION')         return `<span class="status-badge ws-type-ppf">🛡 Dán Phim PPF</span>`;
  if (wsType === 'WINDOW_FILM_INSTALLATION')  return `<span class="status-badge ws-type-wf">🪟 Phim Cách Nhiệt</span>`;
  if (wsType === 'GLASS_FILM_INSTALLATION')   return `<span class="status-badge ws-type-gl">💎 Cường Lực</span>`;
  if (wsType === 'FLOOR_MAT_INSTALLATION')    return `<span class="status-badge ws-type-fm">🏠 Thảm Sàn</span>`;
  return `<span class="status-badge">${wsType}</span>`;
}

/** Nhãn tiếng Việt cho job_item / item_code (WF + PPF) */
const WF_JC_ITEM_VI = {
  WINDSHIELD: 'Kính lái (kính chắn gió trước)',
  REAR_WINDOW: 'Kính sau',
  FRONT_SIDE: 'Kính cửa trước',
  REAR_SIDE_TRIANGLE: 'Kính tam giác / sườn sau',
  TRIANGLE: 'Tam giác',
  REAR_SIDE: 'Sườn sau',
  SUNROOF: 'Cửa sổ trời',
  SIDE_QUARTER: 'Tam giác cố định',
  PPF_FULL: 'PPF — full xe',
  PPF_BODY: 'PPF — thân xe',
  FULL_VEHICLE_PPF: 'PPF — full xe',
  HOOD_PPF: 'PPF — nắp capô',
  FRONT_BUMPER_PPF: 'PPF — cản trước',
  REAR_BUMPER_PPF: 'PPF — cản sau',
  MIRROR_PPF: 'PPF — gương',
  DOOR_HANDLE_PPF: 'PPF — tay nắm cửa',
  DOOR_EDGE_PPF: 'PPF — mép cửa',
  DOOR_JAMB_PPF: 'PPF — hốc cửa',
  LIGHT_CLUSTER_PPF: 'PPF — cụm đèn',
  INTERIOR_SCREEN_PPF: 'PPF — màn hình / nội thất',
  OTHER_PPF: 'PPF — khác',
};

function _wfJobLabelVi(ji) {
  const j = (ji || '').trim();
  if (!j) return '—';
  return WF_JC_ITEM_VI[j] || j;
}

/** Nguồn gợi mã vật tư (định mức / ưu tiên / nhập tay) — hiển thị UI */
function materialSourceVi(src) {
  if (src == null) return '—';
  const k = String(src).trim();
  if (!k || k === '—') return '—';
  const u = k.toUpperCase();
  const map = {
    MATERIAL_PREFERENCE: 'Theo vật tư ưu tiên',
    MATERIAL_PREFERENCE_APPLIED: 'Đã áp vật tư ưu tiên',
    MISSING_PREFERENCE: 'Chưa cấu hình vật tư ưu tiên',
    MANUAL_OVERRIDE: 'Ghi đè thủ công',
    NORM_DEFAULT: 'Theo định mức',
    MANUAL: 'Nhập tay',
    EXCEL_IMPORT: 'Nhập từ Excel',
  };
  return map[u] || k;
}

function wfHangMucDisplayVi(it) {
  if (!it) return '—';
  const code = String(it.item_code || it.job_item || '').trim();
  const nm = (it.item_name || '').trim();
  if (!code) return nm || '—';
  const lab = _wfJobLabelVi(code);
  if (lab !== code) return lab;
  return nm || code;
}

/** Màn hình 1 — duyệt mã phim: đủ hạng mục + checkbox (mặc định tick theo nghiệp vụ). */
const WF_MATERIAL_APPROVE_SCREEN1_JOBS = [
  { job_item: 'WINDSHIELD', label: 'Kính lái', defaultOn: true },
  { job_item: 'REAR_WINDOW', label: 'Kính hậu', defaultOn: true },
  { job_item: 'FRONT_SIDE', label: 'Sườn trước', defaultOn: true },
  { job_item: 'REAR_SIDE_TRIANGLE', label: 'Sườn sau và Tam giác', defaultOn: true },
  { job_item: 'SUNROOF', label: 'Kính trời', defaultOn: true },
  { job_item: 'REAR_SIDE', label: 'Sườn sau', defaultOn: false },
  { job_item: 'TRIANGLE', label: 'Tam giác', defaultOn: false },
];

/** Gợi ý mã hạng mục / vùng thi công cho cấu hình vật tư ưu tiên (ô có datalist, vẫn gõ tay). */
const _MAT_PREF_JOB_ITEM_SUGGESTIONS = [
  ...WF_MATERIAL_APPROVE_SCREEN1_JOBS.map((j) => ({ code: j.job_item, label: j.label })),
  { code: 'SIDE_QUARTER', label: 'Tam giác cố định' },
  { code: 'PPF_BODY', label: 'PPF — vùng thân (cấu hình gộp)' },
  { code: 'PPF_FULL', label: 'PPF — full xe (gom nhanh)' },
  { code: 'FULL_VEHICLE_PPF', label: 'PPF — full xe' },
  { code: 'HOOD_PPF', label: 'PPF — nắp capo' },
  { code: 'FRONT_BUMPER_PPF', label: 'PPF — cản trước' },
  { code: 'REAR_BUMPER_PPF', label: 'PPF — cản sau' },
  { code: 'MIRROR_PPF', label: 'PPF — gương chiếu hậu' },
  { code: 'DOOR_HANDLE_PPF', label: 'PPF — tay nắm cửa' },
  { code: 'DOOR_EDGE_PPF', label: 'PPF — mép cửa' },
  { code: 'DOOR_JAMB_PPF', label: 'PPF — hốc cửa' },
  { code: 'LIGHT_CLUSTER_PPF', label: 'PPF — cụm đèn' },
  { code: 'INTERIOR_SCREEN_PPF', label: 'PPF — màn hình / nội thất' },
  { code: 'OTHER_PPF', label: 'PPF — khác' },
];

function _matPrefJobItemDatalistHtml() {
  const seen = new Set();
  let opts = '';
  for (const it of _MAT_PREF_JOB_ITEM_SUGGESTIONS) {
    const c = String(it.code || '').trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    opts += `<option value="${_esc(c)}">${_esc(c)} — ${_esc(it.label)}</option>`;
  }
  return `<datalist id="mpf-job-datalist">${opts}</datalist>`;
}

/** HTML tổng hợp gộp khổ (roll_cut_summary) từ API wf_allocation */
function wfRollCutSummaryHtml(wfa) {
  if (!wfa || !wfa.roll_cut_summary) return '';
  const rc = wfa.roll_cut_summary;
  if (rc.lines_html) {
    return `<div class="jc-wf-roll-sum" style="margin-top:8px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.04);line-height:1.55"><strong style="color:var(--text-secondary)">Gộp khổ — tiêu hao theo LOT (m):</strong><br>${rc.lines_html}</div>`;
  }
  return '';
}

/** Kích thước kính / block kế hoạch — thống nhất hiển thị kèm cm (mét trên LOT giữ ở cột nguồn). */
function formatWfPlannedSizeCm(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return '—';
  const lower = t.toLowerCase();
  if (lower.includes('cm')) return _esc(t);
  const norm = t.replace(/×/g, 'x');
  const m = norm.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*$/i);
  if (m) return `${_esc(m[1])}×${_esc(m[2])} cm`;
  return `${_esc(t)} cm`;
}

/** Lý do đăng ký cắt bổ sung — chữ to, tương phản rõ. */
function jcExtraCutReasonHtml(reasonText) {
  const t = reasonText != null ? String(reasonText).trim() : '';
  if (!t) return '';
  return `<div class="jc-extra-cut-reason" style="margin-top:10px;padding:12px 14px;border-radius:8px;border-left:4px solid #fbbf24;background:rgba(251,191,36,0.12);font-size:15px;line-height:1.55;color:rgba(255,255,255,0.96);font-weight:500"><strong style="display:block;margin-bottom:6px;font-size:12px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.05em">Lý do</strong>${_esc(t)}</div>`;
}

function jcJobInfoRow(label, valueHtml, full = false) {
  return `<div class="ji-row${full ? ' ji-row-full' : ''}"><span>${label}</span><strong class="jc-info-value">${valueHtml}</strong></div>`;
}

/** Chuẩn hóa về 0h ngày giao (local): hỗ trợ ISO, yyyy-mm-dd, dd/mm/yyyy (chuỗi từ DB / form). */
function parseDeliveryDateStartOfDay(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const y = parseInt(m[3], 10);
    if (mo >= 0 && mo < 12 && d >= 1 && d <= 31 && y > 1900) {
      const dt = new Date(y, mo, d);
      if (!isNaN(dt.getTime()) && dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) return dt;
    }
  }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    if (mo >= 0 && mo < 12 && d >= 1 && d <= 31 && y > 1900) {
      const dt = new Date(y, mo, d);
      if (!isNaN(dt.getTime()) && dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) return dt;
    }
  }

  const t = new Date(s);
  if (!isNaN(t.getTime())) {
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  return null;
}

/** Số ngày từ 0h hôm nay đến 0h ngày hạn giao (theo giờ máy). */
function jcDeliveryRemainHtml(isoStr) {
  const target = parseDeliveryDateStartOfDay(isoStr);
  if (!target) return '—';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  const wrap = (inner) => `<span class="jc-job-deadline">${inner}</span>`;
  if (diff === 0) return wrap('Hôm nay');
  if (diff > 0) return wrap(`${diff} ngày`);
  return wrap(`Trễ ${Math.abs(diff)} ngày`);
}

function _jcWfSourcesCell(it) {
  const parts = [];
  (it.sources || []).forEach((s) => {
    const al = parseFloat(s.allocated_length_m) || 0;
    if (al <= 0) return;
    const st = (s.source_type || 'LOT').toUpperCase();
    const sid = (s.source_id || '').trim() || '—';
    const stLab = st === 'LOT' ? 'Cuộn LOT' : st === 'OFFCUT' ? 'Mảnh dư' : st;
    parts.push(`${stLab} <code>${_esc(sid)}</code>: <strong>${al.toFixed(2)} m</strong>`);
  });
  return parts.length ? parts.join('<br>') : '—';
}

function jcWfPhanBoBangHtml(title, wfa) {
  if (!wfa || !Array.isArray(wfa.items)) return '';
  const rows = wfa.items.filter((i) => i && i.is_selected);
  if (!rows.length) return '';
  const body = rows
    .map((it) => {
      const name = wfHangMucDisplayVi(it);
      return `<tr><td>${_esc(name)}</td><td><code>${_esc(String(it.material_code || '').trim())}</code></td><td>${formatWfPlannedSizeCm(it.planned_size)}</td><td style="text-align:left">${_jcWfSourcesCell(it)}</td></tr>`;
    })
    .join('');
  return `<div class="jc-wf-pb-block" style="margin-top:10px;padding:10px;border-radius:8px;border:1px solid var(--border);background:rgba(0,0,0,0.12)">
    <div class="jc-wf-subhead">${title}</div>
    <table class="data-table jc-wf-flow-table" style="width:100%"><thead><tr><th>Hạng mục</th><th>Mã vật tư</th><th>Kích thước (cm)</th><th>Nguồn cắt (m)</th></tr></thead><tbody>${body}</tbody></table>
    ${wfRollCutSummaryHtml(wfa)}</div>`;
}

function jcWfTongHopNguonHtml(baseWf, extraWfOrList) {
  const agg = {};
  function add(items) {
    if (!Array.isArray(items)) return;
    items.forEach((it) => {
      if (!it || !it.is_selected) return;
      (it.sources || []).forEach((s) => {
        const al = parseFloat(s.allocated_length_m) || 0;
        if (al <= 0) return;
        const st = (s.source_type || 'LOT').toUpperCase();
        const sid = (s.source_id || '').trim();
        const k = `${st}|${sid}`;
        if (!agg[k]) agg[k] = { st, sid, m: 0 };
        agg[k].m += al;
      });
    });
  }
  add((baseWf && baseWf.items) || []);
  const extras = Array.isArray(extraWfOrList)
    ? extraWfOrList
    : extraWfOrList && Array.isArray(extraWfOrList.items)
      ? [extraWfOrList]
      : [];
  for (const ex of extras) add((ex && ex.items) || []);
  const keys = Object.keys(agg).sort();
  if (!keys.length) return '';
  const rows = keys
    .map((k) => {
      const o = agg[k];
      const lab = o.st === 'OFFCUT' ? 'Mảnh dư' : 'LOT cuộn';
      return `<tr><td>${lab}</td><td><code>${_esc(o.sid)}</code></td><td><strong>${o.m.toFixed(2)} m</strong></td></tr>`;
    })
    .join('');
  return `<div class="jc-wf-tonghop-block" style="margin-top:10px;padding:10px;border-radius:8px;border:1px solid rgba(45,212,191,0.35);background:rgba(45,212,191,0.06)">
    <div class="jc-wf-teal-head"><i class="fa-solid fa-calculator"></i> Tổng hợp tiêu hao nguồn (ban đầu + bổ sung)</div>
    <table class="data-table jc-wf-flow-table" style="width:100%"><thead><tr><th>Loại</th><th>Mã nguồn</th><th>Tổng (m) LOT</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Các snapshot wf_allocation từ lịch sử cắt bổ sung (tránh đếm trùng khi API đã có extra_cut_history). */
function collectExtraCutWfAllocations(ws) {
  const hist = Array.isArray(ws.extra_cut_history) ? ws.extra_cut_history : [];
  if (hist.length) {
    return hist.map((e) => e && e.wf_allocation).filter((a) => a && Array.isArray(a.items));
  }
  if (ws.extra_cut_wf_allocation && Array.isArray(ws.extra_cut_wf_allocation.items)) return [ws.extra_cut_wf_allocation];
  return [];
}

function sumAllExtraCutRequiredLengthM(ws) {
  let s = 0;
  for (const a of collectExtraCutWfAllocations(ws)) s += sumWfSelectedRequiredLengthM(a);
  return s;
}

/** Tổng required_length_m các hạng mục được chọn — WF: ghi nhận mét phim khi không nhập tay ở modal hoàn tất. */
function sumWfSelectedRequiredLengthM(alloc) {
  if (!alloc || !Array.isArray(alloc.items)) return 0;
  let s = 0;
  for (const it of alloc.items) {
    if (it && it.is_selected) s += parseFloat(it.required_length_m) || 0;
  }
  return Math.round(s * 1000) / 1000;
}

/**
 * Bảng Kiểm tra từng hạng mục + tổng LOT (WF) — dùng cho phân bổ chính và cắt bổ sung.
 * @returns {string} HTML (rỗng nếu không có roll_cut_summary.blocks)
 */
function jcWfKiemTraTungHangMucCardSection(wfa, sectionOpts) {
  if (!wfa) return '';
  const blocks = wfa.roll_cut_summary ? wfa.roll_cut_summary.blocks || [] : [];
  if (!Array.isArray(blocks) || !blocks.length) return '';
  const title = (sectionOpts && sectionOpts.title) || 'Kiểm tra từng hạng mục';
  const icon = (sectionOpts && sectionOpts.icon) || 'fa-scale-balanced';
  const iconColor = (sectionOpts && sectionOpts.iconColor) || 'var(--teal-light)';

  const sel = (wfa.items || []).filter((x) => x && x.is_selected);
  let nsrc = 0;
  let hasOff = false;
  for (const it of sel) {
    nsrc += (it.sources || []).filter((s) => (s.source_id || '').trim()).length;
    if ((it.sources || []).some((s) => (s.source_type || '').toUpperCase() === 'OFFCUT')) hasOff = true;
  }
  const splitBadge =
    nsrc > sel.length && sel.length
      ? ' <span class="jc-wf-badge jc-wf-badge-split">Chia nguồn</span>'
      : '';
  const offBadge = hasOff
    ? ' <span class="jc-wf-badge jc-wf-badge-off">Dùng mảnh dư</span>'
    : '';

  let tableHtml = `<table class="data-table jc-wf-flow-table" style="width:100%;margin-bottom:12px">
        <thead>
          <tr style="text-align:left;background:rgba(255,255,255,0.05)">
            <th style="padding:8px">Hạng mục</th>
            <th style="padding:8px">Nguồn (LOT / mảnh)</th>
            <th style="padding:8px">Yêu cầu cắt gộp (m)</th>
            <th style="padding:8px">Số mét cắt (m)</th>
            <th style="padding:8px">Kết quả</th>
          </tr>
        </thead>
        <tbody>`;

  const byLot = {};
  blocks.forEach((block) => {
    const reqM = parseFloat(block.roll_strip_m) || 0;
    let gotM = 0;
    const sourcesArr = [];

    (wfa.items || []).forEach((it) => {
      if (!it.is_selected || !(block.item_codes || []).includes(it.item_code)) return;
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
    const label = reqM <= 1e-9 ? '—' : ok ? 'Đủ' : 'Thiếu';
    const col = reqM <= 1e-9 ? 'var(--text-secondary)' : ok ? 'var(--teal-light)' : 'var(--amber)';
    const sourcesStr = sourcesArr.length > 0 ? sourcesArr.join(', ') : '—';

    tableHtml += `<tr>
          <td style="padding:8px"><strong>${_esc(block.label)}</strong></td>
          <td style="padding:8px">${_esc(sourcesStr)}</td>
          <td style="padding:8px">${reqM.toFixed(2)}</td>
          <td style="padding:8px">${gotM.toFixed(2)}</td>
          <td style="padding:8px;color:${col};font-weight:600">${label}</td>
        </tr>`;
  });
  tableHtml += `</tbody></table>`;

  let summaryHtml =
    '<div class="jc-wf-rollup-summary" style="margin-bottom:10px;padding:10px;background:rgba(0,60,120,0.22);border-radius:8px;line-height:1.45"><div style="font-weight:700;margin-bottom:6px">Tổng hợp cắt khổ (152cm) theo LOT</div>';
  const lotKeys = Object.keys(byLot).sort();
  if (lotKeys.length > 0) {
    lotKeys.forEach((sid) => {
      summaryHtml += `<div style="margin-bottom:4px">LOT <strong>${_esc(sid)}</strong>: Tổng chiều dài cắt là <strong>${byLot[sid].toFixed(2)}m</strong> x 152cm</div>`;
    });
  } else {
    summaryHtml += `<div>Chưa có dữ liệu phân bổ theo LOT</div>`;
  }
  summaryHtml += '</div>';

  return `<div class="ws-info-row jc-wf-inspect-section" style="display:block; width:100%;">
        <span class="ws-label jc-wf-inspect-label" style="display:inline-block; margin-bottom:10px;"><i class="fa-solid ${icon}" style="color:${iconColor}; margin-right:4px;"></i> ${title}${splitBadge}${offBadge}</span>
        <div style="margin-top:6px">${tableHtml}${summaryHtml}</div>
      </div>`;
}

function fmtDt(isoStr) {
  if (!isoStr) return '—';
  try { 
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }); 
  }
  catch { return isoStr; }
}

const charts = {};
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

// ─── THÔNG BÁO ───────────────────────────────────────────────────────────────
let notifOpen = false;

async function taiThongBao() {
  try {
    const notifs = await fetch('/api/notifications').then(r => r.json());
    const chuaDoc = notifs.filter(n => !n.is_read).length;
    const badge = document.getElementById('notif-badge');
    badge.textContent = chuaDoc;
    badge.style.display = chuaDoc > 0 ? 'flex' : 'none';

    const typeIcons = {
      APPROVAL_NEEDED: 'fa-user-check', JOB_ASSIGNED: 'fa-screwdriver-wrench',
      JOB_STARTED: 'fa-wrench', JOB_COMPLETED: 'fa-flag-checkered',
      PPF_JOB_ASSIGNED: 'fa-shield-film', WF_JOB_ASSIGNED: 'fa-window-restore',
      PPF_TEAM_STARTED: 'fa-play', WF_TEAM_STARTED: 'fa-play',
      PPF_TEAM_COMPLETED: 'fa-check-circle', WF_TEAM_COMPLETED: 'fa-check-circle',
      VEHICLE_PARTIALLY_COMPLETED: 'fa-circle-half-stroke',
      VEHICLE_FULLY_COMPLETED: 'fa-car-side', EXCEPTION: 'fa-triangle-exclamation', INFO: 'fa-circle-info'
    };
    const list = document.getElementById('notif-list');
    if (notifs.length === 0) { list.innerHTML = '<p class="text-center muted pad-20" style="font-size:12px">Không có thông báo nào.</p>'; return; }
    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="danhDauDocThongBao('${n.notif_id}',this)">
        <div class="notif-title"><i class="fa-solid ${typeIcons[n.notif_type] || 'fa-bell'}" style="margin-right:6px"></i>${n.title || ''}</div>
        ${n.workstream_type ? `<div style="margin:3px 0">${loaiLuongBadge(n.workstream_type)}</div>` : ''}
        <div class="notif-body">${n.body || ''}</div>
        <div class="notif-time">${fmtDt(n.created_at)}</div>
      </div>`).join('');
  } catch(e) { console.error('Lỗi tải thông báo:', e); }
}

window.danhDauDocThongBao = async function(id, el) {
  await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  el.classList.remove('unread');
  taiThongBao();
  fillDefaultDateTimes();
};

document.getElementById('btn-notif-bell').addEventListener('click', () => {
  const drawer = document.getElementById('notif-drawer');
  const overlay = document.getElementById('notif-overlay');
  notifOpen = !notifOpen;
  drawer.classList.toggle('open', notifOpen);
  overlay.style.display = notifOpen ? 'block' : 'none';
  if (notifOpen) taiThongBao();
});
document.getElementById('notif-overlay').addEventListener('click', () => {
  document.getElementById('notif-drawer').classList.remove('open');
  document.getElementById('notif-overlay').style.display = 'none';
  notifOpen = false;
});
document.getElementById('btn-read-all').addEventListener('click', async () => {
  await fetch('/api/notifications/read-all', { method: 'POST' });
  taiThongBao();
  toast('info', 'Đã đọc hết', 'Tất cả thông báo đã được đánh dấu là đã đọc.');
});

// ═══ TẠO ĐƠN THỦ CÔNG + KHÁCH HÀNG ═══════════════════════════════════════════
let _mcQuickMode = null;

async function taiTaoDonTay() {
  try {
    const [dRes, cRes, vRes] = await Promise.all([
      fetch('/api/dealers').then(r => r.json()),
      fetch('/api/end-customers').then(r => r.json()),
      fetch('/api/vehicles').then(r => r.json()),
    ]);
    const dealers = normalizeListResponse(dRes).items;
    const custs = normalizeListResponse(cRes).items;
    const vehs = normalizeListResponse(vRes).items;
    const sd = document.getElementById('mc-dealer-select');
    const sc = document.getElementById('mc-cust-select');
    const sv = document.getElementById('mc-veh-select');
    const curD = sd.value, curC = sc.value, curV = sv.value;
    sd.innerHTML = '<option value="">— Chọn —</option>' + dealers.map(d => `<option value="${d.dealer_id}">${d.dealer_id} — ${d.dealer_name}</option>`).join('');
    sc.innerHTML = '<option value="">— Chọn —</option>' + custs.map(c => `<option value="${c.customer_id}">${c.customer_id} — ${c.customer_masked || c.customer_name}</option>`).join('');
    sv.innerHTML = '<option value="">— Chọn —</option>' + vehs.map(v => `<option value="${v.vehicle_id}">${v.vehicle_id} — ${v.vehicle_model_code}</option>`).join('');
    if ([...sd.options].some(o => o.value === curD)) sd.value = curD;
    if ([...sc.options].some(o => o.value === curC)) sc.value = curC;
    if ([...sv.options].some(o => o.value === curV)) sv.value = curV;
  } catch (e) { toast('error', 'Lỗi tải danh mục', e.message); }
  await refreshMcVehicleModelSelectFromApi();
  await mcPreviewNorm();
  _mcUpdateTeamVisibility();
  const curDealer = document.getElementById('mc-dealer-select')?.value || '';
  await _mcRefreshSeqForDealer(curDealer);
}

function _mcIsoDelivery() {
  const d = document.getElementById('mc-deliv-date').value;
  const t = document.getElementById('mc-deliv-time')?.value || '17:30';
  if (!d) return '';
  return `${d}T${t}:00+07:00`;
}

async function taiKhachHang() {
  const sub = document.querySelector('.cust-sub.active')?.dataset.csub || 'dealers';
  ensureCustFilters();
  await ensureLocationProvincesLoaded();
  _ensureLocationDatalists();
  _ensureModelDatalist();
  await refreshModelDatalistFromApi();
  await refreshMcVehicleModelSelectFromApi();
  let dlGrp = document.getElementById('dyc-dealer-group-datalist');
  if (!dlGrp) {
    dlGrp = document.createElement('datalist');
    dlGrp.id = 'dyc-dealer-group-datalist';
    dlGrp.innerHTML = ['Lexus', 'Toyota', 'BMW', 'Mercedes', 'Direct Retail']
      .map((g) => `<option value="${_esc(g)}"></option>`)
      .join('');
    document.body.appendChild(dlGrp);
  }
  try {
    const sum = await fetch('/api/customers/summary').then((r) => r.json());
    if (sub === 'dealers') {
      const fd = window._custF.dealers;
      const qd = { ...fd, with_meta: '1' };
      const dJson = await fetch(`/api/dealers${buildQuery(qd)}`).then((r) => r.json());
      const { items: rows, total: dTotal } = normalizeListResponse(dJson);
      const st = fd.status;
      document.getElementById('cust-pane-dealers').innerHTML = `
        <div class="kpi-grid kpi-grid-compact" style="margin-bottom:12px">
          <div class="kpi-card" data-color="blue"><div class="kpi-val">${sum.total_dealers}</div><div class="kpi-label">Tổng đại lý</div></div>
          <div class="kpi-card" data-color="green"><div class="kpi-val">${sum.active_dealers}</div><div class="kpi-label">Active</div></div>
        </div>
        <div class="cust-filter-bar">
          <div class="cust-filter-title">Bộ lọc đại lý</div>
          <div class="cust-filter-grid">
            <div class="dyc-field dyc-field-span2"><label>Tìm kiếm</label>
              <input id="flt-d-q" placeholder="Tìm theo tên đại lý, mã AMIS, MST, SĐT, địa chỉ..." value="${_esc(fd.q)}" autocomplete="off" /></div>
            <div class="dyc-field"><label>Trạng thái</label>
              <select id="flt-d-status">
                <option value=""${st === '' ? ' selected' : ''}>Tất cả</option>
                <option value="ACTIVE"${st === 'ACTIVE' ? ' selected' : ''}>ACTIVE</option>
                <option value="INACTIVE"${st === 'INACTIVE' ? ' selected' : ''}>INACTIVE</option>
                <option value="PENDING_REVIEW"${st === 'PENDING_REVIEW' ? ' selected' : ''}>PENDING_REVIEW</option>
              </select></div>
            <div class="dyc-field"><label>Nhóm đại lý</label>
              <input id="flt-d-group" list="dyc-dealer-group-datalist" placeholder="Chọn hoặc gõ..." value="${_esc(fd.dealer_group)}" autocomplete="off" /></div>
            <div class="dyc-field"><label>Thành phố</label>
              <input id="flt-d-city" list="dyc-city-datalist" value="${_esc(fd.city)}" autocomplete="off" /></div>
            <div class="dyc-field"><label>Phường / Xã</label>
              <input id="flt-d-ward" list="dyc-ward-datalist" value="${_esc(fd.ward)}" autocomplete="off" /></div>
            <div class="dyc-field"><label>Có mã AMIS</label>
              <select id="flt-d-has-amis">
                <option value=""${fd.has_amis_code === '' ? ' selected' : ''}>Tất cả</option>
                <option value="true"${fd.has_amis_code === 'true' ? ' selected' : ''}>Có mã AMIS</option>
                <option value="false"${fd.has_amis_code === 'false' ? ' selected' : ''}>Chưa có mã AMIS</option>
              </select></div>
            <div class="dyc-field"><label>Có MST</label>
              <select id="flt-d-has-tax">
                <option value=""${fd.has_tax_code === '' ? ' selected' : ''}>Tất cả</option>
                <option value="true"${fd.has_tax_code === 'true' ? ' selected' : ''}>Có MST</option>
                <option value="false"${fd.has_tax_code === 'false' ? ' selected' : ''}>Chưa có MST</option>
              </select></div>
          </div>
          <div class="cust-filter-actions">
            <button type="button" class="btn btn-outline btn-sm" data-flt-act="dealers-refresh">Làm mới</button>
            <button type="button" class="btn btn-outline btn-sm" data-flt-act="dealers-create">Tạo đại lý</button>
          </div>
          <div class="cust-filter-meta"><span id="flt-d-total-label">Tổng số kết quả sau lọc: <strong id="flt-d-total">${dTotal}</strong></span></div>
          <div class="filter-chips-row" id="flt-d-chips"></div>
        </div>
        <div class="table-wrap" style="overflow-x:auto"><table class="data-table" style="font-size:11px"><thead><tr>
          <th>Loại KH</th><th>Tên khách hàng</th><th>Mã đơn</th><th>MST</th><th>SĐT</th><th>Địa chỉ</th><th>Đường</th><th>Phường</th><th>TP</th><th>Full</th><th>AMIS</th><th>TT</th><th></th>
        </tr></thead><tbody>
        ${rows.map(d => `<tr>
          <td>${_esc(d.customer_category)}</td>
          <td><strong>${_esc(d.dealer_id)}</strong><br/>${_esc(d.customer_name || d.dealer_name)}</td>
          <td><span style="font-weight:600;color:${d.dealer_code ? '#1a6fc4' : '#bbb'}">${_esc(d.dealer_code) || '—'}</span></td>
          <td>${_esc(d.tax_code)}</td><td>${_esc(d.phone)}</td>
          <td>${_esc(d.address_no)}</td><td>${_esc(d.street)}</td><td>${_esc(d.ward)}</td><td>${_esc(d.city)}</td>
          <td style="max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${_esc(d.full_address)}">${_esc(d.full_address)}</td>
          <td>${_esc(d.amis_customer_code)}</td><td>${_esc(d.status)}</td>
          <td style="white-space:nowrap">
            <button type="button" class="btn btn-outline btn-sm" onclick="moDrawerDealer('${d.dealer_id}')">Lịch sử</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="moFormDealer('${d.dealer_id}')">Sửa</button>
            ${d.status === 'ACTIVE'
              ? `<button type="button" class="btn btn-outline btn-sm" onclick="moToggleDealer('${d.dealer_id}','deactivate')">Inactive</button>`
              : `<button type="button" class="btn btn-outline btn-sm" onclick="moToggleDealer('${d.dealer_id}','activate')">Active</button>`}
          </td></tr>`).join('')}
        </tbody></table></div>`;
      _fillWardDatalistForCity(fd.city);
      _dealerFilterChips(fd, (key) => {
        window._custF.dealers[key] = '';
        taiKhachHang();
      });
    } else if (sub === 'customers') {
      const fc = window._custF.customers;
      const [custJson, dealerPick] = await Promise.all([
        fetch(`/api/end-customers${buildQuery({ ...fc, with_meta: '1' })}`).then((r) => r.json()),
        fetch('/api/dealers').then((r) => r.json()),
      ]);
      const { items: rows, total: cTotal } = normalizeListResponse(custJson);
      const dealerOpts = normalizeListResponse(dealerPick).items;
      const st = fc.status;
      const crm = fc.crm_status;
      const ch = fc.source_channel;
      document.getElementById('cust-pane-customers').innerHTML = `
        <div class="kpi-grid kpi-grid-compact" style="margin-bottom:12px">
          <div class="kpi-card" data-color="blue"><div class="kpi-val">${sum.total_end_customers}</div><div class="kpi-label">Tổng KH</div></div>
          <div class="kpi-card" data-color="teal"><div class="kpi-val">${sum.verified_customers}</div><div class="kpi-label">Đã xác thực</div></div>
          <div class="kpi-card" data-color="orange"><div class="kpi-val">${sum.pending_customers}</div><div class="kpi-label">Chờ duyệt</div></div>
          <div class="kpi-card" data-color="red"><div class="kpi-val">${sum.duplicate_review_count}</div><div class="kpi-label">Trùng lặp</div></div>
        </div>
        <div class="cust-filter-bar">
          <div class="cust-filter-title">Bộ lọc khách hàng lẻ</div>
          <div class="cust-filter-grid">
            <div class="dyc-field dyc-field-span2"><label>Tìm kiếm</label>
              <input id="flt-c-q" placeholder="Tìm theo tên KH, SĐT, địa chỉ, mã AMIS, đại lý nguồn..." value="${_esc(fc.q)}" autocomplete="off" /></div>
            <div class="dyc-field"><label>Trạng thái KH</label>
              <select id="flt-c-status">
                <option value=""${st === '' ? ' selected' : ''}>Tất cả</option>
                <option value="ACTIVE"${st === 'ACTIVE' ? ' selected' : ''}>Hoạt động</option>
                <option value="INACTIVE"${st === 'INACTIVE' ? ' selected' : ''}>Ngừng hoạt động</option>
              </select></div>
            <div class="dyc-field"><label>Trạng thái CRM</label>
              <select id="flt-c-crm">
                <option value=""${crm === '' ? ' selected' : ''}>Tất cả</option>
                <option value="NEW_PENDING_VERIFICATION"${crm === 'NEW_PENDING_VERIFICATION' ? ' selected' : ''}>Mới (Chờ xác thực)</option>
                <option value="VERIFIED"${crm === 'VERIFIED' ? ' selected' : ''}>Đã xác thực</option>
                <option value="DUPLICATE_REVIEW"${crm === 'DUPLICATE_REVIEW' ? ' selected' : ''}>Chờ kiểm tra trùng lặp</option>
                <option value="ARCHIVED"${crm === 'ARCHIVED' ? ' selected' : ''}>Đã lưu trữ</option>
              </select></div>
            <div class="dyc-field"><label>Nguồn KH</label>
              <select id="flt-c-ch">
                <option value=""${ch === '' ? ' selected' : ''}>Tất cả</option>
                <option value="DEALER"${ch === 'DEALER' ? ' selected' : ''}>Đại lý (DEALER)</option>
                <option value="DIRECT"${ch === 'DIRECT' ? ' selected' : ''}>Trực tiếp (DIRECT)</option>
                <option value="MANUAL"${ch === 'MANUAL' ? ' selected' : ''}>Thủ công (MANUAL)</option>
                <option value="OCR"${ch === 'OCR' ? ' selected' : ''}>OCR</option>
              </select></div>
            <div class="dyc-field"><label>Đại lý nguồn</label>
              <select id="flt-c-src-dealer"><option value="">Tất cả</option>${dealerOpts.map((d) => `<option value="${_esc(d.dealer_id)}"${fc.source_dealer_id === d.dealer_id ? ' selected' : ''}>${_esc(d.dealer_id)} — ${_esc(d.dealer_name)}</option>`).join('')}</select></div>
            <div class="dyc-field"><label>Thành phố</label>
              <input id="flt-c-city" list="dyc-city-datalist" value="${_esc(fc.city)}" autocomplete="off" /></div>
            <div class="dyc-field"><label>Phường / Xã</label>
              <input id="flt-c-ward" list="dyc-ward-datalist" value="${_esc(fc.ward)}" autocomplete="off" /></div>
            <div class="dyc-field"><label>Có SĐT</label>
              <select id="flt-c-has-phone">
                <option value=""${fc.has_phone === '' ? ' selected' : ''}>Tất cả</option>
                <option value="true"${fc.has_phone === 'true' ? ' selected' : ''}>Có SĐT</option>
                <option value="false"${fc.has_phone === 'false' ? ' selected' : ''}>Chưa có SĐT</option>
              </select></div>
            <div class="dyc-field"><label>Có xe liên kết</label>
              <select id="flt-c-has-veh">
                <option value=""${fc.has_vehicle === '' ? ' selected' : ''}>Tất cả</option>
                <option value="true"${fc.has_vehicle === 'true' ? ' selected' : ''}>Có xe</option>
                <option value="false"${fc.has_vehicle === 'false' ? ' selected' : ''}>Chưa có xe</option>
              </select></div>
          </div>
          <div class="cust-filter-actions">
            <button type="button" class="btn btn-outline btn-sm" data-flt-act="customers-refresh">Làm mới</button>
            <button type="button" class="btn btn-primary btn-sm" data-flt-act="customers-create">Tạo khách hàng</button>
          </div>
          <div class="cust-filter-meta">Tổng số kết quả sau lọc: <strong id="flt-c-total">${cTotal}</strong></div>
          <div class="filter-chips-row" id="flt-c-chips"></div>
        </div>
        ${rows.length === 0 ? '<div class="empty-state cust-empty"><p>Không tìm thấy khách hàng phù hợp với bộ lọc.</p></div>' : `
        <div class="table-wrap" style="overflow-x:auto"><table class="data-table" style="font-size:11px"><thead><tr>
          <th>Loại KH</th><th>Tên</th><th>MST</th><th>SĐT</th><th>Địa chỉ</th><th>Đường</th><th>Phường</th><th>TP</th><th>Full</th><th>AMIS</th><th>TT</th><th></th>
        </tr></thead><tbody>
        ${rows.map(c => `<tr>
          <td>${_esc(c.customer_category === 'RETAIL_CUSTOMER' ? 'Khách lẻ' : c.customer_category)}</td>
          <td><strong>${_esc(c.customer_id)}</strong><br/>${_esc(c.customer_name)}</td>
          <td>${_esc(c.tax_code)}</td><td>${_esc(c.phone || c.phone_masked)}</td>
          <td>${_esc(c.address_no)}</td><td>${_esc(c.street)}</td><td>${_esc(c.ward)}</td><td>${_esc(c.city)}</td>
          <td style="max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(c.full_address)}</td>
          <td>${_esc(c.amis_customer_code)}</td><td>${_esc(c.status === 'ACTIVE' ? 'Hoạt động' : (c.status === 'INACTIVE' ? 'Ngừng HĐ' : c.status))}</td>
          <td style="white-space:nowrap">
            <button type="button" class="btn btn-outline btn-sm" onclick="moDrawerCustomer('${c.customer_id}')">Lịch sử</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="moFormCustomer('${c.customer_id}')">Sửa</button>
            ${c.status === 'ACTIVE'
              ? `<button type="button" class="btn btn-outline btn-sm" onclick="moToggleCustomer('${c.customer_id}','deactivate')">Ngừng HĐ</button>`
              : `<button type="button" class="btn btn-outline btn-sm" onclick="moToggleCustomer('${c.customer_id}','activate')">Kích hoạt</button>`}
          </td></tr>`).join('')}
        </tbody></table></div>`}
        `;
      _fillWardDatalistForCity(fc.city);
      _customerFilterChips(fc, (key) => {
        window._custF.customers[key] = '';
        taiKhachHang();
      });
    } else {
      const fv = window._custF.vehicles;
      const fn = window._custF.norms;
      const vehSub = window._custVehSub || 'list';
      const [vehJson, dealerPick, custPick] = await Promise.all([
        fetch(`/api/vehicles${buildQuery({ ...fv, with_meta: '1' })}`).then((r) => r.json()),
        fetch('/api/dealers').then((r) => r.json()),
        fetch('/api/end-customers').then((r) => r.json()),
      ]);
      const { items: rows, total: vTotal } = normalizeListResponse(vehJson);
      const dealerOpts = normalizeListResponse(dealerPick).items;
      const custOpts = normalizeListResponse(custPick).items;
      const vst = fv.vehicle_status;
      
      const activeId = document.activeElement?.id;
      let activeStart, activeEnd;
      if (activeId && document.activeElement.tagName === 'INPUT') {
        activeStart = document.activeElement.selectionStart;
        activeEnd = document.activeElement.selectionEnd;
      }
      
      document.getElementById('cust-pane-vehicles').innerHTML = `
        <div class="kpi-grid kpi-grid-compact" style="margin-bottom:12px">
          <div class="kpi-card" data-color="blue"><div class="kpi-val">${sum.total_vehicles}</div><div class="kpi-label">Tổng xe</div></div>
          <div class="kpi-card" data-color="orange"><div class="kpi-val">${sum.vehicles_without_customer}</div><div class="kpi-label">Chưa gắn KH</div></div>
        </div>
        <div class="cust-subtabs" style="margin-bottom:10px; display:none;">
          <button class="veh-sub btn btn-sm btn-primary" data-vehsub="list">Danh sách xe</button>
        </div>
        <div id="cust-veh-list-wrap" style="display:${vehSub === 'list' ? 'block' : 'none'}">
        <div class="cust-filter-bar">
          <div class="cust-filter-title">Bộ lọc hồ sơ xe</div>
          <div class="cust-filter-grid">
            <div class="dyc-field dyc-field-span2"><label>Tìm kiếm</label>
              <input id="flt-v-q" placeholder="Tìm theo mã xe, dòng xe, VIN, khách hàng, đại lý..." value="${_esc(fv.q)}" autocomplete="off" /></div>
            <div class="dyc-field"><label>Dòng xe</label>
              <input id="flt-v-model" list="dyc-model-datalist" placeholder="Chọn hoặc nhập dòng xe" value="${_esc(fv.vehicle_model_code)}" autocomplete="off" /></div>
            <div class="dyc-field"><label>Năm model</label>
              <select id="flt-v-year">${_yearOptionsHtml(fv.model_year)}</select></div>
            <div class="dyc-field"><label>Đại lý</label>
              <select id="flt-v-dealer"><option value="">Tất cả</option>${dealerOpts.map((d) => `<option value="${_esc(d.dealer_id)}"${fv.dealer_id === d.dealer_id ? ' selected' : ''}>${_esc(d.dealer_id)}</option>`).join('')}</select></div>
            <div class="dyc-field"><label>Khách hàng</label>
              <select id="flt-v-cust"><option value="">Tất cả</option>${custOpts.map((c) => `<option value="${_esc(c.customer_id)}"${fv.customer_id === c.customer_id ? ' selected' : ''}>${_esc(c.customer_id)}</option>`).join('')}</select></div>
            <div class="dyc-field"><label>Trạng thái xe</label>
              <select id="flt-v-vst">
                <option value=""${vst === '' ? ' selected' : ''}>Tất cả</option>
                <option value="ACTIVE"${vst === 'ACTIVE' ? ' selected' : ''}>ACTIVE</option>
                <option value="SOLD"${vst === 'SOLD' ? ' selected' : ''}>SOLD</option>
                <option value="UNKNOWN"${vst === 'UNKNOWN' ? ' selected' : ''}>UNKNOWN</option>
                <option value="ARCHIVED"${vst === 'ARCHIVED' ? ' selected' : ''}>ARCHIVED</option>
              </select></div>
            <div class="dyc-field"><label>Có KH liên kết</label>
              <select id="flt-v-has-cust">
                <option value=""${fv.has_customer === '' ? ' selected' : ''}>Tất cả</option>
                <option value="true"${fv.has_customer === 'true' ? ' selected' : ''}>Có khách hàng</option>
                <option value="false"${fv.has_customer === 'false' ? ' selected' : ''}>Chưa có khách hàng</option>
              </select></div>
            <div class="dyc-field"><label>Định mức active</label>
              <select id="flt-v-has-norm">
                <option value=""${fv.has_active_norm === '' ? ' selected' : ''}>Tất cả</option>
                <option value="true"${fv.has_active_norm === 'true' ? ' selected' : ''}>Có định mức</option>
                <option value="false"${fv.has_active_norm === 'false' ? ' selected' : ''}>Chưa có định mức</option>
              </select></div>
          </div>
          <div class="cust-filter-actions">
            <button type="button" class="btn btn-outline btn-sm" data-flt-act="vehicles-refresh">Làm mới</button>
            <button type="button" class="btn btn-outline btn-sm" data-flt-act="vehicles-create">Tạo hồ sơ xe</button>
          </div>
          <div class="cust-filter-meta">Tổng số kết quả sau lọc: <strong id="flt-v-total">${vTotal}</strong></div>
          <div class="filter-chips-row" id="flt-v-chips"></div>
        </div>
        <p class="cust-norm-hint muted" style="font-size:11px;margin:0 0 8px 0">Xe chưa có định mức active: cảnh báo hiển thị theo dòng.</p>
          <div class="table-wrap"><table class="data-table"><thead><tr>
            <th>vehicle_id</th><th>model</th><th>vin_masked</th><th>dealer</th><th>customer</th><th>TT</th><th></th>
          </tr></thead><tbody>
          ${rows.map((v) => {
            const noNorm = v.has_active_norm === false;
            return `<tr><td><strong>${_esc(v.vehicle_id)}</strong></td><td>${_esc(v.vehicle_model_code)}${noNorm ? ' <span class="badge-warn" title="Dòng xe này chưa có định mức active.">!</span>' : ''}</td><td>${_esc(v.vin_masked || '—')}</td>
            <td>${_esc(v.dealer_id || '—')}</td><td>${_esc(v.customer_id || '—')}</td><td>${_esc(v.vehicle_status || v.status)}</td>
            <td><button type="button" class="btn btn-outline btn-sm" onclick="moDrawerVehicle('${v.vehicle_id}')">Lịch sử</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="moToggleVehicle('${v.vehicle_id}','${(v.vehicle_status || v.status) === 'ACTIVE' ? 'deactivate' : 'activate'}')">${(v.vehicle_status || v.status) === 'ACTIVE' ? 'Inactive' : 'Active'}</button></td></tr>`;
          }).join('')}
          </tbody></table></div>
        </div>
        `;
        
      if (activeId) {
        const el = document.getElementById(activeId);
        if (el) {
          el.focus();
          if (activeStart !== undefined && el.setSelectionRange) {
            el.setSelectionRange(activeStart, activeEnd);
          }
        }
      }
        
      _vehicleFilterChips(fv, (key) => {
        window._custF.vehicles[key] = '';
        taiKhachHang();
      });

    }
    document.getElementById('cust-pane-dealers').style.display = sub === 'dealers' ? 'block' : 'none';
    document.getElementById('cust-pane-customers').style.display = sub === 'customers' ? 'block' : 'none';
    document.getElementById('cust-pane-vehicles').style.display = sub === 'vehicles' ? 'block' : 'none';
  } catch (e) { toast('error', 'Lỗi tab Khách hàng', e.message); }
}

const histPropsConfig = {
  dealer: [
    { key: 'dealer_id', label: 'Mã đại lý' },
    { key: 'dealer_name', label: 'Tên đại lý' },
    { key: 'dealer_group', label: 'Nhóm đại lý' },
    { key: 'tax_code', label: 'Mã số thuế' },
    { key: 'contact_phone', label: 'Số điện thoại' },
    { key: 'address_no', label: 'Số nhà' },
    { key: 'street', label: 'Đường' },
    { key: 'ward', label: 'Phường/Xã' },
    { key: 'city', label: 'Tỉnh/Thành phố' },
    { key: 'full_address', label: 'Địa chỉ đầy đủ' },
    { key: 'amis_customer_code', label: 'Mã AMIS' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'created_at', label: 'Ngày tạo', isDate: true }
  ],
  customer: [
    { key: 'customer_id', label: 'Mã khách hàng' },
    { key: 'customer_name', label: 'Tên khách hàng' },
    { key: 'tax_code', label: 'Mã số thuế' },
    { key: 'contact_phone', label: 'Số điện thoại' },
    { key: 'address_no', label: 'Số nhà' },
    { key: 'street', label: 'Đường' },
    { key: 'ward', label: 'Phường/Xã' },
    { key: 'city', label: 'Tỉnh/Thành phố' },
    { key: 'full_address', label: 'Địa chỉ đầy đủ' },
    { key: 'amis_customer_code', label: 'Mã AMIS' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'created_at', label: 'Ngày tạo', isDate: true }
  ],
  vehicle: [
    { key: 'vehicle_id', label: 'Mã xe' },
    { key: 'vehicle_model_code', label: 'Dòng xe' },
    { key: 'vin_number', label: 'Số VIN' },
    { key: 'model_year', label: 'Đời xe' },
    { key: 'delivery_date', label: 'Ngày giao xe (đại lý → khách)', isDate: true },
    { key: 'dealer_id', label: 'Mã đại lý' },
    { key: 'customer_id', label: 'Mã khách hàng' },
    { key: 'vehicle_status', label: 'Trạng thái xe' },
    { key: 'created_at', label: 'Ngày tạo', isDate: true }
  ]
};

function renderPropsToHtml(obj, props) {
  if (!obj) return '';
  return `<table style="width:100%; font-size:12px; border-collapse:collapse; margin-top:4px; border:1px solid #3b3b4f;">
    <tbody>
      ${props.map(p => {
        const val = obj[p.key];
        const valStr = (val === null || val === undefined || val === '') ? '<span style="color:#888">Trống</span>' : (p.isDate ? fmtDt(val) : _esc(String(val)));
        return `<tr>
          <td style="width:140px; font-weight:600; background:#2a2a3a; color:#ccc; border:1px solid #3b3b4f; padding:6px 10px;">${_esc(p.label)}</td>
          <td style="border:1px solid #3b3b4f; padding:6px 10px; color:#fff; word-break:break-word;">${valStr}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

window.moDrawerDealer = async function(id) {
  const ov = document.getElementById('modal-drawer-overlay');
  const h = await fetch(`/api/dealers/${encodeURIComponent(id)}/history`).then(r => r.json());
  document.getElementById('drawer-title').textContent = 'Đại lý — ' + id;
  
  let statsHtml = '';
  if (h.requests_per_month || h.popular_models || h.completed_count !== undefined) {
     statsHtml = `<div style="margin-top:20px; padding-top:10px; border-top:1px solid #3b3b4f;"><h4 style="margin-bottom:12px;color:#fff;">Thống kê hoạt động</h4>`;
     statsHtml += `<div class="kpi-grid kpi-grid-compact" style="margin-bottom:12px;">
        <div class="kpi-card" data-color="blue"><div class="kpi-val">${h.completed_count || 0}</div><div class="kpi-label">Số đơn hoàn thành</div></div>
        <div class="kpi-card" data-color="teal"><div class="kpi-val">${(h.on_time_sla_rate_percent || 0).toFixed(1)}%</div><div class="kpi-label">Đúng hạn SLA</div></div>
     </div>`;
     if (h.popular_models && h.popular_models.length > 0) {
       statsHtml += `<div style="margin-top:10px;font-size:12px;"><strong style="color:#aaa;">Dòng xe phổ biến:</strong> <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">${h.popular_models.map(m => `<span style="background:#2a2a3a;padding:2px 6px;border-radius:4px;border:1px solid #3b3b4f;">${_esc(m.model)} (${m.count})</span>`).join('')}</div></div>`;
     }
     if (h.requests_per_month && Object.keys(h.requests_per_month).length > 0) {
       statsHtml += `<div style="margin-top:10px;font-size:12px;"><strong style="color:#aaa;">Yêu cầu theo tháng:</strong> <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">${Object.entries(h.requests_per_month).map(([k,v]) => `<span style="background:#2a2a3a;padding:2px 6px;border-radius:4px;border:1px solid #3b3b4f;">${_esc(k)}: ${v}</span>`).join('')}</div></div>`;
     }
     statsHtml += `</div>`;
  }
  
  delete h.requests; delete h.vehicles; delete h.customers_from_dealer; delete h.requests_per_month; delete h.popular_models; delete h.completed_count; delete h.on_time_sla_rate_percent; delete h.revenue_placeholder;
  
  document.getElementById('drawer-body').innerHTML = `<h4 style="margin-bottom:8px;color:#fff;">Thông tin chung</h4>` + renderPropsToHtml(h.dealer || h, histPropsConfig.dealer) + statsHtml;
  ov.style.display = 'flex';
};

window.moDrawerCustomer = async function(id) {
  const ov = document.getElementById('modal-drawer-overlay');
  const h = await fetch(`/api/customers/${encodeURIComponent(id)}/history`).then(r => r.json());
  document.getElementById('drawer-title').textContent = 'Khách hàng — ' + id;
  
  let statsHtml = '';
  if (h.requests_per_month || h.popular_models || h.completed_count !== undefined || h.vehicles || h.requests) {
     statsHtml = `<div style="margin-top:20px; padding-top:10px; border-top:1px solid #3b3b4f;"><h4 style="margin-bottom:12px;color:#fff;">Thống kê hoạt động</h4>`;
     statsHtml += `<div class="kpi-grid kpi-grid-compact" style="margin-bottom:12px;">
        <div class="kpi-card" data-color="blue"><div class="kpi-val">${h.completed_count || (h.requests ? h.requests.length : 0)}</div><div class="kpi-label">Số lần sử dụng dịch vụ</div></div>
        <div class="kpi-card" data-color="purple"><div class="kpi-val">${h.vehicles ? h.vehicles.length : 0}</div><div class="kpi-label">Số lượng xe</div></div>
     </div>`;
     if (h.popular_models && h.popular_models.length > 0) {
       statsHtml += `<div style="margin-top:10px;font-size:12px;"><strong style="color:#aaa;">Dòng xe phổ biến:</strong> <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">${h.popular_models.map(m => `<span style="background:#2a2a3a;padding:2px 6px;border-radius:4px;border:1px solid #3b3b4f;">${_esc(m.model)} (${m.count})</span>`).join('')}</div></div>`;
     }
     if (h.requests_per_month && Object.keys(h.requests_per_month).length > 0) {
       statsHtml += `<div style="margin-top:10px;font-size:12px;"><strong style="color:#aaa;">Yêu cầu theo tháng:</strong> <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">${Object.entries(h.requests_per_month).map(([k,v]) => `<span style="background:#2a2a3a;padding:2px 6px;border-radius:4px;border:1px solid #3b3b4f;">${_esc(k)}: ${v}</span>`).join('')}</div></div>`;
     }
     statsHtml += `</div>`;
  }
  
  delete h.requests; delete h.vehicles; delete h.requests_per_month; delete h.popular_models; delete h.completed_count; delete h.on_time_sla_rate_percent;
  
  document.getElementById('drawer-body').innerHTML = `<h4 style="margin-bottom:8px;color:#fff;">Thông tin chung</h4>` + renderPropsToHtml(h.customer || h, histPropsConfig.customer) + statsHtml;
  ov.style.display = 'flex';
};

window.moDrawerVehicle = async function(id) {
  const ov = document.getElementById('modal-drawer-overlay');
  const h = await fetch(`/api/vehicles/${encodeURIComponent(id)}/history`).then(r => r.json());
  document.getElementById('drawer-title').textContent = 'Xe — ' + id;
  
  let statsHtml = '';
  if (h.requests && h.requests.length > 0) {
    statsHtml = `<div style="margin-top:20px; padding-top:10px; border-top:1px solid #3b3b4f;"><h4 style="margin-bottom:12px;color:#fff;">Lịch sử thi công</h4>`;
    statsHtml += `<table class="data-table veh-hist-table" style="font-size:12px; width:100%;">
      <thead><tr><th>Mã yêu cầu</th><th>Ngày tạo</th><th>Trạng thái</th><th>Hạng mục</th></tr></thead>
      <tbody>
        ${h.requests.map((r) => {
          const rid = r.request_id || '';
          const hang = _requestHangMucOneLine(r);
          return `<tr>
          <td><button type="button" class="veh-hist-req-link" data-request-id=${JSON.stringify(
            rid,
          )} title="Xem đầy đủ đơn thi công">${_esc(rid)}</button></td>
          <td>${fmtDt(r.created_at)}</td>
          <td>${_esc(r.status)}</td>
          <td><span class="veh-hist-hang" style="font-size:10px;">${_esc(hang)}</span></td>
        </tr>`;
        }).join('')}
      </tbody>
    </table>
    <p class="muted" style="font-size:10px;margin:8px 0 0;line-height:1.45">Nhấn <strong>mã yêu cầu</strong> để chuyển sang tab Đơn thi công và xem toàn bộ thông tin đơn (tiến trình, định mức, phân bổ, audit…).</p></div>`;
  }

  delete h.requests; delete h.owner_customer; delete h.dealer; delete h.services_completed; delete h.last_delivery_date;
  
  document.getElementById('drawer-body').innerHTML = `<h4 style="margin-bottom:8px;color:#fff;">Thông tin chung</h4>` + renderPropsToHtml(h.vehicle || h, histPropsConfig.vehicle) + statsHtml;
  ov.style.display = 'flex';
};

window._custVehSub = window._custVehSub || 'list';

document.getElementById('tab-customers')?.addEventListener('change', (ev) => {
  const target = ev.target;
  if (target.id && target.id.startsWith('flt-')) {
     if (target.id.startsWith('flt-d-')) { applyCustomerFilters('dealers'); taiKhachHang(); }
     else if (target.id.startsWith('flt-c-')) { applyCustomerFilters('customers'); taiKhachHang(); }
     else if (target.id.startsWith('flt-v-')) { applyCustomerFilters('vehicles'); taiKhachHang(); }
     else if (target.id.startsWith('flt-n-')) { applyCustomerFilters('norms'); taiKhachHang(); }
  }
});

document.getElementById('tab-customers')?.addEventListener('click', (ev) => {
  const fa = ev.target.closest('[data-flt-act]');
  if (fa) {
    const act = fa.getAttribute('data-flt-act');
    if (act === 'dealers-apply') {
      applyCustomerFilters('dealers');
      taiKhachHang();
      return;
    }
    if (act === 'dealers-clear') {
      clearCustomerFilters('dealers');
      taiKhachHang();
      return;
    }
    if (act === 'dealers-refresh') {
      clearCustomerFilters('dealers');
      taiKhachHang();
      return;
    }
    if (act === 'dealers-create') {
      document.getElementById('mc-btn-quick-dealer')?.click();
      return;
    }
    if (act === 'customers-apply') {
      applyCustomerFilters('customers');
      taiKhachHang();
      return;
    }
    if (act === 'customers-clear') {
      clearCustomerFilters('customers');
      taiKhachHang();
      return;
    }
    if (act === 'customers-refresh') {
      clearCustomerFilters('customers');
      taiKhachHang();
      return;
    }
    if (act === 'customers-create') {
      document.getElementById('mc-btn-quick-cust')?.click();
      return;
    }
    if (act === 'vehicles-apply') {
      applyCustomerFilters('vehicles');
      taiKhachHang();
      return;
    }
    if (act === 'vehicles-clear') {
      clearCustomerFilters('vehicles');
      taiKhachHang();
      return;
    }
    if (act === 'vehicles-refresh') {
      clearCustomerFilters('vehicles');
      taiKhachHang();
      return;
    }
    if (act === 'vehicles-create') {
      document.getElementById('mc-btn-quick-veh')?.click();
      return;
    }
    if (false) {
      applyCustomerFilters('norms');
      taiKhachHang();
      return;
    }
    if (act === 'norms-clear') {
      clearCustomerFilters('norms');
      taiKhachHang();
      return;
    }
    if (act === 'norms-refresh') {
      taiKhachHang();
      return;
    }
    if (act === 'norms-add') {
      window.moFormNorm('');
      return;
    }
  }
  const edit = ev.target.closest('.btn-norm-edit');
  if (edit && ev.target.closest('#cust-pane-vehicles')) {
    ev.preventDefault();
    window.moFormNorm(edit.getAttribute('data-norm-id') || '');
    return;
  }
  const tg = ev.target.closest('.btn-norm-toggle');
  if (tg && ev.target.closest('#cust-pane-vehicles')) {
    ev.preventDefault();
    window.moToggleNorm(tg.getAttribute('data-norm-id') || '', tg.getAttribute('data-norm-act') || 'deactivate');
    return;
  }
  const b = ev.target.closest('.veh-sub');
  if (!b) return;
  window._custVehSub = b.dataset.vehsub || 'list';
  taiKhachHang();
});

document.getElementById('tab-customers')?.addEventListener('input', (ev) => {
  const id = ev.target.id;
  if (id === 'flt-d-city' || id === 'flt-c-city') _fillWardDatalistForCity(ev.target.value);
  if (id === 'flt-d-q' || id === 'flt-d-model') __debDealerQ();
  else if (id === 'flt-c-q' || id === 'flt-c-model') __debCustomerQ();
  else if (id === 'flt-v-q' || id === 'flt-v-model') __debVehicleQ();
  else if (id === 'flt-n-q' || id === 'flt-n-model') __debNormQ();
});

document.getElementById('tab-customers')?.addEventListener('change', (ev) => {
  const id = ev.target.id;
  if (id.startsWith('flt-d-')) __debDealerQ();
  else if (id.startsWith('flt-c-')) __debCustomerQ();
  else if (id.startsWith('flt-v-')) __debVehicleQ();
  else if (id.startsWith('flt-n-')) __debNormQ();
});

document.getElementById('tab-customers')?.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  const id = ev.target.id;
  if (!id.startsWith('flt-')) return;
  ev.preventDefault();
  if (id.startsWith('flt-d-')) {
    applyCustomerFilters('dealers');
    taiKhachHang();
  } else if (id.startsWith('flt-c-')) {
    applyCustomerFilters('customers');
    taiKhachHang();
  } else if (id.startsWith('flt-v-')) {
    applyCustomerFilters('vehicles');
    taiKhachHang();
  } else if (id.startsWith('flt-n-')) {
    applyCustomerFilters('norms');
    taiKhachHang();
  }
});

function _closeQuickModal() {
  document.getElementById('modal-quick-overlay').style.display = 'none';
  window._quickFormDirty = false;
  _mcQuickMode = null;
}
document.getElementById('btn-x-modal-quick')?.addEventListener('click', () => _tryCloseQuickModal());
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const rov = document.getElementById('modal-reason-overlay');
  if (rov && rov.style.display === 'flex') {
    e.preventDefault();
    _finishReasonModal(null);
    return;
  }
  const qov = document.getElementById('modal-quick-overlay');
  if (qov && qov.style.display === 'flex') {
    e.preventDefault();
    _tryCloseQuickModal();
  }
});
document.getElementById('btn-x-drawer')?.addEventListener('click', () => {
  document.getElementById('modal-drawer-overlay').style.display = 'none';
});
/** Mã yêu cầu trong drawer Xe — dùng delegation (onclick inline đôi khi không gọi được hàm global). */
document.getElementById('drawer-body')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button.veh-hist-req-link');
  if (!btn) return;
  const id = (btn.getAttribute('data-request-id') || '').trim();
  if (!id) return;
  e.preventDefault();
  e.stopPropagation();
  if (typeof window.dongDrawerVaMoChiTietDon === 'function') window.dongDrawerVaMoChiTietDon(id);
});
document.getElementById('btn-x-demo-modal')?.addEventListener('click', () => {
  document.getElementById('demo-modal-overlay').style.display = 'none';
});
document.getElementById('btn-x-ws-edit')?.addEventListener('click', () => {
  if (typeof window.closeWsEdit === 'function') window.closeWsEdit();
});

window.moToggleDealer = async function(id, act) {
  _wireReasonModalOnce();
  const title = act === 'activate' ? 'Kích hoạt đại lý' : 'Vô hiệu hóa đại lý';
  const res = await openReasonModal(`${title} — ${id}`, { showAdminOverride: true });
  if (!res || !String(res.reason || '').trim()) return;
  const path = act === 'activate' ? 'activate' : 'deactivate';
  const url = `/api/dealers/${encodeURIComponent(id)}/${path}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: res.reason.trim(), admin_override: !!res.admin_override, updated_by: 'WEB' }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('[moToggleDealer]', url, r.status, data);
    toast('error', 'Lỗi cập nhật đại lý', data.detail || JSON.stringify(data));
    return;
  }
  toast('success', 'Đại lý', 'Đã cập nhật trạng thái');
  taiKhachHang();
};
window.moToggleCustomer = async function(id, act) {
  _wireReasonModalOnce();
  const title = act === 'activate' ? 'Kích hoạt khách hàng' : 'Vô hiệu hóa khách hàng';
  const res = await openReasonModal(`${title} — ${id}`, { showAdminOverride: true });
  if (!res || !String(res.reason || '').trim()) return;
  const path = act === 'activate' ? 'activate' : 'deactivate';
  const url = `/api/end-customers/${encodeURIComponent(id)}/${path}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: res.reason.trim(), admin_override: !!res.admin_override, updated_by: 'WEB' }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('[moToggleCustomer]', url, r.status, data);
    toast('error', 'Lỗi cập nhật KH', data.detail || JSON.stringify(data));
    return;
  }
  toast('success', 'Khách hàng', 'Đã cập nhật trạng thái');
  taiKhachHang();
};
window.moToggleVehicle = async function(id, act) {
  _wireReasonModalOnce();
  const title = act === 'activate' ? 'Kích hoạt xe' : 'Vô hiệu hóa xe';
  const res = await openReasonModal(`${title} — ${id}`, { showAdminOverride: false });
  if (!res || !String(res.reason || '').trim()) return;
  const path = act === 'activate' ? 'activate' : 'deactivate';
  const url = `/api/vehicles/${encodeURIComponent(id)}/${path}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: res.reason.trim(), updated_by: 'WEB' }),
  });
  const txt = await r.text();
  if (!r.ok) {
    console.error('[moToggleVehicle]', url, r.status, txt);
    toast('error', 'Lỗi xe', txt);
    return;
  }
  toast('success', 'Xe', 'Đã cập nhật');
  taiKhachHang();
};
window.moToggleNorm = async function(normId, act) {
  _wireReasonModalOnce();
  const title = act === 'activate' ? 'Kích hoạt định mức' : 'Vô hiệu hóa định mức';
  const res = await openReasonModal(`${title} — ${normId}`, { showAdminOverride: false });
  if (!res || !String(res.reason || '').trim()) return;
  const path = act === 'activate' ? 'activate' : 'deactivate';
  const url = `/api/vehicle-norms/${encodeURIComponent(normId)}/${path}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: res.reason.trim(), updated_by: 'WEB' }),
  });
  const txt = await r.text();
  if (!r.ok) {
    console.error('[moToggleNorm]', url, r.status, txt);
    toast('error', 'Lỗi định mức', txt);
    return;
  }
  toast('success', 'Định mức', 'Đã cập nhật trạng thái');
  taiKhachHang();
  await taiDinhMucPhim();
};

window.moFormDealer = async function(id) {
  _wireReasonModalOnce();
  await ensureLocationProvincesLoaded();
  const rows = normalizeListResponse(await fetch('/api/dealers').then((r) => r.json())).items;
  const d = rows.find(x => x.dealer_id === id) || {};
  const reasonBox = id
    ? `<div class="dyc-field"><label>Lý do sửa<span class="req">*</span></label><input id="ed-d-reason" placeholder="Bắt buộc — nhật ký kiểm toán" autocomplete="off" /></div>`
    : '';
  _openQuick(
    id ? 'Sửa đại lý' : 'Đại lý',
    `
<div class="dyc-modal-form">
  ${reasonBox}
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Tên khách hàng / đại lý</label><input id="ed-d-name" value="${_esc(d.customer_name || d.dealer_name || '')}" /></div>
    <div class="dyc-field"><label>Nhóm đại lý</label><input id="ed-d-group" list="dyc-dealer-group-datalist" value="${_esc(d.dealer_group || '')}" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>MST</label><input id="ed-d-tax" value="${_esc(d.tax_code || '')}" /></div>
    <div class="dyc-field"><label>SĐT</label><input id="ed-d-phone" value="${_esc(d.phone || '')}" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Số nhà / địa chỉ ngắn</label><input id="ed-d-ano" value="${_esc(d.address_no || '')}" /></div>
    <div class="dyc-field"><label>Đường</label><input id="ed-d-st" value="${_esc(d.street || '')}" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Phường / xã</label><input id="ed-d-ward" value="${_esc(d.ward || '')}" autocomplete="off" /></div>
    <div class="dyc-field"><label>Tỉnh / thành phố</label><input id="ed-d-city" value="${_esc(d.city || '')}" autocomplete="off" /></div>
  </div>
  <div class="dyc-field"><label>Địa chỉ đầy đủ</label>
    <div class="dyc-inline-row">
      <input id="ed-d-full" class="dyc-grow" value="${_esc(d.full_address || '')}" />
      <button type="button" class="btn btn-outline btn-sm" id="ed-d-rebuild-full" style="white-space:nowrap">Tự tạo lại địa chỉ</button>
    </div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Mã AMIS</label><input id="ed-d-amis" value="${_esc(d.amis_customer_code || '')}" /></div>
    <div class="dyc-field">
      <label>Mã đại lý (dùng trong mã đơn) <span style="color:#1a6fc4">★</span></label>
      <input id="ed-d-code" value="${_esc(d.dealer_code || '')}" placeholder="VD: LEX-SG, BKH, TOY-BT" style="font-weight:600" />
      <small style="color:#888">Điền ngắn gọn, không dấu, dùng làm tiền tố mã đơn</small>
    </div>
  </div>
</div>`,
    { wide: true },
  );
  setupEditorAddress('ed-d');
  window._editDealerId = id;
  _mcQuickMode = 'edit-dealer';
};
window.moFormCustomer = async function(id) {
  _wireReasonModalOnce();
  await ensureLocationProvincesLoaded();
  const rows = normalizeListResponse(await fetch('/api/end-customers').then((r) => r.json())).items;
  const c = rows.find(x => x.customer_id === id) || {};
  _openQuick(
    'Sửa khách hàng',
    `
<div class="dyc-modal-form">
  <div class="dyc-field"><label>Lý do sửa<span class="req">*</span></label><input id="ed-c-reason" placeholder="Bắt buộc — nhật ký kiểm toán" autocomplete="off" /></div>
  <div class="dyc-field"><label>Tên khách hàng</label><input id="ed-c-name" value="${_esc(c.customer_name || '')}" /></div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>MST</label><input id="ed-c-tax" value="${_esc(c.tax_code || '')}" /></div>
    <div class="dyc-field"><label>SĐT</label><input id="ed-c-phone" value="${_esc(c.phone || c.phone_masked || '')}" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Số nhà / địa chỉ ngắn</label><input id="ed-c-ano" value="${_esc(c.address_no || '')}" /></div>
    <div class="dyc-field"><label>Đường</label><input id="ed-c-st" value="${_esc(c.street || '')}" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Phường / xã</label><input id="ed-c-ward" value="${_esc(c.ward || '')}" autocomplete="off" /></div>
    <div class="dyc-field"><label>Tỉnh / thành phố</label><input id="ed-c-city" value="${_esc(c.city || '')}" autocomplete="off" /></div>
  </div>
  <div class="dyc-field"><label>Địa chỉ đầy đủ</label>
    <div class="dyc-inline-row">
      <input id="ed-c-full" class="dyc-grow" value="${_esc(c.full_address || '')}" />
      <button type="button" class="btn btn-outline btn-sm" id="ed-c-rebuild-full" style="white-space:nowrap">Tự tạo lại địa chỉ</button>
    </div>
  </div>
  <div class="dyc-field"><label>Mã AMIS</label><input id="ed-c-amis" value="${_esc(c.amis_customer_code || '')}" /></div>
</div>`,
    { wide: true },
  );
  setupEditorAddress('ed-c');
  window._editCustomerId = id;
  _mcQuickMode = 'edit-customer';
};
window.moFormNorm = function(normId) {
  const isNew = !normId;
  const reasonBlock = isNew
    ? ''
    : `<div class="dyc-field"><label>Lý do sửa<span class="req">*</span></label><input id="ed-n-reason" placeholder="Bắt buộc khi sửa định mức" autocomplete="off" /></div>`;
  _openQuick(
    isNew ? 'Thêm định mức phim' : 'Sửa định mức phim',
    `
<div class="dyc-modal-form">
  ${reasonBlock}
  <div class="dyc-form-section">Định danh</div>
  <div class="dyc-field"><label>Mã định mức (norm_id)</label><input id="ed-n-id" ${isNew ? '' : 'readonly'} value="${_esc(normId)}" /></div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Loại phim<span class="req">*</span></label><input id="ed-n-ft" value="Phim cách nhiệt" /></div>
    <div class="dyc-field"><label>Dòng xe (mã)<span class="req">*</span></label><input id="ed-n-vc" placeholder="VD: RX300" /></div>
  </div>
  <div class="dyc-field"><label>Năm / khoảng model<span class="req">*</span></label><input id="ed-n-myr" placeholder="VD: 2018 hoặc 2013 - 2022" value="2013 - 2022" /></div>
  <div id="ed-n-mode-wf">
  <div class="dyc-form-section">Kích thước kính (WxL, cm — như Excel)</div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Kính lái (WF)</label><input id="ed-n-ws" placeholder="VD: 90x152" value="90x152" /></div>
    <div class="dyc-field"><label>Kính hậu</label><input id="ed-n-rs" placeholder="VD: 60x130" value="60x130" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Sườn trước</label><input id="ed-n-fs" placeholder="VD: 92x130" value="92x130" /></div>
    <div class="dyc-field"><label>Sườn sau + tam giác</label><input id="ed-n-sst" placeholder="VD: 50x152" value="50x152" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Kính trời</label><input id="ed-n-sun" placeholder="0 hoặc WxL" /></div>
    <div class="dyc-field"><label>Sườn sau (riêng)</label><input id="ed-n-rside" placeholder="WxL nếu tách khỏi SST" /></div>
  </div>
  <div class="dyc-field"><label>Tam giác (riêng)</label><input id="ed-n-tri" placeholder="WxL nếu tách" /></div>
  </div>
  <div id="ed-n-mode-ppf" style="display:none">
  <div class="dyc-form-section">Kích thước PPF (WxL, cm)</div>
  <p class="muted" style="font-size:11px;line-height:1.45;margin:0 0 10px">Trong CSDL, BODY dùng trường kỹ thuật <strong>windshield_*</strong> (không dùng cho kính lái WF). Kính lái PPF dùng <strong>front_side_*</strong>. Kính trời dùng <strong>sunroof_*</strong>.</p>
  <div class="dyc-field"><label>BODY (thân xe)<span class="req">*</span></label><input id="ed-n-p-body" placeholder="VD: 1300x152" autocomplete="off" /></div>
  <div class="dyc-field"><label>Kính lái (PPF)</label><input id="ed-n-p-ws" placeholder="VD: 122x165" autocomplete="off" /></div>
  <div class="dyc-field"><label>Kính trời</label><input id="ed-n-p-sun" placeholder="VD: 10x152" autocomplete="off" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Trạng thái</label><select id="ed-n-status"><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></div>
    <div class="dyc-field"><label>Ghi chú</label><input id="ed-n-note" placeholder="Tùy chọn" /></div>
  </div>
</div>`,
    { wide: true },
  );
  window._editNormId = normId;
  _mcQuickMode = isNew ? 'create-norm' : 'edit-norm';
  const ftEl = document.getElementById('ed-n-ft');
  ftEl?.addEventListener('input', _normSyncNormSizeMode);
  ftEl?.addEventListener('change', _normSyncNormSizeMode);
  _normSyncNormSizeMode();
  if (!isNew) {
    fetch('/api/vehicle-norms')
      .then((r) => r.json())
      .then((raw) => {
        const list = normalizeListResponse(raw).items;
        const n = list.find((x) => x.norm_id === normId);
        if (!n) {
          toast('warning', 'Định mức', 'Không tìm thấy norm_id trong danh sách.');
          return;
        }
        document.getElementById('ed-n-ft').value = n.film_type || '';
        document.getElementById('ed-n-vc').value = n.vehicle_model_code || '';
        document.getElementById('ed-n-myr').value = n.model_year_range || '';
        document.getElementById('ed-n-ws').value = n.windshield_size || '';
        document.getElementById('ed-n-rs').value = n.rear_window_size || '';
        document.getElementById('ed-n-fs').value = n.front_side_size || '';
        document.getElementById('ed-n-sst').value = n.rear_side_triangle_size || '';
        document.getElementById('ed-n-sun').value = n.sunroof_size || '';
        document.getElementById('ed-n-rside').value = n.rear_side_size || '';
        document.getElementById('ed-n-tri').value = n.triangle_size || '';
        const pb = document.getElementById('ed-n-p-body');
        const pw = document.getElementById('ed-n-p-ws');
        const ps = document.getElementById('ed-n-p-sun');
        if (pb) pb.value = n.windshield_size || '';
        if (pw) pw.value = n.front_side_size || '';
        if (ps) ps.value = n.sunroof_size || '';
        _normSyncNormSizeMode();
        const st = document.getElementById('ed-n-status');
        if (st) st.value = n.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
        const nt = document.getElementById('ed-n-note');
        if (nt) nt.value = n.note || '';
      })
      .catch((err) => {
        console.error('[moFormNorm] GET /api/vehicle-norms', err);
        toast('error', 'Định mức', 'Không tải được dữ liệu.');
      });
  }
};

function _openQuick(title, html, opts) {
  opts = opts || {};
  const shell = document.getElementById('modal-quick-shell');
  if (shell) shell.classList.toggle('dyc-modal-wide', !!opts.wide);
  document.getElementById('modal-quick-title').textContent = title;
  const body = document.getElementById('modal-quick-body');
  body.innerHTML = html;
  window._quickFormDirty = false;
  body.querySelectorAll('input, textarea, select').forEach((el) => {
    el.addEventListener('input', _markQuickDirty);
    el.addEventListener('change', _markQuickDirty);
  });
  document.getElementById('modal-quick-overlay').style.display = 'flex';
}

document.getElementById('modal-quick-cancel')?.addEventListener('click', () => _tryCloseQuickModal());
document.getElementById('drawer-close')?.addEventListener('click', () => {
  document.getElementById('modal-drawer-overlay').style.display = 'none';
});

document.getElementById('modal-quick-ok')?.addEventListener('click', async () => {
  const actor = 'AD-001';
  try {
    if (_mcQuickMode === 'edit-dealer') {
      const id = window._editDealerId;
      const reason = (document.getElementById('ed-d-reason')?.value || '').trim();
      if (!reason) { toast('warning', 'Thiếu reason', ''); return; }
      const body = {
        dealer_name: document.getElementById('ed-d-name').value.trim(),
        dealer_group: document.getElementById('ed-d-group').value.trim() || null,
        tax_code: document.getElementById('ed-d-tax').value.trim() || null,
        phone: document.getElementById('ed-d-phone').value.trim() || null,
        address_no: document.getElementById('ed-d-ano').value.trim() || null,
        street: document.getElementById('ed-d-st').value.trim() || null,
        ward: document.getElementById('ed-d-ward').value.trim() || null,
        city: document.getElementById('ed-d-city').value.trim() || null,
        full_address: document.getElementById('ed-d-full').value.trim() || null,
        amis_customer_code: document.getElementById('ed-d-amis').value.trim() || null,
        dealer_code: document.getElementById('ed-d-code')?.value.trim() || null,
        reason,
        updated_by: actor,
      };
      const r = await fetch(`/api/dealers/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const dtxt = await r.text();
      if (!r.ok) {
        console.error('[edit-dealer] PUT /api/dealers/', id, r.status, dtxt);
        throw new Error(dtxt);
      }
      toast('success', 'Đại lý', 'Đã lưu');
    } else if (_mcQuickMode === 'edit-customer') {
      const id = window._editCustomerId;
      const reason = (document.getElementById('ed-c-reason').value || '').trim();
      if (!reason) { toast('warning', 'Thiếu reason', ''); return; }
      const body = {
        customer_name: document.getElementById('ed-c-name').value.trim(),
        tax_code: document.getElementById('ed-c-tax').value.trim() || null,
        phone: document.getElementById('ed-c-phone').value.trim() || null,
        address_no: document.getElementById('ed-c-ano').value.trim() || null,
        street: document.getElementById('ed-c-st').value.trim() || null,
        ward: document.getElementById('ed-c-ward').value.trim() || null,
        city: document.getElementById('ed-c-city').value.trim() || null,
        full_address: document.getElementById('ed-c-full').value.trim() || null,
        amis_customer_code: document.getElementById('ed-c-amis').value.trim() || null,
        reason,
        updated_by: actor,
      };
      const r = await fetch(`/api/end-customers/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const ctxt = await r.text();
      if (!r.ok) {
        console.error('[edit-customer] PUT /api/end-customers/', id, r.status, ctxt);
        throw new Error(ctxt);
      }
      toast('success', 'KH', 'Đã lưu');
    } else if (_mcQuickMode === 'create-norm') {
      const ft = document.getElementById('ed-n-ft').value.trim();
      const isPpf = _normFilmTypeIsPpf(ft);
      const body = {
        norm_id: document.getElementById('ed-n-id').value.trim() || undefined,
        film_type: ft,
        vehicle_model_code: document.getElementById('ed-n-vc').value.trim(),
        model_year_range: document.getElementById('ed-n-myr').value.trim(),
        status: (document.getElementById('ed-n-status')?.value || 'ACTIVE').trim(),
        note: document.getElementById('ed-n-note')?.value.trim() || null,
        created_by: actor,
      };
      if (isPpf) {
        body.windshield_size = (document.getElementById('ed-n-p-body')?.value || '').trim();
        body.front_side_size = (document.getElementById('ed-n-p-ws')?.value || '').trim();
        body.sunroof_size = (document.getElementById('ed-n-p-sun')?.value || '').trim();
        body.rear_window_size = '';
        body.rear_side_triangle_size = '';
        body.rear_side_size = '';
        body.triangle_size = '';
      } else {
        body.windshield_size = document.getElementById('ed-n-ws').value.trim();
        body.rear_window_size = document.getElementById('ed-n-rs').value.trim();
        body.front_side_size = document.getElementById('ed-n-fs').value.trim();
        body.rear_side_triangle_size = document.getElementById('ed-n-sst').value.trim();
        body.sunroof_size = document.getElementById('ed-n-sun').value.trim();
        body.rear_side_size = document.getElementById('ed-n-rside').value.trim();
        body.triangle_size = document.getElementById('ed-n-tri').value.trim();
      }
      const url = '/api/vehicle-norms';
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const txt = await r.text();
      if (!r.ok) {
        console.error('[create-norm]', url, r.status, txt);
        throw new Error(txt);
      }
      toast('success', 'Định mức', 'Đã tạo');
    } else if (_mcQuickMode === 'edit-norm') {
      const nid = document.getElementById('ed-n-id').value.trim();
      const reason = (document.getElementById('ed-n-reason').value || '').trim();
      if (!reason) { toast('warning', 'Thiếu reason', ''); return; }
      const ft = document.getElementById('ed-n-ft').value.trim();
      const isPpf = _normFilmTypeIsPpf(ft);
      const body = {
        film_type: ft,
        vehicle_model_code: document.getElementById('ed-n-vc').value.trim(),
        model_year_range: document.getElementById('ed-n-myr').value.trim(),
        status: (document.getElementById('ed-n-status')?.value || 'ACTIVE').trim(),
        note: document.getElementById('ed-n-note')?.value.trim() || null,
        reason,
        updated_by: actor,
      };
      if (isPpf) {
        body.windshield_size = (document.getElementById('ed-n-p-body')?.value || '').trim();
        body.front_side_size = (document.getElementById('ed-n-p-ws')?.value || '').trim();
        body.sunroof_size = (document.getElementById('ed-n-p-sun')?.value || '').trim();
        body.rear_window_size = '';
        body.rear_side_triangle_size = '';
        body.rear_side_size = '';
        body.triangle_size = '';
      } else {
        body.windshield_size = document.getElementById('ed-n-ws').value.trim();
        body.rear_window_size = document.getElementById('ed-n-rs').value.trim();
        body.front_side_size = document.getElementById('ed-n-fs').value.trim();
        body.rear_side_triangle_size = document.getElementById('ed-n-sst').value.trim();
        body.sunroof_size = document.getElementById('ed-n-sun').value.trim();
        body.rear_side_size = document.getElementById('ed-n-rside').value.trim();
        body.triangle_size = document.getElementById('ed-n-tri').value.trim();
      }
      const url = `/api/vehicle-norms/${encodeURIComponent(nid)}`;
      const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const txt = await r.text();
      if (!r.ok) {
        console.error('[edit-norm]', url, r.status, txt);
        throw new Error(txt);
      }
      toast('success', 'Định mức', 'Đã lưu');
    } else if (_mcQuickMode === 'dealer') {
      const body = {
        dealer_id: document.getElementById('qc-dealer-id').value.trim(),
        dealer_code: document.getElementById('qc-dealer-code')?.value.trim() || null,
        dealer_name: document.getElementById('qc-dealer-name').value.trim(),
        legal_name: document.getElementById('qc-dealer-legal').value.trim() || null,
        dealer_group: document.getElementById('qc-dealer-group').value.trim() || null,
        address_no: document.getElementById('qc-dealer-ano')?.value.trim() || null,
        street: document.getElementById('qc-dealer-st')?.value.trim() || null,
        ward: document.getElementById('qc-dealer-ward')?.value.trim() || null,
        city: document.getElementById('qc-dealer-city')?.value.trim() || null,
        full_address: document.getElementById('qc-dealer-full')?.value.trim() || null,
        phone: document.getElementById('qc-dealer-phone').value.trim() || null,
        created_by: actor,
        note: document.getElementById('qc-dealer-note').value.trim() || null,
      };
      const r = await fetch('/api/dealers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      toast('success', 'Đại lý', 'Đã tạo đại lý');
      document.getElementById('mc-dealer-select').value = body.dealer_id;
    } else if (_mcQuickMode === 'customer') {
      const body = {
        customer_id: document.getElementById('qc-cust-id').value.trim(),
        customer_name: document.getElementById('qc-cust-mask').value.trim(),
        phone: document.getElementById('qc-cust-phone').value.trim() || null,
        address_no: document.getElementById('qc-cust-ano')?.value.trim() || null,
        street: document.getElementById('qc-cust-st')?.value.trim() || null,
        ward: document.getElementById('qc-cust-ward')?.value.trim() || null,
        city: document.getElementById('qc-cust-city')?.value.trim() || null,
        full_address: document.getElementById('qc-cust-full')?.value.trim() || null,
        source_dealer_id: document.getElementById('mc-dealer-select')?.value || null,
        source_channel: 'DEALER',
        created_by: actor,
        note: document.getElementById('qc-cust-note').value.trim() || null,
      };
      const r = await fetch('/api/end-customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      toast('success', 'Khách hàng', 'Đã tạo khách hàng');
      const mcCustSelect = document.getElementById('mc-cust-select');
      if (mcCustSelect) mcCustSelect.value = body.customer_id;
    } else if (_mcQuickMode === 'vehicle') {
      const body = {
        vehicle_id: document.getElementById('qc-veh-id').value.trim(),
        customer_id: document.getElementById('mc-cust-select').value || null,
        dealer_id: document.getElementById('mc-dealer-select').value || null,
        vehicle_model_code: document.getElementById('qc-veh-code').value.trim(),
        model_name: document.getElementById('qc-veh-model').value.trim(),
        vin_number: document.getElementById('qc-veh-vin').value.trim(),
        delivery_date: null,
        created_by: actor,
        note: document.getElementById('qc-veh-note').value.trim() || null,
      };
      const r = await fetch('/api/vehicles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      toast('success', 'Xe', 'Đã tạo hồ sơ xe');
      document.getElementById('mc-veh-select').value = body.vehicle_id;
    }
    const doneMode = _mcQuickMode;
    _closeQuickModal();
    if (['edit-dealer', 'edit-customer', 'create-norm', 'edit-norm'].includes(doneMode)) taiKhachHang();
    else taiTaoDonTay();
    if (['create-norm', 'edit-norm'].includes(doneMode)) await taiDinhMucPhim();
  } catch (e) {
    console.error('[modal-quick-ok]', e);
    toast('error', 'Lỗi lưu', e.message || String(e));
  }
});

document.getElementById('mc-btn-quick-dealer')?.addEventListener('click', async () => {
  _mcQuickMode = 'dealer';
  await ensureLocationProvincesLoaded();
  const sug = 'DEALER-Q-' + Date.now().toString().slice(-6);
  _openQuick(
    'Tạo đại lý nhanh',
    `
<div class="dyc-modal-form">
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Mã hệ thống (dealer_id)</label><input id="qc-dealer-id" value="${sug}" /></div>
    <div class="dyc-field">
      <label>Mã đại lý (dùng trong mã đơn) <span style="color:#1a6fc4">★</span></label>
      <input id="qc-dealer-code" placeholder="VD: LEX-SG, BKH, TOY-BT" style="font-weight:600" />
      <small style="color:#888">Ngắn gọn, không dấu, tiền tố mã đơn</small>
    </div>
  </div>
  <div class="dyc-field"><label>Tên đại lý</label><input id="qc-dealer-name" /></div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Tên pháp lý</label><input id="qc-dealer-legal" /></div>
    <div class="dyc-field"><label>Nhóm đại lý</label><input id="qc-dealer-group" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Số điện thoại</label><input id="qc-dealer-phone" /></div>
    <div class="dyc-field"><label>Ghi chú</label><input id="qc-dealer-note" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Số nhà / địa chỉ ngắn</label><input id="qc-dealer-ano" /></div>
    <div class="dyc-field"><label>Đường</label><input id="qc-dealer-st" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Phường / xã</label><input id="qc-dealer-ward" autocomplete="off" /></div>
    <div class="dyc-field"><label>Tỉnh / thành phố</label><input id="qc-dealer-city" autocomplete="off" /></div>
  </div>
  <div class="dyc-field"><label>Địa chỉ đầy đủ</label>
    <div class="dyc-inline-row">
      <input id="qc-dealer-full" class="dyc-grow" />
      <button type="button" class="btn btn-outline btn-sm" id="qc-dealer-rebuild-full" style="white-space:nowrap">Tự tạo lại</button>
    </div>
  </div>
</div>`,
    { wide: true },
  );
  setupEditorAddress('qc-dealer');
});
document.getElementById('mc-btn-quick-cust')?.addEventListener('click', async () => {
  _mcQuickMode = 'customer';
  await ensureLocationProvincesLoaded();
  const sug = 'CUS-Q-' + Date.now().toString().slice(-6);
  _openQuick(
    'Tạo khách hàng nhanh',
    `
<div class="dyc-modal-form">
  <div class="dyc-field"><label>Mã khách hàng</label><input id="qc-cust-id" value="${sug}" /></div>
  <div class="dyc-field"><label>Tên khách hàng</label><input id="qc-cust-mask" /></div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Số điện thoại</label><input id="qc-cust-phone" /></div>
    <div class="dyc-field"><label>Ghi chú</label><input id="qc-cust-note" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Số nhà / địa chỉ ngắn</label><input id="qc-cust-ano" /></div>
    <div class="dyc-field"><label>Đường</label><input id="qc-cust-st" /></div>
  </div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Phường / xã</label><input id="qc-cust-ward" autocomplete="off" /></div>
    <div class="dyc-field"><label>Tỉnh / thành phố</label><input id="qc-cust-city" autocomplete="off" /></div>
  </div>
  <div class="dyc-field"><label>Địa chỉ đầy đủ</label>
    <div class="dyc-inline-row">
      <input id="qc-cust-full" class="dyc-grow" />
      <button type="button" class="btn btn-outline btn-sm" id="qc-cust-rebuild-full" style="white-space:nowrap">Tự tạo lại</button>
    </div>
  </div>
</div>`,
    { wide: true },
  );
  setupEditorAddress('qc-cust');
});
document.getElementById('mc-btn-quick-veh')?.addEventListener('click', () => {
  _mcQuickMode = 'vehicle';
  const sug = 'VEH-Q-' + Date.now().toString().slice(-6);
  _openQuick(
    'Tạo xe nhanh',
    `
<div class="dyc-modal-form">
  <div class="dyc-field"><label>Mã xe</label><input id="qc-veh-id" value="${sug}" /></div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Mã dòng xe</label><input id="qc-veh-code" value="LEXUS_RX350" /></div>
    <div class="dyc-field"><label>Tên dòng xe</label><input id="qc-veh-model" value="Lexus RX350" /></div>
  </div>
  <div class="dyc-field"><label>Số VIN</label><input id="qc-veh-vin" /></div>
  <div class="dyc-field"><label>Ghi chú</label><input id="qc-veh-note" /></div>
</div>`,
    { wide: true },
  );
});

async function _mcRefreshSeqForDealer(dealerId) {
  const seqY = document.getElementById('mc-seq-year');
  const seqM = document.getElementById('mc-seq-month');
  const hint = document.getElementById('mc-seq-hint');
  if (!dealerId) {
    if (seqY) seqY.value = '';
    if (seqM) seqM.value = '';
    if (hint) hint.textContent = 'Chọn đại lý để hệ thống gợi ý số thứ tự tiếp theo.';
    return;
  }
  try {
    const tc = await fetch(`/api/ocr/tracking-counters?dealer_id=${encodeURIComponent(dealerId)}`).then((r) => r.json());
    if (seqY) seqY.value = tc.sequence_year_next != null ? String(tc.sequence_year_next) : '';
    if (seqM) seqM.value = tc.sequence_month_next != null ? String(tc.sequence_month_next) : '';
    if (hint) hint.textContent = `Đại lý ${dealerId}: xe thứ ${tc.sequence_year_next ?? '?'} trong năm, thứ ${tc.sequence_month_next ?? '?'} trong tháng.`;
  } catch (_) { /* ignore */ }
}

document.getElementById('mc-dealer-select')?.addEventListener('change', (e) => {
  const id = e.target.value;
  document.getElementById('mc-dealer-hint').textContent = id ? `Đã chọn: ${id}` : '';
  _mcRefreshSeqForDealer(id);
});
document.getElementById('mc-cust-select')?.addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) return;
  const c = normalizeListResponse(await fetch('/api/end-customers').then((r) => r.json())).items.find((x) => x.customer_id === id);
  if (c) {
    document.getElementById('mc-cust-masked').value = c.customer_masked || c.customer_name || '';
    document.getElementById('mc-phone-masked').value = c.phone_masked || '';
    document.getElementById('mc-addr-masked').value = c.address_masked || '';
  }
});
document.getElementById('mc-veh-select')?.addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) return;
  const v = normalizeListResponse(await fetch('/api/vehicles').then((r) => r.json())).items.find((x) => x.vehicle_id === id);
  if (v) {
    _mcEnsureVehicleModelOption(v.vehicle_model_code || '');
    document.getElementById('mc-veh-model').value = v.vehicle_model_code || '';
    document.getElementById('mc-vin-masked').value = v.vin_masked || '';
    if (v.model_year) document.getElementById('mc-model-year').value = String(v.model_year);
  }
  window.mcPreviewNorm?.();
});

const MC_JOB_LABEL_VI = {
  WINDSHIELD: 'Kính lái',
  REAR_WINDOW: 'Kính hậu',
  FRONT_SIDE: 'Sườn trước',
  REAR_SIDE_TRIANGLE: 'Sườn sau + tam giác',
  TRIANGLE: 'Tam giác',
  REAR_SIDE: 'Sườn sau',
  SUNROOF: 'Kính trời',
  PPF_BODY: 'BODY',
  PPF_SUNROOF: 'Sunroof',
  PPF_GLASS: 'Kính lái',
};

window._mcWfDefaults = window._mcWfDefaults || {};
window._mcPpfDefaults = window._mcPpfDefaults || {};

function _mcPpfNormSlice(norm, ji) {
  if (!norm) return { w: '', h: '', sz: '' };
  if (ji === 'PPF_BODY') {
    return { w: norm.windshield_width_cm, h: norm.windshield_length_cm, sz: norm.windshield_size };
  }
  if (ji === 'PPF_SUNROOF') {
    return { w: norm.sunroof_width_cm, h: norm.sunroof_length_cm, sz: norm.sunroof_size };
  }
  if (ji === 'PPF_GLASS') {
    return { w: norm.front_side_width_cm, h: norm.front_side_length_cm, sz: norm.front_side_size };
  }
  return { w: '', h: '', sz: '' };
}

function _mcPpfFmtDims(w, h, sz) {
  const wf = parseFloat(w);
  const hf = parseFloat(h);
  if (Number.isFinite(wf) && Number.isFinite(hf) && wf > 0 && hf > 0) {
    const a = wf === Math.floor(wf) ? String(Math.floor(wf)) : String(wf);
    const b = hf === Math.floor(hf) ? String(Math.floor(hf)) : String(hf);
    const raw = (sz && String(sz).trim()) || '';
    const display = raw || `${a} × ${b} cm`;
    return { display, w: wf, h: hf, rawSz: raw };
  }
  return { display: '—', w: '', h: '', rawSz: '' };
}

const _lotMaterialCodesCache = {};
async function _fetchLotMaterialCodes(filmType) {
  if (_lotMaterialCodesCache[filmType]) return _lotMaterialCodesCache[filmType];
  try {
    const res = await fetch(`/api/lots?film_type=${encodeURIComponent(filmType)}&limit=200`).then((r) => r.json());
    const items = res.items || res || [];
    const codes = [...new Set(items.map((l) => l.material_code).filter(Boolean))];
    _lotMaterialCodesCache[filmType] = codes;
    return codes;
  } catch (e) {
    console.warn('[_fetchLotMaterialCodes]', filmType, e);
    return [];
  }
}

async function mcRebuildWfDetail() {
  const wrap = document.getElementById('mc-wf-detail-wrap');
  const warnEl = document.getElementById('mc-wf-warn');
  if (!wrap) return;
  window._mcWfDefaults = {};
  if (!document.getElementById('mc-svc-wf')?.checked) {
    wrap.innerHTML = '';
    if (warnEl) {
      warnEl.style.display = 'none';
      warnEl.textContent = '';
    }
    return;
  }
  const checked = [...document.querySelectorAll('.mc-wf-item:checked')].map((x) => x.value);
  if (!checked.length) {
    wrap.innerHTML = '<p class="muted" style="margin:0">Chọn ít nhất một hạng mục kính.</p>';
    if (warnEl) warnEl.style.display = 'none';
    return;
  }
  const vmRaw = (document.getElementById('mc-veh-model')?.value || '').trim();
  const vm = (window.normalizeVehicleModelCode && window.normalizeVehicleModelCode(vmRaw)) || vmRaw;
  const my = (document.getElementById('mc-model-year')?.value || '').trim();
  const ft = (document.getElementById('mc-film-type')?.value || 'Phim cách nhiệt').trim();
  const normMap = {};
  if (vm) {
    try {
      let q = `vehicle_model_code=${encodeURIComponent(vm)}&film_type=${encodeURIComponent(ft)}`;
      if (my) q += `&model_year=${encodeURIComponent(my)}`;
      const res = await fetch(`/api/vehicle-norms/resolve?${q}`).then((r) => r.json());
      (res.auto_fill_items || []).forEach((it) => {
        normMap[it.job_item] = it;
      });
    } catch (e) {
      console.warn('[mcRebuildWfDetail] norm resolve', e);
    }
  }
  const wfInventoryCodes = await _fetchLotMaterialCodes('WINDOW_FILM');
  let anyMiss = false;
  const rows = await Promise.all(
    checked.map(async (ji) => {
      let pr = {};
      try {
        pr = await fetch(`/api/material-preferences/resolve?${new URLSearchParams({ film_type: ft, job_item: ji })}`).then((r) => r.json());
      } catch (e) {
        console.warn('[mcRebuildWfDetail] material resolve', ji, e);
      }
      const nm = normMap[ji] || {};
      const defMc = ((nm.material_code != null && String(nm.material_code).trim()) || (pr.preferred_material_code || '').trim() || '');
      window._mcWfDefaults[ji] = defMc;
      const opts = new Set((pr.options || []).map((o) => o.material_code).filter(Boolean));
      if (defMc) opts.add(defMc);
      wfInventoryCodes.forEach((c) => opts.add(c));
      const optHtml = [...opts]
        .filter(Boolean)
        .map((c) => `<option value="${_esc(c)}"${c === defMc ? ' selected' : ''}>${_esc(c)}</option>`)
        .join('');
      const sz = nm.size || '—';
      const w = nm.width_cm != null && nm.width_cm !== '' ? nm.width_cm : '';
      const h = nm.length_cm != null && nm.length_cm !== '' ? nm.length_cm : '';
      const src = (nm.material_source || (pr.found ? 'MATERIAL_PREFERENCE' : 'MISSING_PREFERENCE') || '').trim();
      if (src === 'MISSING_PREFERENCE' || (!pr.found && !defMc)) anyMiss = true;
      const lab = MC_JOB_LABEL_VI[ji] || ji;
      return `<tr data-job-item="${_esc(ji)}">
        <td><strong>${_esc(lab)}</strong><br/><small class="muted">${_esc(ji)}</small></td>
        <td>${_esc(String(sz))}
          <input type="hidden" class="mc-wf-size" value="${_esc(String(nm.size || ''))}" />
          <input type="hidden" class="mc-wf-w" value="${_esc(String(w))}" />
          <input type="hidden" class="mc-wf-h" value="${_esc(String(h))}" /></td>
        <td><select class="mc-wf-mat field-input" data-default="${_esc(defMc)}" style="font-size:11px;max-width:140px">${optHtml}</select></td>
        <td><span class="mc-wf-src">${_esc(src)}</span></td>
        <td><input type="text" class="mc-wf-note field-input" placeholder="Ghi chú nếu đổi mã" style="font-size:11px;width:100%;min-width:100px" /></td>
      </tr>`;
    }),
  );
  wrap.innerHTML = `<div style="overflow-x:auto"><table class="data-table" style="font-size:11px"><thead><tr>
    <th>Hạng mục</th><th>Kích thước định mức</th><th>Mã vật tư</th><th>Nguồn</th><th>Ghi chú đổi mã</th>
  </tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  if (warnEl) {
    if (anyMiss) {
      warnEl.style.display = 'block';
      warnEl.textContent =
        'Chưa cấu hình vật tư ưu tiên cho một số hạng mục — vui lòng cập nhật Quản lý kho → Vật tư ưu tiên, hoặc chọn mã thủ công.';
    } else {
      warnEl.style.display = 'none';
      warnEl.textContent = '';
    }
  }
}

async function mcRebuildPpfDetail() {
  const wrap = document.getElementById('mc-ppf-detail-wrap');
  const warnEl = document.getElementById('mc-ppf-warn');
  if (!wrap) return;
  window._mcPpfDefaults = {};
  if (!document.getElementById('mc-svc-ppf')?.checked) {
    wrap.innerHTML = '';
    if (warnEl) {
      warnEl.style.display = 'none';
      warnEl.textContent = '';
    }
    return;
  }
  const checked = [...document.querySelectorAll('.mc-ppf-item:checked')].map((x) => x.value);
  if (!checked.length) {
    wrap.innerHTML = '<p class="muted" style="margin:0">Chọn ít nhất một hạng mục PPF.</p>';
    if (warnEl) warnEl.style.display = 'none';
    return;
  }
  const vmRaw = (document.getElementById('mc-veh-model')?.value || '').trim();
  const vm = (window.normalizeVehicleModelCode && window.normalizeVehicleModelCode(vmRaw)) || vmRaw;
  const my = (document.getElementById('mc-model-year')?.value || '').trim();
  const ppfMat = (document.getElementById('mc-ppf-type')?.value || 'T-TYPE').trim();
  let norm = null;
  if (vm) {
    try {
      let q = `vehicle_model_code=${encodeURIComponent(vm)}&film_type=${encodeURIComponent('PPF')}`;
      if (my) q += `&model_year=${encodeURIComponent(my)}`;
      const res = await fetch(`/api/vehicle-norms/resolve?${q}`).then((r) => r.json());
      if (res.found && res.norm) norm = res.norm;
    } catch (e) {
      console.warn('[mcRebuildPpfDetail] norm resolve', e);
    }
  }
  const ppfInventoryCodes = await _fetchLotMaterialCodes('PPF');
  let anyMiss = false;
  const rows = await Promise.all(
    checked.map(async (ji) => {
      const sl = _mcPpfNormSlice(norm, ji);
      const dim = _mcPpfFmtDims(sl.w, sl.h, sl.sz);
      let pr = {};
      try {
        const ps = new URLSearchParams({ film_type: 'PPF', job_item: ji });
        if (ji === 'PPF_BODY' && ppfMat) ps.set('ppf_material', ppfMat);
        pr = await fetch(`/api/material-preferences/resolve?${ps}`).then((r) => r.json());
      } catch (e) {
        console.warn('[mcRebuildPpfDetail] material resolve', ji, e);
      }
      const defMc = ((pr.preferred_material_code || '').trim() || '');
      window._mcPpfDefaults[ji] = defMc;
      const opts = new Set((pr.options || []).map((o) => o.material_code).filter(Boolean));
      if (defMc) opts.add(defMc);
      ppfInventoryCodes.forEach((c) => opts.add(c));
      const optHtml = [...opts]
        .filter(Boolean)
        .map((c) => `<option value="${_esc(c)}"${c === defMc ? ' selected' : ''}>${_esc(c)}</option>`)
        .join('');
      const src = (pr.found ? 'MATERIAL_PREFERENCE' : 'MISSING_PREFERENCE').trim();
      if (!pr.found && !defMc) anyMiss = true;
      const lab = MC_JOB_LABEL_VI[ji] || ji;
      return `<tr data-job-item="${_esc(ji)}">
        <td><strong>${_esc(lab)}</strong><br/><small class="muted">${_esc(ji)}</small></td>
        <td>${_esc(String(dim.display))}
          <input type="hidden" class="mc-ppf-size" value="${_esc(String(dim.rawSz || dim.display || ''))}" />
          <input type="hidden" class="mc-ppf-w" value="${_esc(String(dim.w === '' ? '' : dim.w))}" />
          <input type="hidden" class="mc-ppf-h" value="${_esc(String(dim.h === '' ? '' : dim.h))}" /></td>
        <td><select class="mc-ppf-mat field-input" data-default="${_esc(defMc)}" style="font-size:11px;max-width:140px">${optHtml}</select></td>
        <td><span class="mc-ppf-src">${_esc(src)}</span></td>
        <td><input type="text" class="mc-ppf-note field-input" placeholder="Ghi chú nếu đổi mã" style="font-size:11px;width:100%;min-width:100px" /></td>
      </tr>`;
    }),
  );
  wrap.innerHTML = `<div style="overflow-x:auto"><table class="data-table" style="font-size:11px"><thead><tr>
    <th>Hạng mục</th><th>Kích thước định mức</th><th>Mã vật tư</th><th>Nguồn</th><th>Ghi chú đổi mã</th>
  </tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  if (warnEl) {
    if (anyMiss) {
      warnEl.style.display = 'block';
      warnEl.textContent =
        'Chưa cấu hình vật tư ưu tiên PPF cho một số hạng mục — vui lòng cập nhật Quản lý kho → Vật tư ưu tiên, hoặc chọn mã thủ công.';
    } else {
      warnEl.style.display = 'none';
      warnEl.textContent = '';
    }
  }
}

async function mcRebuildGlDetail() {
  const wrap = document.getElementById('mc-gl-detail-wrap');
  const warnEl = document.getElementById('mc-gl-warn');
  if (!wrap) return;
  if (!document.getElementById('mc-svc-gl')?.checked) {
    wrap.innerHTML = '';
    if (warnEl) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
    return;
  }
  const checked = [...document.querySelectorAll('.mc-gl-item:checked')].map((x) => x.value);
  if (!checked.length) {
    wrap.innerHTML = '<p class="muted" style="margin:0">Chọn ít nhất một vị trí kính cường lực.</p>';
    if (warnEl) warnEl.style.display = 'none';
    return;
  }
  const GL_LABEL = { GL_WINDSHIELD: 'Kính lái', GL_REAR: 'Kính hậu', GL_SUNROOF: 'Kính trời' };
  const vmRaw = (document.getElementById('mc-veh-model')?.value || '').trim();
  const vm = (window.normalizeVehicleModelCode && window.normalizeVehicleModelCode(vmRaw)) || vmRaw;
  const my = (document.getElementById('mc-model-year')?.value || '').trim();
  const normMap = {};
  if (vm) {
    try {
      let q = `vehicle_model_code=${encodeURIComponent(vm)}&film_type=${encodeURIComponent('Cường lực')}`;
      if (my) q += `&model_year=${encodeURIComponent(my)}`;
      const res = await fetch(`/api/vehicle-norms/resolve?${q}`).then((r) => r.json());
      (res.auto_fill_items || []).forEach((it) => { normMap[it.job_item] = it; });
    } catch (e) { console.warn('[mcRebuildGlDetail] norm resolve', e); }
  }
  const glInventoryCodes = await _fetchLotMaterialCodes('GLASS_FILM');
  window._mcGlDefaults = {};
  const rows = checked.map((ji) => {
    const nm = normMap[ji] || {};
    const sz = nm.size || '—';
    const lab = GL_LABEL[ji] || ji;
    const defMc = (nm.material_code || '').trim() || (glInventoryCodes[0] || '');
    window._mcGlDefaults[ji] = defMc;
    const opts = new Set(glInventoryCodes);
    if (defMc) opts.add(defMc);
    const optHtml = [...opts].filter(Boolean)
      .map((c) => `<option value="${_esc(c)}"${c === defMc ? ' selected' : ''}>${_esc(c)}</option>`)
      .join('') || `<option value="">—</option>`;
    return `<tr data-job-item="${_esc(ji)}">
      <td><strong>${_esc(lab)}</strong><br/><small class="muted">${_esc(ji)}</small></td>
      <td>${_esc(String(sz))}</td>
      <td><select class="mc-gl-mat field-input" data-default="${_esc(defMc)}" style="font-size:11px;max-width:140px">${optHtml}</select></td>
    </tr>`;
  });
  wrap.innerHTML = `<div style="overflow-x:auto"><table class="data-table" style="font-size:11px"><thead><tr>
    <th>Vị trí</th><th>Kích thước định mức</th><th>Mã vật tư</th>
  </tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  if (warnEl) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
}

async function mcPreviewNorm() {
  const box = document.getElementById('mc-norm-preview');
  if (!document.getElementById('mc-svc-wf')?.checked) {
    if (box) box.innerHTML = '';
  } else {
    const vmRaw = (document.getElementById('mc-veh-model')?.value || '').trim();
    const vm = (window.normalizeVehicleModelCode && window.normalizeVehicleModelCode(vmRaw)) || vmRaw;
    if (!vm) {
      if (box) box.innerHTML = '';
    } else {
      const my = (document.getElementById('mc-model-year')?.value || '').trim();
      const ft = (document.getElementById('mc-film-type')?.value || 'Phim cách nhiệt').trim();
      let q = `vehicle_model_code=${encodeURIComponent(vm)}&film_type=${encodeURIComponent(ft)}`;
      if (my) q += `&model_year=${encodeURIComponent(my)}`;
      if (box) {
        try {
          const res = await fetch(`/api/vehicle-norms/resolve?${q}`).then(r => r.json());
          if (res.found) {
            const rows = (res.auto_fill_items || []).map((i) => {
              const src = i.material_source
                ? ` <small class="muted">(${_esc(materialSourceVi(i.material_source))})</small>`
                : '';
              return `${_esc(_wfJobLabelVi(i.job_item))} ${_esc(i.material_code || '—')} ${_esc(i.size || '')}${src}`;
            }).join('<br/>');
            box.innerHTML = `<strong>Định mức &amp; vật tư gợi ý</strong> (${_esc(res.norm_id || res.norm?.norm_id || '')})<br/>${rows}`;
          } else {
            box.innerHTML = '<span style="color:var(--orange)">Chưa có định mức ACTIVE. Cập nhật tại Khách hàng → Hồ sơ xe → Định mức phim.</span>';
          }
        } catch (err) {
          box.textContent = 'Không gọi được API resolve.';
          console.warn(err);
        }
      }
    }
  }
  await mcRebuildWfDetail();
  await mcRebuildPpfDetail();
  await mcRebuildGlDetail();
}
window.mcPreviewNorm = mcPreviewNorm;
['mc-veh-model', 'mc-model-year', 'mc-svc-wf', 'mc-svc-gl'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => mcPreviewNorm());
  document.getElementById(id)?.addEventListener('input', () => { clearTimeout(window._mcNormT); window._mcNormT = setTimeout(mcPreviewNorm, 400); });
});
document.querySelectorAll('.mc-gl-item').forEach(cb => {
  cb.addEventListener('change', () => mcRebuildGlDetail());
});

function _mcUpdateTeamVisibility() {
  const ppf = document.getElementById('mc-svc-ppf')?.checked || false;
  const wf  = document.getElementById('mc-svc-wf')?.checked  || false;
  const gl  = document.getElementById('mc-svc-gl')?.checked  || false;
  const fm  = document.getElementById('mc-svc-fm')?.checked  || false;
  const anySelected = ppf || wf || gl || fm;
  const stepEl = document.getElementById('mc-step-team');
  if (stepEl) stepEl.style.display = anySelected ? '' : 'none';
  const show = (id, visible) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
  };
  show('mc-team-field-ppf', ppf);
  show('mc-team-field-wf',  wf);
  show('mc-team-field-gl',  gl);
  show('mc-team-field-fm',  fm);
}

['mc-svc-ppf', 'mc-svc-wf', 'mc-svc-gl', 'mc-svc-fm'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', _mcUpdateTeamVisibility);
});

document.getElementById('mc-btn-submit')?.addEventListener('click', async () => {
  const dealer = document.getElementById('mc-dealer-select').value;
  if (!dealer) { toast('warning', 'Thiếu đại lý', 'Chọn hoặc tạo đại lý nhanh'); return; }
  const vmRaw = document.getElementById('mc-veh-model').value.trim();
  const vm = (window.normalizeVehicleModelCode && window.normalizeVehicleModelCode(vmRaw)) || vmRaw;
  if (!vm) { toast('warning', 'Thiếu dòng xe', 'Chọn dòng xe trong danh sách định mức phim cách nhiệt'); return; }
  const ppf = document.getElementById('mc-svc-ppf').checked;
  const wf = document.getElementById('mc-svc-wf').checked;
  const gl = document.getElementById('mc-svc-gl')?.checked || false;
  const fm = document.getElementById('mc-svc-fm')?.checked || false;
  if (!ppf && !wf && !gl && !fm) { toast('warning', 'Dịch vụ', 'Chọn ít nhất một dịch vụ'); return; }
  if (ppf && !document.getElementById('mc-ppf-type').value) { toast('warning', 'PPF', 'Chọn loại PPF'); return; }
  const wfItems = [...document.querySelectorAll('.mc-wf-item:checked')].map((x) => x.value);
  let windowFilmItems = wfItems;
  const material_overrides = {};
  const gReason = (document.getElementById('mc-mat-override-reason')?.value || '').trim();
  if (wf) {
    const rowEls = document.querySelectorAll('#mc-wf-detail-wrap tr[data-job-item]');
    if (rowEls.length) {
      windowFilmItems = [];
      rowEls.forEach((tr) => {
        const ji = tr.getAttribute('data-job-item');
        const sel = tr.querySelector('.mc-wf-mat');
        const mc = (sel?.value || '').trim();
        const def = ((sel?.getAttribute('data-default') || window._mcWfDefaults[ji] || '') + '').trim();
        const rowNote = (tr.querySelector('.mc-wf-note')?.value || '').trim();
        if (mc && def && mc !== def) material_overrides[ji] = rowNote || gReason;
        const wRaw = (tr.querySelector('.mc-wf-w')?.value || '').trim();
        const hRaw = (tr.querySelector('.mc-wf-h')?.value || '').trim();
        const w = wRaw === '' ? undefined : parseFloat(wRaw);
        const h = hRaw === '' ? undefined : parseFloat(hRaw);
        const sz = (tr.querySelector('.mc-wf-size')?.value || '').trim();
        const src = (tr.querySelector('.mc-wf-src')?.textContent || '').trim() || 'MATERIAL_PREFERENCE';
        windowFilmItems.push({
          job_item: ji,
          size: sz || undefined,
          width_cm: Number.isFinite(w) ? w : undefined,
          length_cm: Number.isFinite(h) ? h : undefined,
          material_code: mc || undefined,
          material_source: src,
        });
      });
      for (const ji of Object.keys(material_overrides)) {
        if (!material_overrides[ji]) {
          toast('warning', 'Thiếu lý do', `Đổi mã vật tư (${ji}): nhập ghi chú dòng hoặc lý do chung.`);
          return;
        }
      }
    }
  }
  let glFilmItems = undefined;
  if (gl) {
    const glChk = [...document.querySelectorAll('.mc-gl-item:checked')].map((x) => x.value);
    if (!glChk.length) { toast('warning', 'Cường lực', 'Chọn ít nhất một vị trí kính cường lực.'); return; }
    glFilmItems = glChk.map((ji) => ({ job_item: ji, material_code: 'GL-TYPE' }));
  }
  let fmPlan = undefined;
  if (fm) {
    fmPlan = mcGetFmPlan();
    if (!fmPlan.length) { toast('warning', 'Thảm sàn', 'Nhập số lượng ít nhất 1 SKU thảm sàn.'); return; }
  }
  let ppfFilmItems = undefined;
  if (ppf) {
    const ppfChk = [...document.querySelectorAll('.mc-ppf-item:checked')].map((x) => x.value);
    if (!ppfChk.length) {
      toast('warning', 'PPF', 'Chọn ít nhất một hạng mục PPF (BODY / Sunroof / Kính lái).');
      return;
    }
    ppfFilmItems = [];
    document.querySelectorAll('#mc-ppf-detail-wrap tr[data-job-item]').forEach((tr) => {
      const ji = tr.getAttribute('data-job-item');
      const sel = tr.querySelector('.mc-ppf-mat');
      const mc = (sel?.value || '').trim();
      const rowNote = (tr.querySelector('.mc-ppf-note')?.value || '').trim();
      const wRaw = (tr.querySelector('.mc-ppf-w')?.value || '').trim();
      const hRaw = (tr.querySelector('.mc-ppf-h')?.value || '').trim();
      const w = wRaw === '' ? undefined : parseFloat(wRaw);
      const h = hRaw === '' ? undefined : parseFloat(hRaw);
      const sz = (tr.querySelector('.mc-ppf-size')?.value || '').trim();
      const src = (tr.querySelector('.mc-ppf-src')?.textContent || '').trim() || 'MATERIAL_PREFERENCE';
      ppfFilmItems.push({
        job_item: ji,
        size: sz || undefined,
        width_cm: Number.isFinite(w) ? w : undefined,
        length_cm: Number.isFinite(h) ? h : undefined,
        material_code: mc || undefined,
        material_source: src,
        code_change_note: rowNote || undefined,
      });
    });
  }
  const sla = (document.getElementById('mc-sla-note')?.value || '').trim();
  const baseNote = document.getElementById('mc-note').value.trim();
  const noteMerged = [baseNote, sla ? `SLA: ${sla}` : ''].filter(Boolean).join(' | ') || undefined;
  const payload = {
    dealer_id: dealer,
    customer_id: document.getElementById('mc-cust-select').value || undefined,
    customer_masked: document.getElementById('mc-cust-masked').value.trim() || undefined,
    phone_masked: document.getElementById('mc-phone-masked').value.trim() || undefined,
    address_masked: document.getElementById('mc-addr-masked').value.trim() || undefined,
    vehicle_id: document.getElementById('mc-veh-select').value || undefined,
    vehicle_model: vm,
    vin_masked: document.getElementById('mc-vin-masked').value.trim() || undefined,
    plate_number: (document.getElementById('mc-plate')?.value || '').trim() || undefined,
    requested_delivery_at: _mcIsoDelivery() || undefined,
    service_selection: {
      include_ppf: ppf,
      ppf_type: document.getElementById('mc-ppf-type').value,
      include_window_film: wf,
      window_film_items: windowFilmItems,
      film_type: document.getElementById('mc-film-type')?.value || 'Phim cách nhiệt',
      include_glass_film: gl,
      glass_film_items: Array.isArray(glFilmItems) ? glFilmItems : undefined,
      include_floor_mat: fm,
      floor_mat_items: Array.isArray(fmPlan) ? fmPlan : undefined,
      ...(Array.isArray(ppfFilmItems) && ppfFilmItems.length ? { ppf_film_items: ppfFilmItems } : {}),
    },
    model_year: (() => {
      const v = document.getElementById('mc-model-year')?.value;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : undefined;
    })(),
    film_type: document.getElementById('mc-film-type')?.value || undefined,
    continue_without_norm: false,
    material_overrides: Object.keys(material_overrides).length ? material_overrides : undefined,
    material_override_reason: gReason || undefined,
    assigned_teams: {
      ppf_team: document.getElementById('mc-team-ppf').value,
      window_film_team: document.getElementById('mc-team-wf').value,
      glass_film_team: document.getElementById('mc-team-gl')?.value || 'GLASS_FILM_TEAM_A',
      floor_mat_team: document.getElementById('mc-team-fm')?.value || 'FLOOR_MAT_TEAM_A',
    },
    sequence_no: (() => { const v = document.getElementById('mc-seq-year')?.value; const n = parseInt(v, 10); return Number.isFinite(n) ? String(n) : undefined; })(),
    sequence_no_month: (() => { const v = document.getElementById('mc-seq-month')?.value; const n = parseInt(v, 10); return Number.isFinite(n) ? String(n) : undefined; })(),
    created_by: 'AD-001',
    note: noteMerged,
  };
  try {
    const r = await fetch('/api/requests/manual-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || JSON.stringify(data));
    toast('success', 'Đã tạo đơn', 'Đơn thủ công thành công');
    if (data.request_id) chuyenDenDon(data.request_id);
  } catch (e) { toast('error', 'Lỗi tạo đơn', e.message); }
});
document.getElementById('mc-btn-draft')?.addEventListener('click', () => {
  localStorage.setItem('mc_draft', JSON.stringify({ note: document.getElementById('mc-note').value }));
  toast('info', 'Nháp', 'Đã lưu localStorage (demo)');
});
document.getElementById('mc-btn-reset')?.addEventListener('click', () => {
  document.getElementById('mc-note').value = '';
  document.getElementById('mc-cust-masked').value = '';
  document.getElementById('mc-phone-masked').value = '';
  document.getElementById('mc-addr-masked').value = '';
  document.getElementById('mc-plate').value = '';
  document.getElementById('mc-mat-override-reason').value = '';
  document.getElementById('mc-sla-note').value = '';
    fillDefaultDateTimes();
  toast('info', 'Làm mới form', 'Đã xóa các trường nhập tay (không đổi danh mục đã chọn).');
  mcPreviewNorm();
  _mcUpdateTeamVisibility();
  const curDealer = document.getElementById('mc-dealer-select')?.value || '';
  _mcRefreshSeqForDealer(curDealer);
});

// ─── TELEGRAM (Admin) + deep link từ URL (?tab=&request_id=…) ─────────────────
async function taiTelegramIntegrations() {
  const st = document.getElementById('telegram-status-body');
  const tb = document.getElementById('table-telegram-logs-body');
  if (!st || !tb) return;
  try {
    const s = await fetch('/api/integrations/telegram/status', { credentials: 'same-origin' }).then((r) => {
      if (r.status === 403) throw new Error('Chỉ Admin xem được cấu hình Telegram.');
      return r.json();
    });
    st.innerHTML = `
      <div><strong>Group hiển thị:</strong> ${_esc(s.group_display_name || '—')}</div>
      <div><strong>TELEGRAM_ENABLED:</strong> ${s.telegram_enabled ? 'true' : 'false'}</div>
      <div><strong>Đã cấu hình bot token:</strong> ${s.has_bot_token ? 'Có' : 'Chưa'}</div>
      <div><strong>Đã cấu hình chat_id nhóm:</strong> ${s.has_group_chat_id ? 'Có' : 'Chưa'}</div>
      <div><strong>DYC_PUBLIC_BASE_URL:</strong> ${s.public_base_url_configured ? 'Đã set' : 'Chưa set'}</div>`;
  } catch (e) {
    st.textContent = e.message || String(e);
  }
  try {
    const logs = await fetch('/api/integrations/telegram/message-logs?limit=80', { credentials: 'same-origin' }).then((r) => {
      if (r.status === 403) throw new Error('Chỉ Admin.');
      return r.json();
    });
    const rows = (logs.items || []).map((it) => `
      <tr>
        <td>${it.id}</td>
        <td>${_esc(it.event_type)}</td>
        <td>${_esc(it.send_status)}</td>
        <td><small>${_esc(it.request_id || '')}</small></td>
        <td><small>${_esc(it.workstream_id || '')}</small></td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis" title="${_esc(it.dedupe_key || '')}"><small>${_esc(it.dedupe_key || '')}</small></td>
        <td style="max-width:200px;font-size:11px">${_esc(it.message_preview || '')}</td>
        <td><small>${_esc(it.created_at || '')}</small></td>
        <td>${it.send_status === 'FAILED' ? `<button type="button" class="btn btn-outline btn-sm" data-tg-retry="${it.id}">Gửi lại</button>` : ''}</td>
      </tr>`).join('');
    tb.innerHTML = rows || '<tr><td colspan="9" class="muted">Chưa có log.</td></tr>';
    tb.querySelectorAll('[data-tg-retry]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-tg-retry');
        try {
          const r = await fetch(`/api/integrations/telegram/retry/${encodeURIComponent(id)}`, {
            method: 'POST',
            credentials: 'same-origin',
          }).then((x) => x.json());
          toast(r.ok ? 'success' : 'warning', 'Telegram', r.detail || r.send_status || JSON.stringify(r));
          await taiTelegramIntegrations();
        } catch (e) {
          toast('error', 'Telegram', e.message);
        }
      });
    });
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="9">${_esc(e.message || String(e))}</td></tr>`;
  }
}

const DYC_VALID_TAB_NAMES = new Set([
  'dashboard', 'ocr', 'norms', 'manual', 'customers', 'requests', 'workstreams', 'jobcards',
  'lots', 'inventory', 'offcuts', 'monthly', 'audit', 'integrations', 'hr',
]);

async function dycApplyDeepLinkFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const tab = (p.get('tab') || '').trim();
  if (!tab || !DYC_VALID_TAB_NAMES.has(tab)) return;
  const requestId = (p.get('request_id') || '').trim();
  const workstreamId = (p.get('workstream_id') || '').trim();
  const jobCardId = (p.get('job_card_id') || '').trim();
  const month = (p.get('month') || '').trim();
  if (tab === 'requests' && requestId) {
    chuyenDenDon(requestId);
    return;
  }
  if (tab === 'workstreams' && workstreamId) {
    try {
      const ws = await fetchJSON(`/api/workstreams/${encodeURIComponent(workstreamId)}`);
      if (ws && ws.request_id) {
        chuyenDenDon(ws.request_id);
        setTimeout(() => {
          if (typeof window.scrollToWsDetail === 'function') window.scrollToWsDetail(workstreamId);
        }, 700);
        return;
      }
    } catch (e) {
      console.warn('deep link workstream', e);
    }
    document.querySelector('[data-tab="workstreams"]')?.click();
    return;
  }
  if (tab === 'jobcards' && jobCardId) {
    try {
      const jc = await fetchJSON(`/api/job-cards/${encodeURIComponent(jobCardId)}`);
      if (jc && jc.request_id) chuyenDenDon(jc.request_id);
    } catch (e) {
      console.warn('deep link jobcard', e);
    }
    document.querySelector('[data-tab="jobcards"]')?.click();
    return;
  }
  if (tab === 'monthly' && month) {
    window.__DYC_MONTHLY_URL_MONTH__ = month;
  }
  const btn = document.querySelector(`.nav-tab[data-tab="${tab}"]`);
  if (btn) btn.click();
}

// ─── ĐIỀU HƯỚNG ──────────────────────────────────────────────────────────────
const tabLoaders = {
  dashboard: taiTongQuan,
  ocr: taiDanhSachOcr,
  norms: taiDinhMucPhim,
  manual: taiTaoDonTay,
  customers: taiKhachHang,
  requests: taiDonThiCong,
  workstreams: taiBangLuong,
  jobcards: taiLenhThiCong,
  lots: taiKhoLot,
  inventory: taiQuanLyKho,
  offcuts: taiManhDu,
  floormats: loadFloorMats,
  monthly: taiBangBaoCaoThangTab,
  audit: taiNhatKy,
  integrations: async () => {
    await taiTelegramIntegrations();
  },
  hr: async () => {
    if (typeof window.taiNhanSu === 'function') await window.taiNhanSu();
    if (typeof applyDycUserChrome === 'function') applyDycUserChrome();
  },
};

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const pane = document.getElementById(`tab-${tab.dataset.tab}`);
    if (pane) pane.classList.add('active');
    if (tabLoaders[tab.dataset.tab]) tabLoaders[tab.dataset.tab]();
    document.getElementById('nav-links').classList.remove('mobile-open');
  });
});
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('nav-links').classList.toggle('mobile-open');
});

document.getElementById('btn-telegram-refresh')?.addEventListener('click', () => { void taiTelegramIntegrations(); });
document.getElementById('btn-telegram-logs-refresh')?.addEventListener('click', () => { void taiTelegramIntegrations(); });
document.getElementById('btn-telegram-test')?.addEventListener('click', async () => {
  try {
    const r = await fetch('/api/integrations/telegram/test-group-message', {
      method: 'POST',
      credentials: 'same-origin',
    }).then((x) => x.json());
    toast(r.ok ? 'success' : 'warning', 'Telegram', r.detail || r.send_status || JSON.stringify(r));
    await taiTelegramIntegrations();
  } catch (e) {
    toast('error', 'Telegram', e.message || String(e));
  }
});

window.adminReset = async function(level) {
  const token = (document.getElementById('reset-admin-token')?.value || '').trim();
  if (!token) { toast('warning', 'Reset', 'Vui lòng nhập Admin Token trước.'); return; }
  const ENDPOINT = {
    l1: '/api/admin/clear-logs',
    l2: '/api/admin/clear-operational-data',
    l3: '/api/admin/reset-database-standard-seed',
  }[level];
  const LABEL = { l1: 'Xóa Logs', l2: 'Xóa vận hành', l3: 'Full Reset' }[level];
  const confirm_msg = level === 'l3'
    ? 'FULL RESET sẽ xóa TOÀN BỘ dữ liệu và seed lại demo. Không thể hoàn tác.\n\nBạn chắc chắn?'
    : `${LABEL}: Bạn chắc chắn muốn thực hiện?`;
  if (!confirm(confirm_msg)) return;
  const resultEl = document.getElementById('reset-result');
  resultEl.style.display = 'block';
  resultEl.style.color = 'var(--text-secondary)';
  resultEl.textContent = `Đang thực hiện ${LABEL}...`;
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Admin-Reset-Token': token },
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || JSON.stringify(data));
    resultEl.style.color = 'var(--green)';
    const deleted = data.deleted ? ' | ' + Object.entries(data.deleted).map(([k,v])=>`${k}: ${v}`).join(', ') : '';
    resultEl.textContent = `✓ ${data.message || LABEL + ' hoàn tất'}${deleted}`;
    toast('success', LABEL, data.message || 'Hoàn tất');
    if (typeof taiTongQuan === 'function') await taiTongQuan();
  } catch(e) {
    resultEl.style.color = '#ef4444';
    resultEl.textContent = `Lỗi: ${e.message}`;
    toast('error', LABEL, e.message);
  }
};

document.querySelectorAll('.monthly-subtab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const sub = btn.getAttribute('data-monthly-sub') || 'monthly';
    setMonthlySubtab(sub);
    void taiBangBaoCaoThangTab();
  });
});
document.getElementById('btn-daily-report-view')?.addEventListener('click', () => { void loadDailyReport(); });
document.getElementById('btn-daily-report-refresh')?.addEventListener('click', () => { void loadDailyReport(); });
document.getElementById('btn-daily-report-html')?.addEventListener('click', () => {
  const inp = document.getElementById('daily-report-date');
  const d = (inp && inp.value) ? inp.value.trim() : dycIsoDateVietnam();
  window.location.href = `/api/reports/daily/export-html?date=${encodeURIComponent(d)}`;
});

document.getElementById('dyc-fab-notif')?.addEventListener('click', () => {
  document.getElementById('btn-notif-bell')?.click();
});
document.getElementById('dyc-fab-reports')?.addEventListener('click', () => {
  document.querySelector('.nav-tab[data-tab="monthly"]')?.click();
});
document.getElementById('dyc-fab-telegram')?.addEventListener('click', () => {
  document.querySelector('.nav-tab[data-tab="integrations"]')?.click();
});

// ─── MODAL DEMO ───────────────────────────────────────────────────────────────
async function chayDemoModal(requestId) {
  const overlay = document.getElementById('demo-modal-overlay');
  const log = document.getElementById('demo-steps-log');
  const footer = document.getElementById('demo-modal-footer');
  overlay.style.display = 'flex';
  footer.style.display = 'none';
  log.innerHTML = `<div class="demo-step-item running"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Đang khởi động demo đa luồng cho <strong>${requestId}</strong>...</span></div>`;
  try {
    const data = await fetch(`/api/demo/run-all/${requestId}`, { method: 'POST' }).then(r => r.json());
    const nhanBuoc = { 'WF2_STANDARDIZE':'Chuẩn hóa thông tin', 'WF3_NORM':'Tra định mức cắt', 'WF4_ALLOCATE':'Phân bổ vật tư', 'WF5_APPROVE_ALL':'Phê duyệt tất cả luồng', 'START_PPF':'Đội PPF bắt đầu thi công', 'COMPLETE_PPF':'Đội PPF hoàn tất — Trừ kho', 'START_WIN':'Đội Cách Nhiệt bắt đầu', 'COMPLETE_WIN':'Đội Cách Nhiệt hoàn tất — Trừ kho', 'WF6_COMPLETE':'Kỹ thuật viên hoàn tất' };
    if (data.steps_executed && data.steps_executed.length > 0) {
      log.innerHTML = data.steps_executed.map((s, i) => `
        <div class="demo-step-item success" style="animation-delay:${i*0.08}s">
          <i class="fa-solid fa-circle-check"></i>
          <span><strong>[${nhanBuoc[s.step] || s.step}]</strong> ${s.result}</span>
        </div>`).join('');
    }
    const tstVI = TRANG_THAI_VI[data.final_status] || data.final_status;
    log.innerHTML += `
      <div class="demo-step-item" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-weight:700;color:var(--green-light)">
        <i class="fa-solid fa-flag-checkered"></i>
        <span>Trạng thái cuối: <strong>${tstVI}</strong> (${data.final_status})</span>
      </div>`;
  } catch(e) {
    log.innerHTML = `<div class="demo-step-item error"><i class="fa-solid fa-xmark"></i><span>Lỗi kết nối: ${e.message}</span></div>`;
  }
  footer.style.display = 'flex';
  taiTongQuan(); taiThongBao();
}

document.getElementById('btn-global-demo').addEventListener('click', () => chayDemoModal('REQ-20260604-001'));
const dash2 = document.getElementById('btn-global-demo-2');
if (dash2) dash2.addEventListener('click', () => chayDemoModal('REQ-20260604-001'));
document.getElementById('btn-close-demo-modal').addEventListener('click', () => {
  document.getElementById('demo-modal-overlay').style.display = 'none';
});
document.getElementById('btn-view-result').addEventListener('click', () => {
  document.getElementById('demo-modal-overlay').style.display = 'none';
  document.querySelector('[data-tab="requests"]').click();
});

// ═══════════════════════════════════════════════════════════════════════════════
// TỔNG QUAN (DASHBOARD)
// ═══════════════════════════════════════════════════════════════════════════════
async function taiTongQuan() {
  try {
    let dash;
    try {
      dash = await fetchJSON('/api/dashboard');
    } catch (e) {
      console.error('[taiTongQuan] /api/dashboard', e);
      toast('warning', 'Không tải được Tổng quan', 'Vui lòng kiểm tra API /api/dashboard hoặc database schema.');
      dash = { ok: false, fallback: { ...DASH_KPI_DEFAULTS } };
    }
    if (dash && dash.ok === false) {
      console.warn('[taiTongQuan] dashboard degraded:', dash.detail || dash.message || '');
      toast('warning', dash.message || 'Tổng quan', 'Dữ liệu KPI tạm hiển thị 0. Xem log server (Render) để biết chi tiết.');
      dash = { ...DASH_KPI_DEFAULTS, ...(dash.fallback || {}) };
    } else {
      dash = { ...DASH_KPI_DEFAULTS, ...dash };
    }

    let wss = [];
    let notifs = [];
    try {
      wss = await fetchJSON('/api/workstreams');
    } catch (e) {
      console.error('[taiTongQuan] /api/workstreams', e);
      toast('warning', 'Luồng thi công', 'Không tải được danh sách workstream.');
    }
    try {
      notifs = await fetchJSON('/api/notifications');
    } catch (e) {
      console.error('[taiTongQuan] /api/notifications', e);
    }

    document.getElementById('stat-lots').textContent = dash.total_lots;
    document.getElementById('stat-offcuts').textContent = dash.active_offcuts;
    document.getElementById('stat-ppf-done').textContent = dash.ppf_completed || 0;
    document.getElementById('stat-wf-done').textContent = dash.wf_completed || 0;
    document.getElementById('stat-approval-ws').textContent = dash.pending_approval_workstreams || 0;
    document.getElementById('stat-closed').textContent = dash.closed_requests || 0;
    const elC = document.getElementById('stat-total-customers');
    if (elC) elC.textContent = dash.total_customers ?? '—';
    const elD = document.getElementById('stat-total-dealers-dash');
    if (elD) elD.textContent = dash.total_dealers ?? '—';
    const elV = document.getElementById('stat-total-vehicles-dash');
    if (elV) elV.textContent = dash.total_vehicles ?? '—';
    const elM = document.getElementById('stat-manual-today');
    if (elM) elM.textContent = dash.manual_requests_today ?? 0;
    const elO = document.getElementById('stat-ocr-today');
    if (elO) elO.textContent = dash.ocr_requests_today ?? 0;

    // Hàng chờ phê duyệt
    const choiDuyet = wss.filter(w => w.status === 'PENDING_APPROVAL');
    document.getElementById('badge-ws-approve').textContent = choiDuyet.length;
    const tblBody = document.getElementById('table-ws-approve');
    tblBody.innerHTML = choiDuyet.length === 0
      ? '<tr><td colspan="6" class="text-center muted" style="padding:20px">Không có luồng nào chờ phê duyệt.</td></tr>'
      : choiDuyet.map(w => `<tr>
          <td><strong>${w.workstream_id}</strong></td>
          <td>${loaiLuongBadge(w.workstream_type)}</td>
          <td>${w.request_id}</td>
          <td><strong>${w.selected_material_code || '—'}</strong></td>
          <td>${w.allocated_source_id || '—'}</td>
          <td style="white-space:nowrap">
            ${(() => {
      const wf = w.workstream_type === 'WINDOW_FILM_INSTALLATION' || w.workstream_type === 'GLASS_FILM_INSTALLATION';
      const fm = w.workstream_type === 'FLOOR_MAT_INSTALLATION';
      const ok = wf ? window.dycPerm('can_post_approve_wf_materials') : window.dycPerm('can_approve_ppf_pending_workstream');
      return ok
        ? `<button class="btn btn-green btn-sm" onclick="pheDuyetNhanhWs('${w.workstream_id}')">
              <i class="fa-solid fa-check"></i> Phê duyệt
            </button>`
        : '<span class="muted" style="font-size:11px">Không đủ quyền</span>';
    })()}
            <button class="btn btn-outline btn-sm" style="margin-left:4px" onclick="chuyenDenDon('${w.request_id}')">
              <i class="fa-solid fa-eye"></i> Xem
            </button>
          </td>
        </tr>`).join('');

    // Đang thi công
    const dangThiCong = wss.filter(w => w.status === 'IN_PROGRESS');
    document.getElementById('badge-inprogress').textContent = dangThiCong.length;
    document.getElementById('dash-inprogress-list').innerHTML = dangThiCong.length === 0
      ? '<p class="text-center muted pad-20" style="font-size:12px">Không có luồng nào đang thi công.</p>'
      : dangThiCong.slice(0, 5).map(w => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 6px;border-bottom:1px solid var(--border);font-size:12px">
            <div>
              <strong>${w.workstream_id}</strong>
              <div style="font-size:10px;color:var(--text-secondary)">${w.request_id} | Đội: ${w.technician_team || '—'} | KTV: ${w.assigned_technician_name || '—'}</div>
            </div>
            ${loaiLuongBadge(w.workstream_type)}
          </div>`).join('');

    // Trạng thái tổng hợp
    const nhomTrangThai = {};
    wss.forEach(w => { nhomTrangThai[w.status] = (nhomTrangThai[w.status] || 0) + 1; });
    document.getElementById('dash-ws-status').innerHTML = Object.entries(nhomTrangThai).map(([st, cnt]) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px">
        <div>${trangThaiBadge(st)}</div>
        <strong>${cnt} luồng</strong>
      </div>`).join('') || '<p class="muted" style="padding:16px;font-size:12px">Chưa có luồng thi công nào.</p>';

    // Thông báo nhanh
    document.getElementById('dash-notif-quick').innerHTML = notifs.slice(0, 4).map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" style="margin:4px" onclick="danhDauDocThongBao('${n.notif_id}',this)">
        <div class="notif-title">${n.title}</div>
        ${n.workstream_type ? loaiLuongBadge(n.workstream_type) : ''}
        <div class="notif-body">${n.body.substring(0, 90)}${n.body.length > 90 ? '...' : ''}</div>
        <div class="notif-time">${fmtDt(n.created_at)}</div>
      </div>`).join('') || '<p class="text-center muted pad-20" style="font-size:12px">Không có thông báo.</p>';

    // Biểu đồ xe/đại lý tháng này
    try {
      const dm = await fetchJSON('/api/dashboard/dealer-monthly');
      _renderDealerMonthlyChart(dm);
    } catch (_) { /* ignore chart error */ }
  } catch(e) { toast('error', 'Lỗi tải tổng quan', e.message); }
}

function _renderDealerMonthlyChart(dm) {
  const el = document.getElementById('dash-dealer-monthly-chart');
  if (!el) return;
  const { month, total, breakdown } = dm;
  if (!breakdown || !breakdown.length) {
    el.innerHTML = `<p class="muted" style="font-size:12px;padding:12px">Chưa có dữ liệu xe trong tháng ${month}.</p>`;
    return;
  }
  const COLORS = ['#e53935','#1e88e5','#43a047','#fb8c00','#8e24aa','#00acc1','#f4511e','#6d4c41'];
  const bars = breakdown.map((d, i) => {
    const color = COLORS[i % COLORS.length];
    const w = Math.max(d.pct, 2);
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
        <span style="font-weight:600;color:var(--text)">${_esc(d.dealer_name)}</span>
        <span style="color:var(--text-secondary)">${d.count} xe &nbsp;(${d.pct}%)</span>
      </div>
      <div style="background:var(--surface-3);border-radius:4px;height:10px;overflow:hidden">
        <div style="background:${color};height:100%;width:${w}%;border-radius:4px;transition:width 0.4s"></div>
      </div>
    </div>`;
  }).join('');
  el.innerHTML = `<div style="padding:4px 0">
    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px">
      Tháng <strong>${month}</strong> — Tổng: <strong>${total} xe</strong>
    </div>
    ${bars}
  </div>`;
}

window.pheDuyetNhanhWs = async function(wsId) {
  try {
    const ws = await fetchJSON(`/api/workstreams/${encodeURIComponent(wsId)}`);
    if (ws.workstream_type === 'WINDOW_FILM_INSTALLATION' && ws.status === 'PENDING_APPROVAL') {
      await moModalDuyetMaPhimWF(wsId);
      return;
    }
    const data = await fetchJSON(`/api/workstreams/${encodeURIComponent(wsId)}/approve`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({}),
    });
    toast('success', '✅ Phê duyệt thành công', data.detail || '');
    taiTongQuan(); taiThongBao();
  } catch(e) { toast('error', 'Lỗi phê duyệt', e.message); }
};
window.chuyenDenDon = function (reqId) {
  const id = (reqId != null && String(reqId).trim()) || '';
  if (!id) return;
  currentRequestId = id;
  const tabBtn = document.querySelector('[data-tab="requests"]');
  if (tabBtn) tabBtn.click();
  /* tab handler gọi taiDonThiCong — lúc đó currentRequestId đã đúng nên board + highlight đồng bộ, không cần setTimeout */
};

/** Đóng drawer (Khách / Xe / Đại lý) rồi mở tab Đơn thi công với đơn được chọn — đủ panel chi tiết E2E. */
window.dongDrawerVaMoChiTietDon = function (requestId) {
  const ov = document.getElementById('modal-drawer-overlay');
  if (ov) ov.style.display = 'none';
  chuyenDenDon(requestId);
};

/** Một dòng tóm tắt hạng mục / dịch vụ cho bảng lịch sử (job_items hoặc service_selection_json). */
function _requestHangMucOneLine(r) {
  const j = (r.job_items || '').toString().trim();
  if (j) return j.replace(/;/g, ', ');
  try {
    const raw = r.service_selection_json || r.service_selection;
    const sel = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!sel || typeof sel !== 'object') return '—';
    const parts = [];
    const svc = (sel.services || '').toString().trim();
    if (svc) parts.push(svc);
    [
      [sel.service_1, sel.film_type_1],
      [sel.service_2, sel.film_type_2],
    ].forEach((p) => {
      const line = [p[0], p[1]].filter(Boolean).join(' — ');
      if (line) parts.push(line);
    });
    return parts.length ? parts.join(' · ') : '—';
  } catch (_) {
    return '—';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OCR INTAKE
// ═══════════════════════════════════════════════════════════════════════════════
let currentOcrDraftId = null;

const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragging'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragging'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('dragging'); const f = e.dataTransfer.files[0]; if (f) taiLenFile(f); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) taiLenFile(e.target.files[0]); });

async function taiLenFile(file) {
  toast('info', '📤 Đang tải lên...', file.name);
  const fd = new FormData(); fd.append('file', file);
  try {
    const data = await fetch('/api/ocr/upload', { method: 'POST', body: fd }).then(r => r.json());
    toast('success', '✅ Tải lên thành công', `Phiếu ${data.ocr_draft_id} đã được tạo.`);
    taiDanhSachOcr();
    setTimeout(() => xuLyOcr(data.ocr_draft_id), 800);
  } catch(e) { toast('error', 'Tải lên thất bại', e.message); }
}

async function taiDanhSachOcr() {
  const drafts = await fetch('/api/ocr-drafts').then(r => r.json());
  const list = document.getElementById('ocr-drafts-list');
  if (drafts.length === 0) { list.innerHTML = '<p class="text-center muted pad-20" style="font-size:12px">Chưa có phiếu nào được tải lên.</p>'; return; }
  list.innerHTML = drafts.map(d => `
    <div class="ocr-draft-item ${d.ocr_draft_id === currentOcrDraftId ? 'active' : ''}" onclick="moPhieuOcr('${d.ocr_draft_id}')">
      <div>
        <h4>${d.ocr_draft_id}</h4>
        <p>${d.image_filename || 'phieu.jpg'} — ${d.extracted_vehicle_model || '—'}</p>
      </div>
      ${trangThaiBadge(d.review_status)}
    </div>`).join('');
}

async function xuLyOcr(draftId) {
  toast('info', '🤖 AI đang đọc phiếu...', 'Đang trích xuất thông tin từ hình ảnh.');
  const data = await fetch(`/api/ocr/${draftId}/process`, { method: 'POST' }).then(r => r.json());
  if (data.status === 'success') { toast('success', '✅ Đọc phiếu xong', 'Vui lòng kiểm tra và xác nhận thông tin.'); moPhieuOcr(draftId); }
  taiDanhSachOcr(); taiThongBao();
}

function _ocrAttrEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function _ocrFieldRowHtml(f, readonly) {
  if (f.type === 'hidden') {
    return `<input type="hidden" id="ocrf-${f.key}" value="${_ocrAttrEsc(f.val)}">`;
  }
  const typ = f.type || 'text';
  const ph = f.placeholder ? ` placeholder="${_ocrAttrEsc(f.placeholder)}"` : '';
  const ro = readonly ? ' readonly' : '';
  if (f.tracking) {
    const hint = f.hint
      ? `<p class="muted" style="font-size:11px;margin:-2px 0 8px;line-height:1.45">${f.hint}</p>`
      : '';
    return `<div class="ocr-field-group ocr-field-tracking">
      <label>${f.label}</label>
      ${hint}
      <input type="${typ}" id="ocrf-${f.key}" class="field-input" value="${_ocrAttrEsc(f.val)}"${ph}${ro}>
    </div>`;
  }
  const pct = Math.round((f.conf || 0) * 100);
  const dot = pct >= 90 ? 'conf-high' : pct >= 70 ? 'conf-mid' : 'conf-low';
  return `<div class="ocr-field-group">
      <label><span class="conf-dot ${dot}"></span> ${f.label} (độ chính xác: ${pct}%)</label>
      <input type="${typ}" id="ocrf-${f.key}" class="field-input" value="${_ocrAttrEsc(f.val)}"${ph}${ro}>
    </div>`;
}

function _ocrSectionHtml(title, iconClass, fieldList, readonly) {
  const inner = fieldList.map((f) => _ocrFieldRowHtml(f, readonly)).join('');
  return `<div class="ocr-form-section">
    <h4 class="ocr-form-section-title"><i class="${iconClass}"></i> ${title}</h4>
    <div class="ocr-section-grid">${inner}</div>
  </div>`;
}

window.moPhieuOcr = async function(draftId) {
  currentOcrDraftId = draftId;
  document.getElementById('ocr-review-panel').style.display = 'block';
  document.getElementById('ocr-empty-state').style.display = 'none';
  const drafts = await fetch('/api/ocr-drafts').then(r => r.json());
  const d = drafts.find(x => x.ocr_draft_id === draftId);
  if (!d) return;

  const imgEl = document.getElementById('ocr-preview-img');
  if (imgEl) {
    let url = '';
    if (d.image_url) {
      url = d.image_url;
    } else if (d.image_filename) {
      url = `/static/uploads/${encodeURIComponent(d.image_filename)}`;
    }

    let pdfEl = document.getElementById('ocr-preview-pdf');
    if (!pdfEl) {
      pdfEl = document.createElement('iframe');
      pdfEl.id = 'ocr-preview-pdf';
      pdfEl.style.width = '100%';
      pdfEl.style.height = '100%';
      pdfEl.style.minHeight = '250px';
      pdfEl.style.border = 'none';
      pdfEl.style.display = 'none';
      imgEl.parentNode.appendChild(pdfEl);
    }

    if (url.toLowerCase().endsWith('.pdf')) {
      pdfEl.src = url;
      pdfEl.style.display = 'block';
      imgEl.style.display = 'none';
      document.querySelector('.ocr-image-controls').style.display = 'none';
    } else {
      pdfEl.style.display = 'none';
      imgEl.style.display = 'block';
      document.querySelector('.ocr-image-controls').style.display = 'flex';
      imgEl.src = url || '';
      // Reset transformations
      imgEl.style.transform = 'scale(1) rotate(0deg)';
      imgEl.dataset.scale = 1;
      imgEl.dataset.rotate = 0;
    }
  }

  const badge = document.getElementById('ocr-status-badge');
  badge.className = `status-badge status-${(d.review_status||'').toLowerCase()}`;
  badge.textContent = TRANG_THAI_VI[d.review_status] || d.review_status;
  const conf = Math.round((d.confidence_overall || 0) * 100);
  document.getElementById('confidence-fill').style.width = `${conf}%`;
  document.getElementById('confidence-pct').textContent = `${conf}%`;

  const services = d.extracted_services || 'PPF,WINDOW_FILM';
  const hasWF = services.includes('WINDOW_FILM');
  const hasPPF = services.includes('PPF');
  const readonly = ['CONFIRMED', 'CANCELLED'].includes(d.review_status);

  let seqYear = '';
  let seqMonth = '';
  if (readonly) {
    seqYear = d.sequence_no != null && d.sequence_no !== '' ? String(d.sequence_no) : '';
    seqMonth =
      d.sequence_no_month != null && d.sequence_no_month !== '' ? String(d.sequence_no_month) : '';
    if (d.created_request_id && (!seqYear || !seqMonth)) {
      try {
        const rr = await fetch(`/api/requests/${encodeURIComponent(d.created_request_id)}`).then((r) =>
          r.json(),
        );
        if (rr) {
          if (!seqYear && rr.sequence_no != null && String(rr.sequence_no).trim() !== '')
            seqYear = String(rr.sequence_no).trim();
          if (!seqMonth && rr.sequence_no_month != null && String(rr.sequence_no_month).trim() !== '')
            seqMonth = String(rr.sequence_no_month).trim();
        }
      } catch (_) {
        /* ignore */
      }
    }
  } else {
    try {
      const tc = await fetch('/api/ocr/tracking-counters').then((r) => r.json());
      if (tc.sequence_year_next != null) seqYear = String(tc.sequence_year_next);
      if (tc.sequence_month_next != null) seqMonth = String(tc.sequence_month_next);
    } catch (_) {
      /* ignore */
    }
  }

  const sectionTracking = [
    {
      key: 'sequence_no',
      label: 'Số thứ tự',
      val: seqYear,
      type: 'number',
      tracking: true,
      hint: 'STT xe doanh nghiệp thi công trong năm (từ đầu năm), tăng theo từng đơn — hệ thống gợi ý số tiếp theo.',
    },
    {
      key: 'sequence_no_month',
      label: 'Số thứ tự/tháng',
      val: seqMonth,
      type: 'number',
      tracking: true,
      hint: 'STT xe thi công trong tháng hiện tại (từ đầu tháng), gợi ý tăng dần theo đơn.',
    },
  ];

  const reqDateVal =
    d.extracted_request_date ||
    (d.created_at
      ? fmtDt(d.created_at)
      : new Date()
          .toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
          .replace(',', ''));

  const section1 = [
    { key: 'dealer_name', label: 'Đại lý', val: d.extracted_dealer_name, conf: d.confidence_dealer || 0.85 },
    { key: 'dealer_address', label: 'Địa chỉ đại lý', val: d.extracted_dealer_address || '', conf: 0.85 },
    { key: 'request_no', label: 'Số phiếu / Số đề nghị', val: d.extracted_request_no || '', conf: 0.9 },
    { key: 'contract_no', label: 'Số hợp đồng (Số HĐ)', val: d.extracted_contract_no || '', conf: 0.88 },
    { key: 'sales_consultant', label: 'Tư vấn bán hàng', val: d.sales_consultant || '', conf: 0.9 },
    { key: 'vehicle_model', label: 'Dòng xe', val: d.extracted_vehicle_model, conf: d.confidence_vehicle || 0.85 },
    { key: 'model_year', label: 'Năm model', val: new Date().getFullYear(), conf: 0.9, type: 'number' },
    { key: 'vin', label: 'Số khung (VIN)', val: d.extracted_vin, conf: 0.99 },
    { key: 'request_date', label: 'Ngày yêu cầu', val: reqDateVal, conf: 0.9, placeholder: 'hh:mm dd/mm/yyyy' },
    {
      key: 'delivery_time',
      label: 'Hạn hoàn tất thi công',
      val: d.extracted_delivery_time ? fmtDt(d.extracted_delivery_time) : '',
      conf: 0.88,
      placeholder: 'hh:mm dd/mm/yyyy',
    },
  ];

  const section2 = [
    { key: 'customer_name', label: 'Khách hàng', val: d.extracted_customer_name, conf: d.confidence_customer || 0.85 },
    { key: 'customer_address', label: 'Địa chỉ KH', val: d.extracted_customer_address || '', conf: 0.85 },
    { key: 'customer_phone', label: 'Điện thoại KH', val: d.extracted_customer_phone || '', conf: 0.85 },
  ];

  const section3 = [];

  if (hasWF && !hasPPF) {
    section3.push(
      { key: 'service_1', label: 'Dịch vụ 01', val: 'Phim cách nhiệt', conf: 0.97 },
      { key: 'film_type_1', label: 'Loại phim yêu cầu 01', val: d.extracted_film_type || '', conf: 0.95 },
    );
  } else if (hasPPF && !hasWF) {
    section3.push(
      { key: 'service_1', label: 'Dịch vụ 01', val: 'Phim PPF', conf: 0.97 },
      { key: 'film_type_1', label: 'Loại phim yêu cầu 01', val: d.extracted_ppf_type || '', conf: 0.92 },
    );
  } else {
    section3.push(
      { key: 'service_1', label: 'Dịch vụ 01', val: 'Phim cách nhiệt', conf: 0.97 },
      { key: 'film_type_1', label: 'Loại phim yêu cầu 01', val: d.extracted_film_type || '', conf: 0.95 },
      { key: 'service_2', label: 'Dịch vụ 02', val: 'Phim PPF', conf: 0.97 },
      { key: 'film_type_2', label: 'Loại phim yêu cầu 02', val: d.extracted_ppf_type || '', conf: 0.92 },
    );
  }

  document.getElementById('ocr-fields-form').innerHTML = [
    _ocrSectionHtml('Thông tin đại lý & phiếu yêu cầu', 'fa-solid fa-building', section1, readonly),
    _ocrSectionHtml('Thông tin chủ xe', 'fa-solid fa-user', section2, readonly),
    _ocrSectionHtml('Theo dõi', 'fa-solid fa-list-ol', sectionTracking, readonly),
    _ocrSectionHtml('Thông tin cung cấp dịch vụ', 'fa-solid fa-screwdriver-wrench', section3, readonly),
    `<input type="hidden" id="ocrf-services" value="${_ocrAttrEsc(services)}">`,
  ].join('');

  const svcBox = document.getElementById('ocr-services-box');
  const titleEl = document.getElementById('ocr-services-title');
  if (hasPPF && hasWF) {
    if (titleEl) titleEl.textContent = 'Phát hiện đa dịch vụ';
    document.getElementById('ocr-services-text').textContent = 'Phiếu yêu cầu cả PPF + Phim cách nhiệt. Hệ thống sẽ tự động tạo 2 luồng thi công: Đội PPF và Đội Cách Nhiệt.';
    svcBox.style.display = 'block';
  } else if (hasWF) {
    if (titleEl) titleEl.textContent = 'Phát hiện 1 dịch vụ';
    document.getElementById('ocr-services-text').textContent = 'Phiếu chỉ có phim cách nhiệt. Sau khi xác nhận, hệ thống tạo một luồng WINDOW_FILM_INSTALLATION (không PPF).';
    svcBox.style.display = 'block';
  } else if (hasPPF) {
    if (titleEl) titleEl.textContent = 'Phát hiện 1 dịch vụ';
    document.getElementById('ocr-services-text').textContent = 'Phiếu chỉ có PPF. Sau khi xác nhận, hệ thống tạo một luồng PPF_INSTALLATION (không Phim cách nhiệt).';
    svcBox.style.display = 'block';
  } else { svcBox.style.display = 'none'; }

  const confirmBtn = document.getElementById('btn-confirm-ocr');
  const cancelBtn = document.getElementById('btn-cancel-ocr');
  const rollbackBtn = document.getElementById('btn-rollback-ocr');
  const hintEl = document.getElementById('ocr-actions-hint');
  const isLexDraft = /^OCR-DRAFT-LEXUS-/.test(d.ocr_draft_id || '');

  const setOcrActionsHint = (html) => {
    if (hintEl) hintEl.innerHTML = html;
  };

  if (confirmBtn && cancelBtn && rollbackBtn) {
    rollbackBtn.style.display = 'none';
    rollbackBtn.disabled = true;
    cancelBtn.title = '';
    rollbackBtn.title = '';

    if (d.ocr_status !== 'COMPLETED') {
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      confirmBtn.textContent = 'Chờ AI xử lý...';
      setOcrActionsHint(
        '<strong>Chờ OCR xong</strong> mới xác nhận hoặc hủy phiếu. « Hủy phiếu » chỉ dùng khi <em>chưa</em> tạo đơn — đánh dấu phiếu OCR là đã hủy.',
      );
    } else if (readonly) {
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      if (d.review_status === 'CONFIRMED') {
        confirmBtn.textContent = `✅ Đã tạo đơn: ${d.created_request_id || '—'}`;
        cancelBtn.title =
          'Sau khi đã tạo đơn không dùng « Hủy phiếu ». Dùng « Hủy xác nhận (Rollback đơn) » để xóa đơn đã tạo, gỡ luồng thi công và mở lại chỉnh sửa phiếu OCR.';
        rollbackBtn.style.display = 'inline-flex';
        rollbackBtn.disabled = false;
        rollbackBtn.title = `Xóa đơn ${d.created_request_id || ''}, workstream, thẻ việc; mở khóa kho gắn đơn; đưa phiếu về chờ chỉnh sửa.`;
        setOcrActionsHint(
          `Đơn đã tạo: <strong>${_esc(d.created_request_id || '—')}</strong>. ` +
            'Để sửa sai sau khi xác nhận, dùng nút <strong>vàng</strong> bên cạnh. ' +
            '« Hủy phiếu » (đỏ) <em>không áp dụng</em> ở bước này — nó chỉ dùng khi chưa tạo đơn.',
        );
      } else {
        confirmBtn.textContent =
          d.review_status === 'CANCELLED' ? '⛔ Phiếu OCR đã hủy (chưa tạo đơn)' : '✅ Đã xử lý xong';
        cancelBtn.title = 'Phiếu đã hủy hoặc đóng — không thao tác thêm.';
        setOcrActionsHint(
          d.review_status === 'CANCELLED'
            ? 'Phiếu đã được <strong>hủy trước khi tạo đơn</strong>. Có thể để tham chiếu / audit; không có rollback đơn.'
            : 'Trạng thái phiếu đã khóa chỉnh sửa.',
        );
      }
    } else {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = isLexDraft
        ? '<i class="fa-solid fa-check-circle"></i> Xác nhận tạo đơn'
        : '<i class="fa-solid fa-check-circle"></i> Xác nhận & Tạo đơn thi công';
      cancelBtn.disabled = false;
      cancelBtn.title =
        'Chỉ khi chưa tạo đơn: đánh dấu phiếu OCR « Đã hủy » (không xóa đơn — vì chưa có đơn).';
      setOcrActionsHint(
        '« <strong>Xác nhận</strong> » tạo đơn thi công + luồng theo dịch vụ. « <strong>Hủy phiếu</strong> » chỉ khi <em>chưa</em> xác nhận — ghi nhận phiếu hủy, không gỡ dữ liệu đơn.',
      );
    }
  }
  taiDanhSachOcr();
};

document.getElementById('btn-confirm-ocr').addEventListener('click', async () => {
  if (!currentOcrDraftId) return;
  const payload = {
    dealer_name: document.getElementById('ocrf-dealer_name')?.value,
    dealer_address: document.getElementById('ocrf-dealer_address')?.value,
    customer_name: document.getElementById('ocrf-customer_name')?.value,
    customer_phone: document.getElementById('ocrf-customer_phone')?.value,
    customer_address: document.getElementById('ocrf-customer_address')?.value,
    vehicle_model: document.getElementById('ocrf-vehicle_model')?.value,
    vin: document.getElementById('ocrf-vin')?.value,
    services: document.getElementById('ocrf-services')?.value,
    request_no: document.getElementById('ocrf-request_no')?.value,
    contract_no: document.getElementById('ocrf-contract_no')?.value,
    model_year: document.getElementById('ocrf-model_year')?.value,
    request_date: document.getElementById('ocrf-request_date')?.value,
    sales_consultant: document.getElementById('ocrf-sales_consultant')?.value,
    sequence_no: document.getElementById('ocrf-sequence_no')?.value,
    sequence_no_month: document.getElementById('ocrf-sequence_no_month')?.value,
    requested_delivery_time: document.getElementById('ocrf-delivery_time')?.value,
    service_1: document.getElementById('ocrf-service_1')?.value,
    film_type_1: document.getElementById('ocrf-film_type_1')?.value,
    service_2: document.getElementById('ocrf-service_2')?.value,
    film_type_2: document.getElementById('ocrf-film_type_2')?.value,
  };
  try {
    const data = await fetchJSON(`/api/ocr/${encodeURIComponent(currentOcrDraftId)}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    toast('success', '✅ Tạo đơn thành công', data.detail || '');
    moPhieuOcr(currentOcrDraftId);
    taiThongBao();
    taiTongQuan();
    taiDonThiCong();
    if (data.request_id && /^REQ-TEST-LEXUS-/.test(data.request_id)) {
      chuyenDenDon(data.request_id);
    }
  } catch (e) {
    toast('error', 'Lỗi xác nhận phiếu', e.message);
  }
});
document.getElementById('btn-cancel-ocr').addEventListener('click', async () => {
  if (!currentOcrDraftId) return;
  if (
    !confirm(
      'Hủy phiếu OCR?\n\nChỉ dùng khi CHƯA tạo đơn thi công. Hệ thống sẽ đánh dấu phiếu « Đã hủy » (không xóa đơn vì chưa có đơn).\n\nTiếp tục?',
    )
  ) {
    return;
  }
  try {
    const r = await fetch(`/api/ocr/${encodeURIComponent(currentOcrDraftId)}/cancel`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || j.message || `HTTP ${r.status}`);
    toast('warning', '🚫 Đã hủy phiếu', j.detail || `Phiếu ${currentOcrDraftId} đã bị hủy.`);
    moPhieuOcr(currentOcrDraftId);
    taiDanhSachOcr();
  } catch (e) {
    toast('error', 'Không hủy được phiếu', e.message);
  }
});

document.getElementById('btn-rollback-ocr').addEventListener('click', async () => {
  if (!currentOcrDraftId) return;
  if (
    !confirm(
      'Hủy xác nhận (rollback đơn)?\n\nThao tác này sẽ:\n' +
        '• Xóa đơn thi công đã tạo từ phiếu này, các luồng và thẻ việc liên quan\n' +
        '• Mở khóa kho (LOT/mảnh dư) đang gắn đơn đó\n' +
        '• Đưa phiếu OCR về trạng thái chỉnh sửa để xác nhận lại\n\n' +
        'Không thể hoàn tác. Tiếp tục?',
    )
  ) {
    return;
  }
  try {
    const data = await fetchJSON(`/api/ocr/${encodeURIComponent(currentOcrDraftId)}/rollback`, { method: 'POST' });
    toast('success', 'Đã hủy xác nhận', data.detail || '');
    moPhieuOcr(currentOcrDraftId);
    taiThongBao();
    taiTongQuan();
    taiDonThiCong();
    taiDanhSachOcr();
  } catch (e) {
    toast('error', 'Rollback thất bại', e.message);
  }
});

// Image Preview Controls
document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
  const imgEl = document.getElementById('ocr-preview-img');
  if (!imgEl) return;
  let scale = parseFloat(imgEl.dataset.scale || 1) + 0.25;
  if (scale > 3) scale = 3;
  let rotate = parseFloat(imgEl.dataset.rotate || 0);
  imgEl.dataset.scale = scale;
  imgEl.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
});

document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
  const imgEl = document.getElementById('ocr-preview-img');
  if (!imgEl) return;
  let scale = parseFloat(imgEl.dataset.scale || 1) - 0.25;
  if (scale < 0.25) scale = 0.25;
  let rotate = parseFloat(imgEl.dataset.rotate || 0);
  imgEl.dataset.scale = scale;
  imgEl.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
});

document.getElementById('btn-rotate-cw')?.addEventListener('click', () => {
  const imgEl = document.getElementById('ocr-preview-img');
  if (!imgEl) return;
  let scale = parseFloat(imgEl.dataset.scale || 1);
  let rotate = parseFloat(imgEl.dataset.rotate || 0) + 90;
  imgEl.dataset.rotate = rotate;
  imgEl.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
});

document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
  const imgEl = document.getElementById('ocr-preview-img');
  if (!imgEl || !imgEl.src) return;
  if (imgEl.requestFullscreen) {
    imgEl.requestFullscreen();
  } else if (imgEl.webkitRequestFullscreen) { /* Safari */
    imgEl.webkitRequestFullscreen();
  } else if (imgEl.msRequestFullscreen) { /* IE11 */
    imgEl.msRequestFullscreen();
  }
});

document.getElementById('btn-lexus-ocr-seed')?.addEventListener('click', async () => {
  try {
    const data = await fetchJSON('/api/test-data/lexus-ocr-drafts', { method: 'POST' });
    const existed = !!data.already_existed;
    toast(
      'success',
      existed ? 'Đã cập nhật' : 'Đã tạo phiếu',
      existed
        ? 'Phiếu test đã tồn tại, đã cập nhật dữ liệu mới.'
        : 'Đã tạo 2 phiếu OCR test Lexus.',
    );
    taiDanhSachOcr();
    taiThongBao();
    taiTongQuan();
  } catch (e) {
    toast('error', 'Lỗi tạo phiếu test', e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ĐƠN THI CÔNG E2E
// ═══════════════════════════════════════════════════════════════════════════════
let currentRequestId = null;

function _reqListSeqYear(r) {
  return r.sequence_no != null && String(r.sequence_no).trim() !== '' ? String(r.sequence_no).trim() : '—';
}

function _reqListSeqMonth(r) {
  return r.sequence_no_month != null && String(r.sequence_no_month).trim() !== ''
    ? String(r.sequence_no_month).trim()
    : '—';
}

/** Khối thông tin dọc trong thẻ danh sách đơn (sidebar Đơn thi công). */
function _reqListSidebarBody(r) {
  const daLuong = r.is_multi_workstream
    ? '<span class="req-multi-ws"><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Có</span>'
    : 'Không';
  return `<div class="req-item-meta">
    <div class="req-item-row"><span class="req-item-k">Mã đơn</span><span class="req-item-v">${_esc(r.request_id)}</span></div>
    <div class="req-item-row"><span class="req-item-k">Đa luồng</span><span class="req-item-v">${daLuong}</span></div>
    <div class="req-item-row"><span class="req-item-k">Số thứ tự</span><span class="req-item-v">${_esc(_reqListSeqYear(r))}</span></div>
    <div class="req-item-row"><span class="req-item-k">Số thứ tự/tháng</span><span class="req-item-v">${_esc(_reqListSeqMonth(r))}</span></div>
    <div class="req-item-row"><span class="req-item-k">Dòng xe</span><span class="req-item-v">${_esc(_reqSvcModel(r))}</span></div>
  </div>`;
}

function _reqSvcModel(r) {
  try {
    const s = r.service_selection_json ? JSON.parse(r.service_selection_json) : (r.service_selection || {});
    return s.display_model_name || s.model_name || r.vehicle_model_code || '—';
  } catch (e) {
    return r.vehicle_model_code || '—';
  }
}

async function taiDonThiCong() {
  try {
    const reqs = await fetch('/api/requests').then(r => r.json());
    document.getElementById('req-list-count').textContent = reqs.length;
    document.getElementById('demo-req-list').innerHTML = reqs.length === 0
      ? '<p class="text-center muted pad-20" style="font-size:12px">Không có đơn thi công nào.</p>'
      : reqs.map(r => `
          <div class="req-item ${r.request_id === currentRequestId ? 'active' : ''}" onclick="chonDon('${r.request_id}')">
            ${_reqListSidebarBody(r)}
            ${['ALLOCATED','NEEDS_REVIEW'].includes(r.status) ? '<p class="muted req-item-hint">Bước tiếp: Phê duyệt Quản lý</p>' : ''}
            <div class="req-badges">${trangThaiBadge(r.status)}</div>
          </div>`).join('');
    if (currentRequestId) {
      const sel = reqs.find((r) => r.request_id === currentRequestId);
      if (sel) await hienThiDon(sel);
      requestAnimationFrame(() => {
        document
          .querySelector('#demo-req-list .req-item.active')
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  } catch(e) { toast('error', 'Lỗi tải đơn thi công', e.message); }
}

window.chonDon = function(reqId) {
  currentRequestId = reqId;
  taiDonThiCong();
};

async function hienThiDon(req) {
  try {
    const detail = await fetch(`/api/requests/${encodeURIComponent(req.request_id)}`).then((r) => r.json());
    req = { ...req, ...detail };
  } catch (e) {
    /* giữ bản danh sách nếu API lỗi */
  }
  document.getElementById('no-req-selected').style.display = 'none';
  document.getElementById('req-demo-board').style.display = 'block';
  document.getElementById('board-req-title').textContent = req.request_id;
  const stEl = document.getElementById('board-req-status');
  stEl.className = `status-badge status-${(req.status||'').toLowerCase().replace(/_/g,'-')}`;
  stEl.textContent = TRANG_THAI_VI[req.status] || req.status;
  document.getElementById('board-multi-ws-badge').style.display = req.is_multi_workstream ? 'inline-block' : 'none';
  document.getElementById('det-dealer').textContent = req.dealer_name || req.dealer_id || '—';
  const sc = req.source_channel || 'OCR';
  const scEl = document.getElementById('det-source-channel');
  if (scEl) scEl.textContent = sc === 'MANUAL' ? 'Thủ công (MANUAL)' : 'OCR';
  const rno = document.getElementById('det-request-no');
  if (rno) {
    rno.textContent = (req.request_no || '').trim() || '—';
  }
  const detSeqY = document.getElementById('det-sequence-year');
  if (detSeqY) {
    detSeqY.textContent =
      req.sequence_no != null && String(req.sequence_no).trim() !== ''
        ? String(req.sequence_no).trim()
        : '—';
  }
  const detSeqM = document.getElementById('det-sequence-month');
  if (detSeqM) {
    detSeqM.textContent =
      req.sequence_no_month != null && String(req.sequence_no_month).trim() !== ''
        ? String(req.sequence_no_month).trim()
        : '—';
  }
  const cno = document.getElementById('det-contract-no');
  if (cno) cno.textContent = (req.contract_no || '').trim() || '—';
  const refsBar = document.getElementById('board-req-refs');
  if (refsBar) {
    const sttBits = [];
    if (req.sequence_no != null && String(req.sequence_no).trim() !== '') sttBits.push(`STT: ${req.sequence_no}`);
    if (req.sequence_no_month != null && String(req.sequence_no_month).trim() !== '')
      sttBits.push(`STT/tháng: ${req.sequence_no_month}`);
    const sttStr = sttBits.length ? ` (${sttBits.join(', ')})` : '';
    const phieuTxt = ((req.request_no || '').trim() + sttStr) || '—';
    const hdTxt = (req.contract_no || '').trim() || '—';
    refsBar.style.display = 'block';
    refsBar.innerHTML = `<span><strong>Số phiếu YC:</strong> ${_esc(phieuTxt)}</span> <span style="opacity:0.45">·</span> <span><strong>Số hợp đồng:</strong> ${_esc(hdTxt)}</span>`;
  }
  const rdt = document.getElementById('det-request-date');
  if (rdt) rdt.textContent = req.request_date || '—';
  const oim = document.getElementById('det-ocr-image');
  if (oim) {
    const fn = req.ocr_source_image || '—';
    oim.innerHTML = fn && fn !== '—'
      ? `<a href="/static/test_orders/${encodeURIComponent(fn)}" target="_blank" rel="noopener">${_esc(fn)}</a>`
      : '—';
  }
  const cidEl = document.getElementById('det-customer-id');
  if (cidEl) cidEl.textContent = req.customer_id || '—';
  const vidEl = document.getElementById('det-vehicle-id');
  if (vidEl) vidEl.textContent = req.vehicle_id || '—';
  document.getElementById('det-customer').textContent = req.customer_name;
  const phEl = document.getElementById('det-customer-phone');
  if (phEl) phEl.textContent = req.customer_phone || req.phone || req.phone_masked || '—';
  const addrEl = document.getElementById('det-customer-address');
  if (addrEl) addrEl.textContent = req.customer_address || req.address || req.address_masked || '—';
  const socEl = document.getElementById('det-sales-consultant');
  if (socEl) socEl.textContent = (req.sales_consultant || '').trim() || '—';
  document.getElementById('det-model').textContent = _reqSvcModel(req);
  document.getElementById('det-vin').textContent = (req.vin_number || req.vin_masked || '—').trim() || '—';
  document.getElementById('det-deadline').textContent = fmtDt(req.requested_delivery_time);
  const normCard = document.getElementById('det-norm-card');
  const normBody = document.getElementById('det-norm-body');
  let na = req.norm_application;
  if (!na && req.norm_application_json) {
    try { na = JSON.parse(req.norm_application_json); } catch (e) { na = null; }
  }
  if (na && normCard && normBody) {
    normCard.style.display = 'block';
    const strat = na.resolution_strategy || '—';
    const src =
      na.source ||
      (na.norm_id && String(na.norm_id).includes('XLS') ? 'EXCEL_IMPORT' : '—');
    const items = (na.applied_items || [])
      .map((i) => {
        const ji = _wfJobLabelVi(i.job_item);
        const src2 = i.material_source
          ? ` <small class="muted">(${_esc(materialSourceVi(i.material_source))})</small>`
          : '';
        return `${_esc(ji)} ${_esc(i.material_code || '—')} ${_esc(i.size || '')}${src2}`;
      })
      .join('<br/>');
    const yrReq = na.model_year_requested != null ? na.model_year_requested : na.model_year;
    const yrRes = na.model_year_resolved != null ? na.model_year_resolved : '—';
    const vmLine = na.vehicle_model_code_requested || na.vehicle_model_code || na.norm?.vehicle_model_code || '—';
    const warnCombined =
      strat !== 'EXACT_YEAR' && na.warning
        ? `<div class="hitl-alert" style="margin-top:8px;border-color:rgba(255,193,7,0.45);background:rgba(255,193,7,0.1)">${_esc(na.warning)}</div>`
        : '';
    const warnList =
      strat !== 'EXACT_YEAR' && Array.isArray(na.warnings) && na.warnings.length
        ? `<div class="hitl-alert" style="margin-top:8px">${na.warnings.map((w) => _esc(w)).join('<br/>')}</div>`
        : '';
    normBody.innerHTML = `
      <div><strong>norm_id</strong>: ${_esc(na.norm_id || na.norm?.norm_id || '—')}</div>
      <div><strong>film_type</strong>: ${_esc(na.film_type || na.norm?.film_type || '—')}</div>
      <div><strong>model</strong>: ${_esc(String(vmLine))}</div>
      <div><strong>requested year</strong>: ${_esc(String(yrReq != null ? yrReq : '—'))} · <strong>resolved year</strong>: ${_esc(String(yrRes))}</div>
      <div><strong>source</strong>: ${_esc(String(src))}</div>
      <div><strong>strategy</strong>: ${_esc(String(strat))}</div>
      ${na.override_reason ? `<div><strong>override_reason</strong>: ${_esc(na.override_reason)}</div>` : ''}
      <div style="margin-top:6px">${items || '<span class="muted">Không có auto_fill_items</span>'}</div>
      ${warnCombined}
      ${warnList}
    `;
  } else if (normCard) {
    normCard.style.display = 'none';
  }
  const matCard = document.getElementById('det-mat-app-card');
  const matBody = document.getElementById('det-mat-app-body');
  const matWarn = document.getElementById('det-mat-app-warn');
  if (matCard && matBody) {
    try {
      const wss = await fetch(`/api/requests/${encodeURIComponent(req.request_id)}/workstreams`).then((r) => r.json());
      let html = '';
      let hasMiss = false;
      (wss || []).forEach((ws) => {
        const isPpf = ws.workstream_type === 'PPF_INSTALLATION';
        let plan = ws.material_plan;
        if (typeof plan === 'string') {
          try {
            plan = JSON.parse(plan || '[]');
          } catch (e) {
            plan = [];
          }
        }
        if (!Array.isArray(plan) || !plan.length) return;
        const title = isPpf ? 'Dán Phim PPF' : 'Dán Phim Cách Nhiệt';
        html += `<div style="margin-bottom:12px"><strong style="color:var(--text-secondary)">${title}</strong> <small class="muted">(${_esc(ws.workstream_id)})</small>
          <table class="data-table" style="font-size:13px;margin-top:6px"><thead><tr><th>Hạng mục</th><th>Kích thước</th><th>Mã vật tư</th><th>Nguồn</th><th>Lý do</th></tr></thead><tbody>`;
        plan.forEach((p) => {
          const srcRaw = (p.material_source || '—').toString();
          if (srcRaw === 'MISSING_PREFERENCE') hasMiss = true;
          const srcVi = materialSourceVi(srcRaw);
          const rs = p.material_override_reason ? _esc(p.material_override_reason) : '—';
          const hang = _wfJobLabelVi(p.job_item);
          html += `<tr><td>${_esc(hang)}</td><td>${_esc(p.size || '—')}</td><td>${_esc(p.material_code || '—')}</td><td>${_esc(srcVi)}</td><td>${rs}</td></tr>`;
        });
        html += '</tbody></table></div>';
      });
      matBody.innerHTML = html || '<p class="muted">Chưa có kế hoạch vật tư theo luồng.</p>';
      matCard.style.display = html ? 'block' : 'none';
      if (matWarn) {
        if (hasMiss) {
          matWarn.style.display = 'block';
          matWarn.textContent =
            'Có hạng mục chưa cấu hình vật tư ưu tiên. Vui lòng cập nhật Quản lý kho > Vật tư ưu tiên.';
        } else {
          matWarn.style.display = 'none';
          matWarn.textContent = '';
        }
      }
    } catch (e) {
      matBody.innerHTML = `<p class="muted">${_esc(e.message)}</p>`;
      matCard.style.display = 'block';
      if (matWarn) matWarn.style.display = 'none';
    }
  }
  const auditCard = document.getElementById('det-audit-card');
  const auditBody = document.getElementById('det-audit-body');
  if (auditCard && auditBody) {
    try {
      const logs = await fetchJSON(`/api/audit-logs?request_id=${encodeURIComponent(req.request_id)}`);
      if (logs && logs.length) {
        auditCard.style.display = 'block';
        auditBody.innerHTML = logs.slice(0, 40).map((log) => {
          const t = GIAO_DICH_VI[log.transaction_type] || log.transaction_type;
          return `<div style="border-bottom:1px solid rgba(255,255,255,0.06);padding:6px 0">
            <div><strong>${_esc(t)}</strong> <span class="muted">${fmtDt(log.timestamp)}</span></div>
            <div class="muted">${_esc(log.actor || '')} · ${_esc(log.reason || '')}</div>
          </div>`;
        }).join('');
      } else {
        auditCard.style.display = 'none';
        auditBody.innerHTML = '';
      }
    } catch (e) {
      auditCard.style.display = 'none';
    }
  }
  const cgBox = document.getElementById('cutting-group-box');
  if (req.is_grouped_cut) {
    cgBox.style.display = 'flex';
    document.getElementById('det-cg-id').textContent = req.cut_group_id;
    document.getElementById('det-cg-block').textContent = req.planned_cut_block;
    document.getElementById('det-cg-len').textContent = `${req.planned_deduction_length_m} m`;
  } else { cgBox.style.display = 'none'; }

  // Tiến trình
  const steps = ['DRAFT','STANDARDIZED','NORM_ASSIGNED','ALLOCATED','APPROVED','IN_PROGRESS','CLOSED'];
  const specialMap = { 'PARTIALLY_COMPLETED':'IN_PROGRESS','WAITING_INVENTORY_COMMIT':'IN_PROGRESS','EXCEPTION_HOLD':'ALLOCATED','NEEDS_REVIEW':'ALLOCATED' };
  const effStatus = specialMap[req.status] || req.status;
  const curIdx = steps.indexOf(effStatus);
  steps.forEach((st, idx) => {
    const el = document.getElementById(`step-${st}`); if (!el) return;
    el.className = 'step-item';
    if (idx < curIdx) el.classList.add('done');
    else if (idx === curIdx) el.classList.add('active');
  });
  document.querySelectorAll('.step-connector').forEach((c, ci) => {
    c.className = 'step-connector' + (ci < curIdx ? ' done' : '');
  });

  // Vùng thao tác
  ['agent-run-zone','hitl-ws-zone','hitl-1-zone','hitl-2-zone','completed-zone','partial-zone','exception-zone'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const desc = document.getElementById('action-desc');

  if (req.status === 'DRAFT') {
    document.getElementById('agent-run-zone').style.display = 'block';
    desc.textContent = 'BƯỚC 1: AI Agent chuẩn hóa thông tin đại lý, khách hàng, xe. Nhấn để thực hiện.';
  } else if (req.status === 'STANDARDIZED') {
    document.getElementById('agent-run-zone').style.display = 'block';
    desc.textContent = 'BƯỚC 2: AI Agent tra cứu định mức cắt phim và phân nhóm Cutting Group cho dòng xe này.';
  } else if (req.status === 'NORM_ASSIGNED') {
    document.getElementById('agent-run-zone').style.display = 'block';
    desc.textContent = 'BƯỚC 3: AI Agent đề xuất nguồn vật tư (LOT/mảnh dư) phù hợp. Nếu đa luồng sẽ tạo 2 luồng thi công.';
  } else if (req.status === 'ALLOCATED' || req.status === 'NEEDS_REVIEW') {
    let wssProbe = [];
    try {
      wssProbe = await fetch(`/api/requests/${encodeURIComponent(req.request_id)}/workstreams`).then((r) => r.json());
    } catch (e) { wssProbe = []; }
    const hasPendingWs = (wssProbe || []).some(
      (ws) => ws.status === 'PENDING_APPROVAL' || ws.status === 'PENDING_TECH_PREFLIGHT',
    );
    if (req.is_multi_workstream || hasPendingWs) {
      document.getElementById('hitl-ws-zone').style.display = 'block';
      await hienThiThePheDuyet(req.request_id);
      desc.textContent = 'Quản lý duyệt mã phim WF / phê duyệt PPF; sau đó KTV chỉnh LOT (WF) rồi chốt phân bổ.';
    } else {
      document.getElementById('hitl-1-zone').style.display = 'block';
      document.getElementById('prop-source').textContent = `${req.allocated_source_type}: ${req.allocated_source_id}`;
      document.getElementById('prop-len').textContent = `${req.planned_deduction_length_m} m`;
    }
  } else if (req.status === 'APPROVED') {
    let wssProbe = [];
    try {
      wssProbe = await fetch(`/api/requests/${encodeURIComponent(req.request_id)}/workstreams`).then((r) => r.json());
    } catch (e) { wssProbe = []; }
    const hasWs = (wssProbe || []).length > 0;
    if (req.is_multi_workstream || hasWs) {
      document.getElementById('hitl-ws-zone').style.display = 'block';
      await hienThiThePheDuyet(req.request_id);
    } else {
      document.getElementById('hitl-2-zone').style.display = 'block';
      document.getElementById('input-actual-block').value = req.planned_cut_block || '';
      document.getElementById('input-actual-len').value = req.planned_deduction_length_m || '';
    }
  } else if (req.status === 'IN_PROGRESS') {
    let wssProbe = [];
    try {
      wssProbe = await fetch(`/api/requests/${encodeURIComponent(req.request_id)}/workstreams`).then((r) => r.json());
    } catch (e) { wssProbe = []; }
    const hasWs = (wssProbe || []).length > 0;
    if (req.is_multi_workstream || hasWs) {
      document.getElementById('hitl-ws-zone').style.display = 'block';
      await hienThiThePheDuyet(req.request_id);
    } else {
      document.getElementById('hitl-2-zone').style.display = 'block';
    }
  } else if (req.status === 'PARTIALLY_COMPLETED') {
    document.getElementById('partial-zone').style.display = 'block';
    document.getElementById('hitl-ws-zone').style.display = 'block';
    await hienThiThePheDuyet(req.request_id);
  } else if (req.status === 'CLOSED') {
    document.getElementById('completed-zone').style.display = 'block';
  } else if (req.status === 'EXCEPTION_HOLD') {
    document.getElementById('exception-zone').style.display = 'block';
    document.getElementById('exception-reason-text').textContent = req.exception_reason || '—';
    document.getElementById('agent-run-zone').style.display = 'block';
    desc.textContent = 'Có ngoại lệ xảy ra. Kiểm tra lý do và thử lại.';
  }

  let wssAll = [];
  try {
    wssAll = await fetch(`/api/requests/${encodeURIComponent(req.request_id)}/workstreams`).then((r) => r.json());
  } catch (e) { wssAll = []; }
  if (req.is_multi_workstream || (wssAll && wssAll.length > 0)) {
    document.getElementById('workstream-section').style.display = 'block';
    await hienThiTheLuong(req.request_id);
  } else { document.getElementById('workstream-section').style.display = 'none'; }
}

/** Cuộn tới thẻ luồng trong “Tiến độ từng luồng” (phương án 1 — tránh nút trùng ở ô tóm tắt). */
window.scrollToWsDetail = function (workstreamId) {
  const id = String(workstreamId ?? '');
  let el = null;
  document.querySelectorAll('.ws-card[data-workstream-id]').forEach((node) => {
    if (node.getAttribute('data-workstream-id') === id) el = node;
  });
  if (!el) {
    if (typeof toast === 'function') toast('info', 'Luồng thi công', 'Chưa thấy thẻ luồng — hãy đợi trang tải xong hoặc kéo xuống mục Tiến độ từng luồng.');
    return;
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  el.classList.add('ws-card--highlight');
  setTimeout(() => el.classList.remove('ws-card--highlight'), 1800);
};

async function hienThiThePheDuyet(requestId) {
  const wss = await fetch(`/api/requests/${requestId}/workstreams`).then(r => r.json());
  const container = document.getElementById('ws-approval-cards');
  if (!container) return;
  container.innerHTML = wss.map(ws => {
    const isPpf = ws.workstream_type === 'PPF_INSTALLATION';
    const mauChinh = isPpf ? 'var(--red-light)' : 'var(--blue-light)';
    const icon = isPpf ? 'fa-shield-film' : 'fa-window-restore';
    const tenDoi = isPpf ? 'Dán Phim PPF' : 'Dán Phim Cách Nhiệt';
    let ppfAllocHtml = '';
    if (isPpf && ws.ppf_allocation) {
      const pa = ws.ppf_allocation;
      const fullIt = (pa.items || []).find((x) => x.item_code === 'FULL_VEHICLE_PPF');
      const reqM = fullIt && fullIt.required_length_m != null ? Number(fullIt.required_length_m) : 13;
      const srcLines = (fullIt && fullIt.sources) || [];
      const tot = srcLines.reduce((s, x) => s + (parseFloat(x.allocated_length_m) || 0), 0);
      const nSrc = srcLines.filter((s) => (s.source_id || '').trim()).length;
      const splitBadge =
        nSrc > 1
          ? '<span style="margin-left:6px;padding:2px 8px;border-radius:6px;background:rgba(0,188,212,0.2);color:var(--teal-light);font-weight:700;font-size:10px">Chia nguồn</span>'
          : '';
      const ok = tot + 1e-6 >= reqM;
      const stLabel = ok ? 'Đủ vật tư' : 'Thiếu vật tư';
      const stColor = ok ? 'var(--teal-light)' : 'var(--amber)';
      const lines =
        srcLines.filter((s) => (s.source_id || '').trim()).map((s) => `${s.source_id}: ${s.allocated_length_m}m`).join(' · ') || '—';
      ppfAllocHtml = `<br><span style="color:var(--text-secondary)">Hạng mục:</span> <strong>Full xe</strong> ·
        <span style="color:var(--text-secondary)">Tổng yêu cầu:</span> <strong>${reqM}m</strong> ·
        <span style="color:var(--text-secondary)">Đã phân bổ:</span> <strong>${tot.toFixed(1)}m</strong>${splitBadge}<br>
        <span style="color:var(--text-secondary)">Nguồn:</span> ${lines}<br>
        <span style="color:${stColor};font-weight:700">${stLabel}</span>`;
    }
    let wfAllocHtml = '';
    if (!isPpf && ws.wf_allocation) {
      const wfa = ws.wf_allocation;
      const sel = (wfa.items || []).filter((x) => x.is_selected);
      let nsrc = 0;
      let hasOff = false;
      const lines = [];
      for (const it of sel) {
        nsrc += (it.sources || []).filter((s) => (s.source_id || '').trim()).length;
        if ((it.sources || []).some((s) => (s.source_type || '').toUpperCase() === 'OFFCUT')) hasOff = true;
        const tot = (it.sources || []).reduce((s, x) => s + (parseFloat(x.allocated_length_m) || 0), 0);
        const req = parseFloat(it.required_length_m) || 0;
        const ok = req <= 0 || tot + 1e-6 >= req;
        const sl = (it.sources || []).filter((s) => (s.source_id || '').trim()).map((s) => `${s.source_id}: ${s.allocated_length_m}m`).join(' · ');
        lines.push(`${it.item_name} [${it.material_code}] ${ok ? '✓' : '⚠'} — ${sl}`);
      }
      const splitWf = nsrc > sel.length && sel.length > 0;
      const splitBadge = splitWf
        ? '<span style="margin-left:6px;padding:2px 8px;border-radius:6px;background:rgba(0,188,212,0.2);color:var(--teal-light);font-weight:700;font-size:10px">Chia nguồn</span>'
        : '';
      const offB = hasOff
        ? '<span style="margin-left:6px;padding:2px 8px;border-radius:6px;background:rgba(156,39,176,0.25);font-weight:700;font-size:10px">Dùng mảnh dư</span>'
        : '';
      wfAllocHtml = `<br><span style="color:var(--text-secondary)">Phân bổ WF:</span>${splitBadge}${offB}<br>${lines.join('<br>')}${wfRollCutSummaryHtml(wfa)}`;
    }
    return `<div style="border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-bottom:10px;background:var(--bg-card)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <strong style="color:${mauChinh};font-size:13px"><i class="fa-solid ${icon}" style="margin-right:6px"></i>${tenDoi}</strong>
        ${trangThaiBadge(ws.status)}
      </div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px">
        ${isPpf ? `Loại phim PPF: <strong style="color:${mauChinh}">${ws.selected_material_code || 'T-TYPE'}</strong> | Kích thước: ${ws.planned_cut_block || '152x1300'}` :
          `Nhóm cắt: ${ws.cut_group_id || '—'} | Kích thước: ${ws.planned_cut_block || '152x143'}`}
        <br>Đội: ${ws.technician_team || '—'} | KTV: ${ws.assigned_technician_name || '—'} | Nguồn: ${ws.allocated_source_id || '—'}
        ${ppfAllocHtml}${wfAllocHtml}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px">
        ${ws.status === 'CLOSED' ? '<span style="color:var(--teal-light);font-size:12px;font-weight:700"><i class="fa-solid fa-check-circle"></i> Đã hoàn tất & đóng</span>' : ''}
        <button type="button" class="btn btn-outline btn-sm" onclick="scrollToWsDetail(${JSON.stringify(ws.workstream_id)})" title="Cuộn xuống thẻ luồng tương ứng — phê duyệt & chỉnh sửa tại đó">
          <i class="fa-solid fa-arrow-down"></i> Xem chi tiết & thao tác
        </button>
      </div>
    </div>`;
  }).join('');
}

async function hienThiTheLuong(requestId) {
  const wss = await fetch(`/api/requests/${requestId}/workstreams`).then(r => r.json());
  const container = document.getElementById('ws-cards-container');
  if (!container) return;
  const statuses = wss.map(w => w.status);
  let overall = 'IN_PROGRESS';
  if (statuses.every(s => s === 'CLOSED')) overall = 'CLOSED';
  else if (statuses.some(s => s === 'CLOSED')) overall = 'PARTIALLY_COMPLETED';
  else if (statuses.some(s => s === 'PENDING_APPROVAL')) overall = 'PENDING_APPROVAL';
  else if (statuses.some(s => s === 'PENDING_TECH_PREFLIGHT')) overall = 'PENDING_TECH_PREFLIGHT';
  const wsOverall = document.getElementById('ws-overall-status');
  if (wsOverall) { wsOverall.className = `status-badge status-${overall.toLowerCase().replace(/_/g,'-')}`; wsOverall.textContent = TRANG_THAI_VI[overall] || overall; }

  container.innerHTML = wss.map(ws => {
    const isPpf = ws.workstream_type === 'PPF_INSTALLATION';
    const isGl  = ws.workstream_type === 'GLASS_FILM_INSTALLATION';
    const isFm  = ws.workstream_type === 'FLOOR_MAT_INSTALLATION';
    const typeClass = isPpf ? 'ppf' : isGl ? 'gl' : isFm ? 'fm' : 'wf';
    const icon = isPpf ? 'fa-shield-film' : isGl ? 'fa-gem' : isFm ? 'fa-border-all' : 'fa-window-restore';
    const tenLoai = isPpf ? 'Dán Phim PPF' : isGl ? 'Dán Cường Lực' : isFm ? 'Thảm Trải Sàn' : 'Dán Phim Cách Nhiệt';
    const canXoaDotCatThem = ws.status === 'IN_PROGRESS' || ws.status === 'ACTUAL_CONFIRMATION_REQUIRED';
    const matPlan = ws.material_plan ? (Array.isArray(ws.material_plan) ? ws.material_plan : JSON.parse(ws.material_plan || '[]')) : [];
    const progress = { 'PENDING_APPROVAL':0,'PENDING_TECH_PREFLIGHT':12,'APPROVED':30,'IN_PROGRESS':60,'ACTUAL_CONFIRMATION_REQUIRED':75,'COMPLETED':90,'CLOSED':100 }[ws.status] || 0;
    const tenPhim = { 'T-TYPE':'T-TYPE (Trong suốt)', 'M-TYPE':'M-TYPE (Mờ)', 'JB20':'JB20 (Cách nhiệt)', 'RT40':'RT40 (Kính lái)' };

    const ppfFilmLabel = isPpf ? tenPhim[ws.ppf_allocation?.ppf_type || ws.selected_material_code] || ws.ppf_allocation?.ppf_type || ws.selected_material_code || '—' : '';
    let ppfBlockDisplay = '—';
    let ppfLenDisplay = '';
    if (isPpf) {
      const pa = ws.ppf_allocation || {};
      const fullItPpf = (pa.items || []).find((x) => x.item_code === 'FULL_VEHICLE_PPF');
      const rawBlock = (fullItPpf && fullItPpf.planned_cut_block) || ws.planned_cut_block || '';
      ppfBlockDisplay = rawBlock ? _esc(String(rawBlock)) : '—';
      const reqLen =
        fullItPpf && fullItPpf.required_length_m != null && fullItPpf.required_length_m !== ''
          ? fullItPpf.required_length_m
          : pa.required_total_length_m != null && pa.required_total_length_m !== ''
            ? pa.required_total_length_m
            : null;
      ppfLenDisplay = reqLen != null && reqLen !== '' ? String(reqLen) : '';
    }
    let ppfSourceBlock = `<div class="ws-info-row"><span class="ws-label">Nguồn vật tư</span><span class="ws-value">${ws.allocated_source_type || '—'}: ${ws.allocated_source_id || '—'}</span></div>`;
    if (isPpf && ws.ppf_allocation) {
      const pa = ws.ppf_allocation;
      const fullIt = (pa.items || []).find((x) => x.item_code === 'FULL_VEHICLE_PPF');
      const srcLines = (fullIt && fullIt.sources) || [];
      const tot = srcLines.reduce((s, x) => s + (parseFloat(x.allocated_length_m) || 0), 0);
      const reqM = fullIt && fullIt.required_length_m != null ? Number(fullIt.required_length_m) : 13;
      const nSrc = srcLines.filter((s) => (s.source_id || '').trim()).length;
      const splitBadge = nSrc > 1 ? ' <span style="margin-left:4px;padding:2px 7px;border-radius:6px;background:rgba(0,188,212,0.2);color:var(--teal-light);font-weight:700;font-size:9px">Chia nguồn</span>' : '';
      const ok = tot + 1e-6 >= reqM;
      const stLabel = ok ? 'Đủ vật tư' : 'Thiếu vật tư';
      const stColor = ok ? 'var(--teal-light)' : 'var(--amber)';
      const lines = srcLines.filter((s) => (s.source_id || '').trim()).map((s) => `${s.source_id}: ${s.allocated_length_m}m`).join('<br>') || '—';
      ppfSourceBlock = `<div class="ws-info-row"><span class="ws-label">Hạng mục</span><span class="ws-value">Full xe</span></div>
        <div class="ws-info-row"><span class="ws-label">Nguồn vật tư</span><span class="ws-value" style="font-size:11px;line-height:1.45">${lines}${splitBadge}</span></div>
        <div class="ws-info-row"><span class="ws-label">Trạng thái phân bổ</span><span class="ws-value"><span style="color:${stColor};font-weight:700">${stLabel}</span> · Yêu cầu ${reqM}m · Đã phân bổ ${tot.toFixed(1)}m</span></div>`;
    }

    let wfSourceBlock = `<div class="ws-info-row"><span class="ws-label">Nguồn vật tư</span><span class="ws-value">${ws.allocated_source_type || '—'}: ${ws.allocated_source_id || '—'}</span></div>`;
    if (isFm) {
      const fmPlan = Array.isArray(ws.floor_mat_plan) ? ws.floor_mat_plan : [];
      if (fmPlan.length) {
        wfSourceBlock = `<div class="ws-info-row"><span class="ws-label">Kế hoạch thảm sàn</span><span class="ws-value" style="font-size:11px">${fmPlan.map(p => `${_esc(p.sku)} × ${p.qty}`).join(', ')}</span></div>`;
      } else {
        wfSourceBlock = `<div class="ws-info-row"><span class="ws-label">Thảm sàn</span><span class="ws-value muted">Chưa có kế hoạch</span></div>`;
      }
    } else if (!isPpf && ws.wf_allocation) {
      const sec = jcWfKiemTraTungHangMucCardSection(ws.wf_allocation, {});
      if (sec) wfSourceBlock = sec;
    }

    let wfExtraCutBlock = '';
    if (!isPpf && ws.extra_cut_requested) {
      const hist = Array.isArray(ws.extra_cut_history) ? ws.extra_cut_history : [];
      if (hist.length) {
        const blocks = hist
          .map((ent, idx) => {
            if (!ent || typeof ent !== 'object') return '';
            const ex = ent.wf_allocation;
            const when = ent.requested_at ? fmtDt(ent.requested_at) : '—';
            const who = [ent.actor_name, ent.actor_id].filter(Boolean).join(' · ') || '—';
            const pb = ex ? jcWfPhanBoBangHtml(`Đợt ${idx + 1} — hạng mục &amp; nguồn`, ex) : '';
            const kt = ex
              ? jcWfKiemTraTungHangMucCardSection(ex, {
                  title: `Đợt ${idx + 1} — kiểm tra hạng mục`,
                  icon: 'fa-scissors',
                  iconColor: '#fbbf24',
                })
              : '';
            const rs = jcExtraCutReasonHtml(ent.reason);
            const pid = ent.proposal_id
              ? `<code style="font-size:9px;opacity:0.85;margin-left:6px">${_esc(String(ent.proposal_id))}</code>`
              : '';
            const delBtn =
              canXoaDotCatThem && ent.proposal_id
                ? `<button type="button" class="btn btn-outline btn-sm" style="flex-shrink:0;padding:2px 10px;font-size:10px;border-color:rgba(248,113,113,0.45);color:#f87171" onclick="event.stopPropagation();void window.xoaDeXuatCatThem('${_esc(String(ws.workstream_id))}','${_esc(String(ent.proposal_id))}')"><i class="fa-solid fa-trash"></i> Xóa</button>`
                : '';
            return `<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(251,191,36,0.15)">
              <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
                <div style="font-size:10px;font-weight:700;color:var(--text-secondary)">
                <i class="fa-regular fa-clock" style="margin-right:4px"></i>${_esc(when)} · ${_esc(who)}${pid}
                </div>${delBtn}
              </div>
              ${pb}${kt}${rs}
            </div>`;
          })
          .join('');
        wfExtraCutBlock = `<div style="width:100%;margin-top:12px;padding-top:12px;border-top:1px solid rgba(251,191,36,0.28)">
          <div style="font-size:11px;font-weight:700;color:#fbbf24;margin-bottom:8px"><i class="fa-solid fa-scissors" style="margin-right:6px"></i> Lịch sử cắt bổ sung (${hist.length} đợt)</div>
          ${blocks}
          <p class="muted" style="font-size:9px;margin-top:4px;opacity:0.85">Mỗi đợt ghi nhận thời điểm &amp; người gửi. Khi hoàn tất luồng, hệ thống trừ kho theo <strong>tất cả</strong> đợt có bảng phân bổ. Có thể <strong>xóa từng đợt</strong> (đang thi công) để hệ thống cộng dồn lại kiểm tồn.</p>
        </div>`;
      } else {
        const exAllocs = collectExtraCutWfAllocations(ws);
        const ex = exAllocs[0];
        const phanBoEx = ex ? jcWfPhanBoBangHtml('Hạng mục &amp; nguồn cắt bổ sung (KTV đã xác nhận)', ex) : '';
        const kiemTraEx = ex
          ? jcWfKiemTraTungHangMucCardSection(ex, {
              title: 'Kiểm tra từng hạng mục (cắt bổ sung)',
              icon: 'fa-scissors',
              iconColor: '#fbbf24',
            })
          : '';
        if (phanBoEx || kiemTraEx) {
          const legacyDel =
            canXoaDotCatThem && ex
              ? `<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button type="button" class="btn btn-outline btn-sm" style="padding:2px 10px;font-size:10px;border-color:rgba(248,113,113,0.45);color:#f87171" onclick="event.stopPropagation();void window.xoaDeXuatCatThem('${_esc(String(ws.workstream_id))}','LEGACY-SNAPSHOT')"><i class="fa-solid fa-trash"></i> Xóa đăng ký cắt thêm</button></div>`
              : '';
          wfExtraCutBlock = `<div style="width:100%;margin-top:12px;padding-top:12px;border-top:1px solid rgba(251,191,36,0.28)">
          <div style="font-size:11px;font-weight:700;color:#fbbf24;margin-bottom:8px"><i class="fa-solid fa-scissors" style="margin-right:6px"></i> Cắt bổ sung — KTV đã xác nhận</div>
          ${legacyDel}
          ${phanBoEx || ''}
          ${kiemTraEx || ''}
          ${jcExtraCutReasonHtml(ws.extra_cut_reason)}
        </div>`;
        } else {
          wfExtraCutBlock = `<div class="ws-info-row"><span class="ws-label">Cắt thêm</span><span class="ws-value" style="color:#fbbf24;font-size:11px"><i class="fa-solid fa-scissors"></i> Đã đăng ký</span></div>${jcExtraCutReasonHtml(ws.extra_cut_reason)}`;
        }
      }
    }

    let ppfExtraCutHist = '';
    if (isPpf && ws.extra_cut_requested) {
      const h = Array.isArray(ws.extra_cut_history) ? ws.extra_cut_history : [];
      if (h.length) {
        const rows = h
          .map((ent, i) => {
            if (!ent || typeof ent !== 'object') return '';
            const when = ent.requested_at ? fmtDt(ent.requested_at) : '—';
            const who = [ent.actor_name, ent.actor_id].filter(Boolean).join(' · ') || '—';
            const rs = jcExtraCutReasonHtml(ent.reason);
            const delP =
              canXoaDotCatThem && ent.proposal_id
                ? `<button type="button" class="btn btn-outline btn-sm" style="flex-shrink:0;padding:2px 8px;font-size:10px;border-color:rgba(248,113,113,0.45);color:#f87171" onclick="event.stopPropagation();void window.xoaDeXuatCatThem('${_esc(String(ws.workstream_id))}','${_esc(String(ent.proposal_id))}')"><i class="fa-solid fa-trash"></i></button>`
                : '';
            return `<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(251,191,36,0.12)">
              <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:6px">
              <div style="font-size:10px;font-weight:700;color:var(--text-secondary)"><strong>${i + 1}.</strong> ${_esc(when)} · ${_esc(who)}</div>${delP}</div>${rs}</div>`;
          })
          .join('');
        ppfExtraCutHist = `<div style="width:100%;margin-top:12px;padding-top:12px;border-top:1px solid rgba(251,191,36,0.28)">
          <div style="font-size:11px;font-weight:700;color:#fbbf24;margin-bottom:6px"><i class="fa-solid fa-scissors"></i> Lịch sử đăng ký cắt thêm (${h.length})</div>${rows}</div>`;
      } else {
        ppfExtraCutHist = `<div class="ws-info-row"><span class="ws-label">Cắt thêm</span><span class="ws-value" style="color:#fbbf24;font-size:11px"><i class="fa-solid fa-scissors"></i> Đã đăng ký</span></div>${jcExtraCutReasonHtml(ws.extra_cut_reason)}`;
      }
    }

    return `<div class="ws-card ${typeClass}" data-workstream-id="${_esc(ws.workstream_id)}">
      <div class="ws-card-header">
        <div class="ws-card-title"><i class="fa-solid ${icon} ws-type-icon"></i>${tenLoai}</div>
        ${trangThaiBadge(ws.status)}
      </div>
      <div class="ws-card-body">
        <div class="ws-progress-bar"><div class="ws-progress-fill" style="width:${progress}%"></div></div>

        <div class="ws-info-row"><span class="ws-label">Mã luồng</span><span class="ws-value" style="font-size:11px">${ws.workstream_id}</span></div>
        <div class="ws-info-row"><span class="ws-label">Đội thi công</span><span class="ws-value">${ws.technician_team || '—'}</span></div>
        <div class="ws-info-row"><span class="ws-label">KTV phụ trách</span><span class="ws-value">${ws.assigned_technician_name || '—'}</span></div>
        ${isPpf ? `
        <div class="ws-info-row"><span class="ws-label">Loại PPF</span>
          <span class="ws-value" style="color:var(--red-light)">${ppfFilmLabel}</span>
        </div>
        <div class="ws-info-row"><span class="ws-label">Kích thước block</span><span class="ws-value">${ppfBlockDisplay}</span></div>
        <div class="ws-info-row"><span class="ws-label">Chiều dài trừ kho (Full xe)</span><span class="ws-value">${ppfLenDisplay != null && ppfLenDisplay !== '' ? ppfLenDisplay : '—'} m</span></div>
        ` : ''}

        ${!isPpf && matPlan.length > 0 ? `<div class="wf-material-plan">
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px">Kế hoạch vật tư từng kính:</div>
          ${matPlan.map(p => `
            <div class="wf-plan-row">
              <span class="job-name">${_esc(_wfJobLabelVi(p.job_item))}</span>
              <span class="mat-code ${(p.material_code||'').toLowerCase()}">${p.material_code || '—'}</span>
              <small class="muted">${_esc(materialSourceVi(p.material_source || ''))}</small>
            </div>`).join('')}
        </div>` : ''}

        ${isPpf ? ppfSourceBlock : wfSourceBlock}
        <div class="ws-info-row"><span class="ws-label">Mã lệnh thi công</span><span class="ws-value">${ws.job_card_id || 'Chưa tạo'}</span></div>
        <div class="ws-info-row"><span class="ws-label">Thời gian bắt đầu</span><span class="ws-value">${fmtDt(ws.started_at)}</span></div>
        <div class="ws-info-row"><span class="ws-label">Thời gian hoàn tất</span><span class="ws-value">${fmtDt(ws.completed_at)}</span></div>
        ${ws.created_offcut_id ? `<div class="ws-info-row"><span class="ws-label">Mảnh dư tạo ra</span><span class="ws-value" style="color:var(--green-light)">${ws.created_offcut_id}</span></div>` : ''}
        ${wfExtraCutBlock}
        ${ppfExtraCutHist}
      </div>
      <div class="ws-card-actions">
        ${ws.status === 'PENDING_APPROVAL' && (isPpf || isFm)
          ? (window.dycPerm('can_approve_ppf_pending_workstream')
            ? `<button class="btn btn-green btn-sm" onclick="pheDuyetWs('${ws.workstream_id}')"><i class="fa-solid fa-check"></i> Phê duyệt</button>`
            : '') : ''}
        ${ws.status === 'PENDING_APPROVAL' && ((!isPpf && !isFm) /* WF or GL */)
          ? (window.dycPerm('can_post_approve_wf_materials')
            ? `<button class="btn btn-green btn-sm" onclick="moModalDuyetMaPhimWF('${ws.workstream_id}')"><i class="fa-solid fa-film"></i> Duyệt mã phim</button>`
            : '') : ''}
        ${!isPpf && !isFm && ws.status === 'PENDING_TECH_PREFLIGHT' ? `
          ${window.dycPerm('can_write_allocation') ? `<button class="btn btn-outline btn-sm" onclick="chiinhSuaWs('${ws.workstream_id}')"><i class="fa-solid fa-warehouse"></i> Chỉnh phân bổ LOT</button>` : ''}
          ${window.dycPerm('can_approve_wf_preflight_commit') ? `<button class="btn btn-green btn-sm" onclick="pheDuyetWs('${ws.workstream_id}')"><i class="fa-solid fa-check"></i> Chốt phân bổ</button>` : ''}` : ''}
        ${ws.status === 'APPROVED' ? `<button class="btn btn-blue btn-sm" onclick="batDauWs('${ws.workstream_id}')"><i class="fa-solid fa-play"></i> KTV bắt đầu</button>` : ''}
        ${isFm && ws.status === 'IN_PROGRESS' ? `<button class="btn btn-primary btn-sm" onclick="hoanTatThamSan('${ws.workstream_id}')"><i class="fa-solid fa-check"></i> Hoàn tất thảm sàn</button>` : ''}
        ${!isFm && (ws.status === 'IN_PROGRESS' || ws.status === 'ACTUAL_CONFIRMATION_REQUIRED') ? `<button class="btn btn-primary btn-sm" onclick="moFormXacNhan('${ws.workstream_id}')"><i class="fa-solid fa-ruler"></i> Nhập thực tế</button><button class="btn btn-outline btn-sm" style="margin-left:6px;border-color:rgba(251,191,36,0.45);color:#fbbf24" onclick="moDangKyCatThem('${ws.workstream_id}')" title="Đăng ký cắt thêm giữa ca"><i class="fa-solid fa-scissors"></i> Cắt thêm</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="chiinhSuaWs('${ws.workstream_id}')"><i class="fa-solid fa-pen"></i> Chỉnh sửa</button>
        ${ws.job_card_id ? `<button class="btn btn-outline btn-sm" onclick="chuyenDenLenh('${ws.job_card_id}')"><i class="fa-solid fa-id-card"></i> Xem lệnh</button>` : ''}
      </div>
    </div>`;
  }).join('');

  const warnEl = document.getElementById('ws-source-warnings');
  if (warnEl) {
    try {
      const val = await fetch(`/api/inventory/validate-sources/${encodeURIComponent(requestId)}`).then(r => r.json());
      const issues = val.issues || [];
      const err = issues.filter(i => i.severity === 'ERROR');
      const warn = issues.filter(i => i.severity === 'WARNING');
      if (!err.length && !warn.length) {
        warnEl.style.display = 'none';
        warnEl.innerHTML = '';
        warnEl.className = 'hitl-alert';
      } else {
        warnEl.style.display = 'flex';
        const errBlock = err.length
          ? `<div><strong>Blocker — nguồn vật tư</strong><p>${err.map(e => `<strong>${e.workstream_id}</strong>: ${e.message}`).join('<br>')}</p><p style="margin-top:6px;font-size:11px">KTV không thể hoàn tất (trừ kho WF6) cho đến khi Quản lý chỉnh nguồn / khôi phục kho.</p></div>`
          : '';
        const warnBlock = warn.length
          ? `<div style="margin-top:${err.length ? '12px' : '0'};padding-top:${err.length ? '10px' : '0'};border-top:${err.length ? '1px solid rgba(255,255,255,0.12)' : 'none'}"><span class="inv-val-warn-title">Cảnh báo (không chặn nút hoàn tất)</span><p>${warn.map(w => `${w.workstream_id}: ${w.message}`).join('<br>')}</p></div>`
          : '';
        warnEl.className = err.length ? 'hitl-alert danger' : 'hitl-alert warn-only';
        warnEl.innerHTML = `<i class="fa-solid ${err.length ? 'fa-circle-xmark' : 'fa-triangle-exclamation'}"></i><div style="flex:1">${errBlock}${warnBlock}</div>`;
      }
    } catch {
      warnEl.style.display = 'none';
    }
  }
}
window.moModalDuyetMaPhimWF = async function (wsId) {
  let ws;
  try {
    ws = await fetchJSON(`/api/workstreams/${encodeURIComponent(wsId)}`);
  } catch (e) {
    toast('error', 'Không tải luồng', e.message);
    return;
  }
  if (ws.workstream_type !== 'WINDOW_FILM_INSTALLATION' && ws.workstream_type !== 'GLASS_FILM_INSTALLATION') {
    toast('warning', 'Không áp dụng', 'Chỉ áp dụng cho luồng phim cách nhiệt hoặc cường lực.');
    return;
  }
  if (ws.status !== 'PENDING_APPROVAL') {
    toast('info', 'Trạng thái', `Luồng không ở bước duyệt mã phim (hiện: ${TRANG_THAI_VI[ws.status] || ws.status}).`);
    return;
  }
  let plan = ws.material_plan;
  if (typeof plan === 'string') {
    try {
      plan = JSON.parse(plan || '[]');
    } catch {
      plan = [];
    }
  }
  if (!Array.isArray(plan)) plan = [];
  const planBy = {};
  for (const p of plan) {
    if (p && p.job_item) planBy[p.job_item] = { ...p };
  }
  document.getElementById('wf-material-approve-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'wf-material-approve-modal';
  overlay.style.display = 'flex';
  const rows = WF_MATERIAL_APPROVE_SCREEN1_JOBS.map((opt) => {
    const ji = opt.job_item;
    const p = planBy[ji] || {};
    const mc = (p.material_code || 'JB20').trim();
    const chk = opt.defaultOn ? ' checked' : '';
    const selDis = opt.defaultOn ? '' : ' disabled';
    const opts = LOAI_PHIM_WF.map(
      (o) => `<option value="${o.id}" ${o.id === mc ? 'selected' : ''}>${_esc(o.label)}</option>`,
    ).join('');
    return `<tr>
      <td style="text-align:center;vertical-align:middle"><input type="checkbox" class="wf-appr-chk" id="wf-appr-chk-${ji}" data-ji="${ji}"${chk}></td>
      <td>${_esc(opt.label)}</td>
      <td><select class="field-input wf-appr-mc-sel" id="wf-appr-mc-${ji}" style="min-width:200px; width:100%"${selDis}>${opts}</select></td>
    </tr>`;
  }).join('');
  overlay.innerHTML = `
    <div class="demo-modal" style="max-width:640px; width: 100%;">
      <div class="demo-modal-header">
        <i class="fa-solid fa-film" style="color:var(--blue-light)"></i>
        <div>
          <h3>Duyệt mã phim theo hạng mục</h3>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Tick chọn các kính/sườn cần thi công phim, chọn mã phim từng hạng mục. Sau khi lưu, hệ thống hiển thị chi tiết SL, LOT gợi ý, kích thước và gộp khổ — KTV chỉnh LOT rồi bấm Chốt phân bổ.</p>
        </div>
      </div>
      <div style="padding:16px 20px">
        <table class="data-table" style="font-size:12px; width: 100%;">
          <thead>
            <tr><th style="width:44px; text-align:center;">Chọn</th><th>Hạng mục</th><th>Mã phim thi công</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="field-group" id="wf-appr-reason-group" style="margin-top:14px; display:none; width: 100%;">
          <label>Lý do / xác nhận <span style="color:var(--red-light)">*</span></label>
          <textarea id="wf-appr-reason" class="field-input" rows="2" placeholder="VD: Đồng ý RT40 kính lái, JB20 các kính còn lại theo đề xuất…" style="width: 100%; box-sizing: border-box;"></textarea>
        </div>
      </div>
      <div class="demo-modal-footer" style="display:flex;gap:8px">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('wf-material-approve-modal')?.remove()">Hủy</button>
        <button type="button" class="btn btn-green" id="wf-appr-submit"><i class="fa-solid fa-check"></i> Đồng ý (Giữ nguyên đề xuất)</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const initialState = WF_MATERIAL_APPROVE_SCREEN1_JOBS.map((opt) => {
    const p = planBy[opt.job_item] || {};
    return {
      ji: opt.job_item,
      checked: !!opt.defaultOn,
      mc: (p.material_code || 'JB20').trim()
    };
  });

  const checkChanges = () => {
    let hasChanges = false;
    for (const st of initialState) {
      const cb = document.getElementById(`wf-appr-chk-${st.ji}`);
      const sel = document.getElementById(`wf-appr-mc-${st.ji}`);
      if (!cb || !sel) continue;
      if (cb.checked !== st.checked) { hasChanges = true; break; }
      if (cb.checked && sel.value !== st.mc) { hasChanges = true; break; }
    }
    const reasonGroup = document.getElementById('wf-appr-reason-group');
    const btn = document.getElementById('wf-appr-submit');
    if (reasonGroup) reasonGroup.style.display = hasChanges ? 'block' : 'none';
    if (btn) {
      if (hasChanges) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Xác nhận duyệt mã phim';
      } else {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Đồng ý (Giữ nguyên đề xuất)';
      }
    }
    return hasChanges;
  };

  overlay.querySelectorAll('.wf-appr-chk').forEach((cb) => {
    cb.addEventListener('change', () => {
      const ji = cb.getAttribute('data-ji');
      const sel = document.getElementById(`wf-appr-mc-${ji}`);
      if (sel) sel.disabled = !cb.checked;
      checkChanges();
    });
  });
  overlay.querySelectorAll('.wf-appr-mc-sel').forEach((sel) => {
    sel.addEventListener('change', checkChanges);
  });

  const btn = document.getElementById('wf-appr-submit');
  if (!btn) return;
  btn.onclick = async () => {
    const hasChanges = checkChanges();
    let reason = (document.getElementById('wf-appr-reason')?.value || '').trim();
    if (hasChanges && !reason) {
      toast('warning', 'Thiếu lý do', 'Vui lòng nhập lý do xác nhận do có thay đổi.');
      return;
    }
    if (!hasChanges) {
      reason = 'Duyệt theo đề xuất hệ thống (Không thay đổi)';
    }
    const outPlan = [];
    for (const opt of WF_MATERIAL_APPROVE_SCREEN1_JOBS) {
      const ji = opt.job_item;
      const cb = document.getElementById(`wf-appr-chk-${ji}`);
      if (!cb || !cb.checked) continue;
      const sel = document.getElementById(`wf-appr-mc-${ji}`);
      const mc = (sel && sel.value) || 'JB20';
      const base = planBy[ji] ? { ...planBy[ji] } : { job_item: ji, material_code: mc };
      outPlan.push({ ...base, material_code: mc });
    }
    if (!outPlan.length) {
      toast('warning', 'Chưa chọn hạng mục', 'Vui lòng tick ít nhất một hạng mục cần thi công phim.');
      return;
    }
    btn.disabled = true;
    try {
      await fetchJSON(`/api/workstreams/${encodeURIComponent(wsId)}/approve-wf-materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, material_plan: outPlan }),
      });
      overlay.remove();
      toast('success', 'Đã duyệt mã phim', 'KTV chỉnh phân bổ LOT, sau đó bấm Chốt phân bổ.');
      await taiDonThiCong();
      taiThongBao();
      taiTongQuan();
      if (currentRequestId) {
        try {
          await hienThiTheLuong(currentRequestId);
          await hienThiThePheDuyet(currentRequestId);
        } catch (_) {
          /* noop */
        }
      }
    } catch (e) {
      toast('error', 'Không lưu được', e.message);
    } finally {
      btn.disabled = false;
    }
  };
};

window.pheDuyetWs = async function(wsId) {
  try {
    const data = await fetchJSON(`/api/workstreams/${encodeURIComponent(wsId)}/approve`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({}),
    });
    toast('success', '✅ Phê duyệt thành công', data.detail || '');
    await taiDonThiCong(); taiThongBao(); taiTongQuan();
    if (currentRequestId) {
      try {
        await hienThiTheLuong(currentRequestId);
        await hienThiThePheDuyet(currentRequestId);
      } catch (_) { /* noop */ }
    }
  } catch(e) { toast('error', 'Lỗi phê duyệt', e.message); }
};

window.batDauWs = async function(wsId) {
  try {
    const data = await fetch(`/api/workstreams/${wsId}/start`, { method: 'POST' }).then(r => r.json());
    toast('success', '🔧 Bắt đầu thi công', data.detail);
    await taiDonThiCong(); taiThongBao(); taiTongQuan();
  } catch(e) { toast('error', 'Lỗi', e.message); }
};

window.hoanTatThamSan = async function(wsId) {
  if (!confirm(`Xác nhận hoàn tất lắp thảm sàn cho luồng ${wsId}?\nHệ thống sẽ trừ kho thảm sàn.`)) return;
  try {
    const data = await fetch(`/api/workstreams/${encodeURIComponent(wsId)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(r => r.json());
    toast('success', '✅ Hoàn tất thảm sàn', data.detail || 'Kho đã trừ.');
    await taiDonThiCong(); taiThongBao(); taiTongQuan();
    if (currentRequestId) {
      try { await hienThiTheLuong(currentRequestId); } catch (_) {}
    }
  } catch (e) { toast('error', 'Lỗi hoàn tất thảm sàn', e.message); }
};

/** Đăng ký cắt thêm giữa ca — tách khỏi modal xác nhận thực tế / hoàn tất. */
window.moDangKyCatThem = async function (wsId) {
  let ws;
  try {
    ws = await fetchJSON(`/api/workstreams/${encodeURIComponent(wsId)}`);
  } catch (e) {
    toast('error', 'Không tải luồng', e.message);
    return;
  }
  const okSt = ws.status === 'IN_PROGRESS' || ws.status === 'ACTUAL_CONFIRMATION_REQUIRED';
  if (!okSt) {
    toast('info', 'Không áp dụng', `Chỉ đăng ký khi đang thi công hoặc chờ nhập thực tế (hiện: ${TRANG_THAI_VI[ws.status] || ws.status}).`);
    return;
  }
  if (ws.workstream_type === 'WINDOW_FILM_INSTALLATION' && typeof window.openExtraCutWfModal === 'function') {
    await window.openExtraCutWfModal(wsId);
    return;
  }
  const isPpf = ws.workstream_type === 'PPF_INSTALLATION';
  const team = isPpf ? 'PPF' : 'Phim cách nhiệt';
  const wid = ws.workstream_id || wsId;
  document.getElementById('extra-cut-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'extra-cut-modal';
  overlay.style.display = 'flex';
  overlay.dataset.wsId = wid;
  overlay.dataset.techId = (ws.assigned_technician_id || '').trim();
  overlay.dataset.techName = (ws.assigned_technician_name || '').trim();
  overlay.innerHTML = `
    <div class="demo-modal" style="max-width:480px">
      <div class="demo-modal-header">
        <i class="fa-solid fa-scissors" style="color:#fbbf24"></i>
        <div>
          <h3>Đăng ký cắt thêm — ${_esc(team)}</h3>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Luồng <code>${_esc(wid)}</code>${ws.extra_cut_requested ? ' <span style="color:#fbbf24">(thêm đợt — lưu lịch sử)</span>' : ''}</p>
        </div>
      </div>
      <div style="padding:16px 20px">
        <p class="muted" style="font-size:12px;margin:0 0 10px;line-height:1.5">Ghi rõ phát sinh (hỏng, gãy, dán lỗi, thiếu mét…). Quản lý nhận thông báo để xử lý xuất bổ sung / điều chỉnh.</p>
        <div class="field-group full-width" style="margin:0">
          <label>Lý do <span class="req">*</span></label>
          <textarea id="ec-reason" class="field-input" rows="4" style="resize:vertical;min-height:96px;line-height:1.5" placeholder="Ví dụ: gãy phim do vận chuyển; dán hỏng kính sau phải cắt lại..."></textarea>
        </div>
      </div>
      <div class="demo-modal-footer" style="display:flex">
        <button class="btn btn-outline" onclick="document.getElementById('extra-cut-modal').remove()"><i class="fa-solid fa-xmark"></i> Đóng</button>
        <button class="btn btn-green" onclick="guiDangKyCatThem()"><i class="fa-solid fa-paper-plane"></i> Gửi đăng ký</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const ta = document.getElementById('ec-reason');
  if (ta && ws.extra_cut_reason) ta.value = String(ws.extra_cut_reason);
};

window.guiDangKyCatThem = async function () {
  const modal = document.getElementById('extra-cut-modal');
  const wsId = modal?.dataset?.wsId;
  if (!wsId) return;
  const reason = (document.getElementById('ec-reason')?.value || '').trim();
  if (reason.length < 5) {
    toast('error', 'Lý do', 'Tối thiểu 5 ký tự.');
    return;
  }
  try {
    const r = await fetch(`/api/workstreams/${encodeURIComponent(wsId)}/extra-cut-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason,
        technician_id: (modal.dataset.techId || '').trim() || 'KTV-UNKNOWN',
        technician_name: (modal.dataset.techName || '').trim(),
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const det = d.detail;
      let m = `Lỗi ${r.status}`;
      if (typeof det === 'string') m = det;
      else if (det && typeof det === 'object' && det.message) m = String(det.message);
      else if (det && typeof det === 'object') m = JSON.stringify(det);
      throw new Error(m);
    }
    modal.remove();
    toast('success', 'Đã gửi', d.detail || 'Đăng ký cắt thêm đã gửi cho Quản lý.');
    await taiDonThiCong();
    taiThongBao();
    taiTongQuan();
  } catch (e) {
    toast('error', 'Lỗi', e.message);
  }
};

/** Xóa một đợt đề xuất cắt thêm — backend cập nhật lịch sử & đồng bộ snapshot cuối (kiểm tồn / trừ kho khi hoàn tất tính lại). */
window.xoaDeXuatCatThem = async function (wsId, proposalId) {
  if (!wsId || !proposalId) {
    toast('error', 'Thiếu dữ liệu', 'Không xác định được đợt cần xóa.');
    return;
  }
  if (
    !confirm(
      'Xóa đợt đề xuất cắt thêm này?\n\nHệ thống sẽ cập nhật lại tổng kiểm tồn và phần trừ kho khi hoàn tất luồng theo các đợt còn lại.'
    )
  ) {
    return;
  }
  try {
    const r = await fetch(
      `/api/workstreams/${encodeURIComponent(wsId)}/extra-cut-proposals/${encodeURIComponent(proposalId)}`,
      { method: 'DELETE' }
    );
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const det = d.detail;
      let m = `Lỗi ${r.status}`;
      if (typeof det === 'string') m = det;
      else if (det && typeof det === 'object' && det.message) m = String(det.message);
      else if (det && typeof det === 'object') m = JSON.stringify(det);
      throw new Error(m);
    }
    toast('success', 'Đã xóa', d.detail || 'Đã xóa đợt đề xuất.');
    if (typeof taiBangLuong === 'function') await taiBangLuong();
    if (typeof taiDonThiCong === 'function') await taiDonThiCong();
    if (typeof taiThongBao === 'function') taiThongBao();
    if (typeof taiTongQuan === 'function') taiTongQuan();
    if (
      typeof currentActualWsId === 'string' &&
      currentActualWsId === wsId &&
      typeof window.moFormXacNhan === 'function'
    ) {
      document.getElementById('actual-modal')?.remove();
      await window.moFormXacNhan(wsId);
    }
  } catch (e) {
    toast('error', 'Không xóa được', e.message || String(e));
  }
};

let currentActualWsId = null;
window.moFormXacNhan = async function (wsId) {
  currentActualWsId = wsId;
  const isPpf = wsId.includes('PPF');
  const mauIcon = isPpf ? 'var(--red)' : 'var(--blue-light)';
  const iconKy = isPpf ? 'fa-shield-film' : 'fa-window-restore';

  let ws = {};
  let mcOptions = '<option value="">— Chọn mã vật tư —</option>';
  try {
    const [wsRes, scopeRes] = await Promise.all([
      fetch(`/api/workstreams/${encodeURIComponent(wsId)}`).then((r) => r.json()),
      fetch(`/api/workstreams/${encodeURIComponent(wsId)}/allocation-material-codes`).then((r) => r.json()),
    ]);
    ws = wsRes && !wsRes.error ? wsRes : {};
    const codes = Array.isArray(scopeRes.material_codes)
      ? scopeRes.material_codes.filter((c) => String(c || '').trim())
      : [];
    if (codes.length) {
      mcOptions += codes.map((v) => {
        const t = String(v).trim();
        return `<option value="${_esc(t)}">${_esc(t)}</option>`;
      }).join('');
    }
  } catch (e) {
    console.warn('[moFormXacNhan]', e);
  }

  const matDefault = (ws.selected_material_code || (isPpf ? 'T-TYPE' : 'JB20')).toString().trim();
  const st = (ws.allocated_source_type || 'LOT').toString().toUpperCase();
  const sid = (ws.allocated_source_id || '').toString();
  const parentLotReadonly = st === 'LOT' ? sid : '';
  const ktvId = (ws.assigned_technician_id || 'KTV-003').toString();
  const canXoaDotActual = ws.status === 'IN_PROGRESS' || ws.status === 'ACTUAL_CONFIRMATION_REQUIRED';

  const baseWf = ws.wf_allocation;
  const extraAllocs = collectExtraCutWfAllocations(ws);
  const hasExtra = !!(ws.extra_cut_requested && extraAllocs.length);
  let wfSummaryHtml = '';
  if (!isPpf && ws.workstream_type === 'WINDOW_FILM_INSTALLATION' && baseWf && Array.isArray(baseWf.items)) {
    let exSection = '';
    if (hasExtra) {
      const hist = Array.isArray(ws.extra_cut_history) ? ws.extra_cut_history : [];
      if (hist.length) {
        exSection = hist
          .map((ent, idx) => {
            if (!ent || typeof ent !== 'object') return '';
            const exa = ent.wf_allocation;
            const when = ent.requested_at ? fmtDt(ent.requested_at) : '—';
            const who = [ent.actor_name, ent.actor_id].filter(Boolean).join(' · ') || '—';
            const delB =
              canXoaDotActual && ent.proposal_id
                ? `<button type="button" class="btn btn-outline btn-sm" style="flex-shrink:0;padding:2px 8px;font-size:10px;border-color:rgba(248,113,113,0.45);color:#f87171" onclick="void window.xoaDeXuatCatThem('${_esc(String(wsId))}','${_esc(String(ent.proposal_id))}')"><i class="fa-solid fa-trash"></i></button>`
                : '';
            if (!exa || !Array.isArray(exa.items)) {
              return `<div class="muted" style="font-size:11px;margin-bottom:10px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;align-items:flex-start"><div><strong>${idx + 1}.</strong> ${_esc(when)} · ${_esc(who)}</div>${delB}</div>${jcExtraCutReasonHtml(ent.reason)}`;
            }
            return `<div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(251,191,36,0.15)">
              <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
              <div style="font-size:10px;font-weight:700;color:var(--text-secondary)">Đợt ${idx + 1} · ${_esc(when)} · ${_esc(who)}</div>${delB}</div>
              ${jcWfPhanBoBangHtml('Hạng mục &amp; nguồn cắt bổ sung', exa)}
              ${jcExtraCutReasonHtml(ent.reason)}
            </div>`;
          })
          .join('');
      } else {
        const exa = extraAllocs[0];
        const legDel =
          canXoaDotActual && exa
            ? `<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button type="button" class="btn btn-outline btn-sm" style="padding:2px 8px;font-size:10px;border-color:rgba(248,113,113,0.45);color:#f87171" onclick="void window.xoaDeXuatCatThem('${_esc(String(wsId))}','LEGACY-SNAPSHOT')"><i class="fa-solid fa-trash"></i> Xóa cắt thêm</button></div>`
            : '';
        exSection = `${legDel}${jcWfPhanBoBangHtml('Nhóm hạng mục &amp; nguồn — yêu cầu cắt bổ sung', exa)}${jcExtraCutReasonHtml(ws.extra_cut_reason)}`;
      }
    }
    const banDauHtml = jcWfPhanBoBangHtml('Nhóm hạng mục &amp; nguồn ban đầu', baseWf);
    const tongHtml = jcWfTongHopNguonHtml(baseWf, hasExtra ? collectExtraCutWfAllocations(ws) : null);
    if (banDauHtml || exSection || tongHtml) {
      wfSummaryHtml = `
        <div style="border:1px solid rgba(59,130,246,0.35);border-radius:8px;padding:12px;margin:12px 0;background:rgba(59,130,246,0.06)">
          <div style="font-size:12px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px;color:var(--blue-light)">
            <i class="fa-solid fa-list-check"></i> Tổng hợp phim sử dụng (đối chiếu)
          </div>
          <p class="muted" style="font-size:10px;margin:0 0 10px;line-height:1.45">Nhóm ban đầu (đã phê duyệt) và <strong>từng đợt</strong> cắt bổ sung đã đăng ký — chỉ để xác nhận; phần nhập mảnh dư bên dưới giữ nguyên.</p>
          ${banDauHtml}
          ${exSection}
          ${tongHtml}
        </div>`;
    }
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'actual-modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="demo-modal dyc-actual-modal" style="max-width:580px">
      <div class="demo-modal-header">
        <i class="fa-solid ${iconKy}" style="color:${mauIcon}"></i>
        <div>
          <h3>${isPpf ? 'Xác Nhận Thực Tế — Dán Phim PPF' : 'Xác Nhận Thực Tế — Dán Phim Cách Nhiệt'}</h3>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">${
            isPpf
              ? 'Nhập số liệu thực tế sau khi thi công để hệ thống trừ kho ảo'
              : 'Xác nhận hoàn tất theo phân bổ đã duyệt (+ cắt thêm nếu có); nhập mảnh dư (nếu có) bên dưới — hệ thống trừ kho theo bảng đối chiếu.'
          }</p>
        </div>
      </div>
      <div class="dyc-actual-modal-body" style="padding:16px 20px">
        <p class="muted" style="font-size:10px;margin:0 0 10px;line-height:1.4"><i class="fa-solid fa-arrows-up-down" style="opacity:0.7;margin-right:4px"></i>Cuộn khu vực này nếu nội dung dài (mảnh dư, ghi chú).</p>
        ${
          isPpf
            ? `<div style="background:rgba(255,143,0,0.07);border:1px solid rgba(255,143,0,0.2);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px">
          <i class="fa-solid fa-circle-info" style="color:var(--orange-light);margin-right:6px"></i>
          <strong style="color:var(--orange-light)">Lưu ý:</strong> Kích thước thực tế dùng để tính tiêu hao. Phần <strong>mảnh dư</strong> bên dưới dùng cùng thứ tự trường như <strong>Quản lý kho → Nhập mảnh dư thủ công</strong> (mã vật tư, R×D, chất lượng, vị trí). Mã <code>SUBLOT-…</code> được sinh khi bạn hoàn tất.<br/>
          <span style="font-size:11px;opacity:0.95">Cần <strong>cắt bổ sung giữa ca</strong>: dùng nút <strong>«Đăng ký cắt thêm»</strong> trên Lệnh thi công hoặc thẻ Luồng — không gộp vào form này.</span>
        </div>
        <div class="form-grid">
          <div class="field-group">
            <label>Kích thước block thực tế</label>
            <input type="text" id="act-block" class="field-input" value="152x1300" placeholder="vd: 152x143">
            <small style="color:var(--text-muted);font-size:10px;margin-top:3px">Định dạng: rộng × dài (cm)</small>
          </div>
          <div class="field-group">
            <label>Chiều rộng thực tế (m)</label>
            <input type="number" id="act-width" class="field-input" value="1.52" step="0.01">
          </div>
          <div class="field-group">
            <label>Chiều dài thực tế (m)</label>
            <input type="number" id="act-len" class="field-input" value="13.0" step="0.01">
            <small style="color:var(--text-muted);font-size:10px;margin-top:3px">Chiều dài phim đã sử dụng</small>
          </div>
          <div class="field-group">
            <label>Diện tích phế liệu (m²)</label>
            <input type="number" id="act-scrap" class="field-input" value="0.35" step="0.01">
          </div>
        </div>`
            : `<div style="background:rgba(255,143,0,0.07);border:1px solid rgba(255,143,0,0.2);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px">
          <i class="fa-solid fa-circle-info" style="color:var(--orange-light);margin-right:6px"></i>
          <strong style="color:var(--orange-light)">Lưu ý:</strong> <strong>Block và mét phim</strong> hệ thống lấy theo <strong>phân bổ đã duyệt + đăng ký cắt thêm</strong> (bảng đối chiếu bên dưới), không nhập lại ở đây. Phần <strong>mảnh dư</strong> tiếp theo dùng cùng thứ tự trường như <strong>Quản lý kho → Nhập mảnh dư thủ công</strong>. Mã <code>SUBLOT-…</code> được sinh khi hoàn tất.<br/>
          <span style="font-size:11px;opacity:0.95">Cần <strong>cắt bổ sung giữa ca</strong>: nút <strong>«Đăng ký cắt thêm»</strong> trên Lệnh thi công hoặc thẻ Luồng.</span>
        </div>`
        }
        ${wfSummaryHtml}
        <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin:12px 0">
          <div style="font-size:12px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <i class="fa-solid fa-scissors" style="color:var(--orange-light)"></i>
            Nhập mảnh dư (nếu có) — cùng cấu trúc với nhập thủ công
          </div>
          <p class="muted" style="font-size:12px;margin-bottom:10px;line-height:1.45">
            <strong>Mã vật tư</strong> chỉ hiển thị các mã <strong>đã nằm trong phân bổ phê duyệt</strong> của luồng (không phải toàn bộ kho).<br/>
            Nguồn luồng: <strong>${_esc(st)}</strong> <code>${_esc(sid || '—')}</code>.
            ${st === 'OFFCUT' ? ' Mã lô cha có thể được hệ thống suy ra từ mảnh nguồn khi ghi kho.' : ''}
            Không có mảnh dư thì để <strong>chiều rộng / chiều dài = 0</strong>.
          </p>
          <div class="form-grid">
            <div class="field-group"><label>Mã mảnh dư <span class="req">*</span></label>
              <input type="text" class="field-input" readonly value="Tự động (SUBLOT-… khi hoàn tất)" style="opacity:0.9"></div>
            <div class="field-group"><label>Mã lô cha</label>
              <input type="text" class="field-input" readonly value="${_esc(parentLotReadonly)}" placeholder="—"></div>
            <div class="field-group"><label>Mã vật tư <span class="req">*</span></label>
              <select id="act-oc-mc" class="field-input">${mcOptions}</select></div>
            <div class="field-group"><label>Chiều rộng (m) <span class="req">*</span></label>
              <input type="number" id="act-oc-wid" class="field-input" value="0" step="0.01" min="0" placeholder="0 nếu không có mảnh dư"></div>
            <div class="field-group"><label>Chiều dài (m) <span class="req">*</span></label>
              <input type="number" id="act-oc-len" class="field-input" value="0" step="0.01" min="0" placeholder="0 nếu không có mảnh dư"></div>
            <div class="field-group"><label>Trạng thái chất lượng <span class="req">*</span></label>
              <select id="act-oc-qual" class="field-input">
                <option value="GOOD">Tốt (GOOD)</option>
                <option value="NORMAL" selected>Bình thường (NORMAL)</option>
                <option value="POOR">Kém (POOR)</option>
              </select></div>
            <div class="field-group"><label>Vị trí lưu kho <span class="req">*</span></label>
              <input type="text" id="act-oc-loc" class="field-input" value="OFFCUT-RACK-C" placeholder="VD: OFFCUT-RACK-C"></div>
            <div class="field-group"><label>Người thực hiện</label>
              <input type="text" id="act-by" class="field-input" readonly value="${_esc(ktvId)}"></div>
            <div class="field-group full-width"><label>Ghi chú</label>
              <input type="text" id="act-note" class="field-input" placeholder="Không có vấn đề gì / Ghi chú thêm..."></div>
          </div>
        </div>
      </div>
      <div class="demo-modal-footer" style="display:flex">
        <button class="btn btn-outline" onclick="document.getElementById('actual-modal').remove()">
          <i class="fa-solid fa-xmark"></i> Hủy
        </button>
        <button class="btn btn-green" onclick="xacNhanVaHoanTat()">
          <i class="fa-solid fa-check"></i> Xác nhận & Trừ kho — Hoàn tất
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const mcSel = document.getElementById('act-oc-mc');
  if (mcSel && matDefault) {
    const opt = Array.from(mcSel.options).find((o) => o.value === matDefault);
    if (opt) mcSel.value = matDefault;
    else {
      mcSel.insertAdjacentHTML(
        'beforeend',
        `<option value="${_esc(matDefault)}">${_esc(matDefault)} — (theo luồng)</option>`,
      );
      mcSel.value = matDefault;
    }
  }
};

window.xacNhanVaHoanTat = async function() {
  const wsId = currentActualWsId;
  const ws = await fetch(`/api/workstreams/${wsId}`).then(r => r.json());
  const val = await fetch(`/api/inventory/validate-sources/${encodeURIComponent(ws.request_id)}`).then(r => r.json());
  const err = (val.issues || []).filter(i => i.severity === 'ERROR');
  if (err.length) {
    toast('error', 'Nguồn vật tư không hợp lệ', err.map(i => `${i.workstream_id}: ${i.message}`).join(' | '));
    return;
  }
  const ocLen = parseFloat(document.getElementById('act-oc-len').value);
  const ocWid = parseFloat(document.getElementById('act-oc-wid').value);
  const hasOc =
    (Number.isFinite(ocLen) && ocLen > 0) || (Number.isFinite(ocWid) && ocWid > 0);
  if (hasOc) {
    if (!Number.isFinite(ocLen) || ocLen <= 0 || !Number.isFinite(ocWid) || ocWid <= 0) {
      toast(
        'error',
        'Mảnh dư',
        'Nhập đủ chiều rộng và chiều dài mảnh dư (m) > 0 — cùng quy tắc với form Nhập mảnh dư thủ công.',
      );
      return;
    }
    const mc = document.getElementById('act-oc-mc')?.value?.trim();
    if (!mc) {
      toast('error', 'Mảnh dư', 'Chọn mã vật tư.');
      return;
    }
    const loc = document.getElementById('act-oc-loc')?.value?.trim();
    if (!loc) {
      toast('error', 'Mảnh dư', 'Nhập vị trí lưu kho.');
      return;
    }
  }
  const blockEl = document.getElementById('act-block');
  const widthEl = document.getElementById('act-width');
  const lenEl = document.getElementById('act-len');
  const scrapEl = document.getElementById('act-scrap');
  let actual_cut_block;
  let actual_width_m;
  let actual_length_m;
  let has_scrap;
  let scrap_area_m2;
  if (blockEl && widthEl && lenEl && scrapEl) {
    actual_cut_block = blockEl.value;
    actual_width_m = parseFloat(widthEl.value);
    actual_length_m = parseFloat(lenEl.value);
    scrap_area_m2 = parseFloat(scrapEl.value);
    has_scrap = Number.isFinite(scrap_area_m2) && scrap_area_m2 > 0;
  } else if (ws.workstream_type === 'WINDOW_FILM_INSTALLATION') {
    actual_cut_block = (ws.planned_cut_block || '152x143').toString().trim();
    const firstCm = actual_cut_block.toLowerCase().split('x')[0];
    const wFromBlock = firstCm ? parseFloat(firstCm) / 100 : NaN;
    actual_width_m = Number.isFinite(wFromBlock) && wFromBlock > 0 ? wFromBlock : 1.52;
    let len = sumWfSelectedRequiredLengthM(ws.wf_allocation);
    len += sumAllExtraCutRequiredLengthM(ws);
    const pd = parseFloat(ws.planned_deduction_length_m);
    if (!Number.isFinite(len) || len <= 0) len = Number.isFinite(pd) && pd > 0 ? pd : 1.43;
    actual_length_m = len;
    scrap_area_m2 = 0;
    has_scrap = false;
  } else {
    toast('error', 'Form', 'Thiếu ô nhập kích thước thực tế.');
    return;
  }
  const payload = {
    actual_cut_block,
    actual_width_m,
    actual_length_m,
    has_new_offcut: hasOc,
    offcut_length_m: Number.isFinite(ocLen) ? ocLen : 0,
    offcut_width_m: Number.isFinite(ocWid) ? ocWid : 0,
    offcut_quality_status: document.getElementById('act-oc-qual').value,
    offcut_storage_location: document.getElementById('act-oc-loc').value,
    offcut_material_code: hasOc ? document.getElementById('act-oc-mc')?.value?.trim() || undefined : undefined,
    has_scrap,
    scrap_area_m2: Number.isFinite(scrap_area_m2) ? scrap_area_m2 : 0,
    technician_note: document.getElementById('act-note').value,
  };
  try {
    const r0 = await fetch(`/api/workstreams/${wsId}/submit-actual`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const d0 = await r0.json().catch(() => ({}));
    if (!r0.ok) {
      const det = d0.detail;
      let m = `Lỗi ${r0.status}`;
      if (typeof det === 'string') m = det;
      else if (det && typeof det === 'object' && det.message) m = String(det.message);
      else if (det && typeof det === 'object') m = JSON.stringify(det);
      throw new Error(m);
    }
    const r1 = await fetch(`/api/workstreams/${wsId}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    const res = await r1.json().catch(() => ({}));
    if (!r1.ok) {
      const det = res.detail;
      let m = `Lỗi ${r1.status}`;
      if (typeof det === 'string') m = det;
      else if (det && typeof det === 'object' && det.message) m = String(det.message);
      else if (det && typeof det === 'object') m = JSON.stringify(det);
      throw new Error(m);
    }
    if (res.status === 'info') {
      document.getElementById('actual-modal')?.remove();
      toast('info', '⚠️ Cần thêm bước', res.detail || 'Không thể đóng luồng.');
      await taiDonThiCong();
      if (typeof taiLenhThiCong === 'function') await taiLenhThiCong();
      taiThongBao();
      taiTongQuan();
      return;
    }
    document.getElementById('actual-modal')?.remove();
    toast('success', '✅ Luồng đã hoàn tất & đóng', res.detail || '');
    await taiDonThiCong();
    if (typeof taiLenhThiCong === 'function') await taiLenhThiCong();
    taiThongBao();
    taiTongQuan();
  } catch(e) { toast('error', 'Lỗi xác nhận', e.message); }
};

// ─── CHỈNH SỬA LUỒNG (WF: form đầy đủ | PPF PENDING: modal phân bổ ppf_preflight_editor.js) ───
let currentWsEditId = null;
let _wsEditDirty = false;
let _wsEditModePpf = false;

window.chiinhSuaWs = async function(wsId) {
  try {
  currentWsEditId = wsId;
  const ws = await fetch(`/api/workstreams/${wsId}`).then(r => r.json());
  const isPpf = ws.workstream_type === 'PPF_INSTALLATION';
  const isWf = ws.workstream_type === 'WINDOW_FILM_INSTALLATION';
  if (isWf && ws.status === 'PENDING_APPROVAL' && typeof window.moModalDuyetMaPhimWF === 'function') {
    await window.moModalDuyetMaPhimWF(wsId);
    return;
  }
  if (
    ws.status === 'PENDING_APPROVAL' &&
    isPpf &&
    typeof window.openWorkstreamAllocationModal === 'function'
  ) {
    const [lots, offcuts] = await Promise.all([
      fetch('/api/lots').then((r) => r.json()),
      fetch('/api/offcuts').then((r) => r.json()),
    ]);
    _wsEditModePpf = true;
    _wsEditDirty = false;
    await window.openWorkstreamAllocationModal(wsId, ws, lots, offcuts);
    return;
  }
  if (
    isWf &&
    ws.status !== 'PENDING_APPROVAL' &&
    ws.wf_allocation &&
    Array.isArray(ws.wf_allocation.items) &&
    ws.wf_allocation.items.length > 0 &&
    typeof window.openWorkstreamAllocationModal === 'function'
  ) {
    const [lots, offcuts] = await Promise.all([
      fetch('/api/lots').then((r) => r.json()),
      fetch('/api/offcuts').then((r) => r.json()),
    ]);
    _wsEditModePpf = false;
    _wsEditDirty = false;
    await window.openWorkstreamAllocationModal(wsId, ws, lots, offcuts);
    return;
  }
  _wsEditModePpf = false;
  const _mse = document.querySelector('.ws-edit-modal-inner');
  if (_mse) _mse.style.maxWidth = '';
  const tenLoai = isPpf ? 'Dán Phim PPF' : 'Dán Phim Cách Nhiệt';
  const mauIcon = isPpf ? 'var(--red)' : 'var(--blue-light)';

  document.getElementById('ws-edit-title').textContent = `Chỉnh Sửa — ${tenLoai}`;
  document.getElementById('ws-edit-subtitle').textContent = `${wsId} | Đơn: ${ws.request_id} | Trạng thái: ${TRANG_THAI_VI[ws.status] || ws.status}`;

  // Lấy hạng mục hiện tại
  const hangMucHienTai = (ws.job_items || '').split(';').filter(Boolean);

  const body = document.getElementById('ws-edit-body');
  body.innerHTML = `
    <!-- HƯỚNG DẪN -->
    <div class="edit-guide-box">
      <i class="fa-solid fa-circle-info" style="color:${mauIcon};font-size:16px;flex-shrink:0;margin-top:2px"></i>
      <div>
        <strong style="color:${mauIcon}">Hướng dẫn chỉnh sửa</strong>
        <p style="margin:4px 0 0;color:var(--text-secondary);font-size:12px;line-height:1.6">
          Bạn có thể chỉnh sửa: <strong style="color:var(--text-primary)">loại phim, kích thước block, chiều dài khấu trừ, nguồn vật tư, hạng mục thi công, và đội kỹ thuật viên</strong>.
          Mọi thay đổi đều phải có lý do rõ ràng và sẽ được ghi vào nhật ký kiểm toán.
          ${ws.status === 'CLOSED' ? '<br><strong style="color:var(--red-light)">⚠️ Luồng đã đóng — không thể chỉnh sửa.</strong>' : ''}
        </p>
      </div>
    </div>

    <!-- PHẦN 1: LOẠI PHIM -->
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
          <select id="edit-source-type" class="field-input">
            <option value="LOT" ${ws.allocated_source_type === 'LOT' ? 'selected' : ''}>Cuộn LOT (nguyên)</option>
            <option value="OFFCUT" ${ws.allocated_source_type === 'OFFCUT' ? 'selected' : ''}>Mảnh dư (Offcut)</option>
          </select>
        </div>
        <div class="field-group">
          <label>Mã cuộn LOT / Mảnh dư</label>
          <input type="text" id="edit-source-id" class="field-input" value="${ws.allocated_source_id || ''}" placeholder="vd: LOT-JB20-001">
          <small class="field-hint">Nhập mã LOT hoặc mảnh dư có trong kho. Xem tab "Kho cuộn LOT" để tra cứu.</small>
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
    </div>

    <!-- PHẦN 5: ĐỘI KỸ THUẬT VIÊN -->
    <div class="edit-section">
      <div class="edit-section-title"><i class="fa-solid fa-users" style="color:${mauIcon}"></i> 5. Đội Kỹ Thuật Viên</div>
      <div class="form-grid" style="gap:12px">
        <div class="field-group">
          <label>Tên đội</label>
          <input type="text" id="edit-team" class="field-input" value="${ws.technician_team || ''}">
        </div>
        <div class="field-group">
          <label>Tên KTV phụ trách</label>
          <input type="text" id="edit-tech-name" class="field-input" value="${ws.assigned_technician_name || ''}">
        </div>
      </div>
    </div>

    <!-- LÝ DO BẮT BUỘC -->
    <div class="edit-section" style="border-color:rgba(229,57,53,0.3);background:rgba(229,57,53,0.04)">
      <div class="edit-section-title" style="color:var(--red-light)"><i class="fa-solid fa-pen-to-square"></i> Lý Do Thay Đổi <span style="color:var(--red)">*</span></div>
      <p class="edit-hint">Bắt buộc nhập lý do cho mọi thay đổi. Thông tin này sẽ được ghi vào nhật ký kiểm toán.</p>
      <textarea id="edit-reason" class="field-input" rows="3" style="width:100%;resize:vertical" placeholder="vd: Khách yêu cầu đổi sang phim mờ M-TYPE / Điều chỉnh kích thước theo thực tế xe / Đổi LOT vì LOT cũ hết hàng..."></textarea>
    </div>
  `;

  document.getElementById('btn-ws-edit-save').onclick = () => luuChinhSuaWs(ws, isPpf);
  document.getElementById('ws-edit-modal').style.display = 'flex';
  } catch(err) {
    console.error(err);
    if (typeof toast === 'function') toast('error', 'Lỗi', err.message);
    else alert('Lỗi: ' + err.message);
  }
};

window.chonLoaiPhim = function(matId, btnEl, groupId, hiddenId) {
  document.querySelectorAll(`#${groupId} .mat-option`).forEach(b => b.classList.remove('selected'));
  btnEl.classList.add('selected');
  document.getElementById(hiddenId).value = matId;
  const warnBox = document.getElementById('ppf-change-reason-box');
  if (warnBox) warnBox.style.display = matId === 'M-TYPE' ? 'flex' : 'none';
};

async function luuChinhSuaWs(ws, isPpf) {
  const reason = document.getElementById('edit-reason').value.trim();
  if (!reason) { toast('warning', 'Thiếu lý do', 'Vui lòng nhập lý do thay đổi trước khi lưu.'); return; }

  const hangMucChon = [...document.querySelectorAll('#hang-muc-grid input[type="checkbox"]:checked')].map(c => c.value);

  const payload = {
    reason,
    planned_cut_block: document.getElementById('edit-cut-block')?.value,
    planned_deduction_length_m: parseFloat(document.getElementById('edit-deduction')?.value || 0),
    allocated_source_type: document.getElementById('edit-source-type')?.value,
    allocated_source_id: document.getElementById('edit-source-id')?.value,
    assigned_technician_name: document.getElementById('edit-tech-name')?.value,
    technician_team: document.getElementById('edit-team')?.value,
    job_items: hangMucChon.join(';'),
  };

  if (isPpf) {
    payload.selected_material_code = document.getElementById('edit-ppf-type')?.value;
  }

  try {
    const data = await fetch(`/api/workstreams/${currentWsEditId}/edit`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    }).then(r => r.json());
    toast('success', '✅ Lưu thay đổi thành công', data.detail);
    closeWsEdit();
    await taiDonThiCong();
  } catch(e) { toast('error', 'Lỗi lưu', e.message); }
}

window.closeWsEdit = function() {
  if (typeof _wsEditDirty !== 'undefined' && _wsEditDirty) {
    if (!confirm('Bạn có thay đổi chưa lưu. Đóng cửa sổ?')) return;
  }
  _wsEditDirty = false;
  _wsEditModePpf = false;
  if (window.__waEditorCtx) window.__waEditorCtx.extraCutMode = false;
  const sb = document.getElementById('btn-ws-edit-save');
  if (sb) {
    sb.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi';
    sb.onclick = null;
  }
  const inner = document.querySelector('.ws-edit-modal-inner');
  if (inner) inner.style.maxWidth = '';
  document.getElementById('ws-edit-modal').style.display = 'none';
  currentWsEditId = null;
};

window.chuyenDenLenh = function(jcId) {
  document.querySelector('[data-tab="jobcards"]').click();
  setTimeout(() => { currentJobId = jcId; taiLenhThiCong(); }, 200);
};

// Nút chạy agent
document.getElementById('btn-run-step').addEventListener('click', chayBuocAgent);
const stepBtn2 = document.getElementById('btn-run-step-2');
if (stepBtn2) stepBtn2.addEventListener('click', chayBuocAgent);

async function chayBuocAgent() {
  if (!currentRequestId) return;
  const btn = document.getElementById('btn-run-step');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang xử lý...';
  try {
    const data = await fetch(`/api/requests/${currentRequestId}/step`, { method: 'POST' }).then(r => r.json());
    toast(data.status === 'success' ? 'success' : data.status === 'exception' ? 'error' : 'info',
      data.status === 'success' ? '✅ Agent hoàn tất bước' : '⚠️ Ngoại lệ phát sinh', data.detail);
    await taiDonThiCong(); taiThongBao();
  } catch(e) { toast('error', 'Lỗi agent', e.message); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-robot"></i> Chạy AI Agent'; }
}

document.getElementById('btn-hitl-approve').addEventListener('click', async () => {
  if (!currentRequestId) return;
  document.getElementById('btn-hitl-approve').disabled = true;
  try {
    const data = await fetch(`/api/requests/${currentRequestId}/approve`, { method: 'POST' }).then(r => r.json());
    toast('success', '✅ Phê duyệt thành công', data.detail);
    await taiDonThiCong(); taiThongBao();
  } catch(e) { toast('error', 'Lỗi phê duyệt', e.message); }
  finally { document.getElementById('btn-hitl-approve').disabled = false; }
});

document.getElementById('btn-hitl-complete').addEventListener('click', async () => {
  if (!currentRequestId) return;
  const btn = document.getElementById('btn-hitl-complete');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>...';
  const payload = {
    actual_cut_block: document.getElementById('input-actual-block').value,
    actual_length_m: parseFloat(document.getElementById('input-actual-len').value),
    created_offcut_length_m: parseFloat(document.getElementById('input-offcut-len').value),
    created_offcut_width_m: parseFloat(document.getElementById('input-offcut-width').value),
    created_offcut_quality: document.getElementById('input-offcut-quality').value,
    created_offcut_location: document.getElementById('input-offcut-location').value,
    scrap_area_m2: parseFloat(document.getElementById('input-scrap').value),
    exception_reason: document.getElementById('input-exception').value,
    technician_id: 'KTV-003',
  };
  try {
    const data = await fetch(`/api/requests/${currentRequestId}/complete`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    }).then(r => r.json());
    toast(data.status === 'success' ? 'success' : 'warning', data.status === 'success' ? '✅ Hoàn tất!' : '⚠️ Cần xem lại', data.detail);
    await taiDonThiCong(); taiThongBao();
  } catch(e) { toast('error', 'Lỗi', e.message); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-warehouse"></i> Xác Nhận & Trừ Kho Ảo'; }
});

document.getElementById('btn-run-all-e2e').addEventListener('click', () => { if (currentRequestId) chayDemoModal(currentRequestId); });
document.getElementById('btn-retry-exception')?.addEventListener('click', chayBuocAgent);

// ═══════════════════════════════════════════════════════════════════════════════
// BẢNG LUỒNG THI CÔNG
// ═══════════════════════════════════════════════════════════════════════════════
let __wsTableSort = { key: 'created_at', dir: 'desc' };
let __wsListPage = 0;
let __wsDateFiltersInitialized = false;

function _wsDefaultStartDateRangeYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const d = now.getDate();
  const firstPrev = new Date(y, mo - 1, 1);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    from: `${firstPrev.getFullYear()}-${pad(firstPrev.getMonth() + 1)}-${pad(firstPrev.getDate())}`,
    to: `${y}-${pad(mo + 1)}-${pad(d)}`,
  };
}

function _wsDayBoundaryLocalMs(y, m0, d, endOfDay) {
  if (endOfDay) return new Date(y, m0, d, 23, 59, 59, 999).getTime();
  return new Date(y, m0, d, 0, 0, 0, 0).getTime();
}

/** @returns {{ lo: number, hi: number } | null} null = không lọc theo ngày */
function _wsParseYmdBounds(fromYmd, toYmd) {
  const f = (fromYmd || '').trim();
  const t = (toYmd || '').trim();
  if (!f && !t) return null;
  let lo = -Infinity;
  let hi = Infinity;
  if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
    const [y, m, d] = f.split('-').map(Number);
    lo = _wsDayBoundaryLocalMs(y, m - 1, d, false);
  }
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    hi = _wsDayBoundaryLocalMs(y, m - 1, d, true);
  }
  return { lo, hi };
}

/** Lọc theo ngày tạo đơn (request.created_at), không dùng started_at */
function _wsRequestCreatedInRange(w, bounds) {
  if (!bounds) return true;
  const raw = w.request_created_at;
  if (raw == null || String(raw).trim() === '') return false;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return false;
  const dayMs = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  return dayMs >= bounds.lo && dayMs <= bounds.hi;
}

function _wsReadPageSize() {
  const el = document.getElementById('ws-page-size');
  if (!el) return 10;
  const v = parseInt(String(el.value), 10);
  return [10, 20, 50, 100].includes(v) ? v : 10;
}

function _wsUpdatePaginationBar(total, pageSize, pageIndex, maxPageIndex) {
  const info = document.getElementById('ws-page-info');
  const prev = document.getElementById('ws-page-prev');
  const next = document.getElementById('ws-page-next');
  if (info) {
    const from = total === 0 ? 0 : pageIndex * pageSize + 1;
    const to = Math.min(total, (pageIndex + 1) * pageSize);
    const np = maxPageIndex + 1;
    info.textContent =
      total === 0
        ? '0 luồng'
        : `Hiển thị ${from}–${to} / ${total} luồng · Trang ${pageIndex + 1}/${np}`;
  }
  if (prev) prev.disabled = pageIndex <= 0;
  if (next) next.disabled = pageIndex >= maxPageIndex || total === 0;
}

function _wsSortTimeMs(isoOrEmpty) {
  if (!isoOrEmpty) return 0;
  const t = new Date(isoOrEmpty);
  return isNaN(t.getTime()) ? 0 : t.getTime();
}

function _wsSortDeadlineMs(w) {
  const d = parseDeliveryDateStartOfDay(w.requested_delivery_time || '');
  return d ? d.getTime() : 0;
}

function _wsSortValue(w, key) {
  switch (key) {
    case 'workstream_id':
      return (w.workstream_id || '').toLowerCase();
    case 'request_id':
      return (w.request_id || '').toLowerCase();
    case 'request_created_at':
      return _wsSortTimeMs(w.request_created_at);
    case 'workstream_type':
      return (w.workstream_type || '').toLowerCase();
    case 'technician_name':
      return String(w.assigned_technician_name || w.assigned_technician_id || '—')
        .toLowerCase()
        .trim();
    case 'requested_delivery_time':
      return _wsSortDeadlineMs(w);
    case 'status':
      return (w.status || '').toLowerCase();
    case 'started_at':
      return _wsSortTimeMs(w.started_at);
    case 'completed_at':
      return _wsSortTimeMs(w.completed_at);
    case 'actions_mgr':
    case 'actions_ktv':
      return (w.status || '').toLowerCase();
    case 'created_at':
      return _wsSortTimeMs(w.created_at);
    default:
      return '';
  }
}

function _wsCompareRows(a, b) {
  const { key, dir } = __wsTableSort;
  const mul = dir === 'asc' ? 1 : -1;
  const va = _wsSortValue(a, key);
  const vb = _wsSortValue(b, key);
  let c = 0;
  if (typeof va === 'number' && typeof vb === 'number') {
    if (va < vb) c = -1;
    else if (va > vb) c = 1;
  } else {
    const sa = String(va);
    const sb = String(vb);
    c = sa < sb ? -1 : sa > sb ? 1 : 0;
  }
  if (c !== 0) return c * mul;
  return String(a.workstream_id || '').localeCompare(String(b.workstream_id || ''), 'vi');
}

function wsUpdateWorkstreamSortHeaders() {
  const root = document.getElementById('tab-workstreams');
  if (!root) return;
  root.querySelectorAll('thead th.ws-sortable').forEach((th) => {
    const k = th.getAttribute('data-ws-sort');
    const icon = th.querySelector('.ws-sort-icon');
    if (!icon) return;
    if (k === __wsTableSort.key) {
      icon.className =
        'fa-solid ws-sort-icon ' + (__wsTableSort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
    } else {
      icon.className = 'fa-solid fa-sort ws-sort-icon';
    }
  });
}

window.wsToggleWorkstreamSort = function (key) {
  if (__wsTableSort.key === key) {
    __wsTableSort.dir = __wsTableSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    __wsTableSort.key = key;
    __wsTableSort.dir =
      key === 'requested_delivery_time' ||
      key === 'request_created_at' ||
      key === 'started_at' ||
      key === 'completed_at' ||
      key === 'created_at'
        ? 'desc'
        : 'asc';
  }
  __wsListPage = 0;
  void taiBangLuong();
};

async function taiBangLuong() {
  const wss = await fetch('/api/workstreams').then((r) => r.json());
  const fromEl = document.getElementById('ws-filter-start-from');
  const toEl = document.getElementById('ws-filter-start-to');
  if (fromEl && toEl && !__wsDateFiltersInitialized) {
    const r = _wsDefaultStartDateRangeYmd();
    fromEl.value = r.from;
    toEl.value = r.to;
    __wsDateFiltersInitialized = true;
  }
  const filterType = document.getElementById('ws-filter-type')?.value || '';
  const filterStatus = document.getElementById('ws-filter-status')?.value || '';
  const fromYmd = fromEl?.value?.trim() || '';
  const toYmd = toEl?.value?.trim() || '';
  const dateBounds = _wsParseYmdBounds(fromYmd, toYmd);
  const loc = wss.filter(
    (w) =>
      (!filterType || w.workstream_type === filterType) &&
      (!filterStatus || w.status === filterStatus) &&
      _wsRequestCreatedInRange(w, dateBounds),
  );
  loc.sort(_wsCompareRows);
  const pageSize = _wsReadPageSize();
  const total = loc.length;
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  if (__wsListPage > maxPage) __wsListPage = maxPage;
  const start = __wsListPage * pageSize;
  const pageRows = loc.slice(start, start + pageSize);
  _wsUpdatePaginationBar(total, pageSize, __wsListPage, maxPage);
  const tbody = document.getElementById('table-ws-body');
  if (!tbody) return;
  const techName = (w) =>
    String((w.assigned_technician_name || '').trim() || w.assigned_technician_id || '').trim() || '—';
  const deadlineCell = (w) => {
    const raw = w.requested_delivery_time;
    if (!raw) return '—';
    return `<span class="ws-td-deadline">${_esc(fmtDt(raw))}</span>`;
  };
  // Gán màu nền xen kẽ theo đơn (request_id) + đánh dấu đơn đa luồng
  const _wsReqOrder = [];
  const _wsReqIdxMap = {};
  const _wsReqCount = {};
  pageRows.forEach(w => {
    if (!(w.request_id in _wsReqIdxMap)) {
      _wsReqIdxMap[w.request_id] = _wsReqOrder.length;
      _wsReqOrder.push(w.request_id);
    }
    _wsReqCount[w.request_id] = (_wsReqCount[w.request_id] || 0) + 1;
  });

  tbody.innerHTML =
    pageRows.length === 0
      ? '<tr><td colspan="11" class="text-center muted" style="padding:20px">Không có luồng thi công nào.</td></tr>'
      : pageRows
          .map(
            (w) => {
              const _grpIdx = _wsReqIdxMap[w.request_id];
              const _isMulti = _wsReqCount[w.request_id] > 1;
              const _rowBg = _grpIdx % 2 !== 0 ? 'background:#eef6ff;' : '';
              const _leftBorder = _isMulti ? 'border-left:3px solid #1a6fc4;' : 'border-left:3px solid transparent;';
              const _multiTitle = _isMulti ? ` title="Đơn ${_wsReqCount[w.request_id]} luồng"` : '';
              return `<tr style="${_rowBg}${_leftBorder}">
        <td><strong class="ws-td-primary">${_esc(w.workstream_id)}</strong></td>
        <td><a href="#" onclick="xemNhanhDonThiCong('${w.request_id}', '${w.workstream_id}'); return false;" class="ws-td-link"${_multiTitle}>${_esc(w.request_id)}${_isMulti ? ` <span style="font-size:10px;background:#1a6fc4;color:#fff;border-radius:3px;padding:1px 5px;vertical-align:middle">${_wsReqCount[w.request_id]} luồng</span>` : ''}</a></td>
        <td class="ws-td-primary ws-td-dt">${_esc(fmtDt(w.request_created_at))}</td>
        <td>${loaiLuongBadge(w.workstream_type)}</td>
        <td class="ws-td-primary">${_esc(techName(w))}</td>
        <td class="ws-td-primary">${deadlineCell(w)}</td>
        <td>${trangThaiBadge(w.status)}</td>
        <td class="ws-td-primary ws-td-dt">${_esc(fmtDt(w.started_at))}</td>
        <td class="ws-td-primary ws-td-dt">${_esc(fmtDt(w.completed_at))}</td>
        <td style="white-space:nowrap">
          ${w.status === 'PENDING_APPROVAL' && (w.workstream_type === 'WINDOW_FILM_INSTALLATION' || w.workstream_type === 'GLASS_FILM_INSTALLATION') && window.dycPerm('can_post_approve_wf_materials') ? `<button class="btn btn-green btn-sm" onclick="moModalDuyetMaPhimWF('${w.workstream_id}')">Duyệt mã phim</button>` : ''}
        </td>
        <td style="white-space:nowrap">
          ${w.status === 'PENDING_APPROVAL' && w.workstream_type !== 'WINDOW_FILM_INSTALLATION' && w.workstream_type !== 'GLASS_FILM_INSTALLATION' && window.dycPerm('can_approve_ppf_pending_workstream') ? `<button class="btn btn-green btn-sm" onclick="pheDuyetNhanhWs('${w.workstream_id}')">Duyệt</button>` : ''}
          ${w.status === 'PENDING_TECH_PREFLIGHT' && (w.workstream_type === 'WINDOW_FILM_INSTALLATION' || w.workstream_type === 'GLASS_FILM_INSTALLATION') ? `${window.dycPerm('can_write_allocation') ? `<button class="btn btn-outline btn-sm" onclick="chiinhSuaWs('${w.workstream_id}')">LOT</button>` : ''}${window.dycPerm('can_approve_wf_preflight_commit') ? `<button class="btn btn-green btn-sm" style="margin-left:4px" onclick="pheDuyetNhanhWs('${w.workstream_id}')">Chốt</button>` : ''}` : ''}
          ${w.status === 'APPROVED' ? `<button class="btn btn-blue btn-sm" onclick="batDauWs('${w.workstream_id}')">Bắt đầu</button>` : ''}
          ${w.status === 'IN_PROGRESS' && w.workstream_type === 'FLOOR_MAT_INSTALLATION' ? `<button class="btn btn-primary btn-sm" onclick="hoanTatThamSan('${w.workstream_id}')"><i class="fa-solid fa-check"></i> Hoàn tất thảm sàn</button>` : ''}
          ${(w.status === 'IN_PROGRESS' || w.status === 'ACTUAL_CONFIRMATION_REQUIRED') && w.workstream_type !== 'FLOOR_MAT_INSTALLATION' ? `<button class="btn btn-primary btn-sm" onclick="moFormXacNhan('${w.workstream_id}')">Hoàn tất</button><button class="btn btn-outline btn-sm" style="margin-left:4px;border-color:rgba(251,191,36,0.45);color:#fbbf24" onclick="moDangKyCatThem('${w.workstream_id}')" title="Đăng ký cắt thêm"><i class="fa-solid fa-scissors"></i></button>` : ''}
          <button class="btn btn-outline btn-sm" style="margin-left:4px" onclick="chiinhSuaWs('${w.workstream_id}')"><i class="fa-solid fa-pen"></i></button>
        </td>
      </tr>`;
            },
          )
          .join('');
  wsUpdateWorkstreamSortHeaders();
}

['ws-filter-type', 'ws-filter-status', 'ws-filter-start-from', 'ws-filter-start-to'].forEach((id) => {
  document.getElementById(id)?.addEventListener('change', () => {
    __wsListPage = 0;
    void taiBangLuong();
  });
});
document.getElementById('ws-page-size')?.addEventListener('change', () => {
  __wsListPage = 0;
  void taiBangLuong();
});
document.getElementById('ws-page-prev')?.addEventListener('click', () => {
  if (__wsListPage > 0) {
    __wsListPage -= 1;
    void taiBangLuong();
  }
});
document.getElementById('ws-page-next')?.addEventListener('click', () => {
  __wsListPage += 1;
  void taiBangLuong();
});

function _quickReqWorkstreamLabelVi(t) {
  if (t === 'PPF_INSTALLATION') return 'PPF';
  if (t === 'WINDOW_FILM_INSTALLATION') return 'Phim cách nhiệt';
  if (t === 'GLASS_FILM_INSTALLATION') return 'Cường lực';
  if (t === 'FLOOR_MAT_INSTALLATION') return 'Thảm sàn';
  return t || '—';
}

function _quickReqServicesHtml(req) {
  const j = (req.job_items || '').toString().trim();
  if (j) return _esc(j);
  try {
    const raw = req.service_selection_json || req.service_selection;
    const sel = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!sel || typeof sel !== 'object') return '—';
    const parts = [];
    const svc = (sel.services || '').toString().trim();
    if (svc) parts.push(`<span class="muted">Gói dịch vụ:</span> ${_esc(svc)}`);
    const rows = [
      [sel.service_1, sel.film_type_1],
      [sel.service_2, sel.film_type_2],
    ];
    rows.forEach((pair, idx) => {
      const line = [pair[0], pair[1]].filter(Boolean).join(' — ');
      if (line) parts.push(`${idx + 1}. ${_esc(line)}`);
    });
    if (!parts.length) return '—';
    return parts.join('<br/>');
  } catch (_) {
    return '—';
  }
}

function _quickReqOcrImageHtml(fn) {
  if (fn == null || String(fn).trim() === '') return '—';
  const name = String(fn).trim();
  const enc = encodeURIComponent(name);
  const href = /^IMG-/i.test(name) ? `/static/uploads/${enc}` : `/static/test_orders/${enc}`;
  return `<a href="${href}" class="quick-req-ocr-link" target="_blank" rel="noopener">Xem ảnh</a> <span class="muted" style="font-size:10px;font-weight:500">(${_esc(name)})</span>`;
}

async function xemNhanhDonThiCong(requestId, workstreamId) {
  try {
    const req = await fetch('/api/requests/' + requestId).then(r => r.json());
    if(req.error) {
      alert('Không tìm thấy đơn');
      return;
    }
    const ws = await fetch('/api/workstreams/' + workstreamId).then(r => r.json()).catch(() => ({}));
    
    const techId = ws.technician_id || req.technician_id || '—';

    const cap = document.getElementById('quick-req-ws-caption');
    if (cap) {
      const wid = ws.workstream_id || workstreamId || '—';
      const lab = _quickReqWorkstreamLabelVi(ws.workstream_type);
      cap.textContent = `Luồng đang xem: ${wid} · ${lab}`;
    }

    document.getElementById('quick-req-id').textContent = req.request_id || '';
    document.getElementById('quick-req-status').innerHTML = trangThaiBadge(req.status);
    document.getElementById('quick-req-dealer').textContent = req.dealer_name || req.dealer_id || '—';
    const src = (req.source_channel || '').toUpperCase();
    document.getElementById('quick-req-source').textContent =
      src === 'MANUAL' ? 'Thủ công (MANUAL)' : src === 'OCR' ? 'OCR' : req.source_channel || '—';
    document.getElementById('quick-req-ticket').textContent = (req.request_no || '').trim() || '—';
    document.getElementById('quick-req-contract').textContent = (req.contract_no || '').trim() || '—';
    document.getElementById('quick-req-date').textContent = req.request_date || '—';
    document.getElementById('quick-req-ocr-img').innerHTML = _quickReqOcrImageHtml(req.ocr_source_image);
    document.getElementById('quick-req-sales').textContent = (req.sales_consultant || '').trim() || '—';

    const qsy = document.getElementById('quick-req-seq-year');
    if (qsy) {
      qsy.textContent =
        req.sequence_no != null && String(req.sequence_no).trim() !== ''
          ? String(req.sequence_no).trim()
          : '—';
    }
    const qsm = document.getElementById('quick-req-seq-month');
    if (qsm) {
      qsm.textContent =
        req.sequence_no_month != null && String(req.sequence_no_month).trim() !== ''
          ? String(req.sequence_no_month).trim()
          : '—';
    }

    document.getElementById('quick-req-cust-id').textContent = req.customer_id || '—';
    document.getElementById('quick-req-customer').textContent = req.customer_name || '—';
    document.getElementById('quick-req-phone').textContent =
      (req.customer_phone || req.phone || req.phone_masked || '').toString().trim() || '—';
    document.getElementById('quick-req-address').textContent =
      (req.customer_address || req.address || req.address_masked || '').toString().trim() || '—';

    document.getElementById('quick-req-veh-id').textContent = req.vehicle_id || '—';
    document.getElementById('quick-req-model').textContent = _reqSvcModel(req);
    document.getElementById('quick-req-vin').textContent = req.vin_number ? req.vin_number.slice(-6) : (req.vin_masked || '—');
    document.getElementById('quick-req-deadline').textContent = req.requested_delivery_time ? fmtDt(req.requested_delivery_time) : '—';

    const svcEl = document.getElementById('quick-req-services');
    if (svcEl) svcEl.innerHTML = _quickReqServicesHtml(req);

    document.getElementById('quick-req-team').textContent = ws.technician_team || '—';
    document.getElementById('quick-req-manager').textContent = ws.approved_by || '—';
    document.getElementById('quick-req-manager-time').textContent = ws.approved_at ? fmtDt(ws.approved_at) : '—';
    document.getElementById('quick-req-tech').textContent = ws.assigned_technician_name || techId;
    document.getElementById('quick-req-tech-phone').textContent = '—';
    document.getElementById('quick-req-tech-time').textContent = ws.completed_at ? fmtDt(ws.completed_at) : '—';
    
    document.getElementById('quick-req-modal').style.display = 'flex';
  } catch(e) {
    console.error(e);
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// LỆNH THI CÔNG (JOB CARDS)
// ═══════════════════════════════════════════════════════════════════════════════
let currentJobId = null;

function parseCompletionPhotos(jc) {
  const raw = jc && jc.completion_photos_json;
  if (!raw || typeof raw !== 'string') return [];
  try {
    const x = JSON.parse(raw);
    return Array.isArray(x) ? x.filter((u) => u && typeof u === 'string') : [];
  } catch (_e) {
    return [];
  }
}

async function taiLenhThiCong() {
  const jobs = await fetch('/api/job-cards').then(r => r.json());
  const listEl = document.getElementById('job-cards-list');
  if (jobs.length === 0) { listEl.innerHTML = '<p class="text-center muted pad-20" style="font-size:12px">Chưa có lệnh thi công nào. Phê duyệt luồng để tạo lệnh.</p>'; return; }
  listEl.innerHTML = jobs.map(j => {
    const isPpf = j.workstream_type === 'PPF_INSTALLATION';
    const typeClass = isPpf ? 'type-ppf' : (j.workstream_type ? 'type-wf' : '');
    const treLich = j.requested_delivery_time && new Date() > new Date(j.requested_delivery_time) && j.status !== 'COMPLETED_BY_TECHNICIAN';
    return `<div class="job-card-item ${typeClass} ${j.job_card_id === currentJobId ? 'active' : ''}" onclick="chonLenh('${j.job_card_id}')">
      <div class="jci-id">${j.job_card_id} ${treLich ? '⚠️ Trễ hạn' : ''}</div>
      <div class="jci-detail">${j.technician_name || j.technician_id} | ${j.technician_team || '—'}</div>
      ${j.request_id ? `<div style="font-size:12px;color:#1a6fc4;margin-top:3px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0.3px" title="Đơn thi công: ${_esc(j.request_id)}">📋 ${_esc(j.request_id)}</div>` : ''}
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
        ${j.workstream_type ? loaiLuongBadge(j.workstream_type) : ''}
        ${trangThaiBadge(j.status)}
      </div>
    </div>`;
  }).join('');
  if (currentJobId) {
    const sel = jobs.find((j) => j.job_card_id === currentJobId);
    if (sel) await hienThiLenh(sel);
  }
}

window.chonLenh = async function(jcId) {
  currentJobId = jcId;
  await taiLenhThiCong();
};

async function hienThiLenh(jc) {
  document.getElementById('no-job-selected').style.display = 'none';
  document.getElementById('job-detail-board').style.display = 'block';
  document.getElementById('jc-id').textContent = jc.job_card_id;
  const stEl = document.getElementById('jc-status');
  stEl.className = `status-badge status-${(jc.status||'').toLowerCase().replace(/_/g,'-')}`;
  stEl.textContent = TRANG_THAI_VI[jc.status] || jc.status;
  const wsBadge = document.getElementById('jc-ws-type-badge');
  wsBadge.innerHTML = jc.workstream_type ? loaiLuongBadge(jc.workstream_type) : '';

  const otBadge = document.getElementById('jc-ontime-badge');
  if (jc.is_on_time === true) otBadge.innerHTML = '<span class="status-badge status-approved">✅ Đúng hạn</span>';
  else if (jc.is_on_time === false) otBadge.innerHTML = `<span class="status-badge status-exception">⚠️ Trễ ${jc.delay_minutes ?? '?'} phút</span>`;
  else otBadge.innerHTML = '';

  const tlMap = { 'PENDING':0,'IN_PROGRESS':1,'ACTUAL_CONFIRMATION_REQUIRED':2,'COMPLETED_BY_TECHNICIAN':3 };
  const curTl = tlMap[jc.status] ?? 0;
  ['tl-pending','tl-inprogress','tl-confirmation','tl-done'].forEach((id, i) => {
    const el = document.getElementById(id); if (!el) return;
    el.className = 'tl-step'; if (i < curTl) el.classList.add('done'); else if (i === curTl) el.classList.add('active');
  });
  document.querySelectorAll('.tl-line').forEach((l, i) => { l.className = 'tl-line' + (i < curTl ? ' done' : ''); });

  const isPpf = jc.workstream_type === 'PPF_INSTALLATION';
  const nCompl = parseCompletionPhotos(jc).length;

  const infoEl = document.getElementById('jc-info-grid');
  infoEl.className = 'job-info-grid jc-info-grid-2col';

  let reqDetail = null;
  const rid = String(jc.request_id || '').trim();
  if (rid) {
    try {
      reqDetail = await fetchJSON(`/api/requests/${encodeURIComponent(rid)}`);
    } catch (_) {
      reqDetail = null;
    }
  }
  const maDon = reqDetail
    ? String(reqDetail.request_no || reqDetail.contract_no || '').trim() || rid || '—'
    : rid || '—';
  const soKhung = reqDetail
    ? String(reqDetail.vin_masked || reqDetail.vin_number || '').trim() || '—'
    : '—';
  const tvbh = reqDetail ? String(reqDetail.sales_consultant || '').trim() || '—' : '—';
  const sttNam =
    reqDetail != null && reqDetail.sequence_no != null && String(reqDetail.sequence_no).trim() !== ''
      ? String(reqDetail.sequence_no).trim()
      : '—';
  const sttThang =
    reqDetail != null && reqDetail.sequence_no_month != null && String(reqDetail.sequence_no_month).trim() !== ''
      ? String(reqDetail.sequence_no_month).trim()
      : '—';
  const loaiThiCong = isPpf ? 'Dán Phim PPF' : jc.workstream_type ? 'Phim Cách Nhiệt' : '—';
  const deliveryRaw =
    String(jc.requested_delivery_time || '').trim() || String(reqDetail?.requested_delivery_time || '').trim() || '';

  infoEl.innerHTML = [
    jcJobInfoRow('KTV phụ trách', `${_esc(jc.technician_name || '—')} (${_esc(jc.technician_id || '—')})`),
    jcJobInfoRow('Đội thi công', _esc(jc.technician_team || '—')),
    jcJobInfoRow('Loại thi công', _esc(loaiThiCong)),
    jcJobInfoRow('Mã đơn', _esc(maDon)),
    jcJobInfoRow('Số khung xe', _esc(soKhung)),
    jcJobInfoRow('Tư vấn bán hàng', _esc(tvbh)),
    jcJobInfoRow('Số thứ tự (theo năm)', _esc(sttNam)),
    jcJobInfoRow('Số thứ tự xe (theo tháng)', _esc(sttThang)),
    jcJobInfoRow('Hạn hoàn tất thi công', `<span class="jc-job-deadline">${_esc(fmtDt(deliveryRaw || null))}</span>`),
    jcJobInfoRow('Thời gian còn lại', jcDeliveryRemainHtml(deliveryRaw || null)),
    jcJobInfoRow('Bắt đầu lúc', _esc(fmtDt(jc.started_at))),
    jcJobInfoRow('Hoàn tất lúc', _esc(fmtDt(jc.completed_at))),
    jcJobInfoRow(
      'Xác nhận thực tế',
      _esc(TRANG_THAI_VI[jc.actual_confirmation_status] || jc.actual_confirmation_status || '—'),
      true,
    ),
    jcJobInfoRow('Ảnh hoàn thành', nCompl > 0 ? `${nCompl} ảnh đã lưu` : 'Chưa có ảnh', true),
  ].join('');

  const wsDetail = document.getElementById('jc-ws-detail');
  if (isPpf) {
    wsDetail.innerHTML = `<div class="ws-job-detail ppf-job">
      <div class="jc-wf-main-head jc-wf-ppf-head"><i class="fa-solid fa-shield-film"></i> Dán Phim PPF — ${jc.material_code || 'T-TYPE'}</div>
      <div class="form-grid jc-wf-ppf-grid" style="gap:6px">
        <div class="jc-wf-ppf-kv"><span class="jc-wf-ppf-k">Block kế hoạch (cm):</span><strong class="jc-wf-ppf-v">${formatWfPlannedSizeCm(jc.planned_cut_block || '152x1300')}</strong></div>
        <div class="jc-wf-ppf-kv"><span class="jc-wf-ppf-k">Chiều dài khấu (LOT, m):</span><strong class="jc-wf-ppf-v">${jc.planned_deduction_length_m != null ? Number(jc.planned_deduction_length_m).toFixed(2) : '13.00'} m</strong></div>
      </div>
    </div>`;
  } else if (jc.workstream_type === 'WINDOW_FILM_INSTALLATION') {
    wsDetail.innerHTML =
      '<div class="ws-job-detail wf-job"><p class="muted jc-wf-muted-p">Đang tải phân bổ luồng…</p></div>';
    if (jc.workstream_id) {
      try {
        const ws = await fetchJSON(`/api/workstreams/${encodeURIComponent(jc.workstream_id)}`);
        const canXoaJcDot = ws.status === 'IN_PROGRESS' || ws.status === 'ACTUAL_CONFIRMATION_REQUIRED';
        const base = ws.wf_allocation;
        const hist = Array.isArray(ws.extra_cut_history) ? ws.extra_cut_history : [];
        let exBlock = '';
        if (ws.extra_cut_requested && hist.length) {
          const blocks = hist
            .map((ent, idx) => {
              if (!ent || typeof ent !== 'object') return '';
              const exa = ent.wf_allocation;
              const when = ent.requested_at ? fmtDt(ent.requested_at) : '—';
              const who = [ent.actor_name, ent.actor_id].filter(Boolean).join(' · ') || '—';
              const delJ =
                canXoaJcDot && ent.proposal_id
                  ? `<button type="button" class="btn btn-outline btn-sm" style="flex-shrink:0;padding:2px 10px;font-size:10px;border-color:rgba(248,113,113,0.45);color:#f87171" onclick="void window.xoaDeXuatCatThem('${_esc(String(ws.workstream_id))}','${_esc(String(ent.proposal_id))}')"><i class="fa-solid fa-trash"></i> Xóa</button>`
                  : '';
              const pb = exa ? jcWfPhanBoBangHtml(`Đợt ${idx + 1} — hạng mục &amp; nguồn`, exa) : '';
              const kt = exa
                ? jcWfKiemTraTungHangMucCardSection(exa, {
                    title: `Đợt ${idx + 1} — kiểm tra hạng mục`,
                    icon: 'fa-scissors',
                    iconColor: '#fbbf24',
                  })
                : '';
              const rs = jcExtraCutReasonHtml(ent.reason);
              return `<div class="jc-wf-hist-block" style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(251,191,36,0.15)">
              <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
              <div class="jc-wf-hist-meta">${idx + 1}. ${_esc(when)} · ${_esc(who)}</div>${delJ}</div>
              ${pb}${kt}${rs}
            </div>`;
            })
            .join('');
          exBlock = `<div style="margin-top:10px;padding-top:12px;border-top:1px solid rgba(251,191,36,0.28)">
          <div class="jc-wf-extra-title"><i class="fa-solid fa-scissors" style="margin-right:6px"></i> Lịch sử cắt bổ sung (${hist.length} đợt)</div>
          ${blocks}
          <p class="muted jc-wf-hist-footnote">Hoàn tất luồng: trừ kho theo tất cả đợt có bảng phân bổ. Có thể xóa từng đợt khi đang thi công để kiểm tồn cộng dồn lại.</p>
        </div>`;
        } else if (ws.extra_cut_requested) {
          const exAll = collectExtraCutWfAllocations(ws);
          const ex = exAll[0];
          const exKiemTra = ex
            ? jcWfKiemTraTungHangMucCardSection(ex, {
                title: 'Kiểm tra từng hạng mục (cắt bổ sung)',
                icon: 'fa-scissors',
                iconColor: '#fbbf24',
              })
            : '';
          const legJ =
            canXoaJcDot && ex
              ? `<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button type="button" class="btn btn-outline btn-sm" style="padding:2px 10px;font-size:10px;border-color:rgba(248,113,113,0.45);color:#f87171" onclick="void window.xoaDeXuatCatThem('${_esc(String(ws.workstream_id))}','LEGACY-SNAPSHOT')"><i class="fa-solid fa-trash"></i> Xóa đăng ký cắt thêm</button></div>`
              : '';
          exBlock =
            ex
              ? `<div style="margin-top:10px;padding-top:12px;border-top:1px solid rgba(251,191,36,0.28)">
          <div class="jc-wf-extra-title"><i class="fa-solid fa-scissors" style="margin-right:6px"></i> Cắt bổ sung — KTV đã xác nhận</div>
          ${legJ}
          ${jcWfPhanBoBangHtml('2. Nhóm hạng mục &amp; nguồn yêu cầu cắt bổ sung (KTV)', ex)}
          ${exKiemTra || ''}
          ${jcExtraCutReasonHtml(ws.extra_cut_reason)}
        </div>`
              : `<p class="muted jc-wf-muted-strong"><i class="fa-solid fa-scissors"></i> Đã đăng ký cắt thêm — chưa có bảng phân bổ.</p>${jcExtraCutReasonHtml(ws.extra_cut_reason)}`;
        }
        wsDetail.innerHTML = `<div class="ws-job-detail wf-job">
      <div class="jc-wf-main-head jc-wf-wf-head"><i class="fa-solid fa-window-restore"></i> Dán Phim Cách Nhiệt — theo luồng</div>
      ${jcWfPhanBoBangHtml('1. Nhóm hạng mục &amp; nguồn ban đầu (đã phê duyệt)', base)}
      ${exBlock}
      ${jcWfTongHopNguonHtml(base, ws.extra_cut_requested ? collectExtraCutWfAllocations(ws) : null)}
    </div>`;
      } catch (e) {
        wsDetail.innerHTML = `<div class="ws-job-detail wf-job"><p class="muted jc-wf-muted-p jc-wf-err">Không tải được chi tiết luồng: ${_esc(e.message || String(e))}</p></div>`;
      }
    } else {
      wsDetail.innerHTML =
        '<div class="ws-job-detail wf-job"><p class="muted jc-wf-muted-p">Chưa liên kết workstream.</p></div>';
    }
  } else { wsDetail.innerHTML = ''; }

  const az = document.getElementById('jc-action-zone');
  az.innerHTML = '';
  if (jc.status === 'PENDING') {
    az.innerHTML = `<div class="hitl-alert"><i class="fa-solid fa-clock"></i><div><strong>Chờ kỹ thuật viên nhận lệnh</strong><p>Nhấn khi thực sự bắt đầu thi công xe. Hệ thống sẽ ghi nhận giờ bắt đầu.</p></div></div>
      <button class="btn btn-primary btn-full" onclick="batDauLenh('${jc.job_card_id}')"><i class="fa-solid fa-play"></i> Bắt đầu thi công ${isPpf ? 'PPF' : 'Cách Nhiệt'}</button>`;
  } else if (jc.status === 'IN_PROGRESS') {
    az.innerHTML = `<div class="hitl-alert tech"><i class="fa-solid fa-wrench"></i><div><strong>Đang thi công — ${isPpf ? 'Đội PPF' : 'Đội Cách Nhiệt'}</strong><p>Đã bắt đầu lúc ${fmtDt(jc.started_at)}. Nhấn hoàn tất sau khi thi công xong.</p></div></div>
      <button class="btn btn-green btn-full" onclick="yeuCauHoanTatLenh('${jc.job_card_id}')"><i class="fa-solid fa-flag-checkered"></i> Đã thi công xong — Yêu cầu xác nhận</button>
      ${
        jc.workstream_id
          ? `<div class="jc-action-stack">
      <div class="jc-action-row jc-action-row--triple jc-action-row--job-three">
        <button type="button" class="btn btn-outline jc-btn-extra-cut" onclick="moDangKyCatThem('${jc.workstream_id}')"><i class="fa-solid fa-scissors" aria-hidden="true"></i><span>Đăng ký cắt thêm (giữa ca)</span></button>
        <button type="button" class="btn btn-outline jc-btn-photo" onclick="moHinhAnhHoanThanh('${jc.job_card_id}')"><i class="fa-solid fa-camera" aria-hidden="true"></i><span>Hình ảnh hoàn thành${nCompl ? ` (${nCompl})` : ''}</span></button>
        <button type="button" class="btn btn-primary jc-btn-actual" onclick="moFormXacNhan('${jc.workstream_id}')"><i class="fa-solid fa-ruler" aria-hidden="true"></i><span>Xác nhận sử dụng thực tế &amp; Hoàn tất</span></button>
      </div>
    </div>`
          : ''
      }`;
  } else if (jc.status === 'ACTUAL_CONFIRMATION_REQUIRED') {
    az.innerHTML = `<div class="exception-box"><i class="fa-solid fa-clipboard-list"></i><h3>Cần hoàn tất trước khi chốt lệnh</h3>
      <p class="jc-exception-hint">KTV cần <strong>xác nhận kích thước thực tế</strong> và <strong>ít nhất một ảnh hoàn thành</strong> — sau đó hệ thống mới trừ kho ảo và đóng luồng.</p>
      <p class="muted jc-exception-photo-line">Đã lưu <strong>${nCompl}</strong> ảnh hoàn thành.</p>
      ${
        jc.workstream_id
          ? `<div class="jc-action-row jc-action-row--triple jc-action-row--job-three">
        <button type="button" class="btn btn-outline jc-btn-extra-cut" onclick="moDangKyCatThem('${jc.workstream_id}')"><i class="fa-solid fa-scissors" aria-hidden="true"></i><span>Đăng ký cắt thêm</span></button>
        <button type="button" class="btn btn-outline jc-btn-photo" onclick="moHinhAnhHoanThanh('${jc.job_card_id}')"><i class="fa-solid fa-camera" aria-hidden="true"></i><span>Hình ảnh hoàn thành${nCompl ? ` (${nCompl})` : ''}</span></button>
        <button type="button" class="btn btn-primary jc-btn-actual" onclick="moFormXacNhan('${jc.workstream_id}')"><i class="fa-solid fa-ruler" aria-hidden="true"></i><span>Xác nhận sử dụng thực tế</span></button>
      </div>`
          : ''
      }
    </div>`;
  } else if (jc.status === 'COMPLETED_BY_TECHNICIAN') {
    az.innerHTML = `<div class="success-box"><div class="success-icon"><i class="fa-solid fa-circle-check"></i></div>
      <h3>Lệnh Thi Công Đã Hoàn Tất!</h3>
      <p>Kho ảo đã được cập nhật.<br>Bắt đầu: ${fmtDt(jc.started_at)}<br>Hoàn tất: ${fmtDt(jc.completed_at)}</p>
    </div>`;
  }
}

window.moHinhAnhHoanThanh = async function (jcId) {
  document.getElementById('completion-photo-modal')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay';
  wrap.id = 'completion-photo-modal';
  wrap.innerHTML = `
    <div class="demo-modal jc-completion-modal" style="max-width:520px">
      <div class="demo-modal-header">
        <i class="fa-solid fa-camera" style="color:var(--blue-light)"></i>
        <div>
          <h3>Hình ảnh hoàn thành</h3>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Chụp hoặc chọn ảnh minh chứng đã hoàn tất thi công (tối đa 12 ảnh, mỗi file ≤ 8 MB).</p>
        </div>
      </div>
      <div class="demo-modal-body" style="padding:16px 20px">
        <div id="completion-photo-list" class="jc-completion-thumb-grid"></div>
        <input type="file" id="completion-photo-file" class="jc-completion-file-input" accept="image/*" capture="environment" />
        <button type="button" class="btn btn-primary jc-completion-pick-btn" style="margin-top:12px">
          <i class="fa-solid fa-upload"></i><span>Chọn / chụp ảnh</span>
        </button>
        <p id="completion-photo-msg" class="muted" style="font-size:11px;margin-top:10px"></p>
      </div>
      <div class="demo-modal-footer" style="display:flex;justify-content:flex-end">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('completion-photo-modal')?.remove()">Đóng</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const listEl = document.getElementById('completion-photo-list');
  const msgEl = document.getElementById('completion-photo-msg');
  const fileInp = document.getElementById('completion-photo-file');
  const pickBtn = wrap.querySelector('.jc-completion-pick-btn');
  if (pickBtn && fileInp) {
    pickBtn.addEventListener('click', () => fileInp.click());
  }

  async function renderThumbs() {
    let photos = [];
    try {
      const jobs = await fetch('/api/job-cards').then((r) => r.json());
      const jc = Array.isArray(jobs) ? jobs.find((j) => j.job_card_id === jcId) : null;
      photos = jc ? parseCompletionPhotos(jc) : [];
    } catch (_e) {
      photos = [];
    }
    if (!listEl) return;
    listEl.innerHTML =
      photos.length === 0
        ? '<p class="muted" style="grid-column:1/-1;font-size:11px;margin:0">Chưa có ảnh.</p>'
        : photos
            .map(
              (u) =>
                `<div class="jc-completion-thumb"><img src="${_esc(u)}" alt="Ảnh hoàn thành" loading="lazy" /></div>`,
            )
            .join('');
  }

  await renderThumbs();

  if (fileInp) {
    fileInp.addEventListener('change', async () => {
      const f = fileInp.files && fileInp.files[0];
      fileInp.value = '';
      if (!f) return;
      if (msgEl) msgEl.textContent = 'Đang tải lên…';
      try {
        const fd = new FormData();
        fd.append('file', f);
        const r = await fetch(`/api/job-cards/${encodeURIComponent(jcId)}/completion-photos`, {
          method: 'POST',
          body: fd,
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          const det = d.detail;
          let m = `Lỗi ${r.status}`;
          if (typeof det === 'string') m = det;
          else if (det && typeof det === 'object' && det.message) m = String(det.message);
          throw new Error(m);
        }
        if (msgEl) msgEl.textContent = d.detail || 'Đã lưu.';
        toast('success', 'Ảnh hoàn thành', d.detail || 'Đã lưu.');
        await renderThumbs();
        if (typeof taiLenhThiCong === 'function') await taiLenhThiCong();
      } catch (e) {
        if (msgEl) msgEl.textContent = e.message || String(e);
        toast('error', 'Không tải được ảnh', e.message || String(e));
      }
    });
  }
};

window.batDauLenh = async function(jcId) {
  try {
    const data = await fetch(`/api/job-cards/${jcId}/start`, { method: 'POST' }).then(r => r.json());
    toast('success', '🔧 Đã bắt đầu thi công', data.detail);
    await taiLenhThiCong(); taiThongBao(); taiTongQuan();
  } catch(e) { toast('error', 'Lỗi', e.message); }
};

window.yeuCauHoanTatLenh = async function(jcId) {
  try {
    const data = await fetch(`/api/job-cards/${jcId}/request-complete`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({})
    }).then(r => r.json());
    toast(data.status === 'success' ? 'success' : 'info', data.status === 'success' ? '✅ Hoàn tất!' : '⚠️ Cần thêm bước', data.detail);
    await taiLenhThiCong(); taiThongBao(); taiTongQuan();
  } catch(e) { toast('error', 'Lỗi', e.message); }
};

function txnBadge(t) {
  const lab = GIAO_DICH_VI[t] || t;
  return `<span class="txn-chip txn-${(t || '').toLowerCase().replace(/_/g,'-')}">${lab}</span>`;
}

function lotStatusChip(s) {
  if (!s) return '—';
  const vi = TRANG_THAI_VI[s] || s;
  return `<span class="lot-st-chip st-${(s || '').toLowerCase()}">${vi}</span>`;
}

async function loadMaterialPreferences() {
  const tb = document.getElementById('inv-table-matpref');
  if (!tb) return;
  const q = new URLSearchParams();
  const ft = document.getElementById('mp-film')?.value?.trim();
  const ji = document.getElementById('mp-job')?.value?.trim();
  const st = document.getElementById('mp-status')?.value?.trim();
  const qq = document.getElementById('mp-q')?.value?.trim();
  if (ft) q.set('film_type', ft);
  if (ji) q.set('job_item', ji);
  if (st) q.set('status', st);
  if (qq) q.set('q', qq);
  try {
    const j = await fetch(`/api/material-preferences?${q.toString()}`).then((r) => r.json());
    const items = j.items || [];
    tb.innerHTML = items.length
      ? items
          .map(
            (p) => `<tr>
        <td><strong>${_esc(p.preference_id)}</strong></td>
        <td>${_esc(p.film_type)}</td>
        <td>${_esc(_wfJobLabelVi(p.job_item))}</td>
        <td>${_esc(p.preferred_material_code)}</td>
        <td>${_esc(p.material_name || '—')}</td>
        <td>${p.priority ?? '—'}</td>
        <td>${_esc(p.status)}</td>
        <td><small>${_esc(p.effective_from || '—')}</small></td>
        <td><small>${_esc(p.effective_to || '—')}</small></td>
        <td style="white-space:nowrap">
          <button type="button" class="btn btn-outline btn-sm" onclick="openMatPrefModal('${_esc(p.preference_id)}')">Sửa</button>
          ${p.status === 'ACTIVE'
            ? `<button type="button" class="btn btn-outline btn-sm" onclick="toggleMatPref('${_esc(p.preference_id)}','deactivate')">Inactive</button>`
            : `<button type="button" class="btn btn-outline btn-sm" onclick="toggleMatPref('${_esc(p.preference_id)}','activate')">Active</button>`}
        </td>
      </tr>`,
          )
          .join('')
      : '<tr><td colspan="10" class="text-center muted">Không có cấu hình.</td></tr>';
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="10" class="text-center muted">Lỗi tải: ${_esc(e.message)}</td></tr>`;
  }
}

window.toggleMatPref = async function (pid, act) {
  const reason = window.prompt(act === 'activate' ? 'Lý do kích hoạt (bắt buộc):' : 'Lý do ngưng hoạt động (bắt buộc):') || '';
  if (!reason.trim()) {
    toast('warning', 'Thiếu lý do', 'Vui lòng nhập reason cho audit.');
    return;
  }
  const url =
    act === 'activate'
      ? `/api/material-preferences/${encodeURIComponent(pid)}/activate`
      : `/api/material-preferences/${encodeURIComponent(pid)}/deactivate`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim(), updated_by: 'WEB' }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
    toast('success', 'Đã cập nhật', pid);
    loadMaterialPreferences();
  } catch (e) {
    toast('error', 'Lỗi', e.message);
  }
};

window.openMatPrefModal = async function (preferenceId) {
  const isEdit = !!preferenceId;
  let mcOptions = '<option value="">— Chọn mã vật tư —</option>';
  const seen = new Set();
  try {
    const r = await fetch('/api/inventory/material-codes');
    const arr = await r.json();
    if (Array.isArray(arr)) {
      arr
        .filter((mc) => String(mc || '').trim())
        .forEach((mc) => {
          const v = String(mc).trim();
          if (seen.has(v)) return;
          seen.add(v);
          mcOptions += `<option value="${_esc(v)}">${_esc(v)}</option>`;
        });
    }
  } catch (e) {
    console.warn('openMatPrefModal material-codes', e);
  }

  function _ensureMatPrefMcOption(code) {
    const c = String(code || '').trim();
    if (!c) return;
    const sel = document.getElementById('mpf-mc');
    if (!sel) return;
    const exists = Array.from(sel.options).some((o) => o.value === c);
    if (!exists) {
      sel.insertAdjacentHTML(
        'beforeend',
        `<option value="${_esc(c)}">${_esc(c)} — (chưa có trong tồn kho hiện tại)</option>`,
      );
    }
    sel.value = c;
  }

  openInvModal(
    isEdit ? `Sửa cấu hình — ${_esc(preferenceId)}` : 'Thêm cấu hình vật tư ưu tiên',
    `<div class="form-grid">
      <div class="field-group"><label>Mã cấu hình</label><input id="mpf-pid" class="field-input" value="${_esc(preferenceId || '')}" ${isEdit ? 'readonly' : ''} placeholder="VD: MATPREF-WF-KL" /></div>
      <div class="field-group"><label>Loại phim <span class="req">*</span></label><input id="mpf-ft" class="field-input" placeholder="VD: WINDOW_FILM, PPF" /></div>
      <div class="field-group"><label>Hạng mục / vùng thi công <span class="req">*</span></label>
        <input id="mpf-ji" class="field-input" list="mpf-job-datalist" autocomplete="off" placeholder="Chọn gợi ý hoặc gõ mã (VD: WINDSHIELD)" /></div>
      <div class="field-group full-width"><p class="muted" style="font-size:11px;margin:0;line-height:1.45">Danh sách gợi ý theo hạng mục phim cách nhiệt và vùng PPF trong hệ thống. Bạn vẫn có thể <strong>nhập tay</strong> mã khác nếu nghiệp vụ cần.</p></div>
      <div class="field-group"><label>Mã vật tư ưu tiên <span class="req">*</span></label>
        <select id="mpf-mc" class="field-input">${mcOptions}</select></div>
      <div class="field-group"><label>Tên vật tư (hiển thị)</label><input id="mpf-mn" class="field-input" placeholder="Tên gợi nhớ cho báo cáo / tra cứu" /></div>
      <div class="field-group"><label>Mức ưu tiên</label><input type="number" id="mpf-pr" class="field-input" value="1" min="1" title="Số nhỏ hơn = ưu tiên cao hơn (theo cấu hình hệ thống)" /></div>
      <div class="field-group"><label>Hiệu lực từ</label><input id="mpf-ef" class="field-input" placeholder="dd/mm/yyyy hoặc để trống" autocomplete="off" /></div>
      <div class="field-group"><label>Hiệu lực đến</label><input id="mpf-et" class="field-input" placeholder="dd/mm/yyyy hoặc để trống" autocomplete="off" /></div>
      <div class="field-group full-width"><p class="muted" style="font-size:11px;margin:0;line-height:1.45">Có thể <strong>để trống</strong> cả hai ô nếu không giới hạn thời gian. Nếu nhập ngày, khuyến nghị định dạng <strong>dd/mm/yyyy</strong> (ví dụ <strong>08/06/2026</strong>).</p></div>
      <div class="field-group full-width"><label>Ghi chú</label><input id="mpf-note" class="field-input" /></div>
      <div class="field-group full-width"><label>Lý do thay đổi <span class="req">*</span> <span class="muted" style="font-weight:400">(bắt buộc khi sửa)</span></label><input id="mpf-reason" class="field-input" placeholder="VD: Điều chỉnh theo audit / đổi định mức" /></div>
      ${_matPrefJobItemDatalistHtml()}
    </div>`,
    `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Đóng</button>
     <button type="button" class="btn btn-primary" onclick="submitMatPref(${isEdit ? 'true' : 'false'})">${isEdit ? 'Cập nhật' : 'Tạo'}</button>`,
  );
  if (isEdit) {
    fetch(`/api/material-preferences?${new URLSearchParams({ q: preferenceId })}`)
      .then((r) => r.json())
      .then((j) => {
        const p = (j.items || []).find((x) => x.preference_id === preferenceId);
        if (!p) return;
        document.getElementById('mpf-ft').value = p.film_type || '';
        document.getElementById('mpf-ji').value = p.job_item || '';
        _ensureMatPrefMcOption(p.preferred_material_code);
        document.getElementById('mpf-mn').value = p.material_name || '';
        document.getElementById('mpf-pr').value = String(p.priority || 1);
        document.getElementById('mpf-ef').value = p.effective_from || '';
        document.getElementById('mpf-et').value = p.effective_to || '';
        document.getElementById('mpf-note').value = p.note || '';
      })
      .catch(() => {});
  } else {
    const sel = document.getElementById('mpf-mc');
    if (sel && sel.options.length > 1) sel.selectedIndex = 1;
  }
};

window.submitMatPref = async function (isEdit) {
  const pid = (document.getElementById('mpf-pid')?.value || '').trim();
  const reason = (document.getElementById('mpf-reason')?.value || '').trim();
  if (isEdit && !reason) {
    toast('warning', 'Thiếu lý do', 'Vui lòng nhập lý do thay đổi (phục vụ audit).');
    return;
  }
  const preferred_material_code = document.getElementById('mpf-mc').value.trim();
  if (!preferred_material_code) {
    toast('warning', 'Thiếu mã vật tư', 'Chọn mã vật tư ưu tiên trong danh sách kho.');
    return;
  }
  const body = {
    film_type: document.getElementById('mpf-ft').value.trim(),
    job_item: document.getElementById('mpf-ji').value.trim(),
    preferred_material_code,
    material_name: document.getElementById('mpf-mn').value.trim() || undefined,
    priority: parseInt(document.getElementById('mpf-pr').value, 10) || 1,
    effective_from: document.getElementById('mpf-ef').value.trim() || undefined,
    effective_to: document.getElementById('mpf-et').value.trim() || undefined,
    note: document.getElementById('mpf-note').value.trim() || undefined,
    reason,
    updated_by: 'WEB',
  };
  try {
    let r;
    if (isEdit) {
      r = await fetch(`/api/material-preferences/${encodeURIComponent(pid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      const { reason: _rsn, updated_by: _ub, ...rest } = body;
      if (pid) rest.preference_id = pid;
      r = await fetch('/api/material-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rest, created_by: 'WEB' }),
      });
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
    toast('success', 'Đã lưu', pid || d.preference_id || '');
    closeInvModal();
    loadMaterialPreferences();
  } catch (e) {
    toast('error', 'Lỗi', e.message);
  }
};

let _invSub = 'lots';
async function taiQuanLyKho() {
  await loadInventorySummary();
  document.querySelectorAll('#inv-subtabs .inv-subtab').forEach(b => {
    b.classList.toggle('active', b.dataset.invSub === _invSub);
  });
  ['inv-panel-lots', 'inv-panel-offcuts', 'inv-panel-tx', 'inv-panel-matpref', 'inv-panel-locked'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('inv-toolbar-lots').style.display = _invSub === 'lots' ? 'flex' : 'none';
  document.getElementById('inv-toolbar-offcuts').style.display = _invSub === 'offcuts' ? 'flex' : 'none';
  document.getElementById('inv-toolbar-tx').style.display = _invSub === 'tx' ? 'flex' : 'none';
  const tbm = document.getElementById('inv-toolbar-matpref');
  if (tbm) tbm.style.display = _invSub === 'matpref' ? 'flex' : 'none';
  if (_invSub === 'lots') { document.getElementById('inv-panel-lots').style.display = 'block'; await loadLots(); }
  else if (_invSub === 'offcuts') { document.getElementById('inv-panel-offcuts').style.display = 'block'; await loadOffcuts(); }
  else if (_invSub === 'tx') { document.getElementById('inv-panel-tx').style.display = 'block'; await loadInventoryTransactions(); }
  else if (_invSub === 'matpref') {
    document.getElementById('inv-panel-matpref').style.display = 'block';
    await loadMaterialPreferences();
  } else { document.getElementById('inv-panel-locked').style.display = 'block'; await renderLockedItems(); }
}

async function loadInventorySummary() {
  try {
    const s = await fetch('/api/inventory/summary').then(r => r.json());
    document.getElementById('inv-kpi-row').innerHTML = `
      <div class="inv-kpi"><span class="inv-kpi-val">${s.total_lots}</span><span class="inv-kpi-lb">Tổng LOT</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val">${s.active_lots}</span><span class="inv-kpi-lb">LOT hoạt động</span></div>
      <div class="inv-kpi warn"><span class="inv-kpi-val">${s.locked_lots}</span><span class="inv-kpi-lb">LOT khóa</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val">${s.depleted_lots}</span><span class="inv-kpi-lb">LOT hết</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val">${s.total_offcuts}</span><span class="inv-kpi-lb">Tổng mảnh dư</span></div>
      <div class="inv-kpi good"><span class="inv-kpi-val">${s.available_offcuts}</span><span class="inv-kpi-lb">Khả dụng</span></div>
      <div class="inv-kpi warn"><span class="inv-kpi-val">${s.locked_offcuts}</span><span class="inv-kpi-lb">Mảnh dư khóa</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val">${s.cleared_offcuts}</span><span class="inv-kpi-lb">Đã clear/scrapped</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val">${s.total_material_remaining_m}</span><span class="inv-kpi-lb">Tổng còn (m)</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val">${s.total_offcut_area_m2}</span><span class="inv-kpi-lb">Diện tích mảnh dư (m²)</span></div>`;
  } catch (e) { toast('error', 'KPI kho', e.message); }
}

async function loadLots() {
  const q = new URLSearchParams();
  const qq = document.getElementById('inv-lot-q')?.value?.trim();
  const st = document.getElementById('inv-lot-status')?.value;
  const fg = document.getElementById('inv-lot-film-group')?.value;
  if (qq) q.set('q', qq);
  if (st) q.set('lot_status', st);
  if (fg) q.set('film_type', fg);
  const rows = await fetch('/api/inventory/lots?' + q.toString()).then(r => r.json());
  const eff = (l) => l.lot_status || (l.is_locked ? 'LOCKED' : ((l.remaining_length_m || 0) <= 0 ? 'DEPLETED' : (l.is_opened ? 'IN_USE' : 'NEW')));
  document.getElementById('inv-table-lots').innerHTML = rows.length ? rows.map(l => {
    const e = eff(l);
    return `<tr>
      <td><strong>${l.lot_id}</strong></td>
      <td>${l.material_code || '—'}</td>
      <td><small>${_esc(filmTypeLabel(l.film_type))}</small></td>
      <td><strong>${l.remaining_length_m ?? '—'}</strong> / ${l.original_length_m ?? '—'}</td>
      <td>${lotStatusChip(e)}</td>
      <td>${l.is_locked ? '<span class="locked-badge"><i class="fa-solid fa-lock" style="margin-right:4px;"></i>Khóa</span>' : '—'}</td>
      <td><small>${l.storage_location || '—'}</small></td>
      <td><small>${_esc((l.import_performed_by || '').trim() || '—')}</small></td>
      <td><small>${l.import_date || '—'}</small></td>
      <td style="white-space:nowrap">
        <button type="button" class="btn btn-outline btn-sm" onclick='openEditLotImportMetaModal(${JSON.stringify({ lot_id: l.lot_id, import_date: l.import_date || '', import_performed_by: l.import_performed_by || '' })})'>Sửa</button>
        <button class="btn btn-outline btn-sm" onclick="openManualIssueLotModal(${JSON.stringify(l.lot_id)}, ${JSON.stringify(Number(l.remaining_length_m))})">Xuất</button>
        <button class="btn btn-danger btn-sm" onclick="openClearLotModal('${l.lot_id}')">Clear</button>
        ${l.is_locked ? `<button class="btn btn-outline btn-sm" onclick="openReleaseLockModal('LOT','${l.lot_id}')"><i class="fa-solid fa-unlock"></i> Mở khóa</button>` : ''}
      </td></tr>`;
  }).join('') : '<tr><td colspan="10" class="text-center muted">Không có LOT.</td></tr>';
}

window.resetInvLots = function() {
  const qEl = document.getElementById('inv-lot-q');
  const fgEl = document.getElementById('inv-lot-film-group');
  const stEl = document.getElementById('inv-lot-status');
  if (qEl) qEl.value = '';
  if (fgEl) fgEl.value = '';
  if (stEl) stEl.value = 'IN_USE';
  loadLots();
};


async function loadOffcuts() {
  const q = new URLSearchParams();
  const qq = document.getElementById('inv-oc-q')?.value?.trim();
  const fg = document.getElementById('inv-oc-film-group')?.value;
  if (qq) q.set('q', qq);
  if (fg) q.set('film_type', fg);
  const rows = await fetch('/api/inventory/offcuts?' + q.toString()).then(r => r.json());
  const eff = (o) => {
    if ((o.area_m2 || 0) <= 0 || (o.length_m || 0) <= 0 || (o.width_m || 0) <= 0) return 'CLEARED';
    return o.offcut_status || o.status || 'AVAILABLE';
  };
  document.getElementById('inv-table-offcuts').innerHTML = rows.length ? rows.map(o => {
    const e = eff(o);
    const qs = o.quality_status || '—';
    const by = (o.import_performed_by && String(o.import_performed_by).trim()) ? _esc(o.import_performed_by) : '—';
    const idDisp = _lockedImportDateDisplay(o.import_date, o.import_performed_at);
    return `<tr>
      <td><strong>${_esc(o.offcut_id)}</strong></td>
      <td>${_esc(String(o.material_code ?? ''))}</td>
      <td><small>${_esc(filmTypeLabel(o.film_type))}</small></td>
      <td>${_esc(String(o.width_m ?? ''))}×${_esc(String(o.length_m ?? ''))} m</td>
      <td>${o.area_m2 ?? '—'}</td>
      <td><span class="status-badge status-new" style="font-size:10px">${_esc(qs)}</span></td>
      <td>${lotStatusChip(e)}</td>
      <td>${o.is_locked ? '<span class="locked-badge"><i class="fa-solid fa-lock" style="margin-right:4px;"></i>Khóa</span>' : '—'}</td>
      <td><small>${_esc(String(o.storage_location || '—'))}</small></td>
      <td><small>${by}</small></td>
      <td><small>${idDisp}</small></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="openManualIssueOffcutModal(${JSON.stringify(String(o.offcut_id ?? '')).replace(/"/g, '&quot;')})">Xuất</button>
        <button class="btn btn-danger btn-sm" onclick="openClearOffcutModal(${JSON.stringify(String(o.offcut_id ?? '')).replace(/"/g, '&quot;')})">Clear</button>
        ${o.is_locked ? `<button class="btn btn-outline btn-sm" onclick="openReleaseLockModal(${JSON.stringify('OFFCUT').replace(/"/g, '&quot;')}, ${JSON.stringify(String(o.offcut_id ?? '')).replace(/"/g, '&quot;')})"><i class="fa-solid fa-unlock"></i> Mở khóa</button>` : ''}
      </td></tr>`;
  }).join('') : '<tr><td colspan="12" class="text-center muted">Không có mảnh dư.</td></tr>';
}

window.resetInvOffcuts = function() {
  const qEl = document.getElementById('inv-oc-q');
  const fgEl = document.getElementById('inv-oc-film-group');
  if (qEl) qEl.value = '';
  if (fgEl) fgEl.value = '';
  loadOffcuts();
};

async function loadInventoryTransactions() {
  const q = new URLSearchParams();
  const tt = document.getElementById('inv-filter-tx-type')?.value;
  const mc = document.getElementById('inv-filter-tx-mat')?.value?.trim();
  const df = document.getElementById('inv-filter-tx-from')?.value;
  const dt = document.getElementById('inv-filter-tx-to')?.value;
  if (tt) q.set('transaction_type', tt);
  if (mc) q.set('material_code', mc);
  if (df) q.set('date_from', df);
  if (dt) q.set('date_to', dt);
  const rows = await fetch('/api/inventory/transactions?' + q.toString()).then(r => r.json());
  document.getElementById('inv-table-tx').innerHTML = rows.length ? rows.map(t => `<tr>
    <td><small style="word-break:break-all">${t.transaction_id || '—'}</small></td>
    <td>${txnBadge(t.transaction_type)}</td>
    <td><small>${t.source_type}:${t.source_id}</small></td>
    <td>${t.material_code}</td>
    <td><small>${t.before_balance ?? '—'} → ${t.after_balance ?? '—'}</small></td>
    <td style="max-width:140px;font-size:11px;white-space:normal">${String(t.reason || '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
    <td>${t.performed_by}</td>
    <td><small>${fmtDt(t.performed_at)}</small></td>
  </tr>`).join('') : '<tr><td colspan="8" class="text-center muted">Chưa có giao dịch.</td></tr>';
}

function _fmtInvDim(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return String(Math.round(n * 1000) / 1000);
}

function _qualityStatusVi(code) {
  const u = String(code || '').trim().toUpperCase();
  if (!u) return '—';
  const m = { GOOD: 'Tốt', NORMAL: 'Bình thường', POOR: 'Kém' };
  const lab = m[u] || u;
  return lab === u ? u : `${lab} (${u})`;
}

/** Ngày nhập kho: ưu tiên trường import_date; nếu trống thì lấy thời điểm bút toán nhập đầu tiên. */
function _lockedImportDateDisplay(importDate, performedAtIso) {
  const d = String(importDate ?? '').trim();
  if (d) return _esc(d);
  const iso = String(performedAtIso ?? '').trim();
  if (iso) return _esc(fmtDt(iso));
  return '—';
}

async function renderLockedItems() {
  const host = document.getElementById('inv-locked-list');
  if (!host) return;
  let lots = [];
  let offcuts = [];
  try {
    const r = await fetch('/api/inventory/locked-catalog');
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    lots = j.lots || [];
    offcuts = j.offcuts || [];
  } catch (e) {
    console.warn('locked-catalog', e);
    try {
      const [a, b] = await Promise.all([
        fetch('/api/inventory/lots?is_locked=true').then((x) => x.json()),
        fetch('/api/inventory/offcuts?is_locked=true').then((x) => x.json()),
      ]);
      lots = Array.isArray(a) ? a : [];
      offcuts = Array.isArray(b) ? b : [];
    } catch (e2) {
      host.innerHTML = '<p class="muted pad-20">Không tải được danh sách đang khóa.</p>';
      return;
    }
  }

  if (!lots.length && !offcuts.length) {
    host.innerHTML = '<p class="muted pad-20">Không có bản ghi đang khóa.</p>';
    return;
  }

  const lotEff = (l) => l.effective_status || (l.is_locked ? 'LOCKED' : 'ACTIVE');
  const ocEff = (o) => o.effective_status || o.offcut_status || o.status || 'AVAILABLE';

  const lotRows = lots.map((l) => {
    const rem = _fmtInvDim(l.remaining_length_m);
    const wid = _fmtInvDim(l.original_width_m);
    const olen = _fmtInvDim(l.original_length_m);
    const loc = (l.storage_location && String(l.storage_location).trim()) ? _esc(l.storage_location) : '—';
    const rid = (l.locked_by_request_id && String(l.locked_by_request_id).trim()) ? _esc(l.locked_by_request_id) : '—';
    const wsid = (l.locked_by_workstream_id && String(l.locked_by_workstream_id).trim()) ? _esc(l.locked_by_workstream_id) : '—';
    const nm = String(l.material_name ?? '').trim();
    const nmDisp = nm
      ? `<span title="${_esc(nm)}">${_esc(nm.length > 40 ? `${nm.slice(0, 38)}…` : nm)}</span>`
      : '—';
    const ft = (l.film_type && String(l.film_type).trim()) ? _esc(l.film_type) : '—';
    const by = (l.import_performed_by && String(l.import_performed_by).trim()) ? _esc(l.import_performed_by) : '—';
    const idDt = _lockedImportDateDisplay(l.import_date, l.import_performed_at);
    return `<tr>
      <td><strong>${_esc(l.lot_id)}</strong></td>
      <td>${_esc(l.material_code)}</td>
      <td style="max-width:160px">${nmDisp}</td>
      <td><small>${ft}</small></td>
      <td>${lotStatusChip(lotEff(l))}</td>
      <td><strong>${rem}</strong></td>
      <td>${wid}</td>
      <td>${olen}</td>
      <td><small>${loc}</small></td>
      <td><small>${rid}</small></td>
      <td><small>${wsid}</small></td>
      <td><small>${idDt}</small></td>
      <td><small>${by}</small></td>
      <td class="inv-locked-col-act"><button type="button" class="btn btn-outline btn-sm" onclick="openReleaseLockModal(${JSON.stringify('LOT')}, ${JSON.stringify(l.lot_id)})">Mở khóa</button></td>
    </tr>`;
  });

  const ocRows = offcuts.map((o) => {
    const w = _fmtInvDim(o.width_m);
    const len = _fmtInvDim(o.length_m);
    const ar = _fmtInvDim(o.area_m2);
    const loc = (o.storage_location && String(o.storage_location).trim()) ? _esc(o.storage_location) : '—';
    const pl = (o.parent_lot_id && String(o.parent_lot_id).trim()) ? _esc(o.parent_lot_id) : '—';
    const rid = (o.locked_by_request_id && String(o.locked_by_request_id).trim()) ? _esc(o.locked_by_request_id) : '—';
    const wsid = (o.locked_by_workstream_id && String(o.locked_by_workstream_id).trim()) ? _esc(o.locked_by_workstream_id) : '—';
    const qs = _esc(_qualityStatusVi(o.quality_status));
    const nm = String(o.material_name ?? '').trim();
    const nmDisp = nm
      ? `<span title="${_esc(nm)}">${_esc(nm.length > 36 ? `${nm.slice(0, 34)}…` : nm)}</span>`
      : '—';
    const ft = (o.film_type && String(o.film_type).trim()) ? _esc(o.film_type) : '—';
    const cfr = (o.created_from_request_id && String(o.created_from_request_id).trim()) ? _esc(o.created_from_request_id) : '—';
    const by = (o.import_performed_by && String(o.import_performed_by).trim()) ? _esc(o.import_performed_by) : '—';
    const idDt = _lockedImportDateDisplay(o.import_date, o.import_performed_at);
    return `<tr>
      <td><strong>${_esc(o.offcut_id)}</strong></td>
      <td>${_esc(o.material_code)}</td>
      <td style="max-width:140px">${nmDisp}</td>
      <td><small>${ft}</small></td>
      <td>${lotStatusChip(ocEff(o))}</td>
      <td><strong>${w}</strong>×<strong>${len}</strong></td>
      <td>${ar}</td>
      <td><small>${qs}</small></td>
      <td><small>${loc}</small></td>
      <td><small>${pl}</small></td>
      <td><small>${cfr}</small></td>
      <td><small>${rid}</small></td>
      <td><small>${wsid}</small></td>
      <td><small>${idDt}</small></td>
      <td><small>${by}</small></td>
      <td class="inv-locked-col-act"><button type="button" class="btn btn-outline btn-sm" onclick="openReleaseLockModal(${JSON.stringify('OFFCUT')}, ${JSON.stringify(o.offcut_id)})">Mở khóa</button></td>
    </tr>`;
  });

  const parts = [];
  if (lotRows.length) {
    parts.push(`<div class="inv-locked-table-wrap"><h4 class="inv-locked-h">Cuộn LOT</h4><div class="table-wrap"><table class="data-table inv-locked-data-table"><thead><tr>
      <th>Mã LOT</th><th>Mã vật tư</th><th>Tên vật tư</th><th>Loại phim</th><th>Trạng thái tồn</th>
      <th>Còn (m)</th><th>Rộng (m)</th><th>Dài gốc (m)</th><th>Vị trí</th>
      <th>Đơn đang khóa</th><th>Luồng khóa</th><th>Ngày nhập kho</th><th>Người nhập kho</th>
      <th class="inv-locked-col-act">Thao tác</th>
    </tr></thead><tbody>${lotRows.join('')}</tbody></table></div></div>`);
  }
  if (ocRows.length) {
    parts.push(`<div class="inv-locked-table-wrap"><h4 class="inv-locked-h">Mảnh dư</h4><div class="table-wrap"><table class="data-table inv-locked-data-table"><thead><tr>
      <th>Mã mảnh dư</th><th>Mã vật tư</th><th>Tên vật tư</th><th>Loại phim</th><th>Trạng thái tồn</th>
      <th>R×D (m)</th><th>Diện tích (m²)</th><th>Chất lượng</th><th>Vị trí</th><th>Lô cha</th>
      <th>Đơn tạo mảnh</th><th>Đơn đang khóa</th><th>Luồng khóa</th><th>Ngày nhập kho</th><th>Người nhập kho</th>
      <th class="inv-locked-col-act">Thao tác</th>
    </tr></thead><tbody>${ocRows.join('')}</tbody></table></div></div>`);
  }
  host.innerHTML = parts.join('');
}

function closeInvModal() { document.getElementById('inv-modal-overlay')?.remove(); }

function openInvModal(title, innerHtml, footerHtml, afterOpen) {
  closeInvModal();
  const m = document.createElement('div');
  m.className = 'modal-overlay inv-modal-overlay';
  m.id = 'inv-modal-overlay';
  m.style.display = 'flex';
  m.innerHTML = `<div class="inv-modal">
    <div class="inv-modal-head"><h3>${title}</h3><button type="button" class="btn btn-icon" onclick="closeInvModal()"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="inv-modal-body">${innerHtml}</div>
    <div class="inv-modal-foot">${footerHtml}</div></div>`;
  m.addEventListener('click', ev => { if (ev.target === m) closeInvModal(); });
  document.body.appendChild(m);
  if (typeof afterOpen === 'function') {
    try { afterOpen(m); } catch (e) { console.warn('openInvModal afterOpen', e); }
  }
}

window.openImportLotModal = function() {
  openInvModal('Nhập LOT mới', `
    <div class="form-grid">
      <div class="field-group"><label>Mã LOT <span class="req">*</span></label><input id="im-lot-id" class="field-input" placeholder="LOT-JB20-004"></div>
      <div class="field-group"><label>Mã vật tư <span class="req">*</span></label><input id="im-mat" class="field-input" value="JB20"></div>
      <div class="field-group"><label>Tên vật tư</label><input id="im-mname" class="field-input"></div>
      <div class="field-group"><label>Loại phim</label><input id="im-ft" class="field-input" value="WINDOW_FILM"></div>
      <div class="field-group"><label>Chiều rộng (m) <span class="req">*</span></label><input type="number" id="im-w" class="field-input" value="1.52" step="0.01"></div>
      <div class="field-group"><label>Chiều dài gốc (m) <span class="req">*</span></label><input type="number" id="im-ol" class="field-input" value="30" step="0.01"></div>
      <div class="field-group"><label>Chiều dài còn lại (m)</label><input type="number" id="im-rl" class="field-input" step="0.01" placeholder="= Dài gốc nếu để trống"></div>
      <div class="field-group"><label>Vị trí lưu trữ <span class="req">*</span></label><input id="im-loc" class="field-input" value="A-RACK-05"></div>
      <div class="field-group"><label>Nhà cung cấp</label><input id="im-sup" class="field-input"></div>
      <div class="field-group"><label>Số hóa đơn</label><input id="im-inv" class="field-input"></div>
      <div class="field-group"><label>Người nhập</label><input id="im-by" class="field-input" value="Admin"></div>
      <div class="field-group full-width"><label>Ghi chú</label><input id="im-note" class="field-input"></div>
    </div>`, `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Hủy</button>
    <button type="button" class="btn btn-primary" onclick="submitImportLot()">Lưu nhập kho</button>`);
};

window.submitImportLot = async function() {
  const lot_id = document.getElementById('im-lot-id').value.trim();
  const original_length_m = parseFloat(document.getElementById('im-ol').value);
  const rlRaw = document.getElementById('im-rl').value.trim();
  const remaining_length_m = rlRaw ? parseFloat(rlRaw) : original_length_m;
  const payload = {
    lot_id, material_code: document.getElementById('im-mat').value.trim(),
    material_name: document.getElementById('im-mname').value,
    film_type: document.getElementById('im-ft').value,
    width_m: parseFloat(document.getElementById('im-w').value),
    original_length_m,
    remaining_length_m,
    storage_location: document.getElementById('im-loc').value.trim(),
    supplier: document.getElementById('im-sup').value,
    invoice_no: document.getElementById('im-inv').value,
    performed_by: document.getElementById('im-by').value.trim() || 'AD-001',
    note: document.getElementById('im-note').value,
  };
  try {
    const r = await fetch('/api/inventory/lots/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
    toast('success', 'Nhập LOT thành công', d.lot?.lot_id || '');
    closeInvModal(); taiQuanLyKho(); taiKhoLot();
  } catch (e) { toast('error', 'Lỗi', e.message); }
};

window.openImportOffcutModal = async function () {
  let mcOptions = '<option value="">— Chọn mã vật tư —</option>';
  try {
    const r = await fetch('/api/inventory/material-codes');
    const arr = await r.json();
    if (Array.isArray(arr)) {
      mcOptions += arr
        .filter((mc) => String(mc || '').trim())
        .map((mc) => {
          const v = String(mc).trim();
          return `<option value="${_esc(v)}">${_esc(v)}</option>`;
        })
        .join('');
    }
  } catch (e) {
    console.warn('openImportOffcutModal material-codes', e);
  }
  openInvModal(
    'Nhập mảnh dư thủ công',
    `
    <p class="muted" style="font-size:12px;margin-bottom:10px">Nếu không nhập <strong>mã lô cha</strong> thì bắt buộc nhập <strong>lý do tạo</strong> mảnh dư.</p>
    <div class="form-grid">
      <div class="field-group"><label>Mã mảnh dư <span class="req">*</span></label><input id="ioc-id" class="field-input" placeholder="VD: SUBLOT-JB20-001"></div>
      <div class="field-group"><label>Mã lô cha</label><input id="ioc-pl" class="field-input" placeholder="VD: LOT-JB20-001"></div>
      <div class="field-group"><label>Mã vật tư <span class="req">*</span></label>
        <select id="ioc-mc" class="field-input">${mcOptions}</select></div>
      <div class="field-group"><label>Chiều rộng (m) <span class="req">*</span></label>
        <input type="number" id="ioc-w" class="field-input" value="1.52" step="0.01" min="0.01"></div>
      <div class="field-group"><label>Chiều dài (m) <span class="req">*</span></label>
        <input type="number" id="ioc-l" class="field-input" value="1.2" step="0.01" min="0.01"></div>
      <div class="field-group"><label>Trạng thái chất lượng <span class="req">*</span></label>
        <select id="ioc-qs" class="field-input">
          <option value="GOOD">Tốt (GOOD)</option>
          <option value="NORMAL" selected>Bình thường (NORMAL)</option>
          <option value="POOR">Kém (POOR)</option>
        </select></div>
      <div class="field-group"><label>Vị trí lưu kho <span class="req">*</span></label><input id="ioc-sl" class="field-input" value="OFFCUT-RACK-C" placeholder="VD: OFFCUT-RACK-C"></div>
      <div class="field-group full-width"><label>Lý do tạo <span class="muted" style="font-weight:400">(khi không có lô cha)</span></label><input id="ioc-cr" class="field-input" placeholder="VD: Nhập thừa từ cắt thử"></div>
      <div class="field-group"><label>Người thực hiện</label><input id="ioc-by" class="field-input" value="AD-001"></div>
      <div class="field-group full-width"><label>Ghi chú</label><input id="ioc-note" class="field-input"></div>
    </div>`,
    `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Hủy</button>
    <button type="button" class="btn btn-primary" onclick="submitImportOffcut()">Lưu</button>`,
    () => {
      const sel = document.getElementById('ioc-mc');
      if (!sel) return;
      const want = 'JB20';
      const opt = Array.from(sel.options).find((o) => o.value === want);
      if (opt) sel.value = want;
      else if (sel.options.length > 1) sel.selectedIndex = 1;
    },
  );
};

window.submitImportOffcut = async function() {
  const parent_lot_id = document.getElementById('ioc-pl').value.trim();
  const created_reason = document.getElementById('ioc-cr').value.trim();
  const material_code = document.getElementById('ioc-mc').value.trim();
  if (!material_code) { toast('warning', 'Thiếu mã vật tư', 'Chọn mã vật tư trong danh sách kho.'); return; }
  if (!parent_lot_id && !created_reason) { toast('warning', 'Thiếu lý do', 'Nhập mã lô cha hoặc lý do tạo mảnh dư.'); return; }
  const payload = {
    offcut_id: document.getElementById('ioc-id').value.trim(),
    parent_lot_id: parent_lot_id || null,
    material_code,
    width_m: parseFloat(document.getElementById('ioc-w').value),
    length_m: parseFloat(document.getElementById('ioc-l').value),
    quality_status: document.getElementById('ioc-qs').value,
    storage_location: document.getElementById('ioc-sl').value.trim(),
    created_reason: created_reason || undefined,
    performed_by: document.getElementById('ioc-by').value.trim() || 'AD-001',
    note: document.getElementById('ioc-note').value,
  };
  try {
    const r = await fetch('/api/inventory/offcuts/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
    toast('success', 'Nhập mảnh dư thành công', payload.offcut_id);
    closeInvModal(); taiQuanLyKho(); taiManhDu();
  } catch (e) { toast('error', 'Lỗi', e.message); }
};

window.openEditLotImportMetaModal = function (p) {
  const lotId = typeof p === 'string' ? p : (p && p.lot_id) || '';
  if (!lotId) return;
  const curDate = p && p.import_date != null ? String(p.import_date) : '';
  const curBy = p && p.import_performed_by != null ? String(p.import_performed_by) : '';
  openInvModal('Sửa thông tin nhập kho — ' + lotId, `
    <p class="muted" style="font-size:11px;margin:0 0 8px;line-height:1.45">Chỉnh <strong>người nhập</strong> và <strong>ngày nhập kho</strong>. Bắt buộc nhập <strong>lý do sửa</strong> — hệ thống ghi vào giao dịch kho và nhật ký kiểm toán.</p>
    <div class="form-grid">
      <div class="field-group"><label>Người nhập kho <span class="req">*</span></label>
        <input type="text" id="elm-by" class="field-input" value="${_esc(curBy)}" placeholder="VD: QL-002, Admin" /></div>
      <div class="field-group"><label>Ngày nhập kho <span class="req">*</span></label>
        <input type="text" id="elm-date" class="field-input" value="${_esc(curDate)}" placeholder="yyyy-mm-dd hoặc dd/mm/yyyy" /></div>
      <div class="field-group full-width"><label>Lý do sửa <span class="req">*</span></label>
        <input type="text" id="elm-reason" class="field-input" placeholder="Bắt buộc — phục vụ audit" /></div>
      <div class="field-group"><label>Người thực hiện chỉnh</label>
        <input type="text" id="elm-editor" class="field-input" value="${_esc(window.dycSessionUsername())}" /></div>
    </div>`,
    `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Hủy</button>
    <button type="button" class="btn btn-primary" onclick="submitEditLotImportMeta(${JSON.stringify(lotId)})">Lưu</button>`);
};

window.submitEditLotImportMeta = async function (lotId) {
  const import_performed_by = (document.getElementById('elm-by')?.value || '').trim();
  const import_date = (document.getElementById('elm-date')?.value || '').trim();
  const edit_reason = (document.getElementById('elm-reason')?.value || '').trim();
  const edited_by = (document.getElementById('elm-editor')?.value || '').trim() || window.dycSessionUsername() || '—';
  if (!import_performed_by) {
    toast('warning', 'Thiếu dữ liệu', 'Nhập người nhập kho.');
    return;
  }
  if (!import_date) {
    toast('warning', 'Thiếu dữ liệu', 'Nhập ngày nhập kho.');
    return;
  }
  if (!edit_reason) {
    toast('warning', 'Thiếu lý do', 'Nhập lý do sửa (bắt buộc cho audit).');
    return;
  }
  try {
    const r = await fetch(`/api/inventory/lots/${encodeURIComponent(lotId)}/import-meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ import_performed_by, import_date, edit_reason, edited_by }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail || d));
    toast('success', 'Đã cập nhật', lotId);
    closeInvModal();
    loadLots();
    if (typeof taiKhoLot === 'function') taiKhoLot();
    if (typeof renderLockedItems === 'function') renderLockedItems();
  } catch (e) {
    toast('error', 'Lỗi', e.message);
  }
};

window.openManualIssueLotModal = function (lotId, maxRemainingM) {
  const raw = maxRemainingM != null && maxRemainingM !== '' ? Number(maxRemainingM) : NaN;
  const maxM = Number.isFinite(raw) && raw >= 0 ? raw : null;
  const maxLabel =
    maxM == null
      ? '—'
      : maxM.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  let lenInputAttrs = 'id="mil-len" class="field-input" step="0.01"';
  if (maxM != null) {
    if (maxM > 0) {
      lenInputAttrs += ` min="0.01" max="${maxM}"`;
    } else {
      lenInputAttrs += ' min="0" max="0" step="0.001"';
    }
  } else {
    lenInputAttrs += ' min="0.01"';
  }
  const maxHintExtra =
    maxM === 0 ? ' <span class="muted">(không còn mét để xuất)</span>' : '';
  openInvModal('Xuất LOT thủ công — ' + lotId, `
    <div class="form-grid">
      <div class="field-group">
        <label>Chiều dài xuất (m) <span class="req">*</span></label>
        <p class="muted" style="font-size:11px;margin:0 0 6px;line-height:1.45">Tối đa có thể xuất: <strong>${maxLabel}</strong> m <span class="muted">(tồn còn lại)</span>${maxHintExtra}</p>
        <input type="number" ${lenInputAttrs} />
      </div>
      <div class="field-group full-width"><label>Lý do <span class="req">*</span></label><input id="mil-reason" class="field-input"></div>
      <div class="field-group"><label>Thực hiện bởi</label><input id="mil-by" class="field-input" value="${_esc(window.dycSessionUsername())}"></div>
      <div class="field-group"><label>Admin xác nhận</label><select id="mil-ov" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
      <div class="field-group full-width"><label>Ghi chú</label><input id="mil-note" class="field-input"></div>
    </div>`, `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Hủy</button>
    <button type="button" class="btn btn-primary" onclick="submitManualIssueLot(${JSON.stringify(lotId)})">Xuất kho</button>`);
};

window.submitManualIssueLot = async function(lotId) {
  const payload = {
    issue_length_m: parseFloat(document.getElementById('mil-len').value),
    reason: document.getElementById('mil-reason').value.trim(),
    performed_by: document.getElementById('mil-by').value.trim(),
    admin_override: document.getElementById('mil-ov').value === 'true',
    note: document.getElementById('mil-note').value,
  };
  try {
    const r = await fetch(`/api/inventory/lots/${encodeURIComponent(lotId)}/manual-issue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
    toast('success', 'Xuất kho thành công', d.detail || '');
    closeInvModal(); taiQuanLyKho(); taiKhoLot();
  } catch (e) { toast('error', 'Lỗi', e.message); }
};

window.openManualIssueOffcutModal = function(oid) {
  openInvModal('Xuất mảnh dư — ' + oid, `
    <p class="muted" style="font-size:11px">MVP: xuất một phần chỉ khi trùng full chiều rộng hoặc full chiều dài.</p>
    <div class="form-grid">
      <div class="field-group"><label>Chiều rộng xuất (m)</label><input type="number" id="mio-w" class="field-input" step="0.01"></div>
      <div class="field-group"><label>Chiều dài xuất (m)</label><input type="number" id="mio-l" class="field-input" step="0.01"></div>
      <div class="field-group full-width"><label>Lý do <span class="req">*</span></label><input id="mio-reason" class="field-input"></div>
      <div class="field-group"><label>Thực hiện bởi</label><input id="mio-by" class="field-input" value="${_esc(window.dycSessionUsername())}"></div>
      <div class="field-group"><label>Admin xác nhận</label><select id="mio-ov" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
      <div class="field-group"><label>Bỏ phần thừa (thành phế liệu)</label><select id="mio-scrap" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
      <div class="field-group full-width"><label>Ghi chú</label><input id="mio-note" class="field-input"></div>
    </div>`, `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Hủy</button>
    <button type="button" class="btn btn-primary" onclick="submitManualIssueOffcut('${oid}')">Xuất</button>`);
};

window.submitManualIssueOffcut = async function(oid) {
  const payload = {
    issue_width_m: parseFloat(document.getElementById('mio-w').value),
    issue_length_m: parseFloat(document.getElementById('mio-l').value),
    reason: document.getElementById('mio-reason').value.trim(),
    performed_by: document.getElementById('mio-by').value.trim(),
    admin_override: document.getElementById('mio-ov').value === 'true',
    clear_remaining_as_scrap: document.getElementById('mio-scrap').value === 'true',
    mark_remaining_as_available: true,
    note: document.getElementById('mio-note').value,
  };
  try {
    const r = await fetch(`/api/inventory/offcuts/${encodeURIComponent(oid)}/manual-issue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
    toast('success', 'Xuất mảnh dư thành công', '');
    closeInvModal(); taiQuanLyKho(); taiManhDu();
  } catch (e) { toast('error', 'Lỗi', e.message); }
};

window.openClearLotModal = function(lotId) {
  if (!confirm('Clear LOT sẽ đưa tồn về 0 và đổi trạng thái. Tiếp tục?')) return;
  openInvModal('Clear LOT — ' + lotId, `
    <div class="danger-zone"><i class="fa-solid fa-triangle-exclamation"></i> Thao tác nguy hiểm — cần lý do hợp lệ.</div>
    <div class="form-grid">
      <div class="field-group full-width"><label>Chế độ clear</label>
        <select id="cl-mode" class="field-input">
          <option value="WRITE_OFF_TO_ZERO">WRITE_OFF_TO_ZERO → CLEARED</option>
          <option value="MARK_AS_SCRAPPED">MARK_AS_SCRAPPED → SCRAPPED</option>
          <option value="CLOSE_DEPLETED">CLOSE_DEPLETED → CLOSED</option>
          <option value="LOST_IN_STOCKTAKE">LOST_IN_STOCKTAKE → CLEARED</option>
        </select></div>
      <div class="field-group full-width"><label>Lý do <span class="req">*</span></label><input id="cl-reason" class="field-input"></div>
      <div class="field-group"><label>Thực hiện bởi</label><input id="cl-by" class="field-input" value="${_esc(window.dycSessionUsername())}"></div>
      <div class="field-group"><label>Admin xác nhận</label><select id="cl-ov" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
      <div class="field-group full-width"><label>Ghi chú</label><input id="cl-note" class="field-input"></div>
    </div>`, `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Hủy</button>
    <button type="button" class="btn btn-danger" onclick="submitClearLot('${lotId}')">Clear kho</button>`);
};

window.submitClearLot = async function(lotId) {
  const payload = {
    clear_mode: document.getElementById('cl-mode').value,
    reason: document.getElementById('cl-reason').value.trim(),
    performed_by: document.getElementById('cl-by').value.trim(),
    admin_override: document.getElementById('cl-ov').value === 'true',
    note: document.getElementById('cl-note').value,
  };
  if (!payload.reason) { toast('warning', 'Thiếu lý do', ''); return; }
  try {
    const r = await fetch(`/api/inventory/lots/${encodeURIComponent(lotId)}/clear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
    toast('success', 'Clear LOT thành công', d.lot_status || '');
    closeInvModal(); taiQuanLyKho(); taiKhoLot();
  } catch (e) { toast('error', 'Lỗi', e.message); }
};

window.openClearOffcutModal = function(oid) {
  if (!confirm('Clear mảnh dư — ghi nhận scrap/write-off theo mode. Tiếp tục?')) return;
  openInvModal('Clear mảnh dư — ' + oid, `
    <div class="danger-zone"><i class="fa-solid fa-triangle-exclamation"></i> Clear mảnh dư</div>
    <div class="form-grid">
      <div class="field-group full-width"><label>Chế độ clear</label>
        <select id="co-mode" class="field-input">
          <option value="QUALITY_FAILED">Lỗi chất lượng (QUALITY_FAILED)</option>
          <option value="WRITE_OFF_TO_ZERO">Sử dụng hết (WRITE_OFF_TO_ZERO → CLEARED)</option>
          <option value="MARK_AS_SCRAPPED">Đánh dấu phế liệu (MARK_AS_SCRAPPED)</option>
          <option value="LOST_IN_STOCKTAKE">Thất lạc (LOST_IN_STOCKTAKE)</option>
          <option value="TOO_SMALL_TO_USE">Quá nhỏ không thể dùng (TOO_SMALL_TO_USE → SCRAPPED)</option>
        </select></div>
      <div class="field-group full-width"><label>Lý do <span class="req">*</span></label><input id="co-reason" class="field-input"></div>
      <div class="field-group"><label>Thực hiện bởi</label><input id="co-by" class="field-input" value="${_esc(window.dycSessionUsername())}"></div>
      <div class="field-group"><label>Admin xác nhận</label><select id="co-ov" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
    </div>`, `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Hủy</button>
    <button type="button" class="btn btn-danger" onclick="submitClearOffcut('${oid}')">Clear</button>`);
};

window.submitClearOffcut = async function(oid) {
  const payload = {
    clear_mode: document.getElementById('co-mode').value,
    reason: document.getElementById('co-reason').value.trim(),
    performed_by: document.getElementById('co-by').value.trim(),
    admin_override: document.getElementById('co-ov').value === 'true',
  };
  if (!payload.reason) { toast('warning', 'Thiếu lý do', ''); return; }
  try {
    const r = await fetch(`/api/inventory/offcuts/${encodeURIComponent(oid)}/clear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
    toast('success', 'Clear mảnh dư thành công', d.offcut_status || '');
    closeInvModal(); taiQuanLyKho(); taiManhDu();
  } catch (e) { toast('error', 'Lỗi', e.message); }
};

let _rlType = 'LOT', _rlId = '';
window.openReleaseLockModal = function(st, sid) {
  _rlType = st || 'LOT';
  _rlId = sid || '';
  openInvModal('Mở khóa tạm (kho)', `
    <div class="form-grid">
      <div class="field-group"><label>Loại nguồn</label>
        <select id="rl-st" class="field-input"><option value="LOT" ${_rlType==='LOT'?'selected':''}>Cuộn LOT</option><option value="OFFCUT" ${_rlType==='OFFCUT'?'selected':''}>Mảnh dư</option></select></div>
      <div class="field-group"><label>Mã nguồn <span class="req">*</span></label><input id="rl-sid" class="field-input" value="${_esc(_rlId)}"></div>
      <div class="field-group full-width"><label>Lý do <span class="req">*</span></label><input id="rl-reason" class="field-input"></div>
      <div class="field-group"><label>Thực hiện bởi</label><input id="rl-by" class="field-input" value="Admin"></div>
      <div class="field-group"><label>Mã yêu cầu liên quan</label><input id="rl-rid" class="field-input" placeholder="REQ-..."></div>
    </div>`, `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Hủy</button>
    <button type="button" class="btn btn-primary" onclick="submitReleaseLock()">Mở khóa</button>`);
};

window.submitReleaseLock = async function() {
  const payload = {
    source_type: document.getElementById('rl-st').value,
    source_id: document.getElementById('rl-sid').value.trim(),
    reason: document.getElementById('rl-reason').value.trim(),
    performed_by: document.getElementById('rl-by').value.trim(),
    related_request_id: document.getElementById('rl-rid').value.trim() || undefined,
  };
  if (!payload.source_id || !payload.reason) { toast('warning', 'Thiếu dữ liệu', ''); return; }
  try {
    const r = await fetch('/api/inventory/locks/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
    toast('success', 'Mở khóa thành công', '');
    closeInvModal(); taiQuanLyKho(); taiKhoLot(); taiManhDu();
  } catch (e) { toast('error', 'Lỗi', e.message); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// KHO LOT & MẢNH DƯ
// ═══════════════════════════════════════════════════════════════════════════════
async function taiKhoLot() {
  const fgEl = document.getElementById('kl-film-group');
  const matEl = document.getElementById('kl-mat');
  const stEl = document.getElementById('kl-status');
  const filterFg = fgEl ? fgEl.value : '';
  const filterMat = (matEl ? matEl.value : '').toLowerCase().trim();
  const filterSt = stEl ? stEl.value : '';

  const q = new URLSearchParams();
  if (filterFg) q.set('film_type', filterFg);
  const allLots = await fetch('/api/lots?' + q.toString()).then(r => r.json());

  allLots.forEach(l => {
    let eff = l.lot_status || l.status || 'ACTIVE';
    if ((l.remaining_length_m || 0) <= 0 && eff === 'ACTIVE') eff = 'DEPLETED';
    l._eff_status = eff;
  });

  const lots = allLots.filter(l => {
    if (filterMat && !(l.material_code || '').toLowerCase().includes(filterMat)) return false;
    if (filterSt === 'ACTIVE') { if (l._eff_status !== 'ACTIVE') return false; }
    else if (filterSt === 'DEPLETED') { if (l._eff_status === 'ACTIVE') return false; }
    return true;
  });

  document.getElementById('table-lots-body').innerHTML = lots.length === 0
    ? '<tr><td colspan="11" class="text-center muted" style="padding:20px">Không có cuộn LOT nào.</td></tr>'
    : lots.map(l => `<tr>
        <td><strong>${l.lot_id}</strong></td>
        <td>${l.material_code || '—'}</td>
        <td><small>${_esc(filmTypeLabel(l.film_type))}</small></td>
        <td>${l.original_width_m ?? '—'} m</td>
        <td>${l.original_length_m ?? '—'} m</td>
        <td><strong style="color:${(l.remaining_length_m || 0) < 2 ? 'var(--red-light)' : 'var(--green-light)'}">${l.remaining_length_m ?? '—'} m</strong></td>
        <td>${l.is_opened ? '<span style="color:var(--orange-light)">Đang dùng</span>' : '<span style="color:var(--green-light)">Nguyên</span>'}</td>
        <td>${l.is_locked ? '<span style="color:var(--red-light)"><i class="fa-solid fa-lock"></i> Đang khóa</span>' : '<span style="color:var(--text-muted)">Khả dụng</span>'}</td>
        <td><small>${_esc((l.import_performed_by || '').trim() || '—')}</small></td>
        <td>${l.import_date || '—'}</td>
        <td>${trangThaiBadge(l._eff_status)}</td>
      </tr>`).join('');
}

window.resetKhoLot = function() {
  const fgEl = document.getElementById('kl-film-group');
  const matEl = document.getElementById('kl-mat');
  const stEl = document.getElementById('kl-status');
  if (fgEl) fgEl.value = '';
  if (matEl) matEl.value = '';
  if (stEl) stEl.value = '';
  taiKhoLot();
};

async function taiManhDu() {
  const fgEl = document.getElementById('oc-film-group');
  const statusEl = document.getElementById('oc-status');
  const filterFg = fgEl ? fgEl.value : '';
  const filterStatus = statusEl ? statusEl.value : '';

  const q = new URLSearchParams();
  if (filterFg) q.set('film_type', filterFg);
  let offcuts = await fetch('/api/offcuts?' + q.toString()).then(r => r.json());

  offcuts.forEach(o => {
    let eff = (o.offcut_status || o.status || 'AVAILABLE').toUpperCase();
    if (eff === 'ACTIVE') eff = 'AVAILABLE';
    if ((Number(o.area_m2) <= 0 || o.area_m2 === '0.0') && (eff === 'AVAILABLE' || eff === 'ACTIVE')) eff = 'USED';
    o._eff_status = eff;
  });

  if (filterStatus === '') {
    offcuts = offcuts.filter(o => o._eff_status === 'AVAILABLE' || o._eff_status === 'ACTIVE' || o._eff_status === 'PARTIALLY_USED');
  } else if (filterStatus !== 'ALL') {
    offcuts = offcuts.filter(o => o._eff_status === filterStatus);
  }

  const tbody = document.getElementById('table-offcuts-body');
  if (offcuts.length === 0) { tbody.innerHTML = '<tr><td colspan="12" class="text-center muted" style="padding:20px">Không có mảnh dư nào.</td></tr>'; return; }
  tbody.innerHTML = offcuts.map(o => `<tr>
    <td><strong>${o.offcut_id}</strong></td>
    <td>${o.parent_lot_id || '—'}</td>
    <td><small>${_esc(filmTypeLabel(o.film_type))}</small></td>
    <td>${o.material_code}</td>
    <td>${o.width_m} m</td>
    <td>${o.length_m} m</td>
    <td>${o.area_m2} m²</td>
    <td>${o.is_locked ? '<span style="color:var(--red-light)"><i class="fa-solid fa-lock" style="margin-right:4px;"></i>Khóa</span>' : '<span style="color:var(--text-muted)">—</span>'}</td>
    <td>${o.storage_location || '—'}</td>
    <td>${_esc((o.import_performed_by || '').trim() || 'Admin')}</td>
    <td>${o.import_date || '—'}</td>
    <td>${trangThaiBadge(o._eff_status)}</td>
  </tr>`).join('');
}

window.resetFilterOffcuts = function() {
  const qEl = document.getElementById('oc-q');
  const fgEl = document.getElementById('oc-film-group');
  const stEl = document.getElementById('oc-status');
  if (qEl) qEl.value = '';
  if (fgEl) fgEl.value = '';
  if (stEl) stEl.value = '';
  taiManhDu();
};

// ═══════════════════════════════════════════════════════════════════════════════
// KHO THẢM SÀN
// ═══════════════════════════════════════════════════════════════════════════════
let _floorMatsCache = [];

async function loadFloorMats() {
  try {
    _floorMatsCache = await fetch('/api/floor-mats').then(r => r.json());
    renderFloorMatsTable();
    _populateFmSkuSelect();
  } catch (e) {
    console.error('loadFloorMats error', e);
  }
}

function renderFloorMatsTable() {
  const tbody = document.getElementById('table-floormats-body');
  if (!tbody) return;
  const q = (document.getElementById('fm-q')?.value || '').trim().toLowerCase();
  let rows = _floorMatsCache;
  if (q) rows = rows.filter(r => (r.sku + r.name).toLowerCase().includes(q));
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center muted" style="padding:20px">Chưa có SKU thảm sàn nào.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const lowBadge = r.low_stock ? '<span style="color:var(--red-light);font-size:11px;font-weight:600"> ⚠ Thấp</span>' : '';
    return `<tr>
      <td><strong>${_esc(r.sku)}</strong></td>
      <td>${_esc(r.name)}</td>
      <td>${_esc(r.unit)}</td>
      <td><strong>${r.qty_total}</strong></td>
      <td>${r.qty_reserved}</td>
      <td style="color:${r.qty_available <= 0 ? 'var(--red-light)' : ''}"><strong>${r.qty_available}</strong>${lowBadge}</td>
      <td>${r.min_stock}</td>
      <td>${_esc(r.supplier)}</td>
      <td>${_esc(r.note)}</td>
      <td>
        <button type="button" class="btn btn-outline btn-xs" onclick="openFmImportInline('${_esc(r.sku)}')">
          <i class="fa-solid fa-arrow-down-to-line"></i> Nhập
        </button>
      </td>
    </tr>`;
  }).join('');
}

function _populateFmSkuSelect() {
  const sel = document.getElementById('fm-import-sku');
  if (!sel) return;
  sel.innerHTML = _floorMatsCache.map(r => `<option value="${_esc(r.sku)}">${_esc(r.sku)} — ${_esc(r.name)}</option>`).join('');
}

window.openFmImportInline = function(sku) {
  const selEl = document.getElementById('fm-import-sku');
  if (selEl) selEl.value = sku;
  document.getElementById('fm-import-qty')?.focus();
};

document.getElementById('btn-fm-import')?.addEventListener('click', async () => {
  const sku = document.getElementById('fm-import-sku')?.value || '';
  const qty = parseInt(document.getElementById('fm-import-qty')?.value || '0');
  const note = (document.getElementById('fm-import-note')?.value || '').trim();
  if (!sku) return showToast('Chọn SKU để nhập kho.', 'warn');
  if (qty <= 0) return showToast('Số lượng phải lớn hơn 0.', 'warn');
  try {
    const r = await fetch(`/api/floor-mats/${encodeURIComponent(sku)}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty, note }),
    }).then(r => r.json());
    if (r.status === 'success') {
      showToast(`Đã nhập ${qty} ${r.sku ? '' : ''}. Tồn: ${r.qty_total}`, 'success');
      await loadFloorMats();
    } else {
      showToast(r.detail || 'Nhập kho thất bại.', 'error');
    }
  } catch (e) {
    showToast('Lỗi kết nối khi nhập kho thảm sàn.', 'error');
  }
});

// ── FM SERVICE CARD trong form Tạo đơn ─────────────────────────────────────

async function loadFmSkusForCreate() {
  try {
    if (!_floorMatsCache.length) {
      _floorMatsCache = await fetch('/api/floor-mats').then(r => r.json());
    }
    renderFmSkuListForCreate();
  } catch (e) {
    const el = document.getElementById('mc-fm-loading');
    if (el) el.textContent = 'Không tải được danh sách SKU. Thử lại.';
  }
}

function renderFmSkuListForCreate() {
  const wrap = document.getElementById('mc-fm-sku-list');
  if (!wrap) return;
  const loading = document.getElementById('mc-fm-loading');
  if (loading) loading.style.display = 'none';
  if (!_floorMatsCache.length) {
    wrap.innerHTML = '<p class="manual-inline-hint">Chưa có SKU thảm sàn trong hệ thống.</p>';
    return;
  }
  wrap.innerHTML = _floorMatsCache.map(r => `
    <div class="mc-fm-sku-row" style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <label style="min-width:220px;font-size:13px">
        <strong>${_esc(r.sku)}</strong> — ${_esc(r.name)}
        <span style="color:var(--text-muted);font-size:11px">(KD: ${r.qty_available} ${r.unit})</span>
      </label>
      <input type="number" class="mc-fm-qty manual-control" data-sku="${_esc(r.sku)}" min="0" value="0" style="width:80px" />
    </div>
  `).join('');
}

function mcGetFmPlan() {
  const items = [];
  document.querySelectorAll('.mc-fm-qty').forEach(inp => {
    const qty = parseInt(inp.value || '0');
    if (qty > 0) items.push({ sku: inp.dataset.sku, qty });
  });
  return items;
}

// Listen for mc-svc-fm toggle
document.getElementById('mc-svc-fm')?.addEventListener('change', function() {
  if (this.checked) loadFmSkusForCreate();
});

// ═══════════════════════════════════════════════════════════════════════════════
// BÁO CÁO THÁNG + BÁO CÁO NGÀY (sub-tab)
// ═══════════════════════════════════════════════════════════════════════════════
window.__MONTHLY_SUB__ = window.__MONTHLY_SUB__ || 'monthly';

function dycIsoDateVietnam(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch (_) {
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/** Hiển thị nhãn ngày dd/mm/yyyy cho hero báo cáo ngày */
function _dailyFmtLabelDate(iso) {
  const s = (iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function setMonthlySubtab(which) {
  window.__MONTHLY_SUB__ = which;
  document.querySelectorAll('.monthly-subtab').forEach((b) => {
    const on = b.getAttribute('data-monthly-sub') === which;
    b.classList.toggle('active', on);
    b.classList.toggle('btn-primary', on);
    b.classList.toggle('btn-outline', !on);
  });
  const pm = document.getElementById('monthly-pane-monthly');
  const pd = document.getElementById('monthly-pane-daily');
  if (pm) pm.style.display = which === 'monthly' ? '' : 'none';
  if (pd) pd.style.display = which === 'daily' ? '' : 'none';
  if (which === 'daily') {
    const inp = document.getElementById('daily-report-date');
    if (inp && !inp.value) inp.value = dycIsoDateVietnam();
  }
}

async function taiBangBaoCaoThangTab() {
  if (window.__MONTHLY_SUB__ === 'daily') {
    await loadDailyReport();
    return;
  }
  await taiBaoCaoThang();
}

function _dailyKpiCard(val, label, cls) {
  const c = cls ? ` ${cls}` : '';
  return `<div class="monthly-kpi${c}"><div class="mk-val">${Number(val) || 0}</div><div class="mk-label">${_esc(label)}</div></div>`;
}

function _dailyUl(items, fmt) {
  if (!items || !items.length) return '<p class="muted">Không có dữ liệu phát sinh.</p>';
  const lis = items.map((it) => `<li>${_esc(fmt(it))}</li>`).join('');
  return `<ul>${lis}</ul>`;
}

async function loadDailyReport(isoDate) {
  const inp = document.getElementById('daily-report-date');
  const errEl = document.getElementById('daily-report-error');
  const dateStr = (isoDate || (inp && inp.value) || dycIsoDateVietnam()).trim();
  if (inp && isoDate) inp.value = isoDate;
  if (errEl) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }
  const dateLabel = document.getElementById('daily-dash-date-label');
  if (dateLabel) dateLabel.textContent = _dailyFmtLabelDate(dateStr);
  let data;
  try {
    data = await fetchJSON(`/api/reports/daily?date=${encodeURIComponent(dateStr)}`);
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.message || String(e);
      errEl.style.display = 'block';
    }
    toast('error', 'Báo cáo ngày', e.message || String(e));
    return null;
  }
  const k = data.kpis || {};
  const mgrBody = document.getElementById('daily-manager-body');
  if (mgrBody) {
    const mgr = data.manager_daily_rows || [];
    if (!mgr.length) {
      mgrBody.innerHTML =
        '<tr><td colspan="13" class="muted text-center" style="padding:28px">Không có đơn trong tầm nhìn ngày này (không có hạn giao D và không có luồng đang mở).</td></tr>';
    } else {
      const mk = (on) =>
        on
          ? '<span class="daily-cell-tick" aria-label="Có">✓</span>'
          : '<span class="daily-cell-empty">—</span>';
      mgrBody.innerHTML = mgr
        .map((row, idx) => {
          const dueChip = row.due_in_day
            ? `<span class="daily-chip daily-chip-due">${_esc(row.due_bucket || 'Trong ngày')}</span>`
            : '<span class="muted">—</span>';
          const link = row.detail_link
            ? `<a class="daily-dash-link" href="${_esc(row.detail_link)}">Mở</a>`
            : '';
          return `<tr class="${row.due_in_day ? 'daily-row-due' : ''}">
          <td class="daily-col-stt"><strong>${idx + 1}</strong></td>
          <td class="daily-col-stt2"><small>${_esc(row.stt_thang || '')}</small></td>
          <td class="daily-col-time"><small>${_esc(row.ngay_thuc_hien || '')}</small></td>
          <td><strong>${_esc(row.request_code || '')}</strong></td>
          <td>${_esc(row.sales_consultant || '—')}</td>
          <td><code class="daily-vin">${_esc(row.vin_last6 || '')}</code></td>
          <td>${_esc(row.vehicle_model || '')}</td>
          <td class="daily-col-check">${mk(row.ppf)}</td>
          <td class="daily-col-check">${mk(row.pcn)}</td>
          <td class="daily-col-check">${mk(row.hoan_thanh)}</td>
          <td>${dueChip}</td>
          <td class="daily-col-note"><small>${_esc(row.ghi_chu || '')}</small></td>
          <td class="daily-col-link">${link}</td>
        </tr>`;
        })
        .join('');
    }
  }
  const kpiEl = document.getElementById('daily-report-kpis');
  if (kpiEl) {
    kpiEl.innerHTML = [
      _dailyKpiCard(k.open_total, 'Việc đang mở', ''),
      _dailyKpiCard(k.due_today_total, 'Hạn giao xe (ngày D)', 'warn'),
      _dailyKpiCard(k.completed_yesterday_requests, 'Đơn hoàn tất (D−1)', 'good'),
      _dailyKpiCard(k.in_progress, 'Đang thi công', ''),
      _dailyKpiCard(k.pending_tech_allocation, 'Chờ KTV xác nhận phân bổ', ''),
      _dailyKpiCard(k.waiting_inventory_commit, 'Chờ commit kho', 'warn'),
      _dailyKpiCard(k.extra_cut_open, 'Yêu cầu cắt bổ sung', 'warn'),
      _dailyKpiCard(k.overdue_or_risk, 'Trễ hạn / quá hạn (luồng mở)', 'danger'),
    ].join('');
  }
  const summaryLines = [];
  if (k.pending_approval) summaryLines.push(`Chờ Quản lý duyệt: ${k.pending_approval}`);
  if (k.pending_tech_allocation) summaryLines.push(`Chờ KTV xác nhận phân bổ: ${k.pending_tech_allocation}`);
  if (k.in_progress) summaryLines.push(`Đang thi công: ${k.in_progress}`);
  if (k.pending_actual_confirmation) summaryLines.push(`Chờ nhập xác nhận thực tế: ${k.pending_actual_confirmation}`);
  if (k.waiting_inventory_commit) summaryLines.push(`Chờ commit kho: ${k.waiting_inventory_commit}`);
  const openBody = document.getElementById('daily-sec-open');
  if (openBody) {
    const head = summaryLines.length ? `<p><strong>Tổng hợp:</strong> ${summaryLines.map(_esc).join(' · ')}</p>` : '';
    const list = _dailyUl(data.open_work || [], (x) =>
      `${x.request_code || x.request_id || ''} — ${x.workstream_label || ''} — ${x.category || ''} (${x.status || ''})`,
    );
    openBody.innerHTML = head + list;
  }
  const dueEl = document.getElementById('daily-sec-due');
  if (dueEl) {
    dueEl.innerHTML = _dailyUl(data.due_today || [], (x) => {
      const parts = [x.request_code, x.bucket, x.vehicle].filter(Boolean);
      if (x.vin_last6) parts.push(`VIN ${x.vin_last6}`);
      return parts.join(' — ');
    });
  }
  const doneEl = document.getElementById('daily-sec-done');
  if (doneEl) {
    const counts = `<p><strong>Luồng PPF (đã đóng, D−1):</strong> ${k.completed_yesterday_ppf || 0} · <strong>Luồng cách nhiệt (đã đóng, D−1):</strong> ${k.completed_yesterday_wf || 0}</p>`;
    doneEl.innerHTML = counts + _dailyUl(data.completed_yesterday || [], (x) =>
      `${x.request_code || ''} — ${x.label || ''} — ${x.workstream_id || ''}`,
    );
  }
  const warnEl = document.getElementById('daily-sec-warn');
  if (warnEl) {
    warnEl.innerHTML = _dailyUl(data.warnings || [], (w) => w.message || '');
  }
  const tbody = document.getElementById('daily-detail-body');
  if (tbody) {
    const rows = data.detail_rows || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="14" class="muted text-center" style="padding:20px">Chưa có luồng nào.</td></tr>';
    } else {
      tbody.innerHTML = rows.map((r) => {
        const link = r.detail_link ? `<a href="${_esc(r.detail_link)}">Mở</a>` : '';
        return `<tr>
          <td>${_esc(r.request_code || '')}</td>
          <td><small>${_esc(r.workstream_id || '')}</small></td>
          <td>${_esc(r.workstream_type || '')}</td>
          <td>${_esc(r.vehicle || '')}</td>
          <td>${_esc(r.vin_last6 || '')}</td>
          <td><small>${_esc(r.dealer_customer || '')}</small></td>
          <td><small>${_esc(r.technician_team || '')}</small></td>
          <td>${_esc(r.status || '')}</td>
          <td><small>${_esc(r.requested_delivery_time || '')}</small></td>
          <td><small>${_esc(r.started_at || '')}</small></td>
          <td><small>${_esc(r.completed_at || '')}</small></td>
          <td>${_esc(r.sla || '')}</td>
          <td><small>${_esc(r.warnings || '')}</small></td>
          <td>${link}</td>
        </tr>`;
      }).join('');
    }
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BÁO CÁO THÁNG (charts)
// ═══════════════════════════════════════════════════════════════════════════════
async function taiBaoCaoThang() {
  try {
    const data = await fetch('/api/monthly-dashboard').then(r => r.json());
    if (!data || data.length === 0) return;
    const latest = data[data.length - 1];
    const labels = data.map(d => { const [yr, mo] = d.month.split('-'); return `T${mo}/${yr}`; });

    document.getElementById('monthly-kpis').innerHTML = `
      <div class="monthly-kpi"><div class="mk-val">${latest.total_requests}</div><div class="mk-label">Tổng đơn (${labels.at(-1)})</div></div>
      <div class="monthly-kpi good"><div class="mk-val">${latest.closed}</div><div class="mk-label">Đã hoàn tất</div></div>
      <div class="monthly-kpi ${latest.on_time_rate >= 90 ? 'good' : 'warn'}"><div class="mk-val">${latest.on_time_rate}%</div><div class="mk-label">Đúng hạn</div></div>
      <div class="monthly-kpi ppf"><div class="mk-val">${latest.ppf_jobs}</div><div class="mk-label">Lệnh PPF</div></div>
      <div class="monthly-kpi wf"><div class="mk-val">${latest.wf_jobs}</div><div class="mk-label">Lệnh Cách Nhiệt</div></div>
      <div class="monthly-kpi"><div class="mk-val">${latest.t_type_count}</div><div class="mk-label">T-TYPE (trong)</div></div>
      <div class="monthly-kpi"><div class="mk-val">${latest.m_type_count}</div><div class="mk-label">M-TYPE (mờ)</div></div>
      <div class="monthly-kpi warn"><div class="mk-val">${latest.scrap_m2} m²</div><div class="mk-label">Phế liệu</div></div>`;

    document.getElementById('ppf-stats').innerHTML = `
      <span class="dl">Tổng lệnh PPF</span><span class="dv">${latest.ppf_jobs}</span>
      <span class="dl">PPF hoàn tất</span><span class="dv" style="color:var(--green-light)">${latest.ppf_completed}</span>
      <span class="dl">Tỷ lệ hoàn tất PPF</span><span class="dv">${latest.ppf_completion_rate}%</span>
      <span class="dl">T-TYPE / M-TYPE</span><span class="dv">${latest.t_type_count} / ${latest.m_type_count}</span>`;
    document.getElementById('wf-stats').innerHTML = `
      <span class="dl">Tổng lệnh Cách Nhiệt</span><span class="dv">${latest.wf_jobs}</span>
      <span class="dl">Cách Nhiệt hoàn tất</span><span class="dv" style="color:var(--green-light)">${latest.wf_completed}</span>
      <span class="dl">Tỷ lệ hoàn tất</span><span class="dv">${latest.wf_completion_rate}%</span>
      <span class="dl">RT40 / JB20</span><span class="dv">${latest.rt40_jobs} / ${latest.jb20_jobs}</span>`;

    document.getElementById('table-monthly-body').innerHTML = data.map(d => {
      const [yr, mo] = d.month.split('-');
      return `<tr data-month="${String(d.month).replace(/"/g, '')}">
        <td><strong>Tháng ${mo}/${yr}</strong></td>
        <td>${d.total_requests}</td>
        <td><span style="color:var(--green-light)">${d.closed}</span></td>
        <td><span style="color:${d.on_time_rate >= 90 ? 'var(--green-light)' : 'var(--orange-light)'}">${d.on_time_rate}%</span></td>
        <td style="color:var(--red-light)">${d.ppf_jobs}</td>
        <td style="color:var(--blue-light)">${d.wf_jobs}</td>
        <td>${d.t_type_count}</td>
        <td>${d.m_type_count}</td>
        <td>${d.scrap_m2} m²</td>
      </tr>`;}).join('');

    const chartDefs = { responsive: true, plugins: { legend: { labels: { color: '#555555', font: { family: 'Inter', size: 11 } } } }, scales: { x: { ticks: { color: '#555555' }, grid: { color: 'rgba(0,0,0,0.06)' } }, y: { ticks: { color: '#555555' }, grid: { color: 'rgba(0,0,0,0.06)' } } } };
    destroyChart('chart-requests');
    charts['chart-requests'] = new Chart(document.getElementById('chart-requests'), { type: 'bar', data: { labels, datasets: [
      { label: 'Tổng đơn', data: data.map(d => d.total_requests), backgroundColor: 'rgba(229,57,53,0.4)', borderColor: '#e53935', borderWidth: 2, borderRadius: 6 },
      { label: 'Hoàn tất', data: data.map(d => d.closed), backgroundColor: 'rgba(0,200,83,0.4)', borderColor: '#00c853', borderWidth: 2, borderRadius: 6 },
    ]}, options: chartDefs });
    destroyChart('chart-ontime');
    charts['chart-ontime'] = new Chart(document.getElementById('chart-ontime'), { type: 'line', data: { labels, datasets: [
      { label: 'Đúng hạn (%)', data: data.map(d => d.on_time_rate), borderColor: '#00bfa5', backgroundColor: 'rgba(0,191,165,0.15)', fill: true, tension: 0.4, pointBackgroundColor: '#00bfa5' },
    ]}, options: { ...chartDefs, scales: { ...chartDefs.scales, y: { ...chartDefs.scales.y, min: 0, max: 100 } } } });
    destroyChart('chart-ppf-type');
    charts['chart-ppf-type'] = new Chart(document.getElementById('chart-ppf-type'), { type: 'bar', data: { labels, datasets: [
      { label: 'T-TYPE (Trong)', data: data.map(d => d.t_type_count), backgroundColor: 'rgba(229,57,53,0.5)', borderColor: '#e53935', borderWidth: 2, borderRadius: 6 },
      { label: 'M-TYPE (Mờ)', data: data.map(d => d.m_type_count), backgroundColor: 'rgba(124,77,255,0.5)', borderColor: '#7c4dff', borderWidth: 2, borderRadius: 6 },
    ]}, options: chartDefs });
    destroyChart('chart-wf-material');
    charts['chart-wf-material'] = new Chart(document.getElementById('chart-wf-material'), { type: 'bar', data: { labels, datasets: [
      { label: 'RT40 (Kính lái)', data: data.map(d => d.rt40_jobs), backgroundColor: 'rgba(0,191,165,0.5)', borderColor: '#00bfa5', borderWidth: 2, borderRadius: 6 },
      { label: 'JB20 (Cách nhiệt)', data: data.map(d => d.jb20_jobs), backgroundColor: 'rgba(66,165,245,0.5)', borderColor: '#42a5f5', borderWidth: 2, borderRadius: 6 },
    ]}, options: chartDefs });
    const focusMonth = window.__DYC_MONTHLY_URL_MONTH__;
    if (focusMonth) {
      const safeM = String(focusMonth).replace(/[^0-9-]/g, '');
      const tr = document.querySelector(`#table-monthly-body tr[data-month="${safeM}"]`);
      if (tr) {
        tr.style.outline = '2px solid var(--orange-light)';
        tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.__DYC_MONTHLY_URL_MONTH__ = null;
    }
  } catch(e) { toast('error', 'Lỗi tải báo cáo', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NHẬT KÝ KIỂM TOÁN
// ═══════════════════════════════════════════════════════════════════════════════
async function taiNhatKy() {
  const qs = new URLSearchParams();
  const a = document.getElementById('audit-filter-action')?.value?.trim();
  const et = document.getElementById('audit-filter-entity-type')?.value?.trim();
  const eid = document.getElementById('audit-filter-entity-id')?.value?.trim();
  const rq = document.getElementById('audit-filter-request')?.value?.trim();
  const ac = document.getElementById('audit-filter-actor')?.value?.trim();
  const df = document.getElementById('audit-filter-from')?.value;
  const dt = document.getElementById('audit-filter-to')?.value;
  if (a) qs.set('action', a);
  if (et) qs.set('entity_type', et);
  if (eid) qs.set('entity_id', eid);
  if (rq) qs.set('request_id', rq);
  if (ac) qs.set('actor', ac);
  if (df) qs.set('date_from', df);
  if (dt) qs.set('date_to', dt);
  const logs = await fetch('/api/audit-logs?' + qs.toString()).then(r => r.json());
  document.getElementById('table-audit-body').innerHTML = logs.length === 0
    ? '<tr><td colspan="11" class="text-center muted" style="padding:20px">Chưa có giao dịch nào.</td></tr>'
    : logs.map(l => `<tr>
        <td><small style="color:var(--text-muted)">${l.log_id}</small></td>
        <td><strong>${l.request_id || '—'}</strong></td>
        <td><small style="color:var(--purple-light)">${l.workstream_id || '—'}</small></td>
        <td>${txnBadge(l.transaction_type)}</td>
        <td>${l.source_type || '—'}</td>
        <td>${l.source_id || '—'}</td>
        <td><small style="color:var(--orange-light)">${l.before_value || '—'}</small></td>
        <td><small style="color:var(--green-light)">${l.after_value || '—'}</small></td>
        <td style="max-width:180px;white-space:normal;font-size:11px">${l.reason || '—'}</td>
        <td><strong>${l.actor || '—'}</strong></td>
        <td><small>${fmtDt(l.timestamp)}</small></td>
      </tr>`).join('');
}

// ─── KHỞI TẠO ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const u = (document.getElementById('login-username')?.value || '').trim();
    const p = document.getElementById('login-password')?.value || '';
    const msg = document.getElementById('login-error');
    if (msg) { msg.textContent = ''; msg.style.display = 'none'; }
    try {
      const data = await fetchJSON('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      if (data && data.user) {
        window.__DYC_AUTH__ = { user: data.user, permissions: data.permissions || {} };
        applyDycUserChrome();
        const ov = document.getElementById('login-overlay');
        if (ov) ov.style.display = 'none';
        try {
          await taiTongQuan();
          taiThongBao();
          if (!window.__DYC_NOTIF_INTERVAL__) {
            window.__DYC_NOTIF_INTERVAL__ = setInterval(taiThongBao, 30000);
          }
          await dycApplyDeepLinkFromUrl();
        } catch (e) {
          console.error(e);
        }
      }
    } catch (e) {
      if (msg) {
        msg.textContent = e.message || 'Đăng nhập thất bại.';
        msg.style.display = 'block';
      }
    }
  });
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (_) { /* ignore */ }
    window.__DYC_AUTH__ = { user: null, permissions: {} };
    const ov = document.getElementById('login-overlay');
    if (ov) ov.style.display = 'flex';
    applyDycUserChrome();
  });
  document.getElementById('tab-manual')?.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t && t.classList && t.classList.contains('mc-wf-item')) mcPreviewNorm();
    if (t && t.classList && t.classList.contains('mc-ppf-item')) mcPreviewNorm();
    if (t && (t.id === 'mc-svc-wf' || t.id === 'mc-svc-ppf' || t.id === 'mc-svc-gl')) mcPreviewNorm();
  });
  document.querySelectorAll('#inv-subtabs .inv-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      _invSub = btn.dataset.invSub;
      taiQuanLyKho();
    });
  });
  document.querySelectorAll('.cust-sub').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cust-sub').forEach(b => { b.classList.remove('active'); b.classList.remove('btn-primary'); b.classList.add('btn-outline'); });
      btn.classList.add('active'); btn.classList.remove('btn-outline'); btn.classList.add('btn-primary');
      taiKhachHang();
    });
  });
  void (async () => {
    const ok = await window.ensureDycLoggedIn();
    if (!ok) return;
    taiTongQuan();
    taiThongBao();
    if (!window.__DYC_NOTIF_INTERVAL__) {
      window.__DYC_NOTIF_INTERVAL__ = setInterval(taiThongBao, 30000);
    }
    await dycApplyDeepLinkFromUrl();
  })();
  document.getElementById('tab-norms')?.addEventListener('click', (ev) => {
    const subBtn = ev.target.closest('[data-norms-sub]');
    if (subBtn) {
      window._normsSubtab = subBtn.getAttribute('data-norms-sub') || 'wf';
      if (window._normsSubtab === 'ppf') {
        ensureCustFilters();
        window._custF.norms.has_windshield = '';
        window._custF.norms.has_sunroof = '';
        window._custF.norms.has_rear_side_triangle = '';
      }
      document.querySelectorAll('#tab-norms [data-norms-sub]').forEach((b) => {
        const on = b === subBtn;
        b.classList.toggle('active', on);
        b.classList.toggle('btn-primary', on);
        b.classList.toggle('btn-outline', !on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      taiDinhMucPhim();
      return;
    }
    const fa = ev.target.closest('[data-flt-act]');
    if (fa) {
      const act = fa.getAttribute('data-flt-act');
      if (act === 'norms-apply') { applyCustomerFilters('norms'); taiDinhMucPhim(); return; }
      if (act === 'norms-clear') { clearCustomerFilters('norms'); taiDinhMucPhim(); return; }
      if (act === 'norms-refresh') { clearCustomerFilters('norms'); taiDinhMucPhim(); return; }
      if (act === 'norms-add') { window.moFormNorm(''); return; }
    }
  });
  document.getElementById('tab-norms')?.addEventListener('input', (ev) => {
    if (ev.target.id === 'flt-n-q' || ev.target.id === 'flt-n-model') __debNormQ();
  });
  document.getElementById('tab-norms')?.addEventListener('change', (ev) => {
    if (ev.target.id.startsWith('flt-n-')) __debNormQ();
  });
  document.getElementById('tab-norms')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      const id = ev.target.id;
      if (id.startsWith('flt-n-')) {
        ev.preventDefault();
        applyCustomerFilters('norms');
        taiDinhMucPhim();
      }
    }
  });

  _wireReasonModalOnce();
  document.querySelector('#tab-workstreams table.data-table thead')?.addEventListener('click', (ev) => {
    const th = ev.target.closest('th.ws-sortable');
    if (!th) return;
    const k = th.getAttribute('data-ws-sort');
    if (k && typeof window.wsToggleWorkstreamSort === 'function') window.wsToggleWorkstreamSort(k);
  });
});



async function taiDinhMucPhim() {
  ensureCustFilters();
  if (window._normsSubtab !== 'wf' && window._normsSubtab !== 'ppf') {
    window._normsSubtab = 'wf';
  }
  _ensureModelDatalist();
  await refreshModelDatalistFromApi();
  await refreshMcVehicleModelSelectFromApi();
  const fn = window._custF.norms;
  const isPpf = window._normsSubtab === 'ppf';
  const qParams = { ...fn, with_meta: '1' };
  if (isPpf) {
    qParams.film_type = 'PPF';
    qParams.has_windshield = '';
    qParams.has_sunroof = '';
    qParams.has_rear_side_triangle = '';
  } else if (!fn.film_type) {
    qParams.film_type = 'Phim cách nhiệt';
  }
  try {
    const res = await fetch('/api/vehicle-norms' + buildQuery(qParams));
    const data = await res.json();
    const norms = (data.items || data.norms || []);
    const nTotal = data.total != null ? data.total : norms.length;
    
    let html;
    if (!isPpf) {
    html = `
      <div class="cust-filter-bar">
        <div class="cust-filter-grid">
          <div class="dyc-field dyc-field-span2"><label>Tìm kiếm</label>
            <input id="flt-n-q" placeholder="Tìm theo mã định mức, dòng xe, năm model..." value="${_esc(fn.q)}" autocomplete="off" /></div>
          <div class="dyc-field"><label>Loại phim</label>
            <select id="flt-n-film">
              <option value=""${fn.film_type === '' ? ' selected' : ''}>Tất cả</option>
              <option value="Phim cách nhiệt"${fn.film_type === 'Phim cách nhiệt' ? ' selected' : ''}>Phim cách nhiệt</option>
              <option value="PPF"${fn.film_type === 'PPF' || fn.film_type === 'Phim PPF' ? ' selected' : ''}>Phim PPF</option>
            </select></div>
          <div class="dyc-field"><label>Dòng xe</label>
            <input id="flt-n-model" list="dyc-model-datalist" placeholder="Chọn hoặc nhập dòng xe" value="${_esc(fn.vehicle_model_code)}" autocomplete="off" /></div>
          <div class="dyc-field"><label>Năm model</label>
            <select id="flt-n-year">${_yearOptionsHtml(fn.model_year)}</select></div>
          <div class="dyc-field"><label>Trạng thái</label>
            <select id="flt-n-status">
              <option value=""${fn.status === '' ? ' selected' : ''}>Tất cả</option>
              <option value="ACTIVE"${fn.status === 'ACTIVE' ? ' selected' : ''}>ACTIVE</option>
              <option value="INACTIVE"${fn.status === 'INACTIVE' ? ' selected' : ''}>INACTIVE</option>
            </select></div>
          <div class="dyc-field"><label>Có kính lái</label>
            <select id="flt-n-ws">
              <option value=""${fn.has_windshield === '' ? ' selected' : ''}>Tất cả</option>
              <option value="true"${fn.has_windshield === 'true' ? ' selected' : ''}>Có</option>
              <option value="false"${fn.has_windshield === 'false' ? ' selected' : ''}>Không</option>
            </select></div>
          <div class="dyc-field"><label>Có kính trời</label>
            <select id="flt-n-sun">
              <option value=""${fn.has_sunroof === '' ? ' selected' : ''}>Tất cả</option>
              <option value="true"${fn.has_sunroof === 'true' ? ' selected' : ''}>Có</option>
              <option value="false"${fn.has_sunroof === 'false' ? ' selected' : ''}>Không</option>
            </select></div>
          <div class="dyc-field"><label>Sườn sau + tam giác</label>
            <select id="flt-n-sst">
              <option value=""${fn.has_rear_side_triangle === '' ? ' selected' : ''}>Tất cả</option>
              <option value="true"${fn.has_rear_side_triangle === 'true' ? ' selected' : ''}>Có</option>
              <option value="false"${fn.has_rear_side_triangle === 'false' ? ' selected' : ''}>Không</option>
            </select></div>
        </div>
        <div class="cust-filter-actions">
          <button type="button" class="btn btn-outline btn-sm" data-flt-act="norms-refresh">Làm mới</button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-norm-add" data-flt-act="norms-add">Thêm định mức</button>
        </div>
        <div class="cust-filter-meta">Tổng số định mức sau lọc: <strong id="flt-n-total">${nTotal}</strong></div>
        <div class="filter-chips-row" id="flt-n-chips"></div>
      </div>
      ${norms.length === 0 ? '<div class="empty-state cust-empty"><p>Chưa có định mức phù hợp với dòng xe đã chọn.</p></div>' : `
      <div class="table-wrap table-norms-excel-wrap"><table class="data-table table-norms-excel"><thead><tr>
        <th>Mã định mức</th>
        <th>Loại phim</th>
        <th>Dòng xe</th>
        <th>Năm model</th>
        <th>Kính lái</th>
        <th>Kính hậu</th>
        <th>Sườn trước</th>
        <th>Sườn sau + TG</th>
        <th>Kính trời</th>
        <th>Sườn sau</th>
        <th>Tam giác</th>
        <th>TT</th>
        <th></th>
      </tr></thead><tbody>
      ${norms.map(n => `<tr>
        <td><strong>${_esc(n.norm_id)}</strong></td>
        <td>${_esc(n.film_type)}</td>
        <td>${_esc(n.vehicle_model_code)}</td>
        <td>${_esc(n.model_year_range || 'ALL')}</td>
        <td>${_normSizeDisplay(n, 'windshield_size', 'windshield_width_cm', 'windshield_length_cm')}</td>
        <td>${_normSizeDisplay(n, 'rear_window_size', 'rear_window_width_cm', 'rear_window_length_cm')}</td>
        <td>${_normSizeDisplay(n, 'front_side_size', 'front_side_width_cm', 'front_side_length_cm')}</td>
        <td>${_normSizeDisplay(n, 'rear_side_triangle_size', 'rear_side_triangle_width_cm', 'rear_side_triangle_length_cm')}</td>
        <td>${_normSizeDisplay(n, 'sunroof_size', 'sunroof_width_cm', 'sunroof_length_cm')}</td>
        <td>${_normSizeDisplay(n, 'rear_side_size', 'rear_side_width_cm', 'rear_side_length_cm')}</td>
        <td>${_normSizeDisplay(n, 'triangle_size', 'triangle_width_cm', 'triangle_length_cm')}</td>
        <td>${_esc(n.status)}</td>
        <td style="white-space:nowrap">
          <button type="button" class="btn btn-outline btn-sm" onclick="moFormNorm('${n.norm_id}')">Sửa</button>
          ${n.status === 'ACTIVE'
            ? `<button type="button" class="btn btn-outline btn-sm" onclick="moToggleNorm('${n.norm_id}','deactivate')">Inactive</button>`
            : `<button type="button" class="btn btn-outline btn-sm" onclick="moToggleNorm('${n.norm_id}','activate')">Active</button>`}
        </td>
      </tr>`).join('')}
      </tbody></table></div>`}
    `;
    } else {
      html = `
      <div class="cust-filter-bar">
        <div class="cust-filter-grid">
          <div class="dyc-field dyc-field-span2"><label>Tìm kiếm</label>
            <input id="flt-n-q" placeholder="Mã định mức, dòng xe, năm model..." value="${_esc(fn.q)}" autocomplete="off" /></div>
          <div class="dyc-field"><label>Loại phim</label>
            <select id="flt-n-film" disabled style="opacity:0.92"><option value="PPF" selected>PPF</option></select></div>
          <div class="dyc-field"><label>Dòng xe</label>
            <input id="flt-n-model" list="dyc-model-datalist" placeholder="ALL hoặc mã dòng xe" value="${_esc(fn.vehicle_model_code)}" autocomplete="off" /></div>
          <div class="dyc-field"><label>Năm model</label>
            <select id="flt-n-year">${_yearOptionsHtml(fn.model_year)}</select></div>
          <div class="dyc-field"><label>Trạng thái</label>
            <select id="flt-n-status">
              <option value=""${fn.status === '' ? ' selected' : ''}>Tất cả</option>
              <option value="ACTIVE"${fn.status === 'ACTIVE' ? ' selected' : ''}>ACTIVE</option>
              <option value="INACTIVE"${fn.status === 'INACTIVE' ? ' selected' : ''}>INACTIVE</option>
            </select></div>
        </div>
        <div class="cust-filter-actions">
          <button type="button" class="btn btn-outline btn-sm" data-flt-act="norms-refresh">Làm mới</button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-norm-add" data-flt-act="norms-add">Thêm định mức</button>
        </div>
        <div class="cust-filter-meta">Tổng định mức PPF sau lọc: <strong id="flt-n-total">${nTotal}</strong></div>
        <p class="cust-filter-meta" style="margin-top:6px;font-size:11px;line-height:1.45;color:var(--text-secondary)">Quy ước CSDL: <strong>BODY</strong> lưu tại trường kỹ thuật <strong>windshield_*</strong> (kích thước thân xe, ví dụ 1300×152). <strong>Kính lái</strong> PPF lưu tại <strong>front_side_*</strong> (122×165). <strong>Kính trời</strong> lưu tại <strong>sunroof_*</strong> (10×152). Trong form sửa, chọn loại phim PPF để nhập đúng ba ô này.</p>
        <div class="filter-chips-row" id="flt-n-chips"></div>
      </div>
      ${norms.length === 0 ? '<div class="empty-state cust-empty"><p>Chưa có định mức PPF.</p></div>' : `
      <div class="table-wrap"><table class="data-table table-norms-ppf"><thead><tr>
        <th>Mã định mức</th>
        <th>Loại phim</th>
        <th>Dòng xe</th>
        <th>Năm model</th>
        <th>BODY</th>
        <th>Kính lái</th>
        <th>Kính trời</th>
        <th>TT</th>
        <th></th>
      </tr></thead><tbody>
      ${norms.map(n => `<tr>
        <td><strong>${_esc(n.norm_id)}</strong></td>
        <td>${_esc(n.film_type)}</td>
        <td>${_esc(n.vehicle_model_code)}</td>
        <td>${_esc(n.model_year_range || 'ALL')}</td>
        <td>${_ppfBodyDisplay(n)}</td>
        <td>${_normSizeDisplay(n, 'front_side_size', 'front_side_width_cm', 'front_side_length_cm')}</td>
        <td>${_normSizeDisplay(n, 'sunroof_size', 'sunroof_width_cm', 'sunroof_length_cm')}</td>
        <td>${_esc(n.status)}</td>
        <td style="white-space:nowrap">
          <button type="button" class="btn btn-outline btn-sm" onclick="moFormNorm('${n.norm_id}')">Sửa</button>
          ${n.status === 'ACTIVE'
            ? `<button type="button" class="btn btn-outline btn-sm" onclick="moToggleNorm('${n.norm_id}','deactivate')">Inactive</button>`
            : `<button type="button" class="btn btn-outline btn-sm" onclick="moToggleNorm('${n.norm_id}','activate')">Active</button>`}
        </td>
      </tr>`).join('')}
      </tbody></table></div>`}
    `;
    }
    
    const activeId = document.activeElement?.id;
    let activeStart, activeEnd;
    if (activeId && document.activeElement.tagName === 'INPUT') {
      activeStart = document.activeElement.selectionStart;
      activeEnd = document.activeElement.selectionEnd;
    }
    
    document.getElementById('norms-container').innerHTML = html;
    
    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) {
        el.focus();
        if (activeStart !== undefined && el.setSelectionRange) {
          el.setSelectionRange(activeStart, activeEnd);
        }
      }
    }
    
    _normFilterChips(fn, (key) => {
      window._custF.norms[key] = '';
      taiDinhMucPhim();
    });

  } catch (err) {
    console.error(err);
    document.getElementById('norms-container').innerHTML = '<div class="alert error">Lỗi tải dữ liệu định mức phim</div>';
  }
};

function fillDefaultDateTimes() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const str = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`;
  const rd = document.getElementById('mc-req-date');
  const dd = document.getElementById('mc-deliv-date');
  if (rd && !rd.value) rd.value = str;
  if (dd && !dd.value) dd.value = str;
}
