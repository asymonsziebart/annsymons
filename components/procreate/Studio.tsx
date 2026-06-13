"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ArtworkDocument,
  BlendMode,
  BrushDef,
  ColorTab,
  Layer,
  Point,
  StudioPrefs,
  Tool,
} from "@/lib/procreate/types";
import { findBrush } from "@/lib/procreate/brushes";
import {
  getAllBrushes,
  preloadBrushTip,
} from "@/lib/procreate/brushLibrary";
import {
  captureLayerState,
  cloneImageData,
  compositeLayers,
  fillLayer,
  importImageToLayer,
  restoreLayerState,
  StrokeEngine,
} from "@/lib/procreate/canvasEngine";
import {
  buildFillReference,
  floodFillAt,
  thresholdFromDragDistance,
  thresholdPreviewRadius,
} from "@/lib/procreate/floodFill";
import { sampleColorFromCanvas } from "@/lib/procreate/colorUtils";
import {
  canvasToDataUrl,
  createLayerCanvas,
  dataUrlToImage,
  generateId,
  loadArtwork,
  makeThumbnail,
  saveArtwork,
} from "@/lib/procreate/storage";
import BrushPanel from "./BrushPanel";
import {
  ColorPanel,
  LayersPanel,
} from "./panels";
import {
  IconActions,
  IconAdjust,
  IconBrush,
  IconColor,
  IconErase,
  IconEyedropper,
  IconGallery,
  IconLayers,
  IconRedo,
  IconSelect,
  IconSmudge,
  IconTransform,
  IconUndo,
} from "./icons";
import { tipProps } from "./tip";

type Props = {
  artworkId: string;
  onBack: () => void;
};

type Panel = "brush" | "layers" | "color" | "actions" | null;

type HistoryState = {
  layerId: string;
  before: ImageData;
};

const MAX_UNDO = 100;

