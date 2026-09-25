'use strict';
// =============================================================
// combat-build.js — Phase 6: Character build, levels, unlocks
// =============================================================

/** XP required to advance from `fromLevel` to `fromLevel + 1` (Lv.1→2 = 100, then ×1.5). */
function xpRequiredForLevel(fromLevel) {
  if (fromLevel < 1) return 100;
  return Math.floor(100 * Math.pow(1.5, fromLevel - 1));
}

/** Cumulative character XP required to reach `level` (level 1 = 0 XP). */
function xpToCharLevel(level) {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) total += xpRequiredForLevel(l);
  return total;
}

function getCharLevel(charId) {
  const char = PLAYER_DATA.characters[charId];
  return Math.min(MAX_CHAR_LEVEL, Math.max(1, char?.charLevel || 1));
}

function getCharXp(charId) {
  return PLAYER_DATA.characters[charId]?.charXp || 0;
}

function getCharXpToNext(charId) {
  const lvl = getCharLevel(charId);
  if (lvl >= MAX_CHAR_LEVEL) return 0;
  return xpToCharLevel(lvl + 1) - xpToCharLevel(lvl);
}

function getCharacterIdentity(charId) {
  const starter = PLAYER_DATA.starterType;
  if (starter === 'legacy' || !starter) {
    return CHARACTER_DEFAULT_IDENTITY[charId] || null;
  }
  if (starter && STARTER_COMBAT_IDENTITY[starter]) {
    const id = STARTER_COMBAT_IDENTITY[starter];
    if (id.charId === charId) return id;
  }
  return CHARACTER_DEFAULT_IDENTITY[charId] || null;
}

function getStarterNodeId(charId) {
  return getCharacterIdentity(charId)?.starterNodeId || null;
}

function getUnlockedSkillNodes(charId) {
  return PLAYER_DATA.characters[charId]?.skillTreeNodes || [];
}

function getKnownAbilities(charId) {
  const char = PLAYER_DATA.characters[charId];
  if (!char) return [];
  const known = new Set(char.knownAbilities || []);
  if (char.uniqueStartingAbilityId) known.add(char.uniqueStartingAbilityId);

  (char.skillTreeNodes || []).forEach(nodeId => {
    const node = UNIFIED_SKILL_TREE_NODES[nodeId];
    (node?.abilityUnlockIds || []).forEach(aid => known.add(aid));
  });

  return [...known].filter(id => {
    const ab = ABILITY_DEFINITIONS[id];
    return ab && ab.abilityType !== 'passive';
  });
}

function canUnlockSkillNode(charId, nodeId) {
  const node = UNIFIED_SKILL_TREE_NODES[nodeId];
  const char = PLAYER_DATA.characters[charId];
  if (!node || !char) return { ok: false, reason: 'Unknown node.' };

  const owned = new Set(char.skillTreeNodes || []);
  if (owned.has(nodeId)) return { ok: false, reason: 'Already unlocked.' };
  if (node.isStarter) return { ok: false, reason: 'Starter nodes are granted automatically.' };

  const pts = char.skillPoints || 0;
  if (pts < (node.cost || 1)) return { ok: false, reason: `Need ${node.cost || 1} skill point(s).` };

  const connected = node.connectedNodeIds || [];
  const prereqs   = node.prerequisiteNodeIds || [];
  const hasLink   = connected.some(id => owned.has(id));
  const prereqsMet = prereqs.length === 0 || prereqs.every(id => owned.has(id));

  if (!hasLink && !prereqsMet) {
    return { ok: false, reason: 'Unlock a connected or prerequisite node first.' };
  }
  return { ok: true };
}

function unlockSkillNode(charId, nodeId) {
  const check = canUnlockSkillNode(charId, nodeId);
  if (!check.ok) return check;

  const node = UNIFIED_SKILL_TREE_NODES[nodeId];
  const char = PLAYER_DATA.characters[charId];
  char.skillPoints = (char.skillPoints || 0) - (node.cost || 1);
  char.skillTreeNodes = [...(char.skillTreeNodes || []), nodeId];

  _syncKnownAbilities(charId);
  SaveManager.write();
  return { ok: true, node };
}

function _syncKnownAbilities(charId) {
  const char = PLAYER_DATA.characters[charId];
  if (!char) return;
  const known = new Set();
  if (char.uniqueStartingAbilityId) known.add(char.uniqueStartingAbilityId);
  (char.skillTreeNodes || []).forEach(nodeId => {
    const node = UNIFIED_SKILL_TREE_NODES[nodeId];
    (node?.abilityUnlockIds || []).forEach(aid => known.add(aid));
  });
  char.knownAbilities = [...known];
}

function initCharacterBuild(charId, starterType) {
  const char = PLAYER_DATA.characters[charId];
  if (!char) return;

  let identity = null;
  if (starterType && STARTER_COMBAT_IDENTITY[starterType]) {
    const s = STARTER_COMBAT_IDENTITY[starterType];
    if (s.charId === charId) identity = s;
  }
  if (!identity) identity = CHARACTER_DEFAULT_IDENTITY[charId];

  char.charLevel = 1;
  char.charXp = 0;
  char.skillPoints = 0;
  char.lastSkillPointLevel = 1;
  char.starterRegionId = identity?.regionId || null;
  char.uniqueStartingAbilityId = identity?.uniqueAbilityId || null;
  char.skillTreeNodes = identity?.starterNodeId ? [identity.starterNodeId] : [];
  _syncKnownAbilities(charId);
}

