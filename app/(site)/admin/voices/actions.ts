"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import {
  addVoiceItem as addVoiceItemToStore,
  deleteVoiceItem as deleteVoiceItemFromStore,
} from "@/lib/data/voices";

export async function addVoiceItem(formData: FormData) {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
  const text = String(formData.get("text") ?? "").trim();
  await addVoiceItemToStore(text);
  revalidatePath("/admin");
  revalidatePath("/admin/voices");
}

export async function deleteVoiceItem(formData: FormData) {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
  const id = Number(formData.get("id"));
  await deleteVoiceItemFromStore(id);
  revalidatePath("/admin");
  revalidatePath("/admin/voices");
}
