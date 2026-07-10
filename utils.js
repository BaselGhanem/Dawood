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
export function modal(title, bodyHTML, actions = []) {
  const wrap = document.createElement(`div`);
  wrap.className = `modal-backdrop`;
  const buttons = actions.map((a, i) => `<button class="btn ${esc(a.className || ``)}" data-action="${i}">${esc(a.label)}</button>`).join(``);
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="btn ghost" data-close>إغلاق</button></div>
      <div class="modal-body">${bodyHTML}</div>
      ${buttons ? `<div class="actions" style="margin-top:14px">${buttons}</div>` : ``}
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener(`click`, event => {
    if (event.target === wrap || event.target.closest(`[data-close]`)) wrap.remove();
    const btn = event.target.closest(`[data-action]`);
    if (btn) {
      const action = actions[number(btn.dataset.action)];
      if (action?.handler) action.handler(wrap);
    }
  });
  return wrap;
}
export function confirmModal(message, onConfirm, label = `اعتماد`) {
  return modal(`تأكيد الإجراء`, `<p>${esc(message)}</p>`, [
    { label: `إلغاء`, className: `ghost`, handler: wrap => wrap.remove() },
    { label, className: `primary`, handler: wrap => { wrap.remove(); onConfirm?.(); } }
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
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${esc(h.label)}</th>`).join(``)}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map(h => `<td>${typeof h.value === `function` ? h.value(row) : esc(row[h.value])}</td>`).join(``)}</tr>`).join(``)}</tbody></table></div>`;
}
export function renderTabs(tabs, activeId) {
  return `<div class="tabs">${tabs.map(tab => `<button class="btn tab ${tab.id === activeId ? `active` : ``}" data-tab="${esc(tab.id)}">${esc(tab.label)}</button>`).join(``)}</div>`;
}
export function attachTabs(root = document) {
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
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,Tahoma,sans-serif;padding:24px;direction:rtl;color:#111827}h1{font-size:20px;margin:0 0 8px}.meta{color:#6b7280;margin:0 0 18px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.box{border:1px solid #d1d5db;border-radius:10px;padding:10px}.box b{display:block;font-size:16px;margin-top:4px}table{border-collapse:collapse;width:100%;margin-bottom:18px}th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:right;vertical-align:top}th{background:#f3f6f8}.total{font-weight:bold;background:#f9fafb}@media print{button{display:none}.page-break{page-break-after:always}}</style></head><body><h1>${esc(title)}</h1>${bodyHTML}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
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
