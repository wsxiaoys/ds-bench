#!/usr/bin/env python3
import json
import numpy as np
import os

def verify_peaks_json():
    json_path = "/home/user/peaks.json"
    audio_duration = 5.0  # From audio loading
    sr = 22050
    
    if not os.path.exists(json_path):
        print("FAIL: JSON file does not exist.")
        return False
        
    try:
        with open(json_path, "r") as f:
            data = json.load(f)
    except Exception as e:
        print(f"FAIL: Failed to parse JSON: {e}")
        return False
        
    print("Verifying JSON structure and values...")
    
    # Check meta
    if "meta" not in data:
        print("FAIL: 'meta' key missing.")
        return False
        
    meta = data["meta"]
    for key in ["n_frames", "sr", "n_fft", "hop_length"]:
        if key not in meta:
            print(f"FAIL: meta key '{key}' missing.")
            return False
            
    if meta["sr"] != sr:
        print(f"FAIL: meta.sr is {meta['sr']}, expected {sr}")
        return False
        
    if meta["n_fft"] != 2048:
        print(f"FAIL: meta.n_fft is {meta['n_fft']}, expected 2048")
        return False
        
    if meta["hop_length"] != 512:
        print(f"FAIL: meta.hop_length is {meta['hop_length']}, expected 512")
        return False
        
    if "frames" not in data:
        print("FAIL: 'frames' key missing.")
        return False
        
    frames = data["frames"]
    if len(frames) != meta["n_frames"]:
        print(f"FAIL: len(frames) is {len(frames)}, but meta.n_frames is {meta['n_frames']}")
        return False
        
    print(f"Number of frames: {len(frames)}")
    
    prev_time = -1.0
    for idx, frame in enumerate(frames):
        if "time" not in frame or "peaks" not in frame:
            print(f"FAIL: Frame {idx} missing 'time' or 'peaks'.")
            return False
            
        t = frame["time"]
        if not np.isfinite(t):
            print(f"FAIL: Frame {idx} time is not finite: {t}")
            return False
            
        if t < prev_time:
            print(f"FAIL: Frame {idx} time is not monotonically non-decreasing: {t} < {prev_time}")
            return False
        prev_time = t
        
        if t < 0.0 or t > audio_duration + 1e-2:
            print(f"FAIL: Frame {idx} time {t} is out of bounds [0, {audio_duration + 1e-2}]")
            return False
            
        peaks = frame["peaks"]
        if len(peaks) != 5:
            print(f"FAIL: Frame {idx} has {len(peaks)} peaks, expected exactly 5.")
            return False
            
        prev_mag = float('inf')
        for p_idx, peak in enumerate(peaks):
            if "freq_hz" not in peak or "magnitude_db" not in peak:
                print(f"FAIL: Frame {idx} Peak {p_idx} missing 'freq_hz' or 'magnitude_db'.")
                return False
                
            freq = peak["freq_hz"]
            mag = peak["magnitude_db"]
            
            if not np.isfinite(freq):
                print(f"FAIL: Frame {idx} Peak {p_idx} freq is not finite: {freq}")
                return False
                
            if freq <= 0.0 or freq > sr / 2.0:
                print(f"FAIL: Frame {idx} Peak {p_idx} freq {freq} is out of bounds (0.0, {sr/2.0}]")
                return False
                
            if not np.isfinite(mag):
                print(f"FAIL: Frame {idx} Peak {p_idx} magnitude is not finite: {mag}")
                return False
                
            if mag > prev_mag:
                print(f"FAIL: Frame {idx} Peak {p_idx} magnitude {mag} is greater than previous peak magnitude {prev_mag} (not sorted descending)")
                return False
            prev_mag = mag
            
    # Check last frame time within 0.1 s of audio duration
    last_time = frames[-1]["time"]
    if abs(last_time - audio_duration) > 0.1:
        print(f"FAIL: Last frame time {last_time} is not within 0.1 s of audio duration {audio_duration}")
        return False
        
    print("SUCCESS: All checks passed!")
    return True

if __name__ == "__main__":
    verify_peaks_json()
