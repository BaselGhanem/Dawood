import { erp } from './firebase.js';
import { $, esc, money, number, uid, todayISO, getFormData, toast, table, statusBadge, renderTabs, attachTabs, exportExcel } from './utils.js';
import { can, isSuperuser } from './permissions.js';

export async function renderFinance(root, user) {
  const isRep = user.role === `sales_rep`;
  const [rawUsers, rawDeliveries, rawTransfers, rawAdvances, rawSalaries, rawExpenses] = await Promise.all([
    isRep ? erp.userDirectory() : erp.safeList(`users`),
    erp.safeList(`cashDeliveries`, { includeDeleted:true }),
    erp.safeList(`internalTransfers`, { includeDeleted:true }),
    erp.safeList(`employeeAdvances`, { includeDeleted:true }),
    erp.safeList(`salaries`, { includeDeleted:true }),
    erp.safeList(`vehicleExpenses`, { includeDeleted:true })
  ]);
  const users = mergeCurrentUser(rawUsers, user);
  const deliveries = isRep ? rawDeliveries.filter(d => d.senderId === user.id || d.receiverId === user.id) : rawDeliveries;
  const transfers = isRep ? rawTransfers.filter(t => t.senderId === user.id || t.receiverId === user.id) : rawTransfers;
  const advances = isRep ? rawAdvances.filter(a => a.employeeId === user.id) : rawAdvances;
  const salaries = isRep ? rawSalaries.filter(s => s.employeeId === user.id) : rawSalaries;
  const expenses = isRep ? rawExpenses.filter(x => x.repId === user.id) : rawExpenses;
  const tabs = user.role === `sales_rep`
    ? [{id:`delivery`,label:`تسليم نقد`},{id:`transfer`,label:`تحويل مصاري`},{id:`incoming`,label:`إشعاراتي`},{id:`advances`,label:`سلفة`},{id:`salary`,label:`راتبي`}]
    : [{id:`delivery`,label:`تسليم نقد`},{id:`confirm`,label:`تأكيد الاستلام`},{id:`transfer`,label:`تحويل داخلي`},{id:`incoming`,label:`موافقات التحويل`},{id:`advances`,label:`السلف`},{id:`salaries`,label:`الرواتب`},{id:`expenses`,label:`مصروف سيارة`}];
  const active = tabs[0].id;
  root.innerHTML = `<section class="card">${renderTabs(tabs, active)}
    <div class="panel ${active===`delivery`?`active`:``}" data-panel="delivery">${deliveryPanel(users, user)}</div>
    <div class="panel" data-panel="confirm">${confirmPanel(deliveries, transfers, user)}</div>
    <div class="panel ${active===`transfer`?`active`:``}" data-panel="transfer">${transferPanel(users, user)}</div>
    <div class="panel" data-panel="incoming">${incomingTransfersPanel(transfers, user)}</div>
    <div class="panel" data-panel="advances">${advancesPanel(users, advances, user)}</div>
    <div class="panel" data-panel="salaries">${salariesPanel(users, salaries, user)}</div>
    <div class="panel" data-panel="salary">${mySalaryPanel(user, advances, salaries)}</div>
    <div class="panel" data-panel="expenses">${expensesPanel(users, expenses, user)}</div>
  </section>`;
  attachTabs(root);
  bindFinance(root, users, deliveries, transfers, expenses, user);
}
function activeUsers(users){ return users.filter(u => ![`inactive`,`deleted`].includes(u.status)); }
function mergeCurrentUser(users, user) {
  const map = new Map((users || []).map(u => [u.id, u]));
  if (user?.id) map.set(user.id, { ...(map.get(user.id) || {}), ...user });
  return [...map.values()];
}
function legacyUserId(user){ return ({dawood:`u-dawood`,moatasem:`u-moatasem`,general_manager:`u-khader`})[user?.role] || ``; }
function deliveryTargetsUser(delivery, user){
  if (!delivery || !user) return false;
  if (delivery.receiverId === user.id) return true;
  if (delivery.receiverEmail && user.email && String(delivery.receiverEmail).trim().toLowerCase() === String(user.email).trim().toLowerCase()) return true;
  return Boolean(legacyUserId(user) && delivery.receiverId === legacyUserId(user));
}
function canActOnDelivery(d, user){ return d.status===`pending` && deliveryTargetsUser(d,user); }
function transferTargetsUser(transfer,user){
  if (!transfer || !user) return false;
  if (transfer.receiverId === user.id) return true;
  if (transfer.receiverEmail && user.email && String(transfer.receiverEmail).trim().toLowerCase() === String(user.email).trim().toLowerCase()) return true;
  return Boolean(legacyUserId(user) && transfer.receiverId === legacyUserId(user));
}
function canReviewExpense(expense,user){ return Boolean(expense) && (expense.approvalStatus||expense.status)===`pending` && (isSuperuser(user)||can(user,`approve`)||can(user,`finance`)); }
function deliveryPanel(users,user){
  const list=activeUsers(users);
  const senderOptions = isSuperuser(user) || can(user,`finance`) ? list : list.filter(u=>u.id===user.id);
  let receivers=list.filter(u=>[`dawood`,`moatasem`,`admin`,`finance_user`,`accountant`].includes(u.role));
  if (!receivers.length) receivers = list.filter(u=>u.id!==user.id);
  return `<div class="hint">تسليم النقد يخصم من المرسل فوراً كرصيد معلّق. إذا رفض المستلم، يرجع المبلغ للمرسل.</div><form id="deliveryForm" class="form-grid">
    <label>رقم التسليم<input name="deliveryNumber" value="${uid(`DEL`)}" readonly></label>
    <label>التاريخ<input name="date" type="date" value="${todayISO()}"></label>
    <label>المرسل<select name="senderId">${senderOptions.map(u=>`<option value="${esc(u.id)}" ${u.id===user.id?`selected`:``}>${esc(u.fullName)}</option>`).join(``)}</select></label>
    <label>المستلم<select name="receiverId">${receivers.map(u=>`<option value="${esc(u.id)}">${esc(u.fullName)}</option>`).join(``)}</select></label>
    <label>النوع<select name="deliveryType"><option value="cash">نقد</option><option value="cliq">CliQ</option><option value="bank">تحويل بنكي</option></select></label>
    <label>المبلغ<input name="amount" type="number" min="0.001" step="0.001" required></label>
    <label class="wide">ملاحظات<textarea name="notes"></textarea></label>
    <button class="btn primary" type="submit">إرسال طلب التسليم</button>
  </form>`;
}
function confirmPanel(deliveries, transfers, user){
  const visibleDeliveries = isSuperuser(user) ? deliveries : deliveries.filter(d => deliveryTargetsUser(d,user) || d.senderId === user.id);
  const visibleTransfers = (isSuperuser(user) ? transfers : transfers.filter(t => transferTargetsUser(t,user) || t.senderId === user.id)).map(t=>({...t,deliveryNumber:t.transferNumber,deliveryType:t.balanceField===`cliqBalance`?`CliQ`:`نقد`,recordType:`transfer`}));
  const visible = [...visibleDeliveries.map(d=>({...d,recordType:`delivery`})),...visibleTransfers];
  return `<div class="actions"><button class="btn" id="exportDeliveriesBtn">تصدير التسليمات</button></div><br>${table([
    {label:`رقم`,value:`deliveryNumber`},{label:`المصدر`,value:r=>r.recordType===`transfer`?`تحويل داخلي`:`تسليم نقد`},{label:`المرسل`,value:`senderName`},{label:`المستلم`,value:`receiverName`},{label:`النوع`,value:`deliveryType`},{label:`المبلغ`,value:r=>money(r.amount)},{label:`الحالة`,value:r=>statusBadge(r.status)},
    {label:`إجراء`,value:r=>r.recordType===`transfer`?(r.status===`pending`&&transferTargetsUser(r,user)?`<button class="btn green" data-accept-transfer="${esc(r.id)}">تأكيد</button> <button class="btn danger" data-reject-transfer="${esc(r.id)}">رفض</button>`:`—`):(canActOnDelivery(r,user)?`<button class="btn green" data-confirm-delivery="${esc(r.id)}">تأكيد</button> <button class="btn danger" data-reject-delivery="${esc(r.id)}">رفض</button>`:`—`)}
  ],visible,`لا توجد تسليمات`)}`;
}
function transferPanel(users, user){
  const list=activeUsers(users); const senderOptions = isSuperuser(user) ? list : list.filter(u => u.id === user.id);
  return `<div class="hint">التحويل يخصم من المرسل فوراً. إذا رفض المستلم، يرجع المبلغ تلقائياً.</div><form id="transferForm" class="form-grid">
    <label>رقم التحويل<input name="transferNumber" value="${uid(`TRN`)}" readonly></label>
    <label>التاريخ<input name="date" type="date" value="${todayISO()}"></label>
    <label>من مستخدم<select name="senderId" id="transferSenderId">${senderOptions.map(u=>`<option value="${esc(u.id)}" ${u.id===user.id?`selected`:``}>${esc(u.fullName)}</option>`).join(``)}</select></label>
    <label>إلى مستخدم<select name="receiverId" id="transferReceiverId">${list.map(u=>`<option value="${esc(u.id)}" ${u.id===user.id?`disabled`:``}>${esc(u.fullName)}</option>`).join(``)}</select></label>
    <label>نوع الرصيد<select name="balanceField"><option value="cashBalance">نقد</option><option value="cliqBalance">CliQ</option></select></label>
    <label>المبلغ<input name="amount" type="number" min="0.001" step="0.001" required></label>
    <label class="wide">ملاحظات<textarea name="notes"></textarea></label>
    <button class="btn primary" type="submit">إرسال التحويل</button>
  </form>`;
}
function incomingTransfersPanel(transfers, user){
  const rows = isSuperuser(user) ? transfers : transfers.filter(t => t.receiverId === user.id || t.senderId === user.id);
  return `<div class="actions"><button class="btn" id="exportTransfersBtn">تصدير التحويلات</button></div><br>${table([
    {label:`رقم`, value:`transferNumber`}, {label:`من`, value:`senderName`}, {label:`إلى`, value:`receiverName`}, {label:`الرصيد`, value:r=>r.balanceField===`cliqBalance`?`CliQ`:`نقد`}, {label:`المبلغ`, value:r=>money(r.amount)}, {label:`الحالة`, value:r=>statusBadge(r.status)},
    {label:`إجراء`, value:r=>r.status===`pending` && transferTargetsUser(r,user) ? `<button class="btn green" data-accept-transfer="${esc(r.id)}">موافقة</button> <button class="btn danger" data-reject-transfer="${esc(r.id)}">رفض</button>` : `—`}
  ], rows, `لا توجد تحويلات`)}`;
}
function advancesPanel(users, advances, user){
  const employeeOptions = isSuperuser(user) ? users : users.filter(u=>u.id===user.id);
  return `<div class="hint">السلفة من صندوق المستخدم: تخصم من رصيد الصندوق وتزيد رصيد السلف مباشرة بدون اعتماد.</div><form id="advanceForm" class="form-grid">
    <label>الموظف<select name="employeeId">${employeeOptions.map(u=>`<option value="${esc(u.id)}" ${u.id===user.id?`selected`:``}>${esc(u.fullName)}</option>`).join(``)}</select></label>
    <label>التاريخ<input name="date" type="date" value="${todayISO()}"></label>
    <label>المصدر<select name="source"><option value="cash_advance">سلفة من الصندوق</option><option value="stock_shortage">نقص جرد</option><option value="deduction">اقتطاع</option><option value="other">أخرى</option></select></label>
    <label>المبلغ<input name="amount" type="number" min="0.001" step="0.001" required></label>
    <label class="wide">ملاحظات<textarea name="notes"></textarea></label>
    <button class="btn primary" type="submit">تسجيل السلفة</button>
  </form><br>${table([{label:`الموظف`,value:r=>esc(users.find(u=>u.id===r.employeeId)?.fullName||`—`)},{label:`المصدر`,value:`source`},{label:`المبلغ`,value:r=>money(r.amount)},{label:`التاريخ`,value:`date`},{label:`الحالة`,value:r=>statusBadge(r.status)}], isSuperuser(user)?advances:advances.filter(a=>a.employeeId===user.id),`لا توجد سلف`)}`;
}
function salariesPanel(users,salaries,user){
  const payers=activeUsers(users).filter(u=>[`dawood`,`moatasem`,`admin`,`finance_user`,`accountant`].includes(u.role));
  return `<form id="salaryForm" class="form-grid">
    <label>الشهر<input name="salaryMonth" type="month" value="${todayISO().slice(0,7)}"></label>
    <label>الموظف<select name="employeeId">${users.map(u=>`<option value="${esc(u.id)}">${esc(u.fullName)}</option>`).join(``)}</select></label>
    <label>صندوق الصرف<select name="payerId"><option value="">بدون خصم من صندوق</option>${payers.map(u=>`<option value="${esc(u.id)}" ${u.id===user.id?`selected`:``}>${esc(u.fullName)} - ${money(u.cashBalance)}</option>`).join(``)}</select></label>
    <label>بونص<input name="bonus" type="number" step="0.001" value="0"></label>
    <label>اقتطاعات إضافية<input name="deductions" type="number" step="0.001" value="0"></label>
    <label>المبلغ المصروف فعلياً<input name="paidAmount" type="number" step="0.001" value="0"></label>
    <label class="wide">ملاحظات<textarea name="notes"></textarea></label>
    <button class="btn primary" type="submit">ترحيل الراتب</button>
  </form><br>${table([{label:`الشهر`,value:`salaryMonth`},{label:`الموظف`,value:`employeeName`},{label:`الراتب`,value:r=>money(r.baseSalary)},{label:`السلف`,value:r=>money(r.advancesDeducted)},{label:`البونص`,value:r=>money(r.bonus)},{label:`المستحق`,value:r=>money(r.entitlement)},{label:`المصروف`,value:r=>money(r.paidAmount)},{label:`صندوق الصرف`,value:`payerName`},{label:`رصيد الراتب بعد الحركة`,value:r=>money(r.salaryBalanceAfter)},{label:`الحالة`,value:r=>statusBadge(r.status)}],salaries,`لا توجد رواتب`)}`;
}
function mySalaryPanel(user, advances, salaries){ const remaining = number(user.salaryBalance) + number(user.normalMonthlySalary) - number(user.advancesBalance); return `<div class="grid four"><section class="card kpi"><div><div class="label">راتبي الشهري</div><div class="num">${money(user.normalMonthlySalary)}</div></div></section><section class="card kpi"><div><div class="label">السلف الحالية</div><div class="num">${money(user.advancesBalance)}</div></div></section><section class="card kpi"><div><div class="label">رصيد راتب سابق</div><div class="num">${money(user.salaryBalance)}</div></div></section><section class="card kpi"><div><div class="label">المتبقي التقريبي</div><div class="num">${money(remaining)}</div></div></section></div><br>${table([{label:`الشهر`,value:`salaryMonth`},{label:`المستحق`,value:r=>money(r.entitlement)},{label:`المصروف`,value:r=>money(r.paidAmount)},{label:`بعد الحركة`,value:r=>money(r.salaryBalanceAfter)}],salaries.filter(s=>s.employeeId===user.id),`لا توجد حركات راتب`)}`; }
function expensesPanel(users,expenses,user){ return `<div class="hint">يُحفظ المصروف بانتظار التأكيد، ولا يُخصم من المندوب إلا عند اعتماده.</div><form id="expenseForm" class="form-grid"><label>المندوب<select name="repId">${users.filter(u=>u.role===`sales_rep`).map(u=>`<option value="${esc(u.id)}">${esc(u.fullName)}</option>`).join(``)}</select></label><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>نوع المصروف<select name="expenseType"><option value="tool">أداة</option><option value="maintenance">صيانة سيارة</option><option value="fuel">محروقات</option><option value="misc">متفرقات</option></select></label><label>المبلغ<input name="amount" type="number" min="0.001" step="0.001" required></label><label>المورد/الجهة<input name="vendor"></label><label class="wide">ملاحظات<textarea name="notes"></textarea></label><button class="btn primary" type="submit">حفظ مصروف السيارة</button></form><br>${table([{label:`المندوب`,value:r=>esc(users.find(u=>u.id===r.repId)?.fullName||`—`)},{label:`النوع`,value:`expenseType`},{label:`المبلغ`,value:r=>money(r.amount)},{label:`الجهة`,value:`vendor`},{label:`الحالة`,value:r=>statusBadge(r.approvalStatus||r.status)},{label:`إجراء`,value:r=>canReviewExpense(r,user)?`<button class="btn green" data-approve-expense="${esc(r.id)}">اعتماد</button> <button class="btn danger" data-reject-expense="${esc(r.id)}">رفض</button>`:`—`}],expenses,`لا توجد مصاريف سيارات`)}`; }

