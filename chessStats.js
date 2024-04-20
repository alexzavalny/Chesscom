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

  const promises = usernames.map((username) => {
    let url = `https://api.chess.com/pub/player/${username}/games/${year}/${month}`;
    return fetch(url)
      .then((response) => response.json())
      .then((data) => processGames(data, username, period, year, month, day));
  });

  Promise.all(promises)
    .then((results) => {
      results.forEach((result) => {
        output.innerHTML += result + "\n\n";
      });
    })
    .catch((error) => {
      output.innerHTML = "Error fetching data: " + error;
    });
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

    statsByType[gameType].played++;
    let result = determineResult(game, username);
    statsByType[gameType][result]++;
    let duration = game.end_time - game.start_time; // Assuming `start_time` and `end_time` are Unix timestamps
    statsByType[gameType].total_time += duration;
  });

  let statsText = `/${username}/\n`;
  let totalPlayed = 0,
    totalWon = 0,
    totalLost = 0,
    totalDraw = 0,
    totalDuration = 0;
  for (let type in statsByType) {
    let stats = statsByType[type];
    totalPlayed += stats.played;
    totalWon += stats.won;
    totalLost += stats.lost;
    totalDraw += stats.draw;
    totalDuration += stats.total_time;
    let formattedTime = formatDuration(stats.total_time);
    statsText += `  ${type.toUpperCase()}: Played: ${stats.played}, Won: ${stats.won}, Lost: ${stats.lost}, Draw: ${stats.draw}, Total Time: ${formattedTime}\n`;
  }
  let overallTime = formatDuration(totalDuration);
  statsText += `\nTotal across all types: Played: ${totalPlayed}, Won: ${totalWon}, Lost: ${totalLost}, Draw: ${totalDraw}, Total Time: ${overallTime}`;
  return statsText;
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
      return "draw";
    default:
      return "unknown";
  }
}

function formatDuration(seconds) {
  let hours = Math.floor(seconds / 3600);
  let minutes = Math.floor((seconds % 3600) / 60);
  let remainingSeconds = seconds % 60;
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
}
