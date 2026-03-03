/**
 * Универсальная логика для кнопки "Назад"
 * Работает как браузерная кнопка назад, но только в рамках сайта
 * Если пользователь пришел по прямой ссылке - возвращает на главную
 */

(function() {
  'use strict';

  /**
   * Проверяет, является ли referrer внутренней ссылкой сайта
   */
  function isInternalReferrer(referrer) {
    if (!referrer) return false;

    try {
      const referrerUrl = new URL(referrer);
      const currentUrl = new URL(window.location.href);

      return referrerUrl.origin === currentUrl.origin;
    } catch (e) {
      return false;
    }
  }

  /**
   * Инициализирует кнопку "Назад"
   */
  function initBackButton() {
    const backButtons = document.querySelectorAll('.back-button:not([data-internal]), .js-close-details:not([data-internal])');

    backButtons.forEach(button => {
      if (button.dataset.backButtonInit) return;

      button.dataset.backButtonInit = 'true';

      button.addEventListener('click', (e) => {
        e.preventDefault();

        if (window.history.length > 1 && isInternalReferrer(document.referrer)) {
          window.history.back();
        } else {
          window.location.href = '/index.html';
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackButton);
  } else {
    initBackButton();
  }
})();
