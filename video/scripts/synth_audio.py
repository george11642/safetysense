#!/usr/bin/env python3
"""Code-only SFX + music library for SafetySense v2/v3 (numpy only, no samples, no downloads).

  python3 scripts/synth_audio.py            # writes public/sfx/*.wav (new names only) and public/music/*.wav

Deterministic (fixed RNG seed). v1 files (public/sfx/chime|pad|thud|tick|whoosh.wav) are never touched.
"""
import json, pathlib, subprocess, wave
import numpy as np

SR = 48000
ROOT = pathlib.Path(__file__).resolve().parents[1]
SFX = ROOT / "public/sfx"
MUS = ROOT / "public/music"
rng = np.random.default_rng(20261104)
V1 = {"chime.wav", "pad.wav", "thud.wav", "tick.wav", "whoosh.wav"}

# ---------------------------------------------------------------- helpers
def t(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))

def spec_filter(x, lo=None, hi=None, order=4):
    """Zero-phase Butterworth-shaped band filter in the frequency domain."""
    n = len(x); N = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, N); f = np.fft.rfftfreq(N, 1 / SR)
    g = np.ones_like(f)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    return np.fft.irfft(X * g, N)[:n]

def sweep_filter(x, f0, f1, kind="lp", block=2048, q=3):
    """Time-varying filter: per-block spectral mask with overlap-add (Hann)."""
    hop = block // 2; win = np.hanning(block)
    out = np.zeros(len(x) + block); norm = np.zeros(len(x) + block)
    xp = np.concatenate([x, np.zeros(block)])
    nb = max(1, (len(x)) // hop)
    f = np.fft.rfftfreq(block, 1 / SR)
    for b in range(nb + 1):
        s = b * hop
        seg = xp[s:s + block]
        if len(seg) < block: break
        k = b / max(1, nb)
        fc = f0 * (f1 / f0) ** k
        if kind == "lp": g = 1 / np.sqrt(1 + (f / fc) ** (2 * q))
        elif kind == "hp": g = 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-6)) ** (2 * q))
        else:  # bandpass, q ~ width
            g = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) * q) ** 2)
        y = np.fft.irfft(np.fft.rfft(seg * win) * g, block)
        out[s:s + block] += y; norm[s:s + block] += win ** 2
    return (out / np.maximum(norm, 1e-3))[:len(x)]

def env(n, a=0.005, d=0.2, s_lvl=0.0, r=0.0, hold=0.0):
    a_n, d_n, h_n, r_n = int(a * SR), int(d * SR), int(hold * SR), int(r * SR)
    e = np.concatenate([np.linspace(0, 1, max(a_n, 1)), np.ones(h_n),
                        1 - (1 - s_lvl) * (1 - np.exp(-5 * np.linspace(0, 1, max(d_n, 1))))])
    if r_n: e = np.concatenate([e, s_lvl * np.exp(-5 * np.linspace(0, 1, r_n))])
    e = np.pad(e, (0, max(0, n - len(e))), constant_values=e[-1] if s_lvl else 0)[:n]
    return e

def expdecay(d, tau): return np.exp(-t(d) / tau)

def reverb(x, rt=1.6, mix=0.25, pre=0.012, bright=6000, stereo=True):
    n_ir = int(rt * SR)
    chans = []
    for c in range(2 if stereo else 1):
        ir = rng.standard_normal(n_ir) * np.exp(-6.9 * np.arange(n_ir) / n_ir)
        ir = spec_filter(ir, lo=120, hi=bright, order=2)
        ir = np.concatenate([np.zeros(int(pre * SR)), ir]); ir /= np.sqrt(np.sum(ir ** 2))
        N = 1 << (len(x) + len(ir)).bit_length()
        wet = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:len(x) + len(ir)]
        dry = np.pad(x, (0, len(ir)))
        chans.append((1 - mix) * dry + mix * wet * 0.5)
    return np.stack(chans, 1) if stereo else chans[0]

