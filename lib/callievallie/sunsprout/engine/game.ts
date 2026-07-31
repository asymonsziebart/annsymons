// Game: ties together the canvas context, the World, the Camera, the
// Input handler, and the Renderer. Uses a classic fixed-timestep
// accumulator: variable real-time deltas are sliced into 16ms ticks so
// gameplay updates run deterministically while rendering can still
// happen at any framerate.

import { Camera } from './camera';
import { Input } from './input';
import { Renderer } from '../render/renderer';
import { World } from '../world/world';
import { TILE_SIZE } from './grid';
import { TimeOfDay } from '../game/time';
import {
  advanceDay,
  cropAt,
  harvest,
  isPlantableTile,
  plant,
  till,
  water,
  type FarmCrop,
} from '../game/farming';
import {
  tilesForTool,
  tierOf,
  upgradeCost,
  upgradeTool,
  toolLabel,
} from '../game/tools';
import {
  getDialogue,
  getRole,
  npcInFrontOf,
  updateNPCs,
} from '../game/npcs';
import { CROP_KEYS } from '../game/crops';
import { sellAllHarvest, sellAllGems, sellAllForage, sellAllEggs } from '../game/economy';
import { sellAllDishes } from '../game/cooking';
import { checkQuests as checkQuestsRaw, startingQuests, type QuestEvent } from '../game/quests';
import { CANDIDATES, creditTalk, getHearts, startingHearts } from '../game/hearts';
import { attemptAutoGift } from '../game/gifting';
import { propose } from '../game/engagement';
import { holdWedding } from '../game/marriage';
import { drawHUD } from '../ui/hud';
import { drawPeerBadge } from '../ui/peer-badge';
import { drawMuteBadge } from '../ui/mute-badge';
import { drawPeerRosterPanel } from '../ui/peer-roster-panel';
import { drawRosterSubtitle } from '../ui/peer-roster-subtitle';
import { buildPeerRoster } from '../game/peer-roster';
import { summarizeRoster, formatRosterSummary } from '../game/peer-roster-summary';
import { rosterTone } from '../game/peer-roster-tone';
import { drawEmoteLegend } from '../ui/emote-legend';
import { drawPeerBubbles } from '../render/peer-bubbles';
import { PeerToasts } from '../ui/peer-toasts';
import { HeartsPanel } from '../ui/hearts-panel';
import { DialogueBox } from '../ui/dialogue';
import { CookingMenu } from '../ui/cooking-menu';
import { SleepSummary } from '../ui/sleep-summary';
import { sleep as sleepAction } from '../game/sleep';
import { drawWeatherStrip, drawRainOverlay } from '../ui/weather-strip';
import { drawSkyDial } from '../ui/sky-dial-widget';
import { drawAlmanacChip } from '../ui/almanac-chip';
import { drawQualityHeatmap } from '../ui/quality-heatmap';
import { heatmapToastSpill, type CropStreakSample } from '../game/crop-quality';
import { CROPS } from '../game/crops';
import { applyRain, weatherToday, WEATHER } from '../game/weather';
import { drawBirthdayBanner } from '../ui/birthday-banner';
import { drawFestivalBanner } from '../ui/festival-banner';
import { drawConfettiOverlay, celebrationDayKey, CONFETTI_DURATION_MS } from '../game/confetti';
import { drawChimneySmoke, hearthLit } from '../game/chimney-smoke';
import { ribbonHallMounts } from '../game/ribbon-hall';
import { drawRibbonHall } from '../render/ribbon-hall-sprite';
import { toolRackMounts } from '../game/tool-rack';
import { drawToolRack } from '../render/tool-rack-sprite';
import { cropSellMultiplier } from '../game/festivals';
import {
  placeSprinkler,
  removeSprinkler,
  sprinklerAt,
  sprinklerTick,
  sprinklerInventoryKey,
  getSprinklers,
  drawSprinklerSprite,
  type SprinklerKey,
} from '../game/sprinklers';
import {
  regenerateForage,
  clearForage,
  isDusk,
  forageAt,
  pickupForage,
  getForage,
  drawForageSprite,
  FORAGE,
} from '../game/forage';
import {
  COOP_INVENTORY_KEY,
  COOP_W,
  COOP_H,
  MAX_CHICKENS_PER_COOP,
  addChicken,
  adjacentCoop,
  canPlaceCoop,
  collectEggs,
  collectEggsDetailed,
  coopTick,
  getCoops,
  placeCoop,
  upgradeCoop,
  drawCoopSprite,
} from '../game/coop';
import {
  DOG_TICKET_KEY,
  adoptDog,
  canPet,
  dogTick,
  drawDogSprite,
  getDog,
  petDog,
  treatDog,
  updateDog,
} from '../game/farm-dog';
import {
  CAT_TICKET_KEY,
  adoptCat,
  canPetCat,
  catTick,
  drawCatSprite,
  getCat,
  petCat,
  treatCat,
} from '../game/farm-cat';
import {
  GREENHOUSE_INVENTORY_KEY,
  GREENHOUSE_W,
  GREENHOUSE_H,
  canPlaceGreenhouse,
  drawGreenhouseSprite,
  getGreenhouses,
  greenhouseTick,
  placeGreenhouse,
} from '../game/greenhouse';
import { deliverDailyMail, readNextLetter, unreadCount } from '../game/mail';
import { CANDIDATES as MAIL_CANDIDATES } from '../game/hearts';
import {
  freezeOutdoorCrops,
  isFrozenSeason,
  drawSnowOverlay,
  winterFlavorLine,
} from '../game/winter';
import {
  expireOldInvites,
  fireHangoutIfPresent,
  inviteToastLine,
  rollDailyInvites,
} from '../game/hangouts';
import {
  CHEST_INVENTORY_KEY,
  adjacentChest,
  canPlaceChest,
  drawChestSprite,
  ensureStarterChest,
  getChests,
  placeChest,
} from '../game/chest';
import { ChestMenu } from '../ui/chest-menu';
import { RECIPES } from '../game/cooking';
import { recordCook, recordPremiumCook } from '../game/cooking-history';
import { RecipeCodex } from '../ui/recipe-codex';
import { recordHarvest, recordSown, type FieldCropSample } from '../game/crop-journal';
import { CropJournalPanel } from '../ui/crop-journal-panel';
import { tickAchievements } from '../game/achievements';
import { AchievementsPanel } from '../ui/achievements-panel';
import { logGold } from '../game/money-log';
import { MoneyLogPanel } from '../ui/money-log-panel';
import { QuestLogPanel } from '../ui/quest-log-panel';
import { getSettings } from '../game/settings';
import { SettingsPanel } from '../ui/settings-panel';
import { HelpOverlay } from '../ui/help-overlay';
import { MinimapPanel } from '../ui/minimap-panel';
import { AlmanacPanel } from '../ui/almanac-panel';
import { BagPanel } from '../ui/bag-panel';
import { OnboardingCard } from '../ui/onboarding-card';
import { shouldShowOnboarding, markOnboardingSeen } from '../game/onboarding';
import { Rod, FISH, canCastInto } from '../game/fishing';
import { Pickaxe, GEMS, canStrikeInto } from '../game/mining';
import { gemInventoryKey } from '../game/gems';
import {
  getMineHaul,
  haulYesterdayLine,
  haulCount,
  haulGold,
  recordMined,
  resetMineHaul,
  crossedMilestone,
  milestoneToastLine,
  crossedGoldMilestone,
  goldMilestoneToastLine,
  deepVeinDawnBrag,
  splitRecordDawnBrag,
} from '../game/mining-haul';
import {
  pickaxeTier,
  pickaxeTierLabel,
  pickaxeUpgradeCost,
  upgradePickaxe,
  weightedGemPick,
} from '../game/pickaxe-upgrades';
import {
  rodBiteWindowFor,
  rodTierLabel,
  rodUpgradeCost,
  upgradeRod,
  weightedFishPick,
} from '../game/rod-upgrades';
import {
  STAMINA_COST,
  drinkBest,
  getStamina,
  refillStamina,
  spendStamina,
} from '../game/stamina';
import { drawStaminaBar } from '../ui/stamina-bar';
import {
  CART_X,
  CART_Y,
  breederTradeInLine,
  cartArrivalLine,
  cartOpen,
  cartVisitToday,
  nearCart,
  tradeBreederEggs,
  tradeStaminaTeas,
  teaTradeInLine,
} from '../game/cart';
import { CartMenu } from '../ui/cart-menu';
import { tradeForageForTea, innForageTradeToastLine } from '../game/inn-trade';
import { BAROMETER_INVENTORY_KEY, barometerBoughtLine, barometerStormWarning } from '../game/barometer';
import { recordRumorBuy, recordRumorVisit, rumorRebateAmount, isCurrentHeadlinerKey, rumorToastLine, buyRumorStreakDiscount } from '../game/cart-rumor';
import { ShopMenu } from '../ui/shop-menu';
import { BenchMenu } from '../ui/bench-menu';
import { BENCH_X, BENCH_Y, nearBench } from '../game/bench';
import { drawBenchSprite } from '../render/bench-sprite';
import {
  SCARECROW_INVENTORY_KEY,
  drawScarecrowSprite,
  getScarecrows,
  placeScarecrow,
} from '../game/scarecrow';
import { OwlMenu } from '../ui/owl-menu';
import { chainTierDawnBrag, chainRecipientDawnBrag, owlPostFeeFor } from '../game/owl-post';
import { drawCartSprite } from '../render/cart-sprite';
import { drawShopBanner } from '../render/shop-banner-sprite';
import { shopBannerStyle } from '../game/shop-banner';
import { dawnRestock, recordLastSeed } from '../game/auto-restock';
import { dawnSpouseGift, spouseGreeting } from '../game/spouse';
import {
  BOARD_X,
  BOARD_Y,
  boardProgress,
  canTurnIn,
  drawBoardSprite,
  nearBoard,
  refreshBoard,
  turnIn,
} from '../game/board';
import {
  EXTRACTOR_INVENTORY_KEY,
  hasExtractor,
  runExtract,
} from '../game/seed-extractor';
import {
  alreadyEntered,
  enterTournament,
  tournamentDawnLine,
  tournamentNudgeWithCareer,
  tournamentOpen,
} from '../game/tournament';
import {
  bumpCoopHappinessCollect,
  bumpCoopHappinessFeed,
  decayCoopHappiness,
  petTipBonus,
} from '../game/animal-happiness';
import { maybeFireStorm, stormFlavorLine, stormScheduledDay, takeStormMemo } from '../game/storm';
import {
  BATH_X,
  BATH_Y,
  bathFlavorLine,
  drawBathHouseSprite,
  maybeExpireBath,
  nearBath,
  takeBath,
} from '../game/bath-house';
import {
  getPond,
  interactPond,
  pondOverflowWarning,
  pondStatusLine,
  pondTick,
} from '../game/fish-pond';
import {
  HATCHERY_INVENTORY_KEY,
  adjacentHatchery,
  canPlaceHatchery,
  claimPendingChicken,
  drawHatcherySprite,
  getHatcheries,
  hatcheryStatusLine,
  hatcheryTick,
  loadEgg,
  placeHatchery,
} from '../game/hatchery';
import {
  COMPOST_BIN_INVENTORY_KEY,
  FERTILIZER_INVENTORY_KEY,
  RARE_FERTILIZER_INVENTORY_KEY,
  rareFinishDayFor,
  RARE_FERTILIZER_STREAK,
  adjacentCompost,
  applyFertilizer,
  canPlaceCompost,
  compostHalfwayDawnNudge,
  compostMasterSashDawnBrag,
  compostStatusLine,
  compostTick,
  depositCrops,
  drawCompostSprite,
  getComposts,
  placeCompost,
  rareMasterDawnBrag,
} from '../game/compost';
import { assembleDawnToast } from '../game/dawn-toast';
import { ToastQueue, toastAlphaFor, toastKindColor, classifyToast, TOAST_TTL_MS } from '../game/toast-queue';
import { drawBarks, tickBarks } from '../game/npc-barks';
import {
  STORM_SHELTER_INVENTORY_KEY,
  canPlaceShelter,
  drawShelterSprite,
  getShelters,
  isPaired,
  placeShelter,
  seedTrialShelter,
} from '../game/storm-shelter';
import { applyRepBonus, repBannerLine } from '../game/board-reputation';
import { isLateNightFishing, nightAwareFishPick, nightFlavorLine } from '../game/night-fishing';
import { LorePanel } from '../ui/lore-panel';
import {
  cursorPosition,
  drawFishingBar,
  gradeBonus,
  gradeLabel,
  gradeReel,
  MINIGAME,
  type ReelGrade,
} from '../ui/fishing-minigame';
import { initMultiplayer } from '../game/multiplayer-init';
import { tickMultiplayerFrame } from '../game/multiplayer-frame';
import {
  applySnapshot,
  loadFromStorage,
  saveToStorage,
  type StorageLike,
} from '../game/persistence';
import type { MultiplayerDriver } from '../game/multiplayer-driver';
import type { PeerRenderable } from '../game/peer-view';
import {
  cursorPosition as swingCursorPosition,
  drawSwingMeter,
  gradeBonus as strikeBonus,
  gradeLabel as strikeLabel,
  gradeStrike,
  SWING,
  type StrikeGrade,
} from '../ui/mining-minigame';

const FIXED_STEP_MS = 16;
/** Cap the accumulator so a long tab-switch doesn't trigger a spiral of death. */
const MAX_ACCUM_MS = 250;

export class Game {
  public ctx: CanvasRenderingContext2D;
  public world: World;
  public camera: Camera;
  public input: Input;
  public renderer: Renderer;
  public time: TimeOfDay;
  public dialogue: DialogueBox;
  /** Cooking menu — opened with `C` when standing near the inn. */
  public cookingMenu: CookingMenu = new CookingMenu();
  /** Day-summary overlay shown the morning after sleep(). */
  public sleepSummary: SleepSummary = new SleepSummary();
  /** Chest menu — opened with `]` when standing next to a placed chest. */
  public chestMenu: ChestMenu = new ChestMenu();
  /** Recipe codex panel — toggled with `R`. */
  public recipeCodex: RecipeCodex = new RecipeCodex();
  /** Crop journal panel — toggled with `;`. */
  public cropJournal: CropJournalPanel = new CropJournalPanel();
  /** Achievements panel — toggled with `V`. */
  public achievements: AchievementsPanel = new AchievementsPanel();
  /** Money log panel — toggled with `Q`. */
  public moneyLogPanel: MoneyLogPanel = new MoneyLogPanel();
  /** Quest log panel — toggled with `'`. */
  public questLogPanel: QuestLogPanel = new QuestLogPanel();
  /** Settings panel — toggled with `\\`. */
  public settingsPanel: SettingsPanel = new SettingsPanel();
  /** Controls help overlay — toggled with `?`. */
  public helpOverlay: HelpOverlay = new HelpOverlay();
  /** Village minimap — toggled with `9`. */
  public minimapPanel: MinimapPanel = new MinimapPanel();
  /** Almanac of upcoming events — toggled with `0`. */
  public almanacPanel: AlmanacPanel = new AlmanacPanel();
  /** Inventory / bag panel — toggled with `Tab`. */
  public bagPanel: BagPanel = new BagPanel();
  /** One-time welcome card on a player's first ever boot. */
  public onboardingCard: OnboardingCard = new OnboardingCard();
  /** Pip's travelling cart menu — opened with E when next to the cart. */
  public cartMenu: CartMenu = new CartMenu();
  /** Vallie's shop menu — opened with E when standing adjacent to the shop. */
  public shopMenu: ShopMenu = new ShopMenu();
  /** Carpenter's bench menu — opened with E when standing next to the bench. */
  public benchMenu: BenchMenu = new BenchMenu();
  /** Owl post menu — opened with `~` near the farmhouse mailbox. */
  public owlMenu: OwlMenu = new OwlMenu();
  /** Lore / bestiary panel — toggled with backtick. */
  public lorePanel: LorePanel = new LorePanel();
  /** Fishing rod state machine. F casts/reels; tile-in-front must be water. */
  public rod: Rod = new Rod();
  /** Pickaxe state machine. M swings/strikes; tile-in-front must be stone. */
  public pickaxe: Pickaxe = new Pickaxe();
  /** Cursor position (0..1) frozen the moment the player tapped F during REELING. */
  private reelLockedCursor: number | null = null;
  /** Grade awarded for the locked-in press, surfaced when the catch resolves. */
  private reelGrade: ReelGrade | null = null;
  /** Mining swing-meter — locked cursor + grade once the player taps M. */
  private strikeLockedCursor: number | null = null;
  private strikeGrade: StrikeGrade | null = null;

  /** Optional multiplayer driver (null in single-player). */
  public multiplayer: MultiplayerDriver | null = null;
  /** Localstorage handle for save/load. Null in tests / SSR. */
  public storage: StorageLike | null = null;
  /** Last peer-list resolved this frame — handed to renderer.drawPeers(). */
  private peerRenderables: PeerRenderable[] = [];
  /** Join/leave toast queue (only used when multiplayer is active). */
  private peerToasts = new PeerToasts();

