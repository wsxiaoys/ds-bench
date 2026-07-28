import os
import argparse
import json
import numpy as np
import librosa

def synthesize_pitch_template(pitch, alpha=0.3, sr=22050, n_fft=2048, hop_length=512):
    """
    Synthesize a deterministic harmonic tone for a given MIDI pitch and compute its
    steady-state magnitude spectrum template.
    """
    f0 = 440.0 * (2.0 ** ((pitch - 69.0) / 12.0))
    # Synthesize 1.0 second of audio
    t = np.arange(0, 1.0, 1.0 / sr)
    y = np.zeros_like(t)
    
    # Synthesize harmonics up to the Nyquist frequency
    max_k = int((sr / 2.0) / f0)
    for k in range(1, max_k + 1):
        # Amplitude decay modeled as 1 / (k^alpha)
        amplitude = 1.0 / (k ** alpha)
        y += amplitude * np.sin(2 * np.pi * k * f0 * t)
        
    # Compute STFT magnitude
    D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    S = np.abs(D)
    
    # Extract steady-state middle frames to avoid any boundary transient smearing
    S_steady = S[:, 10:-10]
    template = np.mean(S_steady, axis=1)
    
    # L1 normalize the template column
    template /= np.sum(template) + 1e-8
    return template

def smooth_binary_roll(binary_roll, min_note_len=3, max_gap_len=2):
    """
    Perform temporal smoothing on the binary piano-roll:
    1. Fill short gaps (inactive frames) surrounded by active frames.
    2. Remove short spurious active segments.
    """
    smoothed = np.copy(binary_roll)
    num_pitches, n_frames = smoothed.shape
    for i in range(num_pitches):
        # 1. Fill small gaps (0s surrounded by 1s)
        row = smoothed[i, :]
        zeros_indices = np.where(row == 0)[0]
        if len(zeros_indices) > 0:
            gaps = []
            start = zeros_indices[0]
            for idx in range(1, len(zeros_indices)):
                if zeros_indices[idx] != zeros_indices[idx-1] + 1:
                    gaps.append((start, zeros_indices[idx-1]))
                    start = zeros_indices[idx]
            gaps.append((start, zeros_indices[-1]))
            
            for s, e in gaps:
                if s > 0 and e < n_frames - 1:
                    if (e - s + 1) <= max_gap_len:
                        smoothed[i, s:e+1] = 1
                        
        # 2. Remove short active segments (1s)
        row = smoothed[i, :]
        ones_indices = np.where(row == 1)[0]
        if len(ones_indices) > 0:
            runs = []
            start = ones_indices[0]
            for idx in range(1, len(ones_indices)):
                if ones_indices[idx] != ones_indices[idx-1] + 1:
                    runs.append((start, ones_indices[idx-1]))
                    start = ones_indices[idx]
            runs.append((start, ones_indices[-1]))
            
            for s, e in runs:
                if (e - s + 1) < min_note_len:
                    smoothed[i, s:e+1] = 0
                    
    return smoothed

def extract_notes(binary_roll, pitches, sr=22050, hop_length=512):
    """
    Extract note on/off segments from the smoothed binary piano-roll.
    Returns a sorted list of note events consistent with the piano-roll.
    """
    notes = []
    num_pitches, n_frames = binary_roll.shape
    for i in range(num_pitches):
        pitch = int(pitches[i])
        row = binary_roll[i, :]
        
        start = None
        for t in range(n_frames):
            if row[t] == 1 and start is None:
                start = t
            elif row[t] == 0 and start is not None:
                onset_time = start * hop_length / sr
                offset_time = t * hop_length / sr
                notes.append({
                    "pitch": pitch,
                    "onset_time": float(onset_time),
                    "offset_time": float(offset_time)
                })
                start = None
        if start is not None:
            onset_time = start * hop_length / sr
            offset_time = n_frames * hop_length / sr
            notes.append({
                "pitch": pitch,
                "onset_time": float(onset_time),
                "offset_time": float(offset_time)
            })
            
    # Sort notes by onset_time ascending, breaking ties by pitch ascending
    notes = sorted(notes, key=lambda x: (x["onset_time"], x["pitch"]))
    return notes

def main():
    parser = argparse.ArgumentParser(description="Template-Based Polyphonic Piano Transcription")
    parser.add_argument("--input", type=str, required=True, help="Path to the input WAV file")
    parser.add_argument("--output-dir", type=str, required=True, help="Directory to write output files")
    args = parser.parse_args()
    
    # 1. Load audio and peak normalize
    sr = 22050
    n_fft = 2048
    hop_length = 512
    
    y, _ = librosa.load(args.input, sr=sr, mono=True)
    y = y / (np.max(np.abs(y)) + 1e-8)
    
    # 2. Compute magnitude spectrogram
    V = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length))
    F, T = V.shape
    
    # 3. Construct fixed spectral templates W (MIDI 48 to 72 inclusive)
    pitches = np.arange(48, 73)
    num_pitches = len(pitches)
    
    W = np.zeros((F, num_pitches))
    for i, p in enumerate(pitches):
        W[:, i] = synthesize_pitch_template(p, alpha=0.3, sr=sr, n_fft=n_fft, hop_length=hop_length)
        
    # Add a flat noise template component to absorb broadband noise and transients
    noise_template = np.ones(F)
    noise_template /= np.sum(noise_template)
    W = np.hstack([W, noise_template[:, np.newaxis]])
    
    # 4. Initialize and run fixed-basis NMF updates
    H = np.ones((num_pitches + 1, T)) * 0.1
    num_iterations = 100
    for it in range(num_iterations):
        WH = np.dot(W, H) + 1e-10
        H *= np.dot(W.T, V / WH)
        
    # 5. Adaptive thresholding
    max_H = np.max(H[:num_pitches, :])
    threshold = max(125.0, min(180.0, 0.25 * max_H))
    
    binary_roll = (H[:num_pitches, :] > threshold).astype(int)
    
    # 6. Temporal smoothing
    binary_roll_smoothed = smooth_binary_roll(binary_roll, min_note_len=3, max_gap_len=2)
    
    # 7. Extract note segments
    notes = extract_notes(binary_roll_smoothed, pitches, sr=sr, hop_length=hop_length)
    
    # 8. Create output directory and write artifacts
    os.makedirs(args.output_dir, exist_ok=True)
    
    piano_roll_path = os.path.join(args.output_dir, "piano_roll.npy")
    notes_json_path = os.path.join(args.output_dir, "notes.json")
    
    np.save(piano_roll_path, binary_roll_smoothed.astype(np.int32))
    with open(notes_json_path, "w") as f:
        json.dump(notes, f, indent=2)
        
    print(f"Transcription complete!")
    print(f"Saved piano roll to {piano_roll_path} (shape: {binary_roll_smoothed.shape})")
    print(f"Saved note list to {notes_json_path} (total notes: {len(notes)})")

if __name__ == "__main__":
    main()