function bindFinance(root, users, deliveries, transfers, expenses, user){
  $(`#deliveryForm`,root)?.addEventListener(`submit`,async e=>{
    e.preventDefault(); const d=getFormData(e.target); const amount=number(d.amount); const sender=users.find(u=>u.id===d.senderId), receiver=users.find(u=>u.id===d.receiverId); if(!sender||!receiver) return toast(`اختر المرسل والمستلم`,`err`); if(sender.id===receiver.id) return toast(`لا يمكن التسليم لنفس المستخدم`,`err`);
    const field=d.deliveryType===`cliq`?`cliqBalance`:`cashBalance`;
    if(number(sender[field])<amount && !isSuperuser(user)) return toast(`لا يوجد رصيد كافي للتسليم`,`err`);
    await erp.adjustUserBalance(sender.id,field,-amount,`تسليم نقد صادر بانتظار تأكيد المستلم`);
    const delivery=await erp.add(`cashDeliveries`,{...d,amount,senderName:sender.fullName,senderEmail:sender.email||``,receiverName:receiver.fullName,receiverEmail:receiver.email||``,balanceField:field,senderDebited:true,status:`pending`});
    await erp.add(`notifications`,{userId:receiver.id,title:`تسليم نقد جديد`,message:`وصلك طلب تسليم من ${sender.fullName} بقيمة ${money(amount)} ويحتاج تأكيدك.`,relatedType:`cashDeliveries`,relatedId:delivery.id,status:`unread`,createdAt:new Date().toISOString()});
    toast(`تم إرسال طلب التسليم وخصمه من المرسل لحين التأكيد`); location.reload();
  });
  $(`#transferSenderId`,root)?.addEventListener(`change`,()=>{ const senderId=$(`#transferSenderId`,root).value; [...$(`#transferReceiverId`,root).options].forEach(o=>o.disabled=o.value===senderId); if($(`#transferReceiverId`,root).value===senderId) $(`#transferReceiverId`,root).value=[...$(`#transferReceiverId`,root).options].find(o=>!o.disabled)?.value||``; });
  $(`#transferForm`,root)?.addEventListener(`submit`,async e=>{
    e.preventDefault(); const d=getFormData(e.target); const amount=number(d.amount); const sender=users.find(u=>u.id===d.senderId), receiver=users.find(u=>u.id===d.receiverId);
    if(!sender || !receiver) return toast(`اختر المرسل والمستلم`,`err`); if(sender.id===receiver.id) return toast(`لا يمكن التحويل لنفس المستخدم`,`err`);
    if(number(sender[d.balanceField])<amount && !isSuperuser(user)) return toast(`لا يوجد رصيد كافي للتحويل`,`err`);
    await erp.adjustUserBalance(sender.id,d.balanceField,-amount,`تحويل داخلي صادر بانتظار موافقة المستلم`);
    const transfer=await erp.add(`internalTransfers`,{...d,amount,senderName:sender.fullName,senderEmail:sender.email||``,receiverName:receiver.fullName,receiverEmail:receiver.email||``,status:`pending`,senderDebited:true,requiresReceiverApproval:true});
    await erp.add(`notifications`,{userId:receiver.id,title:`حوالة جديدة`,message:`وصلتك حوالة من ${sender.fullName} بقيمة ${money(amount)} وتحتاج موافقتك.`,relatedType:`internalTransfers`,relatedId:transfer.id,status:`unread`,createdAt:new Date().toISOString()});
    toast(`تم إرسال التحويل وخصمه من المرسل لحين موافقة المستلم`); location.reload();
  });
  $(`#advanceForm`,root)?.addEventListener(`submit`,async e=>{
    e.preventDefault(); const d=getFormData(e.target); const amount=number(d.amount); const emp=users.find(u=>u.id===d.employeeId); if(!emp) return toast(`الموظف غير موجود`,`err`);
    if(emp.id!==user.id && !isSuperuser(user)) return toast(`السلفة الذاتية من حساب صاحبها فقط`,`err`);
    if(number(emp.cashBalance)<amount && !isSuperuser(user)) return toast(`لا يوجد رصيد كافي في الصندوق`,`err`);
    await erp.add(`employeeAdvances`,{...d,amount,status:`confirmed`,fromOwnCashbox:true});
    await erp.adjustUserBalance(emp.id,`cashBalance`,-amount,`سلفة من صندوق المستخدم`);
    await erp.adjustUserBalance(emp.id,`advancesBalance`,amount,`تسجيل سلفة تخصم من الراتب`);
    toast(`تم تسجيل السلفة وخصمها من الصندوق`); location.reload();
  });
  $(`#salaryForm`,root)?.addEventListener(`submit`,async e=>{
    e.preventDefault(); const d=getFormData(e.target); const emp=users.find(u=>u.id===d.employeeId); if(!emp) return toast(`الموظف غير موجود`,`err`);
    const payer=d.payerId ? users.find(u=>u.id===d.payerId) : null;
    const base=number(emp.normalMonthlySalary), previousBalance=number(emp.salaryBalance), advancesDeducted=number(emp.advancesBalance);
    const entitlement=base+number(d.bonus)-number(d.deductions)-advancesDeducted;
    const paidAmount=number(d.paidAmount);
    const salaryBalanceAfter=previousBalance+entitlement-paidAmount;
    if(payer && paidAmount>0 && number(payer.cashBalance)<paidAmount && !isSuperuser(user)) return toast(`رصيد صندوق الصرف غير كافٍ`,`err`);
    await erp.add(`salaries`,{...d,employeeName:emp.fullName,payerName:payer?.fullName||`بدون خصم صندوق`,baseSalary:base,previousSalaryBalance:previousBalance,advancesDeducted,bonus:number(d.bonus),deductions:number(d.deductions),entitlement,paidAmount,salaryBalanceAfter,status:`confirmed`,date:todayISO()});
    await erp.update(`users`,emp.id,{advancesBalance:0,salaryBalance:salaryBalanceAfter});
    if(payer && paidAmount>0) await erp.adjustUserBalance(payer.id,`cashBalance`,-paidAmount,`صرف راتب ${emp.fullName}`);
    toast(`تم ترحيل الراتب ككشف حساب تراكمي`); location.reload();
  });
  $(`#expenseForm`,root)?.addEventListener(`submit`,async e=>{ e.preventDefault(); const d=getFormData(e.target); const amount=number(d.amount); await erp.add(`vehicleExpenses`,{...d,amount,approvalStatus:`pending`,status:`pending`,cashDeducted:false}); toast(`تم حفظ المصروف وبانتظار التأكيد`); location.reload(); });
  root.addEventListener(`click`,async e=>{
    const c=e.target.closest(`[data-confirm-delivery]`); const r=e.target.closest(`[data-reject-delivery]`); const a=e.target.closest(`[data-accept-transfer]`); const tr=e.target.closest(`[data-reject-transfer]`); const approveExpense=e.target.closest(`[data-approve-expense]`); const rejectExpense=e.target.closest(`[data-reject-expense]`);
    if(c){ const d=deliveries.find(x=>x.id===c.dataset.confirmDelivery); if(!canActOnDelivery(d,user)) return toast(`التأكيد من حساب المستلم فقط`,`err`); const field=d.balanceField || (d.deliveryType===`cliq`?`cliqBalance`:`cashBalance`); if(!d.senderDebited) await erp.adjustUserBalance(d.senderId,field,-number(d.amount),`تسليم نقد مؤكد - قيد قديم`,d.id); await erp.adjustUserBalance(user.id,field,number(d.amount),`استلام نقد مؤكد`,d.id); await erp.update(`cashDeliveries`,d.id,{receiverId:user.id,receiverEmail:user.email||d.receiverEmail||``,status:`confirmed`,confirmedAt:new Date().toISOString(),confirmedBy:user.id}); toast(`تم تأكيد الاستلام`); location.reload(); }
    if(r){ const d=deliveries.find(x=>x.id===r.dataset.rejectDelivery); if(!canActOnDelivery(d,user)) return toast(`الرفض من حساب المستلم فقط`,`err`); const field=d.balanceField || (d.deliveryType===`cliq`?`cliqBalance`:`cashBalance`); if(d.senderDebited) await erp.adjustUserBalance(d.senderId,field,number(d.amount),`إرجاع تسليم نقد مرفوض`,d.id); await erp.update(`cashDeliveries`,d.id,{receiverId:user.id,receiverEmail:user.email||d.receiverEmail||``,status:`rejected`,rejectedAt:new Date().toISOString(),rejectedBy:user.id}); toast(`تم رفض التسليم ورجوع المبلغ للمرسل`,`warn`); location.reload(); }
    if(approveExpense){ const expense=expenses.find(x=>x.id===approveExpense.dataset.approveExpense); if(!canReviewExpense(expense,user)) return toast(`لا تملك صلاحية اعتماد هذا المصروف`,`err`); if(expense.cashDeducted===false) await erp.adjustUserBalance(expense.repId,`cashBalance`,-number(expense.amount),`اعتماد مصروف سيارة`,expense.id); await erp.update(`vehicleExpenses`,expense.id,{approvalStatus:`approved`,status:`approved`,cashDeducted:true,approvedAt:new Date().toISOString(),approvedBy:user.id}); toast(`تم اعتماد المصروف وخصمه من المندوب`); location.reload(); }
    if(rejectExpense){ const expense=expenses.find(x=>x.id===rejectExpense.dataset.rejectExpense); if(!canReviewExpense(expense,user)) return toast(`لا تملك صلاحية رفض هذا المصروف`,`err`); if(expense.cashDeducted!==false) await erp.adjustUserBalance(expense.repId,`cashBalance`,number(expense.amount),`إرجاع مصروف سيارة مرفوض`,expense.id); await erp.update(`vehicleExpenses`,expense.id,{approvalStatus:`rejected`,status:`rejected`,cashDeducted:false,rejectedAt:new Date().toISOString(),rejectedBy:user.id}); toast(`تم رفض المصروف وإرجاع أي مبلغ مخصوم`,`warn`); location.reload(); }
    if(a){ const d=transfers.find(x=>x.id===a.dataset.acceptTransfer); if(!transferTargetsUser(d,user)||d.status!==`pending`) return toast(`الموافقة من حساب المستلم فقط`,`err`); await erp.adjustUserBalance(user.id,d.balanceField,number(d.amount),`تحويل داخلي وارد مؤكد`,d.id); await erp.update(`internalTransfers`,d.id,{receiverId:user.id,receiverEmail:user.email||d.receiverEmail||``,status:`confirmed`,confirmedAt:new Date().toISOString(),confirmedBy:user.id}); toast(`تم قبول الحوالة وإضافتها لصندوقك`); location.reload(); }
    if(tr){ const d=transfers.find(x=>x.id===tr.dataset.rejectTransfer); if(!transferTargetsUser(d,user)||d.status!==`pending`) return toast(`الرفض من حساب المستلم فقط`,`err`); await erp.adjustUserBalance(d.senderId,d.balanceField,number(d.amount),`إرجاع حوالة مرفوضة`,d.id); await erp.update(`internalTransfers`,d.id,{receiverId:user.id,receiverEmail:user.email||d.receiverEmail||``,status:`rejected`,rejectedAt:new Date().toISOString(),rejectedBy:user.id}); toast(`تم رفض الحوالة ورجوع المبلغ للمرسل`,`warn`); location.reload(); }
    if(e.target.closest(`#exportDeliveriesBtn`)) exportExcel(`cash-deliveries.xls`, await erp.list(`cashDeliveries`, { includeDeleted:true }));
    if(e.target.closest(`#exportTransfersBtn`)) exportExcel(`internal-transfers.xls`, await erp.list(`internalTransfers`, { includeDeleted:true }));
  });
}
