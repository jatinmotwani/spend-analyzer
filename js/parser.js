// Turns a spoken sentence ("spent 450 at Starbucks and 180 on an auto")
// into structured spends: amount, title, note, category and date.

export const CATEGORIES = [
  { id: 'food', name: 'Food & Drinks' },
  { id: 'travel', name: 'Travel' },
  { id: 'groceries', name: 'Groceries' },
  { id: 'shopping', name: 'Shopping' },
  { id: 'bills', name: 'Bills & Home' },
  { id: 'health', name: 'Health' },
  { id: 'fun', name: 'Fun' },
  { id: 'other', name: 'Other' },
];

const KEYWORDS = {
  food: [
    'food', 'lunch', 'dinner', 'breakfast', 'brunch', 'snack', 'coffee', 'tea', 'chai', 'cafe', 'café',
    'restaurant', 'pizza', 'burger', 'biryani', 'dosa', 'idli', 'sandwich', 'meal', 'drink', 'beer',
    'wine', 'bar', 'pub', 'juice', 'dessert', 'ice cream', 'icecream', 'bakery', 'cake', 'starbucks',
    'mcdonalds', "mcdonald's", 'mcdonald', 'kfc', 'dominos', "domino's", 'subway', 'swiggy', 'zomato',
    'chipotle', 'taco', 'sushi', 'noodle', 'momo', 'samosa', 'canteen', 'dhaba', 'takeaway', 'takeout',
    'doordash', 'uber eats', 'ubereats', 'grubhub', 'deliveroo', 'costa', 'dunkin', 'tim hortons',
    'bistro', 'diner', 'eating out', 'dining', 'thali', 'paratha', 'shawarma', 'pasta', 'chocolate',
    'cookie', 'donut', 'bagel', 'smoothie', 'boba', 'chaayos', 'haldiram', 'barbeque nation',
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
  'dirhams', 'sgd', 'cad', 'aud', 'bob',
]);

const FILLER = new Set([
  'i', "i've", 'ive', "i'd", 'we', "we've", 'just', 'spent', 'spend', 'spending', 'paid', 'pay', 'paying',
  'bought', 'buy', 'buying', 'got', 'get', 'gave', 'give', 'cost', 'costs', 'costed', 'it', 'was', 'were',
  'is', 'me', 'my', 'our', 'the', 'a', 'an', 'some', 'around', 'about', 'approx', 'approximately', 'like',
  'total', 'worth', 'of', 'only', 'today', 'tonight', 'this', 'morning', 'evening', 'afternoon', 'had',
  'have', 'has', 'and', 'also', 'plus', 'then', 'so', 'um', 'uh', 'okay', 'ok', 'hey', 'add', 'added',
  'expense', 'spends', 'amount', 'bill', 'bucks', 'each', 'rupees', 'ordered', 'order', 'took', 'did',
  'went', 'used', 'using', 'on', 'for', 'at', 'from', 'in', 'to', 'with', 'via', 'by', 'thru', 'through',
]);

const PLACE_PREPS = new Set(['at', 'from', 'in', '@']);
const ITEM_PREPS = new Set(['on', 'for', 'to', 'with', 'via', 'by']);

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = {
  hundred: 100, thousand: 1000, grand: 1000, k: 1000, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5,
  million: 1e6, crore: 1e7, crores: 1e7,
};
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const isNumeral = (t) => /^\d+(\.\d+)?$/.test(t);
const isNumberWord = (t) => t in UNITS || t in TENS;

