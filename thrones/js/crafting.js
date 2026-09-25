'use strict';
// =============================================================
// crafting.js — Timed crafting jobs (Phase 5)
// Smithing, cooking, and construction use the same job model.
// Resources consumed at job start; output on completion.
// =============================================================

const CRAFTING = (() => {

  let _tickTimer = null;
  let _onComplete = null;

  function _genId() {
    return 'craft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function getActive() {
    return (PLAYER_DATA.craftingJobs || []).filter(j => !j.isCompleted);
  }

  function isCharacterCrafting(charId) {
    return !!getActiveCraftingJobForCharacter(charId);
  }

  function getRemainingMs(job, nowMs = Date.now()) {
    return Math.max(0, job.endMs - nowMs);
  }

  function formatDuration(ms) {
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  function getRecipesForSkill(skillType) {
    return Object.values(CRAFT_RECIPE_DEFINITIONS).filter(r => r.skillType === skillType);
  }

  function canStart(charId, recipeId) {
    if (!isCharacterAssignable(charId)) {
      return { ok: false, reason: 'Hero is not available (on team, assigned, or already crafting).' };
    }
    const recipe = CRAFT_RECIPE_DEFINITIONS[recipeId];
    if (!recipe) return { ok: false, reason: 'Unknown recipe.' };
    if (!isRecipeUnlocked(recipeId)) {
      const sdef = recipe.requiredStructureId && STRUCTURE_DEFINITIONS[recipe.requiredStructureId];
      return { ok: false, reason: sdef ? `Requires ${sdef.displayName}.` : 'Recipe locked.' };
    }
    const skillLevel = PLAYER_DATA.characters[charId]?.skills[recipe.skillType]?.level || 1;
    if (skillLevel < recipe.requiredSkillLevel) {
      const skName = SKILL_DEFINITIONS[recipe.skillType]?.displayName || recipe.skillType;
      return { ok: false, reason: `Requires ${skName} Lv.${recipe.requiredSkillLevel}.` };
    }
    if (!hasResources(recipe.resources)) {
      return { ok: false, reason: 'Not enough resources.' };
    }
    if (recipe.outputType === 'structure') {
      if (!recipe.buildSiteId) return { ok: false, reason: 'Invalid build recipe.' };
      if (isBuildSiteOccupied(recipe.buildSiteId)) {
        return { ok: false, reason: 'Build site already has a structure.' };
      }
      const site = TERRITORY_BUILD_SITE_DEFINITIONS[recipe.buildSiteId];
      if (site && !site.allowedStructures.includes(recipe.structureId)) {
        return { ok: false, reason: 'Cannot build that structure here.' };
      }
    }
    return { ok: true };
  }

  function start(charId, recipeId) {
    const check = canStart(charId, recipeId);
    if (!check.ok) return check;

    const recipe = CRAFT_RECIPE_DEFINITIONS[recipeId];
    consumeResources(recipe.resources);

    const nowMs = Date.now();
    const endMs = nowMs + recipe.durationSeconds * 1000;

    const job = {
      id: _genId(),
      charId,
      recipeId,
      skillType: recipe.skillType,
      startMs: nowMs,
      endMs,
      isCompleted: false,
      outputType: recipe.outputType,
      outputId: recipe.outputId || recipe.structureId,
      outputQty: recipe.outputQty || 1,
      buildSiteId: recipe.buildSiteId || null,
      structureId: recipe.structureId || null,
      xpReward: recipe.xpReward || 0,
    };

    if (!PLAYER_DATA.craftingJobs) PLAYER_DATA.craftingJobs = [];
    PLAYER_DATA.craftingJobs.push(job);
    SaveManager.write();
    _ensureTick();
    return { ok: true, job };
  }

  function cancel(jobId) {
    const list = PLAYER_DATA.craftingJobs || [];
    const idx  = list.findIndex(j => j.id === jobId && !j.isCompleted);
    if (idx < 0) return { ok: false, reason: 'Job not found.' };
    list.splice(idx, 1);
    SaveManager.write();
    return { ok: true };
  }

  function _complete(job) {
    const recipe = CRAFT_RECIPE_DEFINITIONS[job.recipeId];
    if (!recipe || job.isCompleted) return null;

    if (job.outputType === 'item') {
      if (!PLAYER_DATA.ownedItems) PLAYER_DATA.ownedItems = {};
      PLAYER_DATA.ownedItems[job.outputId] = (PLAYER_DATA.ownedItems[job.outputId] || 0) + job.outputQty;
    } else if (job.outputType === 'food') {
      addFood(job.outputId, job.outputQty);
    } else if (job.outputType === 'structure' && job.buildSiteId && job.structureId) {
      if (!PLAYER_DATA.builtStructures) PLAYER_DATA.builtStructures = {};
      PLAYER_DATA.builtStructures[job.buildSiteId] = job.structureId;
      applyStructureEffects(job.structureId);
    }

    const xpResult = addSkillXp(job.charId, job.skillType, job.xpReward);
    awardSkillPointsIfDue(job.charId);

    job.isCompleted = true;
    job.completedMs = Date.now();

    const charDef = CHARACTER_DEFINITIONS[job.charId];
    const skName  = SKILL_DEFINITIONS[job.skillType]?.displayName || job.skillType;
    let outputLabel = job.outputId;
    if (job.outputType === 'item') outputLabel = ITEM_DEFINITIONS[job.outputId]?.displayName || job.outputId;
    else if (job.outputType === 'food') outputLabel = FOOD_DEFINITIONS[job.outputId]?.displayName || job.outputId;
    else if (job.outputType === 'structure') outputLabel = STRUCTURE_DEFINITIONS[job.structureId]?.displayName || job.structureId;

    return {
      charId: job.charId,
      charName: charDef?.displayName || job.charId,
      charIcon: charDef?.icon || '●',
      recipeName: recipe.displayName,
      outputType: job.outputType,
      outputLabel,
      outputIcon: recipe.icon,
      buildSiteId: job.buildSiteId || null,
      structureId: job.structureId || null,
      skillType: job.skillType,
      skillName: skName,
      xpGained: job.xpReward,
      levelUp: xpResult && xpResult.newLevel > xpResult.oldLevel,
      newLevel: xpResult?.newLevel,
    };
  }

  function processAll(nowMs = Date.now()) {
    const completed = [];
    (PLAYER_DATA.craftingJobs || []).forEach(j => {
      if (j.isCompleted || nowMs < j.endMs) return;
      const result = _complete(j);
      if (result) completed.push(result);
    });
    if (completed.length) SaveManager.write();
    return completed;
  }

  function _tick() {
    const done = processAll();
    if (done.length && typeof _onComplete === 'function') _onComplete(done);
    if (typeof MAP !== 'undefined' && MAP.refreshMarkers) MAP.refreshMarkers();
    if (typeof WORKSHOP !== 'undefined' && WORKSHOP.refreshIfOpen) WORKSHOP.refreshIfOpen();
    if (typeof TERRITORY !== 'undefined' && TERRITORY.refreshIfOpen) TERRITORY.refreshIfOpen();
  }

  function _ensureTick() {
    if (_tickTimer) return;
    _tickTimer = setInterval(_tick, 1000);
  }

  function setOnComplete(fn) { _onComplete = fn; }

  function init() {
    _ensureTick();
  }

  return {
    init, start, cancel, processAll, getActive, isCharacterCrafting,
    canStart, getRemainingMs, formatDuration, getRecipesForSkill, setOnComplete,
  };
})();
