/* ================================================================
   DYC Film Warehouse — App JS v3.1 — Thuần Việt + Form chỉnh sửa đầy đủ
   ================================================================ */
'use strict';

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
  'WORKSTREAM_EDIT_ALLOCATED_SOURCE_ID': 'Chỉnh sửa nguồn vật tư',
  'IMPORT_LOT': 'Nhập LOT',
  'IMPORT_OFFCUT_MANUAL': 'Nhập mảnh dư thủ công',
  'MANUAL_ISSUE_LOT': 'Xuất LOT thủ công',
  'MANUAL_ISSUE_OFFCUT': 'Xuất mảnh dư thủ công',
  'CLEAR_LOT': 'Clear LOT',
  'CLEAR_OFFCUT': 'Clear mảnh dư',
  'RELEASE_LOCK_MANUAL': 'Release lock thủ công',
  'LOT_IMPORTED': 'Nhập LOT (audit)',
  'OFFCUT_IMPORTED_MANUAL': 'Nhập mảnh dư (audit)',
  'LOT_MANUAL_ISSUED': 'Xuất LOT (audit)',
  'OFFCUT_MANUAL_ISSUED': 'Xuất mảnh dư (audit)',
  'LOT_CLEARED': 'Clear LOT (audit)',
  'OFFCUT_CLEARED': 'Clear mảnh dư (audit)',
  'SOFT_LOCK_RELEASED_MANUAL': 'Release lock (audit)',
  'REQUEST_MATERIAL_OVERRIDDEN': 'Đổi mã vật tư (Quản lý)',
  'OCR_DRAFT_CONFIRMED': 'Xác nhận phiếu OCR',
  'REQUEST_CREATED_FROM_IMAGE': 'Tạo đơn từ ảnh OCR',
  'CUSTOMER_CREATED_FROM_OCR': 'Tạo KH từ OCR',
  'VEHICLE_CREATED_FROM_OCR': 'Tạo xe từ OCR',
  'WORKSTREAM_CREATED': 'Tạo luồng thi công',
  'NORM_AUTO_FILLED': 'Tự điền định mức',
  'MATERIAL_PREFERENCE_APPLIED': 'Áp Material Preference',
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
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();
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
  const isPpf = wsType === 'PPF_INSTALLATION';
  const cls = isPpf ? 'ws-type-ppf' : 'ws-type-wf';
  const label = isPpf ? '🛡 Dán Phim PPF' : '🪟 Phim Cách Nhiệt';
  return `<span class="status-badge ${cls}">${label}</span>`;
}

/** Nhãn tiếng Việt cho job_item WF (material plan) */
function _wfJobLabelVi(ji) {
  const m = {
    WINDSHIELD: 'Kính lái',
    REAR_WINDOW: 'Kính hậu',
    FRONT_SIDE: 'Kính cửa trước',
    REAR_SIDE_TRIANGLE: 'Kính cửa sau + tam giác',
    SUNROOF: 'Cửa sổ trời',
    TRIANGLE: 'Tam giác',
    REAR_SIDE: 'Sườn sau',
    SIDE_QUARTER: 'Tam giác cố định',
  };
  return m[ji] || ji || '—';
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

/** HTML tổng hợp gộp khổ (roll_cut_summary) từ API wf_allocation */
function wfRollCutSummaryHtml(wfa) {
  if (!wfa || !wfa.roll_cut_summary) return '';
  const rc = wfa.roll_cut_summary;
  if (rc.lines_html) {
    return `<div style="margin-top:8px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.04);font-size:11px;line-height:1.55"><strong style="color:var(--text-secondary)">Gộp khổ (mét cuộn):</strong><br>${rc.lines_html}</div>`;
  }
  return '';
}

function fmtDt(isoStr) {
  if (!isoStr) return '—';
  try { return new Date(isoStr).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }); }
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
        <div class="notif-title"><i class="fa-solid ${typeIcons[n.notif_type] || 'fa-bell'}" style="margin-right:6px"></i>${n.title}</div>
        ${n.workstream_type ? `<div style="margin:3px 0">${loaiLuongBadge(n.workstream_type)}</div>` : ''}
        <div class="notif-body">${n.body}</div>
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
  await mcPreviewNorm();
}

