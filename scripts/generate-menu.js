const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const vm = require('vm');

const repoRoot = path.join(__dirname, '..');
const sourceDir = path.join(repoRoot, 'source-data');
const menuJsPath = path.join(repoRoot, 'menu-data.js');

// Pick the spreadsheet from source-data/ whatever it is called. If several are present the
// alphabetically first one is used (a warning lists the others); if none exists the run fails.
function findExcel() {
  if (!fs.existsSync(sourceDir)) {
    console.error('ERROR: source-data/ folder not found:', sourceDir);
    process.exit(1);
  }
  const files = fs.readdirSync(sourceDir)
    .filter(f => /\.(xlsx|xlsm)$/i.test(f) && !f.startsWith('~$'))
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  if (!files.length) {
    console.error('ERROR: no .xlsx file found in', sourceDir);
    process.exit(1);
  }
  const chosen = files[0];
  if (files.length > 1) {
    console.warn('Warning: ' + files.length + ' spreadsheets in source-data/ — using the alphabetically first one: "' + chosen + '". Ignored: ' + files.slice(1).map(f => '"' + f + '"').join(', '));
  }
  return path.join(sourceDir, chosen);
}

const excelPath = findExcel();

function readExistingMenuData() {
  if (!fs.existsSync(menuJsPath)) return null;
  const code = fs.readFileSync(menuJsPath, 'utf8');
  const context = {};
  vm.createContext(context);
  try {
    vm.runInContext(code + '\n;globalThis.__menuData = { CATEGORIES, CATEGORY_ORDER, MENU_ITEMS };', context, { timeout: 1000 });
  } catch (e) {
    // menu-data.js contains top-level const declarations which run fine in vm;
    // if it errors, fall back to simple parsing
    console.warn('Warning: could not fully evaluate menu-data.js, attempting partial parse');
  }
  if (context.__menuData) {
    return {
      categories: context.__menuData.CATEGORIES || null,
      categoryOrder: context.__menuData.CATEGORY_ORDER || null,
      menuItems: context.__menuData.MENU_ITEMS || null
    };
  }
  // try to extract CATEGORIES and CATEGORY_ORDER from the context or by regex
  const categories = context.CATEGORIES || null;
  const categoryOrder = context.CATEGORY_ORDER || null;
  if (categories && categoryOrder) return { categories, categoryOrder };

  // fallback: basic regex extraction
  const catMatch = code.match(/const\s+CATEGORIES\s*=\s*(\{[\s\S]*?\});/);
  const orderMatch = code.match(/const\s+CATEGORY_ORDER\s*=\s*(\[[\s\S]*?\]);/);
  let cats = null, order = null;
  if (catMatch) {
    try { cats = eval('(' + catMatch[1] + ')'); } catch (e) { cats = null; }
  }
  if (orderMatch) {
    try { order = eval(orderMatch[1]); } catch (e) { order = null; }
  }
  const itemsMatch = code.match(/const\s+MENU_ITEMS\s*=\s*(\[[\s\S]*?\]);/);
  let menuItems = null;
  if (itemsMatch) {
    try { menuItems = eval(itemsMatch[1]); } catch (e) { menuItems = null; }
  }
  return { categories: cats, categoryOrder: order, menuItems };
}

function safeKey(s) {
  return String(s || '').trim();
}

function findHeader(rowKeys, candidates) {
  const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const c of candidates) {
    const nc = normalize(c);
    const found = rowKeys.find(k => normalize(k) === nc);
    if (found) return found;
  }
  return null;
}

function slugForPhoto(text) {
  if (!text) return '';
  let s = String(text).toLowerCase();
  // normalize to NFKC to avoid weird composed characters
  s = s.normalize('NFKC');
  // replace spaces and slashes with underscore
  s = s.replace(/[\s\/\\]+/g, '_');
  // remove characters not letters, numbers, underscore, dash or Turkish letters
  // allow Unicode letters and numbers
  s = s.replace(/[^\p{L}\p{N}_\-]+/gu, '');
  s = s.replace(/_+/g, '_');
  s = s.replace(/^_+|_+$/g, '');
  return s;
}

