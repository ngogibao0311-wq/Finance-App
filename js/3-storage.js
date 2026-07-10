// Khởi tạo các hàm hỗ trợ IndexedDB cơ bản
const DB_NAME = 'FinanceAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'appDataStore';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbSet(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(value, key); // IndexedDB tự động lưu Object, không cần JSON.stringify
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

app.storage = {
    // Để gọi ở nơi khác nếu cần (ví dụ lúc khởi tạo app)
    idbGet: idbGet,

    // --- TẢI/LƯU LOCAL (Chuyển sang IndexedDB) ---
    async load() {
        try {
            // 🚀 BỔ SUNG: Luôn luôn dọn sạch cấu hình cũ (chứa Token) khỏi localStorage
            // Để tránh bị các web khác chạy chung tên miền quét trúng và làm lộ Token
            localStorage.removeItem('fm_configs');

            // 1. TỰ ĐỘNG MIGRATE DỮ LIỆU TỪ LOCALSTORAGE SANG INDEXEDDB (Chỉ chạy 1 lần)
            const isMigrated = localStorage.getItem('fm_idb_migrated');
            if (!isMigrated) {
                console.log("Đang chuyển đổi dữ liệu từ localStorage sang IndexedDB...");
                const keys = ['fm_transactions', 'fm_configs', 'fm_forecasts', 'fm_installments', 'fm_statements', 'fm_loans', 'fm_accounts', 'fm_cash_wallets'];

                for (let key of keys) {
                    const val = localStorage.getItem(key);
                    if (val && val !== "undefined" && val !== "null") {
                        await idbSet(key, JSON.parse(val));
                    }
                }
                // Đánh dấu đã chuyển đổi thành công
                localStorage.setItem('fm_idb_migrated', 'true');
            }

            // 2. TẢI DỮ LIỆU TỪ INDEXEDDB
            const savedTx = await idbGet('fm_transactions');
            if (savedTx && Array.isArray(savedTx)) {
                app.data.transactions = savedTx.map(t => ({ ...t, status: t.status || 'paid' }));
            } else {
                app.data.transactions = [
                    { id: 1, type: 'Thu nhập', amount: 15000000, place: 'Lương tháng', source: 'VCB', date: new Date().toISOString(), tags: '#luong', status: 'paid' },
                    { id: 2, type: 'Chi tiêu', amount: 50000, place: 'Ăn trưa', source: 'Tiền mặt', date: new Date().toISOString(), tags: '#an_uong', status: 'paid' },
                ];
            }

            const loadKey = async (key, dataPath, fallback = []) => {
                try {
                    const val = await idbGet(key);
                    if (val !== undefined) app.data[dataPath] = val;
                    else app.data[dataPath] = fallback;
                } catch (e) { app.data[dataPath] = fallback; }
            };

            await loadKey('fm_configs', 'configs', app.data.configs);
            await loadKey('fm_forecasts', 'forecasts');
            await loadKey('fm_installments', 'installmentPlans', {});
            await loadKey('fm_statements', 'createdStatements', {});
            await loadKey('fm_loans', 'loans');
            await loadKey('fm_accounts', 'accounts');
            await loadKey('fm_cash_wallets', 'cashWallets');

            // Apply UI states
            if (app.data.configs.sidebarCollapsed) {
                document.getElementById('sidebar')?.classList.add('collapsed');
            }
        } catch (e) { console.error("Error loading IDB transactions:", e); }
    },

    save() {
        // Hàm này không cần async/await để KHÔNG LÀM HỎNG logic ở file main.js
        // Nó sẽ tự động ghi đè xuống DB ngầm (Fire and Forget)
        const safeSave = (key, data) => {
            // Tạo bản copy sâu (deep clone) để tránh lỗi tham chiếu bộ nhớ khi IDB đang ghi
            if (data !== undefined) {
                const clone = JSON.parse(JSON.stringify(data));
                idbSet(key, clone).catch(e => console.error(`Save error [${key}]:`, e));
            }
        };

        safeSave('fm_transactions', app.data.transactions);
        safeSave('fm_configs', app.data.configs);
        safeSave('fm_forecasts', app.data.forecasts);
        safeSave('fm_installments', app.data.installmentPlans);
        safeSave('fm_statements', app.data.createdStatements);
        safeSave('fm_loans', app.data.loans);
        safeSave('fm_accounts', app.data.accounts);
        safeSave('fm_cash_wallets', app.data.cashWallets);
    },

    // --- CHỨC NĂNG CLOUD (SỬ DỤNG GITHUB GIST - GIỮ NGUYÊN) ---
    async saveToCloud() {
        if (!window.firebaseCloud) {
            alert("Firebase chưa tải xong. Hãy tải lại trang rồi thử lại.");
            return;
        }

        const cleanConfigs = JSON.parse(
            JSON.stringify(app.data.configs || {})
        );

        // Không đưa mật khẩu, token hoặc cấu hình bí mật lên Cloud.
        delete cleanConfigs.apiKeys;

        const fullData = {
            transactions: app.data.transactions || [],
            configs: cleanConfigs,
            forecasts: app.data.forecasts || [],
            installments: app.data.installmentPlans || {},
            statements: app.data.createdStatements || {},
            loans: app.data.loans || [],
            accounts: app.data.accounts || [],
            cashWallets: app.data.cashWallets || [],
            updatedAt: new Date().toISOString()
        };

        try {
            const result = await window.firebaseCloud.save(fullData);

            alert(
                "✅ Đã sao lưu lên Firebase thành công!\n" +
                "Tài khoản: " + (result.email || "Google")
            );
        } catch (error) {
            console.error("Firebase Save Error:", error);

            let message = error?.message || "Không thể lưu dữ liệu.";

            if (error?.code === "auth/popup-closed-by-user") {
                message = "Bạn đã đóng cửa sổ đăng nhập Google.";
            } else if (error?.code === "auth/popup-blocked") {
                message =
                    "Trình duyệt đã chặn cửa sổ đăng nhập. " +
                    "Hãy cho phép popup rồi thử lại.";
            } else if (error?.code === "PERMISSION_DENIED") {
                message =
                    "Firebase từ chối quyền truy cập. " +
                    "Hãy kiểm tra Database Rules.";
            }

            alert("❌ Lỗi lưu Firebase: " + message);
        }
    },

    async loadFromCloud() {
        if (!window.firebaseCloud) {
            alert("Firebase chưa tải xong. Hãy tải lại trang rồi thử lại.");
            return;
        }

        try {
            const data = await window.firebaseCloud.load();

            if (!data) {
                alert(
                    "Chưa có dữ liệu trên Firebase.\n" +
                    "Hãy bấm 'Lưu lên Cloud' trước."
                );
                return;
            }

            app.data.transactions = data.transactions || [];

            /*
             * Giữ lại cấu hình hiện có trên máy,
             * chỉ nhập các cấu hình không nhạy cảm từ Cloud.
             */
            const currentApiKeys =
                app.data.configs?.apiKeys || {};

            app.data.configs = {
                ...(app.data.configs || {}),
                ...(data.configs || {})
            };

            app.data.configs.apiKeys = currentApiKeys;

            app.data.forecasts = data.forecasts || [];
            app.data.installmentPlans = data.installments || {};
            app.data.createdStatements = data.statements || {};
            app.data.loans = data.loans || [];
            app.data.accounts = data.accounts || [];
            app.data.cashWallets = data.cashWallets || [];

            const saveTasks = [
                {
                    key: "fm_transactions",
                    data: app.data.transactions
                },
                {
                    key: "fm_configs",
                    data: app.data.configs
                },
                {
                    key: "fm_forecasts",
                    data: app.data.forecasts
                },
                {
                    key: "fm_installments",
                    data: app.data.installmentPlans
                },
                {
                    key: "fm_statements",
                    data: app.data.createdStatements
                },
                {
                    key: "fm_loans",
                    data: app.data.loans
                },
                {
                    key: "fm_accounts",
                    data: app.data.accounts
                },
                {
                    key: "fm_cash_wallets",
                    data: app.data.cashWallets
                }
            ];

            for (const task of saveTasks) {
                if (task.data !== undefined) {
                    const clone = JSON.parse(
                        JSON.stringify(task.data)
                    );

                    await idbSet(task.key, clone);
                }
            }

            alert(
                "✅ Đã tải dữ liệu từ Firebase thành công!\n" +
                "Trang sẽ được tải lại."
            );

            location.reload();
        } catch (error) {
            console.error("Firebase Load Error:", error);

            let message = error?.message || "Không thể tải dữ liệu.";

            if (error?.code === "auth/popup-closed-by-user") {
                message = "Bạn đã đóng cửa sổ đăng nhập Google.";
            } else if (error?.code === "auth/popup-blocked") {
                message =
                    "Trình duyệt đã chặn cửa sổ đăng nhập. " +
                    "Hãy cho phép popup rồi thử lại.";
            } else if (error?.code === "PERMISSION_DENIED") {
                message =
                    "Firebase từ chối quyền truy cập. " +
                    "Hãy kiểm tra Database Rules.";
            }

            alert("❌ Lỗi tải Firebase: " + message);
        }
    }
};