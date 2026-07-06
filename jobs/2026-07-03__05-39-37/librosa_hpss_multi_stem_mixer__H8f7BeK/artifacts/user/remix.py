import librosa
import soundfile as sf
import numpy as np

INPUT = "/home/user/input.wav"
OUTPUT = "/home/user/output.wav"

# 0. Load input preserving native sample rate
y, sr = librosa.load(INPUT, sr=None)

# 1. HPSS with strong percussive mask
harmonic, percussive = librosa.effects.hpss(y, margin=(1.0, 5.0))

# 2. Pitch-shift harmonic up by 7 semitones
harmonic_shifted = librosa.effects.pitch_shift(harmonic, sr=sr, n_steps=7)

# 3. Time-stretch percussive by rate 0.85 (slow down)
percussive_stretched = librosa.effects.time_stretch(percussive, rate=0.85)

# 4. Re-align lengths to original and mix
n = len(y)

def align(x):
    if len(x) < n:
        return np.pad(x, (0, n - len(x)))
    return x[:n]

h = align(harmonic_shifted)
p = align(percussive_stretched)
mix = 0.7 * h + 0.5 * p

# 5. Trim leading/trailing silence
mix, _ = librosa.effects.trim(mix, top_db=30)

# 6. Write output at the same sample rate as input
sf.write(OUTPUT, mix, sr)
print("Wrote", OUTPUT, "sr=", sr, "len=", len(mix))