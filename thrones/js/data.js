'use strict';
// =============================================================
// data.js — All static + mutable game content
// =============================================================

// ── Skill definitions (13 skills, OSRS-inspired) ──────────────
const SKILL_DEFINITIONS = {
  // ── Combat ──────────────────────────────────────────────────
  attack:       { id: 'attack',       displayName: 'Attack',       icon: '⚔️',  category: 'combat',    color: '#c04040', desc: 'Governs melee accuracy and contributes to attack power.' },
  strength:     { id: 'strength',     displayName: 'Strength',     icon: '💪',  category: 'combat',    color: '#b03030', desc: 'Directly increases melee damage dealt.' },
  defence:      { id: 'defence',      displayName: 'Defence',      icon: '🛡️',  category: 'combat',    color: '#4a90d9', desc: 'Reduces incoming damage from all sources.' },
  hitpoints:    { id: 'hitpoints',    displayName: 'Hitpoints',    icon: '❤️',  category: 'combat',    color: '#3aaa5e', desc: 'Determines maximum health. Higher level = more HP.' },
  magic:        { id: 'magic',        displayName: 'Magic',        icon: '🔮',  category: 'combat',    color: '#9060c0', desc: 'Powers spell casting and magical attack strength.' },
  range:        { id: 'range',        displayName: 'Range',        icon: '🏹',  category: 'combat',    color: '#60aa40', desc: 'Governs ranged weapon accuracy and damage.' },
  prayer:       { id: 'prayer',       displayName: 'Prayer',       icon: '✨',  category: 'combat',    color: '#d4a332', desc: 'Enables protective prayers and divine blessings.' },
  // ── Gathering ────────────────────────────────────────────────
  mining:       { id: 'mining',       displayName: 'Mining',       icon: '⛏️',  category: 'gathering', color: '#9a7a5a', desc: 'Mine ore, gems, and stone for smithing and building.' },
  woodcutting:  { id: 'woodcutting',  displayName: 'Woodcutting',  icon: '🪓',  category: 'gathering', color: '#8a6030', desc: 'Chop trees for logs used in construction and fire-making.' },
  fishing:      { id: 'fishing',      displayName: 'Fishing',      icon: '🎣',  category: 'gathering', color: '#4080c0', desc: 'Catch fish to cook into healing food.' },
  // ── Crafting ─────────────────────────────────────────────────
  smithing:     { id: 'smithing',     displayName: 'Smithing',     icon: '🔨',  category: 'crafting',  color: '#888898', desc: 'Smelt ore and forge weapons and armour.' },
  cooking:      { id: 'cooking',      displayName: 'Cooking',      icon: '🍖',  category: 'crafting',  color: '#d06020', desc: 'Cook fish and meat into healing food for battle.' },
  construction: { id: 'construction', displayName: 'Construction', icon: '🏗️',  category: 'crafting',  color: '#806840', desc: 'Build structures that grant party-wide buffs and utilities.' },
};

const COMBAT_SKILLS    = ['attack','strength','defence','hitpoints','magic','range','prayer'];
const GATHERING_SKILLS = ['mining','woodcutting','fishing'];
const CRAFTING_SKILLS  = ['smithing','cooking','construction'];

// ── XP table (OSRS formula, cumulative XP to reach each level) ─
// table[level] = total XP needed to be that level
const XP_TABLE = (() => {
  const t = [0, 0]; // index 0 unused; level 1 = 0 XP
  let pts = 0;
  for (let lvl = 1; lvl <= 98; lvl++) {
    pts += Math.floor((lvl + 300 * Math.pow(2, lvl / 7)) / 4);
    t.push(Math.floor(pts));
  }
  return t; // t[2]=83, t[5]=388, t[10]=1154, t[99]=13034431
})();

function xpToLevel(level)  { return XP_TABLE[Math.min(Math.max(level, 1), 99)] || 0; }
function xpForNextLevel(level) { return xpToLevel(Math.min(level + 1, 99)) - xpToLevel(level); }
function levelFromXp(xp) {
  let lvl = 1;
  while (lvl < 99 && xp >= XP_TABLE[lvl + 1]) lvl++;
  return lvl;
}
function xpProgressPct(xp, level) {
  if (level >= 99) return 100;
  const base = xpToLevel(level);
  const span = xpToLevel(level + 1) - base;
  return span > 0 ? Math.min(100, ((xp - base) / span) * 100) : 100;
}

// ── Skills common to all characters (starting level 1) ────────
function _allSkillsAtOne() {
  const s = {};
  Object.keys(SKILL_DEFINITIONS).forEach(id => { s[id] = 1; });
  return s;
}

// ── Character definitions ──────────────────────────────────────
const CHARACTER_DEFINITIONS = {
  warrior: {
    id: 'warrior', displayName: 'Warrior', rarity: 'common',
    description: 'High HP and steady damage. Built to endure.',
    baseMaxHP: 120, baseAttack: 20, baseDefense: 8, baseSpeed: 8,
    skillId: 'heavy_slash', color: '#d4a332', icon: '⚔️',
    startingLevels: { ..._allSkillsAtOne(), attack: 5, strength: 5, defence: 5, hitpoints: 10 },
    skillXpRates: { attack: 0.35, strength: 0.35, defence: 0.15, hitpoints: 0.15 },
    trait: { id: 'stalwart', displayName: 'Stalwart', icon: '🛡️',
             desc: '+15% Max HP, +10% Mining XP. Iron will, iron skin.',
             hpPct: 0.15, gatherXpPct: { mining: 0.10 } },
  },
  mage: {
    id: 'mage', displayName: 'Mage', rarity: 'uncommon',
    description: 'Glass cannon. Low survivability, high burst.',
    baseMaxHP: 75, baseAttack: 8, baseMagic: 28, baseDefense: 3, baseSpeed: 10,
    damageType: 'magic',
    skillId: 'fire_bolt', color: '#9060c0', icon: '🔮',
    startingLevels: { ..._allSkillsAtOne(), magic: 9, defence: 3, hitpoints: 8 },
    skillXpRates: { magic: 0.65, defence: 0.15, hitpoints: 0.20 },
    trait: { id: 'arcane_affinity', displayName: 'Arcane Affinity', icon: '✨',
             desc: '+20% Magic damage, +10% Woodcutting XP.',
             atkPct: 0.20, gatherXpPct: { woodcutting: 0.10 } },
  },
  ranger: {
    id: 'ranger', displayName: 'Ranger', rarity: 'uncommon',
    description: 'Fastest unit on the field. Almost always acts first.',
    baseMaxHP: 90, baseAttack: 18, baseDefense: 5, baseSpeed: 16,
    skillId: 'piercing_shot', color: '#3aaa5e', icon: '🏹',
    startingLevels: { ..._allSkillsAtOne(), range: 8, attack: 3, defence: 3, hitpoints: 9 },
    skillXpRates: { range: 0.55, attack: 0.20, defence: 0.10, hitpoints: 0.15 },
    trait: { id: 'eagle_eye', displayName: 'Eagle Eye', icon: '👁️',
             desc: '+6% Crit, +10% Initiative, +15% Fishing XP.',
             critFlat: 6, initiativePct: 0.10, gatherXpPct: { fishing: 0.15 } },
  },
  guardian: {
    id: 'guardian', displayName: 'Guardian', rarity: 'uncommon',
    description: 'Immovable wall. Heals allies and shields them from harm.',
    baseMaxHP: 150, baseAttack: 14, baseDefense: 12, baseSpeed: 5,
    skillId: 'rallying_cry', color: '#4a90d9', icon: '🛡️',
    startingLevels: { ..._allSkillsAtOne(), defence: 9, hitpoints: 12, strength: 3, prayer: 5 },
    skillXpRates: { defence: 0.40, hitpoints: 0.25, strength: 0.20, prayer: 0.15 },
    trait: { id: 'protector', displayName: 'Protector', icon: '⚓',
             desc: '+4 Defense. Rallying Cry taunts enemies for 2 turns.',
             defFlat: 4 },
  },
  cleric: {
    id: 'cleric', displayName: 'Cleric', rarity: 'rare',
    description: 'Divine healer. Channels holy power to restore and shield allies.',
    baseMaxHP: 100, baseAttack: 6, baseMagic: 22, baseDefense: 5, baseSpeed: 9,
    baseResistance: 6,
    damageType: 'magic',
    skillId: 'holy_light', color: '#e0c060', icon: '✝️',
    startingLevels: { ..._allSkillsAtOne(), prayer: 10, hitpoints: 8, magic: 7, defence: 4 },
    skillXpRates: { prayer: 0.40, hitpoints: 0.25, magic: 0.25, defence: 0.10 },
    trait: { id: 'divine_touch', displayName: 'Divine Touch', icon: '✨',
             desc: '+30% Heal Power, +15% Prayer XP.',
             healPct: 0.30, prayerXpPct: 0.15 },
    healerRole: true,   // used by AI to prefer healing over attacking
  },
};

// ── Item definitions ───────────────────────────────────────────
// statModified: 'hp' | 'attack' | 'defense' | 'speed'
// slot: 'weapon' | 'helmet' | 'chest' | 'gloves' | 'boots' | 'ring' | 'amulet'
const ITEM_DEFINITIONS = {
  // ── Phase 5 starter & copper gear ─────────────────────────────
  rusty_sword:     { id: 'rusty_sword',     displayName: 'Rusty Sword',     icon: '🗡️',  rarity: 'common',   slot: 'weapon',  description: 'A battered blade, still sharper than fists.',               statModified: 'attack',  statAmount: 3  },
  copper_sword:    { id: 'copper_sword',    displayName: 'Copper Sword',    icon: '⚔️',  rarity: 'common',   slot: 'weapon',  description: 'A solid copper blade forged at the Basic Forge.',           statModified: 'attack',  statAmount: 8,  crafted: true },
  basic_hammer:    { id: 'basic_hammer',    displayName: 'Basic Hammer',    icon: '🔨',  rarity: 'common',   slot: 'weapon',  description: 'A crafter\'s hammer. Handy for smithing work.',             statModified: 'attack',  statAmount: 2  },
  runed_staff:     { id: 'runed_staff',     displayName: 'Runed Staff',     icon: '🪄',  rarity: 'common',   slot: 'weapon',  description: 'A simple staff humming with minor arcane energy.',          statModified: 'attack',  statAmount: 5,  skillBonus: { magic: 2 } },
  worn_armor:      { id: 'worn_armor',      displayName: 'Worn Armor',      icon: '🦺',  rarity: 'common',   slot: 'chest',   description: 'Scuffed leather and plate. Better than nothing.',           statModified: 'defense', statAmount: 3  },
  copper_armor:    { id: 'copper_armor',    displayName: 'Copper Armor',    icon: '🛡️',  rarity: 'common',   slot: 'chest',   description: 'Hammered copper plates. Reliable protection.',              statModified: 'defense', statAmount: 8,  crafted: true },
  cloth_robe:      { id: 'cloth_robe',      displayName: 'Cloth Robe',      icon: '👘',  rarity: 'common',   slot: 'chest',   description: 'Light robes that channel magical energy.',                  statModified: 'defense', statAmount: 2,  skillBonus: { magic: 1 } },
  simple_charm:    { id: 'simple_charm',    displayName: 'Simple Charm',    icon: '📿',  rarity: 'common',   slot: 'ring',    description: 'A small talisman that quickens the step.',                  statModified: 'speed',   statAmount: 2  },
  // ── Weapons ────────────────────────────────────────────────────
  iron_sword:      { id: 'iron_sword',      displayName: 'Iron Sword',      icon: '⚔️',  rarity: 'common',   slot: 'weapon',  description: 'A sturdy blade that adds serious cutting power.',            statModified: 'attack',  statAmount: 5,  levelReq: { attack: 5 } },
  hunters_bow:     { id: 'hunters_bow',     displayName: "Hunter's Bow",    icon: '🏹',  rarity: 'common',   slot: 'weapon',  description: 'A nimble bow. -1 ability cooldown.',                        statModified: 'attack',  statAmount: 4,  levelReq: { range: 5 }, abilityMod: { cooldownReduction: 1 } },
  runed_gauntlets: { id: 'runed_gauntlets', displayName: 'Runed Gauntlets', icon: '🧤',  rarity: 'uncommon', slot: 'weapon',  description: 'Runes boost arcane strikes. +3 Magic levels.',                statModified: 'attack',  statAmount: 7,  levelReq: { magic: 15 }, skillBonus: { magic: 3 } },
  // ── Helmets ────────────────────────────────────────────────────
  iron_helmet:     { id: 'iron_helmet',     displayName: 'Iron Helmet',     icon: '⛑️',  rarity: 'common',   slot: 'helmet',  description: 'A well-crafted iron cap. Reliable protection.',             statModified: 'hp',      statAmount: 15 },
  // ── Chest Armour ───────────────────────────────────────────────
  leather_vest:    { id: 'leather_vest',    displayName: 'Leather Vest',    icon: '🦺',  rarity: 'common',   slot: 'chest',   description: 'Tough cured hide. Absorbs more hits.',                      statModified: 'hp',      statAmount: 25 },
  wooden_shield:   { id: 'wooden_shield',   displayName: 'Wooden Shield',   icon: '🛡️',  rarity: 'common',   slot: 'chest',   description: 'Battered but dependable. Turns aside light blows.',         statModified: 'defense', statAmount: 3  },
  scale_armour:    { id: 'scale_armour',    displayName: 'Scale Armour',    icon: '🐉',  rarity: 'uncommon', slot: 'chest',   description: 'Overlapping scales — strong against piercing damage.',       statModified: 'defense', statAmount: 6,  levelReq: { defence: 12 } },
  iron_tower:      { id: 'iron_tower',      displayName: 'Iron Tower',      icon: '🏰',  rarity: 'uncommon', slot: 'chest',   description: 'A great-shield bearing the mark of an old kingdom.',        statModified: 'defense', statAmount: 10, levelReq: { defence: 18 } },
  // ── Gloves ────────────────────────────────────────────────────
  leather_gloves:  { id: 'leather_gloves',  displayName: 'Leather Gloves',  icon: '🫴',  rarity: 'common',   slot: 'gloves',  description: 'Supple hide gloves for a surer grip on any weapon.',        statModified: 'attack',  statAmount: 2  },
  iron_gauntlets:  { id: 'iron_gauntlets',  displayName: 'Iron Gauntlets',  icon: '🥊',  rarity: 'uncommon', slot: 'gloves',  description: 'Plated fists that deflect glancing blows.',                  statModified: 'defense', statAmount: 4,  levelReq: { defence: 10 } },
  // ── Boots ─────────────────────────────────────────────────────
  iron_boots:      { id: 'iron_boots',      displayName: 'Iron Boots',      icon: '🦾',  rarity: 'common',   slot: 'boots',   description: 'Heavy but grounding — slightly reinforces stance.',          statModified: 'defense', statAmount: 2  },
  speed_boots:     { id: 'speed_boots',     displayName: 'Speed Boots',     icon: '👢',  rarity: 'uncommon', slot: 'boots',   description: 'Enchanted soles. Move before your enemies can react.',       statModified: 'speed',   statAmount: 3,  levelReq: { attack: 10 }, abilityMod: { cooldownReduction: 1 } },
  shadow_cloak:    { id: 'shadow_cloak',    displayName: 'Shadow Treads',   icon: '🌑',  rarity: 'rare',     slot: 'boots',   description: 'Woven from shadow-silk. Harder to predict in battle.',      statModified: 'speed',   statAmount: 6,  levelReq: { range: 25 } },
  // ── Rings ─────────────────────────────────────────────────────
  scholar_ring:    { id: 'scholar_ring',    displayName: "Scholar's Ring",  icon: '🔮',  rarity: 'common',   slot: 'ring',    description: 'A modest ring channeling ambient energy into vitality.',     statModified: 'hp',      statAmount: 10 },
  ranger_ring:     { id: 'ranger_ring',     displayName: "Ranger's Band",   icon: '🟡',  rarity: 'uncommon', slot: 'ring',    description: 'A polished copper band engraved with hunting runes.',       statModified: 'attack',  statAmount: 3,  levelReq: { range: 8 }, skillBonus: { range: 2 } },
  berserker_ring:  { id: 'berserker_ring',  displayName: 'Berserker Ring',  icon: '💍',  rarity: 'rare',     slot: 'ring',    description: 'Raw aggression forged in metal. Massive power boost. Leeches 12% of damage dealt.',  statModified: 'attack',  statAmount: 10, levelReq: { strength: 30 },
                    passive: { type: 'lifesteal', value: 0.12 } },
  // ── Amulets ───────────────────────────────────────────────────
  amulet_of_str:   { id: 'amulet_of_str',   displayName: 'Amulet of Might', icon: '📿',  rarity: 'common',   slot: 'amulet',  description: 'A crude carved amulet that sharpens fighting instincts.',   statModified: 'attack',  statAmount: 3  },
  silver_pendant:  { id: 'silver_pendant',  displayName: 'Silver Pendant',  icon: '🏅',  rarity: 'uncommon', slot: 'amulet',  description: 'A silver charm said to ward off mortal blows.',             statModified: 'hp',      statAmount: 15, levelReq: { prayer: 8 }, skillBonus: { prayer: 2 } },
  dragons_heart:   { id: 'dragons_heart',   displayName: "Dragon's Heart",  icon: '💎',  rarity: 'rare',     slot: 'amulet',  description: 'A gem pulsing with draconic life-force. Enormous HP. Thorns reflect 5 damage on every hit received.',  statModified: 'hp',  statAmount: 50, levelReq: { hitpoints: 35 },
                    passive: { type: 'thorns', value: 5 } },
  // ── Smithed gear (crafted via Smithing skill) ──────────────────
  copper_dagger:   { id: 'copper_dagger',   displayName: 'Copper Dagger',   icon: '🗡️',  rarity: 'common',   slot: 'weapon',  description: 'A crude copper blade. Better than bare fists.',              statModified: 'attack',  statAmount: 4,  crafted: true },
  copper_shield:   { id: 'copper_shield',   displayName: 'Copper Buckler',  icon: '🛡️',  rarity: 'common',   slot: 'chest',   description: 'A small hammered copper buckler.',                           statModified: 'defense', statAmount: 4,  crafted: true },
  iron_axe:        { id: 'iron_axe',        displayName: 'Iron Axe',        icon: '🪓',  rarity: 'uncommon', slot: 'weapon',  description: 'A heavy iron axe. High damage, built to last.',              statModified: 'attack',  statAmount: 8,  crafted: true, levelReq: { attack: 15, smithing: 15 } },
  iron_plate:      { id: 'iron_plate',      displayName: 'Iron Plate',      icon: '🛡️',  rarity: 'uncommon', slot: 'chest',   description: 'Solid iron plating that absorbs heavy blows.',              statModified: 'defense', statAmount: 8,  crafted: true, levelReq: { defence: 15, smithing: 20 } },
  iron_cap:        { id: 'iron_cap',        displayName: 'Iron Cap',        icon: '⛑️',  rarity: 'uncommon', slot: 'helmet',  description: 'A rounded iron helmet reinforced at the brow.',              statModified: 'hp',      statAmount: 30, crafted: true, levelReq: { smithing: 18 } },
  mithril_sword:   { id: 'mithril_sword',   displayName: 'Mithril Sword',   icon: '⚔️',  rarity: 'rare',     slot: 'weapon',  description: 'Almost weightless yet devastatingly sharp.',                statModified: 'attack',  statAmount: 14, crafted: true, levelReq: { attack: 40, smithing: 50 } },
  mithril_shield:  { id: 'mithril_shield',  displayName: 'Mithril Shield',  icon: '🛡️',  rarity: 'rare',     slot: 'chest',   description: 'The finest defensive smithing. Nearly impenetrable.',       statModified: 'defense', statAmount: 14, crafted: true, levelReq: { defence: 40, smithing: 55 } },
  mithril_helm:    { id: 'mithril_helm',    displayName: 'Mithril Helm',    icon: '👑',  rarity: 'rare',     slot: 'helmet',  description: 'Crowned with mithril — grants tremendous vitality.',         statModified: 'hp',      statAmount: 50, crafted: true, levelReq: { hitpoints: 30, smithing: 52 } },
  mithril_gloves:  { id: 'mithril_gloves',  displayName: 'Mithril Gloves',  icon: '🫱',  rarity: 'rare',     slot: 'gloves',  description: 'Weightless yet unyielding — every strike hits true. Leeches 8% of damage dealt.',  statModified: 'attack',  statAmount: 6,  crafted: true, levelReq: { strength: 35, smithing: 56 },
                    passive: { type: 'lifesteal', value: 0.08 } },
  mithril_treads:  { id: 'mithril_treads',  displayName: 'Mithril Treads',  icon: '🥾',  rarity: 'rare',     slot: 'boots',   description: 'Greaves that blur the wearer into near-invisible motion.',   statModified: 'speed',   statAmount: 5,  crafted: true, levelReq: { attack: 30, smithing: 54 }, abilityMod: { cooldownReduction: 1 } },
};

