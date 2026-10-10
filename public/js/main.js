/* =====================================================
   بيبي مون — main.js (SPA Router + Slider + Sections)
   ===================================================== */

const API = '';

// ============ STATE ============
window.productsMap = window.productsMap || new Map();
let cart = [];
try {
    const rawCart = localStorage.getItem('babymoon_cart');
    if (rawCart) {
        const parsed = JSON.parse(rawCart);
        if (Array.isArray(parsed)) cart = parsed;
    }
} catch (e) {
    console.warn('Failed to parse cart from localStorage:', e);
    cart = [];
}
let allCategories = [];
let allBanners = [];
let sliderIndex = 0;
let sliderTimer = null;
let pressTimer = null;
let pressStart = null;

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
    setupLongPress();
    await loadCategories();
    await loadBanners();
    buildCatTabs();
    initRouter();
    updateCartUI();
});

window.addEventListener('hashchange', () => initRouter());

// ============ ROUTER ============
function initRouter() {
    const hash = location.hash || '#/';
    const appMain = document.getElementById('appMain');

    if (hash === '#/' || hash === '') {
        renderHome();
    } else if (hash === '#/new') {
        renderFilterPage('new', '✨ ملابس جديدة', 'is_new');
    } else if (hash === '#/offers') {
        renderFilterPage('offers', '🏷️ عروض وتخفيضات', 'is_offer');
    } else if (hash === '#/lowstock') {
        renderFilterPage('lowstock', '⚡ قد تنفد قريباً', 'is_low_stock');
    } else if (hash.startsWith('#/category/')) {
        const catName = decodeURIComponent(hash.replace('#/category/', ''));
        renderCategoryPage(catName);
    } else if (hash.startsWith('#/search?')) {
        const q = new URLSearchParams(hash.split('?')[1]).get('q') || '';
        renderSearchPage(q);
    } else {
        renderHome();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigate(hash) {
    location.hash = hash;
}

// ============ LOAD DATA ============
async function loadCategories() {
    try {
        allCategories = await apiFetch('/api/categories');
    } catch (e) { console.error('Categories error:', e); }
}

async function loadBanners() {
    try {
        allBanners = await apiFetch('/api/banners');
        renderSlider();
    } catch (e) { console.error('Banners error:', e); renderDefaultSlider(); }
}

// ============ BANNER SLIDER ============
function renderSlider() {
    if (!allBanners.length) { renderDefaultSlider(); return; }

    const track = document.getElementById('sliderTrack');
    const dots = document.getElementById('sliderDots');

    track.innerHTML = allBanners.map((b, i) => `
        <div class="slide" onclick="handleBannerClick('${b.link_type}','${b.link_value || ''}')">
            ${b.image
            ? `<img src="${b.image}" alt="${b.title}" class="slide-img" />`
            : `<div class="slide-placeholder slide-color-${(i % 5) + 1}"></div>`}
            <div class="slide-overlay">
                <div class="slide-content">
                    <h2 class="slide-title">${b.title}</h2>
                    ${b.description ? `<p class="slide-desc">${b.description}</p>` : ''}
                    <span class="slide-cta">اكتشف الآن ←</span>
                </div>
            </div>
        </div>
    `).join('');

    dots.innerHTML = allBanners.map((_, i) =>
        `<button class="slider-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></button>`
    ).join('');

    startSliderAuto();
    initSliderTouch();
}

function renderDefaultSlider() {
    allBanners = [
        { id: 1, title: 'عروض وتخفيضات', description: 'خصومات تصل حتى 50% 🏷️', link_type: 'offers', link_value: '' },
        { id: 2, title: 'قد تنفد قريباً', description: 'اشتري قبل ما تنتهي ⚡', link_type: 'lowstock', link_value: '' },
        { id: 3, title: 'ملابس جديدة', description: 'أحدث التصاميم ✨', link_type: 'new', link_value: '' },
    ];
    renderSlider();
}

function handleBannerClick(type, value) {
    if (type === 'new') navigate('#/new');
    else if (type === 'offers') navigate('#/offers');
    else if (type === 'lowstock') navigate('#/lowstock');
    else if (type === 'category' && value) navigate(`#/category/${encodeURIComponent(value)}`);
    else navigate('#/');
}

function goToSlide(i) {
    sliderIndex = i;
    updateSlider();
    resetSliderAuto();
}

function slidePrev() {
    sliderIndex = (sliderIndex - 1 + allBanners.length) % allBanners.length;
    updateSlider();
    resetSliderAuto();
}

function slideNext() {
    sliderIndex = (sliderIndex + 1) % allBanners.length;
    updateSlider();
    resetSliderAuto();
}

function updateSlider() {
    const track = document.getElementById('sliderTrack');
    if (!track) return;
    // Move track to the active slide (LTR track requires negative offset)
    track.style.transform = `translateX(-${sliderIndex * 100}%)`;
    document.querySelectorAll('.slider-dot').forEach((d, i) => {
        d.classList.toggle('active', i === sliderIndex);
    });
}

function startSliderAuto() {
    clearInterval(sliderTimer);
    if (allBanners.length > 1) {
        sliderTimer = setInterval(() => {
            sliderIndex = (sliderIndex + 1) % allBanners.length;
            updateSlider();
        }, 5000);
    }
}

function resetSliderAuto() {
    clearInterval(sliderTimer);
    startSliderAuto();
}

function initSliderTouch() {
    const track = document.getElementById('sliderTrack');
    if (!track) return;
    let startX = 0;
    track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) slideNext(); else slidePrev();
        }
    });
}

