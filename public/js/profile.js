document.addEventListener('DOMContentLoaded', () => {
    const API_ENDPOINTS = {
        PROFILE: 'https://auth.axoshop.ru/api/profile',
        SETTINGS: 'https://auth.axoshop.ru/api/profile',
        UPLOAD_AVATAR: 'https://files.axoshop.ru/upload/avatar',
        WALLET: 'https://auth.axoshop.ru/api/wallet/info',
        ORDERS: 'https://auth.axoshop.ru/api/orders',
        HIDENAME: 'https://auth.axoshop.ru/api/profile/hidename',
        CHANGE_NAME: 'https://auth.axoshop.ru/api/profile/name'
    };

    // Debug mode flag - set to true to enable console logging
    const DEBUG = false;

    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    };

    // Утилиты для защиты от XSS (escapeHtml и safeUrl)
    const escapeHtml = (str) => {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const safeUrl = (url) => {
        if (!url) return "";
        const str = String(url);
        // Блокируем опасные схемы
        if (/^\s*(javascript:|data:)/i.test(str)) return "";
        // Возвращаем URL напрямую (не экранируем для src атрибута)
        return str;
    };

    // Нормализация URL files.axoshop.ru: http → https
    const normalizeFilesUrl = (url) => {
        if (!url) return url;
        const str = String(url);
        // Заменяем http://files.axoshop.ru на https://files.axoshop.ru
        return str.replace(/^http:\/\/files\.axoshop\.ru\//i, 'https://files.axoshop.ru/');
    };

    // Helper для извлечения URL картинки категории
    const getCategoryImageUrl = (category) => {
        // Пробуем разные поля
        let imageUrl = category.image_url || category.image || category.imageUrl || category.url;

        // Если это объект, извлекаем вложенный URL
        if (typeof imageUrl === 'object' && imageUrl !== null) {
            imageUrl = imageUrl.url || imageUrl.image;
        }

        // Проверяем, является ли это валидной HTTP(S) ссылкой
        if (imageUrl && typeof imageUrl === 'string') {
            // Если это полноценная ссылка - используем её
            if (/^https?:\/\//i.test(imageUrl)) {
                return imageUrl;
            }
            // Если это slug (не ссылка) - возвращаем пустую строку
            return "";
        }

        return "";
    };

    // Управление спойлерами
    let activeSpoilers = [];

    const setSpoilerState = (isHidden, instant = false) => {
        // Если спойлеры уже есть, просто переключаем их состояние
        if (activeSpoilers.length > 0) {
            activeSpoilers.forEach(s => isHidden ? s.hide(instant) : s.reveal());
            return;
        }

        const nameEl = document.querySelector('.settings-name');
        const inputEl = document.getElementById('display-name');

        if (isHidden) {
            if (nameEl) activeSpoilers.push(new TelegramSpoiler(nameEl, { instant }));
            if (inputEl) activeSpoilers.push(new TelegramSpoiler(inputEl, { instant }));
        }
    };

    // === AUTH CHECK LOGIC ===
    
    const profileContainer = document.querySelector('.profile-container');
    if (profileContainer) {
        // profileContainer.style.display = 'none'; // Убираем скрытие, чтобы показать скелетоn
    }

    const fetchWallet = async (token) => {
        try {
            const response = await fetch(`${API_ENDPOINTS.WALLET}?_=${new Date().getTime()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (DEBUG) console.log('Данные кошелька:', data);

                const balanceEl = document.querySelector('.wallet-balance');
                const bonusEl = document.querySelector('.wallet-card-bonus__amount');

                if (balanceEl) {
                    const formattedBalance = Number(data.balance).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    balanceEl.textContent = `${formattedBalance} ₽`;
                }

                if (bonusEl) {
                    const img = bonusEl.querySelector('img');
                    bonusEl.textContent = String(data.bonus);
                    if (img) bonusEl.appendChild(img);
                }
            }
        } catch (error) {
            console.error('Wallet fetch failed:', error);
        }
    };

    const fetchFavorites = async (token) => {
        const productsGrid = document.getElementById('fav-products-grid');
        const categoriesGrid = document.getElementById('fav-categories-grid');

        if (!productsGrid && !categoriesGrid) return;

        // Placeholder HTML для изображений
        const placeholderHtml = `<div class='product-image-placeholder' style='width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#ececec;'><svg width='40' height='40' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M21 16.5C21 16.88 20.79 17.21 20.47 17.38L12.57 21.82C12.41 21.94 12.21 22 12 22C11.79 22 11.59 21.94 11.43 21.82L3.53 17.38C3.21 17.21 3 16.88 3 16.5V7.5C3 7.12 3.21 6.79 3.53 6.62L11.43 2.18C11.59 2.06 11.79 2 12 2C12.21 2 12.41 2.06 12.57 2.18L20.47 6.62C20.79 6.79 21 7.12 21 7.5V16.5Z' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><path d='M12 22V12' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><path d='M12 12L3.28998 7.11' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><path d='M12 12L20.71 7.11' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg></div>`;

        try {
            // Загружаем избранные товары и категории параллельно
            const [productsResponse, categoriesResponse] = await Promise.all([
                fetch('https://auth.axoshop.ru/api/favorite/tovar/list', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('https://auth.axoshop.ru/api/favorite/category/list', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            // Обработка избранных товаров
            if (productsGrid) {
                if (productsResponse.ok) {
                    const data = await productsResponse.json();
                    const products = data.items || [];

                    // Фильтруем только существующие товары
                    const existingProducts = products.filter(p => p.exists);

                    if (existingProducts.length > 0) {
                        productsGrid.innerHTML = existingProducts.map(product => {
                            const safeTitle = escapeHtml(product.name || 'Товар');
                            // Нормализуем URL: http → https для files.axoshop.ru
                            const normalizedImageUrl = normalizeFilesUrl(product.imageUrl);
                            const safeImage = safeUrl(normalizedImageUrl);
                            const price = product.price ? `${product.price} ₽` : '... ₽';

                            return `
                                <a href="/pages/product-page.html?id=${product.id}" class="product-card">
                                    <div class="card-image-wrapper">
                                        <button class="card-fav active" aria-label="Удалить из избранного" data-product-id="${product.id}">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                            </svg>
                                        </button>
                                        ${safeImage ? `<img src="${safeImage}" alt="${safeTitle}" />` : placeholderHtml}
                                    </div>
                                    <div class="card-info">
                                        <div class="card-price">${price}</div>
                                        <div class="card-title">${safeTitle}</div>
                                    </div>
                                </a>
                            `;
                        }).join('');
                    } else {
                        productsGrid.innerHTML = '<p style="width: 100%; text-align: left; color: var(--text-gray); padding-bottom: 40px;">Нет избранных товаров</p>';
                    }
                } else {
                    productsGrid.innerHTML = '<p style="width: 100%; text-align: left; color: var(--text-gray);">Не удалось загрузить избранное</p>';
                }
            }

            // Обработка избранных категорий
            if (categoriesGrid) {
                if (categoriesResponse.ok) {
                    const data = await categoriesResponse.json();
                    const categories = data.items || [];

                    // Фильтруем только существующие категории
                    const existingCategories = categories.filter(c => c.exists);

                    if (existingCategories.length > 0) {
                        categoriesGrid.innerHTML = existingCategories.map(category => {
                            const safeTitle = escapeHtml(category.name || 'Категория');

                            // Используем helper для безопасного извлечения URL картинки
                            const imageUrl = getCategoryImageUrl(category);
                            // Нормализуем URL: http → https для files.axoshop.ru
                            const normalizedImageUrl = normalizeFilesUrl(imageUrl);
                            const safeImage = safeUrl(normalizedImageUrl);

                            // Проверяем, является ли это massive категорией или новым провайдером
                            const categoryType = category.type || 'category';
                            const isMassiveOrProvider = categoryType === 'massive' || /^\d{4,5}$/.test(category.id);
                            const targetUrl = isMassiveOrProvider
                                ? `/pages/product-page.html?id=${category.id}`
                                : `/pages/products.html?id=${category.id}`;

                            return `
                                <a href="${targetUrl}" class="product-card category-card">
                                    <div class="card-image-wrapper">
                                        <button class="card-fav active" aria-label="Удалить из избранного" data-product-id="${category.id}" data-type="category">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                            </svg>
                                        </button>
                                        ${safeImage ? `<img src="${safeImage}" alt="${safeTitle}" />` : placeholderHtml}
                                    </div>
                                    <div class="card-info">
                                        <div class="card-title">${safeTitle}</div>
                                    </div>
                                </a>
                            `;
                        }).join('');
                    } else {
                        categoriesGrid.innerHTML = '<p style="width: 100%; text-align: left; color: var(--text-gray); padding-bottom: 40px;">Нет избранных категорий</p>';
                    }
                } else {
                    categoriesGrid.innerHTML = '<p style="width: 100%; text-align: left; color: var(--text-gray);">Не удалось загрузить избранное</p>';
                }
            }

            // Обновляем состояние кнопок избранного
            if (window.updateFavoriteButtons) {
                window.updateFavoriteButtons();
            }

        } catch (error) {
            console.error('Favorites fetch failed:', error);
            if (productsGrid) {
                productsGrid.innerHTML = '<p style="width: 100%; text-align: left; color: var(--text-gray);">Ошибка загрузки</p>';
            }
            if (categoriesGrid) {
                categoriesGrid.innerHTML = '<p style="width: 100%; text-align: left; color: var(--text-gray);">Ошибка загрузки</p>';
            }
        }
    };

    const fetchOrders = async (token) => {
        const ordersGrid = document.querySelector('.orders-grid');
        if (!ordersGrid) return;

        // Skeleton loading
        // ordersGrid.innerHTML = Array(3).fill(0).map(() => `
        //     <div class="order-card">
        //         <div class="order-card__header">
        //             <div class="order-card__info">
        //                 <div class="order-card__status skeleton" style="width: 60px; height: 20px; border-radius: 8px;"></div>
        //                 <div class="order-card__text">
        //                     <div class="order-card__id skeleton skeleton-text" style="width: 80px; height: 16px;"></div>
        //                     <div class="order-card__title skeleton skeleton-text" style="width: 120px; height: 30px;"></div>
        //                 </div>
        //             </div>
        //             <div class="order-card__image-placeholder skeleton"></div>
        //         </div>
        //         <div class="order-card__actions">
        //             <div class="btn skeleton"></div>
        //             <div class="btn skeleton"></div>
        //         </div>
        //     </div>
        // `).join('');

        try {
            const response = await fetch(`${API_ENDPOINTS.ORDERS}?_=${new Date().getTime()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (DEBUG) console.log('Данные заказов:', data);
                
                ordersGrid.innerHTML = '';

                if (data.orders && data.orders.length > 0) {
                    ordersGrid.innerHTML = data.orders.map(order => {
                        const safeStatus = escapeHtml(order.statusText || order.status);
                        const safeId = escapeHtml(order.id);
                        const safeTitle = escapeHtml(order.title);
                        const safeImage = safeUrl(order.image);

                        return `
                        <div class="order-card">
                            <div class="order-card__header">
                                <div class="order-card__info">
                                    <span class="order-card__status ${order.status === 'processing' ? 'order-card__status--processing' : ''}">${safeStatus}</span>
                                    <div class="order-card__text">
                                        <span class="order-card__id">\u0437\u0430\u043A\u0430\u0437 #${safeId}</span>
                                        <h3 class="order-card__title">${safeTitle}</h3>
                                    </div>
                                </div>
                                <div class="order-card__image-placeholder">
                                    ${safeImage ? `<img src="${safeImage}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">` : ''}
                                </div>
                            </div>
                            <div class="order-card__actions">
                                <button class="btn btn--outline js-open-details">\u043F\u043E\u0434\u0440\u043E\u0431\u043D\u0435\u0435</button>
                                <button class="btn btn--primary">\u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C</button>
                            </div>
                        </div>
                    `}).join('');
                } else {
                    ordersGrid.innerHTML = '<p style="width: 100%; text-align: center; color: var(--text-gray);">\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u043E\u043A\u0443\u043F\u043E\u043A \u043F\u0443\u0441\u0442\u0430</p>';
                }
            } else {
                ordersGrid.innerHTML = '<p style="width: 100%; text-align: center; color: var(--text-gray);">\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0437\u0430\u043A\u0430\u0437\u044B</p>';
            }
        } catch (error) {
            console.error('Orders fetch failed:', error);
            ordersGrid.innerHTML = '<p style="width: 100%; text-align: center; color: var(--text-gray);">\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438</p>';
        }
    };

    const checkAuth = async () => {
        const authToken = getCookie('authToken');

        if (!authToken) {
            window.location.href = '/pages/authorization.html';
            return;
        }

        // Включаем Skeleton для профиля
        const nameEl = document.querySelector('.settings-name');
        const emailEl = document.querySelector('.settings-email');
        const avatarEl = document.querySelector('.settings-avatar-image');
        const balanceEl = document.querySelector('.wallet-balance');
        const bonusEl = document.querySelector('.wallet-card-bonus__amount');

        // [nameEl, emailEl, balanceEl, bonusEl].forEach(el => {
        //     if(el) el.classList.add('skeleton', 'skeleton-text');
        // });
        // if(avatarEl) avatarEl.classList.add('skeleton');

        try {
            // Используем прямой URL с timestamp для сброса кеша
            const response = await fetch(`${API_ENDPOINTS.PROFILE}?_=${new Date().getTime()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                // Выключаем Skeleton
                // [nameEl, emailEl, balanceEl, bonusEl].forEach(el => {
                //     if(el) {
                //         el.classList.remove('skeleton', 'skeleton-text');
                //     }
                // });
                // if(avatarEl) avatarEl.classList.remove('skeleton');

                const data = await response.json();
                if (DEBUG) console.log('Данные профиля:', data);
                if (data.user) {
                    const nameEl = document.querySelector('.settings-name');
                    const emailEl = document.querySelector('.settings-email');
                    const nameInput = document.getElementById('display-name');
                    const avatarEl = document.querySelector('.settings-avatar-image');
                    const hideNameToggle = document.querySelector('.settings-switch input');

                    const userName = data.user.username || data.user.name || '\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C';
                    if (nameEl) nameEl.textContent = userName;
                    if (nameInput) nameInput.value = userName;

                    if (emailEl) emailEl.textContent = data.user.email || '';
                    
                    const isAvatarOn = data.user.avatarstatus === 'on' || 
                                     data.user.avatarstatus === true || 
                                     data.user.avatarstatus === 'true' || 
                                     data.user.avatarstatus === 1;

                    if (avatarEl && isAvatarOn && data.user.avatarurl) {
                        // Нормализуем URL: http → https для files.axoshop.ru
                        const normalizedUrl = normalizeFilesUrl(data.user.avatarurl);
                        if (DEBUG) console.log('Устанавливаем аватар:', normalizedUrl);
                        try {
                            const urlObj = new URL(normalizedUrl, window.location.origin);
                            if (['http:', 'https:'].includes(urlObj.protocol)) {
                                const safeUrl = urlObj.href.replace(/'/g, '%27');
                                avatarEl.style.backgroundImage = `url('${safeUrl}')`;
                                avatarEl.style.backgroundSize = 'cover';
                                avatarEl.style.backgroundPosition = 'center';
                            }
                        } catch (e) {}
                    }

                    if (hideNameToggle) {
                        const isHidden = (data.user.hidename === 'on');
                        hideNameToggle.checked = isHidden;
                        setSpoilerState(isHidden, true); // true = instant on load
                    }
                }

                // Загружаем данные кошелька
                fetchWallet(authToken);
                // Загружаем историю заказов
                // fetchOrders(authToken); // ВРЕМЕННО ОТКЛЮЧЕНО - используется статика
                // Загружаем избранное
                fetchFavorites(authToken);
                
            } else if (response.status === 401) {
                document.cookie = 'authToken=; path=/; max-age=0';
                window.location.href = '/pages/authorization.html';
            } else {
                console.error('Ошибка загрузки профиля:', response.status);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        }
    };

    checkAuth();

    // === LOGOUT FUNCTIONALITY ===
    const logoutBtn = document.querySelector('.settings-logout-btn');
        
    // Функция для отображения транзакций
    function displayStaticTransactions() {
        const transactionsList = document.querySelector('.transactions-list');
        if (transactionsList) {
            transactionsList.innerHTML = `
                <div class="transaction-item">
                    <div class="transaction-item__left">
                        <span class="transaction-title">\u043F\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u043A\u043E\u0448\u0435\u043B\u044C\u043A\u0430</span>
                        <span class="transaction-date">12.07.2024</span>
                    </div>
                    <div class="transaction-item__right">
                        <span class="transaction-amount">+500 ₽</span>
                    </div>
                </div>
                <div class="transaction-item">
                    <div class="transaction-item__left">
                        <span class="transaction-title">\u043F\u043E\u043A\u0443\u043F\u043A\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438</span>
                        <span class="transaction-date">11.07.2024</span>
                    </div>
                    <div class="transaction-item__right">
                        <span class="transaction-amount">-350 ₽</span>
                    </div>
                </div>
                <div class="transaction-item">
                    <div class="transaction-item__left">
                        <span class="transaction-title">\u0432\u044B\u0432\u043E\u0434 \u0441\u0440\u0435\u0434\u0441\u0442\u0432</span>
                        <span class="transaction-date">10.07.2024</span>
                    </div>
                    <div class="transaction-item__right">
                        <span class="transaction-amount">-150 ₽</span>
                    </div>
                </div>
                <div class="transaction-item">
                    <div class="transaction-item__left">
                        <span class="transaction-title">\u043F\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u043A\u043E\u0448\u0435\u043B\u044C\u043A\u0430</span>
                        <span class="transaction-date">09.07.2024</span>
                    </div>
                    <div class="transaction-item__right">
                        <span class="transaction-amount">+1000 ₽</span>
                    </div>
                </div>
            `;
        }
    }

    displayStaticTransactions(); // Вызываем функцию для отображения транзакций

   if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            document.cookie = 'authToken=; path=/; max-age=0';
            window.location.href = '/pages/authorization.html';
        });
    }

  

    // === ГЛОБАЛЬНЫЕ ЭЛЕМЕНТЫ ===
    const navItems = document.querySelectorAll('.profile-nav__item');
    const views = document.querySelectorAll('.view-section');

    const listView = document.getElementById('orders-list-view');
    const detailsView = document.getElementById('order-details-view');
    const walletView = document.getElementById('wallet-view');
    const settingsView = document.getElementById('settings-view');

    // === HASH ROUTING ===
    const ROUTE_MAP = {
        'orders': 'orders-list-view',
        'wallet': 'wallet-view',
        'favorites': 'favorites-view',
        'settings': 'settings-view'
    };

    const switchView = (viewId) => {
        // Скрываем все view
        views.forEach(view => {
            view.classList.remove('active');
            view.hidden = true;
        });

        // Убираем активность со всех табов
        navItems.forEach(t => t.classList.remove('profile-nav__item--active'));

        // Показываем нужный view
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.hidden = false;
            targetView.classList.add('active');

            // Активируем соответствующий таб
            const activeTab = Array.from(navItems).find(tab => tab.getAttribute('data-target') === viewId);
            if (activeTab) {
                activeTab.classList.add('profile-nav__item--active');
            }
        }
    };

    const handleRouting = () => {
        const hash = window.location.hash.slice(1); // Убираем #

        // Проверяем, является ли это маршрутом деталей заказа
        if (hash.startsWith('orders/')) {
            const orderId = decodeURIComponent(hash.replace('orders/', ''));

            // Показываем orders-list-view (чтобы активировать правильный таб)
            switchView('orders-list-view');

            // Затем показываем детали заказа
            if (detailsView && listView) {
                const detailsTitle = detailsView.querySelector('.details-title');
                const detailsName = detailsView.querySelector('.details-product-name');

                if (detailsTitle) detailsTitle.textContent = orderId;
                // Название можно будет загрузить из API или оставить как есть

                listView.classList.remove('active');
                listView.hidden = true;

                detailsView.hidden = false;
                void detailsView.offsetWidth;
                detailsView.classList.add('active');

                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            // Обычная логика роутинга
            const viewId = ROUTE_MAP[hash] || 'orders-list-view';
            switchView(viewId);
        }
    };

    // Слушаем изменения hash (кнопки назад/вперед браузера)
    window.addEventListener('hashchange', handleRouting);

    // Инициализация роутинга при загрузке
    handleRouting();

    // === 1. ЛОГИКА ТАБОВ (Главная навигация) ===
    navItems.forEach((tab) => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = tab.getAttribute('data-target');

            // Определяем hash для этого view
            const hash = Object.keys(ROUTE_MAP).find(key => ROUTE_MAP[key] === targetId) || 'orders';

            // Обновляем hash (это автоматически вызовет handleRouting через hashchange)
            window.location.hash = hash;
        });
    });

    // === 2. ЛОГИКА ДЕТАЛЕЙ ЗАКАЗА (Внутри истории покупок) ===

    if (detailsView) {
        const detailsTitle = detailsView.querySelector('.details-title');
        const detailsName = detailsView.querySelector('.details-product-name');
        const backBtn = detailsView.querySelector('.js-close-details');

        const showDetails = (cardData) => {
            if (detailsTitle) detailsTitle.textContent = cardData.id;
            if (detailsName) detailsName.textContent = cardData.title;

            if (listView) {
                listView.classList.remove('active');
                listView.hidden = true;
            }

            detailsView.hidden = false;
            void detailsView.offsetWidth;
            detailsView.classList.add('active');

            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        const showList = () => {
            detailsView.classList.remove('active');
            detailsView.hidden = true;

            if (listView) {
                listView.hidden = false;
                void listView.offsetWidth;
                listView.classList.add('active');
            }
        };

        if (listView) {
            listView.addEventListener('click', (e) => {
                const btn = e.target.closest('.js-open-details');
                if (btn) {
                    e.preventDefault();
                    const card = btn.closest('.order-card');

                    const orderId = card.querySelector('.order-card__id').textContent;
                    const orderTitle = card.querySelector('.order-card__title').textContent;

                    // Обновляем hash с ID заказа
                    window.location.hash = `orders/${orderId}`;
                }
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Возвращаемся к списку заказов
                window.location.hash = 'orders';
            });
        }
    }
  
  

    // === 3. ЛОГИКА ЗАГРУЗКИ АВАТАРКИ ===
    const avatarImage = document.querySelector('.settings-avatar-image');
    const changeAvatarBtn = document.querySelector('.settings-save-btn');

    // Функция обновления профиля (вынесена, чтобы быть доступной для имени и аватара)
    const updateProfileAvatar = async (data) => {
        if (DEBUG) console.log('DEBUG: Попытка обновления профиля (PATCH):', data);
        const token = getCookie('authToken');
        if (!token) {
            if (DEBUG) console.error('DEBUG: Токен не найден!');
            return;
        }
        try {
            const response = await fetch(API_ENDPOINTS.SETTINGS, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (DEBUG) console.log('DEBUG: Статус ответа сервера:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                if (DEBUG) console.error('DEBUG: Ошибка сервера:', errorText);
            } else {
                const result = await response.json();
                if (DEBUG) console.log('DEBUG: Успешный ответ сервера:', result);
            }
            
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
        }
    };

    if (avatarImage || changeAvatarBtn) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        const openFileExplorer = () => fileInput.click();

        const addSpinnerStyles = () => {
            if (!document.getElementById('avatar-spinner-style')) {
                const style = document.createElement('style');
                style.id = 'avatar-spinner-style';
                style.textContent = `
                    .avatar-spinner {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 40px;
                        height: 40px;
                        border: 4px solid rgba(255, 255, 255, 0.3);
                        border-radius: 50%;
                        border-top: 4px solid #000;
                        animation: spin 1s linear infinite;
                        z-index: 10;
                    }
                    @keyframes spin {
                        0% { transform: translate(-50%, -50%) rotate(0deg); }
                        100% { transform: translate(-50%, -50%) rotate(360deg); }
                    }
                    .settings-avatar-container.loading .settings-avatar-image {
                        opacity: 0.5;
                    }
                `;
                document.head.appendChild(style);
            }
        };

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (avatarImage) {
                        avatarImage.style.backgroundImage = `url('${event.target.result}')`;
                        avatarImage.style.backgroundSize = 'cover';
                        avatarImage.style.backgroundPosition = 'center';
                    }
                };
                reader.readAsDataURL(file);

                const token = getCookie('authToken');
                if (token) {
                    addSpinnerStyles();
                    const container = document.querySelector('.settings-avatar-container');
                    let spinner;
                    if (container) {
                        container.classList.add('loading');
                        spinner = document.createElement('div');
                        spinner.className = 'avatar-spinner';
                        container.appendChild(spinner);
                    }

                    const fd = new FormData();
                    fd.append("avatar", file);

                    try {
                        const response = await fetch(API_ENDPOINTS.UPLOAD_AVATAR, {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${token}`
                            },
                            body: fd
                        });

                        if (response.ok) {
                            const result = await response.json();
                            if (result.success && result.avatar_url) {
                                // Нормализуем URL перед сохранением: http → https
                                const normalizedAvatarUrl = normalizeFilesUrl(result.avatar_url);
                                await updateProfileAvatar({
                                    avatarstatus: 'on',
                                    avatarurl: normalizedAvatarUrl
                                });
                            }
                        } else {
                            if (response.status === 401) window.location.href = '/pages/authorization.html';
                            if (response.status === 413) alert('\u0424\u0430\u0439\u043B \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439');
                            if (response.status === 415) alert('\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0444\u0430\u0439\u043B\u0430');
                        }
                    } catch (error) {
                        console.error('Ошибка загрузки:', error);
                    } finally {
                        if (container) {
                            container.classList.remove('loading');
                            if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
                        }
                    }
                }
            }
        });

        if (avatarImage) {
            avatarImage.style.cursor = 'pointer';
            avatarImage.addEventListener('click', openFileExplorer);
        }

        if (changeAvatarBtn) {
            changeAvatarBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openFileExplorer();
            });
        }
    }

    // === 4. ЛОГИКА СОХРАНЕНИЯ ТЕКСТОВЫХ НАСТРОЕК ===
    const nameInput = document.getElementById('display-name');
    const hideNameToggle = document.querySelector('.settings-switch input');

    if (nameInput) {
        nameInput.addEventListener('change', async () => {
            const username = nameInput.value;
            const token = getCookie('authToken');
            if (!token) return;

            try {
                const res = await fetch(API_ENDPOINTS.CHANGE_NAME, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ username }),
                    keepalive: true
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    console.error("Ошибка смены имени:", err.error);
                    return;
                }

                const data = await res.json();
                const nameEl = document.querySelector('.settings-name');
                if (nameEl && data.user && data.user.username) {
                    nameEl.textContent = data.user.username;
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    if (hideNameToggle) {
        hideNameToggle.addEventListener('change', async () => {
            const token = getCookie('authToken');
            if (!token) return;

            // Блокируем переключатель на время запроса
            hideNameToggle.disabled = true;

            // Сразу применяем состояние (Optimistic UI)
            const isHidden = hideNameToggle.checked;
            setSpoilerState(isHidden, false);

            try {
                const res = await fetch(API_ENDPOINTS.HIDENAME, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    }
                });

                if (!res.ok) throw new Error("Toggle failed");

                const data = await res.json();
                const newState = data.user.hidename === 'on';
                
                // Синхронизируем UI с ответом сервера (на случай рассинхрона)
                if (isHidden !== newState) {
                    hideNameToggle.checked = newState;
                    setSpoilerState(newState, false);
                }
            } catch (err) {
                console.error(err);
                // Возвращаем переключатель в исходное положение при ошибке
                hideNameToggle.checked = !isHidden;
                setSpoilerState(!isHidden, false);
            } finally {
                hideNameToggle.disabled = false;
            }
        });
    }

    // === 5. ЛОГИКА МОДАЛЬНОГО ОКНА ПОПОЛНЕНИЯ КОШЕЛЬКА ===
    const walletTopupBtn = document.querySelector('.js-wallet-topup');
    const walletOverlay = document.getElementById('walletTopupOverlay');
    const walletCloseBtn = document.getElementById('walletTopupCloseBtn');
    const walletTabs = document.querySelectorAll('#walletTopupModal .pm-tab-btn');
    const walletPayBtn = document.getElementById('walletTopupPayBtn');
    const walletAmountInput = document.getElementById('walletTopupAmount');

    if (walletTopupBtn && walletOverlay) {
        walletTopupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            walletOverlay.classList.add('active');
            document.documentElement.classList.add('modal-open');
            document.body.style.overflow = 'hidden'; // Блокируем скролл
        });

        const closeWalletModal = () => {
            walletOverlay.classList.remove('active');
            document.documentElement.classList.remove('modal-open');
            document.body.style.overflow = '';
        };

        if (walletCloseBtn) walletCloseBtn.addEventListener('click', closeWalletModal);
        
        walletOverlay.addEventListener('click', (e) => {
            if (e.target === walletOverlay) closeWalletModal();
        });

        walletTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                walletTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });

        if (walletPayBtn && walletAmountInput) {
            walletAmountInput.addEventListener('keydown', (e) => {
                if (e.key === '-' || e.key === 'e') {
                    e.preventDefault();
                }
            });

            walletAmountInput.addEventListener('input', () => {
                const wrapper = walletAmountInput.closest('.pm-input-wrapper');
                if (wrapper) wrapper.classList.remove('error');
                walletAmountInput.classList.remove('error');
            });

            walletPayBtn.addEventListener('click', async () => {
                const amountVal = walletAmountInput.value;
                const amountNum = Number(amountVal);
                const wrapper = walletAmountInput.closest('.pm-input-wrapper');

                if (!amountVal || isNaN(amountNum) || amountNum < 100) {
                    if (wrapper) wrapper.classList.add('error');
                    walletAmountInput.classList.add('error');
                    return;
                }

                const token = getCookie('authToken');
                if (!token) {
                    window.location.href = '/pages/authorization.html';
                    return;
                }

                let paymentMethod = 'card';
                walletTabs.forEach(tab => {
                    if (tab.classList.contains('active')) {
                        paymentMethod = tab.getAttribute('data-method');
                    }
                });

                try {
                    walletPayBtn.disabled = true;
                    walletPayBtn.textContent = '\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430...';

                    const response = await fetch('https://api.axoshop.ru/wallet/replenish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            payment_method: paymentMethod,
                            amount: String(amountVal),
                            token: token
                        })
                    });

                    const data = await response.json();

                    if (response.ok && (data.url || data.payment_url)) {
                        window.location.href = data.url || data.payment_url;
                    } else {
                        alert(data.message || '\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438 \u043F\u043B\u0430\u0442\u0435\u0436\u0430');
                    }
                } catch (e) {
                    console.error(e);
                    alert('\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F');
                } finally {
                    walletPayBtn.disabled = false;
                    walletPayBtn.textContent = '\u043E\u043F\u043B\u0430\u0442\u0438\u0442\u044C';
                }
            });
        }
    }

    // Копирование кода товара
    document.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.details-delivery-copy');
        if (!copyBtn) return;

        const codeElement = copyBtn.closest('.details-delivery-content')?.querySelector('.details-delivery-code');
        if (!codeElement) return;

        const code = codeElement.textContent.trim();

        navigator.clipboard.writeText(code).then(() => {
            // Визуальная обратная связь
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.6667 5L7.5 14.1667L3.33333 10" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            copyBtn.style.opacity = '0.7';

            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.opacity = '1';
            }, 1500);
        }).catch(err => {
            console.error('Ошибка копирования:', err);
        });
    });

    // Редирект на главную
    document.addEventListener('click', (e) => {
        const homeBtn = e.target.closest('.js-go-home');
        if (homeBtn) {
            e.preventDefault();
            window.location.href = '/';
        }
    });

});

/**
 * LGT FRONT
 * Требует:
 * window.JWT_TOKEN
 */

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getLgtProof() {
  const jwt = window.JWT_TOKEN;
  if (!jwt) throw new Error("JWT not found");

  const res = await fetch("/lgt", {
    credentials: "include"
  });

  if (!res.ok) throw new Error("LGT challenge failed");
  const { nonce, ts } = await res.json();

  let acc = 0;
  const base = jwt.slice(0, 32) + nonce + ts;

  for (let i = 0; i < base.length; i++) {
    acc += base.charCodeAt(i) * (i + 7);
  }

  acc += (navigator.hardwareConcurrency || 1) * 31;
  acc += Math.floor(performance.now() % 1000);

  const lgt = await sha256Hex(acc.toString());

  return { jwt, nonce, ts, lgt };
}

async function secureRequest(url, payload) {
  const proof = await getLgtProof();

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...payload,
      ...proof
    })
  });
}
