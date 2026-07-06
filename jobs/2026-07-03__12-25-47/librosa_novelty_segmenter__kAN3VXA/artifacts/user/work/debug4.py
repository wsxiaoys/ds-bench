import numpy as np
import librosa
from scipy.ndimage import gaussian_filter
from scipy.signal import find_peaks

AUDIO = '/home/user/input.wav'
y, sr = librosa.load(AUDIO, sr=None)

for hop in [256, 512]:
    for n_mfcc in [13, 20]:
        for N in [32, 64, 128]:
            M = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc, hop_length=hop)
            S = librosa.segment.recurrence_matrix(M, mode='affinity', metric='cosine', full=True)
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
            abs_nv = np.abs(nv)
            skip = max(10, int(0.05 * T))
            peaks, _ = find_peaks(abs_nv, distance=max(5, N//2), prominence=0.15)
            peaks = peaks[(peaks >= skip) & (peaks <= T - skip)]
            p_sorted = sorted(peaks, key=lambda p: -abs_nv[p])[:3]
            peak_times = [times[p] for p in sorted(p_sorted)]
            print(f'hop={hop} nmfcc={n_mfcc} N={N}: top peaks (sec): {[f"{t:.2f}" for t in peak_times]}')
