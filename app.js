/* app.js - IndexedDB + Contact Picker + optional Firebase sync
   Drop this file in place of your current app.js
*/

/* ---------- CONFIGURATION (paste your Firebase config here if you want cloud sync) ----------
   Steps to enable cloud sync:
   1) Create Firebase project, enable Authentication (Google) and Firestore.
   2) Add your Firebase config below and uncomment the initFirebase() call at bottom.
   3) Add Firebase SDK scripts into index.html before this app.js:
      <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
*/
const FIREBASE_CONFIG = null; // <-- replace `null` with your firebase config object to enable cloud sync
// Example:
// const FIREBASE_CONFIG = {
//   apiKey: "xxxx",
//   authDomain: "project.firebaseapp.com",
//   projectId: "project-id",
//   storageBucket: "project-id.appspot.com",
//   messagingSenderId: "xxxxx",
//   appId: "1:xxxxx:web:xxxx"
// };

/* ---------- IndexedDB helper ---------- */
const DB_NAME = 'TeaTrackerDB';
const DB_VERSION = 2;
let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const idb = e.target.result;
            if (!idb.objectStoreNames.contains('customers')) {
                const cust = idb.createObjectStore('customers', { keyPath: 'phone' }); // phone as key if provided
                cust.createIndex('by_name', 'name', { unique: false });
                cust.createIndex('by_business', 'business', { unique: false });
                cust.createIndex('by_address', 'address', { unique: false });
            }
            if (!idb.objectStoreNames.contains('sales')) {
                const sales = idb.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
                sales.createIndex('by_phone', 'phone', { unique: false });
                sales.createIndex('by_remaining', 'remaining', { unique: false });
                sales.createIndex('by_date', 'date', { unique: false });
                // store a synced flag when pushing to Firestore
                sales.createIndex('by_synced', 'synced', { unique: false });
            }
        };
        req.onsuccess = () => { db = req.result; resolve(db); };
        req.onerror = () => reject(req.error);
    });
}

function txPromise(storeNames, mode, work) {
    return openDB().then(() => new Promise((resolve, reject) => {
        const tx = db.transaction(storeNames, mode);
        const stores = {};
        storeNames.forEach(n => stores[n] = tx.objectStore(n));
        let out;
        try { out = work(stores); } catch (err) { reject(err); }
        tx.oncomplete = () => resolve(out);
        tx.onerror = () => reject(tx.error);
    }));
}

/* ---------- CRUD for local DB ---------- */
function saveCustomer(customer) {
    return txPromise(['customers'], 'readwrite', (stores) => {
        stores.customers.put(customer);
    });
}

function searchCustomers(query) {
    return openDB().then(() => new Promise((resolve, reject) => {
        const tx = db.transaction('customers', 'readonly');
        const store = tx.objectStore('customers');
        const req = store.getAll();
        req.onsuccess = () => {
            const q = (query || '').toLowerCase().trim();
            if (!q) return resolve(req.result || []);
            const filtered = (req.result || []).filter(c => {
                return (c.name || '').toLowerCase().includes(q) ||
                    (c.phone || '').toLowerCase().includes(q) ||
                    (c.business || '').toLowerCase().includes(q) ||
                    (c.address || '').toLowerCase().includes(q);
            });
            resolve(filtered);
        };
        req.onerror = () => reject(req.error);
    }));
}

function addSaleLocal(sale) {
    // sale object should include: date,name,phone,business,address,kgs,price,total,paymentType,cash,online,paidAmount,remaining,createdAt,synced
    sale.createdAt = sale.createdAt || Date.now();
    sale.synced = sale.synced || false;
    return txPromise(['sales'], 'readwrite', (stores) => {
        stores.sales.add(sale);
    });
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
    return txPromise(['sales'], 'readwrite', (stores) => {
        stores.sales.put(sale);
    });
}

function getAllCustomers() {
    return openDB().then(() => new Promise((resolve, reject) => {
        const tx = db.transaction('customers', 'readonly');
        const store = tx.objectStore('customers');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    }));
}

/* ---------- UI bindings: reuse your existing IDs ---------- */
const btnNew = document.getElementById('btnNew');
const btnHome = document.getElementById('btnHome');
const btnHistory = document.getElementById('btnHistory');

const homeSection = document.getElementById('homeSection');
const formSection = document.getElementById('formSection');
const historySection = document.getElementById('historySection');

const searchCustomer = document.getElementById('searchCustomer');
const searchResults = document.getElementById('searchResults');

