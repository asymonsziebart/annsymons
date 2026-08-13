import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import {
  getFamilyHistoryAnswers,
  saveFamilyHistoryAnswers,
  type SaveFamilyHistoryAnswer,
} from "@/lib/data/familyHistoryResponses";
import { getFamilyHistory } from "@/lib/familyHistory";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not access questionnaire answers.";
  const needsSetup =
    message.includes("MSSQL") ||
    message.includes("family_history_answers") ||
    message.includes("Invalid object name");

  return NextResponse.json(
    {
      error: needsSetup
        ? `${message} Run db/create-family-history-answers.sql on the MSSQL database.`
        : message,
    },
    { status: 500 }
  );
}

export async function GET() {
  if (!(await canUseAdminApi("/admin/family-history"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ answers: await getFamilyHistoryAnswers() });
  } catch (error) {
    console.error("Failed to load family history answers", error);
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  if (!(await canUseAdminApi("/admin/family-history"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const rawAnswers = Array.isArray(body.answers) ? body.answers : null;
    if (!rawAnswers) {
      return NextResponse.json({ error: "Answers must be an array." }, { status: 400 });
    }

    const history = await getFamilyHistory();
    const allowedIds = new Set(history.questions.map((question) => question.id));
    const answers: SaveFamilyHistoryAnswer[] = [];

    for (const raw of rawAnswers) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const questionId = typeof item.questionId === "string" ? item.questionId : "";
      if (!allowedIds.has(questionId)) {
        return NextResponse.json({ error: `Unknown question: ${questionId || "(missing)"}` }, { status: 400 });
      }
      answers.push({
        questionId,
        answer: typeof item.answer === "string" ? item.answer : "",
      });
    }

    if (answers.length !== history.questions.length) {
      return NextResponse.json(
        { error: "Please submit the complete questionnaire, including unanswered questions." },
        { status: 400 }
      );
    }

    const saved = await saveFamilyHistoryAnswers(answers, body.answeredBy);
    return NextResponse.json({ ok: true, answers: saved });
  } catch (error) {
    console.error("Failed to save family history answers", error);
    return errorResponse(error);
  }
}
