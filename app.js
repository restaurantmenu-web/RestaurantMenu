const text = {
  tr: {
    all: 'Tümü',
    categories: 'Kategoriler',
    home: 'Ana Sayfaya Dön',
    empty: 'Bu kategoride ürün bulunamadı.',
    ingredients: 'İçindekiler',
    feedback: 'Geri Bildirim',
    categoryCount: count => `${count} ürün`,
  },
  en: {
    all: 'All',
    categories: 'Categories',
    home: 'Back to Home',
    empty: 'No menu item in this category.',
    ingredients: 'Ingredients',
    feedback: 'Feedback',
    categoryCount: count => `${count} items`,
  },
  ja: {
    all: 'すべて',
    categories: 'カテゴリー',
    home: 'ホームに戻る',
    empty: 'このカテゴリーにメニューはありません。',
    ingredients: '材料',
    feedback: 'ご意見',
    categoryCount: count => `${count} 品`,
  },
  'ja-latn': {
    all: 'Subete',
    categories: 'Kategorii',
    home: 'Hōmu ni Modoru',
    empty: 'Kono kategorii ni menyuu wa arimasen.',
    ingredients: 'Zairyō',
    feedback: 'Goiken',
    categoryCount: count => `${count} hin`,
  },
};

// Geri bildirim butonunun açacağı MS Forms linki. Link hazır olunca tırnakların arasına yapıştır.
// Boş bırakılırsa buton görünür ama tıklanınca bir şey olmaz.
const FEEDBACK_FORM_URL = '';

const LANG_LABELS = { tr: 'TR', en: 'EN', ja: 'JA', 'ja-latn': 'JA-L' };
const PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const CATEGORY_EXTS = ['png', 'jpg', 'jpeg', 'webp'];
const CATEGORY_ALL_PHOTO = 'Tümü';
const CATEGORY_IMAGE = 'photos/default.png';

function loadData() {
  return { CATEGORIES, MENU_ITEMS, CATEGORY_ORDER };
}

const DATA = loadData();
let lang = 'tr';
let active = 'all';
let view = 'card';
let page = 'categories';

const $ = selector => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function formatPrice(price) {
  return Number(price || 0).toFixed(2).replace('.', ',') + ' TL';
}

function kanaToRomaji(input) {
  if (!input) return '';
  const map = { 'ア':'a','イ':'i','ウ':'u','エ':'e','オ':'o','カ':'ka','キ':'ki','ク':'ku','ケ':'ke','コ':'ko','サ':'sa','シ':'shi','ス':'su','セ':'se','ソ':'so','タ':'ta','チ':'chi','ツ':'tsu','テ':'te','ト':'to','ナ':'na','ニ':'ni','ヌ':'nu','ネ':'ne','ノ':'no','ハ':'ha','ヒ':'hi','フ':'fu','ヘ':'he','ホ':'ho','マ':'ma','ミ':'mi','ム':'mu','メ':'me','モ':'mo','ヤ':'ya','ユ':'yu','ヨ':'yo','ラ':'ra','リ':'ri','ル':'ru','レ':'re','ロ':'ro','ワ':'wa','ヲ':'wo','ン':'n','ガ':'ga','ギ':'gi','グ':'gu','ゲ':'ge','ゴ':'go','ザ':'za','ジ':'ji','ズ':'zu','ゼ':'ze','ゾ':'zo','ダ':'da','ヂ':'ji','ヅ':'zu','デ':'de','ド':'do','バ':'ba','ビ':'bi','ブ':'bu','ベ':'be','ボ':'bo','パ':'pa','ピ':'pi','プ':'pu','ペ':'pe','ポ':'po','ァ':'a','ィ':'i','ゥ':'u','ェ':'e','ォ':'o','ャ':'ya','ュ':'yu','ョ':'yo','ッ':'','ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','ゃ':'ya','ゅ':'yu','ょ':'yo','っ':'','ー':'-' };
  const digraphs = { 'キャ':'kya','キュ':'kyu','キョ':'kyo','ギャ':'gya','ギュ':'gyu','ギョ':'gyo','シャ':'sha','シュ':'shu','ショ':'sho','ジャ':'ja','ジュ':'ju','ジョ':'jo','チャ':'cha','チュ':'chu','チョ':'cho','ニャ':'nya','ニュ':'nyu','ニョ':'nyo','ヒャ':'hya','ヒュ':'hyu','ヒョ':'hyo','ビャ':'bya','ビュ':'byu','ビョ':'byo','ピャ':'pya','ピュ':'pyu','ピョ':'pyo','ミャ':'mya','ミュ':'myu','ミョ':'myo','リャ':'rya','リュ':'ryu','リョ':'ryo' };
  let out = '';
  const source = String(input || '').trim();
  for (let i = 0; i < source.length; i++) {
    const pair = source[i] + (source[i + 1] || '');
    if (digraphs[pair]) {
      out += digraphs[pair];
      i++;
      continue;
    }
    if (source[i] === 'ー') {
      const vowel = out.match(/[aeiou]$/i);
      if (vowel) out += vowel[0];
      continue;
    }
    if (source[i] === 'ッ' || source[i] === 'っ') {
      const next = source[i + 1];
      const romajiNext = digraphs[next + (source[i + 2] || '')] || map[next] || '';
      if (romajiNext[0]) out += romajiNext[0];
      continue;
    }
    if (map[source[i]]) {
      out += map[source[i]];
      continue;
    }
    if (source[i].match(/[A-Za-z0-9\s]/)) out += source[i];
  }
  return out.replace(/-/g, '').replace(/nn([aeiou])/g, "n'$1").replace(/\s+/g, ' ').trim();
}

