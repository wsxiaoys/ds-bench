import numpy as np
import librosa
import json
from scipy.ndimage import gaussian_filter

AUDIO = '/home/user/input.wav'
y, sr = librosa.load(AUDIO, sr=None)
hop = 512
n_mfcc = 20
M = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc, hop_length=hop)
S = librosa.segment.recurrence_matrix(M, mode='affinity', metric='cosine', full=True)

N = 64
kernel = np.zeros((N, N))
H = N // 2
kernel[:H, :H] = 1.0
kernel[H:, H:] = 1.0
kernel[:H, H:] = -1.0
kernel[H:, :H] = -1.0
g = gaussian_filter(kernel, sigma=N/8)
kernel = np.where(kernel > 0, np.abs(g), -np.abs(g))
kernel /= np.max(np.abs(kernel))

T = S.shape[0]
nov = np.zeros(T)
S_padded = np.pad(S, N, mode='constant', constant_values=0)
for t in range(T):
    patch = S_padded[t:t+N, t:t+N]
    nov[t] = np.sum(patch * kernel)

nov -= np.mean(nov)
nv = nov / (np.max(np.abs(nov)) + 1e-12)
times = librosa.frames_to_time(np.arange(T), sr=sr, hop_length=hop)

# Print novelty values around 5s and 10s
print('Around 5s (frames 150-280):')
for t in range(150, 281, 5):
    print(f'  frame={t} time={times[t]:.3f}s val={nv[t]:.3f}')
print('\nAround 10s (frames 380-510):')
for t in range(380, 511, 5):
    print(f'  frame={t} time={times[t]:.3f}s val={nv[t]:.3f}')
