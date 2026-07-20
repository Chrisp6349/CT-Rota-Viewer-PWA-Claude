/* =====================================================
   Cardiothoracic Theatre Viewer
   insights.js
   -----------------------------------------------------
   "Theatre Intelligence" - four random fun facts drawn
   from every published week up to and including today
   (never future weeks). A fresh random 4 are picked
   every time the panel is opened.

   Fact types:
   - Simple counts: on-calls, theatre sessions, busiest
     day/theatre, this week
   - All-time counts: on-calls, sessions, since records
     began
   - Pairings: how often an ODP has worked with a given
     anaesthetist, across all published history
   ===================================================== */

class TheatreIntelligence {

    constructor() {
        this.index = 0;
        this.facts = [];
        this.loaded = false;
    }

    // Every published week with a start date on or before today
    static async loadHistory() {
        const todayIso = new Date().toISOString().split("T")[0];
        const weeks = await RotaAPI.loadPublishedWeeks();
        const pastOrPresent = weeks.filter(w => w.week <= todayIso);

        const rotas = await Promise.all(
            pastOrPresent.map(w => RotaAPI.loadWeek(w.week).catch(() => null))
        );

        return rotas.filter(Boolean);
    }

    // Tallies used to build facts, computed once per panel-open across
    // every loaded week.
    static buildStats(rotas) {

        const onCallCounts = {};       // odp -> count
        const sessionCounts = {};      // odp -> theatre session count
        const theatreCounts = {};      // theatre name -> count
        const dayCounts = {};          // day name -> session count
        const pairings = {};           // "odp|anaes" -> count
        const supportCounts = {};      // odp -> support-role count
        const personTheatreCounts = {};// "odp|theatre" -> count, for favourite theatre
        const listCounts = {};         // list type -> count
        const waitingListCounts = {};  // odp -> weekend waiting-list count
        let totalSessions = 0;
        let totalOnCalls = 0;
        let staffingGaps = 0;

        rotas.forEach(rota => {
            Object.entries(rota.days || {}).forEach(([day, value]) => {

                (value.theatres || []).forEach(t => {
                    const hasAllocation = t.odp1 || t.odp2 || t.anaesthetist || t.list;
                    if (!hasAllocation) return;

                    totalSessions++;
                    dayCounts[day] = (dayCounts[day] || 0) + 1;

                    const label = t.theatre === "Cath Lab"
                        ? "Cath Lab" : t.theatre.replace("Theatre ", "CT");
                    theatreCounts[label] = (theatreCounts[label] || 0) + 1;

                    if (t.list) listCounts[t.list] = (listCounts[t.list] || 0) + 1;

                    [t.odp1, t.odp2].filter(Boolean).forEach(odp => {
                        sessionCounts[odp] = (sessionCounts[odp] || 0) + 1;
                        const ptKey = odp + "|" + label;
                        personTheatreCounts[ptKey] = (personTheatreCounts[ptKey] || 0) + 1;
                        if (t.anaesthetist) {
                            const key = odp + "|" + t.anaesthetist;
                            pairings[key] = (pairings[key] || 0) + 1;
                        }
                    });

                    if (!t.odp1 && !t.odp2) staffingGaps++;
                });

                // Support-role counts (weekday support panel)
                const s = value.support || {};
                [s.odp1, s.odp2, s.odp3].filter(Boolean).forEach(odp => {
                    supportCounts[odp] = (supportCounts[odp] || 0) + 1;
                });

                const oc = value.onCall || {};
                if (oc.odp) {
                    onCallCounts[oc.odp] = (onCallCounts[oc.odp] || 0) + 1;
                    totalOnCalls++;
                }
                // Weekend on-call entries
                [oc.odp1, oc.odp2].filter(Boolean).forEach(odp => {
                    onCallCounts[odp] = (onCallCounts[odp] || 0) + 1;
                    totalOnCalls++;
                });

                // Weekend waiting-list cover
                if (value.weekend && value.waitingList && value.waitingList.odp) {
                    const odp = value.waitingList.odp;
                    waitingListCounts[odp] = (waitingListCounts[odp] || 0) + 1;
                }
            });
        });

        return {
            weekCount: rotas.length,
            onCallCounts, sessionCounts, theatreCounts, dayCounts, pairings,
            supportCounts, personTheatreCounts, listCounts, waitingListCounts,
            totalSessions, totalOnCalls, staffingGaps
        };
    }

    // Picks the top name from a { name: count } object
    static top(counts) {
        let name = null, best = 0;
        Object.entries(counts).forEach(([n, c]) => {
            if (c > best) { name = n; best = c; }
        });
        return name ? { name, count: best } : null;
    }

