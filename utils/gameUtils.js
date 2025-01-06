export const GameUtils = {
    determineResult(resultSubType) {
        switch (resultSubType) {
            case "win": return "won";
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

    getGameOpening(pgn) {
        const fullUrl = pgn.match(/\[ECOUrl "(.+?)"\]/);
        if (!fullUrl || fullUrl.length <= 1) {
            return { name: "Unknown opening", url: "#" };
        }

        const ecoUrlMatch = pgn.match(/\[ECOUrl \"https:\/\/www\.chess\.com\/openings\/(.+?)\"\]/);
        const openingUrl = ecoUrlMatch[1];
        const openingName = openingUrl
            .split("/")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
            .split("-")
            .join(" ");
        
        return { 
            name: openingName.substring(0, 50) + "...", 
            url: fullUrl[1] 
        };
    },

    getGameDurationFromPGN(pgn) {
        const startTimeMatch = pgn.match(/\[StartTime \"(\d+:\d+:\d+)\"\]/);
        const endTimeMatch = pgn.match(/\[EndTime \"(\d+:\d+:\d+)\"\]/);
        
        if (!startTimeMatch || !endTimeMatch) return 0;

        const parseTime = timeStr => {
            const [hours, minutes, seconds] = timeStr.split(":").map(Number);
            return hours * 3600 + minutes * 60 + seconds;
        };

        const startTime = parseTime(startTimeMatch[1]);
        const endTime = parseTime(endTimeMatch[1]);
        return Math.max(endTime - startTime, 0);
    },

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}; 