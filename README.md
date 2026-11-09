# Fit / No Fit — Team Nudge CSV2, Activity 2

A small web app for running and recording **Activity 2: Dispensing Mechanism Exploration**. Plain HTML, CSS and JS: no build step, no dependencies, and it works offline.

## Run it

- **Quickest:** double-click `index.html` to open it in Chrome or Edge.
- **On an iPad or phone during sessions:** host it (see below), open the link once, and use it from there.
- **Local server (optional):** run `npx serve .` or `python -m http.server` in this folder.

## Session flow

| Step | Participant sees | What gets recorded |
|---|---|---|
| Participant | — | Name (required), ID, moderator, note-taker, home type, household (kids/pets), products they use now, where they keep air freshener today |
| Part A · Fit / No Fit | Pics 1–2 of each concept only, in randomized order, with no names | Fit / No Fit, reasons, where they'd put it, where they'd use it, decision time; moderator notes on whether they mentioned the mechanism unprompted |
| Review sort | Both piles side by side, where they can tap to move any concept | Which concepts were moved, and their verdict before the move |
| Part B · How it works | The concept, then the step-by-step image after the moderator taps **Reveal** | Gestures they tried, how smoothly it went, whether it matched what they expected, intuitive 1–5, convenient 1–5, whether it changed display intent, comments |
| Ranking | All 11, sorted by dragging or with the arrows | Full ranking, their reasons in their own words, moderator-coded factors, whether their top pick would change where they keep air freshener |

Keyboard shortcuts in Part A: `F` = Fit, `N` = No Fit, `→` / `←` = next / previous.

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
