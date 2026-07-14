app.ui = {
    popup: {
        el: document.getElementById('custom-popup-overlay'),
        iconBox: document.getElementById('popup-icon-box'),
        icon: document.getElementById('popup-icon'),
        title: document.getElementById('popup-title'),
        msg: document.getElementById('popup-message'),

        input: document.getElementById('popup-input'),

        btnConfirm: document.getElementById('btn-popup-confirm'),
        btnCancel: document.getElementById('btn-popup-cancel'),

        close() {
            this.el.classList.remove('active');

            // Xóa chế độ popup chi tiết để các popup sau trở lại bình thường
            this.el.classList.remove('credit-detail-popup');

            if (this.input) {
                this.input.value = '';
                this.input.style.display = 'none';
            }
        },

        renderMessage(message) {
            const content = String(message ?? '');

            // Kiểm tra nội dung có phải HTML hay không
            const containsHTML =
                /<\/?[a-z][\s\S]*>/i.test(content);

            /*
             * Nếu là HTML thì giữ nguyên.
             * Nếu chỉ là văn bản thường mới chuyển xuống dòng thành <br>.
             */
            this.msg.innerHTML = containsHTML
                ? content
                : content.replace(/\n/g, '<br>');
        },

        show(message, type = 'info') {
            return new Promise((resolve) => {
                this.setupUI(type);
                this.input.style.display = 'none';

                this.renderMessage(message);
                this.btnCancel.style.display = 'none';
                this.btnConfirm.textContent = 'Đã hiểu';

                this.btnConfirm.onclick = () => {
                    this.close();
                    resolve(true);
                };
                this.el.style.zIndex = '9999999';
                this.el.classList.add('active');
            });
        },

        confirm(message, onConfirmCallback, onCancelCallback = null) {
            this.setupUI('warning');
            this.input.style.display = 'none';

            this.title.textContent = 'Xác nhận';
            this.renderMessage(message);

            this.btnCancel.style.display = 'block';
            this.btnCancel.textContent = 'Không';
            this.btnConfirm.textContent = 'Đồng ý';

            this.btnCancel.onclick = () => {
                this.close();
                if (onCancelCallback) onCancelCallback();
            };
            this.btnConfirm.onclick = () => {
                this.close();
                if (onConfirmCallback) onConfirmCallback();
            };

            this.el.style.zIndex = '9999999';
            this.el.classList.add('active');
        },

        prompt(message, onConfirmCallback, title = 'Nhập liệu') {
            this.setupUI('info');
            this.icon.className = 'fa-solid fa-pen-to-square';
            this.iconBox.className = 'icon-info';

            this.title.textContent = title;
            this.renderMessage(message);

            this.input.style.display = 'block';
            this.input.value = '';

            this.input.removeAttribute('maxlength');
            this.input.style.letterSpacing = 'normal';
            this.input.style.textAlign = 'left';
            this.input.placeholder = 'Nhập nội dung...';

            this.input.onkeyup = (e) => {

            };

            setTimeout(() => this.input.focus(), 100);

            this.btnCancel.style.display = 'block';
            this.btnCancel.textContent = 'Hủy';
            this.btnConfirm.textContent = 'Xác nhận';

            this.btnCancel.onclick = () => {
                this.close();
            };

            this.btnConfirm.onclick = () => {
                const val = this.input.value;
                if (!val) {
                    this.input.style.borderColor = 'var(--danger)';
                    setTimeout(() => this.input.style.borderColor = '#cbd5e1', 500);
                    return;
                }
                this.close();
                if (onConfirmCallback) onConfirmCallback(val);
            };

            this.el.style.zIndex = '9999999';
            this.el.classList.add('active');
        },

        setupUI(type) {
            this.iconBox.className = '';
            this.icon.className = 'fa-solid';

            if (type === 'success') {
                this.iconBox.classList.add('icon-success');
                this.icon.classList.add('fa-check');
                this.title.textContent = 'Thành công!';
            } else if (type === 'error') {
                this.iconBox.classList.add('icon-error');
                this.icon.classList.add('fa-xmark');
                this.title.textContent = 'Lỗi!';
            } else if (type === 'warning') {
                this.iconBox.classList.add('icon-warning');
                this.icon.classList.add('fa-exclamation');
                this.title.textContent = 'Chú ý';
            } else {
                this.iconBox.classList.add('icon-info');
                this.icon.classList.add('fa-bell');
                this.title.textContent = 'Thông báo';
            }
        }
    },
    chartInstance: null,
    reportChartInstance: null,
    transactionModalInterval: null,

    updateFinancialWeather(income, expense, hasOverdue) {
        const box = document.getElementById('financial-weather-box');

        if (app.data.configs.guestMode) {
            box.style.display = 'none';
            return;
        }

        box.style.display = 'flex';

        let state = 'cloudy';

        if (hasOverdue) {
            state = 'storm';
        } else if (income === 0 && expense === 0) {
            state = 'cloudy';
        } else if (income === 0 && expense > 0) {
            state = 'rainy';
        } else {
            const ratio = expense / income;
            if (ratio < 0.5) state = 'sunny';
            else if (ratio < 0.8) state = 'cloudy';
            else if (ratio <= 1.0) state = 'rainy';
            else state = 'storm';
        }

        const content = {
            sunny: {
                icon: '<i class="fa-solid fa-sun"></i>',
                title: 'NẮNG ĐẸP (AN TOÀN)',
                desc: 'Ví dày, tâm trạng phơi phới. Tận hưởng đi bạn ơi!',
                class: 'w-sunny'
            },
            cloudy: {
                icon: '<i class="fa-solid fa-cloud-sun"></i>',
                title: 'TRỜI NHIỀU MÂY',
                desc: 'Mọi thứ vẫn ổn, nhưng đừng vung tay quá trán nhé.',
                class: 'w-cloudy'
            },
            rainy: {
                icon: '<i class="fa-solid fa-cloud-showers-heavy"></i>',
                title: 'MƯA RÀO TÀI CHÍNH',
                desc: 'Cảnh báo! Sắp cạn ví rồi. Tìm chỗ trú ẩn gấp!',
                class: 'w-rainy'
            },
            storm: {
                icon: '<i class="fa-solid fa-bolt"></i>',
                title: 'BÃO CẤP 12 GIẬT CẤP 15',
                desc: hasOverdue
                    ? 'CÓ NỢ QUÁ HẠN! Triệu tập cuộc họp gia đình khẩn cấp.'
                    : 'VỠ TRẬN! Chi tiêu đã vượt xa thu nhập.',
                class: 'w-storm'
            }
        };

        const current = content[state];

        box.className = 'weather-widget';
        box.classList.add(current.class);

        box.innerHTML = `
        <div class="weather-icon-box">
            ${current.icon}
        </div>
        <div class="weather-content">
            <div class="weather-title">${current.title}</div>
            <div class="weather-desc">${current.desc}</div>
        </div>
    `;
    },

    renderBudget(totalExpense) {
        const currentMonth = app.data.filter.month;
        const limit = Number(app.data.configs.monthlyLimits?.[currentMonth]) || 0;
        const box = document.getElementById('budget-box');

        if (limit <= 0 || app.data.configs.guestMode) {
            if (box) box.style.display = 'none';
            return;
        }

        box.style.display = 'block';

        const upcomingData = app.logic.getUpcomingDebts();
        const projectedDebt = upcomingData.total;

        const totalUsed = totalExpense + projectedDebt;
        const remain = limit - totalUsed;

        const actualPercent = Math.min(100, (totalExpense / limit) * 100);

        let projectedPercent = (projectedDebt / limit) * 100;
        if (actualPercent + projectedPercent > 100) {
            projectedPercent = 100 - actualPercent;
        }

        const track = document.querySelector('.budget-track');
        track.innerHTML = '';

        const barActual = document.createElement('div');
        barActual.className = 'budget-bar';
        barActual.style.width = `${actualPercent}%`;
        barActual.style.height = '100%';
        barActual.style.float = 'left';
        barActual.style.transition = 'width 0.5s ease';

        const barProjected = document.createElement('div');
        barProjected.style.width = `${projectedPercent}%`;
        barProjected.style.height = '100%';
        barProjected.style.float = 'left';
        barProjected.style.backgroundImage = 'repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)';
        barProjected.style.borderLeft = '1px solid rgba(255,255,255,0.5)';

        track.appendChild(barActual);
        track.appendChild(barProjected);

        // 4. Xử lý Trạng thái & Màu sắc
        const statusEl = document.getElementById('budget-status');
        const remainEl = document.getElementById('budget-remain'); // Element hiển thị số dư

        // Reset màu mặc định trước
        barActual.className = 'budget-bar';
        barActual.style.backgroundColor = ''; // Reset màu inline (để dùng màu mặc định của CSS)
        barProjected.style.backgroundColor = '#cbd5e1'; // Xám nhạt

        if (remain < 0) {
            // --- [FIX] VỠ KẾ HOẠCH (HIỆN MÀU ĐỎ) ---
            barActual.classList.add('budget-overload');

            // [QUAN TRỌNG] Ép cứng màu đỏ cho thanh thực chi để không bị trắng
            barActual.style.backgroundColor = '#ef4444';
            barProjected.style.backgroundColor = '#fca5a5'; // Phần dự chi màu đỏ nhạt hơn

            statusEl.innerHTML = `<span style="color:var(--danger); font-weight:800"><i class="fa-solid fa-bomb"></i> VỠ KẾ HOẠCH!</span>`;

            // Hiển thị số âm (Thâm hụt)
            remainEl.innerHTML = `Thâm hụt: <b style="color:var(--danger)">${app.logic.formatCurrency(Math.abs(remain))}</b>`;

        } else if (remain < 100000) {
            // --- BÁO ĐỘNG ĐỎ ---
            // ... (Giữ nguyên logic cũ các phần dưới) ...
            barActual.classList.add('danger');
            barProjected.style.backgroundColor = '#fdba74';
            statusEl.innerHTML = `<span style="color:var(--danger); font-weight:700">SẮP CẠN VÍ!</span>`;

            remainEl.innerHTML = `Khả dụng: <b style="color:var(--danger)">${app.logic.formatCurrency(remain)}</b>`;

        } else if ((totalUsed / limit) > 0.8) {
            // --- CẢNH BÁO ---
            barActual.classList.add('warning');
            barProjected.style.backgroundColor = '#fde047';
            statusEl.innerHTML = `<span style="color:var(--warning); font-weight:700">Cẩn thận!</span>`;

            remainEl.innerHTML = `Khả dụng: <b style="color:var(--warning)">${app.logic.formatCurrency(remain)}</b>`;

        } else {
            // --- AN TOÀN ---
            barProjected.style.backgroundColor = '#86efac';
            statusEl.innerHTML = `<span style="color:var(--success); font-weight:700">Ổn định</span>`;

            remainEl.innerHTML = `Khả dụng: <b style="color:var(--success)">${app.logic.formatCurrency(remain)}</b>`;
        }

        // 5. Cập nhật Text "Đã tiêu"
        document.getElementById('budget-used').innerHTML = `
            Tiêu: <b>${app.logic.formatCurrency(totalExpense)}</b> 
            ${projectedDebt > 0 ? `<span style="color:var(--text-muted); font-size:0.7rem;">(+${app.logic.formatCurrency(projectedDebt)} nợ)</span>` : ''}
        `;
    },

    init() {
        const geminiKeyInput = document.getElementById('gemini-key');

        if (geminiKeyInput) {
            geminiKeyInput.value =
                app.data.configs.apiKeys?.gemini || '';
        }

        document.getElementById('zalo-review-date').value =
            app.data.configs.zaloReviewDate;

        // Các đoạn code còn lại giữ nguyên
        // 1. Lấy limit của tháng ĐANG CHỌN
        const currentMonth = app.data.filter.month;
        // Thêm ?. để kiểm tra an toàn, tránh lỗi khi object chưa được khởi tạo
        const currentLimit = app.data.configs.monthlyLimits?.[currentMonth] || 0;

        // 2. Điền vào ô input
        document.getElementById('budget-limit').value = currentLimit > 0 ? currentLimit : '';

        // 3. Sự kiện lưu (Dùng .onchange để tránh bị chồng sự kiện khi đổi tháng nhiều lần)
        document.getElementById('budget-limit').onchange = (e) => {
            const val = Number(e.target.value.replace(/[^0-9]/g, ''));
            const monthToSave = app.data.filter.month;

            // Lưu vào đúng tháng đó
            if (!app.data.configs.monthlyLimits) app.data.configs.monthlyLimits = {};
            app.data.configs.monthlyLimits[monthToSave] = val;

            app.storage.save();
            app.ui.renderAll();
        };

        const filterContainer = document.getElementById('calendar-filter');

        const uniqueDates = new Set();
        const now = new Date();

        // --- [FIX] Sửa i = -1 để hiển thị thêm 1 tháng TƯƠNG LAI (Tháng 2) ---
        // i = -1: Tháng sau
        // i = 0: Tháng này
        // i > 0: Quá khứ
        for (let i = -1; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            uniqueDates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        app.data.transactions.forEach(t => {
            if (t.date && t.date.length >= 7) {
                uniqueDates.add(t.date.substring(0, 7));
            }
        });

        // --- [MỚI] LỌC BỎ CÁC THÁNG ĐÃ XÓA KHỎI DANH SÁCH ---
        const deletedPeriods = app.data.configs.deletedPeriods || [];
        const validDates = Array.from(uniqueDates).filter(dateStr => !deletedPeriods.includes(dateStr));

        const groups = {};
        validDates.forEach(dateStr => {
            const [y, m] = dateStr.split('-');
            if (!groups[y]) groups[y] = [];
            if (!groups[y].includes(parseInt(m))) groups[y].push(parseInt(m));
        });

        const sortedYears = Object.keys(groups).sort((a, b) => b - a);

        let html = '';
        const currentYearInView = app.data.filter.month.split('-')[0];

        sortedYears.forEach(year => {
            groups[year].sort((a, b) => b - a);
            const hiddenClass = 'hidden';
            const collapsedClass = 'collapsed-year';

            // --- [MỚI] Kiểm tra xem năm đó có đủ 12 tháng không ---
            const hasFullYear = groups[year].length === 12;
            let deleteYearBtn = '';
            if (hasFullYear) {
                deleteYearBtn = `<i class="fa-solid fa-xmark" style="color: #cbd5e1; transition: 0.2s; padding: 4px 8px; border-radius:4px; margin-right: 8px;" 
                                   onmouseover="this.style.color='#ef4444'; this.style.background='#fee2e2'" 
                                   onmouseout="this.style.color='#cbd5e1'; this.style.background='transparent'"
                                   onclick="event.stopPropagation(); app.ui.deleteYearData('${year}')" 
                                   title="Xóa toàn bộ dữ liệu năm ${year}"></i>`;
            }
            // -------------------------------------------------------

            html += `<div class="year-group">`;
            // Cập nhật style flex cho thẻ year-header để nút X và Chevron nằm ngang hàng
            html += `<div class="year-header ${collapsedClass}" onclick="app.ui.toggleYear('${year}')" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>Năm ${year}</span>
                        <div>
                            ${deleteYearBtn}
                            <i class="fa-solid fa-chevron-down" id="icon-${year}"></i>
                        </div>
                     </div>`;

            html += `<div id="year-months-${year}" class="year-months ${hiddenClass}">`;

            // Giữ nguyên logic hiển thị các tháng bên trong
            groups[year].forEach(month => {
                const mStr = String(month).padStart(2, '0');
                const val = `${year}-${mStr}`;
                const active = val === app.data.filter.month ? 'active' : '';

                html += `<div class="month-item ${active}" onclick="app.ui.setFilter('${val}')" data-mini="T${month}" style="display:flex; justify-content:space-between; align-items:center;">
                            <span>Tháng ${month}</span>
                            <i class="fa-solid fa-xmark" style="color: #cbd5e1; transition: 0.2s; padding: 4px; border-radius:4px;" 
                               onmouseover="this.style.color='#ef4444'; this.style.background='#fee2e2'" 
                               onmouseout="this.style.color='#cbd5e1'; this.style.background='transparent'"
                               onclick="event.stopPropagation(); app.ui.deleteMonthData('${val}')" 
                               title="Xóa toàn bộ dữ liệu tháng này"></i>
                         </div>`;
            });
            html += `</div></div>`;
        });
        filterContainer.innerHTML = html;
    },

    deleteMonthData(monthStr) {
        const [y, m] = monthStr.split('-');
        app.ui.popup.confirm(
            `CẢNH BÁO XÓA THÁNG ${m}/${y}!\n\nBạn có chắc chắn muốn xóa TOÀN BỘ giao dịch và ẨN THÁNG NÀY khỏi danh sách?\nHành động này không thể hoàn tác!`,
            () => {
                const initialLength = app.data.transactions.length;
                app.data.transactions = app.data.transactions.filter(t => !t.date.startsWith(monthStr));

                // --- Xóa cấu hình ngân sách của tháng này ---
                if (app.data.configs.monthlyLimits && app.data.configs.monthlyLimits[monthStr]) {
                    delete app.data.configs.monthlyLimits[monthStr];
                }

                // --- Lưu tháng này vào danh sách bị ẩn (Blacklist) ---
                if (!app.data.configs.deletedPeriods) app.data.configs.deletedPeriods = [];
                if (!app.data.configs.deletedPeriods.includes(monthStr)) {
                    app.data.configs.deletedPeriods.push(monthStr);
                }

                app.storage.save();
                app.ui.popup.show(`Đã xóa hoàn toàn tháng ${m}/${y} và ${initialLength - app.data.transactions.length} giao dịch.`, "success");

                if (app.data.filter.month === monthStr) {
                    const now = new Date();
                    app.data.filter.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                }

                app.ui.init();
                app.ui.renderAll();
            }
        );
    },

    // --- [MỚI] HÀM XÓA DỮ LIỆU THỦ CÔNG 1 NĂM ---
    deleteYearData(year) {
        app.ui.popup.confirm(
            `CẢNH BÁO XÓA NĂM ${year}!\n\nBạn có chắc chắn muốn xóa TOÀN BỘ giao dịch và ẨN NĂM ${year} khỏi danh sách?\nHành động này không thể hoàn tác!`,
            () => {
                const initialLength = app.data.transactions.length;
                app.data.transactions = app.data.transactions.filter(t => !t.date.startsWith(`${year}-`));

                if (!app.data.configs.deletedPeriods) app.data.configs.deletedPeriods = [];

                // --- Đưa toàn bộ 12 tháng của năm đó vào danh sách ẩn ---
                for (let i = 1; i <= 12; i++) {
                    const mStr = `${year}-${String(i).padStart(2, '0')}`;
                    if (!app.data.configs.deletedPeriods.includes(mStr)) {
                        app.data.configs.deletedPeriods.push(mStr);
                    }
                    if (app.data.configs.monthlyLimits && app.data.configs.monthlyLimits[mStr]) {
                        delete app.data.configs.monthlyLimits[mStr];
                    }
                }

                app.storage.save();
                app.ui.popup.show(`Đã xóa hoàn toàn năm ${year} và ${initialLength - app.data.transactions.length} giao dịch.`, "success");

                if (app.data.filter.month.startsWith(`${year}-`)) {
                    const now = new Date();
                    app.data.filter.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                }

                app.ui.init();
                app.ui.renderAll();
            }
        );
    },
    // ---------------------------------------------

    toggleCashbackMode() {
        const isCashback = document.getElementById('tx-is-cashback').checked;
        const labelText = document.getElementById('discount-label-text');
        const iconSpan = document.getElementById('discount-icon-span');

        if (isCashback) {
            labelText.textContent = "Hoàn tiền";
            if (iconSpan) iconSpan.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
        } else {
            labelText.textContent = "Giảm giá"; // SỬA DÒNG NÀY Ở ĐÂY
            if (iconSpan) iconSpan.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
        }
        this.calcDiscount();
    },

    calcDiscount() {
        const amountVal = document.getElementById('tx-amount').value.replace(/[^0-9]/g, '');
        const discountVal = document.getElementById('tx-discount').value.replace(/[^0-9]/g, '');

        const originalPrice = parseFloat(amountVal) || 0;
        const discountInput = parseFloat(discountVal) || 0;
        const hintEl = document.getElementById('discount-hint');
        const isCashback = document.getElementById('tx-is-cashback') && document.getElementById('tx-is-cashback').checked;

        if (originalPrice > 0 && discountInput > 0) {
            let discountMoney = 0;
            let finalPrice = 0;
            let noteText = '';

            if (discountInput <= 100) {
                discountMoney = originalPrice * (discountInput / 100);
                noteText = `${discountInput}%`;
            } else {
                discountMoney = discountInput;
                noteText = new Intl.NumberFormat('vi-VN').format(discountMoney);
            }

            if (isCashback) {
                // Nếu là Hoàn tiền, giá trả thực tế vẫn là Giá Gốc
                finalPrice = originalPrice;
                hintEl.innerHTML = `
                    <div style="display:flex; justify-content:flex-end; align-items:center; gap:6px; font-size:0.8rem; color:var(--text-muted)">
                        <span>Thanh toán: ${new Intl.NumberFormat('vi-VN').format(originalPrice)}</span>
                        <span style="color:var(--primary); font-weight:bold;">(Hoàn: +${noteText})</span>
                    </div>`;
            } else {
                // Nếu là Giảm giá, giá trả thực tế bị trừ đi
                finalPrice = originalPrice - discountMoney;
                hintEl.innerHTML = `
                    <div style="display:flex; justify-content:flex-end; align-items:center; gap:6px; font-size:0.8rem; color:var(--text-muted)">
                        <span style="text-decoration:line-through">${new Intl.NumberFormat('vi-VN').format(originalPrice)}</span>
                        <span style="color:var(--success); font-weight:bold;">- ${noteText}</span>
                    </div>
                    <div style="text-align:right; color:var(--primary); font-weight:900; font-size:1rem; border-top:1px dashed #ccc; margin-top:2px;">
                        = ${new Intl.NumberFormat('vi-VN').format(finalPrice)} đ
                    </div>`;
            }
        } else {
            hintEl.innerHTML = '';
        }
    },

    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('mobile-backdrop');

        if (sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            backdrop.classList.remove('active');
        } else {
            // Khi mở trên mobile, ta bỏ class collapsed của desktop để hiện full nội dung
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('active');
            backdrop.classList.add('active');
        }
    },

    showQuickTransfer(sourceName, currentModalType) {
        let allAccounts = [];

        // Gom TẤT CẢ các nguồn tiền (Bao gồm cả nguồn đang thao tác để có thể chọn làm Đích đến)
        if (app.data.accounts) app.data.accounts.forEach(a => allAccounts.push(a.bankName));
        if (app.data.cashWallets) app.data.cashWallets.forEach(w => allAccounts.push(w.name));
        if (app.data.wallets) app.data.wallets.forEach(w => allAccounts.push(w.walletName));

        // Lọc trùng tên (nếu có)
        allAccounts = [...new Set(allAccounts)];

        // Tạo danh sách Option cho dropdown
        const optionsHtml = allAccounts.map(d => `<option value="${d}">${d}</option>`).join('');

        // Tìm một tài khoản khác làm Đích đến mặc định cho "Chuyển tiền"
        let defaultDest = allAccounts.find(a => a !== sourceName) || 'other';

        const modalId = 'quick-transfer-modal';
        if (document.getElementById(modalId)) document.getElementById(modalId).remove();

        const modalHtml = `
        <div id="${modalId}" class="modal-overlay active" style="z-index: 100050;">
            <div class="modal-box" style="max-width: 400px; border: 3px solid #000; box-shadow: 6px 6px 0px #000;">
                <div class="card-header">
                    <div class="card-title" style="color: #059669;"><i class="fa-solid fa-bolt"></i> Thao Tác Nhanh</div>
                    <button class="btn-ghost" onclick="document.getElementById('${modalId}').remove()" style="border: 2px solid #000;">&times;</button>
                </div>
                <div style="display:flex; flex-direction:column; gap: 1rem;">
                    
                    <div>
                        <label class="form-label">Loại giao dịch</label>
                        <select id="qt-type" class="form-input" style="font-weight:bold; color:var(--primary); border: 2px solid #000;" 
                            onchange="
                                const t = this.value;
                                const note = document.getElementById('qt-note');
                                const tags = document.getElementById('qt-tags');
                                const sourceInput = document.getElementById('qt-source');
                                const destSelect = document.getElementById('qt-dest');
                                const destOtherWrap = document.getElementById('qt-dest-other-wrapper');
                                const btn = document.getElementById('qt-btn-submit');
                                
                                if(t === 'Chuyển tiền') {
                                    note.value = 'Chuyển tiền nội bộ';
                                    tags.value = '#chuyển_tiền';
                                    sourceInput.value = '${sourceName}';
                                    
                                    // Tìm tài khoản khác để làm đích mặc định
                                    const otherOptions = Array.from(destSelect.options).filter(o => o.value !== '${sourceName}' && o.value !== 'other');
                                    destSelect.value = otherOptions.length > 0 ? otherOptions[0].value : 'other';
                                    
                                    destOtherWrap.style.display = destSelect.value === 'other' ? 'block' : 'none';
                                    btn.innerHTML = '<i class=\\'fa-solid fa-paper-plane\\'></i> Chốt Chuyển Khoản';
                                    
                                } else if(t === 'Chi tiêu') {
                                    note.value = 'Chi tiêu từ ${sourceName}';
                                    tags.value = '#chi_tiêu';
                                    sourceInput.value = '${sourceName}';
                                    
                                    destSelect.value = 'other'; // Thường chi tiêu ra ngoài nên để Khác
                                    destOtherWrap.style.display = 'block';
                                    btn.innerHTML = '<i class=\\'fa-solid fa-cart-shopping\\'></i> Chốt Chi Tiêu';
                                    
                                } else if(t === 'Thu nhập') {
                                    note.value = 'Thu nhập vào ${sourceName}';
                                    tags.value = '#thu_nhập';
                                    sourceInput.value = 'Nguồn ngoài'; // Tiền từ ngoài vào (Có thể nhập chữ khác)
                                    
                                    destSelect.value = '${sourceName}'; // Tự đảo Đích Đến thành tài khoản đang mở
                                    destOtherWrap.style.display = 'none';
                                    btn.innerHTML = '<i class=\\'fa-solid fa-sack-dollar\\'></i> Chốt Thu Nhập';
                                }
                            ">
                            <option value="Chuyển tiền">Chuyển tiền</option>
                            <option value="Chi tiêu">Chi tiêu</option>
                            <option value="Thu nhập">Thu nhập</option>
                        </select>
                    </div>

                    <div>
                        <label class="form-label">Từ (Nguồn trừ tiền)</label>
                        <input type="text" id="qt-source" class="form-input" value="${sourceName}" style="border: 2px solid #000;">
                    </div>
                    
                    <div id="qt-dest-wrapper">
                        <div>
                            <label class="form-label">Đến (Nơi nhận tiền)</label>
                            <select id="qt-dest" class="form-input" style="font-weight:bold; color:var(--primary); border: 2px solid #000;" 
                                    onchange="document.getElementById('qt-dest-other-wrapper').style.display = this.value === 'other' ? 'block' : 'none'">
                                ${optionsHtml}
                                <option value="other">Khác (Nhập tay)...</option>
                            </select>
                        </div>
                        
                        <div id="qt-dest-other-wrapper" style="display: ${defaultDest === 'other' ? 'block' : 'none'}; margin-top:1rem;">
                            <input type="text" id="qt-dest-other" class="form-input" placeholder="Nhập tên người/nơi nhận..." style="border: 2px solid #000;">
                        </div>
                    </div>

                    <div>
                        <label class="form-label">Số tiền</label>
                        <input type="text" id="qt-amount" class="form-input" placeholder="0" style="font-size: 1.5rem; font-weight: 900; color: #059669; border: 2px solid #000;" 
                            onkeyup="let v = this.value.replace(/[^0-9]/g,''); this.value = v ? new Intl.NumberFormat('vi-VN').format(v) : '';">
                    </div>
                    <div>
                        <label class="form-label">Nội dung</label>
                        <input type="text" id="qt-note" class="form-input" value="Chuyển tiền nội bộ" style="border: 2px solid #000;">
                    </div>
                    <div>
                        <label class="form-label">Thẻ (Tags)</label>
                        <input type="text" id="qt-tags" class="form-input" value="#chuyển_tiền" style="border: 2px solid #000;">
                    </div>
                    <button id="qt-btn-submit" class="btn btn-primary" style="justify-content:center; margin-top:0.5rem; background: #059669; border: 2px solid #000; box-shadow: 4px 4px 0px #000;">
                        <i class="fa-solid fa-paper-plane"></i> Chốt Chuyển Khoản
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Đặt giá trị mặc định cho Đích đến khi vừa mở Popup lên
        document.getElementById('qt-dest').value = defaultDest;

        document.getElementById('qt-btn-submit').onclick = () => {
            const type = document.getElementById('qt-type').value;

            // Lấy thông tin Nguồn - Đích thực tế từ các ô nhập liệu
            let finalSource = document.getElementById('qt-source').value.trim();
            let destSelectVal = document.getElementById('qt-dest').value;
            let finalDest = destSelectVal;

            if (destSelectVal === 'other') {
                finalDest = document.getElementById('qt-dest-other').value.trim();
                if (!finalDest) return app.ui.popup.show("Vui lòng nhập nơi nhận tiền!", "error");
            }

            if (!finalSource) return app.ui.popup.show("Vui lòng nhập nguồn tiền!", "error");

            let isBlocked = false;
            let blockedBankName = "";

            if (app.data.accounts) {
                const lowerSource = finalSource.toLowerCase().trim();
                const lowerDest = finalDest.toLowerCase().trim();

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
                return app.ui.popup.show(`⛔ LỖI: Thẻ <b>${blockedBankName}</b> đang bị khóa. Thao tác thất bại!`, "error");
            }

            const amountStr = document.getElementById('qt-amount').value.replace(/[^0-9]/g, '');
            const amount = Number(amountStr);
            const note = document.getElementById('qt-note').value;
            const tags = document.getElementById('qt-tags').value;

            if (!amount || amount <= 0) return app.ui.popup.show("Vui lòng nhập số tiền hợp lệ!", "error");

            let placeDesc = note || `Giao dịch ${type}`;

            // Lưu vào Database chuẩn xác để biểu đồ không bị lệch
            app.data.transactions.push({
                id: Date.now(),
                type: type,
                place: placeDesc,
                source: finalSource,
                destination: finalDest,
                amount: amount,
                date: new Date().toISOString(),
                tags: tags,
                status: 'paid'
            });

            app.storage.save();
            document.getElementById(modalId).remove();
            app.ui.popup.show(`✅ Đã ghi nhận ${type} thành công!`, "success");

            app.ui.renderAll();

            // Cập nhật lại màn hình con (nếu đang mở)
            if (currentModalType === 'bank') {
                const bank = app.data.accounts.find(a => a.bankName === sourceName);
                if (bank) app.ui.modals.banks.openDetail(bank.id);
            } else if (currentModalType === 'cash') {
                const cash = app.data.cashWallets.find(w => w.name === sourceName);
                if (cash) app.ui.modals.cash.openDetail(cash.id);
            }
        };
    },

    toggleYear(year) {
        const container = document.getElementById(`year-months-${year}`);
        const icon = document.getElementById(`icon-${year}`);
        const header = icon.parentElement;
        container.classList.toggle('hidden');
        header.classList.toggle('collapsed-year');
    },

    updateNewsTicker() {
        const txs = app.logic.getFilteredTxs();
        const newsBar = document.getElementById('news-ticker');

        // Nếu chưa có element con, tạo lại cấu trúc mới 1 lần
        if (!newsBar.querySelector('.news-label-box')) {
            newsBar.innerHTML = `
            <div class="news-label-box">
                <div class="news-label-text">
                    <span class="news-live-dot"></span>
                    <span id="news-label-title">TIN NÓNG</span>
                </div>
            </div>
            <div class="news-content-wrapper">
                <div class="news-content" id="news-text"></div>
            </div>
            <style>
                .t-transfer { background: #e0f2fe; color: #0369a1; border-bottom: 2px solid #38bdf8; }
                .t-transfer .news-label-box { background: #0284c7; }
                .t-transfer .news-label-text { color: white; }
            </style>
        `;
        }

        const newsEl = document.getElementById('news-text');
        const labelTitle = document.getElementById('news-label-title');

        // Reset class màu cũ
        newsBar.classList.remove('t-income', 't-expense', 't-debt', 't-plan', 't-transfer');

        // Nếu chưa có giao dịch nào
        if (txs.length === 0) {
            newsEl.textContent = "💤 THỊ TRƯỜNG ĐÓNG BĂNG: Chưa có giao dịch nào được ghi nhận. Các nhà đầu tư đang quan sát thêm...";
            newsBar.classList.add('t-plan'); // Màu tím mặc định
            return;
        }

        // Lấy giao dịch mới nhất
        const lastTx = txs.sort((a, b) => b.id - a.id)[0];
        const amountStr = app.logic.formatCurrency(lastTx.amount);

        // --- THƯ VIỆN TIN TỨC ---
        const contentLibrary = {
            income_paid: [
                "🔴 TRỰC TIẾP: Gói 'kích cầu' kinh tế vừa được bơm vào tài khoản.",
                "⚡ TIN NÓNG: Chỉ số GDP cá nhân tăng vọt sau cú chuyển khoản lịch sử.",
                "📢 CẬP NHẬT: Ngân khố quốc gia vừa ghi nhận dòng vốn FDI chảy mạnh.",
                "📈 THỊ TRƯỜNG HƯNG PHẤN: Sắc xanh bao trùm ví tiền sau đợt giải ngân mới.",
                "💰 KINH TẾ VĨ MÔ: Cán cân thanh toán thặng dư đột biến.",
                "💎 TÀI CHÍNH SỐ: Số dư khả dụng vừa thiết lập đỉnh mới trong tháng.",
                "🚀 BREAKING NEWS: Cứu trợ khẩn cấp đã về! Mì tôm tạm thời bị loại khỏi thực đơn.",
                "👑 POVL: Cảm giác của người giàu (trong 5 phút) sau khi nhận tiền."
            ],
            income_plan: [
                "🌤️ DỰ BÁO: Có khả năng mưa tiền rải rác vào cuối ngày.",
                "🔮 NHẬN ĐỊNH: 'Nếu không bị bùng, tiền chắc chắn sẽ về'.",
                "⏳ ĐẾM NGƯỢC: Cả hệ thống đang nín thở chờ đợi giao dịch này khớp lệnh.",
                "🔭 TẦM NHÌN: Khoản thu này sẽ là cứu cánh cho những ngày cuối tháng."
            ],
            expense_paid: [
                "🔥 TIN KHẨN: Một vụ 'cháy ví' quy mô lớn vừa xảy ra.",
                "📉 CHỨNG KHOÁN ĐỎ LỬA: Chỉ số VN-Wallet lao dốc không phanh.",
                "🌪️ THIÊN TAI: Cơn bão chi tiêu vừa quét qua, để lại hậu quả nặng nề.",
                "🛑 LẠM PHÁT: Giá trị đồng tiền sụt giảm nghiêm trọng sau giao dịch này.",
                "🚑 CẤP CỨU: Ví tiền đang trong tình trạng nguy kịch, cần thở oxy gấp.",
                "💀 GÓC NHÌN: 'Tiền không tự sinh ra, nó chỉ chuyển sang túi chủ quán'."
            ],
            expense_debt: [
                "💣 BOM NỢ HẸN GIỜ: Kích hoạt thành công khối nợ mới.",
                "🏦 TIN TÍN DỤNG: Các tổ chức xếp hạng tín nhiệm đang hạ bậc uy tín của bạn.",
                "🆘 SOS: Áp lực trả nợ đang đè nặng lên vai người lao động chính.",
                "🏴‍☠️ GÓC KHUẤT: Bạn vừa bán linh hồn cho tư bản.",
                "🧛 MA CÀ RỒNG: Lãi mẹ đẻ lãi con đang âm thầm hút máu tài khoản."
            ],
            expense_plan: [
                "📝 DỰ THẢO: Quốc hội (Vợ/Mẹ) đang xem xét phê duyệt khoản chi này.",
                "🧐 RỦI RO: 'Liệu đây là đầu tư hay là ném tiền qua cửa sổ?'.",
                "💣 KẾ HOẠCH TÁO BẠO: Một âm mưu làm nghèo bản thân đang được ấp ủ."
            ],
            // [MỚI] Thư viện tin tức cho Chuyển tiền
            transfer: [
                "🔄 LUÂN CHUYỂN: Thực hiện nghiệp vụ điều phối dòng tiền nội bộ.",
                "🚚 LOGISTICS: Tiền đang được vận chuyển an toàn sang nơi trú ẩn mới.",
                "⚖️ CÂN ĐỐI: 'Tiền không tự sinh ra hay mất đi, chỉ chuyển từ túi trái sang túi phải'.",
                "🌊 DÒNG CHẢY: Ghi nhận sự dịch chuyển của dòng vốn, tổng tài sản không đổi.",
                "🏦 NGHIỆP VỤ: Đang thực hiện tái cơ cấu danh mục đầu tư giữa các ví.",
                "👀 GÓC NHÌN: Chỉ là đổi chỗ nằm cho tiền đỡ mỏi lưng thôi mà."
            ]
        };

        let newsContent = "";
        let themeClass = "";
        let labelText = "TIN MỚI";

        // --- LOGIC CHỌN NỘI DUNG & MÀU SẮC ---

        // 1. Xử lý Chuyển tiền [MỚI]
        if (lastTx.type === 'Chuyển tiền') {
            const drama = contentLibrary.transfer[Math.floor(Math.random() * contentLibrary.transfer.length)];
            const destText = lastTx.destination ? ` ➔ ${lastTx.destination}` : '';
            newsContent = `[ĐIỀU PHỐI] ${lastTx.source}${destText}: ${amountStr}. ${drama}`;
            themeClass = 't-transfer'; // Class màu xanh dương (đã inject CSS ở trên)
            labelText = "GIAO DỊCH";
        }
        // 2. Xử lý Thu nhập
        else if (lastTx.type === 'Thu nhập') {
            if (lastTx.status === 'planned' || lastTx.status === 'pending') {
                const drama = contentLibrary.income_plan[Math.floor(Math.random() * contentLibrary.income_plan.length)];
                newsContent = `[KỲ VỌNG] ${lastTx.place}: ${amountStr}. ${drama}`;
                themeClass = 't-plan';
                labelText = "DỰ BÁO";
            } else {
                const drama = contentLibrary.income_paid[Math.floor(Math.random() * contentLibrary.income_paid.length)];
                newsContent = `[GIẢI NGÂN] ${lastTx.source} +${amountStr} (${lastTx.place}). ${drama}`;
                themeClass = 't-income';
                labelText = "THU NHẬP";
            }
        }
        // 3. Xử lý Chi tiêu
        else {
            if (lastTx.status === 'planned') {
                const drama = contentLibrary.expense_plan[Math.floor(Math.random() * contentLibrary.expense_plan.length)];
                newsContent = `[DỰ THẢO CHI] ${lastTx.place}: ${amountStr}. ${drama}`;
                themeClass = 't-plan';
                labelText = "DỰ CHI";
            } else if (lastTx.status === 'pending') {
                const drama = contentLibrary.expense_debt[Math.floor(Math.random() * contentLibrary.expense_debt.length)];
                newsContent = `[BÁO ĐỘNG NỢ] ${lastTx.place}: -${amountStr} (${lastTx.source}). ${drama}`;
                themeClass = 't-debt';
                labelText = "CẢNH BÁO";
            } else {
                const drama = contentLibrary.expense_paid[Math.floor(Math.random() * contentLibrary.expense_paid.length)];
                newsContent = `[KHỚP LỆNH] ${lastTx.place}: -${amountStr}. ${drama}`;
                themeClass = 't-expense';
                labelText = "CHI TIÊU";
            }
        }

        // Áp dụng class và text
        newsBar.classList.add(themeClass);
        labelTitle.textContent = labelText;

        // Marquee loop (lặp lại để chạy liên tục)
        const spacer = "  ✦✦✦  ";
        newsEl.textContent = `${newsContent}${spacer}${newsContent}${spacer}${newsContent}`;
    },

    setFilter(month) {
        app.data.filter.month = month;
        app.logic.updateFees();
        app.ui.init();
        app.ui.renderAll();
    },

    renderZaloWidget() {
        const retentionInfo = app.logic.getZaloRetentionState();
        const rankInfo = retentionInfo.currentRank;
        const accumulated = retentionInfo.totalAccumulated;

        // --- A. CẬP NHẬT WIDGET SIDEBAR (Giữ nguyên logic cũ cho Sidebar) ---
        const widgetCard = document.getElementById('zalo-widget-card');
        if (widgetCard) {
            // ... (Code cũ của bạn cho sidebar giữ nguyên, hoặc copy lại đoạn logic sidebar từ file cũ nếu cần)
            // Nếu bạn muốn đồng bộ cả sidebar thì báo mình, còn đây mình tập trung vào Modal như yêu cầu.
            const rankNameEl = document.getElementById('zalo-rank-name');
            const moneyEl = document.getElementById('zalo-accumulated');
            const progressEl = document.getElementById('zalo-progress');
            const statusTextEl = document.getElementById('zalo-status-text');
            const targetEl = document.getElementById('zalo-target');

            widgetCard.className = 'zalo-widget';
            if (rankInfo.id !== 'member') widgetCard.classList.add(`rank-${rankInfo.id}`);

            rankNameEl.textContent = rankInfo.name;
            moneyEl.textContent = app.logic.formatCurrency(accumulated);

            let missingForNext = 0;
            if (rankInfo.next) {
                missingForNext = Math.max(0, rankInfo.next - accumulated);
                const percent = Math.min(100, (accumulated / rankInfo.next) * 100);
                progressEl.style.width = `${percent}%`;
                targetEl.textContent = `Đích: ${app.logic.formatCurrency(rankInfo.next)}`;
            } else {
                progressEl.style.width = '100%';
                targetEl.textContent = 'MAX';
            }

            if (retentionInfo.status === 'drop') {
                statusTextEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Thiếu ${app.logic.formatCurrency(retentionInfo.missing)}`;
            } else if (rankInfo.next) {
                statusTextEl.innerHTML = `Lên hạng: Còn ${Math.round(100 - (accumulated / rankInfo.next) * 100)}%`;
            } else {
                statusTextEl.innerHTML = `Đỉnh cao!`;
            }
        }

        // --- B. CẬP NHẬT MODAL POPUP (PHẦN QUAN TRỌNG) ---

        // 1. Cập nhật Thẻ cứng (Pop Card)
        const popCard = document.getElementById('zalo-pop-card');
        if (popCard) {
            // Set data-rank để CSS đổi màu
            popCard.setAttribute('data-rank', rankInfo.id);

            document.getElementById('zalo-modal-badge').textContent = rankInfo.name;
            document.getElementById('zalo-modal-accumulated').textContent = app.logic.formatCurrency(accumulated);

            // Cập nhật phí
            const feeEl = document.getElementById('zalo-modal-fee');
            feeEl.textContent = rankInfo.fee === 0 ? 'Miễn phí DV' : `Phí: ${app.logic.formatCurrency(rankInfo.fee)}`;
            feeEl.style.background = rankInfo.fee === 0 ? '#10b981' : '#000'; // Xanh nếu free, Đen nếu mất phí

            // Footer thẻ
            const reviewDate = new Date(app.data.configs.zaloReviewDate);
            document.getElementById('forecast-date').textContent = `${reviewDate.getDate()}/${reviewDate.getMonth() + 1}`;
            document.getElementById('forecast-next-rank').textContent = retentionInfo.projectedRank.name;
        }

        // 2. Logic tính toán chi tiêu tháng (Giữ nguyên logic cũ)
        const month = app.data.filter.month;
        const isCreditZalo = (source) => {
            const s = source.toLowerCase();
            return s.includes('zalo') && (s.includes('trả sau') || s.includes('priority') || s.includes('paylater'));
        };
        const zaloTxs = app.data.transactions.filter(t => {
            const tags = t.tags || '';
            return t.type === 'Chi tiêu' &&
                t.date.startsWith(month) &&
                isCreditZalo(t.source) &&
                !tags.includes('#phi_dich_vu') &&
                !tags.includes('#thanh_toan_no') &&
                !tags.includes('#du_no_chuyen_tiep') &&
                !tags.includes('#tat_toan_vay') &&
                !tags.includes('#nop_phat') &&
                t.status !== 'cancelled';
        });

        const totalZaloSpend = zaloTxs.reduce((sum, t) => sum + t.amount, 0);
        const spendingThreshold = 2500000;
        const missingForDiscount = Math.max(0, spendingThreshold - totalZaloSpend);
        const progressPercent = Math.min(100, (totalZaloSpend / spendingThreshold) * 100);
        const isQualified = totalZaloSpend >= spendingThreshold;

        // 3. Render HTML mới cho phần Status & List
        const forecastMsg = document.getElementById('forecast-status-msg');

        // Status box (Cảnh báo rớt hạng)
        let alertHtml = '';
        if (retentionInfo.status === 'drop') {
            alertHtml = `
        <div style="background:#fee2e2; border:2px solid #ef4444; border-radius:12px; padding:10px; margin-bottom:1.5rem; display:flex; gap:10px; align-items:center;">
            <div style="font-size:1.5rem; color:#dc2626;"><i class="fa-solid fa-circle-exclamation"></i></div>
            <div>
                <div style="font-weight:800; color:#b91c1c; text-transform:uppercase; font-size:0.8rem;">Nguy cơ rớt hạng</div>
                <div style="font-size:0.9rem; color:#7f1d1d;">Thiếu <b>${app.logic.formatCurrency(retentionInfo.missing)}</b> để giữ hạng.</div>
            </div>
        </div>`;
        }

        // Spending Box (Khung chi tiêu)
        let listHtml = '';
        if (zaloTxs.length > 0) {
            zaloTxs.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
                listHtml += `
            <div class="z-item">
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:700; font-size:0.9rem;">${t.place}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);"><i class="fa-regular fa-clock"></i> ${new Date(t.date).getDate()}/${new Date(t.date).getMonth() + 1}</span>
                </div>
                <span style="font-weight:800;">${app.logic.formatCurrency(t.amount)}</span>
            </div>`;
            });
        } else {
            listHtml = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-style:italic;">Chưa có giao dịch tháng này.</div>`;
        }

        const spendingBoxHtml = `
    <div class="zalo-spending-box">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:900; font-size:1rem; text-transform:uppercase;">
                <i class="fa-solid fa-cart-shopping"></i> Chi tiêu T${month.split('-')[1]}
            </div>
            <div style="font-weight:900; color:var(--primary); font-size:1.1rem;">
                ${app.logic.formatCurrency(totalZaloSpend)}
            </div>
        </div>

        <div class="spending-progress-track">
            <div class="spending-progress-bar" style="width: ${progressPercent}%;"></div>
        </div>
        
        <div style="font-size:0.8rem; margin-bottom:1rem; display:flex; justify-content:space-between; font-weight:700;">
            <span>Mục tiêu giảm phí (2.5tr)</span>
            <span style="color:${isQualified ? '#16a34a' : '#ea580c'}">
                ${isQualified ? 'ĐÃ ĐẠT!' : `Thiếu ${app.logic.formatCurrency(missingForDiscount)}`}
            </span>
        </div>

        <div style="max-height: 200px; overflow-y: auto; padding-right:5px;">
            ${listHtml}
        </div>
    </div>`;

        forecastMsg.innerHTML = alertHtml + spendingBoxHtml;
    },

    // --- THÊM MỚI: Hàm bật/tắt loại trừ khỏi ngân sách ---
    toggleBudgetExclusion(id) {
        const tx = app.data.transactions.find(t => t.id === id);
        if (tx) {
            // Đảo ngược trạng thái (true -> false, false -> true)
            tx.excludeFromBudget = !tx.excludeFromBudget;
            app.storage.save();

            // Render lại cả màn hình chính và modal
            app.ui.renderAll();
            app.ui.modals.budget.open(); // Vẽ lại list trong modal để thấy thay đổi ngay
        }
    },

    showUpcomingCreditGroupDetails(encodedGroupKey) {
        let groupKey = String(encodedGroupKey || '');

        try {
            groupKey = decodeURIComponent(groupKey);
        } catch (e) {
            console.warn(
                'Không thể giải mã groupKey:',
                e
            );
        }

        const item = app.logic
            .getUpcomingDebts()
            .items
            .find(current =>
                current.isCreditGroup === true &&
                current.groupKey === groupKey
            );

        if (!item) {
            app.ui.popup.show(
                'Không tìm thấy thông tin kỳ sao kê này.',
                'info'
            );

            return;
        }

        const escapeHTML = value => {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const formatDate = value => {
            if (!value) return 'Không rõ ngày';

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return escapeHTML(value);
            }

            return date.toLocaleDateString('vi-VN');
        };

        // ==============================
        // GIAO DỊCH TÍN DỤNG THƯỜNG
        // ==============================
        const regularTxs = (
            Array.isArray(item.txIds)
                ? item.txIds
                : []
        )
            .map(id =>
                app.data.transactions.find(tx =>
                    String(tx.id) === String(id)
                )
            )
            .filter(Boolean)
            .sort(
                (a, b) =>
                    new Date(a.date) -
                    new Date(b.date)
            );

        const regularHTML = regularTxs
            .map((tx, index) => {
                const title =
                    tx.place ||
                    tx.brand ||
                    `Giao dịch ${index + 1}`;

                const source =
                    tx.source || 'Không rõ nguồn';

                return `
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:12px;
                    padding:10px;
                    margin-bottom:8px;
                    background:#f8fafc;
                    border:1px solid #e2e8f0;
                    border-radius:10px;
                ">
                    <div style="
                        min-width:0;
                        flex:1;
                    ">
                        <div style="
                            font-weight:800;
                            color:#334155;
                            word-break:break-word;
                        ">
                            ${index + 1}. ${escapeHTML(title)}
                        </div>

                        <div style="
                            margin-top:3px;
                            font-size:0.72rem;
                            color:#64748b;
                        ">
                            <i class="fa-regular fa-calendar"></i>
                            ${formatDate(tx.date)}

                            <span style="margin:0 4px;">•</span>

                            ${escapeHTML(source)}
                        </div>
                    </div>

                    <div style="
                        white-space:nowrap;
                        font-weight:900;
                        color:#ea580c;
                    ">
                        ${app.logic.formatCurrency(
                    Number(tx.amount) || 0
                )}
                    </div>
                </div>
            `;
            })
            .join('');

        // ==============================
        // CÁC KỲ TRẢ GÓP
        // ==============================
        const installmentEntries = (
            Array.isArray(item.installmentRefs)
                ? item.installmentRefs
                : []
        )
            .map(ref => {
                const plan =
                    app.data.installmentPlans?.[
                    ref.planId
                    ];

                if (
                    !plan ||
                    !Array.isArray(plan.payments)
                ) {
                    return null;
                }

                const payment =
                    plan.payments.find(current =>
                        current.date ===
                        ref.paymentDate
                    );

                if (!payment) return null;

                const totalDue =
                    (Number(payment.amount) || 0) +
                    (Number(payment.penaltyAmt) || 0);

                const paidAmount =
                    Number(payment.paidAmount) || 0;

                const remaining = Math.max(
                    0,
                    totalDue - paidAmount
                );

                const installmentIndex =
                    plan.payments.indexOf(payment) + 1;

                const totalInstallments =
                    plan.payments.length;

                const originalOrderCount =
                    Array.isArray(plan.originalTxIds)
                        ? plan.originalTxIds.length
                        : 0;

                const baseAmount =
                    Number(
                        payment.breakdown?.base
                    ) || 0;

                const conversionFee =
                    Number(
                        payment.breakdown
                            ?.conversionFee
                    ) || 0;

                const extraFee =
                    Number(
                        payment.breakdown?.extra
                    ) || 0;

                const periodParts =
                    String(payment.date || '')
                        .split('-');

                const periodText =
                    periodParts.length === 2
                        ? `${periodParts[1]}/${periodParts[0]}`
                        : payment.date || 'Không rõ';

                return {
                    plan,
                    payment,
                    remaining,
                    installmentIndex,
                    totalInstallments,
                    originalOrderCount,
                    baseAmount,
                    conversionFee,
                    extraFee,
                    periodText
                };
            })
            .filter(Boolean);

        const installmentHTML =
            installmentEntries
                .map((entry, index) => {
                    const feeTotal =
                        entry.conversionFee +
                        entry.extraFee;

                    return `
                    <div style="
                        padding:11px;
                        margin-bottom:8px;
                        background:#fff7ed;
                        border:1px solid #fed7aa;
                        border-left:4px solid #f97316;
                        border-radius:10px;
                    ">
                        <div style="
                            display:flex;
                            justify-content:space-between;
                            align-items:flex-start;
                            gap:12px;
                        ">
                            <div style="
                                min-width:0;
                                flex:1;
                            ">
                                <div style="
                                    font-weight:850;
                                    color:#9a3412;
                                    word-break:break-word;
                                ">
                                    ${index + 1}.
                                    ${escapeHTML(
                        entry.plan.source ||
                        'Gói trả góp'
                    )}
                                </div>

                                <div style="
                                    margin-top:4px;
                                    font-size:0.72rem;
                                    color:#78716c;
                                ">
                                    Kỳ
                                    ${entry.installmentIndex}/${entry.totalInstallments
                        }

                                    <span style="margin:0 4px;">
                                        •
                                    </span>

                                    Sao kê
                                    ${escapeHTML(
                            entry.periodText
                        )}

                                    ${entry.originalOrderCount > 0
                            ? `
                                            <span style="margin:0 4px;">
                                                •
                                            </span>

                                            Gồm
                                            ${entry.originalOrderCount}
                                            đơn
                                            `
                            : ''
                        }
                                </div>
                            </div>

                            <div style="
                                white-space:nowrap;
                                font-weight:900;
                                color:#ea580c;
                            ">
                                ${app.logic.formatCurrency(
                            entry.remaining
                        )}
                            </div>
                        </div>

                        ${entry.baseAmount > 0 ||
                            feeTotal > 0
                            ? `
                                <div style="
                                    display:flex;
                                    gap:12px;
                                    flex-wrap:wrap;
                                    margin-top:7px;
                                    padding-top:7px;
                                    border-top:1px dashed #fdba74;
                                    font-size:0.7rem;
                                    color:#78716c;
                                ">
                                    ${entry.baseAmount > 0
                                ? `
                                            <span>
                                                Gốc:
                                                <b>
                                                    ${app.logic.formatCurrency(
                                    entry.baseAmount
                                )}
                                                </b>
                                            </span>
                                            `
                                : ''
                            }

                                    ${feeTotal > 0
                                ? `
                                            <span>
                                                Phí:
                                                <b style="color:#dc2626">
                                                    ${app.logic.formatCurrency(
                                    feeTotal
                                )}
                                                </b>
                                            </span>
                                            `
                                : ''
                            }
                                </div>
                                `
                            : ''
                        }
                    </div>
                `;
                })
                .join('');

        const totalAmount =
            (Number(item.amount) || 0) +
            (Number(item.penalty) || 0);

        const contentHTML = `
        <div style="
            text-align:left;
            max-height:65vh;
            overflow-y:auto;
            padding-right:4px;
        ">
            <div style="
                padding:12px;
                margin-bottom:12px;
                background:linear-gradient(
                    135deg,
                    #fff7ed,
                    #ffedd5
                );
                border:1px solid #fdba74;
                border-radius:12px;
            ">
                <div style="
                    font-size:1rem;
                    font-weight:900;
                    color:#9a3412;
                ">
                    ${escapeHTML(item.name)}
                </div>

                <div style="
                    margin-top:4px;
                    font-size:0.75rem;
                    color:#78716c;
                ">
                    ${escapeHTML(
            item.statementLabel ||
            'Kỳ sao kê'
        )}

                    <span style="margin:0 4px;">
                        •
                    </span>

                    Hạn ${escapeHTML(item.date || '')}
                </div>

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-top:10px;
                    padding-top:10px;
                    border-top:1px dashed #fdba74;
                ">
                    <span style="
                        font-size:0.78rem;
                        color:#7c2d12;
                    ">
                        Tổng cần trả
                    </span>

                    <span style="
                        font-size:1.15rem;
                        font-weight:950;
                        color:#ea580c;
                    ">
                        ${app.logic.formatCurrency(
            totalAmount
        )}
                    </span>
                </div>

                ${Number(item.penalty) > 0
                ? `
                        <div style="
                            margin-top:5px;
                            text-align:right;
                            font-size:0.7rem;
                            color:#dc2626;
                            font-weight:700;
                        ">
                            Bao gồm phạt:
                            ${app.logic.formatCurrency(
                    Number(item.penalty)
                )}
                        </div>
                        `
                : ''
            }
            </div>

            ${regularTxs.length > 0
                ? `
                    <div style="
                        margin-bottom:14px;
                    ">
                        <div style="
                            margin-bottom:7px;
                            font-size:0.78rem;
                            font-weight:900;
                            color:#475569;
                            text-transform:uppercase;
                        ">
                            <i class="fa-solid fa-receipt"></i>
                            Giao dịch tín dụng
                            (${regularTxs.length})
                        </div>

                        ${regularHTML}
                    </div>
                    `
                : ''
            }

            ${installmentEntries.length > 0
                ? `
                    <div>
                        <div style="
                            margin-bottom:7px;
                            font-size:0.78rem;
                            font-weight:900;
                            color:#c2410c;
                            text-transform:uppercase;
                        ">
                            <i class="fa-solid fa-layer-group"></i>
                            Các khoản trả góp
                            (${installmentEntries.length})
                        </div>

                        ${installmentHTML}
                    </div>
                    `
                : ''
            }

            ${regularTxs.length === 0 &&
                installmentEntries.length === 0
                ? `
                    <div style="
                        padding:20px;
                        text-align:center;
                        color:#94a3b8;
                        font-style:italic;
                    ">
                        Không tìm thấy khoản chi tiết.
                    </div>
                    `
                : ''
            }
        </div>
    `;

        // Bật giao diện rộng riêng cho popup chi tiết sao kê
        app.ui.popup.el.classList.add(
            'credit-detail-popup'
        );

        app.ui.popup.show(
            contentHTML,
            'info'
        );

        if (app.ui.popup.title) {
            app.ui.popup.title.textContent =
                'Chi tiết kỳ sao kê';
        }
    },

    // -----------------------------------------------------
    payUpcomingCreditGroup(encodedGroupKey) {
        let groupKey = encodedGroupKey;

        try {
            groupKey = decodeURIComponent(
                encodedGroupKey
            );
        } catch (e) {
            console.warn(
                'Không thể giải mã nhóm tín dụng:',
                e
            );
        }

        const getFreshGroup = () => {
            return app.logic
                .getUpcomingDebts()
                .items
                .find(item =>
                    item.isCreditGroup === true &&
                    item.groupKey === groupKey
                );
        };

        const getGroupCounts = item => {
            const transactionCount =
                Array.isArray(item?.txIds)
                    ? item.txIds.length
                    : 0;

            const installmentCount =
                Array.isArray(item?.installmentRefs)
                    ? item.installmentRefs.length
                    : 0;

            return {
                transactionCount,
                installmentCount,
                totalCount:
                    transactionCount +
                    installmentCount
            };
        };

        const item = getFreshGroup();
        const firstCounts = getGroupCounts(item);

        if (
            !item ||
            firstCounts.totalCount === 0
        ) {
            app.ui.popup.show(
                'Không tìm thấy nhóm tín dụng hoặc nhóm này đã được thanh toán.',
                'info'
            );

            return;
        }

        const totalPay =
            (Number(item.amount) || 0) +
            (Number(item.penalty) || 0);

        const countText = [
            firstCounts.transactionCount > 0
                ? `${firstCounts.transactionCount} giao dịch`
                : '',

            firstCounts.installmentCount > 0
                ? `${firstCounts.installmentCount} kỳ trả góp`
                : ''
        ]
            .filter(Boolean)
            .join(' + ');

        app.ui.popup.confirm(
            `Trả hết <b>${item.name}</b> – ` +
            `${item.statementLabel || 'kỳ sao kê'}?` +
            `<br><br>` +

            `<b>${app.logic.formatCurrency(
                totalPay
            )}</b> cho ${countText}.<br>` +

            `<span style="
            font-size:0.8rem;
            color:var(--text-muted)
        ">` +
            `Toàn bộ giao dịch và kỳ trả góp trong nhóm sẽ được đánh dấu đã trả.` +
            `</span>`,

            () => {
                /*
                 * Đọc lại dữ liệu để tránh trường hợp
                 * người dùng vừa thay đổi khoản nợ.
                 */
                const freshItem = getFreshGroup();

                if (!freshItem) {
                    app.ui.popup.show(
                        'Nhóm tín dụng đã thay đổi hoặc đã được thanh toán.',
                        'info'
                    );

                    return;
                }

                /*
                 * Các giao dịch tín dụng thường.
                 */
                const idSet = new Set(
                    (
                        Array.isArray(
                            freshItem.txIds
                        )
                            ? freshItem.txIds
                            : []
                    ).map(id => String(id))
                );

                const pendingTxs =
                    app.data.transactions.filter(t =>
                        t.status === 'pending' &&
                        idSet.has(String(t.id))
                    );

                /*
                 * Các kỳ trả góp nằm trong cùng
                 * kỳ sao kê.
                 */
                const pendingInstallments = [];

                (
                    Array.isArray(
                        freshItem.installmentRefs
                    )
                        ? freshItem.installmentRefs
                        : []
                ).forEach(ref => {
                    const plan =
                        app.data.installmentPlans?.[
                        ref.planId
                        ];

                    if (
                        !plan ||
                        !Array.isArray(plan.payments)
                    ) {
                        return;
                    }

                    const payment =
                        plan.payments.find(p =>
                            p.date ===
                            ref.paymentDate
                        );

                    if (
                        !payment ||
                        payment.paid
                    ) {
                        return;
                    }

                    const totalDue =
                        (Number(payment.amount) || 0) +
                        (
                            Number(
                                payment.penaltyAmt
                            ) || 0
                        );

                    const paidAmount =
                        Number(
                            payment.paidAmount
                        ) || 0;

                    const remaining = Math.max(
                        0,
                        totalDue - paidAmount
                    );

                    if (remaining > 0) {
                        pendingInstallments.push({
                            plan,
                            payment,
                            ref,
                            totalDue,
                            remaining
                        });
                    }
                });

                if (
                    pendingTxs.length === 0 &&
                    pendingInstallments.length === 0
                ) {
                    app.ui.popup.show(
                        'Các khoản trong nhóm này đã được thanh toán.',
                        'info'
                    );

                    app.ui.renderAll();
                    return;
                }

                const paymentDate =
                    app.logic.getPaymentDate();

                /*
                 * Đánh dấu các giao dịch tín dụng
                 * thường là đã trả.
                 */
                pendingTxs.forEach(t => {
                    t.status = 'paid';
                    t.paidAt = paymentDate;
                    t.paidByGroup =
                        freshItem.groupKey;
                });

                /*
                 * Đánh dấu tất cả kỳ trả góp
                 * trong nhóm là đã trả đủ.
                 */
                pendingInstallments.forEach(
                    ({ payment, totalDue }) => {
                        payment.paidAmount =
                            totalDue;

                        payment.paid = true;
                        payment.paidAt =
                            paymentDate;

                        payment.paidByGroup =
                            freshItem.groupKey;
                    }
                );

                const destination =
                    freshItem.source ||
                    freshItem.name;

                const baseId = Date.now();

                const penalty =
                    Number(
                        freshItem.penalty
                    ) || 0;

                const principal =
                    Number(
                        freshItem.amount
                    ) || 0;

                /*
                 * Tạo giao dịch trả tiền phạt,
                 * nếu có.
                 */
                if (penalty > 0) {
                    app.data.transactions.push({
                        id: baseId,

                        type: 'Chi tiêu',

                        place:
                            `Thanh toán phạt kỳ sao kê ` +
                            `(${freshItem.name})`,

                        source: 'Tiền mặt',
                        destination: destination,

                        amount: penalty,
                        date: paymentDate,

                        tags:
                            '#nop_phat ' +
                            '#tra_het_ky_sao_ke',

                        status: 'paid',

                        creditGroupKey:
                            freshItem.groupKey
                    });
                }

                /*
                 * Tạo duy nhất một giao dịch thanh toán
                 * cho toàn bộ nhóm.
                 */
                if (principal > 0) {
                    const hasInstallment =
                        pendingInstallments.length > 0;

                    app.data.transactions.push({
                        id: baseId + 1,

                        type: 'Chi tiêu',

                        place:
                            `Trả hết kỳ sao kê ` +
                            `(${freshItem.name})`,

                        source: 'Tiền mặt',
                        destination: destination,

                        amount: principal,
                        date: paymentDate,

                        tags:
                            `#thanh_toan_no ` +
                            `${hasInstallment
                                ? '#tra_gop '
                                : ''
                            }` +
                            `#tra_het_ky_sao_ke`,

                        status: 'paid',

                        creditGroupKey:
                            freshItem.groupKey,

                        paidCreditTxIds:
                            pendingTxs.map(
                                t => t.id
                            ),

                        paidInstallmentRefs:
                            pendingInstallments.map(
                                ({ ref }) => ({
                                    ...ref
                                })
                            )
                    });
                }

                if (
                    freshItem.overrideKey &&
                    app.data.configs.debtOverrides
                ) {
                    delete app.data.configs
                        .debtOverrides[
                        freshItem.overrideKey
                    ];
                }

                app.storage.save();
                app.ui.renderAll();

                if (
                    app.effects &&
                    typeof app.effects
                        .triggerConfetti ===
                    'function'
                ) {
                    app.effects.triggerConfetti();
                }

                app.ui.popup.show(
                    `Đã trả hết ${freshItem.name} ` +
                    `(${freshItem.statementLabel || 'kỳ sao kê'}) ` +
                    `với tổng ${app.logic.formatCurrency(
                        principal + penalty
                    )}.`,

                    'success'
                );
            }
        );
    },

    renderUpcomingDebts() {
        const data = app.logic.getUpcomingDebts();
        const box = document.getElementById('upcoming-debt-box');

        if (data.items.length === 0 || app.data.configs.guestMode) {
            if (box) box.style.display = 'none';
            return;
        }

        box.style.display = 'block';

        // Cập nhật Header
        document.getElementById('upcoming-month-label').innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${data.monthLabel}`;

        // Tổng nợ hiển thị
        const totalEl = document.getElementById('upcoming-total');
        totalEl.textContent = app.logic.formatCurrency(data.displayTotal);

        // Đổi màu tiêu đề nếu có nợ quá hạn
        const hasOverdue = data.items.some(i => i.isOverdue);
        if (hasOverdue) {
            totalEl.style.color = '#ef4444'; // Red
            totalEl.innerHTML += ` <span style="font-size:0.5em; vertical-align:middle; background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px;">CÓ QUÁ HẠN</span>`;
        } else {
            totalEl.style.color = '#3b82f6'; // Blue
        }

        const listEl = document.getElementById('upcoming-list');

        let listHTML = data.items.map((item, index) => {
            // 1. CẤU HÌNH GIAO DIỆN THEO THƯƠNG HIỆU
            let brandColor = '#64748b'; // Mặc định xám
            let brandBg = '#f8fafc';
            let brandLogo = '<i class="fa-solid fa-credit-card"></i>';

            if (item.type === 'momo') {
                brandColor = '#d946ef'; // Hồng tím
                brandBg = '#fdf4ff';
                brandLogo = '<img src="./assets/momo.png" style="width:20px; height:20px; border-radius:4px;">';
            } else if (item.type === 'zalo') {
                brandColor = '#059669'; // Xanh lá
                brandBg = '#ecfdf5';
                brandLogo = '<img src="./assets/zalo.png" style="width:20px; height:20px; border-radius:4px;">';
            } else if (item.type === 'shopee') {
                brandColor = '#f97316'; // Cam
                brandBg = '#fff7ed';
                brandLogo = '<img src="./assets/shopee.png" style="width:20px; height:20px; border-radius:4px;">';
            } else if (item.type === 'tiktok') {
                brandColor = '#111827'; // Đen xám đặc trưng của TikTok
                brandBg = '#f3f4f6';
                brandLogo = '<img src="./assets/tiktok.png" style="width:20px; height:20px; border-radius:4px;">';
            } else {
                // Tự động nhận diện logo cho khoản vay thường
                const lowerName = item.name.toLowerCase();
                if (lowerName.includes('momo')) brandLogo = '<img src="./assets/momo.png" style="width:20px; height:20px;">';
                else if (lowerName.includes('zalo')) brandLogo = '<img src="./assets/zalo.png" style="width:20px; height:20px;">';
                else if (lowerName.includes('shopee')) brandLogo = '<img src="./assets/shopee.png" style="width:20px; height:20px;">';
                else if (lowerName.includes('tiktok')) brandLogo = '<img src="./assets/tiktok.png" style="width:20px; height:20px;">';
            }

            // 2. XỬ LÝ TRẠNG THÁI & NGÀY
            const today = new Date();

            let targetDay = 5; // Mặc định (MoMo, Vay...)
            const nameLower = item.name.toLowerCase();
            if (item.type === 'shopee' || nameLower.includes('shopee') || nameLower.includes('spay')) {
                targetDay = 2;
            }
            else if (item.type === 'zalo') {
                targetDay = 6;
            }
            else if (item.type === 'tiktok' || nameLower.includes('tiktok')) {
                targetDay = 10;
            }
            else if (nameLower.includes('vay nhanh')) {
                targetDay = 7;
            }

            // Tính toán ngày đếm ngược (Countdown)
            let dueDateObj;

            if (item.dueDateISO) {
                const [dueY, dueM, dueD] =
                    item.dueDateISO
                        .split('-')
                        .map(Number);

                dueDateObj = new Date(
                    dueY,
                    dueM - 1,
                    dueD,
                    23,
                    59,
                    59
                );

                targetDay = dueD;
            } else if (
                item.date.includes('-') &&
                item.date.length > 5
            ) {
                // Trường hợp trả góp YYYY-MM.
                const [itemY, itemM] =
                    item.date
                        .split('-')
                        .map(Number);

                dueDateObj = new Date(
                    itemY,
                    itemM - 1,
                    targetDay,
                    23,
                    59,
                    59
                );
            } else {
                // Dữ liệu cũ chưa có dueDateISO.
                const [fY, fM] =
                    app.data.filter.month
                        .split('-')
                        .map(Number);

                dueDateObj = new Date(
                    fY,
                    fM,
                    targetDay,
                    23,
                    59,
                    59
                );
            }

            const daysLeft = Math.ceil((dueDateObj - today) / (1000 * 60 * 60 * 24));

            let statusBadge = '';
            let cardBorder = `border-left: 4px solid ${brandColor};`;
            const dayStr = String(targetDay).padStart(2, '0');

            if (item.isOverdue) {
                const overdueCount =
                    item.overdueDays ??
                    item.daysOverdue ??
                    Math.max(
                        1,
                        Math.abs(daysLeft)
                    );

                statusBadge =
                    `<span style="` +
                    `background:#fee2e2; ` +
                    `color:#991b1b; ` +
                    `padding:2px 8px; ` +
                    `border-radius:99px; ` +
                    `font-size:0.65rem; ` +
                    `font-weight:700;">` +
                    `Quá hạn ${overdueCount} ngày` +
                    `</span>`;

                cardBorder =
                    `border-left: 4px solid #ef4444;`;
            } else if (daysLeft <= 5 && daysLeft >= 0) {
                statusBadge = `<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:99px; font-size:0.65rem; font-weight:700;">Còn ${daysLeft} ngày</span>`;
            } else {
                statusBadge = `<span style="background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:99px; font-size:0.65rem;">Hạn ngày ${dayStr}</span>`;
            }

            // 3. HIỂN THỊ SỐ TIỀN & PHẠT
            let mainAmountHTML = '';
            let subInfoHTML = '';

            if (item.penalty > 0) {
                const totalWithPenalty = item.amount + item.penalty;
                mainAmountHTML = `
                    <div style="text-align:right;">
                        <div style="font-size:0.75rem; text-decoration:line-through; color:#94a3b8;">${app.logic.formatCurrency(item.amount)}</div>
                        <div style="font-family:var(--font-mono); font-weight:800; font-size:1.1rem; color:#ef4444;">${app.logic.formatCurrency(totalWithPenalty)}</div>
                    </div>`;
                subInfoHTML += `<div style="font-size:0.7rem; color:#ef4444; margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> Phạt: +${app.logic.formatCurrency(item.penalty)}</div>`;
            } else {
                mainAmountHTML = `
                    <div style="font-family:var(--font-mono); font-weight:800; font-size:1.1rem; color:${item.isOverdue ? '#ef4444' : '#1e293b'};">
                        ${app.logic.formatCurrency(item.amount)}
                    </div>`;
            }

            if (item.extraFee > 0) {
                subInfoHTML += `<div style="font-size:0.7rem; color:#f59e0b; margin-top:2px;">(Gồm phí DV: ${app.logic.formatCurrency(item.extraFee)})</div>`;
            }

            if (item.type === 'loan' && (item.name.toLowerCase().includes('momo') || item.name.toLowerCase().includes('vay nhanh'))) {
                subInfoHTML += `<div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px; font-style:italic;">
                    <i class="fa-solid fa-circle-info"></i> +20.000đ/giao dịch trả nợ
                </div>`;
            }

            // 4. THANH TRẢ TỐI THIỂU (MOMO)
            let minPayHTML = '';
            if (item.type === 'momo' && item.minPay > 0) {
                const percent = Math.min(100, Math.max(10, (item.minPay / (item.amount + item.penalty)) * 100));
                minPayHTML = `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e2e8f0;">
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; margin-bottom:4px;">
                        <span style="color:#64748b">Trả tối thiểu</span>
                        <span style="font-weight:700; color:#d946ef">${app.logic.formatCurrency(item.minPay)}</span>
                    </div>
                    <div style="height:6px; width:100%; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${percent}%; background: linear-gradient(90deg, #e879f9, #d946ef);"></div>
                    </div>
                </div>`;
            }

            // 5. RENDER CARD
            const regularCount =
                Array.isArray(item.txIds)
                    ? item.txIds.length
                    : 0;

            const installmentCount =
                Array.isArray(item.installmentRefs)
                    ? item.installmentRefs.length
                    : 0;

            // Tổng số giao dịch và kỳ trả góp trong nhóm
            const totalGroupCount =
                regularCount + installmentCount;

            const groupCountText = [
                regularCount > 0
                    ? `${regularCount} giao dịch`
                    : '',

                installmentCount > 0
                    ? `${installmentCount} kỳ trả góp`
                    : ''
            ]
                .filter(Boolean)
                .join(' + ');

            const safeGroupKey =
                encodeURIComponent(
                    String(item.groupKey || '')
                ).replace(/'/g, '%27');

            const groupMetaHTML =
                item.isCreditGroup
                    ? `
        <div
            onclick="
                event.stopPropagation();

                app.ui.showUpcomingCreditGroupDetails(
                    '${safeGroupKey}'
                );
            "

            title="Nhấn để xem chi tiết các khoản"

            style="
                display:flex;
                align-items:center;
                flex-wrap:wrap;
                gap:4px;
                width:fit-content;
                margin-top:4px;
                padding:3px 7px;
                border-radius:6px;
                background:#f8fafc;
                font-size:0.7rem;
                color:#64748b;
                cursor:pointer;
                user-select:none;
                transition:0.2s;
            "

            onmouseover="
                this.style.background='#ffedd5';
                this.style.color='#c2410c';
            "

            onmouseout="
                this.style.background='#f8fafc';
                this.style.color='#64748b';
            "
        >
            <i class="fa-solid fa-layer-group"></i>

            <span>
                ${item.statementLabel || ''}
            </span>

            ${groupCountText
                        ? `
                    <span style="margin:0 2px;">
                        •
                    </span>

                    <span>
                        ${groupCountText}
                    </span>
                    `
                        : ''
                    }

            <i
                class="fa-solid fa-chevron-right"
                style="
                    margin-left:3px;
                    font-size:0.58rem;
                "
            ></i>
        </div>
        `
                    : '';

            // Nút trả toàn bộ kỳ sao kê
            const payAllHTML =
                item.isCreditGroup &&
                    totalGroupCount > 0
                    ? `
        <div style="
            display:flex;
            justify-content:flex-end;
            margin-top:10px;
        ">
            <button
                type="button"

                onclick="
                    event.stopPropagation();

                    app.ui.payUpcomingCreditGroup(
    '${safeGroupKey}'
)
                "

                style="
                    width:auto;
                    border:none;
                    border-radius:9px;
                    padding:8px 14px;
                    cursor:pointer;
                    background:${brandColor};
                    color:white;
                    font-weight:800;
                    font-size:0.76rem;
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    gap:6px;
                    box-shadow:
                        0 3px 8px
                        rgba(15,23,42,0.12);
                "
            >
                <i class="fa-solid fa-circle-check"></i>
                Trả hết kỳ này
            </button>
        </div>
        `
                    : '';
            const hiddenClass = index >= 3 ? 'upcoming-hidden-item' : '';
            const hiddenStyle = index >= 3 ? 'display:none;' : '';

            return `
            <div class="${hiddenClass}" style="${hiddenStyle} background:white; border-radius:12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); margin-bottom:12px; padding:12px; ${cardBorder} position:relative; overflow:hidden;">
                
                <div style="position:absolute; top:0; right:0; width:60px; height:60px; background:${brandBg}; border-radius:0 0 0 100%; z-index:0;"></div>

                <div style="position:relative; z-index:1;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${brandLogo}
                            <div>
                                <div style="font-weight:700; font-size:0.95rem; color:#334155; line-height:1.2;">${item.name}</div>
                                <div style="font-size:0.75rem; color:#94a3b8;">
    Hạn ${item.date}
</div>

${groupMetaHTML}
                            </div>
                        </div>
                        ${statusBadge}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <div>
                            ${subInfoHTML}
                        </div>
                        ${mainAmountHTML}
                    </div>

                    ${minPayHTML}
${payAllHTML}
</div>
            </div>`;
        }).join('');

        // --- NÚT XEM THÊM / THU GỌN ---
        const hiddenCount = data.items.length - 3;
        if (hiddenCount > 0) {
            const toggleScript = `
                const items = this.parentElement.querySelectorAll('.upcoming-hidden-item');
                const isHidden = items[0].style.display === 'none';
                items.forEach(el => el.style.display = isHidden ? 'block' : 'none');
                this.innerHTML = isHidden 
                    ? '<i class=\\'fa-solid fa-chevron-up\\'></i> Thu gọn' 
                    : 'Xem thêm <b>${hiddenCount}</b> khoản khác <i class=\\'fa-solid fa-chevron-down\\'></i>';
            `;

            listHTML += `
            <div onclick="${toggleScript.replace(/\n/g, '')}" 
                 style="text-align: center; padding: 10px; font-size: 0.8rem; color: var(--primary); font-weight: 700; cursor: pointer; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1; transition: 0.2s;">
                Xem thêm <b>${hiddenCount}</b> khoản khác <i class="fa-solid fa-chevron-down"></i>
            </div>`;
        }

        listEl.innerHTML = listHTML;
    },

    renderDailyBudget() {
        const box = document.getElementById('daily-budget-box');
        const state = app.logic.calcDailyBudgetState();
        const limit = Number(app.data.configs.monthlyLimits?.[app.data.filter.month]) || 0;

        // Nếu chưa set hạn mức tháng thì ẩn luôn
        if (limit <= 0 || app.data.configs.guestMode) {
            box.style.display = 'none';
            return;
        }
        box.style.display = 'block';

        // 1. Kiểm tra trạng thái Khóa/Mở từ Config
        const currentMonth = app.data.filter.month;
        const isHidden = app.data.configs.hiddenDailyBudgets && app.data.configs.hiddenDailyBudgets[currentMonth] === true;
        const iconToggle = isHidden ? 'fa-toggle-off' : 'fa-toggle-on';
        const colorToggle = isHidden ? '#9ca3af' : '#059669';
        const titleText = isHidden ? '(Đã tắt)' : '(65K)'; // 65K là ví dụ, code dưới sẽ tính lại

        // 2. Render Header (Luôn hiển thị) có nút Bật/Tắt
        const headerHTML = `
            <div class="card-header" style="margin-bottom: ${isHidden ? '0' : '0.5rem'}; display:flex; justify-content:space-between; align-items:center;">
                <div class="card-title" style="font-size: 1.1rem; color: ${isHidden ? '#6b7280' : '#059669'};">
                    <i class="fa-solid fa-calendar-day"></i> KẾ HOẠCH NGÀY
                </div>
                <div style="display:flex; gap: 10px; align-items:center;">
                    ${!isHidden ? `<div id="daily-status-badge" class="badge badge-success">Ổn định</div>` : ''}
                    <button onclick="app.ui.toggleDailyBudgetState()" 
                            style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:${colorToggle}; transition:0.3s;"
                            title="${isHidden ? 'Bật tính năng' : 'Tắt tính năng'}">
                        <i class="fa-solid ${iconToggle}"></i>
                    </button>
                </div>
            </div>`;

        // Nếu đang TẮT -> Chỉ hiện Header và return
        if (isHidden) {
            box.innerHTML = headerHTML;
            box.style.borderColor = '#e5e7eb'; // Màu viền xám nhạt
            box.style.background = '#f9fafb';  // Nền xám nhẹ
            box.style.opacity = '0.8';
            return;
        }

        // --- NẾU ĐANG BẬT -> RENDER NỘI DUNG BÊN DƯỚI NHƯ CŨ ---

        box.style.background = 'white';
        box.style.opacity = '1';

        const fmt = app.logic.formatCurrency;

        // Chuẩn bị các biến hiển thị
        let badgeText = 'Ổn định';
        let badgeClass = 'badge badge-success';
        let badgeStyle = '';

        let barWidth = 0;
        let barColor = '#10b981';
        let msgHTML = '';
        let surplusColor = '#059669';

        if (state.status === 'broke') {
            box.style.borderColor = 'var(--danger)';
            badgeText = 'Vỡ kế hoạch';
            badgeClass = 'badge badge-secondary';
            badgeStyle = 'background:#fee2e2; color:var(--danger);';

            barWidth = 100;
            barColor = 'var(--danger)';
            surplusColor = 'var(--danger)';
            msgHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Hết tiền rồi! Bạn đang âm <b>${fmt(Math.abs(state.available))}</b>.`;
        } else {
            box.style.borderColor = '#059669';
            const percentToday = Math.min(100, (state.todaySpent / state.dailyCap) * 100);
            barWidth = percentToday;

            if (state.todaySpent > state.dailyCap) {
                barColor = 'var(--danger)';
                msgHTML = `<span style="color:var(--danger)">Hôm nay tiêu lố <b>${fmt(state.todaySpent - state.dailyCap)}</b>!</span> Hệ thống đã tự động rút bớt ngày tương lai.`;
            } else {
                barColor = '#10b981';
                msgHTML = `Hôm nay còn dư <b>${fmt(state.dailyCap - state.todaySpent)}</b>.`;
            }

            if (state.surplus >= 60000) {
                badgeText = '+1 Ngày mới';
                badgeStyle = 'animation: pulse 1s infinite;';
            } else if (state.daysFunded < 3 && state.daysFunded > 0) {
                badgeText = 'Sắp hết';
                badgeClass = 'badge badge-warning';
            }
        }

        // Update lại Header với Badge đã tính toán
        // (Chúng ta render lại Header một lần nữa để khớp với logic trạng thái)
        const activeHeaderHTML = `
            <div class="card-header" style="margin-bottom: 0.5rem; display:flex; justify-content:space-between; align-items:center;">
                <div class="card-title" style="font-size: 1.1rem; color: #059669;">
                    <i class="fa-solid fa-calendar-day"></i> KẾ HOẠCH NGÀY (${fmt(state.dailyCap)})
                </div>
                <div style="display:flex; gap: 10px; align-items:center;">
                    <div id="daily-status-badge" class="${badgeClass}" style="${badgeStyle}">${badgeText}</div>
                    <button onclick="app.ui.toggleDailyBudgetState()" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#059669;">
                        <i class="fa-solid fa-toggle-on"></i>
                    </button>
                </div>
            </div>`;

        // Tạo nội dung Body
        const bodyHTML = `
            <div style="margin-bottom: 0.5rem;">
                <div style="display:flex; justify-content:space-between; font-size: 0.8rem; font-weight:700; margin-bottom:4px;">
                    <span>Hôm nay tiêu:</span>
                    <span>${fmt(state.todaySpent)} / ${fmt(state.dailyCap)}</span>
                </div>
                <div style="height: 12px; background: #e5e7eb; border-radius: 99px; overflow: hidden; border: 1px solid #d1d5db;">
                    <div style="height: 100%; background: ${barColor}; width: ${barWidth}%; transition: width 0.5s;"></div>
                </div>
            </div>

            <div style="background: #ecfdf5; padding: 0.8rem; border-radius: 12px; border: 1px dashed #059669; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size: 0.75rem; color: #047857; font-weight:700; text-transform:uppercase;">Số dư lẻ (Heo đất)</div>
                    <div style="font-family:var(--font-mono); font-weight:900; font-size: 1.2rem; color: ${surplusColor};">${fmt(state.surplus)}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size: 0.75rem; color: #047857;">Số ngày được cấp vốn</div>
                    <div style="font-weight:900; font-size: 1.2rem; color: #059669;">${state.daysFunded} ngày</div>
                </div>
            </div>

            <div style="font-size: 0.8rem; margin-top: 0.5rem; font-style: italic; color: var(--text-muted);">
                ${msgHTML}
            </div>
            <div id="daily-tx-list-container"></div>
        `;

        box.innerHTML = activeHeaderHTML + bodyHTML;

        // Render danh sách giao dịch trong ngày (nếu có)
        this.renderDailyTxList(state, fmt);
    },

    // Hàm phụ trợ để render list (tách ra cho gọn)
    renderDailyTxList(state, fmt) {
        const listContainer = document.getElementById('daily-tx-list-container');
        if (!listContainer) return;

        // Tạo lại container style
        listContainer.style.marginTop = '1rem';
        listContainer.style.borderTop = '1px dashed #e5e7eb';
        listContainer.style.paddingTop = '0.5rem';

        if (state.todayTxs && state.todayTxs.length > 0) {
            const listHTML = state.todayTxs.map(t => {
                const isExcluded = t.excludeFromBudget === true;
                const rowOpacity = isExcluded ? '0.5' : '1';
                const textDecor = isExcluded ? 'line-through' : 'none';
                const iconColor = isExcluded ? '#9ca3af' : '#059669';
                const iconClass = isExcluded ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
                const title = isExcluded ? 'Bấm để TÍNH vào ngày' : 'Bấm để LOẠI KHỎI ngày';

                return `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; margin-bottom:6px; padding:4px 0; border-bottom:1px solid #f9fafb; opacity: ${rowOpacity}">
                    <div style="text-decoration: ${textDecor}; color: var(--text-main); flex: 1;">
                        <div style="font-weight:600;">${t.place}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted)">${t.source}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <span style="font-weight:700; text-decoration: ${textDecor}">${fmt(t.amount)}</span>
                        <button onclick="app.ui.toggleDailyExclusion(${t.id})" 
                                title="${title}"
                                style="background:none; border:none; cursor:pointer; padding:4px; color:${iconColor}; font-size:1rem; transition:0.2s">
                            <i class="${iconClass}"></i>
                        </button>
                    </div>
                </div>`;
            }).join('');
            listContainer.innerHTML = `<div style="font-size:0.7rem; font-weight:800; color:var(--text-muted); margin-bottom:0.5rem; text-transform:uppercase;">Chi tiết hôm nay</div>` + listHTML;
        } else {
            listContainer.innerHTML = '';
        }
    },

    toggleDailyExclusion(id) {
        const tx = app.data.transactions.find(t => t.id === id);
        if (tx) {
            // Đảo ngược trạng thái loại trừ
            tx.excludeFromBudget = !tx.excludeFromBudget;

            // Lưu dữ liệu
            app.storage.save();

            // Vẽ lại giao diện để cập nhật thanh tiến trình và icon
            app.ui.renderAll();
        }
    },

    // --- HÀM XỬ LÝ NÚT BẬT/TẮT ---
    toggleDailyBudgetState() {
        const currentMonth = app.data.filter.month;

        // Đảm bảo object tồn tại
        if (!app.data.configs.hiddenDailyBudgets) app.data.configs.hiddenDailyBudgets = {};
        const currentStatus = app.data.configs.hiddenDailyBudgets[currentMonth] === true;
        app.data.configs.hiddenDailyBudgets[currentMonth] = !currentStatus;
        app.storage.save();
        app.ui.renderAll();
    },

    // ------------------------------------------

    renderAll() {
        let autoFixCount = 0;
        app.data.transactions.forEach(t => {
            // Kiểm tra: Nếu nội dung có chữ "chuyển tiền" (không phân biệt hoa thường)
            // VÀ loại hiện tại chưa phải là "Chuyển tiền"
            if (t.place && t.place.toLowerCase().includes('chuyển tiền') && t.type !== 'Chuyển tiền') {
                t.type = 'Chuyển tiền';
                autoFixCount++;
            }
        });
        // Nếu có sửa đổi thì lưu lại ngay lập tức
        if (autoFixCount > 0) {
            app.storage.save();
            console.log(`Đã tự động cập nhật loại cho ${autoFixCount} giao dịch chuyển tiền.`);
        }
        const monthlyTxs = app.logic.getFilteredTxs();
        const activeTxs = monthlyTxs.filter(t => t.status !== 'cancelled');
        const allPendingTxs = app.data.transactions.filter(t => t.status === 'pending' && t.type !== 'Thu nhập');

        const isIncome = t => t.type === 'Thu nhập';

        // --- FIX: Định nghĩa chặt chẽ thế nào là Nguồn Tín Dụng ---
        const isCreditSource = s => {
            const lower = s.toLowerCase();
            const isZaloCredit = lower.includes('zalo') && (lower.includes('trả sau') || lower.includes('priority') || lower.includes('paylater'));
            const isMomoCredit = lower.includes('momo') && (lower.includes('trả sau') || lower.includes('ví trả sau') || lower.includes('credit'));
            const isShopeeCredit = lower.includes('shopee') || lower.includes('spay') || lower.includes('airpay');
            const isTikTokCredit = lower.includes('tiktok');
            const isOtherCredit = lower.includes('tín dụng') || lower.includes('thẻ') || lower.includes('credit');
            return isZaloCredit || isMomoCredit || isOtherCredit || isShopeeCredit || isTikTokCredit;
        };
        // ----------------------------------------------------------

        // Chỉ tính vào Tổng Nợ nếu là nguồn tín dụng thực sự (bỏ qua tiền mặt/ví thường pending)
        // Gọi hàm logic để lấy dữ liệu y hệt danh sách bên dưới
        const upcomingDataForSummary = app.logic.getUpcomingDebts();

        // Lấy field 'displayTotal' (Tổng hiển thị - bao gồm cả gốc + lãi + phạt của các mục trong list)
        const totalOutstandingDebt = upcomingDataForSummary.displayTotal;

        // Lọc thêm điều kiện: không bị loại trừ (excludeFromDashboard)
        const income = activeTxs
            .filter(t => isIncome(t) && t.status === 'paid' && !t.excludeFromDashboard)
            .reduce((sum, t) => sum + t.amount, 0);

        const expense = activeTxs
            .filter(t => !isIncome(t) && t.type !== 'Chuyển tiền' && t.status !== 'planned' && !t.excludeFromDashboard)
            .reduce((sum, t) => sum + t.amount, 0);

        // 3. CHI TIÊU NGÂN SÁCH (Giữ nguyên logic logic.getBudgetTransactions của bạn)
        const budgetTxs = app.logic.getBudgetTransactions();
        const budgetExpense = budgetTxs.reduce((sum, t) => sum + t.amount, 0);

        // 3. Truyền số liệu ĐÃ LỌC vào thanh Ngân sách
        // ---> Hàm renderBudget giờ tự gọi getUpcomingDebts bên trong để vẽ phần đứt quãng
        app.ui.renderBudget(budgetExpense);
        app.ui.renderDailyBudget();
        app.ui.renderUpcomingDebts();
        // -------------------------------------------------------------
        // -------------------------------------------------------------

        document.getElementById('periodDisplay').textContent = `Tháng ${app.data.filter.month.split('-')[1]} / ${app.data.filter.month.split('-')[0]}`;
        document.getElementById('summary-income').textContent = app.logic.formatCurrency(income);
        document.getElementById('summary-expense').textContent = app.logic.formatCurrency(expense);

        document.getElementById('summary-debt').textContent = app.logic.formatCurrency(totalOutstandingDebt);

        const hasOverdue = app.data.transactions.some(t => {
            if (t.status !== 'pending' || t.type === 'Thu nhập') return false;
            // Chỉ kiểm tra quá hạn với các nguồn trả sau
            if (!isCreditSource(t.source)) return false;

            const info = app.logic.getBillingInfo(t.source, t.date);
            return new Date() > info.dueDate;
        });

        if (hasOverdue) {
            document.getElementById('summary-debt').style.color = 'var(--danger)';
            document.getElementById('detail-debt').innerHTML = '<span style="color:var(--danger)"><i class="fa-solid fa-bell"></i> Có khoản nợ quá hạn!</span>';
        } else {
            document.getElementById('summary-debt').style.color = 'var(--warning)';
        }

        this.updateFinancialWeather(income, expense, hasOverdue);
        const topExpense = activeTxs.filter(t => !isIncome(t)).sort((a, b) => b.amount - a.amount).slice(0, 5); // Lấy top 5 giao dịch lớn nhất

        if (topExpense.length === 0) {
            document.getElementById('detail-expense').innerHTML = '<div style="opacity:0.7; font-style:italic; padding-top:10px;">Chưa có chi tiêu</div>';
        } else {
            const textRun = topExpense.map(t => `${t.place}: ${app.logic.formatCurrency(t.amount)}`).join(' &nbsp;&nbsp;&bull;&nbsp;&nbsp; ');

            document.getElementById('detail-expense').innerHTML = `
                <div style="overflow: hidden; white-space: nowrap; width: 100%; padding-top: 10px;">
                    <div style="display: inline-block; animation: marquee-expense 15s linear infinite; font-weight: 700; font-size: 0.95rem;">
                        ${textRun} &nbsp;&nbsp;&bull;&nbsp;&nbsp; ${textRun} &nbsp;&nbsp;&bull;&nbsp;&nbsp; ${textRun}
                    </div>
                </div>
                <style>
                    @keyframes marquee-expense {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-33.33%); } /* Chạy 1/3 quãng đường (do nhân 3 nội dung) rồi loop lại */
                    }
                </style>
            `;
        }
        document.getElementById('detail-income').innerHTML = `
            <div class="flex-between" style="display:flex; justify-content:space-between; color: var(--text-muted); align-items: center; padding-top: 10px;">
                <span>Số dư ước tính:</span>
                <span style="color: var(--text-main); font-weight: 800; font-size: 1.1em;">${app.logic.formatCurrency(income - expense)}</span>
            </div>`;
        if (!hasOverdue) {
            // Lấy trực tiếp danh sách nợ từ upcomingData (bao gồm cả Trả góp, Vay ngoài, Ví trả sau) để đồng bộ với số Tổng
            const topDebt = upcomingDataForSummary.items.sort((a, b) => (b.amount + (b.penalty || 0)) - (a.amount + (a.penalty || 0))).slice(0, 5); // Tăng lên lấy 5 khoản nợ để chạy chữ cho dài

            if (topDebt.length === 0) {
                document.getElementById('detail-debt').innerHTML = '<div style="opacity:0.8; font-style:italic; padding-top:10px;">An toàn, không có nợ!</div>';
            } else {
                // Tạo chuỗi text chạy ngang
                const textRunDebt = topDebt.map(item => `${item.name}: ${app.logic.formatCurrency(item.amount + (item.penalty || 0))}`).join(' &nbsp;&nbsp;&bull;&nbsp;&nbsp; ');

                document.getElementById('detail-debt').innerHTML = `
                    <div style="overflow: hidden; white-space: nowrap; width: 100%; padding-top: 10px;">
                        <div style="display: inline-block; animation: marquee-debt 15s linear infinite; font-weight: 700; font-size: 0.95rem; color: var(--warning);">
                            ${textRunDebt} &nbsp;&nbsp;&bull;&nbsp;&nbsp; ${textRunDebt} &nbsp;&nbsp;&bull;&nbsp;&nbsp; ${textRunDebt}
                        </div>
                    </div>
                    <style>
                        @keyframes marquee-debt {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(-33.33%); } /* Chạy 1/3 quãng đường rồi loop lại */
                        }
                    </style>
                `;
            }
        }

        // 2. RENDER BẢNG LỊCH SỬ (Đã sửa để hiển thị đẹp hơn cho Chuyển tiền)
        const tbody = document.getElementById('tx-table-body');

        tbody.innerHTML = monthlyTxs.sort((a, b) => {
            const dayA = new Date(a.date).toISOString().slice(0, 10);
            const dayB = new Date(b.date).toISOString().slice(0, 10);
            if (dayA !== dayB) return new Date(b.date) - new Date(a.date);
            if (a.isUnknownTime && !b.isUnknownTime) return -1;
            if (!a.isUnknownTime && b.isUnknownTime) return 1;
            return b.id - a.id;
        }).map(t => {
            const isInc = t.type === 'Thu nhập';
            const isTransfer = t.type === 'Chuyển tiền'; // [MỚI] Check loại chuyển tiền

            let statusText = 'Chờ xử lý';
            let badgeClass = 'badge-warning';
            const isCancelled = t.status === 'cancelled';
            let rowClass = isCancelled ? 'tx-cancelled' : '';
            let placeDisplay = t.place; // Biến tạm để hiển thị tên

            if (t.isTet) {
                rowClass = 'tet-style'; // Thêm class CSS Tết
                placeDisplay = `🧧 ${t.place}`; // Thêm icon bao lì xì
            }

            if (t.is83) {
                rowClass += ' holiday-83-style';
                placeDisplay = `💖 ${t.place}`;
            }
            if (t.is304) {
                rowClass += ' holiday-304-style';
                placeDisplay = `🧑‍✈️ ${t.place}`;
            }

            // Logic trạng thái
            if (isCancelled) {
                statusText = 'Đã hủy';
                badgeClass = 'badge-secondary';
            } else if (t.status === 'planned') {
                statusText = isInc ? 'Sẽ nhận' : 'Sẽ chi';
                badgeClass = 'badge-secondary" style="background:#f3e8ff; color:#7e22ce; border-color:#d8b4fe';
            } else if (t.status === 'paid') {
                statusText = 'Thành công';
                badgeClass = 'badge-success';

                // [MỚI] Badge riêng cho Chuyển tiền
                if (isTransfer) {
                    statusText = 'Chuyển quỹ';
                    badgeClass = 'badge-info" style="background:#e0f2fe; color:#0284c7; border-color:#bae6fd';
                }
            } else if (isInc) {
                statusText = 'Sắp nhận';
            } else {
                statusText = 'Chưa trả';
            }

            const toggleIcon = isCancelled ? 'fa-arrow-rotate-left' : 'fa-ban';
            const toggleTitle = isCancelled ? 'Khôi phục' : 'Hủy giao dịch';

            // ... (Giữ nguyên logic discount và brand) ...
            const discountAmt = t.discountAmount || 0;
            let discountDisplay = '';
            if (discountAmt > 0 && !isCancelled) {
                if (t.isCashback === true) {
                    // Nếu là Hoàn Tiền (Màu xanh dương, icon xoay lại)
                    const percent = Math.round((discountAmt / t.amount) * 100);
                    discountDisplay = `<div style="font-size: 0.65rem; color: var(--primary); font-weight: 700; margin-top: 2px; display: flex; align-items: center; gap: 3px;"><i class="fa-solid fa-rotate-left"></i> Hoàn ${app.logic.formatCurrency(discountAmt)} (+${percent}%)</div>`;
                } else {
                    // Nếu là Giảm Giá (Màu xanh lá, icon Tag gốc)
                    const originalPrice = t.amount + discountAmt;
                    const percent = Math.round((discountAmt / originalPrice) * 100);
                    discountDisplay = `<div style="font-size: 0.65rem; color: var(--success); font-weight: 700; margin-top: 2px; display: flex; align-items: center; gap: 3px;"><i class="fa-solid fa-tags"></i> Giảm ${app.logic.formatCurrency(discountAmt)} (-${percent}%)</div>`;
                }
            }

            let brandDisplay = '';
            if (t.brand) {
                brandDisplay = `<span style="background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe; padding:1px 6px; border-radius:4px; font-size:0.65rem; font-weight:700; margin-right:4px; display:inline-block; margin-bottom:2px;"><i class="fa-solid fa-copyright"></i> ${t.brand}</span>`;
            }

            let displaySource = t.source;
            let displayDest = t.destination;

            // Nếu giao dịch cũ không có trường Đích đến (destination)
            if (!displayDest) {
                const tagsLower = (t.tags || '').toLowerCase();
                const isDebtPayment = tagsLower.includes('#thanh_toan_no') ||
                    tagsLower.includes('#tra_gop') ||
                    tagsLower.includes('#nop_phat') ||
                    tagsLower.includes('#thanh_toan_phi') ||
                    tagsLower.includes('#tat_toan_vay') ||
                    tagsLower.includes('#tra_no_vay');

                if (t.type === 'Thu nhập') {
                    displaySource = 'Bên ngoài';
                    displayDest = t.source; // Tiền từ ngoài chạy VÀO ví
                } else if (t.type === 'Chi tiêu') {
                    if (isDebtPayment) {
                        displaySource = 'Tiền mặt'; // Các giao dịch trả nợ cũ thường lấy từ Tiền mặt
                        displayDest = t.source;     // Đập VÀO ví trả sau
                    } else {
                        displayDest = 'Bên ngoài';  // Chi tiêu bình thường thì tiền ra ngoài
                    }
                } else if (t.type === 'Chuyển tiền') {
                    displayDest = 'N/A';
                }
            }

            // Tạo HTML hiển thị đẹp mắt
            let sourceDestHTML = displayDest
                ? `<div style="display:flex; flex-direction:column;">
                        <span>${displaySource}</span>
                        <span style="font-size:0.7rem; color:var(--text-muted); display:flex; align-items:center; gap:4px;">
                        <i class="fa-solid fa-arrow-right" style="font-size:0.6rem"></i> ${displayDest}
                        </span>
                    </div>`
                : displaySource;

            // Màu sắc số tiền: Thu nhập (Xanh lá), Chuyển tiền (Xanh dương), Chi tiêu (Mặc định/Đen)
            const amountColor = isInc ? 'var(--success)' : (isTransfer ? '#0284c7' : 'inherit');
            // Dấu phía trước: Thu (+), Chuyển (không dấu), Chi (-)
            const amountSign = isInc ? '+' : (isTransfer ? '' : '-');

            return `<tr class="${rowClass}" onclick="if(!event.target.closest('button')) app.ui.modals.transaction.open(${t.id})" style="cursor:pointer">
            <td>
    <div style="font-weight:600; color:var(--text-muted)">${new Date(t.date).toLocaleDateString('vi-VN')}</div>
    <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">
        <i class="fa-regular fa-clock"></i> ${t.isUnknownTime ? '--:--' : new Date(t.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
    </div>
                ${t.refId ? `<div style="font-size:0.75rem; color:#0284c7; font-weight:700; margin-top:6px;"><i class="fa-solid fa-hashtag"></i> ${t.refId}</div>` : ''}
                
                ${t.orderCode ? `<div style="font-size:0.75rem; color:#ea580c; font-weight:700; margin-top:4px;"><i class="fa-solid fa-box"></i> ${t.orderCode}</div>` : ''}
            </td>
            </td>
            <td>
                <div style="font-weight:600">${placeDisplay}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                    ${brandDisplay} ${t.tags || ''}
                </div>
            </td>
            <td>
                ${t.destination
                    ? `<div style="display:flex; flex-direction:column;">
                            <span>${t.source}</span>
                            <span style="font-size:0.7rem; color:var(--text-muted); display:flex; align-items:center; gap:4px;">
                            <i class="fa-solid fa-arrow-right" style="font-size:0.6rem"></i> ${t.destination}
                            </span>
                        </div>`
                    : t.source
                }
            </td>
            
            <td style="font-family:var(--font-mono); font-weight:700; color: ${amountColor}">
                <div>${amountSign}${app.logic.formatCurrency(t.amount)}</div>
                ${discountDisplay} 
            </td>
            
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            
            <td style="text-align:right; white-space: nowrap;">
                <button class="btn-ghost btn-sm" onclick="app.ui.modals.receipt.openSingle(${t.id})" 
                        title="In hóa đơn" 
                        style="color: var(--text-main); background: rgba(0,0,0,0.05); margin-right: 4px; border-radius: 6px; width: 32px; height: 32px;">
                    <i class="fa-solid fa-file-invoice-dollar"></i>
                </button>
                
                <button class="btn-ghost btn-sm" onclick="app.ui.modals.transaction.open(${t.id})"
                        title="Chỉnh sửa"
                        style="margin-right: 4px; width: 32px; height: 32px;">
                    <i class="fa-solid fa-pen"></i>
                </button>
                
                <button class="btn-ghost btn-sm" onclick="app.ui.toggleCancel(${t.id})" 
                        title="${toggleTitle}" 
                        style="color: ${isCancelled ? 'var(--success)' : 'var(--danger)'}; width: 32px; height: 32px;">
                    <i class="fa-solid ${toggleIcon}"></i>
                </button>
            </td>
        </tr>`;
        }).join('');
        // --- KẾT THÚC ĐOẠN CODE MỚI ---
        document.getElementById('tx-count').textContent = activeTxs.length;

        // --- FIX: Chỉ render vào mục Quản lý nợ những cái là Tín dụng ---
        app.ui.renderDebts(allPendingTxs.filter(t => isCreditSource(t.source)));
        // --------------------------------------------------------------

        app.ui.renderZaloWidget();

        const forecastListEl = document.getElementById('forecast-list');
        if (app.data.forecasts.length === 0) {
            forecastListEl.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">Chưa có khoản dự tính nào.</div>';
        } else {
            forecastListEl.innerHTML = app.data.forecasts.map((f, index) => `
                        <div class="forecast-item" style="display:flex; justify-content:space-between; margin-bottom:8px">
                            <span>${f.name}</span>
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <span style="font-family:var(--font-mono)">${app.logic.formatCurrency(f.amount)}</span>
                                <button class="btn-ghost btn-sm" style="color:var(--danger)" onclick="app.ui.deleteForecast(${index})">&times;</button>
                            </div>
                        </div>
                    `).join('');
        }

        // --- SỬA TRONG app.ui.renderAll ---

        if (this.chartInstance) this.chartInstance.destroy();
        const ctx = document.getElementById('overviewChart').getContext('2d');

        this.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                // Rút gọn label cho đỡ tốn chỗ
                labels: ['Thu', 'Chi', 'Nợ'],
                datasets: [{
                    data: [income, expense, totalOutstandingDebt],
                    backgroundColor: ['#10b981', '#f43f5e', '#f59e0b'],
                    hoverOffset: 4,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Quan trọng để fit vào khung height cố định
                layout: {
                    padding: 10
                },
                plugins: {
                    legend: {
                        position: 'right', // Chuyển chú thích sang phải để biểu đồ to hơn theo chiều dọc
                        labels: {
                            boxWidth: 12,
                            padding: 15,
                            font: { size: 11, family: 'Nunito', weight: 'bold' },
                            color: '#334155'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                },
                cutout: '65%', // Làm viền bánh donut mỏng hơn chút cho thanh thoát
            }
        });
        this.updateNewsTicker();
        // --- KÍCH HOẠT SỰ KIỆN CLICK CHO DASHBOARD ---
        const elInc = document.getElementById('summary-income');
        if (elInc) {
            const card = elInc.closest('.stat-card');
            if (card) {
                card.style.cursor = 'pointer';
                card.onclick = () => app.ui.showSummaryDetail('income');
            }
        }

        const elExp = document.getElementById('summary-expense');
        if (elExp) {
            const card = elExp.closest('.stat-card');
            if (card) {
                card.style.cursor = 'pointer';
                card.onclick = () => app.ui.showSummaryDetail('expense');
            }
        }

        const elDebt = document.getElementById('summary-debt');
        if (elDebt) {
            const card = elDebt.closest('.stat-card');
            if (card) {
                card.style.cursor = 'pointer';
                card.onclick = () => app.ui.showSummaryDetail('debt');
            }
        }
        const setupClick = (id, type) => {
            const el = document.getElementById(id);
            if (el) {
                // Tìm thẻ cha có class 'stat-card' hoặc 'card' bọc con số đó
                const card = el.closest('.stat-card') || el.closest('.card') || el.parentElement;
                if (card) {
                    card.style.cursor = 'pointer';
                    // Thêm hiệu ứng hover nhẹ để biết là nhấn được
                    card.onmouseover = () => card.style.transform = 'scale(1.02)';
                    card.onmouseout = () => card.style.transform = 'scale(1)';
                    card.onclick = (e) => {
                        e.preventDefault();
                        app.ui.showSummaryDetail(type);
                    };
                }
            }
        };

        // Kích hoạt cho 3 mục
        setupClick('summary-income', 'income');
        setupClick('summary-expense', 'expense');
        setupClick('summary-debt', 'debt');

        const overviewChart = document.getElementById('overviewChart');

        if (app.data.configs.guestMode) {
            // 1. Làm mờ toàn bộ Lịch sử giao dịch và chặn Click
            if (tbody) {
                tbody.style.filter = 'blur(6px)';
                tbody.style.pointerEvents = 'none'; // Chặn bấm vào xem chi tiết
                tbody.style.userSelect = 'none';
                tbody.style.opacity = '0.6';
            }

            // 2. Làm mờ Biểu đồ Donut Tổng quan
            if (overviewChart) {
                overviewChart.style.filter = 'blur(10px)';
                overviewChart.style.pointerEvents = 'none';
            }

            // 3. Xóa các dòng chữ chạy chi tiết ở Tổng quan (Top tiêu nhiều, chi tiết nợ...)
            ['detail-income', 'detail-expense', 'detail-debt'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<div style="opacity:0.7; font-style:italic; padding-top:10px; color:var(--text-muted);">*** Chế độ riêng tư ***</div>';
            });

        } else {
            // Khôi phục lại trạng thái bình thường nếu tắt chế độ che
            if (tbody) {
                tbody.style.filter = 'none';
                tbody.style.pointerEvents = 'auto';
                tbody.style.opacity = '1';
            }
            if (overviewChart) {
                overviewChart.style.filter = 'none';
                overviewChart.style.pointerEvents = 'auto';
            }
        }
    },

    // Hàm hiển thị danh sách giao dịch chi tiết từ Dashboard
    showSummaryDetail(type) {
        let txs = [];
        let title = "";
        let themeColor = "";
        const monthlyTxs = app.logic.getFilteredTxs().filter(t => t.status !== 'cancelled');

        if (type === 'income') {
            txs = monthlyTxs.filter(t => t.type === 'Thu nhập' && t.status === 'paid');
            title = "CHI TIẾT THU NHẬP"; themeColor = "#10b981";
        } else if (type === 'expense') {
            txs = monthlyTxs.filter(t => t.type === 'Chi tiêu' && t.status !== 'planned');
            title = "CHI TIẾT CHI TIÊU"; themeColor = "#ef4444";
        } else if (type === 'debt') {
            // Lấy toàn bộ giao dịch liên quan đến nợ trong tháng (bao gồm cả đã trả và đang nợ)
            txs = app.data.transactions.filter(t => {
                const isInMonth = t.date.startsWith(app.data.filter.month);
                const isDebtSource = t.status === 'pending' && t.type !== 'Thu nhập';
                const isPaidDebt = t.status === 'paid' && (
                    t.tags?.includes('#thanh_toan_no') ||
                    t.tags?.includes('#tra_gop') ||
                    t.tags?.includes('#nop_phat') ||
                    t.tags?.includes('#thanh_toan_phi')
                );
                return isInMonth && (isDebtSource || isPaidDebt);
            });
            title = "DANH SÁCH NỢ TRONG THÁNG"; themeColor = "#f59e0b";
        }

        if (txs.length === 0) return app.ui.popup.show("Không có giao dịch nào.", "info");

        const modalId = 'summary-detail-modal';
        if (document.getElementById(modalId)) document.getElementById(modalId).remove();

        const listHtml = txs.sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => {
            const isExcluded = t.excludeFromDashboard === true;
            const opacity = isExcluded ? '0.5' : '1';
            const textDecor = isExcluded ? 'line-through' : 'none';

            // --- LOGIC XỬ LÝ TRẠNG THÁI NỢ RIÊNG BIỆT ---
            let statusBadgeHTML = '';
            if (type === 'debt') {
                if (t.status === 'paid') {
                    // Xử lý nợ ĐÃ TRẢ
                    const payDate = new Date(t.date);
                    const dateStr = `${payDate.getDate()}/${payDate.getMonth() + 1}`;
                    const timeStr = payDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                    // Kiểm tra xem có phải trả nợ quá hạn không (Logic dựa trên BillingInfo của nguồn)
                    const billing = app.logic.getBillingInfo(t.source, t.date);
                    const isLate = payDate > billing.dueDate;
                    let lateInfo = '';
                    if (isLate) {
                        const diffDays = Math.ceil((payDate - billing.dueDate) / (1000 * 60 * 60 * 24));
                        lateInfo = `<span style="color:#ef4444; font-weight:bold;"> (Quá hạn ${diffDays}n)</span>`;
                    }

                    statusBadgeHTML = `
                        <div style="font-size:0.7rem; margin-top:2px;">
                            <span style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; font-weight:bold;">
                                <i class="fa-solid fa-check-double"></i> ĐÃ TRẢ ${dateStr}-${timeStr}
                            </span>
                            ${lateInfo}
                        </div>`;
                } else {
                    // Xử lý nợ ĐANG CẦN TRẢ
                    const billing = app.logic.getBillingInfo(t.source, t.date);
                    const now = new Date();
                    const isOverdue = now > billing.dueDate;

                    if (isOverdue) {
                        const diffDays = Math.ceil((now - billing.dueDate) / (1000 * 60 * 60 * 24));
                        statusBadgeHTML = `
                            <div style="font-size:0.7rem; margin-top:2px;">
                                <span style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px; font-weight:bold;">
                                    <i class="fa-solid fa-clock"></i> QUÁ HẠN ${diffDays} NGÀY
                                </span>
                            </div>`;
                    } else {
                        statusBadgeHTML = `<div style="font-size:0.7rem; color:#64748b; margin-top:2px;"><i>Đang trong hạn thanh toán</i></div>`;
                    }
                }
            }

            return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f1f5f9; opacity:${opacity};">
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:0.9rem; text-decoration:${textDecor}">${t.place}</div>
                    <div style="font-size:0.75rem; color:#64748b;">${new Date(t.date).toLocaleDateString('vi-VN')} • ${t.source}</div>
                    ${statusBadgeHTML}
                </div>
                <div style="text-align:right; margin-right:12px;">
                    <div style="font-family:var(--font-mono); font-weight:800; color:${isExcluded ? '#cbd5e1' : themeColor}; text-decoration:${textDecor}">
                        ${app.logic.formatCurrency(t.amount)}
                    </div>
                </div>
                <button onclick="app.ui.toggleDashboardExclusion(${t.id}, '${type}')" 
                    title="${isExcluded ? 'Tính lại vào tổng' : 'Loại trừ khỏi tổng'}"
                    style="border:2px solid #000; background:#fff; color:${isExcluded ? '#64748b' : themeColor}; width:34px; height:34px; border-radius:8px; cursor:pointer; box-shadow: 2px 2px 0px #000;">
                    <i class="${isExcluded ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}"></i>
                </button>
            </div>`;
        }).join('');

        const modalHtml = `
        <div id="${modalId}" class="modal-overlay active" style="z-index: 100060;">
            <div class="modal-box" style="max-width: 450px; border: 3px solid #000;">
                <div class="card-header">
                    <div class="card-title" style="color:${themeColor};"><i class="fa-solid fa-hand-holding-dollar"></i> ${title}</div>
                    <button class="btn-ghost" onclick="document.getElementById('${modalId}').remove()">&times;</button>
                </div>
                <div style="max-height: 450px; overflow-y: auto; padding-right:5px;">${listHtml}</div>
                <div style="margin-top:15px; font-size:0.7rem; color:#64748b; font-style:italic; text-align:center;">
                    * Các giao dịch được ghi nhận dựa trên dữ liệu thanh toán trong tháng.
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // Hàm Bật/Tắt loại trừ
    toggleDashboardExclusion(id, type) {
        const tx = app.data.transactions.find(t => t.id === id);
        if (tx) {
            tx.excludeFromDashboard = !tx.excludeFromDashboard;
            app.storage.save();
            app.ui.renderAll(); // Cập nhật lại con số trên Dashboard
            this.showSummaryDetail(type); // Vẽ lại danh sách trong Pop-up
        }
    },

    // Hàm loại bỏ nhanh
    excludeQuickTx(id, type) {
        app.ui.popup.confirm("Bạn có chắc muốn loại bỏ (Hủy) giao dịch này?", () => {
            const tx = app.data.transactions.find(t => t.id === id);
            if (tx) {
                tx.status = 'cancelled';
                app.storage.save();
                app.ui.renderAll();
                document.getElementById('summary-detail-modal').remove();
                this.showSummaryDetail(type);
                app.ui.popup.show("Đã loại bỏ!", "success");
            }
        });
    },

    toggleCancel(id) {
        const tx = app.data.transactions.find(t => t.id === id);
        if (!tx) return;

        // Hàm phụ trợ để refresh UI (Dùng chung cho cả Hủy và Khôi phục)
        const refreshUI = () => {
            app.storage.save();
            app.ui.renderAll();

            // [FIX] CẬP NHẬT VÍ / NGÂN HÀNG NGAY LẬP TỨC
            if (document.getElementById('modal-wallets').classList.contains('active')) {
                app.ui.modals.wallets.render();
                if (document.getElementById('modal-wallet-detail').classList.contains('active') && app.ui.modals.wallets.currentWalletId) {
                    app.ui.modals.wallets.openDetail(app.ui.modals.wallets.currentWalletId);
                }
            }
            if (document.getElementById('modal-banks').classList.contains('active')) {
                app.ui.modals.banks.render();
                // Đóng modal chi tiết bank để tránh hiển thị số dư cũ
                if (document.getElementById('modal-bank-detail').classList.contains('active')) {
                    document.getElementById('modal-bank-detail').classList.remove('active');
                }
            }
        };

        if (tx.status === 'cancelled') {
            // --- LOGIC KHÔI PHỤC (ĐÃ SỬA THEO YÊU CẦU CỦA BẠN) ---
            app.ui.popup.confirm(
                "Bạn muốn khôi phục lại giao dịch CŨ (giữ nguyên ngày giờ gốc)?\n\n👉 Bấm [ĐỒNG Ý]: Khôi phục lại giao dịch cũ.\n👉 Bấm [KHÔNG]: Tạo ra 1 giao dịch MỚI y hệt (Lấy ngày giờ hiện tại).",
                () => {
                    // --- NẾU CHỌN "ĐỒNG Ý": KHÔI PHỤC GIAO DỊCH CŨ ---
                    const isCreditSource = s => {
                        const lower = s.toLowerCase();
                        return lower.includes('momo') || lower.includes('zalo') || lower.includes('trả sau') || lower.includes('tín dụng');
                    };
                    if (tx.type === 'Thu nhập') tx.status = 'paid';
                    else if (isCreditSource(tx.source)) tx.status = 'pending';
                    else tx.status = 'paid';

                    delete tx.keepForZalo;

                    refreshUI();
                    app.ui.popup.show("Đã khôi phục giao dịch CŨ thành công!", "success");
                },
                () => {
                    // --- NẾU CHỌN "KHÔNG": TẠO GIAO DỊCH MỚI HOÀN TOÀN ---
                    const isCreditSource = s => {
                        const lower = s.toLowerCase();
                        return lower.includes('momo') || lower.includes('zalo') || lower.includes('trả sau') || lower.includes('tín dụng');
                    };

                    let newStatus = 'paid';
                    if (tx.type === 'Thu nhập') newStatus = 'paid';
                    else if (isCreditSource(tx.source)) newStatus = 'pending';

                    const now = new Date();
                    const offsetMs = now.getTimezoneOffset() * 60000;
                    const localISOTime = (new Date(now.getTime() - offsetMs)).toISOString().slice(0, -1);

                    // Tạo bản sao của giao dịch
                    const newTx = {
                        ...tx,
                        id: Date.now(), // Cấp ID hoàn toàn mới
                        date: localISOTime, // Lấy thời gian lúc bấm nút
                        status: newStatus
                    };

                    // Dọn dẹp các trường rác của việc hủy giao dịch trên bản sao
                    delete newTx.cancelledDate;
                    delete newTx.isCancelDateFixed;
                    delete newTx.keepForZalo;
                    delete newTx.forceStatementKey;

                    // Đẩy giao dịch mới vào mảng dữ liệu
                    app.data.transactions.push(newTx);

                    refreshUI();
                    app.ui.popup.show("Đã tạo giao dịch MỚI thành công!", "success");
                }
            );
        } else {
            // --- LOGIC HỦY GIAO DỊCH ---
            app.ui.popup.confirm(
                'Bạn có chắc muốn hủy giao dịch này?\nSố tiền sẽ không được tính vào tổng chi tiêu.',
                () => {
                    tx.status = 'cancelled';
                    tx.cancelledDate = new Date().toISOString();
                    tx.isCancelDateFixed = false;

                    // Logic Zalo Priority
                    const s = tx.source.toLowerCase();
                    const isZaloType = s.includes('zalo') && (s.includes('trả sau') || s.includes('priority'));

                    if (isZaloType) {
                        setTimeout(() => {
                            app.ui.popup.confirm(
                                'Giao dịch Zalo Priority!\nBạn có muốn GIỮ LẠI điểm tích lũy hạng cho giao dịch này không?',
                                () => {
                                    tx.keepForZalo = true;
                                    refreshUI();
                                    app.ui.popup.show('Đã hủy nhưng vẫn tính điểm Priority!', 'success');
                                }
                            );
                            // Nếu user bấm Cancel (Không giữ điểm)
                            if (!tx.keepForZalo) {
                                refreshUI();
                            }
                        }, 300);
                    } else {
                        refreshUI();
                        app.ui.popup.show("Đã hủy giao dịch!", "success");
                    }
                }
            );
        }
    },

    // Hàm lưu ngày hủy sau khi sửa
    saveCancelDate(id, dateStr) {
        const tx = app.data.transactions.find(t => t.id === id);
        if (tx) {
            if (confirm(`Xác nhận đổi ngày hủy thành:\n${new Date(dateStr).toLocaleString('vi-VN')}?\n\n(Lưu ý: Bạn chỉ được sửa mục này 1 lần)`)) {
                tx.cancelledDate = new Date(dateStr).toISOString();
                tx.isCancelDateFixed = true; // Khóa lại ngay sau khi lưu

                app.storage.save();
                app.ui.modals.history.open(); // Render lại để hiện trạng thái đã khóa
            } else {
                app.ui.modals.history.open(); // Reset lại nếu hủy
            }
        }
    },

    createStatement(statementKey) {
        if (!statementKey) return alert("Lỗi khóa sao kê!");
        app.data.createdStatements[statementKey] = true;
        app.storage.save();
        app.ui.renderAll();
        alert("Đã tạo bản sao kê thành công!");
    },

    // --- [MỚI] HÀM SỬA GIÁ TRỊ LINH HOẠT (GỐC / PHẠT / TĂNG THÊM) ---
    editDebtValue(groupKey, field, currentVal, title) {
        app.ui.popup.prompt(
            `${title}<br>Số hiện tại: <b>${app.logic.formatCurrency(currentVal)}</b><br>Nhập số mong muốn:`,
            (val) => {
                const newVal = Number(val.replace(/[^0-9]/g, ''));
                if (isNaN(newVal)) return;

                if (!app.data.configs.debtOverrides) app.data.configs.debtOverrides = {};

                // Lấy dữ liệu cũ (Xử lý tương thích ngược nếu cũ là số)
                let currentData = app.data.configs.debtOverrides[groupKey];
                if (typeof currentData !== 'object' || currentData === null) {
                    currentData = { principal: currentData }; // Chuyển đổi số cũ thành object
                }

                // Cập nhật trường cụ thể (principal, penalty, hoặc nextDay)
                currentData[field] = newVal;

                app.data.configs.debtOverrides[groupKey] = currentData;

                app.storage.save();
                app.ui.renderAll();
                app.ui.popup.show("✅ Đã cập nhật dữ liệu!", "success");
            },
            title.toUpperCase()
        );
    },

    restoreDebtOriginal(groupKey, field) {
        app.ui.popup.confirm(
            "Khôi phục về tính toán tự động?",
            () => {
                if (app.data.configs.debtOverrides && app.data.configs.debtOverrides[groupKey]) {
                    // Xóa trường cụ thể
                    delete app.data.configs.debtOverrides[groupKey][field];

                    // Nếu object rỗng thì xóa luôn key để tiết kiệm
                    if (Object.keys(app.data.configs.debtOverrides[groupKey]).length === 0) {
                        delete app.data.configs.debtOverrides[groupKey];
                    }

                    app.storage.save();
                    app.ui.renderAll();
                    app.ui.popup.show("Đã khôi phục dữ liệu gốc.", "success");
                }
            }
        );
    },

    renderDebts(debts) {
        const debtListEl = document.getElementById('debt-list');
        if (!debtListEl) return;

        let htmlBuilder = '';

        // --- BẮT ĐẦU ĐOẠN CODE XỬ LÝ TRẢ GÓP (CÓ NÚT XEM THÊM) ---
        Object.values(app.data.installmentPlans).forEach(plan => {
            // 1. Kiểm tra nếu đã trả hết thì ẩn
            const remaining = plan.payments.filter(p => !p.paid);
            if (remaining.length === 0) return;

            // 1. Tính tổng GỐC đã trả (Dùng p.breakdown.base nếu có, nếu không thì fallback về p.amount)
            const paidAmount = plan.payments.filter(p => p.paid).reduce((sum, p) => {
                const base = (p.breakdown && p.breakdown.base !== undefined) ? p.breakdown.base : p.amount;
                return sum + base;
            }, 0);

            // 2. Tính TỔNG GỐC CỦA GÓI (Để thanh % chạy đúng theo tiến độ gốc)
            const totalPrincipal = plan.payments.reduce((sum, p) => {
                const base = (p.breakdown && p.breakdown.base !== undefined) ? p.breakdown.base : p.amount;
                return sum + base;
            }, 0);

            // 3. Tính phần trăm dựa trên GỐC
            const progress = totalPrincipal > 0 ? Math.min(100, (paidAmount / totalPrincipal) * 100) : 0;

            // --- 2. LOGIC MÀU SẮC THƯƠNG HIỆU ---
            let progressBg = 'linear-gradient(90deg, #93c5fd, #3b82f6)'; // Mặc định: Xanh dương
            let iconHtml = '<i class="fa-solid fa-credit-card"></i>';
            const sLower = plan.source.toLowerCase();

            if (sLower.includes('shopee') || sLower.includes('spay')) {
                progressBg = 'linear-gradient(90deg, #fdba74, #ea580c)'; // Shopee: Cam
                iconHtml = '<img src="./assets/shopee.png" style="width:18px; vertical-align:middle; margin-right:4px;">';
            } else if (sLower.includes('momo')) {
                progressBg = 'linear-gradient(90deg, #f9a8d4, #db2777)'; // MoMo: Hồng
                iconHtml = '<img src="./assets/momo.png" style="width:18px; vertical-align:middle; margin-right:4px;">';
            } else if (sLower.includes('zalo')) {
                progressBg = 'linear-gradient(90deg, #6ee7b7, #059669)'; // Zalo: Xanh lá
                iconHtml = '<img src="./assets/zalo.png" style="width:18px; vertical-align:middle; margin-right:4px;">';
            }

            let targetDate = 5;
            if (plan.isShopee || plan.source.toLowerCase().includes('shopee')) {
                targetDate = 2;
            }
            // --- 3. LOGIC TÍNH PHẠT (GIỮ NGUYÊN CỦA BẠN) ---
            let totalDynamicPenalty = 0;
            const [filterY, filterM] = app.data.filter.month.split('-').map(Number);
            const limitDateStr = `${filterY}-${String(filterM).padStart(2, '0')}`;

            plan.payments.forEach(p => {
                if (!p.paid) {
                    const [y, m] = p.date.split('-').map(Number);
                    const dueDate = new Date(y, m, targetDate, 23, 59, 59);
                    const now = new Date();
                    if (now > dueDate) {
                        const daysOverdue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
                        if (daysOverdue > 0) {
                            let rate = 0.05;
                            if (daysOverdue >= 15) rate = 0.20;
                            else if (daysOverdue >= 10) rate = 0.15;
                            else if (daysOverdue >= 5) rate = 0.10;
                            const penaltyAmt = Math.round((p.breakdown.base || 0) * rate);
                            totalDynamicPenalty += penaltyAmt;
                            p.isOverdue = true;
                            p.overdueDays = daysOverdue;
                            p.penaltyAmt = penaltyAmt;
                        }
                    }
                }
            });

            const totalPenaltyDisplay = (plan.preservedPenalty || 0) + totalDynamicPenalty;

            // Render khung cảnh báo phạt (nếu có)
            let extraPenaltyHTML = '';
            if (totalPenaltyDisplay > 0) {
                let waiveBtn = (plan.preservedPenalty > 0 && !plan.penaltyWaived) ? `<span onclick="app.ui.waivePenalty(${plan.id})" style="cursor:pointer; color:var(--text-muted); text-decoration:underline; margin-left:8px; font-size:0.7rem;" title="Xóa phạt cũ"><i class="fa-solid fa-trash"></i> Xóa</span>` : '';
                extraPenaltyHTML = `<div style="background:#fff5f5; border:1px dashed #fc8181; border-radius:8px; padding:8px; margin-bottom:12px; font-size:0.8rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#c53030; font-weight:700"><i class="fa-solid fa-fire"></i> Phạt cộng dồn:</span>
                        <span style="color:#c53030; font-weight:800; font-family:var(--font-mono)">${app.logic.formatCurrency(totalPenaltyDisplay)}</span>
                    </div>
                    ${plan.preservedPenalty ? `<div style="text-align:right; font-size:0.65rem; color:#718096; margin-top:2px;">(Cũ: ${app.logic.formatCurrency(plan.preservedPenalty)}${waiveBtn})</div>` : ''}
                </div>`;
            }

            const createdDate = new Date(plan.createdDate);
            const now = new Date();
            const isSameMonth = (createdDate.getMonth() === now.getMonth()) && (createdDate.getFullYear() === now.getFullYear());
            const undoBtnHTML = isSameMonth ? `<button class="btn-ghost btn-sm" onclick="app.ui.cancelInstallment(${plan.id})" style="color:var(--danger); border:1px solid #fee2e2; background:#fff5f5; border-radius:6px; padding:2px 8px; font-size:0.7rem; margin-left:8px;" title="Hủy gói trả góp"><i class="fa-solid fa-rotate-left"></i> Hủy</button>` : '';

            // --- 4. RENDER LIST KỲ CON ---
            let hiddenCount = 0;
            const checklistHTML = plan.payments.map((p, index) => {
                if (p.paid) return '';

                let rowStyle = '';
                let rowClass = '';
                if (p.date > limitDateStr && !p.isOverdue) {
                    hiddenCount++;
                    rowStyle = 'display:none';
                    rowClass = `future-item-${plan.id}`;
                }

                const [y, m] = p.date.split('-').map(Number);
                const dueDate = new Date(y, m, targetDate);
                const dueStr = `${dueDate.getDate()}/${dueDate.getMonth() + 1}`;

                // Tính toán số hiển thị
                const totalDue = p.amount + (p.penaltyAmt || 0); // Tổng kỳ = Gốc kỳ + Phạt kỳ
                const paidSoFar = p.paidAmount || 0;
                const remainingPeriod = totalDue - paidSoFar;

                let highlightStyle = p.date === app.data.filter.month ? 'color:var(--primary); font-weight:700;' : '';
                let overdueBadge = p.isOverdue ? `<span style="font-size:0.6rem; color:#fff; background:#f56565; padding:1px 4px; border-radius:3px; margin-left:4px;">Trễ ${p.overdueDays} ngày</span>` : '';
                if (p.isOverdue) highlightStyle = 'color:#e53e3e; font-weight:700;';

                const customPayBtn = `<i class="fa-solid fa-money-bill-wave" 
    onclick="event.preventDefault(); app.ui.payInstallmentCustom(${plan.id}, '${p.date}', ${remainingPeriod})" 
    style="font-size:0.7rem; color:#10b981; cursor:pointer; margin-left:8px;" 
    title="Trả số tiền khác (Trả một phần)"></i>`;

                const editBtn = `<i class="fa-solid fa-pencil" 
                    onclick="event.preventDefault(); app.ui.editInstallmentPeriod(${plan.id}, '${p.date}', ${p.amount})" 
                    style="font-size:0.7rem; color:var(--text-muted); cursor:pointer; margin-left:6px; opacity:0.6;" 
                    title="Sửa số tiền kỳ này"></i>`;

                // Logic nút Xóa (Chỉ hiện cho Shopee)
                let deletePeriodBtn = '';
                if (plan.isShopee) {
                    deletePeriodBtn = `<i class="fa-solid fa-trash-can" 
                        onclick="event.preventDefault(); app.ui.deleteShopeePeriod(${plan.id}, '${p.date}')" 
                        style="font-size:0.7rem; color:#ef4444; cursor:pointer; margin-left:8px; opacity:0.5; transition:0.2s" 
                        onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'"
                        title="Xóa kỳ này (Tối đa 3 kỳ)"></i>`;
                }

                return `<div class="action-row ${rowClass}" style="padding: 8px 0; border-bottom:1px dashed #f1f5f9; ${rowStyle}">
    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; width:100%">
        <input type="checkbox" class="payment-checkbox" data-plan-id="${plan.id}" data-date="${p.date}" style="accent-color:var(--primary);">
        <div style="flex:1">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="${highlightStyle}">Kỳ ${p.date} ${overdueBadge}</span>
                
                <span style="font-family:var(--font-mono); font-weight:600; font-size:0.9rem; ${highlightStyle}">
                    ${app.logic.formatCurrency(remainingPeriod)}
                    ${customPayBtn}  ${editBtn}
                    ${deletePeriodBtn}
                </span>

            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); display:flex; justify-content:space-between;">
                <span>Hạn: ${dueStr}</span>
                <span>(Gốc: ${app.logic.formatCurrency(p.breakdown.base)})</span>
            </div>
        </div>
    </label>
</div>`;
            }).join('');

            let toggleBtn = '';
            if (hiddenCount > 0) {
                const scriptShow = `document.querySelectorAll('.future-item-${plan.id}').forEach(el => el.style.display = ''); this.style.display='none';`;
                toggleBtn = `<div onclick="${scriptShow}" style="text-align:center; font-size:0.75rem; color:var(--primary); padding:8px 0; cursor:pointer; font-weight:600; margin-top:4px;">
                    Xem thêm ${hiddenCount} kỳ nữa <i class="fa-solid fa-chevron-down"></i>
                </div>`;
            }

            if (checklistHTML.trim() !== "") {
                htmlBuilder += `<div class="plan" style="background:white; border-radius:12px; border:1px solid #e2e8f0; padding:12px; margin-bottom:12px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                    
                    <div class="plan-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px">
                        <div style="display:flex; flex-direction:column;">
                            <div style="font-weight:800; font-size:0.95rem; color:var(--text-main); display:flex; align-items:center;">
                                ${iconHtml} ${plan.source}
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Tổng vay: ${app.logic.formatCurrency(plan.totalRepayment)}</div>
                        </div>
                        ${undoBtnHTML}
                    </div>

                    ${extraPenaltyHTML}

                    <div style="margin-bottom: 16px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:6px; font-weight:600; color:var(--text-muted)">
                            <span>Đã trả: <b style="color:var(--success)">${app.logic.formatCurrency(paidAmount)}</b></span>
                            <span>${Math.round(progress)}%</span>
                        </div>
                        <div style="height:10px; background:#f1f5f9; border-radius:10px; overflow:hidden; border:1px solid #e2e8f0; position:relative;">
                            <div style="height:100%; background: ${progressBg}; width: ${progress}%; border-radius:10px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 2px 0 4px rgba(0,0,0,0.1);"></div>
                        </div>
                    </div>

                    <div style="max-height: 250px; overflow-y: auto;">
                        ${checklistHTML}
                    </div>
                    ${toggleBtn}
                </div>`;
            }
        });
        // --- KẾT THÚC CODE TRẢ GÓP ---


        // GROUP DEBTS BY SOURCE AND DUE DATE
        // GROUP DEBTS BY SOURCE AND DUE DATE
        const grouped = debts.reduce((acc, t) => {
            const src = app.logic.normalizeSource(t.source);
            let key, safeDateStr, billing;

            if (t.forceStatementKey) {
                key = t.forceStatementKey;
                safeDateStr = key.split('::')[1];
                const [y, m, d] = safeDateStr.split('-').map(Number);
                billing = {
                    dueDate: new Date(y, m - 1, d),
                    statementDate: new Date(y, m - 1, 1)
                };
            } else {
                billing = app.logic.getBillingInfo(t.source, t.date);
                safeDateStr = `${billing.dueDate.getFullYear()}-${String(billing.dueDate.getMonth() + 1).padStart(2, '0')}-${String(billing.dueDate.getDate()).padStart(2, '0')}`;
                key = `${src}::${safeDateStr}`;
            }

            if (!acc[key]) acc[key] = {
                source: src,
                dueDate: billing.dueDate,
                statementDate: billing.statementDate,
                safeDateStr: safeDateStr,
                total: 0,
                fee: 0,
                txs: []
            };

            // --- [LOGIC MỚI] TÍNH PHÍ 2.95% CHO SHOPEE PAY ---
            let extraFee = 0;
            const sLower = t.source.toLowerCase();
            const brandLower = (t.brand || '').toLowerCase();
            const tagsLower = (t.tags || '').toLowerCase();

            // Kiểm tra nguồn là ShopeePay
            if (sLower.includes('shopee') || sLower.includes('spay')) {
                // Kiểm tra điều kiện: ShopeeFood HOẶC Nạp tiền/thẻ HOẶC Dịch vụ/QR
                const isShopeeFood = brandLower.includes('shopeefood');
                const isService = tagsLower.includes('#nạp tiền') ||
                    tagsLower.includes('#nạp thẻ') ||
                    tagsLower.includes('dịch vụ') ||
                    tagsLower.includes('quét qr');

                if (isShopeeFood || isService) {
                    extraFee = Math.round(t.amount * 0.0295); // 2.95%
                    t.tempExtraFee = extraFee; // Lưu tạm để lát hiển thị ghi chú
                }
            } else if (sLower.includes('tiktok')) {
                // TikTok PayLater luôn tính phí 2.95% trên mỗi giao dịch
                extraFee = Math.round(t.amount * 0.0295);
                t.tempExtraFee = extraFee;
            }
            // -------------------------------------------------

            if (t.tags && t.tags.includes('#phi_dich_vu')) {
                acc[key].fee += t.amount;
            } else {
                acc[key].total += (t.amount + extraFee); // Cộng cả gốc lẫn phí vào tổng nợ
            }

            acc[key].txs.push(t);
            return acc;
        }, {});

        Object.values(grouped).sort((a, b) => a.dueDate - b.dueDate).forEach(data => {
            // [MỚI] Lấy dữ liệu Override đa năng
            const groupKey = `${data.source}::${data.safeDateStr}`;
            let overrideData = app.data.configs.debtOverrides ? app.data.configs.debtOverrides[groupKey] : undefined;

            // Chuẩn hóa data cũ (nếu chỉ là số) về dạng object để tránh lỗi
            if (typeof overrideData === 'number') overrideData = { principal: overrideData };

            let isModified = false;

            // 1. Áp dụng Gốc (nếu có)
            if (overrideData && overrideData.principal !== undefined) {
                data.total = overrideData.principal;
                isModified = true;
            }

            // Điều kiện ẩn: Nếu tổng = 0, phí = 0 VÀ không bị sửa đổi thì mới ẩn
            if (data.total === 0 && data.fee === 0 && !isModified) return;

            // [MỚI] Tạo nút sửa GỐC
            let modifiedStatusHTML = '';
            let editBtnHTML = '';

            // Icon sửa gốc (Gọi hàm editDebtValue mới)
            const editPrincipalAction = `onclick="app.ui.editDebtValue('${groupKey}', 'principal', ${data.total}, 'Sửa Dư Nợ Gốc')"`;

            if (overrideData && overrideData.principal !== undefined) {
                modifiedStatusHTML = `<span onclick="app.ui.restoreDebtOriginal('${groupKey}', 'principal')" style="cursor:pointer; font-size:0.7rem; color:var(--danger); margin-top:2px; display:block;">(Đã sửa gốc - Bấm để khôi phục)</span>`;
                editBtnHTML = `<i class="fa-solid fa-pencil" ${editPrincipalAction} style="cursor:pointer; color:var(--text-muted); font-size:0.8rem; margin-left:6px;" title="Sửa dư nợ gốc"></i>`;
            } else {
                editBtnHTML = `<i class="fa-solid fa-pencil" ${editPrincipalAction} style="cursor:pointer; color:var(--primary); font-size:0.8rem; margin-left:6px; opacity:0.5;" title="Sửa dư nợ gốc"></i>`;
            }

            // [FIX QUAN TRỌNG 1] TẠO DANH SÁCH ID CỦA NHÓM NÀY
            // Để khi trả nợ, chỉ gạch đúng các giao dịch này, không gạch nhầm tháng sau
            const groupTxIds = data.txs.map(t => t.id).join(',');

            let penaltyHTML = '';
            let lateFee = 0;
            const source = data.source;
            const dueDate = data.dueDate;
            const statementDate = data.statementDate;

            const now = new Date();
            const diffTime = now - dueDate;
            const daysOverdue = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

            const isStatementOpen = now >= statementDate;
            const statementKey = `${source}_${data.safeDateStr}`;
            const sourceId = source.replace(/\s/g, '') + dueDate.getTime();

            const isCreated = app.data.createdStatements ? app.data.createdStatements[statementKey] : false;

            const supportsManualStatement = source.includes('MoMo') || source.includes('Zalo');

            if (isStatementOpen && supportsManualStatement && !isCreated) {
                const totalPreview = data.total + data.fee;
                htmlBuilder += `
                            <div class="plan" style="border: 1px dashed var(--primary); background: rgba(0, 104, 255, 0.05);">
                                <div class="plan-header" style="display:flex; justify-content:space-between; margin-bottom:0.5rem; align-items:center;">
                                    <h4 style="color:white;"><i class="fa-solid fa-file-invoice"></i> Sao Kê ${source}</h4>
                                    <span class="badge badge-warning">Đến kỳ sao kê</span>
                                </div>
                                <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
                                    Bạn có dư nợ cần thanh toán trong kỳ này. Nhấn nút bên dưới để tạo bản sao kê chi tiết và bắt đầu trả nợ.
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; background: rgba(0,0,0,0.2); padding: 0.5rem 1rem; border-radius:12px;">
                                    <span style="font-size:0.9rem; color:var(--text-muted)">Tạm tính: <b>${app.logic.formatCurrency(totalPreview)}</b></span>
                                    <button class="btn btn-primary" onclick="app.ui.createStatement('${statementKey}')">
                                        <i class="fa-solid fa-bolt"></i> Tạo Sao Kê
                                    </button>
                                </div>
                            </div>
                        `;
                return;
            }

            if (daysOverdue > 0) {
                if (source.toLowerCase().includes('trả sau momo') || source.includes('Trả góp')) {
                    const totalOverdue = data.total + data.fee;
                    if (daysOverdue >= 15) lateFee = totalOverdue * 0.20;
                    else if (daysOverdue >= 10) lateFee = totalOverdue * 0.15;
                    else if (daysOverdue >= 5) lateFee = totalOverdue * 0.10;
                    else lateFee = totalOverdue * 0.05;
                    lateFee = Math.round(lateFee);
                }
                else if (source.includes('Zalo')) {
                    const baseRate = 0.24;
                    const penaltyRatePrincipal = baseRate * 1.5;
                    const penaltyRateFee = 0.10;
                    const dailyPrincipalPenalty = (data.total * penaltyRatePrincipal) / 365;
                    const dailyFeePenalty = (data.fee * penaltyRateFee) / 365;
                    lateFee = Math.round((dailyPrincipalPenalty + dailyFeePenalty) * daysOverdue);
                }
                else if (source.toLowerCase().includes('shopee') || source.toLowerCase().includes('spay')) {
                    lateFee = 30000; // Phí phạt cố định 30k/kỳ theo yêu cầu
                }
            }

            // --- HIỂN THỊ CẢNH BÁO ---
            // --- [CẬP NHẬT MỚI] ĐỒNG BỘ LOGIC TÍNH PHẠT ZALO (TIME MACHINE) ---

            // 1. TÍNH TOÁN PHÍ PHẠT LÝ THUYẾT (TỔNG TỪ ĐẦU ĐẾN GIỜ)
            let totalTheoreticalPenalty = 0; // Tổng phạt phải đóng từ đầu
            let dailyPenaltyPreview = 0;     // Dự tính tăng thêm ngày mai
            let penaltyExplanation = '';     // Diễn giải (nếu cần)

            // Chuẩn hóa thời gian về đầu ngày (00:00:00) để tính toán chính xác
            const dueDayStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
            const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

            if (daysOverdue > 0) {
                if (source.includes('Zalo')) {
                    // --- LOGIC ZALO: TÍNH LẠI LỊCH SỬ SỐ DƯ (KHỚP APP 100%) ---

                    // A. Tìm các khoản ĐÃ TRẢ (Gốc/Phí) sau hạn để cộng ngược lại
                    const relevantPayments = app.data.transactions.filter(t => {
                        if (t.status !== 'paid') return false;
                        const s = t.source.toLowerCase();
                        const isZalo = s.includes('zalo') || s.includes('priority');
                        const tags = t.tags || "";
                        // Chỉ lấy giao dịch trả nợ gốc/phí (không tính trả phạt)
                        const isPayPrincipal = tags.includes('#thanh_toan_no') || tags.includes('#thanh_toan_phi');
                        return isZalo && isPayPrincipal && new Date(t.date).getTime() >= dueDayStart;
                    });

                    // B. Tái hiện Dư nợ gốc ban đầu (Lúc mới quá hạn)
                    const currentPending = data.total + data.fee;
                    const paidPrincipalTotal = relevantPayments.reduce((sum, t) => sum + t.amount, 0);
                    const originalPrincipal = currentPending + paidPrincipalTotal;

                    // C. Vòng lặp tính lãi từng ngày (Từ ngày quá hạn -> Hôm nay)
                    let accumulatedPenalty = 0;
                    let loopTime = dueDayStart + 86400000; // Bắt đầu tính từ ngày kế tiếp
                    const dailyRate = 0.001; // 0.1% / ngày

                    while (loopTime <= nowStartOfDay) {
                        // Tính dư nợ tại ngày 'loopTime'
                        const paidBeforeThisDay = relevantPayments.reduce((sum, t) => {
                            if (new Date(t.date).getTime() < loopTime) return sum + t.amount;
                            return sum;
                        }, 0);

                        const dailyBalance = Math.max(0, originalPrincipal - paidBeforeThisDay);
                        accumulatedPenalty += dailyBalance * dailyRate;

                        loopTime += 86400000; // +1 ngày
                    }

                    totalTheoreticalPenalty = Math.round(accumulatedPenalty);

                    // D. Tính dự báo ngày mai (Dựa trên dư nợ thực tế hiện tại)
                    // Dư nợ hiện tại = Gốc ban đầu - Tổng đã trả
                    const currentRealBalance = Math.max(0, originalPrincipal - relevantPayments.reduce((s, t) => s + t.amount, 0));
                    dailyPenaltyPreview = Math.round(currentRealBalance * dailyRate);

                } else if (source.toLowerCase().includes('momo') || source.toLowerCase().includes('ví trả sau')) {
                    // [FIX] Khai báo totalBaseForPenalty trước khi sử dụng
                    let momoInstOverdueAmount = 0;
                    if (app.data.installmentPlans) {
                        Object.values(app.data.installmentPlans).forEach(plan => {
                            if (plan.source.toLowerCase().includes('momo')) {
                                // Lấy các kỳ chưa trả và ngày <= tháng hiện tại
                                const unpaid = plan.payments.filter(p => !p.paid && p.date <= app.data.filter.month);
                                momoInstOverdueAmount += unpaid.reduce((sum, p) => sum + p.amount, 0);
                            }
                        });
                    }
                    // Tổng gốc để tính phạt = (Gốc Ví + Phí DV) + (Trả góp quá hạn)
                    const totalBaseForPenalty = data.total + data.fee + momoInstOverdueAmount;

                    // Logic MoMo (Giữ nguyên nhưng dùng biến đã khai báo)
                    if (daysOverdue >= 15) totalTheoreticalPenalty = (totalBaseForPenalty * 0.20) + Number.EPSILON;
                    else if (daysOverdue >= 10) totalTheoreticalPenalty = (totalBaseForPenalty * 0.15) + Number.EPSILON;
                    else if (daysOverdue >= 5) totalTheoreticalPenalty = (totalBaseForPenalty * 0.10) + Number.EPSILON;
                    else totalTheoreticalPenalty = (totalBaseForPenalty * 0.05) + Number.EPSILON;

                    // Làm tròn số cuối cùng
                    totalTheoreticalPenalty = Math.round(totalTheoreticalPenalty);

                } else if (source.toLowerCase().includes('shopee') || source.toLowerCase().includes('spay') || source.toLowerCase().includes('tiktok')) {
                    totalTheoreticalPenalty = 30000;
                }
            }
            // 2. TÍNH SỐ TIỀN PHẠT ĐÃ ĐÓNG (QUÉT LỊCH SỬ)
            const paidPenalty = app.data.transactions.reduce((sum, t) => {
                const s = t.source.toLowerCase();
                // Chỉ tính các giao dịch trả phạt (#nop_phat)
                if (t.status === 'paid' && t.tags && t.tags.includes('#nop_phat') &&
                    (s.includes('zalo') || s.includes('priority') || s.includes(source.toLowerCase())) &&
                    new Date(t.date).getTime() >= dueDayStart) {
                    return sum + t.amount;
                }
                return sum;
            }, 0);

            // 3. TÍNH SỐ PHẠT CÒN LẠI CẦN HIỂN THỊ
            lateFee = Math.max(0, totalTheoreticalPenalty - paidPenalty);


            // 4. HIỂN THỊ CẢNH BÁO (GIAO DIỆN MỚI)
            if (daysOverdue > 0) {
                if (source.includes('Zalo')) {
                    // --- GIAO DIỆN ZALO ALERT (CÓ CHỨC NĂNG SỬA) ---

                    // 1. Kiểm tra Override cho PHẠT
                    let isPenaltyModified = false;
                    if (overrideData && overrideData.penalty !== undefined) {
                        lateFee = overrideData.penalty; // Gán đè số phạt
                        isPenaltyModified = true;
                    }

                    // 2. Kiểm tra Override cho DỰ TÍNH TĂNG
                    let isNextDayModified = false;
                    if (overrideData && overrideData.nextDay !== undefined) {
                        dailyPenaltyPreview = overrideData.nextDay; // Gán đè số dự tính
                        isNextDayModified = true;
                    }

                    const isPaidFull = lateFee <= 0 && totalTheoreticalPenalty > 0 && !isPenaltyModified;

                    // Nút sửa Phạt
                    const editPenaltyBtn = `<i class="fa-solid fa-pencil" 
                        onclick="app.ui.editDebtValue('${groupKey}', 'penalty', ${lateFee}, 'Sửa Tiền Phạt')" 
                        style="font-size:0.8rem; color:${isPenaltyModified ? 'var(--text-main)' : 'rgba(220, 38, 38, 0.4)'}; cursor:pointer; margin-left:8px;" 
                        title="Sửa số tiền phạt"></i>`;

                    // Nút khôi phục Phạt (nếu đã sửa)
                    const restorePenaltyBtn = isPenaltyModified ?
                        `<div onclick="app.ui.restoreDebtOriginal('${groupKey}', 'penalty')" style="font-size:0.6rem; text-decoration:underline; cursor:pointer; opacity:0.7; margin-top:-4px; margin-bottom:4px;">(Khôi phục mặc định)</div>` : '';

                    // Nút sửa Dự tính ngày mai
                    const editNextDayBtn = `<i class="fa-solid fa-pencil" 
                        onclick="app.ui.editDebtValue('${groupKey}', 'nextDay', ${dailyPenaltyPreview}, 'Sửa Dự Tính Tăng')" 
                        style="font-size:0.7rem; color:${isNextDayModified ? 'var(--danger)' : 'rgba(185, 28, 28, 0.3)'}; cursor:pointer; margin-left:4px;" 
                        title="Sửa dự tính"></i>`;

                    penaltyHTML = `
                        <div class="zalo-alert-box" style="margin: 10px 0; border: 2px solid #b91c1c; border-radius: 12px; overflow: hidden; background: #fff5f5; position: relative;">
                            
                            <div style="background: #b91c1c; color: white; padding: 6px 12px; font-weight: 800; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                                <span><i class="fa-solid fa-bell fa-shake"></i> BÁO ĐỘNG: QUÁ HẠN ${daysOverdue} NGÀY</span>
                                <span style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">Lãi 0.1%/ngày</span>
                            </div>

                            <div style="padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                
                                <div style="font-size: 0.75rem; color: #7f1d1d; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">
                                    Tiền phạt cần đóng ${editPenaltyBtn}
                                </div>
                                ${restorePenaltyBtn}
                                <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.8rem; font-weight: 900; color: #dc2626; letter-spacing: -1px; line-height: 1.2;">
                                    ${app.logic.formatCurrency(lateFee)}
                                </div>

                                ${!isPenaltyModified ? (isPaidFull
                            ? `<div style="margin-top: 4px; font-size: 0.7rem; color: #166534; background: #dcfce7; padding: 2px 8px; border-radius: 99px; font-weight: 700; border: 1px solid #bbf7d0;">
                                            <i class="fa-solid fa-check"></i> Đã đóng đủ phạt tính đến hôm nay
                                       </div>`
                            : `<div style="margin-top: 4px; font-size: 0.7rem; color: #991b1b; opacity: 0.8;">
                                            (Tổng phạt: ${app.logic.formatCurrency(totalTheoreticalPenalty)} - Đã đóng: ${app.logic.formatCurrency(paidPenalty)})
                                       </div>`) : ''
                        }

                                <div style="width: 100%; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #fca5a5; display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;">
                                    <div style="color: #b91c1c; display:flex; align-items:center;">
                                        <span><i class="fa-solid fa-arrow-trend-up"></i> Mai tăng thêm: <b>+${app.logic.formatCurrency(dailyPenaltyPreview)}</b></span>
                                        ${editNextDayBtn}
                                        ${isNextDayModified ? `<i class="fa-solid fa-rotate-left" onclick="app.ui.restoreDebtOriginal('${groupKey}', 'nextDay')" style="margin-left:4px; cursor:pointer; opacity:0.6;" title="Khôi phục"></i>` : ''}
                                    </div>
                                    <div style="color: #7f1d1d;">
                                        Hạn: <b>${dueDate.getDate()}/${dueDate.getMonth() + 1}/${dueDate.getFullYear()}</b>
                                    </div>
                                </div>

                            </div>
                            <div style="height: 4px; background: repeating-linear-gradient(45deg, #b91c1c, #b91c1c 10px, #fee2e2 10px, #fee2e2 20px);"></div>
                        </div>`;

                } else if (source.toLowerCase().includes('momo') || source.toLowerCase().includes('ví trả sau')) {
                    // --- GIAO DIỆN MOMO (ĐÃ CẬP NHẬT LOGIC 4 CẤP ĐỘ + TRẢ GÓP) ---

                    // 1. Tính thêm nợ trả góp quá hạn để cộng vào cơ sở tính phạt
                    let momoInstOverdueAmount = 0;
                    if (app.data.installmentPlans) {
                        Object.values(app.data.installmentPlans).forEach(plan => {
                            if (plan.source.toLowerCase().includes('momo')) {
                                // Lấy các kỳ chưa trả và ngày <= tháng hiện tại (coi là quá hạn/đến hạn)
                                const unpaid = plan.payments.filter(p => !p.paid && p.date <= app.data.filter.month);
                                momoInstOverdueAmount += unpaid.reduce((sum, p) => sum + p.amount, 0);
                            }
                        });
                    }

                    // Tổng dùng để tính phạt = (Gốc Ví + Phí DV) + (Trả góp quá hạn)
                    const totalBaseForPenalty = data.total + data.fee + momoInstOverdueAmount;

                    // 2. Tính lại tiền phạt theo 4 cấp độ
                    if (daysOverdue >= 15) totalTheoreticalPenalty = totalBaseForPenalty * 0.20;       // 20%
                    else if (daysOverdue >= 10) totalTheoreticalPenalty = totalBaseForPenalty * 0.15;  // 15%
                    else if (daysOverdue >= 5) totalTheoreticalPenalty = totalBaseForPenalty * 0.10;   // 10%
                    else totalTheoreticalPenalty = totalBaseForPenalty * 0.05;                         // 5%

                    totalTheoreticalPenalty = Math.round(totalTheoreticalPenalty);

                    // 3. Kiểm tra Override (Giữ nguyên logic cũ)
                    let isPenaltyModified = false;
                    if (overrideData && overrideData.penalty !== undefined) {
                        lateFee = overrideData.penalty; // Gán đè số phạt
                        isPenaltyModified = true;
                    } else {
                        // Nếu không override thì hiển thị số tính toán lý thuyết (đã trừ đi phần đã đóng nếu có logic đó)
                        lateFee = totalTheoreticalPenalty;
                    }

                    // 4. Tạo nút sửa (Bút chì) - Giữ nguyên
                    const editPenaltyBtn = `<i class="fa-solid fa-pencil" 
                    onclick="app.ui.editDebtValue('${groupKey}', 'penalty', ${lateFee}, 'Sửa Tiền Phạt MoMo')" 
                    style="font-size:0.9rem; color:${isPenaltyModified ? '#fff' : 'rgba(255,255,255,0.4)'}; cursor:pointer; margin-left:10px; transition:0.2s" 
                    title="Sửa số tiền phạt"></i>`;

                    // Nút khôi phục (nếu đã sửa) - Giữ nguyên
                    const restoreBtn = isPenaltyModified ?
                        `<div onclick="app.ui.restoreDebtOriginal('${groupKey}', 'penalty')" style="font-size:0.65rem; text-decoration:underline; cursor:pointer; opacity:0.9; margin-top:2px; color:#fce7f3;">(Khôi phục gốc)</div>` : '';

                    // 5. Logic hiển thị cấp độ (Cập nhật text hiển thị 4 cấp)
                    let levelText = "CẤP 1 (5%)";
                    let levelIcon = "fa-biohazard";
                    let shakeClass = ""; // Cấp 1 chưa rung mạnh

                    if (daysOverdue >= 15) {
                        levelText = "CẤP 4 (MAX - 20%)";
                        levelIcon = "fa-skull-crossbones";
                        shakeClass = "critical"; // Rung mạnh
                    }
                    else if (daysOverdue >= 10) {
                        levelText = "CẤP 3 (15%)";
                        levelIcon = "fa-radiation";
                        shakeClass = "critical";
                    }
                    else if (daysOverdue >= 5) {
                        levelText = "CẤP 2 (10%)";
                        levelIcon = "fa-bomb";
                    }

                    // HTML hiển thị - Giữ nguyên khung cũ
                    penaltyHTML = `
                        <div class="momo-alert-box ${shakeClass}">
                            <div class="momo-tape"></div>
                            <div class="momo-alert-header">
                                <span><i class="fa-solid ${levelIcon}"></i> QUÁ HẠN ${daysOverdue} NGÀY</span>
                                <span class="momo-badge-level">${levelText}</span>
                            </div>
                            <div style="padding: 1rem; color: #831843;">
                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 0.5rem;">
                                    <div style="font-weight:bold; font-size:0.9rem;">PHÍ PHẠT CÒN LẠI:</div>
                                    <div style="text-align:right">
                                        <div style="font-family:'JetBrains Mono'; font-size:1.5rem; font-weight:900; color:#db2777; text-shadow: 1px 1px 0px #fce7f3; display:flex; align-items:center; justify-content:flex-end;">
                                            ${app.logic.formatCurrency(lateFee)} ${editPenaltyBtn}
                                        </div>
                                        ${restoreBtn}
                                    </div>
                                </div>
                                <div style="margin-top: 0.5rem; font-size: 0.75rem; text-align: right; font-style:italic; opacity: 0.8;">
                                    (Tính trên: ${app.logic.formatCurrency(totalBaseForPenalty)})
                                    <br>Hạn chót: ${dueDate.getDate()}/${dueDate.getMonth() + 1}/${dueDate.getFullYear()}
                                </div>
                            </div>
                        </div>`;
                } else {
                    // --- GIAO DIỆN SHOPEE / KHÁC (ĐÃ CẬP NHẬT NÚT SỬA) ---

                    // 1. Kiểm tra Override Phạt
                    let isPenaltyModified = false;
                    if (overrideData && overrideData.penalty !== undefined) {
                        lateFee = overrideData.penalty;
                        isPenaltyModified = true;
                    }

                    // 2. Tạo nút sửa
                    const editPenaltyBtn = `<i class="fa-solid fa-pencil" 
                    onclick="app.ui.editDebtValue('${groupKey}', 'penalty', ${lateFee}, 'Sửa Tiền Phạt')" 
                    style="font-size:0.8rem; color:${isPenaltyModified ? '#c2410c' : 'rgba(194, 65, 12, 0.4)'}; cursor:pointer; margin-left:6px;" 
                    title="Sửa số tiền phạt"></i>`;

                    const restoreBtn = isPenaltyModified ?
                        `<span onclick="app.ui.restoreDebtOriginal('${groupKey}', 'penalty')" style="font-size:0.65rem; text-decoration:underline; cursor:pointer; opacity:0.7; margin-left:6px;">(Khôi phục)</span>` : '';

                    penaltyHTML = `<div class="warning-box" style="background: #fff7ed; border: 1px solid #f97316; color: #9a3412; padding: 10px; border-radius: 8px; margin: 10px 0;">
                            <div style="font-weight:bold"><i class="fa-solid fa-triangle-exclamation"></i> QUÁ HẠN ${daysOverdue} NGÀY</div>
                            <div style="font-size:1.1em; margin-top:4px; font-weight: 800; color: #c2410c; display:flex; align-items:center;">
                                Phạt còn lại: ${app.logic.formatCurrency(lateFee)}
                                ${editPenaltyBtn}
                                ${restoreBtn}
                            </div>
                        </div>`;
                }
            }
            // --- [KẾT THÚC ĐOẠN CODE THAY THẾ] ---

            const totalPay = data.total + data.fee + lateFee;
            let actionsHTML = '';

            // [FIX 2] THÊM data-ids VÀO NÚT TRẢ PHÍ
            if (data.fee > 0) {
                actionsHTML += `<div class="action-row" style="margin-bottom: 0.5rem; background: #fffbe6; border: 1px dashed #f59e0b;">
                            <label style="display:flex; align-items:center; gap:0.5rem; width:100%; cursor:pointer; color: #b45309; font-weight: 700;">
                                <input type="checkbox" class="pay-fee-check" data-source="${source}" data-amount="${data.fee}" data-ids="${groupTxIds}">
                                <span><i class="fa-solid fa-receipt"></i> Chỉ trả Phí dịch vụ</span>
                            </label>
                            <span style="color:#b45309; font-weight:800">${app.logic.formatCurrency(data.fee)}</span>
                        </div>`;
            }

            const isMomo = source.includes('MoMo');

            // [FIX 3] THÊM data-ids VÀO NÚT TRẢ TOÀN BỘ
            actionsHTML += `<div class="action-row">
    <label style="display:flex; align-items:center; gap:0.5rem">
        <input type="checkbox" class="pay-all-check" 
               data-source="${source}" 
               data-amount="${totalPay}" 
               data-fee="${data.fee}" 
               data-penalty="${lateFee}" 
               data-ids="${groupTxIds}"> 
        Trả toàn bộ
    </label>
    <span class="text-success">${app.logic.formatCurrency(totalPay)}</span>
</div>`;
            // --- TÌM ĐOẠN NÀY ---
            const isShopee = source.toLowerCase().includes('shopee') || source.toLowerCase().includes('spay');
            if (isShopee) {
                const shopeeTxIds = data.txs.map(t => t.id).join(',');

                actionsHTML += `
    <div class="action-row" style="margin-top: 0.5rem; background: #fff7ed; border: 1px dashed #ea580c;">
        <div style="display:flex; flex-direction:column; width:100%; gap: 6px;">
            
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%">
                <label style="display:flex; align-items:center; gap:0.5rem; color:#ea580c; font-weight:700; cursor:pointer" 
                       onclick="app.ui.createBulkShopeeInstallment('${shopeeTxIds}')">
                    <span style="display:flex; align-items:center; justify-content:center; width:16px; height:16px; border:1px solid #ea580c; border-radius:3px; background:white;">
                        <i class="fa-solid fa-clock-rotate-left" style="font-size:0.6rem;"></i>
                    </span>
                    Trả góp TOÀN BỘ
                </label>
                <span style="font-size:0.75rem; color:#c2410c;">(Tất cả đơn)</span>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; width:100%; border-top: 1px dashed rgba(234, 88, 12, 0.3); padding-top: 6px;">
                <label style="display:flex; align-items:center; gap:0.5rem; color:#c2410c; font-weight:700; cursor:pointer" 
                       onclick="app.ui.createSelectedShopeeInstallment()">
                    <span style="display:flex; align-items:center; justify-content:center; width:16px; height:16px; border:1px solid #c2410c; border-radius:3px; background:white;">
                        <i class="fa-regular fa-square-check" style="font-size:0.6rem;"></i>
                    </span>
                    Trả góp MỤC ĐÃ CHỌN
                </label>
                 <span style="font-size:0.75rem; color:#c2410c;">(Theo checkbox)</span>
            </div>

        </div>
    </div>`;
            }

            if (isMomo) {
                const today = new Date().getDate();
                const isOpenWindow = today >= 25 || today <= 5;

                const minRate = 0.15;
                const minPayPrincipal = Math.max(50000, Math.round(data.total * minRate));
                const remainingPrincipal = Math.max(0, data.total - minPayPrincipal);
                const minPayFee = Math.round(remainingPrincipal * 0.06);
                const totalMinPay = minPayPrincipal + minPayFee + data.fee + lateFee;

                const minPayDetails = `<div style="font-size: 0.8rem; color: var(--text-muted); padding-left: 1.5rem; margin-bottom: 0.5rem; border-left: 2px solid var(--sidebar-border);">
                                <div class="flex-between" style="display:flex; justify-content:space-between"><span>• 15% Gốc (Min 50k):</span> <span>${app.logic.formatCurrency(minPayPrincipal)}</span></div>
                                <div class="flex-between" style="display:flex; justify-content:space-between"><span>• Phí TT tối thiểu (6% còn lại):</span> <span>${app.logic.formatCurrency(minPayFee)}</span></div>
                                <div class="flex-between" style="display:flex; justify-content:space-between"><span>• Phí dịch vụ:</span> <span>${app.logic.formatCurrency(data.fee)}</span></div>
                                ${lateFee > 0 ? `<div class="flex-between" style="display:flex; justify-content:space-between"><span>• Phí phạt quá hạn:</span> <span class="text-danger">${app.logic.formatCurrency(lateFee)}</span></div>` : ''}
                                <div class="flex-between" style="border-top: 1px dashed var(--sidebar-border); margin-top: 2px; padding-top: 2px; font-weight: bold; display:flex; justify-content:space-between">
                                    <span>Tổng cần trả ngay:</span> <span class="text-warning">${app.logic.formatCurrency(totalMinPay)}</span>
                                </div>
                                <div class="flex-between" style="margin-top: 2px; font-style:italic; opacity:0.8; display:flex; justify-content:space-between">
                                    <span>Dư nợ chuyển tháng sau:</span> <span>${app.logic.formatCurrency(remainingPrincipal)}</span>
                                </div>
                            </div>`;

                let minPayHTML = '';
                if (isOpenWindow) {
                    // [FIX 4] THÊM data-ids VÀO NÚT TRẢ TỐI THIỂU
                    minPayHTML = `
                            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer">
                                    <input type="checkbox" class="pay-min-check" 
                                        data-source="${source}" 
                                        data-amount="${totalMinPay}" 
                                        data-min-principal="${minPayPrincipal}"
                                        data-remaining="${remainingPrincipal}"
                                        data-original-date="${data.txs[0]?.date}"
                                        data-ids="${groupTxIds}"> 
                                    <b>Trả tối thiểu</b>
                                </label>
                                <span class="text-warning">${app.logic.formatCurrency(totalMinPay)}</span>
                            </div>
                            <div style="width: 100%; margin-top: 0.5rem;">${minPayDetails}</div>`;
                } else {
                    minPayHTML = `
                            <div style="opacity: 0.6; background: rgba(0,0,0,0.05); padding: 0.5rem; border-radius: 6px;">
                                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:not-allowed">
                                        <input type="checkbox" disabled> 
                                        <b style="color:var(--text-muted)">Trả tối thiểu</b>
                                    </label>
                                    <span class="text-muted" style="font-size:0.8rem"><i class="fa-regular fa-clock"></i> Mở ngày 25 - 05</span>
                                </div>
                            </div>`;
                }

                actionsHTML = `<div class="action-row" style="flex-direction: column; align-items: flex-start;">
    ${minPayHTML}
</div>
${actionsHTML}
`;

                let installmentHTML = '';
                if (isOpenWindow) {
                    installmentHTML = `
                            <div style="display:flex; gap:0.5rem; align-items:center;">
                                <select class="form-control" style="width: auto; padding:0.2rem 0.5rem; background:rgba(0,0,0,0.3)" id="month-${sourceId}" onchange="app.ui.previewInstallment('${sourceId}', this.value, ${data.total}, ${data.fee}, ${lateFee})">
                                    <option value="3">3 tháng</option>
                                    <option value="6">6 tháng</option>
                                    <option value="9">9 tháng</option>
                                    <option value="12">12 tháng</option>
                                </select>
                                <button class="btn btn-outline btn-sm" onclick="app.ui.createInstallment('${sourceId}', '${source}', ${data.total}, ${data.fee}, ${lateFee}, '${data.safeDateStr}')">Chuyển trả góp</button>
                            </div>
                            <div id="preview-${sourceId}" class="mt-2 text-muted" style="font-size:0.8rem"></div>`;

                    setTimeout(() => app.ui.previewInstallment(sourceId, 3, data.total, data.fee, lateFee), 100);
                } else {
                    installmentHTML = `
                            <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; background: rgba(0,0,0,0.05); padding: 0.5rem; border-radius: 6px; width: 100%; text-align: center;">
                                <i class="fa-solid fa-lock"></i> Tính năng Trả góp & Trả tối thiểu chỉ mở từ <b>ngày 25 đến ngày 05</b> hàng tháng.
                            </div>`;
                }

                actionsHTML += `
                        <div style="margin-top:0.5rem; border-top: 1px dashed var(--sidebar-border); padding-top: 0.5rem;">
                            ${installmentHTML}
                        </div>`;
            }

            // --- [FIX] ẨN "NHẬP SỐ KHÁC" CHO SHOPEE VÀ TIKTOK ---
            const isTikTok = source.toLowerCase().includes('tiktok');
            // Biến isShopee đã được khai báo ở trên rồi, nhưng nếu lỡ bị thiếu thì mình check luôn qua source
            const checkShopee = source.toLowerCase().includes('shopee') || source.toLowerCase().includes('spay');

            if (!checkShopee && !isTikTok) {
                const customInputId = `custom-input-${sourceId}`;
                actionsHTML += `<div class="action-row" style="margin-top: 0.5rem; background: rgba(255,255,255,0.03);">
                <div style="display:flex; align-items:center; gap:0.5rem; width:100%; justify-content: space-between;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-size:0.9rem; white-space:nowrap;">Nhập số khác:</span>
                        <input type="text" id="${customInputId}" class="form-control" 
                            style="padding: 0.25rem 0.5rem; width: 100px; font-size: 0.9rem; height: auto;" 
                            placeholder="Số tiền"
                            onkeyup="this.value = this.value.replace(/[^0-9]/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')">
                    </div>
                    <button class="btn btn-primary btn-sm" 
                        onclick="app.ui.processCustomPay('${source}', '${customInputId}', ${data.total}, ${data.fee}, ${lateFee}, '${data.txs[0]?.date}', '${groupTxIds}')">
                        Trả
                    </button>
                </div>
            </div>`;
            }
            // ----------------------------------------------------

            /* --- [GIAO DIỆN MỚI] DANH SÁCH CHI TIẾT KHOẢN NỢ --- */
            const txListHTML = data.txs.length > 0 ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 12px; max-height: 300px; overflow-y: auto;">
                ${data.txs.map(t => {
                const isShopee = source.toLowerCase().includes('shopee') || source.toLowerCase().includes('spay');

                // 1. Tạo Checkbox (Chỉ hiện cho Shopee để gộp trả góp)
                let selectBoxHTML = '';
                if (isShopee) {
                    selectBoxHTML = `<div style="margin-right: 12px; display:flex; align-items:center;">
                            <input type="checkbox" class="shopee-select-check" value="${t.id}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);">
                        </div>`;
                }

                // 2. Tạo cụm nút thao tác (Trả góp / Dời kỳ) - Style nút bấm dạng Pill (Viên thuốc)
                let actionButtons = '';
                if (isShopee) {
                    // Nút Trả góp đơn
                    actionButtons += `
                        <button onclick="event.stopPropagation(); app.ui.createShopeeInstallment(${t.id})" 
                            title="Chuyển trả góp riêng giao dịch này"
                            style="border: 1px solid #fdba74; background: #fff7ed; color: #c2410c; border-radius: 6px; padding: 4px 8px; font-size: 0.7rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;">
                            <i class="fa-solid fa-clock-rotate-left"></i> Góp
                        </button>`;

                    // Nút Dời kỳ
                    if (t.isDeferred) {
                        // Đã dời -> Hiện nhãn xám
                        actionButtons += `
                            <span title="Giao dịch này đã được dời từ kỳ trước"
                                style="border: 1px solid #e2e8f0; background: #f1f5f9; color: #64748b; border-radius: 6px; padding: 4px 8px; font-size: 0.7rem; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; cursor: help;">
                                <i class="fa-solid fa-check-double"></i> Đã dời
                            </span>`;
                    } else {
                        // Chưa dời -> Hiện nút xanh
                        actionButtons += `
                            <button onclick="event.stopPropagation(); app.ui.deferShopeeTx(${t.id})" 
                                title="Dời sang kỳ sao kê sau (Chỉ 1 lần)"
                                style="border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 6px; padding: 4px 8px; font-size: 0.7rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;">
                                <i class="fa-regular fa-calendar-check"></i> Dời
                            </button>`;
                    }
                }

                // 3. Hiển thị ghi chú phí (nếu có)
                let feeNoteHTML = '';
                if (t.tempExtraFee && t.tempExtraFee > 0) {
                    feeNoteHTML = `<div style="font-size: 0.7rem; color: #ef4444; background: #fef2f2; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">
                            <i class="fa-solid fa-circle-exclamation"></i> Phí DV: <b>+${app.logic.formatCurrency(t.tempExtraFee)}</b>
                        </div>`;
                }

                // --- THUẬT TOÁN ĐỔI MÀU GIAO DỊCH CỦA KỲ SAO KÊ HIỆN TẠI ---
                const [filterY, filterM] = app.data.filter.month.split('-').map(Number);
                // Kiểm tra xem kỳ sao kê của nhóm này có khớp với tháng đang xem trên bộ lọc không
                const isCurrentCycle = data.statementDate.getFullYear() === filterY && (data.statementDate.getMonth() + 1) === filterM;

                const cardBg = isCurrentCycle ? '#eff6ff' : 'white'; // Nền xanh dương nhạt cho kỳ hiện tại
                const cardBorder = isCurrentCycle ? '#bfdbfe' : '#f1f5f9'; // Viền xanh
                const highlightBadge = isCurrentCycle ? `<span style="font-size:0.6rem; background:#3b82f6; color:white; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:bold; white-space:nowrap;">Kỳ này</span>` : '';
                // --------------------------------------------------------

                // 4. Return HTML dạng Card (Thẻ)
                return `<div style="background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; align-items: flex-start; box-shadow: 0 1px 2px rgba(0,0,0,0.03); transition: 0.2s;">
        
        ${selectBoxHTML} 
        
        <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        
        <div style="font-weight: 700; color: ${isCurrentCycle ? '#1e3a8a' : '#334155'}; font-size: 0.9rem; line-height: 1.4; padding-right: 8px; display:flex; align-items:center; flex-wrap:wrap;">
            <span>${t.place}</span> ${highlightBadge}
                    <button onclick="event.stopPropagation(); app.ui.modals.transaction.open(${t.id})" 
                            title="Xem/Sửa chi tiết"
                            style="border:none; background:rgba(0,0,0,0.05); width:24px; height:24px; border-radius:50%; margin-left:8px; cursor:pointer; color:#64748b; display:flex; align-items:center; justify-content:center; transition:0.2s;"
                            onmouseover="this.style.background='#e2e8f0'; this.style.color='#0f172a'"
                            onmouseout="this.style.background='rgba(0,0,0,0.05)'; this.style.color='#64748b'">
                        <i class="fa-solid fa-pen" style="font-size:0.7rem"></i>
                    </button>
                </div>
                <div style="font-family: var(--font-mono); font-weight: 800; color: #0f172a; font-size: 0.95rem; white-space: nowrap;">
                    ${app.logic.formatCurrency(t.amount)}
                </div>
            </div>

            <div style="font-size: 0.75rem; color: #94a3b8; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <i class="fa-regular fa-clock"></i> ${new Date(t.date).getDate()}/${new Date(t.date).getMonth() + 1}
                <span>•</span>
                <span>${t.source}</span>
                ${t.tags ? `<span style="background:#f1f5f9; padding:0 4px; border-radius:3px; font-size:0.65rem;">${t.tags}</span>` : ''}
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 4px;">
    ${t.refId ? `<div style="font-size: 0.75rem; color: #0284c7; font-weight: 700; display:flex; align-items:center; gap:4px;"><i class="fa-solid fa-hashtag"></i> Mã GD: ${t.refId}</div>` : ''}
    ${t.orderCode ? `<div style="font-size: 0.75rem; color: #ea580c; font-weight: 700; display:flex; align-items:center; gap:4px;"><i class="fa-solid fa-box"></i> Mã ĐH: ${t.orderCode}</div>` : ''}
</div>

            ${feeNoteHTML ? `<div>${feeNoteHTML}</div>` : ''}

            ${actionButtons ? `<div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">${actionButtons}</div>` : ''}
        </div>
    </div>`;
            }).join('')}
            </div>` : '';

            const planLabel = `${source} <span style="font-size:0.7em; font-weight:normal; opacity:0.7">(Kỳ ${statementDate.getMonth() + 1})</span>`;
            const addMissedTxBtn = `<i class="fa-solid fa-circle-plus" style="cursor:pointer; color:var(--primary); margin-left:0.5rem;" onclick="app.ui.modals.missedTx.open('${source}', '${data.safeDateStr}')" title="Thêm giao dịch sót vào kỳ này"></i>`;

            htmlBuilder += `<div class="plan">
                            <div class="plan-header" style="display:flex; justify-content:space-between; margin-bottom:0.5rem">
                                <h4>${planLabel} ${addMissedTxBtn}</h4>
                                <span style="color:${lateFee > 0 ? 'var(--danger)' : 'var(--text-main)'}; font-weight:bold;">${app.logic.formatCurrency(totalPay)}</span>
                            </div>
                            ${penaltyHTML}
                            <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem; display:flex; flex-direction:column;">
                                <div style="display:flex; align-items:center;">
                                    Gốc: <b style="color:${isModified ? 'var(--danger)' : 'inherit'}; margin-left:4px;">${app.logic.formatCurrency(data.total)}</b> 
                                    ${editBtnHTML}
                                    <span style="margin: 0 8px;">|</span> 
                                    Phí: ${app.logic.formatCurrency(data.fee)}
                                </div>
                                ${modifiedStatusHTML}
                            </div>
                            ${txListHTML}
                            <div class="debt-actions">${actionsHTML}</div>
                        </div>`;

            if (isMomo) {
                setTimeout(() => app.ui.previewInstallment(sourceId, 3, data.total, data.fee, lateFee), 100);
            }
        });
        // --- KẾT THÚC ĐOẠN CODE DÁN ĐÈ ---

        debtListEl.innerHTML = htmlBuilder;
    },

    // --- TRONG FILE js/5-ui.js ---

    // 1. XỬ LÝ TRẢ TÙY CHỈNH (Custom Pay)
    processCustomPay(source, inputId, principal, serviceFee, lateFee, originalDateStr, txIdsString) {
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;

        const rawValue = inputEl.value.replace(/\D/g, '');
        const payAmount = parseInt(rawValue);
        const totalDebt = principal + serviceFee + lateFee;

        if (!payAmount || payAmount <= 0) {
            return app.ui.popup.show("Vui lòng nhập số tiền hợp lệ!", "error");
        }
        if (payAmount > totalDebt) {
            return app.ui.popup.show("Số tiền trả vượt quá tổng nợ!", "error");
        }

        const remainingTotal = totalDebt - payAmount;

        app.ui.popup.confirm(
            `Xác nhận thanh toán: <b>${app.logic.formatCurrency(payAmount)}</b>?<br>
             <span style="font-size:0.8rem; color:var(--text-muted)">
             (Ưu tiên trừ: Phạt > Phí > Gốc)<br>
             Còn lại: ${app.logic.formatCurrency(remainingTotal)}
             </span>`,
            () => {
                const useNewLogic = new Date() > new Date('2026-01-28T23:59:59');
                const txSource = useNewLogic ? "Tiền mặt" : source;
                const txDest = useNewLogic ? source : null;

                let moneyHolder = payAmount; // Số tiền khách đưa
                const paymentDate = app.logic.getPaymentDate();

                // 1. TRẢ PHÍ PHẠT (Ưu tiên 1)
                if (lateFee > 0 && moneyHolder > 0) {
                    const payForPenalty = Math.min(moneyHolder, lateFee);
                    app.data.transactions.push({
                        id: Date.now(),
                        type: 'Chi tiêu',
                        place: `Thanh toán Phạt quá hạn (${source})`,
                        source: txSource,
                        destination: txDest,
                        amount: payForPenalty, // [ĐÃ SỬA] Thay payForService bằng payForPenalty
                        date: paymentDate,
                        tags: '#nop_phat',
                        status: 'paid'
                    });
                    moneyHolder -= payForPenalty;
                }

                // 2. TRẢ PHÍ DỊCH VỤ (Ưu tiên 2)
                if (serviceFee > 0 && moneyHolder > 0) {
                    const payForService = Math.min(moneyHolder, serviceFee);
                    app.data.transactions.push({
                        id: Date.now() + 1,
                        type: 'Chi tiêu',
                        place: `Thanh toán Phí dịch vụ (${source})`,
                        source: txSource,
                        destination: txDest,
                        amount: payForService, // [ĐÚNG] Giữ nguyên
                        date: paymentDate,
                        tags: '#thanh_toan_phi',
                        status: 'paid'
                    });
                    moneyHolder -= payForService;
                }

                // 3. TRẢ GỐC (Ưu tiên 3)
                let remainingPrincipal = principal;
                if (moneyHolder > 0) {
                    // Tiền còn lại sau khi trừ phí/phạt sẽ đập vào gốc
                    app.data.transactions.push({
                        id: Date.now() + 2,
                        type: 'Chi tiêu',
                        place: `Thanh toán Gốc (${source})`,
                        source: txSource,
                        destination: txDest,
                        amount: moneyHolder, // [ĐÃ SỬA] Thay payForService bằng moneyHolder (số tiền còn lại)
                        date: paymentDate,
                        tags: '#thanh_toan_no',
                        status: 'paid'
                    });
                    remainingPrincipal = principal - moneyHolder;
                    moneyHolder = 0; // Hết tiền
                }

                // 4. XỬ LÝ GIAO DỊCH CŨ & TẠO DƯ NỢ MỚI
                if (txIdsString) {
                    const idsToClose = txIdsString.split(',').map(Number);
                    app.data.transactions.forEach(t => {
                        if (idsToClose.includes(t.id)) {
                            t.status = 'paid';
                        }
                    });
                } else {
                    const debts = app.data.transactions.filter(t => t.status === 'pending' && app.logic.normalizeSource(t.source) === source);
                    debts.forEach(t => t.status = 'paid');
                }

                // 5. TẠO DƯ NỢ GỐC CÒN LẠI (NẾU CÓ)
                if (remainingPrincipal > 0) {
                    const paidService = payAmount - (Math.min(payAmount, lateFee));
                    const remainingServiceFee = Math.max(0, serviceFee - Math.max(0, paidService));

                    app.data.transactions.push({
                        id: Date.now() + 3,
                        type: 'Chi tiêu',
                        place: `Dư nợ chuyển tiếp (${source})`,
                        source: source,
                        amount: remainingPrincipal,
                        date: originalDateStr,
                        tags: '#du_no_chuyen_tiep',
                        status: 'pending'
                    });

                    if (remainingServiceFee > 0) {
                        app.data.transactions.push({
                            id: Date.now() + 4,
                            type: 'Chi tiêu',
                            place: `Phí dịch vụ còn thiếu (${source})`,
                            source: source,
                            amount: remainingServiceFee,
                            date: originalDateStr,
                            tags: '#phi_dich_vu',
                            status: 'pending'
                        });
                    }
                }

                app.storage.save();
                app.ui.renderAll();
                app.ui.popup.show("✅ Thanh toán thành công!", "success");
            }
        );
    },

    // 2. TRẢ 1 KỲ TRẢ GÓP
    payInstallmentPart(planId, dateKey) {
        const input = document.getElementById(`inst-input-${planId}-${dateKey}`);
        if (!input) return;

        const amount = Number(input.value.replace(/[^0-9]/g, ''));
        if (!amount || amount <= 0) {
            return app.ui.popup.show("Vui lòng nhập số tiền hợp lệ!", "error");
        }

        const plan = app.data.installmentPlans[planId];
        if (!plan) return;

        const payment = plan.payments.find(p => p.date === dateKey);
        if (!payment) return;

        const totalDue = payment.amount + (payment.penaltyAmt || 0);
        const paidSoFar = payment.paidAmount || 0;
        const remaining = totalDue - paidSoFar;

        if (amount > remaining) {
            return app.ui.popup.show(`Số tiền trả vượt quá dư nợ kỳ này<br>(${app.logic.formatCurrency(remaining)})`, "warning");
        }

        // Logic xử lý luôn, không cần confirm vì số tiền nhỏ
        const useNewLogic = new Date() > new Date('2026-01-28T23:59:59');
        const txSource = useNewLogic ? "Tiền mặt" : plan.source;
        const txDest = useNewLogic ? plan.source : null;

        app.data.transactions.push({
            id: Date.now(),
            type: 'Chi tiêu',
            place: `Trả góp ${plan.source} (Kỳ ${payment.date})`,
            source: txSource,
            destination: txDest, // [MỚI]
            amount: amount,
            date: app.logic.getPaymentDate(),
            tags: '#tra_gop',
            status: 'paid',
            note: `Đã trả thêm: ${app.logic.formatCurrency(amount)}`
        });

        payment.paidAmount = paidSoFar + amount;
        if (payment.paidAmount >= totalDue) {
            payment.paid = true;
        }

        app.storage.save();
        app.ui.renderAll();
        // Thay alert bằng popup nhỏ
        app.ui.popup.show(`Đã thanh toán: <b>${app.logic.formatCurrency(amount)}</b>`, "success");
    },

    // --- [FIX] Thêm hàm Preview Trả Góp còn thiếu ---
    previewInstallment(sourceId, months, principal, serviceFee, lateFee) {
        const div = document.getElementById(`preview-${sourceId}`);
        if (!div) return;

        months = parseInt(months);
        // Giả định hàm lấy lãi suất có sẵn bên logic, nếu không mặc định 0
        const rate = app.logic.getInstallmentRate ? app.logic.getInstallmentRate(months) : 0;

        const conversionFee = Math.ceil(principal * rate);
        const totalPrincipalWithFee = principal + conversionFee;
        const monthlyPay = Math.floor(totalPrincipalWithFee / months);
        const oneTime = serviceFee + lateFee;

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.75rem;">
                <span>Phí chuyển đổi (${(rate * 100).toFixed(1)}%):</span>
                <b>${app.logic.formatCurrency(conversionFee)}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.75rem;">
                <span>Gốc + Phí CĐ:</span>
                <b>${app.logic.formatCurrency(totalPrincipalWithFee)}</b>
            </div>
             <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:var(--primary); font-weight:bold; border-top:1px dashed #ccc; padding-top:4px; font-size:0.8rem;">
                <span>Trả mỗi tháng:</span>
                <span>${app.logic.formatCurrency(monthlyPay)}</span>
            </div>
            ${oneTime > 0 ? `<div style="font-size:0.7rem; color:var(--danger); text-align:right; font-style:italic;">+ Kỳ 1 đóng thêm: ${app.logic.formatCurrency(oneTime)} (Phí/Phạt cũ)</div>` : ''}
        `;
    },

    // 3. TẠO TRẢ GÓP MỚI
    createInstallment(sourceId, source, principal, serviceFee, lateFee, startDateStr) {
        const el = document.getElementById(`month-${sourceId}`);
        if (!el) return app.ui.popup.show("Lỗi không tìm thấy dữ liệu số tháng.", "error");

        const months = parseInt(el.value);
        if (!months || months < 1) return app.ui.popup.show("Số tháng không hợp lệ", "error");

        const rate = app.logic.getInstallmentRate(months);
        const conversionFee = Math.ceil(principal * rate);
        const totalInstallmentPart = principal + conversionFee;
        const oneTimeFees = serviceFee + lateFee;
        const totalRepayment = totalInstallmentPart + oneTimeFees;

        // Tính số tiền cơ bản mỗi tháng (Làm tròn xuống)
        const monthlyInstallmentBasic = Math.floor(totalInstallmentPart / months);

        // --- [FIX] Tính phần cơ bản cho Breakdown (Gốc & Phí) ---
        const monthlyBase = Math.floor(principal / months);
        const monthlyFee = Math.floor(conversionFee / months);

        const debts = app.data.transactions.filter(t => t.status === 'pending' && app.logic.normalizeSource(t.source) === source);
        const originalTxIds = debts.map(t => t.id);

        const payments = [];
        let d = startDateStr ? new Date(startDateStr) : new Date();
        d.setMonth(d.getMonth() - 1);

        for (let i = 0; i < months; i++) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const dateDisplay = `${year}-${month}`;

            let payAmount = monthlyInstallmentBasic;

            // --- [FIX] Biến lưu giá trị Gốc & Phí của kỳ này ---
            let currentBase = monthlyBase;
            let currentFee = monthlyFee;

            let note = "";
            if (i === 0) {
                payAmount += oneTimeFees;
                note = "(Gồm phí DV & Phạt)";
            }

            // --- [FIX] Xử lý số dư ở kỳ cuối cùng (Bù phần thiếu 0.001) ---
            if (i === months - 1) {
                // 1. Xử lý tổng tiền trả
                const paidInstallmentSoFar = monthlyInstallmentBasic * (months - 1);
                payAmount = totalInstallmentPart - paidInstallmentSoFar;

                // 2. Xử lý Gốc (Base)
                const paidBaseSoFar = monthlyBase * (months - 1);
                currentBase = principal - paidBaseSoFar;

                // 3. Xử lý Phí chuyển đổi (Fee)
                const paidFeeSoFar = monthlyFee * (months - 1);
                currentFee = conversionFee - paidFeeSoFar;
            }

            payments.push({
                date: dateDisplay,
                amount: payAmount,
                breakdown: {
                    base: currentBase,          // Đã fix: dùng currentBase thay vì tính lại
                    conversionFee: currentFee,  // Đã fix: dùng currentFee thay vì tính lại
                    extra: i === 0 ? oneTimeFees : 0
                },
                paid: false,
                note: note
            });
            d.setMonth(d.getMonth() + 1);
        }

        const plan = {
            id: Date.now() + Math.floor(Math.random() * 10000),
            source: source,
            totalRepayment: totalRepayment,
            payments: payments,
            createdDate: new Date().toISOString(),
            preservedPenalty: lateFee,
            originalTxIds: originalTxIds
        };

        app.data.installmentPlans[plan.id] = plan;
        debts.forEach(t => t.status = 'paid');

        app.storage.save();
        app.ui.renderAll();

        const [pYear, pMonth] = payments[0].date.split('-').map(Number);
        const dueDateDisplay = pMonth === 12 ? `1/${pYear + 1}` : `${pMonth + 1}/${pYear}`;

        app.ui.popup.show(`✅ Đã chuyển đổi trả góp ${months} tháng.<br>Hạn trả kỳ đầu: <b>${dueDateDisplay}</b>`, "success");
    },

    /* --- FILE: js/5-ui.js --- */

    createShopeeInstallment(txId) {
        const tx = app.data.transactions.find(t => t.id === txId);
        if (!tx) return;

        app.ui.popup.prompt(
            `CHUYỂN TRẢ GÓP SHOPEE<br>Giao dịch: <b>${tx.place}</b> (${app.logic.formatCurrency(tx.amount)})<br>Nhập số tháng (2, 3, 6, 9, 12):`,
            (val) => {
                const months = parseInt(val);
                if (![2, 3, 6, 9, 12].includes(months)) {
                    return app.ui.popup.show("Chỉ hỗ trợ kỳ hạn 2, 3, 6, 9, 12 tháng!", "error");
                }

                // ... (GIỮ NGUYÊN CODE NHẬN DIỆN GIAO DỊCH ĐẶC BIỆT) ...
                const tagStr = (tx.tags || "").toLowerCase();
                const placeStr = (tx.place || "").toLowerCase();
                const brandStr = (tx.brand || "").toLowerCase();

                const isSpecialTx = placeStr.includes('shopee food') || placeStr.includes('shopeefood') ||
                    brandStr.includes('shopee food') || brandStr.includes('shopeefood') ||
                    tagStr.includes('#nạp tiền') ||
                    tagStr.includes('#quét mã qr') ||
                    tagStr.includes('#dịch vụ liên kết');

                // ... (GIỮ NGUYÊN CODE TÍNH TOÁN GỐC/PHÍ) ...
                const monthlyPrincipal = Math.floor(tx.amount / months);
                const standardMonthlyFee = Math.floor(tx.amount * 0.0295);

                const payments = [];

                // --- [SỬA LỖI TẠI ĐÂY] ---
                // Tính toán chuẩn xác kỳ sao kê dựa vào ngày giao dịch và ngày chốt (13)
                const billingInfo = app.logic.getBillingInfo(tx.source, tx.date);
                let d = new Date(billingInfo.statementDate);

                let totalRepayment = 0;

                for (let i = 0; i < months; i++) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const dateDisplay = `${year}-${month}`;

                    // ... (GIỮ NGUYÊN LOGIC BÊN TRONG VÒNG LẶP) ...

                    // Xử lý lệch số lẻ ở kỳ cuối cho phần Gốc
                    let currentPrincipal = monthlyPrincipal;
                    if (i === months - 1) {
                        currentPrincipal = tx.amount - (monthlyPrincipal * (months - 1));
                    }

                    // Logic Phí
                    let currentFee = standardMonthlyFee;
                    let feeNote = "";

                    if (isSpecialTx) {
                        if (i === 0) feeNote = ` <span style="color:var(--danger); font-size:0.65rem; font-weight:bold;">(Phí DV đặc biệt)</span>`;
                    } else {
                        if (i === 0) {
                            currentFee = 0;
                            feeNote = ` <span style="color:var(--success); font-size:0.65rem; font-weight:bold;">(Miễn phí kỳ đầu)</span>`;
                        }
                    }

                    const currentPayment = currentPrincipal + currentFee;
                    totalRepayment += currentPayment;

                    payments.push({
                        date: dateDisplay,
                        amount: currentPayment,
                        breakdown: {
                            base: currentPrincipal,
                            conversionFee: currentFee,
                            extra: 0
                        },
                        paid: false,
                        note: `(Gốc: ${app.logic.formatCurrency(currentPrincipal)} + Phí: ${app.logic.formatCurrency(currentFee)})${feeNote}`
                    });

                    // Tăng tháng cho vòng lặp sau
                    d.setMonth(d.getMonth() + 1);
                }

                // ... (GIỮ NGUYÊN PHẦN TẠO PLAN VÀ SAVE) ...
                const plan = {
                    id: Date.now(),
                    source: 'Shopee SPayLater',
                    totalRepayment: totalRepayment,
                    payments: payments,
                    createdDate: new Date().toISOString(),
                    preservedPenalty: 0,
                    originalTxIds: [tx.id],
                    isShopee: true,
                    originalPrincipal: tx.amount
                };

                app.data.installmentPlans[plan.id] = plan;
                tx.status = 'paid';
                tx.tags = (tx.tags || '') + ' #da_chuyen_tra_gop';

                app.storage.save();
                app.ui.renderAll();

                let msg = `✅ Đã chuyển đổi thành công!`;
                if (isSpecialTx) msg += `<br>⚠️ Giao dịch đặc biệt: Đã tính phí kỳ đầu.`;
                else msg += `<br>🎉 Giao dịch thường: Được miễn phí kỳ đầu!`;

                app.ui.popup.show(msg, "success");
            }
        );
    },

    // --- [CẬP NHẬT] Hàm dời giao dịch Shopee (Chặn dời lần 2 & Cập nhật ngay) ---
    deferShopeeTx(id) {
        const tx = app.data.transactions.find(t => t.id === id);
        if (!tx) return;

        // 1. CHẶN DỜI LẦN 2: Kiểm tra nếu đã dời rồi thì báo lỗi
        if (tx.isDeferred) {
            app.ui.popup.show("⛔ Giao dịch này đã được dời 1 lần, không thể dời tiếp!", "error");
            return;
        }

        // 2. TÍNH TOÁN NGÀY MỚI (Sang đầu kỳ sao kê sau)
        const currentBilling = app.logic.getBillingInfo(tx.source, tx.date);

        // Ngày chốt là 13 -> Ngày đầu kỳ mới là 14 (tức là +1 ngày)
        const nextCycleStartDate = new Date(currentBilling.statementDate);
        nextCycleStartDate.setDate(nextCycleStartDate.getDate() + 1);

        // Hiển thị ngày hạn mới cho người dùng xem trước
        const newBilling = app.logic.getBillingInfo(tx.source, nextCycleStartDate.toISOString());
        const newDueDisplay = `${newBilling.dueDate.getDate()}/${newBilling.dueDate.getMonth() + 1}/${newBilling.dueDate.getFullYear()}`;

        app.ui.popup.confirm(
            `Dời giao dịch <b>"${tx.place}"</b> sang kỳ sao kê sau?<br>
             <span style="font-size:0.8rem; color:var(--text-muted)">(Chỉ được thực hiện 1 lần duy nhất)</span><br><br>
             <i class="fa-solid fa-arrow-right"></i> Hạn thanh toán mới: <b>${newDueDisplay}</b>`,
            () => {
                // 3. THỰC HIỆN DỜI
                tx.date = nextCycleStartDate.toISOString(); // Đổi ngày
                tx.isDeferred = true; // Đánh dấu đã dời (để không dời được nữa)

                // Thêm ghi chú
                if (!tx.note || !tx.note.includes('(Đã dời kỳ)')) {
                    tx.note = (tx.note || '') + " (Đã dời kỳ)";
                }

                // 4. LƯU VÀ LÀM MỚI GIAO DIỆN NGAY LẬP TỨC
                app.storage.save();

                // [QUAN TRỌNG] Hàm này sẽ tính lại Ngân sách và Sắp đến hạn ngay lập tức
                app.ui.renderAll();

                app.ui.popup.show("✅ Đã chuyển giao dịch sang kỳ sau!", "success");
            }
        );
    },

    /* --- FILE: js/5-ui.js --- */

    createBulkShopeeInstallment(txIdsString) {
        if (!txIdsString) return;
        const txIds = txIdsString.split(',').map(Number);

        // Lấy danh sách object giao dịch từ ID
        const targetTxs = app.data.transactions.filter(t => txIds.includes(t.id));
        if (targetTxs.length === 0) return;

        const totalAmount = targetTxs.reduce((sum, t) => sum + t.amount, 0);

        app.ui.popup.prompt(
            `TRẢ GÓP TOÀN BỘ (${targetTxs.length} giao dịch)<br>
         Tổng tiền: <b>${app.logic.formatCurrency(totalAmount)}</b><br>
         Nhập số tháng (2, 3, 6, 9, 12):`,
            (val) => {
                const months = parseInt(val);
                if (![2, 3, 6, 9, 12].includes(months)) {
                    return app.ui.popup.show("Chỉ hỗ trợ kỳ hạn 2, 3, 6, 9, 12 tháng!", "error");
                }

                // 1. PHÂN LOẠI GIAO DỊCH
                let specialTotal = 0; // Tổng tiền các giao dịch bị tính phí ngay kỳ 1
                let normalTotal = 0;  // Tổng tiền các giao dịch được miễn phí kỳ 1

                targetTxs.forEach(t => {
                    const tagStr = (t.tags || "").toLowerCase();
                    const placeStr = (t.place || "").toLowerCase();
                    const brandStr = (t.brand || "").toLowerCase();

                    // Logic nhận diện đặc biệt (ShopeeFood, Nạp tiền, QR, Liên kết...)
                    const isSpecial = placeStr.includes('shopee food') || placeStr.includes('shopeefood') ||
                        brandStr.includes('shopee food') || brandStr.includes('shopeefood') ||
                        tagStr.includes('#nạp tiền') ||
                        tagStr.includes('#quét mã qr') ||
                        tagStr.includes('#dịch vụ liên kết');

                    if (isSpecial) {
                        specialTotal += t.amount;
                    } else {
                        normalTotal += t.amount;
                    }
                });

                // 2. TÍNH TOÁN LỊCH TRẢ
                const monthlyPrincipal = Math.floor(totalAmount / months); // Gốc chia đều
                const rate = 0.0295; // 2.95%

                const payments = [];
                const sortedTxs = targetTxs.sort((a, b) => new Date(a.date) - new Date(b.date));
                // Tính toán chuẩn xác kỳ sao kê dựa vào giao dịch đầu tiên
                const billingInfo = app.logic.getBillingInfo(sortedTxs[0].source, sortedTxs[0].date);
                let d = new Date(billingInfo.statementDate);

                let totalRepayment = 0;

                for (let i = 0; i < months; i++) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const dateDisplay = `${year}-${month}`;

                    // --- LOGIC TÍNH GỐC (Xử lý số lẻ ở kỳ cuối) ---
                    let currentPrincipal = monthlyPrincipal;
                    if (i === months - 1) {
                        currentPrincipal = totalAmount - (monthlyPrincipal * (months - 1));
                    }

                    // --- LOGIC TÍNH PHÍ (QUAN TRỌNG) ---
                    let currentFee = 0;
                    let feeNoteArr = [];

                    if (i === 0) {
                        // KỲ 1: 
                        // - Giao dịch thường: MIỄN PHÍ
                        // - Giao dịch đặc biệt: TÍNH PHÍ
                        const specialFee = Math.floor(specialTotal * rate);
                        currentFee = specialFee;

                        if (specialTotal > 0) {
                            feeNoteArr.push(`<span style="color:var(--danger)">${app.logic.formatCurrency(specialFee)} (Phí ShopeeFood/DV)</span>`);
                        }
                        if (normalTotal > 0) {
                            feeNoteArr.push(`<span style="color:var(--success)">Miễn phí thường kỳ đầu</span>`);
                        }
                    } else {
                        // KỲ 2 TRỞ ĐI: Tính phí trên TỔNG số tiền (cả thường + đặc biệt)
                        // (Hoặc tính tổng của từng cái rồi cộng lại, kết quả như nhau)
                        currentFee = Math.floor(totalAmount * rate);
                        // feeNoteArr.push("Phí chuyển đổi 2.95%");
                    }

                    const currentPayment = currentPrincipal + currentFee;
                    totalRepayment += currentPayment;

                    // Tạo note hiển thị
                    let noteHtml = `(Gốc: ${app.logic.formatCurrency(currentPrincipal)} + Phí: ${app.logic.formatCurrency(currentFee)})`;
                    if (feeNoteArr.length > 0) {
                        noteHtml += `<br><span style="font-size:0.65rem; font-weight:bold">${feeNoteArr.join(' + ')}</span>`;
                    }

                    payments.push({
                        date: dateDisplay,
                        amount: currentPayment,
                        breakdown: {
                            base: currentPrincipal,
                            conversionFee: currentFee,
                            extra: 0
                        },
                        paid: false,
                        note: noteHtml
                    });
                    d.setMonth(d.getMonth() + 1);
                }

                // 3. TẠO GÓI TRẢ GÓP
                const plan = {
                    id: Date.now(),
                    source: `Shopee SPayLater (Gộp ${targetTxs.length} đơn)`,
                    totalRepayment: totalRepayment,
                    payments: payments,
                    createdDate: new Date().toISOString(),
                    preservedPenalty: 0,
                    originalTxIds: targetTxs.map(t => t.id), // Lưu ID các giao dịch gốc
                    isShopee: true,
                    originalPrincipal: totalAmount
                };

                app.data.installmentPlans[plan.id] = plan;

                // 4. CẬP NHẬT TRẠNG THÁI GIAO DỊCH GỐC
                targetTxs.forEach(t => {
                    t.status = 'paid';
                    t.tags = (t.tags || '') + ' #da_chuyen_tra_gop';
                });

                app.storage.save();
                app.ui.renderAll();

                app.ui.popup.show(`✅ Đã gộp ${targetTxs.length} giao dịch thành công!<br>Tổng gốc: ${app.logic.formatCurrency(totalAmount)}`, "success");
            }
        );
    },

    // --- [MỚI] HÀM TRẢ GÓP CÁC MỤC ĐÃ CHỌN ---
    createSelectedShopeeInstallment() {
        // 1. Lấy tất cả checkbox đã tick
        const checks = document.querySelectorAll('.shopee-select-check:checked');

        if (checks.length === 0) {
            return app.ui.popup.show("Vui lòng tích chọn ít nhất 1 giao dịch để trả góp!", "warning");
        }

        // 2. Lấy danh sách ID
        const selectedIds = Array.from(checks).map(c => c.value).join(',');

        // 3. Tái sử dụng hàm Bulk có sẵn để xử lý logic chia nhỏ/gộp
        // Hàm createBulkShopeeInstallment đã có logic nhận diện ID list
        this.createBulkShopeeInstallment(selectedIds);
    },
    // ------------------------------------------

    // 4. HỦY GÓI TRẢ GÓP
    /* --- File: 5-ui.js --- */

    cancelInstallment(planId) {
        const plan = app.data.installmentPlans[planId];
        if (!plan) return;

        let confirmMsg = `HỦY TRẢ GÓP: Bạn có chắc muốn hủy gói "${plan.source}"?`;

        // Check nếu là Shopee và đã có thanh toán
        const paidPayments = plan.payments.filter(p => p.paid);
        const paidAmount = paidPayments.reduce((sum, p) => sum + p.amount, 0);

        if (plan.isShopee) {
            confirmMsg += `<br><br>⚠️ <b>Cơ chế Shopee:</b><br>- Xóa bỏ dư nợ chưa trả.<br>- HOÀN LẠI số tiền đã đóng (${app.logic.formatCurrency(paidAmount)}) vào thu nhập.`;
        } else {
            confirmMsg += `<br><br>Dư nợ sẽ quay lại trạng thái chưa thanh toán ban đầu.`;
        }

        app.ui.popup.confirm(
            confirmMsg,
            () => {
                // 1. XỬ LÝ LOGIC SHOPEE (HOÀN TIỀN)
                if (plan.isShopee) {
                    if (paidAmount > 0) {
                        // Tạo giao dịch hoàn tiền
                        app.data.transactions.push({
                            id: Date.now(),
                            type: 'Thu nhập',
                            place: 'Hoàn tiền Hủy Trả góp Shopee',
                            source: 'ShopeePay', // Hoặc nguồn nhận tiền
                            amount: paidAmount,
                            date: new Date().toISOString(),
                            tags: '#hoan_tien #tra_gop',
                            status: 'paid',
                            note: `Hoàn lại ${paidPayments.length} kỳ đã đóng của gói ${plan.source}`
                        });
                    }

                    // Khôi phục giao dịch gốc về trạng thái Pending (Chưa trả)
                    // Để người dùng quyết định trả full hoặc xóa sau
                    if (plan.originalTxIds && plan.originalTxIds.length > 0) {
                        app.data.transactions.forEach(t => {
                            if (plan.originalTxIds.includes(t.id)) {
                                t.status = 'pending';
                                t.tags = t.tags.replace('#da_chuyen_tra_gop', '').trim();
                            }
                        });
                    }
                }
                // 2. XỬ LÝ LOGIC MẶC ĐỊNH (KHÔI PHỤC TRẠNG THÁI)
                else {
                    if (plan.originalTxIds && plan.originalTxIds.length > 0) {
                        app.data.transactions.forEach(t => {
                            if (plan.originalTxIds.includes(t.id)) {
                                t.status = 'pending';
                            }
                        });
                    } else {
                        // Fallback cho data cũ
                        app.data.transactions.forEach(t => {
                            if (t.source === plan.source && t.status === 'paid' && t.type === 'Chi tiêu' && !t.tags.includes('#tra_gop')) {
                                t.status = 'pending';
                            }
                        });
                    }
                    // Xóa các giao dịch trả góp con đã sinh ra (nếu có logic sinh tx con)
                    app.data.transactions = app.data.transactions.filter(t => {
                        const isInstallmentPayment = t.tags && t.tags.includes('#tra_gop') && t.source === plan.source;
                        return !isInstallmentPayment;
                    });
                }

                // Xóa plan
                delete app.data.installmentPlans[planId];

                app.storage.save();
                app.ui.renderAll();

                if (plan.isShopee && paidAmount > 0) {
                    app.ui.popup.show(`Đã hủy và hoàn lại <b>${app.logic.formatCurrency(paidAmount)}</b>!`, "success");
                } else {
                    app.ui.popup.show(`Đã hủy gói trả góp thành công!`, "success");
                }
            }
        );
    },

    // 5. XÓA PHẠT
    waivePenalty(planId) {
        const plan = app.data.installmentPlans[planId];
        if (!plan) return;
        const amountToRemove = plan.preservedPenalty || 0;

        if (amountToRemove > 0) {
            app.ui.popup.confirm(
                "Xóa bỏ khoản phạt bảo lưu (Gốc cũ)?<br><br>Hành động này sẽ trừ số tiền này khỏi Kỳ 1 và Tổng nợ.",
                () => {
                    plan.totalRepayment -= amountToRemove;
                    if (plan.payments && plan.payments.length > 0) {
                        plan.payments[0].amount -= amountToRemove;
                        if (plan.payments[0].breakdown) {
                            plan.payments[0].breakdown.extra -= amountToRemove;
                        }
                    }
                    plan.preservedPenalty = 0;
                    plan.penaltyWaived = true;
                    app.storage.save();
                    app.ui.renderAll();
                    app.ui.popup.show("Đã xóa khoản phạt thành công!", "success");
                }
            );
        }
    },

    // --- THÊM VÀO app.ui (File 5-ui.js) ---

    editInstallmentPeriod(planId, dateKey, currentAmount) {
        app.ui.popup.prompt(
            `Sửa số tiền kỳ <b>${dateKey}</b>?<br>Hiện tại: <b>${app.logic.formatCurrency(currentAmount)}</b><br>Nhập số tiền thực tế:`,
            (val) => {
                const newVal = Number(val.replace(/[^0-9]/g, ''));
                if (isNaN(newVal)) return;

                const plan = app.data.installmentPlans[planId];
                if (!plan) return;

                const payment = plan.payments.find(p => p.date === dateKey);
                if (payment) {
                    // 1. Cập nhật số tiền kỳ này
                    payment.amount = newVal;

                    // 2. [QUAN TRỌNG] TÍNH LẠI TỔNG VAY
                    // Cộng tổng tiền của tất cả các kỳ + Phạt bảo lưu (nếu có)
                    const newTotalRepayment = plan.payments.reduce((sum, p) => sum + p.amount, 0) + (plan.preservedPenalty || 0);

                    // Cập nhật vào Plan
                    plan.totalRepayment = newTotalRepayment;

                    // 3. Lưu và Vẽ lại giao diện (Số tổng vay và % sẽ tự nhảy theo)
                    app.storage.save();
                    app.ui.renderAll();

                    app.ui.popup.show(`✅ Đã cập nhật kỳ ${dateKey}: ${app.logic.formatCurrency(newVal)}<br>Tổng vay mới: ${app.logic.formatCurrency(newTotalRepayment)}`, "success");
                }
            },
            "SỬA KỲ TRẢ GÓP"
        );
    },

    payInstallmentCustom(planId, dateKey, currentRemaining) {
        app.ui.popup.prompt(
            `THANH TOÁN KỲ <b>${dateKey}</b><br>
             Dư nợ kỳ này: <b>${app.logic.formatCurrency(currentRemaining)}</b><br>
             Nhập số tiền bạn muốn trả thực tế:`,
            (val) => {
                const amount = Number(val.replace(/[^0-9]/g, ''));
                if (!amount || amount <= 0) {
                    return app.ui.popup.show("Số tiền không hợp lệ!", "error");
                }
                if (amount > currentRemaining) {
                    return app.ui.popup.show("Số tiền trả vượt quá dư nợ còn lại của kỳ này!", "warning");
                }

                const plan = app.data.installmentPlans[planId];
                if (!plan) return;

                const payment = plan.payments.find(p => p.date === dateKey);
                if (!payment) return;

                // 1. Tạo giao dịch chi tiêu (Tiền ra)
                // Logic ngày 28/1 (nếu bạn đang dùng logic này)
                const useNewLogic = new Date() > new Date('2026-01-28T23:59:59');
                const txSource = useNewLogic ? "Tiền mặt" : plan.source;
                const txDest = useNewLogic ? plan.source : null;

                app.data.transactions.push({
                    id: Date.now(),
                    type: 'Chi tiêu',
                    place: `Trả nợ ${plan.source} (Kỳ ${dateKey})`,
                    source: txSource,
                    destination: txDest,
                    amount: amount,
                    date: new Date().toISOString(),
                    tags: '#tra_gop', // Tag quan trọng để không bị tính trùng vào chi tiêu
                    status: 'paid',
                    note: `Thanh toán một phần kỳ ${dateKey}`
                });

                // 2. Cập nhật trạng thái kỳ trả góp
                // Cộng dồn số tiền đã trả
                payment.paidAmount = (payment.paidAmount || 0) + amount;

                // Kiểm tra nếu đã trả đủ hoặc dư -> Đánh dấu hoàn thành kỳ này
                const totalDue = payment.amount + (payment.penaltyAmt || 0);
                if (payment.paidAmount >= totalDue) {
                    payment.paid = true;
                }

                // 3. Lưu và Vẽ lại
                app.storage.save();
                app.ui.renderAll();

                app.ui.popup.show(`✅ Đã thanh toán: <b>${app.logic.formatCurrency(amount)}</b> cho kỳ ${dateKey}.`, "success");
            },
            "TRẢ TÙY CHỌN"
        );
    },

    deleteShopeePeriod(planId, dateKey) {
        const plan = app.data.installmentPlans[planId];
        if (!plan) return;

        // Khởi tạo biến đếm nếu chưa có
        if (typeof plan.deletedCount === 'undefined') plan.deletedCount = 0;

        // Kiểm tra điều kiện
        if (plan.deletedCount >= 3) {
            return app.ui.popup.show("⛔ Giới hạn an toàn: Bạn chỉ được xóa tối đa 3 kỳ trả góp!", "error");
        }

        // Tìm kỳ muốn xóa
        const payment = plan.payments.find(p => p.date === dateKey);
        if (!payment) return;

        app.ui.popup.confirm(
            `Xóa kỳ hạn <b>${dateKey}</b>?<br>
             <span style="color:var(--danger); font-size:0.8rem">Số tiền <b>${app.logic.formatCurrency(payment.amount)}</b> sẽ bị trừ khỏi tổng nợ.</span><br>
             <span style="font-size:0.75rem; font-style:italic">(Đã xóa: ${plan.deletedCount}/3 kỳ)</span>`,
            () => {
                // 1. Xóa khỏi mảng payments
                plan.payments = plan.payments.filter(p => p.date !== dateKey);

                // 2. Cập nhật Tổng vay (Trừ đi số tiền vừa xóa)
                plan.totalRepayment -= payment.amount;

                // 3. Tăng biến đếm
                plan.deletedCount++;

                // 4. Lưu và Render
                app.storage.save();
                app.ui.renderAll();
                app.ui.popup.show(`✅ Đã xóa thành công.<br>(Còn lại ${3 - plan.deletedCount} lượt xóa)`, "success");
            }
        );
    },

    modals: {
        transaction: {
            open(id = null) {
                const tetBox = document.getElementById('tet-option-box');
                const tetInput = document.getElementById('tx-is-tet');
                const currentMonth = new Date().getMonth() + 1; // getMonth() trả về 0-11 nên cần +1

                // Chỉ hiện trong tháng 2
                if (currentMonth === 2) {
                    tetBox.style.display = 'flex';
                } else {
                    tetBox.style.display = 'none';
                }
                tetInput.checked = false; // Mặc định không chọn

                // Nếu đang sửa (id tồn tại), load lại trạng thái cũ
                if (id) {
                    const tx = app.data.transactions.find(t => t.id === id);
                    if (tx && tx.isTet) {
                        tetInput.checked = true;
                        tetBox.style.display = 'flex'; // Cho hiện lại để biết đang là giao dịch Tết
                    }
                }
                const modal = document.getElementById('modal-tx');
                modal.style.zIndex = '99999';
                const form = document.getElementById('form-tx');
                const countdownEl = document.getElementById('tx-countdown');
                const btnLawyer = document.getElementById('btn-lawyer-excuse'); // <--- 1. Lấy nút Bào chữa

                form.reset();
                if (document.getElementById('tx-is-unknown-time')) document.getElementById('tx-is-unknown-time').checked = false; // THÊM DÒNG NÀY
                document.getElementById('tx-discount').value = '';
                document.getElementById('discount-hint').innerHTML = '';
                if (document.getElementById('tx-is-cashback')) {
                    document.getElementById('tx-is-cashback').checked = false;
                    app.ui.toggleCashbackMode();
                }
                document.getElementById('btn-delete-tx').classList.add('hidden');
                document.getElementById('tx-locked-msg').style.display = 'none';
                countdownEl.textContent = '';

                const inputs = modal.querySelectorAll('input, select');
                inputs.forEach(input => input.disabled = false);

                if (app.ui.transactionModalInterval) {
                    clearInterval(app.ui.transactionModalInterval);
                    app.ui.transactionModalInterval = null;
                }

                if (id) {
                    // --- CHẾ ĐỘ SỬA (Hiện nút Bào chữa) ---
                    const tx = app.data.transactions.find(t => t.id === id);
                    if (tx) {
                        document.getElementById('tx-id').value = tx.id;
                        document.getElementById('tx-type').value = tx.type;
                        document.getElementById('tx-status').value = tx.status || 'paid';
                        const discountAmt = tx.discountAmount || 0;
                        let originalPrice = tx.amount;
                        // Chỉ cộng lại tiền giảm nếu giao dịch này KHÔNG PHẢI là hoàn tiền
                        if (discountAmt > 0 && tx.isCashback !== true) {
                            originalPrice = tx.amount + discountAmt;
                        }

                        // 2. Điền giá gốc vào ô input
                        document.getElementById('tx-amount').value = originalPrice;

                        // 3. Điền lại giá trị giảm giá (Nếu có lưu discountValue thì dùng, ko thì dùng discountAmount)
                        const discountVal = tx.discountValue || (discountAmt > 0 ? discountAmt : '');
                        document.getElementById('tx-discount').value = discountVal;

                        if (document.getElementById('tx-is-cashback')) {
                            // Lưu ý: Đổi chữ tx.isCashback thành đúng tên biến bạn đang dùng để lưu trong Database
                            document.getElementById('tx-is-cashback').checked = tx.isCashback === true;
                            app.ui.toggleCashbackMode();
                        }

                        // 4. Gọi hàm tính toán ngay lập tức để hiện gợi ý (Hint)
                        app.ui.calcDiscount();
                        document.getElementById('tx-amount').value = tx.amount;
                        document.getElementById('tx-place').value = tx.place;
                        document.getElementById('tx-brand').value = tx.brand || '';
                        document.getElementById('tx-source').value = tx.source;
                        // [MỚI] Điền dữ liệu Chuyển tới
                        document.getElementById('tx-destination').value = tx.destination || '';
                        document.getElementById('tx-date').value = tx.date.slice(0, 16);
                        if (document.getElementById('tx-is-unknown-time')) document.getElementById('tx-is-unknown-time').checked = tx.isUnknownTime === true; // THÊM DÒNG NÀY
                        document.getElementById('tx-tags').value = tx.tags;
                        const tetInput = document.getElementById('tx-is-tet');
                        const tetBox = document.getElementById('tet-option-box');

                        // Reset trước
                        tetInput.checked = false;

                        // Nếu giao dịch này ĐÃ là Lì xì
                        if (tx.isTet === true) {
                            tetInput.checked = true;       // 1. Đánh dấu tick
                            tetBox.style.display = 'flex'; // 2. Bắt buộc hiện nút này lên (kể cả khi hết tháng 2)
                        } else {
                            // Nếu không phải Lì xì, thì kiểm tra xem có phải tháng 2 không để hiện/ẩn nút nhập
                            const currentMonth = new Date().getMonth() + 1;
                            if (currentMonth === 2) {
                                tetBox.style.display = 'flex';
                            } else {
                                tetBox.style.display = 'none';
                            }
                        }

                        // --- [UPDATE] LOGIC KHÔNG KHÓA CHO: DỰ KIẾN & SẮP NHẬN ---
                        const isPlanned = tx.status === 'planned';
                        const isPendingIncome = tx.type === 'Thu nhập' && tx.status === 'pending'; // Trạng thái "Sắp nhận"

                        if (isPlanned || isPendingIncome) {
                            // Xóa bộ đếm cũ nếu có
                            if (app.ui.transactionModalInterval) clearInterval(app.ui.transactionModalInterval);

                            // Hiển thị thông báo tương ứng
                            if (isPendingIncome) {
                                countdownEl.textContent = '⏳ Đang chờ tiền về (Sắp nhận - Không khóa)';
                                countdownEl.style.color = 'var(--warning)';
                            } else {
                                countdownEl.textContent = '📅 Đang ở trạng thái Dự kiến (Không khóa)';
                                countdownEl.style.color = '';
                            }

                            document.getElementById('tx-locked-msg').style.display = 'none';
                            document.getElementById('btn-delete-tx').classList.remove('hidden');

                            // Bật lại các nút cho chắc chắn
                            document.getElementById('btn-delete-tx').onclick = () => {
                                app.ui.popup.confirm(
                                    "Hành động này không thể hoàn tác.\nBạn chắc chắn muốn xóa vĩnh viễn?",
                                    () => {
                                        // 1. Xóa giao dịch khỏi dữ liệu
                                        app.data.transactions = app.data.transactions.filter(t => t.id !== id);
                                        app.storage.save();

                                        // 2. Cập nhật Dashboard
                                        app.ui.renderAll();
                                        app.ui.init();

                                        // 3. [FIX] CẬP NHẬT LẠI VÍ / NGÂN HÀNG (Nếu đang mở)
                                        // Nếu đang mở danh sách Ví -> Vẽ lại
                                        if (document.getElementById('modal-wallets').classList.contains('active')) {
                                            app.ui.modals.wallets.render();
                                            // Nếu đang xem chi tiết 1 ví cụ thể -> Vẽ lại chi tiết ví đó
                                            if (document.getElementById('modal-wallet-detail').classList.contains('active') && app.ui.modals.wallets.currentWalletId) {
                                                app.ui.modals.wallets.openDetail(app.ui.modals.wallets.currentWalletId);
                                            }
                                        }
                                        // Nếu đang mở danh sách Ngân hàng -> Vẽ lại
                                        if (document.getElementById('modal-banks').classList.contains('active')) {
                                            app.ui.modals.banks.render();
                                            // Lưu ý: Nếu đang xem chi tiết ngân hàng, bạn cần đóng và mở lại hoặc lưu bankId hiện tại để refresh tương tự ví.
                                            // Tạm thời đóng modal chi tiết bank để user mở lại cho dữ liệu mới nhất
                                            if (document.getElementById('modal-bank-detail').classList.contains('active')) {
                                                document.getElementById('modal-bank-detail').classList.remove('active');
                                            }
                                        }

                                        // 4. Đóng modal và thông báo
                                        modal.classList.remove('active');
                                        app.ui.popup.show("Đã xóa dữ liệu thành công.", "success");
                                    }
                                );
                            };

                            // Quan trọng: Return luôn để không chạy logic đếm ngược khóa bên dưới
                            if (btnLawyer) btnLawyer.classList.remove('hidden');
                            btnLawyer.onclick = () => app.logic.consultLawyer(tx);
                            modal.classList.add('active');
                            return;
                        }
                        // ---------------------------------------------------------------
                        // <--- 2. Logic hiển thị nút Bào chữa ---
                        if (btnLawyer) {
                            btnLawyer.classList.remove('hidden'); // Hiện nút
                            btnLawyer.onclick = () => app.logic.consultLawyer(tx); // Gán sự kiện click
                        }
                        // ---------------------------------------

                        const createdTime = tx.id;
                        const lockDuration = 3 * 24 * 60 * 60 * 1000;
                        const lockTime = createdTime + lockDuration;

                        const updateCountdown = () => {
                            const now = Date.now();
                            const remaining = lockTime - now;

                            if (remaining <= 0) {
                                clearInterval(app.ui.transactionModalInterval);
                                countdownEl.textContent = '';

                                document.getElementById('tx-type').disabled = true;
                                document.getElementById('tx-amount').disabled = true;
                                document.getElementById('tx-discount').disabled = true;
                                document.getElementById('tx-place').disabled = true;
                                document.getElementById('tx-destination').disabled = true;

                                // --- Sửa Thương hiệu (Brand) 1 lần ---
                                const brandInput = document.getElementById('tx-brand');
                                if (tx.isBrandFixed) {
                                    brandInput.disabled = true;
                                    brandInput.placeholder = "Đã sửa 1 lần (Khóa)";
                                    brandInput.style.borderColor = "";
                                } else {
                                    brandInput.disabled = false;
                                    brandInput.style.borderColor = "#eab308"; // Cảnh báo vàng
                                    brandInput.title = "Bạn được phép sửa Thương Hiệu 1 lần duy nhất sau khi khóa";
                                }

                                // --- XÁC ĐỊNH GIAO DỊCH TRẢ NỢ ---
                                const isDebtPayment = tx.tags && (
                                    tx.tags.includes('#thanh_toan_no') ||
                                    tx.tags.includes('#tra_gop') ||
                                    tx.tags.includes('#nop_phat') ||
                                    tx.tags.includes('#thanh_toan_phi') ||
                                    tx.tags.includes('#tat_toan_vay') ||
                                    tx.tags.includes('#tra_no_vay')
                                );

                                // --- Sửa Nguồn tiền (Source) 1 lần cho giao dịch trả nợ ---
                                const sourceInput = document.getElementById('tx-source');
                                if (isDebtPayment) {
                                    if (tx.isSourceFixed) {
                                        sourceInput.disabled = true;
                                        sourceInput.style.borderColor = "";
                                    } else {
                                        sourceInput.disabled = false;
                                        sourceInput.style.borderColor = "#eab308";
                                        sourceInput.title = "Bạn được phép sửa Nguồn tiền 1 lần duy nhất sau khi khóa";
                                    }
                                } else {
                                    sourceInput.disabled = true;
                                    sourceInput.style.borderColor = "";
                                }

                                // --- Sửa Thời gian (Date) 1 lần cho giao dịch trả nợ ---
                                const dateInput = document.getElementById('tx-date');
                                if (isDebtPayment) {
                                    if (tx.isDateFixed) {
                                        dateInput.disabled = true;
                                        dateInput.style.borderColor = "";
                                    } else {
                                        dateInput.disabled = false;
                                        dateInput.style.borderColor = "#eab308";
                                        dateInput.title = "Bạn được phép sửa Thời gian 1 lần duy nhất sau khi khóa";
                                    }
                                } else {
                                    dateInput.disabled = true;
                                    dateInput.style.borderColor = "";
                                }

                                document.getElementById('tx-tags').disabled = true;

                                document.getElementById('tx-locked-msg').style.display = 'block';

                                // Đổi câu thông báo dựa theo loại giao dịch
                                let extraNotice = '*(Ngoại trừ Thương hiệu được sửa 1 lần)';
                                if (isDebtPayment) extraNotice = '*(Ngoại trừ Thương hiệu, Nguồn tiền và Thời gian được sửa 1 lần)';

                                document.getElementById('tx-locked-msg').innerHTML = `<i class="fa-solid fa-lock"></i> Giao dịch đã bị khóa (Quá 3 ngày).<br><span style="font-size:0.8em; color:#eab308">${extraNotice}</span>`;
                                document.getElementById('btn-delete-tx').classList.add('hidden');
                            } else {
                                const totalSeconds = Math.floor(remaining / 1000);
                                const hours = Math.floor(totalSeconds / 3600);
                                const minutes = Math.floor((totalSeconds % 3600) / 60);
                                const seconds = totalSeconds % 60;

                                const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                                countdownEl.textContent = `Tự động khóa sau: ${timeString}`;

                                document.getElementById('btn-delete-tx').classList.remove('hidden');
                                document.getElementById('btn-delete-tx').onclick = () => {
                                    if (confirm("Xóa giao dịch này?")) {
                                        app.data.transactions = app.data.transactions.filter(t => t.id !== id);
                                        app.storage.save(); app.ui.renderAll();
                                        app.ui.init();
                                        modal.classList.remove('active');
                                    }
                                };
                            }
                        };

                        updateCountdown();
                        app.ui.transactionModalInterval = setInterval(updateCountdown, 1000);
                    }
                } else {
                    // --- CHẾ ĐỘ THÊM MỚI (Ẩn nút Bào chữa) ---
                    document.getElementById('tx-id').value = '';
                    const now = new Date();
                    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                    document.getElementById('tx-date').value = now.toISOString().slice(0, 16);
                    document.getElementById('tx-status').value = 'paid';

                    // <--- 3. Ẩn nút khi thêm mới ---
                    if (btnLawyer) btnLawyer.classList.add('hidden');
                    // -------------------------------
                }
                modal.classList.add('active');
            }
        },

        reports: {
            open() {
                const modal = document.getElementById('modal-report');
                if (!modal) return;

                const container = modal.querySelector('.modal-box');
                if (!container) return;

                const month = app.data.filter.month;
                const [y, m] = month.split('-');

                // 1. CHUẨN BỊ SỐ LIỆU THU CHI (THÁNG HIỆN TẠI)
                const txs = app.logic.getFilteredTxs();
                const activeTxs = txs.filter(t => t.status !== 'cancelled');

                const incomeTxs = activeTxs.filter(t => t.type === 'Thu nhập' && t.status === 'paid');
                const expenseTxs = activeTxs.filter(t => t.type === 'Chi tiêu' && t.status !== 'planned');
                const pendingExpenseTxs = activeTxs.filter(t => t.type === 'Chi tiêu' && t.status === 'pending');

                const transferTxs = activeTxs.filter(t => t.type === 'Chuyển tiền' && t.status === 'paid');
                const totalTransfer = transferTxs.reduce((s, t) => s + t.amount, 0);

                const totalInc = incomeTxs.reduce((s, t) => s + t.amount, 0);
                const totalExp = expenseTxs.reduce((s, t) => s + t.amount, 0); // Đã bao gồm cả nợ chưa trả
                const totalPendingExp = pendingExpenseTxs.reduce((s, t) => s + t.amount, 0); // Phần chi tiêu nợ
                const netBalance = totalInc - totalExp;

                // 2. SỐ LIỆU NGÂN SÁCH
                const budgetLimit = Number(app.data.configs.monthlyLimits?.[month]) || 0;
                let budgetPercent = 0;
                let budgetText = "Chưa thiết lập";
                let budgetColor = "#94a3b8";
                if (budgetLimit > 0) {
                    budgetPercent = Math.min(100, (totalExp / budgetLimit) * 100);
                    budgetText = `${app.logic.formatCurrency(totalExp)} / ${app.logic.formatCurrency(budgetLimit)}`;
                    if (budgetPercent >= 100) budgetColor = "#ef4444";
                    else if (budgetPercent >= 80) budgetColor = "#f59e0b";
                    else budgetColor = "#10b981";
                }

                // 3. BỨC TRANH TÀI SẢN (TỔNG HỢP TOÀN BỘ DỮ LIỆU)
                let totalCash = 0;
                (app.data.cashWallets || []).forEach(w => totalCash += app.ui.modals.cash.calculateBalance(w));

                let totalBank = 0;
                (app.data.accounts || []).forEach(a => totalBank += (Number(app.logic.calculateBankBalance(a)) || 0));

                let totalWallet = 0;
                (app.data.wallets || []).forEach(w => totalWallet += app.logic.calculateWalletBalance(w));

                const currentAssets = totalCash + totalBank + totalWallet;

                // Tổng Nợ (Tín dụng + Khoản vay)
                const upcomingData = app.logic.getUpcomingDebts();
                const currentCreditDebt = upcomingData.displayTotal;

                let currentLoanDebt = 0;
                (app.data.loans || []).filter(l => l.status === 'active').forEach(l => {
                    const debt = l.schedule ? l.schedule.reduce((s, p) => s + p.principal + p.interest, 0) : (l.originalAmount + l.interest);
                    currentLoanDebt += Math.max(0, debt - l.paid);
                });

                const currentLiabilities = currentCreditDebt + currentLoanDebt;
                const netWorth = currentAssets - currentLiabilities;

                // 4. DANH MỤC CHI TIÊU & BIỂU ĐỒ
                const tagMap = {};
                expenseTxs.forEach(t => {
                    let tag = 'Khác';
                    if (t.tags) {
                        const cleanTags = t.tags.split(',').map(tag => tag.trim())
                            .filter(tag => !tag.startsWith('#tra_gop') && !tag.startsWith('#da_chuyen') && !tag.startsWith('#du_no'));
                        if (cleanTags.length > 0) tag = cleanTags[0];
                    }
                    tagMap[tag] = (tagMap[tag] || 0) + t.amount;
                });
                const sortedTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]);

                // 5. TOP GIAO DỊCH LỚN NHẤT
                const topSpends = [...expenseTxs].sort((a, b) => b.amount - a.amount).slice(0, 3);

                // --- TẠO GIAO DIỆN HTML ---
                const formatNum = app.logic.formatCurrency;

                // 5.1. Thẻ Báo Cáo Thu Chi & Chuyển Tiền
                const summaryHTML = `
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10px;">
                        <div style="background:#ecfdf5; border:1px solid #10b981; border-radius:12px; padding:12px;">
                            <div style="font-size:0.75rem; color:#047857; font-weight:700; text-transform:uppercase; margin-bottom:4px;"><i class="fa-solid fa-arrow-turn-down"></i> Tổng Thu Nhập</div>
                            <div style="font-family:var(--font-mono); font-weight:900; font-size:1.2rem; color:#059669;">${formatNum(totalInc)}</div>
                        </div>
                        <div style="background:#fff1f2; border:1px solid #e11d48; border-radius:12px; padding:12px;">
                            <div style="font-size:0.75rem; color:#be123c; font-weight:700; text-transform:uppercase; margin-bottom:4px;"><i class="fa-solid fa-arrow-turn-up"></i> Tổng Chi Tiêu</div>
                            <div style="font-family:var(--font-mono); font-weight:900; font-size:1.2rem; color:#e11d48;">${formatNum(totalExp)}</div>
                            ${totalPendingExp > 0 ? `<div style="font-size:0.65rem; color:#e11d48; opacity:0.8; margin-top:2px;">(Gồm ${formatNum(totalPendingExp)} đang nợ)</div>` : ''}
                        </div>
                    </div>
                    
                    <div style="background:#f0f9ff; border:1px solid #0ea5e9; border-radius:12px; padding:12px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-size:0.75rem; color:#0369a1; font-weight:700; text-transform:uppercase; margin-bottom:4px;">
                                <i class="fa-solid fa-money-bill-transfer"></i> Luân chuyển nội bộ
                            </div>
                            <div style="font-size:0.75rem; color:#0284c7; opacity:0.8;">
                                <b>${transferTxs.length}</b> lượt điều phối quỹ
                            </div>
                        </div>
                        <div style="font-family:var(--font-mono); font-weight:900; font-size:1.2rem; color:#0284c7;">
                            ${formatNum(totalTransfer)}
                        </div>
                    </div>
                `;

                // 5.2. Thẻ Ngân Sách
                const budgetHTML = `
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:15px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem; font-weight:700;">
                            <span style="color:#475569"><i class="fa-solid fa-bullseye"></i> Ngân sách tháng ${m}</span>
                            <span style="color:${budgetColor}">${budgetPercent.toFixed(1)}%</span>
                        </div>
                        <div style="height:10px; background:#f1f5f9; border-radius:99px; overflow:hidden; margin-bottom:6px;">
                            <div style="height:100%; width:${budgetPercent}%; background:${budgetColor}; border-radius:99px;"></div>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); text-align:right;">${budgetText}</div>
                    </div>
                `;

                // 5.3. Thẻ Bức tranh Tài sản (Net Worth)
                const netWorthColor = netWorth >= 0 ? '#2563eb' : '#dc2626';
                const assetsHTML = `
                    <div style="background:linear-gradient(135deg, #1e293b, #0f172a); border-radius:12px; padding:15px; color:white; margin-bottom:15px; position:relative; overflow:hidden;">
                        <div style="position:absolute; right:-10px; top:-10px; font-size:4rem; opacity:0.05;"><i class="fa-solid fa-scale-balanced"></i></div>
                        <div style="position:relative; z-index:1;">
                            <div style="font-size:0.8rem; opacity:0.8; font-weight:700; text-transform:uppercase; margin-bottom:2px;">Tài sản ròng (Net Worth)</div>
                            <div style="font-family:var(--font-mono); font-weight:900; font-size:1.5rem; margin-bottom:12px; color:${netWorth >= 0 ? '#60a5fa' : '#f87171'};">
                                ${netWorth >= 0 ? '+' : ''}${formatNum(netWorth)}
                            </div>
                            
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:0.8rem;">
                                <div style="background:rgba(255,255,255,0.1); padding:8px; border-radius:8px;">
                                    <div style="opacity:0.7; margin-bottom:2px;">Hiện Có</div>
                                    <div style="font-weight:bold; color:#a7f3d0">${formatNum(currentAssets)}</div>
                                </div>
                                <div style="background:rgba(255,255,255,0.1); padding:8px; border-radius:8px;">
                                    <div style="opacity:0.7; margin-bottom:2px;">Công Nợ</div>
                                    <div style="font-weight:bold; color:#fecaca">${formatNum(currentLiabilities)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                // 5.4. Top Chi Tiêu Lớn Nhất
                let topSpendsHTML = '';
                if (topSpends.length > 0) {
                    topSpendsHTML = `
                        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:15px;">
                            <div style="font-weight:800; font-size:0.85rem; color:#475569; margin-bottom:10px; text-transform:uppercase;">
                                <i class="fa-solid fa-ranking-star" style="color:#f59e0b"></i> Top Chi Tiêu Lớn Nhất
                            </div>
                            ${topSpends.map((t, i) => `
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:${i === topSpends.length - 1 ? 'none' : '1px dashed #f1f5f9'};">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <div style="width:24px; height:24px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold; color:#64748b;">${i + 1}</div>
                                        <div>
                                            <div style="font-weight:600; font-size:0.85rem; color:#334155;">${t.place}</div>
                                            <div style="font-size:0.7rem; color:#94a3b8;">${new Date(t.date).toLocaleDateString('vi-VN')}</div>
                                        </div>
                                    </div>
                                    <div style="font-family:var(--font-mono); font-weight:700; color:#ef4444; font-size:0.9rem;">
                                        -${formatNum(t.amount)}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }

                // 5.5. HTML Danh mục chi tiêu (Giữ nguyên phong cách cũ)
                const listHTML = sortedTags.map(([tag, amt], index) => {
                    const percent = totalExp > 0 ? (amt / totalExp) * 100 : 0;
                    const colors = ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#64748b'];
                    const color = colors[index % colors.length];

                    return `
                        <div style="margin-bottom: 10px;">
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700; margin-bottom:4px;">
                                <span style="display:flex; align-items:center; gap:6px;">
                                    <span style="display:inline-block; width:8px; height:8px; background:${color}; border-radius:50%;"></span>
                                    ${tag}
                                </span>
                                <span>${formatNum(amt)} <span style="font-size:0.7rem; color:var(--text-muted); font-weight:normal">(${percent.toFixed(1)}%)</span></span>
                            </div>
                            <div style="height:6px; background:#f1f5f9; border-radius:99px; overflow:hidden;">
                                <div style="height:100%; width:${percent}%; background:${color}; border-radius:99px;"></div>
                            </div>
                        </div>
                    `;
                }).join('');

                // 6. GẮN VÀO CONTAINER
                // Chú ý: Đặt max-height và overflow-y cho khung để scroll được nếu nội dung dài
                container.innerHTML = `
                    <div style="padding: 15px; max-height: 85vh; overflow-y: auto; overflow-x: hidden;">
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; position:sticky; top:-15px; background:var(--bg-panel); z-index:10; padding:10px 0;">
                            <div style="font-size:1.2rem; font-weight:900; color:var(--text-main); display:flex; align-items:center; gap:10px;">
                                <i class="fa-solid fa-chart-pie" style="color:var(--primary)"></i> Báo Cáo T${m}/${y}
                            </div>
                            <button onclick="document.getElementById('modal-report').classList.remove('active')" 
                                    style="border:none; background:#f3f4f6; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#4b5563;">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        ${summaryHTML}
                        ${budgetHTML}
                        ${assetsHTML}
                        ${topSpendsHTML}
                        
                        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                            <div style="text-align:center; font-weight:800; margin-bottom:15px; font-size:0.9rem; text-transform:uppercase; color:#475569;">Phân bổ danh mục</div>
                            
                            <div style="position: relative; height: 180px; width: 100%; margin-bottom: 20px;">
                                <canvas id="reportChartDetail"></canvas>
                            </div>

                            <div style="border-top: 1px dashed #e2e8f0; padding-top: 15px;">
                                ${listHTML || '<div style="text-align:center; color:#94a3b8; font-style:italic;">Chưa có dữ liệu phân bổ</div>'}
                            </div>
                        </div>

                    </div>
                `;

                // 7. VẼ LẠI BIỂU ĐỒ TRÒN
                if (app.ui.reportChartInstance) app.ui.reportChartInstance.destroy();

                const canvas = document.getElementById('reportChartDetail');
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    app.ui.reportChartInstance = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: sortedTags.map(x => x[0]),
                            datasets: [{
                                data: sortedTags.map(x => x[1]),
                                backgroundColor: ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#64748b'],
                                borderWidth: 2,
                                borderColor: '#ffffff',
                                hoverOffset: 5
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: { padding: 0 },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    callbacks: {
                                        label: function (context) {
                                            let label = context.label || '';
                                            if (label) label += ': ';
                                            if (context.parsed !== null) label += formatNum(context.parsed);
                                            return label;
                                        }
                                    }
                                }
                            },
                            cutout: '65%'
                        }
                    });
                }

                modal.classList.add('active');
            }
        },

        debt: {
            open() {
                document.getElementById('modal-debt').classList.add('active');
            }
        },
        // --- TÌM ĐOẠN CODE loans: { ... } VÀ DÁN ĐÈ TOÀN BỘ ĐOẠN NÀY VÀO ---
        loans: {
            open() {
                const modal = document.getElementById('modal-loans');
                this.render();

                const btnAdd = document.getElementById('btn-add-loan');

                // --- LOGIC TẠO KHOẢN VAY MỚI (DÙNG POPUP) ---
                btnAdd.onclick = () => {
                    const lender = document.getElementById('loan-lender').value;
                    const totalPrincipal = Number(document.getElementById('loan-amount').value.replace(/[^0-9]/g, ''));

                    if (!lender || !totalPrincipal) {
                        return app.ui.popup.show("Vui lòng nhập Chủ nợ và Tổng tiền gốc!", "error");
                    }

                    // Bước 1: Hỏi số kỳ trả
                    app.ui.popup.prompt(
                        `Khoản vay <b>${app.logic.formatCurrency(totalPrincipal)}</b><br>Bạn muốn trả trong bao nhiêu tháng?`,
                        (val) => {
                            const months = parseInt(val) || 1;

                            // Bước 2: Tự động tính toán (Thay vì hỏi từng tháng)
                            const avgPrincipal = Math.floor(totalPrincipal / months);
                            let schedule = [];
                            let currentTotalPrincipal = 0;
                            const now = new Date();

                            for (let i = 1; i <= months; i++) {
                                // Hạn là ngày 7 của tháng sau nữa (T+1)
                                const termDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 7);
                                const termDateStr = termDate.toLocaleDateString('vi-VN');

                                let suggestPrincipal = avgPrincipal;
                                if (i === months) {
                                    suggestPrincipal = totalPrincipal - currentTotalPrincipal;
                                }
                                currentTotalPrincipal += suggestPrincipal;

                                // Mặc định lãi = 0 (Muốn sửa thì vào chi tiết sau - chưa hỗ trợ sửa chi tiết nhưng an toàn hơn prompt loop)
                                schedule.push({
                                    period: i,
                                    dueDate: termDateStr,
                                    principal: suggestPrincipal,
                                    interest: 0,
                                    paid: 0,
                                    isFinished: false
                                });
                            }

                            const newLoan = {
                                id: Date.now(), lender: lender, originalAmount: totalPrincipal,
                                interest: 0, periods: months, schedule: schedule,
                                date: new Date().toISOString(), status: 'active', isDateFixed: false
                            };

                            app.data.loans.push(newLoan);
                            app.data.transactions.push({
                                id: Date.now() + 1, type: 'Thu nhập', place: `Vay tiền từ ${lender}`,
                                source: 'Tiền mặt', amount: totalPrincipal, date: new Date().toISOString(),
                                tags: '#di_vay', status: 'paid', note: `Vay ${months} kỳ.`
                            });

                            document.getElementById('loan-lender').value = '';
                            document.getElementById('loan-amount').value = '';
                            document.getElementById('loan-interest').value = '';

                            app.storage.save();
                            app.ui.renderAll();
                            this.render();
                            app.ui.popup.show(`✅ Đã tạo khoản vay thành công!<br>Đã chia đều gốc cho ${months} tháng.`, "success");
                        }
                    );
                };

                modal.classList.add('active');
            },

            migrateOldData() {
                app.ui.popup.confirm(
                    "Cập nhật lại ngày Hạn Chót (Deadline) cho TẤT CẢ khoản vay cũ?",
                    () => {
                        let count = 0;
                        app.data.loans.forEach(loan => {
                            if (loan.status === 'active' && loan.schedule) {
                                const loanDate = new Date(loan.date);
                                loan.schedule.forEach(p => {
                                    const newDueDate = new Date(loanDate.getFullYear(), loanDate.getMonth() + p.period + 1, 7);
                                    p.dueDate = newDueDate.toLocaleDateString('vi-VN');
                                });
                                count++;
                            }
                        });
                        app.storage.save();
                        this.render();
                        app.ui.popup.show(`Đã cập nhật ${count} hồ sơ!`, "success");
                    }
                );
            },

            render() {
                const listEl = document.getElementById('loan-list');
                if (!listEl) return;

                const migrateBtnHTML = `
        <div style="text-align:right; margin-bottom:1rem;">
            <button class="btn btn-sm btn-outline" onclick="app.ui.modals.loans.migrateOldData()">
                <i class="fa-solid fa-sync"></i> Cập nhật quy tắc Hạn Chót
            </button>
        </div>`;

                const loans = app.data.loans.filter(l => l.status === 'active').sort((a, b) => new Date(b.date) - new Date(a.date));

                if (loans.length === 0) {
                    listEl.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:2rem;">Không có khoản vay nào.</div>';
                    return;
                }

                const listHTML = loans.map(l => {
                    let totalPaid = 0;
                    let totalDebt = 0;
                    let scheduleHTML = '';

                    if (l.schedule && l.schedule.length > 0) {
                        scheduleHTML = `<div style="margin-top:10px; border-top:1px dashed #eee; padding-top:10px; max-height:150px; overflow-y:auto;">`;
                        l.schedule.forEach(p => {
                            const kyTotal = p.principal + p.interest;
                            totalDebt += kyTotal; totalPaid += p.paid;
                            const kyRemaining = kyTotal - p.paid;
                            const isDone = kyRemaining <= 0;
                            const statusIcon = isDone ? `<i class="fa-solid fa-circle-check" style="color:var(--success)"></i>` : `<i class="fa-regular fa-circle" style="color:var(--text-muted)"></i>`;
                            const statusText = isDone ? `<span style="text-decoration:line-through; color:var(--text-muted)">Xong</span>` : `<b style="color:var(--danger)">-${app.logic.formatCurrency(kyRemaining)}</b>`;
                            const dateInfo = p.dueDate ? `<span style="color:var(--primary); font-weight:bold; margin-left:4px;">(Hạn: ${p.dueDate})</span>` : '';

                            scheduleHTML += `
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:6px; padding:4px; background:${isDone ? '#f0fdf4' : '#fff'}; border-radius:4px;">
                    <div style="display:flex; gap:6px; align-items:center;">
                        ${statusIcon}
                        <span>Kỳ ${p.period} ${dateInfo}:</span>
                        <span style="color:var(--text-muted); font-size:0.75rem">(${app.logic.formatCurrency(p.principal)} + ${app.logic.formatCurrency(p.interest)})</span>
                    </div>
                    <div>${statusText}</div>
                </div>`;
                        });
                        scheduleHTML += `</div>`;
                    } else {
                        const oldTotal = l.originalAmount + l.interest;
                        totalDebt = oldTotal; totalPaid = l.paid;
                    }

                    const remainingTotal = totalDebt - totalPaid;
                    const percent = totalDebt > 0 ? Math.min(100, (totalPaid / totalDebt) * 100) : 0;
                    const nextPeriod = l.schedule ? l.schedule.find(p => p.paid < (p.principal + p.interest)) : null;
                    const nextLabel = nextPeriod ? `Trả Kỳ ${nextPeriod.period}` : 'Trả nợ';

                    return `
        <div style="background:white; border:2px solid var(--border-color); border-radius:12px; padding:1rem; box-shadow: 4px 4px 0px rgba(0,0,0,0.1); margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="font-weight:900; font-size:1.1rem; color:#1e40af">${l.lender}</div>
                <div style="text-align:right">
                    <div style="font-weight:bold; font-size:1.2rem; color:var(--danger)">-${app.logic.formatCurrency(remainingTotal)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted)">Đã trả: ${Math.round(percent)}%</div>
                </div>
            </div>
            <div style="height:8px; background:#eff6ff; border-radius:4px; overflow:hidden; margin:0.5rem 0; border:1px solid #dbeafe;"><div style="height:100%; background:#3b82f6; width:${percent}%"></div></div>
            ${scheduleHTML}
            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap: wrap; margin-top:1rem; border-top:2px solid #f1f5f9; padding-top:10px;">
                <input type="text" id="pay-input-${l.id}" class="form-input" style="margin:0; padding:0.4rem; font-size:0.9rem; width: 120px;" placeholder="Nhập số tiền..." onkeyup="this.value=this.value.replace(/[^0-9]/g,'')">
                <button class="btn btn-sm" style="background:#dbeafe; color:#1e40af; border:1px solid #1e40af" onclick="app.ui.modals.loans.pay(${l.id})"><i class="fa-solid fa-money-bill-wave"></i> ${nextLabel}</button>
                <button class="btn btn-sm" style="background:var(--success); color:white; border:1px solid var(--success); margin-left:auto;" onclick="app.ui.modals.loans.payAll(${l.id})" title="Tất toán toàn bộ">Tất toán</button>
                 <button class="btn-ghost btn-sm" style="color:var(--danger);" onclick="app.ui.modals.loans.closeLoan(${l.id})" title="Xóa"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
                }).join('');
                listEl.innerHTML = migrateBtnHTML + listHTML;
            },

            pay(id) {
                const input = document.getElementById(`pay-input-${id}`);
                const rawAmount = Number(input.value.replace(/[^0-9]/g, ''));
                if (!rawAmount || rawAmount <= 0) return alert("Số tiền không hợp lệ!");

                const loan = app.data.loans.find(l => l.id === id);
                if (!loan) return;

                let collectionFee = 0;
                const isMomo = loan.lender.toLowerCase().includes('momo') || loan.lender.toLowerCase().includes('vay nhanh');
                if (isMomo) {
                    collectionFee = 20000;
                    if (rawAmount <= collectionFee) return alert("Không đủ đóng phí thu hộ!");
                }

                let moneyHolder = rawAmount - collectionFee;
                let actualPaidToDebt = 0;
                let logDetails = [];

                if (loan.schedule && loan.schedule.length > 0) {
                    for (let i = 0; i < loan.schedule.length; i++) {
                        if (moneyHolder <= 0) break;
                        let p = loan.schedule[i];
                        const periodDue = p.principal + p.interest;
                        const paidSoFar = Number(p.paid) || 0;
                        const periodMissing = periodDue - paidSoFar;

                        if (periodMissing > 0) {
                            const amountToPay = Math.min(moneyHolder, periodMissing);
                            p.paid = paidSoFar + amountToPay;
                            moneyHolder -= amountToPay;
                            actualPaidToDebt += amountToPay;
                            logDetails.push(`Kỳ ${p.period}: ${app.logic.formatCurrency(amountToPay)}`);
                        }
                    }
                } else {
                    actualPaidToDebt = moneyHolder;
                    logDetails.push("Trả nợ chung");
                }

                loan.paid += actualPaidToDebt;
                let noteStr = logDetails.join('; ');
                if (moneyHolder > 0) {
                    noteStr += ` (Dư thừa: ${app.logic.formatCurrency(moneyHolder)})`;
                    loan.paid += moneyHolder;
                }

                // [MỚI] Logic ngày 28/1
                const useNewLogic = new Date() > new Date('2026-01-28T23:59:59');
                // Với vay, nguồn luôn là Tiền mặt (hoặc bank), đích là Chủ nợ (lender)
                const txSource = "Tiền mặt";
                const txDest = useNewLogic ? loan.lender : null;

                app.data.transactions.push({
                    id: Date.now(), type: 'Chi tiêu', place: `Trả nợ ${loan.lender}`,
                    source: txSource,
                    destination: txDest, // [MỚI]
                    amount: rawAmount - collectionFee, date: new Date().toISOString(),
                    tags: '#tra_no_vay', status: 'paid', note: noteStr
                });

                if (collectionFee > 0) {
                    app.data.transactions.push({
                        id: Date.now() + 50, type: 'Chi tiêu', place: `Phí thu hộ (${loan.lender})`,
                        source: 'Tiền mặt', amount: collectionFee, date: new Date().toISOString(), tags: '#phi_dich_vu', status: 'paid'
                    });
                }

                let totalDebt = 0;
                if (loan.schedule) totalDebt = loan.schedule.reduce((sum, p) => sum + p.principal + p.interest, 0);
                else totalDebt = loan.originalAmount + loan.interest;

                if (loan.paid >= totalDebt) loan.status = 'closed';
                app.storage.save();
                app.ui.renderAll();
                this.render();

                // --- THAY ALERT CŨ BẰNG POPUP MỚI ---
                app.ui.popup.show(
                    `✅ Giao dịch thành công!\nTổng nạp: ${app.logic.formatCurrency(rawAmount)}`,
                    "success"
                );
                input.value = '';
            },

            // --- LOGIC TẤT TOÁN MỚI (UPDATE THEO YÊU CẦU) ---
            payAll(id) {
                const loan = app.data.loans.find(l => l.id === id);
                if (!loan) return;

                // 1. Tính toán gốc dự kiến trên Web
                let estimatedPrincipal = 0;
                if (loan.schedule && loan.schedule.length > 0) {
                    estimatedPrincipal = loan.schedule.reduce((sum, p) => {
                        const paidInPeriod = Number(p.paid) || 0;
                        const interestInPeriod = Number(p.interest) || 0;
                        const principalInPeriod = Number(p.principal) || 0;
                        const principalPaid = Math.max(0, paidInPeriod - interestInPeriod);
                        return sum + Math.max(0, principalInPeriod - principalPaid);
                    }, 0);
                } else {
                    const totalPaid = Number(loan.paid) || 0;
                    const totalInterest = Number(loan.interest) || 0;
                    const original = Number(loan.originalAmount) || 0;
                    const principalPaid = Math.max(0, totalPaid - totalInterest);
                    estimatedPrincipal = Math.max(0, original - principalPaid);
                }
                estimatedPrincipal = Math.round(estimatedPrincipal);

                // --- CÂU HỎI 1: CÓ MUỐN THAY ĐỔI KHÔNG? ---
                const wantChange = confirm(`Gốc trên Web tính được: ${app.logic.formatCurrency(estimatedPrincipal)}\n\nBạn có muốn thay đổi số liệu tất toán cho khớp với App ngân hàng không?`);

                let finalTotalPay = 0;
                let finalPenalty = 0;
                let finalPrincipal = estimatedPrincipal;

                if (wantChange) {
                    // --- CÂU HỎI 2: TRÊN APP PHẢI TRẢ BAO NHIÊU? ---
                    const method = prompt(
                        `TRÊN APP BẠN PHẢI TRẢ BAO NHIÊU?\n` +
                        `1. Nhập tổng số tiền cần trả (Gồm hết lãi/phạt)\n` +
                        `2. Lấy gốc trên Web (Để tính tiếp % phạt)\n` +
                        `3. Hủy bỏ`
                    );

                    if (method === '1') {
                        // LỰA CHỌN 1: NHẬP THẲNG TỔNG
                        const raw = prompt("Nhập TỔNG số tiền tất toán thực tế:");
                        if (!raw) return;
                        finalTotalPay = Number(raw.replace(/[^0-9]/g, ''));
                        if (finalTotalPay <= 0) return alert("Số tiền không hợp lệ");

                        this.processCloseLoan(loan, finalTotalPay, 0, finalPrincipal);
                        return; // Xong, thoát hàm
                    }
                    else if (method === '2') {
                        // LỰA CHỌN 2: CHẠY TIẾP XUỐNG DƯỚI (NHƯ BÌNH THƯỜNG)
                    }
                    else {
                        return; // LỰA CHỌN 3: HỦY
                    }
                }

                // --- QUY TRÌNH CHUẨN (NẾU CHỌN KHÔNG / CHỌN CÁCH 2) ---
                const correctPrincipalStr = prompt(`XÁC NHẬN GỐC CÒN LẠI (Xem trên App Momo/NH):`, finalPrincipal);
                if (correctPrincipalStr === null) return;
                const remainingPrincipal = Number(correctPrincipalStr.replace(/[^0-9]/g, '')) || 0;

                const choice = prompt(
                    `Gốc chốt: ${app.logic.formatCurrency(remainingPrincipal)}\nChọn phí phạt:\n` +
                    `1. 5% (EVN/Vietcredit...)\n2. 1% (FB/OB)\n3. Nhập tay\n4. Không phí`
                );
                if (choice === null) return;

                if (choice === '1') finalPenalty = Math.round(remainingPrincipal * 0.05);
                else if (choice === '2') finalPenalty = Math.round(remainingPrincipal * 0.01);
                else if (choice === '3') {
                    const m = prompt("Nhập phí:");
                    finalPenalty = Number(m?.replace(/[^0-9]/g, '') || 0);
                }

                let collectionFee = 0;
                if (loan.lender.toLowerCase().includes('momo') || loan.lender.toLowerCase().includes('vay nhanh')) collectionFee = 20000;

                finalTotalPay = remainingPrincipal + finalPenalty + collectionFee;

                this.processCloseLoan(loan, finalTotalPay, finalPenalty + collectionFee, remainingPrincipal);
            },

            // Hàm thực hiện đóng khoản vay
            processCloseLoan(loan, totalPay, fees, basePrincipal) {
                // Thay confirm gốc bằng app.ui.popup.confirm
                app.ui.popup.confirm(
                    `XÁC NHẬN TẤT TOÁN?\n\nTổng trả: <b>${app.logic.formatCurrency(totalPay)}</b>\n(Gốc: ${app.logic.formatCurrency(basePrincipal)} - Phí: ${app.logic.formatCurrency(fees)})`,
                    () => {
                        // Logic khi bấm ĐỒNG Ý
                        loan.paid += totalPay;
                        loan.status = 'closed';
                        if (loan.schedule) {
                            loan.schedule.forEach(p => {
                                p.paid = (p.principal || 0) + (p.interest || 0);
                                p.isFinished = true;
                            });
                        }

                        // [MỚI] Logic ngày 28/1
                        const useNewLogic = new Date() > new Date('2026-01-28T23:59:59');
                        const txDest = useNewLogic ? loan.lender : null;

                        app.data.transactions.push({
                            id: Date.now(),
                            type: 'Chi tiêu',
                            place: `Tất toán ${loan.lender}`,
                            source: 'Tiền mặt',
                            destination: txDest, // [MỚI]
                            amount: totalPay,
                            date: new Date().toISOString(),
                            tags: '#tat_toan_vay',
                            status: 'paid'
                        });
                        app.storage.save();
                        app.ui.renderAll();
                        this.render();

                        // Hiện thông báo thành công
                        app.ui.popup.show("✅ Đã tất toán khoản vay thành công!", "success");
                        if (app.effects) app.effects.triggerConfetti();
                    }
                );
            },

            closeLoan(id) {
                if (confirm("Xóa vĩnh viễn hồ sơ này?")) {
                    app.data.loans = app.data.loans.filter(l => l.id !== id);
                    app.storage.save(); this.render();
                }
            }
        },
        zalo: {
            open() {
                if (window.innerWidth <= 768 && document.getElementById('sidebar').classList.contains('active')) {
                    app.ui.toggleMobileMenu();
                }
                document.getElementById('modal-zalo').classList.add('active');
                app.ui.renderZaloWidget();

                // SETUP MANUAL FIELDS
                const count = app.data.configs.zaloManualCount || 0;
                const max = 100;
                const remaining = max - count;
                const inputs = document.getElementById('manual-inputs');
                const lockedMsg = document.getElementById('manual-locked-msg');
                const counter = document.getElementById('manual-counter');

                // Fill current values if exist
                document.getElementById('manual-rank-select').value = app.data.configs.manualZaloRank || "";
                document.getElementById('manual-amount-input').value = app.data.configs.manualZaloAmount || "";

                counter.textContent = `Còn lại: ${Math.max(0, remaining)} lần`;

                if (remaining <= 0) {
                    inputs.style.display = 'none';
                    lockedMsg.style.display = 'block';
                } else {
                    inputs.style.display = 'block';
                    lockedMsg.style.display = 'none';
                }
            }
        },
        missedTx: {
            open(source, dateKey) {
                const modal = document.getElementById('modal-missed-tx');
                const list = document.getElementById('missed-tx-list');
                const btnSave = document.getElementById('btn-save-missed-tx');
                const title = document.getElementById('modal-missed-tx-title');

                const [y, m] = app.data.filter.month.split('-');
                title.textContent = `Thêm Giao Dịch - Tháng ${m}/${y}`;

                const txs = app.logic.getFilteredTxs().filter(t => t.type === 'Chi tiêu');

                const normalizedSource = app.logic.normalizeSource(source);
                const targetKey = `${normalizedSource}::${dateKey}`;

                if (txs.length === 0) {
                    list.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-muted)">Không có giao dịch nào trong tháng này.</div>';
                } else {
                    list.innerHTML = txs.map(t => {
                        const isSelected = t.forceStatementKey === targetKey;
                        const dateStr = new Date(t.date).toLocaleDateString('vi-VN');
                        const isPending = t.status === 'pending';
                        const statusBadge = isPending ? '<span class="badge badge-warning" style="font-size:0.6rem; padding: 2px 6px;">Chưa trả</span>' : '<span class="badge badge-success" style="font-size:0.6rem; padding: 2px 6px;">Đã trả</span>';

                        return `
                                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                        <div style="display:flex; align-items:center; gap:0.5rem;">
                                            <input type="checkbox" class="missed-tx-check" value="${t.id}" ${isSelected ? 'checked' : ''}>
                                            <div>
                                                <div style="font-weight:600; font-size:0.9rem">${t.place} ${statusBadge}</div>
                                                <div style="font-size:0.75rem; color:var(--text-muted)">${dateStr} - ${t.source}</div>
                                            </div>
                                        </div>
                                        <div style="font-family:var(--font-mono); font-weight:bold">${app.logic.formatCurrency(t.amount)}</div>
                                    </div>
                                `;
                    }).join('');
                }

                btnSave.onclick = () => {
                    const checks = document.querySelectorAll('.missed-tx-check');
                    let count = 0;
                    checks.forEach(chk => {
                        const tId = Number(chk.value);
                        const t = app.data.transactions.find(x => x.id === tId);
                        if (t) {
                            if (chk.checked) {
                                t.forceStatementKey = targetKey;
                                t.status = 'pending';
                                count++;
                            } else if (t.forceStatementKey === targetKey) {
                                delete t.forceStatementKey;
                            }
                        }
                    });
                    app.storage.save();
                    app.ui.renderAll();
                    app.ui.renderDebts(app.data.transactions.filter(t => t.status === 'pending' && t.type !== 'Thu nhập'));
                    modal.classList.remove('active');
                    alert(`Đã cập nhật ${count} giao dịch vào kỳ sao kê này.`);
                };

                modal.classList.add('active');
            }
        },
        history: {
            open() {
                const modal = document.getElementById('modal-history');
                const listEl = document.getElementById('history-list');

                // LẤY THÁNG ĐANG CHỌN Ở MÀN HÌNH CHÍNH
                const currentMonthFilter = app.data.filter.month;

                // Lọc dữ liệu: Chỉ lấy đơn Hủy hoặc đơn Khôi phục trong tháng hiện tại
                const listTxs = app.data.transactions
                    .filter(t => {
                        const isInMonth = t.date.startsWith(currentMonthFilter);
                        const isTargetType = t.status === 'cancelled' || (t.place && t.place.startsWith('Khôi phục'));
                        return isInMonth && isTargetType;
                    })
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                if (listTxs.length === 0) {
                    const [y, m] = currentMonthFilter.split('-');
                    listEl.innerHTML = `
                        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 3rem 1rem; color: var(--text-muted);">
                            <div style="background: #f1f5f9; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                                <i class="fa-solid fa-clock-rotate-left" style="font-size: 1.5rem; color: #cbd5e1;"></i>
                            </div>
                            <div style="font-weight: 600;">Không có lịch sử thay đổi</div>
                            <div style="font-size: 0.85rem; margin-top: 4px;">Tháng ${m}/${y} không có giao dịch hủy/hoàn nào.</div>
                        </div>`;
                } else {
                    listEl.innerHTML = listTxs.map(t => {
                        const isCancelled = t.status === 'cancelled';

                        // --- [MỚI] LOGIC KIỂM TRA QUÁ HẠN 3 NGÀY ---
                        let isExpired = false;
                        if (isCancelled) {
                            // Lấy ngày hủy (nếu ko có thì lấy ngày tạo làm mốc tạm)
                            const cancelTime = new Date(t.cancelledDate || t.date).getTime();
                            const now = Date.now();
                            const diffHours = (now - cancelTime) / (1000 * 60 * 60); // Tính số giờ
                            if (diffHours > 72) isExpired = true; // > 72h tức là quá 3 ngày
                        }
                        // --------------------------------------------

                        // Cấu hình giao diện theo trạng thái
                        const themeColor = isCancelled ? '#ef4444' : '#10b981';
                        const bgBadge = isCancelled ? '#fef2f2' : '#ecfdf5';
                        const textBadge = isCancelled ? '#991b1b' : '#065f46';
                        const iconMain = isCancelled ? 'fa-trash-can' : 'fa-rotate-left';
                        const statusLabel = isCancelled ? 'Đã hủy giao dịch' : 'Giao dịch khôi phục';

                        const textStyle = isCancelled ? 'text-decoration: line-through; color: #94a3b8;' : 'color: #334155; font-weight: 700;';
                        const amountStyle = isCancelled ? 'text-decoration: line-through; color: #94a3b8;' : 'color: #10b981;';

                        // --- [SỬA] NÚT THAO TÁC (CÓ ĐIỀU KIỆN 3 NGÀY) ---
                        let actionBtn = '';

                        if (isCancelled) {
                            if (isExpired) {
                                // Nếu quá 3 ngày -> Hiện text khóa, không cho bấm
                                actionBtn = `<span style="font-size: 0.7rem; color: #94a3b8; background: #f1f5f9; padding: 3px 8px; border-radius: 4px; cursor: not-allowed; border: 1px solid #e2e8f0;">
                                    <i class="fa-solid fa-lock"></i> Quá hạn khôi phục
                                </span>`;
                            } else {
                                // Nếu chưa quá 3 ngày -> Hiện nút Khôi phục bình thường
                                actionBtn = `<button class="btn btn-sm" onclick="app.logic.restoreTransaction(${t.id})" 
                                    style="background: white; border: 1px solid #cbd5e1; color: #475569; font-size: 0.75rem; padding: 4px 10px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: all 0.2s;">
                                    <i class="fa-solid fa-arrow-rotate-left"></i> Khôi phục
                               </button>`;
                            }
                        } else {
                            // Trạng thái Active
                            actionBtn = `<span style="font-size: 0.7rem; color: #64748b; font-style: italic; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">
                                    <i class="fa-solid fa-check"></i> Hoạt động
                               </span>`;
                        }
                        // ------------------------------------------------

                        // --- LOGIC HIỂN THỊ NGÀY HỦY ---
                        let cancelTimeHTML = '';
                        if (isCancelled) {
                            const cDateStr = t.cancelledDate || new Date().toISOString();

                            // Nếu chưa khóa ngày VÀ chưa quá hạn 3 ngày thì mới cho sửa ngày
                            if (!t.isCancelDateFixed && !isExpired) {
                                const dateVal = new Date(cDateStr);
                                dateVal.setMinutes(dateVal.getMinutes() - dateVal.getTimezoneOffset());
                                const valStr = dateVal.toISOString().slice(0, 16);

                                cancelTimeHTML = `
                                    <div style="margin-top: 10px; background: #fff7ed; border: 1px dashed #fdba74; border-radius: 8px; padding: 8px 12px;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                            <div style="font-size: 0.75rem; color: #c2410c; font-weight: 600;">
                                                <i class="fa-regular fa-calendar-days"></i> Chỉnh ngày hủy
                                            </div>
                                            <div style="font-size: 0.65rem; color: #9a3412; opacity: 0.8;">(Sửa 1 lần duy nhất)</div>
                                        </div>
                                        <input type="datetime-local" class="form-input" 
                                            style="padding: 6px; font-size: 0.85rem; margin:0; width: 100%; border: 1px solid #fed7aa; background: white;"
                                            value="${valStr}"
                                            onchange="app.ui.saveCancelDate(${t.id}, this.value)">
                                    </div>`;
                            } else {
                                // ĐÃ KHÓA hoặc QUÁ HẠN: Chỉ hiện text tĩnh
                                const displayDate = new Date(cDateStr).toLocaleString('vi-VN');
                                cancelTimeHTML = `
                                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; font-size: 0.75rem; color: #64748b; display:flex; align-items:center; gap: 6px;">
                                        <i class="fa-solid fa-clock"></i> Thời gian hủy: <b>${displayDate}</b>
                                    </div>`;
                            }
                        }

                        return `
                        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); overflow: hidden;">
                            <div style="background: ${bgBadge}; color: ${textBadge}; padding: 6px 12px; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid ${isCancelled ? '#fee2e2' : '#d1fae5'}">
                                <i class="fa-solid ${iconMain}"></i> ${statusLabel}
                            </div>

                            <div style="padding: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                    <div style="flex: 1;">
                                        <div style="font-size: 0.95rem; ${textStyle} margin-bottom: 4px;">
                                            ${t.place}
                                        </div>
                                        <div style="font-size: 0.75rem; color: #64748b; display: flex; flex-direction: column; gap: 2px;">
                                            <span><i class="fa-solid fa-calendar-day" style="width: 14px;"></i> ${new Date(t.date).toLocaleDateString('vi-VN')}</span>
                                            <span><i class="fa-solid fa-wallet" style="width: 14px;"></i> ${t.source}</span>
                                        </div>
                                    </div>

                                    <div style="text-align: right;">
                                        <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1rem; margin-bottom: 8px; ${amountStyle}">
                                            ${app.logic.formatCurrency(t.amount)}
                                        </div>
                                        ${actionBtn}
                                    </div>
                                </div>
                                ${cancelTimeHTML}
                            </div>
                        </div>`;
                    }).join('');
                }

                modal.classList.add('active');
            }
        },

        budget: {
            open() {
                const modal = document.getElementById('modal-budget-history');
                const listEl = document.getElementById('budget-history-list');
                const month = app.data.filter.month;

                const allExpenseCandidates = app.data.transactions.filter(t =>
                    t.date.startsWith(month) &&
                    t.type === 'Chi tiêu' &&
                    t.status === 'paid' &&
                    !t.tags?.includes('#du_no_chuyen_tiep')
                );

                allExpenseCandidates.sort((a, b) => new Date(b.date) - new Date(a.date));

                if (allExpenseCandidates.length === 0) {
                    listEl.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted)">Chưa có chi tiêu thực tế nào trong tháng.</div>';
                } else {
                    listEl.innerHTML = allExpenseCandidates.map(t => {
                        const isExcluded = t.excludeFromBudget === true;

                        // --- CẤU HÌNH GIAO DIỆN ---
                        const opacity = isExcluded ? '0.6' : '1';
                        const statusIcon = isExcluded
                            ? '<i class="fa-regular fa-circle-xmark" style="color:var(--text-muted)"></i>'
                            : '<i class="fa-solid fa-circle-check" style="color:var(--success)"></i>';

                        const btnText = isExcluded ? 'Thêm lại' : 'Loại trừ';
                        const btnIcon = isExcluded ? 'fa-arrow-rotate-left' : 'fa-ban';
                        const actionClass = isExcluded ? 'include' : 'exclude';

                        return `
                <div class="budget-history-item" style="opacity: ${opacity};">
                    <div style="display:flex; gap:0.75rem; align-items:center;">
                        <div style="font-size:1.2rem;">${statusIcon}</div>
                        <div>
                            <div style="font-weight:700; color:var(--text-main); font-size: 0.95rem;">${t.place}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                                ${new Date(t.date).getDate()}/${new Date(t.date).getMonth() + 1} • ${t.source}
                            </div>
                        </div>
                    </div>
                    <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                        <div style="font-family:var(--font-mono); font-weight:700; font-size: 1rem;">${app.logic.formatCurrency(t.amount)}</div>
                        
                        <button class="btn btn-budget-action ${actionClass}" 
                            onclick="app.ui.toggleBudgetExclusion(${t.id})">
                            <i class="fa-solid ${btnIcon}"></i> ${btnText}
                        </button>
                    </div>
                </div>`;
                    }).join('');
                }

                modal.classList.add('active');
            }
        },

        receipt: {
            storeNames: ["TẠP HÓA THANH XUÂN", "SIÊU THỊ ĐAU VÍ", "SHOP NGHEO BEN VUNG", "TIỆM CẦM ĐỒ NIỀM VUI", "CIRCLE K (FAKE)"],
            cashiers: ["Người Lạ Ơi", "Sầu Riêng", "AI Chạy Bằng Cơm", "Chủ Nợ Giấu Mặt", "Vợ/Mẹ (Admin)"],

            quotes: [
                "Tiền không tự sinh ra, nó chỉ chuyển sang ví người khác.",
                "Cảm ơn bạn đã góp phần tăng trưởng GDP.",
                "Đừng buồn vì hết tiền, hãy buồn vì nợ vẫn còn.",
                "Hẹn gặp lại khi bạn có lương!",
                "Pass Wifi: khongcomatkhau (Mạng lag lắm)"
            ],

            setupDownloadBtn() {
                const btnDownload = document.getElementById('btn-download-image');
                const newBtn = btnDownload.cloneNode(true);
                btnDownload.parentNode.replaceChild(newBtn, btnDownload);

                newBtn.onclick = () => {
                    const element = document.getElementById('receipt-capture-area');
                    const originalText = newBtn.innerHTML;

                    newBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang in bill...';
                    newBtn.style.pointerEvents = 'none';

                    html2canvas(element, { scale: 2.5, backgroundColor: null }).then(canvas => {
                        const link = document.createElement('a');
                        link.download = `Bill_FinDash_${Date.now()}.png`;
                        link.href = canvas.toDataURL("image/png");
                        link.click();
                        newBtn.innerHTML = originalText;
                        newBtn.style.pointerEvents = 'auto';
                    });
                };
            },

            renderReceipt(items, totalAmount, title, iconClass, stampClass = null, extraInfo = "") {
                const modal = document.getElementById('modal-receipt');
                const paper = document.getElementById('receipt-capture-area');

                const randomStore = this.storeNames[Math.floor(Math.random() * this.storeNames.length)];
                const randomCashier = this.cashiers[Math.floor(Math.random() * this.cashiers.length)];
                const randomQuote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
                const now = new Date();

                paper.innerHTML = `
    <div style="font-family: 'Courier New', Courier, monospace; color: #000; padding: 20px; background: #fff; width: 320px; margin: 0 auto; position: relative;">
        
        ${stampClass ? `<div class="stamp-overlay ${stampClass}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 3rem; font-weight: 900; color: rgba(220, 38, 38, 0.2); border: 5px solid rgba(220, 38, 38, 0.2); padding: 10px 20px; text-transform: uppercase; pointer-events: none; z-index: 10;">${title}</div>` : ''}

        <div style="text-align: center; margin-bottom: 10px;">
            <div style="font-size: 2rem; margin-bottom: 5px;"><i class="${iconClass}"></i></div>
            <div style="font-weight: 900; font-size: 1.1rem; text-transform: uppercase;">${randomStore}</div>
            <div style="font-size: 0.7rem; font-style: italic;">ĐC: Vũ Trụ Mô Phỏng FinanceOS</div>
            <div style="font-size: 0.7rem;">Hotline: 1900-HET-TIEN</div>
        </div>

        <div style="border-bottom: 1px dashed #000; margin-bottom: 10px;"></div>

        <div style="font-size: 0.75rem; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between;"><span>Ngày:</span> <span>${now.toLocaleDateString('vi-VN')}</span></div>
            <div style="display: flex; justify-content: space-between;"><span>Giờ:</span> <span>${now.toLocaleTimeString('vi-VN')}</span></div>
            <div style="display: flex; justify-content: space-between;"><span>Thu ngân:</span> <span>${randomCashier}</span></div>
            <div style="display: flex; justify-content: space-between;"><span>Số Bill:</span> <span>#INV-${Date.now().toString().slice(-6)}</span></div>
        </div>

        <div style="border-bottom: 1px dashed #000; margin-bottom: 10px;"></div>

        <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse; margin-bottom: 10px;">
            <tr style="text-align: left;">
                <th style="padding-bottom: 5px;">Mặt hàng</th>
                <th style="text-align: right; padding-bottom: 5px;">Tiền</th>
            </tr>
            ${items.map(item => `
                <tr>
                    <td style="padding-top: 5px; vertical-align: top;">
                        <div style="font-weight: 600;">${item.name}</div>
                        ${item.note ? `<div style="font-size: 0.65rem; color: #444;">${item.note}</div>` : ''}
                    </td>
                    <td style="text-align: right; padding-top: 5px; vertical-align: top; font-weight: bold;">
                        ${app.logic.formatCurrency(item.amount)}
                    </td>
                </tr>
            `).join('')}
        </table>

        <div style="border-bottom: 1px dashed #000; margin-bottom: 10px;"></div>

        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 1rem; margin-bottom: 5px;">
            <span>TỔNG CỘNG</span>
            <span>${app.logic.formatCurrency(totalAmount)}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
            <span>Tiền khách đưa:</span>
            <span>Chuyển khoản</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
            <span>Tiền thối lại:</span>
            <span>0 ₫</span>
        </div>

        <div style="border-bottom: 1px dashed #000; margin: 15px 0;"></div>

        <div style="text-align: center; font-size: 0.75rem;">
            <div style="font-style: italic; margin-bottom: 8px;">"${randomQuote}"</div>
            <div>${extraInfo}</div>
            <div style="margin-top: 10px; font-weight: bold;">CẢM ƠN QUÝ KHÁCH!</div>
            <div style="margin-top: 5px;">HẸN GẶP LẠI (KHI CÓ LƯƠNG)</div>
            
            <div style="margin-top: 15px; letter-spacing: 2px; font-size: 0.6rem;">
                ║▌║█║▌│║▌║▌█
            </div>
        </div>
    </div>
    `;

                this.setupDownloadBtn();
                modal.classList.add('active');
            },

            open() {
                const txs = app.logic.getFilteredTxs().filter(t => t.type === 'Chi tiêu' && t.status !== 'cancelled');
                const topItems = txs.sort((a, b) => b.amount - a.amount).slice(0, 5).map(t => ({
                    name: t.place,
                    amount: t.amount,
                    note: t.source
                }));
                const total = txs.reduce((sum, t) => sum + t.amount, 0);

                this.renderReceipt(
                    topItems.length ? topItems : [{ name: "Chưa tiêu gì", amount: 0, note: "Giỏi lắm!" }],
                    total,
                    "PAID",
                    "fa-solid fa-face-dizzy",
                    null,
                    "*** CẢM ƠN QUÝ KHÁCH ***"
                );
            },

            openSingle(id) {
                if (event) event.stopPropagation();
                const tx = app.data.transactions.find(t => t.id === id);
                if (!tx) return;

                let titleStamp = "";
                let stampClass = "";
                let icon = "fa-solid fa-receipt";

                if (tx.status === 'cancelled') {
                    titleStamp = "ĐÃ HỦY";
                    stampClass = "stamp-void";
                    icon = "fa-solid fa-ban";
                } else if (tx.place.toLowerCase().includes('khôi phục')) {
                    titleStamp = "KHÔI PHỤC";
                    stampClass = "stamp-restored";
                    icon = "fa-solid fa-rotate-left";
                } else if (tx.type === 'Thu nhập') {
                    titleStamp = "THU NHẬP";
                    stampClass = "stamp-paid";
                    icon = "fa-solid fa-sack-dollar";
                } else {
                    titleStamp = "ĐÃ TRẢ";
                    stampClass = "stamp-paid";
                }

                const item = [{
                    name: tx.place,
                    amount: tx.amount,
                    note: `${tx.source} • ${tx.tags || ''}`
                }];

                this.renderReceipt(
                    item,
                    tx.amount,
                    titleStamp,
                    icon,
                    stampClass,
                    tx.status === 'cancelled' ? `Ngày hủy: ${new Date(tx.cancelledDate || Date.now()).toLocaleDateString('vi-VN')}` : ""
                );
            }
        },

        banks: {
            currentEditId: null, // Biến theo dõi đang sửa ngân hàng nào

            // Mở danh sách các thẻ ngân hàng
            open() {
                const modal = document.getElementById('modal-banks');
                this.render(); // Vẽ danh sách thẻ
                modal.classList.add('active');
            },

            // Mở form thêm mới (Reset form)
            openAdd() {
                this.currentEditId = null; // Đánh dấu là đang thêm mới

                const modal = document.getElementById('modal-add-bank');
                const titleEl = modal.querySelector('.modal-title, h3');
                if (titleEl) titleEl.textContent = "Thêm Ngân Hàng Mới";

                // Reset form
                document.getElementById('bank-name').value = '';
                document.getElementById('bank-acc-num').value = '';
                document.getElementById('bank-owner').value = '';
                document.getElementById('bank-init-balance').value = '';

                // Đảm bảo modal thêm mới nổi lên trên cùng
                modal.style.zIndex = '999999';
                modal.classList.add('active');
            },

            // [SỬA LỖI] Mở form chỉnh sửa (Không đóng modal chi tiết)
            openEdit(id) {
                const account = app.data.accounts.find(a => a.id === id);
                if (!account) return;

                this.currentEditId = id; // Đánh dấu là đang sửa ID này

                const modal = document.getElementById('modal-add-bank');
                const titleEl = modal.querySelector('.modal-title, h3');
                if (titleEl) titleEl.textContent = "Cập nhật Ngân Hàng";

                // Điền dữ liệu cũ vào input
                document.getElementById('bank-name').value = account.bankName;
                document.getElementById('bank-acc-num').value = account.accountNumber;
                document.getElementById('bank-owner').value = account.ownerName;
                document.getElementById('bank-init-balance').value = account.initialBalance;

                // [QUAN TRỌNG] Không đóng modal-bank-detail nữa
                // Chỉ cần đẩy modal sửa lên cao hơn (z-index) để đè lên modal chi tiết
                modal.style.zIndex = '100010';
                modal.classList.add('active');
            },

            // Hàm Lưu (Xử lý cả Thêm mới & Cập nhật)
            saveNew() {
                const name = document.getElementById('bank-name').value.trim();
                const accNum = document.getElementById('bank-acc-num').value.trim();
                const owner = document.getElementById('bank-owner').value.trim();
                // Lấy số dư ban đầu (để tính lại số dư hiện tại)
                const initBal = Number(document.getElementById('bank-init-balance').value.replace(/[^0-9]/g, ''));

                if (!name) return app.ui.popup.show("Vui lòng nhập tên ngân hàng!", "error");

                if (this.currentEditId) {
                    // --- TRƯỜNG HỢP CẬP NHẬT ---
                    const account = app.data.accounts.find(a => a.id === this.currentEditId);
                    if (account) {
                        account.bankName = name;
                        account.accountNumber = accNum;
                        account.ownerName = owner;
                        account.initialBalance = initBal;

                        app.storage.save();
                        app.ui.popup.show("✅ Đã cập nhật thông tin thành công!", "success");

                        // [QUAN TRỌNG] Vẽ lại modal chi tiết (đang nằm bên dưới) với dữ liệu mới
                        this.openDetail(this.currentEditId);

                        // Vẽ lại danh sách bên ngoài nếu đang mở
                        if (document.getElementById('modal-banks').classList.contains('active')) {
                            this.render();
                        }
                    }
                } else {
                    // --- TRƯỜNG HỢP THÊM MỚI ---
                    const newAcc = {
                        id: Date.now(),
                        bankName: name,
                        accountNumber: accNum,
                        ownerName: owner,
                        initialBalance: initBal,
                        createdAt: new Date().toISOString()
                    };

                    if (!app.data.accounts) app.data.accounts = [];
                    app.data.accounts.push(newAcc);
                    app.storage.save();
                    app.ui.popup.show("✅ Đã thêm ngân hàng thành công!", "success");
                    this.render();
                }

                // Chỉ đóng modal Sửa, modal Chi tiết vẫn còn bên dưới
                document.getElementById('modal-add-bank').classList.remove('active');
                this.currentEditId = null;
            },

            delete(id) {
                if (confirm("Bạn có chắc muốn xóa liên kết ngân hàng này không?")) {
                    app.data.accounts = app.data.accounts.filter(a => a.id !== id);
                    app.storage.save();
                    this.render();
                    // Nếu xóa thì buộc phải đóng modal chi tiết
                    document.getElementById('modal-bank-detail').classList.remove('active');
                }
            },

            openDetail(bankId) {
                const account = app.data.accounts.find(a => a.id === bankId);
                if (!account) return;

                // --- [MỚI] KIỂM TRA TRẠNG THÁI KHÓA ---
                const isLocked = account.isLocked || false;

                const CUTOFF_DATE = new Date('2026-01-28T00:00:00').getTime();
                const bankName = account.bankName.toLowerCase().trim();
                const isLiobank = bankName.includes('liobank');

                // Tính toán số dư dựa trên (Dư ban đầu + Giao dịch)
                let realBalance = Number(app.logic.calculateBankBalance(account)) || 0;

                // Xử lý riêng cho Liobank (trừ lãi)
                if (isLiobank) {
                    const ignoredTxs = app.data.transactions.filter(t => {
                        const s = (t.source || "").toLowerCase().trim();
                        const d = (t.destination || "").toLowerCase().trim();
                        return (s === bankName || d === bankName) && t.isInterest === true && t.status === 'paid'; // Đảm bảo chỉ trừ lãi khi đã paid
                    });

                    ignoredTxs.forEach(t => {
                        const amt = Number(t.amount) || 0;
                        if (t.type === 'Thu nhập') {
                            realBalance -= amt;
                        } else {
                            realBalance += amt;
                        }
                    });
                }

                // Lọc lịch sử
                const history = app.data.transactions.filter(t => {
                    const tTime = new Date(t.date).getTime();
                    if (tTime < CUTOFF_DATE) return false;
                    const s = (t.source || "").toLowerCase().trim();
                    const d = (t.destination || "").toLowerCase().trim();
                    return s === bankName || d === bankName;
                }).sort((a, b) => new Date(b.date) - new Date(a.date));

                // Nhóm theo ngày
                const groups = {};
                history.forEach(t => {
                    const dateObj = new Date(t.date);
                    const dateKey = dateObj.toLocaleDateString('vi-VN');
                    const today = new Date().toLocaleDateString('vi-VN');
                    let label = dateKey === today ? "Hôm nay" : dateKey;
                    if (!groups[label]) groups[label] = [];
                    groups[label].push(t);
                });

                let listHtml = '';
                // --- [MỚI] ẨN LỊCH SỬ NẾU THẺ BỊ KHÓA ---
                if (isLocked) {
                    listHtml = `<div style="text-align:center; padding:3rem; color:#ef4444;"><i class="fa-solid fa-lock" style="font-size: 2rem; margin-bottom: 10px;"></i><br>Thẻ đã bị khóa.<br>Lịch sử giao dịch tạm thời bị ẩn.</div>`;
                } else if (Object.keys(groups).length === 0) {
                    listHtml = `<div style="text-align:center; padding:3rem; color:#94a3b8;">Chưa có giao dịch phát sinh gần đây.</div>`;
                } else {
                    for (const [dateLabel, txs] of Object.entries(groups)) {
                        listHtml += `<div class="h-date-group"><div class="h-date-label">${dateLabel}</div>`;
                        listHtml += txs.map(t => {
                            const isCancelled = t.status === 'cancelled';
                            const s = (t.source || "").toLowerCase().trim();
                            const isMoneyOut = (s === bankName);
                            const isTransfer = t.type === 'Chuyển tiền';

                            // Cấu hình màu sắc
                            let colorClass = isTransfer ? 'txt-blue' : (isMoneyOut ? 'txt-red' : 'txt-green');
                            if (isCancelled) colorClass = ''; // Nếu hủy thì bỏ màu gốc

                            // Cấu hình Icon
                            const iconBg = isMoneyOut ? 'out' : 'in';
                            let iconClass = isMoneyOut ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up';
                            if (isTransfer) iconClass = 'fa-right-left';

                            const sign = isMoneyOut ? '-' : '+';

                            let subText = "";
                            if (isTransfer) {
                                subText = isMoneyOut
                                    ? `Đến: ${t.destination || 'N/A'}`
                                    : `Từ: ${t.source}`;
                            } else {
                                subText = `${t.isUnknownTime ? '--:--' : new Date(t.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` +
                                    (t.brand ? ` • ${t.brand}` : '');
                            }

                            // --- LOGIC TRẠNG THÁI ---
                            let statusText = 'Thành công';
                            let statusColor = '#16a34a';

                            if (isCancelled) { statusText = 'Đã hủy'; statusColor = '#ef4444'; }
                            else if (t.status === 'planned') {
                                statusText = t.type === 'Thu nhập' ? 'Sẽ thu' : 'Sẽ chi';
                                statusColor = '#9333ea'; // Màu tím cho Dự kiến
                            }
                            else if (t.status === 'pending') { statusText = 'Chờ xử lý'; statusColor = '#f59e0b'; }
                            else if (isTransfer) { statusText = 'Chuyển khoản'; statusColor = '#0284c7'; }

                            let onClickAttr = '';
                            let itemStyle = isCancelled ? 'opacity: 0.6;' : ''; // Làm mờ toàn bộ item nếu đã hủy
                            let interestBadge = '';

                            if (isLiobank && !isCancelled) {
                                onClickAttr = `onclick="app.ui.modals.banks.toggleInterest(${t.id}, ${bankId})" style="cursor:pointer"`;
                                if (t.isInterest) {
                                    itemStyle += 'background: #f8fafc; border: 1px dashed #cbd5e1;';
                                    interestBadge = `<div style="font-size:0.6rem; background:#e2e8f0; color:#64748b; padding:1px 6px; border-radius:4px; display:inline-block; margin-top:2px;">
                                        <i class="fa-solid fa-ban"></i> Không tính số dư
                                    </div>`;
                                }
                            }

                            // Style cho số tiền
                            let amountStyle = isTransfer ? 'color: #0284c7;' : '';
                            if (isCancelled) {
                                amountStyle = 'text-decoration: line-through; color: #94a3b8;';
                            } else if (t.status === 'planned') {
                                amountStyle = 'color: #9333ea; border-bottom: 1px dashed #9333ea; opacity: 0.8;'; // Gạch ngang đứt đoạn mờ cho số tiền
                            }

                            return `
    <div class="h-item" ${onClickAttr} style="${itemStyle}">
        <div class="h-icon ${iconBg}" style="${isCancelled ? 'background: #f1f5f9; color: #94a3b8;' : ''}">
            <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="h-info">
            <div class="h-title" style="${isCancelled ? 'text-decoration: line-through; color: #94a3b8;' : ''}">${t.place}</div>
            <div class="h-sub">
            ${subText}
            ${!isTransfer && t.brand ? '' : `<br><span style="font-size:0.7rem; opacity:0.7">${t.isUnknownTime ? '--:--' : new Date(t.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>`}
            ${t.refId ? `<br><span style="font-size:0.75rem; color:#0284c7; font-weight:700; margin-top:2px; display:inline-block;"><i class="fa-solid fa-hashtag"></i> Mã GD: ${t.refId}</span>` : ''}
${t.orderCode ? `<br><span style="font-size:0.75rem; color:#ea580c; font-weight:700; margin-top:2px; display:inline-block;"><i class="fa-solid fa-box"></i> Mã ĐH: ${t.orderCode}</span>` : ''}
        </div>
            ${interestBadge} 
        </div>
        <div class="h-amount-box">
            <div class="h-amount ${!isTransfer && !isCancelled ? colorClass : ''}" style="${amountStyle}">
                ${sign}${app.logic.formatCurrency(t.amount)}
            </div>
            <div class="h-status" style="color:${statusColor}; font-weight: ${isCancelled ? 'bold' : 'normal'};">${statusText}</div>
        </div>
    </div>`;
                        }).join('');
                        listHtml += `</div>`;
                    }
                }

                const modal = document.getElementById('modal-bank-detail');
                const box = modal.querySelector('.modal-box');

                // --- [MỚI] NÚT KHÓA/MỞ KHÓA VÀ VÔ HIỆU HÓA NÚT CHUYỂN TIỀN NHANH NẾU KHÓA ---
                const lockIcon = isLocked ? 'fa-lock-open' : 'fa-lock';
                const lockColor = isLocked ? '#f59e0b' : '#ef4444';
                const lockTitle = isLocked ? 'Mở khóa thẻ' : 'Khóa thẻ';

                box.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <div style="font-weight:800; font-size:1.1rem; color:#0f172a; display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-list-ul"></i> CHI TIẾT GIAO DỊCH
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button onclick="app.ui.modals.banks.toggleLock(${bankId})" 
                                title="${lockTitle}"
                                style="border:none; background:#fef2f2; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; color:${lockColor}; transition:0.2s;">
                                <i class="fa-solid ${lockIcon}"></i>
                            </button>
                            <button onclick="${isLocked ? `app.ui.popup.show('Thẻ đã khóa, không thể chuyển tiền nhanh.', 'error')` : `app.ui.showQuickTransfer('${account.bankName}', 'bank')`}" 
                                title="Chuyển tiền nhanh"
                                style="border:none; background:#ecfdf5; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:${isLocked ? 'not-allowed' : 'pointer'}; opacity: ${isLocked ? '0.5' : '1'}; color:#10b981; transition:0.2s;">
                                <i class="fa-solid fa-money-bill-transfer"></i>
                            </button>
                            <button onclick="app.ui.modals.banks.openEdit(${bankId})" 
                                title="Chỉnh sửa ngân hàng"
                                style="border:none; background:#eff6ff; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#3b82f6; transition:0.2s;">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="document.getElementById('modal-bank-detail').classList.remove('active')" 
                                title="Đóng"
                                style="border:none; background:#f1f5f9; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#64748b; transition:0.2s;">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>

                    <div class="history-header-card" style="${isLocked ? 'filter: grayscale(100%); opacity: 0.8;' : ''}">
                        <div class="h-balance-label">Số dư khả dụng ${isLiobank ? '(Đã trừ lãi)' : ''}</div>
                        <div class="h-balance-val">${app.logic.formatCurrency(realBalance)}</div>
                        <div class="h-account-info">
                            <i class="fa-solid fa-building-columns"></i> ${account.bankName} • ${account.accountNumber}
                            ${isLocked ? `<span style="color:#ef4444; font-weight:bold; margin-left: 10px;"><i class="fa-solid fa-lock"></i> ĐÃ KHÓA</span>` : ''}
                        </div>
                    </div>

                    <div style="flex:1; overflow-y:auto; padding-right:4px;">
                        ${isLiobank && !isLocked ? `<div style="background:#fff7ed; color:#c2410c; padding:8px; font-size:0.75rem; border-radius:8px; margin-bottom:10px; border:1px solid #fdba74;">
                            <i class="fa-solid fa-circle-info"></i> <b>Chế độ Liobank:</b> Bấm vào giao dịch để đánh dấu là Tiền lãi (ẩn khỏi số dư).
                        </div>` : ''}
                        ${listHtml}
                    </div>
                `;

                modal.style.zIndex = '99990';
                modal.classList.add('active');
            },

            // --- [MỚI] HÀM KHÓA/MỞ KHÓA THẺ ---
            toggleLock(bankId) {
                const account = app.data.accounts.find(a => a.id === bankId);
                if (!account) return;

                const isCurrentlyLocked = account.isLocked || false;
                const actionText = isCurrentlyLocked ? "MỞ KHÓA" : "KHÓA";

                app.ui.popup.confirm(
                    `Bạn muốn ${actionText} thẻ <b>${account.bankName}</b>?<br>${isCurrentlyLocked ? 'Thẻ sẽ hoạt động lại bình thường.' : 'Thẻ bị khóa sẽ không thể thêm giao dịch mới và ẩn lịch sử.'}`,
                    () => {
                        account.isLocked = !isCurrentlyLocked;
                        app.storage.save();

                        // Cập nhật lại UI
                        this.render();
                        this.openDetail(bankId);

                        app.ui.popup.show(`Đã ${account.isLocked ? 'khóa' : 'mở khóa'} thẻ thành công!`, "success");
                    }
                );
            },

            toggleInterest(txId, bankId) {
                const tx = app.data.transactions.find(t => t.id === txId);
                if (!tx) return;

                const isInterest = tx.isInterest || false;
                const actionText = isInterest ? "BỎ đánh dấu" : "ĐÁNH DẤU";

                app.ui.popup.confirm(
                    `Bạn muốn ${actionText} giao dịch này là <b>Tiền lãi</b>?<br>...`,
                    () => {
                        tx.isInterest = !isInterest;
                        app.storage.save();

                        app.ui.modals.banks.render();
                        app.ui.modals.banks.openDetail(bankId);

                        app.ui.popup.show("✅ Đã cập nhật trạng thái tiền lãi!", "success");
                    }
                );
            },

            render() {
                const listEl = document.getElementById('bank-list');
                if (!app.data.accounts || app.data.accounts.length === 0) {
                    listEl.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-style:italic; padding:2rem;">Chưa có tài khoản ngân hàng nào.</div>';
                    return;
                }

                let html = '<div class="bank-grid">';

                html += app.data.accounts.map((acc, index) => {
                    let realBalance = Number(app.logic.calculateBankBalance(acc)) || 0;
                    const isLiobank = acc.bankName.toLowerCase().includes('liobank');
                    const isLocked = acc.isLocked || false; // --- [MỚI] ---

                    if (isLiobank) {
                        const bankName = acc.bankName.toLowerCase().trim();
                        const ignoredTxs = app.data.transactions.filter(t => {
                            const s = (t.source || "").toLowerCase().trim();
                            const d = (t.destination || "").toLowerCase().trim();
                            return (s === bankName || d === bankName) && t.isInterest === true;
                        });

                        ignoredTxs.forEach(t => {
                            const amt = Number(t.amount) || 0;
                            if (t.type === 'Thu nhập') {
                                realBalance -= amt;
                            } else {
                                realBalance += amt;
                            }
                        });
                    }

                    const themeIndex = (index % 5) + 1;
                    const formattedNum = acc.accountNumber.replace(/(\d{4})(?=\d)/g, '$1 ');

                    // --- [MỚI] STYLE CHO THẺ BỊ KHÓA ---
                    const lockStyle = isLocked ? 'filter: grayscale(100%); opacity: 0.7;' : '';
                    const lockOverlay = isLocked ? `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); z-index:10; font-size:3rem; color:rgba(239,68,68,0.8);"><i class="fa-solid fa-lock"></i></div>` : '';

                    return `
                    <div class="bank-card card-theme-${themeIndex}" 
                         onclick="app.ui.modals.banks.openDetail(${acc.id})" style="${lockStyle} position:relative;">
                        ${lockOverlay}
                        <div class="card-bg-deco"></div>
                        <div class="card-content">
                            <div class="card-top">
                                <div class="bank-logo"><i class="fa-solid fa-building-columns"></i> ${acc.bankName}</div>
                                <button class="card-delete-btn" onclick="event.stopPropagation(); app.ui.modals.banks.delete(${acc.id})">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div class="card-chip-row">
                                <div class="emv-chip"></div>
                                <i class="fa-solid fa-wifi contactless-icon"></i>
                            </div>
                            <div class="card-number">${formattedNum}</div>
                            <div class="card-bottom">
                                <div>
                                    <div class="card-holder-label">Chủ thẻ</div>
                                    <div class="card-holder-name">${acc.ownerName || 'NONAME'}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div class="card-balance-label">Số dư khả dụng</div>
                                    <div class="card-balance-val">${app.logic.formatCurrency(realBalance)}</div>
                                </div>
                            </div>
                        </div>
                    </div>`;
                }).join('');

                html += '</div>';
                listEl.innerHTML = html;
            },
        },

        cash: {
            currentEditId: null,

            // 1. Mở danh sách
            open() {
                // Đảm bảo dữ liệu tồn tại
                if (!app.data.cashWallets) app.data.cashWallets = [];

                this.render();
                document.getElementById('modal-cash').classList.add('active');
            },

            // 2. Mở form thêm mới
            openAdd() {
                this.currentEditId = null;
                const modal = document.getElementById('modal-add-cash');
                modal.querySelector('.card-title').textContent = "Thêm Nguồn Tiền";

                document.getElementById('cash-name').value = '';
                document.getElementById('cash-keeper').value = '';
                document.getElementById('cash-init-balance').value = '';

                modal.classList.add('active');
            },

            // 3. Mở form sửa
            openEdit(id) {
                const wallet = app.data.cashWallets.find(w => w.id === id);
                if (!wallet) return;

                this.currentEditId = id;
                const modal = document.getElementById('modal-add-cash');
                modal.querySelector('.card-title').textContent = "Cập nhật Nguồn Tiền";

                document.getElementById('cash-name').value = wallet.name;
                document.getElementById('cash-keeper').value = wallet.keeper || '';
                document.getElementById('cash-init-balance').value = wallet.initialBalance;

                modal.style.zIndex = '999999';
                modal.classList.add('active');
            },

            // 4. Lưu dữ liệu (Thêm mới hoặc Cập nhật)
            saveNew() {
                const name = document.getElementById('cash-name').value.trim();
                const keeper = document.getElementById('cash-keeper').value.trim();
                const initBal = Number(document.getElementById('cash-init-balance').value.replace(/[^0-9]/g, ''));

                if (!name) return app.ui.popup.show("Vui lòng nhập tên nguồn tiền!", "error");

                if (!app.data.cashWallets) app.data.cashWallets = [];

                if (this.currentEditId) {
                    // Sửa
                    const wallet = app.data.cashWallets.find(w => w.id === this.currentEditId);
                    if (wallet) {
                        wallet.name = name;
                        wallet.keeper = keeper;
                        wallet.initialBalance = initBal;
                        app.ui.popup.show("✅ Đã cập nhật thành công!", "success");

                        // Refresh lại detail nếu đang mở
                        if (document.getElementById('modal-cash-detail').classList.contains('active')) {
                            this.openDetail(this.currentEditId);
                        }
                    }
                } else {
                    // Thêm mới
                    const newWallet = {
                        id: Date.now(),
                        name: name,
                        keeper: keeper,
                        initialBalance: initBal,
                        createdAt: new Date().toISOString()
                    };
                    app.data.cashWallets.push(newWallet);
                    app.ui.popup.show("✅ Đã thêm ví tiền mặt mới!", "success");
                }

                app.storage.save();
                this.render();
                document.getElementById('modal-add-cash').classList.remove('active');
            },

            // 5. Xóa
            delete(id) {
                app.ui.popup.confirm("Xóa nguồn tiền này? (Lịch sử giao dịch vẫn giữ nguyên)", () => {
                    app.data.cashWallets = app.data.cashWallets.filter(w => w.id !== id);
                    app.storage.save();
                    this.render();
                    document.getElementById('modal-cash-detail').classList.remove('active');
                });
            },

            // 6. Tính số dư thực tế
            calculateBalance(wallet) {
                const name = wallet.name.toLowerCase().trim();
                // Lấy thời điểm tạo ví (Nếu ví cũ không có ngày tạo thì mặc định lấy mốc xa xưa để tính hết)
                const walletCreatedTime = wallet.createdAt ? new Date(wallet.createdAt).getTime() : 0;

                let flow = 0;
                app.data.transactions.forEach(t => {
                    // 1. Chỉ tính giao dịch Đã thanh toán (bỏ qua Dự kiến/Chờ xử lý)
                    if (t.status !== 'paid') return;

                    // 2. [QUAN TRỌNG] Chỉ tính các giao dịch diễn ra SAU hoặc BẰNG lúc tạo ví
                    // (Bỏ qua các giao dịch quá khứ để không làm sai lệch số dư ban đầu vừa nhập)
                    const txTime = new Date(t.date).getTime();
                    if (txTime < walletCreatedTime) return;

                    const s = (t.source || "").toLowerCase().trim();
                    const d = (t.destination || "").toLowerCase().trim();

                    // 3. Cộng trừ tiền
                    if (d === name) flow += t.amount; // Tiền vào (Thu nhập hoặc nhận chuyển khoản)
                    if (s === name) flow -= t.amount; // Tiền ra (Chi tiêu hoặc chuyển đi)
                });

                return (wallet.initialBalance || 0) + flow;
            },

            // 7. Xem chi tiết lịch sử
            openDetail(id) {
                const wallet = app.data.cashWallets.find(w => w.id === id);
                if (!wallet) return;

                const currentBalance = this.calculateBalance(wallet);
                const wName = wallet.name.toLowerCase().trim();

                const walletCreatedTime = wallet.createdAt ? new Date(wallet.createdAt).getTime() : 0;

                const history = app.data.transactions.filter(t => {
                    if (new Date(t.date).getTime() < walletCreatedTime) return false;
                    const s = (t.source || "").toLowerCase().trim();
                    const d = (t.destination || "").toLowerCase().trim();
                    return (s === wName || d === wName);
                }).sort((a, b) => new Date(b.date) - new Date(a.date));

                const groups = {};
                history.forEach(t => {
                    const dateKey = new Date(t.date).toLocaleDateString('vi-VN');
                    if (!groups[dateKey]) groups[dateKey] = [];
                    groups[dateKey].push(t);
                });

                let listHtml = '';
                if (history.length === 0) {
                    listHtml = `
        <div style="text-align:center; padding: 4rem 1rem; opacity: 0.6;">
            <img src="https://cdn-icons-png.flaticon.com/512/7486/7486747.png" style="width: 80px; margin-bottom: 1rem; filter: grayscale(100%);">
            <p>Chưa có giao dịch nào phát sinh.</p>
        </div>`;
                } else {
                    for (const [dateLabel, txs] of Object.entries(groups)) {
                        listHtml += `
            <div style="margin-bottom: 1.5rem;">
                <div style="background: #000; color: #fff; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; margin-bottom: 0.5rem; margin-left: 0.5rem;">
                    ${dateLabel}
                </div>
            `;

                        listHtml += txs.map(t => {
                            const isCancelled = t.status === 'cancelled';
                            const s = (t.source || "").toLowerCase().trim();
                            const isMoneyOut = (s === wName);
                            const isTransfer = t.type === 'Chuyển tiền';

                            const sign = isMoneyOut ? '-' : '+';

                            let color = isMoneyOut ? '#ef4444' : '#10b981';
                            let icon = isMoneyOut ? 'fa-arrow-up-right-from-square' : 'fa-arrow-down-long';
                            let bgIcon = isMoneyOut ? '#fef2f2' : '#f0fdf4';

                            if (isTransfer) {
                                color = '#0284c7';
                                icon = 'fa-right-left';
                                bgIcon = '#e0f2fe';
                            }

                            // --- LOGIC TRẠNG THÁI ---
                            let statusText = isTransfer ? 'Chuyển khoản' : (t.status === 'paid' ? 'Thành công' : 'Chờ xử lý');
                            let statusColor = '#f59e0b'; // Mặc định chờ xử lý là màu cam

                            if (isCancelled) {
                                statusText = 'Đã hủy';
                                statusColor = '#ef4444';
                                color = '#94a3b8'; // Xám mờ cho tiền
                                bgIcon = '#f1f5f9'; // Nền xám cho icon
                            } else if (t.status === 'planned') {
                                statusText = t.type === 'Thu nhập' ? 'Sẽ thu' : 'Sẽ chi';
                                statusColor = '#9333ea'; // Chữ trạng thái màu tím
                                color = '#9333ea';       // Số tiền và Icon màu tím
                                bgIcon = '#faf5ff';      // Nền icon tím nhạt
                            } else if (t.status === 'paid') {
                                statusText = 'Thành công';
                                statusColor = '#10b981';
                            } else if (isTransfer) {
                                statusColor = '#0284c7';
                            }

                            const flowText = isTransfer
                                ? (isMoneyOut ? `Đến: ${t.destination}` : `Từ: ${t.source}`)
                                : (t.tags || 'Không tag');

                            const opacity = isCancelled ? '0.6' : '1';
                            const textDecor = isCancelled ? 'line-through' : 'none';

                            return `
    <div style="
        display: flex; align-items: center; justify-content: space-between;
        background: #fff; border: 2px solid #e2e8f0; border-radius: 12px;
        padding: 12px; margin-bottom: 8px; opacity: ${opacity};
    ">
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="
                width: 40px; height: 40px; 
                background: ${bgIcon}; 
                color: ${color};
                border-radius: 50%; display: flex; align-items: center; justify-content: center;
                border: 1px solid ${color};
            ">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div>
    <div style="font-weight: 700; color: #1e293b; font-size: 0.95rem; text-decoration: ${textDecor};">${t.place}</div>
    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
        ${t.isUnknownTime ? '--:--' : new Date(t.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • ${flowText}
    </div>
                <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 4px;">
    ${t.refId ? `<div style="font-size: 0.75rem; color: #059669; font-weight: 700;"><i class="fa-solid fa-hashtag"></i> Mã GD: ${t.refId}</div>` : ''}
    ${t.orderCode ? `<div style="font-size: 0.75rem; color: #ea580c; font-weight: 700;"><i class="fa-solid fa-box"></i> Mã ĐH: ${t.orderCode}</div>` : ''}
</div>
            </div>
        </div>
        <div style="text-align: right;">
            <div style="font-weight: 800; font-family: var(--font-mono); color: ${color}; font-size: 1rem; text-decoration: ${textDecor};">
                ${sign}${app.logic.formatCurrency(t.amount)}
            </div>
            <div style="font-size: 0.7rem; color: ${statusColor}; font-style: ${isCancelled ? 'normal' : 'italic'}; font-weight: ${isCancelled ? 'bold' : 'normal'}">
                ${statusText}
            </div>
        </div>
    </div>`;
                        }).join('');

                        listHtml += `</div>`;
                    }
                }

                const contentDiv = document.getElementById('cash-detail-content');
                contentDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding: 0 5px;">
            <div style="font-weight:900; font-size:1.2rem; display:flex; gap:8px; align-items:center;">
                QUẢN LÝ VÍ
            </div>
            <div style="display:flex; gap:8px;">
            <button onclick="app.ui.showQuickTransfer('${wallet.name}', 'cash')" class="btn-ghost" title="Chuyển tiền nhanh" style="background:#ecfdf5; border: 2px solid #000; color:#10b981; width:36px; height:36px; border-radius:8px; cursor:pointer;">
                    <i class="fa-solid fa-money-bill-transfer"></i>
                </button>
                <button onclick="app.ui.modals.cash.openEdit(${id})" class="btn-ghost" style="background:#fef3c7; border: 2px solid #000; color:#d97706; width:36px; height:36px; border-radius:8px; cursor:pointer;"><i class="fa-solid fa-pen"></i></button>
                <button onclick="document.getElementById('modal-cash-detail').classList.remove('active')" class="btn-ghost" style="background:#f1f5f9; border: 2px solid #000; color:#000; width:36px; height:36px; border-radius:8px; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>

        <div style="
            background: #10b981; 
            background-image: radial-gradient(#34d399 15%, transparent 16%), radial-gradient(#34d399 15%, transparent 16%);
            background-size: 20px 20px;
            background-position: 0 0, 10px 10px;
            border: 3px solid #000; 
            border-radius: 20px; 
            padding: 1.5rem; 
            box-shadow: 6px 6px 0px #000;
            margin-bottom: 2rem;
            color: white;
            position: relative;
            overflow: hidden;
        ">
            <div style="position: relative; z-index: 2;">
                <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px; font-weight: bold; text-transform: uppercase;">Tổng tiền mặt</div>
                <div style="font-size: 2.5rem; font-weight: 900; font-family: var(--font-mono); text-shadow: 2px 2px 0px #000;">
                    ${app.logic.formatCurrency(currentBalance)}
                </div>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 2px dashed rgba(0,0,0,0.2); display: flex; align-items: center; gap: 10px; font-weight: bold;">
                    <i class="fa-solid fa-wallet"></i> ${wallet.name}
                    <span style="width: 4px; height: 4px; background: white; border-radius: 50%;"></span>
                    <i class="fa-solid fa-user-check"></i> ${wallet.keeper || 'Tôi'}
                </div>
            </div>
        </div>

        <div style="flex:1; overflow-y:auto; padding-right:5px;">
            ${listHtml}
        </div>
    `;

                document.getElementById('modal-cash-detail').classList.add('active');
            },

            // 8. Vẽ danh sách ra ngoài
            render() {
                const listEl = document.getElementById('cash-list');
                if (!app.data.cashWallets || app.data.cashWallets.length === 0) {
                    listEl.innerHTML = `
            <div style="text-align:center; padding:3rem; border: 3px dashed #cbd5e1; border-radius: 20px; color: #94a3b8;">
                <i class="fa-solid fa-wallet" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <br>Chưa có ví tiền mặt nào.<br>Bấm nút bên dưới để tạo nhé!
            </div>`;
                    return;
                }

                listEl.innerHTML = app.data.cashWallets.map(w => {
                    const balance = this.calculateBalance(w);
                    // Style Cartoon: Viền đen, bóng cứng, màu nền tươi
                    return `
        <div class="bank-card" onclick="app.ui.modals.cash.openDetail(${w.id})" 
             style="
                background: #ffffff; 
                border: 3px solid #000; 
                border-radius: 16px; 
                box-shadow: 6px 6px 0px #000; 
                margin-bottom: 1rem; 
                padding: 1rem; 
                cursor: pointer; 
                position: relative; 
                transition: transform 0.1s;
                overflow: hidden;
             "
             onmousedown="this.style.transform='translate(2px, 2px)'; this.style.boxShadow='4px 4px 0px #000'"
             onmouseup="this.style.transform='translate(0, 0)'; this.style.boxShadow='6px 6px 0px #000'"
             onmouseleave="this.style.transform='translate(0, 0)'; this.style.boxShadow='6px 6px 0px #000'"
        >
            <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: #ecfdf5; border-radius: 50%; z-index: 0;"></div>
            
            <div style="position: relative; z-index: 1;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
                    <div style="display:flex; align-items:center; gap: 10px;">
                        <div style="width: 45px; height: 45px; background: #10b981; border: 2px solid #000; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem;">
                            <i class="fa-solid fa-sack-dollar"></i>
                        </div>
                        <div>
                            <div style="font-weight: 800; font-size: 1.1rem; color: #000;">${w.name}</div>
                            <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
                                <i class="fa-solid fa-user-shield"></i> ${w.keeper || 'Tự giữ'}
                            </div>
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); app.ui.modals.cash.delete(${w.id})" 
                        style="background: #fee2e2; border: 2px solid #000; color: #ef4444; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                
                <div style="margin-top: 1rem; text-align: right;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Số dư hiện tại</div>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #059669; font-family: var(--font-mono); letter-spacing: -1px;">
                        ${app.logic.formatCurrency(balance)}
                    </div>
                </div>
            </div>
        </div>`;
                }).join('');
            },
        },

        wallets: {
            currentWalletId: null,

            open() {
                const modal = document.getElementById('modal-wallets');
                this.render();
                modal.classList.add('active');
            },

            openAdd() {
                document.getElementById('wallet-name').value = '';
                document.getElementById('wallet-owner').value = '';
                document.getElementById('wallet-init-balance').value = '';
                document.getElementById('modal-add-wallet').classList.add('active');
            },

            saveNew() {
                const name = document.getElementById('wallet-name').value.trim();
                const owner = document.getElementById('wallet-owner').value.trim();
                const initBal = Number(document.getElementById('wallet-init-balance').value.replace(/[^0-9]/g, ''));
                // Lấy thêm hạn mức
                const creditLimit = Number(document.getElementById('wallet-credit-limit').value.replace(/[^0-9]/g, ''));

                if (!name) return app.ui.popup.show("Vui lòng nhập tên ví!", "error");

                const newWallet = {
                    id: Date.now(),
                    walletName: name,
                    ownerInfo: owner,
                    initialBalance: initBal,
                    creditLimit: creditLimit, // Lưu hạn mức vào object
                    createdAt: new Date().toISOString()
                };

                if (!app.data.wallets) app.data.wallets = [];
                app.data.wallets.push(newWallet);
                app.storage.save();

                document.getElementById('modal-add-wallet').classList.remove('active');
                this.render();
                app.ui.popup.show("✅ Đã thêm ví thành công!", "success");
            },

            delete(id) {
                if (confirm("Xóa ví này không ảnh hưởng đến lịch sử giao dịch, nhưng sẽ mất theo dõi số dư. Tiếp tục?")) {
                    app.data.wallets = app.data.wallets.filter(w => w.id !== id);
                    app.storage.save();
                    this.render();
                }
            },

            // Lọc lịch sử (từ 28/01/2026)
            getWalletHistory(wallet) {
                const CUTOFF_DATE = new Date('2026-01-28T00:00:00').getTime();
                const wName = wallet.walletName.toLowerCase().trim();

                return app.data.transactions.filter(t => {
                    const tTime = new Date(t.date).getTime();
                    if (tTime < CUTOFF_DATE) return false;

                    const s = t.source.toLowerCase().trim();
                    const d = (t.destination || "").toLowerCase().trim();
                    return s === wName || d === wName;
                }).sort((a, b) => new Date(b.date) - new Date(a.date));
            },

            openDetail(id) {
                this.currentWalletId = id;
                const wallet = app.data.wallets.find(w => w.id === id);
                if (!wallet) return;

                const history = this.getWalletHistory(wallet);

                // Header
                document.getElementById('wallet-detail-title').innerHTML = `
            <span style="font-weight:normal; font-size:0.9rem; color:var(--text-muted); display:block; margin-bottom:2px;">Lịch sử ví</span>
            ${wallet.walletName}
        `;

                const realBalance = app.logic.calculateWalletBalance(wallet);
                document.getElementById('wallet-detail-balance').textContent = app.logic.formatCurrency(realBalance);

                // List
                const tbody = document.getElementById('wallet-detail-list');
                const wName = wallet.walletName.toLowerCase().trim();

                if (history.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">Chưa có giao dịch nào từ 28/01/2026.</td></tr>`;
                } else {
                    tbody.innerHTML = history.map(t => {
                        const isCancelled = t.status === 'cancelled';
                        const s = t.source.toLowerCase().trim();
                        const isMoneyOut = (s === wName);

                        let color = isMoneyOut ? '#ef4444' : '#10b981';
                        const sign = isMoneyOut ? '-' : '+';
                        const flowText = isMoneyOut ? `Đến: ${t.destination || 'N/A'}` : `Từ: ${t.source}`;

                        let statusBadge = '';
                        if (isCancelled) {
                            color = '#94a3b8';
                            statusBadge = `<div style="font-size:0.65rem; color:#ef4444; font-weight:bold; margin-top:2px;">Đã hủy</div>`;
                        } else if (t.status === 'planned') {
                            color = '#9333ea'; // Đổi số tiền thành màu tím
                            statusBadge = `<div style="font-size:0.65rem; color:#9333ea; font-weight:bold; margin-top:2px;">${t.type === 'Thu nhập' ? 'Sẽ thu' : 'Sẽ chi'}</div>`;
                        } else if (t.status === 'pending') {
                            color = '#f59e0b'; // Đổi số tiền thành màu cam
                            statusBadge = `<div style="font-size:0.65rem; color:#f59e0b; font-weight:bold; margin-top:2px;">Chờ xử lý</div>`;
                        }

                        return `
                <tr style="border-bottom: 1px solid #fce7f3; ${isCancelled ? 'opacity: 0.6;' : ''}">
                    <td style="padding: 10px;">
    <div style="font-weight:600; font-size:0.8rem;">${new Date(t.date).toLocaleDateString('vi-VN')}</div>
    <div style="font-size:0.7rem; color:var(--text-muted);">${t.isUnknownTime ? '--:--' : new Date(t.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                        ${t.refId ? `<div style="font-size:0.7rem; color:#be185d; font-weight:700; margin-top:4px; white-space:nowrap;"><i class="fa-solid fa-hashtag"></i> ${t.refId}</div>` : ''}
                    </td>
                    <td style="padding: 10px;">
                        <div style="font-weight:600; color:#334155; ${isCancelled ? 'text-decoration: line-through;' : ''}">${t.place}</div>
                        ${statusBadge}
                    </td>
                    <td style="padding: 10px;">
                        <span style="font-size:0.75rem; background:#fff1f2; color:#be123c; padding:2px 6px; border-radius:4px;">${flowText}</span>
                    </td>
                    <td style="padding: 10px; text-align:right; font-family:var(--font-mono); font-weight:700; color:${color}; ${isCancelled ? 'text-decoration: line-through;' : ''}">
                        ${sign}${app.logic.formatCurrency(t.amount)}
                    </td>
                </tr>`;
                    }).join('');
                }
                document.getElementById('modal-wallet-detail').classList.add('active');
            },

            exportPDF() {
                if (!window.jspdf) return app.ui.popup.show("Thư viện PDF chưa tải xong!", "warning");

                const wallet = app.data.wallets.find(w => w.id === this.currentWalletId);
                if (!wallet) return;

                const history = this.getWalletHistory(wallet);
                const realBalance = app.logic.calculateWalletBalance(wallet);
                const wName = wallet.walletName.toLowerCase().trim();

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                // Header PDF
                doc.setFontSize(18); doc.setTextColor(190, 18, 60); // Màu đỏ hồng
                doc.text("SAO KE VI DIEN TU", 105, 15, { align: "center" });

                doc.setFontSize(10); doc.setTextColor(100);
                doc.text(`Vi: ${wallet.walletName.toUpperCase()}`, 14, 25);
                doc.text(`Chu so huu: ${wallet.ownerInfo}`, 14, 30);

                doc.setFontSize(12); doc.setTextColor(0);
                doc.text(`So du hien tai: ${app.logic.formatCurrency(realBalance)}`, 14, 40);

                // Body PDF
                const tableBody = history.map(t => {
                    const isMoneyOut = (t.source.toLowerCase().trim() === wName);
                    const sign = isMoneyOut ? '-' : '+';
                    return [
                        new Date(t.date).toLocaleDateString('vi-VN') + ' ' + new Date(t.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                        t.place,
                        isMoneyOut ? `Den: ${t.destination || ''}` : `Tu: ${t.source}`,
                        `${sign} ${new Intl.NumberFormat('vi-VN').format(t.amount)}`
                    ];
                });

                doc.autoTable({
                    startY: 45,
                    head: [['Thoi gian', 'Noi dung', 'Giao dich', 'So tien']],
                    body: tableBody,
                    theme: 'grid',
                    headStyles: { fillColor: [219, 39, 119] }, // Màu hồng đậm
                    styles: { font: "helvetica", fontSize: 9 },
                    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
                });

                doc.save(`SaoKe_Vi_${wallet.walletName}_${Date.now()}.pdf`);
            },

            render() {
                const listEl = document.getElementById('wallet-list');
                if (!app.data.wallets || app.data.wallets.length === 0) {
                    listEl.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-style:italic; padding:2rem;">Chưa có ví nào.</div>';
                    return;
                }

                listEl.innerHTML = app.data.wallets.map(w => {
                    // Logic tính toán: Khả dụng = (Hạn mức + Dư ban đầu) - Chi tiêu + Thu nhập
                    const available = app.logic.calculateWalletBalance(w);
                    const limit = w.creditLimit || 0; // Lấy hạn mức từ dữ liệu ví

                    return `
            <div onclick="app.ui.modals.wallets.openDetail(${w.id})" 
                 style="background: linear-gradient(135deg, #be185d, #db2777); color: white; padding: 1rem; border-radius: 16px; position: relative; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); cursor: pointer; transition: transform 0.2s; margin-bottom: 0px;"
                 onmouseover="this.style.transform='translateY(-2px)'"
                 onmouseout="this.style.transform='translateY(0)'">
                
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 1.5rem;">
                    <div style="font-weight: 800; font-size: 1.1rem; letter-spacing: 0.5px;">
                        <i class="fa-solid fa-wallet"></i> ${w.walletName}
                    </div>
                    <button onclick="event.stopPropagation(); app.ui.modals.wallets.delete(${w.id})" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer;">
                        &times;
                    </button>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 1rem;">
    <div style="font-size: 0.8rem; opacity: 0.9;">
        ${w.ownerInfo ? `<div>${w.ownerInfo}</div>` : ''}
        
        ${limit && limit > 0 ? `<div style="margin-top:4px; font-weight:bold;">Hạn mức: ${app.logic.formatCurrency(limit)}</div>` : ''}
    </div>
</div>

<div style="text-align: right;">
    <div style="font-size: 0.7rem; opacity: 0.8;">
        ${limit && limit > 0 ? 'Khả dụng (Hạn mức + Dư)' : 'Số dư hiện tại'}
    </div>
    <div style="font-size: 1.5rem; font-weight: 900; font-family: var(--font-mono);">
        ${app.logic.formatCurrency(available)}
    </div>
</div>
                
                <div style="position: absolute; bottom: 10px; left: 15px; font-size: 3rem; opacity: 0.1;">
                    <i class="fa-solid fa-qrcode"></i>
                </div>
            </div>`;
                }).join('');
            }
        },
    }
};
