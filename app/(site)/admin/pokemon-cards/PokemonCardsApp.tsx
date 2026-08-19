"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  CardComp,
  CardScanResult,
  CollectionCard,
  CollectionCategory,
  CollectionSnapshot,
} from "@/lib/collectionCardsShared";
import { CATEGORY_LABELS, COLLECTION_CATEGORIES } from "@/lib/collectionCardsShared";
import {
  TIMEFRAMES,
  filterSnapshots,
  formatUsd,
  portfolioTotals,
  type Timeframe,
} from "@/lib/collectionValue";
import { uploadAndScanCardPhoto } from "@/lib/cardScanClient";

const CardScanner = dynamic(() => import("./CardScanner"), {
  ssr: false,
  loading: () => (
    <section className="pc-panel pc-scanner">
      <div className="pc-panel-body">
        <p className="pc-value-meta">Starting scanner…</p>
      </div>
    </section>
  ),
});

type Totals = ReturnType<typeof portfolioTotals>;

type Props = {
  initialCategory: CollectionCategory;
  ebayConfigured: boolean;
};

type View = "home" | "collection" | "form" | "detail" | "scan";

type FormState = {
  id: number | null;
  name: string;
  setName: string;
  cardNumber: string;
  variant: string;
  condition: string;
  grader: string;
  grade: string;
  language: string;
  quantity: string;
  purchasePrice: string;
  acquiredOn: string;
  imagePath: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  setName: "",
  cardNumber: "",
  variant: "",
  condition: "Near Mint",
  grader: "",
  grade: "",
  language: "English",
  quantity: "1",
  purchasePrice: "",
  acquiredOn: "",
  imagePath: "",
  notes: "",
};

function cardToForm(card: CollectionCard): FormState {
  return {
    id: card.id,
    name: card.name,
    setName: card.setName ?? "",
    cardNumber: card.cardNumber ?? "",
    variant: card.variant ?? "",
    condition: card.condition ?? "",
    grader: card.grader ?? "",
    grade: card.grade ?? "",
    language: card.language ?? "",
    quantity: String(card.quantity),
    purchasePrice: card.purchasePrice == null ? "" : String(card.purchasePrice),
    acquiredOn: card.acquiredOn ?? "",
    imagePath: card.imagePath ?? "",
    notes: card.notes ?? "",
  };
}

