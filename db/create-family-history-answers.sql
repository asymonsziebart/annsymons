IF OBJECT_ID(N'dbo.family_history_answers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.family_history_answers (
    question_id NVARCHAR(100) NOT NULL
      CONSTRAINT PK_family_history_answers PRIMARY KEY,
    answer_text NVARCHAR(8000) NOT NULL,
    answered_by NVARCHAR(100) NOT NULL,
    created_at DATETIME2(3) NOT NULL
      CONSTRAINT DF_family_history_answers_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL
      CONSTRAINT DF_family_history_answers_updated_at DEFAULT SYSUTCDATETIME()
  );
END;