  /** Time of day in [0,1) for the renderer's sky/tint maths. */
  public timeOfDay = 0.25;

  /** Stacked corner notifications so same-frame messages don't clobber. */
  private toasts = new ToastQueue();
  /** Relationships overlay (H) — a class panel in the open-fade family. */
  private heartsPanel = new HeartsPanel();
  /** Set when we've already wiped today's forage at dusk. */
  private forageCleared = false;
  /** Day-key of the celebration burst currently playing (null = none). */
  private confettiDayKey: string | null = null;
  /** Wall-clock ms the active confetti burst started. */
  private confettiStartMs = 0;

  private canvas: HTMLCanvasElement;
  private running = false;
  private lastTimestamp = 0;
  private accumulator = 0;
  private rafHandle: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D rendering context.');
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.world = new World();
    this.camera = new Camera(canvas.width, canvas.height);
    this.camera.setBounds(this.world.pixelWidth, this.world.pixelHeight);
    this.input = new Input(window);
    this.renderer = new Renderer(this.ctx);
    this.time = new TimeOfDay(6);
    this.dialogue = new DialogueBox();

    // Overlay the spec inventory on top of the world's default player.
    const p = this.world.player;
    if (p) {
      p.inventory = {
        wheat: 4,
        tomato: 1,
        flower: 1,
        'watering-can': 1,
      };
      p.gold = 50;
      p.quests = startingQuests();
      p.hearts = startingHearts();
      (p as { selectedSlot?: number }).selectedSlot = 0;
      this.camera.snapTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
    }

    // Multiplayer (opt-in via `?multiplayer=1`). Safe-fails to null when
    // BroadcastChannel is unavailable so single-player still boots.
    try {
      this.multiplayer = initMultiplayer({
        location: typeof window !== 'undefined' ? window.location : undefined,
      });
    } catch {
      this.multiplayer = null;
    }

    // Persistence: if a save exists in localStorage, restore it on top of
    // the fresh world. We fall back silently to the new game on any error.
    this.storage = typeof window !== 'undefined' ? (window.localStorage as StorageLike) : null;
    if (this.storage) {
      const snap = loadFromStorage(this.storage);
      if (snap) {
        try {
          applySnapshot(this, snap);
        } catch {
          // ignore — corrupt snapshot stays in storage but doesn't break boot
        }
      }
    }
    // Seed the day's forage so a fresh boot already has pickables out.
    // If load restored an older save without forage this is also the
    // first chance to populate today.
    if (getForage(this.world).length === 0 && !isDusk(this.time.hour)) {
      regenerateForage(this.world, this.time.season, this.time.day);
    }
    // Make sure the starter cellar chest always exists at the farmhouse,
    // even on fresh worlds or saves that pre-date the chest system.
    ensureStarterChest(this.world);
    // First-ever boot on this device: pop the one-time welcome card that
    // points at the help (?) + wayfinding (9/0) surfaces. The seen flag
    // lives in its own storage key so it survives a save reset.
    if (shouldShowOnboarding(this.storage)) {
      this.onboardingCard.open();
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    const frame = (ts: number) => {
      if (!this.running) return;
      this.tick(ts);
      this.rafHandle = requestAnimationFrame(frame);
    };
    this.rafHandle = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.input.dispose();
  }

