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

function formatVariantName(productName, variantName, variantId) {
  if (!variantName || typeof variantName !== 'string') {
    return String(variantName || '');
  }

  let result = decodeHTMLEntities(variantName);

  if (productName && typeof productName === 'string' && productName.trim()) {
    const escapedProductName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixPattern = new RegExp(`^${escapedProductName}\\s*[-–—]\\s*`, 'i');
    result = result.replace(prefixPattern, '');
  }

  result = result.replace(/\s*\(#\d+\)\s*$/, '');

  if (variantId) {
    const idPattern = new RegExp(`\\s*\\(${variantId}\\)\\s*$`);
    result = result.replace(idPattern, '');
  }

  if (variantId) {
    const trailingIdPattern = new RegExp(`\\s+${variantId}\\s*$`);
    result = result.replace(trailingIdPattern, '');
  }

  result = result.replace(/^[-–—\s]+/, '');

  result = result.replace(/[-–—\s]+$/, '');

  result = result.replace(/\s+/g, ' ');

  result = result.trim();

  if (!result) {
    return variantName.trim();
  }

  return result;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatVariantName };
}

if (typeof window !== 'undefined') {
  window.formatVariantName = formatVariantName;
}