const entryForm = document.getElementById('entryForm');
const dateInput = document.getElementById('date');
const customerName = document.getElementById('customerName');
const phoneInput = document.getElementById('phone');
const businessInput = document.getElementById('business');
const addressInput = document.getElementById('address');
const kgsInput = document.getElementById('kgs');
const priceInput = document.getElementById('price');
const totalDisplay = document.getElementById('totalDisplay');
const paymentType = document.getElementById('paymentType');
const cashSection = document.getElementById('cashSection');
const onlineSection = document.getElementById('onlineSection');
const cashPaid = document.getElementById('cashPaid');
const onlinePaid = document.getElementById('onlinePaid');

const pendingList = document.getElementById('pendingList');
const customersList = document.getElementById('customersList');
const customerDetails = document.getElementById('customerDetails');

const pendingTemplate = document.getElementById('pending-template');
const saleRowTemplate = document.getElementById('sale-row-template');

/* ---------- Simple navigation ---------- */
function showSection(sec) {
    homeSection.classList.add('hidden');
    formSection.classList.add('hidden');
    historySection.classList.add('hidden');
    sec.classList.remove('hidden');
}
btnNew.addEventListener('click', () => {
    entryForm.reset();
    totalDisplay.innerText = 'Total: ₹0';
    updatePaymentVisibility();
    searchResults.classList.add('hidden');
    showSection(formSection);
});
btnHome.addEventListener('click', () => { showSection(homeSection); loadPending(); });
btnHistory.addEventListener('click', () => { showSection(historySection); renderCustomersList(); });

/* ---------- helpers ---------- */
phoneInput.addEventListener('input', (e) => {
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
});

function getTotal() {
    const kg = Number(kgsInput.value) || 0;
    const price = Number(priceInput.value) || 0;
    return kg * price;
}
function updateTotal() {
    totalDisplay.innerText = `Total: ₹${getTotal()}`;
    updateMixedPayments();
}
kgsInput.addEventListener('input', updateTotal);
priceInput.addEventListener('input', updateTotal);

function updatePaymentVisibility() {
    const val = (paymentType.value || '').toLowerCase();
    if (val === 'mixed') {
        cashSection.classList.remove('hidden');
        onlineSection.classList.remove('hidden');
    } else if (val === 'cash') {
        cashSection.classList.remove('hidden');
        onlineSection.classList.add('hidden');
        onlinePaid.value = 0;
    } else if (val === 'online') {
        cashSection.classList.add('hidden');
        onlineSection.classList.remove('hidden');
        cashPaid.value = 0;
    } else {
        cashSection.classList.add('hidden');
        onlineSection.classList.add('hidden');
        cashPaid.value = 0;
        onlinePaid.value = 0;
    }
}
paymentType.addEventListener('change', updatePaymentVisibility);

/* ---------- mixed payments auto-calculation ---------- */
function updateMixedPayments() {
    if ((paymentType.value || '').toLowerCase() !== 'mixed') return;
    const total = getTotal();

    cashPaid.value = cashPaid.value === '' ? '0' : cashPaid.value;
    onlinePaid.value = onlinePaid.value === '' ? '0' : onlinePaid.value;

    if (document.activeElement === cashPaid) {
        const cash = Math.max(Number(cashPaid.value) || 0, 0);
        const calcOnline = Math.max(total - cash, 0);
        if (Number(onlinePaid.value) !== calcOnline) onlinePaid.value = calcOnline;
    }
    if (document.activeElement === onlinePaid) {
        const online = Math.max(Number(onlinePaid.value) || 0, 0);
        const calcCash = Math.max(total - online, 0);
        if (Number(cashPaid.value) !== calcCash) cashPaid.value = calcCash;
    }
    if (document.activeElement !== cashPaid && document.activeElement !== onlinePaid) {
        const c = Math.max(Number(cashPaid.value) || 0, 0);
        const o = Math.max(Number(onlinePaid.value) || 0, 0);
        if (c + o > total) {
            onlinePaid.value = Math.max(total - c, 0);
        }
    }
}
cashPaid.addEventListener('input', updateMixedPayments);
onlinePaid.addEventListener('input', updateMixedPayments);
paymentType.addEventListener('change', updateMixedPayments);
kgsInput.addEventListener('input', updateMixedPayments);
priceInput.addEventListener('input', updateMixedPayments);

