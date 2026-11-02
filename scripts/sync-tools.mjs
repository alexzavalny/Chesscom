#!/usr/bin/env node
/*
 * Copies the chess tools that live in sibling project folders into this site,
 * one folder per tool (/memo/, /fen/, /puzzles/, /tournaments/), and wraps each
 * one in Pawn Patrol chrome: page title, shared top bar and a per-tool theme.
 *
 * The original projects stay the source of truth. Edit there, then run:
 *   node scripts/sync-tools.mjs            # all tools
 *   node scripts/sync-tools.mjs fen memo   # only some
 *
 * Synced folders are generated output: do not edit them by hand. Per-tool look
 * and feel lives in shared/themes/<id>.css, which this script never touches.
 *
 * PROJECTS_DIR overrides where the sibling projects are (default: ../ from this repo).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsRoot = path.resolve(process.env.PROJECTS_DIR ?? path.join(siteRoot, '..'));

// Puzzle bands are ~1.4 GB, over the GitHub Pages size limit, so they stay on the
// PuzzleMountain Pages site (served with Access-Control-Allow-Origin: *).
const PUZZLE_DATA_URL = 'https://alexzavalny.github.io/PuzzleMountain/data/puzzle_bands/';

const TOOLS = [
    {
        id: 'memo',
        title: 'Memo Rush',
        repo: 'ChessMemoRush',
        include: ['index.html', 'app.js', 'style.css'],
    },
    {
        id: 'fen',
        title: 'FEN Player',
        repo: 'FenPlayer',
        // FenPlayer's lockfile is out of sync with package.json, so `npm ci` fails.
        // --no-package-lock resolves from package.json (like its own CI) and leaves the lockfile untouched.
        build: 'npm install --no-package-lock --no-audit --no-fund && npm run build',
        from: 'dist',
    },
    {
        id: 'puzzles',
        title: 'Puzzle Mountain',
        repo: 'PuzzleMountain',
        // docs/ is PuzzleMountain's committed build output; rebuilding would copy 1.4 GB of bands.
        from: 'docs',
        exclude: ['data', '.nojekyll'],
        patches: [
            { file: 'app.js', find: 'data/puzzle_bands/', replace: PUZZLE_DATA_URL, expect: 2 },
        ],
    },
    {
        id: 'tournaments',
        title: 'Tournament Results',
        repo: 'EasyChessResults',
        include: ['index.html', 'script.js', 'styles.css', 'site.webmanifest', 'lib/chess-results.js', 'icons'],
        // Pawn Patrol is light-only: drop the tool's dark mode so it matches the rest of the site.
        patches: [
            { file: 'styles.css', removeBlock: '@media (prefers-color-scheme: dark)', expect: 1 },
            {
                file: 'index.html',
                find: '<meta name="color-scheme" content="light dark" />',
                replace: '<meta name="color-scheme" content="light" />',
                expect: 1,
            },
            {
                file: 'index.html',
                find: '<meta name="theme-color" content="#f7f1e6" media="(prefers-color-scheme: light)" />',
                replace: '<meta name="theme-color" content="#f7f7f7" />',
                expect: 1,
            },
            {
                file: 'index.html',
                find: '\n    <meta name="theme-color" content="#121816" media="(prefers-color-scheme: dark)" />',
                replace: '',
                expect: 1,
            },
            { file: 'site.webmanifest', find: '"background_color": "#121816"', replace: '"background_color": "#f7f7f7"', expect: 1 },
            { file: 'site.webmanifest', find: '"theme_color": "#59ffc0"', replace: '"theme_color": "#f7f7f7"', expect: 1 },
        ],
    },
];

const ALWAYS_SKIP = new Set(['.DS_Store', '.git', 'node_modules']);

const run = (command, cwd) => execSync(command, { cwd, stdio: 'inherit', shell: '/bin/bash' });

const read = (command, cwd) => {
    try {
        return execSync(command, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
        return '';
    }
};

const sourceVersion = (repoDir) => {
    const commit = read('git rev-parse --short HEAD', repoDir) || 'no-git';
    const changed = read('git status --porcelain --untracked-files=no', repoDir)
        .split('\n')
        .filter((line) => line && !line.endsWith('.DS_Store'));
    const dirty = changed.length ? '+local-changes' : '';
    return `${commit}${dirty}`;
};

const copyTree = async (fromDir, toDir, exclude = []) => {
    const skip = new Set([...ALWAYS_SKIP, ...exclude]);
    await fs.cp(fromDir, toDir, {
        recursive: true,
        filter: (src) => {
            const relative = path.relative(fromDir, src);
            const top = relative.split(path.sep)[0];
            return !skip.has(top) && !skip.has(path.basename(src));
        },
    });
};

const replaceExactlyOnce = (html, pattern, replacement, what) => {
    const matches = html.match(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`)) ?? [];
    if (matches.length !== 1) {
        throw new Error(`expected exactly one ${what} in index.html, found ${matches.length}`);
    }
    return html.replace(pattern, replacement);
};

const wrapInPawnPatrol = (html, tool, version) => {
    let result = replaceExactlyOnce(html, /<title>[\s\S]*?<\/title>/i, `<title>${tool.title} · Pawn Patrol</title>`, '<title>');
    result = replaceExactlyOnce(
        result,
        /<\/head>/i,
        [
            `    <!-- Synced from ${tool.repo}@${version} by scripts/sync-tools.mjs. Do not edit here. -->`,
            '    <link rel="stylesheet" href="../shared/pawnpatrol.css" />',
            `    <link rel="stylesheet" href="../shared/themes/${tool.id}.css" />`,
            '  </head>',
        ].join('\n'),
        '</head>',
    );
    result = replaceExactlyOnce(
        result,
        /<body[^>]*>/i,
        (bodyTag) => `${bodyTag}\n    <script src="../shared/pp-bar.js" data-tool="${tool.id}"></script>`,
        '<body>',
    );
    return result;
};

// Removes `<header> { ... }` (e.g. a whole @media block), matching braces so nested rules go with it.
const removeCssBlock = (css, header) => {
    const start = css.indexOf(header);
    const open = css.indexOf('{', start);
    let depth = 0;
    for (let index = open; index < css.length; index += 1) {
        if (css[index] === '{') {
            depth += 1;
        } else if (css[index] === '}') {
            depth -= 1;
            if (depth === 0) {
                return css.slice(0, start) + css.slice(index + 1);
            }
        }
    }
    throw new Error(`unbalanced braces after "${header}"`);
};

const applyPatch = async (targetDir, patch) => {
    const file = path.join(targetDir, patch.file);
    const content = await fs.readFile(file, 'utf8');
    const needle = patch.removeBlock ?? patch.find;
    const count = content.split(needle).length - 1;
    if (count !== patch.expect) {
        throw new Error(`${patch.file}: expected ${patch.expect} × "${needle}", found ${count}. The source changed; update the patch.`);
    }
    const patched = patch.removeBlock
        ? removeCssBlock(content, patch.removeBlock)
        : content.split(patch.find).join(patch.replace);
    await fs.writeFile(file, patched);
};

const syncTool = async (tool) => {
    const repoDir = path.join(projectsRoot, tool.repo);
    const targetDir = path.join(siteRoot, tool.id);

    try {
        await fs.access(repoDir);
    } catch {
        throw new Error(`source project not found: ${repoDir}`);
    }
    if (path.dirname(targetDir) !== siteRoot || !tool.id) {
        throw new Error(`refusing to write outside the site root: ${targetDir}`);
    }

    console.log(`\n▸ ${tool.title}  (${tool.repo} → /${tool.id}/)`);

    if (tool.build) {
        run(tool.build, repoDir);
    }

    const version = sourceVersion(repoDir);
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(targetDir, { recursive: true });

    if (tool.include) {
        for (const entry of tool.include) {
            await fs.cp(path.join(repoDir, entry), path.join(targetDir, entry), {
                recursive: true,
                filter: (src) => !ALWAYS_SKIP.has(path.basename(src)),
            });
        }
    } else {
        await copyTree(path.join(repoDir, tool.from), targetDir, tool.exclude);
    }

    for (const patch of tool.patches ?? []) {
        await applyPatch(targetDir, patch);
    }

    const indexFile = path.join(targetDir, 'index.html');
    const html = await fs.readFile(indexFile, 'utf8');
    await fs.writeFile(indexFile, wrapInPawnPatrol(html, tool, version));

    const themeFile = path.join(siteRoot, 'shared', 'themes', `${tool.id}.css`);
    try {
        await fs.access(themeFile);
    } catch {
        console.warn(`  ! no theme yet: shared/themes/${tool.id}.css`);
    }

    console.log(`  ✓ ${tool.repo}@${version}`);
};

const main = async () => {
    const wanted = process.argv.slice(2);
    const unknown = wanted.filter((id) => !TOOLS.some((tool) => tool.id === id));
    if (unknown.length) {
        throw new Error(`unknown tool id(s): ${unknown.join(', ')}. Known: ${TOOLS.map((tool) => tool.id).join(', ')}`);
    }
    const selected = wanted.length ? TOOLS.filter((tool) => wanted.includes(tool.id)) : TOOLS;

    for (const tool of selected) {
        await syncTool(tool);
    }
    console.log('\nDone. Review with `git status`, preview with `python3 -m http.server 8000`, then commit.');
};

main().catch((error) => {
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
});
