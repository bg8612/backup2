/**
 * Product Payment Handler
 * Обрабатывает покупку товаров на странице product-page.html
 */

(function() {
  'use strict';

  window.productOrder = {
    product_id: null,
    variant_id: null,
    fields: {},
    price: null,
    payment_method: "card",
    is_massive: false
  };

  window.onProductCaptchaSuccess = function() {
    console.log('Product reCAPTCHA success');

    const captchaOverlay = document.getElementById('captchaOverlay');
    if (captchaOverlay) {
      captchaOverlay.classList.remove('active');
    }

    openPaymentModal();

    if (typeof grecaptcha !== 'undefined' && window.productCaptchaWidgetId !== undefined) {
      grecaptcha.reset(window.productCaptchaWidgetId);
    }
  };

  window.initProductRecaptcha = function() {
    const container = document.getElementById('recaptcha');
    if (!container || window.productCaptchaWidgetId !== undefined) return;

    window.productCaptchaWidgetId = grecaptcha.render('recaptcha', {
      sitekey: '6Le83kwsAAAAABYf75410mXY4-RETveGUiiY57qD',
      callback: window.onProductCaptchaSuccess
    });

    console.log('Product reCAPTCHA initialized');
  };

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  const overlay = document.getElementById('paymentOverlay');
  const cardFields = document.getElementById('cardFields');
  const tabs = document.querySelectorAll('.pm-tab-btn');
  const paymentModal = document.querySelector('.payment-modal');
  const closeBtn = document.getElementById('pmCloseBtn');

  function openPaymentModal() {
    if (!overlay) return;

    overlay.classList.add('active');

    const scrollY = window.scrollY;
    document.documentElement.classList.add('modal-open');
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100vw';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.dataset.scrollY = scrollY;

    selectPaymentMethod('card');
  }

  function closePaymentModal() {
    if (!overlay) return;

    overlay.classList.remove('active');

    const scrollY = parseInt(document.body.dataset.scrollY || '0');
    document.documentElement.classList.remove('modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.paddingRight = '';
    window.scrollTo(0, scrollY);

    if (paymentModal) {
      paymentModal.style.bottom = '';
      paymentModal.style.maxHeight = '';
    }

    setTimeout(() => {
      const mainModal = document.getElementById('paymentMainModal');
      const authModal = document.getElementById('authRequiredModal');
      if (mainModal) mainModal.style.display = '';
      if (authModal) authModal.style.display = 'none';
      if (mainModal) {
        mainModal.style.opacity = '';
        mainModal.style.transform = '';
      }
      if (authModal) {
        authModal.style.opacity = '';
        authModal.style.transform = '';
      }
    }, 300);
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closePaymentModal();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closePaymentModal);
  }

  function selectPaymentMethod(method) {
    window.productOrder.payment_method = method;

    tabs.forEach(btn => {
      if (btn.getAttribute('data-method') === method) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (method === 'card') {
      cardFields.classList.remove('hidden');
      paymentModal.classList.remove('pm-compact');
    } else {
      cardFields.classList.add('hidden');
      paymentModal.classList.add('pm-compact');
    }
  }

  if (tabs) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const method = tab.getAttribute('data-method');

        if (method === 'wallet') {
          if (!getCookie('authToken')) {
            const mainModal = document.getElementById('paymentMainModal');
            const authModal = document.getElementById('authRequiredModal');

            if (mainModal && authModal) {
              mainModal.style.opacity = '0';
              mainModal.style.transform = 'scale(0.95)';
              setTimeout(() => {
                mainModal.style.display = 'none';
                authModal.style.display = 'flex';
                authModal.style.opacity = '0';
                authModal.style.transform = 'scale(0.95)';
                void authModal.offsetWidth;
                authModal.style.opacity = '1';
                authModal.style.transform = 'scale(1)';
              }, 300);
            }
            return;
          }
        }

        selectPaymentMethod(method);
      });
    });
  }

  const authReqCancel = document.getElementById('authReqCancel');
  if (authReqCancel) {
    authReqCancel.addEventListener('click', closePaymentModal);
  }

  if (cardFields) {
    const inputs = cardFields.querySelectorAll('.pm-input');

    if (inputs[0]) {
      inputs[0].addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').substring(0, 16);
        let parts = [];
        for (let i = 0; i < v.length; i += 4) {
          parts.push(v.substring(i, i + 4));
        }
        e.target.value = parts.join(' ');
      });
    }

    if (inputs[1]) {
      inputs[1].addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (v.length >= 3) {
          e.target.value = v.substring(0, 2) + '/' + v.substring(2);
        } else {
          e.target.value = v;
        }
      });
    }

    if (inputs[2]) {
      inputs[2].addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 3);
      });
    }

    if (inputs[3]) {
      inputs[3].addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^a-zA-Zа-яА-Я\s]/g, '');
      });
    }
  }

  if (window.visualViewport && paymentModal) {
    const viewport = window.visualViewport;

    const handleResize = () => {
      if (window.innerWidth > 600) {
        paymentModal.style.bottom = '';
        paymentModal.style.maxHeight = '';
        return;
      }

      if (!overlay.classList.contains('active')) return;

      const layoutHeight = window.innerHeight;
      const visualHeight = viewport.height;
      const visualTop = viewport.offsetTop;
      const bottomOffset = Math.max(0, layoutHeight - (visualTop + visualHeight));

      paymentModal.style.bottom = `${bottomOffset}px`;
      paymentModal.style.maxHeight = `${visualHeight}px`;
    };

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);
  }


  document.addEventListener('DOMContentLoaded', () => {
    const buyBtn = document.querySelector('.product-details__buy-btn');

    if (buyBtn) {
      buyBtn.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        const productId = params.get("id");

        if (!productId) {
          alert('Ошибка: ID товара не найден');
          return;
        }

        window.productOrder.product_id = productId;

        const isMassive = /^\d{4,5}$/.test(productId);
        window.productOrder.is_massive = isMassive;

        // Проверяем наличие вариантов (для massive товаров и товаров с productInfo.data.variants)
        const hasVariants = window.selectedVariantId !== null && window.selectedVariantId !== undefined;

        if (hasVariants) {
          if (!window.selectedVariantId) {
            alert('Выберите вариант товара');
            return;
          }

          window.productOrder.variant_id = window.selectedVariantId;
          window.productOrder.fields = window.fieldValues || {};

          if (window.currentFields && window.currentFields.length > 0) {
            const missingFields = window.currentFields.filter(
              field => !window.productOrder.fields[field] || window.productOrder.fields[field].trim() === ''
            );
            if (missingFields.length > 0) {
              alert('Заполните все поля: ' + missingFields.join(', '));
              return;
            }
          }
        } else {
          window.productOrder.variant_id = null;
          window.productOrder.fields = {};
        }

        const priceEl = document.querySelector('.product-details__price');
        if (priceEl) {
          const priceText = priceEl.textContent.replace(/[^\d]/g, '');
          window.productOrder.price = parseInt(priceText) || 0;
        }

        const modalPriceEl = document.getElementById('modal_total_price');
        if (modalPriceEl) {
          modalPriceEl.textContent = `${window.productOrder.price} ₽`;
        }

        // Инициализируем reCAPTCHA и показываем капчу
        if (typeof grecaptcha !== 'undefined' && window.productCaptchaWidgetId === undefined) {
          window.initProductRecaptcha();
        }

        const captchaOverlay = document.getElementById('captchaOverlay');
        if (captchaOverlay) {
          captchaOverlay.classList.add('active');
        }
      });
    }
  });


  const isProductPage = window.location.pathname.includes('product-page.html');

  if (!isProductPage) {
    console.log('Product payment handler skipped - not on product page');
    return;
  }

  const payBtn = document.querySelector(".pm-pay-btn");

  if (payBtn) {
    payBtn.addEventListener("click", async () => {
      try {
        payBtn.disabled = true;
        payBtn.innerText = "ожидание...";

        const token = getCookie('authToken');

        const payload = {
          product_id: window.productOrder.product_id,
          variant_id: window.productOrder.variant_id,
          fields: window.productOrder.fields,
          price: window.productOrder.price,
          payment_method: window.productOrder.payment_method === 'wallet' ? 'balance' : window.productOrder.payment_method
        };

        const API_ENDPOINT = "https://api.axoshop.ru/api/products/purchase";

        const headers = {
          "Content-Type": "application/json"
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(API_ENDPOINT, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(payload)
        });

        const contentType = res.headers.get("content-type");
        let data = null;

        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        } else {
          const text = await res.text();
          console.error("NON-JSON RESPONSE:", text);
          throw new Error("Сервер вернул не JSON");
        }

        if (!res.ok) {
          throw new Error(data?.message || "Ошибка создания заказа");
        }

        if (data.anonumys_token) {
          document.cookie = `anonumysToken=${data.anonumys_token}; path=/; max-age=86400`;
        }

        closePaymentModal();

        if (payload.payment_method === 'balance') {
          const finalOrderId = data.order_id || data.id;
          if (finalOrderId) {
            window.location.href = `/pages/successful-payment.html?id=${finalOrderId}`;
          } else {
            console.error("ORDER ID MISSING in response:", data);
            alert("Ошибка: Номер заказа не получен от сервера");
          }
        } else if (data.payment_url || data.url) {
          const targetUrl = data.payment_url || data.url;
          try {
            const urlObj = new URL(targetUrl, window.location.origin);
            if (['http:', 'https:'].includes(urlObj.protocol)) {
              window.location.href = targetUrl;
            } else {
              throw new Error("Недопустимый протокол");
            }
          } catch (e) {
            console.error("Blocked unsafe redirect:", targetUrl);
            alert("Ошибка безопасности: некорректная ссылка для оплаты");
          }
        }
      } catch (err) {
        console.error("Payment error:", err);
        alert(err.message || "Ошибка запроса");
      } finally {
        payBtn.disabled = false;
        payBtn.innerText = "оплатить";
      }
    });
  }
})();