/* ---------- search-as-you-type for existing customers ---------- */
let searchTimeout = null;
searchCustomer.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        if (!q) { searchResults.classList.add('hidden'); searchResults.innerHTML = ''; return; }
        searchCustomers(q).then(list => {
            renderSearchResults(list);
        }).catch(err => console.error(err));
    }, 200);
});

function renderSearchResults(list) {
    searchResults.innerHTML = '';
    if (!list || !list.length) {
        searchResults.classList.add('hidden');
        return;
    }
    list.forEach(c => {
        const d = document.createElement('div');
        d.className = 'item';
        d.innerHTML = `<strong>${c.name || '(no name)'}</strong> <div style="font-size:13px;color:#666">${c.phone || ''} • ${c.business || ''} • ${c.address || ''}</div>`;
        d.addEventListener('click', () => {
            customerName.value = c.name || '';
            phoneInput.value = c.phone || '';
            businessInput.value = c.business || '';
            addressInput.value = c.address || '';
            searchResults.classList.add('hidden');
            searchCustomer.value = '';
        });
        searchResults.appendChild(d);
    });
    searchResults.classList.remove('hidden');
}

/* ---------- entry saving ---------- */
entryForm.addEventListener('submit', (ev) => {
    ev.preventDefault();

    // phone required and must be 10 digits
    if (!phoneInput.value || phoneInput.value.length !== 10) {
        alert('Please enter a 10-digit phone number.');
        return;
    }

    const total = getTotal();
    const ptype = (paymentType.value || '').toLowerCase();
    let cash = 0, online = 0;
    if (ptype === 'cash') cash = Number(cashPaid.value) || 0;
    if (ptype === 'online') online = Number(onlinePaid.value) || 0;
    if (ptype === 'mixed') {
        cash = Number(cashPaid.value) || 0;
        online = Number(onlinePaid.value) || 0;
    }
    const paidAmount = cash + online;
    const remaining = Math.max(total - paidAmount, 0);

    const sale = {
        date: dateInput.value || (new Date()).toISOString().split('T')[0],
        name: customerName.value.trim(),
        phone: phoneInput.value.trim(),
        business: businessInput.value.trim(),
        address: addressInput.value.trim(),
        kgs: Number(kgsInput.value) || 0,
        price: Number(priceInput.value) || 0,
        total: total,
        paymentType: ptype === 'none' ? 'unspecified' : ptype,
        cash: cash,
        online: online,
        paidAmount: paidAmount,
        remaining: remaining,
        createdAt: Date.now(),
        synced: false
    };

    addSaleLocal(sale).then(() => {
        // store customer snapshot if phone given
        if (sale.phone && sale.phone.length === 10) {
            saveCustomer({ phone: sale.phone, name: sale.name, business: sale.business, address: sale.address }).catch(console.error);
        }
        alert('Saved locally');
        entryForm.reset();
        totalDisplay.innerText = 'Total: ₹0';
        updatePaymentVisibility();
        // sync queue (if logged-in and online)
        trySyncToCloud();
        showSection(homeSection);
        loadPending();
    }).catch(err => {
        console.error(err);
        alert('Failed to save locally: ' + err);
    });
});

/* ---------- group pending by customer for display ---------- */
function groupPendingByCustomer(sales) {
    const map = new Map();
    sales.forEach(s => {
        if (!s || !Number(s.remaining)) return;
        const key = s.phone ? s.phone : (s.name + '|' + (s.address || '')).slice(0, 200);
        if (!map.has(key)) map.set(key, { key, phone: s.phone || '', name: s.name || '', business: s.business || '', address: s.address || '', totalRemaining: 0, sales: [] });
        const item = map.get(key);
        item.totalRemaining += Number(s.remaining) || 0;
        item.sales.push(s);
    });
    return Array.from(map.values()).sort((a, b) => b.totalRemaining - a.totalRemaining);
}

/* ---------- total sold today (simple) ---------- */
function calcTodayKg(allSales) {
    const today = (new Date()).toISOString().split('T')[0];
    return (allSales || []).filter(s => s.date === today).reduce((a, s) => a + (Number(s.kgs) || 0), 0);
}

