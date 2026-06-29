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
    active: [`فعال`, `green`], inactive: [`غير فعال`, `red`], draft: [`مسودة`, `blue`], confirmed: [`معتمد`, `green`], pending: [`بانتظار التأكيد`, `amber`], rejected: [`مرفوض`, `red`], paid: [`مدفوع`, `green`], partial: [`مدفوع جزئياً`, `amber`], open: [`مفتوح`, `blue`], overdue: [`متأخر`, `red`], deleted: [`محذوف`, `red`]
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
