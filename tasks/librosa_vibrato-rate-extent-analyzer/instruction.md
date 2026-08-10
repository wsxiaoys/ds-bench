# Vibrato Rate & Extent Analyzer

## Background
Vibrato is a periodic modulation of pitch that singers and instrumentalists apply to sustained notes. Given a monophonic melodic recording, you must build a command-line analyzer that measures, for every sustained note, how fast the pitch oscillates (the vibrato *rate*, in Hz) and how wide the oscillation is (the vibrato *extent*, in cents), and decides whether the note carries vibrato at all.

The `librosa` audio library (version **0.11.0**), together with `numpy`, `scipy`, and `soundfile`, is already installed in the environment.

## Requirements
- Load a monophonic WAV file and estimate its time-varying fundamental frequency (F0) contour, including a per-frame voicing decision.
- Segment the recording into **sustained note segments**: each segment is one maximal contiguous voiced region. In the inputs, distinct notes are always separated by short silent (unvoiced) gaps, so silence marks segment boundaries.
- For each note segment, isolate the vibrato oscillation of the pitch (expressed in cents), remove any slow pitch drift/glide, and from that oscillation compute the vibrato rate and the vibrato extent, then classify the segment as vibrato or no-vibrato.
- Write the results as a JSON file.

## Implementation Hints
- Project path: /home/user/vibrato_analyzer
- Command: `python3 analyze_vibrato.py --input <input_wav_path> --output <output_json_path>`
- The `--input` argument is the path to a mono WAV file; the sampling rate must be read from the file itself and not assumed.
- The `--output` argument is the path where the analyzer writes its JSON result. The program must exit with status code 0 on success.
- The output JSON must be a single array. It contains exactly one object per detected sustained note segment, ordered by ascending `start_time`. Each object must have exactly these keys:
  - `start_time`: segment start in seconds (number).
  - `end_time`: segment end in seconds (number).
  - `has_vibrato`: boolean classification for the segment.
  - `vibrato_rate_hz`: the dominant modulation frequency, in Hz, of the segment's detrended pitch oscillation (number; may be `null` when `has_vibrato` is false).
  - `vibrato_extent_cents`: the **peak-to-peak** span, in cents, of the segment's vibrato oscillation after any slow pitch drift/glide has been removed — i.e. the full distance between the highest and lowest excursion of the oscillation, not the half-amplitude (number; may be `null` when `has_vibrato` is false).
- Classification rule (defines `has_vibrato`): a segment exhibits vibrato (`has_vibrato` = true) when its detrended pitch oscillation has a dominant modulation frequency between 4 Hz and 9 Hz **and** a peak-to-peak extent of at least 20 cents; otherwise `has_vibrato` = false.
- Extent and rate must be reported as absolute (positive) magnitudes. Times are in seconds relative to the start of the file.

