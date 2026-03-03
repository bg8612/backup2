let normalizeNominalModule = null;
if (typeof module !== 'undefined' && typeof require !== 'undefined') {
  try {
    normalizeNominalModule = require('./nominalNormalize.js');
  } catch (e) {
  }
}

function decodeHTMLEntities(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = text;
    return div.textContent || div.innerText || text;
  }

  return text
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function compactVariantLabel(context) {
  if (!context || typeof context !== 'object') {
    return '';
  }

  const { variantName, groupCategory } = context;

  if (!variantName || typeof variantName !== 'string') {
    return String(variantName || '');
  }

  let text = variantName.trim();

  text = decodeHTMLEntities(text);

  const lolGiftCardPattern = /^League\s+of\s+Legends\s+Gift\s+Card\s+([A-Z]{2,3})$/i;
  const lolGiftCardMatch = text.match(lolGiftCardPattern);
  if (lolGiftCardMatch) {
    return lolGiftCardMatch[1];
  }

  text = text.replace(/LEAGUE\s+OF\s+LEGENDS\s+GIFT\s+CARD/gi, '');
  text = text.replace(/LEAGUE\s+OF\s+LEGENDS/gi, '');
  text = text.replace(/LOL\s+GIFT\s+CARD/gi, '');

  text = text.replace(/GIFT\s+CARD\s+CODE/gi, '');
  text = text.replace(/GIFT\s+CARD/gi, '');

  text = text.replace(/\(([A-Z]{3})\)\s*\((\d+(?:[.,]\d+)?)\)/g, '$2 $1');
  text = text.replace(/\((\d+(?:[.,]\d+)?)\)\s*\(([A-Z]{3})\)/g, '$1 $2');

  text = text.replace(/\([A-Z]{2,3}\)\s*/g, '');

  text = text.replace(/\bPREPAID\s+CODE\b/gi, 'Gift Card');

  const originalNominal = findNominalInText(text);

  if (originalNominal) {
    text = removePrefixBeforeNominal(text, originalNominal);

    text = removeSuffixAfterNominal(text, originalNominal);

    const textWithoutNominal = text.replace(originalNominal, '').trim();
    const cleanedContext = textWithoutNominal.replace(/^[-–—\s()]+|[-–—\s()]+$/g, '').trim();

    const hasContext = cleanedContext.length > 0 &&
                       !/^(of|the|a|an|in|on|at|to|for|with)\s*$/i.test(cleanedContext);

    if (hasContext && cleanedContext.split(/\s+/).length >= 1) {
    } else {
      const normalized = extractAndNormalizeNominal(text, groupCategory);
      return normalized || text.trim();
    }
  }

  if (context.productName && typeof context.productName === 'string') {
    const escapedProductName = context.productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const productPattern = new RegExp(`\\b${escapedProductName}\\b`, 'gi');
    text = text.replace(productPattern, '').trim();
  }

  text = removeNoiseWords(text);

  text = removeRedundantInfo(text, context);

  text = text.replace(/\s+/g, ' ').trim();

  text = sanitizeLabel(text);

  if (!text || /^(of|the|a|an|in|on|at|to|for|with)\s+\w+$/i.test(text)) {
    return variantName.trim();
  }

  const finalNominal = findNominalInText(text);
  if (finalNominal && finalNominal === text.trim()) {
    const normalized = extractAndNormalizeNominal(text, groupCategory);
    return normalized || text;
  }

  if (text.length > 10) {
    const regionCodeMatch = text.match(/\b([A-Z]{2,3})$/);
    if (regionCodeMatch) {
      const potentialCode = regionCodeMatch[1];

      // Исключаем валютные коды (не региональные коды)
      const currencyCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'KRW', 'TWD', 'HKD', 'SGD', 'MYR',
                             'THB', 'IDR', 'PHP', 'VND', 'INR', 'PKR', 'BDT', 'LKR', 'NPR', 'TRY',
                             'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'ILS', 'EGP', 'MAD', 'ZAR',
                             'NGN', 'KES', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'CRC', 'RUB',
                             'UAH', 'PLN', 'CZK', 'HUF', 'RON', 'CHF', 'SEK', 'NOK', 'DKK', 'CAD',
                             'AUD', 'NZD'];

      // Исключаем общие окончания слов (ED, ER, LY, etc.)
      const commonWordEndings = ['ED', 'ER', 'LY', 'AL', 'IC', 'LE', 'AR', 'OR', 'AN', 'EN', 'ON', 'IN'];

      // Проверяем, что перед кодом нет цифр (чтобы не ломать "10 EUR")
      const hasNumberBefore = /\d+\s+[A-Z]{2,3}$/.test(text);

      if (!currencyCodes.includes(potentialCode) &&
          !commonWordEndings.includes(potentialCode) &&
          !hasNumberBefore) {
        return potentialCode;
      }
    }
  }

  return text;
}

