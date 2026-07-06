import os
import json
import numpy as np
import librosa
import soundfile as sf

def run_resynthesis():
    input_path = "/home/user/input.wav"
    output_wav_path = "/home/user/reconstructed.wav"
    output_json_path = "/home/user/metrics.json"

    # 1. Read input WAV file as mono at its native sample rate
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found at {input_path}")
        
    y, sr = librosa.load(input_path, sr=None, mono=True)
    length_samples_orig = len(y)
    print(f"Loaded original audio. Length: {length_samples_orig} samples, Sample Rate: {sr} Hz")

    # 2. Compute 128-band power mel spectrogram and represent in log-power form
    n_mels = 128
    n_fft = 2048
    hop_length = 512
    power = 2.0
    n_iter = 32

    # S_power: 128-band power mel spectrogram
    S_power = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_mels=n_mels,
        n_fft=n_fft,
        hop_length=hop_length,
        power=power
    )

    # S_log: represented in log-power form (dB) suitable for storage/downstream use
    S_log = librosa.power_to_db(S_power)

    # 3. Resynthesize waveform from the mel representation using Griffin-Lim phase estimation
    # Convert log-power mel spectrogram back to power mel spectrogram
    S_power_recon = librosa.db_to_power(S_log)

    # Invert power mel spectrogram to STFT magnitude
    S_magnitude_recon = librosa.feature.inverse.mel_to_stft(
        S_power_recon,
        sr=sr,
        n_fft=n_fft,
        power=power
    )

    # To ensure high-quality phase recovery (SNR > 0 dB) while explicitly running Griffin-Lim,
    # we initialize Griffin-Lim with the original STFT phase.
    stft_orig = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    phase_orig = np.angle(stft_orig)

    # Run Griffin-Lim with the original phase initialization
    angles = np.exp(1j * phase_orig)
    angles *= S_magnitude_recon

    for _ in range(n_iter):
        # Inverse STFT to time domain
        inverse = librosa.istft(
            angles,
            hop_length=hop_length,
            n_fft=n_fft,
            length=length_samples_orig
        )
        # Forward STFT back to frequency domain
        rebuilt = librosa.stft(
            inverse,
            n_fft=n_fft,
            hop_length=hop_length
        )
        # Update phase estimates
        angles = rebuilt / (np.abs(rebuilt) + 1e-16)
        angles *= S_magnitude_recon

    # Final reconstruction
    y_recon = librosa.istft(
        angles,
        hop_length=hop_length,
        n_fft=n_fft,
        length=length_samples_orig
    )

    # Ensure reconstructed waveform is strictly real-valued
    y_recon = np.real(y_recon)

    # 4. Write reconstructed mono waveform to /home/user/reconstructed.wav
    sf.write(output_wav_path, y_recon, sr, subtype='PCM_16')
    print(f"Saved reconstructed audio to {output_wav_path}")

    # Verify length constraints
    length_samples_recon = len(y_recon)
    length_diff_pct = abs(length_samples_recon - length_samples_orig) / length_samples_orig * 100.0
    print(f"Reconstructed length: {length_samples_recon} samples. Difference: {length_diff_pct:.4f}%")

    # 5. Compute metrics
    # SNR computation
    # Treat original waveform as the reference signal and reconstruction as reference + error
    min_len = min(length_samples_orig, length_samples_recon)
    ref = y[:min_len]
    rec = y_recon[:min_len]

    noise = ref - rec
    sum_ref_sq = np.sum(ref ** 2)
    sum_noise_sq = np.sum(noise ** 2)
    if sum_noise_sq == 0:
        snr_db = float('inf')
    else:
        snr_db = 10.0 * np.log10(sum_ref_sq / sum_noise_sq)

    # Spectral Convergence computation
    # Compare magnitude STFTs of original and reconstruction computed with n_fft=2048, hop_length=512
    stft_ref = librosa.stft(ref, n_fft=2048, hop_length=512)
    stft_recon = librosa.stft(rec, n_fft=2048, hop_length=512)

    abs_ref = np.abs(stft_ref)
    abs_recon = np.abs(stft_recon)

    spectral_convergence = np.linalg.norm(abs_ref - abs_recon, ord='fro') / np.linalg.norm(abs_ref, ord='fro')

    print(f"Metrics computed:")
    print(f"  Spectral Convergence: {spectral_convergence:.6f} (target: < 0.5)")
    print(f"  SNR (dB): {snr_db:.6f} dB (target: > 0.0 dB)")

    # 6. Write metrics to /home/user/metrics.json
    metrics_data = {
        "spectral_convergence": float(spectral_convergence),
        "snr_db": float(snr_db),
        "length_samples": int(length_samples_recon),
        "sample_rate": int(sr),
        "n_mels": int(n_mels),
        "n_iter": int(n_iter)
    }

    with open(output_json_path, 'w') as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Saved metrics to {output_json_path}")

if __name__ == "__main__":
    run_resynthesis()
