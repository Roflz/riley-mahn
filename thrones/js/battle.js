'use strict';
// =============================================================
// battle.js — Turn-based battle engine
// Implements §6 (Battle System), §7 (Damage Formula), §9 (Skills)
// =============================================================

// ------------------------------------------------------------------
// BattleUnit — runtime instance of one character or enemy in a battle
// ------------------------------------------------------------------
class BattleUnit {
  constructor(def, isPlayer, slot) {
    this.defId    = def.id;
    this.name     = def.displayName;
    this.isPlayer = isPlayer;
    this.slot     = slot;           // position in team array (0-2)

    // Stats (support both player and enemy def shapes)
    this.maxHP      = def.baseMaxHP      !== undefined ? def.baseMaxHP      : def.maxHP;
    this.hp         = this.maxHP;
    this.attack     = def.baseAttack     !== undefined ? def.baseAttack     : def.attack;
    this.magic       = def.baseMagic      !== undefined ? def.baseMagic      : 0;
    this.defense    = def.baseDefense    !== undefined ? def.baseDefense    : def.defense;
    this.resistance = def.baseResistance !== undefined ? def.baseResistance : (def.resistance || 0);
    this.speed      = def.baseSpeed      !== undefined ? def.baseSpeed      : def.speed;
    this.skillId    = def.skillId || null;
    this.abilities  = def.abilities || (def.skillId ? [def.skillId] : []);
    this.uniqueStartingAbilityId = def.uniqueStartingAbilityId || null;
    this.color      = def.color   || '#888888';
    this.icon       = def.icon    || '●';

    // 'physical' | 'magic' — determines which defender stat mitigates attacks
    this.damageType     = def.damageType     || 'physical';
    // Heal power multiplier (from traits like Divine Touch)
    this.healMultiplier = def.healMultiplier !== undefined ? def.healMultiplier : 1.0;
    // Whether this unit prioritises healing allies (Cleric AI)
    this.healerRole     = !!def.healerRole;

    // Accuracy / evasion / crit — player units get these from getEffectiveStats();
    // enemy defs may specify them directly; defaults are conservative.
    this.accuracy       = def.accuracy       !== undefined ? def.accuracy       : 80;
    this.evasion        = def.evasion        !== undefined ? def.evasion        : 5;
    this.critChance     = def.critChance     !== undefined ? def.critChance     : 5;
    this.critMultiplier = def.critMultiplier !== undefined ? def.critMultiplier : 1.5;

    // Passives from equipped items (player only): [{ type, value }]
    this.passives = Array.isArray(def.passives) ? def.passives : [];
    // Trait initiative bonus (Swift, etc.)
    this.initiativePct = (def.trait && def.trait.initiativePct) || 0;

    // Mana (Phase 6)
    this.maxMana = def.maxMana || 25;
    this.mana    = this.maxMana;

    // Passive effects from skill tree
    this.passiveEffects = def.passiveEffects || [];

    // Per-battle mutable state
    this.alive        = true;
    this.skillCD      = 0;
    this.abilityCDs   = {};
    this.statusEffects = [];
    this.defBuff      = 0;
    this.defBuffTurns = 0;
    this.atkBuff      = 0;
    this.atkBuffTurns = 0;
    this.spdBuff      = 0;
    this.spdBuffTurns = 0;
    this.tauntTurns   = 0;
    this.openingStrikeUsed = false;

    this.cooldownReduction = (def.abilityMod && def.abilityMod.cooldownReduction) || 0;
  }

  get effectiveAttack() { return this.attack + this.atkBuff; }
  get effectiveMagic()  { return this.magic  + this.atkBuff; }
  get effectiveSpeed()  { return Math.max(1, this.speed + this.spdBuff + this.getStatusBonus('speed')); }
  get effectiveDef()    { return Math.max(0, this.defense + this.defBuff + this.getStatusBonus('defense')); }
  get effectiveRes()    { return this.resistance; }

  // HP as 0.0–1.0 fraction
  get hpPct() { return this.maxHP > 0 ? Math.max(0, this.hp / this.maxHP) : 0; }

  canUseSkill() { return !!this.skillId && this.skillCD === 0; }

