# HOTEL SƠN NGỌC

Ứng dụng quản lý phòng, đặt phòng, khách lưu trú, dịch vụ, phiếu thu và công nợ bằng React + TypeScript + Vite.

## Chạy dự án

Dùng Node.js 24 trở lên. Chế độ cục bộ không cần biến môi trường.

```powershell
npm ci
npm run dev
```

Mở `http://localhost:3000`; dev server dùng dữ liệu cục bộ. Bản build thông thường dùng API Supabase Sơn Ngọc đã triển khai:

```powershell
npm run build
npm run preview
```

Để chạy bản build cục bộ và kiểm tra tính năng offline, dùng `npm run build -- --mode local` trước khi chạy preview. Bản cloud cần mạng để đăng nhập và lưu dữ liệu chung.

## Kiểm tra

```powershell
npm run lint
npm test
npm run build
```

Khi dev server đang chạy, có thể kiểm tra mobile và các luồng nghiệp vụ bằng Chrome:

```powershell
npm run test:mobile
npm run test:flows
npm run test:prices
npm run test:booking-sales
npm run test:staff
npm run test:login
npm run test:install
```

Sau khi build bằng `npm run build -- --mode local` và chạy preview ở cổng 4173, `npm run test:production` kiểm tra service worker và các trang khi offline. Các kiểm thử trình duyệt tạo dữ liệu giả phải chạy trên dev server hoặc bản build cục bộ, không chạy trên API thật.
`npm run test:password` kiểm tra đổi mật khẩu, đăng nhập bằng mật khẩu mới, đăng xuất các tab khác, lỗi lưu và hoạt động ngoại tuyến trong một phiên thử nghiệm riêng.

Các kiểm thử trình duyệt dùng các phiên riêng có tên bắt đầu bằng `sonngoc-`. Kiểm thử luồng và mobile tạo dữ liệu giả trong những phiên này. Ảnh kiểm chứng được lưu ở `.review/`.

## Đăng nhập

Màn hình đăng nhập dùng mật khẩu hệ thống đã cấu hình. Có nút hiện/ẩn mật khẩu và đăng xuất ở menu. Phiên đăng nhập lưu trong `sessionStorage`, tối đa 12 giờ; đăng xuất giữ nguyên dữ liệu khách sạn. Mật khẩu được đối chiếu với PBKDF2-SHA256 có salt; mã app chỉ chứa giá trị băm, không chứa mật khẩu dạng rõ.

Ở chế độ cục bộ, đây là khóa truy cập cho dữ liệu trong trình duyệt; người có quyền truy cập công cụ phát triển hoặc bộ nhớ trình duyệt vẫn có thể can thiệp. Bản build cloud dùng máy chủ Supabase để xác thực, phân quyền và lưu dữ liệu chung.

Vào **Menu → Đổi mật khẩu**, nhập mật khẩu hiện tại, mật khẩu mới và xác nhận. Mật khẩu mới cần 8–128 ký tự, khác mật khẩu hiện tại và không có khoảng trắng ở đầu/cuối. Sau khi lưu thành công, cửa sổ hiện tại và các cửa sổ cùng trình duyệt đều cần đăng nhập lại. Việc đổi mật khẩu không thay đổi dữ liệu khách sạn.

Ở chế độ cục bộ, mật khẩu mới được lưu dưới dạng PBKDF2-SHA256 với salt ngẫu nhiên trong bản ghi `son_ngoc_login_credential_v1`. Mật khẩu áp dụng trên trình duyệt và địa chỉ app hiện tại, kể cả khi dùng ngoại tuyến; các thiết bị/trình duyệt khác chưa dùng chung mật khẩu. Bản cloud lưu chứng thực tại Supabase và áp dụng cho mọi thiết bị dùng cùng API. Không ghi mật khẩu vào bản sao lưu dữ liệu khách sạn. Nếu lưu thất bại, mật khẩu hiện tại giữ nguyên. Nếu bản ghi mật khẩu bị lỗi, app giữ nguyên bản ghi và không tự quay về mật khẩu ban đầu.

