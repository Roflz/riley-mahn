'use strict';
// =============================================================
// smithing.js — SMITHING module
// Converts ore into weapons and armour via the Smithing skill.
// Accessible as the third tab in the Gather screen.
// =============================================================

const SMITHING = (() => {

  // ── Open ──────────────────────────────────────────────────────
  function open() {
    _render();
  }

  // ── Forge action ─────────────────────────────────────────────
  function forge(recipeId) {
    const recipe = SMITHING_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    const smithingLevel = _teamSmithingLevel();
    if (smithingLevel < recipe.smithingReq) {
      _showFeedback(`Need Smithing Lv.${recipe.smithingReq} to forge this.`, 'error');
      return;
    }

    const resources = PLAYER_DATA.resources || {};
    if ((resources[recipe.ingredient] || 0) < recipe.ingredientQty) {
      const ingDef = RESOURCE_DEFINITIONS[recipe.ingredient];
      _showFeedback(
        `Need ${recipe.ingredientQty}× ${ingDef?.displayName || recipe.ingredient}. ` +
        `You have ${resources[recipe.ingredient] || 0}.`,
        'error'
      );
      return;
    }

    // Consume ore
    PLAYER_DATA.resources[recipe.ingredient] -= recipe.ingredientQty;

    // Add to item inventory (quantity-based, same as drops)
    if (!PLAYER_DATA.ownedItems) PLAYER_DATA.ownedItems = {};
    PLAYER_DATA.ownedItems[recipe.outputId] = (PLAYER_DATA.ownedItems[recipe.outputId] || 0) + 1;

    // Award smithing XP
    const levelUps = awardGatheringXp('smithing', recipe.xpPerSmith);

    const item = ITEM_DEFINITIONS[recipe.outputId];
    _showFeedback(`${item.icon} Forged ${item.displayName}! +${recipe.xpPerSmith} Smithing XP`, 'success');

    Object.entries(levelUps).forEach(([charId, { newLevel }]) => {
      const def = CHARACTER_DEFINITIONS[charId];
      _showFeedback(`⬆️ ${def.displayName}: Smithing → Lv.${newLevel}!`, 'levelup');
      SFX.levelUp();
    });

    SFX.heavyAttack();  // satisfying forge sound
    SaveManager.write();
    _render();
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _teamSmithingLevel() {
    if (!PLAYER_DATA.team.length) return 1;
    const sum = PLAYER_DATA.team.reduce((acc, charId) => {
      return acc + (PLAYER_DATA.characters[charId].skills.smithing?.level || 1);
    }, 0);
    return Math.floor(sum / PLAYER_DATA.team.length);
  }

  let _feedbackTimer = null;
  function _showFeedback(msg, type = 'success') {
    const el = document.getElementById('smithing-feedback');
    if (!el) return;
    el.textContent = msg;
    el.className   = `cooking-feedback cooking-feedback-${type} cooking-feedback-visible`;
    clearTimeout(_feedbackTimer);
    _feedbackTimer = setTimeout(() => el.classList.remove('cooking-feedback-visible'), 2500);
  }

  // ── Render ────────────────────────────────────────────────────
  function _render() {
    _renderRecipes();
    _renderSmithingSkill();
    _renderCraftedInventory();
  }

  function _renderRecipes() {
    const container = document.getElementById('smithing-recipes');
    if (!container) return;

    const smithingLevel = _teamSmithingLevel();
    const resources     = PLAYER_DATA.resources || {};

    container.innerHTML = SMITHING_RECIPES.map(recipe => {
      const item     = ITEM_DEFINITIONS[recipe.outputId];
      const ingDef   = RESOURCE_DEFINITIONS[recipe.ingredient];
      const ingHave  = resources[recipe.ingredient] || 0;
      const canCraft = ingHave >= recipe.ingredientQty;
      const locked   = smithingLevel < recipe.smithingReq;
      const rarityClass = `rarity-border-${item?.rarity || 'common'}`;

      return `
        <div class="recipe-card smithing-recipe ${locked ? 'recipe-locked' : ''} ${rarityClass}">
          <div class="recipe-top">
            <span class="recipe-icon">${item?.icon || '⚒️'}</span>
            <div class="recipe-info">
              <div class="recipe-name">${item?.displayName || recipe.outputId}</div>
              <div class="recipe-heal" style="color:var(--text-secondary)">${item?.description || ''}</div>
              <div class="recipe-req ${locked ? 'req-unmet' : 'req-met'}">
                🔨 Smithing Lv.${recipe.smithingReq} ${locked ? `(you: ${smithingLevel})` : '✓'}
              </div>
            </div>
          </div>
          <div class="recipe-ingredient">
            ${ingDef ? `${ingDef.icon} ${ingDef.displayName} ×${recipe.ingredientQty}: ` : ''}
            <strong class="${canCraft ? 'ing-have' : 'ing-none'}">${ingHave} available</strong>
          </div>
          <div class="recipe-actions">
            <button class="btn btn-forge" data-recipe="${recipe.id}" ${(!locked && canCraft) ? '' : 'disabled'}>
              ⚒️ Forge
            </button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-forge').forEach(btn => {
      btn.addEventListener('click', () => forge(btn.dataset.recipe));
    });
  }

  function _renderSmithingSkill() {
    const container = document.getElementById('smithing-skill-bars');
    if (!container) return;

    const skDef = SKILL_DEFINITIONS['smithing'];

    container.innerHTML = PLAYER_DATA.team.map(charId => {
      const def  = CHARACTER_DEFINITIONS[charId];
      const sk   = PLAYER_DATA.characters[charId].skills.smithing;
      const pct  = xpProgressPct(sk.xp, sk.level).toFixed(1);
      const now  = sk.xp - xpToLevel(sk.level);
      const next = xpForNextLevel(sk.level);

      return `
        <div class="gather-skill-row">
          <span class="gsr-icon">${def.icon}</span>
          <div class="gsr-body">
            <div class="gsr-name-line">
              <span class="gsr-name">${def.displayName}</span>
              <span class="gsr-level" style="color:${skDef.color}">${skDef.icon} Smithing Lv.${sk.level}</span>
            </div>
            <div class="gsr-track">
              <div class="gsr-fill" style="width:${pct}%;background:${skDef.color}"></div>
            </div>
            <div class="gsr-xp-text">${sk.level >= 99 ? 'MAX' : `${now} / ${next} XP`}</div>
          </div>
        </div>`;
    }).join('');
  }

  function _renderCraftedInventory() {
    const container = document.getElementById('smithing-inventory');
    if (!container) return;

    const owned   = PLAYER_DATA.ownedItems || {};
    const crafted = Object.entries(owned)
      .filter(([id, qty]) => qty > 0 && ITEM_DEFINITIONS[id]?.crafted)
      .map(([id, qty]) => ({ item: ITEM_DEFINITIONS[id], qty }));

    if (!crafted.length) {
      container.innerHTML = '<div class="gather-empty">No crafted items yet.</div>';
      return;
    }

    container.innerHTML = crafted.map(({ item, qty }) => `
      <div class="resource-chip rarity-${item.rarity}">
        <span class="resource-chip-icon">${item.icon}</span>
        <span class="resource-chip-name">${item.displayName}</span>
        <span class="resource-chip-qty">×${qty}</span>
      </div>`
    ).join('');
  }

  function init() {}

  return { init, open, forge };
})();
