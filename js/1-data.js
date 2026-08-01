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

            // Hạng chính thức đang được hưởng
            zaloCurrentRank: 'member',

            // Ngày bắt đầu chu kỳ hạng hiện tại
            zaloRankStartDate: '',

            // Ngày xét hạng tiếp theo
            zaloReviewDate: '',
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