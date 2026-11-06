# VGC Box

**The Pokémon VGC prep toolkit** — live at [vgcbox.vercel.app](https://vgcbox.vercel.app).

VGC Box brings together what you need to prepare for a Pokémon VGC tournament (Pokémon Champions,
level 50 doubles):

- **Metagame** (the home page) — usage from every Masters team list at official tournaments: the
  most-used Pokémon, their sets, items, moves and teammates, the top cores and the winning teams.
  New data every Monday.
- **Team Builder** and **My Teams** — build a team with the metagame's threats beside it, then keep
  its report: common leads, damage calcs, coverage and notes.
- **Damage Calculator** — calc your Pokémon against the metagame's common sets.
- **Speed Tiers** — every Pokémon's Speed at level 50, with and without a Choice Scarf.
- **Team Library** — search the community's teams collected by the
  [VGCPastes Repository](https://docs.google.com/spreadsheets/d/1axlwmzPA49rYkqXh7zHvAtSP-TKbM0ijGYBPRflLSWw),
  by Pokémon, item, player or event.
- **Matchup Planner** and **Tournaments** — plan a lead and back for each opponent, and log your
  runs round by round.

It's free and runs in the browser: your teams are saved on your device (IndexedDB), and an optional
Google sign-in syncs them across devices (Firebase). The site's name, tagline and descriptions live
in [`src/lib/site.ts`](./src/lib/site.ts).

See [PLANNING.md](./PLANNING.md) for the reasoning behind the design — the data model, the
Showdown-paste parsing spec, how species names resolve to sprite images, and the roadmap — and
[CHANGELOG.md](./CHANGELOG.md) for what shipped when.

This is a [Next.js](https://nextjs.org) app (App Router, TypeScript, Tailwind CSS v4).

## Getting started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run a production build locally
- `npm run lint` — ESLint
- `npm test` — run the unit test suite (Vitest)
- `npm run generate:species` — regenerate `src/data/species.json` from PokeAPI (one-off, not run per-request)

## Deploying

This is a standard Next.js App Router project — it deploys to [Vercel](https://vercel.com/) with no
extra configuration. Connect the repo and Vercel will detect the framework, run `npm run build`, and
serve it. There's no backend, database, or environment variables to configure — all data lives in the
visitor's browser (IndexedDB).

## Credits

- Team paste format: [Pokémon Showdown](https://pokemonshowdown.com/)
- Sprites: [HybridShivam/Pokemon](https://github.com/HybridShivam/Pokemon), self-hosted locally
- Species/form data: [PokeAPI](https://pokeapi.co/)

## License

[MIT](./LICENSE)

Pokémon and all related names, sprites, and imagery are trademarks of Nintendo, Game Freak, and The
Pokémon Company. This is an unofficial, fan-made tool with no affiliation to or endorsement by those
companies.
