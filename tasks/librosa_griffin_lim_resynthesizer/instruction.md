# Mel Spectrogram Resynthesis via Griffin-Lim

## Background
Build a small analysis-resynthesis pipeline with `librosa`. The pipeline must analyze a single audio file into a 128-band log-power mel spectrogram and then reconstruct a time-domain waveform from that mel representation using Griffin-Lim phase recovery. The reconstruction must be reported alongside two objective fidelity metrics computed against the original waveform.

## Requirements
- Read the input WAV file from `/home/user/input.wav` as a mono signal at its native sample rate.
- Compute a 128-band power mel spectrogram and represent it in a log-power form suitable for storage / downstream use.
- Resynthesize a waveform from the mel representation using Griffin-Lim phase estimation (either through the mel-to-audio convenience wrapper, or by inverting mel to STFT magnitude first and then running Griffin-Lim explicitly).
- Write the reconstructed mono waveform to `/home/user/reconstructed.wav` at the same sample rate as the input. The total number of samples of the reconstructed audio must be within 2% of the input waveform length.
- Compute two reconstruction quality metrics relative to the original waveform and write them, along with run metadata, to `/home/user/metrics.json`. The output `/home/user/metrics.json` must be a JSON object with the following exact schema:
  ```json
  {
    "spectral_convergence": number,
    "snr_db": number,
    "length_samples": integer,
    "sample_rate": integer,
    "n_mels": integer,
    "n_iter": integer
  }
  ```
  Where:
  - `spectral_convergence` is the spectral convergence between the original and reconstructed waveforms, defined as `||abs(STFT_ref) - abs(STFT_recon)||_F / ||abs(STFT_ref)||_F` (using `n_fft = 2048` and `hop_length = 512` for the STFTs), and must be strictly less than 0.5.
  - `snr_db` is the signal-to-noise ratio in decibels, and must be strictly greater than 0.0 dB.
  - `length_samples` must equal the actual sample count of `/home/user/reconstructed.wav`.
  - `sample_rate` must equal the sample rate of `/home/user/reconstructed.wav`.
  - `n_mels` must be the number of mel bands used (at least 128).
  - `n_iter` must be the number of Griffin-Lim iterations used (at least 32).

## Implementation Hints
- Verify all relevant signatures against the librosa 0.11.0 documentation; most spectral / inverse-spectral functions are keyword-only.
- The convenience wrapper for the full pipeline is `librosa.feature.inverse.mel_to_audio`; the explicit two-step path is `librosa.feature.inverse.mel_to_stft` followed by `librosa.griffinlim`. Either approach is acceptable as long as the STFT analysis parameters used for inversion match those used during analysis.
- Pick `hop_length`, `win_length`, and `n_iter` yourself; defaults from the docs are a reasonable starting point but the agent may tune them to satisfy the fidelity targets. Note that `n_iter` must be at least 32.
- Make sure the reconstructed waveform length matches the input length closely; the inverse functions expose a `length` argument that can be used to enforce this.
- For the SNR computation, treat the original waveform as the reference signal and the reconstruction as the reference plus reconstruction error; align lengths before subtracting. Specifically, use the formula: `10.0 * log10(sum(ref ** 2) / sum((ref - rec) ** 2))`.
- For spectral convergence, compare magnitude STFTs of the original and the reconstruction computed with the same analysis parameters (`n_fft = 2048`, `hop_length = 512`).