    // Builds the full pool of possible facts, given the tallies above.
    // Only facts with real data behind them are included.
    static buildFactPool(stats) {
        const facts = [];
        const since = stats.weekCount === 1
            ? "this week" : `across the last ${stats.weekCount} published weeks`;

        // --- On-call facts, per person ---
        Object.entries(stats.onCallCounts).forEach(([name, count]) => {
            facts.push({
                icon: "🚨",
                text: `${name} has done ${count} on-call${count === 1 ? "" : "s"} ${since}.`
            });
        });

        // --- Theatre session facts, per person ---
        Object.entries(stats.sessionCounts).forEach(([name, count]) => {
            facts.push({
                icon: "🏥",
                text: `${name} has worked ${count} theatre session${count === 1 ? "" : "s"} ${since}.`
            });
        });

        // --- Pairing facts ---
        Object.entries(stats.pairings).forEach(([key, count]) => {
            if (count < 2) return;   // only surface pairings that have actually repeated
            const [odp, anaes] = key.split("|");
            const emoji = (typeof anaesEmoji === "function") ? anaesEmoji(anaes) : "👨‍⚕️";
            const anaesFullName = (typeof anaesName === "function") ? anaesName(anaes) : anaes;
            facts.push({
                icon: "🤝",
                text: `${odp} has worked with ${emoji} ${anaesFullName} ${count} times ${since}.`
            });
        });

        // --- Support-role facts, per person ---
        Object.entries(stats.supportCounts).forEach(([name, count]) => {
            facts.push({
                icon: "🧑‍🤝‍🧑",
                text: `${name} has supported theatres ${count} time${count === 1 ? "" : "s"} ${since}.`
            });
        });

        // --- Favourite theatre, per person (only where it's a clear lead) ---
        (() => {
            const byPerson = {};   // odp -> { theatre: count }
            Object.entries(stats.personTheatreCounts).forEach(([key, count]) => {
                const [odp, theatre] = key.split("|");
                byPerson[odp] = byPerson[odp] || {};
                byPerson[odp][theatre] = count;
            });
            Object.entries(byPerson).forEach(([odp, theatres]) => {
                const fav = TheatreIntelligence.top(theatres);
                if (fav && fav.count > 1) {
                    facts.push({
                        icon: "❤️",
                        text: `${odp}'s favourite theatre is ${fav.name}, worked ${fav.count} times ${since}.`
                    });
                }
            });
        })();

        // --- Most common list type ---
        const topList = TheatreIntelligence.top(stats.listCounts);
        if (topList && topList.count > 1) {
            facts.push({
                icon: "📋",
                text: `${topList.name} has been the most common list type ${since}, run ${topList.count} times.`
            });
        }

        // --- Quietest theatre (only among theatres that HAVE run at least once) ---
        (() => {
            const entries = Object.entries(stats.theatreCounts);
            if (entries.length > 1) {
                let name = null, least = Infinity;
                entries.forEach(([n, c]) => { if (c < least) { least = c; name = n; } });
                facts.push({
                    icon: "🤫",
                    text: `${name} has been the quietest theatre ${since}, used just ${least} time${least === 1 ? "" : "s"}.`
                });
            }
        })();

        // --- Quietest day (only among days that HAVE had sessions) ---
        (() => {
            const entries = Object.entries(stats.dayCounts);
            if (entries.length > 1) {
                let name = null, least = Infinity;
                entries.forEach(([n, c]) => { if (c < least) { least = c; name = n; } });
                facts.push({
                    icon: "😴",
                    text: `${name} has been the quietest operating day ${since}.`
                });
            }
        })();

        // --- Top overall pairing (the single most frequent ODP+anaesthetist combo) ---
        const topPairing = TheatreIntelligence.top(stats.pairings);
        if (topPairing && topPairing.count > 1) {
            const [odp, anaes] = topPairing.name.split("|");
            const emoji = (typeof anaesEmoji === "function") ? anaesEmoji(anaes) : "👨‍⚕️";
            const anaesFullName = (typeof anaesName === "function") ? anaesName(anaes) : anaes;
            facts.push({
                icon: "🏅",
                text: `${odp} and ${emoji} ${anaesFullName} are the most frequent pairing ${since}, working together ${topPairing.count} times.`
            });
        }

        // --- Weekend waiting-list facts, per person ---
        Object.entries(stats.waitingListCounts).forEach(([name, count]) => {
            facts.push({
                icon: "📝",
                text: `${name} has covered the weekend waiting list ${count} time${count === 1 ? "" : "s"} ${since}.`
            });
        });

        // --- Busiest theatre overall ---
        const busiestTheatre = TheatreIntelligence.top(stats.theatreCounts);
        if (busiestTheatre) {
            facts.push({
                icon: "🏆",
                text: `${busiestTheatre.name} has been the busiest theatre ${since}, used ${busiestTheatre.count} times.`
            });
        }

        // --- Busiest day overall ---
        const busiestDay = TheatreIntelligence.top(stats.dayCounts);
        if (busiestDay) {
            facts.push({
                icon: "📅",
                text: `${busiestDay.name} has been the busiest day ${since}.`
            });
        }

        // --- Top on-call person ---
        const topOnCall = TheatreIntelligence.top(stats.onCallCounts);
        if (topOnCall && topOnCall.count > 1) {
            facts.push({
                icon: "👑",
                text: `${topOnCall.name} has done the most on-calls ${since}, with ${topOnCall.count}.`
            });
        }

        // --- Top workload person ---
        const topWorkload = TheatreIntelligence.top(stats.sessionCounts);
        if (topWorkload && topWorkload.count > 1) {
            facts.push({
                icon: "💪",
                text: `${topWorkload.name} has the busiest workload ${since}, with ${topWorkload.count} sessions.`
            });
        }

        // --- Overall totals ---
        facts.push({
            icon: "📊",
            text: `${stats.totalSessions} theatre session${stats.totalSessions === 1 ? "" : "s"} recorded ${since}.`
        });

        if (stats.totalOnCalls > 0) {
            facts.push({
                icon: "🌙",
                text: `${stats.totalOnCalls} on-call shift${stats.totalOnCalls === 1 ? "" : "s"} covered ${since}.`
            });
        }

        // --- Staffing ---
        facts.push(stats.staffingGaps > 0
            ? { icon: "⚠️", text: `${stats.staffingGaps} theatre session${stats.staffingGaps === 1 ? "" : "s"} ${since} had no ODP allocated.` }
            : { icon: "✅", text: `Every theatre session ${since} has been fully staffed. Nice work.` }
        );

        return facts;
    }

