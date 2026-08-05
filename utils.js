export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const nowISO = () => new Date().toISOString();
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const uid = (prefix = `doc`) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
export const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const money = value => `${number(value).toLocaleString(`ar-JO`, { maximumFractionDigits: 3 })} د.أ`;
export const qty = value => number(value).toLocaleString(`ar-JO`, { maximumFractionDigits: 3 });
export const dateTime = value => value ? new Date(value).toLocaleString(`ar-JO`, { dateStyle: `medium`, timeStyle: `short` }) : `—`;
export const esc = value => String(value ?? ``)
  .replaceAll(`&`, `&amp;`).replaceAll(`<`, `&lt;`).replaceAll(`>`, `&gt;`)
  .replaceAll(`"`, `&quot;`).replaceAll(`'`, `&#039;`);
export const normalize = value => String(value ?? ``).trim().toLowerCase();
export const byDateDesc = field => (a, b) => String(b[field] || ``).localeCompare(String(a[field] || ``));
export const sum = (rows, field) => rows.reduce((total, row) => total + number(typeof field === `function` ? field(row) : row[field]), 0);
export const getFormData = form => Object.fromEntries(new FormData(form).entries());
export const setTheme = mode => {
  document.body.classList.toggle(`dark`, mode === `dark`);
  localStorage.setItem(`erpTheme`, mode);
};
export const getTheme = () => localStorage.getItem(`erpTheme`) || `light`;
export function toast(message, type = `ok`) {
  let box = $(`.toast-box`);
  if (!box) {
    box = document.createElement(`div`);
    box.className = `toast-box`;
    document.body.appendChild(box);
  }
  const el = document.createElement(`div`);
  el.className = `toast ${type}`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
export function errorMessage(error, fallback = `حدث خطأ غير متوقع.`) {
  const raw = typeof error === `string` ? error : error?.message;
  const message = String(raw || fallback).trim();
  const code = typeof error === `object` && error?.code ? String(error.code) : ``;
  return code && !message.includes(code) ? `${message} (${code})` : message;
}
let lastShownError = { message:``, at:0 };
export function showError(error, fallback = `حدث خطأ غير متوقع.`) {
  const message = errorMessage(error, fallback);
  const currentTime = Date.now();
  if (lastShownError.message === message && currentTime - lastShownError.at < 2000) return message;
  lastShownError = { message, at:currentTime };
  toast(message, `err`);
  return message;
}
export function installGlobalErrorHandling() {
  if (typeof window === `undefined` || window.__dawoodErrorHandlingInstalled) return;
  window.__dawoodErrorHandlingInstalled = true;
  window.addEventListener(`unhandledrejection`, event => {
    console.error(`Unhandled promise rejection`, event.reason);
    showError(event.reason, `تعذر إكمال العملية.`);
    event.preventDefault();
  });
  window.addEventListener(`error`, event => {
    console.error(`Unhandled application error`, event.error || event.message);
    showError(event.error || event.message, `حدث خطأ في النظام.`);
  });
}
installGlobalErrorHandling();
export function modal(title, bodyHTML, actions = []) {
  const wrap = document.createElement(`div`);
  wrap.className = `modal-backdrop`;
  const buttons = actions.map((a, i) => `<button class="btn ${esc(a.className || ``)}" data-action="${i}">${esc(a.label)}</button>`).join(``);
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="btn ghost" data-close>إغلاق</button></div>
      <div class="modal-body">${bodyHTML}</div>
      ${buttons ? `<div class="actions modal-actions">${buttons}</div>` : ``}
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener(`click`, async event => {
    if (event.target === wrap || event.target.closest(`[data-close]`)) wrap.remove();
    const btn = event.target.closest(`[data-action]`);
    if (btn && !btn.disabled) {
      const action = actions[number(btn.dataset.action)];
      if (action?.handler) {
        btn.disabled = true;
        try { await action.handler(wrap); }
        catch (error) {
          console.error(`Modal action failed`, error);
          showError(error, `تعذر إكمال العملية.`);
        } finally {
          if (btn.isConnected) btn.disabled = false;
        }
      }
    }
  });
  return wrap;
}
export function confirmModal(message, onConfirm, label = `اعتماد`) {
  return modal(`تأكيد الإجراء`, `<p>${esc(message)}</p>`, [
    { label: `إلغاء`, className: `ghost`, handler: wrap => wrap.remove() },
    { label, className: `primary`, handler: async wrap => { wrap.remove(); await onConfirm?.(); } }
  ]);
}
export function badge(value, tone = `teal`) {
  return `<span class="badge ${tone}">${esc(value)}</span>`;
}
export function statusBadge(status) {
  const map = {
    active: [`فعال`, `green`], inactive: [`غير فعال`, `red`], draft: [`مسودة`, `blue`], confirmed: [`معتمد`, `green`], pending: [`بانتظار التأكيد`, `amber`], rejected: [`مرفوض`, `red`], paid: [`مدفوع`, `green`], partial: [`مدفوع جزئياً`, `amber`], open: [`مفتوح`, `blue`], overdue: [`متأخر`, `red`], deleted: [`محذوف`, `red`], approved: [`معتمد`, `green`], accepted: [`مقبول`, `green`], awaiting_receiver: [`بانتظار موافقة المستلم`, `amber`], returned: [`راجع`, `amber`]
  };
  const [text, tone] = map[status] || [status || `غير محدد`, `teal`];
  return badge(text, tone);
}
export function table(headers, rows, emptyText = `لا توجد بيانات`) {
  if (!rows.length) return `<div class="empty">${esc(emptyText)}</div>`;
  const head = headers.map(h => `<th>${esc(h.label)}</th>`).join(``);
  const body = rows.map(row => `<tr>${headers.map(h => {
    const value = typeof h.value === `function` ? h.value(row) : esc(row[h.value]);
    return `<td data-label="${esc(h.label)}">${value}</td>`;
  }).join(``)}</tr>`).join(``);
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
export function renderTabs(tabs, activeId) {
  return `<div class="tabs">${tabs.map(tab => `<button class="btn tab ${tab.id === activeId ? `active` : ``}" data-tab="${esc(tab.id)}">${esc(tab.label)}</button>`).join(``)}</div>`;
}
export function attachTabs(root = document) {
  if (root.__dawoodTabsAttached) return;
  root.__dawoodTabsAttached = true;
  root.addEventListener(`click`, event => {
    const btn = event.target.closest(`[data-tab]`);
    if (!btn) return;
    const group = btn.closest(`.card`) || document;
    $$(`[data-tab]`, group).forEach(el => el.classList.toggle(`active`, el === btn));
    $$(`.panel`, group).forEach(panel => panel.classList.toggle(`active`, panel.dataset.panel === btn.dataset.tab));
  });
}
export function downloadFile(filename, content, type = `text/plain;charset=utf-8`) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement(`a`);
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export function exportCSV(filename, rows) {
  if (!rows.length) {
    toast(`لا توجد بيانات للتصدير`, `warn`);
    return;
  }
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const csv = [headers.join(`,`), ...rows.map(row => headers.map(h => `"${String(row[h] ?? ``).replaceAll(`"`, `""`)}"`).join(`,`))].join(`\n`);
  downloadFile(filename, `\ufeff${csv}`, `text/csv;charset=utf-8`);
}

export function exportExcel(filename, rows) {
  if (!rows.length) {
    toast(`لا توجد بيانات للتصدير`, `warn`);
    return;
  }
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join(``)}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map(h => `<td>${esc(row[h] ?? ``)}</td>`).join(``)}</tr>`).join(``)}</tbody></table></body></html>`;
  downloadFile(filename.endsWith(`.xls`) ? filename : `${filename}.xls`, `\ufeff${html}`, `application/vnd.ms-excel;charset=utf-8`);
}
export function tableToRows(tableEl) {
  const headers = [...tableEl.querySelectorAll(`thead th`)].map(th => th.textContent.trim());
  return [...tableEl.querySelectorAll(`tbody tr`)].map(tr => Object.fromEntries([...tr.children].map((td, i) => [headers[i] || `عمود ${i + 1}`, td.textContent.trim()])));
}
export function exportVisibleTablesExcel(filename = `page-export.xls`, root = document) {
  const tables = [...root.querySelectorAll(`table`)].filter(t => t.offsetParent !== null);
  const rows = tables.flatMap((t, index) => tableToRows(t).map(row => ({ جدول: index + 1, ...row })));
  exportExcel(filename, rows);
}
export function printVisibleTablesPdf(title = `تقرير`, root = document) {
  const content = [...root.querySelectorAll(`table`)].filter(t => t.offsetParent !== null).map(t => t.outerHTML).join(`<br><br>`);
  if (!content) return toast(`لا توجد جداول ظاهرة للطباعة`, `warn`);
  const win = window.open(``, `_blank`);
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,Tahoma,sans-serif;padding:24px;direction:rtl}h1{font-size:20px;margin:0 0 18px}table{border-collapse:collapse;width:100%;margin-bottom:18px}th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:right}th{background:#f3f6f8}@media print{button{display:none}}</style></head><body><h1>${esc(title)}</h1>${content}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export function printHtmlPdf(title = `تقرير`, bodyHTML = ``) {
  if (!bodyHTML) return toast(`لا يوجد محتوى للطباعة`, `warn`);
  const win = window.open(``, `_blank`);
  if (!win) return toast(`يرجى السماح بالنوافذ المنبثقة لفتح الطباعة`, `warn`);
  const logoUrl = new URL(`./Logo.png`, window.location.href).href;
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&display=swap" rel="stylesheet"><style>
    :root{--brand:#099999;--brand-dark:#066f73;--navy:#10232f;--ink:#17242c;--muted:#65747c;--line:#dce7e8;--soft:#f3f8f8}
    *{box-sizing:border-box}body{margin:0;background:#edf3f3;color:var(--ink);font-family:"Almarai",Arial,Tahoma,sans-serif;direction:rtl;-webkit-print-color-adjust:exact;print-color-adjust:exact}.document{width:min(210mm,calc(100% - 28px));min-height:270mm;margin:24px auto;background:#fff;border-radius:22px;box-shadow:0 24px 70px rgba(16,35,47,.14);overflow:hidden}.document-accent{height:8px;background:linear-gradient(90deg,var(--navy),var(--brand),#24b5ad)}.document-inner{padding:25px 28px 22px}.document-head{display:flex;justify-content:space-between;align-items:center;gap:22px;padding-bottom:20px;border-bottom:1px solid var(--line)}.document-brand{display:flex;align-items:center;gap:14px}.document-logo{width:78px;height:78px;object-fit:contain;border:1px solid var(--line);border-radius:18px;padding:7px;background:#fff}.document-brand strong{display:block;font-size:18px;color:var(--navy)}.document-brand small{display:block;color:var(--muted);margin-top:6px}.document-title{text-align:left}.document-title h1{font-size:22px;margin:0 0 7px;color:var(--navy)}.document-title span{display:inline-block;color:var(--brand-dark);background:#e8f7f6;border:1px solid #c7e8e6;border-radius:999px;padding:6px 11px;font-size:11px;font-weight:800}.document-body{padding-top:20px}.meta{color:var(--muted);margin:0 0 18px;line-height:1.9}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.box{border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--soft);color:var(--muted);font-size:11px}.box b{display:block;font-size:16px;margin-top:6px;color:var(--ink)}table{border-collapse:separate;border-spacing:0;width:100%;margin:16px 0 18px;border:1px solid var(--line);border-radius:14px;overflow:hidden}th,td{border:0;border-bottom:1px solid var(--line);padding:10px;font-size:11px;text-align:right;vertical-align:middle}th{background:var(--navy);color:#fff;font-weight:800}tr:last-child td{border-bottom:0}.total{font-weight:800;background:var(--soft)}.invoice-hero{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:18px}.invoice-number{font-size:27px;font-weight:800;color:var(--navy);direction:ltr;text-align:right}.invoice-kicker{color:var(--brand);font-weight:800;font-size:12px;margin-bottom:6px}.invoice-status{padding:7px 12px;border-radius:999px;background:#e7f6f0;color:#13745a;font-size:11px;font-weight:800}.invoice-info{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}.info-card{border:1px solid var(--line);border-radius:14px;padding:12px;background:#fff}.info-card span{display:block;color:var(--muted);font-size:10px;margin-bottom:6px}.info-card strong{font-size:12px;line-height:1.7}.invoice-table td:nth-child(1),.invoice-table th:nth-child(1){width:34px;text-align:center}.invoice-table td:nth-last-child(-n+3),.invoice-table th:nth-last-child(-n+3){text-align:center}.invoice-bottom{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:20px;align-items:start;margin-top:18px}.invoice-notes{border:1px dashed #cbdcdc;border-radius:14px;padding:13px;min-height:92px;color:var(--muted);font-size:11px;line-height:1.9}.invoice-notes strong{display:block;color:var(--ink);margin-bottom:4px}.invoice-totals{border:1px solid var(--line);border-radius:16px;overflow:hidden}.total-row{display:flex;justify-content:space-between;gap:14px;padding:11px 13px;border-bottom:1px solid var(--line);font-size:12px}.total-row:last-child{border:0}.total-row.grand{background:var(--navy);color:#fff;font-size:14px;font-weight:800}.total-row.due{background:#e8f7f6;color:var(--brand-dark);font-weight:800}.document-foot{display:flex;justify-content:space-between;gap:20px;margin-top:26px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:9px}.signature{margin-top:34px;display:grid;grid-template-columns:repeat(2,1fr);gap:50px;text-align:center}.signature span{display:block;border-top:1px solid #9fadaf;padding-top:8px;color:var(--muted);font-size:10px}.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}
    @media(max-width:700px){.document{width:100%;margin:0;border-radius:0;min-height:100vh}.document-inner{padding:18px}.document-head,.invoice-hero{align-items:flex-start}.document-logo{width:62px;height:62px}.document-title h1{font-size:18px}.invoice-info,.summary{grid-template-columns:repeat(2,1fr)}.invoice-bottom{grid-template-columns:1fr}.document-body{overflow-x:auto}}
    @page{size:A4;margin:9mm}@media print{body{background:#fff}.document{width:100%;min-height:auto;margin:0;border-radius:0;box-shadow:none}.document-inner{padding:7mm 6mm 4mm}.document-accent{height:5px}button{display:none}.page-break{page-break-after:always}thead{display:table-header-group}tr,.info-card,.invoice-totals{break-inside:avoid}.document-foot{position:relative}}
  </style></head><body><main class="document"><div class="document-accent"></div><div class="document-inner"><header class="document-head"><div class="document-brand"><img class="document-logo" src="${esc(logoUrl)}" alt="شعار الشركة"><div><strong>نظام داود غانم</strong><small>إدارة المبيعات والمخزون</small></div></div><div class="document-title"><h1>${esc(title)}</h1><span>مستند صادر من النظام</span></div></header><section class="document-body">${bodyHTML}</section><footer class="document-foot"><span>تم إنشاء هذا المستند إلكترونيًا من نظام داود غانم</span><span class="ltr">${esc(new Date().toLocaleString(`en-GB`))}</span></footer></div></main></body></html>`);
  win.document.close();
  win.focus();
  const print = () => setTimeout(() => win.print(), 180);
  const logo = win.document.querySelector(`.document-logo`);
  if (!logo || logo.complete) print(); else { logo.addEventListener(`load`, print, { once:true }); logo.addEventListener(`error`, print, { once:true }); }
}

export function bindSmartFilters(root, sourceRows, config, render) {
  const getFilteredRows = (excludeKey = ``) => sourceRows.filter(row => Object.entries(config).every(([key, cfg]) => {
    if (key === excludeKey) return true;
    const el = root.querySelector(cfg.selector);
    const value = el?.value || ``;
    if (!value) return true;
    return String(cfg.get(row) ?? ``) === value;
  }));
  const refreshOptions = () => {
    Object.entries(config).forEach(([key, cfg]) => {
      const el = root.querySelector(cfg.selector);
      if (!el || el.tagName !== `SELECT`) return;
      const current = el.value;
      const rows = getFilteredRows(key);
      const values = [...new Set(rows.map(cfg.get).filter(v => v !== undefined && v !== null && String(v) !== ``))];
      el.innerHTML = `<option value="">الكل</option>${values.map(value => `<option value="${esc(value)}" ${String(value) === current ? `selected` : ``}>${esc(cfg.label ? cfg.label(value) : value)}</option>`).join(``)}`;
      if (current && !values.map(String).includes(String(current))) el.value = ``;
    });
    render(getFilteredRows());
  };
  Object.values(config).forEach(cfg => root.querySelector(cfg.selector)?.addEventListener(`change`, refreshOptions));
  refreshOptions();
}

export function parseCSV(text) {
  const lines = text.replace(/^\ufeff/, ``).split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines.shift() || ``);
  return lines.map(line => Object.fromEntries(splitCsvLine(line).map((v, i) => [headers[i], v])));
}
function splitCsvLine(line) {
  const out = [];
  let current = ``;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === `"` && line[i + 1] === `"`) { current += `"`; i++; continue; }
    if (c === `"`) { quoted = !quoted; continue; }
    if (c === `,` && !quoted) { out.push(current); current = ``; continue; }
    current += c;
  }
  out.push(current);
  return out;
}
export function lineBuilder(container, itemOptions, onChange) {
  const state = [];
  const render = () => {
    container.innerHTML = `
      <div class="actions"><button type="button" class="btn primary" data-add-line>إضافة صنف</button></div>
      ${state.length ? table([
        {label:`الصنف`, value:r=>esc(itemOptions.find(i=>i.id===r.itemId)?.itemName || r.itemId)},
        {label:`الكمية`, value:r=>qty(r.quantity)},
        {label:`السعر`, value:r=>money(r.price)},
        {label:`الإجمالي`, value:r=>money(number(r.quantity)*number(r.price))},
        {label:``, value:r=>`<button class="btn danger" data-del-line="${esc(r.id)}">حذف</button>`}
      ], state) : `<div class="empty">لم يتم إدخال أصناف بعد</div>`}`;
    onChange?.([...state]);
  };
  container.addEventListener(`click`, event => {
    if (event.target.closest(`[data-add-line]`)) {
      const options = itemOptions.map(item => `<option value="${esc(item.id)}">${esc(item.itemCode)} - ${esc(item.itemName)}</option>`).join(``);
      modal(`إضافة صنف`, `
        <form id="lineForm" class="form-grid two">
          <label>الصنف<select name="itemId" required>${options}</select></label>
          <label>الكمية<input name="quantity" type="number" step="0.001" min="0.001" required></label>
          <label>السعر<input name="price" type="number" step="0.001" min="0" required></label>
          <label>خصم<input name="discount" type="number" step="0.001" min="0" value="0"></label>
        </form>`, [
          {label:`حفظ الصنف`, className:`primary`, handler: wrap => {
            const form = $(`#lineForm`, wrap);
            if (!form.reportValidity()) return;
            const data = getFormData(form);
            state.push({ id: uid(`line`), itemId: data.itemId, quantity: number(data.quantity), price: number(data.price) - number(data.discount) });
            wrap.remove(); render();
          }}
        ]);
    }
    const del = event.target.closest(`[data-del-line]`);
    if (del) { const idx = state.findIndex(x => x.id === del.dataset.delLine); if (idx >= 0) state.splice(idx, 1); render(); }
  });
  render();
  return { get lines(){ return [...state]; }, setLines(lines){ state.splice(0, state.length, ...lines); render(); } };
}
