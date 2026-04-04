# D&D 5e Mechanics Research Summary

## 1. Core Gameplay Loop

### How It Works
D&D is a collaborative storytelling game where one **Dungeon Master (DM)** narrates the world and adjudicates rules, while **players** control individual characters and declare actions.

### Session Flow
```
Exploration → Social Interaction → Combat → Rest → Repeat
```

1. **Exploration**: Players navigate the world. DM describes environments, players investigate, search, travel. Triggers ability checks (Perception, Investigation, Survival).
2. **Social Interaction**: Players talk to NPCs. DM roleplays NPCs. Players use Persuasion, Deception, Intimidation checks.
3. **Combat**: Hostile encounter triggers initiative. Turn-based combat resolves until enemies defeated, flee, or negotiate.
4. **Rest**: Short rest (1 hour, spend Hit Dice to heal) or Long rest (8 hours, full HP recovery, spell slot recovery).

### DM Responsibilities
- Describe the world and consequences of player actions
- Control all NPCs and monsters
- Adjudicate rules and set Difficulty Classes (DCs)
- Drive narrative forward based on player choices
- Determine when dice rolls are needed

### Player Responsibilities
- Declare intended actions in natural language
- Roll dice when the DM calls for it
- Track character resources (HP, spell slots, abilities)
- Make decisions as their character

**MVP Essential**: The core loop of "DM describes → Player acts → System resolves → DM narrates result" is the fundamental interaction pattern to implement.

---

## 2. Character Creation

### Ability Scores
Six core stats define a character's capabilities:

| Ability | Abbr | Governs |
|---------|------|---------|
| Strength | STR | Melee attacks, carrying capacity, Athletics |
| Dexterity | DEX | Ranged attacks, AC, initiative, Stealth, Acrobatics |
| Constitution | CON | Hit points, concentration, endurance |
| Intelligence | INT | Arcana, History, Investigation, wizard spellcasting |
| Wisdom | WIS | Perception, Insight, Medicine, cleric spellcasting |
| Charisma | CHA | Persuasion, Deception, Intimidation, warlock/sorcerer spellcasting |

### Ability Score → Modifier Calculation
```
Modifier = floor((score - 10) / 2)
```

| Score | Modifier |
|-------|----------|
| 1     | -5       |
| 8-9   | -1       |
| 10-11 | +0       |
| 12-13 | +1       |
| 14-15 | +2       |
| 16-17 | +3       |
| 18-19 | +4       |
| 20    | +5       |

**Standard generation methods**:
- Standard Array: [15, 14, 13, 12, 10, 8] — assign to any stat
- Point Buy: 27 points to distribute (scores 8-15)
- Roll 4d6, drop lowest, six times

**MVP**: Use Standard Array for simplicity.

### Races (MVP Subset)
| Race | Ability Bonus | Traits |
|------|--------------|--------|
| Human | +1 to all stats | Versatile, no special abilities |
| Elf | +2 DEX | Darkvision, Fey Ancestry, Perception proficiency |
| Dwarf | +2 CON | Darkvision, Dwarven Resilience, weapon proficiencies |
| Halfling | +2 DEX | Lucky (reroll natural 1s), Brave, Small size |

### Classes (MVP Subset)
| Class | Hit Die | Primary Stat | Role | Key Feature |
|-------|---------|-------------|------|-------------|
| Fighter | d10 | STR or DEX | Melee/ranged damage | Action Surge (extra action), Fighting Style |
| Wizard | d6 | INT | Spellcaster | Spell slots, spellbook, Arcane Recovery |
| Rogue | d8 | DEX | Stealth/damage | Sneak Attack (extra damage), Expertise |
| Cleric | d8 | WIS | Healer/support | Healing spells, Channel Divinity, armor proficiency |

### Hit Points
```
Level 1 HP = Hit Die maximum + CON modifier
Level up HP = Hit Die roll (or average) + CON modifier
```

### Armor Class (AC)
```
Base AC = 10 + DEX modifier (unarmored)
Light armor: armor base + DEX modifier
Medium armor: armor base + DEX modifier (max +2)
Heavy armor: armor base (no DEX)
Shield: +2 AC
```
Typical AC range: 10 (unarmored) to 20+ (heavy armor + shield)

### Proficiency Bonus
Scales with character level:
| Level | Bonus |
|-------|-------|
| 1-4   | +2    |
| 5-8   | +3    |
| 9-12  | +4    |
| 13-16 | +5    |
| 17-20 | +6    |

