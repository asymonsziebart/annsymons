"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { scanCardPhoto, uploadCardPhoto } from "@/lib/cardScanClient";

type ItemStatus =
  | "queued"
  | "uploading"
  | "scanning"
  | "ready"
  | "saving"
  | "saved"
  | "error";

type CardFields = {
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
};

type ScanItem = {
  id: string;
  file: File;
  previewUrl: string;
  imagePath: string | null;
  selected: boolean;
  status: ItemStatus;
  error: string | null;
  fields: CardFields;
};

type ScannerStatus = {
  provider?: string | null;
  model?: string | null;
  reachable?: boolean;
  installed?: boolean;
  error?: string;
};

const EMPTY_FIELDS: CardFields = {
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
};

function statusLabel(status: ItemStatus): string {
  switch (status) {
    case "uploading":
      return "Preparing photo…";
    case "scanning":
      return "Reading with AI…";
    case "ready":
      return "Ready to save";
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved to database";
    case "error":
      return "Needs attention";
    default:
      return "Waiting";
  }
}

export default function BatchCardScanner() {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [scanner, setScanner] = useState<ScannerStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const previewUrls = useRef<string[]>([]);

  useEffect(() => {
    void checkScanner();
    return () => {
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
    };
  }, []);

  async function checkScanner() {
    setChecking(true);
    try {
      const response = await fetch("/api/admin/pokemon-cards/scan-status");
      const data = (await response.json()) as ScannerStatus & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not check scanner");
      setScanner(data);
    } catch (error) {
      setScanner({
        reachable: false,
        installed: false,
        error: error instanceof Error ? error.message : "Could not check scanner",
      });
    } finally {
      setChecking(false);
    }
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const additions = Array.from(files).map((file, index): ScanItem => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        previewUrl,
        imagePath: null,
        selected: true,
        status: "queued",
        error: null,
        fields: { ...EMPTY_FIELDS },
      };
    });
    setItems((current) => [...current, ...additions]);
    setMessage(`${additions.length} photo${additions.length === 1 ? "" : "s"} added.`);
  }

  function patchItem(id: string, patch: Partial<ScanItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function patchFields(id: string, patch: Partial<CardFields>) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, fields: { ...item.fields, ...patch } } : item
      )
    );
  }

  async function scanOne(item: ScanItem) {
    patchItem(item.id, { status: "uploading", error: null });
    try {
      const imagePath = await uploadCardPhoto(item.file);
      patchItem(item.id, { status: "scanning", imagePath });
      const result = await scanCardPhoto(imagePath, "pokemon");
      patchItem(item.id, {
        imagePath: result.imagePath,
        status: "ready",
        fields: {
          name: result.card.name ?? "",
          setName: result.card.setName ?? "",
          cardNumber: result.card.cardNumber ?? "",
          variant: result.card.variant ?? "",
          condition: result.card.condition ?? "Near Mint",
          grader: result.card.grader ?? "",
          grade: result.card.grade ?? "",
          language: result.card.language ?? "English",
          quantity: "1",
          purchasePrice: "",
        },
      });
    } catch (error) {
      patchItem(item.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Scan failed",
      });
    }
  }

  async function scanQueue() {
    const queue = items.filter(
      (item) =>
        item.selected && (item.status === "queued" || item.status === "error")
    );
    if (queue.length === 0) {
      setMessage("Select at least one waiting photo.");
      return;
    }

    setWorking(true);
    setMessage(
      `Scanning ${queue.length} photo${queue.length === 1 ? "" : "s"}, one at a time…`
    );
    for (const item of queue) {
      await scanOne(item);
    }
    setWorking(false);
    setMessage("Scanning finished. Check the fields, then save the ones you want.");
  }

  async function saveOne(item: ScanItem): Promise<boolean> {
    if (!item.fields.name.trim()) {
      patchItem(item.id, {
        status: "error",
        error: "Card name is required before saving.",
      });
      return false;
    }

    patchItem(item.id, { status: "saving", error: null });
    try {
      // Local dev writes photos under public/, a path that would 404 in
      // production. Only keep the photo when upload returned a hosted URL.
      const imagePath = /^https?:\/\//i.test(item.imagePath ?? "")
        ? item.imagePath
        : null;
      const response = await fetch("/api/admin/pokemon-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "pokemon",
          ...item.fields,
          quantity: Number(item.fields.quantity) || 1,
          purchasePrice:
            item.fields.purchasePrice === ""
              ? null
              : Number(item.fields.purchasePrice),
          imagePath,
          notes: `Scanned locally from ${item.file.name}`,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Save failed");
      patchItem(item.id, { status: "saved", selected: false });
      return true;
    } catch (error) {
      patchItem(item.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Save failed",
      });
      return false;
    }
  }

  async function saveReady() {
    const ready = items.filter((item) => item.selected && item.status === "ready");
    if (ready.length === 0) {
      setMessage("Select at least one scanned card to save.");
      return;
    }

    setWorking(true);
    setMessage(`Saving ${ready.length} card${ready.length === 1 ? "" : "s"}…`);
    let saved = 0;
    for (const item of ready) {
      if (await saveOne(item)) saved += 1;
    }
    setWorking(false);
    setMessage(
      `Saved ${saved} of ${ready.length} card${ready.length === 1 ? "" : "s"} to your collection.`
    );
  }

  function removeItem(item: ScanItem) {
    URL.revokeObjectURL(item.previewUrl);
    previewUrls.current = previewUrls.current.filter(
      (url) => url !== item.previewUrl
    );
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  const readyCount = items.filter(
    (item) => item.selected && item.status === "ready"
  ).length;
  const waitingCount = items.filter(
    (item) =>
      item.selected && (item.status === "queued" || item.status === "error")
  ).length;
  const savedCount = items.filter((item) => item.status === "saved").length;
  const scannerReady = Boolean(scanner?.reachable && scanner?.installed);

  return (
    <main className="pc-batch-shell">
      <div className="pc-batch-topbar">
        <div>
          <Link href="/admin/pokemon-cards" className="pc-back">
            ← Pokémon Cards
          </Link>
          <h1>Batch scanner</h1>
          <p>
            Pick a stack of card photos, let the local AI read them one at a
            time, fix anything it got wrong, then save them all to your
            collection.
          </p>
        </div>
        <Link href="/admin/pokemon-cards" className="pc-btn">
          View collection
        </Link>
      </div>

      <section className="pc-batch-status">
        <span className={`pc-batch-dot${scannerReady ? " is-ready" : ""}`} />
        <div>
          <strong>
            {checking
              ? "Checking the scanner…"
              : scannerReady
                ? `${scanner?.model} is ready`
                : scanner?.reachable
                  ? `Ollama is running, but ${scanner?.model} isn't installed`
                  : "Can't reach Ollama on this computer"}
          </strong>
          <small>
            {checking
              ? ""
              : scannerReady
                ? "Photos stay on this computer. Card details save to your database."
                : scanner?.reachable
                  ? `Run: ollama pull ${scanner?.model}`
                  : scanner?.error || "Start Ollama, then check again."}
          </small>
        </div>
        <button
          type="button"
          className="pc-btn"
          onClick={() => void checkScanner()}
          disabled={working}
        >
          Check again
        </button>
      </section>

      <section className="pc-batch-controls">
        <label className="pc-btn pc-btn-primary">
          Choose photos
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="pc-btn"
          disabled={working || waitingCount === 0 || !scannerReady}
          onClick={() => void scanQueue()}
        >
          {working ? "Working…" : `Scan ${waitingCount || ""} photo${waitingCount === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          className="pc-btn pc-btn-primary"
          disabled={working || readyCount === 0}
          onClick={() => void saveReady()}
        >
          Save {readyCount || ""} card{readyCount === 1 ? "" : "s"}
        </button>
        {savedCount > 0 ? (
          <span className="pc-batch-saved-count">{savedCount} saved</span>
        ) : null}
      </section>

      {message ? <p className="pc-status">{message}</p> : null}

      {items.length === 0 ? (
        <section className="pc-batch-empty">
          <div>
            <strong>No photos chosen yet</strong>
            <p>
              One card per photo works best. Fill the frame, keep it flat, avoid
              glare, and make sure the collector number at the bottom is
              readable.
            </p>
          </div>
        </section>
      ) : (
        <div className="pc-batch-grid">
          {items.map((item) => (
            <article
              className={`pc-batch-card pc-batch-card--${item.status}`}
              key={item.id}
            >
              <div className="pc-batch-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="" />
                <label>
                  <input
                    type="checkbox"
                    checked={item.selected}
                    disabled={item.status === "saved" || working}
                    onChange={(event) =>
                      patchItem(item.id, { selected: event.target.checked })
                    }
                  />
                  Include
                </label>
              </div>

              <div className="pc-batch-card-body">
                <div className="pc-batch-card-head">
                  <div>
                    <strong>{item.fields.name || item.file.name}</strong>
                    <small>{statusLabel(item.status)}</small>
                  </div>
                  <button
                    type="button"
                    className="pc-btn pc-btn-ghost"
                    disabled={working}
                    onClick={() => removeItem(item)}
                  >
                    Remove
                  </button>
                </div>

                {item.error ? (
                  <p className="pc-batch-error">{item.error}</p>
                ) : null}

                {item.status === "ready" ||
                item.status === "saved" ||
                item.status === "saving" ||
                (item.status === "error" && item.fields.name) ? (
                  <div className="pc-batch-fields">
                    <label>
                      Name
                      <input
                        value={item.fields.name}
                        onChange={(event) =>
                          patchFields(item.id, { name: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Set
                      <input
                        value={item.fields.setName}
                        onChange={(event) =>
                          patchFields(item.id, { setName: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Number
                      <input
                        value={item.fields.cardNumber}
                        onChange={(event) =>
                          patchFields(item.id, { cardNumber: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Variant
                      <input
                        value={item.fields.variant}
                        onChange={(event) =>
                          patchFields(item.id, { variant: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Condition
                      <select
                        value={item.fields.condition}
                        onChange={(event) =>
                          patchFields(item.id, { condition: event.target.value })
                        }
                      >
                        <option>Mint</option>
                        <option>Near Mint</option>
                        <option>Lightly Played</option>
                        <option>Moderately Played</option>
                        <option>Heavily Played</option>
                        <option>Damaged</option>
                      </select>
                    </label>
                    <label>
                      Quantity
                      <input
                        type="number"
                        min="1"
                        value={item.fields.quantity}
                        onChange={(event) =>
                          patchFields(item.id, { quantity: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Grader
                      <input
                        placeholder="PSA, BGS…"
                        value={item.fields.grader}
                        onChange={(event) =>
                          patchFields(item.id, { grader: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Grade
                      <input
                        value={item.fields.grade}
                        onChange={(event) =>
                          patchFields(item.id, { grade: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Paid
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Optional"
                        value={item.fields.purchasePrice}
                        onChange={(event) =>
                          patchFields(item.id, {
                            purchasePrice: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                ) : null}

                {item.status === "error" ? (
                  <div className="pc-actions">
                    <button
                      type="button"
                      className="pc-btn"
                      disabled={working}
                      onClick={() => void scanOne(item)}
                    >
                      Scan this one again
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