def fold(x, n):
    """Wrap everything past sample n back onto the head, so the file loops seamlessly (circular tail)."""
    y = x[:n].copy(); extra = x[n:]
    while len(extra):
        m = min(n, len(extra)); y[:m] += extra[:m]; extra = extra[m:]
    return y

def stereo(x, width=0.0):
    if x.ndim == 2: return x
    if width <= 0: return np.stack([x, x], 1)
    d = int(0.011 * SR)
    r = np.concatenate([np.zeros(d), x])[:len(x)]
    return np.stack([x, (1 - width) * x + width * r], 1)

def pan(x, p):  # p in [-1, 1]
    L = np.cos((p + 1) * np.pi / 4); R = np.sin((p + 1) * np.pi / 4)
    return np.stack([x * L * 1.414, x * R * 1.414], 1)

def place(buf, x, at):
    i = int(at * SR)
    if x.ndim == 1: x = stereo(x)
    end = min(len(buf), i + len(x)); buf[i:end] += x[:end - i]

def fade(x, fi=0.005, fo=0.02):
    x = x.copy(); n = len(x)
    a, b = int(fi * SR), int(fo * SR)
    if a: x[:a] *= np.linspace(0, 1, a)[:, None] if x.ndim == 2 else np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)[:, None] if x.ndim == 2 else np.linspace(1, 0, b)
    return x

def write(path, x, peak_db=-3.0):
    x = stereo(x) if x.ndim == 1 else x
    x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (peak_db / 20)
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def lufs(path):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    for line in e.splitlines()[::-1]:
        if line.strip().startswith("I:"): return float(line.split()[1])

def write_lufs(path, x, target):
    write(path, x, -1.0)
    cur = lufs(path)
    g = 10 ** ((target - cur) / 20)
    x = (stereo(x) if x.ndim == 1 else x)
    x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (-1.0 / 20) * g
    if np.max(np.abs(x)) > 0.89: x = np.tanh(x / 0.89) * 0.89  # soft safety
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    return lufs(path)

# ---------------------------------------------------------------- SFX
def whoosh(d=0.9, f0=300, f1=5000, rev=True):
    n = noise(d)
    x = sweep_filter(n, f0, f1, "bp", q=1.6)
    e = np.sin(np.pi * np.linspace(0, 1, len(x)) ** 0.7) ** 2
    x = x * e
    return reverb(x, 0.8, 0.2) if rev else stereo(x, 0.5)

def phone_buzz(pulses=2, on=0.42, off=0.22):
    out = []
    for i in range(pulses):
        tt = t(on); f = 165 + 6 * np.sin(2 * np.pi * 9 * tt)
        ph = 2 * np.pi * np.cumsum(f) / SR
        x = np.sign(np.sin(ph)) * 0.5 + np.sin(ph) * 0.5          # motor rattle
        x = spec_filter(x, lo=90, hi=1800) + 0.15 * spec_filter(noise(on), 1500, 4000) * np.abs(np.sin(ph))
        x *= env(len(x), 0.015, on, 1.0)[:len(x)] * np.minimum(1, (on - tt) / 0.03)
        out += [x, np.zeros(int(off * SR))]
    x = np.concatenate(out)
    return reverb(x, 0.25, 0.1, bright=4000)

def phone_ring(rings=2):
    """Original two-note marimba-ish ring pattern (not any trademarked ringtone)."""
    notes = [(0.00, 1318.5), (0.12, 1046.5), (0.24, 1318.5), (0.36, 1568.0)]
    one = np.zeros(int(1.0 * SR))
    for at, f in notes:
        d = 0.35; tt = t(d)
        x = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2.01 * f * tt) + 0.12 * np.sin(2 * np.pi * 3.9 * f * tt))
        x *= np.exp(-tt / 0.09) * (1 - np.exp(-tt / 0.002))
        i = int(at * SR); one[i:i + len(x)] += x[:len(one) - i]
    seq = np.concatenate([np.concatenate([one, np.zeros(int(0.55 * SR))]) for _ in range(rings)])
    return reverb(seq, 0.6, 0.15)

