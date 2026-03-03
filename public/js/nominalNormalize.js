function normalizeNominal(params) {
  if (!params || typeof params !== 'object') {
    return '';
  }

  const { rawText, currencyHint } = params;

  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  let text = rawText.trim();

  text = cleanJunkCharacters(text);

  const parsed = parseNominal(text);

  if (!parsed) {
    return text;
  }

  let { amount, currency } = parsed;

  currency = normalizeCurrency(currency, currencyHint);

  if (currency === 'USD' || currency === 'EURO') {
    const result = currency ? `${amount} ${currency}` : amount;
    return result.trim();
  } else {
    const currencyFirstPattern = /^[A-Z]{3}\s+[\d,]+/i;
    if (currencyFirstPattern.test(text.trim())) {
      const result = currency ? `${currency} ${amount}` : amount;
      return result.trim();
    } else {
      const result = currency ? `${amount} ${currency}` : amount;
      return result.trim();
    }
  }
}

function parseNominal(text) {
  const patterns = [
    { regex: /\$\s*([\d,]+(?:\.\d{1,2})?)/,  amount: 1, currency: '$' },

    { regex: /([€£¥₹₽₴₪₩])\s*([\d,]+(?:\.\d{1,2})?)/,  amount: 2, currency: 1 },

    { regex: /([\d,]+(?:\.\d{1,2})?)\s*([€£¥₹₽₴₪₩\$])/,  amount: 1, currency: 2 },

    { regex: /\b([A-Z]{3})\s*([\d,]+(?:\.\d{1,2})?)/i,  amount: 2, currency: 1 },

    { regex: /\b([\d,]+(?:\.\d{1,2})?)\s*([A-Z]{3})\b/i,  amount: 1, currency: 2 },

    { regex: /Rp\s*([\d,.]+)/i,  amount: 1, currency: 'Rp' },

    { regex: /\b([\d,]+(?:\.\d{1,2})?)\s*(WON|EURO|POUNDS?|DOLLARS?|RUBLES?|RUPEES?|PESOS?|REAIS?|YUAN|RINGGIT|BAHT|DONG|RUPIAH?|LIRA|DIRHAM|RIYAL|DINAR|SHEKEL|ZLOTY|KORUNA|FORINT|LEU|KUNA|HRYVNIA|RAND|NAIRA|SHILLING|CEDI|KWACHA|PULA|LILANGENI|LOTI)\b/i,  amount: 1, currency: 2 },

    { regex: /\b([\d,.]+\s*[KMB])\s*([A-Z]{3})\b/i,  amount: 1, currency: 2 },

    { regex: /\b([\d,]+(?:\.\d{1,2})?)\b/,  amount: 1, currency: null }
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const amount = match[pattern.amount];
      const currencyToken = pattern.currency === null
        ? null
        : (typeof pattern.currency === 'string' ? pattern.currency : match[pattern.currency]);

      return {
        amount: amount.trim(),
        currency: currencyToken ? currencyToken.trim() : null
      };
    }
  }

  return null;
}

function normalizeCurrency(currency, hint) {
  if (!currency) {
    return hint ? hint.toUpperCase() : null;
  }

  const currencyStr = String(currency).trim().toUpperCase();

  const symbolMap = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₩': 'KRW',
    '₽': 'RUB',
    '₹': 'INR',
    '₴': 'UAH',
    '₪': 'ILS',
    'RP': 'IDR'
  };

  const wordMap = {
    'WON': 'KRW',
    'EURO': 'EURO',
    'EUROS': 'EURO',
    'EUR': 'EURO',
    'POUND': 'GBP',
    'POUNDS': 'GBP',
    'DOLLAR': 'USD',
    'DOLLARS': 'USD',
    'RUBLE': 'RUB',
    'RUBLES': 'RUB',
    'RUPEE': 'INR',
    'RUPEES': 'INR',
    'PESO': 'MXN',
    'PESOS': 'MXN',
    'REAL': 'BRL',
    'REAIS': 'BRL',
    'YUAN': 'CNY',
    'RINGGIT': 'MYR',
    'BAHT': 'THB',
    'DONG': 'VND',
    'RUPIAH': 'IDR',
    'TL': 'TRY',
    'LIRA': 'TRY',
    'DIRHAM': 'AED',
    'RIYAL': 'SAR',
    'DINAR': 'KWD',
    'SHEKEL': 'ILS',
    'ZLOTY': 'PLN',
    'KORUNA': 'CZK',
    'FORINT': 'HUF',
    'LEU': 'RON',
    'KUNA': 'HRK',
    'HRYVNIA': 'UAH',
    'RAND': 'ZAR',
    'NAIRA': 'NGN',
    'SHILLING': 'KES',
    'CEDI': 'GHS',
    'KWACHA': 'ZMW',
    'PULA': 'BWP',
    'LILANGENI': 'SZL',
    'LOTI': 'LSL'
  };

  if (symbolMap[currencyStr]) {
    return symbolMap[currencyStr];
  }

  if (wordMap[currencyStr]) {
    return wordMap[currencyStr];
  }

  if (/^[A-Z]{3}$/.test(currencyStr)) {
    return currencyStr;
  }

  return currencyStr || null;
}

function cleanJunkCharacters(text) {
  let result = text;

  result = result.replace(/\(\s*\)/g, '');

  result = result.replace(/^\s*[\(\)]+\s*/, '');
  result = result.replace(/\s*[\(\)]+\s*$/, '');

  result = result.replace(/^\s*[…\.•\-–—]+\s*/, '');
  result = result.replace(/\s*[…\.•\-–—]+\s*$/, '');

  result = result.replace(/\s+/g, ' ');

  return result.trim();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeNominal, parseNominal, normalizeCurrency, cleanJunkCharacters };
}

if (typeof window !== 'undefined') {
  window.normalizeNominal = normalizeNominal;
  window.parseNominal = parseNominal;
  window.normalizeCurrency = normalizeCurrency;
  window.cleanJunkCharacters = cleanJunkCharacters;
}
