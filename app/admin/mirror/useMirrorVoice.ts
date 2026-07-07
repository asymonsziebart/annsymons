"use client";

import { useEffect, useRef, useState } from "react";

import type { TaskRow } from "@/lib/data/taskClientTypes";
import type { MirrorWeather } from "@/lib/mirrorWeather";
import {
  createMirrorVoiceController,
  type MirrorVoiceController,
  type MirrorVoiceStatus,
} from "./mirrorVoice";

type UseMirrorVoiceArgs = {
  now: Date;
  weather: MirrorWeather | null;
  dueTasks: TaskRow[];
};

export function useMirrorVoice({ now, weather, dueTasks }: UseMirrorVoiceArgs) {
  const [status, setStatus] = useState<MirrorVoiceStatus>("needs-permission");
  const controllerRef = useRef<MirrorVoiceController | null>(null);
  const contextRef = useRef({ now, weather, dueTasks });

  contextRef.current = { now, weather, dueTasks };

  useEffect(() => {
    const controller = createMirrorVoiceController(
      () => contextRef.current,
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

  return { status, enableVoice };
}