// ============ CATEGORY TABS ============
function buildCatTabs() {
    const row = document.getElementById('catTabsRow');
    if (!row) return;

    // The 4 requested categories
    const targetCats = [
        { name: 'clothes', label: 'ملابس', icon: '👕' },
        { name: 'stationery', label: 'قرطاسية', icon: '✏️' },
        { name: 'toys', label: 'ألعاب', icon: '🧸' },
        { name: 'accessories', label: 'إكسسوارات', icon: '🎀' }
    ];

    const catsToRender = targetCats.map(tc => {
        const found = allCategories.find(c => c.name === tc.name);
        return found ? { ...tc, ...found } : tc;
    });

    let html = '';
    catsToRender.forEach(cat => {
        html += `<button class="cat-tab" id="tab-${cat.name}" onclick="navigate('#/category/${encodeURIComponent(cat.name)}')"><span>${cat.icon}</span> <span>${cat.label}</span></button>`;
    });
    row.innerHTML = html;
}

function updateActiveCatTab(hash) {
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    if (hash && hash.startsWith('#/category/')) {
        const name = decodeURIComponent(hash.replace('#/category/', ''));
        document.getElementById(`tab-${name}`)?.classList.add('active');
    }
}

// ============ HOME PAGE ============
async function renderHome() {
    updateActiveCatTab('#/');
    const main = document.getElementById('appMain');
    main.innerHTML = '<div class="loading-spinner">⏳</div>';

    try {
        const products = await apiFetch('/api/products');
        let html = '';

        // Order preference: 1. ملابس, 2. إكسسوارات, 3. ألعاب, 4. قرطاسية
        const orderKeys = ['clothes', 'accessories', 'toys', 'stationery'];
        const iconMap = { 'clothes': '👕', 'accessories': '🎀', 'toys': '🧸', 'stationery': '✏️' };
        const labelMap = { 'clothes': 'ملابس', 'accessories': 'إكسسوارات', 'toys': 'ألعاب', 'stationery': 'قرطاسية' };

        for (const catKey of orderKeys) {
            const catObj = allCategories.find(c => c.name === catKey) || { name: catKey, label: labelMap[catKey] };
            const catProducts = products.filter(p => p.category === catKey || (catObj.id && p.category_id === catObj.id));

            if (!catProducts.length) continue;

            const icon = iconMap[catKey] || '🛍️';
            // Show products (2 visible on screen, user swipes horizontally to see more)
            const preview = catProducts.slice(0, 10);

            html += `
            <section class="home-section" id="section-${catKey}">
                <div class="home-section-header">
                    <h2 class="home-section-title">${icon} ${catObj.label}</h2>
                    <button class="more-btn" onclick="navigate('#/category/${encodeURIComponent(catKey)}')">المزيد ←</button>
                </div>
                <div class="carousel-wrapper">
                    <div class="carousel-track cat-carousel" id="cat-${catKey}">
                        ${preview.map(renderProductCard).join('')}
                    </div>
                </div>
            </section>`;
        }

        if (!html) {
            html = `<div class="empty-state"><div class="empty-icon">🧺</div><p>لا توجد منتجات حالياً</p></div>`;
        }

        main.innerHTML = html;
        initCarousels();
    } catch (e) {
        console.error('Home render error:', e);
        main.innerHTML = `<div class="empty-state"><p>حدث خطأ في التحميل</p></div>`;
    }
}