Applied to: attack rolls with proficient weapons, skill checks with proficient skills, saving throws with proficient saves, spell attack rolls.

**MVP Essential**: 4 classes, 4 races, Standard Array, Level 1 only initially.

---

## 3. Dice Mechanics (d20 System)

### Core Resolution Mechanic
Almost everything resolves with:
```
d20 + relevant modifier ≥ target number (DC or AC)
```

### Ability Checks
When a player attempts something with uncertain outcome:
```
d20 + ability modifier [+ proficiency bonus if proficient] ≥ DC
```

**Difficulty Classes**:
| DC | Difficulty |
|----|-----------|
| 5  | Very Easy |
| 10 | Easy |
| 15 | Medium |
| 20 | Hard |
| 25 | Very Hard |
| 30 | Nearly Impossible |

### Skills (18 total)
Each skill is linked to an ability score. Proficiency adds the proficiency bonus.

| Skill | Ability | Common Use |
|-------|---------|-----------|
| Athletics | STR | Climbing, jumping, swimming |
| Acrobatics | DEX | Balance, tumbling |
| Stealth | DEX | Hiding, sneaking |
| Perception | WIS | Noticing things |
| Investigation | INT | Searching, deducing |
| Persuasion | CHA | Convincing NPCs |
| Deception | CHA | Lying |
| Intimidation | CHA | Threatening |
| Insight | WIS | Reading intentions |
| Arcana | INT | Magical knowledge |
| History | INT | Historical knowledge |
| Nature | INT | Nature knowledge |
| Religion | INT | Religious knowledge |
| Medicine | WIS | Stabilizing dying, diagnosis |
| Survival | WIS | Tracking, foraging |
| Animal Handling | WIS | Calming/controlling animals |
| Performance | CHA | Entertaining |
| Sleight of Hand | DEX | Pickpocketing, lockpicking |

### Saving Throws
Forced rolls to resist effects (spells, traps, poison):
```
d20 + ability modifier [+ proficiency bonus if proficient] ≥ DC
```
Each class is proficient in 2 saving throws.

### Advantage / Disadvantage
- **Advantage**: Roll 2d20, take the **higher** result
- **Disadvantage**: Roll 2d20, take the **lower** result
- Multiple sources don't stack — any advantage + any disadvantage = straight roll
- Common sources: attacking from stealth (advantage), attacking while prone (disadvantage)

### Critical Hits and Misses
- **Natural 20** on attack roll: automatic hit, roll damage dice twice
- **Natural 1** on attack roll: automatic miss
- Critical hits/misses only apply to **attack rolls**, not ability checks

**MVP Essential**: d20 + modifier vs DC, advantage/disadvantage, crits. All 18 skills.

---

## 4. Turn-Based Combat

### Initiative (Starting Combat)
```
Each combatant rolls: d20 + DEX modifier
Higher goes first. Ties: higher DEX modifier wins (or coin flip)
```
Turn order is set for the entire combat encounter.

### Round Structure
One round = every combatant takes one turn. One round ≈ 6 seconds in game time.

### Action Economy (Per Turn)
Each turn a character gets:

| Resource | Description | Examples |
|----------|------------|---------|
| **Movement** | Move up to speed (typically 30 ft) | Walk, climb, swim |
| **Action** | One main action | Attack, Cast Spell, Dash, Dodge, Help, Hide, Disengage, Use Object |
| **Bonus Action** | One bonus action (if available) | Offhand attack, some spells, Cunning Action (Rogue) |
| **Reaction** | One reaction per round (not just your turn) | Opportunity Attack, Shield spell, Counterspell |
| **Free Action** | Minor things | Drop item, speak a few words, open door |

### Attack Rolls
```
Melee: d20 + STR modifier + proficiency bonus ≥ target AC
Ranged: d20 + DEX modifier + proficiency bonus ≥ target AC
Spell: d20 + spellcasting ability modifier + proficiency bonus ≥ target AC
```

### Damage Rolls
On hit:
```
Weapon damage die + ability modifier
Example: Longsword = 1d8 + STR modifier
Critical: 2d8 + STR modifier (double dice, not modifier)
```

