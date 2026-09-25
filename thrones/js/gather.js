'use strict';
// =============================================================
// gather.js — GATHER module
// Manages the Gathering screen: Fishing, Mining, Woodcutting.
//
// Design:
//   - Player taps a node to select it and start gathering.
//   - An idle tick fires every node.tickMs automatically.
//   - Each tick awards 1 resource (respecting skill level req)
//     and XP to every character on the active team.
//   - The UI shows live resource counts, XP bars, and activity log.
// =============================================================

const GATHER = (() => {

  let _activeNodeId = null;   // currently selected node id
  let _tickTimer    = null;   // setInterval handle
  let _log          = [];     // recent activity strings (max 40)
  const MAX_LOG     = 40;

  // ── Open / Close ──────────────────────────────────────────────
  function open() {
    _render();
    UI.showScreen('screen-gather');
  }

  function close() {
    UI.showScreen('screen-map');
  }

  // ── Tick logic ────────────────────────────────────────────────
  function _startTick(nodeId) {
    _stopTick();
    const node = GATHERING_NODES.find(n => n.id === nodeId);
    if (!node) return;
    const tickMs = getGatherTickMs(node);
    _tickTimer = setInterval(() => _doGather(node), tickMs);
    _doGather(node);   // immediate first gather
  }

  function _stopTick() {
    if (_tickTimer) { clearInterval(_tickTimer); _tickTimer = null; }
  }

  // ── Core gather action ────────────────────────────────────────
  function _doGather(node) {
    // Determine which resource(s) the team can gather at this node
    const teamSkillLevel = _teamSkillLevel(node.skill);
    const available = node.resources
      .map(id => RESOURCE_DEFINITIONS[id])
      .filter(r => r && r.levelReq <= teamSkillLevel);

    if (!available.length) {
      _addLog(`⚠️ Skill too low to gather here. Keep training!`);
      _stopTick();
      _activeNodeId = null;
      _render();
      return;
    }

    // Pick highest-level available resource
    const resource = available[available.length - 1];
    addResource(resource.id, 1);

    // Award gathering XP to team
    const levelUps = awardGatheringXp(node.skill, resource.xpPerGather);
    if (isBuildingBuilt('shrine')) awardShrinePrayerXp();

    // Log
    _addLog(`${resource.icon} Gathered ${resource.displayName} (+${resource.xpPerGather} ${SKILL_DEFINITIONS[node.skill].displayName} XP)`);
    Object.entries(levelUps).forEach(([charId, { newLevel }]) => {
      const def = CHARACTER_DEFINITIONS[charId];
      _addLog(`⬆️ ${def.icon} ${def.displayName}: ${SKILL_DEFINITIONS[node.skill].displayName} → Lv.${newLevel}!`);
      SFX.levelUp();
    });

    SaveManager.write();
    _renderCounts();
    _renderLog();
    SFX.uiClick();
  }

  // ── Helpers ───────────────────────────────────────────────────
  // Average skill level of the active team (determines which resources unlock)
  function _teamSkillLevel(skillId) {
    if (!PLAYER_DATA.team.length) return 1;
    const sum = PLAYER_DATA.team.reduce((acc, charId) => {
      return acc + (PLAYER_DATA.characters[charId].skills[skillId]?.level || 1);
    }, 0);
    return Math.floor(sum / PLAYER_DATA.team.length);
  }

  function _addLog(text) {
    _log.unshift(text);
    if (_log.length > MAX_LOG) _log.length = MAX_LOG;
  }

  // ── Rendering ─────────────────────────────────────────────────
  function _render() {
    _renderNodes();
    _renderCounts();
    _renderSkillBars();
    _renderLog();
  }

  function _renderNodes() {
    const container = document.getElementById('gather-nodes');
    if (!container) return;

    container.innerHTML = GATHERING_NODES.map(node => {
      const skillLevel = _teamSkillLevel(node.skill);
      const skDef      = SKILL_DEFINITIONS[node.skill];
      const isActive   = _activeNodeId === node.id;

      // Resources available at current level
      const avail = node.resources
        .map(id => RESOURCE_DEFINITIONS[id])
        .filter(r => r.levelReq <= skillLevel);
      const next  = node.resources
        .map(id => RESOURCE_DEFINITIONS[id])
        .find(r => r.levelReq > skillLevel);

      const availHTML = avail.map(r =>
        `<span class="gather-resource-chip">${r.icon} ${r.displayName}</span>`
      ).join('');

      const nextHTML = next
        ? `<div class="gather-node-next">🔒 ${next.displayName} at ${skDef.displayName} Lv.${next.levelReq}</div>`
        : '';

      return `
        <div class="gather-node ${isActive ? 'gather-node-active' : ''}"
             data-node="${node.id}"
             style="--node-color:${node.color}">
          <div class="gather-node-header">
            <span class="gather-node-icon">${node.icon}</span>
            <div class="gather-node-info">
              <div class="gather-node-name">${node.displayName}</div>
              <div class="gather-node-skill" style="color:${skDef.color}">${skDef.icon} ${skDef.displayName} Lv.${skillLevel}</div>
            </div>
            <button class="btn gather-tap-btn ${isActive ? 'gather-tap-active' : ''}"
                    data-node="${node.id}">
              ${isActive ? '⏸ Stop' : '▶ Gather'}
            </button>
          </div>
          <div class="gather-node-resources">${availHTML}${nextHTML}</div>
        </div>`;
    }).join('');

    // Wire buttons
    container.querySelectorAll('.gather-tap-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _onNodeToggle(btn.dataset.node);
      });
    });
    container.querySelectorAll('.gather-node').forEach(el => {
      el.addEventListener('click', () => _onNodeToggle(el.dataset.node));
    });
  }

  function _onNodeToggle(nodeId) {
    if (_activeNodeId === nodeId) {
      _stopTick();
      _activeNodeId = null;
    } else {
      _activeNodeId = nodeId;
      _startTick(nodeId);
    }
    _renderNodes();
    SFX.uiClick();
  }

  function _renderCounts() {
    const container = document.getElementById('gather-inventory');
    if (!container) return;

    const resources = PLAYER_DATA.resources || {};
    const all       = Object.values(RESOURCE_DEFINITIONS);
    const owned     = all.filter(r => resources[r.id] > 0);

    if (!owned.length) {
      container.innerHTML = '<div class="gather-empty">No resources yet — start gathering!</div>';
      return;
    }

    container.innerHTML = owned.map(r => `
      <div class="resource-chip">
        <span class="resource-chip-icon">${r.icon}</span>
        <span class="resource-chip-name">${r.displayName}</span>
        <span class="resource-chip-qty">×${resources[r.id]}</span>
      </div>`
    ).join('');
  }

  function _renderSkillBars() {
    const container = document.getElementById('gather-skill-bars');
    if (!container) return;

    container.innerHTML = PLAYER_DATA.team.map(charId => {
      const def     = CHARACTER_DEFINITIONS[charId];
      const charSk  = PLAYER_DATA.characters[charId].skills;

      const bars = GATHERING_SKILLS.map(skillId => {
        const skDef  = SKILL_DEFINITIONS[skillId];
        const sk     = charSk[skillId];
        const pct    = xpProgressPct(sk.xp, sk.level).toFixed(1);
        const xpNow  = sk.xp - xpToLevel(sk.level);
        const xpNext = xpForNextLevel(sk.level);
        return `
          <div class="gather-skill-row">
            <span class="gsr-icon">${skDef.icon}</span>
            <div class="gsr-body">
              <div class="gsr-name-line">
                <span class="gsr-name">${skDef.displayName}</span>
                <span class="gsr-level" style="color:${skDef.color}">Lv.${sk.level}</span>
              </div>
              <div class="gsr-track">
                <div class="gsr-fill" style="width:${pct}%;background:${skDef.color}"></div>
              </div>
              <div class="gsr-xp-text">${sk.level >= 99 ? 'MAX' : `${xpNow} / ${xpNext} XP`}</div>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="gather-hero-bar">
          <span class="gather-hero-icon" style="color:${def.color}">${def.icon}</span>
          <div class="gather-hero-skills">${bars}</div>
        </div>`;
    }).join('');
  }

  function _renderLog() {
    const el = document.getElementById('gather-log');
    if (!el) return;
    if (!_log.length) {
      el.innerHTML = '<div class="gather-log-empty">Activity will appear here…</div>';
      return;
    }
    el.innerHTML = _log.map(t =>
      `<div class="gather-log-entry">${t}</div>`
    ).join('');
  }

  // ── Public API ────────────────────────────────────────────────
  function _switchTab(tabName) {
    document.querySelectorAll('.gather-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tabName)
    );
    document.querySelectorAll('.gather-panel').forEach(p =>
      p.classList.toggle('gather-panel-active', p.id === `gather-panel-${tabName}`)
    );
    if (tabName === 'cooking') {
      COOKING.open();
    } else if (tabName === 'smithing') {
      SMITHING.open();
    } else if (tabName === 'construction') {
      CONSTRUCTION.open();
    } else {
      _render();
    }
    SFX.uiClick();
  }

  function init() {
    document.getElementById('btn-gather-back')?.addEventListener('click', () => {
      _stopTick();
      _activeNodeId = null;
      close();
    });
  }

  return { init, open, close, _switchTab };
})();
