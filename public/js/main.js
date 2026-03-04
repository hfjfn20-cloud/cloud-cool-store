const API = '';

// ============ CART STATE ============
let cart = JSON.parse(localStorage.getItem('cloudcool_cart') || '[]');
let allCategories = [];
let activeCategory = 'all';
let activeSubcategory = null;
let searchTimeout = null;

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
    setupLongPress();
    setupSearch();
    await loadCategories();
    await loadAllSections();
    updateCartUI();
});

// ============ API HELPERS ============
async function apiFetch(url, options = {}) {
    const res = await fetch(API + url, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'خطأ في الاتصال بالخادم');
    }
    return res.json();
}

// ============ LOAD CATEGORIES ============
async function loadCategories() {
    try {
        allCategories = await apiFetch('/api/categories');
        renderCategoryButtons();
    } catch (e) {
        console.error('Error loading categories:', e);
    }
}

function renderCategoryButtons() {
    const row = document.getElementById('categoriesRow');
    if (!row) return;

    // Always keep "All" button
    let html = `
        <button class="cat-btn cat-btn-all active" id="btn-all" onclick="toggleCategory('all')">
            🌟 الكل
        </button>
    `;

    allCategories.forEach(cat => {
        html += `
            <button class="cat-btn" id="btn-${cat.name}" onclick="toggleCategory('${cat.name}')">
                ${cat.label}
            </button>
        `;
    });

    row.innerHTML = html;
}

// ============ LOAD PRODUCT SECTIONS ============
async function loadAllSections() {
    showSkeletons();
    try {
        const params = buildFilterParams();
        const allProductsList = await apiFetch('/api/products?' + new URLSearchParams(params));

        const newProds = allProductsList.filter(p => p.is_new);
        const offerProds = allProductsList.filter(p => !p.is_new && p.is_offer);
        const lowProds = allProductsList.filter(p => !p.is_new && !p.is_offer && p.is_low_stock);
        const regularProds = allProductsList.filter(p => !p.is_new && !p.is_offer && !p.is_low_stock);

        renderSection('newProducts', newProds);
        renderSection('offerProducts', offerProds);
        renderSection('lowStockProducts', lowProds);
        renderSection('allProducts', regularProds);

        toggleSectionVisibility('newSection', newProds.length > 0);
        toggleSectionVisibility('offersSection', offerProds.length > 0);
        toggleSectionVisibility('lowStockSection', lowProds.length > 0);
        toggleSectionVisibility('allSection', regularProds.length > 0);

        const anyProducts = allProductsList.length > 0;
        document.getElementById('emptyState').style.display = anyProducts ? 'none' : 'block';
    } catch (e) {
        showToast('حدث خطأ في تحميل المنتجات', true);
    }
}

function buildFilterParams() {
    const params = {};
    if (activeCategory !== 'all') params.category = activeCategory;
    if (activeSubcategory) params.subcategory = activeSubcategory;
    return params;
}

function toggleSectionVisibility(sectionId, visible) {
    document.getElementById(sectionId).style.display = visible ? 'block' : 'none';
}

function showSkeletons() {
    ['newProducts', 'offerProducts', 'lowStockProducts', 'allProducts'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = Array(4).fill(
            `<div class="skeleton skeleton-card"></div>`
        ).join('');
    });
}

