// Carpenter's bench — small procedural sprite for the village square.
// Draws a wooden workbench with a saw and a stack of planks. Sized to
// sit cleanly inside one tile so it doesn't obscure adjacent NPCs.

export function drawBenchSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileSize: number,
): void {
  const woodLight = '#A47E55';
  const wood = '#8B6E4E';
  const woodDark = '#5C4530';
  const saw = '#D5D8DC';
  const sawHandle = '#7A3A2A';

  // Workbench top.
  const topX = Math.floor(x - tileSize * 0.45);
  const topW = Math.floor(tileSize * 0.9);
  const topY = Math.floor(y - 2);
  const topH = 5;
  ctx.fillStyle = woodLight;
  ctx.fillRect(topX, topY, topW, topH);
  ctx.fillStyle = woodDark;
  ctx.fillRect(topX, topY + topH - 1, topW, 1);

  // Two legs.
  ctx.fillStyle = wood;
  ctx.fillRect(topX + 1, topY + topH, 2, 7);
  ctx.fillRect(topX + topW - 3, topY + topH, 2, 7);
  // Crossbar between legs.
  ctx.fillStyle = woodDark;
  ctx.fillRect(topX + 3, topY + topH + 4, topW - 6, 1);

  // Saw resting on the top — a small grey blade with a brown handle.
  const sawX = topX + Math.floor(topW * 0.15);
  const sawY = topY - 3;
  ctx.fillStyle = saw;
  ctx.fillRect(sawX, sawY, 10, 2);
  // Toothed edge — single pixel teeth pattern.
  for (let i = 0; i < 10; i += 2) {
    ctx.fillRect(sawX + i, sawY + 2, 1, 1);
  }
  ctx.fillStyle = sawHandle;
  ctx.fillRect(sawX - 3, sawY, 3, 3);

  // Plank stack on the right.
  const stackX = topX + topW - 12;
  const stackY = topY - 4;
  ctx.fillStyle = woodLight;
  ctx.fillRect(stackX, stackY, 10, 2);
  ctx.fillStyle = wood;
  ctx.fillRect(stackX, stackY + 2, 10, 2);
}
