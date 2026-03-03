import { createCategorySearchEngine, initHomeCategorySearch } from './categorySearchEngine.js';

async function initHomePageSearch() {
  try {
    const response = await fetch('/data/catalog.search.json');
    if (!response.ok) {
      console.error(`Failed to load categories: ${response.status}`);
      return;
    }

    const categories = await response.json();

    const engine = createCategorySearchEngine(categories, {
      enableFuzzy: true,
      maxFuzzyDistance: 2
    });

    const onSelect = (category) => {
      const categoryType = category.type || 'category';

      // Проверяем, является ли это massive категорией или новым провайдером
      const isMassiveOrProvider = categoryType === 'massive' || /^\d{4,5}$/.test(category.id);

      if (isMassiveOrProvider) {
        window.location.href = `/pages/product-page.html?id=${category.id}`;
      } else {
        window.location.href = `/pages/products.html?id=${category.id}`;
      }
    };

    const inputEl = document.querySelector('#nav-search-input');
    const dropdownEl = document.querySelector('#nav-search-dropdown');

    if (inputEl && dropdownEl) {
      initHomeCategorySearch({
        inputEl,
        dropdownEl,
        engine,
        limit: 8,
        debounceMs: 80,
        highlightMatch: true,
        onSelect
      });
    }

    const mobileInputEl = document.querySelector('#mobile-search-input');
    const mobileDropdownEl = document.querySelector('#mobile-search-dropdown');

    if (mobileInputEl && mobileDropdownEl) {
      initHomeCategorySearch({
        inputEl: mobileInputEl,
        dropdownEl: mobileDropdownEl,
        engine,
        limit: 8,
        debounceMs: 80,
        highlightMatch: true,
        onSelect
      });
    }

  } catch (error) {
    console.error('Failed to initialize home page search:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomePageSearch);
} else {
  initHomePageSearch();
}
