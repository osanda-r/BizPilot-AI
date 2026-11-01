import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from .models import Task, TaskBatchResult, TaskCreate, TaskStatus, TaskUpdate

TASK_COLUMNS = "id, title, description, priority, order_reference, due_date, status, created_at, updated_at"


class TaskStore:
    def __init__(self, path: Path):
        self.path = path

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute(
                """CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    priority TEXT NOT NULL CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
                    order_reference TEXT,
                    due_date TEXT,
                    status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'done')),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )"""
            )
            db.execute("CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status)")
            db.execute(
                """CREATE UNIQUE INDEX IF NOT EXISTS tasks_order_title_idx
                ON tasks(order_reference, lower(title)) WHERE order_reference IS NOT NULL"""
            )

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def _to_task(row: sqlite3.Row) -> Task:
        return Task.model_validate(dict(row))

    def list_tasks(self, status: TaskStatus | None = None) -> list[Task]:
        with self.connection() as db:
            if status:
                rows = db.execute(
                    f"SELECT {TASK_COLUMNS} FROM tasks WHERE status = ? ORDER BY created_at DESC, id DESC",
                    (status,),
                ).fetchall()
            else:
                rows = db.execute(
                    f"SELECT {TASK_COLUMNS} FROM tasks ORDER BY created_at DESC, id DESC"
                ).fetchall()
        return [self._to_task(row) for row in rows]

    def create_many(self, tasks: list[TaskCreate]) -> TaskBatchResult:
        now = datetime.now(UTC).isoformat()
        created: list[Task] = []
        skipped = 0
        with self.connection() as db:
            # A single transaction makes a reviewed batch atomic, including duplicate checks.
            db.execute("BEGIN IMMEDIATE")
            for payload in tasks:
                reference = payload.order_reference or None
                if (
                    reference
                    and db.execute(
                        "SELECT 1 FROM tasks WHERE order_reference = ? AND title = ? COLLATE NOCASE",
                        (reference, payload.title),
                    ).fetchone()
                ):
                    skipped += 1
                    continue
                task = Task(**payload.model_dump(), id=str(uuid4()), created_at=now, updated_at=now)
                db.execute(
                    f"INSERT INTO tasks ({TASK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        task.id,
                        task.title,
                        task.description,
                        task.priority,
                        task.order_reference,
                        task.due_date.isoformat() if task.due_date else None,
                        task.status,
                        task.created_at.isoformat(),
                        task.updated_at.isoformat(),
                    ),
                )
                created.append(task)
        return TaskBatchResult(tasks=created, created_count=len(created), skipped_count=skipped)

    def update(self, task_id: str, payload: TaskUpdate) -> Task | None:
        with self.connection() as db:
            row = db.execute(
                f"UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? RETURNING {TASK_COLUMNS}",
                (payload.status, datetime.now(UTC).isoformat(), task_id),
            ).fetchone()
        return self._to_task(row) if row else None

    def delete(self, task_id: str) -> bool:
        with self.connection() as db:
            cursor = db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        return cursor.rowcount > 0
