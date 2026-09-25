'use strict';
// =============================================================
// shop.js — SHOP module
// Gold-based store for food and gear.
// Accessible via the 🛒 button on the map header.
// =============================================================

const SHOP = (() => {

  // ── Open / Close ──────────────────────────────────────────────
  function open() {
    _render();
    const overlay = document.getElementById('overlay-shop');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    SFX.uiClick();
  }

  function close() {
    const overlay = document.getElementById('overlay-shop');
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  // ── Buy action ────────────────────────────────────────────────
  function buy(shopItemId, qty = 1) {
    const shopItem = SHOP_ITEMS.find(s => s.id === shopItemId);
    if (!shopItem) return;

    const totalCost = shopItem.cost * qty;
    if (PLAYER_DATA.gold < totalCost) {
      _showFeedback(`Not enough gold! Need ${totalCost} ◈, have ${PLAYER_DATA.gold} ◈.`, 'error');
      return;
    }

    // Deduct gold
    PLAYER_DATA.gold -= totalCost;

    // Grant item to correct inventory
    if (shopItem.type === 'food') {
      addFood(shopItem.grantId, qty);
    } else {
      if (!PLAYER_DATA.ownedItems) PLAYER_DATA.ownedItems = {};
      PLAYER_DATA.ownedItems[shopItem.grantId] =
        (PLAYER_DATA.ownedItems[shopItem.grantId] || 0) + qty;
    }

    _showFeedback(`Purchased ${qty}× ${shopItem.displayName} for ${totalCost} ◈!`, 'success');
    SFX.itemDrop();
    SaveManager.write();

    // Refresh gold on map header
    MAP.refresh();
    _render();
  }

  // ── Render ────────────────────────────────────────────────────
  function _render() {
    _renderGold();
    _renderItems();
  }

  function _renderGold() {
    const el = document.getElementById('shop-gold');
    if (el) el.textContent = `◈ ${PLAYER_DATA.gold} Gold`;
  }

  function _renderItems() {
    const container = document.getElementById('shop-items');
    if (!container) return;

    const gold = PLAYER_DATA.gold;

    container.innerHTML = SHOP_ITEMS.map(shopItem => {
      const canAfford = gold >= shopItem.cost;
      const isFood    = shopItem.type === 'food';
      const qty5Cost  = shopItem.cost * 5;
      const can5      = gold >= qty5Cost;

      // Show current owned qty
      let owned = 0;
      if (isFood) {
        owned = (PLAYER_DATA.food || {})[shopItem.grantId] || 0;
      } else {
        owned = (PLAYER_DATA.ownedItems || {})[shopItem.grantId] || 0;
      }

      const statInfo = isFood
        ? `💚 Heals ${FOOD_DEFINITIONS[shopItem.grantId]?.healAmount ?? '?'} HP`
        : (() => {
            const item = ITEM_DEFINITIONS[shopItem.grantId];
            if (!item) return '';
            const label = { hp: '+HP', attack: '+ATK', defense: '+DEF', speed: '+SPD' }[item.statModified] || '';
            return `${label} ${item.statAmount}`;
          })();

      return `
        <div class="shop-card ${isFood ? 'shop-card-food' : 'shop-card-gear'}">
          <div class="shop-card-top">
            <span class="shop-icon">${shopItem.icon}</span>
            <div class="shop-info">
              <div class="shop-name">${shopItem.displayName}</div>
              <div class="shop-stat">${statInfo}</div>
              <div class="shop-desc">${shopItem.description}</div>
              ${owned > 0 ? `<div class="shop-owned">Owned: ${owned}</div>` : ''}
            </div>
            <div class="shop-price-col">
              <div class="shop-price ${canAfford ? '' : 'price-cant'}">◈ ${shopItem.cost}</div>
            </div>
          </div>
          <div class="shop-actions">
            <button class="btn btn-buy" data-id="${shopItem.id}" data-qty="1"
              ${canAfford ? '' : 'disabled'}>Buy 1</button>
            ${isFood ? `<button class="btn btn-buy btn-buy-5" data-id="${shopItem.id}" data-qty="5"
              ${can5 ? '' : 'disabled'}>Buy 5 (◈${qty5Cost})</button>` : ''}
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-buy').forEach(btn => {
      btn.addEventListener('click', () => buy(btn.dataset.id, Number(btn.dataset.qty)));
    });
  }

  let _feedbackTimer = null;
  function _showFeedback(msg, type = 'success') {
    const el = document.getElementById('shop-feedback');
    if (!el) return;
    el.textContent = msg;
    el.className   = `cooking-feedback cooking-feedback-${type} cooking-feedback-visible`;
    clearTimeout(_feedbackTimer);
    _feedbackTimer = setTimeout(() => el.classList.remove('cooking-feedback-visible'), 2500);
  }

  function init() {
    document.getElementById('btn-shop-open')?.addEventListener('click', open);
    document.getElementById('btn-shop-close')?.addEventListener('click', close);
  }

  return { init, open, close, buy };
})();
