# NMF Template-Based Polyphonic Piano Transcription

## Background
You are building a supervised (fixed-basis) Non-negative Matrix Factorization transcriber with `librosa`. Given a short recording that contains overlapping harmonic tones (polyphonic mixtures of 2-3 notes played as chords), you must recover which MIDI pitches are sounding over time and emit both a binary piano-roll and a symbolic note list.

The input audio consists of harmonic tones: each sounding note is a fundamental plus several integer harmonics, mixed together with a small amount of additive broadband noise. Notes start and stop at arbitrary times and multiple notes overlap.

## Requirements
- Build a **fixed spectral template dictionary** `W` covering the MIDI pitch range **48 to 72 inclusive** (25 candidate pitches). Each template column must be the magnitude spectrum of a harmonic tone synthesized by you at that pitch. You must construct these templates deterministically inside your program (do not read them from any external file).
- Compute the magnitude spectrogram of the input mixture and estimate a non-negative activation matrix `H` **while keeping `W` fixed** (only `H` is updated).
- Post-process `H` into a clean binary piano-roll (threshold + temporal smoothing to remove spurious single-frame activity), and derive per-pitch note on/off segments from it.
- Emit two artifacts: a binary piano-roll `.npy` and a JSON note list.

## Implementation Hints
- Project path: /home/user/project
- Command: `python3 transcribe.py --input <input_wav_path> --output-dir <output_dir>`
  - The program reads the mixture WAV at `--input`, and writes exactly two files into `--output-dir`: `piano_roll.npy` and `notes.json`. It must create `--output-dir` if it does not exist. The program must be re-runnable on any input WAV that satisfies the properties described in Background.
- Audio/analysis parameters that fix the output grid (use these exact values): load the audio at a sampling rate of **22050 Hz** as mono; compute the spectrogram with an FFT window `n_fft = 2048` and `hop_length = 512` using librosa's default centered STFT. There must be exactly one piano-roll frame (column) per STFT frame, i.e. the number of columns equals `librosa.stft(y, n_fft=2048, hop_length=512).shape[1]`. Frame `t` corresponds to time `t * hop_length / sr` seconds.
- `piano_roll.npy` must be a 2-D NumPy array of shape `(25, n_frames)` containing only the integer values `0` and `1`. Row `i` corresponds to MIDI pitch `48 + i` (row 0 = MIDI 48, row 24 = MIDI 72). A value of `1` means that pitch is active in that frame.
- `notes.json` must be a JSON array of objects, each with exactly the keys `pitch` (integer MIDI number in [48, 72]), `onset_time` (float seconds), and `offset_time` (float seconds), with `offset_time > onset_time`. The array must be sorted by `onset_time` ascending, breaking ties by `pitch` ascending. The note list must be consistent with the piano-roll (each note corresponds to a maximal run of active frames for that pitch).
- Accuracy targets on the hidden evaluation mixture: frame-level piano-roll F-measure against ground truth must be **>= 0.85**, and note-level F-measure (a predicted note counts as correct only if its MIDI pitch matches a ground-truth note and its onset time is within **60 ms** of that note's onset, matched one-to-one) must be **>= 0.80**.
- Allowed libraries: `librosa`, `numpy`, `scipy`, `soundfile`, and `scikit-learn` only. No network access is available.
- A sample mixture is available at `/home/user/project/data/sample_mixture.wav` for your own end-to-end testing (it is illustrative only; the evaluation uses a different mixture with the same signal properties).

