// Problem generators for Angela's Geometry Quest
// Each generator returns a fresh randomized problem with question, answer, and solution steps

type Point = { x: number; y: number };

export type Problem = {
  id: string;
  topic: string;
  question: string;
  answer: string | string[]; // Can be multiple accepted forms
  solution: string[]; // Step-by-step explanation
  hint: string;
  type: "input" | "multiple-choice" | "plot-point";
  choices?: string[];
  renderGrid?: (ctx: CanvasRenderingContext2D) => void;
  correctPoint?: { x: number; y: number }; // For plot-point type
  tolerance?: number; // How close the plot needs to be (in grid units)
};

// Utility: random integer in [min, max]
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Utility: random non-zero integer in [min, max], skipping zero
function randNonZero(min: number, max: number): number {
  let val = randInt(min, max);
  while (val === 0) val = randInt(min, max);
  return val;
}

// Utility: greatest common divisor
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

// Utility: format fraction or decimal
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  // Check if it's a clean half
  if (Math.abs(n * 2 - Math.round(n * 2)) < 0.001) {
    const whole = Math.floor(n);
    if (whole === 0) return n < 0 ? "-0.5" : "0.5";
    const frac = Math.abs(n - whole);
    if (Math.abs(frac - 0.5) < 0.001) {
      return whole === 0 ? "0.5" : `${whole}.5`;
    }
  }
  return n.toFixed(2);
}

// Utility: accept variations of an answer
function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .replace(/\s+/g, "")
    .replace(/[()]/g, "")
    .toLowerCase();
}

export function checkAnswer(userAnswer: string, correctAnswers: string | string[]): boolean {
  const normalized = normalizeAnswer(userAnswer);
  const correct = Array.isArray(correctAnswers) ? correctAnswers : [correctAnswers];
  return correct.some((ans) => {
    const normCorrect = normalizeAnswer(ans);
    if (normalized === normCorrect) return true;
    // Try parsing as numbers for decimal/fraction equivalence
    const userNum = parseFloat(normalized.replace(/[^0-9.-]/g, ""));
    const correctNum = parseFloat(normCorrect.replace(/[^0-9.-]/g, ""));
    if (!isNaN(userNum) && !isNaN(correctNum) && Math.abs(userNum - correctNum) < 0.01) {
      return true;
    }
    return false;
  });
}

// ============================================================
// 1. MIDPOINT FORMULA FROM COORDINATES
// ============================================================
export function generateMidpointFormula(): Problem {
  const x1 = randInt(-8, 8);
  const y1 = randInt(-8, 8);
  const x2 = randInt(-8, 8);
  const y2 = randInt(-8, 8);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  const answer = `(${formatNumber(mx)}, ${formatNumber(my)})`;
  const altAnswer = `${formatNumber(mx)},${formatNumber(my)}`;

  return {
    id: `midpoint-formula-${Date.now()}-${Math.random()}`,
    topic: "Midpoint Formula",
    question: `Find the midpoint of the segment with endpoints (${x1}, ${y1}) and (${x2}, ${y2}).`,
    answer: [answer, altAnswer, answer.replace(/\s/g, "")],
    solution: [
      `Midpoint formula: M = ((x₁ + x₂)/2, (y₁ + y₂)/2)`,
      `M = ((${x1} + ${x2})/2, (${y1} + ${y2})/2)`,
      `M = (${x1 + x2}/2, ${y1 + y2}/2)`,
      `M = (${formatNumber(mx)}, ${formatNumber(my)})`,
    ],
    hint: "Use the midpoint formula: average the x-coordinates and the y-coordinates.",
    type: "input",
  };
}

