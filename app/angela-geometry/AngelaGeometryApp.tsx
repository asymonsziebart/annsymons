"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkAnswer,
  generateCongruentSegments,
  generateLinearEquation,
  generateMidpointAlgebra,
  generateMidpointFormula,
  generateMidpointGraph,
  generateMixedProblem,
  generateSegmentAddition,
  generateSimplifyRadical,
  generateVocabulary,
  type Problem,
} from "./problemGenerators";

type Screen = "home" | "topic" | "mixed";
type TopicId =
  | "midpoint-formula"
  | "midpoint-graph"
  | "segment-addition"
  | "midpoint-algebra"
  | "linear-equations"
  | "congruent-segments"
  | "vocabulary"
  | "simplify-radicals";

type TopicInfo = {
  id: TopicId;
  title: string;
  description: string;
  color: string;
  generator: () => Problem;
};

const TOPICS: TopicInfo[] = [
  {
    id: "midpoint-formula",
    title: "Midpoint Formula",
    description: "Find midpoints from coordinates",
    color: "#3a86ff",
    generator: generateMidpointFormula,
  },
  {
    id: "midpoint-graph",
    title: "Midpoint from Graph",
    description: "Find midpoints on coordinate grids",
    color: "#8338ec",
    generator: generateMidpointGraph,
  },
  {
    id: "segment-addition",
    title: "Segment Addition",
    description: "Solve problems with segment parts",
    color: "#fb5607",
    generator: generateSegmentAddition,
  },
  {
    id: "midpoint-algebra",
    title: "Midpoint Algebra",
    description: "Solve for variables with midpoints",
    color: "#ff006e",
    generator: generateMidpointAlgebra,
  },
  {
    id: "linear-equations",
    title: "Linear Equations",
    description: "Multi-step equation solving",
    color: "#ffbe0b",
    generator: generateLinearEquation,
  },
  {
    id: "congruent-segments",
    title: "Congruent Segments",
    description: "Identify equal-length segments on grids",
    color: "#06a77d",
    generator: generateCongruentSegments,
  },
  {
    id: "vocabulary",
    title: "Points, Lines & Planes",
    description: "Geometry vocabulary and definitions",
    color: "#0582ca",
    generator: generateVocabulary,
  },
  {
    id: "simplify-radicals",
    title: "Simplify Radicals",
    description: "Simplify square root expressions",
    color: "#9d4edd",
    generator: generateSimplifyRadical,
  },
];

type Stats = {
  correct: number;
  incorrect: number;
  streak: number;
  bestStreak: number;
};

type LocalStats = {
  [key: string]: {
    bestScore: number;
    totalCorrect: number;
    totalAttempts: number;
  };
};

