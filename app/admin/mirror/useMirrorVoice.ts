"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TaskRow } from "@/lib/data/taskClientTypes";
import type { MirrorWeather } from "@/lib/mirrorWeather";
import {
  createMirrorVoiceController,
  type MirrorActionVoiceHandler,
  type MirrorRecipeVoiceHandler,
  type MirrorVoiceController,
  type MirrorVoiceStatus,
} from "./mirrorVoice";
import { loadMirrorWakeTraining, type MirrorWakeTraining } from "./mirrorWakeTraining";

type UseMirrorVoiceArgs = {
  now: Date;
  weather: MirrorWeather | null;
  dueTasks: TaskRow[];
  getRecipeHandler?: () => MirrorRecipeVoiceHandler | null;
  getActionHandler?: () => MirrorActionVoiceHandler | null;
};

export function useMirrorVoice({
  now,
  weather,
  dueTasks,
  getRecipeHandler,
  getActionHandler,
}: UseMirrorVoiceArgs) {
  const [status, setStatus] = useState<MirrorVoiceStatus>("needs-permission");
  const [lastHeard, setLastHeard] = useState<string | null>(null);
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

  const getRecipeHandlerRef = useRef(getRecipeHandler);
  getRecipeHandlerRef.current = getRecipeHandler;
  const getActionHandlerRef = useRef(getActionHandler);
  getActionHandlerRef.current = getActionHandler;

  useEffect(() => {
    const controller = createMirrorVoiceController(
      () => contextRef.current,
      () => trainingRef.current,
      setStatus,
      () => getRecipeHandlerRef.current?.() ?? null,
      () => getActionHandlerRef.current?.() ?? null,
      (heard) => setLastHeard(heard)
    );
    controllerRef.current = controller;
    return () => {
      controller?.stop();
      controllerRef.current = null;
    };
  }, []);

  const enableVoice = () => {
    setLastHeard(null);
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
    lastHeard,
    training,
    enableVoice,
    pauseVoice,
    resumeVoice,
    updateTraining,
  };
}
