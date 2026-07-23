# Transient Detection & Envelope Shaper (librosa)

## Background
A *transient designer* is an audio effect that independently rescales the **attack** (transient) portion and the **sustain** (decay/body) portion of percussive material. In this task you will build a command-line transient designer in Python using `librosa` (with `numpy`/`scipy`/`soundfile`). The tool detects percussive transients, builds a time-varying gain envelope that boosts/cuts the attack and sustain regions independently, applies it click-free, and writes the shaped audio plus a JSON report.

## Requirements
- Read a mono WAV file, detect its percussive transients (onsets), and **backtrack** each detected onset to the preceding local minimum of the onset-strength envelope so that each transient marker sits at the true start of the hit.
- For each detected transient at time `t` (sample `s`):
  - The **attack region** spans `[s, s + attack_len)` where `attack_len = round(attack_ms/1000 * sr)` samples.
  - The **sustain region** spans from the end of that attack region up to the next detected transient (and up to the end of the signal for the last transient).
  - All samples that do not belong to any attack region are sustain.
- Build a per-sample gain envelope whose target value is the **attack gain** inside attack regions and the **sustain gain** inside sustain regions. Gains are supplied in **decibels** and applied as **linear amplitude multipliers**: a gain of `G` dB multiplies the waveform amplitude by `10**(G/20)`.
- Make region transitions click-free with a smooth crossfade: **each region boundary uses a crossfade centered on the boundary spanning `crossfade_ms` on each side (total `2*crossfade_ms`).** Outside those crossfade spans the applied gain MUST equal the region's constant linear gain exactly (a flat plateau). The gain envelope MUST be continuous (no instantaneous gain jumps).
- Multiply the input waveform by this gain envelope and write the shaped WAV. The output length (number of samples) and sample rate MUST equal the input's. Output sample values MUST stay within `[-1.0, 1.0]` (no clipping).
- Write a JSON report describing the detected transients and the gains applied.

## Implementation Hints
- Project path: /home/user/project
- Command: `python3 shape_transients.py --input <in.wav> --output <out.wav> --report <report.json> --attack-gain-db <float> --sustain-gain-db <float> --attack-ms <float> --crossfade-ms <float>`
  - `--input`: path to the input WAV to read.
  - `--output`: path where the shaped WAV is written (same sample count and sample rate as the input).
  - `--report`: path where the JSON report is written.
  - `--attack-gain-db`: gain (dB) applied to attack regions (may be positive or negative).
  - `--sustain-gain-db`: gain (dB) applied to sustain regions (may be positive or negative).
  - `--attack-ms`: attack-region length in milliseconds.
  - `--crossfade-ms`: half-width (per side) of the boundary crossfade in milliseconds. You may assume `attack_ms > 2*crossfade_ms`.
- dB convention: linear amplitude multiplier is `10**(dB/20)` (so `+6` dB ≈ x1.995 amplitude, `-6` dB ≈ x0.501 amplitude).
- The applied gain inside an attack region, at every sample farther than `crossfade_ms` (converted to samples) from either region boundary, MUST equal `10**(attack_gain_db/20)` exactly; likewise for sustain regions with `10**(sustain_gain_db/20)`.
- JSON report format (write exactly these keys):
  ```json
  {
    "sample_rate": <int>,
    "num_transients": <int>,
    "attack_gain_db": <float>,
    "sustain_gain_db": <float>,
    "onsets": [
      {"onset_time": <float seconds>, "attack_gain_db": <float>, "sustain_gain_db": <float>}
    ]
  }
  ```
  - `onsets` MUST be ordered by ascending `onset_time`; `onset_time` is the backtracked transient time in seconds.
  - `num_transients` MUST equal the length of the `onsets` array.
  - Each element's `attack_gain_db`/`sustain_gain_db` MUST equal the corresponding CLI values.
- The tool must run headless with no network access; do not download any data.