// ── Smithing recipes ───────────────────────────────────────────
// ingredientQty: how many ores required per craft.
const SMITHING_RECIPES = [
  { id: 'r_copper_dagger',  outputId: 'copper_dagger',  ingredient: 'copper_ore', ingredientQty: 2, smithingReq: 1,  xpPerSmith: 25  },
  { id: 'r_copper_shield',  outputId: 'copper_shield',  ingredient: 'copper_ore', ingredientQty: 3, smithingReq: 5,  xpPerSmith: 37  },
  { id: 'r_iron_axe',       outputId: 'iron_axe',       ingredient: 'iron_ore',   ingredientQty: 3, smithingReq: 15, xpPerSmith: 55  },
  { id: 'r_iron_plate',     outputId: 'iron_plate',     ingredient: 'iron_ore',   ingredientQty: 4, smithingReq: 20, xpPerSmith: 75  },
  { id: 'r_iron_cap',       outputId: 'iron_cap',       ingredient: 'iron_ore',   ingredientQty: 3, smithingReq: 18, xpPerSmith: 65  },
  { id: 'r_mithril_sword',   outputId: 'mithril_sword',  ingredient: 'mithril_ore', ingredientQty: 3, smithingReq: 50, xpPerSmith: 100 },
  { id: 'r_mithril_shield',  outputId: 'mithril_shield', ingredient: 'mithril_ore', ingredientQty: 4, smithingReq: 55, xpPerSmith: 125 },
  { id: 'r_mithril_helm',    outputId: 'mithril_helm',   ingredient: 'mithril_ore', ingredientQty: 3, smithingReq: 52, xpPerSmith: 110 },
  { id: 'r_mithril_gloves',  outputId: 'mithril_gloves', ingredient: 'mithril_ore', ingredientQty: 2, smithingReq: 56, xpPerSmith: 95  },
  { id: 'r_mithril_treads',  outputId: 'mithril_treads', ingredient: 'mithril_ore', ingredientQty: 2, smithingReq: 54, xpPerSmith: 90  },
];

// ── Skill definitions for combat abilities ─────────────────────
const SKILLS = {
  heavy_slash: {
    id: 'heavy_slash', displayName: 'Heavy Slash',
    description: 'A crushing blow that deals massive damage.',
    skillType: 'damage_single', powerMultiplier: 2.0,
    cooldown: 3, targetType: 'enemy',
  },
  whirlwind: {
    id: 'whirlwind', displayName: 'Whirlwind',
    description: 'A spinning strike that hits all enemies. Unlocks at Attack 20.',
    skillType: 'damage_all', powerMultiplier: 1.1,
    cooldown: 4, targetType: 'enemy',
  },
  fire_bolt: {
    id: 'fire_bolt', displayName: 'Fire Bolt',
    description: 'A concentrated burst of arcane fire.',
    skillType: 'damage_single', powerMultiplier: 2.5,
    cooldown: 3, targetType: 'enemy',
  },
  piercing_shot: {
    id: 'piercing_shot', displayName: 'Piercing Shot',
    description: "Cuts through 50% of the target's defense.",
    skillType: 'damage_single', powerMultiplier: 1.8,
    cooldown: 2, targetType: 'enemy', defPiercing: 0.5,
  },
  protect: {
    id: 'protect', displayName: 'Protect',
    description: "Raises an ally's defense for 2 turns.",
    skillType: 'buff_defense', powerMultiplier: 0,
    cooldown: 3, targetType: 'ally', buffAmount: 8, buffDuration: 2,
  },
  rallying_cry: {
    id: 'rallying_cry', displayName: 'Rallying Cry',
    description: "Heals the lowest-HP ally and taunts enemies for 2 turns.",
    skillType: 'heal_ally', powerMultiplier: 1.2,
    cooldown: 3, targetType: 'ally', appliesTaunt: 2,
  },
  arcane_shield: {
    id: 'arcane_shield', displayName: 'Arcane Shield',
    description: "Summons a magical barrier, greatly boosting defence for 3 turns.",
    skillType: 'buff_defense', powerMultiplier: 0,
    cooldown: 4, targetType: 'ally', buffAmount: 14, buffDuration: 3,
  },
  holy_light: {
    id: 'holy_light', displayName: 'Holy Light',
    description: "A burst of divine energy that heals the most injured ally for a large amount.",
    skillType: 'heal_ally', powerMultiplier: 2.0,
    cooldown: 2, targetType: 'ally',
  },
  void_pulse: {
    id: 'void_pulse', displayName: 'Void Pulse',
    description: 'Unleashes a wave of void energy that strikes all enemies.',
    skillType: 'damage_all', powerMultiplier: 0.9,
    cooldown: 3, targetType: 'enemy',
  },
};

// ── Enemy definitions ──────────────────────────────────────────
const ENEMY_DEFINITIONS = {
  // Area 1 — Training Grounds
  slime:         { id: 'slime',         displayName: 'Slime',           maxHP: 45,  attack: 8,  defense: 1,  resistance: 0,  speed: 4,  color: '#5ab55a', icon: '🟢' },
  goblin:        { id: 'goblin',        displayName: 'Goblin',          maxHP: 70,  attack: 14, defense: 3,  resistance: 1,  speed: 10, color: '#a08030', icon: '👺' },
  wolf:          { id: 'wolf',          displayName: 'Wolf',            maxHP: 60,  attack: 16, defense: 2,  resistance: 0,  speed: 15, color: '#9a9aaa', icon: '🐺' },
  training_boss: { id: 'training_boss', displayName: 'Boss',            maxHP: 180, attack: 22, defense: 8,  resistance: 3,  speed: 7,  color: '#c04040', icon: '👹' },
  // Area 2 — Whispering Wood
  bandit:        { id: 'bandit',        displayName: 'Bandit',          maxHP: 88,  attack: 19, defense: 4,  resistance: 1,  speed: 12, color: '#8a6030', icon: '🗡️' },
  orc:           { id: 'orc',           displayName: 'Orc Warrior',     maxHP: 115, attack: 25, defense: 7,  resistance: 2,  speed: 6,  color: '#5a8040', icon: '🪓' },
  dark_mage:     { id: 'dark_mage',     displayName: 'Dark Mage',       maxHP: 72,  attack: 30, defense: 2,  resistance: 12, speed: 11, color: '#8040a0', icon: '🧙',
                   damageType: 'magic' },
  orc_chieftain: { id: 'orc_chieftain', displayName: 'Orc Chieftain',   maxHP: 240, attack: 30, defense: 11, resistance: 5,  speed: 5,  color: '#c06040', icon: '👑' },
  // Area 3 — Iron Crags
  golem:         { id: 'golem',         displayName: 'Stone Golem',     maxHP: 160, attack: 28, defense: 14, resistance: 5,  speed: 4,  color: '#9a9aaa', icon: '🗿' },
  iron_knight:   { id: 'iron_knight',   displayName: 'Iron Knight',     maxHP: 140, attack: 32, defense: 12, resistance: 4,  speed: 7,  color: '#7080a0', icon: '⚙️' },
  lich:          { id: 'lich',          displayName: 'Lich',             maxHP: 95,  attack: 40, defense: 4,  resistance: 15, speed: 13, color: '#7040a0', icon: '💀',
                   damageType: 'magic' },
  iron_warlord:  { id: 'iron_warlord',  displayName: 'Iron Warlord',    maxHP: 320, attack: 38, defense: 16, resistance: 6,  speed: 6,  color: '#c04050', icon: '🦾' },
  // Area 4 — Shadow Reaches
  shadow_archer: { id: 'shadow_archer', displayName: 'Shadow Archer',   maxHP: 105, attack: 44, defense: 5,  resistance: 3,  speed: 18, color: '#503060', icon: '🏹', critChance: 15 },
  void_mage:     { id: 'void_mage',     displayName: 'Void Mage',       maxHP: 85,  attack: 52, defense: 3,  resistance: 20, speed: 15, color: '#3020a0', icon: '🔮', critChance: 12,
                   damageType: 'magic' },
  ancient_colossus:{ id:'ancient_colossus',displayName:'Ancient Colossus',maxHP: 420,attack: 35, defense: 22, resistance: 8,  speed: 3,  color: '#706050', icon: '🗿', evasion: 0 },
  lich_king:     { id: 'lich_king',     displayName: 'Lich King',       maxHP: 280, attack: 48, defense: 10, resistance: 22, speed: 10, color: '#5020b0', icon: '👑',
                   skillId: 'arcane_shield', critChance: 18, damageType: 'magic' },
  // Area 5 — The Eternal Abyss
  void_wraith:   { id: 'void_wraith',   displayName: 'Void Wraith',     maxHP: 90,  attack: 58, defense: 2,  resistance: 25, speed: 20, color: '#6020c0', icon: '👻',
                   damageType: 'magic', critChance: 14 },
  abyssal_knight:{ id:'abyssal_knight', displayName: 'Abyssal Knight',  maxHP: 380, attack: 42, defense: 28, resistance: 8,  speed: 5,  color: '#304060', icon: '🗡️' },
  elder_lich:    { id: 'elder_lich',    displayName: 'Elder Lich',       maxHP: 120, attack: 62, defense: 5,  resistance: 30, speed: 14, color: '#5010a0', icon: '💀',
                   damageType: 'magic', skillId: 'fire_bolt', critChance: 20 },
  void_behemoth: { id: 'void_behemoth', displayName: 'Void Behemoth',   maxHP: 680, attack: 55, defense: 20, resistance: 15, speed: 7,  color: '#200050', icon: '🌑',
                   skillId: 'void_pulse', critChance: 10, damageType: 'magic' },
};

// ── Battle nodes ───────────────────────────────────────────────
// possibleDrops: [{ itemId, chance }] — chance is 0.0–1.0 per drop roll
const BATTLE_DEFINITIONS = [
  {
    id: 'battle_1', displayName: 'Slime Group', areaId: 'area_1',
    territoryId: 'territory_starting_field',
    enemyTeam: ['slime', 'slime', 'slime'],
    characterXpReward: 50, skillXpReward: 25, xpReward: 25, goldReward: 10,
    unlockedByDefault: true,
    unlocksOnComplete: { battles: ['battle_2'], areas: [], characters: [] },
    possibleResourceDrops: [
      { resourceId: 'normal_logs', qty: 3, chance: 0.85 },
    ],
    possibleDrops: [],
  },
  {
    id: 'battle_2', displayName: 'Goblin Pair', areaId: 'area_1',
    territoryId: 'territory_starting_field',
    enemyTeam: ['goblin', 'goblin'],
    characterXpReward: 75, skillXpReward: 35, xpReward: 35, goldReward: 20,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_3'], areas: [], characters: [] },
    possibleResourceDrops: [
      { resourceId: 'copper_ore', qty: 2, chance: 0.80 },
    ],
    possibleDrops: [],
  },
  {
    id: 'battle_3', displayName: 'Training Boss', areaId: 'area_1',
    territoryId: 'territory_starting_field',
    enemyTeam: ['slime', 'training_boss'],
    characterXpReward: 150, skillXpReward: 50, xpReward: 50, goldReward: 50,
    unlockedByDefault: false,
    isTerritoryBoss: true,
    unlocksOnComplete: { battles: ['battle_4'], areas: [], characters: [] },
    guaranteedResourceDrops: [
      { resourceId: 'copper_ore', qty: 5 },
    ],
    possibleDrops: [
      { itemId: 'rusty_sword', chance: 0.25 },
    ],
  },
  // ── Area 2 — Whispering Wood ─────────────────────────────────
  {
    id: 'battle_4', displayName: 'Goblin Miners', areaId: 'area_2',
    territoryId: 'territory_copper_hills',
    enemyTeam: ['goblin','goblin','goblin'],
    characterXpReward: 100, skillXpReward: 40, xpReward: 40, goldReward: 30,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_5'], areas: [], characters: [] },
    possibleDrops: [
      { itemId: 'iron_sword',    chance: 0.35 },
      { itemId: 'speed_boots',   chance: 0.30 },
      { itemId: 'leather_vest',  chance: 0.25 },
      { itemId: 'iron_gauntlets',chance: 0.22 },
      { itemId: 'ranger_ring',   chance: 0.20 },
    ],
  },
  {
    id: 'battle_5', displayName: 'Cave Wolf Pack', areaId: 'area_2',
    territoryId: 'territory_copper_hills',
    enemyTeam: ['wolf','wolf','wolf'],
    characterXpReward: 120, skillXpReward: 45, xpReward: 45, goldReward: 40,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_6'], areas: [], characters: [] },
    possibleDrops: [
      { itemId: 'scale_armour',   chance: 0.35 },
      { itemId: 'wooden_shield',  chance: 0.30 },
      { itemId: 'berserker_ring', chance: 0.12 },
      { itemId: 'silver_pendant', chance: 0.20 },
      { itemId: 'iron_gauntlets', chance: 0.25 },
    ],
  },
  {
    id: 'battle_6', displayName: "Chieftain's Keep", areaId: 'area_2',
    enemyTeam: ['dark_mage','orc','orc_chieftain'],
    xpReward: 650, goldReward: 140,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_7'], areas: ['area_3'], characters: [] },
    possibleDrops: [
      { itemId: 'berserker_ring', chance: 0.22 },
      { itemId: 'scale_armour',   chance: 0.45 },
      { itemId: 'speed_boots',    chance: 0.35 },
      { itemId: 'ranger_ring',    chance: 0.30 },
      { itemId: 'silver_pendant', chance: 0.25 },
    ],
  },
  // ── Area 3 — Iron Crags ──────────────────────────────────────
  {
    id: 'battle_7', displayName: 'Golem Quarry', areaId: 'area_3',
    enemyTeam: ['golem','golem','iron_knight'],
    xpReward: 800,  goldReward: 180,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_8'], areas: [], characters: [] },
    possibleDrops: [
      { itemId: 'iron_tower',     chance: 0.30 },
      { itemId: 'runed_gauntlets',chance: 0.25 },
      { itemId: 'dragons_heart',  chance: 0.10 },
      { itemId: 'iron_gauntlets', chance: 0.30 },
      { itemId: 'iron_boots',     chance: 0.28 },
    ],
  },
  {
    id: 'battle_8', displayName: 'Lich Sanctum', areaId: 'area_3',
    enemyTeam: ['lich','dark_mage','iron_knight'],
    xpReward: 1100, goldReward: 240,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_9'], areas: [], characters: [] },
    possibleDrops: [
      { itemId: 'shadow_cloak',   chance: 0.25 },
      { itemId: 'runed_gauntlets',chance: 0.35 },
      { itemId: 'dragons_heart',  chance: 0.14 },
    ],
  },
  {
    id: 'battle_9', displayName: 'Iron Throne', areaId: 'area_3',
    enemyTeam: ['lich','iron_knight','iron_warlord'],
    xpReward: 1600, goldReward: 380,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_10'], areas: ['area_4'], characters: ['cleric'] },
    possibleDrops: [
      { itemId: 'dragons_heart',  chance: 0.25 },
      { itemId: 'shadow_cloak',   chance: 0.30 },
      { itemId: 'berserker_ring', chance: 0.35 },
      { itemId: 'iron_tower',     chance: 0.40 },
    ],
  },
  // ── Area 4 — Shadow Reaches ───────────────────────────────────
  {
    id: 'battle_10', displayName: 'Shadow Vanguard', areaId: 'area_4',
    enemyTeam: ['shadow_archer','shadow_archer','void_mage'],
    xpReward: 2000, goldReward: 480,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_11'], areas: [], characters: [] },
    possibleDrops: [
      { itemId: 'mithril_sword',   chance: 0.30 },
      { itemId: 'shadow_cloak',    chance: 0.25 },
      { itemId: 'mithril_helm',    chance: 0.20 },
      { itemId: 'mithril_gloves',  chance: 0.18 },
      { itemId: 'berserker_ring',  chance: 0.20 },
    ],
  },
  {
    id: 'battle_11', displayName: 'Void Cataclysm', areaId: 'area_4',
    enemyTeam: ['void_mage','ancient_colossus','shadow_archer'],
    xpReward: 2600, goldReward: 600,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_12'], areas: [], characters: [] },
    possibleDrops: [
      { itemId: 'mithril_shield',  chance: 0.28 },
      { itemId: 'dragons_heart',   chance: 0.22 },
      { itemId: 'mithril_sword',   chance: 0.25 },
      { itemId: 'mithril_treads',  chance: 0.18 },
    ],
  },
  {
    id: 'battle_12', displayName: 'The Lich King', areaId: 'area_4',
    enemyTeam: ['shadow_archer','ancient_colossus','lich_king'],
    xpReward: 3500, goldReward: 850,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_13'], areas: ['area_5'], characters: [] },
    possibleDrops: [
      { itemId: 'mithril_helm',   chance: 0.40 },
      { itemId: 'mithril_sword',  chance: 0.35 },
      { itemId: 'mithril_shield', chance: 0.35 },
      { itemId: 'dragons_heart',  chance: 0.30 },
    ],
  },
  // ── Area 5 — The Eternal Abyss ────────────────────────────────
  {
    id: 'battle_13', displayName: 'Wraith Vanguard', areaId: 'area_5',
    enemyTeam: ['void_wraith','void_wraith','shadow_archer'],
    xpReward: 4500, goldReward: 1100,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_14'], areas: [], characters: [] },
    possibleDrops: [
      { itemId: 'mithril_gloves',  chance: 0.30 },
      { itemId: 'mithril_treads',  chance: 0.28 },
      { itemId: 'berserker_ring',  chance: 0.25 },
      { itemId: 'shadow_cloak',    chance: 0.20 },
    ],
  },
  {
    id: 'battle_14', displayName: 'Abyss Wardens', areaId: 'area_5',
    enemyTeam: ['abyssal_knight','abyssal_knight','elder_lich'],
    xpReward: 5500, goldReward: 1350,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: ['battle_15'], areas: [], characters: [] },
    possibleDrops: [
      { itemId: 'mithril_sword',   chance: 0.35 },
      { itemId: 'mithril_shield',  chance: 0.35 },
      { itemId: 'mithril_helm',    chance: 0.30 },
      { itemId: 'dragons_heart',   chance: 0.25 },
    ],
  },
  {
    id: 'battle_15', displayName: 'The Void Behemoth', areaId: 'area_5',
    enemyTeam: ['elder_lich','abyssal_knight','void_behemoth'],
    xpReward: 8000, goldReward: 2000,
    unlockedByDefault: false,
    unlocksOnComplete: { battles: [], areas: [], characters: [] },
    possibleDrops: [
      { itemId: 'mithril_gloves',  chance: 0.50 },
      { itemId: 'mithril_treads',  chance: 0.50 },
      { itemId: 'dragons_heart',   chance: 0.40 },
      { itemId: 'berserker_ring',  chance: 0.40 },
      { itemId: 'mithril_sword',   chance: 0.45 },
    ],
  },
];

