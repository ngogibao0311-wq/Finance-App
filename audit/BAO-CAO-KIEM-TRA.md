# Báo cáo rà soát FinDash — 03/10/2026

> Đây là báo cáo tại thời điểm trước sửa. Ngày 04/10/2026 đã sửa nhóm cơ chế không nhất quán; xem [thay đổi và các giới hạn còn lại](THAY-DOI-2026-10-04.md). Không dùng danh sách dưới đây như trạng thái hiện tại của mọi lỗi.

## Kết luận và phạm vi

Phát hiện 15 vấn đề cần xử lý trong bảo mật, lưu trữ và logic nghiệp vụ. P1 = ưu tiên cao do sai tiền, mất dữ liệu hoặc thực thi mã; P2 = lỗi chức năng/độ tin cậy cần sửa tiếp. Đây là rà soát mã nguồn và kiểm tra logic cô lập, không phải chứng nhận ứng dụng an toàn.

Đã kiểm tra cấu trúc HTML, các điểm đọc/ghi dữ liệu, Private Mode, Firebase, nhập/xuất Excel, tính số dư, chỉnh sửa giao dịch, ví, phí và lịch vay. Mã ứng dụng không bị chỉnh sửa. Không truy cập tài khoản, dữ liệu trình duyệt hay Firebase thật. Không có cấu hình Database Rules, backend, bộ kiểm thử hoặc manifest phụ thuộc trong thư mục được cung cấp; chưa xác minh quyền truy cập Firebase, cấu hình máy chủ, hành vi trên trình duyệt thật hay CVE của CDN.

`node audit/reproduce.cjs` tái hiện 8 trường hợp bằng dữ liệu giả và bộ lưu trữ giả. Các script thường qua kiểm tra cú pháp Node; Firebase qua kiểm tra riêng ở chế độ ES module. Kiểm tra cú pháp không xác nhận các thư viện CDN tải được khi chạy thực tế.

## Các phát hiện

### 1. [P1] Private Mode không mã hóa dữ liệu đang lưu

Vị trí: `js/3-storage.js:102`, `js/3-storage.js:157`; đối chiếu `js/2-security.js:175`.

`save()` ghi trực tiếp object vào IndexedDB, `saveToCloud()` gửi object tài chính thẳng cho Firebase. Không gọi `security.encrypt()`; luồng tải cũng không gọi `decrypt()`. Bật PIN chỉ chặn giao diện lúc khởi động. Bản ghi và bản cloud vẫn đọc được nếu truy cập được bộ lưu trữ, trái với mô tả “giải mã dữ liệu” và “AES-256”. Đã tái hiện cả hai đường ghi.

Sửa: thiết kế một lớp serialization/mã hóa chung cho lưu và tải; có quy trình chuyển đổi dữ liệu cũ, đổi/tắt mật khẩu và khôi phục an toàn. PIN bốn số chỉ có 10.000 khả năng; MD5 không muối và AES dùng PIN trực tiếp không đủ bảo vệ bản sao bị lấy cắp. Cần mật khẩu đủ mạnh, KDF phù hợp và mã hóa có xác thực nếu mục tiêu là bảo mật dữ liệu thực sự.

### 2. [P1] XSS lưu trữ qua dữ liệu nhập, và HTML từ AI không được làm sạch

Vị trí: `js/5-ui.js:3486`, `js/5-ui.js:3708`, `js/5-ui.js:9401`; `js/6-main.js:3666`, `js/6-main.js:3773`.

Tên giao dịch, thương hiệu, nguồn tiền, tên ví/chủ ví được nội suy vào `innerHTML`; câu hỏi và câu trả lời AI vào `insertAdjacentHTML`. Excel/Cloud có thể đưa nội dung do bên khác tạo vào các trường này. Nội dung HTML có event handler sẽ chạy với quyền của trang, từ đó đọc dữ liệu tài chính/API key hoặc sửa dữ liệu. Việc escape ở vài popup riêng không bảo vệ các sink còn lại.

Kiểm tra đã xác nhận chuỗi `<b data-audit=marker>MARKER</b>` từ tên ví đi nguyên vẹn vào HTML; không thực thi payload độc hại. Sửa bằng `textContent` và DOM API cho dữ liệu thường; nếu cần HTML phong phú, dùng sanitizer có allowlist. Loại bỏ nội suy dữ liệu vào inline handler.

