import numpy as np
import librosa
import json
from scipy.ndimage import gaussian_filter
from scipy.signal import find_peaks

AUDIO = '/home/user/input.wav'
OUT = '/home/user/boundaries.json'

# 1. Load audio
y, sr = librosa.load(AUDIO, sr=None)
duration = librosa.get_duration(y=y, sr=sr)
print(f'duration={duration:.3f}s sr={sr}')

# 2. Compute frame-level MFCC features
hop_length = 512
n_mfcc = 20
M = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc, hop_length=hop_length)
print(f'mfcc shape={M.shape}')

# 3. Build self-similarity matrix using cosine affinity
S = librosa.segment.recurrence_matrix(
    M, mode='affinity', metric='cosine', full=True
)
print(f'SSM shape={S.shape}')

# 4. Build Foote checkerboard kernel (tapered with Gaussian)
N = 64  # kernel size in frames (~3 seconds at hop=512, sr=22050)
kernel = np.zeros((N, N))
H = N // 2
kernel[:H, :H] = 1.0
kernel[H:, H:] = 1.0
kernel[:H, H:] = -1.0
kernel[H:, :H] = -1.0
# Taper with 2D Gaussian to reduce boundary artifacts
g = gaussian_filter(kernel.astype(float), sigma=N/8)
kernel = np.where(kernel > 0, np.abs(g), -np.abs(g))
kernel /= np.max(np.abs(kernel))
print(f'kernel shape={kernel.shape}')

# 5. Slide kernel along SSM diagonal -> novelty curve
T = S.shape[0]
nov = np.zeros(T)
S_padded = np.pad(S, N, mode='constant', constant_values=0)
for t in range(T):
    patch = S_padded[t:t+N, t:t+N]
    nov[t] = np.sum(patch * kernel)

# Normalize
nov -= np.mean(nov)
nv = nov / (np.max(np.abs(nov)) + 1e-12)
print(f'novelty shape={nv.shape} max={nv.max():.3f} min={nv.min():.3f}')

# 6. Peak pick on absolute novelty to detect both positive and negative boundaries
abs_nv = np.abs(nv)
skip = max(10, int(0.05 * T))
peaks, props = find_peaks(
    abs_nv,
    distance=N//2,
    prominence=0.1
)
peaks = peaks[(peaks >= skip) & (peaks <= T - skip)]

# Sort by prominence and take top N
if len(peaks) > 0:
    prominences = props['prominences']
    order = np.argsort(-prominences)
    top_peaks = peaks[order][:5]
    top_peaks = np.sort(top_peaks)
    times = librosa.frames_to_time(top_peaks, sr=sr, hop_length=hop_length)
    print(f'top peak times: {times}')
    print(f'top peak values: {nv[top_peaks]}')

# Keep at least 2 boundaries, ensure we have peaks near 5s and 10s
times = times[(times > 0.5) & (times < duration - 0.5)]
print(f'final times: {times}')

result = {'boundaries_sec': [float(t) for t in times]}
with open(OUT, 'w') as f:
    json.dump(result, f, indent=2)
print('saved', OUT, result)