export default function Studio({ artworkId, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewCanvasRef = useRef<HTMLCanvasElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const strokeEngine = useRef(new StrokeEngine());

  const [doc, setDoc] = useState<ArtworkDocument | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState("");
  const [tool, setTool] = useState<Tool>("paint");
  const [brush, setBrush] = useState<BrushDef>(findBrush("6b-pencil"));
  const [allBrushes, setAllBrushes] = useState<BrushDef[]>([]);
  const [color, setColor] = useState("#1a1a1a");
  const [prevColor, setPrevColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(1);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [panel, setPanel] = useState<Panel>(null);
  const [colorTab, setColorTab] = useState<ColorTab>("disc");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const [isDrawing, setIsDrawing] = useState(false);
  const [eyedropper, setEyedropper] = useState(false);
  const [prefs, setPrefs] = useState<StudioPrefs>({
    lightInterface: false,
    rightHanded: false,
    brushCursor: true,
    showInterface: true,
    colorDropThreshold: 0.18,
    colorDropReference: true,
  });
  const [colorDropActive, setColorDropActive] = useState(false);
  const [colorDropPos, setColorDropPos] = useState<{ x: number; y: number } | null>(null);
  const [fillThresholdLive, setFillThresholdLive] = useState(0.18);
  const [transformMode, setTransformMode] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [saveLabel, setSaveLabel] = useState("Saved");

  const undoStack = useRef<HistoryState[]>([]);
  const redoStack = useRef<HistoryState[]>([]);
  const strokeStart = useRef<HistoryState | null>(null);
  const lastPointer = useRef<Point | null>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const compositeRef = useRef<HTMLCanvasElement | null>(null);
  const colorDropStart = useRef<{ x: number; y: number } | null>(null);
  const colorDropActiveRef = useRef(false);
  const fillThresholdLiveRef = useRef(0.18);
  const docRef = useRef(doc);
  const layersRef = useRef(layers);
  const activeLayerIdRef = useRef(activeLayerId);
  const prefsRef = useRef(prefs);
  const colorRef = useRef(color);

  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
  }, [pan, zoom]);

  useEffect(() => {
    docRef.current = doc;
    layersRef.current = layers;
    activeLayerIdRef.current = activeLayerId;
    prefsRef.current = prefs;
    colorRef.current = color;
  }, [doc, layers, activeLayerId, prefs, color]);

  useEffect(() => {
    colorDropActiveRef.current = colorDropActive;
    fillThresholdLiveRef.current = fillThresholdLive;
  }, [colorDropActive, fillThresholdLive]);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  const loadDocument = useCallback(async () => {
    const saved = await loadArtwork(artworkId);
    if (!saved) return;

    const loadedLayers: Layer[] = await Promise.all(
      saved.layers.map(async (sl) => {
        const canvas = createLayerCanvas(saved.width, saved.height);
        const ctx = canvas.getContext("2d");
        if (ctx && sl.imageData) {
          const img = await dataUrlToImage(sl.imageData);
          ctx.drawImage(img, 0, 0);
        }
        return {
          id: sl.id,
          name: sl.name,
          visible: sl.visible,
          opacity: sl.opacity,
          blendMode: sl.blendMode,
          locked: sl.locked,
          canvas,
        };
      }),
    );

    if (loadedLayers.length === 0) {
      const canvas = createLayerCanvas(saved.width, saved.height);
      loadedLayers.push({
        id: generateId(),
        name: "Layer 1",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        locked: false,
        canvas,
      });
    }

    setDoc(saved);
    setLayers(loadedLayers);
    setActiveLayerId(loadedLayers[loadedLayers.length - 1].id);
    undoStack.current = [];
    redoStack.current = [];
  }, [artworkId]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    void getAllBrushes().then(setAllBrushes);
  }, []);

  useEffect(() => {
    void preloadBrushTip(brush);
  }, [brush]);

  const renderView = useCallback(() => {
    if (!doc || !viewCanvasRef.current || !containerRef.current) return;
    const view = viewCanvasRef.current;
    const container = containerRef.current;
    const dpr = window.devicePixelRatio || 1;

    view.width = Math.floor(container.clientWidth * dpr);
    view.height = Math.floor(container.clientHeight * dpr);
    view.style.width = `${container.clientWidth}px`;
    view.style.height = `${container.clientHeight}px`;

    const ctx = view.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, container.clientWidth, container.clientHeight);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    ctx.fillStyle = doc.backgroundColor;
    ctx.fillRect(0, 0, doc.width, doc.height);

    compositeRef.current = compositeLayers(layers, doc.width, doc.height, doc.backgroundColor);
    ctx.drawImage(compositeRef.current, 0, 0);

    if (transformMode && activeLayer) {
      ctx.strokeStyle = "#007aff";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeRect(0, 0, doc.width, doc.height);
      ctx.setLineDash([]);
    }

    ctx.restore();

    if (prefs.brushCursor && cursor && !eyedropper && !colorDropActive) {
      const cx = (cursor.x - pan.x) / zoom;
      const cy = (cursor.y - pan.y) / zoom;
      const screenX = pan.x + cx * zoom;
      const screenY = pan.y + cy * zoom;
      const r = (brush.size * brushSize * 0.5) * zoom;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    if (colorDropActive && colorDropPos && doc) {
      const rect = view.getBoundingClientRect();
      const cx = (colorDropPos.x - rect.left - pan.x) / zoom;
      const cy = (colorDropPos.y - rect.top - pan.y) / zoom;
      if (cx >= 0 && cy >= 0 && cx <= doc.width && cy <= doc.height) {
        const r = thresholdPreviewRadius(fillThresholdLive, doc.width) * zoom;
        const screenX = pan.x + cx * zoom;
        const screenY = pan.y + cy * zoom;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }, [doc, layers, zoom, pan, prefs.brushCursor, cursor, brush, brushSize, transformMode, activeLayer, eyedropper, colorDropActive, colorDropPos, fillThresholdLive, color]);

  function performColorDrop(clientX: number, clientY: number, threshold: number) {
    const currentDoc = docRef.current;
    const currentLayers = layersRef.current;
    const layerId = activeLayerIdRef.current;
    const active = currentLayers.find((l) => l.id === layerId);
    if (!currentDoc || !active || active.locked) return;

    const pt = screenToCanvas(clientX, clientY);
    if (!pt) return;

    const before = captureLayerState(active);
    if (!before) return;

    const reference = buildFillReference(
      currentLayers,
      currentDoc.width,
      currentDoc.height,
      currentDoc.backgroundColor,
      prefsRef.current.colorDropReference,
      layerId,
    );

    const result = floodFillAt(active, pt.x, pt.y, colorRef.current, reference, threshold);
    if (result.filled) {
      pushUndo({ layerId: active.id, before: cloneImageData(before) });
      setLayers([...currentLayers]);
    }
  }

  function handleColorPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    colorDropStart.current = { x: startX, y: startY };

    let dropStarted = false;

    const beginDrop = (x: number, y: number) => {
      if (dropStarted) return;
      dropStarted = true;
      colorDropActiveRef.current = true;
      fillThresholdLiveRef.current = prefsRef.current.colorDropThreshold;
      setColorDropActive(true);
      setFillThresholdLive(prefsRef.current.colorDropThreshold);
      setColorDropPos({ x, y });
    };

    let holdTimer: number | null = window.setTimeout(() => {
      holdTimer = null;
      beginDrop(startX, startY);
    }, 280);

    const cleanup = () => {
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
        holdTimer = null;
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);

      if (!dropStarted && dist > 6) {
        if (holdTimer !== null) {
          window.clearTimeout(holdTimer);
          holdTimer = null;
        }
        beginDrop(ev.clientX, ev.clientY);
      }

      if (!colorDropActiveRef.current) return;

      setColorDropPos({ x: ev.clientX, y: ev.clientY });
      const th = thresholdFromDragDistance(dist, prefsRef.current.colorDropThreshold);
      fillThresholdLiveRef.current = th;
      setFillThresholdLive(th);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();

      if (colorDropActiveRef.current) {
        performColorDrop(ev.clientX, ev.clientY, fillThresholdLiveRef.current);
        colorDropActiveRef.current = false;
        setColorDropActive(false);
        setColorDropPos(null);
        colorDropStart.current = null;
        return;
      }

      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) {
        setPanel((p) => (p === "color" ? null : "color"));
      }
      colorDropStart.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  useEffect(() => {
    renderView();
  }, [renderView]);

  useEffect(() => {
    const onResize = () => renderView();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [renderView]);

  const persist = useCallback(async () => {
    if (!doc) return;
    const composite = compositeLayers(layers, doc.width, doc.height, doc.backgroundColor);
    const updated: ArtworkDocument = {
      ...doc,
      modifiedAt: Date.now(),
      thumbnail: makeThumbnail(composite),
      layers: layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode,
        locked: l.locked,
        imageData: canvasToDataUrl(l.canvas),
      })),
    };
    await saveArtwork(updated);
    setDoc(updated);
    setSaveLabel("Saved");
  }, [doc, layers]);

  useEffect(() => {
    if (!doc || layers.length === 0) return;
    setSaveLabel("Saving…");
    const t = window.setTimeout(() => void persist(), 800);
    return () => window.clearTimeout(t);
  }, [layers, doc?.name, persist, doc]);

  function screenToCanvas(clientX: number, clientY: number): Point | null {
    const view = viewCanvasRef.current;
    if (!view) return null;
    const rect = view.getBoundingClientRect();
    const x = (clientX - rect.left - panRef.current.x) / zoomRef.current;
    const y = (clientY - rect.top - panRef.current.y) / zoomRef.current;
    return { x, y, pressure: 0.5 };
  }

  function pushUndo(entry: HistoryState) {
    undoStack.current.push(entry);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
  }

  function undo() {
    const entry = undoStack.current.pop();
    if (!entry) return;
    const layer = layers.find((l) => l.id === entry.layerId);
    if (!layer) return;
    const current = captureLayerState(layer);
    if (current) redoStack.current.push({ layerId: entry.layerId, before: cloneImageData(current) });
    restoreLayerState(layer, entry.before);
    setLayers([...layers]);
  }

  function redo() {
    const entry = redoStack.current.pop();
    if (!entry) return;
    const layer = layers.find((l) => l.id === entry.layerId);
    if (!layer) return;
    const current = captureLayerState(layer);
    if (current) undoStack.current.push({ layerId: entry.layerId, before: cloneImageData(current) });
    restoreLayerState(layer, entry.before);
    setLayers([...layers]);
  }

  function pointerToPoint(e: PointerEvent): Point | null {
    const pt = screenToCanvas(e.clientX, e.clientY);
    if (!pt) return null;
    pt.pressure = e.pressure > 0 ? e.pressure : 0.5;
    return pt;
  }

  function drawSegmentTo(ctx: CanvasRenderingContext2D, to: Point) {
    if (!lastPointer.current || !activeLayer) return;
    strokeEngine.current.paintStroke(
      ctx,
      lastPointer.current,
      to,
      brush,
      color,
      tool,
      brushSize,
      brushOpacity,
      compositeRef.current ?? undefined,
    );
    lastPointer.current = to;
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!doc || !activeLayer || activeLayer.locked) return;
    if (colorDropActiveRef.current) return;

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    if (eyedropper) {
      const pt = screenToCanvas(e.clientX, e.clientY);
      if (pt && compositeRef.current) {
        const picked = sampleColorFromCanvas(compositeRef.current, pt.x, pt.y);
        if (picked) {
          setPrevColor(color);
          setColor(picked);
        }
      }
      setEyedropper(false);
      return;
    }

    if (transformMode) return;

    const pt = screenToCanvas(e.clientX, e.clientY);
    if (!pt) return;

    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    pt.pressure = pressure;

    const before = captureLayerState(activeLayer);
    if (before) strokeStart.current = { layerId: activeLayer.id, before: cloneImageData(before) };

    setIsDrawing(true);
    lastPointer.current = pt;
    strokeEngine.current.reset();

    const ctx = activeLayer.canvas.getContext("2d");
    if (!ctx) return;
    strokeEngine.current.paintStroke(
      ctx,
      pt,
      pt,
      brush,
      color,
      tool,
      brushSize,
      brushOpacity,
      compositeRef.current ?? undefined,
    );
    setLayers([...layers]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    setCursor({ x: e.clientX - (containerRef.current?.getBoundingClientRect().left ?? 0), y: e.clientY - (containerRef.current?.getBoundingClientRect().top ?? 0) });

    if (panStart.current) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
      return;
    }

    if (!isDrawing || !activeLayer || transformMode) return;

    const ctx = activeLayer.canvas.getContext("2d");
    if (!ctx) return;

    const native = e.nativeEvent;
    const coalesced =
      native.getCoalescedEvents?.().length ? native.getCoalescedEvents() : [native];

    for (const ev of coalesced) {
      const pt = pointerToPoint(ev);
      if (!pt || !lastPointer.current) continue;
      drawSegmentTo(ctx, pt);
    }

    setLayers([...layers]);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (panStart.current) {
      panStart.current = null;
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointer.current = null;
    if (strokeStart.current) {
      pushUndo(strokeStart.current);
      strokeStart.current = null;
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom((z) => Math.max(0.1, Math.min(8, z * delta)));
  }

  function selectTool(next: Tool) {
    setTool(next);
    if (panel === "brush" && next !== tool) setPanel("brush");
  }

  function openBrushPanel() {
    setPanel((p) => (p === "brush" ? null : "brush"));
  }

  function addLayer() {
    if (!doc) return;
    const canvas = createLayerCanvas(doc.width, doc.height);
    const layer: Layer = {
      id: generateId(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      opacity: 1,
      blendMode: "normal",
      locked: false,
      canvas,
    };
    setLayers([...layers, layer]);
    setActiveLayerId(layer.id);
  }

  function deleteLayer(id: string) {
    if (layers.length <= 1) return;
    const next = layers.filter((l) => l.id !== id);
    setLayers(next);
    if (activeLayerId === id) setActiveLayerId(next[next.length - 1].id);
  }

  function duplicateLayer(id: string) {
    const src = layers.find((l) => l.id === id);
    if (!src || !doc) return;
    const canvas = createLayerCanvas(doc.width, doc.height);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(src.canvas, 0, 0);
    const layer: Layer = {
      ...src,
      id: generateId(),
      name: `${src.name} Copy`,
      canvas,
      locked: false,
    };
    const idx = layers.findIndex((l) => l.id === id);
    const next = [...layers];
    next.splice(idx + 1, 0, layer);
    setLayers(next);
    setActiveLayerId(layer.id);
  }

  function moveLayer(id: string, direction: "up" | "down") {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const next = [...layers];
    const swap = direction === "up" ? idx + 1 : idx - 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setLayers(next);
  }

  async function exportPng() {
    if (!doc) return;
    const composite = compositeLayers(layers, doc.width, doc.height, doc.backgroundColor);
    const link = document.createElement("a");
    link.download = `${doc.name}.png`;
    link.href = composite.toDataURL("image/png");
    link.click();
  }

  async function importImage(file: File) {
    if (!activeLayer) return;
    await importImageToLayer(activeLayer, file);
    setLayers([...layers]);
  }

  function clearLayer() {
    if (!activeLayer) return;
    const before = captureLayerState(activeLayer);
    if (!before) return;
    pushUndo({ layerId: activeLayer.id, before: cloneImageData(before) });
    fillLayer(activeLayer, "transparent");
    const ctx = activeLayer.canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
    setLayers([...layers]);
  }

  function fitCanvas() {
    if (!doc || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const scale = Math.min((cw - 40) / doc.width, (ch - 40) / doc.height, 1);
    setZoom(scale);
    setPan({ x: (cw - doc.width * scale) / 2, y: (ch - doc.height * scale) / 2 });
  }

  useEffect(() => {
    if (doc) fitCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void persist();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!doc) {
    return <div className="procreate-loading">Loading studio…</div>;
  }

  const uiClass = [
    "procreate-studio",
    prefs.lightInterface ? "light" : "",
    prefs.rightHanded ? "right-handed" : "",
    prefs.showInterface ? "" : "hide-ui",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={uiClass}>
      {prefs.showInterface && (
        <>
          <div className="procreate-top-left">
            <button
              type="button"
              className="procreate-tool-btn"
              onClick={onBack}
              {...tipProps("Gallery — return to your artworks")}
            >
              <IconGallery className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={`procreate-tool-btn${panel === "actions" ? " active" : ""}`}
              onClick={() => setPanel(panel === "actions" ? null : "actions")}
              {...tipProps("Actions — export, import, and preferences")}
            >
              <IconActions className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="procreate-tool-btn"
              {...tipProps("Adjustments — blur, sharpen, and effects (coming soon)")}
            >
              <IconAdjust className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="procreate-tool-btn"
              {...tipProps("Selection — isolate areas to edit (coming soon)")}
            >
              <IconSelect className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={`procreate-tool-btn${transformMode ? " active" : ""}`}
              onClick={() => setTransformMode(!transformMode)}
              {...tipProps("Transform — move and scale the active layer")}
            >
              <IconTransform className="h-5 w-5" />
            </button>
          </div>

          <div className="procreate-top-right">
            <button
              type="button"
              className={`procreate-tool-btn${tool === "paint" ? " active" : ""}`}
              onClick={() => selectTool("paint")}
              onDoubleClick={openBrushPanel}
              {...tipProps("Paint — draw with brushes (double-click for library)")}
            >
              <IconBrush className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={`procreate-tool-btn${tool === "smudge" ? " active" : ""}`}
              onClick={() => selectTool("smudge")}
              onDoubleClick={openBrushPanel}
              {...tipProps("Smudge — blend and mix colors together")}
            >
              <IconSmudge className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={`procreate-tool-btn${tool === "erase" ? " active" : ""}`}
              onClick={() => selectTool("erase")}
              onDoubleClick={openBrushPanel}
              {...tipProps("Eraser — remove strokes (double-click for library)")}
            >
              <IconErase className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={`procreate-tool-btn${panel === "layers" ? " active" : ""}`}
              onClick={() => setPanel(panel === "layers" ? null : "layers")}
              {...tipProps("Layers — add, reorder, and blend layers")}
            >
              <IconLayers className="h-5 w-5" />
            </button>
            <button
              ref={colorBtnRef}
              type="button"
              className={`procreate-color-btn${colorDropActive ? " dropping" : ""}`}
              onPointerDown={handleColorPointerDown}
              {...tipProps("Color — tap to pick, press & drag onto canvas to fill")}
            >
              <span style={{ background: color }} />
            </button>
          </div>

          <aside className="procreate-sidebar">
            <div
              className="procreate-slider-wrap"
              {...tipProps("Brush size — drag up for a thicker stroke", "right")}
            >
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.01}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
              />
            </div>
            <button
              type="button"
              className={`procreate-modify-btn${eyedropper ? " active" : ""}`}
              onClick={() => setEyedropper(!eyedropper)}
              {...tipProps("Eyedropper — pick a color from your canvas", "right")}
            >
              <IconEyedropper className="h-5 w-5" />
            </button>
            <div
              className="procreate-slider-wrap"
              {...tipProps("Brush opacity — drag up for more solid strokes", "right")}
            >
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.01}
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(Number(e.target.value))}
              />
            </div>
            <button
              type="button"
              className="procreate-undo-btn"
              onClick={undo}
              {...tipProps("Undo last action (⌘Z)", "right")}
            >
              <IconUndo className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="procreate-redo-btn"
              onClick={redo}
              {...tipProps("Redo (⌘⇧Z)", "right")}
            >
              <IconRedo className="h-5 w-5" />
            </button>
          </aside>
        </>
      )}

      <div
        ref={containerRef}
        className="procreate-canvas-wrap"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={() => setPrefs((p) => ({ ...p, showInterface: !p.showInterface }))}
      >
        <canvas ref={viewCanvasRef} className="procreate-view-canvas" />
      </div>

      {colorDropActive && colorDropPos && (
        <div
          className="procreate-colordrop-chip"
          style={{ left: colorDropPos.x, top: colorDropPos.y, background: color }}
          aria-hidden
        />
      )}

      {colorDropActive && (
        <div className="procreate-colordrop-hint">
          Release to fill · drag further for more bleed
        </div>
      )}

      <div className="procreate-status">
        <span>{doc.name}</span>
        <span>{saveLabel}</span>
        <span>{Math.round(zoom * 100)}%</span>
      </div>

      {panel === "brush" && (
        <BrushPanel
          selectedId={brush.id}
          onSelect={(b) => {
            setBrush(b);
            setPanel(null);
          }}
          onBrushesChange={setAllBrushes}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "color" && (
        <ColorPanel
          color={color}
          previousColor={prevColor}
          tab={colorTab}
          onTabChange={setColorTab}
          onColorChange={(c) => {
            setPrevColor(color);
            setColor(c);
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "layers" && (
        <LayersPanel
          layers={layers}
          activeId={activeLayerId}
          onSelect={setActiveLayerId}
          onToggleVisible={(id) => {
            setLayers(layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
          }}
          onOpacityChange={(id, opacity) => {
            setLayers(layers.map((l) => (l.id === id ? { ...l, opacity } : l)));
          }}
          onBlendChange={(id, blendMode) => {
            setLayers(layers.map((l) => (l.id === id ? { ...l, blendMode: blendMode as BlendMode } : l)));
          }}
          onAdd={addLayer}
          onDelete={deleteLayer}
          onDuplicate={duplicateLayer}
          onMove={moveLayer}
          onRename={(id, name) => {
            setLayers(layers.map((l) => (l.id === id ? { ...l, name } : l)));
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "actions" && (
        <div className="procreate-panel procreate-actions-panel">
          <div className="procreate-panel-header">
            <h3>Actions</h3>
            <button
              type="button"
              className="procreate-icon-btn"
              onClick={() => setPanel(null)}
              {...tipProps("Close actions panel")}
            >
              ×
            </button>
          </div>
          <div className="procreate-actions-list">
            <button
              type="button"
              onClick={() => void exportPng()}
              {...tipProps("Download your artwork as a PNG file")}
            >
              Share → Export PNG
            </button>
            <button
              type="button"
              onClick={fitCanvas}
              {...tipProps("Zoom and center the canvas on screen")}
            >
              Canvas → Fit to screen
            </button>
            <button
              type="button"
              onClick={clearLayer}
              {...tipProps("Remove all strokes from the active layer")}
            >
              Layer → Clear active layer
            </button>
            <label className="procreate-file-btn" {...tipProps("Add a photo to the active layer")}>
              Insert → Import photo
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importImage(f);
                }}
              />
            </label>
            <hr />
            <p className="procreate-actions-label">ColorDrop</p>
            <label className="procreate-actions-slider" {...tipProps("Default fill bleed — higher fills through more color variation")}>
              Threshold ({Math.round(prefs.colorDropThreshold * 100)}%)
              <input
                type="range"
                min={0.02}
                max={0.45}
                step={0.01}
                value={prefs.colorDropThreshold}
                onChange={(e) =>
                  setPrefs({ ...prefs, colorDropThreshold: Number(e.target.value) })
                }
              />
            </label>
            <label className="procreate-toggle" {...tipProps("Use all visible layers as fill boundaries (like Procreate Reference)")}>
              <input
                type="checkbox"
                checked={prefs.colorDropReference}
                onChange={(e) =>
                  setPrefs({ ...prefs, colorDropReference: e.target.checked })
                }
              />
              Reference all layers
            </label>
            <hr />
            <p className="procreate-actions-label">ColorDrop</p>
            <label className="procreate-actions-slider" {...tipProps("Default fill bleed — higher fills through more color variation")}>
              Threshold ({Math.round(prefs.colorDropThreshold * 100)}%)
              <input
                type="range"
                min={0.02}
                max={0.45}
                step={0.01}
                value={prefs.colorDropThreshold}
                onChange={(e) =>
                  setPrefs({ ...prefs, colorDropThreshold: Number(e.target.value) })
                }
              />
            </label>
            <label className="procreate-toggle" {...tipProps("Use all visible layers as fill boundaries (like Procreate Reference)")}>
              <input
                type="checkbox"
                checked={prefs.colorDropReference}
                onChange={(e) =>
                  setPrefs({ ...prefs, colorDropReference: e.target.checked })
                }
              />
              Reference all layers
            </label>
            <hr />
            <label className="procreate-toggle" {...tipProps("Switch to a light-colored interface")}>
              <input
                type="checkbox"
                checked={prefs.lightInterface}
                onChange={(e) => setPrefs({ ...prefs, lightInterface: e.target.checked })}
              />
              Light interface
            </label>
            <label className="procreate-toggle" {...tipProps("Move the sidebar to the right side")}>
              <input
                type="checkbox"
                checked={prefs.rightHanded}
                onChange={(e) => setPrefs({ ...prefs, rightHanded: e.target.checked })}
              />
              Right-hand interface
            </label>
            <label className="procreate-toggle" {...tipProps("Show a circle preview of your brush on the canvas")}>
              <input
                type="checkbox"
                checked={prefs.brushCursor}
                onChange={(e) => setPrefs({ ...prefs, brushCursor: e.target.checked })}
              />
              Brush cursor
            </label>
            <button
              type="button"
              onClick={() => setPrefs({ ...prefs, showInterface: !prefs.showInterface })}
              {...tipProps("Hide all menus for a distraction-free canvas (double-tap canvas too)")}
            >
              {prefs.showInterface ? "Hide interface" : "Show interface"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
