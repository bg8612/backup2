function normalizeText(str) {
  if (!str) return "";

  return str
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s\u0400-\u04FF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(str) {
  const normalized = normalizeText(str);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

const VARIANT_WEIGHTS = {
  name: 100,
  ru: 80,
  short: 75,
  mixed: 60,
  latin_helpers: 50,
  case: 40,
  ru_typos: 30,
};

function indexCategory(category) {
  const {
    id,
    name,
    url,
    type,
    search_variants = {},
    search_queries = [],
  } = category;

  const normalizedName = normalizeText(name);
  const nameTokens = tokenize(name);

  const variantEntries = [];

  variantEntries.push({
    text: name,
    normalized: normalizedName,
    tokens: nameTokens,
    source: "name",
    weight: VARIANT_WEIGHTS.name,
  });

  if (url && !url.startsWith("http")) {
    const urlNormalized = normalizeText(url);
    variantEntries.push({
      text: url,
      normalized: urlNormalized,
      tokens: tokenize(url),
      source: "url",
      weight: VARIANT_WEIGHTS.name - 10,
    });
  }

  if (Array.isArray(search_queries) && search_queries.length > 0) {
    const defaultWeight = 70;

    search_queries.forEach((query) => {
      const normalized = normalizeText(query);
      if (normalized) {
        variantEntries.push({
          text: query,
          normalized,
          tokens: tokenize(query),
          source: "search_queries",
          weight: defaultWeight,
        });
      }
    });
  } else if (Object.keys(search_variants).length > 0) {
    Object.entries(search_variants).forEach(([source, variants]) => {
      if (!Array.isArray(variants)) return;

      const weight = VARIANT_WEIGHTS[source] || 20;

      variants.forEach((variant) => {
        const normalized = normalizeText(variant);
        if (normalized) {
          variantEntries.push({
            text: variant,
            normalized,
            tokens: tokenize(variant),
            source,
            weight,
          });
        }
      });
    });
  }

  const searchBlob = variantEntries.map((v) => v.normalized).join(" ");

  const dedupeKey = `${normalizedName}|${type}|${normalizeText(url)}`;

  return {
    id,
    name,
    url,
    type,
    normalizedName,
    nameTokens,
    variantEntries,
    searchBlob,
    dedupeKey,
    _original: category,
  };
}

const MATCH_TYPES = {
  EXACT_NAME: 1000,
  EXACT_VARIANT: 800,
  PREFIX_NAME: 600,
  PREFIX_VARIANT: 400,
  ALL_TOKENS: 300,
  SUBSTRING: 200,
  FUZZY: 100,
};

function levenshteinLimited(a, b, maxDistance = 2) {
  if (Math.abs(a.length - b.length) > maxDistance) return Infinity;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    let minInRow = Infinity;

    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }

      minInRow = Math.min(minInRow, matrix[i][j]);
    }

    if (minInRow > maxDistance) return Infinity;
  }

  return matrix[b.length][a.length];
}

