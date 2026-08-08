# VGC Match Planner

A personal tool for planning Pokémon VGC matchups. Paste your team once (Pokémon Showdown export
format), then build up a list of opponent teams — each with sprite art and one or more named game
plans covering lead/back picks and notes.

See [PLANNING.md](./PLANNING.md) for the full project plan: data model, the Showdown-paste parsing
spec, how species names resolve to sprite images, and the current roadmap. That file is the source of
truth for scope and design decisions — keep it in sync as the project evolves.

This is a [Next.js](https://nextjs.org) app (App Router, TypeScript, Tailwind CSS v4). Data is stored
entirely in the browser (IndexedDB) — there is no backend or account system.

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
- Sprites: [HybridShivam/Pokemon](https://github.com/HybridShivam/Pokemon)
- Species/form data: [PokeAPI](https://pokeapi.co/)

## License

[MIT](./LICENSE)

Pokémon and all related names, sprites, and imagery are trademarks of Nintendo, Game Freak, and The
Pokémon Company. This is an unofficial, fan-made tool with no affiliation to or endorsement by those
companies.
