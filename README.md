# CC Digital Menu

A responsive, static, GitHub Pages-ready menu in Turkish, English and Japanese — 216 items across
20 sections, generated automatically from `source-data/*.xlsx` on every push. There is no admin
UI and no build step to run by hand: **the spreadsheet is the single source of truth.**

## Folder structure

```
RestaurantMenu/            ← this folder is the repository ROOT on GitHub
├── index.html                ← the public menu page
├── styles.css                ← black / gold / white theme, fully responsive
├── app.js                    ← page logic (language, view toggle, sections, modal)
├── menu-data.js              ← generated dishes + categories (do not edit by hand)
├── package.json              ← declares the `xlsx` converter dependency
├── .gitignore                ← keeps node_modules/ out of the repository
├── .github/workflows/
│   └── deploy-pages.yml      ← regenerates menu-data.js from Excel and publishes to Pages
├── scripts/
│   └── generate-menu.js      ← the Excel → menu-data.js converter
├── photos/
│   ├── <Dish name>.jpg       ← dish photos, named exactly as in the Turkish column
│   ├── <Category name>.png   ← one image per category (Mezeler.png, Tatlılar.png, …)
│   ├── Tümü.png              ← image for the "Tümü / All" tile
│   └── default.png           ← placeholder shown when no photo is found
└── source-data/
    └── <any name>.xlsx       ← the source spreadsheet (file name does not matter)
```

source-data/ içinde tek bir excel var (adı ne olursa olsun) -> O dosya kullanılır ✅
source-data/ içinde birden fazla excel var -> Alfabetik sıraya göre ilk gelen kullanılır, diğerleri görmezden gelinir (uyarı basılır) ⚠️
source-data/ klasörü hiç yoksa veya içinde hiç excel dosyası yoksa -> Script hata verip durur (process.exit(1)) ❌

## Updating the menu — fully automatic
1. Edit the spreadsheet in `source-data/` (prices, names, categories, new rows).
2. Commit and push it to the `main` branch.
3. GitHub Actions runs `npm ci` → `npm run generate-menu` → rebuilds `menu-data.js` → deploys to
   GitHub Pages. Nothing else to do; the live menu is updated in a couple of minutes.

Any `.xlsx` in `source-data/` is picked up, so the file may be renamed. If several are present the
alphabetically first one is used (the others are ignored with a warning); if there is none the build
fails. `menu-data.js` is rebuilt during the deploy, so the copy in the repository is only a
fallback — never edit it by hand.

Running it locally is optional and only useful for previewing before pushing:

```
npm install          (once)
npm run generate-menu
```

`node_modules/` is git-ignored — the workflow installs it in the cloud from `package-lock.json`.

## Expected spreadsheet columns
The converter matches headers case-insensitively and accepts several spellings:

| Content | Accepted headers |
|---|---|
| Turkish name | `urun`, `tr`, `türkçe`, `name_tr` |
| English name | `urun_eng`, `en`, `english`, `name_en` |
| Japanese name | `urun_jp_kanji`, `ja`, `japanese`, `name_ja` |
| Japanese (Latin) | `urun_jp`, `romaji`, `ja_latn` |
| Category | `kategori`, `category` |
| Price | `fiyat`, `price` |
| Photo (optional) | `foto`, `photo`, `image` |
| Ingredients (optional) | `icindekiler`, `içindekiler`, `ingredients`, `malzemeler` |

If the photo column is empty the Turkish name is used as the photo name. The ingredients column is
free text; the dish popup always shows an **İçindekiler / Ingredients / 材料:** label followed by
that text (blank until the column is filled). A product may be listed in **more than one category** (e.g.
`Sosis Tava` under both `Ara Sıcaklar` and `Kahvaltılar`) — it then appears in each of them; only an
exact repeat inside the same category is dropped. Rows whose category is
`İçecekler` are split automatically into Hot Drinks / Cold Drinks / Beers / Spirits / Wines /
Whiskies from keywords in the product name.

