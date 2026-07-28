import numpy as np
import librosa
import json

def synthesize_pitch_template(pitch, alpha=0.3, sr=22050, n_fft=2048, hop_length=512):
    f0 = 440.0 * (2.0 ** ((pitch - 69.0) / 12.0))
    t = np.arange(0, 1.0, 1.0 / sr)
    y = np.zeros_like(t)
    max_k = int((sr / 2.0) / f0)
    for k in range(1, max_k + 1):
        amplitude = 1.0 / (k ** alpha)
        y += amplitude * np.sin(2 * np.pi * k * f0 * t)
    D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    S = np.abs(D)
    
    # Discard boundary frames to get pure steady-state spectrum
    S_steady = S[:, 10:-10]
    template = np.mean(S_steady, axis=1)
    template /= np.sum(template) + 1e-8
    return template

def smooth_binary_roll(binary_roll, min_note_len=3, max_gap_len=2):
    smoothed = np.copy(binary_roll)
    num_pitches, n_frames = smoothed.shape
    for i in range(num_pitches):
        # 1. Fill small gaps (0s surrounded by 1s)
        row = smoothed[i, :]
        zeros_indices = np.where(row == 0)[0]
        if len(zeros_indices) > 0:
            gaps = []
            start = zeros_indices[0]
            for idx in range(1, len(zeros_indices)):
                if zeros_indices[idx] != zeros_indices[idx-1] + 1:
                    gaps.append((start, zeros_indices[idx-1]))
                    start = zeros_indices[idx]
            gaps.append((start, zeros_indices[-1]))
            
            for s, e in gaps:
                if s > 0 and e < n_frames - 1:
                    if (e - s + 1) <= max_gap_len:
                        smoothed[i, s:e+1] = 1
                        
        # 2. Remove short active segments (1s)
        row = smoothed[i, :]
        ones_indices = np.where(row == 1)[0]
        if len(ones_indices) > 0:
            runs = []
            start = ones_indices[0]
            for idx in range(1, len(ones_indices)):
                if ones_indices[idx] != ones_indices[idx-1] + 1:
                    runs.append((start, ones_indices[idx-1]))
                    start = ones_indices[idx]
            runs.append((start, ones_indices[-1]))
            
            for s, e in runs:
                if (e - s + 1) < min_note_len:
                    smoothed[i, s:e+1] = 0
                    
    return smoothed

def extract_notes(binary_roll, pitches, sr=22050, hop_length=512):
    notes = []
    num_pitches, n_frames = binary_roll.shape
    for i in range(num_pitches):
        pitch = int(pitches[i])
        row = binary_roll[i, :]
        
        start = None
        for t in range(n_frames):
            if row[t] == 1 and start is None:
                start = t
            elif row[t] == 0 and start is not None:
                onset_time = start * hop_length / sr
                offset_time = t * hop_length / sr
                notes.append({
                    "pitch": pitch,
                    "onset_time": float(onset_time),
                    "offset_time": float(offset_time)
                })
                start = None
        if start is not None:
            onset_time = start * hop_length / sr
            offset_time = n_frames * hop_length / sr
            notes.append({
                "pitch": pitch,
                "onset_time": float(onset_time),
                "offset_time": float(offset_time)
            })
            
    notes = sorted(notes, key=lambda x: (x["onset_time"], x["pitch"]))
    return notes

# Load audio and peak normalize
y, sr = librosa.load('data/sample_mixture.wav', sr=22050)
y = y / (np.max(np.abs(y)) + 1e-8)

V = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
F, T = V.shape
pitches = np.arange(48, 73)
num_pitches = len(pitches)

# Construct W
W = np.zeros((F, num_pitches))
for i, p in enumerate(pitches):
    W[:, i] = synthesize_pitch_template(p, alpha=0.3, sr=sr)

# Add noise template
noise_template = np.ones(F)
noise_template /= np.sum(noise_template)
W = np.hstack([W, noise_template[:, np.newaxis]])

# Run fixed-basis NMF
H = np.ones((num_pitches + 1, T)) * 0.1
for it in range(100):
    WH = np.dot(W, H) + 1e-10
    H *= np.dot(W.T, V / WH)

# Relative threshold
max_H = np.max(H[:num_pitches, :])
threshold = max(125.0, min(180.0, 0.25 * max_H))
print(f"Global Max H: {max_H:.4f}, Adaptive Threshold: {threshold:.4f}")

binary_roll = (H[:num_pitches, :] > threshold).astype(int)
binary_roll_smoothed = smooth_binary_roll(binary_roll, min_note_len=3, max_gap_len=2)

notes = extract_notes(binary_roll_smoothed, pitches, sr=sr)

print(f"Total notes transcribed: {len(notes)}")
