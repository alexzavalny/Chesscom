import { CONFIG } from '../config.js';

export const ChessApi = {
    async fetchWithRetry(url, retries = 3, delay = 1000) {
        return new Promise((resolve, reject) => {
            const attempt = () => {
                fetch(url)
                    .then(response => {
                        if (response.ok) {
                            return response.json();
                        }
                        throw new Error("Network response was not ok.");
                    })
                    .then(data => resolve(data))
                    .catch(error => {
                        if (retries > 0) {
                            setTimeout(() => attempt(--retries), delay);
                        } else {
                            reject(error);
                        }
                    });
            };
            attempt();
        });
    },

    async fetchPlayerGames(username, year, month) {
        const url = `${CONFIG.API_BASE_URL}/player/${username}/games/${year}/${month}`;
        return this.fetchWithRetry(url);
    },

    async fetchPlayerStats(username) {
        const url = `${CONFIG.API_BASE_URL}/player/${username}/stats`;
        return this.fetchWithRetry(url);
    }
}; 