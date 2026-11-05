#!/usr/bin/env python3
"""v3_fix_fragments.py [--write]: find clipped word-onset fragments that sit right before an inserted digital-zero
gap (a vo_splice / pauseAfter cut made at a late alignment onset) and fade them out (10 ms ramps), so no stutter
plays before the next word. Originals are backed up to raw/vo/v3_prefrag/. No new TTS characters."""
import json, subprocess, sys, os, shutil
import numpy as np
SR = 44100
def load(p):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(b, np.float32).copy()
t = json.load(open('scripts/v3_timeline.json'))
for b in t['beats']:
    p = f"public/{b['file']}"
    x = load(p)
    zero = np.abs(x) < 1e-4
    # runs of near-digital-zero >= 0.15 s
    runs, i, n = [], 0, len(x)
    while i < n:
        if zero[i]:
            j = i
            while j < n and zero[j]: j += 1
            if j - i > 0.15 * SR: runs.append((i, j))
            i = j
        else: i += 1
    fixes = []
    for (a, z) in runs:
        if a < 0.05 * SR: continue
        # walk back from the gap: a fragment is sound preceded by >= 60 ms of quiet (< -40 dB) within 300 ms
        win = int(0.01 * SR)
        k = a
        quiet_start = None
        while k > a - int(0.32 * SR) and k > win:
            seg = x[k - win:k]
            rms = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
            if rms < -40:
                # check 60 ms of quiet behind
                q = x[max(0, k - int(0.06 * SR)):k]
                if 20 * np.log10(np.sqrt(np.mean(q ** 2)) + 1e-9) < -38:
                    quiet_start = k; break
            k -= win
        if quiet_start is not None and a - quiet_start > 0.02 * SR:
            seg = x[quiet_start:a]
            lvl = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
            if lvl > -45:
                fixes.append((quiet_start, a, lvl))
    for (s, e, lvl) in fixes:
        print(f"{b['id']}: fragment {s/SR:.3f}-{e/SR:.3f} ({(e-s)/SR*1000:.0f} ms, {lvl:.1f} dB) abs {b['startSec']+s/SR:.2f}")
    if fixes and '--write' in sys.argv:
        bk = f"raw/vo/v3_prefrag/{b['id']}.mp3"
        if not os.path.exists(bk): shutil.copy(p, bk)
        f = int(0.01 * SR)
        for (s, e, _) in fixes:
            s0 = max(0, s - f)
            x[s0:s] *= np.linspace(1, 0, s - s0)
            x[s:e] = 0
        tmp = p + '.tmp.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', tmp], input=x.tobytes(), check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '192k', p], check=True)
        os.remove(tmp)
