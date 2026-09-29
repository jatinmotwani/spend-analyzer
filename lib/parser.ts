// Rule-based parser: turns "spent 450 at Starbucks and 180 on an auto yesterday"
// into structured spends. Pure and free: no network, no model calls.
import { CATEGORY_NAMES, type CategoryId } from './categories';
import { addDays, parseISODate, toISODate } from './dates';

export type ParsedSpend = {
  amount: number;
  title: string;
  note: string;
  category: CategoryId;
  date: string; // YYYY-MM-DD
};

const KEYWORDS: Record<Exclude<CategoryId, 'other'>, string[]> = {
  food: [
    'food', 'lunch', 'dinner', 'breakfast', 'brunch', 'snack', 'coffee', 'tea', 'chai', 'cafe', 'café',
    'restaurant', 'pizza', 'burger', 'biryani', 'dosa', 'idli', 'sandwich', 'meal', 'drink', 'beer',
    'wine', 'bar', 'pub', 'juice', 'dessert', 'ice cream', 'icecream', 'bakery', 'cake', 'starbucks',
    'mcdonalds', "mcdonald's", 'mcdonald', 'kfc', 'dominos', "domino's", 'subway', 'swiggy', 'zomato',
    'chipotle', 'taco', 'sushi', 'noodle', 'momo', 'samosa', 'canteen', 'dhaba', 'takeaway', 'takeout',
    'doordash', 'uber eats', 'ubereats', 'grubhub', 'deliveroo', 'costa', 'dunkin', 'tim hortons',
    'bistro', 'diner', 'eating out', 'dining', 'thali', 'paratha', 'shawarma', 'pasta', 'chocolate',
    'cookie', 'donut', 'bagel', 'smoothie', 'boba', 'chaayos', 'haldiram', 'barbeque nation', 'eatsure',
  ],
  travel: [
    'uber', 'ola', 'lyft', 'rapido', 'taxi', 'cab', 'auto', 'rickshaw', 'metro', 'bus', 'train',
    'fuel', 'petrol', 'diesel', 'gas', 'gas station', 'parking', 'toll', 'fastag', 'flight', 'airline',
    'airport', 'indigo', 'air india', 'irctc', 'travel', 'trip', 'hotel', 'airbnb', 'hostel', 'bike',
    'scooter', 'commute', 'fare', 'ferry', 'car wash', 'car service', 'oyo', 'makemytrip', 'bolt',
  ],
  groceries: [
    'grocery', 'groceries', 'supermarket', 'vegetable', 'veggies', 'fruit', 'milk', 'egg', 'bread',
    'rice', 'dal', 'atta', 'kirana', 'dmart', 'd mart', 'bigbasket', 'big basket', 'blinkit', 'zepto',
    'instamart', 'jiomart', 'walmart', 'costco', 'whole foods', 'trader joe', 'aldi', 'lidl', 'tesco',
    'sainsbury', 'kroger', 'safeway', 'more supermarket', 'reliance fresh', 'provisions', 'produce',
  ],
  shopping: [
    'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'clothes', 'clothing', 'shirt', 'tshirt', 't-shirt',
    'jeans', 'shoe', 'sneaker', 'dress', 'jacket', 'mall', 'shopping', 'electronics', 'phone', 'laptop',
    'headphone', 'earphone', 'gadget', 'gift', 'ikea', 'zara', 'h&m', 'uniqlo', 'nike', 'adidas',
    'decathlon', 'target', 'bag', 'watch', 'furniture', 'book', 'stationery', 'cosmetics', 'makeup',
    'nykaa', 'sephora', 'perfume', 'accessories', 'croma', 'apple store', 'lenskart', 'glasses',
  ],
  bills: [
    'rent', 'electricity', 'electric', 'water bill', 'wifi', 'wi-fi', 'internet', 'broadband',
    'phone bill', 'mobile bill', 'recharge', 'airtel', 'jio', 'vodafone', 'bsnl', 'verizon', 'at&t',
    't-mobile', 'insurance', 'emi', 'loan', 'maintenance', 'society', 'utilities', 'utility', 'bill',
    'gas bill', 'dth', 'tata play', 'tata sky', 'credit card', 'tax', 'fees', 'tuition', 'school',
    'course', 'maid', 'cook', 'laundry', 'repair', 'plumber', 'electrician', 'cleaning', 'mortgage',
  ],
  health: [
    'doctor', 'hospital', 'clinic', 'medicine', 'meds', 'pharmacy', 'chemist', 'apollo', 'pharmeasy',
    '1mg', 'dentist', 'dental', 'gym', 'fitness', 'yoga', 'cult', 'cultfit', 'therapy', 'physio',
    'checkup', 'check-up', 'vitamin', 'supplement', 'salon', 'haircut', 'spa', 'massage', 'skincare',
    'lab test', 'blood test', 'health', 'medical',
  ],
  fun: [
    'movie', 'cinema', 'pvr', 'inox', 'netflix', 'spotify', 'prime video', 'hotstar', 'disney',
    'youtube', 'apple music', 'concert', 'show', 'game', 'gaming', 'steam', 'playstation', 'xbox',
    'party', 'club', 'bowling', 'outing', 'event', 'bookmyshow', 'amusement', 'museum', 'hobby',
    'subscription', 'theatre', 'theater', 'standup', 'stand-up', 'festival', 'arcade', 'karaoke',
  ],
};

