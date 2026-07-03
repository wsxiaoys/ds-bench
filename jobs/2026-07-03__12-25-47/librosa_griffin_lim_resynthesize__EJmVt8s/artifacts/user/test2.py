import numpy as np
import soundfile as sf
import librosa

INPUT_PATH = "/home/user/input.wav"

N_FFT = 2048
N_MELS = 128

y, sr = librosa.load(INPUT_PATH, sr=None, mono=True)
ref_power = np.sum(y.astype(np.float64) ** 2)

for HL in [128, 256, 512]:
    M = librosa.feature.melspectrogram(
        y=y, sr=sr, n_fft=N_FFT, hop_length=HL, win_length=N_FFT, n_mels=N_MELS, power=2.0,
    )
    print(f"\n--- hop_length={HL}, mel shape={M.shape} ---")
    for NI in [32, 64, 128, 256]:
        y_rec = librosa.feature.inverse.mel_to_audio(
            M=M, sr=sr, n_fft=N_FFT, hop_length=HL, win_length=N_FFT,
            n_iter=NI, length=len(y),
        )
        noise = np.sum((y[:len(y_rec)] - y_rec).astype(np.float64) ** 2)
        snr = 10.0 * np.log10(ref_power / noise)
        # Also compute spectral convergence with hop_length=512
        S_ref = np.abs(librosa.stft(y[:len(y_rec)], n_fft=N_FFT, hop_length=512, win_length=N_FFT))
        S_rec = np.abs(librosa.stft(y_rec, n_fft=N_FFT, hop_length=512, win_length=N_FFT))
        sc = np.linalg.norm(S_ref - S_rec) / np.linalg.norm(S_ref)
        print(f"  n_iter={NI}: SNR={snr:.3f} dB, SC={sc:.4f}")