def ping(f=1760):
    d = 1.4; tt = t(d)
    x = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt / (0.5 / m ** 0.6)) for m, a in [(1, 1), (2.0, .35), (3.01, .18), (4.2, .08)])
    x *= 1 - np.exp(-tt / 0.0015)
    return reverb(x, 1.2, 0.22)

def heartbeat(bpm=72, beats=4):
    per = 60 / bpm; out = np.zeros(int(per * beats * SR) + SR // 2)
    def thump(f0, amp):
        tt = t(0.22); f = f0 * (1 + 1.2 * np.exp(-tt / 0.02))
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.055) * (1 - np.exp(-tt / 0.003))
        return amp * spec_filter(x + 0.05 * noise(0.22) * np.exp(-tt / 0.01), hi=180)
    for b in range(beats):
        place1 = int(b * per * SR)
        for off, f0, a in [(0, 52, 1.0), (0.17, 46, 0.7)]:
            x = thump(f0, a); i = place1 + int(off * SR); out[i:i + len(x)] += x
    return stereo(out)

def glass_clink():
    d = 1.6; tt = t(d); x = np.zeros_like(tt)
    for f, a, tau in [(2950, 1, .45), (4410, .7, .35), (5280, .5, .3), (6890, .35, .22), (8120, .25, .18), (3530, .4, .4)]:
        x += a * np.sin(2 * np.pi * f * tt + rng.uniform(0, 6)) * np.exp(-tt / tau)
    x *= 1 - np.exp(-tt / 0.0008)
    x += 0.3 * spec_filter(noise(d), 3000, 12000) * np.exp(-tt / 0.004)
    return reverb(x, 0.9, 0.18)

def step(heavy=False):
    d = 0.25; tt = t(d)
    heel = spec_filter(noise(d), 200, 2600 if heavy else 3800) * np.exp(-tt / (0.018 if heavy else 0.012))
    grit = spec_filter(noise(d), 2500, 8000) * np.exp(-((tt - 0.035) / 0.02) ** 2) * 0.25
    body = np.sin(2 * np.pi * (85 if heavy else 110) * tt) * np.exp(-tt / 0.03) * (0.5 if heavy else 0.4)
    return heel + grit + body

def footsteps(n=8, interval=0.52, heavy=False, approach=False, p=0.0):
    out = np.zeros(int((n * interval + 1.0) * SR))
    for i in range(n):
        g = (0.25 + 0.75 * (i + 1) / n) if approach else 1.0
        x = step(heavy) * g * rng.uniform(0.85, 1.0)
        j = max(0, int((i * interval + rng.uniform(-0.015, 0.015)) * SR)); out[j:j + len(x)] += x
    return reverb(out, 1.1, 0.22, bright=5000)

def siren_far(d=7.0):
    tt = t(d)
    f = 760 + 230 * np.sin(2 * np.pi * 0.28 * tt)          # slow wail
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR)
    x = spec_filter(x, 300, 1400, order=2)
    x *= np.minimum(1, tt / 2.0) * np.minimum(1, (d - tt) / 1.5)
    x *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * tt)         # distance wobble
    return reverb(x, 2.4, 0.55, bright=2500)

def impact(d=2.2):
    tt = t(d)
    f = 48 * (1 + 2.5 * np.exp(-tt / 0.04))
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.45)
    crack = spec_filter(noise(d), 400, 6000) * np.exp(-tt / 0.03)
    return reverb(sub + 0.35 * crack, 2.0, 0.3, bright=3500)

def riser(d=2.5):
    tt = t(d)
    x = sweep_filter(noise(d), 200, 9000, "bp", q=1.2) * (tt / d) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (2 * tt / d)) / SR) * (tt / d) ** 2 * 0.3
    return fade(reverb(x + tone, 1.0, 0.25), 0.05, 0.01)