function parsePrice(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^0-9.,\-]/g, '').trim();
  if (s === '') return null;
  // try to handle comma decimals
  const norm = s.indexOf(',') !== -1 && s.indexOf('.') === -1 ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = parseFloat(norm);
  return isNaN(n) ? null : n;
}

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryKeyForDrink(name) {
  const n = normalizeText(name);
  if (/(bira|efes|tuborg|bomonti|carlsberg|miller)/.test(n)) return 'beers';
  if (/(viski|chivas|jack daniels|johnnie walker|j viski)/.test(n)) return 'whiskies';
  if (/(sarap|wine|yakut|cankaya|villa doluca|doluca|angora|sarafin|merlot|sauvignon|chardonnay)/.test(n)) return 'wines';
  if (/(raki|vodka|votka|absolut|istanblue|likor|tekirdag|beylerbeyi|yeni raki)/.test(n)) return 'spirits';
  if (/(cay|kahve|sicak cikolata|turk kahvesi|jacobs)/.test(n)) return 'hotDrinks';
  return 'coldDrinks';
}

function existingItemKey(item) {
  const name = item && item.name ? item.name : {};
  return [
    normalizeText(item && item.category),
    normalizeText(name.tr),
    normalizeText(name.en),
    normalizeText(name.ja),
    normalizeText(item && item.photo)
  ].join('|');
}

