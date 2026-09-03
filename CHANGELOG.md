# Changelog

Tất cả thay đổi đáng chú ý của dự án được ghi lại trong tệp này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/),
và dự án tuân theo [Semantic Versioning](https://semver.org/lang/vi/).

## [1.2.0] - 2026-09-03

### Added (Thêm mới)
- **MCP Server** (`mcp-server/`) viết bằng Node.js: các trợ lý AI tự động (Claude Code, Cursor...) có thể gọi hai công cụ `scan_form` và `fill_form` để quét và điền form trên tab đang mở. Kết nối trình duyệt qua Chrome DevTools Protocol (cổng `9222`), không đi qua extension.
- `shared/prompt.js`: chỉ dẫn AI dùng chung cho cả extension lẫn MCP server.
- README bổ sung mục MCP: cơ chế hoạt động, cách đăng ký server, mô tả đầy đủ tham số của từng tool (kể cả `targetUrl`), và cảnh báo bảo mật khi mở cổng gỡ lỗi 9222.

### Changed (Thay đổi)
- `buildPrompt()` chuyển từ `src/background.js` sang `shared/prompt.js`; cả hai đường chạy cùng import một nguồn, không còn hai bản prompt song song dễ lệch nhau.
- Nâng `@modelcontextprotocol/sdk` lên `^1.30.0` và `chrome-remote-interface` lên `^0.34.0`.

### Fixed (Sửa lỗi)
- Prompt bản MCP chép sai quy tắc 8 (`Giá trị BẤT KỲ` thay vì `Giá trị BẮT BUỘC`), làm mất ràng buộc "phải chọn đúng một mục có trong danh sách".
- Lỗ hổng GHSA-w48q-cv73-mx4w (mức cao) từ `@modelcontextprotocol/sdk` phiên bản cũ.
- Tài liệu trước đó ghi hỗ trợ **Firefox / Zen Browser**, nhưng `manifest.json` dùng `background.service_worker` (MV3 của Firefox không nhận) và MCP server dùng CDP (Firefox không có). Đã gỡ hướng dẫn Firefox và `moz-extension://*`, ghi rõ giới hạn.

## [1.1.0] - 2026-06-08

### Added (Thêm mới)
- Hỗ trợ widget dạng ARIA của **Google Forms**: ô lựa chọn `role="radio"`/`role="radiogroup"` và dropdown `role="listbox"`/`role="option"`.
- So khớp không phân biệt dấu tiếng Việt (bỏ dấu, `đ`→`d`) cho cả nhãn ô lẫn lựa chọn.
- Gợi ý ngữ nghĩa trong prompt: phân biệt Địa chỉ vs Quê quán, xử lý ô ghép như "Khoa/Ngành".

### Changed (Thay đổi)
- **Model khuyến nghị tối thiểu đổi từ `qwen2.5:3b` sang `qwen2.5:7b`** để tăng độ chính xác (chép đúng nguyên văn, ít điền nhầm ô). README bổ sung bảng chọn model theo cấu hình máy.
- Siết prompt AI: bắt copy nguyên văn giá trị, cấm ghép nhiều thông tin, cấm điền chéo sai ô.
- Chọn mục dropdown Google Forms bằng **native click** + thử lại tối đa 3 lần và xác minh đã chọn (khắc phục lỗi mở được danh sách nhưng không chọn được).

### Fixed (Sửa lỗi)
- Lỗi không điền được ô Mã số sinh viên và Giới tính trên Google Forms (do trước đây chỉ quét ô `<input>` chuẩn).
- Lỗi Ollama trả 403: thêm hướng dẫn đặt `OLLAMA_ORIGINS`.

## [1.0.0] - 2026-06-07

### Added (Thêm mới)
- Phiên bản phát hành đầu tiên.
- Popup quản lý nhiều hồ sơ người dùng (tạo / sửa / xóa), lưu bằng `chrome.storage`.
- Bộ trường gợi ý sẵn cho hồ sơ sinh viên (họ tên, MSSV, lớp, khoa, ngày sinh...).
- Content script quét form: nhận diện ô text, select, radio, checkbox, date; tự đọc nhãn từ `<label>`, `aria-label`, placeholder và văn bản lân cận.
- Tích hợp Ollama qua service worker: gọi `/api/chat` với model mã nguồn mở chạy local để map dữ liệu hồ sơ vào từng ô theo ngữ nghĩa.
- So khớp mềm cho dropdown/radio và chuẩn hóa định dạng ngày.
- Tô viền các ô đã điền để người dùng rà soát trước khi gửi.
- Nút kiểm tra kết nối Ollama và hiển thị danh sách model.
- Trang form mẫu trong `demo/` để thử nghiệm.

[1.2.0]: https://github.com/huynhpham13790-rgb/smartfill-ai/releases/tag/v1.2.0
[1.1.0]: https://github.com/huynhpham13790-rgb/smartfill-ai/releases/tag/v1.1.0
[1.0.0]: https://github.com/huynhpham13790-rgb/smartfill-ai/releases/tag/v1.0.0
