import numpy as np
import librosa

def synthesize_pitch_template(pitch, sr=22050, n_fft=2048, hop_length=512):
    f0 = 440.0 * (2.0 ** ((pitch - 69.0) / 12.0))
    t = np.arange(0, 1.0, 1.0 / sr)
    y = np.zeros_like(t)
    max_k = int((sr / 2.0) / f0)
    for k in range(1, max_k + 1):
        amplitude = 1.0 / k
        y += amplitude * np.sin(2 * np.pi * k * f0 * t)
    D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    S = np.abs(D)
    template = np.mean(S, axis=1)
    template /= np.sum(template) + 1e-8
    return template

# Load audio
y, sr = librosa.load('data/sample_mixture.wav', sr=22050)
V = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))

pitches = np.arange(48, 73)
num_pitches = len(pitches)
F, T = V.shape

W = np.zeros((F, num_pitches))
for i, p in enumerate(pitches):
    W[:, i] = synthesize_pitch_template(p, sr=sr)

# Add noise template
noise_template = np.ones(F)
noise_template /= np.sum(noise_template)
W = np.hstack([W, noise_template[:, np.newaxis]])

H = np.ones((num_pitches + 1, T)) * 0.1

num_iterations = 200
for it in range(num_iterations):
    WH = np.dot(W, H) + 1e-10
    H *= np.dot(W.T, V / WH)

# Let's print activation values for MIDI 60 (active) and MIDI 61 (inactive)
# every 10 frames
print("Frame | Time (s) | Pitch 60 (active) | Pitch 61 (inactive) | Noise")
print("-" * 65)
for t in range(0, T, 10):
    time_sec = t * 512 / sr
    print(f"{t:5d} | {time_sec:8.2f} | {H[12, t]:17.2f} | {H[13, t]:19.2f} | {H[-1, t]:5.2f}")