const CURRENCY_WORDS = new Set([
  'rs', 'rs.', 'inr', 'rupee', 'rupees', 'rupay', '₹', '$', 'usd', 'dollar', 'dollars', 'buck', 'bucks',
  'eur', 'euro', 'euros', '€', '£', 'gbp', 'pound', 'pounds', 'quid', 'yen', '¥', 'aed', 'dirham',
  'dirhams', 'sgd', 'cad', 'aud',
]);

const FILLER = new Set([
  'i', "i've", 'ive', "i'd", 'we', "we've", 'just', 'spent', 'spend', 'spending', 'paid', 'pay', 'paying',
  'bought', 'buy', 'buying', 'got', 'get', 'gave', 'give', 'cost', 'costs', 'costed', 'it', 'was', 'were',
  'is', 'me', 'my', 'our', 'the', 'a', 'an', 'some', 'around', 'about', 'approx', 'approximately', 'like',
  'total', 'worth', 'of', 'only', 'today', 'tonight', 'this', 'morning', 'evening', 'afternoon', 'had',
  'have', 'has', 'and', 'also', 'plus', 'then', 'so', 'um', 'uh', 'okay', 'ok', 'hey', 'add', 'added',
  'expense', 'spends', 'amount', 'bucks', 'each', 'rupees', 'ordered', 'order', 'took', 'did', 'went',
  'used', 'using', 'on', 'for', 'at', 'from', 'in', 'to', 'with', 'via', 'by', 'thru', 'through',
]);

const PLACE_PREPS = new Set(['at', 'from', 'in', '@']);
const ITEM_PREPS = new Set(['on', 'for', 'to', 'with', 'via', 'by']);

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = {
  hundred: 100, thousand: 1000, grand: 1000, k: 1000, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5,
  million: 1e6, crore: 1e7, crores: 1e7,
};
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const isNumeral = (t: string) => /^\d+(\.\d+)?$/.test(t);
const isNumberWord = (t: string) => t in UNITS || t in TENS;

/** Replace spelled-out numbers ("two hundred and fifty") with digits ("250"). */
export function wordsToNumbers(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let total = 0;
    let current = 0;
    let seen = false;
    let lastWasScale = false;
    let j = i;
    for (; j < tokens.length; j++) {
      const t = tokens[j];
      const next = tokens[j + 1];
      if (isNumeral(t)) {
        // two numerals in a row are two numbers, except "2 thousand 5 hundred"
        if (seen && !(lastWasScale && current === 0 && total > 0 && parseFloat(t) < total)) break;
        current = parseFloat(t);
        seen = true;
        lastWasScale = false;
      } else if (isNumberWord(t)) {
        const tensThenUnit = current % 100 >= 20 && current % 10 === 0 && t in UNITS;
        const afterHundred = current >= 100 && current % 100 === 0;
        if (seen && !lastWasScale && !tensThenUnit && !afterHundred) break;
        current += t in UNITS ? UNITS[t] : TENS[t];
        seen = true;
        lastWasScale = false;
      } else if (t in SCALES && (seen || (t !== 'k' && tokens[j - 1] === 'a'))) {
        const scale = SCALES[t];
        if (!seen && out[out.length - 1] === 'a') out.pop();
        if (scale === 100) current = (current || 1) * 100;
        else {
          total += (current || 1) * scale;
          current = 0;
        }
        seen = true;
        lastWasScale = true;
      } else if (t === 'and' && seen && lastWasScale && next && isNumberWord(next)) {
        continue;
      } else if (t === 'a' && !seen && next in SCALES && next !== 'k') {
        continue;
      } else {
        break;
      }
    }
    if (seen) {
      out.push(String(+(total + current).toFixed(2)));
      i = j;
    } else {
      out.push(tokens[i]);
      i += 1;
    }
  }
  return out.join(' ');
}