function _mcIsoDelivery() {
  const d = document.getElementById('mc-deliv-date').value;
  const t = document.getElementById('mc-deliv-time').value || '17:30';
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
          <th>Loại KH</th><th>Tên khách hàng</th><th>MST</th><th>SĐT</th><th>Địa chỉ</th><th>Đường</th><th>Phường</th><th>TP</th><th>Full</th><th>AMIS</th><th>TT</th><th></th>
        </tr></thead><tbody>
        ${rows.map(d => `<tr>
          <td>${_esc(d.customer_category)}</td>
          <td><strong>${_esc(d.dealer_id)}</strong><br/>${_esc(d.customer_name || d.dealer_name)}</td>
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
        <div class="cust-subtabs" style="margin-bottom:10px">
          <button class="veh-sub btn btn-sm ${vehSub === 'list' ? 'btn-primary' : 'btn-outline'}" data-vehsub="list">Danh sách xe</button>
          <button class="veh-sub btn btn-sm ${vehSub === 'norms' ? 'btn-primary' : 'btn-outline'}" data-vehsub="norms">Định mức phim</button>
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
            <td><button type="button" class="btn btn-outline btn-sm" onclick="moDrawerVehicle('${v.vehicle_id}')">Xem</button>
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

window.moDrawerDealer = async function(id) {
  const ov = document.getElementById('modal-drawer-overlay');
  const h = await fetch(`/api/dealers/${encodeURIComponent(id)}/history`).then(r => r.json());
  document.getElementById('drawer-title').textContent = 'Đại lý — ' + id;
  document.getElementById('drawer-body').innerHTML = `<pre style="white-space:pre-wrap;font-size:12px">${JSON.stringify(h, null, 2)}</pre>`;
  ov.style.display = 'flex';
};
window.moDrawerCustomer = async function(id) {
  const ov = document.getElementById('modal-drawer-overlay');
  const h = await fetch(`/api/customers/${encodeURIComponent(id)}/history`).then(r => r.json());
  document.getElementById('drawer-title').textContent = 'Khách hàng — ' + id;
  document.getElementById('drawer-body').innerHTML = `<pre style="white-space:pre-wrap;font-size:12px">${JSON.stringify(h, null, 2)}</pre>`;
  ov.style.display = 'flex';
};
window.moDrawerVehicle = async function(id) {
  const ov = document.getElementById('modal-drawer-overlay');
  const h = await fetch(`/api/vehicles/${encodeURIComponent(id)}/history`).then(r => r.json());
  document.getElementById('drawer-title').textContent = 'Xe — ' + id;
  document.getElementById('drawer-body').innerHTML = `<pre style="white-space:pre-wrap;font-size:12px">${JSON.stringify(h, null, 2)}</pre>`;
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
  <div class="dyc-field"><label>Tên khách hàng / đại lý</label><input id="ed-d-name" value="${_esc(d.customer_name || d.dealer_name || '')}" /></div>
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
  <div class="dyc-field"><label>Mã AMIS</label><input id="ed-d-amis" value="${_esc(d.amis_customer_code || '')}" /></div>
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
  <div class="dyc-form-section">Kích thước kính (WxL, cm — như Excel)</div>
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Kính lái</label><input id="ed-n-ws" placeholder="VD: 90x152" value="90x152" /></div>
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
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Trạng thái</label><select id="ed-n-status"><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></div>
    <div class="dyc-field"><label>Ghi chú</label><input id="ed-n-note" placeholder="Tùy chọn" /></div>
  </div>
</div>`,
    { wide: true },
  );
  window._editNormId = normId;
  _mcQuickMode = isNew ? 'create-norm' : 'edit-norm';
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
        tax_code: document.getElementById('ed-d-tax').value.trim() || null,
        phone: document.getElementById('ed-d-phone').value.trim() || null,
        address_no: document.getElementById('ed-d-ano').value.trim() || null,
        street: document.getElementById('ed-d-st').value.trim() || null,
        ward: document.getElementById('ed-d-ward').value.trim() || null,
        city: document.getElementById('ed-d-city').value.trim() || null,
        full_address: document.getElementById('ed-d-full').value.trim() || null,
        amis_customer_code: document.getElementById('ed-d-amis').value.trim() || null,
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
      const body = {
        norm_id: document.getElementById('ed-n-id').value.trim() || undefined,
        film_type: document.getElementById('ed-n-ft').value.trim(),
        vehicle_model_code: document.getElementById('ed-n-vc').value.trim(),
        model_year_range: document.getElementById('ed-n-myr').value.trim(),
        windshield_size: document.getElementById('ed-n-ws').value.trim(),
        rear_window_size: document.getElementById('ed-n-rs').value.trim(),
        front_side_size: document.getElementById('ed-n-fs').value.trim(),
        rear_side_triangle_size: document.getElementById('ed-n-sst').value.trim(),
        sunroof_size: document.getElementById('ed-n-sun').value.trim(),
        rear_side_size: document.getElementById('ed-n-rside').value.trim(),
        triangle_size: document.getElementById('ed-n-tri').value.trim(),
        status: (document.getElementById('ed-n-status')?.value || 'ACTIVE').trim(),
        note: document.getElementById('ed-n-note')?.value.trim() || null,
        created_by: actor,
      };
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
      const body = {
        film_type: document.getElementById('ed-n-ft').value.trim(),
        vehicle_model_code: document.getElementById('ed-n-vc').value.trim(),
        model_year_range: document.getElementById('ed-n-myr').value.trim(),
        windshield_size: document.getElementById('ed-n-ws').value.trim(),
        rear_window_size: document.getElementById('ed-n-rs').value.trim(),
        front_side_size: document.getElementById('ed-n-fs').value.trim(),
        rear_side_triangle_size: document.getElementById('ed-n-sst').value.trim(),
        sunroof_size: document.getElementById('ed-n-sun').value.trim(),
        rear_side_size: document.getElementById('ed-n-rside').value.trim(),
        triangle_size: document.getElementById('ed-n-tri').value.trim(),
        status: (document.getElementById('ed-n-status')?.value || 'ACTIVE').trim(),
        note: document.getElementById('ed-n-note')?.value.trim() || null,
        reason,
        updated_by: actor,
      };
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
        delivery_date: document.getElementById('qc-veh-deliv').value || null,
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
  <div class="dyc-field"><label>Mã đại lý</label><input id="qc-dealer-id" value="${sug}" /></div>
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
  <div class="dyc-form-row-2">
    <div class="dyc-field"><label>Số VIN</label><input id="qc-veh-vin" /></div>
    <div class="dyc-field"><label>Ngày giao xe</label><input id="qc-veh-deliv" type="date" /></div>
  </div>
  <div class="dyc-field"><label>Ghi chú</label><input id="qc-veh-note" /></div>
</div>`,
    { wide: true },
  );
});

document.getElementById('mc-dealer-select')?.addEventListener('change', (e) => {
  const id = e.target.value;
  document.getElementById('mc-dealer-hint').textContent = id ? `Đã chọn: ${id}` : '';
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
};

window._mcWfDefaults = window._mcWfDefaults || {};

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
      ['RT40', 'JB20', 'RS20', 'T-TYPE', 'M-TYPE'].forEach((c) => opts.add(c));
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

async function mcPreviewNorm() {
  const box = document.getElementById('mc-norm-preview');
  if (!box) return;
  if (!document.getElementById('mc-svc-wf')?.checked) {
    box.innerHTML = '';
    await mcRebuildWfDetail();
    return;
  }
  const vmRaw = (document.getElementById('mc-veh-model')?.value || '').trim();
  const vm = (window.normalizeVehicleModelCode && window.normalizeVehicleModelCode(vmRaw)) || vmRaw;
  if (!vm) {
    box.innerHTML = '';
    await mcRebuildWfDetail();
    return;
  }
  const my = (document.getElementById('mc-model-year')?.value || '').trim();
  const ft = (document.getElementById('mc-film-type')?.value || 'Phim cách nhiệt').trim();
  let q = `vehicle_model_code=${encodeURIComponent(vm)}&film_type=${encodeURIComponent(ft)}`;
  if (my) q += `&model_year=${encodeURIComponent(my)}`;
  try {
    const res = await fetch(`/api/vehicle-norms/resolve?${q}`).then(r => r.json());
    if (res.found) {
      const rows = (res.auto_fill_items || []).map((i) => {
        const src = i.material_source ? ` <small class="muted">(${_esc(i.material_source)})</small>` : '';
        return `${_esc(i.job_item)} ${_esc(i.material_code || '—')} ${_esc(i.size || '')}${src}`;
      }).join('<br/>');
      box.innerHTML = `<strong>Định mức &amp; vật tư gợi ý</strong> (${_esc(res.norm_id || res.norm?.norm_id || '')})<br/>${rows}`;
    } else {
      box.innerHTML = '<span style="color:var(--orange)">Chưa có định mức ACTIVE. Cập nhật tại Khách hàng → Hồ sơ xe → Định mức phim.</span>';
    }
  } catch (err) {
    box.textContent = 'Không gọi được API resolve.';
    console.warn(err);
  }
  await mcRebuildWfDetail();
}
window.mcPreviewNorm = mcPreviewNorm;
['mc-veh-model', 'mc-model-year', 'mc-film-type', 'mc-svc-wf'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => mcPreviewNorm());
  document.getElementById(id)?.addEventListener('input', () => { clearTimeout(window._mcNormT); window._mcNormT = setTimeout(mcPreviewNorm, 400); });
});

document.getElementById('mc-btn-submit')?.addEventListener('click', async () => {
  const dealer = document.getElementById('mc-dealer-select').value;
  if (!dealer) { toast('warning', 'Thiếu đại lý', 'Chọn hoặc tạo đại lý nhanh'); return; }
  const vmRaw = document.getElementById('mc-veh-model').value.trim();
  const vm = (window.normalizeVehicleModelCode && window.normalizeVehicleModelCode(vmRaw)) || vmRaw;
  if (!vm) { toast('warning', 'Thiếu model', 'Nhập vehicle_model_code'); return; }
  const ppf = document.getElementById('mc-svc-ppf').checked;
  const wf = document.getElementById('mc-svc-wf').checked;
  if (!ppf && !wf) { toast('warning', 'Dịch vụ', 'Chọn ít nhất một dịch vụ'); return; }
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
    },
    model_year: (() => {
      const v = document.getElementById('mc-model-year')?.value;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : undefined;
    })(),
    film_type: document.getElementById('mc-film-type')?.value || undefined,
    continue_without_norm: document.getElementById('mc-continue-no-norm')?.checked || false,
    material_overrides: Object.keys(material_overrides).length ? material_overrides : undefined,
    material_override_reason: gReason || undefined,
    assigned_teams: {
      ppf_team: document.getElementById('mc-team-ppf').value,
      window_film_team: document.getElementById('mc-team-wf').value,
    },
    created_by: 'AD-001',
    note: noteMerged,
  };
  try {
    const r = await fetch('/api/requests/manual-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || JSON.stringify(data));
    toast('success', 'Đã tạo đơn', 'Đơn thủ công thành công');
    document.querySelector('[data-tab="requests"]').click();
    setTimeout(() => { window.chonDon(data.request_id); }, 300);
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
});

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
  monthly: taiBaoCaoThang,
  audit: taiNhatKy,
  hr: window.taiNhanSu,
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
            <button class="btn btn-green btn-sm" onclick="pheDuyetNhanhWs('${w.workstream_id}')">
              <i class="fa-solid fa-check"></i> Phê duyệt
            </button>
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
              <div style="font-size:10px;color:var(--text-secondary)">${w.request_id} | Đội: ${w.technician_team} | KTV: ${w.assigned_technician_name}</div>
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
  } catch(e) { toast('error', 'Lỗi tải tổng quan', e.message); }
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
window.chuyenDenDon = function(reqId) {
  document.querySelector('[data-tab="requests"]').click();
  setTimeout(() => chonDon(reqId), 200);
};

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

window.moPhieuOcr = async function(draftId) {
  currentOcrDraftId = draftId;
  document.getElementById('ocr-review-panel').style.display = 'block';
  document.getElementById('ocr-empty-state').style.display = 'none';
  const drafts = await fetch('/api/ocr-drafts').then(r => r.json());
  const d = drafts.find(x => x.ocr_draft_id === draftId);
  if (!d) return;
  const badge = document.getElementById('ocr-status-badge');
  badge.className = `status-badge status-${(d.review_status||'').toLowerCase()}`;
  badge.textContent = TRANG_THAI_VI[d.review_status] || d.review_status;
  const conf = Math.round((d.confidence_overall || 0) * 100);
  document.getElementById('confidence-fill').style.width = `${conf}%`;
  document.getElementById('confidence-pct').textContent = `${conf}%`;

  const services = d.extracted_services || 'PPF,WINDOW_FILM';
  const hasWF = services.includes('WINDOW_FILM');
  const hasPPF = services.includes('PPF');

  const fields = [
    { key: 'request_no',     label: 'Số phiếu/ Số đề nghị',    val: d.extracted_request_no || '', conf: 0.90 },
    { key: 'dealer_name',    label: 'Đại lý',                  val: d.extracted_dealer_name, conf: d.confidence_dealer },
    { key: 'customer_name',  label: 'Khách hàng',              val: d.extracted_customer_name, conf: d.confidence_customer },
    { key: 'vehicle_model',  label: 'Dòng xe',                 val: d.extracted_vehicle_model, conf: d.confidence_vehicle },
    { key: 'model_year',     label: 'Năm Model',               val: new Date().getFullYear(), conf: 0.90 },
    { key: 'vin',            label: 'Số VIN',                  val: d.extracted_vin, conf: 0.99 },
    { key: 'sales_consultant', label: 'Tư vấn bán hàng',       val: d.sales_consultant || '', conf: 0.90 },
    { key: 'sequence_no',    label: 'Số thứ tự',               val: '', conf: 0.90, type: 'number' },
    { key: 'request_date',   label: 'Ngày yêu cầu',            val: d.extracted_request_date || (d.created_at ? fmtDt(d.created_at) : new Date().toLocaleString('en-GB', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'}).replace(',', '')), conf: 0.90, placeholder: 'hh:mm dd/mm/yyyy' },
    { key: 'delivery_time',  label: 'Hạn giao xe',             val: d.extracted_delivery_time ? fmtDt(d.extracted_delivery_time) : '', conf: 0.88, placeholder: 'hh:mm dd/mm/yyyy' },
  ];

  if (hasWF && !hasPPF) {
      fields.push({ key: 'service_1', label: 'Dịch vụ 01', val: 'Phim cách nhiệt', conf: 0.97 });
      fields.push({ key: 'film_type_1', label: 'Loại phim yêu cầu', val: d.extracted_film_type || '', conf: 0.95 });
  } else if (hasPPF && !hasWF) {
      fields.push({ key: 'service_1', label: 'Dịch vụ 01', val: 'Phim PPF', conf: 0.97 });
      fields.push({ key: 'film_type_1', label: 'Loại phim yêu cầu', val: d.extracted_ppf_type || '', conf: 0.92 });
  } else {
      fields.push({ key: 'service_1', label: 'Dịch vụ 01', val: 'Phim cách nhiệt', conf: 0.97 });
      fields.push({ key: 'film_type_1', label: 'Loại phim yêu cầu', val: d.extracted_film_type || '', conf: 0.95 });
      fields.push({ key: 'service_2', label: 'Dịch vụ 02', val: 'Phim PPF', conf: 0.97 });
      fields.push({ key: 'film_type_2', label: 'Loại phim yêu cầu', val: d.extracted_ppf_type || '', conf: 0.92 });
  }

  // Inject hidden original services string for payload if needed, or we just calculate it in payload
  fields.push({ key: 'services', type: 'hidden', val: services, conf: 0.97 });

  const readonly = ['CONFIRMED','CANCELLED'].includes(d.review_status);
  document.getElementById('ocr-fields-form').innerHTML = fields.map(f => {
    if (f.type === 'hidden') return `<input type="hidden" id="ocrf-${f.key}" value="${f.val || ''}">`;
    const pct = Math.round((f.conf || 0) * 100);
    const dot = pct >= 90 ? 'conf-high' : pct >= 70 ? 'conf-mid' : 'conf-low';
    return `<div class="ocr-field-group">
      <label><span class="conf-dot ${dot}"></span> ${f.label} (độ chính xác: ${pct}%)</label>
      <input type="${f.type || 'text'}" id="ocrf-${f.key}" class="field-input" value="${f.val || ''}" placeholder="${f.placeholder || ''}" ${readonly ? 'readonly' : ''}>
    </div>`;
  }).join('');

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
  const isLexDraft = /^OCR-DRAFT-LEXUS-/.test(d.ocr_draft_id || '');
  if (d.ocr_status !== 'COMPLETED') { confirmBtn.disabled = true; confirmBtn.textContent = 'Chờ AI xử lý...'; }
  else if (readonly) {
    confirmBtn.disabled = true; cancelBtn.disabled = true;
    confirmBtn.textContent = d.review_status === 'CONFIRMED' ? `✅ Đã tạo đơn: ${d.created_request_id}` : '✅ Đã xử lý xong';
  } else {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = isLexDraft
      ? '<i class="fa-solid fa-check-circle"></i> Xác nhận tạo đơn'
      : '<i class="fa-solid fa-check-circle"></i> Xác nhận & Tạo đơn thi công';
    cancelBtn.disabled = false;
  }
  taiDanhSachOcr();
};

document.getElementById('btn-confirm-ocr').addEventListener('click', async () => {
  if (!currentOcrDraftId) return;
  const payload = {
    dealer_name: document.getElementById('ocrf-dealer_name')?.value,
    customer_name: document.getElementById('ocrf-customer_name')?.value,
    vehicle_model: document.getElementById('ocrf-vehicle_model')?.value,
    vin: document.getElementById('ocrf-vin')?.value,
    services: document.getElementById('ocrf-services')?.value,
    request_no: document.getElementById('ocrf-request_no')?.value,
    model_year: document.getElementById('ocrf-model_year')?.value,
    request_date: document.getElementById('ocrf-request_date')?.value,
    sales_consultant: document.getElementById('ocrf-sales_consultant')?.value,
    sequence_no: document.getElementById('ocrf-sequence_no')?.value,
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
      document.querySelector('[data-tab="requests"]')?.click();
      setTimeout(() => chonDon(data.request_id), 300);
    }
  } catch (e) {
    toast('error', 'Lỗi xác nhận phiếu', e.message);
  }
});
document.getElementById('btn-cancel-ocr').addEventListener('click', async () => {
  if (!currentOcrDraftId) return;
  await fetch(`/api/ocr/${currentOcrDraftId}/cancel`, { method: 'POST' });
  toast('warning', '🚫 Đã hủy phiếu', `Phiếu ${currentOcrDraftId} đã bị hủy.`);
  moPhieuOcr(currentOcrDraftId);
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
            <h4>${r.request_id} ${r.is_multi_workstream ? '<span style="color:var(--purple-light);font-size:10px"><i class="fa-solid fa-layer-group"></i> Đa luồng</span>' : ''}</h4>
            <p>${_esc(r.dealer_name || r.dealer_id || '—')} · ${_esc(_reqSvcModel(r))} · ${_esc(r.customer_name || '')}</p>
            ${['ALLOCATED','NEEDS_REVIEW'].includes(r.status) ? '<p class="muted" style="font-size:10px;margin:4px 0 0">Bước tiếp: Phê duyệt Quản lý</p>' : ''}
            <div class="req-badges">${trangThaiBadge(r.status)}</div>
          </div>`).join('');
    if (currentRequestId) {
      const sel = reqs.find((r) => r.request_id === currentRequestId);
      if (sel) await hienThiDon(sel);
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
    rno.textContent = req.request_no || '—';
    if (req.sequence_no) rno.textContent += ` (STT: ${req.sequence_no})`;
  }
  const cno = document.getElementById('det-contract-no');
  if (cno) cno.textContent = req.contract_no || '—';
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
        const src2 = i.material_source ? ` <small class="muted">(${_esc(i.material_source)})</small>` : '';
        return `${_esc(i.job_item)} ${_esc(i.material_code || '—')} ${_esc(i.size || '')}${src2}`;
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
          <table class="data-table" style="font-size:11px;margin-top:6px"><thead><tr><th>Hạng mục</th><th>Kích thước</th><th>Mã vật tư</th><th>Nguồn</th><th>Lý do</th></tr></thead><tbody>`;
        plan.forEach((p) => {
          const src = (p.material_source || '—').toString();
          if (src === 'MISSING_PREFERENCE') hasMiss = true;
          const rs = p.material_override_reason ? _esc(p.material_override_reason) : '—';
          html += `<tr><td>${_esc(p.job_item)}</td><td>${_esc(p.size || '—')}</td><td>${_esc(p.material_code || '—')}</td><td>${_esc(src)}</td><td>${rs}</td></tr>`;
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
        <br>Đội: ${ws.technician_team} | KTV: ${ws.assigned_technician_name || '—'} | Nguồn: ${ws.allocated_source_id || '—'}
        ${ppfAllocHtml}${wfAllocHtml}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${ws.status === 'PENDING_APPROVAL' ? (isPpf ? `
          <button class="btn btn-green btn-sm" onclick="pheDuyetWs('${ws.workstream_id}')"><i class="fa-solid fa-check"></i> Phê duyệt</button>
          <button class="btn btn-outline btn-sm" onclick="chiinhSuaWs('${ws.workstream_id}')"><i class="fa-solid fa-pen"></i> Chỉnh sửa trước duyệt</button>` : `
          <button class="btn btn-green btn-sm" onclick="moModalDuyetMaPhimWF('${ws.workstream_id}')"><i class="fa-solid fa-film"></i> Duyệt mã phim</button>
          <button class="btn btn-outline btn-sm" onclick="chiinhSuaWs('${ws.workstream_id}')"><i class="fa-solid fa-pen"></i> Sửa mã phim / kế hoạch</button>`) : ''}
        ${!isPpf && ws.status === 'PENDING_TECH_PREFLIGHT' ? `
          <button class="btn btn-outline btn-sm" onclick="chiinhSuaWs('${ws.workstream_id}')"><i class="fa-solid fa-warehouse"></i> Chỉnh phân bổ LOT</button>
          <button class="btn btn-green btn-sm" onclick="pheDuyetWs('${ws.workstream_id}')"><i class="fa-solid fa-check"></i> Chốt phân bổ</button>` : ''}
        ${ws.status === 'APPROVED' ? `<button class="btn btn-blue btn-sm" onclick="batDauWs('${ws.workstream_id}')"><i class="fa-solid fa-play"></i> KTV bắt đầu thi công</button>` : ''}
        ${ws.status === 'IN_PROGRESS' ? `<button class="btn btn-primary btn-sm" onclick="moFormXacNhan('${ws.workstream_id}')"><i class="fa-solid fa-flag-checkered"></i> Nhập thực tế & hoàn tất</button>` : ''}
        ${ws.status === 'CLOSED' ? '<span style="color:var(--teal-light);font-size:12px;font-weight:700"><i class="fa-solid fa-check-circle"></i> Đã hoàn tất & đóng</span>' : ''}
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
    const typeClass = isPpf ? 'ppf' : 'wf';
    const icon = isPpf ? 'fa-shield-film' : 'fa-window-restore';
    const tenLoai = isPpf ? 'Dán Phim PPF' : 'Dán Phim Cách Nhiệt';
    const matPlan = ws.material_plan ? (Array.isArray(ws.material_plan) ? ws.material_plan : JSON.parse(ws.material_plan || '[]')) : [];
    const progress = { 'PENDING_APPROVAL':0,'PENDING_TECH_PREFLIGHT':12,'APPROVED':30,'IN_PROGRESS':60,'ACTUAL_CONFIRMATION_REQUIRED':75,'COMPLETED':90,'CLOSED':100 }[ws.status] || 0;
    const tenPhim = { 'T-TYPE':'T-TYPE (Trong suốt)', 'M-TYPE':'M-TYPE (Mờ)', 'JB20':'JB20 (Cách nhiệt)', 'RT40':'RT40 (Kính lái)' };

    const ppfFilmLabel = isPpf ? tenPhim[ws.ppf_allocation?.ppf_type || ws.selected_material_code] || ws.ppf_allocation?.ppf_type || ws.selected_material_code || '—' : '';
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
    if (!isPpf && ws.wf_allocation) {
      const wfa = ws.wf_allocation;
      const sel = (wfa.items || []).filter((x) => x.is_selected);
      let nsrc = 0;
      let hasOff = false;
      for (const it of sel) {
        nsrc += (it.sources || []).filter((s) => (s.source_id || '').trim()).length;
        if ((it.sources || []).some((s) => (s.source_type || '').toUpperCase() === 'OFFCUT')) hasOff = true;
      }
      const splitBadge =
        nsrc > sel.length && sel.length
          ? ' <span style="padding:2px 7px;border-radius:6px;background:rgba(0,188,212,0.2);font-size:9px;font-weight:700">Chia nguồn</span>'
          : '';
      const offBadge = hasOff
        ? ' <span style="padding:2px 7px;border-radius:6px;background:rgba(156,39,176,0.25);font-size:9px;font-weight:700">Dùng mảnh dư</span>'
        : '';

      let tableHtml = `<table class="data-table" style="width:100%;font-size:12px;margin-bottom:12px">
        <thead>
          <tr style="text-align:left;background:rgba(255,255,255,0.05)">
            <th style="padding:8px">HẠNG MỤC</th>
            <th style="padding:8px">NGUỒN (LOT/MẢNH)</th>
            <th style="padding:8px">YÊU CẦU CẮT GỘP (M)</th>
            <th style="padding:8px">SỐ MÉT CẮT (M)</th>
            <th style="padding:8px">KẾT QUẢ</th>
          </tr>
        </thead>
        <tbody>`;

      const byLot = {};
      const blocks = wfa.roll_cut_summary ? (wfa.roll_cut_summary.blocks || []) : [];
      blocks.forEach((block) => {
        const reqM = parseFloat(block.roll_strip_m) || 0;
        let gotM = 0;
        let sourcesArr = [];

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

      let summaryHtml = '<div style="margin-bottom:10px;padding:10px;background:rgba(0,60,120,0.22);border-radius:8px;font-size:12px;line-height:1.45"><div style="font-weight:700;margin-bottom:6px">Tổng hợp cắt khổ (152cm) theo LOT</div>';
      const lotKeys = Object.keys(byLot).sort();
      if (lotKeys.length > 0) {
        lotKeys.forEach(sid => {
          summaryHtml += `<div style="margin-bottom:4px">LOT <strong>${_esc(sid)}</strong>: Tổng chiều dài cắt là <strong>${byLot[sid].toFixed(2)}m</strong> x 152cm</div>`;
        });
      } else {
        summaryHtml += `<div>Chưa có dữ liệu phân bổ theo LOT</div>`;
      }
      summaryHtml += '</div>';

      wfSourceBlock = `<div class="ws-info-row" style="display:block; width:100%;">
        <span class="ws-label" style="display:inline-block; margin-bottom:10px;"><i class="fa-solid fa-scale-balanced" style="color:var(--teal-light); margin-right:4px;"></i> Kiểm tra từng hạng mục ${splitBadge}${offBadge}</span>
        <div style="margin-top:6px">${tableHtml}${summaryHtml}</div>
      </div>`;
    }

    return `<div class="ws-card ${typeClass}">
      <div class="ws-card-header">
        <div class="ws-card-title"><i class="fa-solid ${icon} ws-type-icon"></i>${tenLoai}</div>
        ${trangThaiBadge(ws.status)}
      </div>
      <div class="ws-card-body">
        <div class="ws-progress-bar"><div class="ws-progress-fill" style="width:${progress}%"></div></div>

        <div class="ws-info-row"><span class="ws-label">Mã luồng</span><span class="ws-value" style="font-size:11px">${ws.workstream_id}</span></div>
        <div class="ws-info-row"><span class="ws-label">Đội thi công</span><span class="ws-value">${ws.technician_team}</span></div>
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
              <span class="job-name">${p.job_item === 'WINDSHIELD' ? 'Kính lái' : p.job_item === 'REAR_WINDOW' ? 'Kính hậu' : p.job_item === 'FRONT_SIDE' ? 'Kính cửa trước' : p.job_item === 'REAR_SIDE_TRIANGLE' ? 'Kính cửa sau' : p.job_item === 'SUNROOF' ? 'Cửa sổ trời' : p.job_item === 'TRIANGLE' ? 'Tam giác' : p.job_item === 'REAR_SIDE' ? 'Sườn sau' : p.job_item}</span>
              <span class="mat-code ${(p.material_code||'').toLowerCase()}">${p.material_code}</span>
              <small class="muted">${_esc(p.material_source || '')}</small>
            </div>`).join('')}
        </div>` : ''}

        ${isPpf ? ppfSourceBlock : wfSourceBlock}
        <div class="ws-info-row"><span class="ws-label">Mã lệnh thi công</span><span class="ws-value">${ws.job_card_id || 'Chưa tạo'}</span></div>
        <div class="ws-info-row"><span class="ws-label">Thời gian bắt đầu</span><span class="ws-value">${fmtDt(ws.started_at)}</span></div>
        <div class="ws-info-row"><span class="ws-label">Thời gian hoàn tất</span><span class="ws-value">${fmtDt(ws.completed_at)}</span></div>
        ${ws.created_offcut_id ? `<div class="ws-info-row"><span class="ws-label">Mảnh dư tạo ra</span><span class="ws-value" style="color:var(--green-light)">${ws.created_offcut_id}</span></div>` : ''}
      </div>
      <div class="ws-card-actions">
        ${ws.status === 'PENDING_APPROVAL' ? (isPpf ? `<button class="btn btn-green btn-sm" onclick="pheDuyetWs('${ws.workstream_id}')"><i class="fa-solid fa-check"></i> Phê duyệt</button>` : `<button class="btn btn-green btn-sm" onclick="moModalDuyetMaPhimWF('${ws.workstream_id}')"><i class="fa-solid fa-film"></i> Duyệt mã phim</button>`) : ''}
        ${!isPpf && ws.status === 'PENDING_TECH_PREFLIGHT' ? `
          <button class="btn btn-outline btn-sm" onclick="chiinhSuaWs('${ws.workstream_id}')"><i class="fa-solid fa-warehouse"></i> Chỉnh phân bổ LOT</button>
          <button class="btn btn-green btn-sm" onclick="pheDuyetWs('${ws.workstream_id}')"><i class="fa-solid fa-check"></i> Chốt phân bổ</button>` : ''}
        ${ws.status === 'APPROVED' ? `<button class="btn btn-blue btn-sm" onclick="batDauWs('${ws.workstream_id}')"><i class="fa-solid fa-play"></i> KTV bắt đầu</button>` : ''}
        ${ws.status === 'IN_PROGRESS' ? `<button class="btn btn-primary btn-sm" onclick="moFormXacNhan('${ws.workstream_id}')"><i class="fa-solid fa-ruler"></i> Nhập thực tế</button>` : ''}
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
  if (ws.workstream_type !== 'WINDOW_FILM_INSTALLATION') {
    toast('warning', 'Không áp dụng', 'Chỉ luồng phim cách nhiệt.');
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

let currentActualWsId = null;
window.moFormXacNhan = function(wsId) {
  currentActualWsId = wsId;
  const isPpf = wsId.includes('PPF');
  const mauIcon = isPpf ? 'var(--red)' : 'var(--blue-light)';
  const iconKy = isPpf ? 'fa-shield-film' : 'fa-window-restore';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'actual-modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="demo-modal" style="max-width:540px">
      <div class="demo-modal-header">
        <i class="fa-solid ${iconKy}" style="color:${mauIcon}"></i>
        <div>
          <h3>${isPpf ? 'Xác Nhận Thực Tế — Dán Phim PPF' : 'Xác Nhận Thực Tế — Dán Phim Cách Nhiệt'}</h3>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Nhập số liệu thực tế sau khi thi công để hệ thống trừ kho ảo</p>
        </div>
      </div>
      <div style="padding:16px 20px">
        <div style="background:rgba(255,143,0,0.07);border:1px solid rgba(255,143,0,0.2);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px">
          <i class="fa-solid fa-circle-info" style="color:var(--orange-light);margin-right:6px"></i>
          <strong style="color:var(--orange-light)">Lưu ý:</strong> Kích thước thực tế sẽ được dùng để tính toán lượng phim tiêu hao. Nếu có mảnh dư, vui lòng nhập để hệ thống ghi nhận vào kho mảnh dư.
        </div>
        <div class="form-grid">
          <div class="field-group">
            <label>Kích thước block thực tế</label>
            <input type="text" id="act-block" class="field-input" value="${isPpf ? '152x1300' : '152x143'}" placeholder="vd: 152x143">
            <small style="color:var(--text-muted);font-size:10px;margin-top:3px">Định dạng: rộng × dài (cm)</small>
          </div>
          <div class="field-group">
            <label>Chiều rộng thực tế (m)</label>
            <input type="number" id="act-width" class="field-input" value="${isPpf ? '1.52' : '1.52'}" step="0.01">
          </div>
          <div class="field-group">
            <label>Chiều dài thực tế (m)</label>
            <input type="number" id="act-len" class="field-input" value="${isPpf ? '13.0' : '1.43'}" step="0.01">
            <small style="color:var(--text-muted);font-size:10px;margin-top:3px">Chiều dài phim đã sử dụng</small>
          </div>
          <div class="field-group">
            <label>Diện tích phế liệu (m²)</label>
            <input type="number" id="act-scrap" class="field-input" value="0.35" step="0.01">
          </div>
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin:12px 0">
          <div style="font-size:12px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <i class="fa-solid fa-scissors" style="color:var(--orange-light)"></i>
            Mảnh dư (nếu có)
          </div>
          <div class="form-grid">
            <div class="field-group">
              <label>Chiều dài mảnh dư (m)</label>
              <input type="number" id="act-oc-len" class="field-input" value="0" step="0.01" placeholder="0 nếu không có">
            </div>
            <div class="field-group">
              <label>Chiều rộng mảnh dư (m)</label>
              <input type="number" id="act-oc-wid" class="field-input" value="0" step="0.01">
            </div>
            <div class="field-group">
              <label>Chất lượng mảnh dư</label>
              <select id="act-oc-qual" class="field-input">
                <option value="NORMAL">Bình thường</option>
                <option value="GOOD">Tốt</option>
                <option value="POOR">Kém</option>
              </select>
            </div>
            <div class="field-group">
              <label>Vị trí lưu mảnh dư</label>
              <input type="text" id="act-oc-loc" class="field-input" value="OFFCUT-RACK-C">
            </div>
          </div>
        </div>
        <div class="field-group">
          <label>Ghi chú của KTV</label>
          <input type="text" id="act-note" class="field-input" placeholder="Không có vấn đề gì / Ghi chú thêm...">
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
  const payload = {
    actual_cut_block: document.getElementById('act-block').value,
    actual_width_m: parseFloat(document.getElementById('act-width').value),
    actual_length_m: parseFloat(document.getElementById('act-len').value),
    has_new_offcut: parseFloat(document.getElementById('act-oc-len').value) > 0,
    offcut_length_m: parseFloat(document.getElementById('act-oc-len').value),
    offcut_width_m: parseFloat(document.getElementById('act-oc-wid').value),
    offcut_quality_status: document.getElementById('act-oc-qual').value,
    offcut_storage_location: document.getElementById('act-oc-loc').value,
    has_scrap: parseFloat(document.getElementById('act-scrap').value) > 0,
    scrap_area_m2: parseFloat(document.getElementById('act-scrap').value),
    technician_note: document.getElementById('act-note').value,
  };
  try {
    await fetch(`/api/workstreams/${wsId}/submit-actual`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const res = await fetch(`/api/workstreams/${wsId}/complete`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({})
    }).then(r => r.json());
    document.getElementById('actual-modal')?.remove();
    toast(res.status === 'success' ? 'success' : 'info',
      res.status === 'success' ? '✅ Luồng đã hoàn tất & đóng' : '⚠️ Cần thêm thao tác', res.detail);
    await taiDonThiCong(); taiThongBao(); taiTongQuan();
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
    ws.status === 'PENDING_TECH_PREFLIGHT' &&
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
    actor: 'QL-002',
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
  if (typeof _wsEditDirty !== 'undefined' && _wsEditDirty && typeof _wsEditModePpf !== 'undefined' && _wsEditModePpf) {
    if (!confirm('Bạn có thay đổi chưa lưu. Đóng cửa sổ?')) return;
  }
  _wsEditDirty = false;
  _wsEditModePpf = false;
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
async function taiBangLuong() {
  const wss = await fetch('/api/workstreams').then(r => r.json());
  const filterType = document.getElementById('ws-filter-type')?.value || '';
  const filterStatus = document.getElementById('ws-filter-status')?.value || '';
  const loc = wss.filter(w => (!filterType || w.workstream_type === filterType) && (!filterStatus || w.status === filterStatus));
  const tbody = document.getElementById('table-ws-body');
  if (!tbody) return;
  tbody.innerHTML = loc.length === 0
    ? '<tr><td colspan="11" class="text-center muted" style="padding:20px">Không có luồng thi công nào.</td></tr>'
    : loc.map(w => `<tr>
        <td><strong style="font-size:11px">${w.workstream_id}</strong></td>
        <td><a href="#" onclick="xemNhanhDonThiCong('${w.request_id}', '${w.workstream_id}'); return false;" style="color:var(--primary);font-weight:600">${w.request_id}</a></td>
        <td>${loaiLuongBadge(w.workstream_type)}</td>
        <td>${w.technician_team || '—'}</td>
        <td><strong>${w.selected_material_code || '—'}</strong></td>
        <td>${trangThaiBadge(w.status)}</td>
        <td><small>${fmtDt(w.started_at)}</small></td>
        <td><small>${fmtDt(w.completed_at)}</small></td>
        <td style="white-space:nowrap">
          ${w.status === 'PENDING_APPROVAL' && w.workstream_type === 'WINDOW_FILM_INSTALLATION' ? `<button class="btn btn-green btn-sm" onclick="moModalDuyetMaPhimWF('${w.workstream_id}')">Duyệt mã phim</button>` : ''}
        </td>
        <td style="white-space:nowrap">
          ${w.status === 'PENDING_APPROVAL' && w.workstream_type !== 'WINDOW_FILM_INSTALLATION' ? `<button class="btn btn-green btn-sm" onclick="pheDuyetNhanhWs('${w.workstream_id}')">Duyệt</button>` : ''}
          ${w.status === 'PENDING_TECH_PREFLIGHT' && w.workstream_type === 'WINDOW_FILM_INSTALLATION' ? `<button class="btn btn-outline btn-sm" onclick="chiinhSuaWs('${w.workstream_id}')">LOT</button><button class="btn btn-green btn-sm" style="margin-left:4px" onclick="pheDuyetNhanhWs('${w.workstream_id}')">Chốt</button>` : ''}
          ${w.status === 'APPROVED' ? `<button class="btn btn-blue btn-sm" onclick="batDauWs('${w.workstream_id}')">Bắt đầu</button>` : ''}
          ${w.status === 'IN_PROGRESS' ? `<button class="btn btn-primary btn-sm" onclick="moFormXacNhan('${w.workstream_id}')">Hoàn tất</button>` : ''}
          <button class="btn btn-outline btn-sm" style="margin-left:4px" onclick="chiinhSuaWs('${w.workstream_id}')"><i class="fa-solid fa-pen"></i></button>
        </td>
      </tr>`).join('');
}

['ws-filter-type','ws-filter-status'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', taiBangLuong);
});

async function xemNhanhDonThiCong(requestId, workstreamId) {
  try {
    const req = await fetch('/api/requests/' + requestId).then(r => r.json());
    if(req.error) {
      alert('Không tìm thấy đơn');
      return;
    }
    const ws = await fetch('/api/workstreams/' + workstreamId).then(r => r.json()).catch(() => ({}));
    
    const techId = ws.technician_id || req.technician_id || '—';

    document.getElementById('quick-req-id').textContent = req.request_id || '';
    document.getElementById('quick-req-status').innerHTML = trangThaiBadge(req.status);
    document.getElementById('quick-req-dealer').textContent = req.dealer_name || req.dealer_id || '—';
    document.getElementById('quick-req-customer').textContent = req.customer_name || '—';
    document.getElementById('quick-req-phone').textContent = req.customer_id || '—';
    document.getElementById('quick-req-model').textContent = req.model_name || req.vehicle_model_code || '—';
    document.getElementById('quick-req-deadline').textContent = req.requested_delivery_time ? fmtDt(req.requested_delivery_time) : '—';
    document.getElementById('quick-req-vin').textContent = req.vin_number ? req.vin_number.slice(-6) : (req.vin_masked || '—');
    document.getElementById('quick-req-team').textContent = ws.technician_team || '—';
    document.getElementById('quick-req-services').textContent = req.job_items || '—';
    
    document.getElementById('quick-req-manager').textContent = ws.approved_by || '—';
    document.getElementById('quick-req-manager-time').textContent = ws.approved_at ? fmtDt(ws.approved_at) : '—';
    document.getElementById('quick-req-tech').textContent = ws.assigned_technician_name || techId;
    document.getElementById('quick-req-tech-phone').textContent = '—';
    document.getElementById('quick-req-tech-time').textContent = ws.completed_at ? fmtDt(ws.completed_at) : '—';
    
    document.getElementById('quick-req-source').textContent = req.source_channel || '—';
    document.getElementById('quick-req-ticket').textContent = req.request_no || '—';
    document.getElementById('quick-req-contract').textContent = req.contract_no || '—';
    document.getElementById('quick-req-date').textContent = req.request_date || '—';
    document.getElementById('quick-req-ocr-img').innerHTML = req.ocr_source_image ? `<a href="/${req.ocr_source_image}" target="_blank" style="color:var(--primary)">Xem ảnh</a>` : '—';
    document.getElementById('quick-req-ids').textContent = (req.customer_id || '') + ' / ' + (req.vehicle_id || '');
    document.getElementById('quick-req-address').textContent = '—'; // no address field currently
    document.getElementById('quick-req-sales').textContent = req.sales_consultant || '—';
    
    document.getElementById('quick-req-modal').style.display = 'flex';
  } catch(e) {
    console.error(e);
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// LỆNH THI CÔNG (JOB CARDS)
// ═══════════════════════════════════════════════════════════════════════════════
let currentJobId = null;

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
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
        ${j.workstream_type ? loaiLuongBadge(j.workstream_type) : ''}
        ${trangThaiBadge(j.status)}
      </div>
    </div>`;
  }).join('');
  if (currentJobId) { const sel = jobs.find(j => j.job_card_id === currentJobId); if (sel) hienThiLenh(sel); }
}

window.chonLenh = async function(jcId) {
  currentJobId = jcId;
  await taiLenhThiCong();
};

function hienThiLenh(jc) {
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
  else if (jc.is_on_time === false) otBadge.innerHTML = `<span class="status-badge status-exception">⚠️ Trễ ${jc.delay_minutes} phút</span>`;
  else otBadge.innerHTML = '';

  const tlMap = { 'PENDING':0,'IN_PROGRESS':1,'ACTUAL_CONFIRMATION_REQUIRED':2,'COMPLETED_BY_TECHNICIAN':3 };
  const curTl = tlMap[jc.status] ?? 0;
  ['tl-pending','tl-inprogress','tl-confirmation','tl-done'].forEach((id, i) => {
    const el = document.getElementById(id); if (!el) return;
    el.className = 'tl-step'; if (i < curTl) el.classList.add('done'); else if (i === curTl) el.classList.add('active');
  });
  document.querySelectorAll('.tl-line').forEach((l, i) => { l.className = 'tl-line' + (i < curTl ? ' done' : ''); });

  const isPpf = jc.workstream_type === 'PPF_INSTALLATION';
  document.getElementById('jc-info-grid').innerHTML = `
    <div class="ji-row"><span>KTV phụ trách</span><strong>${jc.technician_name} (${jc.technician_id})</strong></div>
    <div class="ji-row"><span>Đội thi công</span><strong>${jc.technician_team || '—'}</strong></div>
    <div class="ji-row"><span>Loại thi công</span><strong>${isPpf ? '🛡 Dán Phim PPF' : jc.workstream_type ? '🪟 Phim Cách Nhiệt' : '—'}</strong></div>
    <div class="ji-row"><span>Loại phim</span><strong>${jc.material_code || '—'}</strong></div>
    <div class="ji-row"><span>Kích thước block</span><strong>${jc.planned_cut_block || '—'}</strong></div>
    <div class="ji-row"><span>Nguồn vật tư</span><strong>${jc.allocated_source_id || '—'}</strong></div>
    <div class="ji-row"><span>Hạn giao xe</span><strong class="highlight-red">${fmtDt(jc.requested_delivery_time)}</strong></div>
    <div class="ji-row"><span>Bắt đầu lúc</span><strong>${fmtDt(jc.started_at)}</strong></div>
    <div class="ji-row"><span>Hoàn tất lúc</span><strong>${fmtDt(jc.completed_at)}</strong></div>
    <div class="ji-row"><span>Xác nhận thực tế</span><strong>${TRANG_THAI_VI[jc.actual_confirmation_status] || jc.actual_confirmation_status}</strong></div>`;

  const wsDetail = document.getElementById('jc-ws-detail');
  if (isPpf) {
    wsDetail.innerHTML = `<div class="ws-job-detail ppf-job">
      <div style="font-size:12px;font-weight:700;color:var(--red-light);margin-bottom:8px"><i class="fa-solid fa-shield-film"></i> Dán Phim PPF — ${jc.material_code || 'T-TYPE'}</div>
      <div class="form-grid" style="gap:6px">
        <div style="font-size:11px;color:var(--text-secondary)">Block kế hoạch:<br><strong style="color:var(--text-primary)">${jc.planned_cut_block || '152x1300'}</strong></div>
        <div style="font-size:11px;color:var(--text-secondary)">Chiều dài khấu:<br><strong style="color:var(--text-primary)">${jc.planned_deduction_length_m || 13.0} m</strong></div>
      </div>
    </div>`;
  } else if (jc.workstream_type === 'WINDOW_FILM_INSTALLATION') {
    wsDetail.innerHTML = `<div class="ws-job-detail wf-job">
      <div style="font-size:12px;font-weight:700;color:var(--blue-light);margin-bottom:8px"><i class="fa-solid fa-window-restore"></i> Dán Phim Cách Nhiệt</div>
      <div class="wf-material-plan">
        <div class="wf-plan-row"><span class="job-name">Kính chắn gió trước (Kính lái)</span><span class="mat-code rt40">RT40</span></div>
        <div class="wf-plan-row"><span class="job-name">Kính hậu</span><span class="mat-code jb20">JB20</span></div>
        <div class="wf-plan-row"><span class="job-name">Kính cửa trước (2 cánh)</span><span class="mat-code jb20">JB20</span></div>
        <div class="wf-plan-row"><span class="job-name">Kính cửa sau + tam giác</span><span class="mat-code jb20">JB20</span></div>
        <div class="wf-plan-row"><span class="job-name">Cửa sổ trời</span><span class="mat-code jb20">JB20</span></div>
      </div>
    </div>`;
  } else { wsDetail.innerHTML = ''; }

  const az = document.getElementById('jc-action-zone');
  az.innerHTML = '';
  if (jc.status === 'PENDING') {
    az.innerHTML = `<div class="hitl-alert"><i class="fa-solid fa-clock"></i><div><strong>Chờ kỹ thuật viên nhận lệnh</strong><p>Nhấn khi thực sự bắt đầu thi công xe. Hệ thống sẽ ghi nhận giờ bắt đầu.</p></div></div>
      <button class="btn btn-primary btn-full" onclick="batDauLenh('${jc.job_card_id}')"><i class="fa-solid fa-play"></i> Bắt đầu thi công ${isPpf ? 'PPF' : 'Cách Nhiệt'}</button>`;
  } else if (jc.status === 'IN_PROGRESS') {
    az.innerHTML = `<div class="hitl-alert tech"><i class="fa-solid fa-wrench"></i><div><strong>Đang thi công — ${isPpf ? 'Đội PPF' : 'Đội Cách Nhiệt'}</strong><p>Đã bắt đầu lúc ${fmtDt(jc.started_at)}. Nhấn hoàn tất sau khi thi công xong.</p></div></div>
      <button class="btn btn-green btn-full" onclick="yeuCauHoanTatLenh('${jc.job_card_id}')"><i class="fa-solid fa-flag-checkered"></i> Đã thi công xong — Yêu cầu xác nhận</button>
      ${jc.workstream_id ? `<button class="btn btn-primary btn-full" style="margin-top:8px" onclick="moFormXacNhan('${jc.workstream_id}')"><i class="fa-solid fa-ruler"></i> Nhập kích thước thực tế & Hoàn tất</button>` : ''}`;
  } else if (jc.status === 'ACTUAL_CONFIRMATION_REQUIRED') {
    az.innerHTML = `<div class="exception-box"><i class="fa-solid fa-clipboard-list"></i><h3>Cần xác nhận kích thước thực tế</h3>
      <p>KTV phải nhập số liệu thực tế trước khi hệ thống trừ kho ảo và đóng lệnh.</p>
      ${jc.workstream_id ? `<button class="btn btn-primary" style="margin-top:8px" onclick="moFormXacNhan('${jc.workstream_id}')"><i class="fa-solid fa-ruler"></i> Nhập kích thước thực tế</button>` : ''}
    </div>`;
  } else if (jc.status === 'COMPLETED_BY_TECHNICIAN') {
    az.innerHTML = `<div class="success-box"><div class="success-icon"><i class="fa-solid fa-circle-check"></i></div>
      <h3>Lệnh Thi Công Đã Hoàn Tất!</h3>
      <p>Kho ảo đã được cập nhật.<br>Bắt đầu: ${fmtDt(jc.started_at)}<br>Hoàn tất: ${fmtDt(jc.completed_at)}</p>
    </div>`;
  }
}

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
        <td>${_esc(p.job_item)}</td>
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

window.openMatPrefModal = function (preferenceId) {
  const isEdit = !!preferenceId;
  openInvModal(
    isEdit ? `Sửa cấu hình ${preferenceId}` : 'Thêm vật tư ưu tiên',
    `<div class="form-grid">
      <div class="field-group"><label>preference_id</label><input id="mpf-pid" class="field-input" value="${_esc(preferenceId || '')}" ${isEdit ? 'readonly' : ''} placeholder="MATPREF-…" /></div>
      <div class="field-group"><label>film_type <span class="req">*</span></label><input id="mpf-ft" class="field-input" placeholder="Phim cách nhiệt hoặc PPF" /></div>
      <div class="field-group"><label>job_item <span class="req">*</span></label><input id="mpf-ji" class="field-input" placeholder="WINDSHIELD" /></div>
      <div class="field-group"><label>preferred_material_code <span class="req">*</span></label><input id="mpf-mc" class="field-input" /></div>
      <div class="field-group"><label>material_name</label><input id="mpf-mn" class="field-input" /></div>
      <div class="field-group"><label>priority</label><input type="number" id="mpf-pr" class="field-input" value="1" min="1" /></div>
      <div class="field-group"><label>effective_from</label><input id="mpf-ef" class="field-input" /></div>
      <div class="field-group"><label>effective_to</label><input id="mpf-et" class="field-input" /></div>
      <div class="field-group full-width"><label>note</label><input id="mpf-note" class="field-input" /></div>
      <div class="field-group full-width"><label>reason (bắt buộc khi sửa) <span class="req">*</span></label><input id="mpf-reason" class="field-input" placeholder="Audit" /></div>
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
        document.getElementById('mpf-mc').value = p.preferred_material_code || '';
        document.getElementById('mpf-mn').value = p.material_name || '';
        document.getElementById('mpf-pr').value = String(p.priority || 1);
        document.getElementById('mpf-ef').value = p.effective_from || '';
        document.getElementById('mpf-et').value = p.effective_to || '';
        document.getElementById('mpf-note').value = p.note || '';
      })
      .catch(() => {});
  }
};

