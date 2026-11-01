const loginView = document.querySelector('#login-view');
const dashboardView = document.querySelector('#dashboard-view');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const dashboardMessage = document.querySelector('#dashboard-message');
const itemForm = document.querySelector('#item-form');
const itemMessage = document.querySelector('#item-message');
const ordersList = document.querySelector('#orders-list');
const itemsList = document.querySelector('#items-list');
const itemFormTitle = document.querySelector('#item-form-title');
const saveItemButton = document.querySelector('#save-item-button');
const cancelEditButton = document.querySelector('#cancel-edit');
const money = (cents) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(result?.error || 'Something went wrong.');
  return result;
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  loadDashboard();
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderOrders(orders) {
  document.querySelector('#order-count').textContent = String(orders.filter((order) => order.status === 'new').length);
  ordersList.replaceChildren();
  if (!orders.length) {
    ordersList.append(makeElement('p', 'empty-message', 'No orders just yet. New requests will show up here.'));
    return;
  }
  for (const order of orders) {
    const row = makeElement('article', 'order-row');
    const customer = makeElement('div');
    customer.append(makeElement('div', 'order-customer', order.customerName));
    customer.append(makeElement('div', 'order-subtext', order.phone));
    customer.append(makeElement('div', 'order-subtext', `Pickup · ${order.pickupDate}`));
    const dishes = makeElement('div', 'order-dishes');
    for (const item of order.items) dishes.append(makeElement('span', '', `${item.quantity} × ${item.name}`));
    dishes.append(makeElement('span', 'order-total', `Total · ${money(order.totalCents)}`));
    if (order.notes) dishes.append(makeElement('span', 'order-subtext', `Note · ${order.notes}`));
    const controls = makeElement('div', 'order-controls');
    const status = document.createElement('select');
    status.setAttribute('aria-label', `Status for ${order.customerName}'s order`);
    for (const value of ['new', 'confirmed', 'ready', 'completed', 'cancelled']) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value[0].toUpperCase() + value.slice(1);
      status.append(option);
    }
    status.value = order.status;
    status.addEventListener('change', async () => {
      try {
        await api(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
          method: 'PATCH', body: JSON.stringify({ status: status.value }),
        });
        dashboardMessage.hidden = true;
        await loadDashboard();
      } catch (error) {
        dashboardMessage.hidden = false;
        dashboardMessage.textContent = error.message;
      }
    });
    controls.append(status, makeElement('span', 'order-date', new Date(order.createdAt).toLocaleString()));
    row.append(customer, dishes, makeElement('span', 'order-subtext', `#${order.id.slice(0, 8)}`), controls);
    ordersList.append(row);
  }
}

function renderItems(items) {
  itemsList.replaceChildren();
  if (!items.length) {
    itemsList.append(makeElement('p', 'empty-message', 'Your menu is empty. Add your first dish above.'));
    return;
  }
  for (const item of items) {
    const row = makeElement('article', 'managed-item');
    const image = document.createElement('img');
    image.src = item.imageUrl || '';
    image.alt = '';
    image.loading = 'lazy';
    const details = makeElement('div');
    details.append(makeElement('h3', '', item.name));
    details.append(makeElement('p', '', `${item.category} · ${money(item.priceCents)}${item.description ? ` · ${item.description}` : ''}`));
    const actions = makeElement('div', 'managed-item-actions');
    const edit = makeElement('button', 'text-button', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', () => beginEdit(item));
    const toggle = makeElement('button', `availability-button${item.available ? '' : ' is-unavailable'}`, item.available ? 'On menu' : 'Hidden');
    toggle.type = 'button';
    toggle.addEventListener('click', async () => {
      try {
        await api(`/api/admin/menu/${encodeURIComponent(item.id)}`, {
          method: 'PATCH', body: JSON.stringify({ available: !item.available }),
        });
        await loadDashboard();
      } catch (error) {
        dashboardMessage.hidden = false;
        dashboardMessage.textContent = error.message;
      }
    });
    actions.append(edit, toggle);
    row.append(image, details, actions);
    itemsList.append(row);
  }
}

async function loadDashboard() {
  try {
    const [data, items] = await Promise.all([
      api('/api/admin/dashboard'),
      api('/api/admin/menu'),
    ]);
    renderOrders(data.orders);
    renderItems(items);
  } catch (error) {
    if (error.message.includes('Sign in')) return showLogin();
    dashboardMessage.hidden = false;
    dashboardMessage.textContent = error.message;
  }
}

function beginEdit(item) {
  itemForm.elements.id.value = item.id;
  itemForm.elements.name.value = item.name;
  itemForm.elements.category.value = item.category;
  itemForm.elements.price.value = (item.priceCents / 100).toFixed(2);
  itemForm.elements.imageUrl.value = item.imageUrl || '';
  itemForm.elements.image.value = '';
  itemForm.elements.description.value = item.description || '';
  itemFormTitle.textContent = 'Edit menu item';
  saveItemButton.innerHTML = 'Save changes <span aria-hidden="true">→</span>';
  cancelEditButton.hidden = false;
  itemForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetItemForm() {
  itemForm.reset();
  itemForm.elements.id.value = '';
  itemFormTitle.textContent = 'Add to the menu';
  saveItemButton.innerHTML = 'Add menu item <span aria-hidden="true">+</span>';
  cancelEditButton.hidden = true;
  itemMessage.textContent = '';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';
  try {
    await api('/api/admin/login', {
      method: 'POST', body: JSON.stringify({ password: new FormData(loginForm).get('password') }),
    });
    loginForm.reset();
    showDashboard();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST', body: '{}' });
  showLogin();
});

cancelEditButton.addEventListener('click', resetItemForm);

itemForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  itemMessage.textContent = '';
  const formData = new FormData(itemForm);
  const id = formData.get('id');
  const item = Object.fromEntries(['name', 'category', 'price', 'imageUrl', 'description'].map((key) => [key, formData.get(key)]));
  const image = formData.get('image');
  if (!id && (!(image instanceof File) || image.size === 0)) {
    itemMessage.textContent = 'Upload a photo for the new menu item.';
    return;
  }
  if (image instanceof File && image.size > 5 * 1024 * 1024) {
    itemMessage.textContent = 'Photo must be 5 MB or smaller.';
    return;
  }
  saveItemButton.disabled = true;
  try {
    if (image instanceof File && image.size > 0) {
      const uploadData = new FormData();
      uploadData.append('image', image);
      const uploaded = await api('/api/admin/menu/image', { method: 'POST', body: uploadData });
      item.imageUrl = uploaded.imageUrl;
    }
    await api(id ? `/api/admin/menu/${encodeURIComponent(id)}` : '/api/admin/menu', {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(item),
    });
    resetItemForm();
    dashboardMessage.hidden = false;
    dashboardMessage.textContent = id ? 'Menu item updated.' : 'Menu item added.';
    await loadDashboard();
  } catch (error) {
    itemMessage.textContent = error.message;
  } finally {
    saveItemButton.disabled = false;
  }
});

api('/api/admin/session').then(({ authenticated }) => authenticated ? showDashboard() : showLogin()).catch(showLogin);