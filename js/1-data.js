// Khởi tạo object gốc
const app = {
    data: {
        transactions: [],
        accounts: [],
        forecasts: [],
        installmentPlans: {},
        createdStatements: {},
        loans: [],
        cashWallets: [],
        configs: {
            zaloLevel: 'standard',
            zaloReviewDate: '2025-06-30',
            guestMode: false,
            apiKeys: { gemini: '' },
            sidebarCollapsed: false,
            manualZaloRank: null,
            manualZaloAmount: null,
            manualZaloOffset: 0,
            zaloManualCount: 0,
            shopeePayBillingGroup: 2,
            // Cơ chế hạn mức cấp trước chỉ áp dụng từ tháng 08/2026 trở đi.
            monthlyLimitCreditStartMonth: '2026-08',
            debtOverrides: {},
        },
        filter: {
            month: (() => {
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            })()
        }
    }
};