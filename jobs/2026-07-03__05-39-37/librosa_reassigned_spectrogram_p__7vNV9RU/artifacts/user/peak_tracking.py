#!/usr/bin/env python3
"""Reassigned spectrogram peak tracking.

Reads /home/user/input.wav, computes the time-frequency reassigned
spectgram with librosa, extracts the top-5 spectral peaks (by reassigned
magnitude in dB) for every STFT frame, and writes the result to
/home/user/peaks.json.
"""

import json
import numpy as np
import librosa


INPUT_PATH = "/home/user/input.wav"
OUTPUT_PATH = "/home/user/peaks.json"

# Parameters chosen for a deterministic frame count on a 22050 Hz, ~5 s input.
# center=True is the librosa default; with n_fft=2048 / hop_length=512 this
# yields 216 frames whose frame times lie in [0, duration] with the last frame
# well within 0.1 s of the audio duration.
N_FFT = 2048
HOP_LENGTH = 512
TOP_K = 5


def main() -> None:
    # Load audio at its native sample rate (no resampling).
    y, sr = librosa.load(INPUT_PATH, sr=None)

    # Reassigned spectrogram returns (freqs, times, mags), each of shape
    # (1 + n_fft/2, n_frames).  freqs holds the reassigned instantaneous
    # frequency per bin/frame; mags holds the STFT magnitude (linear).
    freqs, times, mags = librosa.reassigned_spectrogram(
        y=y,
        sr=sr,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        center=True,
    )

    n_frames = int(freqs.shape[1])

    # Convert linear magnitudes to decibels using the librosa helper.
    mags_db = librosa.amplitude_to_db(mags, ref=np.max)

    frames_out = []
    for t in range(n_frames):
        frame_freqs = freqs[:, t]
        frame_db = mags_db[:, t]

        # A bin is eligible for peak selection only when it has a finite,
        # in-range reassigned frequency and a finite dB magnitude.  Bins whose
        # power falls below the reassignment threshold are returned as NaN in
        # the frequency array; these are excluded here so NaN never propagates
        # into the output or breaks the sort.
        valid = (
            np.isfinite(frame_freqs)
            & np.isfinite(frame_db)
            & (frame_freqs > 0.0)
            & (frame_freqs <= sr / 2.0)
        )

        idx = np.flatnonzero(valid)
        if idx.size == 0:
            # No eligible bins for this frame: emit an empty peak list.  (Does
            # not occur for this input, but keeps the code robust.)
            peaks = []
        else:
            # Rank eligible bins by magnitude in descending order and take the
            # top-K.  argsort on the negated dB values gives descending order;
            # ties are broken deterministically by bin index.
            order = idx[np.argsort(-frame_db[idx], kind="stable")]
            selected = order[:TOP_K]

            peaks = [
                {
                    "freq_hz": float(frame_freqs[i]),
                    "magnitude_db": float(frame_db[i]),
                }
                for i in selected
            ]

        # Frame time: with center=True, frame t is centered at sample t*hop,
        # so its time in seconds is t * hop_length / sr.
        frame_time = float(t * HOP_LENGTH / sr)

        frames_out.append({"time": frame_time, "peaks": peaks})

    result = {
        "meta": {
            "n_frames": n_frames,
            "sr": float(sr),
            "n_fft": int(N_FFT),
            "hop_length": int(HOP_LENGTH),
        },
        "frames": frames_out,
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Wrote {OUTPUT_PATH}: {n_frames} frames, sr={sr}, "
          f"n_fft={N_FFT}, hop_length={HOP_LENGTH}")


if __name__ == "__main__":
    main()