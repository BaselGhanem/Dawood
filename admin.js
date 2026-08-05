import { erp, createAuthUserViaRest, firebaseState, usernameKey } from './firebase.js';
import { $, esc, money, number, normalize, getFormData, toast, table, statusBadge, renderTabs, attachTabs, exportExcel } from './utils.js';
import { ROLES, roleLabel } from './permissions.js';

export async function renderAdmin(root, user) {
  let [users, logs, notifications] = await Promise.all([
    erp.list(`users`, { includeDeleted:true }),
    erp.list(`systemLogs`, { includeDeleted:true }),
    erp.list(`notifications`, { includeDeleted:true })
  ]);
  for (const rep of users.filter(row => row.role === `sales_rep` && row.status !== `deleted`)) await erp.ensureRepresentativeVehicle(rep);
  users = await erp.list(`users`, { includeDeleted:true });
  logs.sort((a,b)=>logTimestamp(b.createdAt)-logTimestamp(a.createdAt));
  root.innerHTML = `<section class="card">${renderTabs([{id:`users`,label:`المستخدمون`},{id:`roles`,label:`الصلاحيات`},{id:`logs`,label:`سجل الحركات`},{id:`notifications`,label:`الإشعارات`}],`users`)}
    <div class="panel active" data-panel="users">${usersPanel(users)}</div>
    <div class="panel" data-panel="roles">${rolesPanel()}</div>
    <div class="panel" data-panel="logs">${logsPanel(logs)}</div>
    <div class="panel" data-panel="notifications">${notificationsPanel(notifications, users)}</div>
  </section>`;
  attachTabs(root);
  bindAdmin(root, users);
}

