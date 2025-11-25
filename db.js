// db.js - IndexedDB management for Tea Supply Tracker PWA

const DB_NAME = 'TeaTrackerDB';
const DB_VERSION = 2;
let db = null;

// Initialize/open DB
function openDB() {
        return new Promise((resolve, reject) => {
                if (db) return resolve(db);
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                        db = event.target.result;
                        if (!db.objectStoreNames.contains('customers')) {
                                const customers = db.createObjectStore('customers', { keyPath: 'phone' });
                                customers.createIndex('by_name', 'name', { unique: false });
                                customers.createIndex('by_business', 'business', { unique: false });
                                customers.createIndex('by_address', 'address', { unique: false });
                        }
                        if (!db.objectStoreNames.contains('sales')) {
                                const sales = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
                                sales.createIndex('by_phone', 'phone', { unique: false });
                                sales.createIndex('by_remaining', 'remaining', { unique: false });
                                sales.createIndex('by_date', 'date', { unique: false });
                                sales.createIndex('by_synced', 'synced', { unique: false });
                        }
                };

                request.onsuccess = () => { db = request.result; resolve(db); };
                request.onerror = () => reject(request.error);
        });
}

// Generic transaction helper
function txPromise(storeNames, mode, work) {
        return openDB().then(() => new Promise((resolve, reject) => {
                const tx = db.transaction(storeNames, mode);
                const stores = {};
                storeNames.forEach(n => stores[n] = tx.objectStore(n));
                let result;
                try { result = work(stores); } catch (err) { reject(err); }
                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(tx.error);
        }));
}

// ----- Customers -----
function saveCustomer(customer) {
        return txPromise(['customers'], 'readwrite', stores => stores.customers.put(customer));
}

function getAllCustomers() {
        return openDB().then(() => new Promise((resolve, reject) => {
                const tx = db.transaction('customers', 'readonly');
                const store = tx.objectStore('customers');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
        }));
}

function searchCustomers(query) {
        return openDB().then(() => new Promise((resolve, reject) => {
                const tx = db.transaction('customers', 'readonly');
                const store = tx.objectStore('customers');
                const req = store.getAll();
                req.onsuccess = () => {
                        const q = (query || '').toLowerCase().trim();
                        if (!q) return resolve(req.result || []);
                        const filtered = (req.result || []).filter(c =>
                                (c.name || '').toLowerCase().includes(q) ||
                                (c.phone || '').toLowerCase().includes(q) ||
                                (c.business || '').toLowerCase().includes(q) ||
                                (c.address || '').toLowerCase().includes(q)
                        );
                        resolve(filtered);
                };
                req.onerror = () => reject(req.error);
        }));
}

// ----- Sales -----
function addSaleLocal(sale) {
        sale.createdAt = sale.createdAt || Date.now();
        sale.synced = sale.synced || false;
        return txPromise(['sales'], 'readwrite', stores => stores.sales.add(sale));
}

function getAllSales() {
        return openDB().then(() => new Promise((resolve, reject) => {
                const tx = db.transaction('sales', 'readonly');
                const store = tx.objectStore('sales');
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
        }));
}

function updateSaleLocal(sale) {
        return txPromise(['sales'], 'readwrite', stores => stores.sales.put(sale));
}

// ----- Expose for debugging -----
window.__teaDB = { openDB, getAllSales, getAllCustomers, addSaleLocal, updateSaleLocal, saveCustomer, searchCustomers };

// Automatically open DB on load
openDB().then(() => console.log('DB ready')).catch(err => console.error('DB init failed', err));
