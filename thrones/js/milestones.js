'use strict';
// =============================================================
// milestones.js — MILESTONES module
// Tracks and displays achievement-style milestones.
// Player manually opens the overlay and claims completed ones.
// Rewards: gold and/or bonus skill points (to all heroes).
// =============================================================

const MILESTONES = (() => {

  const CATEGORY_META = {
    combat:   { label: 'Combat',   icon: '⚔️', color: '#c94040' },
    crafting: { label: 'Crafting', icon: '⚒️', color: '#d4a332' },
    economy:  { label: 'Economy',  icon: '💰', color: '#3aaa5e' },
    items:    { label: 'Items',    icon: '🎒', color: '#7ab8f0' },
    quest:    { label: 'Quests',   icon: '📋', color: '#9060c0' },
  };

  // ── Open / close ──────────────────────────────────────────────
  function open() {
    _render();
    const overlay = document.getElementById('overlay-milestones');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    SFX.uiClick();
  }

  function close() {
    const overlay = document.getElementById('overlay-milestones');
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
  }

  // ── Render ────────────────────────────────────────────────────
  function _render() {
    const container = document.getElementById('milestone-list');
    if (!container) return;

    const claimedMs    = new Set(PLAYER_DATA.completedMilestones || []);
    const claimedQuest = new Set(PLAYER_DATA.completedQuests || []);
    const claimableMs  = new Set(getClaimableMilestones().map(m => m.id));
    const claimableQ   = new Set(getClaimableQuests().map(q => q.id));

    // Group by category
    const categories = ['quest', 'combat', 'crafting', 'economy', 'items'];

    container.innerHTML = categories.map(cat => {
      const meta  = CATEGORY_META[cat];
      const group = cat === 'quest'
        ? QUEST_DEFINITIONS
        : MILESTONE_DEFINITIONS.filter(m => m.category === cat);

      const cards = group.map(m => {
        const isQuest     = cat === 'quest';
        const isClaimed   = isQuest ? claimedQuest.has(m.id) : claimedMs.has(m.id);
        const isClaimable = isQuest ? claimableQ.has(m.id) : claimableMs.has(m.id);
        let state = 'locked';
        if (isClaimed)   state = 'claimed';
        else if (isClaimable) state = 'claimable';

        const rewardText = _rewardLabel(m.reward);

        return `
          <div class="milestone-card ms-${state}">
            <div class="ms-card-left">
              <span class="ms-icon">${m.icon}</span>
            </div>
            <div class="ms-card-body">
              <div class="ms-name">${m.displayName}</div>
              <div class="ms-desc">${m.desc}</div>
              <div class="ms-reward">${rewardText}</div>
            </div>
            <div class="ms-card-right">
              ${isClaimed
                ? '<span class="ms-claimed-badge">✓ Done</span>'
                : isClaimable
                  ? `<button class="btn btn-ms-claim" data-id="${m.id}">Claim</button>`
                  : '<span class="ms-locked-badge">○</span>'
              }
            </div>
          </div>`;
      }).join('');

      return `
        <div class="ms-category">
          <div class="ms-category-header" style="--cat-color:${meta.color}">
            ${meta.icon} ${meta.label}
          </div>
          ${cards}
        </div>`;
    }).join('');

    // Wire claim buttons
    container.querySelectorAll('.btn-ms-claim').forEach(btn => {
      btn.addEventListener('click', () => _handleClaim(btn.dataset.id));
    });

    _updateBadge();
  }

  function _rewardLabel(reward) {
    const parts = [];
    if (reward.gold)        parts.push(`<span class="ms-rwd-gold">◈ +${reward.gold} Gold</span>`);
    if (reward.skillPoints) parts.push(`<span class="ms-rwd-pts">✨ +${reward.skillPoints} Skill Point${reward.skillPoints > 1 ? 's' : ''} (all heroes)</span>`);
    return parts.join(' ');
  }

  function _handleClaim(id) {
    const isQuest = id.startsWith('q_');
    const reward  = isQuest ? claimQuest(id) : claimMilestone(id);
    if (!reward) return;

    SaveManager.write();
    SFX.levelUp();

    // Show toast on map
    const parts = [];
    if (reward.gold)        parts.push(`◈ +${reward.gold} Gold`);
    if (reward.skillPoints) parts.push(`✨ +${reward.skillPoints} Skill Pt${reward.skillPoints > 1 ? 's' : ''}`);
    MAP.showUnlockToast(`${isQuest ? '📋 Quest' : '🏅 Milestone'} claimed! ${parts.join(' · ')}`);

    // Refresh gold on map
    MAP.refresh();

    _render();

    // Refresh account if open
    if (typeof ACCOUNT !== 'undefined' && ACCOUNT.refreshIfOpen) ACCOUNT.refreshIfOpen();
    // Refresh skill tree if open so points update
    if (typeof SKILLTREE !== 'undefined' && SKILLTREE.refreshIfOpen) SKILLTREE.refreshIfOpen();
  }

  // ── Badge on map button ───────────────────────────────────────
  function updateBadge() { _updateBadge(); }

  function _updateBadge() {
    const badge = document.getElementById('milestone-badge');
    if (!badge) return;
    const count = claimableMilestoneCount() + claimableQuestCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  function init() {
    document.getElementById('btn-milestone-open')?.addEventListener('click', open);
    document.getElementById('btn-milestone-close')?.addEventListener('click', close);
    _updateBadge();
  }

  return { init, open, close, updateBadge };
})();
