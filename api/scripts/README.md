# Database seed scripts

## Single source of truth

All fixture data lives in:

- **`data/worldCup2026.seed.json`** — 48 teams + 104 matches (group + knockout)
- **`data/worldCup2026Seed.ts`** — types and loader/validation

## Commands

| Command | Purpose |
|---------|---------|
| `npm run seed` | Wipe `teams` + `matches`, reload from JSON |
| `npm run seed:export` | Export current MongoDB `teams` + `matches` back into the JSON file |
| `npm run update:knockout-fixtures` | Update Round of 32 teams/times in DB from JSON (keeps match IDs + user predictions). Defaults to all tenant DBs; pass names to limit: `npm run update:knockout-fixtures -- wc26Prod fifaPrediction` |

## Collections

| Collection | Contents |
|------------|----------|
| `teams` | Nation metadata (`teamId`, name, flag) — **canonical** |
| `matches` | Fixtures with `team1` / `team2` IDs only (no duplicated `team1Info`) |
| `users` | Not touched by seed |

The API enriches matches with names/flags from `teams` when serving responses.

## Updating data

1. Edit fixtures in MongoDB (or update the JSON by hand).
2. Run `npm run seed:export` to refresh `worldCup2026.seed.json`.
3. Commit the JSON, then `npm run seed` on other environments.
