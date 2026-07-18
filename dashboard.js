import { erp } from './firebase.js';
import { esc, money, qty, sum, table, statusBadge, dateTime, todayISO, number } from './utils.js';
import { isSuperuser, isViewOnly } from './permissions.js';

export async function renderDashboard(root, user) {
  if (user.role === `sales_rep`) {
    const [items, sales, deliveries, transfers, advances] = await Promise.all([
      erp.safeList(`items`),
      erp.safeList(`salesInvoices`, { where:[[ `sellerId`, `==`, user.id ]] }),
      erp.safeList(`cashDeliveries`, { includeDeleted:true }),
      erp.safeList(`internalTransfers`, { includeDeleted:true }),
      erp.safeList(`employeeAdvances`, { includeDeleted:true })
    ]);
    return renderRepDashboard(root, user, {
      items,
      sales: sales.filter(s => s.sellerId === user.id),
      deliveries: deliveries.filter(d => d.senderId === user.id || d.receiverId === user.id),
      transfers: transfers.filter(t => t.senderId === user.id || t.receiverId === user.id),
      advances: advances.filter(a => a.employeeId === user.id)
    });
  }
  if (isViewOnly(user)) {
    const [items, users, customerDebts, sales, transfers] = await Promise.all([
      erp.safeList(`items`), erp.safeList(`users`), erp.safeList(`customerDebts`), erp.safeList(`salesInvoices`), erp.safeList(`internalTransfers`, { includeDeleted:true })
    ]);
    return renderGeneralManagerDashboard(root, { items, users, customerDebts, sales, transfers });
  }
  const [items, users, sales, customerDebts, supplierDebts, deliveries, transfers, production, counts] = await Promise.all([
    erp.safeList(`items`), erp.safeList(`users`), erp.safeList(`salesInvoices`), erp.safeList(`customerDebts`), erp.safeList(`supplierDebts`), erp.safeList(`cashDeliveries`, { includeDeleted:true }), erp.safeList(`internalTransfers`, { includeDeleted:true }), erp.safeList(`productionOrders`), erp.safeList(`stockCounts`)
  ]);
  return renderSuperDashboard(root, user, { items, users, sales, customerDebts, supplierDebts, deliveries, transfers, production, counts });
}

