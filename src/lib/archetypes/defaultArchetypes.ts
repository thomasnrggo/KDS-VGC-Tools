import {
  RECOVERY_MOVES,
  REDIRECTION_MOVES,
  RESIDUAL_MOVES,
  SETUP_MOVES,
  SLEEP_MOVES,
  TRAPPING_ABILITIES,
  TRAPPING_MOVES,
} from "./moveLists";
import type { ArchetypeDefinition, ArchetypeSet, RoleDefinition } from "./types";

/**
 * The first archetype set, from the taxonomy in docs/archetypes.md. Once
 * the admin page exists this becomes the seed it starts from; until then
 * it's the set the app and the exploration report use.
 */

const role = (
  id: string,
  name: string,
  match: RoleDefinition["match"],
  description?: string,
): RoleDefinition => ({ id, name, match, ...(description ? { description } : {}) });

export const DEFAULT_ROLES: RoleDefinition[] = [
  // Setters
  role("sun-setter", "Sun setter", { anyOf: [{ ability: ["Drought"] }, { move: ["Sunny Day"] }] }),
  role("rain-setter", "Rain setter", {
    anyOf: [{ ability: ["Drizzle"] }, { move: ["Rain Dance"] }],
  }),
  role("sand-setter", "Sand setter", {
    anyOf: [{ ability: ["Sand Stream"] }, { move: ["Sandstorm"] }],
  }),
  role("snow-setter", "Snow setter", {
    anyOf: [{ ability: ["Snow Warning"] }, { move: ["Snowscape", "Chilly Reception"] }],
  }),
  role("psychic-terrain-setter", "Psychic Terrain setter", {
    anyOf: [{ ability: ["Psychic Surge"] }, { move: ["Psychic Terrain"] }],
  }),
  role("grassy-terrain-setter", "Grassy Terrain setter", {
    anyOf: [{ ability: ["Grassy Surge"] }, { move: ["Grassy Terrain"] }],
  }),
  role("electric-terrain-setter", "Electric Terrain setter", {
    anyOf: [{ ability: ["Electric Surge"] }, { move: ["Electric Terrain"] }],
  }),
  role("tailwind-setter", "Tailwind setter", { move: ["Tailwind"] }),
  role("trick-room-setter", "Trick Room setter", { move: ["Trick Room"] }),

  // Abusers
  role(
    "tr-attacker",
    "Trick Room attacker",
    {
      allOf: [
        { computed: "attacker" },
        { anyOf: [{ baseStat: { spe: { max: 60 } } }, { natureLowers: "spe" }] },
      ],
    },
    "An attacker with base Speed 60 or less, or a Speed-lowering nature.",
  ),
  role("chlorophyll", "Chlorophyll abuser", { ability: ["Chlorophyll"] }),
  role("swift-swim", "Swift Swim abuser", { ability: ["Swift Swim"] }),
  role("expanding-force", "Expanding Force user", { move: ["Expanding Force"] }),
  role("fire-spread", "Fire spread attacker", { move: ["Heat Wave", "Eruption"] }),
  role("sleeper", "Sleep user", { move: SLEEP_MOVES }),

  // Support
  role("redirection", "Redirection", { move: REDIRECTION_MOVES }),
  role("fake-out", "Fake Out", { move: ["Fake Out"] }),
  role("intimidate", "Intimidate", { ability: ["Intimidate"] }),
  role("reflect", "Reflect", { move: ["Reflect"] }),
  role("light-screen", "Light Screen", { move: ["Light Screen"] }),
  role("aurora-veil", "Aurora Veil", { move: ["Aurora Veil"] }),

  // Offense and win conditions
  role("attacker", "Attacker", { computed: "attacker" }),
  role("setup", "Setup", { move: SETUP_MOVES }),
  role(
    "committed-setup",
    "Committed setup",
    { allOf: [{ move: SETUP_MOVES }, { computed: "fewAttacks" }] },
    "A setup move and one attack at most (Belly Drum style) — it can't do much without the boost.",
  ),
  role(
    "independent-attacker",
    "Attacker without setup",
    { allOf: [{ computed: "attacker" }, { not: { move: SETUP_MOVES } }] },
    "Deals damage without boosting first.",
  ),
  role("recovery", "Recovery", { move: RECOVERY_MOVES }),
  role("residual", "Damage over time", { move: RESIDUAL_MOVES }),
  role("poison", "Poison", { move: ["Toxic", "Toxic Spikes"] }),
  role("leech-seed", "Leech Seed", { move: ["Leech Seed"] }),
  role("perish-song", "Perish Song", { move: ["Perish Song"] }),
  role("trapper", "Trapper", {
    anyOf: [{ ability: TRAPPING_ABILITIES }, { move: TRAPPING_MOVES }],
  }),
];