function nameFor(item, requested) {
  if (!item || !item.name) return '';
  if (requested === 'ja-latn') {
    if (item.name.ja_latn) return item.name.ja_latn;
    const ja = item.name.ja || '';
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(ja)) return kanaToRomaji(ja) || item.name.en || item.name.tr || '';
    return item.name.en || item.name.tr || '';
  }
  return item.name[requested] || item.name.ja || item.name.en || item.name.tr || '';
}

function categoryNameFor(catObj, requested) {
  if (!catObj) return '';
  if (requested === 'ja-latn') {
    if (catObj.ja_latn) return catObj.ja_latn;
    const ja = catObj.ja || '';
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(ja)) return kanaToRomaji(ja) || catObj.en || catObj.tr || '';
    return catObj.en || catObj.tr || '';
  }
  return catObj[requested] || catObj.en || catObj.tr || '';
}

function normalizePhotoKey(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPhotoCandidates(item) {
  const names = [];
  const add = value => {
    if (!value) return;
    const raw = String(value).trim();
    if (!raw) return;
    names.push(raw.replace(/\.(jpe?g|png|webp)$/i, ''));
    names.push(normalizePhotoKey(raw).replace(/\s+/g, ' '));
    names.push(normalizePhotoKey(raw).replace(/\s+/g, '_'));
    names.push(raw.toLowerCase());
    names.push(raw.toLowerCase().replace(/\s+/g, '_'));
  };
  add(item && item.photo);
  const n = item && item.name ? item.name : {};
  add(n.tr);
  add(n.en);
  add(n.ja);
  return [...new Set(names.filter(Boolean))];
}

function photoSrc(photoId) {
  const base = String(photoId || '').trim();
  if (!base) return 'photos/default.png';
  return `photos/${base.replace(/\.(jpe?g|png|webp)$/i, '')}.${PHOTO_EXTS[0]}`;
}

function handleImgError(img) {
  const attempt = Number.parseInt(img.dataset.attempt || '0', 10) + 1;
  img.dataset.attempt = attempt;
  if (attempt < PHOTO_EXTS.length) {
    img.src = `photos/${img.dataset.id.replace(/\.(jpe?g|png|webp)$/i, '')}.${PHOTO_EXTS[attempt]}`;
  } else {
    img.onerror = null;
    img.src = 'photos/default.png';
  }
}
window.handleImgError = handleImgError;

function photoImg(item, altText) {
  const photoId = item && item.photo ? item.photo : 'default';
  const candidates = buildPhotoCandidates(item).join('|');
  return `<img src="${escapeAttr(photoSrc(photoId))}" data-id="${escapeAttr(photoId)}" data-attempt="0" data-candidates="${escapeAttr(candidates)}" loading="lazy" alt="${escapeAttr(altText)}" onerror="handleImgError(this)">`;
}

function itemsForCategory(categoryKey) {
  if (categoryKey === 'all') return DATA.MENU_ITEMS;
  return DATA.MENU_ITEMS.filter(item => item.category === categoryKey);
}

function sortedItems(items) {
  const locale = lang === 'tr' ? 'tr-TR' : (lang === 'en' ? 'en-US' : 'ja-JP');
  return items.slice().sort((a, b) => nameFor(a, lang).localeCompare(nameFor(b, lang), locale));
}

function setHash(nextPage, categoryKey = active) {
  const next = nextPage === 'menu' ? `#menu/${categoryKey}` : '#categories';
  if (window.location.hash !== next) window.location.hash = next;
}

function applyHash() {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('menu/')) {
    const key = hash.split('/')[1] || 'all';
    active = key === 'all' || DATA.CATEGORY_ORDER.includes(key) ? key : 'all';
    page = 'menu';
  } else {
    page = 'categories';
  }
  render();
}