window.submitMatPref = async function (isEdit) {
  const pid = (document.getElementById('mpf-pid')?.value || '').trim();
  const reason = (document.getElementById('mpf-reason')?.value || '').trim();
  if (isEdit && !reason) {
    toast('warning', 'Thiếu lý do', 'reason bắt buộc khi sửa');
    return;
  }
  const body = {
    film_type: document.getElementById('mpf-ft').value.trim(),
    job_item: document.getElementById('mpf-ji').value.trim(),
    preferred_material_code: document.getElementById('mpf-mc').value.trim(),
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
  if (qq) q.set('q', qq);
  if (st) q.set('lot_status', st);
  const rows = await fetch('/api/inventory/lots?' + q.toString()).then(r => r.json());
  const eff = (l) => l.lot_status || (l.is_locked ? 'LOCKED' : (l.remaining_length_m <= 0 ? 'DEPLETED' : (l.is_opened ? 'IN_USE' : 'NEW')));
  document.getElementById('inv-table-lots').innerHTML = rows.length ? rows.map(l => {
    const e = eff(l);
    return `<tr>
      <td><strong>${l.lot_id}</strong></td>
      <td>${l.material_code}</td>
      <td><strong>${l.remaining_length_m}</strong> / ${l.original_length_m ?? '—'}</td>
      <td>${lotStatusChip(e)}</td>
      <td>${l.is_locked ? '<span class="locked-badge"><i class="fa-solid fa-lock" style="margin-right:4px;"></i>Khóa</span>' : '—'}</td>
      <td><small>${l.storage_location || '—'}</small></td>
      <td><small>Admin</small></td>
      <td><small>${l.import_date || '—'}</small></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="openManualIssueLotModal('${l.lot_id}')">Xuất</button>
        <button class="btn btn-danger btn-sm" onclick="openClearLotModal('${l.lot_id}')">Clear</button>
        ${l.is_locked ? `<button class="btn btn-outline btn-sm" onclick="openReleaseLockModal('LOT','${l.lot_id}')"><i class="fa-solid fa-unlock"></i> Mở khóa</button>` : ''}
      </td></tr>`;
  }).join('') : '<tr><td colspan="9" class="text-center muted">Không có LOT.</td></tr>';
}

window.resetInvLots = function() {
  const qEl = document.getElementById('inv-lot-q');
  const stEl = document.getElementById('inv-lot-status');
  if (qEl) qEl.value = '';
  if (stEl) stEl.value = 'IN_USE';
  loadLots();
};


async function loadOffcuts() {
  const q = new URLSearchParams();
  const qq = document.getElementById('inv-oc-q')?.value?.trim();
  if (qq) q.set('q', qq);
  const rows = await fetch('/api/inventory/offcuts?' + q.toString()).then(r => r.json());
  const eff = (o) => {
    if ((o.area_m2 || 0) <= 0 || (o.length_m || 0) <= 0 || (o.width_m || 0) <= 0) return 'CLEARED';
    return o.offcut_status || o.status || 'AVAILABLE';
  };
  document.getElementById('inv-table-offcuts').innerHTML = rows.length ? rows.map(o => {
    const e = eff(o);
    const q = o.quality_status || '—';
    return `<tr>
      <td><strong>${o.offcut_id}</strong></td>
      <td>${o.material_code}</td>
      <td>${o.width_m}×${o.length_m} m</td>
      <td>${o.area_m2}</td>
      <td><span class="status-badge status-new" style="font-size:10px">${q}</span></td>
      <td>${lotStatusChip(e)}</td>
      <td>${o.is_locked ? '<span class="locked-badge"><i class="fa-solid fa-lock" style="margin-right:4px;"></i>Khóa</span>' : '—'}</td>
      <td><small>${o.storage_location || '—'}</small></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="openManualIssueOffcutModal('${o.offcut_id}')">Xuất</button>
        <button class="btn btn-danger btn-sm" onclick="openClearOffcutModal('${o.offcut_id}')">Clear</button>
        ${o.is_locked ? `<button class="btn btn-outline btn-sm" onclick="openReleaseLockModal('OFFCUT','${o.offcut_id}')"><i class="fa-solid fa-unlock"></i> Mở khóa</button>` : ''}
      </td></tr>`;
  }).join('') : '<tr><td colspan="9" class="text-center muted">Không có mảnh dư.</td></tr>';
}

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

async function renderLockedItems() {
  const [lots, ocs] = await Promise.all([
    fetch('/api/inventory/lots?is_locked=true').then(r => r.json()),
    fetch('/api/inventory/offcuts?is_locked=true').then(r => r.json()),
  ]);
  const parts = [];
  if (lots.length) parts.push(`<h4 class="inv-locked-h">LOT</h4><ul class="inv-locked-ul">${lots.map(l => `<li><strong>${l.lot_id}</strong> — ${l.material_code} — còn ${l.remaining_length_m}m
    <button class="btn btn-outline btn-sm" style="margin-left:8px" onclick="openReleaseLockModal('LOT','${l.lot_id}')">Mở khóa</button></li>`).join('')}</ul>`);
  if (ocs.length) parts.push(`<h4 class="inv-locked-h">Mảnh dư</h4><ul class="inv-locked-ul">${ocs.map(o => `<li><strong>${o.offcut_id}</strong> — ${o.material_code}
    <button class="btn btn-outline btn-sm" style="margin-left:8px" onclick="openReleaseLockModal('OFFCUT','${o.offcut_id}')">Mở khóa</button></li>`).join('')}</ul>`);
  document.getElementById('inv-locked-list').innerHTML = parts.length ? parts.join('') : '<p class="muted pad-20">Không có bản ghi đang khóa.</p>';
}

function closeInvModal() { document.getElementById('inv-modal-overlay')?.remove(); }

function openInvModal(title, innerHtml, footerHtml) {
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

window.openImportOffcutModal = function() {
  openInvModal('Nhập mảnh dư thủ công', `
    <p class="muted" style="font-size:12px;margin-bottom:10px">Nếu không có parent_lot_id thì <strong>created_reason</strong> bắt buộc.</p>
    <div class="form-grid">
      <div class="field-group"><label>offcut_id <span class="req">*</span></label><input id="ioc-id" class="field-input"></div>
      <div class="field-group"><label>parent_lot_id</label><input id="ioc-pl" class="field-input" placeholder="LOT-JB20-001"></div>
      <div class="field-group"><label>material_code <span class="req">*</span></label><input id="ioc-mc" class="field-input" value="JB20"></div>
      <div class="field-group"><label>width_m / length_m <span class="req">*</span></label>
        <input type="number" id="ioc-w" class="field-input" value="1.52" step="0.01" style="width:48%">
        <input type="number" id="ioc-l" class="field-input" value="1.2" step="0.01" style="width:48%"></div>
      <div class="field-group"><label>quality_status <span class="req">*</span></label>
        <select id="ioc-qs" class="field-input"><option>GOOD</option><option>NORMAL</option><option>POOR</option></select></div>
      <div class="field-group"><label>storage_location <span class="req">*</span></label><input id="ioc-sl" class="field-input" value="OFFCUT-RACK-C"></div>
      <div class="field-group full-width"><label>created_reason (khi không có parent)</label><input id="ioc-cr" class="field-input"></div>
      <div class="field-group"><label>performed_by</label><input id="ioc-by" class="field-input" value="AD-001"></div>
      <div class="field-group full-width"><label>note</label><input id="ioc-note" class="field-input"></div>
    </div>`, `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Hủy</button>
    <button type="button" class="btn btn-primary" onclick="submitImportOffcut()">Lưu</button>`);
};

window.submitImportOffcut = async function() {
  const parent_lot_id = document.getElementById('ioc-pl').value.trim();
  const created_reason = document.getElementById('ioc-cr').value.trim();
  if (!parent_lot_id && !created_reason) { toast('warning', 'Thiếu lý do', 'Nhập parent_lot_id hoặc created_reason.'); return; }
  const payload = {
    offcut_id: document.getElementById('ioc-id').value.trim(),
    parent_lot_id: parent_lot_id || null,
    material_code: document.getElementById('ioc-mc').value.trim(),
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

window.openManualIssueLotModal = function(lotId) {
  openInvModal('Xuất LOT thủ công — ' + lotId, `
    <div class="form-grid">
      <div class="field-group"><label>Chiều dài xuất (m) <span class="req">*</span></label><input type="number" id="mil-len" class="field-input" step="0.01" min="0.01"></div>
      <div class="field-group full-width"><label>Lý do <span class="req">*</span></label><input id="mil-reason" class="field-input"></div>
      <div class="field-group"><label>Thực hiện bởi</label><input id="mil-by" class="field-input" value="QL-002"></div>
      <div class="field-group"><label>Admin xác nhận</label><select id="mil-ov" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
      <div class="field-group full-width"><label>Ghi chú</label><input id="mil-note" class="field-input"></div>
    </div>`, `<button type="button" class="btn btn-outline" onclick="closeInvModal()">Hủy</button>
    <button type="button" class="btn btn-primary" onclick="submitManualIssueLot('${lotId}')">Xuất kho</button>`);
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
      <div class="field-group"><label>Thực hiện bởi</label><input id="mio-by" class="field-input" value="QL-002"></div>
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
      <div class="field-group"><label>Thực hiện bởi</label><input id="cl-by" class="field-input" value="QL-002"></div>
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
      <div class="field-group"><label>Thực hiện bởi</label><input id="co-by" class="field-input" value="QL-002"></div>
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
  openInvModal('Mở khóa Soft Lock', `
    <div class="form-grid">
      <div class="field-group"><label>Loại nguồn</label>
        <select id="rl-st" class="field-input"><option value="LOT" ${_rlType==='LOT'?'selected':''}>LOT</option><option value="OFFCUT" ${_rlType==='OFFCUT'?'selected':''}>OFFCUT</option></select></div>
      <div class="field-group"><label>Mã nguồn <span class="req">*</span></label><input id="rl-sid" class="field-input" value="${_rlId}"></div>
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
  const allLots = await fetch('/api/lots').then(r => r.json());
  
  const matEl = document.getElementById('kl-mat');
  const stEl = document.getElementById('kl-status');
  const filterMat = (matEl ? matEl.value : '').toLowerCase().trim();
  const filterSt = stEl ? stEl.value : '';

  allLots.forEach(l => {
    let eff = l.status || 'ACTIVE';
    if (l.remaining_length_m <= 0 && eff === 'ACTIVE') {
      eff = 'DEPLETED';
    }
    l._eff_status = eff;
  });

  const lots = allLots.filter(l => {
    if (filterMat && !(l.material_code || '').toLowerCase().includes(filterMat)) return false;
    if (filterSt === 'ACTIVE') {
      if (l._eff_status !== 'ACTIVE') return false;
    } else if (filterSt === 'DEPLETED') {
      if (l._eff_status === 'ACTIVE') return false;
    }
    return true;
  });

  document.getElementById('table-lots-body').innerHTML = lots.length === 0
    ? '<tr><td colspan="10" class="text-center muted" style="padding:20px">Không có cuộn LOT nào.</td></tr>'
    : lots.map(l => `<tr>
        <td><strong>${l.lot_id}</strong></td>
        <td>${l.material_code}</td>
        <td>${l.original_width_m} m</td>
        <td>${l.original_length_m} m</td>
        <td><strong style="color:${l.remaining_length_m < 2 ? 'var(--red-light)' : 'var(--green-light)'}">${l.remaining_length_m} m</strong></td>
        <td>${l.is_opened ? '<span style="color:var(--orange-light)">Đang dùng</span>' : '<span style="color:var(--green-light)">Nguyên</span>'}</td>
        <td>${l.is_locked ? '<span style="color:var(--red-light)"><i class="fa-solid fa-lock"></i> Đang khóa</span>' : '<span style="color:var(--text-muted)">Khả dụng</span>'}</td>
        <td><small>Admin</small></td>
        <td>${l.import_date}</td>
        <td>${trangThaiBadge(l._eff_status)}</td>
      </tr>`).join('');
}

window.resetKhoLot = function() {
  const matEl = document.getElementById('kl-mat');
  const stEl = document.getElementById('kl-status');
  if (matEl) matEl.value = '';
  if (stEl) stEl.value = '';
  taiKhoLot();
};

async function taiManhDu() {
  let offcuts = await fetch('/api/offcuts').then(r => r.json());
  
  const statusEl = document.getElementById('oc-status');
  const filterStatus = statusEl ? statusEl.value : '';

  offcuts.forEach(o => {
    let eff = (o.offcut_status || o.status || 'AVAILABLE').toUpperCase();
    if (eff === 'ACTIVE') eff = 'AVAILABLE';
    if ((o.area_m2 <= 0 || o.area_m2 === "0.0") && (eff === 'AVAILABLE' || eff === 'ACTIVE')) {
      eff = 'USED';
    }
    o._eff_status = eff;
  });

  if (filterStatus === '') {
    // Mặc định: Đang hoạt động (AVAILABLE, IN_USE, NEW...)
    offcuts = offcuts.filter(o => o._eff_status === 'AVAILABLE' || o._eff_status === 'ACTIVE' || o._eff_status === 'PARTIALLY_USED');
  } else if (filterStatus !== 'ALL') {
    offcuts = offcuts.filter(o => o._eff_status === filterStatus);
  }

  const tbody = document.getElementById('table-offcuts-body');
  if (offcuts.length === 0) { tbody.innerHTML = '<tr><td colspan="11" class="text-center muted" style="padding:20px">Không có mảnh dư nào.</td></tr>'; return; }
  tbody.innerHTML = offcuts.map(o => `<tr>
    <td><strong>${o.offcut_id}</strong></td>
    <td>${o.parent_lot_id || '—'}</td>
    <td>${o.material_code}</td>
    <td>${o.width_m} m</td>
    <td>${o.length_m} m</td>
    <td>${o.area_m2} m²</td>
    <td>${o.is_locked ? '<span style="color:var(--red-light)"><i class="fa-solid fa-lock" style="margin-right:4px;"></i>Khóa</span>' : '<span style="color:var(--text-muted)">—</span>'}</td>
    <td>${o.storage_location || '—'}</td>
    <td>Admin</td>
    <td>${o.import_date || '—'}</td>
    <td>${trangThaiBadge(o._eff_status)}</td>
  </tr>`).join('');
}

window.resetFilterOffcuts = function() {
  const qEl = document.getElementById('oc-q');
  const stEl = document.getElementById('oc-status');
  if (qEl) qEl.value = '';
  if (stEl) stEl.value = '';
  taiManhDu();
};

// ═══════════════════════════════════════════════════════════════════════════════
// BÁO CÁO THÁNG
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
      return `<tr>
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

    const chartDefs = { responsive: true, plugins: { legend: { labels: { color: '#8b92a5', font: { family: 'Inter', size: 11 } } } }, scales: { x: { ticks: { color: '#8b92a5' }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#8b92a5' }, grid: { color: 'rgba(255,255,255,0.06)' } } } };
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
  document.getElementById('tab-manual')?.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t && t.classList && t.classList.contains('mc-wf-item')) mcPreviewNorm();
    if (t && (t.id === 'mc-svc-wf' || t.id === 'mc-svc-ppf')) mcPreviewNorm();
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
  taiTongQuan();
  taiThongBao();
  setInterval(taiThongBao, 30000);
  document.getElementById('tab-norms')?.addEventListener('click', (ev) => {
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
});



async function taiDinhMucPhim() {
  ensureCustFilters();
  _ensureModelDatalist();
  await refreshModelDatalistFromApi();
  const fn = window._custF.norms;
  try {
    const res = await fetch('/api/vehicle-norms' + buildQuery({ ...fn, with_meta: '1' }));
    const data = await res.json();
    const norms = (data.items || data.norms || []);
    const nTotal = data.total || norms.length;
    
    let html = `
      <div class="cust-filter-bar">
        <div class="cust-filter-grid">
          <div class="dyc-field dyc-field-span2"><label>Tìm kiếm</label>
            <input id="flt-n-q" placeholder="Tìm theo mã định mức, dòng xe, năm model..." value="${_esc(fn.q)}" autocomplete="off" /></div>
          <div class="dyc-field"><label>Loại phim</label>
            <select id="flt-n-film">
              <option value=""${fn.film_type === '' ? ' selected' : ''}>Tất cả</option>
              <option value="Phim cách nhiệt"${fn.film_type === 'Phim cách nhiệt' ? ' selected' : ''}>Phim cách nhiệt</option>
              <option value="Phim PPF"${fn.film_type === 'Phim PPF' ? ' selected' : ''}>Phim PPF</option>
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
