/* =====================================================
   Cardiothoracic Theatre Viewer
   app.js
   -----------------------------------------------------
   Page controller for the daily dashboard (index.html):
   - loads the latest published rota on startup
   - archive navigation (dropdown + prev/next arrows)
   - splash screen (hides when the data has loaded)
   - update banner + footer refresh button

   Rendering itself lives in viewer.js; fetching lives
   in api.js.
   ===================================================== */

/* ==========================================
   Startup and navigation
========================================== */

document.addEventListener("DOMContentLoaded", async () => {

    const loading = document.getElementById("loading");
    const error = document.getElementById("error");
    const previousBtn = document.getElementById("prevWeek");
    const nextBtn = document.getElementById("nextWeek");
    const weekSelect = document.getElementById("weekSelect");

    let publishedWeeks = [];
    let currentIndex = 0;

    // Hides the splash screen. Called once the first load finishes
    // (success OR failure), so the splash reflects reality instead
    // of a fixed timer.
    function hideSplash() {
        const splash = document.getElementById("splash-screen");
        if (splash) splash.classList.add("hidden");
        document.body.classList.remove("loading");
    }

    // If the loaded week is the CURRENT week, open on today's tab -
    // that's what someone glancing at the board wants. For any other
    // (past/future) week, Monday is the sensible start.
    function defaultDayFor(week) {
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday",
                          "Thursday", "Friday", "Saturday"];
        const now = new Date();

        // Monday of the current real-world week, as YYYY-MM-DD
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        const currentWeek = monday.toISOString().split("T")[0];

        return week === currentWeek ? dayNames[now.getDay()] : "Monday";
    }

    // Loads and shows the most recently published rota
    async function showLatest() {
        loading.classList.remove("hidden");
        error.classList.add("hidden");

        try {
            const rota = await RotaAPI.loadRota();

            // Point the archive dropdown at this week if it's listed
            const idx = publishedWeeks.findIndex(w => w.week === rota.week);
            if (idx >= 0) {
                currentIndex = idx;
                if (weekSelect) weekSelect.selectedIndex = idx;
            }

            window.selectedDay = defaultDayFor(rota.week);
            Viewer.render(rota);
        } catch (err) {
            console.error(err);
            error.classList.remove("hidden");
        } finally {
            loading.classList.add("hidden");
            hideSplash();
        }
    }

    // Loads and shows one specific archived week
    async function showWeek(week) {
        loading.classList.remove("hidden");
        error.classList.add("hidden");

        try {
            const rota = await RotaAPI.loadWeek(week);
            Viewer.render(rota);
        } catch (err) {
            console.error(err);
            error.classList.remove("hidden");
        } finally {
            loading.classList.add("hidden");
        }
    }

    // Fills the archive dropdown. De-duplication and sorting happen
    // inside RotaAPI.loadPublishedWeeks().
    async function loadArchive() {
        try {
            publishedWeeks = await RotaAPI.loadPublishedWeeks();

            if (!weekSelect) return;
            weekSelect.innerHTML = "";

            publishedWeeks.forEach((item) => {
                const option = document.createElement("option");
                option.value = item.week;
                option.textContent = `W/C ${ViewerUtils.formatWeek(item.week)}`;
                weekSelect.appendChild(option);
            });

            if (publishedWeeks.length > 0) {
                currentIndex = publishedWeeks.length - 1;
                weekSelect.selectedIndex = currentIndex;
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Shared slide animation for the prev/next arrows
    function slideTo(indexDelta, cssClass) {
        const target = currentIndex + indexDelta;
        if (target < 0 || target > publishedWeeks.length - 1) return;

        const container = document.getElementById("rotaContainer");
        container.classList.add(cssClass);

        setTimeout(async () => {
            currentIndex = target;
            weekSelect.selectedIndex = currentIndex;
            window.selectedDay = "Monday";
            await showWeek(publishedWeeks[currentIndex].week);
            container.classList.remove(cssClass);
        }, 200);
    }

    previousBtn.onclick = () => slideTo(-1, "slide-right");
    nextBtn.onclick = () => slideTo(1, "slide-left");

    if (weekSelect) {
        weekSelect.onchange = () => {
            currentIndex = weekSelect.selectedIndex;
            window.selectedDay = "Monday";
            showWeek(publishedWeeks[currentIndex].week);
        };
    }

    // Startup: archive list first (so the dropdown is ready), then
    // the latest rota
    await loadArchive();
    await showLatest();
});

/* ==========================================
   Smart update system
   ------------------------------------------
   When the service worker has downloaded a new version of the app,
   a banner offers "Refresh Now" - pressing it activates the new
   version and reloads. The footer 🔄 button forces an update check.
========================================== */

const UpdateUI = {

    banner: null,

    create() {
        if (this.banner) return;

        this.banner = document.createElement("div");
        this.banner.id = "updateBanner";
        this.banner.innerHTML = `
            <div class="update-card">
                <div class="update-title">🚀 Update Available</div>
                <div class="update-text">
                    A newer version of Cardiac Theatre Dashboard is ready.
                </div>
                <button id="refreshApp">Refresh Now</button>
            </div>
        `;
        this.banner.style.display = "none";
        document.body.appendChild(this.banner);

        document.getElementById("refreshApp")
            .addEventListener("click", async () => {

            const registration =
                await navigator.serviceWorker.getRegistration();

            if (registration && registration.waiting) {
                // Tell the waiting worker to take over, then reload
                // once it has - exactly once.
                let refreshing = false;
                navigator.serviceWorker.addEventListener("controllerchange", () => {
                    if (refreshing) return;
                    refreshing = true;
                    window.location.reload();
                });
                registration.waiting.postMessage({ type: "SKIP_WAITING" });
            } else {
                window.location.reload();
            }
        });
    },

    show() { if (this.banner) this.banner.style.display = "block"; },
    hide() { if (this.banner) this.banner.style.display = "none"; }
};

// One listener wires up both the banner and the footer refresh button
document.addEventListener("DOMContentLoaded", () => {

    UpdateUI.create();

    const refreshBtn = document.getElementById("refreshAppBtn");
    if (!refreshBtn) return;

    refreshBtn.addEventListener("click", async () => {
        refreshBtn.style.transform = "rotate(360deg)";

        try {
            const registration =
                await navigator.serviceWorker.getRegistration();
            if (registration) await registration.update();
        } catch (err) {
            console.error("Refresh check failed:", err);
        }

        setTimeout(() => {
            refreshBtn.style.transform = "";
            window.location.reload();
        }, 500);
    });
});
