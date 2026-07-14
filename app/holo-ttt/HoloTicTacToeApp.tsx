"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import * as THREE from "three";
import {
  bestAiMove,
  EMPTY_BOARD,
  getWinner,
  placeMove,
  winningLine,
  type Board,
} from "./gameLogic";

type Phase = "boot" | "ready" | "starting" | "live" | "error";
type DisplayMode = "flat" | "pyramid";

const MEDIAPIPE_VERSION = "0.10.35";
const WASM_URLS = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
  `https://unpkg.com/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
] as const;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const PINCH_ON = 0.055;
const PINCH_OFF = 0.08;
const CELL_STEP = 1.15;

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}

function pinchDistance(landmarks: { x: number; y: number }[]): number {
  const a = landmarks[4];
  const b = landmarks[8];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function createHandLandmarker(): Promise<HandLandmarker> {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  let lastError: unknown;
  const optionsBase = {
    runningMode: "VIDEO" as const,
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.45,
  };

  for (const wasmUrl of WASM_URLS) {
    try {
      const vision = await FilesetResolver.forVisionTasks(wasmUrl);
      try {
        return await HandLandmarker.createFromOptions(vision, {
          ...optionsBase,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        });
      } catch {
        return await HandLandmarker.createFromOptions(vision, {
          ...optionsBase,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        });
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not load hand tracking.");
}

type SceneBundle = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  boardRoot: THREE.Group;
  cellMeshes: THREE.Mesh[];
  pieceGroup: THREE.Group;
  hoverMesh: THREE.Mesh;
  winLine: THREE.Mesh;
  raycaster: THREE.Raycaster;
};

function cellLocalPosition(index: number): THREE.Vector3 {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return new THREE.Vector3((col - 1) * CELL_STEP, (1 - row) * CELL_STEP, 0.04);
}

function makeGridMaterial(color: number, opacity = 0.9) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.85,
    metalness: 0.2,
    roughness: 0.35,
    transparent: true,
    opacity,
  });
}

function buildScene(host: HTMLDivElement): SceneBundle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020308, 0.045);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.15, 6.2);

  const amb = new THREE.AmbientLight(0x6a7cff, 0.55);
  const key = new THREE.PointLight(0x5ce1ff, 2.2, 20);
  key.position.set(2, 3, 4);
  const fill = new THREE.PointLight(0xff7ad9, 1.4, 20);
  fill.position.set(-3, -1, 3);
  scene.add(amb, key, fill);

  const boardRoot = new THREE.Group();
  boardRoot.rotation.x = -0.42;
  scene.add(boardRoot);

  // Soft platform glow.
  const platform = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 64),
    new THREE.MeshBasicMaterial({
      color: 0x102038,
      transparent: true,
      opacity: 0.55,
    })
  );
  platform.position.z = -0.08;
  boardRoot.add(platform);

  const frameMat = makeGridMaterial(0x5ce1ff, 0.95);
  const bars: THREE.Mesh[] = [];
  for (const x of [-CELL_STEP / 2, CELL_STEP / 2]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.07, CELL_STEP * 3.05, 0.07), frameMat);
    v.position.set(x, 0, 0);
    bars.push(v);
  }
  for (const y of [-CELL_STEP / 2, CELL_STEP / 2]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(CELL_STEP * 3.05, 0.07, 0.07), frameMat.clone());
    h.position.set(0, y, 0);
    bars.push(h);
  }
  for (const b of bars) boardRoot.add(b);

  const cellMeshes: THREE.Mesh[] = [];
  const cellGeo = new THREE.PlaneGeometry(CELL_STEP * 0.92, CELL_STEP * 0.92);
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.001,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(cellGeo, mat);
    mesh.position.copy(cellLocalPosition(i));
    mesh.userData.index = i;
    boardRoot.add(mesh);
    cellMeshes.push(mesh);
  }

  const hoverMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CELL_STEP * 0.88, CELL_STEP * 0.88),
    new THREE.MeshBasicMaterial({
      color: 0x5ce1ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  hoverMesh.visible = false;
  hoverMesh.position.z = 0.02;
  boardRoot.add(hoverMesh);

  const winLine = new THREE.Mesh(
    new THREE.BoxGeometry(CELL_STEP * 3.1, 0.08, 0.08),
    makeGridMaterial(0xffe08a, 1)
  );
  winLine.visible = false;
  winLine.position.z = 0.12;
  boardRoot.add(winLine);

  const pieceGroup = new THREE.Group();
  boardRoot.add(pieceGroup);

  return {
    renderer,
    scene,
    camera,
    boardRoot,
    cellMeshes,
    pieceGroup,
    hoverMesh,
    winLine,
    raycaster: new THREE.Raycaster(),
  };
}

function makeXPiece(): THREE.Group {
  const g = new THREE.Group();
  const mat = makeGridMaterial(0x5ce1ff, 1);
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.12), mat);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.12), mat.clone());
  a.rotation.z = Math.PI / 4;
  b.rotation.z = -Math.PI / 4;
  g.add(a, b);
  g.position.z = 0.16;
  return g;
}

function makeOPiece(): THREE.Group {
  const g = new THREE.Group();
  const mat = makeGridMaterial(0xff7ad9, 1);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 16, 40), mat);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 20, 20),
    new THREE.MeshStandardMaterial({
      color: 0xffd0f2,
      emissive: 0xff7ad9,
      emissiveIntensity: 1.2,
    })
  );
  g.add(ring, core);
  g.position.z = 0.16;
  return g;
}

function syncPieces(pieceGroup: THREE.Group, board: Board) {
  while (pieceGroup.children.length) {
    const child = pieceGroup.children[0];
    pieceGroup.remove(child);
    child.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
      else if (mesh.material) (mesh.material as THREE.Material).dispose();
    });
  }
  board.forEach((cell, i) => {
    if (!cell) return;
    const piece = cell === "X" ? makeXPiece() : makeOPiece();
    piece.position.copy(cellLocalPosition(i));
    pieceGroup.add(piece);
  });
}

function updateWinLine(winLine: THREE.Mesh, board: Board) {
  const line = winningLine(board);
  if (!line) {
    winLine.visible = false;
    return;
  }
  const a = cellLocalPosition(line[0]);
  const c = cellLocalPosition(line[2]);
  const mid = a.clone().add(c).multiplyScalar(0.5);
  winLine.position.set(mid.x, mid.y, 0.12);
  const angle = Math.atan2(c.y - a.y, c.x - a.x);
  winLine.rotation.z = angle;
  winLine.visible = true;
}

function bannerFor(board: Board, turn: "X" | "O", vsAi: boolean): string {
  const w = getWinner(board);
  if (w === "draw") return "Draw game";
  if (w === "X") return vsAi ? "You win" : "X wins";
  if (w === "O") return vsAi ? "Computer wins" : "O wins";
  if (vsAi) return turn === "X" ? "Your move — pinch to place" : "Computer is thinking…";
  return `${turn}'s turn — pinch to place`;
}