/* ---------- load pending (and show total today) ---------- */
function loadPending() {
    getAllSales().then(all => {
        // total KG sold today
        const totalTodayKg = calcTodayKg(all);
        pendingList.innerHTML = '';

        const totalDiv = document.createElement('div');
        totalDiv.className = 'pending-card';
        totalDiv.style.borderLeft = '6px solid #4caf50';
        totalDiv.innerHTML = `<div style="font-weight:700">Total sold today: ${totalTodayKg} KG</div>`;
        pendingList.appendChild(totalDiv);

        const pending = (all || []).filter(s => Number(s.remaining) > 0);
        if (!pending.length) {
            const p = document.createElement('div'); p.textContent = 'No Pending Payments 🎉'; p.style.marginTop = '8px';
            pendingList.appendChild(p);
            return;
        }
        const grouped = groupPendingByCustomer(pending);
        grouped.forEach(g => {
            const tpl = pendingTemplate.content.cloneNode(true);
            const card = tpl.querySelector('.pending-card');
            card.querySelector('.name').textContent = g.name || '(no name)';
            card.querySelector('.remaining').textContent = `Remaining ₹${g.totalRemaining}`;
            card.querySelector('.phone').textContent = g.phone || '—';
            card.querySelector('.business').textContent = g.business || '—';
            card.addEventListener('click', () => { showCustomerDetails(g); });
            pendingList.appendChild(card);
        });
    }).catch(err => console.error(err));
}

/* ---------- render customers list (history page) ---------- */
function renderCustomersList() {
    getAllCustomers().then(list => {
        customersList.innerHTML = '';
        if (!list.length) {
            customersList.textContent = 'No saved customers yet';
            return;
        }
        list.forEach(c => {
            const d = document.createElement('div');
            d.className = 'pending-card';
            d.innerHTML = `<div style="display:flex;justify-content:space-between"><div><b>${c.name || '(no name)'}</b><div style="font-size:13px;color:#666">${c.business || ''} • ${c.address || ''}</div></div><div style="text-align:right">${c.phone || ''}</div></div>`;
            d.addEventListener('click', () => {
                getAllSales().then(sales => {
                    const customerSales = sales.filter(s => s.phone === c.phone);
                    showCustomerDetails({ phone: c.phone, name: c.name, business: c.business, address: c.address, sales: customerSales });
                });
            });
            customersList.appendChild(d);
        });
    }).catch(err => console.error(err));
}

/* ---------- show customer details with history ---------- */
function showCustomerDetails(group) {
    const phone = group.phone || '';
    getAllSales().then(all => {
        let sales = [];
        if (phone) {
            sales = all.filter(s => s.phone === phone);
        } else {
            sales = all.filter(s => s.name === group.name && s.address === group.address);
        }
        sales.sort((a, b) => new Date(a.date) - new Date(b.date));
        customerDetails.innerHTML = '';
        customerDetails.classList.remove('hidden');

        const header = document.createElement('div');
        header.innerHTML = `<h3>${group.name || '(no name)'} • ${group.phone || ''}</h3><div style="color:#666;margin-bottom:8px">${group.business || ''} • ${group.address || ''}</div>`;
        customerDetails.appendChild(header);

        if (!sales.length) {
            const p = document.createElement('div'); p.textContent = 'No sales history for this customer.'; customerDetails.appendChild(p);
        } else {
            sales.forEach(s => {
                const rowTpl = saleRowTemplate.content.cloneNode(true);
                const saleRow = rowTpl.querySelector('.sale-row');
                saleRow.querySelector('.sdate').textContent = s.date;
                saleRow.querySelector('.skg').textContent = `${s.kgs} kg @ ₹${s.price}/kg`;
                saleRow.querySelector('.stotal').textContent = s.total;
                saleRow.querySelector('.spaid').textContent = `₹${s.paidAmount || 0}`;
                saleRow.querySelector('.srem').textContent = s.remaining || 0;

                const actions = saleRow.querySelector('.sale-actions');
                if (Number(s.remaining) > 0) {
                    const payBtn = document.createElement('button');
                    payBtn.className = 'small-btn';
                    payBtn.textContent = 'Add Payment';
                    payBtn.addEventListener('click', () => openPaymentModalForSale(s));
                    actions.appendChild(payBtn);
                } else {
                    const paidLabel = document.createElement('div');
                    paidLabel.style.color = '#2e7d32';
                    paidLabel.textContent = 'Fully Paid';
                    actions.appendChild(paidLabel);
                }

                const detBtn = document.createElement('button');
                detBtn.className = 'small-btn';
                detBtn.style.background = '#6a1b9a';
                detBtn.textContent = 'Details';
                detBtn.addEventListener('click', () => {
                    alert(`Date: ${s.date}\nKG: ${s.kgs}\nTotal: ₹${s.total}\nPaid: ₹${s.paidAmount}\nRemaining: ₹${s.remaining}\nPayment type: ${s.paymentType}`);
                });
                actions.appendChild(detBtn);

                customerDetails.appendChild(saleRow);
            });

            const totalRemaining = sales.reduce((acc, s) => acc + (Number(s.remaining) || 0), 0);
            const footer = document.createElement('div');
            footer.style.marginTop = '8px';
            footer.innerHTML = `<div style="font-weight:700">Total Remaining for this customer: ₹${totalRemaining}</div>`;
            if (totalRemaining > 0) {
                const collectBtn = document.createElement('button');
                collectBtn.className = 'small-btn';
                collectBtn.textContent = 'Record Payment (combined)';
                collectBtn.addEventListener('click', () => openCombinedPaymentModal(sales));
                footer.appendChild(collectBtn);
            }
            customerDetails.appendChild(footer);
        }

        showSection(historySection);
    }).catch(err => console.error(err));
}