// ── Area definitions ───────────────────────────────────────────
const AREA_DEFINITIONS = {
  area_1: { id: 'area_1', displayName: 'Training Grounds', unlockedByDefault: true },
  area_2: { id: 'area_2', displayName: 'Whispering Wood',  unlockedByDefault: false },
  area_3: { id: 'area_3', displayName: 'Iron Crags',       unlockedByDefault: false },
  area_4: { id: 'area_4', displayName: 'Shadow Reaches',   unlockedByDefault: false },
  area_5: { id: 'area_5', displayName: 'Eternal Abyss',   unlockedByDefault: false },
};

// ── Resource definitions ────────────────────────────────────────
// Raw materials gathered by the player. Used as cooking/smithing ingredients.
const RESOURCE_DEFINITIONS = {
  // Fishing
  raw_shrimp:    { id: 'raw_shrimp',    displayName: 'Raw Shrimp',    icon: '🦐', skill: 'fishing',    levelReq: 1,  xpPerGather: 10 },
  raw_trout:     { id: 'raw_trout',     displayName: 'Raw Trout',     icon: '🐟', skill: 'fishing',    levelReq: 20, xpPerGather: 50 },
  raw_salmon:    { id: 'raw_salmon',    displayName: 'Raw Salmon',    icon: '🐠', skill: 'fishing',    levelReq: 40, xpPerGather: 90 },
  // Mining
  copper_ore:    { id: 'copper_ore',    displayName: 'Copper Ore',    icon: '🪨', skill: 'mining',     levelReq: 1,  xpPerGather: 17 },
  minor_essence: { id: 'minor_essence', displayName: 'Minor Essence', icon: '✨', skill: 'magic',      levelReq: 1,  xpPerGather: 12 },
  tin_ore:       { id: 'tin_ore',       displayName: 'Tin Ore',       icon: '🔩', skill: 'mining',     levelReq: 10, xpPerGather: 28 },
  iron_ore:      { id: 'iron_ore',      displayName: 'Iron Ore',      icon: '⚫', skill: 'mining',     levelReq: 15, xpPerGather: 35 },
  mithril_ore:   { id: 'mithril_ore',   displayName: 'Mithril Ore',   icon: '💠', skill: 'mining',     levelReq: 55, xpPerGather: 80 },
  // Woodcutting
  normal_logs:   { id: 'normal_logs',   displayName: 'Logs',          icon: '🪵', skill: 'woodcutting', levelReq: 1, xpPerGather: 25 },
  oak_logs:      { id: 'oak_logs',      displayName: 'Oak Logs',      icon: '🌳', skill: 'woodcutting', levelReq: 15, xpPerGather: 38 },
  willow_logs:   { id: 'willow_logs',   displayName: 'Willow Logs',   icon: '🌿', skill: 'woodcutting', levelReq: 30, xpPerGather: 68 },
};

// ── Gathering nodes ─────────────────────────────────────────────
// Each node is a tap-to-gather location with a list of possible resources.
// tickMs: how many ms between each auto-gather tick (idle mode).
const GATHERING_NODES = [
  {
    id: 'fishing_spot',  displayName: 'Fishing Spot',  icon: '🎣',
    skill: 'fishing',    color: '#4080c0',
    tickMs: 4000,
    resources: ['raw_shrimp', 'raw_trout', 'raw_salmon'],
  },
  {
    id: 'mine_entrance', displayName: 'Mine Entrance', icon: '⛏️',
    skill: 'mining',     color: '#9a7a5a',
    tickMs: 5000,
    resources: ['copper_ore', 'iron_ore', 'mithril_ore'],
  },
  {
    id: 'forest_grove',  displayName: 'Forest Grove',  icon: '🪓',
    skill: 'woodcutting',color: '#8a6030',
    tickMs: 3500,
    resources: ['normal_logs', 'oak_logs', 'willow_logs'],
  },
];

// ── Food / recipe definitions ───────────────────────────────────
// healAmount: flat HP restored when eaten in battle.
const FOOD_DEFINITIONS = {
  shrimp:       { id: 'shrimp',       displayName: 'Shrimp',        icon: '🍤', cookingReq: 1,  healAmount: 15, ingredient: 'raw_shrimp', xpPerCook: 30 },
  cooked_fish:  { id: 'cooked_fish',  displayName: 'Cooked Fish',   icon: '🐟', cookingReq: 1,  healAmount: 25, ingredient: 'raw_shrimp', xpPerCook: 25 },
  trout:        { id: 'trout',        displayName: 'Cooked Trout',  icon: '🐟', cookingReq: 15, healAmount: 35, ingredient: 'raw_trout',  xpPerCook: 70 },
  salmon:       { id: 'salmon',       displayName: 'Cooked Salmon', icon: '🐠', cookingReq: 25, healAmount: 55, ingredient: 'raw_salmon', xpPerCook: 90 },
  spicy_shrimp: { id: 'spicy_shrimp', displayName: 'Spicy Shrimp',  icon: '🌶️', cookingReq: 8,  healAmount: 0,  ingredient: 'raw_shrimp', xpPerCook: 45, buffType: 'attack',  buffAmount: 5, buffTurns: 3 },
  hearty_stew:  { id: 'hearty_stew',  displayName: 'Hearty Stew',   icon: '🍲', cookingReq: 20, healAmount: 0,  ingredient: 'raw_trout',  xpPerCook: 85, buffType: 'defense', buffAmount: 8, buffTurns: 3 },
  swift_fillet: { id: 'swift_fillet', displayName: 'Swift Fillet',  icon: '💨', cookingReq: 30, healAmount: 0,  ingredient: 'raw_salmon', xpPerCook: 110, buffType: 'speed',   buffAmount: 4, buffTurns: 2 },
};

// ── Shop item definitions ───────────────────────────────────────
// type: 'food' | 'item' — determines what inventory it goes into.
// cost: gold price per unit.
const SHOP_ITEMS = [
  // Food (buy without fishing)
  { id: 'shop_shrimp',  displayName: 'Shrimp',        icon: '🍤', type: 'food',  grantId: 'shrimp',          cost: 20,  description: 'Restores 15 HP to a hero in battle.' },
  { id: 'shop_trout',   displayName: 'Cooked Trout',  icon: '🐟', type: 'food',  grantId: 'trout',           cost: 50,  description: 'Restores 35 HP to a hero in battle.' },
  { id: 'shop_salmon',  displayName: 'Cooked Salmon', icon: '🐠', type: 'food',  grantId: 'salmon',          cost: 90,  description: 'Restores 55 HP to a hero in battle.' },
  { id: 'shop_spicy',   displayName: 'Spicy Shrimp',  icon: '🌶️', type: 'food',  grantId: 'spicy_shrimp',    cost: 55,  description: '+5 ATK for 3 turns in battle.' },
  { id: 'shop_stew',    displayName: 'Hearty Stew',   icon: '🍲', type: 'food',  grantId: 'hearty_stew',     cost: 120, description: '+8 DEF for 3 turns in battle.' },
  { id: 'shop_swift',   displayName: 'Swift Fillet',  icon: '💨', type: 'food',  grantId: 'swift_fillet',    cost: 160, description: '+4 SPD for 2 turns in battle.' },
  // Gear — available for purchase
  { id: 'shop_iron_sword',     displayName: 'Iron Sword',      icon: '⚔️', type: 'item', grantId: 'iron_sword',      cost: 180, description: '+5 ATK · Weapon slot.' },
  { id: 'shop_wooden_shield',  displayName: 'Wooden Shield',   icon: '🛡️', type: 'item', grantId: 'wooden_shield',   cost: 150, description: '+3 DEF · Chest slot.' },
  { id: 'shop_leather_vest',   displayName: 'Leather Vest',    icon: '🦺', type: 'item', grantId: 'leather_vest',    cost: 160, description: '+25 HP · Chest slot.' },
  { id: 'shop_iron_helmet',    displayName: 'Iron Helmet',     icon: '⛑️', type: 'item', grantId: 'iron_helmet',     cost: 160, description: '+15 HP · Helmet slot.' },
  { id: 'shop_leather_gloves', displayName: 'Leather Gloves',  icon: '🫴', type: 'item', grantId: 'leather_gloves',  cost: 120, description: '+2 ATK · Gloves slot.' },
  { id: 'shop_iron_boots',     displayName: 'Iron Boots',      icon: '🦾', type: 'item', grantId: 'iron_boots',      cost: 120, description: '+2 DEF · Boots slot.' },
  { id: 'shop_scholar_ring',   displayName: "Scholar's Ring",  icon: '🔮', type: 'item', grantId: 'scholar_ring',    cost: 100, description: '+10 HP · Ring slot.' },
  { id: 'shop_amulet_of_str',  displayName: 'Amulet of Might', icon: '📿', type: 'item', grantId: 'amulet_of_str',   cost: 130, description: '+3 ATK · Amulet slot.' },
  { id: 'shop_speed_boots',    displayName: 'Speed Boots',     icon: '👢', type: 'item', grantId: 'speed_boots',     cost: 220, description: '+3 SPD · Boots slot.' },
  { id: 'shop_scale_armour',   displayName: 'Scale Armour',    icon: '🐉', type: 'item', grantId: 'scale_armour',    cost: 300, description: '+6 DEF · Chest slot.' },
  { id: 'shop_iron_gauntlets', displayName: 'Iron Gauntlets',  icon: '🥊', type: 'item', grantId: 'iron_gauntlets',  cost: 200, description: '+4 DEF · Gloves slot.' },
  { id: 'shop_silver_pendant', displayName: 'Silver Pendant',  icon: '🏅', type: 'item', grantId: 'silver_pendant',  cost: 260, description: '+15 HP · Amulet slot.' },
  { id: 'shop_ranger_ring',    displayName: "Ranger's Band",   icon: '🟡', type: 'item', grantId: 'ranger_ring',     cost: 240, description: '+3 ATK · Ring slot.' },
];

// ── Building definitions ────────────────────────────────────────
// Each building is built once and gives a permanent party-wide passive.
// cost: { resourceId: qty }  constructionReq: minimum Construction level.
const BUILDING_DEFINITIONS = [
  {
    id: 'training_yard',
    displayName: 'Training Yard',
    icon: '⚔️',
    description: 'A sparring ground. Heroes earn 15% more XP from every battle.',
    cost: { normal_logs: 15 },
    constructionReq: 1,
    xpPerBuild: 100,
    effect: { xpBonus: 0.15 },             // applied in awardBattleXp
  },
  {
    id: 'fishing_hut',
    displayName: 'Fishing Hut',
    icon: '🏚️',
    description: 'A riverside shack. Fishing ticks are 25% faster.',
    cost: { normal_logs: 20 },
    constructionReq: 5,
    xpPerBuild: 160,
    effect: { fishingSpeedBonus: 0.25 },    // used in gather.js tick interval
  },
  {
    id: 'great_hall',
    displayName: 'Great Hall',
    icon: '🏛️',
    description: 'Raises morale. All heroes gain +25 max HP permanently.',
    cost: { normal_logs: 40, oak_logs: 10 },
    constructionReq: 12,
    xpPerBuild: 280,
    effect: { hpBonus: 25 },                // applied in getEffectiveStats
  },
  {
    id: 'forge_bellows',
    displayName: 'Forge Bellows',
    icon: '🔥',
    description: 'Superheats the forge. All heroes gain +5 Attack.',
    cost: { normal_logs: 20, copper_ore: 10 },
    constructionReq: 10,
    xpPerBuild: 220,
    effect: { atkBonus: 5 },                // applied in getEffectiveStats
  },
  {
    id: 'shrine',
    displayName: 'Shrine',
    icon: '⛩️',
    description: 'A sacred altar. Unlocks Piety prayer and grants +1 Prayer XP per gather tick.',
    cost: { oak_logs: 25 },
    constructionReq: 20,
    xpPerBuild: 350,
    effect: { unlocksPiety: true },
  },
  {
    id: 'watchtower',
    displayName: 'Watchtower',
    icon: '🗼',
    description: 'Scouts enemy positions. All heroes gain +5 Evasion in combat.',
    cost: { oak_logs: 30, willow_logs: 10 },
    constructionReq: 25,
    xpPerBuild: 400,
    effect: { evasionBonus: 5 },            // applied in getEffectiveStats
  },
];

// ── Building upgrades (tier 2, one per building) ───────────────
const BUILDING_UPGRADE_DEFINITIONS = {
  training_yard: {
    displayName: 'Advanced Training', icon: '🏋️',
    description: 'Elite sparring drills. +10% more battle XP.',
    cost: { oak_logs: 25, iron_ore: 8 },
    constructionReq: 18, xpPerUpgrade: 200,
    effect: { xpBonus: 0.10 },
  },
  fishing_hut: {
    displayName: 'Net Room', icon: '🪝',
    description: 'Dedicated net storage. +15% faster fishing.',
    cost: { oak_logs: 15, willow_logs: 5 },
    constructionReq: 12, xpPerUpgrade: 150,
    effect: { fishingSpeedBonus: 0.15 },
  },
  great_hall: {
    displayName: 'Feast Table', icon: '🍽️',
    description: 'Grand feasts raise morale. +15 party HP.',
    cost: { oak_logs: 30, willow_logs: 8 },
    constructionReq: 20, xpPerUpgrade: 250,
    effect: { hpBonus: 15 },
  },
  forge_bellows: {
    displayName: 'Master Forge', icon: '🔥',
    description: 'Superheated coals. +3 party Attack.',
    cost: { iron_ore: 15, oak_logs: 20 },
    constructionReq: 22, xpPerUpgrade: 220,
    effect: { atkBonus: 3 },
  },
  shrine: {
    displayName: 'Blessed Altar', icon: '🕯️',
    description: 'Sacred flames. +1 Prayer XP per gather tick.',
    cost: { oak_logs: 20, willow_logs: 5 },
    constructionReq: 28, xpPerUpgrade: 300,
    effect: { prayerXpBonus: 1 },
  },
  watchtower: {
    displayName: 'Scout Post', icon: '🔭',
    description: 'Elite scouts. +3 Evasion and 10% faster mining/woodcutting.',
    cost: { oak_logs: 25, iron_ore: 10 },
    constructionReq: 30, xpPerUpgrade: 350,
    effect: { evasionBonus: 3, miningSpeedBonus: 0.10, woodcuttingSpeedBonus: 0.10 },
  },
};