const archetype = (
  definition: Omit<ArchetypeDefinition, "status"> & Partial<Pick<ArchetypeDefinition, "status">>,
): ArchetypeDefinition => ({
  status: "active",
  ...definition,
});

/**
 * Weather, terrain and dedicated strategies outrank speed control, which
 * outranks setup: Fake Out and a Swords Dance user are on most teams, so a
 * Tailwind team with them is "Tailwind + Hard setup", not the other way round.
 * Balance setup is the exception: the owner reads it as the team's identity, with
 * speed control as its mode — "Balance setup + Tailwind".
 */
const PRIORITY = { strategy: 4, balance: 3, speedControl: 2, setup: 1, fallback: 0 } as const;

export const DEFAULT_ARCHETYPES: ArchetypeDefinition[] = [
  // Speed control
  archetype({
    id: "tailwind",
    name: "Tailwind",
    family: "speedControl",
    description: "Doubles its side's Speed for four turns to outspeed and hit first.",
    requires: [{ role: "tailwind-setter" }],
    excludes: [{ role: "trick-room-setter" }],
    tempo: "offense",
    priority: PRIORITY.speedControl,
  }),
  archetype({
    id: "trick-room",
    name: "Trick Room",
    family: "speedControl",
    description: "Reverses the turn order so slow, powerful attackers move first.",
    requires: [{ role: "trick-room-setter" }, { role: "tr-attacker", min: 2 }],
    excludes: [{ role: "tailwind-setter" }],
    tempo: "offense",
    priority: PRIORITY.speedControl,
  }),
  archetype({
    id: "tail-room",
    name: "Tail/room",
    family: "speedControl",
    description: "Carries both Tailwind and Trick Room, picking the mode each game needs.",
    requires: [{ role: "tailwind-setter" }, { role: "trick-room-setter" }],
    priority: PRIORITY.speedControl,
  }),

  // Weather
  archetype({
    id: "sun",
    name: "Sun",
    family: "weather",
    description: "Sun powers up Fire attacks and Chlorophyll users, and weakens Water attacks.",
    requires: [{ role: "sun-setter" }],
    tempo: "positioning",
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "sun-chlorophyll",
    name: "Sun · Chlorophyll",
    family: "weather",
    parents: ["sun"],
    description: "A Grass type with Chlorophyll doubles its Speed in Sun and can spread sleep.",
    requires: [{ role: "chlorophyll" }],
    boosts: [{ condition: { role: "sleeper" }, weight: 1 }],
    tempo: "offense",
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "sun-fire-spam",
    name: "Sun · Fire spam",
    family: "weather",
    parents: ["sun"],
    description:
      "Mega Pyroar's Fire Mane plus Sun (about ×2.25 on Fire) hurts even Pokémon that resist Fire.",
    requires: [{ pokemon: { species: ["Pyroar-Mega"] } }],
    boosts: [{ condition: { role: "fire-spread", min: 2 }, weight: 1 }],
    tempo: "offense",
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "rain",
    name: "Rain",
    family: "weather",
    description: "Rain powers up Water attacks and Swift Swim users, and halves Fire damage taken.",
    requires: [{ role: "rain-setter" }],
    boosts: [{ condition: { role: "swift-swim" }, weight: 1 }],
    tempo: "positioning",
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "rain-screens",
    name: "Rain · Screens",
    family: "weather",
    parents: ["rain", "screens"],
    description: "Rain plus Reflect / Light Screen to cut the damage the team takes.",
    requires: [],
    tempo: "positioning",
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "double-weather",
    name: "Double weather",
    family: "weather",
    parents: ["sun", "rain"],
    description: "Runs both Sun and Rain, setting whichever weather the matchup wants.",
    requires: [],
    boosts: [
      { condition: { pokemon: { species: ["Charizard-Mega-Y"] } }, weight: 1 },
      { condition: { pokemon: { species: ["Pelipper"] } }, weight: 1 },
    ],
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "sand",
    name: "Sand",
    family: "weather",
    description: "Sand chips every non-Rock/Ground/Steel Pokémon and powers its abusers.",
    requires: [{ role: "sand-setter" }],
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "snow",
    name: "Snow",
    family: "weather",
    description: "Snow boosts Ice types' Defense and enables Aurora Veil.",
    requires: [{ role: "snow-setter" }],
    priority: PRIORITY.strategy,
  }),

  // Terrain
  archetype({
    id: "psyspam",
    name: "Psyspam",
    family: "terrain",
    description: "Psychic Terrain powers Expanding Force into a spread attack and blocks priority.",
    requires: [{ role: "psychic-terrain-setter" }, { role: "expanding-force" }],
    tempo: "offense",
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "psyspam-tr",
    name: "Psyspam · Trick Room",
    family: "terrain",
    // Both parents: it is a Trick Room team, so Trick Room folds in instead of showing twice.
    parents: ["psyspam", "trick-room"],
    description: "Psyspam under Trick Room — slow Psychic attackers sweep in the reversed order.",
    requires: [],
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "psyspam-ho",
    name: "Psyspam · Hyper offense",
    family: "terrain",
    parents: ["psyspam"],
    description: "Psyspam without a Trick Room mode — fast Expanding Force from turn one.",
    requires: [],
    // Trick Room as a backup (Indeedee often carries it) is still HO; a real Trick Room
    // mode — the setter and two slow attackers — is Psyspam · Trick Room.
    excludes: [{ allOf: [{ role: "trick-room-setter" }, { role: "tr-attacker", min: 2 }] }],
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "grassy-control",
    name: "Grassy control",
    family: "terrain",
    description: "Rillaboom's Grassy Terrain heals the team every turn and weakens Earthquake.",
    requires: [{ role: "grassy-terrain-setter" }],
    boosts: [
      { condition: { pokemon: { species: ["Rillaboom"] } }, weight: 1 },
      { condition: { role: "recovery" }, weight: 1 },
    ],
    // Set aside (owner, 2026-11-15): Rillaboom is on ~45% of M-C teams, most of which
    // don't play around the terrain, and the rule that tells real Grassy teams apart is
    // still open. A draft is kept but never matched.
    status: "draft",
    priority: PRIORITY.fallback,
  }),
  archetype({
    id: "electric-terrain",
    name: "Electric counter attack",
    family: "terrain",
    description: "Mega Raichu X's Electric Terrain powers Electric attacks and prevents sleep.",
    requires: [{ role: "electric-terrain-setter" }],
    boosts: [
      { condition: { pokemon: { species: ["Raichu-Mega-X"] } }, weight: 2 },
      { condition: { pokemon: { move: ["Rising Voltage"] } }, weight: 1 },
    ],
    priority: PRIORITY.strategy,
  }),

  // Setup — protect the king
  archetype({
    id: "hard-setup",
    name: "Hard setup",
    family: "setup",
    description:
      "Redirection or Fake Out buys the turn to set up immediately; the boosted Pokémon wins the game.",
    // The team depends on the boost: a setup user that barely attacks without it, or too
    // few other attackers to win without setting up.
    requires: [
      { anyOf: [{ role: "redirection" }, { role: "fake-out" }] },
      { role: "setup" },
      { anyOf: [{ role: "committed-setup" }, { role: "independent-attacker", min: 0, max: 2 }] },
    ],
    tempo: "patient",
    priority: PRIORITY.setup,
  }),
  archetype({
    id: "balance-setup",
    name: "Balance setup",
    family: "setup",
    description:
      "Support and coverage first, with setup as a mode: Redirection or Fake Out can open a chance to boost, but the team deals damage without it.",
    // Owner, 2026-11-15, on a Rillaboom / Raichu / Volcarona / Sneasler SD / Floette CM team:
    // "a balance team with a setup mode … it can work without setup".
    requires: [
      { anyOf: [{ role: "redirection" }, { role: "fake-out" }] },
      { role: "setup" },
      { role: "independent-attacker", min: 3 },
    ],
    excludes: [{ role: "committed-setup" }],
    tempo: "patient",
    priority: PRIORITY.balance,
  }),

  // Stall
  archetype({
    id: "stall",
    name: "Stall",
    family: "stall",
    description: "Wears the opponent down with damage over time and recovery.",
    requires: [{ role: "residual", min: 2 }, { role: "recovery" }],
    tempo: "patient",
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "stall-poison",
    name: "Stall · Poison",
    family: "stall",
    parents: ["stall"],
    description: "Stall built on poison.",
    requires: [{ role: "poison" }],
    priority: PRIORITY.strategy,
  }),
  archetype({
    id: "stall-leech-seed",
    name: "Stall · Leech Seed",
    family: "stall",
    parents: ["stall"],
    description: "Stall built on Leech Seed.",
    requires: [{ role: "leech-seed" }],
    priority: PRIORITY.strategy,
  }),

  // Screens
  archetype({
    id: "screens",
    name: "Screens",
    family: "screens",
    description: "Reflect and Light Screen (or Aurora Veil) halve damage while the team works.",
    requires: [
      {
        anyOf: [
          { allOf: [{ role: "reflect" }, { role: "light-screen" }] },
          { role: "aurora-veil" },
        ],
      },
    ],
    tempo: "patient",
    priority: PRIORITY.setup,
  }),

  // Perish trap
  archetype({
    id: "perish-trap",
    name: "Perish trap",
    family: "perishTrap",
    description: "Traps the opponent's Pokémon and knocks them out with Perish Song.",
    requires: [{ role: "perish-song" }, { role: "trapper" }],
    priority: PRIORITY.strategy,
  }),
];

export const DEFAULT_ARCHETYPE_SET: ArchetypeSet = {
  version: 1,
  roles: DEFAULT_ROLES,
  archetypes: DEFAULT_ARCHETYPES,
};