Bộ kiểm tra đăng nhập có thêm một chứng thực cố định độc lập, chỉ lưu giá trị băm PBKDF2 với salt riêng. Mục đổi mật khẩu chỉ cập nhật mật khẩu chính. Chứng thực cố định không có giá trị hiển thị, gợi ý hoặc thiết lập sửa trong giao diện; cũng có thể dùng để xác nhận thay đổi mật khẩu chính. Không lưu giá trị gốc vào mã nguồn, tài liệu, bản sao lưu hoặc dữ liệu trình duyệt. Mã frontend chứa bộ kiểm tra băm nên vẫn không thay thế xác thực phía máy chủ.

Các kiểm thử chứng thực cố định nhận đầu vào tạm thời qua biến môi trường `SON_NGOC_FIXED_TEST_PASSWORD`; không ghi giá trị vào `.env` hoặc fixture. `node scripts/check-private-credential.mjs` kiểm tra mã nguồn và bản build khi có đầu vào đó.
Các kiểm thử trình duyệt và kiểm thử chứng thực ban đầu nhận mật khẩu chính qua `SON_NGOC_PRIMARY_TEST_PASSWORD`. Không ghi mật khẩu thật vào mã nguồn; các kiểm thử nghiệp vụ đổi mật khẩu dùng chứng thực giả riêng. Đặt biến tạm trong phiên shell trước khi chạy, rồi xóa biến sau khi xong.

## Phân quyền lễ tân

Đăng nhập quản lý rồi vào **Menu → Phân quyền lễ tân** để tạo tài khoản riêng bằng tên đăng nhập và mật khẩu. Chọn mẫu **Chỉ xem** hoặc **Lễ tân nghiệp vụ**, rồi bật/tắt quyền xem từng mục và quyền thao tác. Lễ tân chọn **Lễ tân** trên màn hình đăng nhập. Không có tài khoản lễ tân mặc định.

Mặc định lễ tân được xem phòng, lịch đặt, khách đang ở, bảng giá và phiếu thu bán lẻ của mình; được đặt/nhận/trả phòng, cập nhật khách đi cùng, thêm dịch vụ, cập nhật dọn phòng và bán vé. Doanh thu tổng, công nợ, sửa giá, xóa phòng/dịch vụ và xuất dữ liệu cần quyền riêng. Quyền xem phòng/lịch/khách bao gồm dữ liệu liên quan để kiểm tra phòng còn trống và xử lý lưu trú. Trang chủ bao gồm thống kê tài chính.

- Xóa phòng chỉ khi chưa có bất kỳ lượt ở, phiếu đặt, phiếu thu hoặc công nợ liên quan, kể cả lịch sử.
- Xóa dịch vụ chỉ khi chưa được sử dụng trong lượt ở hoặc phiếu thu. Xóa dịch vụ đang ghi vào phòng chỉ áp dụng trước khi thanh toán và cần quyền riêng.
- Phiếu đã hủy, không có cọc và chưa nhận phòng có thể **Lưu trữ**. Phiếu vẫn nằm trong dữ liệu, bản sao lưu và có thể xem lại bằng **Hiện phiếu đã lưu trữ**.
- Không xóa lịch sử khách, phiếu thu, thanh toán hay công nợ qua thao tác nghiệp vụ. Lễ tân không được quản lý tài khoản hoặc khôi phục bản sao lưu.

Khóa tài khoản hoặc sửa quyền/mật khẩu làm hết hiệu lực phiên lễ tân cũ. Mỗi tài khoản tự đổi mật khẩu của mình; không thay mật khẩu quản lý hoặc chứng thực cố định. Mật khẩu tài khoản được băm PBKDF2 và không đưa vào bản sao lưu khách sạn. Biểu mẫu cũ không ghi đè quyền vừa cập nhật ở cửa sổ khác.

