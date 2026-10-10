"""Render the original garden story with neural Mandarin voices and dialogue pacing.

python3 -m pip install edge-tts
python3 scripts/generate-story-neural-audio.py
Generation uses network TTS; the website only plays bundled same-origin MP3s.
The full replacement set is validated before any public audio is replaced.
"""
import asyncio
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import subprocess
import wave

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'backend/src/db/content/chinese-garden-story.json'
WORK = ROOT / '.local/story-voice-v2'
OUT = ROOT / 'frontend/public/audio/stories/garden'
FFMPEG = os.environ.get('STORY_FFMPEG', '/opt/homebrew/bin/ffmpeg')
FFPROBE = os.environ.get('STORY_FFPROBE', '/opt/homebrew/bin/ffprobe')
PROFILES = {
    'narrator': {'voice': 'zh-CN-XiaoxiaoNeural', 'rate': '-8%', 'pitch': '+0Hz'},
    'xiaoyu': {'voice': 'zh-CN-XiaoyiNeural', 'rate': '-4%', 'pitch': '+0Hz'},
    'amin': {'voice': 'zh-CN-YunxiNeural', 'rate': '-4%', 'pitch': '+0Hz'},
    'teacher': {'voice': 'zh-CN-XiaoxiaoNeural', 'rate': '-12%', 'pitch': '-2Hz'},
    'task': {'voice': 'zh-CN-XiaoxiaoNeural', 'rate': '-10%', 'pitch': '+0Hz'},
}
DIALOGUE = {
    'meet-xiaoyu': ['xiaoyu'],
    'walk-to-garden': ['xiaoyu'],
    'find-seeds': ['xiaoyu'],
    'find-watering-can': ['xiaoyu'],
    'seedling-needs-sun': ['teacher'],
    'help-amin': ['amin', 'amin'],
    'meaning-together': ['xiaoyu', 'amin', 'narrator'],
    'remember-first-step': ['teacher'],
}


def command(executable, args):
    return subprocess.run([executable, *args], check=True, capture_output=True, text=True)


def signal(path):
    output = command(FFMPEG, ['-hide_banner', '-i', str(path), '-af', 'volumedetect', '-f', 'null', '-']).stderr
    peak = re.search(r'max_volume: (-?[\d.]+) dB', output)
    mean = re.search(r'mean_volume: (-?[\d.]+) dB', output)
    if not peak or not mean:
        raise ValueError(f'Silent or invalid audio: {path.name}')
    return {'peakDb': float(peak[1]), 'meanDb': float(mean[1])}


def segments(step):
    parts, cursor = [], 0
    quotes = list(re.finditer(r'“([^”]+)”', step['text']))
    roles = DIALOGUE[step['id']]
    if len(quotes) != len(roles):
        raise ValueError(f'Check speaker attribution after editing {step["id"]}')
    for quote, role in zip(quotes, roles):
        if step['text'][cursor:quote.start()].strip():
            parts.append({'speaker': 'narrator', 'text': step['text'][cursor:quote.start()], 'pauseAfterSeconds': .18})
        parts.append({'speaker': role, 'text': quote[1], 'pauseAfterSeconds': .22})
        cursor = quote.end()
    if step['text'][cursor:].strip():
        parts.append({'speaker': 'narrator', 'text': step['text'][cursor:], 'pauseAfterSeconds': .18})
    # Preserve every original word; quote glyphs themselves need not be spoken.
    original = step['text'].replace('“', '').replace('”', '')
    if ''.join(part['text'] for part in parts) != original:
        raise ValueError(f'Incomplete story narration for {step["id"]}')
    parts[-1]['pauseAfterSeconds'] = .65
    parts.append({'speaker': 'task', 'text': step['task']['prompt'], 'pauseAfterSeconds': .15})
    return parts


