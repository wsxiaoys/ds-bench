import librosa
import numpy as np
import json

def main():
    # 1. Load the input WAV file
    input_path = '/home/user/input.wav'
    y, sr = librosa.load(input_path, sr=None)
    duration = librosa.get_duration(y=y, sr=sr)
    
    # 2. HPSS to isolate the percussive component
    # librosa.effects.hpss returns (harmonic, percussive)
    _, y_percussive = librosa.effects.hpss(y)
    
    # 3. Define a single hop_length for consistency
    hop_length = 512
    
    # 4. Calculate onset strength envelope on the percussive component
    onset_env = librosa.onset.onset_strength(y=y_percussive, sr=sr, hop_length=hop_length)
    
    # 5. Detect onsets using peak picking on the onset strength envelope
    # We use librosa.onset.onset_detect which accepts keyword arguments for peak_pick
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length)
    
    # 6. Recover global tempo (BPM) from beat tracking on the percussive component
    tempo_arr, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
    if hasattr(tempo_arr, '__len__'):
        tempo = float(tempo_arr[0])
    else:
        tempo = float(tempo_arr)
        
    # 7. Derive the 16th-note grid spacing
    step = 60.0 / tempo / 4.0
    
    # 8. Snap each onset to the nearest 16th-note grid position within the audio duration
    max_grid_index = int(np.floor(duration / step))
    
    # 9. Estimate per-hit velocity from the local onset envelope amplitude
    # Sample the onset strength envelope at each detected onset frame
    amplitudes = onset_env[onset_frames]
    
    # Rescale amplitudes so maximum is 1.0, while maintaining relative ratios
    max_amp = np.max(amplitudes)
    velocities = amplitudes / max_amp
    
    # 10. Build the hit objects
    hits = []
    for i, raw_time in enumerate(onset_times):
        grid_index = round(raw_time / step)
        if grid_index > max_grid_index:
            grid_index = max_grid_index
        snapped_time = grid_index * step
        
        hit_obj = {
            "time_seconds": float(snapped_time),
            "grid_index": int(grid_index),
            "velocity": float(velocities[i]),
            "raw_time_seconds": float(raw_time)
        }
        hits.append(hit_obj)
        
    # 11. Write output to /home/user/hits.json
    output_data = {
        "hits": hits,
        "_metadata": {
            "estimated_tempo": float(tempo)
        }
    }
    
    with open('/home/user/hits.json', 'w') as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Successfully processed {len(hits)} hits.")
    print(f"Estimated tempo: {tempo:.2f} BPM")
    print(f"16th-note step: {step:.4f} seconds")
    print(f"Max grid index: {max_grid_index}")

if __name__ == '__main__':
    main()
