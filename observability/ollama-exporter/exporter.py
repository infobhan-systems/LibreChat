#!/usr/bin/env python3
"""Poll Ollama /api/ps and /api/tags; expose Prometheus metrics on /metrics."""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


def env_str(name: str, default: str) -> str:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else default


def env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


OLLAMA_HOST = env_str("OLLAMA_HOST", "http://ollama:11434").rstrip("/")
LISTEN_ADDR = env_str("LISTEN_ADDR", "0.0.0.0:11435")
POLL_INTERVAL_SECONDS = env_float("POLL_INTERVAL_SECONDS", 15.0)
HTTP_TIMEOUT_SECONDS = env_float("HTTP_TIMEOUT_SECONDS", 5.0)

_lock = threading.Lock()
_metrics_text = "# ollama exporter warming up\n"
_ollama_up = 0


def escape_label(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')


def fetch_json(path: str) -> Any:
    request = urllib.request.Request(
        f"{OLLAMA_HOST}{path}",
        headers={"Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def model_label(entry: dict[str, Any]) -> str:
    name = entry.get("name") or entry.get("model") or "unknown"
    return escape_label(str(name))


def render_metrics(ps_payload: dict[str, Any], tags_payload: dict[str, Any]) -> str:
    models = ps_payload.get("models") or []
    tags = tags_payload.get("models") or []
    lines = [
        "# HELP ollama_up 1 if the Ollama API is reachable",
        "# TYPE ollama_up gauge",
        "ollama_up 1",
        "# HELP ollama_loaded_models Number of models currently loaded in VRAM",
        "# TYPE ollama_loaded_models gauge",
        f"ollama_loaded_models {len(models)}",
        "# HELP ollama_available_models Number of models available on disk",
        "# TYPE ollama_available_models gauge",
        f"ollama_available_models {len(tags)}",
        "# HELP ollama_model_vram_bytes VRAM reported for a loaded model by Ollama",
        "# TYPE ollama_model_vram_bytes gauge",
    ]
    for entry in models:
        label = model_label(entry)
        size_vram = entry.get("size_vram")
        if size_vram is None:
            size_vram = entry.get("size") or 0
        lines.append(f'ollama_model_vram_bytes{{model="{label}"}} {int(size_vram)}')

    lines.extend(
        [
            "# HELP ollama_model_size_bytes On-disk size for a loaded model",
            "# TYPE ollama_model_size_bytes gauge",
        ]
    )
    for entry in models:
        label = model_label(entry)
        size = entry.get("size") or 0
        lines.append(f'ollama_model_size_bytes{{model="{label}"}} {int(size)}')

    return "\n".join(lines) + "\n"


def render_down() -> str:
    return (
        "# HELP ollama_up 1 if the Ollama API is reachable\n"
        "# TYPE ollama_up gauge\n"
        "ollama_up 0\n"
        "# HELP ollama_loaded_models Number of models currently loaded in VRAM\n"
        "# TYPE ollama_loaded_models gauge\n"
        "ollama_loaded_models 0\n"
    )


def poll_loop() -> None:
    global _metrics_text, _ollama_up
    while True:
        try:
            ps_payload = fetch_json("/api/ps")
            tags_payload = fetch_json("/api/tags")
            text = render_metrics(ps_payload, tags_payload)
            up = 1
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError):
            text = render_down()
            up = 0
        with _lock:
            _metrics_text = text
            _ollama_up = up
        time.sleep(POLL_INTERVAL_SECONDS)


class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        if self.path.split("?", 1)[0] not in ("/metrics", "/"):
            self.send_response(404)
            self.end_headers()
            return
        with _lock:
            body = _metrics_text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return


def main() -> None:
    host, _, port_text = LISTEN_ADDR.rpartition(":")
    host = host or "0.0.0.0"
    port = int(port_text or "11435")
    threading.Thread(target=poll_loop, name="ollama-poll", daemon=True).start()
    server = ThreadingHTTPServer((host, port), MetricsHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
