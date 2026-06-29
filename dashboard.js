import { erp } from './firebase.js';
import { esc, money, qty, sum, table, statusBadge, dateTime } from './utils.js';

export async function renderDashboard(root, user) {
  const [items, users, sales, customerDebts, supplierDebts, deliveries, production, counts] = await Promise.all([
    erp.list(`items`), erp.list(`users`), erp.list(`salesInvoices`), erp.list(`customerDebts`), erp.list(`supplierDebts`), erp.list(`cashDeliveries`), erp.list(`productionOrders`), erp.list(`stockCounts`)
  ]);
  const totalInventory = items.reduce((t, item) => t + Object.values(item.stock || {}).reduce((s,v)=>s+Number(v||0),0) * Number(item.costPrice||0), 0);
  const totalCash = sum(users, u => Number(u.cashBalance||0) + Number(u.cliqBalance||0));
  const receivables = sum(customerDebts.filter(d => d.status !== `paid`), `remainingAmount`);
  const payables = sum(supplierDebts.filter(d => d.status !== `paid`), `remainingAmount`);
  const advances = sum(users, `advancesBalance`);
  const dailySales = sum(sales.filter(s => String(s.date||``).slice(0,10) === new Date().toISOString().slice(0,10)), `total`);
  const lowStock = items.filter(item => Object.values(item.stock || {}).reduce((s,v)=>s+Number(v||0),0) <= Number(item.minimumStock||0));
  const pendingDeliveries = deliveries.filter(d => d.status === `pending`);
  const overdue = customerDebts.filter(d => d.status !== `paid` && d.dueDate && d.dueDate < new Date().toISOString().slice(0,10));
  root.innerHTML = `
    <div class="grid four">
      ${kpi(`إجمالي النقد`, money(totalCash), `◍`)}
      ${kpi(`قيمة المخزون`, money(totalInventory), `▦`)}
      ${kpi(`ذمم العملاء`, money(receivables), `◈`)}
      ${kpi(`ذمم الموردين`, money(payables), `▣`)}
      ${kpi(`سلف الموظفين`, money(advances), `◎`)}
      ${kpi(`مبيعات اليوم`, money(dailySales), `●`)}
      ${kpi(`تسليمات بانتظار التأكيد`, pendingDeliveries.length, `⌁`)}
      ${kpi(`أصناف تحت الحد`, lowStock.length, `!`)}
    </div>
    <div class="grid two" style="margin-top:14px">
      <section class="card"><h2>تنبيهات تشغيلية</h2>${renderAlerts(lowStock, overdue, pendingDeliveries)}</section>
      <section class="card"><h2>أحدث الحركات</h2>${table([
        {label:`النوع`, value:r=>esc(r.actionType || r.movementNumber || r.productionNumber || r.invoiceNumber)},
        {label:`المستخدم`, value:r=>esc(r.userName || r.createdBy || `—`)},
        {label:`الوقت`, value:r=>dateTime(r.createdAt || r.date)},
        {label:`الحالة`, value:r=>statusBadge(r.status)}
      ], [...(await erp.list(`systemLogs`, { includeDeleted:true })).slice(0,8)], `لا توجد حركات بعد`)}</section>
    </div>
    <div class="grid three" style="margin-top:14px">
      <section class="card"><h2>أفضل المنتجات حسب الرصيد</h2>${table([
        {label:`الصنف`, value:r=>esc(r.itemName)}, {label:`الرصيد`, value:r=>qty(Object.values(r.stock||{}).reduce((s,v)=>s+Number(v||0),0))}, {label:`القيمة`, value:r=>money(Object.values(r.stock||{}).reduce((s,v)=>s+Number(v||0),0)*Number(r.costPrice||0))}
      ], [...items].sort((a,b)=>Object.values(b.stock||{}).reduce((s,v)=>s+Number(v||0),0)-Object.values(a.stock||{}).reduce((s,v)=>s+Number(v||0),0)).slice(0,6))}</section>
      <section class="card"><h2>آخر أوامر الإنتاج</h2>${table([
        {label:`رقم الأمر`, value:`productionNumber`}, {label:`الإنتاج`, value:r=>qty(r.outputQuantity)}, {label:`الحالة`, value:r=>statusBadge(r.status)}
      ], production.slice(0,6), `لا توجد أوامر إنتاج`)}</section>
      <section class="card"><h2>آخر جرد سيارات</h2>${table([
        {label:`التاريخ`, value:r=>dateTime(r.countDate)}, {label:`الفروقات`, value:r=>money(r.shortageValue || 0)}, {label:`الحالة`, value:r=>statusBadge(r.status)}
      ], counts.slice(0,6), `لا توجد عمليات جرد`)}</section>
    </div>`;
}
function kpi(label, value, icon) { return `<section class="card kpi"><div><div class="label">${esc(label)}</div><div class="num">${esc(value)}</div></div><div class="bubble">${esc(icon)}</div></section>`; }
function renderAlerts(lowStock, overdue, pending) {
  const rows = [];
  rows.push(...lowStock.map(x => `<div class="timeline-item"><strong>مخزون منخفض</strong><span>${esc(x.itemName)} - الرصيد الحالي ${qty(Object.values(x.stock||{}).reduce((s,v)=>s+Number(v||0),0))}</span></div>`));
  rows.push(...overdue.map(x => `<div class="timeline-item"><strong>ذمة متأخرة</strong><span>${esc(x.customerName)} - ${money(x.remainingAmount)}</span></div>`));
  rows.push(...pending.map(x => `<div class="timeline-item"><strong>تسليم نقد</strong><span>${esc(x.senderName)} إلى ${esc(x.receiverName)} - ${money(x.amount)}</span></div>`));
  return rows.length ? `<div class="timeline">${rows.slice(0,10).join(``)}</div>` : `<div class="empty">لا توجد تنبيهات حرجة حالياً</div>`;
}
