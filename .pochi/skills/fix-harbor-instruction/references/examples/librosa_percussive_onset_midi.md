# `librosa_percussive_onset_midi`

## `instruction.md` diff

```diff
diff --git a/tasks/librosa_percussive_onset_midi/instruction.md b/tasks/librosa_percussive_onset_midi/instruction.md
index 1422c563b24..bf3e912b6a2 100644
--- a/tasks/librosa_percussive_onset_midi/instruction.md
+++ b/tasks/librosa_percussive_onset_midi/instruction.md
@@ -8,38 +8,16 @@ Build a drum-hit grid quantizer with `librosa`. The pipeline must isolate the pe
 - Separate the percussive waveform from the harmonic content with HPSS.
 - Detect onsets on the percussive component using an onset strength envelope and peak picking.
 - Recover a global tempo (BPM) from beat tracking on the percussive component and derive a 16th-note grid with spacing `60 / tempo / 4` seconds, starting at time 0.
-- Snap each detected onset to the nearest 16th-note grid position.
+- Snap each detected onset to the nearest 16th-note grid position that lies within the audio duration.
 - Estimate a per-hit velocity from the local onset envelope amplitude, normalized into `(0.0, 1.0]`.
-- Write the result to `/home/user/hits.json`.
+- Write the result to `/home/user/hits.json` as a JSON array of hit objects, ordered chronologically.

 ## Implementation Hints
 - Use HPSS on the loaded waveform to isolate a percussive-only signal before any onset or beat analysis; both detection and tempo estimation must run on that signal, not on the original mix.
 - Reuse a single `hop_length` for the onset envelope, peak picking, beat tracking, and frame-to-time conversion so onset frame indices and times are consistent.
 - Choose peak-picking parameters that yield at least 5 well-separated hits for a ~12s drum loop near 120 BPM.
-- Derive the grid index of a snapped onset from its raw onset time and the 16th-note step; preserve the original onset time as `raw_time_seconds` and store the snapped time as `time_seconds`.
+- Derive the grid index of a snapped onset from its raw onset time and the 16th-note step. Each hit object in the output must contain exactly four keys: `time_seconds` (the snapped time), `grid_index` (the integer grid index), `velocity` (the normalized amplitude), and `raw_time_seconds` (the original onset time).
 - Sample the onset strength envelope at (or near) each detected onset frame for the per-hit amplitude and rescale across the set of detected hits so the maximum velocity lands at `1.0` while strictly positive minima remain strictly above `0.0`.
 - Verify all signatures against the librosa 0.11.0 documentation; the onset, beat, and frame conversion APIs are keyword-only.
-
-## Acceptance Criteria
-- Project path: /home/user
-- Ensure the quantization pipeline is executed and the output artifact exists.
-- Output file: `/home/user/hits.json`
-- The output file must be a JSON array. Each element must be an object with the following schema:
-
-  ```json
-  {
-    "time_seconds": number,
-    "grid_index": integer,
-    "velocity": number,
-    "raw_time_seconds": number
-  }
-  ```
-
-  - The array must contain at least 5 hits.
-  - `time_seconds` and `raw_time_seconds` are floats in `[0, audio_duration + 1e-3]` seconds.
-  - `grid_index` is a non-negative integer.
-  - `velocity` is a float in `(0.0, 1.0]`.
-- Hits must be ordered so that `time_seconds` is non-decreasing across the array and `grid_index` is non-decreasing across the array.
-- For every hit, `|time_seconds - raw_time_seconds| <= (60.0 / estimated_tempo / 4) / 2 + 1e-3`, where `estimated_tempo` is the global tempo (BPM) returned by beat tracking on the percussive component.
-- `estimated_tempo` must fall within `[40, 240]` BPM. The estimated tempo may be embedded as a numeric `_metadata.estimated_tempo` field inside `/home/user/hits.json`; otherwise the verifier will recompute the tempo by replaying the documented librosa pipeline (HPSS on the loaded waveform, onset strength on the percussive component, `librosa.beat.beat_track` on that envelope) against `/home/user/input.wav`.
+- You may optionally output a top-level JSON object with a `hits` array and embed the global tempo as a numeric `_metadata.estimated_tempo` field to bypass the verifier's tempo recomputation.
```

## `tests/test_final_state.py`

