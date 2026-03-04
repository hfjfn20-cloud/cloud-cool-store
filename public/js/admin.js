const API = '';
let adminToken = sessionStorage.getItem('adminToken') || '';
let allProducts = [];
let allOrders = [];
let allCategories = [];
let currentProductId = null;
let currentOrderFilter = 'all';

// ============ AUTH GUARD ============
if (!adminToken) {
    window.location.href = '/';
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
    setCurrentDate();
    await loadCategories();
    await loadStats();
    showPage('dashboard');
});

function setCurrentDate() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ============ API HELPERS ============
async function apiFetch(url, options = {}) {
    const headers = { 'Authorization': `Bearer ${adminToken}`, ...options.headers };
    const res = await fetch(API + url, { ...options, headers });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'خطأ في الخادم');
    }
    return res.json();
}

// ============ NAVIGATION ============
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page)?.classList.add('active');
    document.getElementById('nav-' + page)?.classList.add('active');

    if (page === 'products') loadProducts();
    if (page === 'orders') loadOrders();
    if (page === 'dashboard') loadStats();
    closeMobileSidebar();
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('mobile-open');
    document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeMobileSidebar() {
    document.querySelector('.sidebar').classList.remove('mobile-open');
    document.getElementById('sidebarOverlay').classList.remove('open');
}

function logout() {
    sessionStorage.removeItem('adminToken');
    window.location.href = '/';
}

// ============ LOAD STATS ============
async function loadStats() {
    try {
        const stats = await apiFetch('/api/orders/stats');
        document.getElementById('statProducts').textContent = stats.totalProducts;
        document.getElementById('statOrders').textContent = stats.totalOrders;
        document.getElementById('statNew').textContent = stats.newOrders;
        document.getElementById('statToday').textContent = stats.todayOrders;

        const badge = document.getElementById('ordersNavBadge');
        if (stats.newOrders > 0) { badge.textContent = stats.newOrders; badge.style.display = 'inline-block'; }
        else { badge.style.display = 'none'; }
    } catch (e) { console.error(e); }
}

// ============ LOAD CATEGORIES ============
async function loadCategories() {
    try {
        allCategories = await fetch('/api/categories').then(r => r.json());
        populateCategorySelect();
    } catch (e) { console.error(e); }
}

function populateCategorySelect() {
    const sel = document.getElementById('pCategory');
    sel.innerHTML = '<option value="">-- اختر القسم --</option>';
    allCategories.forEach(c => {
        sel.innerHTML += `<option value="${c.id}" data-name="${c.name}">${c.label}</option>`;
    });
}

function updateSubcategoryOptions(catId) {
    const sel = document.getElementById('pSubcategory');
    sel.innerHTML = '<option value="">-- اختر الفئة --</option>';
    if (!catId) return;
    const cat = allCategories.find(c => c.id == catId);
    if (cat?.subcategories) {
        cat.subcategories.forEach(sub => {
            sel.innerHTML += `<option value="${sub.id}">${sub.label}</option>`;
        });
    }
}

// ============ PRODUCTS ============
async function loadProducts() {
    try {
        allProducts = await apiFetch('/api/products');
        renderProductsTable(allProducts);
    } catch (e) { showToast('خطأ في تحميل المنتجات', true); }
}