  canUseAbility(abilityId) {
    const ab = ABILITY_DEFINITIONS[abilityId] || SKILLS[abilityId];
    if (!ab) return false;
    if (ab.abilityType === 'passive') return false;
    const cd = this.abilityCDs[abilityId] || 0;
    if (cd > 0) return false;
    const manaCost = ab.manaCost || 0;
    const hpCost   = ab.hpCost || 0;
    if (this.mana < manaCost) return false;
    if (hpCost > 0 && this.hp <= hpCost) return false;
    if (ab.openingOnly && this.openingStrikeUsed) return false;
    return true;
  }

  getStatusBonus(stat) {
    let bonus = 0;
    this.statusEffects.forEach(se => {
      if (se.id === 'defense_up' && stat === 'defense') bonus += se.magnitude;
      if (se.id === 'defense_down' && stat === 'defense') bonus -= se.magnitude;
      if (se.id === 'speed_down' && stat === 'speed') bonus -= se.magnitude;
    });
    const ls = this.passiveEffects.find(p => p.lowHpDefBonus);
    if (ls && stat === 'defense' && this.hpPct < ls.lowHpDefBonus.threshold) {
      bonus += ls.lowHpDefBonus.defense;
    }
    return bonus;
  }

  hasStatus(id) {
    return this.statusEffects.some(s => s.id === id && s.remainingTurns > 0);
  }

  applyStatusEffect(statusId, durationTurns, magnitude) {
    const existing = this.statusEffects.find(s => s.id === statusId);
    if (existing) {
      existing.remainingTurns = Math.max(existing.remainingTurns, durationTurns);
      existing.magnitude = Math.max(existing.magnitude, magnitude);
      return;
    }
    this.statusEffects.push({ id: statusId, remainingTurns: durationTurns, magnitude });
    const def = STATUS_EFFECT_DEFINITIONS[statusId];
    if (statusId === 'defense_up') {
      this.defBuff = Math.max(this.defBuff, magnitude);
      this.defBuffTurns = Math.max(this.defBuffTurns, durationTurns);
    } else if (statusId === 'defense_down') {
      this.defBuff -= magnitude;
      this.defBuffTurns = Math.max(this.defBuffTurns, durationTurns);
    } else if (statusId === 'speed_down') {
      this.spdBuff -= magnitude;
      this.spdBuffTurns = Math.max(this.spdBuffTurns, durationTurns);
    }
  }

  tickStatusEffects(battle, timing) {
    const toRemove = [];
    this.statusEffects.forEach(se => {
      const def = STATUS_EFFECT_DEFINITIONS[se.id];
      if (!def || def.tickTiming !== timing) return;
      if (se.id === 'poison' || se.id === 'bleed') {
        const dmg = this.applyDamage(se.magnitude);
        const side = this.isPlayer ? 'player' : 'enemy';
        battle._log(`${def.icon} ${this.name} takes ${dmg} ${def.displayName} damage.`, side);
        if (!this.alive) battle._log(`${this.icon} ${this.name} falls!`, 'defeat-unit');
      } else if (se.id === 'regeneration') {
        const healed = this.applyHeal(se.magnitude);
        if (healed > 0) {
          battle._log(`💚 ${this.icon} ${this.name} regenerates ${healed} HP.`, this.isPlayer ? 'player' : 'enemy');
        }
      }
      se.remainingTurns--;
      if (se.remainingTurns <= 0) toRemove.push(se.id);
    });
    toRemove.forEach(id => {
      this.statusEffects = this.statusEffects.filter(s => s.id !== id);
    });
  }

  tickTurn() {
    this.tickStatusEffects(this._battleRef, 'start_turn');
    if (this.skillCD > 0) this.skillCD--;
    Object.keys(this.abilityCDs).forEach(k => {
      if (this.abilityCDs[k] > 0) this.abilityCDs[k]--;
    });
    if (this.defBuffTurns > 0) {
      this.defBuffTurns--;
      if (this.defBuffTurns === 0) this.defBuff = 0;
    }
    if (this.atkBuffTurns > 0) {
      this.atkBuffTurns--;
      if (this.atkBuffTurns === 0) this.atkBuff = 0;
    }
    if (this.spdBuffTurns > 0) {
      this.spdBuffTurns--;
      if (this.spdBuffTurns === 0) this.spdBuff = 0;
    }
    if (this.tauntTurns > 0) this.tauntTurns--;
    this.tickStatusEffects(this._battleRef, 'end_turn');
  }

