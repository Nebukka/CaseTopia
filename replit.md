# BetTopia - Growtopia Gambling Platform

## Overview

BetTopia is a Growtopia-themed gambling/betting website inspired by gamblit.net. Players use "gems" (💎) as currency to play various games.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/bettopia)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: JWT tokens (jsonwebtoken), stored in localStorage as "bettopia_token"
- **Build**: esbuild (CJS bundle) for API, Vite for frontend
- **Styling**: TailwindCSS v4 with dark purple/navy gaming palette

## Features

- **Cases**: 5 cases (Starter Case, Rare Finds, Legendary Box, Diamond Case, Celestial Crate) with Growtopia items and weighted drop rates
- **Case Battles**: Create 2-4 player battles, each player opens the same cases and winner takes all
- **Crash**: Multiplier crash game with auto-cashout
- **Limbo**: Target multiplier game
- **Mines**: 5x5 grid mines game with configurable mine count and cashout
- **Cross the Road**: Frogger-style crossing game
- **Live Chat**: Real-time chat (polling every 3s), only logged-in users can send messages
- **Auth**: Register/Login with JWT, 1000 starting gems
- **Leaderboard**: Top players by total wagered

## Pages

- `/` — Home with hero, feature cards, game grid
- `/cases` — Open cases with spin animation
- `/battles` — Case battles lobby and creation
- `/crash` — Crash game
- `/limbo` — Limbo game  
- `/mines` — Mines game
- `/cross` — Cross the Road game
- `/login` — Login
- `/register` — Register
- `/profile` — User profile

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/api-server run dev` — run API server
- `pnpm --filter @workspace/bettopia run dev` — run frontend

## Design

- Dark navy background (#13132a / HSL 240 20% 8%)
- Purple/violet neon accents (HSL 270 80% 60%)
- Left sidebar: live chat
- Top navbar: BetTopia logo, game navigation, user balance
- Rarity colors: gray (Common), blue (Uncommon), green (Rare), purple (Epic), orange (Legendary), gold (Mythic), white (Divine)
