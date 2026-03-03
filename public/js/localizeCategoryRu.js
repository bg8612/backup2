window.localizeCategoryRu = function(rawCategory, { mode = "short" } = {}) {
  if (!rawCategory) {
    return 'Другое';
  }

  const normalized = String(rawCategory).trim();
  const firstToken = normalized.split(/\s+/)[0].toUpperCase();

  const codeMapping = {
    'GB': 'UK'
  };

  const upperKey = codeMapping[firstToken] || firstToken;

  const dictionary = {
    'ACTIVISION': { short: 'Активижн', full: 'Активижн (платформа)' },

    'AE': { short: 'ОАЭ', full: 'ОАЭ' },
    'AT': { short: 'Австрия', full: 'Австрия' },
    'AU': { short: 'Австралия', full: 'Австралия' },
    'BD': { short: 'Бангладеш', full: 'Бангладеш' },
    'BE': { short: 'Бельгия', full: 'Бельгия' },
    'BH': { short: 'Бахрейн', full: 'Бахрейн' },
    'BR': { short: 'Бразилия', full: 'Бразилия' },
    'CA': { short: 'Канада', full: 'Канада' },
    'CN': { short: 'Китай', full: 'Китай' },
    'DE': { short: 'Германия', full: 'Германия' },
    'EG': { short: 'Египет', full: 'Египет' },
    'ES': { short: 'Испания', full: 'Испания' },
    'FI': { short: 'Финляндия', full: 'Финляндия' },
    'FR': { short: 'Франция', full: 'Франция' },
    'HK': { short: 'Гонконг', full: 'Гонконг' },
    'HR': { short: 'Хорватия', full: 'Хорватия' },
    'HU': { short: 'Венгрия', full: 'Венгрия' },
    'ID': { short: 'Индонезия', full: 'Индонезия' },
    'IE': { short: 'Ирландия', full: 'Ирландия' },
    'IN': { short: 'Индия', full: 'Индия' },
    'IT': { short: 'Италия', full: 'Италия' },
    'JP': { short: 'Япония', full: 'Япония' },
    'KH': { short: 'Камбоджа', full: 'Камбоджа' },
    'KR': { short: 'Юж. Корея', full: 'Южная Корея' },
    'KW': { short: 'Кувейт', full: 'Кувейт' },
    'KZ': { short: 'Казахстан', full: 'Казахстан' },
    'LB': { short: 'Ливан', full: 'Ливан' },
    'LU': { short: 'Люксембург', full: 'Люксембург' },
    'MX': { short: 'Мексика', full: 'Мексика' },
    'MY': { short: 'Малайзия', full: 'Малайзия' },
    'NL': { short: 'Нидерланды', full: 'Нидерланды' },
    'OM': { short: 'Оман', full: 'Оман' },
    'PH': { short: 'Филиппины', full: 'Филиппины' },
    'PK': { short: 'Пакистан', full: 'Пакистан' },
    'PL': { short: 'Польша', full: 'Польша' },
    'PT': { short: 'Португалия', full: 'Португалия' },
    'QA': { short: 'Катар', full: 'Катар' },
    'RU': { short: 'Россия', full: 'Россия' },
    'SA': { short: 'Сауд. Аравия', full: 'Саудовская Аравия' },
    'SG': { short: 'Сингапур', full: 'Сингапур' },
    'SK': { short: 'Словакия', full: 'Словакия' },
    'TH': { short: 'Таиланд', full: 'Таиланд' },
    'TR': { short: 'Турция', full: 'Турция' },
    'UK': { short: 'Британия', full: 'Великобритания' },
    'US': { short: 'США', full: 'США' },
    'VN': { short: 'Вьетнам', full: 'Вьетнам' },

    'CAMBODIA': { short: 'Камбоджа', full: 'Камбоджа' },
    'INDONESIA': { short: 'Индонезия', full: 'Индонезия' },
    'MALAYSIA': { short: 'Малайзия', full: 'Малайзия' },
    'PHILIPPINES': { short: 'Филиппины', full: 'Филиппины' },
    'SINGAPORE': { short: 'Сингапур', full: 'Сингапур' },
    'THAILAND': { short: 'Таиланд', full: 'Таиланд' },

    'ASIA': { short: 'Азия', full: 'Азия' },
    'EU': { short: 'Европа', full: 'Европа' },
    'LATAM': { short: 'Лат. Америка', full: 'Латинская Америка' },
    'NA': { short: 'Сев. Америка', full: 'Северная Америка' },
    'SEA': { short: 'ЮВА', full: 'Юго-Восточная Азия' },
    'GLOBAL': { short: 'Глобально', full: 'Глобально' },
    'MY/SG': { short: 'MY/SG', full: 'Малайзия / Сингапур' },
    'KSA': { short: 'Сауд. Аравия', full: 'Саудовская Аравия' },
    'UAE': { short: 'ОАЭ', full: 'ОАЭ' },
    'OTHER': { short: 'Другое', full: 'Другое (прочие регионы)' },

    'MAX': { short: 'Free Fire MAX', full: 'Free Fire MAX (версия игры)' },

    'AED': { short: 'ОАЭ', full: 'ОАЭ (дирхам)' },
    'AUD': { short: 'Австралия', full: 'Австралия (австралийский доллар)' },
    'BRL': { short: 'Бразилия', full: 'Бразилия (бразильский реал)' },
    'CAD': { short: 'Канада', full: 'Канада (канадский доллар)' },
    'CLP': { short: 'Чили', full: 'Чили (чилийское песо)' },
    'COP': { short: 'Колумбия', full: 'Колумбия (колумбийское песо)' },
    'CRC': { short: 'Коста-Рика', full: 'Коста-Рика (костариканский колон)' },
    'EUR': { short: 'Европа', full: 'Европа (евро)' },
    'HKD': { short: 'Гонконг', full: 'Гонконг (гонконгский доллар)' },
    'IDR': { short: 'Индонезия', full: 'Индонезия (индонезийская рупия)' },
    'INR': { short: 'Индия', full: 'Индия (индийская рупия)' },
    'KRW': { short: 'Юж. Корея', full: 'Южная Корея (вона)' },
    'KWD': { short: 'Кувейт', full: 'Кувейт (кувейтский динар)' },
    'MXN': { short: 'Мексика', full: 'Мексика (мексиканское песо)' },
    'MYR': { short: 'Малайзия', full: 'Малайзия (малайзийский ринггит)' },
    'NZD': { short: 'Новая Зеландия', full: 'Новая Зеландия (новозеландский доллар)' },
    'OMR': { short: 'Оман', full: 'Оман (оманский риал)' },
    'PEN': { short: 'Перу', full: 'Перу (перуанский соль)' },
    'PHP': { short: 'Филиппины', full: 'Филиппины (филиппинское песо)' },
    'QAR': { short: 'Катар', full: 'Катар (катарский риал)' },
    'SAR': { short: 'Сауд. Аравия', full: 'Саудовская Аравия (саудовский риял)' },
    'SGD': { short: 'Сингапур', full: 'Сингапур (сингапурский доллар)' },
    'THB': { short: 'Таиланд', full: 'Таиланд (тайский бат)' },
    'TRY': { short: 'Турция', full: 'Турция (турецкая лира)' },
    'TWD': { short: 'Тайвань', full: 'Тайвань (новый тайваньский доллар)' },
    'USD': { short: 'США', full: 'США (доллар США)' },
    'UYU': { short: 'Уругвай', full: 'Уругвай (уругвайское песо)' },
    'VND': { short: 'Вьетнам', full: 'Вьетнам (вьетнамский донг)' },
    'ZAR': { short: 'ЮАР', full: 'ЮАР (южноафриканский рэнд)' }
  };

  const entry = dictionary[upperKey];

  if (entry) {
    return mode === "full" ? entry.full : entry.short;
  }

  return normalized;
};
