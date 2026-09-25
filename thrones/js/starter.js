'use strict';
// =============================================================
// starter.js — Starting character selection & stat allocation
// =============================================================

const STARTER = (() => {
  const STEP_PICK     = 'pick';
  const STEP_ALLOCATE = 'allocate';
  const STEP_REVIEW   = 'review';

  let _step            = STEP_PICK;
  let _selectedId      = null;
  let _allocations     = _emptyAlloc();

  function _emptyAlloc() {
    return normalizeStarterStatBonuses(null);
  }

  function needsSelection() {
    return !PLAYER_DATA.starterType;
  }

  function open() {
    _selectedId  = null;
    _allocations = _emptyAlloc();
    _showStep(STEP_PICK);
    _renderPick();
    UI.showScreen('screen-starter-select');
    SFX.uiClick();
  }

  function _showStep(step) {
    _step = step;
    ['pick', 'allocate', 'review'].forEach(id => {
      const el = document.getElementById(`starter-step-${id}`);
      if (el) el.classList.toggle('starter-step-active', id === step);
    });
  }

  function _formatStatValue(base, bonus) {
    if (bonus > 0) {
      return `${base}<span class="starter-stat-bonus"> + ${bonus}</span>`;
    }
    return String(base);
  }

  function _renderStatList(stats, bonuses, gear) {
    return STARTER_ALLOC_STAT_KEYS.map(key => {
      const label = STARTER_ALLOC_STAT_LABELS[key];
      const base  = stats[key] ?? 0;
      const alloc = bonuses?.[key] || 0;
      const gearOnly = gear?.[key] || 0;
      const displayBase = base + gearOnly;
      const displayBonus = alloc;
      return `
        <div class="starter-detail-row">
          <span class="starter-detail-label">${label}</span>
          <span class="starter-detail-value">${_formatStatValue(displayBase, displayBonus)}</span>
        </div>`;
    }).join('');
  }

  function _renderPick() {
    const grid = document.getElementById('starter-grid');
    if (!grid) return;

    grid.innerHTML = Object.values(STARTER_DEFINITIONS).map(def => {
      const info = getStarterPackageInfo(def.id);
      if (!info) return '';

      const abilityLine = info.ability
        ? `<div class="starter-detail-block">
             <div class="starter-detail-heading">Unique Skill</div>
             <div class="starter-detail-skill">${info.ability.icon} <strong>${info.ability.displayName}</strong></div>
             <div class="starter-detail-skill-desc">${info.ability.description}</div>
           </div>`
        : '';

      const equipLine = info.equipment.length
        ? `<div class="starter-detail-block">
             <div class="starter-detail-heading">Starting Equipment</div>
             <ul class="starter-detail-list">${info.equipment.map(e =>
               `<li>${e.icon} ${e.name}</li>`).join('')}</ul>
           </div>`
        : '';

      const resLine = info.resources.length
        ? `<div class="starter-detail-block">
             <div class="starter-detail-heading">Starting Resources</div>
             <ul class="starter-detail-list">${info.resources.map(r =>
               `<li>${r.icon} ${r.qty}× ${r.name}</li>`).join('')}</ul>
           </div>`
        : '';

      const regionLine = info.region
        ? `<div class="starter-detail-block">
             <div class="starter-detail-heading">Skill Tree Region</div>
             <div class="starter-detail-region" style="--region-color:${info.region.color}">
               ${info.region.icon} ${info.region.displayName}
             </div>
           </div>`
        : '';

      return `
        <article class="starter-card" data-starter="${def.id}">
          <div class="starter-card-top">
            <div class="starter-card-icon">${def.icon}</div>
            <div class="starter-card-name">${def.displayName}</div>
            <div class="starter-card-desc">${def.desc}</div>
          </div>
          <div class="starter-card-details">
            <div class="starter-detail-block">
              <div class="starter-detail-heading">Starting Stats</div>
              ${_renderStatList(info.baseStats, _emptyAlloc(), null)}
            </div>
            ${abilityLine}
            ${equipLine}
            ${resLine}
            ${regionLine}
          </div>
          <button type="button" class="starter-card-cta" data-starter="${def.id}">
            Choose ${def.displayName}
          </button>
        </article>`;
    }).join('');

    grid.querySelectorAll('.starter-card-cta').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _chooseStarter(btn.dataset.starter);
      });
    });
  }

  function _chooseStarter(starterId) {
    if (!STARTER_DEFINITIONS[starterId]) return;
    _selectedId  = starterId;
    _allocations = _emptyAlloc();
    _renderAllocate();
    _showStep(STEP_ALLOCATE);
    SFX.uiClick();
  }

  function _pointsUsed() {
    return STARTER_ALLOC_STAT_KEYS.reduce((sum, k) => sum + (_allocations[k] || 0), 0);
  }

  function _pointsRemaining() {
    return STARTER_FREE_STAT_POINTS - _pointsUsed();
  }

  function _renderAllocate() {
    const info = getStarterPackageInfo(_selectedId);
    if (!info) return;

    const heroEl = document.getElementById('starter-alloc-hero');
    if (heroEl) {
      heroEl.innerHTML = `
        <div class="starter-alloc-icon">${info.pack.icon}</div>
        <div>
          <div class="starter-alloc-name">${info.pack.displayName}</div>
          <div class="starter-alloc-hint">Tap + to add points · Tap − to remove</div>
        </div>`;
    }

    const subtitle = document.getElementById('starter-alloc-subtitle');
    if (subtitle) {
      subtitle.textContent = `Assign all ${STARTER_FREE_STAT_POINTS} free points to ${info.pack.displayName}'s combat stats.`;
    }

    const rows = document.getElementById('starter-stat-rows');
    if (rows) {
      const gear = _sumStarterEquipmentStats(info.pack.equip, info.charId);
      rows.innerHTML = STARTER_ALLOC_STAT_KEYS.map(key => {
        const label = STARTER_ALLOC_STAT_LABELS[key];
        const base  = (info.baseStats[key] || 0) + (gear[key] || 0);
        const alloc = _allocations[key] || 0;
        return `
          <div class="starter-stat-row" data-stat="${key}">
            <span class="starter-stat-label">${label}</span>
            <span class="starter-stat-value">${_formatStatValue(base, alloc)}</span>
            <div class="starter-stat-controls">
              <button type="button" class="starter-stat-btn" data-action="dec" aria-label="Remove ${label} point">−</button>
              <button type="button" class="starter-stat-btn" data-action="inc" aria-label="Add ${label} point">+</button>
            </div>
          </div>`;
      }).join('');

      rows.querySelectorAll('.starter-stat-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const row  = btn.closest('.starter-stat-row');
          const stat = row?.dataset.stat;
          if (!stat) return;
          if (btn.dataset.action === 'inc') _incStat(stat);
          else _decStat(stat);
        });
      });
    }

    _updatePointsUI();
  }

  function _incStat(stat) {
    if (_pointsRemaining() <= 0) return;
    _allocations[stat] = (_allocations[stat] || 0) + 1;
    _renderAllocate();
    SFX.uiClick();
  }

  function _decStat(stat) {
    if ((_allocations[stat] || 0) <= 0) return;
    _allocations[stat] -= 1;
    _renderAllocate();
    SFX.uiClick();
  }

  function _updatePointsUI() {
    const left = _pointsRemaining();
    const leftEl = document.getElementById('starter-points-left');
    if (leftEl) leftEl.textContent = String(left);

    const reviewBtn = document.getElementById('starter-btn-to-review');
    if (reviewBtn) reviewBtn.disabled = left !== 0;
  }

  function _renderReview() {
    const body = document.getElementById('starter-review-body');
    const info = getStarterPackageInfo(_selectedId);
    if (!body || !info) return;

    const gear = _sumStarterEquipmentStats(info.pack.equip, info.charId);

    const statRows = STARTER_ALLOC_STAT_KEYS.map(key => {
      const label = STARTER_ALLOC_STAT_LABELS[key];
      const baseWithGear = (info.baseStats[key] || 0) + (gear[key] || 0);
      const alloc = _allocations[key] || 0;
      return `
        <div class="starter-detail-row">
          <span class="starter-detail-label">${label}</span>
          <span class="starter-detail-value starter-detail-final">${_formatStatValue(baseWithGear, alloc)}</span>
        </div>`;
    }).join('');

    const allocSummary = STARTER_ALLOC_STAT_KEYS
      .filter(k => _allocations[k] > 0)
      .map(k => `+${_allocations[k]} ${STARTER_ALLOC_STAT_LABELS[k]}`)
      .join(' · ') || 'None';

    body.innerHTML = `
      <div class="starter-review-hero">
        <span class="starter-review-icon">${info.pack.icon}</span>
        <div>
          <div class="starter-review-name">${info.pack.displayName}</div>
          <div class="starter-review-sub">${info.charDef.displayName} · ${info.pack.desc}</div>
        </div>
      </div>
      <div class="starter-review-section">
        <div class="starter-detail-heading">Final Stats</div>
        ${statRows}
        <div class="starter-review-alloc-note">Bonuses assigned: ${allocSummary}</div>
      </div>
      ${info.ability ? `
      <div class="starter-review-section">
        <div class="starter-detail-heading">Unique Starting Skill</div>
        <div class="starter-detail-skill">${info.ability.icon} <strong>${info.ability.displayName}</strong></div>
        <div class="starter-detail-skill-desc">${info.ability.description}</div>
      </div>` : ''}
      ${info.region ? `
      <div class="starter-review-section">
        <div class="starter-detail-heading">Skill Tree Region</div>
        <div class="starter-detail-region" style="--region-color:${info.region.color}">
          ${info.region.icon} ${info.region.displayName}
        </div>
      </div>` : ''}`;
  }

  function _goToReview() {
    if (_pointsRemaining() !== 0) return;
    _renderReview();
    _showStep(STEP_REVIEW);
    SFX.uiClick();
  }

  function _confirm() {
    if (!_selectedId || _pointsRemaining() !== 0) return;
    applyStarterPack(_selectedId, _allocations);
    SFX.levelUp();
    _goToMap();
  }

  function _goToMap() {
    UI.showScreen('screen-map');
    try { MAP.refresh(); } catch (_) {}
    MAP.showUnlockToast(`Welcome, ${STARTER_DEFINITIONS[_selectedId].displayName}!`);
    setTimeout(() => {
      if (typeof MAP !== 'undefined' && MAP.openStartingField) {
        MAP.openStartingField();
      }
      MAP.showUnlockToast('⚔️ Fight Slime Group to begin your campaign!');
    }, 700);
  }

  function init() {
    document.getElementById('starter-btn-back-pick')?.addEventListener('click', () => {
      _showStep(STEP_PICK);
      SFX.uiClick();
    });
    document.getElementById('starter-btn-back-alloc')?.addEventListener('click', () => {
      _renderAllocate();
      _showStep(STEP_ALLOCATE);
      SFX.uiClick();
    });
    document.getElementById('starter-btn-to-review')?.addEventListener('click', _goToReview);
    document.getElementById('starter-btn-confirm')?.addEventListener('click', _confirm);
  }

  return { init, open, needsSelection };
})();
