# Transient-Preserving Phase-Vocoder Time-Stretch and Pitch-Shift

## Background
Build a command-line audio processor using librosa (with numpy/scipy/soundfile) that time-stretches and pitch-shifts a mono audio file. Phase-vocoder time-scale modification is notorious for smearing percussive/transient events; your processor must keep transients intact while independently changing tempo and pitch.

## Requirements
- Read a mono WAV file and produce three artifacts:
  1. A time-stretched rendering with a stretch factor of 1.5 (plays 1.5x longer / slower than the input, with pitch unchanged).
  2. A pitch-shifted rendering of +7 semitones (12-TET) whose duration is unchanged (equal to the input duration).
  3. A JSON analysis report describing the measured output durations and the detected transient locations.
- The time-scale/pitch modification must operate in the short-time Fourier domain with correct phase propagation, and must preserve the temporal position and sharpness of transient (broadband onset) events rather than smearing or displacing them.
- Transient events in the input must be detected and reported.

## Implementation Hints
- Project path: /home/user/project
- Command: `python3 run.py --input <input_wav_path> --output-dir <output_dir>`
- The program must accept an arbitrary mono WAV via `--input` and write all outputs into the directory given by `--output-dir` (create the directory if it does not exist).
- A sample mono WAV is provided at `/home/user/project/input.wav` that you may use for local development; the grader will run your program against its own separate input files.
- Fixed parameters: stretch factor = 1.5; pitch shift = +7 semitones (a frequency ratio of 2^(7/12)); detect and report transients using an STFT hop length of 512 samples.
- Every output WAV must keep the input's sample rate and be single-channel.
- Output files, with these exact names, must be written inside `--output-dir`:
  - `stretched.wav` — duration approximately 1.5x the input duration; pitch unchanged relative to the input.
  - `shifted.wav` — duration equal to the input duration (within a few milliseconds); fundamental frequency raised by 7 semitones relative to the input.
  - `analysis.json` — a JSON object containing exactly these keys:
    - `sample_rate`: integer sample rate of the audio.
    - `stretch_factor`: number, equal to 1.5.
    - `pitch_shift_semitones`: number, equal to 7.
    - `input_duration_seconds`: number, duration of the input signal in seconds.
    - `stretched_duration_seconds`: number, measured duration of `stretched.wav`.
    - `shifted_duration_seconds`: number, measured duration of `shifted.wav`.
    - `transient_frames`: array of integers — STFT frame indices (using hop length 512) of the transient events detected in the INPUT signal, sorted in ascending order.
    - `transient_times_seconds`: array of numbers — the corresponding times in seconds, computed as frame_index * 512 / sample_rate, in the same length and order as `transient_frames`.
- The duration values written in `analysis.json` must match the actual rendered audio files.
- Transient detection must locate the genuine broadband onset events present in the input and must not emit a flood of spurious detections (report essentially one entry per true onset event).

