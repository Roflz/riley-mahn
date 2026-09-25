'use strict';
// =============================================================
// ui.js — Pure DOM rendering layer (no game logic)
// All functions receive BattleState and emit DOM changes only.
// =============================================================

const UI = (() => {
  // ── Utilities ────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  function hpColor(pct) {
    if (pct > 0.6) return 'var(--hp-high)';
    if (pct > 0.3) return 'var(--hp-mid)';
    return 'var(--hp-low)';
  }

  // ── Screen switching (scene manager) ─────────────────────────────
  function showScreen(id) {
    const target = $(id);
    if (!target) {
      console.error('[UI] showScreen: unknown screen', id);
      return;
    }
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    target.classList.add('active');
    if (id === 'screen-map' && typeof MAP !== 'undefined' && MAP.onMapVisible) {
      requestAnimationFrame(() => MAP.onMapVisible());
    }
  }

  // ── Battle Select screen ─────────────────────────────────────────
  function renderSelect(battleDefs, playerTeamDefs, onSelect) {
    // Team preview
    const preview = $('team-preview-row');
    preview.innerHTML = '';
    playerTeamDefs.forEach(def => {
      const el = document.createElement('div');
      el.className = 'team-preview-card';
      el.style.setProperty('--unit-color', def.color);
      el.innerHTML = `
        <div class="preview-icon">${def.icon}</div>
        <div class="preview-name">${def.displayName}</div>
        <div class="preview-stats">${def.baseMaxHP} HP &middot; ${def.baseAttack} ATK &middot; ${def.baseSpeed} SPD</div>
      `;
      preview.appendChild(el);
    });

    // Battle list
    const list = $('battle-list-items');
    list.innerHTML = '';
    battleDefs.forEach(def => {
      const icons = def.enemyTeam.map(id => ENEMY_DEFINITIONS[id].icon).join(' ');
      const el = document.createElement('div');
      el.className = 'battle-list-item';
      el.innerHTML = `
        <div class="bli-left">
          <div class="bli-name">${def.displayName}</div>
          <div class="bli-enemies">${icons}</div>
        </div>
        <div class="bli-right">
          <div class="bli-reward">+${def.goldReward} <span class="gold-icon">◈</span></div>
          <div class="bli-reward">+${def.xpReward} XP</div>
        </div>
        <div class="bli-arrow">›</div>
      `;
      el.addEventListener('click', () => onSelect(def));
      list.appendChild(el);
    });
  }

  // ── Unit card HTML ───────────────────────────────────────────────
  function _unitCardInnerHTML(unit, isActive) {
    const pct = unit.hpPct * 100;
    const color = hpColor(unit.hpPct);
    const badges = [];

    if (unit.skillCD > 0) {
      badges.push(`<span class="badge badge-cd">CD ${unit.skillCD}</span>`);
    }
    if (unit.defBuff > 0) {
      badges.push(`<span class="badge badge-buff">+${unit.defBuff} DEF</span>`);
    }

    const turnTag = isActive && unit.alive
      ? '<div class="turn-tag">▶ TURN</div>'
      : '';

    return `
      ${turnTag}
      <div class="unit-icon">${unit.alive ? unit.icon : '💀'}</div>
      <div class="unit-name">${unit.name}</div>
      <div class="unit-hp-text">${unit.alive ? unit.hp : 0} / ${unit.maxHP}</div>
      <div class="hp-track"><div class="hp-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
      <div class="badge-row">${badges.join('')}</div>
    `;
  }

  function _unitCardClasses(unit, isActive) {
    let cls = 'unit-card';
    cls += unit.isPlayer ? ' is-player' : ' is-enemy';
    if (isActive) cls += ' is-active';
    if (!unit.alive) cls += ' is-defeated';
    return cls;
  }

  // ── Arena rendering ──────────────────────────────────────────────
  function _renderArena(arenaId, team, activeUnit) {
    const arena = $(arenaId);
    const existing = arena.querySelectorAll('.unit-card');

    if (existing.length !== team.length) {
      // Build from scratch (first render or team size change)
      arena.innerHTML = '';
      team.forEach((unit, i) => {
        const card = document.createElement('div');
        card.className = _unitCardClasses(unit, unit === activeUnit);
        card.dataset.slot = i;
        card.dataset.team = unit.isPlayer ? 'player' : 'enemy';
        card.innerHTML = _unitCardInnerHTML(unit, unit === activeUnit);
        arena.appendChild(card);
      });
    } else {
      // Update in-place (preserves targeting handlers added by enterTargeting)
      team.forEach((unit, i) => {
        const card = existing[i];
        const isActive = unit === activeUnit;
        // Only update class and innerHTML if not in targeting mode
        // (targeting mode adds is-targetable — preserved via classList manipulation)
        const wasTargetable = card.classList.contains('is-targetable');
        card.className = _unitCardClasses(unit, isActive);
        if (wasTargetable) card.classList.add('is-targetable');
        card.innerHTML = _unitCardInnerHTML(unit, isActive);
      });
    }
  }

  // ── Battle log ───────────────────────────────────────────────────
  function _renderLog(state) {
    const inner = $('battle-log-inner');
    const rendered = inner.children.length;
    const newEntries = state.log.slice(rendered);

    newEntries.forEach(entry => {
      const div = document.createElement('div');
      div.className = `log-entry log-${entry.type}`;
      div.textContent = entry.text;
      inner.appendChild(div);
    });

    // Auto-scroll
    inner.scrollTop = inner.scrollHeight;
  }

  let _onAbilityClick = null;

  function setAbilityClickHandler(fn) {
    _onAbilityClick = fn;
  }

  function _renderAbilityBar(unit, enabled) {
    const bar = $('ability-bar');
    if (!bar) return;
    if (!unit || !enabled) {
      bar.innerHTML = '';
      return;
    }

    const abilities = unit.abilities || [];
    if (!abilities.length) {
      bar.innerHTML = '';
      return;
    }

    bar.innerHTML = abilities.map(aid => {
      const ab = ABILITY_DEFINITIONS[aid];
      if (!ab || ab.abilityType === 'passive') return '';
      const canUse = unit.canUseAbility(aid);
      const cd = unit.abilityCDs[aid] || 0;
      let label = `${ab.icon} ${ab.displayName}`;
      if (cd > 0) label += ` (${cd})`;
      else if ((ab.manaCost || 0) > 0) label += ` [${ab.manaCost}◈]`;
      return `<button type="button" class="btn btn-ability ${canUse ? '' : 'btn-ability-disabled'}"
        data-ability="${aid}" ${canUse ? '' : 'disabled'} title="${ab.description}">${label}</button>`;
    }).join('');

    bar.querySelectorAll('.btn-ability:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        if (_onAbilityClick) _onAbilityClick(btn.dataset.ability);
      });
    });
  }

  // ── Action panel ─────────────────────────────────────────────────
  function _renderActionPanel(state) {
    const info       = $('action-info');
    const btnAttack  = $('btn-attack');
    const btnSkill   = $('btn-skill');
    const btnAuto    = $('btn-auto');
    if (btnSkill) btnSkill.style.display = 'none';

    btnAuto.textContent = state.autoBattle ? '🤖 Auto: ON' : '🤖 Auto: OFF';
    btnAuto.classList.toggle('auto-on', state.autoBattle);

    if (state.phase === 'player_input') {
      const unit = state.currentUnit;
      const manaTxt = unit ? ` · ◈ ${unit.mana}/${unit.maxMana}` : '';
      info.textContent = `${unit?.icon || ''} ${unit?.name || ''}'s turn${manaTxt}`;
      btnAttack.disabled = false;
      _renderAbilityBar(unit, true);

    } else if (state.phase === 'victory') {
      info.textContent = '⚔️  Victory!';
      btnAttack.disabled = true;
      _renderAbilityBar(null, false);
    } else if (state.phase === 'defeat') {
      info.textContent = '💀  Defeat…';
      btnAttack.disabled = true;
      _renderAbilityBar(null, false);
    } else {
      const unit = state.currentUnit;
      info.textContent = unit
        ? `${unit.icon} ${unit.name} is acting…`
        : 'Processing…';
      btnAttack.disabled = true;
      _renderAbilityBar(null, false);
    }
  }

  // ── Full battle render (call on every state change) ──────────────
  function renderBattle(state) {
    _renderArena('enemy-arena',  state.enemyTeam,  state.currentUnit);
    _renderArena('player-arena', state.playerTeam, state.currentUnit);
    _renderLog(state);
    _renderActionPanel(state);
    $('round-label').textContent = `Round ${state.round}`;
  }

  // ── Targeting mode ───────────────────────────────────────────────
  /**
   * Highlight clickable targets and attach handlers.
   * @param {boolean} isAllyTarget - true = highlight player cards; false = enemy cards
   * @param {BattleState} state
   * @param {function} onTarget - called with the chosen BattleUnit
   */
  function enterTargeting(isAllyTarget, state, onTarget, label) {
    const arenaId = isAllyTarget ? 'player-arena' : 'enemy-arena';

    $(arenaId).querySelectorAll('.unit-card').forEach(card => {
      const slot = parseInt(card.dataset.slot, 10);
      const unit = isAllyTarget ? state.playerTeam[slot] : state.enemyTeam[slot];
      if (unit && unit.alive) {
        card.classList.add('is-targetable');
        card._onTarget = () => onTarget(unit);
        card.addEventListener('click', card._onTarget);
      }
    });

    const bar      = $('targeting-bar');
    const barLabel = $('targeting-bar-label');
    bar.classList.remove('hidden', 'food-mode');
    if (barLabel) barLabel.textContent = label || 'Select a target';
    if (label && label.includes('Feed')) bar.classList.add('food-mode');
    $('btn-attack').disabled = true;
    const abilityBar = $('ability-bar');
    if (abilityBar) abilityBar.querySelectorAll('.btn-ability').forEach(b => { b.disabled = true; });
    $('action-info').textContent = label || 'Select a target';
  }

  function exitTargeting() {
    ['enemy-arena', 'player-arena'].forEach(arenaId => {
      $(arenaId).querySelectorAll('.unit-card').forEach(card => {
        card.classList.remove('is-targetable');
        if (card._onTarget) {
          card.removeEventListener('click', card._onTarget);
          delete card._onTarget;
        }
      });
    });
    const bar = $('targeting-bar');
    bar.classList.add('hidden');
    bar.classList.remove('food-mode');
  }

  // ── Hit flash animation ──────────────────────────────────────────
  function flashUnit(unit, type = 'damage') {
    const arenaId = unit.isPlayer ? 'player-arena' : 'enemy-arena';
    const cards   = $(arenaId).querySelectorAll('.unit-card');
    const card    = cards[unit.slot];
    if (!card) return;
    const cls = type === 'damage' ? 'flash-damage' : 'flash-heal';
    card.classList.remove('flash-damage', 'flash-heal');
    void card.offsetWidth; // force reflow
    card.classList.add(cls);
    setTimeout(() => card.classList.remove(cls), 380);
  }

  // ── Result overlay ───────────────────────────────────────────────
  function showResult(state, onContinue) {
    const overlay = $('result-overlay');
    const icon    = $('result-icon');
    const title   = $('result-title');
    const msg     = $('result-msg');

    if (state.phase === 'victory') {
      icon.textContent  = '🏆';
      title.textContent = 'Victory!';
      title.className   = 'result-title title-victory';
      msg.textContent   = 'Your heroes have triumphed. Prepare for the next challenge.';
    } else {
      icon.textContent  = '💀';
      title.textContent = 'Defeat';
      title.className   = 'result-title title-defeat';
      msg.textContent   = 'Your heroes have fallen. Regroup and try again.';
    }

    overlay.classList.remove('hidden');
    $('btn-result-continue').onclick = () => {
      overlay.classList.add('hidden');
      onContinue();
    };
  }

  function hideResult() {
    $('result-overlay').classList.add('hidden');
  }

  // ── Public API ───────────────────────────────────────────────────
  return {
    showScreen,
    renderSelect,
    renderBattle,
    enterTargeting,
    exitTargeting,
    flashUnit,
    showResult,
    hideResult,
    setAbilityClickHandler,
  };
})();
