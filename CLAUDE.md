# Pawn Patrol (pawnpatrol.eu) - Developer Guide

Pawn Patrol is a hub of small chess tools. The landing page (`/index.html`) shows one tile per tool.

## Site layout
- `/index.html`, `/home.css`: landing page (tool tiles)
- `/stats/`: Chess.com Stats (Vue). Lives in this repo; edit it here
- `/memo/`, `/fen/`, `/puzzles/`, `/tournaments/`: **generated** by `scripts/sync-tools.mjs` from the sibling projects
  `../ChessMemoRush`, `../FenPlayer`, `../PuzzleMountain`, `../EasyChessResults`. Never edit them here; edit the source project and re-sync
- `/shared/pawnpatrol.css`: design tokens (`--pp-*`) and the top bar styles
- `/shared/pp-bar.js`: top bar, including the tool list (classic script, include right after `<body>` with `data-tool="<id>"`)
- `/shared/themes/<id>.css`: Pawn Patrol look for each synced tool, loaded after the tool's own CSS. Edit these here; sync never touches them

## Commands
- **Run locally**: `python3 -m http.server 8000` then open http://localhost:8000 (port 8000 is allowed by the tournaments API CORS)
- **Sync tools**: `node scripts/sync-tools.mjs` (all) or `node scripts/sync-tools.mjs fen memo` (some). Builds FEN Player, copies, patches, injects the bar and theme
- **Deploy**: GitHub Pages serves `main` as-is (no build step). Commit the synced output and push

## Adding a tool
1. Add it to `TOOLS` in `scripts/sync-tools.mjs` (or build it in-repo like `/stats/`)
2. Add it to `TOOLS` in `shared/pp-bar.js` and as a tile in `/index.html`
3. Create `shared/themes/<id>.css`, run the sync, then check it in a browser

## Gotchas
- Puzzle Mountain's puzzle data (~1.4 GB) is over the GitHub Pages limit. `/puzzles/` loads it from https://alexzavalny.github.io/PuzzleMountain/, so that site must stay published
- `/tournaments/` calls the Easy Chess Results API (ngrok, `../ChessResultsApi`). Its `CORS_ALLOWED_ORIGINS` must include `https://pawnpatrol.eu`
- Old stats links (`/?usernames=...`, `/?x`) are redirected to `/stats/` by the landing page

## Code Style Guidelines

### JavaScript
- Use ES6 module syntax for imports/exports (`import`, `export`)
- Camel case for variable/function names (`usernamesToNames`, `fetchStats`)
- Arrow functions for methods and callbacks
- 4-space indentation
- Single quotes for strings
- Descriptive function and variable names
- Methods grouped by functionality in Vue components
- Use try/catch for error handling with API calls
- Console.error for logging errors

### CSS
- Class-based styling (BEM-like naming with double underscore for variants)
- Mobile-first responsive design with @media queries
- Colors defined using hex values or named CSS colors
- Flexbox for layouts

### HTML
- Vue.js templates with v-for, v-if directives
- Semantic HTML elements (table, section, header)
- Classes for styling, not inline styles
- Bind events with @ syntax (@click)

### Architecture
- Vue.js for UI components and reactivity
- Modular code organization (services, utils)
- Config file for constants and configuration
- API services isolated in separate modules
- Utility functions for reusable logic

### Data Flow
- Use Vue data properties for state management
- Computed properties for derived values
- Methods for user interactions and API calls
- ChessApi service for external API communication