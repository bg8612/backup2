document.addEventListener("DOMContentLoaded", () => {
  const escapeHtml = (str) => {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const safeUrlForDom = (url) => {
    if (!url) return "";
    const str = String(url);
    if (/^\s*javascript:/i.test(str)) return "";
    return str;
  };

  const normalizeFilesUrl = (url) => {
    if (!url) return url;
    return String(url).replace(/^http:\/\/files\.axoshop\.ru\//i, 'https://files.axoshop.ru/');
  };

  const isValidImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return /^https?:\/\//i.test(url.trim());
  };

  const productsContainer = document.getElementById("products-container");
  const categoryTitle = document.getElementById("category-title");
  const params = new URLSearchParams(window.location.search);
  const categoryId = params.get("id");

  if (!categoryId) {
    if (categoryTitle) categoryTitle.textContent = "Категория не выбрана";
    return;
  }

  const API_URL = `https://api.axoshop.ru/api/categories/${categoryId}`;

  if (productsContainer) {
    productsContainer.innerHTML = Array(8).fill(0).map(() => `
      <div class="product-card">
        <div class="card-image-wrapper skeleton"></div>
        <div class="card-info">
          <div class="card-price skeleton skeleton-text" style="width: 40%; height: 24px; margin-bottom: 5px;"></div>
          <div class="card-title skeleton skeleton-text" style="width: 90%; height: 16px; margin-bottom: 5px;"></div>
          <div class="card-rating skeleton skeleton-text" style="width: 50%; height: 12px;"></div>
        </div>
      </div>
    `).join("");
  }

  fetch(API_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Ошибка сети: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (categoryTitle) {
        categoryTitle.textContent = data.title || "Категория";
      }

      const placeholderHtml = `<div class='product-image-placeholder' style='width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#ececec;'><svg width='40' height='40' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M21 16.5C21 16.88 20.79 17.21 20.47 17.38L12.57 21.82C12.41 21.94 12.21 22 12 22C11.79 22 11.59 21.94 11.43 21.82L3.53 17.38C3.21 17.21 3 16.88 3 16.5V7.5C3 7.12 3.21 6.79 3.53 6.62L11.43 2.18C11.59 2.06 11.79 2 12 2C12.21 2 12.41 2.06 12.57 2.18L20.47 6.62C20.79 6.79 21 7.12 21 7.5V16.5Z' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><path d='M12 22V12' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><path d='M12 12L3.28998 7.11' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><path d='M12 12L20.71 7.11' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg></div>`;

      if (productsContainer && data.products && data.products.length > 0) {
        productsContainer.innerHTML = data.products
          .map((product) => {
            const productTitle = escapeHtml(product.title || product.name || "Название товара");

            // Логика получения изображения с валидацией URL
            let images = [];
            if (Array.isArray(product.images) && product.images.length > 0) {
                images = product.images.map(img => {
                    if (typeof img === 'string') return img;
                    return img?.url || img?.image || img?.image_url || null;
                }).filter(url => isValidImageUrl(url));
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
                        images = [imageUrl];
                        break;
                    }
                }
            }
            
            const imageUrl = images.length > 0 ? images[0] : null;

            // Используем URL напрямую, экранируя только кавычки для HTML-атрибута
            let safeImgSrc = "";
            if (imageUrl && typeof imageUrl === 'string' && !/^\s*javascript:/i.test(imageUrl)) {
                // Нормализуем URL: http → https для files.axoshop.ru
                const normalizedUrl = normalizeFilesUrl(imageUrl);
                safeImgSrc = normalizedUrl.replace(/"/g, '&quot;');
            }

            const imageContent = safeImgSrc 
                ? `<img src="${safeImgSrc}" alt="${productTitle}" onerror="handleProductImageError(this)" />`
                : placeholderHtml;

            let ratingValue = "0.0";
            let reviewsCount = 0;
            if (Array.isArray(product.reviews) && product.reviews.length > 0) {
                const total = product.reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
                ratingValue = (total / product.reviews.length).toFixed(1);
                reviewsCount = product.reviews.length;
            }

            const priceDisplay = product.price !== undefined ? `${product.price} ₽` : "... ₽";
            
            return `
              <a href="/pages/product-page.html?id=${product.id}" class="product-card">
                <div class="card-image-wrapper" data-product-id="${product.id}">
                  <button
                    class="card-fav"
                    aria-label="В избранное"
                    data-product-id="${product.id}"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                  ${imageContent}
                </div>

                <div class="card-info">
                  <div class="card-price">${priceDisplay}</div>
                  <div class="card-title">${productTitle}</div>
                  <div class="card-rating">
                    <span class="rating-value">${ratingValue}</span>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 0L8.5716 4.83688H13.6574L9.5429 7.82624L11.1145 12.6631L7 9.67376L2.8855 12.6631L4.4571 7.82624L0.342604 4.83688H5.4284L7 0Z" fill="black"/>
                    </svg>
                    <span class="rating-count">${reviewsCount} отзывов</span>
                  </div>
                </div>
              </a>
            `;
          })
          .join("");

        // Обновляем состояние кнопок избранного после рендеринга
        // Используем refreshFavorites для загрузки актуального состояния с сервера
        if (window.refreshFavorites) {
          window.refreshFavorites();
        } else if (window.updateFavoriteButtons) {
          window.updateFavoriteButtons();
        }

        // Обновляем кэш изображений темы после загрузки товаров
        if (window.themeManager && window.themeManager.refreshThemeImagesCache) {
          window.themeManager.refreshThemeImagesCache();
        }

        const observer = new IntersectionObserver((entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const wrapper = entry.target;
              const productId = wrapper.dataset.productId;
              if (productId) {
                loadProductImage(productId, wrapper);
                obs.unobserve(wrapper);
              }
            }
          });
        }, { rootMargin: "100px" });

        document.querySelectorAll(".card-image-wrapper").forEach((el) => observer.observe(el));
      } else {
        productsContainer.innerHTML = "<p>В этой категории пока нет товаров.</p>";
      }
    })
    .catch((error) => {
      console.error("Ошибка загрузки товаров:", error);
      if (categoryTitle) categoryTitle.textContent = "Категория не найдена";
      if (productsContainer) productsContainer.innerHTML = "<p>Не удалось загрузить товары.</p>";
    });



  const productCache = new Map();
  const pendingRequests = new Map();

  function loadProductImage(id, providedWrapper = null) {
    if (productCache.has(id)) {
      applyProductData(productCache.get(id), id, providedWrapper);
      return;
    }

    if (pendingRequests.has(id)) return;

    const request = fetch(`https://api.axoshop.ru/api/products/${id}`)
      .then(res => res.ok ? res.json() : null)
      .then(product => {
        if (product) {
          productCache.set(id, product);
          applyProductData(product, id, providedWrapper);
        }
      })
      .catch(err => console.error(`Ошибка загрузки деталей товара ${id}:`, err))
      .finally(() => {
        pendingRequests.delete(id);
      });

    pendingRequests.set(id, request);
  }

  function applyProductData(product, id, providedWrapper) {
        if (!product) return;

        let images = [];
        if (Array.isArray(product.images) && product.images.length > 0) {
            images = product.images.map(img => {
                if (typeof img === 'string') return img;
                return img?.url || img?.image || img?.image_url || null;
            }).filter(url => isValidImageUrl(url));
        }

        if (images.length === 0) {
            const candidates = [
                product.imageUrl,
                product.image_url,
                product.image,
                product.url
            ];

            for (let candidate of candidates) {
                let imageUrl = candidate;

                if (typeof imageUrl === 'object' && imageUrl !== null) {
                    imageUrl = imageUrl.url || imageUrl.image || imageUrl.image_url || null;
                }

                if (isValidImageUrl(imageUrl)) {
                    images = [imageUrl];
                    break;
                }
            }
        }

        const wrapper = providedWrapper || document.querySelector(`.card-image-wrapper[data-product-id="${id}"]`);
        if (!wrapper) return;

        const imageUrl = images[0];
        if (imageUrl) {
            // Нормализуем URL: http → https для files.axoshop.ru
            const normalizedUrl = normalizeFilesUrl(imageUrl);
            const safeSrc = safeUrlForDom(normalizedUrl);
            const placeholder = wrapper.querySelector('.product-image-placeholder');

            if (placeholder) placeholder.remove();

            let img = wrapper.querySelector('img');
            if (!img) {
                // Создаем новое изображение
                img = document.createElement('img');
                img.alt = product.title || "Товар";
                img.onerror = () => window.handleProductImageError(img);
                wrapper.appendChild(img);
                img.src = safeSrc;
            } else {
                // Изображение уже существует - проверяем, нужно ли обновлять src
                // Нормализуем оба URL к абсолютному виду для корректного сравнения
                const currentSrc = img.src; // Браузер всегда возвращает абсолютный URL
                const newSrc = safeSrc.startsWith('http') ? safeSrc : new URL(safeSrc, window.location.origin).href;

                // Если URL совпадают - ничего не делаем, пусть загрузка продолжается
                if (currentSrc === newSrc) {
                    return; // Важно: не трогаем изображение, которое уже загружается
                }

                // URL отличаются - нужно обновить
                // Проверяем состояние текущего изображения
                if (img.complete && img.naturalWidth > 0) {
                    // Изображение успешно загружено, но URL другой - обновляем
                    img.alt = product.title || "Товар";
                    img.onerror = () => window.handleProductImageError(img);
                    img.src = safeSrc;
                } else if (img.complete && img.naturalWidth === 0) {
                    // Загрузка провалилась - пробуем новый URL
                    img.alt = product.title || "Товар";
                    img.onerror = () => window.handleProductImageError(img);
                    img.src = safeSrc;
                } else {
                    // Изображение еще загружается (!img.complete)
                    // НЕ прерываем загрузку - это и есть основная проблема!
                    // Только если новый URL явно лучше (более полный), обновляем
                    // В нашем случае оба URL должны быть одинаковыми после нормализации
                    // Поэтому этот блок не должен выполняться в нормальной ситуации
                }
            }
        }

        if (product.price !== undefined) {
            const card = wrapper.closest('.product-card');
            if (card) {
                const priceEl = card.querySelector('.card-price');
                if (priceEl) {
                    priceEl.textContent = `${product.price} ₽`;
                }
            }
        }
  }
});

window.handleProductImageError = (img) => {
    const placeholderHtml = `<div class='product-image-placeholder' style='width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#ececec;'><svg width='40' height='40' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M21 16.5C21 16.88 20.79 17.21 20.47 17.38L12.57 21.82C12.41 21.94 12.21 22 12 22C11.79 22 11.59 21.94 11.43 21.82L3.53 17.38C3.21 17.21 3 16.88 3 16.5V7.5C3 7.12 3.21 6.79 3.53 6.62L11.43 2.18C11.59 2.06 11.79 2 12 2C12.21 2 12.41 2.06 12.57 2.18L20.47 6.62C20.79 6.79 21 7.12 21 7.5V16.5Z' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><path d='M12 22V12' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><path d='M12 12L3.28998 7.11' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><path d='M12 12L20.71 7.11' stroke='#9E9E9E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg></div>`;
    if (img && img.parentNode) {
        img.outerHTML = placeholderHtml;
    }
};