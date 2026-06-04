# Đưa code lên GitHub — hướng dẫn cho người mới (non-tech)

Bài này giải thích **từ đầu**: GitHub là gì, cần cài gì, làm từng bước thế nào. Bạn **không cần** nhớ thuật ngữ kỹ thuật — chỉ cần làm theo thứ tự.

---

## 0. GitHub là gì? (1 phút đọc)

- **GitHub** = một **website** lưu trữ **bản sao** mã nguồn dự án của bạn trên internet (giống “Google Drive cho code”).
- Sau khi code nằm trên GitHub, các dịch vụ như **Render** mới **kéo code từ đó** để chạy web online.

**Bạn sẽ làm 2 việc lớn:**

1. Tạo **kho trên GitHub** (repository).
2. Đưa **thư mục dự án trên máy** đồng bộ lên kho đó.

---

## 1. Chuẩn bị trước khi làm

### 1.1. Tài khoản GitHub (miễn phí)

1. Mở trình duyệt → [https://github.com/signup](https://github.com/signup).
2. Điền email, mật khẩu, tên hiển thị → làm theo hướng dẫn xác minh email.
3. Ghi nhớ **tên đăng nhập GitHub** của bạn (ví dụ: `nguyen-van-a`).

### 1.2. Xác định thư mục dự án trên máy

Thư mục bạn cần đưa lên GitHub là thư mục **cha** của `web_demo`, tức là nơi bạn thấy **cả hai**:

- thư mục **`web_demo`**
- thư mục **`knowledge`**

Ví dụ đường dẫn có thể là:

`D:\Quản lý vận hành DYC`

**Quan trọng:** Nếu chỉ có `web_demo` mà **không** có `knowledge` cùng cấp, sau này chạy dữ liệu demo trên server sẽ **lỗi**. Phải đẩy **cả thư mục gốc** chứa cả hai.

---

## 2. Cách dễ nhất cho người mới: dùng GitHub Desktop (khuyến nghị)

**GitHub Desktop** là phần mềm có **giao diện nút bấm**, không phải gõ nhiều lệnh như PowerShell.

### Bước 2.1 — Tải và cài GitHub Desktop

1. Mở [https://desktop.github.com](https://desktop.github.com).
2. Bấm **Download for Windows** → chạy file cài → Next / Install cho đến khi xong.
3. Mở **GitHub Desktop** lần đầu → đăng nhập bằng **tài khoản GitHub** (bước 1.1).

### Bước 2.2 — Tạo kho (repository) trên GitHub (trên website)

1. Đăng nhập [https://github.com](https://github.com).
2. Góc phải trên cùng, bấm dấu **+** → **New repository**.
3. **Repository name:** đặt tên ngắn, không dấu cách (ví dụ: `dyc-film-demo`).
4. Chọn **Public** (mọi người xem được) hoặc **Private** (chỉ bạn / người được mời).
5. **Bỏ chọn** ô “Add a README file” (để tránh lỗi khi đưa thư mục có sẵn code lên).
6. Bấm **Create repository**.

Trang tiếp theo GitHub thường hiện hướng dẫn — **bạn có thể đóng tab đó**, quay lại GitHub Desktop.

### Bước 2.3 — Đưa thư mục dự án vào GitHub Desktop

1. Mở **GitHub Desktop**.
2. Menu **File** → **Add Local Repository…** (Thêm kho từ máy).
3. Bấm **Choose…** → chọn thư mục **gốc dự án** (thư mục có `web_demo` và `knowledge`) → **Add repository**.

**Trường hợp A — GitHub Desktop báo “this directory does not appear to be a Git repository”:**

- Bấm nút **create a repository** (hoặc dòng chữ tương tự) ngay trong cửa sổ đó.
- **Name:** có thể để trùng tên thư mục hoặc tên repo bạn muốn.
- **Local path:** đúng thư mục gốc dự án.
- Bấm **Create repository** → sau đó bạn đã có Git trong thư mục đó.

**Trường hợp B — Đã add được, thấy danh sách file bên trái:**

- Chuyển sang bước 2.4.

### Bước 2.4 — Tạo file .gitignore (bỏ qua file rác khi đưa lên mạng)

1. Trong **File Explorer**, vào thư mục gốc dự án.
2. Chuột phải → **New** → **Text Document** → đặt tên chính xác: `.gitignore`  
   (Windows có thể hỏi “đổi đuôi” — chọn **Yes** nếu cần; nếu khó đặt tên `.gitignore`, có thể tạo trong Notepad: File → Save As → tên `.gitignore`, kiểu **All files**).
3. Mở `.gitignore` bằng Notepad, dán vào **nội dung sau**, rồi **Save**:

```gitignore
__pycache__/
*.pyc
.env
.venv/
venv/
*.db-journal
.idea/
```

4. Quay lại **GitHub Desktop** — bạn sẽ thấy `.gitignore` trong danh sách file thay đổi.

### Bước 2.5 — Commit (đóng gói bản lưu trên máy)

1. Ở dưới cùng bên trái, ô **Summary (required)** — gõ một câu ngắn, ví dụ: `Luu ban dau len Git`.
2. Bấm nút xanh **Commit to main** (hoặc **Commit to master** — tên nhánh không quan trọng lắm).

Nếu GitHub Desktop hỏi **name / email** lần đầu — điền tên và email (có thể dùng email GitHub).

### Bước 2.6 — Publish repository (đẩy lên GitHub.com)

1. Bấm nút **Publish repository** (Xuất bản kho) — thường ở trên cùng.
2. **Name:** nên **trùng** tên repo bạn đã tạo ở bước 2.2 (ví dụ `dyc-film-demo`), hoặc để GitHub Desktop đặt tên mới thì trên website sẽ có repo mới cùng tên đó.
3. Tick / bỏ tick **Keep this code private** tùy bạn.
4. Bấm **Publish repository** / **Publish**.

Đợi vài chục giây đến vài phút — khi xong, nút thường đổi thành **Fetch origin** / **Push origin** và không còn báo lỗi đỏ.

### Bước 2.7 — Kiểm tra trên trình duyệt (quan trọng)

1. Mở lại [https://github.com](https://github.com) → đăng nhập.
2. Bấm ảnh đại diện góc phải → **Your repositories** → bấm vào **tên repo** vừa publish.
3. Bạn phải nhìn thấy:

   - Thư mục **`web_demo`**
   - Thư mục **`knowledge`**
   - Vào `web_demo` → phải thấy file **`requirements.txt`**

Nếu **thiếu** `knowledge` hoặc `requirements.txt` → nghĩa là bạn đã chọn **sai thư mục** lúc Add repository (chọn lại thư mục cha đúng như mục 1.2).

**Xong phần GitHub** khi bạn thấy đủ 3 thứ trên trang repo.

---

## 3. Nếu không dùng GitHub Desktop: dùng PowerShell (gõ lệnh)

Chỉ dùng khi bạn quen gõ lệnh hoặc IT hỗ trợ. Mở PowerShell **trong thư mục gốc dự án** (Shift + chuột phải → Open in Terminal).

| Lệnh | Ý nghĩa đơn giản |
|------|------------------|
| `git init` | Bảo máy: “bắt đầu theo dõi phiên bản trong thư mục này”. |
| `git branch -M main` | Đặt tên nhánh chính là `main` (thống nhất với GitHub hiện đại). |
| `git add .` | Chọn **tất cả** file (trừ những dòng trong `.gitignore`) để chuẩn bị gửi. |
| `git commit -m "..."` | **Đóng gói** một bản lưu có ghi chú. |
| `git remote add origin https://github.com/.../....git` | Nói máy: “kho trên mạng nằm ở địa chỉ này”. (Thay bằng link repo **thật** của bạn — copy từ trang repo GitHub → nút xanh **Code** → HTTPS.) |
| `git push -u origin main` | **Đẩy** bản lưu lên GitHub lần đầu. |

Lần đầu `git push`, GitHub thường **không** nhận mật khẩu web — cần **Personal Access Token** (Mục phụ dưới đây).

### Phụ: Personal Access Token (khi push hỏi mật khẩu)

1. GitHub → ảnh đại diện → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**.
2. Tick quyền **repo**.
3. Generate → **copy chuỗi token** (chỉ hiện một lần).
4. Khi `git push` hỏi **Password** — dán **token** vào (không phải mật khẩu đăng nhập GitHub).

---

## 4. Câu hỏi thường gặp

**Hỏi: Tôi đã bấm Publish rồi, sau này sửa file trên máy thì sao?**

- Mở GitHub Desktop → sẽ thấy file đổi → ghi **Summary** → **Commit** → **Push origin**. Như vậy bản mới mới lên GitHub.

**Hỏi: Tôi không thấy thư mục `knowledge` trên GitHub?**

- Repo trên máy của bạn đang không đặt `knowledge` cùng cấp với `web_demo` — cần sắp xếp lại thư mục hoặc chọn đúng thư mục cha khi Add / Publish.

**Hỏi: Lỗi chữ đỏ trong GitHub Desktop?**

- Chụp màn hình hoặc copy dòng chữ đỏ gửi người hỗ trợ — thường là chưa đăng nhập, sai tên repo, hoặc chưa có quyền Private.

---

## 5. Sau khi xong GitHub — bước tiếp theo

Khi trên GitHub đã **đủ** `web_demo/`, `knowledge/`, `web_demo/requirements.txt`, bạn làm tiếp phần **Render** trong file:

`web_demo/DEPLOY.md` (mục **Phần B**).

---

*Tóm lại cho người mới: ưu tiên **GitHub Desktop** + kiểm tra **3 thứ** trên trang GitHub như mục 2.7.*