// ============ FILTER PAGE (new / offers / lowstock) ============
async function renderFilterPage(type, title, field) {
    updateActiveCatTab('#/' + type);
    const main = document.getElementById('appMain');
    main.innerHTML = '<div class="loading-spinner">⏳</div>';

    try {
        const products = await apiFetch(`/api/products?${field}=true`);

        let html = `
        <div class="page-header">
            <button class="back-btn" onclick="navigate('#/')">← رجوع</button>
            <h1 class="page-title">${title}</h1>
        </div>`;

        // Category filter buttons
        const catsInPage = [...new Set(products.map(p => p.category))];
        if (catsInPage.length > 1) {
            html += `<div class="filter-tabs" id="filterTabs">
                <button class="filter-tab active" onclick="filterProducts(null, '${field}')">الكل</button>
                ${allCategories.filter(c => catsInPage.includes(c.name)).map(c =>
                `<button class="filter-tab" onclick="filterProducts('${c.name}', '${field}')">${c.label}</button>`
            ).join('')}
            </div>`;
        }

        html += `<div class="products-grid-full" id="filterGrid">
            ${products.length ? products.map(renderProductCard).join('') : '<div class="empty-state"><div class="empty-icon">🧺</div><p>لا توجد منتجات</p></div>'}
        </div>`;

        main.innerHTML = html;
    } catch (e) {
        main.innerHTML = `<div class="empty-state"><p>حدث خطأ في التحميل</p></div>`;
    }
}

async function filterProducts(catName, field) {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    let url = `/api/products?${field}=true`;
    if (catName) url += `&category=${catName}`;

    const grid = document.getElementById('filterGrid');
    grid.innerHTML = '<div class="loading-spinner">⏳</div>';
    try {
        const products = await apiFetch(url);
        grid.innerHTML = products.length
            ? products.map(renderProductCard).join('')
            : '<div class="empty-state"><div class="empty-icon">🧺</div><p>لا توجد منتجات</p></div>';
    } catch (e) { grid.innerHTML = ''; }
}

// ============ CATEGORY PAGE ============
let currentCatProducts = [];
let currentSubcategories = [];
let selectedSubId = 'all';
let selectedItemTypeId = 'all';

async function renderCategoryPage(catName) {
    updateActiveCatTab(`#/category/${catName}`);
    const cat = allCategories.find(c => c.name === catName) || {
        name: catName,
        label: catName === 'clothes' ? 'ملابس' : catName === 'accessories' ? 'إكسسوارات' : catName === 'toys' ? 'ألعاب' : 'قرطاسية'
    };
    const iconMap = { 'clothes': '👕', 'accessories': '🎀', 'toys': '🧸', 'stationery': '✏️' };
    const icon = cat.icon || iconMap[catName] || '🛍️';
    const title = `${icon} ${cat.label}`;
    const main = document.getElementById('appMain');
    main.innerHTML = '<div class="loading-spinner">⏳</div>';

    try {
        currentCatProducts = await apiFetch(`/api/products?category=${catName}`);
        currentSubcategories = await apiFetch(`/api/categories/${catName}/subcategories`).catch(() => []);

        // Shuffle products randomly on opening the category page as requested
        currentCatProducts.sort(() => Math.random() - 0.5);

        selectedSubId = 'all';
        selectedItemTypeId = 'all';

        let html = `
        <div class="page-header">
            <button class="back-btn" onclick="navigate('#/')">← الرئيسية</button>
            <h1 class="page-title">${title}</h1>
        </div>`;

        if (currentSubcategories.length) {
            html += `
            <div class="gender-tabs" id="subTabs">
                <button class="gender-tab active" onclick="setCategorySubcategory('all')">الكل</button>
                ${currentSubcategories.map(s =>
                    `<button class="gender-tab" onclick="setCategorySubcategory('${s.id}')">${s.label}</button>`
                ).join('')}
            </div>
            <div class="subtype-tabs" id="subtypeTabs" style="display:none;"></div>`;
        }

        html += `
        <div class="products-grid-full" id="catGrid">
            ${currentCatProducts.length
                ? currentCatProducts.map(renderProductCard).join('')
                : '<div class="empty-state"><div class="empty-icon">🧺</div><p>لا توجد منتجات في هذا القسم حالياً</p></div>'}
        </div>`;

        main.innerHTML = html;
    } catch (e) {
        console.error('Category render error:', e);
        main.innerHTML = `<div class="empty-state"><p>حدث خطأ أثناء تحميل القسم</p></div>`;
    }
}

