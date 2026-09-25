'use strict';
// =============================================================
// workshop.js — Crafting workshop UI (Phase 5)
// Timed smithing, cooking, and construction jobs.
// =============================================================

const WORKSHOP = (() => {

  let _activeTab = 'smithing';
  let _pendingRecipeId = null;

  function open(tab) {
    if (tab) _activeTab = tab;
    _render();
    const overlay = document.getElementById('overlay-workshop');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    SFX.uiClick();
  }

  function close() {
    _pendingRecipeId = null;
    const overlay = document.getElementById('overlay-workshop');
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  function refreshIfOpen() {
    if (!document.getElementById('overlay-workshop')?.classList.contains('visible')) return;
    _render();
  }

  function _switchTab(tab) {
    _activeTab = tab;
    _render();
    SFX.uiClick();
  }

  function _render() {
    const body = document.getElementById('workshop-body');
    if (!body) return;

    document.querySelectorAll('.workshop-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === _activeTab);
    });

    const jobsHTML = _renderActiveJobs();
    const recipesHTML = _renderRecipes(_activeTab);

    body.innerHTML = `
      <div class="workshop-jobs-section">
        <h3 class="workshop-section-label">⏱ Active Jobs</h3>
        ${jobsHTML}
      </div>
      <div class="workshop-recipes-section">
        <h3 class="workshop-section-label">📜 Recipes</h3>
        ${recipesHTML}
      </div>`;

    body.querySelectorAll('.btn-start-craft').forEach(btn => {
      btn.addEventListener('click', () => _openCrafterPicker(btn.dataset.recipe));
    });
    body.querySelectorAll('.btn-cancel-craft').forEach(btn => {
      btn.addEventListener('click', () => {
        CRAFTING.cancel(btn.dataset.job);
        _render();
        SFX.uiClick();
      });
    });
  }

  function _renderActiveJobs() {
    const active = CRAFTING.getActive();
    if (!active.length) {
      return '<div class="workshop-empty">No active crafting jobs.</div>';
    }
    return active.map(j => {
      const c = CHARACTER_DEFINITIONS[j.charId];
      const r = CRAFT_RECIPE_DEFINITIONS[j.recipeId];
      const rem = CRAFTING.formatDuration(CRAFTING.getRemainingMs(j));
      return `
        <div class="workshop-job-row">
          <span>${c?.icon || '●'} ${c?.displayName || j.charId}</span>
          <span>→ ${r?.icon || ''} ${r?.displayName || j.recipeId}</span>
          <span class="workshop-job-time">⏱ ${rem}</span>
          <button type="button" class="btn btn-ghost btn-xs btn-cancel-craft" data-job="${j.id}">Cancel</button>
        </div>`;
    }).join('');
  }

  function _renderRecipes(skillType) {
    const recipes = CRAFTING.getRecipesForSkill(skillType);
    if (!recipes.length) return '<div class="workshop-empty">No recipes for this skill.</div>';

    return recipes.map(recipe => {
      const unlocked = isRecipeUnlocked(recipe.id);
      const skillName = SKILL_DEFINITIONS[recipe.skillType]?.displayName || recipe.skillType;
      const costParts = Object.entries(recipe.resources || {}).map(([rid, qty]) => {
        const r = RESOURCE_DEFINITIONS[rid];
        const have = PLAYER_DATA.resources[rid] || 0;
        return `<span class="${have >= qty ? '' : 'cost-unmet'}">${r?.icon || ''} ${qty}</span>`;
      }).join(' · ');
      const lockNote = !unlocked && recipe.requiredStructureId
        ? `<div class="workshop-recipe-lock">Requires ${STRUCTURE_DEFINITIONS[recipe.requiredStructureId]?.displayName || recipe.requiredStructureId}</div>`
        : '';
      const outputLabel = recipe.outputType === 'structure'
        ? STRUCTURE_DEFINITIONS[recipe.structureId]?.displayName
        : recipe.outputType === 'food'
          ? FOOD_DEFINITIONS[recipe.outputId]?.displayName
          : ITEM_DEFINITIONS[recipe.outputId]?.displayName;

      return `
        <div class="workshop-recipe-card ${unlocked ? '' : 'workshop-recipe-locked'}">
          <div class="workshop-recipe-head">
            <span class="workshop-recipe-icon">${recipe.icon}</span>
            <div>
              <div class="workshop-recipe-name">${recipe.displayName}</div>
              <div class="workshop-recipe-meta">${skillName} Lv.${recipe.requiredSkillLevel}+ · ${recipe.durationSeconds}s · +${recipe.xpReward} XP</div>
            </div>
          </div>
          <div class="workshop-recipe-cost">${costParts}</div>
          <div class="workshop-recipe-output">→ ${outputLabel || recipe.outputId}</div>
          ${lockNote}
          <button type="button" class="btn btn-sm btn-start-craft" data-recipe="${recipe.id}"
            ${unlocked ? '' : 'disabled'}>Assign Hero</button>
        </div>`;
    }).join('');
  }

  function _openCrafterPicker(recipeId) {
    _pendingRecipeId = recipeId;
    const recipe = CRAFT_RECIPE_DEFINITIONS[recipeId];
    const overlay = document.getElementById('overlay-craft-picker');
    const title   = document.getElementById('craft-picker-title');
    const list    = document.getElementById('craft-picker-list');
    if (!recipe || !overlay || !list) return;

    if (title) title.textContent = `Craft ${recipe.displayName}`;

    const chars = Object.values(CHARACTER_DEFINITIONS)
      .filter(c => Unlock.isCharacterUnlocked(c.id));

    list.innerHTML = chars.map(c => {
      const status = getCharacterStatus(c.id);
      const skillLevel = PLAYER_DATA.characters[c.id]?.skills[recipe.skillType]?.level || 1;
      const check = CRAFTING.canStart(c.id, recipeId);
      let reason = '';
      if (status === 'active') reason = 'On battle team';
      else if (status === 'assigned') reason = 'Gathering assignment';
      else if (status === 'crafting') reason = 'Already crafting';
      else if (!check.ok) reason = check.reason;

      const ready = status === 'idle' && check.ok;
      return `
        <div class="assignment-char-row ${ready ? '' : 'assignment-char-disabled'}">
          <span class="assignment-char-icon" style="color:${c.color}">${c.icon}</span>
          <div class="assignment-char-info">
            <div class="assignment-char-name">${c.displayName}</div>
            <div class="assignment-char-meta">
              ${SKILL_DEFINITIONS[recipe.skillType]?.displayName || recipe.skillType} Lv.${skillLevel} · ${recipe.durationSeconds}s
            </div>
            ${!ready ? `<div class="assignment-char-reason">${reason}</div>` : ''}
          </div>
          <button type="button" class="btn btn-sm btn-assign-crafter" data-char="${c.id}"
            ${ready ? '' : 'disabled'}>Start</button>
        </div>`;
    }).join('');

    list.querySelectorAll('.btn-assign-crafter').forEach(btn => {
      btn.addEventListener('click', () => {
        const result = CRAFTING.start(btn.dataset.char, recipeId);
        if (!result.ok) {
          MAP.showUnlockToast(result.reason || 'Cannot start job.');
          return;
        }
        SFX.uiClick();
        const recipeId = _pendingRecipeId;
        const recipe = CRAFT_RECIPE_DEFINITIONS[recipeId];
        _closeCrafterPicker();
        _render();
        MAP.refresh();
        const c = CHARACTER_DEFINITIONS[btn.dataset.char];
        const verb = recipe?.outputType === 'structure' ? 'started building' : 'started crafting';
        MAP.showUnlockToast(`🔨 ${c?.displayName || btn.dataset.char} ${verb}!`);
      });
    });

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  function _closeCrafterPicker() {
    _pendingRecipeId = null;
    const overlay = document.getElementById('overlay-craft-picker');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  function init() {
    document.getElementById('btn-workshop-open')?.addEventListener('click', () => open());
    document.getElementById('btn-workshop-close')?.addEventListener('click', close);
    document.getElementById('overlay-workshop')?.addEventListener('click', e => {
      if (e.target.id === 'overlay-workshop') close();
    });
    document.getElementById('btn-craft-picker-close')?.addEventListener('click', _closeCrafterPicker);
    document.getElementById('overlay-craft-picker')?.addEventListener('click', e => {
      if (e.target.id === 'overlay-craft-picker') _closeCrafterPicker();
    });
    document.querySelectorAll('.workshop-tab').forEach(btn => {
      btn.addEventListener('click', () => _switchTab(btn.dataset.tab));
    });
  }

  return {
    init, open, close, refreshIfOpen, _switchTab,
    openCrafterPickerForRecipe: _openCrafterPicker,
  };
})();