function buildMenuItems(rows, existing) {
  const { categories, categoryOrder } = existing || { categories: {}, categoryOrder: [] };
  const keys = Object.keys(categories || {});

  const headerKeys = rows.length ? Object.keys(rows[0]) : [];
  const catHeader = findHeader(headerKeys, ['category', 'kategori', 'categoryKey', 'category_key', 'cat', 'kategoriadi']);
  // common spreadsheet headers: 'urun' (turkish), 'urun_eng' (english), 'urun_jp' (romanized japanese), 'urun_jp_kanji' (kana/kanji)
  const trHeader = findHeader(headerKeys, ['tr', 'turkish', 'türkçe', 'name_tr', 'name.tr', 'urun', 'urun_tr']);
  const enHeader = findHeader(headerKeys, ['en', 'english', 'name_en', 'name.en', 'urun_eng', 'urun_en']);
  // prefer kanji/kana column for ja display, but accept various variants
  const jaHeader = findHeader(headerKeys, ['ja', 'japanese', 'name_ja', 'name.ja', 'urun_jp_kanji', 'urun_jpkanji', 'urun_jp_kana', 'urun_jp']);
  // support an additional Latin-Japanese / romanized Japanese column (e.g., "ja_latn", "ja-latn", "japanese_latin", "romaji", "urun_jp")
  const jaLatHeader = findHeader(headerKeys, ['ja_latn', 'ja-latn', 'ja_latin', 'japanese_latin', 'romaji', 'japanese_romanized', 'urun_jp', 'urun_jp_romaji']);
  const priceHeader = findHeader(headerKeys, ['price', 'fiyat', 'price_tl', 'fiyat_tl']);
  const photoHeader = findHeader(headerKeys, ['photo', 'image', 'photo_name', 'foto']);
  const idHeader = findHeader(headerKeys, ['id', 'itemid', 'item_id']);
  const ingredientsHeader = findHeader(headerKeys, ['icindekiler', 'içindekiler', 'ingredients', 'ingredient', 'malzemeler', 'contents']);

  // find next id
  let maxId = 0;
  if (Array.isArray(existing && existing.menuItems)) existing.menuItems.forEach(it => { if (it && it.id) maxId = Math.max(maxId, Number(it.id)); });
  // try to parse from current menu-data.js file
  try {
    const md = fs.readFileSync(menuJsPath, 'utf8');
    const idMatches = md.matchAll(/\{\s*id:\s*(\d+)/g);
    for (const m of idMatches) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n)) maxId = Math.max(maxId, n);
    }
  } catch (e) {}

  const items = [];
  const existingByKey = new Map();
  if (Array.isArray(existing && existing.menuItems)) {
    existing.menuItems.forEach(item => existingByKey.set(existingItemKey(item), item));
  }
  for (const row of rows) {
    const rawKeys = Object.keys(row);
    const categoryRaw = catHeader ? row[catHeader] : null;
    let categoryKey = '';
    if (categoryRaw !== undefined && categoryRaw !== null && String(categoryRaw).trim() !== '') {
      const cr = String(categoryRaw).trim();
      if (normalizeText(cr) === 'icecekler') {
        const drinkName = row[trHeader] || row[enHeader] || row[jaHeader] || '';
        categoryKey = categoryKeyForDrink(drinkName);
      } else if (keys.includes(cr)) {
        categoryKey = cr;
      } else {
        // try to match by category display name (tr/en/ja)
        const found = keys.find(k => {
          const v = categories[k];
          if (!v) return false;
          return [v.tr, v.en, v.ja].some(name => name && name.toLowerCase().trim() === cr.toLowerCase());
        });
        if (found) categoryKey = found;
        else {
          // no match; try lower-case matching against tr
          const found2 = keys.find(k => categories[k] && categories[k].tr && categories[k].tr.toLowerCase().includes(cr.toLowerCase()));
          if (found2) categoryKey = found2;
          else categoryKey = categoryOrder && categoryOrder.length ? categoryOrder[0] : (keys[0] || 'uncategorized');
        }
      }
    } else {
      categoryKey = categoryOrder && categoryOrder.length ? categoryOrder[0] : (keys[0] || 'uncategorized');
    }

    const name_tr = trHeader ? String(row[trHeader] || '').trim() : '';
    const name_en = enHeader ? String(row[enHeader] || '').trim() : '';
    const name_ja = jaHeader ? String(row[jaHeader] || '').trim() : '';
    const name_ja_latn = jaLatHeader ? String(row[jaLatHeader] || '').trim() : '';
    // Skip completely empty rows (Excel often keeps a blank formatted row at the bottom).
    if (!name_tr && !name_en && !name_ja && !name_ja_latn) continue;
    const ingredients = ingredientsHeader ? String(row[ingredientsHeader] || '').trim() : '';
    const price = priceHeader ? parsePrice(row[priceHeader]) : parsePrice(row['Price']) || null;
    let photo = photoHeader ? String(row[photoHeader] || '').trim() : '';
    if (!photo) photo = name_tr || name_en || name_ja || name_ja_latn || '';

    let idVal = null;
    if (idHeader && row[idHeader]) idVal = row[idHeader];
    if (!idVal) idVal = ++maxId;

    const nameObj = { tr: name_tr, en: name_en, ja: name_ja };
    if(name_ja_latn) nameObj['ja_latn'] = name_ja_latn;
    const existingItem = existingByKey.get(existingItemKey({ category: categoryKey, name: nameObj, photo }));
    if (!idHeader && existingItem && existingItem.id) idVal = existingItem.id;
    items.push({ id: idVal, category: categoryKey, name: nameObj, price: price, photo: photo, ingredients: ingredients });
  }
  return items;
}

