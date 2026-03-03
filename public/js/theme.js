/**
 * Theme Management System
 * Управление светлой и тёмной темой сайта
 */

class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'theme-preference';
    this.THEME_ATTR = 'data-theme';
    this.themes = {
      LIGHT: 'light',
      DARK: 'dark',
      AUTO: 'auto'
    };

    // Кэш для DOM-элементов
    this.cachedElements = {
      moonIcons: null,
      sunIcons: null,
      headerLogo: null,
      navLogo: null,
      themeImages: null
    };

    this.init();
  }

  /**
   * Инициализация темы при загрузке страницы
   */
  init() {
    const savedTheme = this.getSavedTheme();
    const theme = savedTheme || this.themes.LIGHT;

    if (theme === this.themes.AUTO) {
      this.applySystemTheme();
    } else {
      this.applyTheme(theme);
    }

    // Инициализируем кэш изображений после загрузки DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.refreshThemeImagesCache();
      });
    } else {
      // DOM уже загружен
      this.refreshThemeImagesCache();
    }

    // Слушаем изменения системной темы
    this.watchSystemTheme();
  }

  /**
   * Получить сохранённую тему из localStorage
   */
  getSavedTheme() {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('localStorage недоступен:', e);
      return null;
    }
  }

  /**
   * Сохранить тему в localStorage
   */
  saveTheme(theme) {
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (e) {
      console.warn('Не удалось сохранить тему:', e);
    }
  }

  /**
   * Определить системную тему
   */
  getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return this.themes.DARK;
    }
    return this.themes.LIGHT;
  }

  /**
   * Применить системную тему
   */
  applySystemTheme() {
    const systemTheme = this.getSystemTheme();
    this.applyTheme(systemTheme, false);
  }

  /**
   * Применить тему
   * @param {string} theme - 'light' или 'dark'
   * @param {boolean} save - сохранять ли в localStorage
   */
  applyTheme(theme, save = true) {
    const root = document.documentElement;

    // Временно отключаем transitions для мгновенного переключения
    root.classList.add('theme-switching');

    if (theme === this.themes.DARK) {
      root.setAttribute(this.THEME_ATTR, 'dark');
    } else {
      root.removeAttribute(this.THEME_ATTR);
    }

    if (save) {
      this.saveTheme(theme);
    }

    // Обновляем иконки переключателя
    this.updateToggleIcons(theme);

    // Обновляем логотип
    this.updateLogo(theme);

    // Обновляем картинки категорий
    this.updateCategoryImages(theme);

    // Включаем transitions обратно после завершения переключения
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    });

    // Dispatch custom event для других скриптов
    window.dispatchEvent(new CustomEvent('themechange', {
      detail: { theme }
    }));
  }

  /**
   * Переключить тему
   */
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute(this.THEME_ATTR);
    const newTheme = currentTheme === 'dark' ? this.themes.LIGHT : this.themes.DARK;
    this.applyTheme(newTheme);
  }

  /**
   * Обновить иконки переключателя темы
   */
  updateToggleIcons(theme) {
    // Кэшируем элементы при первом вызове (все иконки, включая мобильные)
    if (!this.cachedElements.moonIcons) {
      this.cachedElements.moonIcons = document.querySelectorAll('.theme-toggle__moon');
      this.cachedElements.sunIcons = document.querySelectorAll('.theme-toggle__sun');
    }

    const moonIcons = this.cachedElements.moonIcons;
    const sunIcons = this.cachedElements.sunIcons;

    if (!moonIcons.length || !sunIcons.length) return;

    if (theme === this.themes.DARK) {
      moonIcons.forEach(icon => icon.style.display = 'none');
      sunIcons.forEach(icon => icon.style.display = 'block');
    } else {
      moonIcons.forEach(icon => icon.style.display = 'block');
      sunIcons.forEach(icon => icon.style.display = 'none');
    }
  }

  /**
   * Обновить логотип
   */
  updateLogo(theme) {
    // Кэшируем элементы при первом вызове
    if (!this.cachedElements.headerLogo) {
      this.cachedElements.headerLogo = document.querySelector('.header-logo img');
      this.cachedElements.navLogo = document.querySelector('nav ul li a img[alt="AxoShop"]');
    }

    const logos = [this.cachedElements.headerLogo, this.cachedElements.navLogo].filter(Boolean);

    logos.forEach(logo => {
      if (theme === this.themes.DARK) {
        // Меняем на тёмную версию логотипа
        if (!logo.dataset.lightSrc) {
          logo.dataset.lightSrc = logo.src;
        }
        logo.src = '/assets/img/LogoBlackTheme.png';
      } else {
        // Возвращаем светлую версию
        if (logo.dataset.lightSrc) {
          logo.src = logo.dataset.lightSrc;
        }
      }
    });
  }

  /**
   * Обновить картинки категорий
   * Оптимизировано: кэширование, эффективный поиск, батчинг обновлений
   */
  updateCategoryImages(theme) {
    // Маппинг картинок для замены (оптимизировано в Map для O(1) поиска)
    if (!this.imageMap) {
      this.imageMap = new Map([
        ['steam.png', 'steamBlackTheme.png'],
        ['xbox.png', 'xboxBlackTheme.png'],
        ['mobile-vibration.png', 'mobile-vibrationBlackTheme.png'],
        ['gifts.png', 'giftsBlackTheme.png'],
        ['key.png', 'keyBlackTheme.png'],
        ['favourites.png', 'favouritesBlackTheme.png'],
        ['tg-au.png', 'tg-auBlackTheme.png']
      ]);
    }

    // Кэшируем список изображений при первом вызове или если кэш устарел
    if (!this.cachedElements.themeImages || this.cachedElements.themeImages.length === 0) {
      this.refreshThemeImagesCache();
    }

    const images = this.cachedElements.themeImages;
    if (!images || images.length === 0) return;

    // Используем requestAnimationFrame для батчинга обновлений
    requestAnimationFrame(() => {
      images.forEach(img => {
        // Проверяем, жив ли элемент в DOM
        if (!img.isConnected) return;

        const src = img.src || img.getAttribute('src');
        if (!src) return;

        // Двунаправленный поиск: проверяем и ключи, и значения
        let matched = false;

        for (const [lightImage, darkImage] of this.imageMap) {
          // Проверяем совпадение с ключом (светлая версия)
          if (src.includes(lightImage)) {
            if (theme === this.themes.DARK) {
              img.src = src.replace(lightImage, darkImage);
            }
            matched = true;
            break;
          }

          // Проверяем совпадение со значением (тёмная версия)
          if (src.includes(darkImage)) {
            if (theme === this.themes.LIGHT) {
              img.src = src.replace(darkImage, lightImage);
            }
            matched = true;
            break;
          }
        }
      });
    });
  }

  /**
   * Обновить кэш изображений темы
   * Вызывается автоматически или вручную после динамической загрузки контента
   */
  refreshThemeImagesCache() {
    const allImages = document.querySelectorAll('img');
    const themeImages = [];

    // Фильтруем только изображения, которые нужно переключать
    allImages.forEach(img => {
      const src = img.src || img.getAttribute('src');
      if (!src) return;

      // Двунаправленный поиск: проверяем и ключи, и значения
      for (const [lightImage, darkImage] of this.imageMap.keys() ? this.imageMap : []) {
        if (src.includes(lightImage) || src.includes(darkImage)) {
          themeImages.push(img);
          break;
        }
      }
    });

    this.cachedElements.themeImages = themeImages;
  }

  /**
   * Следить за изменениями системной темы
   */
  watchSystemTheme() {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Современный способ
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', (e) => {
        const savedTheme = this.getSavedTheme();
        // Применяем системную тему только если пользователь выбрал 'auto'
        if (savedTheme === this.themes.AUTO || !savedTheme) {
          this.applyTheme(e.matches ? this.themes.DARK : this.themes.LIGHT, false);
        }
      });
    }
    // Старый способ для совместимости
    else if (mediaQuery.addListener) {
      mediaQuery.addListener((e) => {
        const savedTheme = this.getSavedTheme();
        if (savedTheme === this.themes.AUTO || !savedTheme) {
          this.applyTheme(e.matches ? this.themes.DARK : this.themes.LIGHT, false);
        }
      });
    }
  }

  /**
   * Установить конкретную тему (для использования из других скриптов)
   */
  setTheme(theme) {
    if (Object.values(this.themes).includes(theme)) {
      if (theme === this.themes.AUTO) {
        this.saveTheme(theme);
        this.applySystemTheme();
      } else {
        this.applyTheme(theme);
      }
    }
  }

  /**
   * Получить текущую тему
   */
  getCurrentTheme() {
    return document.documentElement.getAttribute(this.THEME_ATTR) || this.themes.LIGHT;
  }

  /**
   * Публичный метод для обновления кэша изображений
   * Используйте после динамической загрузки контента
   * @public
   */
  updateImagesCache() {
    this.refreshThemeImagesCache();
  }
}

// Создаём глобальный экземпляр
const themeManager = new ThemeManager();

// Экспортируем для использования в других скриптах
window.themeManager = themeManager;

// Инициализируем обработчики после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.querySelector('.theme-toggle');
  const mobileToggleButton = document.querySelector('.mobile-theme-toggle');

  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      themeManager.toggleTheme();
    });
  }

  if (mobileToggleButton) {
    mobileToggleButton.addEventListener('click', () => {
      themeManager.toggleTheme();
    });
  }
});
