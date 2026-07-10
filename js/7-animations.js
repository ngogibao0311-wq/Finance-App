/* --- 7-animations.js ---
   LOGIC XỬ LÝ CHUYỂN ĐỘNG & TƯƠNG TÁC NGƯỜI DÙNG
*/

app.effects = {
    init() {
        this.initRippleEffect();
        this.observeElements();
    },

    // 1. Hiệu ứng Ripple (Gợn sóng) khi bấm nút
    initRippleEffect() {
        document.addEventListener('click', function(e) {
            const target = e.target.closest('.btn, .fab-btn, .menu-item');
            if (target) {
                const circle = document.createElement('span');
                const diameter = Math.max(target.clientWidth, target.clientHeight);
                const radius = diameter / 2;

                const rect = target.getBoundingClientRect();
                
                circle.style.width = circle.style.height = `${diameter}px`;
                circle.style.left = `${e.clientX - rect.left - radius}px`;
                circle.style.top = `${e.clientY - rect.top - radius}px`;
                circle.classList.add('ripple');

                // Xóa ripple cũ để tránh rác DOM
                const ripple = target.getElementsByClassName('ripple')[0];
                if (ripple) ripple.remove();

                target.appendChild(circle);
            }
        });
    },

    // 2. Hiệu ứng Số chạy (Count Up)
    // Gọi hàm này sau khi render xong giao diện
    runNumberAnimations() {
        const elements = document.querySelectorAll('[id^="summary-"], [id="upcoming-total"], #zalo-accumulated');
        
        elements.forEach(el => {
            const rawText = el.textContent;
            // Lấy số từ chuỗi (loại bỏ 'đ', ',', '.')
            const targetNum = parseFloat(rawText.replace(/[^0-9-]/g, "")); 
            
            if (!isNaN(targetNum) && targetNum !== 0) {
                this.animateValue(el, 0, targetNum, 1000, rawText);
            }
        });
    },

    animateValue(obj, start, end, duration, finalFormatStr) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // Hàm easeOutExpo để số chạy chậm dần về cuối
            const easeProgress = 1 - Math.pow(2, -10 * progress);
            
            const currentVal = Math.floor(easeProgress * (end - start) + start);
            
            // Format lại tiền tệ trong lúc chạy
            obj.innerHTML = new Intl.NumberFormat('vi-VN', { 
                style: 'currency', 
                currency: 'VND' 
            }).format(currentVal);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                // Đảm bảo kết thúc hiển thị chính xác chuỗi gốc (để giữ màu sắc/format đặc biệt nếu có)
                // Hoặc giữ nguyên format currency chuẩn
                obj.innerHTML = new Intl.NumberFormat('vi-VN', { 
                    style: 'currency', 
                    currency: 'VND' 
                }).format(end);
            }
        };
        window.requestAnimationFrame(step);
    },

    // 3. Quan sát phần tử khi cuộn (Scroll Animation)
    observeElements() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = "1";
                    entry.target.style.transform = "translateY(0)";
                }
            });
        }, { threshold: 0.1 });

        // Áp dụng cho các item trong danh sách dài
        setTimeout(() => {
            const items = document.querySelectorAll('.plan, .budget-history-item');
            items.forEach(item => {
                // Set trạng thái ban đầu
                item.style.opacity = "0";
                item.style.transform = "translateY(20px)";
                item.style.transition = "all 0.5s ease-out";
                observer.observe(item);
            });
        }, 500); // Delay nhỏ để đợi render
    },

    // 4. Hiệu ứng Pháo giấy (Confetti) - Dùng khi trả hết nợ hoặc thăng hạng
    triggerConfetti() {
        const colors = ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.zIndex = '9999';
            confetti.style.width = '8px';
            confetti.style.height = '8px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.top = '-10px';
            confetti.style.borderRadius = '50%';
            
            // Random animation
            const duration = Math.random() * 3 + 2;
            confetti.style.transition = `top ${duration}s ease-in, transform ${duration}s linear`;
            
            document.body.appendChild(confetti);

            // Trigger animation
            setTimeout(() => {
                confetti.style.top = '110vh';
                confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            }, 10);

            // Cleanup
            setTimeout(() => confetti.remove(), duration * 1000);
        }
    },
    
    // 5. Rung nhẹ màn hình (Khi xóa hoặc cảnh báo)
    shakeScreen() {
        document.body.style.animation = 'shake 0.3s cubic-bezier(.36,.07,.19,.97) both';
        setTimeout(() => {
            document.body.style.animation = 'none';
        }, 300);
    }
};

// Thêm keyframes rung màn hình vào JS inject style
const style = document.createElement('style');
style.innerHTML = `
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}
`;
document.head.appendChild(style);
