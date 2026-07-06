"""Extract top-5 spectral peaks per frame from the reassigned spectrogram.

For each STFT frame, select the top-5 spectral bins ranked by the
reassigned magnitude (in dB). The bin's reassigned instantaneous frequency
(in Hz) and its dB magnitude are written to /home/user/peaks.json.
"""
import json
import math

import librosa
import numpy as np


def main():
    audio_path = "/home/user/input.wav"
    output_path = "/home/user/peaks.json"

    # Parameter choice. ``center=False`` is recommended by librosa for the
    # reassigned spectrogram (see function docstring) and keeps the trailing
    # frames within the audio duration + 1e-2 bound required by the spec.
    n_fft = 1024
    hop_length = 256
    center = False

    # Load audio at its native sample rate.
    y, sr = librosa.load(audio_path, sr=None)
    duration = float(len(y) / sr)

    # Compute the time-frequency reassigned spectrogram.
    # Returns (freqs, times, mags), each shaped (1 + n_fft/2, n_frames).
    # NaN appears in ``freqs`` (and ``times``) for bins below the reassignment
    # power threshold -- we must drop these before peak selection.
    freqs, rtimes, mags = librosa.reassigned_spectrogram(
        y=y,
        sr=sr,
        n_fft=n_fft,
        hop_length=hop_length,
        center=center,
    )

    n_freq_bins, n_frames = mags.shape
    assert freqs.shape == (n_freq_bins, n_frames)
    assert rtimes.shape == (n_freq_bins, n_frames)

    # Convert linear magnitudes to dB. Using ref=np.max so the loudest bin in
    # the whole spectrogram sits at 0 dB (librosa's display convention).
    mags_db = librosa.amplitude_to_db(mags, ref=np.max)

    # Build a mask of bins that must be excluded from peak selection:
    #   * NaN in the reassigned frequency  -> bin power below reassign threshold
    #   * NaN in the dB magnitude          -> propagated from the input
    nan_mask = np.isnan(freqs) | np.isnan(mags_db)

    # Frame-level time stamps. With center=False the natural frame time is
    # simply t * hop_length / sr.  This is monotonically non-decreasing, finite,
    # and stays within [0, duration] for all frames.
    frame_times = np.arange(n_frames) * hop_length / float(sr)

    # Pre-compute bin-center frequencies (used only as fallback padding if a
    # frame somehow contains fewer than 5 valid bins -- should not happen for
    # real audio but we stay defensive).
    bin_freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

    frames_out = []
    for t_idx in range(n_frames):
        col_mags = mags_db[:, t_idx]
        col_freqs = freqs[:, t_idx]
        valid = ~nan_mask[:, t_idx]

        valid_mags = col_mags[valid]
        valid_freqs = col_freqs[valid]

        k = 5
        if valid_mags.size >= k:
            # Partial selection in O(n) then sort the k winners by magnitude.
            cand = np.argpartition(-valid_mags, k - 1)[:k]
            cand = cand[np.argsort(-valid_mags[cand])]
            sel_mags = valid_mags[cand]
            sel_freqs = valid_freqs[cand]
        else:
            # Should not happen in practice, but pad to exactly k entries
            # with bin-center frequencies at -inf dB so the contract holds.
            order = np.argsort(-valid_mags)
            pad_count = k - valid_mags.size
            sel_mags = np.concatenate(
                [valid_mags[order], np.full(pad_count, -np.inf)]
            )
            pad_bins = np.argsort(-mags[:, t_idx])[:pad_count]
            sel_freqs = np.concatenate([valid_freqs[order], bin_freqs[pad_bins]])
            order = np.argsort(-sel_mags)
            sel_mags = sel_mags[order]
            sel_freqs = sel_freqs[order]

        peaks = [
            {"freq_hz": float(f), "magnitude_db": float(m)}
            for f, m in zip(sel_freqs, sel_mags)
        ]
        frames_out.append({"time": float(frame_times[t_idx]), "peaks": peaks})

    out = {
        "meta": {
            "n_frames": int(n_frames),
            "sr": int(sr),
            "n_fft": int(n_fft),
            "hop_length": int(hop_length),
        },
        "frames": frames_out,
    }

    with open(output_path, "w") as fh:
        json.dump(out, fh)

    # ---- Spec self-checks ---------------------------------------------------
    assert out["meta"]["n_frames"] == len(out["frames"]) == n_frames
    assert out["meta"]["sr"] == sr

    prev_t = -1.0
    for fr in out["frames"]:
        t = fr["time"]
        assert math.isfinite(t), f"non-finite time: {t}"
        assert 0.0 <= t <= duration + 1e-2, f"time out of bounds: {t}"
        assert t + 1e-12 >= prev_t, f"non-monotonic time: {prev_t} -> {t}"
        prev_t = t

        peaks = fr["peaks"]
        assert len(peaks) == 5, f"frame has {len(peaks)} peaks (expected 5)"
        mags_list = [p["magnitude_db"] for p in peaks]
        freqs_list = [p["freq_hz"] for p in peaks]
        for m in mags_list:
            assert math.isfinite(m), f"non-finite magnitude: {m}"
        for a, b in zip(mags_list, mags_list[1:]):
            assert a >= b, f"peaks not sorted descending: {mags_list}"
        for f in freqs_list:
            assert math.isfinite(f), f"non-finite freq: {f}"
            assert 0.0 < f <= sr / 2.0, f"freq out of range: {f}"

    last_time = out["frames"][-1]["time"]
    assert abs(last_time - duration) <= 0.1, (
        f"last frame {last_time} is more than 0.1s from duration {duration}"
    )

    print(f"Wrote {output_path}")
    print(
        f"  sr={sr}  n_fft={n_fft}  hop_length={hop_length}  center={center}  "
        f"n_frames={n_frames}"
    )
    print(f"  duration={duration:.4f}s  last_frame_time={last_time:.4f}s")


if __name__ == "__main__":
    main()