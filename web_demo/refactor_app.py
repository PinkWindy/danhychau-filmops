import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update tabLoaders
content = content.replace("  customers: taiKhachHang,\n  requests: taiDonThiCong,", "  customers: taiKhachHang,\n  norms: taiDinhMucPhim,\n  requests: taiDonThiCong,")

# 2. Remove norms variables from taiKhachHang
content = content.replace("      const fn = window._custF.norms;\n", "")
content = content.replace("        fetch(`/api/vehicle-norms${buildQuery({ ...fn, with_meta: '1' })}`).then((r) => r.json()).catch(() => []),\n", "")
content = content.replace("      const [vehJson, normJson, dealerPick, custPick] = await Promise.all([\n", "      const [vehJson, dealerPick, custPick] = await Promise.all([\n")
content = content.replace("      const norms = normalizeListResponse(normJson).items;\n      const nTotal = normJson.meta?.total || 0;\n", "")

# 3. Remove norms HTML from renderVehicles / taiKhachHang
# We use string matching to be safe
start_idx = content.find('<div id="cust-veh-norms-wrap"')
end_idx = content.find('</div>`;', start_idx)
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + '</div>`;\n' + content[end_idx + 8:]

# 4. Remove _normFilterChips from taiKhachHang
content = re.sub(r'\s*_normFilterChips\(fn, \(key\) => \{\n\s*window\._custF\.norms\[key\] = \'\';\n\s*taiKhachHang\(\);\n\s*\}\);\n', '\n', content)

# 5. Remove event listeners related to norms from tab-customers
content = re.sub(r'\s*if \(act === \'norms-apply\'\) \{.*?(?=if \(act === \')', '', content, flags=re.DOTALL)
content = re.sub(r'\s*if \(act === \'norms-clear\'\) \{.*?(?=if \(act === \')', '', content, flags=re.DOTALL)
content = re.sub(r'\s*if \(act === \'norms-refresh\'\) \{.*?(?=if \(act === \')', '', content, flags=re.DOTALL)
content = re.sub(r'\s*if \(act === \'norms-add\'\) \{.*?(?=\}\n\s*const edit)', '', content, flags=re.DOTALL)
# Also remove btn-norm-edit and btn-norm-toggle from tab-customers event listener
content = re.sub(r'\s*const edit = ev\.target\.closest\(\'\.btn-norm-edit\'\);.*?return;\n\s*\}\n', '\n', content, flags=re.DOTALL)
content = re.sub(r'\s*const tg = ev\.target\.closest\(\'\.btn-norm-toggle\'\);.*?return;\n\s*\}\n', '\n', content, flags=re.DOTALL)
content = re.sub(r'\s*else if \(id === \'flt-n-q\'\) __debNormQ\(\);\n', '\n', content)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done step 1')
