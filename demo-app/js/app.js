// QuickBite POS/Kiosk demo app — shared client-side logic.
// This is a deliberately small, dependency-free vanilla-JS app whose only
// purpose is to give the AI-Augmented Playwright Test Suite a realistic,
// self-hosted, multi-market target to drive. It is NOT production code.

const STORAGE_KEYS = {
  session: 'qb_session',
  cart: 'qb_cart',
};

function qs(param, fallback = null) {
  const url = new URL(window.location.href);
  return url.searchParams.get(param) ?? fallback;
}

function getMarket() {
  return qs('market', localStorage.getItem('qb_market') || 'US').toUpperCase();
}

function setMarket(market) {
  localStorage.setItem('qb_market', market);
}

function getDaypart() {
  // Testable override via ?daypart=breakfast|allday, otherwise derived from
  // the system clock (05:00-11:00 local time = breakfast).
  const override = qs('daypart');
  if (override === 'breakfast' || override === 'allday') return override;
  const hour = new Date().getHours();
  return hour >= 5 && hour < 11 ? 'breakfast' : 'allday';
}

function comboFlagEnabled() {
  return qs('ff_combo', 'false') === 'true';
}

async function loadMenuData() {
  const res = await fetch('/data/menu.json');
  return res.json();
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.cart) || '[]');
  } catch {
    return [];
  }
}

function setCart(cart) {
  localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart));
}

function addToCart(item) {
  const cart = getCart();
  const existing = cart.find((line) => line.id === item.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  setCart(cart);
  return cart;
}

function cartTotal(cart) {
  return cart.reduce((sum, line) => sum + line.price * line.qty, 0);
}

function formatMoney(amount, currency) {
  return `${currency}${amount.toFixed(2)}`;
}

function requireSession() {
  const session = localStorage.getItem(STORAGE_KEYS.session);
  if (!session) {
    window.location.href = `/index.html?market=${getMarket()}`;
  }
  return session;
}

function login(storeId, pin) {
  // Deterministic demo auth: any 4-digit PIN paired with a non-empty store
  // ID succeeds. This mirrors a POS attendant login without needing a
  // backend for the demo.
  if (!storeId || !/^[0-9]{4}$/.test(pin)) {
    return { ok: false, error: 'Enter a valid Store ID and 4-digit PIN.' };
  }
  const session = { storeId, loggedInAt: Date.now() };
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  return { ok: true, session };
}

function placeOrder(cart, paymentMethod) {
  const orderNumber = `QB-${Math.floor(100000 + Math.random() * 900000)}`;
  const order = {
    orderNumber,
    items: cart,
    total: cartTotal(cart),
    paymentMethod,
    placedAt: new Date().toISOString(),
  };
  localStorage.setItem('qb_last_order', JSON.stringify(order));
  setCart([]);
  return order;
}

window.QuickBite = {
  getMarket,
  setMarket,
  getDaypart,
  comboFlagEnabled,
  loadMenuData,
  getCart,
  setCart,
  addToCart,
  cartTotal,
  formatMoney,
  requireSession,
  login,
  placeOrder,
};