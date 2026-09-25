'use strict';
// =============================================================
// main.js — Game controller: state machine + event wiring
// =============================================================

const TURN_DELAY     = 750;
const POST_ACT_DELAY = 120;

let battle           = null;
let targeting        = null;
let currentBattleDef = null;
let battleFoodUses   = 0;

// ── Boot ─────────────────────────────────────────────────────────
function init() {
  const hasSave = SaveManager.load();
  migrateTerritorySaveState();
  migratePhase5SaveState();
  migratePhase6SaveState();

  // Wire navigation first so the game is playable even if a module init fails
  _wireNavigation();
  _wireBattleControls();
  _wireOverlays();

  const inits = [
    () => MAP.init(BATTLE_DEFINITIONS, onBattleSelected),
    () => ACCOUNT.init(),
    () => TEAM.init(),
    () => GATHER.init(),
    () => COOKING.init(),
    () => SMITHING.init(),
    () => CONSTRUCTION.init(),
    () => PRAYER.init(),
    () => SHOP.init(),
    () => SKILLTREE.init(),
    () => MILESTONES.init(),
    () => ASSIGNMENT.init(),
    () => CRAFTING.init(),
    () => WORKSHOP.init(),
    () => STARTER.init(),
    () => OFFLINE.init(),
    () => TERRITORY.init(onBattleSelected),
  ];
  inits.forEach(fn => {
    try { fn(); } catch (e) { console.error('[init]', e); }
  });

  try { SFX.startMusicIfEnabled(); } catch (e) { console.error('[init] SFX', e); }

  _wireMapJobCallbacks();

  // Phase 4 — offline progression (assignments + node regen)
  try {
    OFFLINE.processOnLoad();
  } catch (e) { console.error('[init] offline', e); }

  _updateMainMenu(hasSave);
}

function _wireMapJobCallbacks() {
  ASSIGNMENT.setOnComplete(done => {
    done.forEach(d => {
      if (d.nodeId) MAP.markRecentCompletion(`node:${d.nodeId}`);
      MAP.showUnlockToast(
        `${d.charIcon} +${d.resourceAmount} ${d.resourceName} · +${d.xpGained} XP`
      );
    });
    MAP.refresh();
  });

  CRAFTING.setOnComplete(done => {
    done.forEach(d => {
      if (d.outputType === 'structure') {
        if (d.buildSiteId) MAP.flashHighlight(`site:${d.buildSiteId}`);
        if (d.structureId === 'fishing_dock') MAP.flashHighlight('node:dock_fishing_spot');
        if (d.structureId === 'watchtower') MAP.flashHighlight('battle:battle_4');
        MAP.showUnlockToast(`🏗️ ${d.outputIcon} ${d.outputLabel} complete!`);
      }
    });
    MAP.refresh();
  });
}

function _wireNavigation() {
  document.getElementById('btn-menu-play')?.addEventListener('click', _enterMap);
  document.getElementById('btn-menu-reset')?.addEventListener('click', () => {
    if (confirm('Reset all progress and start a new game?')) {
      SaveManager.reset();
      location.reload();
    }
  });
  document.getElementById('btn-gather-open')?.addEventListener('click', () => {
    SFX.uiClick();
    GATHER.open();
  });
}

function _wireBattleControls() {
  document.getElementById('btn-retreat')?.addEventListener('click', onRetreat);
  document.getElementById('btn-auto')?.addEventListener('click', onToggleAuto);
  document.getElementById('btn-attack')?.addEventListener('click', onAttack);
  document.getElementById('btn-skill')?.addEventListener('click', onSkill);
  UI.setAbilityClickHandler(onAbility);
  document.getElementById('btn-cancel-target')?.addEventListener('click', onCancelTarget);
  document.getElementById('btn-food')?.addEventListener('click', onUseFood);
}

