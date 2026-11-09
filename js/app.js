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

  // Overall session progress: intake + 11 concepts in A + review + 11 in B + ranking
  function progressFraction() {
    var n = C.length, total = 2 * n + 3, i = cur ? cur.idx || 0 : 0;
    var at = { intake: 0, introA: 1, partA: 1 + i, board: 1 + n, introB: 2 + n, partB: 2 + n + i, rank: 2 + 2 * n, done: total }[view];
    return at == null ? 0 : at / total;
  }

  function stepLabel() {
    var i = cur ? (cur.idx || 0) + 1 : 0;
    return {
      intake: "Participant", introA: "Part A", partA: "Part A, concept " + i + " of " + C.length,
      board: "Part A, review", introB: "Part B", partB: "Part B, concept " + i + " of " + C.length,
      rank: "Ranking", done: "Done"
    }[view] || "";
  }

  function renderChrome() {
    var bar = document.getElementById("progressbar");
    if (cur && view !== "home" && view !== "results") {
      progressEl.textContent = (cur.participant.name ? cur.participant.name + ", " : "") + stepLabel().charAt(0).toLowerCase() + stepLabel().slice(1);
      if (!cur.participant.name) progressEl.textContent = stepLabel();
      rightEl.innerHTML = '<span id="saved">' + (cur.updatedAt ? "Saved " + timeStr(cur.updatedAt) : "") +
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

  function verdictLabel(v) { return v === "fit" ? "Fit" : v === "nofit" ? "No fit" : ""; }

  /* ------------------------------------------------------------------ views */

  var VIEWS = {};

  VIEWS.home = function () {
    var open = store.sessions.filter(function (s) { return s.status !== "complete"; });
    var done = store.sessions.length - open.length;
    return (
      '<section class="home">' +
        "<div>" +
          "<h1>Would you leave it out on display?</h1>" +
          '<p class="lede">Activity 2 for Team Nudge. Participants judge ' + C.length + " spray concepts on looks alone, then learn how each one works and rank them.</p>" +
          '<div class="actions"><button class="btn primary" data-action="new">Start a session</button>' +
          '<button class="btn" data-action="results">See results</button></div>' +
          (open.length ? '<div class="resume-list"><h3>Unfinished sessions</h3>' + open.slice().reverse().map(function (s) {
            return '<div class="resume-row"><span>' + esc(s.participant.name || "No name yet") + ' <span class="grey small">' + esc(s.participant.pid) +
              ", " + esc(stepLabelFor(s)) + '</span></span><button class="btn" data-action="resume" data-id="' + esc(s.id) + '">Resume</button></div>';
          }).join("") + "</div>" : "") +
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
      introB: "starting Part B", partB: "Part B, " + i + " of " + C.length, rank: "ranking" }[s.step] || "in progress";
  }

  VIEWS.intake = function () {
    var p = cur.participant;
    return (
      '<div class="narrow">' +
        "<h1>Who's taking part?</h1>" +
        '<p class="grey-lede">Only the name is needed. The rest helps when reading results later.</p>' +
        '<div class="two" style="margin-top:40px">' +
          '<label class="field"><span>Name</span><input type="text" data-bind="participant.name" value="' + esc(p.name) + '" autocomplete="off"></label>' +
          '<label class="field"><span>Participant ID</span><input type="text" data-bind="participant.pid" value="' + esc(p.pid) + '"></label>' +
          '<label class="field"><span>Moderator</span><input type="text" data-bind="participant.moderator" value="' + esc(p.moderator) + '"></label>' +
          '<label class="field"><span>Note-taker</span><input type="text" data-bind="participant.notetaker" value="' + esc(p.notetaker) + '"></label>' +
        "</div>" +
        '<div style="margin-top:48px">' +
          '<div class="block"><div class="q">Home</div>' + chips("participant.homeType", O.homeType, { single: true }) + "</div>" +
          '<div class="block"><div class="q">Lives with</div>' + chips("participant.household", O.household) + "</div>" +
          '<div class="block"><div class="q">Scent products they use now</div>' + chips("participant.products", O.products) + "</div>" +
          '<div class="block"><div class="q">Where their air freshener lives today</div>' + chips("participant.storage", O.storage, { single: true }) + "</div>" +
          '<div class="block"><label class="field"><span>Notes</span>' + textarea("participant.notes", "") + "</label></div>" +
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
    var reasons = a.verdict === "fit" ? O.fitReasons : a.verdict === "nofit" ? O.noFitReasons : null;
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
          (reasons
            ? '<div class="reveal" style="margin-top:36px">' +
                '<div class="block"><div class="q">What made you decide?</div>' + chips(base + ".reasons", reasons) + "</div>" +
                '<div class="block"><div class="q">Where in your home would you put it?</div>' + chips(base + ".placeAt", O.rooms) + "</div>" +
                '<div class="block"><div class="q">Where would you use it?</div>' + chips(base + ".useAt", O.rooms) + "</div>" +
              "</div>"
            : "") +
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

  function bottle(id, moved, clickable) {
    var c = byId[id];
    var tag = clickable ? "button" : "div";
    return "<" + tag + ' class="bottle' + (moved ? " moved" : "") + '"' + (clickable ? ' type="button" data-action="flip" data-id="' + id + '" aria-label="Move ' + esc(conceptLabel(c)) + ' to the other pile"' : "") + ">" +
      '<img src="' + c.shelf + '" alt=""><span class="n">' + (store.settings.showNames ? esc(c.name) : id) + (moved ? ", moved" : "") + "</span></" + tag + ">";
  }

  VIEWS.board = function () {
    var fits = cur.order.filter(function (id) { return (cur.partA[id] || {}).verdict === "fit"; });
    var nos = cur.order.filter(function (id) { return (cur.partA[id] || {}).verdict === "nofit"; });
    var moved = function (id) { var a = cur.partA[id]; return a.beforeBoard && a.beforeBoard !== a.verdict; };
    return (
      '<div class="sort-head"><div><h1>Your two piles</h1><p class="grey" style="margin-top:12px">Seeing them together, would you move any? Tap a bottle to switch its pile.</p></div>' +
      '<button class="btn primary" data-action="toIntroB">Continue to Part B</button></div>' +
      '<div class="board">' +
        '<div class="col"><div class="col-head"><h2>Fit</h2><span>' + fits.length + '</span></div><div class="pile">' + fits.map(function (id) { return bottle(id, moved(id), true); }).join("") + "</div></div>" +
        '<div class="col"><div class="col-head"><h2>No fit</h2><span>' + nos.length + '</span></div><div class="pile">' + nos.map(function (id) { return bottle(id, moved(id), true); }).join("") + "</div></div>" +
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
        "<h1>Now, how would you use it?</h1>" +
        '<p class="grey-lede">We\'ll go through them again. For each one, show us how you\'d hold it and spray it. Then we\'ll show you how it\'s meant to work.</p>' +
        '<p class="grey small" style="margin:24px 0 40px">Moderator: let them act it out on the printed board before you reveal the steps.</p>' +
        '<button class="btn primary" data-action="beginB">Begin Part B</button>' +
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
          '<img src="' + c.hero + '" alt="' + esc(conceptLabel(c)) + '">' +
          '<p class="caption">' + esc(conceptLabel(c)) + (a.verdict ? ". Part A: " + verdictLabel(a.verdict) : "") + "</p>" +
          (b.revealed ? '<div class="how reveal"><h3>How it works</h3><img src="' + c.steps + '" alt="Steps for ' + esc(conceptLabel(c)) + '"></div>' : "") +
        "</div>" +
        '<div class="panel">' +
          "<h2>Show me how you'd hold it and spray it.</h2>" +
          '<div class="block"><div class="q">What they tried</div>' + chips(base + ".predicted", O.gestures) + "</div>" +
          '<div class="block"><div class="q">How it went</div>' + chips(base + ".fluency", ["Smoothly", "Some hesitation", "Got stuck"], { single: true }) + "</div>" +
          '<div class="block">' + textarea(base + ".demoNote", "Grip, steps, where they looked for the nozzle") + "</div>" +
          (b.revealed ? "" : '<div class="block"><button class="btn primary" data-action="reveal">Reveal how it works</button></div>') +
          (b.revealed
            ? '<div class="reveal" style="margin-top:48px">' +
                '<div class="block"><div class="q">Is this what you expected?</div>' + chips(base + ".match", ["Yes", "Partly", "No"], { single: true }) + "</div>" +
                '<div class="block"><div class="q">How intuitive is it?</div>' + scale(base + ".intuitive", "Not at all", "Very") + "</div>" +
                '<div class="block"><div class="q">How convenient would it be every day?</div>' + scale(base + ".convenient", "Not at all", "Very") + "</div>" +
                '<div class="block"><div class="q">Would you be more or less likely to leave it out now?</div>' + chips(base + ".displayShift", ["More likely", "No change", "Less likely"], { single: true }) + "</div>" +
                '<div class="block"><label class="field"><span>Comments</span>' + textarea(base + ".note", "") + "</label></div>" +
              "</div>"
            : "") +
          '<div class="nav-row">' +
            '<button class="link" data-action="prevB">Back</button>' +
            '<button class="btn primary" data-action="nextB" ' + (ready ? "" : "disabled") + ">" + (i === C.length - 1 ? "Go to ranking" : "Next") + "</button>" +
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
      '<div class="rank-wrap">' +
        "<div>" +
          "<h1>Put them in order.</h1>" +
          '<p class="grey" style="margin-top:12px">Favorite at the top. Drag a bottle, or use the arrows. Your Fit pile starts on top.</p>' +
          '<ol class="rank-list" id="rankList">' + cur.ranking.map(function (id, i) { return rankItem(id, i); }).join("") + "</ol>" +
          '<div class="rank-ends"><span>Most preferred at the top</span><span>Least preferred at the bottom</span></div>' +
        "</div>" +
        '<div class="panel">' +
          '<div class="block"><label class="field"><span>What made you put them in this order?</span>' + textarea("rankWhy", "Their words. Don't suggest criteria.") + "</label></div>" +
          '<div class="block"><div class="q">Would your top pick change where you keep air freshener?</div>' +
            chips("displayImpact", ["Yes, I'd leave it out", "Maybe", "No"], { single: true }) + "</div>" +
          '<details class="mod"' + ((cur.rankFactors || []).length ? " open" : "") + "><summary>Moderator: factors they mentioned</summary><div>" +
            chips("rankFactors", O.rankFactors) +
          "</div></details>" +
          '<div class="nav-row"><button class="link" data-action="backToB">Back</button>' +
          '<button class="btn primary" data-action="finish">Finish session</button></div>' +
        "</div>" +
      "</div>"
    );
  };

  function rankItem(id, i) {
    var c = byId[id], a = cur.partA[id] || {};
    return '<li class="rank-item" data-id="' + id + '">' +
      '<span class="pos">' + (i + 1) + "</span>" +
      '<img src="' + c.shelf + '" alt="" draggable="false">' +
      '<span class="meta"><b>' + esc(store.settings.showNames ? c.name : "Concept " + c.id) + "</b>" + verdictLabel(a.verdict) + "</span>" +
      '<span class="arrows"><button type="button" data-action="up" data-id="' + id + '" aria-label="Move up">↑</button>' +
      '<button type="button" data-action="down" data-id="' + id + '" aria-label="Move down">↓</button>' +
      '<span class="handle" aria-hidden="true">⋮⋮</span></span>' +
    "</li>";
  }

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
    return C.map(function (c) {
      var A = S.map(function (s) { return s.partA[c.id]; }).filter(function (a) { return a && a.verdict; });
      var B = S.map(function (s) { return s.partB[c.id]; }).filter(function (b) { return b && b.revealed; });
      var ranks = S.filter(function (s) { return s.status === "complete" && s.ranking.length; })
        .map(function (s) { return s.ranking.indexOf(c.id) + 1; }).filter(function (r) { return r > 0; });
      var fit = A.filter(function (a) { return a.verdict === "fit"; }).length;
      var reasons = [];
      A.forEach(function (a) { reasons = reasons.concat(a.reasons || []); });
      var places = [];
      A.forEach(function (a) { places = places.concat(a.placeAt || []); });
      var matched = B.filter(function (b) { return b.match; });
      return {
        c: c, n: A.length, fit: fit, fitRate: A.length ? fit / A.length : null,
        avgRank: avg(ranks), firsts: ranks.filter(function (r) { return r === 1; }).length,
        match: matched.length ? matched.filter(function (b) { return b.match === "Yes"; }).length / matched.length : null,
        intuitive: avg(B.map(function (b) { return b.intuitive; })),
        convenient: avg(B.map(function (b) { return b.convenient; })),
        stuck: B.length ? B.filter(function (b) { return b.fluency === "Got stuck" || b.fluency === "Confused / stuck"; }).length / B.length : null,
        reasons: counts(reasons).slice(0, 3), places: counts(places).slice(0, 2),
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
        intuitive: avg(rs.map(function (r) { return r.intuitive; })), match: avg(rs.map(function (r) { return r.match; })) };
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
    function bar(rate) {
      return '<div class="bar"><span><i style="width:' + Math.round((rate || 0) * 100) + '%"></i></span><em>' + pct(rate) + "</em></div>";
    }

    return (
      '<div class="results-head"><div><h1>Results</h1><p class="summary">' + summary + "</p></div>" +
        '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn primary" data-action="csv" ' + (S.length ? "" : "disabled") + ">Download CSV</button>" +
          '<button class="btn" data-action="json" ' + (S.length ? "" : "disabled") + ">Download JSON</button>" +
          '<label class="btn" style="display:inline-flex;align-items:center">Import JSON<input type="file" accept="application/json,.json" id="importFile" hidden></label>' +
        "</div></div>" +

      '<div class="section"><h3>By concealment</h3><div class="table-wrap"><table><thead><tr><th>Mechanism</th><th class="num">Concepts</th><th>Fit rate</th><th class="num">Avg rank</th><th class="num">As expected</th><th class="num">Intuitive</th></tr></thead><tbody>' +
        groups.map(function (g) {
          return "<tr><td>" + g.lv + '</td><td class="num">' + g.k + "</td><td>" + bar(g.rate) + '</td><td class="num">' + fmt(g.rank) + '</td><td class="num">' + pct(g.match) + '</td><td class="num">' + fmt(g.intuitive) + "</td></tr>";
        }).join("") + "</tbody></table></div></div>" +

      '<div class="section"><h3>By concept</h3><div class="table-wrap"><table><thead><tr>' +
        th("id", "Concept", false) + th("fitRate", "Fit rate", false) + th("avgRank", "Avg rank", true) + th("firsts", "Ranked first", true) +
        th("match", "As expected", true) + th("intuitive", "Intuitive", true) + th("convenient", "Convenient", true) + th("stuck", "Got stuck", true) +
        "<th>Why</th><th>Where it would go</th></tr></thead><tbody>" +
        sorted.map(function (r) {
          return "<tr>" +
            '<td><div class="c-cell"><img src="' + r.c.shelf + '" alt=""><span>' + r.c.id + ". " + esc(r.c.name) + "<small>" + esc(r.c.concealment) + "</small></span></div></td>" +
            "<td>" + bar(r.fitRate) + '<span class="grey small">' + (r.n ? r.fit + " of " + r.n + (r.moved ? ", " + r.moved + " moved" : "") : "") + "</span></td>" +
            '<td class="num">' + fmt(r.avgRank) + '</td><td class="num">' + r.firsts + '</td><td class="num">' + pct(r.match) +
            '</td><td class="num">' + fmt(r.intuitive) + '</td><td class="num">' + fmt(r.convenient) + '</td><td class="num">' + pct(r.stuck) + "</td>" +
            '<td class="reasons">' + r.reasons.map(function (x) { return esc(x[0]) + " (" + x[1] + ")"; }).join(", ") + "</td>" +
            '<td class="reasons">' + r.places.map(function (x) { return esc(x[0]) + " (" + x[1] + ")"; }).join(", ") + "</td>" +
          "</tr>";
        }).join("") + "</tbody></table></div>" +
        '<p class="grey small" style="margin-top:12px">Avg rank counts finished sessions only. 1 is most preferred.</p></div>' +

      '<div class="section"><h3>Participants</h3>' +
        (S.length ? '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Date</th><th>Moderator</th><th>Status</th><th class="num">Fit</th><th>Top pick</th><th></th></tr></thead><tbody>' +
          S.slice().reverse().map(function (s) {
            var fits = Object.keys(s.partA).filter(function (k) { return s.partA[k].verdict === "fit"; }).length;
            return "<tr><td>" + esc(s.participant.pid) + "</td><td>" + esc(s.participant.name) + "</td><td>" + dateStr(s.createdAt) + "</td><td>" + esc(s.participant.moderator) +
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
      else { sortKey = k; sortDir = (k === "id" || k === "avgRank" || k === "stuck") ? 1 : -1; }
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
