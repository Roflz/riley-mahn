'use strict';
// =============================================================
// combat-defs.js — Phase 6: Unified skill tree, abilities, status
// Data-driven combat build system.
// =============================================================

const MAX_CHAR_LEVEL = 100;

const SKILL_TREE_REGIONS = {
  melee_core:     { id: 'melee_core',     displayName: 'Melee Core',      icon: '⚔️', color: '#c94040' },
  guardian:       { id: 'guardian',       displayName: 'Guardian',        icon: '🛡️', color: '#4a90d9' },
  berserker:      { id: 'berserker',      displayName: 'Berserker',       icon: '🔥', color: '#e07030' },
  duelist:        { id: 'duelist',        displayName: 'Duelist',         icon: '🗡️', color: '#d4a332' },
  ranged_core:    { id: 'ranged_core',    displayName: 'Ranged Core',     icon: '🏹', color: '#3aaa5e' },
  rogue:          { id: 'rogue',          displayName: 'Rogue',           icon: '🗡️', color: '#7040a0' },
  hunter:         { id: 'hunter',         displayName: 'Hunter',          icon: '🎯', color: '#5a8040' },
  magic_core:     { id: 'magic_core',     displayName: 'Magic Core',      icon: '🔮', color: '#9060c0' },
  elemental:      { id: 'elemental',      displayName: 'Elemental Magic', icon: '🌪️', color: '#5080e0' },
  blood_magic:    { id: 'blood_magic',    displayName: 'Blood Magic',     icon: '🩸', color: '#a02040' },
  healing:        { id: 'healing',        displayName: 'Healing Magic',   icon: '💚', color: '#3aaa5e' },
  necromancy:     { id: 'necromancy',     displayName: 'Necromancy',      icon: '💀', color: '#503060' },
  druid:          { id: 'druid',          displayName: 'Druid / Nature',  icon: '🌿', color: '#2a8040' },
  hybrid:         { id: 'hybrid',         displayName: 'Hybrid Bridges',  icon: '🔗', color: '#c9a84c' },
};

// Starter → combat identity (region, starting node, unique ability)
const STARTER_COMBAT_IDENTITY = {
  warrior: { regionId: 'melee_core', starterNodeId: 'st_melee_core', uniqueAbilityId: 'last_stand', charId: 'warrior' },
  mage:    { regionId: 'magic_core', starterNodeId: 'st_arcane_core', uniqueAbilityId: 'arcane_spark', charId: 'mage' },
  ranger:  { regionId: 'ranged_core', starterNodeId: 'st_ranged_core', uniqueAbilityId: 'hunters_mark', charId: 'ranger' },
  crafter: { regionId: 'melee_core', starterNodeId: 'st_melee_core', uniqueAbilityId: 'opening_strike', charId: 'warrior' },
};

const CHARACTER_DEFAULT_IDENTITY = {
  warrior:  STARTER_COMBAT_IDENTITY.warrior,
  mage:     STARTER_COMBAT_IDENTITY.mage,
  ranger:   STARTER_COMBAT_IDENTITY.ranger,
  guardian: { regionId: 'guardian', starterNodeId: 'st_guardian_core', uniqueAbilityId: 'soothing_light', charId: 'guardian' },
  cleric:   { regionId: 'healing', starterNodeId: 'st_healing_core', uniqueAbilityId: 'soothing_light', charId: 'cleric' },
};

