document.addEventListener("DOMContentLoaded", () => {
  const categoriesGrid = document.querySelector(".categories-grid");

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
    if (/^\s*(javascript:|data:)/i.test(str)) return "";
    return str;
  };

  const normalizeFilesUrl = (url) => {
    if (!url) return url;
    return String(url).replace(/^http:\/\/files\.axoshop\.ru\//i, 'https://files.axoshop.ru/');
  };

  const getCategoryImageUrl = (category) => {
    let imageUrl = category.image_url || category.image || category.imageUrl || category.url;

    // Если это объект, извлекаем вложенный URL
    if (typeof imageUrl === 'object' && imageUrl !== null) {
      imageUrl = imageUrl.url || imageUrl.image;
    }

    if (imageUrl && typeof imageUrl === 'string') {
      if (/^https?:\/\//i.test(imageUrl)) {
        return imageUrl;
      }
      return "";
    }

    return "";
  };

  if (categoriesGrid) {
    const API_URL = "https://api.axoshop.ru/api/categories";

    categoriesGrid.innerHTML = Array(8).fill(0).map(() => `
      <div class="product-card category-card">
        <div class="card-image-wrapper skeleton"></div>
        <div class="card-info">
          <div class="card-title skeleton skeleton-text" style="width: 70%; height: 20px;"></div>
        </div>
      </div>
    `).join("");

    fetch(API_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Ошибка сети: ${response.status}`);
        }
        return response.json();
      })
      .then((categories) => {
        categoriesGrid.innerHTML = "";

        const categoriesHTML = categories
          .map((category) => {
            const safeName = escapeHtml(category.title || category.name);
            const rawId = category.id;
            const safeId = escapeHtml(rawId);

            const imageUrl = getCategoryImageUrl(category);
            const normalizedUrl = normalizeFilesUrl(imageUrl);
            const safeImgSrc = safeUrl(normalizedUrl);

            const categoryType = category.type || 'category';

            // Проверяем, является ли это massive категорией или новым провайдером
            const isMassiveOrProvider = categoryType === 'massive' || /^\d{4,5}$/.test(rawId);

            const targetUrl = isMassiveOrProvider
              ? `/pages/product-page.html?id=${safeId}`
              : `/pages/products.html?id=${safeId}`;

            return `
              <a href="${targetUrl}" class="product-card category-card"
                 data-category-item
                 data-id="${safeId}"
                 data-name="${safeName}"
                 data-type="${escapeHtml(categoryType)}">
                <div class="card-image-wrapper">
                  <button
                    class="card-fav"
                    aria-label="В избранное"
                    data-product-id="${safeId}"
                    data-type="category"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                      />
                    </svg>
                  </button>
                  <img
                    src="${safeImgSrc}"
                    alt="${safeName}"
                    loading="lazy"
                    onerror="this.style.display='none'"
                  />
                </div>
                <div class="card-info">
                  <div class="card-title">${safeName}</div>
                </div>
              </a>
            `;
          })
          .join("");

        categoriesGrid.innerHTML = categoriesHTML;

        if (window.updateFavoriteButtons) {
          window.updateFavoriteButtons();
        }

        // Обновляем кэш изображений темы после загрузки категорий
        if (window.themeManager && window.themeManager.refreshThemeImagesCache) {
          window.themeManager.refreshThemeImagesCache();
        }
      })
      .catch((error) => {
        console.error("Error fetching categories:", error);
        categoriesGrid.innerHTML = "<p>Не удалось загрузить категории.</p>";
      });
  }

  // Логика выпадающего списка Steam на мобильных
  const steamHeader = document.querySelector(".steam-header");
  const steamBlock = document.querySelector(".steam");

  if (steamHeader && steamBlock) {
    steamHeader.addEventListener("click", () => {
      steamBlock.classList.toggle("open");
    });
  }
});