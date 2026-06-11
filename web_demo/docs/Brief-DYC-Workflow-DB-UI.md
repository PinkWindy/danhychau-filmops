# Báo cáo ngắn: Workflow DYC · DB/Model · Màn duyệt & phân bổ LOT

Tài liệu tham chiếu nhanh trong repo (đường dẫn tương đối gốc repo `Quản lý vận hành DYC`).

---

## 1. Tài liệu mô tả workflow DYC ban đầu

| Nội dung | Đường dẫn |
|-----------|-----------|
| **Tổng quan E2E** (WF1→WF6, actor, mermaid) | `workflows/workflow-overview.md` |
| WF0 OCR ảnh phiếu | `workflows/WF0-upload-anh-phieu-yeu-cau-ocr.md` |
| WF1 Tiếp nhận phiếu Lexus | `workflows/WF1-tiep-nhan-phieu-dai-ly-lexus.md` |
| WF2 Chuẩn hóa KH/đại lý/xe | `workflows/WF2-chuan-hoa-dai-ly-khach-hang-ho-so-xe.md` |
| WF3 Mapping & định mức | `workflows/WF3-mapping-xe-hang-muc-phim-dinh-muc.md` |
| WF4 Mảnh dư + phân bổ LOT | `workflows/WF4-toi-uu-manh-du-phan-bo-lot.md` |
| WF5 Phê duyệt & bàn giao KTV | `workflows/WF5-phe-duyet-giao-ky-thuat-vien.md` |
| WF6 Xác nhận thực tế / trừ kho | `workflows/WF6-xac-nhan-thuc-te-xuat-kho-nhap-manh-du-bao-cao.md` |
| WF7 Tiến độ & giao xe | `workflows/WF7-theo-doi-tien-do-thi-cong-va-giao-xe.md` |
| Bản đồ module ↔ workflow | `modules/module-mapping-table.md` |

Đoạn mô tả luồng chính (trích `workflow-overview.md` — mục Main Flow):

- WF1 tiếp nhận → WF2 master data → WF3 mapping & norm → WF4 offcut + LOT proposal → **WF5 Quản lý HITL duyệt (Soft Lock, chưa trừ kho vật lý)** → WF6 KTV xác nhận thực tế & trừ kho / audit.

---

## 2. Báo cáo / tài liệu DB và model hiện tại

| Nội dung | Đường dẫn |
|-----------|-----------|
| **ORM SQLAlchemy** (bảng & cột thực tế của web_demo) | `web_demo/database.py` — các class `DbDealer`, `DbCustomer`, `DbVehicleProfile`, `DbLotInventory`, `DbOffcutInventory`, `DbRequest`, `DbWorkstream`, `DbJobCard`, `DbAuditLog`, `DbAppUser`, … |
| **Sơ đồ quan hệ schema JSON** (đặc tả nghiệp vụ request → approval → inventory) | `schemas/schema-relationship-map.md` |
| **Báo cáo seed chuẩn** (số bản ghi dealers, requests, workstreams, …) | `web_demo/audit/database-standard-seed-report.md` |
| CSDL chạy local mặc định | `web_demo/warehouse_demo.db` (xem `web_demo/RUN_APP.md`) |

Tham chiếu code model lõi (Request + Workstream):

```189:307:web_demo/database.py
class DbRequest(Base):
    """Master request per vehicle. Aggregates all workstreams."""
    __tablename__ = "requests"
    request_id = Column(String, primary_key=True, index=True)
    # ...
    status = Column(String, default="DRAFT")
    # ...

class DbWorkstream(Base):
    """
    One workstream per service type per request.
    Types: PPF_INSTALLATION, WINDOW_FILM_INSTALLATION
    """
    __tablename__ = "workstreams"
    workstream_id = Column(String, primary_key=True, index=True)
    request_id = Column(String, index=True)
    workstream_type = Column(String)       # PPF_INSTALLATION | WINDOW_FILM_INSTALLATION
    # ... wf_allocation_json / ppf_allocation_json, status, approved_by, ...
```

---

## 3. Screenshot / mô tả màn hình: Manager duyệt phương án & KTV phân bổ LOT

### 3.1 Ảnh tham chiếu (audit)

Thư mục: `web_demo/audit/screenshots/README.md` — liệt kê file:

