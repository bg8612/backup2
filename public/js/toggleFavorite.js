const FavoritesAPI = {
  BASE_URL: 'https://auth.axoshop.ru/api/favorite',

  // Получить JWT токен из cookies
  getToken() {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; authToken=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  },

  // Добавить товар в избранное
  async addProduct(id) {
    const token = this.getToken();
    if (!token) throw new Error('Unauthorized');

    const response = await fetch(`${this.BASE_URL}/tovar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: Number(id) })
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized');
      if (response.status === 409) {
        const data = await response.json();
        throw new Error('ProductNotFound', { cause: data });
      }
      throw new Error('Failed to add to favorites');
    }

    return await response.json();
  },

  // Удалить товар из избранного
  async removeProduct(id) {
    const token = this.getToken();
    if (!token) throw new Error('Unauthorized');

    const response = await fetch(`${this.BASE_URL}/unfavorite/tovar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: Number(id) })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Remove product error:', response.status, errorData);

      if (response.status === 401) throw new Error('Unauthorized');
      if (response.status === 400) throw new Error('BadRequest');
      throw new Error(`Failed to remove from favorites: ${response.status}`);
    }

    return await response.json();
  },

  // Добавить категорию в избранное
  async addCategory(id) {
    const token = this.getToken();
    if (!token) throw new Error('Unauthorized');

    const response = await fetch(`${this.BASE_URL}/category`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: Number(id) })
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized');
      if (response.status === 409) {
        const data = await response.json();
        throw new Error('CategoryNotFound', { cause: data });
      }
      throw new Error('Failed to add category to favorites');
    }

    return await response.json();
  },

  // Удалить категорию из избранного
  async removeCategory(id) {
    const token = this.getToken();
    if (!token) throw new Error('Unauthorized');

    const response = await fetch(`${this.BASE_URL}/unfavorite/category`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: Number(id) })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Remove category error:', response.status, errorData);

      if (response.status === 401) throw new Error('Unauthorized');
      if (response.status === 400) throw new Error('BadRequest');
      throw new Error(`Failed to remove category from favorites: ${response.status}`);
    }

    return await response.json();
  },

  // Получить список избранных товаров
  async getProductsList() {
    const token = this.getToken();
    if (!token) throw new Error('Unauthorized');

    const response = await fetch(`${this.BASE_URL}/tovar/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized');
      throw new Error('Failed to fetch favorites');
    }

    return await response.json();
  },

  // Получить список избранных категорий
  async getCategoriesList() {
    const token = this.getToken();
    if (!token) throw new Error('Unauthorized');

    const response = await fetch(`${this.BASE_URL}/category/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized');
      throw new Error('Failed to fetch favorite categories');
    }

    return await response.json();
  }
};

class FavoritesController {
  constructor() {
    this.favoriteProducts = new Set();
    this.favoriteCategories = new Set();
    this.initialized = false;
  }

  // Инициализация: загрузка избранного с сервера
  async init() {
    if (this.initialized) return;

    const token = FavoritesAPI.getToken();
    if (!token) {
      // Пользователь не авторизован - используем localStorage
      this.loadFromLocalStorage();
      this.initialized = true;
      return;
    }

    try {
      // Загружаем избранное с сервера
      const [productsData, categoriesData] = await Promise.all([
        FavoritesAPI.getProductsList().catch(() => ({ items: [] })),
        FavoritesAPI.getCategoriesList().catch(() => ({ items: [] }))
      ]);

      // Сохраняем ID избранных товаров и категорий
      this.favoriteProducts = new Set(
        productsData.items
          .filter(item => item.exists)
          .map(item => String(item.id))
      );

      this.favoriteCategories = new Set(
        categoriesData.items
          .filter(item => item.exists)
          .map(item => String(item.id))
      );

      this.initialized = true;
      this.updateAllButtons();
    } catch (error) {
      console.error('Failed to load favorites:', error);
      this.loadFromLocalStorage();
      this.initialized = true;
    }
  }

