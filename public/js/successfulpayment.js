document.addEventListener('DOMContentLoaded', async () => {
    const closeBtn = document.querySelector('.tx-modal__icon-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            window.location.href = '/pages/profile.html#orders';
        });
    }


    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');

    if (!orderId) {
        window.location.href = '/pages/404.html';
        return;
    }

    if (orderId) {
        const getCookie = (name) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        };

        const authToken = getCookie('authToken');
        const anonumysToken = getCookie('anonumysToken');
        const headers = {
            'Content-Type': 'application/json'
        };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        if (anonumysToken) {
            headers['X-Anonymous-Token'] = anonumysToken;
        }

        const safeFetch = async (url, options) => {
            const response = await fetch(url, options);
            
            // Логика проверки, перенесенная из Security Interceptor
            if (typeof url === 'string' && url.includes('/order/status')) {
                const clone = response.clone();
                try {
                    const data = await clone.json();
                    const currentAnonToken = getCookie('anonumysToken');
                    
                    if (data.success === false || (currentAnonToken && data.anonumys_token && data.anonumys_token !== currentAnonToken)) {
                        // window.location.href = '/pages/404.html';
                        // throw new Error('Security Redirect: Access Denied');
                    }
                } catch (e) {
                    if (e.message.includes('Security Redirect')) throw e;
                }
            }
            return response;
        };
    
        const elAmount = document.getElementById('tx-amount');
        const elTitle = document.getElementById('tx-title');
        const elDate = document.getElementById('tx-date');
        const elExecutor = document.getElementById('tx-executor');
        const elMethod = document.getElementById('tx-method');

        const requestBody = { id: orderId };
        if (authToken) requestBody.token = authToken;
        if (anonumysToken) requestBody.anonumys_token = anonumysToken;

        try {
            const response = await safeFetch(`https://api.axoshop.ru/order/status`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                const data = await response.json();

                if (data.success === false) {
                    console.error('API Error:', data.message);
                    throw new Error(data.message || 'Ошибка получения данных');
                }

                if (anonumysToken && data.anonumys_token && data.anonumys_token !== anonumysToken) {
                    console.error('Security Error: Anonumys token mismatch');
                    return;
                }

                const order = data.data || data.order || data; 

               
                if (elAmount) elAmount.textContent = order.amount || `${order.price} ${order.currency || '₽'}`;
                if (elTitle) elTitle.textContent = order.transaction || `Заказ №${order.id}`;
                
                if (elDate) {
                    if (order.date) {
                        elDate.textContent = order.date;
                    } else if (order.created_at) {
                        const date = new Date(order.created_at);
                        elDate.textContent = date.toLocaleString('ru-RU', {
                            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                        });
                    }
                }

                if (elExecutor) elExecutor.textContent = order.executor || order.service_name || 'AxoShop Service';
                
                const methods = { card: 'Банковская карта', sbp: 'СБП', wallet: 'Кошелек', crypto: 'Криптовалюта' };
                if (elMethod) elMethod.textContent = methods[order.payment_method] || order.payment_method || 'Неизвестно';

                if (order.status === 'pending' || order.status === 'oplata_check') {
                    setTimeout(() => window.location.reload(), 10000);
                }

                const updatePageStatus = (status) => {
                    const elMainTitle = document.getElementById('tx-main-title') || document.querySelector('.tx-modal__title');
                    const elStatusIcon = document.getElementById('tx-status-icon') || document.querySelector('.tx-modal__status-icon');
                    const elDetails = document.querySelector('.tx-modal__details');
                    const elReviewBtn = document.querySelector('.tx-modal__btn--filled');

                    const existingNote = document.querySelector('.tx-error-note');
                    if (existingNote) existingNote.remove();

                    if (elMainTitle && elStatusIcon) {
                        const iconSuccess = `<svg viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 0C34.9264 0 45 10.0736 45 22.5C45 34.9264 34.9264 45 22.5 45C10.0736 45 0 34.9264 0 22.5C0 10.0736 10.0736 0 22.5 0ZM20.1992 25.7998L13 18.6006V23.6914L18.9258 29.6172L20.1982 30.8906L21.4707 29.6172L31 20.0879V14.998L20.1992 25.7998Z" fill="#3CFF00"/></svg>`;
                        const iconError = `<svg viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 0C10.07 0 0 10.07 0 22.5C0 34.93 10.07 45 22.5 45C34.93 45 45 34.93 45 22.5C45 10.07 34.93 0 22.5 0ZM33.75 30.5L30.5 33.75L22.5 25.75L14.5 33.75L11.25 30.5L19.25 22.5L11.25 14.5L14.5 11.25L22.5 19.25L30.5 11.25L33.75 14.5L25.75 22.5L33.75 30.5Z" fill="#FF3B30"/></svg>`;
                        const iconPending = `<svg viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 0C10.07 0 0 10.07 0 22.5C0 34.93 10.07 45 22.5 45C34.93 45 45 34.93 45 22.5C45 10.07 34.93 0 22.5 0ZM22.5 40.5C12.56 40.5 4.5 32.44 4.5 22.5C4.5 12.56 12.56 4.5 22.5 4.5C32.44 4.5 40.5 12.56 40.5 22.5C40.5 32.44 32.44 40.5 22.5 40.5ZM23.62 13.5H20.25V24.75L30.09 30.66L31.78 27.84L23.62 22.95V13.5Z" fill="#FF9500"/></svg>`;

                        let isSuccessState = false;

                        switch (status) {
                            case 'pending':
                                elMainTitle.textContent = 'Заказ в процессе';
                                elStatusIcon.innerHTML = iconPending;
                                break;
                            case 'oplata_check':
                                elMainTitle.textContent = 'Ожидание оплаты';
                                elStatusIcon.innerHTML = iconPending;
                                break;
                            case 'error':
                                elMainTitle.textContent = 'Ошибка';
                                elStatusIcon.innerHTML = iconError;
                                break;
                            case 'error_anonumys':
                                elMainTitle.textContent = 'Ошибка';
                                elStatusIcon.innerHTML = iconError;
                            const elActions = document.querySelector('.tx-modal__actions');
                            if (elActions) {
                                    const note = document.createElement('div');
                                note.className = 'tx-error-note';
                                note.innerHTML = '<div class="tx-modal__value">Для возврата средств обратитесь в поддержку</div>';
                                elActions.parentNode.insertBefore(note, elActions);
                                }
                                break;
                            case 'success':
                            default:
                                elMainTitle.textContent = 'Спасибо за покупку';
                                elStatusIcon.innerHTML = iconSuccess;
                                isSuccessState = true;
                                break;
                        }

                        if (elReviewBtn) {
                            if (isSuccessState) {
                                elReviewBtn.classList.remove('tx-modal__btn--hidden');
                            } else {
                                elReviewBtn.classList.add('tx-modal__btn--hidden');
                            }
                        }
                    }
                };

                updatePageStatus(order.status);

            } else {
                console.error('Ошибка получения данных заказа:', response.status);
                if (elTitle) elTitle.textContent = `Ошибка сервера: ${response.status}`;
            }
        } catch (error) {
            console.error('Ошибка сети:', error);
            if (elTitle) elTitle.textContent = error.message || 'Ошибка соединения';
        }
    }
});