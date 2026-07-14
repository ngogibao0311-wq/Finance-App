app.logic = {
    formatCurrency(amount) {
        if (app.data.configs.guestMode) return '**** ₫';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    },

    getFilteredTxs() {
        let filteredTxs = app.data.transactions.filter(t => t.date.startsWith(app.data.filter.month));

        return filteredTxs.sort((a, b) => {
            const dayA = new Date(a.date).toISOString().slice(0, 10);
            const dayB = new Date(b.date).toISOString().slice(0, 10);

            if (dayA !== dayB) return new Date(b.date) - new Date(a.date);

            // Đưa Không rõ giờ xuống cuối ngày
            if (a.isUnknownTime && !b.isUnknownTime) return 1;
            if (!a.isUnknownTime && b.isUnknownTime) return -1;

            return new Date(b.date) - new Date(a.date) || b.id - a.id;
        });
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
    getBudgetTransactions() {
        const month = app.data.filter.month;
        return app.data.transactions.filter(t => {
            // 1. Bộ lọc cơ bản (Tháng, Loại, Trạng thái, Loại trừ thủ công)
            if (!t.date.startsWith(month)) return false;
            if (t.type === 'Chuyển tiền') return false;
            if (t.type !== 'Chi tiêu') return false;
            if (t.status !== 'paid') return false;
            if (t.excludeFromBudget === true) return false;

            const tags = (t.tags || "").toLowerCase();
            const s = t.source.toLowerCase();

            // 2. [QUAN TRỌNG - TÍNH VÀO NGÂN SÁCH] Các khoản THANH TOÁN NỢ
            // Bao gồm: Trả gốc (#thanh_toan_no), Phí (#thanh_toan_phi), Phạt (#nop_phat), Trả góp (#tra_gop), Tất toán vay (#tat_toan_vay)
            const isDebtPayment =
                tags.includes('#thanh_toan_no') ||
                tags.includes('#thanh_toan_phi') ||
                tags.includes('#nop_phat') ||
                tags.includes('#tra_gop') ||
                tags.includes('#tat_toan_vay') ||
                tags.includes('#tra_no_vay');

            if (isDebtPayment) return true;

            // 3. [QUAN TRỌNG - KHÔNG TÍNH] Các khoản CHI TIÊU TÍN DỤNG GỐC
            // (Vì chúng ta đã tính tiền lúc trả nợ ở Bước 2 rồi, nếu tính thêm ở đây sẽ bị trùng lặp)
            const isCreditSource =
                (s.includes('zalo') && (s.includes('trả sau') || s.includes('priority') || s.includes('paylater'))) ||
                (s.includes('momo') && (s.includes('trả sau') || s.includes('ví trả sau') || s.includes('credit'))) ||
                (s.includes('shopee') || s.includes('spay') || s.includes('airpay')) ||
                (s.includes('tiktok')) ||
                (s.includes('tín dụng') || s.includes('thẻ') || s.includes('credit')); // Thẻ tín dụng chung

            // Nếu là nguồn tín dụng và KHÔNG phải là giao dịch thanh toán nợ (đã check ở trên) -> BỎ QUA
            if (isCreditSource) return false;

            // 4. Loại trừ các khoản trung gian/nội bộ
            if (tags.includes('#da_chuyen_tra_gop')) return false;
            if (tags.includes('#du_no_chuyen_tiep')) return false;

            // 5. Còn lại (Tiền mặt, Bank thường...) -> TÍNH VÀO NGÂN SÁCH
            return true;
        });
    },

    getUpcomingDebts() {
        // 1. Xác định khung thời gian
        const filterMonthStr = app.data.filter.month;
        const [y, m] = filterMonthStr.split('-').map(Number);
        const nextMonthDate = new Date(y, m, 1); // Ngày 1 của tháng kế tiếp (Tháng ngân sách)
        const displayNextMonth = `${nextMonthDate.getMonth() + 1}/${nextMonthDate.getFullYear()}`;

        let budgetPendingTotal = 0;
        let items = [];
        const now = new Date();
        const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // 2. Lấy tất cả giao dịch Pending
        const allPendingTxs = app.data.transactions.filter(t => {
            if (t.status !== 'pending') return false;
            return t.date.substring(0, 7) <= filterMonthStr;
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
                    const s = t.source.toLowerCase();
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
                    const s = t.source.toLowerCase();
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
                    if (plan.source.toLowerCase().includes('momo')) {
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
            const s = t.source.toLowerCase();
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
                const brandLower = (t.brand || '').toLowerCase();
                const tagsLower = (t.tags || '').toLowerCase();

                const isShopeeFood = brandLower.includes('shopeefood');
                const isService = tagsLower.includes('#nạp tiền') ||
                    tagsLower.includes('#nạp thẻ') ||
                    tagsLower.includes('dịch vụ') ||
                    tagsLower.includes('quét qr');

                let fee = 0;
                if (isShopeeFood || isService) {
                    fee = Math.round(t.amount * 0.0295);
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
        const tiktokTxs = allPendingTxs.filter(t => t.source.toLowerCase().includes('tiktok'));

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
                const brandLower = String(
                    t.brand || ''
                ).toLowerCase();

                const tagsLower = String(
                    t.tags || ''
                ).toLowerCase();

                const isShopeeFood =
                    brandLower.includes('shopeefood');

                const isService =
                    tagsLower.includes('#nạp tiền') ||
                    tagsLower.includes('#nạp thẻ') ||
                    tagsLower.includes('dịch vụ') ||
                    tagsLower.includes('quét qr');

                if (isShopeeFood || isService) {
                    fee = Math.round(amount * 0.0295);
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
                        dueDay: 2
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

        return {
            total: budgetPendingTotal,
            displayTotal: items.reduce((sum, i) => sum + i.amount + (i.penalty || 0), 0),
            items,
            monthLabel: displayNextMonth
        };
    },

    normalizeSource(source) {
        const s = source.toLowerCase();
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
    getInstallmentRate(months, source = '') {
        const s = source.toLowerCase();
        if (s.includes('shopee') || s.includes('spay') || s.includes('airpay')) {
            return 0.0295;
        }
        return 0.03 * parseInt(months);
    },
    getZaloAccumulation(ignoreManual = false) {
        const reviewDate = new Date(app.data.configs.zaloReviewDate);
        const startDate = new Date(reviewDate);
        startDate.setMonth(startDate.getMonth() - 6);

        const currentRealSum = app.data.transactions.reduce((sum, t) => {
            const tDate = new Date(t.date);
            const s = t.source.toLowerCase();
            const tags = t.tags || "";
            const isValid = t.type === 'Chi tiêu' &&
                (t.status !== 'cancelled' || t.keepForZalo === true) &&
                t.status !== 'planned' &&
                s.includes('zalo') &&
                t.skipZalo !== true &&
                !tags.includes('#du_no_chuyen_tiep') &&
                !tags.includes('#thanh_toan_no') &&
                !tags.includes('#tra_gop') &&
                !tags.includes('#tat_toan_vay') &&
                (tDate >= startDate && tDate <= reviewDate);

            if (isValid) {
                return sum + t.amount;
            }
            return sum;
        }, 0);

        if (ignoreManual) return currentRealSum;
        const offset = Number(app.data.configs.manualZaloOffset || 0);
        return currentRealSum + offset;
    },
    getZaloRankInfo(amount, manualRankOverride = null) {
        const ranks = {
            'diamond': { id: 'diamond', name: 'Kim Cương', color: 'var(--rank-diamond)', fee: 20000, next: null, min: 60000000, order: 4 },
            'gold': { id: 'gold', name: 'Vàng', color: 'var(--rank-gold)', fee: 20000, next: 60000000, min: 18000000, order: 3 },
            'silver': { id: 'silver', name: 'Bạc', color: 'var(--rank-silver)', fee: 20000, next: 18000000, min: 3000000, order: 2 },
            'member': { id: 'member', name: 'Thành viên', color: '#3f3f46', fee: 20000, next: 3000000, min: 0, order: 1 }
        };

        if (manualRankOverride && ranks[manualRankOverride]) {
            return ranks[manualRankOverride];
        }

        if (amount >= 60000000) return ranks['diamond'];
        if (amount >= 18000000) return ranks['gold'];
        if (amount >= 3000000) return ranks['silver'];
        return ranks['member'];
    },
    getZaloRetentionState() {
        const currentAccumulated = app.logic.getZaloAccumulation(false);
        const baseRankInfo = app.logic.getZaloRankInfo(currentAccumulated, app.data.configs.manualZaloRank);
        const realRankInfo = app.logic.getZaloRankInfo(currentAccumulated, null);

        let effectiveRank = baseRankInfo;
        if (realRankInfo.order > baseRankInfo.order) {
            effectiveRank = realRankInfo;
        }

        let status = 'keep';
        let missing = 0;

        if (realRankInfo.order < baseRankInfo.order) {
            status = 'drop';
            missing = baseRankInfo.min - currentAccumulated;
        } else if (realRankInfo.order > baseRankInfo.order) {
            status = 'upgraded';
        }

        return {
            currentRank: effectiveRank,
            projectedRank: realRankInfo,
            totalAccumulated: currentAccumulated,
            status: status,
            missing: missing
        };
    },
    checkAndRolloverZaloCycle() {
        const today = new Date();
        const reviewDate = new Date(app.data.configs.zaloReviewDate);

        if (today > reviewDate) {
            const finalAccumulated = app.logic.getZaloAccumulation();
            let achievedRankId = 'member';
            if (finalAccumulated >= 60000000) achievedRankId = 'diamond';
            else if (finalAccumulated >= 18000000) achievedRankId = 'gold';
            else if (finalAccumulated >= 3000000) achievedRankId = 'silver';

            app.data.configs.manualZaloRank = achievedRankId;

            const nextReview = new Date(reviewDate);
            nextReview.setMonth(nextReview.getMonth() + 6);
            app.data.configs.zaloReviewDate = nextReview.toISOString().split('T')[0];

            app.data.configs.manualZaloAmount = 0;

            app.storage.save();
            alert(`🎉 CHÚC MỪNG!\nĐã kết thúc chu kỳ xét hạng Zalo Priority.\n\n- Tổng chi tiêu: ${app.logic.formatCurrency(finalAccumulated)}\n- Hạng mới: ${achievedRankId.toUpperCase()}\n- Ngày xét hạng tới: ${app.data.configs.zaloReviewDate}`);
        }
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
        const sourceLower = source.toLowerCase();
        let dueResult = { dueDate: null, statementDate: null };

        if (sourceLower.includes('shopee') || sourceLower.includes('spay')) {
            const day = txDate.getDate();

            // SỬA TẠI ĐÂY: Đổi 14 thành 13
            const statementCutoffDay = 13;

            const dueDay = 2;

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
            const dueMonth = txDate.getMonth() + 1;
            const dueYear = txDate.getFullYear() + (dueMonth > 11 ? 1 : 0);
            const normalizedDueMonth = dueMonth > 11 ? 0 : dueMonth;

            dueResult.statementDate = new Date(dueYear, normalizedDueMonth, 1, 0, 0, 0);
            dueResult.dueDate = new Date(dueYear, normalizedDueMonth, 10, 23, 59, 59);
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
        const zaloFeeIndex = app.data.transactions.findIndex(t => t.place === feeMap.zalo.name && t.date.startsWith(month));

        const hasZaloSpending = app.data.transactions.some(t => {
            const s = t.source.toLowerCase();
            const isZaloCredit = s.includes('zalo') && (s.includes('trả sau') || s.includes('priority') || s.includes('paylater'));
            const tags = t.tags || "";

            return t.type === 'Chi tiêu' &&
                t.date.startsWith(month) &&
                isZaloCredit &&
                t.status !== 'cancelled' &&
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

        const hasMomoInstallment = Object.values(app.data.installmentPlans || {}).some(plan => isCreditMomo(plan.source) && plan.createdDate.startsWith(month));

        const hasMomoSpending = app.data.transactions.some(t => {
            const tags = t.tags || "";
            return t.type === 'Chi tiêu' &&
                t.date.startsWith(month) &&
                isCreditMomo(t.source) &&
                t.status !== 'cancelled' &&
                !tags.includes('#phi_dich_vu') &&
                !tags.includes('#thanh_toan_no') &&
                !tags.includes('#tra_gop') &&
                !tags.includes('#du_no_chuyen_tiep') &&
                !tags.includes('#tra_no_vay');
        });

        const momoFeeIndex = app.data.transactions.findIndex(t => t.place === feeMap.momo.name && t.date.startsWith(month));

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
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        const refundTagKey = `#hoan_phi_zalo_${prevMonthStr.replace('-', '_')}`;

        const alreadyRefunded = app.data.transactions.some(t =>
            t.type === 'Thu nhập' && t.tags && t.tags.includes(refundTagKey)
        );
        if (alreadyRefunded) return;

        const paidFeeTx = app.data.transactions.find(t =>
            t.place === 'Phí dịch vụ Zalo Pay' &&
            t.date.startsWith(prevMonthStr) &&
            t.status === 'paid' &&
            t.amount >= 20000
        );

        if (!paidFeeTx) return;

        const prevSpending = app.data.transactions.reduce((sum, t) => {
            const s = t.source.toLowerCase();
            const isCreditZalo = s.includes('zalo') && (s.includes('trả sau') || s.includes('priority') || s.includes('paylater'));
            const tags = t.tags || '';

            if (t.type === 'Chi tiêu' && t.date.startsWith(prevMonthStr) && isCreditZalo && t.status !== 'cancelled' &&
                !tags.includes('#phi_dich_vu') && !tags.includes('#thanh_toan_no') &&
                !tags.includes('#du_no_chuyen_tiep') && !tags.includes('#tra_gop')) {
                return sum + t.amount;
            }
            return sum;
        }, 0);

        const accumulated = app.logic.getZaloAccumulation(false);
        const rankInfo = app.logic.getZaloRankInfo(accumulated, app.data.configs.manualZaloRank);

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

        // 1. Xác định ngày hôm nay
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // 2. Lấy số ngày trong tháng
        const [y, m] = currentMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();

        // 3. Tính ngân sách trung bình mỗi ngày (Daily Cap)
        const dailyCap = limit / daysInMonth;

        // 4. Tính chi tiêu HÔM NAY 
        const todayTxs = app.data.transactions.filter(t => {
            // A. Phải là ngày hôm nay
            const txDate = t.date.substring(0, 10);
            if (txDate !== todayStr) return false;

            // [MỚI] Chặn Chuyển tiền ngay lập tức
            if (t.type === 'Chuyển tiền') return false;

            // B. Phải là Chi tiêu
            if (t.type !== 'Chi tiêu') return false;

            // C. Không bị loại trừ thủ công
            if (t.excludeFromBudget) return false;

            // D. [LOGIC MỚI] ÁP DỤNG QUY TẮC NGÂN SÁCH TÍN DỤNG
            // 1. Nếu là trả nợ (gồm cả trả góp, trả phí, trả phạt) -> TÍNH (return true)
            const tags = (t.tags || "").toLowerCase();
            const isDebtPayment =
                tags.includes('#thanh_toan_no') ||
                tags.includes('#thanh_toan_phi') ||
                tags.includes('#nop_phat') ||
                tags.includes('#tra_gop') ||
                tags.includes('#tat_toan_vay');

            if (isDebtPayment) return true;

            // 2. Nếu là tiêu dùng bằng tín dụng (Zalo/Momo/Shopee...) -> KHÔNG TÍNH (return false)
            const s = t.source.toLowerCase();
            const isCreditSource =
                (s.includes('zalo') && (s.includes('trả sau') || s.includes('priority') || s.includes('paylater'))) ||
                (s.includes('momo') && (s.includes('trả sau') || s.includes('ví trả sau') || s.includes('credit'))) ||
                (s.includes('shopee') || s.includes('spay') || s.includes('airpay')) ||
                (s.includes('tiktok')) ||
                (s.includes('tín dụng') || s.includes('thẻ') || s.includes('credit'));

            if (isCreditSource) return false;

            // 3. Loại trừ luân chuyển nội bộ
            if (tags.includes('#du_no_chuyen_tiep') || tags.includes('#da_chuyen_tra_gop')) return false;

            return true;
        });

        const todaySpent = todayTxs.reduce((sum, t) => sum + t.amount, 0);

        // 5. Tính số dư khả dụng tổng thể
        // Sử dụng logic mới của getBudgetTransactions() để tính tổng chi tiêu chuẩn xác
        const budgetTxs = this.getBudgetTransactions();
        const totalSpentMonth = budgetTxs.reduce((sum, t) => sum + t.amount, 0);

        const upcoming = this.getUpcomingDebts();

        // Công thức: Dư = Hạn mức - (Đã trả thực tế + Nợ sắp phải trả)
        const available = limit - totalSpentMonth - upcoming.total;

        const daysFunded = dailyCap > 0 ? Math.floor(available / dailyCap) : 0;

        return {
            dailyCap: dailyCap,
            todaySpent: todaySpent,
            surplus: dailyCap - todaySpent,
            available: available,
            daysFunded: Math.max(0, daysFunded),
            status: available < 0 ? 'broke' : 'ok',
            todayTxs: todayTxs
        };
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
