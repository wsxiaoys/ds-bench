import librosa
import numpy as np

# Load audio
y, sr = librosa.load('data/sample_mixture.wav', sr=22050)
print(f"Audio shape: {y.shape}, sample rate: {sr}")
print(f"Duration: {len(y)/sr:.2f} seconds")

# Compute STFT
D = librosa.stft(y, n_fft=2048, hop_length=512)
S = np.abs(D)
print(f"Spectrogram shape: {S.shape}")

# Let's find some prominent peaks in the spectrum to see what frequencies/harmonics are present
# We can sum over time to see the overall active frequencies
mean_spectrum = np.mean(S, axis=1)
# Find local maxima in mean_spectrum
peaks = []
for i in range(1, len(mean_spectrum) - 1):
    if mean_spectrum[i] > mean_spectrum[i-1] and mean_spectrum[i] > mean_spectrum[i+1]:
        peaks.append((i, mean_spectrum[i]))

# Sort by magnitude descending
peaks = sorted(peaks, key=lambda x: x[1], reverse=True)
print("Top 20 peaks in mean spectrum:")
for idx, val in peaks[:20]:
    freq = idx * sr / 2048
    print(f"Bin {idx}: Freq {freq:.2f} Hz, Mag {val:.4f}")
