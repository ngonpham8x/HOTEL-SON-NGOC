export function loginBrowser(run) {
  if (run('eval', "Boolean(document.getElementById('login-password'))") === 'true') {
    const password = process.env.SON_NGOC_PRIMARY_TEST_PASSWORD;
    if (!password) throw new Error('Supply the primary password through the process environment.');
    run.withInput(`(()=>{const e=document.getElementById('login-password');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(password)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`, 'eval', '--stdin');
    run('click', 'form[aria-label="Đăng nhập hệ thống"] button[type="submit"]');
    run('wait', 'header');
  }
}
