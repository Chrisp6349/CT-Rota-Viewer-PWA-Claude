class TheatreIntelligence {

    constructor() {
        this.index = 0;
        this.insights = [];
    }

    generateInsights() {

        const rota = window.currentRota;

        if (!rota || !rota.days) {
            return [{
                icon: "⚠️",
                title: "No Data",
                text: "No rota has been loaded yet."
            }];
        }

        let totalSessions = 0;
        let busiestDay = "";
        let busiestCount = 0;

        const odpWorkload = {};
        const theatreUsage = {};
        let onCallCount = 0;
        const alerts = [];

        for (const [day, value] of Object.entries(rota.days)) {

            let dayCount = 0;

            (value.theatres || []).forEach(theatre => {

                const hasAllocation =
                    theatre.odp1 ||
                    theatre.odp2 ||
                    theatre.anaesthetist ||
                    theatre.list;

                if (!hasAllocation) return;

                dayCount++;
                totalSessions++;

                const theatreName = theatre.name || "Unknown";
                theatreUsage[theatreName] =
                    (theatreUsage[theatreName] || 0) + 1;

                if (theatre.odp1) {
                    odpWorkload[theatre.odp1] =
                        (odpWorkload[theatre.odp1] || 0) + 1;
                }

                if (theatre.odp2) {
                    odpWorkload[theatre.odp2] =
                        (odpWorkload[theatre.odp2] || 0) + 1;
                }

                if (!theatre.odp1) {
                    alerts.push(`${day}: ${theatreName} has no allocated ODP.`);
                }

            });

            if (dayCount > busiestCount) {
                busiestCount = dayCount;
                busiestDay = day;
            }

            if (value.onCall && value.onCall.odp) {
                onCallCount++;
            }
        }

        const uniqueODPs = Object.keys(odpWorkload).length;

        let leader = "-";
        let leaderCount = 0;

        Object.entries(odpWorkload).forEach(([name, count]) => {
            if (count > leaderCount) {
                leader = name;
                leaderCount = count;
            }
        });

        let busiestTheatre = "-";
        let theatreCount = 0;

        Object.entries(theatreUsage).forEach(([name, count]) => {
            if (count > theatreCount) {
                busiestTheatre = name;
                theatreCount = count;
            }
        });

        return [

            {
                icon: "📊",
                title: "Weekly Snapshot",
                text:
`🏥 Theatre Sessions: ${totalSessions}

👥 Senior ODPs: ${uniqueODPs}

🚨 On Calls: ${onCallCount}

⭐ Busiest Day: ${busiestDay}`
            },

            {
                icon: "👑",
                title: "Workload Leader",
                text:
`${leader}

${leaderCount} theatre allocation${leaderCount === 1 ? "" : "s"} this week.`
            },

            {
                icon: "🏥",
                title: "Theatre Usage",
                text:
`${busiestTheatre}

Used ${theatreCount} time${theatreCount === 1 ? "" : "s"} this week.`
            },

            {
                icon: alerts.length ? "⚠️" : "✅",
                title: "Staffing Alert",
                text: alerts.length
                    ? alerts[0]
                    : "Excellent! All allocated theatres have an ODP."
            }

        ];
    }

    showCurrent() {

        this.insights = this.generateInsights();

        if (this.index >= this.insights.length) {
            this.index = 0;
        }

        const insight = this.insights[this.index];

        document.querySelector(".insight-icon").textContent = insight.icon;
        document.getElementById("insightTitle").textContent = insight.title;
        document.getElementById("insightText").textContent = insight.text;
    }

    next() {

        this.index++;

        if (this.index >= this.insights.length) {
            this.index = 0;
        }

        this.showCurrent();
    }

}

const theatreIntelligence = new TheatreIntelligence();

window.addEventListener("DOMContentLoaded", () => {

    const panel = document.getElementById("insightsPanel");
    const overlay = document.getElementById("insightsOverlay");

    document.getElementById("insightsBtn").addEventListener("click", () => {

        panel.classList.remove("hidden");
        overlay.classList.remove("hidden");

        requestAnimationFrame(() => {

            panel.classList.add("show");
            overlay.classList.add("show");

        });

        theatreIntelligence.showCurrent();

    });

    function closePanel() {

        panel.classList.remove("show");
        overlay.classList.remove("show");

        setTimeout(() => {

            panel.classList.add("hidden");
            overlay.classList.add("hidden");

        }, 300);

    }

    overlay.addEventListener("click", closePanel);

    document
        .getElementById("nextInsightBtn")
        .addEventListener("click", () => {

            theatreIntelligence.next();

        });

});
