export const ROLES = {
  admin: { label: `مدير النظام`, pages: [`dashboard`,`admin`,`warehouse`,`manufacturing`,`sales`,`purchases`,`finance`,`reports`,`employees`,`settings`], actions: [`add`,`edit`,`delete`,`approve`,`export`,`print`,`finance`,`seed`], data: [`allEmployees`,`allWarehouses`,`financialData`] },
  warehouse_manager: { label: `مسؤول المستودع`, pages: [`dashboard`,`warehouse`,`reports`,`settings`], actions: [`add`,`edit`,`approve`,`export`,`print`], data: [`allWarehouses`] },
  manufacturing_manager: { label: `مسؤول التصنيع`, pages: [`dashboard`,`manufacturing`,`warehouse`,`reports`], actions: [`add`,`edit`,`approve`,`export`,`print`], data: [`allWarehouses`] },
  sales_rep: { label: `مندوب مبيعات`, pages: [`dashboard`,`sales`,`finance`,`reports`], actions: [`add`,`edit`,`print`], data: [`ownWarehouse`,`ownData`] },
  finance_user: { label: `مسؤول الصندوق`, pages: [`dashboard`,`finance`,`sales`,`purchases`,`reports`], actions: [`add`,`edit`,`approve`,`export`,`print`,`finance`], data: [`financialData`] },
  dawood: { label: `داود`, pages: [`dashboard`,`finance`,`sales`,`reports`], actions: [`add`,`edit`,`approve`,`export`,`print`,`finance`], data: [`financialData`,`allWarehouses`] },
  moatasem: { label: `معتصم`, pages: [`dashboard`,`finance`,`sales`,`reports`], actions: [`add`,`edit`,`approve`,`export`,`print`,`finance`], data: [`financialData`,`allWarehouses`] },
  accountant: { label: `محاسب`, pages: [`dashboard`,`finance`,`purchases`,`reports`,`employees`], actions: [`add`,`edit`,`approve`,`export`,`print`,`finance`], data: [`financialData`,`allEmployees`] },
  viewer: { label: `مشاهدة فقط`, pages: [`dashboard`,`reports`], actions: [`export`,`print`], data: [] }
};
export const PAGE_TITLES = {
  dashboard: [`لوحة التحكم`, `نظرة تشغيلية على المخزون، الصندوق، الذمم والتنبيهات`],
  admin: [`إدارة النظام`, `المستخدمون، الصلاحيات، وسجل الحركات`],
  warehouse: [`المستودعات والمخزون`, `الرصيد، التحميل، الإرجاع، الجرد والفروقات`],
  manufacturing: [`التصنيع`, `الوصفات، أوامر الإنتاج، واستهلاك المواد الخام`],
  sales: [`المبيعات والذمم`, `فواتير البيع، تحصيل العملاء، ودفتر الذمم`],
  purchases: [`المشتريات والموردين`, `فواتير الشراء، الموردون، والمدفوعات`],
  finance: [`الصندوق والرواتب`, `تسليم النقد، التحويلات، السلف والرواتب`],
  reports: [`التقارير`, `تحليل وتصدير بيانات النظام`],
  employees: [`الموظفون والمندوبون`, `بيانات الموظفين والكشوف المالية`],
  settings: [`الإعدادات`, `الشركة، Firebase، النسخ الاحتياطي والتفضيلات`]
};
export function roleLabel(role) { return ROLES[role]?.label || role || `غير محدد`; }
export function can(user, action) {
  if (!user || user.status === `inactive`) return false;
  const role = ROLES[user.role] || ROLES.viewer;
  return role.actions.includes(action) || (Array.isArray(user.permissions?.actions) && user.permissions.actions.includes(action));
}
export function canPage(user, page) {
  if (page === `index`) return true;
  if (!user || user.status === `inactive`) return false;
  const role = ROLES[user.role] || ROLES.viewer;
  return role.pages.includes(page) || (Array.isArray(user.permissions?.pages) && user.permissions.pages.includes(page));
}
export function canData(user, key) {
  const role = ROLES[user?.role] || ROLES.viewer;
  return role.data.includes(key) || (Array.isArray(user?.permissions?.data) && user.permissions.data.includes(key));
}
export const NAV = [
  [`dashboard`,`لوحة التحكم`,`⌂`], [`warehouse`,`المستودعات`,`▦`], [`manufacturing`,`التصنيع`,`⚙`],
  [`sales`,`المبيعات`,`◈`], [`purchases`,`المشتريات`,`▣`], [`finance`,`الصندوق`,`◍`],
  [`reports`,`التقارير`,`▤`], [`employees`,`الموظفون`,`◌`], [`admin`,`إدارة النظام`,`◎`], [`settings`,`الإعدادات`,`⚑`]
];
