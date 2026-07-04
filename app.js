/* =========================================================
   KICKOFF IN FIVE — vanilla JS renderer (v2, album design)
   Data comes exclusively from /data/*.json. This file writes
   zero factual content; anything marked TODO-RESEARCH in the
   data renders as an honest "research pending" chip.
   Player photos come from photo_url in players.json (research
   fills these with freely-licensed images); missing photos
   fall back to initials avatars in team colors.
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
  const text = (v) => (isTodo(v) ? TODO_CHIP : esc(v));

  const teamOf = (id) => db.teamById[id] || null;

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

  const dateOnly = (s) => {
    const [y, mo, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, d, 12));
  };

  const fmt = {
    localDay: (dt) => dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    localTime: (dt) => dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
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

  function countdownText(m) {
    const k = kickoff(m);
    if (!k.known) return `${k.day} · kickoff time TBD`;
    const ms = k.dt - Date.now();
    // in progress (a match lasts ~2h; up to ~2h45m with extra time + shootout)
    if (ms <= 0 && ms > -2.75 * 3600 * 1000) return `Live now · kicked off ${k.time}`;
    if (ms <= 0) return `Awaiting final score · ${k.day}`;
    const secs = Math.floor(ms / 1000);
    const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600),
      min = Math.floor((secs % 3600) / 60), s = secs % 60;
    if (d > 0) return `Kicks off in ${d}d ${h}h`;
    if (h > 0) return `Kicks off in ${h}h ${String(min).padStart(2, "0")}m`;
    return `Kicks off in ${min}:${String(s).padStart(2, "0")}`;
  }

  function armCountdown(m) {
    clearInterval(countdownTimer);
    if (!m || !m.datetime_utc) return;
    countdownTimer = setInterval(() => {
      const el = document.querySelector("[data-countdown]");
      if (!el) { clearInterval(countdownTimer); return; }
      el.textContent = countdownText(m);
    }, 1000);
  }

  /* ---------- avatars, flags, colors ---------- */

  const teamColor = (t) => (t && t.color) || "#47554b";

  function initials(name) {
    if (isTodo(name)) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  // Headshot if the data has one; otherwise initials on a team-color gradient.
  function avatar(p, team, extra = "") {
    const color = teamColor(team);
    const vars = `--av-a:${esc(color)};--av-b:color-mix(in srgb, ${esc(color)} 55%, #000)`;
    if (p && !isTodo(p.photo_url)) {
      return `<span class="avatar ${extra}" style="${vars}"><img src="${esc(p.photo_url)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
    }
    return `<span class="avatar ${extra}" style="${vars}">${esc(initials(p ? p.name : null))}</span>`;
  }

  const flagDisc = (t, size = "") => t
    ? `<span class="flag-disc ${size}" style="--ring:${esc(teamColor(t))}" aria-hidden="true">${t.flag}</span>`
    : `<span class="flag-disc flag-disc--tbd ${size}" aria-hidden="true">?</span>`;

  function stripeVars(m) {
    const a = side(m, 1), b = side(m, 2);
    return `--stripe-a:${esc(a.tbd ? "#9aa095" : teamColor(a.team))};--stripe-b:${esc(b.tbd ? "#9aa095" : teamColor(b.team))}`;
  }

  function scoreOf(m, n) {
    if (m.status !== "final" || !m.score) return null;
    const parts = String(m.score).split(/[–\-:]/).map((x) => x.trim());
    return parts.length === 2 ? parts[n - 1] : null;
  }

  /* ---------- fixture card ---------- */

  // The poster block: two team-color panels meeting on a diagonal.
  function duel(m, { round = true } = {}) {
    const sideCell = (n) => {
      const s = side(m, n);
      if (s.tbd) return `<div class="duel-side is-tbd"><span class="duel-name">${esc(s.note)}</span></div>`;
      return `<div class="duel-side" style="--c:${esc(teamColor(s.team))}">
        <span class="duel-flag" aria-hidden="true">${s.team.flag}</span>
        <span class="duel-name">${esc(s.team.name)}</span>
      </div>`;
    };
    const mid = m.status === "final" && m.score
      ? `<span class="score">${esc(m.score)}</span>${m.penalties ? `<span class="pens">pens ${esc(m.penalties)}</span>` : ""}`
      : `VS`;
    return `<div class="duel">
      ${round ? `<span class="duel-round">${esc(ROUND_LABEL[m.round] || m.round)} · Match ${esc(String(m.bracket_slot))}</span>` : ""}
      ${sideCell(1)}${sideCell(2)}
      <span class="duel-vs">${mid}</span>
    </div>`;
  }

  function placeOf(m) {
    const venue = isTodo(m.venue) ? null : m.venue;
    const city = isTodo(m.city) ? null : m.city;
    return [venue, city].filter(Boolean).join(" · ") || "Venue TBD";
  }

  function fixtureCard(m, { hero = false } = {}) {
    const k = kickoff(m);
    const foot = m.status === "final"
      ? `<span>Full time · ${esc(k.day)}</span><span>${esc(placeOf(m))}</span>`
      : `<span class="cd" ${hero ? "data-countdown" : ""}>${esc(countdownText(m))}</span><span>${esc(placeOf(m))}</span>`;
    return `<a class="fixture pressable" href="#/match/${esc(m.id)}" data-peek="${esc(m.id)}">
      ${duel(m)}
      <div class="fixture-foot">${foot}</div>
    </a>`;
  }

  function matchLine(m) {
    const a = side(m, 1), b = side(m, 2);
    const k = kickoff(m);
    const names = (s) => s.tbd ? `<span class="tbd">${esc(s.note)}</span>` : esc(s.team.name);
    const flags = `${a.tbd ? "" : a.team.flag}${b.tbd ? "" : b.team.flag}`;
    const meta = m.status === "final" && m.score
      ? `<span class="score">${esc(m.score)}</span>${m.penalties ? `pens ${esc(m.penalties)}` : esc(k.day)}`
      : `${esc(k.day)}<br>${esc(k.time)}`;
    return `<li><a class="match-line pressable" style="${stripeVars(m)}" href="#/match/${esc(m.id)}" data-peek="${esc(m.id)}">
      ${flags ? `<span class="match-line-flags" aria-hidden="true">${flags}</span>` : ""}
      <span class="match-line-names">${names(a)}<br>${names(b)}</span>
      <span class="match-line-meta">${meta}</span>
    </a></li>`;
  }

  /* ---------- player stickers ---------- */

  function playerSticker(p) {
    const team = teamOf(p.team_id);
    const band = `--band:${esc(teamColor(team))}`;
    const name = isTodo(p.name) ? '<span class="muted">Star TBD</span>' : esc(p.name);
    const sub = isTodo(p.club) ? "research pending" : p.club;
    return `<button type="button" class="sticker" style="${band}" data-player="${esc(p.id)}" aria-haspopup="dialog">
      <span class="sticker-band" aria-hidden="true"></span>
      ${avatar(p, team)}
      <span class="sticker-name">${name}</span>
      <span class="sticker-sub">${esc(sub)}</span>
      ${team ? `<span class="sticker-flag" aria-hidden="true">${team.flag}</span>` : ""}
    </button>`;
  }

  const stickerRow = (players) =>
    `<div class="snap-row">${players.map(playerSticker).join("")}</div>`;

  /* ---------- the pitch (default lineup) ---------- */

  function pitchView(team) {
    const lineup = Array.isArray(team.lineup) ? team.lineup : [];
    const formation = !isTodo(team.formation) && /^\d+(-\d+)+$/.test(team.formation) ? team.formation : null;
    const rows = [1, ...(formation ? formation.split("-").map(Number) : [4, 3, 3])]; // GK + outfield, bottom→top
    const ghost = lineup.length === 0;

    let idx = 0;
    const nodes = [];
    rows.forEach((count, r) => {
      const y = 88 - (r * (72 / (rows.length - 1)));
      for (let i = 0; i < count; i++) {
        // lineup data lists each line right-to-left, so mirror x to draw
        // the right back on the right side of the pitch
        const x = (100 / (count + 1)) * (count - i);
        const entry = lineup[idx++] || null;
        nodes.push({ x, y, entry });
      }
    });

    const nodeHTML = nodes.map(({ x, y, entry }) => {
      const pos = `style="left:${x}%;top:${y}%"`;
      if (!entry || isTodo(entry.name)) {
        return `<span class="pitch-node" ${pos} aria-hidden="true"><span class="avatar avatar--ghost" style="width:42px;height:42px">?</span></span>`;
      }
      const linked = entry.player_id && db.playerById[entry.player_id];
      const p = linked ? db.playerById[entry.player_id] : { name: entry.name, photo_url: entry.photo_url };
      const label = entry.name.trim().split(/\s+/).pop();
      const inner = `${avatar(p, team)}<span class="pitch-node-name">${esc(label)}</span>`;
      return linked
        ? `<button type="button" class="pitch-node" ${pos} data-player="${esc(entry.player_id)}" aria-haspopup="dialog" aria-label="${esc(entry.name)}">${inner}</button>`
        : `<button type="button" class="pitch-node" ${pos} disabled aria-label="${esc(entry.name)}">${inner}</button>`;
    }).join("");

    return `<div class="pitch-wrap">
      <div class="pitch">
        <span class="pitch-circle" aria-hidden="true"></span>
        <span class="pitch-box" aria-hidden="true"></span>
        ${nodeHTML}
        ${ghost ? `<span class="pitch-note">${TODO_CHIP}</span>` : ""}
      </div>
      <p class="pitch-legend">${ghost
        ? "Typical starting XI lands here once the research JSON drops."
        : `Typical starting XI${formation ? ` · ${esc(formation)}` : ""}. Tap a face for the player card.`}</p>
    </div>`;
  }

  /* ---------- player sheet (overlay card) ---------- */

  function playerSheetBody(p, { asPage = false } = {}) {
    const t = teamOf(p.team_id);
    const stats = p.tournament_stats || {};
    const statBits = [];
    if (stats.goals != null) statBits.push(`${stats.goals} goal${stats.goals === 1 ? "" : "s"}`);
    if (stats.assists != null) statBits.push(`${stats.assists} assist${stats.assists === 1 ? "" : "s"}`);
    if (!isTodo(stats.note)) statBits.push(esc(stats.note));

    return `
      <div class="sheet-hero" style="--band:${esc(teamColor(t))}">
        ${avatar(p, t)}
        <div>
          <h2>${isTodo(p.name) ? "Star player TBD" : esc(p.name)}</h2>
          <p class="sub">
            ${t ? `<a href="#/team/${esc(t.id)}">${t.flag} ${esc(t.name)}</a> · ` : ""}
            ${isTodo(p.position) ? "Position TBD" : esc(p.position)}${p.age != null ? ` · age ${esc(String(p.age))}` : ""}
          </p>
        </div>
      </div>
      <div class="sheet-body">
        <p class="kicker" style="margin-top:6px">Club</p>
        <p class="prose">${text(p.club)}${isTodo(p.league) ? "" : ` · <a href="#/learn/leagues">${esc(p.league)}</a>`}</p>
        ${statBits.length ? `<p class="kicker">This World Cup</p><p class="prose">${statBits.join(" · ")}</p>` : ""}
        <p class="kicker">The journey</p>
        <p class="prose">${text(p.journey)}</p>
        <p class="kicker">Watch for this</p>
        <p class="prose">${text(p.watch_for)}</p>
        <div class="sheet-actions">
          ${asPage
            ? (t ? `<a class="btn" href="#/team/${esc(t.id)}">Team page</a>` : "")
            : `<a class="btn" href="#/player/${esc(p.id)}" data-sheet-link>Full page &amp; link</a>`}
        </div>
      </div>`;
  }

  // Generic bottom sheet: hovers over the current page, never navigates.
  function openSheet(label, bodyHTML) {
    const prev = document.activeElement;
    const backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    backdrop.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
      <div class="sheet-grip" aria-hidden="true"></div>
      <button type="button" class="sheet-close" aria-label="Close">✕</button>
      ${bodyHTML}
    </div>`;
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";

    const close = () => {
      backdrop.remove();
      if (!document.querySelector(".sheet-backdrop")) document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      if (prev && prev.focus) prev.focus();
    };
    const onKey = (e) => {
      if (e.key === "Escape" && backdrop === [...document.querySelectorAll(".sheet-backdrop")].pop()) close();
    };
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop || e.target.closest(".sheet-close")) close();
      if (e.target.closest("a")) close(); // navigating away: dismiss the sheet
    });
    document.addEventListener("keydown", onKey);
    backdrop.querySelector(".sheet-close").focus();
    return close;
  }

  function openPlayerSheet(id) {
    const p = db.playerById[id];
    if (!p) return;
    openSheet(isTodo(p.name) ? "Player card" : p.name, playerSheetBody(p));
  }

  // Quick match preview: the five-minute core without leaving the page.
  function openMatchSheet(id) {
    const m = db.matchById[id];
    if (!m) return;
    const teams = [side(m, 1), side(m, 2)].filter((s) => !s.tbd).map((s) => s.team);
    const stars = teams.flatMap((t) => (t.star_player_ids || []).map((pid) => db.playerById[pid]).filter(Boolean));
    const k = kickoff(m);
    const watch = listIsTodo(m.things_to_watch)
      ? `<p class="prose">${TODO_CHIP}</p>`
      : `<ol class="watch-list">${m.things_to_watch.map((t) => `<li>${text(t)}</li>`).join("")}</ol>`;

    const body = `
      ${duel(m)}
      <div class="sheet-body">
        <p class="small muted" style="margin:12px 0 0">
          ${m.status === "final" ? `Full time · ${esc(k.day)}` : `${esc(countdownText(m))}`} · ${esc(placeOf(m))}
        </p>
        <p class="kicker">The storyline</p>
        <p class="prose">${text(m.storyline)}</p>
        <p class="kicker">Three things to watch</p>
        ${watch}
        ${stars.length ? `<p class="kicker">Star players</p><div class="snap-row" style="margin:0;padding:6px 0 8px">${stars.map(playerSticker).join("")}</div>` : ""}
        <div class="sheet-actions">
          <a class="btn btn--primary" href="#/match/${esc(m.id)}">Full guide</a>
          <button class="btn" type="button" data-share="${esc(m.id)}">Share card</button>
        </div>
      </div>`;
    const sides = [side(m, 1), side(m, 2)].map((s) => s.tbd ? s.note : s.team.name);
    openSheet(`${sides[0]} vs ${sides[1]}`, body);
  }

  const backLink = (href, label) => `<a class="back-link" href="${href}">← ${esc(label)}</a>`;

  /* ---------- views ---------- */

  function viewHome() {
    const upcoming = db.matches.filter((m) => m.status !== "final").sort(matchSort);
    const finished = db.matches.filter((m) => m.status === "final").sort(matchSort).reverse();
    const featured = upcoming.slice(0, 4).filter((m) => kickoff(m).sort !== Infinity);

    let html = `
      <p class="kicker">World Cup 2026 · Knockout stage</p>
      <h1 class="hero-title">Catch up on any match in five minutes.</h1>
      <p class="hero-note">Pick a match. Get the storyline, the stars, and exactly what to watch for — written for people new to soccer.</p>
    `;

    if (featured.length) {
      html += `<p class="kicker">Up next — swipe</p>
        <div class="snap-row snap-row--fixtures">${featured.map((m, i) => fixtureCard(m, { hero: i === 0 })).join("")}</div>`;
    }

    html += `<div class="btn-row">
      <a class="btn" href="#/bracket">Bracket</a>
      <a class="btn" href="#/learn">New here? Learn</a>
    </div>`;

    // full schedule grouped by day
    const groups = [];
    for (const m of upcoming) {
      const label = m.datetime_utc
        ? new Date(m.datetime_utc).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
        : (m.date_local ? fmt.dayOnlyLong(m.date_local)
          : `${ROUND_LABEL[m.round] || m.round}${m.round === "F" ? "" : "s"} — dates TBD`);
      const g = groups.find((x) => x.label === label);
      if (g) g.items.push(m); else groups.push({ label, items: [m] });
    }
    for (const g of groups) {
      html += `<h2 class="day-heading">${esc(g.label)}</h2><ul class="match-list">${g.items.map(matchLine).join("")}</ul>`;
    }

    if (finished.length) {
      html += `<details class="fold" style="margin-top:22px"><summary>Finished matches (${finished.length})</summary>
        <div class="fold-body"><ul class="match-list">${finished.map(matchLine).join("")}</ul></div>
      </details>`;
    }

    render(html, "Kickoff in Five — World Cup 2026 Catch-Up Guide");
    armCountdown(featured[0]);
  }

  function viewMatch(id) {
    const m = db.matchById[id];
    if (!m) return viewNotFound(`No match called “${id}”.`);
    const a = side(m, 1), b = side(m, 2);
    const teams = [a, b].filter((s) => !s.tbd).map((s) => s.team);
    const title = teams.length === 2 ? `${teams[0].name} vs ${teams[1].name}` : ROUND_LABEL[m.round] || "Match";
    const stars = teams.flatMap((t) => (t.star_player_ids || []).map((pid) => db.playerById[pid]).filter(Boolean));
    const k = kickoff(m);
    const venue = isTodo(m.venue) ? null : m.venue;
    const city = isTodo(m.city) ? null : m.city;
    const place = [venue, city].filter(Boolean).join(" · ") || "Venue TBD";
    const sideName = (s) => (s.tbd ? s.note : s.team.name);

    let html = `<h1 class="vh">${esc(sideName(a))} vs ${esc(sideName(b))} — ${esc(ROUND_LABEL[m.round] || m.round)}</h1>
    <div class="fixture" style="margin-top:14px">
      ${duel(m)}
      <div class="fixture-foot">
        ${m.status === "final"
          ? `<span>Full time · ${esc(k.day)}</span>`
          : `<span class="cd" data-countdown>${esc(countdownText(m))}</span>`}
        <span>${esc(place)}${k.known ? ` · ${esc(k.time)}` : ""}</span>
      </div>
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
      ? stickerRow(stars)
      : `<p class="prose muted small">Star players land here once the research JSON drops.</p>`;
    html += `</div>`;

    const h2h = listIsTodo(m.h2h) ? `<p>${TODO_CHIP}</p>` : `<ul>${m.h2h.map((x) => `<li>${text(x)}</li>`).join("")}</ul>`;
    const funFacts = teams
      .filter((t) => !listIsTodo(t.fun_facts))
      .map((t) => `<p class="small" style="margin:12px 0 4px"><strong>${t.flag} ${esc(t.name)}</strong></p><ul>${t.fun_facts.map((f) => `<li>${text(f)}</li>`).join("")}</ul>`)
      .join("");
    html += `<details class="fold"><summary>Head-to-head &amp; fun facts</summary><div class="fold-body">${h2h}${funFacts}</div></details>`;

    if (teams.length) {
      const snaps = teams.map((t) => `<div class="snap-block">
        <div class="snap-head">${t.flag} ${esc(t.name)}</div>
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

    html += `<div class="btn-row" ${m.status === "final" || !m.watch_link ? 'style="grid-template-columns:1fr"' : ""}>
      ${m.status !== "final" && m.watch_link ? `<a class="btn btn--primary" href="${esc(m.watch_link)}" target="_blank" rel="noopener">Watch live →</a>` : ""}
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
      ${flagDisc(t)}
      <div>
        <h1>${esc(t.name)}</h1>
        <p class="sub">${t.fifa_rank != null ? `FIFA rank ${esc(String(t.fifa_rank))} · ` : ""}${isTodo(t.group_summary) ? "" : esc(t.group_summary)}</p>
      </div>
    </div>
    <p><span class="status-pill ${t.still_alive ? "status-pill--alive" : "status-pill--out"}">${t.still_alive ? "Still alive" : "Eliminated"}</span></p>`;

    html += `<div class="section"><h2 class="section-title">This tournament</h2><p class="prose">${text(t.storyline)}</p></div>`;

    html += `<div class="section"><h2 class="section-title">Stars to know</h2>`;
    html += stars.length
      ? stickerRow(stars)
      : `<p class="prose muted small">Star players land here once the research JSON drops.</p>`;
    html += `</div>`;

    html += `<div class="section"><h2 class="section-title">On the field</h2>${pitchView(t)}</div>`;

    html += `<div class="section"><h2 class="section-title">How they play</h2><p class="prose">${text(t.style)}</p></div>`;
    html += `<div class="section"><h2 class="section-title">World Cup history</h2>
      <p class="prose">${text(t.wc_history)}</p>
      <p class="prose small muted" style="margin-top:8px">Best finish: ${text(t.best_wc_finish)}</p></div>`;

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
    const html = `<div class="card" style="margin-top:16px">${playerSheetBody(p, { asPage: true })}</div>
      ${backLink("#/", "All matches")}`;
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
            const pn = String(m.penalties).split(/[–\-:]/).map(Number);
            return pn.length === 2 && pn[n - 1] > pn[n === 1 ? 1 : 0];
          }
          return false;
        })();
        if (s.tbd) return `<div class="bnode-team is-tbd">${esc(s.note)}</div>`;
        return `<div class="bnode-team ${winner ? "is-winner" : ""}">
          <span class="bflag" aria-hidden="true">${s.team.flag}</span>${esc(s.team.code)}
          ${sc != null ? `<span class="bscore">${esc(sc)}</span>` : ""}
        </div>`;
      };
      const place = isTodo(m.city) ? "" : ` · ${m.city.split(",")[0]}`;
      return `<a class="bnode pressable" href="#/match/${esc(m.id)}" data-peek="${esc(m.id)}">
        <div class="bnode-meta">${esc(k.day)}${esc(place)}</div>
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
      <h1 class="hero-title">The bracket</h1>
      <p class="hero-note">Scroll sideways →. Tap any match for the five-minute guide.</p>
      <div class="bracket-scroller"><div class="bracket">${colHTML}</div></div>
      ${backLink("#/", "All matches")}`;
    render(html, "Bracket — Kickoff in Five");
  }

  function viewLearn(sectionId) {
    const secs = db.learn.sections || [];
    let html = `
      <p class="kicker">New to soccer?</p>
      <h1 class="hero-title">Learn the game in five minutes</h1>
      <p class="hero-note">Everything you need to not feel lost at the watch party. Skim the headlines, tap what you're curious about.</p>`;

    for (const s of secs) {
      const open = s.id === sectionId;
      html += `<div class="section" id="learn-${esc(s.id)}">
        <h2 class="section-title">${esc(s.title)}</h2>
        ${isTodo(s.intro) ? "" : `<p class="prose muted" style="margin-bottom:10px">${esc(s.intro)}</p>`}
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
      <div class="center" style="padding:48px 0">
        <h1 class="hero-title" style="font-size:1.5rem">Wrong turnstile</h1>
        <p class="prose muted">${esc(msg || "That page doesn't exist.")}</p>
        <p style="margin-top:18px"><a class="btn" href="#/">Back to today's matches</a></p>
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
    const venue = isTodo(m.venue) ? null : m.venue;
    const city = isTodo(m.city) ? null : m.city;
    const place = [venue, city].filter(Boolean).join(" · ") || "Venue TBD";

    const overlay = document.createElement("div");
    overlay.className = "share-overlay";
    overlay.innerHTML = `
      <div class="share-stage">
        <p class="share-hint">Screenshot this card — it's sized for sharing.</p>
        <div class="share-card">
          ${duel(m)}
          <div class="share-card-body">
            ${isTodo(m.storyline) ? "" : `<p class="share-storyline">${esc(m.storyline)}</p>`}
            ${watch}
            ${starsLine}
            <p class="small muted" style="margin:12px 0 0">${esc(k.day)} · ${esc(place)}</p>
          </div>
          <div class="share-foot"><span>World Cup 2026</span><span>Kickoff in Five</span></div>
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

  const revealObserver = ("IntersectionObserver" in window) && !matchMedia("(prefers-reduced-motion: reduce)").matches
    ? new IntersectionObserver((entries) => {
        for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); revealObserver.unobserve(en.target); }
      }, { rootMargin: "0px 0px -8% 0px" })
    : null;

  function render(html, title) {
    $main.innerHTML = html;
    if (title) document.title = title;
    window.scrollTo(0, 0);
    if (revealObserver) {
      for (const el of $main.children) { el.classList.add("reveal"); revealObserver.observe(el); }
    }
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
        const share = e.target.closest("[data-share]");
        if (share) return openShare(share.getAttribute("data-share"));
        const player = e.target.closest("[data-player]");
        if (player && !player.disabled) return openPlayerSheet(player.getAttribute("data-player"));
        // match links open a hover-over preview instead of navigating;
        // modified clicks (new tab etc.) fall through to the real link
        const peek = e.target.closest("[data-peek]");
        if (peek && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          return openMatchSheet(peek.getAttribute("data-peek"));
        }
      });
      route();
    } catch (err) {
      render(`<div class="center" style="padding:48px 0">
        <h1 class="hero-title" style="font-size:1.3rem">Couldn't load match data</h1>
        <p class="prose muted small">${esc(err.message)}</p>
        <p style="margin-top:18px"><button class="btn" onclick="location.reload()">Retry</button></p>
      </div>`, "Kickoff in Five");
    }
  }

  boot();
})();
