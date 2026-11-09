/*
 * Fit / No Fit — CSV2 Activity 2 (Dispensing Mechanism Exploration), Team Nudge.
 * No build step, no dependencies. Data is kept in this browser's localStorage
 * and can be exported as CSV / JSON from the Results screen.
 */
(function () {
  "use strict";

  var C = window.CONCEPTS;
  var O = window.OPTIONS;
  var byId = {};
  C.forEach(function (c) { byId[c.id] = c; });

  var KEY = "fitnofit.csv2.v1";
  var store = { sessions: [], settings: { randomize: true, showNames: false } };
  var storageOK = true;

  // UI state (not persisted)
  var view = "home";
  var cur = null;              // active session
  var shownAt = 0;             // when the current Part A stimulus appeared
  var armedDelete = null;      // session id waiting for a second click
  var sortKey = "id", sortDir = 1;

  var app = document.getElementById("app");
  var progressEl = document.getElementById("progress");
  var rightEl = document.getElementById("topbar-right");
  var bannerEl = document.getElementById("banner");

  var FLOW = [
    { key: "intake", label: "Participant" },
    { key: "introA", label: "Part A · Fit / No Fit", also: ["partA"] },
    { key: "board", label: "Review sort" },
    { key: "introB", label: "Part B · How it works", also: ["partB"] },
    { key: "rank", label: "Ranking" },
    { key: "done", label: "Done" }
  ];

  /* ------------------------------------------------------------------ storage */

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        store.sessions = Array.isArray(d.sessions) ? d.sessions : [];
        store.settings = Object.assign(store.settings, d.settings || {});
      }
    } catch (e) { storageOK = false; }
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (e) { storageOK = false; }
    updateBanner();
  }

  function updateBanner() {
    if (storageOK) { bannerEl.hidden = true; return; }
    bannerEl.hidden = false;
    bannerEl.textContent = "This browser isn't letting the app save. Responses stay only while this tab is open — export JSON from Results before closing.";
  }

  function touch() {
    if (!cur) return;
    cur.updatedAt = new Date().toISOString();
    save();
    var s = document.getElementById("saved");
    if (s) s.textContent = "Saved " + timeStr(cur.updatedAt);
  }

  /* ------------------------------------------------------------------ helpers */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function timeStr(iso) {
    try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
    catch (e) { return ""; }
  }
  function dateStr(iso) {
    try { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); }
    catch (e) { return ""; }
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function getP(path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, cur);
  }
  function setP(path, val) {
    var ks = path.split("."), o = cur;
    for (var i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null || typeof o[ks[i]] !== "object") o[ks[i]] = {};
      o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = val;
    touch();
  }
  function avg(arr) {
    var v = arr.filter(function (x) { return typeof x === "number" && !isNaN(x); });
    return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
  }
  function fmt(n, d) { return n == null ? "—" : n.toFixed(d == null ? 1 : d); }
  function pct(n) { return n == null ? "—" : Math.round(n * 100) + "%"; }
  function conceptLabel(c) {
    return store.settings.showNames ? "Concept " + c.id + " · " + c.name : "Concept " + c.id;
  }
  function counts(list) {
    var m = {};
    list.forEach(function (x) { m[x] = (m[x] || 0) + 1; });
    return Object.keys(m).map(function (k) { return [k, m[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
  }

  /* ------------------------------------------------------------------ UI bits */

  function chips(path, opts, o) {
    o = o || {};
    var v = getP(path);
    return '<div class="chips" role="group">' + opts.map(function (x) {
      var on = o.single ? v === x : Array.isArray(v) && v.indexOf(x) > -1;
      return '<button type="button" class="chip ' + (on ? "on " : "") + (o.cls || "") + '" data-action="' +
        (o.single ? "pick" : "toggle") + '" data-path="' + esc(path) + '" data-val="' + esc(x) +
        '" aria-pressed="' + on + '">' + esc(x) + "</button>";
    }).join("") + "</div>";
  }

  function scale(path, lo, hi) {
    var v = getP(path), out = '<div class="scale" role="group">';
    for (var i = 1; i <= 5; i++) {
      out += '<button type="button" class="' + (v === i ? "on" : "") + '" data-action="scale" data-path="' +
        esc(path) + '" data-val="' + i + '" aria-pressed="' + (v === i) + '">' + i + "</button>";
    }
    return out + '</div><div class="scale-labels"><span>' + esc(lo) + "</span><span>" + esc(hi) + "</span></div>";
  }

  function textarea(path, ph) {
    return '<textarea data-bind="' + esc(path) + '" placeholder="' + esc(ph || "") + '">' + esc(getP(path) || "") + "</textarea>";
  }

  function stepIndex(step) {
    for (var i = 0; i < FLOW.length; i++) {
      if (FLOW[i].key === step || (FLOW[i].also && FLOW[i].also.indexOf(step) > -1)) return i;
    }
    return -1;
  }

  function renderChrome() {
    if (cur && view !== "home" && view !== "results") {
      var si = stepIndex(view);
      progressEl.innerHTML = '<div class="steps-nav">' + FLOW.map(function (f, i) {
        return '<span class="' + (i === si ? "on" : i < si ? "done" : "") + '">' + esc(f.label) + "</span>";
      }).join("") + "</div>";
      rightEl.innerHTML = '<span id="saved">' + (cur.updatedAt ? "Saved " + timeStr(cur.updatedAt) : "") +
        '</span><button class="btn ghost" data-action="exit">Exit</button>';
    } else {
      progressEl.innerHTML = "";
      rightEl.innerHTML = view === "results"
        ? '<button class="btn" data-action="home">Home</button>'
        : '<button class="btn" data-action="results">Results &amp; export</button>';
    }
  }

  /* ------------------------------------------------------------------ navigation */

  function go(step, idx) {
    view = step;
    if (cur) {
      cur.step = step;
      cur.idx = idx || 0;
      touch();
    }
    if (step === "partA") shownAt = Date.now();
    render();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  function render(keepScroll) {
    var y = window.scrollY;
    renderChrome();
    var fn = VIEWS[view] || VIEWS.home;
    app.innerHTML = fn();
    if (keepScroll) window.scrollTo(0, y);
    if (view === "rank") bindRanking();
  }

  function newSession() {
    var order = C.map(function (c) { return c.id; });
    if (store.settings.randomize) shuffle(order);
    var n = store.sessions.length + 1;
    var now = new Date().toISOString();
    var s = {
      id: "S" + Date.now().toString(36),
      createdAt: now, updatedAt: now,
      status: "in-progress", step: "intake", idx: 0,
      participant: {
        pid: "P" + String(n).padStart(2, "0"), name: "", moderator: "", notetaker: "",
        homeType: "", household: [], products: [], storage: "", notes: ""
      },
      order: order,
      partA: {}, boardChanges: [], partB: {},
      ranking: [], rankWhy: "", rankFactors: [], displayImpact: ""
    };
    store.sessions.push(s);
    save();
    return s;
  }

  function resume(id) {
    cur = store.sessions.filter(function (s) { return s.id === id; })[0] || null;
    if (!cur) return go("home");
    go(cur.step || "intake", cur.idx || 0);
  }

  /* ------------------------------------------------------------------ views */

  var VIEWS = {};

  VIEWS.home = function () {
    var open = store.sessions.filter(function (s) { return s.status !== "complete"; });
    var done = store.sessions.length - open.length;
    var strip = [1, 3, 4, 5, 6, 8, 10, 11].map(function (id) {
      return '<img src="' + byId[id].hero + '" alt="">';
    }).join("");
    return (
      '<section class="hero-home">' +
        "<div>" +
          '<p class="muted small">Team Nudge · CSV2 · Activity 2 — Dispensing Mechanism Exploration</p>' +
          "<h1>Would you leave it out on display?</h1>" +
          "<p>Participants sort " + C.length + " spray concepts into <b>Fit</b> or <b>No Fit</b> by looks alone, say where they'd keep and use each one, then see how each mechanism works and rank them. Everything is saved on this device as you go.</p>" +
          '<div class="row"><button class="btn primary lg" data-action="new">Start new participant</button>' +
          '<button class="btn lg" data-action="results">Results &amp; export</button></div>' +
          '<p class="muted small" style="margin-top:12px">' + store.sessions.length + " session" + (store.sessions.length === 1 ? "" : "s") + " on this device · " + done + " complete</p>" +
        "</div>" +
        '<div class="hero-strip">' + strip + "</div>" +
      "</section>" +
      '<section class="flow" style="margin-bottom:28px">' +
        "<div><b>Participant</b>Name and home context</div>" +
        "<div><b>Part A · Fit / No Fit</b>Looks only, plus where they'd put and use it</div>" +
        "<div><b>Review sort</b>See both piles, move anything</div>" +
        "<div><b>Part B · How it works</b>Act it out, reveal the steps, rate it</div>" +
        "<div><b>Ranking</b>Most to least preferred, and why</div>" +
      "</section>" +
      (open.length ? '<section class="card"><h2>Pick up where you left off</h2><div class="table-wrap"><table><thead><tr><th>Participant</th><th>Started</th><th>Step</th><th></th></tr></thead><tbody>' +
        open.slice().reverse().map(function (s) {
          var st = FLOW[Math.max(0, stepIndex(s.step))].label;
          return "<tr><td><b>" + esc(s.participant.pid) + "</b> " + esc(s.participant.name || "(no name yet)") + "</td><td>" +
            dateStr(s.createdAt) + " " + timeStr(s.createdAt) + "</td><td>" + esc(st) +
            '</td><td class="num"><button class="btn" data-action="resume" data-id="' + esc(s.id) + '">Resume</button></td></tr>';
        }).join("") + "</tbody></table></div></section>" : "")
    );
  };

  VIEWS.intake = function () {
    var p = cur.participant;
    return (
      '<div class="card stack" style="max-width:760px;margin:0 auto">' +
        "<div><h1>Participant</h1><p class=\"muted\">Fill this in with the participant before starting. Only the name is required.</p></div>" +
        '<div class="grid-2">' +
          '<label class="field"><span>Participant name *</span><input type="text" data-bind="participant.name" value="' + esc(p.name) + '" placeholder="First name or alias" autocomplete="off"></label>' +
          '<label class="field"><span>Participant ID</span><input type="text" data-bind="participant.pid" value="' + esc(p.pid) + '"></label>' +
          '<label class="field"><span>Moderator</span><input type="text" data-bind="participant.moderator" value="' + esc(p.moderator) + '"></label>' +
          '<label class="field"><span>Note-taker</span><input type="text" data-bind="participant.notetaker" value="' + esc(p.notetaker) + '"></label>' +
        "</div>" +
        '<div><div class="q">Home type</div>' + chips("participant.homeType", O.homeType, { single: true }) + "</div>" +
        '<div><div class="q">Household <small>(select all that apply)</small></div>' + chips("participant.household", O.household) + "</div>" +
        '<div><div class="q">Home scent products they use now</div>' + chips("participant.products", O.products) + "</div>" +
        '<div><div class="q">Where do they keep their air freshener spray today?</div>' + chips("participant.storage", O.storage, { single: true }) + "</div>" +
        '<label class="field"><span>Session notes</span>' + textarea("participant.notes", "Anything worth noting before you start") + "</label>" +
        '<div class="spread"><span class="muted small">Concept order: ' + (store.settings.randomize ? "randomized for this participant" : "1 → " + C.length) + "</span>" +
        '<button class="btn primary lg" data-action="startA" id="startA" ' + (p.name.trim() ? "" : "disabled") + ">Start Part A</button></div>" +
      "</div>"
    );
  };

  VIEWS.introA = function () {
    return (
      '<div class="card center" style="max-width:720px;margin:40px auto;padding:40px">' +
        '<p class="muted small">Part A · Fit / No Fit</p>' +
        "<h1>Picture each one in your home</h1>" +
        "<p>You'll see " + C.length + " spray bottle ideas, one at a time. For each, decide whether you'd feel comfortable leaving it out on display in your home.</p>" +
        '<div class="grid-2" style="text-align:left;margin:24px 0">' +
          '<div class="card" style="box-shadow:none;border-color:var(--fit)"><h3 style="color:var(--fit)">Fit</h3><p class="small" style="margin:0">I\'d be happy to leave this out where people can see it.</p></div>' +
          '<div class="card" style="box-shadow:none;border-color:var(--nofit)"><h3 style="color:var(--nofit)">No Fit</h3><p class="small" style="margin:0">I\'d rather put this away, or wouldn\'t keep it.</p></div>' +
        "</div>" +
        '<p class="muted small">Go with your first impression. There are no right answers, and we won\'t explain how they work yet.</p>' +
        '<button class="btn primary lg" data-action="beginA">Begin</button>' +
      "</div>"
    );
  };

  VIEWS.partA = function () {
    var i = cur.idx, id = cur.order[i], c = byId[id];
    var base = "partA." + id;
    var a = cur.partA[id] || {};
    var reasons = a.verdict === "fit" ? O.fitReasons : a.verdict === "nofit" ? O.noFitReasons : null;
    return (
      '<div class="eval">' +
        '<div class="stimulus">' +
          '<div class="label"><span class="concept-num">' + esc(conceptLabel(c)) + "</span><span>" + (i + 1) + " of " + C.length + "</span></div>" +
          '<img src="' + c.hero + '" alt="' + esc(conceptLabel(c)) + '">' +
        "</div>" +
        '<div class="stack">' +
          '<div><div class="q">Would you feel comfortable leaving this on display in your home?</div>' +
            '<div class="verdict">' +
              '<button type="button" class="fit ' + (a.verdict === "fit" ? "on" : "") + '" data-action="verdict" data-val="fit">Fit<small>Leave it out <span class="kbd">F</span></small></button>' +
              '<button type="button" class="nofit ' + (a.verdict === "nofit" ? "on" : "") + '" data-action="verdict" data-val="nofit">No Fit<small>Put it away <span class="kbd">N</span></small></button>' +
            "</div></div>" +
          (reasons
            ? '<div><div class="q">What made you decide? <small>(pick any)</small></div>' + chips(base + ".reasons", reasons, { cls: a.verdict }) + "</div>"
            : '<p class="muted small">Pick Fit or No Fit to continue.</p>') +
          '<div><div class="q">Where in your home would you put this?</div>' + chips(base + ".placeAt", O.rooms) + "</div>" +
          '<div><div class="q">Where would you use it?</div>' + chips(base + ".useAt", O.rooms) + "</div>" +
          '<details class="mod"' + (a.note || a.mentionedMechanism ? " open" : "") + "><summary>Moderator notes <span class=\"mod-tag\">not for participant</span></summary>" +
            '<div class="stack">' +
              '<div><div class="q">Did they bring up the nozzle / trigger / mechanism on their own?</div>' + chips(base + ".mentionedMechanism", ["Yes, unprompted", "Only when probed", "No"], { single: true }) + "</div>" +
              textarea(base + ".note", "Quotes, probes, body language…") +
            "</div>" +
          "</details>" +
          '<div class="nav-row">' +
            '<button class="btn" data-action="prevA">' + (i === 0 ? "Back to intro" : "← Previous") + "</button>" +
            '<button class="btn primary" data-action="nextA" ' + (a.verdict ? "" : "disabled") + ">" + (i === C.length - 1 ? "Review the sort →" : "Next →") + "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  };

  function thumb(id, extra) {
    var c = byId[id];
    return '<button type="button" class="thumb ' + (extra || "") + '" data-action="flip" data-id="' + id + '" title="Tap to move">' +
      '<span class="n">' + id + "</span><img src=\"" + c.hero + '" alt="' + esc(conceptLabel(c)) + '">' +
      (store.settings.showNames ? '<div class="mv">' + esc(c.name) + "</div>" : "") + "</button>";
  }

  VIEWS.board = function () {
    var fits = cur.order.filter(function (id) { return (cur.partA[id] || {}).verdict === "fit"; });
    var nos = cur.order.filter(function (id) { return (cur.partA[id] || {}).verdict === "nofit"; });
    var changed = function (id) { var a = cur.partA[id]; return a.beforeBoard && a.beforeBoard !== a.verdict ? "changed" : ""; };
    return (
      '<div class="spread" style="margin-bottom:18px"><div><p class="muted small" style="margin:0">Part A · Review</p><h1>Here\'s how you sorted them</h1>' +
      '<p class="muted" style="margin:0">Looking at them side by side, would you move any? Tap a bottle to move it to the other side.</p></div></div>' +
      '<div class="board">' +
        '<div class="col fit"><h2>Fit <span class="small">' + fits.length + "</span></h2><div class=\"thumbs\">" + fits.map(function (id) { return thumb(id, changed(id)); }).join("") + "</div></div>" +
        '<div class="col nofit"><h2>No Fit <span class="small">' + nos.length + "</span></h2><div class=\"thumbs\">" + nos.map(function (id) { return thumb(id, changed(id)); }).join("") + "</div></div>" +
      "</div>" +
      '<details class="mod" style="margin-top:18px"' + (cur.boardNote ? " open" : "") + "><summary>Moderator notes on the overall sort <span class=\"mod-tag\">not for participant</span></summary>" +
        textarea("boardNote", "Patterns they noticed, what separates the two piles in their words…") +
      "</details>" +
      '<div class="nav-row"><button class="btn" data-action="backToA">← Back to last concept</button>' +
      '<button class="btn primary" data-action="toIntroB">Continue to Part B →</button></div>'
    );
  };

  VIEWS.introB = function () {
    return (
      '<div class="card center" style="max-width:720px;margin:40px auto;padding:40px">' +
        '<p class="muted small">Part B · How it works</p>' +
        "<h1>Show us how you'd use it</h1>" +
        "<p>We'll go through the bottles again. For each one, show us how you'd hold it and spray it. Then we'll show you how it's actually meant to work.</p>" +
        '<p class="muted small">Moderator: let them act it out with the printed board before you tap “Reveal”.</p>' +
        '<button class="btn primary lg" data-action="beginB">Begin Part B</button>' +
      "</div>"
    );
  };

  VIEWS.partB = function () {
    var i = cur.idx, id = cur.order[i], c = byId[id];
    var base = "partB." + id;
    var b = cur.partB[id] || {};
    var a = cur.partA[id] || {};
    var ready = b.revealed && b.match;
    return (
      '<div class="eval">' +
        '<div class="stimulus' + (b.revealed ? " revealed" : "") + '">' +
          '<div class="label"><span class="concept-num">' + esc(conceptLabel(c)) + "</span><span>" + (i + 1) + " of " + C.length +
            (a.verdict ? ' · Part A: <b style="color:var(--' + a.verdict + ')">' + (a.verdict === "fit" ? "Fit" : "No Fit") + "</b>" : "") + "</span></div>" +
          '<img src="' + c.hero + '" alt="' + esc(conceptLabel(c)) + '">' +
          (b.revealed ? '<div class="reveal-box"><div class="label"><span><b>How it works</b></span></div><img src="' + c.steps + '" alt="Step-by-step for ' + esc(conceptLabel(c)) + '"></div>' : "") +
        "</div>" +
        '<div class="stack">' +
          '<div class="card stack" style="box-shadow:none">' +
            '<div><h3>1 · “Show me how you\'d hold it and spray it.”</h3><p class="muted small" style="margin:0">Moderator records what they do.</p></div>' +
            '<div><div class="q">What did they try?</div>' + chips(base + ".predicted", O.gestures) + "</div>" +
            '<div><div class="q">How did it go?</div>' + chips(base + ".fluency", ["Smooth, no hesitation", "Some hesitation", "Confused / stuck"], { single: true }) + "</div>" +
            textarea(base + ".demoNote", "Steps, grip, where they looked for the nozzle, points of confusion…") +
            (b.revealed ? "" : '<button class="btn primary" data-action="reveal">Reveal how it works</button>') +
          "</div>" +
          (b.revealed
            ? '<div class="card stack" style="box-shadow:none">' +
                "<h3>2 · After seeing how it works</h3>" +
                '<div><div class="q">Is this what you expected?</div>' + chips(base + ".match", ["Yes", "Partly", "No"], { single: true, rerender: true }) + "</div>" +
                '<div><div class="q">How intuitive does it feel?</div>' + scale(base + ".intuitive", "Not at all", "Very intuitive") + "</div>" +
                '<div><div class="q">How convenient would it be day to day?</div>' + scale(base + ".convenient", "Very inconvenient", "Very convenient") + "</div>" +
                '<div><div class="q">Has this changed whether you\'d leave it out on display?</div>' + chips(base + ".displayShift", ["More likely now", "No change", "Less likely now"], { single: true }) + "</div>" +
                '<label class="field"><span>Comments</span>' + textarea(base + ".note", "What they liked or didn't, in their words") + "</label>" +
              "</div>"
            : "") +
          '<div class="nav-row">' +
            '<button class="btn" data-action="prevB">' + (i === 0 ? "Back to intro" : "← Previous") + "</button>" +
            '<button class="btn primary" data-action="nextB" ' + (ready ? "" : "disabled") + ">" + (i === C.length - 1 ? "Go to ranking →" : "Next →") + "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  };

  VIEWS.rank = function () {
    if (!cur.ranking || cur.ranking.length !== C.length) {
      var fits = cur.order.filter(function (id) { return (cur.partA[id] || {}).verdict === "fit"; });
      var rest = cur.order.filter(function (id) { return fits.indexOf(id) < 0; });
      cur.ranking = fits.concat(rest);
      touch();
    }
    return (
      '<div class="eval">' +
        "<div>" +
          '<p class="muted small" style="margin:0">Ranking</p><h1>Rank them from most to least preferred</h1>' +
          '<p class="muted">Drag the handle, or use the arrows. The list starts with your Fit picks on top.</p>' +
          '<div class="rank-ends"><span>▲ Most preferred</span></div>' +
          '<ol class="rank-list" id="rankList">' + cur.ranking.map(function (id, i) { return rankItem(id, i); }).join("") + "</ol>" +
          '<div class="rank-ends" style="margin-top:6px"><span>▼ Least preferred</span></div>' +
        "</div>" +
        '<div class="stack">' +
          '<div class="card stack" style="box-shadow:none">' +
            "<h3>“What made you put them in this order?”</h3>" +
            '<p class="muted small" style="margin:0">Let them answer in their own words. Don\'t suggest criteria.</p>' +
            textarea("rankWhy", "Their reasons, in their words") +
          "</div>" +
          '<details class="mod"' + ((cur.rankFactors || []).length ? " open" : "") + "><summary>Code the factors they mentioned <span class=\"mod-tag\">not for participant</span></summary>" +
            chips("rankFactors", O.rankFactors) +
          "</details>" +
          '<div class="card stack" style="box-shadow:none">' +
            "<h3>“Would your top pick change where you keep air freshener today?”</h3>" +
            chips("displayImpact", ["Yes, I'd leave it out", "Maybe", "No, it'd still be put away"], { single: true }) +
          "</div>" +
          '<div class="nav-row"><button class="btn" data-action="backToB">← Back to Part B</button>' +
          '<button class="btn primary lg" data-action="finish">Finish session</button></div>' +
        "</div>" +
      "</div>"
    );
  };

  function rankItem(id, i) {
    var c = byId[id], a = cur.partA[id] || {};
    return '<li class="rank-item" data-id="' + id + '">' +
      '<span class="pos">' + (i + 1) + "</span>" +
      '<img src="' + c.hero + '" alt="">' +
      "<span><b>" + esc(conceptLabel(c)) + "</b><br><span class=\"small\" style=\"color:var(--" + (a.verdict || "muted") + ')">' +
        (a.verdict === "fit" ? "Fit" : a.verdict === "nofit" ? "No Fit" : "") + "</span></span>" +
      '<span class="arrows"><button type="button" data-action="up" data-id="' + id + '" aria-label="Move up">↑</button>' +
      '<button type="button" data-action="down" data-id="' + id + '" aria-label="Move down">↓</button>' +
      '<span class="handle" aria-hidden="true">⋮⋮</span></span>' +
    "</li>";
  }

  VIEWS.done = function () {
    var fits = cur.order.filter(function (id) { return (cur.partA[id] || {}).verdict === "fit"; });
    return (
      '<div class="card center" style="max-width:760px;margin:40px auto;padding:40px">' +
        '<div class="done-mark">✓</div>' +
        "<h1>Thank you, " + esc(cur.participant.name) + "!</h1>" +
        '<p class="muted">Responses saved on this device.</p>' +
        '<div class="grid-2" style="text-align:left;margin:24px 0">' +
          '<div><div class="q">Fit (' + fits.length + ")</div><div class=\"thumbs\">" + fits.map(function (id) {
            return '<div class="thumb" style="cursor:default"><span class="n">' + id + '</span><img src="' + byId[id].hero + '" alt=""></div>';
          }).join("") + "</div></div>" +
          '<div><div class="q">Top 3</div><div class="thumbs">' + cur.ranking.slice(0, 3).map(function (id, i) {
            return '<div class="thumb" style="cursor:default"><span class="n">#' + (i + 1) + '</span><img src="' + byId[id].hero + '" alt=""><div class="mv">Concept ' + id + "</div></div>";
          }).join("") + "</div></div>" +
        "</div>" +
        '<div class="row" style="justify-content:center"><button class="btn primary lg" data-action="new">Next participant</button>' +
        '<button class="btn lg" data-action="results">Results &amp; export</button></div>' +
      "</div>"
    );
  };

  /* ------------------------------------------------------------------ results */

  function aggregate() {
    var S = store.sessions;
    return C.map(function (c) {
      var A = S.map(function (s) { return s.partA[c.id]; }).filter(function (a) { return a && a.verdict; });
      var B = S.map(function (s) { return s.partB[c.id]; }).filter(function (b) { return b && b.revealed; });
      var ranks = S.filter(function (s) { return s.status === "complete" && s.ranking.length; })
        .map(function (s) { return s.ranking.indexOf(c.id) + 1; }).filter(function (r) { return r > 0; });
      var fit = A.filter(function (a) { return a.verdict === "fit"; }).length;
      var reasons = [];
      var places = [];
      A.forEach(function (a) { reasons = reasons.concat(a.reasons || []); places = places.concat(a.placeAt || []); });
      var matched = B.filter(function (b) { return b.match; });
      return {
        c: c, n: A.length, fit: fit, fitRate: A.length ? fit / A.length : null,
        avgRank: avg(ranks), nRank: ranks.length,
        firsts: ranks.filter(function (r) { return r === 1; }).length,
        match: matched.length ? matched.filter(function (b) { return b.match === "Yes"; }).length / matched.length : null,
        intuitive: avg(B.map(function (b) { return b.intuitive; })),
        convenient: avg(B.map(function (b) { return b.convenient; })),
        confused: B.length ? B.filter(function (b) { return b.fluency === "Confused / stuck"; }).length / B.length : null,
        ms: avg(A.map(function (a) { return a.ms; })),
        reasons: counts(reasons).slice(0, 3),
        places: counts(places).slice(0, 2),
        revised: A.filter(function (a) { return a.beforeBoard && a.beforeBoard !== a.verdict; }).length
      };
    });
  }

  VIEWS.results = function () {
    var rows = aggregate();
    var S = store.sessions;
    var complete = S.filter(function (s) { return s.status === "complete"; }).length;
    var withData = rows.filter(function (r) { return r.n; });
    var bestFit = withData.slice().sort(function (a, b) { return b.fitRate - a.fitRate; })[0];
    var bestRank = rows.filter(function (r) { return r.avgRank != null; }).sort(function (a, b) { return a.avgRank - b.avgRank; })[0];

    var levels = ["Fully concealed", "Partially concealed", "Not concealed"];
    var groups = levels.map(function (lv) {
      var rs = rows.filter(function (r) { return r.c.concealment === lv; });
      var n = rs.reduce(function (a, r) { return a + r.n; }, 0);
      var f = rs.reduce(function (a, r) { return a + r.fit; }, 0);
      return { lv: lv, k: rs.length, n: n, rate: n ? f / n : null, rank: avg(rs.map(function (r) { return r.avgRank; })),
        intuitive: avg(rs.map(function (r) { return r.intuitive; })), match: avg(rs.map(function (r) { return r.match; })) };
    });

    var sorted = rows.slice().sort(function (a, b) {
      var va = sortVal(a), vb = sortVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
    });

    function th(key, label, num) {
      var arrow = sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : "";
      return '<th class="' + (num ? "num" : "") + '"><button class="btn ghost small" style="min-height:0;padding:0;text-transform:inherit;letter-spacing:inherit;font-size:inherit" data-action="sort" data-key="' + key + '">' + label + arrow + "</button></th>";
    }

    return (
      '<div class="spread" style="margin-bottom:20px"><div><p class="muted small" style="margin:0">Activity 2 · All participants on this device</p><h1>Results</h1></div>' +
      '<div class="row no-print">' +
        '<button class="btn primary" data-action="csv" ' + (S.length ? "" : "disabled") + ">Export CSV</button>" +
        '<button class="btn" data-action="json" ' + (S.length ? "" : "disabled") + ">Export JSON</button>" +
        '<label class="btn" style="display:inline-flex;align-items:center">Import JSON<input type="file" accept="application/json,.json" id="importFile" hidden></label>' +
      "</div></div>" +

      '<div class="kpis" style="margin-bottom:20px">' +
        '<div class="kpi"><b>' + S.length + "</b><span>participants (" + complete + " complete)</span></div>" +
        '<div class="kpi"><b>' + (bestFit ? "#" + bestFit.c.id : "—") + "</b><span>highest Fit rate" + (bestFit ? " · " + pct(bestFit.fitRate) : "") + "</span></div>" +
        '<div class="kpi"><b>' + (bestRank ? "#" + bestRank.c.id : "—") + "</b><span>best average rank" + (bestRank ? " · " + fmt(bestRank.avgRank) : "") + "</span></div>" +
        '<div class="kpi"><b>' + pct(groups[0].rate) + " vs " + pct(groups[2].rate) + "</b><span>Fit rate: fully concealed vs not concealed</span></div>" +
      "</div>" +

      '<section class="card" style="margin-bottom:20px"><h2>By concealment level</h2>' +
        '<p class="muted small">Checks the assumption that hiding the mechanism makes the product feel more display-worthy, provided it stays intuitive.</p>' +
        '<div class="table-wrap"><table><thead><tr><th>Level</th><th class="num">Concepts</th><th>Fit rate</th><th class="num">Avg rank</th><th class="num">Matched expectations</th><th class="num">Intuitive (1–5)</th></tr></thead><tbody>' +
        groups.map(function (g) {
          return "<tr><td><b>" + g.lv + '</b></td><td class="num">' + g.k + '</td><td><div class="bar-cell"><div class="bar"><i style="width:' + Math.round((g.rate || 0) * 100) + '%"></i></div>' + pct(g.rate) + '</div></td><td class="num">' + fmt(g.rank) + '</td><td class="num">' + pct(g.match) + '</td><td class="num">' + fmt(g.intuitive) + "</td></tr>";
        }).join("") + "</tbody></table></div></section>" +

      '<section class="card" style="margin-bottom:20px"><h2>By concept</h2>' +
        '<div class="table-wrap"><table><thead><tr>' +
          th("id", "#", false) + "<th>Concept</th>" + th("fitRate", "Fit rate", false) + th("avgRank", "Avg rank", true) + th("firsts", "#1 picks", true) +
          th("match", "Matched", true) + th("intuitive", "Intuitive", true) + th("convenient", "Convenient", true) + th("confused", "Got stuck", true) +
          th("ms", "Decide (s)", true) + "<th>Top reasons</th><th>Would put it</th>" +
        "</tr></thead><tbody>" +
        sorted.map(function (r) {
          return "<tr>" +
            '<td><b>' + r.c.id + "</b></td>" +
            '<td class="concept-cell"><div class="row" style="flex-wrap:nowrap"><img class="mini-thumb" src="' + r.c.hero + '" alt=""><div><b>' + esc(r.c.name) + '</b><br><span class="muted small">' + esc(r.c.concealment) + "</span></div></div></td>" +
            '<td><div class="bar-cell"><div class="bar"><i style="width:' + Math.round((r.fitRate || 0) * 100) + '%"></i></div><span>' + pct(r.fitRate) + ' <span class="muted small">' + r.fit + "/" + r.n + (r.revised ? " · " + r.revised + " moved" : "") + "</span></span></div></td>" +
            '<td class="num">' + fmt(r.avgRank) + '</td><td class="num">' + r.firsts + '</td><td class="num">' + pct(r.match) + '</td><td class="num">' + fmt(r.intuitive) +
            '</td><td class="num">' + fmt(r.convenient) + '</td><td class="num">' + pct(r.confused) + '</td><td class="num">' + (r.ms == null ? "—" : (r.ms / 1000).toFixed(1)) + "</td>" +
            "<td>" + r.reasons.map(function (x) { return '<span class="tag">' + esc(x[0]) + " ×" + x[1] + "</span>"; }).join("") + "</td>" +
            "<td>" + r.places.map(function (x) { return '<span class="tag">' + esc(x[0]) + " ×" + x[1] + "</span>"; }).join("") + "</td>" +
          "</tr>";
        }).join("") + "</tbody></table></div>" +
        '<p class="muted small" style="margin-top:10px">Avg rank uses completed sessions only (1 = most preferred). “Decide” is seconds from seeing the concept to the first Fit / No Fit tap.</p>' +
      "</section>" +

      '<section class="card" style="margin-bottom:20px"><h2>Participants</h2>' +
        (S.length ? '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Date</th><th>Moderator</th><th>Status</th><th class="num">Fit</th><th>Top pick</th><th></th></tr></thead><tbody>' +
          S.slice().reverse().map(function (s) {
            var fits = Object.keys(s.partA).filter(function (k) { return s.partA[k].verdict === "fit"; }).length;
            return "<tr><td><b>" + esc(s.participant.pid) + "</b></td><td>" + esc(s.participant.name) + "</td><td>" + dateStr(s.createdAt) + "</td><td>" + esc(s.participant.moderator) +
              '</td><td><span class="pill ' + (s.status === "complete" ? "complete" : "progress") + '">' + (s.status === "complete" ? "Complete" : "In progress") + "</span></td>" +
              '<td class="num">' + fits + "/" + C.length + "</td><td>" + (s.status === "complete" && s.ranking.length ? "Concept " + s.ranking[0] : "—") + "</td>" +
              '<td class="num"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap">' +
                '<button class="btn" data-action="resume" data-id="' + esc(s.id) + '">' + (s.status === "complete" ? "Open" : "Resume") + "</button>" +
                '<button class="btn danger ' + (armedDelete === s.id ? "armed" : "") + '" data-action="delete" data-id="' + esc(s.id) + '">' + (armedDelete === s.id ? "Confirm delete" : "Delete") + "</button>" +
              "</div></td></tr>";
          }).join("") + "</tbody></table></div>" : '<p class="muted">No sessions yet.</p>') +
      "</section>" +

      '<section class="card no-print"><h2>Settings</h2>' +
        '<div class="stack">' +
          '<div class="spread"><div><b>Randomize concept order</b><br><span class="muted small">Each new participant sees the 11 concepts in a different order, to reduce order effects. The order is saved with their responses.</span></div>' +
            '<button class="btn" data-action="setting" data-key="randomize">' + (store.settings.randomize ? "On" : "Off") + "</button></div>" +
          '<div class="spread"><div><b>Show concept names on screen</b><br><span class="muted small">Off by default, so labels like “Fully concealed” don\'t steer participants.</span></div>' +
            '<button class="btn" data-action="setting" data-key="showNames">' + (store.settings.showNames ? "On" : "Off") + "</button></div>" +
        "</div>" +
      "</section>"
    );
  };

  function sortVal(r) {
    return sortKey === "id" ? r.c.id : r[sortKey];
  }

  /* ------------------------------------------------------------------ export */

  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function csvCell(v) {
    if (v == null) return "";
    if (Array.isArray(v)) v = v.join("; ");
    v = String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function toCSV() {
    var head = [
      "session_id", "participant_id", "name", "moderator", "notetaker", "date", "status",
      "home_type", "household", "current_products", "current_storage", "session_notes",
      "concept_id", "concept_name", "concealment", "family", "order_position",
      "A_verdict", "A_first_verdict", "A_verdict_before_board", "A_moved_on_board", "A_decision_seconds",
      "A_reasons", "A_would_put_it", "A_would_use_it", "A_mentioned_mechanism", "A_note",
      "B_predicted_gestures", "B_fluency", "B_demo_note", "B_matched_expectation",
      "B_intuitive_1to5", "B_convenient_1to5", "B_display_shift", "B_note",
      "rank", "rank_reasons", "rank_factors_coded", "top_pick_display_impact", "board_note"
    ];
    var lines = [head.join(",")];
    store.sessions.forEach(function (s) {
      var p = s.participant;
      C.forEach(function (c) {
        var a = s.partA[c.id] || {}, b = s.partB[c.id] || {};
        var r = s.ranking.indexOf(c.id);
        lines.push([
          s.id, p.pid, p.name, p.moderator, p.notetaker, s.createdAt, s.status,
          p.homeType, p.household, p.products, p.storage, p.notes,
          c.id, c.name, c.concealment, c.family, s.order.indexOf(c.id) + 1,
          a.verdict === "fit" ? "Fit" : a.verdict === "nofit" ? "No Fit" : "",
          a.first === "fit" ? "Fit" : a.first === "nofit" ? "No Fit" : "",
          a.beforeBoard === "fit" ? "Fit" : a.beforeBoard === "nofit" ? "No Fit" : "",
          a.beforeBoard ? (a.beforeBoard !== a.verdict ? "yes" : "no") : "",
          a.ms != null ? (a.ms / 1000).toFixed(1) : "",
          a.reasons, a.placeAt, a.useAt, a.mentionedMechanism, a.note,
          b.predicted, b.fluency, b.demoNote, b.match, b.intuitive, b.convenient, b.displayShift, b.note,
          s.status === "complete" && r > -1 ? r + 1 : "", s.rankWhy, s.rankFactors, s.displayImpact, s.boardNote
        ].map(csvCell).join(","));
      });
    });
    return "﻿" + lines.join("\r\n");
  }

  function stamp() { return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"); }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(reader.result);
        var incoming = Array.isArray(d) ? d : d.sessions;
        if (!Array.isArray(incoming)) throw new Error("No sessions found");
        var added = 0, updated = 0;
        incoming.forEach(function (s) {
          if (!s || !s.id || !s.participant) return;
          var i = store.sessions.findIndex(function (x) { return x.id === s.id; });
          if (i < 0) { store.sessions.push(s); added++; }
          else if ((s.updatedAt || "") > (store.sessions[i].updatedAt || "")) { store.sessions[i] = s; updated++; }
        });
        store.sessions.sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
        save();
        render();
        flash("Imported " + added + " new, updated " + updated + ".");
      } catch (e) {
        flash("Couldn't read that file: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  function flash(msg) {
    bannerEl.hidden = false;
    bannerEl.textContent = msg;
    setTimeout(updateBanner, 4000);
  }

  /* ------------------------------------------------------------------ ranking drag */

  function bindRanking() {
    var list = document.getElementById("rankList");
    if (!list) return;
    var dragEl = null;

    list.addEventListener("pointerdown", function (e) {
      var h = e.target.closest(".handle, img, .pos");
      var item = e.target.closest(".rank-item");
      if (!h || !item) return;
      e.preventDefault();
      dragEl = item;
      dragEl.classList.add("dragging");
      list.setPointerCapture(e.pointerId);
    });
    list.addEventListener("pointermove", function (e) {
      if (!dragEl) return;
      var items = Array.prototype.slice.call(list.children);
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it === dragEl) continue;
        var r = it.getBoundingClientRect();
        if (e.clientY > r.top && e.clientY < r.bottom) {
          var after = e.clientY > r.top + r.height / 2;
          var idxDrag = items.indexOf(dragEl), idxIt = i;
          if (idxDrag < idxIt && after) list.insertBefore(dragEl, it.nextSibling);
          else if (idxDrag > idxIt && !after) list.insertBefore(dragEl, it);
          renumber(list);
          break;
        }
      }
    });
    function end() {
      if (!dragEl) return;
      dragEl.classList.remove("dragging");
      dragEl = null;
      cur.ranking = Array.prototype.map.call(list.children, function (li) { return Number(li.getAttribute("data-id")); });
      touch();
    }
    list.addEventListener("pointerup", end);
    list.addEventListener("pointercancel", end);
  }

  function renumber(list) {
    Array.prototype.forEach.call(list.children, function (li, i) { li.querySelector(".pos").textContent = i + 1; });
  }

  /* ------------------------------------------------------------------ events */

  var ACTIONS = {
    home: function () { cur = null; view = "home"; render(); window.scrollTo(0, 0); },
    exit: function () { cur = null; view = "home"; render(); window.scrollTo(0, 0); },
    results: function () { cur = null; view = "results"; armedDelete = null; render(); window.scrollTo(0, 0); },
    "new": function () { cur = newSession(); go("intake"); },
    resume: function (el) { resume(el.getAttribute("data-id")); },
    startA: function () { if (cur.participant.name.trim()) go("introA"); },
    beginA: function () { go("partA", 0); },

    verdict: function (el) {
      var id = cur.order[cur.idx], v = el.getAttribute("data-val");
      var a = cur.partA[id] || (cur.partA[id] = {});
      if (!a.first) { a.first = v; a.ms = Date.now() - shownAt; }
      if (a.verdict !== v) {
        a.verdict = v;
        var allowed = v === "fit" ? O.fitReasons : O.noFitReasons;
        a.reasons = (a.reasons || []).filter(function (r) { return allowed.indexOf(r) > -1; });
      }
      touch(); render(true);
    },
    prevA: function () { cur.idx === 0 ? go("introA") : go("partA", cur.idx - 1); },
    nextA: function () {
      var a = cur.partA[cur.order[cur.idx]];
      if (!a || !a.verdict) return;
      if (cur.idx < C.length - 1) go("partA", cur.idx + 1);
      else {
        cur.order.forEach(function (id) { var x = cur.partA[id]; if (x && !x.beforeBoard) x.beforeBoard = x.verdict; });
        go("board");
      }
    },
    flip: function (el) {
      var id = Number(el.getAttribute("data-id")), a = cur.partA[id];
      var from = a.verdict;
      a.verdict = from === "fit" ? "nofit" : "fit";
      var allowed = a.verdict === "fit" ? O.fitReasons : O.noFitReasons;
      a.reasons = (a.reasons || []).filter(function (r) { return allowed.indexOf(r) > -1; });
      cur.boardChanges.push({ id: id, from: from, to: a.verdict, at: new Date().toISOString() });
      touch(); render(true);
    },
    backToA: function () { go("partA", C.length - 1); },
    toIntroB: function () { go("introB"); },
    beginB: function () { go("partB", 0); },
    reveal: function () {
      var id = cur.order[cur.idx];
      var b = cur.partB[id] || (cur.partB[id] = {});
      b.revealed = true; b.revealedAt = new Date().toISOString();
      touch(); render(true);
    },
    prevB: function () { cur.idx === 0 ? go("introB") : go("partB", cur.idx - 1); },
    nextB: function () {
      var b = cur.partB[cur.order[cur.idx]] || {};
      if (!b.revealed || !b.match) return;
      cur.idx < C.length - 1 ? go("partB", cur.idx + 1) : go("rank");
    },
    backToB: function () { go("partB", C.length - 1); },
    up: function (el) { moveRank(Number(el.getAttribute("data-id")), -1); },
    down: function (el) { moveRank(Number(el.getAttribute("data-id")), 1); },
    finish: function () {
      cur.status = "complete";
      cur.completedAt = new Date().toISOString();
      go("done");
    },

    toggle: function (el) {
      var path = el.getAttribute("data-path"), v = el.getAttribute("data-val");
      var arr = (getP(path) || []).slice();
      var i = arr.indexOf(v);
      if (i > -1) arr.splice(i, 1); else arr.push(v);
      setP(path, arr);
      el.classList.toggle("on", i < 0);
      el.setAttribute("aria-pressed", String(i < 0));
    },
    pick: function (el) {
      var path = el.getAttribute("data-path"), v = el.getAttribute("data-val");
      var nv = getP(path) === v ? "" : v;
      setP(path, nv);
      if (/\.match$/.test(path) || path === "participant.name") return render(true);
      Array.prototype.forEach.call(el.parentNode.children, function (b) {
        var on = b === el && nv === v;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      });
    },
    scale: function (el) {
      var path = el.getAttribute("data-path"), v = Number(el.getAttribute("data-val"));
      var nv = getP(path) === v ? null : v;
      setP(path, nv);
      Array.prototype.forEach.call(el.parentNode.children, function (b) {
        var on = b === el && nv === v;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      });
    },

    sort: function (el) {
      var k = el.getAttribute("data-key");
      if (sortKey === k) sortDir = -sortDir;
      else { sortKey = k; sortDir = (k === "id" || k === "avgRank" || k === "confused" || k === "ms") ? 1 : -1; }
      render(true);
    },
    csv: function () { download("fitnofit-results-" + stamp() + ".csv", toCSV(), "text/csv;charset=utf-8"); },
    json: function () { download("fitnofit-sessions-" + stamp() + ".json", JSON.stringify({ exportedAt: new Date().toISOString(), sessions: store.sessions }, null, 2), "application/json"); },
    "delete": function (el) {
      var id = el.getAttribute("data-id");
      if (armedDelete !== id) { armedDelete = id; render(true); return; }
      store.sessions = store.sessions.filter(function (s) { return s.id !== id; });
      armedDelete = null; save(); render(true);
    },
    setting: function (el) {
      var k = el.getAttribute("data-key");
      store.settings[k] = !store.settings[k];
      save(); render(true);
    }
  };

  function moveRank(id, d) {
    var r = cur.ranking, i = r.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= r.length) return;
    r[i] = r[j]; r[j] = id;
    touch(); render(true);
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    var fn = ACTIONS[el.getAttribute("data-action")];
    if (!fn) return;
    if (el.getAttribute("data-action") !== "delete" && armedDelete) armedDelete = null;
    e.preventDefault();
    fn(el);
  });

  document.addEventListener("input", function (e) {
    var path = e.target.getAttribute && e.target.getAttribute("data-bind");
    if (!path || !cur) return;
    setP(path, e.target.value);
    if (path === "participant.name") {
      var b = document.getElementById("startA");
      if (b) b.disabled = !e.target.value.trim();
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "importFile" && e.target.files[0]) importJSON(e.target.files[0]);
  });

  document.addEventListener("keydown", function (e) {
    if (view !== "partA" || !cur) return;
    var t = e.target.tagName;
    if (t === "INPUT" || t === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === "f") ACTIONS.verdict({ getAttribute: function () { return "fit"; } });
    else if (k === "n") ACTIONS.verdict({ getAttribute: function () { return "nofit"; } });
    else if (e.key === "ArrowRight") ACTIONS.nextA();
    else if (e.key === "ArrowLeft") ACTIONS.prevA();
  });

  /* ------------------------------------------------------------------ boot */

  load();
  updateBanner();
  // Warm the image cache so concepts appear instantly during sessions.
  C.forEach(function (c) { var i = new Image(); i.src = c.hero; });
  render();
})();