  applyTaunt(turns) {
    this.tauntTurns = Math.max(this.tauntTurns, turns);
  }

  attackPower() {
    return this.damageType === 'magic' ? this.effectiveMagic : this.effectiveAttack;
  }

  applyCombatBuff(type, amount, turns) {
    if (type === 'attack')  { this.atkBuff = amount; this.atkBuffTurns = turns; }
    if (type === 'defense') { this.defBuff = amount; this.defBuffTurns = turns; }
    if (type === 'speed')   { this.spdBuff = amount; this.spdBuffTurns = turns; }
  }

  // Resolve incoming damage — returns actual damage dealt (always >= 1)
  applyDamage(rawDmg) {
    const dmg = Math.max(1, Math.round(rawDmg));
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp === 0) this.alive = false;
    return dmg;
  }

  applyHeal(amount) {
    const prev = this.hp;
    this.hp = Math.min(this.maxHP, this.hp + Math.round(amount));
    return this.hp - prev;
  }

  applyDefBuff(amount, turns) {
    this.defBuff = amount;
    this.defBuffTurns = turns;
  }
}


// ------------------------------------------------------------------
// BattleState — manages turn queue, phases, and action resolution
// ------------------------------------------------------------------
class BattleState {
  constructor(playerDefs, enemyDefs) {
    this.playerTeam = playerDefs.map((d, i) => new BattleUnit(d, true,  i));
    this.enemyTeam  = enemyDefs.map((d, i)  => new BattleUnit(d, false, i));

    this.round      = 1;
    this.queue      = [];   // sorted BattleUnit[] for current round
    this.queueIdx   = 0;
    this.phase      = 'init';   // 'init'|'processing'|'player_input'|'victory'|'defeat'
    this.autoBattle = false;
    this.log        = [];       // { text: string, type: string }

    this._tickDone  = false;
    this.actionXp   = {};       // { charId: { skillId: xp } } — merged on victory

    this.playerTeam.forEach(u => { u._battleRef = this; u.mana = u.maxMana; });
    this.enemyTeam.forEach(u => { u._battleRef = this; });
    this._rebuildQueue();
    this._log(`— Round ${this.round} —`, 'round');
  }

  // ── Accessors ────────────────────────────────────────────────────
  get currentUnit()    { return this.queue[this.queueIdx] || null; }
  get livingPlayers()  { return this.playerTeam.filter(u => u.alive); }
  get livingEnemies()  { return this.enemyTeam.filter(u => u.alive); }

  // ── Logging ──────────────────────────────────────────────────────
  _log(text, type = 'info') {
    this.log.push({ text, type });
  }

  // ── Turn queue ───────────────────────────────────────────────────
  // Initiative = Speed + random variance (±30% of Speed), so faster
  // units usually act first but aren't guaranteed — makes battles feel
  // less scripted on higher-speed enemies.
  _rebuildQueue() {
    const all = [...this.playerTeam, ...this.enemyTeam];
    const withInit = all.filter(u => u.alive).map(u => {
      const spd = u.effectiveSpeed;
      const initBonus = u.initiativePct || 0;
      const effSpd = spd * (1 + initBonus);
      return {
        unit: u,
        init: effSpd + (Math.random() - 0.5) * effSpd * 0.6,
      };
    });
    withInit.sort((a, b) => b.init - a.init || (a.unit.isPlayer ? -1 : 1));
    this.queue    = withInit.map(w => w.unit);
    this.queueIdx = 0;
    this._tickDone = false;
  }

  _advance() {
    this._tickDone = false;
    this.queueIdx++;

    // Skip dead units
    while (this.queueIdx < this.queue.length && !this.queue[this.queueIdx].alive) {
      this.queueIdx++;
    }

    // End of round — rebuild
    if (this.queueIdx >= this.queue.length) {
      this.round++;
      this._rebuildQueue();
      if (this.queue.length > 0) {
        this._log(`— Round ${this.round} —`, 'round');
      }
    }
  }

  // ── Win / loss ───────────────────────────────────────────────────
  _checkEnd() {
    if (this.livingEnemies.length === 0) {
      this.phase = 'victory';
      this._log('⚔️  Victory! All enemies have been defeated.', 'victory');
      return true;
    }
    if (this.livingPlayers.length === 0) {
      this.phase = 'defeat';
      this._log('💀  Defeat. Your heroes have fallen.', 'defeat');
      return true;
    }
    return false;
  }

