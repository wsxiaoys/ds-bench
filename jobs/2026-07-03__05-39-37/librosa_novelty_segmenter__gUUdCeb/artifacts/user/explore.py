import numpy as np
import librosa
import scipy.signal

y, sr = librosa.load('/home/user/input.wav', sr=None)
print('sr', sr, 'dur', len(y)/sr)

hop = 512
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20, hop_length=hop)
print('mfcc shape', mfcc.shape)
N = mfcc.shape[1]

# SSM via recurrence_matrix as hinted
R = librosa.segment.recurrence_matrix(mfcc, mode='affinity', metric='cosine', full=True)
print('R shape', R.shape, 'min', R.min(), 'max', R.max())
R = np.asarray(R, dtype=np.float64)

# Checkerboard kernel (Gaussian tapered)
M = 32  # half-size -> kernel 2M x 2M
L = 2 * M
# build outer product of gaussian
sigma = M / 3.0
t = np.arange(L) - (L - 1) / 2.0
gauss = np.exp(-0.5 * (t / sigma) ** 2)
gauss2d = np.outer(gauss, gauss)
# checkerboard sign pattern
sign = np.ones((L, L))
sign[:M, :M] = +1
sign[:M, M:] = -1
sign[M:, :M] = -1
sign[M:, M:] = +1
kernel = sign * gauss2d
kernel -= kernel.mean()  # zero mean

# Novelty via diagonal convolution
nov = np.zeros(N)
for n in range(M, N - M):
    block = R[n - M:n + M, n - M:n + M]
    nov[n] = np.sum(block * kernel)

# normalize
nov = nov / (np.max(np.abs(nov)) + 1e-12)
print('nov min/max', nov.min(), nov.max())

# peak picking
peaks, props = scipy.signal.find_peaks(nov, height=0.15, distance=int(0.5 * sr / hop))
print('peak frames', peaks)
times = librosa.frames_to_time(peaks, sr=sr, hop_length=hop)
print('peak times', times)