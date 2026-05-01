#!/usr/bin/env python3
"""F8-00: seed 4 LLMProfile в локальную ismeta-postgres.

Используется bootstrap_local_f8.sh — запускается через
backend/.venv/bin/python (там есть psycopg2-binary + cryptography).

Профили:
    DeepSeek (default)  — deepseek-chat (no vision)
    OpenAI GPT-4o       — extract+vision
    Gemini 3.1 Pro      — gemini-3.1-pro-preview (no vision через OpenAI-compat)
    Grok 4              — grok-4 / grok-2-vision-1212 (xAI)

Идемпотентно: ON CONFLICT (name) DO UPDATE SET api_key_encrypted, models, base_url
— это позволяет переcидить ключи, не потеряв is_default.

ENV переменные (берутся из .env.local через bootstrap):
    F8_ISMETA_DB_HOST/PORT/NAME/USER/PASSWORD
    LLM_PROFILE_ENCRYPTION_KEY     — Fernet key (must match prod)
    LLM_API_KEY_DEEPSEEK
    LLM_API_KEY_OPENAI
    LLM_API_KEY_GEMINI
    LLM_API_KEY_XAI

Если LLM_API_KEY_X пуст — профиль всё равно создаётся с placeholder
"PLACEHOLDER-FILL-FROM-ENV", чтобы можно было заполнить через UI.
"""
from __future__ import annotations

import os
import sys

import psycopg2
from cryptography.fernet import Fernet


PROFILES = [
    {
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "extract_model": "deepseek-chat",
        "multimodal_model": "",
        "classify_model": "deepseek-chat",
        "vision_supported": False,
        "is_default": True,
        "api_key_env": "LLM_API_KEY_DEEPSEEK",
    },
    {
        "name": "OpenAI GPT-4o",
        "base_url": "https://api.openai.com/v1",
        "extract_model": "gpt-4o",
        "multimodal_model": "gpt-4o",
        "classify_model": "gpt-4o-mini",
        "vision_supported": True,
        "is_default": False,
        "api_key_env": "LLM_API_KEY_OPENAI",
    },
    {
        "name": "Gemini 3.1 Pro",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "extract_model": "gemini-3.1-pro-preview",
        "multimodal_model": "gemini-3.1-pro-preview",
        "classify_model": "gemini-3.1-pro-preview",
        "vision_supported": False,
        "is_default": False,
        "api_key_env": "LLM_API_KEY_GEMINI",
    },
    {
        "name": "Grok 4",
        "base_url": "https://api.x.ai/v1",
        "extract_model": "grok-4",
        "multimodal_model": "grok-2-vision-1212",
        "classify_model": "grok-2-1212",
        "vision_supported": True,
        "is_default": False,
        "api_key_env": "LLM_API_KEY_XAI",
    },
]

PLACEHOLDER_KEY = "PLACEHOLDER-FILL-FROM-ENV-OR-UI"


def _env(name: str, default: str | None = None) -> str:
    val = os.environ.get(name, default)
    if val is None:
        sys.stderr.write(f"ENV {name} не задан\n")
        sys.exit(1)
    return val


def main() -> None:
    fernet_key = _env("LLM_PROFILE_ENCRYPTION_KEY")
    try:
        fernet = Fernet(fernet_key.encode("utf-8"))
    except (ValueError, TypeError) as e:
        sys.stderr.write(
            f"LLM_PROFILE_ENCRYPTION_KEY невалидный (нужен 32-byte base64-urlsafe): {e}\n"
        )
        sys.exit(1)

    conn = psycopg2.connect(
        host=os.environ.get("F8_ISMETA_DB_HOST", "localhost"),
        port=os.environ.get("F8_ISMETA_DB_PORT", "5433"),
        dbname=os.environ.get("F8_ISMETA_DB_NAME", "ismeta"),
        user=os.environ.get("F8_ISMETA_DB_USER", "ismeta"),
        password=os.environ.get("F8_ISMETA_DB_PASSWORD", "ismeta"),
    )
    conn.autocommit = True

    placeholders_used: list[str] = []

    with conn.cursor() as cur:
        for profile in PROFILES:
            api_key = os.environ.get(profile["api_key_env"], "").strip()
            if not api_key:
                api_key = PLACEHOLDER_KEY
                placeholders_used.append(profile["name"])
            api_key_encrypted = fernet.encrypt(api_key.encode("utf-8"))

            cur.execute(
                """
                INSERT INTO llm_profile (
                    name, base_url, api_key_encrypted,
                    extract_model, multimodal_model, classify_model,
                    vision_supported, is_default
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (name) DO UPDATE SET
                    base_url = EXCLUDED.base_url,
                    api_key_encrypted = EXCLUDED.api_key_encrypted,
                    extract_model = EXCLUDED.extract_model,
                    multimodal_model = EXCLUDED.multimodal_model,
                    classify_model = EXCLUDED.classify_model,
                    vision_supported = EXCLUDED.vision_supported,
                    updated_at = NOW();
                """,
                (
                    profile["name"],
                    profile["base_url"],
                    psycopg2.Binary(api_key_encrypted),
                    profile["extract_model"],
                    profile["multimodal_model"],
                    profile["classify_model"],
                    profile["vision_supported"],
                    profile["is_default"],
                ),
            )
            print(f"  ✓ {profile['name']:20s}  ({profile['extract_model']})")

    conn.close()

    if placeholders_used:
        sys.stderr.write(
            "\n  Внимание: API key не задан для: "
            + ", ".join(placeholders_used)
            + "\n  В .env.local заполни LLM_API_KEY_* и повтори bootstrap "
            "(или поправь профиль через UI).\n"
        )


if __name__ == "__main__":
    main()
