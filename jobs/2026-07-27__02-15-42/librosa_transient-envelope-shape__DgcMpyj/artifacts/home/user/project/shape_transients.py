import argparse
import json
import os
import numpy as np
import librosa
import soundfile as sf

def detect_transients(y, sr, hop_length=512):
    """
    Detects percussive transients (onsets) and backtracks each detected onset
    to the preceding local minimum of the onset-strength envelope.
    Returns a sorted list of unique sample indices.
    """
    N = len(y)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, onset_envelope=onset_env, backtrack=True, hop_length=hop_length)
    onset_samples = librosa.frames_to_samples(onset_frames, hop_length=hop_length)
    
    # Filter and sort onset samples
    onset_samples = sorted(list(set(s for s in onset_samples if 0 <= s < N)))
    return onset_samples

def build_gain_envelope(N, sr, onset_samples, attack_ms, crossfade_ms, attack_gain_db, sustain_gain_db):
    """
    Builds a per-sample gain envelope with smooth, click-free crossfades at region boundaries.
    """
    # Calculate attack and crossfade lengths in samples
    attack_len = int(round(attack_ms / 1000.0 * sr))
    cross_len = int(round(crossfade_ms / 1000.0 * sr))
    
    # Build region map
    is_attack = np.zeros(N, dtype=bool)
    for s in onset_samples:
        is_attack[s : min(s + attack_len, N)] = True
        
    # Calculate linear gains
    g_attack = 10.0 ** (attack_gain_db / 20.0)
    g_sustain = 10.0 ** (sustain_gain_db / 20.0)
    
    # Initialize gain envelope
    g = np.where(is_attack, g_attack, g_sustain)
    
    # Find boundaries and apply click-free crossfades
    boundaries = [i for i in range(1, N) if is_attack[i] != is_attack[i-1]]
    p = len(boundaries)
    
    for j in range(p):
        B = boundaries[j]
        D_left = B - boundaries[j-1] if j > 0 else B
        D_right = boundaries[j+1] - B if j < p - 1 else N - 1 - B
        
        left_radius = min(cross_len, D_left // 2)
        right_radius = min(cross_len, D_right // 2)
        
        g_prev = g_sustain if is_attack[B] else g_attack
        g_next = g_attack if is_attack[B] else g_sustain
        g_mid = (g_prev + g_next) / 2.0
        
        if left_radius > 0:
            # Left crossfade
            x_left = np.arange(B - left_radius, B + 1)
            t_left = (x_left - (B - left_radius)) / left_radius
            g[x_left] = g_prev + (g_mid - g_prev) * (0.5 - 0.5 * np.cos(np.pi * t_left))
            
        if right_radius > 0:
            # Right crossfade
            x_right = np.arange(B, B + right_radius + 1)
            t_right = (x_right - B) / right_radius
            g[x_right] = g_mid + (g_next - g_mid) * (0.5 - 0.5 * np.cos(np.pi * t_right))
            
    return g

def main():
    parser = argparse.ArgumentParser(description="Transient Detection & Envelope Shaper")
    parser.add_argument("--input", required=True, help="Path to input mono WAV file")
    parser.add_argument("--output", required=True, help="Path to output shaped WAV file")
    parser.add_argument("--report", required=True, help="Path to JSON report file")
    parser.add_argument("--attack-gain-db", type=float, required=True, help="Gain in dB for attack region")
    parser.add_argument("--sustain-gain-db", type=float, required=True, help="Gain in dB for sustain region")
    parser.add_argument("--attack-ms", type=float, required=True, help="Attack region length in milliseconds")
    parser.add_argument("--crossfade-ms", type=float, required=True, help="Crossfade half-width in milliseconds")
    
    args = parser.parse_args()
    
    # 1. Load the input mono WAV file
    y, sr = librosa.load(args.input, sr=None, mono=True)
    N = len(y)
    
    # 2. Detect transients and backtrack
    onset_samples = detect_transients(y, sr)
    
    # 3. Build gain envelope
    g = build_gain_envelope(
        N=N,
        sr=sr,
        onset_samples=onset_samples,
        attack_ms=args.attack_ms,
        crossfade_ms=args.crossfade_ms,
        attack_gain_db=args.attack_gain_db,
        sustain_gain_db=args.sustain_gain_db
    )
    
    # 4. Apply gain envelope and clip to stay within [-1.0, 1.0]
    y_out = y * g
    y_out = np.clip(y_out, -1.0, 1.0)
    
    # 5. Write the shaped WAV file
    sf.write(args.output, y_out, sr)
    
    # 6. Write the JSON report
    onsets_report = []
    for s in onset_samples:
        onset_time = float(s) / sr
        onsets_report.append({
            "onset_time": onset_time,
            "attack_gain_db": args.attack_gain_db,
            "sustain_gain_db": args.sustain_gain_db
        })
        
    report = {
        "sample_rate": int(sr),
        "num_transients": len(onsets_report),
        "attack_gain_db": args.attack_gain_db,
        "sustain_gain_db": args.sustain_gain_db,
        "onsets": onsets_report
    }
    
    with open(args.report, "w") as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    main()
