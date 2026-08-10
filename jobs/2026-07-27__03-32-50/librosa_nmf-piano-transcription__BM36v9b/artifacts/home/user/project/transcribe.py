#!/usr/bin/env python3
"""
NMF Template-Based Polyphonic Piano Transcription
==================================================

Supervised (fixed-basis) NMF transcriber.

Pipeline
--------
1. Build a fixed spectral template dictionary ``W`` (shape ``(n_freq_bins, 25)``)
   covering MIDI pitches 48-72 inclusive.  Each column is the magnitude
   spectrum (computed with the *same* STFT settings used for analysis) of a
   harmonic tone that we synthesize deterministically (fundamental + decaying
   integer harmonics).
2. Compute the magnitude spectrogram ``V`` of the input mixture.
3. Estimate a non-negative activation matrix ``H`` such that ``V ~= W @ H``
   while keeping ``W`` fixed.  This is done frame-by-frame with non-negative
   least squares (``scipy.optimize.nnls``), which is the exact solution of
   ``min_h >= 0 ||W h - v||_2`` for a fixed dictionary.
4. Post-process ``H`` into a clean binary piano-roll: normalize, threshold,
   and apply morphological open/close operations along time to remove
   spurious single-frame activity while closing tiny gaps inside notes.
5. Derive note on/off segments from the piano-roll and write both artifacts.

Usage
-----
    python3 transcribe.py --input <input_wav_path> --output-dir <output_dir>
"""

import argparse
import json
import os

import numpy as np
import librosa
from scipy.optimize import nnls
from scipy.ndimage import binary_closing, binary_opening

# ---------------------------------------------------------------------------
# Fixed analysis parameters (must match the task specification exactly).
# ---------------------------------------------------------------------------
SR = 22050
N_FFT = 2048
HOP_LENGTH = 512

MIN_MIDI = 48
MAX_MIDI = 72
N_PITCHES = MAX_MIDI - MIN_MIDI + 1  # 25

# ---------------------------------------------------------------------------
# Template synthesis parameters.
# ---------------------------------------------------------------------------
TEMPLATE_DURATION = 0.5      # seconds of synthesized tone used to build a template
HARMONIC_DECAY = 1.0         # amplitude of harmonic h ~ 1 / h**HARMONIC_DECAY
MAX_HARMONICS = 25           # hard cap on number of harmonics considered
NYQUIST_GUARD = 0.95         # keep harmonics below this fraction of Nyquist

# ---------------------------------------------------------------------------
# Post-processing parameters.
# ---------------------------------------------------------------------------
REL_THRESHOLD = 0.22         # fraction of global max(H) used as activation threshold
MIN_ACTIVE_FRAMES = 3        # remove runs of active frames shorter than this (opening)
MAX_GAP_FRAMES = 2           # fill gaps of inactive frames shorter than this (closing)
SILENCE_ENERGY_REL = 0.01    # frames whose spectral energy is below this fraction of
                             # the recording's peak frame energy are treated as silence
                             # (no pitch can be active there), guarding against spurious
                             # noise-driven activations during quiet/silent passages.


def midi_to_freq(midi):
    """Standard equal-tempered mapping, A4 (MIDI 69) = 440 Hz."""
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def synth_harmonic_tone(midi, sr=SR, duration=TEMPLATE_DURATION,
                         decay=HARMONIC_DECAY, max_harmonics=MAX_HARMONICS,
                         nyquist_guard=NYQUIST_GUARD):
    """Deterministically synthesize a harmonic tone (fundamental + integer
    harmonics with a 1/h**decay amplitude roll-off) for the given MIDI pitch.
    """
    f0 = midi_to_freq(midi)
    n_samples = int(round(sr * duration))
    t = np.arange(n_samples) / float(sr)
    y = np.zeros(n_samples, dtype=np.float64)

    nyquist = sr / 2.0
    h = 1
    while h <= max_harmonics and (f0 * h) < (nyquist_guard * nyquist):
        amp = 1.0 / (h ** decay)
        y += amp * np.sin(2.0 * np.pi * f0 * h * t)
        h += 1

    return y


def build_template_dictionary():
    """Build the fixed template dictionary W with one unit-norm magnitude
    spectrum column per MIDI pitch in [MIN_MIDI, MAX_MIDI].
    """
    columns = []
    for midi in range(MIN_MIDI, MAX_MIDI + 1):
        y = synth_harmonic_tone(midi)
        S = librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH, center=True)
        mag = np.abs(S)
        # Use a frame from the interior of the tone (steady state, away from
        # the zero-padded / fade-in edges introduced by centered STFT).
        mid = mag.shape[1] // 2
        col = mag[:, mid].astype(np.float64)
        norm = np.linalg.norm(col)
        if norm > 0:
            col = col / norm
        columns.append(col)

    W = np.stack(columns, axis=1)  # (n_freq_bins, N_PITCHES)
    return W


