/* =====================================================
   بيبي مون — main.js (SPA Router + Slider + Sections)
   ===================================================== */

const API = '';

// ============ STATE ============
let cart = JSON.parse(localStorage.getItem('babymoon_cart') || '[]');
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
    // RTL: for Arabic we invert direction
    track.style.transform = `translateX(${sliderIndex * 100}%)`;
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

    let html = `<button class="cat-tab active" id="tab-home" onclick="navigate('#/')">🏠 الرئيسية</button>`;
    allCategories.forEach(cat => {
        html += `<button class="cat-tab" id="tab-${cat.name}" onclick="navigate('#/category/${encodeURIComponent(cat.name)}')">${cat.label}</button>`;
    });
    row.innerHTML = html;
}

function updateActiveCatTab(hash) {
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    if (hash === '#/' || hash === '') {
        document.getElementById('tab-home')?.classList.add('active');
    } else if (hash.startsWith('#/category/')) {
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

        // Section per category
        for (const cat of allCategories) {
            const catProducts = products.filter(p => p.category === cat.name);
            if (!catProducts.length) continue;

            // Shuffle
            const shuffled = [...catProducts].sort(() => Math.random() - 0.5);
            const preview = shuffled.slice(0, 8);

            html += `
            <section class="home-section">
                <div class="home-section-header">
                    <h2 class="home-section-title">${cat.label}</h2>
                    <button class="more-btn" onclick="navigate('#/category/${encodeURIComponent(cat.name)}')">المزيد ←</button>
                </div>
                <div class="carousel-wrapper">
                    <div class="carousel-track cat-carousel" id="cat-${cat.name}">
                        ${preview.map(renderProductCard).join('')}
                    </div>
                </div>
            </section>`;
        }

        // If no categories, show all
        if (!html) {
            html = `<div class="empty-state"><div class="empty-icon">🧺</div><p>لا توجد منتجات حالياً</p></div>`;
        }

        main.innerHTML = html;
        initCarousels();
    } catch (e) {
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
async function renderCategoryPage(catName) {
    updateActiveCatTab(`#/category/${catName}`);
    const cat = allCategories.find(c => c.name === catName);
    const title = cat ? cat.label : catName;
    const main = document.getElementById('appMain');
    main.innerHTML = '<div class="loading-spinner">⏳</div>';

    try {
        const products = await apiFetch(`/api/products?category=${catName}`);
        const subcategories = await apiFetch(`/api/categories/${catName}/subcategories`).catch(() => []);

        let html = `
        <div class="page-header">
            <button class="back-btn" onclick="navigate('#/')">← رجوع</button>
            <h1 class="page-title">${title}</h1>
        </div>
        <div class="filter-tabs" id="subTabs">
            <button class="filter-tab active" onclick="filterBySub(null, '${catName}')">الكل</button>
            ${subcategories.map(s =>
            `<button class="filter-tab" onclick="filterBySub('${s.name}', '${catName}')">${s.label}</button>`
        ).join('')}
        </div>
        <div class="products-grid-full" id="catGrid">
            ${products.length ? products.map(renderProductCard).join('') : '<div class="empty-state"><div class="empty-icon">🧺</div><p>لا توجد منتجات</p></div>'}
        </div>`;

        main.innerHTML = html;
    } catch (e) {
        main.innerHTML = `<div class="empty-state"><p>حدث خطأ في التحميل</p></div>`;
    }
}

async function filterBySub(subName, catName) {
    document.querySelectorAll('#subTabs .filter-tab').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    let url = `/api/products?category=${catName}`;
    if (subName) url += `&subcategory=${subName}`;
    const grid = document.getElementById('catGrid');
    grid.innerHTML = '<div class="loading-spinner">⏳</div>';
    try {
        const products = await apiFetch(url);
        grid.innerHTML = products.length
            ? products.map(renderProductCard).join('')
            : '<div class="empty-state"><div class="empty-icon">🧺</div><p>لا توجد منتجات</p></div>';
    } catch (e) { grid.innerHTML = ''; }
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

    const imgTag = product.image
        ? `<img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div class="product-placeholder" style="display:none">👕</div>`
        : `<div class="product-placeholder">👕</div>`;

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

    return `
    <div class="product-card" data-id="${product.id}" onclick="showProductDetails(${product.id})">
      <div class="product-img-wrap">${imgTag}</div>
      <div class="product-flags">${flags}</div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div class="product-category">${product.category_label || ''} ${product.subcategory_label ? '· ' + product.subcategory_label : ''}</div>
        <div class="product-price-wrap">${priceHtml}</div>
        <div class="product-actions-card" onclick="event.stopPropagation()">
          <button class="add-cart-btn" onclick="addToCart(${product.id}, '${escStr(product.name)}', ${discountedPrice}, '${product.image || ''}')">
            🛒 أضف إلى السلة
          </button>
        </div>
      </div>
    </div>`;
}

function escStr(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '\\"'); }

// ============ PRODUCT DETAILS ============
async function showProductDetails(id) {
    try {
        const product = await apiFetch(`/api/products/${id}`);
        if (!product) return;

        const hasDiscount = product.is_offer && product.discount_percent > 0;
        const discountedPrice = hasDiscount
            ? Math.round(product.price * (1 - product.discount_percent / 100))
            : product.price;

        document.getElementById('detailImg').src = product.image || '';
        document.getElementById('detailImg').style.display = product.image ? 'block' : 'none';

        const badge = document.getElementById('detailBadge');
        if (product.is_new) { badge.textContent = '✨ جديد'; badge.style.display = 'block'; }
        else if (product.is_offer) { badge.textContent = '🏷️ عرض'; badge.style.display = 'block'; }
        else if (product.is_low_stock) { badge.textContent = '⚡ قد ينفد'; badge.style.display = 'block'; }
        else { badge.style.display = 'none'; }

        document.getElementById('detailName').textContent = product.name;
        document.getElementById('detailCategory').textContent = `${product.category_label || ''} ${product.subcategory_label ? '· ' + product.subcategory_label : ''}`;
        document.getElementById('detailDesc').textContent = product.description || 'لا يوجد وصف متاح لهذا المنتج.';

        if (hasDiscount) {
            document.getElementById('detailPriceOriginal').textContent = product.price.toLocaleString('ar-IQ') + ' د.ع';
            document.getElementById('detailPriceOriginal').style.display = 'block';
        } else {
            document.getElementById('detailPriceOriginal').style.display = 'none';
        }
        document.getElementById('detailPriceFinal').textContent = discountedPrice.toLocaleString('ar-IQ') + ' د.ع';
        document.getElementById('detailBuyBtn').onclick = () => {
            addToCart(product.id, product.name, discountedPrice, product.image);
            closeProductDetails();
        };

        document.getElementById('productDetailView').classList.add('open');
        document.getElementById('productDetailOverlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    } catch (e) { console.error(e); }
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
function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    const isOpen = sidebar.classList.contains('open');
    sidebar.classList.toggle('open', !isOpen);
    overlay.classList.toggle('open', !isOpen);
    document.body.style.overflow = isOpen ? '' : 'hidden';
}

function addToCart(id, name, price, image) {
    const existing = cart.find(i => i.id === id);
    if (existing) { existing.qty++; }
    else { cart.push({ id, name, price, image, qty: 1 }); }
    saveCart();
    updateCartUI();
    showToast(`✅ تمت إضافة "${name}" إلى السلة`);
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    saveCart(); updateCartUI();
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) return removeFromCart(id);
    saveCart(); updateCartUI();
}

function saveCart() { localStorage.setItem('babymoon_cart', JSON.stringify(cart)); }

function updateCartUI() {
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const count = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('cartBadge').textContent = count;

    const itemsEl = document.getElementById('cartItems');
    const emptyEl = document.getElementById('cartEmpty');
    const footerEl = document.getElementById('cartFooter');
    document.getElementById('cartTotal').textContent = total.toLocaleString('ar-IQ') + ' دينار';

    if (!cart.length) {
        itemsEl.innerHTML = ''; emptyEl.style.display = 'flex'; footerEl.style.display = 'none';
    } else {
        emptyEl.style.display = 'none'; footerEl.style.display = 'block';
        itemsEl.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-img">
                    ${item.image ? `<img src="${item.image}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : '👕'}
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${(item.price * item.qty).toLocaleString('ar-IQ')} د.ع</div>
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
                        <span class="qty-num">${item.qty}</span>
                        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.id})">🗑️</button>
            </div>`).join('');
    }
}

// ============ ORDER ============
async function placeOrder() {
    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    if (!name || !phone) { showToast('الاسم ورقم الهاتف مطلوبان', true); return; }
    if (!cart.length) { showToast('السلة فارغة', true); return; }

    const btn = document.querySelector('.checkout-btn');
    btn.disabled = true; btn.textContent = '⏳ جاري الإرسال...';

    try {
        await apiFetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_name: name,
                customer_address: document.getElementById('custAddress').value.trim(),
                customer_phone: phone,
                items: cart.map(i => ({ product_id: i.id, product_name: i.name, quantity: i.qty, unit_price: i.price })),
                total: cart.reduce((s, i) => s + i.price * i.qty, 0)
            })
        });
        cart = []; saveCart(); updateCartUI();
        toggleCart();
        showToast('🎉 تم استلام طلبك! سنتواصل معك قريباً');
        document.getElementById('custName').value = '';
        document.getElementById('custPhone').value = '';
        document.getElementById('custAddress').value = '';
    } catch (e) {
        showToast('حدث خطأ في إرسال الطلب، حاول مجدداً', true);
    } finally {
        btn.disabled = false; btn.textContent = '🛍️ اشتري الآن';
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
    // Desktop double-click
    logo.addEventListener('dblclick', () => openAdminModal());
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
    try {
        const res = await apiFetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: pass })
        });
        if (res.token) {
            localStorage.setItem('adminToken', res.token);
            closeAdminModal();
            window.location.href = '/admin';
        }
    } catch (e) {
        errEl.textContent = 'كلمة المرور غير صحيحة';
        errEl.style.display = 'block';
    }
}