def tap():
    tt = t(0.08)
    x = spec_filter(noise(0.08), 1500, 7000) * np.exp(-tt / 0.004) + 0.4 * np.sin(2 * np.pi * 1900 * tt) * np.exp(-tt / 0.01)
    return stereo(x)

def keypad(n=4, gap=0.22):
    out = np.zeros(int((n * gap + 0.3) * SR))
    for i in range(n):
        x = tap()[:, 0] * rng.uniform(0.8, 1.0); j = int(i * gap * SR); out[j:j + len(x)] += x
    return stereo(out)

def pop():
    tt = t(0.25)
    f = 380 * (1 + 2 * np.exp(-tt / 0.015))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.05) + 0.3 * spec_filter(noise(0.25), 2000, 8000) * np.exp(-tt / 0.006)
    return reverb(x, 0.4, 0.12)

def smash():
    d = 2.0; tt = t(d)
    hit = np.sin(2 * np.pi * np.cumsum(70 * (1 + 3 * np.exp(-tt / 0.02))) / SR) * np.exp(-tt / 0.08)
    crack = spec_filter(noise(d), 800, 9000) * np.exp(-tt / 0.02)
    shards = np.zeros_like(tt)
    for _ in range(26):
        at = rng.uniform(0.02, 0.6); f = rng.uniform(3500, 9500)
        s = t(0.25); g = np.sin(2 * np.pi * f * s) * np.exp(-s / rng.uniform(0.02, 0.07)) * rng.uniform(0.1, 0.35)
        j = int(at * SR); shards[j:j + len(g)] += g
    return reverb(hit + 0.6 * crack + shards, 1.0, 0.2)

def signal_lost():
    """Three descending soft tones, then a long low sine: 'connection lost' (not a medical flatline)."""
    out = np.zeros(int(2.6 * SR))
    for i, f in enumerate([880, 659.3, 523.3]):
        tt = t(0.22); x = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.12) * (1 - np.exp(-tt / 0.003))
        j = int(i * 0.2 * SR); out[j:j + len(x)] += x
    tt = t(1.8); x = 0.35 * np.sin(2 * np.pi * 440 * tt) * np.minimum(1, tt / 0.05) * np.minimum(1, (1.8 - tt) / 0.6)
    j = int(0.7 * SR); out[j:j + len(x)] += x
    return reverb(out, 0.8, 0.2)

def alert_tone():
    """Gentle rising two-tone for the ladder stepping up (calm, not alarming)."""
    out = np.zeros(int(1.4 * SR))
    for i, f in enumerate([587.3, 880]):
        tt = t(0.5); x = (np.sin(2 * np.pi * f * tt) + 0.2 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt / 0.25) * (1 - np.exp(-tt / 0.004))
        j = int(i * 0.16 * SR); out[j:j + len(x)] += x
    return reverb(out, 1.0, 0.25)

def turn_signal(n=6, per=0.42):
    out = np.zeros(int((n * per + 0.2) * SR))
    for i in range(n):
        tt = t(0.05); f = 2400 if i % 2 == 0 else 1900
        x = spec_filter(noise(0.05), 800, 5000) * np.exp(-tt / 0.006) + 0.3 * np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.008)
        j = int(i * per * SR); out[j:j + len(x)] += x
    return reverb(out, 0.3, 0.08)

def party_muffled(d=12.0, bpm=120):
    """Next-room party: muffled four-on-the-floor + bass + crowd murmur (loopable length = whole bars)."""
    beat = 60 / bpm; tt = t(d); out = np.zeros(len(tt))
    for b in range(int(d / beat)):
        k = t(0.3); f = 55 * (1 + 2 * np.exp(-k / 0.03))
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-k / 0.12)
        j = int(b * beat * SR); out[j:j + len(x)] += x[:len(out) - j]
    roots = [55, 55, 65.41, 49.0]
    bass = np.zeros(len(tt))
    for bar in range(int(d / (4 * beat))):
        r = roots[bar % 4]
        for e in range(8):
            s = t(beat / 2 * 0.9); x = np.sin(2 * np.pi * r * s) * np.exp(-s / 0.18)
            j = int((bar * 4 * beat + e * beat / 2) * SR); bass[j:j + len(x)] += 0.5 * x[:len(bass) - j]
    murmur = spec_filter(noise(d), 250, 1800) * (0.6 + 0.4 * spec_filter(np.abs(noise(d)), hi=3))
    x = spec_filter(out + bass, hi=320, order=3) + 0.18 * murmur
    return fold(reverb(x, 0.7, 0.3, bright=1500), len(x))

