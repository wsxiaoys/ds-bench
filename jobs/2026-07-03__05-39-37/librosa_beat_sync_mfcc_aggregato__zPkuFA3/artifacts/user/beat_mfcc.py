"""Beat-synchronous MFCC aggregator.

Pipeline:
  1. Load the input WAV.
  2. Beat-track with librosa.beat.beat_track (estimates tempo + beat frames).
  3. Compute 20-coefficient MFCCs at the SAME hop_length as the beat tracker.
  4. Aggregate MFCC frames to one column per beat interval using
     librosa.util.sync with median aggregation.
  5. Persist the synced MFCC matrix to /home/user/beat_mfcc.npz and the
     beat metadata to /home/user/beats.json.
"""

import json

import librosa
import numpy as np

INPUT_WAV = "/home/user/input.wav"
NPZ_OUT = "/home/user/beat_mfcc.npz"
JSON_OUT = "/home/user/beats.json"

# A single hop_length reused for both beat tracking and MFCC analysis so that
# beat frame indices line up exactly with MFCC frame indices.
HOP_LENGTH = 512
N_MFCC = 20


def main() -> None:
    # ------------------------------------------------------------------
    # 1. Load audio (mono, default sr).
    # ------------------------------------------------------------------
    y, sr = librosa.load(INPUT_WAV, sr=None, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    # ------------------------------------------------------------------
    # 2. Beat tracking.
    #    librosa 0.11 beat_track is keyword-only and returns
    #    (tempo, beats) where tempo is a 1-D ndarray even for mono input.
    # ------------------------------------------------------------------
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=HOP_LENGTH)

    # Reduce tempo to a plain Python float scalar for JSON serialisation.
    tempo_scalar = float(np.asarray(tempo).reshape(-1)[0])

    # ------------------------------------------------------------------
    # 3. MFCCs at the same hop_length as the beat tracker.
    #    hop_length is forwarded to melspectrogram via **kwargs.
    # ------------------------------------------------------------------
    mfcc = librosa.feature.mfcc(
        y=y, sr=sr, n_mfcc=N_MFCC, hop_length=HOP_LENGTH
    )  # shape: (N_MFCC, n_frames)

    # ------------------------------------------------------------------
    # 4. Beat-synchronous aggregation with median.
    #    A "beat interval" is the segment between two consecutive beats, so
    #    for n beats there are n-1 intervals.  We therefore disable boundary
    #    padding (pad=False) so that librosa.util.sync produces exactly one
    #    column per inter-beat interval rather than adding extra columns for
    #    the audio before the first beat / after the last beat.
    # ------------------------------------------------------------------
    mfcc_sync = librosa.util.sync(
        mfcc, beats, aggregate=np.median, pad=False, axis=-1
    )  # shape: (N_MFCC, n_beat_intervals)

    # ------------------------------------------------------------------
    # Convert beat frame indices -> times (seconds) with the same sr/hop.
    # ------------------------------------------------------------------
    beat_times = librosa.frames_to_time(
        beats, sr=sr, hop_length=HOP_LENGTH
    )
    beat_times_seconds = [float(t) for t in np.asarray(beat_times).reshape(-1)]

    # Sanity: strictly increasing and within audio duration bounds.
    beat_times_seconds = [
        round(t, 6) for t in beat_times_seconds
    ]
    for a, b in zip(beat_times_seconds, beat_times_seconds[1:]):
        assert b > a, f"beat times must be strictly increasing: {a} >= {b}"
    if beat_times_seconds:
        assert beat_times_seconds[0] >= 0.0, "first beat time below 0"
        assert beat_times_seconds[-1] <= duration + 1e-6, (
            f"last beat time {beat_times_seconds[-1]} exceeds duration {duration}"
        )

    # ------------------------------------------------------------------
    # 5. Persist outputs.
    # ------------------------------------------------------------------
    np.savez(NPZ_OUT, mfcc_sync=mfcc_sync)

    metadata = {
        "tempo_bpm": tempo_scalar,
        "beat_times_seconds": beat_times_seconds,
        "hop_length": int(HOP_LENGTH),
        "sample_rate": int(sr),
        "n_mfcc": int(N_MFCC),
    }
    with open(JSON_OUT, "w") as fh:
        json.dump(metadata, fh, indent=2)

    # ------------------------------------------------------------------
    # Console summary for verification.
    # ------------------------------------------------------------------
    print(f"tempo_bpm           : {tempo_scalar}")
    print(f"n_beats             : {len(beat_times_seconds)}")
    print(f"mfcc shape          : {mfcc.shape}")
    print(f"mfcc_sync shape     : {mfcc_sync.shape}")
    print(f"n_beat_intervals    : {mfcc_sync.shape[1]}")
    print(f"duration (s)        : {duration}")
    print(f"beat_times (first 5): {beat_times_seconds[:5]}")
    print(f"beat_times (last 5) : {beat_times_seconds[-5:]}")
    print(f"wrote {NPZ_OUT} and {JSON_OUT}")


if __name__ == "__main__":
    main()