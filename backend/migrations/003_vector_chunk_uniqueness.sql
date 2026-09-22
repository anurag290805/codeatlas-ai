-- The logical identity of a vector is the workspace, repository, and stable
-- parser chunk id. Keep the newest row for any legacy duplicates before adding
-- the matching unique index; no rows with distinct logical identities are
-- removed.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM codeatlas_vectors
        GROUP BY workspace_id, repository_id, chunk_id
        HAVING COUNT(*) > 1
    ) THEN
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY workspace_id, repository_id, chunk_id
                    ORDER BY created_at DESC NULLS LAST, id DESC
                ) AS row_number
            FROM codeatlas_vectors
        )
        DELETE FROM codeatlas_vectors
        WHERE id IN (SELECT id FROM ranked WHERE row_number > 1);
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vectors_workspace_repository_chunk
    ON codeatlas_vectors (workspace_id, repository_id, chunk_id);