function renderCategoryPicker() {
  const picker = $('#categories');
  picker.hidden = page !== 'menu';
  if (picker.hidden) return;

  $('#categoryHome').textContent = text[lang].home;
  $('#categorySelectLabel').textContent = text[lang].categories;
  $('#categorySelect').innerHTML =
    `<option value="all">${escapeHtml(text[lang].all)}</option>` +
    DATA.CATEGORY_ORDER.map(key => `<option value="${escapeAttr(key)}">${escapeHtml(categoryNameFor(DATA.CATEGORIES[key], lang))}</option>`).join('');
  $('#categorySelect').value = active;
}

function categoryPhotoName(key) {
  if (key === 'all') return CATEGORY_ALL_PHOTO;
  const cat = DATA.CATEGORIES[key];
  return (cat && cat.tr) ? cat.tr : key;
}

function handleCategoryImgError(img) {
  const attempt = Number.parseInt(img.dataset.attempt || '0', 10) + 1;
  img.dataset.attempt = attempt;
  if (attempt < CATEGORY_EXTS.length) {
    img.src = `photos/${img.dataset.id}.${CATEGORY_EXTS[attempt]}`;
  } else {
    img.onerror = null;
    img.src = CATEGORY_IMAGE;
  }
}
window.handleCategoryImgError = handleCategoryImgError;

function categoryImg(key) {
  const base = String(categoryPhotoName(key)).replace(/\.(jpe?g|png|webp)$/i, '');
  return `<img src="${escapeAttr(`photos/${base}.${CATEGORY_EXTS[0]}`)}" data-id="${escapeAttr(base)}" data-attempt="0" loading="lazy" alt="" onerror="handleCategoryImgError(this)">`;
}

function categoryTileHtml(key) {
  const isAll = key === 'all';
  const name = isAll ? text[lang].all : categoryNameFor(DATA.CATEGORIES[key], lang);
  const count = isAll ? DATA.MENU_ITEMS.length : itemsForCategory(key).length;
  return `<button type="button" class="category-tile" data-category-key="${escapeAttr(key)}">
    ${categoryImg(key)}
    <div>
      <h3>${escapeHtml(name)}</h3>
      <span>${escapeHtml(text[lang].categoryCount(count))}</span>
    </div>
  </button>`;
}

