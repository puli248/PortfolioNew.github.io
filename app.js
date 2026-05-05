/* =============================================
   MEDHANI NIWODA — app.js (40 Products)
   Full ecommerce logic with localStorage
   ============================================= */

'use strict';

/* ── PRODUCTS DATA (40 unique products, 4 categories) ── */
let PRODUCTS = [];

// ── STATE ──
let cart = [];
let currentFilter = 'all';
let currentSearch = '';
let modalProductId = null;
let modalQty = 1;
let slideIndex = 0;
let slideTimer = null; // now populated from the API

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    updateCartUI();
    startSlideshow();
    initScrollHeader();

    fetch('http://localhost:3000/api/products')
        .then(res => res.json())
        .then(data => {
            PRODUCTS = data.map(p => ({
                id: p.product_id,
                cat: p.cat,
                name: p.name,
                desc: p.description,
                price: parseFloat(p.price),
                stock: p.stock,
                img: p.img
            }));
            renderProducts();
        })
        .catch(err => {
            console.error('Failed to load products:', err);
            renderProducts(); // renders empty grid
        });
});

/* ═══════════════════════════════════════════
   LOCALSTORAGE
════════════════════════════════════════════ */
function saveCart() {
    localStorage.setItem('mn_cart', JSON.stringify(cart));
}

function loadCart() {
    const raw = localStorage.getItem('mn_cart');
    cart = raw ? JSON.parse(raw) : [];
}

/* ═══════════════════════════════════════════
   HERO SLIDESHOW
════════════════════════════════════════════ */
function startSlideshow() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.dot');
    if (slides.length === 0) return;

    slideTimer = setInterval(() => {
        slides[slideIndex].classList.remove('active');
        if (dots[slideIndex]) dots[slideIndex].classList.remove('active');
        slideIndex = (slideIndex + 1) % slides.length;
        slides[slideIndex].classList.add('active');
        if (dots[slideIndex]) dots[slideIndex].classList.add('active');
    }, 5500);
}

function goSlide(n) {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.dot');
    if (slides.length === 0) return;

    slides[slideIndex].classList.remove('active');
    if (dots[slideIndex]) dots[slideIndex].classList.remove('active');
    slideIndex = n;
    slides[slideIndex].classList.add('active');
    if (dots[slideIndex]) dots[slideIndex].classList.add('active');
    clearInterval(slideTimer);
    startSlideshow();
}

/* ═══════════════════════════════════════════
   HEADER SCROLL EFFECT
════════════════════════════════════════════ */
function initScrollHeader() {
    window.addEventListener('scroll', () => {
        const header = document.getElementById('site-header');
        if (header) header.classList.toggle('scrolled', window.scrollY > 50);
    });
}

/* ═══════════════════════════════════════════
   SEARCH
════════════════════════════════════════════ */
function toggleSearch() {
    const bar = document.getElementById('search-bar');
    bar.classList.toggle('open');
    if (bar.classList.contains('open')) {
        document.getElementById('search-input').focus();
    } else {
        document.getElementById('search-input').value = '';
        currentSearch = '';
        renderProducts();
    }
}

function searchProducts() {
    currentSearch = document.getElementById('search-input').value.toLowerCase().trim();
    renderProducts();
}

/* ═══════════════════════════════════════════
   FILTER
════════════════════════════════════════════ */
function filterCat(cat, el) {
    currentFilter = cat;
    currentSearch = '';
    const searchInput = document.getElementById('search-input');
    const searchBar = document.getElementById('search-bar');
    if (searchInput) searchInput.value = '';
    if (searchBar) searchBar.classList.remove('open');

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(a => {
        a.classList.toggle('active', (a.textContent.toLowerCase() === cat || (cat === 'all' && a.textContent.toLowerCase() === 'all')));
    });

    renderProducts();
    const productsSection = document.getElementById('products');
    if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth' });
}