function kanaToRomaji(input){
  if(!input) return '';
  // Basic Katakana/Hiragana to Romaji transliteration covering common syllables and digraphs.
  // This is not a full morphological converter but handles katakana/ hiragana used in menu/category names.
  const map = {
    'ア':'a','イ':'i','ウ':'u','エ':'e','オ':'o',
    'カ':'ka','キ':'ki','ク':'ku','ケ':'ke','コ':'ko',
    'サ':'sa','シ':'shi','ス':'su','セ':'se','ソ':'so',
    'タ':'ta','チ':'chi','ツ':'tsu','テ':'te','ト':'to',
    'ナ':'na','ニ':'ni','ヌ':'nu','ネ':'ne','ノ':'no',
    'ハ':'ha','ヒ':'hi','フ':'fu','ヘ':'he','ホ':'ho',
    'マ':'ma','ミ':'mi','ム':'mu','メ':'me','モ':'mo',
    'ヤ':'ya','ユ':'yu','ヨ':'yo',
    'ラ':'ra','リ':'ri','ル':'ru','レ':'re','ロ':'ro',
    'ワ':'wa','ヲ':'wo','ン':'n',
    'ガ':'ga','ギ':'gi','グ':'gu','ゲ':'ge','ゴ':'go',
    'ザ':'za','ジ':'ji','ズ':'zu','ゼ':'ze','ゾ':'zo',
    'ダ':'da','ヂ':'ji','ヅ':'zu','デ':'de','ド':'do',
    'バ':'ba','ビ':'bi','ブ':'bu','ベ':'be','ボ':'bo',
    'パ':'pa','ピ':'pi','プ':'pu','ペ':'pe','ポ':'po',
    'ァ':'a','ィ':'i','ゥ':'u','ェ':'e','ォ':'o',
    'ャ':'ya','ュ':'yu','ョ':'yo','ッ':'',
    // Hiragana equivalents
    'あ':'a','い':'i','う':'u','え':'e','お':'o',
    'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
    'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
    'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
    'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
    'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
    'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
    'や':'ya','ゆ':'yu','よ':'yo',
    'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
    'わ':'wa','を':'wo','ん':'n',
    'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
    'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
    'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
    'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
    'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
    'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o',
    'ゃ':'ya','ゅ':'yu','ょ':'yo','っ':'',
    'ー':'-'
  };
  const digraphs = {
    'キャ':'kya','キュ':'kyu','キョ':'kyo','ギャ':'gya','ギュ':'gyu','ギョ':'gyo',
    'シャ':'sha','シュ':'shu','ショ':'sho','ジャ':'ja','ジュ':'ju','ジョ':'jo',
    'チャ':'cha','チュ':'chu','チョ':'cho','ニャ':'nya','ニュ':'nyu','ニョ':'nyo',
    'ヒャ':'hya','ヒュ':'hyu','ヒョ':'hyo','ビャ':'bya','ビュ':'byu','ビョ':'byo',
    'ピャ':'pya','ピュ':'pyu','ピョ':'pyo','ミャ':'mya','ミュ':'myu','ミョ':'myo',
    'リャ':'rya','リュ':'ryu','リョ':'ryo'
  };
  let s = String(input || '');
  // Remove whitespace around
  s = s.trim();
  let out = '';
  for(let i=0;i<s.length;i++){
    const a = s[i];
    const b = s[i+1] || '';
    const pair = a + b;
    // check digraphs first
    if(digraphs[pair]){ out += digraphs[pair]; i++; continue; }
    if(a === 'ー'){ // long vowel mark - repeat previous vowel if any
      const m = out.match(/[aeiou]$/i);
      if(m) out += m[0];
      continue;
    }
    if(a === 'ッ' || a === 'っ'){
      // geminate: double next consonant if possible
      const next = s[i+1];
      const romajiNext = (digraphs[next + (s[i+2] || '')] || map[next] || '');
      const firstConsonant = romajiNext[0] || '';
      if(firstConsonant) out += firstConsonant;
      continue;
    }
    if(map[a]){ out += map[a]; continue; }
    // preserve ASCII letters/numbers and spaces
    if(a.match(/[A-Za-z0-9\s]/)) { out += a; continue; }
    // unknown character (likely Kanji) - skip
  }
  // clean up hyphen from long mark to duplicate vowel instead
  out = out.replace(/-/g, '');
  // normalize double n before vowel to n'
  out = out.replace(/nn([aeiou])/g, "n'$1");
  // collapse multiple spaces
  out = out.replace(/\s+/g,' ').trim();
  return out;
}