function _wireOverlays() {
  document.getElementById('btn-settings-open')?.addEventListener('click', _openSettings);
  document.getElementById('btn-settings-close')?.addEventListener('click', _closeSettings);
  document.getElementById('btn-settings-reset')?.addEventListener('click', () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      SaveManager.reset();
      location.reload();
    }
  });
  document.getElementById('settings-music-toggle')?.addEventListener('change', (e) => {
    SFX.setMusicEnabled(e.target.checked);
    SFX.uiClick();
  });
  document.getElementById('overlay-settings')?.addEventListener('click', e => {
    if (e.target.id === 'overlay-settings') _closeSettings();
  });
  ['overlay-skilltree', 'overlay-milestones', 'overlay-shop', 'overlay-prayer', 'overlay-team',
   'overlay-territory-detail', 'overlay-assignment', 'overlay-char-status', 'overlay-offline-summary',
   'overlay-workshop', 'overlay-craft-picker'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id !== id) return;
      if (id === 'overlay-skilltree' && typeof SKILLTREE !== 'undefined') SKILLTREE.close();
      if (id === 'overlay-milestones' && typeof MILESTONES !== 'undefined') MILESTONES.close();
      if (id === 'overlay-shop' && typeof SHOP !== 'undefined') SHOP.close();
      if (id === 'overlay-prayer' && typeof PRAYER !== 'undefined') PRAYER.close();
      if (id === 'overlay-team' && typeof TEAM !== 'undefined') TEAM.close();
      if (id === 'overlay-territory-detail' && typeof TERRITORY !== 'undefined') TERRITORY.closeDetail();
      if (id === 'overlay-assignment' && typeof TERRITORY !== 'undefined') TERRITORY.closeAssignmentPicker();
      if (id === 'overlay-char-status' && typeof TERRITORY !== 'undefined') TERRITORY.closeCharacterStatus();
      if (id === 'overlay-offline-summary' && typeof OFFLINE !== 'undefined') OFFLINE.closeSummary();
      if (id === 'overlay-workshop' && typeof WORKSHOP !== 'undefined') WORKSHOP.close();
      if (id === 'overlay-craft-picker') {
        document.getElementById('overlay-craft-picker')?.classList.remove('visible');
        document.getElementById('overlay-craft-picker')?.addEventListener('transitionend', () => {
          document.getElementById('overlay-craft-picker')?.classList.add('hidden');
        }, { once: true });
      }
    });
  });
}

function _updateMainMenu(hasSave) {
  const playBtn  = document.getElementById('btn-menu-play');
  const resetBtn = document.getElementById('btn-menu-reset');
  if (hasSave) {
    playBtn.textContent  = '▶ Continue';
    resetBtn.classList.remove('hidden');
  } else {
    playBtn.textContent  = '⚔️ Begin Adventure';
    resetBtn.classList.add('hidden');
  }
}

function _enterMap() {
  try { SFX.uiClick(); } catch (_) { /* audio may be blocked */ }
  if (typeof STARTER !== 'undefined' && STARTER.needsSelection()) {
    STARTER.open();
    return;
  }
  try { OFFLINE.showPendingSummary(); } catch (_) {}
  // Show the map screen first — never let a refresh error block navigation
  UI.showScreen('screen-map');
  try {
    if (typeof MAP !== 'undefined' && MAP.refresh) MAP.refresh();
  } catch (e) {
    console.error('[enterMap] MAP.refresh failed:', e);
  }
  if (!SaveManager.hasSave()) {
    setTimeout(() => {
      try { MAP.showUnlockToast('⚔️ Welcome! Select a battle to begin.'); } catch (_) {}
    }, 500);
  }
}

let _settingsOpen = false;
function _openSettings() {
  const musicToggle = document.getElementById('settings-music-toggle');
  if (musicToggle) musicToggle.checked = SFX.isMusicEnabled();
  document.getElementById('overlay-settings').classList.remove('hidden');
  document.getElementById('overlay-settings').classList.add('visible');
  _settingsOpen = true;
}
function _closeSettings() {
  const el = document.getElementById('overlay-settings');
  el.classList.remove('visible');
  el.addEventListener('transitionend', () => el.classList.add('hidden'), { once: true });
  _settingsOpen = false;
}