function setCategorySubcategory(subId) {
    selectedSubId = subId;
    selectedItemTypeId = 'all';

    document.querySelectorAll('#subTabs .gender-tab').forEach(b => b.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');

    const subtypeBar = document.getElementById('subtypeTabs');
    if (!subtypeBar) {
        renderFilteredCategoryProducts();
        return;
    }

    if (subId === 'all') {
        subtypeBar.style.display = 'none';
        subtypeBar.innerHTML = '';
        renderFilteredCategoryProducts();
        return;
    }

    const sub = currentSubcategories.find(s => String(s.id) === String(subId) || s.name === subId);
    if (sub?.item_types && sub.item_types.length) {
        subtypeBar.style.display = 'flex';
        subtypeBar.innerHTML = `
            <button class="subtype-tab active" onclick="setCategoryItemType('all')">الكل</button>
            ${sub.item_types.map(it =>
                `<button class="subtype-tab" onclick="setCategoryItemType('${it.id}')">${it.label}</button>`
            ).join('')}
        `;
    } else {
        subtypeBar.style.display = 'none';
        subtypeBar.innerHTML = '';
    }

    renderFilteredCategoryProducts();
}

function setCategoryItemType(itId) {
    selectedItemTypeId = itId;
    document.querySelectorAll('#subtypeTabs .subtype-tab').forEach(b => b.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    renderFilteredCategoryProducts();
}

function renderFilteredCategoryProducts() {
    let filtered = [...currentCatProducts];

    if (selectedSubId !== 'all') {
        const sub = currentSubcategories.find(s => String(s.id) === String(selectedSubId) || s.name === selectedSubId);
        filtered = filtered.filter(p => {
            if (!sub) return true;
            return String(p.subcategory_id) === String(sub.id) || p.subcategory === sub.name;
        });
    }

    if (selectedItemTypeId !== 'all') {
        filtered = filtered.filter(p => {
            return String(p.item_type_id) === String(selectedItemTypeId) || p.item_type === selectedItemTypeId;
        });
    }

    const grid = document.getElementById('catGrid');
    if (grid) {
        grid.innerHTML = filtered.length
            ? filtered.map(renderProductCard).join('')
            : '<div class="empty-state"><div class="empty-icon">🧺</div><p>لا توجد منتجات مطابقة لهذا الاختيار</p></div>';
    }
}

// ============ SEARCH ============
function toggleSearch() {
    const overlay = document.getElementById('searchOverlay');
    const isOpen = overlay.classList.contains('open');
    overlay.classList.toggle('open', !isOpen);
    if (!isOpen) {
        const inp = document.getElementById('searchInput');
        inp.value = '';
        inp.focus();
        document.getElementById('searchResultsOverlay').innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('searchInput');
    let t;
    inp?.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => runSearch(inp.value.trim()), 350);
    });
    inp?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && inp.value.trim()) {
            toggleSearch();
            renderSearchPageFromQuery(inp.value.trim());
        }
    });
});

async function runSearch(q) {
    if (!q) { document.getElementById('searchResultsOverlay').innerHTML = ''; return; }
    try {
        const products = await apiFetch(`/api/products?search=${encodeURIComponent(q)}`);
        const container = document.getElementById('searchResultsOverlay');
        if (!products.length) { container.innerHTML = '<p class="search-no-result">لا نتائج</p>'; return; }
        container.innerHTML = `<div class="search-mini-grid">${products.slice(0, 6).map(renderProductCard).join('')}</div>`;
    } catch (e) { }
}

