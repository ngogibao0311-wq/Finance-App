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

            // Chu kỳ sao kê của từng nguồn trả sau.
            // Có thể ghi đè từng trường trong phần cài đặt mà không ảnh hưởng
            // tới các chức năng khác. Tháng ngân sách luôn lấy theo statementDate.
            payLaterBillingCycles: {
                // Ghi đè theo đúng tên nguồn nếu có ví trả sau khác.
                // Ví dụ: bySource: { 'Tên ví riêng': { cutoffDay: 20, ... } }
                bySource: {},

                shopee: {
                    cutoffDay: 13,
                    cutoffTime: '23:59:59',
                    statementMonthOffset: 0,
                    statementDay: 13,
                    statementTime: '23:59:59',
                    dueMonthOffset: 1,
                    dueDay: 1,
                    dueTime: '23:59:59'
                },
                tiktok: {
                    cutoffDay: 23,
                    cutoffTime: '23:59:59',
                    statementMonthOffset: 0,
                    statementDay: 23,
                    statementTime: '23:59:59',
                    dueMonthOffset: 1,
                    dueDay: 10,
                    dueTime: '23:59:59'
                },
                momo: {
                    cutoffDay: null,
                    statementMonthOffset: 1,
                    statementDay: 1,
                    statementTime: '00:01:00',
                    dueMonthOffset: 0,
                    dueDay: 5,
                    dueTime: '23:59:59'
                },
                zalo: {
                    cutoffDay: null,
                    statementMonthOffset: 1,
                    statementDay: 1,
                    statementTime: '00:00:00',
                    dueMonthOffset: 0,
                    dueDay: 6,
                    dueTime: '23:59:59'
                },
                default: {
                    cutoffDay: null,
                    statementMonthOffset: 1,
                    statementDay: 1,
                    statementTime: '00:00:00',
                    dueMonthOffset: 0,
                    dueDay: 5,
                    dueTime: '00:00:00'
                }
            },

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