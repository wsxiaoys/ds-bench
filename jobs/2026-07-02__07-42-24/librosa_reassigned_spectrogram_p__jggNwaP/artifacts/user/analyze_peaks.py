#!/usr/bin/env python3
import os
import json
import numpy as np
import librosa

def analyze_peaks():
    # 1. Read input audio file
    audio_path = "/home/user/input.wav"
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Input audio file not found at {audio_path}")
        
    y, sr = librosa.load(audio_path, sr=None)
    audio_duration = librosa.get_duration(y=y, sr=sr)
    
    # 2. Parameters
    n_fft = 2048
    hop_length = 512
    
    # 3. Compute the reassigned spectrogram
    # freqs, times, mags are shape (1 + n_fft/2, n_frames)
    freqs, times, mags = librosa.reassigned_spectrogram(
        y, 
        sr=sr, 
        n_fft=n_fft, 
        hop_length=hop_length
    )
    
    # 4. Convert linear amplitude magnitudes to dB
    mags_db = librosa.amplitude_to_db(mags)
    
    # 5. Get frame times
    n_frames = freqs.shape[1]
    frame_times = librosa.frames_to_time(
        np.arange(n_frames), 
        sr=sr, 
        hop_length=hop_length
    )
    
    # 6. Process each frame
    frames_list = []
    for t in range(n_frames):
        f_hz = freqs[:, t]
        t_sec = times[:, t]
        m_db = mags_db[:, t]
        
        # Filter for valid peaks:
        # - freq_hz, t_sec, m_db must be finite (not NaN, not Inf)
        # - freq_hz must be in (0.0, sr/2]
        valid_mask = (
            np.isfinite(f_hz) & 
            np.isfinite(t_sec) & 
            np.isfinite(m_db) & 
            (f_hz > 0.0) & 
            (f_hz <= sr / 2.0)
        )
        
        valid_f = f_hz[valid_mask]
        valid_m = m_db[valid_mask]
        
        # Sort in descending order of magnitude_db
        sort_idx = np.argsort(valid_m)[::-1]
        sorted_f = valid_f[sort_idx]
        sorted_m = valid_m[sort_idx]
        
        # We need exactly 5 peaks.
        # If there are fewer than 5 valid peaks (extremely unlikely, but for safety),
        # pad with default values.
        peaks = []
        for i in range(5):
            if i < len(sorted_f):
                freq_val = float(sorted_f[i])
                mag_val = float(sorted_m[i])
            else:
                # Fallback / padding if less than 5 valid peaks (not expected to be reached)
                freq_val = 1.0
                mag_val = -100.0
            peaks.append({
                "freq_hz": freq_val,
                "magnitude_db": mag_val
            })
            
        # Ensure frame time is a finite float
        f_time = float(frame_times[t])
        
        frames_list.append({
            "time": f_time,
            "peaks": peaks
        })
        
    # 7. Construct final JSON structure
    output_data = {
        "meta": {
            "n_frames": int(n_frames),
            "sr": int(sr),
            "n_fft": int(n_fft),
            "hop_length": int(hop_length)
        },
        "frames": frames_list
    }
    
    # 8. Write to /home/user/peaks.json
    output_path = "/home/user/peaks.json"
    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Successfully wrote peak analysis to {output_path}")
    print(f"Total frames: {n_frames}")
    print(f"Audio duration: {audio_duration:.4f} s")
    print(f"First frame time: {frames_list[0]['time']:.4f} s")
    print(f"Last frame time: {frames_list[-1]['time']:.4f} s")

if __name__ == "__main__":
    analyze_peaks()