    // Time-of-day greeting, e.g. "Good morning"
    static timeGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }

    // A little rotating line under the greeting - one picked at random
    // each time the panel opens, independent of the facts themselves.
    static randomTagline() {
        const lines = [
            "here's what stood out recently.",
            "let's see what the data says.",
            "a peek behind the rota.",
            "here's something you might not know.",
            "the numbers have a few things to share.",
            "here's today's theatre trivia.",
            "let's find out who's been busy."
        ];
        return lines[Math.floor(Math.random() * lines.length)];
    }

    // Sets the greeting line, e.g. "Good afternoon — a peek behind the rota."
    static updateGreeting() {
        const el = document.getElementById("insightsGreeting");
        if (!el) return;
        el.textContent =
            `${TheatreIntelligence.timeGreeting()} — ${TheatreIntelligence.randomTagline()}`;
    }

    // Fisher-Yates shuffle, then take the first n
    static randomPick(arr, n) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy.slice(0, n);
    }

    // Loads history, builds the fact pool, and picks 4 at random.
    // Called fresh every time the panel is opened.
    async refresh() {
        this.index = 0;
        this.facts = [{ icon: "🫀", text: "Loading theatre intelligence…" }];
        this.render();

        try {
            const rotas = await TheatreIntelligence.loadHistory();

            if (!rotas.length) {
                this.facts = [{ icon: "🫀", text: "No published rota data yet." }];
                this.render();
                return;
            }

            const stats = TheatreIntelligence.buildStats(rotas);
            const pool = TheatreIntelligence.buildFactPool(stats);
            this.facts = TheatreIntelligence.randomPick(pool, Math.min(4, pool.length));
            this.loaded = true;
        } catch (err) {
            console.error(err);
            this.facts = [{ icon: "⚠️", text: "Unable to load theatre intelligence right now." }];
        }

        this.render();
    }

    render() {
        const fact = this.facts[this.index];
        if (!fact) return;

        document.querySelector(".insight-icon").textContent = fact.icon;
        document.getElementById("insightTitle").textContent = "Did you know?";
        document.getElementById("insightText").textContent = fact.text;

        document.querySelectorAll(".dot").forEach((dot, i) => {
            dot.classList.toggle("active", i === this.index);
            dot.classList.toggle("hidden", i >= this.facts.length);
        });
    }

    next() {
        if (!this.facts.length) return;
        this.index = (this.index + 1) % this.facts.length;
        this.render();
    }

    previous() {
        if (!this.facts.length) return;
        this.index = (this.index - 1 + this.facts.length) % this.facts.length;
        this.render();
    }
}

const theatreIntelligence = new TheatreIntelligence();

window.addEventListener("DOMContentLoaded", () => {

    const panel = document.getElementById("insightsPanel");
    const overlay = document.getElementById("insightsOverlay");

    function closePanel() {
        panel.classList.remove("show");
        overlay.classList.remove("show");
        setTimeout(() => {
            panel.classList.add("hidden");
            overlay.classList.add("hidden");
        }, 300);
    }

    document.getElementById("insightsBtn").addEventListener("click", () => {
        panel.classList.remove("hidden");
        overlay.classList.remove("hidden");

        requestAnimationFrame(() => {
            panel.classList.add("show");
            overlay.classList.add("show");
        });

        // Fresh greeting + random facts every time the panel opens
        TheatreIntelligence.updateGreeting();
        theatreIntelligence.refresh();
    });

    overlay.addEventListener("click", closePanel);

    document.getElementById("nextInsightBtn").addEventListener("click", () => {
        theatreIntelligence.next();
    });

    document.getElementById("prevInsightBtn").addEventListener("click", () => {
        theatreIntelligence.previous();
    });
});