export default function HoloTicTacToeApp() {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneBundle | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const runningRef = useRef(false);
  const pinchLatchedRef = useRef(false);
  const boardRef = useRef<Board>(EMPTY_BOARD.slice() as Board);
  const turnRef = useRef<"X" | "O">("X");
  const vsAiRef = useRef(true);
  const displayModeRef = useRef<DisplayMode>("flat");
  const hoverIndexRef = useRef<number | null>(null);
  const aiTimerRef = useRef<number | null>(null);
  const pointerNdcRef = useRef(new THREE.Vector2(0, 0));
  const tryPlaceRef = useRef<(index: number) => void>(() => {});

  const [phase, setPhase] = useState<Phase>("boot");
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("flat");
  const [vsAi, setVsAi] = useState(true);
  const [board, setBoard] = useState<Board>(EMPTY_BOARD.slice() as Board);
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [status, setStatus] = useState("Loading tracker…");

  displayModeRef.current = displayMode;
  vsAiRef.current = vsAi;
  boardRef.current = board;
  turnRef.current = turn;

  const banner = useMemo(() => bannerFor(board, turn, vsAi), [board, turn, vsAi]);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    pinchLatchedRef.current = false;
    hoverIndexRef.current = null;
    cursorRef.current?.classList.remove("holo-ttt__cursor--visible", "holo-ttt__cursor--pinch");
    const bundle = sceneRef.current;
    if (bundle) bundle.hoverMesh.visible = false;
  }, []);

  const resizeRenderer = useCallback(() => {
    const bundle = sceneRef.current;
    const host = hostRef.current;
    if (!bundle || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    bundle.renderer.setSize(w, h, false);
    bundle.camera.aspect = w / Math.max(1, h);
    bundle.camera.updateProjectionMatrix();
  }, []);

  const applyBoardVisuals = useCallback((next: Board) => {
    const bundle = sceneRef.current;
    if (!bundle) return;
    syncPieces(bundle.pieceGroup, next);
    updateWinLine(bundle.winLine, next);
  }, []);

  const scheduleAi = useCallback(() => {
    if (aiTimerRef.current != null) window.clearTimeout(aiTimerRef.current);
    aiTimerRef.current = window.setTimeout(() => {
      aiTimerRef.current = null;
      if (!vsAiRef.current) return;
      if (turnRef.current !== "O") return;
      if (getWinner(boardRef.current)) return;
      const idx = bestAiMove(boardRef.current, "O");
      const next = placeMove(boardRef.current, idx, "O");
      if (!next) return;
      boardRef.current = next;
      setBoard(next);
      applyBoardVisuals(next);
      const w = getWinner(next);
      if (!w) {
        turnRef.current = "X";
        setTurn("X");
      }
    }, 520);
  }, [applyBoardVisuals]);

  const tryPlace = useCallback(
    (index: number) => {
      if (getWinner(boardRef.current)) return;
      const mark = turnRef.current;
      if (vsAiRef.current && mark !== "X") return;
      const next = placeMove(boardRef.current, index, mark);
      if (!next) return;
      boardRef.current = next;
      setBoard(next);
      applyBoardVisuals(next);
      const w = getWinner(next);
      if (w) return;
      const nextTurn: "X" | "O" = mark === "X" ? "O" : "X";
      turnRef.current = nextTurn;
      setTurn(nextTurn);
      if (vsAiRef.current && nextTurn === "O") scheduleAi();
    },
    [applyBoardVisuals, scheduleAi]
  );
  tryPlaceRef.current = tryPlace;

  const resetGame = useCallback(() => {
    if (aiTimerRef.current != null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    const empty = EMPTY_BOARD.slice() as Board;
    boardRef.current = empty;
    turnRef.current = "X";
    setBoard(empty);
    setTurn("X");
    applyBoardVisuals(empty);
    hoverIndexRef.current = null;
  }, [applyBoardVisuals]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const bundle = buildScene(host);
    sceneRef.current = bundle;
    resizeRenderer();

    let cancelled = false;
    async function initModel() {
      try {
        const landmarker = await createHandLandmarker();
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setPhase("ready");
        setStatus("Ready — start camera");
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(errorMessage(e, "Could not load hand tracking."));
        setStatus("Tracker error");
      }
    }
    void initModel();

    const onResize = () => resizeRenderer();
    window.addEventListener("resize", onResize);

    const onPointer = (e: PointerEvent) => {
      const b = sceneRef.current;
      const host = hostRef.current;
      if (!b || !host || !runningRef.current) return;
      const rect = host.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(1, rect.width);
      const y = (e.clientY - rect.top) / Math.max(1, rect.height);
      let hover: number | null = null;
      if (displayModeRef.current === "pyramid") {
        const arm = Math.min(rect.width, rect.height) * 0.38;
        const gap = arm * 0.06;
        const panelX = rect.width / 2 - arm / 2;
        const panelYCss = rect.height / 2 + gap / 2;
        const localX = (e.clientX - rect.left - panelX) / arm;
        const localY = (e.clientY - rect.top - panelYCss) / arm;
        if (localX >= 0 && localX <= 1 && localY >= 0 && localY <= 1) {
          pointerNdcRef.current.set(localX * 2 - 1, -(localY * 2 - 1));
          b.raycaster.setFromCamera(pointerNdcRef.current, b.camera);
          const hits = b.raycaster.intersectObjects(b.cellMeshes, false);
          hover = hits.length ? Number(hits[0].object.userData.index) : null;
        }
      } else {
        pointerNdcRef.current.set(x * 2 - 1, -(y * 2 - 1));
        b.raycaster.setFromCamera(pointerNdcRef.current, b.camera);
        const hits = b.raycaster.intersectObjects(b.cellMeshes, false);
        hover = hits.length ? Number(hits[0].object.userData.index) : null;
      }
      if (hover != null) tryPlaceRef.current(hover);
    };
    bundle.renderer.domElement.addEventListener("pointerdown", onPointer);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      bundle.renderer.domElement.removeEventListener("pointerdown", onPointer);
      stopCamera();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      if (aiTimerRef.current != null) window.clearTimeout(aiTimerRef.current);
      const b = sceneRef.current;
      if (b) {
        b.renderer.dispose();
        b.renderer.domElement.remove();
      }
      sceneRef.current = null;
    };
  }, [resizeRenderer, stopCamera]);

  const pickCell = useCallback((ndcX: number, ndcY: number): number | null => {
    const bundle = sceneRef.current;
    if (!bundle) return null;
    pointerNdcRef.current.set(ndcX, ndcY);
    bundle.raycaster.setFromCamera(pointerNdcRef.current, bundle.camera);
    // Temporarily clear board rotation used for pyramid panels.
    const hits = bundle.raycaster.intersectObjects(bundle.cellMeshes, false);
    if (!hits.length) return null;
    const idx = Number(hits[0].object.userData.index);
    return Number.isInteger(idx) ? idx : null;
  }, []);

  const renderFrame = useCallback((t: number) => {
    const bundle = sceneRef.current;
    if (!bundle) return;
    const { renderer, scene, camera, boardRoot } = bundle;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;

    // Idle float.
    boardRoot.position.y = Math.sin(t * 0.0012) * 0.08;
    boardRoot.rotation.x = -0.42 + Math.sin(t * 0.0007) * 0.03;

    if (displayModeRef.current === "flat") {
      boardRoot.rotation.z = 0;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      renderer.render(scene, camera);
      return;
    }

    // Pepper's Ghost plus layout — black center for the pyramid base.
    const arm = Math.min(w, h) * 0.38;
    const gap = arm * 0.06;
    const cx = w / 2;
    const cy = h / 2;
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.setScissorTest(true);

    const panels: { x: number; y: number; rot: number }[] = [
      { x: cx - arm / 2, y: cy + gap / 2, rot: Math.PI }, // top (from bottom origin)
      { x: cx - arm / 2, y: cy - arm - gap / 2, rot: 0 }, // bottom (user-facing)
      { x: cx - arm - gap / 2, y: cy - arm / 2, rot: Math.PI / 2 }, // left
      { x: cx + gap / 2, y: cy - arm / 2, rot: -Math.PI / 2 }, // right
    ];

    for (const panel of panels) {
      boardRoot.rotation.z = panel.rot;
      renderer.setViewport(panel.x, panel.y, arm, arm);
      renderer.setScissor(panel.x, panel.y, arm, arm);
      renderer.render(scene, camera);
    }
    boardRoot.rotation.z = 0;
    renderer.setScissorTest(false);
  }, []);

  const loop = useCallback(() => {
    const now = performance.now();
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const bundle = sceneRef.current;
    const cursor = cursorRef.current;

    if (runningRef.current && video && landmarker && bundle && video.readyState >= 2) {
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        const result = landmarker.detectForVideo(video, now);
        const hand = result.landmarks[0];

        if (hand) {
          const tipX = 1 - hand[8].x;
          const tipY = hand[8].y;
          const host = hostRef.current;
          const w = host?.clientWidth ?? 1;
          const h = host?.clientHeight ?? 1;
          const cssX = tipX * w;
          const cssY = tipY * h;
          const dist = pinchDistance(hand);
          const pinching = dist < PINCH_ON;

          if (cursor) {
            cursor.style.transform = `translate3d(${cssX}px, ${cssY}px, 0) scale(${pinching ? 1.35 : 1})`;
            cursor.classList.add("holo-ttt__cursor--visible");
            cursor.classList.toggle("holo-ttt__cursor--pinch", pinching);
          }

          let hover: number | null = null;
          if (displayModeRef.current === "pyramid") {
            const arm = Math.min(w, h) * 0.38;
            const gap = arm * 0.06;
            const panelX = w / 2 - arm / 2;
            const panelYCss = h / 2 + gap / 2;
            const localX = (cssX - panelX) / arm;
            const localY = (cssY - panelYCss) / arm;
            if (localX >= 0 && localX <= 1 && localY >= 0 && localY <= 1) {
              hover = pickCell(localX * 2 - 1, -(localY * 2 - 1));
            }
          } else {
            hover = pickCell(tipX * 2 - 1, -(tipY * 2 - 1));
          }

          hoverIndexRef.current = hover;
          if (hover == null || boardRef.current[hover] != null || getWinner(boardRef.current)) {
            bundle.hoverMesh.visible = false;
          } else {
            bundle.hoverMesh.visible = true;
            bundle.hoverMesh.position.copy(cellLocalPosition(hover));
            bundle.hoverMesh.position.z = 0.03;
          }

          if (pinching) {
            if (!pinchLatchedRef.current) {
              pinchLatchedRef.current = true;
              if (hover != null) tryPlace(hover);
            }
          } else if (dist > PINCH_OFF) {
            pinchLatchedRef.current = false;
          }
        } else {
          cursor?.classList.remove("holo-ttt__cursor--visible", "holo-ttt__cursor--pinch");
          hoverIndexRef.current = null;
          bundle.hoverMesh.visible = false;
          pinchLatchedRef.current = false;
        }
      }
    }

    renderFrame(now);
    rafRef.current = requestAnimationFrame(loop);
  }, [pickCell, renderFrame, tryPlace]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [loop]);

  const startCamera = useCallback(async () => {
    if (!landmarkerRef.current) return;
    setPhase("starting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element missing.");
      video.srcObject = stream;
      await video.play();
      resizeRenderer();
      runningRef.current = true;
      setPhase("live");
      setStatus("Listening for pinch");
    } catch (e) {
      stopCamera();
      setPhase("error");
      setError(
        e instanceof Error
          ? e.message
          : "Camera permission was denied. Allow the camera and try again."
      );
      setStatus("Camera error");
    }
  }, [resizeRenderer, stopCamera]);

  const phaseLive = phase === "live";

  return (
    <div className="holo-ttt">
      <header className="holo-ttt__top">
        <div className="holo-ttt__brand">
          <h1 className="holo-ttt__title">Hologram Tic-Tac-Toe</h1>
          <Link href="/" className="holo-ttt__home">
            annsymons.com
          </Link>
        </div>
        <div className="holo-ttt__controls">
          <button
            type="button"
            className={`holo-ttt__btn${displayMode === "flat" ? " holo-ttt__btn--active" : ""}`}
            onClick={() => setDisplayMode("flat")}
          >
            Flat
          </button>
          <button
            type="button"
            className={`holo-ttt__btn${displayMode === "pyramid" ? " holo-ttt__btn--active" : ""}`}
            onClick={() => setDisplayMode("pyramid")}
          >
            Pyramid
          </button>
          <button
            type="button"
            className={`holo-ttt__btn${vsAi ? " holo-ttt__btn--active" : ""}`}
            onClick={() => {
              setVsAi(true);
              vsAiRef.current = true;
              resetGame();
            }}
          >
            vs Computer
          </button>
          <button
            type="button"
            className={`holo-ttt__btn${!vsAi ? " holo-ttt__btn--active" : ""}`}
            onClick={() => {
              setVsAi(false);
              vsAiRef.current = false;
              resetGame();
            }}
          >
            2 Players
          </button>
          <button type="button" className="holo-ttt__btn" onClick={resetGame}>
            New game
          </button>
        </div>
      </header>

      <div className="holo-ttt__stage">
        <div ref={hostRef} className="holo-ttt__canvas-host" />
        <video
          ref={videoRef}
          className={`holo-ttt__video${displayMode === "pyramid" ? " holo-ttt__video--hidden" : ""}`}
          playsInline
          muted
        />
        <div ref={cursorRef} className="holo-ttt__cursor" aria-hidden="true" />

        <div className="holo-ttt__hud">
          <div className={`holo-ttt__status${phaseLive ? " holo-ttt__status--live" : ""}`}>
            {status}
          </div>
          <p className="holo-ttt__banner">{banner}</p>
          <p className="holo-ttt__hint">
            Point at a square · pinch thumb + index to place · you are X (cyan)
          </p>
        </div>

        {phase !== "live" ? (
          <div className="holo-ttt__overlay">
            <div className="holo-ttt__card">
              <h2>Floating tic-tac-toe</h2>
              <p>
                Point with your finger and pinch to drop glowing pieces. Use{" "}
                <strong>Pyramid</strong> mode with a cheap acrylic hologram pyramid on the screen —
                or play flat on a laptop. Camera stays on this device.
              </p>
              {error ? <p style={{ color: "#ff7ad9" }}>{error}</p> : null}
              <div className="holo-ttt__card-actions">
                <button
                  type="button"
                  className="holo-ttt__btn holo-ttt__btn--primary"
                  onClick={() => void startCamera()}
                  disabled={phase === "boot" || phase === "starting"}
                >
                  {phase === "boot"
                    ? "Loading tracker…"
                    : phase === "starting"
                      ? "Starting camera…"
                      : phase === "error"
                        ? "Try again"
                        : "Start camera"}
                </button>
                <Link href="/" className="holo-ttt__btn">
                  Back home
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="holo-ttt__footer">
        <p>
          Pyramid tip: place the acrylic pyramid in the black center of the cross. Sit back and look
          into a face — the board floats above the screen.
        </p>
        <p>X cyan · O pink dots · Space? Use New game</p>
      </footer>
    </div>
  );
}
