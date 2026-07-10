import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    set,
    get
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

/*
 * Thay toàn bộ thông tin bên dưới bằng firebaseConfig
 * được cung cấp trong Firebase Console.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCkJ2np88C-5Yk2zWhCAF0BLbFwQaea3Fs",
  authDomain: "finance-app-44f76.firebaseapp.com",
  databaseURL: "https://finance-app-44f76-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "finance-app-44f76",
  storageBucket: "finance-app-44f76.firebasestorage.app",
  messagingSenderId: "254216496996",
  appId: "1:254216496996:web:e4e27ac2971d776096fc71"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const database = getDatabase(firebaseApp);
const provider = new GoogleAuthProvider();

/**
 * Lấy người dùng hiện tại.
 * Nếu chưa đăng nhập, mở cửa sổ đăng nhập Google.
 */
async function getCurrentUser() {
    if (auth.currentUser) {
        return auth.currentUser;
    }

    const result = await signInWithPopup(auth, provider);
    return result.user;
}

window.firebaseCloud = {
    /**
     * Lưu toàn bộ dữ liệu tài chính của người dùng.
     */
    async save(data) {
        const user = await getCurrentUser();

        if (!user?.uid) {
            throw new Error("Không xác định được tài khoản Google.");
        }

        const dataPath = `users/${user.uid}/financeData`;

        await set(ref(database, dataPath), data);

        return {
            email: user.email,
            updatedAt: data.updatedAt
        };
    },

    /**
     * Tải dữ liệu tài chính của người dùng.
     */
    async load() {
        const user = await getCurrentUser();

        if (!user?.uid) {
            throw new Error("Không xác định được tài khoản Google.");
        }

        const dataPath = `users/${user.uid}/financeData`;
        const snapshot = await get(ref(database, dataPath));

        if (!snapshot.exists()) {
            return null;
        }

        return snapshot.val();
    },

    /**
     * Đăng xuất khỏi tài khoản Firebase.
     */
    async logout() {
        await signOut(auth);
    }
};