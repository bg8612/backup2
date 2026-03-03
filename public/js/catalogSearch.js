import { createCategorySearchEngine, initCatalogCategoryFilter } from './categorySearchEngine.js';

async function initCatalogPageFilter() {
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

    const inputEl = document.querySelector('#nav-search-input');
    const mobileInputEl = document.querySelector('#mobile-search-input');
    const listContainerEl = document.querySelector('#catalog-categories-list');

    if (!listContainerEl) {
      return;
    }

    function initFilters() {
      const items = listContainerEl.querySelectorAll('[data-category-item]');

      if (items.length === 0) {
        return false;
      }

      if (inputEl) {
        initCatalogCategoryFilter({
          inputEl,
          listContainerEl,
          itemSelector: '[data-category-item]',
          engine,
          debounceMs: 80,
          emptyMessage: 'Ничего не найдено'
        });
      }

      if (mobileInputEl) {
        initCatalogCategoryFilter({
          inputEl: mobileInputEl,
          listContainerEl,
          itemSelector: '[data-category-item]',
          engine,
          debounceMs: 80,
          emptyMessage: 'Ничего не найдено'
        });
      }

      return true;
    }

    if (initFilters()) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          if (initFilters()) {
            observer.disconnect();
            return;
          }
        }
      }
    });

    observer.observe(listContainerEl, {
      childList: true,
      subtree: false
    });

    setTimeout(() => {
      observer.disconnect();
    }, 30000);

  } catch (error) {
    console.error('Failed to initialize catalog page filter:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCatalogPageFilter);
} else {
  initCatalogPageFilter();
}
