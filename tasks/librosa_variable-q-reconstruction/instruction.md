# Variable-Q Transform Analysis & Reconstruction

## Background
The Variable-Q Transform (VQT) is a time-frequency representation with geometrically spaced center frequencies and a frequency-dependent bandwidth controlled by a `gamma` offset, giving better time resolution at low frequencies than the Constant-Q Transform. In this task you will build a small analysis-and-resynthesis pipeline on top of `librosa` (version 0.11.0): compute a VQT of a provided audio clip, persist its magnitude, resynthesize a time-domain waveform from the transform, and report how faithfully the waveform was reconstructed.

A deterministic mono audio clip has already been generated for you at `/home/user/vqt/input/signal.wav` (sampling rate 22050 Hz, 102400 samples). Do not modify, regenerate, or resample this file; process it as-is at 22050 Hz.

## Requirements
- Load the input clip and compute its Variable-Q Transform using the exact analysis parameters listed below.
- Save the **magnitude** (absolute value) of the VQT as a real-valued NumPy array.
- Reconstruct a time-domain waveform from the transform and save it as a WAV file whose length exactly matches the input.
- Produce a JSON report describing the achieved reconstruction quality and the transform dimensions.

## Implementation Hints
- Project path: /home/user/vqt
- Command: `python3 /home/user/vqt/solve.py` (running this command must read the input and (re)produce every output artifact listed below).
- Input audio: `/home/user/vqt/input/signal.wav`, single channel, sampling rate 22050 Hz, 102400 samples. Process it at 22050 Hz with no resampling.
- VQT analysis parameters (use exactly these values):
  - sampling rate `sr` = 22050
  - minimum frequency `fmin` = the frequency of note C1 (i.e. `librosa.note_to_hz('C1')`, approximately 32.70 Hz)
  - `bins_per_octave` = 36
  - `n_bins` = 252
  - `gamma` = 3.0
  - `hop_length` = 512
- Output artifact 1 — VQT magnitude: `/home/user/vqt/output/vqt_magnitude.npy`. A real-valued (non-complex) 2-D array of shape `(252, 201)` = `(n_bins, n_frames)` containing the elementwise magnitude of the complex VQT.
- Output artifact 2 — reconstruction: `/home/user/vqt/output/reconstructed.wav`. A single-channel WAV at 22050 Hz containing exactly 102400 samples (identical length to the input).
- Output artifact 3 — report: `/home/user/vqt/output/report.json`, a JSON object with exactly these keys:
  - `snr_db`: a number — the reconstruction signal-to-noise ratio in decibels, defined as `10 * log10( sum(x[n]^2) / sum((x[n] - x_hat[n])^2) )`, where `x` is the original input signal and `x_hat` is your reconstructed signal (both of length 102400, compared sample-for-sample).
  - `vqt_shape`: a two-element array `[n_bins, n_frames]` of integers giving the shape of the VQT, i.e. `[252, 201]`.
- The reconstruction must be faithful: the reconstruction SNR defined above must be at least 12.0 dB. A magnitude-only or otherwise phase-agnostic reconstruction will not meet this bar.

