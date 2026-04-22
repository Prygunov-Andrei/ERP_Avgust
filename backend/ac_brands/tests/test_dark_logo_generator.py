"""Тесты сервиса dark_logo_generator.

PoC-фикстуры: casarte.png, haier.png, lg.png, mhi.png
(скопированы из /tmp/logo-poc/original/).

Ожидания по PoC v6:
- casarte  → mono (stdev ~0), dark сгенерится.
- haier    → colored (stdev ~36), dark=None.
- lg       → ложно-positive mono (stdev ~15), требует force_colored.
- mhi      → mono (stdev ~12), dark сгенерится.
"""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from ac_brands.services.dark_logo_generator import (
    MONO_STDEV_THRESHOLD,
    classify_logo,
    cleanup_white_opaque,
    generate_dark_logo,
    is_monochromatic,
    set_rgb,
)

FIXTURES = Path(__file__).parent / "fixtures" / "logos"


def _as_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, fmt)
    return buf.getvalue()


def _load(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


def _make_rgba(size: tuple[int, int], fill=(0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", size, fill)


# ---------- Fixtures path ----------


def test_fixtures_exist():
    """Проверка что фикстуры положены на диск (catch regression если они удалятся)."""
    for name in ("casarte.png", "haier.png", "lg.png", "mhi.png"):
        assert (FIXTURES / name).is_file(), f"Missing fixture: {name}"


# ---------- Primitives ----------


def test_cleanup_removes_pure_white_opaque():
    """RGB=(255,255,255) alpha=255 → alpha становится 0."""
    img = _make_rgba((10, 10), (255, 255, 255, 255))
    out = cleanup_white_opaque(img, white_threshold=235)
    arr = np.array(out)
    assert (arr[..., 3] == 0).all()


def test_cleanup_preserves_colored_opaque():
    """RGB=(10,10,10) alpha=255 → без изменений (min=10 << 235)."""
    img = _make_rgba((10, 10), (10, 10, 10, 255))
    out = cleanup_white_opaque(img, white_threshold=235)
    arr = np.array(out)
    assert (arr[..., 3] == 255).all()
    assert (arr[..., :3] == 10).all()


def test_cleanup_fades_near_white():
    """RGB=(245,245,245) alpha=255 → fade = (255-245)/(255-235) = 0.5 → alpha≈127."""
    img = _make_rgba((10, 10), (245, 245, 245, 255))
    out = cleanup_white_opaque(img, white_threshold=235)
    arr = np.array(out)
    assert 100 <= arr[0, 0, 3] <= 150  # 127 ± round


def test_is_monochromatic_grayscale():
    """Чёрный текст на прозрачном фоне → mono."""
    img = _make_rgba((50, 50))
    img.paste((0, 0, 0, 255), (10, 10, 40, 40))
    assert is_monochromatic(img) is True


def test_is_monochromatic_colored():
    """Сильно цветной логотип (красный) → не mono."""
    img = _make_rgba((50, 50))
    img.paste((255, 0, 0, 255), (10, 10, 40, 40))
    assert is_monochromatic(img) is False


def test_is_monochromatic_empty():
    """Полностью прозрачный PNG → False (нечего classify)."""
    img = _make_rgba((20, 20))
    assert is_monochromatic(img) is False


def test_set_rgb_preserves_alpha():
    """После set_rgb alpha не меняется, RGB = белый."""
    img = _make_rgba((5, 5), (0, 0, 0, 128))
    out = set_rgb(img, 255, 255, 255)
    arr = np.array(out)
    assert (arr[..., 0] == 255).all()
    assert (arr[..., 1] == 255).all()
    assert (arr[..., 2] == 255).all()
    assert (arr[..., 3] == 128).all()


# ---------- Classification via fixtures ----------


def test_classify_casarte_mono():
    info = classify_logo(FIXTURES / "casarte.png")
    assert info["mono"] is True
    assert info["mean_stdev"] < MONO_STDEV_THRESHOLD
    assert info["opaque_pixels"] > 100


def test_classify_mhi_mono():
    info = classify_logo(FIXTURES / "mhi.png")
    assert info["mono"] is True
    assert info["mean_stdev"] < MONO_STDEV_THRESHOLD
    assert info["opaque_pixels"] > 100


def test_classify_haier_colored():
    info = classify_logo(FIXTURES / "haier.png")
    assert info["mono"] is False
    assert info["mean_stdev"] > MONO_STDEV_THRESHOLD
    assert info["opaque_pixels"] > 100


def test_classify_lg_ambiguous():
    """LG — ложно-positive mono: stdev в районе 12-17, рядом с threshold=20.
    В PoC-прогоне v6: 14.80. Мы не гарантируем exact — только что она ниже threshold."""
    info = classify_logo(FIXTURES / "lg.png")
    # Текущий алгоритм считает LG mono; поэтому это False-positive, и прод
    # должен override через --force-colored lg.
    assert info["mono"] is True
    assert info["mean_stdev"] < MONO_STDEV_THRESHOLD


# ---------- Full generate_dark_logo ----------


def test_generate_dark_casarte_recolor_white():
    """casarte → mono → все непрозрачные пиксели dark-версии RGB=(255,255,255)."""
    dark_bytes = generate_dark_logo(FIXTURES / "casarte.png")
    assert dark_bytes is not None
    img = _load(dark_bytes).convert("RGBA")
    arr = np.array(img)
    mask = arr[..., 3] > 0
    assert mask.sum() > 100
    # После cleanup (отрезавшего белый фон) — ВСЕ непрозрачные пиксели должны быть белыми.
    assert (arr[mask, 0] == 255).all()
    assert (arr[mask, 1] == 255).all()
    assert (arr[mask, 2] == 255).all()


def test_generate_dark_mhi_recolor_white():
    dark_bytes = generate_dark_logo(FIXTURES / "mhi.png")
    assert dark_bytes is not None
    img = _load(dark_bytes).convert("RGBA")
    arr = np.array(img)
    mask = arr[..., 3] > 0
    assert mask.sum() > 100
    assert (arr[mask, 0] == 255).all()
    assert (arr[mask, 1] == 255).all()
    assert (arr[mask, 2] == 255).all()


def test_generate_dark_haier_returns_none():
    """haier colored → dark не генерим."""
    assert generate_dark_logo(FIXTURES / "haier.png") is None


def test_generate_dark_lg_force_colored():
    """LG force_colored=True → None (override false-positive)."""
    assert generate_dark_logo(FIXTURES / "lg.png", force_colored=True) is None


def test_generate_dark_haier_force_mono():
    """haier + force_mono=True → всегда recolor."""
    dark_bytes = generate_dark_logo(FIXTURES / "haier.png", force_mono=True)
    assert dark_bytes is not None
    img = _load(dark_bytes).convert("RGBA")
    arr = np.array(img)
    mask = arr[..., 3] > 0
    assert mask.sum() > 100
    assert (arr[mask, 0] == 255).all()
    assert (arr[mask, 1] == 255).all()
    assert (arr[mask, 2] == 255).all()


def test_generate_dark_output_is_valid_png():
    """Сгенерированные bytes — валидный PNG (Pillow открывается без ошибки)."""
    dark_bytes = generate_dark_logo(FIXTURES / "casarte.png")
    assert dark_bytes is not None
    img = _load(dark_bytes)
    assert img.format == "PNG"


def test_generate_dark_bytes_input():
    """API принимает bytes, не только Path."""
    data = (FIXTURES / "casarte.png").read_bytes()
    dark_bytes = generate_dark_logo(data)
    assert dark_bytes is not None


def test_generate_dark_mutual_exclusive_flags():
    """force_colored + force_mono одновременно → ValueError."""
    with pytest.raises(ValueError):
        generate_dark_logo(FIXTURES / "casarte.png", force_colored=True, force_mono=True)


def test_generate_dark_preserves_canvas_size():
    """Canvas остаётся 200×56 (из PoC normalization)."""
    src = Image.open(FIXTURES / "casarte.png")
    assert src.size == (200, 56)
    dark_bytes = generate_dark_logo(FIXTURES / "casarte.png")
    assert dark_bytes is not None
    dark = _load(dark_bytes)
    assert dark.size == (200, 56)