### Common Weapons
| Weapon | Damage | Type | Properties |
|--------|--------|------|-----------|
| Dagger | 1d4 | Piercing | Finesse, Light, Thrown |
| Shortsword | 1d6 | Piercing | Finesse, Light |
| Longsword | 1d8 | Slashing | Versatile (1d10) |
| Greataxe | 1d12 | Slashing | Heavy, Two-handed |
| Longbow | 1d8 | Piercing | Range 150/600, Two-handed |
| Handaxe | 1d6 | Slashing | Light, Thrown |

### Spellcasting Basics
- Spells use **spell slots** (limited resource, recovered on rest)
- **Cantrips** are free (unlimited use)
- Spell save DC: `8 + proficiency bonus + spellcasting modifier`
- Spell attack: `d20 + proficiency bonus + spellcasting modifier`

### Spell Slots by Level (Level 1)
| Class | Cantrips Known | 1st Level Slots |
|-------|---------------|----------------|
| Wizard | 3 | 2 |
| Cleric | 3 | 2 |

### Common Conditions
| Condition | Effect |
|-----------|--------|
| Prone | Disadvantage on attacks, melee attacks against have advantage, ranged have disadvantage |
| Stunned | Can't move or take actions, auto-fail STR/DEX saves, attacks against have advantage |
| Poisoned | Disadvantage on attack rolls and ability checks |
| Frightened | Disadvantage on ability checks and attacks while source visible, can't move closer |
| Unconscious | Incapacitated, prone, auto-fail STR/DEX saves, attacks within 5ft are auto-crits |

### Death and Dying
When HP reaches 0:
1. Character falls **unconscious**
2. Each turn, roll a **death saving throw** (d20, no modifiers)
   - 10+ = success, <10 = failure
   - Natural 20 = regain 1 HP and wake up
   - Natural 1 = 2 failures
3. **3 successes** = stabilized (unconscious but not dying)
4. **3 failures** = death
5. Taking damage while at 0 HP = 1 automatic failure (crit = 2)
6. Healing to any HP > 0 wakes the character up

**MVP Essential**: Initiative, action/movement/bonus action, attack rolls, damage, death saves. Simplify conditions to 3-4 most common.

---

## 5. Exploration & Storytelling

### DM Narration Pattern
```
1. DM describes the scene (environment, NPCs, sensory details)
2. DM asks "What do you do?"
3. Players declare actions
4. DM determines if a roll is needed
5. If roll needed: DM sets DC, player rolls
6. DM narrates the outcome
7. Loop back to step 1
```

### Skill Challenges
DM sets a DC and asks for a specific skill check:
- "Roll Perception to notice the trap" (DC 15)
- "Roll Persuasion to convince the guard" (DC 12)
- "Roll Athletics to climb the wall" (DC 10)

### Encounters
- **Combat encounters**: hostile creatures, resolved through combat system
- **Social encounters**: NPCs with motivations, resolved through roleplay + skill checks
- **Exploration encounters**: puzzles, traps, environmental challenges

### Traps
- **Detection**: Perception or Investigation check vs trap DC
- **Avoidance**: DEX saving throw or ability check
- **Damage**: varies (1d6 to 10d10 depending on tier)

### Rest Mechanics
| Rest Type | Duration | Recovery |
|-----------|----------|----------|
| Short Rest | 1 hour | Spend Hit Dice to heal, some abilities recharge |
| Long Rest | 8 hours | Full HP, recover all spell slots, recover half Hit Dice |

### Experience & Leveling (Simplified)
- Milestone leveling: DM awards level-ups at story milestones
- XP-based: Earn XP from combat and challenges

**MVP Essential**: DM narration loop, basic skill challenges, simple encounters. Use milestone leveling. Skip traps initially.

---

## 6. MVP Prioritization Summary

### Must Have (Phase 1)
- Character creation: 4 classes, 4 races, Standard Array, Level 1
- d20 resolution: ability checks, attack rolls, saving throws
- Turn-based combat: initiative, attack, damage, death saves
- AI DM: narration, NPC dialogue, scene description
- Basic exploration: room descriptions, skill checks

### Should Have (Phase 2)
- Advantage/disadvantage
- Full skill list with proficiencies
- Spellcasting with spell slots
- Short/long rest mechanics
- Conditions (prone, poisoned, stunned)
- Inventory and equipment

### Nice to Have (Phase 3)
- Level progression (levels 2-5)
- More classes and races
- Campaign persistence across sessions
- Complex encounter design
- Environmental hazards and traps
