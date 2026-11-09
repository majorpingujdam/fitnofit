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
  var showOpen = false;        // home: unfinished sessions list expanded

  var app = document.getElementById("app");
  var progressEl = document.getElementById("progress");
  var rightEl = document.getElementById("topbar-right");
  var bannerEl = document.getElementById("banner");

  var FLOW = [
    { key: "intake", label: "Participant" },
    { key: "introA", label: "Part A · Fit / No Fit", also: ["partA"] },
    { key: "board", label: "Review sort" },
    { key: "introB", label: "Part B · Ranking", also: ["line"] },
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
    if (cur.demo) return;
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

  // Overall session progress: intake + 11 concepts in A + review + line
  function progressFraction() {
    var n = C.length, total = n + 4, i = cur ? cur.idx || 0 : 0;
    var at = { intake: 0, introA: 1, partA: 1 + i, board: 1 + n, introB: 2 + n, line: 3 + n, done: total }[view];
    return at == null ? 0 : at / total;
  }

  function stepLabel() {
    var i = cur ? (cur.idx || 0) + 1 : 0;
    return {
      intake: "Participant", introA: "Part A", partA: "Part A, concept " + i + " of " + C.length,
      board: "Part A, review", introB: "Part B", line: "Part B, ranking", done: "Done"
    }[view] || "";
  }

  function renderChrome() {
    var bar = document.getElementById("progressbar");
    if (cur && view !== "home" && view !== "results") {
      progressEl.textContent = (cur.participant.name ? cur.participant.name + ", " : "") + stepLabel().charAt(0).toLowerCase() + stepLabel().slice(1);
      if (!cur.participant.name) progressEl.textContent = stepLabel();
      if (cur.demo) progressEl.textContent = "Demo, " + stepLabel().charAt(0).toLowerCase() + stepLabel().slice(1) + ". Nothing is saved.";
      rightEl.innerHTML = '<span id="saved">' + (cur.demo ? "" : cur.updatedAt ? "Saved " + timeStr(cur.updatedAt) : "") +
        '</span><button class="link" data-action="exit">Exit</button>';
      bar.hidden = false;
      bar.firstChild.style.width = Math.round(progressFraction() * 100) + "%";
    } else {
      progressEl.textContent = "";
      bar.hidden = true;
      rightEl.innerHTML = view === "results"
        ? '<button class="link" data-action="home">Home</button>'
        : '<button class="link" data-action="results">Results</button>';
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
    hidePeek();
    renderChrome();
    var fn = VIEWS[view] || VIEWS.home;
    app.innerHTML = fn();
    if (keepScroll) window.scrollTo(0, y);
  }

  function newSession(demo) {
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
      partA: {}, boardChanges: [],
      ranking: [], slots: null, rankWhy: "", rankFactors: []
    };
    if (demo) {            // demo: kept in memory only, never saved or counted
      s.demo = true;
      s.participant.pid = "Demo";
      s.participant.name = "Demo";
      return s;
    }
    store.sessions.push(s);
    save();
    return s;
  }

  // Demo jumps straight into an activity with sample answers filled in.
  function startDemo(step) {
    cur = newSession(true);
    if (step !== "partA") {
      cur.order.forEach(function (id, i) {
        var v = Math.random() < 0.5 ? "fit" : "nofit";
        cur.partA[id] = { verdict: v, first: v, beforeBoard: v, ms: 800 + Math.round(Math.random() * 3000) };
      });
    }
    go(step, 0);
  }

  function resume(id) {
    cur = store.sessions.filter(function (s) { return s.id === id; })[0] || null;
    if (!cur) return go("home");
    var step = cur.step || "intake";
    if (step === "partB" || step === "rank") step = "introB";   // sessions saved by the older version
    go(step, cur.idx || 0);
  }

  function verdictLabel(v) { return v === "fit" ? "Fit" : v === "nofit" ? "No fit" : ""; }

  /* ------------------------------------------------------------------ views */

  var VIEWS = {};

  VIEWS.home = function () {
    var open = store.sessions.filter(function (s) { return s.status !== "complete"; });
    var done = store.sessions.length - open.length;
    return (
      '<section class="home">' +
        '<div class="home-top">' +
        "<div>" +
          "<h1>Would you leave it out on display?</h1>" +
          '<p class="lede">Activity 2 for Team Nudge. Participants judge ' + C.length + " spray concepts on looks alone, then rank all of them from most to least favorite.</p>" +
          '<div class="actions"><button class="btn primary" data-action="new">Start a session</button>' +
          '<button class="btn" data-action="results">See results</button></div>' +
          '<div class="demo-row"><span class="grey small">Try a demo, nothing is saved</span>' +
            '<button class="link-pill" data-action="demo" data-step="partA">1. Fit / No fit</button>' +
            '<button class="link-pill" data-action="demo" data-step="board">2. Debrief</button>' +
            '<button class="link-pill" data-action="demo" data-step="line">3. Ranking</button>' +
          "</div>" +
        "</div>" +
          (open.length ? '<aside class="resume-list">' +
            '<button class="resume-toggle" data-action="toggleOpen" aria-expanded="' + showOpen + '">' + (showOpen ? "Hide" : "Show") + " unfinished sessions (" + open.length + ")</button>" +
            (showOpen ? '<div class="resume-rows">' + open.slice().reverse().map(function (s) {
              return '<div class="resume-row"><span>' + esc(s.participant.name || "No name yet") + ' <span class="grey small">' + esc(s.participant.pid) +
                ", " + esc(stepLabelFor(s)) + '</span></span><button class="btn" data-action="resume" data-id="' + esc(s.id) + '">Resume</button></div>';
            }).join("") + "</div>" : "") +
          "</aside>" : "") +
        "</div>" +
        "<div></div>" +
        "<div>" +
          '<div class="shelf" aria-hidden="true">' + C.map(function (c) { return '<img src="' + c.shelf + '" alt="">'; }).join("") + "</div>" +
          '<div class="shelf-meta"><span>' + C.length + " concepts</span><span>" +
            (store.sessions.length ? store.sessions.length + " session" + (store.sessions.length === 1 ? "" : "s") + " on this device, " + done + " finished" : "No sessions yet") +
          "</span></div>" +
        "</div>" +
      "</section>"
    );
  };

  function stepLabelFor(s) {
    var i = (s.idx || 0) + 1;
    return { intake: "at sign-in", introA: "starting Part A", partA: "Part A, " + i + " of " + C.length, board: "reviewing piles",
      introB: "starting Part B", partB: "starting Part B", rank: "starting Part B", line: "ranking" }[s.step] || "in progress";
  }

  VIEWS.intake = function () {
    var p = cur.participant;
    return (
      '<div class="narrow">' +
        "<h1>Who's taking part?</h1>" +
        '<div class="two" style="margin-top:40px">' +
          '<label class="field"><span>Name</span><input type="text" data-bind="participant.name" value="' + esc(p.name) + '" autocomplete="off" autofocus></label>' +
          '<label class="field"><span>Participant ID</span><input type="text" data-bind="participant.pid" value="' + esc(p.pid) + '"></label>' +
        "</div>" +
        '<div class="nav-row"><span class="grey small">' + (store.settings.randomize ? "Concepts will appear in a shuffled order." : "Concepts will appear in order, 1 to " + C.length + ".") + "</span>" +
        '<button class="btn primary" data-action="startA" id="startA" ' + (p.name.trim() ? "" : "disabled") + ">Start Part A</button></div>" +
      "</div>"
    );
  };

  VIEWS.introA = function () {
    return (
      '<div class="narrow">' +
        "<h1>Picture each one in your home.</h1>" +
        '<p class="grey-lede">You\'ll see ' + C.length + " spray bottle ideas, one at a time. For each, decide whether you'd be comfortable leaving it out where people can see it. Go with your first impression.</p>" +
        '<div class="legend"><div><b>Fit</b><span class="grey">I\'d leave this out.</span></div><div><b>No fit</b><span class="grey">I\'d put this away.</span></div></div>' +
        '<button class="btn primary" data-action="beginA">Begin</button>' +
      "</div>"
    );
  };

  VIEWS.partA = function () {
    var i = cur.idx, id = cur.order[i], c = byId[id];
    var base = "partA." + id;
    var a = cur.partA[id] || {};
    return (
      '<div class="eval">' +
        '<div class="stimulus"><img src="' + c.hero + '" alt="' + esc(conceptLabel(c)) + '"><p class="caption">' + esc(conceptLabel(c)) + "</p></div>" +
        '<div class="panel">' +
          "<h2>Would you leave this out on display at home?</h2>" +
          '<div class="verdict">' +
            '<button type="button" class="' + (a.verdict === "fit" ? "on" : "") + '" data-action="verdict" data-val="fit" aria-pressed="' + (a.verdict === "fit") + '">Fit</button>' +
            '<button type="button" class="' + (a.verdict === "nofit" ? "on" : "") + '" data-action="verdict" data-val="nofit" aria-pressed="' + (a.verdict === "nofit") + '">No fit</button>' +
          "</div>" +
          (a.verdict ? "" : '<p class="hint">Keyboard: <kbd>F</kbd> fit, <kbd>N</kbd> no fit</p>') +
          '<details class="mod"' + (a.note || a.mentionedMechanism ? " open" : "") + "><summary>Moderator notes</summary><div>" +
            '<div class="block"><div class="q">Did they mention the nozzle or trigger without being asked?</div>' + chips(base + ".mentionedMechanism", ["Yes", "Only when asked", "No"], { single: true }) + "</div>" +
            '<div class="block">' + textarea(base + ".note", "Quotes and observations") + "</div>" +
          "</div></details>" +
          '<div class="nav-row">' +
            '<button class="link" data-action="prevA">Back</button>' +
            '<button class="btn primary" data-action="nextA" ' + (a.verdict ? "" : "disabled") + ">" + (i === C.length - 1 ? "Review piles" : "Next") + "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  };

  function bottle(id, moved) {
    var c = byId[id], v = (cur.partA[id] || {}).verdict;
    var to = v === "fit" ? "No fit" : "Fit";
    return '<button type="button" class="bottle' + (moved ? " moved" : "") + '" data-action="flip" data-id="' + id + '" aria-label="Move ' + esc(conceptLabel(c)) + " to " + to + '">' +
      '<img src="' + c.shelf + '" alt=""><span class="n">' + (store.settings.showNames ? esc(c.name) : id) + (moved ? ", moved" : "") + "</span>" +
      '<span class="move">' + (v === "fit" ? "Move to No fit →" : "← Move to Fit") + "</span></button>";
  }

  VIEWS.board = function () {
    var fits = cur.order.filter(function (id) { return (cur.partA[id] || {}).verdict === "fit"; });
    var nos = cur.order.filter(function (id) { return (cur.partA[id] || {}).verdict === "nofit"; });
    var moved = function (id) { var a = cur.partA[id]; return a.beforeBoard && a.beforeBoard !== a.verdict; };
    return (
      '<div class="sort-head"><div><h1>Debrief - Your 2 Piles</h1><p class="grey" style="margin-top:12px">Changed your mind? You are able to switch sides by clicking any sketch, and switch it back at any time.</p></div>' +
      '<button class="btn primary" data-action="toIntroB">Continue to Part B</button></div>' +
      '<div class="board">' +
        '<div class="col"><div class="col-head"><h2>Fit</h2><span>' + fits.length + '</span></div><div class="pile">' + fits.map(function (id) { return bottle(id, moved(id)); }).join("") + "</div></div>" +
        '<div class="col"><div class="col-head"><h2>No fit</h2><span>' + nos.length + '</span></div><div class="pile">' + nos.map(function (id) { return bottle(id, moved(id)); }).join("") + "</div></div>" +
      "</div>" +
      '<details class="mod"' + (cur.boardNote ? " open" : "") + "><summary>Moderator notes</summary><div>" +
        textarea("boardNote", "What separates the two piles, in their words") +
      "</div></details>" +
      '<div class="nav-row"><button class="link" data-action="backToA">Back to last concept</button></div>'
    );
  };

  VIEWS.introB = function () {
    return (
      '<div class="narrow">' +
        "<h1>Now rank all eleven.</h1>" +
        '<p class="grey-lede">Tap a bottle, then tap a spot on the line. Your most favorite goes on the left, your least favorite on the right. Tap two placed bottles to swap them.</p>' +
        '<button class="btn primary" data-action="beginB" style="margin-top:40px">Begin Part B</button>' +
      "</div>"
    );
  };

  var picked = null; // id of the bottle currently selected in Part B (not saved)

  function ensureSlots() {
    if (!Array.isArray(cur.slots) || cur.slots.length !== C.length) {
      cur.slots = C.map(function () { return null; });
      touch();
    }
  }

  function syncRanking() {
    cur.ranking = cur.slots.filter(function (id) { return id != null; });
  }

  VIEWS.line = function () {
    ensureSlots();
    var tray = cur.order.filter(function (id) { return cur.slots.indexOf(id) < 0; });
    var placed = C.length - tray.length;
    var pickedInSlot = picked != null && cur.slots.indexOf(picked) > -1;
    return (
      '<div class="line-head"><h1>Rank them from favorite to least favorite.</h1>' +
        '<p class="grey" style="margin-top:12px">' +
          (picked != null ? "Now tap a spot on the line." : tray.length ? "Tap a bottle, then tap a spot on the line." : "All placed. Tap two bottles to swap them.") +
        "</p></div>" +

      '<div class="tray' + (tray.length ? "" : " empty") + (pickedInSlot ? " can-drop" : "") + '"' + (pickedInSlot ? ' data-action="toTray" title="Put it back"' : "") + ">" +
        (tray.length
          ? tray.map(function (id) {
              return '<button type="button" class="tray-bottle' + (picked === id ? " picked" : "") + '" data-action="pickBottle" data-id="' + id + '" data-peek="' + byId[id].hero + '" aria-pressed="' + (picked === id) + '" aria-label="' + esc(conceptLabel(byId[id])) + '">' +
                '<img src="' + byId[id].shelf + '" alt=""><span class="n">' + id + "</span></button>";
            }).join("")
          : '<p class="tray-empty">' + (pickedInSlot ? "Tap here to take it off the line" : "To take a bottle off the line, tap it, then tap here.") + "</p>") +
      "</div>" +

      '<div class="slots' + (picked != null ? " armed" : "") + '">' +
        cur.slots.map(function (id, i) {
          var label = "Spot " + (i + 1) + (id != null ? ", " + conceptLabel(byId[id]) : ", empty");
          return '<button type="button" class="slot' + (id != null ? " filled" : "") + (id != null && picked === id ? " picked" : "") + '" data-action="slot" data-i="' + i + '"' + (id != null ? ' data-peek="' + byId[id].hero + '"' : "") + ' aria-label="' + esc(label) + '">' +
            (id != null ? '<img src="' + byId[id].shelf + '" alt=""><span class="cid">' + id + "</span>" : "") +
            '<span class="pos">' + (i + 1) + "</span></button>";
        }).join("") +
      "</div>" +
      '<div class="line-ends"><span>Most Favorite</span><span>Least Favorite</span></div>' +

      '<div class="line-foot">' +
        '<div class="block"><label class="field"><span>What made you rank them this way?</span>' + textarea("rankWhy", "Their words. Don't suggest criteria.") + "</label></div>" +
        '<details class="mod"' + ((cur.rankFactors || []).length ? " open" : "") + "><summary>Moderator: factors they mentioned</summary><div>" +
          chips("rankFactors", O.rankFactors) +
        "</div></details>" +
        '<div class="nav-row"><button class="link" data-action="toIntroB">Back</button>' +
        '<span style="display:flex;align-items:center;gap:16px">' + (placed < C.length ? '<span class="grey small">' + placed + " of " + C.length + " placed</span>" : "") +
        '<button class="btn primary" data-action="finish" ' + (placed < C.length ? "disabled" : "") + ">Finish session</button></span></div>" +
      "</div>"
    );
  };

  VIEWS.done = function () {
    var fits = cur.order.filter(function (id) { return (cur.partA[id] || {}).verdict === "fit"; }).length;
    return (
      '<div class="narrow">' +
        "<h1>Thank you, " + esc(cur.participant.name) + ".</h1>" +
        '<p class="grey-lede">Everything is saved on this device. ' + fits + " of " + C.length + " went in the Fit pile. Their top three:</p>" +
        '<div class="done-row">' + cur.ranking.slice(0, 3).map(function (id, i) {
          return '<figure><img src="' + byId[id].shelf + '" alt=""><figcaption>' + (i + 1) + ". Concept " + id + "</figcaption></figure>";
        }).join("") + "</div>" +
        '<div class="row" style="display:flex;gap:10px"><button class="btn primary" data-action="new">Start next session</button>' +
        '<button class="btn" data-action="results">See results</button></div>' +
      "</div>"
    );
  };

  /* ------------------------------------------------------------------ results */

  function aggregate() {
    var S = store.sessions;
    var done = S.filter(function (s) { return s.status === "complete" && s.ranking && s.ranking.length; });
    return C.map(function (c) {
      var A = S.map(function (s) { return s.partA[c.id]; }).filter(function (a) { return a && a.verdict; });
      var ranks = done.map(function (s) { return s.ranking.indexOf(c.id) + 1; }).filter(function (r) { return r > 0; });
      var fit = A.filter(function (a) { return a.verdict === "fit"; }).length;
      return {
        c: c, n: A.length, fit: fit, fitRate: A.length ? fit / A.length : null,
        avgRank: avg(ranks), firsts: ranks.filter(function (r) { return r === 1; }).length,
        top3: ranks.filter(function (r) { return r <= 3; }).length,
        moved: A.filter(function (a) { return a.beforeBoard && a.beforeBoard !== a.verdict; }).length
      };
    });
  }

  VIEWS.results = function () {
    var rows = aggregate();
    var S = store.sessions;
    var complete = S.filter(function (s) { return s.status === "complete"; }).length;
    var levels = ["Fully concealed", "Partially concealed", "Not concealed"];
    var groups = levels.map(function (lv) {
      var rs = rows.filter(function (r) { return r.c.concealment === lv; });
      var n = rs.reduce(function (a, r) { return a + r.n; }, 0);
      var f = rs.reduce(function (a, r) { return a + r.fit; }, 0);
      return { lv: lv, k: rs.length, rate: n ? f / n : null, rank: avg(rs.map(function (r) { return r.avgRank; })),
        top3: rs.reduce(function (a, r) { return a + r.top3; }, 0) };
    });
    var ranked = rows.filter(function (r) { return r.avgRank != null; }).sort(function (a, b) { return a.avgRank - b.avgRank; });

    var summary = !S.length
      ? "No sessions yet. Start one from the home screen, or import a JSON export from another device."
      : "<b>" + S.length + " participant" + (S.length === 1 ? "" : "s") + "</b>, " + complete + " finished. " +
        (groups[0].rate != null && groups[2].rate != null
          ? "Fully concealed concepts were put in the Fit pile <b>" + pct(groups[0].rate) + "</b> of the time, against <b>" + pct(groups[2].rate) + "</b> for exposed mechanisms. "
          : "") +
        (ranked.length ? "Best average rank so far: <b>concept " + ranked[0].c.id + "</b>, " + esc(ranked[0].c.name) + "." : "");

    var sorted = rows.slice().sort(function (a, b) {
      var va = sortVal(a), vb = sortVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
    });
    function th(key, label, num) {
      return '<th class="' + (num ? "num" : "") + '"><button class="sort' + (sortKey === key ? " on" : "") + '" data-action="sort" data-key="' + key + '">' + label + (sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : "") + "</button></th>";
    }
    // asScore: show 0–100 (spot on the line) instead of a percentage
    function bar(rate, asScore) {
      var label = rate == null ? "—" : asScore ? String(Math.round(rate * 100)) : pct(rate);
      return '<div class="bar"><span><i style="width:' + Math.round((rate || 0) * 100) + '%"></i></span><em>' + label + "</em></div>";
    }

    return (
      '<div class="results-head"><div><h1>Results</h1><p class="summary">' + summary + "</p></div>" +
        '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn primary" data-action="csv" ' + (S.length ? "" : "disabled") + ">Download CSV</button>" +
          '<button class="btn" data-action="json" ' + (S.length ? "" : "disabled") + ">Download JSON</button>" +
          '<label class="btn" style="display:inline-flex;align-items:center">Import JSON<input type="file" accept="application/json,.json" id="importFile" hidden></label>' +
        "</div></div>" +

      '<div class="section"><h3>By concealment</h3><div class="table-wrap"><table><thead><tr><th>Mechanism</th><th class="num">Concepts</th><th>Fit rate</th><th class="num">Avg rank</th><th class="num">Times in a top 3</th></tr></thead><tbody>' +
        groups.map(function (g) {
          return "<tr><td>" + g.lv + '</td><td class="num">' + g.k + "</td><td>" + bar(g.rate) + '</td><td class="num">' + fmt(g.rank) + '</td><td class="num">' + g.top3 + "</td></tr>";
        }).join("") + "</tbody></table></div></div>" +

      '<div class="section"><h3>By concept</h3><div class="table-wrap"><table><thead><tr>' +
        th("id", "Concept", false) + th("fitRate", "Fit rate", false) + th("avgRank", "Avg rank", true) + th("firsts", "Ranked first", true) + th("top3", "In top 3", true) +
        "</tr></thead><tbody>" +
        sorted.map(function (r) {
          return "<tr>" +
            '<td><div class="c-cell"><img src="' + r.c.shelf + '" alt=""><span>' + r.c.id + ". " + esc(r.c.name) + "<small>" + esc(r.c.concealment) + "</small></span></div></td>" +
            "<td>" + bar(r.fitRate) + '<span class="grey small">' + (r.n ? r.fit + " of " + r.n + (r.moved ? ", " + r.moved + " moved" : "") : "") + "</span></td>" +
            '<td class="num">' + fmt(r.avgRank) + '</td><td class="num">' + r.firsts + '</td><td class="num">' + r.top3 + "</td>" +
          "</tr>";
        }).join("") + "</tbody></table></div>" +
        '<p class="grey small" style="margin-top:12px">Rank 1 is the most favorite. Rankings count finished sessions only.</p></div>' +

      '<div class="section"><h3>Participants</h3>' +
        (S.length ? '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Date</th><th>Status</th><th class="num">Fit</th><th>Top pick</th><th></th></tr></thead><tbody>' +
          S.slice().reverse().map(function (s) {
            var fits = Object.keys(s.partA).filter(function (k) { return s.partA[k].verdict === "fit"; }).length;
            return "<tr><td>" + esc(s.participant.pid) + "</td><td>" + esc(s.participant.name) + "</td><td>" + dateStr(s.createdAt) +
              '</td><td><span class="status ' + (s.status === "complete" ? "complete" : "") + '">' + (s.status === "complete" ? "Finished" : esc(stepLabelFor(s))) + "</span></td>" +
              '<td class="num">' + fits + "</td><td>" + (s.status === "complete" && s.ranking.length ? "Concept " + s.ranking[0] : "") + "</td>" +
              '<td class="num"><div style="display:flex;gap:6px;justify-content:flex-end">' +
                '<button class="btn" data-action="resume" data-id="' + esc(s.id) + '">' + (s.status === "complete" ? "Open" : "Resume") + "</button>" +
                '<button class="btn danger ' + (armedDelete === s.id ? "armed" : "") + '" data-action="delete" data-id="' + esc(s.id) + '">' + (armedDelete === s.id ? "Delete for good" : "Delete") + "</button>" +
              "</div></td></tr>";
          }).join("") + "</tbody></table></div>" : '<p class="empty">Nobody yet.</p>') +
      "</div>" +

      '<div class="section no-print"><h3>Settings</h3>' +
        '<div class="toggle-row"><div>Shuffle concept order<p>Each new participant sees the concepts in a different order. The order is saved with their answers.</p></div>' +
          '<button class="switch ' + (store.settings.randomize ? "on" : "") + '" role="switch" aria-checked="' + !!store.settings.randomize + '" aria-label="Shuffle concept order" data-action="setting" data-key="randomize"></button></div>' +
        '<div class="toggle-row"><div>Show concept names to participants<p>Off by default, so names like “Fully concealed” don\'t steer answers.</p></div>' +
          '<button class="switch ' + (store.settings.showNames ? "on" : "") + '" role="switch" aria-checked="' + !!store.settings.showNames + '" aria-label="Show concept names" data-action="setting" data-key="showNames"></button></div>' +
      "</div>"
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
      "session_id", "participant_id", "name", "date", "status",
      "concept_id", "concept_name", "concealment", "family", "order_position",
      "A_verdict", "A_first_verdict", "A_verdict_before_board", "A_moved_on_board", "A_decision_seconds",
      "A_mentioned_mechanism", "A_note",
      "B_rank", "B_reasons", "B_factors_coded", "board_note"
    ];
    var lines = [head.join(",")];
    store.sessions.forEach(function (s) {
      var p = s.participant;
      C.forEach(function (c) {
        var a = s.partA[c.id] || {};
        var r = (s.ranking || []).indexOf(c.id);
        lines.push([
          s.id, p.pid, p.name, s.createdAt, s.status,
          c.id, c.name, c.concealment, c.family, s.order.indexOf(c.id) + 1,
          a.verdict === "fit" ? "Fit" : a.verdict === "nofit" ? "No Fit" : "",
          a.first === "fit" ? "Fit" : a.first === "nofit" ? "No Fit" : "",
          a.beforeBoard === "fit" ? "Fit" : a.beforeBoard === "nofit" ? "No Fit" : "",
          a.beforeBoard ? (a.beforeBoard !== a.verdict ? "yes" : "no") : "",
          a.ms != null ? (a.ms / 1000).toFixed(1) : "",
          a.mentionedMechanism, a.note,
          s.status === "complete" && r > -1 ? r + 1 : "", s.rankWhy, s.rankFactors, s.boardNote
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

  /* ------------------------------------------------------------------ hover preview */

  // Part B: hovering a sketch with a mouse shows the full concept picture (both bottles).
  var peekEl = null, peekFor = null;

  function showPeek(target) {
    if (!peekEl) {
      peekEl = document.createElement("div");
      peekEl.className = "peek";
      peekEl.setAttribute("aria-hidden", "true");
      peekEl.innerHTML = "<img alt=\"\">";
      document.body.appendChild(peekEl);
    }
    var img = peekEl.firstChild;
    peekFor = target;
    img.onload = function () { if (peekFor === target) placePeek(target); };
    if (img.getAttribute("src") !== target.getAttribute("data-peek")) img.src = target.getAttribute("data-peek");
    peekEl.classList.add("on");
    placePeek(target);
  }

  function placePeek(target) {
    var r = target.getBoundingClientRect(), pw = peekEl.offsetWidth, ph = peekEl.offsetHeight, m = 12;
    var left = Math.max(m, Math.min(window.innerWidth - pw - m, r.left + r.width / 2 - pw / 2));
    var top = r.top - ph - m;
    if (top < 64) top = Math.min(window.innerHeight - ph - m, r.bottom + m);   // not enough room above: show below
    peekEl.style.left = left + "px";
    peekEl.style.top = top + "px";
  }

  function hidePeek() {
    peekFor = null;
    if (peekEl) peekEl.classList.remove("on");
  }

  document.addEventListener("pointerover", function (e) {
    if (e.pointerType !== "mouse") return;
    var t = e.target.closest && e.target.closest("[data-peek]");
    if (t && t !== peekFor) showPeek(t);
  });
  document.addEventListener("pointerout", function (e) {
    var t = e.target.closest && e.target.closest("[data-peek]");
    if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) hidePeek();
  });
  window.addEventListener("scroll", hidePeek, { passive: true });

  /* ------------------------------------------------------------------ events */

  var ACTIONS = {
    home: function () { cur = null; view = "home"; render(); window.scrollTo(0, 0); },
    exit: function () { cur = null; view = "home"; render(); window.scrollTo(0, 0); },
    results: function () { cur = null; view = "results"; armedDelete = null; render(); window.scrollTo(0, 0); },
    "new": function () { cur = newSession(); go("intake"); },
    demo: function (el) { startDemo(el.getAttribute("data-step")); },
    toggleOpen: function () { showOpen = !showOpen; render(true); },
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
    beginB: function () { picked = null; go("line"); },
    pickBottle: function (el) {
      var id = Number(el.getAttribute("data-id"));
      picked = picked === id ? null : id;
      render(true);
    },
    slot: function (el) {
      var i = Number(el.getAttribute("data-i")), occupant = cur.slots[i];
      if (picked == null) {                    // nothing selected: select the bottle in this spot
        if (occupant != null) { picked = occupant; render(true); }
        return;
      }
      if (occupant === picked) { picked = null; render(true); return; }
      var from = cur.slots.indexOf(picked);
      cur.slots[i] = picked;
      if (from > -1) cur.slots[from] = occupant;   // swap (or leave the old spot empty)
      // a bottle bumped from the line by a tray bottle goes back to the tray
      picked = null;
      syncRanking(); touch(); render(true);
    },
    toTray: function () {
      var from = cur.slots.indexOf(picked);
      if (from > -1) cur.slots[from] = null;
      picked = null;
      syncRanking(); touch(); render(true);
    },
    finish: function () {
      if (view === "line" && cur.slots && cur.slots.some(function (x) { return x == null; })) return;
      picked = null;
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
      if (path === "participant.name") return render(true);
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
      else { sortKey = k; sortDir = (k === "id" || k === "avgRank") ? 1 : -1; }
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
    if (view === "line" && e.key === "Escape" && picked != null) { picked = null; render(true); return; }
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
