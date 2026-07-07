"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TaskRow } from "@/lib/data/taskClientTypes";
import type { MirrorWeather } from "@/lib/mirrorWeather";
import {
  createMirrorVoiceController,
  type MirrorVoiceController,
  type MirrorVoiceStatus,
} from "./mirrorVoice";
import { loadMirrorWakeTraining, type MirrorWakeTraining } from "./mirrorWakeTraining";

type UseMirrorVoiceArgs = {
  now: Date;
  weather: MirrorWeather | null;
  dueTasks: TaskRow[];
};

export function useMirrorVoice({ now, weather, dueTasks }: UseMirrorVoiceArgs) {
  const [status, setStatus] = useState<MirrorVoiceStatus>("needs-permission");
  const [training, setTraining] = useState<MirrorWakeTraining>({
    heyMirror: [],
    mirrorMirror: [],
  });
  const controllerRef = useRef<MirrorVoiceController | null>(null);
  const contextRef = useRef({ now, weather, dueTasks });
  const trainingRef = useRef(training);

  contextRef.current = { now, weather, dueTasks };
  trainingRef.current = training;

  useEffect(() => {
    setTraining(loadMirrorWakeTraining());
  }, []);

  useEffect(() => {
    const controller = createMirrorVoiceController(
      () => contextRef.current,
      () => trainingRef.current,
      setStatus
    );
    controllerRef.current = controller;
    return () => {
      controller?.stop();
      controllerRef.current = null;
    };
  }, []);

  const enableVoice = () => {
    controllerRef.current?.start();
  };

  const pauseVoice = useCallback(() => {
    controllerRef.current?.pause();
  }, []);

  const resumeVoice = useCallback(() => {
    controllerRef.current?.resume();
  }, []);

  const updateTraining = useCallback((next: MirrorWakeTraining) => {
    trainingRef.current = next;
    setTraining(next);
  }, []);

  return {
    status,
    training,
    enableVoice,
    pauseVoice,
    resumeVoice,
    updateTraining,
  };
}