// ============================================================
// 2. MIDPOINT FROM A GRAPH
// ============================================================
export function generateMidpointGraph(): Problem {
  const x1 = randInt(-5, 5);
  const y1 = randInt(-5, 5);
  const x2 = randInt(-5, 5);
  const y2 = randInt(-5, 5);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  const answer = `(${formatNumber(mx)}, ${formatNumber(my)})`;
  const altAnswer = `${formatNumber(mx)},${formatNumber(my)}`;

  const renderGrid = (ctx: CanvasRenderingContext2D) => {
    // Use the display size (accounting for DPR scaling)
    const width = ctx.canvas.width / (window.devicePixelRatio || 1);
    const height = ctx.canvas.height / (window.devicePixelRatio || 1);
    const scale = Math.min(width, height) / 12;
    const originX = width / 2;
    const originY = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f0f4f8";
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "#d0d8e0";
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(originX + i * scale, 0);
      ctx.lineTo(originX + i * scale, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, originY + i * scale);
      ctx.lineTo(width, originY + i * scale);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#1e3a5f";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("x", width - 15, originY - 5);
    ctx.textAlign = "left";
    ctx.fillText("y", originX + 5, 15);

    // Segment
    const px1 = originX + x1 * scale;
    const py1 = originY - y1 * scale;
    const px2 = originX + x2 * scale;
    const py2 = originY - y2 * scale;

    ctx.strokeStyle = "#e63946";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.stroke();

    // Endpoints
    ctx.fillStyle = "#e63946";
    ctx.beginPath();
    ctx.arc(px1, py1, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px2, py2, 5, 0, 2 * Math.PI);
    ctx.fill();

    // Labels
    ctx.fillStyle = "#1e3a5f";
    ctx.font = "14px sans-serif";
    ctx.fillText(`(${x1}, ${y1})`, px1 + 8, py1 - 8);
    ctx.fillText(`(${x2}, ${y2})`, px2 + 8, py2 - 8);
  };

  // Randomly choose between typing answer or plotting on graph
  const usePlotting = Math.random() > 0.5;

  if (usePlotting) {
    return {
      id: `midpoint-graph-plot-${Date.now()}-${Math.random()}`,
      topic: "Midpoint from Graph",
      question: "Tap on the graph to plot the midpoint of the segment.",
      answer: [answer, altAnswer, answer.replace(/\s/g, "")],
      solution: [
        `From the graph: endpoints are (${x1}, ${y1}) and (${x2}, ${y2})`,
        `Midpoint = ((${x1} + ${x2})/2, (${y1} + ${y2})/2)`,
        `Midpoint = (${formatNumber(mx)}, ${formatNumber(my)})`,
      ],
      hint: "Count the squares to find the exact middle between the two endpoints.",
      type: "plot-point",
      correctPoint: { x: mx, y: my },
      tolerance: 0.3, // Allow tapping within 0.3 grid units
      renderGrid,
    };
  }

  return {
    id: `midpoint-graph-${Date.now()}-${Math.random()}`,
    topic: "Midpoint from Graph",
    question: "Find the midpoint of the segment shown on the graph.",
    answer: [answer, altAnswer, answer.replace(/\s/g, "")],
    solution: [
      `From the graph: endpoints are (${x1}, ${y1}) and (${x2}, ${y2})`,
      `Midpoint = ((${x1} + ${x2})/2, (${y1} + ${y2})/2)`,
      `Midpoint = (${formatNumber(mx)}, ${formatNumber(my)})`,
    ],
    hint: "Read the coordinates from the graph, then use the midpoint formula.",
    type: "input",
    renderGrid,
  };
}

