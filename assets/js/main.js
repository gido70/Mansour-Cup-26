(async function(){
  const cfg = window.APP_CONFIG;
  // set titles
  document.title = cfg.tournamentName;
  document.querySelectorAll("[data-tournament]").forEach(el=> el.textContent = cfg.tournamentName);
  document.querySelectorAll("[data-season]").forEach(el=> el.textContent = cfg.seasonLabel);

  const state = {
    q: "",
    groups: [],
    teams: [],
    players: [],
    matches: [],
    goals: [],
    cards: [],
    computed: {
      standingsByGroup: new Map(),
      topScorers: [],
      kpis: { matches:0, goals:0, teams:0, players:0 }
    }
  };

  async function fetchCSV(url){
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch: ${url}`);
    const text = await res.text();
    return CSV.parse(text);
  }

  function normalize(){
    // Simple joins
    const teamById = new Map(state.teams.map(t => [t.team_id, t]));
    const playerById = new Map(state.players.map(p => [p.player_id, p]));
    const groupById = new Map(state.groups.map(g => [g.group_id, g]));

    // Enrich matches
    state.matches = state.matches.map(m => {
      const home = teamById.get(m.home_team_id) || {};
      const away = teamById.get(m.away_team_id) || {};
      const g = groupById.get(m.group_id) || {};
      return { ...m,
        home_name: home.team_name || m.home_team_id,
        away_name: away.team_name || m.away_team_id,
        group_name: g.group_name || m.group_id
      };
    });

    // Enrich goals
    state.goals = state.goals.map(g => {
      const p = playerById.get(g.player_id) || {};
      const t = teamById.get(p.team_id) || teamById.get(g.team_id) || {};
      const match = state.matches.find(m => m.match_id === g.match_id) || {};
      return { ...g,
        player_name: p.player_name || g.player_id,
        team_id: p.team_id || g.team_id || "",
        team_name: t.team_name || "",
        match_label: match.match_label || match.match_id || ""
      };
    });

    // Enrich cards
    state.cards = state.cards.map(c => {
      const p = playerById.get(c.player_id) || {};
      const t = teamById.get(p.team_id) || teamById.get(c.team_id) || {};
      const match = state.matches.find(m => m.match_id === c.match_id) || {};
      return { ...c,
        player_name: p.player_name || c.player_id,
        team_id: p.team_id || c.team_id || "",
        team_name: t.team_name || "",
        match_label: match.match_label || match.match_id || ""
      };
    });

    // KPIs
    state.computed.kpis = {
      matches: state.matches.length,
      goals: state.goals.length,
      teams: state.teams.length,
      players: state.players.length
    };
  }

  function computeStandings(){
    // group standings from matches results
    const byGroup = U.groupBy(state.matches, m => m.group_id || "");
    const standingsByGroup = new Map();

    for (const [groupId, matches] of byGroup.entries()){
      const rows = new Map(); // team_id -> stats
      const ensure = (team_id, team_name) => {
        if (!rows.has(team_id)){
          rows.set(team_id, {
            team_id, team_name,
            played:0, won:0, draw:0, lost:0,
            gf:0, ga:0, gd:0, pts:0
          });
        }
        const r = rows.get(team_id);
        if (!r.team_name) r.team_name = team_name;
        return r;
      };

      for (const m of matches){
        const hs = String(m.home_score ?? "").trim();
        const as = String(m.away_score ?? "").trim();
        // Only compute when both scores are present
        if (hs === "" || as === "") continue;

        const h = ensure(m.home_team_id, m.home_name);
        const a = ensure(m.away_team_id, m.away_name);
        const hsc = U.num(hs);
        const asc = U.num(as);

        h.played++; a.played++;
        h.gf += hsc; h.ga += asc;
        a.gf += asc; a.ga += hsc;

        if (hsc > asc){ h.won++; a.lost++; h.pts += 3; }
        else if (hsc < asc){ a.won++; h.lost++; a.pts += 3; }
        else { h.draw++; a.draw++; h.pts += 1; a.pts += 1; }
      }

      // finalize gd
      for (const r of rows.values()){
        r.gd = r.gf - r.ga;
      }

      const arr = Array.from(rows.values());
      arr.sort((x,y)=> (y.pts - x.pts) || (y.gd - x.gd) || (y.gf - x.gf) || (x.team_name||"").localeCompare(y.team_name||""));
      standingsByGroup.set(groupId, arr);
    }

    state.computed.standingsByGroup = standingsByGroup;
  }

  function computeTopScorers(){
    const counts = new Map(); // player_id -> goals
    for (const g of state.goals){
      // goal_type expected "G" for goal; allow blank as goal
      const type = (g.goal_type || "G").toUpperCase();
      if (type !== "G") continue;
      counts.set(g.player_id, (counts.get(g.player_id) || 0) + 1);
    }
    const playerById = new Map(state.players.map(p => [p.player_id, p]));
    const teamById = new Map(state.teams.map(t => [t.team_id, t]));
    const arr = Array.from(counts.entries()).map(([pid, n]) => {
      const p = playerById.get(pid) || {};
      const t = teamById.get(p.team_id) || {};
      return {
        player_id: pid,
        player_name: p.player_name || pid,
        team_name: t.team_name || "",
        goals: n
      };
    });
    arr.sort((a,b)=> b.goals - a.goals || (a.player_name||"").localeCompare(b.player_name||""));
    state.computed.topScorers = arr.slice(0, 30);
  }

  function applySearchFilter(rows, keys){
    const q = state.q.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => keys.some(k => String(r[k] ?? "").toLowerCase().includes(q)));
  }

  function renderKPIs(){
    const k = state.computed.kpis;
    U.$("#kpiMatches").textContent = k.matches;
    U.$("#kpiGoals").textContent = k.goals;
    U.$("#kpiTeams").textContent = k.teams;
    U.$("#kpiPlayers").textContent = k.players;
  }

  function renderMatches(){
    const rows = state.matches
      .slice()
      .sort((a,b)=> (U.dateKey(a.match_date).localeCompare(U.dateKey(b.match_date))) || (a.match_time||"").localeCompare(b.match_time||""));

    const filtered = applySearchFilter(rows, ["match_label","home_name","away_name","venue","group_name"]);
    const tbody = U.$("#tblMatches tbody");
    tbody.innerHTML = "";

    for (const m of filtered){
      const tr = document.createElement("tr");
      const score = (String(m.home_score||"")!=="" && String(m.away_score||"")!=="") ? `${m.home_score} - ${m.away_score}` : "—";
      tr.innerHTML = `
        <td>${m.match_label||m.match_id||""}</td>
        <td>${m.group_name||""}</td>
        <td>${U.fmtDate(m.match_date)} ${m.match_time||""}</td>
        <td>${m.venue||""}</td>
        <td>${m.home_name||""}</td>
        <td>${score}</td>
        <td>${m.away_name||""}</td>
        <td>${m.stage||""}</td>
        <td>${m.best_player||""}</td>
      `;
      tbody.appendChild(tr);
    }
    U.$("#matchesCount").textContent = `${filtered.length} مباراة`;
  }

  function renderGroups(){
    // Groups overview: teams per group + computed standings (if any)
    const groupMap = U.groupBy(state.teams, t => t.group_id || "");
    const wrap = U.$("#groupsWrap");
    wrap.innerHTML = "";

    const groups = state.groups.slice().sort((a,b)=> (a.group_name||"").localeCompare(b.group_name||""));
    for (const g of groups){
      const teams = groupMap.get(g.group_id) || [];
      const card = document.createElement("div");
      card.className = "card";
      const standings = state.computed.standingsByGroup.get(g.group_id) || [];

      const teamsList = teams
        .slice()
        .sort((a,b)=> (a.team_name||"").localeCompare(b.team_name||""))
        .map(t=> `<span class="pill">${t.team_name}</span>`).join(" ");

      const tableRows = standings.map((r,idx)=> `
        <tr>
          <td>${idx+1}</td>
          <td>${r.team_name||""}</td>
          <td>${r.played}</td>
          <td>${r.won}</td>
          <td>${r.draw}</td>
          <td>${r.lost}</td>
          <td>${r.gf}</td>
          <td>${r.ga}</td>
          <td>${r.gd}</td>
          <td><b>${r.pts}</b></td>
        </tr>
      `).join("");

      card.innerHTML = `
        <div class="card-h">
          <b>${g.group_name || ("مجموعة " + g.group_id)}</b>
          <span class="badge">${teams.length} فرق</span>
        </div>
        <div class="card-b">
          <div style="margin-bottom:10px; display:flex; gap:8px; flex-wrap:wrap;">${teamsList || '<span class="note">لا توجد فرق ضمن هذه المجموعة في البيانات.</span>'}</div>
          <div class="note" style="margin-bottom:8px">الترتيب هنا يُحسب تلقائيًا من نتائج المباريات (عند إدخال النتائج).</div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>له</th><th>عليه</th><th>فارق</th><th>نقاط</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows || `<tr><td colspan="10" class="note" style="padding:12px">لا يوجد ترتيب بعد (أدخل نتائج مباريات هذه المجموعة).</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
      wrap.appendChild(card);
    }
  }

  function renderStandings(){
    // Flat standings view per group
    const wrap = U.$("#standingsWrap");
    wrap.innerHTML = "";

    const groups = state.groups.slice().sort((a,b)=> (a.group_name||"").localeCompare(b.group_name||""));
    for (const g of groups){
      const standings = state.computed.standingsByGroup.get(g.group_id) || [];
      const card = document.createElement("div");
      card.className = "card";

      const rows = standings.map((r,idx)=> `
        <tr>
          <td>${idx+1}</td>
          <td>${r.team_name||""}</td>
          <td>${r.played}</td>
          <td>${r.won}</td>
          <td>${r.draw}</td>
          <td>${r.lost}</td>
          <td>${r.gf}</td>
          <td>${r.ga}</td>
          <td>${r.gd}</td>
          <td><b>${r.pts}</b></td>
        </tr>
      `).join("");

      card.innerHTML = `
        <div class="card-h">
          <b>الترتيب — ${g.group_name || ("مجموعة " + g.group_id)}</b>
          <span class="badge">${standings.length} فرق</span>
        </div>
        <div class="card-b">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>له</th><th>عليه</th><th>فارق</th><th>نقاط</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="10" class="note" style="padding:12px">لا يوجد ترتيب بعد.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
      wrap.appendChild(card);
    }
  }

  function renderScorers(){
    const rows = applySearchFilter(state.computed.topScorers, ["player_name","team_name"]);
    const tbody = U.$("#tblScorers tbody");
    tbody.innerHTML = "";
    rows.forEach((r,idx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>${r.player_name||""}</td>
        <td>${r.team_name||""}</td>
        <td><b>${r.goals}</b></td>
      `;
      tbody.appendChild(tr);
    });
    U.$("#scorersCount").textContent = `${rows.length} لاعب`;
  }

  
  function renderCards(){
    // cards summary (yellow/red) per player
    const cardMap = new Map(); // player_id -> {yellow, red}
    for (const c of state.cards){
      const pid = c.player_id;
      if (!pid) continue;
      const rec = cardMap.get(pid) || {yellow:0, red:0};
      const col = String(c.card_color||"").toLowerCase();
      if (col.includes("red")) rec.red += 1;
      else if (col.includes("yellow")) rec.yellow += 1;
      cardMap.set(pid, rec);
    }
    const rows = [];
    for (const [pid, cr] of cardMap.entries()){
      const p = state.players.find(x => x.player_id === pid);
      if (!p) continue;
      const t = state.teams.find(x => String(x.team_id) === String(p.team_id));
      rows.push({
        player_name: p.player_name,
        team_name: (t && t.team_name) ? t.team_name : "",
        yellow: cr.yellow,
        red: cr.red
      });
    }
    // keep only players with any cards
    const filtered = applySearchFilter(rows.filter(r => (r.yellow+r.red)>0), ["player_name","team_name"]);
    filtered.sort((a,b)=> (b.red-a.red) || (b.yellow-a.yellow) || (a.player_name||"").localeCompare(b.player_name||""));
    const tbody = U.$("#tblCards tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    for (const r of filtered){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.player_name||""}</td>
        <td>${r.team_name||""}</td>
        <td><b>${r.yellow}</b></td>
        <td><b>${r.red}</b></td>
      `;
      tbody.appendChild(tr);
    }
    const cc = U.$("#cardsCount");
    if (cc) cc.textContent = `${filtered.length} لاعب`;
  }

function renderTeams(){
    const rows = applySearchFilter(state.teams, ["team_name","group_id"]);
    const tbody = U.$("#tblTeams tbody");
    tbody.innerHTML = "";
    rows
      .slice()
      .sort((a,b)=> (a.team_name||"").localeCompare(b.team_name||""))
      .forEach((t,idx)=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${idx+1}</td>
          <td>${t.team_name||""}</td>
          <td>${(state.groups.find(g=>g.group_id===t.group_id)?.group_name) || t.group_id || ""}</td>
          <td>${t.short_name||""}</td>
          <td>${t.coach||""}</td>
        `;
        tbody.appendChild(tr);
      });
    U.$("#teamsCount").textContent = `${rows.length} فريق`;
  }

  function renderPlayers(){
    const teamById = new Map(state.teams.map(t => [t.team_id, t]));
    const rows = state.players.map(p => {
      const t = teamById.get(p.team_id) || {};
      return { ...p, team_name: t.team_name || "" };
    });
    const filtered = applySearchFilter(rows, ["player_name","team_name","position","shirt_no"]);
    const tbody = U.$("#tblPlayers tbody");
    tbody.innerHTML = "";
    filtered
      .slice()
      .sort((a,b)=> (a.team_name||"").localeCompare(b.team_name||"") || (a.player_name||"").localeCompare(b.player_name||""))
      .forEach((p,idx)=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${idx+1}</td>
          <td>${p.player_name||""}</td>
          <td>${p.team_name||""}</td>
          <td>${p.position||""}</td>
          <td>${p.shirt_no||""}</td>
        `;
        tbody.appendChild(tr);
      });
    U.$("#playersCount").textContent = `${filtered.length} لاعب`;
  }

  function setActiveSection(id){
    U.$$(".section").forEach(s => s.classList.remove("active"));
    U.$(`#${id}`).classList.add("active");
    U.$$(".nav button").forEach(b => b.classList.toggle("active", b.dataset.target === id));
  }

  function bindUI(){
    // nav
    U.$$(".nav button").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        setActiveSection(btn.dataset.target);
      });
    });
    // search
    const search = U.$("#searchInput");
    search.addEventListener("input", ()=>{
      state.q = search.value;
      renderAll();
    });
  }

  function renderAll(){
    renderKPIs();
    renderMatches();
    renderGroups();
    renderStandings();
    renderScorers();
    renderTeams();
    renderPlayers();
    renderCards();
  }

  async function loadAll(){
    const s = cfg.sources;
    const [groups, teams, players, matches, goals, cards] = await Promise.all([
      fetchCSV(s.groups),
      fetchCSV(s.teams),
      fetchCSV(s.players),
      fetchCSV(s.matches),
      fetchCSV(s.goals),
      fetchCSV(s.cards),
    ]);
    state.groups = groups;
    state.teams = teams;
    state.players = players;
    state.matches = matches;
    state.goals = goals;
    state.cards = cards;
    normalize();
    computeStandings();
    computeTopScorers();
  }

  try{
    bindUI();
    await loadAll();
    renderAll();
    setActiveSection("secMatches");
  }catch(err){
    console.error(err);
    U.toast("تعذّر تحميل البيانات. تحقق من روابط CSV في config.js");
    U.$("#loadError").classList.remove("hidden");
    U.$("#loadError").textContent = "تعذّر تحميل البيانات. تحقق من روابط CSV في config.js ثم أعد المحاولة.";
  }
})();