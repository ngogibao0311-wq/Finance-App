const DB_NAME = 'FinanceAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'appDataStore';
const STORAGE_FIELDS = {
    fm_transactions: 'transactions', fm_configs: 'configs',
    fm_forecasts: 'forecasts', fm_installments: 'installmentPlans',
    fm_statements: 'createdStatements', fm_loans: 'loans',
    fm_accounts: 'accounts', fm_cash_wallets: 'cashWallets', fm_wallets: 'wallets'
};

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => {
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

async function idbReadAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const values = {};
        for (const key of Object.keys(STORAGE_FIELDS)) {
            const request = tx.objectStore(STORE_NAME).get(key);
            request.onsuccess = () => { values[key] = request.result; };
        }
        tx.oncomplete = () => { db.close(); resolve(values); };
        tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('Không thể đọc dữ liệu.')); };
    });
}

async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(key);
        tx.oncomplete = () => { db.close(); resolve(request.result); };
        tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('Không thể đọc dữ liệu.')); };
    });
}

// Một snapshot được ghi trong một transaction, đóng kết nối cả khi abort.
async function idbWriteAll(values) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('Lưu dữ liệu bị hủy.')); };
        try {
            const store = tx.objectStore(STORE_NAME);
            for (const [key, value] of Object.entries(values)) store.put(value, key);
        } catch (error) { tx.abort(); db.close(); reject(error); }
    });
}

async function idbSet(key, value) { return idbWriteAll({ [key]: value }); }

