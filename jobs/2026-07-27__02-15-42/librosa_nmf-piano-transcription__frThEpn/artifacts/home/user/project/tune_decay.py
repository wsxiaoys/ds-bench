import numpy as np
import librosa

def synthesize_pitch_template(pitch, alpha=1.0, sr=22050, n_fft=2048, hop_length=512):
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

for alpha in [0.3, 0.4, 0.5]:
    W = np.zeros((F, num_pitches))
    for i, p in enumerate(pitches):
        W[:, i] = synthesize_pitch_template(p, alpha=alpha, sr=sr)
    
    # Add noise template
    noise_template = np.ones(F)
    noise_template /= np.sum(noise_template)
    W = np.hstack([W, noise_template[:, np.newaxis]])
    
    H = np.ones((num_pitches + 1, T)) * 0.1
    for it in range(80):
        WH = np.dot(W, H) + 1e-10
        H *= np.dot(W.T, V / WH)
        
    max_acts = [np.max(H[i, :]) for i in range(num_pitches)]
    sorted_acts = sorted(max_acts, reverse=True)
    top_mean = np.mean(sorted_acts[:12])
    bottom_mean = np.mean(sorted_acts[12:])
    contrast = top_mean / (bottom_mean + 1e-8)
    print(f"Alpha: {alpha:.1f} | Top 12 Mean: {top_mean:7.2f} | Bottom 13 Mean: {bottom_mean:7.2f} | Contrast Ratio: {contrast:7.2f}")
