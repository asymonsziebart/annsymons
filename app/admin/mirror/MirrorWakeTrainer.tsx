"use client";

import { useCallback, useEffect, useState } from "react";

import { getMirrorSpeechRecognition, speakMirrorResponse } from "./mirrorVoice";
import {
  addTrainingSample,
  clearAllTraining,
  clearTrainingTarget,
  loadMirrorWakeTraining,
  normalizeSpeech,
  saveMirrorWakeTraining,
  TRAINING_SAMPLES_NEEDED,
  WAKE_PHRASE_TARGETS,
  type MirrorWakeTraining,
  type WakePhraseTarget,
} from "./mirrorWakeTraining";

type MirrorWakeTrainerProps = {
  open: boolean;
  onClose: () => void;
  onTrainingChange: (training: MirrorWakeTraining) => void;
  pauseVoice: () => void;
  resumeVoice: () => void;
};

export default function MirrorWakeTrainer({
  open,
  onClose,
  onTrainingChange,
  pauseVoice,
  resumeVoice,
}: MirrorWakeTrainerProps) {
  const [training, setTraining] = useState<MirrorWakeTraining>({ heyMirror: [], mirrorMirror: [] });
  const [target, setTarget] = useState<WakePhraseTarget>("hey_mirror");
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);

  useEffect(() => {
    if (open) setTraining(loadMirrorWakeTraining());
  }, [open]);

  const persist = useCallback(
    (next: MirrorWakeTraining) => {
      setTraining(next);
      saveMirrorWakeTraining(next);
      onTrainingChange(next);
    },
    [onTrainingChange]
  );

  const captureSample = useCallback(async () => {
    const rec = getMirrorSpeechRecognition();
    if (!rec) {
      setMessage("Speech recognition is not available on this device.");
      return;
    }

    setRecording(true);
    setMessage("Say your wake phrase now…");
    pauseVoice();

    const heard = await new Promise<string | null>((resolve) => {
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";
      rec.onresult = (event) => {
        const text = event.results[0]?.[0]?.transcript ?? "";
        finish(normalizeSpeech(text));
      };
      rec.onerror = () => finish(null);
      rec.onend = () => finish(null);

      try {
        rec.start();
      } catch {
        finish(null);
      }
    });

    setRecording(false);
    resumeVoice();

    if (!heard) {
      setMessage("Didn't catch that — tap record and try again.");
      return;
    }

    setLastHeard(heard);
    const next = addTrainingSample(target, heard, training);
    persist(next);
    const count = next[trainingKeyLocal(target)].length;
    if (count >= TRAINING_SAMPLES_NEEDED) {
      setMessage(`Saved ${count} samples for “${labelFor(target)}”. You're trained!`);
      void speakMirrorResponse(`Training saved for ${labelFor(target)}.`);
    } else {
      setMessage(`Got “${heard}”. Sample ${count} of ${TRAINING_SAMPLES_NEEDED}.`);
    }
  }, [pauseVoice, persist, resumeVoice, target, training]);

  if (!open) return null;

  const targetSamples = training[trainingKeyLocal(target)];
  const targetMeta = WAKE_PHRASE_TARGETS.find((t) => t.id === target)!;

  return (
    <div className="mirror-trainer-backdrop" role="dialog" aria-modal="true" aria-label="Train wake phrase">
      <div className="mirror-trainer">
        <div className="mirror-trainer__header">
          <h2 className="mirror-trainer__title">Train wake phrase</h2>
          <button type="button" className="mirror-trainer__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="mirror-trainer__intro">
          Say the phrase the way you naturally say it. The mirror learns what Chrome hears and
          matches that later — even if it is not perfect text.
        </p>

        <div className="mirror-trainer__targets">
          {WAKE_PHRASE_TARGETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mirror-trainer__target${target === item.id ? " mirror-trainer__target--active" : ""}`}
              onClick={() => {
                setTarget(item.id);
                setMessage(null);
                setLastHeard(null);
              }}
            >
              {item.label}
              <span className="mirror-trainer__target-count">
                {training[trainingKeyLocal(item.id)].length}/{TRAINING_SAMPLES_NEEDED}
              </span>
            </button>
          ))}
        </div>

        <p className="mirror-trainer__prompt">
          Say <strong>{targetMeta.hint}</strong> clearly, {TRAINING_SAMPLES_NEEDED} times.
        </p>

        <button
          type="button"
          className="mirror-trainer__record"
          onClick={() => void captureSample()}
          disabled={recording}
        >
          {recording ? "Listening…" : `Record sample ${Math.min(targetSamples.length + 1, TRAINING_SAMPLES_NEEDED)}`}
        </button>

        {message ? <p className="mirror-trainer__message">{message}</p> : null}
        {lastHeard ? <p className="mirror-trainer__heard">Last heard: “{lastHeard}”</p> : null}

        {targetSamples.length > 0 ? (
          <ul className="mirror-trainer__samples">
            {targetSamples.map((sample, i) => (
              <li key={`${sample}-${i}`}>{sample}</li>
            ))}
          </ul>
        ) : null}

        <div className="mirror-trainer__actions">
          <button
            type="button"
            className="mirror-trainer__secondary"
            onClick={() => {
              persist(clearTrainingTarget(target, training));
              setMessage(`Cleared training for ${labelFor(target)}.`);
              setLastHeard(null);
            }}
          >
            Clear this phrase
          </button>
          <button
            type="button"
            className="mirror-trainer__secondary"
            onClick={() => {
              persist(clearAllTraining());
              setMessage("Cleared all wake phrase training.");
              setLastHeard(null);
            }}
          >
            Clear all
          </button>
          <button type="button" className="mirror-trainer__primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function trainingKeyLocal(target: WakePhraseTarget): "heyMirror" | "mirrorMirror" {
  return target === "hey_mirror" ? "heyMirror" : "mirrorMirror";
}

function labelFor(target: WakePhraseTarget): string {
  return WAKE_PHRASE_TARGETS.find((t) => t.id === target)?.label ?? target;
}
