"use client";

import { useState, useRef } from "react";

type Props = {
  folder: "recipes" | "blog" | "gallery";
  value: string;
  onChange: (path: string) => void;
  label: string;
  inputClass: string;
  required?: boolean;
};

export default function ImageUploadField({ folder, value, onChange, label, inputClass, required }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("folder", folder);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed");
        return;
      }
      onChange(data.path);
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={folder === "blog" ? "/blog/photo.jpg" : folder === "recipes" ? "/recipes/photo.webp" : "/gallery/photo.jpg"}
          required={required}
        />
        <label className="cursor-pointer whitespace-nowrap rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={handleFileChange}
          />
          {uploading ? "Uploading…" : "Upload photo"}
        </label>
      </div>
      {value && (
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Preview: <img src={value} alt="" className="mt-1 max-h-24 rounded object-cover" />
        </p>
      )}
      {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
    </div>
  );
}
