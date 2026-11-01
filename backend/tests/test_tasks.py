from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from app.models import TaskCreate
from app.storage import TaskStore


def payload(title="Confirm order", reference="BP-12", **kwargs):
    return {
        "title": title,
        "description": "Check availability",
        "priority": "normal",
        "order_reference": reference,
        "due_date": None,
        **kwargs,
    }


def test_task_lifecycle(client):
    created = client.post("/api/tasks", json={"tasks": [payload()]})
    assert created.status_code == 201
    task = created.json()["tasks"][0]
    assert task["status"] == "todo"
    assert client.get("/api/tasks").json() == [task]
    updated = client.patch(f"/api/tasks/{task['id']}", json={"status": "in_progress"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_progress"
    assert client.get("/api/tasks?status=in_progress").json()[0]["id"] == task["id"]
    assert client.get("/api/tasks?status=todo").json() == []
    done = client.patch(f"/api/tasks/{task['id']}", json={"status": "done"})
    assert done.json()["status"] == "done"
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 204
    assert client.get("/api/tasks").json() == []


def test_tasks_persist_across_app_restart(settings: Path):
    from app.main import create_app
    from fastapi.testclient import TestClient

    with TestClient(create_app(settings)) as client:
        result = client.post("/api/tasks", json={"tasks": [payload()]}).json()
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/tasks").json() == result["tasks"]


def test_duplicate_order_tasks_skipped_across_batches(client):
    first = client.post("/api/tasks", json={"tasks": [payload(), payload(title="Prepare mugs")]})
    assert first.json()["created_count"] == 2
    second = client.post(
        "/api/tasks", json={"tasks": [payload(title="CONFIRM ORDER"), payload(title="Prepare plates")]}
    )
    assert second.status_code == 201
    assert second.json()["created_count"] == 1
    assert second.json()["skipped_count"] == 1
    assert len(client.get("/api/tasks").json()) == 3
    all_duplicates = client.post("/api/tasks", json={"tasks": [payload()]})
    assert all_duplicates.status_code == 200
    assert all_duplicates.json()["tasks"] == []


def test_duplicates_within_a_batch_are_atomic_and_prevented(client):
    result = client.post("/api/tasks", json={"tasks": [payload(), payload(title="confirm order")]}).json()
    assert result["created_count"] == 1
    assert result["skipped_count"] == 1


def test_manual_tasks_without_reference_are_not_deduplicated(client):
    result = client.post("/api/tasks", json={"tasks": [payload(reference=None), payload(reference=None)]})
    assert result.json()["created_count"] == 2


def test_concurrent_duplicate_save_is_safe(settings):
    store = TaskStore(settings.database_path)
    store.initialize()

    def save(_):
        return store.create_many([TaskCreate.model_validate(payload())]).created_count

    with ThreadPoolExecutor(max_workers=4) as pool:
        counts = list(pool.map(save, range(8)))
    assert sum(counts) == 1
    assert len(store.list_tasks()) == 1


@pytest.mark.parametrize(
    "tasks",
    [
        [],
        [payload(title="")],
        [payload(title="   ")],
        [payload(priority="critical")],
        [payload(due_date="2026-02-30")],
        [payload(title="x" * 201)],
        [payload(description="x" * 6001)],
        [payload()] * 51,
    ],
)
def test_invalid_tasks_rejected(client, tasks):
    assert client.post("/api/tasks", json={"tasks": tasks}).status_code == 422
    assert client.get("/api/tasks").json() == []


def test_task_updates_validate_status_and_missing_id(client):
    created = client.post("/api/tasks", json={"tasks": [payload()]}).json()["tasks"][0]
    assert client.patch(f"/api/tasks/{created['id']}", json={"status": "finished"}).status_code == 422
    assert client.patch("/api/tasks/missing", json={"status": "done"}).status_code == 404
    assert client.delete("/api/tasks/missing").status_code == 404


def test_invalid_status_filter(client):
    assert client.get("/api/tasks?status=unknown").status_code == 422


def test_database_failure_returns_actionable_503(client, monkeypatch):
    import sqlite3

    def fail(*args, **kwargs):
        raise sqlite3.OperationalError("database locked")

    monkeypatch.setattr(client.app.state.task_store, "list_tasks", fail)
    response = client.get("/api/tasks")
    assert response.status_code == 503
    assert "temporarily unavailable" in response.json()["detail"]
    assert "database locked" not in response.json()["detail"]
