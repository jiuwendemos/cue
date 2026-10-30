"""Assemble the English walkthrough: stills + narration + burned captions.

    python demo/walkthrough/build.py

Reads frames/ and audio/, writes demo/cue-walkthrough-en.mp4 and .srt.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from scenes import END_CARD, SCENES

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
FRAMES = ROOT / "frames"
AUDIO = ROOT / "audio"
BUILD = ROOT / "build"
OUT = REPO / "demo"
FF = Path(
    r"C:\Workspace\openjiuwendemos\coachme\.venv\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
)
W, H, FPS = 1600, 900, 25
FONT_SERIF = "C:/Windows/Fonts/georgia.ttf"
FONT_SERIF_B = "C:/Windows/Fonts/georgiab.ttf"
FONT_SERIF_I = "C:/Windows/Fonts/georgiai.ttf"
FONT_MONO = "C:/Windows/Fonts/consola.ttf"
FONT_SANS = "C:/Windows/Fonts/segoeui.ttf"


def ff(*args: str) -> None:
    cmd = [str(FF), "-hide_banner", "-loglevel", "error", "-y", *args]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed:\n{' '.join(cmd)}\n{result.stderr[-2500:]}")


def duration(path: Path) -> float:
    result = subprocess.run([str(FF), "-i", str(path)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
    if not match:
        raise RuntimeError(f"cannot read duration: {path}")
    h, m, s = match.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.truetype(FONT_SANS, size)


def title_card(path: Path) -> None:
    image = Image.new("RGB", (W, H), (9, 9, 11))
    draw = ImageDraw.Draw(image)
    for y in range(H):
        shade = int(9 + 6 * (1 - abs(y - H / 2) / (H / 2)))
        draw.line([(0, y), (W, y)], fill=(shade, shade, shade + 1))
    draw.rectangle([(92, 150), (96, 700)], fill=(215, 255, 79))
    draw.text((126, 146), "CUE · THE LIVE SHOW DESIGN STUDIO", font=font(FONT_MONO, 16), fill=(215, 255, 79))
    draw.text((118, 250), "The Long Way Round", font=font(FONT_SERIF, 96), fill=(245, 240, 228))
    draw.text((122, 380), "Harbour Lights", font=font(FONT_SERIF_I, 58), fill=(215, 255, 79))
    draw.text((126, 500), "A new tour, built from nothing.", font=font(FONT_SANS, 30), fill=(200, 196, 185))
    draw.text(
        (126, 560),
        "Venues, imports, a look, a check, an agent, a fix, a budget, a signature.",
        font=font(FONT_SANS, 24),
        fill=(150, 148, 140),
    )
    draw.text((126, 690), "3 minutes · English", font=font(FONT_MONO, 18), fill=(150, 148, 140))
    draw.text(
        (126, 730),
        "The band, rooms and money are invented. The arithmetic is the app's.",
        font=font(FONT_SANS, 18),
        fill=(110, 110, 104),
    )
    image.save(path)


def end_card(path: Path) -> None:
    image = Image.new("RGB", (W, H), (9, 9, 11))
    draw = ImageDraw.Draw(image)
    draw.rectangle([(92, 220), (96, 620)], fill=(215, 255, 79))
    draw.text((126, 220), "CUE", font=font(FONT_MONO, 20), fill=(215, 255, 79))
    draw.text((120, 300), "The show is designed", font=font(FONT_SERIF, 78), fill=(245, 240, 228))
    draw.text((120, 392), "before the lights go down.", font=font(FONT_SERIF_I, 78), fill=(215, 255, 79))
    draw.text((126, 540), "CUE designs. The crew runs the show. The human signs safety.", font=font(FONT_SANS, 24), fill=(180, 178, 168))
    draw.text((126, 640), "jiuwendemos.github.io/cue", font=font(FONT_MONO, 20), fill=(150, 148, 140))
    draw.text((126, 676), "github.com/jiuwendemos/cue", font=font(FONT_MONO, 20), fill=(150, 148, 140))
    image.save(path)


def render_still(image: Path, seconds: float, out: Path, index: int) -> None:
    # Alternate a slow push-in and pull-out; 3200 px source keeps the text crisp.
    if index % 2 == 0:
        zoom = "min(1.0+0.00022*on,1.055)"
    else:
        zoom = "max(1.055-0.00022*on,1.0)"
    ff(
        "-loop", "1", "-framerate", str(FPS), "-i", str(image),
        "-t", f"{seconds:.3f}",
        "-vf",
        f"scale={W * 2}:-1,zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},format=yuv420p",
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", str(out),
    )


def scene_video(scene: dict, images: list[Path], out: Path, index: int) -> tuple[float, float]:
    key = scene["key"]
    audio = AUDIO / f"{key}.mp3"
    if audio.exists():
        audio_duration = duration(audio)
        total = audio_duration + 0.6
    else:
        audio_duration = 0.0
        total = 4.0
    per_image = total / max(1, len(images))
    segments = []
    for i, image in enumerate(images):
        segment = BUILD / f"{key}-{i}.mp4"
        render_still(image, per_image, segment, index + i)
        segments.append(segment)
    concat_list = BUILD / f"{key}-list.txt"
    concat_list.write_text("".join(f"file '{s.as_posix()}'\n" for s in segments), encoding="utf-8")
    silent = BUILD / f"{key}-silent.mp4"
    ff("-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(silent))
    if audio.exists():
        ff(
            "-i", str(silent), "-i", str(audio),
            "-af", "apad=pad_dur=0.6", "-t", f"{total:.3f}",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "24000", "-ac", "1", str(out),
        )
    else:
        ff(
            "-i", str(silent), "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
            "-t", f"{total:.3f}",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-shortest", str(out),
        )
    return audio_duration, total


def parse_srt(text: str) -> list[tuple[str, str]]:
    cues = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = block.splitlines()
        if len(lines) >= 2 and "-->" in lines[1]:
            cues.append((lines[1].strip(), "\n".join(lines[2:]).strip()))
    return cues


def shift(times: str, offset: float) -> str:
    match = re.match(r"(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})", times)
    if not match:
        return times
    a = int(match.group(1)) * 3600 + int(match.group(2)) * 60 + int(match.group(3)) + int(match.group(4)) / 1000
    b = int(match.group(5)) * 3600 + int(match.group(6)) * 60 + int(match.group(7)) + int(match.group(8)) / 1000

    def stamp(value: float) -> str:
        value = max(0.0, value)
        h = int(value // 3600)
        m = int((value % 3600) // 60)
        s = int(value % 60)
        ms = int(round((value - int(value)) * 1000))
        if ms == 1000:
            s += 1
            ms = 0
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    return f"{stamp(a + offset)} --> {stamp(b + offset)}"


def main() -> None:
    BUILD.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    for old in BUILD.glob("*"):
        if old.is_file():
            old.unlink()

    shots = {item["name"]: FRAMES / item["file"] for item in json.loads((ROOT / "shots.json").read_text(encoding="utf-8"))}
    title = BUILD / "title.png"
    ending = BUILD / "end.png"
    title_card(title)
    end_card(ending)

    scenes = []
    intro = dict(SCENES[0], images=[title])
    scenes.append(intro)
    for scene in SCENES[1:]:
        scenes.append(dict(scene, images=[shots[name] for name in scene["shots"]]))
    scenes.append(dict(END_CARD, images=[ending]))

    timeline = []
    subs: list[tuple[str, str]] = []
    cursor = 0.0
    for index, scene in enumerate(scenes):
        out = BUILD / f"{index:02d}-{scene['key']}.mp4"
        audio_duration, total = scene_video(scene, scene["images"], out, index)
        srt = AUDIO / f"{scene['key']}.srt"
        if srt.exists():
            for times, body in parse_srt(srt.read_text(encoding="utf-8")):
                subs.append((shift(times, cursor), body))
        timeline.append({"key": scene["key"], "start": round(cursor, 2), "duration": round(total, 2)})
        print(f"{scene['key']}: {total:.1f}s")
        cursor += total

    concat_list = BUILD / "master.txt"
    master_lines = []
    for index, item in enumerate(timeline):
        name = f"{index:02d}-{item['key']}.mp4"
        master_lines.append(f"file '{(BUILD / name).as_posix()}'\n")
    concat_list.write_text("".join(master_lines), encoding="utf-8")
    master = BUILD / "master.mp4"
    ff("-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(master))

    srt_path = BUILD / "subs.srt"
    lines = []
    for number, (times, body) in enumerate(subs, start=1):
        lines.append(f"{number}\n{times}\n{body}\n")
    srt_path.write_text("\n".join(lines), encoding="utf-8")

    final = OUT / "cue-walkthrough-en.mp4"

    # ffmpeg resolves `subs.srt` from its working directory; run it in BUILD.
    cmd = [
        str(FF), "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(master),
        "-vf",
        "drawbox=x=0:y=ih-150:w=iw:h=150:color=black@0.62:t=fill,subtitles=subs.srt:force_style='FontName=Segoe UI,FontSize=10,PrimaryColour=&H00FFFFFF,OutlineColour=&H66000000,BorderStyle=1,Outline=1,Shadow=0,MarginV=30,Alignment=2'",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-movflags", "+faststart", str(final),
    ]
    result = subprocess.run(cmd, cwd=str(BUILD), capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-2500:])

    (OUT / "cue-walkthrough-en.srt").write_text(srt_path.read_text(encoding="utf-8"), encoding="utf-8")
    (ROOT / "timeline.json").write_text(json.dumps(timeline, indent=2), encoding="utf-8")
    print(f"master {duration(final):.1f}s · {final.stat().st_size / 1e6:.1f} MB · {final}")


if __name__ == "__main__":
    main()
