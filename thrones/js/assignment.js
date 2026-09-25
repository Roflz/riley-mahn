'use strict';
// =============================================================
// assignment.js — Character gathering assignments (Phase 4)
// Characters work resource nodes over time; rewards on completion.
// Resources consumed from node pool at completion (not at start).
// =============================================================

const ASSIGNMENT = (() => {

  let _tickTimer = null;
  let _onComplete = null;

  function _genId() {
    return 'asgn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function getActive() {
    return (PLAYER_DATA.assignments || []).filter(a => !a.isCompleted);
  }

  function isCharacterAssigned(charId) {
    return !!getActiveAssignmentForCharacter(charId);
  }

  function getRemainingMs(assignment, nowMs = Date.now()) {
    return Math.max(0, assignment.endMs - nowMs);
  }

  function formatDuration(ms) {
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  function canStart(charId, nodeId) {
    if (!isCharacterAssignable(charId)) {
      return { ok: false, reason: 'Character is not available (active in battle party or already assigned).' };
    }
    const nodeDef = TERRITORY_NODE_DEFINITIONS[nodeId];
    if (!nodeDef) return { ok: false, reason: 'Unknown resource node.' };
    if (!isTerritoryNodeUnlocked(nodeId)) {
      return { ok: false, reason: 'This node is not unlocked yet.' };
    }
    const skillLevel = PLAYER_DATA.characters[charId]?.skills[nodeDef.skillType]?.level || 1;
    if (skillLevel < nodeDef.requiredSkillLevel) {
      return { ok: false, reason: `Requires ${SKILL_DEFINITIONS[nodeDef.skillType].displayName} Lv.${nodeDef.requiredSkillLevel}.` };
    }
    regenerateResourceNode(nodeId);
    const state = getResourceNodeState(nodeId);
    if (state.amount < 1) {
      return { ok: false, reason: 'Node depleted — wait for resources to regenerate.' };
    }
    return { ok: true };
  }

  function start(charId, nodeId) {
    const check = canStart(charId, nodeId);
    if (!check.ok) return check;

    const nodeDef = TERRITORY_NODE_DEFINITIONS[nodeId];
    const nowMs   = Date.now();
    const endMs   = nowMs + nodeDef.workDurationSeconds * 1000;
    const yieldAmt = calcAssignmentYield(nodeId, charId);

    const assignment = {
      id: _genId(),
      charId,
      territoryId: nodeDef.territoryId,
      nodeId,
      skillType: nodeDef.skillType,
      startMs: nowMs,
      endMs,
      isCompleted: false,
      expectedResourceReward: yieldAmt,
      expectedXpReward: nodeDef.baseXp,
    };

    if (!PLAYER_DATA.assignments) PLAYER_DATA.assignments = [];
    PLAYER_DATA.assignments.push(assignment);
    SaveManager.write();
    _ensureTick();
    return { ok: true, assignment };
  }

  function cancel(assignmentId) {
    const list = PLAYER_DATA.assignments || [];
    const idx  = list.findIndex(a => a.id === assignmentId && !a.isCompleted);
    if (idx < 0) return { ok: false, reason: 'Assignment not found.' };
    list.splice(idx, 1);
    SaveManager.write();
    return { ok: true };
  }

  function _complete(assignment) {
    const nodeDef = TERRITORY_NODE_DEFINITIONS[assignment.nodeId];
    if (!nodeDef || assignment.isCompleted) return null;

    regenerateResourceNode(assignment.nodeId);
    const state = getResourceNodeState(assignment.nodeId);
    const yieldAmt = calcAssignmentYield(assignment.nodeId, assignment.charId);

    if (state.amount >= 1) state.amount -= 1;

    addResource(nodeDef.resourceProduced, yieldAmt);
    const xpResult = addSkillXp(assignment.charId, nodeDef.skillType, nodeDef.baseXp);
    awardSkillPointsIfDue(assignment.charId);

    assignment.isCompleted = true;
    assignment.completedMs = Date.now();
    assignment.actualResourceReward = yieldAmt;
    assignment.xpResult = xpResult;

    const charDef = CHARACTER_DEFINITIONS[assignment.charId];
    const resDef  = RESOURCE_DEFINITIONS[nodeDef.resourceProduced];

    return {
      charId: assignment.charId,
      charName: charDef?.displayName || assignment.charId,
      charIcon: charDef?.icon || '●',
      nodeId: assignment.nodeId,
      nodeName: nodeDef.displayName,
      resourceName: resDef?.displayName || nodeDef.resourceProduced,
      resourceIcon: resDef?.icon || '📦',
      resourceAmount: yieldAmt,
      skillType: nodeDef.skillType,
      xpGained: nodeDef.baseXp,
      levelUp: xpResult && xpResult.newLevel > xpResult.oldLevel,
      newLevel: xpResult?.newLevel,
    };
  }

  function processAll(nowMs = Date.now()) {
    const completed = [];
    (PLAYER_DATA.assignments || []).forEach(a => {
      if (a.isCompleted || nowMs < a.endMs) return;
      const result = _complete(a);
      if (result) completed.push(result);
    });
    if (completed.length) SaveManager.write();
    return completed;
  }

  function _tick() {
    const done = processAll();
    if (done.length && typeof _onComplete === 'function') _onComplete(done);
    if (typeof MAP !== 'undefined' && MAP.refreshMarkers) MAP.refreshMarkers();
    if (typeof TERRITORY !== 'undefined' && TERRITORY.refreshIfOpen) TERRITORY.refreshIfOpen();
  }

  function _ensureTick() {
    if (_tickTimer) return;
    _tickTimer = setInterval(_tick, 1000);
  }

  function setOnComplete(fn) { _onComplete = fn; }

  function init() {
    _ensureTick();
  }

  return {
    init, start, cancel, processAll, getActive, isCharacterAssigned,
    canStart, getRemainingMs, formatDuration, setOnComplete,
  };
})();
