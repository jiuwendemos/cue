"""Generate the English narration and per-scene subtitles with edge-tts.

    uv run --with edge-tts python demo/walkthrough/narrate.py
"""

from __future__ import annotations

import subprocess
import time
from pathlib import Path

from scenes import END_CARD, SCENES

ROOT = Path(__file__).resolve().parent
AUDIO = ROOT / "audio"
VOICE = "en-US-AndrewNeural"
RATE = "+6%"


def main() -> None:
    AUDIO.mkdir(exist_ok=True)
    for old in AUDIO.glob("*"):
        old.unlink()

    for scene in SCENES + [END_CARD]:
        key = scene["key"]
        text = scene["voice"]
        if not text:
            print(f"{key}: silent")
            continue
        txt = AUDIO / f"{key}.txt"
        mp3 = AUDIO / f"{key}.mp3"
        srt = AUDIO / f"{key}.srt"
        txt.write_text(text, encoding="utf-8")
        for attempt in range(1, 6):
            cmd = [
                "uvx",
                "edge-tts",
                "--voice",
                VOICE,
                "--rate",
                RATE,
                "--file",
                str(txt),
                "--write-media",
                str(mp3),
                "--write-subtitles",
                str(srt),
                "--no-progress",
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0 and mp3.exists() and mp3.stat().st_size > 1000:
                print(f"{key}: {mp3.stat().st_size // 1024} kB")
                break
            print(f"retry {key} {attempt}: {result.stderr[-200:]}")
            time.sleep(2)
        else:
            raise RuntimeError(f"edge-tts failed for {key}")


if __name__ == "__main__":
    main()
