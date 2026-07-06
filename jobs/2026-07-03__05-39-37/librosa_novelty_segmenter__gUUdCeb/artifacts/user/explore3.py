import numpy as np
import librosa
import scipy.signal

y, sr = librosa.load('/home/user/input.wav', sr=None)
hop = 512
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20, hop_length=hop)
N = mfcc.shape[1]

F = mfcc - np.mean(mfcc, axis=1, keepdims=True)
norms = np.linalg.norm(F, axis=0, keepdims=True) + 1e-12
Fn = F / norms
S = Fn.T @ Fn
S = (S + 1) / 2

for M in [16, 24, 32, 48]:
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

    # print novelty every 0.5s
    print(f'\n=== M={M} (kernel {L} frames ~ {L*hop/sr:.2f}s) ===')
    for tsec in np.arange(0, 15.5, 0.5):
        fr = librosa.time_to_frames(tsec, sr=sr, hop_length=hop)
        if 0 <= fr < N:
            print(f'  t={tsec:5.1f}s frame={fr:3d} nov={nov[fr]:.3f}')
    min_dist = int(1.5 * sr / hop)
    peaks, _ = scipy.signal.find_peaks(nov, height=0.15, distance=min_dist)
    times = librosa.frames_to_time(peaks, sr=sr, hop_length=hop)
    print('  peaks:', np.round(times,3))