### 3. [P1] Ví điện tử không tồn tại sau khi tải lại và không có trong backup

Vị trí: `js/5-ui.js:9489`, `js/3-storage.js:57`, `js/3-storage.js:114`, `js/6-main.js:2413`.

Giao diện thêm ví vào `app.data.wallets`, nhưng cấu trúc khởi tạo, migration, lưu/tải IndexedDB, Cloud và backup Excel chỉ có `cashWallets`, không có `wallets`. Gọi `save()` vẫn hiện thành công nhưng chỉ giữ ví trong RAM. Đã xác nhận dữ liệu ví không xuất hiện trong các bản ghi hoặc payload Cloud.

Sửa: bổ sung `wallets` xuyên suốt schema, migration, local, Cloud và Excel; kiểm tra vòng thêm → lưu → tải lại → xuất → nhập.

### 4. [P1] Thu nhập bị trừ khỏi số dư tài khoản

Vị trí: `js/4-logic.js:4889`, `js/4-logic.js:4919`, `js/5-ui.js:9205`.

Các hàm tính số dư trừ mọi giao dịch có `source` khớp tài khoản mà không xét `type`. Trong khi đó giao dịch thu nhập cũ, dữ liệu mẫu và luồng tạo khoản vay dùng `source` làm nơi nhận tiền, không có `destination`. Bảng lịch sử còn hiển thị loại dữ liệu này là tiền vào (`js/5-ui.js:3666`).

Đã tái hiện: tài khoản VCB ban đầu 0, thu nhập đã thanh toán 1.000.000 có `source=VCB`, không có destination → số dư -1.000.000 thay vì +1.000.000. Sửa bằng quy tắc dòng tiền chung có xét loại giao dịch, đồng thời migrate dữ liệu cũ.

### 5. [P1] Sửa giao dịch có cashback tạo thêm khoản hoàn tiền mỗi lần lưu

Vị trí: `js/6-main.js:1430`, `js/6-main.js:1455`.

Sau cả nhánh thêm và nhánh sửa, nếu còn bật cashback và có giảm giá, mã luôn tạo `cashbackData` với ID mới rồi `push`. Không có liên kết về giao dịch gốc để cập nhật khoản hoàn cũ. Sửa tên giao dịch hoàn 20.000 rồi lưu lại sẽ thêm một khoản thu 20.000 nữa; bỏ cashback cũng không xóa khoản hoàn cũ.

Sửa: lưu `originalTransactionId`, upsert một khoản hoàn duy nhất cho mỗi giao dịch và đồng bộ khi sửa/hủy. Đây là kết luận theo luồng mã, chưa chạy giao diện.

### 6. [P1] Lưu chỉnh sửa làm mất các cờ nghiệp vụ không có trong form

Vị trí: `js/6-main.js:834`, `js/6-main.js:1331`, `js/6-main.js:1424`.

Mã dựng object `data` mới, bảo lưu một số thuộc tính rồi thay hoàn toàn `app.data.transactions[idx]`. Các cờ như `excludeFromBudget`, `excludeFromDashboard`, `assignedToMonthlyLimit` không được bảo lưu ở đường sửa thông thường. Chỉ sửa nội dung cũng có thể đưa khoản đã loại trừ trở lại tổng tiền hoặc phá liên kết thu nhập đã khớp.

Sửa: tạo dữ liệu mới từ bản gốc và áp dụng các trường được phép sửa, có xử lý rõ các thuộc tính phải xóa khi đổi loại/trạng thái. Kiểm thử việc sửa tên không làm thay đổi các tổng nghiệp vụ.

### 7. [P1] Cho phép giảm giá vượt số tiền gốc và lưu chi tiêu âm

Vị trí: `js/6-main.js:787`, `js/6-main.js:797`, `js/6-main.js:839`.

Không có chặn `discountMoney > originalAmount`, phần trăm >100 hay `finalAmount < 0` trước khi lưu. Ví dụ giá gốc 100.000, giảm 200.000đ → chi tiêu -100.000; phép trừ tiền chi ở hàm số dư thành cộng tiền.