async function renderSearchPageFromQuery(q) {
    updateActiveCatTab('');
    const main = document.getElementById('appMain');
    main.innerHTML = '<div class="loading-spinner">⏳</div>';
    try {
        const products = await apiFetch(`/api/products?search=${encodeURIComponent(q)}`);
        main.innerHTML = `
            <div class="page-header">
                <button class="back-btn" onclick="navigate('#/')">← رجوع</button>
                <h1 class="page-title">🔎 "${q}"</h1>
            </div>
            <div class="products-grid-full">
                ${products.length ? products.map(renderProductCard).join('') : '<div class="empty-state"><div class="empty-icon">🧺</div><p>لا توجد نتائج</p></div>'}
            </div>`;
    } catch (e) { }
}

// ============ PRODUCT CARD ============
function renderProductCard(product) {
    const hasDiscount = product.is_offer && product.discount_percent > 0;
    const discountedPrice = hasDiscount
        ? Math.round(product.price * (1 - product.discount_percent / 100))
        : product.price;

    const catIconMap = { 'clothes': '👕', 'accessories': '🎀', 'toys': '🧸', 'stationery': '✏️' };
    const pIcon = catIconMap[product.category] || '🛍️';

    const imgTag = product.image
        ? `<img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div class="product-placeholder" style="display:none">${pIcon}</div>`
        : `<div class="product-placeholder">${pIcon}</div>`;

    const flags = [
        product.is_new ? `<span class="flag flag-new">✨ جديد</span>` : '',
        product.is_offer ? `<span class="flag flag-offer">🏷️ عرض</span>` : '',
        product.is_low_stock ? `<span class="flag flag-low">⚡ قد تنفد</span>` : '',
    ].filter(Boolean).join('');

    const priceHtml = hasDiscount
        ? `<span class="product-price">${discountedPrice.toLocaleString('ar-IQ')} د.ع</span>
           <span class="product-price-old">${product.price.toLocaleString('ar-IQ')}</span>
           <span class="discount-badge">-${product.discount_percent}%</span>`
        : `<span class="product-price">${product.price.toLocaleString('ar-IQ')} د.ع</span>`;

    const prodId = product.id !== undefined && product.id !== null ? product.id : (product._id || '');

    // Cache product in memory map
    if (window.productsMap && prodId) {
        window.productsMap.set(String(prodId), product);
    }

    return `
    <div class="product-card" data-id="${prodId}">
      <div class="product-card-body" onclick="showProductDetails('${prodId}')">
        <div class="product-img-wrap">${imgTag}</div>
        <div class="product-flags">${flags}</div>
        <div class="product-info">
          <div class="product-name">${product.name}</div>
          <div class="product-category">${[product.category_label, product.subcategory_label, product.item_type_label].filter(Boolean).join(' · ')}</div>
          <div class="product-price-wrap">${priceHtml}</div>
        </div>
      </div>
      <div class="product-actions-card">
        <button type="button" class="add-cart-btn" onclick="handleAddToCartClick(event, '${prodId}')">
          🛒 أضف إلى السلة
        </button>
      </div>
    </div>`;
}

function handleAddToCartClick(event, prodId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const product = window.productsMap ? window.productsMap.get(String(prodId)) : null;
    if (product) {
        const hasDiscount = product.is_offer && product.discount_percent > 0;
        const discountedPrice = hasDiscount
            ? Math.round(product.price * (1 - product.discount_percent / 100))
            : product.price;
        addToCart(prodId, product.name, discountedPrice, product.image);
    } else {
        // Fallback: fetch product details if missing from cache
        apiFetch(`/api/products/${prodId}`).then(p => {
            if (p) {
                if (window.productsMap) window.productsMap.set(String(prodId), p);
                const hasDiscount = p.is_offer && p.discount_percent > 0;
                const discountedPrice = hasDiscount
                    ? Math.round(p.price * (1 - p.discount_percent / 100))
                    : p.price;
                addToCart(prodId, p.name, discountedPrice, p.image);
            }
        }).catch(e => console.error('Error fetching product for cart:', e));
    }
}

