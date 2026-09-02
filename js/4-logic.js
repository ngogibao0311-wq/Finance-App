app.logic = {
    formatCurrency(amount) {
        if (app.data.configs.guestMode) return '**** ₫';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    },

    // Chuẩn hóa ngày theo múi giờ địa phương. Dữ liệu cũ có thể là ISO UTC hoặc chuỗi giờ địa phương.
    getLocalDateKey(value) {
        const raw = String(value || '');
        const date = new Date(raw);

        if (Number.isNaN(date.getTime())) {
            return raw.slice(0, 10);
        }

        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    // Sắp xếp giao dịch thống nhất toàn bộ ứng dụng
    compareTransactions(a = {}, b = {}) {
        // --- [MỚI] ƯU TIÊN GIAO DỊCH HẠN MỨC LÊN TRÊN CÙNG ---
        const isLimitA = a.isMonthlyLimitCredit === true;
        const isLimitB = b.isMonthlyLimitCredit === true;

        if (isLimitA !== isLimitB) {
            return isLimitA ? -1 : 1; // Nếu A là hạn mức thì đẩy A lên trước (-1), ngược lại B lên trước
        }
        // ---------------------------------------------------

        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();

        const validA = Number.isFinite(timeA);
        const validB = Number.isFinite(timeB);

        // Ngày hợp lệ đứng trước ngày lỗi hoặc thiếu
        if (validA !== validB) {
            return validA ? -1 : 1;
        }

        // Nếu cả hai ngày đều lỗi, dùng ID để giữ thứ tự ổn định
        if (!validA && !validB) {
            return (Number(b.id) || 0) - (Number(a.id) || 0);
        }

        const dayA = this.getLocalDateKey(a.date);
        const dayB = this.getLocalDateKey(b.date);

        // Ngày mới nhất lên trước
        if (dayA !== dayB) {
            return dayB.localeCompare(dayA);
        }

        const unknownA = a.isUnknownTime === true;
        const unknownB = b.isUnknownTime === true;

        // Không rõ giờ luôn nằm cuối ngày
        if (unknownA !== unknownB) {
            return unknownA ? 1 : -1;
        }

        // Trong cùng ngày: giờ mới nhất lên trước
        if (timeA !== timeB) {
            return timeB - timeA;
        }

        // Cùng ngày, cùng giờ thì dùng ID
        return (Number(b.id) || 0) - (Number(a.id) || 0);
    },

    getLocalMonthKey(value) {
        return this.getLocalDateKey(value).slice(0, 7);
    },

    // Tháng bắt đầu dùng cơ chế “hạn mức cấp trước”.
    // Các tháng trước 08/2026 giữ nguyên cách tính cũ.
    getMonthlyLimitCreditStartMonth() {
        return String(
            app.data.configs?.monthlyLimitCreditStartMonth || '2026-08'
        );
    },

    isMonthlyLimitCreditEnabled(month = app.data.filter.month) {
        const monthKey = String(month || '');
        if (!/^\d{4}-\d{2}$/.test(monthKey)) return false;
        return monthKey >= this.getMonthlyLimitCreditStartMonth();
    },

    isMonthlyLimitCreditTransaction(transaction = {}) {
        if (transaction.isMonthlyLimitCredit === true) return true;
        return String(transaction.tags || '')
            .split(/\s+/)
            .includes('#gioi_han_chi_tieu_tu_dong');
    },

    getMonthlyLimitCreditMonth(transaction = {}) {
        const assignedMonth = String(transaction.monthlyLimitMonth || '');
        if (/^\d{4}-\d{2}$/.test(assignedMonth)) return assignedMonth;
        return this.getLocalMonthKey(transaction.date);
    },

    isTransactionInMonth(transaction, month = app.data.filter.month) {
        // Giao dịch hạn mức luôn thuộc tháng được hệ thống gán, kể cả khi
        // người dùng sửa ngày hoặc các thông tin mô tả khác.
        if (this.isMonthlyLimitCreditTransaction(transaction)) {
            return this.getMonthlyLimitCreditMonth(transaction) === month;
        }
        return this.getLocalMonthKey(transaction?.date) === month;
    },

    getMonthlyLimitCreditAmount(month = app.data.filter.month) {
        if (!this.isMonthlyLimitCreditEnabled(month)) return 0;
        return Math.max(
            0,
            Number(app.data.configs.monthlyLimits?.[month]) || 0
        );
    },

    getMonthlyLimitCreditTransaction(month = app.data.filter.month) {
        return app.data.transactions.find(t =>
            this.isMonthlyLimitCreditTransaction(t) &&
            this.getMonthlyLimitCreditMonth(t) === month
        ) || null;
    },

    // Tổng Thu nhập thực tế đã dùng để bù cho Hạn mức tháng
    getMonthlyLimitMatchedIncomeTotal(month = app.data.filter.month) {
        const limitTx =
            this.getMonthlyLimitCreditTransaction(month);

        if (!limitTx) return 0;

        return app.data.transactions
            .filter(t =>
                !this.isMonthlyLimitCreditTransaction(t) &&
                t.type === 'Thu nhập' &&
                t.status === 'paid' &&
                String(t.assignedToMonthlyLimit ?? '') ===
                String(limitTx.id)
            )
            .reduce(
                (sum, t) =>
                    sum + (Number(t.amount) || 0),
                0
            );
    },

    // Phần Cấp trước còn lại sau khi đã có Thu nhập thực tế bù vào
    getMonthlyLimitRemainingCredit(month = app.data.filter.month) {
        const configured =
            this.getMonthlyLimitCreditAmount(month);

        if (configured <= 0) return 0;

        const limitTx =
            this.getMonthlyLimitCreditTransaction(month);

        // Chưa chuyển sang Đã xong:
        // vẫn sử dụng toàn bộ Cấp trước như hiện tại
        if (!limitTx || limitTx.status !== 'paid') {
            return configured;
        }

        const matched =
            this.getMonthlyLimitMatchedIncomeTotal(month);

        return Math.max(
            0,
            configured - matched
        );
    },

    syncMonthlyLimitCredit(month = app.data.filter.month, options = {}) {
        let changed = false;
        // Xóa sạch các giao dịch "Hạn mức ảo" đã từng tạo để trả lại số dư thật
        const fakeTxs = app.data.transactions.filter(t => t.isMonthlyLimitCredit === true);
        if (fakeTxs.length > 0) {
            const fakeIds = new Set(fakeTxs.map(t => t.id));
            app.data.transactions = app.data.transactions.filter(t => !fakeIds.has(t.id));
            changed = true;
        }
        // Gỡ bỏ sự phụ thuộc vào "So khớp"
        app.data.transactions.forEach(t => {
            if (t.assignedToMonthlyLimit) {
                delete t.assignedToMonthlyLimit;
                changed = true;
            }
        });
        if (changed && options.save !== false) app.storage.save();
        return { changed, transaction: null };
    },

    syncAllMonthlyLimitCredits(options = {}) {
        const limitMonths = Object.keys(
            app.data.configs.monthlyLimits || {}
        );
        const transactionMonths = app.data.transactions
            .filter(t => this.isMonthlyLimitCreditTransaction(t))
            .map(t => this.getMonthlyLimitCreditMonth(t));

        const months = Array.from(
            new Set([...limitMonths, ...transactionMonths])
        ).filter(month => this.isMonthlyLimitCreditEnabled(month));

        let changed = false;
        months.forEach(month => {
            const result = this.syncMonthlyLimitCredit(month, { save: false });
            if (result.changed) changed = true;
        });

        if (changed && options.save !== false) app.storage.save();
        return { changed };
    },

    // Tháng bắt đầu tự động chuyển phần dư ngân sách
    // sang tháng kế tiếp.
    // '2026-08' nghĩa là lấy phần dư tháng 07/2026
    // tạo thành thu nhập của tháng 08/2026.
    getMonthlyBudgetCarryoverStartMonth() {
        return String(
            app.data.configs
                ?.monthlyBudgetCarryoverStartMonth ||
            '2026-08'
        );
    },

    // Lấy tháng trước hoặc tháng sau.
    // Ví dụ: getMonthKeyOffset('2026-08', -1)
    // trả về '2026-07'.
    getMonthKeyOffset(month, offset = 0) {
        const monthKey = String(month || '');

        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            return '';
        }

        const [year, monthNumber] =
            monthKey.split('-').map(Number);

        const date = new Date(
            year,
            monthNumber - 1 + Number(offset || 0),
            1
        );

        return (
            `${date.getFullYear()}-` +
            `${String(date.getMonth() + 1)
                .padStart(2, '0')}`
        );
    },

    // Nhận diện giao dịch dư ngân sách tự động.
    isMonthlyBudgetCarryoverTransaction(
        transaction = {}
    ) {
        if (
            transaction.isMonthlyBudgetCarryover === true
        ) {
            return true;
        }

        return String(transaction.tags || '')
            .split(/\s+/)
            .includes('#du_ngan_sach_thang_truoc');
    },

    // Xác định giao dịch chuyển dư thuộc tháng nào.
    getMonthlyBudgetCarryoverMonth(
        transaction = {}
    ) {
        const assignedMonth = String(
            transaction.budgetCarryoverToMonth || ''
        );

        if (/^\d{4}-\d{2}$/.test(assignedMonth)) {
            return assignedMonth;
        }

        return this.getLocalMonthKey(
            transaction.date
        );
    },

    // Tìm giao dịch chuyển dư của một tháng.
    getMonthlyBudgetCarryoverTransaction(
        month = app.data.filter.month
    ) {
        return app.data.transactions.find(t =>
            this.isMonthlyBudgetCarryoverTransaction(t) &&
            this.getMonthlyBudgetCarryoverMonth(t) ===
            month
        ) || null;
    },

    // Tính phần ngân sách còn lại của một tháng:
    //
    // Hạn mức cấp trước
    // + Thu nhập
    // - Chi tiêu thực trả
    // - Nợ thuộc tháng.
    getMonthlyBudgetBalance(
        month = app.data.filter.month
    ) {
        const monthKey = String(month || '');

        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            return {
                month: monthKey,
                limitCredit: 0,
                income: 0,
                expense: 0,
                debt: 0,
                balance: 0
            };
        }

        const limitCredit =
            this.getMonthlyLimitCreditAmount(monthKey);

        const income =
            this.getBudgetIncomeTotal(monthKey);

        const expense = this
            .getBudgetTransactions({
                month: monthKey
            })
            .reduce(
                (sum, transaction) =>
                    sum +
                    (Number(transaction.amount) || 0),
                0
            );

        const upcomingDebtData =
            this.getUpcomingDebts(monthKey);

        const debt =
            Number(upcomingDebtData.budgetTotal) || 0;

        // Cùng công thức với thanh "Khả dụng" trên giao diện
        const availableBase =
            this.getBudgetAvailableBase(monthKey);

        return {
            month: monthKey,
            limitCredit,
            income,
            expense,
            debt,

            // Nợ dự phòng chỉ để hiển thị,
            // không trừ vào số dư chuyển tháng sau
            balance:
                availableBase -
                expense
        };
    },

    // Tạo hoặc cập nhật một giao dịch chuyển dư
    // cho tháng đích.
    syncMonthlyBudgetCarryover(
        targetMonth = app.data.filter.month,
        options = {}
    ) {
        const month = String(targetMonth || '');

        const startMonth =
            this.getMonthlyBudgetCarryoverStartMonth();

        const currentMonth =
            this.getLocalMonthKey(new Date());

        if (!/^\d{4}-\d{2}$/.test(month)) {
            return {
                changed: false,
                transaction: null,
                amount: 0
            };
        }

        // Tìm các giao dịch chuyển dư đang tồn tại
        // trong tháng đích.
        const matches =
            app.data.transactions.filter(t =>
                this.isMonthlyBudgetCarryoverTransaction(
                    t
                ) &&
                this.getMonthlyBudgetCarryoverMonth(
                    t
                ) === month
            );

        let changed = false;

        // Hàm xóa giao dịch chuyển dư cũ.
        const removeMatches = () => {
            if (matches.length === 0) {
                return;
            }

            const ids = new Set(
                matches.map(t => t.id)
            );

            app.data.transactions =
                app.data.transactions.filter(
                    t => !ids.has(t.id)
                );

            changed = true;
        };

        const previousMonth =
            this.getMonthKeyOffset(month, -1);

        const deletedPeriods =
            app.data.configs?.deletedPeriods || [];

        // Không tạo giao dịch:
        // - Trước tháng bắt đầu.
        // - Cho tháng tương lai.
        // - Khi tháng liên quan đã bị xóa.
        if (
            month < startMonth ||
            month > currentMonth ||
            deletedPeriods.includes(month) ||
            deletedPeriods.includes(previousMonth)
        ) {
            removeMatches();

            if (
                changed &&
                options.save !== false
            ) {
                app.storage.save();
            }

            return {
                changed,
                transaction: null,
                amount: 0
            };
        }

        // Tính phần còn lại của tháng trước.
        const previousState =
            this.getMonthlyBudgetBalance(
                previousMonth
            );

        // Chỉ chuyển số dư dương.
        const amount = Math.max(
            0,
            Math.round(
                Number(previousState.balance) || 0
            )
        );

        // Nếu tháng trước không còn dư,
        // xóa giao dịch chuyển dư cũ.
        if (amount <= 0) {
            removeMatches();

            if (
                changed &&
                options.save !== false
            ) {
                app.storage.save();
            }

            return {
                changed,
                transaction: null,
                amount: 0
            };
        }

        // Dùng giao dịch có sẵn hoặc tạo mới.
        let transaction = matches[0] || null;

        if (!transaction) {
            transaction = {
                id: Date.now() + Math.random(),

                type: 'Thu nhập',
                status: 'paid',
                amount,

                discountAmount: 0,
                discountValue: null,

                place: '',
                brand: '',

                source:
                    'Dư ngân sách tháng trước',

                destination: '',
                refId: '',
                orderCode: '',

                date:
                    `${month}-01T00:05:00`,

                tags:
                    '#du_ngan_sach_thang_truoc ' +
                    '#thu_nhap_tu_dong',

                note: '',

                isCashback: false,

                isMonthlyBudgetCarryover: true,

                budgetCarryoverFromMonth:
                    previousMonth,

                budgetCarryoverToMonth:
                    month
            };

            app.data.transactions.push(
                transaction
            );

            changed = true;
        }

        // Nếu có nhiều giao dịch tự động trùng nhau,
        // chỉ giữ lại một giao dịch.
        if (matches.length > 1) {
            const duplicateIds = new Set(
                matches
                    .slice(1)
                    .map(t => t.id)
            );

            app.data.transactions =
                app.data.transactions.filter(
                    t => !duplicateIds.has(t.id)
                );

            changed = true;
        }

        const [
            previousYear,
            previousMonthNumber
        ] = previousMonth
            .split('-')
            .map(Number);

        const previousMonthLabel =
            `${String(previousMonthNumber)
                .padStart(2, '0')}/` +
            `${previousYear}`;

        // Những giá trị bắt buộc của giao dịch.
        const requiredValues = {
            type: 'Thu nhập',
            status: 'paid',
            amount,

            discountAmount: 0,
            discountValue: null,

            place:
                `Dư ngân sách tháng ` +
                previousMonthLabel,

            brand: '',

            source:
                'Dư ngân sách tháng trước',

            destination: '',

            date:
                `${month}-01T00:05:00`,

            tags:
                '#du_ngan_sach_thang_truoc ' +
                '#thu_nhap_tu_dong',

            note:
                `Tự động chuyển phần ngân sách ` +
                `còn dư của tháng ` +
                `${previousMonthLabel} ` +
                `sang tháng kế tiếp.`,

            isCashback: false,

            isMonthlyBudgetCarryover: true,

            budgetCarryoverFromMonth:
                previousMonth,

            budgetCarryoverToMonth:
                month
        };

        // Cập nhật giao dịch nếu phần dư thay đổi.
        Object.entries(requiredValues)
            .forEach(([key, value]) => {
                if (transaction[key] !== value) {
                    transaction[key] = value;
                    changed = true;
                }
            });

        if (
            changed &&
            options.save !== false
        ) {
            app.storage.save();
        }

        return {
            changed,
            transaction,
            amount,
            previousState
        };
    },

    // Đồng bộ lần lượt từng tháng.
    // Nhờ chạy theo thứ tự, số dư có thể
    // tiếp tục được chuyển qua nhiều tháng.
    syncAllMonthlyBudgetCarryovers(
        options = {}
    ) {
        const startMonth =
            this.getMonthlyBudgetCarryoverStartMonth();

        const currentMonth =
            this.getLocalMonthKey(new Date());

        if (
            !/^\d{4}-\d{2}$/.test(startMonth) ||
            !/^\d{4}-\d{2}$/.test(currentMonth) ||
            startMonth > currentMonth
        ) {
            return {
                changed: false
            };
        }

        let changed = false;
        let month = startMonth;
        let guard = 0;

        // Giới hạn 240 tháng để tránh vòng lặp lỗi.
        while (
            month <= currentMonth &&
            guard < 240
        ) {
            const result =
                this.syncMonthlyBudgetCarryover(
                    month,
                    {
                        save: false
                    }
                );

            if (result.changed) {
                changed = true;
            }

            month =
                this.getMonthKeyOffset(
                    month,
                    1
                );

            guard++;
        }

        if (
            changed &&
            options.save !== false
        ) {
            app.storage.save();
        }

        return {
            changed
        };
    },

    getTransactionTags(transaction = {}) {
        return String(transaction.tags || '').toLowerCase();
    },

    // ===== LIÊN KẾT NẠP GIẢM GIÁ ↔ CHI TIÊU =====
    normalizeTransactionMatchText(value = '') {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    },

    transactionMatchTextEquals(a = '', b = '') {
        const x = this.normalizeTransactionMatchText(a);
        const y = this.normalizeTransactionMatchText(b);

        if (!x || !y) return false;
        if (x === y) return true;
        if (Math.min(x.length, y.length) < 3) return false;

        return x.includes(y) || y.includes(x);
    },

    // Mệnh giá = số thực trả + số được giảm trực tiếp.
    getTransferFaceValue(transaction = {}) {
        const paid = Number(transaction.amount) || 0;

        const discount = transaction.isCashback === true
            ? 0
            : (Number(transaction.discountAmount) || 0);

        return Math.max(0, paid + discount);
    },

    getLinkedTransferForExpense(expense = {}) {
        if (
            expense.type !== 'Chi tiêu' ||
            expense.status !== 'paid'
        ) {
            return null;
        }

        if (
            expense.linkedTransferId === undefined ||
            expense.linkedTransferId === null ||
            expense.linkedTransferId === ''
        ) {
            return null;
        }

        const expenseId = String(expense.id ?? '');

        const transfer = app.data.transactions.find(t =>
            String(t.id ?? '') ===
            String(expense.linkedTransferId)
        );

        if (
            !transfer ||
            transfer.type !== 'Chuyển tiền' ||
            transfer.status !== 'paid'
        ) {
            return null;
        }

        // Không cho một giao dịch nạp liên kết hai khoản chi.
        if (
            transfer.linkedExpenseId !== undefined &&
            transfer.linkedExpenseId !== null &&
            transfer.linkedExpenseId !== '' &&
            String(transfer.linkedExpenseId) !== expenseId
        ) {
            return null;
        }

        return transfer;
    },

    // Chỉ dùng để tính Dashboard, ngân sách,
    // kế hoạch ngày và báo cáo.
    // Không thay đổi amount gốc trong lịch sử.
    getTransactionBudgetAmount(transaction = {}) {
        const transfer =
            this.getLinkedTransferForExpense(transaction);

        if (transfer) {
            return Math.max(
                0,
                Number(transfer.amount) || 0
            );
        }

        return Math.max(
            0,
            Number(transaction.amount) || 0
        );
    },

    findMatchingPaidTransfers(expense = {}, options = {}) {
        if (
            expense.type !== 'Chi tiêu' ||
            expense.status !== 'paid'
        ) {
            return [];
        }

        const amount =
            Math.round(Number(expense.amount) || 0);

        const expenseTime =
            new Date(expense.date).getTime();

        if (
            amount <= 0 ||
            !Number.isFinite(expenseTime)
        ) {
            return [];
        }

        const expenseId = String(
            options.expenseId ??
            expense.id ??
            ''
        );

        // Nạp trước khoản chi tối đa 7 ngày.
        const maxPastMs =
            Number(options.maxPastMs) ||
            7 * 24 * 60 * 60 * 1000;

        // Cho phép lệch nhập dữ liệu tối đa 30 phút.
        const maxFutureMs =
            Number(options.maxFutureMs) ||
            30 * 60 * 1000;

        return app.data.transactions
            .filter(transfer => {
                if (
                    transfer.type !== 'Chuyển tiền' ||
                    transfer.status !== 'paid'
                ) {
                    return false;
                }

                if (
                    transfer.linkedExpenseId !== undefined &&
                    transfer.linkedExpenseId !== null &&
                    transfer.linkedExpenseId !== '' &&
                    String(transfer.linkedExpenseId) !==
                    expenseId
                ) {
                    return false;
                }

                const transferTime =
                    new Date(transfer.date).getTime();

                if (!Number.isFinite(transferTime)) {
                    return false;
                }

                const elapsed =
                    expenseTime - transferTime;

                if (
                    elapsed < -maxFutureMs ||
                    elapsed > maxPastMs
                ) {
                    return false;
                }

                // Ví dụ: 19.600 + giảm 400 = 20.000.
                const faceValue = Math.round(
                    this.getTransferFaceValue(transfer)
                );

                if (faceValue !== amount) {
                    return false;
                }

                // Đích giao dịch nạp khớp nguồn/thương hiệu
                // của giao dịch chi tiêu.
                const routeMatch =
                    this.transactionMatchTextEquals(
                        transfer.destination,
                        expense.source
                    ) ||
                    this.transactionMatchTextEquals(
                        transfer.destination,
                        expense.brand
                    );

                const brandMatch =
                    this.transactionMatchTextEquals(
                        transfer.brand,
                        expense.brand
                    ) ||
                    this.transactionMatchTextEquals(
                        transfer.brand,
                        expense.source
                    ) ||
                    this.transactionMatchTextEquals(
                        transfer.destination,
                        expense.brand
                    ) ||
                    this.transactionMatchTextEquals(
                        transfer.place,
                        expense.brand
                    ) ||
                    this.transactionMatchTextEquals(
                        transfer.brand,
                        expense.place
                    );

                return routeMatch || brandMatch;
            })
            .sort((a, b) => {
                const distanceA = Math.abs(
                    expenseTime -
                    new Date(a.date).getTime()
                );

                const distanceB = Math.abs(
                    expenseTime -
                    new Date(b.date).getTime()
                );

                if (distanceA !== distanceB) {
                    return distanceA - distanceB;
                }

                return (
                    (Number(b.id) || 0) -
                    (Number(a.id) || 0)
                );
            });
    },

    unlinkTransferExpenseLink(transactionOrId) {
        const id =
            typeof transactionOrId === 'object'
                ? transactionOrId?.id
                : transactionOrId;

        const key = String(id ?? '');

        if (!key) return false;

        let changed = false;

        const transaction =
            app.data.transactions.find(t =>
                String(t.id ?? '') === key
            );

        // Giao dịch hiện tại là chi tiêu.
        if (
            transaction?.linkedTransferId !==
            undefined
        ) {
            const transfer =
                app.data.transactions.find(t =>
                    String(t.id ?? '') ===
                    String(
                        transaction.linkedTransferId ??
                        ''
                    )
                );

            if (
                transfer &&
                String(
                    transfer.linkedExpenseId ?? ''
                ) === key
            ) {
                delete transfer.linkedExpenseId;
                changed = true;
            }

            delete transaction.linkedTransferId;
            changed = true;
        }

        // Giao dịch hiện tại là giao dịch nạp.
        if (
            transaction?.linkedExpenseId !==
            undefined
        ) {
            const expense =
                app.data.transactions.find(t =>
                    String(t.id ?? '') ===
                    String(
                        transaction.linkedExpenseId ??
                        ''
                    )
                );

            if (
                expense &&
                String(
                    expense.linkedTransferId ?? ''
                ) === key
            ) {
                delete expense.linkedTransferId;
                changed = true;
            }

            delete transaction.linkedExpenseId;
            changed = true;
        }

        // Dọn các liên kết một chiều còn sót.
        app.data.transactions.forEach(t => {
            if (
                String(t.linkedTransferId ?? '') === key
            ) {
                delete t.linkedTransferId;
                changed = true;
            }

            if (
                String(t.linkedExpenseId ?? '') === key
            ) {
                delete t.linkedExpenseId;
                changed = true;
            }
        });

        return changed;
    },

    linkExpenseToTransfer(expenseId, transferId) {
        const expense =
            app.data.transactions.find(t =>
                String(t.id ?? '') ===
                String(expenseId ?? '')
            );

        const transfer =
            app.data.transactions.find(t =>
                String(t.id ?? '') ===
                String(transferId ?? '')
            );

        if (!expense || !transfer) return false;

        if (
            expense.type !== 'Chi tiêu' ||
            expense.status !== 'paid'
        ) {
            return false;
        }

        if (
            transfer.type !== 'Chuyển tiền' ||
            transfer.status !== 'paid'
        ) {
            return false;
        }

        // Gỡ liên kết cũ trước khi liên kết mới.
        this.unlinkTransferExpenseLink(expense.id);
        this.unlinkTransferExpenseLink(transfer.id);

        expense.linkedTransferId = transfer.id;
        transfer.linkedExpenseId = expense.id;

        return true;
    },

    cleanupTransferExpenseLinks(options = {}) {
        const snapshot = () =>
            app.data.transactions.map(t => [
                String(t.id ?? ''),

                t.linkedTransferId === undefined
                    ? null
                    : String(t.linkedTransferId),

                t.linkedExpenseId === undefined
                    ? null
                    : String(t.linkedExpenseId)
            ]);

        const before =
            JSON.stringify(snapshot());

        const requests = [];

        app.data.transactions.forEach(t => {
            if (
                t.type === 'Chi tiêu' &&
                t.linkedTransferId !== undefined &&
                t.linkedTransferId !== null &&
                t.linkedTransferId !== ''
            ) {
                requests.push({
                    expenseId: t.id,
                    transferId: t.linkedTransferId,
                    priority: 2
                });
            }

            if (
                t.type === 'Chuyển tiền' &&
                t.linkedExpenseId !== undefined &&
                t.linkedExpenseId !== null &&
                t.linkedExpenseId !== ''
            ) {
                requests.push({
                    expenseId: t.linkedExpenseId,
                    transferId: t.id,
                    priority: 1
                });
            }
        });

        // Xóa toàn bộ rồi dựng lại liên kết hợp lệ.
        app.data.transactions.forEach(t => {
            delete t.linkedTransferId;
            delete t.linkedExpenseId;
        });

        const usedExpenses = new Set();
        const usedTransfers = new Set();

        requests
            .sort((a, b) =>
                b.priority - a.priority
            )
            .forEach(request => {
                const expenseKey =
                    String(request.expenseId ?? '');

                const transferKey =
                    String(request.transferId ?? '');

                if (
                    !expenseKey ||
                    !transferKey ||
                    usedExpenses.has(expenseKey) ||
                    usedTransfers.has(transferKey)
                ) {
                    return;
                }

                const expense =
                    app.data.transactions.find(t =>
                        String(t.id ?? '') ===
                        expenseKey
                    );

                const transfer =
                    app.data.transactions.find(t =>
                        String(t.id ?? '') ===
                        transferKey
                    );

                if (!expense || !transfer) return;

                if (
                    expense.type !== 'Chi tiêu' ||
                    expense.status !== 'paid'
                ) {
                    return;
                }

                if (
                    transfer.type !== 'Chuyển tiền' ||
                    transfer.status !== 'paid'
                ) {
                    return;
                }

                expense.linkedTransferId =
                    transfer.id;

                transfer.linkedExpenseId =
                    expense.id;

                usedExpenses.add(expenseKey);
                usedTransfers.add(transferKey);
            });

        const changed =
            before !== JSON.stringify(snapshot());

        if (
            changed &&
            options.save !== false
        ) {
            app.storage.save();
        }

        return { changed };
    },

    isDebtPaymentTransaction(transaction = {}) {
        const tags = this.getTransactionTags(transaction);

        // #tra_gop chỉ thể hiện khoản đã chuyển sang cơ chế trả góp.
        // Nó KHÔNG đồng nghĩa với việc tiền đã thực sự được trả.
        return tags.includes('#thanh_toan_no') ||
            tags.includes('#thanh_toan_phi') ||
            tags.includes('#nop_phat') ||
            tags.includes('#tat_toan_vay') ||
            tags.includes('#tra_no_vay');
    },

    isCreditSource(source = '') {
        const s = String(source || '')
            .toLowerCase()
            .trim();

        if (!s) return false;

        // Zalo chỉ là tín dụng khi thật sự là Trả sau / Priority
        const isZaloCredit =
            (s.includes('zalo') || s.includes('zalopay')) &&
            (
                s.includes('trả sau') ||
                s.includes('tra sau') ||
                s.includes('priority') ||
                s.includes('paylater')
            );

        // MoMo chỉ là tín dụng khi là Ví Trả Sau / Credit
        const isMomoCredit =
            s.includes('momo') &&
            (
                s.includes('trả sau') ||
                s.includes('tra sau') ||
                s.includes('ví trả sau') ||
                s.includes('vi tra sau') ||
                s.includes('credit') ||
                s.includes('paylater')
            );

        // Shopee chỉ là tín dụng nếu SPayLater
        const isShopeeCredit =
            s.includes('spaylater') ||
            s.includes('spay later') ||
            (
                (s.includes('shopee') || s.includes('spay')) &&
                (
                    s.includes('trả sau') ||
                    s.includes('tra sau') ||
                    s.includes('paylater')
                )
            );

        // TikTok chỉ là tín dụng nếu PayLater / Trả sau
        const isTikTokCredit =
            s.includes('tiktok') &&
            (
                s.includes('paylater') ||
                s.includes('pay later') ||
                s.includes('trả sau') ||
                s.includes('tra sau')
            );

        // Tín dụng thông thường
        const isOtherCredit =
            s.includes('thẻ tín dụng') ||
            s.includes('the tin dung') ||
            s.includes('tín dụng') ||
            s.includes('tin dung') ||
            s.includes('credit card') ||
            s.includes('credit') ||
            s.includes('trả sau') ||
            s.includes('tra sau') ||
            s.includes('paylater') ||
            s.includes('pay later');

        return (
            isZaloCredit ||
            isMomoCredit ||
            isShopeeCredit ||
            isTikTokCredit ||
            isOtherCredit
        );
    },

    getFilteredTxs() {
        return app.data.transactions
            .filter(t => this.isTransactionInMonth(t))
            .sort((a, b) => this.compareTransactions(a, b));
    },

    copyToClipboard(elementId) {
        // 1. Lấy thẻ input dựa vào ID truyền vào
        const el = document.getElementById(elementId);

        if (!el || !el.value.trim()) {
            app.ui.popup.show("⚠️ Ô trống, không có dữ liệu để sao chép!", "info");
            return;
        }

        // 2. Dùng API Clipboard của trình duyệt để copy
        navigator.clipboard.writeText(el.value).then(() => {
            app.ui.popup.show("✅ Đã sao chép vào bộ nhớ tạm!", "success");
        }).catch(err => {
            console.error('Lỗi khi sao chép:', err);
            // Fallback nếu trình duyệt cũ hoặc không có HTTPS
            app.ui.popup.show("❌ Trình duyệt chặn quyền sao chép tự động.", "error");
        });
    },

    // --- SỬA ĐỔI CHÍNH TẠI ĐÂY ---
    getBudgetTransactions(options = {}) {
        const month = options.month || app.data.filter.month;
        const respectExclusion = options.respectExclusion !== false;
        return app.data.transactions.filter(t => {
            // 1. Bộ lọc cơ bản (Tháng, Loại, Trạng thái, Loại trừ thủ công)
            if (!this.isTransactionInMonth(t, month)) return false;
            if (t.type === 'Chuyển tiền') return false;
            if (t.type !== 'Chi tiêu') return false;
            if (t.status !== 'paid') return false;
            if (respectExclusion && t.excludeFromBudget === true) return false;

            const tags = this.getTransactionTags(t);
            const s = String(t.source || '').toLowerCase();

            // Trả góp ≠ trả nợ
            if (
                tags.includes('#tra_gop') &&
                !tags.includes('#thanh_toan_no')
            ) {
                return false;
            }

            // Chỉ các khoản thực sự thanh toán nợ mới tính
            const isDebtPayment = this.isDebtPaymentTransaction(t);

            if (isDebtPayment) return true;

            // Chi tiêu tín dụng gốc không phải thực trả
            if (this.isCreditSource(s)) return false;

            if (tags.includes('#da_chuyen_tra_gop')) return false;
            if (tags.includes('#du_no_chuyen_tiep')) return false;

            return true;
        }).map(t => {
            const budgetAmount =
                this.getTransactionBudgetAmount(t);

            const normalAmount =
                Number(t.amount) || 0;

            // Không thay object khi không có liên kết.
            if (budgetAmount === normalAmount) {
                return t;
            }

            // Trả về bản sao dùng cho Dashboard/ngân sách.
            // Giao dịch trong app.data vẫn giữ nguyên 20.000đ.
            return {
                ...t,
                originalAmount: normalAmount,
                amount: budgetAmount
            };
        });
    },

    // Thu nhập làm TĂNG THÊM ngân sách tháng.
    //
    // Giao dịch Thu nhập đã được chọn trong "So khớp Thu nhập"
    // chỉ dùng để đối ứng cho giao dịch Hạn mức, vì vậy KHÔNG được
    // cộng thêm lần nữa vào thanh ngân sách.
    //
    // Giao dịch Hạn mức cũng không nằm trong hàm này vì phần Hạn mức
    // được cộng riêng bằng getMonthlyLimitCreditAmount().
    getBudgetIncomeTotal(month = app.data.filter.month) {
        return app.data.transactions
            .filter(t => {
                if (!this.isTransactionInMonth(t, month)) return false;
                if (this.isMonthlyLimitCreditTransaction(t)) return false; // Bỏ qua rác
                if (t.type !== 'Thu nhập') return false;
                if (t.status !== 'paid') return false;
                if (t.excludeFromBudget === true) return false;
                return true;
            })
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    },

    // Tổng THU NHẬP CHÍNH THỨC để hiển thị/báo cáo.
    //
    // Khi giao dịch Hạn mức đã chuyển sang "Đã xong":
    // - TÍNH giao dịch Hạn mức vào Thu nhập.
    // - KHÔNG tính lại các giao dịch Thu nhập đã được chọn để so khớp
    //   với chính Hạn mức đó.
    //
    // Nhờ vậy mỗi khoản tiền chỉ xuất hiện một lần trong Tổng Thu nhập.
    getActualIncomeTotal(month = app.data.filter.month, options = {}) {
        const respectDashboardExclusion = options.respectDashboardExclusion === true;
        return app.data.transactions
            .filter(t => {
                if (!this.isTransactionInMonth(t, month)) return false;
                if (this.isMonthlyLimitCreditTransaction(t)) return false; // Bỏ qua rác
                if (t.type !== 'Thu nhập' || t.status !== 'paid') return false;
                if (respectDashboardExclusion && t.excludeFromDashboard) return false;
                return true;
            })
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    },

    getBudgetAvailableBase(month = app.data.filter.month) {
        const limit =
            this.getMonthlyLimitCreditAmount(month);

        const totalIncome =
            this.getBudgetIncomeTotal(month);

        // Phần dư ngân sách được chuyển từ tháng trước
        const carryoverIncome =
            app.data.transactions
                .filter(t => {
                    if (!this.isTransactionInMonth(t, month)) {
                        return false;
                    }

                    if (
                        !this.isMonthlyBudgetCarryoverTransaction(t)
                    ) {
                        return false;
                    }

                    if (t.type !== 'Thu nhập') {
                        return false;
                    }

                    if (t.status !== 'paid') {
                        return false;
                    }

                    if (t.excludeFromBudget === true) {
                        return false;
                    }

                    return true;
                })
                .reduce(
                    (sum, t) =>
                        sum + (Number(t.amount) || 0),
                    0
                );

        // Thu nhập bình thường, không bao gồm tiền dư tháng trước
        const regularIncome = Math.max(
            0,
            totalIncome - carryoverIncome
        );

        /*
         * CƠ CHẾ:
         *
         * - Hạn mức và thu nhập bình thường:
         *   lấy số lớn hơn.
         *
         * - Dư ngân sách tháng trước:
         *   cộng thêm hoàn toàn.
         */
        return (
            Math.max(limit, regularIncome) +
            carryoverIncome
        );
    },

    getUpcomingDebts(month = app.data.filter.month) {
        // 1. Xác định khung thời gian
        const filterMonthStr =
            String(month || app.data.filter.month);
        const [y, m] = filterMonthStr.split('-').map(Number);
        const nextMonthDate = new Date(y, m, 1); // Ngày 1 của tháng kế tiếp (Tháng ngân sách)
        const displayNextMonth = `${nextMonthDate.getMonth() + 1}/${nextMonthDate.getFullYear()}`;

        let budgetPendingTotal = 0;
        let items = [];
        const now = new Date();
        const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // 2. Lấy tất cả giao dịch Pending
        const allPendingTxs = app.data.transactions.filter(t => {
            if (this.isMonthlyLimitCreditTransaction(t)) return false;
            if (t.status !== 'pending') return false;
            return app.logic.getLocalMonthKey(t.date) <= filterMonthStr;
        });

        // --- LÀM LẠI TOÀN BỘ LOGIC ZALO PAY (FIX TRIỆT ĐỂ) ---
        const zaloTxs = allPendingTxs.filter(t => {
            const s = (t.source || '').toLowerCase();

            // Không dùng "paylater" chung vì sẽ bắt nhầm
            // ShopeePay và TikTok PayLater.
            return s.includes('zalo') || s.includes('priority');
        });

        const zaloGroups = {};
        zaloTxs.forEach(t => {
            const billing = app.logic.getBillingInfo(t.source, t.date);
            const dueDate = billing.dueDate;
            const dateKey = dueDate.toISOString().split('T')[0];

            if (!zaloGroups[dateKey]) {
                zaloGroups[dateKey] = { dueDate: dueDate, amount: 0, txs: [] };
            }
            zaloGroups[dateKey].amount += t.amount;
            zaloGroups[dateKey].txs.push(t);
        });

        Object.values(zaloGroups).forEach(group => {
            const dueDate = group.dueDate;
            const dueDayStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();

            let penalty = 0;
            let daysOverdue = 0;

            if (nowStartOfDay > dueDayStart) {
                const relevantPayments = app.data.transactions.filter(t => {
                    if (t.status !== 'paid') return false;
                    const s = String(t.source || '').toLowerCase();
                    const isZalo = s.includes('zalo') || s.includes('priority');
                    const tags = t.tags || "";
                    const isPayPrincipal = tags.includes('#thanh_toan_no') || tags.includes('#thanh_toan_phi');
                    const tDate = new Date(t.date).getTime();

                    return isZalo && isPayPrincipal && tDate >= dueDayStart;
                });

                const paidPrincipalTotal = relevantPayments.reduce((sum, t) => sum + t.amount, 0);
                const originalPrincipal = group.amount + paidPrincipalTotal;
                let loopTime = dueDayStart + (24 * 60 * 60 * 1000);
                const dailyRate = 0.001;

                while (loopTime <= nowStartOfDay) {
                    daysOverdue++;
                    const paidBeforeThisDay = relevantPayments.reduce((sum, t) => {
                        const tTime = new Date(t.date).getTime();
                        if (tTime < loopTime) return sum + t.amount;
                        return sum;
                    }, 0);
                    const currentBalanceThatDay = Math.max(0, originalPrincipal - paidBeforeThisDay);
                    penalty += currentBalanceThatDay * dailyRate;
                    loopTime += (24 * 60 * 60 * 1000);
                }

                const paidPenaltyTotal = app.data.transactions.reduce((sum, t) => {
                    const s = String(t.source || '').toLowerCase();
                    if (t.status === 'paid' &&
                        (s.includes('zalo') || s.includes('priority')) &&
                        t.tags && t.tags.includes('#nop_phat') &&
                        new Date(t.date).getTime() >= dueDayStart
                    ) {
                        return sum + t.amount;
                    }
                    return sum;
                }, 0);

                penalty = Math.max(0, Math.round(penalty) - paidPenaltyTotal);
            }

            const isDueNextMonth = dueDate.getMonth() === nextMonthDate.getMonth() &&
                dueDate.getFullYear() === nextMonthDate.getFullYear();

            const safeDateStr = `${group.dueDate.getFullYear()}-${String(group.dueDate.getMonth() + 1).padStart(2, '0')}-${String(group.dueDate.getDate()).padStart(2, '0')}`;
            const overrideKey = `Trả sau Zalo Pay::${safeDateStr}`;

            let finalAmount = group.amount;
            let finalPenalty = penalty;
            let isModified = false;

            const overrideData = app.data.configs.debtOverrides ? app.data.configs.debtOverrides[overrideKey] : undefined;

            if (overrideData !== undefined) {
                if (typeof overrideData === 'number') {
                    finalAmount = overrideData;
                    isModified = true;
                } else {
                    if (overrideData.principal !== undefined) {
                        finalAmount = overrideData.principal;
                        isModified = true;
                    }
                    if (overrideData.penalty !== undefined) {
                        finalPenalty = overrideData.penalty;
                        isModified = true;
                    }
                }
            }

            if (isDueNextMonth) {
                budgetPendingTotal += (finalAmount + finalPenalty);
            }

            items.push({
                type: 'zalo', name: 'Zalo Pay',
                amount: finalAmount,
                penalty: finalPenalty,
                daysOverdue: daysOverdue,
                date: `${dueDate.getDate()}/${dueDate.getMonth() + 1}`,
                isOverdue: daysOverdue > 0,
                isModified: isModified
            });
        });
        // --- KẾT THÚC LOGIC ZALO PAY MỚI ---

        // --- XỬ LÝ MOMO ---
        const momoTxs = allPendingTxs.filter(t => {
            const s = (t.source || '').toLowerCase();

            // Chỉ nhận nguồn có chữ MoMo, tránh bắt nhầm
            // "Ví Trả Sau ShopeePay".
            return s.includes('momo');
        });

        if (momoTxs.length > 0) {
            const lastTx = momoTxs[momoTxs.length - 1];
            const billing = app.logic.getBillingInfo(lastTx.source, lastTx.date);
            const momoTotal = momoTxs.reduce((sum, t) => sum + t.amount, 0);

            // [MỚI] Tính thêm dư nợ từ các khoản Trả Góp MoMo quá hạn (hoặc đến hạn tháng này)
            let momoInstallmentDebt = 0;
            if (app.data.installmentPlans) {
                Object.values(app.data.installmentPlans).forEach(plan => {
                    // Kiểm tra nguồn là MoMo
                    if (String(plan.source || '').toLowerCase().includes('momo')) {
                        // Lấy các kỳ chưa trả và ngày <= tháng hiện tại
                        const unpaid = plan.payments.filter(p => !p.paid && p.date <= filterMonthStr);
                        momoInstallmentDebt += unpaid.reduce((sum, p) => sum + p.amount, 0);
                    }
                });
            }

            const isOverdue = now > billing.dueDate;
            let penalty = 0;
            let daysOverdue = 0;

            if (isOverdue) {
                const diffTime = now - billing.dueDate;
                daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Tổng cơ sở tính phạt = Dư nợ ví + Trả góp quá hạn
                const totalBaseForPenalty = momoTotal + momoInstallmentDebt;

                // [CẬP NHẬT] Logic phạt 4 cấp độ theo yêu cầu:
                if (daysOverdue >= 15) {
                    penalty = Math.round((totalBaseForPenalty * 0.20) + Number.EPSILON); // 20%
                } else if (daysOverdue >= 10) {
                    penalty = Math.round((totalBaseForPenalty * 0.15) + Number.EPSILON); // 15%
                } else if (daysOverdue >= 5) {
                    penalty = Math.round((totalBaseForPenalty * 0.10) + Number.EPSILON); // 10%
                } else {
                    penalty = Math.round((totalBaseForPenalty * 0.05) + Number.EPSILON); // 5%
                }
            }

            const isDueNextMonth = billing.dueDate.getMonth() === nextMonthDate.getMonth() &&
                billing.dueDate.getFullYear() === nextMonthDate.getFullYear();

            const safeDateStr = `${billing.dueDate.getFullYear()}-${String(billing.dueDate.getMonth() + 1).padStart(2, '0')}-${String(billing.dueDate.getDate()).padStart(2, '0')}`;
            const overrideKey = `Ví Trả Sau MoMo::${safeDateStr}`;

            let finalAmount = momoTotal;
            let finalPenalty = penalty;

            const overrideData = app.data.configs.debtOverrides ? app.data.configs.debtOverrides[overrideKey] : undefined;
            if (overrideData !== undefined) {
                if (typeof overrideData === 'number') {
                    finalAmount = overrideData;
                } else {
                    if (overrideData.principal !== undefined) finalAmount = overrideData.principal;
                    if (overrideData.penalty !== undefined) finalPenalty = overrideData.penalty;
                }
            }

            if (isDueNextMonth) {
                budgetPendingTotal += (finalAmount + finalPenalty);
            }

            const minPayPrincipal = Math.round(finalAmount * 0.15);
            const minPayTotal = Math.max(50000, minPayPrincipal) + penalty;

            items.push({
                type: 'momo', name: 'Ví Trả Sau MoMo',
                amount: finalAmount,
                minPay: minPayTotal, penalty: penalty, daysOverdue: daysOverdue,
                date: '05/' + (billing.dueDate.getMonth() + 1), isOverdue: isOverdue
            });
        }

        // --- [FIX] XỬ LÝ SHOPEE: LỌC BỎ CÁC KHOẢN ĐÃ DỜI ---
        const shopeeTxs = allPendingTxs.filter(t => {
            const s = String(t.source || '').toLowerCase();
            const isShopee = s.includes('shopee') || s.includes('spay') || s.includes('airpay');

            if (!isShopee) return false;

            // [LOGIC MỚI] Kiểm tra xem hạn thanh toán có rơi vào "Tháng Ngân Sách" không.
            // Nếu đã dời kỳ (isDeferred), ngày hạn của nó sẽ nhảy sang tháng sau nữa -> Tự động bị loại.
            // Nếu là nợ cũ (Quá hạn) -> Vẫn giữ lại.

            const info = app.logic.getBillingInfo(t.source, t.date);
            const endOfBudgetMonth = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0);

            // Chỉ lấy những giao dịch có Hạn trả <= Cuối tháng ngân sách
            return info.dueDate <= endOfBudgetMonth;
        });

        if (shopeeTxs.length > 0) {
            const lastTx = shopeeTxs[shopeeTxs.length - 1];
            const billing = app.logic.getBillingInfo(lastTx.source, lastTx.date);

            // --- TÍNH TỔNG GỒM PHÍ 2.95% ---
            let totalExtraFee = 0;
            const shopeeTotal = shopeeTxs.reduce((sum, t) => {
                const feeInfo =
                    app.logic.getShopeeTransactionFeeInfo(t);

                let fee = 0;

                if (feeInfo.isSpecial) {
                    fee = Math.round(
                        t.amount * feeInfo.feeRate
                    );

                    totalExtraFee += fee;
                }
                return sum + t.amount + fee;
            }, 0);
            // -------------------------------------------------

            const isOverdue = now > billing.dueDate;
            let penalty = 0;
            let daysOverdue = 0;
            if (isOverdue) {
                const diffTime = now - billing.dueDate;
                daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                penalty = 30000;
            }

            const isDueNextMonth = billing.dueDate.getMonth() === nextMonthDate.getMonth() &&
                billing.dueDate.getFullYear() === nextMonthDate.getFullYear();

            // Kiểm tra Override Shopee
            const safeDateStr = `${billing.dueDate.getFullYear()}-${String(billing.dueDate.getMonth() + 1).padStart(2, '0')}-${String(billing.dueDate.getDate()).padStart(2, '0')}`;
            const overrideKey = `Ví Trả Sau ShopeePay::${safeDateStr}`;

            let finalAmount = shopeeTotal;
            let finalPenalty = penalty;

            const overrideData = app.data.configs.debtOverrides ? app.data.configs.debtOverrides[overrideKey] : undefined;
            if (overrideData !== undefined) {
                if (typeof overrideData === 'number') {
                    finalAmount = overrideData;
                } else {
                    if (overrideData.principal !== undefined) finalAmount = overrideData.principal;
                    if (overrideData.penalty !== undefined) finalPenalty = overrideData.penalty;
                }
            }

            if (isDueNextMonth) {
                budgetPendingTotal += (finalAmount + finalPenalty);
            }

            items.push({
                type: 'shopee', name: 'ShopeePay SPayLater',
                amount: finalAmount,
                penalty: finalPenalty, daysOverdue: daysOverdue,
                date: `${billing.dueDate.getDate()}/${billing.dueDate.getMonth() + 1}`,
                isOverdue: isOverdue,
                extraFee: totalExtraFee
            });
        }

        // --- XỬ LÝ TIKTOK PAYLATER ---
        const tiktokTxs = allPendingTxs.filter(t => String(t.source || '').toLowerCase().includes('tiktok'));

        if (tiktokTxs.length > 0) {
            const lastTx = tiktokTxs[tiktokTxs.length - 1];
            const billing = app.logic.getBillingInfo(lastTx.source, lastTx.date);

            // --- TÍNH TỔNG GỒM PHÍ 2.95% ---
            let totalExtraFee = 0;
            const tiktokTotal = tiktokTxs.reduce((sum, t) => {
                const fee = Math.round(t.amount * 0.0295); // Phí 2.95%
                totalExtraFee += fee;
                return sum + t.amount + fee;
            }, 0);

            const isOverdue = now > billing.dueDate;
            let penalty = 0;
            let daysOverdue = 0;
            if (isOverdue) {
                const diffTime = now - billing.dueDate;
                daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                penalty = 30000; // Phạt 30k/tháng
            }

            const isDueNextMonth = billing.dueDate.getMonth() === nextMonthDate.getMonth() &&
                billing.dueDate.getFullYear() === nextMonthDate.getFullYear();

            const safeDateStr = `${billing.dueDate.getFullYear()}-${String(billing.dueDate.getMonth() + 1).padStart(2, '0')}-${String(billing.dueDate.getDate()).padStart(2, '0')}`;
            const overrideKey = `TikTok PayLater::${safeDateStr}`;

            let finalAmount = tiktokTotal;
            let finalPenalty = penalty;

            const overrideData = app.data.configs.debtOverrides ? app.data.configs.debtOverrides[overrideKey] : undefined;
            if (overrideData !== undefined) {
                if (typeof overrideData === 'number') {
                    finalAmount = overrideData;
                } else {
                    if (overrideData.principal !== undefined) finalAmount = overrideData.principal;
                    if (overrideData.penalty !== undefined) finalPenalty = overrideData.penalty;
                }
            }

            if (isDueNextMonth) {
                budgetPendingTotal += (finalAmount + finalPenalty);
            }

            items.push({
                type: 'tiktok', name: 'TikTok PayLater',
                amount: finalAmount,
                penalty: finalPenalty, daysOverdue: daysOverdue,
                date: `${billing.dueDate.getDate()}/${billing.dueDate.getMonth() + 1}`,
                isOverdue: isOverdue,
                extraFee: totalExtraFee
            });
        }

        // ===== GOM CÁC GIAO DỊCH TÍN DỤNG THEO NỀN TẢNG + KỲ SAO KÊ =====
        // Các khối phía trên vẫn được giữ để không phá logic cũ.
        // Tại đây loại các thẻ tín dụng cũ và dựng lại theo từng kỳ sao kê.

        items = items.filter(item =>
            !['zalo', 'momo', 'shopee', 'tiktok', 'credit'].includes(item.type)
        );

        // Tính lại tổng tín dụng theo từng kỳ sao kê.
        // Các khoản trả góp và khoản vay sẽ được cộng tiếp ở phía dưới.
        budgetPendingTotal = 0;

        const detectCreditPlatform = (source = '') => {
            const raw = String(source || '').trim();
            const s = raw.toLowerCase();

            if (s.includes('zalo') || s.includes('priority')) {
                return {
                    key: 'zalo',
                    type: 'zalo',
                    name: 'Zalo Pay',
                    sourceName: 'Trả sau Zalo Pay'
                };
            }

            if (s.includes('momo')) {
                return {
                    key: 'momo',
                    type: 'momo',
                    name: 'Ví Trả Sau MoMo',
                    sourceName: 'Ví Trả Sau MoMo'
                };
            }

            if (
                s.includes('shopee') ||
                s.includes('spay') ||
                s.includes('airpay')
            ) {
                return {
                    key: 'shopee',
                    type: 'shopee',
                    name: 'ShopeePay SPayLater',
                    sourceName: 'Ví Trả Sau ShopeePay'
                };
            }

            if (s.includes('tiktok')) {
                return {
                    key: 'tiktok',
                    type: 'tiktok',
                    name: 'TikTok PayLater',
                    sourceName: 'TikTok PayLater'
                };
            }

            const isOtherCredit =
                s.includes('tín dụng') ||
                s.includes('thẻ') ||
                s.includes('credit') ||
                s.includes('trả sau') ||
                s.includes('paylater');

            if (!isOtherCredit) return null;

            const normalizedName = app.logic.normalizeSource(
                raw || 'Tín dụng khác'
            );

            return {
                key: `credit-${normalizedName
                    .toLowerCase()
                    .replace(/\s+/g, '-')}`,
                type: 'credit',
                name: normalizedName,
                sourceName: normalizedName
            };
        };

        const creditGroups = {};

        allPendingTxs.forEach(t => {
            const platform = detectCreditPlatform(t.source);

            if (!platform) return;

            const billing = app.logic.getBillingInfo(
                t.source,
                t.date
            );

            if (!billing || !billing.dueDate) return;

            const dueDate = billing.dueDate;

            const safeDateStr =
                `${dueDate.getFullYear()}-` +
                `${String(dueDate.getMonth() + 1).padStart(2, '0')}-` +
                `${String(dueDate.getDate()).padStart(2, '0')}`;

            // Một nhóm được xác định bởi:
            // Nền tảng + ngày đến hạn của kỳ sao kê.
            const groupKey = `${platform.key}::${safeDateStr}`;

            if (!creditGroups[groupKey]) {
                creditGroups[groupKey] = {
                    ...platform,
                    dueDate: dueDate,
                    statementDate: billing.statementDate || dueDate,
                    safeDateStr: safeDateStr,
                    amount: 0,
                    extraFee: 0,
                    txs: []
                };
            }

            const amount = Number(t.amount) || 0;
            let fee = 0;

            // Giữ quy tắc phí dịch vụ cũ của ShopeePay.
            if (platform.type === 'shopee') {
                const feeInfo =
                    app.logic.getShopeeTransactionFeeInfo(t);

                if (feeInfo.isSpecial) {
                    fee = Math.round(
                        amount * feeInfo.feeRate
                    );
                }
            }

            // Giữ quy tắc phí cũ của TikTok PayLater.
            if (platform.type === 'tiktok') {
                fee = Math.round(amount * 0.0295);
            }

            creditGroups[groupKey].amount += amount + fee;
            creditGroups[groupKey].extraFee += fee;
            creditGroups[groupKey].txs.push(t);
        });

        Object.entries(creditGroups)
            .sort(([, a], [, b]) => a.dueDate - b.dueDate)
            .forEach(([groupKey, group]) => {
                const dueDate = group.dueDate;

                const dueStart = new Date(
                    dueDate.getFullYear(),
                    dueDate.getMonth(),
                    dueDate.getDate()
                ).getTime();

                const isOverdue =
                    nowStartOfDay > dueStart;

                const daysOverdue = isOverdue
                    ? Math.max(
                        1,
                        Math.floor(
                            (nowStartOfDay - dueStart) /
                            (1000 * 60 * 60 * 24)
                        )
                    )
                    : 0;

                let penalty = 0;

                if (isOverdue) {
                    // Zalo: 0,1% mỗi ngày quá hạn.
                    if (group.type === 'zalo') {
                        penalty = Math.round(
                            group.amount *
                            0.001 *
                            daysOverdue
                        );
                    }

                    // MoMo: phạt theo số ngày quá hạn.
                    else if (group.type === 'momo') {
                        const rate =
                            daysOverdue >= 15
                                ? 0.20
                                : daysOverdue >= 10
                                    ? 0.15
                                    : daysOverdue >= 5
                                        ? 0.10
                                        : 0.05;

                        penalty = Math.round(
                            group.amount * rate
                        );
                    }

                    // ShopeePay và TikTok: phạt 30.000 đồng.
                    else if (
                        group.type === 'shopee' ||
                        group.type === 'tiktok'
                    ) {
                        penalty = 30000;
                    }
                }

                const overrideKey =
                    `${group.sourceName}::${group.safeDateStr}`;

                let finalAmount = group.amount;
                let finalPenalty = penalty;
                let isModified = false;

                const overrideData =
                    app.data.configs.debtOverrides
                        ? app.data.configs.debtOverrides[
                        overrideKey
                        ]
                        : undefined;

                if (overrideData !== undefined) {
                    if (typeof overrideData === 'number') {
                        finalAmount = overrideData;
                        isModified = true;
                    } else {
                        if (
                            overrideData.principal !==
                            undefined
                        ) {
                            finalAmount =
                                Number(
                                    overrideData.principal
                                ) || 0;

                            isModified = true;
                        }

                        if (
                            overrideData.penalty !==
                            undefined
                        ) {
                            finalPenalty =
                                Number(
                                    overrideData.penalty
                                ) || 0;

                            isModified = true;
                        }
                    }
                }

                const statementDate =
                    group.statementDate || dueDate;

                const statementLabel =
                    `Kỳ sao kê ${String(
                        statementDate.getMonth() + 1
                    ).padStart(2, '0')}/` +
                    `${statementDate.getFullYear()}`;

                const isDueNextMonth =
                    dueDate.getMonth() ===
                    nextMonthDate.getMonth() &&
                    dueDate.getFullYear() ===
                    nextMonthDate.getFullYear();

                if (isDueNextMonth) {
                    budgetPendingTotal +=
                        finalAmount + finalPenalty;
                }

                const item = {
                    type: group.type,
                    name: group.name,

                    statementDate: group.statementDate, // <--- THÊM DÒNG NÀY ĐỂ LƯU KỲ SAO KÊ

                    // Nguồn tín dụng nhận tiền thanh toán.
                    source: group.sourceName,

                    amount: finalAmount,
                    penalty: finalPenalty,
                    extraFee: group.extraFee,

                    date:
                        `${dueDate.getDate()}/` +
                        `${dueDate.getMonth() + 1}`,

                    // Ngày chính xác để UI không đoán sai tháng.
                    dueDateISO: group.safeDateStr,

                    statementLabel: statementLabel,

                    // Danh sách giao dịch thuộc kỳ sao kê.
                    txCount: group.txs.length,
                    txIds: group.txs.map(t => t.id),

                    // Khóa duy nhất để nút Trả hết tìm lại nhóm.
                    groupKey: groupKey,
                    overrideKey: overrideKey,

                    isCreditGroup: true,
                    isModified: isModified,
                    isOverdue: isOverdue,

                    daysOverdue: daysOverdue,
                    overdueDays: daysOverdue
                };

                if (group.type === 'momo') {
                    item.minPay =
                        Math.max(
                            50000,
                            Math.round(finalAmount * 0.15)
                        ) + finalPenalty;
                }

                items.push(item);
            });

        // ===== KẾT THÚC GOM TÍN DỤNG =====

        // --- XỬ LÝ TRẢ GÓP: GỘP VÀO CÙNG NỀN TẢNG + KỲ SAO KÊ ---
        if (app.data.installmentPlans) {
            const getInstallmentPlatform = (source = '') => {
                const raw = String(source || '').trim();
                const s = raw.toLowerCase();

                if (
                    s.includes('shopee') ||
                    s.includes('spay') ||
                    s.includes('airpay')
                ) {
                    return {
                        type: 'shopee',
                        keyPrefix: 'shopee',
                        name: 'ShopeePay SPayLater',
                        source: 'Ví Trả Sau ShopeePay',
                        dueDay: 3
                    };
                }

                if (s.includes('momo')) {
                    return {
                        type: 'momo',
                        keyPrefix: 'momo',
                        name: 'Ví Trả Sau MoMo',
                        source: 'Ví Trả Sau MoMo',
                        dueDay: 5
                    };
                }

                if (
                    s.includes('zalo') ||
                    s.includes('priority')
                ) {
                    return {
                        type: 'zalo',
                        keyPrefix: 'zalo',
                        name: 'Zalo Pay',
                        source: 'Trả sau Zalo Pay',
                        dueDay: 6
                    };
                }

                if (s.includes('tiktok')) {
                    return {
                        type: 'tiktok',
                        keyPrefix: 'tiktok',
                        name: 'TikTok PayLater',
                        source: 'TikTok PayLater',
                        dueDay: 10
                    };
                }

                const normalized = app.logic.normalizeSource(
                    raw || 'Trả góp khác'
                );

                const sourceKey = normalized
                    .toLowerCase()
                    .replace(/\s+/g, ' ');

                return {
                    type: 'credit',
                    keyPrefix: `credit::${sourceKey}`,
                    name: normalized,
                    source: normalized,
                    dueDay: 5
                };
            };

            Object.values(app.data.installmentPlans).forEach(plan => {
                if (!plan || !Array.isArray(plan.payments)) {
                    return;
                }

                const platform = getInstallmentPlatform(
                    plan.source
                );

                plan.payments.forEach(payment => {
                    if (
                        !payment ||
                        payment.paid ||
                        payment.date > filterMonthStr
                    ) {
                        return;
                    }

                    const totalDue =
                        (Number(payment.amount) || 0) +
                        (Number(payment.penaltyAmt) || 0);

                    const paidAmount =
                        Number(payment.paidAmount) || 0;

                    const remaining = Math.max(
                        0,
                        totalDue - paidAmount
                    );

                    if (remaining <= 0) return;

                    const [statementYear, statementMonth] =
                        String(payment.date)
                            .split('-')
                            .map(Number);

                    if (!statementYear || !statementMonth) {
                        return;
                    }

                    /*
                     * payment.date là tháng sao kê.
                     *
                     * Ví dụ:
                     * payment.date = 2026-07
                     * Shopee hạn ngày 02
                     * => hạn thực tế là 02/08/2026.
                     *
                     * statementMonth được truyền trực tiếp làm
                     * chỉ số tháng của Date để chuyển sang tháng sau.
                     */
                    const dueDate = new Date(
                        statementYear,
                        statementMonth,
                        platform.dueDay
                    );

                    const safeDateStr =
                        `${dueDate.getFullYear()}-` +
                        `${String(
                            dueDate.getMonth() + 1
                        ).padStart(2, '0')}-` +
                        `${String(
                            dueDate.getDate()
                        ).padStart(2, '0')}`;

                    const groupKey =
                        `${platform.keyPrefix}::${safeDateStr}`;

                    const dueDayStart = new Date(
                        dueDate.getFullYear(),
                        dueDate.getMonth(),
                        dueDate.getDate()
                    ).getTime();

                    const isOverdue =
                        nowStartOfDay > dueDayStart;

                    const overdueDays = isOverdue
                        ? Math.max(
                            1,
                            Math.floor(
                                (
                                    nowStartOfDay -
                                    dueDayStart
                                ) /
                                (
                                    1000 *
                                    60 *
                                    60 *
                                    24
                                )
                            )
                        )
                        : 0;

                    /*
                     * Tìm thẻ tín dụng đã được tạo phía trên.
                     *
                     * Ví dụ:
                     * shopee::2026-08-02
                     */
                    let targetItem = items.find(item =>
                        item.isCreditGroup === true &&
                        item.groupKey === groupKey
                    );

                    /*
                     * Nếu kỳ này chỉ có trả góp mà không có
                     * giao dịch tín dụng thường thì tạo thẻ mới.
                     */
                    if (!targetItem) {
                        targetItem = {
                            type: platform.type,
                            name: platform.name,
                            source: platform.source,
                            statementDate: new Date(statementYear, statementMonth - 1, 1), // <--- THÊM DÒNG NÀY

                            amount: 0,
                            penalty: 0,
                            extraFee: 0,

                            date:
                                `${dueDate.getDate()}/` +
                                `${dueDate.getMonth() + 1}`,

                            dueDateISO: safeDateStr,

                            statementLabel:
                                `Kỳ sao kê ` +
                                `${String(
                                    statementMonth
                                ).padStart(2, '0')}/` +
                                `${statementYear}`,

                            txCount: 0,
                            txIds: [],

                            installmentCount: 0,
                            installmentRefs: [],

                            groupKey: groupKey,

                            isCreditGroup: true,
                            isModified: false,
                            isOverdue: isOverdue,

                            daysOverdue: overdueDays,
                            overdueDays: overdueDays
                        };

                        items.push(targetItem);
                    }

                    /*
                     * Cộng kỳ trả góp vào tổng tiền của
                     * thẻ tín dụng cùng kỳ sao kê.
                     */
                    targetItem.amount += remaining;

                    if (
                        !Array.isArray(
                            targetItem.installmentRefs
                        )
                    ) {
                        targetItem.installmentRefs = [];
                    }

                    /*
                     * Lưu vị trí của kỳ trả góp để nút
                     * "Trả hết" có thể đánh dấu đã thanh toán.
                     */
                    targetItem.installmentRefs.push({
                        planId: plan.id,
                        paymentDate: payment.date
                    });

                    targetItem.installmentCount =
                        targetItem.installmentRefs.length;

                    targetItem.isOverdue =
                        targetItem.isOverdue ||
                        isOverdue;

                    targetItem.daysOverdue = Math.max(
                        Number(
                            targetItem.daysOverdue
                        ) || 0,
                        overdueDays
                    );

                    targetItem.overdueDays =
                        targetItem.daysOverdue;

                    const isDueNextMonth =
                        dueDate.getMonth() ===
                        nextMonthDate.getMonth() &&
                        dueDate.getFullYear() ===
                        nextMonthDate.getFullYear();

                    if (isDueNextMonth) {
                        budgetPendingTotal += remaining;
                    }
                });
            });
        }

        // --- XỬ LÝ VAY ---
        if (app.data.loans) {
            app.data.loans.forEach(loan => {
                if (loan.schedule) {
                    loan.schedule.forEach(p => {
                        if (!p.dueDate) return;

                        const [d, lm, ly] = p.dueDate.split('/').map(Number);

                        // --- THUẬT TOÁN TÍNH NGÀY QUÁ HẠN (VAY) ---
                        const dueDateObj = new Date(ly, lm - 1, d);
                        const now = new Date();

                        // Reset giờ về 0 để tính tròn ngày
                        now.setHours(0, 0, 0, 0);
                        dueDateObj.setHours(0, 0, 0, 0);

                        const diffTime = now.getTime() - dueDateObj.getTime();
                        const overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        // ---------------------------------------------

                        const targetMonth = nextMonthDate.getMonth() + 1;
                        const targetYear = nextMonthDate.getFullYear();

                        const isPastOrCurrent = ly < targetYear || (ly === targetYear && lm <= targetMonth);

                        if (isPastOrCurrent && !p.isFinished) {
                            const dueAmt = (p.principal + p.interest) - (p.paid || 0);

                            if (dueAmt > 0) {
                                let extraFee = 0;
                                const lenderName = (loan.lender || "").toLowerCase();
                                if (lenderName.includes('momo') || lenderName.includes('vay nhanh')) {
                                    extraFee = 20000;
                                }

                                const finalAmount = dueAmt + extraFee;

                                budgetPendingTotal += finalAmount;
                                items.push({
                                    type: 'loan',
                                    name: `Vay ${loan.lender}`,
                                    statementDate: dueDateObj, // <--- THÊM DÒNG NÀY (Đối với khoản vay, hạn chót đóng vai trò như kỳ sao kê)
                                    amount: finalAmount,
                                    date: p.dueDate,
                                    isOverdue: overdueDays > 0,
                                    overdueDays: overdueDays > 0 ? overdueDays : 0 // Trả ra số ngày trễ
                                });
                            }
                        }
                    });
                }
            });
        }

        items.sort((a, b) => (b.isOverdue ? 1 : 0) - (a.isOverdue ? 1 : 0));

        const displayTotal = items.reduce(
            (sum, item) =>
                sum +
                (Number(item.amount) || 0) +
                (Number(item.penalty) || 0),
            0
        );

        /*
         * Ngày cuối cùng của tháng đang xem.
         *
         * Ví dụ filterMonthStr = "2026-07":
         * selectedMonthEnd = 31/07/2026 23:59:59.
         */
        const selectedMonthEnd = new Date(
            y,
            m,
            0,
            23,
            59,
            59,
            999
        );

        /*
         * Lấy ngày đến hạn thật của từng khoản nợ.
         */
        const getDebtDueDate = (item = {}) => {
            /*
             * Các khoản tín dụng và trả góp có ngày dạng:
             * 2026-08-01
             */
            const iso = String(
                item.dueDateISO || ''
            ).trim();

            const isoMatch = iso.match(
                /^(\d{4})-(\d{2})-(\d{2})$/
            );

            if (isoMatch) {
                return new Date(
                    Number(isoMatch[1]),
                    Number(isoMatch[2]) - 1,
                    Number(isoMatch[3])
                );
            }

            /*
             * Các khoản vay thường có ngày dạng:
             * 01/08/2026
             */
            const rawDate = String(
                item.date || ''
            ).trim();

            const fullDateMatch = rawDate.match(
                /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
            );

            if (fullDateMatch) {
                return new Date(
                    Number(fullDateMatch[3]),
                    Number(fullDateMatch[2]) - 1,
                    Number(fullDateMatch[1])
                );
            }

            return null;
        };

        /*
 * Chỉ trừ vào ngân sách tháng đang xem những khoản:
 * - Đến hạn trong tháng đang xem; hoặc
 * - Đã quá hạn từ tháng trước.
 *
 * Nợ tháng sau chỉ hiển thị để nhắc trước,
 * không ảnh hưởng Khả dụng tháng hiện tại.
 */
        const budgetTotal = items.reduce(
            (sum, item) => {
                // SỬA: Ưu tiên dùng Ngày chốt sao kê (statementDate) để tính ngân sách
                const targetDate = item.statementDate || getDebtDueDate(item);

                if (
                    !targetDate ||
                    Number.isNaN(targetDate.getTime()) ||
                    targetDate > selectedMonthEnd
                ) {
                    return sum;
                }

                return (
                    sum +
                    (Number(item.amount) || 0) +
                    (Number(item.penalty) || 0)
                );
            },
            0
        );

        return {
            /*
             * Tổng tất cả nợ đang hiển thị trong
             * khối “Sắp đến hạn”.
             */
            total: displayTotal,
            displayTotal: displayTotal,

            /*
             * Tổng nợ được phép trừ vào ngân sách
             * của tháng đang xem.
             */
            budgetTotal: budgetTotal,

            items,
            monthLabel: displayNextMonth
        };
    },

    normalizeSource(source) {
        const s = String(source || '').toLowerCase();
        if (s.includes('zalo') && (s.includes('trả sau') || s.includes('priority') || s.includes('paylater'))) {
            return 'Trả sau Zalo Pay';
        }
        if (s.includes('momo') && (s.includes('trả sau') || s.includes('ví trả sau') || s.includes('credit'))) {
            return 'Ví Trả Sau MoMo';
        }
        if (s.includes('shopee') || s.includes('spay') || s.includes('airpay')) {
            return 'Ví Trả Sau ShopeePay';
        }
        if (s.includes('tiktok')) {
            return 'TikTok PayLater';
        }
        return source;
    },

    normalizeSearchText(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    getShopeeTransactionFeeInfo(tx = {}) {
        /*
         * Gom tất cả thông tin có thể dùng để nhận diện.
         * Nhờ đó ShopeeFood hoặc dịch vụ ghi ở Nơi chi tiêu,
         * Thương hiệu, Tag hay Ghi chú đều được phát hiện.
         */
        const searchableText = this.normalizeSearchText([
            tx.place,
            tx.brand,
            tx.tags,
            tx.note,
            tx.destination,
            tx.category
        ].join(' '));

        const compactText =
            searchableText.replace(/\s+/g, '');

        const reasons = [];

        const isShopeeFood =
            compactText.includes('shopeefood') ||
            searchableText.includes('shopee food');

        const isTopUpOrCard =
            searchableText.includes('nap the') ||
            searchableText.includes('nap tien') ||
            searchableText.includes('mua the') ||
            searchableText.includes('the dien thoai') ||
            searchableText.includes('nap data');

        const isLinkedService =
            searchableText.includes('dich vu lien ket') ||
            searchableText.includes('dich vu shopee') ||
            searchableText.includes('shopee lien ket') ||
            searchableText.includes('dich vu');

        const isStoreQr =
            searchableText.includes('quet ma qr') ||
            searchableText.includes('quet qr') ||
            searchableText.includes('thanh toan qr') ||
            searchableText.includes('qr tai cua hang') ||
            searchableText.includes('quet ma tai cua hang') ||
            searchableText.includes('quet ma cua hang') ||
            searchableText.includes('ma qr cua hang');

        if (isShopeeFood) {
            reasons.push('ShopeeFood');
        }

        if (isTopUpOrCard) {
            reasons.push('Nạp thẻ/nạp tiền');
        }

        if (isLinkedService) {
            reasons.push('Dịch vụ liên kết');
        }

        if (isStoreQr) {
            reasons.push('Quét mã tại cửa hàng');
        }

        return {
            isSpecial:
                isShopeeFood ||
                isTopUpOrCard ||
                isLinkedService ||
                isStoreQr,

            feeRate: 0.0295,
            reasons: reasons,
            reasonText: reasons.join(', ')
        };
    },

    getInstallmentRate(months, source = '') {
        const term = parseInt(months, 10);
        if (!Number.isFinite(term) || term <= 0) return 0;

        const s = String(source || '').toLowerCase();

        // TikTok PayLater: phí 2,95% giá trị đơn hàng gốc cho mỗi tháng.
        if (s.includes('tiktok')) {
            return 0.0295 * term;
        }

        if (
            s.includes('shopee') ||
            s.includes('spay') ||
            s.includes('airpay')
        ) {
            return 0.0295;
        }

        return 0.03 * term;
    },
    parseZaloDateKey(value, endOfDay = false) {
        const raw = String(value || '');
        let date;

        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [year, month, day] =
                raw.split('-').map(Number);

            date = new Date(
                year,
                month - 1,
                day
            );
        } else {
            date = new Date(value);
        }

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        date.setHours(
            endOfDay ? 23 : 0,
            endOfDay ? 59 : 0,
            endOfDay ? 59 : 0,
            endOfDay ? 999 : 0
        );

        return date;
    },

    formatZaloDateKey(value) {
        const date = value instanceof Date
            ? value
            : this.parseZaloDateKey(value);

        if (
            !date ||
            Number.isNaN(date.getTime())
        ) {
            return '';
        }

        return (
            `${date.getFullYear()}-` +
            `${String(date.getMonth() + 1)
                .padStart(2, '0')}-` +
            `${String(date.getDate())
                .padStart(2, '0')}`
        );
    },

    shiftZaloDateKey(
        value,
        months = 0,
        days = 0
    ) {
        const base =
            this.parseZaloDateKey(value);

        if (!base) return '';

        const originalDay = base.getDate();

        const firstOfTargetMonth = new Date(
            base.getFullYear(),
            base.getMonth() +
            Number(months || 0),
            1,
            12,
            0,
            0,
            0
        );

        const lastDayOfTargetMonth =
            new Date(
                firstOfTargetMonth
                    .getFullYear(),
                firstOfTargetMonth
                    .getMonth() + 1,
                0
            ).getDate();

        const result = new Date(
            firstOfTargetMonth.getFullYear(),
            firstOfTargetMonth.getMonth(),
            Math.min(
                originalDay,
                lastDayOfTargetMonth
            ),
            12,
            0,
            0,
            0
        );

        result.setDate(
            result.getDate() +
            Number(days || 0)
        );

        return this.formatZaloDateKey(result);
    },

    ensureZaloPriorityConfig() {
        const configs = app.data.configs;

        const validRanks = [
            'member',
            'silver',
            'gold',
            'diamond'
        ];

        const todayKey =
            this.formatZaloDateKey(
                new Date()
            );

        let changed = false;

        /*
         * Chuyển dữ liệu hạng cũ sang
         * zaloCurrentRank.
         */
        if (
            !validRanks.includes(
                configs.zaloCurrentRank
            )
        ) {
            configs.zaloCurrentRank =
                validRanks.includes(
                    configs.manualZaloRank
                )
                    ? configs.manualZaloRank
                    : 'member';

            changed = true;
        }

        const hasReviewDate =
            /^\d{4}-\d{2}-\d{2}$/.test(
                String(
                    configs.zaloReviewDate ||
                    ''
                )
            );

        const hasStartDate =
            /^\d{4}-\d{2}-\d{2}$/.test(
                String(
                    configs.zaloRankStartDate ||
                    ''
                )
            );

        /*
         * Có ngày xét nhưng chưa có ngày
         * bắt đầu: suy ra chu kỳ cũ.
         *
         * Ví dụ:
         * xét 30/06 -> bắt đầu 01/01.
         */
        if (
            !hasStartDate &&
            hasReviewDate
        ) {
            configs.zaloRankStartDate =
                this.shiftZaloDateKey(
                    this.shiftZaloDateKey(
                        configs.zaloReviewDate,
                        0,
                        1
                    ),
                    -6,
                    0
                )

            changed = true;
        }

        /*
         * Không có dữ liệu ngày nào thì
         * bắt đầu chu kỳ từ hôm nay.
         */
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(
                String(
                    configs.zaloRankStartDate ||
                    ''
                )
            )
        ) {
            configs.zaloRankStartDate =
                todayKey;

            changed = true;
        }

        /*
         * Chu kỳ đầu:
         * ngày xét = ngày bắt đầu + 6 tháng
         * - 1 ngày.
         */
        if (!hasReviewDate) {
            configs.zaloReviewDate =
                this.shiftZaloDateKey(
                    configs.zaloRankStartDate,
                    6,
                    -1
                );

            changed = true;
        }

        if (
            configs.zaloRankStartDate >
            configs.zaloReviewDate
        ) {
            configs.zaloRankStartDate =
                this.shiftZaloDateKey(
                    this.shiftZaloDateKey(
                        configs.zaloReviewDate,
                        0,
                        1
                    ),
                    -6,
                    0
                )

            changed = true;
        }

        return changed;
    },

    /*
     * Dùng cho xét hạng Priority.
     * Chấp nhận ZaloPay thường,
     * ZaloPay Priority và Trả sau.
     */
    isZaloPrioritySource(source = '') {
        return String(source || '')
            .toLowerCase()
            .includes('zalo');
    },

    /*
     * Chỉ dùng cho phí dịch vụ Trả sau.
     * Không dùng hàm này để xét hạng.
     */
    isZaloPayLaterSource(source = '') {
        const s = String(source || '')
            .toLowerCase();

        return s.includes('zalo') && (
            s.includes('trả sau') ||
            s.includes('priority') ||
            s.includes('paylater') ||
            s.includes('pay later')
        );
    },

    isZaloPriorityEligibleTransaction(
        transaction = {}
    ) {
        const tags = String(
            transaction.tags || ''
        );

        const excludedTags = [
            '#phi_dich_vu',
            '#thanh_toan_no',
            '#du_no_chuyen_tiep',
            '#tra_gop',
            '#tat_toan_vay',
            '#tra_no_vay',
            '#nop_phat',
            '#chuyen_tien',
            '#chuyen_khoan',
            '#ban_chung_khoan',
            '#ban_chung_chi_quy'
        ];

        return (
            transaction.type === 'Chi tiêu' &&

            transaction.status !==
            'cancelled' &&

            transaction.status !==
            'planned' &&

            transaction.skipZalo !== true &&

            this.isZaloPrioritySource(
                transaction.source
            ) &&

            !excludedTags.some(tag =>
                tags.includes(tag)
            )
        );
    },

    getZaloEligibleTransactions(
        options = {}
    ) {
        this.ensureZaloPriorityConfig();

        const configs = app.data.configs;

        const todayKey =
            this.formatZaloDateKey(
                new Date()
            );

        /*
         * ZaloPay chốt số hết ngày
         * trước ngày xét hạng.
         */
        const cutoffKey =
            this.shiftZaloDateKey(
                configs.zaloReviewDate,
                0,
                -1
            );

        const startKey = String(
            options.startKey ||
            configs.zaloRankStartDate
        );

        const defaultEndKey =
            todayKey < cutoffKey
                ? todayKey
                : cutoffKey;

        const endKey = String(
            options.endKey ||
            defaultEndKey
        );

        const startDate =
            this.parseZaloDateKey(
                startKey,
                false
            );

        const endDate =
            this.parseZaloDateKey(
                endKey,
                true
            );

        if (
            !startDate ||
            !endDate ||
            startDate.getTime() >
            endDate.getTime()
        ) {
            return [];
        }

        return app.data.transactions
            .filter(transaction => {
                if (
                    !this
                        .isZaloPriorityEligibleTransaction(
                            transaction
                        )
                ) {
                    return false;
                }

                const transactionDate =
                    new Date(
                        transaction.date
                    );

                if (
                    Number.isNaN(
                        transactionDate.getTime()
                    )
                ) {
                    return false;
                }

                return (
                    transactionDate >=
                    startDate &&
                    transactionDate <=
                    endDate
                );
            })
            .sort((a, b) => {
                const timeDiff =
                    new Date(a.date).getTime() -
                    new Date(b.date).getTime();

                if (timeDiff !== 0) {
                    return timeDiff;
                }

                return (
                    (Number(a.id) || 0) -
                    (Number(b.id) || 0)
                );
            });
    },

    getZaloAccumulation(
        ignoreManual = false,
        options = {}
    ) {
        const currentRealSum =
            this.getZaloEligibleTransactions(
                options
            )
                .reduce(
                    (sum, transaction) =>
                        sum +
                        (
                            Number(
                                transaction.amount
                            ) || 0
                        ),
                    0
                );

        if (ignoreManual) {
            return currentRealSum;
        }

        const offset = Number(
            app.data.configs
                .manualZaloOffset || 0
        );

        return Math.max(
            0,
            currentRealSum + offset
        );
    },
    getTikTokInstallmentQuote(principal, months) {
        const originalPrincipal = Math.max(
            0,
            Math.round(Number(principal) || 0)
        );

        const term = parseInt(months, 10);
        const allowedTerms = [1, 3, 6, 9, 12];

        if (
            originalPrincipal <= 0 ||
            !allowedTerms.includes(term)
        ) {
            return null;
        }

        const feeRatePerMonth = 0.0295;

        // Phí mỗi tháng luôn tính trên toàn bộ giá trị đơn hàng gốc.
        const monthlyFee = Math.round(
            originalPrincipal * feeRatePerMonth
        );

        const totalFee = monthlyFee * term;
        const basePerMonth = Math.floor(
            originalPrincipal / term
        );

        const payments = [];

        for (let i = 0; i < term; i++) {
            // Dồn số tiền lẻ còn lại vào kỳ cuối.
            const base = i === term - 1
                ? originalPrincipal -
                (basePerMonth * (term - 1))
                : basePerMonth;

            payments.push({
                base: base,
                fee: monthlyFee,
                amount: base + monthlyFee
            });
        }

        return {
            principal: originalPrincipal,
            months: term,
            feeRatePerMonth: feeRatePerMonth,
            monthlyFee: monthlyFee,
            totalFee: totalFee,
            totalRepayment: originalPrincipal + totalFee,
            payments: payments
        };
    },
    getZaloRankInfo(
        amount,
        manualRankOverride = null
    ) {
        const ranks = {
            diamond: {
                id: 'diamond',
                name: 'Kim Cương',
                color:
                    'var(--rank-diamond)',
                fee: 20000,
                next: null,
                min: 60000000,
                order: 4
            },

            gold: {
                id: 'gold',
                name: 'Vàng',
                color:
                    'var(--rank-gold)',
                fee: 20000,
                next: 60000000,
                min: 18000000,
                order: 3
            },

            silver: {
                id: 'silver',
                name: 'Bạc',
                color:
                    'var(--rank-silver)',
                fee: 20000,
                next: 18000000,
                min: 3000000,
                order: 2
            },

            member: {
                id: 'member',
                name: 'Thành viên',
                color: '#3f3f46',
                fee: 20000,
                next: 3000000,
                min: 0,
                order: 1
            }
        };

        if (
            manualRankOverride &&
            ranks[manualRankOverride]
        ) {
            return ranks[
                manualRankOverride
            ];
        }

        const normalizedAmount =
            Math.max(
                0,
                Number(amount) || 0
            );

        if (
            normalizedAmount >=
            60000000
        ) {
            return ranks.diamond;
        }

        if (
            normalizedAmount >=
            18000000
        ) {
            return ranks.gold;
        }

        if (
            normalizedAmount >=
            3000000
        ) {
            return ranks.silver;
        }

        return ranks.member;
    },

    getZaloRetentionState() {
        this.ensureZaloPriorityConfig();

        const accumulated =
            this.getZaloAccumulation(false);

        /*
         * Hạng hiện tại được giữ nguyên
         * đến ngày xét hạng.
         */
        const currentRank =
            this.getZaloRankInfo(
                0,
                app.data.configs
                    .zaloCurrentRank
            );

        /*
         * Hạng dự kiến tại ngày xét dựa
         * trên số tích lũy của chu kỳ này.
         */
        const projectedRank =
            this.getZaloRankInfo(
                accumulated
            );

        let status = 'keep';
        let missing = 0;

        if (
            projectedRank.order <
            currentRank.order
        ) {
            status = 'drop';

            missing = Math.max(
                0,
                currentRank.min -
                accumulated
            );
        } else if (
            projectedRank.order >
            currentRank.order
        ) {
            status = 'upgraded';
        }

        return {
            currentRank,
            projectedRank,
            totalAccumulated:
                accumulated,
            status,
            missing,

            startDate:
                app.data.configs
                    .zaloRankStartDate,

            reviewDate:
                app.data.configs
                    .zaloReviewDate,

            cutoffDate:
                this.shiftZaloDateKey(
                    app.data.configs
                        .zaloReviewDate,
                    0,
                    -1
                )
        };
    },

    /*
     * Đủ mốc hạng cao hơn thì
     * nâng hạng ngay.
     */
    applyZaloInstantUpgrade(
        options = {}
    ) {
        this.ensureZaloPriorityConfig();

        const configs =
            app.data.configs;

        const currentRank =
            this.getZaloRankInfo(
                0,
                configs.zaloCurrentRank
            );

        const accumulated =
            this.getZaloAccumulation(
                false
            );

        const achievedRank =
            this.getZaloRankInfo(
                accumulated
            );

        if (
            achievedRank.order <=
            currentRank.order
        ) {
            return {
                changed: false,
                previousRank:
                    currentRank,
                currentRank,
                accumulated
            };
        }

        /*
         * Tìm ngày giao dịch làm tổng tiền
         * chạm mốc hạng mới.
         */
        const transactions =
            this.getZaloEligibleTransactions();

        const offset = Number(
            configs.manualZaloOffset || 0
        );

        let runningTotal = offset;

        let upgradeDate =
            this.formatZaloDateKey(
                new Date()
            );

        for (
            const transaction of
            transactions
        ) {
            runningTotal +=
                Number(
                    transaction.amount
                ) || 0;

            if (
                runningTotal >=
                achievedRank.min
            ) {
                upgradeDate =
                    this.getLocalDateKey(
                        transaction.date
                    );

                break;
            }
        }

        configs.zaloCurrentRank =
            achievedRank.id;

        // Giữ tương thích dữ liệu cũ.
        configs.manualZaloRank =
            achievedRank.id;

        /*
         * Khi lên hạng, chu kỳ 6 tháng
         * mới bắt đầu ngay từ ngày lên hạng.
         */
        configs.zaloRankStartDate =
            upgradeDate;

        configs.zaloReviewDate =
            this.shiftZaloDateKey(
                upgradeDate,
                6,
                -1
            );

        configs.manualZaloAmount =
            null;

        configs.manualZaloOffset = 0;
        configs.zaloManualCount = 0;

        if (options.save !== false) {
            app.storage.save();
        }

        return {
            changed: true,
            previousRank: currentRank,
            currentRank: achievedRank,
            accumulated,
            upgradeDate,

            reviewDate:
                configs.zaloReviewDate
        };
    },

    checkAndRolloverZaloCycle(
        options = {}
    ) {
        const configs =
            app.data.configs;

        let changed =
            this.ensureZaloPriorityConfig();

        const todayKey =
            this.formatZaloDateKey(
                new Date()
            );

        let rolledCycles = 0;
        let lastCycleAmount = 0;

        let lastRank =
            this.getZaloRankInfo(
                0,
                configs.zaloCurrentRank
            );

        /*
         * Ngày xét hạng là ngày mở
         * chu kỳ mới.
         *
         * Chu kỳ cũ chỉ tính đến hết
         * ngày hôm trước.
         */
        while (
            todayKey >=
            configs.zaloReviewDate &&
            rolledCycles < 24
        ) {
            const oldReviewDate =
                configs.zaloReviewDate;

            const cutoffDate =
                this.shiftZaloDateKey(
                    oldReviewDate,
                    0,
                    -1
                );

            lastCycleAmount =
                this.getZaloAccumulation(
                    false,
                    {
                        startKey:
                            configs
                                .zaloRankStartDate,

                        endKey:
                            cutoffDate
                    }
                );

            /*
             * Đến ngày xét:
             * đủ mức nào thì giữ hoặc
             * chuyển về đúng mức đó.
             */
            lastRank =
                this.getZaloRankInfo(
                    lastCycleAmount
                );

            configs.zaloCurrentRank =
                lastRank.id;

            configs.manualZaloRank =
                lastRank.id;

            /*
             * Ngày xét hạng đồng thời là
             * ngày bắt đầu chu kỳ mới.
             *
             * Ví dụ:
             * 30/06 -> chu kỳ tiếp theo
             * xét ngày 30/12.
             */
            configs.zaloRankStartDate =
                oldReviewDate;

            configs.zaloReviewDate =
                this.shiftZaloDateKey(
                    oldReviewDate,
                    6,
                    0
                );

            configs.manualZaloAmount =
                null;

            configs.manualZaloOffset = 0;
            configs.zaloManualCount = 0;

            rolledCycles += 1;
            changed = true;
        }

        /*
         * Sau khi xử lý ngày xét,
         * kiểm tra tiếp khả năng nâng
         * hạng tức thì trong chu kỳ mới.
         */
        const upgradeResult =
            this.applyZaloInstantUpgrade({
                save: false
            });

        if (upgradeResult.changed) {
            changed = true;
        }

        if (
            changed &&
            options.save !== false
        ) {
            app.storage.save();
        }

        if (
            options.notify !== false
        ) {
            const messages = [];

            if (rolledCycles > 0) {
                messages.push(
                    `Đã xét ${rolledCycles} chu kỳ ZaloPay Priority.\n` +
                    `Tổng chu kỳ gần nhất: ${this.formatCurrency(lastCycleAmount)}\n` +
                    `Hạng sau xét: ${lastRank.name}\n` +
                    `Ngày xét tiếp theo: ${configs.zaloReviewDate}`
                );
            }

            if (
                upgradeResult.changed
            ) {
                messages.push(
                    `Đã nâng hạng ngay lên ${upgradeResult.currentRank.name}.\n` +
                    `Chu kỳ mới bắt đầu: ${upgradeResult.upgradeDate}\n` +
                    `Ngày xét tiếp theo: ${upgradeResult.reviewDate}`
                );
            }

            if (
                messages.length > 0
            ) {
                alert(
                    `🎉 ZALOPAY PRIORITY\n\n` +
                    messages.join('\n\n')
                );
            }
        }

        return {
            changed,
            rolledCycles,
            upgradeResult,

            currentRank:
                configs.zaloCurrentRank,

            startDate:
                configs.zaloRankStartDate,

            reviewDate:
                configs.zaloReviewDate
        };
    },

    getPaymentDate() {
        const now = new Date();
        const offsetMs = now.getTimezoneOffset() * 60000;
        // Luôn trả về thời gian thực tế lúc bấm nút thanh toán, 
        // không phụ thuộc vào bộ lọc filter.month đang xem.
        return (new Date(now.getTime() - offsetMs)).toISOString().slice(0, -1);
    },

    getBillingInfo(source, txDateStr) {
        const txDate = new Date(txDateStr);
        const sourceLower = String(source || '').toLowerCase();
        let dueResult = { dueDate: null, statementDate: null };

        if (
            sourceLower.includes('shopee') ||
            sourceLower.includes('spay') ||
            sourceLower.includes('airpay')
        ) {
            const day = txDate.getDate();

            // Chốt sao kê ngày 13 lúc 23:59:59.
            const statementCutoffDay = 13;

            // Hạn thanh toán ngày 1 của tháng tiếp theo.
            const dueDay = 3;

            let sMonth = txDate.getMonth();
            let sYear = txDate.getFullYear();

            if (day > statementCutoffDay) {
                sMonth++;
                if (sMonth > 11) { sMonth = 0; sYear++; }
            }

            // Dòng này đã tự động gán giờ là 23:59:59 cho ngày chốt sổ
            dueResult.statementDate = new Date(sYear, sMonth, statementCutoffDay, 23, 59, 59);

            let dMonth = sMonth + 1;
            let dYear = sYear;
            if (dMonth > 11) { dMonth = 0; dYear++; }

            dueResult.dueDate = new Date(dYear, dMonth, dueDay, 23, 59, 59);
            return dueResult;
        }

        if (sourceLower.includes('momo') || sourceLower.includes('ví trả sau')) {
            const dueMonth = txDate.getMonth() + 1;
            const dueYear = txDate.getFullYear() + (dueMonth > 11 ? 1 : 0);
            const normalizedDueMonth = dueMonth > 11 ? 0 : dueMonth;

            dueResult.statementDate = new Date(dueYear, normalizedDueMonth, 1, 0, 1, 0);
            dueResult.dueDate = new Date(dueYear, normalizedDueMonth, 5, 23, 59, 59);
            return dueResult;
        }

        if (sourceLower.includes('zalo') || sourceLower.includes('zalopay')) {
            const dueMonth = txDate.getMonth() + 1;
            const dueYear = txDate.getFullYear() + (dueMonth > 11 ? 1 : 0);
            const normalizedDueMonth = dueMonth > 11 ? 0 : dueMonth;

            dueResult.statementDate = new Date(dueYear, normalizedDueMonth, 1, 0, 0, 0);
            dueResult.dueDate = new Date(dueYear, normalizedDueMonth, 6, 23, 59, 59);
            return dueResult;
        }

        if (sourceLower.includes('tiktok')) {
            const day = txDate.getDate();
            const statementCutoffDay = 23; // Chốt sao kê ngày 23
            const dueDay = 10;             // Hạn trả ngày 10

            let sMonth = txDate.getMonth();
            let sYear = txDate.getFullYear();

            // Nếu ngày giao dịch phát sinh sau ngày 23, giao dịch đó sẽ tự động nhảy sang kỳ sao kê của tháng sau
            if (day > statementCutoffDay) {
                sMonth++;
                if (sMonth > 11) {
                    sMonth = 0;
                    sYear++;
                }
            }

            // Thiết lập Ngày chốt sao kê: Ngày 23 lúc 23:59:59
            dueResult.statementDate = new Date(sYear, sMonth, statementCutoffDay, 23, 59, 59);

            // Thiết lập Ngày đến hạn: Mùng 10 của tháng tiếp theo (Tháng liền sau kỳ sao kê)
            let dMonth = sMonth + 1;
            let dYear = sYear;
            if (dMonth > 11) {
                dMonth = 0;
                dYear++;
            }

            dueResult.dueDate = new Date(dYear, dMonth, dueDay, 23, 59, 59);
            return dueResult;
        }

        const dueMonth = txDate.getMonth() + 1;
        const dueYear = txDate.getFullYear() + (dueMonth > 11 ? 1 : 0);
        dueResult.statementDate = new Date(dueYear, dueMonth > 11 ? 0 : dueMonth, 1, 0, 0, 0);
        dueResult.dueDate = new Date(dueYear, dueMonth > 11 ? 0 : dueMonth, 5);
        return dueResult;
    },

    updateFees() {
        const month = app.data.filter.month;
        const feeMap = {
            zalo: { name: 'Phí dịch vụ Zalo Pay', amount: 20000 },
            momo: { name: 'Phí dịch vụ MoMo', amount: 33000 }
        };

        // --- 1. XỬ LÝ ZALO PAY ---
        const zaloFeeIndex = app.data.transactions.findIndex(t => t.place === feeMap.zalo.name && app.logic.isTransactionInMonth(t, month));

        const hasZaloSpending = app.data.transactions.some(t => {
            const s = String(t.source || '').toLowerCase();
            const isZaloCredit =
                app.logic.isZaloPayLaterSource(
                    t.source
                );
            const tags = t.tags || "";

            return t.type === 'Chi tiêu' &&
                app.logic.isTransactionInMonth(t, month) &&
                isZaloCredit &&
                t.status !== 'cancelled' &&
                t.status !== 'planned' &&
                !tags.includes('#phi_dich_vu') &&
                !tags.includes('#thanh_toan_no') &&
                !tags.includes('#tra_gop') &&
                !tags.includes('#du_no_chuyen_tiep') &&
                !tags.includes('#tat_toan_vay');
        });

        if (hasZaloSpending) {
            if (zaloFeeIndex !== -1) {
                if (app.data.transactions[zaloFeeIndex].status !== 'paid') {
                    app.data.transactions[zaloFeeIndex].amount = feeMap.zalo.amount;
                    app.data.transactions[zaloFeeIndex].note = 'Phí thu tạm thời (Sẽ hoàn nếu đủ chỉ tiêu)';
                }
            } else {
                app.data.transactions.push({
                    id: Date.now() + Math.random(),
                    type: 'Chi tiêu',
                    place: feeMap.zalo.name,
                    source: 'Trả sau Zalo Pay',
                    amount: feeMap.zalo.amount,
                    date: `${month}-01T12:00:00`,
                    tags: '#phi_dich_vu',
                    status: 'pending',
                    note: 'Phí thu tạm thời (Sẽ hoàn nếu đủ chỉ tiêu)'
                });
            }
        } else {
            if (zaloFeeIndex !== -1 && app.data.transactions[zaloFeeIndex].status !== 'paid') {
                app.data.transactions.splice(zaloFeeIndex, 1);
            }
        }

        // --- 2. XỬ LÝ MOMO ---
        const isCreditMomo = (s) => {
            const lower = s.toLowerCase();
            return lower.includes('momo') && (lower.includes('trả sau') || lower.includes('ví trả sau') || lower.includes('credit'));
        };

        const hasMomoInstallment = Object.values(app.data.installmentPlans || {}).some(plan =>
            isCreditMomo(String(plan.source || '')) && app.logic.getLocalMonthKey(plan.createdDate) === month
        );

        const hasMomoSpending = app.data.transactions.some(t => {
            const tags = t.tags || "";
            return t.type === 'Chi tiêu' &&
                app.logic.isTransactionInMonth(t, month) &&
                isCreditMomo(String(t.source || '')) &&
                t.status !== 'cancelled' &&
                !tags.includes('#phi_dich_vu') &&
                !tags.includes('#thanh_toan_no') &&
                !tags.includes('#tra_gop') &&
                !tags.includes('#du_no_chuyen_tiep') &&
                !tags.includes('#tra_no_vay');
        });

        const momoFeeIndex = app.data.transactions.findIndex(t => t.place === feeMap.momo.name && app.logic.isTransactionInMonth(t, month));

        if ((hasMomoSpending || hasMomoInstallment)) {
            if (momoFeeIndex === -1) {
                app.data.transactions.push({
                    id: Date.now() + Math.random(),
                    type: 'Chi tiêu',
                    place: feeMap.momo.name,
                    source: 'Ví Trả Sau MoMo',
                    amount: feeMap.momo.amount,
                    date: `${month}-01T09:00:00`,
                    tags: '#phi_dich_vu',
                    status: 'pending'
                });
            }
        } else {
            if (momoFeeIndex !== -1 && app.data.transactions[momoFeeIndex].status !== 'paid') {
                app.data.transactions.splice(momoFeeIndex, 1);
            }
        }
        app.storage.save();
    },

    restoreTransaction(originalId) {
        const originalTx = app.data.transactions.find(t => t.id === originalId);
        if (!originalTx) return;

        if (!confirm(`Tạo giao dịch MỚI dựa trên giao dịch này?\n(Ngày giờ sẽ tính là hiện tại)`)) return;

        const isCreditSource = s => {
            const lower = s.toLowerCase();
            return lower.includes('momo') || lower.includes('zalo') || lower.includes('trả sau') || lower.includes('tín dụng');
        };

        let newStatus = 'paid';
        if (originalTx.type === 'Thu nhập') {
            newStatus = 'paid';
        } else if (isCreditSource(originalTx.source)) {
            newStatus = 'pending';
        }

        const now = new Date();
        const offsetMs = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now.getTime() - offsetMs)).toISOString().slice(0, -1);

        const newTx = {
            ...originalTx,
            id: Date.now(),
            date: localISOTime,
            status: newStatus,
            place: 'Khôi phục ' + originalTx.place
        };
        delete newTx.forceStatementKey;

        app.data.transactions.push(newTx);
        app.storage.save();
        app.ui.renderAll();
        alert("Đã tạo giao dịch mới thành công vào Lịch sử giao dịch!");
    },

    processPriorityRefund() {
        const now = new Date();
        const prevDate = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1
        );
        const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        const refundTagKey = `#hoan_phi_zalo_${prevMonthStr.replace('-', '_')}`;

        const alreadyRefunded = app.data.transactions.some(t =>
            t.type === 'Thu nhập' && t.tags && t.tags.includes(refundTagKey)
        );
        if (alreadyRefunded) return;

        const paidFeeTx = app.data.transactions.find(t =>
            t.place === 'Phí dịch vụ Zalo Pay' &&
            app.logic.isTransactionInMonth(t, prevMonthStr) &&
            t.status === 'paid' &&
            t.amount >= 20000
        );

        if (!paidFeeTx) return;

        const prevSpending = app.data.transactions.reduce((sum, t) => {
            const isCreditZalo =
                app.logic.isZaloPayLaterSource(
                    t.source
                );
            const tags = t.tags || '';

            if (t.type === 'Chi tiêu' && app.logic.isTransactionInMonth(t, prevMonthStr) && isCreditZalo &&
                t.status !== 'cancelled' &&
                t.status !== 'planned' &&
                !tags.includes('#phi_dich_vu') && !tags.includes('#thanh_toan_no') &&
                !tags.includes('#du_no_chuyen_tiep') && !tags.includes('#tra_gop')) {
                return sum + t.amount;
            }
            return sum;
        }, 0);

        const rankInfo =
            app.logic.getZaloRankInfo(
                0,
                app.data.configs.zaloCurrentRank
            );

        let refundAmount = 0;
        const threshold = 2500000;

        if (prevSpending >= threshold) {
            if (rankInfo.id === 'diamond') refundAmount = 20000;
            else if (rankInfo.id === 'gold') refundAmount = 10000;
        }

        if (refundAmount > 0) {
            app.data.transactions.push({
                id: Date.now(),
                type: 'Thu nhập',
                place: 'Hoàn phí DV Priority',
                source: 'Hoàn tiền Zalo Pay',
                amount: refundAmount,
                date: new Date().toISOString(),
                tags: `#hoan_tien_dich_vu ${refundTagKey}`,
                status: 'paid',
                note: `Hoàn phí tháng ${prevMonthStr} (Tiêu: ${app.logic.formatCurrency(prevSpending)} - Hạng: ${rankInfo.name})`
            });

            app.storage.save();
            setTimeout(() => {
                alert(`💰 THÔNG BÁO TỪ ZALO PRIORITY\n\nBạn đã đạt điều kiện chi tiêu tháng ${prevMonthStr}.\nHệ thống đã tự động hoàn lại: ${app.logic.formatCurrency(refundAmount)} phí dịch vụ.`);
            }, 1000);
        }
    },

    consultLawyer(tx) {
        const key = app.data.configs.apiKeys.gemini;
        if (!key) return alert("Cần nhập Gemini API Key trong Cấu hình để thuê luật sư!");

        const modal = document.getElementById('modal-lawyer');
        const contentEl = document.getElementById('lawyer-result');

        modal.classList.add('active');
        contentEl.innerHTML = '<div style="text-align:center"><i class="fa-solid fa-spinner fa-spin"></i> Đang nghiên cứu hồ sơ...<br><small>(Đang bịa lý do hợp lý nhất)</small></div>';

        const prompt = `
                    Bạn là một "Luật sư Tài chính" hài hước, thông minh và hơi "lươn lẹo". 
                    Khách hàng của bạn vừa chi tiêu khoản này:
                    - Món đồ: "${tx.place}"
                    - Giá tiền: ${app.logic.formatCurrency(tx.amount)}
                    - Thời gian: ${tx.date}
                    
                    Nhiệm vụ: Hãy viết một đoạn văn ngắn (khoảng 2-3 câu) để BÀO CHỮA cho khoản chi tiêu này khi bị vợ/chồng/phụ huynh tra hỏi.
                    
                    Yêu cầu:
                    1. Biến món đồ vô bổ thành "khoản đầu tư chiến lược", "công cụ lao động thiết yếu" hoặc "nghiên cứu thị trường".
                    2. Dùng từ ngữ nghe có vẻ chuyên môn, kinh tế vĩ mô, hoặc công nghệ cao (tech jargon) để lòe người nghe.
                    3. Giọng văn: Nghiêm túc "giả trân", thuyết phục nhưng hài hước.
                    
                    Ví dụ: Mua máy PS5 -> "Đây là trạm xử lý đồ họa mô phỏng thực tế ảo, phục vụ nghiên cứu xu hướng Metaverse tiềm năng."
                    Ví dụ: Đi nhậu -> "Hội thảo kết nối đối tác chiến lược phi lợi nhuận nhằm mở rộng mạng lưới quan hệ xã hội (Networking)."
                `;

        (async () => {
            try {
                // ĐÃ SỬA: Thay đổi endpoint thành gemini-1.5-flash ổn định
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                if (!res.ok) throw new Error("Luật sư đang bận họp (Lỗi gọi API đến máy chủ).");
                const data = await res.json();
                const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không tìm thấy lý do bào chữa.";

                contentEl.innerHTML = '';
                let i = 0;
                const typeWriter = setInterval(() => {
                    contentEl.textContent += reply.charAt(i);
                    i++;
                    if (i > reply.length - 1) {
                        clearInterval(typeWriter);
                        contentEl.classList.remove('typing-effect');
                    }
                }, 20);
                contentEl.classList.add('typing-effect');

            } catch (e) {
                contentEl.innerHTML = `<span style="color:red">Lỗi: ${e.message}</span>`;
            }
        })();
    },

    // --- [CẬP NHẬT] ĐỒNG BỘ LOGIC TÍNH NGÂN SÁCH NGÀY ---
    calcDailyBudgetState() {
        const currentMonth = app.data.filter.month;
        const limit = Number(app.data.configs.monthlyLimits?.[currentMonth]) || 0;

        const now = new Date();
        const todayStr = this.getLocalDateKey(now);
        const [y, m] = currentMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const currentDay = now.getDate();

        const daysLeft = Math.max(1, daysInMonth - currentDay + 1);
        const budgetIncome = this.getBudgetIncomeTotal(currentMonth);

        const budgetTxs = this.getBudgetTransactions();
        const totalSpentMonthBeforeToday = budgetTxs.reduce((sum, t) => {
            if (this.getLocalDateKey(t.date) === todayStr) return sum;
            return sum + (Number(t.amount) || 0);
        }, 0);

        // [FIX] Khả dụng để chia cho số ngày = Tổng sức mua - Số đã tiêu (BỎ việc trừ khoản nợ của tương lai)
        const capacity = Math.max(limit, budgetIncome);
        const availableForRemainingDays = capacity - totalSpentMonthBeforeToday;

        const dailyCap = availableForRemainingDays > 0 ? availableForRemainingDays / daysLeft : 0;

        const todayTxs = budgetTxs.filter(t => this.getLocalDateKey(t.date) === todayStr);
        const countedTodayTxs = todayTxs.filter(t => t.excludeFromBudget !== true && t.excludeFromDailyBudget !== true);

        const todaySpent = countedTodayTxs.reduce(
            (sum, t) => sum + this.getTransactionBudgetAmount(t), 0
        );

        const availableNow = availableForRemainingDays - todaySpent;

        return {
            limit,
            limitCredit: 0,
            budgetIncome,
            dailyCap: Math.round(dailyCap),
            todaySpent,
            surplus: Math.round(dailyCap - todaySpent),
            available: availableNow,
            daysFunded: Math.max(0, Math.floor(availableNow / (limit / daysInMonth || 1))),
            status: availableNow < 0 ? 'broke' : 'ok',
            todayTxs,
            countedTodayTxs
        };
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
        const projectedDebtBudget = Number(upcomingData.budgetTotal) || 0;
        const budgetIncome = app.logic.getBudgetIncomeTotal(currentMonth);

        // Sức chứa của thanh tiến độ: Lấy Hạn mức làm chuẩn. Nếu thu nhập thật vượt hạn mức, thanh tự giãn ra.
        const progressCapacity = Math.max(limit, budgetIncome);
        const totalUsed = totalExpense + projectedDebtBudget;
        const remain = progressCapacity - totalUsed;

        const actualPercent = progressCapacity > 0 ? Math.min(100, (totalExpense / progressCapacity) * 100) : 0;
        let projectedPercent = progressCapacity > 0 ? (projectedDebtBudget / progressCapacity) * 100 : 0;
        if (actualPercent + projectedPercent > 100) projectedPercent = Math.max(0, 100 - actualPercent);

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

        const statusEl = document.getElementById('budget-status');
        const remainEl = document.getElementById('budget-remain');

        barProjected.style.backgroundColor = '#cbd5e1';

        if (remain < 0) {
            barActual.classList.add('budget-overload');
            barActual.style.backgroundColor = '#ef4444';
            barProjected.style.backgroundColor = '#fca5a5';
            statusEl.innerHTML = `<span style="color:var(--danger); font-weight:800"><i class="fa-solid fa-bomb"></i> VỠ KẾ HOẠCH!</span>`;
            remainEl.innerHTML = `Thâm hụt: <b style="color:var(--danger)">${app.logic.formatCurrency(Math.abs(remain))}</b>`;
        } else if (remain < 100000) {
            barActual.classList.add('danger');
            barProjected.style.backgroundColor = '#fdba74';
            statusEl.innerHTML = `<span style="color:var(--danger); font-weight:700">SẮP CẠN VÍ!</span>`;
            remainEl.innerHTML = `Khả dụng: <b style="color:var(--danger)">${app.logic.formatCurrency(remain)}</b>`;
        } else if (progressCapacity > 0 && (totalUsed / progressCapacity) > 0.8) {
            barActual.classList.add('warning');
            barProjected.style.backgroundColor = '#fde047';
            statusEl.innerHTML = `<span style="color:var(--warning); font-weight:700">Cẩn thận!</span>`;
            remainEl.innerHTML = `Khả dụng: <b style="color:var(--warning)">${app.logic.formatCurrency(remain)}</b>`;
        } else {
            barProjected.style.backgroundColor = '#86efac';
            statusEl.innerHTML = `<span style="color:var(--success); font-weight:700">Ổn định</span>`;
            remainEl.innerHTML = `Khả dụng: <b style="color:var(--success)">${app.logic.formatCurrency(remain)}</b>`;
        }

        // Giao diện tinh gọn, không còn bảng so khớp
        let incomeHtml = `
            <div>Hạn mức tháng: <b style="color:var(--primary)">${app.logic.formatCurrency(limit)}</b></div>
            ${budgetIncome > limit ? `
            <div>
                Thu nhập vượt hạn mức: <b style="color:var(--success)">+${app.logic.formatCurrency(budgetIncome - limit)}</b>
            </div>` : (budgetIncome > 0 ? `
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                Đã thu: ${app.logic.formatCurrency(budgetIncome)} / ${app.logic.formatCurrency(limit)}
            </div>` : '')}
        `;

        document.getElementById('budget-used').innerHTML = `
            ${incomeHtml}
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top: 6px;">
                Đã tiêu: <b>−${app.logic.formatCurrency(totalExpense)}</b>
                ${projectedDebtBudget > 0 ? `<span> | Sắp đến hạn: ${app.logic.formatCurrency(projectedDebtBudget)} </span>` : ''}
            </div>
        `;
    },

    calculateScore() {
        let baseScore = 600;
        if (!app.data.cicRecords || app.data.cicRecords.length === 0) return { score: baseScore, rank: 'N/A' };

        const totalImpact = app.data.cicRecords.reduce((sum, r) => sum + r.scoreImpact, 0);

        const currentDebt = app.ui.renderUpcomingDebts ? app.logic.getUpcomingDebts().total : 0;
        const utilizationImpact = currentDebt > 10000000 ? -20 : 0;

        let finalScore = baseScore + totalImpact + utilizationImpact;

        if (finalScore > 850) finalScore = 850;
        if (finalScore < 300) finalScore = 300;

        let rank = 'Hạng Chuẩn';
        let color = '#3b82f6';
        if (finalScore >= 750) { rank = 'Hạng Tốt (Rất uy tín)'; color = '#10b981'; }
        else if (finalScore >= 650) { rank = 'Hạng Khá'; color = '#0ea5e9'; }
        else if (finalScore >= 550) { rank = 'Trung Bình'; color = '#eab308'; }
        else if (finalScore >= 450) { rank = 'Rủi Ro Thấp'; color = '#f97316'; }
        else { rank = 'Nợ Xấu / Rủi Ro Cao'; color = '#ef4444'; }

        return { score: finalScore, rank, color };
    },
    // ... (các hàm bên trên giữ nguyên)

    calculateBankBalance(account) {
        // 1. Lấy số dư khởi tạo
        let currentBalance = account.initialBalance || 0;

        // 2. Cấu hình ngày chốt sổ
        const CUTOFF_DATE_STR = "2026-01-28T00:00:00";
        const cutoffTime = new Date(CUTOFF_DATE_STR).getTime();

        // 3. Duyệt qua giao dịch
        app.data.transactions.forEach(t => {
            if (t.status !== 'paid') return;

            const txTime = new Date(t.date).getTime();
            if (txTime < cutoffTime) return;

            // --- [FIX LỖI] THÊM ( || "" ) ĐỂ TRÁNH CRASH NẾU DỮ LIỆU BỊ THIẾU ---
            const bankName = (account.bankName || "").toLowerCase().trim();
            const source = (t.source || "").toLowerCase().trim();
            const dest = (t.destination || "").toLowerCase().trim();

            // Trừ tiền
            if (source === bankName) {
                currentBalance -= t.amount;
            }

            // Cộng tiền
            if (dest === bankName) {
                currentBalance += t.amount;
            }
        });

        return currentBalance;
    },

    calculateWalletBalance(wallet) {
        // Nếu là ví trả sau có hạn mức, bắt đầu từ hạn mức + số dư ban đầu
        let currentBalance = (wallet.initialBalance || 0) + (wallet.creditLimit || 0);
        const CUTOFF_DATE = new Date("2026-01-28T00:00:00").getTime();

        app.data.transactions.forEach(t => {
            if (t.status !== 'paid') return;

            const txTime = new Date(t.date).getTime();
            if (txTime < CUTOFF_DATE) return;

            const wName = (wallet.walletName || "").toLowerCase().trim();
            const source = (t.source || "").toLowerCase().trim();
            const dest = (t.destination || "").toLowerCase().trim();

            // Chi tiêu từ ví này -> Trừ vào hạn mức/số dư
            if (source === wName) {
                currentBalance -= t.amount;
            }

            // Hoàn tiền hoặc Thu nhập vào ví này -> Cộng lại vào hạn mức/số dư
            if (dest === wName) {
                currentBalance += t.amount;
            }
        });

        return currentBalance;
    },

    purgeOldData() {
        return;
        const now = new Date();
        // Lấy mốc 2 năm trước (Ví dụ: nay là T2/2026 -> mốc là T2/2024)
        const cutoffDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
        const cutoffMonthStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}`;

        const initialLength = app.data.transactions.length;

        // Lọc giữ lại những giao dịch từ mốc 2 năm trở lại đây
        app.data.transactions = app.data.transactions.filter(t => {
            if (!t.date || t.date.length < 7) return true; // Giữ lại nếu bị lỗi định dạng ngày
            const txMonth = t.date.substring(0, 7); // Lấy dạng YYYY-MM
            return txMonth >= cutoffMonthStr;
        });

        // Nếu có dữ liệu bị xóa đi thì lưu lại
        if (app.data.transactions.length < initialLength) {
            console.log(`[Auto-Clean] Đã tự dọn dẹp ${initialLength - app.data.transactions.length} giao dịch cũ hơn 2 năm (trước ${cutoffMonthStr}).`);
            app.storage.save();
        }
    },

    fixAllTags() {
        let fixedCount = 0;

        // Quét trực tiếp toàn bộ Database (Sửa luôn cả các giao dịch ĐÃ BỊ KHÓA)
        app.data.transactions.forEach(t => {
            if (t.tags && t.tags.includes('#')) {
                const oldTags = t.tags;

                // Thuật toán tìm các cụm bắt đầu bằng # và nối khoảng trắng bên trong bằng _
                const newTags = oldTags.replace(/#[^#]+/g, match => {
                    let cleaned = match.trim();

                    // Nếu có dấu phẩy ở cuối thì tách ra tạm
                    const hasComma = cleaned.endsWith(',');
                    if (hasComma) cleaned = cleaned.slice(0, -1).trim();

                    // Thay thế toàn bộ khoảng trắng bằng dấu gạch dưới
                    cleaned = cleaned.replace(/\s+/g, '_');

                    // Ghép lại dấu phẩy và khoảng trắng để cách các tag
                    return cleaned + (hasComma ? ', ' : ' ');
                }).trim();

                // Nếu phát hiện có thay đổi thì lưu lại tag mới
                if (oldTags !== newTags) {
                    t.tags = newTags;
                    fixedCount++;
                }
            }
        });

        // Tự động lưu ngầm nếu có sửa đổi
        if (fixedCount > 0) {
            console.log(`[Auto-Fix Tag] Đã tự động điền dấu '_' cho ${fixedCount} giao dịch.`);
            app.storage.save();
        }
    }
};
