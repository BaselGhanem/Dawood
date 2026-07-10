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
      <label>المستخدم<select id="reportUser"><option value="">الكل</option></select></label>
      <label>الصنف<select id="reportItem"><option value="">الكل</option></select></label>
      <label>الطرف<select id="reportParty"><option value="">الكل</option></select></label>
      <label>الحالة<select id="reportStatus"><option value="">الكل</option></select></label>
      <label>بحث<input id="reportSearch"></label>
      <label>تصدير<button class="btn" id="exportReportBtn" type="button">Excel</button></label>
    </div>
    <p class="hint">الفلاتر ذكية: اختيار أي فلتر يضبط خيارات الفلاتر الأخرى حسب البيانات المتبقية.</p>
    <div id="reportKpis" class="grid four"></div>
    <div id="reportResult" style="margin-top:14px"></div>
  </section>`;
  const ctx = { users, warehouses, items, customers, suppliers };
  const state = { rawRows:[], rows:[], type:`` };

  async function loadTypeRows(){
    const type = $(`#reportType`, root).value;
    if(type !== state.type){
      state.type = type;
      state.rawRows = await erp.list(reportCollections[type], { includeDeleted:true });
      [`reportUser`,`reportItem`,`reportParty`,`reportStatus`].forEach(id=>{ const el=$(`#${id}`,root); if(el) el.value=``; });
    }
  }
  const filters = {
    reportUser: row => userValues(row),
    reportItem: row => itemValues(row),
    reportParty: row => partyValues(row),
    reportStatus: row => [row.status || row.approvalStatus || ``]
  };
  const labels = {
    reportUser: value => users.find(u=>u.id===value)?.fullName || value,
    reportItem: value => items.find(i=>i.id===value)?.itemName || value,
    reportParty: value => customers.find(c=>c.id===value)?.customerName || suppliers.find(s=>s.id===value)?.supplierName || value,
    reportStatus: value => statusText(value)
  };
  function dateText(row){ return String(row.date || row.createdAt || row.countDate || row.salaryMonth || ``).slice(0,10); }
  function matchesFilter(row, key){
    const value=$(`#${key}`,root)?.value || ``; if(!value) return true;
    return filters[key](row).map(String).includes(String(value));
  }
  function filterRows(excludeKey=``){
    const from=$(`#fromDate`,root).value, to=$(`#toDate`,root).value, q=$(`#reportSearch`,root).value.trim().toLowerCase();
    return state.rawRows.filter(row=>{
      const d=dateText(row);
      const dateOk=(!from || !d || d>=from) && (!to || !d || d<=to);
      const textOk=!q || JSON.stringify(row).toLowerCase().includes(q);
      const selectOk=Object.keys(filters).every(key=>key===excludeKey || matchesFilter(row,key));
      return dateOk && textOk && selectOk;
    });
  }
  function refreshOptions(){
    Object.keys(filters).forEach(key=>{
      const el=$(`#${key}`,root); if(!el) return;
      const current=el.value;
      const rows=filterRows(key);
      const values=[...new Set(rows.flatMap(row=>filters[key](row)).filter(v=>v!==undefined && v!==null && String(v)!==``).map(String))].sort((a,b)=>labels[key](a).localeCompare(labels[key](b),`ar`));
      el.innerHTML=`<option value="">الكل</option>${values.map(v=>`<option value="${esc(v)}" ${v===current?`selected`:``}>${esc(labels[key](v))}</option>`).join(``)}`;
      if(current && !values.includes(current)) el.value=``;
    });
  }
  async function refresh(){
    await loadTypeRows();
    refreshOptions();
    const rows=filterRows();
    state.rows=rows;
    $(`#reportKpis`, root).innerHTML = kpis(state.type, rows);
    $(`#reportResult`, root).innerHTML = renderReport(state.type, rows, ctx);
  }
  root.addEventListener(`input`, e => { if([`reportType`,`fromDate`,`toDate`,`reportSearch`].includes(e.target.id)) refresh(); });
  root.addEventListener(`change`, e => { if([`reportType`,`reportUser`,`reportItem`,`reportParty`,`reportStatus`,`fromDate`,`toDate`].includes(e.target.id)) refresh(); });
  $(`#exportReportBtn`, root).addEventListener(`click`, () => exportExcel(`${$(`#reportType`,root).value}.xls`, state.rows));
  await refresh();
}
function statusText(status){ const div=document.createElement(`div`); div.innerHTML=statusBadge(status); return div.textContent || status || `غير محدد`; }
function userValues(row){ return [row.userId,row.employeeId,row.repId,row.sellerId,row.senderId,row.receiverId,row.confirmedBy,row.createdBy,row.updatedBy].filter(Boolean); }
function itemValues(row){ return [row.itemId, ...(Array.isArray(row.items)?row.items.map(x=>x.itemId):[])].filter(Boolean); }
function partyValues(row){ return [row.customerId,row.supplierId,row.customerDebtId].filter(Boolean); }
function kpis(type, rows){
  const total = rows.length;
  const amount = sum(rows, r => r.total || r.amount || r.remainingAmount || r.shortageValue || r.netSalary || r.entitlement || 0);
  const confirmed = rows.filter(r=>[`confirmed`,`paid`,`active`,`approved`].includes(r.status || r.approvalStatus)).length;
  const pending = rows.filter(r=>(r.status || r.approvalStatus)===`pending`).length;
  return [card(`عدد السجلات`, total), card(`القيمة`, money(amount)), card(`معتمد/فعال`, confirmed), card(`بانتظار`, pending)].join(``);
}
function card(label,value){ return `<section class="card kpi"><div><div class="label">${esc(label)}</div><div class="num">${esc(value)}</div></div></section>`; }
function renderReport(type, rows, ctx){
  if(type===`inventory`) return table([{label:`الكود`,value:`itemCode`},{label:`الصنف`,value:`itemName`},{label:`الفئة`,value:`category`},{label:`القيمة`,value:r=>money(Object.values(r.stock||{}).reduce((s,v)=>s+number(v),0)*number(r.costPrice))},{label:`الرصيد`,value:r=>qty(Object.values(r.stock||{}).reduce((s,v)=>s+number(v),0))},{label:`الحالة`,value:r=>statusBadge(r.status)}],rows);
  if(type===`logs`) return table([{label:`الإجراء`,value:`actionType`},{label:`المستخدم`,value:`userName`},{label:`الدور`,value:`userRole`},{label:`الموديول`,value:`module`},{label:`التاريخ`,value:`createdAt`},{label:`ملاحظات`,value:`notes`}],rows,`لا توجد سجلات`);
  if(type===`sales`) return table([{label:`رقم`,value:`invoiceNumber`},{label:`التاريخ`,value:`date`},{label:`العميل`,value:`customerName`},{label:`البائع`,value:`sellerName`},{label:`الإجمالي`,value:r=>money(r.total)},{label:`المدفوع`,value:r=>money(r.paidAmount)},{label:`المتبقي`,value:r=>money(r.remainingDebt)},{label:`الحالة`,value:r=>statusBadge(r.status)}],rows,`لا توجد مبيعات`);
  return table([{label:`الرقم`,value:r=>esc(r.invoiceNumber||r.purchaseNumber||r.productionNumber||r.deliveryNumber||r.transferNumber||r.movementNumber||r.id)},{label:`التاريخ`,value:r=>esc(r.date||r.createdAt||r.countDate||r.salaryMonth||`—`)},{label:`الطرف`,value:r=>esc(r.customerName||r.supplierName||r.employeeName||r.senderName||r.receiverName||r.userName||`—`)},{label:`القيمة`,value:r=>money(r.total||r.amount||r.remainingAmount||r.shortageValue||r.netSalary||r.entitlement||0)},{label:`الحالة`,value:r=>statusBadge(r.status||r.approvalStatus)}],rows,`لا توجد بيانات ضمن الفلاتر الحالية`);
}
