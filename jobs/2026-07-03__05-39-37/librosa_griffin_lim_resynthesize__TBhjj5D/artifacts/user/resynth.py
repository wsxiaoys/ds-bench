#!/usr/bin/env python3
"""Mel spectrogram analysis + Griffin-Lim resynthesis pipeline."""
import json
import numpy as np
import librosa
import soundfile as sf

INPUT = "/home/user/input.wav"
OUTPUT = "/home/user/reconstructed.wav"
METRICS = "/home/user/metrics.json"

# --- Analysis / inversion parameters (must be consistent) ---
N_FFT = 2048
HOP_LENGTH = 512
WIN_LENGTH = N_FFT
N_MELS = 128
N_ITER = 64  # >= 32 required
POWER = 2.0   # power spectrogram (mel of power)

def main():
    # 1. Load input as mono at native sample rate.
    y, sr = librosa.load(INPUT, sr=None, mono=True)
    n_samples = len(y)

    # 2. Compute 128-band power mel spectrogram, then log-power form.
    mel_power = librosa.feature.melspectrogram(
        y=y, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH,
        win_length=WIN_LENGTH, power=POWER, n_mels=N_MELS,
    )
    # Log-power representation suitable for storage / downstream use.
    mel_log = librosa.power_to_db(mel_power, ref=1.0, amin=1e-10, top_db=None)

    # 3. Resynthesize from the mel representation.
    #    mel_to_audio expects the *power* mel spectrogram, so invert the dB mapping.
    mel_power_rec = librosa.db_to_power(mel_log, ref=1.0)
    # Guard against tiny negative round-trip values.
    mel_power_rec = np.maximum(mel_power_rec, 0.0)

    y_rec = librosa.feature.inverse.mel_to_audio(
        mel_power_rec, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH,
        win_length=WIN_LENGTH, power=POWER, n_iter=N_ITER,
        length=n_samples,
    )

    # 4. Write reconstructed mono waveform at the input sample rate.
    sf.write(OUTPUT, y_rec, sr, subtype="FLOAT")

    # Verify length match.
    info = sf.info(OUTPUT)
    rec_len = info.frames
    rec_sr = info.samplerate

    # 5. Align lengths for metric computation.
    L = min(len(y), len(y_rec))
    ref = y[:L].astype(np.float64)
    rec = y_rec[:L].astype(np.float64)

    # --- Spectral convergence ---
    STFT_ref = np.abs(librosa.stft(ref, n_fft=N_FFT, hop_length=HOP_LENGTH))
    STFT_rec = np.abs(librosa.stft(rec, n_fft=N_FFT, hop_length=HOP_LENGTH))
    spec_conv = float(np.linalg.norm(STFT_ref - STFT_rec, ord="fro")
                      / np.linalg.norm(STFT_ref, ord="fro"))

    # --- SNR (dB): 10*log10( sum(ref^2) / sum((ref-rec)^2) ) ---
    noise = ref - rec
    snr_db = float(10.0 * np.log10(np.sum(ref ** 2) / np.sum(noise ** 2)))

    metrics = {
        "spectral_convergence": spec_conv,
        "snr_db": snr_db,
        "length_samples": int(rec_len),
        "sample_rate": int(rec_sr),
        "n_mels": int(N_MELS),
        "n_iter": int(N_ITER),
    }

    with open(METRICS, "w") as f:
        json.dump(metrics, f, indent=2)

    print("Input samples :", n_samples, "sr:", sr)
    print("Recon samples :", rec_len, "sr:", rec_sr)
    print("Length diff   : {:.2f}%".format(abs(rec_len - n_samples) / n_samples * 100))
    print("Spec conv     :", spec_conv)
    print("SNR (dB)      :", snr_db)
    print("Metrics written to", METRICS)

if __name__ == "__main__":
    main()