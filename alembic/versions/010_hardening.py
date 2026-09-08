"""Hardening migration: hashed tokens, audit append-only, scrub plaintext tokens.

Revision ID: 010_hardening
Revises: 009_analytics
"""

from typing import Sequence, Union

from alembic import op

revision: str = "010_hardening"
down_revision: Union[str, None] = "009_analytics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.execute(
        """
        ALTER TABLE identity.identity_tokens
            ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64),
            ADD COLUMN IF NOT EXISTS token_prefix VARCHAR(8)
        """
    )
    op.execute(
        """
        UPDATE identity.identity_tokens
        SET token_hash = encode(digest(token_value, 'sha256'), 'hex'),
            token_prefix = left(token_value, 8)
        WHERE token_value IS NOT NULL
          AND (token_hash IS NULL OR token_prefix IS NULL)
        """
    )
    op.execute(
        """
        UPDATE identity.identity_tokens
        SET token_hash = encode(digest(id::text || gen_random_uuid()::text, 'sha256'), 'hex'),
            token_prefix = 'legacy00'
        WHERE token_hash IS NULL
        """
    )
    op.execute(
        """
        ALTER TABLE identity.identity_tokens
            ALTER COLUMN token_hash SET NOT NULL,
            ALTER COLUMN token_prefix SET NOT NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_identity_tokens_token_hash
            ON identity.identity_tokens (token_hash)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_identity_tokens_token_prefix
            ON identity.identity_tokens (token_prefix)
        """
    )
    op.execute(
        """
        ALTER TABLE identity.identity_tokens
            ALTER COLUMN token_value DROP NOT NULL
        """
    )
    op.execute("UPDATE identity.identity_tokens SET token_value = NULL")

    op.execute(
        """
        DO $$
        BEGIN
            ALTER TABLE identity.token_usage_log
                DROP CONSTRAINT IF EXISTS token_usage_log_token_id_fkey;
            ALTER TABLE identity.token_usage_log
                ADD CONSTRAINT token_usage_log_token_id_fkey
                FOREIGN KEY (token_id)
                REFERENCES identity.identity_tokens(id)
                ON DELETE RESTRICT;
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END $$;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION audit.prevent_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit.events is append-only';
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute("DROP TRIGGER IF EXISTS audit_events_no_update ON audit.events")
    op.execute("DROP TRIGGER IF EXISTS audit_events_no_delete ON audit.events")
    op.execute(
        """
        CREATE TRIGGER audit_events_no_update
            BEFORE UPDATE ON audit.events
            FOR EACH ROW EXECUTE PROCEDURE audit.prevent_mutation()
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_events_no_delete
            BEFORE DELETE ON audit.events
            FOR EACH ROW EXECUTE PROCEDURE audit.prevent_mutation()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_events_no_update ON audit.events")
    op.execute("DROP TRIGGER IF EXISTS audit_events_no_delete ON audit.events")
    op.execute("DROP FUNCTION IF EXISTS audit.prevent_mutation()")
    op.execute("DROP INDEX IF EXISTS identity.uq_identity_tokens_token_hash")
    op.execute("DROP INDEX IF EXISTS identity.ix_identity_tokens_token_prefix")
    op.execute(
        """
        ALTER TABLE identity.identity_tokens
            DROP COLUMN IF EXISTS token_hash,
            DROP COLUMN IF EXISTS token_prefix
        """
    )
