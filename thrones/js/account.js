'use strict';
// =============================================================
// account.js — Account overlay: Heroes, Skills, Items tabs.
// =============================================================

const ACCOUNT = (() => {

  let _activeTab = 'characters';

  const SKILL_META = {
    damage_single: { label: 'Damage',       color: '#c94040', icon: '⚔️' },
    buff_defense:  { label: 'Defense Buff', color: '#4a90d9', icon: '🛡️' },
    heal_ally:     { label: 'Heal',         color: '#3aaa5e', icon: '💚' },
  };

  // ── Open / close ──────────────────────────────────────────────────
  function open() {
    _renderAll();
    _refreshHeader();
    const overlay = document.getElementById('screen-account');
    overlay.classList.remove('acct-hidden');
    requestAnimationFrame(() => overlay.classList.add('acct-visible'));
  }

  function close() {
    const overlay = document.getElementById('screen-account');
    overlay.classList.remove('acct-visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('acct-hidden'), { once: true });
  }

  function _refreshHeader() {
    const goldEl = document.getElementById('acct-gold-amount');
    if (goldEl) goldEl.textContent = PLAYER_DATA.gold.toLocaleString();

    const totalEl = document.getElementById('acct-total-level');
    if (totalEl) {
      const sum = Object.keys(CHARACTER_DEFINITIONS)
        .reduce((acc, charId) => acc + getTotalLevel(charId), 0);
      totalEl.textContent = sum;
    }
  }

  function _renderAll() {
    _renderCharacters();
    _renderSkills();
    _renderItems();
    _renderResources();
    _switchTab(_activeTab, false);
  }

  function _switchTab(tab, save = true) {
    if (save) _activeTab = tab;
    document.querySelectorAll('.acct-tab').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.tab === tab)
    );
    document.querySelectorAll('.acct-panel').forEach(panel =>
      panel.classList.toggle('acct-panel-active', panel.id === `acct-tab-${tab}`)
    );
  }

  // ── Slot label helpers ───────────────────────────────────────────
  const SLOT_META = {
    weapon:  { label: 'Weapon',  icon: '⚔️' },
    helmet:  { label: 'Helmet',  icon: '⛑️' },
    chest:   { label: 'Chest',   icon: '🛡️' },
    gloves:  { label: 'Gloves',  icon: '🧤' },
    boots:   { label: 'Boots',   icon: '👢' },
    ring:    { label: 'Ring',    icon: '💍' },
    amulet:  { label: 'Amulet',  icon: '📿' },
  };
  const SLOT_ORDER = ['weapon','helmet','chest','gloves','boots','ring','amulet'];

  function _buildEquipSlots(charId) {
    const slots = (PLAYER_DATA.equippedItems && PLAYER_DATA.equippedItems[charId]) || {};

    return SLOT_ORDER.map(slotKey => {
      const meta   = SLOT_META[slotKey];
      const itemId = slots[slotKey];
      const item   = itemId ? ITEM_DEFINITIONS[itemId] : null;

      if (item) {
        return `
          <div class="equip-slot equip-slot-filled rarity-border-${item.rarity}">
            <span class="equip-slot-icon">${item.icon}</span>
            <div class="equip-slot-body">
              <div class="equip-slot-label">${meta.label}</div>
              <div class="equip-slot-name rarity-${item.rarity}">${item.displayName}</div>
            </div>
            <button class="btn-unequip-slot" data-char="${charId}" data-slot="${slotKey}"
                    title="Unequip ${item.displayName}">✕</button>
          </div>`;
      } else {
        return `
          <div class="equip-slot equip-slot-empty">
            <span class="equip-slot-icon equip-slot-icon-empty">${meta.icon}</span>
            <div class="equip-slot-body">
              <div class="equip-slot-label">${meta.label}</div>
              <div class="equip-slot-name equip-empty-text">Empty</div>
            </div>
          </div>`;
      }
    }).join('');
  }

  // ── Heroes tab ───────────────────────────────────────────────────
  function _renderCharacters() {
    const container = document.getElementById('acct-tab-characters');
    const activeSet = new Set(PLAYER_DATA.team);
    const chars     = Object.values(CHARACTER_DEFINITIONS)
      .filter(def => Unlock.isCharacterUnlocked(def.id));

    container.innerHTML = chars.map(def => {
      const isActive   = activeSet.has(def.id);
      const charData   = PLAYER_DATA.characters[def.id];
      const skills     = charData.skills;
      const combatLvl  = getCombatLevel(def.id);
      const charLvl    = getCharLevel(def.id);
      const effective  = getEffectiveStats(def.id);
      const trait      = def.trait;

      const isMagic    = def.damageType === 'magic';
      const statsRow = [
        { label: 'HP',                    val: effective.baseMaxHP,      color: '#3aaa5e' },
        { label: isMagic ? 'MAG' : 'ATK', val: isMagic ? (effective.baseMagic ?? effective.baseAttack) : effective.baseAttack, color: isMagic ? '#9060c0' : '#c94040' },
        { label: 'DEF',                   val: effective.baseDefense,    color: '#4a90d9' },
        { label: 'RES',                   val: effective.baseResistance, color: '#7040b0' },
        { label: 'SPD',                   val: effective.baseSpeed,      color: '#d4a332' },
      ].map(s => `<div class="eff-stat"><span class="eff-stat-val" style="color:${s.color}">${s.val}</span><span class="eff-stat-lbl">${s.label}</span></div>`).join('');

      const traitHTML = trait
        ? `<div class="char-trait-badge" title="${trait.desc}">
             <span class="char-trait-icon">${trait.icon}</span>
             <span class="char-trait-name">${trait.displayName}</span>
             <span class="char-trait-desc">${trait.desc}</span>
           </div>`
        : '';

      const equipSlotsHTML = _buildEquipSlots(def.id);

      const combatRows = _buildSkillRows(def.id, COMBAT_SKILLS, skills);
      const gatherRows = _buildSkillRows(def.id, GATHERING_SKILLS, skills);
      const craftRows  = _buildSkillRows(def.id, CRAFTING_SKILLS, skills);

      const charData2  = PLAYER_DATA.characters[def.id];
      const skillPts   = charData2.skillPoints || 0;
      const treeNodes  = (charData2.skillTreeNodes || []).length;
      const treeName   = 'Unified Skill Tree';

      return `
        <div class="char-card" style="--char-color:${def.color}">
          <div class="char-card-accent"></div>
          <div class="char-top">
            <div class="char-icon-wrap">
              <span class="char-big-icon">${def.icon}</span>
              <div class="char-lvl-badge" title="Character Level">${charLvl}</div>
            </div>
            <div class="char-meta">
              <div class="char-name-line">
                <span class="char-name">${def.displayName}</span>
                <span class="char-rarity rarity-${def.rarity}">${def.rarity}</span>
                ${isActive ? '<span class="char-active-inline">◉ Active</span>' : '<span class="char-bench-inline">Reserve</span>'}
              </div>
              <div class="char-desc">${def.description}</div>
              <div class="char-level-row">
                <span class="char-combat-lvl">Combat Lv.<strong>${combatLvl}</strong></span>
              </div>
            </div>
          </div>
          ${traitHTML}
          <div class="char-eff-stats">${statsRow}</div>
          <button class="btn-open-tree" data-char="${def.id}">
            🌳 ${treeName}
            <span class="tree-btn-meta">${treeNodes} node${treeNodes !== 1 ? 's' : ''} unlocked</span>
            ${skillPts > 0 ? `<span class="tree-pts-badge">${skillPts} pt${skillPts > 1 ? 's' : ''}</span>` : ''}
          </button>
          <div class="equip-slots-section">
            <div class="equip-slots-label">Equipment</div>
            <div class="equip-slots">${equipSlotsHTML}</div>
          </div>
          <div class="skill-section-label">Combat</div>
          <div class="skill-grid">${combatRows}</div>
          <div class="skill-section-label">Gathering &amp; Crafting</div>
          <div class="skill-grid">${gatherRows}${craftRows}</div>
        </div>`;
    }).join('');

    // Wire unequip buttons
    container.querySelectorAll('.btn-unequip-slot').forEach(btn => {
      btn.addEventListener('click', () => {
        Unlock.unequipItem(btn.dataset.char, btn.dataset.slot);
        _renderCharacters();
        _renderItems();
      });
    });

    // Wire skill tree buttons
    container.querySelectorAll('.btn-open-tree').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof SKILLTREE !== 'undefined') SKILLTREE.open(btn.dataset.char);
      });
    });
  }

  // ── Called by SKILLTREE after a node purchase ─────────────────────
  function refreshIfOpen() {
    const overlay = document.getElementById('screen-account');
    if (overlay && overlay.classList.contains('acct-visible')) {
      _renderCharacters();
    }
  }

  function _buildSkillRows(charId, skillIds, skills) {
    return skillIds.map(skillId => {
      const skDef  = SKILL_DEFINITIONS[skillId];
      const sk     = skills[skillId];
      const lvl    = sk.level;
      const pct    = xpProgressPct(sk.xp, lvl).toFixed(1);
      const xpNow  = sk.xp - xpToLevel(lvl);
      const xpNext = xpForNextLevel(lvl);
      const maxed  = lvl >= 99;

      return `
        <div class="skill-row-item" title="${skDef.desc}">
          <span class="sri-icon">${skDef.icon}</span>
          <div class="sri-body">
            <div class="sri-name-line">
              <span class="sri-name">${skDef.displayName}</span>
              <span class="sri-level" style="color:${skDef.color}">Lv.${lvl}</span>
            </div>
            <div class="sri-xp-track">
              <div class="sri-xp-fill" style="width:${pct}%;background:${skDef.color}"></div>
            </div>
            <div class="sri-xp-text">${maxed ? 'MAX' : `${xpNow} / ${xpNext} XP`}</div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Skills tab ───────────────────────────────────────────────────
  function _renderSkills() {
    const container = document.getElementById('acct-tab-skills');
    const owners = {};
    Object.values(CHARACTER_DEFINITIONS).forEach(c => {
      if (c.skillId) owners[c.skillId] = c;
    });

    container.innerHTML = Object.values(SKILLS).map(skill => {
      const meta  = SKILL_META[skill.skillType] || { label: skill.skillType, color: '#888', icon: '✨' };
      const owner = owners[skill.id];

      const chips = [];
      if (skill.powerMultiplier > 0)
        chips.push(`<span class="skill-chip">${skill.powerMultiplier}× ATK</span>`);
      if (skill.defPiercing)
        chips.push(`<span class="skill-chip chip-pierce">${skill.defPiercing * 100}% DEF Pierce</span>`);
      if (skill.buffAmount)
        chips.push(`<span class="skill-chip chip-buff">+${skill.buffAmount} DEF / ${skill.buffDuration} turns</span>`);
      chips.push(`<span class="skill-chip chip-target">${skill.targetType === 'enemy' ? '→ Enemy' : '→ Ally'}</span>`);

      return `
        <div class="skill-card">
          <div class="skill-card-top">
            <div class="skill-icon-circle" style="--skill-color:${meta.color}">${meta.icon}</div>
            <div class="skill-card-info">
              <div class="skill-name-row">
                <span class="skill-name">${skill.displayName}</span>
                <span class="skill-cd-badge">CD ${skill.cooldown}</span>
              </div>
              <span class="skill-type-tag" style="color:${meta.color}">${meta.label}</span>
            </div>
          </div>
          <div class="skill-desc">${skill.description}</div>
          <div class="skill-chips">${chips.join('')}</div>
          ${owner ? `
            <div class="skill-owner">
              <span class="skill-owner-dot" style="background:${owner.color}"></span>
              ${owner.icon} ${owner.displayName}
            </div>` : ''}
        </div>`;
    }).join('');
  }

  // ── Items tab ─────────────────────────────────────────────────────
  function _renderItems() {
    const container = document.getElementById('acct-tab-items');
    const owned     = PLAYER_DATA.ownedItems || {};
    const equipped  = PLAYER_DATA.equippedItems || {};
    const itemIds   = Object.keys(owned).filter(id => owned[id] > 0);

    if (itemIds.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎒</div>
          <div class="empty-title">No Items Yet</div>
          <div class="empty-body">Win battles to find equipment. Items drop randomly from enemies.</div>
          <div class="empty-hint">Each hero equips one item. Bonuses stack on top of skill levels.</div>
        </div>`;
      return;
    }

    // Build a reverse map: itemId → Set of charIds that have it equipped
    const equippedBy = {};  // itemId → charId[]
    Object.entries(equipped).forEach(([charId, slots]) => {
      if (!slots || typeof slots !== 'object') return;
      Object.values(slots).forEach(itemId => {
        if (itemId) equippedBy[itemId] = (equippedBy[itemId] || []).concat(charId);
      });
    });

    const unlockedChars = Object.values(CHARACTER_DEFINITIONS)
      .filter(c => Unlock.isCharacterUnlocked(c.id));

    const cards = itemIds.map(itemId => {
      const item   = ITEM_DEFINITIONS[itemId];
      if (!item) return '';
      const qty       = owned[itemId];
      const owners    = equippedBy[itemId] || [];
      const usedCount = owners.length;

      const slotLabel = SLOT_META[item.slot]
        ? `${SLOT_META[item.slot].icon} ${SLOT_META[item.slot].label}`
        : '';

      const statLabel = {
        hp:      `+${item.statAmount} Max HP`,
        attack:  `+${item.statAmount} Attack`,
        defense: `+${item.statAmount} Defense`,
        speed:   `+${item.statAmount} Speed`,
        resistance: `+${item.statAmount} Resistance`,
      }[item.statModified] || `+${item.statAmount}`;

      const reqHTML = item.levelReq
        ? `<div class="item-req-tag">${Object.entries(item.levelReq).map(([sk, lv]) => {
            const skDef = SKILL_DEFINITIONS[sk];
            return `${skDef?.icon || ''} ${skDef?.displayName || sk} Lv.${lv}`;
          }).join(' · ')}</div>`
        : '';

      const bonusHTML = item.skillBonus
        ? `<div class="item-bonus-tag">+${Object.entries(item.skillBonus).map(([sk, n]) =>
            `${n} ${SKILL_DEFINITIONS[sk]?.displayName || sk}`).join(', ')}</div>`
        : '';

      // Per-character equip buttons
      const charBtns = unlockedChars.map(def => {
        const charSlots = equipped[def.id];
        const isEquippedToThis = charSlots && typeof charSlots === 'object'
          && Object.values(charSlots).includes(itemId);
        const btnClass = isEquippedToThis ? 'item-equip-btn equipped' : 'item-equip-btn';
        const btnLabel = isEquippedToThis ? '✓ Equipped' : 'Equip';
        const action   = isEquippedToThis ? 'unequip' : 'equip';
        return `<button class="${btnClass}"
          data-action="${action}"
          data-char="${def.id}" data-item="${itemId}" data-slot="${item.slot}"
          style="--hero-color:${def.color}">
          ${def.icon} ${def.displayName} <span class="equip-btn-label">${btnLabel}</span>
        </button>`;
      }).join('');

      return `
        <div class="item-card rarity-border-${item.rarity}">
          <div class="item-card-top">
            <div class="item-icon-wrap"><span class="item-big-icon">${item.icon}</span></div>
            <div class="item-card-info">
              <div class="item-name-row">
                <span class="item-name">${item.displayName}</span>
                <span class="item-rarity rarity-${item.rarity}">${item.rarity}</span>
                <span class="item-qty">×${qty}</span>
              </div>
              <div class="item-slot-tag">${slotLabel}</div>
              <div class="item-stat-badge">${statLabel}</div>
              ${reqHTML}${bonusHTML}
              <div class="item-desc">${item.description}</div>
            </div>
          </div>
          <div class="item-equip-row">${charBtns}</div>
        </div>`;
    }).join('');

    container.innerHTML = `<div class="items-list">${cards}</div>`;

    // Wire equip / unequip buttons
    container.querySelectorAll('.item-equip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const charId = btn.dataset.char;
        const itemId = btn.dataset.item;

        if (action === 'equip') {
          const check = canEquipItem(charId, itemId);
          if (!check.ok) {
            SFX.uiClick();
            alert(check.reason);
            return;
          }
          Unlock.equipItem(charId, itemId);
        } else {
          Unlock.unequipItem(charId, btn.dataset.slot);
        }
        // Re-render items and hero tab to reflect changes
        _renderItems();
        _renderCharacters();
      });
    });
  }

  // ── Resources tab ────────────────────────────────────────────────
  function _renderResources() {
    const container = document.getElementById('acct-tab-resources');
    if (!container) return;

    const resources = PLAYER_DATA.resources || {};
    const food      = PLAYER_DATA.food      || {};

    // ── Raw resources ──────────────────────────────────────────────
    const ownedRes = Object.values(RESOURCE_DEFINITIONS).filter(r => resources[r.id] > 0);
    const resHTML  = ownedRes.length
      ? ownedRes.map(r => `
          <div class="res-chip">
            <span class="res-chip-icon">${r.icon}</span>
            <div class="res-chip-body">
              <div class="res-chip-name">${r.displayName}</div>
              <div class="res-chip-skill" style="color:${SKILL_DEFINITIONS[r.skill].color}">
                ${SKILL_DEFINITIONS[r.skill].icon} ${SKILL_DEFINITIONS[r.skill].displayName} Lv.${r.levelReq}+
              </div>
            </div>
            <span class="res-chip-qty">×${resources[r.id]}</span>
          </div>`).join('')
      : '<div class="empty-substate">No resources. Head to the Gather screen!</div>';

    // ── Food inventory ─────────────────────────────────────────────
    const ownedFood = Object.values(FOOD_DEFINITIONS).filter(f => food[f.id] > 0);
    const foodHTML  = ownedFood.length
      ? ownedFood.map(f => `
          <div class="res-chip food-res-chip">
            <span class="res-chip-icon">${f.icon}</span>
            <div class="res-chip-body">
              <div class="res-chip-name">${f.displayName}</div>
              <div class="res-chip-skill" style="color:#3aaa5e">${f.buffType
                ? `✨ +${f.buffAmount} ${f.buffType.toUpperCase()} (${f.buffTurns}t)`
                : `💚 Heals ${f.healAmount} HP`}</div>
            </div>
            <span class="res-chip-qty">×${food[f.id]}</span>
          </div>`).join('')
      : '<div class="empty-substate">No food. Cook fish in the Gather screen!</div>';

    // ── Combat stat breakdown per hero ─────────────────────────────
    const statCards = PLAYER_DATA.team.map(charId => {
      const def  = CHARACTER_DEFINITIONS[charId];
      const eff  = getEffectiveStats(charId);
      return `
        <div class="res-stat-card">
          <div class="res-stat-header">
            <span style="color:${def.color}">${def.icon}</span>
            <span class="res-stat-name">${def.displayName}</span>
          </div>
          <div class="res-stat-row">
            <span class="res-stat-lbl">🎯 Accuracy</span>
            <span class="res-stat-val">${eff.accuracy}%</span>
          </div>
          <div class="res-stat-row">
            <span class="res-stat-lbl">💨 Evasion</span>
            <span class="res-stat-val">${eff.evasion}%</span>
          </div>
          <div class="res-stat-row">
            <span class="res-stat-lbl">💥 Crit Chance</span>
            <span class="res-stat-val">${eff.critChance}%</span>
          </div>
          <div class="res-stat-row">
            <span class="res-stat-lbl">⚡ Crit Mult.</span>
            <span class="res-stat-val">${eff.critMultiplier}×</span>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="acct-resources-section">
        <div class="acct-res-label">⛏ Raw Resources</div>
        <div class="res-chip-grid">${resHTML}</div>
      </div>
      <div class="acct-resources-section">
        <div class="acct-res-label">🍖 Food Stockpile</div>
        <div class="res-chip-grid">${foodHTML}</div>
      </div>
      <div class="acct-resources-section">
        <div class="acct-res-label">📊 Combat Stats (Active Team)</div>
        <div class="res-stat-grid">${statCards}</div>
      </div>`;
  }

  // ── Event wiring ─────────────────────────────────────────────────
  function init() {
    document.getElementById('btn-open-account').addEventListener('click', open);
    document.getElementById('btn-acct-close').addEventListener('click', close);
    document.getElementById('screen-account').addEventListener('click', e => {
      if (e.target === document.getElementById('screen-account')) close();
    });
    document.querySelectorAll('.acct-tab').forEach(btn => {
      btn.addEventListener('click', () => _switchTab(btn.dataset.tab));
    });
  }

  return { init, open, close, refresh: _renderAll, refreshIfOpen };
})();