function awardCharacterXp(charId, amount) {
  const char = PLAYER_DATA.characters[charId];
  if (!char || amount <= 0) return { levelsGained: 0, newLevel: getCharLevel(charId) };

  let lvl = getCharLevel(charId);
  if (lvl >= MAX_CHAR_LEVEL) return { levelsGained: 0, newLevel: lvl };

  char.charXp = (char.charXp || 0) + amount;
  let gained = 0;

  while (lvl < MAX_CHAR_LEVEL) {
    const needed = xpToCharLevel(lvl + 1) - xpToCharLevel(lvl);
    const have   = char.charXp - xpToCharLevel(lvl);
    if (have < needed) break;
    lvl++;
    gained++;
    char.skillPoints = (char.skillPoints || 0) + 1;
    char.lastSkillPointLevel = lvl;
  }

  char.charLevel = lvl;
  return { levelsGained: gained, newLevel: lvl };
}

function awardSkillPointsIfDue(charId) {
  return awardCharacterXp(charId, 0).levelsGained;
}

function getUnifiedSkillTreeBonuses(charId) {
  const blank = {
    attack: 0, defense: 0, magic: 0, speed: 0, maxHp: 0, maxMana: 0,
    resistance: 0, critChance: 0, atkPct: 0, defPct: 0, hpPct: 0,
    passiveEffectIds: [], healPct: 0, damagePct: {},
  };
  const owned = new Set(getUnlockedSkillNodes(charId));
  Object.values(UNIFIED_SKILL_TREE_NODES).forEach(node => {
    if (!owned.has(node.id)) return;
    const sb = node.statBonuses || {};
    Object.entries(sb).forEach(([k, v]) => {
      if (k === 'attack') blank.attack += v;
      else if (k === 'defense') blank.defense += v;
      else if (k === 'magic') blank.magic += v;
      else if (k === 'speed') blank.speed += v;
      else if (k === 'maxHp') blank.maxHp += v;
      else if (k === 'maxMana') blank.maxMana += v;
      else if (k === 'resistance') blank.resistance += v;
      else if (k === 'critChance') blank.critChance += v;
    });
    (node.passiveEffectIds || []).forEach(pid => blank.passiveEffectIds.push(pid));
  });
  return blank;
}

function getPassiveEffects(charId) {
  const effects = [];
  const tree = getUnifiedSkillTreeBonuses(charId);
  tree.passiveEffectIds.forEach(pid => {
    const def = PASSIVE_EFFECT_DEFINITIONS[pid];
    if (def) effects.push(def);
  });
  const unique = PLAYER_DATA.characters[charId]?.uniqueStartingAbilityId;
  if (unique === 'last_stand') {
    effects.push(PASSIVE_EFFECT_DEFINITIONS.last_stand);
  }
  return effects;
}

function getSkillTreeBonuses(charId) {
  const u = getUnifiedSkillTreeBonuses(charId);
  const legacy = { atkPct: 0, defPct: 0, hpPct: 0, spdFlat: 0, critFlat: 0,
    evasionFlat: 0, critMultBonus: 0, xpBonus: 0, accuracyFlat: 0 };

  if (u.atkPct) legacy.atkPct += u.atkPct;
  if (u.defPct) legacy.defPct += u.defPct;
  if (u.hpPct)  legacy.hpPct  += u.hpPct;
  legacy.spdFlat += u.speed;
  legacy.critFlat += u.critChance;

  (u.passiveEffectIds || []).forEach(pid => {
    const p = PASSIVE_EFFECT_DEFINITIONS[pid];
    if (p?.critChance) legacy.critFlat += p.critChance;
    if (p?.damagePct?.all) legacy.atkPct += p.damagePct.all;
    if (p?.defensePct) legacy.defPct += p.defensePct;
  });

  return legacy;
}

function migratePhase6SaveState() {
  Object.keys(PLAYER_DATA.characters || {}).forEach(charId => {
    const char = PLAYER_DATA.characters[charId];
    if (char.charLevel == null) {
      const oldLvl = Math.min(MAX_CHAR_LEVEL, Math.max(1,
        Math.floor(Object.values(char.skills).reduce((s, sk) => s + sk.level, 0) /
          Object.keys(char.skills).length)
      ));
      char.charLevel = oldLvl;
      char.charXp = xpToCharLevel(oldLvl);
      char.lastSkillPointLevel = char.lastSkillPointLevel || oldLvl;
    }
    if (!char.knownAbilities) _syncKnownAbilities(charId);

    const nodes = char.skillTreeNodes || [];
    const hasUnified = nodes.some(id => UNIFIED_SKILL_TREE_NODES[id]);
    if (!hasUnified && nodes.length > 0) {
      const refunded = nodes.length;
      char.skillPoints = (char.skillPoints || 0) + refunded;
      char.skillTreeNodes = [];
      const identity = getCharacterIdentity(charId);
      if (identity?.starterNodeId) {
        char.skillTreeNodes = [identity.starterNodeId];
        char.starterRegionId = identity.regionId;
        char.uniqueStartingAbilityId = identity.uniqueAbilityId;
      }
      _syncKnownAbilities(charId);
    } else if (!nodes.length && Unlock.isCharacterUnlocked(charId)) {
      const identity = getCharacterIdentity(charId);
      if (identity?.starterNodeId) {
        char.skillTreeNodes = [identity.starterNodeId];
        char.starterRegionId = identity.regionId;
        char.uniqueStartingAbilityId = identity.uniqueStartingAbilityId;
        _syncKnownAbilities(charId);
      }
    }
  });
}

function isSkillNodeAvailable(charId, nodeId) {
  const check = canUnlockSkillNode(charId, nodeId);
  return check.ok;
}

function isSkillNodeOwned(charId, nodeId) {
  return (getUnlockedSkillNodes(charId) || []).includes(nodeId);
}

function syncCharacterAbilities(charId) {
  _syncKnownAbilities(charId);
}
