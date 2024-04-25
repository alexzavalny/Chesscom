// chessStats.js
new Vue({
  el: "#app",
  data: {
    lastFetch: "",
    showModal: false,
    gamesList: "",
    results: [],
    periods: ["today", "yesterday", "month"],
  },
  methods: {
    fetchStats(period) {
      this.results = [];
      const usernames = [
        "alexandrzavalnij",
        "jefimserg",
        "TheErix",
        "vadimostapchuk",
      ];
      let date = new Date();
      let year = date.getFullYear();
      let month = String(date.getMonth() + 1).padStart(2, "0");
      let day = String(date.getDate()).padStart(2, "0");

      if (period === "yesterday") {
        date.setDate(date.getDate() - 1);
        day = String(date.getDate()).padStart(2, "0");
      }

      Promise.all(
        usernames.map((username) =>
          this.fetchUserStats(username, year, month, day, period),
        ),
      )
        .then(() => {
          this.updateLastFetched();
        })
        .catch((error) => {
          console.error("Error fetching data:", error);
        });
    },
    fetchUserStats(username, year, month, day, period) {
      let url = `https://api.chess.com/pub/player/${username}/games/${year}/${month}`;
      return this.fetchWithRetry(url, 3)
        .then((data) =>
          this.processGames(data, username, period, year, month, day),
        )
        .then((stats) => {
          this.results.push({
            username: username,
            statsByType: stats,
          });
        });
    },
    fetchWithRetry(url, retries, delay = 1000) {
      return new Promise((resolve, reject) => {
        const attempt = () => {
          fetch(url)
            .then((response) => {
              if (response.ok) {
                response
                  .json()
                  .then((data) => resolve(data))
                  .catch((jsonError) => {
                    throw jsonError;
                  });
              } else {
                throw new Error("Network response was not ok.");
              }
            })
            .catch((fetchError) => {
              if (retries > 0) {
                setTimeout(attempt, delay, --retries);
              } else {
                reject(fetchError);
              }
            });
        };
        attempt();
      });
    },
    processGames(data, username, period, year, month, day) {
      let statsByType = {};

      data.games.forEach((game) => {
        let gameDate = new Date(game.end_time * 1000);
        if (
          period !== "month" &&
          (gameDate.getFullYear() !== year ||
            gameDate.getMonth() + 1 !== parseInt(month, 10) ||
            gameDate.getDate() !== parseInt(day, 10))
        ) {
          return;
        }

        let gameType = game.time_class;
        if (!statsByType[gameType]) {
          statsByType[gameType] = {
            played: 0,
            won: 0,
            lost: 0,
            draw: 0,
            duration: 0,
            rating: 0,
          };
        }

        let result = this.determineResult(game, username);
        statsByType[gameType].played++;
        statsByType[gameType][result]++;
        let userIsWhite =
          game.white.username.toLowerCase() === username.toLowerCase();
        let correctPlayer = userIsWhite ? game.white : game.black;
        statsByType[gameType].rating = correctPlayer.rating;
        let duration = this.getGameDurationFromPGN(game.pgn);
        statsByType[gameType].duration += duration;
      });

      return statsByType;
    },
    determineResult(game, username) {
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
    },
    getGameDurationFromPGN(pgn) {
      const startTimeMatch = pgn.match(/\[StartTime \"(\d+:\d+:\d+)\"\]/);
      const endTimeMatch = pgn.match(/\[EndTime \"(\d+:\d+:\d+)\"\]/);
      if (!startTimeMatch || !endTimeMatch) {
        return 0;
      }
      const parseTime = (timeStr) => {
        const [hours, minutes, seconds] = timeStr.split(":").map(Number);
        return hours * 3600 + minutes * 60 + seconds;
      };
      const startTime = parseTime(startTimeMatch[1]);
      const endTime = parseTime(endTimeMatch[1]);
      return Math.max(endTime - startTime, 0);
    },
    updateLastFetched() {
      this.lastFetch = new Date().toLocaleString();
      localStorage.setItem("lastFetch", this.lastFetch);
    },
    closeModal() {
      this.showModal = false;
    },
  },
  mounted() {
    this.fetchStats("today");
  },
});