/* ═══════════════════════════════════════════
   RENDER PRODUCTS
════════════════════════════════════════════ */
function renderProducts() {
    const grid = document.getElementById('products-grid');
    const label = document.getElementById('filter-label');
    const noRes = document.getElementById('no-results');

    if (!grid) return;

    let filtered = PRODUCTS.filter(p => {
        const matchCat = currentFilter === 'all' || p.cat === currentFilter;
        const matchSearch = !currentSearch || p.name.toLowerCase().includes(currentSearch) || p.desc.toLowerCase().includes(currentSearch);
        return matchCat && matchSearch;
    });

    const catName = currentFilter === 'all' ? 'all products' : currentFilter;
    if (label) label.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}${currentFilter !== 'all' ? ' in ' + currentFilter : ''}`;

    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (noRes) noRes.style.display = 'block';
        return;
    }
    if (noRes) noRes.style.display = 'none';

    grid.innerHTML = filtered.map((p, i) => `
    <div class="product-card" style="animation-delay:${i * 0.03}s" onclick="openProductModal(${p.id})">
      <div class="card-img-wrap">
        <img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.src='https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg?auto=compress&cs=tinysrgb&w=600'"/>
        <span class="card-cat-badge ${p.cat}">${p.cat}</span>
        <span class="card-stock-tag">${p.stock > 0 ? p.stock + ' left' : 'Out of stock'}</span>
      </div>
      <div class="card-body">
        <h3 class="card-name">${p.name}</h3>
        <p class="card-desc">${p.desc.substring(0, 80)}...</p>
        <div class="card-footer">
          <span class="card-price">£${p.price.toFixed(2)}</span>
          <button class="card-add" ${p.stock === 0 ? 'disabled' : ''}
            onclick="event.stopPropagation();addToCart(${p.id},1)">
            ${p.stock === 0 ? 'Sold Out' : 'Add to Basket'}
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════
   PRODUCT MODAL
════════════════════════════════════════════ */
function openProductModal(id) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    modalProductId = id;
    modalQty = 1;

    const modalImg = document.getElementById('modal-img');
    const modalCat = document.getElementById('modal-cat');
    const modalName = document.getElementById('modal-name');
    const modalDesc = document.getElementById('modal-desc');
    const modalPrice = document.getElementById('modal-price');
    const modalStock = document.getElementById('modal-stock');
    const modalQtyEl = document.getElementById('modal-qty');
    const btn = document.getElementById('modal-add-btn');

    if (modalImg) modalImg.src = p.img;
    if (modalCat) {
        modalCat.textContent = p.cat;
        modalCat.className = 'modal-badge ' + p.cat;
    }
    if (modalName) modalName.textContent = p.name;
    if (modalDesc) modalDesc.textContent = p.desc;
    if (modalPrice) modalPrice.textContent = '£' + p.price.toFixed(2);
    if (modalStock) modalStock.textContent = p.stock > 0 ? p.stock + ' in stock' : 'Out of stock';
    if (modalQtyEl) modalQtyEl.textContent = modalQty;

    if (btn) {
        btn.disabled = p.stock === 0;
        btn.textContent = p.stock === 0 ? 'Out of Stock' : 'Add to Basket';
    }

    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
}

function closeModalBg(e) {
    if (e.target === document.getElementById('product-modal')) closeProductModal();
}

function changeModalQty(delta) {
    const p = PRODUCTS.find(x => x.id === modalProductId);
    if (!p) return;
    modalQty = Math.max(1, Math.min(p.stock, modalQty + delta));
    const modalQtyEl = document.getElementById('modal-qty');
    if (modalQtyEl) modalQtyEl.textContent = modalQty;
}

function addFromModal() {
    if (!modalProductId) return;
    addToCart(modalProductId, modalQty);
    closeProductModal();
}

/* ═══════════════════════════════════════════
   CART LOGIC
════════════════════════════════════════════ */
function addToCart(id, qty) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p || p.stock === 0) return;

    const existing = cart.find(x => x.id === id);
    if (existing) {
        existing.qty = Math.min(p.stock, existing.qty + qty);
    } else {
        cart.push({ id, qty });
    }
    saveCart();
    updateCartUI();
    showToast(`✓ "${p.name}" added to basket`);

    // Badge pop animation
    const badge = document.getElementById('cart-count');
    if (badge) {
        badge.classList.add('pop');
        setTimeout(() => badge.classList.remove('pop'), 300);
    }
}

