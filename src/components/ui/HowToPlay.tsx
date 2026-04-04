'use client';

import { useState } from 'react';
import { Button } from './Button';

const GUIDE_SECTIONS = [
  {
    title: 'What is D&D Arena?',
    icon: '?',
    content: `D&D Arena is a browser-based version of Dungeons & Dragons, the world's most popular tabletop role-playing game. Instead of a human running the game, an AI acts as your **Dungeon Master (DM)** — the narrator, referee, and storyteller.

**You** create a character and make choices. The **AI DM** describes the world, controls monsters and NPCs, and reacts to everything you do. The **dice** determine whether your actions succeed or fail.

There is no single way to "win." You explore, fight monsters, talk to characters, solve problems, and shape the story through your decisions.`,
  },
  {
    title: 'Getting Started',
    icon: '1',
    content: `**Step 1 — Create an Account**
Register with a username, email, and password.

**Step 2 — Create or Join a Session**
A session is a game room. Create one and invite friends, or join an existing one. Up to 4 players can play together.

**Step 3 — Create Your Character**
Choose a **Race** (Human, Elf, Dwarf, or Halfling), a **Class** (Fighter, Wizard, Rogue, or Cleric), assign your **ability scores**, and pick a name. Don't worry — the game guides you through each step.

**Step 4 — Start the Adventure**
The host clicks "Start Adventure" and the AI DM sets the scene. From there, it's all up to you!`,
  },
  {
    title: 'Races',
    icon: 'R',
    content: `Your race determines your character's species and gives ability bonuses:

**Human** — Versatile. +1 to all abilities. No special powers, but well-rounded.

**Elf** — Graceful and perceptive. +2 Dexterity. Has Darkvision (can see in the dark), resistant to being charmed, and doesn't need to sleep.

**Dwarf** — Tough and resilient. +2 Constitution. Has Darkvision, resistant to poison. Built to survive.

**Halfling** — Lucky and brave. +2 Dexterity. Can reroll natural 1s (the "Lucky" trait). Hard to frighten despite their small size.`,
  },
  {
    title: 'Classes',
    icon: 'C',
    content: `Your class determines your character's abilities and combat role:

**Fighter** — The warrior. High HP (d10 hit die), heavy armor, strong melee attacks. Simple and effective. Best for: beginners who want to hit things.

**Wizard** — The spellcaster. Low HP (d6), no armor, but devastating spells like Magic Missile, Sleep, and Fire Bolt. Best for: players who want variety and power.

**Rogue** — The sneaky one. Medium HP (d8), Sneak Attack for extra damage, lots of skills. Best for: players who like stealth and clever tactics.

**Cleric** — The healer. Medium HP (d8), medium armor, healing spells AND combat spells. Best for: players who want to support the team while still fighting.`,
  },
  {
    title: 'Ability Scores',
    icon: 'A',
    content: `Every character has 6 abilities that define what they're good at:

**Strength (STR)** — Physical power. Affects melee attacks, carrying things, climbing.
**Dexterity (DEX)** — Agility and reflexes. Affects ranged attacks, dodging, stealth, initiative.
**Constitution (CON)** — Toughness. Affects hit points (health). Higher CON = more HP. Important for everyone.
**Intelligence (INT)** — Book smarts. Affects Wizard spells, knowledge checks, investigation.
**Wisdom (WIS)** — Awareness and intuition. Affects Cleric spells, perception, insight.
**Charisma (CHA)** — Force of personality. Affects persuasion, deception, intimidation.

You assign the **Standard Array** (15, 14, 13, 12, 10, 8) to these abilities. Put your highest numbers in the stats your class needs most:
- Fighter → Strength or Dexterity, then Constitution
- Wizard → Intelligence, then Dexterity or Constitution
- Rogue → Dexterity, then Constitution or Charisma
- Cleric → Wisdom, then Constitution or Strength`,
  },
  {
    title: 'How Dice Work',
    icon: 'd20',
    content: `D&D uses dice to add randomness. The most important is the **d20** (a 20-sided die).

**The basic rule:** When you try something uncertain, you roll a d20, add a modifier, and compare to a target number.

**Ability Checks** — "Can I climb this wall?" Roll d20 + your modifier ≥ the Difficulty Class (DC).
- DC 10 = Easy, DC 15 = Medium, DC 20 = Hard

**Attack Rolls** — "Do I hit the goblin?" Roll d20 + attack modifier ≥ the enemy's Armor Class (AC).

**Saving Throws** — "Can I dodge the fireball?" Roll d20 + save modifier ≥ the spell's DC.

**Natural 20** — Rolling a 20 on the die (before modifiers) on an attack is a **Critical Hit** — automatic hit + double damage dice!

**Natural 1** — Rolling a 1 on an attack is an automatic miss, no matter what.

**Advantage** — Roll 2d20, take the higher. You get this from favorable situations.
**Disadvantage** — Roll 2d20, take the lower. Imposed by bad situations.`,
  },
  {
    title: 'Combat',
    icon: '!',
    content: `When you encounter hostile creatures, combat begins:

**1. Initiative** — Everyone rolls to determine turn order (d20 + Dexterity modifier). Higher goes first.

**2. Your Turn** — On your turn you can:
- **Move** — Move up to your speed (usually 30 feet)
- **Action** — Do one main thing:
  - **Attack** — Swing your weapon at an enemy
  - **Cast a Spell** — Use magic (costs a spell slot for non-cantrip spells)
  - **Dodge** — Focus on defense (harder to hit)
  - **Dash** — Double your movement
  - **And more...**
- **Bonus Action** — Some spells and abilities use this (separate from your action)

**3. Damage** — When you hit, roll your weapon's damage die + modifier. Subtract from the target's HP.

**4. Death** — When your HP hits 0, you fall unconscious and start making **Death Saving Throws**:
- Roll d20 each turn: 10+ = success, 9 or less = failure
- 3 successes = you stabilize (alive but unconscious)
- 3 failures = you die
- Natural 20 = you wake up with 1 HP!
- Healing from an ally also brings you back

**Combat ends** when all enemies are defeated (or you flee/negotiate).`,
  },
  {
    title: 'Exploration & Roleplay',
    icon: 'E',
    content: `Outside of combat, the game is freeform. You tell the AI DM what you want to do and it responds:

**Type anything!** Examples:
- "I search the room for hidden doors"
- "I try to persuade the guard to let us pass"
- "I examine the strange rune on the wall"
- "I pick the lock on the chest"

The DM may ask you to roll a **skill check** if the outcome is uncertain. Your skills include:
- **Perception** — Noticing things (traps, hidden doors, eavesdropping)
- **Investigation** — Figuring things out (puzzles, clues, mechanisms)
- **Persuasion** — Convincing NPCs through reason or charm
- **Stealth** — Sneaking past enemies or hiding
- **Athletics** — Climbing, jumping, swimming
- And 13 more!

**Resting** restores your resources:
- **Short Rest** (1 hour) — Spend Hit Dice to heal some HP
- **Long Rest** (8 hours) — Full HP, all spell slots back`,
  },
  {
    title: 'Spells (for Wizards & Clerics)',
    icon: 'S',
    content: `If you're playing a Wizard or Cleric, you have spells:

**Cantrips** (Level 0) — Free to cast, unlimited uses:
- *Fire Bolt* (Wizard) — Ranged fire attack, 1d10 damage
- *Sacred Flame* (Cleric) — Radiant damage, target must save
- *Guidance* (Cleric) — Give an ally +1d4 on a skill check

**Level 1 Spells** — Cost a spell slot (you have 2 at level 1):
- *Magic Missile* (Wizard) — Auto-hit, 3 darts of 1d4+1 force damage
- *Sleep* (Wizard) — Put weak enemies to sleep
- *Cure Wounds* (Cleric) — Heal an ally for 1d8 + WIS modifier
- *Guiding Bolt* (Cleric) — 4d6 radiant damage + next attack has advantage
- *Healing Word* (Cleric) — Bonus action heal at range

**Spell slots recover on a long rest.** Use them wisely — once they're gone, you rely on cantrips until you rest.`,
  },
  {
    title: 'Tips for New Players',
    icon: '*',
    content: `**Be creative.** There's no "right" action. Try unusual solutions — the AI DM will respond to creativity.

**Work with your party.** If someone is hurt, heal them. If someone is sneaking, create a distraction. Teamwork is powerful.

**Don't hoard spell slots.** Using them at the right moment can turn a fight. You can always rest later.

**Ask questions.** Type things like "What do I see?" or "Is there anything unusual?" The DM will give you more information.

**Fighters** — Get in the front, protect your Wizard. Use Second Wind (bonus action) to heal yourself.

**Wizards** — Stay in the back. Use Fire Bolt for free damage, save Magic Missile and Sleep for tough moments.

**Rogues** — Sneak Attack is your best friend. Try to get advantage (hide, have an ally nearby) for massive damage.

**Clerics** — Balance healing and attacking. Guiding Bolt is devastating. Save at least one spell slot for Cure Wounds.

**When in doubt:** just describe what your character would do. The game will handle the rest!`,
  },
];

