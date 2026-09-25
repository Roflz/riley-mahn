'use strict';
// =============================================================
// skilltree.js — Unified skill tree UI (Phase 6)
// Region-grouped list; nodes unlock via connected paths.
// =============================================================

const SKILLTREE = (() => {

  let _activeCharId = null;

  function open(charId) {
    _activeCharId = charId || PLAYER_DATA.team[0];
    _render();
    const overlay = document.getElementById('overlay-skilltree');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    SFX.uiClick();
  }

  function close() {
    const overlay = document.getElementById('overlay-skilltree');
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  function purchaseNode(nodeId) {
    const result = unlockSkillNode(_activeCharId, nodeId);
    if (!result.ok) {
      _showFeedback(result.reason || 'Cannot unlock.', 'error');
      return;
    }
    SFX.levelUp();
    _showFeedback(`Unlocked: ${result.node.displayName}!`, 'success');
    if (typeof ACCOUNT !== 'undefined' && ACCOUNT.refreshIfOpen) ACCOUNT.refreshIfOpen();
    _render();
  }

  function _render() {
    _renderHeroTabs();
    _renderPointsBar();
    _renderTree();
  }

  function _renderHeroTabs() {
    const container = document.getElementById('st-hero-tabs');
    if (!container) return;
    const chars = Object.values(CHARACTER_DEFINITIONS)
      .filter(c => Unlock.isCharacterUnlocked(c.id));

    container.innerHTML = chars.map(def => {
      const pts  = PLAYER_DATA.characters[def.id].skillPoints || 0;
      const lvl  = getCharLevel(def.id);
      const active = def.id === _activeCharId ? ' st-tab-active' : '';
      return `<button class="st-hero-tab${active}" data-char="${def.id}">
        <span class="st-tab-icon">${def.icon}</span>
        <span class="st-tab-name">${def.displayName}</span>
        <span class="st-tab-lvl">Lv.${lvl}</span>
        ${pts > 0 ? `<span class="st-tab-pts">${pts}</span>` : ''}
      </button>`;
    }).join('');

    container.querySelectorAll('.st-hero-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeCharId = btn.dataset.char;
        _render();
      });
    });
  }

  function _renderPointsBar() {
    const char = PLAYER_DATA.characters[_activeCharId];
    const pts  = char ? (char.skillPoints || 0) : 0;
    const lvl  = getCharLevel(_activeCharId);
    const el   = document.getElementById('st-points-display');
    if (el) {
      el.innerHTML = `<span>Lv.${lvl} / ${MAX_CHAR_LEVEL}</span> · ` +
        (pts > 0 ? `✨ ${pts} Skill Point${pts !== 1 ? 's' : ''}` : '✨ 0 Points (level up to earn more)');
      el.className = pts > 0 ? 'st-points-display st-points-have' : 'st-points-display';
    }
  }

  function _renderTree() {
    const container = document.getElementById('st-tree-body');
    if (!container) return;

    const charDef = CHARACTER_DEFINITIONS[_activeCharId];
    const nameEl  = document.getElementById('st-tree-name');
    if (nameEl) nameEl.textContent = `${charDef?.icon || ''} Unified Skill Tree`;

    const hdrsEl = document.getElementById('st-branch-headers');
    if (hdrsEl) hdrsEl.innerHTML = '';

    const owned = new Set(getUnlockedSkillNodes(_activeCharId));
    const regions = Object.values(SKILL_TREE_REGIONS);

    container.innerHTML = regions.map(region => {
      const nodes = Object.values(UNIFIED_SKILL_TREE_NODES).filter(n => n.region === region.id);
      if (!nodes.length) return '';

      const nodeHTML = nodes.map(node => {
        const isOwned = owned.has(node.id);
        const available = !isOwned && isSkillNodeAvailable(_activeCharId, node.id);
        let state = 'locked';
        if (isOwned) state = 'owned';
        else if (available) state = 'available';

        const typeLabel = node.nodeType === 'ability' ? '⚡ Ability'
          : node.nodeType === 'keystone' ? '💎 Keystone'
          : node.nodeType === 'passive' ? '◆ Passive' : '＋ Stat';

        const unlocks = (node.abilityUnlockIds || []).map(id => ABILITY_DEFINITIONS[id]?.displayName).filter(Boolean).join(', ');

        return `
          <div class="st-unified-node st-node-${state}" data-id="${node.id}">
            <div class="st-unified-node-head">
              <span class="st-unified-icon">${node.icon}</span>
              <div>
                <div class="st-unified-name">${node.displayName}</div>
                <div class="st-unified-type">${typeLabel}${node.isKeystone ? ' · Keystone' : ''}</div>
              </div>
              <span class="st-unified-cost">${isOwned ? '✓' : (node.cost || 0) + 'pt'}</span>
            </div>
            <div class="st-unified-desc">${node.description}</div>
            ${unlocks ? `<div class="st-unified-unlocks">Unlocks: ${unlocks}</div>` : ''}
          </div>`;
      }).join('');

      return `
        <div class="st-region-block" style="--region-color:${region.color}">
          <h3 class="st-region-title">${region.icon} ${region.displayName}</h3>
          <div class="st-region-nodes">${nodeHTML}</div>
        </div>`;
    }).join('');

    container.querySelectorAll('.st-node-available').forEach(el => {
      el.addEventListener('click', () => purchaseNode(el.dataset.id));
    });
    container.querySelectorAll('.st-node-locked').forEach(el => {
      el.addEventListener('click', () => {
        const check = canUnlockSkillNode(_activeCharId, el.dataset.id);
        _showFeedback(check.reason || 'Locked.', 'error');
      });
    });
  }

  let _feedbackTimer = null;
  function _showFeedback(msg, type = 'success') {
    const el = document.getElementById('st-feedback');
    if (!el) return;
    el.textContent = msg;
    el.className = `cooking-feedback cooking-feedback-${type} cooking-feedback-visible`;
    clearTimeout(_feedbackTimer);
    _feedbackTimer = setTimeout(() => el.classList.remove('cooking-feedback-visible'), 2500);
  }

  const RESPEC_COST = 500;

  function respec() {
    const charId = _activeCharId;
    const char   = PLAYER_DATA.characters[charId];
    const nodes  = (char.skillTreeNodes || []).filter(id => {
      const n = UNIFIED_SKILL_TREE_NODES[id];
      return n && !n.isStarter;
    });
    if (!nodes.length) {
      _showFeedback('No purchased nodes to respec.', 'error');
      return;
    }
    if (PLAYER_DATA.gold < RESPEC_COST) {
      _showFeedback(`Need ◈ ${RESPEC_COST} Gold.`, 'error');
      return;
    }

    const refunded = nodes.reduce((sum, id) => sum + (UNIFIED_SKILL_TREE_NODES[id]?.cost || 1), 0);
    const starter  = getStarterNodeId(charId);
    PLAYER_DATA.gold -= RESPEC_COST;
    char.skillPoints = (char.skillPoints || 0) + refunded;
    char.skillTreeNodes = starter ? [starter] : [];
    syncCharacterAbilities(charId);
    SaveManager.write();
    MAP.refresh();
    _render();
    _showFeedback(`Respec complete! Refunded ${refunded} point(s).`, 'success');
  }

  function refreshIfOpen() {
    const overlay = document.getElementById('overlay-skilltree');
    if (overlay && overlay.classList.contains('visible')) _render();
  }

  function init() {
    document.getElementById('btn-skilltree-close')?.addEventListener('click', close);
    document.getElementById('btn-skilltree-respec')?.addEventListener('click', respec);
    document.getElementById('btn-skilltree-open')?.addEventListener('click', () => {
      SFX.uiClick();
      open(PLAYER_DATA.team[0]);
    });
  }

  return { init, open, close, purchaseNode, respec, refreshIfOpen };
})();