// ============================================================
// 3. SEGMENT ADDITION
// ============================================================
export function generateSegmentAddition(): Problem {
  const problemType = randInt(1, 3);

  if (problemType === 1) {
    // Type: D—E—F with DE=2x-7, EF=2x-10, DF=15. Find EF.
    const total = randInt(10, 30);
    const coeff1 = randInt(2, 5);
    const const1 = randInt(-10, 10);
    const coeff2 = randInt(2, 5);
    const const2 = randInt(-10, 10);

    // Solve: coeff1*x + const1 + coeff2*x + const2 = total
    // (coeff1 + coeff2)*x = total - const1 - const2
    const x = (total - const1 - const2) / (coeff1 + coeff2);
    if (!Number.isInteger(x) || x <= 0) {
      // Retry with simpler numbers
      return generateSegmentAddition();
    }

    const DE = coeff1 * x + const1;
    const EF = coeff2 * x + const2;

    return {
      id: `segment-addition-${Date.now()}-${Math.random()}`,
      topic: "Segment Addition",
      question: `Points D, E, and F are collinear with E between D and F. If DE = ${coeff1}x ${const1 >= 0 ? "+" : ""}${const1}, EF = ${coeff2}x ${const2 >= 0 ? "+" : ""}${const2}, and DF = ${total}, find EF.`,
      answer: [EF.toString()],
      solution: [
        `DE + EF = DF (segment addition)`,
        `(${coeff1}x ${const1 >= 0 ? "+" : ""}${const1}) + (${coeff2}x ${const2 >= 0 ? "+" : ""}${const2}) = ${total}`,
        `${coeff1 + coeff2}x ${const1 + const2 >= 0 ? "+" : ""}${const1 + const2} = ${total}`,
        `${coeff1 + coeff2}x = ${total - const1 - const2}`,
        `x = ${x}`,
        `EF = ${coeff2}(${x}) ${const2 >= 0 ? "+" : ""}${const2} = ${EF}`,
      ],
      hint: "DE + EF = DF. Substitute the expressions and solve for x, then find EF.",
      type: "input",
    };
  } else if (problemType === 2) {
    // Type: "S is between R and K, RS=2x-4, SK=x+10, RK=72, find RS and SK"
    const total = randInt(40, 100);
    const coeff1 = randInt(2, 4);
    const const1 = randInt(-10, 10);
    const coeff2 = randInt(1, 3);
    const const2 = randInt(5, 15);

    const x = (total - const1 - const2) / (coeff1 + coeff2);
    if (!Number.isInteger(x) || x <= 0) {
      return generateSegmentAddition();
    }

    const RS = coeff1 * x + const1;
    const SK = coeff2 * x + const2;

    return {
      id: `segment-addition-${Date.now()}-${Math.random()}`,
      topic: "Segment Addition",
      question: `S is between R and K. RS = ${coeff1}x ${const1 >= 0 ? "+" : ""}${const1}, SK = ${coeff2}x ${const2 >= 0 ? "+" : ""}${const2}, RK = ${total}. Find RS and SK.`,
      answer: [`RS=${RS}, SK=${SK}`, `RS=${RS},SK=${SK}`, `${RS}, ${SK}`, `${RS},${SK}`],
      solution: [
        `RS + SK = RK (segment addition)`,
        `(${coeff1}x ${const1 >= 0 ? "+" : ""}${const1}) + (${coeff2}x ${const2 >= 0 ? "+" : ""}${const2}) = ${total}`,
        `${coeff1 + coeff2}x ${const1 + const2 >= 0 ? "+" : ""}${const1 + const2} = ${total}`,
        `${coeff1 + coeff2}x = ${total - const1 - const2}`,
        `x = ${x}`,
        `RS = ${coeff1}(${x}) ${const1 >= 0 ? "+" : ""}${const1} = ${RS}`,
        `SK = ${coeff2}(${x}) ${const2 >= 0 ? "+" : ""}${const2} = ${SK}`,
      ],
      hint: "Set up RS + SK = RK and solve for x, then substitute back.",
      type: "input",
    };
  } else {
    // Type: "A, B, C collinear, B between A and C, AC=18, BC=7, find AB"
    const total = randInt(15, 50);
    const part = randInt(5, total - 5);
    const other = total - part;

    return {
      id: `segment-addition-${Date.now()}-${Math.random()}`,
      topic: "Segment Addition",
      question: `Points A, B, and C are collinear with B between A and C. AC = ${total} and BC = ${part}. Find AB.`,
      answer: [other.toString()],
      solution: [
        `AB + BC = AC (segment addition)`,
        `AB + ${part} = ${total}`,
        `AB = ${total} - ${part}`,
        `AB = ${other}`,
      ],
      hint: "Use AB + BC = AC. Substitute the known values and solve for AB.",
      type: "input",
    };
  }
}

