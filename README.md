# SmartFill AI — Trợ lý điền form bằng AI chạy local

> Extension trình duyệt giúp tự động điền các biểu mẫu web (form đăng ký, khai báo thông tin, tạo tài khoản...) bằng AI chạy **local** qua [Ollama]. Bạn lưu hồ sơ một lần, AI sẽ tự hiểu nhãn từng ô và điền hộ — kể cả dropdown, radio, checkbox, ngày sinh.

**Sản phẩm dự thi "Phát triển phần mềm mã nguồn mở tích hợp AI 2026" — Khoa CNTT, Trường ĐH CNTT&TT, ĐH Thái Nguyên.**

---

## Vì sao có dự án này?

Sinh viên thường xuyên phải nhập đi nhập lại cùng một bộ thông tin (họ tên, mã sinh viên, lớp, khoa, email...) vào hàng chục biểu mẫu khác nhau. SmartFill AI giải quyết việc đó: khai báo hồ sơ một lần, mỗi lần gặp form chỉ cần bấm một nút.

Khác với tính năng autofill có sẵn của trình duyệt (chỉ khớp cứng theo tên trường), SmartFill AI dùng **mô hình ngôn ngữ** để *hiểu ngữ nghĩa* của nhãn. Ví dụ ô ghi "MSV", "Student ID" hay "mã sinh viên" đều được nhận ra là mã số sinh viên; quê quán dạng dropdown "Tỉnh Thái Nguyên" vẫn khớp được với hồ sơ ghi "Thái Nguyên".

## Tính năng

- ✅ Điền **mọi website** mở trong trình duyệt (form đăng ký, hồ sơ, tạo tài khoản).
- ✅ Hỗ trợ nhiều loại ô: text, email, số điện thoại, **dropdown (select)**, **radio**, **checkbox**, **ngày sinh (date)**.
- ✅ Hoạt động cả với **Google Forms** (các ô lựa chọn dạng đặc biệt `role="listbox"`/`role="radio"`).
- ✅ AI hiểu nhãn theo ngữ nghĩa, không cần khớp tên chính xác.
- ✅ Quản lý **nhiều hồ sơ** (vd: hồ sơ cá nhân, hồ sơ học vụ).
- ✅ **Riêng tư tuyệt đối**: dữ liệu lưu trong máy bạn, AI chạy local — không gửi lên cloud.
- ✅ Tô màu các ô vừa điền để bạn **rà lại trước khi gửi**.

## Yêu cầu

- Trình duyệt nhân Chromium: **Google Chrome** hoặc **Microsoft Edge** (hỗ trợ Manifest V3).
- [Ollama] đã cài và đang chạy trên máy.

## Cài đặt

### Bước 1 — Cài và chạy Ollama (AI local)