  // Принудительное обновление избранного (для синхронизации при возврате на страницу)
  async refresh() {
    const token = FavoritesAPI.getToken();
    if (!token) {
      // Пользователь не авторизован - используем localStorage
      this.loadFromLocalStorage();
      this.updateAllButtons();
      return;
    }

    try {
      // Загружаем избранное с сервера
      const [productsData, categoriesData] = await Promise.all([
        FavoritesAPI.getProductsList().catch(() => ({ items: [] })),
        FavoritesAPI.getCategoriesList().catch(() => ({ items: [] }))
      ]);

      // Обновляем ID избранных товаров и категорий
      this.favoriteProducts = new Set(
        productsData.items
          .filter(item => item.exists)
          .map(item => String(item.id))
      );

      this.favoriteCategories = new Set(
        categoriesData.items
          .filter(item => item.exists)
          .map(item => String(item.id))
      );

      this.updateAllButtons();
    } catch (error) {
      console.error('Failed to refresh favorites:', error);
    }
  }

  // Загрузка из localStorage для неавторизованных
  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('favorites');
      if (stored) {
        const data = JSON.parse(stored);
        this.favoriteProducts = new Set(data.products || []);
        this.favoriteCategories = new Set(data.categories || []);
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
  }

  // Сохранение в localStorage
  saveToLocalStorage() {
    try {
      localStorage.setItem('favorites', JSON.stringify({
        products: Array.from(this.favoriteProducts),
        categories: Array.from(this.favoriteCategories)
      }));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  // Проверка, является ли элемент категорией
  isCategory(btn) {
    // Сначала проверяем data-type="category" (для product-page.html с massive товарами)
    if (btn.getAttribute('data-type') === 'category') {
      return true;
    }

    // Затем проверяем наличие класса category-card (для каталога)
    const card = btn.closest('.product-card');
    if (card && card.classList.contains('category-card')) {
      return true;
    }

    return false;
  }

  // Проверка, находится ли товар/категория в избранном
  isFavorite(id, isCategory) {
    return isCategory
      ? this.favoriteCategories.has(String(id))
      : this.favoriteProducts.has(String(id));
  }

  // Обновление визуального состояния всех кнопок
  updateAllButtons() {
    document.querySelectorAll('.card-fav, .product-details__fav-btn').forEach(btn => {
      const id = btn.getAttribute('data-product-id');
      if (!id) return;

      const isCategory = this.isCategory(btn);
      const isFav = this.isFavorite(id, isCategory);

      if (isFav) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Переключение избранного
  async toggle(btn) {
    const id = btn.getAttribute('data-product-id');
    if (!id) return;

    const isCategory = this.isCategory(btn);
    const isCurrentlyFavorite = btn.classList.contains('active');
    const token = FavoritesAPI.getToken();

    // Проверка авторизации - показываем модальное окно если не авторизован
    if (!token) {
      const overlay = document.getElementById('paymentOverlay');
      const authModal = document.getElementById('authRequiredModal');

      if (overlay && authModal) {
        // Открываем overlay с блокировкой скролла (как в payments.js)
        overlay.classList.add('active');

        const scrollY = window.scrollY;
        document.documentElement.classList.add('modal-open');
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100vw';
        if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
        document.body.dataset.scrollY = scrollY;

        // Показываем auth modal с анимацией
        authModal.style.display = 'flex';
        authModal.style.opacity = '0';
        authModal.style.transform = 'scale(0.95)';

        // Trigger reflow
        void authModal.offsetWidth;

        authModal.style.opacity = '1';
        authModal.style.transform = 'scale(1)';
      }
      return;
    }

    // Проверяем, находимся ли мы на странице профиля
    const isProfilePage = window.location.pathname.includes('profile.html');
    const productCard = btn.closest('.product-card');

    // Optimistic UI update
    btn.classList.toggle('active');
    btn.disabled = true;

    try {
      // Авторизованный пользователь - отправляем на сервер
      if (isCurrentlyFavorite) {
        // Если удаляем на странице профиля, запускаем анимацию
        if (isProfilePage && productCard) {
          productCard.classList.add('removing');
        }

        // Удаляем из избранного
        if (isCategory) {
          await FavoritesAPI.removeCategory(id);
          this.favoriteCategories.delete(String(id));
        } else {
          await FavoritesAPI.removeProduct(id);
          this.favoriteProducts.delete(String(id));
        }

        // Если на странице профиля, удаляем элемент после анимации
        if (isProfilePage && productCard) {
          setTimeout(() => {
            const parentGrid = productCard.parentElement;
            productCard.remove();

            // Проверяем, остались ли карточки в этой секции
            if (parentGrid) {
              const remainingCards = parentGrid.querySelectorAll('.product-card');
              if (remainingCards.length === 0) {
                // Определяем тип секции по ID родителя
                const isProductsGrid = parentGrid.id === 'fav-products-grid';
                const isCategoriesGrid = parentGrid.id === 'fav-categories-grid';

                if (isProductsGrid) {
                  parentGrid.innerHTML = '<p style="width: 100%; text-align: left; color: var(--text-gray); padding-bottom: 40px;">Нет избранных товаров</p>';
                } else if (isCategoriesGrid) {
                  parentGrid.innerHTML = '<p style="width: 100%; text-align: left; color: var(--text-gray); padding-bottom: 40px;">Нет избранных категорий</p>';
                }
              }
            }
          }, 300); // Длительность анимации из CSS
        }
      } else {
        // Добавляем в избранное
        if (isCategory) {
          await FavoritesAPI.addCategory(id);
          this.favoriteCategories.add(String(id));
        } else {
          await FavoritesAPI.addProduct(id);
          this.favoriteProducts.add(String(id));
        }
      }

    } catch (error) {
      console.error('Favorites toggle error:', error);

      // Rollback UI на случай ошибки
      btn.classList.toggle('active');

      // Отменяем анимацию удаления если была запущена
      if (isProfilePage && productCard && isCurrentlyFavorite) {
        productCard.classList.remove('removing');
      }

      // Показываем уведомление об ошибке
      if (error.message === 'Unauthorized') {
        // Показываем модальное окно авторизации
        const overlay = document.getElementById('paymentOverlay');
        const authModal = document.getElementById('authRequiredModal');

        if (overlay && authModal) {
          // Открываем overlay с блокировкой скролла (как в payments.js)
          overlay.classList.add('active');

          const scrollY = window.scrollY;
          document.documentElement.classList.add('modal-open');
          const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
          document.body.style.position = 'fixed';
          document.body.style.top = `-${scrollY}px`;
          document.body.style.width = '100vw';
          if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
          document.body.dataset.scrollY = scrollY;

          // Показываем auth modal с анимацией
          authModal.style.display = 'flex';
          authModal.style.opacity = '0';
          authModal.style.transform = 'scale(0.95)';
          void authModal.offsetWidth;
          authModal.style.opacity = '1';
          authModal.style.transform = 'scale(1)';
        }
      } else if (error.message === 'ProductNotFound' || error.message === 'CategoryNotFound') {
        alert('Этот товар больше не доступен');
      } else {
        alert('Не удалось обновить избранное. Попробуйте позже.');
      }
    } finally {
      btn.disabled = false;
    }
  }
}

const favoritesController = new FavoritesController();

window.initFavorites = async function() {
  await favoritesController.init();
};

window.refreshFavorites = async function() {
  await favoritesController.refresh();
};

window.updateFavoriteButtons = function() {
  favoritesController.updateAllButtons();
};

document.addEventListener("DOMContentLoaded", async () => {
  await favoritesController.init();

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.card-fav, .product-details__fav-btn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      favoritesController.toggle(btn);
    }
  });

  const steamHeader = document.querySelector(".steam-header");
  const steamBlock = document.querySelector(".steam");

  if (steamHeader && steamBlock) {
    steamHeader.addEventListener("click", () => {
      steamBlock.classList.toggle("open");
    });
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted && favoritesController.initialized) {
    favoritesController.refresh();
  }
});