function removeFromCart(id) {
    cart = cart.filter(x => x.id !== id);
    saveCart();
    updateCartUI();
    renderCartDrawer();
}

function changeCartQty(id, delta) {
    const item = cart.find(x => x.id === id);
    const p = PRODUCTS.find(x => x.id === id);
    if (!item || !p) return;
    item.qty = Math.max(1, Math.min(p.stock, item.qty + delta));
    saveCart();
    updateCartUI();
    renderCartDrawer();
}

function getCartTotal() {
    return cart.reduce((sum, item) => {
        const p = PRODUCTS.find(x => x.id === item.id);
        return sum + (p ? p.price * item.qty : 0);
    }, 0);
}

function getCartCount() {
    return cart.reduce((n, item) => n + item.qty, 0);
}

function updateCartUI() {
    const countEl = document.getElementById('cart-count');
    if (countEl) countEl.textContent = getCartCount();
}

/* ═══════════════════════════════════════════
   CART DRAWER
════════════════════════════════════════════ */
function openCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderCartDrawer();
}

function closeCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

function renderCartDrawer() {
    const itemsEl = document.getElementById('cart-items');
    const footerEl = document.getElementById('cart-footer');

    if (!itemsEl) return;

    if (cart.length === 0) {
        itemsEl.innerHTML = '<p class="empty-msg">Your basket is empty.</p>';
        if (footerEl) footerEl.style.display = 'none';
        return;
    }

    if (footerEl) footerEl.style.display = 'block';
    itemsEl.innerHTML = cart.map(item => {
        const p = PRODUCTS.find(x => x.id === item.id);
        if (!p) return '';
        return `
      <div class="cart-item">
        <div class="ci-img"><img src="${p.img}" alt="${p.name}" onerror="this.src='https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg?auto=compress&cs=tinysrgb&w=600'"/></div>
        <div class="ci-info">
          <span class="ci-name">${p.name}</span>
          <span class="ci-price">£${(p.price * item.qty).toFixed(2)}</span>
          <div class="ci-qty-row">
            <button class="ci-qb" onclick="changeCartQty(${p.id},-1)">−</button>
            <span class="ci-qn">${item.qty}</span>
            <button class="ci-qb" onclick="changeCartQty(${p.id},1)">+</button>
          </div>
        </div>
        <button class="ci-rm" onclick="removeFromCart(${p.id})" title="Remove">✕</button>
      </div>
    `;
    }).join('');

    const totalEl = document.getElementById('cart-total');
    if (totalEl) totalEl.textContent = '£' + getCartTotal().toFixed(2);
}

/* ═══════════════════════════════════════════
   CHECKOUT
════════════════════════════════════════════ */
function goToCheckout() {
    if (cart.length === 0) { showToast('Your basket is empty!'); return; }
    closeCart();
    renderSummary();
    showPage('checkout-page');
}

function backToShop() {
    hidePage('checkout-page');
}

function renderSummary() {
    const el = document.getElementById('summary-items');
    if (!el) return;

    el.innerHTML = cart.map(item => {
        const p = PRODUCTS.find(x => x.id === item.id);
        if (!p) return '';
        return `
      <div class="sum-item">
        <img src="${p.img}" alt="${p.name}" onerror="this.src='https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg?auto=compress&cs=tinysrgb&w=600'"/>
        <div class="sum-item-info">
          <div class="sum-item-name">${p.name}</div>
          <div class="sum-item-qty">Qty: ${item.qty}</div>
        </div>
        <span class="sum-item-price">£${(p.price * item.qty).toFixed(2)}</span>
      </div>
    `;
    }).join('');

    const total = getCartTotal();
    const subEl = document.getElementById('sum-sub');
    const grandEl = document.getElementById('sum-grand');
    if (subEl) subEl.textContent = '£' + total.toFixed(2);
    if (grandEl) grandEl.textContent = '£' + total.toFixed(2);
}