export default function AngelaGeometryApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [currentTopic, setCurrentTopic] = useState<TopicInfo | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [showSolution, setShowSolution] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats>({ correct: 0, incorrect: 0, streak: 0, bestStreak: 0 });
  const [mixedCount, setMixedCount] = useState(0);
  const [mixedTotal] = useState(15);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [plottedPoint, setPlottedPoint] = useState<{ x: number; y: number } | null>(null);

  // Load saved stats from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("angela-geometry-stats");
    if (saved) {
      try {
        const parsed: LocalStats = JSON.parse(saved);
        // Initialize global stats from saved data if needed
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const saveStats = useCallback((topicId: string, correct: boolean) => {
    const saved = localStorage.getItem("angela-geometry-stats");
    let stats: LocalStats = {};
    if (saved) {
      try {
        stats = JSON.parse(saved);
      } catch {
        stats = {};
      }
    }
    if (!stats[topicId]) {
      stats[topicId] = { bestScore: 0, totalCorrect: 0, totalAttempts: 0 };
    }
    stats[topicId].totalAttempts++;
    if (correct) {
      stats[topicId].totalCorrect++;
    }
    const score = Math.round((stats[topicId].totalCorrect / stats[topicId].totalAttempts) * 100);
    if (score > stats[topicId].bestScore) {
      stats[topicId].bestScore = score;
    }
    localStorage.setItem("angela-geometry-stats", JSON.stringify(stats));
  }, []);

  const loadProblem = useCallback((generator: () => Problem) => {
    const newProblem = generator();
    setProblem(newProblem);
    setUserAnswer("");
    setShowSolution(false);
    setShowHint(false);
    setIsCorrect(null);
    setPlottedPoint(null);
  }, []);

  const startTopic = useCallback(
    (topic: TopicInfo) => {
      setCurrentTopic(topic);
      setScreen("topic");
      setStats({ correct: 0, incorrect: 0, streak: 0, bestStreak: 0 });
      loadProblem(topic.generator);
    },
    [loadProblem]
  );

  const startMixed = useCallback(() => {
    setScreen("mixed");
    setMixedCount(1);
    setStats({ correct: 0, incorrect: 0, streak: 0, bestStreak: 0 });
    loadProblem(generateMixedProblem);
  }, [loadProblem]);

  const checkUserAnswer = useCallback(() => {
    if (!problem) return;
    
    let correct = false;
    
    if (problem.type === "plot-point" && problem.correctPoint && plottedPoint) {
      // Check if plotted point is within tolerance
      const tolerance = problem.tolerance || 0.5;
      const dx = Math.abs(plottedPoint.x - problem.correctPoint.x);
      const dy = Math.abs(plottedPoint.y - problem.correctPoint.y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      correct = distance <= tolerance;
    } else {
      correct = checkAnswer(userAnswer, problem.answer);
    }
    
    setIsCorrect(correct);
    setShowSolution(true);

    const topicId = currentTopic?.id || "mixed";
    saveStats(topicId, correct);

    if (correct) {
      setStats((prev) => {
        const newStreak = prev.streak + 1;
        return {
          ...prev,
          correct: prev.correct + 1,
          streak: newStreak,
          bestStreak: Math.max(prev.bestStreak, newStreak),
        };
      });
    } else {
      setStats((prev) => ({
        ...prev,
        incorrect: prev.incorrect + 1,
        streak: 0,
      }));
    }
  }, [problem, userAnswer, plottedPoint, currentTopic, saveStats]);

  const nextProblem = useCallback(() => {
    if (screen === "mixed") {
      if (mixedCount >= mixedTotal) {
        setScreen("home");
        return;
      }
      setMixedCount((prev) => prev + 1);
      loadProblem(generateMixedProblem);
    } else if (currentTopic) {
      loadProblem(currentTopic.generator);
    }
  }, [screen, mixedCount, mixedTotal, currentTopic, loadProblem]);

  const goHome = useCallback(() => {
    setScreen("home");
    setCurrentTopic(null);
    setProblem(null);
    setStats({ correct: 0, incorrect: 0, streak: 0, bestStreak: 0 });
    setMixedCount(0);
  }, []);

  // Handle canvas click/touch for plot-point problems
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (problem?.type !== "plot-point" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Get click/touch position
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Convert to canvas coordinates
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Convert to grid coordinates (-5 to 5 range)
    const width = rect.width;
    const height = rect.height;
    const scale = Math.min(width, height) / 12;
    const originX = width / 2;
    const originY = height / 2;

    const gridX = Math.round((x - originX) / scale);
    const gridY = Math.round((originY - y) / scale);

    // Clamp to grid bounds
    if (gridX < -5 || gridX > 5 || gridY < -5 || gridY > 5) return;

    setPlottedPoint({ x: gridX, y: gridY });
    setUserAnswer(`(${gridX}, ${gridY})`);
  }, [problem]);

  // Render canvas for graph problems
  useEffect(() => {
    if (problem?.renderGrid && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Get the display size
        const rect = canvas.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        
        // Handle high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        
        // Set actual size in memory (scaled for retina)
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        
        // Scale the context so we can draw in CSS pixels
        ctx.scale(dpr, dpr);
        
        // Render the grid
        problem.renderGrid(ctx);

        // Draw plotted point if exists
        if (plottedPoint && problem.type === "plot-point") {
          const width = canvas.width / dpr;
          const height = canvas.height / dpr;
          const scale = Math.min(width, height) / 12;
          const originX = width / 2;
          const originY = height / 2;
          const px = originX + plottedPoint.x * scale;
          const py = originY - plottedPoint.y * scale;

          // Draw the plotted point
          ctx.fillStyle = "#667eea";
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, 2 * Math.PI);
          ctx.fill();

          // Draw a ring around it
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, 2 * Math.PI);
          ctx.stroke();

          // Label
          ctx.fillStyle = "#1e3a5f";
          ctx.font = "bold 14px sans-serif";
          ctx.fillText(`(${plottedPoint.x}, ${plottedPoint.y})`, px + 12, py - 8);
        }
      }
    }
  }, [problem, plottedPoint]);

  // HOME SCREEN
  if (screen === "home") {
    return (
      <div className="geometry-app">
        <header className="geometry-header">
          <h1 className="geometry-title">Angela's Geometry Quest</h1>
          <p className="geometry-subtitle">Geometry Unit 1 Practice — Ace that retake! 🎯</p>
          <Link href="/" className="geometry-home-link">
            ← annsymons.com
          </Link>
        </header>

        <main className="geometry-main">
          <section className="geometry-topics">
            <h2 className="geometry-section-title">Choose a Topic</h2>
            <div className="geometry-grid">
              {TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  className="geometry-topic-card"
                  style={{ borderColor: topic.color }}
                  onClick={() => startTopic(topic)}
                >
                  <div className="geometry-topic-dot" style={{ backgroundColor: topic.color }} />
                  <h3 className="geometry-topic-title">{topic.title}</h3>
                  <p className="geometry-topic-desc">{topic.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="geometry-mixed-section">
            <div className="geometry-mixed-card">
              <h2 className="geometry-section-title">🎲 Mixed Practice</h2>
              <p className="geometry-mixed-desc">
                Test yourself with {mixedTotal} random questions from all topics!
              </p>
              <button className="geometry-btn geometry-btn-primary" onClick={startMixed}>
                Start Mixed Practice
              </button>
            </div>
          </section>
        </main>

        <footer className="geometry-footer">
          <p>
            Created with ❤️ for Angela. Keep practicing — you've got this!
          </p>
        </footer>
      </div>
    );
  }

  // PROBLEM SCREEN (topic or mixed)
  if (!problem) return null;

  const progressPercent =
    screen === "mixed" ? Math.round((mixedCount / mixedTotal) * 100) : undefined;
  const answered = isCorrect !== null;

  return (
    <div className="geometry-app">
      <header className="geometry-header geometry-header-compact">
        <button className="geometry-back-btn" onClick={goHome}>
          ← Back
        </button>
        <h1 className="geometry-title-compact">
          {screen === "mixed" ? "Mixed Practice" : currentTopic?.title}
        </h1>
        {screen === "mixed" && (
          <div className="geometry-progress-bar-container">
            <div
              className="geometry-progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
            <span className="geometry-progress-text">
              {mixedCount} / {mixedTotal}
            </span>
          </div>
        )}
      </header>

      <main className="geometry-problem-main">
        <div className="geometry-stats-bar">
          <div className="geometry-stat">
            <span className="geometry-stat-label">Correct</span>
            <span className="geometry-stat-value geometry-stat-correct">{stats.correct}</span>
          </div>
          <div className="geometry-stat">
            <span className="geometry-stat-label">Incorrect</span>
            <span className="geometry-stat-value geometry-stat-incorrect">{stats.incorrect}</span>
          </div>
          <div className="geometry-stat">
            <span className="geometry-stat-label">Streak</span>
            <span className="geometry-stat-value geometry-stat-streak">
              {stats.streak} {stats.streak >= 3 ? "🔥" : ""}
            </span>
          </div>
          <div className="geometry-stat">
            <span className="geometry-stat-label">Best Streak</span>
            <span className="geometry-stat-value">{stats.bestStreak}</span>
          </div>
        </div>

        <div className="geometry-problem-card">
          <div className="geometry-problem-topic">{problem.topic}</div>
          <div className="geometry-problem-question">{problem.question}</div>

          {problem.renderGrid && (
            <canvas
              ref={canvasRef}
              className="geometry-canvas"
              onClick={problem.type === "plot-point" ? handleCanvasClick : undefined}
              onTouchStart={problem.type === "plot-point" ? handleCanvasClick : undefined}
              style={problem.type === "plot-point" ? { cursor: "crosshair" } : undefined}
            />
          )}

          {!answered && (
            <>
              {problem.type === "input" ? (
                <input
                  type="text"
                  className="geometry-input"
                  placeholder="Your answer..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && checkUserAnswer()}
                  autoFocus
                />
              ) : problem.type === "multiple-choice" ? (
                <div className="geometry-choices">
                  {problem.choices?.map((choice, i) => (
                    <button
                      key={i}
                      className={`geometry-choice ${userAnswer === choice ? "geometry-choice-selected" : ""}`}
                      onClick={() => setUserAnswer(choice)}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : problem.type === "plot-point" ? (
                <div className="geometry-plot-instruction">
                  <div className="geometry-plot-icon">📍</div>
                  <div className="geometry-plot-text">
                    {plottedPoint ? (
                      <>
                        <strong>Point plotted:</strong> ({plottedPoint.x}, {plottedPoint.y})
                        <div className="geometry-plot-subtext">Tap again to adjust, or check your answer</div>
                      </>
                    ) : (
                      <>
                        <strong>Tap on the graph</strong> to plot your answer
                        <div className="geometry-plot-subtext">Tap the grid square where the midpoint should be</div>
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="geometry-actions">
                {!showHint && (
                  <button className="geometry-btn geometry-btn-hint" onClick={() => setShowHint(true)}>
                    💡 Hint
                  </button>
                )}
                <button
                  className="geometry-btn geometry-btn-primary"
                  onClick={checkUserAnswer}
                  disabled={problem.type === "plot-point" ? !plottedPoint : !userAnswer.trim()}
                >
                  Check Answer
                </button>
              </div>

              {showHint && (
                <div className="geometry-hint">
                  <strong>💡 Hint:</strong> {problem.hint}
                </div>
              )}
            </>
          )}

          {answered && (
            <>
              <div className={`geometry-feedback ${isCorrect ? "geometry-feedback-correct" : "geometry-feedback-incorrect"}`}>
                {isCorrect ? (
                  <>
                    <div className="geometry-feedback-icon">✓</div>
                    <div>
                      <div className="geometry-feedback-title">Correct!</div>
                      <div className="geometry-feedback-message">
                        {stats.streak >= 5
                          ? "You're on fire! 🔥"
                          : stats.streak >= 3
                            ? "Great job! Keep it up! 🎉"
                            : "Nice work! 👏"}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="geometry-feedback-icon">✗</div>
                    <div>
                      <div className="geometry-feedback-title">Not quite</div>
                      <div className="geometry-feedback-message">
                        Let's review the solution below. You'll get it next time! 💪
                      </div>
                    </div>
                  </>
                )}
              </div>

              {showSolution && (
                <div className="geometry-solution">
                  <div className="geometry-solution-title">📚 Step-by-Step Solution:</div>
                  <ol className="geometry-solution-steps">
                    {problem.solution.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              <button className="geometry-btn geometry-btn-primary geometry-btn-next" onClick={nextProblem}>
                {screen === "mixed" && mixedCount >= mixedTotal ? "Finish" : "Next Problem"} →
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
