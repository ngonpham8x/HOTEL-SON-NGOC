import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectInstallEnvironment, getInstallGuide, browsersForPlatform } from '../src/utils/installGuides';

test('iPhone and desktop-mode iPad use the home-screen guide rather than the Mac guide', () => {
  const iphone = detectInstallEnvironment({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  assert.equal(iphone.platform, 'IOS');
  assert.equal(iphone.browser, 'SAFARI');
  const ipad = detectInstallEnvironment({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 });
  assert.equal(ipad.platform, 'IOS');
  const mac = detectInstallEnvironment({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 0 });
  assert.equal(mac.platform, 'MAC');
  assert.match(getInstallGuide(ipad.platform, ipad.browser).steps.join(' '), /màn hình chính/);
  assert.match(getInstallGuide(mac.platform, mac.browser).steps.join(' '), /Dock/);
});

test('Android and Chromium browser variants are detected before generic Linux/Chrome/Safari tokens', () => {
  const androidUA = 'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
  assert.deepEqual(detectInstallEnvironment({ userAgent: androidUA }), { platform: 'ANDROID', browser: 'CHROME', inAppBrowser: false });
  const samsung = detectInstallEnvironment({ userAgent: androidUA + ' SamsungBrowser/27.0' });
  assert.equal(samsung.browser, 'SAMSUNG');
  assert.match(getInstallGuide(samsung.platform, samsung.browser).title, /Samsung/);
  assert.equal(detectInstallEnvironment({ userAgent: androidUA + ' EdgA/130.0' }).browser, 'EDGE');
  const windowsUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36 Edg/130.0';
  assert.deepEqual(detectInstallEnvironment({ userAgent: windowsUA }), { platform: 'WINDOWS', browser: 'EDGE', inAppBrowser: false });
  assert.match(getInstallGuide('WINDOWS', 'EDGE').steps.join(' '), /edge:\/\/apps.*Desktop/);
});

test('Chrome and Firefox on iOS still direct users to Safari installation', () => {
  for (const token of ['CriOS/130.0', 'FxiOS/131.0', 'EdgiOS/130.0']) {
    const env = detectInstallEnvironment({ userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) ${token} Mobile/15E148 Safari/604.1` });
    assert.equal(env.platform, 'IOS');
    assert.match(getInstallGuide(env.platform, env.browser).steps[0], /Safari/);
    assert.deepEqual(browsersForPlatform(env.platform).map(item => item.value), ['SAFARI']);
  }
});

test('Chromebook and Linux receive launcher instructions instead of Mac or Windows steps', () => {
  for (const [ua, expected] of [['Mozilla/5.0 (X11; CrOS x86_64 15964.0.0) Chrome/130.0 Safari/537.36', 'CHROMEOS'], ['Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36', 'LINUX']] as const) {
    const env = detectInstallEnvironment({ userAgent: ua });
    assert.equal(env.platform, expected);
    const guide = getInstallGuide(env.platform, env.browser);
    assert.match(guide.steps.join(' '), /Launcher/);
    assert.doesNotMatch(guide.steps.join(' '), /edge:\/\/apps|Dock/);
  }
});

test('embedded mobile browsers are flagged even when they identify as Chrome or Safari', () => {
  for (const ua of ['Mozilla/5.0 (Linux; Android 13; SM-G991B; wv) Chrome/120.0 Safari/537.36', 'Mozilla/5.0 (iPhone) Safari/604.1 [FBAN/FBIOS;FBAV/400.0]', 'Mozilla/5.0 (iPhone) Instagram 300.0', 'Mozilla/5.0 (Linux; Android 14) Zalo/24.0']) {
    assert.equal(detectInstallEnvironment({ userAgent: ua }).inAppBrowser, true);
  }
});

test('unsupported desktop Firefox uses a supported-browser fallback; Windows has its own web-app steps', () => {
  const firefox = detectInstallEnvironment({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0' });
  assert.equal(firefox.browser, 'FIREFOX');
  assert.match(getInstallGuide('LINUX', 'FIREFOX').steps[0], /Chrome.*Edge/);
  assert.match(getInstallGuide('WINDOWS', 'FIREFOX').steps.join(' '), /Firefox Web Apps/);
  assert.match(getInstallGuide('MAC', 'SAFARI').steps[0], /Sonoma 14/);
  assert.match(getInstallGuide('OTHER', 'OTHER').note || '', /lối tắt/);
});