/* ── Form helpers ── */
function fmtCard(input) {
    var v = input.value.replace(/\D/g, '').slice(0, 16);
    var parts = v.match(/.{1,4}/g);
    input.value = parts ? parts.join(' ') : v;
}

function fmtExp(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    input.value = v;
}

function validateCheckout() {
    const fields = [
        { id: 'f-fn', label: 'First Name' },
        { id: 'f-ln', label: 'Last Name' },
        { id: 'f-email', label: 'Email' },
        { id: 'f-phone', label: 'Phone' },
        { id: 'f-addr', label: 'Address' },
        { id: 'f-city', label: 'City' },
        { id: 'f-post', label: 'Postcode' },
        { id: 'f-cn', label: 'Card Name' },
        { id: 'f-cnum', label: 'Card Number' },
        { id: 'f-exp', label: 'Expiry' },
        { id: 'f-cvv', label: 'CVV' }
    ];

    let valid = true;
    fields.forEach(f => {
        const el = document.getElementById(f.id);
        if (!el) return;
        const empty = !el.value.trim();
        el.classList.toggle('err', empty);
        if (empty) valid = false;
    });

    const email = document.getElementById('f-email');
    if (email && email.value && !email.value.includes('@')) {
        email.classList.add('err');
        valid = false;
    }
    const cnum = document.getElementById('f-cnum');
    if (cnum && cnum.value.replace(/\s/g, '').length < 16) {
        cnum.classList.add('err');
        valid = false;
    }

    if (!valid) showToast('Please fill in all required fields correctly.');
    return valid;
}

function placeOrder() {
    if (!validateCheckout()) return;

    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    const firstName = document.getElementById('f-fn').value.trim();
    const lastName = document.getElementById('f-ln').value.trim();
    const name = firstName + ' ' + lastName;

    const orderPayload = {
        user_id: user ? user.user_id : null,
        address: {
            line: document.getElementById('f-addr').value.trim(),
            city: document.getElementById('f-city').value.trim(),
            postcode: document.getElementById('f-post').value.trim()
        },
        items: cart.map(item => {
            const p = PRODUCTS.find(x => x.id === item.id);
            return {
                variant_id: item.id,
                name: p.name,
                qty: item.qty,
                price: p.price
            };
        }),
        subtotal: getCartTotal(),
        total_amount: getCartTotal(),
        payment_method: 'card'
    };

    fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : ''
            },
            body: JSON.stringify(orderPayload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showToast('Order failed: ' + data.error);
                return;
            }

            // Show confirmation page
            document.getElementById('conf-name').textContent = name;
            document.getElementById('conf-ref').textContent = data.ref;
            document.getElementById('conf-items').innerHTML = cart.map(item => {
                const p = PRODUCTS.find(x => x.id === item.id);
                return `
                <div class="conf-item">
                    <span class="conf-name">${p.name} × ${item.qty}</span>
                    <span class="conf-price">£${(p.price * item.qty).toFixed(2)}</span>
                </div>
            `;
            }).join('') + `
            <div class="conf-item" style="font-weight:600;margin-top:.3rem">
                <span>Total</span>
                <span>£${getCartTotal().toFixed(2)}</span>
            </div>
        `;

            // Clear cart
            cart = [];
            saveCart();
            updateCartUI();

            hidePage('checkout-page');
            showPage('confirm-page');
        })
        .catch(() => {
            showToast('Could not connect to server. Please try again.');
        });
}

function continueShopping() {
    hidePage('confirm-page');
    renderProducts();
}

/* ═══════════════════════════════════════════
   PAGE SHOW / HIDE
════════════════════════════════════════════ */
function showPage(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'block';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('open'));
    });
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
}

function hidePage(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    setTimeout(() => { el.style.display = 'none'; }, 300);
    document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════
   TOAST
════════════════════════════════════════════ */
let toastTimer = null;

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}