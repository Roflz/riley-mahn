'use strict';
// =============================================================
// territory.js — World territories UI (Phase 4)
// World map of territories, detail view, upgrades, assignments.
// =============================================================

const TERRITORY = (() => {

  let _selectedTerritoryId = null;
  let _assignNodeId        = null;
  let _onFight             = null;
  let _statusRefreshTimer  = null;

  function init(onFight) {
    _onFight = onFight;
    document.getElementById('btn-territories-open')?.addEventListener('click', () => {
      SFX.uiClick();
      openWorldMap();
    });
    document.getElementById('btn-territories-back')?.addEventListener('click', () => {
      SFX.uiClick();
      UI.showScreen('screen-map');
    });
    document.getElementById('btn-territory-detail-close')?.addEventListener('click', closeDetail);
    document.getElementById('overlay-territory-detail')?.addEventListener('click', e => {
      if (e.target.id === 'overlay-territory-detail') closeDetail();
    });
    document.getElementById('btn-assignment-close')?.addEventListener('click', closeAssignmentPicker);
    document.getElementById('overlay-assignment')?.addEventListener('click', e => {
      if (e.target.id === 'overlay-assignment') closeAssignmentPicker();
    });
    document.getElementById('btn-char-status-open')?.addEventListener('click', () => {
      SFX.uiClick();
      openCharacterStatus();
    });
    document.getElementById('btn-char-status-close')?.addEventListener('click', closeCharacterStatus);
    document.getElementById('overlay-char-status')?.addEventListener('click', e => {
      if (e.target.id === 'overlay-char-status') closeCharacterStatus();
    });
  }

  function openWorldMap() {
    regenerateAllResourceNodes();
    _renderWorldMap();
    UI.showScreen('screen-territories');
  }

  /** First-time onboarding — open Starting Field on the world map. */
  function openStartingField() {
    if (typeof MAP !== 'undefined' && MAP.openStartingField) {
      MAP.openStartingField();
      return;
    }
    if (!isTerritoryUnlocked('territory_starting_field')) return;
    openDetail('territory_starting_field');
  }

  function refreshIfOpen() {
    if (document.getElementById('screen-territories')?.classList.contains('active')) {
      _renderWorldMap();
    }
    if (_selectedTerritoryId) _renderDetail(_selectedTerritoryId);
    if (_assignNodeId) _renderAssignmentPicker(_assignNodeId);
  }

  function _renderWorldMap() {
    const container = document.getElementById('territory-list');
    if (!container) return;

    const territories = Object.values(TERRITORY_DEFINITIONS);
    container.innerHTML = territories.map(t => {
      const unlocked = isTerritoryUnlocked(t.id);
      const lvl      = getTerritoryUpgradeLevel(t.id);
      const nodes    = getNodesForTerritory(t.id).filter(n => isTerritoryNodeUnlocked(n.id));
      const battles  = (t.battleIds || []).filter(bid => Unlock.isBattleUnlocked(bid));

      return `
        <div class="territory-card ${unlocked ? 'territory-unlocked' : 'territory-locked'}"
             data-id="${t.id}" style="--ter-color:${t.color}">
          <div class="territory-card-icon">${unlocked ? t.icon : '🔒'}</div>
          <div class="territory-card-body">
            <div class="territory-card-name">${t.displayName}</div>
            <div class="territory-card-desc">${unlocked ? t.description : 'Complete campaign battles to unlock.'}</div>
            ${unlocked ? `
              <div class="territory-card-meta">
                <span>⬆️ Lv.${lvl}</span>
                <span>🌿 ${nodes.length} nodes</span>
                <span>⚔️ ${battles.length} battles</span>
              </div>` : ''}
          </div>
          ${unlocked ? '<div class="territory-card-arrow">›</div>' : ''}
        </div>`;
    }).join('');

    container.querySelectorAll('.territory-unlocked').forEach(card => {
      card.addEventListener('click', () => openDetail(card.dataset.id));
    });
  }

  function openDetail(territoryId) {
    _selectedTerritoryId = territoryId;
    regenerateAllResourceNodes();
    _renderDetail(territoryId);
    const overlay = document.getElementById('overlay-territory-detail');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    SFX.uiClick();
  }

  function closeDetail() {
    _selectedTerritoryId = null;
    const overlay = document.getElementById('overlay-territory-detail');
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  function _renderDetail(territoryId) {
    const t = TERRITORY_DEFINITIONS[territoryId];
    if (!t) return;

    const titleEl = document.getElementById('territory-detail-title');
    if (titleEl) titleEl.textContent = `${t.icon} ${t.displayName}`;

    const lvl = getTerritoryUpgradeLevel(territoryId);
    const sub = document.getElementById('territory-detail-sub');
    if (sub) sub.textContent = `Upgrade Lv.${lvl} / ${t.maxUpgradeLevel} · ${t.description}`;

    _renderDetailBuildSites(territoryId);
    _renderDetailNodes(territoryId);
    _renderDetailBattles(territoryId);
    _renderDetailAssignments(territoryId);
    _renderDetailCrafting(territoryId);
    _renderDetailUpgrade(territoryId);
  }

  function _renderDetailBuildSites(territoryId) {
    const container = document.getElementById('territory-build-sites-list');
    if (!container) return;

    const sites = Object.values(TERRITORY_BUILD_SITE_DEFINITIONS)
      .filter(s => s.territoryId === territoryId);

    if (!sites.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = sites.map(site => {
      const built = getBuiltStructureAtSite(site.id);
      if (built) {
        return `
          <div class="territory-build-site-card territory-build-site-built">
            <div class="territory-build-site-head">
              <span>${built.icon}</span>
              <span class="territory-build-site-name">${built.displayName}</span>
            </div>
            <div class="territory-build-site-desc">${built.description}</div>
          </div>`;
      }

      const buildRecipe = Object.values(CRAFT_RECIPE_DEFINITIONS).find(
        r => r.outputType === 'structure' && r.buildSiteId === site.id
      );
      const recipeName = buildRecipe?.displayName || site.allowedStructures.map(id => STRUCTURE_DEFINITIONS[id]?.displayName).filter(Boolean).join(' / ');

      return `
        <div class="territory-build-site-card">
          <div class="territory-build-site-head">
            <span>${site.icon}</span>
            <span class="territory-build-site-name">${site.displayName}</span>
          </div>
          <div class="territory-build-site-desc">Empty — build ${recipeName || 'a structure'} via Workshop → Construction.</div>
          <button type="button" class="btn btn-sm btn-open-workshop-build" data-tab="construction">🔨 Open Workshop</button>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-open-workshop-build').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof WORKSHOP !== 'undefined') WORKSHOP.open(btn.dataset.tab);
      });
    });
  }

  function _renderDetailCrafting(territoryId) {
    const container = document.getElementById('territory-crafting-list');
    if (!container) return;

    const jobs = CRAFTING.getActive().filter(j => {
      const site = j.buildSiteId && TERRITORY_BUILD_SITE_DEFINITIONS[j.buildSiteId];
      return site && site.territoryId === territoryId;
    });

    if (!jobs.length) {
      container.innerHTML = '<div class="territory-empty">No construction jobs in this territory.</div>';
      return;
    }

    container.innerHTML = jobs.map(j => {
      const c = CHARACTER_DEFINITIONS[j.charId];
      const r = CRAFT_RECIPE_DEFINITIONS[j.recipeId];
      const rem = CRAFTING.formatDuration(CRAFTING.getRemainingMs(j));
      return `
        <div class="territory-assignment-row">
          <span>${c?.icon || '●'} ${c?.displayName || j.charId}</span>
          <span>→ ${r?.displayName || j.recipeId}</span>
          <span class="territory-assignment-time">⏱ ${rem}</span>
        </div>`;
    }).join('');
  }

  function _renderDetailNodes(territoryId) {
    const container = document.getElementById('territory-nodes-list');
    if (!container) return;

    const nodes = getNodesForTerritory(territoryId);
    container.innerHTML = nodes.map(n => {
      const unlocked = isTerritoryNodeUnlocked(n.id);
      if (!unlocked) {
        let lockMsg = 'Upgrade territory to unlock';
        if (n.requiredStructureId && !isStructureBuilt(n.requiredStructureId)) {
          const sdef = STRUCTURE_DEFINITIONS[n.requiredStructureId];
          lockMsg = `Requires ${sdef?.displayName || n.requiredStructureId}`;
        } else if (getTerritoryUpgradeLevel(territoryId) < n.unlockAtTerritoryLevel) {
          lockMsg = 'Upgrade territory to unlock';
        }
        return `<div class="territory-node-card territory-node-locked">
          <span>🔒 ${n.displayName}</span>
          <span class="territory-node-lock">${lockMsg}</span>
        </div>`;
      }
      regenerateResourceNode(n.id);
      const state = getResourceNodeState(n.id);
      const res   = RESOURCE_DEFINITIONS[n.resourceProduced];
      const pct   = Math.round((state.amount / n.maxAvailable) * 100);
      const activeHere = ASSIGNMENT.getActive().filter(a => a.nodeId === n.id);

      return `
        <div class="territory-node-card">
          <div class="territory-node-head">
            <span class="territory-node-icon">${n.icon}</span>
            <div>
              <div class="territory-node-name">${n.displayName}</div>
              <div class="territory-node-skill">${SKILL_DEFINITIONS[n.skillType].icon} ${SKILL_DEFINITIONS[n.skillType].displayName} Lv.${n.requiredSkillLevel}+</div>
            </div>
          </div>
          <div class="territory-node-yield">${res?.icon || ''} ${res?.displayName || n.resourceProduced} · ${n.workDurationSeconds}s · +${n.baseXp} XP</div>
          <div class="territory-node-stock">
            <div class="territory-node-bar"><div class="territory-node-fill" style="width:${pct}%"></div></div>
            <span>${Math.floor(state.amount)} / ${n.maxAvailable}</span>
          </div>
          ${activeHere.length ? `<div class="territory-node-workers">${activeHere.map(a => {
            const c = CHARACTER_DEFINITIONS[a.charId];
            const rem = ASSIGNMENT.formatDuration(ASSIGNMENT.getRemainingMs(a));
            return `${c?.icon || '●'} ${c?.displayName || a.charId} (${rem})`;
          }).join(' · ')}</div>` : ''}
          <button type="button" class="btn btn-sm btn-territory-assign" data-node="${n.id}"
            ${state.amount < 1 ? 'disabled title="Wait for regeneration"' : ''}>
            Assign Hero
          </button>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-territory-assign').forEach(btn => {
      btn.addEventListener('click', () => openAssignmentPicker(btn.dataset.node));
    });
  }

  function _renderDetailBattles(territoryId) {
    const container = document.getElementById('territory-battles-list');
    if (!container) return;
    const t = TERRITORY_DEFINITIONS[territoryId];

    container.innerHTML = (t.battleIds || []).map(bid => {
      const b = BATTLE_DEFINITIONS.find(x => x.id === bid);
      if (!b) return '';
      const state = Unlock.battleNodeState(bid);
      const icons = b.enemyTeam.map(id => ENEMY_DEFINITIONS[id].icon).join(' ');
      const canFight = state !== 'locked';
      return `
        <div class="territory-battle-card territory-battle-${state}">
          <div class="territory-battle-info">
            <div class="territory-battle-name">${b.displayName} ${state === 'completed' ? '✓' : ''}</div>
            <div class="territory-battle-enemies">${icons}</div>
            <div class="territory-battle-rewards">◈ ${b.goldReward} Gold · ★ ${b.characterXpReward ?? b.xpReward} Char XP</div>
          </div>
          ${canFight ? `<button type="button" class="btn btn-sm btn-territory-fight" data-battle="${bid}">Fight</button>` : '<span class="territory-locked-tag">Locked</span>'}
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-territory-fight').forEach(btn => {
      btn.addEventListener('click', () => {
        const def = BATTLE_DEFINITIONS.find(x => x.id === btn.dataset.battle);
        if (def && _onFight) {
          closeDetail();
          UI.showScreen('screen-map');
          _onFight(def);
        }
      });
    });
  }

  function _renderDetailAssignments(territoryId) {
    const container = document.getElementById('territory-assignments-list');
    if (!container) return;

    const active = ASSIGNMENT.getActive().filter(a => a.territoryId === territoryId);
    if (!active.length) {
      container.innerHTML = '<div class="territory-empty">No heroes assigned in this territory.</div>';
      return;
    }

    container.innerHTML = active.map(a => {
      const c = CHARACTER_DEFINITIONS[a.charId];
      const n = TERRITORY_NODE_DEFINITIONS[a.nodeId];
      const rem = ASSIGNMENT.formatDuration(ASSIGNMENT.getRemainingMs(a));
      return `
        <div class="territory-assignment-row">
          <span>${c?.icon || '●'} ${c?.displayName || a.charId}</span>
          <span>→ ${n?.displayName || a.nodeId}</span>
          <span class="territory-assignment-time">⏱ ${rem}</span>
          <button type="button" class="btn btn-ghost btn-xs btn-cancel-assignment" data-id="${a.id}">Cancel</button>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-cancel-assignment').forEach(btn => {
      btn.addEventListener('click', () => {
        ASSIGNMENT.cancel(btn.dataset.id);
        SaveManager.write();
        _renderDetail(territoryId);
        SFX.uiClick();
      });
    });
  }

  function _renderDetailUpgrade(territoryId) {
    const container = document.getElementById('territory-upgrade-section');
    if (!container) return;

    const t   = TERRITORY_DEFINITIONS[territoryId];
    const lvl = getTerritoryUpgradeLevel(territoryId);
    if (lvl >= t.maxUpgradeLevel) {
      const msg = t.upgradePlaceholder || '⬆️ Territory fully upgraded.';
      container.innerHTML = `<div class="territory-maxed">${msg}</div>`;
      return;
    }

    const nextLvl = lvl + 1;
    const upDef   = (TERRITORY_UPGRADE_DEFINITIONS[territoryId] || []).find(u => u.level === nextLvl);
    if (!upDef) {
      container.innerHTML = '';
      return;
    }

    const costParts = Object.entries(upDef.cost || {}).map(([rid, qty]) => {
      const r = RESOURCE_DEFINITIONS[rid];
      const have = PLAYER_DATA.resources[rid] || 0;
      return `<span class="${have >= qty ? '' : 'cost-unmet'}">${r?.icon || ''} ${qty} ${r?.displayName || rid}</span>`;
    });
    if (upDef.gold) {
      costParts.push(`<span class="${PLAYER_DATA.gold >= upDef.gold ? '' : 'cost-unmet'}">◈ ${upDef.gold}</span>`);
    }

    container.innerHTML = `
      <div class="territory-upgrade-card">
        <div class="territory-upgrade-title">⬆️ Upgrade to Lv.${nextLvl}: ${upDef.displayName}</div>
        <div class="territory-upgrade-desc">${upDef.description}</div>
        <div class="territory-upgrade-cost">${costParts.join(' · ')}</div>
        <button type="button" class="btn btn-sm btn-territory-upgrade" data-territory="${territoryId}">Upgrade</button>
      </div>`;

    container.querySelector('.btn-territory-upgrade')?.addEventListener('click', () => {
      _upgradeTerritory(territoryId);
    });
  }

  function _upgradeTerritory(territoryId) {
    const lvl = getTerritoryUpgradeLevel(territoryId);
    const t   = TERRITORY_DEFINITIONS[territoryId];
    const nextLvl = lvl + 1;
    if (nextLvl > t.maxUpgradeLevel) return;

    const upDef = (TERRITORY_UPGRADE_DEFINITIONS[territoryId] || []).find(u => u.level === nextLvl);
    if (!upDef) return;

    for (const [rid, qty] of Object.entries(upDef.cost || {})) {
      if ((PLAYER_DATA.resources[rid] || 0) < qty) {
        MAP.showUnlockToast(`Need ${qty} ${RESOURCE_DEFINITIONS[rid]?.displayName || rid}.`);
        return;
      }
    }
    if (upDef.gold && PLAYER_DATA.gold < upDef.gold) {
      MAP.showUnlockToast(`Need ◈ ${upDef.gold} Gold.`);
      return;
    }

    Object.entries(upDef.cost || {}).forEach(([rid, qty]) => {
      PLAYER_DATA.resources[rid] = (PLAYER_DATA.resources[rid] || 0) - qty;
    });
    if (upDef.gold) PLAYER_DATA.gold -= upDef.gold;

    if (!PLAYER_DATA.territoryUpgrades) PLAYER_DATA.territoryUpgrades = {};
    PLAYER_DATA.territoryUpgrades[territoryId] = nextLvl;

    SaveManager.write();
    SFX.levelUp();
    MAP.showUnlockToast(`⬆️ ${t.displayName} upgraded to Lv.${nextLvl}!`);
    const unlockKeys = (upDef.unlockNodeIds || []).map(id => `node:${id}`);
    if (unlockKeys.length) MAP.flashHighlights(unlockKeys);
    MAP.refresh();
    _renderDetail(territoryId);
  }

  function openAssignmentPicker(nodeId) {
    _assignNodeId = nodeId;
    _renderAssignmentPicker(nodeId);
    const overlay = document.getElementById('overlay-assignment');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  function closeAssignmentPicker() {
    _assignNodeId = null;
    const overlay = document.getElementById('overlay-assignment');
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  function _renderAssignmentPicker(nodeId) {
    const nodeDef = TERRITORY_NODE_DEFINITIONS[nodeId];
    const title   = document.getElementById('assignment-picker-title');
    const list    = document.getElementById('assignment-picker-list');
    if (!nodeDef || !list) return;

    if (title) title.textContent = `Assign to ${nodeDef.displayName}`;

    const chars = Object.values(CHARACTER_DEFINITIONS)
      .filter(c => Unlock.isCharacterUnlocked(c.id));

    list.innerHTML = chars.map(c => {
      const status = getCharacterStatus(c.id);
      const skillLevel = PLAYER_DATA.characters[c.id].skills[nodeDef.skillType]?.level || 1;
      const yieldAmt = calcAssignmentYield(nodeId, c.id);
      let reason = '';
      if (status === 'active') reason = 'On battle team';
      else if (status === 'assigned') reason = 'Already assigned';
      else if (status === 'crafting') reason = 'Crafting';
      else {
        const r = ASSIGNMENT.canStart(c.id, nodeId);
        if (!r.ok) reason = r.reason;
      }
      const ready = status === 'idle' && ASSIGNMENT.canStart(c.id, nodeId).ok;

      return `
        <div class="assignment-char-row ${ready ? '' : 'assignment-char-disabled'}">
          <span class="assignment-char-icon" style="color:${c.color}">${c.icon}</span>
          <div class="assignment-char-info">
            <div class="assignment-char-name">${c.displayName}</div>
            <div class="assignment-char-meta">
              ${SKILL_DEFINITIONS[nodeDef.skillType].displayName} Lv.${skillLevel} ·
              Est. ${yieldAmt} ${RESOURCE_DEFINITIONS[nodeDef.resourceProduced]?.displayName || ''} ·
              ${nodeDef.workDurationSeconds}s
            </div>
            ${!ready ? `<div class="assignment-char-reason">${reason}</div>` : ''}
          </div>
          <button type="button" class="btn btn-sm btn-assign-char" data-char="${c.id}" data-node="${nodeId}"
            ${ready ? '' : 'disabled'}>Assign</button>
        </div>`;
    }).join('');

    list.querySelectorAll('.btn-assign-char').forEach(btn => {
      btn.addEventListener('click', () => {
        const result = ASSIGNMENT.start(btn.dataset.char, btn.dataset.node);
        if (!result.ok) {
          MAP.showUnlockToast(result.reason || 'Cannot assign.');
          return;
        }
        SFX.uiClick();
        closeAssignmentPicker();
        if (_selectedTerritoryId) _renderDetail(_selectedTerritoryId);
        SaveManager.write();
        MAP.refresh();
        MAP.showUnlockToast(`📋 ${CHARACTER_DEFINITIONS[btn.dataset.char].displayName} assigned!`);
      });
    });
  }

  function openCharacterStatus() {
    _renderCharacterStatus();
    const overlay = document.getElementById('overlay-char-status');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    if (_statusRefreshTimer) clearInterval(_statusRefreshTimer);
    _statusRefreshTimer = setInterval(() => {
      if (!document.getElementById('overlay-char-status')?.classList.contains('visible')) {
        clearInterval(_statusRefreshTimer);
        _statusRefreshTimer = null;
        return;
      }
      _renderCharacterStatus();
    }, 1000);
  }

  function closeCharacterStatus() {
    if (_statusRefreshTimer) {
      clearInterval(_statusRefreshTimer);
      _statusRefreshTimer = null;
    }
    const overlay = document.getElementById('overlay-char-status');
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  function _renderCharacterStatus() {
    const list = document.getElementById('char-status-list');
    if (!list) return;

    const chars = Object.values(CHARACTER_DEFINITIONS)
      .filter(c => Unlock.isCharacterUnlocked(c.id));

    list.innerHTML = chars.map(c => {
      const disp = getCharacterStatusDisplay(c.id);
      const charLvl = typeof getCharLevel === 'function' ? getCharLevel(c.id) : 1;
      return `
        <div class="char-status-row char-status-${disp.status}">
          <span class="char-status-icon" style="color:${c.color}">${c.icon}</span>
          <div class="char-status-info">
            <div class="char-status-name">${c.displayName} <span class="char-status-lvl">Lv.${charLvl}</span></div>
            <div class="char-status-detail">${disp.detail}</div>
          </div>
          <span class="char-status-badge">${disp.label}</span>
        </div>`;
    }).join('');
  }

  return {
    init, openWorldMap, openStartingField, openDetail, closeDetail, refreshIfOpen,
    openAssignmentPicker, closeAssignmentPicker,
    openCharacterStatus, closeCharacterStatus,
    upgradeTerritory: _upgradeTerritory,
  };
})();