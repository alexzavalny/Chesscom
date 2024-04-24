// version 1.0

const usernames = [
  "alexandrzavalnij",
  "jefimserg",
  "TheErix",
  "vadimostapchuk",
];

function fetchStats(period) {
  const output = document.getElementById("statsOutput");
  output.innerHTML = "";

  let date = new Date();
  let year = date.getFullYear();
  let month = String(date.getMonth() + 1).padStart(2, "0");
  let day = String(date.getDate()).padStart(2, "0");

  if (period === "yesterday") {
    date.setDate(date.getDate() - 1);
    day = String(date.getDate()).padStart(2, "0");
  }

  let index = 0;
  let results = [];

  function next() {
    if (index < usernames.length) {
      let username = usernames[index];
      let url = `https://api.chess.com/pub/player/${username}/games/${year}/${month}`;

      fetchWithRetry(url, 3) // Retry up to 3 times
        .then((data) => {
          return processGames(data, username, period, year, month, day);
        })
        .then((result) => {
          results.push(result);
          output.innerHTML += result + "\n\n";
          index++;
          next(); // Process the next username
        })
        .catch((error) => {
          console.error("Failed to fetch for user:", username, "Error:", error);
          results.push(`Error fetching data for ${username}: ${error.message}`);
          output.innerHTML += `Error fetching data for ${username}: ${error.message}\n\n`;
          index++;
          next();
        });
    } else {
      initTableEvents();
    }
  }

  next(); // Start the sequence
}

function initTableEvents() {
  var modal = document.getElementById("gamesModal");
  const tableRows = document.querySelectorAll("table tr");
  tableRows.forEach((row) => {
    if (!row.getAttribute("data-username")) return;
    row.onclick = function () {
      modal.style.display = "flex";

      // take div gamesList, clear it and append new games
      // get username from row data-username
      // get gameType from row data-type
      // get games from window.stats[username][gameType].games
      // append each game to gamesList
      // code:
      const gamesList = document.getElementById("gamesList");
      gamesList.innerHTML = "<ul>";
      const username = row.getAttribute("data-username");
      const gameType = row.getAttribute("data-type");
      const games = window.stats[username][gameType].games;
      games.forEach((game) => {
        gamesList.innerHTML += formatGame(game, username);
      });
      gamesList.innerHTML += "</ul>";
    };
  });
}

function formatGame(game, username) {
  let gameSummary = `(${game.result}) ${game.white.username} vs ${game.black.username}`;
  return `<li><a href="${game.url}" target="_blank">${gameSummary}</a></li>`;
}

function fetchWithRetry(url, retries, delay = 1000) {
  const cache = localStorage.getItem(url);
  if (cache) {
    const { data, timestamp } = JSON.parse(cache);
    const cacheDate = new Date(timestamp);
    const now = new Date();

    // Check if the cached data is from today
    if (cacheDate.toDateString() === now.toDateString()) {
      console.log("Using cached data.");
      return Promise.resolve(data);
    }
  }

  return fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok.");
      return response.json();
    })
    .then((data) => {
      try {
        localStorage.setItem(
          url,
          JSON.stringify({ data, timestamp: new Date().toISOString() }),
        );

        localStorage.setItem("lastFetch", new Date().toLocaleString());
      } catch (e) {}
      updateLastFetched();
      return data;
    })
    .catch((error) => {
      if (retries > 0) {
        console.log(`Retrying... attempts left: ${retries - 1}`);
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(fetchWithRetry(url, retries - 1, delay));
          }, delay);
        });
      }
      throw error;
    });
}

function getGameIcon(gameType) {
  return `<img src="icons/${gameType}.svg" alt="${gameType}">`;
}

function processGames(data, username, period, year, month, day) {
  return new Promise((resolve) => {
    let games = data.games || [];
    let statsByType = {};

    games.forEach((game) => {
      let gameType = game.time_class;
      if (!statsByType[gameType]) {
        statsByType[gameType] = {
          played: 0,
          won: 0,
          lost: 0,
          draw: 0,
          total_time: 0,
          rating: 0,
          games: [],
        };
      }

      if (period !== "month" && game.end_time) {
        let gameDate = new Date(game.end_time * 1000);
        if (
          gameDate.getFullYear() !== year ||
          gameDate.getMonth() + 1 !== parseInt(month) ||
          gameDate.getDate() !== parseInt(day)
        ) {
          return;
        }
      }

      game.result = determineResult(game, username);
      statsByType[gameType].games.push(game);

      let userIsWhite =
        game.white.username.toLowerCase() === username.toLowerCase();
      let correctPlayer = userIsWhite ? game.white : game.black;
      statsByType[gameType].rating = correctPlayer.rating;

      statsByType[gameType].played++;
      let result = game.result;
      statsByType[gameType][result]++;
      let duration = getGameDurationFromPGN(game.pgn);
      statsByType[gameType].total_time += duration;
    });

    let statsText = formatStats(statsByType, username);
    resolve(statsText);
  });
}