/* ---------- Payment dialogs (prompt-based for now) ---------- */
function openPaymentModalForSale(sale) {
    const paidNowStr = prompt(`Enter amount collected now for sale on ${sale.date} (Remaining ₹${sale.remaining}).\nIf mixed, enter as cash+online (e.g. 300+200). Or just enter a single number as cash.`);
    if (!paidNowStr) return;

    let cashAdd = 0, onlineAdd = 0;
    if (paidNowStr.includes('+')) {
        const parts = paidNowStr.split('+').map(s => Number(s.trim()) || 0);
        cashAdd = parts[0] || 0;
        onlineAdd = parts[1] || 0;
    } else {
        cashAdd = Number(paidNowStr.trim()) || 0;
    }
    const totalAdd = cashAdd + onlineAdd;
    if (totalAdd <= 0) { alert('Invalid amount'); return; }
    sale.cash = (Number(sale.cash) || 0) + cashAdd;
    sale.online = (Number(sale.online) || 0) + onlineAdd;
    sale.paidAmount = (Number(sale.paidAmount) || 0) + totalAdd;
    sale.remaining = Math.max(Number(sale.total) - sale.paidAmount, 0);
    sale.synced = false;
    updateSaleLocal(sale).then(() => {
        alert('Payment recorded');
        loadPending();
        showCustomerDetails({ phone: sale.phone, name: sale.name, business: sale.business, address: sale.address });
        trySyncToCloud();
    });
}

function openCombinedPaymentModal(sales) {
    const amountStr = prompt(`Enter amount received now (will apply to oldest unpaid sales first). Total remaining: ₹${sales.reduce((a, s) => a + (s.remaining || 0), 0)}`);
    if (!amountStr) return;
    let amount = Number(amountStr.trim()) || 0;
    if (amount <= 0) { alert('Invalid'); return; }

    const unpaidSales = sales.filter(s => Number(s.remaining) > 0).sort((a, b) => new Date(a.date) - new Date(b.date));
    const updates = [];
    unpaidSales.forEach(s => {
        if (amount <= 0) return;
        const need = Number(s.remaining) || 0;
        const pay = Math.min(need, amount);
        const mode = prompt(`Applying ₹${pay} to sale on ${s.date}. Enter 'cash' or 'online' or 'mixed'. (leave blank => cash)`);
        if ((mode || '').toLowerCase() === 'online') {
            s.online = (Number(s.online) || 0) + pay;
        } else if ((mode || '').toLowerCase() === 'mixed') {
            const sub = prompt('Enter distribution as cash+online (e.g. 100+50)');
            if (sub && sub.includes('+')) {
                const [c, o] = sub.split('+').map(t => Number(t.trim()) || 0);
                s.cash = (Number(s.cash) || 0) + c;
                s.online = (Number(s.online) || 0) + o;
            } else {
                s.cash = (Number(s.cash) || 0) + pay;
            }
        } else {
            s.cash = (Number(s.cash) || 0) + pay;
        }
        s.paidAmount = (Number(s.paidAmount) || 0) + pay;
        s.remaining = Math.max(Number(s.total) - s.paidAmount, 0);
        s.synced = false;
        amount -= pay;
        updates.push(updateSaleLocal(s));
    });

    Promise.all(updates).then(() => {
        alert('Payments recorded');
        loadPending();
        renderCustomersList();
        trySyncToCloud();
    }).catch(err => { console.error(err); alert('Error saving payments'); });
}