function searchable(card: CollectionCard): string {
  return [
    card.name,
    card.setName,
    card.cardNumber,
    card.variant,
    card.condition,
    card.grader,
    card.grade,
    card.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function ValueChart({ snapshots, timeframe }: { snapshots: CollectionSnapshot[]; timeframe: Timeframe }) {
  const points = filterSnapshots(snapshots, timeframe);
  if (points.length < 2) {
    return (
      <div className="pc-chart" aria-hidden>
        <svg viewBox="0 0 320 72" preserveAspectRatio="none">
          <path
            d="M0 52 C40 48, 80 40, 120 42 S200 58, 240 36 S300 28, 320 24"
            fill="none"
            stroke="rgba(57,255,20,0.55)"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }

  const values = points.map((p) => p.marketValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const coords = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 320;
      const y = 64 - ((point.marketValue - min) / span) * 52;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="pc-chart" aria-hidden>
      <svg viewBox="0 0 320 72" preserveAspectRatio="none">
        <polyline
          points={coords}
          fill="none"
          stroke="rgba(57,255,20,0.85)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 16V4m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 10.5 21 7v10l-6-3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3.5 14.7 9l6 .5-4.6 4 1.4 5.8L12 16.7 6.5 19.3 7.9 13.5 3.3 9.5l6-.5L12 3.5z" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg className="pc-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function PokemonCardsApp({
  initialCategory,
  ebayConfigured,
}: Props) {
  const [category, setCategory] = useState<CollectionCategory>(initialCategory);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [snapshots, setSnapshots] = useState<CollectionSnapshot[]>([]);
  const [totals, setTotals] = useState<Totals>(() => portfolioTotals([]));
  const [timeframe, setTimeframe] = useState<Timeframe>("ALL");
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [comps, setComps] = useState<CardComp[]>([]);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "warn" | "">("");
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [scanStartWithUpload, setScanStartWithUpload] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadScanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setInitialLoading(true);
      setStatus("Loading collection...");
      setStatusTone("");
      try {
        const res = await fetch(`/api/admin/pokemon-cards?category=${initialCategory}`);
        const data = (await res.json()) as {
          cards?: CollectionCard[];
          snapshots?: CollectionSnapshot[];
          totals?: Totals;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Failed to load cards");
        if (cancelled) return;
        setCategory(initialCategory);
        setCards(data.cards ?? []);
        setSnapshots(data.snapshots ?? []);
        setTotals(data.totals ?? portfolioTotals(data.cards ?? []));
        setStatus("");
        setStatusTone("");
      } catch (error) {
        if (cancelled) return;
        setStatus(
          error instanceof Error
            ? error.message
            : "Could not load cards. Check DATABASE_URL."
        );
        setStatusTone("warn");
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [initialCategory]);

  const selected = useMemo(
    () => cards.find((card) => card.id === selectedId) ?? null,
    [cards, selectedId]
  );

  const filtered = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (terms.length === 0) return cards;
    return cards.filter((card) => {
      const hay = searchable(card);
      return terms.every((term) => hay.includes(term));
    });
  }, [cards, query]);

  function setMessage(message: string, tone: "ok" | "warn" | "" = "") {
    setStatus(message);
    setStatusTone(tone);
  }

  async function loadCategory(next: CollectionCategory) {
    setBusy(true);
    setMessage("Loading collection...");
    try {
      const res = await fetch(`/api/admin/pokemon-cards?category=${next}`);
      const data = (await res.json()) as {
        cards?: CollectionCard[];
        snapshots?: CollectionSnapshot[];
        totals?: Totals;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load cards");
      setCategory(next);
      setCards(data.cards ?? []);
      setSnapshots(data.snapshots ?? []);
      setTotals(data.totals ?? portfolioTotals(data.cards ?? []));
      setView("home");
      setSelectedId(null);
      setComps([]);
      window.history.replaceState(null, "", `/admin/pokemon-cards?category=${next}`);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load", "warn");
    } finally {
      setBusy(false);
    }
  }

  async function refreshList() {
    const res = await fetch(`/api/admin/pokemon-cards?category=${category}`);
    const data = (await res.json()) as {
      cards?: CollectionCard[];
      snapshots?: CollectionSnapshot[];
      totals?: Totals;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "Failed to refresh");
    setCards(data.cards ?? []);
    setSnapshots(data.snapshots ?? []);
    setTotals(data.totals ?? portfolioTotals(data.cards ?? []));
  }

  function openScan(options?: { upload?: boolean }) {
    setForm(EMPTY_FORM);
    setScanStartWithUpload(options?.upload ?? false);
    setView("scan");
    setMessage(
      options?.upload
        ? "Choose a saved photo — we'll read the card details from it."
        : "Point your camera at the card or upload a saved photo."
    );
  }

  function openUploadScan() {
    setForm(EMPTY_FORM);
    setMessage("Choose a photo from your library to scan.");
    uploadScanRef.current?.click();
  }

  function mergeScanIntoForm(card: CardScanResult, imagePath: string) {
    setForm((prev) => ({
      ...prev,
      name: card.name || prev.name,
      setName: card.setName ?? prev.setName,
      cardNumber: card.cardNumber ?? prev.cardNumber,
      variant: card.variant ?? prev.variant,
      condition: card.condition || prev.condition,
      grader: card.grader ?? prev.grader,
      grade: card.grade ?? prev.grade,
      language: card.language || prev.language,
      imagePath,
    }));
  }

  function applyScanToForm(card: CardScanResult, imagePath: string) {
    setForm({
      id: null,
      name: card.name ?? "",
      setName: card.setName ?? "",
      cardNumber: card.cardNumber ?? "",
      variant: card.variant ?? "",
      condition: card.condition ?? "Near Mint",
      grader: card.grader ?? "",
      grade: card.grade ?? "",
      language: card.language ?? "English",
      quantity: "1",
      purchasePrice: "",
      acquiredOn: "",
      imagePath,
      notes: "",
    });
    setView("form");
    setScanStartWithUpload(false);
    setMessage(
      card.message ??
        (card.configured
          ? "Scanned — review the fields, then save."
          : "Photo uploaded — enter any details the scan missed."),
      card.configured ? "ok" : "warn"
    );
  }

  async function uploadAndScanImage(file: File) {
    setBusy(true);
    setMessage("Uploading and scanning photo...");
    try {
      const result = await uploadAndScanCardPhoto(file, category);
      mergeScanIntoForm(result.card, result.imagePath);
      if (view !== "form") setView("form");
      setMessage(
        result.card.message ??
          (result.card.configured
            ? "Scanned from photo — review the fields, then save."
            : "Photo uploaded — enter any details the scan missed."),
        result.card.configured ? "ok" : "warn"
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload and scan failed", "warn");
    } finally {
      setBusy(false);
    }
  }

  async function saveCard(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setMessage("Card name is required.", "warn");
      return;
    }
    setBusy(true);
    setMessage(form.id ? "Saving card..." : "Adding card...");
    try {
      const payload = {
        category,
        name: form.name,
        setName: form.setName,
        cardNumber: form.cardNumber,
        variant: form.variant,
        condition: form.condition,
        grader: form.grader,
        grade: form.grade,
        language: form.language,
        quantity: Number(form.quantity) || 1,
        purchasePrice: form.purchasePrice === "" ? null : Number(form.purchasePrice),
        acquiredOn: form.acquiredOn || null,
        imagePath: form.imagePath || null,
        notes: form.notes,
      };
      const res = await fetch(
        form.id ? `/api/admin/pokemon-cards/${form.id}` : "/api/admin/pokemon-cards",
        {
          method: form.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json()) as { card?: CollectionCard; error?: string };
      if (!res.ok || !data.card) throw new Error(data.error || "Save failed");
      await refreshList();
      setSelectedId(data.card.id);
      setForm(cardToForm(data.card));
      setView("detail");
      setMessage(`Saved ${data.card.name}.`, "ok");
      void loadComps(data.card.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed", "warn");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCard(id: number) {
    if (!window.confirm("Delete this card from your collection?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pokemon-cards/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await refreshList();
      setSelectedId(null);
      setComps([]);
      setForm(EMPTY_FORM);
      setView("collection");
      setMessage("Card deleted.", "ok");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed", "warn");
    } finally {
      setBusy(false);
    }
  }

  async function loadComps(cardId: number) {
    const res = await fetch(`/api/admin/pokemon-cards/${cardId}/comps`);
    const data = (await res.json()) as { comps?: CardComp[]; error?: string };
    if (!res.ok) throw new Error(data.error || "Failed to load comps");
    setComps(data.comps ?? []);
  }

  async function openCard(card: CollectionCard) {
    setSelectedId(card.id);
    setForm(cardToForm(card));
    setView("detail");
    setBusy(true);
    try {
      await loadComps(card.id);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load comps", "warn");
    } finally {
      setBusy(false);
    }
  }

  async function refreshEbay(cardId: number) {
    setBusy(true);
    setMessage("Looking up sold comps on eBay...");
    try {
      const res = await fetch(`/api/admin/pokemon-cards/${cardId}/comps`, {
        method: "PUT",
      });
      const data = (await res.json()) as {
        card?: CollectionCard;
        comps?: CardComp[];
        mode?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "eBay lookup failed");
      if (data.comps) setComps(data.comps);
      if (data.card) {
        setCards((prev) => prev.map((c) => (c.id === data.card!.id ? data.card! : c)));
        setForm(cardToForm(data.card));
        setSelectedId(data.card.id);
      }
      await refreshList();
      const tone = data.mode === "sold" ? "ok" : "warn";
      setMessage(
        data.message ||
          (data.mode === "sold"
            ? `Found ${data.comps?.length ?? 0} sold comps.`
            : data.mode === "active"
              ? `Using ${data.comps?.length ?? 0} active listings (sold API not enabled).`
              : "No eBay comps found."),
        tone
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "eBay lookup failed", "warn");
    } finally {
      setBusy(false);
    }
  }

  async function revalueAll() {
    setBusy(true);
    setMessage("Revaluing collection from eBay...");
    try {
      const res = await fetch("/api/admin/pokemon-cards/revalue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const data = (await res.json()) as {
        cards?: CollectionCard[];
        totals?: Totals;
        updated?: number;
        truncated?: boolean;
        messages?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Revalue failed");
      setCards(data.cards ?? []);
      if (data.totals) setTotals(data.totals);
      await refreshList();
      setMessage(
        [
          `Updated ${data.updated ?? 0} cards.`,
          data.truncated ? "Stopped at 40 — run again for the rest." : "",
          data.messages?.[0] ?? "",
        ]
          .filter(Boolean)
          .join(" "),
        "ok"
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Revalue failed", "warn");
    } finally {
      setBusy(false);
    }
  }

  async function toggleComp(comp: CardComp) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/pokemon-cards/${comp.cardId}/comps/${comp.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isExcluded: !comp.isExcluded }),
        }
      );
      const data = (await res.json()) as {
        card?: CollectionCard;
        comps?: CardComp[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to update comp");
      if (data.comps) setComps(data.comps);
      if (data.card) {
        setCards((prev) => prev.map((c) => (c.id === data.card!.id ? data.card! : c)));
      }
      await refreshList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update comp", "warn");
    } finally {
      setBusy(false);
    }
  }

  async function addManualComp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pokemon-cards/${selectedId}/comps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(formData.get("title") || "Manual sold price"),
          soldPrice: Number(formData.get("soldPrice")),
          soldOn: String(formData.get("soldOn") || "") || null,
          listingUrl: String(formData.get("listingUrl") || "") || null,
        }),
      });
      const data = (await res.json()) as {
        card?: CollectionCard;
        comps?: CardComp[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to add comp");
      if (data.comps) setComps(data.comps);
      if (data.card) {
        setCards((prev) => prev.map((c) => (c.id === data.card!.id ? data.card! : c)));
        setForm(cardToForm(data.card));
      }
      event.currentTarget.reset();
      await refreshList();
      setMessage("Manual sold price added.", "ok");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add comp", "warn");
    } finally {
      setBusy(false);
    }
  }

  const label = CATEGORY_LABELS[category];
  const gain =
    totals.costBasis > 0 ? ((totals.marketValue - totals.costBasis) / totals.costBasis) * 100 : null;

  if (initialLoading) {
    return (
      <div className="pc-shell">
        <Link href="/admin" className="pc-back">
          ← Admin
        </Link>
        <p className="pc-loading-title">Pokemon Cards</p>
        <p className="pc-value-meta">Loading collection…</p>
      </div>
    );
  }

  return (
    <div className="pc-shell">
      <Link href="/admin" className="pc-back">
        ← Admin
      </Link>

      <div className="pc-top">
        <div className="pc-tabs" role="tablist" aria-label="Collection type">
          {COLLECTION_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              className="pc-tab"
              aria-selected={category === cat}
              disabled={busy || pending}
              onClick={() => startTransition(() => void loadCategory(cat))}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="pc-icon-btn"
          title="Refresh values from eBay"
          disabled={busy || cards.length === 0}
          onClick={() => void revalueAll()}
        >
          <IconStar />
        </button>
      </div>

      <div className="pc-value-block">
        <div className="pc-value">{formatUsd(totals.marketValue)}</div>
        <div className="pc-value-meta">
          {gain == null
            ? "All time"
            : `${gain >= 0 ? "+" : ""}${gain.toFixed(1)}% vs cost · All time`}
        </div>
      </div>

      <hr className="pc-divider" />

      <div className="pc-timeframes" role="group" aria-label="Timeframe">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            className="pc-tf"
            aria-pressed={timeframe === tf}
            onClick={() => setTimeframe(tf)}
          >
            {tf}
          </button>
        ))}
      </div>

      <ValueChart snapshots={snapshots} timeframe={timeframe} />

      {view === "home" ? (
        <>
          <div className="pc-section-label">Tools</div>
          <div className="pc-tools">
            <button
              type="button"
              className="pc-tool"
              onClick={() => openScan()}
            >
              <span className="pc-tool-icon">
                <IconCamera />
              </span>
              <span>
                <div className="pc-tool-title">Live Card Scanner</div>
                <div className="pc-tool-sub">
                  Snap your camera at a card to fill in name, set, and number.
                </div>
              </span>
            </button>
            <button
              type="button"
              className="pc-tool"
              onClick={openUploadScan}
            >
              <span className="pc-tool-icon">
                <IconUpload />
              </span>
              <span>
                <div className="pc-tool-title">Upload photo to scan</div>
                <div className="pc-tool-sub">
                  Pick a saved photo from your library — no card in front of you needed.
                </div>
              </span>
            </button>
            <button
              type="button"
              className="pc-tool"
              onClick={() => {
                setForm(EMPTY_FORM);
                setView("form");
                setMessage("Type card details by hand, or upload a photo to scan.");
              }}
            >
              <span className="pc-tool-icon">
                <IconBolt />
              </span>
              <span>
                <div className="pc-tool-title">Add by hand</div>
                <div className="pc-tool-sub">Type set, condition, grade, and notes yourself.</div>
              </span>
            </button>
            <button
              type="button"
              className="pc-tool"
              onClick={() => {
                setForm(EMPTY_FORM);
                setView("form");
                setMessage(
                  ebayConfigured
                    ? "Save the card, then tap Check eBay solds on the detail screen."
                    : "Save the card, then add EBAY_CLIENT_ID / EBAY_CLIENT_SECRET to auto-price — or enter sold prices by hand.",
                  ebayConfigured ? "ok" : "warn"
                );
              }}
            >
              <span className="pc-tool-icon">
                <IconVideo />
              </span>
              <span>
                <div className="pc-tool-title">eBay sold lookup</div>
                <div className="pc-tool-sub">
                  Cross-reference recent sold listings to estimate worth.
                </div>
              </span>
            </button>
            <button
              type="button"
              className="pc-tool"
              onClick={() => void revalueAll()}
              disabled={busy || cards.length === 0}
            >
              <span className="pc-tool-icon">
                <IconVideo />
              </span>
              <span>
                <div className="pc-tool-title">Revalue collection</div>
                <div className="pc-tool-sub">Refresh every card from eBay solds / askings.</div>
              </span>
            </button>
          </div>

          <button
            type="button"
            className="pc-collection"
            onClick={() => setView("collection")}
          >
            <span className="pc-poke" aria-hidden />
            <span>
              <div className="pc-collection-title">{label} Collection</div>
              <div className="pc-collection-sub">
                {totals.cardCount === 0
                  ? "No cards yet"
                  : `${totals.cardCount} card${totals.cardCount === 1 ? "" : "s"} · ${totals.valuedCount} valued`}
              </div>
            </span>
            <IconChevron />
          </button>
        </>
      ) : null}

      {view === "collection" ? (
        <section className="pc-panel">
          <div className="pc-panel-head">
            <h2>{label} Collection</h2>
            <div className="pc-actions">
              <button type="button" className="pc-btn pc-btn-ghost" onClick={() => setView("home")}>
                Back
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-primary"
                onClick={() => openScan()}
              >
                Scan card
              </button>
              <button
                type="button"
                className="pc-btn"
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setView("form");
                }}
              >
                Add by hand
              </button>
            </div>
          </div>
          <div className="pc-panel-body">
            <input
              className="pc-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, set, number..."
            />
            {filtered.length === 0 ? (
              <p className="pc-empty">No cards yet. Add your first {label} card.</p>
            ) : (
              <div className="pc-card-list">
                {filtered.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className="pc-card-row"
                    onClick={() => void openCard(card)}
                    style={{ width: "100%", cursor: "pointer", textAlign: "left" }}
                  >
                    {card.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="pc-card-thumb" src={card.imagePath} alt="" />
                    ) : (
                      <div className="pc-card-thumb pc-card-thumb-empty">TCG</div>
                    )}
                    <div>
                      <div className="pc-card-name">{card.name}</div>
                      <div className="pc-card-meta">
                        {[card.setName, card.cardNumber ? `#${card.cardNumber}` : null, card.condition]
                          .filter(Boolean)
                          .join(" · ") || "Details"}
                        {card.quantity > 1 ? ` · ×${card.quantity}` : ""}
                      </div>
                    </div>
                    <div className="pc-card-value">
                      {formatUsd(card.marketValue)}
                      <small>
                        {card.marketValueSample
                          ? `${card.marketValueSample} comps`
                          : "not valued"}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {view === "scan" ? (
        <CardScanner
          category={category}
          startWithUpload={scanStartWithUpload}
          onScanned={applyScanToForm}
          onCancel={() => {
            setScanStartWithUpload(false);
            setView("home");
          }}
        />
      ) : null}

      {view === "form" ? (
        <section className="pc-panel">
          <div className="pc-panel-head">
            <h2>{form.id ? "Edit card" : "Add card"}</h2>
            <div className="pc-actions">
              <button type="button" className="pc-btn" onClick={() => openScan()}>
                Scan
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-ghost"
                onClick={() => setView(form.id ? "detail" : "home")}
              >
                Cancel
              </button>
            </div>
          </div>
          <form className="pc-panel-body" onSubmit={saveCard}>
            <div className="pc-field">
              <label htmlFor="pc-name">Name</label>
              <input
                id="pc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Charizard"
                required
              />
            </div>
            <div className="pc-grid-2">
              <div className="pc-field">
                <label htmlFor="pc-set">Set</label>
                <input
                  id="pc-set"
                  value={form.setName}
                  onChange={(e) => setForm({ ...form, setName: e.target.value })}
                  placeholder="Base Set"
                />
              </div>
              <div className="pc-field">
                <label htmlFor="pc-number">Number</label>
                <input
                  id="pc-number"
                  value={form.cardNumber}
                  onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
                  placeholder="4/102"
                />
              </div>
            </div>
            <div className="pc-grid-2">
              <div className="pc-field">
                <label htmlFor="pc-variant">Variant</label>
                <input
                  id="pc-variant"
                  value={form.variant}
                  onChange={(e) => setForm({ ...form, variant: e.target.value })}
                  placeholder="Holo / 1st Edition"
                />
              </div>
              <div className="pc-field">
                <label htmlFor="pc-condition">Condition</label>
                <select
                  id="pc-condition"
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                >
                  <option value="">—</option>
                  <option>Sealed</option>
                  <option>Mint</option>
                  <option>Near Mint</option>
                  <option>Lightly Played</option>
                  <option>Moderately Played</option>
                  <option>Heavily Played</option>
                  <option>Damaged</option>
                </select>
              </div>
            </div>
            <div className="pc-grid-2">
              <div className="pc-field">
                <label htmlFor="pc-grader">Grader</label>
                <input
                  id="pc-grader"
                  value={form.grader}
                  onChange={(e) => setForm({ ...form, grader: e.target.value })}
                  placeholder="PSA / CGC / BGS"
                />
              </div>
              <div className="pc-field">
                <label htmlFor="pc-grade">Grade</label>
                <input
                  id="pc-grade"
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>
            <div className="pc-grid-2">
              <div className="pc-field">
                <label htmlFor="pc-qty">Quantity</label>
                <input
                  id="pc-qty"
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div className="pc-field">
                <label htmlFor="pc-paid">Paid (USD)</label>
                <input
                  id="pc-paid"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                />
              </div>
            </div>
            <div className="pc-grid-2">
              <div className="pc-field">
                <label htmlFor="pc-acquired">Acquired</label>
                <input
                  id="pc-acquired"
                  type="date"
                  value={form.acquiredOn}
                  onChange={(e) => setForm({ ...form, acquiredOn: e.target.value })}
                />
              </div>
              <div className="pc-field">
                <label htmlFor="pc-lang">Language</label>
                <input
                  id="pc-lang"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                />
              </div>
            </div>
            <div className="pc-field">
              <label htmlFor="pc-photo">Photo</label>
              <p className="pc-field-hint">Upload a saved photo to scan name, set, and number automatically.</p>
              <input
                ref={fileRef}
                id="pc-photo"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadAndScanImage(file);
                }}
              />
              {form.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.imagePath}
                  alt=""
                  style={{
                    marginTop: "0.5rem",
                    width: "100%",
                    maxHeight: "220px",
                    objectFit: "cover",
                    borderRadius: "0.75rem",
                  }}
                />
              ) : null}
            </div>
            <div className="pc-field">
              <label htmlFor="pc-notes">Notes</label>
              <textarea
                id="pc-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="pc-actions">
              <button type="submit" className="pc-btn pc-btn-primary" disabled={busy}>
                {busy ? "Saving..." : "Save card"}
              </button>
              {!form.id ? (
                <button type="button" className="pc-btn" onClick={() => openScan()} disabled={busy}>
                  Scan another
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      {view === "detail" && selected ? (
        <section className="pc-panel">
          <div className="pc-panel-head">
            <h2>{selected.name}</h2>
            <div className="pc-actions">
              <button
                type="button"
                className="pc-btn pc-btn-ghost"
                onClick={() => setView("collection")}
              >
                Back
              </button>
              <button
                type="button"
                className="pc-btn"
                onClick={() => setView("form")}
              >
                Edit
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-danger"
                onClick={() => void deleteCard(selected.id)}
              >
                Delete
              </button>
            </div>
          </div>
          <div className="pc-panel-body">
            <div className="pc-card-row" style={{ marginBottom: "1rem" }}>
              {selected.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="pc-card-thumb" src={selected.imagePath} alt="" />
              ) : (
                <div className="pc-card-thumb pc-card-thumb-empty">TCG</div>
              )}
              <div>
                <div className="pc-card-name">{selected.name}</div>
                <div className="pc-card-meta">
                  {[selected.setName, selected.cardNumber ? `#${selected.cardNumber}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className="pc-card-value">
                {formatUsd(selected.marketValue)}
                <small>
                  {selected.marketValueSource
                    ? `${selected.marketValueSource} · ${selected.marketValueSample ?? 0}`
                    : "not valued"}
                </small>
              </div>
            </div>

            <div className="pc-actions" style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                className="pc-btn pc-btn-primary"
                disabled={busy}
                onClick={() => void refreshEbay(selected.id)}
              >
                {busy ? "Checking eBay..." : "Check eBay solds"}
              </button>
            </div>

            <div className="pc-section-label" style={{ marginTop: 0 }}>
              Sold comps
            </div>
            {comps.length === 0 ? (
              <p className="pc-empty">
                No comps yet. Tap Check eBay solds, or add a sold price below.
              </p>
            ) : (
              comps.map((comp) => (
                <div
                  key={comp.id}
                  className="pc-comp-row"
                  data-excluded={comp.isExcluded ? "true" : "false"}
                >
                  <div className="pc-comp-title">{comp.title}</div>
                  <div className="pc-comp-meta">
                    {formatUsd(comp.soldPrice)}
                    {comp.soldOn ? ` · sold ${comp.soldOn}` : ""}
                    {comp.conditionLabel ? ` · ${comp.conditionLabel}` : ""}
                    {` · ${comp.source}`}
                  </div>
                  <div className="pc-actions">
                    {comp.listingUrl ? (
                      <a
                        className="pc-btn pc-btn-ghost"
                        href={comp.listingUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="pc-btn"
                      onClick={() => void toggleComp(comp)}
                    >
                      {comp.isExcluded ? "Include" : "Exclude"}
                    </button>
                  </div>
                </div>
              ))
            )}

            <form onSubmit={addManualComp} style={{ marginTop: "1rem" }}>
              <div className="pc-section-label">Add sold price by hand</div>
              <div className="pc-grid-2">
                <div className="pc-field">
                  <label htmlFor="manual-price">Sold price</label>
                  <input id="manual-price" name="soldPrice" type="number" min={0} step="0.01" required />
                </div>
                <div className="pc-field">
                  <label htmlFor="manual-date">Sold on</label>
                  <input id="manual-date" name="soldOn" type="date" />
                </div>
              </div>
              <div className="pc-field">
                <label htmlFor="manual-title">Title</label>
                <input id="manual-title" name="title" placeholder={`${selected.name} sold`} />
              </div>
              <div className="pc-field">
                <label htmlFor="manual-url">Listing URL</label>
                <input id="manual-url" name="listingUrl" placeholder="https://www.ebay.com/..." />
              </div>
              <button type="submit" className="pc-btn" disabled={busy}>
                Add sold price
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {status ? (
        <p className="pc-status" data-tone={statusTone || undefined}>
          {status}
        </p>
      ) : null}

      {!ebayConfigured && view === "home" ? (
        <p className="pc-status" data-tone="warn">
          eBay auto-pricing needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET. Until then you can still
          catalogue cards and enter sold prices by hand.
        </p>
      ) : null}

      <input
        ref={uploadScanRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="pc-scanner-file"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadAndScanImage(file);
        }}
      />
    </div>
  );
}
