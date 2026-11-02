/*
 * Pawn Patrol top bar.
 * Include as a classic (non-module) script right after <body>:
 *   <script src="../shared/pp-bar.js" data-tool="fen"></script>
 * It inserts the bar in place, so there is no layout jump.
 * To add a tool to the site: add it here AND as a tile in /index.html.
 */
(() => {
    const TOOLS = [
        { id: 'stats', name: 'Stats', path: 'stats/' },
        { id: 'memo', name: 'Memo Rush', path: 'memo/' },
        { id: 'fen', name: 'FEN Player', path: 'fen/' },
        { id: 'puzzles', name: 'Puzzle Mountain', path: 'puzzles/' },
        { id: 'tournaments', name: 'Tournaments', path: 'tournaments/' },
    ];

    const script = document.currentScript;
    if (!script) {
        console.error('pp-bar.js must be loaded as a classic script, not a module');
        return;
    }

    // This file lives in /shared/, so the site root is one level up from it.
    const siteRoot = new URL('../', script.src);
    const currentTool = script.dataset.tool;

    const nav = document.createElement('nav');
    nav.className = 'pp-bar';
    nav.setAttribute('aria-label', 'Pawn Patrol tools');

    const brand = document.createElement('a');
    brand.className = 'pp-bar__brand';
    brand.href = siteRoot.href;
    brand.textContent = 'Pawn Patrol';

    const links = document.createElement('div');
    links.className = 'pp-bar__links';

    TOOLS.forEach((tool) => {
        const link = document.createElement('a');
        link.className = 'pp-bar__link';
        link.href = new URL(tool.path, siteRoot).href;
        link.textContent = tool.name;
        if (tool.id === currentTool) {
            link.setAttribute('aria-current', 'page');
        }
        links.append(link);
    });

    nav.append(brand, links);
    script.after(nav);

    // On narrow screens the links scroll sideways; keep the current tool in view.
    const active = links.querySelector('[aria-current="page"]');
    if (active) {
        requestAnimationFrame(() => {
            const overflow = links.scrollWidth - links.clientWidth;
            if (overflow > 0) {
                links.scrollLeft = active.offsetLeft - links.offsetLeft - (links.clientWidth - active.offsetWidth) / 2;
            }
        });
    }
})();
