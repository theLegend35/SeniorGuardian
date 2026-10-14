import { AccessError, ValidationError } from "@/lib/auth/access";
import type { LabelReading } from "@/lib/ai/types";

export type ActionState = { error?: string; notice?: string };

export type LabelState = ActionState & { reading?: LabelReading | null; fileId?: string; fileName?: string };

export function isRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

export function actionError(error: unknown): ActionState {
  if (isRedirect(error)) throw error;
  if (error instanceof ValidationError || error instanceof AccessError) return { error: error.message };
  if (error instanceof Error && error.message) return { error: error.message };
  return { error: "Something went wrong. Please try again." };
}