async def render_part(step_id, index, part, limiter):
    profile = PROFILES[part['speaker']]
    source = WORK / f'{step_id}-{index}.mp3'
    wav = WORK / f'{step_id}-{index}.wav'
    cache = source.with_suffix('.json')
    request = {'text': part['text'], **profile}
    async with limiter:
        if not source.exists() or not cache.exists() or json.loads(cache.read_text()) != request:
            last_error = None
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(**request, connect_timeout=15, receive_timeout=40).save(str(source))
                    cache.write_text(json.dumps(request, ensure_ascii=False), encoding='utf-8')
                    break
                except Exception as error:
                    last_error = error
                    if attempt == 2:
                        raise last_error
                    await asyncio.sleep(1 + attempt)
        command(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', str(source), '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', str(wav)])
    return wav


async def main():
    lesson = json.loads(SOURCE.read_text(encoding='utf-8'))
    steps = lesson['scenes'][0]['steps']
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    limiter = asyncio.Semaphore(2)
    entries = []
    for step in steps:
        parts = segments(step)
        clips = await asyncio.gather(*(render_part(step['id'], index, part, limiter) for index, part in enumerate(parts)))
        combined = WORK / f'{step["id"]}-combined.wav'
        with wave.open(str(combined), 'wb') as writer:
            writer.setnchannels(1)
            writer.setsampwidth(2)
            writer.setframerate(44100)
            for clip, part in zip(clips, parts):
                with wave.open(str(clip), 'rb') as reader:
                    if (reader.getnchannels(), reader.getsampwidth(), reader.getframerate()) != (1, 2, 44100):
                        raise ValueError('Unexpected PCM format')
                    writer.writeframes(reader.readframes(reader.getnframes()))
                writer.writeframes(b'\0\0' * round(part['pauseAfterSeconds'] * 44100))
        gain = min(0, -4 - signal(combined)['peakDb'])
        target = WORK / f'{step["id"]}.mp3'
        for _ in range(3):
            command(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', str(combined), '-af', f'volume={gain}dB', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', str(target)])
            measured = signal(target)
            if measured['peakDb'] <= -3:
                break
            gain -= measured['peakDb'] + 4
        duration = float(json.loads(command(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(target)]).stdout)['format']['duration'])
        if measured['peakDb'] > -3 or not 5 < duration < 60:
            raise ValueError(f'Invalid rendered page: {step["id"]}')
        data = target.read_bytes()
        entries.append({
            'id': step['id'], 'narrationSrc': step['narrationSrc'],
            'transcript': step['text'] + '\n\n' + step['task']['prompt'],
            'segments': [{**part, **PROFILES[part['speaker']]} for part in parts],
            'durationSeconds': duration, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'gainDb': gain, **measured,
        })
        print(f'{step["id"]}: {len(parts)} voice segments, {duration:.2f}s, peak {measured["peakDb"]} dBFS', flush=True)
    from datetime import datetime, timezone
    metadata = {
        'revision': 2, 'storyTitle': lesson['title'], 'sourceContent': str(SOURCE.relative_to(ROOT)),
        'storyOrigin': 'Original project story; no textbook reproduction or curriculum coverage claim.',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'engine': 'Microsoft Edge neural TTS via edge-tts', 'edgeTtsVersion': importlib.metadata.version('edge-tts'),
        'language': 'zh-CN', 'synthetic': True, 'profiles': PROFILES,
        'generationCommand': 'python3 scripts/generate-story-neural-audio.py',
        'transcriptPolicy': 'All original page text and task prompts; explicit character attribution and short pauses between dialogue segments.',
        'processing': 'Mono 44.1kHz MP3 128kbps. Constant attenuation only; no post-generation pitch shifting or tempo manipulation.',
        'signalPolicy': 'Every MP3 decodes with finite nonzero signal and peak at or below -3 dBFS.',
        'providerDocumentation': 'https://github.com/rany2/edge-tts',
        'entries': entries,
    }
    # Never replace a partial generation set or silently substitute system speech.
    for entry in entries:
        temporary = OUT / (entry['id'] + '.new.mp3')
        temporary.write_bytes((WORK / (entry['id'] + '.mp3')).read_bytes())
        temporary.replace(OUT / (entry['id'] + '.mp3'))
    temporary = OUT / 'PROVENANCE.new.json'
    temporary.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(OUT / 'PROVENANCE.json')
    print(f'Published {len(entries)} neural narrated pages.', flush=True)


if __name__ == '__main__':
    asyncio.run(main())
