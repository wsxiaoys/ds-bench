import json
import librosa
import numpy as np

def main():
    # Define paths and parameters
    input_wav_path = "/home/user/input.wav"
    output_npz_path = "/home/user/beat_mfcc.npz"
    output_json_path = "/home/user/beats.json"
    hop_length = 512
    n_mfcc = 20

    # Load WAV file
    y, sr = librosa.load(input_wav_path, sr=None)

    # Estimate tempo and beat frame indices
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop_length)

    # Fix frames to ensure they span from 0
    beats_fixed = librosa.util.fix_frames(beats)

    # Compute MFCCs at the same hop length
    mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop_length, n_mfcc=n_mfcc)

    # Aggregate MFCC matrix to one column per beat interval using median aggregation
    mfcc_sync = librosa.util.sync(mfcc, beats_fixed, aggregate=np.median)

    # Convert beat frame indices to seconds
    beat_times_seconds_arr = librosa.frames_to_time(beats_fixed, sr=sr, hop_length=hop_length)
    beat_times_seconds = [float(t) for t in beat_times_seconds_arr]

    # Verify that beat times are strictly increasing
    assert all(x < y for x, y in zip(beat_times_seconds, beat_times_seconds[1:])), "Beat times are not strictly increasing!"

    # Verify that beat times lie within the audio duration bounds
    duration = librosa.get_duration(y=y, sr=sr)
    assert all(0 <= t <= duration for t in beat_times_seconds), "Beat times are out of audio duration bounds!"

    # Verify resulting column count against len(beat_times_seconds)
    n_beat_intervals = mfcc_sync.shape[1]
    assert n_beat_intervals == len(beat_times_seconds) or n_beat_intervals == len(beat_times_seconds) - 1, (
        f"Mismatch: n_beat_intervals={n_beat_intervals}, len(beat_times_seconds)={len(beat_times_seconds)}"
    )

    # Save synchronized matrix to npz file under the key 'mfcc_sync'
    np.savez(output_npz_path, mfcc_sync=mfcc_sync)

    # Reduce tempo to a scalar
    tempo_bpm = float(tempo[0])

    # Save beat metadata to json file
    metadata = {
        "tempo_bpm": tempo_bpm,
        "beat_times_seconds": beat_times_seconds,
        "hop_length": int(hop_length),
        "sample_rate": int(sr),
        "n_mfcc": int(n_mfcc)
    }

    with open(output_json_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print("Success! Generated files:")
    print(f"  NPZ: {output_npz_path}")
    print(f"  JSON: {output_json_path}")
    print(f"  Tempo: {tempo_bpm:.2f} BPM")
    print(f"  Number of beat intervals: {n_beat_intervals}")
    print(f"  Number of beat times: {len(beat_times_seconds)}")

if __name__ == "__main__":
    main()
