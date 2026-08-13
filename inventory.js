import { erp } from './firebase.js';
import { $, esc, money, qty, number, uid, todayISO, getFormData, toast, confirmModal, table, statusBadge, renderTabs, attachTabs, exportExcel } from './utils.js';
import { can } from './permissions.js';

const cats = { raw_material:`مواد خام`, manufactured:`منتجات مصنّعة`, ready_goods:`بضاعة جاهزة`, tools:`عدد وأدوات`, maintenance:`صيانة`, miscellaneous:`متفرقات` };
const MAIN_WAREHOUSE_ID = `main`;
function mainWarehouse(warehouses) {
  return warehouses.find(warehouse => warehouse.id === MAIN_WAREHOUSE_ID) || warehouses.find(warehouse => warehouse.type === `main`) || null;
}
function vehicleWarehouseForRep(rep, warehouses) {
  if (!rep) return null;
  return warehouses.find(warehouse => warehouse.type === `vehicle` && warehouse.id === rep.assignedWarehouseId)
    || warehouses.find(warehouse => warehouse.type === `vehicle` && warehouse.assignedRepId === rep.id)
    || null;
}
function requireVehicleWarehouse(repId, reps, warehouses) {
  const rep = reps.find(row => row.id === repId);
  if (!rep) throw new Error(`المندوب غير موجود.`);
  const warehouse = vehicleWarehouseForRep(rep, warehouses);
  if (!warehouse) throw new Error(`لا توجد سيارة مرتبطة بالمندوب ${rep.fullName || rep.username}. افتح إدارة المستخدمين واحفظ بيانات المندوب لإنشاء السيارة تلقائياً.`);
  return { rep, warehouse };
}
export async function renderWarehouse(root, user) {
  const [items, allWarehouses, directory, movements] = await Promise.all([erp.safeList(`items`), erp.safeList(`warehouses`), erp.userDirectory(), erp.safeList(`inventoryMovements`, { includeDeleted:true })]);
  const primaryWarehouse = mainWarehouse(allWarehouses);
  const warehouses = allWarehouses.filter(warehouse => warehouse.type !== `main` || warehouse.id === primaryWarehouse?.id);
  const reps = directory.filter(u => u.role === `sales_rep` && u.status !== `inactive` && u.status !== `deleted`);
  movements.sort((a,b) => String(b.date || b.createdAt || ``).localeCompare(String(a.date || a.createdAt || ``)));
  root.innerHTML = `<section class="card">
    ${renderTabs([{id:`stock`,label:`الرصيد`},{id:`movement`,label:`حركة مخزون`},{id:`warehouseCount`,label:`تعديل جرد الرئيسي`},{id:`loading`,label:`تحميل مندوب`},{id:`repTransfer`,label:`نقل بين المندوبين`},{id:`returns`,label:`إرجاع من مندوب`},{id:`count`,label:`جرد المندوب`}], `stock`)}
    <div class="panel active" data-panel="stock">${stockPanel(items, warehouses, user)}</div>
    <div class="panel" data-panel="movement">${movementPanel(items, warehouses, movements)}</div>
    <div class="panel" data-panel="warehouseCount">${warehouseCountPanel(items, warehouses)}</div>
    <div class="panel" data-panel="loading">${loadingPanel(items, warehouses, reps)}</div>
    <div class="panel" data-panel="repTransfer">${repTransferPanel(items, warehouses, reps)}</div>
    <div class="panel" data-panel="returns">${returnsPanel(items, warehouses, reps)}</div>
    <div class="panel" data-panel="count">${countPanel(items, warehouses, reps)}</div>
  </section>`;
  attachTabs(root);
  bindStock(root, user, warehouses);
  bindMovement(root, items, warehouses, user);
  bindWarehouseCount(root, items, user);
  bindLoading(root, items, warehouses, user);
  bindRepTransfer(root, items, warehouses, reps, user);
  bindReturns(root, warehouses, reps, user);
  bindCount(root, items, warehouses, reps);
}
function stockPanel(items, warehouses, user) {
  return `<div class="actions"><button class="btn primary" id="newItemBtn">إضافة صنف</button><button class="btn" id="exportStockBtn">تصدير الرصيد</button></div><p class="hint">يوجد مستودع رئيسي واحد فقط، ولكل مندوب سيارة مرتبطة تلقائياً بحسابه.</p><br>${table([
    {label:`الكود`, value:`itemCode`}, {label:`الصنف`, value:`itemName`}, {label:`الفئة`, value:r=>esc(cats[r.category]||r.category)}, {label:`الوحدة`, value:`unit`},
    {label:`تكلفة`, value:r=>money(r.costPrice)}, {label:`سعر بيع`, value:r=>money(r.standardSellingPrice)}, {label:`الحد الأدنى`, value:r=>qty(r.minimumStock)},
    ...warehouses.map(w => ({ label:w.warehouseName, value:r=>qty((r.stock||{})[w.id]||0) })),
    {label:`الحالة`, value:r=>statusBadge(r.status)},
    {label:`إجراء`, value:r=>`<button class="btn" data-edit-item="${esc(r.id)}">تعديل</button> ${can(user,`delete`) ? `<button class="btn danger" data-del-item="${esc(r.id)}">حذف</button>` : ``}`}
  ], items, `لا توجد أصناف`)}</div>`;
}
function itemForm(item = {}, warehouses = []) {
  const main = mainWarehouse(warehouses);
  const openingStockFields = item.id
    ? `<p class="hint wide">لتعديل رصيد صنف موجود استخدم تبويب «حركة مخزون» حتى تُسجّل الحركة في كشف المخزون.</p>`
    : `<input type="hidden" name="openingWarehouseId" value="${esc(main?.id || MAIN_WAREHOUSE_ID)}">
      <label>الرصيد الافتتاحي في المستودع الرئيسي<input type="number" step="0.001" min="0" name="openingBalance" value="0" ${main ? `` : `disabled`}></label>`;
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
function movementPanel(items, warehouses, movements) {
  const main = mainWarehouse(warehouses);
  const rows = movements.slice(0,500).map(movement => ({
    ...movement,
    itemName:items.find(item => item.id === movement.itemId)?.itemName || movement.itemId || `—`,
    warehouseName:warehouses.find(warehouse => warehouse.id === movement.warehouseId)?.warehouseName || movement.warehouseId || `—`
  }));
  const movementTable = table([
    {label:`التاريخ`,value:r=>esc(movementDate(r.date || r.createdAt))},
    {label:`النوع`,value:r=>esc(movementTypeLabel(r.type, r.reason))},
    {label:`الصنف`,value:r=>esc(r.itemName)},
    {label:`المستودع`,value:r=>esc(r.warehouseName)},
    {label:`الكمية`,value:r=>qty(r.quantity)},
    {label:`قبل`,value:r=>qty(r.balanceBefore)},
    {label:`بعد`,value:r=>qty(r.balanceAfter)},
    {label:`المرجع`,value:r=>esc(r.documentNumber || r.movementNumber || `—`)},
    {label:`ملاحظات`,value:r=>esc(r.notes || r.reason || `—`)}
  ], rows, `لا توجد حركات مخزون`);
  return `<form id="movementForm" class="form-grid"><input type="hidden" name="warehouseId" value="${esc(main?.id || MAIN_WAREHOUSE_ID)}"><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>نوع الحركة<select name="type"><option value="receive">استلام إلى المستودع الرئيسي</option><option value="damage">تالف / شطب من المستودع الرئيسي</option></select></label><label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required></label><label class="wide">سبب الحركة<textarea name="notes" required></textarea></label><button class="btn primary" type="submit" ${!main || !items.length ? `disabled` : ``}>حفظ حركة المخزون</button></form><h3 style="margin-top:24px">سجل حركات المخزون</h3>${movementTable}`;
}
function movementTypeLabel(type, reason) {
  const labels = { stock_adjust:`Stock Adjust - تعديل جرد`, stock_transfer:`تحويل مخزون`, rep_to_rep_transfer:`نقل بين المندوبين`, vehicle_load:`تحميل مندوب`, vehicle_return:`إرجاع من مندوب`, warehouse_receive:`استلام للمستودع الرئيسي`, damage:`تالف / شطب`, opening_balance:`رصيد افتتاحي`, warehouse_count_adjustment:`Stock Adjust - تعديل جرد` };
  return labels[type] || reason || type || `حركة مخزون`;
}
function movementDate(value) {
  if(value?.toDate) return value.toDate().toLocaleString(`ar-JO`);
  if(Number.isFinite(value?.seconds)) return new Date(value.seconds*1000).toLocaleString(`ar-JO`);
  return String(value || `—`);
}
function loadingPanel(items, warehouses, reps) {
  const main = mainWarehouse(warehouses);
  const availableItems=items.filter(item=>item.status===`active` && number(item.stock?.[main?.id])>0);
  const rows=availableItems.map(item=>`<tr data-loading-item="${esc(item.id)}"><td data-label="الكود">${esc(item.itemCode||`—`)}</td><td data-label="الصنف">${esc(item.itemName)}</td><td data-label="الرصيد في الرئيسي">${qty(item.stock?.[main?.id])}</td><td data-label="الكمية المراد تحميلها"><input class="loading-quantity" type="number" min="0" max="${number(item.stock?.[main?.id])}" step="0.001" value="0"></td></tr>`).join(``);
  return `<form id="loadingForm"><div class="form-grid"><label>رقم التحميل<input name="loadingNumber" value="${uid(`LOAD`)}" readonly></label><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>المندوب<select name="repId" required>${reps.map(r=>`<option value="${esc(r.id)}">${esc(r.fullName)}</option>`).join(``)}</select></label><label class="wide">ملاحظات<textarea name="notes"></textarea></label></div><p class="hint" style="margin:14px 0">جميع أصناف المستودع الرئيسي ذات الرصيد المتاح ظاهرة. أدخل الكمية فقط للأصناف المراد تحميلها.</p><div class="table-wrap"><table><thead><tr><th>الكود</th><th>الصنف</th><th>الرصيد في الرئيسي</th><th>الكمية المراد تحميلها</th></tr></thead><tbody>${rows||`<tr><td colspan="4">لا توجد أصناف برصيد متاح في المستودع الرئيسي</td></tr>`}</tbody></table></div><div class="actions" style="margin-top:14px"><span class="badge teal">الأصناف المتاحة: ${availableItems.length}</span><button class="btn primary" type="submit" ${!availableItems.length||!main||!reps.length?`disabled`:``}>اعتماد التحميل</button></div></form>`;
}
function repTransferPanel(items, warehouses, reps) {
  return `<form id="repTransferForm" class="form-grid"><label>التاريخ<input name="date" type="date" value="${todayISO()}" required></label><label>من المندوب<select name="fromRepId" required>${reps.map(rep=>`<option value="${esc(rep.id)}">${esc(rep.fullName)}</option>`).join(``)}</select></label><label>إلى المندوب<select name="toRepId" required>${reps.map(rep=>`<option value="${esc(rep.id)}">${esc(rep.fullName)}</option>`).join(``)}</select></label><label>الصنف<select name="itemId" required>${items.map(item=>`<option value="${esc(item.id)}">${esc(item.itemCode)} - ${esc(item.itemName)}</option>`).join(``)}</select></label><label>رصيد المندوب المرسل<input id="repTransferAvailableStock" readonly></label><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required></label><label class="wide">ملاحظات<textarea name="notes" required></textarea></label><button class="btn primary" type="submit" ${reps.length < 2 || !items.length ? `disabled` : ``}>نقل البضاعة</button></form>`;
}
function returnsPanel(items, warehouses, reps) {
  const main = mainWarehouse(warehouses);
  return `<form id="returnForm" class="form-grid"><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>المندوب<select name="repId" required>${reps.map(rep=>`<option value="${esc(rep.id)}">${esc(rep.fullName)}</option>`).join(``)}</select></label><label>الوجهة<input value="المستودع الرئيسي" readonly></label><label>سبب الإرجاع<select name="reason"><option>بضاعة بطيئة الحركة</option><option>رصيد زائد في السيارة</option><option>تحميل خاطئ</option><option>إرجاع نهاية فترة</option><option>تالف</option><option>أخرى</option></select></label><label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required></label><label class="wide">ملاحظات<textarea name="notes"></textarea></label><button class="btn primary" type="submit" ${!main || !reps.length || !items.length ? `disabled` : ``}>اعتماد الإرجاع</button></form>`;
}
function warehouseCountPanel(items, warehouses) {
  const firstItem = items[0];
  const firstWarehouse = mainWarehouse(warehouses);
  const currentBalance = number(firstItem?.stock?.[firstWarehouse?.id]);
  return `<form id="warehouseCountForm" class="form-grid">
    <label>تاريخ الجرد<input name="countDate" type="date" value="${todayISO()}" required></label>
    <input type="hidden" name="warehouseId" value="${esc(firstWarehouse?.id || MAIN_WAREHOUSE_ID)}">
    <label>المستودع<input value="المستودع الرئيسي" readonly></label>
    <label>الصنف<select name="itemId" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label>
    <label>الرصيد المسجّل<input id="warehouseCurrentStock" value="${currentBalance}" readonly></label>
    <label>الكمية الفعلية الجديدة<input name="actualQuantity" type="number" step="0.001" min="0" required></label>
    <label class="wide">سبب التعديل<textarea name="notes" required placeholder="مثال: نتيجة جرد فعلي للمستودع"></textarea></label>
    <button class="btn primary" type="submit" ${!items.length || !warehouses.length ? `disabled` : ``}>حفظ تعديل الجرد</button>
  </form>`;
}

function countPanel(items, warehouses, reps) {
  const firstVehicle = vehicleWarehouseForRep(reps[0], warehouses);
  const rows = items.map(item => {
    const expected = number(item.stock?.[firstVehicle?.id]);
    const shortagePrice = number(item.shortagePrice || item.standardSellingPrice);
    return `<tr data-count-item="${esc(item.id)}" data-shortage-price="${shortagePrice}">
      <td data-label="الكود">${esc(item.itemCode || `—`)}</td>
      <td data-label="الصنف">${esc(item.itemName)}</td>
      <td data-label="رصيد النظام"><input class="count-expected" value="${expected}" readonly></td>
      <td data-label="الرصيد وقت الجرد"><input class="count-actual" type="number" min="0" step="0.001" value="${expected}" required></td>
      <td data-label="الفرق"><strong class="count-difference">0</strong></td>
      <td data-label="سعر النقص">${money(shortagePrice)}</td>
      <td data-label="الخصم"><strong class="count-shortage">${money(0)}</strong></td>
    </tr>`;
  }).join(``);
  return `<form id="countForm">
    <div class="form-grid">
      <label>تاريخ الجرد<input name="countDate" type="date" value="${todayISO()}" required></label>
      <label>المندوب<select name="repId" required>${reps.map(r=>`<option value="${esc(r.id)}">${esc(r.fullName)}</option>`).join(``)}</select></label>
      <label class="wide">ملاحظات<textarea name="notes" placeholder="ملاحظات عامة على جرد المندوب"></textarea></label>
    </div>
    <p class="hint" style="margin:14px 0">جميع الأصناف ظاهرة. عدّل فقط «الرصيد وقت الجرد» عند وجود فرق؛ العجز يُخصم من المندوب بسعر النقص المسجل للصنف.</p>
    <div class="table-wrap"><table><thead><tr><th>الكود</th><th>الصنف</th><th>رصيد النظام</th><th>الرصيد وقت الجرد</th><th>الفرق</th><th>سعر النقص</th><th>الخصم</th></tr></thead><tbody>${rows || `<tr><td colspan="7">لا توجد أصناف للجرد</td></tr>`}</tbody></table></div>
    <div class="actions" style="margin-top:14px"><span class="badge teal">عدد الأصناف: ${items.length}</span><span class="badge amber">إجمالي العجز: <b id="countTotalShortage">${money(0)}</b></span><button class="btn primary" type="submit" ${!reps.length || !items.length || !firstVehicle ? `disabled` : ``}>اعتماد الجرد وخصم العجز</button></div>
  </form>`;
}
function bindStock(root, user, warehouses) {
  root.onclick = async e => {
    if (e.target.closest(`#newItemBtn`)) showItemModal();
    const edit = e.target.closest(`[data-edit-item]`); if (edit) showItemModal(await erp.get(`items`, edit.dataset.editItem));
    const del = e.target.closest(`[data-del-item]`); if (del) confirmModal(`سيتم حذف الصنف حذفاً ناعماً مع حفظ السجل.`, async()=>{ await erp.softDelete(`items`, del.dataset.delItem); toast(`تم حذف الصنف`); renderWarehouse(root, user); }, `حذف`);
    if (e.target.closest(`#exportStockBtn`)) exportExcel(`stock.xls`, await erp.list(`items`));
  };
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
      const movement = { warehouseId:d.warehouseId, notes:d.notes, date:d.date };
      if (d.type === `receive`) {
        await erp.changeStock(d.itemId, d.warehouseId, q, `استلام للمستودع الرئيسي`, { ...movement, type:`warehouse_receive` });
      } else if (d.type === `damage`) {
        await erp.changeStock(d.itemId, d.warehouseId, -q, `تالف / شطب من المستودع الرئيسي`, { ...movement, type:`damage` });
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

function bindLoading(root, items, warehouses, user) {
  const form = $(`#loadingForm`, root);
  if (!form) return;
  const rows=[...form.querySelectorAll(`[data-loading-item]`)];
  form.addEventListener(`input`,event=>{
    const input=event.target.closest(`.loading-quantity`);
    if(!input) return;
    const max=number(input.max);
    input.setCustomValidity(number(input.value)>max?`الكمية المطلوبة أكبر من الرصيد المتاح.`:``);
  });
  form.addEventListener(`submit`, async event => {
    event.preventDefault();
    const submitButton=event.submitter;
    if(submitButton?.disabled||!form.reportValidity()) return;
    const d=getFormData(form);
    const entries=rows.map(row=>({itemId:row.dataset.loadingItem,quantity:number(row.querySelector(`.loading-quantity`)?.value)})).filter(entry=>entry.quantity>0);
    if(!entries.length) return toast(`أدخل كمية لصنف واحد على الأقل`,`err`);
    const source=mainWarehouse(warehouses);
    if(!source) return toast(`المستودع الرئيسي غير موجود.`,`err`);
    let vehicle;
    try{ vehicle=requireVehicleWarehouse(d.repId,await erp.userDirectory(),warehouses).warehouse; }
    catch(error){ return toast(error.message,`err`); }
    try{
      for(const entry of entries){
        const item=items.find(row=>row.id===entry.itemId);
        const available=number(item?.stock?.[source.id]);
        if(entry.quantity>available+0.0001) throw new Error(`لا يمكن تحميل ${item?.itemName||`الصنف`}. الرصيد المتاح ${available} فقط.`);
      }
      if(submitButton) submitButton.disabled=true;
      for(const entry of entries){
        await erp.transferStock(entry.itemId,source.id,vehicle.id,entry.quantity,`تحميل المندوب`,{type:`vehicle_load`,date:d.date,repId:d.repId,documentNumber:d.loadingNumber,notes:d.notes});
      }
      toast(`تم تحميل ${entries.length} صنفاً للمندوب`);
      await renderWarehouse(root,user);
    }catch(error){
      console.error(`تعذر تحميل السيارة.`,error);
      toast(error.message||`تعذر تحميل السيارة`,`err`);
    }finally{
      if(submitButton?.isConnected) submitButton.disabled=false;
    }
  });
}
function bindRepTransfer(root, items, warehouses, reps, user) {
  const form = $(`#repTransferForm`, root);
  if (!form) return;
  const availableInput = $(`#repTransferAvailableStock`, form);
  const refreshAvailable = () => {
    const d = getFormData(form);
    const item = items.find(row => row.id === d.itemId);
    const warehouse = vehicleWarehouseForRep(reps.find(rep => rep.id === d.fromRepId), warehouses);
    availableInput.value = number(item?.stock?.[warehouse?.id]);
  };
  form.elements.fromRepId?.addEventListener(`change`, refreshAvailable);
  form.elements.itemId?.addEventListener(`change`, refreshAvailable);
  refreshAvailable();
  form.addEventListener(`submit`, async event => {
    event.preventDefault();
    const submitButton = event.submitter;
    if (submitButton?.disabled || !form.reportValidity()) return;
    const d = getFormData(form);
    try {
      if (d.fromRepId === d.toRepId) throw new Error(`اختر مندوباً مستلماً مختلفاً عن المندوب المرسل.`);
      const source = requireVehicleWarehouse(d.fromRepId, reps, warehouses);
      const destination = requireVehicleWarehouse(d.toRepId, reps, warehouses);
      const q = number(d.quantity);
      const item = items.find(row => row.id === d.itemId);
      const available = number(item?.stock?.[source.warehouse.id]);
      if (q <= 0) throw new Error(`الكمية غير صحيحة.`);
      if (q > available + 0.0001) throw new Error(`لا يمكن نقل ${item?.itemName || `الصنف`}. رصيد ${source.rep.fullName} الحالي ${available} فقط.`);
      if (submitButton) submitButton.disabled = true;
      await erp.transferStock(d.itemId, source.warehouse.id, destination.warehouse.id, q, `نقل بضاعة بين المندوبين`, { type:`rep_to_rep_transfer`, date:d.date, fromRepId:d.fromRepId, toRepId:d.toRepId, notes:d.notes });
      toast(`تم نقل البضاعة من ${source.rep.fullName} إلى ${destination.rep.fullName}`);
      await renderWarehouse(root, user);
    } catch (error) {
      console.error(`تعذر نقل البضاعة بين المندوبين.`, error);
      toast(error.message || `تعذر نقل البضاعة بين المندوبين`, `err`);
    } finally {
      if (submitButton?.isConnected) submitButton.disabled = false;
    }
  });
}
function bindReturns(root, warehouses, reps, user) {
  const form = $(`#returnForm`, root);
  form?.addEventListener(`submit`, async e => {
    e.preventDefault();
    const submitButton = e.submitter;
    if (submitButton?.disabled || !form.reportValidity()) return;
    const d = getFormData(form);
    const q = number(d.quantity);
    try {
      if (submitButton) submitButton.disabled = true;
      const source = requireVehicleWarehouse(d.repId, reps, warehouses);
      const destination = mainWarehouse(warehouses);
      if (!destination) throw new Error(`المستودع الرئيسي غير موجود.`);
      if (d.reason === `تالف`) await erp.changeStock(d.itemId, source.warehouse.id, -q, `تالف لدى المندوب`, { ...d, type:`damage` });
      else await erp.transferStock(d.itemId, source.warehouse.id, destination.id, q, `إرجاع بضاعة من المندوب`, { ...d, type:`vehicle_return` });
      toast(`تم اعتماد الإرجاع`);
      await renderWarehouse(root, user);
    } catch (error) {
      console.error(`تعذر اعتماد الإرجاع.`, error);
      toast(error.message || `تعذر اعتماد الإرجاع`, `err`);
    } finally {
      if (submitButton?.isConnected) submitButton.disabled = false;
    }
  });
}
function bindCount(root, items, warehouses, reps) {
  const form = $(`#countForm`, root);
  if (!form) return;
  const repSelect = form.elements.repId;
  const rows = [...form.querySelectorAll(`[data-count-item]`)];
  const updateRow = row => {
    const expected = number(row.querySelector(`.count-expected`)?.value);
    const actual = number(row.querySelector(`.count-actual`)?.value);
    const difference = actual - expected;
    const shortage = difference < 0 ? Math.abs(difference) * number(row.dataset.shortagePrice) : 0;
    row.querySelector(`.count-difference`).textContent = qty(difference);
    row.querySelector(`.count-difference`).className = `count-difference ${difference < 0 ? `risk` : difference > 0 ? `ok-text` : ``}`;
    row.querySelector(`.count-shortage`).textContent = money(shortage);
    return shortage;
  };
  const updateTotals = () => {
    const total = rows.reduce((sum, row) => sum + updateRow(row), 0);
    $(`#countTotalShortage`, form).textContent = money(total);
  };
  const loadRepStock = () => {
    const vehicle = vehicleWarehouseForRep(reps.find(rep => rep.id === repSelect.value), warehouses);
    rows.forEach(row => {
      const item = items.find(entry => entry.id === row.dataset.countItem);
      const expected = number(item?.stock?.[vehicle?.id]);
      row.querySelector(`.count-expected`).value = String(expected);
      row.querySelector(`.count-actual`).value = String(expected);
    });
    updateTotals();
  };
  repSelect?.addEventListener(`change`, loadRepStock);
  rows.forEach(row => row.querySelector(`.count-actual`)?.addEventListener(`input`, updateTotals));
  updateTotals();
  form?.addEventListener(`submit`, async e => {
    e.preventDefault();
    const submitButton = e.submitter;
    if (submitButton?.disabled) return;
    const d = getFormData(e.target);
    try {
      if (submitButton) submitButton.disabled = true;
      const vehicle = requireVehicleWarehouse(d.repId, reps, warehouses).warehouse;
      const entries = rows.map(row => ({ itemId:row.dataset.countItem, actualQuantity:number(row.querySelector(`.count-actual`).value) }));
      if (entries.some(entry => entry.actualQuantity < 0)) throw new Error(`الرصيد وقت الجرد لا يمكن أن يكون سالباً.`);
      const result = await erp.applyRepresentativeStockCount(d.repId, vehicle.id, d.countDate, entries, d.notes);
      toast(result.totalShortage > 0 ? `تم اعتماد الجرد وخصم ${money(result.totalShortage)} من المندوب` : `تم اعتماد الجرد دون عجز`);
      location.reload();
    } catch (error) {
      console.error(`تعذر حفظ جرد السيارة.`, error);
      toast(error.message || `تعذر حفظ جرد السيارة`, `err`);
    } finally {
      if (submitButton?.isConnected) submitButton.disabled = false;
    }
  });
}
