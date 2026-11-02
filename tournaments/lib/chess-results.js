(function (root, factory) {
  const exported = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }

  root.ChessResults = exported;
})(typeof globalThis !== "undefined" ? globalThis : this, (root) => {
  const DEMO_URL =
    "https://s3.chess-results.com/tnr1359649.aspx?lan=1&art=9&fed=LAT&turdet=YES&flag=30&snr=61&SNode=S0";

  const API_BASE_URL = "https://transpose-junkie-outlet.ngrok-free.dev";

  function debugLog(...args) {
    if (typeof console !== "undefined" && typeof console.log === "function") {
      console.log("[EasyChessResults]", ...args);
    }
  }

  function normalizeCell(cell) {
    return cell.textContent.replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function highlightPlayerName(value) {
    const text = String(value || "").trim();
    return text.includes("Zavalnijs") ? `⭐ ${text}` : text;
  }

  function normalizeFideId(fideId) {
    return String(fideId || "").replace(/\D+/g, "");
  }

  function prependBookmarkMarker(value, isBookmarked = false) {
    const text = String(value || "").trim();
    if (!text || !isBookmarked || text.startsWith("🔖 ")) {
      return text;
    }

    return `🔖 ${text}`;
  }

  function detectTrendDirection(value) {
    const text = String(value || "").trim().replace(/\s+/g, "");
    if (!text) {
      return "";
    }

    if (/^[+↑▲]/.test(text)) {
      return "up";
    }

    if (/^[-↓▼]/.test(text)) {
      return "down";
    }

    const numericValue = Number(text.replace(",", "."));
    if (Number.isNaN(numericValue) || numericValue === 0) {
      return "";
    }

    return numericValue > 0 ? "up" : "down";
  }

  function chip(label, value, options = {}) {
    const text = String(value ?? "").trim();
    if (!text) {
      return "";
    }

    const direction = options.direction || "";
    const classes = ["chip"];
    let indicator = "";

    if (direction === "up") {
      classes.push("chip-up");
      indicator = '<span class="chip-indicator" aria-hidden="true">▲</span>';
    } else if (direction === "down") {
      classes.push("chip-down");
      indicator = '<span class="chip-indicator" aria-hidden="true">▼</span>';
    }

    return `<span class="${classes.join(" ")}">${indicator}<span>${escapeHtml(label)}: ${escapeHtml(text)}</span></span>`;
  }

  function buildFideProfileUrl(fideId) {
    const normalizedId = normalizeFideId(fideId);
    return normalizedId ? `https://ratings.fide.com/profile/${normalizedId}` : "";
  }

  function getHeadingText(dialog) {
    const heading = dialog.querySelector("h2");
    return heading ? normalizeCell(heading) : "";
  }

  function cleanHeaderLabel(label, index, sampleCell = null) {
    if (label) {
      return label;
    }

    if (index === 3) {
      return "Title";
    }

    if (sampleCell) {
      const sampleText = normalizeCell(sampleCell);
      if (sampleText && /^(W?FM|W?IM|W?GM|CM|WCM|I|II|III|IV|V|MK|NM|FM|IM|GM|AFM)$/.test(sampleText)) {
        return "Title";
      }
    }

    return `Col ${index + 1}`;
  }

  function shouldKeepTournamentColumn(label) {
    return !["sex", "FED", "TB2", "TB3", "K"].includes(label);
  }

  function isRightAlignedCell(cell) {
    return cell.className.includes("CRr");
  }

  function buildCell({ text = "", href = "", align = "", color = "", raw = "", isNumeric = false } = {}) {
    return { text, href, align, color, raw, isNumeric };
  }

  function displayValue(value, fallback = "") {
    return value === null || value === undefined ? fallback : String(value);
  }

  function buildApiUrl(path, query = {}) {
    const url = new URL(path, `${API_BASE_URL}/`);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined && value !== false) {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }

  function extractChessResultsTarget(inputUrl) {
    let url;
    try {
      url = new URL(normalizeSupportedUrl(inputUrl));
    } catch {
      throw new Error("Enter a valid Chess-Results tournament or player URL.");
    }

    const match = url.pathname.match(/\/tnr(\d+)\.aspx$/i);
    if (!match || !/(^|\.)chess-results\.com$/i.test(url.hostname)) {
      throw new Error("Enter a Chess-Results tournament or player URL.");
    }

    const tournamentId = match[1];
    const article = url.searchParams.get("art") || "1";
    const startNumber = url.searchParams.get("snr") || "";
    const roundText = url.searchParams.get("rd") || "";
    const round = /^\d+$/.test(roundText) && Number(roundText) > 0 ? Number(roundText) : null;

    if (article === "9") {
      if (!/^\d+$/.test(startNumber)) {
        throw new Error("The player URL is missing its numeric snr value.");
      }
      return { kind: "player", tournamentId, startNumber, round: null, sourceUrl: url.toString() };
    }

    if (!["0", "1"].includes(article)) {
      throw new Error("Only tournament ranking and player-result Chess-Results URLs are supported.");
    }

    return { kind: "tournament", tournamentId, startNumber: "", round, sourceUrl: url.toString() };
  }

  function buildTournamentSourceUrl(sourceUrl, tournamentId, round = null) {
    let url;
    try {
      url = new URL(sourceUrl);
    } catch {
      url = new URL(`https://chess-results.com/tnr${tournamentId}.aspx?lan=1`);
    }
    url.searchParams.set("art", "1");
    url.searchParams.delete("snr");
    url.searchParams.delete("_echr_ts");
    if (round) {
      url.searchParams.set("rd", String(round));
    } else {
      url.searchParams.delete("rd");
    }
    return url.toString();
  }

  function buildPlayerSourceUrl(sourceUrl, tournamentId, startNumber) {
    const url = new URL(buildTournamentSourceUrl(sourceUrl, tournamentId));
    url.searchParams.set("art", "9");
    url.searchParams.set("snr", String(startNumber));
    return url.toString();
  }

  function buildTournamentSearchView(response) {
    const tournaments = response?.data || [];
    const columns = [
      { key: "id", label: "DB-Key", align: "center" },
      { key: "name", label: "Tournament" },
      { key: "time-control", label: "Time-control" },
      { key: "start", label: "Start", align: "center" },
      { key: "end", label: "End", align: "center" },
      { key: "federation", label: "FED", align: "center" }
    ];
    const rows = tournaments.map((tournament) => {
      const href = buildTournamentSourceUrl(tournament.source_url, tournament.id);
      const cells = [
        buildCell({ text: displayValue(tournament.id), align: "center" }),
        buildCell({ text: displayValue(tournament.name, "Tournament"), href }),
        buildCell({ text: displayValue(tournament.time_control) }),
        buildCell({ text: displayValue(tournament.starts_on), align: "center" }),
        buildCell({ text: displayValue(tournament.ends_on), align: "center" }),
        buildCell({ text: displayValue(tournament.federation), align: "center" })
      ];
      return {
        cells,
        mobile: {
          topLeft: `DB ${displayValue(tournament.id, "-")}`,
          topRight: displayValue(tournament.ends_on),
          topRightColor: "",
          title: displayValue(tournament.name, "Tournament"),
          titleHref: href,
          details: [
            tournament.time_control ? `Time-control: ${tournament.time_control}` : "",
            tournament.starts_on ? `Start: ${tournament.starts_on}` : "",
            tournament.ends_on ? `End: ${tournament.ends_on}` : "",
            tournament.federation ? `FED: ${tournament.federation}` : ""
          ].filter(Boolean)
        }
      };
    });

    return {
      kind: "search",
      label: "Tournament search",
      title: "Tournament search results",
      subtitle: `${response?.count ?? rows.length} tournaments found`,
      chips: [],
      tournamentLinks: [],
      backUrl: "",
      columns,
      rows,
      sourceUrl: response?.meta?.source_url || ""
    };
  }

  function buildPlayerSearchView(response) {
    const players = response?.data || [];
    const columns = [
      { key: "name", label: "Name" },
      { key: "fide-id", label: "FIDE ID", align: "center" },
      { key: "federation", label: "FED", align: "center" },
      { key: "club", label: "Club" },
      { key: "tournaments", label: "Tournaments", align: "center" },
      { key: "last-seen", label: "Last seen", align: "center" }
    ];
    const rows = players.map((player) => {
      const lastSeen = player.last_seen_at ? String(player.last_seen_at).slice(0, 10) : "";
      const cells = [
        buildCell({ text: displayValue(player.name, "Player") }),
        buildCell({ text: displayValue(player.fide_id), align: "center" }),
        buildCell({ text: displayValue(player.federation), align: "center" }),
        buildCell({ text: displayValue(player.club) }),
        buildCell({ text: displayValue(player.tournament_count), align: "center", isNumeric: true }),
        buildCell({ text: lastSeen, align: "center" })
      ];
      return {
        cells,
        mobile: {
          topLeft: player.federation || "Player",
          topRight: lastSeen,
          topRightColor: "",
          title: displayValue(player.name, "Player"),
          titleHref: "",
          details: [
            player.fide_id ? `FIDE ${player.fide_id}` : "",
            player.club || "",
            `${displayValue(player.tournament_count, "0")} tournaments`
          ].filter(Boolean)
        }
      };
    });

    return {
      kind: "player-search",
      label: "Player search",
      title: "Player search results",
      subtitle: `${response?.count ?? rows.length} indexed players found`,
      chips: [],
      tournamentLinks: [],
      backUrl: "",
      columns,
      rows,
      sourceUrl: ""
    };
  }

  function buildTournamentView(tournamentResponse, standingsResponse, sourceUrl = "") {
    const tournament = tournamentResponse?.data || {};
    const standingsData = standingsResponse?.data || {};
    const standings = standingsData.standings || [];
    const tournamentId = tournament.id || standingsData.tournament_id || extractChessResultsTarget(sourceUrl).tournamentId;
    const canonicalSourceUrl = buildTournamentSourceUrl(
      tournament.source_url || tournamentResponse?.meta?.source_url || standingsResponse?.meta?.source_url || sourceUrl,
      tournamentId,
      standingsData.round
    );
    const columnDefinitions = [
      { key: "rank", label: "Rk.", align: "center", value: (row) => row.rank },
      { key: "start_number", label: "SNo", align: "center", value: (row) => row.start_number },
      { key: "title", label: "Title", value: (row) => row.title },
      { key: "name", label: "Name", value: (row) => row.name },
      { key: "rating", label: "Rtg", align: "right", value: (row) => row.rating },
      { key: "club", label: "Club/City", value: (row) => row.club },
      { key: "points", label: "Pts.", align: "center", value: (row) => row.points_text },
      { key: "group", label: "Typ", align: "center", value: (row) => row.group },
      { key: "tb1", label: "TB1", align: "right", value: (row) => row.tie_breaks?.tb1 }
    ];
    const visibleDefinitions = columnDefinitions.filter(
      (definition) => definition.key === "name" || standings.some((standing) => displayValue(definition.value(standing)) !== "")
    );
    const columns = visibleDefinitions.map(({ key, label, align = "" }) => ({ key, label, align }));
    const rows = standings.map((standing) => {
      const playerHref = standing.start_number
        ? buildPlayerSourceUrl(canonicalSourceUrl, tournamentId, standing.start_number)
        : "";
      const mappedCells = visibleDefinitions.map((definition) => {
        const text = definition.key === "name"
          ? highlightPlayerName(displayValue(definition.value(standing)))
          : displayValue(definition.value(standing));
        return buildCell({
          text,
          href: definition.key === "name" ? playerHref : "",
          align: definition.align || "",
          isNumeric: ["rating", "tb1"].includes(definition.key)
        });
      });
      const lookup = Object.fromEntries(columns.map((column, index) => [column.label, mappedCells[index]]));
      return {
        cells: mappedCells,
        mobile: {
          topLeft: lookup["Rk."]?.text ? `Rank ${lookup["Rk."].text}` : "Rank -",
          topRight: `${lookup["Pts."]?.text || "-"} pts`,
          topRightColor: "",
          title: lookup.Name?.text || "-",
          titleHref: playerHref,
          details: [
            [lookup.Rtg?.text || "-", lookup["Club/City"]?.text || "-"].join(" · "),
            [lookup.SNo?.text ? `SNo ${lookup.SNo.text}` : "", lookup.Title?.text, lookup.Typ?.text ? `Typ ${lookup.Typ.text}` : ""]
              .filter(Boolean)
              .join(" · ")
          ].filter(Boolean)
        }
      };
    });
    const dateText = tournament.date_text || [tournament.starts_on, tournament.ends_on].filter(Boolean).join(" – ");
    const roundLinks = (tournament.available_standing_rounds || []).map((round) => ({
      label: `Rd.${round}`,
      href: buildTournamentSourceUrl(canonicalSourceUrl, tournamentId, round)
    }));

    return {
      kind: "tournament",
      label: "Tournament",
      title: tournament.name || `Tournament ${tournamentId}`,
      subtitle: standingsData.heading || "Standings",
      chips: [
        { label: "FED", value: tournament.federation },
        { label: "Rounds", value: tournament.round_count },
        { label: "Type", value: tournament.tournament_type },
        { label: "Control", value: tournament.time_control },
        { label: "Date", value: dateText },
        { label: "Updated", value: tournament.last_upstream_update }
      ].filter((entry) => displayValue(entry.value) !== ""),
      tournamentLinks: roundLinks,
      backUrl: "",
      columns,
      rows,
      sourceUrl: canonicalSourceUrl
    };
  }

  function formatRatingChange(value) {
    if (value === null || value === undefined || value === "") {
      return "";
    }
    const number = Number(value);
    if (Number.isNaN(number)) {
      return String(value);
    }
    return `${number > 0 ? "+" : ""}${number}`;
  }

  function buildPlayerView(participantResponse, resultsResponse, sourceUrl = "", parentUrl = "") {
    const participant = participantResponse?.data || {};
    const results = resultsResponse?.data || {};
    const tournamentId = participant.tournament_id || results.tournament_id;
    const startNumber = participant.start_number || results.start_number;
    const canonicalSourceUrl = buildPlayerSourceUrl(
      participantResponse?.meta?.source_url || resultsResponse?.meta?.source_url || sourceUrl,
      tournamentId,
      startNumber
    );
    const tournamentUrl = parentUrl || buildTournamentSourceUrl(canonicalSourceUrl, tournamentId);
    const columns = [
      { key: "round", label: "Rd", align: "center" },
      { key: "board", label: "Bo", align: "center" },
      { key: "title", label: "Title" },
      { key: "name", label: "Name" },
      { key: "rating", label: "Rtg", align: "right" },
      { key: "club", label: "Club" },
      { key: "points", label: "Pts", align: "center" },
      { key: "color", label: "Clr", align: "center" },
      { key: "result", label: "Res", align: "center" }
    ];
    const rows = (results.games || []).map((game) => {
      const opponentHref = game.opponent_start_number
        ? buildPlayerSourceUrl(canonicalSourceUrl, tournamentId, game.opponent_start_number)
        : "";
      const color = game.color || "";
      const opponentName = highlightPlayerName(displayValue(game.opponent_name, "-"));
      const resultText = displayValue(game.source_result_text || game.result, "-");
      return {
        cells: [
          buildCell({ text: displayValue(game.round), align: "center" }),
          buildCell({ text: displayValue(game.board), align: "center" }),
          buildCell({ text: displayValue(game.opponent_title) }),
          buildCell({ text: opponentName, href: opponentHref }),
          buildCell({ text: displayValue(game.opponent_rating), align: "right", isNumeric: true }),
          buildCell({ text: displayValue(game.opponent_club) }),
          buildCell({ text: displayValue(game.opponent_points), align: "center", isNumeric: true }),
          buildCell({ text: color ? color[0].toUpperCase() : "", align: "center", color, raw: color || "empty-color" }),
          buildCell({ text: resultText, align: "center" })
        ],
        mobile: {
          topLeft: `Rd ${displayValue(game.round, "-")} · Bo ${displayValue(game.board, "-")}`,
          topRight: resultText,
          topRightColor: color,
          title: `${game.opponent_title ? `${game.opponent_title} ` : ""}${opponentName}`,
          titleHref: opponentHref,
          details: [
            [displayValue(game.opponent_rating, "-"), displayValue(game.opponent_points, "-")].join(" · "),
            displayValue(game.opponent_club, "Club -")
          ]
        }
      };
    });
    const ratingChange = formatRatingChange(participant.rating_change);

    return {
      kind: "player",
      label: "Player",
      title: highlightPlayerName(participant.name || results.player?.name || "Unknown player"),
      subtitle: "",
      fideId: normalizeFideId(participant.fide_id || results.player?.fide_id),
      fideUrl: buildFideProfileUrl(participant.fide_id || results.player?.fide_id),
      chips: [
        { label: "Title", value: participant.title },
        { label: "Rank", value: participant.rank ?? results.player?.rank },
        { label: "Points", value: participant.points ?? results.player?.points },
        { label: "FIDE +/-", value: ratingChange, direction: detectTrendDirection(ratingChange) },
        { label: "Performance", value: participant.performance_rating },
        { label: "FED", value: participant.federation },
        { label: "Club", value: participant.club }
      ].filter((entry) => displayValue(entry.value) !== ""),
      backUrl: tournamentUrl,
      columns,
      rows,
      sourceUrl: canonicalSourceUrl
    };
  }

  function readQueryState(search) {
    const params = new URLSearchParams(search);
    return {
      url: params.get("url") || "",
      parent: params.get("parent") || "",
      searchFrom: params.get("searchFrom") || "",
      searchTo: params.get("searchTo") || "",
      playerFirstName: params.get("playerFirstName") || "",
      playerLastName: params.get("playerLastName") || "",
      playerCountry: params.get("playerCountry") || ""
    };
  }

  function createAppUrl(baseHref, { url = "", parent = "", searchFrom = "", searchTo = "", playerFirstName = "", playerLastName = "", playerCountry = "" } = {}) {
    const nextUrl = new URL(baseHref);

    for (const key of ["url", "parent", "searchCountry", "searchFrom", "searchTo", "playerFirstName", "playerLastName", "playerCountry"]) {
      nextUrl.searchParams.delete(key);
    }

    if (url) {
      nextUrl.searchParams.set("url", url);
    }

    if (parent) {
      nextUrl.searchParams.set("parent", parent);
    }

    if (!url) {
      if (searchFrom) {
        nextUrl.searchParams.set("searchFrom", searchFrom);
      }
      if (searchTo) {
        nextUrl.searchParams.set("searchTo", searchTo);
      }
      if (playerFirstName) {
        nextUrl.searchParams.set("playerFirstName", playerFirstName);
      }
      if (playerLastName) {
        nextUrl.searchParams.set("playerLastName", playerLastName);
      }
      if (playerCountry) {
        nextUrl.searchParams.set("playerCountry", playerCountry);
      }
    }

    return nextUrl.toString();
  }

  function writeQueryState(historyObject, baseHref, nextState, mode = "replace") {
    const nextUrl = createAppUrl(baseHref, nextState);
    if (mode === "push") {
      historyObject.pushState({}, "", nextUrl);
      return nextUrl;
    }

    historyObject.replaceState({}, "", nextUrl);
    return nextUrl;
  }

  function buildInternalPageUrl(baseHref, url, parent = "") {
    return createAppUrl(baseHref, { url, parent });
  }

  function normalizeSupportedUrl(inputUrl) {
    try {
      const nextUrl = new URL(inputUrl);
      if (/chess-results\.com$/i.test(nextUrl.hostname) || /\.chess-results\.com$/i.test(nextUrl.hostname)) {
        nextUrl.searchParams.set("lan", "1");
      }
      if (nextUrl.searchParams.get("art") === "0") {
        nextUrl.searchParams.set("art", "1");
      }
      return nextUrl.toString();
    } catch {
      return inputUrl;
    }
  }

  function appendCacheBustParam(inputUrl, cacheBustToken = "") {
    if (!cacheBustToken) {
      return inputUrl;
    }

    try {
      const nextUrl = new URL(inputUrl);
      nextUrl.searchParams.set("_echr_ts", String(cacheBustToken));
      return nextUrl.toString();
    } catch {
      return inputUrl;
    }
  }

  function inferTournamentUrlFromPlayerUrl(inputUrl) {
    try {
      const nextUrl = new URL(inputUrl);
      if (!/\/tnr\d+\.aspx$/i.test(nextUrl.pathname) || nextUrl.searchParams.get("art") !== "9") {
        return "";
      }

      nextUrl.searchParams.set("art", "1");
      nextUrl.searchParams.delete("snr");
      nextUrl.searchParams.delete("_echr_ts");
      return nextUrl.toString();
    } catch {
      return "";
    }
  }

  function resolveLinkedUrl(href, sourceUrl) {
    if (!href) {
      return "";
    }

    return new URL(href, sourceUrl || "https://chess-results.com").href;
  }

  function extractColor(cell) {
    if (cell.querySelector(".FarbewT")) {
      return "white";
    }

    if (cell.querySelector(".FarbesT")) {
      return "black";
    }

    return "";
  }

  function parsePlayerPage(doc, sourceUrl = "") {
    const dialogs = [...doc.querySelectorAll(".defaultDialog")];
    debugLog("parsePlayerPage: dialog headings", dialogs.map((dialog) => getHeadingText(dialog)));
    const playerDialog = dialogs.find((dialog) => getHeadingText(dialog).toLowerCase() === "player info");

    if (!playerDialog) {
      throw new Error("Could not find the 'Player info' section in the provided HTML.");
    }

    const tables = playerDialog.querySelectorAll("table");
    if (tables.length < 1) {
      throw new Error("Could not find the player info table inside the player section.");
    }

    const infoTable = tables[0];
    const opponentsTable = tables[1] || null;
    const meta = {};

    for (const row of infoTable.querySelectorAll("tr")) {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 2) {
        meta[normalizeCell(cells[0])] = normalizeCell(cells[1]);
      }
    }

    const columns = [
      { key: "round", label: "Rd", align: "center" },
      { key: "board", label: "Bo", align: "center" },
      { key: "title", label: "Title" },
      { key: "name", label: "Name" },
      { key: "rating", label: "Rtg", align: "right" },
      { key: "club", label: "Club" },
      { key: "points", label: "Pts", align: "center" },
      { key: "color", label: "Clr", align: "center" },
      { key: "result", label: "Res", align: "center" }
    ];

    const rows = [];
    if (opponentsTable) {
      for (const row of opponentsTable.querySelectorAll("tr")) {
        if (row.querySelector("th")) {
          continue;
        }

        const cells = [...row.children];
        if (cells.length < 9) {
          continue;
        }

        const hasClubColumn = cells.length >= 10;
        const link = cells[4].querySelector("a");
        const url = resolveLinkedUrl(link?.getAttribute("href"), sourceUrl);
        const clubCellIndex = hasClubColumn ? 7 : -1;
        const pointsCellIndex = hasClubColumn ? 8 : 7;
        const resultCellIndex = hasClubColumn ? 9 : 8;
        const color = extractColor(cells[resultCellIndex]);

        rows.push({
          cells: [
            buildCell({ text: normalizeCell(cells[0]), align: "center" }),
            buildCell({ text: normalizeCell(cells[1]), align: "center" }),
            buildCell({ text: normalizeCell(cells[3]) }),
            buildCell({ text: highlightPlayerName(normalizeCell(cells[4])), href: url }),
            buildCell({ text: normalizeCell(cells[5]), align: "right", isNumeric: true }),
            buildCell({ text: hasClubColumn ? normalizeCell(cells[clubCellIndex]) : "" }),
            buildCell({ text: normalizeCell(cells[pointsCellIndex]), align: "center", isNumeric: true }),
            buildCell({ text: color ? color[0].toUpperCase() : "", align: "center", color, raw: color || "empty-color" }),
            buildCell({ text: normalizeCell(cells[resultCellIndex]), align: "center" })
          ],
          mobile: {
            topLeft: `Rd ${normalizeCell(cells[0]) || "-"} · Bo ${normalizeCell(cells[1]) || "-"}`,
            topRight: normalizeCell(cells[resultCellIndex]) || "-",
            topRightColor: color,
            title: highlightPlayerName(`${normalizeCell(cells[3]) ? `${normalizeCell(cells[3])} ` : ""}${normalizeCell(cells[4]) || "-"}`),
            titleHref: url,
            details: [
              [normalizeCell(cells[5]) || "-", normalizeCell(cells[pointsCellIndex]) || "-"].join(" · "),
              hasClubColumn ? normalizeCell(cells[clubCellIndex]) || "-" : "Club -"
            ]
          }
        });
      }
    }

    debugLog("parsePlayerPage: parsed rows", rows.length, "title", meta.Name || "Unknown player");

    return {
      kind: "player",
      label: "Player",
      title: highlightPlayerName(meta.Name) || "Unknown player",
      subtitle: "",
      fideId: normalizeFideId(meta["Fide-ID"]),
      fideUrl: buildFideProfileUrl(meta["Fide-ID"]),
      chips: [
        { label: "Title", value: meta.Title },
        { label: "Rank", value: meta.Rank },
        { label: "Points", value: meta.Points },
        {
          label: "FIDE +/-",
          value: meta["FIDE rtg +/-"],
          direction: detectTrendDirection(meta["FIDE rtg +/-"])
        },
        { label: "Performance", value: meta["Performance rating"] },
        { label: "FED", value: meta.Federation },
        { label: "Club", value: meta["Club/City"] }
      ].filter((entry) => entry.value),
      backUrl: inferTournamentUrlFromPlayerUrl(sourceUrl),
      columns,
      rows
    };
  }

  function parseTournamentMeta(dialog) {
    const meta = {};

    for (const row of dialog.querySelectorAll("tr")) {
      const cells = row.querySelectorAll(":scope > td");
      if (cells.length >= 2) {
        const key = normalizeCell(cells[0]);
        const value = normalizeCell(cells[1]);
        if (key && value) {
          meta[key] = value;
        }
      }
    }

    const updateNode = dialog.querySelector(".CRsmall");
    if (updateNode) {
      const updateText = normalizeCell(updateNode);
      const updateMatch = updateText.match(/Last update\s+(.*?)(?:,\s*Creator\/Last Upload:|$)/i);
      if (updateMatch?.[1]) {
        meta["Last update"] = updateMatch[1].trim();
      }
    }

    return meta;
  }

  function isFlagColumn(sampleCell) {
    if (!sampleCell) {
      return false;
    }

    const hasFlagMarker = !!sampleCell.querySelector('div[class*="tn_"]');
    return hasFlagMarker && !normalizeCell(sampleCell);
  }

  function parseTournamentColumns(headerCells, sampleRowCells = []) {
    const keptIndexes = [];
    const columns = [];

    headerCells.forEach((cell, index) => {
      const label = cleanHeaderLabel(
        normalizeCell(cell).replace(/\u00a0/g, " ").trim(),
        index,
        sampleRowCells[index] || null
      );
      if (!label || !shouldKeepTournamentColumn(label)) {
        return;
      }

      if (label.startsWith("Col ") && isFlagColumn(sampleRowCells[index])) {
        return;
      }

      keptIndexes.push(index);
      columns.push({
        key: `col-${index}`,
        label,
        align: cell.className.includes("CRc") ? "center" : cell.className.includes("CRr") ? "right" : ""
      });
    });

    return { keptIndexes, columns };
  }

  function getAnchorContextText(anchor) {
    let node = anchor?.parentElement || null;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      const text = normalizeCell(node).toLowerCase();
      if (text) {
        return text;
      }
    }

    return "";
  }

  function parseTournamentRoundLinks(doc, sourceUrl = "") {
    const anchors = [...doc.querySelectorAll("a")];
    const seen = new Set();

    return anchors
      .map((anchor) => {
        const label = normalizeCell(anchor);
        const href = resolveLinkedUrl(anchor.getAttribute("href"), sourceUrl);
        const contextText = getAnchorContextText(anchor);
        const isRankingContext =
          contextText.includes("ranking list after") ||
          contextText.includes("ranking after") ||
          contextText.includes("rank after round");
        const isRoundLabel = /^rd\.?\s*\d+(?:\/\d+)?$/i.test(label);
        const isExplicitRankingLabel = /ranking(?:\s+list)?\s+after/i.test(label);

        if (!href || (!isExplicitRankingLabel && !(isRankingContext && isRoundLabel))) {
          return null;
        }

        const normalizedLabel = isRoundLabel ? label.replace(/\s+/g, "") : label;
        const key = `${normalizedLabel}|${href}`;
        if (seen.has(key)) {
          return null;
        }

        seen.add(key);
        return {
          label: normalizedLabel,
          href
        };
      })
      .filter(Boolean);
  }

  function isTournamentRankingDialog(dialog) {
    const rankingTable = dialog.querySelector("table.CRs1");
    if (!rankingTable) {
      return false;
    }

    const heading = getHeadingText(dialog).toLowerCase();
    if (
      heading.includes("ranking") ||
      heading.includes("rank after round") ||
      heading.includes("starting rank")
    ) {
      return true;
    }

    const headerLabels = [...rankingTable.querySelectorAll("tr th")].map((cell) => normalizeCell(cell));
    return headerLabels.includes("Name") && (headerLabels.includes("Pts.") || headerLabels.includes("Rtg"));
  }

  function firstAvailableCell(lookup, labels) {
    for (const label of labels) {
      if (lookup[label]) {
        return lookup[label];
      }
    }

    return null;
  }

  function buildTournamentMobileSummary(columns, mappedCells) {
    return columns
      .slice(0, 5)
      .map((column, index) => {
        const value = mappedCells[index]?.text || "";
        if (!value || ["Rk.", "Name"].includes(column.label)) {
          return "";
        }

        return `${column.label} ${value}`;
      })
      .filter(Boolean)
      .join(" · ");
  }

  function parseTournamentPage(doc, sourceUrl = "") {
    const dialogs = [...doc.querySelectorAll(".defaultDialog")];
    const dialogHeadings = dialogs.map((dialog) => getHeadingText(dialog));
    debugLog("parseTournamentPage: dialog headings", dialogHeadings);
    const rankingDialog = dialogs.find((dialog) => isTournamentRankingDialog(dialog));

    if (!rankingDialog) {
      throw new Error(
        `Could not find a tournament ranking table in the provided HTML. Headings seen: ${dialogHeadings.join(" | ")}`
      );
    }

    const metaDialog = dialogs.find((dialog) => dialog !== rankingDialog && getHeadingText(dialog) && dialog.querySelector("table"));
    if (!metaDialog) {
      throw new Error(
        `Could not find the tournament details section in the provided HTML. Headings seen: ${dialogHeadings.join(" | ")}`
      );
    }

    const meta = parseTournamentMeta(metaDialog);
    const tournamentLinks = parseTournamentRoundLinks(doc, sourceUrl);
    const rankingTable = rankingDialog.querySelector("table.CRs1");
    const headerRow = rankingTable.querySelector("tr");
    const headerCells = [...headerRow.children];
    const sampleDataRow = [...rankingTable.querySelectorAll("tr")].find((row) => !row.querySelector("th"));
    const sampleRowCells = sampleDataRow ? [...sampleDataRow.children] : [];
    const { keptIndexes, columns } = parseTournamentColumns(headerCells, sampleRowCells);
    debugLog("parseTournamentPage: selected ranking heading", getHeadingText(rankingDialog));
    debugLog("parseTournamentPage: selected meta heading", getHeadingText(metaDialog));
    debugLog("parseTournamentPage: header labels", headerCells.map((cell) => normalizeCell(cell)));
    debugLog("parseTournamentPage: sample row", sampleRowCells.map((cell) => normalizeCell(cell)));
    debugLog("parseTournamentPage: kept column labels", columns.map((column) => column.label));
    const rows = [];

    for (const row of rankingTable.querySelectorAll("tr")) {
      if (row.querySelector("th")) {
        continue;
      }

      const cells = [...row.children];
      if (cells.length < headerCells.length) {
        continue;
      }

      const mappedCells = keptIndexes.map((sourceIndex, mappedIndex) => {
        const cell = cells[sourceIndex];
        const link = cell.querySelector("a");
        const href = resolveLinkedUrl(link?.getAttribute("href"), sourceUrl);
        const text = normalizeCell(cell);

        return buildCell({
          text,
          href,
          align: columns[mappedIndex]?.align || (isRightAlignedCell(cell) ? "right" : ""),
          isNumeric: isRightAlignedCell(cell)
        });
      });

      const lookup = Object.fromEntries(columns.map((column, index) => [column.label, mappedCells[index]]));
      if (lookup.Name) {
        lookup.Name.text = highlightPlayerName(lookup.Name.text);
      }
      const rankCell = firstAvailableCell(lookup, ["Rk.", "No."]);
      const scoreCell = firstAvailableCell(lookup, ["Pts.", "Rtg"]);
      const scoreSuffix = lookup["Pts."] ? " pts" : lookup.Rtg ? " rtg" : "";

      rows.push({
        cells: mappedCells,
        mobile: {
          topLeft: `${rankCell?.text ? `${rankCell === lookup["No."] ? "No." : "Rank"} ${rankCell.text}` : "Rank -"}`,
          topRight: `${scoreCell?.text || "-"}${scoreSuffix}`,
          topRightColor: "",
          title: lookup.Name?.text || "-",
          titleHref: lookup.Name?.href || "",
          details: [
            [lookup.Rtg?.text || "-", lookup["Club/City"]?.text || "-"].join(" · "),
            buildTournamentMobileSummary(columns, mappedCells)
          ].filter(Boolean)
        }
      });
    }

    debugLog("parseTournamentPage: parsed rows", rows.length, "title", getHeadingText(metaDialog) || "Tournament");

    return {
      kind: "tournament",
      label: "Tournament",
      title: getHeadingText(metaDialog) || "Tournament",
      subtitle: getHeadingText(rankingDialog),
      chips: [
        { label: "FED", value: meta.Federation },
        { label: "Rounds", value: meta["Number of rounds"] },
        { label: "Type", value: meta["Tournament type"] },
        { label: "Control", value: meta["Time control (Rapid)"] || meta["Time control"] },
        { label: "Date", value: meta.Date },
        { label: "Updated", value: meta["Last update"] }
      ].filter((entry) => entry.value),
      tournamentLinks,
      backUrl: "",
      columns,
      rows
    };
  }

  function buildTournamentSearchPayload({ country = "-", dateFrom = "", dateTo = "", hiddenFields = {} } = {}) {
    const payload = new URLSearchParams(hiddenFields);
    payload.set("ctl00$P1$combo_art", "5");
    payload.set("ctl00$P1$combo_sort", "3");
    payload.set("ctl00$P1$combo_land", country || "-");
    payload.set("ctl00$P1$combo_bedenkzeit", "0");
    payload.set("ctl00$P1$combo_anzahl_zeilen", "0");
    if (dateFrom) {
      payload.set("ctl00$P1$txt_von_tag", dateFrom);
    }
    if (dateTo) {
      payload.set("ctl00$P1$txt_bis_tag", dateTo);
    }
    payload.set("ctl00$P1$cb_suchen", "Search");
    payload.delete("ctl00$P1$cb_download_Excel");
    return payload;
  }

  function buildPlayerSearchPayload({ firstName = "", lastName = "", country = "LAT", hiddenFields = {} } = {}) {
    const payload = new URLSearchParams(hiddenFields);
    payload.set("ctl00$P1$txt_nachname", String(lastName || "").trim());
    payload.set("ctl00$P1$txt_vorname", String(firstName || "").trim());
    payload.set("ctl00$P1$txt_FED", String(country || "LAT").trim().toUpperCase() || "LAT");
    payload.set("ctl00$P1$combo_Sort", "0");
    payload.set("ctl00$P1$combo_anzahl_zeilen", "1");
    payload.set("ctl00$P1$cb_suchen", "Search");
    payload.delete("ctl00$P1$cb_download_Excel");
    return payload;
  }

  function isTournamentLinkHref(href = "") {
    return /(^|\/)tnr\d+\.aspx/i.test(String(href));
  }

  function hasTournamentLink(element) {
    return [...element.querySelectorAll("a[href]")].some((link) => isTournamentLinkHref(link.getAttribute("href")));
  }

  function getTournamentLink(element) {
    return [...element.querySelectorAll("a[href]")].find((link) => isTournamentLinkHref(link.getAttribute("href"))) || null;
  }

  function getDirectTournamentLink(cell) {
    return [...cell.querySelectorAll("a[href]")].find((link) => link.closest("td,th") === cell && isTournamentLinkHref(link.getAttribute("href"))) || null;
  }

  function rowHasDirectTournamentLink(row) {
    return [...row.children].some((cell) => getDirectTournamentLink(cell));
  }

  function getDirectTableRows(table) {
    const rows = [];
    for (const child of table.children) {
      const tagName = child.tagName.toUpperCase();
      if (tagName === "TR") {
        rows.push(child);
      } else if (["TBODY", "THEAD", "TFOOT"].includes(tagName)) {
        rows.push(...[...child.children].filter((row) => row.tagName.toUpperCase() === "TR"));
      }
    }
    return rows;
  }

  function isTournamentSearchResultsTable(table) {
    const directRows = getDirectTableRows(table);
    const headerRow = directRows.find((row) => row.querySelector("th, td"));
    const headerText = [...(headerRow?.children || [])].map((cell) => normalizeCell(cell));
    const hasTournamentHeader = headerText.some((text) => /tournament/i.test(text));
    const hasDirectTournamentLink = directRows.some((row) => rowHasDirectTournamentLink(row));
    return hasTournamentHeader && hasDirectTournamentLink;
  }

  function stripTags(html = "") {
    return String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function pickSearchMobileTopRight(columns, mappedCells, tournamentColumnIndex) {
    const patterns = [/last.?update|update/i, /^to$|^end$|^bis$/i, /^from$|^start|^begin|^von$/i];
    for (const pattern of patterns) {
      const index = columns.findIndex((column, idx) => idx !== tournamentColumnIndex && pattern.test(column.label || ""));
      if (index === -1) {
        continue;
      }
      const text = mappedCells[index]?.text || "";
      if (text) {
        return text;
      }
    }
    const fallback = mappedCells[columns.length - 1]?.text || "";
    return /^\d+$/.test(fallback) ? "" : fallback;
  }

  function buildSearchMobileDetails(columns, mappedCells, tournamentColumnIndex) {
    const importantPatterns = [
      /time.?control|zeit/i,
      /^from$|^start|^begin|^von$/i,
      /^to$|^end$|^bis$/i,
      /^fed(eration)?$/i
    ];
    const seenLabels = new Set();
    const details = [];
    importantPatterns.forEach((pattern) => {
      const match = columns.findIndex((column, index) => {
        if (index === tournamentColumnIndex) {
          return false;
        }
        const label = column.label || "";
        if (seenLabels.has(label.toLowerCase())) {
          return false;
        }
        return pattern.test(label);
      });
      if (match === -1) {
        return;
      }
      const text = mappedCells[match]?.text || "";
      if (!text) {
        return;
      }
      seenLabels.add(columns[match].label.toLowerCase());
      details.push(`${columns[match].label}: ${text}`);
    });
    return details;
  }

  function parseTournamentSearchPageWithoutDom(html, sourceUrl) {
    const tableMatches = String(html).match(/<table[\s\S]*?<\/table>/gi) || [];
    const tableHtml = tableMatches.find((table) => /href=["'][^"']*\/?tnr\d+\.aspx/i.test(table) && /tournament/i.test(stripTags(table))) || "";
    if (!tableHtml) {
      throw new Error("Could not find tournament search results in the Chess-Results response.");
    }
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const headerHtml = rowMatches.find((row) => /<th/i.test(row)) || rowMatches[0] || "";
    const readCells = (rowHtml) => (rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []);
    const columns = readCells(headerHtml).map((cellHtml, index) => ({
      key: `search-${index}`,
      label: stripTags(cellHtml) || `Col ${index + 1}`,
      align: /class=["'][^"']*CRc/i.test(cellHtml) ? "center" : /class=["'][^"']*CRr/i.test(cellHtml) ? "right" : ""
    }));
    const tournamentColumnIndex = columns.findIndex((column) => /tournament/i.test(column.label));
    const rows = rowMatches
      .filter((row) => row !== headerHtml && !/<th/i.test(row))
      .map((row) => readCells(row))
          .filter((cells) => cells.some((cellHtml) => /href=["'][^"']*\/?tnr\d+\.aspx/i.test(cellHtml)))
      .map((cells) => {
        const mappedCells = columns.map((column, index) => {
          const cellHtml = cells[index] || cells[cells.length - 1] || "";
          const hrefMatch = cellHtml.match(/href=["']([^"']*tnr[^"']*)["']/i);
          return buildCell({
            text: stripTags(cellHtml),
            href: resolveLinkedUrl(hrefMatch?.[1]?.replaceAll("&amp;", "&"), sourceUrl),
            align: column.align
          });
        });
        const titleCell = mappedCells[tournamentColumnIndex] || mappedCells.find((cell) => cell.href) || mappedCells[1] || mappedCells[0];
        return {
          cells: mappedCells,
          mobile: {
            topLeft: mappedCells[0]?.text ? `DB ${mappedCells[0].text}` : "Tournament",
            topRight: pickSearchMobileTopRight(columns, mappedCells, tournamentColumnIndex),
            topRightColor: "",
            title: titleCell?.text || "Tournament",
            titleHref: titleCell?.href || "",
            details: buildSearchMobileDetails(columns, mappedCells, tournamentColumnIndex)
          }
        };
      });
    return { kind: "search", label: "Tournament search", title: "Tournament search results", subtitle: `${rows.length} tournaments found`, chips: [], tournamentLinks: [], backUrl: "", columns, rows };
  }

  function parsePlayerSearchPageWithoutDom(html, sourceUrl) {
    const tableMatches = String(html).match(/<table[\s\S]*?<\/table>/gi) || [];
    const tableHtml = tableMatches.find((table) => /fideid/i.test(stripTags(table)) && /tournament/i.test(stripTags(table)) && /href=["'][^"']*\/?tnr\d+\.aspx/i.test(table)) || "";
    if (!tableHtml) {
      throw new Error("Could not find player search results in the Chess-Results response.");
    }
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const readCells = (rowHtml) => rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
    const headerHtml = rowMatches.find((row) => /<th/i.test(row)) || rowMatches[0] || "";
    const columns = readCells(headerHtml).map((cellHtml, index) => ({
      key: `player-search-${index}`,
      label: stripTags(cellHtml) || `Col ${index + 1}`,
      align: /class=["'][^"']*CRc/i.test(cellHtml) ? "center" : /class=["'][^"']*CRr/i.test(cellHtml) ? "right" : ""
    }));
    const nameColumnIndex = columns.findIndex((column) => column.label === "Name");
    const tournamentColumnIndex = columns.findIndex((column) => column.label === "Tournament");
    const rows = rowMatches
      .filter((row) => row !== headerHtml && !/<th/i.test(row))
      .map((row) => readCells(row))
      .filter((cells) => cells.length && cells.some((cellHtml) => /href=["'][^"']*\/?tnr\d+\.aspx/i.test(cellHtml)))
      .map((cells) => {
        const mappedCells = columns.map((column, index) => {
          const cellHtml = cells[index] || cells[cells.length - 1] || "";
          const hrefMatch = cellHtml.match(/href=["']([^"']*tnr[^"']*)["']/i);
          return buildCell({
            text: stripTags(cellHtml),
            href: resolveLinkedUrl(hrefMatch?.[1]?.replaceAll("&amp;", "&"), sourceUrl),
            align: column.align
          });
        });
        const nameCell = mappedCells[nameColumnIndex] || mappedCells.find((cell) => cell.href) || mappedCells[0];
        const tournamentCell = mappedCells[tournamentColumnIndex];
        return {
          cells: mappedCells,
          mobile: {
            topLeft: tournamentCell?.text || "Tournament",
            topRight: mappedCells.find((cell, index) => columns[index]?.label === "End-Date")?.text || "",
            topRightColor: "",
            title: nameCell?.text || "Player",
            titleHref: nameCell?.href || "",
            details: [mappedCells.find((cell, index) => columns[index]?.label === "FED")?.text || "", tournamentCell?.text || ""].filter(Boolean)
          }
        };
      });
    return { kind: "player-search", label: "Player search", title: "Player search results", subtitle: `${rows.length} player entries found`, chips: [], tournamentLinks: [], backUrl: "", columns, rows };
  }

  function parsePlayerSearchPage(html, sourceUrl = "https://s2.chess-results.com/SpielerSuche.aspx?lan=1") {
    if (typeof root.DOMParser !== "function") {
      return parsePlayerSearchPageWithoutDom(html, sourceUrl);
    }

    const parser = new root.DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const table = [...doc.querySelectorAll("table")].find((candidate) => {
      const directRows = getDirectTableRows(candidate);
      const headerRow = directRows.find((row) => row.querySelector("th, td"));
      const headerText = [...(headerRow?.children || [])].map((cell) => normalizeCell(cell));
      return headerText.includes("Name") && headerText.includes("Tournament") && headerText.includes("FideID");
    });
    if (!table) {
      throw new Error("Could not find player search results in the Chess-Results response.");
    }

    const allRows = getDirectTableRows(table);
    const headerRow = allRows.find((row) => row.querySelector("th")) || allRows[0];
    const headerCells = [...headerRow.children];
    const columns = headerCells.map((cell, index) => ({
      key: `player-search-${index}`,
      label: normalizeCell(cell) || `Col ${index + 1}`,
      align: cell.className.includes("CRc") ? "center" : cell.className.includes("CRr") ? "right" : ""
    }));
    const nameColumnIndex = columns.findIndex((column) => column.label === "Name");
    const tournamentColumnIndex = columns.findIndex((column) => column.label === "Tournament");
    const rows = [];

    for (const row of allRows) {
      if (row === headerRow || row.querySelector("th")) {
        continue;
      }
      const cells = [...row.children];
      if (!cells.length) {
        continue;
      }

      const mappedCells = columns.map((column, index) => {
        const cell = cells[index] || cells[cells.length - 1];
        const link = getDirectTournamentLink(cell);
        return buildCell({
          text: normalizeCell(cell || { textContent: "" }),
          href: resolveLinkedUrl(link?.getAttribute("href"), sourceUrl),
          align: column.align || (cell && isRightAlignedCell(cell) ? "right" : "")
        });
      });
      const nameCell = mappedCells[nameColumnIndex] || mappedCells.find((cell) => cell.href) || mappedCells[0];
      const tournamentCell = mappedCells[tournamentColumnIndex];
      rows.push({
        cells: mappedCells,
        mobile: {
          topLeft: tournamentCell?.text || "Tournament",
          topRight: mappedCells.find((cell, index) => columns[index]?.label === "End-Date")?.text || "",
          topRightColor: "",
          title: nameCell?.text || "Player",
          titleHref: nameCell?.href || "",
          details: [mappedCells.find((cell, index) => columns[index]?.label === "FED")?.text || "", tournamentCell?.text || ""].filter(Boolean)
        }
      });
    }

    return { kind: "player-search", label: "Player search", title: "Player search results", subtitle: `${rows.length} player entries found`, chips: [], tournamentLinks: [], backUrl: "", columns, rows };
  }

  function parseTournamentSearchPage(html, sourceUrl = "https://s2.chess-results.com/turniersuche.aspx?lan=1") {
    if (typeof root.DOMParser !== "function") {
      return parseTournamentSearchPageWithoutDom(html, sourceUrl);
    }

    const parser = new root.DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const table = [...doc.querySelectorAll("table")].find((candidate) => isTournamentSearchResultsTable(candidate));
    if (!table) {
      throw new Error("Could not find tournament search results in the Chess-Results response.");
    }

    const allRows = getDirectTableRows(table);
    const headerRow = allRows.find((row) => row.querySelector("th")) || allRows[0];
    const headerCells = [...headerRow.children];
    const columns = headerCells.map((cell, index) => ({
      key: `search-${index}`,
      label: normalizeCell(cell) || `Col ${index + 1}`,
      align: cell.className.includes("CRc") ? "center" : cell.className.includes("CRr") ? "right" : ""
    }));
    const tournamentColumnIndex = columns.findIndex((column) => /tournament/i.test(column.label));
    const rows = [];

    for (const row of allRows) {
      if (row === headerRow || row.querySelector("th")) {
        continue;
      }
      const cells = [...row.children];
      if (!cells.length || !rowHasDirectTournamentLink(row)) {
        continue;
      }

      const mappedCells = columns.map((column, index) => {
        const cell = cells[index] || cells[cells.length - 1];
        const link = getDirectTournamentLink(cell);
        return buildCell({
          text: normalizeCell(cell || { textContent: "" }),
          href: resolveLinkedUrl(link?.getAttribute("href"), sourceUrl),
          align: column.align || (cell && isRightAlignedCell(cell) ? "right" : "")
        });
      });
      const titleCell = mappedCells[tournamentColumnIndex] || mappedCells.find((cell) => cell.href) || mappedCells[1] || mappedCells[0];
      rows.push({
        cells: mappedCells,
        mobile: {
          topLeft: mappedCells[0]?.text ? `DB ${mappedCells[0].text}` : "Tournament",
          topRight: pickSearchMobileTopRight(columns, mappedCells, tournamentColumnIndex),
          topRightColor: "",
          title: titleCell?.text || "Tournament",
          titleHref: titleCell?.href || "",
          details: buildSearchMobileDetails(columns, mappedCells, tournamentColumnIndex)
        }
      });
    }

    return {
      kind: "search",
      label: "Tournament search",
      title: "Tournament search results",
      subtitle: `${rows.length} tournaments found`,
      chips: [],
      tournamentLinks: [],
      backUrl: "",
      columns,
      rows
    };
  }

  function parseMarkdownTableRow(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  }

  function parseMarkdownLink(cell) {
    const match = String(cell || "").match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    return match ? { text: match[1], href: match[2] } : { text: String(cell || ""), href: "" };
  }

  function parseJinaMarkdownPage(markdown, sourceUrl = "") {
    const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
    const title = (titleMatch?.[1] || "Chess-Results").replace(/^Chess-Results Server Chess-results\.com -\s*/, "").trim();
    const rankMatch = markdown.match(/##\s*(Rank after Round[^|]+)\s*(\|[\s\S]+)$/);
    if (!rankMatch) {
      throw new Error("Could not find ranking table in the Jina Reader response.");
    }

    const subtitle = rankMatch[1].trim();
    const tableText = rankMatch[2].split("**Annotation:**")[0];
    const allCells = parseMarkdownTableRow(tableText);
    const firstSeparatorIndex = allCells.findIndex((cell) => /^:?-{3,}:?$/.test(cell));
    if (firstSeparatorIndex === -1) {
      throw new Error("Could not find ranking table separator in the Jina Reader response.");
    }
    const rawHeaders = allCells.slice(0, firstSeparatorIndex).filter((label, index, labels) => label || index < labels.length - 1);
    const separatorEndIndex = firstSeparatorIndex + rawHeaders.length;
    const dataCells = allCells.slice(separatorEndIndex).filter((cell) => !/^:?-{3,}:?$/.test(cell));
    const rawRows = [];
    for (let index = 0; index + rawHeaders.length <= dataCells.length; index += rawHeaders.length) {
      rawRows.push(dataCells.slice(index, index + rawHeaders.length));
    }
    const rawNameColumnIndex = rawHeaders.findIndex((label) => label === "Name");
    const filteredRawRows = rawRows.filter((row) => /^\d+$/.test(row[0] || "") && (row[rawNameColumnIndex] || "").trim());
    const keptIndexes = rawHeaders
      .map((label, index) => ({ label: cleanHeaderLabel(label, index), index }))
      .filter(({ label }) => shouldKeepTournamentColumn(label))
      .map(({ index }) => index);
    const columns = keptIndexes.map((index) => ({
      key: `md-${index}`,
      label: cleanHeaderLabel(rawHeaders[index], index),
      align: /^(Rk\.|SNo|Rtg|Pts\.|TB\d|K|rtg\+\/-)$/i.test(cleanHeaderLabel(rawHeaders[index], index)) ? "right" : ""
    }));
    const nameColumnIndex = columns.findIndex((column) => column.label === "Name");

    let rows = filteredRawRows.map((row) => {
      const mappedCells = keptIndexes.map((index, mappedIndex) => {
        const parsed = parseMarkdownLink(row[index] || "");
        return buildCell({
          text: highlightPlayerName(parsed.text),
          href: resolveLinkedUrl(parsed.href, sourceUrl),
          align: columns[mappedIndex]?.align || ""
        });
      });
      const nameCell = mappedCells[nameColumnIndex] || mappedCells.find((cell) => cell.href) || mappedCells[0];
      const pointsCell = mappedCells.find((cell, index) => columns[index]?.label === "Pts.");
      const ratingCell = mappedCells.find((cell, index) => columns[index]?.label === "Rtg");
      const clubCell = mappedCells.find((cell, index) => columns[index]?.label === "Club/City");
      return {
        cells: mappedCells,
        mobile: {
          topLeft: mappedCells[0]?.text ? `Rank ${mappedCells[0].text}` : "Tournament",
          topRight: pointsCell?.text || "",
          topRightColor: "",
          title: nameCell?.text || "Player",
          titleHref: nameCell?.href || "",
          details: [ratingCell?.text ? `Rtg ${ratingCell.text}` : "", clubCell?.text || ""].filter(Boolean)
        }
      };
    });

    if (rows.length < 20) {
      const compactColumns = [
        { key: "md-rank", label: "Rk.", align: "right" },
        { key: "md-sno", label: "SNo", align: "right" },
        { key: "md-name", label: "Name", align: "" },
        { key: "md-fed", label: "FED", align: "" },
        { key: "md-rtg", label: "Rtg", align: "right" },
        { key: "md-club", label: "Club/City", align: "" },
        { key: "md-pts", label: "Pts.", align: "right" }
      ];
      const playerPattern = /\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*\|\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([A-Z]{3})\s*\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|\s*([^|]*)/g;
      const fallbackRows = [...tableText.matchAll(playerPattern)].map((match) => {
        const cells = [
          buildCell({ text: match[1], align: "right" }),
          buildCell({ text: match[2], align: "right" }),
          buildCell({ text: highlightPlayerName(match[3]), href: resolveLinkedUrl(match[4], sourceUrl) }),
          buildCell({ text: match[5] }),
          buildCell({ text: match[6].trim(), align: "right" }),
          buildCell({ text: match[7].trim() }),
          buildCell({ text: match[8].trim(), align: "right" })
        ];
        return {
          cells,
          mobile: {
            topLeft: `Rank ${match[1]}`,
            topRight: match[8].trim(),
            topRightColor: "",
            title: highlightPlayerName(match[3]),
            titleHref: resolveLinkedUrl(match[4], sourceUrl),
            details: [match[6].trim() ? `Rtg ${match[6].trim()}` : "", match[7].trim()].filter(Boolean)
          }
        };
      });

      if (fallbackRows.length > rows.length) {
        columns.splice(0, columns.length, ...compactColumns);
        rows = fallbackRows;
      }
    }

    return {
      kind: "tournament",
      label: "Tournament",
      title,
      subtitle,
      chips: [],
      tournamentLinks: [],
      backUrl: "",
      columns,
      rows
    };
  }

  function parseChessResultsPage(html, sourceUrl = "") {
    debugLog("parseChessResultsPage: sourceUrl", sourceUrl);
    debugLog("parseChessResultsPage: html length", html.length);

    if (/^Title:\s+Chess-Results Server Chess-results\.com/m.test(html) && html.includes("Markdown Content:")) {
      return parseJinaMarkdownPage(html, sourceUrl);
    }

    if (typeof root.DOMParser !== "function") {
      throw new Error("DOMParser is not available in this environment.");
    }

    const parser = new root.DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const h2Headings = [...doc.querySelectorAll(".defaultDialog h2")].map((heading) => normalizeCell(heading));
    const hasPlayerInfo = h2Headings.some((heading) => heading.toLowerCase() === "player info");
    debugLog("parseChessResultsPage: h2 headings", h2Headings);
    debugLog("parseChessResultsPage: page type", hasPlayerInfo ? "player" : "tournament");

    return hasPlayerInfo ? parsePlayerPage(doc, sourceUrl) : parseTournamentPage(doc, sourceUrl);
  }

  function renderColorMarker(color) {
    if (color === "white") {
      return '<span class="color-dot white" aria-label="White"></span>';
    }

    if (color === "black") {
      return '<span class="color-dot black" aria-label="Black"></span>';
    }

    return '<span class="color-dot empty" aria-hidden="true"></span>';
  }

  function renderCellContent(cell, baseHref) {
    const content =
      cell.raw === "white" || cell.raw === "black" || cell.raw === "empty-color"
        ? renderColorMarker(cell.raw)
        : escapeHtml(cell.text || "-");

    if (cell.href) {
      return `<a href="${escapeHtml(buildInternalPageUrl(baseHref, cell.href, cell.parentUrl || ""))}">${content}</a>`;
    }

    return content;
  }

  function findColumnIndex(columns, label) {
    return columns.findIndex((column) => column.label === label);
  }

  function collectUniqueColumnValues(rows, columnIndex) {
    if (columnIndex < 0) {
      return [];
    }

    return [...new Set(rows.map((row) => row.cells[columnIndex]?.text?.trim() || "").filter(Boolean))];
  }

  function filterRowsByColumnValue(rows, columnIndex, value = "") {
    if (columnIndex < 0 || !value) {
      return rows;
    }

    return rows.filter((row) => (row.cells[columnIndex]?.text?.trim() || "") === value);
  }

  function renderTableHead(columns) {
    return `
    <tr>
      ${columns
        .map((column) => `<th class="${column.align ? `align-${column.align}` : ""}">${escapeHtml(column.label)}</th>`)
        .join("")}
    </tr>
  `;
  }

  function renderTableRows(rows, baseHref) {
    return rows
      .map(
        (row) => `
        <tr>
          ${row.cells
            .map(
              (cell) =>
                `<td class="${cell.align ? `align-${cell.align}` : ""}">${renderCellContent(cell, baseHref)}</td>`
            )
            .join("")}
        </tr>
      `
      )
      .join("");
  }

  function renderMobileRows(rows, baseHref) {
    return rows
      .map((row) => {
        const title = row.mobile.titleHref
          ? `<a href="${escapeHtml(buildInternalPageUrl(baseHref, row.mobile.titleHref, row.mobile.parentUrl || ""))}">${escapeHtml(row.mobile.title)}</a>`
          : escapeHtml(row.mobile.title);
        const sideMarker = row.mobile.topRightColor ? `${renderColorMarker(row.mobile.topRightColor)} ` : "";

        return `
        <article class="mobile-card">
          <div class="mobile-card-top">
            <span>${escapeHtml(row.mobile.topLeft)}</span>
            <span class="mobile-card-side">${sideMarker}${escapeHtml(row.mobile.topRight)}</span>
          </div>
          <h3>${title}</h3>
          ${row.mobile.details
            .map((detail, index) => `<p class="${index === row.mobile.details.length - 1 ? "mobile-club" : ""}">${escapeHtml(detail)}</p>`)
            .join("")}
        </article>
      `;
      })
      .join("");
  }

  function isTournamentUrl(url) {
    try {
      return extractChessResultsTarget(url).kind === "tournament";
    } catch {
      return false;
    }
  }

  function attachPlayerNavigation(view, parentUrl) {
    const backUrl = parentUrl || view.backUrl || "";
    if (view.kind !== "player" || !backUrl) {
      debugLog("attachPlayerNavigation: skipped", { kind: view.kind, parentUrl, backUrl: view.backUrl });
      return view;
    }

    debugLog("attachPlayerNavigation: attaching parent url", backUrl, "rows", view.rows.length);
    return {
      ...view,
      backUrl,
      rows: view.rows.map((row) => ({
        ...row,
        cells: row.cells.map((cell) => ({ ...cell, parentUrl: backUrl })),
        mobile: {
          ...row.mobile,
          parentUrl: backUrl
        }
      }))
    };
  }

    return {
      API_BASE_URL,
      DEMO_URL,
      attachPlayerNavigation,
      buildApiUrl,
      buildCell,
      buildFideProfileUrl,
      buildInternalPageUrl,
      buildPlayerSourceUrl,
      buildPlayerSearchView,
      buildPlayerView,
      buildTournamentSearchView,
      buildTournamentSourceUrl,
      buildTournamentSearchPayload,
      buildPlayerSearchPayload,
      buildTournamentView,
      appendCacheBustParam,
      chip,
      collectUniqueColumnValues,
      cleanHeaderLabel,
      createAppUrl,
      debugLog,
      escapeHtml,
      extractChessResultsTarget,
      filterRowsByColumnValue,
      findColumnIndex,
      getHeadingText,
      highlightPlayerName,
      inferTournamentUrlFromPlayerUrl,
      isRightAlignedCell,
      isTournamentUrl,
      detectTrendDirection,
      normalizeFideId,
      normalizeSupportedUrl,
      normalizeCell,
      parseChessResultsPage,
      parsePlayerPage,
      parseTournamentColumns,
      parseTournamentRoundLinks,
      prependBookmarkMarker,
      isTournamentRankingDialog,
      parseTournamentMeta,
      parseTournamentPage,
      parseTournamentSearchPage,
      parsePlayerSearchPage,
      readQueryState,
      renderCellContent,
      renderColorMarker,
      renderMobileRows,
      renderTableHead,
      renderTableRows,
      shouldKeepTournamentColumn,
      writeQueryState
    };
});
