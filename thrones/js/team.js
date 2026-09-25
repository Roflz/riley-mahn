'use strict';
// =============================================================
// team.js — Team management overlay
// Lets the player swap heroes in / out of the active 3-slot team.
// =============================================================

const TEAM = (() => {

  // ── Open / close ──────────────────────────────────────────────────
  function open() {
    _render();
    const overlay = document.getElementById('overlay-team');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  function close() {
    const overlay = document.getElementById('overlay-team');
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  // ── Render ────────────────────────────────────────────────────────
  function _render() {
    const container = document.getElementById('team-overlay-body');
    const team      = PLAYER_DATA.team;
    const teamSet   = new Set(team);
    const allUnlocked = Object.values(CHARACTER_DEFINITIONS)
      .filter(def => Unlock.isCharacterUnlocked(def.id));

    const activeChars = team.map(id => CHARACTER_DEFINITIONS[id]).filter(Boolean);
    const benchChars  = allUnlocked.filter(def => !teamSet.has(def.id));

    // Active slots
    const activeHTML = activeChars.map(def => {
      const combatLvl = getCombatLevel(def.id);
      const effective = getEffectiveStats(def.id);
      const canRemove = team.length > 1;   // must keep at least 1
      const status    = getCharacterStatus(def.id);
      return `
        <div class="team-slot team-slot-active" style="--hero-color:${def.color}">
          <div class="team-slot-icon">${def.icon}</div>
          <div class="team-slot-info">
            <div class="team-slot-name">${def.displayName} <span class="team-status-tag">${status}</span></div>
            <div class="team-slot-stats">Lv.${combatLvl} · HP ${effective.baseMaxHP} · ATK ${effective.baseAttack}</div>
          </div>
          ${canRemove
            ? `<button class="team-slot-btn btn-remove-hero" data-char="${def.id}" aria-label="Remove ${def.displayName}">–</button>`
            : `<span class="team-slot-required" title="Team must have at least one hero">⚓</span>`
          }
        </div>`;
    }).join('');

    // Empty slot indicator if team < 3
    const emptySlots = 3 - team.length;
    const emptyHTML  = emptySlots > 0
      ? Array(emptySlots).fill(0).map(() =>
          `<div class="team-slot team-slot-empty">
            <div class="team-slot-empty-icon">＋</div>
            <div class="team-slot-empty-label">Empty Slot</div>
          </div>`
        ).join('')
      : '';

    // Bench heroes
    const benchHTML = benchChars.length > 0
      ? benchChars.map(def => {
          const combatLvl = getCombatLevel(def.id);
          const effective = getEffectiveStats(def.id);
          const isFull    = team.length >= 3;
          const assigned  = typeof ASSIGNMENT !== 'undefined' && ASSIGNMENT.isCharacterAssigned(def.id);
          const crafting  = typeof CRAFTING !== 'undefined' && CRAFTING.isCharacterCrafting(def.id);
          const busy      = assigned || crafting;
          const status    = getCharacterStatus(def.id);
          return `
            <div class="team-slot team-slot-bench ${busy ? 'team-slot-assigned' : ''}" style="--hero-color:${def.color}">
              <div class="team-slot-icon">${def.icon}</div>
              <div class="team-slot-info">
                <div class="team-slot-name">${def.displayName} <span class="team-status-tag">${status}</span></div>
                <div class="team-slot-stats">Lv.${combatLvl} · HP ${effective.baseMaxHP} · ATK ${effective.baseAttack}</div>
              </div>
              <button class="team-slot-btn btn-add-hero" data-char="${def.id}"
                ${isFull || busy ? `disabled title="${crafting ? 'Crafting' : assigned ? 'On assignment' : 'Remove a hero first'}"` : `aria-label="Add ${def.displayName}"`}>
                ＋
              </button>
            </div>`;
        }).join('')
      : '<div class="team-bench-empty">All unlocked heroes are on your team.</div>';

    container.innerHTML = `
      <div class="team-section-label">Active Team (${team.length}/3)</div>
      <div class="team-slots-list">${activeHTML}${emptyHTML}</div>
      <div class="team-section-label team-section-bench">Reserve Heroes</div>
      <div class="team-slots-list">${benchHTML}</div>
    `;

    // Wire buttons
    container.querySelectorAll('.btn-remove-hero').forEach(btn => {
      btn.addEventListener('click', () => { _removeHero(btn.dataset.char); _render(); });
    });
    container.querySelectorAll('.btn-add-hero').forEach(btn => {
      btn.addEventListener('click', () => { _addHero(btn.dataset.char); _render(); });
    });
  }

  function _addHero(charId) {
    if (PLAYER_DATA.team.length >= 3) return;
    if (!Unlock.isCharacterUnlocked(charId)) return;
    if (typeof ASSIGNMENT !== 'undefined' && ASSIGNMENT.isCharacterAssigned(charId)) {
      MAP.showUnlockToast('Hero is on a gathering assignment — cancel it first.');
      return;
    }
    if (typeof CRAFTING !== 'undefined' && CRAFTING.isCharacterCrafting(charId)) {
      MAP.showUnlockToast('Hero is crafting — wait for the job to finish.');
      return;
    }
    if (!PLAYER_DATA.team.includes(charId)) {
      PLAYER_DATA.team.push(charId);
      SaveManager.write();
      MAP.refresh();
    }
  }

  function _removeHero(charId) {
    if (PLAYER_DATA.team.length <= 1) return;   // keep at least one
    PLAYER_DATA.team = PLAYER_DATA.team.filter(id => id !== charId);
    SaveManager.write();
    MAP.refresh();
  }

  // ── Init ─────────────────────────────────────────────────────────
  function init() {
    document.getElementById('btn-team-open').addEventListener('click', open);
    document.getElementById('btn-team-close').addEventListener('click', close);
    document.getElementById('overlay-team').addEventListener('click', e => {
      if (e.target === document.getElementById('overlay-team')) close();
    });
  }

  return { init, open, close };
})();