// ── Status effects ─────────────────────────────────────────────
const STATUS_EFFECT_DEFINITIONS = {
  poison:       { id: 'poison',       displayName: 'Poison',       type: 'dot',     tickTiming: 'end_turn', icon: '☠️' },
  bleed:        { id: 'bleed',        displayName: 'Bleed',        type: 'dot',     tickTiming: 'end_turn', icon: '🩸' },
  regeneration: { id: 'regeneration', displayName: 'Regeneration', type: 'hot',     tickTiming: 'end_turn', icon: '💚' },
  defense_up:   { id: 'defense_up',   displayName: 'Defense Up',   type: 'buff',    tickTiming: 'start_turn', icon: '🛡️' },
  defense_down: { id: 'defense_down', displayName: 'Defense Down', type: 'debuff',  tickTiming: 'start_turn', icon: '⬇️' },
  speed_down:   { id: 'speed_down',   displayName: 'Slow',         type: 'debuff',  tickTiming: 'start_turn', icon: '🐌' },
  thorns:       { id: 'thorns',       displayName: 'Thorns',       type: 'buff',    tickTiming: 'on_hit', icon: '🌵' },
  marked:       { id: 'marked',       displayName: "Hunter's Mark", type: 'debuff', tickTiming: 'passive', icon: '🎯' },
  last_stand:   { id: 'last_stand',   displayName: 'Last Stand',   type: 'passive', tickTiming: 'passive', icon: '⚔️' },
};