  private tick(now: number): void {
    let delta = now - this.lastTimestamp;
    this.lastTimestamp = now;
    if (delta < 0) delta = 0;
    if (delta > MAX_ACCUM_MS) delta = MAX_ACCUM_MS;
    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= FIXED_STEP_MS) {
      this.update(FIXED_STEP_MS);
      this.accumulator -= FIXED_STEP_MS;
      steps++;
      if (steps > 8) {
        this.accumulator = 0;
        break;
      }
    }
    this.render();
  }

  /** Returns the tile coordinates one tile in front of the player. */
  private tileInFront(): { tx: number; ty: number } {
    const p = this.world.player;
    const tx = Math.round(p.x);
    const ty = Math.round(p.y);
    switch (p.facing) {
      case 'up':
        return { tx, ty: ty - 1 };
      case 'down':
        return { tx, ty: ty + 1 };
      case 'left':
        return { tx: tx - 1, ty };
      case 'right':
        return { tx: tx + 1, ty };
    }
  }

  private setToast(msg: string): void {
    this.toasts.push(msg, TOAST_TTL_MS, classifyToast(msg));
  }

  /**
   * Build the (waterStreak, growthStages) samples for every crop on the
   * field — the same data the heatmap overlay derives — so the journal
   * open-transition can spill a field-care toast. Crops whose key is not
   * in the catalog are skipped (mirrors the overlay's guard).
   */
  private cropFieldSamples(): CropStreakSample[] {
    const samples: CropStreakSample[] = [];
    for (const c of this.world.crops as unknown as FarmCrop[]) {
      const catalog = CROPS[c.crop];
      if (!catalog) continue;
      samples.push({ waterStreak: c.waterStreak ?? 0, growthStages: catalog.growthStages });
    }
    return samples;
  }

  /**
   * Build the (stage, growthStages, watered) samples for every crop on the
   * field so the crop-journal panel can draw a live "ready / growing /
   * thirsty" field-status header. Mirrors cropFieldSamples' catalog guard.
   */
  private fieldCropSamples(): FieldCropSample[] {
    const samples: FieldCropSample[] = [];
    for (const c of this.world.crops as unknown as FarmCrop[]) {
      const catalog = CROPS[c.crop];
      if (!catalog) continue;
      samples.push({
        stage: c.stage,
        growthStages: catalog.growthStages,
        watered: c.watered,
      });
    }
    return samples;
  }

  /**
   * Wrapper around checkQuests that captures any gold delta from a
   * completed quest and posts it to the money log so the player can
   * see "Wheat-Five Reward +50g" in the Q panel. The underlying quest
   * system mutates Player.gold internally — diffing before/after is
   * the cleanest way to capture rewards without touching quests.ts.
   */
  private checkQuests(event: QuestEvent): string[] {
    const before = this.world.player.gold;
    const completed = checkQuestsRaw(this.world.player, event);
    const diff = this.world.player.gold - before;
    if (diff !== 0 && completed.length > 0) {
      const label = completed.length === 1 ? `quest: ${completed[0]}` : `quests: ${completed.length}`;
      logGold(this.world.player, diff, label, this.time.day);
    }
    return completed;
  }

  /**
   * True when the player is standing on a tile orthogonally touching the
   * inn's footprint — i.e. close enough that opening the cooking menu
   * feels diegetic. We check the player's nearest integer tile against
   * every tile bordering the inn (Chebyshev radius 1 including corners).
   */
  private isNearInn(): boolean {
    const p = this.world.player;
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const inn = this.world.buildings.find((b) => b.kind === 'inn');
    if (!inn) return false;
    return (
      px >= inn.x - 1 &&
      px <= inn.x + inn.w &&
      py >= inn.y - 1 &&
      py <= inn.y + inn.h
    );
  }

  /** True when the player is standing within Chebyshev radius 1 of Vallie's shop. */
  private isNearShop(): boolean {
    const p = this.world.player;
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const shop = this.world.buildings.find((b) => b.kind === 'shop');
    if (!shop) return false;
    return (
      px >= shop.x - 1 &&
      px <= shop.x + shop.w &&
      py >= shop.y - 1 &&
      py <= shop.y + shop.h
    );
  }

  /** True when the player is standing within Chebyshev radius 1 of the farmhouse. */
  private isAtFarmhouseSimple(): boolean {
    const p = this.world.player;
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const fh = this.world.buildings.find((b) => b.kind === 'farmhouse');
    if (!fh) return false;
    return (
      px >= fh.x - 1 &&
      px <= fh.x + fh.w &&
      py >= fh.y - 1 &&
      py <= fh.y + fh.h
    );
  }

  private update(dtMs: number): void {
    // Advance the cozy 24-hour clock; flip crop growth on the new day.
    const tick = this.time.tick(dtMs);
    if (tick.newDay) {
      // Apply today's rain BEFORE advanceDay so it counts toward the
      // growth tick that's about to fire.
      const w = weatherToday(this.time);
      const rained = applyRain(this.world, w);
      const sprinkled = sprinklerTick(this.world);
      // Winter pass: outdoor crops freeze. Run AFTER rain/sprinklers
      // (so they harmlessly try to water frozen tiles) and BEFORE
      // advanceDay (so the growth tick sees watered=false outside).
      // greenhouseTick later re-asserts watered=true for inside tiles.
      const frozen = isFrozenSeason(this.time) ? freezeOutdoorCrops(this.world) : 0;
      advanceDay(this.world);
      // Chickens drop their daily eggs into their coop's cache.
      const eggs = coopTick(this.world, this.time.day);
      // Decay coop happiness a touch each morning so it has to be
      // earned daily rather than locked in forever.
      decayCoopHappiness(getCoops(this.world));
      // Farm dog's morale payout for yesterday's pet (if any).
      const dogPaid = dogTick(this.world, this.world.player, this.time);
      const dogBonus = petTipBonus(getDog(this.world));
      if (dogPaid > 0 && dogBonus > 0) {
        this.world.player.gold += dogBonus;
        logGold(this.world.player, dogPaid + dogBonus, `farm dog streak (+${dogBonus} bond)`, this.time.day);
      } else if (dogPaid > 0) {
        logGold(this.world.player, dogPaid, 'farm dog streak', this.time.day);
      }
      // Farm cat's morale payout for yesterday's pet (if any).
      const catPaid = catTick(this.world, this.world.player, this.time);
      const catBonus = petTipBonus(getCat(this.world));
      if (catPaid > 0 && catBonus > 0) {
        this.world.player.gold += catBonus;
        logGold(this.world.player, catPaid + catBonus, `farm cat streak (+${catBonus} bond)`, this.time.day);
      } else if (catPaid > 0) {
        logGold(this.world.player, catPaid, 'farm cat streak', this.time.day);
      }
      // Stamina refill — top the pool back to max once per new day.
      refillStamina(this.world.player, this.time.day);
      // Auto-restock kit — re-buy the last seed up to target so the
      // player isn't stuck waiting at Vallie's for a single packet.
      const restockOut = dawnRestock(this.world.player);
      if (restockOut.kind === 'restocked') {
        logGold(this.world.player, -restockOut.gold, `auto-restock ${restockOut.cropKey}`, this.time.day);
      }
      // Spouse — drop the day's gift into the bag once the player is married.
      const spouseGift = dawnSpouseGift(this.world.player, this.time.day);
      if (spouseGift.kind === 'gifted' && spouseGift.gold && spouseGift.gold > 0) {
        logGold(this.world.player, spouseGift.gold, `spouse: ${spouseGift.npcName}`, this.time.day);
      }
      // Pip's cart — surface a dawn toast on the day he arrives so the
      // player knows to head over to the village square.
      const pipArrived = cartVisitToday(this.time);
      // Friendship tournament — announce at dawn on the contest day.
      // Pair it with a PB / next-tier nudge so the player sees the
      // strategic context (today's count vs target) alongside the
      // bare event announcement. The "with career" variant layers a
      // career recap on top of the nudge — "Career: 3 entries - 1
      // gold / 1 silver. Best: 18 (Spring Flower Show)." — so the
      // player gets the immediate strategy AND the all-time view in
      // one dawn toast.
      const tournamentLineBase = tournamentDawnLine(this.time);
      const tournamentNudge = tournamentLineBase
        ? tournamentNudgeWithCareer(this.world.player, this.time)
        : '';
      const tournamentLine = tournamentLineBase
        ? (tournamentNudge ? `${tournamentLineBase} ${tournamentNudge}` : tournamentLineBase)
        : null;
      // Greenhouse boost: every crop inside grows extra and stays watered.
      const greenBumped = greenhouseTick(this.world);
      // Free trial shelter: the FIRST storm of a fresh save auto-spawns
      // a shelter on one outdoor crop so the player learns the system
      // exists. Fires BEFORE maybeFireStorm so the shelter is in
      // place when the damage pass runs. Skipped when the player has
      // already crafted a shelter or already lived through a storm.
      // Only fires on a day the storm actually WILL fire (otherwise
      // we'd pre-spawn a freebie that just sits in the field unused).
      let trialShelter: { tx: number; ty: number } | null = null;
      if (this.time.day === stormScheduledDay(this.world.player, this.time.season)) {
        trialShelter = seedTrialShelter(this.world, this.world.player);
      }
      // Seasonal storm — once per season, deterministically picked. Fires
      // here (AFTER greenhouseTick) so the greenhouse is the shelter:
      // crops inside the glass keep their streak point intact.
      const stormOut = maybeFireStorm(this.world, this.world.player, this.time.season, this.time.day);
      if (stormOut.kind === 'fired') {
        const memo = takeStormMemo(this.world.player);
        if (memo) {
          const trialTail = trialShelter
            ? ' (Pip left a free trial Storm Shelter on your field overnight — consumed by the storm.)'
            : '';
          this.setToast(`${stormFlavorLine(memo)}${trialTail}`);
        }
      }
      // Bath house — drop the stamina cap back to base if the buff ran
      // out overnight. Done BEFORE refillStamina so the dawn top-up
      // uses the correct (post-expiry) max.
      maybeExpireBath(this.world.player, this.time.day);
      // Fish pond — when stocked, drops 1-2 fish into the pending pool
      // for collection. Idempotent per-day. Pass the player so the
      // stone-rim upgrade widens the cap from 6 -> 10. Pass `time` so
      // the per-species ribbon updates on the day a swarm sets a new
      // record (mirrors the crop ribbon flow in crop-journal.ts).
      const pondAdded = pondTick(this.world, this.time.day, this.world.player, this.time);
      // Hatcheries — egg-countdown ticks, fires hatch when due. We post
      // a toast for the first hatcher of the morning so the player
      // knows their incubation paid off (or stalled on a full coop).
      const hatchOutcomes = hatcheryTick(this.world, this.time.day);
      for (const out of hatchOutcomes) {
        if (out.kind === 'hatched-into-coop') {
          const breed = out.heritage ? 'heritage chick' : 'chick';
          this.setToast(
            `A ${breed} hatched and joined the coop (${out.coop.chickens}/4).`,
          );
          break;
        } else if (out.kind === 'hatched-no-room') {
          const breed = out.heritage ? 'heritage chick' : 'chick';
          this.setToast(
            `A ${breed} hatched but every coop is full. Make room.`,
          );
          break;
        }
      }
      // Compost bins — any batch whose finish day is past mints fertilizer
      // bags into the bag. A single toast carries the total so the
      // morning doesn't spam multiple lines per bin. When a batch finished
      // on the season's rare day the bags land in RARE_FERTILIZER_INVENTORY_KEY
      // and the toast calls them out.
      const rareBefore = this.world.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] ?? 0;
      const fertMinted = compostTick(
        this.world,
        this.world.player,
        this.time.day,
        this.time.season,
      );
      if (fertMinted > 0) {
        const rareAfter = this.world.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] ?? 0;
        const rareDelta = rareAfter - rareBefore;
        if (rareDelta > 0) {
          this.setToast(
            `Compost yielded ${fertMinted} fertilizer bag${fertMinted === 1 ? '' : 's'} — ${rareDelta} RARE (+${RARE_FERTILIZER_STREAK} streak each).`,
          );
        } else {
          this.setToast(
            `Compost yielded ${fertMinted} fertilizer bag${fertMinted === 1 ? '' : 's'}.`,
          );
        }
      }
      // Deliver any new letters earned by yesterday's heart gains.
      const newMail = deliverDailyMail(this.world.player, this.time.day);
      // Hangout invites: clear expired ones, post new ones from any
      // heart-4 candidate who isn't already on the schedule.
      expireOldInvites(this.world.player, this.time);
      const newInvites = rollDailyInvites(this.world.player, this.time);
      // Regenerate the day's forage layout — deterministic per (season,day).
      regenerateForage(this.world, this.time.season, this.time.day);
      this.forageCleared = false;
      // Barometer-side storm warning — checked once per dawn, only
      // surfaced when none of the higher-priority tail messages have
      // already claimed the dawn toast. Returns an empty string when
      // the player has no barometer or no storm is on the 2-day
      // forecast horizon.
      const stormHorizonLine = barometerStormWarning(this.world.player, this.time);
      const flavorTail =
        rained > 0
          ? ` (rain watered ${rained})`
          : sprinkled > 0
            ? ` (sprinklers watered ${sprinkled})`
            : eggs > 0
              ? ` (coops laid ${eggs} egg${eggs === 1 ? '' : 's'})`
              : dogPaid > 0
                ? ` (the dog tipped you +${dogPaid}g)`
                : catPaid > 0
                  ? ` (the cat tipped you +${catPaid}g)`
                  : greenBumped > 0
                    ? ` (greenhouse pushed ${greenBumped} crops)`
                    : newMail > 0
                      ? ` (${newMail} new letter${newMail === 1 ? '' : 's'} arrived)`
                      : newInvites.length === 1
                        ? ` (${inviteToastLine(newInvites[0])})`
                        : newInvites.length > 1
                          ? ` (${newInvites.length} hangout invites pending)`
                          : tournamentLine
                            ? ` (${tournamentLine})`
                            : pipArrived
                              ? ` (${cartArrivalLine()} ${rumorToastLine(this.time.season)})`
                              : spouseGift.kind === 'gifted'
                                ? ` (${spouseGift.npcName} left you ${spouseGift.label})`
                                : pondAdded > 0
                                  ? ` (pond yielded ${pondAdded} fish)`
                                  : stormHorizonLine
                                    ? ` · ${stormHorizonLine}`
                                    : '';
      // Winter takes priority on day 1 of the season — the player needs
      // to know the field froze. Days 2+ of winter just show the standard
      // flavour tail.
      const isFirstWinterDay = isFrozenSeason(this.time) && this.time.day === 1;
      const headlineBase = isFirstWinterDay
        ? winterFlavorLine(frozen)
        : `A new day begins · Day ${this.time.day}${flavorTail}`;
      // Pond overflow nag — layered ON TOP of the regular tail so the
      // player gets the "pond yielded N" line AND the "collect or lose"
      // warning in the same toast. Empty when no nag is due.
      const pondOverflow = pondOverflowWarning(getPond(this.world), this.world.player);
      // Mining haul recap — surfaces "yesterday's haul: ..." on the
      // morning AFTER a sleep that captured a nonzero run. Empty
      // string when yesterday was a non-mining day so quiet dawns
      // stay quiet.
      const haulRecap = haulYesterdayLine(getMineHaul(this.world.player));
      // Compost-master / pulper halfway dawn nudge — one-shot tail
      // the morning AFTER the player crosses the badge runway floor.
      // The journal line already surfaces a "to badge" tail passively
      // but a player who never opens the journal would miss it; this
      // carries the milestone signal directly into the morning toast.
      // ONE-SHOT — the helper bumps a flag on the compost ledger so a
      // second dawn doesn't repeat the nag. Survives reload via the
      // persisted ledger flags.
      const compostNudge = compostHalfwayDawnNudge(this.world.player);
      // Deep Vein dawn brag — one-shot celebratory tail the morning
      // after the player's bestRun crossed a deep-vein threshold for
      // the first time. The helper bumps a flag on the mining-haul
      // state so a re-call returns empty; reload persistence carries
      // the flag through so a player who already saw the brag doesn't
      // get it again after a save/load.
      const deepVeinBrag = deepVeinDawnBrag(getMineHaul(this.world.player));
      // Owl-post chain-tier dawn brag — one-shot celebratory tail the
      // morning AFTER the active chain crossed into a new bonus tier
      // (length 2 -> 1.1x, length 4 -> 1.2x, length 7 -> 1.3x). The
      // helper bumps a flag on OwlStampBook so a re-call returns
      // empty; reload persistence carries the flag through so a
      // player who already saw the brag doesn't get it again after a
      // save/load. Like the deep-vein brag, this is a PLAYER-LEVEL
      // celebration: it fires once per crossing even if the chain
      // itself has reset since the crossing day.
      const chainTierBrag = chainTierDawnBrag(this.world.player);
      // Compost-master-sash dawn brag — one-shot celebratory tail the
      // morning AFTER lifetimeRecycledGold crosses the sash milestone
      // (250g). Same sticky-flag dawn-brag pattern as deep-vein and
      // chain-tier; rides the generic oneShotBrag helper. Survives
      // reload via persistence so a player who crossed the sash just
      // before quitting still sees the brag the next morning on
      // fresh boot.
      const sashBrag = compostMasterSashDawnBrag(this.world.player);
      // Rare-master dawn brag — symmetric one-shot tail the morning
      // AFTER lifetimeRareBagsApplied crosses the rare-master
      // milestone (100). Reads off the separate rare-bag counter so
      // a regular-bag grind doesn't fire it; only rare-day-finished
      // compost batches move the counter.
      const rareMasterBrag = rareMasterDawnBrag(this.world.player);
      // Chain-recipient dawn brag — one-shot celebratory tail the
      // morning AFTER the active chain reaches
      // OWL_CHAIN_RECIPIENT_BRAG_LENGTH (25) consecutive days with one
      // specific NPC. Per-recipient sticky: each NPC earns the brag
      // once, but a separate chain to a DIFFERENT recipient hitting
      // the same threshold later fires its own brag. Slots as the 8th
      // tail on the achievement-cluster — first new tail added since
      // tail-grouping refactor lands this batch.
      const chainRecipientBrag = chainRecipientDawnBrag(this.world.player);
      // Split-record dawn brag — one-shot tail the morning AFTER the
      // mining bestRun transitions from a same-day record (one run
      // holds both leaderboards) into a split-record state (countDay
      // !== goldDay, two different runs hold the two records). Surfaces
      // the "your career has two specialised paths now" moment.
      const splitRecordBrag = splitRecordDawnBrag(getMineHaul(this.world.player));
      // Compose the dawn headline through the generic assembler so the
      // chain of optional tails reads as a single grouped push rather
      // than a string-concat ladder. Tails are split into two groups so
      // the achievement-tier brags read as ONE celebration cluster
      // ("Deep Vein unlocked • Sash earned • Chain in regular tier")
      // rather than seven peer phrases — keeps the dawn toast scannable
      // as the brag set grows.
      const headline = assembleDawnToast(headlineBase, {
        system: [pondOverflow, haulRecap, compostNudge],
        achievement: [
          deepVeinBrag,
          chainTierBrag,
          sashBrag,
          rareMasterBrag,
          chainRecipientBrag,
          splitRecordBrag,
        ],
      });
      this.setToast(headline);
      // Auto-save snapshot at every day rollover — gated by settings.
      if (this.storage && getSettings(this.world.player).autoSave) {
        saveToStorage(this, this.storage);
      }
    }
    // Achievements: check every frame so a milestone (gold, marriage,
    // greenhouse placement) surfaces immediately rather than at next
    // day rollover. tickAchievements is idempotent — earned ids stay.
    const newlyEarned = tickAchievements(this.world.player, this.world, this.time);
    if (newlyEarned.length > 0) {
      const first = newlyEarned[0];
      const tail = newlyEarned.length > 1 ? ` (+${newlyEarned.length - 1})` : '';
      this.setToast(`Achievement unlocked: ${first}${tail}`);
    }
    // Dusk wipe — forage withers once the sun gets low.
    if (!this.forageCleared && isDusk(this.time.hour)) {
      clearForage(this.world);
      this.forageCleared = true;
    }
    // Map TimeOfDay → renderer's [0,1) sky cycle.
    // 06:00 → 0 (dawn), 14:00 → 0.5 (midday), 22:00 → ~0.7 (dusk).
    const dayFraction = (this.time.hour + this.time.minute / 60) / 24;
    this.timeOfDay = (dayFraction + 0.75) % 1;

    // NPC schedule + drift.
    updateNPCs(this.world, this.time, dtMs);
    // NPC ambient barks — fires a small bubble when the player walks
    // within BARK_RADIUS of an NPC for the first time this (day, hour).
    {
      const p = this.world.player;
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      tickBarks(
        this.world,
        p.x,
        p.y,
        this.time.day,
        this.time.hour,
        nowMs,
        dtMs,
      );
    }

    // Farm dog follow movement — soft chase the player when too far.
    updateDog(this.world, this.world.player, dtMs);

    // Hangout: if the player is standing on / next to an open invite's
    // meeting spot during its hour window, fire it. The function is
    // idempotent — the invite is consumed on the first firing so this
    // check is cheap to run every frame.
    {
      const px = Math.round(this.world.player.x);
      const py = Math.round(this.world.player.y);
      const hangout = fireHangoutIfPresent(this.world.player, px, py, this.time);
      if (hangout.kind === 'fired') {
        const name = CANDIDATES[hangout.invite.npcId]?.name ?? hangout.invite.npcId;
        logGold(this.world.player, 120, `hangout: ${name}`, this.time.day);
        this.setToast(`${hangout.invite.flavor} +120g, hearts now ${hangout.heartsAfter}.`);
      }
    }

    // Dialogue lockout countdown.
    this.dialogue.update(dtMs);
    this.cookingMenu.update(dtMs);
    this.sleepSummary.update(dtMs);
    this.chestMenu.update(dtMs);
    this.cartMenu.update(dtMs);
    this.shopMenu.update(dtMs);
    this.benchMenu.update(dtMs);
    this.owlMenu.update(dtMs);
    this.lorePanel.update(dtMs);
    this.recipeCodex.update(dtMs);
    this.cropJournal.update(dtMs);
    this.achievements.update(dtMs);
    this.moneyLogPanel.update(dtMs);
    this.questLogPanel.update(dtMs);
    this.settingsPanel.update(dtMs);
    this.helpOverlay.update(dtMs);
    this.minimapPanel.update(dtMs);
    this.almanacPanel.update(dtMs);
    this.bagPanel.update(dtMs);
    this.heartsPanel.update(dtMs);
    this.onboardingCard.update(dtMs);
    this.toasts.tick(dtMs);

    // One-time welcome card: while it's up it owns the screen. Any key
    // (after the brief open lockout) dismisses it and persists the seen
    // flag so it never returns. We swallow input for the rest of this
    // frame so the dismissing press doesn't also trigger a game action.
    if (this.onboardingCard.isVisible()) {
      if (this.onboardingCard.canDismiss() && this.input.justPressed.size > 0) {
        this.onboardingCard.close();
        markOnboardingSeen(this.storage);
      }
      this.input.clearJustPressed();
      return;
    }

    // Controls help overlay (?) is an input-capturing modal once open: it
    // accepts typed letters/digits as a live filter over the cheat sheet.
    // Handle it BEFORE any other key dispatch so a filter keystroke (e.g.
    // "h", "r") doesn't also toggle the hearts / recipe panels behind it.
    // We let `?` itself fall through so the closing toggle is handled in
    // the normal panel block below. Esc clears the filter first, then
    // closes on the next press.
    if (this.helpOverlay.isVisible() && this.helpOverlay.canAct()) {
      if (this.input.justPressed.has('escape')) {
        if (!this.helpOverlay.clearFilter()) this.helpOverlay.close();
        this.input.clearJustPressed();
        return;
      }
      if (this.input.justPressed.has('backspace')) {
        this.helpOverlay.backspace();
        this.input.clearJustPressed();
        return;
      }
      if (!this.input.justPressed.has('?')) {
        // Feed the first single printable letter/digit into the filter and
        // swallow the rest of this frame's input so nothing leaks through.
        for (const k of this.input.justPressed) {
          if (this.helpOverlay.typeChar(k)) break;
        }
        this.input.clearJustPressed();
        return;
      }
    }

    // Bag search is an input-capturing modal too: once `/` arms it, typed
    // letters build a cross-tab query. Handle it BEFORE any panel-toggle key
    // dispatch so a filter keystroke (e.g. "r", "h", "c") filters the bag
    // instead of toggling another panel underneath. `/` toggles it off, Esc
    // clears then exits, Backspace deletes; arrows still scroll the matches.
    // `tab` is intentionally excluded so it falls through to the bag block
    // below and still closes the whole panel.
    if (
      this.bagPanel.isVisible() &&
      this.bagPanel.canAct() &&
      this.bagPanel.isSearching() &&
      !this.input.justPressed.has('tab')
    ) {
      if (this.input.justPressed.has('escape')) {
        this.bagPanel.clearSearch();
      } else if (this.input.justPressed.has('/')) {
        this.bagPanel.toggleSearch();
      } else if (this.input.justPressed.has('backspace')) {
        this.bagPanel.backspaceSearch();
      } else if (this.input.justPressed.has('arrowdown')) {
        this.bagPanel.scrollDown(this.world.player);
      } else if (this.input.justPressed.has('arrowup')) {
        this.bagPanel.scrollUp();
      } else {
        // Feed the first printable char into the query, swallow the rest.
        for (const k of this.input.justPressed) {
          if (this.bagPanel.typeChar(k)) break;
        }
      }
      this.input.clearJustPressed();
      return;
    }

    // Fishing rod state machine ticks every frame so bite/escape fire even
    // if the player isn't pressing anything. Auto-toast escape events so
    // they don't feel silent.
    const rodBefore = this.rod.state;
    if (this.rod.tick(dtMs)) {
      if (rodBefore === 'biting' && this.rod.state === 'idle') {
        this.setToast('The fish got away…');
      } else if (this.rod.state === 'biting') {
        this.setToast('A bite! Press F to reel!');
      } else if (rodBefore === 'reeling' && this.rod.state === 'idle' && this.rod.lastCatch) {
        const fishKey = this.rod.lastCatch;
        const fish = FISH[fishKey];
        const p2 = this.world.player;
        p2.inventory[`fish-${fishKey}`] = (p2.inventory[`fish-${fishKey}`] ?? 0) + 1;
        // If the player nailed the timing press, award bonus gold and a
        // crisper label; otherwise just show a plain catch toast.
        const grade = this.reelGrade ?? 'miss';
        const bonus = gradeBonus(grade);
        if (bonus > 0) {
          p2.gold += bonus;
          logGold(p2, bonus, `fishing ${fish.name}`, this.time.day);
          this.setToast(`${gradeLabel(grade)} ${fish.name} +${bonus}g`);
        } else {
          this.setToast(`Caught a ${fish.name}!`);
        }
        this.reelLockedCursor = null;
        this.reelGrade = null;
      }
    }

    // Pickaxe state machine ticks every frame so missed strike windows
    // resolve even without input. Auto-toast state transitions.
    const pickBefore = this.pickaxe.state;
    if (this.pickaxe.tick(dtMs)) {
      if (this.pickaxe.state === 'striking') {
        this.setToast('STRIKE! Press M to land it!');
      } else if (pickBefore === 'striking' && this.pickaxe.state === 'idle') {
        this.setToast('The swing glanced off…');
      }
    }

    // Resolve player movement only when no dialogue / menu is up. The
    // minimap is included because it now consumes arrows / WASD to cycle
    // the focused-landmark caption, and it dims the world like a modal.
    const blocked = this.dialogue.isVisible() || this.cookingMenu.isVisible() || this.sleepSummary.isVisible() || this.chestMenu.isVisible() || this.cartMenu.isVisible() || this.shopMenu.isVisible() || this.benchMenu.isVisible() || this.owlMenu.isVisible() || this.minimapPanel.isVisible() || this.bagPanel.isVisible();
    const dir = blocked ? { dx: 0, dy: 0 } : this.input.getDirection();
    this.world.update(dtMs, dir);

    // Hotbar select 1-5.
    const p = this.world.player;
    for (let i = 0; i < CROP_KEYS.length; i++) {
      if (this.input.justPressed.has(String(i + 1))) {
        (p as { selectedSlot?: number }).selectedSlot = i;
      }
    }
    if (this.input.justPressed.has('5')) {
      (p as { selectedSlot?: number }).selectedSlot = CROP_KEYS.length;
    }

    // Toggle hearts panel. While open, `f` cycles the row sort (closeness
    // <-> by-birthday for gift planning). The hearts panel is a non-blocking
    // read-while-walking overlay with no movement verbs of its own, so the
    // panel-local `f` is safe; the fishing `f` is guarded against it below.
    if (this.input.justPressed.has('h')) {
      this.heartsPanel.toggle();
    } else if (this.heartsPanel.isVisible() && this.input.justPressed.has('f')) {
      this.heartsPanel.cycleSort();
    }

    // R: toggle the recipe codex. While open, `f` cycles the discovery
    // filter (all -> cooked -> ready -> undiscovered). The codex is a
    // non-blocking read-while-walking overlay with no a/d nav, so the
    // panel-local `f` is safe; the global fishing `f` is guarded against
    // it below like the lore / almanac / money-log filters.
    if (this.input.justPressed.has('r')) {
      this.recipeCodex.toggle();
    } else if (this.recipeCodex.isVisible() && this.recipeCodex.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.recipeCodex.close();
      } else if (this.input.justPressed.has('f')) {
        this.recipeCodex.cycleFilter();
      }
    }

    // ;: toggle the crop journal panel. On the OPEN transition, spill a
    // one-shot "field care" toast when the field has any dry crop, so the
    // heatmap's neglect signal reaches a player who isn't watching the
    // legend corner. Quiet on a well-tended or empty field.
    if (this.input.justPressed.has(';')) {
      const wasOpen = this.cropJournal.isVisible();
      this.cropJournal.toggle();
      if (!wasOpen && this.cropJournal.isVisible()) {
        const spill = heatmapToastSpill(this.cropFieldSamples());
        if (spill) this.setToast(spill);
      }
    } else if (this.cropJournal.isVisible() && this.cropJournal.canAct() && this.input.justPressed.has('escape')) {
      this.cropJournal.close();
    }

    // V: toggle the achievements panel. While open, `f` cycles the
    // earn-state filter (all -> earned -> locked); arrows / w/s scroll.
    // Non-blocking read-while-walking overlay, so the panel-local `f` is
    // guarded out of the fishing path below like the other filter panels.
    if (this.input.justPressed.has('v')) {
      this.achievements.toggle();
    } else if (this.achievements.isVisible() && this.achievements.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.achievements.close();
      } else if (this.input.justPressed.has('f')) {
        this.achievements.cycleFilter();
      } else if (this.input.justPressed.has('arrowdown') || this.input.justPressed.has('s')) {
        this.achievements.scrollDown(this.world.player);
      } else if (this.input.justPressed.has('arrowup') || this.input.justPressed.has('w')) {
        this.achievements.scrollUp();
      }
    }

    // Q: toggle the money log panel. While open, `f` cycles the category
    // filter (all -> sales -> rewards -> spending). The money-log panel is
    // non-blocking but has no movement verbs, so the panel-local `f` is
    // safe; the global fishing `f` is guarded against it below.
    if (this.input.justPressed.has('q')) {
      this.moneyLogPanel.toggle();
    } else if (this.moneyLogPanel.isVisible() && this.moneyLogPanel.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.moneyLogPanel.close();
      } else if (this.input.justPressed.has('f')) {
        this.moneyLogPanel.cycleFilter();
      }
    }

    // ': toggle the quest log panel. While open, `f` cycles the status
    // filter (all -> active -> done); arrows / w/s scroll. Non-blocking
    // read-while-walking overlay, so the panel-local `f` is guarded out of
    // the fishing path below like the other filter panels.
    if (this.input.justPressed.has("'")) {
      this.questLogPanel.toggle();
    } else if (this.questLogPanel.isVisible() && this.questLogPanel.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.questLogPanel.close();
      } else if (this.input.justPressed.has('f')) {
        this.questLogPanel.cycleFilter();
      } else if (this.input.justPressed.has('arrowdown') || this.input.justPressed.has('s')) {
        this.questLogPanel.scrollDown(this.world.player);
      } else if (this.input.justPressed.has('arrowup') || this.input.justPressed.has('w')) {
        this.questLogPanel.scrollUp();
      }
    }

    // `: toggle the lore / bestiary panel.
    if (this.input.justPressed.has('`')) {
      this.lorePanel.toggle();
    } else if (this.lorePanel.isVisible() && this.lorePanel.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.lorePanel.close();
      } else if (this.input.justPressed.has('arrowright') || this.input.justPressed.has('d')) {
        this.lorePanel.nextTab();
      } else if (this.input.justPressed.has('arrowleft') || this.input.justPressed.has('a')) {
        this.lorePanel.prevTab();
      } else if (this.input.justPressed.has('arrowdown') || this.input.justPressed.has('s')) {
        this.lorePanel.scrollDown(this.world.player);
      } else if (this.input.justPressed.has('arrowup') || this.input.justPressed.has('w')) {
        this.lorePanel.scrollUp();
      } else if (this.input.justPressed.has('f')) {
        // Rumors-tab filter cycle (all -> bought -> skipped). No-op on
        // other tabs — see LorePanel.cycleRumorFilter.
        this.lorePanel.cycleRumorFilter();
      }
    }

    // \: toggle the settings panel.
    if (this.input.justPressed.has('\\')) {
      this.settingsPanel.toggle();
    } else if (this.settingsPanel.isVisible() && this.settingsPanel.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.settingsPanel.close();
      } else if (this.input.justPressed.has('arrowup') || this.input.justPressed.has('w')) {
        this.settingsPanel.selectPrev();
      } else if (this.input.justPressed.has('arrowdown') || this.input.justPressed.has('s')) {
        this.settingsPanel.selectNext();
      } else if (this.input.justPressed.has('enter') || this.input.justPressed.has(' ')) {
        const out = this.settingsPanel.confirm(this.world.player, this.storage);
        if (out.kind === 'cycled') {
          this.setToast(`${out.key}: ${out.value}`);
        } else if (out.kind === 'reset-requested') {
          this.setToast('Press Enter again to ERASE your save.');
        } else if (out.kind === 'reset-done') {
          this.setToast('Save erased. Refresh to start a fresh farm.');
        } else if (out.kind === 'closed') {
          // close() already hides — no toast.
        }
      }
    }

    // ?: open/close the controls help overlay. Opening happens here in
    // the normal flow; once it's open it becomes an input-capturing modal
    // handled by the early block above (so typed filter letters don't also
    // fire other panel toggles). This branch only needs to OPEN it.
    if (this.input.justPressed.has('?')) {
      this.helpOverlay.toggle();
    }

    // 9: toggle the village minimap. While open, arrows / a-d cycle the
    // focused-landmark caption so a mouseless player can identify any pip.
    if (this.input.justPressed.has('9')) {
      this.minimapPanel.toggle();
    } else if (this.minimapPanel.isVisible() && this.minimapPanel.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.minimapPanel.close();
      } else if (
        this.input.justPressed.has('arrowright') ||
        this.input.justPressed.has('arrowdown') ||
        this.input.justPressed.has('d') ||
        this.input.justPressed.has('s')
      ) {
        this.minimapPanel.cycleFocus(this.world, 1);
      } else if (
        this.input.justPressed.has('arrowleft') ||
        this.input.justPressed.has('arrowup') ||
        this.input.justPressed.has('a') ||
        this.input.justPressed.has('w')
      ) {
        this.minimapPanel.cycleFocus(this.world, -1);
      }
    }

    // 0: toggle the almanac of upcoming events. While open, `f` cycles the
    // kind-filter (all -> village -> birthdays -> personal); the global
    // fishing `f` is guarded against the almanac being open below.
    if (this.input.justPressed.has('0')) {
      this.almanacPanel.toggle();
    } else if (this.almanacPanel.isVisible() && this.almanacPanel.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.almanacPanel.close();
      } else if (this.input.justPressed.has('f')) {
        this.almanacPanel.cycleFilter();
      }
    }

    // Tab: toggle the inventory / bag panel. While open, a/d (or arrows)
    // switch category tabs, w/s (or arrows) scroll, `f` cycles the sort, and
    // `/` arms a cross-tab type-to-filter search. The SEARCHING state is an
    // input-capturing modal handled earlier (before any panel-toggle key
    // dispatch) so typed letters can't leak to other panels; this block only
    // runs the non-search controls.
    if (this.input.justPressed.has('tab')) {
      this.bagPanel.toggle();
    } else if (this.bagPanel.isVisible() && this.bagPanel.canAct()) {
      if (this.input.justPressed.has('escape')) {
        this.bagPanel.close();
      } else if (this.input.justPressed.has('/')) {
        this.bagPanel.toggleSearch();
      } else if (this.input.justPressed.has('arrowright') || this.input.justPressed.has('d')) {
        this.bagPanel.nextTab();
      } else if (this.input.justPressed.has('arrowleft') || this.input.justPressed.has('a')) {
        this.bagPanel.prevTab();
      } else if (this.input.justPressed.has('arrowdown') || this.input.justPressed.has('s')) {
        this.bagPanel.scrollDown(this.world.player);
      } else if (this.input.justPressed.has('arrowup') || this.input.justPressed.has('w')) {
        this.bagPanel.scrollUp();
      } else if (this.input.justPressed.has('f')) {
        // `f` cycles the within-category sort (count -> value -> A-Z).
        // Safe to claim here: the gameplay fishing `f` is suppressed while
        // the bag is open (its block guards on !this.bagPanel.isVisible()).
        this.bagPanel.cycleSort();
      }
    }

    // K: manual save. Useful before quitting / before risky moves.
    if (this.input.justPressed.has('k')) {
      if (this.storage && saveToStorage(this, this.storage)) {
        this.setToast('Saved.');
      } else {
        this.setToast('Save failed.');
      }
    }

    // B: bedtime. Fast-forward to dawn and pop the day-summary overlay.
    if (this.input.justPressed.has('b') && !this.sleepSummary.isVisible()) {
      const out = sleepAction(this.world, this.time);
      if (out.kind === 'slept') {
        // Sleep also restores stamina, mirroring the dawn rollover.
        refillStamina(this.world.player, this.time.day);
        // Snapshot today's mining haul into lastRun + clear the
        // running tally. The next dawn toast will read lastRun.
        // Pass the day so the bestRun ribbon captures `countDay` /
        // `goldDay` when a new record falls.
        resetMineHaul(this.world.player, this.time.day);
        this.sleepSummary.open(out.summary);
        if (this.storage) saveToStorage(this, this.storage);
      } else if (out.kind === 'not-at-farmhouse') {
        this.setToast('Stand by the farmhouse to sleep.');
      } else if (out.kind === 'too-early') {
        this.setToast(`Too early to sleep (after ${out.until}:00).`);
      }
    }

    // Z: drink the best stamina-restoring dish in the bag (hot cocoa > tea).
    if (this.input.justPressed.has('z')) {
      const out = drinkBest(this.world.player);
      if (out.kind === 'drank') {
        const pretty = out.key.replace('dish-', '').replace('-', ' ');
        this.setToast(`Sipped ${pretty}. +${out.restored} stamina.`);
      } else if (out.kind === 'no-drink') {
        this.setToast('No tea or cocoa in your bag.');
      } else if (out.kind === 'already-full') {
        this.setToast('Already at full stamina.');
      }
    }

    // O: place / remove a sprinkler on the tile in front of the player.
    if (this.input.justPressed.has('o')) {
      const front = this.tileInFront();
      const here = sprinklerAt(this.world, front.tx, front.ty);
      if (here) {
        removeSprinkler(this.world, front.tx, front.ty);
        p.inventory[sprinklerInventoryKey(here.kind)] =
          (p.inventory[sprinklerInventoryKey(here.kind)] ?? 0) + 1;
        this.setToast('Picked up sprinkler.');
      } else {
        // Place the first sprinkler kind the player has in stock.
        const candidates: SprinklerKey[] = ['basic'];
        let placed = false;
        for (const k of candidates) {
          if ((p.inventory[sprinklerInventoryKey(k)] ?? 0) > 0) {
            if (placeSprinkler(this.world, front.tx, front.ty, k)) {
              p.inventory[sprinklerInventoryKey(k)]! -= 1;
              this.setToast(`Placed ${k} sprinkler.`);
              placed = true;
              break;
            }
          }
        }
        if (!placed) {
          this.setToast('Need a tilled tile and a sprinkler in your bag.');
        }
      }
    }

    // Y: pick up the forage on the tile in front of the player. Plain
    // grass-tile pickups so the player never has to mash E + risk
    // talking to an NPC overlapping the same column.
    if (this.input.justPressed.has('y')) {
      const front = this.tileInFront();
      const here = forageAt(this.world, front.tx, front.ty);
      if (here) {
        const kind = pickupForage(this.world, p, front.tx, front.ty);
        if (kind) {
          this.setToast(`Picked ${FORAGE[kind].name}.`);
        }
      } else {
        this.setToast('Nothing to forage here.');
      }
    }

    // N: place a chicken coop on the COOP_W x COOP_H grass footprint
    // starting at the tile in front of the player. Consumes one coop
    // kit from the bag on success.
    if (this.input.justPressed.has('n')) {
      const front = this.tileInFront();
      const have = p.inventory[COOP_INVENTORY_KEY] ?? 0;
      if (have <= 0) {
        this.setToast('Buy a coop kit from Vallie first.');
      } else if (canPlaceCoop(this.world, front.tx, front.ty)) {
        if (placeCoop(this.world, front.tx, front.ty)) {
          p.inventory[COOP_INVENTORY_KEY] = have - 1;
          this.setToast('Placed a coop. Buy chickens to fill it.');
        }
      } else {
        this.setToast(`Need a clear ${COOP_W}x${COOP_H} grass patch.`);
      }
    }

    // I: add a chicken to the adjacent coop, consuming one from the bag.
    if (this.input.justPressed.has('i')) {
      const front = this.tileInFront();
      const coop = adjacentCoop(this.world, front.tx, front.ty);
      const have = p.inventory['chicken'] ?? 0;
      if (!coop) {
        this.setToast('Stand next to a coop first.');
      } else if (have <= 0) {
        this.setToast('No chickens in your bag. Buy one from Maple.');
      } else if (coop.chickens >= MAX_CHICKENS_PER_COOP) {
        this.setToast(`Coop is full (${MAX_CHICKENS_PER_COOP} max).`);
      } else if (addChicken(coop)) {
        p.inventory['chicken'] = have - 1;
        this.setToast(`Chicken added (${coop.chickens}/${MAX_CHICKENS_PER_COOP}).`);
      }
    }

    // J: adopt the dog (consumes a ticket from the bag) on first press,
    // pet the dog on subsequent presses. Cozy morale loop — the streak
    // gold posts at the next morning's rollover.
    if (this.input.justPressed.has('j')) {
      const dog = getDog(this.world);
      if (!dog.owned) {
        const have = p.inventory[DOG_TICKET_KEY] ?? 0;
        if (have > 0) {
          if (adoptDog(this.world, p)) {
            this.setToast('A scruffy farm dog trots up — adopted!');
          }
        } else {
          this.setToast('Buy a Farm Dog Ticket from Vallie first.');
        }
      } else if (canPet(this.world, p)) {
        const out = petDog(this.world, p, this.time);
        if (out.kind === 'petted') {
          this.setToast(`Pet the dog. Streak ${out.streak} (+${out.bonus}g tomorrow).`);
        } else if (out.kind === 'already-today') {
          // Already petted today — try a treat. A stamina tea bumps
          // the streak by +1 (capped). Falls back to the regular
          // already-today line when the bag has no tea.
          const treat = treatDog(this.world, p, this.time);
          if (treat.kind === 'treated') {
            this.setToast(
              `Treat for the dog (${treat.treatKey.replace('dish-', '')}). Streak ${treat.streak} (+${treat.bonus}g tomorrow).`,
            );
          } else if (treat.kind === 'at-cap') {
            this.setToast(`Already petted today — streak ${getDog(this.world).petStreak} is at the cap.`);
          } else {
            this.setToast('Already petted today — come back tomorrow (or with a stamina tea).');
          }
        }
      } else {
        this.setToast('Walk closer to the dog to pet it.');
      }
    }

    // -: adopt the cat on first press, pet the cat on subsequent presses.
    // Cat sits on the farmhouse roof — stand near the farmhouse to pet.
    if (this.input.justPressed.has('-')) {
      const cat = getCat(this.world);
      if (!cat.owned) {
        const have = p.inventory[CAT_TICKET_KEY] ?? 0;
        if (have > 0) {
          if (adoptCat(this.world, p)) {
            this.setToast('A grey tabby kitten settles on your farmhouse roof.');
          }
        } else {
          this.setToast('Buy a Kitten Ticket from Vallie first.');
        }
      } else if (canPetCat(this.world, p)) {
        const out = petCat(this.world, p, this.time);
        if (out.kind === 'petted') {
          this.setToast(`Pet the cat. Streak ${out.streak} (+${out.bonus}g tomorrow).`);
        } else if (out.kind === 'already-today') {
          // Already petted today — try a treat. Same flow as the dog.
          const treat = treatCat(this.world, p, this.time);
          if (treat.kind === 'treated') {
            this.setToast(
              `Treat for the cat (${treat.treatKey.replace('dish-', '')}). Streak ${treat.streak} (+${treat.bonus}g tomorrow).`,
            );
          } else if (treat.kind === 'at-cap') {
            this.setToast(`The cat has had enough — streak ${getCat(this.world).petStreak} is at the cap.`);
          } else {
            this.setToast('The cat has had enough scritches for today (try a stamina tea).');
          }
        }
      } else {
        this.setToast('Stand by the farmhouse to pet the cat.');
      }
    }

    // U: place a greenhouse kit on a 3x3 grass footprint in front of the player.
    if (this.input.justPressed.has('u')) {
      const front = this.tileInFront();
      const have = p.inventory[GREENHOUSE_INVENTORY_KEY] ?? 0;
      if (have <= 0) {
        this.setToast('Buy a Greenhouse Kit from Vallie first.');
      } else if (canPlaceGreenhouse(this.world, front.tx, front.ty)) {
        if (placeGreenhouse(this.world, front.tx, front.ty)) {
          p.inventory[GREENHOUSE_INVENTORY_KEY] = have - 1;
          this.setToast('Greenhouse erected. Plant inside for fast growth.');
        }
      } else {
        this.setToast(`Need a clear ${GREENHOUSE_W}x${GREENHOUSE_H} grass patch.`);
      }
    }

    // [: read the next unread letter from the farmhouse mailbox.
    if (this.input.justPressed.has('[')) {
      if (!this.isAtFarmhouseSimple()) {
        this.setToast('Stand near the farmhouse to check the mailbox.');
      } else {
        const letter = readNextLetter(p);
        if (!letter) {
          const left = unreadCount(p);
          if (left === 0) this.setToast('No new letters in the mailbox.');
        } else {
          const author = MAIL_CANDIDATES[letter.npcId]?.name ?? letter.npcId;
          this.dialogue.open(author, `Letter delivered day ${letter.deliveredDay}`, letter.body);
        }
      }
    }

    // ~: summon the owl post (near the farmhouse mailbox). Cheaper than
    // a village walk on rainy days; harder to abuse than face-to-face
    // gifts because it costs gold.
    if (this.input.justPressed.has('~')) {
      if (!this.isAtFarmhouseSimple()) {
        this.setToast('Stand near the farmhouse to call the owl.');
      } else {
        // Pass the player so owlCandidateIdsForMenu hoists the active
        // chain target to the top — a player riding a chain sees their
        // current recipient at the front of the list without scrolling.
        this.owlMenu.open(this.world.player);
      }
    }

    // ]: open the adjacent chest (deposit / withdraw).
    if (this.input.justPressed.has(']') && !this.chestMenu.isVisible()) {
      const front = this.tileInFront();
      const chest =
        adjacentChest(this.world, front.tx, front.ty) ??
        adjacentChest(this.world, Math.round(p.x), Math.round(p.y));
      if (chest) {
        this.chestMenu.open(chest);
      } else {
        this.setToast('No chest nearby.');
      }
    }

    // X: place a new chest from a chest-kit (one tile in front of the player).
    if (this.input.justPressed.has('x')) {
      const front = this.tileInFront();
      const have = p.inventory[CHEST_INVENTORY_KEY] ?? 0;
      if (have <= 0) {
        this.setToast('Buy a Chest Kit from Vallie first.');
      } else if (canPlaceChest(this.world, front.tx, front.ty)) {
        if (placeChest(this.world, front.tx, front.ty)) {
          p.inventory[CHEST_INVENTORY_KEY] = have - 1;
          this.setToast('Placed a chest.');
        }
      } else {
        this.setToast('Need a clear grass tile in front of you.');
      }
    }

    // L: run the seed extractor — consumes one of the most-abundant
    // harvest in the bag, grants 1-2 seeds of the same crop.
    if (this.input.justPressed.has('l')) {
      if (!hasExtractor(p)) {
        this.setToast('Buy a Seed Extractor from Vallie first.');
      } else {
        const out = runExtract(p);
        if (out.kind === 'extracted') {
          this.setToast(
            `Extractor: -1 ${out.cropKey} harvest, +${out.seedsAdded} ${out.cropKey} seed${out.seedsAdded === 1 ? '' : 's'}.`,
          );
        } else if (out.kind === 'no-harvest') {
          this.setToast('No harvested crops in your bag to extract from.');
        }
      }
    }

    // {: plant a crafted scarecrow on the grass tile in front of you.
    // The bracket key was free; we keep the matching `}` available for
    // a future "pack up scarecrow" action.
    if (this.input.justPressed.has('{')) {
      const front = this.tileInFront();
      const have = p.inventory[SCARECROW_INVENTORY_KEY] ?? 0;
      if (have <= 0) {
        this.setToast('Craft a Scarecrow at the bench first.');
      } else if (placeScarecrow(this.world, front.tx, front.ty)) {
        p.inventory[SCARECROW_INVENTORY_KEY] = have - 1;
        this.setToast('Scarecrow planted. Nearby crops will harvest a tier higher.');
      } else {
        this.setToast('Need a clear grass tile in front of you.');
      }
    }

    // }: apply a Coop Deluxe Upgrade Kit to the adjacent coop. Bumps
    // the coop's fancy-egg odds; the kit is consumed.
    if (this.input.justPressed.has('}')) {
      const have = p.inventory['craft-coop-deluxe'] ?? 0;
      if (have <= 0) {
        this.setToast('Craft a Coop Deluxe Upgrade Kit at the bench first.');
      } else {
        const front = this.tileInFront();
        const coop =
          adjacentCoop(this.world, front.tx, front.ty) ??
          adjacentCoop(this.world, Math.round(p.x), Math.round(p.y));
        if (!coop) {
          this.setToast('Stand by a coop to apply the upgrade.');
        } else if ((coop.tier ?? 'basic') === 'deluxe') {
          this.setToast('This coop is already deluxe.');
        } else if (upgradeCoop(coop, 'deluxe')) {
          p.inventory['craft-coop-deluxe'] = have - 1;
          this.setToast('Coop upgraded to deluxe. Fancy eggs are more common.');
        }
      }
    }

    // >: interact with the farm pond — stock with the most-abundant
    // fish in the bag on first press, collect pending yield on later
    // presses. Reuses the same key for both verbs since the pond's
    // state unambiguously picks one or the other.
    if (this.input.justPressed.has('>')) {
      const px = Math.round(p.x);
      const py = Math.round(p.y);
      const out = interactPond(this.world, p, px, py);
      if (out.kind === 'too-far') {
        this.setToast('Stand next to the farm pond.');
      } else if (out.kind === 'stocked') {
        this.setToast(`Stocked the pond with a ${out.label}. Come back tomorrow.`);
      } else if (out.kind === 'restocked') {
        this.setToast(
          `Swapped the pond from ${out.fromLabel} to ${out.toLabel}. New yield starts tomorrow.`,
        );
      } else if (out.kind === 'collected') {
        this.setToast(
          `Collected ${out.count} ${out.label}${out.count === 1 ? '' : 's'} from the pond.`,
        );
      } else if (out.kind === 'nothing-pending') {
        this.setToast(pondStatusLine(getPond(this.world), this.world.player));
      } else if (out.kind === 'empty-no-fish') {
        this.setToast('No fish in your bag — catch one first to stock the pond.');
      }
    }

    // 6: hatchery interactions. Three modes, in priority order:
    //   - Standing on/next to a hatchery + holding a kit AND we want to
    //     PLACE a new one: only fires if we are NOT already adjacent to
    //     an existing hatchery (otherwise the press is for the existing).
    //   - Adjacent to an existing hatchery: load an egg, claim a pending
    //     chick, or report status.
    //   - Otherwise, try to place a new hatchery on the tile in front
    //     when the player has a kit in the bag.
    if (this.input.justPressed.has('6')) {
      const front = this.tileInFront();
      const px = Math.round(p.x);
      const py = Math.round(p.y);
      const standing = adjacentHatchery(this.world, px, py);
      if (standing) {
        if (standing.pendingChicken) {
          const wasHeritage = Boolean(standing.pendingHeritage);
          const moved = claimPendingChicken(this.world, standing);
          if (moved) {
            const breed = wasHeritage ? 'heritage chick' : 'chick';
            this.setToast(
              `Moved the ${breed} into a coop (${moved.chickens}/${MAX_CHICKENS_PER_COOP}).`,
            );
          } else {
            this.setToast('Every coop is still full. Free up a slot first.');
          }
        } else {
          const out = loadEgg(standing, p, this.time.day);
          if (out.kind === 'loaded') {
            this.setToast('Fancy egg in the hatchery. Hatch in 5 days.');
          } else if (out.kind === 'busy') {
            this.setToast(`Hatchery already running. ${out.daysLeft} day${out.daysLeft === 1 ? '' : 's'} left.`);
          } else if (out.kind === 'no-egg') {
            this.setToast('Need a fancy egg in your bag to start the hatchery.');
          } else if (out.kind === 'pending') {
            this.setToast(hatcheryStatusLine(standing, this.time.day));
          }
        }
      } else {
        const have = p.inventory[HATCHERY_INVENTORY_KEY] ?? 0;
        if (have <= 0) {
          this.setToast('Craft a Hatchery Basket at the bench first.');
        } else if (canPlaceHatchery(this.world, front.tx, front.ty)) {
          if (placeHatchery(this.world, front.tx, front.ty)) {
            p.inventory[HATCHERY_INVENTORY_KEY] = have - 1;
            this.setToast('Placed the hatchery. Press 6 again with a fancy egg.');
          }
        } else {
          this.setToast('Hatchery needs a clear grass tile next to a coop.');
        }
      }
    }

    // 7: compost loop, context-sensitive in priority order:
    //   1. Standing next to a bin -> deposit normal-tier harvests.
    //   2. Crop in front + fertilizer in bag -> apply fertilizer.
    //   3. Carrying a bin kit -> place on the grass tile in front.
    //   4. Otherwise -> status hint.
    if (this.input.justPressed.has('7')) {
      const front = this.tileInFront();
      const px = Math.round(p.x);
      const py = Math.round(p.y);
      const bin = adjacentCompost(this.world, px, py);
      const crop = cropAt(this.world, front.tx, front.ty);
      const hasFert =
        (p.inventory[FERTILIZER_INVENTORY_KEY] ?? 0) > 0 ||
        (p.inventory[RARE_FERTILIZER_INVENTORY_KEY] ?? 0) > 0;
      if (bin) {
        const out = depositCrops(bin, p, this.time.day);
        if (out.kind === 'deposited') {
          const rareDay = rareFinishDayFor(this.time.season);
          const rareTag = out.finishOnDay === rareDay
            ? ' RARE day — bags will be premium.'
            : '';
          this.setToast(
            `Composted ${out.crops} crop${out.crops === 1 ? '' : 's'}. Ready in 3 days.${rareTag}`,
          );
        } else if (out.kind === 'no-crops') {
          this.setToast(compostStatusLine(bin, this.time.day, this.time.season, this.time.day));
        } else if (out.kind === 'bin-full') {
          this.setToast('Compost bin is full. Wait for batches to finish.');
        }
      } else if (crop && hasFert) {
        const out = applyFertilizer(this.world, p, front.tx, front.ty);
        if (out.kind === 'applied') {
          const tag = out.rare ? 'Rare fertilizer applied' : 'Fertilized';
          // The recycle is already credited on `p.gold` by applyFertilizer;
          // we just need to add a money-log entry and a "+Ng" tail on the
          // toast so the player sees the recycle as a real reward.
          if (out.recycledGold > 0) {
            logGold(p, out.recycledGold, 'compost recycle', this.time.day);
          }
          const goldTail = out.recycledGold > 0
            ? ` (+${out.recycledGold}g recycled)`
            : '';
          this.setToast(
            `${tag} — streak now ${out.newStreak} (+${out.bonus}).${goldTail}`,
          );
        }
      } else {
        const have = p.inventory[COMPOST_BIN_INVENTORY_KEY] ?? 0;
        if (have <= 0) {
          this.setToast('Buy a compost bin from Maple.');
        } else if (canPlaceCompost(this.world, front.tx, front.ty)) {
          if (placeCompost(this.world, front.tx, front.ty)) {
            p.inventory[COMPOST_BIN_INVENTORY_KEY] = have - 1;
            this.setToast('Placed compost bin. Press 7 with a crop bag nearby.');
          }
        } else {
          this.setToast('Need a clear grass tile in front of you.');
        }
      }
    }

    // 8: place a crafted storm shelter on the tile in front. Each one
    // protects the 3x3 around it from the next storm, then is spent.
    if (this.input.justPressed.has('8')) {
      const front = this.tileInFront();
      const have = p.inventory[STORM_SHELTER_INVENTORY_KEY] ?? 0;
      if (have <= 0) {
        this.setToast('Craft a Storm Shelter at the bench first.');
      } else if (canPlaceShelter(this.world, front.tx, front.ty)) {
        const placed = placeShelter(this.world, front.tx, front.ty);
        if (placed) {
          p.inventory[STORM_SHELTER_INVENTORY_KEY] = have - 1;
          if (isPaired(this.world, placed)) {
            this.setToast(
              'Storm shelter placed and paired. Pair coverage widens to a 5x5 next storm.',
            );
          } else {
            this.setToast(
              'Storm shelter placed. Crops within 1 tile stay dry next storm.',
            );
          }
        }
      } else {
        this.setToast('Need a clear grass or tilled tile in front of you.');
      }
    }

    // Dialogue dismiss
    if (this.sleepSummary.isVisible()) {
      // Sleep summary takes priority — it locks the world. Wait until it's
      // dismissible (fade-in done), then accept any meaningful key to close.
      if (this.sleepSummary.canDismiss()) {
        const dismissKeys = ['e', ' ', 'enter', 'escape', 'b'];
        for (const k of dismissKeys) {
          if (this.input.justPressed.has(k)) {
            this.sleepSummary.close();
            break;
          }
        }
      }
    } else if (this.dialogue.canDismiss()) {
      // Any meaningful key dismisses.
      const dismissKeys = ['e', ' ', 'enter', 'escape'];
      for (const k of dismissKeys) {
        if (this.input.justPressed.has(k)) {
          this.dialogue.close();
          break;
        }
      }
    } else if (this.cookingMenu.isVisible()) {
      // Cooking menu input — only when fully open (lockout cleared).
      if (this.cookingMenu.canAct()) {
        const i = this.input.justPressed;
        if (i.has('escape') || i.has('c')) {
          this.cookingMenu.close();
        } else if (i.has('arrowup') || i.has('w')) {
          this.cookingMenu.selectPrev();
        } else if (i.has('arrowdown') || i.has('s')) {
          this.cookingMenu.selectNext();
        } else if (i.has('enter') || i.has(' ')) {
          // Shift+Enter (or Shift+Space) fires the stamina-tea double-batch
          // path: 2x ingredients -> 3 dishes. Falls back to single cook for
          // every other case so the keypress is never wasted.
          const shiftHeld = this.input.isPressed('shift');
          const mode = shiftHeld ? 'double' : 'single';
          const outcome = this.cookingMenu.confirm(this.world.player, mode);
          if (outcome.kind === 'cooked') {
            recordCook(this.world.player, outcome.recipe);
            // The single-yield path mints exactly one dish per record;
            // double-batch mints DOUBLE_BATCH_DISH_YIELD=3 — bump the
            // cook history three times so the achievement / "10 dishes"
            // milestones see the full cook count, mirroring how the
            // player feels the bowl filling.
            for (let n = 1; n < outcome.yield; n++) {
              recordCook(this.world.player, outcome.recipe);
            }
            const label =
              outcome.mode === 'double'
                ? `Double-batched ${outcome.name}! (+${outcome.yield})`
                : `Cooked ${outcome.name}!`;
            this.setToast(label);
            this.checkQuests({ kind: 'cook', dishKey: outcome.recipe });
          } else if (outcome.kind === 'not-eligible-double') {
            this.setToast(`${outcome.name} can't double-batch — only stamina teas.`);
          } else if (outcome.kind === 'missing') {
            const recipe = RECIPES[outcome.recipe];
            const mult = outcome.mode === 'double' ? 2 : 1;
            const need = recipe.ingredients
              .map((ing) => `${ing.count * mult}× ${ing.key.replace('_harvest', '').replace('fish-', '')}`)
              .join(', ');
            this.setToast(`Need ${need}.`);
          }
          // recordPremiumCook is reserved for the future inn-cooking flow;
          // expose the import here so the bookkeeping helper stays close
          // to its sibling recordCook. (Premium swap is still surfaced
          // via canCookPremium / cookPremium on cooking.ts.)
          void recordPremiumCook;
        }
      }
    } else if (this.chestMenu.isVisible()) {
      // Chest menu input — only when fully open (lockout cleared).
      if (this.chestMenu.canAct()) {
        const i = this.input.justPressed;
        if (i.has('escape') || i.has(']')) {
          this.chestMenu.close();
        } else if (i.has('arrowup') || i.has('w')) {
          this.chestMenu.selectPrev();
        } else if (i.has('arrowdown') || i.has('s')) {
          this.chestMenu.selectNext();
        } else if (i.has('enter') || i.has(' ')) {
          const out = this.chestMenu.withdrawOne(this.world.player);
          if (out.kind === 'withdrew') {
            this.setToast(`Withdrew 1 ${out.key.replace('_harvest', '')}.`);
          } else if (out.kind === 'empty') {
            this.setToast('Chest is empty.');
          }
        } else if (i.has('tab')) {
          const out = this.chestMenu.depositAllHarvest(this.world.player);
          if (out.kind === 'deposited') {
            this.setToast(`Deposited ${out.count} harvest item${out.count === 1 ? '' : 's'}.`);
          } else {
            this.setToast('Nothing to deposit.');
          }
        }
      }
    } else if (this.cartMenu.isVisible()) {
      // Cart menu input — only when fully open (lockout cleared).
      if (this.cartMenu.canAct()) {
        const i = this.input.justPressed;
        if (i.has('escape') || i.has('e')) {
          this.cartMenu.close();
        } else if (i.has('arrowup') || i.has('w')) {
          this.cartMenu.selectPrev();
        } else if (i.has('arrowdown') || i.has('s')) {
          this.cartMenu.selectNext();
        } else if (i.has('enter') || i.has(' ')) {
          const px = Math.round(this.world.player.x);
          const py = Math.round(this.world.player.y);
          const out = this.cartMenu.confirm(this.world.player, px, py, this.time);
          if (out.kind === 'bought') {
            logGold(this.world.player, -out.item.buyPrice, `cart: ${out.item.label}`, this.time.day);
            const baroLine = out.item.key === BAROMETER_INVENTORY_KEY
              ? ` ${barometerBoughtLine()}`
              : '';
            // Rumor rebate: 5% gold-back when the player buys the
            // headliner Pip teased last visit. Paid AFTER the buy so
            // the regular cost shows in the toast.
            let rebateLine = '';
            let postBuyGold = out.remainingGold;
            if (isCurrentHeadlinerKey(this.time.season, out.item.key)) {
              const rebate = rumorRebateAmount(out.item.buyPrice);
              if (rebate > 0) {
                this.world.player.gold += rebate;
                logGold(this.world.player, rebate, `cart: rumor rebate (${out.item.label})`, this.time.day);
                rebateLine = ` Pip nods — rebate +${rebate}g for grabbing the headliner.`;
                postBuyGold = out.remainingGold + rebate;
              }
              // Rumor STREAK discount — three headliners in a row stack
              // a 5g/step refund (capped at 15g). Read the streak BEFORE
              // recordRumorBuy stamps this one so it reflects the
              // PRIOR run of bought headliners, not the one we're about
              // to record. Refunded as gold post-buy, mirroring rebate.
              const streakDisc = buyRumorStreakDiscount(
                this.world.player,
                this.time.season,
                out.item.key,
                out.item.buyPrice,
              );
              if (streakDisc > 0) {
                this.world.player.gold += streakDisc;
                logGold(this.world.player, streakDisc, `cart: rumor streak (${out.item.label})`, this.time.day);
                rebateLine += ` Streak refund +${streakDisc}g.`;
                postBuyGold += streakDisc;
              }
              // Stamp the rumor-history entry as bought. The history
              // entry was created on cart-menu open via
              // recordRumorVisit(); the buy upgrades it from 'skipped'
              // to 'bought'.
              recordRumorBuy(this.world.player, this.time.season, out.item.key);
            }
            this.setToast(`Bought ${out.item.label}. (${postBuyGold}g left)${baroLine}${rebateLine}`);
          } else if (out.kind === 'refilled') {
            logGold(this.world.player, -out.item.buyPrice, `cart: ${out.item.label}`, this.time.day);
            this.setToast(
              `Refilled spa pass: ${out.punches} punch${out.punches === 1 ? '' : 'es'} on the card. (${out.remainingGold}g left)`,
            );
          } else if (out.kind === 'refill-not-eligible') {
            if (out.reason === 'no-pass') {
              this.setToast("Pip eyes you — \"Buy a Spa Pass first; refills are for return customers.\"");
            } else {
              this.setToast("Your spa pass still has punches left — soak through them first.");
            }
          } else if (out.kind === 'already-owned') {
            this.setToast(`You already own ${out.item.label}.`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g (have ${out.have}g).`);
          } else if (out.kind === 'closed') {
            this.setToast("Pip's already packed up for the day.");
            this.cartMenu.close();
          } else if (out.kind === 'too-far') {
            this.setToast('Stand by the cart.');
            this.cartMenu.close();
          }
        }
      }
    } else if (this.shopMenu.isVisible()) {
      // Shop menu input — only when fully open (lockout cleared).
      if (this.shopMenu.canAct()) {
        const i = this.input.justPressed;
        if (i.has('escape') || i.has('e')) {
          this.shopMenu.close();
        } else if (i.has('arrowup') || i.has('w')) {
          this.shopMenu.selectPrev();
        } else if (i.has('arrowdown') || i.has('s')) {
          this.shopMenu.selectNext();
        } else if (i.has('tab') || i.has('arrowright') || i.has('d')) {
          this.shopMenu.nextCategory();
        } else if (i.has('arrowleft') || i.has('a')) {
          this.shopMenu.prevCategory();
        } else if (i.has('enter') || i.has(' ')) {
          const out = this.shopMenu.confirm(this.world.player);
          if (out.kind === 'bought') {
            logGold(this.world.player, -out.row.price, `shop: ${out.row.label}`, this.time.day);
            this.setToast(`Bought ${out.row.label}. (${out.remainingGold}g left)`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g (have ${out.have}g).`);
          } else if (out.kind === 'already-owned') {
            this.setToast(`You already own ${out.row.label}.`);
          }
        }
      }
    } else if (this.benchMenu.isVisible()) {
      // Carpenter's bench input — same gating as the shop menu.
      if (this.benchMenu.canAct()) {
        const i = this.input.justPressed;
        if (i.has('escape') || i.has('e')) {
          this.benchMenu.close();
        } else if (i.has('arrowup') || i.has('w')) {
          this.benchMenu.selectPrev();
        } else if (i.has('arrowdown') || i.has('s')) {
          this.benchMenu.selectNext();
        } else if (i.has('enter') || i.has(' ')) {
          const out = this.benchMenu.confirm(this.world.player);
          if (out.kind === 'crafted') {
            logGold(this.world.player, -out.recipe.gold, `bench: ${out.recipe.label}`, this.time.day);
            this.setToast(`Crafted ${out.recipe.label}.`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g (have ${out.have}g).`);
          } else if (out.kind === 'not-enough-gems') {
            this.setToast(`Need ${out.need}x ${out.gemKey} (have ${out.have}).`);
          }
        }
      }
    } else if (this.owlMenu.isVisible()) {
      // Owl post input — Up/Down picks candidate, Enter dispatches.
      if (this.owlMenu.canAct()) {
        const i = this.input.justPressed;
        if (i.has('escape') || i.has('~') || i.has('`')) {
          this.owlMenu.close();
        } else if (i.has('arrowup') || i.has('w')) {
          this.owlMenu.selectPrev();
        } else if (i.has('arrowdown') || i.has('s')) {
          this.owlMenu.selectNext();
        } else if (i.has('enter') || i.has(' ')) {
          const out = this.owlMenu.confirm(this.world.player, this.time.day, this.time);
          if (out.kind === 'sent') {
            // Log the ACTUAL fee paid (tier-discounted). dispatchOwl
            // deducted owlPostFeeFor(player, npcId) — the menu's
            // confirm() snapshot has the same value. Without this
            // recompute the money log would over-report fees for
            // discounted (regular / favorite) tier sends.
            const feePaid = owlPostFeeFor(this.world.player, out.npcId);
            logGold(this.world.player, -feePaid, `owl post: ${out.npcName}`, this.time.day);
            // attemptAutoGift already credited hearts; surface a toast
            // matching the existing in-person gift feel. The chain
            // tail is appended only when the chain hit a bonus tier
            // (chainMultiplier > 1) so a 1-day fresh streak doesn't
            // surface noise on every send.
            if (out.gift.kind === 'gifted') {
              const tasteLine =
                out.gift.result.taste === 'loved'
                  ? 'beams at the gift'
                  : out.gift.result.taste === 'liked'
                    ? 'smiles, charmed'
                    : 'nods politely';
              const chainTail =
                out.chainMultiplier > 1
                  ? ` Letter chain x${out.chainLength} (+${Math.round((out.chainMultiplier - 1) * 100)}%).`
                  : '';
              this.setToast(`Owl post: ${out.npcName} ${tasteLine}. +${out.gift.result.pointsApplied} pts.${chainTail}`);
            }
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g (have ${out.have}g).`);
          } else if (out.kind === 'already-today') {
            this.setToast(`Already gifted ${out.npcName} today.`);
          } else if (out.kind === 'no-items') {
            this.setToast(`Nothing nice in your bag to send ${out.npcName}.`);
          }
        }
      }
    } else if (!this.dialogue.isVisible() && !this.bagPanel.isVisible()) {
      // Gameplay actions
      const front = this.tileInFront();
      // C: open the cooking menu when standing on/adjacent to the inn.
      if (this.input.justPressed.has('c')) {
        if (this.isNearInn()) {
          // Inn forage trade-in — auto-fires on cooking menu open
          // right before we surface the menu. Mirrors the cart-side
          // auto-trade stack (tradeBreederEggs -> tradeStaminaTeas)
          // so the player doesn't learn a new keybind. Silent when
          // the bag doesn't carry enough forage so the trade path
          // doesn't toast on every menu open.
          const innOut = tradeForageForTea(this.world.player, true);
          if (innOut.kind === 'traded') {
            this.setToast(innForageTradeToastLine(innOut));
          }
          this.cookingMenu.open();
        } else {
          this.setToast('Stand near the inn to cook.');
        }
      }
      // F: fishing — reel during a bite, lock-in timing during reel,
      // otherwise try to cast into water. Suppressed when any panel that
      // binds `f` to a filter/sort is open and active (lore, almanac,
      // money-log, recipe-codex, quest-log, hearts, achievements), so a
      // stray cast can't fire underneath.
      if (this.input.justPressed.has('f') && !this.lorePanel.isVisible() && !this.almanacPanel.isVisible() && !this.moneyLogPanel.isVisible() && !this.recipeCodex.isVisible() && !this.questLogPanel.isVisible() && !this.heartsPanel.isVisible() && !this.achievements.isVisible()) {
        if (this.rod.state === 'biting') {
          this.rod.reel();
        } else if (this.rod.state === 'reeling' && this.reelLockedCursor === null) {
          // Player tapped F during the timing minigame — lock the cursor
          // position and grade it. We don't change rod state; the cozy
          // reel animation finishes on its own.
          const cursor = cursorPosition(this.rod.elapsedMs);
          this.reelLockedCursor = cursor;
          this.reelGrade = gradeReel(cursor);
        } else if (this.rod.state === 'idle') {
          if (canCastInto(this.world, front.tx, front.ty)) {
            if (!spendStamina(p, STAMINA_COST.cast)) {
              this.setToast('Too tired to cast. Sleep or sip cocoa (Z).');
            } else {
              const biteWindowMs = rodBiteWindowFor(p);
              // Combine rod-tier bias with the late-night perk so a
              // 22-04h cast biases toward trout / pike on top of the
              // rod's own catalog rebalance.
              const fishPicker = (rng: () => number) => nightAwareFishPick(p, this.time, rng);
              if (this.rod.cast({ biteWindowMs, fishPicker })) {
                this.reelLockedCursor = null;
                this.reelGrade = null;
                if (isLateNightFishing(this.time)) {
                  this.setToast(`Cast! ${nightFlavorLine()}`);
                } else {
                  this.setToast('Cast! Wait for a bite…');
                }
              } else {
                getStamina(p).current = Math.min(getStamina(p).max, getStamina(p).current + STAMINA_COST.cast);
              }
            }
          } else {
            this.setToast('Stand facing water to cast.');
          }
        } else {
          // Mid-cast / waiting — let F cancel cleanly.
          this.rod.cancel();
          this.reelLockedCursor = null;
          this.reelGrade = null;
          this.setToast('Reeled in early.');
        }
      }
      // M: mining — strike during STRIKING, otherwise try to swing at stone.
      if (this.input.justPressed.has('m')) {
        if (this.pickaxe.state === 'striking') {
          const cursor = swingCursorPosition(this.pickaxe.elapsedMs);
          const grade = gradeStrike(cursor);
          this.strikeLockedCursor = cursor;
          this.strikeGrade = grade;
          const rolled = this.pickaxe.strike();
          // Pickaxe-tier bias: if the strike landed and the player has
          // an upgraded pickaxe, re-roll using the tier weights so the
          // gem distribution actually responds to the upgrade. We keep
          // the inner roll in place so the state-machine stays clean.
          const gem = rolled ? weightedGemPick(p) : null;
          if (gem) {
            const def = GEMS[gem];
            p.inventory[gemInventoryKey(gem)] = (p.inventory[gemInventoryKey(gem)] ?? 0) + 1;
            // Run-haul tally — bump per-gem count so the dawn toast
            // can replay "yesterday's haul" the next morning after
            // sleep. Tally resets via resetMineHaul() in the sleep
            // branch.
            const haulPre = haulCount(getMineHaul(p));
            const goldPre = haulGold(getMineHaul(p));
            recordMined(p, gem);
            const haulPost = haulCount(getMineHaul(p));
            const goldPost = haulGold(getMineHaul(p));
            // Mid-run milestone callout — if the bump crossed 3, 6,
            // or 10 gems this run, append a celebratory tail to the
            // strike toast so the player feels the run building.
            // Pure cross-detection so re-mining at the same threshold
            // (after sleep) re-fires the callout cleanly.
            const tier = crossedMilestone(haulPre, haulPost);
            const milestoneTail = tier !== null
              ? `  -  ${milestoneToastLine(getMineHaul(p), tier)}`
              : '';
            // Mid-run GOLD milestone callout — parallel to the count
            // tier above, so a low-count / high-value haul (pure
            // iron / cave ruby spike) still surfaces a celebration
            // as the haul value swells. Both tails can fire on a
            // single strike when a rare gem crosses both bars; the
            // gold tail follows the count tail in display order.
            const goldTier = crossedGoldMilestone(goldPre, goldPost);
            const goldMilestoneTail = goldTier !== null
              ? `  -  ${goldMilestoneToastLine(getMineHaul(p), goldTier)}`
              : '';
            this.checkQuests({ kind: 'mine', gemKey: gem });
            const bonus = strikeBonus(grade);
            if (bonus > 0) {
              p.gold += bonus;
              logGold(p, bonus, `mining ${def.name}`, this.time.day);
              this.setToast(`${strikeLabel(grade)} +1 ${def.name} +${bonus}g${milestoneTail}${goldMilestoneTail}`);
            } else {
              this.setToast(`${strikeLabel(grade)} +1 ${def.name}${milestoneTail}${goldMilestoneTail}`);
            }
          }
        } else if (this.pickaxe.state === 'idle') {
          if (canStrikeInto(this.world, front.tx, front.ty)) {
            if (!spendStamina(p, STAMINA_COST.mine)) {
              this.setToast('Too tired to swing. Sleep or sip cocoa (Z).');
            } else if (this.pickaxe.swing()) {
              this.strikeLockedCursor = null;
              this.strikeGrade = null;
              this.setToast('Swinging the pickaxe…');
            } else {
              getStamina(p).current = Math.min(getStamina(p).max, getStamina(p).current + STAMINA_COST.mine);
            }
          } else {
            this.setToast('Face stone to mine.');
          }
        } else {
          this.pickaxe.cancel();
          this.strikeLockedCursor = null;
          this.strikeGrade = null;
          this.setToast('Cancelled the swing.');
        }
      }
      if (this.input.justPressed.has('t')) {
        if (!spendStamina(p, STAMINA_COST.till)) {
          this.setToast('Too tired to till. Sleep or sip cocoa (Z).');
        } else {
          let tilledAny = false;
          for (const tile of tilesForTool(p, 'hoe')) {
            if (till(this.world, tile.tx, tile.ty)) tilledAny = true;
          }
          if (tilledAny) {
            const tier = tierOf(p, 'hoe');
            this.setToast(tier === 'wood' ? 'Tilled the soil.' : `Tilled (${tier}).`);
          } else {
            // Refund the cost — nothing actually happened.
            getStamina(p).current = Math.min(getStamina(p).max, getStamina(p).current + STAMINA_COST.till);
          }
        }
      }
      if (this.input.justPressed.has('w')) {
        if (!spendStamina(p, STAMINA_COST.water)) {
          this.setToast('Too tired to water. Sleep or sip cocoa (Z).');
        } else {
          let wateredAny = 0;
          for (const tile of tilesForTool(p, 'watering-can')) {
            if (water(this.world, tile.tx, tile.ty)) wateredAny++;
          }
          if (wateredAny > 0) {
            const tier = tierOf(p, 'watering-can');
            this.setToast(
              tier === 'wood'
                ? 'Watered the crop.'
                : `Watered ${wateredAny} crop${wateredAny === 1 ? '' : 's'} (${tier}).`,
            );
          } else {
            getStamina(p).current = Math.min(getStamina(p).max, getStamina(p).current + STAMINA_COST.water);
          }
        }
      }
      // ,  Upgrade the hoe at Vallie's. Requires standing near the shop.
      // .  Upgrade the watering can. Same rules.
      if (this.input.justPressed.has(',') || this.input.justPressed.has('.')) {
        const tool: 'hoe' | 'watering-can' =
          this.input.justPressed.has(',') ? 'hoe' : 'watering-can';
        if (!this.isNearShop()) {
          this.setToast('Stand by Maple\u2019s shop to upgrade tools.');
        } else {
          const cost = upgradeCost(p, tool);
          const out = upgradeTool(p, tool);
          if (out.kind === 'upgraded') {
            if (cost) logGold(p, -cost, `${toolLabel(tool, out.to)} upgrade`, this.time.day);
            this.setToast(`Upgraded to ${toolLabel(tool, out.to)} (-${cost ?? 0}g).`);
          } else if (out.kind === 'max-tier') {
            this.setToast(`${toolLabel(tool, out.tier)} is already the best tier.`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g (have ${out.have}g).`);
          }
        }
      }
      // /  Upgrade the pickaxe at Vallie's. wood -> copper -> iron -> gold -> diamond.
      if (this.input.justPressed.has('/')) {
        if (!this.isNearShop()) {
          this.setToast('Stand by Maple\u2019s shop to upgrade the pickaxe.');
        } else {
          const cost = pickaxeUpgradeCost(p);
          const out = upgradePickaxe(p);
          if (out.kind === 'upgraded') {
            if (cost) logGold(p, -cost, `${pickaxeTierLabel(out.to)} upgrade`, this.time.day);
            this.setToast(`Upgraded to ${pickaxeTierLabel(out.to)} (-${cost ?? 0}g).`);
          } else if (out.kind === 'max-tier') {
            this.setToast(`${pickaxeTierLabel(out.tier)} is already the best tier.`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g for the next pickaxe (have ${out.have}g).`);
          }
        }
      }
      // =  Upgrade the fishing rod at Vallie's. wood -> copper -> iron -> gold.
      if (this.input.justPressed.has('=')) {
        if (!this.isNearShop()) {
          this.setToast('Stand by Maple\u2019s shop to upgrade the rod.');
        } else {
          const cost = rodUpgradeCost(p);
          const out = upgradeRod(p);
          if (out.kind === 'upgraded') {
            if (cost) logGold(p, -cost, `${rodTierLabel(out.to)} upgrade`, this.time.day);
            this.setToast(`Upgraded to ${rodTierLabel(out.to)} (-${cost ?? 0}g).`);
          } else if (out.kind === 'max-tier') {
            this.setToast(`${rodTierLabel(out.tier)} is already the best tier.`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Need ${out.need}g for the next rod (have ${out.have}g).`);
          }
        }
      }
      // Plant on hotbar key (1..N) — uses front tile.
      for (let i = 0; i < CROP_KEYS.length; i++) {
        if (this.input.justPressed.has(String(i + 1))) {
          const key = CROP_KEYS[i];
          if (isPlantableTile(this.world, front.tx, front.ty) && (p.inventory[key] ?? 0) > 0) {
            if (plant(this.world, front.tx, front.ty, key, p)) {
              recordSown(p, key);
              recordLastSeed(p, key);
              this.setToast(`Planted ${key}.`);
              this.checkQuests({ kind: 'plant', cropKey: key });
            }
          }
        }
      }
      // E: prefer NPC interaction, else harvest, else sell-all-at-well
      if (this.input.justPressed.has('g')) {
        const npc = npcInFrontOf(this.world, front.tx, front.ty);
        if (npc && CANDIDATES[npc.id]) {
          const out = attemptAutoGift(p, npc.id, this.time.day, this.time);
          if (out.kind === 'gifted') {
            const r = out.result;
            const label =
              r.taste === 'loved'
                ? '💖 LOVED'
                : r.taste === 'liked'
                  ? '💗 liked'
                  : r.taste === 'disliked'
                    ? '💔 disliked'
                    : '🎁';
            const item = out.itemKey.replace('_harvest', '').replace('fish-', '');
            const lvl = r.leveledUp ? ` · ♥${r.hearts}!` : '';
            this.setToast(`${label} ${npc.name}: ${item}${lvl}`);
            this.checkQuests({ kind: 'gift', npcId: npc.id, hearts: r.hearts });
          } else if (out.kind === 'already-today') {
            this.setToast(`${npc.name} already got a gift today.`);
          } else if (out.kind === 'no-items') {
            this.setToast('Nothing in your bag to gift.');
          }
        } else if (npc) {
          this.setToast(`${npc.name} isn't a candidate.`);
        } else {
          this.setToast('Face someone to give a gift.');
        }
      }
      if (this.input.justPressed.has('p')) {
        // If already engaged, P holds the wedding (no NPC needed — symbolic at the well).
        if (p.engagement) {
          const w = holdWedding(p, this.time.day);
          switch (w.kind) {
            case 'married': {
              const name = CANDIDATES[w.npcId]?.name ?? w.npcId;
              this.setToast(`💒 You married ${name}! Forever ${name} & you.`);
              this.checkQuests({ kind: 'marry', npcId: w.npcId });
              break;
            }
            case 'too-soon':
              this.setToast(`Wedding in ${w.daysLeft} day${w.daysLeft === 1 ? '' : 's'}.`);
              break;
            case 'already-married': {
              const name = CANDIDATES[w.toNpcId]?.name ?? w.toNpcId;
              this.setToast(`You're already married to ${name}.`);
              break;
            }
            case 'not-engaged':
              // unreachable — engagement was truthy above
              break;
          }
        } else {
          const npc = npcInFrontOf(this.world, front.tx, front.ty);
          if (npc) {
          const out = propose(p, npc.id, this.time.day);
          switch (out.kind) {
            case 'accepted':
              this.setToast(`💍 ${npc.name} said YES! You are engaged.`);
              this.checkQuests({ kind: 'gift', npcId: npc.id, hearts: 10 });
              break;
            case 'not-candidate':
              this.setToast(`${npc.name} isn't a candidate.`);
              break;
            case 'no-bouquet':
              this.setToast('You need a bouquet to propose.');
              break;
            case 'too-few-hearts':
              this.setToast(`${npc.name} needs ♥${out.need} (have ${out.have}).`);
              break;
            case 'already-engaged':
              this.setToast(`You're already engaged to ${out.toNpcId}.`);
              break;
          }
        } else {
          this.setToast('Face someone to propose.');
        }
        }
      }
      if (this.input.justPressed.has('e')) {
        // Pip's cart takes priority over NPC/harvest when the player
        // stands right next to it during open hours.
        const px = Math.round(p.x);
        const py = Math.round(p.y);
        if (nearCart(px, py) && cartOpen(this.time)) {
          // Auto-sweep breeder eggs from the bag before the menu opens
          // — Pip eyes them and pays 2x the fancy-egg sell price. No
          // new keybind; the existing E press carries the trade.
          const tradeOut = tradeBreederEggs(this.world.player, px, py, this.time);
          if (tradeOut.kind === 'traded') {
            logGold(this.world.player, tradeOut.gold, `cart: breeder trade (x${tradeOut.eggs})`, this.time.day);
            this.setToast(breederTradeInLine(tradeOut));
          }
          // Auto-trade stamina teas next: three cheap teas for one
          // Hot Cocoa, single-shot per E press so a 6-tea bag mints
          // 1 cocoa per visit (player can re-press to chain through).
          // Silent when the bag doesn't carry enough teas so the trade
          // path doesn't toast on every menu open.
          const teaOut = tradeStaminaTeas(this.world.player, px, py, this.time);
          if (teaOut.kind === 'traded') {
            this.setToast(teaTradeInLine(teaOut));
          }
          // Capture this season's headliner into the rumor history
          // ring buffer (idempotent on repeat opens within the same
          // visit). The matching buy stamps it as 'bought' below.
          recordRumorVisit(this.world.player, this.time.season);
          this.cartMenu.open();
          return;
        }
        // Carpenter's bench — same priority tier as cart; the bench
        // sits a few tiles south of Vallie's shop so it's a separate
        // interactable target.
        if (nearBench(px, py)) {
          this.benchMenu.open();
          return;
        }
        // Vallie's shop menu — opens when the player stands beside the
        // shop and Pip isn't grabbing the press first. Cart already
        // returned above, so reaching here means we're free to open.
        if (this.isNearShop()) {
          this.shopMenu.open(p, this.time);
          return;
        }
        // Village quest board — interact when standing adjacent.
        if (nearBoard(px, py)) {
          const posted = refreshBoard(p, this.time);
          if (canTurnIn(p, this.time)) {
            const out = turnIn(p, this.time);
            if (out.kind === 'completed') {
              // Apply the reputation multiplier so the player receives
              // the boosted payout. turnIn() already credited the base
              // reward; we top up by the bonus delta + log both parts.
              const rep = applyRepBonus(p, out.quest);
              if (rep.bonus > 0) {
                p.gold += rep.bonus;
                logGold(p, rep.bonus, `board rep ${rep.tier.label} bonus`, this.time.day);
              }
              logGold(p, rep.baseGold, `board: ${out.quest.label}`, this.time.day);
              const tail =
                out.quest.rewardItems && out.quest.rewardItems.length > 0
                  ? ` + ${out.quest.rewardItems
                      .map((r) => `${r.count} ${r.key.replace('_harvest', '')}`)
                      .join(', ')}`
                  : '';
              const bonusTag = rep.bonus > 0 ? ` (+${rep.bonus}g ${rep.tier.label} bonus)` : '';
              this.setToast(`Board cleared: ${out.quest.label} +${rep.boosted}g${tail}${bonusTag}`);
              return;
            }
          }
          const prog = boardProgress(p, this.time);
          // Barometer storm warning: when a storm sits in (tomorrow,
          // day-after-tomorrow), append a "Storm in N days" tail to
          // the board hint. Empty string when the player has no
          // barometer or no storm is on the horizon.
          const stormWarning = barometerStormWarning(p, this.time);
          const warningTail = stormWarning ? ` ${stormWarning}` : '';
          this.setToast(
            `Board: ${posted.label} (${prog.have}/${prog.need}). +${posted.rewardGold}g. ${repBannerLine(p)}${warningTail}`,
          );
          return;
        }
        // Bath house — a soak lifts the stamina cap for a few days.
        if (nearBath(px, py)) {
          const out = takeBath(p, px, py, this.time.day, this.time);
          if (out.kind === 'soaked') {
            const tag = out.discounted ? 'bath house: soak (winter)' : 'bath house: soak';
            logGold(p, -out.pricePaid, tag, this.time.day);
            this.setToast(bathFlavorLine(out));
          } else if (out.kind === 'already-active') {
            this.setToast(`Already soaked — buff lasts ${out.daysLeft} more day${out.daysLeft === 1 ? '' : 's'}.`);
          } else if (out.kind === 'not-enough-gold') {
            this.setToast(`Bath house costs ${out.need}g (you have ${out.have}g).`);
          }
          return;
        }
        const npc = npcInFrontOf(this.world, front.tx, front.ty);
        if (npc) {
          const h = p.hearts ? getHearts(p.hearts, npc.id) : 0;
          // Spouse line takes priority over the public dialogue pool —
          // marriage unlocks a private morning greeting.
          const spouseLine =
            p.marriage?.npcId === npc.id ? spouseGreeting(p, this.time.day) : null;
          const line = spouseLine ?? getDialogue(npc, this.time.day, h);
          const role = p.marriage?.npcId === npc.id ? 'Your Spouse' : getRole(npc);
          this.dialogue.open(npc.name, role, line);
          this.checkQuests({ kind: 'talk', npcId: npc.id });
          if (p.hearts && creditTalk(p.hearts, npc.id, this.time.day)) {
            // Tiny ambient feedback — only on the day's first chat.
            // (No toast — keeps the dialogue moment quiet.)
          }
        } else if (cropAt(this.world, front.tx, front.ty)) {
          // Try to harvest.
          const c = cropAt(this.world, front.tx, front.ty);
          const cropKey = c ? c.crop : '';
          const streak = (c as unknown as { waterStreak?: number } | undefined)?.waterStreak ?? 0;
          const quality = harvest(this.world, front.tx, front.ty, p);
          if (quality) {
            const flair =
              quality === 'gold' ? ' (gold-star! 2x)' : quality === 'silver' ? ' (silver-star, 1.5x)' : '';
            this.setToast(`Harvested ${cropKey}${flair}.`);
            if (cropKey) {
              recordHarvest(p, cropKey, quality, streak, {
                season: this.time.season,
                day: this.time.day,
              });
              this.checkQuests({ kind: 'harvest', cropKey });
            }
          }
        } else if (adjacentCoop(this.world, front.tx, front.ty) || adjacentCoop(this.world, Math.round(p.x), Math.round(p.y))) {
          // Collect eggs from a coop the player is standing next to.
          const coop =
            adjacentCoop(this.world, front.tx, front.ty) ??
            adjacentCoop(this.world, Math.round(p.x), Math.round(p.y))!;
          const detail = collectEggsDetailed(coop, p);
          const collected = detail.plain + detail.fancy + detail.breeder;
          if (collected > 0) {
            const happy = bumpCoopHappinessCollect(coop, this.time.day);
            const tails: string[] = [];
            if (detail.fancy > 0) tails.push(`${detail.fancy} fancy`);
            if (detail.breeder > 0) tails.push(`${detail.breeder} BREEDER`);
            const fancyTail = tails.length > 0 ? ` (incl. ${tails.join(' + ')})` : '';
            const mood = happy >= 80 ? ' Chickens are thriving.' : '';
            this.setToast(`Collected ${collected} egg${collected === 1 ? '' : 's'}${fancyTail}.${mood}`);
          } else if (coop.chickens === 0) {
            this.setToast('No chickens yet — buy one and press I.');
          } else {
            // Idle coop — feed the chickens for a smaller happiness bump.
            const happy = bumpCoopHappinessFeed(coop, this.time.day);
            this.setToast(`Fed the chickens. Coop happiness ${happy}/100.`);
          }
        } else {
          // Standing in front of the well? Sell all harvest as quick economy.
          // Standing in front of the inn? Sell all dishes for bigger gold.
          let handled = false;
          for (const b of this.world.buildings) {
            if (b.kind === 'well' && front.tx === b.x && front.ty === b.y) {
              // Friendship tournament — when it's running, the well's
              // E-press routes into the contest instead of the standard
              // sell-all. Wins drop ribbons + gold; "no prize" still
              // records the entry so the player can audit the season.
              if (tournamentOpen(this.time) && !alreadyEntered(p, this.time)) {
                const tOut = enterTournament(p, this.time);
                if (tOut.kind === 'won') {
                  logGold(p, tOut.gold, `tournament: ${tOut.label}`, this.time.day);
                  this.setToast(
                    `${tOut.label}: ${tOut.tier.toUpperCase()} ribbon! +${tOut.gold}g (score ${tOut.score}).`,
                  );
                  handled = true;
                  break;
                } else if (tOut.kind === 'entered-no-prize') {
                  this.setToast(
                    `${tOut.label}: entered (score ${tOut.score}). Bring more next season.`,
                  );
                  handled = true;
                  break;
                }
              }
              const festBonus = cropSellMultiplier(this.time);
              const earned = sellAllHarvest(p, festBonus);
              const gemGold = sellAllGems(p);
              const forageGold = sellAllForage(p);
              const eggGold = sellAllEggs(p);
              const total = earned + gemGold + forageGold + eggGold;
              if (total > 0) {
                const parts: string[] = [];
                if (earned > 0) {
                  const tail = festBonus > 1 ? ' (festival x' + festBonus + ')' : '';
                  parts.push(`harvest +${earned}g${tail}`);
                  logGold(p, earned, festBonus > 1 ? 'well: harvest (festival)' : 'well: harvest', this.time.day);
                }
                if (gemGold > 0) {
                  parts.push(`gems +${gemGold}g`);
                  logGold(p, gemGold, 'well: gems', this.time.day);
                }
                if (forageGold > 0) {
                  parts.push(`forage +${forageGold}g`);
                  logGold(p, forageGold, 'well: forage', this.time.day);
                }
                if (eggGold > 0) {
                  parts.push(`eggs +${eggGold}g`);
                  logGold(p, eggGold, 'well: eggs', this.time.day);
                }
                this.setToast(`Sold at the well: ${parts.join(', ')}`);
              } else {
                this.setToast('Nothing to sell yet.');
              }
              handled = true;
              break;
            }
            if (
              b.kind === 'inn' &&
              front.tx >= b.x &&
              front.tx < b.x + b.w &&
              front.ty >= b.y &&
              front.ty < b.y + b.h
            ) {
              const earned = sellAllDishes(p);
              if (earned > 0) {
                logGold(p, earned, 'inn: dishes', this.time.day);
                this.setToast(`Rose buys your dishes: +${earned}g`);
              } else {
                this.setToast('Cook a dish first — Callie pays well.');
              }
              handled = true;
              break;
            }
          }
          void handled;
        }
      }
    }

    // Camera follow uses the player's centre in world-space pixels.
    if (p) {
      this.camera.follow(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2, dtMs);
    }

    this.input.clearJustPressed();

    // Multiplayer: broadcast our snapshot + resolve smoothed peer positions
    // for the upcoming render(). No-op when the driver is null.
    this.peerRenderables = tickMultiplayerFrame(
      this.multiplayer,
      this.world.player,
      typeof performance !== 'undefined' ? performance.now() : Date.now(),
    );
    if (this.multiplayer) {
      const tNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const events = this.multiplayer.drainEvents();
      if (events.length > 0) this.peerToasts.push(events, tNow);
    }
  }

  private render(): void {
    const settings = getSettings(this.world.player);
    const renderNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.renderer.draw(this.world, this.camera, this.timeOfDay, settings.nightTintScale, renderNow, settings.reduceMotion);
    // Sprinklers — render after the world so they sit on top of crops/tiles
    // but below peers / HUD. Each sprinkler is a 14-ish px sprite anchored
    // to the centre of its tile.
    {
      const list = getSprinklers(this.world);
      for (const s of list) {
        const wx = s.tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = s.ty * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawSprinklerSprite(this.ctx, sx, sy, s.kind);
      }
    }
    // Forage — same layer as sprinklers but only on the daytime grass.
    {
      const list = getForage(this.world);
      for (const f of list) {
        const wx = f.tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = f.ty * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawForageSprite(this.ctx, sx, sy, f.kind);
      }
    }
    // Coops — chunky 2x2 building rendered after world tiles so it
    // sits visibly above the grass.
    {
      const list = getCoops(this.world);
      for (const c of list) {
        const cx = (c.tx + COOP_W / 2) * TILE_SIZE;
        const cy = (c.ty + COOP_H / 2) * TILE_SIZE;
        const { sx, sy } = this.camera.worldToScreen(cx, cy);
        drawCoopSprite(this.ctx, sx, sy, c, TILE_SIZE);
      }
    }
    // Hatcheries — small basket sprites rendered next to coops. Drawn
    // after coops so the basket reads as sitting in front of the coop.
    {
      const list = getHatcheries(this.world);
      for (const h of list) {
        const wx = h.tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = h.ty * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawHatcherySprite(this.ctx, sx, sy, h, this.time.day, TILE_SIZE);
      }
    }
    // Compost bins — small wooden bin sprites placed on grass.
    {
      const list = getComposts(this.world);
      for (const c of list) {
        const wx = c.tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = c.ty * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawCompostSprite(this.ctx, sx, sy, c, this.time.day, TILE_SIZE);
      }
    }
    // Storm shelters — small lean-to sprites. Drawn over crops so the
    // roof reads as covering them.
    {
      const list = getShelters(this.world);
      for (const s of list) {
        const wx = s.tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = s.ty * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawShelterSprite(this.ctx, sx, sy, TILE_SIZE, isPaired(this.world, s));
      }
    }
    // Greenhouses — translucent glass frame over tilled soil tiles.
    {
      const list = getGreenhouses(this.world);
      for (const g of list) {
        const cx = (g.tx + GREENHOUSE_W / 2) * TILE_SIZE;
        const cy = (g.ty + GREENHOUSE_H / 2) * TILE_SIZE;
        const { sx, sy } = this.camera.worldToScreen(cx, cy);
        drawGreenhouseSprite(this.ctx, sx, sy, TILE_SIZE);
      }
    }
    // Chimney smoke — a soft wisp curling up from the farmhouse roof when
    // the hearth would be lit (Winter, the cold dark hours, or rain/storm).
    // Drawn after the buildings so it sits over the roofline. Skipped when
    // the hearth is cold; frozen-but-visible under reduce-motion.
    {
      const fh = this.world.buildings.find((b) => b.kind === 'farmhouse');
      if (fh && hearthLit(this.time)) {
        const { sx, sy } = this.camera.worldToScreen(fh.x * TILE_SIZE, fh.y * TILE_SIZE);
        const pw = fh.w * TILE_SIZE;
        const ph = fh.h * TILE_SIZE;
        // Roof apex mirrors drawBuilding's stepped-triangle geometry so the
        // chimney lip tracks the ridge at any building size.
        const apexY = sy + Math.floor(ph * 0.4) + 2 - Math.floor(ph * 0.55);
        const chimneyX = sx + Math.round(pw * 0.68);
        const chimneyY = apexY - 6;
        drawChimneySmoke(
          this.ctx,
          this.time,
          chimneyX,
          chimneyY,
          renderNow,
          settings.reduceMotion,
        );
      }
    }
    // Ribbon hall — the player's tournament rosettes mounted on the
    // farmhouse wall. Reads ribbonCounts() via the pure layout helper;
    // empty (no draw) until the player wins their first ribbon. Anchored
    // on the wall to the right of the door so it reads as wall decor.
    {
      const fh = this.world.buildings.find((b) => b.kind === 'farmhouse');
      if (fh) {
        const mounts = ribbonHallMounts(this.world.player);
        if (mounts.length > 0) {
          const { sx, sy } = this.camera.worldToScreen(fh.x * TILE_SIZE, fh.y * TILE_SIZE);
          const pw = fh.w * TILE_SIZE;
          const ph = fh.h * TILE_SIZE;
          // Wall top mirrors drawBuilding's wall geometry; hang the strip a
          // few px below it on the right half of the wall (door is centred).
          const wallTop = sy + Math.floor(ph * 0.4);
          const hallX = sx + Math.round(pw * 0.58);
          const hallY = wallTop + 12;
          drawRibbonHall(this.ctx, hallX, hallY, mounts);
        }
      }
    }
    // Tool rack — the player's hoe / can / pickaxe / rod hung on the LEFT
    // half of the farmhouse wall (the ribbon hall takes the right). Reads
    // the tool-tier helpers via the pure layout; empty (no draw) until the
    // player upgrades any tool past its starting wood tier.
    {
      const fh = this.world.buildings.find((b) => b.kind === 'farmhouse');
      if (fh) {
        const rack = toolRackMounts(this.world.player);
        if (rack.length > 0) {
          const { sx, sy } = this.camera.worldToScreen(fh.x * TILE_SIZE, fh.y * TILE_SIZE);
          const pw = fh.w * TILE_SIZE;
          const ph = fh.h * TILE_SIZE;
          // Same wall-top geometry as the ribbon hall; hung on the left of
          // the centred door so the two displays flank it symmetrically.
          const wallTop = sy + Math.floor(ph * 0.4);
          const rackX = sx + Math.round(pw * 0.08);
          const rackY = wallTop + 12;
          drawToolRack(this.ctx, rackX, rackY, rack);
        }
      }
    }
    // Seasonal banner over Vallie's shop — a small cloth that swaps colour
    // + motif per season so the village visibly notices the calendar.
    // Drawn over the shop roofline, same apex geometry as the chimney.
    {
      const shop = this.world.buildings.find((b) => b.kind === 'shop');
      if (shop) {
        const { sx, sy } = this.camera.worldToScreen(shop.x * TILE_SIZE, shop.y * TILE_SIZE);
        const pw = shop.w * TILE_SIZE;
        const ph = shop.h * TILE_SIZE;
        const apexY = sy + Math.floor(ph * 0.4) + 2 - Math.floor(ph * 0.55);
        drawShopBanner(
          this.ctx,
          sx + pw / 2,
          apexY - 24,
          shopBannerStyle(this.time.season),
        );
      }
    }
    // Chests — small wooden + brass-band sprites placed on grass.
    {
      const list = getChests(this.world);
      for (const c of list) {
        const wx = c.tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = c.ty * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawChestSprite(this.ctx, sx, sy);
      }
    }
    // Pip's travelling cart — visible only during the visit-day open
    // hours. Rendered above chests so the awning sits clean over the
    // plaza tiles.
    if (cartOpen(this.time)) {
      const wx = CART_X * TILE_SIZE + TILE_SIZE / 2;
      const wy = CART_Y * TILE_SIZE + TILE_SIZE / 2;
      const { sx, sy } = this.camera.worldToScreen(wx, wy);
      drawCartSprite(this.ctx, sx, sy, TILE_SIZE);
    }
    // Carpenter's bench — always visible in the village square so
    // players can find it any time.
    {
      const wx = BENCH_X * TILE_SIZE + TILE_SIZE / 2;
      const wy = BENCH_Y * TILE_SIZE + TILE_SIZE / 2;
      const { sx, sy } = this.camera.worldToScreen(wx, wy);
      drawBenchSprite(this.ctx, sx, sy, TILE_SIZE);
    }
    // Scarecrows — render every placed scarecrow over its grass tile.
    for (const s of getScarecrows(this.world)) {
      const wx = s.tx * TILE_SIZE + TILE_SIZE / 2;
      const wy = s.ty * TILE_SIZE + TILE_SIZE / 2;
      const { sx, sy } = this.camera.worldToScreen(wx, wy);
      drawScarecrowSprite(this.ctx, sx, sy);
    }
    // Village quest board — always visible just south of the well.
    {
      const wx = BOARD_X * TILE_SIZE + TILE_SIZE / 2;
      const wy = BOARD_Y * TILE_SIZE + TILE_SIZE / 2;
      const { sx, sy } = this.camera.worldToScreen(wx, wy);
      drawBoardSprite(this.ctx, sx, sy);
    }
    // Bath house — always visible NE of the plaza so the player has a
    // clear late-game stamina sink to walk to.
    {
      const wx = BATH_X * TILE_SIZE + TILE_SIZE / 2;
      const wy = BATH_Y * TILE_SIZE + TILE_SIZE / 2;
      const { sx, sy } = this.camera.worldToScreen(wx, wy);
      drawBathHouseSprite(this.ctx, sx, sy, TILE_SIZE);
    }
    // Farm dog — drawn after coops so it appears in front of them.
    {
      const dog = getDog(this.world);
      if (dog.owned) {
        const wx = dog.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = dog.y * TILE_SIZE + TILE_SIZE / 2;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        const facingRight = this.world.player.x >= dog.x;
        drawDogSprite(this.ctx, sx, sy, facingRight);
      }
    }
    // Farm cat — perched on the farmhouse roof.
    {
      const cat = getCat(this.world);
      if (cat.owned) {
        const wx = cat.x * TILE_SIZE + TILE_SIZE / 2;
        // Render the cat a few pixels HIGHER than the tile centre so it
        // visually sits on top of the farmhouse roof rather than inside it.
        const wy = cat.y * TILE_SIZE + TILE_SIZE / 2 - 8;
        const { sx, sy } = this.camera.worldToScreen(wx, wy);
        drawCatSprite(this.ctx, sx, sy);
      }
    }
    if (this.peerRenderables.length > 0) {
      this.renderer.drawPeers(this.peerRenderables, this.camera, this.multiplayer?.mutes);
    }
    // NPC barks — small ambient bubbles above NPCs who just registered
    // a player walk-by. Drawn after peers + dog/cat so the bubble sits
    // on top of any sprite that happens to overlap.
    drawBarks(this.ctx, this.world, (wx, wy) => this.camera.worldToScreen(wx, wy), TILE_SIZE);
    // Crop-quality heatmap — a field wash shown while the crop journal is
    // open so the player can see which crops are about to star and which
    // are dry. Rides the `;` toggle (no scarce keybind) and draws in
    // world-space, on top of the field but under the HUD chrome.
    if (this.cropJournal.isVisible()) {
      drawQualityHeatmap(
        this.ctx,
        this.world.crops as unknown as FarmCrop[],
        (wx, wy) => this.camera.worldToScreen(wx, wy),
        TILE_SIZE,
        this.canvas.height,
      );
    }
    drawHUD(this.ctx, this.world.player, this.time, this.canvas.width, this.canvas.height, settings.hudScale, typeof performance !== 'undefined' ? performance.now() : Date.now(), settings.reduceMotion);
    drawStaminaBar(this.ctx, this.world.player, this.canvas.width, settings.hudScale, renderNow, settings.reduceMotion);
    drawWeatherStrip(this.ctx, this.time, this.canvas.width, this.world.player, settings.hudScale);
    drawSkyDial(this.ctx, this.time, this.canvas.width, settings.hudScale);
    drawAlmanacChip(this.ctx, this.time, this.canvas.width, settings.hudScale, this.world.player);
    drawBirthdayBanner(this.ctx, this.time, this.canvas.width, settings.hudScale);
    drawFestivalBanner(this.ctx, this.time, this.canvas.width, settings.hudScale);
    // Confetti — a brief celebratory burst the moment the player arrives on
    // a festival or birthday. We diff today's celebration key against the
    // last burst's: a change to a non-null key arms a fresh burst (so a
    // reload mid-day or a sleep-into-a-birthday both trigger it once). The
    // burst is skipped wholesale under reduce-motion, matching rain / snow.
    {
      const key = celebrationDayKey(this.time);
      if (key && key !== this.confettiDayKey) {
        this.confettiDayKey = key;
        this.confettiStartMs = renderNow;
      } else if (!key) {
        this.confettiDayKey = null;
      }
      if (this.confettiDayKey && !settings.reduceMotion) {
        const elapsed = renderNow - this.confettiStartMs;
        if (elapsed <= CONFETTI_DURATION_MS) {
          drawConfettiOverlay(this.ctx, elapsed, this.canvas.width, this.canvas.height);
        }
      }
    }
    // Rain overlay sits between the world and the HUD chrome so it darkens
    // the village but not the on-screen text. Only render when the active
    // weather actually drops water — and skip when reduce-motion is on.
    {
      const today = weatherToday(this.time);
      if (WEATHER[today].watersCrops && !settings.reduceMotion) {
        const intense = today === 'storm';
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        drawRainOverlay(this.ctx, this.canvas.width, this.canvas.height, intense, now);
      }
    }
    // Snow overlay — only in Winter, only when reduce-motion is off.
    // Layered on top of rain so a stormy Winter day reads as snow-driven.
    if (isFrozenSeason(this.time) && !settings.reduceMotion) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      drawSnowOverlay(this.ctx, this.canvas.width, this.canvas.height, now);
    }
    if (this.multiplayer) {
      drawPeerBadge(this.ctx, {
        peerCount: this.multiplayer.session.registry.size(),
        canvasW: this.canvas.width,
      });
      drawMuteBadge(this.ctx, {
        mutedCount: this.multiplayer.mutes.size(),
        canvasW: this.canvas.width,
      });
      {
        const roster = buildPeerRoster(this.multiplayer.session.registry.list(), {
          localX: this.world.player.x,
          localY: this.world.player.y,
          now: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        });
        const summary = summarizeRoster(roster);
        const tone = rosterTone(summary);
        drawPeerRosterPanel(this.ctx, { entries: roster, canvasW: this.canvas.width, tone });
        drawRosterSubtitle(this.ctx, {
          text: formatRosterSummary(summary),
          canvasW: this.canvas.width,
          tone,
        });
      }
      this.peerToasts.draw(
        this.ctx,
        this.canvas.width,
        typeof performance !== 'undefined' ? performance.now() : Date.now(),
      );
      drawEmoteLegend(this.ctx, {
        canvasW: this.canvas.width,
        canvasH: this.canvas.height,
      });
      if (this.peerRenderables.length > 0) {
        drawPeerBubbles(this.ctx, {
          peers: this.peerRenderables,
          source: this.multiplayer,
          camera: this.camera,
          now: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        });
      }
    }
    this.heartsPanel.draw(this.ctx, this.world.player, this.canvas.width, this.time);
    this.recipeCodex.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.cropJournal.draw(this.ctx, this.world.player, this.time, this.canvas.width, this.canvas.height, this.fieldCropSamples());
    this.achievements.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.moneyLogPanel.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.questLogPanel.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.settingsPanel.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.helpOverlay.draw(this.ctx, this.canvas.width, this.canvas.height, settings.reduceMotion);
    this.minimapPanel.draw(this.ctx, this.world, this.world.player, this.time, this.canvas.width, this.canvas.height, settings.reduceMotion);
    this.almanacPanel.draw(this.ctx, this.time, this.canvas.width, this.canvas.height, this.world.player);
    this.bagPanel.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.lorePanel.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.dialogue.draw(this.ctx, this.canvas.width, this.canvas.height);
    this.cookingMenu.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.sleepSummary.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.chestMenu.draw(this.ctx, this.canvas.width, this.canvas.height, settings.reduceMotion);
    this.cartMenu.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height, this.time);
    this.shopMenu.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.benchMenu.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height);
    this.owlMenu.draw(this.ctx, this.world.player, this.canvas.width, this.canvas.height, this.time.day);

    // Fishing timing bar — shows during REELING above the hotbar.
    if (this.rod.state === 'reeling') {
      const barW = 240;
      const bx = Math.floor((this.canvas.width - barW) / 2);
      const by = this.canvas.height - 110;
      const cursor = cursorPosition(this.rod.elapsedMs);
      drawFishingBar(
        this.ctx,
        bx,
        by,
        barW,
        cursor,
        MINIGAME.defaultZone,
        this.reelLockedCursor,
        this.reelGrade,
      );
    }
    // Mining swing-meter — shows during STRIKING above the hotbar.
    if (this.pickaxe.state === 'striking') {
      const barW = 240;
      const bx = Math.floor((this.canvas.width - barW) / 2);
      const by = this.canvas.height - 110;
      const cursor = swingCursorPosition(this.pickaxe.elapsedMs);
      drawSwingMeter(
        this.ctx,
        bx,
        by,
        barW,
        cursor,
        SWING.defaultZone,
        this.strikeLockedCursor,
        this.strikeGrade,
      );
    }
    // Toast stack — newest on top. Multiple same-frame messages each get
    // their own pill so a busy moment (harvest + heart-up + achievement)
    // reads as a short list instead of the last writer clobbering the rest.
    {
      const stack = this.toasts.active();
      const pillH = 26;
      const gap = 6;
      const topY = 50;
      for (let i = 0; i < stack.length; i++) {
        const entry = stack[i];
        const alpha = toastAlphaFor(entry, settings.reduceMotion);
        if (alpha <= 0) continue;
        const y = topY + i * (pillH + gap);
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = 'rgba(26, 20, 38, 0.85)';
        this.ctx.font = 'bold 13px ui-monospace, monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const text = entry.text;
        const tw = this.ctx.measureText(text).width + 24;
        const x = (this.canvas.width - tw) / 2;
        this.ctx.fillRect(x, y, tw, pillH);
        // Freshest pill gets the bright accent border; older ones dim so
        // the eye lands on the newest message first.
        this.ctx.strokeStyle = i === 0 ? '#F5C9A0' : 'rgba(245, 201, 160, 0.45)';
        this.ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, pillH - 1);
        // Left colour rail tinted by category (money / hearts / achievement
        // / info) so a busy stack is scannable by hue without reading every
        // line. Sits just inside the border, full-height of the pill.
        this.ctx.fillStyle = toastKindColor(entry.kind);
        this.ctx.fillRect(x + 1, y + 1, 3, pillH - 2);
        this.ctx.fillStyle = '#F5E9D4';
        this.ctx.fillText(text, this.canvas.width / 2, y + pillH / 2);
        this.ctx.restore();
      }
    }
    // One-time welcome card — drawn last so it sits above the whole HUD.
    this.onboardingCard.draw(this.ctx, this.canvas.width, this.canvas.height);
  }
}
