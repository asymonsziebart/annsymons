export function clampFocus(v: number): number {
  return Math.max(0, Math.min(100, Number(v) || 0));
}

export function clampZoom(v: number): number {
  return Math.max(1, Math.min(2.5, Number(v) || 1));
}

export function photoFramingValues(row: {
  focus_x: number | null;
  focus_y: number | null;
  frame_zoom: number | null;
}): [number, number, number] {
  const fx = row.focus_x != null ? clampFocus(row.focus_x) : 50;
  const fy = row.focus_y != null ? clampFocus(row.focus_y) : 50;
  const z = row.frame_zoom != null ? clampZoom(row.frame_zoom) : 1;
  return [fx, fy, z];
}

export function patternImageTransform(focusX: number, focusY: number, zoom: number): string {
  const fx = clampFocus(focusX);
  const fy = clampFocus(focusY);
  const z = clampZoom(zoom);
  const k = 0.35;
  const dx = ((50 - fx) / 100) * k;
  const dy = ((50 - fy) / 100) * k;
  return `translate(0.5 0.5) scale(${z}) translate(-0.5 -0.5) translate(${dx.toFixed(5)} ${dy.toFixed(5)})`;
}
