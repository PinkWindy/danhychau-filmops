import sys

app_path = 'd:/Quản lý vận hành DYC/web_demo/static/app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

start_idx = app_content.find("window.chiinhSuaWs = async function(wsId) {")
end_idx = app_content.find("window.closeWsEdit = function() {")

if start_idx != -1 and end_idx != -1:
    new_code = """window.chiinhSuaWs = async function(wsId) {
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
      if (typeof toast === 'function') toast('error', 'Lỗi', 'Không tìm thấy hàm openWorkstreamAllocationModal');
    }
  } catch (err) {
    if (typeof toast === 'function') toast('error', 'Lỗi', 'Không thể mở modal: ' + err.message);
  }
}

window.luuChinhSuaWs = async function() {
    // deprecated
}

"""
    app_content = app_content[:start_idx] + new_code + app_content[end_idx:]
    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(app_content)
    print("Rewrote chiinhSuaWs in app.js successfully!")
else:
    print(f"Indices: start={start_idx}, end={end_idx}")