function normalize(text: string): string {
  return ` ${text} `
    .toLowerCase()
    .replace(/[“”"!?()[\]{}<>]/g, ' ')
    .replace(/(\d),(?=\d)/g, '$1') // 1,200 -> 1200
    .replace(/([₹$€£¥])/g, ' $1 ')
    .replace(/\brs\.?(?=\d)/g, 'rs ')
    .replace(/(\d)(rs|inr|usd|eur|gbp|k)\b/g, '$1 $2')
    .replace(/(\d+(?:\.\d+)?)\s*k\b/g, (_, n: string) => String(parseFloat(n) * 1000))
    .replace(/\.(?!\d)/g, ' ') // sentence dots, but keep decimals like 4.50
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDate(text: string, today: string): { date: string; text: string } {
  const base = parseISODate(today);
  let offset: number | null = null;
  let t = text;
  const take = (re: RegExp, days: number) => {
    if (offset === null && re.test(t)) {
      offset = days;
      t = t.replace(re, ' ');
    }
  };
  take(/\b(?:the )?day before yesterday\b/, 2);
  take(/\byesterday\b|\blast night\b/, 1);
  take(/\btoday\b|\btonight\b|\bjust now\b/, 0);
  const m = t.match(/\b(?:on |last |this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (offset === null && m) {
    const target = WEEKDAYS.indexOf(m[1]);
    let diff = (base.getDay() - target + 7) % 7;
    if (diff === 0 && /\blast\b/.test(m[0])) diff = 7;
    offset = diff;
    t = t.replace(m[0], ' ');
  }
  return { date: toISODate(addDays(base, -(offset ?? 0))), text: t.replace(/\s+/g, ' ').trim() };
}

function tokenMatches(token: string, kw: string) {
  if (token === kw) return true;
  // tolerate plurals / possessives: coffees, pizzas
  return kw.length >= 3 && token.startsWith(kw) && token.length - kw.length <= 2;
}

export function categorize(text: string): CategoryId {
  const lower = ` ${text.toLowerCase()} `;
  const tokens = lower.split(/[^a-z0-9&'@.-]+/).filter(Boolean);
  let best: CategoryId = 'other';
  let bestScore = 0;
  for (const cat of Object.keys(KEYWORDS) as (keyof typeof KEYWORDS)[]) {
    let score = 0;
    for (const kw of KEYWORDS[cat]) {
      if (kw.includes(' ')) {
        if (lower.includes(` ${kw} `) || lower.includes(` ${kw}s `)) score += 3;
      } else if (tokens.some((t) => tokenMatches(t, kw))) {
        score += 1;
      }
    }
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}

const titleCase = (words: string[]) =>
  words.map((w) => (/\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

function splitSegments(text: string): string[] {
  const parts = text.split(/\s*(?:,|;|\band\b|\balso\b|\bplus\b|\bthen\b)\s*/).filter((p) => p.trim());
  const segments: string[] = [];
  let pending = '';
  for (const part of parts) {
    if (!/\d/.test(part)) {
      // no amount in this piece: it belongs to a neighbour ("coffee and cake for 300")
      if (segments.length && !pending) segments[segments.length - 1] += ` ${part}`;
      else pending += ` ${part}`;
      continue;
    }
    segments.push(`${pending} ${part}`.trim());
    pending = '';
  }
  if (pending && segments.length) segments[segments.length - 1] += pending;
  return segments.length ? segments : [text];
}

function parseSegment(segment: string, date: string): ParsedSpend | null {
  const tokens = segment.split(' ').filter(Boolean);
  const candidates: { i: number; value: number; withCurrency: boolean }[] = [];
  tokens.forEach((t, i) => {
    if (!isNumeral(t)) return;
    const withCurrency = CURRENCY_WORDS.has(tokens[i - 1]) || CURRENCY_WORDS.has(tokens[i + 1]);
    candidates.push({ i, value: parseFloat(t), withCurrency });
  });
  if (!candidates.length) return null;
  const chosen = candidates.find((c) => c.withCurrency) ?? candidates.reduce((a, b) => (b.value > a.value ? b : a));
  if (!(chosen.value > 0) || chosen.value >= 1e7) return null;

  const place: string[] = [];
  const item: string[] = [];
  let mode: 'place' | 'item' = 'item';
  tokens.forEach((t, i) => {
    if (i === chosen.i || CURRENCY_WORDS.has(t)) return;
    if (PLACE_PREPS.has(t)) return void (mode = 'place');
    if (ITEM_PREPS.has(t)) return void (mode = 'item');
    if (FILLER.has(t) || /^[^a-z0-9&]+$/.test(t)) return;
    const word = t.replace(/^[^\w&]+|[^\w&']+$/g, '');
    if (word) (mode === 'place' ? place : item).push(word);
  });

  const category = categorize(segment);
  const title = (place.length ? titleCase(place) : item.length ? titleCase(item) : CATEGORY_NAMES[category]).slice(0, 60);
  const note = place.length && item.length ? item.join(' ').slice(0, 120) : '';
  return { amount: Math.round(chosen.value * 100) / 100, title, note, category, date };
}

/** Parse a transcript into zero or more spends. `today` is the user's local date (YYYY-MM-DD). */
export function parseSpends(transcript: string, today: string): ParsedSpend[] {
  if (!transcript?.trim()) return [];
  const { date, text } = extractDate(normalize(transcript), today);
  return splitSegments(wordsToNumbers(text))
    .map((seg) => parseSegment(seg, date))
    .filter((s): s is ParsedSpend => s !== null)
    .slice(0, 10);
}