def night_ambience(d=12.0):
    tt = t(d)
    wind = spec_filter(noise(d), 80, 600, order=2) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * tt + 1))
    crick = np.zeros(len(tt))
    for k in range(int(d * 1.6)):
        at = rng.uniform(0, d - 0.3); f = rng.uniform(4300, 4700)
        for c in range(3):
            s = t(0.03); x = np.sin(2 * np.pi * f * s) * np.sin(np.pi * s / 0.03)
            j = int((at + c * 0.045) * SR); crick[j:j + len(x)] += 0.05 * x
    hum = 0.05 * np.sin(2 * np.pi * 60 * tt) + 0.02 * np.sin(2 * np.pi * 120 * tt)  # streetlight
    x = wind + crick + hum
    # crossfade ends for seamless looping
    n = int(0.5 * SR); r = np.linspace(0, 1, n); x[:n] = x[:n] * r + x[-n:] * (1 - r); x = x[:-n]
    return stereo(x, 0.6)

def car_interior(d=10.0):
    tt = t(d)
    road = spec_filter(noise(d), 30, 220, order=3) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.3 * tt))
    engine = 0.25 * np.sin(2 * np.pi * np.cumsum(38 + 2 * np.sin(2 * np.pi * 0.2 * tt)) / SR)
    x = road + engine
    n = int(0.5 * SR); r = np.linspace(0, 1, n); x[:n] = x[:n] * r + x[-n:] * (1 - r); x = x[:-n]
    return stereo(x, 0.4)

def scream_muffled_cue():
    """Abstract stand-in for a distant cry: a filtered vocal-formant swell, deliberately non-realistic."""
    d = 1.4; tt = t(d)
    f0 = 520 + 180 * np.sin(np.pi * tt / d)
    src = np.sign(np.sin(2 * np.pi * np.cumsum(f0) / SR))
    x = sum(spec_filter(src, fc * 0.85, fc * 1.15, order=2) * g for fc, g in [(850, 1), (1250, .6), (2900, .3)])
    x *= np.sin(np.pi * tt / d) ** 1.5
    return reverb(spec_filter(x, hi=2200, order=2), 1.6, 0.45, bright=2000)

def glitch():
    d = 0.6; out = np.zeros(int(d * SR))
    for _ in range(9):
        L = rng.uniform(0.01, 0.06); at = rng.uniform(0, d - L)
        s = t(L); f = rng.choice([220, 440, 1760, 3520])
        x = np.sign(np.sin(2 * np.pi * f * s)) * 0.4 + 0.4 * noise(L)
        j = int(at * SR); out[j:j + len(x)] += x
    return stereo(spec_filter(out, 200, 7000))

# ---------------------------------------------------------------- MUSIC
# Design rules (from the listening-panel notes): warm additive tones instead of raw saws, nothing below 60 Hz,
# a dip at 250 Hz and a wide pocket at 1.5-4 kHz so the narrator sits on top, slow movement, sparse rhythm.
BPM = 84
BEAT = 60 / BPM

