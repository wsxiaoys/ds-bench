import numpy as np
import librosa
import json
from scipy.ndimage import gaussian_filter
from scipy.signal import find_peaks

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

# Use absolute value
abs_nv = np.abs(nv)
print('Top peaks of |novelty|:')
peaks, _ = find_peaks(abs_nv, distance=N, prominence=0.15)
p_sorted = sorted(peaks, key=lambda p: -abs_nv[p])[:8]
for p in sorted(p_sorted):
    print(f'  frame={p} time={times[p]:.3f}s |val|={abs_nv[p]:.3f} sign={nv[p]:+.3f}')
