import { erp, firebaseState } from './firebase.js';
import { $, $$, esc, setTheme, getTheme, toast, modal, exportVisibleTablesExcel, printVisibleTablesPdf } from './utils.js';
import { NAV, PAGE_TITLES, canPage, roleLabel, can, isViewOnly } from './permissions.js';
import { renderDashboard } from './dashboard.js';
import { renderAdmin } from './admin.js';
import { renderWarehouse } from './inventory.js';
import { renderManufacturing } from './manufacturing.js';
import { renderSales } from './sales.js';
import { renderPurchases } from './purchases.js';
import { renderFinance } from './finance.js';
import { renderReports } from './reports.js';
import { renderEmployees } from './employees.js';
import { renderSettings } from './settings.js';

setTheme(getTheme());
const page = document.body.dataset.page || `dashboard`;
await erp.init();
if (page === `index`) location.replace(`dashboard.html`);

await erp.onAuth(async user => {
  if (!user) { location.replace(`login.html`); return; }
  if (!canPage(user, page)) {
    document.getElementById(`app`).innerHTML = `<main class="app-boot"><div class="boot-card"><div class="boot-logo">!</div><div><strong>لا توجد صلاحية لهذه الصفحة</strong><p>راجع داود أو معتصم لمنح الصلاحية المطلوبة.</p><p><a class="btn primary" href="dashboard.html">العودة للرئيسية</a></p></div></div></main>`;
    return;
  }
  await renderShell(user, page);
});

async function renderShell(user, activePage) {
  const [title, subtitle] = PAGE_TITLES[activePage] || PAGE_TITLES.dashboard;
  const allowedNav = NAV.filter(([key]) => canPage(user, key));
  document.getElementById(`app`).className = ``;
  document.getElementById(`app`).innerHTML = `
    <div class="layout ${isViewOnly(user) ? `view-only-shell` : ``}">
      <aside class="sidebar" id="sidebar">
        <div class="side-head"><div class="side-logo">${esc(await getLogoText())}</div><div><strong>${esc(await getCompanyName())}</strong><br><small>${esc(roleLabel(user.role))}</small></div></div>
        <nav class="nav">${allowedNav.map(([key,label,ico]) => `<a class="${key === activePage ? `active` : ``}" href="${key}.html"><span><span class="ico">${ico}</span> ${esc(label)}</span><span>‹</span></a>`).join(``)}</nav>
        <div class="side-foot">
          <button class="btn ghost" id="themeBtn">تبديل الوضع</button>
          <button class="btn danger" id="logoutBtn">تسجيل الخروج</button>
          <span class="badge ${firebaseState.mode === `firebase` ? `green` : `amber`}">${firebaseState.mode === `firebase` ? `Firebase` : `محلي`}</span>
        </div>
      </aside>
      <main class="page">
        <header class="topbar">
          <div><button class="btn mobile-menu" id="menuBtn">القائمة</button><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
          <div class="top-actions">
            <button class="btn" id="pageExcelBtn">Excel</button>
            <button class="btn" id="pagePdfBtn">PDF</button>
            <span class="badge teal">${esc(user.fullName || user.email)}</span>
            <button class="btn ghost" id="quickSearchBtn">بحث سريع</button>
          </div>
        </header>
        <section id="pageContent"></section>
      </main>
    </div>`;

  $(`#menuBtn`)?.addEventListener(`click`, () => $(`#sidebar`).classList.toggle(`open`));
  $(`#logoutBtn`).addEventListener(`click`, async () => { await erp.logout(); location.href = `login.html`; });
  $(`#themeBtn`).addEventListener(`click`, () => setTheme(document.body.classList.contains(`dark`) ? `light` : `dark`));
  $(`#quickSearchBtn`).addEventListener(`click`, quickSearch);
  $(`#pageExcelBtn`).addEventListener(`click`, () => exportVisibleTablesExcel(`${activePage}.xls`, document.getElementById(`pageContent`)));
  $(`#pagePdfBtn`).addEventListener(`click`, () => printVisibleTablesPdf(title, document.getElementById(`pageContent`)));

  const renderers = { dashboard:renderDashboard, admin:renderAdmin, warehouse:renderWarehouse, manufacturing:renderManufacturing, sales:renderSales, purchases:renderPurchases, finance:renderFinance, reports:renderReports, employees:renderEmployees, settings:renderSettings };
  await renderers[activePage]?.($(`#pageContent`), user);
  if (isViewOnly(user)) applyViewOnlyMode($(`#pageContent`));
}
async function getCompanyName(){ const s = await erp.get(`settings`,`company`); return s?.companyName || `نظام داود غانم`; }
async function getLogoText(){ const s = await erp.get(`settings`,`company`); return s?.logoText || `د`; }
function applyViewOnlyMode(root) {
  $$(`button`, root).forEach(button => {
    const text = button.textContent.trim();
    const id = button.id || ``;
    const allowed = /تصدير|Excel|PDF|طباعة|بحث|عرض|قسيمة/.test(text) || /export|print|search/i.test(id);
    if (!allowed) button.style.display = `none`;
  });
  $$(`form`, root).forEach(form => {
    if (form.closest(`.filters`)) return;
    $$(`input, textarea`, form).forEach(el => el.readOnly = true);
    $$(`select`, form).forEach(el => el.disabled = true);
  });
}
async function quickSearch() {
  const [items, customers, users, sales] = await Promise.all([erp.list(`items`), erp.list(`customers`), erp.list(`users`), erp.list(`salesInvoices`)]);
  const all = [
    ...items.map(x => ({ type:`صنف`, label:`${x.itemCode} - ${x.itemName}`, url:`warehouse.html` })),
    ...customers.map(x => ({ type:`عميل`, label:`${x.customerName} - ${x.phone || ``}`, url:`sales.html` })),
    ...users.map(x => ({ type:`مستخدم`, label:`${x.fullName} - ${roleLabel(x.role)}`, url:`employees.html` })),
    ...sales.map(x => ({ type:`فاتورة`, label:`${x.invoiceNumber} - ${x.customerName || ``}`, url:`sales.html` }))
  ];
  modal(`بحث سريع`, `<label>ابحث بالاسم أو الكود أو رقم الفاتورة<input id="quickSearchInput"></label><div id="quickSearchResults" class="grid"></div>`);
  const input = $(`#quickSearchInput`); const results = $(`#quickSearchResults`);
  input.focus();
  input.addEventListener(`input`, () => {
    const q = input.value.trim().toLowerCase();
    const rows = all.filter(x => x.label.toLowerCase().includes(q)).slice(0, 20);
    results.innerHTML = q ? rows.map(x => `<a class="card" href="${x.url}"><span class="badge teal">${esc(x.type)}</span><h3>${esc(x.label)}</h3></a>`).join(``) || `<div class="empty">لا توجد نتائج</div>` : `<div class="empty">ابدأ بالكتابة للبحث</div>`;
  });
}
