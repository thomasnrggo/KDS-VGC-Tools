# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project state

This is a Next.js 16.2.12 / React 19.2.4 app for planning Pokémon VGC matchups. **[PLANNING.md](./PLANNING.md) is the source of truth** for what's being built — vision, locked-in architecture decisions, data model, the Showdown-paste parsing spec, species→sprite image resolution, UI structure, and the phased roadmap. Read it before making design decisions or assuming scope; update it when a decision changes. As of the last update, all 5 roadmap phases are complete — the core app (paste team → paste opponents → plan leads/backs) works end to end; see PLANNING.md §7 for what's deferred.

**[CHANGELOG.md](./CHANGELOG.md)** records what shipped and when (newest first, grouped by version). Add an entry under "Unreleased" with each user-facing change.

**Versioning:** every push to main (or merge request) is the next patch version: 0.2.0 first, then 0.2.1, 0.2.2, and so on. On each one:
- rename CHANGELOG's "Unreleased" to `## X.Y.Z — YYYY-MM-DD`
- bump `package.json`'s `version` (and `package-lock.json`'s, e.g. `npm version X.Y.Z --no-git-tag-version`)
- tag the commit `vX.Y.Z` and push the tag

Never bump the minor or major number (0.3, 1.0) unless the user explicitly says so. The 0.2 focus is improving and stabilizing the existing features (starting with the phone experience), not adding new ones.

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — run a production build locally
- `npm run lint` — ESLint (flat config via `eslint.config.mjs`, extends `eslint-config-next`'s `core-web-vitals` and `typescript` rule sets)
- `npm test` — run the Vitest unit test suite once; `npm run test:watch` for watch mode
- `npm run generate:species` — regenerate `src/data/species.json`/`baseStats.json`/`speciesTypes.json` from PokeAPI (one-off, not run per-request; see PLANNING.md §5)
- `npm run generate:moves` — regenerate `src/data/moves.json` from PokeAPI (one-off; see PLANNING.md §7's Damage Calculator entry)
- `npm run generate:type-chart` — regenerate `src/data/typeChart.json` from PokeAPI (one-off; static data, rarely needs re-running)
- `npm run generate:names` — regenerate `src/data/names/<language>.json` (localized Pokémon/move/item/ability/type/nature names) from PokeAPI; re-run after the other generators (see docs/localization.md)
- `npm run generate:calc-data` — regenerate `src/data/moveFlags.json`/`speciesWeights.json` (move flags and species weights for the damage calculator) from Showdown's data (`@pkmn/dex`); re-run after adding moves or species

## Stack notes

- **App Router** (`src/app/`), TypeScript, strict mode.
- **Tailwind CSS v4** via `@tailwindcss/postcss` (no `tailwind.config.*` — v4 configures via CSS in `globals.css`).
- **React Compiler is enabled** (`reactCompiler: true` in `next.config.ts`, `babel-plugin-react-compiler` installed) — avoid manual `useMemo`/`useCallback` optimization that the compiler already handles unless there's a specific reason.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).
- Next.js version is deliberately ahead of most training data — the AGENTS.md directive above (read `node_modules/next/dist/docs/` before writing code) is load-bearing, not boilerplate, given how much has changed across recent major versions.