// Resolved character defs for active team (enriched with skill bonuses)
function _playerDefs() {
  return PLAYER_DATA.team.map(id => getEffectiveStats(id));
}

function _updateFoodBtn() {
  const btn  = document.getElementById('btn-food');
  if (!btn) return;
  const food = PLAYER_DATA.food || {};
  const qty  = Object.values(food).reduce((a, n) => a + n, 0);
  const usesLeft = Math.max(0, BATTLE_FOOD_LIMIT - battleFoodUses);
  const inBattle = battle && battle.phase === 'player_input';
  btn.textContent = qty > 0
    ? `🍖 Eat Food (${usesLeft}/${BATTLE_FOOD_LIMIT})`
    : '🍖 Eat Food';
  btn.disabled = qty === 0 || usesLeft === 0 || !inBattle;
  btn.title = usesLeft === 0 ? 'Food limit reached this battle' : 'Eating costs your turn';
}

// ── Battle start ─────────────────────────────────────────────────
function onBattleSelected(battleDef) {
  if (!Unlock.isBattleUnlocked(battleDef.id)) return;   // guard

  currentBattleDef = battleDef;
  const enemyDefs  = battleDef.enemyTeam.map(id => ENEMY_DEFINITIONS[id]);
  battle    = new BattleState(_playerDefs(), enemyDefs);
  targeting = null;
  battleFoodUses = 0;

  // Apply active prayer buff to all player units before the first tick
  PRAYER.applyToBattle(battle);

  document.getElementById('battle-name-label').textContent = battleDef.displayName;
  window._inBattle = true;

  UI.hideResult();
  _clearRewardSummary();
  UI.showScreen('screen-battle');
  UI.renderBattle(battle);
  _updateFoodBtn();

  // Show tutorial hints only on the very first battle
  if (!_tutorialShown && !SaveManager.hasSave()) {
    _tutorialShown = true;
    _showTutorialHint();
  }

  setTimeout(() => step(battle.processTick()), 400);
}

// ── Turn loop ─────────────────────────────────────────────────────
function step(result) {
  UI.renderBattle(battle);
  _updateFoodBtn();

  switch (result) {
    case 'player_input':
      break;

    case 'auto_done':
    case 'continue':
      setTimeout(() => step(battle.processTick()), TURN_DELAY);
      break;

    case 'victory':
      _handleVictory();
      break;

    case 'defeat':
      SFX.defeat();
      setTimeout(() => UI.showResult(battle, onReturnToBase), 800);
      break;

    default:
      setTimeout(() => step(battle.processTick()), TURN_DELAY);
  }
}

// ── Victory handler ───────────────────────────────────────────────
function _handleVictory() {
  SFX.victory();

  // 1. Skill XP from battle pool + combat actions
  const skillPool = currentBattleDef.skillXpReward ?? currentBattleDef.xpReward ?? 0;
  const xpPool    = Math.round(skillPool * getBuildingXpMultiplier());
  const battleXp  = awardBattleXp(PLAYER_DATA.team, xpPool);
  const actionXp  = applyActionXp(battle.actionXp || {});
  const xpGains   = mergeXpGains(battleXp, actionXp);

  // 2. Character level XP — all active battle participants
  const charXpReward = currentBattleDef.characterXpReward ?? 0;
  const charLevelResults = [];
  if (charXpReward > 0) {
    PLAYER_DATA.team.forEach(charId => {
      const res = awardCharacterXp(charId, charXpReward);
      charLevelResults.push({ charId, xpGained: charXpReward, ...res });
      if (res.levelsGained > 0) setTimeout(() => SFX.levelUp(), 500);
    });
  }

  // 3. Gold, items, resources
  Unlock.awardGold(currentBattleDef.goldReward);
  const droppedItems = Unlock.rollItemDrops(currentBattleDef);
  Unlock.awardItems(droppedItems);
  const droppedResources = Unlock.rollResourceDrops(currentBattleDef);
  Unlock.awardResources(droppedResources);

  // 4. Process unlocks
  const unlocks = Unlock.onBattleComplete(currentBattleDef.id);

  // 5. Save everything + update milestone badge
  SaveManager.write();
  MILESTONES.updateBadge();

  // 6. Populate victory summary
  _populateRewardSummary(
    xpGains, currentBattleDef.goldReward, droppedItems, droppedResources,
    charLevelResults, unlocks
  );

  // 7. Show result overlay
  setTimeout(() => UI.showResult(battle, onReturnToBase), 800);

  // 8. Queue unlock toasts
  _pendingUnlocks = unlocks;
}