// ── Abilities ─────────────────────────────────────────────────
const ABILITY_DEFINITIONS = {
  // Unique starters
  arcane_spark: {
    id: 'arcane_spark', displayName: 'Arcane Spark', icon: '✨',
    description: 'Minor magic damage. Restores a little mana.',
    abilityType: 'damage', damageType: 'magical', targetType: 'single_enemy',
    powerMultiplier: 1.2, manaCost: 0, cooldownTurns: 2, scalingStat: 'magic',
    manaRestore: 5, isUnique: true,
  },
  last_stand: {
    id: 'last_stand', displayName: 'Last Stand', icon: '🛡️',
    description: 'Passive: +8 DEF when below 30% HP.',
    abilityType: 'passive', targetType: 'self', isUnique: true,
    passiveEffectId: 'last_stand',
  },
  hunters_mark: {
    id: 'hunters_mark', displayName: "Hunter's Mark", icon: '🎯',
    description: 'Mark an enemy to take 20% more damage.',
    abilityType: 'debuff', damageType: 'physical', targetType: 'single_enemy',
    powerMultiplier: 0.5, manaCost: 4, cooldownTurns: 3, scalingStat: 'attack',
    statusEffects: [{ id: 'marked', durationTurns: 3, magnitude: 0.2 }],
    isUnique: true,
  },
  opening_strike: {
    id: 'opening_strike', displayName: 'Opening Strike', icon: '⚡',
    description: 'Bonus damage at battle start. High opening blow.',
    abilityType: 'damage', damageType: 'physical', targetType: 'single_enemy',
    powerMultiplier: 2.2, manaCost: 6, cooldownTurns: 4, scalingStat: 'attack',
    openingOnly: true, isUnique: true,
  },
  soothing_light: {
    id: 'soothing_light', displayName: 'Soothing Light', icon: '💛',
    description: 'Heal one ally for a small amount.',
    abilityType: 'heal', targetType: 'single_ally',
    powerMultiplier: 1.0, manaCost: 5, cooldownTurns: 2, scalingStat: 'magic',
    isUnique: true,
  },

  // Melee
  slash: {
    id: 'slash', displayName: 'Slash', icon: '⚔️',
    description: 'Basic physical strike.',
    abilityType: 'damage', damageType: 'physical', targetType: 'single_enemy',
    powerMultiplier: 1.3, manaCost: 3, cooldownTurns: 0, scalingStat: 'attack',
  },
  heavy_strike: {
    id: 'heavy_strike', displayName: 'Heavy Strike', icon: '💥',
    description: 'A crushing blow. Cooldown 3.',
    abilityType: 'damage', damageType: 'physical', targetType: 'single_enemy',
    powerMultiplier: 2.0, manaCost: 8, cooldownTurns: 3, scalingStat: 'attack',
  },
  cleave: {
    id: 'cleave', displayName: 'Cleave', icon: '🌪️',
    description: 'Hits all enemies for reduced damage.',
    abilityType: 'damage', damageType: 'physical', targetType: 'all_enemies',
    powerMultiplier: 0.85, manaCost: 10, cooldownTurns: 4, scalingStat: 'attack',
  },
  guard: {
    id: 'guard', displayName: 'Guard', icon: '🛡️',
    description: 'Increases own defense for 2 turns.',
    abilityType: 'buff', targetType: 'self',
    manaCost: 5, cooldownTurns: 3,
    statusEffects: [{ id: 'defense_up', durationTurns: 2, magnitude: 8 }],
  },
  protect_ally: {
    id: 'protect_ally', displayName: 'Protect Ally', icon: '🤝',
    description: 'Shield an ally with +6 DEF for 2 turns.',
    abilityType: 'buff', targetType: 'single_ally',
    manaCost: 6, cooldownTurns: 3,
    statusEffects: [{ id: 'defense_up', durationTurns: 2, magnitude: 6 }],
  },
  reckless_strike: {
    id: 'reckless_strike', displayName: 'Reckless Strike', icon: '🔥',
    description: 'High damage but lowers your defense for 1 turn.',
    abilityType: 'damage', damageType: 'physical', targetType: 'single_enemy',
    powerMultiplier: 2.4, manaCost: 7, cooldownTurns: 3, scalingStat: 'attack',
    selfStatusEffects: [{ id: 'defense_down', durationTurns: 1, magnitude: 4 }],
  },

  // Ranged
  quick_shot: {
    id: 'quick_shot', displayName: 'Quick Shot', icon: '🏹',
    description: 'Fast ranged attack.',
    abilityType: 'damage', damageType: 'physical', targetType: 'single_enemy',
    powerMultiplier: 1.2, manaCost: 3, cooldownTurns: 0, scalingStat: 'attack',
  },
  piercing_shot: {
    id: 'piercing_shot', displayName: 'Piercing Shot', icon: '🎯',
    description: 'Ignores 50% of defense.',
    abilityType: 'damage', damageType: 'physical', targetType: 'single_enemy',
    powerMultiplier: 1.8, manaCost: 7, cooldownTurns: 2, scalingStat: 'attack',
    defPiercing: 0.5,
  },
  poison_strike: {
    id: 'poison_strike', displayName: 'Poison Strike', icon: '☠️',
    description: 'Damage and applies poison.',
    abilityType: 'damage', damageType: 'poison', targetType: 'single_enemy',
    powerMultiplier: 1.1, manaCost: 6, cooldownTurns: 3, scalingStat: 'attack',
    statusEffects: [{ id: 'poison', durationTurns: 3, magnitude: 4 }],
  },
  bleed_cut: {
    id: 'bleed_cut', displayName: 'Bleed Cut', icon: '🗡️',
    description: 'Damage and applies bleed.',
    abilityType: 'damage', damageType: 'physical', targetType: 'single_enemy',
    powerMultiplier: 1.3, manaCost: 5, cooldownTurns: 2, scalingStat: 'attack',
    statusEffects: [{ id: 'bleed', durationTurns: 2, magnitude: 5 }],
  },

  // Magic
  fire_bolt: {
    id: 'fire_bolt', displayName: 'Fire Bolt', icon: '🔥',
    description: 'Single-target fire damage.',
    abilityType: 'damage', damageType: 'fire', targetType: 'single_enemy',
    powerMultiplier: 2.0, manaCost: 8, cooldownTurns: 2, scalingStat: 'magic',
  },
  ice_shard: {
    id: 'ice_shard', displayName: 'Ice Shard', icon: '❄️',
    description: 'Ice damage and slows target.',
    abilityType: 'damage', damageType: 'ice', targetType: 'single_enemy',
    powerMultiplier: 1.6, manaCost: 7, cooldownTurns: 2, scalingStat: 'magic',
    statusEffects: [{ id: 'speed_down', durationTurns: 2, magnitude: 3 }],
  },
  lightning_arc: {
    id: 'lightning_arc', displayName: 'Lightning Arc', icon: '⚡',
    description: 'Lightning damage with 40% chance to arc.',
    abilityType: 'damage', damageType: 'lightning', targetType: 'single_enemy',
    powerMultiplier: 1.9, manaCost: 9, cooldownTurns: 3, scalingStat: 'magic',
    chainChance: 0.4, chainMultiplier: 0.6,
  },

  // Healing
  heal: {
    id: 'heal', displayName: 'Heal', icon: '💚',
    description: 'Restore HP to one ally.',
    abilityType: 'heal', targetType: 'single_ally',
    powerMultiplier: 1.5, manaCost: 8, cooldownTurns: 2, scalingStat: 'magic',
  },
  regeneration: {
    id: 'regeneration', displayName: 'Regeneration', icon: '🌱',
    description: 'Healing over time on an ally.',
    abilityType: 'buff', targetType: 'single_ally',
    manaCost: 6, cooldownTurns: 3,
    statusEffects: [{ id: 'regeneration', durationTurns: 3, magnitude: 6 }],
  },

  // Blood magic
  life_drain: {
    id: 'life_drain', displayName: 'Life Drain', icon: '🩸',
    description: 'Deal damage and heal yourself.',
    abilityType: 'damage', damageType: 'blood', targetType: 'single_enemy',
    powerMultiplier: 1.5, manaCost: 8, cooldownTurns: 3, scalingStat: 'magic',
    lifestealPct: 0.5,
  },
  blood_price: {
    id: 'blood_price', displayName: 'Blood Price', icon: '💉',
    description: 'Sacrifice HP for a powerful strike.',
    abilityType: 'damage', damageType: 'blood', targetType: 'single_enemy',
    powerMultiplier: 2.8, manaCost: 0, cooldownTurns: 4, scalingStat: 'magic',
    hpCost: 15,
  },

  // Druid / Nature
  thorn_shield: {
    id: 'thorn_shield', displayName: 'Thorn Shield', icon: '🌵',
    description: 'Thorns reflect damage to attackers.',
    abilityType: 'buff', targetType: 'single_ally',
    manaCost: 7, cooldownTurns: 4,
    statusEffects: [{ id: 'thorns', durationTurns: 3, magnitude: 5 }],
  },
  nature_mend: {
    id: 'nature_mend', displayName: 'Nature Mend', icon: '🌿',
    description: 'Heal plus small regeneration.',
    abilityType: 'heal', targetType: 'single_ally',
    powerMultiplier: 1.2, manaCost: 7, cooldownTurns: 3, scalingStat: 'magic',
    statusEffects: [{ id: 'regeneration', durationTurns: 2, magnitude: 4 }],
  },

  // Necromancy
  bone_armor: {
    id: 'bone_armor', displayName: 'Bone Armor', icon: '💀',
    description: 'Increases defense and resistance.',
    abilityType: 'buff', targetType: 'self',
    manaCost: 8, cooldownTurns: 4,
    statusEffects: [{ id: 'defense_up', durationTurns: 3, magnitude: 10 }],
  },
  soul_bolt: {
    id: 'soul_bolt', displayName: 'Soul Bolt', icon: '👻',
    description: 'Necrotic damage.',
    abilityType: 'damage', damageType: 'necrotic', targetType: 'single_enemy',
    powerMultiplier: 1.8, manaCost: 8, cooldownTurns: 2, scalingStat: 'magic',
  },
};