- `modal-ppf-preflight-dyc-ref.png` — UI **chỉnh PPF trước duyệt**
- `modal-wf-edit-dyc-ref.png` — UI **chỉnh phim cách nhiệt**

(Có thể thay bằng ảnh chụp thật từ app khi báo cáo nội bộ.)

### 3.2 Mô tả UI trong app (HTML)

**Quản lý — phê duyệt phương án (đơn đơn luồng):** tab chi tiết đơn, vùng **Thao tác** — `hitl-1-zone`: box “Quản lý cần phê duyệt phương án vật tư”, `proposal-box` (nguồn + chiều dài), nút **“Phê Duyệt & Tạo Soft Lock”** (`#btn-hitl-approve`).

```741:755:web_demo/static/index.html
              <div id="hitl-1-zone" style="display:none">
                <div class="hitl-alert">
                  <i class="fa-solid fa-user-tie"></i>
                  <div><strong>Quản lý cần phê duyệt phương án vật tư</strong>
                  <p>Hệ thống đề xuất nguồn vật tư:</p></div>
                </div>
                <div class="proposal-box">
                  <div class="prop-row"><span>Nguồn vật tư</span><strong id="prop-source">—</strong></div>
                  <div class="prop-row"><span>Chiều dài sử dụng</span><strong id="prop-len">—</strong></div>
                </div>
                <button class="btn btn-green btn-full" id="btn-hitl-approve">
                  <i class="fa-solid fa-check"></i> Phê Duyệt & Tạo Soft Lock
                </button>
              </div>
```

**Đa luồng:** `hitl-ws-zone` — “Phê duyệt từng luồng thi công”, thẻ luồng + nút tại **Tiến độ từng luồng**.

**KTV — sau thi công (xác nhận thực tế / trừ kho ảo đơn đơn luồng):** `hitl-2-zone` — form block thực tế, mét, mảnh dư, nút **“Xác Nhận & Trừ Kho Ảo”** (`#btn-hitl-complete`).

```757:776:web_demo/static/index.html
              <div id="hitl-2-zone" style="display:none">
                <div class="hitl-alert tech">
                  <i class="fa-solid fa-ruler-combined"></i>
                  <div><strong>Kỹ thuật viên xác nhận kích thước thực tế</strong>
                  <p>Nhập số liệu thực tế sau khi thi công để hệ thống trừ kho ảo.</p></div>
                </div>
                <div class="form-grid">
                  ...
                </div>
                <button class="btn btn-primary btn-full" id="btn-hitl-complete">
                  <i class="fa-solid fa-warehouse"></i> Xác Nhận & Trừ Kho Ảo
                </button>
              </div>
```

### 3.3 Modal phân bổ LOT / OFFCUT (WF + PPF) — copy theo trạng thái

File: `web_demo/static/workstream_allocation_modal.js` — mở qua `openWorkstreamAllocationModal` (PUT ` /api/workstreams/{id}/allocation`). Tiêu đề & gợi ý thay đổi theo `status` (ví dụ WF `PENDING_TECH_PREFLIGHT` = giai đoạn KTV chỉnh phân bổ trước chốt; PPF `PENDING_APPROVAL` = trước phê duyệt QL).

```12:55:web_demo/static/workstream_allocation_modal.js
  function wfGuideCopy(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING_TECH_PREFLIGHT') {
      return {
        title: 'Chỉnh phân bổ — giai đoạn trước chốt (KTV)',
        hint:
          'Luồng đã qua <strong>duyệt mã phim</strong>; tại đây chọn LOT/mảnh dư và số <strong>cm lấy</strong> từng nguồn. Lưu = ghi <code>/allocation</code>.',
      };
    }
    // ... APPROVED, IN_PROGRESS, ...
  }

  function ppfGuideCopy(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING_APPROVAL') {
      return {
        title: 'Chỉnh vật tư PPF — trước phê duyệt Quản lý',
        hint: 'Mặc định Full xe. Có thể chia nhiều LOT/OFFCUT. API: <code>/allocation</code>',
      };
    }
    // ...
  }
```

### 3.4 Ghi chú RBAC demo (Ma trận phân quyền)

Trong bản demo web, **tài khoản Quản lý** (`quanly`) **không** được ghi PUT phân bổ LOT (middleware); **KTV/Admin** được ghi — xem `web_demo/Implementation Plans/Ma_tran_phan_quyen_DYC.md` và test `web_demo/tests/test_rbac_auth.py`.
