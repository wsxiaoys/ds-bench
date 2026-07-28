import numpy as np
import librosa

sr = 22050
n_fft = 2048
hop_length = 512

def synthesize_pitch_template(pitch, duration=1.0, sr=22050):
    f0 = 440.0 * (2.0 ** ((pitch - 69.0) / 12.0))
    t = np.arange(0, duration, 1.0 / sr)
    y = np.zeros_like(t)
    
    # Synthesize harmonics up to Nyquist
    max_k = int((sr / 2.0) / f0)
    for k in range(1, max_k + 1):
        # 1/k amplitude decay
        amplitude = 1.0 / k
        y += amplitude * np.sin(2 * np.pi * k * f0 * t)
        
    # Compute STFT magnitude
    D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    S = np.abs(D)
    
    # Average across frames to get a single template column
    template = np.mean(S, axis=1)
    # Normalize template to unit L2 norm (or L1 norm)
    template /= np.linalg.norm(template) + 1e-8
    return template

# Let's test for pitch 60 (C4)
template_60 = synthesize_pitch_template(60)
# Print the top peaks
peaks = []
for i in range(1, len(template_60) - 1):
    if template_60[i] > template_60[i-1] and template_60[i] > template_60[i+1]:
        peaks.append((i, template_60[i]))
peaks = sorted(peaks, key=lambda x: x[1], reverse=True)

print("Synthesized Pitch 60 (C4) Template Peaks:")
for idx, val in peaks[:10]:
    freq = idx * sr / n_fft
    print(f"  Bin {idx:3d}: Freq {freq:7.2f} Hz, Mag {val:6.4f}")