// ============ RENDER PRODUCTS ============
function renderSection(containerId, products) {
    const container = document.getElementById(containerId);
    if (!products.length) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = products.map(renderProductCard).join('');
}

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
    <div class="product-card" data-id="${product.id}">
      <div class="product-img-wrap">${imgTag}</div>
      <div class="product-flags">${flags}</div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div class="product-category">${product.category_label || ''} ${product.subcategory_label ? '· ' + product.subcategory_label : ''}</div>
        <div class="product-price-wrap">${priceHtml}</div>
        <button class="add-cart-btn" onclick="addToCart(${product.id}, '${escStr(product.name)}', ${discountedPrice}, '${product.image || ''}')">
          🛒 أضف إلى السلة
        </button>
      </div>
    </div>
  `;
}

function escStr(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '\\"'); }

// ============ CATEGORY TOGGLE ============
function toggleCategory(cat) {
    activeCategory = cat;
    activeSubcategory = null;

    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + cat)?.classList.add('active');

    const subRow = document.getElementById('subcategoriesRow');
    if (!subRow) return;

    if (cat === 'all') {
        subRow.classList.remove('open');
        subRow.innerHTML = '';
    } else {
        const catData = allCategories.find(c => c.name === cat);
        if (catData && catData.subcategories && catData.subcategories.length) {
            subRow.innerHTML = catData.subcategories.map(sub =>
                `<button class="sub-btn" onclick="filterSubcategory('${sub.name}', this)">${sub.label}</button>`
            ).join('');
            subRow.classList.add('open');
        } else {
            subRow.classList.remove('open');
            subRow.innerHTML = '';
        }
    }
    loadAllSections();
}

function filterSubcategory(subcatName, btn) {
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
    if (activeSubcategory === subcatName) {
        activeSubcategory = null;
    } else {
        activeSubcategory = subcatName;
        btn.classList.add('active');
    }
    loadAllSections();
}

// ============ SEARCH ============
function setupSearch() {
    const input = document.getElementById('searchInput');
    const clear = document.getElementById('searchClear');

    input.addEventListener('input', () => {
        const val = input.value.trim();
        clear.classList.toggle('visible', val.length > 0);
        clearTimeout(searchTimeout);
        if (val) {
            searchTimeout = setTimeout(() => performSearch(val), 400);
        } else {
            hideSearchSection();
            loadAllSections();
        }
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') clearSearch();
    });
}

async function performSearch(query) {
    const searchSection = document.getElementById('searchSection');
    const searchResults = document.getElementById('searchResults');

    searchResults.innerHTML = Array(4).fill(`<div class="skeleton skeleton-card"></div>`).join('');
    searchSection.style.display = 'block';

    // Hide normal sections during search
    ['newSection', 'offersSection', 'lowStockSection'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });

    try {
        const products = await apiFetch('/api/products?' + new URLSearchParams({ search: query }));
        if (products.length) {
            searchResults.innerHTML = products.map(renderProductCard).join('');
        } else {
            searchResults.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">🔍</div>
          <p>لا توجد نتائج لـ "${query}"</p>
        </div>`;
        }
    } catch (e) {
        showToast('خطأ في البحث', true);
    }
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').classList.remove('visible');
    hideSearchSection();
    loadAllSections();
}

function hideSearchSection() {
    document.getElementById('searchSection').style.display = 'none';
}

// ============ CART MANAGEMENT ============
function saveCart() { localStorage.setItem('cloudcool_cart', JSON.stringify(cart)); }

function addToCart(id, name, price, image) {
    const existing = cart.find(i => i.id === id);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ id, name, price, image, qty: 1 });
    }
    saveCart();
    updateCartUI();
    showToast(`✅ تمت إضافة "${name}" إلى السلة`);

    // Animate the card
    const card = document.querySelector(`.product-card[data-id="${id}"]`);
    if (card) {
        card.style.transform = 'scale(0.96)';
        setTimeout(() => card.style.transform = '', 300);
    }
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    saveCart();
    updateCartUI();
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    saveCart();
    updateCartUI();
}

function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const total = cart.reduce((s, i) => s + i.qty, 0);
    badge.textContent = total;
    badge.style.background = total > 0 ? '' : '#aaa';

    if (document.getElementById('cartSidebar').classList.contains('open')) {
        renderCartSidebar();
    }
}

function renderCartSidebar() {
    const itemsEl = document.getElementById('cartItems');
    const emptyEl = document.getElementById('cartEmpty');
    const footerEl = document.getElementById('cartFooter');
    const totalEl = document.getElementById('cartTotal');

    if (!cart.length) {
        itemsEl.innerHTML = '';
        emptyEl.style.display = 'flex';
        footerEl.style.display = 'none';
        return;
    }
    emptyEl.style.display = 'none';
    footerEl.style.display = 'block';

    itemsEl.innerHTML = cart.map(item => {
        const imgContent = item.image
            ? `<img src="${item.image}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`
            : '👕';
        return `
      <div class="cart-item">
        <div class="cart-item-img">${imgContent}</div>
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
      </div>
    `;
    }).join('');

    const grandTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    totalEl.textContent = grandTotal.toLocaleString('ar-IQ') + ' دينار';
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
    if (sidebar.classList.contains('open')) renderCartSidebar();
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}