let _pendingUnlocks  = null;
let _tutorialShown  = false;

// ── Reward summary on result screen ──────────────────────────────
function _clearRewardSummary() {
  const el = document.getElementById('result-xp-summary');
  if (el) el.innerHTML = '';
}

function _populateRewardSummary(
  xpGains, goldEarned, droppedItems, droppedResources,
  charLevelResults, unlocks
) {
  const el = document.getElementById('result-xp-summary');
  if (!el) return;

  const SKILL_ABBR = {
    attack: 'ATK', strength: 'STR', defence: 'DEF', hitpoints: 'HP',
    magic: 'MAG', range: 'RNG', prayer: 'PRA',
  };

  const levelUpLines = [];
  const charLevelLines = [];

  (charLevelResults || []).forEach(({ charId, xpGained, levelsGained, newLevel }) => {
    const def = CHARACTER_DEFINITIONS[charId];
    if (!def) return;
    charLevelLines.push(
      `<div class="result-char-xp-line">${def.icon} +${xpGained} Character XP</div>`
    );
    if (levelsGained > 0) {
      charLevelLines.push(
        `<div class="xp-levelup-line">⬆️ ${def.displayName} reached Lv.${newLevel}! (+${levelsGained} skill point${levelsGained > 1 ? 's' : ''})</div>`
      );
    }
  });

  const xpRows = PLAYER_DATA.team.map(charId => {
    const def      = CHARACTER_DEFINITIONS[charId];
    const charGain = xpGains[charId] || {};
      const chips    = Object.entries(charGain).map(([skillId, g]) => {
      const abbr  = SKILL_ABBR[skillId] || skillId.slice(0, 3).toUpperCase();
      const lvlUp = g.newLevel > g.oldLevel;
      if (lvlUp) {
        levelUpLines.push(`${def.icon} ${def.displayName}: ${SKILL_DEFINITIONS[skillId].displayName} → Lv.${g.newLevel}`);
        setTimeout(() => SFX.levelUp(), 600);
      }
      return `<span class="xp-chip${lvlUp ? ' xp-chip-levelup' : ''}">+${g.xpGained} ${abbr}${lvlUp ? ' ▲' : ''}</span>`;
    }).join('');
    return `<div class="xp-row"><span class="xp-hero-name">${def.icon} ${def.displayName}</span><div class="xp-chips">${chips}</div></div>`;
  }).join('');

  const lvlHTML = levelUpLines.length
    ? `<div class="xp-levelups">${levelUpLines.map(l => `<div class="xp-levelup-line">⬆️ ${l}</div>`).join('')}</div>`
    : '';

  const unlockLines = [];
  if (unlocks) {
    unlocks.newBattles.forEach(id => {
      const b = BATTLE_DEFINITIONS.find(x => x.id === id);
      if (b) unlockLines.push(`⚔️ Battle unlocked: <strong>${b.displayName}</strong>`);
    });
    unlocks.newAreas.forEach(id => {
      const a = AREA_DEFINITIONS[id];
      if (a) unlockLines.push(`🗺️ Area unlocked: <strong>${a.displayName}</strong>`);
    });
    unlocks.newCharacters.forEach(id => {
      const c = CHARACTER_DEFINITIONS[id];
      if (c) unlockLines.push(`${c.icon} Hero unlocked: <strong>${c.displayName}</strong>`);
    });
    (unlocks.newTerritories || []).forEach(id => {
      const t = TERRITORY_DEFINITIONS[id];
      if (t) unlockLines.push(`🗺️ New Territory Unlocked: <strong>${t.displayName}</strong>`);
    });
  }
  const unlockHTML = unlockLines.length
    ? `<div class="result-unlocks">${unlockLines.map(l => `<div class="result-unlock-line">${l}</div>`).join('')}</div>`
    : '';

  // Item drops display
  if (droppedItems && droppedItems.length) SFX.itemDrop();
  const itemDropHTML = droppedItems && droppedItems.length
    ? `<div class="result-items-label">Items Found</div>
       <div class="result-item-chips">
         ${droppedItems.map(id => {
           const it = ITEM_DEFINITIONS[id];
           return it ? `<div class="result-item-chip rarity-${it.rarity}">${it.icon} ${it.displayName}</div>` : '';
         }).join('')}
       </div>`
    : '';

  const resourceDropHTML = droppedResources && droppedResources.length
    ? `<div class="result-items-label">Resources Gained</div>
       <div class="result-item-chips">
         ${droppedResources.map(({ resourceId, qty }) => {
           const r = RESOURCE_DEFINITIONS[resourceId];
           return `<div class="result-item-chip">${r?.icon || '📦'} ${qty}× ${r?.displayName || resourceId}</div>`;
         }).join('')}
       </div>`
    : '';

  const charXpHTML = charLevelLines.length
    ? `<div class="xp-summary-label">Character Progress</div>
       <div class="result-char-xp">${charLevelLines.join('')}</div>`
    : '';

  el.innerHTML = `
    <div class="result-gold-line"><span class="result-gold-icon">◈</span> +${goldEarned} Gold</div>
    ${resourceDropHTML}
    ${itemDropHTML}
    ${charXpHTML}
    <div class="xp-summary-label">Skill XP</div>
    ${xpRows}${lvlHTML}${unlockHTML}
  `;
}

