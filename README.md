# Spend

A minimal, voice-first spend tracker. It's an installable PWA with no build step and no backend.

Tap the mic and say what you spent, e.g. *“450 at Starbucks”*, *“Uber 180 yesterday”*, or
*“1,200 on groceries at DMart and 60 for chai”*. Spend pulls out the amount, place and date, sorts
each spend into a category, and shows you where your money goes.

## What's in it

- **Voice input** through the Web Speech API. A live transcript shows while you talk. If voice isn't
  available, you can type instead.
- **Natural-language parsing** (`js/parser.js`). It understands currency symbols and words,
  `1,200` / `2.5k` / *"two hundred and fifty"*, several spends in one sentence, and *yesterday*,
  *last friday*, and so on.
- **Auto-categorisation** into Food & Drinks, Travel, Groceries, Shopping, Bills & Home, Health, Fun
  and Other. Tap any spend to fix it.
- **Dashboard**: week / month / year totals with a comparison to the same point in the previous
  period, a category breakdown, a day-by-day chart with the average, and short insights such as your
  daily average, biggest spend and budget pace.
- **Optional monthly budget**, currency picker and CSV export.
- **Private and offline**: data lives in `localStorage` on the device, and a service worker caches
  the app shell.

## Run locally

```sh
npm start        # serves on http://localhost:8080
npm test         # parser unit tests (node --test)
```

Any static host works (GitHub Pages, Netlify, Vercel, and so on). Voice input and installing the
app need HTTPS, or `localhost`.

## Notes

- Speech recognition works in Chrome, Edge and Safari (desktop and mobile). Firefox falls back to
  typing. Chrome sends audio to its speech service, so voice needs a connection there.
- When you change a shell file, bump `VERSION` in `sw.js` so installed copies update.
