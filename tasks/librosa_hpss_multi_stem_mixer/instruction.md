# HPSS Multi-Stem Mixer

## Background
The file `/home/user/input.wav` is a short music recording. Build a small creative remixer that splits it into harmonic and percussive stems, processes each stem independently, and writes the mixed result back to disk.

## Requirements
Read `/home/user/input.wav` (preserving its native sample rate) and produce `/home/user/output.wav` by performing **exactly** the following steps, in order:

1. Decompose the input into harmonic and percussive time-domain components using `librosa.effects.hpss` with `margin=(1.0, 5.0)` (strong percussive mask).
2. Pitch-shift the harmonic component up by **7 semitones** using `librosa.effects.pitch_shift`.
3. Time-stretch the percussive component by a rate of **0.85** (i.e. slow it down) using `librosa.effects.time_stretch`.
4. Re-align the lengths of the pitch-shifted harmonic and the time-stretched percussive signals so they both have the same length as the original input waveform (pad with zeros or truncate as needed), and mix them with weights: `mix = 0.7 * harmonic_shifted + 0.5 * percussive_stretched`.
5. Trim leading and trailing silence from the mix with `librosa.effects.trim(top_db=30)`.
6. Write the result to `/home/user/output.wav` at the **same sample rate as the input**.

## Implementation Hints
- `librosa.effects.hpss` returns time-domain waveforms of the same length as the input.
- `librosa.effects.pitch_shift` preserves the input length, but `librosa.effects.time_stretch` changes it; you will need to pad/truncate before mixing.
- You may use `soundfile.write` to save the WAV.