// ── Player actions ────────────────────────────────────────────────
function onAttack() {
  if (!battle || battle.phase !== 'player_input' || targeting) return;
  enterTargetMode('attack');
}

function onSkill() {
  if (!battle || battle.phase !== 'player_input' || targeting) return;
  const unit = battle.currentUnit;
  if (!unit || !unit.canUseSkill()) return;
  const skill  = SKILLS[unit.skillId];
  const isAlly = skill && skill.targetType === 'ally';
  enterTargetMode('skill', isAlly);
}

function onAbility(abilityId) {
  if (!battle || battle.phase !== 'player_input' || targeting) return;
  const unit = battle.currentUnit;
  if (!unit || !unit.canUseAbility(abilityId)) return;

  const ab = ABILITY_DEFINITIONS[abilityId];
  if (!ab) return;

  targeting = { type: 'ability', abilityId };

  const allyTargets = ['single_ally', 'all_allies'].includes(ab.targetType);
  const selfTarget  = ab.targetType === 'self';

  if (selfTarget) {
    const result = battle.playerUseAbility(abilityId, unit);
    targeting = null;
    if (result) setTimeout(() => step(result), POST_ACT_DELAY);
    return;
  }

  if (ab.targetType === 'all_enemies') {
    const foes = battle.livingEnemies;
    if (!foes.length) return;
    SFX.magic();
    const result = battle.playerUseAbility(abilityId, foes[0]);
    targeting = null;
    if (result) setTimeout(() => step(result), POST_ACT_DELAY);
    return;
  }

  enterTargetMode('ability', allyTargets, abilityId);
}

function onToggleAuto() {
  if (!battle) return;
  if (targeting) { UI.exitTargeting(); targeting = null; }
  const shouldStepNow = battle.toggleAuto();
  UI.renderBattle(battle);
  if (shouldStepNow) setTimeout(() => step(battle.processTick()), POST_ACT_DELAY);
}

function enterTargetMode(actionType, isAlly = false, abilityId = null) {
  targeting = abilityId ? { type: 'ability', abilityId } : actionType;
  let label;
  if (actionType === 'food') label = 'Feed which hero?';
  else if (actionType === 'ability' && abilityId) {
    label = `Select target for ${ABILITY_DEFINITIONS[abilityId]?.displayName || 'ability'}`;
  }
  UI.enterTargeting(isAlly, battle, onTargetChosen, label);
}