Chế độ cục bộ lưu tài khoản và quyền ở trình duyệt hiện tại; người kiểm soát bộ nhớ hoặc mã trình duyệt vẫn có thể can thiệp. Khi triển khai Supabase, API kiểm tra tài khoản và quyền phía máy chủ cho mọi thao tác, lọc dữ liệu trả về, giữ lại các bản ghi ngoài quyền xem khi lưu, đồng thời chặn ghi đè giữa các thiết bị. Migration bổ sung ở `supabase/migrations/` áp dụng sau migration nền, không đặt lại dữ liệu hay mật khẩu quản lý.

## Giá phòng và thời gian

- Các ô đơn giá, tiền cọc, phụ thu và giảm giá nhận số nguyên VND, không ép theo bội số 5.000/10.000/50.000. Giá dịch vụ phải lớn hơn 0.
- Trong **Bảng giá & Dịch vụ → Cấu hình giá phòng → Sửa**, bật/tắt thuê theo giờ và đặt giờ nhận/trả chuẩn cho từng phòng.
- Phiếu đặt hỗ trợ theo đêm hoặc theo giờ; đơn giá được giữ tại thời điểm đặt.
- Giờ nhận thực tế được nhập khi check-in. Giờ trả thực tế có thể sửa khi tính tiền.
- Theo giờ: làm tròn lên mỗi giờ, tối thiểu 1 giờ. Theo đêm: chênh lệch ngày nhận/trả, tối thiểu 1 đêm. Phụ thu được nhập riêng.
- Doanh thu = tiền phòng + dịch vụ + phụ thu − giảm giá. Tiền cọc được khấu trừ vào số còn phải thanh toán, phần dư được ghi là tiền hoàn cho khách.
- Báo cáo thanh toán gồm cọc đã dùng và các khoản thu nợ cho những phiếu thu trong kỳ; đây không phải sổ thu tiền theo ngày giao dịch độc lập.

## Dữ liệu

### Đặt phòng theo lịch và khách mua dịch vụ lẻ

- Phòng N07 có thể nhận nhiều phiếu đặt vào hai tuần khác nhau. So sánh toàn bộ ngày **và giờ** nhận–trả; khoảng lưu trú giao nhau bị chặn trước khi lưu phiếu và cọc. Hai lịch nối tiếp đúng giờ trả/nhận được phép; lễ tân vẫn cần bố trí dọn phòng.
- Phiếu đặt hiển thị lịch giữ phòng, mã phiếu/khách gây trùng và trạng thái từng phòng theo khoảng thời gian chọn. Đổi phòng hoặc đổi ngày rồi kiểm tra lại. Hủy phiếu giải phóng lịch; nhận phòng loại trừ đúng phiếu đang chuyển và kiểm tra các phiếu khác.
- Khách đang ở quá giờ trả dự kiến phải được xác nhận trả phòng trước khi giữ lịch mới. Sơ đồ phòng hiển thị phiếu gần nhất theo thời gian nhận, thay vì phiếu mới nhập gần nhất.
- **Bán vé / khách ngoài**: thêm vé massage/dịch vụ, số lượng, giảm giá và phương thức thu. Không cần tạo phòng hay lượt ở. Lưu phiếu thu DV riêng, giữ đơn giá tại lúc bán, có chi tiết để xem/in. Thanh toán một phần tạo công nợ; cần tên và điện thoại khách. Doanh thu dịch vụ và báo cáo Excel/PDF bao gồm các phiếu thu này; công suất phòng không tính khách mua vé lẻ.

### Chế độ Supabase

Project đang dùng: **sonngochotel** (`lactqpzikjzhtqcfntko`), vùng Singapore. Các migration và Edge Function `hotel-api` đã triển khai. `.env.production` đặt URL công khai `https://lactqpzikjzhtqcfntko.supabase.co/functions/v1/hotel-api`, nên `npm run build` trên Vercel/Pages dùng cùng dữ liệu, mật khẩu và quyền lễ tân. **Không** đặt `service_role`, mật khẩu cơ sở dữ liệu hoặc khóa bí mật vào biến `VITE_`.

