// hr.js — gửi cookie phiên đăng nhập
function hrFetch(input, init = {}) {
  return fetch(input, { credentials: 'same-origin', ...init });
}

function _hrCanWrite() {
  return typeof window.dycPerm === 'function' ? window.dycPerm('can_hr_write') : true;
}

window.taiNhanSu = async function () {
  await Promise.all([loadStaffPerformance(), loadStaffList(), loadTeamList()]);
};

async function loadStaffPerformance() {
    const startDate = document.getElementById('hr-start-date')?.value;
    const endDate = document.getElementById('hr-end-date')?.value;
    let url = '/api/hr/performance';
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += '?' + params.toString();
    
    try {
        const res = await hrFetch(url);
        const data = await res.json();
        const tbody = document.getElementById('table-hr-performance');
        if(tbody) {
            tbody.innerHTML = data.map(d => `
                <tr>
                    <td><strong>${d.full_name}</strong><br><small class="muted">${d.staff_id}</small></td>
                    <td>${d.total_assigned}</td>
                    <td>${d.total_completed}</td>
                    <td>${d.completion_rate}%</td>
                    <td>${d.on_time_rate}%</td>
                    <td><button class="btn btn-outline btn-sm" onclick="openStaffJobsModal('${d.staff_id}', '${d.full_name}')"><i class="fa-solid fa-eye"></i> Chi tiết</button></td>
                </tr>
            `).join('');
        }
    } catch(e) { console.error('HR perf error', e); }
}

document.getElementById('btn-hr-filter')?.addEventListener('click', loadStaffPerformance);

async function loadStaffList() {
    try {
        const res = await hrFetch('/api/hr/staff');
        const data = await res.json();
        const tbody = document.getElementById('table-hr-staff-list');
        if (tbody) {
            const hw = _hrCanWrite();
            tbody.innerHTML = data.map(s => `
                <tr>
                    <td>${s.staff_id}</td>
                    <td>${s.full_name}</td>
                    <td>${s.title || ''}</td>
                    <td>${s.phone_number || ''}</td>
                    <td>${s.join_date ? s.join_date.split('T')[0] : ''}</td>
                    <td>${hw ? `
                        <button class="btn btn-outline btn-sm" onclick="editStaff('${s.staff_id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-outline btn-sm" style="color:var(--red)" onclick="deleteStaff('${s.staff_id}')"><i class="fa-solid fa-trash"></i></button>` : '<span class="muted" style="font-size:11px">Chỉ xem</span>'}</td>
                </tr>
            `).join('');
        }
        
        const sel = document.getElementById('team-member-staff-select');
        if (sel) {
            sel.innerHTML = data.map(s => `<option value="${s.staff_id}">${s.full_name} (${s.staff_id})</option>`).join('');
        }
    } catch(e) { console.error('HR staff error', e); }
}

let allStaffData = [];
async function fetchStaffDataForEdit() {
    const res = await hrFetch('/api/hr/staff');
    allStaffData = await res.json();
}

window.openStaffModal = async function() {
    if (!_hrCanWrite()) { if (typeof toast === 'function') toast('warning', 'Quyền', 'KTV chỉ xem nhân sự.'); return; }
    document.getElementById('staff-crud-id').value = '';
    document.getElementById('staff-crud-name').value = '';
    document.getElementById('staff-crud-title').value = '';
    document.getElementById('staff-crud-phone').value = '';
    document.getElementById('staff-crud-join-date').value = '';
    document.getElementById('staff-modal-title').textContent = 'Thêm Nhân Viên';
    document.getElementById('staff-crud-modal').style.display = 'flex';
};

window.editStaff = async function(staff_id) {
    if (!_hrCanWrite()) return;
    await fetchStaffDataForEdit();
    const s = allStaffData.find(x => x.staff_id === staff_id);
    if (!s) return;
    document.getElementById('staff-crud-id').value = s.staff_id;
    document.getElementById('staff-crud-name').value = s.full_name || '';
    document.getElementById('staff-crud-title').value = s.title || '';
    document.getElementById('staff-crud-phone').value = s.phone_number || '';
    document.getElementById('staff-crud-join-date').value = s.join_date ? s.join_date.split('T')[0] : '';
    document.getElementById('staff-modal-title').textContent = 'Sửa Nhân Viên';
    document.getElementById('staff-crud-modal').style.display = 'flex';
};