Sửa: kiểm tra số hữu hạn, giới hạn tiền và giảm giá ngay tại điểm mutation; quy định riêng cho trường hợp giao dịch 0đ hợp lệ. Không dựa vào `onkeyup` để kiểm tra dữ liệu.

### 8. [P1] Lưu nhiều nhóm dữ liệu không nguyên tử, lỗi ghi bị giấu

Vị trí: `js/3-storage.js:102`, `js/3-storage.js:265`.

Một thao tác lưu mở tám giao dịch IndexedDB riêng, không trả Promise cho caller; lỗi chỉ được log. Thanh toán trả góp vừa thêm giao dịch vừa tăng `payment.paidAmount`: nếu một nhóm ghi thành công và nhóm còn lại lỗi, trạng thái nợ lệch khỏi lịch sử tiền. UI có thể báo thành công trước khi ghi bền vững. Tải Cloud cũng ghi từng nhóm riêng nên lỗi giữa chừng để lại dữ liệu pha trộn.

Sửa: ghi snapshot trong một transaction `readwrite`, chờ `oncomplete`, xử lý cả abort, báo lỗi và không báo thành công trước commit. Kiểm thử lỗi dung lượng/abort giữa thao tác.

### 9. [P2] Migration xóa cấu hình trước khi sao chép

Vị trí: `js/3-storage.js:51`.

`localStorage.removeItem('fm_configs')` chạy trước vòng migration có chính key này. Ngân sách, lựa chọn người dùng và các cấu hình nghiệp vụ cũ mất theo token. Đã tái hiện cấu hình ngân sách tồn tại trước migration nhưng không được ghi vào IndexedDB.

Sửa: đọc cấu hình cũ, loại riêng các bí mật cần bỏ, ghi thành công rồi mới xóa nguồn. Giữ khả năng thử lại khi migration lỗi.

### 10. [P2] Số dư đầu kỳ bị tính chồng giao dịch trước ngày tạo tài khoản

Vị trí: `js/4-logic.js:4873`, `js/4-logic.js:4905`; đối chiếu `js/5-ui.js:8741`.

Ngân hàng/ví điện tử dùng mốc cố định 28/01/2026, dù có `createdAt` và người dùng nhập số dư hiện có khi tạo. Đã tái hiện: tạo tài khoản tháng 10 với số dư 1.000.000, một khoản chi 100.000 tháng 9 làm số dư mới còn 900.000. Ví tiền mặt đã có cách lọc theo ngày tạo nên các loại tài khoản còn không thống nhất.

Sửa: dùng ngày chốt số dư được lưu rõ ràng cho mỗi tài khoản; migrate các tài khoản đã dùng mốc cũ, tránh đổi mốc ngầm.

### 11. [P2] Trường hạn mức đang có không được sử dụng

Vị trí: `index.html:1190`, `js/5-ui.js:9472`.

`wallet-limit-current` có trên form nhưng không được đọc/lưu. Nhập tổng hạn mức 10 triệu và còn lại 8,5 triệu vẫn hiển thị khả dụng 10 triệu khi chưa có giao dịch. Đã tái hiện. Sửa: lưu trạng thái dư nợ/hạn mức đầu kỳ phù hợp với cách tính dòng tiền, tránh cộng chồng lịch sử.

### 12. [P2] Giao dịch MoMo dự kiến sinh phí phải trả

Vị trí: `js/4-logic.js:4476`.

`hasMomoSpending` loại `cancelled` nhưng không loại `planned`, trong khi nhánh Zalo có loại cả hai. Đã tái hiện chỉ một giao dịch MoMo dự kiến cũng sinh phí 33.000 ở trạng thái `pending`. Sửa: dùng tiêu chí phát sinh nghĩa vụ chung; kiểm tra planned → pending/paid và hủy giao dịch cuối cùng.

### 13. [P2] Nhập Excel cập nhật một phần có thể ghi đè các trường bỏ trống

Vị trí: `js/6-main.js:2956`, `js/6-main.js:3010`, `js/6-main.js:3187`.