// ============ PLACE ORDER ============
async function placeOrder() {
    const name = document.getElementById('custName').value.trim();
    const address = document.getElementById('custAddress').value.trim();
    const phone = document.getElementById('custPhone').value.trim();

    if (!name) { showToast('⚠️ الرجاء إدخال الاسم', true); return; }
    if (!phone) { showToast('⚠️ الرجاء إدخال رقم الهاتف', true); return; }
    if (!cart.length) { showToast('⚠️ السلة فارغة', true); return; }

    const btn = document.querySelector('.checkout-btn');
    btn.disabled = true;
    btn.textContent = '⏳ جاري إرسال الطلب...';

    try {
        const orderData = {
            customer_name: name,
            customer_address: address,
            customer_phone: phone,
            items: cart.map(i => ({ product_id: i.id, quantity: i.qty }))
        };
        const result = await apiFetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        // Generate WhatsApp Message
        const managerPhone = '9647724650622';
        const baseUrl = window.location.origin;
        let message = `*طلب جديد من متجر Cloud Cool* 👕🚀\n\n`;
        message += `👤 *الزبون:* ${name}\n`;
        message += `📞 *الهاتف:* ${phone}\n`;
        message += `📍 *العنوان:* ${address || 'لم يحدد'}\n\n`;
        message += `📦 *المنتجات:*\n`;

        cart.forEach((item, idx) => {
            const imgLink = item.image ? `\n🖼️ رابط الصورة: ${baseUrl}${item.image}` : '';
            message += `${idx + 1}. ${item.name} (عدد: ${item.qty}) - السعر: ${(item.price * item.qty).toLocaleString('ar-IQ')} د.ع${imgLink}\n`;
        });

        const grandTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
        message += `\n💰 *المجموع الكلي:* ${grandTotal.toLocaleString('ar-IQ')} دينار عراقي`;

        const waUrl = `https://wa.me/${managerPhone}?text=${encodeURIComponent(message)}`;

        cart = [];
        saveCart();
        updateCartUI();
        toggleCart();
        document.getElementById('custName').value = '';
        document.getElementById('custAddress').value = '';
        document.getElementById('custPhone').value = '';

        showToast('🎉 ' + result.message + '. سيتم توجيهك للواتساب...', false, 5000);

        // Redirect to WhatsApp after a short delay
        setTimeout(() => {
            window.location.href = waUrl;
        }, 1500);

    } catch (e) {
        showToast('❌ ' + e.message, true);
    } finally {
        btn.disabled = false;
        btn.textContent = '🛍️ اشتري الآن';
    }
}

// ============ ADMIN LONG PRESS ============
function setupLongPress() {
    const logo = document.getElementById('storeLogo');
    const indicator = document.getElementById('pressIndicator');
    let pressTimer = null;
    let pressStart = null;
    const PRESS_DURATION = 5000;

    function startPress(e) {
        e.preventDefault();
        pressStart = Date.now();
        logo.classList.add('pressing');
        indicator.classList.add('visible');
        pressTimer = setTimeout(() => {
            indicator.classList.remove('visible');
            logo.classList.remove('pressing');
            openAdminModal();
        }, PRESS_DURATION);
    }

    function endPress() {
        clearTimeout(pressTimer);
        logo.classList.remove('pressing');
        indicator.classList.remove('visible');
    }

    logo.addEventListener('mousedown', startPress);
    logo.addEventListener('mouseup', endPress);
    logo.addEventListener('mouseleave', endPress);
    logo.addEventListener('touchstart', startPress, { passive: false });
    logo.addEventListener('touchend', endPress);
    logo.addEventListener('touchcancel', endPress);
}

function openAdminModal() {
    document.getElementById('adminModalOverlay').classList.add('open');
    document.getElementById('adminModal').classList.add('open');
    document.getElementById('adminPasswordInput').value = '';
    document.getElementById('adminError').style.display = 'none';
    setTimeout(() => document.getElementById('adminPasswordInput').focus(), 300);
}

function closeAdminModal() {
    document.getElementById('adminModalOverlay').classList.remove('open');
    document.getElementById('adminModal').classList.remove('open');
}

document.getElementById('adminPasswordInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitAdminLogin();
});

async function submitAdminLogin() {
    const password = document.getElementById('adminPasswordInput').value;
    const errorEl = document.getElementById('adminError');

    try {
        const res = await apiFetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        sessionStorage.setItem('adminToken', res.token);
        closeAdminModal();
        window.location.href = '/admin';
    } catch (e) {
        errorEl.textContent = e.message || 'كلمة المرور غير صحيحة ❌';
        errorEl.style.display = 'block';
    }
}

// ============ TOAST ============
let toastTimer;
function showToast(msg, isError = false, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}
