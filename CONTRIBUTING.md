<!--
  SmartFill AI - CONTRIBUTING.md
  Copyright (c) 2026 Phạm Văn Huynh
  SPDX-License-Identifier: MIT
-->

# Hướng dẫn đóng góp

Cảm ơn bạn đã quan tâm tới SmartFill AI. Tài liệu này mô tả cách báo lỗi, cách
dựng dự án từ mã nguồn, và những quy ước cần theo khi gửi thay đổi.

## Báo lỗi và đề xuất

Dùng [GitHub Issues](https://github.com/huynhpham13790-rgb/smartfill-ai/issues).
Có sẵn mẫu cho báo lỗi và đề xuất tính năng.

**Quan trọng:** SmartFill làm việc với dữ liệu cá nhân. Khi dán log hoặc ảnh
chụp màn hình vào issue, hãy xóa họ tên, số điện thoại, email, mã sinh viên và
địa chỉ thật của bạn trước.

## Chuẩn bị môi trường

Yêu cầu: Node.js 18 trở lên, trình duyệt nhân Chromium, và
[Ollama](https://ollama.com) nếu muốn chạy phần AI.

```bash
git clone https://github.com/huynhpham13790-rgb/smartfill-ai.git
cd smartfill-ai
ollama pull qwen2.5:7b        # tùy chọn, chỉ cần cho đường AI
```

Extension không cần biên dịch — mã chạy thẳng trong trình duyệt. Chi tiết nạp
extension và đóng gói xem mục "Cài đặt và dịch từ mã nguồn" trong
[README.vi.md](README.vi.md).

## Chạy kiểm thử

```bash
npm test          # bộ luật dự phòng trên 4 form fixture, không cần Ollama
npm run test:ai   # thêm đường AI, cần Ollama đang chạy
```

`npm test` phải luôn đạt 100% và thoát với mã 0. Nếu bạn sửa `shared/fallback.js`
hoặc `shared/prompt.js`, hãy chạy cả hai lệnh và ghi kết quả vào phần mô tả PR.

Thêm form mới vào `tests/fixtures/forms.json` khi bạn sửa một lỗi ánh xạ — mỗi
lỗi đã sửa nên có một fixture giữ cho nó không quay lại.

## Quy ước mã nguồn

- Mỗi tệp mã mới bắt đầu bằng header bản quyền và `SPDX-License-Identifier: MIT`.
  Tệp JSON không có cú pháp chú thích, nên ghi giấy phép qua trường `"license"`.
- Bình luận viết bằng tiếng Việt, giải thích **vì sao** chứ không lặp lại **cái gì**.
- Thụt lề 2 dấu cách, dấu chấm phẩy cuối câu lệnh, dấu nháy kép cho chuỗi.
- Không thêm phụ thuộc mới vào extension. Extension phải chạy được chỉ với các
  API sẵn có của trình duyệt.

## Quy ước commit

Dùng tiền tố kiểu Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`,
`refactor:`, `chore:`. Viết ở thể mệnh lệnh và nói rõ tác động.

## Trước khi gửi Pull Request

1. Tạo nhánh từ `main`.
2. Chạy `npm test`.
3. Cập nhật `CHANGELOG.md` ở mục `[Chưa phát hành]`.
4. Điền đầy đủ mẫu PR.

## Giấy phép

Khi đóng góp, bạn đồng ý phát hành phần đóng góp đó theo
[Giấy phép MIT](LICENSE), giống phần còn lại của dự án.
