import sys

# 1. Modify workstream_allocation_modal.js
modal_path = 'd:/Quản lý vận hành DYC/web_demo/static/workstream_allocation_modal.js'
with open(modal_path, 'r', encoding='utf-8') as f:
    modal_content = f.read()

old_modal_text = """    try {
      const res = await fetch(`/api/workstreams/${ctx.wsId}/allocation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });"""

new_modal_text = """    try {
      let method = 'PUT';
      let url = `/api/workstreams/${ctx.wsId}/allocation`;
      let bodyData = JSON.stringify(finalPayload);
      
      if (window._wsManagerEditMode) {
        method = 'POST';
        url = `/api/workstreams/${ctx.wsId}/edit`;
        
        const reasonEl = document.getElementById('wa-alloc-reason');
        const teamEl = document.getElementById('wa-edit-team');
        const techEl = document.getElementById('wa-edit-tech');
        
        let source_id = '';
        let source_type = 'LOT';
        let job_items = [];
        
        if (finalPayload.items) {
          for (const item of finalPayload.items) {
            if (item.is_selected || item.selected) {
              job_items.push(item.item_code);
              if (!source_id && item.sources && item.sources.length > 0) {
                source_id = item.sources[0].source_id;
                source_type = item.sources[0].source_type || 'LOT';
              }
            }
          }
        } else if (finalPayload.sources && finalPayload.sources.length > 0) {
          source_id = finalPayload.sources[0].source_id;
          source_type = finalPayload.sources[0].source_type || 'LOT';
        }
        
        const editPayload = {
          reason: reasonEl && reasonEl.value ? reasonEl.value.trim() : 'Chỉnh sửa giao diện quản lý',
          actor: 'QL-002',
          allocated_source_id: source_id,
          allocated_source_type: source_type,
          job_items: job_items.join(';'),
          technician_team: teamEl ? teamEl.value.trim() : '',
          assigned_technician_name: techEl ? techEl.value.trim() : ''
        };
        
        if (ctx.ws.workstream_type === 'PPF_INSTALLATION') {
          editPayload.selected_material_code = finalPayload.selected_material_code;
        }
        
        bodyData = JSON.stringify(editPayload);
      }

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: bodyData,
      });"""

if old_modal_text in modal_content:
    modal_content = modal_content.replace(old_modal_text, new_modal_text)
    with open(modal_path, 'w', encoding='utf-8') as f:
        f.write(modal_content)
    print("Modified workstream_allocation_modal.js successfully!")
else:
    print("Could not find old text in workstream_allocation_modal.js!")

# 2. Rewrite chiinhSuaWs in app.js
import re
app_path = 'd:/Quản lý vận hành DYC/web_demo/static/app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

# We want to replace the whole chiinhSuaWs function block.
# Since it's quite long, we can use regex to find the start and the end of the function.
# The function ends with window.luuChinhSuaWs = async function() ... 
# We'll just replace everything from "window.chiinhSuaWs = async function(wsId, btn) {" 
# down to "window.luuChinhSuaWs =" (exclusive).

pattern = re.compile(r'window\.chiinhSuaWs = async function\(wsId, btn\) \{.*?(?=window\.luuChinhSuaWs = async function)', re.DOTALL)

new_chiinhSuaWs = """window.chiinhSuaWs = async function(wsId, btn) {
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  try {
    const ws = await fetch(`/api/workstreams/${wsId}`).then((r) => r.json());
    if (!ws || !ws.workstream_id) throw new Error('Workstream not found');

    const [lots, offcuts] = await Promise.all([
      fetch('/api/lots').then((r) => r.json()),
      fetch('/api/offcuts').then((r) => r.json()),
    ]);

    window._wsManagerEditMode = true;
    if (typeof window.openWorkstreamAllocationModal === 'function') {
      await window.openWorkstreamAllocationModal(wsId, ws, lots, offcuts);
    } else {
      toast('error', 'Lỗi', 'Không tìm thấy hàm openWorkstreamAllocationModal');
    }
  } catch (err) {
    toast('error', 'Lỗi', 'Không thể mở modal: ' + err.message);
  } finally {
    if (btn) btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
  }
};

"""

if pattern.search(app_content):
    app_content = pattern.sub(new_chiinhSuaWs, app_content)
    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(app_content)
    print("Rewrote chiinhSuaWs in app.js successfully!")
else:
    print("Could not find chiinhSuaWs in app.js!")
