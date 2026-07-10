// Gắn các hàm root level
app.startSession = async function () {
    console.log("🔓 Access Granted: Loading Data...");
    await this.storage.load();

    // Sắp xếp lại toàn bộ dữ liệu giao dịch cũ
    if (this.data && this.data.transactions) {
        this.data.transactions.sort((a, b) => {
            const dayA = new Date(a.date).toISOString().slice(0, 10);
            const dayB = new Date(b.date).toISOString().slice(0, 10);

            // Nếu khác ngày, sắp xếp theo ngày mới nhất
            if (dayA !== dayB) return new Date(b.date) - new Date(a.date);

            // Nếu cùng ngày, đưa giao dịch Không rõ giờ XUỐNG CUỐI
            if (a.isUnknownTime && !b.isUnknownTime) return 1;  // Trả về 1 để a đẩy xuống dưới
            if (!a.isUnknownTime && b.isUnknownTime) return -1; // Trả về -1 để b đẩy xuống dưới

            // Nếu cùng trạng thái, sắp xếp theo giờ mới nhất hoặc ID
            return new Date(b.date) - new Date(a.date) || b.id - a.id;
        });
    }

    //if (this.logic.purgeOldData) this.logic.purgeOldData();
    if (this.logic.fixAllTags) this.logic.fixAllTags();
    this.logic.checkAndRolloverZaloCycle();
    this.logic.processPriorityRefund();
    this.logic.updateFees();
    this.ui.renderAll();

    if (app.effects) {
        app.effects.init();
        setTimeout(() => app.effects.runNumberAnimations(), 100);
    }

    // --- [FIX] KHỞI ĐỘNG ĐỒNG HỒ (CẬP NHẬT LOGIC TÌM KIẾM THÔNG MINH) ---
    // --- [FIX] KHỞI ĐỘNG ĐỒNG HỒ AN TOÀN ---
    const updateClock = () => {
        try {
            const now = new Date();
            // Định dạng giờ:phút:giây
            const timeString = now.toLocaleTimeString('vi-VN', { hour12: false });

            // Tìm phần tử đồng hồ (ưu tiên ID 'clock')
            let el = document.getElementById('clock');

            // Nếu không thấy ID, tìm trong sidebar (thẻ span cạnh icon đồng hồ)
            if (!el) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    const icon = sidebar.querySelector('.fa-clock');
                    if (icon && icon.nextElementSibling) {
                        el = icon.nextElementSibling;
                    }
                }
            }

            // Chỉ cập nhật nếu tìm thấy phần tử
            if (el) {
                el.textContent = timeString;
                // Nếu muốn hiện ngày bên dưới (tuỳ chọn)
                // el.setAttribute('title', now.toLocaleDateString('vi-VN')); 
            }
        } catch (e) {
            console.warn("Lỗi đồng hồ (không ảnh hưởng app):", e);
        }
    };

    // Chạy đồng hồ mỗi giây
    setInterval(updateClock, 1000);
    updateClock(); // Chạy ngay lập tức
    // -------------------------------------------------
};
app.init = async function () {  // <-- Thêm async
    // Load config trước để biết trạng thái sidebar, v.v. (Từ IndexedDB)
    try {
        const savedConfig = await app.storage.idbGet('fm_configs');
        if (savedConfig) this.data.configs = { ...this.data.configs, ...savedConfig };
        if (this.data.configs.sidebarCollapsed) document.getElementById('sidebar').classList.add('collapsed');
    } catch (e) { }

    // Setup sự kiện
    this.events.setup();

    // Khởi động màn hình khóa (Nó sẽ tự gọi startSession nếu không khóa)
    this.security.init();

    // Setup giao diện cơ bản (lịch, v.v.)
    this.ui.init();
    const originalTxOpen = app.ui.modals.transaction.open;
    app.ui.modals.transaction.open = function (id) {
        originalTxOpen.call(this, id);

        if (id) {
            const tx = app.data.transactions.find(t => t.id === id);
            if (tx) {
                // 1. Phục hồi đúng giờ địa phương
                if (tx.date) {
                    const d = new Date(tx.date);
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    document.getElementById('tx-date').value = d.toISOString().slice(0, 16);
                }

                // 2. Phục hồi Giá gốc và trạng thái Hoàn tiền
                const discountAmt = tx.discountAmount || 0;

                // Phục hồi trạng thái tick của ô Hoàn tiền trước khi tính toán
                const txCashbackCheck = document.getElementById('tx-is-cashback');
                if (txCashbackCheck) {
                    txCashbackCheck.checked = tx.isCashback || false;
                    if (app.ui && app.ui.toggleCashbackMode) app.ui.toggleCashbackMode();
                }

                if (discountAmt > 0) {
                    // FIX: Nếu là hoàn tiền, giá gốc không đổi. Nếu là giảm giá, giá gốc = tiền thực trả + tiền giảm
                    const originalPrice = tx.isCashback ? tx.amount : (tx.amount + discountAmt);

                    // Điền lại giá gốc vào ô số tiền (có format dấu phẩy cho đẹp)
                    document.getElementById('tx-amount').value = new Intl.NumberFormat('vi-VN').format(originalPrice);

                    // Điền lại mức giảm giá vào ô Giảm giá
                    document.getElementById('tx-discount').value = tx.discountValue || discountAmt;

                    // Gọi hàm tính toán để hiển thị lại dòng gợi ý "Gốc - Giảm = Còn lại"
                    if (app.ui.calcDiscount) app.ui.calcDiscount();
                } else {
                    // Nếu không có giảm giá thì xóa trắng ô giảm giá đi cho sạch
                    document.getElementById('tx-discount').value = '';
                    if (document.getElementById('discount-hint')) document.getElementById('discount-hint').innerHTML = '';
                }
            }
        }

        // MỞ KHÓA RESET TOÀN BỘ Ô NHẬP LIỆU MỖI KHI MỞ FORM
        document.querySelectorAll('#form-tx input, #form-tx select, #form-tx textarea').forEach(el => {
            el.disabled = false; el.style.opacity = '1';
        });

        // FIX: Chỉ ép reset ô Hoàn tiền nếu là tạo Giao dịch MỚI
        if (!id) {
            const txCashbackCheck = document.getElementById('tx-is-cashback');
            if (txCashbackCheck) {
                txCashbackCheck.checked = false;
                if (app.ui && app.ui.toggleCashbackMode) app.ui.toggleCashbackMode();
            }
        }

        const txSource = document.getElementById('tx-source');
        const txDest = document.getElementById('tx-destination');
        const txBrand = document.getElementById('tx-brand');

        const txRef = document.getElementById('tx-ref');
        const txOrderCode = document.getElementById('tx-order-code');
        const lockFlagRef = document.getElementById('tx-fully-locked-flag');
        const lockFlagOrder = document.getElementById('tx-order-fully-locked-flag');
        const txSubmitBtn = document.querySelector('#form-tx button[type="submit"]');

        const bankWalletKeywords = ['shopeepay', 'bank', 'vcb', 'vietcombank', 'mb', 'mbbank', 'tpbank', 'tpb', 'bidv', 'agribank', 'vietinbank', 'ctg', 'acb', 'vpbank', 'techcombank', 'tcb', 'vib', 'sacombank', 'stb', 'shb', 'hdbank', 'scb', 'ocb', 'msb', 'nam a', 'seabank', 'abbank', 'oceanbank', 'momo', 'zalo', 'zalopay', 'viettel', 'vnpay', 'ví', 'tín dụng', 'credit'];
        const ecomKeywords = ['Go', 'sen do', 'sen đỏ', 'sendo', 'shopee', 'lazada', 'tiki', 'tiktok', 'shein', 'taobao', 'amazon', 'aliexpress', 'sendo', 'sen đỏ', 'foody', 'grab', 'Grabfood', 'Befood', 'Be', 'Be food', 'shopeefood'];
        const hybridKeywords = ['bhx', 'BHX', 'bách hóa xanh', 'bach hoa xanh', 'coop', 'co-op', 'winmart', 'vinmart', 'go', 'Go', 'cellphone', 'tgdd', 'thế giới di động', 'fpt', 'điện máy xanh', 'dmx', 'hasaki', 'guardian', 'pharmacity', 'long châu', 'phúc long', 'highland'];

        const currentSourceVal = txSource ? txSource.value.toLowerCase() : '';
        const currentDestBrandVal = ((txDest ? txDest.value : '') + ' ' + (txBrand ? txBrand.value : '')).toLowerCase();

        const isRefDetectedInit = bankWalletKeywords.some(k => currentSourceVal.includes(k));
        const isOrderDetectedInit = ecomKeywords.some(k => currentDestBrandVal.includes(k));

        let is3DaysOld = false;
        let txData = null;
        if (id) {
            txData = app.data.transactions.find(t => t.id === id);
            if (txData && txData.id) {
                // Xác định số ngày khóa: Hoàn tiền là 1 ngày, bình thường là 3 ngày
                const isCashback = txData.tags && txData.tags.includes('#hoan_tien');
                const lockDays = isCashback ? 1 : 3;

                if ((Date.now() - txData.id) / (1000 * 3600 * 24) > lockDays) is3DaysOld = true;
            }
        }

        if (id && txData && txData.type === 'Chuyển tiền') {
            const txTypeEl = document.getElementById('tx-type');
            if (txTypeEl) {
                txTypeEl.disabled = true;
                txTypeEl.style.opacity = '0.6';
                txTypeEl.setAttribute('title', 'Giao dịch chuyển tiền không thể đổi sang loại khác.');
            }
        }

        // --- [THÊM MỚI] LOGIC HIỂN THỊ DÒNG CHỮ ĐỎ (STATUS) ---
        const unknownStatus = document.getElementById('tx-unknown-status');
        if (unknownStatus) {
            // Hiện chữ đỏ nếu giao dịch cũ đã lưu là "Không rõ giờ"
            unknownStatus.style.display = (txData && txData.isUnknownTime) ? 'inline' : 'none';
        }

        const unknownCheckbox = document.getElementById('tx-is-unknown-time');
        if (unknownCheckbox) {
            // Khi người dùng tích/bỏ tích, chữ đỏ sẽ hiện/ẩn theo ngay lập tức
            unknownCheckbox.onchange = (e) => {
                if (unknownStatus) unknownStatus.style.display = e.target.checked ? 'inline' : 'none';
            };
        }
        // ------------------------------------------------------

        // ==========================================
        // ĐẾM NGƯỢC 2 NGÀY ĐỂ ẨN CHECKBOX "KHÔNG RÕ GIỜ"
        // ==========================================
        if (app.ui.unknownTimeInterval) clearInterval(app.ui.unknownTimeInterval);
        const unknownWrapper = document.getElementById('tx-unknown-time-wrapper');
        const countdownEl = document.getElementById('tx-unknown-time-countdown');

        if (unknownWrapper) {
            unknownWrapper.style.display = 'flex'; // Mặc định hiển thị khi mở form
            if (countdownEl) countdownEl.innerText = '';

            if (id && txData && txData.id) {
                const isCashback = txData.tags && txData.tags.includes('#hoan_tien');
                const lockDays = isCashback ? 1 : 3;

                const timeSinceCreation = Date.now() - txData.id;
                const lockDurationMs = lockDays * 24 * 60 * 60 * 1000;
                const hideDurationMs = (lockDays + 2) * 24 * 60 * 60 * 1000;

                if (timeSinceCreation >= hideDurationMs) {
                    // Đã quá hạn -> Ẩn hoàn toàn đi
                    unknownWrapper.style.display = 'none';
                } else if (timeSinceCreation >= lockDurationMs) {
                    // Đã bị khóa -> Bắt đầu đếm ngược 48 tiếng để ẩn
                    const updateCountdown = () => {
                        const modal = document.getElementById('modal-tx');
                        if (!modal || !modal.classList.contains('active')) {
                            clearInterval(app.ui.unknownTimeInterval);
                            return;
                        }

                        const timeLeft = hideDurationMs - (Date.now() - txData.id);
                        if (timeLeft <= 0) {
                            unknownWrapper.style.display = 'none';
                            clearInterval(app.ui.unknownTimeInterval);
                            return;
                        }

                        const h = Math.floor(timeLeft / (1000 * 60 * 60));
                        const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                        const s = Math.floor((timeLeft % (1000 * 60)) / 1000);

                        if (countdownEl) countdownEl.innerText = `(Ẩn sau: ${h}h ${m}p ${s}s)`;
                    };

                    updateCountdown();
                    app.ui.unknownTimeInterval = setInterval(updateCountdown, 1000);
                }
            }
        }
        // ==========================================

        const setupField = (dataVal, elInput, elOriginal, elContainer, elBadge, isDetected) => {
            elInput.value = dataVal || '';
            document.getElementById(elOriginal).value = dataVal || '';
            document.getElementById(elContainer).style.display = dataVal ? 'block' : (isDetected ? 'block' : 'none');
            document.getElementById(elBadge).style.display = dataVal ? 'none' : (isDetected ? 'inline-block' : 'none');
        };

        setupField(txData?.refId, txRef, 'tx-original-ref', 'tx-ref-container', 'tx-ref-badge', isRefDetectedInit);
        setupField(txData?.orderCode, txOrderCode, 'tx-original-order-code', 'tx-order-code-container', 'tx-order-badge', isOrderDetectedInit);
        if (lockFlagRef) lockFlagRef.value = txData?.isRefFullyLocked ? 'true' : 'false';
        if (lockFlagOrder) lockFlagOrder.value = txData?.isOrderCodeFullyLocked ? 'true' : 'false';

        // ==========================================
        // QUẢN LÝ QUYỀN TRUY CẬP QUÁ 3 NGÀY
        // ==========================================
        if (document.getElementById('tx-ref-error')) document.getElementById('tx-ref-error').style.display = 'none';
        if (document.getElementById('tx-order-error')) document.getElementById('tx-order-error').style.display = 'none';

        const isNotLockedStatus = (txData?.status === 'planned') || (txData?.type === 'Thu nhập' && txData?.status === 'pending');

        if (is3DaysOld && !isNotLockedStatus) {
            let isRefLocked = (txData && txData.isRefFullyLocked);
            let isOrderLocked = (txData && txData.isOrderCodeFullyLocked); // Kiểm tra cờ khóa mã đơn hàng

            // Xử lý khóa Mã Giao Dịch
            if (isRefLocked && txRef) {
                txRef.disabled = true; txRef.style.opacity = '0.6';
                document.getElementById('tx-ref-error').style.display = 'block';
                document.getElementById('tx-ref-error').innerHTML = '<i class="fa-solid fa-lock"></i> Mã GD khóa vĩnh viễn.';
            }

            // Xử lý khóa Mã Đơn Hàng
            if (isOrderLocked && txOrderCode) {
                txOrderCode.disabled = true; txOrderCode.style.opacity = '0.6';
                document.getElementById('tx-order-error').style.display = 'block';
                document.getElementById('tx-order-error').innerHTML = '<i class="fa-solid fa-lock"></i> Mã Đơn khóa vĩnh viễn.';
            }

            // Quản lý hiển thị nút Lưu
            if (txSubmitBtn) {
                if (isRefLocked && isOrderLocked) {
                    txSubmitBtn.style.display = 'none'; // Khóa cả 2 thì ẩn nút
                } else {
                    txSubmitBtn.style.display = 'block';
                    txSubmitBtn.disabled = false;
                    txSubmitBtn.style.opacity = '1';
                    txSubmitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Cập nhật Mã Bổ Sung';
                }
            }

            // Khóa các trường thông tin khác (Tự động khóa Nguồn tiền/Chuyển tới sau 1 ngày nếu là hoàn tiền)
            const isCashbackTx = txData && txData.tags && txData.tags.includes('#hoan_tien');
            const excludedFields = isCashbackTx
                ? ['tx-ref', 'tx-order-code', 'tx-brand']
                : ['tx-ref', 'tx-order-code', 'tx-source', 'tx-destination', 'tx-brand'];

            document.querySelectorAll('#form-tx input, #form-tx select, #form-tx textarea').forEach(el => {
                if (!excludedFields.includes(el.id) && el.type !== 'hidden') {
                    el.disabled = true; el.style.opacity = '0.6';
                }
            });
        }

        // ==========================================
        // [MỚI CẬP NHẬT] KHÓA GIAO DỊCH HOÀN TIỀN TỰ ĐỘNG
        // ==========================================
        const lockedMsg = document.getElementById('tx-locked-msg');
        if (lockedMsg) {
            lockedMsg.style.display = 'none';
        }

        if (id && txData && txData.tags && txData.tags.includes('#hoan_tien')) {
            // Đã loại bỏ 'tx-source' và 'tx-destination' để mở khóa cho điền dữ liệu
            const lockedFields = [
                'tx-discount',
                'tx-is-cashback',
                'tx-type',
                'tx-status',
                'tx-date',
                'tx-is-unknown-time'
            ];

            // Chỉ vô hiệu hóa các ô còn lại trong danh sách
            lockedFields.forEach(fieldId => {
                const el = document.getElementById(fieldId);
                if (el) {
                    el.disabled = true;
                    el.style.opacity = '0.6';
                }
            });

            // Hiển thị thông báo trạng thái giao dịch tự động
            if (lockedMsg) {
                lockedMsg.style.display = 'flex';
                lockedMsg.innerHTML = '<i class="fa-solid fa-link"></i> Giao dịch Hoàn tiền (Hạn chế sửa)';
                lockedMsg.style.background = '#e0f2fe';
                lockedMsg.style.color = '#0284c7';
                lockedMsg.style.border = '1px solid #bae6fd';
            }
        }
        // ==========================================
        // ==========================================
        // SỰ KIỆN QUÉT CHỮ TRỰC TIẾP
        // ==========================================
        // Tìm đến đoạn checkEcomLogic trong 6-main.js
        const checkEcomLogic = () => {
            // Lấy giá trị của cả 2 ô, đề phòng người dùng nhập vào ô nào cũng nhận
            const placeEl = document.getElementById('tx-place');
            const brandEl = document.getElementById('tx-brand');

            const placeText = placeEl ? placeEl.value.trim().toLowerCase() : '';
            const brandText = brandEl ? brandEl.value.trim().toLowerCase() : '';

            // Gộp text của cả 2 ô lại thành 1 chuỗi dài để quét từ khóa cho tiện
            const combinedText = `${placeText} ${brandText}`;

            const ecomKeywords = ['shopee', 'lazada', 'tiki', 'tiktok', 'shein', 'taobao', 'amazon', 'aliexpress', 'sendo', 'foody', 'grabfood', 'be food', 'befood', 'shopeefood'];

            // Quét trên chuỗi đã gộp
            const isEcom = ecomKeywords.some(keyword => combinedText.includes(keyword));

            if (isEcom) {
                // Hiện ô tx-order-code
                document.getElementById('tx-order-code-container').style.display = 'block';
            } else {
                // Ẩn ô tx-order-code
                document.getElementById('tx-order-code-container').style.display = 'none';
            }
        };

        if (txDest) { const c = txDest.cloneNode(true); txDest.parentNode.replaceChild(c, txDest); c.addEventListener('input', checkEcomLogic); }
        if (txBrand) { const c = txBrand.cloneNode(true); txBrand.parentNode.replaceChild(c, txBrand); c.addEventListener('input', checkEcomLogic); }
        if (txSource) {
            const c = txSource.cloneNode(true); txSource.parentNode.replaceChild(c, txSource);
            c.addEventListener('input', (e) => {
                if (bankWalletKeywords.some(k => e.target.value.toLowerCase().includes(k))) {
                    document.getElementById('tx-ref-container').style.display = 'block';
                    document.getElementById('tx-ref-badge').style.display = 'inline-block';
                } else if (!txRef.value.trim() && !document.getElementById('tx-original-ref').value.trim()) {
                    document.getElementById('tx-ref-container').style.display = 'none';
                }
            });
        }
    };
};