function scoreCategory(indexed, query, normalizedQuery, queryTokens) {
  let bestScore = 0;
  let bestMatchType = null;
  let bestSource = null;
  let matchedText = null;

  if (indexed.normalizedName === normalizedQuery) {
    return {
      score: MATCH_TYPES.EXACT_NAME + VARIANT_WEIGHTS.name,
      matchType: "exact_name",
      source: "name",
      matchedText: indexed.name,
    };
  }

  for (const variant of indexed.variantEntries) {
    if (variant.normalized === normalizedQuery) {
      const score = MATCH_TYPES.EXACT_VARIANT + variant.weight;
      if (score > bestScore) {
        bestScore = score;
        bestMatchType = "exact_variant";
        bestSource = variant.source;
        matchedText = variant.text;
      }
    }
  }

  if (bestScore > 0) {
    return {
      score: bestScore,
      matchType: bestMatchType,
      source: bestSource,
      matchedText,
    };
  }

  if (indexed.normalizedName.startsWith(normalizedQuery)) {
    const score = MATCH_TYPES.PREFIX_NAME + VARIANT_WEIGHTS.name;
    if (score > bestScore) {
      bestScore = score;
      bestMatchType = "prefix_name";
      bestSource = "name";
      matchedText = indexed.name;
    }
  }

  for (const variant of indexed.variantEntries) {
    if (variant.normalized.startsWith(normalizedQuery)) {
      const score = MATCH_TYPES.PREFIX_VARIANT + variant.weight;
      if (score > bestScore) {
        bestScore = score;
        bestMatchType = "prefix_variant";
        bestSource = variant.source;
        matchedText = variant.text;
      }
    }
  }

  if (bestScore > 0) {
    return {
      score: bestScore,
      matchType: bestMatchType,
      source: bestSource,
      matchedText,
    };
  }

  if (queryTokens.length > 1) {
    for (const variant of indexed.variantEntries) {
      const allMatched = queryTokens.every((qToken) =>
        variant.tokens.some((vToken) => vToken.startsWith(qToken)),
      );

      if (allMatched) {
        const score = MATCH_TYPES.ALL_TOKENS + variant.weight;
        if (score > bestScore) {
          bestScore = score;
          bestMatchType = "all_tokens";
          bestSource = variant.source;
          matchedText = variant.text;
        }
      }
    }
  }

  if (bestScore > 0) {
    return {
      score: bestScore,
      matchType: bestMatchType,
      source: bestSource,
      matchedText,
    };
  }

  if (indexed.searchBlob.includes(normalizedQuery)) {
    for (const variant of indexed.variantEntries) {
      if (variant.normalized.includes(normalizedQuery)) {
        const score = MATCH_TYPES.SUBSTRING + variant.weight * 0.5;
        if (score > bestScore) {
          bestScore = score;
          bestMatchType = "substring";
          bestSource = variant.source;
          matchedText = variant.text;
        }
      }
    }
  }

  if (bestScore > 0) {
    return {
      score: bestScore,
      matchType: bestMatchType,
      source: bestSource,
      matchedText,
    };
  }

  if (normalizedQuery.length >= 3 && normalizedQuery.length <= 15) {
    const topVariants = [
      {
        normalized: indexed.normalizedName,
        weight: VARIANT_WEIGHTS.name,
        source: "name",
        text: indexed.name,
      },
      ...indexed.variantEntries
        .filter((v) => ["ru", "short", "mixed"].includes(v.source))
        .slice(0, 5),
    ];

    for (const variant of topVariants) {
      const distance = levenshteinLimited(
        normalizedQuery,
        variant.normalized,
        2,
      );

      if (distance <= 2) {
        const score = MATCH_TYPES.FUZZY + variant.weight * 0.3 - distance * 20;
        if (score > bestScore) {
          bestScore = score;
          bestMatchType = "fuzzy";
          bestSource = variant.source;
          matchedText = variant.text;
        }
      }
    }
  }

  if (bestScore > 0) {
    return {
      score: bestScore,
      matchType: bestMatchType,
      source: bestSource,
      matchedText,
    };
  }

  return null;
}