function renderProductsTable(products) {
    const tbody = document.getElementById('productsTableBody');
    if (!products.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#7f8c8d">لا توجد منتجات</td></tr>`;
        return;
    }
    tbody.innerHTML = products.map((p, i) => {
        const imgEl = p.image
            ? `<img src="${p.image}" style="width:50px;height:50px;border-radius:10px;object-fit:cover" onerror="this.outerHTML='👕'">`
            : `<div style="width:50px;height:50px;border-radius:10px;background:#f0f0f0;display:inline-flex;align-items:center;justify-content:center;font-size:1.5rem">👕</div>`;

        const tags = [
            p.is_new ? `<span class="tag tag-new">✨ جديد</span>` : '',
            p.is_offer ? `<span class="tag tag-offer">🏷️ عرض ${p.discount_percent ? '-' + p.discount_percent + '%' : ''}</span>` : '',
            p.is_low_stock ? `<span class="tag tag-low">⚡ قد ينفد</span>` : '',
        ].filter(Boolean).join('') || '<span style="color:#bbb;font-size:0.8rem">—</span>';

        return `
      <tr>
        <td>${i + 1}</td>
        <td>${imgEl}</td>
        <td><strong>${p.name}</strong>${p.description ? `<div style="font-size:0.78rem;color:#7f8c8d;margin-top:0.2rem">${p.description.substring(0, 50)}${p.description.length > 50 ? '...' : ''}</div>` : ''}</td>
        <td><span style="font-size:0.85rem">${p.category_label || '—'}</span>${p.subcategory_label ? `<br><span style="font-size:0.78rem;color:#7f8c8d">${p.subcategory_label}</span>` : ''}</td>
        <td><strong style="color:#9b59b6">${p.price.toLocaleString('ar-IQ')} د.ع</strong></td>
        <td>${tags}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-ghost" onclick="openProductModal(${p.id})">✏️ تعديل</button>
            <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id}, '${escStr(p.name)}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
    }).join('');
}

function filterProductsTable(q) {
    const filtered = allProducts.filter(p =>
        p.name.includes(q) || (p.description || '').includes(q) || (p.category_label || '').includes(q)
    );
    renderProductsTable(filtered);
}

function escStr(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '\\"'); }

// PRODUCT EDIT PAGE
function openProductModal(id = null) {
    currentProductId = id;
    resetProductForm();
    document.getElementById('editPageTitle').textContent = id ? 'تعديل المنتج' : 'إضافة منتج جديد';
    document.getElementById('productSubmitBtn').textContent = id ? 'حفظ التعديلات' : 'حفظ المنتج';

    if (id) {
        const p = allProducts.find(x => x.id === id);
        if (!p) return;
        document.getElementById('productId').value = p.id;
        document.getElementById('pName').value = p.name;
        document.getElementById('pDesc').value = p.description || '';
        document.getElementById('pPrice').value = p.price;
        document.getElementById('pQty').value = p.stock_qty;
        document.getElementById('pCategory').value = p.category_id || '';
        updateSubcategoryOptions(p.category_id);
        document.getElementById('pSubcategory').value = p.subcategory_id || '';
        document.getElementById('pIsNew').checked = !!p.is_new;
        document.getElementById('pIsOffer').checked = !!p.is_offer;
        document.getElementById('pIsLow').checked = !!p.is_low_stock;
        document.getElementById('pDiscount').value = p.discount_percent || '';
        if (p.is_offer) document.getElementById('discountField').style.display = 'block';
        if (p.image) {
            document.getElementById('imagePreview').src = p.image;
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('imageUploadPlaceholder').style.display = 'none';
        }
    }

    showPage('edit-product');
}

function closeProductModal() {
    showPage('products');
}

function resetProductForm() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imageUploadPlaceholder').style.display = 'flex';
    document.getElementById('discountField').style.display = 'none';
    document.getElementById('pSubcategory').innerHTML = '<option value="">-- اختر الفئة --</option>';
    currentProductId = null;
}

function toggleDiscountField(show) {
    document.getElementById('discountField').style.display = show ? 'block' : 'none';
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('imageUploadPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function submitProduct(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('productSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ جاري الحفظ...';

    try {
        const formData = new FormData();
        formData.append('name', document.getElementById('pName').value.trim());
        formData.append('description', document.getElementById('pDesc').value.trim());
        formData.append('price', document.getElementById('pPrice').value);
        formData.append('stock_qty', document.getElementById('pQty').value);
        formData.append('category_id', document.getElementById('pCategory').value);
        formData.append('subcategory_id', document.getElementById('pSubcategory').value);
        formData.append('is_new', document.getElementById('pIsNew').checked ? '1' : '0');
        formData.append('is_offer', document.getElementById('pIsOffer').checked ? '1' : '0');
        formData.append('discount_percent', document.getElementById('pDiscount').value || '0');
        formData.append('is_low_stock', document.getElementById('pIsLow').checked ? '1' : '0');

        const imageFile = document.getElementById('pImage').files[0];
        if (imageFile) formData.append('image', imageFile);

        const url = currentProductId ? `/api/products/${currentProductId}` : '/api/products';
        const method = currentProductId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: formData
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'خطأ في الخادم');
        }

        showToast(currentProductId ? '✅ تم تعديل المنتج بنجاح' : '✅ تمت إضافة المنتج بنجاح');
        closeProductModal();
        await loadProducts();
        await loadStats();
    } catch (err) {
        showToast('❌ ' + (err.message || 'حدث خطأ أثناء الحفظ'), true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = currentProductId ? 'حفظ التعديلات' : 'حفظ المنتج';
    }
}

async function deleteProduct(id, name) {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    try {
        await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
        showToast('✅ تم حذف المنتج');
        await loadProducts();
        await loadStats();
    } catch (e) { showToast('❌ خطأ في الحذف', true); }
}

// ============ ORDERS ============
async function loadOrders() {
    try {
        allOrders = await apiFetch('/api/orders');
        renderOrders();
    } catch (e) { showToast('خطأ في تحميل الطلبات', true); }
}

function filterOrders(status, btn) {
    currentOrderFilter = status;
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderOrders();
}

function renderOrders() {
    const filtered = currentOrderFilter === 'all'
        ? allOrders
        : allOrders.filter(o => o.status === currentOrderFilter);

    const container = document.getElementById('ordersList');
    if (!filtered.length) {
        container.innerHTML = `<div style="text-align:center;padding:3rem;color:#7f8c8d"><div style="font-size:3rem">📭</div><p>لا توجد طلبات</p></div>`;
        return;
    }

    container.innerHTML = filtered.map(order => {
        const statusClass = {
            'جديد': 'new', 'قيد المعالجة': 'processing',
            'تم الشحن': 'shipped', 'تم التسليم': 'delivered', 'ملغى': 'cancelled'
        }[order.status] || 'new';

        const itemsList = (order.items || []).map(item =>
            `<div class="order-item-row">📌 ${item.product_name} <span>× ${item.quantity} — ${(item.product_price * item.quantity).toLocaleString('ar-IQ')} د.ع</span></div>`
        ).join('');

        const waMsg = encodeURIComponent(`مرحباً ${order.customer_name}، بخصوص طلبكم رقم #${order.id} من متجر Cloud Cool. إجمالي الطلب: ${order.total.toLocaleString('ar-IQ')} دينار.`);
        const waPhoneRaw = order.customer_phone.replace(/\D/g, '');
        let waPhone = waPhoneRaw;
        // Handle Iraqi numbers starting with 07 or 7
        if (waPhone.startsWith('07')) {
            waPhone = '964' + waPhone.substring(1);
        } else if (waPhone.startsWith('7') && waPhone.length === 10) {
            waPhone = '964' + waPhone;
        }
        const waLink = `https://wa.me/${waPhone}?text=${waMsg}`;

        const date = new Date(order.created_at).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        return `
      <div class="order-card status-${statusClass}">
        <div class="order-top">
          <div>
            <div class="order-id">طلب رقم #${order.id}</div>
            <div class="order-name">👤 ${order.customer_name}</div>
            <div class="order-phone">📱 ${order.customer_phone}</div>
            ${order.customer_address ? `<div class="order-address">📍 ${order.customer_address}</div>` : ''}
          </div>
          <div class="order-status">
            <span class="status-badge ${statusClass}">${order.status}</span>
          </div>
        </div>
        <div class="order-items-list">${itemsList}</div>
        <div class="order-bottom">
          <div>
            <div class="order-total">المجموع: ${order.total.toLocaleString('ar-IQ')} د.ع</div>
            <div class="order-date">${date}</div>
          </div>
          <div class="order-actions">
            <select class="status-select" onchange="updateOrderStatus(${order.id}, this.value)">
              ${['جديد', 'قيد المعالجة', 'تم الشحن', 'تم التسليم', 'ملغى'].map(s =>
            `<option value="${s}" ${s === order.status ? 'selected' : ''}>${s}</option>`
        ).join('')}
            </select>
            <a href="${waLink}" target="_blank" class="btn btn-sm btn-wa">
              💬 واتساب
            </a>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await apiFetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        // Update locally
        const order = allOrders.find(o => o.id === orderId);
        if (order) order.status = newStatus;
        renderOrders();
        await loadStats();
        showToast('✅ تم تحديث حالة الطلب');
    } catch (e) { showToast('❌ خطأ في التحديث', true); }
}

// ============ TOAST ============
let toastTimer;
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