function usersPanel(users){
  return `<div class="actions"><button class="btn primary" id="newUserBtn">إضافة مستخدم دخول</button><button class="btn" id="syncDirectoryBtn">مزامنة دليل المستخدمين</button><button class="btn" id="exportUsersBtn">تصدير المستخدمين</button></div><br>${table([
    {label:`الاسم`,value:`fullName`},{label:`البريد`,value:`email`},{label:`اسم المستخدم`,value:`username`},{label:`الدور`,value:r=>roleLabel(r.role)},
    {label:`الراتب`,value:r=>money(r.normalMonthlySalary)},{label:`النقد`,value:r=>money(r.cashBalance)},{label:`CliQ`,value:r=>money(r.cliqBalance)},
    {label:`السلف`,value:r=>money(r.advancesBalance)},{label:`رصيد الراتب`,value:r=>money(r.salaryBalance)},{label:`الحالة`,value:r=>statusBadge(r.status)},
    {label:`إجراء`,value:r=>`<button class="btn" data-edit-user="${esc(r.id)}">تعديل</button> <button class="btn danger" data-disable-user="${esc(r.id)}">تعطيل</button>`}
  ],users,`لا يوجد مستخدمون`)}`;
}
function rolesPanel(){ return table([{label:`الدور`,value:r=>roleLabel(r.key)},{label:`الصفحات`,value:r=>esc(r.pages.join(`، `))},{label:`الأوامر`,value:r=>esc(r.actions.join(`، `))},{label:`نطاق البيانات`,value:r=>esc(r.data.join(`، `))}],Object.entries(ROLES).map(([key,v])=>({key,...v})),`لا توجد صلاحيات`); }
function logsPanel(logs){ return `<div class="filters"><label>بحث<input id="logSearch"></label><label>الموديول<select id="logModuleFilter"><option value="">الكل</option>${[...new Set(logs.map(l=>l.module).filter(Boolean))].map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(``)}</select></label><label>الإجراء<select id="logActionFilter"><option value="">الكل</option>${[...new Set(logs.map(l=>l.actionType).filter(Boolean))].map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(``)}</select></label><button type="button" class="btn" id="exportLogsBtn">تصدير السجل</button></div><div id="logsTable">${renderLogs(logs)}</div>`; }
function notificationsPanel(notifications, users){ return table([{label:`المستخدم`,value:r=>esc(users.find(u=>u.id===r.userId)?.fullName||r.userId||`—`)},{label:`العنوان`,value:`title`},{label:`الرسالة`,value:`message`},{label:`الحالة`,value:`status`},{label:`التاريخ`,value:`createdAt`}],notifications,`لا توجد إشعارات`); }
function logTimestamp(value){
  if(value?.toMillis) return value.toMillis();
  if(Number.isFinite(value?.seconds)) return value.seconds*1000;
  return Date.parse(value || ``) || 0;
}
function logTime(value){
  const timestamp=logTimestamp(value);
  return timestamp ? new Date(timestamp).toLocaleString(`ar-JO`) : `—`;
}
function renderLogs(logs){ return table([{label:`الإجراء`,value:`actionType`},{label:`المستخدم`,value:`userName`},{label:`الدور`,value:`userRole`},{label:`الموديول`,value:`module`},{label:`الوقت`,value:r=>esc(logTime(r.createdAt))},{label:`المرجع`,value:r=>esc(r.relatedDocumentId||`—`)},{label:`ملاحظات`,value:`notes`},{label:`القيم`,value:r=>`<button class="btn" data-view-log="${esc(r.id)}">عرض</button>`},{label:`تعديل`,value:r=>`<button class="btn" data-edit-log="${esc(r.id)}">تعديل</button>`}],logs.slice(0,500),`لا توجد سجلات`); }
function logValues(value){
  if(value === undefined || value === null) return ``;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
function logForm(log={}){
  return `<form id="logForm" class="form-grid">
    <label>نوع الإجراء<input name="actionType" required value="${esc(log.actionType||``)}"></label>
    <label>الموديول<input name="module" required value="${esc(log.module||``)}"></label>
    <label>المرجع<input name="relatedDocumentId" value="${esc(log.relatedDocumentId||``)}"></label>
    <label>الحالة<select name="status"><option value="active" ${![`corrected`,`void`].includes(log.status)?`selected`:``}>فعال</option><option value="corrected" ${log.status===`corrected`?`selected`:``}>مصحح</option><option value="void" ${log.status===`void`?`selected`:``}>ملغى</option></select></label>
    <label class="wide">ملاحظات<textarea name="notes">${esc(log.notes||``)}</textarea></label>
    <label class="wide">القيمة القديمة بصيغة JSON<textarea name="oldValue" rows="7">${esc(logValues(log.oldValue))}</textarea></label>
    <label class="wide">القيمة الجديدة بصيغة JSON<textarea name="newValue" rows="7">${esc(logValues(log.newValue))}</textarea></label>
    <p class="hint wide">أي تعديل على هذا القيد سيُنشئ قيد تدقيق جديد يحفظ القيمة السابقة والتعديل الذي أجراه الأدمن.</p>
  </form>`;
}
function parseLogValue(value, label){
  const textValue = String(value || ``).trim();
  if(!textValue) return null;
  try { return JSON.parse(textValue); }
  catch { throw new Error(`${label} يجب أن تكون JSON صحيحة.`); }
}
function userForm(user={}){
  return `<form id="userForm" class="form-grid">
    <input type="hidden" name="id" value="${esc(user.id||``)}">
    <label>الاسم الكامل<input name="fullName" required value="${esc(user.fullName||``)}"></label>
    <label>البريد الإلكتروني<input name="email" type="email" required value="${esc(user.email||``)}" ${user.id?`readonly`:``}></label>
    <label>اسم المستخدم<input name="username" required value="${esc(user.username||``)}"></label>
    <label>كلمة المرور<input name="password" type="password" ${user.id?``:`required`} placeholder="${user.id?`تغيير كلمة المرور من Firebase Authentication`:`مطلوبة للمستخدم الجديد`}"></label>
    <label>الدور<select name="role">${Object.keys(ROLES).map(r=>`<option value="${r}" ${user.role===r?`selected`:``}>${roleLabel(r)}</option>`).join(``)}</select></label>
    <label>الحالة<select name="status"><option value="active" ${user.status!==`inactive`?`selected`:``}>فعال</option><option value="inactive" ${user.status===`inactive`?`selected`:``}>غير فعال</option></select></label>
    <label>تاريخ البداية<input name="startDate" type="date" value="${esc(user.startDate||``)}"></label>
    <label>الراتب الشهري<input name="normalMonthlySalary" type="number" step="0.001" value="${number(user.normalMonthlySalary)}"></label>
    ${user.role === `sales_rep` ? `<p class="hint wide">سيارة المندوب مرتبطة تلقائياً بالحساب ولا تحتاج إلى تحديد يدوي.</p>` : ``}
    <label>النقد الحالي<input name="cashBalance" type="number" step="0.001" value="${number(user.cashBalance)}"></label>
    <label>CliQ<input name="cliqBalance" type="number" step="0.001" value="${number(user.cliqBalance)}"></label>
    <label>رصيد السلف<input name="advancesBalance" type="number" step="0.001" value="${number(user.advancesBalance)}"></label>
    <label>رصيد راتب تراكمي<input name="salaryBalance" type="number" step="0.001" value="${number(user.salaryBalance)}"></label>
    <p class="hint wide">تعريف المستخدمين الرسمي يتم من هذه الشاشة فقط. صفحة الموظفين للعرض والتعديل التشغيلي، وليست لإنشاء حساب دخول.</p>
  </form>`;
}
function bindAdmin(root, users){
  root.addEventListener(`click`,async e=>{
    if(e.target.closest(`#newUserBtn`)) showUser();
    const edit=e.target.closest(`[data-edit-user]`); if(edit) showUser(await erp.get(`users`,edit.dataset.editUser));
    const dis=e.target.closest(`[data-disable-user]`); if(dis){ const oldUser=await erp.get(`users`,dis.dataset.disableUser); await erp.update(`users`,dis.dataset.disableUser,{status:`inactive`}); if(oldUser) await erp.setUserDirectory({...oldUser,status:`inactive`}); toast(`تم تعطيل المستخدم`); location.reload(); }
    if(e.target.closest(`#syncDirectoryBtn`)){ await erp.syncUserDirectory(await erp.list(`users`,{includeDeleted:true})); toast(`تمت مزامنة دليل المستخدمين للواجهات المحدودة`); location.reload(); }
    if(e.target.closest(`#exportUsersBtn`)) exportExcel(`users.xls`, await erp.list(`users`,{includeDeleted:true}));
    if(e.target.closest(`#exportLogsBtn`)) exportExcel(`system-logs.xls`, await erp.list(`systemLogs`,{includeDeleted:true}));
    const viewLog=e.target.closest(`[data-view-log]`); if(viewLog){
      const log=await erp.get(`systemLogs`,viewLog.dataset.viewLog); if(!log) return toast(`قيد السجل غير موجود`,`err`);
      const {modal}=await import('./utils.js');
      modal(`تفاصيل قيد الحركة`, `<div class="form-grid"><label class="wide">القيمة القديمة<textarea rows="10" readonly>${esc(logValues(log.oldValue))}</textarea></label><label class="wide">القيمة الجديدة<textarea rows="10" readonly>${esc(logValues(log.newValue))}</textarea></label><label class="wide">المتصفح / الجهاز<textarea rows="3" readonly>${esc(log.userAgent||`غير مسجل`)}</textarea></label></div>`, []);
    }
    const editLog=e.target.closest(`[data-edit-log]`); if(editLog) showLog(await erp.get(`systemLogs`,editLog.dataset.editLog));
  });
  root.addEventListener(`input`, filterLogs);
  root.addEventListener(`change`, filterLogs);
  async function filterLogs(e){
    if(![`logSearch`,`logModuleFilter`,`logActionFilter`].includes(e.target.id)) return;
    const q=$(`#logSearch`)?.value.toLowerCase() || ``;
    const module=$(`#logModuleFilter`)?.value || ``;
    const action=$(`#logActionFilter`)?.value || ``;
    const logs=(await erp.list(`systemLogs`,{includeDeleted:true})).filter(l=>(!q||JSON.stringify(l).toLowerCase().includes(q))&&(!module||l.module===module)&&(!action||l.actionType===action)).sort((a,b)=>logTimestamp(b.createdAt)-logTimestamp(a.createdAt));
    $(`#logsTable`).innerHTML=renderLogs(logs);
  }
  async function showLog(log){
    if(!log) return toast(`قيد السجل غير موجود`,`err`);
    const {modal}=await import('./utils.js');
    modal(`تعديل قيد السجل`,logForm(log),[{label:`حفظ التعديل`,className:`primary`,handler:async wrap=>{
      const form=$(`#logForm`,wrap); if(!form.reportValidity()) return;
      const d=getFormData(form);
      try {
        await erp.update(`systemLogs`,log.id,{ actionType:d.actionType, module:d.module, relatedDocumentId:d.relatedDocumentId, status:d.status, notes:d.notes, oldValue:parseLogValue(d.oldValue,`القيمة القديمة`), newValue:parseLogValue(d.newValue,`القيمة الجديدة`), correctedAt:new Date().toISOString(), correctedBy:firebaseState.profile?.id || `system` },true);
        wrap.remove(); toast(`تم تعديل القيد وتسجيل حركة التصحيح`); location.reload();
      } catch(error) { toast(error.message || `تعذر تعديل القيد`,`err`); }
    }}]);
  }
  async function showUser(user={}){
    const {modal}=await import('./utils.js');
    modal(user.id?`تعديل مستخدم`:`إضافة مستخدم`,userForm(user),[{label:`حفظ`,className:`primary`,handler:async wrap=>{
      const f=$(`#userForm`,wrap); if(!f.reportValidity())return;
      const d=getFormData(f); let id=d.id;
      const payload={...d,username:usernameKey(d.username),email:String(d.email||``).trim().toLowerCase(),normalMonthlySalary:number(d.normalMonthlySalary),cashBalance:number(d.cashBalance),cliqBalance:number(d.cliqBalance),advancesBalance:number(d.advancesBalance),salaryBalance:number(d.salaryBalance)};
      delete payload.password; delete payload.id;
      if(!payload.username) return toast(`اسم المستخدم مطلوب`,`err`);
      if(firebaseState.mode===`firebase`){
        const resolved = await erp.resolveLoginIdentifier(payload.username);
        if(resolved !== payload.username && normalize(resolved) !== normalize(payload.email)) return toast(`اسم المستخدم مستخدم لحساب آخر`,`err`);
      }
      if(!id && firebaseState.mode===`firebase` && d.password){
        id=await createAuthUserViaRest(payload.email,d.password);
        await erp.add(`users`,{id,...payload},true);
        await erp.setLoginAlias(payload.username,payload.email,id);
        await erp.setUserDirectory({id,...payload});
        if(payload.role===`sales_rep`) await erp.ensureRepresentativeVehicle({id,...payload});
      } else if(id) {
        await erp.update(`users`,id,payload);
        await erp.setLoginAlias(payload.username,payload.email,id);
        await erp.setUserDirectory({id,...payload});
        if(payload.role===`sales_rep`) await erp.ensureRepresentativeVehicle({id,...payload});
      } else {
        const localUser=await erp.add(`users`,{...payload,localPassword:d.password});
        await erp.setUserDirectory(localUser);
        if(payload.role===`sales_rep`) await erp.ensureRepresentativeVehicle(localUser);
      }
      wrap.remove(); toast(`تم حفظ المستخدم وصلاحياته`); location.reload();
    }}]);
  }
}
