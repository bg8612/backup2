document.addEventListener("DOMContentLoaded", () => {
  const productTitleEl = document.querySelector(".product-details__title");
  const productPriceEl = document.querySelector(".product-details__price");
  const mainImageEl = document.querySelector(".product-details__main-image img");
  const placeholderEl = document.querySelector(".product-image-placeholder");
  // const descriptionTextEl = document.querySelector(".product-description__text");
  const favButton = document.querySelector(".product-details__fav-btn");

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  if (!productId) {
    if (productTitleEl) productTitleEl.textContent = "Товар не найден";
    return;
  }

  if (favButton) {
    favButton.setAttribute('data-product-id', productId);
  }

  function fetchWithTimeout(url, options = {}, timeout = 15000) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), timeout)
      )
    ]);
  }

  // Функция загрузки изображения с retry механизмом
  function loadImageWithRetry(src, maxRetries = 3, timeout = 30000) {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const tryLoad = () => {
        attempts++;
        const img = new Image();

        const timeoutId = setTimeout(() => {
          img.src = ''; // Прерываем загрузку
          if (attempts < maxRetries) {
            console.log(`Retry loading image (${attempts}/${maxRetries}):`, src);
            setTimeout(tryLoad, 1000 * attempts); // Экспоненциальная задержка
          } else {
            reject(new Error('Image load timeout after ' + maxRetries + ' attempts'));
          }
        }, timeout);

        img.onload = () => {
          clearTimeout(timeoutId);
          resolve(src);
        };

        img.onerror = () => {
          clearTimeout(timeoutId);
          if (attempts < maxRetries) {
            console.log(`Retry loading image after error (${attempts}/${maxRetries}):`, src);
            setTimeout(tryLoad, 1000 * attempts); // Экспоненциальная задержка
          } else {
            reject(new Error('Image load failed after ' + maxRetries + ' attempts'));
          }
        };

        img.src = src;
      };

      tryLoad();
    });
  }

  // Функция fetch с retry механизмом для API запросов
  function fetchWithRetry(url, options = {}, maxRetries = 3, timeout = 30000) {
    let attempts = 0;

    const tryFetch = () => {
      attempts++;
      console.log(`API request attempt ${attempts}/${maxRetries}:`, url);

      return fetchWithTimeout(url, options, timeout)
        .then(response => {
          // Успешный ответ - возвращаем его
          console.log(`API request successful (attempt ${attempts}):`, url, 'Status:', response.status);
          return response;
        })
        .catch((error) => {
          console.warn(`API request failed (attempt ${attempts}/${maxRetries}):`, url, 'Error:', error.message);

          // Если есть еще попытки и это таймаут или сетевая ошибка - пробуем снова
          if (attempts < maxRetries && (error.message === 'TIMEOUT' || error.message.includes('Failed to fetch'))) {
            console.log(`Retrying API request in ${attempts} seconds...`);
            return new Promise(resolve =>
              setTimeout(() => resolve(tryFetch()), 1000 * attempts)
            );
          }

          // Исчерпаны попытки или критическая ошибка
          throw error;
        });
    };

    return tryFetch();
  }

  // Нормализация URL files.axoshop.ru: http → https
  function normalizeFilesUrl(url) {
    if (!url) return url;
    const str = String(url);
    // Заменяем http://files.axoshop.ru на https://files.axoshop.ru
    return str.replace(/^http:\/\/files\.axoshop\.ru\//i, 'https://files.axoshop.ru/');
  }

  // ============================================================================
  // СИСТЕМА ОПРЕДЕЛЕНИЯ И КАСТОМИЗАЦИИ ТИПОВ ТОВАРОВ
  // ============================================================================
  //
  // Типы товаров:
  // - 'regular'    → "Подписка" (дефолт) или "Пополнение" (для игр)
  // - 'gift_card'  → "Gift Card"
  // - 'code'       → "Code"
  //
  // Определение типа (detectProductType):
  // 1. Анализ названия продукта (приоритет)
  // 2. Анализ вариантов (если >50% содержат ключевое слово)
  // 3. Fallback → 'regular'
  //
  // Кастомизация названий (getProductTypeLabel):
  // - Для игр из списка gamesWithTopUp: 'regular' → "Пополнение"
  // - Для остальных товаров: 'regular' → "Подписка"
  //
  // Как добавить новую игру:
  // Просто добавьте ключевое слово в массив gamesWithTopUp (lowercase)
  // ============================================================================

  // Определение типа товара по конфигурации
  function detectProductTypeByConfig(productId, categoryName = '', variantName = '') {
    const config = PRODUCT_TYPE_CONFIG[productId];
    if (!config) return null;

    // Определение по категориям
    if (config.level === 'category' && categoryName) {
      const type = config.rules[categoryName];
      if (type) return type;
    }

    // Определение по вариациям
    if (config.level === 'variation' && variantName && Array.isArray(config.rules)) {
      for (const rule of config.rules) {
        if (rule.pattern.test(variantName)) {
          return rule.type;
        }
      }
    }

    return null;
  }

  // Legacy: Определение типа товара (Gift Card, Code, Regular)
  function detectProductType(product) {
    if (!product) return 'regular';

    const productName = String(product.name || '').toLowerCase();

    // Приоритет 1: Проверка названия продукта
    // Gift Card: содержит "gift card" или "gift-card"
    if (/gift[\s-]?card/i.test(productName)) {
      return 'gift_card';
    }

    // Code: содержит "code" (но не "gift card code")
    if (/\bcode\b/i.test(productName) && !/gift[\s-]?card/i.test(productName)) {
      return 'code';
    }

    // Приоритет 2: Анализ вариантов (если >50% содержат ключевое слово)
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      const variantNames = product.variants.map(v => String(v.variant_name || '').toLowerCase());

      const giftCardCount = variantNames.filter(name => /gift[\s-]?card/i.test(name)).length;
      const giftCardRatio = giftCardCount / variantNames.length;

      const codeCount = variantNames.filter(name => /\bcode\b/i.test(name) && !/gift[\s-]?card/i.test(name)).length;
      const codeRatio = codeCount / variantNames.length;

      if (giftCardRatio > 0.5) return 'gift_card';
      if (codeRatio > 0.5) return 'code';
    }

    // Fallback: обычный товар (подписка/пополнение)
    return 'regular';
  }

  // ============================================================================
  // РАСШИРЕННАЯ КОНФИГУРАЦИЯ ТИПОВ ТОВАРОВ
  // ============================================================================

  // Все доступные типы товаров
  const PRODUCT_TYPES = {
    SUBSCRIPTION: 'subscription',    // Подписка
    CARD: 'card',                   // Карта
    PASS: 'pass',                   // Пасс
    GEMS: 'gems',                   // Гемы
    BUNDLE: 'bundle',               // Набор
    CURRENCY: 'currency',           // Валюта
    TOP_UP: 'top_up',              // Пополнение
    LEAGUE: 'league',              // Лига
    RIFT: 'rift',                  // Рифт
    MOBILE: 'mobile',              // Мобайл
    LITE: 'lite',                  // Лайт
    CODE: 'code',                  // Код
    GIFT_CARD: 'gift_card',        // Gift Card (legacy)
    REGULAR: 'regular'             // Обычный (legacy fallback)
  };

  // Лейблы для всех типов
  const TYPE_LABELS = {
    [PRODUCT_TYPES.SUBSCRIPTION]: 'Подписка',
    [PRODUCT_TYPES.CARD]: 'Карта',
    [PRODUCT_TYPES.PASS]: 'Пасс',
    [PRODUCT_TYPES.GEMS]: 'Гемы',
    [PRODUCT_TYPES.BUNDLE]: 'Набор',
    [PRODUCT_TYPES.CURRENCY]: 'Валюта',
    [PRODUCT_TYPES.TOP_UP]: 'Пополнение',
    [PRODUCT_TYPES.LEAGUE]: 'Лига',
    [PRODUCT_TYPES.RIFT]: 'Рифт',
    [PRODUCT_TYPES.MOBILE]: 'Мобайл',
    [PRODUCT_TYPES.LITE]: 'Лайт',
    [PRODUCT_TYPES.CODE]: 'Код',
    [PRODUCT_TYPES.GIFT_CARD]: 'Gift Card',
    [PRODUCT_TYPES.REGULAR]: 'Подписка'
  };

  // Конфигурация типов для конкретных товаров (по ID)
  const PRODUCT_TYPE_CONFIG = {
    // Spotify — 1106 (по категориям)
    '1106': {
      level: 'category',
      rules: {
        'MY': PRODUCT_TYPES.SUBSCRIPTION,
        'SG': PRODUCT_TYPES.SUBSCRIPTION,
        'ID': PRODUCT_TYPES.SUBSCRIPTION,
        'US': PRODUCT_TYPES.CARD
      }
    },

    // Clash of Clans — 1110 (по вариациям)
    '1110': {
      level: 'variation',
      rules: [
        { pattern: /gold pass/i, type: PRODUCT_TYPES.PASS },
        { pattern: /gems/i, type: PRODUCT_TYPES.GEMS }
      ]
    },

    // Clash Royale — 1112 (по вариациям)
    '1112': {
      level: 'variation',
      rules: [
        { pattern: /gold pass|diamond pass/i, type: PRODUCT_TYPES.PASS },
        { pattern: /gems/i, type: PRODUCT_TYPES.GEMS }
      ]
    },

    // Brawl Stars — 1109 (по вариациям)
    '1109': {
      level: 'variation',
      rules: [
        { pattern: /brawl pass/i, type: PRODUCT_TYPES.PASS },
        { pattern: /gems/i, type: PRODUCT_TYPES.GEMS }
      ]
    },

    // Mobile Legends — 1531 (по вариациям)
    '1531': {
      level: 'variation',
      rules: [
        { pattern: /value pack|elite bundle/i, type: PRODUCT_TYPES.BUNDLE },
        { pattern: /pass/i, type: PRODUCT_TYPES.PASS },
        { pattern: /diamond|m-cash/i, type: PRODUCT_TYPES.CURRENCY }
      ]
    },

    // Zenless Zone Zero — 1439 (по вариациям)
    '1439': {
      level: 'variation',
      rules: [
        { pattern: /guarantee pack|all pack/i, type: PRODUCT_TYPES.BUNDLE },
        { pattern: /monochrome/i, type: PRODUCT_TYPES.CURRENCY },
        { pattern: /membership/i, type: PRODUCT_TYPES.PASS }
      ]
    },

    // Honkai: Star Rail — 1443 (по вариациям)
    '1443': {
      level: 'variation',
      rules: [
        { pattern: /guarantee bundle|all pack/i, type: PRODUCT_TYPES.BUNDLE },
        { pattern: /oneiric shard/i, type: PRODUCT_TYPES.CURRENCY },
        { pattern: /supply pass/i, type: PRODUCT_TYPES.PASS }
      ]
    },

    // Genshin Impact — 1441 (по вариациям)
    '1441': {
      level: 'variation',
      rules: [
        { pattern: /guarantee|all pack/i, type: PRODUCT_TYPES.BUNDLE },
        { pattern: /genesis crystal|chronal nexus/i, type: PRODUCT_TYPES.CURRENCY },
        { pattern: /welkin moon/i, type: PRODUCT_TYPES.PASS }
      ]
    },

    // Valorant — 1116 (по категориям, нормализованные в uppercase)
    '1116': {
      level: 'category',
      rules: {
        'MALAYSIA': PRODUCT_TYPES.TOP_UP,
        'INDONESIA': PRODUCT_TYPES.TOP_UP,
        'PHILIPPINES': PRODUCT_TYPES.TOP_UP,
        'THAILAND': PRODUCT_TYPES.TOP_UP,
        'SINGAPORE': PRODUCT_TYPES.TOP_UP,
        'CAMBODIA': PRODUCT_TYPES.TOP_UP,
        'MY': PRODUCT_TYPES.CARD
      }
    },

    // League of Legends — 1115 (по категориям, нормализованные в uppercase)
    '1115': {
      level: 'category',
      rules: {
        'LEAGUE OF LEGENDS GIFT CARD US': PRODUCT_TYPES.CARD,
        'LEAGUE OF LEGENDS GIFT CARD EU': PRODUCT_TYPES.CARD,
        'LEAGUE OF LEGENDS GIFT CARD BR': PRODUCT_TYPES.CARD,
        'LEAGUE OF LEGENDS GIFT CARD TR': PRODUCT_TYPES.CARD,
        'LEAGUE OF LEGENDS GIFT CARD JP': PRODUCT_TYPES.CARD,
        'LEAGUE OF LEGENDS GIFT CARD KR': PRODUCT_TYPES.CARD,
        'LEAGUE OF LEGENDS GIFT CARD UK': PRODUCT_TYPES.CARD,
        'LEAGUE OF LEGENDS GIFT CARD MX': PRODUCT_TYPES.CARD,
        'MALAYSIA': PRODUCT_TYPES.LEAGUE,
        'PHILIPPINES': PRODUCT_TYPES.LEAGUE,
        'INDONESIA': PRODUCT_TYPES.LEAGUE,
        'THAILAND': PRODUCT_TYPES.LEAGUE,
        'SINGAPORE': PRODUCT_TYPES.LEAGUE,
        'CAMBODIA': PRODUCT_TYPES.LEAGUE,
        'MY': PRODUCT_TYPES.RIFT,
        'PH': PRODUCT_TYPES.RIFT,
        'ID': PRODUCT_TYPES.RIFT,
        'TH': PRODUCT_TYPES.RIFT,
        'SG': PRODUCT_TYPES.RIFT,
        'KH': PRODUCT_TYPES.RIFT
      }
    },

    // PUBG Mobile — 1118 (по категориям, нормализованные в uppercase)
    '1118': {
      level: 'category',
      rules: {
        'GLOBAL': PRODUCT_TYPES.MOBILE,
        'MY': PRODUCT_TYPES.MOBILE,
        'INDONESIA': PRODUCT_TYPES.MOBILE,
        'SG': PRODUCT_TYPES.MOBILE,
        'RU': PRODUCT_TYPES.MOBILE,
        'MY (PUBG MOBILE LITE)': PRODUCT_TYPES.LITE,
        'PUBG MOBILE PREPAID CODE': PRODUCT_TYPES.CODE
      }
    }
  };

  // Legacy: Список игр, использующих маппинг "Пополнение" (для обратной совместимости)
  const gamesWithTopUp = [
    'valorant',
    'genshin impact',
    'honkai: star rail',
    'honkai star rail',
    'mobile legends',
    'call of duty',
    'pubg',
    'free fire'
  ];

  // Legacy: Дефолтные лейблы (для обратной совместимости)
  const defaultTypeLabels = {
    'gift_card': 'Gift Card',
    'code': 'Code',
    'regular': 'Подписка'
  };

  // Получение читаемого названия типа товара
  function getProductTypeLabel(type, productName = '') {
    // Сначала проверяем новые типы
    if (TYPE_LABELS[type]) {
      return TYPE_LABELS[type];
    }

    // Legacy: поддержка старых типов
    const validTypes = ['gift_card', 'code', 'regular'];
    if (!validTypes.includes(type)) {
      console.warn(`[getProductTypeLabel] Unknown type: "${type}", falling back to "regular"`);
      type = 'regular';
    }

    // Если название продукта не передано, возвращаем дефолт
    if (!productName) {
      return defaultTypeLabels[type] || defaultTypeLabels.regular;
    }

    const normalizedProductName = String(productName).toLowerCase().trim();

    // Проверяем, относится ли продукт к играм с пополнением
    const isGameWithTopUp = gamesWithTopUp.some(game =>
      normalizedProductName.includes(game)
    );

    if (isGameWithTopUp) {
      const gameTopUpLabels = {
        'regular': 'Пополнение',
        'gift_card': 'Gift Card',
        'code': 'Code'
      };
      return gameTopUpLabels[type] || defaultTypeLabels[type] || defaultTypeLabels.regular;
    }

    // Для всех остальных товаров используем дефолтные лейблы
    return defaultTypeLabels[type] || defaultTypeLabels.regular;
  }

  [productTitleEl, productPriceEl].forEach(el => {
    if(el) el.classList.add('skeleton', 'skeleton-text');
  });

  const mainImageParent = document.querySelector(".product-details__main-image");
  if (mainImageParent) mainImageParent.classList.add('skeleton');

  function isMassiveId(id) {
    return /^\d{4,5}$/.test(id);
  }

  if (isMassiveId(productId)) {
    loadMassiveProducts(productId);
  } else {
    // Пробуем загрузить как обычный товар, но проверим на наличие productInfo.data.variants
    loadRegularProduct();
  }

  function loadMassiveProducts(id) {
    const MASSIVE_API_URL = `https://api.axoshop.ru/api/products/info/${id}`;

    fetchWithRetry(MASSIVE_API_URL, {}, 3, 30000)
      .then((response) => {
        if (response.status === 403) {
          window.location.href = '/pages/404.html';
          return null;
        }
        if (response.status === 502) {
          throw new Error('502');
        }
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }
        return response.json();
      })
      .then(async (data) => {
        if (!data) return;

        // НОВЕЙШИЙ ФОРМАТ ПРОВАЙДЕРА: [{ categoryId, categoryTitle, name, title, data: { success, message, data: [...] } }]
        if (Array.isArray(data) && data.length > 0 &&
            data[0].data &&
            data[0].data.success !== undefined &&
            Array.isArray(data[0].data.data)) {

          const categoryId = data[0].categoryId || parseInt(id);

          // Преобразуем каждую группу в отдельную категорию
          const groupedData = [];

          data.forEach(group => {
            if (group.data && group.data.data && Array.isArray(group.data.data)) {
              // Создаём объект продукта с вариантами
              const product = {
                name: group.name,
                categoryId: group.categoryId,
                variants: group.data.data.map(option => ({
                  variant_id: option.id,
                  variant_name: option.title || option.name || option.value,
                  variant_price: option.price,
                  product_id: option.product_id
                }))
              };

              // Каждая группа становится отдельной категорией
              groupedData.push({
                category: group.name, // Используем name как название категории (содержит регион)
                categoryId: group.categoryId,
                products: [product]
              });
            }
          });

          // Помечаем кнопку избранного
          if (favButton) {
            favButton.setAttribute('data-type', 'category');
          }

          // Получаем картинку категории
          let categoryImageUrl = null;
          try {
            categoryImageUrl = await loadCategoryImage(categoryId);
          } catch (error) {
            console.warn('Не удалось загрузить картинку категории:', error);
          }

          renderMassiveProduct(groupedData, categoryImageUrl);
          return;
        }

        // НОВЫЙ ФОРМАТ: Проверяем обёртку [{ categoryId, name, title, data: [...] }]
        if (Array.isArray(data) && data.length > 0 && data[0].data !== undefined && Array.isArray(data[0].data)) {
          // Извлекаем categoryId из обёртки
          const categoryId = data[0].categoryId || parseInt(id);

          // Объединяем все data массивы (если несколько элементов)
          let mergedData = [];
          data.forEach(item => {
            if (item.data && Array.isArray(item.data)) {
              mergedData = mergedData.concat(item.data);
            }
          });

          // Помечаем кнопку избранного
          if (favButton) {
            favButton.setAttribute('data-type', 'category');
          }

          // Получаем картинку категории
          let categoryImageUrl = null;
          try {
            categoryImageUrl = await loadCategoryImage(categoryId);
          } catch (error) {
            console.warn('Не удалось загрузить картинку категории:', error);
          }

          renderMassiveProduct(mergedData, categoryImageUrl);
          return;
        }

        // СТАРЫЙ ФОРМАТ: [{ category, products }]
        if (Array.isArray(data) && data.length > 0 && data[0].category !== undefined) {
          // Это massive товар (категория) - помечаем кнопку избранного
          if (favButton) {
            favButton.setAttribute('data-type', 'category');
          }

          // Получаем картинку категории для massive товара
          let categoryImageUrl = null;

          try {
            // Проверяем, есть ли categoryId в данных massive API
            let categoryId = null;

            // Вариант 1: categoryId может быть в корне первого элемента
            if (data[0] && data[0].categoryId) {
              categoryId = data[0].categoryId;
            }
            // Вариант 2: categoryId может быть в первом продукте
            else if (data[0] && data[0].products && data[0].products[0] && data[0].products[0].categoryId) {
              categoryId = data[0].products[0].categoryId;
            }
            // Вариант 3: Используем ID товара как categoryId (как было изначально)
            else {
              categoryId = parseInt(id);
            }

            // Если получили categoryId, запрашиваем картинку категории
            if (categoryId) {
              categoryImageUrl = await loadCategoryImage(categoryId);
            }
          } catch (error) {
            console.warn('Не удалось загрузить картинку категории:', error);
          }

          renderMassiveProduct(data, categoryImageUrl);
        } else {
          disableSkeleton();
          if (productTitleEl) productTitleEl.textContent = "Неверный формат данных";
          // if (descriptionTextEl) {
          //   descriptionTextEl.innerHTML = "<p>Не удалось загрузить информацию о товаре.</p>";
          // }
        }
      })
      .catch((error) => {
        console.error("Ошибка загрузки massive товара после всех попыток:", {
          error: error.message,
          url: MASSIVE_API_URL,
          productId: id,
          timestamp: new Date().toISOString()
        });

        disableSkeleton();

        if (error.message === 'TIMEOUT') {
          if (productTitleEl) productTitleEl.textContent = "Превышено время ожидания";
          console.error("Товар не загрузился из-за таймаута после 3 попыток");
          return;
        }

        if (error.message === '502') {
          if (productTitleEl) productTitleEl.textContent = "Сервер временно недоступен";
          console.error("Ошибка 502 от сервера");
          return;
        }

        if (error.message.startsWith('HTTP_')) {
          const status = error.message.split('_')[1];
          if (productTitleEl) productTitleEl.textContent = `Ошибка загрузки (${status})`;
          console.error(`HTTP ошибка ${status}`);
          return;
        }

        if (productTitleEl) {
          productTitleEl.textContent = "Не удалось загрузить товар";
        }
      });
  }


  function disableSkeleton() {
    [productTitleEl, productPriceEl].forEach(el => {
      if(el) {
          el.classList.remove('skeleton', 'skeleton-text');
      }
    });
    if (mainImageParent) mainImageParent.classList.remove('skeleton');
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Helper для проверки валидности URL изображения
  function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    // Проверяем, что это HTTP(S) ссылка
    return /^https?:\/\//i.test(url.trim());
  }

  // Helper для генерации WebP версии URL изображения
  function getWebPUrl(url) {
    if (!url || typeof url !== 'string') return null;
    // Заменяем расширение на .webp (поддерживаем jpg, jpeg, png)
    return url.replace(/\.(jpe?g|png)$/i, '.webp');
  }

  // Helper для проверки, имеет ли URL поддерживаемое расширение для WebP конвертации
  function hasConvertibleExtension(url) {
    if (!url || typeof url !== 'string') return false;
    return /\.(jpe?g|png)$/i.test(url);
  }

  // Очистка названия товара от текста в скобках
  function cleanProductTitle(title) {
    if (!title) return "";
    return String(title)
      .replace(/\([^)]*\)/g, '') // Удаляем все (текст в скобках)
      .replace(/\s+/g, ' ')       // Нормализуем множественные пробелы
      .trim();                     // Убираем пробелы по краям
  }

  // Унифицированная функция для загрузки картинки категории
  async function loadCategoryImage(categoryId) {
    if (!categoryId) return null;

    try {
      const response = await fetchWithRetry(
        `https://api.axoshop.ru/api/categories/${categoryId}/image`,
        {},
        3,
        30000
      );

      if (response.ok) {
        const data = await response.json();
        // Проверяем разные варианты полей (image_url, imageUrl, image)
        const imageUrl = data.image_url || data.imageUrl || data.image;
        if (imageUrl) {
          return normalizeFilesUrl(imageUrl);
        }
      }
    } catch (error) {
      console.warn('Не удалось загрузить картинку категории:', error);
    }

    return null;
  }

  // Функция загрузки обычного товара (существующая логика)
  function loadRegularProduct() {
    const API_URL = `https://api.axoshop.ru/api/products/${productId}`;

    return fetchWithRetry(API_URL, {}, 3, 30000)
      .then((response) => {
        // Обработка 403 - редирект на 404
        if (response.status === 403) {
          window.location.href = '/pages/404.html';
          return null;
        }
        if (!response.ok) {
          throw new Error(`Ошибка сети: ${response.status}`);
        }
        return response.json();
      })
      .then(async (product) => {
        if (!product) return; // 403 редирект уже выполнен

        // НОВАЯ ПРОВЕРКА: Проверяем, есть ли productInfo как массив (структура massive products)
        if (Array.isArray(product.productInfo) && product.productInfo.length > 0) {
          // Это товар с массивом productInfo - обрабатываем как massive product
          // Получаем картинку категории
          let categoryImageUrl = null;

          try {
            if (product.categoryId) {
              categoryImageUrl = await loadCategoryImage(product.categoryId);
            }
          } catch (error) {
            console.warn('Не удалось загрузить картинку категории:', error);
          }

          // Помечаем кнопку избранного как категорию
          if (favButton) {
            favButton.setAttribute('data-type', 'category');
          }

          // Рендерим как massive product
          renderMassiveProduct(product.productInfo, categoryImageUrl);
          return;
        }

        // НОВАЯ ПРОВЕРКА: Проверяем формат { success, message, data: [...] }
        if (product.productInfo && product.productInfo.success && Array.isArray(product.productInfo.data)) {
          // Это товар с простыми вариантами в формате { id, name, value, price, product_id }
          renderSimpleVariantsProduct(product);
          return;
        }

        // Проверяем, есть ли productInfo.data.variants (старый третий тип товара)
        if (product.productInfo && product.productInfo.data && product.productInfo.data.variants) {
          // Это товар с вариантами в productInfo - обрабатываем как специальный тип
          renderProductWithVariants(product);
          return;
        }

        disableSkeleton();

        const rawTitle = product.title || product.name || "Название товара";
        const title = cleanProductTitle(rawTitle);
        document.title = `${title} — AxoShop`;

        if (productTitleEl) {
          productTitleEl.textContent = title;
        }
        if (productPriceEl) {
          productPriceEl.textContent = `${product.price} ₽`;
        }

        // Скрываем блоки категорий и вариантов для обычных товаров
        const categoryBlock = document.querySelector('.product-details__category-block');
        const periodBlock = document.querySelector('.product-details__period-block');
        if (categoryBlock) categoryBlock.style.display = 'none';
        if (periodBlock) periodBlock.style.display = 'none';

        // Логика галереи
        let images = [];
        if (Array.isArray(product.images) && product.images.length > 0) {
          images = product.images.map(img => {
              if (typeof img === 'string') return img;
              return img?.url || img?.image || img?.image_url || null;
          }).filter(url => typeof url === 'string' && url.trim() !== '')
            .map(url => normalizeFilesUrl(url)); // Нормализуем все URL
        }

        if (images.length === 0) {
          // Проверяем поля в порядке приоритета
          const candidates = [
            product.imageUrl,
            product.image_url,
            product.image,
            product.url
          ];

          for (let candidate of candidates) {
            let imageUrl = candidate;

            // Если это объект, извлекаем вложенный URL
            if (typeof imageUrl === 'object' && imageUrl !== null) {
              imageUrl = imageUrl.url || imageUrl.image || imageUrl.image_url || null;
            }

            // Проверяем, что это валидная HTTP(S) ссылка
            if (isValidImageUrl(imageUrl)) {
              // Нормализуем URL: http → https для files.axoshop.ru
              images = [normalizeFilesUrl(imageUrl)];
              break;
            }
          }
        }

        const galleryItems = [images[0] || null, ...images.slice(1)];

        const setMainImage = (src) => {
          if (src) {
            // Устанавливаем изображение НЕМЕДЛЕННО - браузер загрузит сам
            const webpUrl = hasConvertibleExtension(src) ? getWebPUrl(src) : null;

            if (mainImageEl && mainImageParent) {
              // Если есть WebP версия, создаем picture элемент
              if (webpUrl) {
                // Удаляем старый img если есть
                const oldImg = mainImageParent.querySelector('img');
                if (oldImg) oldImg.remove();

                // Создаем picture с WebP поддержкой
                const picture = document.createElement('picture');

                const sourceWebP = document.createElement('source');
                sourceWebP.srcset = webpUrl;
                sourceWebP.type = 'image/webp';

                const img = document.createElement('img');
                img.src = src;
                img.alt = title;
                img.style.display = 'block';
                img.loading = 'eager';

                // Retry при ошибке (неблокирующий)
                let retryCount = 0;
                img.onerror = () => {
                  retryCount++;
                  if (retryCount < 3) {
                    console.log(`Retry loading image (${retryCount}/3):`, src);
                    setTimeout(() => {
                      img.src = src + '?retry=' + retryCount;
                    }, 1000 * retryCount);
                  } else {
                    console.error('Image failed after 3 attempts');
                    picture.style.display = 'none';
                    if (placeholderEl) placeholderEl.style.display = 'flex';
                  }
                };

                picture.appendChild(sourceWebP);
                picture.appendChild(img);
                mainImageParent.appendChild(picture);
              } else {
                // Обычное изображение без WebP
                mainImageEl.src = src;
                mainImageEl.alt = title;
                mainImageEl.style.display = 'block';
                mainImageEl.loading = 'eager';

                // Retry при ошибке (неблокирующий)
                let retryCount = 0;
                mainImageEl.onerror = () => {
                  retryCount++;
                  if (retryCount < 3) {
                    console.log(`Retry loading image (${retryCount}/3):`, src);
                    setTimeout(() => {
                      mainImageEl.src = src + '?retry=' + retryCount;
                    }, 1000 * retryCount);
                  } else {
                    console.error('Image failed after 3 attempts');
                    mainImageEl.style.display = 'none';
                    if (placeholderEl) placeholderEl.style.display = 'flex';
                  }
                };
              }
            }
            if (placeholderEl) placeholderEl.style.display = 'none';
          } else {
            if (mainImageEl) {
              mainImageEl.style.display = 'none';
              mainImageEl.removeAttribute('src');
            }
            if (placeholderEl) placeholderEl.style.display = 'flex';
          }
        };

        setMainImage(galleryItems[0]);

        const thumbsContainer = document.querySelector('.product-details__thumbs');
        if (thumbsContainer) {
          thumbsContainer.innerHTML = '';
          
          const getPlaceholderContent = () => {
              if (!placeholderEl) return null;
              const content = placeholderEl.querySelector('svg');
              return content ? content.cloneNode(true) : null;
          };

          galleryItems.forEach((imgUrl, index) => {
            const btn = document.createElement('button');
            btn.className = 'product-details__thumb';
            btn.setAttribute('aria-label', 'Посмотреть изображение ' + (index + 1));
            btn.dataset.fullSrc = imgUrl || '';

            // Первая миниатюра активна по умолчанию
            if (index === 0) {
              btn.classList.add('product-details__thumb--active');
            }

            // Сохраняем WebP URL если доступен
            if (imgUrl && hasConvertibleExtension(imgUrl)) {
              btn.dataset.webpSrc = getWebPUrl(imgUrl);
            }

            if (imgUrl) {
              const img = document.createElement('img');
              img.src = imgUrl;
              img.alt = 'Thumbnail ' + (index + 1);
              img.loading = 'lazy';

              img.onerror = () => {
                  btn.innerHTML = '';
                  const ph = getPlaceholderContent();
                  if (ph) btn.appendChild(ph);
                  btn.dataset.fullSrc = '';
                  btn.dataset.webpSrc = '';
              };

              btn.appendChild(img);
            } else {
              const ph = getPlaceholderContent();
              if (ph) btn.appendChild(ph);
            }

            thumbsContainer.appendChild(btn);
          });
        }

        // Обновляем кэш изображений темы после загрузки товара
        if (window.themeManager && window.themeManager.refreshThemeImagesCache) {
          window.themeManager.refreshThemeImagesCache();
        }

        // if (descriptionTextEl) {
        //   const rawDesc = product.description || "";
        //   const safeDesc = sanitizeBasicHtml(rawDesc);
        //
        //   descriptionTextEl.innerHTML = safeDesc
        //     ? '<p>' + safeDesc.replace(/\n/g, '<br>') + '</p>'
        //     : "<p>Описание отсутствует.</p>";
        // }
      })
      .catch((error) => {
        console.error("Ошибка загрузки товара после всех попыток:", {
          error: error.message,
          url: API_URL,
          productId: productId,
          timestamp: new Date().toISOString()
        });

        disableSkeleton();

        if (error.message === 'TIMEOUT') {
          if (productTitleEl) {
            productTitleEl.textContent = "Превышено время ожидания";
          }
          console.error("Товар не загрузился из-за таймаута после 3 попыток");
          return;
        }

        if (error.message.startsWith('HTTP_')) {
          const status = error.message.split('_')[1];
          if (productTitleEl) {
            productTitleEl.textContent = `Ошибка загрузки (${status})`;
          }
          console.error(`HTTP ошибка ${status}`);
          return;
        }

        if (productTitleEl) {
          productTitleEl.textContent = "Не удалось загрузить товар";
        }
      });
  }

  // Функция рендеринга товара с простыми вариантами (формат: { success, data: [{ id, name, value, price }] })
  function renderSimpleVariantsProduct(product) {
    disableSkeleton();

    const rawTitle = product.name || "Название товара";
    const title = cleanProductTitle(rawTitle);
    document.title = `${title} — AxoShop`;

    if (productTitleEl) {
      productTitleEl.textContent = title;
    }

    // Скрываем блок категорий (он не нужен для этого типа товара)
    const categoryBlock = document.querySelector('.product-details__category-block');
    if (categoryBlock) categoryBlock.style.display = 'none';

    // Показываем блок вариантов
    const periodBlock = document.querySelector('.product-details__period-block');
    if (periodBlock) periodBlock.style.display = '';

    // Обработка изображения
    let imageUrl = product.imageUrl;

    // Функция для установки placeholder
    const showPlaceholder = () => {
      if (mainImageEl) mainImageEl.style.display = 'none';
      if (placeholderEl) placeholderEl.style.display = 'flex';
    };

    // Если imageUrl null, пробуем получить картинку категории
    if (!imageUrl && product.categoryId) {
      loadCategoryImage(product.categoryId)
        .then(catImageUrl => {
          if (catImageUrl) {
            setProductImageWithRetry(catImageUrl, title);
          } else {
            showPlaceholder();
          }
        })
        .catch(err => {
          console.warn('Не удалось загрузить картинку категории:', err);
          showPlaceholder();
        });
    } else if (imageUrl) {
      setProductImageWithRetry(normalizeFilesUrl(imageUrl), title);
    } else {
      showPlaceholder();
    }

    // Рендерим миниатюру
    const thumbsContainer = document.querySelector('.product-details__thumbs');
    if (thumbsContainer) {
      thumbsContainer.innerHTML = '';

      if (imageUrl) {
        const thumbBtn = document.createElement('button');
        thumbBtn.className = 'product-details__thumb product-details__thumb--active';
        thumbBtn.setAttribute('aria-label', 'Изображение товара');

        const thumbImg = document.createElement('img');
        thumbImg.src = normalizeFilesUrl(imageUrl);
        thumbImg.alt = 'Thumbnail';
        thumbImg.loading = 'lazy';

        thumbImg.onerror = () => {
          thumbBtn.innerHTML = '';
          if (placeholderEl) {
            const placeholderContent = placeholderEl.querySelector('svg');
            if (placeholderContent) {
              thumbBtn.appendChild(placeholderContent.cloneNode(true));
            }
          }
        };

        thumbBtn.appendChild(thumbImg);
        thumbsContainer.appendChild(thumbBtn);
      }
    }

    // Инициализируем глобальные переменные для payment
    window.selectedVariantId = null;
    window.currentFields = [];
    window.fieldValues = {};
    window.selectedProductType = null;

    // Преобразуем данные из формата { id, name, value, price, product_id } в формат variants
    const simpleVariants = product.productInfo.data.map(item => ({
      variant_id: item.id,
      variant_name: item.name || item.value,
      variant_price: item.price
    }));

    // Создаем псевдо-продукт для использования существующей логики
    const pseudoProduct = {
      name: product.name,
      variants: simpleVariants,
      fields: [] // Нет полей для этого типа товаров
    };

    // Рендерим варианты используя существующую функцию
    renderVariantsForTypeSimple([pseudoProduct]);
  }

  // Функция рендеринга товара с вариантами (третий тип: productInfo.data.variants)
  function renderProductWithVariants(product) {
    disableSkeleton();

    const productData = product.productInfo.data;
    const rawTitle = productData.name || product.name || "Название товара";
    const title = cleanProductTitle(rawTitle);
    document.title = `${title} — AxoShop`;

    if (productTitleEl) {
      productTitleEl.textContent = title;
    }

    // Скрываем блок категорий (он не нужен для этого типа товара)
    const categoryBlock = document.querySelector('.product-details__category-block');
    if (categoryBlock) categoryBlock.style.display = 'none';

    // Показываем блок вариантов
    const periodBlock = document.querySelector('.product-details__period-block');
    if (periodBlock) periodBlock.style.display = '';

    // Обработка изображения
    let imageUrl = product.imageUrl;

    // Функция для установки placeholder
    const showPlaceholder = () => {
      if (mainImageEl) mainImageEl.style.display = 'none';
      if (placeholderEl) placeholderEl.style.display = 'flex';
    };

    // Если imageUrl null, пробуем получить картинку категории
    if (!imageUrl && product.categoryId) {
      loadCategoryImage(product.categoryId)
        .then(catImageUrl => {
          if (catImageUrl) {
            setProductImageWithRetry(catImageUrl, title);
          } else {
            showPlaceholder();
          }
        })
        .catch(err => {
          console.warn('Не удалось загрузить картинку категории:', err);
          showPlaceholder();
        });
    } else if (imageUrl) {
      setProductImageWithRetry(normalizeFilesUrl(imageUrl), title);
    } else {
      // Нет imageUrl и нет categoryId - показываем placeholder сразу
      showPlaceholder();
    }

    // Рендерим миниатюру
    const thumbsContainer = document.querySelector('.product-details__thumbs');
    if (thumbsContainer) {
      thumbsContainer.innerHTML = '';

      if (imageUrl) {
        const thumbBtn = document.createElement('button');
        thumbBtn.className = 'product-details__thumb product-details__thumb--active';
        thumbBtn.setAttribute('aria-label', 'Изображение товара');

        const thumbImg = document.createElement('img');
        thumbImg.src = normalizeFilesUrl(imageUrl);
        thumbImg.alt = 'Thumbnail';
        thumbImg.loading = 'lazy';

        thumbImg.onerror = () => {
          thumbBtn.innerHTML = '';
          if (placeholderEl) {
            const placeholderContent = placeholderEl.querySelector('svg');
            if (placeholderContent) {
              thumbBtn.appendChild(placeholderContent.cloneNode(true));
            }
          }
        };

        thumbBtn.appendChild(thumbImg);
        thumbsContainer.appendChild(thumbBtn);
      }
    }

    // Инициализируем глобальные переменные для payment
    window.selectedVariantId = null;
    window.currentFields = [];
    window.fieldValues = {};
    window.selectedProductType = null;

    // Преобразуем данные в формат, совместимый с renderVariantsForType
    const variants = productData.variants || [];
    const fields = productData.fields && Array.isArray(productData.fields) ? productData.fields : [];

    // Создаем псевдо-продукт для использования существующей логики
    const pseudoProduct = {
      name: productData.name,
      variants: variants,
      fields: fields
    };

    // Рендерим варианты используя существующую функцию
    renderVariantsForTypeSimple([pseudoProduct]);
  }

  // Helper функция для установки изображения товара с retry механизмом
  function setProductImageWithRetry(src, title) {
    if (!src) {
      if (mainImageEl) mainImageEl.style.display = 'none';
      if (placeholderEl) placeholderEl.style.display = 'flex';
      return;
    }

    // Устанавливаем изображение НЕМЕДЛЕННО
    const webpUrl = hasConvertibleExtension(src) ? getWebPUrl(src) : null;

    if (mainImageEl && mainImageParent) {
      if (webpUrl) {
        const oldImg = mainImageParent.querySelector('img');
        if (oldImg) oldImg.remove();

        const picture = document.createElement('picture');
        const sourceWebP = document.createElement('source');
        sourceWebP.srcset = webpUrl;
        sourceWebP.type = 'image/webp';

        const img = document.createElement('img');
        img.src = src;
        img.alt = title;
        img.style.display = 'block';
        img.loading = 'eager';

        // Retry при ошибке (неблокирующий)
        let retryCount = 0;
        img.onerror = () => {
          retryCount++;
          if (retryCount < 3) {
            console.log(`Retry loading image (${retryCount}/3):`, src);
            setTimeout(() => {
              img.src = src + '?retry=' + retryCount;
            }, 1000 * retryCount);
          } else {
            console.error('Image failed after 3 attempts');
            picture.style.display = 'none';
            if (placeholderEl) placeholderEl.style.display = 'flex';
          }
        };

        picture.appendChild(sourceWebP);
        picture.appendChild(img);
        mainImageParent.appendChild(picture);
      } else {
        mainImageEl.src = src;
        mainImageEl.alt = title;
        mainImageEl.style.display = 'block';
        mainImageEl.loading = 'eager';

        // Retry при ошибке (неблокирующий)
        let retryCount = 0;
        mainImageEl.onerror = () => {
          retryCount++;
          if (retryCount < 3) {
            console.log(`Retry loading image (${retryCount}/3):`, src);
            setTimeout(() => {
              mainImageEl.src = src + '?retry=' + retryCount;
            }, 1000 * retryCount);
          } else {
            console.error('Image failed after 3 attempts');
            mainImageEl.style.display = 'none';
            if (placeholderEl) placeholderEl.style.display = 'flex';
          }
        };
      }
    }
    if (placeholderEl) placeholderEl.style.display = 'none';
  }

  // Helper функция для установки изображения товара (без retry, для обратной совместимости)
  function setProductImage(src, title) {
    if (!src) return;

    const webpUrl = hasConvertibleExtension(src) ? getWebPUrl(src) : null;

    if (mainImageEl && mainImageParent) {
      if (webpUrl) {
        const oldImg = mainImageParent.querySelector('img');
        if (oldImg) oldImg.remove();

        const picture = document.createElement('picture');
        const sourceWebP = document.createElement('source');
        sourceWebP.srcset = webpUrl;
        sourceWebP.type = 'image/webp';

        const img = document.createElement('img');
        img.src = src;
        img.alt = title;
        img.style.display = 'block';
        img.onerror = () => {
          picture.style.display = 'none';
          if (placeholderEl) placeholderEl.style.display = 'flex';
        };

        picture.appendChild(sourceWebP);
        picture.appendChild(img);
        mainImageParent.appendChild(picture);
      } else {
        mainImageEl.src = src;
        mainImageEl.alt = title;
        mainImageEl.style.display = 'block';
        mainImageEl.onerror = () => {
          mainImageEl.style.display = 'none';
          if (placeholderEl) placeholderEl.style.display = 'flex';
        };
      }
    }
    if (placeholderEl) placeholderEl.style.display = 'none';
  }

  // Упрощенная версия renderVariantsForType для товаров с productInfo
  function renderVariantsForTypeSimple(products) {
    const periodOptions = document.querySelector('.product-details__period-options');
    if (!periodOptions) return;

    periodOptions.innerHTML = '';

    if (!products || products.length === 0) {
      periodOptions.innerHTML = '<p style="padding: 10px;">Нет доступных вариантов</p>';
      if (productPriceEl) productPriceEl.textContent = '... ₽';
      return;
    }

    // Собираем все варианты
    const allVariants = [];
    products.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach(variant => {
          const cleanedName = window.formatVariantName
            ? window.formatVariantName(product.name, variant.variant_name, variant.variant_id)
            : (variant.variant_name || 'Вариант');

          allVariants.push({
            ...variant,
            productFields: product.fields || [],
            productName: product.name || '',
            cleanedName: cleanedName
          });
        });
      }
    });

    // Генерация коротких лейблов
    const variantsWithLabels = window.generateUniqueLabels
      ? window.generateUniqueLabels(
          allVariants.map(v => ({
            productName: v.productName,
            variantName: v.cleanedName,
            variantId: v.variant_id
          })),
          ''
        )
      : allVariants.map(v => ({
          variantId: v.variant_id,
          label: v.cleanedName
        }));

    const labelMap = new Map();
    variantsWithLabels.forEach(item => {
      labelMap.set(item.variantId, item.label);
    });

    // Функция извлечения числового значения
    function extractNumericValue(label) {
      const cleaned = label.replace(/[$€£¥₹₽₴₪₩,]/g, '').trim();
      const match = cleaned.match(/([\d.]+)\s*([KMB])?/i);
      if (!match) return null;

      let value = parseFloat(match[1]);
      const suffix = match[2]?.toUpperCase();

      if (suffix === 'K') value *= 1000;
      if (suffix === 'M') value *= 1000000;
      if (suffix === 'B') value *= 1000000000;

      return value;
    }

    function isMonetaryVariant(label) {
      return /[$€£¥₹₽₴₪₩]|^\d+[\d,.\s]*[KMB]?\s*[A-Z]{3}?$|^\d+[\d,.\s]*$|^[A-Z]{3}\s*\d+|^\d+[\d,.\s]*[KMB]?\s+\w+/i.test(label);
    }

    // Сортировка
    const firstLabel = labelMap.get(allVariants[0]?.variant_id);
    const shouldSort = firstLabel && isMonetaryVariant(firstLabel);

    if (shouldSort) {
      allVariants.sort((a, b) => {
        const labelA = labelMap.get(a.variant_id) || '';
        const labelB = labelMap.get(b.variant_id) || '';
        const valueA = extractNumericValue(labelA);
        const valueB = extractNumericValue(labelB);

        if (valueA !== null && valueB !== null) {
          return valueA - valueB;
        }
        if (valueA !== null) return -1;
        if (valueB !== null) return 1;
        return 0;
      });
    }

    // Рендерим кнопки вариантов
    const compactLabels = [];
    allVariants.forEach((variant) => {
      const variantBtn = document.createElement('button');
      variantBtn.type = 'button';
      variantBtn.className = 'product-details__period-btn';

      const compactLabel = labelMap.get(variant.variant_id) || variant.cleanedName;
      compactLabels.push(compactLabel);

      variantBtn.textContent = compactLabel;
      variantBtn.dataset.variantId = variant.variant_id;
      variantBtn.dataset.variantPrice = variant.variant_price || 0;

      variantBtn.addEventListener('click', () => {
        periodOptions.querySelectorAll('.product-details__period-btn').forEach(btn => {
          btn.classList.remove('product-details__period-btn--active');
        });
        variantBtn.classList.add('product-details__period-btn--active');

        window.selectedVariantId = variant.variant_id;

        if (productPriceEl) {
          productPriceEl.textContent = `${variant.variant_price || 0} ₽`;
        }

        window.currentFields = variant.productFields;
        window.fieldValues = {};
        renderFieldsInDescriptionSimple(window.currentFields);
      });

      periodOptions.appendChild(variantBtn);
    });

    // Автоматически выбираем первый вариант
    if (allVariants.length > 0) {
      const firstVariant = allVariants[0];
      const firstBtn = periodOptions.querySelector('.product-details__period-btn');

      if (firstBtn) {
        firstBtn.classList.add('product-details__period-btn--active');
        window.selectedVariantId = firstVariant.variant_id;

        if (productPriceEl) {
          productPriceEl.textContent = `${firstVariant.variant_price || 0} ₽`;
        }

        window.currentFields = firstVariant.productFields;
        window.fieldValues = {};
        renderFieldsInDescriptionSimple(window.currentFields);
      }
    }

    // Layout logic
    periodOptions.classList.remove('layout-cols-5', 'layout-cols-4', 'layout-cols-3', 'layout-cols-2', 'layout-chips');

    const countOptions = compactLabels.length;
    const font = '600 16px SF-Pro-Display-Semibold, sans-serif';
    const maxTextWidthPx = measureMaxTextWidth(compactLabels, font);

    const letterRegex = /^[a-zA-Zа-яА-ЯёЁ\s\/\-]+$/;
    const lettersOnlyCount = compactLabels.filter(l => letterRegex.test(l)).length;
    const lettersOnlyRatio = countOptions > 0 ? lettersOnlyCount / countOptions : 0;

    let useChips = false;
    if (countOptions >= 6 && lettersOnlyRatio >= 0.70 && maxTextWidthPx <= 200) {
      useChips = true;
    }

    if (useChips) {
      periodOptions.classList.add('layout-chips');
    } else {
      const deduction = 43;
      const availableWidth4 = (688 - 8 * 3) / 4 - deduction;
      const availableWidth3 = (688 - 8 * 2) / 3 - deduction;

      if (maxTextWidthPx <= availableWidth4) {
        periodOptions.classList.add('layout-cols-4');
      } else if (maxTextWidthPx <= availableWidth3) {
        periodOptions.classList.add('layout-cols-3');
      } else {
        periodOptions.classList.add('layout-cols-2');
      }
    }

    // Удаляем старую пагинацию вариантов если есть
    const periodBlock = document.querySelector('.product-details__period-block');
    if (periodBlock) {
      const oldPeriodNav = periodBlock.querySelector('.pagination-nav');
      if (oldPeriodNav) {
        oldPeriodNav.remove();
      }
    }

    // Создаем пагинацию для вариантов (Massive Products)
    const variantButtons = Array.from(periodOptions.querySelectorAll('.product-details__period-btn'));
    createPaginationSystem(periodOptions, variantButtons, `variant-page-${productId}`);
  }

  // Функция измерения максимальной ширины текста (общая для всех типов товаров)
  function measureMaxTextWidth(texts, font) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = font;

    let maxWidth = 0;
    texts.forEach(text => {
      const width = context.measureText(text).width;
      if (width > maxWidth) {
        maxWidth = width;
      }
    });

    return maxWidth;
  }

  // Универсальная система пагинации для сеток
  function createPaginationSystem(container, buttons, cacheKey) {
    if (!container || buttons.length === 0) return;

    // Получаем количество колонок из layout класса
    const getColumnsCount = () => {
      // На мобильных всегда 2 колонки
      if (window.innerWidth <= 768) {
        return 2;
      }

      if (container.classList.contains('layout-cols-5')) return 5;
      if (container.classList.contains('layout-cols-4')) return 4;
      if (container.classList.contains('layout-cols-3')) return 3;
      if (container.classList.contains('layout-cols-2')) return 2;
      if (container.classList.contains('layout-chips')) {
        // Для chips считаем сколько влезает в строку (примерно)
        return Math.floor(688 / 80); // ~8 элементов
      }
      return 3; // default
    };

    const cols = getColumnsCount();
    const itemsPerPage = cols * 3; // 3 строки
    const totalItems = buttons.length;

    // Если 3 строки или меньше - показываем все без пагинации
    if (totalItems <= itemsPerPage) {
      buttons.forEach(btn => {
        btn.style.removeProperty('display');
        btn.style.removeProperty('visibility');
        btn.style.removeProperty('position');
        btn.style.removeProperty('pointer-events');
      });
      return;
    }

    // Определяем допустимое количество элементов на 4-й строке
    // На мобильных (2 колонки) - только 1 элемент (чтобы не было 4 строк)
    // На desktop (3+ колонки) - до 2 элементов
    const isMobileCheck = window.innerWidth <= 768;
    const maxExtraItems = isMobileCheck ? 1 : 2;

    // Если на 4-й строке допустимое количество элементов - показываем все без пагинации
    if (totalItems <= itemsPerPage + maxExtraItems) {
      buttons.forEach(btn => {
        btn.style.removeProperty('display');
        btn.style.removeProperty('visibility');
        btn.style.removeProperty('position');
        btn.style.removeProperty('pointer-events');
      });
      return;
    }

    // Иначе создаем пагинацию
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Всегда начинаем с первой страницы
    let currentPage = 0;

    // Создаем контейнер для навигации
    const navContainer = document.createElement('div');
    navContainer.className = 'pagination-nav';

    // Левая стрелка
    const leftArrow = document.createElement('button');
    leftArrow.className = 'pagination-arrow pagination-arrow-left';
    leftArrow.innerHTML = `<svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.59794 1.551L4.09822 7.05078L9.59794 12.5505" stroke="currentColor" stroke-width="1.55556"/></svg>`;

    // Индикаторы страниц
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'pagination-dots';

    for (let i = 0; i < totalPages; i++) {
      const dot = document.createElement('button');
      dot.className = 'pagination-dot';
      dot.dataset.page = i;
      dotsContainer.appendChild(dot);
    }

    // Правая стрелка
    const rightArrow = document.createElement('button');
    rightArrow.className = 'pagination-arrow pagination-arrow-right';
    rightArrow.innerHTML = `<svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.55050 12.5505L9.05022 7.05078L3.55050 1.551" stroke="currentColor" stroke-width="1.55556"/></svg>`;

    navContainer.appendChild(leftArrow);
    navContainer.appendChild(dotsContainer);
    navContainer.appendChild(rightArrow);

    // Вставляем навигацию после контейнера
    container.parentElement.appendChild(navContainer);

    // Функция отображения страницы
    const showPage = (pageIndex, animate = true) => {
      if (pageIndex < 0 || pageIndex >= totalPages) return;

      currentPage = pageIndex;

      const startIdx = pageIndex * itemsPerPage;
      const endIdx = startIdx + itemsPerPage;

      // Функция для обновления видимости через физическое удаление/добавление
      const updateVisibility = () => {
        // Полностью очищаем контейнер
        container.innerHTML = '';

        // Добавляем только кнопки текущей страницы
        for (let idx = startIdx; idx < endIdx && idx < buttons.length; idx++) {
          container.appendChild(buttons[idx]);
        }
      };

      // Анимация перехода
      if (animate) {
        container.classList.add('pagination-transitioning');

        setTimeout(() => {
          updateVisibility();
          container.classList.remove('pagination-transitioning');
        }, 200);
      } else {
        updateVisibility();
      }

      // Обновляем индикаторы
      const dots = dotsContainer.querySelectorAll('.pagination-dot');
      dots.forEach((dot, idx) => {
        if (idx === pageIndex) {
          dot.classList.add('pagination-dot--active');
        } else {
          dot.classList.remove('pagination-dot--active');
        }
      });

      // Обновляем стрелки
      if (pageIndex === 0) {
        leftArrow.classList.add('pagination-arrow--disabled');
        leftArrow.disabled = true;
      } else {
        leftArrow.classList.remove('pagination-arrow--disabled');
        leftArrow.disabled = false;
      }

      if (pageIndex === totalPages - 1) {
        rightArrow.classList.add('pagination-arrow--disabled');
        rightArrow.disabled = true;
      } else {
        rightArrow.classList.remove('pagination-arrow--disabled');
        rightArrow.disabled = false;
      }
    };

    // Обработчики кликов
    leftArrow.addEventListener('click', () => {
      if (currentPage > 0) {
        showPage(currentPage - 1);
      }
    });

    rightArrow.addEventListener('click', () => {
      if (currentPage < totalPages - 1) {
        showPage(currentPage + 1);
      }
    });

    dotsContainer.querySelectorAll('.pagination-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const page = parseInt(dot.dataset.page, 10);
        showPage(page);
      });
    });

    // Улучшенная swipe поддержка для мобильных
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let touchStartTime = 0;
    let isSwiping = false;

    container.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
      touchStartTime = Date.now();
      isSwiping = false;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!isSwiping) {
        const touchCurrentX = e.changedTouches[0].clientX;
        const touchCurrentY = e.changedTouches[0].clientY;
        const diffX = Math.abs(touchCurrentX - touchStartX);
        const diffY = Math.abs(touchCurrentY - touchStartY);

        // Определяем направление свайпа: если горизонтальное движение больше вертикального
        if (diffX > diffY && diffX > 10) {
          isSwiping = true;
        }
      }
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      if (!isSwiping) return;

      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      handleSwipe();
    }, { passive: true });

    const handleSwipe = () => {
      const swipeThreshold = 50; // Минимальная дистанция для свайпа
      const maxSwipeTime = 500; // Максимальное время для свайпа (мс)
      const diffX = touchStartX - touchEndX;
      const diffY = Math.abs(touchStartY - touchEndY);
      const swipeTime = Date.now() - touchStartTime;

      // Проверяем, что это горизонтальный свайп (не вертикальный скролл)
      if (Math.abs(diffX) > swipeThreshold && Math.abs(diffX) > diffY && swipeTime < maxSwipeTime) {
        if (diffX > 0 && currentPage < totalPages - 1) {
          // Swipe left - next page
          showPage(currentPage + 1);
        } else if (diffX < 0 && currentPage > 0) {
          // Swipe right - previous page
          showPage(currentPage - 1);
        }
      }

      isSwiping = false;
    };

    // Показываем начальную страницу
    showPage(currentPage, false);

    // Возвращаем объект для управления
    return {
      refresh: () => showPage(currentPage, false),
      destroy: () => {
        navContainer.remove();
        storageContainer.remove();
      }
    };
  }

  // Упрощенная версия renderFieldsInDescription
  function renderFieldsInDescriptionSimple(fields) {
    const periodBlock = document.querySelector('.product-details__period-block');
    if (!periodBlock) return;

    const oldFieldsBlock = document.querySelector('.product-details__fields-block');
    if (oldFieldsBlock) {
      oldFieldsBlock.remove();
    }

    if (!fields || fields.length === 0) {
      return;
    }

    const fieldsBlock = document.createElement('div');
    fieldsBlock.className = 'product-details__fields-block';

    const fieldsLabel = document.createElement('span');
    fieldsLabel.className = 'product-details__label';
    fieldsLabel.textContent = 'параметры покупки';

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'product-details__fields-inputs';
    fieldsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin-top: 10px;';

    fields.forEach((fieldName) => {
      const inputWrapper = document.createElement('div');
      inputWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';

      const label = document.createElement('label');
      label.textContent = fieldName;
      label.style.cssText = 'font-size: 14px; color: var(--text-gray);';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Введите ' + fieldName;
      input.style.cssText = 'width: 100%; padding: 12px 15px; border: 2px solid #ECECEC; border-radius: 10px; font-family: SF-Pro-Display-Regular, sans-serif; font-size: 14px; transition: border-color 0.2s;';

      input.addEventListener('focus', () => {
        input.style.borderColor = '#000';
      });

      input.addEventListener('blur', () => {
        input.style.borderColor = '#ECECEC';
      });

      input.addEventListener('input', (e) => {
        window.fieldValues[fieldName] = e.target.value;
      });

      inputWrapper.appendChild(label);
      inputWrapper.appendChild(input);
      fieldsContainer.appendChild(inputWrapper);
    });

    fieldsBlock.appendChild(fieldsLabel);
    fieldsBlock.appendChild(fieldsContainer);

    periodBlock.after(fieldsBlock);
  }

  // Нормализация категорий: объединяем дубликаты (MY = Malaysia, ACTIVISION = Activison)
  function normalizeCategoryName(category) {
    if (!category) return 'OTHER';
    const normalized = String(category).trim().toUpperCase();

    // Маппинг полных названий стран к их кодам
    const countryNameToCode = {
      'MALAYSIA': 'MY',
      'SINGAPORE': 'SG',
      'INDONESIA': 'ID',
      'PHILIPPINES': 'PH',
      'THAILAND': 'TH',
      'CAMBODIA': 'KH',
      'VIETNAM': 'VN'
    };

    // Список валидных кодов стран (которые не нужно конвертировать)
    const validCountryCodes = new Set([
      'MY', 'SG', 'ID', 'PH', 'TH', 'KH', 'VN',
      'US', 'CA', 'BR', 'MX', 'UK', 'DE', 'FR', 'ES', 'IT',
      'NL', 'BE', 'FI', 'IE', 'HU', 'TR', 'RU', 'KZ', 'IN',
      'JP', 'KR', 'AU', 'NZ', 'AE', 'SA', 'EG', 'PK', 'BD'
    ]);

    // Если это уже код страны, возвращаем как есть
    if (validCountryCodes.has(normalized)) {
      return normalized;
    }

    // Если это полное название страны, конвертируем в код
    if (countryNameToCode[normalized]) {
      return countryNameToCode[normalized];
    }

    // Для остальных (ACTIVISION, GLOBAL и т.д.) возвращаем нормализованное значение
    return normalized;
  }

  // Объединение групп с одинаковыми нормализованными категориями
  function mergeGroupsByCategory(groups) {
    const merged = {};

    groups.forEach(group => {
      const normalizedCategory = normalizeCategoryName(group.category);

      if (!merged[normalizedCategory]) {
        merged[normalizedCategory] = {
          category: normalizedCategory,
          originalCategory: group.category, // Сохраняем оригинальное название для отображения
          products: []
        };
      }

      // Добавляем все продукты из этой группы
      if (group.products && Array.isArray(group.products)) {
        merged[normalizedCategory].products.push(...group.products);
      }
    });

    return Object.values(merged);
  }

  function renderMassiveProduct(groups, categoryImageUrl) {
    disableSkeleton();

    // Объединяем дублирующиеся категории
    const mergedGroups = mergeGroupsByCategory(groups);

    // Сортируем категории по русскому алфавиту
    mergedGroups.sort((a, b) => {
      const nameA = window.localizeCategoryRu
        ? window.localizeCategoryRu(a.category, { mode: "short" })
        : a.category;
      const nameB = window.localizeCategoryRu
        ? window.localizeCategoryRu(b.category, { mode: "short" })
        : b.category;
      return nameA.localeCompare(nameB, 'ru');
    });

    const firstProduct = mergedGroups[0] && mergedGroups[0].products && mergedGroups[0].products[0];
    const rawTitle = (firstProduct && firstProduct.name) || "Товары";
    const productName = rawTitle; // Сохраняем оригинальное название для использования в compactVariantLabel
    const title = cleanProductTitle(rawTitle);
    document.title = title + ' — AxoShop';
    if (productTitleEl) {
      productTitleEl.textContent = title;
    }

    // Устанавливаем картинку категории, если она есть
    if (categoryImageUrl) {
      // Устанавливаем изображение НЕМЕДЛЕННО
      if (mainImageEl && placeholderEl) {
        mainImageEl.src = categoryImageUrl;
        mainImageEl.alt = title;
        mainImageEl.style.display = 'block';
        mainImageEl.loading = 'eager';
        placeholderEl.style.display = 'none';

        // Retry при ошибке (неблокирующий)
        let retryCount = 0;
        mainImageEl.onerror = () => {
          retryCount++;
          if (retryCount < 3) {
            console.log(`Retry loading category image (${retryCount}/3):`, categoryImageUrl);
            setTimeout(() => {
              mainImageEl.src = categoryImageUrl + '?retry=' + retryCount;
            }, 1000 * retryCount);
          } else {
            console.error('Category image failed after 3 attempts');
            mainImageEl.style.display = 'none';
            placeholderEl.style.display = 'flex';
          }
        };
      }
    } else {
      // Если картинки нет, показываем placeholder
      if (mainImageEl) {
        mainImageEl.style.display = 'none';
      }
      if (placeholderEl) {
        placeholderEl.style.display = 'flex';
      }
    }

    // Рендерим миниатюру для massive товара
    const thumbsContainer = document.querySelector('.product-details__thumbs');
    if (thumbsContainer && categoryImageUrl) {
      thumbsContainer.innerHTML = '';

      const thumbBtn = document.createElement('button');
      thumbBtn.className = 'product-details__thumb product-details__thumb--active';
      thumbBtn.setAttribute('aria-label', 'Изображение товара');

      const thumbImg = document.createElement('img');
      thumbImg.src = categoryImageUrl;
      thumbImg.alt = 'Thumbnail';
      thumbImg.loading = 'lazy';

      thumbImg.onerror = () => {
        thumbBtn.innerHTML = '';
        // Показываем placeholder в миниатюре при ошибке
        if (placeholderEl) {
          const placeholderContent = placeholderEl.querySelector('svg');
          if (placeholderContent) {
            thumbBtn.appendChild(placeholderContent.cloneNode(true));
          }
        }
      };

      thumbBtn.appendChild(thumbImg);
      thumbsContainer.appendChild(thumbBtn);
    } else if (thumbsContainer) {
      // Если нет картинки, очищаем контейнер миниатюр
      thumbsContainer.innerHTML = '';
    }

    // Используем существующие блоки
    const categoryBlock = document.querySelector('.product-details__category-block');
    const categoryOptions = document.querySelector('.product-details__category-options');
    const periodOptions = document.querySelector('.product-details__period-options');

    // Экспортируем переменные глобально для product-payment.js
    window.selectedVariantId = null;
    window.currentFields = [];
    window.fieldValues = {};
    window.selectedProductType = null; // Добавляем выбранный тип товара

    // Проверяем конфигурацию товара
    const config = PRODUCT_TYPE_CONFIG[productId];

    // Если товар с типами на уровне категорий - рендерим селектор типов СВЕРХУ
    if (config && config.level === 'category') {
      renderCategoryLevelProduct(mergedGroups, productName);
    } else {
      // Для остальных товаров (variation-level или без конфига) - стандартный рендер
      renderStandardProduct(mergedGroups, productName);
    }

    // Функция рендера товара с типами на уровне категорий (тип сверху, фильтрует категории)
    function renderCategoryLevelProduct(allGroups, productName) {
      // Группируем категории по типам
      const categoriesByType = {};

      allGroups.forEach(group => {
        const categoryName = group.category || '';
        const categoryType = detectProductTypeByConfig(productId, categoryName, '');

        if (categoryType) {
          if (!categoriesByType[categoryType]) {
            categoriesByType[categoryType] = [];
          }
          categoriesByType[categoryType].push(group);
        }
      });

      const availableTypes = Object.keys(categoriesByType);

      console.log('[Category-Level Product]', {
        productId,
        availableTypes,
        categoriesByType: Object.keys(categoriesByType).map(type => ({
          type,
          categories: categoriesByType[type].map(g => g.category)
        }))
      });

      if (availableTypes.length === 0) {
        // Fallback: если ни одна категория не попала в конфиг
        renderStandardProduct(allGroups, productName);
        return;
      }

      // Рендерим селектор типов СВЕРХУ (перед категориями)
      renderProductTypeSelectorTop(availableTypes, categoriesByType, productName);
    }

    // Функция рендера селектора типов для category-level товаров (над категориями)
    function renderProductTypeSelectorTop(types, categoriesByType, productName) {
      // Удаляем старый блок типов если есть
      const oldTypeBlock = document.querySelector('.product-details__type-block');
      if (oldTypeBlock) {
        oldTypeBlock.remove();
      }

      // Создаем блок выбора типа товара
      const typeBlock = document.createElement('div');
      typeBlock.className = 'product-details__type-block';
      typeBlock.style.cssText = 'margin-bottom: 20px;';

      const typeLabel = document.createElement('span');
      typeLabel.className = 'product-details__label';
      typeLabel.textContent = 'тип товара';

      const typeOptions = document.createElement('div');
      typeOptions.className = 'product-details__type-options';
      typeOptions.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 10px;';

      types.forEach((type, index) => {
        const typeBtn = document.createElement('button');
        typeBtn.type = 'button';
        typeBtn.className = 'product-details__category-btn';
        typeBtn.textContent = getProductTypeLabel(type, productName);

        if (index === 0) {
          typeBtn.classList.add('product-details__category-btn--active');
          window.selectedProductType = type;
        }

        typeBtn.addEventListener('click', () => {
          // Снимаем активность со всех кнопок типов
          typeOptions.querySelectorAll('.product-details__category-btn').forEach(btn => {
            btn.classList.remove('product-details__category-btn--active');
          });
          typeBtn.classList.add('product-details__category-btn--active');

          window.selectedProductType = type;
          window.selectedVariantId = null;
          window.currentFields = [];
          window.fieldValues = {};

          // Рендерим категории для выбранного типа
          renderCategoriesForType(categoriesByType[type], productName);
        });

        typeOptions.appendChild(typeBtn);
      });

      typeBlock.appendChild(typeLabel);
      typeBlock.appendChild(typeOptions);

      // Вставляем блок типов ПЕРЕД блоком категорий
      if (categoryBlock) {
        categoryBlock.before(typeBlock);
      }

      // ВАЖНО: Рендерим категории для первого типа ПОСЛЕ вставки блока типов
      if (types.length > 0) {
        renderCategoriesForType(categoriesByType[types[0]], productName);
      }
    }

    // Функция рендера категорий для выбранного типа (для category-level товаров)
    function renderCategoriesForType(groups, productName) {
      if (!categoryOptions) return;

      categoryOptions.innerHTML = '';

      // Скрываем блок категорий, если категория одна или нет категорий
      if (categoryBlock) {
        if (groups.length <= 1) {
          categoryBlock.style.display = 'none';
        } else {
          categoryBlock.style.display = '';
        }
      }

      groups.forEach((group, groupIndex) => {
        const categoryBtn = document.createElement('button');
        categoryBtn.type = 'button';
        categoryBtn.className = 'product-details__category-btn';

        // Локализация категории
        const rawCategory = group.category || 'OTHER';
        let shortName = window.localizeCategoryRu
          ? window.localizeCategoryRu(rawCategory, { mode: "short" })
          : rawCategory;
        const fullName = window.localizeCategoryRu
          ? window.localizeCategoryRu(rawCategory, { mode: "full" })
          : rawCategory;

        // Компактификация названия категории
        if (window.compactVariantLabel) {
          shortName = window.compactVariantLabel({
            variantName: shortName,
            groupCategory: rawCategory,
            productName: productName
          });

          // Повторная локализация если результат - код страны/региона (BR, EU, JP и т.д.)
          if (window.localizeCategoryRu && /^[A-Z]{2,3}$/.test(shortName)) {
            shortName = window.localizeCategoryRu(shortName, { mode: "short" });
          }
        }

        categoryBtn.textContent = escapeHtml(shortName);
        categoryBtn.title = fullName; // Tooltip с полным названием

        if (groupIndex === 0) {
          categoryBtn.classList.add('product-details__category-btn--active');
        }

        categoryBtn.addEventListener('click', () => {
          // Снимаем активность со всех кнопок категорий
          categoryOptions.querySelectorAll('.product-details__category-btn').forEach(btn => {
            btn.classList.remove('product-details__category-btn--active');
          });
          categoryBtn.classList.add('product-details__category-btn--active');

          window.selectedVariantId = null;
          window.currentFields = [];
          window.fieldValues = {};

          // Обновляем варианты для выбранной категории (без типов, т.к. тип уже выбран сверху)
          renderVariantsForCategory(group);
        });

        categoryOptions.appendChild(categoryBtn);
      });

      // Управление сеткой категорий
      categoryOptions.classList.remove('layout-cols-5');
      if (groups.length > 6) {
        categoryOptions.classList.add('layout-cols-5');
      }

      // Удаляем старую пагинацию категорий если есть
      const oldCategoryNav = categoryBlock?.querySelector('.pagination-nav');
      if (oldCategoryNav) {
        oldCategoryNav.remove();
      }

      // Создаем пагинацию для категорий
      const categoryButtons = Array.from(categoryOptions.querySelectorAll('.product-details__category-btn'));
      createPaginationSystem(categoryOptions, categoryButtons, `category-page-${productId}`);

      // Автоматически рендерим контент для первой категории
      if (groups.length > 0) {
        renderVariantsForCategory(groups[0]);
      }
    }

    // Функция рендера вариантов для категории (для category-level товаров, без типов)
    function renderVariantsForCategory(group) {
      if (!periodOptions) return;

      periodOptions.innerHTML = '';

      if (!group || !Array.isArray(group.products) || group.products.length === 0) {
        periodOptions.innerHTML = '<p style="padding: 10px;">Нет доступных вариантов</p>';
        if (productPriceEl) productPriceEl.textContent = '... ₽';
        return;
      }

      // Просто рендерим все варианты из всех продуктов (без группировки по типам)
      renderVariantsForType(group.products, null);
    }

    // Функция стандартного рендера (для variation-level и товаров без конфига)
    function renderStandardProduct(mergedGroups, productName) {
      // Скрываем блок категорий, если категория одна или нет категорий
      if (categoryBlock) {
        if (mergedGroups.length <= 1) {
          categoryBlock.style.display = 'none';
        } else {
          categoryBlock.style.display = '';
        }
      }

      // Рендерим категории (mergedGroups) в category-options
      if (categoryOptions) {
        categoryOptions.innerHTML = '';

        mergedGroups.forEach((group, groupIndex) => {
          const categoryBtn = document.createElement('button');
          categoryBtn.type = 'button';
          categoryBtn.className = 'product-details__category-btn';

          // Локализация категории
          const rawCategory = group.category || 'OTHER';
          let shortName = window.localizeCategoryRu
            ? window.localizeCategoryRu(rawCategory, { mode: "short" })
            : rawCategory;
          const fullName = window.localizeCategoryRu
            ? window.localizeCategoryRu(rawCategory, { mode: "full" })
            : rawCategory;

          // Компактификация названия категории
          if (window.compactVariantLabel) {
            shortName = window.compactVariantLabel({
              variantName: shortName,
              groupCategory: rawCategory,
              productName: productName
            });

            // Повторная локализация если результат - код страны/региона (BR, EU, JP и т.д.)
            if (window.localizeCategoryRu && /^[A-Z]{2,3}$/.test(shortName)) {
              shortName = window.localizeCategoryRu(shortName, { mode: "short" });
            }
          }

          categoryBtn.textContent = escapeHtml(shortName);
          categoryBtn.title = fullName; // Tooltip с полным названием

          if (groupIndex === 0) {
            categoryBtn.classList.add('product-details__category-btn--active');
          }

          categoryBtn.addEventListener('click', () => {
            // Снимаем активность со всех кнопок категорий
            categoryOptions.querySelectorAll('.product-details__category-btn').forEach(btn => {
              btn.classList.remove('product-details__category-btn--active');
            });
            categoryBtn.classList.add('product-details__category-btn--active');

            window.selectedVariantId = null;
            window.currentFields = [];
            window.fieldValues = {};
            window.selectedProductType = null;

            // Обновляем варианты для выбранной категории
            renderCategoryContent(mergedGroups[groupIndex]);
          });

          categoryOptions.appendChild(categoryBtn);
        });

        // Управление сеткой категорий: если больше 6 элементов, включаем компактный вид (5 колонок)
        categoryOptions.classList.remove('layout-cols-5');
        if (mergedGroups.length > 6) {
          categoryOptions.classList.add('layout-cols-5');
        }

        // Удаляем старую пагинацию категорий если есть
        const oldCategoryNav = categoryBlock?.querySelector('.pagination-nav');
        if (oldCategoryNav) {
          oldCategoryNav.remove();
        }

        // Создаем пагинацию для категорий
        const categoryButtons = Array.from(categoryOptions.querySelectorAll('.product-details__category-btn'));
        createPaginationSystem(categoryOptions, categoryButtons, `category-page-${productId}`);

        // Автоматически рендерим контент для первой категории
        if (mergedGroups.length > 0) {
          renderCategoryContent(mergedGroups[0]);
        }
      }
    }

    // Функция рендера контента для выбранной категории (с проверкой типов)
    function renderCategoryContent(group) {
      // Валидация входных данных
      if (!group || !Array.isArray(group.products) || group.products.length === 0) {
        renderProductTypeSelector([]);
        if (periodOptions) {
          periodOptions.innerHTML = '<p style="padding: 10px;">Нет доступных вариантов</p>';
        }
        if (productPriceEl) productPriceEl.textContent = '... ₽';
        return;
      }

      const config = PRODUCT_TYPE_CONFIG[productId];
      const categoryName = group.category || '';

      console.log('[Product Types Debug]', {
        productId,
        categoryName,
        hasConfig: !!config,
        configLevel: config?.level,
        productsCount: group.products.length
      });

      // Группируем продукты по типу
      const productsByType = {};

      if (config && config.level === 'variation') {
        // Для товаров с типами на уровне вариаций:
        // Определяем какие типы содержит каждый продукт и добавляем его в соответствующие группы
        group.products.forEach(product => {
          if (!product || !product.variants) return;

          // Собираем все типы, которые есть в вариантах этого продукта
          const productTypes = new Set();

          product.variants.forEach(variant => {
            const variantType = detectProductTypeByConfig(productId, '', variant.variant_name || '');
            if (variantType) {
              productTypes.add(variantType);
            }
          });

          console.log('[Variation Level]', {
            productName: product.name,
            variantsCount: product.variants.length,
            detectedTypes: Array.from(productTypes)
          });

          // Если нашли типы по конфигу, добавляем продукт в каждую группу типов
          if (productTypes.size > 0) {
            productTypes.forEach(type => {
              if (!productsByType[type]) {
                productsByType[type] = [];
              }
              productsByType[type].push(product);
            });
          } else {
            // Fallback: если ни один вариант не попал в конфиг
            const type = detectProductType(product);
            if (!productsByType[type]) {
              productsByType[type] = [];
            }
            productsByType[type].push(product);
          }
        });
      } else {
        // Legacy: группируем по старой логике
        group.products.forEach(product => {
          if (!product) return;
          const type = detectProductType(product);
          if (!productsByType[type]) {
            productsByType[type] = [];
          }
          productsByType[type].push(product);
        });
      }

      const availableTypes = Object.keys(productsByType);

      console.log('[Available Types]', availableTypes);

      // Если нет доступных типов после фильтрации
      if (availableTypes.length === 0) {
        renderProductTypeSelector([]);
        if (periodOptions) {
          periodOptions.innerHTML = '<p style="padding: 10px;">Нет доступных вариантов</p>';
        }
        if (productPriceEl) productPriceEl.textContent = '... ₽';
        return;
      }

      // Если только один тип - показываем его как информационный блок (если есть конфиг)
      if (availableTypes.length === 1) {
        window.selectedProductType = availableTypes[0];

        // Показываем тип как информационный блок, если есть конфиг для этого товара
        if (config) {
          renderProductTypeSelector(availableTypes, productsByType, true); // true = readonly mode
        } else {
          renderProductTypeSelector([]); // Скрываем для товаров без конфига
        }

        renderVariantsForType(productsByType[availableTypes[0]], availableTypes[0]);
      } else {
        // Если несколько типов - показываем селектор типов
        renderProductTypeSelector(availableTypes, productsByType, false);
      }
    }

    // Функция рендера селектора типов товара
    function renderProductTypeSelector(types, productsByType = {}, readonly = false) {
      // Удаляем старый блок типов если есть
      const oldTypeBlock = document.querySelector('.product-details__type-block');
      if (oldTypeBlock) {
        oldTypeBlock.remove();
      }

      // Не показываем блок если типов нет
      if (!types || types.length === 0) {
        return;
      }

      // Извлекаем название продукта для кастомизации лейблов
      let productName = '';
      for (const type of types) {
        const products = productsByType[type];
        if (Array.isArray(products) && products.length > 0 && products[0].name) {
          productName = products[0].name;
          break;
        }
      }

      // Создаем блок выбора типа товара
      const typeBlock = document.createElement('div');
      typeBlock.className = 'product-details__type-block';
      typeBlock.style.cssText = 'margin-bottom: 20px;';

      const typeLabel = document.createElement('span');
      typeLabel.className = 'product-details__label';
      typeLabel.textContent = 'тип товара';

      const typeOptions = document.createElement('div');
      typeOptions.className = 'product-details__type-options';
      typeOptions.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 10px;';

      types.forEach((type, index) => {
        const typeBtn = document.createElement('button');
        typeBtn.type = 'button';
        typeBtn.className = 'product-details__category-btn';
        typeBtn.textContent = getProductTypeLabel(type, productName);

        if (index === 0) {
          typeBtn.classList.add('product-details__category-btn--active');
          window.selectedProductType = type;
          // Рендерим варианты для первого типа только если не вызывается из renderCategoryContent
          // (там уже вызывается renderVariantsForType отдельно)
        }

        // Если readonly режим (один тип), делаем кнопку неактивной
        if (readonly) {
          typeBtn.disabled = true;
          typeBtn.style.cursor = 'default';
          typeBtn.style.opacity = '1';
        } else {
          // Обычный режим с несколькими типами
          typeBtn.addEventListener('click', () => {
            // Снимаем активность со всех кнопок типов
            typeOptions.querySelectorAll('.product-details__category-btn').forEach(btn => {
              btn.classList.remove('product-details__category-btn--active');
            });
            typeBtn.classList.add('product-details__category-btn--active');

            window.selectedProductType = type;
            window.selectedVariantId = null;
            window.currentFields = [];
            window.fieldValues = {};

            // Рендерим варианты для выбранного типа
            const productsForType = productsByType[type];
            if (productsForType) {
              renderVariantsForType(productsForType, type);
            }
          });
        }

        typeOptions.appendChild(typeBtn);
      });

      typeBlock.appendChild(typeLabel);
      typeBlock.appendChild(typeOptions);

      // Вставляем блок типов после блока категорий
      const categoryBlock = document.querySelector('.product-details__category-block');
      if (categoryBlock) {
        categoryBlock.after(typeBlock);
      }
    }

    // Функция рендера вариантов для выбранного типа товара
    function renderVariantsForType(products, selectedType = null) {
      if (!periodOptions) return;

      periodOptions.innerHTML = '';

      if (!products || products.length === 0) {
        periodOptions.innerHTML = '<p style="padding: 10px;">Нет доступных вариантов</p>';
        if (productPriceEl) productPriceEl.textContent = '... ₽';
        return;
      }

      const config = PRODUCT_TYPE_CONFIG[productId];

      // Собираем все варианты из всех продуктов данного типа
      const allVariants = [];
      products.forEach(product => {
        if (product.variants && product.variants.length > 0) {
          product.variants.forEach(variant => {
            // Если есть конфиг на уровне вариаций и передан selectedType, фильтруем
            if (config && config.level === 'variation' && selectedType) {
              const variantType = detectProductTypeByConfig(productId, '', variant.variant_name || '');
              // Пропускаем варианты, которые не соответствуют выбранному типу
              if (variantType && variantType !== selectedType) {
                return;
              }
            }

            // Этап 1: Базовая очистка
            const cleanedName = window.formatVariantName
              ? window.formatVariantName(product.name, variant.variant_name, variant.variant_id)
              : (variant.variant_name || 'Вариант');

            allVariants.push({
              ...variant,
              productFields: product.fields || [],
              productName: product.name || '',
              cleanedName: cleanedName
            });
          });
        }
      });

      // Этап 2: Генерация коротких уникальных лейблов
      const variantsWithLabels = window.generateUniqueLabels
        ? window.generateUniqueLabels(
            allVariants.map(v => ({
              productName: v.productName,
              variantName: v.cleanedName,
              variantId: v.variant_id
            })),
            '' // Не передаем category, т.к. уже выбрана
          )
        : allVariants.map(v => ({
            variantId: v.variant_id,
            label: v.cleanedName
          }));

      // Создаем map для быстрого доступа к лейблам
      const labelMap = new Map();
      variantsWithLabels.forEach(item => {
        labelMap.set(item.variantId, item.label);
      });

      // Функция извлечения числового значения из лейбла для сортировки
      function extractNumericValue(label) {
        const cleaned = label.replace(/[$€£¥₹₽₴₪₩,]/g, '').trim();
        const match = cleaned.match(/([\d.]+)\s*([KMB])?/i);
        if (!match) return null;

        let value = parseFloat(match[1]);
        const suffix = match[2]?.toUpperCase();

        if (suffix === 'K') value *= 1000;
        if (suffix === 'M') value *= 1000000;
        if (suffix === 'B') value *= 1000000000;

        return value;
      }

      // Проверяем, являются ли варианты денежными (для сортировки)
      function isMonetaryVariant(label) {
        // Проверяем наличие валютных символов или паттернов типа "USD 10", "100 Diamonds"
        return /[$€£¥₹₽₴₪₩]|^\d+[\d,.\s]*[KMB]?\s*[A-Z]{3}?$|^\d+[\d,.\s]*$|^[A-Z]{3}\s*\d+|^\d+[\d,.\s]*[KMB]?\s+\w+/i.test(label);
      }

      // Сортируем варианты по убыванию, если это денежные номиналы
      const firstLabel = labelMap.get(allVariants[0]?.variant_id);
      const shouldSort = firstLabel && isMonetaryVariant(firstLabel);

      if (shouldSort) {
        allVariants.sort((a, b) => {
          const labelA = labelMap.get(a.variant_id) || '';
          const labelB = labelMap.get(b.variant_id) || '';
          const valueA = extractNumericValue(labelA);
          const valueB = extractNumericValue(labelB);

          // Если оба значения числовые, сортируем по возрастанию
          if (valueA !== null && valueB !== null) {
            return valueA - valueB;
          }

          // Если только одно значение числовое, оно идет первым
          if (valueA !== null) return -1;
          if (valueB !== null) return 1;

          // Если оба не числовые, сохраняем исходный порядок
          return 0;
        });
      }

      // Рендерим варианты как кнопки периода
      const compactLabels = [];
      allVariants.forEach((variant) => {
        const variantBtn = document.createElement('button');
        variantBtn.type = 'button';
        variantBtn.className = 'product-details__period-btn';

        // Получаем компактный лейбл
        const compactLabel = labelMap.get(variant.variant_id) || variant.cleanedName;
        compactLabels.push(compactLabel);

        variantBtn.textContent = compactLabel;
        variantBtn.dataset.variantId = variant.variant_id;
        variantBtn.dataset.variantPrice = variant.variant_price || 0;

        variantBtn.addEventListener('click', () => {
          // Снимаем активность со всех вариантов
          periodOptions.querySelectorAll('.product-details__period-btn').forEach(btn => {
            btn.classList.remove('product-details__period-btn--active');
          });
          variantBtn.classList.add('product-details__period-btn--active');

          window.selectedVariantId = variant.variant_id;

          // Обновляем цену
          if (productPriceEl) {
            productPriceEl.textContent = `${variant.variant_price || 0} ₽`;
          }

          // Рендерим поля
          window.currentFields = variant.productFields;
          window.fieldValues = {};
          renderFieldsInDescription(window.currentFields);
        });

        periodOptions.appendChild(variantBtn);
      });

      // Автоматически выбираем первый вариант
      if (allVariants.length > 0) {
        const firstVariant = allVariants[0];
        const firstBtn = periodOptions.querySelector('.product-details__period-btn');

        if (firstBtn) {
          firstBtn.classList.add('product-details__period-btn--active');
          window.selectedVariantId = firstVariant.variant_id;

          // Обновляем цену
          if (productPriceEl) {
            productPriceEl.textContent = `${firstVariant.variant_price || 0} ₽`;
          }

          // Рендерим поля
          window.currentFields = firstVariant.productFields;
          window.fieldValues = {};
          renderFieldsInDescription(window.currentFields);
        }
      }

      // === ЛОГИКА ВЫБОРА LAYOUT (GRID vs CHIPS) ===

      // 1. Сброс классов
      periodOptions.classList.remove('layout-cols-5', 'layout-cols-4', 'layout-cols-3', 'layout-cols-2', 'layout-chips');

      const countOptions = compactLabels.length;

      // 2. Измерение ширины текста
      const font = '600 16px SF-Pro-Display-Semibold, sans-serif';
      const maxTextWidthPx = measureMaxTextWidth(compactLabels, font);

      // 3. Анализ контента (доля "текстовых" лейблов без цифр)
      const letterRegex = /^[a-zA-Zа-яА-ЯёЁ\s\/\-]+$/;
      const lettersOnlyCount = compactLabels.filter(l => letterRegex.test(l)).length;
      const lettersOnlyRatio = countOptions > 0 ? lettersOnlyCount / countOptions : 0;

      // 4. Принятие решения
      let useChips = false;

      // Исключительный критерий для CHIPS (много опций, короткие слова, в основном буквы)
      if (countOptions >= 6 && lettersOnlyRatio >= 0.70 && maxTextWidthPx <= 200) {
        useChips = true;
      }

      if (useChips) {
        periodOptions.classList.add('layout-chips');
      } else {
        // GRID Fallback logic
        // Константы: Container=688px, Gap=8px, Padding=40px, Border=3px -> Deduction=43px
        const deduction = 43;
        const availableWidth4 = (688 - 8 * 3) / 4 - deduction;
        const availableWidth3 = (688 - 8 * 2) / 3 - deduction;

        if (maxTextWidthPx <= availableWidth4) {
          periodOptions.classList.add('layout-cols-4');
        } else if (maxTextWidthPx <= availableWidth3) {
          periodOptions.classList.add('layout-cols-3');
        } else {
          periodOptions.classList.add('layout-cols-2');
        }
      }

      // Удаляем старую пагинацию вариантов если есть
      const periodBlock = document.querySelector('.product-details__period-block');
      if (periodBlock) {
        const oldPeriodNav = periodBlock.querySelector('.pagination-nav');
        if (oldPeriodNav) {
          oldPeriodNav.remove();
        }
      }

      // Создаем пагинацию для вариантов
      const variantButtons = Array.from(periodOptions.querySelectorAll('.product-details__period-btn'));
      createPaginationSystem(periodOptions, variantButtons, `variant-page-${productId}`);
    }

    // Функция рендера полей после period-block
    function renderFieldsInDescription(fields) {
      const periodBlock = document.querySelector('.product-details__period-block');
      if (!periodBlock) return;

      // Удаляем старый контейнер полей если есть
      const oldFieldsBlock = document.querySelector('.product-details__fields-block');
      if (oldFieldsBlock) {
        oldFieldsBlock.remove();
      }

      if (!fields || fields.length === 0) {
        return;
      }

      // Создаем блок полей в стиле category-block и period-block
      const fieldsBlock = document.createElement('div');
      fieldsBlock.className = 'product-details__fields-block';

      const fieldsLabel = document.createElement('span');
      fieldsLabel.className = 'product-details__label';
      fieldsLabel.textContent = 'параметры покупки';

      const fieldsContainer = document.createElement('div');
      fieldsContainer.className = 'product-details__fields-inputs';
      fieldsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin-top: 10px;';

      fields.forEach((fieldName) => {
        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';

        const label = document.createElement('label');
        label.textContent = fieldName;
        label.style.cssText = 'font-size: 14px; color: var(--text-gray);';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Введите ' + fieldName;
        input.style.cssText = 'width: 100%; padding: 12px 15px; border: 2px solid #ECECEC; border-radius: 10px; font-family: SF-Pro-Display-Regular, sans-serif; font-size: 14px; transition: border-color 0.2s;';

        input.addEventListener('focus', () => {
          input.style.borderColor = '#000';
        });

        input.addEventListener('blur', () => {
          input.style.borderColor = '#ECECEC';
        });

        input.addEventListener('input', (e) => {
          window.fieldValues[fieldName] = e.target.value;
        });

        inputWrapper.appendChild(label);
        inputWrapper.appendChild(input);
        fieldsContainer.appendChild(inputWrapper);
      });

      fieldsBlock.appendChild(fieldsLabel);
      fieldsBlock.appendChild(fieldsContainer);

      // Вставляем после period-block
      periodBlock.after(fieldsBlock);
    }

    // Инициализируем первую категорию
    if (mergedGroups.length > 0) {
      renderCategoryContent(mergedGroups[0]);
    }
  }

  const thumbsContainer = document.querySelector('.product-details__thumbs');
  if (thumbsContainer && mainImageParent) {
    thumbsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.product-details__thumb');
      if (btn) {
        // Проверяем, не является ли эта миниатюра уже активной
        if (btn.classList.contains('product-details__thumb--active')) {
          // Миниатюра уже активна, ничего не делаем
          return;
        }

        const src = btn.dataset.fullSrc;
        const webpSrc = btn.dataset.webpSrc;

        if (src) {
          // Снимаем активность со всех миниатюр
          thumbsContainer.querySelectorAll('.product-details__thumb').forEach(thumb => {
            thumb.classList.remove('product-details__thumb--active');
          });

          // Добавляем активность к текущей миниатюре
          btn.classList.add('product-details__thumb--active');

          // Удаляем старый контент (img или picture)
          const oldImg = mainImageParent.querySelector('img');
          const oldPicture = mainImageParent.querySelector('picture');
          if (oldImg && !oldPicture) oldImg.remove();
          if (oldPicture) oldPicture.remove();

          // Если есть WebP версия, создаем picture элемент
          if (webpSrc) {
            const picture = document.createElement('picture');

            const sourceWebP = document.createElement('source');
            sourceWebP.srcset = webpSrc;
            sourceWebP.type = 'image/webp';

            const img = document.createElement('img');
            img.src = src;
            img.alt = productTitleEl ? productTitleEl.textContent : 'Товар';
            img.style.display = 'block';
            img.onerror = () => {
              picture.style.display = 'none';
              if (placeholderEl) placeholderEl.style.display = 'flex';
            };

            picture.appendChild(sourceWebP);
            picture.appendChild(img);
            mainImageParent.appendChild(picture);
          } else {
            // Обычное изображение без WebP
            const img = document.createElement('img');
            img.src = src;
            img.alt = productTitleEl ? productTitleEl.textContent : 'Товар';
            img.style.display = 'block';
            img.onerror = () => {
              img.style.display = 'none';
              if (placeholderEl) placeholderEl.style.display = 'flex';
            };
            mainImageParent.appendChild(img);
          }

          if (placeholderEl) placeholderEl.style.display = 'none';
        } else {
          // Удаляем изображения и показываем placeholder
          const oldImg = mainImageParent.querySelector('img');
          const oldPicture = mainImageParent.querySelector('picture');
          if (oldImg && !oldPicture) oldImg.style.display = 'none';
          if (oldPicture) oldPicture.style.display = 'none';
          if (placeholderEl) placeholderEl.style.display = 'flex';
        }
      }
    });
  }

  function sanitizeBasicHtml(html) {
    if (!html) return "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const removeTags = ["SCRIPT", "IFRAME", "OBJECT", "EMBED", "LINK", "STYLE"];
    const allowedTags = ["B", "STRONG", "I", "EM", "U", "P", "BR", "UL", "OL", "LI", "A", "SPAN", "DIV", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"];
    const elements = doc.body.querySelectorAll("*");
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      const tagName = el.tagName;
      if (removeTags.includes(tagName)) {
        el.remove();
        continue;
      }
      if (!allowedTags.includes(tagName)) {
        el.replaceWith(document.createTextNode(el.textContent));
        continue;
      }
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const val = attr.value.toLowerCase().replace(/\s+/g, '');
        if (name.startsWith("on") || ((name === "href" || name === "src") && (val.startsWith("javascript:") || val.startsWith("data:")))) {
          el.removeAttribute(attr.name);
        }
        if (name === "style" && (val.includes("url(") || val.includes("expression("))) {
          el.removeAttribute(attr.name);
        }
      }
      if (tagName === "A" && (el.getAttribute("target") || "").toLowerCase() === "_blank") {
        el.setAttribute("rel", "noopener noreferrer");
      }
    }
    return doc.body.innerHTML;
  }
});
