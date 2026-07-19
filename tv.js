/* =====================================================
   Cardiothoracic Theatre Viewer
   tv.js
   -----------------------------------------------------
   Wall-board controller. Shows TODAY (or the weekend
   cover at weekends), refreshes the data every 5 minutes,
   and keeps a live clock. No buttons, no interaction -
   designed to be left running on a screen.
   ===================================================== */

const TV_REFRESH_MS = 5 * 60 * 1000;

// Live clock + date line
function tvTick() {
    const now = new Date();
    document.getElementById("tvClock").textContent =
        now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("tvDate").textContent =
        now.toLocaleDateString("en-GB",
            { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
setInterval(tvTick, 1000);
tvTick();

function tvDayKey(now) {
    const names = ["Sunday","Monday","Tuesday","Wednesday",
                   "Thursday","Friday","Saturday"];
    return names[now.getDay()];
}

async function tvLoad() {
    try {
        const rota = await RotaAPI.loadRota();
        const now = new Date();
        const day = tvDayKey(now);
        const value = rota.days[day];

        // On-call panel reuses the same rules as the dashboard card
              const s = OnCallNow.status(now);
        // Guard: the cover period may belong to a different week than
        // the loaded rota (e.g. early Monday = last week's Sunday)
        const ocValue = (rota.week === OnCallNow.coverWeek(now))
            ? (rota.days[s.dayKey] || {}) : {};

        const oc = ocValue.onCall || {};
        let ocPeople;
        if (s.weekend) {
            ocPeople = `${oc.odp1 || oc.odp || "-"}${oc.session1 ? " (" + oc.session1 + ")" : ""}` +
                       (oc.odp2 ? ` · ${oc.odp2}${oc.session2 ? " (" + oc.session2 + ")" : ""}` : "") +
                       ` &nbsp;|&nbsp; ${oc.anaesthetist ? anaesEmoji(oc.anaesthetist) : "👨‍⚕️"} ${oc.anaesthetist || "-"}`;
        } else {
            ocPeople = `${oc.odp || "-"}${oc.fromHome ? " 🏠" : ""} &nbsp;|&nbsp; ${oc.anaesthetist ? anaesEmoji(oc.anaesthetist) : "👨‍⚕️"} ${oc.anaesthetist || "-"}`;
        }
        document.getElementById("tvOnCall").innerHTML = `
            <div class="tv-oncall ${s.active ? "tv-oncall-active" : ""}">
                <span class="tv-oncall-label">${s.active ? "🚨 ON CALL NOW" : "🚨 TONIGHT'S ON CALL"}</span>
                <span class="tv-oncall-people">${ocPeople}</span>
            </div>`;

        // Main grid: weekend cover or today's theatres
        const grid = document.getElementById("tvGrid");

        if (!value) {
            grid.innerHTML = `<div class="tv-empty">No published rota for today</div>`;
        } else if (value.weekend) {
            const wl = value.waitingList || {};
            grid.innerHTML = `
                <div class="tv-card tv-wide">
                    <div class="tv-card-head">🛡️ WEEKEND COVER — ${day.toUpperCase()}</div>
                    <div class="tv-card-body">
                        <div class="tv-line">📋 Waiting List: ${wl.odp || "-"} &nbsp;|&nbsp; ${wl.anaesthetist ? anaesEmoji(wl.anaesthetist) : "👨‍⚕️"} ${wl.anaesthetist || "-"}</div>
                    </div>
                </div>`;
        } else {
            grid.innerHTML = (value.theatres || []).map(t => {
                const empty = !t.odp1 && !t.odp2 && !t.anaesthetist && !t.list;
                return `
                <div class="tv-card">
                    <div class="tv-card-head">${t.theatre === "Cath Lab" ? "CATH LAB" : t.theatre.replace("Theatre ", "CT")}</div>
                    <div class="tv-card-body">
                        ${empty ? `<div class="tv-line tv-dim">No allocation</div>` : `
                            ${t.odp1 ? `<div class="tv-line">👤 ${t.odp1}</div>` : ""}
                            ${t.odp2 ? `<div class="tv-line">👤 ${t.odp2}</div>` : ""}
                            ${t.anaesthetist ? `<div class="tv-line">${anaesEmoji(t.anaesthetist)} ${t.anaesthetist}</div>` : ""}
                            ${t.list ? `<div class="tv-line tv-list">📋 ${t.list}</div>` : ""}
                        `}
                    </div>
                </div>`;
            }).join("") + `
                <div class="tv-card">
                    <div class="tv-card-head">👥 SUPPORT</div>
                    <div class="tv-card-body">
                        ${[value.support?.odp1, value.support?.odp2, value.support?.odp3]
                            .filter(Boolean)
                            .map(n => `<div class="tv-line">👤 ${n}</div>`)
                            .join("") || `<div class="tv-line tv-dim">No allocation</div>`}
                        ${value.support?.list ? `<div class="tv-line tv-list">📋 ${value.support.list}</div>` : ""}
                    </div>
                </div>`;
        }

        document.getElementById("tvUpdated").textContent =
            "Updated " + new Date().toLocaleTimeString("en-GB",
                { hour: "2-digit", minute: "2-digit" });
    } catch (err) {
        console.error(err);
        document.getElementById("tvUpdated").textContent = "⚠ Unable to refresh - showing last data";
    }
}

tvLoad();
setInterval(tvLoad, TV_REFRESH_MS);
