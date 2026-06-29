import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, browserLocalPersistence, setPersistence, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, enableIndexedDbPersistence, writeBatch, limit } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js';
import { uid, nowISO, normalize } from './utils.js';

const CONFIG_KEY = `burntOilsErpFirebaseConfig`;
const LOCAL_KEY = `burntOilsErpLocalStoreV1`;
export const firebaseState = { mode: `local`, app: null, auth: null, db: null, storage: null, config: null, user: null, profile: null };

export const seedData = {
  settings: [{ id:`company`, companyName:`شركة الزيوت والبضاعة`, logoText:`ز`, primaryColor:`#099999`, currency:`JOD`, fiscalYearStart:`01-01`, theme:`light` }],
  users: [
    { id:`local-admin`, fullName:`مدير النظام`, username:`admin`, email:`admin@erp.local`, localPassword:`Admin2026@`, role:`admin`, status:`active`, startDate:`2026-01-01`, normalMonthlySalary:900, assignedWarehouseId:`main`, cashBalance:0, cliqBalance:0, advancesBalance:0, createdBy:`system`, createdAt:nowISO(), lastLogin:null },
    { id:`u-dawood`, fullName:`داود`, username:`dawood`, email:`dawood@erp.local`, localPassword:`Dawood2026@`, role:`dawood`, status:`active`, startDate:`2026-01-01`, normalMonthlySalary:700, assignedWarehouseId:`main`, cashBalance:0, cliqBalance:0, advancesBalance:0, createdBy:`system`, createdAt:nowISO() },
    { id:`u-moatasem`, fullName:`معتصم`, username:`moatasem`, email:`moatasem@erp.local`, localPassword:`Moatasem2026@`, role:`moatasem`, status:`active`, startDate:`2026-01-01`, normalMonthlySalary:700, assignedWarehouseId:`main`, cashBalance:0, cliqBalance:0, advancesBalance:0, createdBy:`system`, createdAt:nowISO() },
    { id:`u-rep-1`, fullName:`مندوب تجريبي`, username:`rep1`, email:`rep1@erp.local`, localPassword:`Rep2026@`, role:`sales_rep`, status:`active`, startDate:`2026-02-01`, normalMonthlySalary:500, assignedWarehouseId:`vehicle-rep-1`, cashBalance:0, cliqBalance:0, advancesBalance:0, createdBy:`system`, createdAt:nowISO() }
  ],
  warehouses: [
    { id:`main`, warehouseCode:`MAIN`, warehouseName:`المستودع الرئيسي`, type:`main`, status:`active`, managerId:`local-admin`, createdAt:nowISO(), createdBy:`system` },
    { id:`vehicle-rep-1`, warehouseCode:`CAR-001`, warehouseName:`سيارة المندوب التجريبي`, type:`vehicle`, status:`active`, repId:`u-rep-1`, createdAt:nowISO(), createdBy:`system` }
  ],
  items: [
    { id:`item-burnt-oil`, itemCode:`RM-001`, itemName:`زيت محروق خام`, category:`raw_material`, unit:`لتر`, costPrice:0.18, standardSellingPrice:0.25, shortagePrice:0.25, minimumStock:150, supplierId:`sup-1`, status:`active`, stock:{ main:1000, 'vehicle-rep-1':0 }, createdAt:nowISO(), createdBy:`system` },
    { id:`item-refined-oil`, itemCode:`FG-001`, itemName:`زيت معالج للبيع`, category:`manufactured`, unit:`لتر`, costPrice:0.42, standardSellingPrice:0.75, shortagePrice:0.75, minimumStock:100, supplierId:``, status:`active`, stock:{ main:220, 'vehicle-rep-1':35 }, createdAt:nowISO(), createdBy:`system` },
    { id:`item-filter`, itemCode:`TO-001`, itemName:`فلتر سيارة`, category:`tools`, unit:`قطعة`, costPrice:3.5, standardSellingPrice:4, shortagePrice:4, minimumStock:10, supplierId:`sup-2`, status:`active`, stock:{ main:30, 'vehicle-rep-1':2 }, createdAt:nowISO(), createdBy:`system` },
    { id:`item-ready`, itemCode:`RG-001`, itemName:`منظف صناعي جاهز`, category:`ready_goods`, unit:`عبوة`, costPrice:1.1, standardSellingPrice:1.8, shortagePrice:1.8, minimumStock:30, supplierId:`sup-2`, status:`active`, stock:{ main:90, 'vehicle-rep-1':8 }, createdAt:nowISO(), createdBy:`system` }
  ],
  manufacturingRecipes: [
    { id:`recipe-refined-oil`, recipeName:`إنتاج زيت معالج`, finalItemId:`item-refined-oil`, outputQuantity:100, wastePercent:3, laborCost:8, overheadCost:6, rawMaterials:[{ itemId:`item-burnt-oil`, quantity:120 }], status:`active`, notes:`وصفة تشغيلية تجريبية`, createdAt:nowISO(), createdBy:`system` }
  ],
  customers: [
    { id:`cust-1`, customerName:`عميل تجريبي`, phone:`0790000000`, area:`عمّان`, responsibleRepId:`u-rep-1`, openingBalance:0, currentBalance:0, status:`active`, createdAt:nowISO(), createdBy:`system` }
  ],
  suppliers: [
    { id:`sup-1`, supplierName:`مورد الزيوت الخام`, phone:`0780000000`, address:`عمّان`, openingBalance:0, currentBalance:0, status:`active`, createdAt:nowISO(), createdBy:`system` },
    { id:`sup-2`, supplierName:`مورد اللوازم`, phone:`0770000000`, address:`الزرقاء`, openingBalance:0, currentBalance:0, status:`active`, createdAt:nowISO(), createdBy:`system` }
  ],
  inventoryMovements: [], productionOrders: [], salesInvoices: [], customerDebts: [], collections: [], purchaseInvoices: [], supplierDebts: [], cashDeliveries: [], internalTransfers: [], employeeAdvances: [], salaries: [], vehicleExpenses: [], stockCounts: [], systemLogs: [], notifications: []
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readLocalStore() {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) {
    const fresh = clone(seedData);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(fresh));
    return fresh;
  }
  const parsed = JSON.parse(raw);
  for (const [key, value] of Object.entries(seedData)) if (!Array.isArray(parsed[key])) parsed[key] = clone(value);
  return parsed;
}
function writeLocalStore(store) { localStorage.setItem(LOCAL_KEY, JSON.stringify(store)); }
function serverValue(value) { return value === serverTimestamp ? nowISO() : value; }

