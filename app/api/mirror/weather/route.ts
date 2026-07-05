import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth";
import { fetchMirrorWeather } from "@/lib/mirrorWeather";
import { isTasksAuth } from "@/lib/tasksAuth";

export async function GET() {
  const ok = (await isAdmin()) || (await isTasksAuth());
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weather = await fetchMirrorWeather();
  if (!weather) {
    return NextResponse.json({ error: "Weather unavailable" }, { status: 502 });
  }

  return NextResponse.json(weather);
}
