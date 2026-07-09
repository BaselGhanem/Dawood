import { erp } from './firebase.js';
import { $, esc, money, qty, number, sum, table, statusBadge, exportExcel, todayISO } from './utils.js';

const reportCollections = {
  inventory:`items`, movements:`inventoryMovements`, manufacturing:`productionOrders`, sales:`salesInvoices`, receivables:`customerDebts`, purchases:`purchaseInvoices`, payables:`supplierDebts`, cashbox:`cashDeliveries`, transfers:`internalTransfers`, salaries:`salaries`, advances:`employeeAdvances`, expenses:`vehicleExpenses`, shortages:`stockCounts`, logs:`systemLogs`
};
const reportLabels = { inventory:`المخزون`, movements:`حركات المخزون`, manufacturing:`التصنيع`, sales:`المبيعات`, receivables:`ذمم العملاء`, purchases:`المشتريات`, payables:`ذمم الموردين`, cashbox:`الصندوق`, transfers:`التحويلات`, salaries:`الرواتب`, advances:`السلف`, expenses:`مصاريف السيارات`, shortages:`فروقات الجرد`, logs:`سجل الحركات` };
export async function renderReports(root, user) {
  const [users, warehouses, items, customers, suppliers] = await Promise.all([erp.list(`users`), erp.list(`warehouses`), erp.list(`items`), erp.list(`customers`), erp.list(`suppliers`)]);
  root.innerHTML = `<section class="card">
    <div class="filters">
      <label>التقرير<select id="reportType">${Object.entries(reportLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join(``)}</select></label>
      <label>من تاريخ<input id="fromDate" type="date" value="${todayISO().slice(0,8)}01"></label>
      <label>إلى تاريخ<input id="toDate" type="date" value="${todayISO()}"></label>
      <label>بحث<input id="reportSearch"></label>
      <label>تصدير<button class="btn" id="exportReportBtn" type="button">Excel</button></label>
    </div>
    <div id="reportKpis" class="grid four"></div>
    <div id="reportResult" style="margin-top:14px"></div>
  </section>`;
  const state = { rows:[] };
  const refresh = async () => {
    const type = $(`#reportType`).value;
    const coll = reportCollections[type];
    let rows = await erp.list(coll, { includeDeleted:true });
    const from = $(`#fromDate`).value, to = $(`#toDate`).value, q = $(`#reportSearch`).value.trim().toLowerCase();
    rows = rows.filter(r => {
      const d = String(r.date || r.createdAt || r.countDate || r.salaryMonth || ``).slice(0,10);
      const dateOk = (!from || !d || d >= from) && (!to || !d || d <= to);
      const textOk = !q || JSON.stringify(r).toLowerCase().includes(q);
      return dateOk && textOk;
    });
    state.rows = rows;
    $(`#reportKpis`).innerHTML = kpis(type, rows);
    $(`#reportResult`).innerHTML = renderReport(type, rows, { users, warehouses, items, customers, suppliers });
  };
  root.addEventListener(`input`, e => { if([`reportType`,`fromDate`,`toDate`,`reportSearch`].includes(e.target.id)) refresh(); });
  $(`#exportReportBtn`, root).addEventListener(`click`, () => exportExcel(`${$(`#reportType`).value}.xls`, state.rows));
  await refresh();
}
function kpis(type, rows){
  const total = rows.length;
  const amount = sum(rows, r => r.total || r.amount || r.remainingAmount || r.shortageValue || r.netSalary || 0);
  const confirmed = rows.filter(r=>[`confirmed`,`paid`,`active`].includes(r.status)).length;
  const pending = rows.filter(r=>r.status===`pending`).length;
  return [card(`عدد السجلات`, total), card(`القيمة`, money(amount)), card(`معتمد/فعال`, confirmed), card(`بانتظار`, pending)].join(``);
}
function card(label,value){ return `<section class="card kpi"><div><div class="label">${esc(label)}</div><div class="num">${esc(value)}</div></div></section>`; }
function renderReport(type, rows, ctx){
  if(type===`inventory`) return table([{label:`الكود`,value:`itemCode`},{label:`الصنف`,value:`itemName`},{label:`الفئة`,value:`category`},{label:`القيمة`,value:r=>money(Object.values(r.stock||{}).reduce((s,v)=>s+number(v),0)*number(r.costPrice))},{label:`الرصيد`,value:r=>qty(Object.values(r.stock||{}).reduce((s,v)=>s+number(v),0))},{label:`الحالة`,value:r=>statusBadge(r.status)}],rows);
  if(type===`logs`) return table([{label:`الإجراء`,value:`actionType`},{label:`المستخدم`,value:`userName`},{label:`الدور`,value:`userRole`},{label:`الموديول`,value:`module`},{label:`التاريخ`,value:`createdAt`},{label:`ملاحظات`,value:`notes`}],rows,`لا توجد سجلات`);
  return table([{label:`الرقم`,value:r=>esc(r.invoiceNumber||r.purchaseNumber||r.productionNumber||r.deliveryNumber||r.transferNumber||r.movementNumber||r.id)},{label:`التاريخ`,value:r=>esc(r.date||r.createdAt||r.countDate||r.salaryMonth||`—`)},{label:`الطرف`,value:r=>esc(r.customerName||r.supplierName||r.employeeName||r.senderName||r.userName||`—`)},{label:`القيمة`,value:r=>money(r.total||r.amount||r.remainingAmount||r.shortageValue||r.netSalary||0)},{label:`الحالة`,value:r=>statusBadge(r.status)}],rows,`لا توجد بيانات ضمن الفلاتر الحالية`);
}