function renderCategoryLanding() {
  const wrap = $('#menuSections');
  const keys = ['all', ...DATA.CATEGORY_ORDER];
  wrap.innerHTML = `<section class="category-landing">
    <div class="section-header"><h2>${escapeHtml(text[lang].categories)}</h2><span>${DATA.CATEGORY_ORDER.length}</span></div>
    <div class="category-items ${view === 'list' ? 'category-list' : 'category-grid'}">
      ${keys.map(categoryTileHtml).join('')}
    </div>
  </section>`;
  wrap.querySelectorAll('[data-category-key]').forEach(button => {
    button.addEventListener('click', () => {
      active = button.dataset.categoryKey;
      page = 'menu';
      setHash('menu', active);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  $('#empty').hidden = true;
}

function itemCardHtml(item) {
  const name = nameFor(item, lang);
  const cat = categoryNameFor(DATA.CATEGORIES[item.category], lang);
  return `<button type="button" class="item" data-item-id="${escapeAttr(item.id)}">
    ${photoImg(item, name)}
    <div class="item-body">
      <div class="category-label">${escapeHtml(cat)}</div>
      <h3>${escapeHtml(name)}</h3>
      <span class="price">${escapeHtml(formatPrice(item.price))}</span>
    </div>
  </button>`;
}

function itemListHtml(item) {
  const name = nameFor(item, lang);
  const cat = categoryNameFor(DATA.CATEGORIES[item.category], lang);
  return `<button type="button" class="item" data-item-id="${escapeAttr(item.id)}">
    ${photoImg(item, name)}
    <div>
      <div class="category-label">${escapeHtml(cat)}</div>
      <h3>${escapeHtml(name)}</h3>
    </div>
    <span class="price">${escapeHtml(formatPrice(item.price))}</span>
  </button>`;
}

function renderSections() {
  const catsToShow = active === 'all' ? DATA.CATEGORY_ORDER : [active];
  const wrap = $('#menuSections');
  let html = '';
  let totalCount = 0;

  catsToShow.forEach(catKey => {
    const items = sortedItems(DATA.MENU_ITEMS.filter(item => item.category === catKey));
    if (!items.length) return;
    totalCount += items.length;
    html += `<section class="section">
      <div class="section-header"><h2>${escapeHtml(categoryNameFor(DATA.CATEGORIES[catKey], lang))}</h2><span>${items.length}</span></div>
      <div class="items ${view === 'list' ? 'list-view' : 'card-view'}">${items.map(view === 'list' ? itemListHtml : itemCardHtml).join('')}</div>
    </section>`;
  });

  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-item-id]').forEach(el => {
    el.addEventListener('click', () => openModal(Number.parseInt(el.dataset.itemId, 10)));
  });
  $('#empty').hidden = totalCount > 0;
  $('#empty').textContent = text[lang].empty;
}

function updateBackToTop() {
  $('#backToTop').hidden = !(page === 'menu' && active === 'all');
}

function setView(nextView) {
  view = nextView;
  $('#listViewBtn').classList.toggle('active', nextView === 'list');
  $('#listViewBtn').setAttribute('aria-pressed', nextView === 'list');
  $('#cardViewBtn').classList.toggle('active', nextView === 'card');
  $('#cardViewBtn').setAttribute('aria-pressed', nextView === 'card');
  render();
}

function openModal(id) {
  const item = DATA.MENU_ITEMS.find(menuItem => Number(menuItem.id) === id);
  if (!item) return;
  const img = $('#modalImg');
  img.src = photoSrc(item.photo);
  img.dataset.id = item.photo || 'default';
  img.dataset.attempt = '0';
  img.onerror = () => handleImgError(img);
  img.alt = nameFor(item, lang);
  $('#modalCategory').textContent = categoryNameFor(DATA.CATEGORIES[item.category], lang);
  $('#modalName').textContent = nameFor(item, lang);
  $('#modalPrice').textContent = formatPrice(item.price);

  // Other-language names only (no heading), one per line, skipping repeats.
  const shown = new Set([nameFor(item, lang)]);
  const otherNames = Object.keys(LANG_LABELS)
    .filter(language => language !== lang)
    .map(language => nameFor(item, language))
    .filter(name => name && !shown.has(name) && shown.add(name));
  $('#modalAltLangs').innerHTML = otherNames.map(name => escapeHtml(name)).join('<br>');
  $('#modalAltLangs').hidden = otherNames.length === 0;

  // Always shown: "İçindekiler:" in bold, then the text from the spreadsheet (empty until filled).
  const ingredients = String(item.ingredients || '').trim();
  $('#modalIngredients').innerHTML = `<b>${escapeHtml(text[lang].ingredients)}:</b> ${escapeHtml(ingredients)}`;

  $('#modalOverlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('#modalOverlay').hidden = true;
  document.body.style.overflow = '';
}

function render() {
  document.documentElement.lang = lang;
  $('#title').textContent = 'Restaurant';
  $('#notice').textContent = '';
  $('#feedbackLabel').textContent = text[lang].feedback;
  $('#feedbackBtn').title = text[lang].feedback;
  $('#feedbackBtn').setAttribute('aria-label', text[lang].feedback);
  $('#menuSections').hidden = false;
  $('footer').hidden = false;
  $('#empty').hidden = page !== 'menu';
  renderCategoryPicker();

  if (page === 'categories') renderCategoryLanding();
  if (page === 'menu') renderSections();

  updateBackToTop();
}

$('#language').onchange = event => {
  lang = event.target.value;
  render();
};
$('#listViewBtn').onclick = () => setView('list');
$('#cardViewBtn').onclick = () => setView('card');
$('#categoryHome').onclick = () => setHash('categories');
$('#categorySelect').onchange = event => {
  active = event.target.value;
  setHash('menu', active);
  render();
};
$('#backToTop').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
$('#feedbackBtn').onclick = () => {
  if (!FEEDBACK_FORM_URL) return;
  window.open(FEEDBACK_FORM_URL, '_blank', 'noopener');
};
$('#modalClose').onclick = closeModal;
$('#modalOverlay').addEventListener('click', event => {
  if (event.target.id === 'modalOverlay') closeModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
});
window.addEventListener('hashchange', applyHash);

if (!window.location.hash) {
  window.location.hash = '#categories';
} else {
  applyHash();
}
