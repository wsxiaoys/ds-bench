import numpy as np
import librosa
import json
from scipy.ndimage import gaussian_filter

AUDIO = '/home/user/input.wav'
y, sr = librosa.load(AUDIO, sr=None)
duration = librosa.get_duration(y=y, sr=sr)
hop = 512
n_mfcc = 20
M = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc, hop_length=hop)
S = librosa.segment.recurrence_matrix(M, mode='affinity', metric='cosine', full=True)

for N in [64, 128, 256]:
    print(f'\n=== N={N} ===')
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
    # find peaks with different parameters
    from scipy.signal import find_peaks
    peaks, props = find_peaks(nv, distance=N, prominence=0.1)
    print('top 8 peaks (prominence>0.1):')
    p_sorted = sorted(peaks, key=lambda p: -nv[p])[:8]
    for p in sorted(p_sorted):
        print(f'  frame={p} time={times[p]:.3f}s val={nv[p]:.3f}')