// ============================================================
// 4. MIDPOINT/CONGRUENT-TICK-MARK ALGEBRA
// ============================================================
export function generateMidpointAlgebra(): Problem {
  const problemType = randInt(1, 2);

  if (problemType === 1) {
    // M is midpoint of AC: AM = MC
    const coeff1 = randInt(3, 7);
    const const1 = randInt(5, 20);
    const coeff2 = randInt(5, 9);
    const const2 = randInt(-10, 5);

    // Solve coeff1*x + const1 = coeff2*x + const2
    const x = (const1 - const2) / (coeff2 - coeff1);
    if (!Number.isInteger(x) || x <= 0 || coeff1 >= coeff2) {
      return generateMidpointAlgebra();
    }

    const AM = coeff1 * x + const1;
    const AC = 2 * AM;

    const findWhat = randInt(1, 3);
    let answer: string;
    let questionText: string;

    if (findWhat === 1) {
      answer = AM.toString();
      questionText = `M is the midpoint of AC. AM = ${coeff1}x ${const1 >= 0 ? "+" : ""}${const1} and MC = ${coeff2}x ${const2 >= 0 ? "+" : ""}${const2}. Find AM.`;
    } else if (findWhat === 2) {
      answer = AM.toString();
      questionText = `M is the midpoint of AC. AM = ${coeff1}x ${const1 >= 0 ? "+" : ""}${const1} and MC = ${coeff2}x ${const2 >= 0 ? "+" : ""}${const2}. Find MC.`;
    } else {
      answer = AC.toString();
      questionText = `M is the midpoint of AC. AM = ${coeff1}x ${const1 >= 0 ? "+" : ""}${const1} and MC = ${coeff2}x ${const2 >= 0 ? "+" : ""}${const2}. Find AC.`;
    }

    return {
      id: `midpoint-algebra-${Date.now()}-${Math.random()}`,
      topic: "Midpoint Algebra",
      question: questionText,
      answer: [answer],
      solution: [
        `M is the midpoint, so AM = MC`,
        `${coeff1}x ${const1 >= 0 ? "+" : ""}${const1} = ${coeff2}x ${const2 >= 0 ? "+" : ""}${const2}`,
        `${coeff1}x - ${coeff2}x = ${const2} - ${const1}`,
        `${coeff1 - coeff2}x = ${const2 - const1}`,
        `x = ${x}`,
        `AM = ${coeff1}(${x}) ${const1 >= 0 ? "+" : ""}${const1} = ${AM}`,
        findWhat === 3 ? `AC = 2 × AM = ${AC}` : `MC = AM = ${AM}`,
      ],
      hint: "Since M is the midpoint, AM equals MC. Set them equal and solve for x.",
      type: "input",
    };
  } else {
    // Bisector version: line m bisects DA at B
    const coeff1 = randInt(3, 8);
    const const1 = randInt(5, 15);
    const coeff2 = randInt(10, 15);

    // Solve coeff1*x + const1 = coeff2*x
    const x = const1 / (coeff2 - coeff1);
    if (!Number.isInteger(x) || x <= 0) {
      return generateMidpointAlgebra();
    }

    const AB = coeff1 * x + const1;

    return {
      id: `midpoint-algebra-${Date.now()}-${Math.random()}`,
      topic: "Midpoint Algebra",
      question: `Line m bisects segment DA at point B. DB = ${coeff1}x ${const1 >= 0 ? "+" : ""}${const1} and BA = ${coeff2}x. Find AB.`,
      answer: [AB.toString()],
      solution: [
        `B is the midpoint (bisects DA), so DB = BA`,
        `${coeff1}x ${const1 >= 0 ? "+" : ""}${const1} = ${coeff2}x`,
        `${const1} = ${coeff2}x - ${coeff1}x`,
        `${const1} = ${coeff2 - coeff1}x`,
        `x = ${x}`,
        `AB = ${coeff2}(${x}) = ${AB}`,
      ],
      hint: "Bisecting means cutting in half, so DB = BA. Set them equal and solve.",
      type: "input",
    };
  }
}

