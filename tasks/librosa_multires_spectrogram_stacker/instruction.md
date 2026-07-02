# Multi-Resolution Spectrogram Stack with librosa

## Background
Produce a stacked time-frequency representation of a single audio file by computing three complementary spectrograms on the SAME time grid: a linear STFT, a Constant-Q transform (CQT), and a Variable-Q transform (VQT). Persist the dB-scaled magnitudes in one `.npz` archive together with a sidecar metadata JSON that fully describes the analysis parameters and the per-representation frequency vectors.

## Requirements
- Read the input WAV file from `/home/user/input.wav`.
- Compute all three transforms (STFT, CQT, VQT) using a SINGLE shared `hop_length` so the columns of every output share a common time grid.
- Convert each magnitude spectrogram to dB.
- Save the three dB arrays into `/home/user/spec_stack.npz` under the keys `stft_db`, `cqt_db`, `vqt_db`.
- Save the analysis metadata as JSON into `/home/user/spec_meta.json`. The JSON object must contain exactly these keys: `n_frames`, `hop_length`, `sample_rate`, `stft_freqs`, `cqt_freqs`, `vqt_freqs`, `n_fft`, `cqt_n_bins`, `cqt_bins_per_octave`, `vqt_n_bins`, and `vqt_bins_per_octave`.

## Implementation Hints
- Use `librosa.stft`, `librosa.cqt`, and `librosa.vqt` from librosa 0.11.0; nearly every kwarg is keyword-only.
- Take magnitudes (`np.abs`) before converting to dB with `librosa.amplitude_to_db`.
- The number of frames for STFT, CQT, and VQT must agree; choose a `hop_length` that is a power of two and divisible by `2 ** (n_octaves - 1)` so the recursive CQT/VQT implementation accepts it.
- The frequency vectors should be derived from librosa's own helpers (e.g., `librosa.fft_frequencies`, `librosa.cqt_frequencies`, and `librosa.interval_frequencies` with `intervals='equal'`).
- All metadata numeric values must be plain JSON-serializable scalars; the frequency arrays must be plain JSON lists of numbers.

