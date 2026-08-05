import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, browserLocalPersistence, setPersistence, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, limit, increment, runTransaction } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js';
import { uid, nowISO, normalize } from './utils.js';

const CONFIG_KEY = `burntOilsErpFirebaseConfig`;
const LOCAL_KEY = `burntOilsErpLocalStoreOfficialV2`;

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: `AIzaSyCsNsMyAfolMeDGXgFbVD4iA78WTAYJkrU`,
  authDomain: `dawood-c1c03.firebaseapp.com`,
  projectId: `dawood-c1c03`,
  storageBucket: `dawood-c1c03.firebasestorage.app`,
  messagingSenderId: `64130282055`,
  appId: `1:64130282055:web:ba4ab8fb879db68031b762`
};

export const OFFICIAL_LOGIN_ALIASES = [
  { username:`dawood`, email:`dawood@dawood-c1c03.com` },
  { username:`moatasem`, email:`moatasem@dawood-c1c03.com` },
  { username:`khader`, email:`khader@dawood-c1c03.com` }
];

export const OFFICIAL_BASE_USERS = [
  { id:`u-dawood`, fullName:`داود غانم`, username:`dawood`, email:`dawood@dawood-c1c03.com`, role:`dawood`, status:`active`, startDate:`2026-07-09`, normalMonthlySalary:0, assignedWarehouseId:`main`, cashBalance:0, cliqBalance:0, advancesBalance:0, salaryBalance:0 },
  { id:`u-moatasem`, fullName:`معتصم غانم`, username:`moatasem`, email:`moatasem@dawood-c1c03.com`, role:`moatasem`, status:`active`, startDate:`2026-07-09`, normalMonthlySalary:0, assignedWarehouseId:`main`, cashBalance:0, cliqBalance:0, advancesBalance:0, salaryBalance:0 },
  { id:`u-khader`, fullName:`خضر غانم`, username:`khader`, email:`khader@dawood-c1c03.com`, role:`general_manager`, status:`active`, startDate:`2026-07-09`, normalMonthlySalary:0, assignedWarehouseId:`main`, cashBalance:0, cliqBalance:0, advancesBalance:0, salaryBalance:0 }
];

export function publicUserProfile(user = {}) {
  return {
    id: user.id || user.uid || ``,
    fullName: user.fullName || user.email || `غير معروف`,
    username: usernameKey(user.username || ``),
    email: String(user.email || ``).trim().toLowerCase(),
    role: user.role || `viewer`,
    status: user.status || `active`,
    assignedWarehouseId: user.assignedWarehouseId || ``,
    updatedAt: nowISO()
  };
}

export const OFFICIAL_USER_DIRECTORY = OFFICIAL_BASE_USERS.map(publicUserProfile);

export const firebaseState = { mode: `booting`, app: null, auth: null, db: null, storage: null, config: null, user: null, profile: null, lastError: null };
let memoryLocalStore = null;

export const seedData = {
  settings: [{ id:`company`, companyName:`نظام داود غانم`, logoText:`د`, primaryColor:`#099999`, currency:`JOD`, fiscalYearStart:`01-01`, theme:`light` }],
  users: OFFICIAL_BASE_USERS.map(u => ({ ...u, createdBy:`system`, createdAt:nowISO(), lastLogin:null })),
  userDirectory: OFFICIAL_USER_DIRECTORY.map(u => ({ ...u, createdBy:`system`, createdAt:nowISO() })),
  warehouses: [{ id:`main`, warehouseCode:`MAIN`, warehouseName:`المستودع الرئيسي`, type:`main`, status:`active`, managerId:`u-dawood`, createdAt:nowISO(), createdBy:`system` }],
  items: [],
  manufacturingRecipes: [],
  customers: [],
  suppliers: [],
  inventoryMovements: [], productionOrders: [], salesInvoices: [], customerDebts: [], collections: [], purchaseInvoices: [], supplierDebts: [], cashDeliveries: [], internalTransfers: [], employeeAdvances: [], salaries: [], vehicleExpenses: [], stockCounts: [], systemLogs: [], notifications: [], loginAliases: []
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readLocalStore() {
  if (memoryLocalStore) return memoryLocalStore;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const [key, value] of Object.entries(seedData)) if (!Array.isArray(parsed[key])) parsed[key] = clone(value);
      memoryLocalStore = parsed;
      return parsed;
    }
  } catch (error) {
    console.warn(`تعذر قراءة التخزين المحلي. سيتم استخدام ذاكرة مؤقتة فقط.`, error);
  }
  memoryLocalStore = clone(seedData);
  return memoryLocalStore;
}
function writeLocalStore(store) {
  memoryLocalStore = store;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn(`تم منع خطأ امتلاء التخزين المحلي. البيانات المحلية مؤقتة فقط.`, error);
  }
}
function serverValue(value) { return value === serverTimestamp ? nowISO() : value; }
export function usernameKey(value) { return normalize(value || ``).replaceAll(`/`, `_`).replaceAll(`\\`, `_`).replaceAll(`#`, `_`).replaceAll(`?`, `_`).replaceAll(`[`, `_`).replaceAll(`]`, `_`); }
function looksLikeEmail(value) { return String(value || ``).includes(`@`); }

export function getSavedFirebaseConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || `null`) || DEFAULT_FIREBASE_CONFIG; } catch { return DEFAULT_FIREBASE_CONFIG; }
}
export function saveFirebaseConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
export function clearFirebaseConfig() { localStorage.removeItem(CONFIG_KEY); }