// ============================================================
// 5. MULTI-STEP LINEAR EQUATIONS
// ============================================================
export function generateLinearEquation(): Problem {
  const eqType = randInt(1, 5);

  // Type 1: 6(v-7) = -90
  if (eqType === 1) {
    const coeff = randNonZero(-10, 10);
    const inside = randInt(-15, 15);
    const result = randInt(-100, 100);
    // coeff*(x + inside) = result
    // x + inside = result/coeff
    // x = result/coeff - inside
    if (result % coeff !== 0) return generateLinearEquation();
    const x = result / coeff - inside;
    if (!Number.isInteger(x)) return generateLinearEquation();

    return {
      id: `linear-equation-${Date.now()}-${Math.random()}`,
      topic: "Linear Equations",
      question: `Solve for the variable: ${coeff}(v ${inside >= 0 ? "+" : ""}${inside}) = ${result}`,
      answer: [x.toString(), `v=${x}`, `v = ${x}`],
      solution: [
        `${coeff}(v ${inside >= 0 ? "+" : ""}${inside}) = ${result}`,
        `v ${inside >= 0 ? "+" : ""}${inside} = ${result}/${coeff}`,
        `v ${inside >= 0 ? "+" : ""}${inside} = ${result / coeff}`,
        `v = ${result / coeff} - ${inside}`,
        `v = ${x}`,
      ],
      hint: "Divide both sides by the coefficient, then isolate the variable.",
      type: "input",
    };
  }

  // Type 2: 5x + 30 = -7(1 - 6x)
  if (eqType === 2) {
    const a = randInt(2, 8);
    const b = randInt(10, 40);
    const c = randNonZero(-10, 10);
    const d = randInt(1, 5);
    const e = randInt(3, 10);

    // a*x + b = c*(d - e*x)
    // a*x + b = c*d - c*e*x
    // a*x + c*e*x = c*d - b
    // (a + c*e)*x = c*d - b
    const x = (c * d - b) / (a + c * e);
    if (!Number.isInteger(x)) return generateLinearEquation();

    return {
      id: `linear-equation-${Date.now()}-${Math.random()}`,
      topic: "Linear Equations",
      question: `Solve for x: ${a}x ${b >= 0 ? "+" : ""}${b} = ${c}(${d} - ${e}x)`,
      answer: [x.toString(), `x=${x}`, `x = ${x}`],
      solution: [
        `${a}x ${b >= 0 ? "+" : ""}${b} = ${c}(${d} - ${e}x)`,
        `${a}x ${b >= 0 ? "+" : ""}${b} = ${c * d} - ${c * e}x`,
        `${a}x + ${c * e}x = ${c * d} - ${b}`,
        `${a + c * e}x = ${c * d - b}`,
        `x = ${x}`,
      ],
      hint: "Expand the right side, then collect all x terms on one side.",
      type: "input",
    };
  }

  // Type 3: -37 + 2x = 5(1 - 8x)
  if (eqType === 3) {
    const a = randInt(-50, -10);
    const b = randInt(2, 5);
    const c = randInt(3, 7);
    const d = randInt(1, 5);
    const e = randInt(5, 10);

    // a + b*x = c*(d - e*x)
    // a + b*x = c*d - c*e*x
    // b*x + c*e*x = c*d - a
    const x = (c * d - a) / (b + c * e);
    if (!Number.isInteger(x)) return generateLinearEquation();

    return {
      id: `linear-equation-${Date.now()}-${Math.random()}`,
      topic: "Linear Equations",
      question: `Solve for x: ${a} ${b >= 0 ? "+" : ""}${b}x = ${c}(${d} - ${e}x)`,
      answer: [x.toString(), `x=${x}`, `x = ${x}`],
      solution: [
        `${a} + ${b}x = ${c}(${d} - ${e}x)`,
        `${a} + ${b}x = ${c * d} - ${c * e}x`,
        `${b}x + ${c * e}x = ${c * d} - ${a}`,
        `${b + c * e}x = ${c * d - a}`,
        `x = ${x}`,
      ],
      hint: "Distribute on the right, move all x terms to one side, then solve.",
      type: "input",
    };
  }

  // Type 4: 8n - 22 = 2(7n - 5)
  if (eqType === 4) {
    const a = randInt(5, 12);
    const b = randInt(-30, 30);
    const c = randInt(2, 5);
    const d = randInt(4, 10);
    const e = randInt(-10, 10);

    // a*n + b = c*(d*n + e)
    // a*n + b = c*d*n + c*e
    // a*n - c*d*n = c*e - b
    const divisor = a - c * d;
    if (divisor === 0) return generateLinearEquation();
    const n = (c * e - b) / divisor;
    if (!Number.isInteger(n)) return generateLinearEquation();

    return {
      id: `linear-equation-${Date.now()}-${Math.random()}`,
      topic: "Linear Equations",
      question: `Solve for n: ${a}n ${b >= 0 ? "+" : ""}${b} = ${c}(${d}n ${e >= 0 ? "+" : ""}${e})`,
      answer: [n.toString(), `n=${n}`, `n = ${n}`],
      solution: [
        `${a}n ${b >= 0 ? "+" : ""}${b} = ${c}(${d}n ${e >= 0 ? "+" : ""}${e})`,
        `${a}n ${b >= 0 ? "+" : ""}${b} = ${c * d}n ${c * e >= 0 ? "+" : ""}${c * e}`,
        `${a}n - ${c * d}n = ${c * e} - ${b}`,
        `${a - c * d}n = ${c * e - b}`,
        `n = ${n}`,
      ],
      hint: "Expand the parentheses, collect like terms, and solve for n.",
      type: "input",
    };
  }

  // Type 5: 2(3t - 8) + 4t = 10
  const a = randInt(2, 4);
  const b = randInt(2, 6);
  const c = randInt(-15, 15);
  const d = randInt(2, 5);
  const result = randInt(5, 30);

  // a*(b*t + c) + d*t = result
  // a*b*t + a*c + d*t = result
  // (a*b + d)*t = result - a*c
  const t = (result - a * c) / (a * b + d);
  if (!Number.isInteger(t)) return generateLinearEquation();

  return {
    id: `linear-equation-${Date.now()}-${Math.random()}`,
    topic: "Linear Equations",
    question: `Solve for t: ${a}(${b}t ${c >= 0 ? "+" : ""}${c}) ${d >= 0 ? "+" : ""}${d}t = ${result}`,
    answer: [t.toString(), `t=${t}`, `t = ${t}`],
    solution: [
      `${a}(${b}t ${c >= 0 ? "+" : ""}${c}) + ${d}t = ${result}`,
      `${a * b}t ${a * c >= 0 ? "+" : ""}${a * c} + ${d}t = ${result}`,
      `${a * b + d}t ${a * c >= 0 ? "+" : ""}${a * c} = ${result}`,
      `${a * b + d}t = ${result - a * c}`,
      `t = ${t}`,
    ],
    hint: "Distribute, combine like terms, then isolate the variable.",
    type: "input",
  };
}

