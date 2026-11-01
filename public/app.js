const menuGrid = document.querySelector('#menu-grid');
const menuMessage = document.querySelector('#menu-message');
const cartLines = document.querySelector('#cart-lines');
const cartCount = document.querySelector('#cart-count');
const cartTotal = document.querySelector('#cart-total');
const orderForm = document.querySelector('#order-form');
const orderMessage = document.querySelector('#order-message');
const cart = new Map();
const campaignParams = new URLSearchParams(window.location.search);
const campaignSource = campaignParams.get('utm_campaign') || campaignParams.get('utm_source') || '';
let menuItems = [];

const money = (cents) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);

function renderMenu() {
  if (!menuItems.length) {
    menuGrid.innerHTML = '<p class="empty-message">The menu is resting for now. Check back soon.</p>';
    return;
  }
  menuGrid.innerHTML = menuItems.map((item, index) => `
    <article class="menu-card" style="animation-delay:${index * 70}ms">
      <img class="menu-card-photo" src="${escapeHtml(item.imageUrl || '')}" alt="${escapeHtml(item.name)}" loading="lazy">
      <div class="menu-card-body">
        <div class="menu-card-meta"><span>${escapeHtml(item.category)}</span><span>Made fresh</span></div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="menu-card-footer"><span class="menu-price">${money(item.priceCents)}</span>
          <button class="add-button" type="button" data-add="${escapeHtml(item.id)}">Add to order <span aria-hidden="true">+</span></button>
        </div>
      </div>
    </article>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function renderCart() {
  const selected = [...cart.values()];
  const quantity = selected.reduce((total, line) => total + line.quantity, 0);
  cartCount.textContent = `${quantity} ${quantity === 1 ? 'item' : 'items'}`;
  cartTotal.textContent = money(selected.reduce((total, line) => total + line.item.priceCents * line.quantity, 0));
  if (!selected.length) {
    cartLines.innerHTML = '<p class="cart-empty">Your basket is waiting for something good.</p>';
    return;
  }
  cartLines.innerHTML = selected.map(({ item, quantity: count }) => `
    <div class="cart-line"><span class="cart-line-name">${escapeHtml(item.name)}</span>
    <span class="cart-line-qty">${count} × ${money(item.priceCents)}</span>
    <button class="remove-line" type="button" data-remove="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">×</button></div>`).join('');
}

async function loadMenu() {
  try {
    const response = await fetch('/api/menu');
    if (!response.ok) throw new Error('Menu is temporarily unavailable. Please try again.');
    menuItems = await response.json();
    renderMenu();
  } catch (error) {
    menuGrid.innerHTML = '';
    menuMessage.hidden = false;
    menuMessage.textContent = error.message;
  }
}

menuGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add]');
  if (!button) return;
  const item = menuItems.find((candidate) => candidate.id === button.dataset.add);
  if (!item) return;
  const line = cart.get(item.id) ?? { item, quantity: 0 };
  if (line.quantity >= 25) return;
  line.quantity += 1;
  cart.set(item.id, line);
  renderCart();
  orderMessage.textContent = '';
});

cartLines.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  cart.delete(button.dataset.remove);
  renderCart();
});

const pickupDate = orderForm.elements.pickupDate;
pickupDate.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  orderMessage.textContent = '';
  const items = [...cart.values()].map(({ item, quantity }) => ({ id: item.id, quantity }));
  if (!items.length) {
    orderMessage.textContent = 'Add something from the menu before sending your request.';
    return;
  }
  const submitButton = orderForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  const formData = new FormData(orderForm);
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: formData.get('customerName'),
        phone: formData.get('phone'),
        pickupDate: formData.get('pickupDate'),
        notes: formData.get('notes'),
        campaignSource,
        items,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Your request could not be sent.');
    menuMessage.hidden = false;
    menuMessage.textContent = 'Your request is on its way. Nico will be in touch to confirm.';
    orderForm.reset();
    cart.clear();
    renderCart();
    document.querySelector('#menu').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    orderMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

renderCart();
loadMenu();