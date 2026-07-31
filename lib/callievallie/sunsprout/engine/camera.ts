// Smooth-follow camera. The camera position represents the world-space
// pixel currently shown at the top-left of the viewport. follow() eases
// the camera toward a target each fixed update, producing the soft
// trailing motion typical of cozy farming games.

export class Camera {
  public x = 0;
  public y = 0;
  public viewW: number;
  public viewH: number;

  /** Lerp factor per fixed update (16ms). Lower = smoother / laggier. */
  public lerp = 0.08;

  /** Optional world bounds to clamp the camera against. */
  public worldW: number | null = null;
  public worldH: number | null = null;

  constructor(viewW: number, viewH: number) {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  /**
   * Ease the camera so that (targetX, targetY) in world-space sits at the
   * centre of the viewport. dt is provided for future variable-step usage;
   * with our fixed 16ms loop the lerp is effectively constant.
   */
  follow(targetX: number, targetY: number, _dt: number): void {
    const desiredX = targetX - this.viewW / 2;
    const desiredY = targetY - this.viewH / 2;
    this.x += (desiredX - this.x) * this.lerp;
    this.y += (desiredY - this.y) * this.lerp;
    this.clampToBounds();
  }

  /** Hard snap (used on initial spawn so the camera doesn't slide in). */
  snapTo(targetX: number, targetY: number): void {
    this.x = targetX - this.viewW / 2;
    this.y = targetY - this.viewH / 2;
    this.clampToBounds();
  }

  /** Convert a world-space point to viewport pixels. Integer-snapped. */
  worldToScreen(worldX: number, worldY: number): { sx: number; sy: number } {
    return {
      sx: Math.floor(worldX - this.x),
      sy: Math.floor(worldY - this.y),
    };
  }

  /** Set optional world clamp bounds (in world-space pixels). */
  setBounds(worldW: number, worldH: number): void {
    this.worldW = worldW;
    this.worldH = worldH;
    this.clampToBounds();
  }

  private clampToBounds(): void {
    if (this.worldW !== null) {
      const maxX = Math.max(0, this.worldW - this.viewW);
      if (this.x < 0) this.x = 0;
      else if (this.x > maxX) this.x = maxX;
    }
    if (this.worldH !== null) {
      const maxY = Math.max(0, this.worldH - this.viewH);
      if (this.y < 0) this.y = 0;
      else if (this.y > maxY) this.y = maxY;
    }
  }
}
