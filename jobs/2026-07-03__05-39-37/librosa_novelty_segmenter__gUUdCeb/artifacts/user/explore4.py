import numpy as np
import librosa

y, sr = librosa.load('/home/user/input.wav', sr=None)
hop = 512
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20, hop_length=hop)
N = mfcc.shape[1]

# frame-to-frame feature distance (novelty from delta features)
delta = np.zeros(N)
for n in range(1, N):
    delta[n] = np.linalg.norm(mfcc[:, n] - mfcc[:, n-1])

# Also RMS and centroid
S = np.abs(librosa.stft(y, hop_length=hop))**2
rms = librosa.feature.rms(S=S)[0]
cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]

print('time  rms   centroid   delta_mfcc')
for tsec in np.arange(0, 15.5, 0.25):
    fr = librosa.time_to_frames(tsec, sr=sr, hop_length=hop)
    if 0 <= fr < N:
        print(f'{tsec:5.2f}s  {rms[fr]:.4f}  {cent[fr]:7.1f}  {delta[fr]:.3f}')