import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, browserLocalPersistence, setPersistence, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, limit } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
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

export const OFFICIAL_BOOTSTRAP_USERS = [
  { fullName:`داود غانم`, username:`dawood`, email:`dawood@dawood-c1c03.com`, password:`Dawood2026@`, role:`dawood`, status:`active`, startDate:`2026-07-09`, normalMonthlySalary:0, assignedWarehouseId:`main`, cashBalance:0, cliqBalance:0, advancesBalance:0, salaryBalance:0 },
  { fullName:`معتصم غانم`, username:`moatasem`, email:`moatasem@dawood-c1c03.com`, password:`Moatasem2026@`, role:`moatasem`, status:`active`, startDate:`2026-07-09`, normalMonthlySalary:0, assignedWarehouseId:`main`, cashBalance:0, cliqBalance:0, advancesBalance:0, salaryBalance:0 },
  { fullName:`خضر غانم`, username:`khader`, email:`khader@dawood-c1c03.com`, password:`Khader2026@`, role:`general_manager`, status:`active`, startDate:`2026-07-09`, normalMonthlySalary:0, assignedWarehouseId:`main`, cashBalance:0, cliqBalance:0, advancesBalance:0, salaryBalance:0 }
];

export const firebaseState = { mode: `booting`, app: null, auth: null, db: null, storage: null, config: null, user: null, profile: null, lastError: null };
let memoryLocalStore = null;

export const seedData = {
  settings: [{ id:`company`, companyName:`نظام داود غانم`, logoText:`د`, primaryColor:`#099999`, currency:`JOD`, fiscalYearStart:`01-01`, theme:`light` }],
  users: OFFICIAL_BOOTSTRAP_USERS.map(u => ({ id:`u-${u.username}`, ...u, localPassword:u.password, password:undefined, createdBy:`system`, createdAt:nowISO(), lastLogin:null })).map(({ password, ...u }) => u),
  warehouses: [{ id:`main`, warehouseCode:`MAIN`, warehouseName:`المستودع الرئيسي`, type:`main`, status:`active`, managerId:`u-dawood`, createdAt:nowISO(), createdBy:`system` }],
  items: [],
  manufacturingRecipes: [],
  customers: [],
  suppliers: [],
  inventoryMovements: [], productionOrders: [], salesInvoices: [], customerDebts: [], collections: [], purchaseInvoices: [], supplierDebts: [], cashDeliveries: [], internalTransfers: [], employeeAdvances: [], salaries: [], vehicleExpenses: [], stockCounts: [], systemLogs: [], notifications: []
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

export function getSavedFirebaseConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || `null`) || DEFAULT_FIREBASE_CONFIG; } catch { return DEFAULT_FIREBASE_CONFIG; }
}
export function saveFirebaseConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
export function clearFirebaseConfig() { localStorage.removeItem(CONFIG_KEY); }

