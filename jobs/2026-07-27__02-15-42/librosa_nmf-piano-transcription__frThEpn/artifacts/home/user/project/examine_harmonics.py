import librosa
import numpy as np

# Load audio
y, sr = librosa.load('data/sample_mixture.wav', sr=22050)
D = librosa.stft(y, n_fft=2048, hop_length=512)
S = np.abs(D)

# Let's find some frames where there is a clear, strong note
# We can compute the energy of each frame
frame_energies = np.sum(S**2, axis=0)

# Let's print the spectrum of a few frames with high energy
# to see if we can identify the harmonic peaks for a specific fundamental frequency.
# Let's look at frame 50, 100, 150, 200, 250
for frame_idx in [30, 80, 130, 180, 230]:
    if frame_idx >= S.shape[1]:
        continue
    spectrum = S[:, frame_idx]
    # Find local peaks in this frame
    peaks = []
    for i in range(1, len(spectrum) - 1):
        if spectrum[i] > spectrum[i-1] and spectrum[i] > spectrum[i+1] and spectrum[i] > 1.0:
            peaks.append((i, spectrum[i]))
    peaks = sorted(peaks, key=lambda x: x[1], reverse=True)
    print(f"\n--- Frame {frame_idx} (Time: {frame_idx * 512 / 22050:.2f}s) ---")
    print("Top 10 peaks:")
    for idx, val in peaks[:10]:
        freq = idx * sr / 2048
        print(f"  Bin {idx:3d}: Freq {freq:7.2f} Hz, Mag {val:6.2f}")