window.saveStaff = async function() {
    if (!_hrCanWrite()) { if (typeof toast === 'function') toast('warning', 'Quyền', 'Không được sửa nhân sự.'); return; }
    const id = document.getElementById('staff-crud-id').value;
    const payload = {
        full_name: document.getElementById('staff-crud-name').value.trim(),
        title: document.getElementById('staff-crud-title').value.trim(),
        phone_number: document.getElementById('staff-crud-phone').value.trim(),
        join_date: document.getElementById('staff-crud-join-date').value || null
    };
    if (!payload.full_name) { toast('warning', 'Thiếu thông tin', 'Vui lòng nhập họ tên'); return; }
    
    try {
        let url = '/api/hr/staff';
        let method = 'POST';
        if (id) {
            url += '/' + id;
            method = 'PUT';
        }
        const res = await hrFetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());
        if(typeof toast === 'function') toast('success', 'Nhân viên', 'Đã lưu nhân viên');
        document.getElementById('staff-crud-modal').style.display = 'none';
        loadStaffList();
    } catch(e) { if(typeof toast === 'function') toast('error', 'Lỗi lưu', e.message); }
};

window.deleteStaff = async function(staff_id) {
    if (!_hrCanWrite()) return;
    if (!confirm('Xác nhận xóa nhân viên này?')) return;
    try {
        const res = await hrFetch('/api/hr/staff/' + staff_id, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        if(typeof toast === 'function') toast('success', 'Nhân viên', 'Đã xóa nhân viên');
        loadStaffList();
    } catch(e) { if(typeof toast === 'function') toast('error', 'Lỗi xóa', e.message); }
};

let allTeamsData = [];
async function loadTeamList() {
    try {
        const res = await hrFetch('/api/hr/teams');
        const data = await res.json();
        allTeamsData = data;
        const tbody = document.getElementById('table-hr-team-list');
        if (tbody) {
            const hw = _hrCanWrite();
            tbody.innerHTML = data.map(t => `
                <tr>
                    <td>${t.team_id}</td>
                    <td><strong>${t.team_name}</strong></td>
                    <td>${t.team_type}</td>
                    <td>
                        <div style="font-size:11px">
                        ${t.members.map(m => `<span>${m.full_name} (${m.role})</span><br>`).join('')}
                        </div>
                    </td>
                    <td>${hw ? `
                        <button class="btn btn-outline btn-sm" onclick="editTeam('${t.team_id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-outline btn-sm" onclick="openTeamMemberModal('${t.team_id}')"><i class="fa-solid fa-users"></i> Thành viên</button>
                        <button class="btn btn-outline btn-sm" style="color:var(--red)" onclick="deleteTeam('${t.team_id}')"><i class="fa-solid fa-trash"></i></button>` : '<span class="muted" style="font-size:11px">Chỉ xem</span>'}</td>
                </tr>
            `).join('');
        }
    } catch(e) { console.error('HR team error', e); }
}

window.openTeamModal = async function() {
    if (!_hrCanWrite()) { if (typeof toast === 'function') toast('warning', 'Quyền', 'KTV chỉ xem nhân sự.'); return; }
    document.getElementById('team-crud-id').value = '';
    document.getElementById('team-crud-name').value = '';
    document.getElementById('team-crud-type').value = '';
    document.getElementById('team-modal-title').textContent = 'Thêm Đội Nhóm';
    document.getElementById('team-crud-modal').style.display = 'flex';
};

window.editTeam = async function(team_id) {
    if (!_hrCanWrite()) return;
    const t = allTeamsData.find(x => x.team_id === team_id);
    if (!t) return;
    document.getElementById('team-crud-id').value = t.team_id;
    document.getElementById('team-crud-name').value = t.team_name || '';
    document.getElementById('team-crud-type').value = t.team_type || '';
    document.getElementById('team-modal-title').textContent = 'Sửa Đội Nhóm';
    document.getElementById('team-crud-modal').style.display = 'flex';
};

window.saveTeam = async function() {
    if (!_hrCanWrite()) { if (typeof toast === 'function') toast('warning', 'Quyền', 'Không được sửa đội nhóm.'); return; }
    const id = document.getElementById('team-crud-id').value;
    const payload = {
        team_name: document.getElementById('team-crud-name').value.trim(),
        team_type: document.getElementById('team-crud-type').value.trim(),
        status: 'ACTIVE'
    };
    if (!payload.team_name) { if(typeof toast === 'function') toast('warning', 'Thiếu thông tin', 'Vui lòng nhập tên đội'); return; }
    
    try {
        let url = '/api/hr/teams';
        let method = 'POST';
        if (id) {
            url += '/' + id;
            method = 'PUT';
        }
        const res = await hrFetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());
        if(typeof toast === 'function') toast('success', 'Đội nhóm', 'Đã lưu đội nhóm');
        document.getElementById('team-crud-modal').style.display = 'none';
        loadTeamList();
    } catch(e) { if(typeof toast === 'function') toast('error', 'Lỗi lưu', e.message); }
};