Máy chủ lưu chứng thực băm riêng, cấp token ngẫu nhiên có hạn 12 giờ; chỉ lưu băm token ở cơ sở dữ liệu. Đổi mật khẩu chính làm hết hiệu lực tất cả phiên máy chủ và giữ chứng thực cố định. RLS bật trên các bảng, `anon`/`authenticated` không có quyền đọc hay ghi trực tiếp. Edge Function dùng service role có sẵn trong môi trường Supabase sau khi xác thực token.

Mọi lần ghi dùng khóa giao dịch, phiên bản và mã thao tác chống ghi lặp. Hai thiết bị cùng giữ phòng: thiết bị ghi sau nhận lỗi, tải lại lịch và kiểm tra lại, không ghi đè cọc của thiết bị đầu. Ràng buộc GiST ở cơ sở dữ liệu chặn các khoảng lưu trú giao nhau. Khi mất mạng, app giữ dữ liệu đã xác nhận nhưng không báo lưu thành công; cần mạng để ghi dữ liệu chung. Không tự chuyển sang dữ liệu cục bộ khi máy chủ lỗi.

Chạy `npm run supabase:seed` để tạo `supabase/seed.sql`: 15 phòng trống, danh mục dịch vụ và chứng thực băm; không nạp khách/phiếu thu mẫu. Khởi tạo dùng `ON CONFLICT DO NOTHING`, không đặt lại mật khẩu hay ghi đè dữ liệu đã có. Dữ liệu cục bộ cũ vẫn được giữ trên thiết bị; muốn chuyển dữ liệu thật hãy tải bản sao lưu rồi khôi phục có xác nhận vào chế độ chung. Không tự nhập dữ liệu khách hàng lên cloud.

`npm run dev` và `npm run build -- --mode local` dùng dữ liệu cục bộ nếu không đặt `VITE_HOTEL_API_URL` trong môi trường chạy. Biến môi trường của nhà cung cấp có thể ghi đè URL trong `.env.production`; nếu cấu hình khác thì cần build lại. Tài khoản lễ tân, mật khẩu đã đổi và dữ liệu từ chế độ cục bộ không được tự nhập vào cloud; tạo tài khoản lễ tân trong bản cloud để dùng trên nhiều thiết bị.

## Triển khai GitHub, Vercel và Cloudflare Pages

GitHub Actions kiểm tra TypeScript, nghiệp vụ và build với Node.js 24 khi đẩy vào main/PR. Các kiểm thử chứng thực riêng cần đầu vào bí mật và được bỏ qua trên CI khi không có biến đó.

- **Vercel**: Import repo, framework **Vite**, Node **24.x**. `vercel.json` đặt `npm ci`, `npm run build`, thư mục `dist`, SPA fallback và không cache service worker. URL Supabase đã có trong `.env.production`; không cần thêm khóa API vào môi trường frontend.
- **Cloudflare Workers & Pages**: Connect to Git, build `npm run build`, output `dist`, biến `NODE_VERSION=24`. `wrangler.toml` cấu hình thư mục static asset là `./dist` và SPA fallback; Cloudflare triển khai bằng `wrangler deploy` mà không cần Worker entry-point.
- **Supabase** là phần dữ liệu/API chung; giao diện vẫn được host trên Vercel hoặc Pages. Chạy `npm run supabase:prepare` trước khi cập nhật API. CLI cố định: `npx supabase@2.119.0 db push --linked --project-ref lactqpzikjzhtqcfntko --dry-run --skip-vault`, rồi `npx supabase@2.119.0 db push --linked --project-ref lactqpzikjzhtqcfntko --skip-vault --yes` và `npx supabase@2.119.0 functions deploy hotel-api --project-ref lactqpzikjzhtqcfntko --use-api --no-verify-jwt`. Seed chỉ cần cho lần khởi tạo trống. `verify_jwt=false` vì API kiểm tra token phiên riêng phía máy chủ. Kiểm tra project đích trước khi chạy migration; không dùng `db reset` trên dữ liệu thật.

