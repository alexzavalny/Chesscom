const usernames = [
  "alexandrzavalnij",
  "jefimserg",
  "TheErix",
  "vadimostapchuk",
];

const fetchStatsCache = {};
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

      if (fetchStatsCache[url]) {
        console.log(`Using cached data for ${username}`);
        processGames(
          fetchStatsCache[url],
          username,
          period,
          year,
          month,
          day,
        ).then((result) => {
          results.push(result);
          output.innerHTML += result + "\n\n";
          index++;
          next();
        });
      } else {
        fetchWithRetry(url, 3) // Retry up to 3 times
          .then((data) => {
            fetchStatsCache[url] = data; // Cache successful responses
            return processGames(data, username, period, year, month, day);
          })
          .then((result) => {
            results.push(result);
            output.innerHTML += result + "\n\n";
            index++;
            next(); // Process the next username
          })
          .catch((error) => {
            console.error(
              "Failed to fetch for user:",
              username,
              "Error:",
              error,
            );
            results.push(
              `Error fetching data for ${username}: ${error.message}`,
            );
            output.innerHTML += `Error fetching data for ${username}: ${error.message}\n\n`;
            index++;
            next();
          });
      }
    }
  }

  next(); // Start the sequence
}

function fetchWithRetry(url, retries, delay = 1000) {
  return fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok.");
      return response.json();
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

    let userIsWhite =
      game.white.username.toLowerCase() === username.toLowerCase();
    let correctPlayer = userIsWhite ? game.white : game.black;
    statsByType[gameType].rating = correctPlayer.rating;

    statsByType[gameType].played++;
    let result = determineResult(game, username);
    statsByType[gameType][result]++;
    let duration = getGameDurationFromPGN(game.pgn);
    statsByType[gameType].total_time += duration;
  });

  let statsText = `<h2>${username}</h2>
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

  for (let type in statsByType) {
    let stats = statsByType[type];
    if (stats.played > 0) {
      // Only add row if games were played
      totalPlayed += stats.played;
      totalWon += stats.won;
      totalLost += stats.lost;
      totalDraw += stats.draw;
      if (type != "daily") totalDuration += stats.total_time;
      let formattedTime = formatDuration(stats.total_time);
      statsText += `<tr>
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
  // Adding the total row at the end of the table
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