```python
import json
import os

import pytest


HITS_JSON = "/home/user/hits.json"
INPUT_WAV = "/home/user/input.wav"

REQUIRED_KEYS = {"time_seconds", "grid_index", "velocity", "raw_time_seconds"}


def _is_real_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _is_integer(value):
    return isinstance(value, int) and not isinstance(value, bool)


@pytest.fixture(scope="module")
def raw_payload():
    assert os.path.isfile(HITS_JSON), (
        f"Expected output file {HITS_JSON} to exist after the task completes."
    )
    with open(HITS_JSON, "r") as fh:
        try:
            data = json.load(fh)
        except json.JSONDecodeError as exc:
            raise AssertionError(f"{HITS_JSON} is not valid JSON: {exc}")
    return data


@pytest.fixture(scope="module")
def hits(raw_payload):
    if isinstance(raw_payload, list):
        return raw_payload
    if isinstance(raw_payload, dict):
        assert "hits" in raw_payload and isinstance(raw_payload["hits"], list), (
            f"{HITS_JSON} is a JSON object but does not contain a 'hits' array; "
            f"top-level keys: {sorted(raw_payload.keys())}."
        )
        return raw_payload["hits"]
    raise AssertionError(
        f"{HITS_JSON} must be a JSON array of hits or a JSON object with a 'hits' "
        f"array, got: {type(raw_payload).__name__}."
    )


@pytest.fixture(scope="module")
def audio_duration():
    import librosa

    y, sr = librosa.load(INPUT_WAV, sr=None, mono=True)
    duration = float(len(y)) / float(sr)
    assert duration > 0, f"Reference audio duration must be positive, got {duration}."
    return duration


@pytest.fixture(scope="module")
def estimated_tempo(raw_payload):
    if isinstance(raw_payload, dict):
        metadata = raw_payload.get("_metadata")
        if isinstance(metadata, dict) and "estimated_tempo" in metadata:
            candidate = metadata["estimated_tempo"]
            assert _is_real_number(candidate), (
                f"_metadata.estimated_tempo must be numeric, got: {candidate!r} "
                f"(type {type(candidate).__name__})."
            )
            return float(candidate)

    import librosa

    y, sr = librosa.load(INPUT_WAV, sr=None, mono=True)
    _, y_percussive = librosa.effects.hpss(y)
    onset_env = librosa.onset.onset_strength(
        y=y_percussive, sr=sr, hop_length=512
    )
    tempo, _ = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=sr, hop_length=512
    )
    try:
        tempo_scalar = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
    except (TypeError, ValueError) as exc:
        raise AssertionError(
            f"Failed to coerce librosa.beat.beat_track tempo {tempo!r} to a scalar: {exc}"
        )
    return tempo_scalar


def test_hits_list_minimum_length(hits):
    assert len(hits) >= 5, (
        f"Expected at least 5 hits in /home/user/hits.json, got {len(hits)}."
    )


def test_each_hit_has_required_schema(hits):
    for idx, hit in enumerate(hits):
        assert isinstance(hit, dict), (
            f"Hit {idx} is not a JSON object, got: {type(hit).__name__}."
        )
        assert set(hit.keys()) == REQUIRED_KEYS, (
            f"Hit {idx} has keys {sorted(hit.keys())}; expected exactly "
            f"{sorted(REQUIRED_KEYS)}."
        )
        assert _is_real_number(hit["time_seconds"]), (
            f"Hit {idx} 'time_seconds' must be numeric, got: {hit['time_seconds']!r}."
        )
        assert _is_real_number(hit["raw_time_seconds"]), (
            f"Hit {idx} 'raw_time_seconds' must be numeric, got: "
            f"{hit['raw_time_seconds']!r}."
        )
        assert _is_integer(hit["grid_index"]), (
            f"Hit {idx} 'grid_index' must be an integer, got: {hit['grid_index']!r} "
            f"(type {type(hit['grid_index']).__name__})."
        )
        assert hit["grid_index"] >= 0, (
            f"Hit {idx} 'grid_index' must be non-negative, got {hit['grid_index']}."
        )
        assert _is_real_number(hit["velocity"]), (
            f"Hit {idx} 'velocity' must be numeric, got: {hit['velocity']!r}."
        )
        velocity = float(hit["velocity"])
        assert 0.0 < velocity <= 1.0, (
            f"Hit {idx} 'velocity' must be in (0.0, 1.0], got {velocity}."
        )


def test_time_fields_within_audio_bounds(hits, audio_duration):
    upper = audio_duration + 1e-3
    for idx, hit in enumerate(hits):
        t = float(hit["time_seconds"])
        raw = float(hit["raw_time_seconds"])
        assert 0.0 <= t <= upper, (
            f"Hit {idx} 'time_seconds'={t} is outside [0, {upper}] "
            f"(audio_duration={audio_duration})."
        )
        assert 0.0 <= raw <= upper, (
            f"Hit {idx} 'raw_time_seconds'={raw} is outside [0, {upper}] "
            f"(audio_duration={audio_duration})."
        )


def test_time_seconds_non_decreasing(hits):
    times = [float(h["time_seconds"]) for h in hits]
    for i in range(1, len(times)):
        assert times[i] >= times[i - 1] - 1e-9, (
            f"'time_seconds' must be non-decreasing; hit {i-1}={times[i-1]} "
            f"> hit {i}={times[i]}."
        )


def test_grid_index_non_decreasing(hits):
    indices = [int(h["grid_index"]) for h in hits]
    for i in range(1, len(indices)):
        assert indices[i] >= indices[i - 1], (
            f"'grid_index' must be non-decreasing; hit {i-1}={indices[i-1]} "
            f"> hit {i}={indices[i]}."
        )


def test_estimated_tempo_in_expected_range(estimated_tempo):
    assert 40.0 <= estimated_tempo <= 240.0, (
        f"Estimated tempo {estimated_tempo} BPM is outside [40, 240]."
    )


def test_snapped_time_within_grid_tolerance(hits, estimated_tempo):
    step_seconds = 60.0 / float(estimated_tempo) / 4.0
    tolerance = step_seconds / 2.0 + 1e-3
    for idx, hit in enumerate(hits):
        t = float(hit["time_seconds"])
        raw = float(hit["raw_time_seconds"])
        delta = abs(t - raw)
        assert delta <= tolerance, (
            f"Hit {idx} snap distance |time_seconds - raw_time_seconds|={delta} "
            f"exceeds tolerance {tolerance} (step={step_seconds}, "
            f"tempo={estimated_tempo})."
        )
```