// ============================================================
// 6. CONGRUENT SEGMENTS ON A GRID
// ============================================================
export function generateCongruentSegments(): Problem {
  // Generate 4-6 points on a grid, some with congruent lengths
  const points: Point[] = [];
  const labels = ["A", "B", "C", "D", "E", "F"];
  const numPoints = randInt(4, 6);

  for (let i = 0; i < numPoints; i++) {
    points.push({ x: randInt(-4, 4), y: randInt(-4, 4) });
  }

  // Calculate all pairwise distances (only horizontal and vertical)
  const segments: { name: string; length: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const p1 = points[i];
      const p2 = points[j];
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);
      if (dx === 0 || dy === 0) {
        // Horizontal or vertical
        const length = Math.max(dx, dy);
        segments.push({ name: `${labels[i]}${labels[j]}`, length });
      }
    }
  }

  if (segments.length < 3) return generateCongruentSegments();

  // Find congruent pairs
  const congruentPairs: string[][] = [];
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (segments[i].length === segments[j].length && segments[i].length > 0) {
        congruentPairs.push([segments[i].name, segments[j].name]);
      }
    }
  }

  if (congruentPairs.length === 0) return generateCongruentSegments();

  // Pick one true congruence and generate wrong choices
  const correctPair = congruentPairs[randInt(0, congruentPairs.length - 1)];
  const correctStatement = `${correctPair[0]} ≅ ${correctPair[1]}`;

  // Generate 3 wrong statements
  const wrongStatements: string[] = [];
  while (wrongStatements.length < 3) {
    const i = randInt(0, segments.length - 1);
    const j = randInt(0, segments.length - 1);
    if (i !== j && segments[i].length !== segments[j].length) {
      const wrong = `${segments[i].name} ≅ ${segments[j].name}`;
      if (!wrongStatements.includes(wrong) && wrong !== correctStatement) {
        wrongStatements.push(wrong);
      }
    }
  }

  const choices = [correctStatement, ...wrongStatements].sort(() => Math.random() - 0.5);

  const renderGrid = (ctx: CanvasRenderingContext2D) => {
    // Use the display size (accounting for DPR scaling)
    const width = ctx.canvas.width / (window.devicePixelRatio || 1);
    const height = ctx.canvas.height / (window.devicePixelRatio || 1);
    const scale = Math.min(width, height) / 10;
    const originX = width / 2;
    const originY = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f0f4f8";
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = "#d0d8e0";
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(originX + i * scale, 0);
      ctx.lineTo(originX + i * scale, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, originY + i * scale);
      ctx.lineTo(width, originY + i * scale);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Points and labels
    ctx.fillStyle = "#e63946";
    ctx.font = "14px sans-serif";
    points.forEach((p, i) => {
      if (i >= numPoints) return;
      const px = originX + p.x * scale;
      const py = originY - p.y * scale;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#1e3a5f";
      ctx.fillText(labels[i], px + 8, py - 8);
      ctx.fillStyle = "#e63946";
    });

    // Draw some segments
    ctx.strokeStyle = "#457b9d";
    ctx.lineWidth = 2;
    for (let i = 0; i < Math.min(3, segments.length); i++) {
      const seg = segments[i];
      const [l1, l2] = seg.name.split("");
      const i1 = labels.indexOf(l1);
      const i2 = labels.indexOf(l2);
      if (i1 >= 0 && i2 >= 0 && i1 < points.length && i2 < points.length) {
        const p1 = points[i1];
        const p2 = points[i2];
        const px1 = originX + p1.x * scale;
        const py1 = originY - p1.y * scale;
        const px2 = originX + p2.x * scale;
        const py2 = originY - p2.y * scale;
        ctx.beginPath();
        ctx.moveTo(px1, py1);
        ctx.lineTo(px2, py2);
        ctx.stroke();
      }
    }
  };

  return {
    id: `congruent-segments-${Date.now()}-${Math.random()}`,
    topic: "Congruent Segments",
    question: "Which segments are congruent (same length)?",
    answer: [correctStatement],
    solution: [
      `Count the grid units for each segment:`,
      ...segments.map((s) => `${s.name} = ${s.length} units`),
      `Congruent segments have the same length:`,
      correctStatement,
    ],
    hint: "Count horizontal or vertical grid units for each segment. Congruent means equal length.",
    type: "multiple-choice",
    choices,
    renderGrid,
  };
}

