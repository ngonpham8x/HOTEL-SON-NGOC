export type InstallPlatform = 'IOS' | 'ANDROID' | 'WINDOWS' | 'MAC' | 'LINUX' | 'CHROMEOS' | 'OTHER';
export type InstallBrowser = 'SAFARI' | 'CHROME' | 'EDGE' | 'SAMSUNG' | 'FIREFOX' | 'OTHER';
export interface InstallEnvironment { platform: InstallPlatform; browser: InstallBrowser; inAppBrowser: boolean }

export const INSTALL_PLATFORMS: { value: InstallPlatform; label: string }[] = [
  { value: 'IOS', label: 'iPhone / iPad' }, { value: 'ANDROID', label: 'Android / Tablet Android' },
  { value: 'WINDOWS', label: 'Windows' }, { value: 'MAC', label: 'macOS' },
  { value: 'LINUX', label: 'Linux' }, { value: 'CHROMEOS', label: 'Chromebook' },
  { value: 'OTHER', label: 'Thiết bị khác' },
];
export const INSTALL_BROWSERS: { value: InstallBrowser; label: string }[] = [
  { value: 'CHROME', label: 'Chrome' }, { value: 'EDGE', label: 'Microsoft Edge' },
  { value: 'SAFARI', label: 'Safari' }, { value: 'SAMSUNG', label: 'Samsung Internet' },
  { value: 'FIREFOX', label: 'Firefox' }, { value: 'OTHER', label: 'Trình duyệt khác' },
];

export function detectInstallEnvironment({ userAgent = '', platform = '', maxTouchPoints = 0 }: { userAgent?: string; platform?: string; maxTouchPoints?: number }): InstallEnvironment {
  const os: InstallPlatform = /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1) ? 'IOS'
    : /android/i.test(userAgent) ? 'ANDROID' : /windows/i.test(userAgent) ? 'WINDOWS'
    : /CrOS/i.test(userAgent) ? 'CHROMEOS' : /macintosh|mac os x/i.test(userAgent) ? 'MAC'
    : /linux|x11/i.test(userAgent) ? 'LINUX' : 'OTHER';
  const browser: InstallBrowser = /SamsungBrowser/i.test(userAgent) ? 'SAMSUNG'
    : /Edg(?:e|A|iOS)?\//i.test(userAgent) ? 'EDGE' : /Firefox|FxiOS/i.test(userAgent) ? 'FIREFOX'
    : /Chrome|Chromium|CriOS/i.test(userAgent) ? 'CHROME' : /Safari/i.test(userAgent) ? 'SAFARI' : 'OTHER';
  return { platform: os, browser, inAppBrowser: /FBAN|FBAV|Instagram|Zalo|Line\/|; wv\)/i.test(userAgent) };
}

export function browsersForPlatform(platform: InstallPlatform) {
  const allowed: InstallBrowser[] = platform === 'IOS' ? ['SAFARI']
    : platform === 'ANDROID' ? ['CHROME', 'SAMSUNG', 'EDGE', 'FIREFOX', 'OTHER']
    : platform === 'MAC' ? ['SAFARI', 'CHROME', 'EDGE', 'FIREFOX', 'OTHER']
    : ['CHROME', 'EDGE', 'FIREFOX', 'OTHER'];
  return INSTALL_BROWSERS.filter(browser => allowed.includes(browser.value));
}

