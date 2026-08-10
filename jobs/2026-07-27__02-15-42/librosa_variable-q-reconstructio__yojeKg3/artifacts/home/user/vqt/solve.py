import os
import json
import numpy as np
import librosa
import soundfile as sf

def main():
    # 1. Load the input clip
    input_path = "/home/user/vqt/input/signal.wav"
    y, sr = librosa.load(input_path, sr=22050)
    
    # 2. Compute Variable-Q Transform (VQT)
    fmin = librosa.note_to_hz('C1')
    bins_per_octave = 36
    n_bins = 252
    gamma = 3.0
    hop_length = 512
    
    V = librosa.vqt(
        y,
        sr=sr,
        fmin=fmin,
        bins_per_octave=bins_per_octave,
        n_bins=n_bins,
        gamma=gamma,
        hop_length=hop_length
    )
    
    # 3. Save VQT magnitude
    vqt_mag = np.abs(V)
    os.makedirs("/home/user/vqt/output", exist_ok=True)
    np.save("/home/user/vqt/output/vqt_magnitude.npy", vqt_mag)
    
    # 4. Reconstruct time-domain waveform
    y_hat = librosa.icqt(
        V,
        sr=sr,
        fmin=fmin,
        bins_per_octave=bins_per_octave,
        hop_length=hop_length,
        length=len(y)
    )
    
    # Save the reconstructed waveform
    sf.write("/home/user/vqt/output/reconstructed.wav", y_hat, sr)
    
    # 5. Compute SNR
    noise = y - y_hat
    snr_db = 10 * np.log10(np.sum(y**2) / np.sum(noise**2))
    
    # 6. Produce JSON report
    report = {
        "snr_db": float(snr_db),
        "vqt_shape": [int(V.shape[0]), int(V.shape[1])]
    }
    
    with open("/home/user/vqt/output/report.json", "w") as f:
        json.dump(report, f, indent=4)
        
    print(f"Reconstruction SNR: {snr_db:.4f} dB")
    print(f"VQT shape: {V.shape}")

if __name__ == "__main__":
    main()