// ── Prayer definitions ──────────────────────────────────────────
// Prayers are selected before battle and apply a buff for its entire duration.
// effect: { atk, def, critBonus }  — flat bonuses applied to each player unit.
// requiresShrine: true means the Shrine building must be built first.
const PRAYER_DEFINITIONS = [
  {
    id: 'protect_melee',
    displayName: 'Protect from Melee',
    icon: '🛡️',
    description: 'Calls on divine shields. +10 Defense for all heroes.',
    prayerReq: 1,
    requiresShrine: false,
    effect: { def: 10 },
  },
  {
    id: 'strength_prayer',
    displayName: 'Superhuman Strength',
    icon: '💪',
    description: 'Divine fury surges through your team. +8 Attack for all heroes.',
    prayerReq: 10,
    requiresShrine: false,
    effect: { atk: 8 },
  },
  {
    id: 'eagle_eye',
    displayName: 'Eagle Eye',
    icon: '🦅',
    description: 'Sharpens every hero\'s aim. +8% Crit Chance for all heroes.',
    prayerReq: 15,
    requiresShrine: false,
    effect: { critBonus: 8 },
  },
  {
    id: 'piety',
    displayName: 'Piety',
    icon: '✨',
    description: 'The mightiest prayer. +6 ATK, +6 DEF, +5% Crit for all heroes. Requires Shrine.',
    prayerReq: 30,
    requiresShrine: true,
    effect: { atk: 6, def: 6, critBonus: 5 },
  },
];

// ── Skill tree definitions ─────────────────────────────────────
// Each hero has 3 branches × 4 rows = 12 nodes.
// Row 4 nodes cost 2 points (capstones), all others cost 1.
// effect keys: atkPct|defPct|hpPct|spdFlat|critFlat|evasionFlat|critMultBonus|xpBonus|accuracyFlat
const SKILL_TREE_DEFINITIONS = {
  warrior: {
    treeName: 'Melee Mastery',
    branches: [
      { id: 'duelist',   label: 'Duelist',  color: '#c94040', icon: '🗡️' },
      { id: 'berserker', label: 'Berserker', color: '#e07030', icon: '🪓' },
      { id: 'defender',  label: 'Defender',  color: '#4a90d9', icon: '🛡️' },
    ],
    nodes: [
      // Duelist
      { id:'w_d1', branch:'duelist',   row:1, displayName:'Blade Training',   icon:'⚔️', desc:'+5% Attack.',                      cost:1, requires:[],       effect:{ atkPct:0.05 } },
      { id:'w_d2', branch:'duelist',   row:2, displayName:'Quick Reflexes',   icon:'💨', desc:'+4% Evasion.',                     cost:1, requires:['w_d1'], effect:{ evasionFlat:4 } },
      { id:'w_d3', branch:'duelist',   row:3, displayName:'Precision Strike', icon:'🎯', desc:'+5% Crit Chance.',                 cost:1, requires:['w_d2'], effect:{ critFlat:5 } },
      { id:'w_d4', branch:'duelist',   row:4, displayName:'Master Duelist',   icon:'🏆', desc:'+10% ATK, +5% Crit.',             cost:2, requires:['w_d3'], effect:{ atkPct:0.10, critFlat:5 } },
      // Berserker
      { id:'w_b1', branch:'berserker', row:1, displayName:'Bloodlust',        icon:'🔥', desc:'+8% Attack.',                     cost:1, requires:[],       effect:{ atkPct:0.08 } },
      { id:'w_b2', branch:'berserker', row:2, displayName:'Battle Rage',      icon:'💢', desc:'+0.15 Crit Multiplier.',          cost:1, requires:['w_b1'], effect:{ critMultBonus:0.15 } },
      { id:'w_b3', branch:'berserker', row:3, displayName:'Savage Blow',      icon:'💥', desc:'+8% ATK, +0.1 Crit Mult.',       cost:1, requires:['w_b2'], effect:{ atkPct:0.08, critMultBonus:0.10 } },
      { id:'w_b4', branch:'berserker', row:4, displayName:'Warlord',          icon:'👑', desc:'+15% Attack.',                    cost:2, requires:['w_b3'], effect:{ atkPct:0.15 } },
      // Defender
      { id:'w_g1', branch:'defender',  row:1, displayName:'Iron Skin',        icon:'🪨', desc:'+8% Max HP.',                     cost:1, requires:[],       effect:{ hpPct:0.08 } },
      { id:'w_g2', branch:'defender',  row:2, displayName:'Stand Firm',       icon:'⚓', desc:'+5% Defense.',                    cost:1, requires:['w_g1'], effect:{ defPct:0.05 } },
      { id:'w_g3', branch:'defender',  row:3, displayName:'Shield Wall',      icon:'🏰', desc:'+8% HP, +5% DEF.',               cost:1, requires:['w_g2'], effect:{ hpPct:0.08, defPct:0.05 } },
      { id:'w_g4', branch:'defender',  row:4, displayName:'Fortress',         icon:'🗿', desc:'+12% HP, +8% DEF.',              cost:2, requires:['w_g3'], effect:{ hpPct:0.12, defPct:0.08 } },
    ],
  },
  mage: {
    treeName: 'Arcane Arts',
    branches: [
      { id:'destruction', label:'Destruction', color:'#9060c0', icon:'🔮' },
      { id:'arcane',      label:'Arcane',       color:'#5080e0', icon:'✨' },
      { id:'mystic',      label:'Mystic',        color:'#3aaa5e', icon:'🌿' },
    ],
    nodes: [
      // Destruction
      { id:'m_de1', branch:'destruction', row:1, displayName:'Arcane Surge',   icon:'🌪️', desc:'+8% Attack.',                     cost:1, requires:[],         effect:{ atkPct:0.08 } },
      { id:'m_de2', branch:'destruction', row:2, displayName:'Spell Mastery',  icon:'📖', desc:'+6% Crit Chance.',                cost:1, requires:['m_de1'],   effect:{ critFlat:6 } },
      { id:'m_de3', branch:'destruction', row:3, displayName:'Mana Overload',  icon:'💠', desc:'+10% Attack.',                    cost:1, requires:['m_de2'],   effect:{ atkPct:0.10 } },
      { id:'m_de4', branch:'destruction', row:4, displayName:'Archmage',       icon:'🧙', desc:'+15% ATK, +5% Crit.',            cost:2, requires:['m_de3'],   effect:{ atkPct:0.15, critFlat:5 } },
      // Arcane
      { id:'m_ar1', branch:'arcane',      row:1, displayName:'Arcane Focus',   icon:'🔵', desc:'+5 Accuracy.',                   cost:1, requires:[],         effect:{ accuracyFlat:5 } },
      { id:'m_ar2', branch:'arcane',      row:2, displayName:'Mind Shield',    icon:'🧿', desc:'+8% Max HP.',                    cost:1, requires:['m_ar1'],   effect:{ hpPct:0.08 } },
      { id:'m_ar3', branch:'arcane',      row:3, displayName:'Leyline Tap',    icon:'⚡', desc:'+8% Attack.',                    cost:1, requires:['m_ar2'],   effect:{ atkPct:0.08 } },
      { id:'m_ar4', branch:'arcane',      row:4, displayName:'Arcane Bastion', icon:'🌀', desc:'+10% HP, +5% DEF.',             cost:2, requires:['m_ar3'],   effect:{ hpPct:0.10, defPct:0.05 } },
      // Mystic
      { id:'m_su1', branch:'mystic',      row:1, displayName:'Battle Clarity', icon:'🌟', desc:'+10% Battle XP.',               cost:1, requires:[],         effect:{ xpBonus:0.10 } },
      { id:'m_su2', branch:'mystic',      row:2, displayName:'Quicken',        icon:'⏩', desc:'+2 Speed.',                     cost:1, requires:['m_su1'],   effect:{ spdFlat:2 } },
      { id:'m_su3', branch:'mystic',      row:3, displayName:'Ethereal Form',  icon:'👻', desc:'+5% Evasion.',                  cost:1, requires:['m_su2'],   effect:{ evasionFlat:5 } },
      { id:'m_su4', branch:'mystic',      row:4, displayName:'Transcendence',  icon:'☀️', desc:'+10% ATK, +10% Battle XP.',    cost:2, requires:['m_su3'],   effect:{ atkPct:0.10, xpBonus:0.10 } },
    ],
  },
  ranger: {
    treeName: 'Pathfinder',
    branches: [
      { id:'sharpshooter', label:'Sharpshooter', color:'#3aaa5e', icon:'🎯' },
      { id:'scout',        label:'Scout',          color:'#7ab8f0', icon:'💨' },
      { id:'trapper',      label:'Trapper',        color:'#d4a332', icon:'🏹' },
    ],
    nodes: [
      // Sharpshooter
      { id:'r_sh1', branch:'sharpshooter', row:1, displayName:'Keen Eye',          icon:'👁️', desc:'+5% Crit Chance.',              cost:1, requires:[],         effect:{ critFlat:5 } },
      { id:'r_sh2', branch:'sharpshooter', row:2, displayName:'Headshot',          icon:'💥', desc:'+0.2 Crit Multiplier.',         cost:1, requires:['r_sh1'],   effect:{ critMultBonus:0.20 } },
      { id:'r_sh3', branch:'sharpshooter', row:3, displayName:'Deadeye',           icon:'🔭', desc:'+6% Crit Chance, +8% ATK.',    cost:1, requires:['r_sh2'],   effect:{ critFlat:6, atkPct:0.08 } },
      { id:'r_sh4', branch:'sharpshooter', row:4, displayName:'Sniper',            icon:'🎖️', desc:'+10% ATK, +8% Crit Chance.',  cost:2, requires:['r_sh3'],   effect:{ atkPct:0.10, critFlat:8 } },
      // Scout
      { id:'r_sc1', branch:'scout',        row:1, displayName:'Fleet Foot',        icon:'👟', desc:'+2 Speed.',                     cost:1, requires:[],         effect:{ spdFlat:2 } },
      { id:'r_sc2', branch:'scout',        row:2, displayName:'Wind Step',         icon:'🌬️', desc:'+5% Evasion.',                 cost:1, requires:['r_sc1'],   effect:{ evasionFlat:5 } },
      { id:'r_sc3', branch:'scout',        row:3, displayName:'Shadow Dash',       icon:'🌑', desc:'+5% Evasion, +2 Speed.',        cost:1, requires:['r_sc2'],   effect:{ evasionFlat:5, spdFlat:2 } },
      { id:'r_sc4', branch:'scout',        row:4, displayName:'Ghost',             icon:'🫥', desc:'+4 Speed, +8% Evasion.',        cost:2, requires:['r_sc3'],   effect:{ spdFlat:4, evasionFlat:8 } },
      // Trapper
      { id:'r_tr1', branch:'trapper',      row:1, displayName:'Exploit Weakness',  icon:'🎣', desc:'+8% Attack.',                   cost:1, requires:[],         effect:{ atkPct:0.08 } },
      { id:'r_tr2', branch:'trapper',      row:2, displayName:'Serrated Tips',     icon:'🔪', desc:'+5% Crit Chance.',              cost:1, requires:['r_tr1'],   effect:{ critFlat:5 } },
      { id:'r_tr3', branch:'trapper',      row:3, displayName:'Kill Shot',         icon:'⚡', desc:'+10% Attack.',                  cost:1, requires:['r_tr2'],   effect:{ atkPct:0.10 } },
      { id:'r_tr4', branch:'trapper',      row:4, displayName:'Assassin',          icon:'☠️', desc:'+12% ATK, +5% Crit.',          cost:2, requires:['r_tr3'],   effect:{ atkPct:0.12, critFlat:5 } },
    ],
  },
  guardian: {
    treeName: 'Holy Vanguard',
    branches: [
      { id:'protector', label:'Protector', color:'#4a90d9', icon:'🛡️' },
      { id:'healer',    label:'Healer',     color:'#3aaa5e', icon:'💚' },
      { id:'bulwark',   label:'Bulwark',    color:'#9060c0', icon:'⚔️' },
    ],
    nodes: [
      // Protector
      { id:'g_pr1', branch:'protector', row:1, displayName:'Iron Will',      icon:'🪨', desc:'+10% Max HP.',                cost:1, requires:[],         effect:{ hpPct:0.10 } },
      { id:'g_pr2', branch:'protector', row:2, displayName:'Endurance',      icon:'⚓', desc:'+5% Defense.',               cost:1, requires:['g_pr1'],   effect:{ defPct:0.05 } },
      { id:'g_pr3', branch:'protector', row:3, displayName:'Unbreakable',    icon:'🏰', desc:'+10% HP, +5% DEF.',         cost:1, requires:['g_pr2'],   effect:{ hpPct:0.10, defPct:0.05 } },
      { id:'g_pr4', branch:'protector', row:4, displayName:'Bulwark Prime',  icon:'🗿', desc:'+15% HP, +8% DEF.',         cost:2, requires:['g_pr3'],   effect:{ hpPct:0.15, defPct:0.08 } },
      // Healer
      { id:'g_he1', branch:'healer',    row:1, displayName:'Vital Blessing', icon:'✨', desc:'+8% Max HP.',               cost:1, requires:[],         effect:{ hpPct:0.08 } },
      { id:'g_he2', branch:'healer',    row:2, displayName:'Holy Fervor',    icon:'🌟', desc:'+10% Battle XP.',           cost:1, requires:['g_he1'],   effect:{ xpBonus:0.10 } },
      { id:'g_he3', branch:'healer',    row:3, displayName:'Divine Shield',  icon:'💫', desc:'+8% HP, +5% DEF.',         cost:1, requires:['g_he2'],   effect:{ hpPct:0.08, defPct:0.05 } },
      { id:'g_he4', branch:'healer',    row:4, displayName:'Archangel',      icon:'👼', desc:'+12% HP, +15% Battle XP.', cost:2, requires:['g_he3'],   effect:{ hpPct:0.12, xpBonus:0.15 } },
      // Bulwark
      { id:'g_bu1', branch:'bulwark',   row:1, displayName:'War Hymn',       icon:'🎺', desc:'+6% Attack.',              cost:1, requires:[],         effect:{ atkPct:0.06 } },
      { id:'g_bu2', branch:'bulwark',   row:2, displayName:'Steel Shell',    icon:'🦺', desc:'+6% Defense.',             cost:1, requires:['g_bu1'],   effect:{ defPct:0.06 } },
      { id:'g_bu3', branch:'bulwark',   row:3, displayName:'Ancient Ward',   icon:'🌀', desc:'+8% HP, +5% Crit.',       cost:1, requires:['g_bu2'],   effect:{ hpPct:0.08, critFlat:5 } },
      { id:'g_bu4', branch:'bulwark',   row:4, displayName:'Avatar of War',  icon:'⚔️', desc:'+10% DEF, +8% ATK.',      cost:2, requires:['g_bu3'],   effect:{ defPct:0.10, atkPct:0.08 } },
    ],
  },
  cleric: {
    treeName: 'Divine Path',
    branches: [
      { id:'holy',     label:'Holy',     color:'#e0d040', icon:'✨' },
      { id:'warden',   label:'Warden',   color:'#4a90d9', icon:'🛡️' },
      { id:'devotion', label:'Devotion', color:'#9060c0', icon:'🙏' },
    ],
    nodes: [
      // Holy — healing power, attack scaling
      { id:'cl_ho1', branch:'holy',     row:1, displayName:'Sacred Touch',    icon:'💛', desc:'+8% Attack (heal power).',     cost:1, requires:[],          effect:{ atkPct:0.08 } },
      { id:'cl_ho2', branch:'holy',     row:2, displayName:'Mending Aura',    icon:'💚', desc:'+10% Max HP.',                 cost:1, requires:['cl_ho1'],  effect:{ hpPct:0.10 } },
      { id:'cl_ho3', branch:'holy',     row:3, displayName:'Holy Surge',      icon:'🌟', desc:'+12% Attack, +10% XP.',        cost:1, requires:['cl_ho2'],  effect:{ atkPct:0.12, xpBonus:0.10 } },
      { id:'cl_ho4', branch:'holy',     row:4, displayName:'Miracle',         icon:'👼', desc:'+15% ATK, +12% HP.',          cost:2, requires:['cl_ho3'],  effect:{ atkPct:0.15, hpPct:0.12 } },
      // Warden — defense and resistance
      { id:'cl_wa1', branch:'warden',   row:1, displayName:'Blessed Armour',  icon:'⛑️', desc:'+8% Max HP.',                  cost:1, requires:[],          effect:{ hpPct:0.08 } },
      { id:'cl_wa2', branch:'warden',   row:2, displayName:'Holy Ward',       icon:'🔰', desc:'+6% Defense.',                 cost:1, requires:['cl_wa1'],  effect:{ defPct:0.06 } },
      { id:'cl_wa3', branch:'warden',   row:3, displayName:'Aegis of Light',  icon:'🏰', desc:'+10% DEF, +10% HP.',          cost:1, requires:['cl_wa2'],  effect:{ defPct:0.10, hpPct:0.10 } },
      { id:'cl_wa4', branch:'warden',   row:4, displayName:'Holy Fortress',   icon:'⚔️', desc:'+12% DEF, +12% HP.',          cost:2, requires:['cl_wa3'],  effect:{ defPct:0.12, hpPct:0.12 } },
      // Devotion — crit, accuracy, XP
      { id:'cl_de1', branch:'devotion', row:1, displayName:'Focused Prayer',  icon:'📿', desc:'+10% Battle XP.',              cost:1, requires:[],          effect:{ xpBonus:0.10 } },
      { id:'cl_de2', branch:'devotion', row:2, displayName:'Holy Precision',  icon:'🎯', desc:'+8 Accuracy.',                 cost:1, requires:['cl_de1'],  effect:{ accuracyFlat:8 } },
      { id:'cl_de3', branch:'devotion', row:3, displayName:'Sacred Wrath',    icon:'⚡', desc:'+5% Crit Chance.',             cost:1, requires:['cl_de2'],  effect:{ critFlat:5 } },
      { id:'cl_de4', branch:'devotion', row:4, displayName:'Divine Judgement',icon:'🌈', desc:'+8% ATK, +8% Crit, +15% XP.', cost:2, requires:['cl_de3'],  effect:{ atkPct:0.08, critFlat:8, xpBonus:0.15 } },
    ],
  },
};

