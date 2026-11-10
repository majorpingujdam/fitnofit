# Fit / No Fit — Team Nudge CSV2, Activity 2

A small web app for running and recording **Activity 2: Dispensing Mechanism Exploration**. Plain HTML, CSS and JS: no build step, no dependencies, and it works offline.

## Run it

- **Quickest:** double-click `index.html` to open it in Chrome or Edge.
- **On an iPad or phone during sessions:** host it (see below), open the link once, and use it from there.
- **Local server (optional):** run `npx serve .` or `python -m http.server` in this folder.

## Session flow

| Step | Participant sees | Recorded |
|---|---|---|
| Participant | Name and participant ID | Name, ID |
| Activity 1 · Fit / No fit | One concept at a time (pics 1–2 only), shuffled, no names | Fit / No fit, first answer, time to decide, moderator notes |
| Activity 1 · Debrief | Both piles side by side; click a sketch (or its Move button) to switch sides | Which concepts moved, and the final pile |
| Activity 2 · Interaction expectations & preferences | One concept at a time. Left: the closed bottle only (nothing that shows how it opens), plus a strip of all 11 to jump between concepts. Right: (1) Show me how you'd pick it up, hold it, and spray it. (2) What makes you think it works that way? Then **Reveal how it works**: left switches to the full step-by-step board (toggle Bottle / How it works) and four probes appear: (3) Does this match what you expected? (4) How intuitive does it feel? (5) How convenient would it be to use? (6) Anything confusing about it? | Whether each concept was revealed, plus a moderator note (steps, gestures, points of confusion) |
| Activity 2 · Ranking | 11 numbered spots, most preferred (1) to least preferred (11). **Drag** a bottle from the tray onto a spot, onto another bottle to swap, or back to the tray to remove (tapping also works). Resting the mouse on a sketch shows the full board | Rank 1–11 per concept, "What influenced your ranking?" (unprompted), moderator-coded factors |

The home page has demo buttons (sample answers filled in, nothing saved).

Keyboard: in Activity 1 press `F` for Fit, `N` for No fit, and `←` / `→` to move between concepts.

## Data

- Every tap is autosaved in this browser's `localStorage`. Sessions survive a refresh, and an unfinished session can be resumed from the home screen.
- **Results** shows Fit rate, average rank, expectation match, intuitiveness and convenience, broken down by concept and by concealment level.
- **Export CSV** gives one row per participant × concept, ready for Excel or Sheets.
- **Export JSON / Import JSON** lets you merge sessions run on different laptops or iPads into one device.
- Data is stored per browser and per device. Export after each session day.

## Deploy (optional)

- **GitHub Pages:** push this repo, then go to Settings → Pages → Deploy from branch `main` / root.
- **Vercel:** import the repo with no framework preset and no build command.

## Updating

`index.html` loads the CSS and JS with a version tag (`?v=11`). After changing code, bump that number so browsers and GitHub Pages load the new files instead of a cached copy.

## Files

```
index.html
css/styles.css
js/concepts.js   ← concept names, concealment levels, answer options (edit here)
js/app.js        ← app logic
images/cNN-hero.jpg   (pics 1–2, shown in Part A)
images/cNN-steps.jpg  (step-by-step, revealed in Part B)
```

To change the concepts or answer chips, edit `js/concepts.js`. To swap an image, replace the file and keep the same name.
