(function() {
    let captchaWidgetId = null;
    let pendingPaymentPrice = null;

    const onCaptchaSuccess = function () {
    console.log('reCAPTCHA v2 success');

    document.getElementById('captchaOverlay').classList.remove('active');

    // Если оплата не была инициирована (цена не сохранена), прерываем выполнение
    if (!pendingPaymentPrice) {
        if (captchaWidgetId !== undefined) grecaptcha.reset(captchaWidgetId);
        return;
    }

    const modalPriceDisplay = document.getElementById('modal_total_price');
    if (modalPriceDisplay && pendingPaymentPrice) {
        modalPriceDisplay.innerText = pendingPaymentPrice;
    }

    const modal = document.getElementById('paymentOverlay');
    if (modal) {
        modal.classList.add('active');
        // Надежная блокировка скролла для мобильных
        document.documentElement.classList.add('modal-open');
        const scrollY = window.scrollY;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100vw';
        if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
        document.body.dataset.scrollY = scrollY;
    }

    grecaptcha.reset(captchaWidgetId);
    pendingPaymentPrice = null;
};
window.initRecaptcha = function () {
    const container = document.getElementById('recaptcha');
    if (!container) return;

    captchaWidgetId = grecaptcha.render('recaptcha', {
        sitekey: '6Le83kwsAAAAABYf75410mXY4-RETveGUiiY57qD',
        callback: onCaptchaSuccess
    });

    console.log('reCAPTCHA v2 checkbox ready');
};

document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('steam_username');
    const amountInput = document.getElementById('steam_amount_deposit');
    const currencySelect = document.getElementById('steam_currency');
    const payButton = document.getElementById('replenish');
    const priceDisplay = document.getElementById('replenish_price');
    const modal = document.getElementById('paymentOverlay');
    const closeModalBtn = document.getElementById('pmCloseBtn');

    let debounceTimer;

    function animatePrice(el, start, end, duration, callback) {
        let startTs = null;
        function step(ts) {
            if (!startTs) startTs = ts;
            const p = Math.min((ts - startTs) / duration, 1);
            const v = Math.floor(start + (end - start) * (1 - Math.pow(1 - p, 3)));
            el.innerText = `${v} ₽`;
            if (p < 1) requestAnimationFrame(step);
            else {
                el.innerText = `${end} ₽`;
                if (typeof callback === 'function') callback();
            }
        }
        requestAnimationFrame(step);
    }

    async function calculateSteamPrice(login, amount, currency) {
        const API_URL = 'https://api.axoshop.ru/api/steam/calc';
        try {
            payButton.disabled = true;
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: login, amount: Number(amount), currency })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            return data.total_price;
        } catch (err) {
            console.error("Steam calc error:", err);
            return null;
        }
    }

    async function updatePrice() {
        const amountVal = amountInput.value;
        const amount = Number(amountVal);
        const login = usernameInput.value.trim();
        const currency = currencySelect.value;
        const current = parseInt(priceDisplay.innerText) || 0;

        amountInput.classList.remove('error');

        if (!amountVal || amount <= 0) {
            animatePrice(priceDisplay, current, 0, 400);
            payButton.disabled = true;
            return;
        }

        if (amount < 100) {
            animatePrice(priceDisplay, current, 0, 400);
            payButton.disabled = true;
            amountInput.classList.add('error');
            return;
        }

        const price = await calculateSteamPrice(login || 'guest', amount, currency);
        if (price !== null) {
            animatePrice(priceDisplay, current, price, 1200, () => {
                payButton.disabled = false;
            });
        } else {
            payButton.disabled = false;
            amountInput.classList.add('error');
        }
    }

    amountInput.addEventListener('input', (e) => {
        amountInput.classList.remove('error');
        if (e.target.value.length > 5) {
            e.target.value = e.target.value.slice(0, 5);
        }
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updatePrice, 500);
    });
    currencySelect.addEventListener('change', updatePrice);

    /* ===== КНОПКА ОПЛАТЫ ===== */
    payButton.addEventListener('click', (e) => {
        e.preventDefault();

        if (usernameInput && !usernameInput.value.trim()) {
            usernameInput.classList.add('error');
            usernameInput.addEventListener('input', () => usernameInput.classList.remove('error'), { once: true });
            return;
        }

        pendingPaymentPrice = priceDisplay.innerText;

        document.getElementById('captchaOverlay').classList.add('active');
    });

    const unlockScroll = () => {
        modal.classList.remove('active');
        document.documentElement.classList.remove('modal-open');
        const scrollY = parseInt(document.body.dataset.scrollY || '0');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.paddingRight = '';
        window.scrollTo(0, scrollY);
    };

    closeModalBtn.addEventListener('click', unlockScroll);
    modal.addEventListener('click', e => {
        if (e.target === modal) unlockScroll();
    });

    if (usernameInput) {
        usernameInput.addEventListener('input', e => {
            let v = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
            e.target.value = v;
        });
    }
});
})();
