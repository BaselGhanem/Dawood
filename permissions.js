export const ROLES = {
  admin: { label: `مدير النظام`, pages: [`dashboard`,`admin`,`warehouse`,`manufacturing`,`sales`,`purchases`,`finance`,`reports`,`employees`,`settings`], actions: [`add`,`edit`,`delete`,`approve`,`export`,`print`,`finance`,`seed`,`manage_users`], data: [`allEmployees`,`allWarehouses`,`financialData`,`allData`] },
  dawood: { label: `داود غانم - Superuser`, pages: [`dashboard`,`admin`,`warehouse`,`manufacturing`,`sales`,`purchases`,`finance`,`reports`,`employees`,`settings`], actions: [`add`,`edit`,`delete`,`approve`,`export`,`print`,`finance`,`seed`,`manage_users`], data: [`allEmployees`,`allWarehouses`,`financialData`,`allData`] },
  moatasem: { label: `معتصم غانم - Superuser`, pages: [`dashboard`,`admin`,`warehouse`,`manufacturing`,`sales`,`purchases`,`finance`,`reports`,`employees`,`settings`], actions: [`add`,`edit`,`delete`,`approve`,`export`,`print`,`finance`,`seed`,`manage_users`], data: [`allEmployees`,`allWarehouses`,`financialData`,`allData`] },
  general_manager: { label: `خضر غانم - مشاهدة وتحميل`, pages: [`dashboard`,`warehouse`,`sales`,`finance`,`reports`,`employees`], actions: [`export`,`print`], data: [`allEmployees`,`allWarehouses`,`financialData`,`allData`,`viewOnly`] },
  warehouse_manager: { label: `مسؤول المستودع`, pages: [`dashboard`,`warehouse`,`reports`,`settings`], actions: [`add`,`edit`,`approve`,`export`,`print`], data: [`allWarehouses`] },
  manufacturing_manager: { label: `مسؤول التصنيع`, pages: [`dashboard`,`manufacturing`,`warehouse`,`reports`], actions: [`add`,`edit`,`approve`,`export`,`print`], data: [`allWarehouses`] },
  sales_rep: { label: `مندوب مبيعات`, pages: [`dashboard`,`sales`,`finance`,`reports`], actions: [`add`,`edit`,`print`,`export`], data: [`ownWarehouse`,`ownData`] },
  finance_user: { label: `مسؤول الصندوق`, pages: [`dashboard`,`finance`,`sales`,`purchases`,`reports`], actions: [`add`,`edit`,`approve`,`export`,`print`,`finance`], data: [`financialData`] },
  accountant: { label: `محاسب`, pages: [`dashboard`,`finance`,`purchases`,`reports`,`employees`], actions: [`add`,`edit`,`approve`,`export`,`print`,`finance`], data: [`financialData`,`allEmployees`] },
  viewer: { label: `مشاهدة فقط`, pages: [`dashboard`,`reports`], actions: [`export`,`print`], data: [] }
};
export const PAGE_TITLES = {
  dashboard: [`لوحة التحكم`, `واجهة مختصرة حسب صلاحية المستخدم`],
  admin: [`إدارة النظام`, `المستخدمون، الصلاحيات، وسجل الحركات`],
  warehouse: [`المستودعات والمخزون`, `الأصناف، الأرصدة، التحميل، الإرجاع والجرد`],
  manufacturing: [`التصنيع`, `الوصفات، أوامر الإنتاج، واستهلاك المواد الخام`],
  sales: [`المبيعات والذمم`, `بيع نقدي، بيع آجل، العملاء، وكشف المبيعات`],
  purchases: [`المشتريات والموردين`, `فواتير الشراء، الموردون، والمدفوعات`],
  finance: [`الصندوق والرواتب`, `التحويلات، السلف، الرواتب، وإشعارات الاستلام`],
  reports: [`التقارير`, `فلاتر ذكية وتصدير Excel / PDF`],
  employees: [`الموظفون والمندوبون`, `الأرصدة، الراتب المتبقي، والكشوف المالية`],
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
export function isSuperuser(user) { return [`admin`,`dawood`,`moatasem`].includes(user?.role); }
export function isViewOnly(user) { return user?.role === `general_manager` || canData(user, `viewOnly`); }
export const NAV = [
  [`dashboard`,`الرئيسية`,`⌂`], [`sales`,`المبيعات`,`◈`], [`finance`,`الصندوق`,`◍`],
  [`warehouse`,`المخزون`,`▦`], [`reports`,`التقارير`,`▤`], [`employees`,`الموظفون`,`◌`],
  [`manufacturing`,`التصنيع`,`⚙`], [`purchases`,`المشتريات`,`▣`], [`admin`,`إدارة النظام`,`◎`], [`settings`,`الإعدادات`,`⚑`]
];