  // ── Target helpers ───────────────────────────────────────────────
  _lowestHP(units) {
    return units.length ? units.reduce((best, u) => u.hp < best.hp ? u : best, units[0]) : null;
  }

  _random(units) {
    return units.length ? units[Math.floor(Math.random() * units.length)] : null;
  }

  // Taunt draws ~80% of enemy attacks; otherwise 70% lowest-HP / 30% random
  _pickAITarget(attacker) {
    const foes = attacker.isPlayer ? this.livingEnemies : this.livingPlayers;
    const taunters = foes.filter(f => f.tauntTurns > 0);
    if (taunters.length && Math.random() < 0.8) return this._random(taunters);
    return Math.random() < 0.7 ? this._lowestHP(foes) : this._random(foes);
  }

  _pickAllyTarget(unit) {
    const allies = unit.isPlayer ? this.livingPlayers : this.livingEnemies;
    return this._lowestHP(allies);
  }

  // ── Combat action XP (Phase 3) ───────────────────────────────────
  _addActionXp(unit, skillId, amount) {
    if (!unit.isPlayer || amount <= 0) return;
    const id = unit.defId;
    if (!this.actionXp[id]) this.actionXp[id] = {};
    this.actionXp[id][skillId] = (this.actionXp[id][skillId] || 0) + amount;
  }

  _awardCombatActionXp(attacker, defender, dmg) {
    if (dmg <= 0) return;
    if (defender.isPlayer) {
      this._addActionXp(defender, 'defence', Math.max(1, Math.floor(dmg * 0.4)));
    }
    if (!attacker.isPlayer) return;
    const id = attacker.defId;
    if (attacker.damageType === 'magic') {
      this._addActionXp(attacker, 'magic', Math.max(1, Math.floor(dmg * 0.35)));
    } else if (id === 'ranger') {
      this._addActionXp(attacker, 'range', Math.max(1, Math.floor(dmg * 0.35)));
    } else if (id === 'warrior' || id === 'guardian') {
      const half = Math.max(1, Math.floor(dmg * 0.15));
      this._addActionXp(attacker, 'attack', half);
      this._addActionXp(attacker, 'strength', half);
    } else {
      this._addActionXp(attacker, 'attack', Math.max(1, Math.floor(dmg * 0.3)));
    }
  }

  // ── Action resolvers ─────────────────────────────────────────────
  // §7: Damage = max(1, Attack - Mitigation), with accuracy/evasion/crit.
  // Physical attackers are mitigated by defender.defense;
  // magic attackers are mitigated by defender.resistance instead.
  // Returns { dmg, miss, crit } for SFX/UI callers.
  _doBasicAttack(attacker, defender) {
    const side   = attacker.isPlayer ? 'player' : 'enemy';
    const isMagic = attacker.damageType === 'magic';

    // Hit check
    const hitThreshold = Math.max(10, attacker.accuracy - defender.evasion);
    if (Math.random() * 100 >= hitThreshold) {
      this._log(
        `${attacker.icon} ${attacker.name} ${isMagic ? 'casts at' : 'attacks'} ${defender.icon} ${defender.name} — MISS!`,
        `${side}-miss`
      );
      return { dmg: 0, miss: true, crit: false };
    }

    // Crit check
    const isCrit  = Math.random() * 100 < attacker.critChance;
    const mitigation = isMagic ? defender.effectiveRes : defender.effectiveDef;
    let raw     = attacker.attackPower() - mitigation;
    if (defender.hasStatus('marked')) raw = Math.floor(raw * 1.2);
    const rawDmg  = isCrit ? Math.floor(raw * attacker.critMultiplier) : raw;
    const dmg     = defender.applyDamage(rawDmg);
    this._awardCombatActionXp(attacker, defender, dmg);

    const atkVerb  = isMagic ? '🔮' : '⚔️';
    const critTag  = isCrit ? ' 💥 CRITICAL!' : '';
    if (isCrit) {
      this._log(
        `${atkVerb} ${attacker.name} 💥 CRITICAL HIT on ${defender.icon} ${defender.name} — ${dmg} dmg!`,
        `${side}-crit`
      );
    } else {
      this._log(
        `${atkVerb} ${attacker.name} hits ${defender.icon} ${defender.name} — ${dmg} dmg.`,
        side
      );
    }
    if (!defender.alive) this._log(`${defender.icon} ${defender.name} falls!`, 'defeat-unit');

    // Passive: attacker lifesteal
    this._applyLifesteal(attacker, dmg);
    // Passive: defender thorns
    this._applyThorns(defender, attacker);

    return { dmg, miss: false, crit: isCrit };
  }

