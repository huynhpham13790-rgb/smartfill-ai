<!--
  SmartFill AI - docs/AI.md
  Copyright (c) 2026 Phạm Văn Huynh
  SPDX-License-Identifier: MIT
-->

# Tài liệu kỹ thuật: phần AI của SmartFill

Tài liệu này mô tả AI được tích hợp như thế nào, vì sao chọn từng thiết kế, và
kết quả đo được. Mọi con số dưới đây tái lập được bằng `npm test`.

## 1. Vì sao là mô hình chạy local

SmartFill xử lý dữ liệu cá nhân: họ tên, ngày sinh, số điện thoại, địa chỉ, mã
sinh viên. Gửi những thứ này lên API đám mây là điều không cần thiết cho một bài
toán chỉ cần ghép nhãn với giá trị. Vì vậy toàn bộ suy luận chạy trên máy người
dùng qua [Ollama](https://ollama.com), mặc định `qwen2.5:7b` — mô hình mở, hỗ
trợ tiếng Việt tốt, chạy được trên máy 8 GB RAM.

Hệ quả: **không có byte dữ liệu hồ sơ nào rời khỏi máy**, và extension vẫn dùng
được khi mất mạng.

## 2. Hai đường chạy độc lập

Cùng một prompt (`shared/prompt.js`) phục vụ hai đường:

| Đường | Điểm vào | Cách chạm tới trang |
|---|---|---|
| Extension | `popup` → `src/background.js` → `src/content.js` | content script trong trang |
| MCP server | `mcp-server/index.js` | Chrome DevTools Protocol, cổng 9222 |

Prompt nằm ở một chỗ duy nhất là có chủ ý: trước đây hai bản sao đã âm thầm lệch
nhau ở quy tắc số 8, khiến hai đường cho kết quả khác nhau trên cùng một form.

## 3. Thiết kế prompt

Đầu vào là hồ sơ (cặp khóa–giá trị) và danh sách ô đã được `scanFields()` rút
gọn thành `{fid, nhãn, loại, lựa_chọn_có_sẵn?}`. Ba lựa chọn quan trọng:

- **`format: "json"` + `temperature: 0`.** Việc điền form không cần sáng tạo;
  cần lặp lại được. Nhiệt độ 0 cho cùng đầu vào ra cùng đầu ra.
- **Ràng buộc "copy nguyên văn".** Mô hình 7B rất hay "sửa cho đẹp" tên riêng
  tiếng Việt (`Phạm Văn Huynh` → `Hynh`). Quy tắc 1 cấm điều đó tuyệt đối.
- **Cho phép bỏ trống.** Quy tắc 6 nói rõ: không có dữ liệu phù hợp thì bỏ qua ô
  đó. Một ô trống là phiền; một ô điền sai là nguy hiểm, vì người dùng dễ bấm gửi
  mà không đọc lại.

Với ô có `lựa_chọn_có_sẵn`, giá trị bắt buộc phải là một mục copy nguyên văn từ
danh sách. Lớp `matchOption()` / `bestMatchIndex()` trong `content.js` vẫn khớp
mềm thêm một lần (bỏ dấu, khớp một phần) để chịu được sai lệch nhỏ.

## 4. Bộ luật dự phòng

`shared/fallback.js` ánh xạ hồ sơ vào form **không cần AI**, bằng bảng từ đồng
nghĩa cho 11 khái niệm (họ tên, MSV, lớp, khoa, ngành, ngày sinh, giới tính,
email, điện thoại, quê quán, địa chỉ).

Nó chạy khi Ollama không phản hồi — chưa cài, chưa chạy, hoặc thiếu model. Trước
đây trường hợp đó làm extension chết hoàn toàn.

Hai chi tiết đáng chú ý trong cách khớp:

- **Ưu tiên từ đồng nghĩa dài nhất.** `"Địa chỉ email"` chứa cả `"địa chỉ"` và
  `"email"`; chuỗi dài hơn (`"địa chỉ email"`) thắng, nên ô này ra email chứ
  không ra địa chỉ nhà.
- **Bắt buộc ranh giới từ.** Nếu chỉ dùng `includes()`, `"khoa"` sẽ khớp vào
  `"số tài khoản ngân hàng"` và điền tên khoa vào ô số tài khoản. Lỗi này do
  benchmark phát hiện ở lần chạy đầu tiên, không phải do đọc code.

## 5. Đo độ chính xác

`tests/benchmark.mjs` chạy cả hai đường trên 4 form cố định (16 ô có đáp án) mô
phỏng: nhãn tiếng Việt đầy đủ, nhãn viết tắt/tiếng Anh, ô có lựa chọn sẵn, và
các bẫy (ô không có trong hồ sơ, nhãn dễ nhầm).

Cách chấm phân biệt bốn loại lỗi, vì chúng không nghiêm trọng như nhau:

| Loại | Ý nghĩa |
|---|---|
| sai | ô có đáp án nhưng giá trị khác — nguy hiểm nhất với người dùng |
| thiếu | ô có đáp án mà không được điền — phiền nhưng an toàn |
| bịa | ô có thật, lẽ ra bỏ trống, nhưng bị điền |
| fid lạ | model trả về ô không tồn tại trên form |

### Kết quả đo ngày 03/09/2026

Trên bộ form thường (`fixtures/forms.json`, 16 ô):

```
Bộ luật dự phòng    16/16 đúng (100%), 0 sai, 0 thiếu, 0 bịa, 0 fid lạ
AI qua qwen2.5:7b   16/16 đúng (100%), 0 sai, 0 thiếu, 1 bịa, 0 fid lạ
```

Hai đường ngang nhau — nhưng đó là vì bộ form này viết nhãn đúng theo kiểu mà
bảng từ đồng nghĩa đã biết trước. Đo như vậy không nói lên điều gì về giá trị
của AI, nên có thêm bộ form khó (`fixtures/forms-hard.json`, 12 ô): dropdown chỉ
có mã viết tắt, họ và tên tách hai ô, giá trị phải suy ra từ trường khác, form
tiếng Anh dùng cách gọi lạ, và nhãn viết thành câu hỏi tự nhiên.

```
Bộ luật dự phòng     1/12 đúng (8.3%),  3 sai, 8 thiếu, 0 bịa, 0 fid lạ
AI qua qwen2.5:7b    7/12 đúng (58.3%), 5 sai, 0 thiếu, 0 bịa, 0 fid lạ
```

Đây mới là bức tranh thật, và nó nói hai điều.

**Một: AI mở rộng phạm vi form dùng được.** Bảng từ đồng nghĩa chỉ khớp được
những cách viết đã liệt kê sẵn; gặp `"Đơn vị đào tạo"` với lựa chọn `"CNTT"`,
hay `"Chúng tôi nên gọi bạn là gì?"`, nó bó tay. Muốn bộ luật theo kịp thì phải
liệt kê vô hạn cách người ta có thể đặt nhãn — đúng thứ mà mô hình ngôn ngữ
sinh ra để giải.

**Hai: hai đường sai theo hai kiểu khác nhau, và khác biệt đó quan trọng hơn con
số phần trăm.** Bộ luật sai chủ yếu bằng cách **bỏ trống** (8 thiếu / 3 sai): nó
không khớp được thì không điền. AI **không bao giờ bỏ trống** (0 thiếu / 5 sai):
nó luôn đưa ra một đáp án, kể cả khi đáp án đó sai — điền số điện thoại vào ô
hỏi cách liên hệ, hay cắt `"Phạm Văn Huynh"` thành `"Văn"`.

Với người dùng, một ô trống là phiền; một ô điền sai mà vẫn trông hợp lý thì
nguy hiểm hơn nhiều, vì rất dễ bấm gửi mà không đọc lại. Đó chính là lý do có
tính năng **xem trước** và **hoàn tác**, chứ không phải để trang trí.

### Vì sao AI vẫn trượt 5 ô

Bốn trong năm ô sai đến từ việc phải **biến đổi** giá trị: tách họ khỏi tên, lấy
năm từ ngày sinh đầy đủ. Quy tắc 1 của prompt cấm tuyệt đối việc sửa đổi giá trị
lấy từ hồ sơ, vì chính quy tắc đó ngăn mô hình 7B viết sai tên riêng tiếng Việt.
Nói cách khác đây là **đánh đổi có chủ ý**, không phải lỗi: chúng tôi chọn mất
mấy ô cần biến đổi để không bao giờ điền sai chính tả tên người dùng.

Nới quy tắc 1 để cho phép tách tên là hướng cải tiến rõ ràng nhất, nhưng phải đo
lại toàn bộ trước khi đổi.

Chạy lại:

```bash
npm test          # bộ form thường, chỉ bộ luật dự phòng, không cần Ollama
npm run test:ai   # bộ form thường, thêm đường AI, cần Ollama đang chạy
npm run test:hard # bộ form khó, cả hai đường
```

`npm test` thoát với mã khác 0 nếu bộ luật dự phòng tụt dưới 100%, nên dùng được
trong CI mà không cần GPU.

### Hai hành vi đã quan sát được của qwen2.5:7b

- **Trả `"false"` cho checkbox.** Đây là điểm "bịa" duy nhất ở trên. Quy tắc 4
  của prompt cho phép, nên không phải lỗi; bộ luật dự phòng thì bỏ qua checkbox
  để người dùng tự tick. Chúng tôi giữ nguyên fixture thay vì nới đáp án, để
  khác biệt giữa hai đường luôn hiện ra trong báo cáo.
- **Bịa thêm `fid` khi prompt cho hồ sơ nhiều hơn số ô.** Ở một phiên bản
  benchmark trước, model tự sinh `f5`–`f10` cho form chỉ có `f0`–`f4`. Vô hại vì
  `applyMapping()` tra theo `fid` có thật và bỏ qua phần thừa — nhưng đây chính
  là lý do việc tra cứu đó phải giữ nguyên, đừng đổi sang duyệt theo thứ tự.

## 6. Nạp hồ sơ từ CV

Người dùng vẫn phải gõ tay từng trường vào popup. Tính năng "Nạp hồ sơ từ CV"
rút ngắn việc đó: chọn một tệp `.pdf`, `.txt` hoặc `.md`, extension trích văn bản
rồi nhờ chính mô hình local rút ra các trường hồ sơ.

Prompt (`buildCvPrompt` trong `shared/cv.js`) giữ nguyên hai ràng buộc quan trọng
nhất của prompt điền form: copy nguyên văn, và bỏ qua thay vì bịa. Có thêm một
quy tắc riêng cho CV: chỉ lấy thông tin của **chủ nhân CV**, bỏ qua tên người
tham chiếu, tên công ty, tên trường — vì CV có rất nhiều tên riêng không phải của
người viết.

Giá trị trích ra chỉ điền vào những ô **đang trống**; thứ người dùng đã tự nhập
không bao giờ bị ghi đè.

### Đọc PDF không dùng thư viện

Extension không được thêm phụ thuộc, nên phần đọc PDF viết tay, dựa vào
`DecompressionStream` có sẵn của trình duyệt để giải nén luồng `FlateDecode`,
rồi bóc chuỗi từ các toán tử `Tj`/`TJ` trong content stream.

Cách này **chỉ chạy với PDF dùng font chuẩn**. PDF xuất từ Word hay LaTeX với
font tiếng Việt nhúng lưu chữ dưới dạng **mã glyph riêng của font**, không phải
mã Unicode. Chúng tôi có đọc thêm bảng `ToUnicode` để dịch ngược, nhưng vẫn
không đủ cho mọi tệp: thử trên một văn bản hành chính tiếng Việt thật, kết quả
vẫn là chuỗi rác.

Vì vậy có hàm `looksReadable()` chấm tỉ lệ ký tự hợp lệ trước khi gửi cho AI.
Không đạt ngưỡng thì extension **từ chối và hướng dẫn người dùng copy nội dung
PDF ra tệp `.txt`**, thay vì đưa rác cho mô hình đoán mò rồi sinh ra hồ sơ sai.

Đây là đánh đổi có ý thức: đọc được mọi PDF thì phải nhúng một thư viện như
pdf.js, kéo theo việc phải khai báo và bảo trì gói đính kèm. Chúng tôi chọn giữ
extension không phụ thuộc, và nói thật với người dùng khi không đọc được.

`tests/cv.test.mjs` kiểm 14 điểm: trích đúng 5 trường từ PDF mẫu, giữ xuống dòng,
nhận ra chuỗi rác, và các ràng buộc của prompt.

## 7. Giới hạn đã biết

- Chưa đo trên Google Forms thật, vì widget ARIA khiến việc dựng fixture ổn định
  rất khó. Đường ARIA hiện chỉ được kiểm bằng tay.
- Bộ luật dự phòng chỉ biết 11 khái niệm trong ngữ cảnh hồ sơ sinh viên; form
  ngoài phạm vi đó vẫn cần AI.
- Fixture dùng một hồ sơ duy nhất, nên đo được độ chính xác ánh xạ chứ chưa đo
  được độ bền trước hồ sơ khuyết thiếu nhiều trường.
- Đọc PDF chỉ chạy với font chuẩn; PDF font nhúng tiếng Việt bị từ chối có kiểm
  soát chứ chưa đọc được (xem mục 6).