// ── Milestone definitions ──────────────────────────────────────
// condition(PLAYER_DATA) → boolean
// reward: { gold?, skillPoints? }  skillPoints go to ALL unlocked heroes.
const MILESTONE_DEFINITIONS = [
  // ── Combat ────────────────────────────────────────────────────
  {
    id: 'ms_first_win',   category: 'combat',   icon: '⚔️',
    displayName: 'First Victory',
    desc: 'Win your first battle.',
    condition: d => d.completedBattles.length >= 1,
    reward: { gold: 100 },
  },
  {
    id: 'ms_area1_clear', category: 'combat',   icon: '🏅',
    displayName: 'Training Complete',
    desc: 'Clear all battles in Area 1.',
    condition: d => ['battle_1','battle_2','battle_3'].every(b => d.completedBattles.includes(b)),
    reward: { gold: 250, skillPoints: 1 },
  },
  {
    id: 'ms_area2_clear', category: 'combat',   icon: '🌲',
    displayName: 'Wood Runners',
    desc: 'Clear all battles in Area 2.',
    condition: d => ['battle_4','battle_5','battle_6'].every(b => d.completedBattles.includes(b)),
    reward: { gold: 450, skillPoints: 1 },
  },
  {
    id: 'ms_area3_clear', category: 'combat',   icon: '⚙️',
    displayName: 'Iron Conqueror',
    desc: 'Clear all battles in Area 3.',
    condition: d => ['battle_7','battle_8','battle_9'].every(b => d.completedBattles.includes(b)),
    reward: { gold: 750, skillPoints: 2 },
  },
  {
    id: 'ms_area4_clear', category: 'combat',   icon: '👑',
    displayName: 'Shadow Vanquisher',
    desc: 'Clear all battles in Area 4.',
    condition: d => ['battle_10','battle_11','battle_12'].every(b => d.completedBattles.includes(b)),
    reward: { gold: 1200, skillPoints: 3 },
  },
  {
    id: 'ms_area5_clear', category: 'combat',   icon: '🌌',
    displayName: 'Void Conqueror',
    desc: 'Clear all battles in the Eternal Abyss.',
    condition: d => ['battle_13','battle_14','battle_15'].every(b => d.completedBattles.includes(b)),
    reward: { gold: 2500, skillPoints: 5 },
  },
  {
    id: 'ms_10_battles',  category: 'combat',   icon: '🎖️',
    displayName: 'Veteran',
    desc: 'Win 10 battles total.',
    condition: d => d.completedBattles.length >= 10,
    reward: { gold: 300, skillPoints: 1 },
  },
  {
    id: 'ms_prayer',      category: 'combat',   icon: '🙏',
    displayName: 'Faithful',
    desc: 'Activate any Prayer before a battle.',
    condition: d => d.activePrayer !== null,
    reward: { gold: 100 },
  },
  // ── Crafting ──────────────────────────────────────────────────
  {
    id: 'ms_build1',      category: 'crafting', icon: '🏗️',
    displayName: 'Builder',
    desc: 'Construct your first building.',
    condition: d => (d.buildings || []).length >= 1,
    reward: { gold: 150 },
  },
  {
    id: 'ms_build3',      category: 'crafting', icon: '🏰',
    displayName: 'Architect',
    desc: 'Construct 3 buildings.',
    condition: d => (d.buildings || []).length >= 3,
    reward: { gold: 300, skillPoints: 1 },
  },
  {
    id: 'ms_first_cook',  category: 'crafting', icon: '🍳',
    displayName: 'First Cook',
    desc: 'Cook any food for the first time.',
    condition: d => Object.values(d.food || {}).some(q => q > 0),
    reward: { gold: 80 },
  },
  {
    id: 'ms_first_smith', category: 'crafting', icon: '⚒️',
    displayName: "Smith's Touch",
    desc: 'Craft your first smithed item.',
    condition: d => {
      const smithedIds = new Set(SMITHING_RECIPES.map(r => r.outputId));
      return Object.keys(d.ownedItems || {}).some(k => smithedIds.has(k) && d.ownedItems[k] > 0);
    },
    reward: { gold: 120 },
  },
  // ── Economy ───────────────────────────────────────────────────
  {
    id: 'ms_gold1000',    category: 'economy',  icon: '💰',
    displayName: 'Gold Hoarder',
    desc: 'Have 1,000 gold at once.',
    condition: d => d.gold >= 1000,
    reward: { gold: 200 },
  },
  {
    id: 'ms_gold5000',    category: 'economy',  icon: '💎',
    displayName: 'Wealthy',
    desc: 'Have 5,000 gold at once.',
    condition: d => d.gold >= 5000,
    reward: { gold: 500, skillPoints: 1 },
  },
  // ── Items ─────────────────────────────────────────────────────
  {
    id: 'ms_own5items',   category: 'items',    icon: '🎒',
    displayName: 'Collector',
    desc: 'Own 5 different items.',
    condition: d => Object.keys(d.ownedItems || {}).filter(k => (d.ownedItems[k] || 0) > 0).length >= 5,
    reward: { gold: 200 },
  },
  {
    id: 'ms_rare_item',   category: 'items',    icon: '✨',
    displayName: 'Fortune Favors',
    desc: 'Obtain any Rare-quality item.',
    condition: d => Object.keys(d.ownedItems || {}).some(k => (d.ownedItems[k] || 0) > 0 && ITEM_DEFINITIONS[k]?.rarity === 'rare'),
    reward: { gold: 350, skillPoints: 1 },
  },
];

// ── Quest definitions (active objectives with claimable rewards) ─
const QUEST_DEFINITIONS = [
  {
    id: 'q_win_3', category: 'quest', icon: '⚔️',
    displayName: 'Prove Your Worth',
    desc: 'Win 3 battles.',
    condition: d => d.completedBattles.length >= 3,
    reward: { gold: 100 },
  },
  {
    id: 'q_gather_30', category: 'quest', icon: '🌿',
    displayName: 'Resource Haul',
    desc: 'Gather 30 total resources.',
    condition: d => getTotalResourcesCount(d) >= 30,
    reward: { skillPoints: 2 },
  },
  {
    id: 'q_boss_slayer', category: 'quest', icon: '👹',
    displayName: 'Boss Slayer',
    desc: 'Defeat any area boss battle.',
    condition: d => ['battle_3','battle_6','battle_9','battle_12','battle_15'].some(b => d.completedBattles.includes(b)),
    reward: { gold: 250, skillPoints: 1 },
  },
  {
    id: 'q_rare_encounter', category: 'quest', icon: '✨',
    displayName: 'Rare Find',
    desc: 'Obtain a Rare item from battle drops.',
    condition: d => Object.keys(d.ownedItems || {}).some(k => (d.ownedItems[k] || 0) > 0 && ITEM_DEFINITIONS[k]?.rarity === 'rare'),
    reward: { gold: 200 },
  },
];

