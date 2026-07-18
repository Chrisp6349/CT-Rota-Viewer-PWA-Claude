/* =====================================================
   Cardiothoracic Theatre Viewer
   oncall-now.js
   -----------------------------------------------------
   The "ON CALL NOW" hero card.

   Department on-call hours:
     - Weekdays: 19:00 -> 06:30 the next morning
     - Weekend:  Friday 19:00 -> Monday 06:30, continuously

   Outside those hours (weekday daytime) the card shows
   TONIGHT'S cover as upcoming instead. The card only
   appears when the loaded rota is the current real-world
   week - it hides itself on archived weeks.
   ===================================================== */

class OnCallNow {

    // Monday (YYYY-MM-DD) of the week containing `d`
    static mondayOf(d) {
        const m = new Date(d);
        m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return m.toISOString().split("T")[0];
    }

    // Decides what cover applies at this moment.
    // Returns null when the card should not show, otherwise:
    //   { active, label, dayKey, weekend }
    static status(now) {
        const day = now.getDay();              // 0=Sun ... 6=Sat
        const mins = now.getHours() * 60 + now.getMinutes();
        const names = ["Sunday","Monday","Tuesday","Wednesday",
                       "Thursday","Friday","Saturday"];

        const NIGHT_START = 19 * 60;           // 19:00
        const NIGHT_END   = 6 * 60 + 30;       // 06:30

        // Weekend block: Fri 19:00 -> Mon 06:30
        const inWeekend =
            (day === 5 && mins >= NIGHT_START) ||   // Friday evening
            day === 6 || day === 0 ||               // all Sat & Sun
            (day === 1 && mins < NIGHT_END);        // early Monday

        if (inWeekend) {
            // Saturday's weekend entry covers Fri night + Sat;
            // Sunday's covers Sun + early Monday.
            const dayKey =
                (day === 0 || (day === 1 && mins < NIGHT_END))
                    ? "Sunday" : "Saturday";
            return { active: true, label: "ON CALL NOW", dayKey, weekend: true };
        }

        // Weekday overnight: before 06:30, last night's cover still applies
        if (mins < NIGHT_END) {
            const prev = names[(day + 6) % 7];
            return { active: true, label: "ON CALL NOW", dayKey: prev, weekend: false };
        }

        // Weekday evening: tonight's cover is live
        if (mins >= NIGHT_START) {
            return { active: true, label: "ON CALL NOW", dayKey: names[day], weekend: false };
        }

        // Weekday daytime: show tonight's cover as upcoming
        return { active: false, label: "TONIGHT'S ON CALL", dayKey: names[day], weekend: false };
    }

    // Renders (or hides) the hero card for the given rota
    static update(rota) {
        const mount = document.getElementById("onCallNowMount");
        if (!mount) return;

        const now = new Date();

        // Only for the current real-world week
        if (rota.week !== OnCallNow.mondayOf(now)) {
            mount.innerHTML = "";
            return;
        }

        const s = OnCallNow.status(now);
        const value = rota.days[s.dayKey];
        if (!value) { mount.innerHTML = ""; return; }

        let people = "";

        if (s.weekend) {
            const oc = value.onCall || {};
            people += `<div class="now-person">👤 ${oc.odp1 || oc.odp || "-"}${oc.session1 ? ` <span class="now-session">${oc.session1}</span>` : ""}</div>`;
            if (oc.odp2)
                people += `<div class="now-person">👤 ${oc.odp2}${oc.session2 ? ` <span class="now-session">${oc.session2}</span>` : ""}</div>`;
            people += `<div class="now-anaes">${oc.anaesthetist ? anaesEmoji(oc.anaesthetist) : "👨‍⚕️"} ${oc.anaesthetist || "-"}</div>`;
        } else {
            const oc = value.onCall || {};
            people += `<div class="now-person">👤 ${oc.odp || "-"}</div>`;
            if (oc.extra) people += `<div class="now-extra">🟡 ${oc.extra}</div>`;
            if (oc.fromHome) people += `<div class="now-fromhome">🏠 FROM HOME</div>`;
            people += `<div class="now-anaes">${oc.anaesthetist ? anaesEmoji(oc.anaesthetist) : "👨‍⚕️"} ${oc.anaesthetist || "-"}</div>`;
        }

        mount.innerHTML = `
            <div class="oncall-now ${s.active ? "now-active" : "now-upcoming"}">
                <div class="now-badge">
                    ${s.active ? `<span class="now-pulse"></span>` : ""}
                    ${s.label}
                </div>
                <div class="now-people">${people}</div>
            </div>
        `;
    }
}
