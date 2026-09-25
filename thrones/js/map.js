'use strict';
// =============================================================
// map.js — Phase 10: game-logic facade — rendering via WorldEngine (PixiJS)
// =============================================================

const MAP = (() => {

  let _onFight      = null;
  let _panelVisible = false;
  let _panelType    = null;
  let _panelTarget  = null;
  let _markerTick   = null;

  const _highlights        = new Map();
  const _recentCompletions = new Map();

  // ── Helpers exposed to WorldEngine ───────────────────────────
  function _isHighlighted(key) {
    const exp = _highlights.get(key);
    if (!exp) return false;
    if (Date.now() > exp) { _highlights.delete(key); return false; }
    return true;
  }

  function _isRecentCompletion(key) {
    const exp = _recentCompletions.get(key);
    if (!exp) return false;
    if (Date.now() > exp) { _recentCompletions.delete(key); return false; }
    return true;
  }

  function _progressPct(startMs, endMs, nowMs = Date.now()) {
    const total = endMs - startMs;
    if (total <= 0) return 1;
    return Math.min(1, Math.max(0, (nowMs - startMs) / total));
  }

  // ── Public lifecycle ──────────────────────────────────────────
  function init(battleDefs, onFight) {
    _onFight = onFight;

    const viewport = document.getElementById('map-viewport');
    if (viewport) {
      ensureDiscoveredTerritories();
      WorldEngine.init(viewport, _onHit).catch(err => {
        console.error('[MAP] WorldEngine init failed', err);
      });
    }

    _renderTeamStrip();
    _renderGold();
    _wirePanel();
    _wirePanHint();
    _startMarkerTick();

    document.getElementById('btn-map-to-menu')?.addEventListener('click', () => {
      SFX.uiClick();
      UI.showScreen('screen-main-menu');
    });
  }

  function refresh() {
    ensureDiscoveredTerritories();
    _renderTeamStrip();
    _renderGold();
    if (document.getElementById('screen-map')?.classList.contains('active')) {
      onMapVisible();
    } else {
      WorldEngine.resize();
    }
    WorldEngine.rebuildAll();
    refreshPanelIfOpen();
  }

  function onMapVisible() {
    WorldEngine.onMapVisible();
  }

  function refreshMarkers() {
    if (!document.getElementById('screen-map')?.classList.contains('active')) return;
    WorldEngine.markDirty();
    refreshPanelIfOpen();
  }

  function refreshPanelIfOpen() {
    if (!_panelVisible || !_panelType || !_panelTarget) return;
    if      (_panelType === 'resource')  _openResourcePanel(_panelTarget);
    else if (_panelType === 'build')     _openBuildPanel(_panelTarget);
    else if (_panelType === 'territory') _openTerritoryPanel(_panelTarget);
    else if (_panelType === 'battle')    _openBattlePanel(_panelTarget);
  }

  // ── Highlight / completion signals ───────────────────────────
  function flashHighlight(key, durationMs = 8000) {
    _highlights.set(key, Date.now() + durationMs);
    WorldEngine.markDirty();
  }

  function flashHighlights(keys, durationMs = 8000) {
    keys.forEach(k => _highlights.set(k, Date.now() + durationMs));
    WorldEngine.markDirty();
  }

  function markRecentCompletion(key, durationMs = 5000) {
    _recentCompletions.set(key, Date.now() + durationMs);
    WorldEngine.markDirty();
  }

  // ── Marker tick (progress rings) ─────────────────────────────
  function _startMarkerTick() {
    if (_markerTick) return;
    _markerTick = setInterval(() => {
      const hasWork = (typeof ASSIGNMENT !== 'undefined' && ASSIGNMENT.getActive().length)
        || (typeof CRAFTING !== 'undefined' && CRAFTING.getActive().length);
      if (hasWork) MapRenderer.markDirty();
    }, 1000);
  }

  // ── Canvas hit routing ────────────────────────────────────────
  function _onHit(type, id, data) {
    SFX.uiClick();
    if (type === 'resource') {
      if (!data.unlocked) { _showToast('🔒 Upgrade territory or build required structures to unlock this node.'); return; }
      _openResourcePanel(id);
    } else if (type === 'build') {
      _openBuildPanel(id);
    } else if (type === 'battle') {
      _openBattlePanel(data.battleDef);
    } else if (type === 'territory') {
      if (data.state === 'locked') _openTerritoryLockedPanel(id);
      else _openTerritoryPanel(id);
    }
  }

  // ── Header ────────────────────────────────────────────────────
  function _renderTeamStrip() {
    const strip = document.getElementById('map-team-strip');
    if (!strip) return;
    strip.innerHTML = '';
    PLAYER_DATA.team.forEach(charId => {
      const def  = CHARACTER_DEFINITIONS[charId];
      if (!def) return;
      const disp = getCharacterStatusDisplay(charId);
      const lvl  = typeof getCharLevel === 'function' ? getCharLevel(charId) : 1;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `map-hero-chip chip-status-${disp.status}`;
      chip.style.setProperty('--hero-color', def.color);
      chip.title = disp.detail || def.displayName;
      chip.innerHTML =
        `<span class="chip-icon">${def.icon}</span>` +
        `<span class="chip-meta"><span class="chip-name">${def.displayName}</span>` +
        `<span class="chip-lvl">Lv.${lvl}</span></span>` +
        `<span class="chip-status">${disp.label}</span>`;
      chip.addEventListener('click', () => {
        SFX.uiClick();
        if (typeof TERRITORY !== 'undefined') TERRITORY.openCharacterStatus();
      });
      strip.appendChild(chip);
    });
  }

  function _renderGold() {
    const el = document.getElementById('map-gold-display');
    if (el) el.textContent = `◈ ${PLAYER_DATA.gold}`;
  }

  // ── Panels ────────────────────────────────────────────────────
  function _wirePanel() {
    document.getElementById('btn-panel-close')?.addEventListener('click', hidePanel);
    document.getElementById('map-backdrop')?.addEventListener('click', hidePanel);
    document.getElementById('btn-fight')?.addEventListener('click', e => {
      e.stopPropagation();
      if (_panelType !== 'battle' || !_panelTarget || !_onFight) return;
      hidePanel();
      _onFight(_panelTarget);
    });
    document.getElementById('btn-map-panel-action')?.addEventListener('click', e => {
      e.stopPropagation();
      _onPanelAction();
    });
  }

  function _onPanelAction() {
    if (_panelType === 'resource' && _panelTarget) {
      if (typeof TERRITORY !== 'undefined') TERRITORY.openAssignmentPicker(_panelTarget);
      return;
    }
    if (_panelType === 'territory' && _panelTarget) {
      hidePanel();
      if (typeof TERRITORY !== 'undefined') TERRITORY.openDetail(_panelTarget);
    }
  }

  function _wirePanelContent(content) {
    if (!content) return;
    content.querySelectorAll('.btn-map-build-recipe').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const recipeId = btn.dataset.recipe;
        if (!recipeId || typeof WORKSHOP === 'undefined') return;
        WORKSHOP.openCrafterPickerForRecipe(recipeId);
      });
    });
    content.querySelectorAll('.btn-map-territory-upgrade').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const tid = btn.dataset.territory;
        if (!tid || typeof TERRITORY === 'undefined' || !TERRITORY.upgradeTerritory) return;
        TERRITORY.upgradeTerritory(tid);
        _openTerritoryPanel(tid);
      });
    });
    content.querySelectorAll('.btn-map-cancel-assignment').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        ASSIGNMENT.cancel(btn.dataset.id);
        SaveManager.write();
        MAP.refresh();
        SFX.uiClick();
      });
    });
  }

  function _showPanel(type, contentHTML, actionLabel, showFight = false) {
    _panelType = type;
    const content   = document.getElementById('battle-panel-content');
    const actions   = document.getElementById('map-panel-actions');
    const fightBtn  = document.getElementById('btn-fight');
    const actionBtn = document.getElementById('btn-map-panel-action');

    if (content) { content.innerHTML = contentHTML; _wirePanelContent(content); }
    if (fightBtn)  { fightBtn.style.display = showFight ? '' : 'none'; fightBtn.disabled = !showFight; }
    if (actionBtn) { actionBtn.style.display = actionLabel ? '' : 'none'; actionBtn.textContent = actionLabel || ''; }
    if (actions)   actions.classList.toggle('map-panel-actions-visible', !!(actionLabel || showFight));

    document.getElementById('map-backdrop')?.classList.remove('hidden');
    const panel = document.getElementById('battle-panel');
    panel?.classList.remove('panel-hidden');
    panel?.classList.add('panel-visible');
    _panelVisible = true;
  }

  function _renderTerritoryUpgradeHTML(territoryId) {
    const t = TERRITORY_DEFINITIONS[territoryId];
    if (!t) return '';
    const lvl = getTerritoryUpgradeLevel(territoryId);
    if (lvl >= t.maxUpgradeLevel) {
      return t.upgradePlaceholder
        ? `<p class="wm-panel-sub">${t.upgradePlaceholder}</p>`
        : '<div class="wm-panel-maxed">⬆️ Territory fully upgraded.</div>';
    }
    const nextLvl = lvl + 1;
    const upDef   = (TERRITORY_UPGRADE_DEFINITIONS[territoryId] || []).find(u => u.level === nextLvl);
    if (!upDef) return '';
    const costParts = Object.entries(upDef.cost || {}).map(([rid, qty]) => {
      const r = RESOURCE_DEFINITIONS[rid];
      const have = PLAYER_DATA.resources[rid] || 0;
      return `<span class="${have >= qty ? '' : 'cost-unmet'}">${r?.icon || ''} ${qty} ${r?.displayName || rid}</span>`;
    });
    if (upDef.gold) costParts.push(`<span class="${PLAYER_DATA.gold >= upDef.gold ? '' : 'cost-unmet'}">◈ ${upDef.gold}</span>`);
    return `
      <div class="wm-panel-divider"></div>
      <div class="wm-territory-upgrade-card">
        <div class="wm-territory-upgrade-title">⬆️ Upgrade to Lv.${nextLvl}: ${upDef.displayName}</div>
        <div class="wm-panel-sub">${upDef.description}</div>
        <div class="wm-territory-upgrade-cost">${costParts.join(' · ')}</div>
        <button type="button" class="btn btn-sm btn-map-territory-upgrade" data-territory="${territoryId}">Upgrade Territory</button>
      </div>`;
  }

  function _renderBuildRecipesHTML(siteId) {
    const site = TERRITORY_BUILD_SITE_DEFINITIONS[siteId];
    if (!site || isBuildSiteOccupied(siteId)) return '';
    const recipes = getRecipesForBuildSite(siteId);
    if (!recipes.length) return '';
    return `
      <div class="wm-panel-divider"></div>
      <div class="wm-build-recipes-title">Available Structures</div>
      ${recipes.map(recipe => {
        const costParts = Object.entries(recipe.resources || {}).map(([rid, qty]) => {
          const r = RESOURCE_DEFINITIONS[rid];
          const have = PLAYER_DATA.resources[rid] || 0;
          return `<span class="${have >= qty ? '' : 'cost-unmet'}">${r?.icon || ''} ${qty}</span>`;
        }).join(' ');
        const skillName = SKILL_DEFINITIONS[recipe.skillType]?.displayName || recipe.skillType;
        const unlocked  = isRecipeUnlocked(recipe.id);
        return `
          <div class="wm-build-recipe-card">
            <div class="wm-build-recipe-head"><span>${recipe.icon}</span><strong>${recipe.displayName}</strong></div>
            <div class="wm-panel-sub">${skillName} Lv.${recipe.requiredSkillLevel}+ · ${recipe.durationSeconds}s · +${recipe.xpReward} XP</div>
            <div class="wm-build-recipe-cost">Cost: ${costParts}</div>
            <button type="button" class="btn btn-sm btn-map-build-recipe" data-recipe="${recipe.id}"
              ${unlocked ? '' : 'disabled'}>${unlocked ? 'Assign Builder' : '🔒 Locked'}</button>
          </div>`;
      }).join('')}`;
  }

  function _openBattlePanel(battleDef) {
    _panelTarget = battleDef;
    const state     = Unlock.battleNodeState(battleDef.id);
    const enemies   = battleDef.enemyTeam.map(id => ENEMY_DEFINITIONS[id]);
    const teamDefs  = PLAYER_DATA.team.map(id => getEffectiveStats(id));
    const territory = TERRITORY_DEFINITIONS[battleDef.territoryId];
    const enemyHTML = enemies.map(e =>
      `<div class="panel-enemy-chip"><span class="pec-icon">${e.icon}</span><span class="pec-name">${e.displayName}</span><span class="pec-stat">${e.maxHP} HP</span></div>`
    ).join('');
    const completedBadge = state === 'completed' ? '<span class="panel-completed-badge">✓ Completed</span>' : '';
    const charXp = battleDef.characterXpReward ?? battleDef.xpReward ?? 0;
    const resRewards = [
      ...(battleDef.guaranteedResourceDrops || []).map(r => { const def = RESOURCE_DEFINITIONS[r.resourceId]; return `${def?.icon||''} ${r.qty}× ${def?.displayName||r.resourceId}`; }),
      ...(battleDef.possibleResourceDrops   || []).map(r => { const def = RESOURCE_DEFINITIONS[r.resourceId]; return `${def?.icon||''} ${r.qty}× ${def?.displayName||r.resourceId} (chance)`; }),
    ].join(' · ');
    _showPanel('battle', `
      <div class="panel-area-tag">${territory?.displayName||'Campaign'} · ${battleDef.isTerritoryBoss?'Boss':'Battle'}</div>
      <div class="panel-battle-name-row">
        <h2 class="panel-battle-name">${battleDef.isTerritoryBoss?'👑 ':'⚔️ '}${battleDef.displayName}</h2>
        ${completedBadge}
      </div>
      <div class="panel-enemies">${enemyHTML}</div>
      <div class="panel-rewards">
        <span class="panel-reward-item"><span class="reward-icon gold-icon">◈</span> ${battleDef.goldReward} Gold</span>
        <span class="panel-reward-item"><span class="reward-icon xp-icon">★</span> ${charXp} Char XP</span>
      </div>
      ${resRewards ? `<div class="panel-reward-resources">📦 ${resRewards}</div>` : ''}
      <div class="panel-divider"></div>
      <div class="panel-team-label">Your Team</div>
      <div class="panel-team-row">${teamDefs.map(d =>
        `<div class="panel-hero" style="--hero-color:${d.color}"><span>${d.icon}</span><span>${d.displayName}</span></div>`
      ).join('')}</div>
    `, null, state !== 'completed' && state !== 'locked');
  }

  function _openResourcePanel(nodeId) {
    _panelTarget = nodeId;
    const node = TERRITORY_NODE_DEFINITIONS[nodeId];
    if (!node) return;
    regenerateResourceNode(nodeId);
    const state    = getResourceNodeState(nodeId);
    const res      = RESOURCE_DEFINITIONS[node.resourceProduced];
    const skill    = SKILL_DEFINITIONS[node.skillType];
    const pct      = Math.round((state.amount / node.maxAvailable) * 100);
    const asgn     = getActiveAssignmentForNode(nodeId);
    const yieldEst = PLAYER_DATA.team[0] ? calcAssignmentYield(nodeId, PLAYER_DATA.team[0]) : node.baseYield;
    let workerHTML = '<div class="wm-panel-stat"><span>Assigned</span><span>None</span></div>';
    if (asgn) {
      const c   = CHARACTER_DEFINITIONS[asgn.charId];
      const rem = ASSIGNMENT.formatDuration(ASSIGNMENT.getRemainingMs(asgn));
      const prog = Math.round(_progressPct(asgn.startMs, asgn.endMs) * 100);
      const eta  = new Date(asgn.endMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      workerHTML = `
        <div class="wm-panel-active-job">
          <div class="wm-panel-stat"><span>Worker</span><span>${c?.icon||'●'} ${c?.displayName||asgn.charId}</span></div>
          <div class="wm-panel-stat"><span>Time left</span><span>${rem} (${prog}%)</span></div>
          <div class="wm-panel-stat"><span>Completes</span><span>~${eta}</span></div>
          <div class="wm-panel-progress"><div class="wm-panel-progress-fill" style="width:${prog}%"></div></div>
          <button type="button" class="btn btn-ghost btn-xs btn-map-cancel-assignment" data-id="${asgn.id}">Cancel Assignment</button>
        </div>`;
    }
    const canAssign = !asgn && state.amount >= 1;
    _showPanel('resource', `
      <div class="panel-area-tag">Resource Node</div>
      <h2 class="panel-battle-name">${node.icon} ${node.displayName}</h2>
      <div class="wm-panel-stat"><span>Skill</span><span>${skill?.icon||''} ${skill?.displayName||node.skillType} Lv.${node.requiredSkillLevel}+</span></div>
      <div class="wm-panel-stat"><span>Produces</span><span>${res?.icon||''} ${res?.displayName||node.resourceProduced}</span></div>
      <div class="wm-panel-stat"><span>Available</span><span>${Math.floor(state.amount)} / ${node.maxAvailable} (${pct}%)</span></div>
      <div class="wm-panel-stat"><span>Duration</span><span>${node.workDurationSeconds}s per trip</span></div>
      <div class="wm-panel-stat"><span>Reward</span><span>~${yieldEst} ${res?.displayName||''} · +${node.baseXp} ${skill?.displayName||''} XP</span></div>
      ${workerHTML}
    `, canAssign ? '🌿 Assign Hero' : null);
  }

  function _openBuildPanel(siteId) {
    _panelTarget = siteId;
    const site   = TERRITORY_BUILD_SITE_DEFINITIONS[siteId];
    if (!site) return;
    const builtId = getBuiltStructureIdAtSite(siteId);
    const built   = builtId ? STRUCTURE_DEFINITIONS[builtId] : null;
    const job     = getActiveBuildJobForSite(siteId);
    let body = '';
    if (built) {
      body = `<div class="wm-panel-built">✓ Built: <strong>${built.displayName}</strong><br><span class="wm-panel-sub">${built.description}</span></div>`;
    } else if (job) {
      const c      = CHARACTER_DEFINITIONS[job.charId];
      const recipe = CRAFT_RECIPE_DEFINITIONS[job.recipeId];
      const rem    = CRAFTING.formatDuration(CRAFTING.getRemainingMs(job));
      const prog   = Math.round(_progressPct(job.startMs, job.endMs) * 100);
      body = `
        <div class="wm-panel-active-job">
          <div class="wm-panel-stat"><span>Building</span><span>${recipe?.icon||'🔨'} ${recipe?.displayName||'Structure'}</span></div>
          <div class="wm-panel-stat"><span>Builder</span><span>${c?.icon||'●'} ${c?.displayName||job.charId}</span></div>
          <div class="wm-panel-stat"><span>Time left</span><span>${rem} (${prog}%)</span></div>
          <div class="wm-panel-progress"><div class="wm-panel-progress-fill" style="width:${prog}%"></div></div>
        </div>`;
    } else {
      body = _renderBuildRecipesHTML(siteId);
    }
    _showPanel('build', `
      <div class="panel-area-tag">Build Site</div>
      <h2 class="panel-battle-name">${built ? built.icon : site.emptyIcon||site.icon} ${site.displayName}</h2>
      ${body}
    `, null);
  }

  function _openTerritoryLockedPanel(territoryId) {
    const t = TERRITORY_DEFINITIONS[territoryId];
    if (!t) return;
    const req = t.unlockBattleId ? BATTLE_DEFINITIONS.find(b => b.id === t.unlockBattleId) : null;
    _panelTarget = territoryId;
    _showPanel('territory', `
      <div class="panel-area-tag">🔒 Locked Territory</div>
      <h2 class="panel-battle-name">${t.icon} ${t.displayName}</h2>
      <p class="wm-panel-desc">${t.description}</p>
      <p class="wm-panel-sub">${req
        ? `Defeat <strong>${req.displayName}</strong> to unlock this territory.`
        : 'Complete earlier campaign battles to unlock.'}</p>
    `, null);
  }

  function _openTerritoryPanel(territoryId) {
    _panelTarget = territoryId;
    const t        = TERRITORY_DEFINITIONS[territoryId];
    if (!t) return;
    const lvl       = getTerritoryUpgradeLevel(territoryId);
    const nodes     = getTerritoryMapNodes(territoryId).filter(n => isTerritoryNodeUnlocked(n.id));
    const battles   = getTerritoryMapBattles(territoryId);
    const sites     = getTerritoryMapBuildSites(territoryId);
    const completed = battles.filter(b => Unlock.isBattleCompleted(b.id)).length;
    _showPanel('territory', `
      <div class="panel-area-tag">${t.icon} Territory · Lv.${lvl}/${t.maxUpgradeLevel}</div>
      <h2 class="panel-battle-name">${t.displayName}</h2>
      <p class="wm-panel-desc">${t.description}</p>
      <div class="wm-panel-summary">
        <div class="wm-summary-chip">🌿 ${nodes.length} resources</div>
        <div class="wm-summary-chip">⚔️ ${completed}/${battles.length} battles</div>
        <div class="wm-summary-chip">🏗️ ${sites.length} build sites</div>
      </div>
      ${_renderTerritoryUpgradeHTML(territoryId)}
      <div class="wm-panel-divider"></div>
      <p class="wm-panel-sub">View full territory details, assignments, and build sites.</p>
    `, '📋 View Details');
  }

  function hidePanel() {
    if (!_panelVisible) return;
    const panel = document.getElementById('battle-panel');
    panel?.classList.remove('panel-visible');
    panel?.classList.add('panel-hidden');
    document.getElementById('map-backdrop')?.classList.add('hidden');
    _panelTarget  = null;
    _panelType    = null;
    _panelVisible = false;
  }

  function _showToast(msg) {
    let toast = document.getElementById('map-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'map-toast';
      toast.className = 'map-toast';
      document.getElementById('screen-map')?.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.remove('toast-out');
    toast.classList.add('toast-in');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.classList.remove('toast-in'); toast.classList.add('toast-out'); }, 2500);
  }

  function showUnlockToast(msg) { _showToast(msg); }

  function _wirePanHint() {
    const sub = document.querySelector('.map-game-sub');
    if (!sub) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    sub.textContent = coarse ? 'Drag · Pinch to explore' : 'Drag · Scroll to explore';
  }

  function openStartingField() {
    WorldEngine.focusStart();
  }

  return {
    init, refresh, onMapVisible, refreshMarkers, refreshPanelIfOpen,
    hidePanel, showUnlockToast, openStartingField,
    flashHighlight, flashHighlights, markRecentCompletion,
    // Exposed for WorldEngine access
    _isHighlighted, _isRecentCompletion,
  };
})();