function writeMenuFile(categories, categoryOrder, menuItems) {
  // add ja_latn for categories where possible
  const overrideMap = {
    '朝食': 'Asagohan', // breakfast
    'スープ': 'Suupu',
    'サラダ': 'Sarada',
    'デザート': 'Dezāto',
    'ピザ': 'Piza',
    'パスタ': 'Pasuta'
  };
  Object.keys(categories).forEach(k => {
    const c = categories[k];
    if(!c) return;
    const candidate = c.ja || '';
    // If an explicit override exists for the Japanese string, always use it
    if(overrideMap[candidate]){
      c.ja_latn = overrideMap[candidate];
      return;
    }
    // If ja_latn is missing or looks like a fallback (equal to en or tr), try to compute a better one
    if(!c.ja_latn || c.ja_latn === c.en || c.ja_latn === c.tr){
      const rom = kanaToRomaji(candidate);
      if(rom && /[a-zA-Z]/.test(rom)){
        c.ja_latn = rom;
      } else {
        // if candidate contains Kanji and we have a known mapping for the kanji string, use it
        if(overrideMap[candidate]){
          c.ja_latn = overrideMap[candidate];
        } else {
          c.ja_latn = c.en || c.tr || '';
        }
      }
    }
  });

  const header = `// Auto-generated from source-data/${path.basename(excelPath)}\n// Update the Excel file, then run npm run generate-menu before publishing.\n`;
  const catsText = 'const CATEGORIES = ' + JSON.stringify(categories, null, 2) + ';\n';
  const orderText = 'const CATEGORY_ORDER = ' + JSON.stringify(categoryOrder, null, 2) + ';\n';

  // format menu items similar to existing file (with object literals)
  const itemsText = 'const MENU_ITEMS = [\n' + menuItems.map(it => {
    const id = it.id;
    const category = it.category;
    const nameTr = it.name && it.name.tr ? it.name.tr : '';
    const nameEn = it.name && it.name.en ? it.name.en : '';
    const nameJa = it.name && it.name.ja ? it.name.ja : '';
    const nameJaLat = it.name && it.name.ja_latn ? it.name.ja_latn : '';
    const price = (it.price === null || it.price === undefined) ? null : Number(it.price);
    const photo = it.photo || '';
    const ingredients = it.ingredients || '';
    const nameFields = `tr: ${JSON.stringify(nameTr)}, en: ${JSON.stringify(nameEn)}, ja: ${JSON.stringify(nameJa)}` + (nameJaLat ? `, ja_latn: ${JSON.stringify(nameJaLat)}` : '');
    return `  { id: ${id}, category: '${category}', name: { ${nameFields} }, price: ${price}, photo: ${JSON.stringify(photo)}, ingredients: ${JSON.stringify(ingredients)} }`;
  }).join(',\n') + '\n];\n';

  const out = header + catsText + orderText + itemsText;
  fs.writeFileSync(menuJsPath, out, 'utf8');
  console.log('Wrote', menuJsPath);
}

function main() {
  if (!excelPath || !fs.existsSync(excelPath)) {
    console.error('No .xlsx file found in', sourceDir);
    process.exit(1);
  }
  console.log('Reading menu from', path.basename(excelPath));
  const existing = readExistingMenuData();
  if (!existing || !existing.categories || !existing.categoryOrder) {
    console.error('Could not read existing categories or category order from menu-data.js. Aborting to avoid losing structure.');
    process.exit(1);
  }

  const wb = XLSX.readFile(excelPath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) {
    console.error('No rows found in Excel sheet', sheetName);
    process.exit(1);
  }

  let menuItems = buildMenuItems(rows, { categories: existing.categories, categoryOrder: existing.categoryOrder, menuItems: existing.menuItems });

  // A product may appear in several categories in the spreadsheet (e.g. "Sosis Tava" under both
  // Ara Sıcaklar and Kahvaltılar) — it is kept once PER CATEGORY. Only an exact repeat inside the
  // same category is dropped (first occurrence wins).
  function normalizeName(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
  const seen = new Set();
  const deduped = [];
  for(const it of menuItems){
    const photoKey = it.photo ? String(it.photo).trim().toLowerCase() : '';
    const nameKey = [normalizeName(it.name && it.name.tr), normalizeName(it.name && it.name.en), normalizeName(it.name && it.name.ja)].join('|');
    const key = it.category + '::' + (photoKey || nameKey || ('id:' + it.id));
    if(seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }
  menuItems = deduped;

  // Ids must be unique (the page opens the popup by id). If two rows ended up with the same id,
  // the later one gets a fresh number.
  const usedIds = new Set();
  let nextId = 0;
  menuItems.forEach(it => { nextId = Math.max(nextId, Number(it.id) || 0); });
  menuItems.forEach(it => {
    let id = Number(it.id);
    if (!id || usedIds.has(id)) id = ++nextId;
    usedIds.add(id);
    it.id = id;
  });

  writeMenuFile(existing.categories, existing.categoryOrder, menuItems);
}

main();