  _applyLifesteal(attacker, dmgDealt) {
    if (!attacker.alive || !attacker.passives.length) return;
    const ls = attacker.passives.find(p => p.type === 'lifesteal');
    if (!ls) return;
    const healed = attacker.applyHeal(Math.floor(dmgDealt * ls.value));
    if (healed > 0) {
      this._log(
        `💉 ${attacker.icon} ${attacker.name} leeches ${healed} HP.`,
        attacker.isPlayer ? 'player' : 'enemy'
      );
    }
  }

  _applyThorns(defender, attacker) {
    if (!attacker.alive) return;
    let thornDmg = 0;
    const thPass = defender.passives.find(p => p.type === 'thorns');
    if (thPass) thornDmg = thPass.value;
    const thStatus = defender.statusEffects.find(s => s.id === 'thorns' && s.remainingTurns > 0);
    if (thStatus) thornDmg = Math.max(thornDmg, thStatus.magnitude);
    if (!thornDmg) return;
    const reflected = attacker.applyDamage(thornDmg);
    this._log(
      `🌵 ${defender.icon} ${defender.name}'s thorns reflect ${reflected} dmg onto ${attacker.icon} ${attacker.name}!`,
      defender.isPlayer ? 'player' : 'enemy'
    );
    if (!attacker.alive) this._log(`${attacker.icon} ${attacker.name} falls!`, 'defeat-unit');
  }

  _isMagicDamage(damageType) {
    return ['magical', 'fire', 'ice', 'lightning', 'blood', 'necrotic', 'nature'].includes(damageType);
  }

  _abilityPower(attacker, ability) {
    const stat = ability.scalingStat === 'magic' ? attacker.effectiveMagic : attacker.effectiveAttack;
    return stat;
  }

  _resolveAbilityDamage(attacker, defender, ability) {
    const isMagic = this._isMagicDamage(ability.damageType) || attacker.damageType === 'magic';
    const isCrit = Math.random() * 100 < attacker.critChance;
    let mit = isMagic ? defender.effectiveRes : defender.effectiveDef;
    if (ability.defPiercing) mit = Math.floor(mit * (1 - ability.defPiercing));
    let rawBase = Math.floor(this._abilityPower(attacker, ability) * (ability.powerMultiplier || 1)) - mit;
    if (defender.hasStatus('marked')) rawBase = Math.floor(rawBase * 1.2);
    const rawDmg = isCrit ? Math.floor(rawBase * attacker.critMultiplier) : rawBase;
    const dmg = defender.applyDamage(rawDmg);
    this._awardCombatActionXp(attacker, defender, dmg);
    return { dmg, isCrit };
  }

