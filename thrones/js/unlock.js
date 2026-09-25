'use strict';
// =============================================================
// unlock.js — Progression gating and reward distribution
// Reads/writes PLAYER_DATA; calls SaveManager.write() after changes.
// =============================================================

const Unlock = (() => {

  // ── Query helpers ─────────────────────────────────────────────
  function isBattleUnlocked(battleId) {
    return PLAYER_DATA.unlockedBattles.includes(battleId);
  }

  function isBattleCompleted(battleId) {
    return PLAYER_DATA.completedBattles.includes(battleId);
  }

  function isAreaUnlocked(areaId) {
    return PLAYER_DATA.unlockedAreas.includes(areaId);
  }

  function isCharacterUnlocked(charId) {
    return PLAYER_DATA.unlockedCharacters.includes(charId);
  }

  // ── Award gold ────────────────────────────────────────────────
  function awardGold(amount) {
    PLAYER_DATA.gold += amount;
  }

  // ── Mark battle complete and process all unlocks it triggers ──
  // Returns an object describing what was newly unlocked:
  // { newBattles: [], newAreas: [], newCharacters: [], alreadyDone: bool }
  function onBattleComplete(battleId) {
    const result = { newBattles: [], newAreas: [], newCharacters: [], newTerritories: [], alreadyDone: false };

    if (isBattleCompleted(battleId)) {
      result.alreadyDone = true;
      return result;
    }

    // Mark completed
    PLAYER_DATA.completedBattles.push(battleId);

    // Find the battle definition and apply its unlocks
    const def = BATTLE_DEFINITIONS.find(b => b.id === battleId);
    if (def && def.unlocksOnComplete) {
      const { battles = [], areas = [], characters = [] } = def.unlocksOnComplete;

      battles.forEach(id => {
        if (!isBattleUnlocked(id)) {
          PLAYER_DATA.unlockedBattles.push(id);
          result.newBattles.push(id);
        }
      });

      areas.forEach(id => {
        if (!isAreaUnlocked(id)) {
          PLAYER_DATA.unlockedAreas.push(id);
          result.newAreas.push(id);
        }
      });

      characters.forEach(id => {
        if (!isCharacterUnlocked(id)) {
          PLAYER_DATA.unlockedCharacters.push(id);
          result.newCharacters.push(id);
          if (typeof initCharacterBuild === 'function') initCharacterBuild(id, null);
        }
      });
    }

    // Phase 4 — territory unlocks from campaign progress
    result.newTerritories = checkTerritoryUnlocks();

    // Phase 7 — territory discovery on map
    if (typeof checkTerritoryDiscoveries === 'function') {
      result.newDiscoveries = checkTerritoryDiscoveries();
      result.newDiscoveries.forEach(id => {
        if (!result.newTerritories.includes(id)) result.newTerritories.push(id);
      });
    }

    SaveManager.write();
    return result;
  }

  // ── Territory unlock check (Phase 4) ─────────────────────────
  function checkTerritoryUnlocks() {
    if (!PLAYER_DATA.unlockedTerritories) {
      PLAYER_DATA.unlockedTerritories = getDefaultUnlockedTerritories();
    }
    const newly = [];
    Object.values(TERRITORY_DEFINITIONS).forEach(t => {
      if (PLAYER_DATA.unlockedTerritories.includes(t.id)) return;
      if (t.unlockedByDefault) {
        PLAYER_DATA.unlockedTerritories.push(t.id);
        newly.push(t.id);
        return;
      }
      if (t.unlockBattleId && isBattleCompleted(t.unlockBattleId)) {
        PLAYER_DATA.unlockedTerritories.push(t.id);
        newly.push(t.id);
      }
    });
    return newly;
  }

  function isTerritoryUnlockedById(territoryId) {
    return isTerritoryUnlocked(territoryId);
  }

  // ── Node state for map rendering ──────────────────────────────
  // Returns 'completed' | 'available' | 'locked'
  function battleNodeState(battleId) {
    if (isBattleCompleted(battleId)) return 'completed';
    if (isBattleUnlocked(battleId))  return 'available';
    return 'locked';
  }

  // ── Area state ────────────────────────────────────────────────
  function areaState(areaId) {
    return isAreaUnlocked(areaId) ? 'unlocked' : 'locked';
  }

  // ── Item drop roll ────────────────────────────────────────────
  // Returns an array of itemIds that dropped (may be empty, may have
  // multiple from separate independent rolls).
  function rollItemDrops(battleDef) {
    const dropped = [];
    const drops   = battleDef.possibleDrops || [];
    drops.forEach(({ itemId, chance }) => {
      if (Math.random() < chance) dropped.push(itemId);
    });
    return dropped;
  }

  // ── Add items to inventory ────────────────────────────────────
  // Increments ownedItems count for each dropped itemId.
  function awardItems(itemIds) {
    if (!itemIds || !itemIds.length) return;
    if (!PLAYER_DATA.ownedItems) PLAYER_DATA.ownedItems = {};
    itemIds.forEach(id => {
      PLAYER_DATA.ownedItems[id] = (PLAYER_DATA.ownedItems[id] || 0) + 1;
    });
  }

  // ── Resource drop roll (Phase 4 / starting campaign) ─────────
  function rollResourceDrops(battleDef) {
    const drops = [];
    (battleDef.guaranteedResourceDrops || []).forEach(({ resourceId, qty }) => {
      if (resourceId && qty > 0) drops.push({ resourceId, qty });
    });
    (battleDef.possibleResourceDrops || []).forEach(({ resourceId, qty, chance }) => {
      if (resourceId && qty > 0 && Math.random() < chance) {
        drops.push({ resourceId, qty });
      }
    });
    return drops;
  }

  function awardResources(drops) {
    if (!drops?.length) return;
    drops.forEach(({ resourceId, qty }) => addResource(resourceId, qty));
  }

  // ── Equip / unequip helpers ───────────────────────────────────
  // equipItem: auto-detects item slot from ITEM_DEFINITIONS.
  // Returns false if item is unknown.
  const _EMPTY_SLOTS = () => ({ weapon: null, helmet: null, chest: null, gloves: null, boots: null, ring: null, amulet: null });

  function equipItem(charId, itemId) {
    if (!PLAYER_DATA.equippedItems) return false;
    const item = ITEM_DEFINITIONS[itemId];
    if (!item) return false;
    const check = canEquipItem(charId, itemId);
    if (!check.ok) return false;
    const slot = item.slot || 'chest';
    if (!PLAYER_DATA.equippedItems[charId]) {
      PLAYER_DATA.equippedItems[charId] = _EMPTY_SLOTS();
    }
    PLAYER_DATA.equippedItems[charId][slot] = itemId;
    SaveManager.write();
    return true;
  }

  function unequipItem(charId, slot) {
    if (!PLAYER_DATA.equippedItems || !PLAYER_DATA.equippedItems[charId]) return;
    if (slot) {
      PLAYER_DATA.equippedItems[charId][slot] = null;
    } else {
      PLAYER_DATA.equippedItems[charId] = _EMPTY_SLOTS();
    }
    SaveManager.write();
  }

  return {
    isBattleUnlocked,
    isBattleCompleted,
    isAreaUnlocked,
    isCharacterUnlocked,
    awardGold,
    onBattleComplete,
    battleNodeState,
    areaState,
    rollItemDrops,
    awardItems,
    rollResourceDrops,
    awardResources,
    equipItem,
    unequipItem,
    checkTerritoryUnlocks,
    isTerritoryUnlockedById,
  };
})();
