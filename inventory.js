import { erp } from './firebase.js';
import { $, esc, money, qty, number, uid, todayISO, getFormData, toast, confirmModal, table, statusBadge, renderTabs, attachTabs, exportCSV } from './utils.js';
import { can } from './permissions.js';

const cats = { raw_material:`مواد خام`, manufactured:`منتجات مصنّعة`, ready_goods:`بضاعة جاهزة`, tools:`عدد وأدوات`, maintenance:`صيانة`, miscellaneous:`متفرقات` };
export async function renderWarehouse(root, user) {
  const [items, warehouses, reps] = await Promise.all([erp.list(`items`), erp.list(`warehouses`), erp.list(`users`, { where:[[ `role`, `==`, `sales_rep` ]] })]);
  root.innerHTML = `<section class="card">
    ${renderTabs([{id:`stock`,label:`الرصيد`},{id:`movement`,label:`حركة مخزون`},{id:`loading`,label:`تحميل سيارة`},{id:`returns`,label:`إرجاع بضاعة`},{id:`count`,label:`جرد سيارة`}], `stock`)}
    <div class="panel active" data-panel="stock">${stockPanel(items, warehouses, user)}</div>
    <div class="panel" data-panel="movement">${movementPanel(items, warehouses)}</div>
    <div class="panel" data-panel="loading">${loadingPanel(items, warehouses, reps)}</div>
    <div class="panel" data-panel="returns">${returnsPanel(items, warehouses)}</div>
    <div class="panel" data-panel="count">${countPanel(items, warehouses, reps)}</div>
  </section>`;
  attachTabs(root);
  bindStock(root, user);
  bindMovement(root, items, warehouses, user);
  bindLoading(root, items, warehouses, reps);
  bindReturns(root, items, warehouses);
  bindCount(root, items, warehouses, reps);
}
function stockPanel(items, warehouses, user) {
  return `<div class="actions"><button class="btn primary" id="newItemBtn">إضافة صنف</button><button class="btn" id="newWarehouseBtn">إضافة مستودع</button><button class="btn" id="exportStockBtn">تصدير الرصيد</button></div><br>${table([
    {label:`الكود`, value:`itemCode`}, {label:`الصنف`, value:`itemName`}, {label:`الفئة`, value:r=>esc(cats[r.category]||r.category)}, {label:`الوحدة`, value:`unit`},
    {label:`تكلفة`, value:r=>money(r.costPrice)}, {label:`سعر بيع`, value:r=>money(r.standardSellingPrice)}, {label:`الحد الأدنى`, value:r=>qty(r.minimumStock)},
    ...warehouses.map(w => ({ label:w.warehouseName, value:r=>qty((r.stock||{})[w.id]||0) })),
    {label:`الحالة`, value:r=>statusBadge(r.status)},
    {label:`إجراء`, value:r=>`<button class="btn" data-edit-item="${esc(r.id)}">تعديل</button> ${can(user,`delete`) ? `<button class="btn danger" data-del-item="${esc(r.id)}">حذف</button>` : ``}`}
  ], items, `لا توجد أصناف`)}</div>`;
}
function itemForm(item = {}) {
  return `<form id="itemForm" class="form-grid">
    <input type="hidden" name="id" value="${esc(item.id||``)}">
    <label>كود الصنف<input name="itemCode" required value="${esc(item.itemCode||``)}"></label>
    <label>اسم الصنف<input name="itemName" required value="${esc(item.itemName||``)}"></label>
    <label>الفئة<select name="category" required>${Object.entries(cats).map(([k,v])=>`<option value="${k}" ${item.category===k?`selected`:``}>${v}</option>`).join(``)}</select></label>
    <label>الوحدة<input name="unit" required value="${esc(item.unit||`قطعة`)}"></label>
    <label>تكلفة الشراء<input type="number" step="0.001" min="0" name="costPrice" value="${number(item.costPrice)}"></label>
    <label>سعر البيع القياسي<input type="number" step="0.001" min="0" name="standardSellingPrice" value="${number(item.standardSellingPrice)}"></label>
    <label>سعر النقص على المندوب<input type="number" step="0.001" min="0" name="shortagePrice" value="${number(item.shortagePrice)}"></label>
    <label>الحد الأدنى<input type="number" step="0.001" min="0" name="minimumStock" value="${number(item.minimumStock)}"></label>
    <label>الحالة<select name="status"><option value="active" ${item.status!==`inactive`?`selected`:``}>فعال</option><option value="inactive" ${item.status===`inactive`?`selected`:``}>غير فعال</option></select></label>
    <label class="wide">ملاحظات<textarea name="notes">${esc(item.notes||``)}</textarea></label>
  </form>`;
}
function movementPanel(items, warehouses) {
  return `<form id="movementForm" class="form-grid"><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>نوع الحركة<select name="type"><option value="receive">استلام للمستودع</option><option value="transfer">تحويل بين مستودعات</option><option value="adjustment">تسوية رصيد</option><option value="damage">تالف / شطب</option></select></label><label>من مستودع<select name="fromWarehouseId"><option value="">لا يوجد</option>${warehouses.map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>إلى مستودع<select name="toWarehouseId"><option value="">لا يوجد</option>${warehouses.map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required></label><label class="wide">سبب الحركة<textarea name="notes" required></textarea></label><button class="btn primary" type="submit">حفظ حركة المخزون</button></form>`;
}
function loadingPanel(items, warehouses, reps) {
  const vehicle = warehouses.filter(w=>w.type===`vehicle`);
  return `<form id="loadingForm" class="form-grid"><label>رقم التحميل<input name="loadingNumber" value="${uid(`LOAD`)}" readonly></label><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>المندوب<select name="repId" required>${reps.map(r=>`<option value="${esc(r.id)}">${esc(r.fullName)}</option>`).join(``)}</select></label><label>سيارة المندوب<select name="vehicleWarehouseId" required>${vehicle.map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required></label><label class="wide">ملاحظات<textarea name="notes"></textarea></label><button class="btn primary" type="submit">اعتماد التحميل</button></form>`;
}
function returnsPanel(items, warehouses) {
  return `<form id="returnForm" class="form-grid"><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>من سيارة<select name="fromWarehouseId" required>${warehouses.filter(w=>w.type===`vehicle`).map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>إلى مستودع<select name="toWarehouseId" required>${warehouses.filter(w=>w.type===`main`).map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>سبب الإرجاع<select name="reason"><option>بضاعة بطيئة الحركة</option><option>رصيد زائد في السيارة</option><option>تحميل خاطئ</option><option>إرجاع نهاية فترة</option><option>تالف</option><option>أخرى</option></select></label><label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required></label><label class="wide">ملاحظات<textarea name="notes"></textarea></label><button class="btn primary" type="submit">اعتماد الإرجاع</button></form>`;
}
function countPanel(items, warehouses, reps) {
  return `<form id="countForm" class="form-grid"><label>تاريخ الجرد<input name="countDate" type="date" value="${todayISO()}"></label><label>المندوب<select name="repId" required>${reps.map(r=>`<option value="${esc(r.id)}">${esc(r.fullName)}</option>`).join(``)}</select></label><label>مستودع السيارة<select name="warehouseId" required>${warehouses.filter(w=>w.type===`vehicle`).map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>الكمية الفعلية<input name="actualQuantity" type="number" step="0.001" min="0" required></label><label class="wide">ملاحظات<textarea name="notes"></textarea></label><button class="btn primary" type="submit">حفظ الجرد واحتساب الفرق</button></form>`;
}
function bindStock(root, user) {
  root.addEventListener(`click`, async e => {
    if (e.target.closest(`#newItemBtn`)) showItemModal();
    const edit = e.target.closest(`[data-edit-item]`); if (edit) showItemModal(await erp.get(`items`, edit.dataset.editItem));
    const del = e.target.closest(`[data-del-item]`); if (del) confirmModal(`سيتم حذف الصنف حذفاً ناعماً مع حفظ السجل.`, async()=>{ await erp.softDelete(`items`, del.dataset.delItem); toast(`تم حذف الصنف`); renderWarehouse(root, user); }, `حذف`);
    if (e.target.closest(`#exportStockBtn`)) exportCSV(`stock.csv`, await erp.list(`items`));
    if (e.target.closest(`#newWarehouseBtn`)) showWarehouseModal(root, user);
  });
  async function showItemModal(item={}) {
    const { modal } = await import('./utils.js');
    modal(item.id?`تعديل صنف`:`إضافة صنف`, itemForm(item), [{label:`حفظ`, className:`primary`, handler:async wrap=>{ const form=$(`#itemForm`,wrap); if(!form.reportValidity()) return; const d=getFormData(form); const payload={...d,costPrice:number(d.costPrice),standardSellingPrice:number(d.standardSellingPrice),shortagePrice:number(d.shortagePrice),minimumStock:number(d.minimumStock),stock:item.stock||{}}; if(d.id) await erp.update(`items`,d.id,payload); else await erp.add(`items`,payload); wrap.remove(); toast(`تم حفظ الصنف`); renderWarehouse(root,user); }}]);
  }
}
function showWarehouseModal(root,user){ import('./utils.js').then(({modal})=> modal(`إضافة مستودع`, `<form id="warehouseForm" class="form-grid two"><label>كود المستودع<input name="warehouseCode" required></label><label>اسم المستودع<input name="warehouseName" required></label><label>النوع<select name="type"><option value="main">رئيسي</option><option value="vehicle">سيارة مندوب</option></select></label><label>الحالة<select name="status"><option value="active">فعال</option><option value="inactive">غير فعال</option></select></label></form>`, [{label:`حفظ`, className:`primary`, handler:async wrap=>{const form=$(`#warehouseForm`,wrap); if(!form.reportValidity()) return; await erp.add(`warehouses`,getFormData(form)); wrap.remove(); toast(`تم حفظ المستودع`); renderWarehouse(root,user);}}])); }
function bindMovement(root, items, warehouses, user) { $(`#movementForm`, root)?.addEventListener(`submit`, async e=>{ e.preventDefault(); const d=getFormData(e.target); const q=number(d.quantity); if(q<=0) return toast(`الكمية غير صحيحة`,`err`); if(d.fromWarehouseId) await erp.changeStock(d.itemId,d.fromWarehouseId,-q,`حركة مخزون: ${d.type}`,{fromWarehouseId:d.fromWarehouseId,toWarehouseId:d.toWarehouseId,notes:d.notes}); if(d.toWarehouseId) await erp.changeStock(d.itemId,d.toWarehouseId,q,`حركة مخزون: ${d.type}`,{fromWarehouseId:d.fromWarehouseId,toWarehouseId:d.toWarehouseId,notes:d.notes}); toast(`تم حفظ حركة المخزون`); renderWarehouse(root,user); }); }
function bindLoading(root, items, warehouses, reps){ $(`#loadingForm`,root)?.addEventListener(`submit`, async e=>{ e.preventDefault(); const d=getFormData(e.target); const q=number(d.quantity); await erp.changeStock(d.itemId,`main`,-q,`تحميل سيارة`,{toWarehouseId:d.vehicleWarehouseId,repId:d.repId,documentNumber:d.loadingNumber,notes:d.notes}); await erp.changeStock(d.itemId,d.vehicleWarehouseId,q,`تحميل سيارة`,{fromWarehouseId:`main`,repId:d.repId,documentNumber:d.loadingNumber,notes:d.notes}); toast(`تم اعتماد التحميل`); location.reload(); }); }
function bindReturns(root, items, warehouses){ $(`#returnForm`,root)?.addEventListener(`submit`, async e=>{ e.preventDefault(); const d=getFormData(e.target); const q=number(d.quantity); await erp.changeStock(d.itemId,d.fromWarehouseId,-q,`إرجاع بضاعة`,d); if(d.reason !== `تالف`) await erp.changeStock(d.itemId,d.toWarehouseId,q,`إرجاع بضاعة`,d); toast(`تم اعتماد الإرجاع`); location.reload(); }); }
function bindCount(root, items, warehouses, reps){ $(`#countForm`,root)?.addEventListener(`submit`, async e=>{ e.preventDefault(); const d=getFormData(e.target); const item=await erp.get(`items`,d.itemId); const expected=number(item.stock?.[d.warehouseId]); const actual=number(d.actualQuantity); const diff=actual-expected; const shortageValue=diff<0 ? Math.abs(diff)*number(item.shortagePrice||item.standardSellingPrice) : 0; await erp.add(`stockCounts`,{...d,expectedQuantity:expected,actualQuantity:actual,difference:diff,shortageValue,status:`confirmed`}); await erp.changeStock(d.itemId,d.warehouseId,diff,`فرق جرد سيارة`,d); if(shortageValue>0){ await erp.add(`employeeAdvances`,{employeeId:d.repId,source:`stock_shortage`,amount:shortageValue,date:d.countDate,notes:`نقص جرد ${item.itemName}`,status:`confirmed`}); await erp.adjustUserBalance(d.repId,`advancesBalance`,shortageValue,`تسجيل نقص جرد على المندوب`); } toast(shortageValue>0?`تم حفظ الجرد وتسجيل السلفة على المندوب`:`تم حفظ الجرد`); location.reload(); }); }
