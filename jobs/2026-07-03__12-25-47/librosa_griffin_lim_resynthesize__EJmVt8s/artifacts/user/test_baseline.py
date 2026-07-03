import numpy as np
import soundfile as sf
import librosa

INPUT_PATH = "/home/user/input.wav"

N_FFT = 2048
HOP_LENGTH = 512
N_MELS = 128
N_ITER = 64

y, sr = librosa.load(INPUT_PATH, sr=None, mono=True)
print(f"y: sr={sr}, len={len(y)}")

# 1) Compute power mel and resynthesize WITHOUT any log round-trip
M = librosa.feature.melspectrogram(
    y=y, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH, n_mels=N_MELS, power=2.0,
)
print(f"M shape={M.shape}, range={M.min():.3e}..{M.max():.3e}")

# Direct inversion (no log/exp round trip)
y_rec_direct = librosa.feature.inverse.mel_to_audio(
    M=M, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH, n_iter=N_ITER, length=len(y),
)
ref_power = np.sum(y.astype(np.float64) ** 2)
noise_direct = np.sum((y[:len(y_rec_direct)] - y_rec_direct).astype(np.float64) ** 2)
snr_direct = 10.0 * np.log10(ref_power / noise_direct)
print(f"SNR direct (no log round trip): {snr_direct:.3f} dB")

# 2) Compute log-power, exp back, then invert
M_log = np.log(M + 1e-10)
M_back = np.exp(M_log) - 1e-10
M_back = np.clip(M_back, 0, None)
print(f"Round-trip max abs diff: {np.max(np.abs(M - M_back)):.3e}")

y_rec_log = librosa.feature.inverse.mel_to_audio(
    M=M_back, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH, n_iter=N_ITER, length=len(y),
)
noise_log = np.sum((y[:len(y_rec_log)] - y_rec_log).astype(np.float64) ** 2)
snr_log = 10.0 * np.log10(ref_power / noise_log)
print(f"SNR via log/exp: {snr_log:.3f} dB")

# 3) Check with power_to_db (which clips at -80) vs natural log
M_db = librosa.power_to_db(M, ref=np.max)
M_from_db = librosa.db_to_power(M_db, ref=np.max)
print(f"db->power max abs diff: {np.max(np.abs(M - M_from_db)):.3e}")

# 4) Sanity check: do GL on the actual STFT magnitude (no mel compression)
S = librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH)
mag = np.abs(S)
y_rec_gl = librosa.griffinlim(mag, n_fft=N_FFT, hop_length=HOP_LENGTH, n_iter=64, length=len(y))
noise_gl = np.sum((y[:len(y_rec_gl)] - y_rec_gl).astype(np.float64) ** 2)
snr_gl = 10.0 * np.log10(ref_power / noise_gl)
print(f"SNR GL on true STFT magnitude (no mel): {snr_gl:.3f} dB")
