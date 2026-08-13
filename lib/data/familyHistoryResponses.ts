import sql from "mssql";
import { getMssqlPool } from "@/lib/mssql";

export type FamilyHistoryAnswer = {
  questionId: string;
  answer: string;
  answeredBy: string;
  updatedAt: string;
};

export type SaveFamilyHistoryAnswer = {
  questionId: string;
  answer: string;
};

const MAX_ANSWER_LENGTH = 8_000;

function normalize(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function getFamilyHistoryAnswers(): Promise<FamilyHistoryAnswer[]> {
  const pool = await getMssqlPool();
  const result = await pool.request().query<{
    question_id: string;
    answer_text: string;
    answered_by: string;
    updated_at: Date;
  }>(`
    SELECT question_id, answer_text, answered_by, updated_at
    FROM dbo.family_history_answers
    ORDER BY question_id
  `);

  return result.recordset.map((row) => ({
    questionId: row.question_id,
    answer: row.answer_text,
    answeredBy: row.answered_by,
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function saveFamilyHistoryAnswers(
  answers: SaveFamilyHistoryAnswer[],
  answeredByValue: unknown
): Promise<FamilyHistoryAnswer[]> {
  const answeredBy = normalize(answeredByValue, 100) || "Karolyn";
  const pool = await getMssqlPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    for (const item of answers) {
      const questionId = normalize(item.questionId, 100);
      const answer = normalize(item.answer, MAX_ANSWER_LENGTH);
      if (!questionId) continue;

      if (!answer) {
        await new sql.Request(transaction)
          .input("questionId", sql.NVarChar(100), questionId)
          .query("DELETE FROM dbo.family_history_answers WHERE question_id = @questionId");
        continue;
      }

      await new sql.Request(transaction)
        .input("questionId", sql.NVarChar(100), questionId)
        .input("answer", sql.NVarChar(MAX_ANSWER_LENGTH), answer)
        .input("answeredBy", sql.NVarChar(100), answeredBy)
        .query(`
          MERGE dbo.family_history_answers WITH (HOLDLOCK) AS target
          USING (SELECT @questionId AS question_id) AS source
            ON target.question_id = source.question_id
          WHEN MATCHED THEN
            UPDATE SET
              answer_text = @answer,
              answered_by = @answeredBy,
              updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (question_id, answer_text, answered_by)
            VALUES (@questionId, @answer, @answeredBy);
        `);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  return getFamilyHistoryAnswers();
}