## Photo naming
Photos are looked up by the **exact Turkish name** of the dish, e.g. `Gavurdağı Salata` →
`photos/Gavurdağı Salata.jpg`. Extensions are tried in this order: `.jpg`, `.jpeg`, `.png`,
`.webp`; if none exists the item falls back to `photos/default.png` — nothing breaks when a photo
is missing. GitHub is case-sensitive, so the capitalisation must match the spreadsheet exactly.

## Category images
Every category has its own image in `photos/`, named exactly as the **Turkish category name**
(`Mezeler.png`, `Ara Sıcaklar.png`, `Şaraplar.png`, …), plus `Tümü.png` for the "All" tile. They
are used on the home page in both the card and the list layout. Extensions are tried `.png`,
`.jpg`, `.jpeg`, `.webp`, falling back to `photos/default.png`. All 21 are gold line-art cards on
a warm background, drawn as one matching set in the site's theme. To replace any of them with a
real photograph, just drop a new file over it under the same name — no code change needed.

## Navigation
- The home page lists all categories as tiles (card or list layout).
- Inside a category the top-left button is **Ana Sayfaya Dön** (Back to Home / ホームに戻る /
  Hōmu ni Modoru) and returns to that home page; the dropdown next to it jumps between categories.

## Colour theme
Black, gold and white throughout — black header/nav, gold highlights for prices, category
labels, active nav states and the view toggle, white content background.

## Click to enlarge
Clicking any dish (in either list or card view) opens a large photo with its name shown big in
the currently selected language, its name in the **other three languages** underneath (names
only, no heading), an **İçindekiler:** line with the ingredients from the spreadsheet, its category, and price.

## Feedback button
A speech-bubble button sits at the **bottom-left** of every page (black / gold, icon only on
phones). It opens the MS Forms survey in a new tab. The link is the `FEEDBACK_FORM_URL` constant at
the top of `app.js` — paste the Forms address between the quotes. While it is empty the button is
visible but does nothing.

## Sections — shown in this exact order everywhere
Tümü (All) → Çorbalar → Salatalar → Mezeler → Zeytinyağlılar → Ara Sıcaklar → Burgerler →
Ana Yemekler → Special → Pizzalar → Pide-Lahmacun → Makarnalar → Tatlılar → Kahvaltılar →
Kuru Yemişler → Sıcak İçecekler → Soğuk İçecekler → Biralar → Alkollü İçecekler → Şaraplar →
Viskiler

Dishes are always grouped by section — never mixed together — in both list and card layouts.

## Views
- **List view** — compact rows, one dish per line.
- **Card view** — photo grid, **5 per row on desktop**, automatically reducing to 4 / 3 / 2
  columns on tablets and phones.
- Toggle is at the **top-left of the header**.

## Languages
Turkish, English and Japanese (kana and Latin) — switch from the dropdown at the top-right of the
header. Every dish name, category label, and UI text is translated.

## Mobile support
Tested breakpoints cover common iOS and Android phone widths (down to 360px), with safe-area
padding for notches, 44px+ tap targets, no horizontal scroll, and fluid card/list layouts.

## Run locally
Open `index.html` directly in a browser — no build step or installation required.

## Publish with GitHub Pages
1. Create a GitHub repository.
2. Upload the **contents of this folder** to the repository root — `index.html` and `.github/`
   must sit at the top level, not inside a sub-folder, or the workflow will not run.
3. In repository **Settings → Pages**.
4. Under "Build and deployment" → Source: **GitHub Actions**.
5. Push to `main`; the "Deploy menu site" workflow builds and publishes the site.
6. Use the published Pages address when creating your QR code.

## Data source
Menu names, categories, prices and ingredients come from the spreadsheet in `source-data/` (216 items).
Please verify the generated menu against the restaurant's current menu before publishing,
especially prices — update the spreadsheet and push to correct anything.