export function HowToPlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg font-medium shadow-lg transition-all hover:scale-105 border border-amber-600"
      >
        How to Play
      </button>
    );
  }

  const section = GUIDE_SECTIONS[activeSection];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-amber-400">How to Play D&D Arena</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            X
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar navigation */}
          <div className="w-56 border-r border-gray-800 overflow-y-auto py-2 flex-shrink-0">
            {GUIDE_SECTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSection(i)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                  i === activeSection
                    ? 'bg-amber-900/30 text-amber-300 border-r-2 border-amber-500'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <span className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold flex-shrink-0 ${
                  i === activeSection ? 'bg-amber-700 text-white' : 'bg-gray-800 text-gray-500'
                }`}>
                  {s.icon}
                </span>
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <h3 className="text-xl font-bold text-amber-300 mb-4">{section.title}</h3>
            <div className="prose prose-invert max-w-none">
              {section.content.split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-gray-300 leading-relaxed mb-4">
                  {paragraph.split(/(\*\*.*?\*\*|\*.*?\*)/).map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={j} className="text-gray-100 font-semibold">{part.slice(2, -2)}</strong>;
                    }
                    if (part.startsWith('*') && part.endsWith('*')) {
                      return <em key={j} className="text-purple-300">{part.slice(1, -1)}</em>;
                    }
                    return <span key={j}>{part}</span>;
                  })}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
            disabled={activeSection === 0}
          >
            Previous
          </Button>
          <span className="text-xs text-gray-600">
            {activeSection + 1} / {GUIDE_SECTIONS.length}
          </span>
          {activeSection < GUIDE_SECTIONS.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setActiveSection(activeSection + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Got it!
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