function onTargetChosen(unit) {
  const action = targeting;
  UI.exitTargeting();
  targeting = null;

  if (action === 'food' || (action && action.type === 'food')) {
    const result = _applyFood(unit);
    if (result) setTimeout(() => step(result), POST_ACT_DELAY);
    return;
  }

  if (action && action.type === 'ability') {
    const ab = ABILITY_DEFINITIONS[action.abilityId];
    if (ab?.damageType === 'physical' || ab?.abilityType === 'damage') SFX.attack();
    else SFX.magic();
    const result = battle.playerUseAbility(action.abilityId, unit);
    if (result) setTimeout(() => step(result), POST_ACT_DELAY);
    return;
  }

  // Play appropriate SFX before the action resolves
  if (action === 'attack') {
    SFX.attack();
  } else if (action === 'skill') {
    const activeUnit = battle.currentUnit;
    const skill = activeUnit?.skillId ? SKILLS[activeUnit.skillId] : null;
    if (skill) {
      if (skill.skillType === 'damage_single' || skill.skillType === 'damage_all') {
        activeUnit.skillId === 'fire_bolt' ? SFX.magic()
          : activeUnit.skillId === 'piercing_shot' ? SFX.ranged()
          : activeUnit.skillId === 'whirlwind' ? SFX.heavyAttack()
          : SFX.heavyAttack();
      } else if (skill.skillType === 'buff_defense') {
        SFX.buff();
      } else if (skill.skillType === 'heal_ally') {
        SFX.heal();
      }
    }
  }

  let result;
  if (action === 'attack') result = battle.playerAttack(unit);
  else if (action === 'skill') result = battle.playerSkill(unit);
  if (result) setTimeout(() => step(result), POST_ACT_DELAY);
}

function onCancelTarget() {
  if (!targeting) return;
  UI.exitTargeting();
  targeting = null;
  UI.renderBattle(battle);
}

function onUseFood() {
  if (!battle || battle.phase !== 'player_input' || targeting) return;
  if (battleFoodUses >= BATTLE_FOOD_LIMIT) return;

  const food      = PLAYER_DATA.food || {};
  const available = Object.values(FOOD_DEFINITIONS)
    .filter(f => food[f.id] > 0)
    .sort((a, b) => b.healAmount - a.healAmount);
  if (!available.length) return;

  enterTargetMode('food', true /* isAlly */);
}

function _applyFood(targetUnit) {
  if (battleFoodUses >= BATTLE_FOOD_LIMIT) return null;

  const food      = PLAYER_DATA.food || {};
  const available = Object.values(FOOD_DEFINITIONS).filter(f => food[f.id] > 0);
  if (!available.length) return null;

  const healFoods = available.filter(f => f.healAmount).sort((a, b) => b.healAmount - a.healAmount);
  const buffFoods = available.filter(f => f.buffType);
  let chosen;
  if (targetUnit.hpPct < 0.85 && healFoods.length) chosen = healFoods[0];
  else if (buffFoods.length) chosen = buffFoods[0];
  else if (healFoods.length) chosen = healFoods[0];
  else return null;

  removeFood(chosen.id, 1);
  battleFoodUses += 1;

  if (chosen.buffType) {
    targetUnit.applyCombatBuff(chosen.buffType, chosen.buffAmount, chosen.buffTurns);
    const labels = { attack: 'ATK', defense: 'DEF', speed: 'SPD' };
    battle._log(
      `🍖 ${targetUnit.icon} ${targetUnit.name} eats ${chosen.displayName} — +${chosen.buffAmount} ${labels[chosen.buffType]} for ${chosen.buffTurns} turns.`,
      'player'
    );
    SFX.buff();
  } else {
    const healed = targetUnit.applyHeal(chosen.healAmount);
    battle._log(
      `🍖 ${targetUnit.icon} ${targetUnit.name} eats ${chosen.displayName} and recovers ${healed} HP.`,
      'player'
    );
    SFX.heal();
  }

  SaveManager.write();
  UI.renderBattle(battle);
  _updateFoodBtn();
  return battle.playerEatFood();
}

