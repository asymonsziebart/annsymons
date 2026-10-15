/* Angle Quest — Minecraft-style geometry adventure for Angela */
(() => {
  "use strict";

  const STORAGE_KEY = "angle-quest-v1";

  const LEVELS = [
    {
      id: "l1",
      num: "01",
      icon: "⛏️",
      title: "What is an angle?",
      sub: "Vertex, degrees, 90° & 180°",
      achievement: "Spawn Point Found",
      xp: 20,
    },
    {
      id: "l2",
      num: "02",
      icon: "🗡️",
      title: "Name that angle",
      sub: "Acute · Right · Obtuse · Straight",
      achievement: "Angle Identifier",
      xp: 25,
    },
    {
      id: "l3",
      num: "03",
      icon: "⚔️",
      title: "The 3 Big Rules",
      sub: "Crossed swords · Flat ground · Block corner",
      achievement: "Rule Master",
      xp: 30,
    },
    {
      id: "l4",
      num: "04",
      icon: "🧭",
      title: "Which rule?",
      sub: "Pick the right move",
      achievement: "Pathfinder",
      xp: 25,
    },
    {
      id: "l5",
      num: "05",
      icon: "💎",
      title: "Solve for x",
      sub: "Dig out the hidden ore",
      achievement: "Diamonds! (You found x)",
      xp: 40,
    },
    {
      id: "l6",
      num: "06",
      icon: "🏷️",
      title: "Naming angles",
      sub: "Vertex in the middle",
      achievement: "Name Tag Crafted",
      xp: 20,
    },
    {
      id: "boss",
      num: "BOSS",
      icon: "🐉",
      title: "Ender Dragon Quiz",
      sub: "Beat the checklist boss",
      achievement: "Quest Complete!",
      xp: 50,
      boss: true,
    },
  ];

  /** @type {{ name: string, unlocked: number, done: string[], xp: number }} */
  let state = loadState();

  const app = document.getElementById("app");
  const modal = document.getElementById("modal");

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { name: "", unlocked: 0, done: [], xp: 0 };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function confettiBurst() {
    const bits = ["⛏️", "💎", "🟩", "🟨", "⭐", "🏆"];
    for (let i = 0; i < 18; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.textContent = bits[i % bits.length];
      c.style.left = Math.random() * 100 + "vw";
      c.style.animationDuration = 1.6 + Math.random() * 1.8 + "s";
      c.style.fontSize = 18 + Math.random() * 18 + "px";
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4000);
    }
  }

  function showAchievement(name) {
    clear(modal);
    modal.classList.remove("hidden");
    modal.appendChild(
      el(`
      <div class="toast" role="dialog" aria-labelledby="ach-title">
        <div class="trophy">🏆</div>
        <div class="ach">Achievement Unlocked</div>
        <div class="name" id="ach-title">${escapeHtml(name)}</div>
        <button type="button" class="btn green" id="ach-ok">Nice!</button>
      </div>`),
    );
    confettiBurst();
    modal.querySelector("#ach-ok").onclick = () => {
      modal.classList.add("hidden");
      clear(modal);
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function topbar(extra = "") {
    const maxXp = LEVELS.reduce((a, l) => a + l.xp, 0);
    const pct = Math.min(100, Math.round((state.xp / maxXp) * 100));
    return `
      <div class="topbar">
        <div class="who pixel">${escapeHtml(state.name || "Player")}</div>
        <div class="xpwrap">
          <div class="xplabel">XP ${state.xp}/${maxXp}</div>
          <div class="xpbar"><div class="xpfill" style="width:${pct}%"></div></div>
        </div>
        ${extra}
        <button type="button" class="linkbtn" id="to-map">Map</button>
        <a class="linkbtn" href="guide.html" target="_blank" rel="noopener">How-to</a>
      </div>`;
  }

  function bindTopbar() {
    const m = document.getElementById("to-map");
    if (m) m.onclick = () => renderMap();
  }

  /* ---------- TITLE ---------- */
  function renderTitle() {
    clear(app);
    app.appendChild(
      el(`
      <section class="title-screen">
        <div class="floaty" aria-hidden="true">⛏️</div>
        <h1 class="logo">ANGLE QUEST</h1>
        <p class="tagline">Beat geometry like you beat Minecraft</p>
        <div class="panel">
          <p><b>Welcome, player!</b> Learn the rules, dig out <b>x</b>, and defeat the Ender Dragon quiz.</p>
          <label for="player-name"><b>Your name</b></label>
          <input id="player-name" type="text" maxlength="24" placeholder="Angela" value="${escapeHtml(state.name)}" autocomplete="nickname">
          <button type="button" class="btn green" id="start-btn">Start Quest</button>
          <p class="muted" style="margin-top:14px">
            <a href="guide.html">Full how-to guide</a>
            · <a href="parent.html">Grown-ups</a>
          </p>
        </div>
      </section>`),
    );
    const input = app.querySelector("#player-name");
    app.querySelector("#start-btn").onclick = () => {
      const name = (input.value || "Angela").trim().slice(0, 24);
      state.name = name || "Angela";
      saveState();
      renderMap();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") app.querySelector("#start-btn").click();
    });
  }

  /* ---------- MAP ---------- */
  function renderMap() {
    clear(app);
    const cards = LEVELS.map((lv, i) => {
      const locked = i > state.unlocked;
      const done = state.done.includes(lv.id);
      const cls = [
        "card",
        locked ? "locked" : "",
        lv.boss ? "boss" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button type="button" class="${cls}" data-i="${i}" ${locked ? "disabled" : ""}>
          <span class="num">${lv.num}</span>
          <span class="status">${done ? "✅" : locked ? "🔒" : "▶️"}</span>
          <div class="icon">${lv.icon}</div>
          <div class="ctitle">${escapeHtml(lv.title)}</div>
          <div class="csub">${escapeHtml(lv.sub)}</div>
        </button>`;
    }).join("");

    app.appendChild(
      el(`
      <div>
        ${topbar(`<button type="button" class="linkbtn" id="reset-progress">Reset</button>`)}
        <h2 class="map-title">Choose a level</h2>
        <div class="map">${cards}</div>
      </div>`),
    );
    bindTopbar();
    app.querySelector("#reset-progress").onclick = () => {
      if (confirm("Reset all progress for this browser?")) {
        state = { name: state.name, unlocked: 0, done: [], xp: 0 };
        saveState();
        renderMap();
      }
    };
    app.querySelectorAll(".card:not(.locked)").forEach((btn) => {
      btn.onclick = () => openLevel(Number(btn.dataset.i));
    });
  }

  function completeLevel(levelIndex) {
    const lv = LEVELS[levelIndex];
    if (!state.done.includes(lv.id)) {
      state.done.push(lv.id);
      state.xp += lv.xp;
      if (state.unlocked === levelIndex) state.unlocked = levelIndex + 1;
      saveState();
      showAchievement(lv.achievement);
    } else {
      // Already done — still allow advancing unlock if needed
      if (state.unlocked === levelIndex) {
        state.unlocked = levelIndex + 1;
        saveState();
      }
    }
  }

  function openLevel(i) {
    const lv = LEVELS[i];
    if (lv.boss) return renderBoss(i);
    if (lv.id === "l1") return renderLearnQuiz(i, level1Content(), level1Questions());
    if (lv.id === "l2") return renderLearnQuiz(i, level2Content(), level2Questions());
    if (lv.id === "l3") return renderLearnQuiz(i, level3Content(), level3Questions());
    if (lv.id === "l4") return renderLearnQuiz(i, level4Content(), level4Questions());
    if (lv.id === "l5") return renderLearnQuiz(i, level5Content(), level5Questions());
    if (lv.id === "l6") return renderLearnQuiz(i, level6Content(), level6Questions());
  }

  /* ---------- generic learn + quiz ---------- */
  function renderLearnQuiz(levelIndex, learnHtml, questions) {
    const lv = LEVELS[levelIndex];
    let mode = "learn"; // learn | quiz
    let qi = 0;
    let wrongStreak = 0;

    function paint() {
      clear(app);
      if (mode === "learn") {
        app.appendChild(
          el(`
          <div>
            ${topbar()}
            <div class="panel">
              <div class="level-tag">LEVEL ${lv.num}</div>
              <h2>${escapeHtml(lv.title)}</h2>
              ${learnHtml}
              <div class="nav">
                <button type="button" class="btn small" id="back-map">Map</button>
                <button type="button" class="btn green" id="to-quiz">Practice →</button>
              </div>
            </div>
          </div>`),
        );
        bindTopbar();
        app.querySelector("#back-map").onclick = () => renderMap();
        app.querySelector("#to-quiz").onclick = () => {
          mode = "quiz";
          qi = 0;
          wrongStreak = 0;
          paint();
        };
        // Interactive bits inside learn panels
        wireLearnExtras();
        return;
      }

      const q = questions[qi];
      app.appendChild(
        el(`
        <div>
          ${topbar()}
          <div class="panel">
            <div class="qhead">
              <div class="level-tag">LEVEL ${lv.num} · PRACTICE</div>
              <div class="qcount">${qi + 1} / ${questions.length}</div>
            </div>
            <p class="prompt">${q.prompt}</p>
            ${q.diagram || ""}
            ${q.body || ""}
            <div id="q-area"></div>
            <div id="fb"></div>
            <div class="nav">
              <button type="button" class="btn small" id="back-learn">← Lesson</button>
            </div>
          </div>
        </div>`),
      );
      bindTopbar();
      app.querySelector("#back-learn").onclick = () => {
        mode = "learn";
        paint();
      };
      mountQuestion(q, app.querySelector("#q-area"), app.querySelector("#fb"), {
        onCorrect() {
          wrongStreak = 0;
          setTimeout(() => {
            qi += 1;
            if (qi >= questions.length) {
              completeLevel(levelIndex);
              setTimeout(() => renderMap(), 400);
            } else {
              paint();
            }
          }, 700);
        },
        onWrong() {
          wrongStreak += 1;
        },
        wrongStreak: () => wrongStreak,
      });
    }

    paint();
  }

  function wireLearnExtras() {
    const slider = app.querySelector("#angle-slider");
    if (slider) {
      const update = () => {
        const deg = Number(slider.value);
        const tag = app.querySelector("#angle-tag");
        const degEl = app.querySelector("#angle-deg");
        const ray = app.querySelector("#move-ray");
        if (degEl) degEl.textContent = deg + "°";
        let name = "Acute";
        let color = "#2e7d32";
        if (deg === 90) {
          name = "Right";
          color = "#1565c0";
        } else if (deg === 180) {
          name = "Straight";
          color = "#6d4c41";
        } else if (deg > 90) {
          name = "Obtuse";
          color = "#e65100";
        }
        if (tag) {
          tag.textContent = name;
          tag.style.background = color;
        }
        if (ray) {
          const rad = (deg * Math.PI) / 180;
          const x = 80 + Math.cos(rad) * 110;
          const y = 140 - Math.sin(rad) * 110;
          ray.setAttribute("x2", String(x));
          ray.setAttribute("y2", String(y));
        }
      };
      slider.addEventListener("input", update);
      update();
    }
  }

  function mountQuestion(q, area, fb, hooks) {
    clear(area);
    clear(fb);

    if (q.type === "choice") {
      const grid = el(`<div class="choices"></div>`);
      q.choices.forEach((c, idx) => {
        const b = el(`<button type="button" class="choice">${escapeHtml(c.label)}</button>`);
        b.onclick = () => {
          if (c.ok) {
            b.classList.add("right");
            grid.querySelectorAll("button").forEach((x) => (x.disabled = true));
            fb.appendChild(
              el(`<div class="fb ok"><div class="head">✅ Correct!</div><div class="explain">${c.explain || q.explain || ""}</div></div>`),
            );
            hooks.onCorrect();
          } else {
            b.classList.add("wrong");
            b.disabled = true;
            hooks.onWrong();
            const streak = hooks.wrongStreak();
            fb.innerHTML = "";
            fb.appendChild(
              el(`<div class="fb hint"><div class="head">Not quite</div><div class="explain">${c.hint || q.hint || "Try another answer."}</div></div>`),
            );
            if (streak >= 2 && q.reveal) {
              fb.appendChild(
                el(`<div class="fb reveal"><div class="head">Reveal</div><div class="explain">${q.reveal}</div></div>`),
              );
            }
          }
        };
        grid.appendChild(b);
      });
      area.appendChild(grid);
      return;
    }

    if (q.type === "number") {
      const row = el(`
        <div class="numrow">
          <span class="xeq">${escapeHtml(q.prefix || "x =")}</span>
          <input type="number" inputmode="numeric" id="num-ans" aria-label="Your answer">
          <button type="button" class="btn green small" id="check-num">Check</button>
        </div>`);
      area.appendChild(row);
      const input = row.querySelector("#num-ans");
      const check = () => {
        const val = Number(input.value);
        if (Number.isNaN(val)) return;
        const ok = q.accepts ? q.accepts(val) : val === q.answer;
        if (ok) {
          input.disabled = true;
          row.querySelector("#check-num").disabled = true;
          fb.appendChild(
            el(`<div class="fb ok"><div class="head">⛏️ Ore found!</div><div class="explain">${q.explain || ""}</div></div>`),
          );
          hooks.onCorrect();
        } else {
          hooks.onWrong();
          fb.innerHTML = "";
          fb.appendChild(
            el(`<div class="fb hint"><div class="head">Keep digging</div><div class="explain">${q.hint || "Check your steps again."}</div></div>`),
          );
          if (hooks.wrongStreak() >= 2 && q.reveal) {
            fb.appendChild(
              el(`<div class="fb reveal"><div class="head">Reveal</div><div class="explain">${q.reveal}</div></div>`),
            );
          }
        }
      };
      row.querySelector("#check-num").onclick = check;
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") check();
      });
    }
  }

  /* ---------- LEVEL CONTENT ---------- */
  function level1Content() {
    return `
      <p>An <b>angle</b> is how wide two lines open up from one point — like opening a chest.</p>
      <p>We measure angles in <b>degrees (°)</b>. The meeting point is the <b>vertex</b> (the spawn point).</p>
      <div class="big-rule">Remember two magic numbers: <b>90°</b> and <b>180°</b></div>
      <svg class="diagram" viewBox="0 0 440 170" aria-hidden="true">
        <rect x="30" y="30" width="100" height="100" fill="#8b5a2b" stroke="#5a3a1a" stroke-width="3"/>
        <rect x="30" y="30" width="100" height="26" fill="#5d9c3a"/>
        <line x1="30" y1="130" x2="30" y2="20" class="ray" stroke="#d32f2f" stroke-width="5"/>
        <line x1="30" y1="130" x2="150" y2="130" class="ray" stroke="#d32f2f" stroke-width="5"/>
        <rect x="30" y="108" width="20" height="20" fill="none" stroke="#fff" stroke-width="3"/>
        <text x="90" y="160" text-anchor="middle" class="lbl" font-size="16" fill="#d32f2f" font-weight="800">90° = block corner</text>
        <line x1="220" y1="90" x2="410" y2="90" class="ray" stroke="#d32f2f" stroke-width="5"/>
        <text x="315" y="70" text-anchor="middle" class="lbl" font-size="16" fill="#d32f2f" font-weight="800">180° = flat ground</text>
      </svg>
      <table class="simple">
        <tr><th>Number</th><th>Minecraft memory</th></tr>
        <tr><td><b>90°</b></td><td>Corner of any block (tiny square box ⬜)</td></tr>
        <tr><td><b>180°</b></td><td>Flat ground, or turning all the way around</td></tr>
      </table>`;
  }

  function level1Questions() {
    return [
      {
        type: "choice",
        prompt: "What do we call the point where two rays meet?",
        choices: [
          { label: "Vertex (spawn point)", ok: true, explain: "Yes — the vertex is where the angle starts." },
          { label: "Degree", ok: false, hint: "Degrees measure size. What’s the meeting point called?" },
          { label: "Block", ok: false, hint: "Blocks help you remember 90°, but the meeting point has another name." },
          { label: "Ore", ok: false, hint: "Ore is for later when we dig out x!" },
        ],
      },
      {
        type: "choice",
        prompt: "A perfect Minecraft block corner measures…",
        choices: [
          { label: "45°", ok: false, hint: "That’s skinnier than a square corner." },
          { label: "90°", ok: true, explain: "Every full block corner is exactly 90°." },
          { label: "180°", ok: false, hint: "180° is flat ground, not a corner." },
          { label: "360°", ok: false, hint: "That’s a full spin." },
        ],
      },
      {
        type: "choice",
        prompt: "Flat ground (a straight line) is how many degrees?",
        choices: [
          { label: "90°", ok: false, hint: "90° is a block corner." },
          { label: "100°", ok: false, hint: "Close idea, but flat means fully straight." },
          { label: "180°", ok: true, explain: "A straight line is a straight angle: 180°." },
          { label: "270°", ok: false, hint: "That’s more than flat." },
        ],
      },
    ];
  }

  function level2Content() {
    return `
      <p>Compare every angle to a <b>block corner (90°)</b>.</p>
      <table class="simple">
        <tr><th>Name</th><th>Size</th><th>Think of…</th></tr>
        <tr><td><b>Acute</b></td><td>&lt; 90°</td><td>Sword tip — sharp & skinny</td></tr>
        <tr><td><b>Right</b></td><td>exactly 90°</td><td>A block (look for ⬜)</td></tr>
        <tr><td><b>Obtuse</b></td><td>between 90° and 180°</td><td>Door swung wide open</td></tr>
        <tr><td><b>Straight</b></td><td>180°</td><td>Flat ground</td></tr>
      </table>
      <div class="slider-box">
        <p><b>Drag to open the chest:</b></p>
        <svg class="diagram" viewBox="0 0 280 170" aria-hidden="true">
          <line x1="80" y1="140" x2="220" y2="140" class="ray"/>
          <line id="move-ray" x1="80" y1="140" x2="190" y2="40" class="ray" stroke="#d32f2f"/>
          <circle cx="80" cy="140" r="6" fill="#5d9c3a"/>
        </svg>
        <input id="angle-slider" type="range" min="10" max="180" step="5" value="50">
        <div class="readout"><span id="angle-deg">50°</span> · <span class="tag" id="angle-tag">Acute</span></div>
      </div>
      <p class="muted">Tip: a paper corner is 90° — hold it up to an angle to compare.</p>`;
  }

  function level2Questions() {
    return [
      {
        type: "choice",
        prompt: "An angle smaller than a block corner is…",
        choices: [
          { label: "Acute", ok: true, explain: "Acute = cute & skinny = less than 90°." },
          { label: "Right", ok: false, hint: "Right means exactly 90°." },
          { label: "Obtuse", ok: false, hint: "Obtuse is wider than 90°." },
          { label: "Straight", ok: false, hint: "Straight is flat 180°." },
        ],
      },
      {
        type: "choice",
        prompt: "You see the tiny square box on a corner. That angle is…",
        choices: [
          { label: "Acute", ok: false, hint: "The box means exactly a block corner." },
          { label: "Right", ok: true, explain: "The square mark means a right angle (90°)." },
          { label: "Obtuse", ok: false, hint: "Obtuse wouldn’t get the square box." },
          { label: "Straight", ok: false, hint: "Straight is a flat line, not a corner box." },
        ],
      },
      {
        type: "choice",
        prompt: "A door opened wider than 90° but not flat is…",
        choices: [
          { label: "Acute", ok: false, hint: "Acute is skinnier than 90°." },
          { label: "Right", ok: false, hint: "Right is exactly 90°." },
          { label: "Obtuse", ok: true, explain: "Obtuse sits between 90° and 180°." },
          { label: "Straight", ok: false, hint: "Straight would be fully flat." },
        ],
      },
      {
        type: "choice",
        prompt: "Classify 135°.",
        choices: [
          { label: "Acute", ok: false, hint: "135 is bigger than 90." },
          { label: "Right", ok: false, hint: "Right is exactly 90." },
          { label: "Obtuse", ok: true, explain: "135° is between 90 and 180." },
          { label: "Straight", ok: false, hint: "Straight is exactly 180." },
        ],
      },
    ];
  }

  function level3Content() {
    return `
      <p>These three rules unlock almost every problem — diamond armor for angles.</p>
      <h3 style="color:var(--grass-dark)">⚔️ Crossed Swords (vertical angles)</h3>
      <p>When two lines make an X, angles <b>across from each other</b> are twins — the same size. Set them equal.</p>
      <svg class="diagram" viewBox="0 0 280 180" aria-hidden="true">
        <line x1="30" y1="20" x2="250" y2="160" class="ray"/>
        <line x1="30" y1="160" x2="250" y2="20" class="ray"/>
        <text x="210" y="95" class="lbl" fill="#1565c0" font-size="18" font-weight="800">A</text>
        <text x="55" y="95" class="lbl" fill="#1565c0" font-size="18" font-weight="800">A</text>
        <text x="130" y="40" class="lbl" fill="#e65100" font-size="18" font-weight="800">B</text>
        <text x="130" y="155" class="lbl" fill="#e65100" font-size="18" font-weight="800">B</text>
      </svg>
      <div class="big-rule">Across the X = SAME</div>
      <h3 style="color:var(--grass-dark)">🟫 Flat Ground (linear pair)</h3>
      <p>Two angles side by side on a straight line add to <b>180°</b>.</p>
      <div class="big-rule">Side by side on a line = ADD TO 180</div>
      <h3 style="color:var(--grass-dark)">🧱 Block Corner (complementary)</h3>
      <p>If a ray splits a corner with the square box, the two pieces add to <b>90°</b>.</p>
      <div class="big-rule">Pieces of a block corner = ADD TO 90</div>
      <p><b>Bonus:</b> piece + piece = whole (crafting). Matching marks ⌒ mean equal angles.</p>`;
  }

  function level3Questions() {
    return [
      {
        type: "choice",
        prompt: "Two lines cross. Angles across the X are…",
        choices: [
          { label: "Equal (vertical)", ok: true, explain: "Crossed-sword twins are the same measure." },
          { label: "Add to 180", ok: false, hint: "That’s for neighbors on a straight line." },
          { label: "Add to 90", ok: false, hint: "That’s for pieces inside a right angle." },
          { label: "Always acute", ok: false, hint: "They can be any matching size." },
        ],
      },
      {
        type: "choice",
        prompt: "Two angles sit side by side on flat ground. What do you do?",
        choices: [
          { label: "Set them equal", ok: false, hint: "Equal is for twins across an X (or matching marks)." },
          { label: "Add them to 180", ok: true, explain: "Linear pair → sum is 180°." },
          { label: "Add them to 90", ok: false, hint: "90 is for a block-corner split." },
          { label: "Multiply by 2", ok: false, hint: "No multiplying here — add to 180." },
        ],
      },
      {
        type: "choice",
        prompt: "A right-angle corner is split into two pieces. Those pieces…",
        choices: [
          { label: "Are always equal", ok: false, hint: "Only if marks say so — otherwise just add to 90." },
          { label: "Add to 180", ok: false, hint: "180 is flat ground." },
          { label: "Add to 90", ok: true, explain: "Complementary pieces fill the block corner." },
          { label: "Add to 360", ok: false, hint: "That’s a full turn around a point." },
        ],
      },
    ];
  }

  function level4Content() {
    return `
      <p>Ask these questions <b>in order</b>:</p>
      <table class="simple">
        <tr><th>#</th><th>Question</th><th>If YES…</th></tr>
        <tr><td>1</td><td>Matching marks?</td><td>Set equal</td></tr>
        <tr><td>2</td><td>Across the X?</td><td>Set equal (crossed swords)</td></tr>
        <tr><td>3</td><td>Side by side on a straight line?</td><td>Add = 180</td></tr>
        <tr><td>4</td><td>Inside a square-box corner?</td><td>Add = 90</td></tr>
        <tr><td>5</td><td>Pieces of a bigger given angle?</td><td>Add pieces = whole</td></tr>
      </table>
      <p><b>Finger trick:</b> if you jump over the middle point, they’re crossed swords (same). If you only step over one ray, they’re flat-ground buddies (add to 180).</p>`;
  }

  function level4Questions() {
    return [
      {
        type: "choice",
        prompt: "Angles across an X with no other clues — which rule?",
        choices: [
          { label: "Crossed swords → equal", ok: true, explain: "Vertical angles are congruent." },
          { label: "Flat ground → 180", ok: false, hint: "Flat ground is side-by-side neighbors." },
          { label: "Block corner → 90", ok: false, hint: "Look for the square box for that." },
          { label: "Guess 45", ok: false, hint: "Pick the rule first!" },
        ],
      },
      {
        type: "choice",
        prompt: "Two angles share a ray and sit on a straight line. Rule?",
        choices: [
          { label: "Equal", ok: false, hint: "Neighbors on a line usually look different sizes." },
          { label: "Add to 180", ok: true, explain: "Linear pair." },
          { label: "Add to 90", ok: false, hint: "Only if there’s a right-angle box." },
          { label: "Subtract from 360", ok: false, hint: "For a straight line, use 180." },
        ],
      },
      {
        type: "choice",
        prompt: "Both angles have the same curved mark ⌒. What first?",
        choices: [
          { label: "Set them equal", ok: true, explain: "Matching marks mean congruent angles." },
          { label: "Add to 180 always", ok: false, hint: "Marks mean equal — don’t assume 180." },
          { label: "Ignore the marks", ok: false, hint: "Marks are a secret code — use them!" },
          { label: "They add to 90", ok: false, hint: "Only with a right-angle box." },
        ],
      },
    ];
  }

  function level5Content() {
    return `
      <p><b>x</b> is hidden ore. An equation is a fair villager trade — whatever you do to one side, do to the other.</p>
      <table class="simple">
        <tr><th>If you see…</th><th>Do the opposite on BOTH sides</th></tr>
        <tr><td>+ 10</td><td>− 10</td></tr>
        <tr><td>− 10</td><td>+ 10</td></tr>
        <tr><td>3x</td><td>÷ 3</td></tr>
        <tr><td>x on both sides</td><td>subtract the smaller x-amount</td></tr>
      </table>
      <div class="ex-title">EXAMPLE · CROSSED SWORDS</div>
      <div class="steps">
        <div class="step"><div class="say">Across the X → equal</div><div class="math">5x + 10 = 3x + 30</div></div>
        <div class="step"><div class="say">Subtract 3x</div><div class="math">2x + 10 = 30</div></div>
        <div class="step"><div class="say">Subtract 10</div><div class="math">2x = 20</div></div>
        <div class="step"><div class="say">Divide by 2</div><div class="math">x = 10  ⛏️</div></div>
      </div>
      <p class="muted">After you find x, plug it back in if the question asks for the angle measure!</p>`;
  }

  function level5Questions() {
    return [
      {
        type: "number",
        prompt: "Vertical angles: 5x + 10 and 3x + 30. Find x.",
        prefix: "x =",
        answer: 10,
        hint: "Set them equal, then get x alone. Subtract 3x first.",
        reveal: "5x + 10 = 3x + 30 → 2x = 20 → x = 10",
        explain: "Both angles are 60°. Twins!",
      },
      {
        type: "number",
        prompt: "Linear pair: (4x + 20) and (2x + 40). Find x.",
        prefix: "x =",
        answer: 20,
        hint: "Add the expressions and set equal to 180.",
        reveal: "6x + 60 = 180 → 6x = 120 → x = 20",
        explain: "Angles are 100° and 80°. 100 + 80 = 180 ✅",
      },
      {
        type: "number",
        prompt: "Right angle split: (2x + 5) and (x + 10). Find x.",
        prefix: "x =",
        answer: 25,
        hint: "Pieces of a block corner add to 90.",
        reveal: "3x + 15 = 90 → 3x = 75 → x = 25",
        explain: "Angles 55° and 35° add to 90°.",
      },
      {
        type: "number",
        prompt: "Solve: 20 = 2x − 30. Find x. (Watch the minus!)",
        prefix: "x =",
        answer: 25,
        hint: "Undo −30 by adding 30 to both sides.",
        reveal: "20 + 30 = 2x → 50 = 2x → x = 25",
        explain: "Adding 30 cancels the −30. Don’t write −30 on the other side.",
      },
    ];
  }

  function level6Content() {
    return `
      <p>Angles get letter names like a player tag.</p>
      <ul>
        <li>The <b>vertex</b> letter always goes in the <b>middle</b>.</li>
        <li>Points S, T, U with vertex T → <b>∠STU</b> or <b>∠UTS</b>.</li>
        <li>Only one angle at T? You can say <b>∠T</b>.</li>
        <li>Number inside? Call it <b>∠4</b>.</li>
      </ul>
      <div class="big-rule">Four names: ∠STU, ∠UTS, ∠T, ∠4</div>
      <p>Sides are rays from the vertex: <b>ray TS</b> and <b>ray TU</b>.</p>`;
  }

  function level6Questions() {
    return [
      {
        type: "choice",
        prompt: "In ∠STU, which letter is the vertex?",
        choices: [
          { label: "S", ok: false, hint: "Vertex sits in the middle of the three letters." },
          { label: "T", ok: true, explain: "Middle letter = spawn point = vertex." },
          { label: "U", ok: false, hint: "U is an endpoint of a side." },
          { label: "All three", ok: false, hint: "Only one vertex per angle." },
        ],
      },
      {
        type: "choice",
        prompt: "Which is another name for ∠STU?",
        choices: [
          { label: "∠TSU", ok: false, hint: "Vertex must stay in the middle." },
          { label: "∠UTS", ok: true, explain: "Same angle — T still in the middle." },
          { label: "∠SUT", ok: false, hint: "That puts U in the middle (wrong vertex)." },
          { label: "∠UST", ok: false, hint: "Middle letter would be S." },
        ],
      },
      {
        type: "choice",
        prompt: "The sides of ∠STU are…",
        choices: [
          { label: "ray ST and ray UT", ok: false, hint: "Sides start at the vertex letter T." },
          { label: "ray TS and ray TU", ok: true, explain: "Both rays start at T." },
          { label: "segment SU only", ok: false, hint: "SU doesn’t include the vertex as an endpoint of both sides." },
          { label: "point S only", ok: false, hint: "Sides are rays, not a single point." },
        ],
      },
    ];
  }

  /* ---------- BOSS ---------- */
  function renderBoss(levelIndex) {
    const bossQs = [
      {
        type: "choice",
        prompt: "Creeper warning: you got x = −26 for vertical angles. What should you do?",
        choices: [
          { label: "Accept it — negatives are fine", ok: false, hint: "Angles (and usually these x values) shouldn’t go negative. Recheck the minus move." },
          { label: "Recheck the sign when moving terms", ok: true, explain: "From 26 = 2x − 26, add 26 → 52 = 2x → x = 26." },
          { label: "Always divide by −1", ok: false, hint: "Fix the algebra step that created the bad sign." },
          { label: "Skip the problem", ok: false, hint: "You can beat this creeper!" },
        ],
      },
      {
        type: "choice",
        prompt: "You found x but the question says “find the angle.” Next?",
        choices: [
          { label: "Stop — x is enough", ok: false, hint: "x is the ore; craft the angle by plugging x back in." },
          { label: "Plug x back into the expression", ok: true, explain: "x is the ore. The angle measure is the diamond." },
          { label: "Add 180 to x", ok: false, hint: "Only if a linear-pair rule says so." },
          { label: "Multiply x by 90", ok: false, hint: "Substitute into the angle expression." },
        ],
      },
      {
        type: "choice",
        prompt: "Checklist: vertical angles — after solving, both measures should…",
        choices: [
          { label: "Add to 90", ok: false, hint: "That’s complementary / block corner." },
          { label: "Match each other", ok: true, explain: "Twins across the X must be the same number." },
          { label: "Add to 180", ok: false, hint: "Neighbors on a line add to 180; twins match." },
          { label: "Be acute", ok: false, hint: "They can be obtuse twins too." },
        ],
      },
      {
        type: "number",
        prompt: "Boss hit: linear pair (x + 35) and 97°. Find x.",
        prefix: "x =",
        answer: 48,
        hint: "(x + 35) + 97 = 180",
        reveal: "x + 132 = 180 → x = 48",
        explain: "Angle is 83°. 83 + 97 = 180 ✅",
      },
      {
        type: "number",
        prompt: "Final blow: vertical 2x + 1 = 53. Find x.",
        prefix: "x =",
        answer: 26,
        hint: "Subtract 1, then divide by 2.",
        reveal: "2x = 52 → x = 26",
        explain: "Quest complete energy!",
      },
    ];

    let qi = 0;
    let hp = bossQs.length;
    let wrongStreak = 0;

    function paint() {
      clear(app);
      const pct = Math.round((hp / bossQs.length) * 100);
      const q = bossQs[qi];
      app.appendChild(
        el(`
        <div>
          ${topbar()}
          <div class="dragon ${hp < bossQs.length ? "hit" : ""}">
            <div class="face">🐉</div>
            <div style="flex:1">
              <div class="hplabel">ENDER DRAGON HP</div>
              <div class="hpbar"><div class="hpfill" style="width:${pct}%"></div></div>
            </div>
          </div>
          <div class="panel">
            <div class="level-tag">BOSS FIGHT</div>
            <div class="qhead">
              <h2 style="margin:0;font-size:15px">Quiz attack!</h2>
              <div class="qcount">${qi + 1} / ${bossQs.length}</div>
            </div>
            <p class="prompt">${q.prompt}</p>
            <div id="q-area"></div>
            <div id="fb"></div>
            <div class="nav">
              <button type="button" class="btn small" id="back-map">Flee to map</button>
            </div>
          </div>
        </div>`),
      );
      bindTopbar();
      app.querySelector("#back-map").onclick = () => renderMap();
      mountQuestion(q, app.querySelector("#q-area"), app.querySelector("#fb"), {
        onCorrect() {
          wrongStreak = 0;
          hp -= 1;
          setTimeout(() => {
            qi += 1;
            if (qi >= bossQs.length) {
              completeLevel(levelIndex);
              setTimeout(() => renderVictory(), 450);
            } else {
              paint();
            }
          }, 750);
        },
        onWrong() {
          wrongStreak += 1;
        },
        wrongStreak: () => wrongStreak,
      });
    }

    paint();
  }

  function renderVictory() {
    clear(app);
    app.appendChild(
      el(`
      <section class="title-screen">
        <div class="floaty">💎</div>
        <h1 class="logo" style="font-size:clamp(26px,7vw,48px)">QUEST COMPLETE!</h1>
        <p class="tagline">Look → Pick the rule → Solve for x → Put x back in</p>
        <div class="panel">
          <p>You did it, <b>${escapeHtml(state.name)}</b>! You’ve got this on homework night. ⛏️</p>
          <button type="button" class="btn green" id="again">Back to map</button>
          <p class="muted" style="margin-top:12px"><a href="guide.html">Re-read the how-to</a></p>
        </div>
      </section>`),
    );
    confettiBurst();
    app.querySelector("#again").onclick = () => renderMap();
  }

  /* boot */
  if (state.name) renderMap();
  else renderTitle();
})();
