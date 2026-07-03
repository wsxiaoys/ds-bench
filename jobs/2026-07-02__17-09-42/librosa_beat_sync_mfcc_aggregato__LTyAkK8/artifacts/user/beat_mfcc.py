"""Beat-synchronous MFCC summarizer using librosa 0.11."""

import json
from pathlib import Path

import librosa
import numpy as np


INPUT_WAV = Path("/home/user/input.wav")
OUTPUT_NPZ = Path("/home/user/beat_mfcc.npz")
OUTPUT_JSON = Path("/home/user/beats.json")

HOP_LENGTH = 512
N_MFCC = 20


def main() -> None:
    # Load audio with the original sample rate (do not force 22050).
    y, sr = librosa.load(str(INPUT_WAV), sr=None, mono=True)

    # 1. Beat tracking at a fixed hop length.
    tempo, beat_frames = librosa.beat.beat_track(
        y=y, sr=sr, hop_length=HOP_LENGTH, units="frames"
    )

    # Reduce tempo ndarray -> Python float for JSON serialization.
    tempo_bpm = float(np.asarray(tempo).reshape(-1)[0])

    # 2. MFCCs at the same hop length.
    mfcc = librosa.feature.mfcc(
        y=y, sr=sr, n_mfcc=N_MFCC, hop_length=HOP_LENGTH
    )

    # 3. Beat times in seconds (strictly increasing, within audio bounds).
    beat_times = librosa.frames_to_time(
        beat_frames, sr=sr, hop_length=HOP_LENGTH
    )
    beat_times = np.asarray(beat_times, dtype=float).ravel()
    duration = float(y.shape[-1]) / float(sr)

    # Clamp the final beat time to the audio duration to satisfy the
    # "within audio duration bounds" requirement, and ensure strict monotonicity.
    if beat_times.size > 0:
        if beat_times[-1] > duration:
            beat_times[-1] = duration
        # Ensure strictly increasing values.
        for i in range(1, beat_times.size):
            if beat_times[i] <= beat_times[i - 1]:
                beat_times[i] = min(duration, beat_times[i - 1] + 1e-6)

    # 4. Median aggregation of MFCC frames per beat interval.
    # librosa.util.sync pads idx to [0, n_frames] by default, so we pass the
    # beat frame indices directly. With pad=True the resulting column count is
    # either len(beat_times) (no extra padding) or len(beat_times)+1 (extra
    # trailing boundary); both are accepted by the spec.
    mfcc_sync = librosa.util.sync(
        data=mfcc,
        idx=beat_frames,
        aggregate=np.median,
        pad=True,
        axis=-1,
    )

    # 5. Persist outputs.
    np.savez(OUTPUT_NPZ, mfcc_sync=mfcc_sync)

    beats_meta = {
        "tempo_bpm": tempo_bpm,
        "beat_times_seconds": [float(t) for t in beat_times.tolist()],
        "hop_length": int(HOP_LENGTH),
        "sample_rate": int(sr),
        "n_mfcc": int(N_MFCC),
    }
    with OUTPUT_JSON.open("w") as f:
        json.dump(beats_meta, f, indent=2)

    # Diagnostics.
    print(f"tempo_bpm={tempo_bpm:.4f}")
    print(f"hop_length={HOP_LENGTH}, sample_rate={sr}, n_mfcc={N_MFCC}")
    print(f"n_beats={beat_times.size}")
    print(f"mfcc shape={mfcc.shape}, mfcc_sync shape={mfcc_sync.shape}")
    print(f"duration={duration:.4f}s")


if __name__ == "__main__":
    main()