  _doAbility(attacker, abilityId, target) {
    const ability = ABILITY_DEFINITIONS[abilityId];
    if (!ability) return;

    if (ability.hpCost) attacker.applyDamage(ability.hpCost);
    attacker.mana = Math.max(0, attacker.mana - (ability.manaCost || 0));
    const cd = Math.max(0, (ability.cooldownTurns || 0) - (attacker.cooldownReduction || 0));
    if (cd > 0) attacker.abilityCDs[abilityId] = cd;
    if (ability.openingOnly) attacker.openingStrikeUsed = true;

    const side = attacker.isPlayer ? 'player' : 'enemy';

    if (ability.abilityType === 'damage') {
      const targets = ability.targetType === 'all_enemies'
        ? (attacker.isPlayer ? this.livingEnemies : this.livingPlayers)
        : [target].filter(Boolean);

      this._log(`✨ ${attacker.icon} ${attacker.name} uses ${ability.displayName}!`, side);
      targets.forEach(foe => {
        const { dmg, isCrit } = this._resolveAbilityDamage(attacker, foe, ability);
        const critTag = isCrit ? ' 💥' : '';
        this._log(`  → ${foe.icon} ${foe.name} takes ${dmg} dmg.${critTag}`, side);
        if (!foe.alive) this._log(`${foe.icon} ${foe.name} falls!`, 'defeat-unit');
        this._applyLifesteal(attacker, Math.floor(dmg * (ability.lifestealPct || 0)));
        this._applyThorns(foe, attacker);
        (ability.statusEffects || []).forEach(se => {
          foe.applyStatusEffect(se.id, se.durationTurns, se.magnitude);
        });
      });

      if (ability.chainChance && Math.random() < ability.chainChance) {
        const pool = attacker.isPlayer ? this.livingEnemies : this.livingPlayers;
        const extra = pool.find(u => u !== target && u.alive);
        if (extra) {
          const chainAb = { ...ability, powerMultiplier: (ability.powerMultiplier || 1) * (ability.chainMultiplier || 0.5) };
          const { dmg } = this._resolveAbilityDamage(attacker, extra, chainAb);
          this._log(`  ⚡ Arc hits ${extra.icon} ${extra.name} for ${dmg}!`, side);
        }
      }
      if (ability.manaRestore) {
        attacker.mana = Math.min(attacker.maxMana, attacker.mana + ability.manaRestore);
        this._log(`✨ ${attacker.name} restores ${ability.manaRestore} mana.`, side);
      }

    } else if (ability.abilityType === 'heal') {
      const healed = target.applyHeal(
        Math.floor(this._abilityPower(attacker, ability) * (ability.powerMultiplier || 1) * attacker.healMultiplier)
      );
      this._log(
        `💚 ${attacker.icon} ${attacker.name} uses ${ability.displayName}! ${target.icon} ${target.name} +${healed} HP.`,
        side
      );
      (ability.statusEffects || []).forEach(se => {
        target.applyStatusEffect(se.id, se.durationTurns, se.magnitude);
      });

    } else if (ability.abilityType === 'buff' || ability.abilityType === 'debuff') {
      const tgt = ability.targetType === 'self' ? attacker : target;
      this._log(`✨ ${attacker.icon} ${attacker.name} uses ${ability.displayName} on ${tgt.icon} ${tgt.name}!`, side);
      (ability.statusEffects || []).forEach(se => {
        tgt.applyStatusEffect(se.id, se.durationTurns, se.magnitude);
      });
    }

    (ability.selfStatusEffects || []).forEach(se => {
      attacker.applyStatusEffect(se.id, se.durationTurns, se.magnitude);
    });
  }

  // §7: Skill Damage = max(1, Attack × Multiplier - Defense)
  _doSkill(attacker, target) {
    const skill = SKILLS[attacker.skillId];
    if (!skill) return;
    attacker.skillCD = Math.max(1, skill.cooldown - (attacker.cooldownReduction || 0));

    if (skill.skillType === 'damage_single') {
      const side    = attacker.isPlayer ? 'player' : 'enemy';
      const isMagic = attacker.damageType === 'magic';

      const isCrit = Math.random() * 100 < attacker.critChance;
      let mit = isMagic ? target.effectiveRes : target.effectiveDef;
      if (skill.defPiercing) mit = Math.floor(mit * (1 - skill.defPiercing));
      const power   = attacker.attackPower();
      const rawBase = Math.floor(power * skill.powerMultiplier) - mit;
      const rawDmg  = isCrit ? Math.floor(rawBase * attacker.critMultiplier) : rawBase;
      const dmg     = target.applyDamage(rawDmg);
      this._awardCombatActionXp(attacker, target, dmg);

      const critTag = isCrit ? ' 💥 CRITICAL!' : '';
      this._log(
        `✨ ${attacker.icon} ${attacker.name} uses ${skill.displayName}!${critTag} ` +
        `${target.icon} ${target.name} takes ${dmg} dmg.`,
        isCrit ? `${side}-crit` : side
      );
      if (!target.alive) this._log(`${target.icon} ${target.name} falls!`, 'defeat-unit');

    } else if (skill.skillType === 'damage_all') {
      const side    = attacker.isPlayer ? 'player' : 'enemy';
      const isMagic = attacker.damageType === 'magic';
      const power   = attacker.attackPower();
      const foes    = attacker.isPlayer ? this.livingEnemies : this.livingPlayers;
      this._log(`✨ ${attacker.icon} ${attacker.name} uses ${skill.displayName}!`, side);
      foes.forEach(foe => {
        let mit = isMagic ? foe.effectiveRes : foe.effectiveDef;
        const rawBase = Math.floor(power * skill.powerMultiplier) - mit;
        const dmg = foe.applyDamage(rawBase);
        this._awardCombatActionXp(attacker, foe, dmg);
        this._log(`  → ${foe.icon} ${foe.name} takes ${dmg} dmg.`, side);
        if (!foe.alive) this._log(`${foe.icon} ${foe.name} falls!`, 'defeat-unit');
      });

    } else if (skill.skillType === 'buff_defense') {
      target.applyDefBuff(skill.buffAmount, skill.buffDuration);
      this._log(
        `🛡️  ${attacker.icon} ${attacker.name} uses ${skill.displayName}! ` +
        `${target.icon} ${target.name} gains +${skill.buffAmount} DEF for ${skill.buffDuration} turns.`,
        'player'
      );

    } else if (skill.skillType === 'heal_ally') {
      const healPower = attacker.damageType === 'magic' ? attacker.effectiveMagic : attacker.effectiveAttack;
      const base   = Math.floor(healPower * skill.powerMultiplier * attacker.healMultiplier);
      const healed = target.applyHeal(base);
      if (skill.appliesTaunt) {
        attacker.applyTaunt(skill.appliesTaunt);
        this._log(
          `🛡️ ${attacker.icon} ${attacker.name} draws enemy attention!`,
          attacker.isPlayer ? 'player' : 'enemy'
        );
      }
      this._log(
        `💚 ${attacker.icon} ${attacker.name} uses ${skill.displayName}! ` +
        `${target.icon} ${target.name} recovers ${healed} HP.`,
        attacker.isPlayer ? 'player' : 'enemy'
      );
    }
  }

