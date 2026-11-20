import { getShortLang, t } from '../core/i18n.js';

export const MAX_URL_LENGTH = 2048;
export const MAX_CUSTOM_BANGS = 20;

export const COMMON_TLDS = new Set([
  'com', 'org', 'net', 'io', 'dev', 'app', 'ai', 'co', 'edu', 'gov', 'mil', 'info', 'biz', 'me',
  'tv', 'gg', 'xyz', 'site', 'online', 'tech', 'cloud', 'store', 'blog', 'news', 'wiki', 'page',
  'link', 'so', 'to', 'ly', 'fm', 'us', 'uk', 'ca', 'de', 'fr', 'es', 'it', 'nl', 'jp', 'kr',
  'cn', 'in', 'br', 'mx', 'ar', 'cl', 'pe', 'uy', 've', 'ec', 'bo', 'cr', 'pa', 'gt', 'sv', 'hn',
  'ni', 'do', 'pr', 'pt', 'au', 'nz', 'ch', 'se', 'no', 'fi', 'dk', 'cz', 'be', 'at', 'ie', 'ru',
  'ua', 'tr', 'il', 'sg', 'hk', 'tw', 'za', 'eu', 'cat', 'pro', 'int', 'design', 'studio',
  'digital', 'tools', 'codes', 'software', 'systems', 'network', 'games', 'live', 'social',
  'media', 'video', 'music', 'space', 'world', 'work', 'shop', 'club', 'art', 'ink', 'run',
  'build', 'pub'
]);

export const BANGS = {
  '!gh': {
    prefix: '!gh',
    label: 'GitHub',
    className: 'bang-gh',
    url: 'https://github.com/search?q='
  },
  '!yt': {
    prefix: '!yt',
    label: 'YouTube',
    className: 'bang-yt',
    url: 'https://www.youtube.com/results?search_query='
  },
  '!r': {
    prefix: '!r',
    label: 'Reddit',
    className: 'bang-r',
    url: 'https://www.reddit.com/search/?q='
  },
  '!mdn': {
    prefix: '!mdn',
    label: 'MDN',
    className: 'bang-mdn',
    url: 'https://developer.mozilla.org/es/search?q='
  },
  '!so': {
    prefix: '!so',
    label: 'StackOverflow',
    className: 'bang-so',
    url: 'https://stackoverflow.com/search?q='
  },
  '!w': {
    prefix: '!w',
    label: 'Wikipedia',
    className: 'bang-w',
    url: 'https://es.wikipedia.org/w/index.php?search='
  }
};

export function getBangSearchUrl(bang, lang = getShortLang()) {
  if (!bang) return '';
  if (bang.prefix === '!mdn') {
    return lang === 'en'
      ? 'https://developer.mozilla.org/en-US/search?q='
      : 'https://developer.mozilla.org/es/search?q=';
  }
  if (bang.prefix === '!w') {
    return lang === 'en'
      ? 'https://en.wikipedia.org/w/index.php?search='
      : 'https://es.wikipedia.org/w/index.php?search=';
  }
  return bang.url;
}

export function buildBangQueryUrl(bang, query, lang = getShortLang()) {
  if (!bang) return '';
  const encoded = encodeURIComponent(query);
  if (bang.custom && bang.url.includes('{q}')) {
    return bang.url.replaceAll('{q}', encoded);
  }
  return getBangSearchUrl(bang, lang) + encoded;
}

export function sanitizeCustomBang(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  let prefix = String(raw.prefix || '').trim().toLowerCase();
  if (!prefix) return null;
  if (!prefix.startsWith('!')) {
    prefix = '!' + prefix;
  }
  if (!/^![a-z0-9_-]{1,10}$/.test(prefix)) return null;
  if (Object.prototype.hasOwnProperty.call(BANGS, prefix)) return null;

  const label = String(raw.label || '').trim().slice(0, 20);
  if (!label) return null;

  const rawTemplate = String(raw.url || '').trim();
  if (!rawTemplate || rawTemplate.length > MAX_URL_LENGTH) return null;
  if (/[\s\u0000-\u001F\u007F]/.test(rawTemplate)) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(rawTemplate) ? rawTemplate : `https://${rawTemplate}`;
  const marker = '__KOI_BANG_QUERY_MARKER__';
  const hasPlaceholder = withScheme.includes('{q}');
  const testCandidate = hasPlaceholder ? withScheme.replaceAll('{q}', marker) : withScheme;
  const safeTestUrl = sanitizeHttpUrl(testCandidate);
  if (!safeTestUrl) return null;

  try {
    const parsed = new URL(safeTestUrl);
    if (parsed.protocol !== 'https:') return null;
  } catch (_) {
    return null;
  }

  const normalizedTemplate = hasPlaceholder ? safeTestUrl.replaceAll(marker, '{q}') : safeTestUrl;
  return {
    prefix,
    label,
    url: normalizedTemplate,
    className: 'bang-custom',
    custom: true
  };
}

