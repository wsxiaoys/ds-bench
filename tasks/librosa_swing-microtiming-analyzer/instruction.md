# Swing Ratio & Micro-Timing Analyzer

## Background
Rhythmic *swing* is the practice of playing pairs of eighth notes unevenly: the first eighth is lengthened and the second is shortened, giving music a characteristic "long-short" feel. Two quantities summarize this feel:
- the **swing ratio** = duration(first eighth) / duration(second eighth) (a perfectly straight/even performance is `1.0`; a triplet-style swing where the first eighth occupies two thirds of the beat is `2.0`), and
- the **micro-timing**, i.e. how far individual note onsets drift from the idealized (mechanical) grid implied by the beat and the swing ratio.

You will build a command-line audio analysis program (Python 3, using the `librosa` audio library and the scientific-Python stack) that estimates these quantities from a single-channel audio recording of percussive clicks.

## Requirements
Write a program that, given a mono WAV file, performs the following analysis and writes the result as JSON:
1. Estimate the global **tempo** (in beats per minute) and a **beat grid** (the sequence of beat times) for the recording.
2. Detect every note **onset** in the recording. Onset times must correspond to the *physical start* of each click (the moment energy begins to rise), not to a later detection peak.
3. Build an eighth-note grid by splitting each beat into two subdivision slots (subdivision `0` at the beat, subdivision `1` at the eighth-note offbeat). Assign every detected onset to the nearest grid slot, recording which beat and which subdivision it belongs to.
4. Compute the **swing ratio** of the performance and the **mean micro-timing deviation** (in milliseconds).
5. Emit a single JSON document describing the results.

## Definitions (these fix the exact meaning of every output value)
Let the detected beat times be `b[0] < b[1] < ... < b[K-1]` (seconds). For any beat index `k`, its local period is `P[k] = b[k+1] - b[k]` (for the final beat, reuse the previous period). The straight eighth-note grid points are, for every beat `k`, `g(k,0) = b[k]` and `g(k,1) = b[k] + P[k]/2`. Extend the beat grid by extrapolation with the local period when onsets fall before the first or after the last detected beat, so that every onset can be assigned.

- **Onset assignment**: each detected onset is assigned to the *nearest* straight grid point `g(k,s)`; that gives its `beat_index = k` and `subdivision = s` (either `0` or `1`).
- **swing_ratio**: for every beat `k` that has an onset assigned to subdivision `0`, an onset assigned to subdivision `1`, and a following subdivision-`0` onset (the next beat's downbeat), define `first = t1 - t0` and `second = t0_next - t1`, where `t0`, `t1`, `t0_next` are the corresponding onset times. The per-beat ratio is `first / second`. `swing_ratio` is the mean of these per-beat ratios over the whole recording.
- **deviation_ms** (per onset): the signed offset of the onset from its *swing-adjusted* expected position, in milliseconds, positive when the onset is late. The expected position of a subdivision-`0` onset is `b[k]`; the expected position of a subdivision-`1` onset is `b[k] + P[k] * swing_ratio / (1 + swing_ratio)`. Thus `deviation_ms = 1000 * (onset_time - expected_position)`.
- **mean_microtiming_ms**: the mean of `deviation_ms` over all detected onsets.

## Output format
Write one JSON object with exactly these top-level keys:
- `tempo`: number — estimated global tempo in BPM.
- `swing_ratio`: number — as defined above.
- `mean_microtiming_ms`: number — as defined above.
- `per_onset`: array of objects, ordered by ascending `time`, one entry per detected onset, each with exactly these keys:
  - `time`: number — detected onset time in seconds (physical start of the click).
  - `beat_index`: integer — index of the beat the onset was assigned to.
  - `subdivision`: integer — `0` or `1`.
  - `deviation_ms`: number — signed micro-timing deviation in milliseconds.

## Implementation Hints
- Project path: /home/user/project
- Command: `python3 analyze_swing.py --input <input_wav_path> --output <output_json_path>`
- The program reads the WAV file given by `--input`, performs the analysis, and writes the JSON document to the path given by `--output` (creating/overwriting it). It must exit with status `0` on success. It must print nothing that corrupts the output file (all results go into the JSON file, not stdout).
- The input is a mono WAV file (sampling rate 22050 Hz) containing a sequence of short, well-separated percussive clicks. Downbeat (subdivision-0) clicks are louder than offbeat (subdivision-1) clicks.
- Accuracy the program must achieve on such input: `swing_ratio` within `0.15` of the true ratio; `mean_microtiming_ms` within `10` ms of `0`; and exactly one detected onset per click (the length of `per_onset` must equal the number of clicks). The estimated `tempo` must be within `10` BPM of the true tempo.
- All processing must be fully local: no network access, no external services, and no pre-trained/downloaded models or datasets.