app.storage = {
    idbGet,
    ready: false,
    queue: Promise.resolve(),
    lastSaveSucceeded: true,

    snapshot(data = app.data) {
        const values = {};
        for (const [key, field] of Object.entries(STORAGE_FIELDS)) {
            const fallback = ['configs', 'installmentPlans', 'createdStatements'].includes(field) ? {} : [];
            values[key] = data[field] ?? fallback;
        }
        return JSON.parse(JSON.stringify(values));
    },

    validate(values) {
        for (const [key, field] of Object.entries(STORAGE_FIELDS)) {
            const value = values[key];
            if (value === undefined) continue;
            const objectField = ['configs', 'installmentPlans', 'createdStatements'].includes(field);
            if (objectField ? !value || typeof value !== 'object' || Array.isArray(value) : !Array.isArray(value)) {
                throw new Error(`Dữ liệu ${field} không hợp lệ. Bản lưu cũ được giữ nguyên.`);
            }
        }
    },

    reportError(error) {
        console.error('Storage error:', error);
        let banner = document.getElementById('storage-error');
        if (!banner && document.body) {
            banner = document.createElement('div');
            banner.id = 'storage-error';
            banner.setAttribute('role', 'alert');
            banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#991b1b;color:white;padding:16px;text-align:center';
            document.body.appendChild(banner);
        }
        if (banner) banner.textContent = `Chưa lưu được dữ liệu: ${error.message}. Đừng đóng trang; hãy xuất bản sao Excel và thử lại.`;
    },

    async load() {
        this.ready = false;
        try {
            let values = await idbReadAll();
            if (localStorage.getItem('fm_idb_migrated') !== 'true') {
                const migrated = {};
                for (const key of Object.keys(STORAGE_FIELDS)) {
                    const legacy = localStorage.getItem(key);
                    if (values[key] === undefined && legacy && !['undefined', 'null'].includes(legacy)) {
                        migrated[key] = JSON.parse(legacy);
                        if (key === 'fm_configs') delete migrated[key].apiKeys;
                    }
                }
                this.validate(migrated);
                if (Object.keys(migrated).length) await idbWriteAll(migrated);
                values = { ...values, ...migrated };
                localStorage.setItem('fm_idb_migrated', 'true');
                for (const key of Object.keys(STORAGE_FIELDS)) localStorage.removeItem(key);
            }
            this.validate(values);
            for (const [key, field] of Object.entries(STORAGE_FIELDS)) {
                if (values[key] !== undefined) app.data[field] = field === 'configs' ? { ...app.data.configs, ...values[key] } : values[key];
            }
            app.data.transactions = app.data.transactions.map(t => ({ ...t, status: t.status || 'paid' }));
            if (app.data.configs.sidebarCollapsed) document.getElementById('sidebar')?.classList.add('collapsed');
            this.ready = true;
        } catch (error) {
            this.reportError(error);
            throw error;
        }
    },

    save() {
        if (!this.ready) return Promise.resolve(false);
        let snapshot;
        try { snapshot = this.snapshot(); this.validate(snapshot); }
        catch (error) { this.reportError(error); return Promise.resolve(false); }
        this.queue = this.queue.then(async () => {
            try {
                await idbWriteAll(snapshot);
                this.lastSaveSucceeded = true;
                document.getElementById('storage-error')?.remove();
                return true;
            } catch (error) {
                this.lastSaveSucceeded = false;
                this.reportError(error);
                return false;
            }
        });
        return this.queue;
    },

    async saveToCloud() {
        if (!this.ready) return alert('Dữ liệu chưa tải xong.');
        if (!window.firebaseCloud) return alert('Firebase chưa tải xong. Hãy tải lại trang rồi thử lại.');
        const configs = JSON.parse(JSON.stringify(app.data.configs || {}));
        delete configs.apiKeys;
        const fullData = {
            schemaVersion: 3,
            transactions: app.data.transactions, configs,
            forecasts: app.data.forecasts, installments: app.data.installmentPlans,
            statements: app.data.createdStatements, loans: app.data.loans,
            accounts: app.data.accounts, cashWallets: app.data.cashWallets,
            wallets: app.data.wallets, updatedAt: new Date().toISOString()
        };
        try {
            const result = await window.firebaseCloud.save(JSON.parse(JSON.stringify(fullData)));
            alert('✅ Đã sao lưu lên Firebase thành công!\nTài khoản: ' + (result.email || 'Google'));
        } catch (error) { alert('❌ Lỗi lưu Firebase: ' + error.message); }
    },

    async loadFromCloud() {
        if (!this.ready) return alert('Dữ liệu chưa tải xong.');
        if (!window.firebaseCloud) return alert('Firebase chưa tải xong. Hãy tải lại trang rồi thử lại.');
        try {
            const data = await window.firebaseCloud.load();
            if (!data) return alert('Chưa có dữ liệu trên Firebase.');
            // Realtime Database bỏ các mảng rỗng khỏi snapshot.
            const emptyTransactions = data.transactions == null &&
                Number.isFinite(Date.parse(data.updatedAt)) && data.configs && typeof data.configs === 'object';
            if (!Array.isArray(data.transactions) && !emptyTransactions) throw new Error('Bản Cloud không có danh sách giao dịch hợp lệ.');
            if (!confirm('Tải bản Cloud sẽ thay thế dữ liệu trên máy. Một bản phục hồi local sẽ được giữ lại. Tiếp tục?')) return;
            const next = {
                ...app.data, transactions: data.transactions || [],
                configs: { ...app.data.configs, ...(data.configs || {}), apiKeys: app.data.configs.apiKeys },
                forecasts: data.forecasts || [], installmentPlans: data.installments || {},
                createdStatements: data.statements || {}, loans: data.loans || [],
                accounts: data.accounts || [], cashWallets: data.cashWallets || [],
                wallets: data.wallets ?? (data.schemaVersion >= 3 ? [] : app.data.wallets)
            };
            const snapshot = this.snapshot(next);
            this.validate(snapshot);
            const before = this.snapshot();
            this.ready = false;
            try {
                await this.queue;
                await idbWriteAll({ ...snapshot, fm_before_cloud_restore: before });
                Object.assign(app.data, next);
            } finally { this.ready = true; }
            alert('✅ Đã tải và lưu dữ liệu từ Firebase. Trang sẽ tải lại.');
            location.reload();
        } catch (error) { alert('❌ Lỗi tải Firebase: ' + error.message); }
    },

    async reset() {
        this.ready = false;
        await this.queue;
        await new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
            request.onblocked = () => this.reportError(new Error('Hãy đóng các tab FinDash khác để hoàn tất reset'));
        });
        for (const key of Object.keys(localStorage)) if (key.startsWith('fm_')) localStorage.removeItem(key);
    }
};