function getTotalResourcesCount(data = PLAYER_DATA) {
  return Object.values(data.resources || {}).reduce((sum, n) => sum + n, 0);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4 — Territory, resource nodes, assignments
// ═══════════════════════════════════════════════════════════════

const TERRITORY_DEFINITIONS = {
  territory_starting_field: {
    id: 'territory_starting_field',
    displayName: 'Starting Field',
    description: 'A peaceful meadow with basic trees and a small pond. Home base for new adventurers.',
    icon: '🌾',
    color: '#5a8a40',
    unlockedByDefault: true,
    unlockBattleId: null,
    maxUpgradeLevel: 1,
    upgradePlaceholder: '⬆️ Territory Lv.1 — Clear campaign battles to strengthen the realm.',
    battleIds: ['battle_1', 'battle_2', 'battle_3'],
    buildSiteIds: ['starting_field_utility', 'starting_field_water'],
  },
  territory_copper_hills: {
    id: 'territory_copper_hills',
    displayName: 'Copper Hills',
    description: 'Rolling hills rich with copper veins. Stronger foes patrol the mines.',
    icon: '⛰️',
    color: '#9a7a5a',
    unlockedByDefault: false,
    unlockBattleId: 'battle_3',
    maxUpgradeLevel: 3,
    battleIds: ['battle_4', 'battle_5'],
    buildSiteIds: ['copper_hills_defense', 'copper_hills_forge'],
    previewWhenLocked: true,
  },
  territory_riverwood: {
    id: 'territory_riverwood',
    displayName: 'Riverwood',
    description: 'A lush forest along a winding river. Better fish and denser timber await.',
    icon: '🌲',
    color: '#3a7a50',
    unlockedByDefault: false,
    unlockBattleId: 'battle_6',
    discoverBattleId: 'battle_6',
    fogUntilDiscovered: true,
    maxUpgradeLevel: 2,
    battleIds: ['battle_6', 'battle_7', 'battle_8'],
    buildSiteIds: ['riverwood_hut'],
  },
  territory_ancient_marsh: {
    id: 'territory_ancient_marsh',
    displayName: 'Ancient Marsh',
    description: 'A misty wetland where ancient ruins sleep beneath the bog.',
    icon: '🌫️',
    color: '#5a6840',
    unlockedByDefault: false,
    unlockBattleId: null,
    fogUntilDiscovered: true,
    maxUpgradeLevel: 1,
    battleIds: [],
    buildSiteIds: [],
    upgradePlaceholder: '⬆️ Explore deeper territories to uncover this region.',
  },
  territory_shadow_lands: {
    id: 'territory_shadow_lands',
    displayName: 'Shadow Lands',
    description: 'Dark corrupted lands at the edge of the known world.',
    icon: '🌑',
    color: '#4a3060',
    unlockedByDefault: false,
    unlockBattleId: null,
    fogUntilDiscovered: true,
    maxUpgradeLevel: 1,
    battleIds: [],
    buildSiteIds: [],
    upgradePlaceholder: '⬆️ The path forward remains shrouded in mystery.',
  },
};

// Static resource node definitions (runtime amounts live in PLAYER_DATA.resourceNodeStates)
const TERRITORY_NODE_DEFINITIONS = {
  basic_tree: {
    id: 'basic_tree', territoryId: 'territory_starting_field',
    displayName: 'Small Grove', icon: '🌲', skillType: 'woodcutting',
    requiredSkillLevel: 1, resourceProduced: 'normal_logs',
    baseYield: 3, workDurationSeconds: 60, baseXp: 25,
    maxAvailable: 100, regenRatePerMinute: 2, unlockAtTerritoryLevel: 1,
  },
  small_fishing_pond: {
    id: 'small_fishing_pond', territoryId: 'territory_starting_field',
    displayName: 'Small Fishing Pond', icon: '🎣', skillType: 'fishing',
    requiredSkillLevel: 1, resourceProduced: 'raw_shrimp',
    baseYield: 2, workDurationSeconds: 90, baseXp: 30,
    maxAvailable: 80, regenRatePerMinute: 1, unlockAtTerritoryLevel: 1,
  },
  copper_mine: {
    id: 'copper_mine', territoryId: 'territory_copper_hills',
    displayName: 'Copper Mine', icon: '⛏️', skillType: 'mining',
    requiredSkillLevel: 1, resourceProduced: 'copper_ore',
    baseYield: 2, workDurationSeconds: 120, baseXp: 35,
    maxAvailable: 60, regenRatePerMinute: 0.5, unlockAtTerritoryLevel: 1,
  },
  copper_hills_tree: {
    id: 'copper_hills_tree', territoryId: 'territory_copper_hills',
    displayName: 'Hillside Tree', icon: '🪵', skillType: 'woodcutting',
    requiredSkillLevel: 1, resourceProduced: 'normal_logs',
    baseYield: 3, workDurationSeconds: 70, baseXp: 28,
    maxAvailable: 90, regenRatePerMinute: 1.5, unlockAtTerritoryLevel: 1,
  },
  tin_vein: {
    id: 'tin_vein', territoryId: 'territory_copper_hills',
    displayName: 'Tin Vein', icon: '🔩', skillType: 'mining',
    requiredSkillLevel: 10, resourceProduced: 'tin_ore',
    baseYield: 2, workDurationSeconds: 150, baseXp: 45,
    maxAvailable: 40, regenRatePerMinute: 0.35, unlockAtTerritoryLevel: 2,
  },
  river_fishing: {
    id: 'river_fishing', territoryId: 'territory_riverwood',
    displayName: 'River Fishing Spot', icon: '🐟', skillType: 'fishing',
    requiredSkillLevel: 15, resourceProduced: 'raw_trout',
    baseYield: 2, workDurationSeconds: 100, baseXp: 50,
    maxAvailable: 70, regenRatePerMinute: 0.8, unlockAtTerritoryLevel: 1,
  },
  dense_forest: {
    id: 'dense_forest', territoryId: 'territory_riverwood',
    displayName: 'Dense Forest', icon: '🌳', skillType: 'woodcutting',
    requiredSkillLevel: 15, resourceProduced: 'oak_logs',
    baseYield: 2, workDurationSeconds: 110, baseXp: 38,
    maxAvailable: 75, regenRatePerMinute: 1.2, unlockAtTerritoryLevel: 1,
  },
  willow_grove: {
    id: 'willow_grove', territoryId: 'territory_riverwood',
    displayName: 'Willow Grove', icon: '🌿', skillType: 'woodcutting',
    requiredSkillLevel: 30, resourceProduced: 'willow_logs',
    baseYield: 2, workDurationSeconds: 130, baseXp: 55,
    maxAvailable: 50, regenRatePerMinute: 0.6, unlockAtTerritoryLevel: 2,
  },
};

// Territory upgrade steps (level 2 = first upgrade from level 1)
const TERRITORY_UPGRADE_DEFINITIONS = {
  territory_copper_hills: [
    {
      level: 2,
      displayName: 'Expanded Mining',
      description: 'Surveyors discover a tin vein in the deeper tunnels.',
      cost: { copper_ore: 20, normal_logs: 10 },
      gold: 50,
      unlockNodeIds: ['tin_vein'],
    },
    {
      level: 3,
      displayName: 'Crystal Survey',
      description: 'Improved extraction techniques — all nodes regenerate 25% faster.',
      cost: { tin_ore: 10, copper_ore: 15 },
      gold: 100,
      regenBonusPct: 0.25,
    },
  ],
  territory_riverwood: [
    {
      level: 2,
      displayName: 'Deep Forest Trail',
      description: 'A hidden grove of willow trees is now accessible.',
      cost: { oak_logs: 15, raw_trout: 5 },
      gold: 75,
      unlockNodeIds: ['willow_grove'],
    },
  ],
};

// ── Phase 5: Territory build sites & structures ─────────────────
const TERRITORY_BUILD_SITE_DEFINITIONS = {
  starting_field_utility: {
    id: 'starting_field_utility', territoryId: 'territory_starting_field',
    displayName: 'Forge Site', icon: '🔨', allowedStructures: ['basic_forge'],
    emptyIcon: '🔨',
  },
  starting_field_water: {
    id: 'starting_field_water', territoryId: 'territory_starting_field',
    displayName: 'Dock Site', icon: '🏚️', allowedStructures: ['fishing_dock'],
    emptyIcon: '⚓',
  },
  copper_hills_defense: {
    id: 'copper_hills_defense', territoryId: 'territory_copper_hills',
    displayName: 'Watchtower Site', icon: '🗼', allowedStructures: ['watchtower'],
    emptyIcon: '🗼',
  },
  copper_hills_forge: {
    id: 'copper_hills_forge', territoryId: 'territory_copper_hills',
    displayName: 'Improved Forge Site', icon: '⚒️', allowedStructures: ['improved_forge'],
    emptyIcon: '⚒️',
  },
  riverwood_hut: {
    id: 'riverwood_hut', territoryId: 'territory_riverwood',
    displayName: 'Fishing Hut Site', icon: '🏚️', allowedStructures: ['fishing_dock'],
    emptyIcon: '⚓',
  },
};

const STRUCTURE_DEFINITIONS = {
  basic_forge: {
    id: 'basic_forge', displayName: 'Basic Forge', icon: '🔥',
    description: 'Unlocks copper smithing recipes.',
    effects: { unlockRecipes: ['recipe_copper_sword', 'recipe_copper_armor', 'recipe_copper_dagger'] },
  },
  fishing_dock: {
    id: 'fishing_dock', displayName: 'Fishing Dock', icon: '🏚️',
    description: 'Improves pond fishing regeneration and unlocks dock fishing jobs.',
    effects: { unlockRecipes: ['recipe_cooked_fish'], nodeRegenBonus: { small_fishing_pond: 0.5 }, unlockNodes: ['dock_fishing_spot'] },
  },
  watchtower: {
    id: 'watchtower', displayName: 'Watchtower', icon: '🗼',
    description: 'Scouts reveal an elite battle in this territory.',
    effects: { unlockOptionalBattles: ['battle_4'] },
  },
  improved_forge: {
    id: 'improved_forge', displayName: 'Improved Forge', icon: '⚒️',
    description: 'Unlocks higher-tier smithing recipes.',
    effects: { unlockRecipes: ['recipe_iron_sword', 'recipe_copper_armor', 'recipe_copper_sword'] },
  },
};

// Timed crafting / construction recipes (Phase 5)
const CRAFT_RECIPE_DEFINITIONS = {
  // ── Smithing ──────────────────────────────────────────────────
  recipe_copper_sword: {
    id: 'recipe_copper_sword', displayName: 'Copper Sword', icon: '⚔️',
    skillType: 'smithing', requiredSkillLevel: 1, durationSeconds: 180,
    resources: { copper_ore: 3, normal_logs: 1 },
    outputType: 'item', outputId: 'copper_sword', outputQty: 1, xpReward: 50,
    requiredStructureId: 'basic_forge',
  },
  recipe_copper_armor: {
    id: 'recipe_copper_armor', displayName: 'Copper Armor', icon: '🛡️',
    skillType: 'smithing', requiredSkillLevel: 1, durationSeconds: 200,
    resources: { copper_ore: 4, normal_logs: 2 },
    outputType: 'item', outputId: 'copper_armor', outputQty: 1, xpReward: 55,
    requiredStructureId: 'basic_forge',
  },
  recipe_copper_dagger: {
    id: 'recipe_copper_dagger', displayName: 'Copper Dagger', icon: '🗡️',
    skillType: 'smithing', requiredSkillLevel: 1, durationSeconds: 120,
    resources: { copper_ore: 2 },
    outputType: 'item', outputId: 'copper_dagger', outputQty: 1, xpReward: 25,
    requiredStructureId: 'basic_forge',
  },
  recipe_iron_sword: {
    id: 'recipe_iron_sword', displayName: 'Iron Sword', icon: '⚔️',
    skillType: 'smithing', requiredSkillLevel: 15, durationSeconds: 300,
    resources: { iron_ore: 3 },
    outputType: 'item', outputId: 'iron_sword', outputQty: 1, xpReward: 55,
  },
  // ── Cooking ───────────────────────────────────────────────────
  recipe_cooked_fish: {
    id: 'recipe_cooked_fish', displayName: 'Cooked Fish', icon: '🐟',
    skillType: 'cooking', requiredSkillLevel: 1, durationSeconds: 60,
    resources: { raw_shrimp: 1 },
    outputType: 'food', outputId: 'cooked_fish', outputQty: 1, xpReward: 25,
  },
  recipe_shrimp: {
    id: 'recipe_shrimp', displayName: 'Shrimp', icon: '🍤',
    skillType: 'cooking', requiredSkillLevel: 1, durationSeconds: 45,
    resources: { raw_shrimp: 1 },
    outputType: 'food', outputId: 'shrimp', outputQty: 1, xpReward: 30,
  },
  recipe_trout: {
    id: 'recipe_trout', displayName: 'Cooked Trout', icon: '🐟',
    skillType: 'cooking', requiredSkillLevel: 15, durationSeconds: 90,
    resources: { raw_trout: 1 },
    outputType: 'food', outputId: 'trout', outputQty: 1, xpReward: 70,
  },
  // ── Construction (territory structures) ───────────────────────
  build_basic_forge: {
    id: 'build_basic_forge', displayName: 'Basic Forge', icon: '🔥',
    skillType: 'construction', requiredSkillLevel: 1, durationSeconds: 300,
    resources: { normal_logs: 10, copper_ore: 5 },
    outputType: 'structure', structureId: 'basic_forge',
    buildSiteId: 'starting_field_utility', xpReward: 80,
  },
  build_fishing_dock: {
    id: 'build_fishing_dock', displayName: 'Fishing Dock', icon: '🏚️',
    skillType: 'construction', requiredSkillLevel: 1, durationSeconds: 240,
    resources: { normal_logs: 15 },
    outputType: 'structure', structureId: 'fishing_dock',
    buildSiteId: 'starting_field_water', xpReward: 70,
  },
  build_watchtower: {
    id: 'build_watchtower', displayName: 'Watchtower', icon: '🗼',
    skillType: 'construction', requiredSkillLevel: 5, durationSeconds: 360,
    resources: { normal_logs: 20, copper_ore: 5 },
    outputType: 'structure', structureId: 'watchtower',
    buildSiteId: 'copper_hills_defense', xpReward: 100,
  },
  build_improved_forge: {
    id: 'build_improved_forge', displayName: 'Improved Forge', icon: '⚒️',
    skillType: 'construction', requiredSkillLevel: 8, durationSeconds: 420,
    resources: { copper_ore: 15, tin_ore: 5, normal_logs: 10 },
    outputType: 'structure', structureId: 'improved_forge',
    buildSiteId: 'copper_hills_forge', xpReward: 120,
  },
};

// Extra fishing node unlocked by Fishing Dock
TERRITORY_NODE_DEFINITIONS.dock_fishing_spot = {
  id: 'dock_fishing_spot', territoryId: 'territory_starting_field',
  displayName: 'Dock Fishing', icon: '🎣', skillType: 'fishing',
  requiredSkillLevel: 5, resourceProduced: 'raw_trout',
  baseYield: 2, workDurationSeconds: 80, baseXp: 40,
  maxAvailable: 50, regenRatePerMinute: 0.8, unlockAtTerritoryLevel: 1,
  requiredStructureId: 'fishing_dock',
};

// ── Starter character types (Phase 5) ─────────────────────────
const STARTER_DEFINITIONS = {
  warrior: {
    id: 'warrior', displayName: 'Warrior', icon: '⚔️',
    desc: 'Sturdy fighter with blade and armor. Bonus copper ore.',
    team: ['warrior'], unlockedCharacters: ['warrior'],
    items: { rusty_sword: 1, worn_armor: 1 },
    resources: { copper_ore: 5 },
    equip: { warrior: { weapon: 'rusty_sword', chest: 'worn_armor' } },
  },
  ranger: {
    id: 'ranger', displayName: 'Ranger', icon: '🏹',
    desc: 'Hunter with bow, wood, and raw fish. Gathering focus.',
    team: ['ranger'], unlockedCharacters: ['ranger'],
    items: { hunters_bow: 1, leather_vest: 1 },
    resources: { normal_logs: 15, raw_shrimp: 8 },
    equip: { ranger: { weapon: 'hunters_bow', chest: 'leather_vest' } },
  },
  crafter: {
    id: 'crafter', displayName: 'Crafter', icon: '🔨',
    desc: 'Smith and builder. Starts with hammer, ore, and wood.',
    team: ['warrior'], unlockedCharacters: ['warrior'],
    items: { basic_hammer: 1 },
    resources: { copper_ore: 10, normal_logs: 15 },
    equip: { warrior: { weapon: 'basic_hammer' } },
    skillBoosts: { warrior: { smithing: 3, construction: 2 } },
  },
  mage: {
    id: 'mage', displayName: 'Mage', icon: '🔮',
    desc: 'Arcane caster with staff, robes, and minor essence.',
    team: ['mage'], unlockedCharacters: ['mage'],
    items: { runed_staff: 1, cloth_robe: 1 },
    resources: { minor_essence: 5 },
    equip: { mage: { weapon: 'runed_staff', chest: 'cloth_robe' } },
  },
};

const BATTLE_FOOD_LIMIT = 3;

function isStructureBuilt(structureId) {
  const built = PLAYER_DATA.builtStructures || {};
  return Object.values(built).includes(structureId);
}

function isBuildSiteOccupied(siteId) {
  if (PLAYER_DATA.builtStructures && PLAYER_DATA.builtStructures[siteId]) return true;
  return !!(PLAYER_DATA.craftingJobs || []).find(
    j => !j.isCompleted && j.buildSiteId === siteId
  );
}

function getActiveBuildJobForSite(siteId) {
  return (PLAYER_DATA.craftingJobs || []).find(
    j => !j.isCompleted && j.buildSiteId === siteId
  );
}

function getActiveAssignmentForNode(nodeId) {
  return (PLAYER_DATA.assignments || []).find(
    a => !a.isCompleted && a.nodeId === nodeId
  );
}

function getRecipesForBuildSite(siteId) {
  return Object.values(CRAFT_RECIPE_DEFINITIONS).filter(
    r => r.buildSiteId === siteId && r.outputType === 'structure'
  );
}

const SKILL_ACTIVITY_ICONS = {
  mining: '⛏️',
  woodcutting: '🪓',
  fishing: '🎣',
  construction: '🔨',
  smithing: '⚒️',
  cooking: '🍖',
};

function getCharacterStatusDisplay(charId) {
  const craft = getActiveCraftingJobForCharacter(charId);
  if (craft) {
    const recipe = CRAFT_RECIPE_DEFINITIONS[craft.recipeId];
    const rem = typeof CRAFTING !== 'undefined'
      ? CRAFTING.formatDuration(CRAFTING.getRemainingMs(craft)) : '';
    if (recipe?.outputType === 'structure') {
      return {
        status: 'constructing',
        label: 'Constructing',
        detail: `${recipe.displayName} · ${rem}`,
        remainingMs: CRAFTING?.getRemainingMs(craft),
      };
    }
    return {
      status: 'crafting',
      label: 'Crafting',
      detail: `${recipe?.displayName || craft.recipeId} · ${rem}`,
      remainingMs: CRAFTING?.getRemainingMs(craft),
    };
  }

  const asgn = getActiveAssignmentForCharacter(charId);
  if (asgn) {
    const skillLabels = {
      mining: 'Mining', woodcutting: 'Woodcutting', fishing: 'Fishing',
    };
    const rem = typeof ASSIGNMENT !== 'undefined'
      ? ASSIGNMENT.formatDuration(ASSIGNMENT.getRemainingMs(asgn)) : '';
    const node = TERRITORY_NODE_DEFINITIONS[asgn.nodeId];
    return {
      status: asgn.skillType,
      label: skillLabels[asgn.skillType] || 'Gathering',
      detail: `${node?.displayName || asgn.nodeId} · ${rem}`,
      remainingMs: ASSIGNMENT?.getRemainingMs(asgn),
    };
  }

  if (typeof window !== 'undefined' && window._inBattle
      && (PLAYER_DATA.team || []).includes(charId)) {
    return { status: 'in_battle', label: 'In Battle', detail: 'Active combat' };
  }

  if ((PLAYER_DATA.team || []).includes(charId)) {
    return { status: 'active', label: 'On Team', detail: 'Battle party (available when idle)' };
  }

  if (Unlock.isCharacterUnlocked(charId)) {
    return { status: 'idle', label: 'Idle', detail: 'Available' };
  }
  return { status: 'locked', label: 'Locked', detail: '' };
}

function getBuiltStructureAtSite(siteId) {
  const id = PLAYER_DATA.builtStructures?.[siteId];
  return id ? STRUCTURE_DEFINITIONS[id] : null;
}

function isRecipeUnlocked(recipeId) {
  const recipe = CRAFT_RECIPE_DEFINITIONS[recipeId];
  if (!recipe) return false;
  if (!recipe.requiredStructureId) return true;
  return isStructureBuilt(recipe.requiredStructureId);
}

function isTerritoryNodeUnlocked(nodeId) {
  const def = TERRITORY_NODE_DEFINITIONS[nodeId];
  if (!def) return false;
  if (!isTerritoryUnlocked(def.territoryId)) return false;
  if (getTerritoryUpgradeLevel(def.territoryId) < def.unlockAtTerritoryLevel) return false;
  if (def.requiredStructureId && !isStructureBuilt(def.requiredStructureId)) return false;
  return true;
}

function applyStructureEffects(structureId) {
  const def = STRUCTURE_DEFINITIONS[structureId];
  if (!def?.effects) return;
  const fx = def.effects;
  if (fx.unlockRecipes) {
    if (!PLAYER_DATA.knownRecipes) PLAYER_DATA.knownRecipes = [];
    fx.unlockRecipes.forEach(r => {
      if (!PLAYER_DATA.knownRecipes.includes(r)) PLAYER_DATA.knownRecipes.push(r);
    });
  }
  if (fx.unlockOptionalBattles) {
    if (!PLAYER_DATA.optionalBattlesUnlocked) PLAYER_DATA.optionalBattlesUnlocked = [];
    fx.unlockOptionalBattles.forEach(b => {
      if (!PLAYER_DATA.optionalBattlesUnlocked.includes(b)) {
        PLAYER_DATA.optionalBattlesUnlocked.push(b);
      }
      if (!PLAYER_DATA.unlockedBattles.includes(b)) {
        PLAYER_DATA.unlockedBattles.push(b);
      }
    });
  }
}

const STARTER_FREE_STAT_POINTS = 5;

const STARTER_ALLOC_STAT_KEYS = ['hp', 'attack', 'defense', 'magic', 'resistance', 'speed'];

const STARTER_ALLOC_STAT_LABELS = {
  hp: 'HP', attack: 'Attack', defense: 'Defense',
  magic: 'Magic', resistance: 'Resistance', speed: 'Speed',
};

function _emptyStarterStatBonuses() {
  return { hp: 0, attack: 0, defense: 0, magic: 0, resistance: 0, speed: 0 };
}

function normalizeStarterStatBonuses(raw) {
  const out = _emptyStarterStatBonuses();
  if (!raw || typeof raw !== 'object') return out;
  STARTER_ALLOC_STAT_KEYS.forEach(k => {
    const v = raw[k];
    if (typeof v === 'number' && v > 0) out[k] = Math.floor(v);
  });
  return out;
}

function getStarterCharId(starterId) {
  return STARTER_DEFINITIONS[starterId]?.team?.[0] || null;
}

function getStarterIdentity(starterId) {
  return STARTER_COMBAT_IDENTITY[starterId] || null;
}

function getStarterCardBaseStats(charId) {
  const eff = getEffectiveStats(charId);
  return {
    hp: eff.baseMaxHP,
    attack: eff.baseAttack,
    defense: eff.baseDefense,
    magic: eff.baseMagic ?? 0,
    resistance: eff.baseResistance ?? 0,
    speed: eff.baseSpeed,
  };
}

function _sumStarterEquipmentStats(equipMap, charId) {
  const totals = _emptyStarterStatBonuses();
  const slots = equipMap?.[charId] || {};
  const statKey = { hp: 'hp', attack: 'attack', defense: 'defense', speed: 'speed', resistance: 'resistance' };
  Object.values(slots).forEach(itemId => {
    const item = ITEM_DEFINITIONS[itemId];
    if (!item?.statModified) return;
    const k = statKey[item.statModified];
    if (k) totals[k] += item.statAmount || 0;
  });
  return totals;
}

function getStarterPreviewStats(starterId, allocations) {
  const pack = STARTER_DEFINITIONS[starterId];
  if (!pack) return _emptyStarterStatBonuses();
  const charId = pack.team[0];
  const base = getStarterCardBaseStats(charId);
  const gear = _sumStarterEquipmentStats(pack.equip, charId);
  const alloc = normalizeStarterStatBonuses(allocations);
  const out = {};
  STARTER_ALLOC_STAT_KEYS.forEach(k => {
    out[k] = base[k] + gear[k] + alloc[k];
  });
  return out;
}

function getStarterPackageInfo(starterId) {
  const pack = STARTER_DEFINITIONS[starterId];
  if (!pack) return null;
  const charId = pack.team[0];
  const charDef = CHARACTER_DEFINITIONS[charId];
  const identity = getStarterIdentity(starterId);
  const ability = identity?.uniqueAbilityId ? ABILITY_DEFINITIONS[identity.uniqueAbilityId] : null;
  const region = identity?.regionId ? SKILL_TREE_REGIONS[identity.regionId] : null;

  const equipment = Object.entries(pack.equip?.[charId] || {}).map(([slot, itemId]) => {
    const item = ITEM_DEFINITIONS[itemId];
    return { slot, itemId, icon: item?.icon || '📦', name: item?.displayName || itemId };
  });

  const resources = Object.entries(pack.resources || {}).map(([id, qty]) => {
    const r = RESOURCE_DEFINITIONS[id];
    return { id, qty, icon: r?.icon || '', name: r?.displayName || id };
  });

  return {
    pack,
    charId,
    charDef,
    identity,
    ability,
    region,
    baseStats: getStarterCardBaseStats(charId),
    equipment,
    resources,
  };
}

function applyStarterPack(starterId, statBonuses) {
  const def = STARTER_DEFINITIONS[starterId];
  if (!def) return false;

  const bonuses = normalizeStarterStatBonuses(statBonuses);

  PLAYER_DATA.starterType = starterId;
  PLAYER_DATA.team = [...def.team];
  PLAYER_DATA.unlockedCharacters = [...def.unlockedCharacters];

  if (def.items) {
    Object.entries(def.items).forEach(([id, qty]) => {
      PLAYER_DATA.ownedItems[id] = (PLAYER_DATA.ownedItems[id] || 0) + qty;
    });
  }
  if (def.resources) {
    Object.entries(def.resources).forEach(([id, qty]) => addResource(id, qty));
  }
  if (def.equip) {
    Object.entries(def.equip).forEach(([charId, slots]) => {
      Object.entries(slots).forEach(([slot, itemId]) => {
        if (PLAYER_DATA.equippedItems[charId]) {
          PLAYER_DATA.equippedItems[charId][slot] = itemId;
        }
      });
    });
  }
  if (def.skillBoosts) {
    Object.entries(def.skillBoosts).forEach(([charId, skills]) => {
      Object.entries(skills).forEach(([sk, lvl]) => {
        const ch = PLAYER_DATA.characters[charId];
        if (ch?.skills[sk] && ch.skills[sk].level < lvl) {
          ch.skills[sk].level = lvl;
          ch.skills[sk].xp = xpToLevel(lvl);
        }
      });
    });
  }

  // Base recipes always known
  PLAYER_DATA.knownRecipes = Object.keys(CRAFT_RECIPE_DEFINITIONS).filter(
    id => !CRAFT_RECIPE_DEFINITIONS[id].requiredStructureId
  );

  def.team.forEach(charId => {
    if (typeof initCharacterBuild === 'function') initCharacterBuild(charId, starterId);
    if (PLAYER_DATA.characters[charId]) {
      PLAYER_DATA.characters[charId].starterStatBonuses = { ...bonuses };
    }
  });

  // Fresh starting campaign — one territory, Slime Group playable
  PLAYER_DATA.completedBattles = [];
  PLAYER_DATA.unlockedBattles = BATTLE_DEFINITIONS
    .filter(b => b.unlockedByDefault)
    .map(b => b.id);
  PLAYER_DATA.unlockedAreas = Object.values(AREA_DEFINITIONS)
    .filter(a => a.unlockedByDefault)
    .map(a => a.id);
  PLAYER_DATA.unlockedTerritories = getDefaultUnlockedTerritories();
  PLAYER_DATA.discoveredTerritories = getDefaultDiscoveredTerritories();
  PLAYER_DATA.gold = 0;

  SaveManager.write();
  return true;
}

/** Starting Field campaign battles in order (tutorial chain). */
function getStartingFieldBattleIds() {
  return TERRITORY_DEFINITIONS.territory_starting_field?.battleIds || ['battle_1', 'battle_2', 'battle_3'];
}

function migratePhase5SaveState() {
  if (!PLAYER_DATA.knownRecipes) {
    PLAYER_DATA.knownRecipes = Object.keys(CRAFT_RECIPE_DEFINITIONS).filter(
      id => !CRAFT_RECIPE_DEFINITIONS[id].requiredStructureId
    );
  }
  if (!PLAYER_DATA.craftingJobs) PLAYER_DATA.craftingJobs = [];
  if (!PLAYER_DATA.builtStructures) PLAYER_DATA.builtStructures = {};
  if (!PLAYER_DATA.optionalBattlesUnlocked) PLAYER_DATA.optionalBattlesUnlocked = [];
  if (!PLAYER_DATA.starterType && PLAYER_DATA.team?.length) {
    PLAYER_DATA.starterType = 'legacy';
  }
  // Re-apply structure effects for built sites
  Object.values(PLAYER_DATA.builtStructures).forEach(sid => applyStructureEffects(sid));
  // Ensure node states exist for newly added nodes (e.g. dock fishing)
  if (!PLAYER_DATA.resourceNodeStates) PLAYER_DATA.resourceNodeStates = {};
  Object.values(TERRITORY_NODE_DEFINITIONS).forEach(def => {
    if (!PLAYER_DATA.resourceNodeStates[def.id]) {
      PLAYER_DATA.resourceNodeStates[def.id] = { amount: def.maxAvailable, lastUpdatedMs: Date.now() };
    }
  });
}

function _makeDefaultResourceNodeStates() {
  const now = Date.now();
  const states = {};
  Object.values(TERRITORY_NODE_DEFINITIONS).forEach(def => {
    states[def.id] = { amount: def.maxAvailable, lastUpdatedMs: now };
  });
  return states;
}

function getDefaultUnlockedTerritories() {
  return Object.values(TERRITORY_DEFINITIONS)
    .filter(t => t.unlockedByDefault)
    .map(t => t.id);
}

function getDefaultDiscoveredTerritories() {
  return Object.values(TERRITORY_DEFINITIONS)
    .filter(t => t.unlockedByDefault || t.discoverFromStart || t.previewWhenLocked)
    .map(t => t.id);
}

function getTerritoryUpgradeLevel(territoryId) {
  return (PLAYER_DATA.territoryUpgrades && PLAYER_DATA.territoryUpgrades[territoryId]) || 1;
}

function isTerritoryUnlocked(territoryId) {
  return (PLAYER_DATA.unlockedTerritories || []).includes(territoryId);
}

function getTerritoryRegenMultiplier(territoryId) {
  const lvl = getTerritoryUpgradeLevel(territoryId);
  const upgrades = TERRITORY_UPGRADE_DEFINITIONS[territoryId] || [];
  let mult = 1;
  upgrades.forEach(u => {
    if (lvl >= u.level && u.regenBonusPct) mult += u.regenBonusPct;
  });
  return mult;
}

function isTerritoryNodeUnlocked(nodeId) {
  const def = TERRITORY_NODE_DEFINITIONS[nodeId];
  if (!def) return false;
  if (!isTerritoryUnlocked(def.territoryId)) return false;
  return getTerritoryUpgradeLevel(def.territoryId) >= def.unlockAtTerritoryLevel;
}

function getResourceNodeState(nodeId) {
  if (!PLAYER_DATA.resourceNodeStates) PLAYER_DATA.resourceNodeStates = _makeDefaultResourceNodeStates();
  if (!PLAYER_DATA.resourceNodeStates[nodeId]) {
    const def = TERRITORY_NODE_DEFINITIONS[nodeId];
    PLAYER_DATA.resourceNodeStates[nodeId] = {
      amount: def ? def.maxAvailable : 0,
      lastUpdatedMs: Date.now(),
    };
  }
  return PLAYER_DATA.resourceNodeStates[nodeId];
}

function getNodeRegenRate(nodeId) {
  const def = TERRITORY_NODE_DEFINITIONS[nodeId];
  if (!def) return 0;
  let rate = def.regenRatePerMinute;
  Object.values(PLAYER_DATA.builtStructures || {}).forEach(sid => {
    const sdef = STRUCTURE_DEFINITIONS[sid];
    if (sdef?.effects?.nodeRegenBonus?.[nodeId]) {
      rate += sdef.effects.nodeRegenBonus[nodeId];
    }
  });
  return rate;
}

function regenerateResourceNode(nodeId, nowMs = Date.now()) {
  const def = TERRITORY_NODE_DEFINITIONS[nodeId];
  if (!def || !isTerritoryNodeUnlocked(nodeId)) return 0;
  const state = getResourceNodeState(nodeId);
  const elapsedMin = Math.max(0, (nowMs - state.lastUpdatedMs) / 60000);
  if (elapsedMin <= 0) return 0;
  const regenMult = getTerritoryRegenMultiplier(def.territoryId);
  const added = elapsedMin * getNodeRegenRate(nodeId) * regenMult;
  const before = state.amount;
  state.amount = Math.min(def.maxAvailable, state.amount + added);
  state.lastUpdatedMs = nowMs;
  return state.amount - before;
}

function regenerateAllResourceNodes(nowMs = Date.now()) {
  let totalAdded = 0;
  Object.keys(TERRITORY_NODE_DEFINITIONS).forEach(nodeId => {
    if (isTerritoryNodeUnlocked(nodeId)) totalAdded += regenerateResourceNode(nodeId, nowMs);
  });
  return totalAdded;
}

function getNodesForTerritory(territoryId) {
  return Object.values(TERRITORY_NODE_DEFINITIONS).filter(n => n.territoryId === territoryId);
}

function getActiveAssignmentForCharacter(charId) {
  return (PLAYER_DATA.assignments || []).find(a => a.charId === charId && !a.isCompleted);
}

function getActiveCraftingJobForCharacter(charId) {
  return (PLAYER_DATA.craftingJobs || []).find(j => j.charId === charId && !j.isCompleted);
}

function getCharacterStatus(charId) {
  if (getActiveCraftingJobForCharacter(charId)) return 'crafting';
  if (getActiveAssignmentForCharacter(charId)) return 'assigned';
  if ((PLAYER_DATA.team || []).includes(charId)) return 'active';
  if (Unlock.isCharacterUnlocked(charId)) return 'idle';
  return 'locked';
}

function isCharacterAssignable(charId) {
  return getCharacterStatus(charId) === 'idle';
}

function isCharacterBattleReady(charId) {
  if (getActiveAssignmentForCharacter(charId)) return false;
  if (getActiveCraftingJobForCharacter(charId)) return false;
  return (PLAYER_DATA.team || []).includes(charId);
}

function calcAssignmentYield(nodeId, charId) {
  const def = TERRITORY_NODE_DEFINITIONS[nodeId];
  if (!def) return 0;
  const skillLevel = PLAYER_DATA.characters[charId]?.skills[def.skillType]?.level || 1;
  return def.baseYield + Math.floor(skillLevel / 10);
}

function migrateTerritorySaveState() {
  if (!PLAYER_DATA.unlockedTerritories) {
    PLAYER_DATA.unlockedTerritories = getDefaultUnlockedTerritories();
  }
  if (!PLAYER_DATA.discoveredTerritories) {
    PLAYER_DATA.discoveredTerritories = getDefaultDiscoveredTerritories();
  }
  if (typeof checkTerritoryDiscoveries === 'function') checkTerritoryDiscoveries();
  if (!PLAYER_DATA.territoryUpgrades) PLAYER_DATA.territoryUpgrades = {};
  if (!PLAYER_DATA.resourceNodeStates) PLAYER_DATA.resourceNodeStates = _makeDefaultResourceNodeStates();
  if (!PLAYER_DATA.assignments) PLAYER_DATA.assignments = [];
  if (!PLAYER_DATA.lastSessionMs) PLAYER_DATA.lastSessionMs = Date.now();
  // Unlock territories based on completed battles (migration for existing saves)
  Object.values(TERRITORY_DEFINITIONS).forEach(t => {
    if (PLAYER_DATA.unlockedTerritories.includes(t.id)) return;
    if (t.unlockedByDefault) {
      PLAYER_DATA.unlockedTerritories.push(t.id);
      return;
    }
    if (t.unlockBattleId && PLAYER_DATA.completedBattles.includes(t.unlockBattleId)) {
      PLAYER_DATA.unlockedTerritories.push(t.id);
    }
  });
}

// ── Default active team ────────────────────────────────────────
const DEFAULT_PLAYER_TEAM = ['warrior', 'mage', 'ranger'];

// ── Fresh PLAYER_DATA factory (used by save system) ───────────
function _makeDefaultPlayerData() {
  const characters = {};
  Object.values(CHARACTER_DEFINITIONS).forEach(def => {
    const skills = {};
    Object.keys(SKILL_DEFINITIONS).forEach(skillId => {
      const level = def.startingLevels[skillId] || 1;
      skills[skillId] = { level, xp: xpToLevel(level) };
    });
    characters[def.id] = {
      skills,
      skillPoints:          0,
      skillTreeNodes:       [],
      lastSkillPointLevel:  1,
      // Phase 6 — character level & combat build
      charLevel:            1,
      charXp:               0,
      knownAbilities:       [],
      uniqueStartingAbilityId: null,
      starterRegionId:      null,
      starterStatBonuses:   null,
    };
  });

  // Battles unlocked by default
  const unlockedBattles   = BATTLE_DEFINITIONS.filter(b => b.unlockedByDefault).map(b => b.id);
  // Areas unlocked by default
  const unlockedAreas     = Object.values(AREA_DEFINITIONS).filter(a => a.unlockedByDefault).map(a => a.id);
  // Characters unlocked via starter choice (Phase 5)
  const unlockedCharacters = [];

  // Equipment slots per character
  const equippedItems = {};
  Object.keys(CHARACTER_DEFINITIONS).forEach(id => {
    equippedItems[id] = { weapon: null, helmet: null, chest: null, gloves: null, boots: null, ring: null, amulet: null };
  });

  return {
    gold: 0,
    completedBattles:    [],
    unlockedBattles,
    unlockedAreas,
    unlockedCharacters,
    team: [],
    starterType: null,
    craftingJobs: [],
    builtStructures: {},
    knownRecipes: [],
    optionalBattlesUnlocked: [],
    characters,
    ownedItems:    {},   // { itemId: quantity }
    equippedItems,       // { charId: itemId | null }
    resources:     {},   // { resourceId: quantity }
    food:          {},   // { foodId: quantity }
    buildings:          [],   // string[] of built buildingIds
    activePrayer:       null, // prayerId | null
    completedMilestones:[],   // string[] of claimed milestone ids
    completedQuests:     [],   // string[] of claimed quest ids
    buildingUpgrades:  {},   // { buildingId: 1 } — tier-2 upgrade applied
    // Phase 4 — territories & assignments
    unlockedTerritories: getDefaultUnlockedTerritories(),
    discoveredTerritories: getDefaultDiscoveredTerritories(),
    territoryUpgrades:   {},   // { territoryId: level (1-based) }
    resourceNodeStates:  _makeDefaultResourceNodeStates(),
    assignments:         [],   // active/completed assignment records
    lastSessionMs:       Date.now(),
  };
}

// ── Mutable player data (single source of truth) ──────────────
// Initialised to defaults; overwritten by SaveManager.load().
const PLAYER_DATA = _makeDefaultPlayerData();

// ── Equipment skill bonuses (virtual skill levels) ─────────────
function getItemSkillBonuses(charId) {
  const bonuses = {};
  const slots   = PLAYER_DATA.equippedItems && PLAYER_DATA.equippedItems[charId];
  if (!slots || typeof slots !== 'object') return bonuses;
  ['weapon','helmet','chest','gloves','boots','ring','amulet'].forEach(s => {
    const item = slots[s] && ITEM_DEFINITIONS[slots[s]];
    if (item?.skillBonus) {
      Object.entries(item.skillBonus).forEach(([sk, amt]) => {
        bonuses[sk] = (bonuses[sk] || 0) + amt;
      });
    }
  });
  return bonuses;
}

function getEffectiveSkillLevel(charId, skillId) {
  const base  = PLAYER_DATA.characters[charId]?.skills[skillId]?.level || 1;
  const bonus = getItemSkillBonuses(charId)[skillId] || 0;
  return base + bonus;
}

function canEquipItem(charId, itemId) {
  const item = ITEM_DEFINITIONS[itemId];
  if (!item) return { ok: false, reason: 'Unknown item.' };
  if (!item.levelReq) return { ok: true };
  const skills = PLAYER_DATA.characters[charId]?.skills || {};
  for (const [sk, min] of Object.entries(item.levelReq)) {
    const have = skills[sk]?.level || 1;
    if (have < min) {
      const skDef = SKILL_DEFINITIONS[sk];
      return { ok: false, reason: `Need ${skDef?.displayName || sk} Lv.${min} (have ${have}).` };
    }
  }
  return { ok: true };
}

function getBuildingEffects() {
  const fx = {
    hpBonus: 0, atkBonus: 0, evasionBonus: 0, xpBonus: 0,
    fishingSpeedBonus: 0, miningSpeedBonus: 0, woodcuttingSpeedBonus: 0,
    prayerXpBonus: 0,
  };
  const upgrades = PLAYER_DATA.buildingUpgrades || {};
  (PLAYER_DATA.buildings || []).forEach(bid => {
    const b = BUILDING_DEFINITIONS.find(x => x.id === bid);
    if (b?.effect) Object.keys(fx).forEach(k => { fx[k] += b.effect[k] || 0; });
    if (upgrades[bid]) {
      const up = BUILDING_UPGRADE_DEFINITIONS[bid];
      if (up?.effect) Object.keys(fx).forEach(k => { fx[k] += up.effect[k] || 0; });
    }
  });
  return fx;
}

function isBuildingUpgraded(buildingId) {
  return !!(PLAYER_DATA.buildingUpgrades && PLAYER_DATA.buildingUpgrades[buildingId]);
}

function upgradeBuilding(buildingId) {
  if (!PLAYER_DATA.buildingUpgrades) PLAYER_DATA.buildingUpgrades = {};
  PLAYER_DATA.buildingUpgrades[buildingId] = 1;
}

// ── Battle skill (may unlock via skill level gates) ────────────
function getBattleSkillId(charId) {
  const def = CHARACTER_DEFINITIONS[charId];
  const sk  = PLAYER_DATA.characters[charId]?.skills;
  if (!sk) return def.skillId;
  if (charId === 'warrior' && sk.attack.level >= 20) return 'whirlwind';
  if (charId === 'ranger' && sk.range.level >= 25) return 'piercing_shot';
  return def.skillId;
}

// ── Derive effective combat stats from skill levels ────────────
function getEffectiveStats(charId) {
  const def      = CHARACTER_DEFINITIONS[charId];
  const start    = def.startingLevels;
  const sk = id => getEffectiveSkillLevel(charId, id);

  const hpBonus    = (sk('hitpoints') - start.hitpoints) * 12;
  const meleeBonus = (sk('attack')    - start.attack)    * 1
                   + (sk('strength')  - start.strength)  * 2;
  const magicBonus = (sk('magic')     - start.magic)     * 2;
  const rangeBonus = (sk('range')     - start.range)     * 2;
  const defBonus   = (sk('defence')   - start.defence)   * 1;

  // Item bonuses — sum across all 7 equipped slots
  const slots    = PLAYER_DATA.equippedItems && PLAYER_DATA.equippedItems[charId];
  const equippedSlotItems = [];
  if (slots && typeof slots === 'object') {
    ['weapon','helmet','chest','gloves','boots','ring','amulet'].forEach(s => {
      if (slots[s]) {
        const it = ITEM_DEFINITIONS[slots[s]];
        if (it) equippedSlotItems.push(it);
      }
    });
  } else if (typeof slots === 'string' && ITEM_DEFINITIONS[slots]) {
    equippedSlotItems.push(ITEM_DEFINITIONS[slots]);
  }
  const itemHP  = equippedSlotItems.filter(i => i.statModified === 'hp')         .reduce((s,i) => s + i.statAmount, 0);
  const itemATK = equippedSlotItems.filter(i => i.statModified === 'attack')     .reduce((s,i) => s + i.statAmount, 0);
  const itemDEF = equippedSlotItems.filter(i => i.statModified === 'defense')    .reduce((s,i) => s + i.statAmount, 0);
  const itemSPD = equippedSlotItems.filter(i => i.statModified === 'speed')      .reduce((s,i) => s + i.statAmount, 0);
  const itemRES = equippedSlotItems.filter(i => i.statModified === 'resistance') .reduce((s,i) => s + i.statAmount, 0);

  const bFx = getBuildingEffects();
  const buildingHP  = bFx.hpBonus;
  const buildingATK = bFx.atkBonus;
  const buildingEVA = bFx.evasionBonus;

  const accuracy   = Math.min(98, 78 + Math.floor(sk('attack') * 0.4));
  const evasion    = Math.min(30, Math.floor(sk('defence') * 0.5));
  const critChance = Math.min(25, Math.floor(
    (sk('strength') + sk('range') + sk('magic')) / 3 * 0.25
  ));

  const resistanceBase = (sk('prayer') - start.prayer) * 1.2;
  let finalRES = (def.baseResistance || 0) + Math.floor(resistanceBase) + itemRES;

  // Primary attack vs magic split
  const trait = def.trait;
  let finalHP  = def.baseMaxHP   + hpBonus  + itemHP  + buildingHP;
  let finalATK = def.baseAttack;
  let finalMAG = def.baseMagic ?? 0;

  if (def.damageType === 'magic') {
    finalMAG = (def.baseMagic ?? def.baseAttack) + magicBonus + itemATK + buildingATK;
    finalATK = Math.max(4, Math.floor((def.baseAttack || 0) * 0.25) + Math.floor(meleeBonus * 0.2));
  } else if (charId === 'ranger') {
    finalATK = def.baseAttack + rangeBonus + Math.floor((sk('attack') - start.attack) * 0.5) + itemATK + buildingATK;
  } else {
    finalATK = def.baseAttack + meleeBonus + itemATK + buildingATK;
  }

  let finalDEF = def.baseDefense + defBonus + itemDEF;
  const skillSpeedBonus = Math.floor((sk('attack') + sk('defence') + sk('range')) / 15);
  let finalSPD = def.baseSpeed + itemSPD + skillSpeedBonus;
  let finalCrit = critChance;

  // Character level grants small stat bumps
  const charLvl = getCharLevel(charId);
  finalHP  += charLvl * 2;
  finalDEF += Math.floor(charLvl / 3);
  if (def.damageType === 'magic') finalMAG += Math.floor(charLvl / 2);
  else finalATK += Math.floor(charLvl / 2);

  if (trait) {
    if (trait.hpPct)    finalHP   = Math.round(finalHP  * (1 + trait.hpPct));
    if (trait.atkPct) {
      if (def.damageType === 'magic') finalMAG = Math.round(finalMAG * (1 + trait.atkPct));
      else finalATK = Math.round(finalATK * (1 + trait.atkPct));
    }
    if (trait.defFlat)  finalDEF += trait.defFlat;
    if (trait.spdFlat)  finalSPD += trait.spdFlat;
    if (trait.critFlat) finalCrit = Math.min(35, finalCrit + trait.critFlat);
  }
  const healMultiplier = 1 + (trait?.healPct || 0);

  const abilityMod = equippedSlotItems.reduce((acc, it) => {
    if (it.abilityMod?.cooldownReduction) {
      acc.cooldownReduction = (acc.cooldownReduction || 0) + it.abilityMod.cooldownReduction;
    }
    return acc;
  }, {});

  // Unified skill tree flat bonuses (Phase 6)
  const uTree = typeof getUnifiedSkillTreeBonuses === 'function'
    ? getUnifiedSkillTreeBonuses(charId) : { attack: 0, defense: 0, magic: 0, speed: 0, maxHp: 0, maxMana: 0, resistance: 0, critChance: 0 };
  finalHP  += uTree.maxHp || 0;
  finalDEF += uTree.defense || 0;
  finalSPD += uTree.speed || 0;
  finalRES += uTree.resistance || 0;
  finalCrit = Math.min(35, finalCrit + (uTree.critChance || 0));
  if (def.damageType === 'magic') finalMAG += uTree.magic || 0;
  else finalATK += (uTree.attack || 0) + Math.floor((uTree.magic || 0) * 0.25);
  if (uTree.attack && def.damageType === 'magic') finalMAG += Math.floor(uTree.attack * 0.5);

  const maxMana = 20 + Math.floor(finalMAG * 0.6) + (uTree.maxMana || 0);
  const abilities = typeof getKnownAbilities === 'function' ? getKnownAbilities(charId) : [];
  const charData  = PLAYER_DATA.characters[charId];
  const passiveEffects = typeof getPassiveEffects === 'function' ? getPassiveEffects(charId) : [];

  // Legacy skill tree % bonuses (milestones / old nodes if any)
  const tree = getSkillTreeBonuses(charId);
  if (tree.hpPct)  finalHP  = Math.round(finalHP  * (1 + tree.hpPct));
  if (tree.atkPct) {
    if (def.damageType === 'magic') finalMAG = Math.round(finalMAG * (1 + tree.atkPct));
    else finalATK = Math.round(finalATK * (1 + tree.atkPct));
  }
  if (tree.defPct) finalDEF = Math.round(finalDEF * (1 + tree.defPct));
  finalSPD  += tree.spdFlat;
  finalCrit  = Math.min(35, finalCrit + tree.critFlat);
  finalRES  += tree.resistFlat || 0;

  const starterBonuses = normalizeStarterStatBonuses(charData?.starterStatBonuses);
  finalHP  += starterBonuses.hp;
  finalATK += starterBonuses.attack;
  finalDEF += starterBonuses.defense;
  finalMAG += starterBonuses.magic;
  finalRES += starterBonuses.resistance;
  finalSPD += starterBonuses.speed;

  const finalAccuracy  = Math.min(98, accuracy          + tree.accuracyFlat);
  const finalEvasion   = Math.min(40, evasion + buildingEVA + tree.evasionFlat);
  const finalCritMult  = 1.5 + tree.critMultBonus;
  const treeXpBonus    = tree.xpBonus;   // surfaced for awardBattleXp

  return {
    ...def,
    skillId:        getBattleSkillId(charId),
    abilities,
    uniqueStartingAbilityId: charData?.uniqueStartingAbilityId || null,
    maxMana,
    passiveEffects,
    baseMaxHP:      finalHP,
    baseAttack:     finalATK,
    baseMagic:      finalMAG,
    baseDefense:    finalDEF,
    baseSpeed:      finalSPD,
    baseResistance: finalRES,
    equippedSlots:  slots && typeof slots === 'object' ? slots : {},
    equippedItems:  equippedSlotItems,
    accuracy:       finalAccuracy,
    evasion:        finalEvasion,
    critChance:     finalCrit,
    critMultiplier: finalCritMult,
    treeXpBonus,
    healMultiplier,
    abilityMod,
    passives: equippedSlotItems.filter(i => i.passive).map(i => i.passive),
  };
}

// ── Combat level (summary number shown in account screen) ──────
function getCombatLevel(charId) {
  if (typeof getCharLevel === 'function' && PLAYER_DATA.characters[charId]?.charLevel) {
    return getCharLevel(charId);
  }
  const sk = PLAYER_DATA.characters[charId].skills;
  return Math.floor(
    (sk.attack.level + sk.strength.level + sk.defence.level +
     sk.hitpoints.level + sk.magic.level + sk.range.level + sk.prayer.level) / 7
  );
}

// ── Total level (sum of all skill levels) ──────────────────────
function getTotalLevel(charId) {
  return Object.values(PLAYER_DATA.characters[charId].skills)
               .reduce((sum, s) => sum + s.level, 0);
}

// getCharLevel, getSkillTreeBonuses, awardSkillPointsIfDue — defined in combat-build.js (Phase 6)

// ── Milestone helpers ─────────────────────────────────────────
// Returns milestones whose condition is met but not yet claimed.
function getClaimableMilestones() {
  const claimed = new Set(PLAYER_DATA.completedMilestones || []);
  return MILESTONE_DEFINITIONS.filter(m => !claimed.has(m.id) && m.condition(PLAYER_DATA));
}

// Returns the count of claimable milestones (for badge display).
function claimableMilestoneCount() {
  return getClaimableMilestones().length;
}

// Claim a milestone by id. Awards gold + skill points to all unlocked heroes.
// Returns the reward object, or null if already claimed / condition not met.
function claimMilestone(id) {
  const m = MILESTONE_DEFINITIONS.find(def => def.id === id);
  if (!m) return null;
  if ((PLAYER_DATA.completedMilestones || []).includes(id)) return null;
  if (!m.condition(PLAYER_DATA)) return null;

  if (!PLAYER_DATA.completedMilestones) PLAYER_DATA.completedMilestones = [];
  PLAYER_DATA.completedMilestones.push(id);

  // Award gold
  if (m.reward.gold) PLAYER_DATA.gold += m.reward.gold;

  // Award skill points to all unlocked heroes
  if (m.reward.skillPoints) {
    Object.values(CHARACTER_DEFINITIONS)
      .filter(c => (PLAYER_DATA.unlockedCharacters || []).includes(c.id))
      .forEach(c => {
        const charData = PLAYER_DATA.characters[c.id];
        if (charData) charData.skillPoints = (charData.skillPoints || 0) + m.reward.skillPoints;
      });
  }

  return m.reward;
}

// ── Quest helpers ─────────────────────────────────────────────
function getClaimableQuests() {
  const claimed = new Set(PLAYER_DATA.completedQuests || []);
  return QUEST_DEFINITIONS.filter(q => !claimed.has(q.id) && q.condition(PLAYER_DATA));
}

function claimableQuestCount() {
  return getClaimableQuests().length;
}

function claimQuest(id) {
  const q = QUEST_DEFINITIONS.find(def => def.id === id);
  if (!q) return null;
  if ((PLAYER_DATA.completedQuests || []).includes(id)) return null;
  if (!q.condition(PLAYER_DATA)) return null;

  if (!PLAYER_DATA.completedQuests) PLAYER_DATA.completedQuests = [];
  PLAYER_DATA.completedQuests.push(id);

  if (q.reward.gold) PLAYER_DATA.gold += q.reward.gold;
  if (q.reward.skillPoints) {
    Object.values(CHARACTER_DEFINITIONS)
      .filter(c => (PLAYER_DATA.unlockedCharacters || []).includes(c.id))
      .forEach(c => {
        const charData = PLAYER_DATA.characters[c.id];
        if (charData) charData.skillPoints = (charData.skillPoints || 0) + q.reward.skillPoints;
      });
  }
  return q.reward;
}

// ── Award gathering XP to every character on the team ──────────
// skillId: 'fishing' | 'mining' | 'woodcutting' | 'cooking'
// xpAmount: total XP to award
// Returns { charId: { oldLevel, newLevel } } for all who levelled up.
function awardGatheringXp(skillId, xpAmount) {
  const levelUps = {};
  PLAYER_DATA.team.forEach(charId => {
    const def  = CHARACTER_DEFINITIONS[charId];
    const mult = 1 + (def.trait?.gatherXpPct?.[skillId] || 0);
    const gain = Math.round(xpAmount * mult);
    const sk       = PLAYER_DATA.characters[charId].skills[skillId];
    const oldLevel = sk.level;
    sk.xp += gain;
    while (sk.level < 99 && sk.xp >= xpToLevel(sk.level + 1)) sk.level++;
    if (sk.level > oldLevel) levelUps[charId] = { oldLevel, newLevel: sk.level };
    awardSkillPointsIfDue(charId);
  });
  return levelUps;
}

// ── Add XP to a single skill (shared by action XP and rewards) ───
function addSkillXp(charId, skillId, xpGain) {
  const charData = PLAYER_DATA.characters[charId];
  if (!charData?.skills[skillId] || xpGain <= 0) return null;
  const oldLevel = charData.skills[skillId].level;
  charData.skills[skillId].xp += xpGain;
  let newLevel = oldLevel;
  while (newLevel < 99 && charData.skills[skillId].xp >= xpToLevel(newLevel + 1)) newLevel++;
  charData.skills[skillId].level = newLevel;
  return { xpGained: xpGain, oldLevel, newLevel };
}

function applyActionXp(actionXpMap) {
  const gains = {};
  Object.entries(actionXpMap || {}).forEach(([charId, skills]) => {
    gains[charId] = {};
    Object.entries(skills).forEach(([skillId, xp]) => {
      const result = addSkillXp(charId, skillId, xp);
      if (result) gains[charId][skillId] = result;
    });
    awardSkillPointsIfDue(charId);
  });
  return gains;
}

function mergeXpGains(base, extra) {
  const merged = JSON.parse(JSON.stringify(base || {}));
  Object.entries(extra || {}).forEach(([charId, skills]) => {
    if (!merged[charId]) merged[charId] = {};
    Object.entries(skills).forEach(([skillId, g]) => {
      if (merged[charId][skillId]) {
        merged[charId][skillId].xpGained += g.xpGained;
        merged[charId][skillId].newLevel  = Math.max(merged[charId][skillId].newLevel, g.newLevel);
      } else {
        merged[charId][skillId] = { ...g };
      }
    });
  });
  return merged;
}

function getGatherSpeedBonus(skillId) {
  const fx = getBuildingEffects();
  if (skillId === 'fishing') return Math.min(0.6, fx.fishingSpeedBonus);
  if (skillId === 'mining') return Math.min(0.5, fx.miningSpeedBonus || 0);
  if (skillId === 'woodcutting') return Math.min(0.5, fx.woodcuttingSpeedBonus || 0);
  return 0;
}

function getGatherTickMs(node) {
  if (!node) return 4000;
  let skillLevel = 1;
  if (PLAYER_DATA.team.length) {
    const sum = PLAYER_DATA.team.reduce((acc, id) =>
      acc + (PLAYER_DATA.characters[id].skills[node.skill]?.level || 1), 0);
    skillLevel = Math.floor(sum / PLAYER_DATA.team.length);
  }
  const skillSpeed    = 1 - Math.min(0.4, (skillLevel - 1) * 0.01);
  const buildingBonus = getGatherSpeedBonus(node.skill);
  return Math.max(800, Math.floor(node.tickMs * skillSpeed * (1 - buildingBonus)));
}

function awardShrinePrayerXp() {
  if (!isBuildingBuilt('shrine')) return;
  const bonus = 1 + (getBuildingEffects().prayerXpBonus || 0);
  PLAYER_DATA.team.forEach(charId => {
    const mult = 1 + (CHARACTER_DEFINITIONS[charId]?.trait?.prayerXpPct || 0);
    addSkillXp(charId, 'prayer', Math.round(bonus * mult));
  });
}

// ── Add resource to inventory ────────────────────────────────────
function addResource(resourceId, qty = 1) {
  if (!PLAYER_DATA.resources) PLAYER_DATA.resources = {};
  PLAYER_DATA.resources[resourceId] = (PLAYER_DATA.resources[resourceId] || 0) + qty;
}

function removeResource(resourceId, qty = 1) {
  if (!PLAYER_DATA.resources) return false;
  const have = PLAYER_DATA.resources[resourceId] || 0;
  if (have < qty) return false;
  PLAYER_DATA.resources[resourceId] = have - qty;
  return true;
}

function hasResources(costMap) {
  if (!costMap) return true;
  return Object.entries(costMap).every(([rid, qty]) => (PLAYER_DATA.resources[rid] || 0) >= qty);
}

function consumeResources(costMap) {
  if (!hasResources(costMap)) return false;
  Object.entries(costMap || {}).forEach(([rid, qty]) => removeResource(rid, qty));
  return true;
}

// ── Add food to inventory ────────────────────────────────────────
function addFood(foodId, qty = 1) {
  if (!PLAYER_DATA.food) PLAYER_DATA.food = {};
  PLAYER_DATA.food[foodId] = (PLAYER_DATA.food[foodId] || 0) + qty;
}

function removeFood(foodId, qty = 1) {
  if (!PLAYER_DATA.food || !PLAYER_DATA.food[foodId]) return false;
  PLAYER_DATA.food[foodId] = Math.max(0, PLAYER_DATA.food[foodId] - qty);
  return true;
}

// ── Building helpers ─────────────────────────────────────────────
function isBuildingBuilt(buildingId) {
  return (PLAYER_DATA.buildings || []).includes(buildingId);
}

function buildBuilding(buildingId) {
  if (!PLAYER_DATA.buildings) PLAYER_DATA.buildings = [];
  if (!PLAYER_DATA.buildings.includes(buildingId)) {
    PLAYER_DATA.buildings.push(buildingId);
  }
}

// Returns the cumulative battle XP multiplier from all built buildings (1.0 = no bonus).
function getBuildingXpMultiplier() {
  return 1.0 + getBuildingEffects().xpBonus;
}

function getBuildingFishingSpeedBonus() {
  return Math.min(0.6, getBuildingEffects().fishingSpeedBonus);
}

// ── Prayer helpers ───────────────────────────────────────────────
function getActivePrayerDef() {
  if (!PLAYER_DATA.activePrayer) return null;
  return PRAYER_DEFINITIONS.find(p => p.id === PLAYER_DATA.activePrayer) || null;
}

function teamPrayerLevel() {
  if (!PLAYER_DATA.team.length) return 1;
  const sum = PLAYER_DATA.team.reduce((acc, charId) => {
    return acc + (PLAYER_DATA.characters[charId].skills.prayer?.level || 1);
  }, 0);
  return Math.floor(sum / PLAYER_DATA.team.length);
}