// ── Unified skill tree nodes ───────────────────────────────────
const UNIFIED_SKILL_TREE_NODES = {
  // ── Melee Core (Warrior start) ────────────────────────────────
  st_melee_core: {
    id: 'st_melee_core', displayName: 'Melee Core', icon: '⚔️',
    description: 'Foundation of melee combat. +2 ATK, +10 HP.',
    region: 'melee_core', nodeType: 'stat', cost: 0, isStarter: true,
    prerequisiteNodeIds: [], connectedNodeIds: ['st_slash', 'st_heavy_strike', 'st_guardian_initiate', 'st_berserker_initiate', 'st_spellblade_bridge'],
    statBonuses: { attack: 2, maxHp: 10 },
  },
  st_slash: {
    id: 'st_slash', displayName: 'Slash', icon: '⚔️',
    description: 'Unlock Slash ability.',
    region: 'melee_core', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_melee_core'], connectedNodeIds: ['st_heavy_strike', 'st_duelist_precision'],
    abilityUnlockIds: ['slash'],
  },
  st_heavy_strike: {
    id: 'st_heavy_strike', displayName: 'Heavy Strike', icon: '💥',
    description: 'Unlock Heavy Strike.',
    region: 'melee_core', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_melee_core'], connectedNodeIds: ['st_cleave', 'st_reckless_strike'],
    abilityUnlockIds: ['heavy_strike'],
  },
  st_cleave: {
    id: 'st_cleave', displayName: 'Cleave', icon: '🌪️',
    description: 'Unlock Cleave — hits all enemies.',
    region: 'melee_core', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_heavy_strike'], connectedNodeIds: ['st_blood_reaver_bridge'],
    abilityUnlockIds: ['cleave'],
  },
  st_duelist_precision: {
    id: 'st_duelist_precision', displayName: 'Precision', icon: '🎯',
    description: '+3% crit chance.',
    region: 'duelist', nodeType: 'passive', cost: 1,
    prerequisiteNodeIds: ['st_slash'], connectedNodeIds: [],
    passiveEffectIds: ['crit_bonus_3'],
    statBonuses: { critChance: 3 },
  },

  // Guardian branch
  st_guardian_initiate: {
    id: 'st_guardian_initiate', displayName: 'Guardian Initiate', icon: '🛡️',
    description: '+2 DEF. Path to protection.',
    region: 'guardian', nodeType: 'stat', cost: 1,
    prerequisiteNodeIds: ['st_melee_core'], connectedNodeIds: ['st_guard', 'st_paladin_bridge'],
    statBonuses: { defense: 2 },
  },
  st_guardian_core: {
    id: 'st_guardian_core', displayName: 'Guardian Core', icon: '🛡️',
    description: 'Holy protector start. +2 DEF, +15 HP.',
    region: 'guardian', nodeType: 'stat', cost: 0, isStarter: true,
    prerequisiteNodeIds: [], connectedNodeIds: ['st_guard', 'st_protect_ally'],
    statBonuses: { defense: 2, maxHp: 15 },
  },
  st_guard: {
    id: 'st_guard', displayName: 'Guard', icon: '🛡️',
    description: 'Unlock Guard ability.',
    region: 'guardian', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_guardian_initiate'], connectedNodeIds: ['st_protect_ally'],
    abilityUnlockIds: ['guard'],
  },
  st_protect_ally: {
    id: 'st_protect_ally', displayName: 'Protect Ally', icon: '🤝',
    description: 'Unlock Protect Ally.',
    region: 'guardian', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_guard'], connectedNodeIds: ['st_paladin_bridge'],
    abilityUnlockIds: ['protect_ally'],
  },

  // Berserker branch
  st_berserker_initiate: {
    id: 'st_berserker_initiate', displayName: 'Berserker Initiate', icon: '🔥',
    description: '+3 ATK, -1 DEF. Aggressive path.',
    region: 'berserker', nodeType: 'stat', cost: 1,
    prerequisiteNodeIds: ['st_melee_core'], connectedNodeIds: ['st_reckless_strike', 'st_blood_reaver_bridge'],
    statBonuses: { attack: 3, defense: -1 },
  },
  st_reckless_strike: {
    id: 'st_reckless_strike', displayName: 'Reckless Strike', icon: '💢',
    description: 'Unlock Reckless Strike.',
    region: 'berserker', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_berserker_initiate'], connectedNodeIds: ['st_blood_reaver_bridge'],
    abilityUnlockIds: ['reckless_strike'],
  },

  // ── Ranged Core (Ranger start) ────────────────────────────────
  st_ranged_core: {
    id: 'st_ranged_core', displayName: 'Ranged Core', icon: '🏹',
    description: 'Foundation of ranged combat. +2 ATK, +1 SPD.',
    region: 'ranged_core', nodeType: 'stat', cost: 0, isStarter: true,
    prerequisiteNodeIds: [], connectedNodeIds: ['st_quick_shot', 'st_piercing_shot', 'st_hunter_initiate', 'st_rogue_initiate', 'st_warden_bridge'],
    statBonuses: { attack: 2, speed: 1 },
  },
  st_quick_shot: {
    id: 'st_quick_shot', displayName: 'Quick Shot', icon: '🏹',
    description: 'Unlock Quick Shot.',
    region: 'ranged_core', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_ranged_core'], connectedNodeIds: ['st_piercing_shot'],
    abilityUnlockIds: ['quick_shot'],
  },
  st_piercing_shot: {
    id: 'st_piercing_shot', displayName: 'Piercing Shot', icon: '🎯',
    description: 'Unlock Piercing Shot.',
    region: 'ranged_core', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_ranged_core'], connectedNodeIds: ['st_poison_strike'],
    abilityUnlockIds: ['piercing_shot'],
  },
  st_hunter_initiate: {
    id: 'st_hunter_initiate', displayName: 'Hunter Initiate', icon: '🎯',
    description: '+2 ATK, +2% crit.',
    region: 'hunter', nodeType: 'stat', cost: 1,
    prerequisiteNodeIds: ['st_ranged_core'], connectedNodeIds: ['st_warden_bridge'],
    statBonuses: { attack: 2, critChance: 2 },
  },
  st_rogue_initiate: {
    id: 'st_rogue_initiate', displayName: 'Rogue Initiate', icon: '🗡️',
    description: '+1 SPD. Path of the rogue.',
    region: 'rogue', nodeType: 'stat', cost: 1,
    prerequisiteNodeIds: ['st_ranged_core'], connectedNodeIds: ['st_poison_strike', 'st_bleed_cut'],
    statBonuses: { speed: 1 },
  },
  st_poison_strike: {
    id: 'st_poison_strike', displayName: 'Poison Strike', icon: '☠️',
    description: 'Unlock Poison Strike.',
    region: 'rogue', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_rogue_initiate'], connectedNodeIds: [],
    abilityUnlockIds: ['poison_strike'],
  },
  st_bleed_cut: {
    id: 'st_bleed_cut', displayName: 'Bleed Cut', icon: '🩸',
    description: 'Unlock Bleed Cut.',
    region: 'rogue', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_rogue_initiate'], connectedNodeIds: [],
    abilityUnlockIds: ['bleed_cut'],
  },

  // ── Magic Core (Mage start) ───────────────────────────────────
  st_arcane_core: {
    id: 'st_arcane_core', displayName: 'Arcane Core', icon: '🔮',
    description: 'Foundation of magic. +3 Magic, +5 Mana.',
    region: 'magic_core', nodeType: 'stat', cost: 0, isStarter: true,
    prerequisiteNodeIds: [], connectedNodeIds: ['st_fire_bolt', 'st_heal_node', 'st_elemental_focus', 'st_blood_initiate', 'st_spellblade_bridge'],
    statBonuses: { magic: 3, maxMana: 5 },
  },
  st_fire_bolt: {
    id: 'st_fire_bolt', displayName: 'Fire Bolt', icon: '🔥',
    description: 'Unlock Fire Bolt.',
    region: 'elemental', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_arcane_core'], connectedNodeIds: ['st_ice_shard', 'st_lightning_arc'],
    abilityUnlockIds: ['fire_bolt'],
  },
  st_heal_node: {
    id: 'st_heal_node', displayName: 'Heal', icon: '💚',
    description: 'Unlock Heal ability.',
    region: 'healing', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_arcane_core'], connectedNodeIds: ['st_regeneration_node', 'st_paladin_bridge'],
    abilityUnlockIds: ['heal'],
  },
  st_elemental_focus: {
    id: 'st_elemental_focus', displayName: 'Elemental Focus', icon: '🌪️',
    description: '+5% magic damage.',
    region: 'elemental', nodeType: 'passive', cost: 1,
    prerequisiteNodeIds: ['st_arcane_core'], connectedNodeIds: ['st_ice_shard'],
    passiveEffectIds: ['magic_damage_5'],
    statBonuses: { magic: 2 },
  },
  st_blood_initiate: {
    id: 'st_blood_initiate', displayName: 'Blood Initiate', icon: '🩸',
    description: 'Path to blood magic. +2 Magic.',
    region: 'blood_magic', nodeType: 'stat', cost: 1,
    prerequisiteNodeIds: ['st_arcane_core'], connectedNodeIds: ['st_life_drain', 'st_blood_reaver_bridge'],
    statBonuses: { magic: 2 },
  },
  st_life_drain: {
    id: 'st_life_drain', displayName: 'Life Drain', icon: '🩸',
    description: 'Unlock Life Drain.',
    region: 'blood_magic', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_blood_initiate'], connectedNodeIds: ['st_blood_price'],
    abilityUnlockIds: ['life_drain'],
  },
  st_blood_price: {
    id: 'st_blood_price', displayName: 'Blood Price', icon: '💉',
    description: 'Unlock Blood Price.',
    region: 'blood_magic', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_life_drain'], connectedNodeIds: [],
    abilityUnlockIds: ['blood_price'],
    isKeystone: true,
  },
  st_ice_shard: {
    id: 'st_ice_shard', displayName: 'Ice Shard', icon: '❄️',
    description: 'Unlock Ice Shard.',
    region: 'elemental', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_elemental_focus'], connectedNodeIds: [],
    abilityUnlockIds: ['ice_shard'],
  },
  st_lightning_arc: {
    id: 'st_lightning_arc', displayName: 'Lightning Arc', icon: '⚡',
    description: 'Unlock Lightning Arc.',
    region: 'elemental', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_fire_bolt'], connectedNodeIds: [],
    abilityUnlockIds: ['lightning_arc'],
  },

  // Healing / Druid
  st_healing_core: {
    id: 'st_healing_core', displayName: 'Healing Core', icon: '💚',
    description: 'Divine healing path. +2 Magic, +10 HP.',
    region: 'healing', nodeType: 'stat', cost: 0, isStarter: true,
    prerequisiteNodeIds: [], connectedNodeIds: ['st_regeneration_node', 'st_nature_mend'],
    statBonuses: { magic: 2, maxHp: 10 },
  },
  st_regeneration_node: {
    id: 'st_regeneration_node', displayName: 'Regeneration', icon: '🌱',
    description: 'Unlock Regeneration.',
    region: 'healing', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_heal_node'], connectedNodeIds: ['st_nature_mend'],
    abilityUnlockIds: ['regeneration'],
  },
  st_nature_mend: {
    id: 'st_nature_mend', displayName: 'Nature Mend', icon: '🌿',
    description: 'Unlock Nature Mend.',
    region: 'druid', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_regeneration_node'], connectedNodeIds: ['st_thorn_shield'],
    abilityUnlockIds: ['nature_mend'],
  },
  st_thorn_shield: {
    id: 'st_thorn_shield', displayName: 'Thorn Shield', icon: '🌵',
    description: 'Unlock Thorn Shield.',
    region: 'druid', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_nature_mend'], connectedNodeIds: ['st_warden_bridge'],
    abilityUnlockIds: ['thorn_shield'],
  },
  st_healing_focus: {
    id: 'st_healing_focus', displayName: 'Healing Focus', icon: '✨',
    description: '+5% healing done.',
    region: 'healing', nodeType: 'passive', cost: 1,
    prerequisiteNodeIds: ['st_heal_node'], connectedNodeIds: [],
    passiveEffectIds: ['heal_bonus_5'],
  },

  // Necromancy
  st_necro_initiate: {
    id: 'st_necro_initiate', displayName: 'Necromancy Initiate', icon: '💀',
    description: '+2 Magic, +2 Resistance.',
    region: 'necromancy', nodeType: 'stat', cost: 1,
    prerequisiteNodeIds: ['st_blood_initiate'], connectedNodeIds: ['st_bone_armor', 'st_soul_bolt'],
    statBonuses: { magic: 2, resistance: 2 },
  },
  st_bone_armor: {
    id: 'st_bone_armor', displayName: 'Bone Armor', icon: '🦴',
    description: 'Unlock Bone Armor.',
    region: 'necromancy', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_necro_initiate'], connectedNodeIds: [],
    abilityUnlockIds: ['bone_armor'],
  },
  st_soul_bolt: {
    id: 'st_soul_bolt', displayName: 'Soul Bolt', icon: '👻',
    description: 'Unlock Soul Bolt.',
    region: 'necromancy', nodeType: 'ability', cost: 1,
    prerequisiteNodeIds: ['st_necro_initiate'], connectedNodeIds: [],
    abilityUnlockIds: ['soul_bolt'],
  },

  // ── Hybrid bridges ────────────────────────────────────────────
  st_spellblade_bridge: {
    id: 'st_spellblade_bridge', displayName: 'Spellblade Bridge', icon: '🔗',
    description: 'Connect Magic and Melee. +1 ATK, +1 Magic.',
    region: 'hybrid', nodeType: 'stat', cost: 1,
    prerequisiteNodeIds: [], connectedNodeIds: ['st_melee_core', 'st_arcane_core'],
    statBonuses: { attack: 1, magic: 1 },
  },
  st_warden_bridge: {
    id: 'st_warden_bridge', displayName: 'Warden Bridge', icon: '🔗',
    description: 'Connect Ranged and Nature. +1 SPD, +10 HP.',
    region: 'hybrid', nodeType: 'stat', cost: 1,
    prerequisiteNodeIds: [], connectedNodeIds: ['st_ranged_core', 'st_thorn_shield'],
    statBonuses: { speed: 1, maxHp: 10 },
  },
  st_blood_reaver_bridge: {
    id: 'st_blood_reaver_bridge', displayName: 'Blood Reaver Bridge', icon: '🔗',
    description: 'Connect Berserker and Blood Magic. +2 ATK.',
    region: 'hybrid', nodeType: 'stat', cost: 1,
    prerequisiteNodeIds: [], connectedNodeIds: ['st_berserker_initiate', 'st_blood_initiate'],
    statBonuses: { attack: 2 },
  },
  st_paladin_bridge: {
    id: 'st_paladin_bridge', displayName: 'Paladin Bridge', icon: '🔗',
    description: 'Connect Guardian and Healing. +2 DEF, +10 HP.',
    region: 'hybrid', nodeType: 'stat', cost: 1,
    prerequisiteNodeIds: [], connectedNodeIds: ['st_guardian_initiate', 'st_heal_node'],
    statBonuses: { defense: 2, maxHp: 10 },
  },

  // Keystones (simple passives for MVP)
  st_glass_cannon: {
    id: 'st_glass_cannon', displayName: 'Glass Cannon', icon: '💎',
    description: 'Keystone: +15% damage, -10% defense.',
    region: 'elemental', nodeType: 'keystone', cost: 2, isKeystone: true,
    prerequisiteNodeIds: ['st_lightning_arc'], connectedNodeIds: [],
    passiveEffectIds: ['glass_cannon'],
    statBonuses: { attack: 3, defense: -2 },
  },
};

// Passive effect registry (simple modifiers applied in combat-build)
const PASSIVE_EFFECT_DEFINITIONS = {
  crit_bonus_3:       { id: 'crit_bonus_3',       critChance: 3 },
  magic_damage_5:     { id: 'magic_damage_5',     damagePct: { magical: 0.05, fire: 0.05, ice: 0.05, lightning: 0.05 } },
  heal_bonus_5:       { id: 'heal_bonus_5',         healPct: 0.05 },
  glass_cannon:       { id: 'glass_cannon',         damagePct: { all: 0.15 }, defensePct: -0.10 },
  last_stand:         { id: 'last_stand',           lowHpDefBonus: { threshold: 0.3, defense: 8 } },
};
