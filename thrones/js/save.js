'use strict';
// =============================================================
// save.js — SaveManager: persist / restore PLAYER_DATA via localStorage
// =============================================================

const SaveManager = (() => {
  const SAVE_KEY = 'of_thrones_save_v1';

  // ── Serialise ────────────────────────────────────────────────
  // Copies everything from PLAYER_DATA that needs persisting.
  function write() {
    try {
      const snapshot = {
        gold:               PLAYER_DATA.gold,
        completedBattles:   [...PLAYER_DATA.completedBattles],
        unlockedBattles:    [...PLAYER_DATA.unlockedBattles],
        unlockedAreas:      [...PLAYER_DATA.unlockedAreas],
        unlockedCharacters: [...PLAYER_DATA.unlockedCharacters],
        team:               [...PLAYER_DATA.team],
        ownedItems:         { ...(PLAYER_DATA.ownedItems || {}) },
        equippedItems: (() => {
          const SLOTS = ['weapon','helmet','chest','gloves','boots','ring','amulet'];
          const out = {};
          Object.entries(PLAYER_DATA.equippedItems || {}).forEach(([charId, slots]) => {
            const entry = {};
            SLOTS.forEach(s => { entry[s] = (slots && slots[s]) || null; });
            out[charId] = entry;
          });
          return out;
        })(),
        resources:          { ...(PLAYER_DATA.resources || {}) },
        food:               { ...(PLAYER_DATA.food || {}) },
        buildings:           [...(PLAYER_DATA.buildings || [])],
        buildingUpgrades:    { ...(PLAYER_DATA.buildingUpgrades || {}) },
        activePrayer:        PLAYER_DATA.activePrayer || null,
        completedMilestones: [...(PLAYER_DATA.completedMilestones || [])],
        completedQuests:     [...(PLAYER_DATA.completedQuests || [])],
        unlockedTerritories: [...(PLAYER_DATA.unlockedTerritories || [])],
        discoveredTerritories: [...(PLAYER_DATA.discoveredTerritories || [])],
        territoryUpgrades:   { ...(PLAYER_DATA.territoryUpgrades || {}) },
        resourceNodeStates:  JSON.parse(JSON.stringify(PLAYER_DATA.resourceNodeStates || {})),
        assignments:         JSON.parse(JSON.stringify(PLAYER_DATA.assignments || [])),
        lastSessionMs:       PLAYER_DATA.lastSessionMs || Date.now(),
        // Phase 5 — crafting & structures
        starterType:           PLAYER_DATA.starterType || null,
        craftingJobs:          JSON.parse(JSON.stringify(PLAYER_DATA.craftingJobs || [])),
        builtStructures:       { ...(PLAYER_DATA.builtStructures || {}) },
        knownRecipes:          [...(PLAYER_DATA.knownRecipes || [])],
        optionalBattlesUnlocked: [...(PLAYER_DATA.optionalBattlesUnlocked || [])],
        // Skills: { charId: { skillId: { level, xp } } }
        characters: (() => {
          const out = {};
          Object.entries(PLAYER_DATA.characters).forEach(([charId, charData]) => {
            out[charId] = {
              skills:               {},
              skillPoints:          charData.skillPoints          || 0,
              skillTreeNodes:       [...(charData.skillTreeNodes  || [])],
              lastSkillPointLevel:  charData.lastSkillPointLevel  || 1,
              charLevel:            charData.charLevel            || 1,
              charXp:               charData.charXp               || 0,
              knownAbilities:       [...(charData.knownAbilities  || [])],
              uniqueStartingAbilityId: charData.uniqueStartingAbilityId || null,
              starterRegionId:      charData.starterRegionId      || null,
              starterStatBonuses:   charData.starterStatBonuses
                ? { ...normalizeStarterStatBonuses(charData.starterStatBonuses) }
                : null,
            };
            Object.entries(charData.skills).forEach(([skillId, sk]) => {
              out[charId].skills[skillId] = { level: sk.level, xp: sk.xp };
            });
          });
          return out;
        })(),
      };
      PLAYER_DATA.lastSessionMs = Date.now();
      snapshot.lastSessionMs = PLAYER_DATA.lastSessionMs;
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('[SaveManager] write failed:', e);
    }
  }

  // ── Deserialise ──────────────────────────────────────────────
  // Merges a saved snapshot into PLAYER_DATA in-place.
  // Unknown keys are ignored; missing keys fall back to defaults.
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;   // no save exists

      const snap = JSON.parse(raw);

      if (typeof snap.gold === 'number') PLAYER_DATA.gold = snap.gold;

      if (Array.isArray(snap.completedBattles))
        PLAYER_DATA.completedBattles = snap.completedBattles;
      if (Array.isArray(snap.unlockedBattles))
        PLAYER_DATA.unlockedBattles  = snap.unlockedBattles;
      if (Array.isArray(snap.unlockedAreas))
        PLAYER_DATA.unlockedAreas    = snap.unlockedAreas;
      if (Array.isArray(snap.unlockedCharacters))
        PLAYER_DATA.unlockedCharacters = snap.unlockedCharacters;
      if (Array.isArray(snap.team) && snap.team.length >= 1)
        PLAYER_DATA.team = snap.team;

      // Inventory
      if (snap.ownedItems && typeof snap.ownedItems === 'object')
        PLAYER_DATA.ownedItems = { ...snap.ownedItems };

      // Resources and food
      if (snap.resources && typeof snap.resources === 'object')
        PLAYER_DATA.resources = { ...snap.resources };
      if (snap.food && typeof snap.food === 'object')
        PLAYER_DATA.food = { ...snap.food };

      // Buildings + active prayer
      if (Array.isArray(snap.buildings))
        PLAYER_DATA.buildings = snap.buildings.filter(id =>
          BUILDING_DEFINITIONS.some(b => b.id === id)
        );

      if (snap.buildingUpgrades && typeof snap.buildingUpgrades === 'object') {
        PLAYER_DATA.buildingUpgrades = {};
        Object.entries(snap.buildingUpgrades).forEach(([id, lvl]) => {
          if (BUILDING_UPGRADE_DEFINITIONS[id] && lvl) PLAYER_DATA.buildingUpgrades[id] = 1;
        });
      }
      if (snap.activePrayer && PRAYER_DEFINITIONS.some(p => p.id === snap.activePrayer))
        PLAYER_DATA.activePrayer = snap.activePrayer;
      else
        PLAYER_DATA.activePrayer = null;

      if (Array.isArray(snap.completedMilestones)) {
        const validIds = new Set(MILESTONE_DEFINITIONS.map(m => m.id));
        PLAYER_DATA.completedMilestones = snap.completedMilestones.filter(id => validIds.has(id));
      }
      if (Array.isArray(snap.completedQuests)) {
        const validQ = new Set(QUEST_DEFINITIONS.map(q => q.id));
        PLAYER_DATA.completedQuests = snap.completedQuests.filter(id => validQ.has(id));
      }

      if (snap.equippedItems && typeof snap.equippedItems === 'object') {
        const VALID_SLOTS = new Set(['weapon','helmet','chest','gloves','boots','ring','amulet']);
        Object.keys(PLAYER_DATA.equippedItems).forEach(charId => {
          const val = snap.equippedItems[charId];
          if (!val) return;
          // Migration: old saves stored a bare string (single-slot era)
          if (typeof val === 'string') {
            const item = ITEM_DEFINITIONS[val];
            if (item && VALID_SLOTS.has(item.slot)) {
              PLAYER_DATA.equippedItems[charId][item.slot] = val;
            }
          } else if (typeof val === 'object') {
            // Restore each slot by name; migrate old 'armour'/'accessory' keys
            // by looking up the item and reading its current slot value.
            const allKeys = Object.keys(val);
            allKeys.forEach(key => {
              const id = val[key];
              if (!id || !ITEM_DEFINITIONS[id]) return;
              const itemSlot = ITEM_DEFINITIONS[id].slot;
              if (VALID_SLOTS.has(itemSlot)) {
                PLAYER_DATA.equippedItems[charId][itemSlot] = id;
              }
              // Old slot names (armour/accessory) are silently dropped;
              // item re-appears in inventory and player can re-equip.
            });
          }
        });
      }

      // Restore per-character skills + skill tree state
      if (snap.characters && typeof snap.characters === 'object') {
        Object.keys(PLAYER_DATA.characters).forEach(charId => {
          const saved = snap.characters[charId];
          if (!saved || !saved.skills) return;
          Object.keys(PLAYER_DATA.characters[charId].skills).forEach(skillId => {
            const sk = saved.skills[skillId];
            if (sk && typeof sk.level === 'number' && typeof sk.xp === 'number') {
              PLAYER_DATA.characters[charId].skills[skillId].level = sk.level;
              PLAYER_DATA.characters[charId].skills[skillId].xp   = sk.xp;
            }
          });
          // Skill tree
          if (typeof saved.skillPoints === 'number')
            PLAYER_DATA.characters[charId].skillPoints = saved.skillPoints;
          if (typeof saved.lastSkillPointLevel === 'number')
            PLAYER_DATA.characters[charId].lastSkillPointLevel = saved.lastSkillPointLevel;
          if (Array.isArray(saved.skillTreeNodes)) {
            const validIds = new Set(Object.keys(UNIFIED_SKILL_TREE_NODES));
            PLAYER_DATA.characters[charId].skillTreeNodes =
              saved.skillTreeNodes.filter(id => validIds.has(id));
          }
          if (typeof saved.charLevel === 'number')
            PLAYER_DATA.characters[charId].charLevel = Math.min(MAX_CHAR_LEVEL, saved.charLevel);
          if (typeof saved.charXp === 'number')
            PLAYER_DATA.characters[charId].charXp = saved.charXp;
          if (Array.isArray(saved.knownAbilities))
            PLAYER_DATA.characters[charId].knownAbilities = saved.knownAbilities.filter(id => ABILITY_DEFINITIONS[id]);
          if (saved.uniqueStartingAbilityId)
            PLAYER_DATA.characters[charId].uniqueStartingAbilityId = saved.uniqueStartingAbilityId;
          if (saved.starterRegionId)
            PLAYER_DATA.characters[charId].starterRegionId = saved.starterRegionId;
          if (saved.starterStatBonuses)
            PLAYER_DATA.characters[charId].starterStatBonuses =
              normalizeStarterStatBonuses(saved.starterStatBonuses);
        });
      }

      // Phase 4 — territories & assignments
      if (Array.isArray(snap.unlockedTerritories)) {
        const validT = new Set(Object.keys(TERRITORY_DEFINITIONS));
        PLAYER_DATA.unlockedTerritories = snap.unlockedTerritories.filter(id => validT.has(id));
      }
      if (Array.isArray(snap.discoveredTerritories)) {
        const validT = new Set(Object.keys(TERRITORY_DEFINITIONS));
        PLAYER_DATA.discoveredTerritories = snap.discoveredTerritories.filter(id => validT.has(id));
      }
      if (snap.territoryUpgrades && typeof snap.territoryUpgrades === 'object') {
        PLAYER_DATA.territoryUpgrades = { ...snap.territoryUpgrades };
      }
      if (snap.resourceNodeStates && typeof snap.resourceNodeStates === 'object') {
        PLAYER_DATA.resourceNodeStates = { ...snap.resourceNodeStates };
      }
      if (Array.isArray(snap.assignments)) {
        PLAYER_DATA.assignments = snap.assignments.filter(a =>
          a && a.id && a.charId && a.nodeId && TERRITORY_NODE_DEFINITIONS[a.nodeId]
        );
      }
      if (typeof snap.lastSessionMs === 'number') {
        PLAYER_DATA.lastSessionMs = snap.lastSessionMs;
      }

      // Phase 5 — crafting & structures
      if (snap.starterType) PLAYER_DATA.starterType = snap.starterType;
      if (Array.isArray(snap.craftingJobs)) {
        PLAYER_DATA.craftingJobs = snap.craftingJobs.filter(j =>
          j && j.id && j.charId && j.recipeId && CRAFT_RECIPE_DEFINITIONS[j.recipeId]
        );
      }
      if (snap.builtStructures && typeof snap.builtStructures === 'object') {
        PLAYER_DATA.builtStructures = { ...snap.builtStructures };
      }
      if (Array.isArray(snap.knownRecipes)) {
        PLAYER_DATA.knownRecipes = snap.knownRecipes.filter(id => CRAFT_RECIPE_DEFINITIONS[id]);
      }
      if (Array.isArray(snap.optionalBattlesUnlocked)) {
        PLAYER_DATA.optionalBattlesUnlocked = snap.optionalBattlesUnlocked;
      }

      migrateTerritorySaveState();
      migratePhase5SaveState();
      migratePhase6SaveState();

      return true;  // save loaded
    } catch (e) {
      console.warn('[SaveManager] load failed:', e);
      return false;
    }
  }

  // ── Reset ────────────────────────────────────────────────────
  // Wipes localStorage and re-initialises PLAYER_DATA to defaults.
  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}

    const fresh = _makeDefaultPlayerData();
    Object.assign(PLAYER_DATA, fresh);
    migrateTerritorySaveState();
    migratePhase5SaveState();
    migratePhase6SaveState();
  }

  // ── Has save ─────────────────────────────────────────────────
  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; }
  }

  return { write, load, reset, hasSave };
})();
