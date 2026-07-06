# Reassigned Spectrogram Peak Tracking

## Background
Build a peak-tracking analysis on top of the time-frequency *reassigned* spectrogram in `librosa`. Unlike a plain STFT, the reassigned spectrogram yields refined per-bin instantaneous frequency estimates (and may produce `NaN` for low-power bins). Your job is to extract, for every analysis frame, the most prominent spectral peaks and report their reassigned frequencies plus magnitudes in dB.

## Requirements
- Read the input audio file from `/home/user/input.wav`.
- Compute the time-frequency reassigned spectrogram of the signal using `librosa`.
- For each STFT frame, select the **top-5** spectral bins ranked by reassigned magnitude (after converting magnitudes to dB). Handle `NaN` values produced by reassignment so they never appear in the output and never break sort order.
- For each selected peak, report:
  - The **reassigned instantaneous frequency** in Hz (from the frequency output of the reassigned spectrogram).
  - The magnitude in **decibels (dB)**.
- Write the result to `/home/user/peaks.json`. The output file must be valid JSON matching the following schema:

  ```json
  {
    "meta": {
      "n_frames": number,
      "sr": number,
      "n_fft": number,
      "hop_length": number
    },
    "frames": [
      {
        "time": number,
        "peaks": [
          {"freq_hz": number, "magnitude_db": number}
        ]
      }
    ]
  }
  ```

- Ensure that:
  - `meta.n_frames` equals `len(frames)` and equals the number of STFT frames produced by the chosen `n_fft` / `hop_length`.
  - `meta.sr` equals the sample rate of the input audio.
  - Each frame's `time` is a finite float in seconds, monotonically non-decreasing across frames, lying in `[0, audio_duration + 1e-2]`, with the last frame within `0.1` s of the audio duration.
  - Each frame's `peaks` array contains **exactly 5** entries, sorted by `magnitude_db` in **descending** order.
  - Each peak's `freq_hz` is finite and in `(0.0, sr/2]`, and `magnitude_db` is finite.

## Implementation Hints
- Sanity-check the API signature and return tuple order against the librosa 0.11.0 documentation. The reassigned spectrogram returns three parallel arrays of shape `(1 + n_fft/2, n_frames)`.
- The frequency and time arrays may contain `NaN` for bins whose power falls below the reassignment threshold; these must be excluded from peak selection rather than silently propagated.
- Use a librosa helper to convert linear amplitude magnitudes to dB.
- Pick an `n_fft` / `hop_length` combination that yields a deterministic frame count for a 22050 Hz, ~5 s input and record that frame count in the output.
- The number of frames in your JSON output must match what librosa actually produces for the parameters you chose — do not pad, truncate, or invent frames.

