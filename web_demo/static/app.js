/* ================================================================
   DYC Film Warehouse — App JS v3.1 — Thuần Việt + Form chỉnh sửa đầy đủ
   ================================================================ */
'use strict';

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
  'PENDING_APPROVAL': 'Chờ phê duyệt',
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

// ─── ĐIỀU HƯỚNG ──────────────────────────────────────────────────────────────
const tabLoaders = {
  dashboard: taiTongQuan,
  ocr: taiDanhSachOcr,
  requests: taiDonThiCong,
  workstreams: taiBangLuong,
  jobcards: taiLenhThiCong,
  lots: taiKhoLot,
  inventory: taiQuanLyKho,
  offcuts: taiManhDu,
  monthly: taiBaoCaoThang,
  audit: taiNhatKy,
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
    const [dash, wss, notifs] = await Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/workstreams').then(r => r.json()),
      fetch('/api/notifications').then(r => r.json()),
    ]);

    document.getElementById('stat-lots').textContent = dash.total_lots;
    document.getElementById('stat-offcuts').textContent = dash.active_offcuts;
    document.getElementById('stat-ppf-done').textContent = dash.ppf_completed || 0;
    document.getElementById('stat-wf-done').textContent = dash.wf_completed || 0;
    document.getElementById('stat-approval-ws').textContent = dash.pending_approval_workstreams || 0;
    document.getElementById('stat-closed').textContent = dash.closed_requests || 0;

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
    const data = await fetch(`/api/workstreams/${wsId}/approve`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({})
    }).then(r => r.json());
    toast('success', '✅ Phê duyệt thành công', data.detail);
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

  const fields = [
    { key: 'dealer_name',    label: 'Đại lý',                  val: d.extracted_dealer_name, conf: d.confidence_dealer },
    { key: 'customer_name',  label: 'Khách hàng',               val: d.extracted_customer_name, conf: d.confidence_customer },
    { key: 'vehicle_model',  label: 'Dòng xe',                  val: d.extracted_vehicle_model, conf: d.confidence_vehicle },
    { key: 'vin',            label: 'Số VIN',                   val: d.extracted_vin, conf: 0.99 },
    { key: 'film_type',      label: 'Loại phim yêu cầu',        val: d.extracted_film_type, conf: 0.95 },
    { key: 'ppf_type',       label: 'Loại PPF (T-TYPE/M-TYPE)', val: d.extracted_ppf_type || 'T-TYPE', conf: 0.92 },
    { key: 'services',       label: 'Dịch vụ',                  val: d.extracted_services || 'PPF,WINDOW_FILM', conf: 0.97 },
    { key: 'delivery_time',  label: 'Hạn giao xe',              val: d.extracted_delivery_time ? fmtDt(d.extracted_delivery_time) : '', conf: 0.88 },
  ];
  const readonly = ['CONFIRMED','CANCELLED'].includes(d.review_status);
  document.getElementById('ocr-fields-form').innerHTML = fields.map(f => {
    const pct = Math.round((f.conf || 0) * 100);
    const dot = pct >= 90 ? 'conf-high' : pct >= 70 ? 'conf-mid' : 'conf-low';
    return `<div class="ocr-field-group">
      <label><span class="conf-dot ${dot}"></span> ${f.label} (độ chính xác: ${pct}%)</label>
      <input type="text" id="ocrf-${f.key}" class="field-input" value="${f.val || ''}" ${readonly ? 'readonly' : ''}>
    </div>`;
  }).join('');

  const services = d.extracted_services || 'PPF,WINDOW_FILM';
  const svcBox = document.getElementById('ocr-services-box');
  if (services.includes('PPF') && services.includes('WINDOW_FILM')) {
    document.getElementById('ocr-services-text').textContent = 'Phiếu yêu cầu cả PPF + Phim cách nhiệt. Hệ thống sẽ tự động tạo 2 luồng thi công: Đội PPF và Đội Cách Nhiệt.';
    svcBox.style.display = 'block';
  } else { svcBox.style.display = 'none'; }

  const confirmBtn = document.getElementById('btn-confirm-ocr');
  const cancelBtn = document.getElementById('btn-cancel-ocr');
  if (d.ocr_status !== 'COMPLETED') { confirmBtn.disabled = true; confirmBtn.textContent = 'Chờ AI xử lý...'; }
  else if (readonly) {
    confirmBtn.disabled = true; cancelBtn.disabled = true;
    confirmBtn.textContent = d.review_status === 'CONFIRMED' ? `✅ Đã tạo đơn: ${d.created_request_id}` : '✅ Đã xử lý xong';
  } else { confirmBtn.disabled = false; confirmBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Xác nhận & Tạo đơn thi công'; cancelBtn.disabled = false; }
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
  };
  try {
    const data = await fetch(`/api/ocr/${currentOcrDraftId}/confirm`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    }).then(r => r.json());
    toast('success', '✅ Tạo đơn thành công', data.detail);
    moPhieuOcr(currentOcrDraftId); taiThongBao(); taiTongQuan();
  } catch(e) { toast('error', 'Lỗi xác nhận phiếu', e.message); }
});
document.getElementById('btn-cancel-ocr').addEventListener('click', async () => {
  if (!currentOcrDraftId) return;
  await fetch(`/api/ocr/${currentOcrDraftId}/cancel`, { method: 'POST' });
  toast('warning', '🚫 Đã hủy phiếu', `Phiếu ${currentOcrDraftId} đã bị hủy.`);
  moPhieuOcr(currentOcrDraftId);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ĐƠN THI CÔNG E2E
// ═══════════════════════════════════════════════════════════════════════════════
let currentRequestId = null;

async function taiDonThiCong() {
  try {
    const reqs = await fetch('/api/requests').then(r => r.json());
    document.getElementById('req-list-count').textContent = reqs.length;
    document.getElementById('demo-req-list').innerHTML = reqs.length === 0
      ? '<p class="text-center muted pad-20" style="font-size:12px">Không có đơn thi công nào.</p>'
      : reqs.map(r => `
          <div class="req-item ${r.request_id === currentRequestId ? 'active' : ''}" onclick="chonDon('${r.request_id}')">
            <h4>${r.request_id} ${r.is_multi_workstream ? '<span style="color:var(--purple-light);font-size:10px"><i class="fa-solid fa-layer-group"></i> Đa luồng</span>' : ''}</h4>
            <p>${r.vehicle_model_code} | ${r.customer_name}</p>
            <div class="req-badges">${trangThaiBadge(r.status)}</div>
          </div>`).join('');
    if (currentRequestId) {
      const sel = reqs.find(r => r.request_id === currentRequestId);
      if (sel) hienThiDon(sel);
    }
  } catch(e) { toast('error', 'Lỗi tải đơn thi công', e.message); }
}

window.chonDon = function(reqId) {
  currentRequestId = reqId;
  taiDonThiCong();
};

async function hienThiDon(req) {
  document.getElementById('no-req-selected').style.display = 'none';
  document.getElementById('req-demo-board').style.display = 'block';
  document.getElementById('board-req-title').textContent = req.request_id;
  const stEl = document.getElementById('board-req-status');
  stEl.className = `status-badge status-${(req.status||'').toLowerCase().replace(/_/g,'-')}`;
  stEl.textContent = TRANG_THAI_VI[req.status] || req.status;
  document.getElementById('board-multi-ws-badge').style.display = req.is_multi_workstream ? 'inline-block' : 'none';
  document.getElementById('det-dealer').textContent = req.dealer_id;
  document.getElementById('det-customer').textContent = req.customer_name;
  document.getElementById('det-model').textContent = req.vehicle_model_code;
  document.getElementById('det-vin').textContent = req.vin_number;
  document.getElementById('det-deadline').textContent = fmtDt(req.requested_delivery_time);
  const cgBox = document.getElementById('cutting-group-box');
  if (req.is_grouped_cut) {
    cgBox.style.display = 'flex';
    document.getElementById('det-cg-id').textContent = req.cut_group_id;
    document.getElementById('det-cg-block').textContent = req.planned_cut_block;
    document.getElementById('det-cg-len').textContent = `${req.planned_deduction_length_m} m`;
  } else { cgBox.style.display = 'none'; }

  // Tiến trình
  const steps = ['DRAFT','STANDARDIZED','NORM_ASSIGNED','ALLOCATED','APPROVED','IN_PROGRESS','CLOSED'];
  const specialMap = { 'PARTIALLY_COMPLETED':'IN_PROGRESS','WAITING_INVENTORY_COMMIT':'IN_PROGRESS','EXCEPTION_HOLD':'ALLOCATED' };
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
  } else if (req.status === 'ALLOCATED') {
    if (req.is_multi_workstream) {
      document.getElementById('hitl-ws-zone').style.display = 'block';
      await hienThiThePheDuyet(req.request_id);
    } else {
      document.getElementById('hitl-1-zone').style.display = 'block';
      document.getElementById('prop-source').textContent = `${req.allocated_source_type}: ${req.allocated_source_id}`;
      document.getElementById('prop-len').textContent = `${req.planned_deduction_length_m} m`;
    }
  } else if (req.status === 'APPROVED') {
    if (req.is_multi_workstream) { document.getElementById('hitl-ws-zone').style.display = 'block'; await hienThiThePheDuyet(req.request_id); }
    else { document.getElementById('hitl-2-zone').style.display = 'block'; document.getElementById('input-actual-block').value = req.planned_cut_block || ''; document.getElementById('input-actual-len').value = req.planned_deduction_length_m || ''; }
  } else if (req.status === 'IN_PROGRESS') {
    if (req.is_multi_workstream) { document.getElementById('hitl-ws-zone').style.display = 'block'; await hienThiThePheDuyet(req.request_id); }
    else { document.getElementById('hitl-2-zone').style.display = 'block'; }
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

  if (req.is_multi_workstream) {
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
    return `<div style="border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-bottom:10px;background:var(--bg-card)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <strong style="color:${mauChinh};font-size:13px"><i class="fa-solid ${icon}" style="margin-right:6px"></i>${tenDoi}</strong>
        ${trangThaiBadge(ws.status)}
      </div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px">
        ${isPpf ? `Loại phim PPF: <strong style="color:${mauChinh}">${ws.selected_material_code || 'T-TYPE'}</strong> | Kích thước: ${ws.planned_cut_block || '152x1300'}` :
          `Nhóm cắt: ${ws.cut_group_id || '—'} | Kích thước: ${ws.planned_cut_block || '152x143'}`}
        <br>Đội: ${ws.technician_team} | KTV: ${ws.assigned_technician_name || '—'} | Nguồn: ${ws.allocated_source_id || '—'}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${ws.status === 'PENDING_APPROVAL' ? `
          <button class="btn btn-green btn-sm" onclick="pheDuyetWs('${ws.workstream_id}')"><i class="fa-solid fa-check"></i> Phê duyệt</button>
          <button class="btn btn-outline btn-sm" onclick="chiinhSuaWs('${ws.workstream_id}')"><i class="fa-solid fa-pen"></i> Chỉnh sửa trước duyệt</button>` : ''}
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
  else if (statuses.every(s => s === 'PENDING_APPROVAL')) overall = 'PENDING_APPROVAL';
  const wsOverall = document.getElementById('ws-overall-status');
  if (wsOverall) { wsOverall.className = `status-badge status-${overall.toLowerCase().replace(/_/g,'-')}`; wsOverall.textContent = TRANG_THAI_VI[overall] || overall; }

  container.innerHTML = wss.map(ws => {
    const isPpf = ws.workstream_type === 'PPF_INSTALLATION';
    const typeClass = isPpf ? 'ppf' : 'wf';
    const icon = isPpf ? 'fa-shield-film' : 'fa-window-restore';
    const tenLoai = isPpf ? 'Dán Phim PPF' : 'Dán Phim Cách Nhiệt';
    const matPlan = ws.material_plan ? (Array.isArray(ws.material_plan) ? ws.material_plan : JSON.parse(ws.material_plan || '[]')) : [];
    const progress = { 'PENDING_APPROVAL':0,'APPROVED':30,'IN_PROGRESS':60,'ACTUAL_CONFIRMATION_REQUIRED':75,'COMPLETED':90,'CLOSED':100 }[ws.status] || 0;
    const tenPhim = { 'T-TYPE':'T-TYPE (Trong suốt)', 'M-TYPE':'M-TYPE (Mờ)', 'JB20':'JB20 (Cách nhiệt)', 'RT40':'RT40 (Kính lái)' };

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
        <div class="ws-info-row"><span class="ws-label">Loại phim</span>
          <span class="ws-value" style="color:${isPpf ? 'var(--red-light)' : 'var(--blue-light)'}">
            ${tenPhim[ws.selected_material_code] || ws.selected_material_code || '—'}
          </span>
        </div>
        <div class="ws-info-row"><span class="ws-label">Kích thước block</span><span class="ws-value">${ws.planned_cut_block || '—'}</span></div>
        <div class="ws-info-row"><span class="ws-label">Chiều dài khấu trừ</span><span class="ws-value">${ws.planned_deduction_length_m || '—'} m</span></div>

        ${!isPpf && matPlan.length > 0 ? `<div class="wf-material-plan">
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px">Kế hoạch vật tư từng kính:</div>
          ${matPlan.map(p => `
            <div class="wf-plan-row">
              <span class="job-name">${p.job_item === 'WINDSHIELD' ? 'Kính lái' : p.job_item === 'REAR_WINDOW' ? 'Kính hậu' : p.job_item === 'FRONT_SIDE' ? 'Kính cửa trước' : p.job_item === 'REAR_SIDE_TRIANGLE' ? 'Kính cửa sau' : p.job_item === 'SUNROOF' ? 'Cửa sổ trời' : p.job_item}</span>
              <span class="mat-code ${(p.material_code||'').toLowerCase()}">${p.material_code}</span>
            </div>`).join('')}
        </div>` : ''}

        <div class="ws-info-row"><span class="ws-label">Nguồn vật tư</span><span class="ws-value">${ws.allocated_source_type || '—'}: ${ws.allocated_source_id || '—'}</span></div>
        <div class="ws-info-row"><span class="ws-label">Mã lệnh thi công</span><span class="ws-value">${ws.job_card_id || 'Chưa tạo'}</span></div>
        <div class="ws-info-row"><span class="ws-label">Thời gian bắt đầu</span><span class="ws-value">${fmtDt(ws.started_at)}</span></div>
        <div class="ws-info-row"><span class="ws-label">Thời gian hoàn tất</span><span class="ws-value">${fmtDt(ws.completed_at)}</span></div>
        ${ws.created_offcut_id ? `<div class="ws-info-row"><span class="ws-label">Mảnh dư tạo ra</span><span class="ws-value" style="color:var(--green-light)">${ws.created_offcut_id}</span></div>` : ''}
      </div>
      <div class="ws-card-actions">
        ${ws.status === 'PENDING_APPROVAL' ? `<button class="btn btn-green btn-sm" onclick="pheDuyetWs('${ws.workstream_id}')"><i class="fa-solid fa-check"></i> Phê duyệt</button>` : ''}
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
window.pheDuyetWs = async function(wsId) {
  try {
    const data = await fetch(`/api/workstreams/${wsId}/approve`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({})
    }).then(r => r.json());
    toast('success', '✅ Phê duyệt thành công', data.detail);
    await taiDonThiCong(); taiThongBao(); taiTongQuan();
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

// ─── CHỈNH SỬA LUỒNG (FORM ĐẦY ĐỦ) ──────────────────────────────────────────
let currentWsEditId = null;

window.chiinhSuaWs = async function(wsId) {
  currentWsEditId = wsId;
  const ws = await fetch(`/api/workstreams/${wsId}`).then(r => r.json());
  const isPpf = ws.workstream_type === 'PPF_INSTALLATION';
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
        <td>${w.request_id}</td>
        <td>${loaiLuongBadge(w.workstream_type)}</td>
        <td>${w.technician_team || '—'}</td>
        <td><strong>${w.selected_material_code || '—'}</strong></td>
        <td>${w.planned_cut_block || '—'}</td>
        <td>${w.allocated_source_id || '—'}</td>
        <td>${trangThaiBadge(w.status)}</td>
        <td><small>${fmtDt(w.started_at)}</small></td>
        <td><small>${fmtDt(w.completed_at)}</small></td>
        <td style="white-space:nowrap">
          ${w.status === 'PENDING_APPROVAL' ? `<button class="btn btn-green btn-sm" onclick="pheDuyetNhanhWs('${w.workstream_id}')">Duyệt</button>` : ''}
          ${w.status === 'APPROVED' ? `<button class="btn btn-blue btn-sm" onclick="batDauWs('${w.workstream_id}')">Bắt đầu</button>` : ''}
          ${w.status === 'IN_PROGRESS' ? `<button class="btn btn-primary btn-sm" onclick="moFormXacNhan('${w.workstream_id}')">Hoàn tất</button>` : ''}
          <button class="btn btn-outline btn-sm" style="margin-left:4px" onclick="chiinhSuaWs('${w.workstream_id}')"><i class="fa-solid fa-pen"></i></button>
        </td>
      </tr>`).join('');
}

['ws-filter-type','ws-filter-status'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', taiBangLuong);
});

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

let _invSub = 'lots';
async function taiQuanLyKho() {
  await loadInventorySummary();
  document.querySelectorAll('#inv-subtabs .inv-subtab').forEach(b => {
    b.classList.toggle('active', b.dataset.invSub === _invSub);
  });
  ['inv-panel-lots','inv-panel-offcuts','inv-panel-tx','inv-panel-locked'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('inv-toolbar-lots').style.display = _invSub === 'lots' ? 'flex' : 'none';
  document.getElementById('inv-toolbar-offcuts').style.display = _invSub === 'offcuts' ? 'flex' : 'none';
  document.getElementById('inv-toolbar-tx').style.display = _invSub === 'tx' ? 'flex' : 'none';
  if (_invSub === 'lots') { document.getElementById('inv-panel-lots').style.display = 'block'; await loadLots(); }
  else if (_invSub === 'offcuts') { document.getElementById('inv-panel-offcuts').style.display = 'block'; await loadOffcuts(); }
  else if (_invSub === 'tx') { document.getElementById('inv-panel-tx').style.display = 'block'; await loadInventoryTransactions(); }
  else { document.getElementById('inv-panel-locked').style.display = 'block'; await renderLockedItems(); }
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
      <td>${l.is_locked ? '<span class="locked-badge"><i class="fa-solid fa-lock"></i> true</span>' : '—'}</td>
      <td><small>${l.storage_location || '—'}</small></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="openManualIssueLotModal('${l.lot_id}')">Xuất</button>
        <button class="btn btn-danger btn-sm" onclick="openClearLotModal('${l.lot_id}')">Clear</button>
        ${l.is_locked ? `<button class="btn btn-outline btn-sm" onclick="openReleaseLockModal('LOT','${l.lot_id}')"><i class="fa-solid fa-unlock"></i> Mở khóa</button>` : ''}
      </td></tr>`;
  }).join('') : '<tr><td colspan="7" class="text-center muted">Không có LOT.</td></tr>';
}

async function loadOffcuts() {
  const q = new URLSearchParams();
  const qq = document.getElementById('inv-oc-q')?.value?.trim();
  if (qq) q.set('q', qq);
  const rows = await fetch('/api/inventory/offcuts?' + q.toString()).then(r => r.json());
  const eff = (o) => o.offcut_status || o.status || 'AVAILABLE';
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
      <td>${o.is_locked ? '<span class="locked-badge"><i class="fa-solid fa-lock"></i> true</span>' : '—'}</td>
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
      <div class="field-group"><label>lot_id <span class="req">*</span></label><input id="im-lot-id" class="field-input" placeholder="LOT-JB20-004"></div>
      <div class="field-group"><label>material_code <span class="req">*</span></label><input id="im-mat" class="field-input" value="JB20"></div>
      <div class="field-group"><label>material_name</label><input id="im-mname" class="field-input"></div>
      <div class="field-group"><label>film_type</label><input id="im-ft" class="field-input" value="WINDOW_FILM"></div>
      <div class="field-group"><label>width_m <span class="req">*</span></label><input type="number" id="im-w" class="field-input" value="1.52" step="0.01"></div>
      <div class="field-group"><label>original_length_m <span class="req">*</span></label><input type="number" id="im-ol" class="field-input" value="30" step="0.01"></div>
      <div class="field-group"><label>remaining_length_m</label><input type="number" id="im-rl" class="field-input" step="0.01" placeholder="= original nếu để trống"></div>
      <div class="field-group"><label>storage_location <span class="req">*</span></label><input id="im-loc" class="field-input" value="A-RACK-05"></div>
      <div class="field-group"><label>supplier</label><input id="im-sup" class="field-input"></div>
      <div class="field-group"><label>invoice_no</label><input id="im-inv" class="field-input"></div>
      <div class="field-group"><label>performed_by</label><input id="im-by" class="field-input" value="AD-001"></div>
      <div class="field-group full-width"><label>note</label><input id="im-note" class="field-input"></div>
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
      <div class="field-group"><label>issue_length_m <span class="req">*</span></label><input type="number" id="mil-len" class="field-input" step="0.01" min="0.01"></div>
      <div class="field-group full-width"><label>reason <span class="req">*</span></label><input id="mil-reason" class="field-input"></div>
      <div class="field-group"><label>performed_by</label><input id="mil-by" class="field-input" value="QL-002"></div>
      <div class="field-group"><label>admin_override</label><select id="mil-ov" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
      <div class="field-group full-width"><label>note</label><input id="mil-note" class="field-input"></div>
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
      <div class="field-group"><label>issue_width_m</label><input type="number" id="mio-w" class="field-input" step="0.01"></div>
      <div class="field-group"><label>issue_length_m</label><input type="number" id="mio-l" class="field-input" step="0.01"></div>
      <div class="field-group full-width"><label>reason <span class="req">*</span></label><input id="mio-reason" class="field-input"></div>
      <div class="field-group"><label>performed_by</label><input id="mio-by" class="field-input" value="QL-002"></div>
      <div class="field-group"><label>admin_override</label><select id="mio-ov" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
      <div class="field-group"><label>clear_remaining_as_scrap</label><select id="mio-scrap" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
      <div class="field-group full-width"><label>note</label><input id="mio-note" class="field-input"></div>
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
      <div class="field-group full-width"><label>clear_mode</label>
        <select id="cl-mode" class="field-input">
          <option value="WRITE_OFF_TO_ZERO">WRITE_OFF_TO_ZERO → CLEARED</option>
          <option value="MARK_AS_SCRAPPED">MARK_AS_SCRAPPED → SCRAPPED</option>
          <option value="CLOSE_DEPLETED">CLOSE_DEPLETED → CLOSED</option>
          <option value="LOST_IN_STOCKTAKE">LOST_IN_STOCKTAKE → CLEARED</option>
        </select></div>
      <div class="field-group full-width"><label>reason <span class="req">*</span></label><input id="cl-reason" class="field-input"></div>
      <div class="field-group"><label>performed_by</label><input id="cl-by" class="field-input" value="QL-002"></div>
      <div class="field-group"><label>admin_override</label><select id="cl-ov" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
      <div class="field-group full-width"><label>note</label><input id="cl-note" class="field-input"></div>
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
      <div class="field-group full-width"><label>clear_mode</label>
        <select id="co-mode" class="field-input">
          <option value="QUALITY_FAILED">QUALITY_FAILED</option>
          <option value="WRITE_OFF_TO_ZERO">WRITE_OFF_TO_ZERO → CLEARED</option>
          <option value="MARK_AS_SCRAPPED">MARK_AS_SCRAPPED</option>
          <option value="LOST_IN_STOCKTAKE">LOST_IN_STOCKTAKE</option>
          <option value="TOO_SMALL_TO_USE">TOO_SMALL_TO_USE → SCRAPPED</option>
        </select></div>
      <div class="field-group full-width"><label>reason <span class="req">*</span></label><input id="co-reason" class="field-input"></div>
      <div class="field-group"><label>performed_by</label><input id="co-by" class="field-input" value="QL-002"></div>
      <div class="field-group"><label>admin_override</label><select id="co-ov" class="field-input"><option value="false">Không</option><option value="true">Có</option></select></div>
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
      <div class="field-group"><label>source_type</label>
        <select id="rl-st" class="field-input"><option value="LOT" ${_rlType==='LOT'?'selected':''}>LOT</option><option value="OFFCUT" ${_rlType==='OFFCUT'?'selected':''}>OFFCUT</option></select></div>
      <div class="field-group"><label>source_id <span class="req">*</span></label><input id="rl-sid" class="field-input" value="${_rlId}"></div>
      <div class="field-group full-width"><label>reason <span class="req">*</span></label><input id="rl-reason" class="field-input"></div>
      <div class="field-group"><label>performed_by</label><input id="rl-by" class="field-input" value="QL-002"></div>
      <div class="field-group"><label>related_request_id</label><input id="rl-rid" class="field-input" placeholder="REQ-..."></div>
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
  const lots = await fetch('/api/lots').then(r => r.json());
  document.getElementById('table-lots-body').innerHTML = lots.length === 0
    ? '<tr><td colspan="9" class="text-center muted" style="padding:20px">Không có cuộn LOT nào.</td></tr>'
    : lots.map(l => `<tr>
        <td><strong>${l.lot_id}</strong></td>
        <td>${l.material_code}</td>
        <td>${l.original_width_m} m</td>
        <td>${l.original_length_m} m</td>
        <td><strong style="color:${l.remaining_length_m < 2 ? 'var(--red-light)' : 'var(--green-light)'}">${l.remaining_length_m} m</strong></td>
        <td>${l.is_opened ? '<span style="color:var(--orange-light)">Đang dùng</span>' : '<span style="color:var(--green-light)">Nguyên</span>'}</td>
        <td>${l.is_locked ? '<span style="color:var(--red-light)"><i class="fa-solid fa-lock"></i> Đang khóa</span>' : '<span style="color:var(--text-muted)">Khả dụng</span>'}</td>
        <td>${l.import_date}</td>
        <td>${trangThaiBadge(l.status)}</td>
      </tr>`).join('');
}

async function taiManhDu() {
  const offcuts = await fetch('/api/offcuts').then(r => r.json());
  const tbody = document.getElementById('table-offcuts-body');
  if (offcuts.length === 0) { tbody.innerHTML = '<tr><td colspan="10" class="text-center muted" style="padding:20px">Không có mảnh dư nào.</td></tr>'; return; }
  tbody.innerHTML = offcuts.map(o => `<tr>
    <td><strong>${o.offcut_id}</strong></td>
    <td>${o.parent_lot_id || '—'}</td>
    <td>${o.material_code}</td>
    <td>${o.width_m} m</td>
    <td>${o.length_m} m</td>
    <td>${o.area_m2} m²</td>
    <td>${o.is_locked ? '<span style="color:var(--red-light)"><i class="fa-solid fa-lock"></i></span>' : '<span style="color:var(--text-muted)">—</span>'}</td>
    <td>${o.storage_location}</td>
    <td>${o.import_date}</td>
    <td>${trangThaiBadge(o.status)}</td>
  </tr>`).join('');
}

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
  document.querySelectorAll('#inv-subtabs .inv-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      _invSub = btn.dataset.invSub;
      taiQuanLyKho();
    });
  });
  taiTongQuan();
  taiThongBao();
  setInterval(taiThongBao, 30000);
});