export function createCategorySearchEngine(categories, options = {}) {
  const { enableFuzzy = true, maxFuzzyDistance = 2 } = options;

  const indexed = categories.map(indexCategory);

  function search(query, searchOptions = {}) {
    const { limit = 10, type = null } = searchOptions;

    if (!query || typeof query !== "string") {
      return [];
    }

    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return [];
    }

    const queryTokens = tokenize(query);

    const candidates = type
      ? indexed.filter((item) => item.type === type)
      : indexed;

    const scored = [];

    for (const item of candidates) {
      const scoreResult = scoreCategory(
        item,
        query,
        normalizedQuery,
        queryTokens,
      );

      if (scoreResult) {
        scored.push({
          ...item._original,
          _score: scoreResult.score,
          _matchType: scoreResult.matchType,
          _source: scoreResult.source,
          _matchedText: scoreResult.matchedText,
          _dedupeKey: item.dedupeKey,
        });
      }
    }

    scored.sort((a, b) => b._score - a._score);

    const seen = new Set();
    const deduped = [];

    for (const item of scored) {
      if (!seen.has(item._dedupeKey)) {
        seen.add(item._dedupeKey);
        deduped.push(item);
      }
    }

    return deduped.slice(0, limit);
  }

  function getAll(filterOptions = {}) {
    const { type = null } = filterOptions;

    if (type) {
      return categories.filter((cat) => cat.type === type);
    }

    return [...categories];
  }

  return {
    search,
    getAll,
    _indexed: indexed,
  };
}

export function initHomeCategorySearch(config) {
  const {
    inputEl,
    dropdownEl,
    engine,
    onSelect,
    limit = 8,
    debounceMs = 80,
    highlightMatch = true,
  } = config;

  if (!inputEl || !dropdownEl || !engine) {
    console.error("initHomeCategorySearch: missing required elements");
    return;
  }

  let debounceTimer = null;
  let currentResults = [];
  let activeIndex = -1;

  function highlightText(text, query) {
    if (!highlightMatch || !query) {
      return escapeHtml(text);
    }

    const escapedText = escapeHtml(text);
    const normalizedText = normalizeText(text);
    const normalizedQuery = normalizeText(query);

    const index = normalizedText.indexOf(normalizedQuery);

    if (index === -1) {
      return escapedText;
    }

    let originalIndex = 0;
    let normalizedIndex = 0;

    while (normalizedIndex < index && originalIndex < text.length) {
      const char = text[originalIndex];
      const normalized = normalizeText(char);
      if (normalized) {
        normalizedIndex += normalized.length;
      }
      originalIndex++;
    }

    const before = escapeHtml(text.substring(0, originalIndex));
    const match = escapeHtml(
      text.substring(originalIndex, originalIndex + query.length),
    );
    const after = escapeHtml(text.substring(originalIndex + query.length));

    return `${before}<mark class="search-highlight">${match}</mark>${after}`;
  }

  function renderResults(results, query) {
    if (!results || results.length === 0) {
      dropdownEl.innerHTML =
        '<div class="search-dropdown__empty">Ничего не найдено</div>';
      dropdownEl.classList.add("search-dropdown--visible");
      return;
    }

    const html = results
      .map((item, index) => {
        const highlightedName = highlightText(item.name, query);
        const activeClass =
          index === activeIndex ? "search-result--active" : "";

        return `
        <div class="search-result ${activeClass}" data-index="${index}">
          <div class="search-result__name">${highlightedName}</div>
        </div>
      `;
      })
      .join("");

    dropdownEl.innerHTML = html;
    dropdownEl.classList.add("search-dropdown--visible");
  }

  function hideDropdown() {
    dropdownEl.classList.remove("search-dropdown--visible");
    activeIndex = -1;
  }

  function performSearch() {
    const query = inputEl.value.trim();

    if (!query) {
      hideDropdown();
      currentResults = [];
      return;
    }

    const results = engine.search(query, { limit });
    currentResults = results;

    if (results.length === 0) {
      renderResults([], query);
    } else {
      renderResults(results, query);
    }
  }

  function handleInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(performSearch, debounceMs);
  }

  function handleKeydown(e) {
    if (!dropdownEl.classList.contains("search-dropdown--visible")) {
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
        renderResults(currentResults, inputEl.value.trim());
        break;

      case "ArrowUp":
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, -1);
        renderResults(currentResults, inputEl.value.trim());
        break;

      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && currentResults[activeIndex]) {
          onSelect(currentResults[activeIndex]);
        } else if (currentResults.length > 0) {
          onSelect(currentResults[0]);
        }
        hideDropdown();
        break;

      case "Escape":
        e.preventDefault();
        hideDropdown();
        break;
    }
  }

  function handleResultClick(e) {
    const resultEl = e.target.closest(".search-result");
    if (!resultEl) return;

    const index = parseInt(resultEl.dataset.index, 10);
    if (currentResults[index]) {
      onSelect(currentResults[index]);
      hideDropdown();
    }
  }

  function handleClickOutside(e) {
    if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
      hideDropdown();
    }
  }

  inputEl.addEventListener("input", handleInput);
  inputEl.addEventListener("keydown", handleKeydown);
  dropdownEl.addEventListener("click", handleResultClick);
  document.addEventListener("click", handleClickOutside);

  return function cleanup() {
    inputEl.removeEventListener("input", handleInput);
    inputEl.removeEventListener("keydown", handleKeydown);
    dropdownEl.removeEventListener("click", handleResultClick);
    document.removeEventListener("click", handleClickOutside);
    clearTimeout(debounceTimer);
  };
}