app.events = {
    setup() {
        // 1. Logic cũ: Đóng menu khi bấm vào một mục bên trong sidebar
        document.querySelectorAll('#sidebar .menu-item, #btn-reset-data').forEach(el => {
            el.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                // Kiểm tra: Nếu là màn hình nhỏ VÀ Sidebar đang mở (active) -> Thì đóng lại
                if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
                    app.ui.toggleMobileMenu();
                }
            });
        });

        // 2. Logic cũ: Nút thu gọn sidebar trên Desktop
        document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('collapsed');
            app.data.configs.sidebarCollapsed = sidebar.classList.contains('collapsed');
            app.storage.save();
        });

        // 3. [THÊM MỚI] Logic đóng menu khi chạm ra ngoài vùng menu (Mobile)
        document.addEventListener('click', (event) => {
            const sidebar = document.getElementById('sidebar');
            const menuToggle = document.querySelector('.mobile-menu-toggle');

            // Chỉ chạy khi ở giao diện Mobile và menu đang mở
            if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
                // Nếu điểm chạm KHÔNG nằm trong sidebar VÀ KHÔNG nằm trong nút mở menu
                if (!sidebar.contains(event.target) && menuToggle && !menuToggle.contains(event.target)) {
                    app.ui.toggleMobileMenu(); // Gọi lại hàm toggle của bạn để đóng
                }
            }
        });

        // 4. Logic cũ: Đóng Modal
        document.querySelectorAll('.close-modal').forEach(b => {
            b.onclick = function () {
                this.closest('.modal-overlay').classList.remove('active');
                if (this.closest('#modal-tx') && app.ui.transactionModalInterval) {
                    clearInterval(app.ui.transactionModalInterval);
                    app.ui.transactionModalInterval = null;
                }
            };
        });

        const removeAccents = (str) => {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
        };

        document.getElementById('search-input').addEventListener('input', (e) => {
            const keyword = e.target.value.trim();
            if (!keyword) {
                app.ui.renderAll();
                return;
            }
            const normalizeKey = removeAccents(keyword);
            const results = app.data.transactions.filter(t => {
                // Bổ sung refId và orderCode vào chuỗi nội dung để tìm kiếm
                const content = `${t.place} ${t.source} ${t.amount} ${t.tags || ''} ${t.note || ''} ${t.refId || ''} ${t.orderCode || ''}`;
                return removeAccents(content).includes(normalizeKey);
            });

            document.getElementById('periodDisplay').innerHTML = `<span style="color:var(--primary)">Tìm thấy: ${results.length} giao dịch</span>`;
            document.querySelector('.page-subtitle').textContent = `Kết quả tìm kiếm cho: "${keyword}"`;

            const tbody = document.getElementById('tx-table-body');
            if (results.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted)">Không tìm thấy giao dịch nào khớp lệnh!</td></tr>`;
            } else {
                tbody.innerHTML = results.sort((a, b) => {
                    const dayA = new Date(a.date).toISOString().slice(0, 10);
                    const dayB = new Date(b.date).toISOString().slice(0, 10);
                    if (dayA !== dayB) return new Date(b.date) - new Date(a.date);
                    if (a.isUnknownTime && !b.isUnknownTime) return -1;
                    if (!a.isUnknownTime && b.isUnknownTime) return 1;
                    return b.id - a.id;
                }).map(t => {
                    const isInc = t.type === 'Thu nhập';
                    const isCancelled = t.status === 'cancelled';
                    let statusText = isCancelled ? 'Đã hủy' : (t.status === 'paid' ? 'Thành công' : (t.status === 'planned' ? 'Dự kiến' : 'Chưa trả'));
                    let badgeClass = isCancelled ? 'badge-secondary' : (t.status === 'paid' ? 'badge-success' : 'badge-warning');
                    const amountClass = isInc ? 'var(--success)' : (isCancelled ? 'var(--text-muted)' : 'inherit');
                    const rowClass = isCancelled ? 'tx-cancelled' : '';
                    const amountPrefix = isInc ? '+' : '-';

                    return `<tr class="${rowClass}" onclick="if(!event.target.closest('button')) app.ui.modals.transaction.open(${t.id})" style="cursor:pointer">
                <td style="color:var(--text-muted)">${new Date(t.date).toLocaleDateString('vi-VN')}</td>
                <td>
                    <div style="font-weight:600">${t.place}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted)">${t.tags || ''}</div>
                </td>
                <td>${t.source}</td>
                <td style="font-family:var(--font-mono); font-weight:700; color: ${amountClass}">
                    ${amountPrefix}${app.logic.formatCurrency(t.amount)}
                </td>
                <td><span class="badge ${badgeClass}">${statusText}</span></td>
                <td style="text-align:right">
                    <button class="btn-ghost btn-sm" onclick="app.ui.modals.transaction.open(${t.id})"><i class="fa-solid fa-pen"></i></button>
                </td>
            </tr>`;
                }).join('');
            }
        });

        document.getElementById('btn-save-manual-zalo').onclick = () => {
            const count = app.data.configs.zaloManualCount || 0;

            // 1. Kiểm tra giới hạn (Thay alert bằng popup warning)
            if (count >= 100) {
                return app.ui.popup.show("Bạn đã hết lượt chỉnh sửa thủ công!", "warning");
            }

            const rank = document.getElementById('manual-rank-select').value;
            const amountStr = document.getElementById('manual-amount-input').value;

            // Logic tính toán Offset (Giữ nguyên)
            if (!amountStr) {
                // Nếu xóa trắng ô nhập -> Reset về tính tự động
                app.data.configs.manualZaloOffset = 0;
                app.data.configs.manualZaloAmount = null;
            } else {
                const targetAmount = Number(amountStr.replace(/[^0-9]/g, '')); // Lọc lấy số

                // TÍNH LẠI TỔNG THỰC TẾ HIỆN TẠI (để tìm chênh lệch)
                const currentReal = app.logic.getZaloAccumulation(true);

                // Tính độ lệch: Offset = Số mong muốn - Số thực tế
                const offset = targetAmount - currentReal;

                // Lưu độ lệch này lại
                app.data.configs.manualZaloOffset = offset;
                app.data.configs.manualZaloAmount = targetAmount;
            }

            app.data.configs.manualZaloRank = rank || null;
            app.data.configs.zaloManualCount = count + 1;

            // Lưu và Render lại
            app.storage.save();
            app.logic.updateFees();
            app.ui.renderAll();
            app.ui.renderZaloWidget();

            // Mở lại modal để thấy thay đổi (nếu cần)
            // app.ui.modals.zalo.open(); 

            // 2. Thông báo thành công (Thay alert bằng popup success)
            app.ui.popup.show("✨ Đã áp dụng phép màu!<br>Hạng và Số tiền tích lũy đã được cập nhật.", "success");
        };

        document.getElementById('form-tx').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('tx-id').value;

            // --- 👇 BỔ SUNG DÒNG NÀY VÀO ĐÂY 👇 ---
            const destinationVal = document.getElementById('tx-destination') ? document.getElementById('tx-destination').value : '';
            // ----------------------------------------

            const sourceVal = document.getElementById('tx-source').value;

            // --- [MỚI] KIỂM TRA NGÂN HÀNG BỊ KHÓA ---
            let isBlocked = false;
            let blockedBankName = "";

            if (app.data.accounts) {
                const lowerSource = sourceVal.toLowerCase().trim();
                const lowerDest = destinationVal.toLowerCase().trim();

                for (const account of app.data.accounts) {
                    if (account.isLocked) {
                        const lowerBank = account.bankName.toLowerCase().trim();
                        if (lowerSource === lowerBank || lowerDest === lowerBank) {
                            isBlocked = true;
                            blockedBankName = account.bankName;
                            break;
                        }
                    }
                }
            }

            if (isBlocked) {
                return app.ui.popup.show(`⛔ LỖI: Không thể thao tác với ngân hàng <b>${blockedBankName}</b> vì thẻ này đã bị khóa. Vui lòng mở khóa thẻ trước!`, "error");
            }

            const originalAmount = Number(document.getElementById('tx-amount').value.replace(/[^0-9]/g, ''));
            const discountRaw = document.getElementById('tx-discount').value.replace(/[^0-9]/g, '');
            const discountInput = Number(discountRaw) || 0;

            let finalAmount = originalAmount;
            let discountMoney = 0;
            let actualDiscountToSave = 0;

            // KIỂM TRA XEM CÓ ĐANG TICK "HOÀN TIỀN" KHÔNG
            const isCashback = document.getElementById('tx-is-cashback') ? document.getElementById('tx-is-cashback').checked : false;

            if (discountInput > 0) {
                if (discountInput <= 100) {
                    discountMoney = Math.round(originalAmount * (discountInput / 100));
                } else {
                    discountMoney = discountInput;
                }

                // Nếu KHÔNG PHẢI hoàn tiền thì mới trừ vào giá trị thực tế của Giao dịch chính
                if (!isCashback) {
                    finalAmount = originalAmount - discountMoney;
                    actualDiscountToSave = discountMoney;
                }
            }

            const isUnknownTime = document.getElementById('tx-is-unknown-time') ? document.getElementById('tx-is-unknown-time').checked : false;
            let finalDateStr = document.getElementById('tx-date').value;

            if (isUnknownTime) {
                const datePart = finalDateStr.split('T')[0];
                finalDateStr = `${datePart}T12:00:00`; // Đổi thành 12h trưa để fix lỗi lùi ngày (Timezone UTC)
            }

            let finalDateISO = finalDateStr;

            try {
                // Đóng gói lại thành chuẩn quốc tế (UTC) để lưu
                finalDateISO = new Date(finalDateStr).toISOString();
            } catch (e) { }

            // Nếu đang sửa và người dùng không đổi giờ phút, thì GIỮ NGUYÊN chuỗi gốc để không mất số giây
            if (id) {
                const originalTx = app.data.transactions.find(t => t.id == id);
                if (originalTx && originalTx.date) {
                    const origDateObj = new Date(originalTx.date);
                    origDateObj.setMinutes(origDateObj.getMinutes() - origDateObj.getTimezoneOffset());
                    const origLocalStr = origDateObj.toISOString().slice(0, 16);

                    if (finalDateStr === origLocalStr) {
                        finalDateISO = originalTx.date;
                    }
                }
            } else if (!finalDateStr.includes('Z')) {
                // Thêm mới hoàn toàn
                finalDateISO = new Date(finalDateStr).toISOString();
            }

            const data = {
                id: id ? Number(id) : Date.now(),
                type: document.getElementById('tx-type').value,
                status: document.getElementById('tx-status').value,

                amount: finalAmount,
                discountAmount: discountMoney,
                discountValue: discountInput > 0 ? discountInput : null,

                place: document.getElementById('tx-place').value,
                brand: document.getElementById('tx-brand').value,
                source: document.getElementById('tx-source').value,
                destination: document.getElementById('tx-destination') ? document.getElementById('tx-destination').value : '',
                refId: document.getElementById('tx-ref') ? document.getElementById('tx-ref').value.trim() : '',
                isRefFullyLocked: document.getElementById('tx-fully-locked-flag') ? (document.getElementById('tx-fully-locked-flag').value === 'true') : false,
                orderCode: document.getElementById('tx-order-code') ? document.getElementById('tx-order-code').value.trim() : '',
                isOrderCodeFullyLocked: document.getElementById('tx-order-fully-locked-flag') ? (document.getElementById('tx-order-fully-locked-flag').value === 'true') : false,

                // [ĐÃ SỬA] Gán biến ngày giờ an toàn vừa tính toán vào đây
                date: finalDateISO,
                isUnknownTime: isUnknownTime,

                tags: document.getElementById('tx-tags').value,
                isTet: document.getElementById('tx-is-tet').checked,
                is83: document.getElementById('tx-is-83') ? document.getElementById('tx-is-83').checked : false,
                is304: document.getElementById('tx-is-304') ? document.getElementById('tx-is-304').checked : false,

                // 👇 THÊM DÒNG NÀY ĐỂ DATABASE NHỚ ĐÂY LÀ HOÀN TIỀN
                isCashback: isCashback
            };

            // Hiển thị thông báo nhỏ nếu có giảm giá hoặc hoàn tiền để người dùng biết
            if (discountMoney > 0) {
                if (isCashback) {
                    // Popup riêng biệt dành cho Hoàn tiền
                    app.ui.popup.show(`🎉 Đã lưu giao dịch!<br>💸 Hệ thống tự động ghi nhận khoản hoàn tiền: <b>+${new Intl.NumberFormat('vi-VN').format(discountMoney)} đ</b>`, "success");
                } else {
                    // Popup mặc định của Giảm giá
                    app.ui.popup.show(`Đã lưu: <b>${app.logic.formatCurrency(finalAmount)}</b><br>(Gốc: ${app.logic.formatCurrency(originalAmount)} - Giảm: ${app.logic.formatCurrency(discountMoney)})`, "success");
                }
            } else {
                // (Tùy chọn) Nếu bạn muốn có thông báo cho các giao dịch bình thường không giảm/hoàn
                // app.ui.popup.show("✅ Đã lưu giao dịch thành công!", "success");
            }
            const currentMonthLimit = app.data.filter.month;
            const limit = Number(app.data.configs.monthlyLimits?.[currentMonthLimit]) || 0;
            const currentMonth = app.data.filter.month;

            if (data.type === 'Chi tiêu' && limit > 0 && data.status !== 'cancelled' && data.date.startsWith(currentMonth)) {
                const currentBudgetTxs = app.logic.getBudgetTransactions();
                const currentSpent = currentBudgetTxs
                    .filter(t => t.id != data.id)
                    .reduce((sum, t) => sum + t.amount, 0);
                const upcomingData = app.logic.getUpcomingDebts();
                const projectedDebt = upcomingData.total;
                const newTotalUsed = currentSpent + projectedDebt + data.amount;
                const remainingAfter = limit - newTotalUsed;

                if (remainingAfter < 0) {
                    const over = Math.abs(remainingAfter);
                    const confirmOver = confirm(
                        `🚨 CẢNH BÁO CHÁY TÚI! 🚨\n\nHạn mức: ${app.logic.formatCurrency(limit)}\nĐã tiêu + Nợ sắp trả: ${app.logic.formatCurrency(currentSpent + projectedDebt)}\nThêm khoản này: ${app.logic.formatCurrency(data.amount)}\n---------------------------\nSẼ VƯỢT QUÁ (Thâm hụt): ${app.logic.formatCurrency(over)}\n\nBạn có chắc chắn muốn "phá sản" không?`
                    );
                    if (!confirmOver) return;
                } else if (remainingAfter < 100000) {
                    alert(`⚠️ CẨN THẬN! Ví sắp cạn.\n\nSau khi trừ đi các khoản nợ phải trả tháng sau,\nbạn chỉ còn khả dụng: ${app.logic.formatCurrency(remainingAfter)}\nHãy cân nhắc kỹ!`);
                }
            }

            const sCheck = data.source.toLowerCase();
            if (sCheck.includes('zalo')) {
                const isCounted = confirm(`Giao dịch Zalo: "${data.place}"\n\nBạn có muốn tính số tiền này vào Zalo Priority không?\n- OK: Có tính\n- Cancel: Không tính`);
                data.skipZalo = !isCounted;
            }

            if (id) {
                const originalTx = app.data.transactions.find(t => t.id == id);
                if (originalTx && originalTx.status === 'planned' && data.status !== 'planned') {
                    data.id = Date.now();
                    if (data.type === 'Thu nhập' && data.status === 'pending') {
                        app.ui.popup.show("Đã chuyển trạng thái: <b>Sắp nhận tiền</b><br>(Đang chờ về ví)", "success");
                    } else {
                        app.ui.popup.show("Đã chuyển sang chính thức!<br>Giao dịch sẽ bị khóa sau 3 ngày.", "info");
                    }
                    const idx = app.data.transactions.findIndex(t => t.id == id);
                    if (idx !== -1) app.data.transactions.splice(idx, 1);
                    app.data.transactions.push(data);
                } else {
                    if (originalTx) {
                        // Giữ lại các trường đặc biệt cũ
                        if (originalTx.forceStatementKey) data.forceStatementKey = originalTx.forceStatementKey;
                        if (originalTx.keepForZalo) data.keepForZalo = originalTx.keepForZalo;
                        if (originalTx.cancelledDate) data.cancelledDate = originalTx.cancelledDate;
                        if (originalTx.isCancelDateFixed) data.isCancelDateFixed = originalTx.isCancelDateFixed;

                        // --- [QUAN TRỌNG] BẢO LƯU TRẠNG THÁI ĐÃ DỜI ---
                        if (originalTx.isDeferred) {
                            data.isDeferred = true;
                        }

                        if (originalTx.isSourceFixed) {
                            data.isSourceFixed = true;
                        } else {
                            const lockDuration = (originalTx.tags && originalTx.tags.includes('#hoan_tien') ? 1 : 3) * 24 * 60 * 60 * 1000;
                            const isLockedTime = (Date.now() - originalTx.id) > lockDuration;
                            // Kiểm tra xem có phải giao dịch nợ không
                            const isDebtPayment = originalTx.tags && (
                                originalTx.tags.includes('#thanh_toan_no') ||
                                originalTx.tags.includes('#tra_gop') ||
                                originalTx.tags.includes('#nop_phat') ||
                                originalTx.tags.includes('#thanh_toan_phi') ||
                                originalTx.tags.includes('#tat_toan_vay') ||
                                originalTx.tags.includes('#tra_no_vay')
                            );

                            // Nếu đã khóa, là giao dịch nợ, và source bị thay đổi thì đánh dấu isSourceFixed
                            if (isLockedTime && isDebtPayment && originalTx.source !== data.source) {
                                data.isSourceFixed = true;
                            }
                        }
                        // ----------------------------------------------

                        if (originalTx.isBrandFixed) {
                            data.isBrandFixed = true;
                        } else {
                            const lockDuration = (originalTx.tags && originalTx.tags.includes('#hoan_tien') ? 1 : 3) * 24 * 60 * 60 * 1000;
                            const isLockedTime = (Date.now() - originalTx.id) > lockDuration;
                            if (isLockedTime && originalTx.brand !== data.brand) {
                                data.isBrandFixed = true;
                            }
                        }

                        // --- KIỂM TRA LÀ GIAO DỊCH TRẢ NỢ ---
                        const isDebtPayment = originalTx.tags && (
                            originalTx.tags.includes('#thanh_toan_no') ||
                            originalTx.tags.includes('#tra_gop') ||
                            originalTx.tags.includes('#nop_phat') ||
                            originalTx.tags.includes('#thanh_toan_phi') ||
                            originalTx.tags.includes('#tat_toan_vay') ||
                            originalTx.tags.includes('#tra_no_vay')
                        );

                        // --- Logic khóa Nguồn tiền (Source) 1 lần ---
                        if (originalTx.isSourceFixed) {
                            data.isSourceFixed = true;
                        } else {
                            const lockDuration = (originalTx.tags && originalTx.tags.includes('#hoan_tien') ? 1 : 3) * 24 * 60 * 60 * 1000;
                            const isLockedTime = (Date.now() - originalTx.id) > lockDuration;

                            // Nếu đã khóa, là nợ, và bị đổi source -> Khóa vĩnh viễn source
                            if (isLockedTime && isDebtPayment && originalTx.source !== data.source) {
                                data.isSourceFixed = true;
                            }
                        }

                        // --- Logic khóa Thời gian (Date) 1 lần ---
                        if (originalTx.isDateFixed) {
                            data.isDateFixed = true;
                        } else {
                            const lockDuration = (originalTx.tags && originalTx.tags.includes('#hoan_tien') ? 1 : 3) * 24 * 60 * 60 * 1000;
                            const isLockedTime = (Date.now() - originalTx.id) > lockDuration;

                            // Nếu đã khóa, là nợ, và bị đổi thời gian -> Khóa vĩnh viễn thời gian
                            if (isLockedTime && isDebtPayment && originalTx.date !== data.date) {
                                data.isDateFixed = true;
                            }
                        }
                    }
                    const idx = app.data.transactions.findIndex(t => t.id == id);
                    app.data.transactions[idx] = data;
                }
            } else {
                app.data.transactions.push(data);
            }

            if (isCashback && discountMoney > 0) {
                const refIdStr = document.getElementById('tx-ref') ? document.getElementById('tx-ref').value.trim() : '';
                const placeContent = "Tiền hoàn giao dịch " + (refIdStr ? refIdStr : new Date(finalDateISO).toLocaleString('vi-VN'));

                const cashbackData = {
                    id: Date.now() + Math.floor(Math.random() * 1000) + 1,
                    type: 'Thu nhập',
                    status: 'paid',
                    amount: discountMoney,
                    discountAmount: 0,
                    discountValue: null,
                    place: placeContent,
                    brand: '',
                    source: `Ngân hàng ${data.source}`, // Nguồn tiền là Ngân hàng + Nguồn tiền giao dịch gốc
                    destination: '',
                    refId: '',
                    isRefFullyLocked: false,
                    orderCode: '',
                    isOrderCodeFullyLocked: false,
                    date: finalDateISO,
                    isUnknownTime: isUnknownTime,
                    tags: '#hoan_tien',
                    isTet: false,
                    is83: false,
                    is304: false
                };
                app.data.transactions.push(cashbackData);
            }

            // [THÊM TẠI ĐÂY] - Sắp xếp lại toàn bộ CSDL gốc trước khi lưu vào Storage
            app.data.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            app.data.transactions.sort((a, b) => {
                const dayA = new Date(a.date).toISOString().slice(0, 10);
                const dayB = new Date(b.date).toISOString().slice(0, 10);

                if (dayA !== dayB) return new Date(b.date) - new Date(a.date);

                // Đưa Không rõ giờ xuống cuối ngày
                if (a.isUnknownTime && !b.isUnknownTime) return 1;
                if (!a.isUnknownTime && b.isUnknownTime) return -1;

                return new Date(b.date) - new Date(a.date) || b.id - a.id;
            });

            if (data.tags && data.tags.includes('#di_vay')) {
                const lenderName = data.place.replace('Vay tiền từ ', '').trim();
                const loan = app.data.loans.find(l =>
                    l.originalAmount === data.amount &&
                    l.lender.toLowerCase() === lenderName.toLowerCase() &&
                    l.status === 'active'
                );

                if (loan) {
                    loan.date = new Date(data.date).toISOString();
                    if (loan.schedule && loan.schedule.length > 0) {
                        const newStartDate = new Date(data.date);
                        loan.schedule.forEach(p => {
                            const nextDate = new Date(newStartDate.getFullYear(), newStartDate.getMonth() + p.period, 7);
                            p.dueDate = nextDate.toLocaleDateString('vi-VN');
                        });
                    }
                    alert(`🔄 Đã đồng bộ ngày vay sang ${new Date(data.date).toLocaleDateString('vi-VN')}\n📅 Lịch trả nợ (Ngày 7) đã được cập nhật lại!`);
                }
            }

            if (app.logic.fixAllTags) app.logic.fixAllTags();
            app.storage.save();
            app.logic.updateFees();
            app.ui.renderAll();
            app.ui.init();
            document.getElementById('modal-tx').classList.remove('active');

            if (app.ui.transactionModalInterval) {
                clearInterval(app.ui.transactionModalInterval);
                app.ui.transactionModalInterval = null;
            }
        });

        document.getElementById('btn-add-forecast').addEventListener('click', () => {
            const name = document.getElementById('forecast-name').value;
            const amount = Number(document.getElementById('forecast-amount').value);
            if (name && amount) {
                app.data.forecasts.push({ name, amount });
                app.storage.save();
                app.ui.renderAll();
                document.getElementById('forecast-name').value = '';
                document.getElementById('forecast-amount').value = '';
            }
        });

        document.getElementById('guestModeBtn').onclick = () => {
            app.data.configs.guestMode = !app.data.configs.guestMode;
            app.storage.save(); app.ui.renderAll();
        };
        document.getElementById('privateModeBtn').onclick = () => {
            app.security.toggleSetup();
        };

        const hiddenInput = document.getElementById('auth-input-hidden');
        if (hiddenInput) {
            hiddenInput.addEventListener('keyup', (e) => {
                if (e.key >= '0' && e.key <= '9') {
                    app.security.input(parseInt(e.key));
                }
                if (e.key === 'Backspace') {
                    app.security.pin = app.security.pin.slice(0, -1);
                    app.security.renderDots();
                }
                if (e.key === 'Enter') {
                    app.security.submit();
                }
            });
            document.getElementById('security-overlay').addEventListener('click', () => {
                hiddenInput.focus();
            });
        }

        ['cloud-bin-id', 'cloud-api-key', 'gemini-key', 'zalo-review-date'].forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                if (id === 'zalo-review-date') {
                    app.data.configs.zaloReviewDate = e.target.value;
                    app.logic.updateFees();
                    app.ui.renderZaloWidget();
                }
                if (id === 'cloud-bin-id') app.data.configs.apiKeys.cloudBin = e.target.value;
                if (id === 'cloud-api-key') app.data.configs.apiKeys.cloudKey = e.target.value;
                if (id === 'gemini-key') app.data.configs.apiKeys.gemini = e.target.value;
                app.storage.save();
            });
        });

        document.getElementById('btn-reset-data').onclick = () => {
            app.ui.popup.confirm(
                "CẢNH BÁO: KHÔI PHỤC CÀI ĐẶT GỐC!\n\nToàn bộ dữ liệu (Giao dịch, Ngân hàng, Ví, Nợ, Mật khẩu...) sẽ bị xóa sạch vĩnh viễn.\nBạn có chắc chắn muốn làm điều này?",
                () => {
                    // 1. TỰ ĐỘNG XÓA SẠCH BỘ NHỚ (Cả LocalStorage và IndexedDB): 
                    const keys = Object.keys(localStorage);
                    for (let key of keys) {
                        if (key.startsWith('fm_')) {
                            localStorage.removeItem(key);
                        }
                    }
                    // Thêm lệnh xóa Database của IndexedDB
                    if (window.indexedDB) {
                        indexedDB.deleteDatabase('FinanceAppDB');
                    }

                    // 2. Reset trạng thái bảo mật trong phiên làm việc hiện tại
                    if (app.security) {
                        app.security.isEnabled = false;
                        app.security.pin = '';
                        app.security.masterKey = '';
                    }

                    // 3. Thông báo và tải lại trang 
                    app.ui.popup.show("✅ Đã khôi phục cài đặt gốc thành công!\nHệ thống sẽ tự động tải lại...", "success");

                    // Tải lại trang sau 1.5s để file 1-data.js khởi tạo lại cấu trúc app.data trống 100%
                    setTimeout(() => {
                        window.location.href = window.location.pathname; // Reload bỏ qua cache / params 
                    }, 1500);
                }
            );
        };

        document.getElementById('debt-list').addEventListener('change', (e) => {
            // Helper function xác định logic mới/cũ
            const useNewLogic = () => {
                const cutoffDate = new Date('2026-01-28T23:59:59');
                return new Date() > cutoffDate;
            };

            if (e.target.matches('.pay-fee-check') || e.target.matches('.pay-min-check') || e.target.matches('.pay-all-check')) {
                e.preventDefault();
                const checkbox = e.target;
                const sourceName = checkbox.dataset.source; // Tên nguồn nợ (VD: Ví Trả Sau MoMo)
                const totalAmount = parseFloat(checkbox.dataset.amount);
                const idsString = checkbox.dataset.ids;

                const isFeeOnly = checkbox.matches('.pay-fee-check');
                const isMinPay = checkbox.matches('.pay-min-check');

                const feeAmount = parseFloat(checkbox.dataset.fee) || 0;
                const penaltyAmount = parseFloat(checkbox.dataset.penalty) || 0;

                let confirmMsg = "";
                if (isFeeOnly) confirmMsg = `Thanh toán PHÍ DỊCH VỤ cho <b>${sourceName}</b>?`;
                else if (isMinPay) confirmMsg = `Thanh toán TỐI THIỂU cho <b>${sourceName}</b>?`;
                else confirmMsg = `Thanh toán TOÀN BỘ cho <b>${sourceName}</b>?`;

                app.ui.popup.confirm(
                    `${confirmMsg}<br>Số tiền: <b>${app.logic.formatCurrency(totalAmount)}</b>`,
                    () => {
                        const paymentDate = app.logic.getPaymentDate();
                        const isNew = useNewLogic();

                        // [LOGIC MỚI] 
                        // Nếu là mới: Source = "Tiền mặt" (Mặc định), Destination = sourceName (Nguồn nợ)
                        // Nếu là cũ: Source = sourceName, Destination = null
                        const txSource = isNew ? "Tiền mặt" : sourceName;
                        const txDest = isNew ? sourceName : null;

                        // 1. Tạo các giao dịch
                        if (isFeeOnly) {
                            app.data.transactions.push({
                                id: Date.now(),
                                type: 'Chi tiêu',
                                place: `Thanh toán phí dịch vụ ${sourceName}`,
                                source: txSource,
                                destination: txDest, // [MỚI]
                                amount: totalAmount,
                                date: paymentDate,
                                tags: '#thanh_toan_phi',
                                status: 'paid'
                            });
                        } else {
                            // Trả Phạt
                            if (penaltyAmount > 0) {
                                app.data.transactions.push({
                                    id: Date.now(),
                                    type: 'Chi tiêu',
                                    place: `Thanh toán Phạt quá hạn ${sourceName}`,
                                    source: txSource,
                                    destination: txDest, // [MỚI]
                                    amount: penaltyAmount,
                                    date: paymentDate,
                                    tags: '#nop_phat',
                                    status: 'paid'
                                });
                            }
                            // Trả Phí
                            if (feeAmount > 0) {
                                app.data.transactions.push({
                                    id: Date.now() + 1,
                                    type: 'Chi tiêu',
                                    place: `Thanh toán Phí dịch vụ ${sourceName}`,
                                    source: txSource,
                                    destination: txDest, // [MỚI]
                                    amount: feeAmount,
                                    date: paymentDate,
                                    tags: '#thanh_toan_phi',
                                    status: 'paid'
                                });
                            }
                            // Trả Gốc
                            const principalAmount = totalAmount - feeAmount - penaltyAmount;
                            if (principalAmount > 0) {
                                app.data.transactions.push({
                                    id: Date.now() + 2,
                                    type: 'Chi tiêu',
                                    place: isMinPay ? `Trả tối thiểu Gốc ${sourceName}` : `Trả toàn bộ Gốc ${sourceName}`,
                                    source: txSource,
                                    destination: txDest, // [MỚI]
                                    amount: principalAmount,
                                    date: paymentDate,
                                    tags: '#thanh_toan_no',
                                    status: 'paid'
                                });
                            }
                        }

                        // Gạch nợ cũ
                        if (idsString) {
                            const ids = idsString.split(',').map(Number);
                            app.data.transactions.forEach(t => {
                                if (isFeeOnly) {
                                    if (ids.includes(t.id) && t.tags && t.tags.includes('#phi_dich_vu')) t.status = 'paid';
                                } else {
                                    if (ids.includes(t.id)) t.status = 'paid';
                                }
                            });
                        }

                        // Xử lý dư nợ chuyển tiếp (cho trả tối thiểu)
                        if (isMinPay) {
                            const originalDate = checkbox.dataset.originalDate || new Date().toISOString();
                            const remaining = parseFloat(checkbox.dataset.remaining);
                            if (remaining > 0) {
                                // Dư nợ mới vẫn nằm ở Nguồn nợ cũ (Ví dụ: vẫn nợ trên Ví MoMo)
                                const isZalo = sourceName.toLowerCase().includes('zalo');
                                const newDate = isZalo ? new Date().toISOString() : originalDate;

                                app.data.transactions.push({
                                    id: Date.now() + 3,
                                    type: 'Chi tiêu',
                                    place: `Dư nợ chuyển tiếp (${sourceName})`,
                                    source: sourceName, // Dư nợ thì source vẫn là chính nó
                                    amount: remaining,
                                    date: newDate,
                                    tags: '#du_no_chuyen_tiep',
                                    status: 'pending'
                                });
                            }
                        }

                        app.storage.save();
                        app.ui.renderAll();
                        app.ui.popup.show("✅ Đã thanh toán thành công!", "success");
                    }
                );
                return;
            }

            // --- XỬ LÝ CHECKBOX TRẢ GÓP (PAYMENT-CHECKBOX) ---
            if (e.target.matches('.payment-checkbox')) {
                if (!e.target.checked) return;
                const planId = e.target.getAttribute('data-plan-id');
                const dateKey = e.target.getAttribute('data-date');
                const plan = app.data.installmentPlans[planId];

                if (plan) {
                    const payment = plan.payments.find(p => p.date === dateKey);
                    if (payment) {
                        // Logic ngày 28/1
                        const useNewLogic = new Date() > new Date('2026-01-28T23:59:59');
                        const txSource = useNewLogic ? "Tiền mặt" : plan.source;
                        const txDest = useNewLogic ? plan.source : null;

                        payment.paid = true;
                        app.data.transactions.push({
                            id: Date.now(),
                            type: 'Chi tiêu',
                            place: `Trả góp ${plan.source} kỳ ${payment.date}`,
                            source: txSource,
                            destination: txDest, // [MỚI]
                            amount: payment.amount,
                            date: app.logic.getPaymentDate(),
                            tags: '#tra_gop',
                            status: 'paid'
                        });
                        app.storage.save();
                        app.ui.renderAll();
                    }
                }
            }
        });

        // Cloud sync buttons
        // --- TÌM ĐOẠN NÀY TRONG 6-main.js ---
        // 1. LƯU DỮ LIỆU LÊN CLOUD
        document.getElementById('btn-sync-cloud').onclick = async () => {
            // Gọi hàm lưu sang GitHub Gist đã viết trong 3-storage.js
            const btn = document.getElementById('btn-sync-cloud');
            const originalContent = btn.innerHTML;

            // Hiệu ứng Loading
            btn.innerHTML = `<div class="menu-icon"><i class="fa-solid fa-spinner fa-spin"></i></div><span class="menu-text">Đang lưu...</span>`;
            btn.style.pointerEvents = 'none';

            try {
                // Cập nhật key từ input vào data trước khi lưu
                app.data.configs.apiKeys.cloudBin = document.getElementById('cloud-bin-id').value.trim();
                app.data.configs.apiKeys.cloudKey = document.getElementById('cloud-api-key').value.trim();

                // Gọi hàm chính từ file storage
                await app.storage.saveToCloud();

            } catch (e) {
                console.error(e);
                // app.storage.saveToCloud đã có alert lỗi rồi, không cần alert lại ở đây
            } finally {
                // Trả lại nút bấm
                btn.innerHTML = originalContent;
                btn.style.pointerEvents = 'auto';
            }
        };

        // 2. TẢI DỮ LIỆU TỪ CLOUD
        document.getElementById('btn-load-cloud').onclick = async () => {
            const btn = document.getElementById('btn-load-cloud');
            const originalContent = btn.innerHTML;

            btn.innerHTML = `<div class="menu-icon"><i class="fa-solid fa-spinner fa-spin"></i></div><span class="menu-text">Đang tải...</span>`;
            btn.style.pointerEvents = 'none';

            try {
                app.data.configs.apiKeys.cloudBin = document.getElementById('cloud-bin-id').value.trim();
                app.data.configs.apiKeys.cloudKey = document.getElementById('cloud-api-key').value.trim();

                // Gọi hàm chính từ file storage
                await app.storage.loadFromCloud();

            } catch (e) {
                console.error(e);
            } finally {
                btn.innerHTML = originalContent;
                btn.style.pointerEvents = 'auto';
            }
        };

        document.getElementById('btn-export-excel').onclick = () => {
            if (!window.jspdf) return app.ui.popup.show("Thư viện PDF đang tải, vui lòng thử lại sau giây lát!", "error");

            const currentMonth = app.data.filter.month;

            // Sử dụng Popup Confirm với 2 luồng (Callback)
            app.ui.popup.confirm(
                `XUẤT DỮ LIỆU PDF\n\nBạn muốn xuất dữ liệu nào?\n\n- <b>ĐỒNG Ý:</b> Xuất TOÀN BỘ lịch sử (Cần PIN).\n- <b>KHÔNG:</b> Chỉ xuất tháng ${currentMonth}.`,

                // LUỒNG 1: XUẤT TOÀN BỘ (Khi bấm Đồng ý)
                () => {
                    if (app.security.isEnabled) {
                        setTimeout(() => {
                            const inputPin = prompt("🔒 BẢO MẬT: Nhập mã PIN để xuất toàn bộ:");
                            if (!inputPin) return;

                            const inputHash = CryptoJS.MD5(inputPin).toString();
                            const savedHash = localStorage.getItem('fm_pin_hash');

                            if (inputHash !== savedHash) {
                                return app.ui.popup.show("❌ MẬT KHẨU SAI! Truy cập bị từ chối.", "error");
                            }
                            // Pass
                            doExportPDF(app.data.transactions, `Finance_Full_Backup_${Date.now()}.pdf`, "TOAN BO LICH SU GIAO DICH");
                        }, 300); // Delay nhỏ để popup cũ đóng hẳn
                    } else {
                        doExportPDF(app.data.transactions, `Finance_Full_Backup_${Date.now()}.pdf`, "TOAN BO LICH SU GIAO DICH");
                    }
                },

                // LUỒNG 2: XUẤT THÁNG NÀY (Khi bấm Không/Hủy)
                () => {
                    const dataToExport = app.logic.getFilteredTxs();
                    if (dataToExport.length === 0) {
                        return app.ui.popup.show(`Tháng ${currentMonth} chưa có giao dịch nào!`, "warning");
                    }
                    doExportPDF(dataToExport, `Finance_Month_${currentMonth}.pdf`, `LICH SU GIAO DICH THANG ${currentMonth.split('-')[1]}/${currentMonth.split('-')[0]}`);
                }
            );

            // Hàm xuất file PDF nội bộ
            const doExportPDF = (data, fileName, titleText) => {
                try {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF('p', 'pt', 'a4'); // Khổ A4 dọc

                    // Hàm bỏ dấu tiếng Việt để PDF không bị lỗi font (Bắt buộc với thư viện mặc định)
                    const removeAccents = (str) => {
                        if (!str) return "";
                        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
                    };

                    // Header File
                    doc.setFontSize(16);
                    doc.setTextColor(15, 23, 42);
                    doc.text(removeAccents(titleText), doc.internal.pageSize.getWidth() / 2, 40, { align: "center" });

                    doc.setFontSize(10);
                    doc.setTextColor(100, 116, 139);
                    doc.text(`Ngay xuat: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`, 40, 60);
                    doc.text(`Tong so giao dich: ${data.length}`, 40, 75);

                    // Chuẩn bị dữ liệu bảng (Mô phỏng giống giao diện Web)
                    const tableBody = data.sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => {
                        const isInc = t.type === 'Thu nhập';
                        const isTransfer = t.type === 'Chuyển tiền';
                        const isCancelled = t.status === 'cancelled';

                        // 1. Trạng thái
                        let statusText = 'Thanh cong';
                        if (isCancelled) statusText = 'Da huy';
                        else if (t.status === 'planned') statusText = isInc ? 'Se nhan' : 'Se chi';
                        else if (t.status === 'pending') statusText = 'Chua tra';
                        else if (isTransfer) statusText = 'Chuyen khoan';

                        // 2. Nguồn tiền (Có điểm đi & đến nếu là chuyển tiền)
                        let sourceDest = removeAccents(t.source);
                        if (t.destination) {
                            sourceDest += `\n-> ${removeAccents(t.destination)}`;
                        }

                        // 3. Số tiền (Thêm dấu +/- dựa theo loại)
                        const sign = isInc ? '+' : (isTransfer ? '' : '-');
                        const amountStr = `${sign}${new Intl.NumberFormat('vi-VN').format(t.amount)} d`;

                        // 4. Thời gian
                        const dateObj = new Date(t.date);
                        const timeStr = `${dateObj.toLocaleDateString('vi-VN')}\n${dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;

                        // 5. Nội dung (Gộp Brand và Tags thành dòng nhỏ)
                        let contentStr = removeAccents(t.place);
                        const extras = [];
                        if (t.brand) extras.push(removeAccents(t.brand));
                        if (t.tags) extras.push(removeAccents(t.tags));
                        if (extras.length > 0) {
                            contentStr += `\n(${extras.join(' - ')})`;
                        }

                        return [timeStr, contentStr, sourceDest, amountStr, statusText];
                    });

                    // Vẽ bảng (Tự động canh lề và tô màu)
                    doc.autoTable({
                        startY: 90,
                        head: [['Thoi gian', 'Noi dung', 'Nguon tien', 'So tien', 'Trang thai']],
                        body: tableBody,
                        theme: 'grid',
                        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], halign: 'center' },
                        styles: { font: "helvetica", fontSize: 9, cellPadding: 5, valign: 'middle' },
                        columnStyles: {
                            0: { cellWidth: 60, halign: 'center' }, // Thời gian
                            1: { cellWidth: 'auto' },               // Nội dung
                            2: { cellWidth: 90 },                   // Nguồn tiền
                            3: { cellWidth: 80, halign: 'right' },  // Số tiền
                            4: { cellWidth: 70, halign: 'center' }  // Trạng thái
                        },
                        didParseCell: function (data) {
                            // Tô màu cho số tiền y hệt như website (xanh, đỏ, xanh dương)
                            if (data.section === 'body' && data.column.index === 3) {
                                const text = data.cell.raw || "";
                                if (text.startsWith('+')) data.cell.styles.textColor = [16, 185, 129]; // Thu (Xanh lá)
                                else if (text.startsWith('-')) data.cell.styles.textColor = [15, 23, 42]; // Chi (Đen nguyên bản)
                                else data.cell.styles.textColor = [2, 132, 199]; // Chuyển tiền (Xanh dương)
                            }
                            // Làm mờ text đối với các giao dịch "Đã hủy"
                            if (data.section === 'body') {
                                const status = data.row.raw[4]; // Cột trạng thái
                                if (status === 'Da huy') {
                                    data.cell.styles.textColor = [148, 163, 184]; // Xám mờ
                                    data.cell.styles.fontStyle = 'italic';
                                }
                            }
                        }
                    });

                    // Lưu file
                    doc.save(fileName);
                    app.ui.popup.show(`✅ Đã xuất file PDF thành công:\n${fileName}`, "success");
                } catch (e) {
                    app.ui.popup.show("Lỗi khi xuất file PDF: " + e.message, "error");
                    console.error(e);
                }
            };
        };
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());

document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
});
// --- NÂNG CẤP TRÍ TUỆ AI (Context-Aware Financial Advisor) ---
document.getElementById('btn-ask-gemini').addEventListener('click', async () => {
    const inputEl = document.getElementById('gemini-prompt');
    const chatLog = document.getElementById('chat-log');
    const question = inputEl.value.trim();
    const apiKey = app.data.configs.apiKeys.gemini;

    if (!question) return;
    if (!apiKey) return app.ui.popup.show("⚠️ Chưa nhập Gemini API Key trong Cấu hình!", "error");

    // 1. Hiển thị câu hỏi của User
    const userMsgHTML = `
        <div class="chat-msg user">
            <div class="chat-bubble">${question}</div>
        </div>`;
    chatLog.insertAdjacentHTML('beforeend', userMsgHTML);
    inputEl.value = '';
    chatLog.scrollTop = chatLog.scrollHeight;

    // 2. Hiển thị Loading
    const loadingId = 'loading-' + Date.now();
    const loadingHTML = `
        <div id="${loadingId}" class="chat-msg ai">
            <div class="ai-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="chat-bubble">
                <div class="typing-indicator">
                    <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                </div>
            </div>
        </div>`;
    chatLog.insertAdjacentHTML('beforeend', loadingHTML);
    chatLog.scrollTop = chatLog.scrollHeight;

    // --- BƯỚC QUAN TRỌNG: TỔNG HỢP DỮ LIỆU TÀI CHÍNH NÂNG CAO ---
    const currentMonth = app.data.filter.month;
    const txs = app.logic.getFilteredTxs();

    const income = txs.filter(t => t.type === 'Thu nhập').reduce((sum, t) => sum + t.amount, 0);
    const expenses = txs.filter(t => t.type === 'Chi tiêu' && t.status !== 'cancelled');
    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    const balance = income - totalExpense;

    // Lấy hạn mức (nếu có)
    const limit = Number(app.data.configs.monthlyLimits?.[currentMonth]) || 0;
    const remainingBudget = limit > 0 ? limit - totalExpense : null;
    const burnRate = limit > 0 ? Math.round((totalExpense / limit) * 100) : (income > 0 ? Math.round((totalExpense / income) * 100) : 0);

    const upcomingData = app.logic.getUpcomingDebts();
    const upcomingDebt = upcomingData.total;
    const debtItems = upcomingData.items.map(i => `${i.name} (${app.logic.formatCurrency(i.amount)})`).join(', ');

    // Mở rộng Top 5 khoản tiêu kèm Tag để AI phân tích thói quen
    const topSpending = expenses.sort((a, b) => b.amount - a.amount).slice(0, 5)
        .map(t => `- ${t.place} (${t.tags || 'Khác'}): ${app.logic.formatCurrency(t.amount)}`).join('\n');

    // Dữ liệu bối cảnh gửi cho AI
    const financialContext = `
    [DỮ LIỆU TÀI CHÍNH THÁNG ${currentMonth}]
    - Tổng Thu Nhập: ${app.logic.formatCurrency(income)}
    - Tổng Chi Tiêu: ${app.logic.formatCurrency(totalExpense)}
    - Số Dư Hiện Tại: ${app.logic.formatCurrency(balance)}
    ${limit > 0 ? `- Hạn Mức Cài Đặt: ${app.logic.formatCurrency(limit)} (Đã tiêu ${burnRate}% hạn mức. Còn lại: ${app.logic.formatCurrency(remainingBudget)})` : `- Tỷ lệ chi tiêu so với thu nhập: ${burnRate}%`}
    - Nợ Sắp Phải Trả: ${app.logic.formatCurrency(upcomingDebt)} (${debtItems || 'Không có khoản nợ nào'})
    
    [TOP 5 KHOẢN CHI LỚN NHẤT THÁNG NÀY]
    ${topSpending || 'Chưa có khoản chi tiêu nào đáng kể.'}
    
    [CÂU HỎI CỦA TÔI]: 
    "${question}"
    `;

    // System Instruction: Ép AI nhập vai và tư duy phân tích
    const systemInstruction = `Bạn là FinDash AI - trợ lý tài chính cá nhân thông minh, sắc bén và hơi "xéo xắt" (hài hước, châm biếm nhẹ nhàng). 
    QUY TẮC TRẢ LỜI:
    1. Trả lời thẳng vào câu hỏi của người dùng.
    2. Nếu thấy tỷ lệ chi tiêu (Burn rate) > 80%, hãy dùng lời lẽ gay gắt, mỉa mai để cảnh báo nguy cơ cháy túi.
    3. Nếu Số dư < Nợ sắp trả, hãy khẩn thiết nhắc nhở họ chuẩn bị tiền trả nợ ngay lập tức.
    4. Nhìn vào "Top 5 khoản chi lớn nhất" để đánh giá thói quen tiêu dùng (VD: "Tiêu quá nhiều vào ăn nhậu/mua sắm rồi đấy").
    5. Đưa ra 1 lời khuyên thực tế nhất (hành động cụ thể).
    6. Ngắn gọn, súc tích (dưới 150 từ). Sử dụng bullet point và emoji để dễ đọc.`;

    // 3. Gọi API Gemini với cấu trúc thông minh
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                },
                contents: [
                    { parts: [{ text: financialContext }] }
                ]
            })
        });

        if (!res.ok) throw new Error(`Lỗi Server: ${res.statusText}`);

        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Gemini đang bận đếm tiền, thử lại sau nhé!";

        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        const formattedReply = reply.replace(/\n/g, '<br>');

        const aiMsgHTML = `
            <div class="chat-msg ai">
                <div class="ai-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="chat-bubble">${formattedReply}</div>
            </div>`;
        chatLog.insertAdjacentHTML('beforeend', aiMsgHTML);

    } catch (e) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        chatLog.insertAdjacentHTML('beforeend', `<div class="chat-msg ai"><div class="chat-bubble text-danger">Lỗi kết nối AI: ${e.message}</div></div>`);
    }

    chatLog.scrollTop = chatLog.scrollHeight;
});

// Sự kiện nhấn Enter để gửi
document.getElementById('gemini-prompt').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-ask-gemini').click();
});

// ==========================================
// THÊM ĐOẠN NÀY VÀO CUỐI FILE 6-main.js
// ==========================================

// 1. Đảm bảo object app.ui tồn tại để không bị lỗi
window.app = window.app || {};
window.app.ui = window.app.ui || {};

// 2. Định nghĩa hàm mở menu
app.ui.toggleMobileMenu = function () {
    console.log("Đã bấm nút menu!"); // Kiểm tra xem nút có ăn không

    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-backdrop');

    // Tìm thấy sidebar thì thêm/bớt class 'active'
    if (sidebar) {
        sidebar.classList.toggle('active');
    } else {
        console.error("Lỗi: Không tìm thấy ID 'sidebar' trong HTML");
    }

    // Xử lý màn hình đen mờ che nền (nếu có)
    if (backdrop) {
        if (sidebar.classList.contains('active')) {
            backdrop.style.display = 'block'; // Hiện
            setTimeout(() => backdrop.classList.add('active'), 10); // Hiệu ứng mờ dần
        } else {
            backdrop.classList.remove('active'); // Mất hiệu ứng
            setTimeout(() => backdrop.style.display = 'none', 300); // Ẩn hẳn
        }
    }
};
// ==========================================
// THUẬT TOÁN ĐO KHOẢNG CÁCH CHỈNH SỬA (MỚI)
// ==========================================
const getEditDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
    }
    return matrix[b.length][a.length];
};

const handleEditLimit = (e, originalId, errorId, lockFlagId, typeName) => {
    const origVal = document.getElementById(originalId).value.trim();
    const currentVal = e.target.value.trim();
    const errorEl = document.getElementById(errorId);
    const lockFlagEl = document.getElementById(lockFlagId);
    const txSubmitBtn = document.querySelector('#form-tx button[type="submit"]');

    let is3DaysOld = false;
    const txIdStr = document.getElementById('tx-id') ? document.getElementById('tx-id').value : '';
    if (txIdStr) {
        const tx = app.data.transactions.find(t => t.id == txIdStr);
        if (tx && tx.date) {
            const isCashback = tx.tags && tx.tags.includes('#hoan_tien');
            const lockDays = isCashback ? 1 : 3;

            const diffDays = (new Date().getTime() - new Date(tx.date).getTime()) / (1000 * 3600 * 24);
            if (diffDays > lockDays) is3DaysOld = true;
        }
    }

    if (origVal) {
        const diff = getEditDistance(origVal, currentVal);

        // CHỈ CHẶN KHI: Đã quá 3 ngày VÀ sửa quá 6 ký tự
        if (is3DaysOld && diff > 6) {
            errorEl.style.display = 'block';
            errorEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Vượt giới hạn sửa 6 ký tự (${typeName})!`;
            if (txSubmitBtn) { txSubmitBtn.disabled = true; txSubmitBtn.style.opacity = '0.5'; }
        } else {
            // Nếu chưa quá 3 ngày HOẶC sửa ít hơn 6 ký tự -> Cho phép lưu
            errorEl.style.display = 'none';

            // Các xử lý bật/tắt nút lưu và gán cờ khóa vĩnh viễn ở dưới vẫn giữ nguyên...
            const isOtherError = Array.from(document.querySelectorAll('#tx-ref-error, #tx-order-error')).some(el => el && el.style.display === 'block');
            if (!isOtherError && txSubmitBtn) {
                txSubmitBtn.disabled = false;
                txSubmitBtn.style.opacity = '1';
            }

            // LOGIC KHÓA VĨNH VIỄN
            if (is3DaysOld && diff > 0) {
                if (lockFlagEl) lockFlagEl.value = 'true';
            } else {
                if (lockFlagEl) lockFlagEl.value = 'false';
            }
        }
    }
};

// Định nghĩa hàm xử lý
function checkEcomLogic() {
    const placeEl = document.getElementById('tx-place');
    const brandEl = document.getElementById('tx-brand');

    // Logic kiểm tra sàn TMĐT
    if (placeEl && placeEl.value.toLowerCase().includes('shopee')) {
        // Code xử lý hiển thị thêm input của bạn ở đây...
        console.log("Phát hiện Shopee!");
    }
}

// Sự kiện lắng nghe
document.addEventListener('input', (e) => {
    // 1. Quét logic TMĐT
    if (e.target && (e.target.id === 'tx-place' || e.target.id === 'tx-brand')) {
        checkEcomLogic(); // FIX: Xóa 'app.logic.' đi, chỉ gọi tên hàm trực tiếp
    }

    // 2. Quét logic giới hạn sửa Mã GD
    if (e.target && e.target.id === 'tx-ref') {
        handleEditLimit(e, 'tx-original-ref', 'tx-ref-error', 'tx-fully-locked-flag', 'Mã GD');
    }

    // 3. Quét logic giới hạn sửa Mã Đơn
    if (e.target && e.target.id === 'tx-order-code') {
        handleEditLimit(e, 'tx-original-order-code', 'tx-order-error', 'tx-order-fully-locked-flag', 'Mã Đơn');
    }
});

// HÀM MỚI: Kiểm tra văn bản có khớp với ngôn ngữ đích không bằng Regex
function isTargetLanguage(text, targetLang) {
    // Xóa khoảng trắng và dấu câu để kiểm tra chính xác ký tự
    let cleanText = text.replace(/[\s\.,!\?\'\"\(\)\[\]\{\}-]/g, "");

    if (targetLang === "Tiếng Việt") {
        // Regex nhận diện chữ cái tiếng Việt (có dấu và không dấu)
        const vnRegex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỮỰỲỴÝỶỸửữựỳỵỷỹ]+$/;
        return vnRegex.test(cleanText);
    }
    else if (targetLang === "Tiếng Anh") {
        // Regex nhận diện chữ cái Latinh cơ bản (Tiếng Anh)
        const enRegex = /^[a-zA-Z]+$/;
        return enRegex.test(cleanText);
    }

    // Nếu là ngôn ngữ khác (Tiếng Nhật, v.v.) có thể mở rộng sau, tạm thời false để AI tự xử lý
    return false;
}