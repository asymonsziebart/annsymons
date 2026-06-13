"use client";

import { useState } from "react";
import type { ArtworkDocument } from "@/lib/procreate/types";
import { generateId, saveArtwork } from "@/lib/procreate/storage";
import Gallery from "./Gallery";
import Studio from "./Studio";

type View = { mode: "gallery" } | { mode: "studio"; id: string };

export default function ProcreateApp() {
  const [view, setView] = useState<View>({ mode: "gallery" });

  async function handleCreate(name: string, width: number, height: number) {
    const now = Date.now();
    const id = generateId();
    const doc: ArtworkDocument = {
      id,
      name,
      width,
      height,
      createdAt: now,
      modifiedAt: now,
      thumbnail: "",
      backgroundColor: "#ffffff",
      layers: [
        {
          id: generateId(),
          name: "Layer 1",
          visible: true,
          opacity: 1,
          blendMode: "normal",
          locked: false,
          imageData: "",
        },
      ],
    };
    await saveArtwork(doc);
    setView({ mode: "studio", id });
  }

  if (view.mode === "studio") {
    return <Studio artworkId={view.id} onBack={() => setView({ mode: "gallery" })} />;
  }

  return (
    <Gallery
      onOpen={(id) => setView({ mode: "studio", id })}
      onCreate={handleCreate}
    />
  );
}
