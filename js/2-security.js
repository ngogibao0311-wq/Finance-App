app.security = {
    pin: '',
    isEnabled: false,
    masterKey: '',

    init() {
        this.isEnabled = localStorage.getItem('fm_private_mode') === 'true';
        const savedHash = localStorage.getItem('fm_pin_hash');

        if (this.isEnabled && savedHash) {
            document.getElementById('security-overlay').classList.remove('hidden');
            // Animation xuất hiện
            setTimeout(() => {
                const icon = document.querySelector('.lock-icon-box');
                if (icon) icon.classList.remove('unlocked');
            }, 100);

            // Focus vào input ẩn để tif (is3DaysOld) {ện cho desktop keyboard (nếu có)
            const hidden = document.getElementById('auth-input-hidden');
            if (hidden) hidden.focus();
        } else {
            app.startSession();
        }
        this.updateUI();
    },

    updateUI() {
        const btn = document.getElementById('privateModeBtn');
        if (!btn) return;
        if (this.isEnabled) {
            btn.style.color = '#8b5cf6';
            btn.innerHTML = '<i class="fa-solid fa-lock"></i>';
        } else {
            btn.style.color = 'var(--text-muted)';
            btn.innerHTML = '<i class="fa-solid fa-lock-open"></i>';
        }
    },

    input(num) {
        if (this.pin.length < 4) {
            this.pin += num;

            // 1. Hiệu ứng bấm nút (Visual Feedback)
            const btns = document.querySelectorAll('.num-btn');
            // Tìm nút chứa số vừa bấm
            btns.forEach(btn => {
                if (btn.textContent.trim() === num.toString()) {
                    btn.classList.add('active-key');
                    setTimeout(() => btn.classList.remove('active-key'), 150);
                }
            });

            this.renderDots();

            // Tự động submit khi đủ 4 số
            if (this.pin.length === 4) {
                // Delay xíu để người dùng thấy chấm thứ 4 hiện lên đã
                setTimeout(() => this.submit(), 100);
            }
        }
    },

    clear() {
        this.pin = '';
        this.renderDots();
    },

    renderDots() {
        const dots = document.querySelectorAll('.pin-dot');
        const display = document.querySelector('.pin-display');

        if (display) display.classList.remove('error-shake'); // Xóa lỗi nếu có

        dots.forEach((dot, idx) => {
            if (idx < this.pin.length) dot.classList.add('filled');
            else dot.classList.remove('filled');
        });
    },

    submit() {
        const savedHash = localStorage.getItem('fm_pin_hash');
        const inputHash = CryptoJS.MD5(this.pin).toString();

        if (savedHash === inputHash) {
            // === MỞ KHÓA THÀNH CÔNG ===
            this.masterKey = this.pin;

            // 1. Chạy Animation mở khóa
            const iconBox = document.querySelector('.lock-icon-box');
            const iconI = iconBox.querySelector('i');

            // Đổi icon sang mở
            if (iconI) {
                iconI.className = 'fa-solid fa-lock-open';
            }
            // Thêm class để CSS kích hoạt animation càng khóa & đổi màu
            if (iconBox) {
                iconBox.classList.add('unlocked');
            }

            // 2. Chờ 600ms để animation chạy xong mới trượt màn hình lên
            setTimeout(() => {
                document.getElementById('security-overlay').classList.add('hidden');

                // Reset lại trạng thái icon sau khi ẩn (để lần sau hiện lại đẹp)
                setTimeout(() => {
                    this.pin = '';
                    this.renderDots();
                    if (iconI) iconI.className = 'fa-solid fa-lock'; // Reset về khóa đóng
                    // Class 'unlocked' sẽ được remove ở init() lần sau
                }, 500);

                app.startSession();
            }, 600); // Khớp với thời gian animation CSS

        } else {
            // === MỞ KHÓA THẤT BẠI ===

            // 1. Rung lắc
            const display = document.querySelector('.pin-display');
            if (display) {
                display.classList.remove('error-shake');
                void display.offsetWidth; // Trigger reflow
                display.classList.add('error-shake');
            }

            // 2. Clear PIN sau khi rung xong
            setTimeout(() => {
                this.pin = '';
                this.renderDots();
            }, 500);
        }
    },

    toggleSetup() {
        if (this.isEnabled) {
            app.ui.popup.confirm(
                "Tắt chế độ Private Mode?",
                () => {
                    this.isEnabled = false;
                    this.masterKey = '';
                    localStorage.setItem('fm_private_mode', 'false');
                    this.updateUI();
                    app.ui.popup.show("Đã tắt bảo mật.", "info");
                }
            );
        } else {
            app.ui.popup.prompt(
                "Thiết lập mã PIN (4 số):",
                (newPin) => {
                    if (newPin && newPin.length === 4 && !isNaN(newPin)) {
                        this.isEnabled = true;
                        this.masterKey = newPin;
                        localStorage.setItem('fm_private_mode', 'true');
                        localStorage.setItem('fm_pin_hash', CryptoJS.MD5(newPin).toString());
                        this.updateUI();
                        app.ui.popup.show("✅ Đã bật Private Mode.", "success");
                    } else {
                        app.ui.popup.show("❌ Mã PIN phải là 4 số.", "error");
                    }
                }
            );
        }
    },

    // Giữ nguyên logic encrypt/decrypt
    encrypt(dataObj) {
        if (!this.isEnabled || !this.masterKey) return JSON.stringify(dataObj);
        const jsonStr = JSON.stringify(dataObj);
        const encrypted = CryptoJS.AES.encrypt(jsonStr, this.masterKey).toString();
        return JSON.stringify({ isEncrypted: true, payload: encrypted, timestamp: Date.now() });
    },

    decrypt(cloudData) {
        if (!cloudData.isEncrypted) return cloudData;
        if (!this.masterKey) {
            const inputPin = prompt("🔒 Nhập PIN để giải mã:");
            if (!inputPin) return null;
            this.masterKey = inputPin;
        }
        try {
            const bytes = CryptoJS.AES.decrypt(cloudData.payload, this.masterKey);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (e) {
            app.ui.popup.show("❌ Sai mã PIN hoặc lỗi dữ liệu.", "error");
            return null;
        }
    }
};