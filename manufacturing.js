import { erp } from './firebase.js';
import { $, esc, money, qty, number, uid, todayISO, getFormData, toast, table, statusBadge, renderTabs, attachTabs, lineBuilder } from './utils.js';

export async function renderManufacturing(root, user) {
  const [items, recipes, orders] = await Promise.all([erp.list(`items`), erp.list(`manufacturingRecipes`), erp.list(`productionOrders`)]);
  root.innerHTML = `<section class="card">${renderTabs([{id:`production`,label:`أمر إنتاج`},{id:`recipes`,label:`الوصفات`},{id:`history`,label:`سجل التصنيع`}],`production`)}
    <div class="panel active" data-panel="production">${productionPanel(items, recipes)}</div>
    <div class="panel" data-panel="recipes">${recipesPanel(items, recipes)}</div>
    <div class="panel" data-panel="history">${historyPanel(orders, items)}</div>
  </section>`;
  attachTabs(root);
  bindProduction(root, items, recipes);
  bindRecipes(root, items);
}
function productionPanel(items, recipes) {
  return `<form id="productionForm" class="form-grid"><label>رقم الأمر<input name="productionNumber" value="${uid(`PROD`)}" readonly></label><label>التاريخ<input name="date" type="date" value="${todayISO()}"></label><label>الوصفة<select name="recipeId" required>${recipes.map(r=>`<option value="${esc(r.id)}">${esc(r.recipeName)}</option>`).join(``)}</select></label><label>كمية الإنتاج<input name="outputQuantity" type="number" min="0.001" step="0.001" required></label><label class="wide">سبب التعديل اليدوي عند وجود فرق<textarea name="overrideReason"></textarea></label><button class="btn primary" type="submit">اعتماد الإنتاج</button></form><div id="recipePreview" class="card" style="margin-top:14px"></div>`;
}
function recipesPanel(items, recipes) {
  return `<div class="actions"><button class="btn primary" id="newRecipeBtn">إضافة وصفة</button></div><br>${table([
    {label:`الوصفة`, value:`recipeName`}, {label:`المنتج النهائي`, value:r=>esc(items.find(i=>i.id===r.finalItemId)?.itemName||`—`)}, {label:`كمية الخرج`, value:r=>qty(r.outputQuantity)}, {label:`هدر`, value:r=>`${qty(r.wastePercent||0)}%`}, {label:`كلفة تشغيل`, value:r=>money(number(r.laborCost)+number(r.overheadCost))}, {label:`الحالة`, value:r=>statusBadge(r.status)}, {label:``, value:r=>`<button class="btn" data-edit-recipe="${esc(r.id)}">تعديل</button>`}
  ], recipes, `لا توجد وصفات تصنيع`)}</div>`;
}
function historyPanel(orders, items) {
  return table([
    {label:`رقم الأمر`, value:`productionNumber`}, {label:`التاريخ`, value:`date`}, {label:`المنتج`, value:r=>esc(items.find(i=>i.id===r.finalItemId)?.itemName||`—`)}, {label:`كمية الإنتاج`, value:r=>qty(r.outputQuantity)}, {label:`كلفة الوحدة`, value:r=>money(r.unitCost)}, {label:`الحالة`, value:r=>statusBadge(r.status)}
  ], orders, `لا توجد أوامر إنتاج`);
}
function recipeForm(items, recipe={}) {
  return `<form id="recipeForm" class="form-grid"><input type="hidden" name="id" value="${esc(recipe.id||``)}"><label>اسم الوصفة<input name="recipeName" required value="${esc(recipe.recipeName||``)}"></label><label>المنتج النهائي<select name="finalItemId" required>${items.map(i=>`<option value="${esc(i.id)}" ${recipe.finalItemId===i.id?`selected`:``}>${esc(i.itemCode)} - ${esc(i.itemName)}</option>`).join(``)}</select></label><label>كمية الخرج القياسية<input name="outputQuantity" type="number" min="0.001" step="0.001" value="${number(recipe.outputQuantity)||1}"></label><label>نسبة الهدر %<input name="wastePercent" type="number" min="0" step="0.001" value="${number(recipe.wastePercent)}"></label><label>كلفة عمالة<input name="laborCost" type="number" min="0" step="0.001" value="${number(recipe.laborCost)}"></label><label>كلفة تشغيل<input name="overheadCost" type="number" min="0" step="0.001" value="${number(recipe.overheadCost)}"></label><label>الحالة<select name="status"><option value="active">فعال</option><option value="inactive" ${recipe.status===`inactive`?`selected`:``}>غير فعال</option></select></label><label class="wide">ملاحظات<textarea name="notes">${esc(recipe.notes||``)}</textarea></label></form><div id="rawLines"></div>`;
}
function bindRecipes(root, items) {
  root.addEventListener(`click`, async e=>{
    if(e.target.closest(`#newRecipeBtn`)) showRecipe();
    const edit=e.target.closest(`[data-edit-recipe]`); if(edit) showRecipe(await erp.get(`manufacturingRecipes`,edit.dataset.editRecipe));
  });
  async function showRecipe(recipe={}) {
    const { modal } = await import('./utils.js');
    const wrap = modal(recipe.id?`تعديل وصفة`:`إضافة وصفة`, recipeForm(items, recipe), [{label:`حفظ الوصفة`, className:`primary`, handler:async m=>{const f=$(`#recipeForm`,m); if(!f.reportValidity()) return; const d=getFormData(f); const lines=builder.lines.map(l=>({itemId:l.itemId, quantity:number(l.quantity)})); if(!lines.length) return toast(`أدخل مادة خام واحدة على الأقل`,`err`); const payload={...d,outputQuantity:number(d.outputQuantity),wastePercent:number(d.wastePercent),laborCost:number(d.laborCost),overheadCost:number(d.overheadCost),rawMaterials:lines}; if(d.id) await erp.update(`manufacturingRecipes`,d.id,payload); else await erp.add(`manufacturingRecipes`,payload); m.remove(); toast(`تم حفظ الوصفة`); renderManufacturing(root); }}]);
    const builder = lineBuilder($(`#rawLines`, wrap), items.filter(i=>i.category===`raw_material` || i.category===`ready_goods` || i.category===`tools`), null);
    if(recipe.rawMaterials) builder.setLines(recipe.rawMaterials.map(x=>({id:uid(`line`), itemId:x.itemId, quantity:x.quantity, price:0})));
  }
}
function bindProduction(root, items, recipes) {
  const preview = $(`#recipePreview`, root);
  const form = $(`#productionForm`, root);
  const refresh = () => {
    const recipe = recipes.find(r=>r.id===form.recipeId.value);
    const out = number(form.outputQuantity.value) || number(recipe?.outputQuantity || 0);
    if(!recipe){ preview.innerHTML=`<div class="empty">لا توجد وصفة فعالة</div>`; return; }
    const factor = out / number(recipe.outputQuantity || 1);
    preview.innerHTML = `<h3>المواد المطلوبة</h3>${table([
      {label:`المادة`, value:r=>esc(items.find(i=>i.id===r.itemId)?.itemName||`—`)}, {label:`المطلوب`, value:r=>qty(number(r.quantity)*factor)}, {label:`رصيد الرئيسي`, value:r=>qty((items.find(i=>i.id===r.itemId)?.stock||{}).main||0)}
    ], recipe.rawMaterials || [])}`;
  };
  form?.addEventListener(`input`, refresh); refresh();
  form?.addEventListener(`submit`, async e=>{ e.preventDefault(); const d=getFormData(form); const recipe=recipes.find(r=>r.id===d.recipeId); if(!recipe) return toast(`الوصفة غير موجودة`,`err`); const output=number(d.outputQuantity); const factor=output/number(recipe.outputQuantity||1); let totalCost=number(recipe.laborCost)+number(recipe.overheadCost); for(const raw of recipe.rawMaterials||[]){ const item=await erp.get(`items`,raw.itemId); const required=number(raw.quantity)*factor*(1+number(recipe.wastePercent)/100); if(number(item.stock?.main)<required) throw new Error(`لا يوجد رصيد كاف من ${item.itemName}`); totalCost += required*number(item.costPrice); await erp.changeStock(raw.itemId,`main`,-required,`استهلاك تصنيع`,{productionNumber:d.productionNumber,recipeId:recipe.id}); } await erp.changeStock(recipe.finalItemId,`main`,output,`إنتاج تصنيع`,{productionNumber:d.productionNumber,recipeId:recipe.id}); await erp.add(`productionOrders`,{...d,finalItemId:recipe.finalItemId,outputQuantity:output,unitCost:totalCost/output,totalCost,status:`confirmed`,rawMaterials:recipe.rawMaterials}); toast(`تم اعتماد أمر الإنتاج`); location.reload(); });
}