  // Enemy / auto-battle AI (§6 Enemy AI, §6 Auto Battle)
  _executeAI(unit) {
    if (unit.isPlayer && unit.abilities?.length) {
      const usable = unit.abilities.filter(a => unit.canUseAbility(a));
      if (usable.length && Math.random() < 0.45) {
        const aid = usable[Math.floor(Math.random() * usable.length)];
        const ab  = ABILITY_DEFINITIONS[aid];
        if (ab) {
          if (ab.targetType === 'self') {
            this._doAbility(unit, aid, unit);
            return;
          }
          if (ab.targetType === 'all_enemies') {
            const foes = this.livingEnemies;
            if (foes.length) { this._doAbility(unit, aid, foes[0]); return; }
          }
          const forAlly = ['single_ally', 'all_allies'].includes(ab.targetType);
          const target  = forAlly ? this._pickAllyTarget(unit) : this._pickAITarget(unit);
          if (target) { this._doAbility(unit, aid, target); return; }
        }
      }
    }

    const skill     = unit.canUseSkill() ? SKILLS[unit.skillId] : null;
    const isHealer  = unit.healerRole;

    // Bias toward using skill when it's a heal and an ally is below 60% HP
    let useSkill = false;
    if (skill) {
      if (skill.skillType === 'heal_ally') {
        const allies   = unit.isPlayer ? this.livingPlayers : this.livingEnemies;
        // Healers: heal if anyone below 80%; otherwise heal at 60%
        const threshold = isHealer ? 0.8 : 0.6;
        const injured   = allies.find(a => a.hpPct < threshold);
        useSkill = !!injured;
      } else if (skill.skillType === 'damage_all') {
        useSkill = Math.random() < 0.5;
      } else {
        useSkill = Math.random() < 0.4;
      }
    }

    if (useSkill) {
      if (skill.skillType === 'damage_all') {
        const foes = unit.isPlayer ? this.livingEnemies : this.livingPlayers;
        if (foes.length) { this._doSkill(unit, foes[0]); return; }
      } else {
        const forAlly = skill.targetType === 'ally';
        const target  = forAlly ? this._pickAllyTarget(unit) : this._pickAITarget(unit);
        if (target) { this._doSkill(unit, target); return; }
      }
    }
    const target = this._pickAITarget(unit);
    if (target) this._doBasicAttack(unit, target);
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Process exactly one turn in the queue.
   * Returns a phase string:
   *   'player_input' — waiting for the player to choose an action
   *   'auto_done'    — AI / auto turn resolved; caller should schedule next tick
   *   'continue'     — skipped a dead unit; caller should schedule next tick
   *   'victory'      — battle over, player won
   *   'defeat'       — battle over, player lost
   */
  processTick() {
    if (this.phase === 'victory' || this.phase === 'defeat') return this.phase;
    if (this._checkEnd()) return this.phase;

    this.phase = 'processing';

    const unit = this.currentUnit;
    if (!unit || !unit.alive) {
      this._advance();
      return 'continue';
    }

    // Tick cooldowns / buffs once per turn
    if (!this._tickDone) {
      unit.tickTurn();
      this._tickDone = true;
    }

    // Player turn in manual mode → wait for input
    if (unit.isPlayer && !this.autoBattle) {
      this.phase = 'player_input';
      return 'player_input';
    }

    // AI or auto-battle
    this._tickDone = false;
    this._executeAI(unit);
    if (this._checkEnd()) return this.phase;
    this._advance();
    return 'auto_done';
  }

  /** Player chooses basic attack. Returns next phase string. */
  playerAttack(targetUnit) {
    const attacker = this.currentUnit;
    if (!attacker || !attacker.isPlayer) return this.phase;
    this._tickDone = false;
    this._doBasicAttack(attacker, targetUnit);
    if (this._checkEnd()) return this.phase;
    this._advance();
    return 'continue';
  }

  /** Player eats food on their turn — ends turn without attacking. */
  playerEatFood() {
    const unit = this.currentUnit;
    if (!unit || !unit.isPlayer) return this.phase;
    this._tickDone = false;
    if (this._checkEnd()) return this.phase;
    this._advance();
    return 'continue';
  }

  /** Player uses a skill-tree ability. Returns next phase string. */
  playerUseAbility(abilityId, targetUnit) {
    const attacker = this.currentUnit;
    if (!attacker || !attacker.isPlayer) return this.phase;
    if (!attacker.canUseAbility(abilityId)) return 'player_input';
    this._tickDone = false;
    this._doAbility(attacker, abilityId, targetUnit);
    if (this._checkEnd()) return this.phase;
    this._advance();
    return 'continue';
  }

  /** Player uses their skill. Returns next phase string. */
  playerSkill(targetUnit) {
    const attacker = this.currentUnit;
    if (!attacker || !attacker.isPlayer) return this.phase;
    if (!attacker.canUseSkill()) return 'player_input';
    this._tickDone = false;
    this._doSkill(attacker, targetUnit);
    if (this._checkEnd()) return this.phase;
    this._advance();
    return 'continue';
  }

  /**
   * Toggle auto-battle on / off.
   * Returns true if auto was just enabled while we were waiting for player input
   * (caller should immediately schedule a tick).
   */
  toggleAuto() {
    this.autoBattle = !this.autoBattle;
    const wasWaiting = this.phase === 'player_input';
    if (this.autoBattle && wasWaiting) this.phase = 'processing';
    return this.autoBattle && wasWaiting;
  }
}

// =============================================================
// awardBattleXp — distribute XP to PLAYER_DATA after a win
// =============================================================
/**
 * @param {string[]} playerTeamIds - charIds in the winning team
 * @param {number}   xpPool        - total XP pool from the battle def
 * @returns {object} gains — { charId: { skillId: { xpGained, oldLevel, newLevel } } }
 */
function awardBattleXp(playerTeamIds, xpPool) {
  const gains = {};

  playerTeamIds.forEach(charId => {
    const def      = CHARACTER_DEFINITIONS[charId];
    const charData = PLAYER_DATA.characters[charId];
    gains[charId]  = {};

    // Apply skill-tree XP bonus for this hero
    const treeXpMult = 1 + (getSkillTreeBonuses(charId).xpBonus || 0);
    const heroPool   = Math.round(xpPool * treeXpMult);

    Object.entries(def.skillXpRates).forEach(([skillId, rate]) => {
      const xpGain   = Math.max(1, Math.round(heroPool * rate));
      const oldLevel = charData.skills[skillId].level;

      charData.skills[skillId].xp += xpGain;

      // Level-up loop
      let newLevel = oldLevel;
      while (newLevel < 99 && charData.skills[skillId].xp >= xpToLevel(newLevel + 1)) {
        newLevel++;
      }
      charData.skills[skillId].level = newLevel;

      gains[charId][skillId] = { xpGained: xpGain, oldLevel, newLevel };
    });

    // Character level XP is awarded separately via characterXpReward in main.js
    awardSkillPointsIfDue(charId);
  });

  return gains;
}
