'use strict';
// =============================================================
// construction.js — CONSTRUCTION module
// Converts logs (and sometimes ore) into permanent buildings that
// give party-wide passive bonuses. Accessible as the 4th tab in
// the Gather screen.
// =============================================================

const CONSTRUCTION = (() => {

  // ── Open ──────────────────────────────────────────────────────
  function open() {
    _render();
  }

  // ── Build action ──────────────────────────────────────────────
  function build(buildingId) {
    const bDef = BUILDING_DEFINITIONS.find(b => b.id === buildingId);
    if (!bDef) return;

    if (isBuildingBuilt(buildingId)) {
      _showFeedback('Already built!', 'error');
      return;
    }

    // Check Construction skill level
    const conLevel = _teamConstructionLevel();
    if (conLevel < bDef.constructionReq) {
      _showFeedback(`Need Construction Lv.${bDef.constructionReq} to build this.`, 'error');
      return;
    }

    // Check all ingredient costs
    const resources = PLAYER_DATA.resources || {};
    for (const [resId, qty] of Object.entries(bDef.cost)) {
      if ((resources[resId] || 0) < qty) {
        const resDef = RESOURCE_DEFINITIONS[resId];
        _showFeedback(
          `Need ${qty}× ${resDef?.displayName || resId}. You have ${resources[resId] || 0}.`,
          'error'
        );
        return;
      }
    }

    // Consume ingredients
    for (const [resId, qty] of Object.entries(bDef.cost)) {
      PLAYER_DATA.resources[resId] -= qty;
    }

    // Build it
    buildBuilding(buildingId);

    // Award Construction XP
    const levelUps = awardGatheringXp('construction', bDef.xpPerBuild);

    _showFeedback(`${bDef.icon} ${bDef.displayName} constructed! +${bDef.xpPerBuild} Construction XP`, 'success');
    Object.entries(levelUps).forEach(([charId, { newLevel }]) => {
      const def = CHARACTER_DEFINITIONS[charId];
      _showFeedback(`⬆️ ${def.displayName}: Construction → Lv.${newLevel}!`, 'levelup');
      SFX.levelUp();
    });

    SFX.heavyAttack();
    SaveManager.write();
    _render();
  }

  function upgrade(buildingId) {
    const upDef = BUILDING_UPGRADE_DEFINITIONS[buildingId];
    if (!upDef) return;
    if (!isBuildingBuilt(buildingId)) {
      _showFeedback('Build the structure first.', 'error');
      return;
    }
    if (isBuildingUpgraded(buildingId)) {
      _showFeedback('Already upgraded!', 'error');
      return;
    }

    const conLevel = _teamConstructionLevel();
    if (conLevel < upDef.constructionReq) {
      _showFeedback(`Need Construction Lv.${upDef.constructionReq} to upgrade.`, 'error');
      return;
    }

    const resources = PLAYER_DATA.resources || {};
    for (const [resId, qty] of Object.entries(upDef.cost)) {
      if ((resources[resId] || 0) < qty) {
        const resDef = RESOURCE_DEFINITIONS[resId];
        _showFeedback(`Need ${qty}× ${resDef?.displayName || resId}.`, 'error');
        return;
      }
    }

    for (const [resId, qty] of Object.entries(upDef.cost)) {
      PLAYER_DATA.resources[resId] -= qty;
    }

    upgradeBuilding(buildingId);
    const levelUps = awardGatheringXp('construction', upDef.xpPerUpgrade);

    _showFeedback(`${upDef.icon} ${upDef.displayName} complete!`, 'success');
    Object.entries(levelUps).forEach(([charId, { newLevel }]) => {
      const def = CHARACTER_DEFINITIONS[charId];
      _showFeedback(`⬆️ ${def.displayName}: Construction → Lv.${newLevel}!`, 'levelup');
      SFX.levelUp();
    });

    SFX.heavyAttack();
    SaveManager.write();
    _render();
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _teamConstructionLevel() {
    if (!PLAYER_DATA.team.length) return 1;
    const sum = PLAYER_DATA.team.reduce((acc, charId) => {
      return acc + (PLAYER_DATA.characters[charId].skills.construction?.level || 1);
    }, 0);
    return Math.floor(sum / PLAYER_DATA.team.length);
  }

  let _feedbackTimer = null;
  function _showFeedback(msg, type = 'success') {
    const el = document.getElementById('construction-feedback');
    if (!el) return;
    el.textContent = msg;
    el.className   = `cooking-feedback cooking-feedback-${type} cooking-feedback-visible`;
    clearTimeout(_feedbackTimer);
    _feedbackTimer = setTimeout(() => el.classList.remove('cooking-feedback-visible'), 2800);
  }

  // ── Render ────────────────────────────────────────────────────
  function _render() {
    _renderBuildings();
    _renderConstructionSkill();
    _renderBuiltList();
  }

  function _renderBuildings() {
    const container = document.getElementById('construction-buildings');
    if (!container) return;

    const conLevel  = _teamConstructionLevel();
    const resources = PLAYER_DATA.resources || {};

    container.innerHTML = BUILDING_DEFINITIONS.map(bDef => {
      const isBuilt  = isBuildingBuilt(bDef.id);
      const locked   = conLevel < bDef.constructionReq;

      // Cost row
      const costRows = Object.entries(bDef.cost).map(([resId, qty]) => {
        const resDef = RESOURCE_DEFINITIONS[resId];
        const have   = resources[resId] || 0;
        const enough = have >= qty;
        return `<span class="build-cost-chip ${enough ? 'cost-ok' : 'cost-short'}">
          ${resDef?.icon || '?'} ${qty} ${resDef?.displayName || resId}
          <span class="cost-have">(${have})</span>
        </span>`;
      }).join('');

      const canBuild = !isBuilt && !locked &&
        Object.entries(bDef.cost).every(([r, q]) => (resources[r] || 0) >= q);

      const effectLabel = _effectLabel(bDef.effect);
      const upDef       = BUILDING_UPGRADE_DEFINITIONS[bDef.id];
      const isUpgraded  = isBuildingUpgraded(bDef.id);

      let upgradeHTML = '';
      if (isBuilt && upDef && !isUpgraded) {
        const upLocked = conLevel < upDef.constructionReq;
        const upCostRows = Object.entries(upDef.cost).map(([resId, qty]) => {
          const resDef = RESOURCE_DEFINITIONS[resId];
          const have   = resources[resId] || 0;
          const enough = have >= qty;
          return `<span class="build-cost-chip ${enough ? 'cost-ok' : 'cost-short'}">
            ${resDef?.icon || '?'} ${qty} ${resDef?.displayName || resId}
            <span class="cost-have">(${have})</span>
          </span>`;
        }).join('');
        const canUpgrade = !upLocked &&
          Object.entries(upDef.cost).every(([r, q]) => (resources[r] || 0) >= q);
        upgradeHTML = `
          <div class="build-upgrade-section">
            <div class="build-upgrade-title">${upDef.icon} Upgrade: ${upDef.displayName}</div>
            <div class="build-desc">${upDef.description}</div>
            <div class="build-effect">${_effectLabel(upDef.effect)}</div>
            <div class="build-req ${upLocked ? 'req-unmet' : 'req-met'}">
              🏗️ Construction Lv.${upDef.constructionReq} ${upLocked ? `(you: ${conLevel})` : '✓'}
            </div>
            <div class="build-cost">${upCostRows}</div>
            <button class="btn btn-build btn-upgrade" data-upgrade="${bDef.id}" ${canUpgrade ? '' : 'disabled'}>
              ⬆️ Upgrade
            </button>
          </div>`;
      } else if (isUpgraded) {
        upgradeHTML = '<div class="build-upgraded-badge">⬆️ Upgraded</div>';
      }

      return `
        <div class="build-card ${isBuilt ? 'build-card-done' : ''} ${locked ? 'build-card-locked' : ''}">
          <div class="build-card-top">
            <span class="build-icon">${bDef.icon}</span>
            <div class="build-info">
              <div class="build-name">${bDef.displayName}${isBuilt ? ' <span class="build-done-badge">✓ Built</span>' : ''}</div>
              <div class="build-desc">${bDef.description}</div>
              <div class="build-effect">${effectLabel}</div>
              <div class="build-req ${locked ? 'req-unmet' : 'req-met'}">
                🏗️ Construction Lv.${bDef.constructionReq} ${locked ? `(you: ${conLevel})` : '✓'}
              </div>
            </div>
          </div>
          <div class="build-cost">${costRows}</div>
          <button class="btn btn-build"
            data-building="${bDef.id}"
            ${canBuild ? '' : 'disabled'}>
            ${isBuilt ? '✓ Constructed' : '🏗️ Build'}
          </button>
          ${upgradeHTML}
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-build:not(.btn-upgrade)').forEach(btn => {
      btn.addEventListener('click', () => build(btn.dataset.building));
    });
    container.querySelectorAll('.btn-upgrade').forEach(btn => {
      btn.addEventListener('click', () => upgrade(btn.dataset.upgrade));
    });
  }

  function _effectLabel(effect) {
    const parts = [];
    if (effect.hpBonus)           parts.push(`+${effect.hpBonus} HP`);
    if (effect.atkBonus)          parts.push(`+${effect.atkBonus} ATK`);
    if (effect.evasionBonus)      parts.push(`+${effect.evasionBonus}% Evasion`);
    if (effect.xpBonus)           parts.push(`+${Math.round(effect.xpBonus * 100)}% Battle XP`);
    if (effect.fishingSpeedBonus) parts.push(`${Math.round(effect.fishingSpeedBonus * 100)}% faster Fishing`);
    if (effect.unlocksPiety)      parts.push('Unlocks Piety prayer');
    return parts.length ? `<span class="build-effect-tag">${parts.join(' · ')}</span>` : '';
  }

  function _renderConstructionSkill() {
    const container = document.getElementById('construction-skill-bars');
    if (!container) return;

    const skDef = SKILL_DEFINITIONS['construction'];
    container.innerHTML = PLAYER_DATA.team.map(charId => {
      const def  = CHARACTER_DEFINITIONS[charId];
      const sk   = PLAYER_DATA.characters[charId].skills.construction;
      const pct  = xpProgressPct(sk.xp, sk.level).toFixed(1);
      const now  = sk.xp - xpToLevel(sk.level);
      const next = xpForNextLevel(sk.level);
      return `
        <div class="gather-skill-row">
          <span class="gsr-icon">${def.icon}</span>
          <div class="gsr-body">
            <div class="gsr-name-line">
              <span class="gsr-name">${def.displayName}</span>
              <span class="gsr-level" style="color:${skDef.color}">${skDef.icon} Construction Lv.${sk.level}</span>
            </div>
            <div class="gsr-track">
              <div class="gsr-fill" style="width:${pct}%;background:${skDef.color}"></div>
            </div>
            <div class="gsr-xp-text">${sk.level >= 99 ? 'MAX' : `${now} / ${next} XP`}</div>
          </div>
        </div>`;
    }).join('');
  }

  function _renderBuiltList() {
    const container = document.getElementById('construction-built-list');
    if (!container) return;
    const built = (PLAYER_DATA.buildings || [])
      .map(id => BUILDING_DEFINITIONS.find(b => b.id === id))
      .filter(Boolean);

    if (!built.length) {
      container.innerHTML = '<div class="gather-empty">No buildings yet. Start constructing!</div>';
      return;
    }
    container.innerHTML = built.map(b =>
      `<div class="built-chip">${b.icon} <span>${b.displayName}</span></div>`
    ).join('');
  }

  function init() {}

  return { init, open, build, upgrade };
})();
