"""Alembic environment — async engine on DATABASE_URL (Node-form URLs accepted)."""
from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context
from app.config import settings

config = context.config
target_metadata = None  # explicit SQL migrations; no autogenerate


def run_migrations_offline() -> None:
    context.configure(url=settings().sqlalchemy_url, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def _do_run(connection) -> None:  # type: ignore[no-untyped-def]
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(settings().sqlalchemy_url, pool_pre_ping=True)
    async with engine.connect() as conn:
        await conn.run_sync(_do_run)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
