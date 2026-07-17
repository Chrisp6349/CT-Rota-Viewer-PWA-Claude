/* =====================================================
   Cardiothoracic Theatre Viewer
   api.js
   -----------------------------------------------------
   The only file that talks to the Google Sheets backend.
   All three endpoints return PUBLISHED data - this app
   never reads the rota manager's raw saved weeks.

   Week strings from the backend sometimes arrive as full
   timestamps ("2026-07-27T00:00:00.000Z"). normalizeWeek()
   trims them to plain dates ("2026-07-27") in this one
   place, so no other file needs to worry about it.
   ===================================================== */

class RotaAPI {

    // "2026-07-27T00:00:00.000Z" -> "2026-07-27"
    static normalizeWeek(week) {
        return String(week).substring(0, 10);
    }

    // The latest published rota (what the dashboard shows by default)
    static async loadRota() {
        const r = await fetch(CONFIG.API_URL + "?action=viewer");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const rota = await r.json();
        rota.week = RotaAPI.normalizeWeek(rota.week);
        return rota;
    }

    // Every week that has ever been published (for the archive dropdown),
    // de-duplicated and sorted oldest -> newest
    static async loadPublishedWeeks() {
        const r = await fetch(CONFIG.API_URL + "?action=archive");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const weeks = await r.json();

        return [...new Map(
            weeks.map(item => [
                RotaAPI.normalizeWeek(item.week),
                { ...item, week: RotaAPI.normalizeWeek(item.week) }
            ])
        ).values()].sort((a, b) => a.week.localeCompare(b.week));
    }

    // One specific published week from the archive
    static async loadWeek(week) {
        const r = await fetch(
            CONFIG.API_URL +
            "?action=publishedWeek&week=" +
            encodeURIComponent(RotaAPI.normalizeWeek(week))
        );
        if (!r.ok) throw new Error("HTTP " + r.status);
        const rota = await r.json();
        rota.week = RotaAPI.normalizeWeek(rota.week);
        return rota;
    }
}
