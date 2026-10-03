// Quy tắc nghiệp vụ dùng chung cho form, số dư và nhập dữ liệu.
app.rules = {
    normalizeName(value) { return String(value || '').trim().toLocaleLowerCase('vi-VN'); },

    money(value, label = 'Số tiền') {
        const amount = Number(value);
        if (!Number.isSafeInteger(amount) || amount < 0) {
            throw new Error(`${label} phải là số nguyên không âm trong giới hạn an toàn.`);
        }
        return amount;
    },

    // Thu nhập cũ lưu nơi nhận ở source. Trả nợ cũ lưu chủ nợ ở source.
    flow(transaction) {
        let source = String(transaction.source || '').trim();
        let destination = String(transaction.destination || '').trim();
        if (!destination && transaction.type === 'Thu nhập') {
            destination = source;
            source = 'Bên ngoài';
        } else if (!destination && /#(thanh_toan_no|tra_gop|nop_phat|thanh_toan_phi|tat_toan_vay|tra_no_vay)\b/.test(String(transaction.tags || ''))) {
            destination = source;
            source = 'Tiền mặt';
        }
        return { source, destination };
    },

    direction(transaction, name) {
        const target = this.normalizeName(name);
        if (!target) return 0;
        const flow = this.flow(transaction);
        return Number(this.normalizeName(flow.destination) === target) -
            Number(this.normalizeName(flow.source) === target);
    },

    balanceStart(account, kind = 'bank') {
        const date = account.balanceAsOf || account.createdAt;
        const time = date ? new Date(date).getTime() : NaN;
        // Giữ mốc tương thích cho bản ghi cũ không có ngày tạo.
        return Number.isFinite(time) ? time : kind === 'cash' ? 0 : new Date('2026-01-28T00:00:00').getTime();
    },

    balance(account, kind = 'bank') {
        const name = account.bankName || account.walletName || account.name;
        let balance = Number(account.initialBalance) || 0;
        if (kind === 'wallet') balance += Number(account.initialCreditAvailable ?? account.creditLimit) || 0;
        const start = this.balanceStart(account, kind);
        for (const transaction of app.data.transactions) {
            const time = new Date(transaction.date).getTime();
            if (transaction.status !== 'paid' || !Number.isFinite(time) || time < start) continue;
            // Chính sách Liobank cũ được áp dụng cả trên báo cáo và màn hình chi tiết.
            if (kind === 'bank' && this.normalizeName(name).includes('liobank') && transaction.isInterest === true) continue;
            const amount = Number(transaction.amount);
            if (Number.isFinite(amount)) balance += this.direction(transaction, name) * amount;
        }
        return balance;
    },

    createdTime(transaction) {
        const explicit = Date.parse(transaction.createdAt || '');
        if (Number.isFinite(explicit)) return explicit;
        const legacyId = Number(transaction.id);
        // ID mẫu / ID Excel nhỏ không phải thời điểm tạo.
        if (Number.isFinite(legacyId) && legacyId >= 946684800000 && legacyId <= 8640000000000000) return legacyId;
        const date = Date.parse(transaction.date || '');
        return Number.isFinite(date) ? date : 0;
    },

    lockDuration(transaction) {
        return (String(transaction.tags || '').includes('#hoan_tien') ? 1 : 3) * 86400000;
    },

    isLocked(transaction, now = Date.now()) {
        if (['planned', 'pending'].includes(transaction.status)) return false;
        return now >= this.createdTime(transaction) + this.lockDuration(transaction);
    },

    loanDueDate(startDate, period) {
        const start = new Date(startDate);
        if (!Number.isFinite(start.getTime()) || !Number.isInteger(period) || period < 1) throw new Error('Lịch vay không hợp lệ.');
        // Giữ quy tắc hiện hữu khi tạo và migrate khoản vay: kỳ đầu T+2, ngày 7.
        return new Date(start.getFullYear(), start.getMonth() + period + 1, 7).toLocaleDateString('vi-VN');
    },

    validateTransaction(transaction) {
        this.money(transaction.amount);
        if (!['Thu nhập', 'Chi tiêu', 'Chuyển tiền', 'Trả nợ'].includes(transaction.type)) throw new Error('Loại giao dịch không hợp lệ.');
        if (!['paid', 'pending', 'planned', 'cancelled'].includes(transaction.status)) throw new Error('Trạng thái giao dịch không hợp lệ.');
        if (!Number.isFinite(Date.parse(transaction.date))) throw new Error('Ngày giao dịch không hợp lệ.');
        for (const field of ['place', 'source', 'destination', 'tags', 'brand', 'refId', 'orderCode']) {
            if (transaction[field] != null && typeof transaction[field] !== 'string') throw new Error(`Trường ${field} phải là văn bản.`);
        }
        return transaction;
    },

    legacyCashbacks(transaction) {
        if (!transaction?.isCashback || transaction.cashbackLinkReviewed) return [];
        return app.data.transactions.filter(t =>
            t.cashbackForId == null && t.type === 'Thu nhập' && t.tags === '#hoan_tien' &&
            t.source === `Ngân hàng ${transaction.source}` && t.date === transaction.date &&
            Number(t.amount) === Number(transaction.discountAmount) &&
            String(t.place || '').startsWith('Tiền hoàn giao dịch '));
    },

    checkCashbackEdit(previous) {
        if (this.legacyCashbacks(previous).length > 1) {
            throw new Error('Có nhiều khoản hoàn cũ trùng nhau. Hãy đối soát các khoản hoàn trước khi sửa giao dịch này.');
        }
    },

    // Khoản hoàn tự động có liên kết rõ ràng, mỗi giao dịch chỉ có một khoản.
    syncCashback(transaction, previous = null) {
        const linked = app.data.transactions.filter(t => t.cashbackForId != null &&
            [String(transaction.id), String(previous?.id)].includes(String(t.cashbackForId)));
        let existing = linked[0];
        // Chỉ nhận diện dữ liệu cũ khi khớp duy nhất; không tự xóa các khoản thu mơ hồ.
        if (!existing && previous?.isCashback && !previous.cashbackLinkReviewed) {
            const candidates = this.legacyCashbacks(previous);
            if (candidates.length === 1) existing = candidates[0];
            else if (candidates.length > 1) throw new Error('Có nhiều khoản hoàn cũ trùng nhau. Hãy đối soát các khoản hoàn trước khi sửa giao dịch này.');
        }
        const active = transaction.isCashback && Number(transaction.discountAmount) > 0;
        if (!active) {
            app.data.transactions = app.data.transactions.filter(t => t !== existing && !linked.includes(t));
            transaction.cashbackLinkReviewed = true;
            return;
        }
        const cashback = {
            ...(existing || {}),
            id: existing?.id ?? this.newTransactionId(),
            createdAt: existing?.createdAt || new Date().toISOString(),
            cashbackForId: transaction.id,
            type: 'Thu nhập', amount: Number(transaction.discountAmount),
            status: transaction.status, date: transaction.date,
            place: `Tiền hoàn giao dịch ${transaction.refId || transaction.id}`,
            source: 'Hoàn tiền', destination: transaction.source,
            tags: '#hoan_tien', isCashback: false, discountAmount: 0,
            isUnknownTime: Boolean(transaction.isUnknownTime)
        };
        app.data.transactions = app.data.transactions.filter(t => t !== existing && !linked.includes(t));
        app.data.transactions.push(cashback);
        transaction.cashbackLinkReviewed = true;
    },

    newTransactionId() {
        let id = Date.now();
        while (app.data.transactions.some(t => String(t.id) === String(id))) id++;
        return id;
    },

    removeTransaction(id) {
        app.data.transactions = app.data.transactions.filter(t => String(t.id) !== String(id) && String(t.cashbackForId) !== String(id));
    }
};
