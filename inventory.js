import { erp } from './firebase.js';
import { $, esc, money, qty, number, uid, todayISO, getFormData, toast, confirmModal, table, statusBadge, renderTabs, attachTabs, exportExcel } from './utils.js';
import { can } from './permissions.js';

const cats = { raw_material:`مواد خام`, manufactured:`منتجات مصنّعة`, ready_goods:`بضاعة جاهزة`, tools:`عدد وأدوات`, maintenance:`صيانة`, miscellaneous:`متفرقات` };
export async function renderWarehouse(root, user) {
  const [items, warehouses, directory] = await Promise.all([erp.safeList(`items`), erp.safeList(`warehouses`), erp.userDirectory()]);
  const reps = directory.filter(u => u.role === `sales_rep`);
  root.innerHTML = `<section class="card">
    ${renderTabs([{id:`stock`,label:`الرصيد`},{id:`movement`,label:`حركة مخزون`},{id:`warehouseCount`,label:`تعديل جرد مستودع`},{id:`loading`,label:`تحميل سيارة`},{id:`returns`,label:`إرجاع بضاعة`},{id:`count`,label:`جرد سيارة`}], `stock`)}
    <div class="panel active" data-panel="stock">${stockPanel(items, warehouses, user)}</div>
    <div class="panel" data-panel="movement">${movementPanel(items, warehouses)}</div>
    <div class="panel" data-panel="warehouseCount">${warehouseCountPanel(items, warehouses)}</div>
    <div class="panel" data-panel="loading">${loadingPanel(items, warehouses, reps)}</div>
    <div class="panel" data-panel="returns">${returnsPanel(items, warehouses)}</div>
    <div class="panel" data-panel="count">${countPanel(items, warehouses, reps)}</div>
  </section>`;
  attachTabs(root);
  bindStock(root, user, warehouses);
  bindMovement(root, items, warehouses, user);
  bindWarehouseCount(root, items, user);
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
function itemForm(item = {}, warehouses = []) {
  const openingWarehouseOptions = [...warehouses]
    .sort((a,b) => Number(b.type === `main`) - Number(a.type === `main`))
    .map(w => `<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`)
    .join(``);
  const openingStockFields = item.id
    ? `<p class="hint wide">لتعديل رصيد صنف موجود استخدم تبويب «حركة مخزون» حتى تُسجّل الحركة في كشف المخزون.</p>`
    : `<label>مستودع الرصيد الافتتاحي<select name="openingWarehouseId" ${openingWarehouseOptions ? `required` : `disabled`}>
        ${openingWarehouseOptions || `<option value="">أضف مستودعاً أولاً</option>`}
      </select></label>
      <label>الرصيد الافتتاحي<input type="number" step="0.001" min="0" name="openingBalance" value="0" ${openingWarehouseOptions ? `` : `disabled`}></label>`;
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
    ${openingStockFields}
    <label>الحالة<select name="status"><option value="active" ${item.status!==`inactive`?`selected`:``}>فعال</option><option value="inactive" ${item.status===`inactive`?`selected`:``}>غير فعال</option></select></label>
    <label class="wide">ملاحظات<textarea name="notes">${esc(item.notes||``)}</textarea></label>
  </form>`;
}
function movementPanel(items, warehouses) {
  return `<form id="movementForm" class="form-grid"><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>نوع الحركة<select name="type"><option value="receive">استلام للمستودع</option><option value="transfer">تحويل بين مستودعات</option><option value="damage">تالف / شطب</option></select></label><label>من مستودع<select name="fromWarehouseId"><option value="">لا يوجد</option>${warehouses.map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>إلى مستودع<select name="toWarehouseId"><option value="">لا يوجد</option>${warehouses.map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required></label><label class="wide">سبب الحركة<textarea name="notes" required></textarea></label><button class="btn primary" type="submit">حفظ حركة المخزون</button></form>`;
}
function loadingPanel(items, warehouses, reps) {
  const vehicle = warehouses.filter(w=>w.type===`vehicle`);
  return `<form id="loadingForm" class="form-grid"><label>رقم التحميل<input name="loadingNumber" value="${uid(`LOAD`)}" readonly></label><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>المندوب<select name="repId" required>${reps.map(r=>`<option value="${esc(r.id)}">${esc(r.fullName)}</option>`).join(``)}</select></label><label>سيارة المندوب<select name="vehicleWarehouseId" required>${vehicle.map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required></label><label class="wide">ملاحظات<textarea name="notes"></textarea></label><button class="btn primary" type="submit">اعتماد التحميل</button></form>`;
}
function returnsPanel(items, warehouses) {
  return `<form id="returnForm" class="form-grid"><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>من سيارة<select name="fromWarehouseId" required>${warehouses.filter(w=>w.type===`vehicle`).map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>إلى مستودع<select name="toWarehouseId" required>${warehouses.filter(w=>w.type===`main`).map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>سبب الإرجاع<select name="reason"><option>بضاعة بطيئة الحركة</option><option>رصيد زائد في السيارة</option><option>تحميل خاطئ</option><option>إرجاع نهاية فترة</option><option>تالف</option><option>أخرى</option></select></label><label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required></label><label class="wide">ملاحظات<textarea name="notes"></textarea></label><button class="btn primary" type="submit">اعتماد الإرجاع</button></form>`;
}
function warehouseCountPanel(items, warehouses) {
  const firstItem = items[0];
  const firstWarehouse = warehouses[0];
  const currentBalance = number(firstItem?.stock?.[firstWarehouse?.id]);
  return `<form id="warehouseCountForm" class="form-grid">
    <label>تاريخ الجرد<input name="countDate" type="date" value="${todayISO()}" required></label>
    <label>المستودع<select name="warehouseId" required>${warehouses.map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label>
    <label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label>
    <label>الرصيد المسجّل<input id="warehouseCurrentStock" value="${currentBalance}" readonly></label>
    <label>الكمية الفعلية الجديدة<input name="actualQuantity" type="number" step="0.001" min="0" required></label>
    <label class="wide">سبب التعديل<textarea name="notes" required placeholder="مثال: نتيجة جرد فعلي للمستودع"></textarea></label>
    <button class="btn primary" type="submit" ${!items.length || !warehouses.length ? `disabled` : ``}>حفظ تعديل الجرد</button>
  </form>`;
}

function countPanel(items, warehouses, reps) {
  return `<form id="countForm" class="form-grid"><label>تاريخ الجرد<input name="countDate" type="date" value="${todayISO()}"></label><label>المندوب<select name="repId" required>${reps.map(r=>`<option value="${esc(r.id)}">${esc(r.fullName)}</option>`).join(``)}</select></label><label>مستودع السيارة<select name="warehouseId" required>${warehouses.filter(w=>w.type===`vehicle`).map(w=>`<option value="${esc(w.id)}">${esc(w.warehouseName)}</option>`).join(``)}</select></label><label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>الكمية الفعلية<input name="actualQuantity" type="number" step="0.001" min="0" required></label><label class="wide">ملاحظات<textarea name="notes"></textarea></label><button class="btn primary" type="submit">حفظ الجرد واحتساب الفرق</button></form>`;
}
function bindStock(root, user, warehouses) {
  root.addEventListener(`click`, async e => {
    if (e.target.closest(`#newItemBtn`)) showItemModal();
    const edit = e.target.closest(`[data-edit-item]`); if (edit) showItemModal(await erp.get(`items`, edit.dataset.editItem));
    const del = e.target.closest(`[data-del-item]`); if (del) confirmModal(`سيتم حذف الصنف حذفاً ناعماً مع حفظ السجل.`, async()=>{ await erp.softDelete(`items`, del.dataset.delItem); toast(`تم حذف الصنف`); renderWarehouse(root, user); }, `حذف`);
    if (e.target.closest(`#exportStockBtn`)) exportExcel(`stock.xls`, await erp.list(`items`));
    if (e.target.closest(`#newWarehouseBtn`)) showWarehouseModal(root, user);
  });
  async function showItemModal(item={}) {
    const { modal } = await import('./utils.js');
    modal(item.id?`تعديل صنف`:`إضافة صنف`, itemForm(item, warehouses), [{label:`حفظ`, className:`primary`, handler:async wrap=>{
      const form=$(`#itemForm`,wrap);
      if(!form.reportValidity()) return;
      const d=getFormData(form);
      const { openingWarehouseId, openingBalance, ...itemData } = d;
      const payload={...itemData,costPrice:number(d.costPrice),standardSellingPrice:number(d.standardSellingPrice),shortagePrice:number(d.shortagePrice),minimumStock:number(d.minimumStock),stock:item.stock||{}};
      if(d.id) {
        await erp.update(`items`,d.id,payload);
      } else {
        const createdItem=await erp.add(`items`,payload);
        const initialQuantity=number(openingBalance);
        if(initialQuantity>0) await erp.changeStock(createdItem.id,openingWarehouseId,initialQuantity,`رصيد افتتاحي`,{type:`opening_balance`,notes:`رصيد افتتاحي عند إضافة الصنف`});
      }
      wrap.remove();
      toast(number(openingBalance)>0?`تم حفظ الصنف ورصيده الافتتاحي`:`تم حفظ الصنف`);
      renderWarehouse(root,user);
    }}]);
  }
}
function showWarehouseModal(root,user){ import('./utils.js').then(({modal})=> modal(`إضافة مستودع`, `<form id="warehouseForm" class="form-grid two"><label>كود المستودع<input name="warehouseCode" required></label><label>اسم المستودع<input name="warehouseName" required></label><label>النوع<select name="type"><option value="main">رئيسي</option><option value="vehicle">سيارة مندوب</option></select></label><label>الحالة<select name="status"><option value="active">فعال</option><option value="inactive">غير فعال</option></select></label></form>`, [{label:`حفظ`, className:`primary`, handler:async wrap=>{const form=$(`#warehouseForm`,wrap); if(!form.reportValidity()) return; await erp.add(`warehouses`,getFormData(form)); wrap.remove(); toast(`تم حفظ المستودع`); renderWarehouse(root,user);}}])); }
function bindMovement(root, items, warehouses, user) {
  const form = $(`#movementForm`, root);
  form?.addEventListener(`submit`, async e => {
    e.preventDefault();
    const submitButton = e.submitter;
    if (submitButton?.disabled) return;
    const d = getFormData(e.target);
    const q = number(d.quantity);
    if (q <= 0) return toast(`الكمية غير صحيحة`, `err`);
    try {
      if (submitButton) submitButton.disabled = true;
      const movement = { fromWarehouseId:d.fromWarehouseId, toWarehouseId:d.toWarehouseId, notes:d.notes };
      if (d.type === `receive`) {
        if (!d.toWarehouseId) throw new Error(`اختر المستودع المستلم في حقل «إلى مستودع».`);
        await erp.changeStock(d.itemId, d.toWarehouseId, q, `استلام للمستودع`, movement);
      } else if (d.type === `transfer`) {
        if (!d.fromWarehouseId || !d.toWarehouseId) throw new Error(`اختر مستودع المصدر ومستودع الوجهة.`);
        if (d.fromWarehouseId === d.toWarehouseId) throw new Error(`يجب أن يختلف مستودع المصدر عن مستودع الوجهة.`);
        await erp.changeStock(d.itemId, d.fromWarehouseId, -q, `تحويل من مستودع`, movement);
        await erp.changeStock(d.itemId, d.toWarehouseId, q, `تحويل إلى مستودع`, movement);
      } else if (d.type === `damage`) {
        if (!d.fromWarehouseId) throw new Error(`اختر المستودع في حقل «من مستودع».`);
        await erp.changeStock(d.itemId, d.fromWarehouseId, -q, `تالف / شطب`, movement);
      } else {
        throw new Error(`نوع حركة المخزون غير معروف.`);
      }
      toast(`تم حفظ حركة المخزون`);
      await renderWarehouse(root, user);
    } catch (error) {
      console.error(`تعذر حفظ حركة المخزون.`, error);
      toast(error.message || `تعذر حفظ حركة المخزون`, `err`);
    } finally {
      if (submitButton?.isConnected) submitButton.disabled = false;
    }
  });
}
function bindWarehouseCount(root, items, user) {
  const form = $(`#warehouseCountForm`, root);
  if (!form) return;
  const currentStockInput = $(`#warehouseCurrentStock`, form);
  const refreshCurrentStock = () => {
    const d = getFormData(form);
    const item = items.find(row => row.id === d.itemId);
    currentStockInput.value = number(item?.stock?.[d.warehouseId]);
  };
  form.elements.itemId?.addEventListener(`change`, refreshCurrentStock);
  form.elements.warehouseId?.addEventListener(`change`, refreshCurrentStock);
  refreshCurrentStock();
  form.addEventListener(`submit`, async e => {
    e.preventDefault();
    const submitButton = e.submitter;
    if (submitButton?.disabled) return;
    const d = getFormData(e.target);
    const actual = number(d.actualQuantity);
    if (actual < 0) return toast(`الكمية الفعلية لا يمكن أن تكون سالبة`, `err`);
    try {
      if (submitButton) submitButton.disabled = true;
      const result = await erp.setStock(d.itemId, d.warehouseId, actual, `تعديل جرد مستودع`, {
        type:`warehouse_count_adjustment`,
        countDate:d.countDate,
        notes:d.notes
      });
      await erp.add(`stockCounts`, {
        countType:`warehouse`,
        countDate:d.countDate,
        warehouseId:d.warehouseId,
        itemId:d.itemId,
        expectedQuantity:result.before,
        actualQuantity:result.after,
        difference:result.difference,
        notes:d.notes,
        status:`confirmed`
      });
      toast(result.difference === 0 ? `تم اعتماد الجرد دون فرق` : `تم تعديل الرصيد وحفظ فرق الجرد`);
      await renderWarehouse(root, user);
    } catch (error) {
      console.error(`تعذر تعديل جرد المستودع.`, error);
      toast(error.message || `تعذر تعديل جرد المستودع`, `err`);
    } finally {
      if (submitButton?.isConnected) submitButton.disabled = false;
    }
  });
}

function bindLoading(root, items, warehouses, reps){ $(`#loadingForm`,root)?.addEventListener(`submit`, async e=>{ e.preventDefault(); const d=getFormData(e.target); const q=number(d.quantity); await erp.changeStock(d.itemId,`main`,-q,`تحميل سيارة`,{toWarehouseId:d.vehicleWarehouseId,repId:d.repId,documentNumber:d.loadingNumber,notes:d.notes}); await erp.changeStock(d.itemId,d.vehicleWarehouseId,q,`تحميل سيارة`,{fromWarehouseId:`main`,repId:d.repId,documentNumber:d.loadingNumber,notes:d.notes}); toast(`تم اعتماد التحميل`); location.reload(); }); }
function bindReturns(root, items, warehouses){ $(`#returnForm`,root)?.addEventListener(`submit`, async e=>{ e.preventDefault(); const d=getFormData(e.target); const q=number(d.quantity); await erp.changeStock(d.itemId,d.fromWarehouseId,-q,`إرجاع بضاعة`,d); if(d.reason !== `تالف`) await erp.changeStock(d.itemId,d.toWarehouseId,q,`إرجاع بضاعة`,d); toast(`تم اعتماد الإرجاع`); location.reload(); }); }
function bindCount(root, items, warehouses, reps) {
  const form = $(`#countForm`, root);
  form?.addEventListener(`submit`, async e => {
    e.preventDefault();
    const submitButton = e.submitter;
    if (submitButton?.disabled) return;
    const d = getFormData(e.target);
    try {
      if (submitButton) submitButton.disabled = true;
      const item = await erp.get(`items`, d.itemId);
      if (!item) throw new Error(`الصنف غير موجود.`);
      const actual = number(d.actualQuantity);
      const result = await erp.setStock(d.itemId, d.warehouseId, actual, `فرق جرد سيارة`, d);
      const shortageValue = result.difference < 0 ? Math.abs(result.difference) * number(item.shortagePrice || item.standardSellingPrice) : 0;
      await erp.add(`stockCounts`, {
        ...d,
        expectedQuantity:result.before,
        actualQuantity:result.after,
        difference:result.difference,
        shortageValue,
        status:`confirmed`
      });
      if (shortageValue > 0) {
        await erp.add(`employeeAdvances`, { employeeId:d.repId, source:`stock_shortage`, amount:shortageValue, date:d.countDate, notes:`نقص جرد ${item.itemName}`, status:`confirmed` });
        await erp.adjustUserBalance(d.repId, `advancesBalance`, shortageValue, `تسجيل نقص جرد على المندوب`);
      }
      toast(shortageValue > 0 ? `تم حفظ الجرد وتسجيل السلفة على المندوب` : `تم حفظ الجرد`);
      location.reload();
    } catch (error) {
      console.error(`تعذر حفظ جرد السيارة.`, error);
      toast(error.message || `تعذر حفظ جرد السيارة`, `err`);
    } finally {
      if (submitButton?.isConnected) submitButton.disabled = false;
    }
  });
}
