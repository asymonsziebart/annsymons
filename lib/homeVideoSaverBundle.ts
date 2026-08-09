export const HOME_VIDEO_SAVER_VERSION = "1.0.0";

export const HOME_VIDEO_SAVER_FILES = {
  "home_video_saver.py": String.raw`#!/usr/bin/env python3
"""Home Video Saver — turn personal, unencrypted DVDs into cloud-ready MP4 files."""

from __future__ import annotations

import json
import os
import platform
import queue
import re
import shutil
import subprocess
import threading
import tkinter as tk
import webbrowser
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

APP_NAME = "Home Video Saver"
HANDBRAKE_URL = "https://handbrake.fr/downloads2.php"
PRESETS = {
    "Balanced (recommended)": "Fast 1080p30",
    "Best quality": "HQ 1080p30 Surround",
    "Smaller files": "Fast 720p30",
}


def find_handbrake() -> str | None:
    executable = "HandBrakeCLI.exe" if os.name == "nt" else "HandBrakeCLI"
    nearby = Path(__file__).resolve().parent / executable
    candidates = [
        shutil.which("HandBrakeCLI"),
        str(nearby) if nearby.exists() else None,
    ]
    if os.name == "nt":
        candidates.extend([
            r"C:\Program Files\HandBrake\HandBrakeCLI.exe",
            r"C:\Program Files (x86)\HandBrake\HandBrakeCLI.exe",
        ])
    else:
        candidates.extend([
            "/opt/homebrew/bin/HandBrakeCLI",
            "/usr/local/bin/HandBrakeCLI",
        ])
    return next((item for item in candidates if item and Path(item).exists()), None)


def duration_text(item: dict) -> str:
    duration = item.get("Duration") or {}
    hours = int(duration.get("Hours", 0))
    minutes = int(duration.get("Minutes", 0))
    seconds = int(duration.get("Seconds", 0))
    return f"{hours}:{minutes:02d}:{seconds:02d}"


def safe_name(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]+', "-", value).strip(" .-")
    return cleaned or "Home Video"


class HomeVideoSaver(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(APP_NAME)
        self.geometry("780x650")
        self.minsize(680, 570)
        self.configure(bg="#e9eef5")

        self.handbrake = find_handbrake()
        self.events: queue.Queue[tuple[str, object]] = queue.Queue()
        self.titles: list[dict] = []
        self.worker: threading.Thread | None = None
        self.cancel_event = threading.Event()
        self.process: subprocess.Popen[str] | None = None

        self.source_var = tk.StringVar()
        self.output_var = tk.StringVar(value=str(Path.home() / "Videos" / "Home Video Saver"))
        self.name_var = tk.StringVar(value="Family DVD")
        self.preset_var = tk.StringVar(value="Balanced (recommended)")
        self.status_var = tk.StringVar(value="Choose your DVD or VIDEO_TS folder to begin.")
        self.progress_var = tk.DoubleVar(value=0)
        self.all_titles_var = tk.BooleanVar(value=False)

        self._build()
        self.after(100, self._read_events)

    def _build(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame", background="#e9eef5")
        style.configure("TLabel", background="#e9eef5", foreground="#27364a", font=("Segoe UI", 10))
        style.configure("Title.TLabel", font=("Segoe UI Semibold", 23), foreground="#1d4ed8")
        style.configure("Hint.TLabel", foreground="#52657d", font=("Segoe UI", 9))
        style.configure("Primary.TButton", font=("Segoe UI Semibold", 11), padding=(18, 10))

        root = ttk.Frame(self, padding=26)
        root.pack(fill="both", expand=True)
        ttk.Label(root, text="Home Video Saver", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            root,
            text="Convert your personal DVDs to MP4 files you can save in the cloud.",
            style="Hint.TLabel",
        ).pack(anchor="w", pady=(2, 22))

        self._path_row(root, "DVD or VIDEO_TS folder", self.source_var, self._pick_source)
        self.scan_button = ttk.Button(root, text="Scan DVD", command=self._scan)
        self.scan_button.pack(anchor="w", pady=(4, 18))

        ttk.Label(root, text="Recording to convert").pack(anchor="w")
        self.title_list = tk.Listbox(
            root,
            height=6,
            exportselection=False,
            bg="#f7f9fc",
            fg="#27364a",
            selectbackground="#2563eb",
            selectforeground="white",
            relief="flat",
            highlightthickness=1,
            highlightbackground="#c9d4e3",
            font=("Segoe UI", 10),
        )
        self.title_list.pack(fill="x", pady=(5, 6))
        ttk.Checkbutton(
            root,
            text="Convert every title (creates one MP4 per recording)",
            variable=self.all_titles_var,
        ).pack(anchor="w", pady=(0, 15))

        options = ttk.Frame(root)
        options.pack(fill="x", pady=(0, 14))
        left = ttk.Frame(options)
        left.pack(side="left", fill="x", expand=True, padx=(0, 12))
        ttk.Label(left, text="File name").pack(anchor="w")
        ttk.Entry(left, textvariable=self.name_var).pack(fill="x", pady=(5, 0))
        right = ttk.Frame(options)
        right.pack(side="left", fill="x", expand=True)
        ttk.Label(right, text="Quality").pack(anchor="w")
        ttk.Combobox(
            right,
            textvariable=self.preset_var,
            values=list(PRESETS),
            state="readonly",
        ).pack(fill="x", pady=(5, 0))

        self._path_row(root, "Save MP4 files to", self.output_var, self._pick_output)

        ttk.Progressbar(root, variable=self.progress_var, maximum=100).pack(fill="x", pady=(8, 7))
        ttk.Label(root, textvariable=self.status_var, style="Hint.TLabel").pack(anchor="w")

        actions = ttk.Frame(root)
        actions.pack(fill="x", pady=(18, 0))
        self.convert_button = ttk.Button(
            actions,
            text="Convert to MP4",
            style="Primary.TButton",
            command=self._convert,
        )
        self.convert_button.pack(side="left")
        self.cancel_button = ttk.Button(actions, text="Cancel", command=self._cancel, state="disabled")
        self.cancel_button.pack(side="left", padx=10)
        ttk.Button(actions, text="Setup help", command=lambda: webbrowser.open(HANDBRAKE_URL)).pack(side="right")

        if not self.handbrake:
            self.status_var.set(
                "Setup needed: install HandBrakeCLI, then reopen this app. Click Setup help."
            )

    def _path_row(self, parent: ttk.Frame, label: str, variable: tk.StringVar, command) -> None:
        ttk.Label(parent, text=label).pack(anchor="w")
        row = ttk.Frame(parent)
        row.pack(fill="x", pady=(5, 14))
        ttk.Entry(row, textvariable=variable).pack(side="left", fill="x", expand=True)
        ttk.Button(row, text="Browse…", command=command).pack(side="left", padx=(8, 0))

    def _pick_source(self) -> None:
        path = filedialog.askdirectory(title="Choose DVD drive or VIDEO_TS folder")
        if path:
            self.source_var.set(path)

    def _pick_output(self) -> None:
        path = filedialog.askdirectory(title="Choose where to save MP4 files")
        if path:
            self.output_var.set(path)

    def _ready(self) -> bool:
        self.handbrake = find_handbrake()
        if not self.handbrake:
            messagebox.showinfo(
                "HandBrakeCLI needed",
                "Install the official HandBrake command-line app, or place HandBrakeCLI "
                "in this folder, then reopen Home Video Saver.",
            )
            webbrowser.open(HANDBRAKE_URL)
            return False
        source = Path(self.source_var.get().strip())
        if not source.exists():
            messagebox.showerror("Choose a DVD", "Choose your DVD drive or VIDEO_TS folder first.")
            return False
        return True

    def _scan(self) -> None:
        if not self._ready() or (self.worker and self.worker.is_alive()):
            return
        self._set_busy(True)
        self.status_var.set("Scanning the DVD for recordings…")
        self.progress_var.set(0)
        self.worker = threading.Thread(target=self._scan_worker, daemon=True)
        self.worker.start()

    def _scan_worker(self) -> None:
        command = [self.handbrake or "HandBrakeCLI", "-i", self.source_var.get(), "-t", "0", "--scan", "--json"]
        try:
            result = subprocess.run(command, capture_output=True, text=True, errors="replace")
            combined = result.stdout + "\n" + result.stderr
            marker = combined.find('"TitleList"')
            if marker < 0:
                raise RuntimeError("No readable titles were found.")
            start = combined.rfind("{", 0, marker)
            decoder = json.JSONDecoder()
            data, _ = decoder.raw_decode(combined[start:])
            titles = data.get("TitleList", [])
            if not titles:
                raise RuntimeError("No readable titles were found.")
            self.events.put(("scan_done", titles))
        except Exception as exc:
            self.events.put(("error", f"Could not scan this DVD: {exc}"))

    def _convert(self) -> None:
        if not self._ready() or (self.worker and self.worker.is_alive()):
            return
        if not self.titles:
            messagebox.showinfo("Scan first", "Click Scan DVD and choose a recording first.")
            return
        selected = list(range(len(self.titles))) if self.all_titles_var.get() else list(self.title_list.curselection())
        if not selected:
            messagebox.showinfo("Choose a recording", "Choose one recording, or select Convert every title.")
            return
        output = Path(self.output_var.get().strip())
        output.mkdir(parents=True, exist_ok=True)
        self.cancel_event.clear()
        self._set_busy(True)
        self.status_var.set("Starting conversion…")
        self.progress_var.set(0)
        self.worker = threading.Thread(target=self._convert_worker, args=(selected, output), daemon=True)
        self.worker.start()

    def _convert_worker(self, selected: list[int], output: Path) -> None:
        base = safe_name(self.name_var.get())
        preset = PRESETS[self.preset_var.get()]
        try:
            for position, list_index in enumerate(selected):
                title = self.titles[list_index]
                number = int(title.get("Index", list_index + 1))
                suffix = f" - Part {position + 1:02d}" if len(selected) > 1 else ""
                destination = output / f"{base}{suffix}.mp4"
                command = [
                    self.handbrake or "HandBrakeCLI",
                    "-i", self.source_var.get(),
                    "-o", str(destination),
                    "-t", str(number),
                    "--preset", preset,
                    "--markers",
                    "--optimize",
                ]
                self.events.put(("status", f"Converting recording {position + 1} of {len(selected)}…"))
                self.process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    errors="replace",
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                )
                assert self.process.stdout
                for line in self.process.stdout:
                    if self.cancel_event.is_set():
                        self.process.terminate()
                        raise InterruptedError
                    match = re.search(r"Encoding:.*?(\d+\.\d+)\s*%", line)
                    if match:
                        local = float(match.group(1))
                        overall = ((position + local / 100) / len(selected)) * 100
                        self.events.put(("progress", overall))
                if self.process.wait() != 0:
                    raise RuntimeError(f"HandBrake stopped while converting recording {position + 1}.")
            self.events.put(("done", str(output)))
        except InterruptedError:
            self.events.put(("cancelled", None))
        except Exception as exc:
            self.events.put(("error", f"Conversion failed: {exc}"))
        finally:
            self.process = None

    def _cancel(self) -> None:
        self.cancel_event.set()
        self.status_var.set("Stopping safely…")
        if self.process and self.process.poll() is None:
            self.process.terminate()

    def _set_busy(self, busy: bool) -> None:
        state = "disabled" if busy else "normal"
        self.scan_button.configure(state=state)
        self.convert_button.configure(state=state)
        self.cancel_button.configure(state="normal" if busy else "disabled")

    def _read_events(self) -> None:
        try:
            while True:
                event, payload = self.events.get_nowait()
                if event == "scan_done":
                    self.titles = payload  # type: ignore[assignment]
                    self.title_list.delete(0, tk.END)
                    for item in self.titles:
                        self.title_list.insert(
                            tk.END,
                            f"Recording {item.get('Index', '?')}  •  {duration_text(item)}",
                        )
                    self.title_list.selection_set(0)
                    self.status_var.set(f"Found {len(self.titles)} recording(s). Choose one and convert.")
                    self._set_busy(False)
                elif event == "progress":
                    self.progress_var.set(float(payload))
                elif event == "status":
                    self.status_var.set(str(payload))
                elif event == "done":
                    self.progress_var.set(100)
                    self.status_var.set("Finished — your MP4 files are ready.")
                    self._set_busy(False)
                    if messagebox.askyesno("Conversion complete", "Your MP4 files are ready. Open their folder?"):
                        path = str(payload)
                        if platform.system() == "Windows":
                            os.startfile(path)  # type: ignore[attr-defined]
                        elif platform.system() == "Darwin":
                            subprocess.run(["open", path])
                        else:
                            subprocess.run(["xdg-open", path])
                elif event == "cancelled":
                    self.status_var.set("Conversion cancelled.")
                    self.progress_var.set(0)
                    self._set_busy(False)
                elif event == "error":
                    self.status_var.set(str(payload))
                    self._set_busy(False)
                    messagebox.showerror(APP_NAME, str(payload))
        except queue.Empty:
            pass
        self.after(100, self._read_events)


if __name__ == "__main__":
    HomeVideoSaver().mainloop()
`,
  "Start Home Video Saver.bat": String.raw`@echo off
cd /d "%~dp0"
where pyw >nul 2>nul
if %errorlevel%==0 (
  start "" pyw home_video_saver.py
  exit /b
)
where pythonw >nul 2>nul
if %errorlevel%==0 (
  start "" pythonw home_video_saver.py
  exit /b
)
echo Python 3 is required. Download it from https://www.python.org/downloads/
pause
`,
  "Start Home Video Saver.command": String.raw`#!/bin/bash
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "Python 3 is required" message "Install Python 3 from python.org, then try again."'
  open "https://www.python.org/downloads/"
  exit 1
fi
python3 home_video_saver.py
`,
  "README.txt": String.raw`HOME VIDEO SAVER 1.0
====================

Home Video Saver converts personal, unencrypted DVDs and VIDEO_TS folders
into MP4 files suitable for Google Drive, iCloud, OneDrive, or another cloud.
All conversion happens on your computer. Nothing is uploaded automatically.

BEFORE YOU START
1. Install Python 3 from https://www.python.org/downloads/
   On Windows, check "Add Python to PATH" during installation.
2. Install the official HandBrake command-line app:
   https://handbrake.fr/downloads2.php
   You may also place HandBrakeCLI.exe (Windows) or HandBrakeCLI (Mac)
   directly in this Home Video Saver folder.

WINDOWS
Double-click "Start Home Video Saver.bat".

MAC
Control-click "Start Home Video Saver.command", choose Open, then confirm.
If macOS says the file is not executable, open Terminal and run:
chmod +x "Start Home Video Saver.command"

HOW TO USE IT
1. Insert your DVD.
2. Choose the DVD drive or its VIDEO_TS folder.
3. Click Scan DVD.
4. Choose a recording, or check "Convert every title".
5. Choose where to save it and click Convert to MP4.
6. Upload the finished MP4 files to your cloud provider.

IMPORTANT
- Use this only for DVDs you own and have permission to copy.
- It does not bypass copy protection or DRM.
- Keep the original DVD until you have opened and checked every converted file.
- A long DVD may take an hour or more depending on the computer.
`,
} as const;
