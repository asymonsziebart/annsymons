"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AdjustmentType,
  AnimationFrame,
  ArtworkDocument,
  BlendMode,
  BrushDef,
  BrushOverrides,
  Layer,
  Point,
  SelectionMask,
  SelectionMode,
  SerializedLayer,
  StudioMode,
  StudioPrefs,
  TextObject,
  Tool,
  TransformState,
} from "@/lib/procreate/types";
import { createRuntimeLayer, DEFAULT_STUDIO_PREFS, normalizeLayerFields } from "@/lib/procreate/types";
import { findBrush } from "@/lib/procreate/brushes";
import {
  getAllBrushes,
  preloadBrushTip,
} from "@/lib/procreate/brushLibrary";
import {
  captureLayerState,
  cloneImageData,
  compositeLayers,
  compositeLayersSlice,
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
import { loadStudioPrefs, saveStudioPrefs } from "@/lib/procreate/prefsStorage";
import { exportCompositeJpeg, exportCompositePng, exportProjectJson } from "@/lib/procreate/exportFormats";
import { createAnimationFrame, loadFrameLayers } from "@/lib/procreate/animation";
import { drawSelectionOverlay } from "@/lib/procreate/selection";
import { drawSymmetryGuides } from "@/lib/procreate/symmetry";
import {
  applyAdjustmentToTarget,
  applyMaskToLayer,
  beginTransform,
  buildSelection,
  commitTransform,
  detectQuickShape,
  drawQuickShape,
  drawTransformHandles,
  effectiveBrush,
  flipCanvasLayers,
  hitTransformHandle,
  invertMask,
  mergeLayerDown,
  previewTransform,
  renderTextToLayer,
  reorderLayers,
} from "@/lib/procreate/studioExtras";
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
  AdjustmentsPanel,
  AnimationPanel,
  BrushStudioPanel,
  QuickMenu,
  SelectionPanel,
  SymmetryBar,
  TextPanel,
} from "./FeaturePanels";
import {
  ColorPanel,
  LayersPanel,
} from "./panels";
import {
  IconActions,
  IconAdjust,
  IconBrush,
  IconErase,
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

type Panel = "brush" | "layers" | "color" | "actions" | "select" | "adjust" | "brushStudio" | "animation" | "text" | null;

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
  const [studioMode, setStudioMode] = useState<StudioMode>("draw");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("freehand");
  const [selection, setSelection] = useState<SelectionMask | null>(null);
  const [selectPoints, setSelectPoints] = useState<Point[]>([]);
  const [selectStart, setSelectStart] = useState<Point | null>(null);
  const [transform, setTransform] = useState<TransformState | null>(null);
  const [transformDrag, setTransformDrag] = useState<{ handle: string; startX: number; startY: number; t0: TransformState } | null>(null);
  const [brushOverrides, setBrushOverrides] = useState<BrushOverrides>({});
  const [animationFrames, setAnimationFrames] = useState<AnimationFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [textObjects, setTextObjects] = useState<TextObject[]>([]);
  const [pendingText, setPendingText] = useState<TextObject | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [docName, setDocName] = useState("");
  const strokePoints = useRef<Point[]>([]);
  const strokeStartTime = useRef(0);
  const [brush, setBrush] = useState<BrushDef>(findBrush("6b-pencil"));
  const [allBrushes, setAllBrushes] = useState<BrushDef[]>([]);
  const [color, setColor] = useState("#1a1a1a");
  const [prevColor, setPrevColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(1);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [panel, setPanel] = useState<Panel>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const [isDrawing, setIsDrawing] = useState(false);
  const [eyedropper, setEyedropper] = useState(false);
  const [prefs, setPrefs] = useState<StudioPrefs>(DEFAULT_STUDIO_PREFS);
  const [colorDropActive, setColorDropActive] = useState(false);
  const [colorDropPos, setColorDropPos] = useState<{ x: number; y: number } | null>(null);
  const [fillThresholdLive, setFillThresholdLive] = useState(0.18);
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
  const activePointerIds = useRef(new Set<number>());
  const multiTouchTap = useRef<{ count: number; time: number; xs: number[]; ys: number[] } | null>(null);
  const smudgeCompositeRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef(doc);
  const layersRef = useRef(layers);
  const activeLayerIdRef = useRef(activeLayerId);
  const prefsRef = useRef(prefs);
  const prefsHydratedRef = useRef(false);
  const colorRef = useRef(color);
  const referenceImgRef = useRef<HTMLImageElement | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const onionSkinRef = useRef<HTMLCanvasElement | null>(null);
  const [overlayVersion, setOverlayVersion] = useState(0);

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
    setPrefs(loadStudioPrefs());
    prefsHydratedRef.current = true;
  }, []);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setIsTouchDevice(coarse || "ontouchstart" in window);
  }, []);

  useEffect(() => {
    if (!prefsHydratedRef.current) return;
    saveStudioPrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    colorDropActiveRef.current = colorDropActive;
    fillThresholdLiveRef.current = fillThresholdLive;
  }, [colorDropActive, fillThresholdLive]);

  useEffect(() => {
    if (!referenceImage) {
      referenceImgRef.current = null;
      return;
    }
    let cancelled = false;
    void dataUrlToImage(referenceImage).then((img) => {
      if (!cancelled) {
        referenceImgRef.current = img;
        setOverlayVersion((v) => v + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [referenceImage]);

  useEffect(() => {
    if (!doc || !prefs.onionSkin || currentFrameIndex <= 0 || animationFrames.length <= 1) {
      onionSkinRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      const prevLayers = await loadFrameLayers(
        animationFrames[currentFrameIndex - 1],
        doc.width,
        doc.height,
        dataUrlToImage,
      );
      if (cancelled) return;
      const composite = compositeLayers(prevLayers, doc.width, doc.height, doc.backgroundColor);
      const canvas = document.createElement("canvas");
      canvas.width = doc.width;
      canvas.height = doc.height;
      canvas.getContext("2d")?.drawImage(composite, 0, 0);
      onionSkinRef.current = canvas;
      setOverlayVersion((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, prefs.onionSkin, currentFrameIndex, animationFrames]);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  const loadDocument = useCallback(async () => {
    const saved = await loadArtwork(artworkId);
    if (!saved) return;

    const loadedLayers: Layer[] = await Promise.all(
      saved.layers.map(async (sl) => {
        const norm = normalizeLayerFields(sl);
        const canvas = createLayerCanvas(saved.width, saved.height);
        const ctx = canvas.getContext("2d");
        if (ctx && norm.imageData) {
          const img = await dataUrlToImage(norm.imageData);
          ctx.drawImage(img, 0, 0);
        }
        return createRuntimeLayer(norm, saved.width, saved.height, canvas);
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
        alphaLock: false,
        clipToLayerId: null,
        groupId: null,
        canvas,
      });
    }

    const frames = saved.animationFrames?.length
      ? saved.animationFrames
      : [createAnimationFrame(loadedLayers, "Frame 1")];

    setDoc(saved);
    setDocName(saved.name);
    setLayers(loadedLayers);
    setActiveLayerId(loadedLayers[loadedLayers.length - 1].id);
    setAnimationFrames(frames);
    setCurrentFrameIndex(saved.currentFrameIndex ?? 0);
    setTextObjects(saved.textObjects ?? []);
    setReferenceImage(saved.referenceImage ?? null);
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

    if (prefs.showReference && referenceImgRef.current) {
      ctx.globalAlpha = 0.45;
      ctx.drawImage(referenceImgRef.current, 0, 0, doc.width, doc.height);
      ctx.globalAlpha = 1;
    }

    if (prefs.onionSkin && onionSkinRef.current) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(onionSkinRef.current, 0, 0);
      ctx.globalAlpha = 1;
    }

    compositeRef.current = compositeLayers(layers, doc.width, doc.height, doc.backgroundColor);
    const activeIdx = layers.findIndex((l) => l.id === activeLayerId);
    smudgeCompositeRef.current =
      activeIdx >= 0
        ? compositeLayersSlice(layers, 0, activeIdx, doc.width, doc.height, doc.backgroundColor)
        : compositeRef.current;
    ctx.drawImage(compositeRef.current, 0, 0);

    drawSymmetryGuides(ctx, doc.width, doc.height, prefs.symmetry, zoom);

    if (selection) drawSelectionOverlay(ctx, selection, zoom);

    if (studioMode === "transform" && transform) {
      drawTransformHandles(ctx, transform, zoom);
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
  }, [doc, layers, zoom, pan, prefs, cursor, brush, brushSize, studioMode, transform, activeLayer, activeLayerId, eyedropper, colorDropActive, colorDropPos, fillThresholdLive, color, selection, overlayVersion]);

  function getLayerById(id: string) {
    return layersRef.current.find((l) => l.id === id) ?? null;
  }

  function getActiveDrawingLayer() {
    return getLayerById(activeLayerIdRef.current);
  }

  function cancelActiveStroke() {
    if (strokeStart.current) {
      const layer = getLayerById(strokeStart.current.layerId);
      if (layer) restoreLayerState(layer, strokeStart.current.before);
    }
    setIsDrawing(false);
    lastPointer.current = null;
    strokeStart.current = null;
    strokePoints.current = [];
  }

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
    }, 300);

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

      if (!dropStarted && dist > 18) {
        if (holdTimer !== null) {
          window.clearTimeout(holdTimer);
          holdTimer = null;
        }
        ev.preventDefault();
        beginDrop(ev.clientX, ev.clientY);
      }

      if (!colorDropActiveRef.current) return;

      ev.preventDefault();
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

      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 14) {
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
    const serializedLayers: SerializedLayer[] = layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
      locked: l.locked,
      alphaLock: l.alphaLock,
      clipToLayerId: l.clipToLayerId,
      groupId: l.groupId,
      imageData: canvasToDataUrl(l.canvas),
    }));
    const frames = [...animationFrames];
    if (frames[currentFrameIndex]) {
      frames[currentFrameIndex] = { ...frames[currentFrameIndex], layers: serializedLayers };
    }
    const updated: ArtworkDocument = {
      ...doc,
      name: docName || doc.name,
      modifiedAt: Date.now(),
      thumbnail: makeThumbnail(composite),
      layers: serializedLayers,
      animationFrames: frames,
      currentFrameIndex,
      referenceImage,
      textObjects,
    };
    await saveArtwork(updated);
    setDoc(updated);
    setSaveLabel("Saved");
  }, [doc, layers, docName, animationFrames, currentFrameIndex, referenceImage, textObjects]);

  useEffect(() => {
    if (!doc || layers.length === 0) return;
    setSaveLabel("Saving…");
    const t = window.setTimeout(() => void persist(), 800);
    return () => window.clearTimeout(t);
  }, [layers, doc?.name, doc?.backgroundColor, persist, doc]);

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
    const layer = getLayerById(entry.layerId);
    if (!layer) return;
    const current = captureLayerState(layer);
    if (current) redoStack.current.push({ layerId: entry.layerId, before: cloneImageData(current) });
    restoreLayerState(layer, entry.before);
    setLayers([...layersRef.current]);
  }

  function redo() {
    const entry = redoStack.current.pop();
    if (!entry) return;
    const layer = getLayerById(entry.layerId);
    if (!layer) return;
    const current = captureLayerState(layer);
    if (current) undoStack.current.push({ layerId: entry.layerId, before: cloneImageData(current) });
    restoreLayerState(layer, entry.before);
    setLayers([...layersRef.current]);
  }

  function strokeComposite() {
    if (tool === "smudge") return smudgeCompositeRef.current ?? undefined;
    return undefined;
  }

  function pointerToPoint(e: PointerEvent): Point | null {
    const pt = screenToCanvas(e.clientX, e.clientY);
    if (!pt) return null;
    pt.pressure = e.pressure > 0 ? e.pressure : 0.5;
    return pt;
  }

  const activeBrush = effectiveBrush(brush, brushOverrides);

  function drawSegmentTo(ctx: CanvasRenderingContext2D, layer: Layer, to: Point) {
    if (!lastPointer.current || !doc) return;
    strokePoints.current.push(to);
    strokeEngine.current.paintStroke(
      ctx,
      lastPointer.current,
      to,
      activeBrush,
      color,
      tool,
      brushSize,
      brushOpacity,
      strokeComposite(),
      {
        alphaLock: layer.alphaLock,
        symmetry: prefs.symmetry,
        canvasWidth: doc.width,
        canvasHeight: doc.height,
      },
    );
    lastPointer.current = to;
  }

  function handlePointerDown(e: React.PointerEvent) {
    activePointerIds.current.add(e.pointerId);
    if (activePointerIds.current.size > 1) {
      cancelActiveStroke();
      return;
    }

    const activeLayerNow = getActiveDrawingLayer();
    if (!doc || !activeLayerNow || activeLayerNow.locked) return;
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

    const pt = screenToCanvas(e.clientX, e.clientY);
    if (!pt) return;
    pt.pressure = e.pressure > 0 ? e.pressure : 0.5;

    if (studioMode === "select") {
      setSelectStart(pt);
      setSelectPoints([pt]);
      setIsDrawing(true);
      return;
    }

    if (studioMode === "transform") {
      if (!transform) {
        const t = beginTransform(activeLayerNow);
        if (t) setTransform(t);
      } else {
        const handle = hitTransformHandle(transform, pt.x, pt.y, zoom);
        if (handle) setTransformDrag({ handle, startX: pt.x, startY: pt.y, t0: { ...transform } });
      }
      return;
    }

    if (studioMode === "text") {
      setPendingText({
        id: generateId(),
        x: pt.x,
        y: pt.y,
        text: "Text",
        fontSize: 48,
        color,
        fontFamily: "system-ui",
        layerId: activeLayerNow.id,
      });
      setPanel("text");
      return;
    }

    const before = captureLayerState(activeLayerNow);
    if (before) strokeStart.current = { layerId: activeLayerNow.id, before: cloneImageData(before) };

    setIsDrawing(true);
    lastPointer.current = pt;
    strokePoints.current = [pt];
    strokeStartTime.current = Date.now();
    strokeEngine.current.reset();

    const ctx = activeLayerNow.canvas.getContext("2d");
    if (!ctx) return;

    if (tool === "smudge" && doc) {
      const idx = layersRef.current.findIndex((l) => l.id === activeLayerNow.id);
      if (idx >= 0) {
        smudgeCompositeRef.current = compositeLayersSlice(
          layersRef.current,
          0,
          idx,
          doc.width,
          doc.height,
          doc.backgroundColor,
        );
      }
    }

    strokeEngine.current.paintStroke(
      ctx,
      pt,
      pt,
      activeBrush,
      color,
      tool,
      brushSize,
      brushOpacity,
      strokeComposite(),
      {
        alphaLock: activeLayerNow.alphaLock,
        symmetry: prefs.symmetry,
        canvasWidth: doc.width,
        canvasHeight: doc.height,
      },
    );
    setLayers([...layersRef.current]);
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

    const pt = screenToCanvas(e.clientX, e.clientY);
    if (!pt) return;

    if (studioMode === "select" && isDrawing) {
      if (selectionMode === "freehand") {
        setSelectPoints((pts) => [...pts, pt]);
      } else if (selectionMode === "rect") {
        setSelectPoints([selectStart ?? pt, pt]);
      }
      return;
    }

    if (studioMode === "transform" && transform && transformDrag) {
      const dx = pt.x - transformDrag.startX;
      const dy = pt.y - transformDrag.startY;
      const t0 = transformDrag.t0;
      let next = { ...t0 };
      if (transformDrag.handle === "move") {
        next.x = t0.x + dx;
        next.y = t0.y + dy;
      } else if (transformDrag.handle === "br") {
        next.scaleX = Math.max(0.1, t0.scaleX + dx / doc!.width);
        next.scaleY = Math.max(0.1, t0.scaleY + dy / doc!.height);
      } else if (transformDrag.handle === "rotate") {
        next.rotation = t0.rotation + dx * 0.01;
      }
      setTransform(next);
      if (activeLayer) previewTransform(activeLayer, next);
      setLayers([...layers]);
      return;
    }

    if (!isDrawing || studioMode !== "draw") return;

    const drawLayer = getActiveDrawingLayer();
    if (!drawLayer || drawLayer.id !== strokeStart.current?.layerId) return;

    const ctx = drawLayer.canvas.getContext("2d");
    if (!ctx) return;

    const native = e.nativeEvent;
    const coalesced =
      native.getCoalescedEvents?.().length ? native.getCoalescedEvents() : [native];

    for (const ev of coalesced) {
      const p = pointerToPoint(ev);
      if (!p || !lastPointer.current) continue;
      drawSegmentTo(ctx, drawLayer, p);
    }

    setLayers([...layersRef.current]);
  }

  function handlePointerUp(e: React.PointerEvent) {
    activePointerIds.current.delete(e.pointerId);

    if (panStart.current) {
      panStart.current = null;
      return;
    }

    if (studioMode === "select" && isDrawing && doc && compositeRef.current) {
      const end = screenToCanvas(e.clientX, e.clientY);
      const mask = buildSelection(
        selectionMode,
        doc.width,
        doc.height,
        compositeRef.current,
        selectPoints,
        selectStart,
        end,
      );
      setSelection(mask);
      setIsDrawing(false);
      setSelectStart(null);
      return;
    }

    if (studioMode === "transform" && transformDrag) {
      setTransformDrag(null);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (studioMode === "draw" && prefs.quickShape && strokePoints.current.length > 2) {
      const drawLayer = getActiveDrawingLayer();
      const holdMs = Date.now() - strokeStartTime.current;
      const shape = detectQuickShape(strokePoints.current, holdMs);
      if (shape && strokeStart.current && drawLayer) {
        restoreLayerState(drawLayer, strokeStart.current.before);
        const ctx = drawLayer.canvas.getContext("2d");
        if (ctx) drawQuickShape(ctx, shape, color, activeBrush.size * brushSize);
        setLayers([...layersRef.current]);
      }
    }

    lastPointer.current = null;
    strokePoints.current = [];
    if (strokeStart.current) {
      pushUndo(strokeStart.current);
      strokeStart.current = null;
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((z) => Math.max(0.1, Math.min(8, z * delta)));
      return;
    }
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom((z) => Math.max(0.1, Math.min(8, z * delta)));
  }

  function handleTouchStart(e: React.TouchEvent) {
    const count = e.touches.length;
    if (count >= 2) {
      cancelActiveStroke();
      multiTouchTap.current = {
        count,
        time: Date.now(),
        xs: Array.from(e.touches).map((t) => t.clientX),
        ys: Array.from(e.touches).map((t) => t.clientY),
      };
      (handleTouchPinch as unknown as { last?: number }).last = undefined;
      e.preventDefault();
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const gesture = multiTouchTap.current;
    if (!gesture || e.touches.length > 0) return;

    const elapsed = Date.now() - gesture.time;
    let maxMove = 0;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const startX = gesture.xs[i] ?? t.clientX;
      const startY = gesture.ys[i] ?? t.clientY;
      maxMove = Math.max(maxMove, Math.hypot(t.clientX - startX, t.clientY - startY));
    }

    if (elapsed < 400 && maxMove < 32) {
      if (gesture.count === 2) undo();
      else if (gesture.count === 3) redo();
      else if (gesture.count >= 4) {
        const next = !prefsRef.current.showInterface;
        setPrefs({ ...prefsRef.current, showInterface: next });
        if (!next) setPanel(null);
      }
    }
    multiTouchTap.current = null;
    e.preventDefault();
  }

  function handleTouchPinch(e: React.TouchEvent) {
    if (multiTouchTap.current) return;
    if (e.touches.length !== 2) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const pinchRef = (handleTouchPinch as unknown as { last?: number }).last ?? dist;
    const scale = dist / pinchRef;
    (handleTouchPinch as unknown as { last: number }).last = dist;
    if (Math.abs(scale - 1) > 0.01) {
      setZoom((z) => Math.max(0.1, Math.min(8, z * scale)));
    }
  }

  function selectTool(next: Tool) {
    if (tool === next) {
      openBrushPanel();
      return;
    }
    setTool(next);
    setStudioMode("draw");
    if (panel === "brush") setPanel(null);
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
      alphaLock: false,
      clipToLayerId: null,
      groupId: null,
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
      alphaLock: src.alphaLock,
      clipToLayerId: src.clipToLayerId,
      groupId: src.groupId,
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

  function exportPng() {
    if (!doc) return;
    exportCompositePng(layers, doc.width, doc.height, doc.backgroundColor, docName || doc.name);
  }

  function exportJpeg() {
    if (!doc) return;
    exportCompositeJpeg(layers, doc.width, doc.height, doc.backgroundColor, docName || doc.name);
  }

  function exportProject() {
    if (!doc) return;
    exportProjectJson({ ...doc, name: docName || doc.name }, layers);
  }

  async function importReferenceImage(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setReferenceImage(dataUrl);
  }

  async function importImage(file: File) {
    if (!activeLayer) return;
    const before = captureLayerState(activeLayer);
    await importImageToLayer(activeLayer, file);
    if (before) pushUndo({ layerId: activeLayer.id, before: cloneImageData(before) });
    setLayers([...layers]);
  }

  function applyAdjustment(type: AdjustmentType, amount: number) {
    if (!activeLayer) return;
    const before = captureLayerState(activeLayer);
    if (!before) return;
    applyAdjustmentToTarget(activeLayer, type, amount, selection);
    pushUndo({ layerId: activeLayer.id, before: cloneImageData(before) });
    setLayers([...layers]);
  }

  function commitTransformMode() {
    if (transform && activeLayer) {
      commitTransform(activeLayer, transform);
      setTransform(null);
      setLayers([...layers]);
    }
    setStudioMode("draw");
  }

  function handleQuickAction(action: string) {
    switch (action) {
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
      case "flip-h":
        setLayers(flipCanvasLayers(layers, true));
        break;
      case "flip-v":
        setLayers(flipCanvasLayers(layers, false));
        break;
      case "merge":
        setLayers(mergeLayerDown(layers, activeLayerId));
        break;
      case "sym-v":
        setPrefs({ ...prefs, symmetry: "vertical" });
        break;
      case "sym-h":
        setPrefs({ ...prefs, symmetry: "horizontal" });
        break;
      case "sym-q":
        setPrefs({ ...prefs, symmetry: "quad" });
        break;
      case "sym-off":
        setPrefs({ ...prefs, symmetry: "none" });
        break;
      case "fit":
        fitCanvas();
        break;
    }
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

  const showChrome = prefs.showInterface;

  const uiClass = [
    "procreate-studio",
    prefs.lightInterface ? "light" : "",
    prefs.rightHanded ? "right-handed" : "",
    isTouchDevice ? "touch-device" : "",
    showChrome ? "" : "hide-ui",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={uiClass}>
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
              className={`procreate-tool-btn${panel === "adjust" ? " active" : ""}`}
              onClick={() => setPanel(panel === "adjust" ? null : "adjust")}
              {...tipProps("Adjustments — blur, sharpen, hue, and more")}
            >
              <IconAdjust className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={`procreate-tool-btn${studioMode === "select" || panel === "select" ? " active" : ""}`}
              onClick={() => {
                setStudioMode("select");
                setPanel(panel === "select" ? null : "select");
              }}
              {...tipProps("Selection — freehand, rectangle, or automatic")}
            >
              <IconSelect className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={`procreate-tool-btn${studioMode === "transform" ? " active" : ""}`}
              onClick={() => {
                setStudioMode("transform");
                setTransform(null);
              }}
              onDoubleClick={commitTransformMode}
              {...tipProps("Transform — move, scale, rotate (double-click to apply)")}
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
              {...tipProps("Modify — tap for eyedropper, hold and tap canvas to pick a color", "right")}
            />
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
              {...tipProps("Undo last action (2-finger tap)", "right")}
            >
              <IconUndo className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="procreate-redo-btn"
              onClick={redo}
              {...tipProps("Redo (3-finger tap)", "right")}
            >
              <IconRedo className="h-5 w-5" />
            </button>
          </aside>

      {!showChrome && (
        <button
          type="button"
          className="procreate-show-ui-btn"
          onClick={() => setPrefs({ ...prefs, showInterface: true })}
          {...tipProps("Show toolbar and tools (4-finger tap toggles)")}
        >
          Show tools
        </button>
      )}

      <QuickMenu open={quickMenuOpen} onClose={() => setQuickMenuOpen(false)} onAction={handleQuickAction} />

      <div
        ref={containerRef}
        className="procreate-canvas-wrap"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onTouchMove={handleTouchPinch}
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
        {editingName ? (
          <input
            className="procreate-doc-name-input"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
          />
        ) : (
          <button type="button" className="procreate-doc-name-btn" onClick={() => setEditingName(true)}>
            {docName || doc.name}
          </button>
        )}
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
        <div className="procreate-panel-backdrop" onClick={() => setPanel(null)} aria-hidden />
      )}

      {panel === "color" && (
        <ColorPanel
          color={color}
          previousColor={prevColor}
          tab={prefs.colorTab}
          harmonyMode={prefs.harmonyMode}
          onTabChange={(colorTab) => setPrefs({ ...prefs, colorTab })}
          onHarmonyModeChange={(harmonyMode) => setPrefs({ ...prefs, harmonyMode })}
          onColorChange={(c) => {
            setColor((current) => {
              if (c.toLowerCase() !== current.toLowerCase()) setPrevColor(current);
              return c;
            });
          }}
          onSwapColors={() => {
            const cur = color;
            setColor(prevColor);
            setPrevColor(cur);
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
          onReorder={(fromId, toId) => setLayers(reorderLayers(layers, fromId, toId))}
          onRename={(id, name) => {
            setLayers(layers.map((l) => (l.id === id ? { ...l, name } : l)));
          }}
          onToggleLock={(id) => {
            setLayers(layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)));
          }}
          onToggleAlphaLock={(id) => {
            setLayers(layers.map((l) => (l.id === id ? { ...l, alphaLock: !l.alphaLock } : l)));
          }}
          onToggleClip={(id) => {
            const idx = layers.findIndex((l) => l.id === id);
            const below = idx > 0 ? layers[idx - 1].id : null;
            setLayers(
              layers.map((l) =>
                l.id === id ? { ...l, clipToLayerId: l.clipToLayerId ? null : below } : l,
              ),
            );
          }}
          onMergeDown={(id) => setLayers(mergeLayerDown(layers, id))}
          onGroup={(id) => {
            const gid = generateId();
            setLayers(layers.map((l) => (l.id === id ? { ...l, groupId: gid } : l)));
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "select" && (
        <SelectionPanel
          mode={selectionMode}
          onModeChange={setSelectionMode}
          hasSelection={!!selection}
          onClear={() => setSelection(null)}
          onInvert={() => selection && setSelection(invertMask(selection))}
          onDelete={() => {
            if (selection && activeLayer) {
              const before = captureLayerState(activeLayer);
              if (before) {
                applyMaskToLayer(activeLayer, selection, false);
                pushUndo({ layerId: activeLayer.id, before: cloneImageData(before) });
                setLayers([...layers]);
              }
            }
            setSelection(null);
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "adjust" && (
        <AdjustmentsPanel onApply={applyAdjustment} onClose={() => setPanel(null)} />
      )}

      {panel === "brushStudio" && (
        <BrushStudioPanel
          brush={brush}
          overrides={brushOverrides}
          onChange={setBrushOverrides}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "animation" && (
        <AnimationPanel
          frames={animationFrames}
          currentIndex={currentFrameIndex}
          onionSkin={prefs.onionSkin}
          onToggleOnion={() => setPrefs({ ...prefs, onionSkin: !prefs.onionSkin })}
          onAddFrame={() => {
            setAnimationFrames([...animationFrames, createAnimationFrame(layers)]);
            setCurrentFrameIndex(animationFrames.length);
          }}
          onSelectFrame={(i) => void loadFrameLayers(animationFrames[i], doc.width, doc.height, dataUrlToImage).then(setLayers).then(() => setCurrentFrameIndex(i))}
          onDuplicateFrame={(i) => {
            const copy = { ...animationFrames[i], id: generateId(), label: `${animationFrames[i].label} Copy` };
            setAnimationFrames([...animationFrames.slice(0, i + 1), copy, ...animationFrames.slice(i + 1)]);
          }}
          onDeleteFrame={(i) => {
            if (animationFrames.length <= 1) return;
            setAnimationFrames(animationFrames.filter((_, j) => j !== i));
            setCurrentFrameIndex(Math.max(0, i - 1));
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "text" && pendingText && (
        <TextPanel
          textObj={pendingText}
          onChange={setPendingText}
          onApply={() => {
            if (!activeLayer || !pendingText) return;
            const before = captureLayerState(activeLayer);
            renderTextToLayer(activeLayer, pendingText);
            if (before) pushUndo({ layerId: activeLayer.id, before: cloneImageData(before) });
            setTextObjects([...textObjects, pendingText]);
            setPendingText(null);
            setPanel(null);
            setStudioMode("draw");
            setLayers([...layers]);
          }}
          onClose={() => {
            setPendingText(null);
            setPanel(null);
          }}
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
              onClick={exportPng}
              {...tipProps("Download your artwork as a PNG file")}
            >
              Share → Export PNG
            </button>
            <button
              type="button"
              onClick={exportJpeg}
              {...tipProps("Download your artwork as a JPEG file")}
            >
              Share → Export JPEG
            </button>
            <button
              type="button"
              onClick={exportProject}
              {...tipProps("Download layered project JSON")}
            >
              Share → Export project
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
              onClick={() => {
                setStudioMode("text");
                setPanel(null);
              }}
              {...tipProps("Text — tap canvas to place text")}
            >
              Insert → Add text
            </button>
            <button
              type="button"
              onClick={() => {
                setPanel("brushStudio");
              }}
              {...tipProps("Brush Studio — tune brush settings")}
            >
              Brush → Brush Studio
            </button>
            <button
              type="button"
              onClick={() => setPanel("animation")}
              {...tipProps("Animation Assist — frames and onion skin")}
            >
              Canvas → Animation Assist
            </button>
            <button type="button" onClick={() => setQuickMenuOpen(true)} {...tipProps("QuickMenu shortcuts")}>
              Prefs → QuickMenu
            </button>
            <label className="procreate-actions-slider" {...tipProps("Canvas background color behind layers")}>
              Background
              <input
                type="color"
                value={doc.backgroundColor}
                onChange={(e) => setDoc({ ...doc, backgroundColor: e.target.value })}
              />
            </label>
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
            <label className="procreate-file-btn" {...tipProps("Add a reference image overlay on canvas")}>
              Insert → Reference image
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importReferenceImage(f);
                }}
              />
            </label>
            {referenceImage && (
              <button type="button" onClick={() => setReferenceImage(null)} {...tipProps("Remove reference overlay")}>
                Reference → Clear overlay
              </button>
            )}
            <hr />
            <p className="procreate-actions-label">Drawing Guide</p>
            <SymmetryBar inline mode={prefs.symmetry} onChange={(m) => setPrefs({ ...prefs, symmetry: m })} />
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
            <label className="procreate-toggle" {...tipProps("Use all visible layers as fill boundaries when filling")}>
              <input
                type="checkbox"
                checked={prefs.colorDropReference}
                onChange={(e) =>
                  setPrefs({ ...prefs, colorDropReference: e.target.checked })
                }
              />
              Reference all layers
            </label>
            <label className="procreate-toggle" {...tipProps("Show reference image overlay while drawing")}>
              <input
                type="checkbox"
                checked={prefs.showReference}
                onChange={(e) => setPrefs({ ...prefs, showReference: e.target.checked })}
              />
              Show reference overlay
            </label>
            <label className="procreate-toggle" {...tipProps("Hold stroke to snap lines, circles, and rectangles")}>
              <input
                type="checkbox"
                checked={prefs.quickShape}
                onChange={(e) => setPrefs({ ...prefs, quickShape: e.target.checked })}
              />
              QuickShape
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
              onClick={() => {
                const next = !prefs.showInterface;
                if (!next) setPanel(null);
                setPrefs({ ...prefs, showInterface: next });
              }}
              {...tipProps("Hide all menus — or 4-finger tap on canvas")}
            >
              {prefs.showInterface ? "Hide interface" : "Show interface"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
