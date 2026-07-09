import { erp } from './firebase.js';
import { $, esc, money, number, getFormData, toast, table, statusBadge, renderTabs, attachTabs, exportExcel } from './utils.js';
import { roleLabel, isSuperuser } from './permissions.js';

export async function renderEmployees(root, user) {
  const [users, advances, salaries, expenses, counts, transfers] = await Promise.all([erp.list(`users`,{includeDeleted:true}), erp.list(`employeeAdvances`), erp.list(`salaries`), erp.list(`vehicleExpenses`), erp.list(`stockCounts`), erp.list(`internalTransfers`, { includeDeleted:true })]);
  const visibleUsers = user.role === `sales_rep` ? users.filter(u => u.id === user.id) : users;
  root.innerHTML = `<section class="card">${renderTabs([{id:`directory`,label:`دليل الموظفين`},{id:`statement`,label:`كشف موظف`}],`directory`)}
    <div class="panel active" data-panel="directory">${directory(visibleUsers, user)}</div>
    <div class="panel" data-panel="statement">${statement(visibleUsers)}</div>
  </section>`;
  attachTabs(root);
  bindEmployees(root, visibleUsers, { advances, salaries, expenses, counts, transfers }, user);
}
function remainingSalary(user){ return number(user.salaryBalance) + number(user.normalMonthlySalary) - number(user.advancesBalance); }
function directory(users, user){ const addButton = isSuperuser(user) ? `<button class="btn primary" id="newEmployeeBtn">إضافة موظف</button>` : ``; return `<div class="actions">${addButton}<button class="btn" id="exportEmployeesBtn">تصدير الموظفين</button></div><br>${table([{label:`الاسم`,value:`fullName`},{label:`الدور`,value:r=>roleLabel(r.role)},{label:`تاريخ البداية`,value:`startDate`},{label:`الراتب`,value:r=>money(r.normalMonthlySalary)},{label:`النقد`,value:r=>money(r.cashBalance)},{label:`CliQ`,value:r=>money(r.cliqBalance)},{label:`السلف`,value:r=>money(r.advancesBalance)},{label:`رصيد راتب سابق`,value:r=>money(r.salaryBalance)},{label:`المتبقي من الراتب`,value:r=>money(remainingSalary(r))},{label:`الحالة`,value:r=>statusBadge(r.status)},{label:`إجراء`,value:r=>isSuperuser(user)?`<button class="btn" data-edit-employee="${esc(r.id)}">تعديل</button>`:`—`}],users,`لا يوجد موظفون`)}`; }
function statement(users){ return `<label>اختر الموظف<select id="employeeStatementSelect"><option value="">اختر</option>${users.map(u=>`<option value="${esc(u.id)}">${esc(u.fullName)}</option>`).join(``)}</select></label><div id="employeeStatement" style="margin-top:14px"><div class="empty">اختر موظفاً لعرض كشف الصندوق والراتب.</div></div>`; }
function employeeForm(emp={}){ return `<form id="employeeForm" class="form-grid"><input type="hidden" name="id" value="${esc(emp.id||``)}"><label>الاسم الكامل<input name="fullName" required value="${esc(emp.fullName||``)}"></label><label>البريد<input name="email" type="email" value="${esc(emp.email||``)}"></label><label>اسم المستخدم<input name="username" value="${esc(emp.username||``)}"></label><label>الدور<input name="role" value="${esc(emp.role||`sales_rep`)}"></label><label>تاريخ البداية<input name="startDate" type="date" value="${esc(emp.startDate||``)}"></label><label>الراتب الشهري<input name="normalMonthlySalary" type="number" step="0.001" value="${number(emp.normalMonthlySalary)}"></label><label>المستودع المخصص<input name="assignedWarehouseId" value="${esc(emp.assignedWarehouseId||``)}"></label><label>النقد<input name="cashBalance" type="number" step="0.001" value="${number(emp.cashBalance)}"></label><label>CliQ<input name="cliqBalance" type="number" step="0.001" value="${number(emp.cliqBalance)}"></label><label>رصيد السلف<input name="advancesBalance" type="number" step="0.001" value="${number(emp.advancesBalance)}"></label><label>رصيد راتب سابق<input name="salaryBalance" type="number" step="0.001" value="${number(emp.salaryBalance)}"></label><label>الحالة<select name="status"><option value="active" ${emp.status!==`inactive`?`selected`:``}>فعال</option><option value="inactive" ${emp.status===`inactive`?`selected`:``}>غير فعال</option></select></label><label class="wide">ملاحظات<textarea name="notes">${esc(emp.notes||``)}</textarea></label></form>`; }
function bindEmployees(root, users, data, user){
  root.addEventListener(`click`,async e=>{
    if(e.target.closest(`#newEmployeeBtn`)) showEmp();
    const edit=e.target.closest(`[data-edit-employee]`); if(edit) showEmp(await erp.get(`users`,edit.dataset.editEmployee));
    if(e.target.closest(`#exportEmployeesBtn`)) exportExcel(`employees.xls`, users);
  });
  root.addEventListener(`change`,async e=>{
    if(e.target.id!==`employeeStatementSelect`) return;
    const id=e.target.value; const emp=users.find(u=>u.id===id);
    if(!emp){ $(`#employeeStatement`).innerHTML=`<div class="empty">اختر موظفاً</div>`; return; }
    const rows = [
      ...data.advances.filter(x=>x.employeeId===id).map(x=>({ type:`سلفة`, date:x.date, amount:number(x.amount), notes:x.notes||x.source, status:x.status })),
      ...data.salaries.filter(x=>x.employeeId===id).map(x=>({ type:`راتب`, date:x.salaryMonth||x.date, amount:number(x.paidAmount), notes:`مستحق ${money(x.entitlement)} / بعد الحركة ${money(x.salaryBalanceAfter)}`, status:x.status })),
      ...data.expenses.filter(x=>x.repId===id).map(x=>({ type:`مصروف سيارة`, date:x.date, amount:number(x.amount), notes:x.vendor||x.expenseType, status:x.status })),
      ...data.transfers.filter(x=>x.senderId===id || x.receiverId===id).map(x=>({ type:x.senderId===id?`تحويل صادر`:`تحويل وارد`, date:x.date||x.createdAt, amount:number(x.amount), notes:`${x.senderName||``} → ${x.receiverName||``}`, status:x.status }))
    ].sort((a,b)=>String(b.date||``).localeCompare(String(a.date||``)));
    $(`#employeeStatement`).innerHTML=`<div class="grid four"><section class="card kpi"><div><div class="label">النقد</div><div class="num">${money(emp.cashBalance)}</div></div></section><section class="card kpi"><div><div class="label">CliQ</div><div class="num">${money(emp.cliqBalance)}</div></div></section><section class="card kpi"><div><div class="label">السلف</div><div class="num">${money(emp.advancesBalance)}</div></div></section><section class="card kpi"><div><div class="label">المتبقي من الراتب</div><div class="num">${money(remainingSalary(emp))}</div></div></section></div><br>${table([{label:`النوع`,value:`type`},{label:`التاريخ`,value:`date`},{label:`المبلغ`,value:r=>money(r.amount)},{label:`ملاحظات`,value:`notes`},{label:`الحالة`,value:r=>statusBadge(r.status)}],rows,`لا توجد حركات`)}`;
  });
  async function showEmp(emp={}){ const {modal}=await import('./utils.js'); modal(emp.id?`تعديل موظف`:`إضافة موظف`,employeeForm(emp),[{label:`حفظ`,className:`primary`,handler:async wrap=>{const f=$(`#employeeForm`,wrap); if(!f.reportValidity())return; const d=getFormData(f); const payload={...d,normalMonthlySalary:number(d.normalMonthlySalary),cashBalance:number(d.cashBalance),cliqBalance:number(d.cliqBalance),advancesBalance:number(d.advancesBalance),salaryBalance:number(d.salaryBalance)}; if(d.id) await erp.update(`users`,d.id,payload); else await erp.add(`users`,payload); wrap.remove(); toast(`تم حفظ الموظف`); location.reload();}}]); }
}