function renderRepDashboard(root, user, ctx) {
  const ownSales = ctx.sales.filter(s => s.sellerId === user.id);
  const todaySales = sum(ownSales.filter(s => String(s.date || ``).slice(0, 10) === todayISO()), `total`);
  const pendingTransfers = ctx.transfers.filter(t => t.receiverId === user.id && t.status === `pending`);
  const remainingSalary = number(user.salaryBalance) + number(user.normalMonthlySalary) - number(user.advancesBalance);
  root.innerHTML = `
    <section class="hero-card">
      <div><span class="badge teal">مندوب</span><h2>أهلاً ${esc(user.fullName || user.username || `زميلنا`)}</h2><p>بيع نقدي، رصيد الصندوق، تحويل، وسلفة من الصندوق.</p></div>
      <div class="hero-actions"><a class="btn primary" href="sales.html">بيع نقدي</a><a class="btn" href="finance.html">تحويل / سلفة</a></div>
    </section>
    <div class="grid four" style="margin-top:14px">
      ${kpi(`مبيعات اليوم`, money(todaySales), `◈`)}
      ${kpi(`رصيد الصندوق`, money(user.cashBalance), `◍`)}
      ${kpi(`رصيد CliQ`, money(user.cliqBalance), `◌`)}
      ${kpi(`المتبقي من الراتب`, money(remainingSalary), `◎`)}
    </div>
    <div class="grid two" style="margin-top:14px">
      <section class="card"><h2>حوالات بحاجة موافقتك</h2>${table([
        {label:`من`, value:`senderName`}, {label:`المبلغ`, value:r=>money(r.amount)}, {label:`النوع`, value:`balanceField`}, {label:`الحالة`, value:r=>statusBadge(r.status)}
      ], pendingTransfers, `لا توجد حوالات بانتظارك`)}</section>
      <section class="card"><h2>بيعك حسب الصنف</h2>${salesByItem(ownSales, ctx.items)}</section>
    </div>`;
}
function renderGeneralManagerDashboard(root, ctx) {
  const totalStockValue = ctx.items.reduce((t, item) => t + Object.values(item.stock || {}).reduce((s, v) => s + number(v), 0) * number(item.costPrice), 0);
  const totalRemainingSalary = sum(ctx.users, u => number(u.salaryBalance) + number(u.normalMonthlySalary) - number(u.advancesBalance));
  const totalCash = sum(ctx.users, u => number(u.cashBalance) + number(u.cliqBalance));
  const receivables = sum(ctx.customerDebts.filter(d => d.status !== `paid`), `remainingAmount`);
  root.innerHTML = `
    <section class="hero-card"><div><span class="badge green">مشاهدة وتحميل فقط</span><h2>ملخص المدير العام</h2><p>الأرصدة والكشوفات بدون صلاحية تعديل.</p></div></section>
    <div class="grid four" style="margin-top:14px">
      ${kpi(`قيمة المخزون`, money(totalStockValue), `▦`)}
      ${kpi(`أرصدة الصناديق`, money(totalCash), `◍`)}
      ${kpi(`رواتب متبقية`, money(totalRemainingSalary), `◎`)}
      ${kpi(`ذمم العملاء`, money(receivables), `◈`)}
    </div>
    <div class="grid two" style="margin-top:14px">
      <section class="card"><h2>أرصدة كل شخص بالصندوق</h2>${table([
        {label:`الاسم`, value:`fullName`}, {label:`نقد`, value:r=>money(r.cashBalance)}, {label:`CliQ`, value:r=>money(r.cliqBalance)}, {label:`السلف`, value:r=>money(r.advancesBalance)}, {label:`المتبقي من الراتب`, value:r=>money(number(r.salaryBalance)+number(r.normalMonthlySalary)-number(r.advancesBalance))}
      ], ctx.users, `لا يوجد مستخدمون`)}</section>
      <section class="card"><h2>أرصدة الأصناف</h2>${table([
        {label:`الصنف`, value:`itemName`}, {label:`الرصيد`, value:r=>qty(Object.values(r.stock || {}).reduce((s, v) => s + number(v), 0))}, {label:`القيمة`, value:r=>money(Object.values(r.stock || {}).reduce((s, v) => s + number(v), 0) * number(r.costPrice))}
      ], ctx.items, `لا توجد أصناف`)}</section>
    </div>`;
}
function renderSuperDashboard(root, user, ctx) {
  const totalInventory = ctx.items.reduce((t, item) => t + Object.values(item.stock || {}).reduce((s,v)=>s+Number(v||0),0) * Number(item.costPrice||0), 0);
  const totalCash = sum(ctx.users, u => Number(u.cashBalance||0) + Number(u.cliqBalance||0));
  const receivables = sum(ctx.customerDebts.filter(d => d.status !== `paid`), `remainingAmount`);
  const payables = sum(ctx.supplierDebts.filter(d => d.status !== `paid`), `remainingAmount`);
  const advances = sum(ctx.users, `advancesBalance`);
  const dailySales = sum(ctx.sales.filter(s => String(s.date||``).slice(0,10) === todayISO()), `total`);
  const lowStock = ctx.items.filter(item => Object.values(item.stock || {}).reduce((s,v)=>s+Number(v||0),0) <= Number(item.minimumStock||0));
  const pendingDeliveries = ctx.deliveries.filter(d => d.status === `pending`);
  const overdue = ctx.customerDebts.filter(d => d.status !== `paid` && d.dueDate && d.dueDate < todayISO());
  const pendingTransfers = ctx.transfers.filter(t => t.status === `pending`);
  root.innerHTML = `
    <section class="hero-card"><div><span class="badge teal">Superuser</span><h2>التحكم الكامل</h2><p>إدارة المستخدمين، الصلاحيات، الأرصدة، والتقارير من واجهات مختصرة.</p></div><div class="hero-actions"><a class="btn primary" href="admin.html">إدارة المستخدمين</a><a class="btn" href="reports.html">التقارير</a></div></section>
    <div class="grid four" style="margin-top:14px">
      ${kpi(`إجمالي النقد`, money(totalCash), `◍`)}
      ${kpi(`قيمة المخزون`, money(totalInventory), `▦`)}
      ${kpi(`ذمم العملاء`, money(receivables), `◈`)}
      ${kpi(`ذمم الموردين`, money(payables), `▣`)}
      ${kpi(`سلف الموظفين`, money(advances), `◎`)}
      ${kpi(`مبيعات اليوم`, money(dailySales), `●`)}
      ${kpi(`حوالات بانتظار الموافقة`, pendingTransfers.length, `↔`)}
      ${kpi(`أصناف تحت الحد`, lowStock.length, `!`)}
    </div>
    <div class="grid two" style="margin-top:14px">
      <section class="card"><h2>تنبيهات تشغيلية</h2>${renderAlerts(lowStock, overdue, pendingDeliveries, pendingTransfers)}</section>
      <section class="card"><h2>أحدث الحركات</h2>${table([
        {label:`النوع`, value:r=>esc(r.actionType || r.movementNumber || r.productionNumber || r.invoiceNumber)},
        {label:`المستخدم`, value:r=>esc(r.userName || r.createdBy || `—`)},
        {label:`الوقت`, value:r=>dateTime(r.createdAt || r.date)},
        {label:`الحالة`, value:r=>statusBadge(r.status)}
      ], [], `يظهر السجل الكامل في إدارة النظام`)}</section>
    </div>`;
}
function kpi(label, value, icon) { return `<section class="card kpi"><div><div class="label">${esc(label)}</div><div class="num">${esc(value)}</div></div><div class="bubble">${esc(icon)}</div></section>`; }
function renderAlerts(lowStock, overdue, pending, transfers) {
  const rows = [];
  rows.push(...lowStock.map(x => `<div class="timeline-item"><strong>مخزون منخفض</strong><span>${esc(x.itemName)} - الرصيد الحالي ${qty(Object.values(x.stock||{}).reduce((s,v)=>s+Number(v||0),0))}</span></div>`));
  rows.push(...overdue.map(x => `<div class="timeline-item"><strong>ذمة متأخرة</strong><span>${esc(x.customerName)} - ${money(x.remainingAmount)}</span></div>`));
  rows.push(...pending.map(x => `<div class="timeline-item"><strong>تسليم نقد</strong><span>${esc(x.senderName)} إلى ${esc(x.receiverName)} - ${money(x.amount)}</span></div>`));
  rows.push(...transfers.map(x => `<div class="timeline-item"><strong>حوالة بانتظار المستلم</strong><span>${esc(x.senderName)} إلى ${esc(x.receiverName)} - ${money(x.amount)}</span></div>`));
  return rows.length ? `<div class="timeline">${rows.slice(0,10).join(``)}</div>` : `<div class="empty">لا توجد تنبيهات حرجة حالياً</div>`;
}
function salesByItem(sales, items) {
  const map = new Map();
  sales.forEach(inv => (inv.items || []).forEach(line => {
    const item = items.find(i => i.id === line.itemId);
    const key = line.itemId || item?.itemName || `غير محدد`;
    const row = map.get(key) || { itemName:item?.itemName || key, quantity:0, total:0 };
    row.quantity += number(line.quantity);
    row.total += number(line.quantity) * number(line.price);
    map.set(key, row);
  }));
  return table([{label:`الصنف`, value:`itemName`}, {label:`الكمية`, value:r=>qty(r.quantity)}, {label:`القيمة`, value:r=>money(r.total)}], [...map.values()], `لا يوجد بيع بعد`);
}