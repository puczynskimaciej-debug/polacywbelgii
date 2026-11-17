-- Keep AI editorial workflow and article presentation in the same candidate row.
-- Existing candidates continue to use their Polish text until edited.
ALTER TABLE ai_candidates ADD COLUMN article_fields_json TEXT NOT NULL DEFAULT '{}';