function formatStats(statsByType, username) {
  window.stats = window.stats || {};
  window.stats[username] = statsByType;

  // Consolidate the stats formatting into a separate function for clarity
  let statsText = `<h2><a href="https://www.chess.com/member/${username}" target="_blank">${username}</a></h2>
                   <table>
                     <tr>
                       <th></th>
                       <th>Played</th>
                       <th>Won</th>
                       <th>Lost</th>
                       <th>Draw</th>
                       <th>Duration</th>
                       <th>Rating</th>
                     </tr>`;

  let totalPlayed = 0,
    totalWon = 0,
    totalLost = 0,
    totalDraw = 0,
    totalDuration = 0;

  for (let type of ["daily", "rapid", "blitz", "bullet"]) {
    if (!statsByType[type]) continue;
    let stats = statsByType[type];
    if (stats.played > 0) {
      totalPlayed += stats.played;
      totalWon += stats.won;
      totalLost += stats.lost;
      totalDraw += stats.draw;
      if (type != "daily") totalDuration += stats.total_time;
      let formattedTime = formatDuration(stats.total_time);
      statsText += `<tr data-type="${type}" data-username="${username}">
                        <td>${getGameIcon(type.toLowerCase())}</td>
                        <td>${stats.played}</td>
                        <td>${stats.won}</td>
                        <td>${stats.lost}</td>
                        <td>${stats.draw}</td>
                        <td>${formattedTime}</td>
                        <td>${stats.rating}</td>
                      </tr>`;
    }
  }

  let overallTime = formatDuration(totalDuration);
  let gameTypesWithGamesPlayed = Object.values(statsByType).filter(
    (stats) => stats.played > 0,
  ).length;

  if (gameTypesWithGamesPlayed > 1) {
    statsText += `<tr>
                    <td><strong>Total</strong></td>
                    <td><strong>${totalPlayed}</strong></td>
                    <td><strong>${totalWon}</strong></td>
                    <td><strong>${totalLost}</strong></td>
                    <td><strong>${totalDraw}</strong></td>
                    <td><strong>${overallTime}</strong></td>
                    <td></td>
                  </tr>`;
  }

  statsText += `</table>`;
  return statsText;
}

function getGameDurationFromPGN(pgn) {
  const startTimeMatch = pgn.match(/\[StartTime \"(\d+:\d+:\d+)\"\]/);
  const endTimeMatch = pgn.match(/\[EndTime \"(\d+:\d+:\d+)\"\]/);

  if (!startTimeMatch || !endTimeMatch) {
    return 0; // Return 0 if either time is not found
  }

  const startTimeStr = startTimeMatch[1];
  const endTimeStr = endTimeMatch[1];

  // Convert HH:MM:SS string to seconds since the start of the day
  const parseTime = (timeStr) => {
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };

  const startTime = parseTime(startTimeStr);
  const endTime = parseTime(endTimeStr);

  const duration = endTime - startTime;
  return Math.max(duration, 0);
}

const zeroPad = (num, places) => String(num).padStart(places, "0");
function formatDuration(seconds) {
  let hours = Math.floor(seconds / 3600);
  let minutes = Math.floor((seconds % 3600) / 60);
  return `${zeroPad(hours, 2)}h ${zeroPad(minutes, 2)}m`;
}

function determineResult(game, username) {
  let userIsWhite =
    game.white.username.toLowerCase() === username.toLowerCase();
  let result = userIsWhite ? game.white.result : game.black.result;

  switch (result) {
    case "win":
      return "won";
    case "checkmated":
    case "timeout":
    case "resigned":
      return "lost";
    case "agreed":
    case "stalemate":
    case "insufficient":
    case "50move":
    case "timevsinsufficient":
    case "repetition":
      return "draw";
    default:
      return "unknown";
  }
}

function updateLastFetched() {
  let lastFetch = localStorage.getItem("lastFetch");

  if (lastFetch) {
    document.getElementById("lastFetch").textContent = lastFetch;
  } else {
    document.getElementById("lastFetch").textContent = "never";
  }
}

function clearLocalStorage() {
  // clear all local storage
  localStorage.clear();
  updateLastFetched();
}

document.addEventListener("DOMContentLoaded", function () {
  fetchStats("today"); // Automatically call fetchStats for 'today' when the page loads

  // we have this : <div>Last updated: <span id="lastFetch"></span></div>
  // need to update on page load from local storage
  updateLastFetched();
});

document.addEventListener("DOMContentLoaded", function () {
  var modal = document.getElementById("gamesModal");
  var span = document.getElementsByClassName("close")[0];

  span.onclick = function () {
    modal.style.display = "none";
  };

  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };
});
