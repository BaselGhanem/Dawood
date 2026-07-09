import { erp, firebaseState, bootstrapOfficialFirebaseUsers, OFFICIAL_BOOTSTRAP_USERS } from './firebase.js';
import { $, toast, setTheme, getTheme, esc } from './utils.js';

setTheme(getTheme());
await erp.init();
const form = $(`#loginForm`);
const hint = $(`#loginHint`);
const bootstrapBox = $(`#bootstrapBox`);

hint.textContent = firebaseState.mode === `firebase`
  ? `متصل بـ Firebase الرسمي. استخدم الحسابات الرسمية بعد التهيئة الأولى.`
  : `يعمل حالياً بوضع محلي احتياطي.`;

if (bootstrapBox) {
  bootstrapBox.innerHTML = `
    <details>
      <summary>تهيئة أول تشغيل للموقع الرسمي</summary>
      <p>يُستخدم مرة واحدة فقط لإنشاء داود، معتصم، وخضر بدون أي بيانات تجريبية.</p>
      <button class="btn amber block" id="bootstrapBtn" type="button">إنشاء الحسابات الرسمية</button>
      <div class="hint" style="margin-top:10px">
        ${OFFICIAL_BOOTSTRAP_USERS.map(u => `<code>${esc(u.email)} / ${esc(u.password)}</code>`).join(``)}
      </div>
    </details>`;
}

form.addEventListener(`submit`, async event => {
  event.preventDefault();
  const btn = form.querySelector(`button`);
  btn.disabled = true;
  try {
    const rawIdentifier = $(`#loginEmail`).value.trim();
    const official = OFFICIAL_BOOTSTRAP_USERS.find(u => u.username === rawIdentifier.toLowerCase());
    await erp.login(official?.email || rawIdentifier, $(`#loginPassword`).value);
    toast(`تم تسجيل الدخول بنجاح`);
    location.href = `dashboard.html`;
  } catch (error) {
    toast(error.message || `تعذر تسجيل الدخول`, `err`);
  } finally {
    btn.disabled = false;
  }
});

$(`#bootstrapBtn`)?.addEventListener(`click`, async event => {
  const btn = event.currentTarget;
  btn.disabled = true;
  try {
    await bootstrapOfficialFirebaseUsers();
    toast(`تم إنشاء الحسابات الرسمية. تم الدخول بحساب داود غانم.`);
    location.href = `dashboard.html`;
  } catch (error) {
    toast(error.message || `فشلت تهيئة الحسابات الرسمية`, `err`);
  } finally {
    btn.disabled = false;
  }
});