/** Replace spelled-out numbers ("two hundred and fifty") with digits ("250"). */
export function wordsToNumbers(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const out = [];
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
        if (seen && !lastWasScale && !(current % 100 >= 20 && current % 10 === 0 && t in UNITS)) {
          if (!(current >= 100 && current % 100 === 0)) break;
        }
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

function normalize(text) {
  return (
    ` ${text} `
      .toLowerCase()
      .replace(/[“”"!?]/g, ' ')
      .replace(/(\d),(?=\d)/g, '$1') // 1,200 -> 1200
      .replace(/([₹$€£¥])/g, ' $1 ')
      .replace(/\brs\.?(?=\d)/g, 'rs ')
      .replace(/(\d)(rs|inr|usd|eur|gbp|k)\b/g, '$1 $2')
      .replace(/(\d+(?:\.\d+)?)\s*k\b/g, (_, n) => String(parseFloat(n) * 1000))
      // sentence punctuation (but keep decimals like 4.50)
      .replace(/\.(?!\d)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toISODate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Pull date phrases out of the text; returns { date, text }. */
function extractDate(text, now) {
  const today = startOfDay(now);
  let offset = null;
  let t = text;
  const take = (re, days) => {
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
    let diff = (today.getDay() - target + 7) % 7;
    if (diff === 0 && /\blast\b/.test(m[0])) diff = 7;
    offset = diff;
    t = t.replace(m[0], ' ');
  }
  const date = new Date(today);
  date.setDate(date.getDate() - (offset || 0));
  return { date: toISODate(date), text: t.replace(/\s+/g, ' ').trim() };
}

function tokenMatches(token, kw) {
  if (token === kw) return true;
  // tolerate plurals / possessives: coffees, pizzas, dominos's
  return token.startsWith(kw) && token.length - kw.length <= 2 && kw.length >= 3;
}

export function categorize(text) {
  const lower = ` ${text.toLowerCase()} `;
  const tokens = lower.split(/[^a-z0-9&'@.-]+/).filter(Boolean);
  let best = 'other';
  let bestScore = 0;
  for (const cat of Object.keys(KEYWORDS)) {
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

const titleCase = (words) =>
  words
    .map((w) => (w.length <= 2 && /\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

function splitSegments(text) {
  const parts = text.split(/\s*(?:,|;|\band\b|\balso\b|\bplus\b|\bthen\b)\s*/).filter((p) => p.trim());
  const segments = [];
  let pending = '';
  for (const part of parts) {
    const hasNumber = /\d/.test(part);
    if (!hasNumber) {
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

function parseSegment(segment, date) {
  const tokens = segment.split(' ').filter(Boolean);
  const candidates = [];
  tokens.forEach((t, i) => {
    if (!isNumeral(t)) return;
    const withCurrency = CURRENCY_WORDS.has(tokens[i - 1]) || CURRENCY_WORDS.has(tokens[i + 1]);
    candidates.push({ i, value: parseFloat(t), withCurrency });
  });
  if (!candidates.length) return null;
  const chosen =
    candidates.find((c) => c.withCurrency) || candidates.reduce((a, b) => (b.value > a.value ? b : a));
  if (!(chosen.value > 0)) return null;

  const rest = tokens.filter((t, i) => i !== chosen.i && !CURRENCY_WORDS.has(t));
  const place = [];
  const item = [];
  let mode = 'item';
  for (const t of rest) {
    if (PLACE_PREPS.has(t)) {
      mode = 'place';
      continue;
    }
    if (ITEM_PREPS.has(t)) {
      mode = 'item';
      continue;
    }
    if (FILLER.has(t) || /^[^a-z0-9₹$€£¥&]+$/.test(t)) continue;
    (mode === 'place' ? place : item).push(t.replace(/^[^\w&]+|[^\w&']+$/g, ''));
  }
  const clean = (a) => a.filter(Boolean);
  const placeWords = clean(place);
  const itemWords = clean(item);
  const category = categorize(segment);
  const catName = CATEGORIES.find((c) => c.id === category).name;
  const title = placeWords.length ? titleCase(placeWords) : itemWords.length ? titleCase(itemWords) : catName;
  const note = placeWords.length && itemWords.length ? itemWords.join(' ') : '';

  return { amount: Math.round(chosen.value * 100) / 100, title, note, category, date };
}

/**
 * Parse a transcript into zero or more spends.
 * @returns {{amount:number,title:string,note:string,category:string,date:string}[]}
 */
export function parseSpends(transcript, now = new Date()) {
  if (!transcript || !transcript.trim()) return [];
  const { date, text } = extractDate(normalize(transcript), now);
  const withNumbers = wordsToNumbers(text);
  return splitSegments(withNumbers)
    .map((seg) => parseSegment(seg, date))
    .filter(Boolean);
}
