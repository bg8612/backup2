/**
 * JWT Redirect Handler для Telegram OAuth
 * Работает с /load/jwt_rediect.html
 * Извлекает JWT токен из URL и сохраняет в cookie
 */

(function() {
  const redirectText = document.querySelector('.redirect-text');

  const updateText = (message) => {
    if (redirectText) {
      redirectText.innerHTML = message;
    }
  };

  const showError = (message) => {
    updateText(`Ошибка: ${message}`);
    console.error('JWT Redirect Error:', message);

    setTimeout(() => {
      window.location.href = '/pages/authorization.html';
    }, 3000);
  };

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    showError('Токен не найден в URL');
    return;
  }

  const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
  if (!jwtPattern.test(token)) {
    showError('Неверный формат токена');
    return;
  }

  try {
    document.cookie = `authToken=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;

    localStorage.setItem('authMethod', 'telegram');

    updateText('Авторизация успешна! Перенаправление...');

    setTimeout(() => {
      window.location.href = '/pages/profile.html#settings';
    }, 500);

  } catch (error) {
    console.error('Ошибка сохранения токена:', error);
    showError('Не удалось сохранить токен авторизации');
  }
})();