def eq_vo_pocket(x, lp=3800, pocket_db=-6.0, mud_db=-6.0, hp=60):
    """Static mix EQ: HPF 60 Hz, -4 dB bell at 250 Hz, wide VO pocket at ~2.5 kHz, gentle LPF."""
    x2 = x if x.ndim == 1 else None
    def one(c):
        n = len(c); N = 1 << (n - 1).bit_length()
        X = np.fft.rfft(c, N); f = np.maximum(np.fft.rfftfreq(N, 1 / SR), 1e-3)
        g_db = mud_db * np.exp(-0.5 * (np.log2(f / 260) / 0.9) ** 2) + pocket_db * np.exp(-0.5 * (np.log2(f / 2500) / 0.9) ** 2)
        g = 10 ** (g_db / 20) / np.sqrt(1 + (hp / f) ** 6) / np.sqrt(1 + (f / lp) ** 4)
        return np.fft.irfft(X * g, N)[:n]
    if x2 is not None: return one(x)
    return np.stack([one(x[:, 0]), one(x[:, 1])], 1)

def warm(f, d, bright=1400, partials=8, chorus=True, lfo=0.13):
    """Soft additive tone (rolled-off harmonics), 3-voice chorus with slow drift and a breathing LFO."""
    tt = t(d); y = np.zeros(len(tt))
    dets = (-0.0035, 0.0, 0.0035) if chorus else (0.0,)
    for i, dt in enumerate(dets):
        drift = 1 + dt + 0.0012 * np.sin(2 * np.pi * (0.07 + 0.03 * i) * tt + i)
        ph = 2 * np.pi * f * np.cumsum(drift) / SR
        for k in range(1, partials + 1):
            fk = f * k
            if fk > 9000: break
            amp = (1 / k ** 1.8) / np.sqrt(1 + (fk / bright) ** 4)
            y += amp * np.sin(k * ph + 0.7 * k * i)
    y /= len(dets)
    y *= 0.82 + 0.18 * np.sin(2 * np.pi * lfo * tt + f % 3)
    return y

def felt(f, d=2.5, vel=1.0, attack=0.006):
    """Felt-piano-ish note: slightly inharmonic partials, fast attack, partial-dependent decay, low-passed."""
    tt = t(d); y = np.zeros(len(tt))
    for k in range(1, 7):
        fk = f * k * (1 + 0.0004 * k * k)
        if fk > 7000: break
        y += (1 / k ** 2.2) * np.sin(2 * np.pi * fk * tt) * np.exp(-tt / (1.4 / k ** 0.8))
    y *= (1 - np.exp(-tt / attack)) * vel
    y += 0.02 * vel * spec_filter(noise(d), 300, 1500) * np.exp(-tt / 0.01)  # hammer felt
    return spec_filter(y, hi=2600, order=2)

def soft_kick(d=0.45, f0=58, amp=1.0):
    tt = t(d); f = f0 * (1 + 1.2 * np.exp(-tt / 0.025))
    return amp * spec_filter(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.13) * (1 - np.exp(-tt / 0.004)), hi=220, order=2)

def air(d, lo=3000, hi=9000, rate=0.09):
    tt = t(d)
    return spec_filter(noise(d), lo, hi, order=2) * (0.5 + 0.5 * np.sin(2 * np.pi * rate * tt)) ** 2

def lay(buf, x, at):
    j = int(at * SR)
    if j >= len(buf): return
    m = min(len(buf) - j, len(x)); buf[j:j + m] += x[:m]

