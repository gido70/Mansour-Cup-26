(async function(){
  const cfg = window.APP_CONFIG;

  document.title = `Admin — ${cfg.tournamentName}`;
  document.querySelectorAll("[data-tournament]").forEach(el=> el.textContent = cfg.tournamentName);

  const state = {
    authed: false,
    groups: [],
    teams: [],
    players: [],
    matches: [],
    goals: [],
    cards: [],
    local: {
      matches: [],
      goals: [],
      cards: []
    }
  };

  function requireAuth(){
    const ok = sessionStorage.getItem("admin_authed") === "1";
    if (ok) { state.authed = true; return true; }
    const pw = prompt("أدخل كلمة مرور لوحة التحكم:");
    if (pw && pw === cfg.admin.password){
      sessionStorage.setItem("admin_authed","1");
      state.authed = true;
      return true;
    }
    U.toast("كلمة المرور غير صحيحة.");
    return false;
  }

  async function fetchCSV(url){
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch: ${url}`);
    return CSV.parse(await res.text());
  }

  function loadLocal(){
    try{
      state.local.matches = JSON.parse(localStorage.getItem("admin_matches")||"[]");
      state.local.goals = JSON.parse(localStorage.getItem("admin_goals")||"[]");
      state.local.cards = JSON.parse(localStorage.getItem("admin_cards")||"[]");
    }catch{
      state.local = { matches:[], goals:[], cards:[] };
    }
  }
  function saveLocal(){
    localStorage.setItem("admin_matches", JSON.stringify(state.local.matches));
    localStorage.setItem("admin_goals", JSON.stringify(state.local.goals));
    localStorage.setItem("admin_cards", JSON.stringify(state.local.cards));
  }

  function fillSelect(sel, options, valueKey, labelKey){
    const el = U.$(sel);
    el.innerHTML = `<option value="">— اختر —</option>` + options.map(o => `<option value="${o[valueKey]}">${o[labelKey]}</option>`).join("");
  }

  function buildMatchLabel(m){
    const teamById = new Map(state.teams.map(t=>[t.team_id,t]));
    const g = state.groups.find(x=>x.group_id===m.group_id) || {};
    const h = teamById.get(m.home_team_id) || {};
    const a = teamById.get(m.away_team_id) || {};
    return (m.match_label || `${g.group_name||m.group_id||""} — ${h.team_name||m.home_team_id||""} × ${a.team_name||m.away_team_id||""}`);
  }

  function renderQueue(){
    // matches queue
    const mTbody = U.$("#qMatches tbody");
    mTbody.innerHTML = "";
    state.local.matches.slice().reverse().forEach((m,idx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${buildMatchLabel(m)}</td>
        <td>${m.home_score} - ${m.away_score}</td>
        <td>${m.match_date||""} ${m.match_time||""}</td>
        <td><button class="btn secondary" data-del="m" data-i="${state.local.matches.length-1-idx}">حذف</button></td>
      `;
      mTbody.appendChild(tr);
    });

    // goals queue
    const gTbody = U.$("#qGoals tbody");
    gTbody.innerHTML = "";
    state.local.goals.slice().reverse().forEach((g,idx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${g.match_id}</td>
        <td>${g.player_id}</td>
        <td>${g.minute||""}</td>
        <td>${g.goal_type||"G"}</td>
        <td><button class="btn secondary" data-del="g" data-i="${state.local.goals.length-1-idx}">حذف</button></td>
      `;
      gTbody.appendChild(tr);
    });

    // cards queue
    const cTbody = U.$("#qCards tbody");
    cTbody.innerHTML = "";
    state.local.cards.slice().reverse().forEach((c,idx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.match_id}</td>
        <td>${c.player_id}</td>
        <td>${c.card_color||""}</td>
        <td>${c.minute||""}</td>
        <td><button class="btn secondary" data-del="c" data-i="${state.local.cards.length-1-idx}">حذف</button></td>
      `;
      cTbody.appendChild(tr);
    });

    // bind delete
    U.$$("#qWrap [data-del]").forEach(btn=>{
      btn.onclick = ()=>{
        const kind = btn.dataset.del;
        const i = Number(btn.dataset.i);
        if (kind === "m") state.local.matches.splice(i,1);
        if (kind === "g") state.local.goals.splice(i,1);
        if (kind === "c") state.local.cards.splice(i,1);
        saveLocal();
        renderQueue();
      };
    });

    // counts
    U.$("#cntMatches").textContent = state.local.matches.length;
    U.$("#cntGoals").textContent = state.local.goals.length;
    U.$("#cntCards").textContent = state.local.cards.length;
  }

  function exportCSV(kind){
    let rows = [];
    let headers = [];
    if (kind === "matches"){
      headers = ["match_id","group_id","stage","match_date","match_time","venue","home_team_id","away_team_id","home_score","away_score","match_label"];
      rows = state.local.matches.map(m => {
        const r = {};
        headers.forEach(h => r[h] = m[h] ?? "");
        return r;
      });
    }
    if (kind === "goals"){
      headers = ["goal_id","match_id","player_id","minute","goal_type","note"];
      rows = state.local.goals.map(g => {
        const r = {};
        headers.forEach(h => r[h] = g[h] ?? "");
        return r;
      });
    }
    if (kind === "cards"){
      headers = ["card_id","match_id","player_id","minute","card_color","note"];
      rows = state.local.cards.map(c => {
        const r = {};
        headers.forEach(h => r[h] = c[h] ?? "");
        return r;
      });
    }
    const csv = CSV.toCSV(rows, headers);
    return { csv, headers };
  }

  function downloadText(filename, text){
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1200);
  }

  function copyToClipboard(text){
    navigator.clipboard.writeText(text)
      .then(()=> U.toast("تم النسخ للحافظة."))
      .catch(()=> U.toast("لم أستطع النسخ (قد تمنع المتصفح ذلك)."));
  }

  function bindForms(){
    // match form
    U.$("#frmMatch").addEventListener("submit", (e)=>{
      e.preventDefault();
      const m = {
        match_id: U.$("#m_match_id").value.trim(),
        group_id: U.$("#m_group_id").value.trim(),
        stage: U.$("#m_stage").value.trim(),
        match_date: U.$("#m_date").value.trim(),
        match_time: U.$("#m_time").value.trim(),
        venue: U.$("#m_venue").value.trim(),
        home_team_id: U.$("#m_home").value.trim(),
        away_team_id: U.$("#m_away").value.trim(),
        home_score: U.$("#m_hs").value.trim(),
        away_score: U.$("#m_as").value.trim(),
        match_label: U.$("#m_label").value.trim()
      };
      if (!m.match_id){ U.toast("أدخل match_id"); return; }
      if (!m.home_team_id || !m.away_team_id){ U.toast("اختر الفريقين"); return; }
      state.local.matches.push(m);
      saveLocal();
      renderQueue();
      e.target.reset();
      U.toast("تمت إضافة نتيجة المباراة إلى قائمة التصدير.");
    });

    // goals form
    U.$("#frmGoal").addEventListener("submit", (e)=>{
      e.preventDefault();
      const g = {
        goal_id: U.$("#g_goal_id").value.trim() || `G-${Date.now()}`,
        match_id: U.$("#g_match_id").value.trim(),
        player_id: U.$("#g_player_id").value.trim(),
        minute: U.$("#g_minute").value.trim(),
        goal_type: U.$("#g_type").value.trim() || "G",
        note: U.$("#g_note").value.trim()
      };
      if (!g.match_id || !g.player_id){ U.toast("اختر المباراة واللاعب"); return; }
      state.local.goals.push(g);
      saveLocal();
      renderQueue();
      e.target.reset();
      U.toast("تمت إضافة هدف إلى قائمة التصدير.");
    });

    // cards form
    U.$("#frmCard").addEventListener("submit", (e)=>{
      e.preventDefault();
      const c = {
        card_id: U.$("#c_card_id").value.trim() || `C-${Date.now()}`,
        match_id: U.$("#c_match_id").value.trim(),
        player_id: U.$("#c_player_id").value.trim(),
        minute: U.$("#c_minute").value.trim(),
        card_color: U.$("#c_color").value.trim(),
        note: U.$("#c_note").value.trim()
      };
      if (!c.match_id || !c.player_id || !c.card_color){ U.toast("اختر المباراة واللاعب والبطاقة"); return; }
      state.local.cards.push(c);
      saveLocal();
      renderQueue();
      e.target.reset();
      U.toast("تمت إضافة بطاقة إلى قائمة التصدير.");
    });

    // export buttons
    U.$("#btnCopyMatches").onclick = ()=>{
      const { csv } = exportCSV("matches");
      copyToClipboard(csv);
    };
    U.$("#btnDownloadMatches").onclick = ()=>{
      const { csv } = exportCSV("matches");
      downloadText("admin_matches_export.csv", csv);
    };
    U.$("#btnCopyGoals").onclick = ()=>{
      const { csv } = exportCSV("goals");
      copyToClipboard(csv);
    };
    U.$("#btnDownloadGoals").onclick = ()=>{
      const { csv } = exportCSV("goals");
      downloadText("admin_goals_export.csv", csv);
    };
    U.$("#btnCopyCards").onclick = ()=>{
      const { csv } = exportCSV("cards");
      copyToClipboard(csv);
    };
    U.$("#btnDownloadCards").onclick = ()=>{
      const { csv } = exportCSV("cards");
      downloadText("admin_cards_export.csv", csv);
    };

    U.$("#btnClearAll").onclick = ()=>{
      if (!confirm("حذف كل البيانات المحفوظة محليًا في لوحة التحكم؟")) return;
      state.local = { matches:[], goals:[], cards:[] };
      saveLocal();
      renderQueue();
      U.toast("تم الحذف.");
    };
    U.$("#btnLogout").onclick = ()=>{
      sessionStorage.removeItem("admin_authed");
      location.reload();
    };
  }

  async function init(){
    if (!requireAuth()) return;

    // Load data (read-only) so we can populate dropdowns
    const s = cfg.sources;
    const [groups, teams, players, matches] = await Promise.all([
      fetchCSV(s.groups),
      fetchCSV(s.teams),
      fetchCSV(s.players),
      fetchCSV(s.matches),
    ]);
    state.groups = groups;
    state.teams = teams;
    state.players = players;
    state.matches = matches;

    // UI: populate selects
    fillSelect("#m_group_id", state.groups, "group_id", "group_name");
    fillSelect("#m_home", state.teams, "team_id", "team_name");
    fillSelect("#m_away", state.teams, "team_id", "team_name");

    // match select in events
    const matchOptions = state.matches.map(m => ({
      match_id: m.match_id,
      label: m.match_label || m.match_id
    }));
    const matchSelGoal = U.$("#g_match_id");
    matchSelGoal.innerHTML = `<option value="">— اختر —</option>` + matchOptions.map(o => `<option value="${o.match_id}">${o.label}</option>`).join("");
    const matchSelCard = U.$("#c_match_id");
    matchSelCard.innerHTML = matchSelGoal.innerHTML;

    // player select
    fillSelect("#g_player_id", state.players, "player_id", "player_name");
    fillSelect("#c_player_id", state.players, "player_id", "player_name");

    // Local queue
    loadLocal();
    renderQueue();

    // show app
    U.$("#adminApp").classList.remove("hidden");
    U.$("#adminLocked").classList.add("hidden");

    bindForms();
  }

  try{ await init(); }
  catch(err){
    console.error(err);
    U.toast("تعذّر تحميل البيانات. تحقق من روابط CSV في config.js");
  }
})();