'use strict';
// =============================================================
// cooking.js — COOKING module
// Converts raw fish into healing food using the Cooking skill.
// Accessed via the Cooking tab inside the Gather screen.
// =============================================================

const COOKING = (() => {

  // ── Open ──────────────────────────────────────────────────────
  function open() {
    _render();
    // Switch gather screen to cooking tab
    document.querySelectorAll('.gather-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === 'cooking')
    );
    document.querySelectorAll('.gather-panel').forEach(p =>
      p.classList.toggle('gather-panel-active', p.id === 'gather-panel-cooking')
    );
  }

  // ── Cook one item ─────────────────────────────────────────────
  function cook(foodId) {
    const recipe = FOOD_DEFINITIONS[foodId];
    if (!recipe) return;

    // Check skill level requirement
    const cookingLevel = _teamCookingLevel();
    if (cookingLevel < recipe.cookingReq) {
      _showFeedback(`Need Cooking Lv.${recipe.cookingReq} to cook ${recipe.displayName}.`, 'error');
      return;
    }

    // Check ingredient
    const resources = PLAYER_DATA.resources || {};
    if (!resources[recipe.ingredient] || resources[recipe.ingredient] < 1) {
      const ingDef = RESOURCE_DEFINITIONS[recipe.ingredient];
      _showFeedback(`No ${ingDef?.displayName || recipe.ingredient} to cook!`, 'error');
      return;
    }

    // Consume ingredient
    PLAYER_DATA.resources[recipe.ingredient]--;

    // Add food
    addFood(foodId, 1);

    // Award cooking XP
    const levelUps = awardGatheringXp('cooking', recipe.xpPerCook);

    // Feedback
    _showFeedback(`${recipe.icon} Cooked ${recipe.displayName}! +${recipe.xpPerCook} Cooking XP`, 'success');
    Object.entries(levelUps).forEach(([charId, { newLevel }]) => {
      const def = CHARACTER_DEFINITIONS[charId];
      _showFeedback(`⬆️ ${def.displayName}: Cooking → Lv.${newLevel}!`, 'levelup');
      SFX.levelUp();
    });

    SFX.heal();
    SaveManager.write();
    _render();
  }

  // ── Cook many at once ─────────────────────────────────────────
  function cookAll(foodId) {
    const recipe    = FOOD_DEFINITIONS[foodId];
    if (!recipe) return;
    const resources = PLAYER_DATA.resources || {};
    const qty       = resources[recipe.ingredient] || 0;
    if (qty === 0) return;
    for (let i = 0; i < qty; i++) cook(foodId);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _teamCookingLevel() {
    if (!PLAYER_DATA.team.length) return 1;
    const sum = PLAYER_DATA.team.reduce((acc, charId) => {
      return acc + (PLAYER_DATA.characters[charId].skills.cooking?.level || 1);
    }, 0);
    return Math.floor(sum / PLAYER_DATA.team.length);
  }

  let _feedbackTimer = null;
  function _showFeedback(msg, type = 'success') {
    const el = document.getElementById('cooking-feedback');
    if (!el) return;
    el.textContent = msg;
    el.className   = `cooking-feedback cooking-feedback-${type} cooking-feedback-visible`;
    clearTimeout(_feedbackTimer);
    _feedbackTimer = setTimeout(() => el.classList.remove('cooking-feedback-visible'), 2500);
  }

  // ── Render ────────────────────────────────────────────────────
  function _render() {
    _renderRecipes();
    _renderFoodInventory();
    _renderCookingSkill();
  }

  function _renderRecipes() {
    const container = document.getElementById('cooking-recipes');
    if (!container) return;

    const cookingLevel = _teamCookingLevel();
    const resources    = PLAYER_DATA.resources || {};

    container.innerHTML = Object.values(FOOD_DEFINITIONS).map(recipe => {
      const ingDef   = RESOURCE_DEFINITIONS[recipe.ingredient];
      const ingQty   = resources[recipe.ingredient] || 0;
      const locked   = cookingLevel < recipe.cookingReq;
      const canCook  = !locked && ingQty > 0;

      return `
        <div class="recipe-card ${locked ? 'recipe-locked' : ''}">
          <div class="recipe-top">
            <span class="recipe-icon">${recipe.icon}</span>
            <div class="recipe-info">
              <div class="recipe-name">${recipe.displayName}</div>
              <div class="recipe-heal">${recipe.buffType
                ? `✨ +${recipe.buffAmount} ${recipe.buffType.toUpperCase()} for ${recipe.buffTurns} turns`
                : `💚 Heals ${recipe.healAmount} HP`}</div>
              <div class="recipe-req ${locked ? 'req-unmet' : 'req-met'}">
                🍳 Cooking Lv.${recipe.cookingReq} ${locked ? `(you: ${cookingLevel})` : '✓'}
              </div>
            </div>
          </div>
          <div class="recipe-ingredient">
            ${ingDef ? `${ingDef.icon} ${ingDef.displayName}: ` : ''}
            <strong class="${ingQty > 0 ? 'ing-have' : 'ing-none'}">${ingQty} available</strong>
          </div>
          <div class="recipe-actions">
            <button class="btn btn-cook" data-food="${recipe.id}" ${canCook ? '' : 'disabled'}>Cook 1</button>
            <button class="btn btn-cook-all" data-food="${recipe.id}" ${canCook ? '' : 'disabled'}>Cook All (${ingQty})</button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-cook').forEach(btn => {
      btn.addEventListener('click', () => cook(btn.dataset.food));
    });
    container.querySelectorAll('.btn-cook-all').forEach(btn => {
      btn.addEventListener('click', () => cookAll(btn.dataset.food));
    });
  }

  function _renderFoodInventory() {
    const container = document.getElementById('cooking-food-inventory');
    if (!container) return;

    const food  = PLAYER_DATA.food || {};
    const owned = Object.values(FOOD_DEFINITIONS).filter(f => food[f.id] > 0);

    if (!owned.length) {
      container.innerHTML = '<div class="gather-empty">No food yet — cook some fish!</div>';
      return;
    }

    container.innerHTML = owned.map(f => `
      <div class="food-chip">
        <span>${f.icon}</span>
        <span>${f.displayName}</span>
        <span class="food-chip-heal">+${f.healAmount} HP</span>
        <span class="food-chip-qty">×${food[f.id]}</span>
      </div>`
    ).join('');
  }

  function _renderCookingSkill() {
    const container = document.getElementById('cooking-skill-bars');
    if (!container) return;

    const skDef = SKILL_DEFINITIONS['cooking'];

    container.innerHTML = PLAYER_DATA.team.map(charId => {
      const def  = CHARACTER_DEFINITIONS[charId];
      const sk   = PLAYER_DATA.characters[charId].skills.cooking;
      const pct  = xpProgressPct(sk.xp, sk.level).toFixed(1);
      const now  = sk.xp - xpToLevel(sk.level);
      const next = xpForNextLevel(sk.level);

      return `
        <div class="gather-skill-row">
          <span class="gsr-icon">${def.icon}</span>
          <div class="gsr-body">
            <div class="gsr-name-line">
              <span class="gsr-name">${def.displayName}</span>
              <span class="gsr-level" style="color:${skDef.color}">${skDef.icon} Cooking Lv.${sk.level}</span>
            </div>
            <div class="gsr-track">
              <div class="gsr-fill" style="width:${pct}%;background:${skDef.color}"></div>
            </div>
            <div class="gsr-xp-text">${sk.level >= 99 ? 'MAX' : `${now} / ${next} XP`}</div>
          </div>
        </div>`;
    }).join('');
  }

  function init() {}

  return { init, open, cook, cookAll };
})();
