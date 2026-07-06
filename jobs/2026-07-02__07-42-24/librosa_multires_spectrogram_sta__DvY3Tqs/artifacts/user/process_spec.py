import librosa
import numpy as np
import json

def main():
    # 1. Load audio
    input_path = '/home/user/input.wav'
    print(f"Loading audio from {input_path}...")
    y, sr = librosa.load(input_path, sr=None)
    print(f"Loaded audio: sample_rate={sr}, shape={y.shape}")

    # 2. Define parameters
    hop_length = 512
    n_fft = 2048
    cqt_n_bins = 84
    cqt_bins_per_octave = 12
    vqt_n_bins = 84
    vqt_bins_per_octave = 12
    fmin = librosa.note_to_hz('C1')

    print(f"Parameters: hop_length={hop_length}, n_fft={n_fft}")
    print(f"CQT parameters: n_bins={cqt_n_bins}, bins_per_octave={cqt_bins_per_octave}, fmin={fmin}")
    print(f"VQT parameters: n_bins={vqt_n_bins}, bins_per_octave={vqt_bins_per_octave}, fmin={fmin}")

    # 3. Compute transforms
    # STFT
    print("Computing STFT...")
    stft_complex = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    stft_mag = np.abs(stft_complex)
    stft_db = librosa.amplitude_to_db(stft_mag)
    print(f"STFT computed: shape={stft_db.shape}")

    # CQT
    print("Computing CQT...")
    cqt_complex = librosa.cqt(
        y,
        sr=sr,
        hop_length=hop_length,
        fmin=fmin,
        n_bins=cqt_n_bins,
        bins_per_octave=cqt_bins_per_octave,
        tuning=0.0
    )
    cqt_mag = np.abs(cqt_complex)
    cqt_db = librosa.amplitude_to_db(cqt_mag)
    print(f"CQT computed: shape={cqt_db.shape}")

    # VQT
    print("Computing VQT...")
    vqt_complex = librosa.vqt(
        y,
        sr=sr,
        hop_length=hop_length,
        fmin=fmin,
        n_bins=vqt_n_bins,
        bins_per_octave=vqt_bins_per_octave,
        tuning=0.0,
        intervals='equal'
    )
    vqt_mag = np.abs(vqt_complex)
    vqt_db = librosa.amplitude_to_db(vqt_mag)
    print(f"VQT computed: shape={vqt_db.shape}")

    # Verify frame sizes
    n_frames_stft = stft_db.shape[1]
    n_frames_cqt = cqt_db.shape[1]
    n_frames_vqt = vqt_db.shape[1]

    assert n_frames_stft == n_frames_cqt == n_frames_vqt, f"Frame sizes do not match! {n_frames_stft}, {n_frames_cqt}, {n_frames_vqt}"
    n_frames = n_frames_stft
    print(f"All transforms have matching frame count: {n_frames}")

    # 4. Generate frequency vectors
    stft_freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    cqt_freqs = librosa.cqt_frequencies(
        n_bins=cqt_n_bins,
        fmin=fmin,
        bins_per_octave=cqt_bins_per_octave,
        tuning=0.0
    )
    vqt_freqs = librosa.interval_frequencies(
        n_bins=vqt_n_bins,
        fmin=fmin,
        intervals='equal',
        bins_per_octave=vqt_bins_per_octave,
        tuning=0.0
    )

    # 5. Save .npz file
    npz_path = '/home/user/spec_stack.npz'
    print(f"Saving .npz archive to {npz_path}...")
    np.savez(
        npz_path,
        stft_db=stft_db,
        cqt_db=cqt_db,
        vqt_db=vqt_db
    )

    # 6. Save metadata JSON
    metadata = {
        "n_frames": int(n_frames),
        "hop_length": int(hop_length),
        "sample_rate": int(sr),
        "stft_freqs": [float(f) for f in stft_freqs],
        "cqt_freqs": [float(f) for f in cqt_freqs],
        "vqt_freqs": [float(f) for f in vqt_freqs],
        "n_fft": int(n_fft),
        "cqt_n_bins": int(cqt_n_bins),
        "cqt_bins_per_octave": int(cqt_bins_per_octave),
        "vqt_n_bins": int(vqt_n_bins),
        "vqt_bins_per_octave": int(vqt_bins_per_octave)
    }

    json_path = '/home/user/spec_meta.json'
    print(f"Saving JSON metadata to {json_path}...")
    with open(json_path, 'w') as f:
        json.dump(metadata, f, indent=4)

    print("Processing completed successfully!")

if __name__ == '__main__':
    main()
