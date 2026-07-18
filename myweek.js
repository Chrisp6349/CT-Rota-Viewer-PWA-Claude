/* =====================================================
   Cardiothoracic Theatre Viewer
   myweek.js
   -----------------------------------------------------
   "My Week": pick your name once and see your own week -
   which theatre each day, support days, on-call nights.
   The chosen name lives in localStorage on this device
   only, so everyone's phone shows their own rota.
   ===================================================== */

class MyWeek {

    static rota = null;

    // Called by app.js whenever a week has been rendered
    static setData(rota) {
        MyWeek.rota = rota;
        const btn = document.getElementById("myWeekBtn");
        if (btn) {
            const name = localStorage.getItem("myName");
            btn.textContent = name ? `⭐ ${name}` : "⭐ My Week";
        }
    }

    // Every ODP name that appears anywhere in the loaded week
    static namesIn(rota) {
        const found = new Set();
        Object.values(rota.days).forEach(v => {
            (v.theatres || []).forEach(t => {
                if (t.odp1) found.add(t.odp1);
                if (t.odp2) found.add(t.odp2);
            });
            const s = v.support || {};
            [s.odp1, s.odp2, s.odp3].forEach(n => n && found.add(n));
            const oc = v.onCall || {};
            [oc.odp, oc.odp1, oc.odp2].forEach(n => n && found.add(n));
            if (v.waitingList?.odp) found.add(v.waitingList.odp);
        });
        return [...found].sort();
    }

    // Everything `name` is doing in the loaded week
    static assignmentsFor(rota, name) {
        const out = [];
        const order = ["Monday","Tuesday","Wednesday","Thursday",
                       "Friday","Saturday","Sunday"];

        order.forEach(day => {
            const v = rota.days[day];
            if (!v) return;

            (v.theatres || []).forEach(t => {
                if (t.odp1 === name || t.odp2 === name) {
                    const label = t.theatre.replace("Theatre ", "CT");
                    out.push({ day, what: `${label}${t.list ? " · " + t.list : ""}`, icon: "🏥" });
                }
            });

            const s = v.support || {};
            if ([s.odp1, s.odp2, s.odp3].includes(name))
                out.push({ day, what: `Support${s.list ? " · " + s.list : ""}`, icon: "👥" });

            const oc = v.onCall || {};
            if (oc.odp === name)
                out.push({ day, what: `On Call${oc.fromHome ? " · FROM HOME" : ""}`, icon: "🚨" });
            if (oc.odp1 === name)
                out.push({ day, what: `On Call${oc.session1 ? " · " + oc.session1 : ""}`, icon: "🚨" });
            if (oc.odp2 === name)
                out.push({ day, what: `On Call${oc.session2 ? " · " + oc.session2 : ""}`, icon: "🚨" });

            if (v.waitingList?.odp === name)
                out.push({ day, what: "Waiting List", icon: "📋" });
        });

        return out;
    }

    static open() {
        if (!MyWeek.rota) return;

        const name = localStorage.getItem("myName");
        const overlay = document.createElement("div");
        overlay.id = "myWeekOverlay";
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        if (!name) {
            // First run: pick your name
            const names = MyWeek.namesIn(MyWeek.rota);
            overlay.innerHTML = `
                <div class="myweek-card">
                    <h2>⭐ Who are you?</h2>
                    <p class="myweek-hint">Pick your name once - this device will remember it.</p>
                    <div class="myweek-names">
                        ${names.map(n => `<button class="myweek-name" data-name="${n}">${n}</button>`).join("")}
                    </div>
                    <button class="myweek-close">Cancel</button>
                </div>`;
            document.body.appendChild(overlay);

            overlay.querySelectorAll(".myweek-name").forEach(b => {
                b.onclick = () => {
                    localStorage.setItem("myName", b.dataset.name);
                    overlay.remove();
                    MyWeek.setData(MyWeek.rota);
                    MyWeek.open();
                };
            });
            overlay.querySelector(".myweek-close").onclick = () => overlay.remove();
            return;
        }

        const jobs = MyWeek.assignmentsFor(MyWeek.rota, name);
        const rows = jobs.length
            ? jobs.map(j => `
                <div class="myweek-row ${j.icon === "🚨" ? "myweek-oncall" : ""}">
                    <span class="myweek-day">${j.day.substring(0,3)}</span>
                    <span class="myweek-what">${j.icon} ${j.what}</span>
                </div>`).join("")
            : `<div class="myweek-row"><span class="myweek-what">No allocations this week 🎉</span></div>`;

        overlay.innerHTML = `
            <div class="myweek-card">
                <h2>⭐ ${name}'s Week</h2>
                <p class="myweek-hint">W/C ${ViewerUtils.formatWeek(MyWeek.rota.week)}</p>
                <div class="myweek-list">${rows}</div>
                <div class="myweek-actions">
                    <button class="myweek-switch">Not ${name}? Switch</button>
                    <button class="myweek-close">Close</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.querySelector(".myweek-switch").onclick = () => {
            localStorage.removeItem("myName");
            overlay.remove();
            MyWeek.setData(MyWeek.rota);
            MyWeek.open();
        };
        overlay.querySelector(".myweek-close").onclick = () => overlay.remove();
    }
}
