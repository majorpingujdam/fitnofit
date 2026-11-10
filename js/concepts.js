/*
 * Concept boards for CSV2 Activity 2 — Dispensing Mechanism Exploration.
 * hero  = printed "pic 1, 2" (closed + open bottle). Shown in Part A.
 * steps = step-by-step illustration. Only revealed in Part B.
 * Names and concealment levels are hidden from participants by default.
 */
window.CONCEPTS = [
  { id: 1,  name: "Top-Twist Cap Finger Pump",        concealment: "Fully concealed",     family: "Finger pump" },
  { id: 2,  name: "Bottom-Twist Finger Pump",         concealment: "Fully concealed",     family: "Finger pump" },
  { id: 3,  name: "Rotating Window Finger Pump",      concealment: "Partially concealed", family: "Finger pump" },
  { id: 4,  name: "Half-Hidden Trigger Spray",        concealment: "Partially concealed", family: "Trigger" },
  { id: 5,  name: "Flip-Top Spray",                   concealment: "Partially concealed", family: "Top press" },
  { id: 6,  name: "Trigger Spray (Febreze, current)", concealment: "Not concealed",       family: "Trigger" },
  { id: 7,  name: "Top-Twist Finger Pump",            concealment: "Fully concealed",     family: "Finger pump" },
  { id: 8,  name: "Pop-up Trigger Spray",             concealment: "Partially concealed", family: "Trigger" },
  { id: 9,  name: "Slide-up Trigger Spray",           concealment: "Partially concealed", family: "Trigger" },
  { id: 10, name: "Conventional Finger Pump",         concealment: "Not concealed",       family: "Finger pump" },
  { id: 11, name: "Integrated Top-Press Spray",       concealment: "Fully concealed",     family: "Top press" }
].map(function (c) {
  var n = String(c.id).padStart(2, "0");
  c.hero = "images/c" + n + "-hero.jpg";
  c.steps = "images/c" + n + "-steps.jpg";
  c.shelf = "images/c" + n + "-shelf.jpg";
  c.single = "images/c" + n + "-single.jpg"; // one closed bottle (Activity 1 Fit / No fit)
  c.full = "images/c" + n + "-full.jpg";   // whole board: both bottles + how it works (ranking hover preview)
  return c;
});

window.OPTIONS = {
  fitReasons: [
    "Looks like home décor", "Clean / minimal", "Mechanism is hidden", "Looks premium",
    "Matches my style", "Doesn't look like a cleaning product", "Compact / tidy", "Looks easy to use"
  ],
  noFitReasons: [
    "Looks like a cleaning product", "Nozzle / trigger too visible", "Looks cheap or plastic",
    "Unclear what it is", "Too clinical / medical", "Looks like personal care, not home",
    "Doesn't match my style", "Looks hard to use"
  ],
  rooms: [
    "Living room", "Kitchen", "Bathroom", "Bedroom", "Entryway", "Home office",
    "Closet / cabinet (out of sight)", "Car", "Nowhere"
  ],
  gestures: [
    "Press top", "Twist cap / top", "Twist bottom", "Pull trigger", "Flip open lid",
    "Slide / pop out a part", "Remove cap first", "Rotate to align nozzle", "Not sure"
  ],
  rankFactors: [
    "Appearance", "Hides the mechanism", "Intuitive / obvious", "Fewest steps",
    "One-handed use", "Speed to spray", "Feels premium", "Familiar", "Child / pet safety",
    "Spray control / aim", "Durability", "Size / grip"
  ],
  homeType: ["Apartment", "House", "Dorm", "Other"],
  household: ["Lives alone", "Partner / roommates", "Children at home", "Pets at home"],
  products: ["Spray air freshener", "Candles", "Plug-ins", "Reed diffuser", "Electric diffuser", "Fabric spray", "None"],
  storage: ["On display", "In a cabinet", "Under the sink", "In a closet", "Don't own one"]
};
