import { erp, firebaseState, OFFICIAL_LOGIN_ALIASES } from './firebase.js';
import { $, toast, setTheme, getTheme } from './utils.js';

setTheme(getTheme());
await erp.init();
const form = $(`#loginForm`);
const hint = $(`#loginHint`);

hint.textContent = firebaseState.mode === `firebase`
  ? `متصل بـ Firebase الرسمي.`
  : firebaseState.mode === `firebase_error`
    ? `Firebase غير متصل. افتح Console للتفاصيل.`
    : `يعمل حالياً بوضع محلي احتياطي.`;

form.addEventListener(`submit`, async event => {
  event.preventDefault();
  const btn = form.querySelector(`button`);
  btn.disabled = true;
  try {
    const rawIdentifier = $(`#loginEmail`).value.trim();
    const official = OFFICIAL_LOGIN_ALIASES.find(u => u.username === rawIdentifier.toLowerCase());
    await erp.login(official?.email || rawIdentifier, $(`#loginPassword`).value);
    toast(`تم تسجيل الدخول بنجاح`);
    location.href = `dashboard.html`;
  } catch (error) {
    toast(error.message || `تعذر تسجيل الدخول`, `err`);
  } finally {
    btn.disabled = false;
  }
});