export function getInstallGuide(platform: InstallPlatform, browser: InstallBrowser): { title: string; steps: string[]; note?: string } {
  if (platform === 'IOS') return {
    title: 'Thêm vào màn hình chính iPhone / iPad',
    steps: ['Mở trang bằng Safari trên iPhone/iPad. Bấm Chia sẻ; nếu đang dùng bố cục thu gọn, mở Menu trang rồi chọn Chia sẻ.', 'Chọn Thêm vào màn hình chính. Nếu mục này bị ẩn, mở Sửa tác vụ và thêm mục đó.', 'Giữ tên Sơn Ngọc, bật Mở dưới dạng ứng dụng web nếu có, rồi bấm Thêm.'],
  };
  if (platform === 'ANDROID') {
    if (browser === 'SAMSUNG') return { title: 'Thêm trên Samsung Internet', steps: ['Mở trang trong Samsung Internet.', 'Bấm dấu + cài app trên thanh địa chỉ nếu có; hoặc mở menu và chọn Thêm trang vào → Màn hình chính.', 'Xác nhận Thêm / Cài đặt. Mở app từ biểu tượng Sơn Ngọc trên màn hình chính.'] };
    if (browser === 'FIREFOX' || browser === 'OTHER') return { title: 'Thêm trên Android', steps: ['Mở menu trình duyệt, tìm Cài đặt hoặc Thêm vào màn hình chính nếu có.', 'Xác nhận tên Sơn Ngọc và thêm biểu tượng.', 'Nếu trình duyệt không có mục này, mở cùng đường dẫn bằng Chrome rồi dùng menu Cài đặt và tạo lối tắt → Cài đặt.'], note: 'Một số trình duyệt chỉ tạo lối tắt mở trang web.' };
    return { title: 'Cài trên Android / Tablet Android', steps: ['Mở trang bằng Chrome hoặc Microsoft Edge.', browser === 'EDGE' ? 'Mở menu và chọn Cài ứng dụng / Thêm vào màn hình chính nếu có.' : 'Mở menu ⋮ → Cài đặt và tạo lối tắt → Cài đặt. Ở phiên bản khác, mục này có thể mang tên Thêm vào màn hình chính.', 'Xác nhận Cài đặt / Thêm. Mở app bằng logo Sơn Ngọc trong danh sách ứng dụng hoặc màn hình chính.'] };
  }
  if (platform === 'MAC' && browser === 'SAFARI') return { title: 'Thêm Sơn Ngọc vào Dock trên Mac', steps: ['Mở trang bằng Safari trên macOS Sonoma 14 trở lên.', 'Chọn Tệp (File) → Thêm vào Dock (Add to Dock); hoặc mở Chia sẻ rồi chọn Thêm vào Dock.', 'Giữ tên Sơn Ngọc và bấm Thêm. Biểu tượng có trong Dock và thư mục Applications.'], note: 'Nếu Mac chưa có mục Thêm vào Dock, có thể cài bằng Chrome hoặc Edge.' };
  if (browser === 'FIREFOX' && platform === 'WINDOWS') return { title: 'Thêm trên Firefox cho Windows', steps: ['Mở trang trong Firefox, bấm nút ứng dụng web trên thanh địa chỉ.', 'Xác nhận ghim ứng dụng khi Windows hỏi.', 'Mở Sơn Ngọc từ thanh tác vụ hoặc Start → Firefox Web Apps.'], note: 'Nếu chưa có nút ứng dụng web, cập nhật Firefox hoặc cài bằng Chrome/Edge.' };
  if (browser === 'FIREFOX' || browser === 'SAFARI' || browser === 'OTHER') return { title: 'Cài bằng trình duyệt hỗ trợ', steps: ['Mở đường dẫn của app bằng Chrome hoặc Microsoft Edge trên thiết bị này.', 'Bấm nút Cài ứng dụng của trang; hoặc dùng mục cài app trong menu trình duyệt.', 'Xác nhận cài, rồi ghim biểu tượng Sơn Ngọc vào Desktop, Dock hoặc danh sách ứng dụng tùy thiết bị.'], note: 'Trình duyệt hiện tại có thể chỉ hỗ trợ dấu trang hoặc lối tắt.' };
  const steps = browser === 'EDGE'
    ? ['Mở menu … → Công cụ khác → Ứng dụng → Cài đặt trang này dưới dạng ứng dụng.', 'Xác nhận tên Sơn Ngọc và bấm Cài đặt.']
    : ['Bấm biểu tượng cài app trên thanh địa chỉ; hoặc menu ⋮ → Truyền, lưu và chia sẻ → Cài đặt trang dưới dạng ứng dụng.', 'Xác nhận tên Sơn Ngọc và bấm Cài đặt.'];
  if (platform === 'WINDOWS' && browser === 'EDGE') steps.push('Để có icon trên Desktop: mở edge://apps → Chi tiết của Sơn Ngọc → Tạo lối tắt trên Desktop.');
  else if (platform === 'MAC') steps.push('Mở app Sơn Ngọc; bấm giữ biểu tượng ở Dock → Tùy chọn → Giữ trong Dock.');
  else if (platform === 'WINDOWS') steps.push('Mở app từ Start hoặc chrome://apps. Có thể ghim Sơn Ngọc vào Start/thanh tác vụ; chọn tạo lối tắt khi trình duyệt cung cấp.');
  else steps.push('Mở Sơn Ngọc từ danh sách ứng dụng và ghim biểu tượng vào Launcher/thanh tác vụ của thiết bị.');
  return { title: `Cài Sơn Ngọc trên ${INSTALL_PLATFORMS.find(item => item.value === platform)?.label}`, steps };
}
