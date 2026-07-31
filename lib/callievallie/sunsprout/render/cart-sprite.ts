// Pip's travelling cart — chunky procedural sprite drawn on top of the
// world plaza when Pip is in town. ~32x24 pixel footprint (one tile
// plus an awning), readable from a distance.

export function drawCartSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileSize: number,
): void {
  const wood = '#8B6E4E';
  const woodDark = '#6E5640';
  const wheel = '#4A3625';
  const wheelHub = '#F0C24A';
  const cloth = '#C85A8A';
  const clothDark = '#9A3A6A';
  const trim = '#F5E9D4';

  // Cart bed (sits centred on the tile).
  const bedX = Math.floor(x - tileSize * 0.6);
  const bedY = Math.floor(y - 4);
  const bedW = Math.floor(tileSize * 1.2);
  const bedH = 10;
  ctx.fillStyle = wood;
  ctx.fillRect(bedX, bedY, bedW, bedH);
  ctx.fillStyle = woodDark;
  ctx.fillRect(bedX, bedY + bedH - 2, bedW, 2);

  // Wheels.
  const wheelR = 4;
  function drawWheel(cx: number, cy: number): void {
    ctx.fillStyle = wheel;
    ctx.beginPath();
    ctx.arc(cx, cy, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = wheelHub;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  drawWheel(bedX + 4, bedY + bedH + 2);
  drawWheel(bedX + bedW - 4, bedY + bedH + 2);

  // Awning/canopy — a striped cloth that arcs above the bed.
  const awnY = bedY - 14;
  const awnH = 12;
  ctx.fillStyle = cloth;
  ctx.fillRect(bedX + 1, awnY, bedW - 2, awnH);
  // Vertical stripes.
  ctx.fillStyle = clothDark;
  for (let i = 0; i < bedW - 2; i += 6) {
    ctx.fillRect(bedX + 2 + i, awnY, 3, awnH);
  }
  // Awning trim along the bottom.
  ctx.fillStyle = trim;
  ctx.fillRect(bedX + 1, awnY + awnH - 2, bedW - 2, 2);

  // Support poles.
  ctx.fillStyle = woodDark;
  ctx.fillRect(bedX + 1, awnY + awnH, 2, bedY - (awnY + awnH));
  ctx.fillRect(bedX + bedW - 3, awnY + awnH, 2, bedY - (awnY + awnH));

  // A "shop sign" hanging off the awning.
  ctx.fillStyle = wood;
  ctx.fillRect(bedX + Math.floor(bedW / 2) - 4, awnY + awnH + 2, 8, 4);
  ctx.fillStyle = wheelHub;
  ctx.fillRect(bedX + Math.floor(bedW / 2) - 1, awnY + awnH + 3, 2, 2);
}