export function initCatalogCategoryFilter(config) {
  const {
    inputEl,
    listContainerEl,
    itemSelector = "[data-category-item]",
    getItemData = null,
    engine,
    debounceMs = 80,
    emptyMessage = "Ничего не найдено",
  } = config;

  if (!inputEl || !listContainerEl || !engine) {
    console.error("initCatalogCategoryFilter: missing required elements");
    return;
  }

  let debounceTimer = null;
  let itemsMap = new Map();
  let emptyMessageEl = null;

  function initItemsMap() {
    const items = listContainerEl.querySelectorAll(itemSelector);

    items.forEach((el) => {
      let data;

      if (getItemData) {
        data = getItemData(el);
      } else {
        data = {
          id: el.dataset.id ? parseInt(el.dataset.id, 10) : null,
          name: el.dataset.name || "",
          url: el.dataset.url || "",
          type: el.dataset.type || "",
        };
      }

      if (data && data.id) {
        itemsMap.set(el, data);
      }
    });
  }

  function createEmptyMessage() {
    if (!emptyMessageEl) {
      emptyMessageEl = document.createElement("div");
      emptyMessageEl.className = "catalog-filter__empty";
      emptyMessageEl.textContent = emptyMessage;
      emptyMessageEl.style.display = "none";
    }

    if (!listContainerEl.contains(emptyMessageEl)) {
      listContainerEl.appendChild(emptyMessageEl);
    }
  }

  function filterItems(query) {
    if (!query) {
      itemsMap.forEach((data, el) => {
        el.style.display = "";
      });

      if (emptyMessageEl) {
        emptyMessageEl.style.display = "none";
      }

      return;
    }

    const results = engine.search(query, { limit: 1000 });
    const resultIds = new Set(results.map((r) => r.id));

    let visibleCount = 0;

    itemsMap.forEach((data, el) => {
      if (resultIds.has(data.id)) {
        el.style.display = "";
        visibleCount++;
      } else {
        el.style.display = "none";
      }
    });

    if (visibleCount === 0) {
      if (emptyMessageEl) {
        emptyMessageEl.style.display = "block";
      }
    } else {
      if (emptyMessageEl) {
        emptyMessageEl.style.display = "none";
      }
    }
  }

  function handleInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = inputEl.value.trim();
      filterItems(query);
    }, debounceMs);
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      inputEl.value = "";
      filterItems("");
    }
  }

  initItemsMap();
  createEmptyMessage();

  inputEl.addEventListener("input", handleInput);
  inputEl.addEventListener("keydown", handleKeydown);

  return function cleanup() {
    inputEl.removeEventListener("input", handleInput);
    inputEl.removeEventListener("keydown", handleKeydown);
    clearTimeout(debounceTimer);

    if (emptyMessageEl && emptyMessageEl.parentNode) {
      emptyMessageEl.parentNode.removeChild(emptyMessageEl);
    }
  };
}