// ============================================================
// 7. POINTS, LINES, AND PLANES VOCABULARY
// ============================================================
export function generateVocabulary(): Problem {
  const vocabType = randInt(1, 6);

  if (vocabType === 1) {
    // Collinear points
    const choices = [
      "Points that lie on the same line",
      "Points that lie on the same plane",
      "Points that form a right angle",
      "Points that are equidistant",
    ];
    return {
      id: `vocabulary-${Date.now()}-${Math.random()}`,
      topic: "Vocabulary",
      question: "Which best defines collinear points?",
      answer: [choices[0]],
      solution: [`Collinear points lie on the same line.`],
      hint: "Think about the prefix 'co-' (together) and 'linear' (line).",
      type: "multiple-choice",
      choices,
    };
  }

  if (vocabType === 2) {
    // Ray vs segment vs line
    const choices = [
      "A part of a line with one endpoint and extends infinitely in one direction",
      "A part of a line with two endpoints",
      "A straight path that extends infinitely in both directions",
      "A point with no dimension",
    ];
    return {
      id: `vocabulary-${Date.now()}-${Math.random()}`,
      topic: "Vocabulary",
      question: "Which best describes a ray?",
      answer: [choices[0]],
      solution: [
        `A ray has one endpoint and extends infinitely in one direction.`,
        `A segment has two endpoints.`,
        `A line extends infinitely in both directions.`,
      ],
      hint: "A ray is like a laser beam: starts at one point and goes forever in one direction.",
      type: "multiple-choice",
      choices,
    };
  }

  if (vocabType === 3) {
    // Opposite rays
    const choices = [
      "Two rays that share the same endpoint and form a line",
      "Two rays that are parallel",
      "Two rays that are perpendicular",
      "Two rays that never meet",
    ];
    return {
      id: `vocabulary-${Date.now()}-${Math.random()}`,
      topic: "Vocabulary",
      question: "What are opposite rays?",
      answer: [choices[0]],
      solution: [
        `Opposite rays share the same endpoint and extend in opposite directions, forming a straight line.`,
      ],
      hint: "Think of opposite rays as two arrows pointing away from each other from the same starting point.",
      type: "multiple-choice",
      choices,
    };
  }

  if (vocabType === 4) {
    // Intersection of two lines
    const choices = ["A point", "A line", "A plane", "A ray"];
    return {
      id: `vocabulary-${Date.now()}-${Math.random()}`,
      topic: "Vocabulary",
      question: "The intersection of two distinct lines is:",
      answer: [choices[0]],
      solution: [`Two distinct lines intersect at exactly one point.`],
      hint: "Where do two lines cross? At a single point.",
      type: "multiple-choice",
      choices,
    };
  }

  if (vocabType === 5) {
    // Intersection of two planes
    const choices = ["A line", "A point", "A plane", "A segment"];
    return {
      id: `vocabulary-${Date.now()}-${Math.random()}`,
      topic: "Vocabulary",
      question: "The intersection of two distinct planes is:",
      answer: [choices[0]],
      solution: [
        `Two distinct planes intersect along a line.`,
        `Think of two walls meeting at an edge — that edge is a line.`,
      ],
      hint: "Imagine two walls meeting. They share an edge, which is a line.",
      type: "multiple-choice",
      choices,
    };
  }

  // Naming a plane
  const choices = [
    "By a single capital letter or by three non-collinear points",
    "By two points",
    "By a lowercase letter",
    "By four collinear points",
  ];
  return {
    id: `vocabulary-${Date.now()}-${Math.random()}`,
    topic: "Vocabulary",
    question: "How do you name a plane?",
    answer: [choices[0]],
    solution: [
      `A plane can be named by a single capital letter (like plane P)`,
      `Or by three non-collinear points on the plane (like plane ABC).`,
    ],
    hint: "A plane needs at least 3 points that don't all sit on one line to define it.",
    type: "multiple-choice",
    choices,
  };
}

