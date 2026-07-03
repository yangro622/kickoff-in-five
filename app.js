/* =========================================================
   KICKOFF IN FIVE — vanilla JS renderer
   Data comes exclusively from /data/*.json. This file writes
   zero factual content; anything marked TODO-RESEARCH in the
   data renders as an honest "research pending" chip.
   ========================================================= */

(() => {
  "use strict";

  const DATA_FILES = ["teams", "players", "matches", "learn"];
  const ROUND_LABEL = { R32: "Round of 32", R16: "Round of 16", QF: "Quarterfinal", SF: "Semifinal", F: "Final" };
  const ROUND_ORDER = ["R32", "R16", "QF", "SF", "F"];

  const db = { teams: [], players: [], matches: [], learn: { sections: [] }, teamById: {}, playerById: {}, matchById: {} };
  const $main = document.querySelector("main");
  let countdownTimer = null;

  /* ---------- utilities ---------- */

  const esc = (s) => String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

  const isTodo = (v) => v == null || v === "" || v === "TODO-RESEARCH";
  const listIsTodo = (a) => !Array.isArray(a) || a.length === 0 || a.every(isTodo);

  const TODO_CHIP = '<span class="todo">Research pending</span>';

  // Render a data string, or the pending chip if it's a TODO placeholder.
  const text = (v) => (isTodo(v) ? TODO_CHIP : esc(v));

  const teamOf = (id) => db.teamById[id] || null;

  // A match side: either a real team or a TBD note.
  function side(m, n) {
    const id = m[`team${n}_id`];
    if (!id || id === "tbd") {
      const note = m[`team${n}_tbd_note`];
      return { tbd: true, note: isTodo(note) ? "To be determined" : note };
    }
    const team = teamOf(id);
    return team ? { tbd: false, team } : { tbd: true, note: `Unknown team “${id}”` };
  }

  /* ---------- dates & countdown ---------- */

  // Venue-local calendar date string -> Date pinned to UTC noon (safe for date-only formatting).
  const dateOnly = (s) => {
    const [y, mo, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, d, 12));
  };

  const fmt = {
    // viewer-local, when we have a real kickoff instant
    localDay: (dt) => dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    localTime: (dt) => dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
    // date-only (no verified kickoff time yet) — format in UTC to avoid off-by-one
    dayOnly: (s) => dateOnly(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
    dayOnlyLong: (s) => dateOnly(s).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
  };

  function kickoff(m) {
    if (m.datetime_utc) {
      const dt = new Date(m.datetime_utc);
      return { known: true, dt, day: fmt.localDay(dt), time: fmt.localTime(dt), sort: dt.getTime() };
    }
    if (m.date_local) {
      return { known: false, day: fmt.dayOnly(m.date_local), time: "Time TBD", sort: dateOnly(m.date_local).getTime() };
    }
    return { known: false, day: "Date TBD", time: "Time TBD", sort: Infinity };
  }

  // Rounds are strictly sequential in time, so round order is the primary key;
  // this keeps date-TBD quarterfinals/semis from sorting after the dated final.
  const matchSort = (a, b) =>
    (ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round)) ||
    (kickoff(a).sort - kickoff(b).sort) ||
    (a.bracket_slot - b.bracket_slot);

  function countdownHTML(m) {
    const k = kickoff(m);
    if (!k.known) {
      return `<div class="countdown"><span class="cd-num">${esc(k.day)}</span><span class="cd-label">kickoff time TBD</span></div>`;
    }
    const ms = k.dt - Date.now();
    if (ms <= 0) return `<div class="countdown"><span class="cd-num">Kicked off</span><span class="cd-label">${esc(k.day)} · ${esc(k.time)}</span></div>`;
    const mins = Math.floor(ms / 60000);
    const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), min = mins % 60;
    const num = d > 0 ? `${d}d ${h}h` : `${h}h ${String(min).padStart(2, "0")}m`;
    return `<div class="countdown"><span class="cd-num">${num}</span><span class="cd-label">to kickoff</span></div>`;
  }

  function armCountdown(m) {
    clearInterval(countdownTimer);
    if (!m || !m.datetime_utc) return;
    countdownTimer = setInterval(() => {
      const el = document.querySelector("[data-countdown]");
      if (!el) { clearInterval(countdownTimer); return; }
      el.innerHTML = countdownHTML(m);
    }, 30000);
  }

  /* ---------- shared components ---------- */

  const flagOf = (t) => `<span aria-hidden="true">${t.flag}</span>`;

  function stripeVars(m) {
    const a = side(m, 1), b = side(m, 2);
    const c1 = (!a.tbd && a.team.color) || "var(--ink-faint)";
    const c2 = (!b.tbd && b.team.color) || "var(--ink-faint)";
    return `--stripe-a:${esc(c1)};--stripe-b:${esc(c2)}`;
  }

  function scoreOf(m, n) {
    if (m.status !== "final" || !m.score) return null;
    const parts = String(m.score).split(/[–\-:]/).map((x) => x.trim());
    return parts.length === 2 ? parts[n - 1] : null;
  }

  function matchupRows(m, { withScore = false } = {}) {
    const row = (n) => {
      const s = side(m, n);
      const sc = withScore ? scoreOf(m, n) : null;
      if (s.tbd) {
        return `<div class="matchup-row">
          <span class="matchup-flag" aria-hidden="true">–</span>
          <span class="matchup-name is-tbd">${esc(s.note)}</span>
        </div>`;
      }
      return `<div class="matchup-row">
        <span class="matchup-flag">${flagOf(s.team)}</span>
        <span class="matchup-name">${esc(s.team.name)}</span>
        ${sc != null ? `<span class="matchup-score">${esc(sc)}</span>` : ""}
      </div>`;
    };
    return `<div class="matchup">${row(1)}<div class="matchup-vs">vs</div>${row(2)}</div>`;
  }

  function stub(m) {
    const k = kickoff(m);
    const venue = isTodo(m.venue) ? null : m.venue;
    const city = isTodo(m.city) ? null : m.city;
    const place = venue && city ? `${venue}` : (venue || city || "Venue TBD");
    return `<div class="stub">
      <div class="stub-cell"><span class="stub-label">Date</span><span class="stub-value">${esc(k.day)}</span></div>
      <div class="stub-cell"><span class="stub-label">Kickoff</span><span class="stub-value">${esc(k.time)}</span></div>
      <div class="stub-cell"><span class="stub-label">Venue</span><span class="stub-value">${esc(place)}${city && venue ? `<span class="stub-label">${esc(city)}</span>` : ""}</span></div>
      <div class="stub-barcode" aria-hidden="true"></div>
    </div>`;
  }

  function matchTicket(m, { hero = false } = {}) {
    const bandLeft = `${ROUND_LABEL[m.round] || m.round} · Match ${m.bracket_slot}`;
    const bandRight = m.status === "final" ? "Full time" : (hero ? "Up next" : "Admit one");
    return `<a class="ticket ticket--striped" style="${stripeVars(m)}" href="#/match/${esc(m.id)}" aria-label="${esc(bandLeft)}: open match guide">
      <span class="kit-stripe" aria-hidden="true"></span>
      <div class="ticket-band ${hero ? "ticket-band--green" : ""}"><span>${esc(bandLeft)}</span><span class="band-right">${bandRight}</span></div>
      <div class="ticket-body">
        ${matchupRows(m, { withScore: m.status === "final" })}
        ${hero ? `<div style="margin-top:12px" data-countdown>${countdownHTML(m)}</div>` : ""}
      </div>
      <div class="perf" aria-hidden="true"></div>
      ${stub(m)}
    </a>`;
  }

  function matchLine(m) {
    const a = side(m, 1), b = side(m, 2);
    const k = kickoff(m);
    const names = (s) => s.tbd ? `<span class="tbd">${esc(s.note)}</span>` : esc(s.team.name);
    const flags = `${a.tbd ? "" : a.team.flag}${b.tbd ? "" : b.team.flag}`;
    const meta = m.status === "final" && m.score
      ? `<span class="score">${esc(m.score)}</span>${m.penalties ? `<span>pens ${esc(m.penalties)}</span>` : `<span>${esc(k.day)}</span>`}`
      : `${esc(k.day)}<br>${esc(k.time)}`;
    return `<li><a class="match-line" style="${stripeVars(m)}" href="#/match/${esc(m.id)}">
      <span class="kit-stripe" aria-hidden="true"></span>
      ${flags ? `<span class="match-line-flags" aria-hidden="true">${flags}</span>` : ""}
      <span class="match-line-names">${names(a)}<br>${names(b)}</span>
      <span class="match-line-meta">${meta}</span>
    </a></li>`;
  }

  function playerChip(p) {
    const team = teamOf(p.team_id);
    if (isTodo(p.name)) {
      return `<a class="chip" href="#/player/${esc(p.id)}">
        <span class="chip-top">${team ? flagOf(team) : ""}<span class="chip-name muted">Star TBD</span></span>
        <span class="chip-sub">research pending</span>
      </a>`;
    }
    return `<a class="chip" href="#/player/${esc(p.id)}">
      <span class="chip-top">${team ? `<span class="chip-flag">${flagOf(team)}</span>` : ""}<span class="chip-name">${esc(p.name)}</span></span>
      <span class="chip-sub">${isTodo(p.club) ? "Club TBD" : esc(p.club)}</span>
    </a>`;
  }

  const backLink = (href, label) => `<a class="back-link" href="${href}">← ${esc(label)}</a>`;

  /* ---------- views ---------- */

  function viewHome() {
    const upcoming = db.matches.filter((m) => m.status !== "final").sort(matchSort);
    const finished = db.matches.filter((m) => m.status === "final").sort(matchSort).reverse();
    const hero = upcoming[0];

    // group upcoming (after the hero) by day
    const rest = upcoming.slice(1);
    const groups = [];
    for (const m of rest) {
      const k = kickoff(m);
      const label = m.datetime_utc
        ? new Date(m.datetime_utc).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
        : (m.date_local ? fmt.dayOnlyLong(m.date_local)
          : `${ROUND_LABEL[m.round] || m.round}${m.round === "F" ? "" : "s"} — dates TBD`);
      const g = groups.find((x) => x.label === label);
      if (g) g.items.push(m); else groups.push({ label, sort: k.sort, items: [m] });
    }

    let html = `
      <p class="kicker">World Cup 2026 · Knockout stage</p>
      <h1 class="h-display" style="font-size:clamp(1.6rem,7vw,2.3rem)">Catch up on any match<br>in five minutes.</h1>
      <p class="hero-note">Pick a match. Get the storyline, the stars, and exactly what to watch for — written for people new to soccer.</p>
    `;

    if (hero) {
      html += `<p class="kicker">Next up</p>${matchTicket(hero, { hero: true })}`;
    }

    html += `<div class="btn-row">
      <a class="btn" href="#/bracket">Bracket</a>
      <a class="btn" href="#/learn">New here? Learn</a>
    </div>`;

    for (const g of groups) {
      html += `<h2 class="day-heading">${esc(g.label)}</h2><ul class="match-list">${g.items.map(matchLine).join("")}</ul>`;
    }

    if (finished.length) {
      html += `<details class="fold" style="margin-top:22px"><summary>Finished matches (${finished.length})</summary>
        <div class="fold-body"><ul class="match-list">${finished.map(matchLine).join("")}</ul></div>
      </details>`;
    }

    render(html, "Kickoff in Five — World Cup 2026 Catch-Up Guide");
    armCountdown(hero);
  }

  function viewMatch(id) {
    const m = db.matchById[id];
    if (!m) return viewNotFound(`No match called “${id}”.`);
    const a = side(m, 1), b = side(m, 2);
    const teams = [a, b].filter((s) => !s.tbd).map((s) => s.team);
    const title = teams.length === 2 ? `${teams[0].name} vs ${teams[1].name}` : ROUND_LABEL[m.round] || "Match";

    const stars = teams.flatMap((t) => (t.star_player_ids || []).map((pid) => db.playerById[pid]).filter(Boolean));

    const sideName = (s) => (s.tbd ? s.note : s.team.name);
    let html = `<h1 class="vh">${esc(sideName(a))} vs ${esc(sideName(b))} — ${esc(ROUND_LABEL[m.round] || m.round)}</h1>
    <div class="ticket ticket--striped" style="${stripeVars(m)}">
      <span class="kit-stripe" aria-hidden="true"></span>
      <div class="ticket-band"><span>${esc(ROUND_LABEL[m.round] || m.round)} · Match ${esc(String(m.bracket_slot))}</span><span class="band-right">${m.status === "final" ? "Full time" : "Admit one"}</span></div>
      <div class="ticket-body">${matchupRows(m, { withScore: m.status === "final" })}
      ${m.status === "final" && m.penalties ? `<p class="small muted" style="margin:8px 0 0">Penalties: ${esc(m.penalties)}</p>` : ""}
      ${m.status !== "final" ? `<div style="margin-top:12px" data-countdown>${countdownHTML(m)}</div>` : ""}
      </div>
      <div class="perf" aria-hidden="true"></div>
      ${stub(m)}
    </div>`;

    if (m.status === "final" && !isTodo(m.recap)) {
      html += `<div class="section"><h2 class="section-title">How it ended</h2><p class="prose">${esc(m.recap)}</p></div>`;
    }

    html += `<div class="section"><h2 class="section-title">The storyline</h2><p class="prose">${text(m.storyline)}</p></div>`;

    const watch = listIsTodo(m.things_to_watch)
      ? `<p class="prose">${TODO_CHIP}</p>`
      : `<ol class="watch-list">${m.things_to_watch.map((t) => `<li>${text(t)}</li>`).join("")}</ol>`;
    html += `<div class="section"><h2 class="section-title">Three things to watch</h2>${watch}</div>`;

    html += `<div class="section"><h2 class="section-title">Star players</h2>`;
    html += stars.length
      ? `<div class="chip-row">${stars.map(playerChip).join("")}</div>`
      : `<p class="prose muted small">Star players land here once the research JSON drops.</p>`;
    html += `</div>`;

    // Head-to-head & fun facts
    const h2h = listIsTodo(m.h2h) ? `<p>${TODO_CHIP}</p>` : `<ul>${m.h2h.map((x) => `<li>${text(x)}</li>`).join("")}</ul>`;
    const funFacts = teams
      .filter((t) => !listIsTodo(t.fun_facts))
      .map((t) => `<p class="small" style="margin:12px 0 4px"><strong>${flagOf(t)} ${esc(t.name)}</strong></p><ul>${t.fun_facts.map((f) => `<li>${text(f)}</li>`).join("")}</ul>`)
      .join("");
    html += `<details class="fold"><summary>Head-to-head &amp; fun facts</summary><div class="fold-body">${h2h}${funFacts}</div></details>`;

    // Team snapshots
    if (teams.length) {
      const snaps = teams.map((t) => `<div class="snap">
        <div class="snap-head">${flagOf(t)} ${esc(t.name)}</div>
        <dl>
          <dt>FIFA rank</dt><dd>${t.fifa_rank == null ? TODO_CHIP : esc(String(t.fifa_rank))}</dd>
          <dt>Group run</dt><dd>${text(t.group_summary)}</dd>
          <dt>Best finish</dt><dd>${text(t.best_wc_finish)}</dd>
          <dt>How they play</dt><dd>${text(t.style)}</dd>
        </dl>
        <p class="small" style="margin:8px 0 0"><a href="#/team/${esc(t.id)}">Full team page →</a></p>
      </div>`).join("");
      html += `<details class="fold"><summary>Team snapshots</summary><div class="fold-body">${snaps}</div></details>`;
    }

    if (!isTodo(m.stakes)) {
      html += `<div class="section"><h2 class="section-title">The stakes</h2><p class="prose">${esc(m.stakes)}</p></div>`;
    }

    html += `<div class="btn-row">
      ${m.watch_link ? `<a class="btn btn--primary" href="${esc(m.watch_link)}" target="_blank" rel="noopener">Watch live →</a>` : ""}
      <button class="btn" type="button" data-share="${esc(m.id)}">Share card</button>
    </div>`;

    html += backLink("#/", "All matches");
    render(html, `${title} — Kickoff in Five`);
    armCountdown(m.status !== "final" ? m : null);
  }

  function viewTeam(id) {
    const t = teamOf(id);
    if (!t) return viewNotFound(`No team called “${id}”.`);
    const stars = (t.star_player_ids || []).map((pid) => db.playerById[pid]).filter(Boolean);
    const theirMatches = db.matches.filter((m) => m.team1_id === id || m.team2_id === id).sort(matchSort);

    let html = `<div class="page-head">
      <span class="page-head-flag">${flagOf(t)}</span>
      <div>
        <h1 class="h-display" style="font-size:clamp(1.6rem,7vw,2.2rem)">${esc(t.name)}</h1>
        <p class="sub">${t.fifa_rank != null ? `FIFA rank ${esc(String(t.fifa_rank))} · ` : ""}${isTodo(t.group_summary) ? "" : esc(t.group_summary)}</p>
      </div>
    </div>
    <p><span class="status-pill ${t.still_alive ? "status-pill--alive" : "status-pill--out"}">${t.still_alive ? "Still alive" : "Eliminated"}</span></p>`;

    html += `<div class="section"><h2 class="section-title">This tournament</h2><p class="prose">${text(t.storyline)}</p></div>`;
    html += `<div class="section"><h2 class="section-title">How they play</h2><p class="prose">${text(t.style)}</p></div>`;
    html += `<div class="section"><h2 class="section-title">World Cup history</h2>
      <p class="prose">${text(t.wc_history)}</p>
      <p class="prose small muted" style="margin-top:8px">Best finish: ${text(t.best_wc_finish)}</p></div>`;

    html += `<div class="section"><h2 class="section-title">Stars to know</h2>`;
    html += stars.length
      ? `<div class="chip-row">${stars.map(playerChip).join("")}</div>`
      : `<p class="prose muted small">Star players land here once the research JSON drops.</p>`;
    html += `</div>`;

    if (!listIsTodo(t.fun_facts)) {
      html += `<div class="section"><h2 class="section-title">Fun facts</h2><ul class="fact-list">${t.fun_facts.map((f) => `<li>${text(f)}</li>`).join("")}</ul></div>`;
    }

    if (theirMatches.length) {
      html += `<div class="section"><h2 class="section-title">Their matches</h2><ul class="match-list">${theirMatches.map(matchLine).join("")}</ul></div>`;
    }

    html += backLink("#/", "All matches");
    render(html, `${t.name} — Kickoff in Five`);
  }

  function viewPlayer(id) {
    const p = db.playerById[id];
    if (!p) return viewNotFound(`No player called “${id}”.`);
    const t = teamOf(p.team_id);
    const stats = p.tournament_stats || {};
    const statBits = [];
    if (stats.goals != null) statBits.push(`${stats.goals} goal${stats.goals === 1 ? "" : "s"}`);
    if (stats.assists != null) statBits.push(`${stats.assists} assist${stats.assists === 1 ? "" : "s"}`);
    if (!isTodo(stats.note)) statBits.push(esc(stats.note));

    let html = `<div class="page-head">
      ${t ? `<span class="page-head-flag">${flagOf(t)}</span>` : ""}
      <div>
        <h1 class="h-display" style="font-size:clamp(1.5rem,6.5vw,2.1rem)">${isTodo(p.name) ? "Star player TBD" : esc(p.name)}</h1>
        <p class="sub">${t ? `<a href="#/team/${esc(t.id)}">${esc(t.name)}</a> · ` : ""}${isTodo(p.position) ? "Position TBD" : esc(p.position)}${p.age != null ? ` · age ${esc(String(p.age))}` : ""}</p>
      </div>
    </div>`;

    if (isTodo(p.name)) html += `<p>${TODO_CHIP}</p>`;

    html += `<div class="ticket" style="margin-top:14px"><div class="ticket-body">
      <dl style="display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:0;font-size:0.95rem">
        <dt class="stub-label" style="padding-top:3px">Club</dt><dd style="margin:0">${text(p.club)}</dd>
        <dt class="stub-label" style="padding-top:3px">League</dt><dd style="margin:0">${isTodo(p.league) ? TODO_CHIP : `<a href="#/learn/leagues">${esc(p.league)}</a>`}</dd>
        ${statBits.length ? `<dt class="stub-label" style="padding-top:3px">This cup</dt><dd style="margin:0">${statBits.join(" · ")}</dd>` : ""}
      </dl>
    </div></div>`;

    html += `<div class="section"><h2 class="section-title">The journey</h2><p class="prose">${text(p.journey)}</p></div>`;
    html += `<div class="section"><h2 class="section-title">Watch for this</h2><p class="prose">${text(p.watch_for)}</p></div>`;

    html += backLink(t ? `#/team/${esc(t.id)}` : "#/", t ? `${t.name} team page` : "All matches");
    render(html, `${isTodo(p.name) ? "Player" : p.name} — Kickoff in Five`);
  }

  function viewBracket() {
    const cols = [
      { round: "R16", title: "Round of 16" },
      { round: "QF", title: "Quarterfinals" },
      { round: "SF", title: "Semifinals" },
      { round: "F", title: "Final · Jul 19" },
    ];

    const node = (m) => {
      const k = kickoff(m);
      const row = (n) => {
        const s = side(m, n);
        const sc = scoreOf(m, n);
        const winner = m.status === "final" && sc != null && (() => {
          const other = scoreOf(m, n === 1 ? 2 : 1);
          if (Number(sc) !== Number(other)) return Number(sc) > Number(other);
          if (m.penalties) {
            const p = String(m.penalties).split(/[–\-:]/).map(Number);
            return p.length === 2 && p[n - 1] > p[n === 1 ? 1 : 0];
          }
          return false;
        })();
        if (s.tbd) return `<div class="bnode-team is-tbd">${esc(s.note)}</div>`;
        return `<div class="bnode-team ${winner ? "is-winner" : ""}">
          <span class="bflag">${flagOf(s.team)}</span>${esc(s.team.code)}
          ${sc != null ? `<span class="bscore">${esc(sc)}</span>` : ""}
        </div>`;
      };
      const place = isTodo(m.city) ? "" : ` · ${m.city.split(",")[0]}`;
      return `<a class="bnode" href="#/match/${esc(m.id)}">
        <div class="bnode-meta"><span>${esc(k.day)}${esc(place)}</span></div>
        ${row(1)}${row(2)}
      </a>`;
    };

    const colHTML = cols.map((c) => {
      const games = db.matches.filter((m) => m.round === c.round).sort((x, y) => x.bracket_slot - y.bracket_slot);
      return `<div class="bracket-col">
        <div class="bracket-col-title">${esc(c.title)}</div>
        <div class="bracket-col-games">${games.map(node).join("")}</div>
      </div>`;
    }).join("");

    const html = `
      <p class="kicker">Knockout stage</p>
      <h1 class="h-display" style="font-size:clamp(1.6rem,7vw,2.2rem)">The bracket</h1>
      <p class="hero-note">Scroll sideways →. Tap any match for the five-minute guide.</p>
      <div class="bracket-scroller"><div class="bracket">${colHTML}</div></div>
      ${backLink("#/", "All matches")}`;
    render(html, "Bracket — Kickoff in Five");
  }

  function viewLearn(sectionId) {
    const secs = db.learn.sections || [];
    let html = `
      <p class="kicker">New to soccer?</p>
      <h1 class="h-display" style="font-size:clamp(1.6rem,7vw,2.2rem)">Learn the game<br>in five minutes</h1>
      <p class="hero-note">Everything you need to not feel lost at the watch party. Skim the headlines, tap what you're curious about.</p>`;

    for (const s of secs) {
      const open = s.id === sectionId;
      html += `<div class="section" id="learn-${esc(s.id)}">
        <h2 class="section-title">${esc(s.title)}</h2>
        ${isTodo(s.intro) ? "" : `<p class="prose learn-intro" style="margin-bottom:10px">${esc(s.intro)}</p>`}
        ${(s.entries || []).map((e) => `<details class="fold" ${open ? "open" : ""}>
          <summary>${esc(e.title)}</summary>
          <div class="fold-body"><p class="prose">${text(e.body)}</p></div>
        </details>`).join("")}
      </div>`;
    }

    html += backLink("#/", "All matches");
    render(html, "Learn the game — Kickoff in Five");
    if (sectionId) {
      const el = document.getElementById(`learn-${sectionId}`);
      if (el) el.scrollIntoView({ block: "start" });
    }
  }

  function viewNotFound(msg) {
    render(`
      <div class="center" style="padding:40px 0">
        <h1 class="h-display" style="font-size:1.6rem">Wrong turnstile</h1>
        <p class="prose muted">${esc(msg || "That page doesn't exist.")}</p>
        <p><a class="btn" href="#/">Back to today's matches</a></p>
      </div>`, "Not found — Kickoff in Five");
  }

  /* ---------- share / screenshot mode ---------- */

  function openShare(matchId) {
    const m = db.matchById[matchId];
    if (!m) return;
    const teams = [side(m, 1), side(m, 2)].filter((s) => !s.tbd).map((s) => s.team);
    const stars = teams
      .flatMap((t) => (t.star_player_ids || []).map((pid) => db.playerById[pid]).filter(Boolean))
      .filter((p) => !isTodo(p.name));

    const watch = listIsTodo(m.things_to_watch) ? "" :
      `<ol class="share-watch">${m.things_to_watch.filter((t) => !isTodo(t)).map((t) => `<li>${esc(t)}</li>`).join("")}</ol>`;
    const starsLine = stars.length
      ? `<p class="share-stars"><strong>Stars:</strong> ${stars.map((p) => esc(p.name)).join(" · ")}</p>` : "";
    const k = kickoff(m);

    const overlay = document.createElement("div");
    overlay.className = "share-overlay";
    overlay.innerHTML = `
      <div class="share-stage">
        <p class="share-hint">Screenshot this card — it's sized for sharing.</p>
        <div class="share-card" style="${stripeVars(m)}">
          <div class="ticket-band ticket-band--green"><span>${esc(ROUND_LABEL[m.round] || m.round)} · World Cup 2026</span><span class="band-right">${esc(k.day)}</span></div>
          <div class="share-card-body">
            ${matchupRows(m, { withScore: m.status === "final" })}
            ${isTodo(m.storyline) ? "" : `<p class="share-storyline">${esc(m.storyline)}</p>`}
            ${watch}
            ${starsLine}
          </div>
          <div class="perf" aria-hidden="true"></div>
          ${stub(m)}
          <div class="share-foot"><span>Kickoff in Five</span><span>${esc(location.host + location.pathname)}</span></div>
        </div>
        <p style="margin-top:16px"><button class="btn share-close" type="button">Done</button></p>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const close = () => {
      overlay.remove();
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    overlay.querySelector(".share-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    overlay.querySelector(".share-close").focus();
  }

  /* ---------- router ---------- */

  function render(html, title) {
    $main.innerHTML = html;
    if (title) document.title = title;
    window.scrollTo(0, 0);
  }

  function route() {
    clearInterval(countdownTimer);
    const hash = location.hash.replace(/^#\/?/, "");
    const [view, param] = hash.split("/").map(decodeURIComponent);
    switch (view || "") {
      case "": return viewHome();
      case "match": return viewMatch(param);
      case "team": return viewTeam(param);
      case "player": return viewPlayer(param);
      case "bracket": return viewBracket();
      case "learn": return viewLearn(param);
      default: return viewNotFound(`No page called “${view}”.`);
    }
  }

  /* ---------- boot ---------- */

  async function boot() {
    try {
      const [teams, players, matches, learn] = await Promise.all(
        DATA_FILES.map((f) => fetch(`data/${f}.json`).then((r) => {
          if (!r.ok) throw new Error(`${f}.json → HTTP ${r.status}`);
          return r.json();
        }))
      );
      db.teams = teams.teams || [];
      db.players = players.players || [];
      db.matches = matches.matches || [];
      db.learn = learn || { sections: [] };
      for (const t of db.teams) db.teamById[t.id] = t;
      for (const p of db.players) db.playerById[p.id] = p;
      for (const m of db.matches) db.matchById[m.id] = m;

      window.addEventListener("hashchange", route);
      document.body.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-share]");
        if (btn) openShare(btn.getAttribute("data-share"));
      });
      route();
    } catch (err) {
      render(`<div class="center" style="padding:40px 0">
        <h1 class="h-display" style="font-size:1.4rem">Couldn't load match data</h1>
        <p class="prose muted small">${esc(err.message)}</p>
        <p><button class="btn" onclick="location.reload()">Retry</button></p>
      </div>`, "Kickoff in Five");
    }
  }

  boot();
})();
