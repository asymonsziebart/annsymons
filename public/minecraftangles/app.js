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
      id: "l7",
      num: "07",
      icon: "⚔️",
      title: "Crossed swords",
      sub: "Vertical angles · find all four",
      achievement: "Twin Angles",
      xp: 35,
    },
    {
      id: "l8",
      num: "08",
      icon: "🟫",
      title: "Flat ground & y",
      sub: "Linear pairs · three angles · find y",
      achievement: "Path Builder",
      xp: 35,
    },
    {
      id: "l9",
      num: "09",
      icon: "🧱",
      title: "Block corner",
      sub: "Pieces that add to 90°",
      achievement: "Corner Crafter",
      xp: 30,
    },
    {
      id: "l10",
      num: "10",
      icon: "🧰",
      title: "Crafting table",
      sub: "Angle Addition Postulate",
      achievement: "Whole From Pieces",
      xp: 35,
    },
    {
      id: "l11",
      num: "11",
      icon: "🎯",
      title: "Congruent angles",
      sub: "Matching marks · ≅ statements",
      achievement: "Same Size Twins",
      xp: 35,
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
      const done = state.done.includes(lv.id);
      const cls = ["card", lv.boss ? "boss" : ""].filter(Boolean).join(" ");
      return `
        <button type="button" class="${cls}" data-i="${i}">
          <span class="num">${lv.num}</span>
          <span class="status">${done ? "✅" : "▶️"}</span>
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
    app.querySelectorAll(".card").forEach((btn) => {
      btn.onclick = () => openLevel(Number(btn.dataset.i));
    });
  }

  function completeLevel(levelIndex) {
    const lv = LEVELS[levelIndex];
    if (!state.done.includes(lv.id)) {
      state.done.push(lv.id);
      state.xp += lv.xp;
      state.unlocked = Math.max(state.unlocked, levelIndex + 1);
      saveState();
      showAchievement(lv.achievement);
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
    if (lv.id === "l7") return renderLearnQuiz(i, level7Content(), level7Questions());
    if (lv.id === "l8") return renderLearnQuiz(i, level8Content(), level8Questions());
    if (lv.id === "l9") return renderLearnQuiz(i, level9Content(), level9Questions());
    if (lv.id === "l10") return renderLearnQuiz(i, level10Content(), level10Questions());
    if (lv.id === "l11") return renderLearnQuiz(i, level11Content(), level11Questions());
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
          const advance = () => {
            qi += 1;
            if (qi >= questions.length) {
              completeLevel(levelIndex);
              setTimeout(() => renderMap(), 400);
            } else {
              paint();
            }
          };
          if (q.type === "equation" || q.type === "number") {
            showNextButton(app.querySelector("#fb"), qi + 1 >= questions.length, advance);
          } else {
            setTimeout(advance, 700);
          }
        },
        onWrong() {
          wrongStreak += 1;
        },
        wrongStreak: () => wrongStreak,
      });
    }

    paint();
  }

  function showNextButton(fb, isLast, advance) {
    const row = el(`
      <div class="next-row">
        <button type="button" class="btn green" id="next-q">${isLast ? "Finish level →" : "Next problem →"}</button>
      </div>`);
    fb.appendChild(row);
    const btn = row.querySelector("#next-q");
    btn.onclick = () => {
      btn.disabled = true;
      advance();
    };
    btn.focus();
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

  function parseSide(raw) {
    const s = String(raw).replace(/−/g, "-").replace(/–/g, "-").replace(/\s+/g, "");
    const terms = [];
    const re = /([+-])?(\d*\.?\d*)(x)?/g;
    let match;
    while ((match = re.exec(s))) {
      if (!match[0]) {
        re.lastIndex += 1;
        continue;
      }
      const hasX = Boolean(match[3]);
      if (!match[2] && !hasX) continue;
      const magnitude = match[2] === "" ? 1 : Number(match[2]);
      terms.push({ variable: hasX, value: (match[1] === "-" ? -1 : 1) * magnitude });
    }
    return terms;
  }

  function termText(term, forceSign) {
    const abs = Math.abs(term.value);
    const body = term.variable ? (abs === 1 ? "x" : `${abs}x`) : String(abs);
    if (!forceSign && term.value >= 0) return body;
    return `${term.value < 0 ? "− " : "+ "}${body}`;
  }

  function termChip(term, forceSign) {
    const cls = [
      "term-chip",
      term.variable ? "x-term" : "constant",
      term.value < 0 ? "negative" : "",
    ].filter(Boolean).join(" ");
    return `<span class="${cls}" data-variable="${term.variable ? 1 : 0}" data-value="${term.value}">${escapeHtml(termText(term, forceSign))}</span>`;
  }

  function sideChips(text) {
    return `<div class="term-row">${parseSide(text).map((term, i) => termChip(term, i > 0)).join("")}</div>`;
  }

  function parseOp(label) {
    const text = String(label).replace(/−/g, "-").replace(/–/g, "-").trim();
    if (/combine/i.test(text)) return { kind: "combine" };
    const division = text.match(/^[÷/]\s*(\d+(?:\.\d+)?)/);
    if (division) return { kind: "divide", by: Number(division[1]) };
    const addition = text.match(/^([+-])\s*(\d+(?:\.\d+)?)(x)?/);
    if (addition) {
      return {
        kind: "both",
        term: {
          variable: Boolean(addition[3]),
          value: (addition[1] === "-" ? -1 : 1) * Number(addition[2]),
        },
      };
    }
    return { kind: "combine" };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function flyClone(source, target) {
    const flyer = source.cloneNode(true);
    const start = source.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    flyer.className = "operation-flyer";
    flyer.style.left = `${start.left}px`;
    flyer.style.top = `${start.top}px`;
    flyer.style.width = `${start.width}px`;
    flyer.style.height = `${start.height}px`;
    document.body.appendChild(flyer);
    const dx = end.left + end.width / 2 - (start.left + start.width / 2);
    const dy = end.top + end.height / 2 - (start.top + start.height / 2);
    return flyer.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 1 },
      ],
      { duration: 680, easing: "cubic-bezier(.16,.84,.22,1)", fill: "forwards" },
    ).finished.then(() => flyer.remove());
  }

  function collapseChips(chips) {
    const rects = chips.map((chip) => chip.getBoundingClientRect());
    const mid = rects.reduce(
      (acc, rect) => ({
        x: acc.x + rect.left + rect.width / 2,
        y: acc.y + rect.top + rect.height / 2,
      }),
      { x: 0, y: 0 },
    );
    mid.x /= rects.length;
    mid.y /= rects.length;
    const sum = chips.reduce((total, chip) => total + Number(chip.dataset.value), 0);
    return Promise.all(chips.map((chip, i) => {
      const rect = rects[i];
      chip.classList.add(sum === 0 ? "canceling" : "merging");
      return chip.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          {
            transform: `translate(${mid.x - (rect.left + rect.width / 2)}px, ${mid.y - (rect.top + rect.height / 2)}px) scale(${sum === 0 ? 0.15 : 1.08})`,
            opacity: sum === 0 ? 0 : 1,
          },
        ],
        { duration: 620, easing: "ease-in-out", fill: "forwards" },
      ).finished;
    }));
  }

  async function mergeRow(row) {
    const chips = [...row.querySelectorAll(".term-chip")];
    const groups = [
      chips.filter((chip) => chip.dataset.variable === "1"),
      chips.filter((chip) => chip.dataset.variable === "0"),
    ].filter((group) => group.length > 1);
    await Promise.all(groups.map(collapseChips));
    const totals = { x: 0, n: 0, hasX: false, hasN: false };
    chips.forEach((chip) => {
      const value = Number(chip.dataset.value);
      if (chip.dataset.variable === "1") {
        totals.x += value;
        totals.hasX = true;
      } else {
        totals.n += value;
        totals.hasN = true;
      }
    });
    const combined = [];
    if (totals.hasX && totals.x !== 0) combined.push({ variable: true, value: totals.x });
    if (totals.hasN && totals.n !== 0) combined.push({ variable: false, value: totals.n });
    if (!combined.length) combined.push({ variable: false, value: 0 });
    row.innerHTML = combined.map((term, i) => termChip(term, i > 0)).join("");
    [...row.children].forEach((chip) => chip.classList.add("pop-in"));
  }

  async function divideRow(row, by) {
    const chips = [...row.querySelectorAll(".term-chip")];
    await Promise.all(chips.map((chip) => chip.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(0.62)" },
        { transform: "scale(1)" },
      ],
      { duration: 620, easing: "ease-in-out" },
    ).finished));
    const divided = chips.map((chip) => ({
      variable: chip.dataset.variable === "1",
      value: Number(chip.dataset.value) / by,
    }));
    row.innerHTML = divided.map((term, i) => termChip(term, i > 0)).join("");
    [...row.children].forEach((chip) => chip.classList.add("pop-in"));
  }

  async function animateAlgebra(balance, after, opLabel, source, caption) {
    const op = parseOp(opLabel);
    const [afterLeft, afterRight] = after.split("=").map((side) => side.trim());
    const leftRow = balance.querySelector('[data-side="left"] .term-row');
    const rightRow = balance.querySelector('[data-side="right"] .term-row');
    const reveal = () => {
      leftRow.innerHTML = parseSide(afterLeft).map((term, i) => termChip(term, i > 0)).join("");
      rightRow.innerHTML = parseSide(afterRight).map((term, i) => termChip(term, i > 0)).join("");
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return;
    }
    if (op.kind === "both") {
      caption.textContent = `${opLabel} flies onto both sides`;
      if (source) await Promise.all([flyClone(source, leftRow), flyClone(source, rightRow)]);
      leftRow.insertAdjacentHTML("beforeend", termChip(op.term, true));
      rightRow.insertAdjacentHTML("beforeend", termChip(op.term, true));
      leftRow.lastElementChild.classList.add("pop-in");
      rightRow.lastElementChild.classList.add("pop-in");
      await wait(460);
      caption.textContent = op.term.value < 0 && !op.term.variable
        ? "Opposites meet and cancel, or make a new total"
        : "Matching blocks slide together";
      await Promise.all([mergeRow(leftRow), mergeRow(rightRow)]);
    } else if (op.kind === "divide") {
      caption.textContent = `Both sides split into ${op.by} equal groups`;
      if (source) await Promise.all([flyClone(source, leftRow), flyClone(source, rightRow)]);
      await Promise.all([divideRow(leftRow, op.by), divideRow(rightRow, op.by)]);
    } else {
      caption.textContent = "Like blocks slide together";
      await Promise.all([mergeRow(leftRow), mergeRow(rightRow)]);
    }
    reveal();
    [...balance.querySelectorAll(".term-chip")].forEach((chip) => chip.classList.add("pop-in"));
    caption.textContent = "Both sides still match";
  }

  function mountQuestion(q, area, fb, hooks) {
    clear(area);
    clear(fb);

    if (q.type === "equation") {
      let stepIndex = 0;
      const lab = el(`<div class="equation-lab"></div>`);
      area.appendChild(lab);

      function equationBoard(equation) {
        const parts = equation.split("=");
        return `
          <div class="balance" aria-label="${escapeHtml(equation)}">
            <div class="balance-pan" data-side="left">${sideChips((parts[0] || "").trim())}<small>LEFT SIDE</small></div>
            <div class="balance-equals">=</div>
            <div class="balance-pan" data-side="right">${sideChips((parts[1] || "").trim())}<small>RIGHT SIDE</small></div>
          </div>
          <p class="move-caption"></p>`;
      }

      function paintStep() {
        const step = q.steps[stepIndex];
        const completed = q.steps.slice(0, stepIndex);
        lab.innerHTML = `
          <div class="equation-progress">MINING STEP ${stepIndex + 1} OF ${q.steps.length}</div>
          ${equationBoard(step.equation)}
          <p class="equation-instruction">${escapeHtml(step.instruction)}</p>
          <div class="operation-tray" aria-label="Choose an operation">
            ${step.choices
              .map(
                (choice, i) => `
                <button type="button" draggable="true" class="operation-card" data-choice="${i}">
                  <span>${escapeHtml(choice.label)}</span>
                  <small>drag or tap</small>
                </button>`,
              )
              .join("")}
          </div>
          <button type="button" class="apply-zone" id="apply-zone">
            <span>⬇</span> APPLY TO BOTH SIDES
          </button>
          <div class="equation-history">
            ${completed
              .map(
                (done) => `
                <div class="equation-done">
                  <span>✅ ${escapeHtml(done.correctLabel)}</span>
                  <b>${escapeHtml(done.after)}</b>
                </div>`,
              )
              .join("")}
          </div>`;

        let selected = null;
        let busy = false;
        const zone = lab.querySelector("#apply-zone");
        const cards = Array.from(lab.querySelectorAll(".operation-card"));

        function select(choiceIndex) {
          selected = choiceIndex;
          cards.forEach((card, i) => card.classList.toggle("selected", i === choiceIndex));
          zone.classList.add("ready");
          zone.innerHTML = `<span>✓</span> APPLY ${escapeHtml(step.choices[choiceIndex].label)} TO BOTH SIDES`;
        }

        function apply(choiceIndex) {
          if (busy) return;
          if (choiceIndex == null || Number.isNaN(choiceIndex)) {
            fb.innerHTML = `<div class="fb hint"><div class="head">Pick a move first</div><div class="explain">Drag a card here, or tap a card and then tap this box.</div></div>`;
            return;
          }
          const choice = step.choices[choiceIndex];
          if (!choice.ok) {
            hooks.onWrong();
            cards[choiceIndex].classList.add("wrong");
            fb.innerHTML = `<div class="fb hint"><div class="head">That would unbalance the trade</div><div class="explain">${choice.hint}</div></div>`;
            return;
          }

          busy = true;
          step.correctLabel = choice.label;
          cards.forEach((card) => (card.disabled = true));
          zone.disabled = true;
          zone.classList.add("correct");
          fb.innerHTML = `<div class="fb ok"><div class="head">✅ Watch the blocks move</div><div class="explain">${step.explain}</div></div>`;
          const balance = lab.querySelector(".balance");
          const caption = lab.querySelector(".move-caption");
          animateAlgebra(balance, step.after, choice.label, cards[choiceIndex], caption).then(() => {
            stepIndex += 1;
            if (stepIndex >= q.steps.length) {
              lab.innerHTML = `
                <div class="equation-complete">💎 ORE FOUND!</div>
                ${equationBoard(q.result)}
                <div class="equation-history">
                  ${q.steps
                    .map(
                      (done) => `
                      <div class="equation-done">
                        <span>✅ ${escapeHtml(done.correctLabel)}</span>
                        <b>${escapeHtml(done.after)}</b>
                      </div>`,
                    )
                    .join("")}
                </div>`;
              fb.innerHTML = `<div class="fb ok"><div class="head">⛏️ You got x alone!</div><div class="explain">${q.explain}</div></div>`;
              hooks.onCorrect();
            } else {
              fb.innerHTML = "";
              paintStep();
            }
          });
        }

        cards.forEach((card, i) => {
          card.onclick = () => select(i);
          card.addEventListener("dragstart", (event) => {
            event.dataTransfer.setData("text/plain", String(i));
            event.dataTransfer.effectAllowed = "move";
            select(i);
          });
        });
        zone.onclick = () => apply(selected);
        zone.addEventListener("dragover", (event) => {
          event.preventDefault();
          zone.classList.add("dragover");
        });
        zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
        zone.addEventListener("drop", (event) => {
          event.preventDefault();
          zone.classList.remove("dragover");
          apply(Number(event.dataTransfer.getData("text/plain")));
        });
      }

      paintStep();
      return;
    }

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
          <span class="xeq">${escapeHtml(q.prefix == null ? "x =" : q.prefix)}</span>
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
        type: "equation",
        prompt: "Vertical angles: 5x + 10 and 3x + 30. Keep the villager trade balanced and dig out x.",
        result: "x = 10",
        steps: [
          {
            equation: "5x + 10 = 3x + 30",
            instruction: "x is on both sides. Which move gets the smaller x-stack out of the way?",
            after: "2x + 10 = 30",
            explain: "Subtracting 3x from both sides removes the 3x on the right and leaves 2x on the left.",
            choices: [
              { label: "− 3x", ok: true },
              { label: "+ 3x", ok: false, hint: "Adding makes both x-stacks bigger. Use the opposite of +3x." },
              { label: "− 30", ok: false, hint: "First get all the x-blocks onto one side." },
            ],
          },
          {
            equation: "2x + 10 = 30",
            instruction: "What is attached to 2x? Use its opposite on both sides.",
            after: "2x = 20",
            explain: "Subtracting 10 cancels the +10. On the right, 30 − 10 = 20.",
            choices: [
              { label: "− 10", ok: true },
              { label: "+ 10", ok: false, hint: "You want the +10 to disappear. Its opposite is −10." },
              { label: "÷ 2", ok: false, hint: "Remove the loose +10 before dividing the x-stack." },
            ],
          },
          {
            equation: "2x = 20",
            instruction: "Two equal x-stacks make 20. How do you get one x-stack?",
            after: "x = 10",
            explain: "Divide both sides by 2. One x-stack is 10.",
            choices: [
              { label: "÷ 2", ok: true },
              { label: "− 2", ok: false, hint: "2x means 2 times x, so undo multiplication with division." },
              { label: "× 2", ok: false, hint: "Multiplying makes the x-stack larger. Split both sides into 2 equal groups." },
            ],
          },
        ],
        explain: "x = 10. Put it back in: 5(10)+10 = 60° and 3(10)+30 = 60°. The vertical twins match!",
      },
      {
        type: "equation",
        prompt: "Linear pair: (4x + 20) and (2x + 40). Build the equation, then isolate x.",
        result: "x = 20",
        steps: [
          {
            equation: "4x + 20 + 2x + 40 = 180",
            instruction: "First craft matching items together: x-blocks with x-blocks, numbers with numbers.",
            after: "6x + 60 = 180",
            explain: "4x + 2x = 6x, and 20 + 40 = 60.",
            choices: [
              { label: "Combine like terms", ok: true },
              { label: "Set them equal", ok: false, hint: "These are neighbors on flat ground, not twins across an X." },
              { label: "Change 180 to 90", ok: false, hint: "A linear pair fills flat ground: 180°." },
            ],
          },
          {
            equation: "6x + 60 = 180",
            instruction: "Undo the loose +60 on both sides.",
            after: "6x = 120",
            explain: "Subtract 60 from both sides: 180 − 60 = 120.",
            choices: [
              { label: "− 60", ok: true },
              { label: "+ 60", ok: false, hint: "Use the opposite of +60." },
              { label: "÷ 6", ok: false, hint: "Clear the +60 before splitting the x-stack." },
            ],
          },
          {
            equation: "6x = 120",
            instruction: "Six x-stacks make 120. Split both sides evenly.",
            after: "x = 20",
            explain: "120 ÷ 6 = 20.",
            choices: [
              { label: "÷ 6", ok: true },
              { label: "− 6", ok: false, hint: "6x is multiplication, so division is the opposite." },
              { label: "÷ 120", ok: false, hint: "Divide by the number attached to x." },
            ],
          },
        ],
        explain: "x = 20. The angles are 100° and 80°, and 100 + 80 = 180°.",
      },
      {
        type: "equation",
        prompt: "Right-angle split: (2x + 5) and (x + 10). Mine x from the block corner.",
        result: "x = 25",
        steps: [
          {
            equation: "2x + 5 + x + 10 = 90",
            instruction: "Combine the like terms before using opposite moves.",
            after: "3x + 15 = 90",
            explain: "2x + x = 3x, and 5 + 10 = 15.",
            choices: [
              { label: "Combine like terms", ok: true },
              { label: "Change 90 to 180", ok: false, hint: "The square marker means a 90° block corner." },
              { label: "Set the pieces equal", ok: false, hint: "The pieces add to 90; they are not necessarily the same." },
            ],
          },
          {
            equation: "3x + 15 = 90",
            instruction: "Undo +15 on both sides.",
            after: "3x = 75",
            explain: "90 − 15 = 75.",
            choices: [
              { label: "− 15", ok: true },
              { label: "+ 15", ok: false, hint: "Use the opposite of +15." },
              { label: "÷ 3", ok: false, hint: "Remove +15 before dividing." },
            ],
          },
          {
            equation: "3x = 75",
            instruction: "Three x-stacks make 75. Split them.",
            after: "x = 25",
            explain: "75 ÷ 3 = 25.",
            choices: [
              { label: "÷ 3", ok: true },
              { label: "− 3", ok: false, hint: "3x means multiplication, not addition." },
              { label: "× 3", ok: false, hint: "Use the opposite of times 3." },
            ],
          },
        ],
        explain: "x = 25. The pieces are 55° and 35°, which add to 90°.",
      },
      {
        type: "equation",
        prompt: "Creeper trap: 20 = 2x − 30. Watch the minus sign and keep both sides balanced.",
        result: "25 = x",
        steps: [
          {
            equation: "20 = 2x − 30",
            instruction: "What is the opposite of subtracting 30?",
            after: "50 = 2x",
            explain: "Add 30 to both sides. On the right, −30 + 30 disappears. On the left, 20 + 30 = 50.",
            choices: [
              { label: "+ 30", ok: true },
              { label: "− 30", ok: false, hint: "That repeats the minus and causes the common negative-answer mistake. Opposite of −30 is +30." },
              { label: "÷ 2", ok: false, hint: "Clear the −30 first." },
            ],
          },
          {
            equation: "50 = 2x",
            instruction: "Two x-stacks equal 50. Split both sides in half.",
            after: "25 = x",
            explain: "50 ÷ 2 = 25, and 2x ÷ 2 = x.",
            choices: [
              { label: "÷ 2", ok: true },
              { label: "− 2", ok: false, hint: "2x means 2 times x, so divide." },
              { label: "× 2", ok: false, hint: "You need one x-stack, not four." },
            ],
          },
        ],
        explain: "x = 25. Check it: 2(25) − 30 = 50 − 30 = 20.",
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

  /* ---------- LEVELS 7–11: homework builds ---------- */
  function level7Content() {
    return `
      <p>Two paths cross like swords. The angles <b>across the X</b> are twins. Same color in the picture = same size.</p>
      ${window.AQ.crossed({ top: "4x+2", right: "?", bottom: "6x−14", left: "?" })}
      <div class="big-rule">Across the X → set them equal</div>
      <div class="steps">
        <div class="step"><div class="say">Orange is across from orange</div><div class="math">4x + 2 = 6x − 14</div></div>
        <div class="step"><div class="say">Get the x's together. Subtract 4x.</div><div class="math">2 = 2x − 14</div></div>
        <div class="step"><div class="say">Undo the −14. Add 14 to both sides.</div><div class="math">16 = 2x</div></div>
        <div class="step"><div class="say">Divide by 2, then put x back in.</div><div class="math">x = 8 → both orange angles are 34°</div></div>
      </div>
      <p>Once you know <b>one</b> angle, you know all four. Across = the same. Next door = 180 minus it.</p>
      <p class="muted">Creeper: if x comes out negative, you moved a minus the wrong way. Add to undo a minus. Don't subtract it again.</p>`;
  }

  function level7Questions() {
    const pic = window.AQ.crossed({ top: "4x+2", right: "?", bottom: "6x−14", left: "?" });
    const known = window.AQ.crossed({ top: "52°", right: "?", bottom: "?", left: "?" });
    return [
      {
        type: "number",
        prompt: "The orange angles are across the X. Find x.",
        diagram: pic,
        prefix: "x =",
        answer: 8,
        hint: "4x + 2 = 6x − 14. Subtract 4x, then add 14.",
        reveal: "2 = 2x − 14 → 16 = 2x → x = 8",
        explain: "Each orange angle is 4(8)+2 = 34°. The other expression gives 34° too.",
      },
      {
        type: "number",
        prompt: "x is 8, so each orange angle is 34°. What is a blue angle, the one next door?",
        diagram: pic,
        prefix: "angle =",
        answer: 146,
        hint: "Neighbors on a straight line add to 180.",
        reveal: "180 − 34 = 146",
        explain: "The four angles are 34°, 146°, 34°, 146°.",
      },
      {
        type: "number",
        prompt: "This X already shows 52° on top. The angle across from it is…",
        diagram: known,
        prefix: "angle =",
        answer: 52,
        hint: "Across the X means the same number. Don't subtract yet.",
        reveal: "Vertical twin = 52°",
        explain: "The bottom angle is also 52°. Each side angle is 180 − 52 = 128°.",
      },
      {
        type: "choice",
        prompt: "A player solved 18 = 2x − 10 and got x = 4 by subtracting 10. What should they do instead?",
        choices: [
          { label: "Leave it. x = 4 checks out.", ok: false, hint: "Plug 4 back in: 2(4) − 10 = −2, not 18." },
          { label: "Add 10 to both sides, then divide", ok: true, explain: "18 + 10 = 2x → 28 = 2x → x = 14. Adding cancels the −10." },
          { label: "Subtract 10 from 18", ok: false, hint: "That's the move that gave x = 4. A minus is undone by adding." },
          { label: "The angles add to 90", ok: false, hint: "These are crossed swords, so the angles are equal, not a block corner." },
        ],
      },
    ];
  }

  function level8Content() {
    return `
      <p>Flat ground is a straight dirt path: <b>180°</b>. Angles sitting on it share that 180.</p>
      ${window.AQ.linear({ left: "5x+10", right: "x+20" })}
      <div class="big-rule">Side by side on a line → add to 180</div>
      <div class="steps">
        <div class="step"><div class="say">Add both expressions</div><div class="math">5x + 10 + x + 20 = 180</div></div>
        <div class="step"><div class="say">Combine like things</div><div class="math">6x + 30 = 180</div></div>
        <div class="step"><div class="say">Undo +30, then divide by 6</div><div class="math">6x = 150 → x = 25</div></div>
      </div>
      <p>When there is a <b>y</b>, do x first. Then <b>y = 180 − the other angles</b>.</p>
      ${window.AQ.triple({ left: "3x+6", mid: "y", right: "5x−8" })}
      <p class="muted">The double tick marks mean those two angles match. Set them equal before you touch y.</p>`;
  }

  function level8Questions() {
    const pair = window.AQ.linear({ left: "5x+10", right: "x+20" });
    const three = window.AQ.triple({ left: "40°", mid: "y", right: "55°" });
    const ticks = window.AQ.triple({ left: "3x+6", mid: "y", right: "5x−8" });
    return [
      {
        type: "number",
        prompt: "These two angles share the straight path. Find x.",
        diagram: pair,
        prefix: "x =",
        answer: 25,
        hint: "(5x+10) + (x+20) = 180",
        reveal: "6x + 30 = 180 → x = 25",
        explain: "The angles are 135° and 45°. 135 + 45 = 180.",
      },
      {
        type: "number",
        prompt: "No x here. Three angles sit on flat ground. Find y.",
        diagram: three,
        prefix: "y =",
        answer: 85,
        hint: "40 + y + 55 = 180",
        reveal: "y = 180 − 40 − 55 = 85",
        explain: "40 + 85 + 55 = 180.",
      },
      {
        type: "number",
        prompt: "The tick marks match, so those two angles are equal. Find x first. Leave y for the next hit.",
        diagram: ticks,
        prefix: "x =",
        answer: 7,
        hint: "3x + 6 = 5x − 8. Don't use 180 until you know the angle sizes.",
        reveal: "6 + 8 = 2x → x = 7",
        explain: "Each marked angle is 3(7)+6 = 27°.",
      },
      {
        type: "number",
        prompt: "Each marked angle is 27°. Now find y.",
        diagram: ticks,
        prefix: "y =",
        answer: 126,
        hint: "y = 180 − 27 − 27",
        reveal: "180 − 54 = 126",
        explain: "27 + 126 + 27 = 180.",
      },
    ];
  }

  function level9Content() {
    return `
      <p>The red square is a block corner: <b>90°</b>. A fence splits it into two pieces.</p>
      ${window.AQ.corner({ upper: "4x−2", lower: "2x+8" })}
      <div class="big-rule">Pieces of the block corner → add to 90</div>
      <div class="steps">
        <div class="step"><div class="say">Add the pieces</div><div class="math">4x − 2 + 2x + 8 = 90</div></div>
        <div class="step"><div class="say">Combine</div><div class="math">6x + 6 = 90</div></div>
        <div class="step"><div class="say">Undo +6, then divide by 6</div><div class="math">6x = 84 → x = 14</div></div>
      </div>
      <p class="muted">Only use 90 when you see the square, or the problem says it is a right angle.</p>`;
  }

  function level9Questions() {
    const pic = window.AQ.corner({ upper: "4x−2", lower: "2x+8" });
    const known = window.AQ.corner({ upper: "23°", lower: "?" });
    return [
      {
        type: "number",
        prompt: "The square means 90°. Find x.",
        diagram: pic,
        prefix: "x =",
        answer: 14,
        hint: "(4x−2) + (2x+8) = 90",
        reveal: "6x + 6 = 90 → x = 14",
        explain: "The pieces are 54° and 36°. 54 + 36 = 90.",
      },
      {
        type: "number",
        prompt: "One piece of this block corner is 23°. How big is the other piece?",
        diagram: known,
        prefix: "angle =",
        answer: 67,
        hint: "90 − 23",
        reveal: "90 − 23 = 67",
        explain: "23 + 67 = 90.",
      },
      {
        type: "choice",
        prompt: "There is no square box, and nobody said 90°. Two angles just sit on a straight path. What do they add to?",
        choices: [
          { label: "90°", ok: false, hint: "90 needs the square box." },
          { label: "180°", ok: true, explain: "Straight path = flat ground = 180." },
          { label: "They are equal", ok: false, hint: "Equal is for twins across an X, or matching marks." },
          { label: "360°", ok: false, hint: "That's a full spin around a point." },
        ],
      },
    ];
  }

  function level10Content() {
    return `
      <p>This is the <b>Angle Addition Postulate</b>. In the game it's the crafting rule: little angles craft into one big angle.</p>
      ${window.AQ.addition({ whole: "m∠ = 118°", left: "2x+6", right: "3x+2" })}
      <div class="big-rule">piece + piece = the whole angle</div>
      <div class="steps">
        <div class="step"><div class="say">The red dashed arc is the whole 118°</div><div class="math">2x + 6 + 3x + 2 = 118</div></div>
        <div class="step"><div class="say">Combine</div><div class="math">5x + 8 = 118</div></div>
        <div class="step"><div class="say">Undo +8, then divide by 5</div><div class="math">5x = 110 → x = 22</div></div>
      </div>
      <p>If they already give you the whole and <b>one</b> piece, subtract: <b>other piece = whole − piece</b>.</p>`;
  }

  function level10Questions() {
    const pic = window.AQ.addition({ whole: "118°", left: "2x+6", right: "3x+2" });
    const sub = window.AQ.addition({ whole: "142°", left: "38°", right: "?" });
    return [
      {
        type: "number",
        prompt: "The two colored pieces craft into the 118° angle. Find x.",
        diagram: pic,
        prefix: "x =",
        answer: 22,
        hint: "(2x+6) + (3x+2) = 118",
        reveal: "5x + 8 = 118 → x = 22",
        explain: "The pieces are 50° and 68°. 50 + 68 = 118.",
      },
      {
        type: "number",
        prompt: "The whole angle is 142° and one piece is 38°. Find the other piece.",
        diagram: sub,
        prefix: "angle =",
        answer: 104,
        hint: "whole − piece",
        reveal: "142 − 38 = 104",
        explain: "38 + 104 = 142. That's angle addition with only one unknown piece.",
      },
      {
        type: "choice",
        prompt: "Which equation matches “two pieces make this whole angle”?",
        choices: [
          { label: "piece + piece = whole", ok: true, explain: "That's the Angle Addition Postulate." },
          { label: "piece = whole", ok: false, hint: "A piece is smaller than the whole angle." },
          { label: "piece + piece = 180, always", ok: false, hint: "180 is only for a straight line. Use the number they gave for the whole." },
          { label: "piece + piece = 90, always", ok: false, hint: "90 is only for a block corner with the square." },
        ],
      },
    ];
  }

  function level11Content() {
    return `
      <p><b>Congruent</b> means the same size. The sign is <b>≅</b>.</p>
      <p>A <b>congruence statement</b> names both angles, with the vertex letter in the middle:</p>
      <div class="big-rule">∠ABC ≅ ∠DEF</div>
      ${window.AQ.twins({ leftMeasure: "7x−5", rightMeasure: "4x+16", statement: "∠BAC ≅ ∠EDF" })}
      <ul>
        <li>Middle letters match: <b>A</b> and <b>D</b> are the spawn points.</li>
        <li>The sides match in order: B↔E and C↔F.</li>
        <li>Same double tick marks are another way to say ≅. Set the measures equal: <b>m∠BAC = m∠EDF</b>.</li>
      </ul>
      <p>You can reverse both names together: ∠CAB ≅ ∠FDE. Don't swap only one side.</p>`;
  }

  function level11Questions() {
    const pic = window.AQ.twins({
      leftMeasure: "7x−5",
      rightMeasure: "4x+16",
      statement: "∠BAC ≅ ∠EDF",
    });
    return [
      {
        type: "choice",
        prompt: "In ∠ABC ≅ ∠DEF, which letters are the vertices?",
        choices: [
          { label: "A and D", ok: false, hint: "The vertex is the middle letter of each name." },
          { label: "B and E", ok: true, explain: "B is the middle of ∠ABC. E is the middle of ∠DEF." },
          { label: "C and F", ok: false, hint: "Those are the last letters, one side each." },
          { label: "A and F", ok: false, hint: "Match middle letter to middle letter." },
        ],
      },
      {
        type: "choice",
        prompt: "Which statement is the same pair as ∠PQR ≅ ∠STU?",
        choices: [
          { label: "∠RQP ≅ ∠UTS", ok: true, explain: "Both names flipped, so Q still matches U in the middle." },
          { label: "∠QPR ≅ ∠STU", ok: false, hint: "That moves the vertex to P." },
          { label: "∠PQR ≅ ∠SUT", ok: false, hint: "The right-hand vertex has to stay U if the left vertex is Q." },
          { label: "∠PRQ ≅ ∠TSU", ok: false, hint: "R would be the vertex on the left. Q has to stay in the middle." },
        ],
      },
      {
        type: "number",
        prompt: "The double ticks mean these angles are congruent. Find x.",
        diagram: pic,
        prefix: "x =",
        answer: 7,
        hint: "7x − 5 = 4x + 16",
        reveal: "3x = 21 → x = 7",
        explain: "Both angles measure 44°. Congruent twins have to match.",
      },
      {
        type: "number",
        prompt: "∠JKL ≅ ∠MNP and m∠JKL = 58°. What is m∠MNP?",
        prefix: "m∠MNP =",
        answer: 58,
        hint: "≅ means the measures are equal.",
        reveal: "m∠MNP = 58°",
        explain: "The statement already told you they match. N is the vertex of the second angle.",
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
          const advance = () => {
            qi += 1;
            if (qi >= bossQs.length) {
              completeLevel(levelIndex);
              setTimeout(() => renderVictory(), 450);
            } else {
              paint();
            }
          };
          if (q.type === "equation" || q.type === "number") {
            showNextButton(app.querySelector("#fb"), qi + 1 >= bossQs.length, advance);
          } else {
            setTimeout(advance, 750);
          }
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
