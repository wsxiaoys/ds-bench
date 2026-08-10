#!/usr/bin/env python3
import argparse
import os
import json
import numpy as np
import librosa
import soundfile as sf

def phase_vocoder_transient(D, rate, hop_length, transient_frames, n_fft):
    """
    Transient-preserving phase vocoder for time-stretching an STFT matrix D.
    
    Parameters:
    -----------
    D : np.ndarray
        The input STFT matrix of shape (d, t).
    rate : float
        The speed-up factor (rate > 1 speeds up, rate < 1 slows down).
    hop_length : int
        The hop length in samples.
    transient_frames : np.ndarray
        Array of input frame indices containing transient events.
    n_fft : int
        The FFT size.
        
    Returns:
    --------
    D_stretched : np.ndarray
        The time-stretched STFT matrix.
    """
    time_steps = np.arange(0, D.shape[-1], rate, dtype=np.float64)

    # Create an empty output array
    shape = list(D.shape)
    shape[-1] = len(time_steps)
    d_stretch = np.zeros_like(D, shape=shape)

    # Expected phase advance in each bin per frame
    phi_advance = hop_length * librosa.fft_frequencies(sr=2 * np.pi, n_fft=n_fft)

    # Phase accumulator; initialize to the first sample
    phase_acc = np.angle(D[..., 0])

    # Pad 2 columns to simplify boundary logic
    padding = [(0, 0) for _ in D.shape]
    padding[-1] = (0, 2)
    D_padded = np.pad(D, padding, mode="constant")

    # Map each transient frame to an output frame index
    reset_map = {}
    for k in transient_frames:
        t_k = int(np.round(k / rate))
        if 0 <= t_k < len(time_steps):
            reset_map[t_k] = k

    for t, step in enumerate(time_steps):
        i = int(step)
        
        if t in reset_map:
            # We are EXACTLY at the transient frame!
            k = reset_map[t]
            phase_acc = np.angle(D_padded[..., k])
            mag = np.abs(D_padded[..., k])
        else:
            # Check if the next input frame is a transient frame to prevent pre-echo
            columns = D_padded[..., i : i + 2]
            if (i + 1) in transient_frames and t < int(np.round((i + 1) / rate)):
                # Next frame is transient, but we haven't reached its output frame yet.
                # Do not interpolate magnitude towards the transient frame.
                # Use only the magnitude of the current non-transient frame i.
                mag = np.abs(columns[..., 0])
            else:
                alpha = np.mod(step, 1.0)
                mag = (1.0 - alpha) * np.abs(columns[..., 0]) + alpha * np.abs(columns[..., 1])
            
        # Store to output array
        d_stretch[..., t] = librosa.util.phasor(phase_acc, mag=mag)
        
        # Compute phase advance for next frame
        if t in reset_map:
            k = reset_map[t]
            columns = D_padded[..., k : k + 2]
            dphase = np.angle(columns[..., 1]) - np.angle(columns[..., 0]) - phi_advance
        else:
            dphase = np.angle(columns[..., 1]) - np.angle(columns[..., 0]) - phi_advance
            
        # Wrap to -pi:pi range
        dphase = dphase - 2.0 * np.pi * np.round(dphase / (2.0 * np.pi))
        
        # Accumulate phase
        phase_acc += phi_advance + dphase

    return d_stretch

def main():
    parser = argparse.ArgumentParser(description="Transient-Preserving Phase-Vocoder Time-Stretch and Pitch-Shift")
    parser.add_argument("--input", required=True, help="Path to input mono WAV file")
    parser.add_argument("--output-dir", required=True, help="Path to directory where outputs will be saved")
    args = parser.parse_args()

    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)

    # 1. Read input mono WAV file
    # Ensure it is loaded as mono and at its original sample rate
    y, sr = librosa.load(args.input, sr=None, mono=True)
    input_duration = len(y) / sr

    # Fixed parameters
    hop_length = 512
    n_fft = 2048
    stretch_factor = 1.5
    pitch_shift_semitones = 7

    # 2. Detect transients in the input signal using hop length 512
    transient_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop_length)
    transient_frames = np.sort(transient_frames)
    transient_times = transient_frames * hop_length / sr

    # Compute STFT of input
    D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)

    # 3. Time-stretched rendering (stretch factor = 1.5)
    # Stretch factor of 1.5 means it plays 1.5x longer / slower, so rate = 1 / 1.5
    rate_stretch = 1.0 / stretch_factor
    D_stretched = phase_vocoder_transient(D, rate_stretch, hop_length, transient_frames, n_fft)
    
    # Reconstruct time-stretched signal using ISTFT
    target_len_stretched = int(np.round(len(y) * stretch_factor))
    y_stretched = librosa.istft(D_stretched, hop_length=hop_length, length=target_len_stretched)
    
    # Write stretched.wav
    stretched_path = os.path.join(args.output_dir, "stretched.wav")
    sf.write(stretched_path, y_stretched, sr)
    stretched_duration = len(y_stretched) / sr

    # 4. Pitch-shifted rendering of +7 semitones (duration unchanged)
    # Raise pitch by +7 semitones means frequency ratio is 2^(7/12)
    ratio = 2.0 ** (pitch_shift_semitones / 12.0)
    
    # To shift pitch by +7 semitones without changing duration:
    # First, time-stretch the signal by a factor equal to the ratio (making it longer),
    # then resample it back to the original sample rate (speeding it up by ratio,
    # which restores the original duration and raises the pitch).
    rate_shift = 1.0 / ratio
    D_shifted_stretched = phase_vocoder_transient(D, rate_shift, hop_length, transient_frames, n_fft)
    
    target_len_shifted_stretched = int(np.round(len(y) * ratio))
    y_shifted_stretched = librosa.istft(D_shifted_stretched, hop_length=hop_length, length=target_len_shifted_stretched)
    
    # Resample back to original sample rate to change pitch and restore original duration
    y_shifted = librosa.resample(y_shifted_stretched, orig_sr=sr * ratio, target_sr=sr)
    
    # Ensure exact length matching the input duration (within a few milliseconds/samples)
    if len(y_shifted) < len(y):
        y_shifted = np.pad(y_shifted, (0, len(y) - len(y_shifted)))
    elif len(y_shifted) > len(y):
        y_shifted = y_shifted[:len(y)]
        
    # Write shifted.wav
    shifted_path = os.path.join(args.output_dir, "shifted.wav")
    sf.write(shifted_path, y_shifted, sr)
    shifted_duration = len(y_shifted) / sr

    # 5. Create and write JSON analysis report
    analysis = {
        "sample_rate": int(sr),
        "stretch_factor": float(stretch_factor),
        "pitch_shift_semitones": float(pitch_shift_semitones),
        "input_duration_seconds": float(input_duration),
        "stretched_duration_seconds": float(stretched_duration),
        "shifted_duration_seconds": float(shifted_duration),
        "transient_frames": [int(f) for f in transient_frames],
        "transient_times_seconds": [float(t) for t in transient_times]
    }

    analysis_path = os.path.join(args.output_dir, "analysis.json")
    with open(analysis_path, "w") as f:
        json.dump(analysis, f, indent=4)

    print("Processing complete.")
    print(f"Stretched duration: {stretched_duration:.4f}s")
    print(f"Shifted duration: {shifted_duration:.4f}s")
    print(f"Detected {len(transient_frames)} transients.")

if __name__ == "__main__":
    main()