export function getSavedFirebaseConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || `null`); } catch { return null; }
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
  } else {
    const store = readLocalStore();
    store.systemLogs.unshift({ id:uid(`log`), ...log });
    writeLocalStore(store);
  }
}

export const erp = {
  async init() {
    const config = getSavedFirebaseConfig();
    if (config?.apiKey && config?.projectId && config?.authDomain) {
      try {
        firebaseState.config = config;
        firebaseState.app = initializeApp(config);
        firebaseState.auth = getAuth(firebaseState.app);
        await setPersistence(firebaseState.auth, browserLocalPersistence);
        firebaseState.db = getFirestore(firebaseState.app);
        firebaseState.storage = getStorage(firebaseState.app);
        firebaseState.mode = `firebase`;
        enableIndexedDbPersistence(firebaseState.db).catch(() => {});
      } catch (error) {
        console.warn(`Firebase initialization failed, local mode activated`, error);
        firebaseState.mode = `local`;
      }
    }
    if (firebaseState.mode === `local`) readLocalStore();
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
    const store = readLocalStore();
    const user = store.users.find(u => (normalize(u.email) === normalize(identifier) || normalize(u.username) === normalize(identifier)) && u.localPassword === password && u.status === `active`);
    if (!user) throw new Error(`بيانات الدخول غير صحيحة أو الحساب غير فعال.`);
    user.lastLogin = nowISO();
    firebaseState.profile = user;
    localStorage.setItem(`burntOilsErpLocalUser`, JSON.stringify(user));
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
        for (const row of rows) {
          const ref = doc(firebaseState.db, collectionName, row.id || uid(collectionName));
          batch.set(ref, { ...row, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: !overwrite });
        }
      }
      await batch.commit();
    } else {
      writeLocalStore(clone(seedData));
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

export async function createAuthUserViaRest(email, password) {
  if (!firebaseState.config?.apiKey) throw new Error(`إعداد Firebase غير مكتمل.`);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseState.config.apiKey}`, {
    method:`POST`, headers:{ 'Content-Type':`application/json` }, body:JSON.stringify({ email, password, returnSecureToken:true })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `تعذر إنشاء مستخدم Authentication.`);
  return data.localId;
}
