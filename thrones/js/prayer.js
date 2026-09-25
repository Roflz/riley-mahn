'use strict';
// =============================================================
// prayer.js — PRAYER module
// Lets the player pick one active prayer before battles.
// The selected prayer applies a flat buff to every player unit
// at the start of battle (ATK, DEF, and/or crit chance bonus).
//
// Prayer levels are earned by the Guardian (prayer XP in their
// skillXpRates), but the average team prayer level is used as
// the gate so any team can eventually unlock prayers.
// =============================================================

const PRAYER = (() => {

  // ── Open / Close ──────────────────────────────────────────────
  function open() {
    _render();
    const overlay = document.getElementById('overlay-prayer');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    SFX.uiClick();
  }

  function close() {
    const overlay = document.getElementById('overlay-prayer');
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  // ── Select / deselect prayer ──────────────────────────────────
  function select(prayerId) {
    if (PLAYER_DATA.activePrayer === prayerId) {
      // Tap again to deactivate
      PLAYER_DATA.activePrayer = null;
    } else {
      PLAYER_DATA.activePrayer = prayerId;
    }
    SaveManager.write();
    _render();
    SFX.uiClick();
  }

  // ── Apply active prayer to all player BattleUnits ─────────────
  // Called by main.js right after BattleState is created.
  function applyToBattle(battleState) {
    const pDef = getActivePrayerDef();
    if (!pDef) return;

    const prayerLevel = teamPrayerLevel();
    if (prayerLevel < pDef.prayerReq) return;
    if (pDef.requiresShrine && !isBuildingBuilt('shrine')) return;

    const eff = pDef.effect;
    battleState.playerTeam.forEach(unit => {
      if (!unit.alive) return;
      if (eff.atk)       unit.attack     += eff.atk;
      if (eff.def)       unit.applyDefBuff(eff.def, 999); // lasts whole battle
      if (eff.critBonus) unit.critChance  = Math.min(50, unit.critChance + eff.critBonus);
    });

    battleState._log(
      `✨ ${pDef.icon} ${pDef.displayName} is active! (${_effectSummary(eff)})`,
      'prayer'
    );
  }

  // ── Render ────────────────────────────────────────────────────
  function _render() {
    const container = document.getElementById('prayer-list');
    if (!container) return;

    const prayerLevel = teamPrayerLevel();
    const shrineBuilt = isBuildingBuilt('shrine');
    const active      = PLAYER_DATA.activePrayer;

    container.innerHTML = PRAYER_DEFINITIONS.map(pDef => {
      const locked     = prayerLevel < pDef.prayerReq;
      const shrineGate = pDef.requiresShrine && !shrineBuilt;
      const isActive   = active === pDef.id;
      const blocked    = locked || shrineGate;

      const tags = _effectSummary(pDef.effect);

      return `
        <div class="prayer-card ${isActive ? 'prayer-active' : ''} ${blocked ? 'prayer-locked' : ''}"
             data-prayer="${pDef.id}">
          <div class="prayer-card-top">
            <span class="prayer-icon">${pDef.icon}</span>
            <div class="prayer-info">
              <div class="prayer-name">${pDef.displayName}${isActive ? ' <span class="prayer-on-badge">● Active</span>' : ''}</div>
              <div class="prayer-desc">${pDef.description}</div>
              <div class="prayer-tags">${tags}</div>
              <div class="prayer-req ${locked ? 'req-unmet' : 'req-met'}">
                ✨ Prayer Lv.${pDef.prayerReq} ${locked ? `(team avg: ${prayerLevel})` : '✓'}
                ${pDef.requiresShrine ? `· ${shrineBuilt ? '⛩️ Shrine ✓' : '<span class="req-unmet">⛩️ Shrine required</span>'}` : ''}
              </div>
            </div>
          </div>
          <button class="btn btn-prayer-select ${isActive ? 'btn-prayer-on' : ''}"
                  data-prayer="${pDef.id}"
                  ${blocked ? 'disabled' : ''}>
            ${isActive ? '🙏 Deactivate' : '🙏 Activate'}
          </button>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-prayer-select').forEach(btn => {
      btn.addEventListener('click', () => select(btn.dataset.prayer));
    });

    // Update the map header badge
    _updateBadge();
  }

  function _updateBadge() {
    const badge = document.getElementById('prayer-badge');
    if (!badge) return;
    const pDef = getActivePrayerDef();
    badge.textContent  = pDef ? pDef.icon : '';
    badge.style.display = pDef ? 'inline' : 'none';
  }

  function _effectSummary(eff) {
    const parts = [];
    if (eff.atk)       parts.push(`+${eff.atk} ATK`);
    if (eff.def)       parts.push(`+${eff.def} DEF`);
    if (eff.critBonus) parts.push(`+${eff.critBonus}% Crit`);
    return parts.map(p => `<span class="prayer-tag">${p}</span>`).join('');
  }

  function init() {
    document.getElementById('btn-prayer-close')?.addEventListener('click', close);
    document.getElementById('btn-prayer-open')?.addEventListener('click', open);
    _updateBadge();
  }

  return { init, open, close, select, applyToBattle };
})();