// ── Navigation ────────────────────────────────────────────────────
function onRetreat() {
  window._inBattle = false;
  UI.exitTargeting();
  targeting        = null;
  battle           = null;
  currentBattleDef = null;
  UI.hideResult();
  _clearRewardSummary();
  MAP.hidePanel();
  MAP.refresh();
  try { if (typeof TERRITORY !== 'undefined') TERRITORY.refreshIfOpen(); } catch (_) {}
  UI.showScreen('screen-map');

  // Show any pending unlock toasts
  if (_pendingUnlocks) {
    const u = _pendingUnlocks;
    _pendingUnlocks = null;
    let delay = 400;
    u.newBattles.forEach(id => {
      const b = BATTLE_DEFINITIONS.find(x => x.id === id);
      if (b) setTimeout(() => { MAP.showUnlockToast(`⚔️ Unlocked: ${b.displayName}`); SFX.unlock(); }, delay += 600);
    });
    u.newAreas.forEach(id => {
      const a = AREA_DEFINITIONS[id];
      if (a) setTimeout(() => { MAP.showUnlockToast(`🗺️ Area unlocked: ${a.displayName}`); SFX.unlock(); }, delay += 600);
    });
    u.newCharacters.forEach(id => {
      const c = CHARACTER_DEFINITIONS[id];
      if (c) setTimeout(() => { MAP.showUnlockToast(`${c.icon} Hero unlocked: ${c.displayName}!`); SFX.unlock(); }, delay += 600);
    });
    (u.newTerritories || []).forEach(id => {
      const t = TERRITORY_DEFINITIONS[id];
      if (t) setTimeout(() => { MAP.showUnlockToast(`🗺️ New Territory Unlocked: ${t.displayName}!`); SFX.unlock(); }, delay += 600);
    });
  }
}

function onReturnToBase() { onRetreat(); }

// ── Tutorial hints ────────────────────────────────────────────────
function _showTutorialHint() {
  const hints = [
    '⚔️ Tap <strong>Attack</strong> then choose a target to strike.',
    '✨ Use <strong>Skill</strong> for a powerful special move — but it has a cooldown.',
    '🤖 Enable <strong>Auto</strong> to let your team fight on their own.',
    '💡 Win to earn <strong>XP, Gold</strong> and possible item drops.',
  ];
  const container = document.getElementById('tutorial-hint');
  if (!container) return;

  let idx = 0;
  const show = () => {
    container.innerHTML = `<div class="tutorial-hint-inner">${hints[idx]}</div>`;
    container.classList.add('hint-visible');
  };
  const next = () => {
    idx++;
    if (idx >= hints.length) {
      container.classList.remove('hint-visible');
      return;
    }
    show();
  };

  show();
  container.addEventListener('click', next);

  // Auto-dismiss after first player action
  const _dismiss = () => {
    container.classList.remove('hint-visible');
    document.removeEventListener('click', _dismiss, true);
  };
  document.getElementById('btn-attack').addEventListener('click', _dismiss, { once: true });
  document.getElementById('btn-skill').addEventListener('click', _dismiss, { once: true });
  document.getElementById('btn-auto').addEventListener('click', _dismiss, { once: true });
}

// ── Bootstrap ─────────────────────────────────────────────────────
// Expose for inline fallback + debugging (game-engine input wiring pattern)
window.enterMap = _enterMap;

async function _boot() {
  await SPLASH.runBoot(() => {
    try {
      init();
    } catch (e) {
      console.error('[boot] init failed:', e);
      document.getElementById('btn-menu-play')?.addEventListener('click', _enterMap);
    }
  });
  if (typeof STARTER !== 'undefined' && STARTER.needsSelection()) {
    STARTER.open();
  } else {
    UI.showScreen('screen-main-menu');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _boot);
} else {
  _boot();
}