function escStr(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '\\"'); }

// ============ PRODUCT DETAILS ============
async function showProductDetails(id) {
    try {
        let product = window.productsMap ? window.productsMap.get(String(id)) : null;
        if (!product) {
            product = await apiFetch(`/api/products/${id}`);
            if (product && window.productsMap) window.productsMap.set(String(id), product);
        }
        if (!product) return;

        const hasDiscount = product.is_offer && product.discount_percent > 0;
        const discountedPrice = hasDiscount
            ? Math.round(product.price * (1 - product.discount_percent / 100))
            : product.price;

        const prodId = product.id !== undefined && product.id !== null ? product.id : (product._id || id);

        document.getElementById('detailImg').src = product.image || '';
        document.getElementById('detailImg').style.display = product.image ? 'block' : 'none';

        const badge = document.getElementById('detailBadge');
        if (product.is_new) { badge.textContent = '✨ جديد'; badge.style.display = 'block'; }
        else if (product.is_offer) { badge.textContent = '🏷️ عرض'; badge.style.display = 'block'; }
        else if (product.is_low_stock) { badge.textContent = '⚡ قد ينفد'; badge.style.display = 'block'; }
        else { badge.style.display = 'none'; }

        document.getElementById('detailName').textContent = product.name;
        document.getElementById('detailCategory').textContent = [product.category_label, product.subcategory_label, product.item_type_label].filter(Boolean).join(' · ');
        document.getElementById('detailDesc').textContent = product.description || 'لا يوجد وصف متاح لهذا المنتج.';

        if (hasDiscount) {
            document.getElementById('detailPriceOriginal').textContent = product.price.toLocaleString('ar-IQ') + ' د.ع';
            document.getElementById('detailPriceOriginal').style.display = 'block';
        } else {
            document.getElementById('detailPriceOriginal').style.display = 'none';
        }
        document.getElementById('detailPriceFinal').textContent = discountedPrice.toLocaleString('ar-IQ') + ' د.ع';
        
        const buyBtn = document.getElementById('detailBuyBtn');
        buyBtn.onclick = (e) => {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            addToCart(prodId, product.name, discountedPrice, product.image);
            closeProductDetails();
        };

        document.getElementById('productDetailView').classList.add('open');
        document.getElementById('productDetailOverlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    } catch (e) { console.error('showProductDetails error:', e); }
}

function closeProductDetails() {
    document.getElementById('productDetailView').classList.remove('open');
    document.getElementById('productDetailOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

// ============ CAROUSEL DRAG ============
function initCarousels() {
    document.querySelectorAll('.carousel-track').forEach(track => {
        if (track.dataset.carousel) return;
        track.dataset.carousel = '1';
        let isDown = false, startX, scrollLeft;
        track.addEventListener('mousedown', e => {
            isDown = true; track.classList.add('dragging');
            startX = e.pageX - track.offsetLeft; scrollLeft = track.scrollLeft;
        });
        track.addEventListener('mouseleave', () => { isDown = false; track.classList.remove('dragging'); });
        track.addEventListener('mouseup', () => { isDown = false; track.classList.remove('dragging'); });
        track.addEventListener('mousemove', e => {
            if (!isDown) return; e.preventDefault();
            track.scrollLeft = scrollLeft - (e.pageX - track.offsetLeft - startX) * 1.5;
        });
    });
}

// ============ CART ============
function openCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('open')) {
        closeCart();
    } else {
        openCart();
    }
}

function addToCart(id, name, price, image) {
    if (!Array.isArray(cart)) cart = [];

    const safeId = id !== undefined && id !== null ? id : Date.now();
    const safePrice = Number(price) || 0;
    const safeName = String(name || 'منتج');
    const safeImage = image || '';

    const existing = cart.find(i => String(i.id) === String(safeId));
    if (existing) {
        existing.qty = (Number(existing.qty) || 1) + 1;
    } else {
        cart.push({ id: safeId, name: safeName, price: safePrice, image: safeImage, qty: 1 });
    }

    saveCart();
    updateCartUI();
    showToast(`✅ تمت إضافة "${safeName}" إلى السلة`);

    // Animate cart button in header
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.classList.remove('bounce-btn');
        void cartBtn.offsetWidth; // trigger reflow
        cartBtn.classList.add('bounce-btn');
    }

    // Open cart drawer so user sees their product in the cart!
    openCart();
}

function removeFromCart(id) {
    if (!Array.isArray(cart)) cart = [];
    cart = cart.filter(i => String(i.id) !== String(id));
    saveCart();
    updateCartUI();
}

function changeQty(id, delta) {
    if (!Array.isArray(cart)) cart = [];
    const item = cart.find(i => String(i.id) === String(id));
    if (!item) return;
    item.qty = (Number(item.qty) || 1) + delta;
    if (item.qty <= 0) return removeFromCart(id);
    saveCart();
    updateCartUI();
}

function saveCart() {
    try {
        localStorage.setItem('babymoon_cart', JSON.stringify(cart));
    } catch (e) {
        console.error('Failed to save cart to localStorage:', e);
    }
}

function updateCartUI() {
    if (!Array.isArray(cart)) cart = [];
    const total = cart.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
    const count = cart.reduce((s, i) => s + (Number(i.qty) || 1), 0);

    const badgeEl = document.getElementById('cartBadge');
    if (badgeEl) badgeEl.textContent = count;

    const itemsEl = document.getElementById('cartItems');
    const emptyEl = document.getElementById('cartEmpty');
    const footerEl = document.getElementById('cartFooter');
    const buyBarEl = document.getElementById('cartBuyBar');
    const totalEl = document.getElementById('cartTotal');

    if (totalEl) totalEl.textContent = total.toLocaleString('ar-IQ') + ' دينار';

    if (!itemsEl) return;

    if (!cart.length) {
        itemsEl.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
        if (footerEl) footerEl.style.display = 'none';
        if (buyBarEl) buyBarEl.style.display = 'none';
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        if (footerEl) footerEl.style.display = 'block';
        if (buyBarEl) buyBarEl.style.display = 'block';
        itemsEl.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-img">
                    ${item.image ? `<img src="${item.image}" alt="${item.name || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.style.display='none';this.parentElement.textContent='👕'">` : '👕'}
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name || ''}</div>
                    <div class="cart-item-price">${((Number(item.price) || 0) * (Number(item.qty) || 1)).toLocaleString('ar-IQ')} د.ع</div>
                    <div class="cart-item-qty">
                        <button type="button" class="qty-btn" onclick="changeQty('${item.id}', -1)">−</button>
                        <span class="qty-num">${item.qty}</span>
                        <button type="button" class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
                    </div>
                </div>
                <button type="button" class="cart-item-remove" onclick="removeFromCart('${item.id}')" title="حذف">🗑️</button>
            </div>`).join('');
    }
}

// Global exports
window.openCart = openCart;
window.closeCart = closeCart;
window.toggleCart = toggleCart;
window.addToCart = addToCart;
window.handleAddToCartClick = handleAddToCartClick;
window.removeFromCart = removeFromCart;
window.changeQty = changeQty;

// ============ ORDER ============
async function placeOrder() {
    const name = document.getElementById('custName').value.trim();
    const address = document.getElementById('custAddress').value.trim();
    const phone = document.getElementById('custPhone').value.trim();

    if (!name) { showToast('⚠️ يرجى إدخال الاسم', true); return; }
    if (!phone) { showToast('⚠️ يرجى إدخال رقم الهاتف', true); return; }
    if (!cart.length) { showToast('⚠️ السلة فارغة', true); return; }

    const btn = document.querySelector('.checkout-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ جاري إرسال الطلب...';
    }

    try {
        const orderData = {
            customer_name: name,
            customer_address: address,
            customer_phone: phone,
            items: cart.map(i => ({ product_id: i.id, product_name: i.name, quantity: i.qty, unit_price: i.price })),
            total: cart.reduce((s, i) => s + i.price * i.qty, 0)
        };

        // 1) Save order to server database (so admin can view it in Orders page)
        let savedOrder = null;
        try {
            savedOrder = await apiFetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
        } catch (apiErr) {
            console.warn('Could not save order to server, proceeding to WhatsApp:', apiErr);
        }

        // 2) Generate WhatsApp message
        const managerPhone = '9647724650622';
        const orderIdStr = (savedOrder && savedOrder.id) ? ` #${savedOrder.id}` : '';
        const grandTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

        let message = `*طلب جديد من متجر بيبي مون* 🌙👶${orderIdStr}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `👤 *الاسم:* ${name}\n`;
        message += `📞 *الهاتف:* ${phone}\n`;
        message += `📍 *العنوان:* ${address || 'لم يحدد'}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📦 *المنتجات المطلوبة:*\n`;

        cart.forEach((item, idx) => {
            message += `${idx + 1}. *${item.name}*\n   العدد: ${item.qty} | السعر: ${(item.price * item.qty).toLocaleString('ar-IQ')} د.ع\n`;
        });

        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `💰 *المجموع الكلي:* ${grandTotal.toLocaleString('ar-IQ')} دينار عراقي`;

        const waUrl = `https://wa.me/${managerPhone}?text=${encodeURIComponent(message)}`;

        // 3) Clear cart & UI
        cart = [];
        saveCart();
        updateCartUI();
        toggleCart();

        document.getElementById('custName').value = '';
        document.getElementById('custPhone').value = '';
        document.getElementById('custAddress').value = '';

        showToast('🎉 تم حفظ طلبك! جاري تحويلك للواتساب...', false);

        // 4) Redirect to WhatsApp
        setTimeout(() => {
            window.location.href = waUrl;
        }, 1200);

    } catch (e) {
        showToast('حدث خطأ في إرسال الطلب، حاول مجدداً', true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '💬 إرسال الطلب عبر الواتساب';
        }
    }
}

