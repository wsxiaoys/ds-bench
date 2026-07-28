import numpy as np
import librosa

def synthesize_pitch_template(pitch, sr=22050, n_fft=2048, hop_length=512):
    f0 = 440.0 * (2.0 ** ((pitch - 69.0) / 12.0))
    # Synthesize 1.0 second of audio
    t = np.arange(0, 1.0, 1.0 / sr)
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
    # L1 normalization so that column sums to 1
    template /= np.sum(template) + 1e-8
    return template

# Load audio
y, sr = librosa.load('data/sample_mixture.wav', sr=22050)
V = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))

# Construct W
pitches = np.arange(48, 73) # 48 to 72 inclusive (25 pitches)
num_pitches = len(pitches)
F, T = V.shape

# Initialize W
W = np.zeros((F, num_pitches))
for i, p in enumerate(pitches):
    W[:, i] = synthesize_pitch_template(p, sr=sr)

# Let's add a broadband noise template (uniform spectrum)
# normalized to sum to 1
noise_template = np.ones(F)
noise_template /= np.sum(noise_template)
W = np.hstack([W, noise_template[:, np.newaxis]])

# Initialize H (shape: num_templates x T)
# Templates: 25 pitches + 1 noise template = 26 templates
num_templates = num_pitches + 1
H = np.ones((num_templates, T)) * 0.1

# Run multiplicative updates
num_iterations = 200
for it in range(num_iterations):
    # WH approximation
    WH = np.dot(W, H) + 1e-10
    # Ratio V / WH
    ratio = V / WH
    # Update H
    H *= np.dot(W.T, ratio)

# Let's inspect the activations of the first 25 templates (pitches)
# We can print the max activation for each pitch
for i, p in enumerate(pitches):
    max_act = np.max(H[i, :])
    mean_act = np.mean(H[i, :])
    print(f"Pitch {p}: Max activation = {max_act:.4f}, Mean activation = {mean_act:.4f}")