// ============================================================
// 8. SIMPLIFY RADICALS
// ============================================================
export function generateSimplifyRadical(): Problem {
  // Generate a radical like 4√150 = 20√6
  // Pick a coefficient and a radicand that simplifies nicely
  const coeff = randInt(2, 6);
  const perfectSquare = [4, 9, 16, 25][randInt(0, 3)];
  const simplePart = randInt(2, 10);
  const radicand = perfectSquare * simplePart;

  const sqrtPerfect = Math.sqrt(perfectSquare);
  const finalCoeff = coeff * sqrtPerfect;

  return {
    id: `simplify-radical-${Date.now()}-${Math.random()}`,
    topic: "Simplify Radicals",
    question: `Simplify: ${coeff}√${radicand}`,
    answer: [`${finalCoeff}√${simplePart}`, `${finalCoeff}sqrt${simplePart}`],
    solution: [
      `${coeff}√${radicand}`,
      `Factor ${radicand} = ${perfectSquare} × ${simplePart}`,
      `${coeff}√(${perfectSquare} × ${simplePart})`,
      `${coeff} × √${perfectSquare} × √${simplePart}`,
      `${coeff} × ${sqrtPerfect} × √${simplePart}`,
      `${finalCoeff}√${simplePart}`,
    ],
    hint: "Find the largest perfect square factor of the radicand, then simplify.",
    type: "input",
  };
}

// ============================================================
// MIXED PRACTICE
// ============================================================
export function generateMixedProblem(): Problem {
  const generators = [
    generateMidpointFormula,
    generateMidpointGraph,
    generateSegmentAddition,
    generateMidpointAlgebra,
    generateLinearEquation,
    generateCongruentSegments,
    generateVocabulary,
    generateSimplifyRadical,
  ];
  const generator = generators[randInt(0, generators.length - 1)];
  return generator();
}
