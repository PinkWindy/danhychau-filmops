import os

p = r"d:\Quản lý vận hành DYC\web_demo\static\app.js"
with open(p, "r", encoding="utf-8") as f:
    js = f.read()

# Inject a debug display into taiDinhMucPhim
debug_code = """
    const norms = (data.items || data.norms || []);
    const nTotal = data.total || norms.length;
    // DEBUG HACK: display data as JSON in UI if norms is empty
    if (norms.length === 0) {
       document.getElementById('norms-container').innerHTML = '<pre style="background:red;color:white;padding:10px;">DEBUG DATA:<br/>' + JSON.stringify(data, null, 2) + '<br/>URL: /api/vehicle-norms' + buildQuery({ ...fn, with_meta: '1' }) + '</pre>';
       return;
    }
"""

js = js.replace("""
    const norms = (data.items || data.norms || []);
    const nTotal = data.total || norms.length;
""", debug_code)

with open(p, "w", encoding="utf-8") as f:
    f.write(js)
print("Debug code injected.")
