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
| Part A · Fit / No fit | One concept at a time (pics 1–2 only), shuffled, no names | Fit / No fit, first answer, time to decide, moderator notes |
| Review piles | Both piles side by side; tap a bottle to switch piles | Which concepts moved |
| Part B · One line | All 11 bottles on a line from "Put it away" to "Leave it on display". They start where Part A put them (No fit left, Fit right) and can be dragged anywhere. Bottles push each other aside, so none overlap | Position of each bottle (0–100), the resulting rank (1 = furthest right), their reasons, moderator-coded factors |

Keyboard: in Part A press `F` for Fit, `N` for No fit, and `←` / `→` to move between concepts. In Part B, focus a bottle and use `←` / `→` to move it (hold Shift for bigger steps).

## Data

- Every tap is autosaved in this browser's `localStorage`. Sessions survive a refresh, and an unfinished session can be resumed from the home screen.
- **Results** shows Fit rate, average rank, expectation match, intuitiveness and convenience, broken down by concept and by concealment level.
- **Export CSV** gives one row per participant × concept, ready for Excel or Sheets.
- **Export JSON / Import JSON** lets you merge sessions run on different laptops or iPads into one device.
- Data is stored per browser and per device. Export after each session day.

## Deploy (optional)

- **GitHub Pages:** push this repo, then go to Settings → Pages → Deploy from branch `main` / root.
- **Vercel:** import the repo with no framework preset and no build command.

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
