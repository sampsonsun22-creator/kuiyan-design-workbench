#!/usr/bin/env python3
"""KEY 视界 static client + LLM proxy.

API keys are sent by the browser per request and never written to disk.
Does not rewrite the 452/2680 jsonl lock.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIR = ROOT / "ship" / "key-vision"
PORT = int(os.environ.get("KEY_VISION_PORT", "8767"))


def redact_secret(text: str) -> str:
    t = str(text or "")
    t = re.sub(r"sk-[A-Za-z0-9_-]{6,}", "sk-***", t)
    t = re.sub(r"(?i)(api[_-]?key|authorization)\s*[:=]\s*['\"]?[^\\s,'\"]+", r"\1=***", t)
    return t


def join_url(base: str, suffix: str) -> str:
    b = (base or "").strip().rstrip("/")
    s = suffix if suffix.startswith("/") else "/" + suffix
    if b.endswith(s) or b.endswith(s.rstrip("/")):
        return b
    tail = s.strip("/")
    if tail and b.endswith(tail):
        return b
    return b + s


def openai_chat(base: str, api_key: str, model: str, messages: list, timeout: int) -> str:
    url = join_url(base or "https://api.openai.com/v1", "/chat/completions")
    body = json.dumps(
        {"model": model, "messages": messages, "temperature": 0.2},
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("empty choices")
    return ((choices[0].get("message") or {}).get("content")) or ""


def anthropic_chat(base: str, api_key: str, model: str, messages: list, timeout: int) -> str:
    url = join_url(base or "https://api.anthropic.com", "/v1/messages")
    system = "\n\n".join(m.get("content") or "" for m in messages if m.get("role") == "system")
    converted = []
    for m in messages:
        role = m.get("role")
        if role not in ("user", "assistant"):
            continue
        converted.append({"role": role, "content": m.get("content") or ""})
    if not converted:
        converted = [{"role": "user", "content": "ping"}]
    payload = {
        "model": model,
        "max_tokens": 1200,
        "messages": converted,
    }
    if system:
        payload["system"] = system
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    parts = data.get("content") or []
    texts = [p.get("text") or "" for p in parts if isinstance(p, dict)]
    return "".join(texts)


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        path = (self.path or "").split("?", 1)[0]
        sys.stderr.write("%s - %s %s\n" % (self.address_string(), self.command, path))

    def do_OPTIONS(self) -> None:
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/llm") or path == "/api/pack/collect":
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "content-type")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.end_headers()
            return
        self.send_error(404)

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/api/llm/health":
            self._json(200, {"ok": True, "proxy": True})
            return
        if path == "/api/pack/collect":
            missing = not bool(os.environ.get("CONTEXT_DEV_API_KEY", "").strip())
            self._json(200, {
                "ok": True,
                "ready": not missing,
                "missing_key": missing,
                "hint": "CONTEXT_DEV_API_KEY 未配置" if missing else "ready",
            })
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/api/pack/collect":
            self._handle_pack_collect()
            return
        if path != "/api/llm/chat":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length > 1_500_000:
            self._json(413, {"ok": False, "error": "payload too large"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid json"})
            return
        api_key = str(payload.get("api_key") or payload.get("apiKey") or "").strip().strip("\"'")
        model = str(payload.get("model") or "").strip()
        base = str(payload.get("base_url") or payload.get("baseUrl") or "").strip().rstrip("/")
        if base in {"https://api.deepseek.com", "http://api.deepseek.com"}:
            base = "https://api.deepseek.com/v1"
        provider = str(payload.get("provider") or "openai").strip().lower()
        messages = payload.get("messages") or []
        if not api_key or not model or not isinstance(messages, list):
            self._json(400, {"ok": False, "error": "missing api_key / model / messages"})
            return
        kind = "anthropic" if provider == "anthropic" or "anthropic.com" in base else "openai"
        try:
            if kind == "anthropic":
                text = anthropic_chat(base, api_key, model, messages, timeout=60)
            else:
                text = openai_chat(base, api_key, model, messages, timeout=60)
        except urllib.error.HTTPError as err:
            detail = redact_secret(err.read().decode("utf-8", "ignore")[:400])
            low = detail.lower()
            if err.code == 401 or "authentication" in low:
                msg = "DeepSeek 说这把 Key 无效。请完整复制 sk- 开头的密钥。"
            elif err.code == 402 or "insufficient" in low or "balance" in low:
                msg = "DeepSeek 余额不足，请先到 platform.deepseek.com 充值。"
            elif err.code == 429:
                msg = "DeepSeek 限流，稍等再试。"
            else:
                msg = f"upstream {err.code}"
            self._json(err.code, {"ok": False, "error": msg})
            return
        except Exception as err:  # noqa: BLE001 — surface provider errors to the lab UI
            self._json(502, {"ok": False, "error": redact_secret(str(err))[:240]})
            return
        self._json(200, {"ok": True, "text": text, "model": model, "agent": payload.get("agent")})

    def _json(self, code: int, obj: dict) -> None:
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _handle_pack_collect(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        if length > 200000:
            self._json(413, {"ok": False, "error": "payload too large"})
            return
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid json"})
            return
        if payload.get("url") or payload.get("product_url") or payload.get("sku"):
            self._json(400, {"ok": False, "error": "only brief.product; do not send official URL"})
            return
        product = str(payload.get("product") or payload.get("product_name") or "").strip()
        if not product:
            self._json(400, {"ok": False, "error": "missing product"})
            return
        key = os.environ.get("CONTEXT_DEV_API_KEY", "").strip()
        if not key:
            self._json(
                503,
                {
                    "ok": False,
                    "missing_key": True,
                    "error": "CONTEXT_DEV_API_KEY 未配置",
                },
            )
            return
        runner = ROOT / "scripts" / "run_pack_collect.js"
        try:
            cp = subprocess.run(
                ["node", str(runner)],
                input=json.dumps({"product_name": product}, ensure_ascii=False),
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=55,
                env={**os.environ, "CONTEXT_DEV_API_KEY": key},
                check=False,
            )
            out = json.loads(cp.stdout or "{}")
        except Exception as err:  # noqa: BLE001 — surface collect errors to the lab UI
            self._json(502, {"ok": False, "error": redact_secret(str(err))[:240]})
            return
        if not isinstance(out, dict):
            self._json(502, {"ok": False, "error": "collect returned non-json"})
            return
        code = 200 if out.get("ok") else (503 if out.get("missing_key") else 422)
        self._json(code, out)


def main() -> int:
    directory = Path(os.environ.get("KEY_VISION_DIR") or DEFAULT_DIR).resolve()
    if not directory.exists():
        print(f"missing {directory}", file=sys.stderr)
        return 1
    os.chdir(directory)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"KEY 视界 {directory} on :{PORT} (llm proxy /api/llm/chat · pack /api/pack/collect)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
