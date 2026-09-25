'use strict';
// =============================================================
// offline.js — Offline progression (Phase 4)
// On load: regenerate nodes, complete elapsed assignments, show summary.
// =============================================================

const OFFLINE = (() => {

  let _pendingSummary = null;

  function processOnLoad() {
    migrateTerritorySaveState();
    migratePhase5SaveState();
    migratePhase6SaveState();
    const nowMs = Date.now();
    const lastMs = PLAYER_DATA.lastSessionMs || nowMs;
    const awayMs = Math.max(0, nowMs - lastMs);

    const regenAdded = regenerateAllResourceNodes(nowMs);
    const completed  = ASSIGNMENT.processAll(nowMs);
    const crafted    = typeof CRAFTING !== 'undefined' ? CRAFTING.processAll(nowMs) : [];
    const newTerritories = Unlock.checkTerritoryUnlocks();

    PLAYER_DATA.lastSessionMs = nowMs;
    SaveManager.write();

    const summary = {
      awayMs,
      regenAdded,
      completed,
      crafted,
      newTerritories,
    };

    if (awayMs > 5000 && (completed.length || crafted.length || regenAdded > 0.5 || newTerritories.length)) {
      _pendingSummary = summary;
    }
    return summary;
  }

  function hasPendingSummary() {
    return !!_pendingSummary;
  }

  function showPendingSummary() {
    if (!_pendingSummary) return;
    _renderSummary(_pendingSummary);
    _pendingSummary = null;
  }

  function _formatAway(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'a few moments';
    if (min < 60) return `${min} minute${min !== 1 ? 's' : ''}`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} hour${h !== 1 ? 's' : ''}`;
  }

  function _renderSummary(summary) {
    const overlay = document.getElementById('overlay-offline-summary');
    const body    = document.getElementById('offline-summary-body');
    if (!overlay || !body) return;

    const lines = [];
    lines.push(`<div class="offline-away">You were away for <strong>${_formatAway(summary.awayMs)}</strong>.</div>`);

    if (summary.regenAdded > 0) {
      lines.push(`<div class="offline-line">🌿 Resource nodes regenerated supplies.</div>`);
    }

    if (summary.newTerritories.length) {
      summary.newTerritories.forEach(id => {
        const t = TERRITORY_DEFINITIONS[id];
        if (t) lines.push(`<div class="offline-line">🗺️ Territory unlocked: <strong>${t.displayName}</strong></div>`);
      });
    }

    if (summary.completed.length) {
      lines.push('<div class="offline-section-title">Assignments Completed</div>');
      summary.completed.forEach(c => {
        const skName = SKILL_DEFINITIONS[c.skillType]?.displayName || c.skillType;
        const lvlTxt = c.levelUp ? ` <span class="offline-levelup">→ Lv.${c.newLevel}!</span>` : '';
        lines.push(
          `<div class="offline-completion">
            <span>${c.charIcon} <strong>${c.charName}</strong> at ${c.nodeName}</span>
            <span class="offline-reward">${c.resourceIcon} +${c.resourceAmount} ${c.resourceName}</span>
            <span class="offline-xp">+${c.xpGained} ${skName} XP${lvlTxt}</span>
          </div>`
        );
      });
    }

    const constructions = summary.crafted.filter(c => c.outputType === 'structure');
    const crafts = summary.crafted.filter(c => c.outputType !== 'structure');

    if (constructions.length) {
      lines.push('<div class="offline-section-title">Construction Completed</div>');
      constructions.forEach(c => {
        const lvlTxt = c.levelUp ? ` <span class="offline-levelup">→ Lv.${c.newLevel}!</span>` : '';
        lines.push(
          `<div class="offline-completion">
            <span>${c.charIcon} <strong>${c.charName}</strong> built ${c.outputIcon} ${c.outputLabel}</span>
            <span class="offline-xp">+${c.xpGained} ${c.skillName} XP${lvlTxt}</span>
          </div>`
        );
      });
    }

    if (crafts.length) {
      lines.push('<div class="offline-section-title">Crafting Completed</div>');
      crafts.forEach(c => {
        const lvlTxt = c.levelUp ? ` <span class="offline-levelup">→ Lv.${c.newLevel}!</span>` : '';
        lines.push(
          `<div class="offline-completion">
            <span>${c.charIcon} <strong>${c.charName}</strong> crafted ${c.outputIcon} ${c.outputLabel}</span>
            <span class="offline-xp">+${c.xpGained} ${c.skillName} XP${lvlTxt}</span>
          </div>`
        );
      });
    }

    if (!summary.completed.length && !summary.crafted.length && !summary.newTerritories.length && summary.regenAdded <= 0) {
      lines.push('<div class="offline-line">No jobs finished while you were away.</div>');
    }

    body.innerHTML = lines.join('');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    SFX.uiClick();
  }

  function closeSummary() {
    const overlay = document.getElementById('overlay-offline-summary');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  function init() {
    document.getElementById('btn-offline-close')?.addEventListener('click', closeSummary);
    document.getElementById('overlay-offline-summary')?.addEventListener('click', e => {
      if (e.target.id === 'overlay-offline-summary') closeSummary();
    });
  }

  function touchSession() {
    PLAYER_DATA.lastSessionMs = Date.now();
  }

  return { init, processOnLoad, showPendingSummary, hasPendingSummary, closeSummary, touchSession };
})();
