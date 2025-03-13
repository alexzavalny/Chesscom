import { CONFIG } from "./config.js";
import { ChessApi } from "./services/chessApi.js";
import { GameUtils } from "./utils/gameUtils.js";

const app = new Vue({
    el: "#app",
    data: {
        activePeriod: "today",
        lastFetch: "",
        showModal: false,
        results: [],
        usernames: CONFIG.DEFAULT_USERNAMES,
        usernamesToNames: CONFIG.USERNAMES_TO_NAMES,
        periods: CONFIG.PERIODS,
        currentGames: [],
        showOpenings: false,
        showTime: true,
        showDate: false,
        currentChart: null,
        showChart: true,
        showLeaderboard: false,
        playerStats: {},
        leaderboards: {},
    },
    methods: {
        openGame(gameUrl) {
            window.open(gameUrl, "_blank");
        },
        openModal(username, games) {
            this.currentGames = games;
            this.showModal = true;

            // Wait for DOM update
            this.$nextTick(() => {
                const ctx = document.getElementById("ratingChart");

                // Destroy existing chart if any
                if (this.currentChart) {
                    this.currentChart.destroy();
                }

                console.log(games);
                // Prepare data
                const ratings = games.map((game) => {
                    const isWhite =
                        game.white.username.toLowerCase() ===
                        username.toLowerCase();
                    console.log(game.white.username);
                    console.log(username);
                    console.log(isWhite);
                    return isWhite ? game.white.rating : game.black.rating;
                });

                const labels = games.map((game, index) => {
                    const gameDate = new Date(game.end_time * 1000);
                    const formattedDate = gameDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                    });
                    return `Game ${games.length - index} (${formattedDate})`;
                });

                // Create new chart
                this.currentChart = new Chart(ctx, {
                    type: "line",
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: "Rating",
                                data: ratings,
                                borderColor: "rgb(75, 192, 192)",
                                tension: 0.1,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: "Rating Progress",
                            },
                        },
                        scales: {
                            x: {
                                display: false, // This hides the x-axis
                            },
                            y: {
                                beginAtZero: false,
                            },
                        },
                    },
                });
            });
        },
        closeModal() {
            if (this.currentChart) {
                this.currentChart.destroy();
                this.currentChart = null;
            }
            this.showModal = false;
        },
        async fetchStats(period) {
            this.activePeriod = period;
            this.results = [];

            let date = new Date();
            if (period === "yesterday") {
                date.setDate(date.getDate() - 1);
            } else if (period === "prevmonth") {
                date.setMonth(date.getMonth() - 1);
            }

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");

            try {
                await Promise.all(
                    this.usernames.map((username) =>
                        this.fetchUserStats(username, year, month, day, period),
                    ),
                );
                this.sortResultsByGameDuration();
                this.updateLastFetched();
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        },
        async fetchUserStats(username, year, month, day, period) {
            try {
                const data = await ChessApi.fetchPlayerGames(
                    username,
                    year,
                    month,
                );
                const stats = this.processGames(
                    data,
                    username,
                    period,
                    year,
                    month,
                    day,
                );
                this.results.push({
                    username: username,
                    statsByType: stats,
                });
            } catch (error) {
                console.error(`Error fetching stats for ${username}:`, error);
            }
        },
        formatDate(date) {
            return date.toISOString().split("T")[0]; // This will return the date in YYYY-MM-DD format
        },
        processGames(data, username, period, year, month, day) {
            let statsByType = {};
            let ratingBeforeByType = {};

            data.games.forEach((game) => {
                let gameType =
                    game.rules == "chess" ? game.time_class : game.rules;
                let userIsWhite =
                    game.white.username.toLowerCase() ===
                    username.toLowerCase();
                let correctPlayer = userIsWhite ? game.white : game.black;

                let gameDate = new Date(game.end_time * 1000);
                if (
                    period !== "month" &&
                    period !== "prevmonth" &&
                    (gameDate.getFullYear() !== parseInt(year) ||
                        gameDate.getMonth() + 1 !== parseInt(month, 10) ||
                        gameDate.getDate() !== parseInt(day, 10))
                ) {
                    ratingBeforeByType[gameType] = correctPlayer.rating;
                    return;
                }

                if (!statsByType[gameType]) {
                    statsByType[gameType] = {
                        played: 0,
                        won: 0,
                        lost: 0,
                        draw: 0,
                        duration: 0,
                        ratingBefore: 0,
                        rating: 0,
                        games: [],
                    };
                }

                game.resultSubType = userIsWhite
                    ? game.white.result
                    : game.black.result;
                game.result = GameUtils.determineResult(game.resultSubType);
                if (game.resultSubType === "win") {
                    game.resultSubType = userIsWhite
                        ? game.black.result
                        : game.white.result;
                }

                statsByType[gameType].played++;
                statsByType[gameType].games.push(game);
                statsByType[gameType][game.result]++;
                statsByType[gameType].ratingBefore ||=
                    ratingBeforeByType[gameType] || correctPlayer.rating;
                statsByType[gameType].rating = correctPlayer.rating;

                const duration = GameUtils.getGameDurationFromPGN(game.pgn);
                game.endTime = new Date(game.end_time * 1000);
                game.moveCount = parseInt(this.getMoveCountFromPGN(game.pgn));
                game.opening = GameUtils.getGameOpening(game.pgn);
                statsByType[gameType].duration += duration;
            });

            return statsByType;
        },
        determineResult(resultSubType) {
            switch (resultSubType) {
                case "win":
                    return "won";
                case "checkmated":
                case "timeout":
                case "resigned":
                case "abandoned":
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
        iconClassByResult(game) {
            return `chess-icon-${game.result} chess-icon-${game.resultSubType}`;
        },
        formatDuration(seconds) {
            let hours = Math.floor(seconds / 3600);
            let minutes = Math.floor((seconds % 3600) / 60);
            let formattedDuration = `${hours}h ${minutes}m`;
            return formattedDuration;
        },
        getGameOpening(pgn) {
            // Extract the opening name from the PGN
            // example:
            // [ECOUrl "https://www.chess.com/openings/Sicilian-Defense-Open-Accelerated-Dragon-Exchange-Variation-5...bxc6"]

            var fullUrl = pgn.match(/\[ECOUrl "(.+?)"\]/);
            if (fullUrl && fullUrl.length > 1) {
                fullUrl = fullUrl[1]; // This captures only the URL part
            }

            const ecoUrlMatch = pgn.match(
                /\[ECOUrl \"https:\/\/www\.chess\.com\/openings\/(.+?)\"\]/,
            );
            if (!fullUrl) {
                return { name: "Unknown opening", url: "#" }; // format { "name": "url" }
            }

            const openingUrl = ecoUrlMatch[1];
            const openingName = openingUrl
                .split("/")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")
                .split("-")
                .join(" ");
            const openingNameFirst50Chars =
                openingName.substring(0, 50) + "...";
            return { name: openingNameFirst50Chars, url: fullUrl };
        },
        getMoveCountFromPGN(pgn) {
            const rawSplit = pgn.split(" ");
            return rawSplit[rawSplit.length - 5];
        },
        getGameDurationFromPGN(pgn) {
            const startTimeMatch = pgn.match(/\[StartTime \"(\d+:\d+:\d+)\"\]/);
            const endTimeMatch = pgn.match(/\[EndTime \"(\d+:\d+:\d+)\"\]/);
            if (!startTimeMatch || !endTimeMatch) {
                return 0;
            }
            const parseTime = (timeStr) => {
                const [hours, minutes, seconds] = timeStr
                    .split(":")
                    .map(Number);
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
        async fetchPlayerStats(username) {
            try {
                return await ChessApi.fetchPlayerStats(username);
            } catch (error) {
                console.error(`Error fetching stats for ${username}:`, error);
                return null;
            }
        },

        async loadAllPlayerStats() {
            this.playerStats = {}; // Reset stats
            const fetchPromises = this.usernames.map(async (username) => {
                const stats = await this.fetchPlayerStats(username);
                if (stats) {
                    this.playerStats[username] = stats;
                }
            });

            await Promise.all(fetchPromises);
            this.generateLeaderboards();
        },

        // In generateLeaderboards() method, modify the leaderboards initialization:
        generateLeaderboards() {
            const leaderboards = {
                blitz: [],
                rapid: [],
                bullet: [],
                tactics: [],
                puzzle_rush: [],
            };

            // Map chess.com API response keys to our simpler keys
            const gameTypeMap = {
                chess_blitz: "blitz",
                chess_rapid: "rapid",
                chess_bullet: "bullet",
                tactics: "tactics",
                puzzle_rush: "puzzle_rush",
            };

            Object.entries(this.playerStats).forEach(([username, stats]) => {
                // Handle chess game types
                Object.entries(gameTypeMap).forEach(([apiKey, ourKey]) => {
                    if (stats[apiKey]) {
                        if (
                            [
                                "chess_blitz",
                                "chess_rapid",
                                "chess_bullet",
                            ].includes(apiKey)
                        ) {
                            // Handle regular chess ratings
                            if (stats[apiKey].last) {
                                leaderboards[ourKey].push({
                                    username,
                                    rating: stats[apiKey].last.rating,
                                    gamesWon: stats[apiKey].record.win,
                                    gamesLost: stats[apiKey].record.loss,
                                    gamesDraw: stats[apiKey].record.draw,
                                    bestRating: stats[apiKey].best
                                        ? stats[apiKey].best.rating
                                        : null,
                                });
                            }
                        } else if (apiKey === "tactics") {
                            // Handle tactics ratings
                            leaderboards[ourKey].push({
                                username,
                                rating: stats[apiKey].highest.rating,
                                bestRating: stats[apiKey].highest.rating,
                                lowestRating: stats[apiKey].lowest.rating,
                            });
                        } else if (apiKey === "puzzle_rush") {
                            // Handle puzzle rush scores
                            if (stats[apiKey].best) {
                                leaderboards[ourKey].push({
                                    username,
                                    score: stats[apiKey].best.score,
                                    attempts: stats[apiKey].best.total_attempts,
                                });
                            }
                        }
                    }
                });
            });

            // Sort each leaderboard appropriately
            Object.keys(leaderboards).forEach((type) => {
                if (type === "puzzle_rush") {
                    leaderboards[type].sort((a, b) => b.score - a.score);
                } else {
                    leaderboards[type].sort((a, b) => b.rating - a.rating);
                }
            });

            this.leaderboards = leaderboards;
        },

        async toggleLeaderboard() {
            this.showLeaderboard = !this.showLeaderboard;
            if (this.showLeaderboard) {
                await this.loadAllPlayerStats();
            }
        },
        percentage(value, total) {
            return ((value / total) * 100).toFixed(1);
        },
        colorClass(accuracy) {
            if (accuracy < 60) {
                return "red";
            } else if (accuracy >= 60 && accuracy < 80) {
                return "yellow";
            } else if (accuracy >= 80 && accuracy < 90) {
                return "green";
            } else {
                return "blue";
            }
        },
        ratingClass(details) {
            if (details.rating > details.ratingBefore) return "rating-climb";
            if (details.rating < details.ratingBefore) return "rating-fall";
            return "";
        },
        nonameClass(username) {
            if (this.usernames.indexOf(username) == -1) return "player-noname";
        },
        isTheBest(username) {
            let maxDuration = Math.max(
                ...Object.keys(this.totalStats).map(
                    (x) => this.totalStats[x].duration,
                ),
            );
            return (
                maxDuration > 0 &&
                this.totalStats[username].duration == maxDuration
            );
        },
        handleKeyDown(event) {
            if (event.key === "Escape" && this.showModal) {
                this.closeModal();
            }
        },
        sortResultsByGameDuration() {
            // Calculate total duration for each user
            const userDurations = {};
            this.results.forEach(result => {
                const username = result.username;
                let totalDuration = 0;
                
                Object.entries(result.statsByType).forEach(([gameType, stats]) => {
                    if (gameType !== "daily") {
                        totalDuration += stats.duration;
                    }
                });
                
                userDurations[username] = totalDuration;
            });
            
            // Sort results array by total duration (descending)
            this.results.sort((a, b) => {
                return userDurations[b.username] - userDurations[a.username];
            });
        },
    },
    mounted() {
        // if query string contains a list of usernames, then set the usernames
        const urlParams = new URLSearchParams(window.location.search);
        const usernames = urlParams.get("usernames");
        if (usernames) {
            this.usernames = usernames.split(",");
        }

        const defaultPeriod = urlParams.get("period") || "today";
        this.fetchStats(defaultPeriod);
    },
    created() {
        document.addEventListener("keydown", this.handleKeyDown);
    },
    beforeDestroy() {
        document.removeEventListener("keydown", this.handleKeyDown);
    },
    computed: {
        periodButtonClass() {
            return function (period) {
                return {
                    active: period === this.activePeriod,
                };
            };
        },
        totalStats() {
            let totalsHash = {};
            this.results.forEach((user) => {
                const totals = {
                    played: 0,
                    won: 0,
                    lost: 0,
                    draw: 0,
                    duration: 0,
                };
                Object.entries(user.statsByType).forEach(
                    ([gameType, stats]) => {
                        if (gameType == "daily") return;

                        totals.played += stats.played;
                        totals.won += stats.won;
                        totals.lost += stats.lost;
                        totals.draw += stats.draw;
                        totals.duration += stats.duration;
                    },
                );
                // Storing the totals by username in the hash
                totalsHash[user.username] = totals;
            });
            return totalsHash;
        },
    },
});