Merge được thiết kế để ô trống không xóa dữ liệu cũ, nhưng `normalizeTransaction` điền mặc định trước merge: amount=0, type=Chi tiêu, status=paid, place=Nhập từ Excel, source=Không xác định, date=hiện tại. File chỉ chứa ID và nội dung muốn sửa có thể đổi số tiền, trạng thái và ngày của giao dịch cũ. Chuỗi ngày sai cũng bị thay bằng ngày hiện tại thay vì báo lỗi.

Sửa: phân biệt tạo mới với patch theo ID, giữ trạng thái “không cung cấp”, kiểm tra schema và đưa ra bản xem trước thay đổi trước khi commit.

### 14. [P2] Chỉnh sửa giao dịch vay làm lịch trả sớm một tháng

Vị trí: `js/5-ui.js:7776`, `js/6-main.js:1501`.

Tạo khoản vay dùng tháng hiện tại + i + 1, còn đồng bộ lịch khi lưu giao dịch vay dùng tháng của giao dịch + period. Kỳ đầu khoản vay tháng 10 lúc tạo là ngày 7/12; chỉ mở giao dịch vay lưu lại, không đổi ngày, lịch thành 7/11. Việc ghép khoản vay theo tên người cho vay và số tiền còn có thể chọn nhầm khi có hai khoản giống nhau.

Sửa: dùng một hàm tạo lịch duy nhất và liên kết giao dịch với loan ID ổn định. Quy tắc kỳ đầu T+1 hay T+2 cần được quyết định một lần cho cả hai đường.

### 15. [P2] Cloud ghi đè toàn bộ snapshot, không phát hiện xung đột

Vị trí: `js/firebase-cloud.js:70`, `js/3-storage.js:213`.

Firebase `set` thay toàn bộ `financeData`; `updatedAt` chỉ là dữ liệu và không được so sánh trước ghi. Thiết bị B giữ bản cũ có thể bấm lưu và xóa cập nhật mới từ A. Tải Cloud thay ngay dữ liệu local mà không kiểm tra thay đổi chưa sao lưu hoặc giữ bản phục hồi.

Sửa: version/revision với kiểm tra xung đột phía server, cùng snapshot phục hồi trước thao tác thay thế. Nếu giữ mô hình backup thủ công, giao diện cần hiển thị thời điểm/bản đang ghi đè và cho xem trước hậu quả.

## Những điểm cần xác minh thêm

- Firebase Database Rules không nằm trong workspace: chưa kết luận người ngoài có đọc/ghi được. UID trong đường dẫn và API key công khai không tự chứng minh có hoặc không có lỗ hổng phân quyền.
- Reset gọi `deleteDatabase` nhưng không chờ success/error/blocked; `openDB` không đóng kết nối. Cần kiểm thử thật với nhiều tab và kết nối đang mở trước khi tin thông báo reset thành công.
- Chu kỳ nợ, lãi/phạt và các ngoại lệ tháng cố định cần đối chiếu yêu cầu nghiệp vụ; chưa xác nhận chính sách tài chính của nhà cung cấp.
- Nguồn tiền được ghép theo tên thay vì ID tài khoản: cần kiểm thử trùng tên, đổi tên và nhiều tài khoản cùng ngân hàng.
- Khoản vay cho nhập số kỳ âm hoặc quá lớn vì chỉ dùng `parseInt(val) || 1`; cần giới hạn số nguyên dương và kiểm thử dữ liệu bất thường.
- Thư viện CDN không có integrity; Chart.js không ghim phiên bản. Chưa kiểm toán lỗ hổng từng phiên bản phụ thuộc.

## Thứ tự xử lý đề xuất

1. Sửa XSS và làm rõ/hoàn thiện Private Mode; bổ sung lưu ví và cơ chế ghi nguyên tử.
2. Sửa số dư, cashback trùng, mất metadata khi sửa và số tiền âm.
3. Sửa migration, nhập Excel, lịch vay, phí dự kiến và xung đột Cloud.
4. Chạy kiểm thử trình duyệt với dữ liệu giả, kiểm thử phục hồi backup và kiểm thử Rules trên môi trường Firebase được phép. Đối chiếu tổng sổ giao dịch với tổng số dư và dư nợ sau mỗi thao tác.
