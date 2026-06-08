# Changelog

Tất cả thay đổi đáng chú ý của dự án được ghi lại trong tệp này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/),
và dự án tuân theo [Semantic Versioning](https://semver.org/lang/vi/).

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

[1.1.0]: https://github.com/phamvanhuynh/smartfill-ai/releases/tag/v1.1.0
[1.0.0]: https://github.com/phamvanhuynh/smartfill-ai/releases/tag/v1.0.0