/* ---------- Contact Picker: add a small "pick" button after phone input ---------- */
function createContactPickerButton() {
    try {
        // only create if phoneInput exists
        if (!phoneInput) return;
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = '6px';
        wrapper.style.alignItems = 'center';

        // replace phone input with wrapper that contains phone input and button
        const parent = phoneInput.parentElement;
        parent.insertBefore(wrapper, phoneInput);
        wrapper.appendChild(phoneInput);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'Pick from contacts';
        btn.innerText = '📇';
        btn.style.padding = '8px';
        btn.style.fontSize = '16px';
        btn.style.borderRadius = '8px';
        btn.addEventListener('click', async () => {
            if (!('contacts' in navigator && 'ContactsManager' in window)) {
                alert('Contact picker not available in this browser. Fill manually.');
                return;
            }
            try {
                const props = ['name', 'tel'];
                const opts = { multiple: false };
                const contacts = await navigator.contacts.select(props, opts);
                if (contacts.length) {
                    const c = contacts[0];
                    const name = (c.name && c.name[0]) || '';
                    const tel = (c.tel && c.tel[0]) || '';
                    customerName.value = name;
                    phoneInput.value = tel.replace(/\D/g, '').slice(0, 10);
                }
            } catch (err) {
                console.error('contact picker failed', err);
                alert('Failed to pick contact.');
            }
        });
        wrapper.appendChild(btn);
    } catch (err) {
        console.error('createContactPickerButton error', err);
    }
}
createContactPickerButton();

/* ---------- Cloud sync (Firebase) - optional, only if FIREBASE_CONFIG provided ---------- */
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let currentUser = null;

async function initFirebaseIfConfigured() {
    if (!FIREBASE_CONFIG) {
        console.log('Firebase config not provided - cloud sync disabled.');
        return;
    }
    try {
        // Firebase v9 compat is expected to be loaded via script tags in index.html
        if (typeof firebase === 'undefined' || !firebase.apps) {
            console.warn('Firebase scripts not loaded. Add Firebase SDK scripts to index.html.');
            return;
        }
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();

        // create a small sign-in UI button on top-right (if not already present)
        let signinBtn = document.getElementById('googleSignInBtn');
        if (!signinBtn) {
            signinBtn = document.createElement('button');
            signinBtn.id = 'googleSignInBtn';
            signinBtn.style.marginLeft = '8px';
            signinBtn.innerText = 'Sign in with Google';
            document.querySelector('header nav').appendChild(signinBtn);
        }
        signinBtn.addEventListener('click', async () => {
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                const res = await firebaseAuth.signInWithPopup(provider);
                currentUser = res.user;
                alert('Signed in as ' + currentUser.displayName);
                // start sync
                trySyncToCloud();
            } catch (err) {
                console.error('firebase signin error', err);
                alert('Sign-in failed: ' + err.message);
            }
        });

        firebaseAuth.onAuthStateChanged(user => {
            currentUser = user;
            if (user) {
                console.log('User signed in:', user.uid, user.email);
                trySyncToCloud();
            } else {
                console.log('No firebase user signed in');
            }
        });
    } catch (err) {
        console.error('initFirebaseIfConfigured error', err);
    }
}

/* ---------- sync local unsynced sales to Firestore (basic) ---------- */
async function trySyncToCloud() {
    if (!firebaseDb || !currentUser) return;
    try {
        const all = await getAllSales();
        const unsynced = (all || []).filter(s => !s.synced);
        if (!unsynced.length) return console.log('No unsynced records to push');
        for (const s of unsynced) {
            // push to Firestore under user collection
            const docRef = firebaseDb.collection('users').doc(currentUser.uid).collection('sales').doc(String(s.id));
            // map dates and fields safely
            const payload = Object.assign({}, s);
            // remove local-only flags if any
            payload.createdAt = s.createdAt || Date.now();
            await docRef.set(payload, { merge: true });
            // mark as synced locally
            s.synced = true;
            await updateSaleLocal(s);
        }
        console.log('Synced', unsynced.length, 'records to cloud');
    } catch (err) {
        console.error('trySyncToCloud error', err);
    }
}

/* ---------- initial boot ---------- */
function init() {
    openDB().then(() => {
        loadPending();
        // try to init firebase (no-op if config absent)
        initFirebaseIfConfigured();
    }).catch(err => console.error('DB open failed', err));
}

/* ---------- expose debug helpers ---------- */
window.__teaDB = { openDB, getAllSales, getAllCustomers, addSaleLocal, updateSaleLocal, saveCustomer, searchCustomers };

init();