def tension(d, build=False, loop=False):
    """D minor, 84 bpm. Warm low pad (i-VI-iv-V colours), heartbeat-like soft kick, sparse felt ostinato.
    build=True: more ostinato notes, a fifth layer and air rise in over the length (filter capped at 1.6 kHz)."""
    tt = t(d); n = len(tt); bar = 4 * BEAT
    prog = [[146.83, 220.0, 293.66], [116.54, 174.61, 233.08], [98.0, 146.83, 196.0], [110.0, 164.81, 220.0]]
    padbuf = np.zeros(n)
    for i in range(int(np.ceil(d / bar)) + 1):
        L = bar + 1.2
        seg = sum(warm(2 * f, L, bright=1000, partials=5) for f in prog[i % 4])
        seg *= np.minimum(1, t(L) / 0.9) * np.minimum(1, (L - t(L)) / 1.2)
        lay(padbuf, seg, i * bar - (0.6 if i else 0))
    bass = np.zeros(n)
    roots = [73.42, 58.27, 49.0, 55.0]
    for i in range(int(np.ceil(d / bar)) + 1):
        L = bar + 0.8
        seg = warm(roots[i % 4], L, bright=300, partials=4, chorus=False) * np.minimum(1, t(L) / 0.5) * np.minimum(1, (L - t(L)) / 0.8)
        lay(bass, seg, i * bar)
    beat = np.zeros(n)
    for b in range(int(d / BEAT) + 1):
        amp = (0.9 if b % 2 == 0 else 0.0)
        if build: amp = 0.5 + 0.5 * b * BEAT / d if b % 2 == 0 else 0.35 * b * BEAT / d
        if amp: lay(beat, soft_kick(amp=amp), b * BEAT)
    ost = np.zeros(n); notes = [587.33, 440.0, 523.25, 440.0]
    step = BEAT * (2 if not build else 1)
    for s_ in range(int(d / step) + 1):
        vel = 0.5 if not build else 0.35 + 0.5 * s_ * step / d
        lay(ost, felt(notes[s_ % 4], 2.2, vel, attack=0.02), s_ * step)
    tick = np.zeros(n)
    x = 0.4 * padbuf + 0.55 * bass + 0.7 * beat + 0.24 * ost + 0.25 * tick + (0.0 if build else 0.02) * air(d, 3000, 7000)
    x = reverb(x, 2.6, 0.3, bright=2500)
    x = fold(x, n) if loop else x[:n]
    if build: x *= np.clip(0.6 + 0.4 * tt / d, 0, 1)[:, None]
    return eq_vo_pocket(x, lp=1500, pocket_db=-8)

def resolve(d=24.0):
    """D major, slow swell: warm pad (I-V/7-vi-IV), a few felt notes, airy shimmer, breathing LFO."""
    tt = t(d); n = len(tt); bar = 4 * BEAT
    prog = [[146.83, 220.0, 293.66, 369.99], [138.59, 220.0, 277.18, 329.63], [123.47, 185.0, 246.94, 293.66], [98.0, 196.0, 246.94, 293.66]]
    pad = np.zeros(n)
    for i in range(int(np.ceil(d / bar)) + 1):
        L = bar + 1.6
        seg = sum(warm(f, L, bright=1300, lfo=0.09) for f in prog[i % 4])
        seg *= np.minimum(1, t(L) / 1.4) * np.minimum(1, (L - t(L)) / 1.6)
        lay(pad, seg, i * bar - (0.8 if i else 0))
    mel = np.zeros(n)
    for k, (at, f) in enumerate([(1.0, 587.33), (3.0, 739.99), (5.0, 880.0), (9.0, 739.99), (11.0, 659.25), (13.0, 587.33),
                                 (17.0, 739.99), (19.0, 880.0), (20.4, 1174.66)]):
        if at * BEAT < d - 3: lay(mel, felt(f, 3.0, 0.55), at * BEAT)
    x = 0.5 * pad + 0.3 * mel + 0.04 * air(d, 4000, 10000, 0.07)
    x *= np.minimum(1, tt / 3.0) * np.minimum(1, (d - tt) / 5.0)
    return eq_vo_pocket(reverb(x, 3.4, 0.38, bright=4500)[:n], lp=4200, pocket_db=-5, hp=110)

