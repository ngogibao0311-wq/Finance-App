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
            zaloManualCount: 0,
            shopeePayBillingGroup: 2,
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