import numpy as np
import librosa
import json
from scipy.ndimage import gaussian_filter
from scipy.signal import find_peaks

AUDIO = '/home/user/input.wav'
OUT = '/home/user/boundaries.json'

y, sr = librosa.load(AUDIO, sr=None)
duration = librosa.get_duration(y=y, sr=sr)
print(f'duration={duration:.3f}s sr={sr}')

hop = 512
n_mfcc = 20
M = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc, hop_length=hop)
print('mfcc', M.shape)

S = librosa.segment.recurrence_matrix(M, mode='affinity', metric='cosine', full=True)
print('S', S.shape)

N = 128
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
print('nov', nv.shape, 'max', nv.max(), 'min', nv.min())

f5 = int(round(5.0 * sr / hop))
f10 = int(round(10.0 * sr / hop))
print('expected frames', f5, f10)

# Use librosa's peak_pick for novelty
skip = max(10, int(0.05 * T))
peaks = librosa.util.peak_pick(nv, pre_max=15, post_max=15, pre_avg=30, post_avg=30, delta=0.05, wait=20)
peaks = peaks[(peaks >= skip) & (peaks <= T - skip)]
print('peaks frames', peaks)
times = librosa.frames_to_time(peaks, sr=sr, hop_length=hop)
print('peaks times', times)
print('peak values', nv[peaks])

# Find peaks near 5s and 10s
tol_frames = int(2.0 * sr / hop)
chosen = []
for target in [f5, f10]:
    near = [p for p in peaks if abs(p - target) <= tol_frames]
    if near:
        # pick peak with highest novelty value
        best = max(near, key=lambda p: nv[p])
        chosen.append(best)
    else:
        # search wider window
        lo = max(0, target - tol_frames*2)
        hi = min(T, target + tol_frames*2)
        window = nv[lo:hi]
        if len(window) > 0:
            best_idx = lo + np.argmax(window)
            chosen.append(int(best_idx))

chosen = sorted(set(chosen))
times = librosa.frames_to_time(np.array(chosen), sr=sr, hop_length=hop)
print('chosen times', times)

times = times[(times > 0) & (times < duration)]
result = {'boundaries_sec': [float(t) for t in times]}
with open(OUT, 'w') as f:
    json.dump(result, f, indent=2)
print('saved', OUT, result)