// ============ API HELPERS ============
async function apiFetch(url, options = {}) {
    const res = await fetch(API + url, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'خطأ في الاتصال بالخادم');
    }
    return res.json();
}

// ============ TOAST ============
function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.background = isError ? '#e74c3c' : 'linear-gradient(135deg,#9b59b6,#3498db)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ============ ADMIN LONG-PRESS ============
function setupLongPress() {
    const logo = document.getElementById('storeLogo');
    if (!logo) return;
    logo.addEventListener('touchstart', e => {
        pressStart = Date.now();
        const ring = document.getElementById('pressRing');
        ring.style.transition = 'none';
        ring.style.strokeDashoffset = '283';
        document.getElementById('pressIndicator').style.display = 'flex';
        requestAnimationFrame(() => {
            ring.style.transition = 'stroke-dashoffset 2s linear';
            ring.style.strokeDashoffset = '0';
        });
        pressTimer = setTimeout(() => openAdminModal(), 2000);
    }, { passive: true });
    logo.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
        document.getElementById('pressIndicator').style.display = 'none';
    });
    logo.addEventListener('touchcancel', () => {
        clearTimeout(pressTimer);
        document.getElementById('pressIndicator').style.display = 'none';
    });
    // Click: if in subpage go home, if already in home open admin modal
    logo.addEventListener('click', () => {
        if (location.hash && location.hash !== '#/' && location.hash !== '') {
            navigate('#/');
        } else {
            openAdminModal();
        }
    });
    logo.addEventListener('dblclick', () => openAdminModal());
    logo.addEventListener('contextmenu', e => { e.preventDefault(); openAdminModal(); });
}

function openAdminModal() {
    document.getElementById('adminModal').classList.add('open');
    document.getElementById('adminModalOverlay').classList.add('open');
    document.getElementById('pressIndicator').style.display = 'none';
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('open');
    document.getElementById('adminModalOverlay').classList.remove('open');
}

async function submitAdminLogin() {
    const pass = document.getElementById('adminPasswordInput').value;
    const errEl = document.getElementById('adminError');
    if (!pass) {
        errEl.textContent = 'يرجى كتابة كلمة المرور';
        errEl.style.display = 'block';
        return;
    }
    try {
        const res = await apiFetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: pass })
        });
        if (res.token) {
            localStorage.setItem('adminToken', res.token);
            sessionStorage.setItem('adminToken', res.token);
            closeAdminModal();
            window.location.href = '/admin';
        }
    } catch (e) {
        errEl.textContent = e.message || 'كلمة المرور غير صحيحة';
        errEl.style.display = 'block';
    }
}
