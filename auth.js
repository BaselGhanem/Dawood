import { erp, firebaseState } from './firebase.js';
import { $, toast, setTheme, getTheme } from './utils.js';

setTheme(getTheme());
await erp.init();
const form = $('#loginForm');
const hint = $('#loginHint');
hint.textContent = firebaseState.mode === `firebase` ? `متصل بإعدادات Firebase المحفوظة.` : `يعمل حالياً بوضع محلي تجريبي إلى أن يتم حفظ إعدادات Firebase من صفحة الإعدادات.`;
form.addEventListener(`submit`, async event => {
  event.preventDefault();
  const btn = form.querySelector(`button`);
  btn.disabled = true;
  try {
    await erp.login($('#loginEmail').value.trim(), $('#loginPassword').value);
    toast(`تم تسجيل الدخول بنجاح`);
    location.href = `dashboard.html`;
  } catch (error) {
    toast(error.message || `تعذر تسجيل الدخول`, `err`);
  } finally {
    btn.disabled = false;
  }
});
