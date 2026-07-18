import { erp } from './firebase.js';
import { $, esc, money, qty, number, uid, todayISO, getFormData, toast, table, statusBadge, lineBuilder, exportExcel, renderTabs, attachTabs, printHtmlPdf, normalize } from './utils.js';

export async function renderSales(root, user) {
  const isRep = user.role === `sales_rep`;
  const [items, rawCustomers, reps, rawInvoices, rawDebts, collections] = await Promise.all([
    erp.safeList(`items`),
    erp.safeList(`customers`),
    isRep ? erp.userDirectory() : erp.safeList(`users`),
    isRep ? erp.safeList(`salesInvoices`, { where:[[ `sellerId`, `==`, user.id ]] }) : erp.safeList(`salesInvoices`),
    isRep ? erp.safeList(`customerDebts`, { where:[[ `repId`, `==`, user.id ]] }) : erp.safeList(`customerDebts`),
    erp.safeList(`collections`)
  ]);
  const customers = isRep ? rawCustomers.filter(c => !c.responsibleRepId || c.responsibleRepId === user.id) : rawCustomers;
  const invoices = isRep ? rawInvoices.filter(i => i.sellerId === user.id) : rawInvoices;
  const debts = isRep ? rawDebts.filter(d => d.repId === user.id) : rawDebts;
  const tabs = isRep
    ? [{id:`invoice`,label:`بيع نقدي`},{id:`customers`,label:`عملائي`},{id:`myReport`,label:`بيعي بالصنف`},{id:`history`,label:`فواتيري`}]
    : [{id:`invoice`,label:`فاتورة بيع`},{id:`customers`,label:`العملاء`},{id:`debts`,label:`ذمم العملاء`},{id:`myReport`,label:`البيع بالصنف`},{id:`history`,label:`الفواتير`}];
  root.innerHTML = `<section class="card">${renderTabs(tabs,`invoice`)}
    <div class="panel active" data-panel="invoice">${invoicePanel(customers, reps, user)}</div>
    <div class="panel" data-panel="customers">${customersPanel(customers, reps, user)}</div>
    <div class="panel" data-panel="debts">${debtsPanel(debts, user)}</div>
    <div class="panel" data-panel="myReport">${salesByItemPanel(invoices, items, reps, user)}</div>
    <div class="panel" data-panel="history">${historyPanel(filteredSales(invoices, user), customers, reps)}</div>
  </section>`;
  attachTabs(root);
  bindInvoice(root, items, customers, reps, user);
  bindCustomers(root, reps, user, { customers, allCustomers: rawCustomers, invoices, debts, collections, items });
  bindCollections(root, debts, user);
  bindSalesReport(root, invoices, items, reps, user);
  bindInvoicePrinting(root, { invoices, customers, reps, items });
}

