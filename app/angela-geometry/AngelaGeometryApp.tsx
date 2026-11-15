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
    const correct = checkAnswer(userAnswer, problem.answer);
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
  }, [problem, userAnswer, currentTopic, saveStats]);

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
        
        // Now the render function can use displayWidth/displayHeight or canvas.width/height divided by dpr
        problem.renderGrid(ctx);
      }
    }
  }, [problem]);

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
              ) : (
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
              )}

              <div className="geometry-actions">
                {!showHint && (
                  <button className="geometry-btn geometry-btn-hint" onClick={() => setShowHint(true)}>
                    💡 Hint
                  </button>
                )}
                <button
                  className="geometry-btn geometry-btn-primary"
                  onClick={checkUserAnswer}
                  disabled={!userAnswer.trim()}
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
