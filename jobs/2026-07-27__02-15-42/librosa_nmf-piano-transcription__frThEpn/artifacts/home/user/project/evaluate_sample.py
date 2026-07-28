import numpy as np
import librosa

def synthesize_pitch_template(pitch, alpha=0.3, sr=22050, n_fft=2048, hop_length=512):
    f0 = 440.0 * (2.0 ** ((pitch - 69.0) / 12.0))
    t = np.arange(0, 0.5, 1.0 / sr)
    y = np.zeros_like(t)
    max_k = int((sr / 2.0) / f0)
    for k in range(1, max_k + 1):
        amplitude = 1.0 / (k ** alpha)
        y += amplitude * np.sin(2 * np.pi * k * f0 * t)
    D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    S = np.abs(D)
    template = np.mean(S, axis=1)
    template /= np.sum(template) + 1e-8
    return template

y, sr = librosa.load('data/sample_mixture.wav', sr=22050)
V = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
F, T = V.shape
pitches = np.arange(48, 73)
num_pitches = len(pitches)

W = np.zeros((F, num_pitches))
for i, p in enumerate(pitches):
    W[:, i] = synthesize_pitch_template(p, alpha=0.3, sr=sr)

# Add noise template
noise_template = np.ones(F)
noise_template /= np.sum(noise_template)
W = np.hstack([W, noise_template[:, np.newaxis]])

H = np.ones((num_pitches + 1, T)) * 0.1
for it in range(100):
    WH = np.dot(W, H) + 1e-10
    H *= np.dot(W.T, V / WH)

# Threshold at 150
threshold = 150.0
binary_roll = (H[:num_pitches, :] > threshold).astype(int)

print("Active pitches and their runs:")
for i, p in enumerate(pitches):
    row = binary_roll[i, :]
    if np.sum(row) > 0:
        # Find runs
        runs = []
        start = None
        for t in range(T):
            if row[t] == 1 and start is None:
                start = t
            elif row[t] == 0 and start is not None:
                runs.append((start, t - 1))
                start = None
        if start is not None:
            runs.append((start, T - 1))
        
        runs_str = ", ".join([f"{s}-{e} ({s*512/sr:.2f}s - {(e+1)*512/sr:.2f}s)" for s, e in runs])
        print(f"Pitch {p}: {runs_str}")