function filteredSales(invoices, user) { return user.role === `sales_rep` ? invoices.filter(i => i.sellerId === user.id) : invoices; }
function invoicePanel(customers, reps, user){
  let sellers = user.role === `sales_rep` ? reps.filter(r=>r.id===user.id) : reps.filter(u=>[`sales_rep`,`dawood`,`moatasem`,`admin`].includes(u.role));
  if (user.role === `sales_rep` && !sellers.length) sellers = [user];
  const cashOnly = user.role === `sales_rep`;
  const missingHint = !customers.length ? `<div class="empty">لا يوجد عملاء معرفون لك حتى الآن. يمكنك إضافة عميل من تبويب عملائي، وسيظهر لك تنبيه إذا كان الاسم مشابها لعميل موجود.</div>` : ``;
  return `${missingHint}<div class="hint">${cashOnly ? `واجهة المندوب مختصرة للبيع النقدي فقط.` : `يمكن للـ Superuser تسجيل النقدي أو الآجل.`}</div><form id="salesForm" class="form-grid">
    <label>رقم الفاتورة<input name="invoiceNumber" value="${uid(`SAL`)}" readonly></label>
    <label>التاريخ<input name="date" type="date" value="${todayISO()}"></label>
    <label>البائع<select name="sellerId" required>${sellers.map(r=>`<option value="${esc(r.id)}" ${user.id===r.id?`selected`:``}>${esc(r.fullName)}</option>`).join(``)}</select></label>
    <label>العميل<select name="customerId" required>${customers.map(c=>`<option value="${esc(c.id)}">${esc(c.customerName)}</option>`).join(``)}</select></label>
    <label>نوع البيع<select name="saleType" ${cashOnly?`disabled`:``}><option value="cash">نقدي</option><option value="credit">ذمم / آجل</option></select></label>
    <label>المبلغ المدفوع<input name="paidAmount" type="number" min="0" step="0.001" value="0"></label>
    <label>تاريخ الاستحقاق<input name="dueDate" type="date" ${cashOnly?`disabled`:``}></label>
    <label class="wide">ملاحظات<textarea name="notes"></textarea></label>
  </form><div id="salesLines" style="margin-top:14px"></div><div class="actions" style="margin-top:14px"><button class="btn primary" id="confirmSaleBtn">اعتماد الفاتورة</button><button class="btn" id="draftSaleBtn">حفظ كمسودة</button></div>`;
}
function customersPanel(customers, reps, user){ const hint = user.role === `sales_rep` ? `<p class="hint">يمكنك تعريف عميل جديد. عند كتابة الاسم سيظهر تنبيه بالأسماء المشابهة لتجنب التكرار.</p>` : ``; return `${hint}<div class="actions"><button class="btn primary" id="newCustomerBtn">إضافة عميل</button><button class="btn" id="exportCustomersBtn">تصدير العملاء</button></div><br>${table([{label:`العميل`,value:`customerName`},{label:`الهاتف`,value:`phone`},{label:`المنطقة`,value:`area`},{label:`المندوب`,value:r=>esc(reps.find(u=>u.id===r.responsibleRepId)?.fullName||`—`)},{label:`الرصيد`,value:r=>money(r.currentBalance)},{label:`الحالة`,value:r=>statusBadge(r.status)},{label:`كشف`,value:r=>`<button class="btn" data-customer-statement="${esc(r.id)}">PDF</button>`}],customers,`لا يوجد عملاء`)}`; }
function debtsPanel(debts, user){ const open = (user.role===`sales_rep`?debts.filter(d=>d.repId===user.id):debts).filter(d=>d.status!==`paid`); return `<div class="actions"><button class="btn" id="exportDebtsBtn">تصدير الذمم</button></div><br>${table([{label:`العميل`,value:`customerName`},{label:`الفاتورة`,value:`invoiceNumber`},{label:`الأصل`,value:r=>money(r.originalAmount)},{label:`المدفوع`,value:r=>money(r.paidAmount)},{label:`المتبقي`,value:r=>money(r.remainingAmount)},{label:`الاستحقاق`,value:`dueDate`},{label:`الحالة`,value:r=>statusBadge(r.status)},{label:`تحصيل`,value:r=>`<button class="btn green" data-collect="${esc(r.id)}">تسجيل تحصيل</button>`}],open,`لا توجد ذمم مفتوحة`)}`; }
function historyPanel(invoices, customers, reps){ return `<div class="actions"><button class="btn" id="exportSalesBtn">تصدير الفواتير</button></div><br>${table([{label:`رقم`,value:`invoiceNumber`},{label:`التاريخ`,value:`date`},{label:`العميل`,value:r=>esc(customers.find(c=>c.id===r.customerId)?.customerName||r.customerName||`—`)},{label:`البائع`,value:r=>esc(reps.find(u=>u.id===r.sellerId)?.fullName||`—`)},{label:`النوع`,value:r=>r.saleType===`cash`?`نقدي`:`ذمم`},{label:`الإجمالي`,value:r=>money(r.total)},{label:`الحالة`,value:r=>statusBadge(r.status)},{label:`طباعة`,value:r=>`<button class="btn" data-print-invoice="${esc(r.id)}">طباعة</button>`}],invoices,`لا توجد فواتير`)}`; }
function salesByItemPanel(invoices, items, reps, user){ const sellerSelect = user.role === `sales_rep` ? `` : `<label>المندوب<select id="salesReportRep"><option value="">الكل</option>${reps.filter(r=>[`sales_rep`,`dawood`,`moatasem`,`admin`].includes(r.role)).map(r=>`<option value="${esc(r.id)}">${esc(r.fullName)}</option>`).join(``)}</select></label>`; return `<div class="filters"><label>من تاريخ<input id="salesReportFrom" type="date" value="${todayISO().slice(0,8)}01"></label><label>إلى تاريخ<input id="salesReportTo" type="date" value="${todayISO()}"></label>${sellerSelect}<label>الصنف<select id="salesReportItem"><option value="">الكل</option>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemName)}</option>`).join(``)}</select></label><button class="btn" id="exportSalesByItemBtn">تصدير التقرير</button></div><div id="salesByItemResult" style="margin-top:14px"></div>`; }
function customerForm(reps, user){
  const isRep = user.role === `sales_rep`;
  const repField = isRep
    ? `<label>المندوب المسؤول<input value="${esc(user.fullName || user.username || `مندوب`)}" readonly><input type="hidden" name="responsibleRepId" value="${esc(user.id)}"></label>`
    : `<label>المندوب المسؤول<select name="responsibleRepId">${reps.map(r=>`<option value="${esc(r.id)}">${esc(r.fullName)}</option>`).join(``)}</select></label>`;
  const financialFields = isRep
    ? `<input type="hidden" name="openingBalance" value="0"><input type="hidden" name="status" value="active">`
    : `<label>رصيد افتتاحي<input name="openingBalance" type="number" step="0.001" value="0"></label><label>الحالة<select name="status"><option value="active">فعال</option><option value="inactive">غير فعال</option></select></label>`;
  return `<form id="customerForm" class="form-grid"><label>اسم العميل<input name="customerName" required autocomplete="off"></label><label>الهاتف<input name="phone" inputmode="tel"></label><label>المنطقة<input name="area"></label>${repField}${financialFields}<div id="customerSimilarBox" class="hint wide">اكتب اسم العميل، وسيظهر هنا أي اسم مشابه موجود مسبقاً.</div><label class="wide">ملاحظات<textarea name="notes"></textarea></label></form>`;
}

function bindInvoice(root, items, customers, reps, user){
  let lines=[];
  lineBuilder($(`#salesLines`,root),items.filter(i=>i.status===`active`), l=>{lines=l});
  $(`#confirmSaleBtn`,root)?.addEventListener(`click`,()=>saveSale(`confirmed`));
  $(`#draftSaleBtn`,root)?.addEventListener(`click`,()=>saveSale(`draft`));
  async function saveSale(status){
    const form=$(`#salesForm`,root); if(!form.reportValidity()) return; if(!lines.length) return toast(`أدخل صنفاً واحداً على الأقل`,`err`);
    const d=getFormData(form); if(user.role===`sales_rep`) d.saleType=`cash`;
    const seller=await erp.get(`users`,d.sellerId); if(!seller) return toast(`البائع غير موجود`,`err`);
    const warehouseId=seller.assignedWarehouseId || `main`;
    let total=0;
    for(const line of lines){
      const item=await erp.get(`items`,line.itemId); const available=number(item.stock?.[warehouseId]);
      if(status===`confirmed` && available<number(line.quantity)) throw new Error(`رصيد غير كاف من ${item.itemName} في مستودع البائع`);
      total += number(line.quantity)*number(line.price);
    }
    const paid=d.saleType===`cash` ? total : number(d.paidAmount);
    const remaining=Math.max(0,total-paid);
    const customer=customers.find(c=>c.id===d.customerId);
    const invoice=await erp.add(`salesInvoices`,{...d,customerName:customer?.customerName||``,sellerName:seller.fullName,warehouseId,items:lines,total,paidAmount:paid,remainingDebt:remaining,status});
    if(status===`confirmed`){
      for(const line of lines) await erp.changeStock(line.itemId,warehouseId,-number(line.quantity),`فاتورة بيع`,{invoiceNumber:d.invoiceNumber, invoiceId:invoice.id});
      if(d.saleType===`cash`){
        await erp.adjustUserBalance(d.sellerId,`cashBalance`,paid || total,`زيادة نقدية من فاتورة بيع`,invoice.id);
      } else {
        await erp.add(`customerDebts`,{customerId:d.customerId,customerName:customer?.customerName||``,repId:d.sellerId,invoiceId:invoice.id,invoiceNumber:d.invoiceNumber,originalAmount:total,paidAmount:paid,remainingAmount:remaining,dueDate:d.dueDate,status:remaining>0?`open`:`paid`});
        if(paid>0) await erp.adjustUserBalance(d.sellerId,`cashBalance`,paid,`تحصيل جزئي من فاتورة آجلة`,invoice.id);
        await erp.update(`customers`,d.customerId,{currentBalance:number(customer?.currentBalance)+remaining});
      }
    }
    toast(status===`draft`?`تم حفظ الفاتورة كمسودة`:`تم اعتماد الفاتورة`); location.reload();
  }
}
function bindCustomers(root,reps,user, ctx){
  root.addEventListener(`click`,async e=>{
    if(e.target.closest(`#newCustomerBtn`)){
      const {modal}=await import('./utils.js');
      const wrap = modal(`إضافة عميل`,customerForm(reps,user),[{label:`حفظ`,className:`primary`,handler:async wrap=>{const f=$(`#customerForm`,wrap); if(!f.reportValidity()) return; const d=getFormData(f); if(user.role===`sales_rep`){ d.responsibleRepId=user.id; d.openingBalance=0; d.status=`active`; } const similar=findSimilarCustomers(ctx.allCustomers || ctx.customers || [], d.customerName, d.phone); if(similar.length) toast(`تنبيه: يوجد ${similar.length} عميل مشابه. تأكد قبل الحفظ.`,`warn`); await erp.add(`customers`,{...d,openingBalance:number(d.openingBalance),currentBalance:number(d.openingBalance)}); wrap.remove(); toast(`تم حفظ العميل`); location.reload();}}]);
      bindSimilarCustomerWarning(wrap, ctx.allCustomers || ctx.customers || []);
    }
    const statement=e.target.closest(`[data-customer-statement]`); if(statement) printCustomerStatement(statement.dataset.customerStatement, ctx);
    if(e.target.closest(`#exportCustomersBtn`)) exportExcel(`customers.xls`, user.role===`sales_rep` ? ctx.customers : await erp.safeList(`customers`));
    if(e.target.closest(`#exportSalesBtn`)) exportExcel(`sales.xls`, filteredSales(await erp.safeList(`salesInvoices`), user));
    if(e.target.closest(`#exportDebtsBtn`)) exportExcel(`customer-debts.xls`, user.role===`sales_rep` ? await erp.safeList(`customerDebts`, { where:[[ `repId`, `==`, user.id ]] }) : await erp.safeList(`customerDebts`));
  });
}
function customerTokens(value){ return normalize(value).replace(/[إأآا]/g,`ا`).replace(/[ة]/g,`ه`).replace(/[ى]/g,`ي`).replace(/[^\u0600-\u06FFa-z0-9 ]+/g,` `).split(/\s+/).filter(x=>x.length>1); }
function similarScore(name, customer){
  const a = customerTokens(name);
  const b = customerTokens(customer.customerName || ``);
  if(!a.length || !b.length) return 0;
  const joinedA = a.join(` `), joinedB = b.join(` `);
  if(joinedA === joinedB) return 100;
  if(joinedA.includes(joinedB) || joinedB.includes(joinedA)) return 85;
  const common = a.filter(token => b.includes(token)).length;
  return Math.round((common / Math.max(a.length, b.length)) * 100);
}
function findSimilarCustomers(customers, name, phone){
  const cleanPhone = normalize(phone).replace(/\D/g,``);
  return customers.map(customer => ({ customer, score: Math.max(similarScore(name, customer), cleanPhone && normalize(customer.phone).replace(/\D/g,``) === cleanPhone ? 100 : 0) }))
    .filter(row => row.score >= 45)
    .sort((a,b)=>b.score-a.score)
    .slice(0,5);
}
function bindSimilarCustomerWarning(wrap, customers){
  const nameInput = $(`[name="customerName"]`, wrap);
  const phoneInput = $(`[name="phone"]`, wrap);
  const box = $(`#customerSimilarBox`, wrap);
  const render = () => {
    const matches = findSimilarCustomers(customers, nameInput?.value || ``, phoneInput?.value || ``);
    box.innerHTML = matches.length
      ? `<strong>انتبه: يوجد عملاء مشابهون</strong>${matches.map(({customer,score})=>`<div class="timeline-item"><strong>${esc(customer.customerName || `بدون اسم`)}</strong><span>${esc(customer.phone || `لا يوجد هاتف`)} · ${esc(customer.area || `بدون منطقة`)} · تشابه ${score}%</span></div>`).join(``)}`
      : `لا يوجد اسم مشابه واضح حتى الآن.`;
  };
  nameInput?.addEventListener(`input`, render);
  phoneInput?.addEventListener(`input`, render);
  render();
}
function bindCollections(root,debts,user){
  root.addEventListener(`click`,async e=>{
    const btn=e.target.closest(`[data-collect]`); if(!btn) return;
    const debt=debts.find(d=>d.id===btn.dataset.collect); if(!debt) return toast(`القيد غير موجود`,`err`);
    const {modal}=await import('./utils.js');
    modal(`تسجيل تحصيل`, `<form id="collectionForm" class="form-grid two"><label>المبلغ<input name="amount" type="number" min="0.001" step="0.001" max="${number(debt.remainingAmount)}" required></label><label>طريقة الدفع<select name="method"><option value="cash">نقد</option><option value="cliq">CliQ</option></select></label><label class="wide">ملاحظات<textarea name="notes"></textarea></label></form>`,[{label:`حفظ التحصيل`,className:`green`,handler:async wrap=>{const f=$(`#collectionForm`,wrap); if(!f.reportValidity())return; const d=getFormData(f); const amount=number(d.amount); const remaining=number(debt.remainingAmount)-amount; await erp.add(`collections`,{...d,amount,customerDebtId:debt.id,invoiceId:debt.invoiceId,customerId:debt.customerId,repId:debt.repId,date:todayISO(),status:`confirmed`}); await erp.update(`customerDebts`,debt.id,{paidAmount:number(debt.paidAmount)+amount,remainingAmount:remaining,status:remaining<=0?`paid`:`partial`}); const customer=await erp.get(`customers`,debt.customerId); if(customer) await erp.update(`customers`,debt.customerId,{currentBalance:Math.max(0,number(customer.currentBalance)-amount)}); const field=d.method===`cliq`?`cliqBalance`:`cashBalance`; await erp.adjustUserBalance(debt.repId,field,amount,`تحصيل ذمة عميل`,debt.id); wrap.remove(); toast(`تم تسجيل التحصيل`); location.reload();}}]);
  });
}
function bindSalesReport(root, invoices, items, reps, user) {
  const render = () => {
    const from=$(`#salesReportFrom`,root)?.value || ``; const to=$(`#salesReportTo`,root)?.value || ``; const repId=user.role===`sales_rep`?user.id:($(`#salesReportRep`,root)?.value || ``); const itemSelect=$(`#salesReportItem`,root); const itemId=itemSelect?.value || ``;
    const baseInvoices = filteredSales(invoices,user).filter(inv => (!repId || inv.sellerId===repId) && (!from || String(inv.date||``).slice(0,10)>=from) && (!to || String(inv.date||``).slice(0,10)<=to));
    const availableItemIds = [...new Set(baseInvoices.flatMap(inv => (inv.items||[]).map(line => line.itemId)).filter(Boolean))];
    if(itemSelect){
      itemSelect.innerHTML = `<option value="">الكل</option>${availableItemIds.map(id => { const item=items.find(i=>i.id===id); return `<option value="${esc(id)}" ${id===itemId?`selected`:``}>${esc(item?.itemName||id)}</option>`; }).join(``)}`;
      if(itemId && !availableItemIds.includes(itemId)) itemSelect.value = ``;
    }
    const finalItemId = itemSelect?.value || ``;
    const map=new Map();
    baseInvoices.forEach(inv => (inv.items||[]).forEach(line => {
      if(finalItemId && line.itemId!==finalItemId) return;
      const item=items.find(i=>i.id===line.itemId); const key=line.itemId || item?.itemName || `غير محدد`; const row=map.get(key)||{itemName:item?.itemName||key,quantity:0,total:0}; row.quantity+=number(line.quantity); row.total+=number(line.quantity)*number(line.price); map.set(key,row);
    }));
    $(`#salesByItemResult`,root).innerHTML = table([{label:`الصنف`,value:`itemName`},{label:`الكمية`,value:r=>qty(r.quantity)},{label:`القيمة`,value:r=>money(r.total)}],[...map.values()],`لا توجد مبيعات ضمن الفلتر`);
  };
  [`salesReportFrom`,`salesReportTo`,`salesReportRep`,`salesReportItem`].forEach(id=>$(`#${id}`,root)?.addEventListener(`change`,render));
  $(`#exportSalesByItemBtn`,root)?.addEventListener(`click`,()=>{
    const rows=[...$(`#salesByItemResult`,root).querySelectorAll(`tbody tr`)].map(tr=>({ الصنف:tr.children[0]?.textContent, الكمية:tr.children[1]?.textContent, القيمة:tr.children[2]?.textContent }));
    exportExcel(`sales-by-item.xls`, rows);
  });
  render();
}
function bindInvoicePrinting(root, ctx){
  root.addEventListener(`click`, e => {
    const btn=e.target.closest(`[data-print-invoice]`); if(!btn) return;
    const invoice=ctx.invoices.find(i=>i.id===btn.dataset.printInvoice); if(!invoice) return toast(`الفاتورة غير موجودة`,`err`);
    printInvoice(invoice, ctx);
  });
}
function printInvoice(invoice, ctx){
  const customer=ctx.customers.find(c=>c.id===invoice.customerId);
  const seller=ctx.reps.find(r=>r.id===invoice.sellerId);
  const rows=(invoice.items||[]).map(line=>{ const item=ctx.items.find(i=>i.id===line.itemId); const total=number(line.quantity)*number(line.price); return `<tr><td>${esc(item?.itemCode||``)}</td><td>${esc(item?.itemName||line.itemId)}</td><td>${qty(line.quantity)}</td><td>${money(line.price)}</td><td>${money(total)}</td></tr>`; }).join(``);
  printHtmlPdf(`فاتورة ${invoice.invoiceNumber||invoice.id}`, `<p class="meta">التاريخ: ${esc(invoice.date||`—`)} | العميل: ${esc(customer?.customerName||invoice.customerName||`—`)} | البائع: ${esc(seller?.fullName||invoice.sellerName||`—`)}</p><table><thead><tr><th>الكود</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${rows}<tr class="total"><td colspan="4">الإجمالي</td><td>${money(invoice.total)}</td></tr><tr><td colspan="4">المدفوع</td><td>${money(invoice.paidAmount)}</td></tr><tr><td colspan="4">المتبقي</td><td>${money(invoice.remainingDebt)}</td></tr></tbody></table><p>${esc(invoice.notes||``)}</p>`);
}
function printCustomerStatement(customerId, ctx){
  const customer=ctx.customers.find(c=>c.id===customerId); if(!customer) return toast(`العميل غير موجود`,`err`);
  let balance=0;
  const movements=[];
  if(number(customer.openingBalance)) movements.push({date:`افتتاحي`, type:`رصيد افتتاحي`, ref:`—`, debit:number(customer.openingBalance), credit:0, notes:``});
  ctx.invoices.filter(inv=>inv.customerId===customerId && inv.status!==`draft`).forEach(inv=>{
    movements.push({date:inv.date||inv.createdAt||``, type:`فاتورة`, ref:inv.invoiceNumber||inv.id, debit:number(inv.total), credit:number(inv.paidAmount), notes:inv.saleType===`cash`?`بيع نقدي`:`بيع آجل`});
  });
  ctx.collections.filter(c=>c.customerId===customerId).forEach(c=>movements.push({date:c.date||c.createdAt||``, type:`تحصيل`, ref:c.id, debit:0, credit:number(c.amount), notes:c.method||``}));
  movements.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const rows=movements.map(m=>{ balance += number(m.debit)-number(m.credit); return `<tr><td>${esc(m.date)}</td><td>${esc(m.type)}</td><td>${esc(m.ref)}</td><td>${money(m.debit)}</td><td>${money(m.credit)}</td><td>${money(balance)}</td><td>${esc(m.notes)}</td></tr>`; }).join(``);
  printHtmlPdf(`كشف حساب ${customer.customerName}`, `<p class="meta">الهاتف: ${esc(customer.phone||`—`)} | المنطقة: ${esc(customer.area||`—`)}</p><div class="summary"><div class="box">الرصيد الحالي<b>${money(balance)}</b></div><div class="box">رصيد النظام<b>${money(customer.currentBalance)}</b></div><div class="box">عدد الحركات<b>${movements.length}</b></div><div class="box">تاريخ الطباعة<b>${todayISO()}</b></div></div><table><thead><tr><th>التاريخ</th><th>النوع</th><th>المرجع</th><th>مدين</th><th>دائن</th><th>الرصيد</th><th>ملاحظات</th></tr></thead><tbody>${rows || `<tr><td colspan="7">لا توجد حركات</td></tr>`}</tbody></table>`);
}