async function logAction(type, module, relatedId, oldValue, newValue, notes = ``) {
  const user = firebaseState.profile || firebaseState.user || { uid:`anonymous`, fullName:`غير معروف`, role:`unknown` };
  const log = { actionType:type, userId:user.id || user.uid, userName:user.fullName || user.email || `غير معروف`, userRole:user.role || `unknown`, module, relatedDocumentId:relatedId || ``, oldValue: oldValue ?? null, newValue: newValue ?? null, notes, userAgent:navigator.userAgent, createdAt:nowISO(), status:`active` };
  if (firebaseState.mode === `firebase` && firebaseState.db) {
    await addDoc(collection(firebaseState.db, `systemLogs`), { ...log, createdAt: serverTimestamp() });
  } else if (firebaseState.mode === `local`) {
    const store = readLocalStore();
    store.systemLogs.unshift({ id:uid(`log`), ...log });
    writeLocalStore(store);
  }
}

export const erp = {
  async init() {
    if (firebaseState.mode === `firebase` && firebaseState.app && firebaseState.auth && firebaseState.db) return firebaseState.mode;
    try { localStorage.removeItem(LOCAL_KEY); } catch {}
    const config = getSavedFirebaseConfig();
    if (config?.apiKey && config?.projectId && config?.authDomain) {
      try {
        firebaseState.config = config;
        firebaseState.app = getApps().length ? getApp() : initializeApp(config);
        firebaseState.auth = getAuth(firebaseState.app);
        try { await setPersistence(firebaseState.auth, browserLocalPersistence); } catch (persistenceError) { console.warn(`Auth persistence already initialized; continuing with Firebase mode.`, persistenceError); }
        firebaseState.db = getFirestore(firebaseState.app);
        firebaseState.storage = getStorage(firebaseState.app);
        firebaseState.mode = `firebase`;
        firebaseState.lastError = null;
      } catch (error) {
        console.error(`Firebase initialization failed. Official mode requires Firebase connection.`, error);
        firebaseState.mode = `firebase_error`;
        firebaseState.lastError = error;
      }
    } else {
      firebaseState.mode = `local`;
      readLocalStore();
    }
    return firebaseState.mode;
  },
  async onAuth(callback) {
    if (firebaseState.mode === `firebase` && firebaseState.auth) {
      return onAuthStateChanged(firebaseState.auth, async authUser => {
        firebaseState.user = authUser;
        firebaseState.profile = authUser ? await this.getProfile(authUser.uid, authUser.email) : null;
        if (firebaseState.profile) this.setUserDirectory(firebaseState.profile).catch(error => console.warn(`تعذر تحديث دليل المستخدمين العام.`, error));
        callback(firebaseState.profile);
      });
    }
    const stored = localStorage.getItem(`burntOilsErpLocalUser`);
    firebaseState.profile = stored ? JSON.parse(stored) : null;
    callback(firebaseState.profile);
    return () => {};
  },
  async login(identifier, password) {
    await this.init();
    const resolvedIdentifier = await this.resolveLoginIdentifier(identifier);
    if (firebaseState.mode === `firebase`) {
      const authUser = await signInWithEmailAndPassword(firebaseState.auth, resolvedIdentifier, password);
      const profile = await this.getProfile(authUser.user.uid, authUser.user.email);
      if (!profile || profile.status === `inactive`) throw new Error(`الحساب غير فعال أو غير معرّف في جدول المستخدمين.`);
      await this.update(`users`, profile.id || authUser.user.uid, { lastLogin: nowISO() }, false);
      await logAction(`login`, `auth`, profile.id || authUser.user.uid, null, { email: resolvedIdentifier }, `تسجيل دخول`);
      return profile;
    }
    if (firebaseState.mode !== `local`) throw new Error(`Firebase غير متصل. افتح Console لمعرفة سبب الخطأ، ولا تستخدم وضع التخزين المحلي في النسخة الرسمية.`);
    const store = readLocalStore();
    const user = store.users.find(u => (normalize(u.email) === normalize(resolvedIdentifier) || normalize(u.username) === normalize(identifier)) && u.localPassword === password && u.status === `active`);
    if (!user) throw new Error(`بيانات الدخول غير صحيحة أو الحساب غير فعال.`);
    user.lastLogin = nowISO();
    firebaseState.profile = user;
    try { localStorage.setItem(`burntOilsErpLocalUser`, JSON.stringify(user)); } catch (error) { console.warn(`تعذر حفظ جلسة المستخدم المحلي.`, error); }
    writeLocalStore(store);
    await logAction(`login`, `auth`, user.id, null, { identifier: resolvedIdentifier }, `تسجيل دخول محلي`);
    return user;
  },
  async logout() {
    await logAction(`logout`, `auth`, firebaseState.profile?.id, null, null, `تسجيل خروج`);
    if (firebaseState.mode === `firebase` && firebaseState.auth) await signOut(firebaseState.auth);
    localStorage.removeItem(`burntOilsErpLocalUser`);
    firebaseState.profile = null;
  },
  async resetPassword(email) {
    if (firebaseState.mode !== `firebase`) throw new Error(`استعادة كلمة المرور متاحة بعد إعداد Firebase فقط.`);
    await sendPasswordResetEmail(firebaseState.auth, email);
  },

  async resolveLoginIdentifier(identifier) {
    await this.init();
    const raw = String(identifier || ``).trim();
    if (!raw || looksLikeEmail(raw)) return raw;
    const official = OFFICIAL_LOGIN_ALIASES.find(u => normalize(u.username) === normalize(raw));
    if (official?.email) return official.email;
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      const key = usernameKey(raw);
      const snap = await getDoc(doc(firebaseState.db, `loginAliases`, key));
      if (snap.exists() && snap.data()?.email) return snap.data().email;
    }
    return raw;
  },
  async setLoginAlias(username, email, userId) {
    if (!username || !email || firebaseState.mode !== `firebase` || !firebaseState.db) return;
    const key = usernameKey(username);
    await setDoc(doc(firebaseState.db, `loginAliases`, key), { username: normalize(username), email: normalize(email), userId, updatedAt: serverTimestamp() }, { merge:true });
    await logAction(`set_alias`, `loginAliases`, key, null, { username, email, userId }, `تحديث اسم المستخدم للدخول`);
  },
  async setUserDirectory(userLike) {
    const row = publicUserProfile(userLike);
    if (!row.id) return null;
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      await setDoc(doc(firebaseState.db, `userDirectory`, row.id), { ...row, updatedAt: serverTimestamp() }, { merge:true });
    } else if (firebaseState.mode === `local`) {
      const store = readLocalStore();
      store.userDirectory ||= [];
      const index = store.userDirectory.findIndex(u => u.id === row.id);
      if (index >= 0) store.userDirectory[index] = { ...store.userDirectory[index], ...row };
      else store.userDirectory.push(row);
      writeLocalStore(store);
    }
    return row;
  },
  async syncUserDirectory(users = []) {
    const rows = [];
    for (const userLike of users) {
      const row = await this.setUserDirectory(userLike);
      if (row) rows.push(row);
    }
    await logAction(`sync_directory`, `userDirectory`, `bulk`, null, { count: rows.length }, `مزامنة دليل المستخدمين العام`);
    return rows;
  },
  async userDirectory(options = {}) {
    const fallback = [...OFFICIAL_USER_DIRECTORY];
    if (firebaseState.profile?.id) fallback.push(publicUserProfile(firebaseState.profile));
    let rows = [];
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      try { rows = await this.list(`userDirectory`, { includeDeleted:true }); }
      catch (error) { console.warn(`تعذر قراءة دليل المستخدمين. سيتم استخدام البيانات الأساسية فقط.`, error); }
    } else {
      rows = readLocalStore().userDirectory || [];
    }
    const map = new Map();
    [...fallback, ...rows].forEach(row => { if (row?.id) map.set(row.id, { ...map.get(row.id), ...row }); });
    return [...map.values()].filter(row => options.includeInactive || ![`inactive`,`deleted`].includes(row.status));
  },
  async safeList(collectionName, options = {}) {
    try { return await this.list(collectionName, options); }
    catch (error) {
      console.warn(`تعذر تحميل ${collectionName}.`, error);
      return Array.isArray(options.fallback) ? options.fallback : [];
    }
  },
  async getProfile(uidValue, email) {
    if (firebaseState.mode !== `firebase`) return firebaseState.profile;
    const byId = await getDoc(doc(firebaseState.db, `users`, uidValue));
    if (byId.exists()) return { ...byId.data(), id: byId.id };
    const q = query(collection(firebaseState.db, `users`), where(`email`, `==`, email), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return { ...snap.docs[0].data(), id: snap.docs[0].id };
    return null;
  },
  async list(collectionName, options = {}) {
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      const ref = collection(firebaseState.db, collectionName);
      const clauses = [];
      if (options.where) for (const clause of options.where) clauses.push(where(...clause));
      if (options.orderBy) clauses.push(orderBy(...options.orderBy));
      const snap = await getDocs(clauses.length ? query(ref, ...clauses) : ref);
      return snap.docs.map(d => ({ ...d.data(), id:d.id })).filter(d => options.includeDeleted || d.status !== `deleted`);
    }
    const store = readLocalStore();
    let rows = clone(store[collectionName] || []);
    if (!options.includeDeleted) rows = rows.filter(row => row.status !== `deleted`);
    if (options.where) rows = rows.filter(row => options.where.every(([field, op, val]) => op === `==` ? row[field] === val : op === `!=` ? row[field] !== val : true));
    if (options.orderBy) {
      const [field, dir] = options.orderBy;
      rows.sort((a,b) => String(a[field] || ``).localeCompare(String(b[field] || ``)) * (dir === `desc` ? -1 : 1));
    }
    return rows;
  },
  async get(collectionName, id) {
    if (!id) return null;
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      const snap = await getDoc(doc(firebaseState.db, collectionName, id));
      return snap.exists() ? { ...snap.data(), id:snap.id } : null;
    }
    return (readLocalStore()[collectionName] || []).find(row => row.id === id) || null;
  },
  async add(collectionName, payload, audit = true) {
    const user = firebaseState.profile || {};
    const { id: requestedId, ...payloadData } = payload || {};
    const data = { ...payloadData, status:payloadData.status || `active`, createdAt:payloadData.createdAt || nowISO(), createdBy:payloadData.createdBy || user.id || user.uid || `system`, updatedAt:nowISO(), updatedBy:user.id || user.uid || `system` };
    let id = requestedId || uid(collectionName.slice(0, 4));
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      if (requestedId) { await setDoc(doc(firebaseState.db, collectionName, requestedId), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); }
      else { const ref = await addDoc(collection(firebaseState.db, collectionName), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); id = ref.id; }
    } else {
      const store = readLocalStore();
      store[collectionName] ||= [];
      const existingIndex = store[collectionName].findIndex(row => row.id === id);
      if (existingIndex >= 0) store[collectionName][existingIndex] = { ...store[collectionName][existingIndex], ...data };
      else store[collectionName].push({ id, ...data });
      writeLocalStore(store);
    }
    if (audit) await logAction(`add`, collectionName, id, null, data, `إضافة سجل`);
    return { ...data, id };
  },
  async update(collectionName, id, patch, audit = true) {
    const oldValue = await this.get(collectionName, id);
    const user = firebaseState.profile || {};
    const { id: _ignoredId, ...patchData } = patch || {};
    const data = { ...patchData, updatedAt:nowISO(), updatedBy:user.id || user.uid || `system` };
    if (firebaseState.mode === `firebase` && firebaseState.db) await updateDoc(doc(firebaseState.db, collectionName, id), { ...data, updatedAt: serverTimestamp() });
    else {
      const store = readLocalStore();
      const idx = (store[collectionName] || []).findIndex(row => row.id === id);
      if (idx < 0) throw new Error(`السجل غير موجود.`);
      store[collectionName][idx] = { ...store[collectionName][idx], ...data };
      writeLocalStore(store);
    }
    if (audit) await logAction(`edit`, collectionName, id, oldValue, data, `تعديل سجل`);
    return { ...data, id };
  },
  async softDelete(collectionName, id) {
    return this.update(collectionName, id, { status:`deleted`, deletedAt:nowISO() }, true);
  },
  async hardDelete(collectionName, id) {
    if (firebaseState.mode === `firebase` && firebaseState.db) await deleteDoc(doc(firebaseState.db, collectionName, id));
    else {
      const store = readLocalStore();
      store[collectionName] = (store[collectionName] || []).filter(row => row.id !== id);
      writeLocalStore(store);
    }
    await logAction(`delete`, collectionName, id, null, null, `حذف نهائي`);
  },
  async batchSeed(overwrite = false) {
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      const batch = writeBatch(firebaseState.db);
      for (const [collectionName, rows] of Object.entries(seedData)) {
        if (collectionName === `users`) continue;
        for (const row of rows) {
          const ref = doc(firebaseState.db, collectionName, row.id || uid(collectionName));
          batch.set(ref, { ...row, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: !overwrite });
        }
      }
      await batch.commit();
    } else if (firebaseState.mode === `local`) {
      writeLocalStore(clone(seedData));
    } else {
      throw new Error(`Firebase غير متصل. لا يمكن تهيئة النسخة الرسمية.`);
    }
    await logAction(`seed`, `settings`, `seed`, null, { overwrite }, `تهيئة البيانات الأساسية`);
  },
  async exportBackup() {
    if (firebaseState.mode === `firebase`) {
      const data = {};
      for (const name of Object.keys(seedData)) data[name] = await this.list(name, { includeDeleted:true });
      return data;
    }
    return readLocalStore();
  },
  async importBackup(data) {
    if (firebaseState.mode === `firebase`) {
      const batch = writeBatch(firebaseState.db);
      for (const [collectionName, rows] of Object.entries(data)) {
        if (!Array.isArray(rows)) continue;
        for (const row of rows) batch.set(doc(firebaseState.db, collectionName, row.id || uid(collectionName)), row, { merge:true });
      }
      await batch.commit();
    } else writeLocalStore(data);
    await logAction(`import`, `settings`, `backup`, null, { collections:Object.keys(data) }, `استيراد نسخة احتياطية`);
  },
  logAction,
  async ensureRepresentativeVehicle(userLike) {
    const rep = userLike || {};
    if (!rep.id || rep.role !== `sales_rep`) return null;
    const warehouses = await this.list(`warehouses`, { includeDeleted:true });
    let warehouse = warehouses.find(row => row.type === `vehicle` && row.id === rep.assignedWarehouseId && (!row.assignedRepId || row.assignedRepId === rep.id));
    if (!warehouse) warehouse = warehouses.find(row => row.type === `vehicle` && row.assignedRepId === rep.id && row.status !== `deleted`);
    if (!warehouse) {
      const warehouseId = `vehicle_${rep.id}`;
      warehouse = await this.add(`warehouses`, {
        id:warehouseId,
        warehouseCode:`VEH-${String(rep.username || rep.id).toUpperCase()}`,
        warehouseName:`سيارة ${rep.fullName || rep.username || rep.id}`,
        type:`vehicle`,
        assignedRepId:rep.id,
        status:`active`
      }, true);
    } else if (warehouse.assignedRepId !== rep.id || warehouse.warehouseName !== `سيارة ${rep.fullName || rep.username || rep.id}`) {
      await this.update(`warehouses`, warehouse.id, { assignedRepId:rep.id, warehouseName:`سيارة ${rep.fullName || rep.username || rep.id}` }, true);
      warehouse = { ...warehouse, assignedRepId:rep.id, warehouseName:`سيارة ${rep.fullName || rep.username || rep.id}` };
    }
    if (rep.assignedWarehouseId !== warehouse.id) {
      await this.update(`users`, rep.id, { assignedWarehouseId:warehouse.id }, true);
      await this.setUserDirectory({ ...rep, assignedWarehouseId:warehouse.id });
    }
    return warehouse;
  },
  async changeStock(itemId, warehouseId, delta, reason, movement = {}) {
    const quantityDelta = Number(delta);
    if (!warehouseId) throw new Error(`المستودع غير محدد.`);
    if (!Number.isFinite(quantityDelta) || quantityDelta === 0) throw new Error(`كمية الحركة غير صحيحة.`);
    const movementNumber = movement.documentNumber || uid(`MOV`);
    const user = firebaseState.profile || firebaseState.user || {};
    let itemName = itemId;
    let before = 0;
    let after = 0;
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      const itemRef = doc(firebaseState.db, `items`, itemId);
      await runTransaction(firebaseState.db, async transaction => {
        const itemSnapshot = await transaction.get(itemRef);
        if (!itemSnapshot.exists()) throw new Error(`الصنف غير موجود.`);
        const item = itemSnapshot.data();
        itemName = item.itemName || itemId;
        const stock = { ...(item.stock || {}) };
        before = Number(stock[warehouseId] || 0);
        after = before + quantityDelta;
        if (after < -0.0001) throw new Error(`لا يوجد رصيد كافٍ من الصنف ${itemName}. الرصيد الحالي ${before}.`);
        stock[warehouseId] = after;
        transaction.update(itemRef, { stock, updatedAt:serverTimestamp(), updatedBy:user.id || user.uid || `system` });
        transaction.set(doc(collection(firebaseState.db, `inventoryMovements`)), {
          movementNumber, date:movement.date || nowISO(), itemId, warehouseId, quantity:quantityDelta,
          balanceBefore:before, balanceAfter:after, reason, ...movement, status:`active`,
          createdAt:serverTimestamp(), createdBy:user.id || user.uid || `system`, updatedAt:serverTimestamp(), updatedBy:user.id || user.uid || `system`
        });
      });
    } else if (firebaseState.mode === `local`) {
      const store = readLocalStore();
      const item = (store.items || []).find(row => row.id === itemId);
      if (!item) throw new Error(`الصنف غير موجود.`);
      itemName = item.itemName || itemId;
      const stock = { ...(item.stock || {}) };
      before = Number(stock[warehouseId] || 0);
      after = before + quantityDelta;
      if (after < -0.0001) throw new Error(`لا يوجد رصيد كافٍ من الصنف ${itemName}. الرصيد الحالي ${before}.`);
      stock[warehouseId] = after;
      item.stock = stock;
      item.updatedAt = nowISO();
      item.updatedBy = user.id || user.uid || `system`;
      store.inventoryMovements ||= [];
      store.inventoryMovements.push({ id:uid(`move`), movementNumber, date:movement.date || nowISO(), itemId, warehouseId, quantity:quantityDelta, balanceBefore:before, balanceAfter:after, reason, ...movement, status:`active`, createdAt:nowISO(), createdBy:user.id || user.uid || `system` });
      writeLocalStore(store);
    } else {
      throw new Error(`Firebase غير متصل. لا يمكن تنفيذ حركة المخزون.`);
    }
    await logAction(`stock_change`, `inventory`, movementNumber, { itemId, warehouseId, quantity:before }, { itemId, warehouseId, quantity:after }, `${reason} - ${itemName}`);
    return after;
  },
  async transferStock(itemId, fromWarehouseId, toWarehouseId, quantity, reason, movement = {}) {
    const transferQuantity = Number(quantity);
    if (!fromWarehouseId || !toWarehouseId) throw new Error(`مستودع المصدر والوجهة مطلوبان.`);
    if (fromWarehouseId === toWarehouseId) throw new Error(`يجب أن يختلف مستودع المصدر عن مستودع الوجهة.`);
    if (!Number.isFinite(transferQuantity) || transferQuantity <= 0) throw new Error(`كمية النقل غير صحيحة.`);

    const movementNumber = movement.documentNumber || uid(`MOV`);
    const movementDate = movement.date || nowISO();
    const movementType = movement.type || `stock_transfer`;
    const user = firebaseState.profile || firebaseState.user || {};
    let itemName = ``;
    let beforeFrom = 0;
    let afterFrom = 0;
    let beforeTo = 0;
    let afterTo = 0;

    if (firebaseState.mode === `firebase` && firebaseState.db) {
      const itemRef = doc(firebaseState.db, `items`, itemId);
      await runTransaction(firebaseState.db, async transaction => {
        const itemSnapshot = await transaction.get(itemRef);
        if (!itemSnapshot.exists()) throw new Error(`الصنف غير موجود.`);
        const item = itemSnapshot.data();
        itemName = item.itemName || itemId;
        const stock = { ...(item.stock || {}) };
        beforeFrom = Number(stock[fromWarehouseId] || 0);
        beforeTo = Number(stock[toWarehouseId] || 0);
        if (beforeFrom + 0.0001 < transferQuantity) throw new Error(`لا يوجد رصيد كافي من الصنف ${itemName}. الرصيد الحالي ${beforeFrom}.`);
        afterFrom = beforeFrom - transferQuantity;
        afterTo = beforeTo + transferQuantity;
        stock[fromWarehouseId] = afterFrom;
        stock[toWarehouseId] = afterTo;

        transaction.update(itemRef, { stock, updatedAt:serverTimestamp(), updatedBy:user.id || user.uid || `system` });
        const common = {
          movementNumber,
          date:movementDate,
          itemId,
          reason,
          type:movementType,
          documentNumber:movement.documentNumber || movementNumber,
          repId:movement.repId || ``,
          fromRepId:movement.fromRepId || ``,
          toRepId:movement.toRepId || ``,
          notes:movement.notes || ``,
          status:`active`,
          createdAt:serverTimestamp(),
          createdBy:user.id || user.uid || `system`,
          updatedAt:serverTimestamp(),
          updatedBy:user.id || user.uid || `system`
        };
        transaction.set(doc(collection(firebaseState.db, `inventoryMovements`)), { ...common, warehouseId:fromWarehouseId, fromWarehouseId, toWarehouseId, quantity:-transferQuantity, balanceBefore:beforeFrom, balanceAfter:afterFrom, direction:`out` });
        transaction.set(doc(collection(firebaseState.db, `inventoryMovements`)), { ...common, warehouseId:toWarehouseId, fromWarehouseId, toWarehouseId, quantity:transferQuantity, balanceBefore:beforeTo, balanceAfter:afterTo, direction:`in` });
      });
    } else if (firebaseState.mode === `local`) {
      const store = readLocalStore();
      const item = (store.items || []).find(row => row.id === itemId);
      if (!item) throw new Error(`الصنف غير موجود.`);
      itemName = item.itemName || itemId;
      const stock = { ...(item.stock || {}) };
      beforeFrom = Number(stock[fromWarehouseId] || 0);
      beforeTo = Number(stock[toWarehouseId] || 0);
      if (beforeFrom + 0.0001 < transferQuantity) throw new Error(`لا يوجد رصيد كافي من الصنف ${itemName}. الرصيد الحالي ${beforeFrom}.`);
      afterFrom = beforeFrom - transferQuantity;
      afterTo = beforeTo + transferQuantity;
      stock[fromWarehouseId] = afterFrom;
      stock[toWarehouseId] = afterTo;
      item.stock = stock;
      item.updatedAt = nowISO();
      item.updatedBy = user.id || user.uid || `system`;
      store.inventoryMovements ||= [];
      const common = { movementNumber, date:movementDate, itemId, reason, type:movementType, documentNumber:movement.documentNumber || movementNumber, repId:movement.repId || ``, fromRepId:movement.fromRepId || ``, toRepId:movement.toRepId || ``, notes:movement.notes || ``, status:`active`, createdAt:nowISO(), createdBy:user.id || user.uid || `system`, updatedAt:nowISO(), updatedBy:user.id || user.uid || `system` };
      store.inventoryMovements.push({ id:uid(`move`), ...common, warehouseId:fromWarehouseId, fromWarehouseId, toWarehouseId, quantity:-transferQuantity, balanceBefore:beforeFrom, balanceAfter:afterFrom, direction:`out` });
      store.inventoryMovements.push({ id:uid(`move`), ...common, warehouseId:toWarehouseId, fromWarehouseId, toWarehouseId, quantity:transferQuantity, balanceBefore:beforeTo, balanceAfter:afterTo, direction:`in` });
      writeLocalStore(store);
    } else {
      throw new Error(`Firebase غير متصل. لا يمكن تنفيذ حركة المخزون.`);
    }

    await logAction(`stock_transfer`, `inventory`, movementNumber, { itemId, [fromWarehouseId]:beforeFrom, [toWarehouseId]:beforeTo }, { itemId, [fromWarehouseId]:afterFrom, [toWarehouseId]:afterTo }, `${reason} - ${itemName}`);
    return { itemId, itemName, movementNumber, quantity:transferQuantity, beforeFrom, afterFrom, beforeTo, afterTo };
  },
  async setStock(itemId, warehouseId, actualQuantity, reason, movement = {}) {
    if (!warehouseId) throw new Error(`المستودع غير محدد.`);
    const after = Number(actualQuantity);
    if (!Number.isFinite(after) || after < 0) throw new Error(`الكمية الفعلية غير صحيحة.`);
    const movementNumber = uid(`MOV`);
    const user = firebaseState.profile || firebaseState.user || {};
    let before = 0;
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      const itemRef = doc(firebaseState.db, `items`, itemId);
      await runTransaction(firebaseState.db, async transaction => {
        const itemSnapshot = await transaction.get(itemRef);
        if (!itemSnapshot.exists()) throw new Error(`الصنف غير موجود.`);
        const item = itemSnapshot.data();
        const stock = { ...(item.stock || {}) };
        before = Number(stock[warehouseId] || 0);
        stock[warehouseId] = after;
        transaction.update(itemRef, { stock, updatedAt:serverTimestamp(), updatedBy:user.id || user.uid || `system` });
        transaction.set(doc(collection(firebaseState.db, `inventoryMovements`)), {
          movementNumber, date:movement.countDate || movement.date || nowISO(), itemId, warehouseId,
          quantity:after - before, balanceBefore:before, balanceAfter:after, reason, ...movement,
          type:`stock_adjust`, status:`active`, createdAt:serverTimestamp(), createdBy:user.id || user.uid || `system`, updatedAt:serverTimestamp(), updatedBy:user.id || user.uid || `system`
        });
      });
    } else if (firebaseState.mode === `local`) {
      const store = readLocalStore();
      const item = (store.items || []).find(row => row.id === itemId);
      if (!item) throw new Error(`الصنف غير موجود.`);
      const stock = { ...(item.stock || {}) };
      before = Number(stock[warehouseId] || 0);
      stock[warehouseId] = after;
      item.stock = stock;
      item.updatedAt = nowISO();
      item.updatedBy = user.id || user.uid || `system`;
      store.inventoryMovements ||= [];
      store.inventoryMovements.push({ id:uid(`move`), movementNumber, date:movement.countDate || movement.date || nowISO(), itemId, warehouseId, quantity:after - before, balanceBefore:before, balanceAfter:after, reason, ...movement, type:`stock_adjust`, status:`active`, createdAt:nowISO(), createdBy:user.id || user.uid || `system` });
      writeLocalStore(store);
    } else {
      throw new Error(`Firebase غير متصل. لا يمكن تعديل الجرد.`);
    }
    const difference = after - before;
    await logAction(`stock_adjust`, `inventory`, movementNumber, { itemId, warehouseId, quantity:before }, { itemId, warehouseId, quantity:after }, movement.notes || reason);
    return { before, after, difference, movementId:movementNumber };
  },
  async applyRepresentativeStockCount(repId, warehouseId, countDate, entries, notes = ``) {
    if (!repId) throw new Error(`المندوب غير محدد.`);
    if (!warehouseId) throw new Error(`سيارة المندوب غير محددة.`);
    const normalizedEntries = (Array.isArray(entries) ? entries : []).map(entry => ({
      itemId:String(entry.itemId || ``),
      actualQuantity:Number(entry.actualQuantity)
    }));
    if (!normalizedEntries.length) throw new Error(`لا توجد أصناف لاعتماد الجرد.`);
    if (normalizedEntries.some(entry => !entry.itemId || !Number.isFinite(entry.actualQuantity) || entry.actualQuantity < 0)) throw new Error(`توجد كمية فعلية غير صحيحة في الجرد.`);
    if (new Set(normalizedEntries.map(entry => entry.itemId)).size !== normalizedEntries.length) throw new Error(`يوجد صنف مكرر في الجرد.`);

    const countNumber = uid(`COUNT`);
    const effectiveDate = countDate || nowISO();
    const actor = firebaseState.profile || firebaseState.user || {};
    let lines = [];
    let totalShortage = 0;
    let repName = repId;
    let advancesBefore = 0;
    let advancesAfter = 0;

    if (firebaseState.mode === `firebase` && firebaseState.db) {
      const itemRefs = normalizedEntries.map(entry => doc(firebaseState.db, `items`, entry.itemId));
      const repRef = doc(firebaseState.db, `users`, repId);
      await runTransaction(firebaseState.db, async transaction => {
        const itemSnapshots = [];
        for (const itemRef of itemRefs) itemSnapshots.push(await transaction.get(itemRef));
        const repSnapshot = await transaction.get(repRef);
        if (!repSnapshot.exists()) throw new Error(`المندوب غير موجود.`);
        const rep = repSnapshot.data();
        repName = rep.fullName || rep.username || repId;
        advancesBefore = Number(rep.advancesBalance || 0);

        lines = normalizedEntries.map((entry, index) => {
          const snapshot = itemSnapshots[index];
          if (!snapshot.exists()) throw new Error(`أحد أصناف الجرد غير موجود.`);
          const item = snapshot.data();
          const expectedQuantity = Number(item.stock?.[warehouseId] || 0);
          const difference = entry.actualQuantity - expectedQuantity;
          const shortagePrice = Number(item.shortagePrice || item.standardSellingPrice || 0);
          const shortageValue = difference < 0 ? Math.abs(difference) * shortagePrice : 0;
          return { itemId:entry.itemId, itemName:item.itemName || entry.itemId, itemCode:item.itemCode || ``, expectedQuantity, actualQuantity:entry.actualQuantity, difference, shortagePrice, shortageValue };
        });
        totalShortage = lines.reduce((sum, line) => sum + line.shortageValue, 0);
        advancesAfter = advancesBefore + totalShortage;

        lines.forEach((line, index) => {
          if (Math.abs(line.difference) < 0.0001) return;
          const item = itemSnapshots[index].data();
          const stock = { ...(item.stock || {}), [warehouseId]:line.actualQuantity };
          transaction.update(itemRefs[index], { stock, updatedAt:serverTimestamp(), updatedBy:actor.id || actor.uid || `system` });
          transaction.set(doc(collection(firebaseState.db, `inventoryMovements`)), {
            movementNumber:uid(`MOV`), documentNumber:countNumber, countId:countNumber, date:effectiveDate,
            itemId:line.itemId, warehouseId, repId, quantity:line.difference,
            balanceBefore:line.expectedQuantity, balanceAfter:line.actualQuantity,
            reason:`فرق جرد المندوب`, notes, type:`stock_adjust`, status:`active`,
            createdAt:serverTimestamp(), createdBy:actor.id || actor.uid || `system`, updatedAt:serverTimestamp(), updatedBy:actor.id || actor.uid || `system`
          });
        });
        transaction.set(doc(firebaseState.db, `stockCounts`, countNumber), {
          countNumber, countType:`representative`, countDate:effectiveDate, repId, repName, warehouseId,
          lines, totalItems:lines.length, changedItems:lines.filter(line => Math.abs(line.difference) >= 0.0001).length,
          totalShortage, notes, status:`confirmed`, createdAt:serverTimestamp(), createdBy:actor.id || actor.uid || `system`, updatedAt:serverTimestamp(), updatedBy:actor.id || actor.uid || `system`
        });
        if (totalShortage > 0) {
          transaction.set(doc(collection(firebaseState.db, `employeeAdvances`)), {
            employeeId:repId, employeeName:repName, source:`stock_shortage`, relatedId:countNumber,
            amount:totalShortage, date:effectiveDate, notes:`عجز جرد المندوب ${repName}`, status:`confirmed`,
            createdAt:serverTimestamp(), createdBy:actor.id || actor.uid || `system`, updatedAt:serverTimestamp(), updatedBy:actor.id || actor.uid || `system`
          });
          transaction.update(repRef, { advancesBalance:advancesAfter, updatedAt:serverTimestamp(), updatedBy:actor.id || actor.uid || `system` });
        }
      });
    } else if (firebaseState.mode === `local`) {
      const store = readLocalStore();
      const rep = (store.users || []).find(row => row.id === repId);
      if (!rep) throw new Error(`المندوب غير موجود.`);
      repName = rep.fullName || rep.username || repId;
      advancesBefore = Number(rep.advancesBalance || 0);
      lines = normalizedEntries.map(entry => {
        const item = (store.items || []).find(row => row.id === entry.itemId);
        if (!item) throw new Error(`أحد أصناف الجرد غير موجود.`);
        const expectedQuantity = Number(item.stock?.[warehouseId] || 0);
        const difference = entry.actualQuantity - expectedQuantity;
        const shortagePrice = Number(item.shortagePrice || item.standardSellingPrice || 0);
        const shortageValue = difference < 0 ? Math.abs(difference) * shortagePrice : 0;
        if (Math.abs(difference) >= 0.0001) {
          item.stock = { ...(item.stock || {}), [warehouseId]:entry.actualQuantity };
          item.updatedAt = nowISO();
          item.updatedBy = actor.id || actor.uid || `system`;
          store.inventoryMovements ||= [];
          store.inventoryMovements.push({ id:uid(`move`), movementNumber:uid(`MOV`), documentNumber:countNumber, countId:countNumber, date:effectiveDate, itemId:entry.itemId, warehouseId, repId, quantity:difference, balanceBefore:expectedQuantity, balanceAfter:entry.actualQuantity, reason:`فرق جرد المندوب`, notes, type:`stock_adjust`, status:`active`, createdAt:nowISO(), createdBy:actor.id || actor.uid || `system` });
        }
        return { itemId:entry.itemId, itemName:item.itemName || entry.itemId, itemCode:item.itemCode || ``, expectedQuantity, actualQuantity:entry.actualQuantity, difference, shortagePrice, shortageValue };
      });
      totalShortage = lines.reduce((sum, line) => sum + line.shortageValue, 0);
      advancesAfter = advancesBefore + totalShortage;
      store.stockCounts ||= [];
      store.stockCounts.push({ id:countNumber, countNumber, countType:`representative`, countDate:effectiveDate, repId, repName, warehouseId, lines, totalItems:lines.length, changedItems:lines.filter(line => Math.abs(line.difference) >= 0.0001).length, totalShortage, notes, status:`confirmed`, createdAt:nowISO(), createdBy:actor.id || actor.uid || `system` });
      if (totalShortage > 0) {
        rep.advancesBalance = advancesAfter;
        rep.updatedAt = nowISO();
        rep.updatedBy = actor.id || actor.uid || `system`;
        store.employeeAdvances ||= [];
        store.employeeAdvances.push({ id:uid(`advance`), employeeId:repId, employeeName:repName, source:`stock_shortage`, relatedId:countNumber, amount:totalShortage, date:effectiveDate, notes:`عجز جرد المندوب ${repName}`, status:`confirmed`, createdAt:nowISO(), createdBy:actor.id || actor.uid || `system` });
      }
      writeLocalStore(store);
    } else {
      throw new Error(`Firebase غير متصل. لا يمكن اعتماد جرد المندوب.`);
    }

    try {
      await logAction(`representative_stock_count`, `inventory`, countNumber, { repId, warehouseId, advancesBalance:advancesBefore }, { repId, warehouseId, advancesBalance:advancesAfter, totalShortage, changedItems:lines.filter(line => Math.abs(line.difference) >= 0.0001).length }, `اعتماد جرد شامل للمندوب ${repName}`);
    } catch (error) {
      console.warn(`تم اعتماد الجرد، لكن تعذر إضافة سجل التدقيق المنفصل.`, error);
    }
    return { countNumber, lines, totalShortage, advancesBefore, advancesAfter };
  },
  async adjustUserBalance(userId, field, delta, reason, relatedId = ``) {
    const allowedFields = [`cashBalance`, `cliqBalance`, `advancesBalance`, `salaryBalance`];
    if (!allowedFields.includes(field)) throw new Error(`حقل الرصيد غير مسموح.`);
    let user = null;
    try { user = await this.get(`users`, userId); }
    catch (error) { console.warn(`تعذر قراءة رصيد المستخدم قبل التعديل. سيتم استخدام increment آمن.`, error); }
    if (user) {
      const before = Number(user[field] || 0);
      const after = before + Number(delta);
      await this.update(`users`, userId, { [field]: after }, true);
      await this.add(`systemLogs`, { actionType:`financial_balance`, module:`finance`, relatedDocumentId:relatedId, userName: firebaseState.profile?.fullName || `system`, notes:reason, oldValue:{ [field]:before }, newValue:{ [field]:after } }, false);
      return after;
    }
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      await updateDoc(doc(firebaseState.db, `users`, userId), { [field]: increment(Number(delta)), updatedAt: serverTimestamp(), updatedBy: firebaseState.profile?.id || firebaseState.user?.uid || `system` });
      await this.add(`systemLogs`, { actionType:`financial_balance`, module:`finance`, relatedDocumentId:relatedId, userName: firebaseState.profile?.fullName || `system`, notes:reason, oldValue:{ [field]:`غير مقروء` }, newValue:{ [field]:`increment ${Number(delta)}` } }, false);
      return null;
    }
    throw new Error(`المستخدم غير موجود.`);
  }
};


export async function createAuthUserViaRest(email, password) {
  if (!firebaseState.config?.apiKey) throw new Error(`إعداد Firebase غير مكتمل.`);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseState.config.apiKey}`, {
    method:`POST`, headers:{ 'Content-Type':`application/json` }, body:JSON.stringify({ email, password, returnSecureToken:true })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `تعذر إنشاء مستخدم Authentication.`);
  return data.localId;
}