/**
 * Санитайзер для удаления спецсимволов и мусора
 */
function sanitizeLabel(text) {
  if (!text) return '';
  let result = text;
  result = result.replace(/[•·⋅]/g, ' ');
  result = result.replace(/\(\s*\)/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

/**
 * Удаляет префиксы перед номиналом
 * Примеры: "BE 10 EUR" → "10 EUR", "LOL BR 16 BRL" → "16 BRL"
 */
function removePrefixBeforeNominal(text, nominal) {
  if (!text || !nominal) return text;

  // Находим позицию номинала в тексте
  const nominalIndex = text.indexOf(nominal);
  if (nominalIndex === -1) return text;

  // Если номинал в начале строки, ничего не удаляем
  if (nominalIndex === 0) return text;

  // Извлекаем префикс (всё до номинала)
  const prefix = text.substring(0, nominalIndex).trim();

  // Проверяем, содержит ли префикс значимые описательные слова
  const descriptiveWords = /\b(pack|bundle|set|wallet|box|chest|crate|case|pouch|bag|collection|pin|code|card)\b/i;
  if (descriptiveWords.test(prefix)) {
    // Это описательный контекст, сохраняем
    return text;
  }

  // Проверяем, является ли префикс "мусором" который нужно удалить
  const shouldRemovePrefix =
    // Короткие коды (2-3 буквы)
    /^[A-Z]{2,3}$/i.test(prefix) ||
    // Коды в скобках
    /^\([A-Z]{2,3}\)$/i.test(prefix) ||
    // Комбинации: "LOL BR", "LOL EU", "PUBG US", etc.
    /^[A-Z\s]+\s+[A-Z]{2,3}$/i.test(prefix) ||
    // Бренды с точками: "iCash.one", "Razer.com", etc.
    /\./i.test(prefix) ||
    // Длинные названия игр/брендов (3+ слов или 15+ символов)
    (prefix.split(/\s+/).length >= 3 || prefix.length >= 15);

  if (shouldRemovePrefix) {
    // Удаляем префикс, оставляем только номинал и то что после него
    let result = text.substring(nominalIndex).trim();
    // Очищаем от лишних символов в начале
    result = result.replace(/^[-–—\s()]+/, '').trim();
    return result;
  }

  return text;
}

/**
 * Удаляет суффиксы после номинала
 * Примеры: "2.5 EUR (EU West)" → "2.5 EUR", "10 USD (US)" → "10 USD"
 */
function removeSuffixAfterNominal(text, nominal) {
  if (!text || !nominal) return text;

  // Находим позицию номинала в тексте
  const nominalIndex = text.indexOf(nominal);
  if (nominalIndex === -1) return text;

  // Извлекаем суффикс (всё после номинала)
  const afterNominal = text.substring(nominalIndex + nominal.length).trim();

  // Если после номинала ничего нет, возвращаем как есть
  if (!afterNominal) return text;

  // Проверяем, является ли суффикс "мусором" который нужно удалить
  // Удаляем если это:
  // 1. Регионы в скобках: (EU West), (US), (AU), etc.
  // 2. Короткие коды в скобках: (BR), (JP), etc.
  // 3. Описания региона: EU West, US East, etc.

  const shouldRemoveSuffix =
    // Регионы/коды в скобках
    /^\([^)]+\)$/i.test(afterNominal) ||
    // Короткие коды стран (2-3 буквы): NL, ES, DE, UAE, KSA и т.д.
    /^[A-Z]{2,3}$/i.test(afterNominal) ||
    // Короткие описания региона (2-3 слова)
    (afterNominal.split(/\s+/).length <= 3 && /\b(west|east|north|south|central|global|worldwide|international)\b/i.test(afterNominal));

  if (shouldRemoveSuffix) {
    // Удаляем суффикс, оставляем только номинал
    return text.substring(nominalIndex, nominalIndex + nominal.length).trim();
  }

  return text;
}

/**
 * Извлекает номинал из строки и нормализует его
 * Использует normalizeNominal для стандартизации формата
 */
function extractAndNormalizeNominal(text, groupCategory) {
  const nominalMatch = findNominalInText(text);

  if (!nominalMatch) {
    return null;
  }

  const currencyHint = deriveCurrencyFromContext(groupCategory);

  // Проверяем наличие normalizeNominal (браузер или Node.js)
  const normalizeNominalFn = (typeof window !== 'undefined' && window.normalizeNominal) ||
                             (normalizeNominalModule && normalizeNominalModule.normalizeNominal) ||
                             (typeof normalizeNominal !== 'undefined' && normalizeNominal);

  if (normalizeNominalFn) {
    const normalized = normalizeNominalFn({
      rawText: nominalMatch,
      currencyHint: currencyHint
    });
    return normalized || null;
  }

  return nominalMatch;
}

/**
 * Ищет номинал в тексте (простая проверка наличия)
 */
function findNominalInText(text) {
  const patterns = [
    // ПРИОРИТЕТ 1: Символы валют (самые специфичные)
    /\$\s*[\d,]+(?:\.\d{1,2})?/,
    /[€£¥₹₽₴₪₩]\s*[\d,]+(?:\.\d{1,2})?/,
    /[\d,]+(?:\.\d{1,2})?\s*[€£¥₹₽₴₪₩\$]/,

    // ПРИОРИТЕТ 2: Специальные валюты и названия словами
    /\bRp\s*[\d,.]+/i,
    /\b(?:BHT|THB)\s+[\d,]+(?:\.\d{1,2})?/i,
    /\b[\d,]+(?:\.\d{1,2})?\s+(?:Yen|Won|Euro|Baht|Lira|Rupiah?|Dong|Ringgit|Peso|Real|Yuan|Dollars?|Pounds?|Rubles?)\b/i,

    // ПРИОРИТЕТ 3: K/M/B суффиксы
    /[\d,.]+\s*[KMB](?!ONTH|[a-z])(?:\s*[A-Z]{3})?/i,

    // ПРИОРИТЕТ 4: 3-буквенные коды валют (ISO) - ПОСЛЕДНИЕ, т.к. могут ложно срабатывать
    // Сначала проверяем "число + код" (более надёжный паттерн)
    /\b[\d,]+(?:\.\d{1,2})?\s+[A-Z]{3}\b/i,
    // Затем "код + число" (может ложно срабатывать на PIN, SET, BOX и т.д.)
    /\b[A-Z]{3}\s+[\d,]+(?:\.\d{1,2})?/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

/**
 * Определяет валюту из контекста (категория группы)
 */
function deriveCurrencyFromContext(groupCategory) {
  if (!groupCategory || typeof groupCategory !== 'string') {
    return null;
  }

  const category = groupCategory.trim().toUpperCase();

  if (/^[A-Z]{3}$/.test(category)) {
    return category;
  }

  const countryToCurrency = {
    'US': 'USD', 'UK': 'GBP', 'EU': 'EUR', 'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR',
    'CA': 'CAD', 'AU': 'AUD', 'NZ': 'NZD', 'JP': 'JPY', 'CN': 'CNY', 'KR': 'KRW', 'TW': 'TWD',
    'HK': 'HKD', 'SG': 'SGD', 'MY': 'MYR', 'TH': 'THB', 'ID': 'IDR', 'PH': 'PHP', 'VN': 'VND',
    'IN': 'INR', 'PK': 'PKR', 'BD': 'BDT', 'LK': 'LKR', 'NP': 'NPR',
    'TR': 'TRY', 'SA': 'SAR', 'AE': 'AED', 'QA': 'QAR', 'KW': 'KWD', 'BH': 'BHD', 'OM': 'OMR',
    'IL': 'ILS', 'EG': 'EGP', 'MA': 'MAD', 'ZA': 'ZAR', 'NG': 'NGN', 'KE': 'KES',
    'BR': 'BRL', 'MX': 'MXN', 'AR': 'ARS', 'CL': 'CLP', 'CO': 'COP', 'PE': 'PEN', 'CR': 'CRC',
    'RU': 'RUB', 'UA': 'UAH', 'PL': 'PLN', 'CZ': 'CZK', 'HU': 'HUF', 'RO': 'RON',
    'CH': 'CHF', 'SE': 'SEK', 'NO': 'NOK', 'DK': 'DKK'
  };

  if (countryToCurrency[category]) {
    return countryToCurrency[category];
  }

  return null;
}

/**
 * Удаляет слова-паразиты из названия
 */
function removeNoiseWords(text) {
  const noiseWords = [
    'Gift Card Code',
    'Gift Card',
    'Wallet Code',
    'Wallet',
    'PSN Card',
    'Card Code',
    'Code',
    'Card',
    'Digital',
    'Online',
    'Instant',
    'Delivery',
    'Download',
    'Guarantee',
    'Bundle',
    'Packages',
    'Package',
    'Collection',
    'Set',
    'Blessing',
    'Blesssing',
    'Steam',
    '\\(US\\)',
    '\\(UK\\)',
    '\\(EU\\)',
    '\\(ID\\)',
    '\\(UAE\\)',
    '\\(BR\\)',
    '\\(KW\\)',
    '\\(MY\\)',
    '\\(OM\\)',
    '\\(QAR\\)',
    '\\(KSA\\)',
    '\\(BH\\)',
    '\\(Global\\)',
    '\\(Worldwide\\)',
    '\\(International\\)'
  ];

  let result = text;

  // Проверяем, является ли текст составным термином из списка (Gift Card, Wallet Code и т.д.)
  // Если да, сохраняем его целиком
  const compoundTerms = ['Gift Card', 'Wallet Code', 'PSN Card', 'Card Code', 'Gift Card Code'];
  for (const term of compoundTerms) {
    if (new RegExp(`^${term}$`, 'i').test(result.trim())) {
      return result.trim();
    }
  }

  noiseWords.forEach(word => {
    // Специальная обработка для "Bundle" - не удаляем, если за ним идут описательные слова
    if (word === 'Bundle') {
      const bundlePattern = /\bBundle\s+(Pack|Set|Box|Chest|Crate|Case|Collection)\b/gi;
      if (bundlePattern.test(result)) {
        return; // Пропускаем удаление Bundle в этом случае
      }
    }

    const pattern = new RegExp(`\\b${word}\\b`, 'gi');
    const testResult = result.replace(pattern, '').trim();

    // Не удаляем слово, если после удаления остаются только предлоги/артикли
    if (testResult && !/^(of|the|a|an|in|on|at|to|for|with)\s+\w+$/i.test(testResult)) {
      result = testResult;
    }
  });

  // Удаляем дефисы только если они используются как разделители (с пробелами с обеих сторон)
  result = result.replace(/\s+[-–—]\s+/g, ' ');
  // Очищаем дефисы в начале/конце строки
  result = result.replace(/^[-–—\s]+|[-–—\s]+$/g, '');
  result = result.replace(/\s+/g, ' ');

  return result.trim();
}

/**
 * Удаляет избыточную информацию (повторы региона/бренда)
 */
function removeRedundantInfo(text, context) {
  const { groupCategory, productName } = context;

  let result = text;

  // Удаляем полное название продукта, если оно есть
  if (productName && typeof productName === 'string') {
    const escapedProductName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const productPattern = new RegExp(`\\b${escapedProductName}\\b`, 'gi');
    result = result.replace(productPattern, '').trim();
  }

  if (groupCategory && typeof groupCategory === 'string') {
    const categoryPattern = new RegExp(`\\b${groupCategory}\\b`, 'gi');
    result = result.replace(categoryPattern, '');
  }

  // Дополнительно удаляем известные бренды
  if (productName && typeof productName === 'string') {
    const brands = ['Steam', 'PlayStation', 'PSN', 'Xbox', 'Nintendo', 'Google Play', 'iTunes', 'Netflix', 'Spotify', 'Amazon'];
    brands.forEach(brand => {
      if (productName.toLowerCase().includes(brand.toLowerCase())) {
        const brandPattern = new RegExp(`\\b${brand}\\b`, 'gi');
        result = result.replace(brandPattern, '');
      }
    });
  }

  return result.trim();
}

/**
 * Обрабатывает массив вариантов и обеспечивает уникальность лейблов
 * @param {Array} variants - Массив вариантов с полями { productName, variantName, variantId, ... }
 * @param {string} groupCategory - Категория группы
 * @returns {Array} Массив объектов { variantId, label, originalName }
 */
function generateUniqueLabels(variants, groupCategory) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return [];
  }

  const labelMap = new Map();
  const results = [];

  variants.forEach(variant => {
    const context = {
      groupCategory,
      productName: variant.productName,
      variantName: variant.variantName,
      variantId: variant.variantId
    };

    const label = compactVariantLabel(context);

    if (!labelMap.has(label)) {
      labelMap.set(label, []);
    }
    labelMap.get(label).push({
      variantId: variant.variantId,
      label,
      originalName: variant.variantName,
      fullContext: context
    });
  });

  labelMap.forEach((items, label) => {
    if (items.length === 1) {
      results.push(items[0]);
    } else {
      items.forEach((item) => {
        results.push({
          ...item,
          label: label
        });
      });
    }
  });

  return results;
}

/**
 * Извлекает уточняющий суффикс для различения вариантов
 */
function extractDistinguishingSuffix(text, allTexts, currentIndex) {
  const words = text.split(/\s+/);

  for (const word of words) {
    if (word.length < 3) continue;

    const isUnique = allTexts.filter((t, i) => i !== currentIndex && t.includes(word)).length === 0;
    if (isUnique) {
      return word;
    }
  }

  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { compactVariantLabel, generateUniqueLabels };
}

if (typeof window !== 'undefined') {
  window.compactVariantLabel = compactVariantLabel;
  window.generateUniqueLabels = generateUniqueLabels;
}
