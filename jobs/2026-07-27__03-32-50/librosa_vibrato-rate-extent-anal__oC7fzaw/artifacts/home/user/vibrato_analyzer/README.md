# Vibrato Rate & Extent Analyzer

Command-line tool that analyzes a monophonic WAV recording and, for every
sustained note (maximal contiguous voiced region), reports:

- `start_time` / `end_time` — segment boundaries, in seconds.
- `has_vibrato` — whether the segment carries vibrato.
- `vibrato_rate_hz` — dominant modulation frequency of the pitch oscillation
  (`null` when `has_vibrato` is `false`).
- `vibrato_extent_cents` — peak-to-peak extent of the pitch oscillation, in
  cents, after removing slow pitch drift/glide (`null` when `has_vibrato` is
  `false`).

## Usage

```bash
python3 analyze_vibrato.py --input <input_wav_path> --output <output_json_path>
```

The sample rate is read from the WAV file itself. On success the program
exits with status code 0 and writes a JSON array to `--output`, ordered by
ascending `start_time`.

## Method

1. **F0 estimation & voicing.** `librosa.pyin` estimates a time-varying F0
   contour plus a per-frame voicing decision. The analysis frame length is
   derived from the file's sample rate (~46 ms), so the frame rate (and thus
   vibrato measurement fidelity) is consistent across input sample rates,
   while still spanning enough periods of the lowest tracked pitch for
   reliable pitch detection.
2. **Segmentation.** Each maximal contiguous run of voiced frames becomes one
   note segment (notes are separated by short unvoiced/silent gaps).
3. **Cents conversion.** Each segment's F0 (Hz) is converted to cents
   relative to the segment's median pitch, after discarding a short
   onset/offset transient (unreliable pitch-tracker lock-on/off) at each
   edge.
4. **Drift/glide removal.** A low-order (degree ≤ 2) polynomial is fit to the
   cents contour over time and subtracted off. A low-degree polynomial has
   essentially no capacity to represent a 4–9 Hz oscillation, so this isolates
   the vibrato oscillation from the note's slow pitch drift/portamento/glide
   without attenuating the oscillation itself (unlike a fixed-window smoother
   or IIR filter whose passband edge would sit close to the classification
   boundary).
5. **Rate & extent.** The dominant frequency of the detrended residual is
   found via a Hann-windowed, zero-padded FFT (peak search in 1–15 Hz). The
   extent is the peak-to-peak (max − min) of the residual.
6. **Classification.** A segment has vibrato when its dominant modulation
   frequency is between 4–9 Hz *and* its peak-to-peak extent is at least 20
   cents.

## Requirements

`librosa` 0.11.0, `numpy`, `scipy`, `soundfile` (already installed in the
target environment).