1. Tải Ollama tại https://ollama.com và cài đặt.
2. Tải model AI. **Khuyến nghị tối thiểu `qwen2.5:7b`** (cân bằng giữa độ chính xác tiếng Việt và tốc độ):

   ```bash
   ollama pull qwen2.5:7b
   ```

   Tùy cấu hình máy, bạn có thể chọn model khác — xem [Chọn model phù hợp với máy](#chọn-model-phù-hợp-với-máy).

3. Cho phép extension gọi Ollama. Ollama mặc định chỉ nhận yêu cầu từ `localhost`; cần cấp quyền cho extension bằng biến môi trường `OLLAMA_ORIGINS`:

   - **Windows (PowerShell):**
     ```powershell
     setx OLLAMA_ORIGINS "chrome-extension://*"
     ```
     Sau đó khởi động lại Ollama.
   - **macOS / Linux:**
     ```bash
     export OLLAMA_ORIGINS="chrome-extension://*"
     ollama serve
     ```

### Chọn model phù hợp với máy

SmartFill AI chạy được với **bất kỳ model nào Ollama hỗ trợ**. Độ chính xác khi điền form (chép đúng nguyên văn, không điền nhầm ô, chọn đúng mục dropdown) phụ thuộc nhiều vào kích cỡ model: càng lớn càng chính xác, nhưng cần nhiều RAM/VRAM và chạy chậm hơn.

| Model (`ollama pull ...`) | RAM/VRAM cần | Phù hợp với | Độ chính xác |
|---|---|---|---|
| `qwen2.5:3b` | ~3–4 GB | Máy yếu, RAM 8 GB, không card rời | Tạm ổn (đôi khi gõ sai / điền nhầm) |
| `qwen2.5:7b` ⭐ | ~6–8 GB | RAM 16 GB hoặc GPU ≥ 6 GB VRAM | Tốt — **khuyến nghị tối thiểu** |
| `llama3.1:8b` | ~7–9 GB | RAM 16 GB, GPU 8 GB | Tốt |
| `qwen2.5:14b` | ~10–12 GB | RAM ≥ 16–32 GB, GPU ≥ 10 GB VRAM | Rất tốt |
| `qwen2.5:32b` | ~20 GB trở lên | GPU ≥ 16–24 GB VRAM | Cao nhất |

Gợi ý nhanh theo máy:

- **Laptop văn phòng, không card đồ họa rời (RAM 8 GB):** `qwen2.5:3b` — chạy được nhưng nên rà kỹ lại trước khi gửi.
- **Máy phổ thông (RAM 16 GB) hoặc có GPU 6–8 GB:** `qwen2.5:7b` ⭐ — cân bằng nhất, nên dùng.
- **Máy mạnh (GPU ≥ 10 GB VRAM):** `qwen2.5:14b` trở lên để có độ chính xác cao nhất.

> **Vì sao chọn dòng Qwen2.5?** Nó hiểu tiếng Việt và xuất JSON ổn định hơn nhiều model cùng kích cỡ — rất hợp với việc đọc nhãn form tiếng Việt. Bạn vẫn có thể thử model khác (Gemma, Llama, Mistral...) trong **Cài đặt AI → Model**.

Sau khi `pull` xong, mở popup **⚙️ Cài đặt AI (Ollama) → Model** và nhập đúng tên model bạn đã tải (vd `qwen2.5:7b`), rồi bấm **Kiểm tra kết nối**.

### Bước 2 — Nạp extension vào trình duyệt

1. Tải mã nguồn này về (Code → Download ZIP, hoặc `git clone`), giải nén.
2. Mở Chrome/Edge, vào `chrome://extensions` (Edge: `edge://extensions`).
3. Bật **Developer mode** (Chế độ nhà phát triển) ở góc trên bên phải.
4. Bấm **Load unpacked** (Tải tiện ích đã giải nén) → chọn thư mục `smartfill-ai`.
5. Biểu tượng SmartFill AI sẽ xuất hiện trên thanh công cụ.

> Đây là một extension thuần JavaScript, **không cần bước build/biên dịch**. Mã nguồn chạy trực tiếp đúng như trong kho.

## Cách dùng

1. Bấm biểu tượng SmartFill AI để mở popup.
2. Nhập thông tin vào hồ sơ (có sẵn các trường gợi ý; thêm/bớt tùy ý) → **Lưu hồ sơ**.
3. Mở **Cài đặt AI** → bấm **Kiểm tra kết nối** để chắc chắn Ollama sẵn sàng.
4. Mở một trang có form, bấm **✨ Điền form trên trang này**.
5. AI đọc form, điền các ô khớp, và tô viền xanh những ô đã điền. **Rà lại rồi bấm gửi.**

## Cấu trúc dự án

```
smartfill-ai/
├── manifest.json        # Khai báo extension (Manifest V3)
├── popup/               # Giao diện quản lý hồ sơ
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── src/
│   ├── content.js       # Quét & điền form trên trang
│   └── background.js     # Service worker: gọi Ollama, map dữ liệu
├── icons/               # Biểu tượng extension
├── demo/                # Trang form mẫu để thử nghiệm
│   └── demo-form.html
├── LICENSE              # Giấy phép MIT
├── CHANGELOG.md
└── README.md
```

## Công nghệ & thư viện

- **Chrome Extension Manifest V3** — không phụ thuộc framework ngoài.
- **JavaScript thuần (ES2020)** — không cần bundler, không gói đính kèm bên thứ ba.
- **[Ollama]** — máy chủ mô hình ngôn ngữ chạy local; gọi qua REST API (`/api/chat`).
- **Model mặc định:** `qwen2.5:7b` (khuyến nghị tối thiểu; có thể đổi sang model bất kỳ đã `ollama pull` trong Cài đặt AI).

Toàn bộ chức năng AI dùng mô hình mã nguồn mở chạy cục bộ — không có khóa API trả phí, không gửi dữ liệu ra ngoài.

## Khắc phục sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| "Không kết nối được Ollama" | Kiểm tra Ollama đang chạy (`ollama serve`) và đã đặt `OLLAMA_ORIGINS`. |
| Kết nối được nhưng báo thiếu model | Chạy `ollama pull qwen2.5:7b` (hoặc đúng tên model bạn đặt trong Cài đặt AI). |
| Điền sai chính tả / điền nhầm ô | Model đang dùng quá nhỏ. Đổi lên `qwen2.5:7b` trở lên (xem [Chọn model phù hợp với máy](#chọn-model-phù-hợp-với-máy)). |
| Ô dropdown/lựa chọn của Google Forms không chọn được | Tải lại trang rồi thử lại; đảm bảo đã reload extension sau khi cập nhật. |
| Điền thiếu vài ô | Một số form dùng JS đặc biệt; rà lại và điền tay những ô còn trống. |
| Nút không có tác dụng | Tải lại trang rồi thử lại; một số trang hệ thống (chrome://) không cho phép. |

## Quản lý lỗi & đóng góp

Báo lỗi hoặc đề xuất tính năng qua **GitHub Issues** của dự án. Lịch sử thay đổi xem tại [CHANGELOG.md](CHANGELOG.md).

## Giấy phép

Phát hành theo [Giấy phép MIT](LICENSE) — bạn được tự do dùng, sửa, và phân phối lại.

[Ollama]: https://ollama.com