window.deleteTeam = async function(team_id) {
    if (!_hrCanWrite()) return;
    if (!confirm('Xác nhận xóa đội này?')) return;
    try {
        const res = await hrFetch('/api/hr/teams/' + team_id, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        if(typeof toast === 'function') toast('success', 'Đội nhóm', 'Đã xóa đội nhóm');
        loadTeamList();
    } catch(e) { if(typeof toast === 'function') toast('error', 'Lỗi xóa', e.message); }
};

window.openTeamMemberModal = async function(team_id) {
    document.getElementById('team-member-team-id').value = team_id;
    const t = allTeamsData.find(x => x.team_id === team_id);
    const tbody = document.getElementById('table-team-members');
    if (t && t.members) {
        const hw = _hrCanWrite();
        tbody.innerHTML = t.members.map(m => `
            <tr>
                <td>${m.full_name}</td>
                <td>${m.role}</td>
                <td>${hw ? `<button class="btn btn-outline btn-sm" style="color:var(--red)" onclick="removeTeamMember('${team_id}', '${m.staff_id}')"><i class="fa-solid fa-xmark"></i></button>` : '—'}</td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '';
    }
    const assignBlk = document.querySelector('#team-member-modal [data-hr-assign-only]');
    if (assignBlk) assignBlk.style.display = _hrCanWrite() ? 'flex' : 'none';
    document.getElementById('team-member-modal').style.display = 'flex';
};

window.assignTeamMember = async function() {
    if (!_hrCanWrite()) return;
    const team_id = document.getElementById('team-member-team-id').value;
    const staff_id = document.getElementById('team-member-staff-select').value;
    const role = document.getElementById('team-member-role').value;
    if (!team_id || !staff_id) return;
    
    try {
        const res = await hrFetch('/api/hr/teams/' + team_id + '/members', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({staff_id, role})
        });
        if (!res.ok) throw new Error(await res.text());
        if(typeof toast === 'function') toast('success', 'Thành viên', 'Đã thêm thành viên');
        await loadTeamList();
        openTeamMemberModal(team_id);
    } catch(e) { if(typeof toast === 'function') toast('error', 'Lỗi thêm thành viên', e.message); }
};

window.removeTeamMember = async function(team_id, staff_id) {
    if (!_hrCanWrite()) return;
    try {
        const res = await hrFetch('/api/hr/teams/' + team_id + '/members/' + staff_id, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        if(typeof toast === 'function') toast('success', 'Thành viên', 'Đã xóa thành viên');
        await loadTeamList();
        openTeamMemberModal(team_id);
    } catch(e) { if(typeof toast === 'function') toast('error', 'Lỗi xóa thành viên', e.message); }
};

window.openStaffJobsModal = async function(staff_id, full_name) {
    document.getElementById('hr-detail-title').textContent = full_name;
    document.getElementById('hr-detail-subtitle').textContent = staff_id;
    
    try {
        const res = await hrFetch('/api/hr/performance/' + staff_id + '/jobs');
        const jobs = await res.json();
        const tbody = document.getElementById('table-hr-jobs');
        tbody.innerHTML = jobs.map(j => `
            <tr>
                <td>${j.job_card_id}</td>
                <td>${j.vehicle_model_code}<br><small>${j.vin_masked || ''}</small></td>
                <td>${j.started_at ? j.started_at.replace('T', ' ').substring(0, 16) : '—'}</td>
                <td>${j.completed_at ? j.completed_at.replace('T', ' ').substring(0, 16) : '—'}</td>
                <td><span class="status-badge status-${j.status.toLowerCase()}">${j.status}</span></td>
                <td>${j.is_on_time === true ? '<span style="color:var(--green)"><i class="fa-solid fa-check"></i> Có</span>' : (j.is_on_time === false ? '<span style="color:var(--red)"><i class="fa-solid fa-xmark"></i> Không</span>' : '—')}</td>
            </tr>
        `).join('');
        document.getElementById('hr-detail-modal').style.display = 'flex';
    } catch(e) { console.error(e); }
};
