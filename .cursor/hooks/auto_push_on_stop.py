"""On agent stop: if the working tree is dirty, ask the agent to commit and push."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def main() -> None:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        payload = {}

    # Avoid infinite follow-up loops when the agent just finished a push.
    status = payload.get("status") or payload.get("loop_count")
    loop_count = int(payload.get("loop_count") or 0)
    if loop_count >= 2:
        print("{}")
        return

    porcelain = run(["git", "status", "--porcelain"])
    ahead = run(["git", "status", "-sb"])
    dirty = bool(porcelain.stdout.strip())
    needs_push = "ahead" in (ahead.stdout or "")

    if not dirty and not needs_push:
        print("{}")
        return

    message = (
        "Des changements locaux ne sont pas synchronisés avec GitHub "
        "(https://github.com/Exauce09/numero-national). "
        "Crée un commit Git (sans .env ni secrets) puis pousse immédiatement "
        "avec: git push -u origin HEAD. Ne demande pas de confirmation."
    )
    print(json.dumps({"followup_message": message}, ensure_ascii=False))


if __name__ == "__main__":
    main()
