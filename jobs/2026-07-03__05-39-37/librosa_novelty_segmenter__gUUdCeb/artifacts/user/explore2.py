import numpy as np
import librosa
import scipy.signal

y, sr = librosa.load('/home/user/input.wav', sr=None)
hop = 512
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20, hop_length=hop)
N = mfcc.shape[1]
print('N frames', N)

# Normalize features for cosine similarity
F = mfcc - np.mean(mfcc, axis=1, keepdims=True)
norms = np.linalg.norm(F, axis=0, keepdims=True) + 1e-12
Fn = F / norms
S = Fn.T @ Fn  # cosine similarity, shape (N,N)
S = (S + 1) / 2  # map to [0,1]
print('S min/max', S.min(), S.max())

# Checkerboard kernel (Gaussian tapered)
M = 32
L = 2 * M
sigma = M / 3.0
t = np.arange(L) - (L - 1) / 2.0
gauss = np.exp(-0.5 * (t / sigma) ** 2)
gauss2d = np.outer(gauss, gauss)
sign = np.ones((L, L))
sign[:M, M:] = -1
sign[M:, :M] = -1
kernel = sign * gauss2d
kernel -= kernel.mean()

nov = np.zeros(N)
for n in range(M, N - M):
    block = S[n - M:n + M, n - M:n + M]
    nov[n] = np.sum(block * kernel)
nov = nov / (np.max(np.abs(nov)) + 1e-12)

# print novelty around expected regions
for ts in [5.0, 10.0]:
    fr = librosa.time_to_frames(ts, sr=sr, hop_length=hop)
    print(f'nov around {ts}s (frame {fr}):', np.round(nov[fr-3:fr+4],3))

# peak picking
min_dist = int(1.5 * sr / hop)  # 1.5s
peaks, props = scipy.signal.find_peaks(nov, height=0.2, distance=min_dist)
print('peak frames', peaks)
times = librosa.frames_to_time(peaks, sr=sr, hop_length=hop)
print('peak times', np.round(times,3))