async function logAction(type, module, relatedId, oldValue, newValue, notes = ``) {
  const user = firebaseState.profile || firebaseState.user || { uid:`anonymous`, fullName:`غير معروف`, role:`unknown` };
  const log = { actionType:type, userId:user.id || user.uid, userName:user.fullName || user.email || `غير معروف`, userRole:user.role || `unknown`, module, relatedDocumentId:relatedId || ``, oldValue: oldValue || null, newValue: newValue || null, notes, userAgent:navigator.userAgent, createdAt:nowISO(), status:`active` };
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
    if (firebaseState.mode === `firebase`) {
      const authUser = await signInWithEmailAndPassword(firebaseState.auth, identifier, password);
      const profile = await this.getProfile(authUser.user.uid, authUser.user.email);
      if (!profile || profile.status === `inactive`) throw new Error(`الحساب غير فعال أو غير معرّف في جدول المستخدمين.`);
      await this.update(`users`, profile.id || authUser.user.uid, { lastLogin: nowISO() }, false);
      await logAction(`login`, `auth`, profile.id || authUser.user.uid, null, { email: identifier }, `تسجيل دخول`);
      return profile;
    }
    if (firebaseState.mode !== `local`) throw new Error(`Firebase غير متصل. افتح Console لمعرفة سبب الخطأ، ولا تستخدم وضع التخزين المحلي في النسخة الرسمية.`);
    const store = readLocalStore();
    const user = store.users.find(u => (normalize(u.email) === normalize(identifier) || normalize(u.username) === normalize(identifier)) && u.localPassword === password && u.status === `active`);
    if (!user) throw new Error(`بيانات الدخول غير صحيحة أو الحساب غير فعال.`);
    user.lastLogin = nowISO();
    firebaseState.profile = user;
    try { localStorage.setItem(`burntOilsErpLocalUser`, JSON.stringify(user)); } catch (error) { console.warn(`تعذر حفظ جلسة المستخدم المحلي.`, error); }
    writeLocalStore(store);
    await logAction(`login`, `auth`, user.id, null, { identifier }, `تسجيل دخول محلي`);
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
  async getProfile(uidValue, email) {
    if (firebaseState.mode !== `firebase`) return firebaseState.profile;
    const byId = await getDoc(doc(firebaseState.db, `users`, uidValue));
    if (byId.exists()) return { id: byId.id, ...byId.data() };
    const q = query(collection(firebaseState.db, `users`), where(`email`, `==`, email), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    return null;
  },
  async list(collectionName, options = {}) {
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      const ref = collection(firebaseState.db, collectionName);
      const clauses = [];
      if (options.where) for (const clause of options.where) clauses.push(where(...clause));
      if (options.orderBy) clauses.push(orderBy(...options.orderBy));
      const snap = await getDocs(clauses.length ? query(ref, ...clauses) : ref);
      return snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(d => options.includeDeleted || d.status !== `deleted`);
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
      return snap.exists() ? { id:snap.id, ...snap.data() } : null;
    }
    return (readLocalStore()[collectionName] || []).find(row => row.id === id) || null;
  },
  async add(collectionName, payload, audit = true) {
    const user = firebaseState.profile || {};
    const data = { ...payload, status:payload.status || `active`, createdAt:payload.createdAt || nowISO(), createdBy:payload.createdBy || user.id || user.uid || `system`, updatedAt:nowISO(), updatedBy:user.id || user.uid || `system` };
    let id = payload.id || uid(collectionName.slice(0, 4));
    if (firebaseState.mode === `firebase` && firebaseState.db) {
      if (payload.id) { await setDoc(doc(firebaseState.db, collectionName, payload.id), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); }
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
    return { id, ...data };
  },
  async update(collectionName, id, patch, audit = true) {
    const oldValue = await this.get(collectionName, id);
    const user = firebaseState.profile || {};
    const data = { ...patch, updatedAt:nowISO(), updatedBy:user.id || user.uid || `system` };
    if (firebaseState.mode === `firebase` && firebaseState.db) await updateDoc(doc(firebaseState.db, collectionName, id), { ...data, updatedAt: serverTimestamp() });
    else {
      const store = readLocalStore();
      const idx = (store[collectionName] || []).findIndex(row => row.id === id);
      if (idx < 0) throw new Error(`السجل غير موجود.`);
      store[collectionName][idx] = { ...store[collectionName][idx], ...data };
      writeLocalStore(store);
    }
    if (audit) await logAction(`edit`, collectionName, id, oldValue, data, `تعديل سجل`);
    return { id, ...data };
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
  async changeStock(itemId, warehouseId, delta, reason, movement = {}) {
    const item = await this.get(`items`, itemId);
    if (!item) throw new Error(`الصنف غير موجود.`);
    const stock = { ...(item.stock || {}) };
    const before = Number(stock[warehouseId] || 0);
    const after = before + Number(delta);
    if (after < -0.0001) throw new Error(`لا يوجد رصيد كافي من الصنف ${item.itemName}. الرصيد الحالي ${before}.`);
    stock[warehouseId] = after;
    await this.update(`items`, itemId, { stock }, true);
    await this.add(`inventoryMovements`, { movementNumber: uid(`MOV`), date: nowISO(), itemId, warehouseId, quantity: Number(delta), balanceBefore: before, balanceAfter: after, reason, ...movement }, true);
    return after;
  },
  async adjustUserBalance(userId, field, delta, reason, relatedId = ``) {
    const user = await this.get(`users`, userId);
    if (!user) throw new Error(`المستخدم غير موجود.`);
    const before = Number(user[field] || 0);
    const after = before + Number(delta);
    await this.update(`users`, userId, { [field]: after }, true);
    await this.add(`systemLogs`, { actionType:`financial_balance`, module:`finance`, relatedDocumentId:relatedId, userName: firebaseState.profile?.fullName || `system`, notes:reason, oldValue:{ [field]:before }, newValue:{ [field]:after } }, false);
    return after;
  }
};


export async function bootstrapOfficialFirebaseUsers() {
  await erp.init();
  if (firebaseState.mode !== `firebase`) throw new Error(`Firebase غير متصل. تحقق من الإعدادات أولاً.`);
  let primaryProfile = null;
  for (const [index, official] of OFFICIAL_BOOTSTRAP_USERS.entries()) {
    try {
      await createAuthUserViaRest(official.email, official.password);
    } catch (error) {
      if (!String(error.message || ``).includes(`EMAIL_EXISTS`)) throw error;
    }
    const authUser = await signInWithEmailAndPassword(firebaseState.auth, official.email, official.password);
    const uidValue = authUser.user.uid;
    const profile = {
      fullName: official.fullName,
      username: official.username,
      email: official.email,
      role: official.role,
      status: `active`,
      startDate: official.startDate,
      normalMonthlySalary: Number(official.normalMonthlySalary || 0),
      assignedWarehouseId: official.assignedWarehouseId || `main`,
      cashBalance: Number(official.cashBalance || 0),
      cliqBalance: Number(official.cliqBalance || 0),
      advancesBalance: Number(official.advancesBalance || 0),
      salaryBalance: Number(official.salaryBalance || 0),
      createdBy: `bootstrap`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(firebaseState.db, `users`, uidValue), profile, { merge:true });
    if (index === 0) primaryProfile = { id: uidValue, ...profile };
  }
  await signInWithEmailAndPassword(firebaseState.auth, OFFICIAL_BOOTSTRAP_USERS[0].email, OFFICIAL_BOOTSTRAP_USERS[0].password);
  firebaseState.profile = primaryProfile;
  await setDoc(doc(firebaseState.db, `settings`, `company`), { ...seedData.settings[0], updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge:true });
  await setDoc(doc(firebaseState.db, `warehouses`, `main`), { ...seedData.warehouses[0], updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge:true });
  await logAction(`bootstrap`, `auth`, `official-users`, null, { users: OFFICIAL_BOOTSTRAP_USERS.map(u => u.username) }, `تهيئة المستخدمين الرسميين بدون بيانات تجريبية`);
  return OFFICIAL_BOOTSTRAP_USERS;
}

export async function createAuthUserViaRest(email, password) {
  if (!firebaseState.config?.apiKey) throw new Error(`إعداد Firebase غير مكتمل.`);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseState.config.apiKey}`, {
    method:`POST`, headers:{ 'Content-Type':`application/json` }, body:JSON.stringify({ email, password, returnSecureToken:true })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `تعذر إنشاء مستخدم Authentication.`);
  return data.localId;
}
