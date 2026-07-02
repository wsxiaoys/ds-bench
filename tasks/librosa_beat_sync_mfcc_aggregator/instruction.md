# Beat-Synchronous MFCC Aggregator

## Background
Build a beat-synchronous MFCC summarizer with `librosa` (0.11). The pipeline must beat-track a short rhythmic clip, compute MFCCs at the same hop length, aggregate MFCC frames into per-beat-interval medians, and persist the synchronized matrix together with the beat timing metadata.

## Requirements
- Read the input WAV from `/home/user/input.wav`.
- Estimate the tempo and the beat frame indices with `librosa.beat.beat_track`.
- Compute 20-coefficient MFCCs (`n_mfcc=20`) at the **same `hop_length`** as the beat tracker.
- Aggregate the MFCC matrix to one column per beat interval using `librosa.util.sync` with **median aggregation**.
- Write the synchronized matrix to `/home/user/beat_mfcc.npz` under the key `mfcc_sync` (shape `(20, n_beat_intervals)`).
- Write the beat metadata to `/home/user/beats.json` as a JSON object with the following schema:

  ```json
  {
    "tempo_bpm": number,
    "beat_times_seconds": [number, ...],
    "hop_length": integer,
    "sample_rate": integer,
    "n_mfcc": 20
  }
  ```

## Implementation Hints
- Pick a `hop_length` once and reuse it for both `librosa.beat.beat_track` and `librosa.feature.mfcc`.
- `librosa.beat.beat_track` returns the tempo as a 1-D ndarray even for mono input; reduce it to a scalar before serialising to JSON.
- `librosa.util.sync` accepts an `aggregate` callable (e.g. `np.median`) and pads boundaries by default; verify the resulting column count against `len(beat_times_seconds)`. Both `n_beat_intervals == len(beat_times_seconds) - 1` and `n_beat_intervals == len(beat_times_seconds)` are accepted.
- Use `librosa.frames_to_time` (with the same `sr` and `hop_length`) to convert beat frame indices to seconds. Ensure `beat_times_seconds` is a strictly increasing list of floats, and all converted times lie within the audio duration bounds.
- Sanity-check every API signature against the librosa 0.11.0 documentation; feature, beat, and util functions are keyword-only.

