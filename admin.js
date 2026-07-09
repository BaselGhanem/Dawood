import { erp, createAuthUserViaRest, firebaseState } from './firebase.js';
import { $, esc, money, number, getFormData, toast, table, statusBadge, renderTabs, attachTabs, exportExcel } from './utils.js';
import { ROLES, roleLabel } from './permissions.js';

export async function renderAdmin(root, user) {
  const [users, logs, notifications] = await Promise.all([erp.list(`users`, { includeDeleted:true }), erp.list(`systemLogs`, { includeDeleted:true }), erp.list(`notifications`, { includeDeleted:true })]);
  root.innerHTML = `<section class="card">${renderTabs([{id:`users`,label:`المستخدمون`},{id:`roles`,label:`الصلاحيات`},{id:`logs`,label:`سجل الحركات`},{id:`notifications`,label:`الإشعارات`}],`users`)}
    <div class="panel active" data-panel="users">${usersPanel(users)}</div>
    <div class="panel" data-panel="roles">${rolesPanel()}</div>
    <div class="panel" data-panel="logs">${logsPanel(logs)}</div>
    <div class="panel" data-panel="notifications">${notificationsPanel(notifications, users)}</div>
  </section>`;
  attachTabs(root);
  bindAdmin(root, users);
}
function usersPanel(users){ return `<div class="actions"><button class="btn primary" id="newUserBtn">إضافة مستخدم</button><button class="btn" id="exportUsersBtn">تصدير المستخدمين</button></div><br>${table([{label:`الاسم`,value:`fullName`},{label:`البريد`,value:`email`},{label:`اسم المستخدم`,value:`username`},{label:`الدور`,value:r=>roleLabel(r.role)},{label:`الراتب`,value:r=>money(r.normalMonthlySalary)},{label:`النقد`,value:r=>money(r.cashBalance)},{label:`السلف`,value:r=>money(r.advancesBalance)},{label:`رصيد الراتب`,value:r=>money(r.salaryBalance)},{label:`الحالة`,value:r=>statusBadge(r.status)},{label:`إجراء`,value:r=>`<button class="btn" data-edit-user="${esc(r.id)}">تعديل</button> <button class="btn danger" data-disable-user="${esc(r.id)}">تعطيل</button>`}],users,`لا يوجد مستخدمون`)}`; }
function rolesPanel(){ return table([{label:`الدور`,value:r=>roleLabel(r.key)},{label:`الصفحات`,value:r=>esc(r.pages.join(`، `))},{label:`الأوامر`,value:r=>esc(r.actions.join(`، `))},{label:`نطاق البيانات`,value:r=>esc(r.data.join(`، `))}],Object.entries(ROLES).map(([key,v])=>({key,...v})),`لا توجد صلاحيات`); }
function logsPanel(logs){ return `<div class="filters"><label>بحث<input id="logSearch"></label><button type="button" class="btn" id="exportLogsBtn">تصدير السجل</button></div><div id="logsTable">${renderLogs(logs)}</div>`; }
function notificationsPanel(notifications, users){ return table([{label:`المستخدم`,value:r=>esc(users.find(u=>u.id===r.userId)?.fullName||r.userId||`—`)},{label:`العنوان`,value:`title`},{label:`الرسالة`,value:`message`},{label:`الحالة`,value:`status`},{label:`التاريخ`,value:`createdAt`}],notifications,`لا توجد إشعارات`); }
function renderLogs(logs){ return table([{label:`الإجراء`,value:`actionType`},{label:`المستخدم`,value:`userName`},{label:`الدور`,value:`userRole`},{label:`الموديول`,value:`module`},{label:`الوقت`,value:`createdAt`},{label:`ملاحظات`,value:`notes`}],logs.slice(0,500),`لا توجد سجلات`) }
function userForm(user={}){ return `<form id="userForm" class="form-grid"><input type="hidden" name="id" value="${esc(user.id||``)}"><label>الاسم الكامل<input name="fullName" required value="${esc(user.fullName||``)}"></label><label>البريد الإلكتروني<input name="email" type="email" required value="${esc(user.email||``)}"></label><label>اسم المستخدم<input name="username" required value="${esc(user.username||``)}"></label><label>كلمة المرور<input name="password" type="password" ${user.id?``:`required`}></label><label>الدور<select name="role">${Object.keys(ROLES).map(r=>`<option value="${r}" ${user.role===r?`selected`:``}>${roleLabel(r)}</option>`).join(``)}</select></label><label>الحالة<select name="status"><option value="active" ${user.status!==`inactive`?`selected`:``}>فعال</option><option value="inactive" ${user.status===`inactive`?`selected`:``}>غير فعال</option></select></label><label>تاريخ البداية<input name="startDate" type="date" value="${esc(user.startDate||``)}"></label><label>الراتب الشهري<input name="normalMonthlySalary" type="number" step="0.001" value="${number(user.normalMonthlySalary)}"></label><label>مستودع السيارة / المستودع<input name="assignedWarehouseId" value="${esc(user.assignedWarehouseId||``)}"></label><label>النقد الحالي<input name="cashBalance" type="number" step="0.001" value="${number(user.cashBalance)}"></label><label>CliQ<input name="cliqBalance" type="number" step="0.001" value="${number(user.cliqBalance)}"></label><label>رصيد السلف<input name="advancesBalance" type="number" step="0.001" value="${number(user.advancesBalance)}"></label><label>رصيد راتب تراكمي<input name="salaryBalance" type="number" step="0.001" value="${number(user.salaryBalance)}"></label></form>`; }
function bindAdmin(root, users){
  root.addEventListener(`click`,async e=>{
    if(e.target.closest(`#newUserBtn`)) showUser();
    const edit=e.target.closest(`[data-edit-user]`); if(edit) showUser(await erp.get(`users`,edit.dataset.editUser));
    const dis=e.target.closest(`[data-disable-user]`); if(dis){ await erp.update(`users`,dis.dataset.disableUser,{status:`inactive`}); toast(`تم تعطيل المستخدم`); location.reload(); }
    if(e.target.closest(`#exportUsersBtn`)) exportExcel(`users.xls`, await erp.list(`users`,{includeDeleted:true}));
    if(e.target.closest(`#exportLogsBtn`)) exportExcel(`system-logs.xls`, await erp.list(`systemLogs`,{includeDeleted:true}));
  });
  root.addEventListener(`input`,async e=>{ if(e.target.id===`logSearch`){ const q=e.target.value.toLowerCase(); const logs=(await erp.list(`systemLogs`,{includeDeleted:true})).filter(l=>JSON.stringify(l).toLowerCase().includes(q)); $(`#logsTable`).innerHTML=renderLogs(logs); } });
  async function showUser(user={}){
    const {modal}=await import('./utils.js');
    modal(user.id?`تعديل مستخدم`:`إضافة مستخدم`,userForm(user),[{label:`حفظ`,className:`primary`,handler:async wrap=>{
      const f=$(`#userForm`,wrap); if(!f.reportValidity())return; const d=getFormData(f); let id=d.id;
      const payload={...d,normalMonthlySalary:number(d.normalMonthlySalary),cashBalance:number(d.cashBalance),cliqBalance:number(d.cliqBalance),advancesBalance:number(d.advancesBalance),salaryBalance:number(d.salaryBalance)};
      delete payload.password; delete payload.id;
      if(!id && firebaseState.mode===`firebase` && d.password){ id=await createAuthUserViaRest(d.email,d.password); await erp.add(`users`,{id,...payload},true); }
      else if(id) await erp.update(`users`,id,payload);
      else await erp.add(`users`,{...payload,localPassword:d.password});
      wrap.remove(); toast(`تم حفظ المستخدم`); location.reload();
    }}]);
  }
}