export function mergeBangs(customList = []) {
  const merged = { ...BANGS };
  if (!Array.isArray(customList)) return merged;
  for (let i = 0; i < customList.length; i++) {
    const sanitized = sanitizeCustomBang(customList[i]);
    if (sanitized && !merged[sanitized.prefix]) {
      merged[sanitized.prefix] = sanitized;
    }
  }
  return merged;
}

export function createStoneId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'stone-' + crypto.randomUUID();
  }
  return `stone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function sanitizeHttpUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return '';
  if (/[\s\u0000-\u001F\u007F]/.test(trimmed)) return '';

  const hadExplicitHttp = /^https?:\/\//i.test(trimmed);
  let candidate = '';
  if (hadExplicitHttp) {
    candidate = trimmed;
  } else if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d{1,5})?(\/.*)?$/i.test(trimmed)) {
    candidate = 'http://' + trimmed;
  } else if (/^[a-z0-9-]+(\.[a-z0-9-]+)+:\d{1,5}(\/.*)?$/i.test(trimmed)) {
    candidate = 'https://' + trimmed;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return '';
  } else {
    candidate = 'https://' + trimmed;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    if (parsed.username || parsed.password) {
      return '';
    }
    const host = parsed.hostname;
    if (!host || host.startsWith('.') || host.endsWith('.') || host.includes('..')) {
      return '';
    }
    const isIpOrLocal =
      host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
    if (!hadExplicitHttp && !isIpOrLocal && !host.includes('.')) {
      return '';
    }
    return parsed.href;
  } catch (_) {
    return '';
  }
}

export function extractHostname(url) {
  const safeUrl = sanitizeHttpUrl(url);
  if (!safeUrl) return '';
  try {
    return new URL(safeUrl).hostname;
  } catch (_) {
    return '';
  }
}

export function shortenTitle(title, url) {
  const raw = (title || '').trim();
  if (raw) {
    const cleaned = raw.split(/\s[-–|·:]\s/)[0].trim();
    return cleaned.length > 14 ? cleaned.slice(0, 13) + '…' : cleaned;
  }
  const host = extractHostname(url).replace(/^www\./, '');
  const base = host.split('.')[0] || t('stoneDefaultSite');
  return base.charAt(0).toUpperCase() + base.slice(1, 13);
}

export function isValidIpv4(host) {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    if (!/^\d{1,3}$/.test(parts[i])) return false;
    const n = Number(parts[i]);
    if (n < 0 || n > 255) return false;
  }
  return true;
}

export function resolveDirectUrl(query) {
  const q = String(query || '').trim();
  if (!q || /\s/.test(q)) return null;

  if (/^https?:\/\//i.test(q)) {
    return sanitizeHttpUrl(q) || null;
  }

  if (/^(localhost|0\.0\.0\.0|\[::1\])(:\d{1,5})?(\/\S*)?$/i.test(q)) {
    return sanitizeHttpUrl('http://' + q) || null;
  }

  const ipv4Match = q.match(/^(\d{1,3}(?:\.\d{1,3}){3})(:\d{1,5})?(\/\S*)?$/);
  if (ipv4Match && isValidIpv4(ipv4Match[1])) {
    return sanitizeHttpUrl('http://' + q) || null;
  }

  const hostMatch = q.match(/^([a-z0-9-]+(?:\.[a-z0-9-]+)+)(:\d{1,5})?(\/\S*)?$/i);
  if (!hostMatch) return null;

  const host = hostMatch[1];
  const hasPortOrPath = Boolean(hostMatch[2] || hostMatch[3]);
  const labels = host.split('.');
  const tld = labels[labels.length - 1].toLowerCase();

  if (!/^[a-z]{2,24}$/.test(tld)) return null;
  if (!hasPortOrPath && !COMMON_TLDS.has(tld)) return null;

  return sanitizeHttpUrl('https://' + q) || null;
}