def product_pulse(d):
    """Confident, unobtrusive D major loop for the v3 walkthrough: pad + quarter-note felt pulse + soft kick on 1 and 3."""
    tt = t(d); n = len(tt); bar = 4 * BEAT
    prog = [[146.83, 220.0, 293.66, 369.99], [123.47, 185.0, 246.94, 293.66], [98.0, 196.0, 246.94, 293.66], [110.0, 164.81, 220.0, 277.18]]
    pad = np.zeros(n); pulse = np.zeros(n); kick = np.zeros(n); bass = np.zeros(n)
    for i in range(int(np.ceil(d / bar)) + 1):
        L = bar + 1.0
        seg = sum(warm(2 * f if f < 200 else f, L, bright=1100, partials=5) for f in prog[i % 4]) * np.minimum(1, t(L) / 0.6) * np.minimum(1, (L - t(L)) / 1.0)
        lay(pad, seg, i * bar - (0.5 if i else 0))
        lay(bass, warm(prog[i % 4][0] / 2, bar + 0.5, bright=280, partials=4, chorus=False) * np.minimum(1, t(bar + .5) / .3) * np.minimum(1, (bar + .5 - t(bar + .5)) / .5), i * bar)
        for q in (0, 2):
            f = prog[i % 4][[2, 3][q // 2]] * 2
            lay(pulse, felt(f, 2.4, 0.35, attack=0.03), i * bar + q * BEAT)
            lay(kick, soft_kick(amp=0.5), i * bar + q * BEAT)
    pump = 1 - 0.28 * np.exp(-((tt % BEAT) / 0.18))
    x = 0.5 * pad * pump + 0.45 * bass + 0.5 * kick + 0.06 * spec_filter(pulse, hi=1200)
    return eq_vo_pocket(fold(reverb(x, 2.4, 0.32, bright=3000), n), lp=2600, pocket_db=-7)

# ---------------------------------------------------------------- main
def main():
    SFX.mkdir(parents=True, exist_ok=True); MUS.mkdir(parents=True, exist_ok=True)
    lib = {
        "whoosh_soft": whoosh(0.8, 400, 4000), "whoosh_hard": whoosh(0.5, 200, 8000),
        "phone_buzz": phone_buzz(), "phone_ring": phone_ring(2), "notify_ping": ping(),
        "heartbeat_calm": heartbeat(68, 6), "heartbeat_fast": heartbeat(118, 8),
        "glass_clink": glass_clink(), "footsteps_walk": footsteps(10, 0.55),
        "footsteps_behind": footsteps(8, 0.42, heavy=True, approach=True),
        "siren_far": siren_far(), "impact_hit": impact(), "riser": riser(), "ui_tap": tap(),
        "keypad_pin": keypad(4), "sticker_pop": pop(), "phone_smash": smash(), "signal_lost": signal_lost(),
        "alert_step": alert_tone(), "turn_signal": turn_signal(), "party_muffled_loop": party_muffled(),
        "night_ambience_loop": night_ambience(), "car_interior_loop": car_interior(),
        "distant_cry_abstract": scream_muffled_cue(), "glitch": glitch(),
    }
    peaks = {"party_muffled_loop": -12, "night_ambience_loop": -14, "car_interior_loop": -14, "siren_far": -12,
             "heartbeat_calm": -6, "heartbeat_fast": -6, "distant_cry_abstract": -10}
    report = {}
    for name, x in lib.items():
        assert f"{name}.wav" not in V1
        x = x if x.ndim == 2 else stereo(x)
        p = SFX / f"{name}.wav"; write(p, x if name.endswith("_loop") else fade(x, 0.002, 0.03), peaks.get(name, -3.0))
        report[name] = {"sec": round(len(x) / SR, 2), "lufs": lufs(p)}
    music = {
        "tension_loop": tension(8 * 4 * BEAT, loop=True),   # 8 bars @ 84 bpm = 22.86 s, seamless
        "tension_build": tension(24.0, build=True),
        "resolve_pad": resolve(24.0),
        "product_pulse_loop": product_pulse(8 * 4 * BEAT),
    }
    for name, x in music.items():
        p = MUS / f"{name}.wav"
        if name in ("tension_build", "resolve_pad"):
            x = fade(x, 0.3, 1.5)
        report["music/" + name] = {"sec": round(len(x) / SR, 2), "lufs": write_lufs(p, x, -24.0)}
    print(json.dumps(report, indent=1))

if __name__ == "__main__":
    main()
