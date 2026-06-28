# Percussive Onset Grid Quantizer with HPSS, Beat Tracking, and Velocity Estimation

## Background
Build a drum-hit grid quantizer with `librosa`. The pipeline must isolate the percussive content from a mixed audio file, detect drum onsets on the percussive component, recover a global tempo with beat tracking on the same percussive signal, snap each onset to the nearest 16th-note position derived from that tempo, and assign a normalized velocity per hit from the local onset envelope amplitude.

## Requirements
- Read the input WAV file from `/home/user/input.wav`.
- Separate the percussive waveform from the harmonic content with HPSS.
- Detect onsets on the percussive component using an onset strength envelope and peak picking.
- Recover a global tempo (BPM) from beat tracking on the percussive component and derive a 16th-note grid with spacing `60 / tempo / 4` seconds, starting at time 0.
- Snap each detected onset to the nearest 16th-note grid position that lies within the audio duration.
- Estimate a per-hit velocity from the local onset envelope amplitude, normalized into `(0.0, 1.0]`.
- Write the result to `/home/user/hits.json` as a JSON array of hit objects, ordered chronologically.

## Implementation Hints
- Use HPSS on the loaded waveform to isolate a percussive-only signal before any onset or beat analysis; both detection and tempo estimation must run on that signal, not on the original mix.
- Reuse a single `hop_length` for the onset envelope, peak picking, beat tracking, and frame-to-time conversion so onset frame indices and times are consistent.
- Choose peak-picking parameters that yield at least 5 well-separated hits for a ~12s drum loop near 120 BPM.
- Derive the grid index of a snapped onset from its raw onset time and the 16th-note step. Each hit object in the output must contain exactly four keys: `time_seconds` (the snapped time), `grid_index` (the integer grid index), `velocity` (the normalized amplitude), and `raw_time_seconds` (the original onset time).
- Sample the onset strength envelope at (or near) each detected onset frame for the per-hit amplitude and rescale across the set of detected hits so the maximum velocity lands at `1.0` while strictly positive minima remain strictly above `0.0`.
- Verify all signatures against the librosa 0.11.0 documentation; the onset, beat, and frame conversion APIs are keyword-only.
- You may optionally output a top-level JSON object with a `hits` array and embed the global tempo as a numeric `_metadata.estimated_tempo` field to bypass the verifier's tempo recomputation.