def estimate_activations(W, V):
    """Estimate H (non-negative) such that V ~= W @ H, with W fixed, by
    solving an independent non-negative least squares problem per frame.
    """
    n_bins, n_pitches = W.shape
    n_frames = V.shape[1]
    H = np.zeros((n_pitches, n_frames), dtype=np.float64)

    for t in range(n_frames):
        v = V[:, t]
        h, _residual = nnls(W, v)
        H[:, t] = h

    return H


def postprocess_to_piano_roll(H, V=None):
    """Convert the raw activation matrix H into a clean binary piano-roll."""
    global_max = H.max()
    if global_max <= 0:
        return np.zeros(H.shape, dtype=np.int64)

    threshold = REL_THRESHOLD * global_max
    binary = H > threshold

    if V is not None:
        # Gate out frames that carry essentially no spectral energy at all
        # (silence / pure noise). Without this, normalizing H by its own
        # global max can make tiny noise-driven activations cross a purely
        # *relative* threshold during silent passages.
        frame_energy = np.sum(V.astype(np.float64) ** 2, axis=0)
        peak_energy = frame_energy.max()
        if peak_energy > 0:
            silence_mask = frame_energy < (SILENCE_ENERGY_REL * peak_energy)
            binary[:, silence_mask] = False

    # Close tiny gaps (fill short inactive runs inside what is otherwise a
    # sustained note) then open (remove spurious short bursts) along time,
    # independently for each pitch row.
    close_struct = np.ones(MAX_GAP_FRAMES + 1, dtype=bool)
    open_struct = np.ones(MIN_ACTIVE_FRAMES, dtype=bool)

    cleaned = np.zeros(binary.shape, dtype=bool)
    for p in range(binary.shape[0]):
        row = binary[p]
        row = binary_closing(row, structure=close_struct)
        row = binary_opening(row, structure=open_struct)
        cleaned[p] = row

    return cleaned.astype(np.int64)


def piano_roll_to_notes(piano_roll, sr=SR, hop_length=HOP_LENGTH, min_midi=MIN_MIDI):
    """Derive a list of note events (pitch, onset_time, offset_time) from a
    binary piano-roll by finding maximal runs of consecutive active frames
    per pitch row.
    """
    notes = []
    n_pitches, n_frames = piano_roll.shape

    for p in range(n_pitches):
        pitch = min_midi + p
        row = piano_roll[p]

        in_run = False
        start = None
        for t in range(n_frames):
            active = row[t] != 0
            if active and not in_run:
                in_run = True
                start = t
            elif not active and in_run:
                in_run = False
                onset_time = start * hop_length / float(sr)
                offset_time = t * hop_length / float(sr)
                notes.append({
                    "pitch": int(pitch),
                    "onset_time": float(onset_time),
                    "offset_time": float(offset_time),
                })
        if in_run:
            onset_time = start * hop_length / float(sr)
            offset_time = n_frames * hop_length / float(sr)
            notes.append({
                "pitch": int(pitch),
                "onset_time": float(onset_time),
                "offset_time": float(offset_time),
            })

    notes.sort(key=lambda n: (n["onset_time"], n["pitch"]))
    return notes


def transcribe(input_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)

    # --- Load audio -------------------------------------------------------
    y, sr = librosa.load(input_path, sr=SR, mono=True)

    # --- Fixed template dictionary -----------------------------------------
    W = build_template_dictionary()

    # --- Magnitude spectrogram of the mixture -------------------------------
    S = librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH, center=True)
    V = np.abs(S).astype(np.float64)

    # --- Fixed-W activation estimation --------------------------------------
    H = estimate_activations(W, V)

    # --- Post-processing to binary piano-roll -------------------------------
    piano_roll = postprocess_to_piano_roll(H, V)

    # --- Notes ---------------------------------------------------------------
    notes = piano_roll_to_notes(piano_roll, sr=SR, hop_length=HOP_LENGTH, min_midi=MIN_MIDI)

    # --- Write artifacts -------------------------------------------------------
    piano_roll_path = os.path.join(output_dir, "piano_roll.npy")
    notes_path = os.path.join(output_dir, "notes.json")

    np.save(piano_roll_path, piano_roll.astype(np.int64))
    with open(notes_path, "w") as f:
        json.dump(notes, f, indent=2)

    return piano_roll, notes


def main():
    parser = argparse.ArgumentParser(description="NMF template-based polyphonic piano transcription.")
    parser.add_argument("--input", required=True, help="Path to the input mixture WAV file.")
    parser.add_argument("--output-dir", required=True, help="Directory to write piano_roll.npy and notes.json to.")
    args = parser.parse_args()

    transcribe(args.input, args.output_dir)


if __name__ == "__main__":
    main()