Hướng dẫn đối chiếu với [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite), [Cloudflare Pages Vite](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/) và [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets). Các site ở hai tên miền khác nhau chỉ chia sẻ dữ liệu khi trỏ tới cùng API Supabase.

Ở chế độ cục bộ, dữ liệu lưu tại trình duyệt trong bản ghi `son_ngoc_hotel_data_v3`. Các bản ghi v2 được đọc và nâng cấp khi thực hiện thao tác đầu tiên. Dữ liệu v2 được giữ lại.

Vào **Xuất Excel / PDF** để tải bản sao lưu JSON hoặc khôi phục từ bản sao lưu. Nếu dữ liệu hỏng hoặc không lưu được, ứng dụng hiển thị thông báo và chặn ghi đè dữ liệu gốc.

Ở chế độ cục bộ, các cửa sổ cùng trình duyệt nhận cập nhật qua sự kiện storage. Các thiết bị hoặc trình duyệt khác nhau chỉ dùng chung dữ liệu khi đã triển khai và cấu hình chế độ Supabase.

## Cài app

Nút **Cài ứng dụng** có ở màn hình đăng nhập và trong menu. Khi trình duyệt cung cấp hộp cài trực tiếp, nút mở hộp cài ngay. Nếu chưa có hộp cài, app tự nhận diện thiết bị và mở hướng dẫn phù hợp. **Hướng dẫn cho mọi thiết bị** cho phép chọn hệ điều hành/trình duyệt khác; mở từ Zalo/Facebook sẽ được nhắc chuyển sang trình duyệt ngoài.

| Thiết bị | Cách thêm biểu tượng Sơn Ngọc |
| --- | --- |
| iPhone / iPad | Safari → Chia sẻ → Thêm vào màn hình chính → Thêm. Bật **Mở dưới dạng ứng dụng web** nếu có. |
| Android / Tablet Android | Chrome/Edge: xác nhận hộp cài, hoặc chọn cài/thêm vào màn hình chính trong menu. Samsung Internet có hướng dẫn riêng. |
| Windows | Cài trong Chrome/Edge. Edge: `edge://apps` → Chi tiết → Tạo lối tắt trên Desktop. Firefox phiên bản hỗ trợ có nút ứng dụng web và mục Firefox Web Apps trong Start. |
| macOS | Safari trên macOS Sonoma 14 trở lên: File → Add to Dock. Chrome/Edge: cài app rồi giữ biểu tượng trong Dock. |
| Linux / Chromebook | Cài trong Chrome/Edge được hỗ trợ, rồi mở/ghim biểu tượng từ danh sách ứng dụng hoặc Launcher. |

Menu thay đổi theo phiên bản trình duyệt. Hướng dẫn dựa trên tài liệu của [Apple iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios), [Apple Mac](https://support.apple.com/en-us/104996), [Chrome](https://support.google.com/chrome/answer/9658361), [Microsoft Edge](https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge) và [Firefox Windows](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows).

Mỗi thiết bị cần mở cùng đường dẫn HTTPS và xác nhận cài riêng; website không thể tự tạo biểu tượng trên thiết bị khác. Hướng dẫn có nút sao chép link khi app chạy trên HTTPS. `localhost` chỉ dùng trên máy đang chạy app. Biểu tượng cài sẽ dùng logo Sơn Ngọc; app yêu cầu đăng nhập khi hết phiên. Cài app không đồng bộ dữ liệu giữa các thiết bị.

Service worker cần HTTPS hoặc localhost. Bản build lưu các tệp ứng dụng để mở offline sau lần truy cập đầu tiên. Icon trình duyệt, iPhone/iPad (152/167/180px), PWA (192/512px) và icon maskable Android cùng được tạo từ `public/icon.svg` bằng `npm run icons`. App hỗ trợ xoay ngang/dọc theo thiết bị.
