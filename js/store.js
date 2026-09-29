// Local-only persistence. Everything stays on the device.

const SPENDS_KEY = 'spend.v1.spends';
const SETTINGS_KEY = 'spend.v1.settings';

const REGION_CURRENCY = {
  IN: 'INR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', AE: 'AED', JP: 'JPY',
  CN: 'CNY', HK: 'HKD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', ZA: 'ZAR', BR: 'BRL', MX: 'MXN',
  ID: 'IDR', MY: 'MYR', PH: 'PHP', TH: 'THB', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', SA: 'SAR',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR',
  FI: 'EUR', GR: 'EUR',
};

function guessCurrency() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return REGION_CURRENCY[region] || 'USD';
  } catch {
    return 'USD';
  }
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

let spends = read(SPENDS_KEY, []);
let settings = { currency: guessCurrency(), budget: 0, ...read(SETTINGS_KEY, {}) };

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const store = {
  all: () => spends,
  settings: () => settings,

  add(items) {
    const created = items.map((s) => ({ ...s, id: uid(), createdAt: Date.now() }));
    spends = [...spends, ...created];
    write(SPENDS_KEY, spends);
    return created;
  },

  update(id, patch) {
    spends = spends.map((s) => (s.id === id ? { ...s, ...patch } : s));
    write(SPENDS_KEY, spends);
  },

  remove(ids) {
    const set = new Set([].concat(ids));
    spends = spends.filter((s) => !set.has(s.id));
    write(SPENDS_KEY, spends);
  },

  restore(items) {
    spends = [...spends, ...items];
    write(SPENDS_KEY, spends);
  },

  clear() {
    spends = [];
    write(SPENDS_KEY, spends);
  },

  saveSettings(patch) {
    settings = { ...settings, ...patch };
    write(SETTINGS_KEY, settings);
  },
};
