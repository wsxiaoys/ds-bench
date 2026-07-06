#!/usr/bin/env python3
"""
HPSS Multi-Stem Mixer.

Read /home/user/input.wav, split into harmonic + percussive stems,
process each stem independently, then mix and save the result to
/home/user/output.wav.
"""

import librosa
import numpy as np
import soundfile as sf


INPUT_PATH = "/home/user/input.wav"
OUTPUT_PATH = "/home/user/output.wav"


def main() -> None:
    # 1. Load input waveform preserving its native sample rate.
    y, sr = librosa.load(INPUT_PATH, sr=None, mono=False)

    # If the file is stereo, average to mono for HPSS / pitch_shift / time_stretch,
    # following the convention used by librosa.effects.hpss on multi-channel input.
    if y.ndim > 1:
        y_mono = np.mean(y, axis=0)
    else:
        y_mono = y

    # 2. Decompose into harmonic and percussive time-domain components.
    harmonic, percussive = librosa.effects.hpss(y_mono, margin=(1.0, 5.0))

    # 3. Pitch-shift the harmonic component up by 7 semitones.
    harmonic_shifted = librosa.effects.pitch_shift(
        harmonic, sr=sr, n_steps=7
    )

    # 4. Time-stretch the percussive component by 0.85 (slow it down).
    percussive_stretched = librosa.effects.time_stretch(
        percussive, rate=0.85
    )

    # 5. Re-align lengths to match the original input length.
    target_len = y_mono.shape[-1]

    def fit_length(sig: np.ndarray, length: int) -> np.ndarray:
        if sig.shape[-1] == length:
            return sig
        if sig.shape[-1] > length:
            return sig[..., :length]
        # Pad with zeros to the right.
        pad_width = length - sig.shape[-1]
        pad_shape = list(sig.shape)
        pad_shape[-1] = pad_width
        pad = np.zeros(pad_shape, dtype=sig.dtype)
        return np.concatenate([sig, pad], axis=-1)

    harmonic_aligned = fit_length(harmonic_shifted, target_len)
    percussive_aligned = fit_length(percussive_stretched, target_len)

    # 6. Mix with the prescribed weights.
    mix = 0.7 * harmonic_aligned + 0.5 * percussive_aligned

    # 7. Trim leading/trailing silence.
    mix_trimmed, _ = librosa.effects.trim(mix, top_db=30)

    # 8. Write the result at the same sample rate as the input.
    sf.write(OUTPUT_PATH, mix_trimmed, sr)
    print(f"Wrote {OUTPUT_PATH} (sr={sr}, samples={mix_trimmed.shape[-1]})")


if __name__ == "__main__":
    main()
