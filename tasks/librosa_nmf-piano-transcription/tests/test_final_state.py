import json
import os
import subprocess

import librosa
import numpy as np
import pytest
import soundfile as sf

PROJECT_DIR = "/home/user/project"
TRANSCRIBE = os.path.join(PROJECT_DIR, "transcribe.py")

SR = 22050
N_FFT = 2048
HOP = 512
MIDI_MIN = 48
MIDI_MAX = 72
N_PITCHES = MIDI_MAX - MIDI_MIN + 1  # 25

EVAL_MIXTURE = "/tmp/zeval_mixture.wav"
EVAL_OUT_DIR = "/tmp/zeval_out"
PIANO_ROLL_PATH = os.path.join(EVAL_OUT_DIR, "piano_roll.npy")
NOTES_PATH = os.path.join(EVAL_OUT_DIR, "notes.json")

# Ground-truth note sequence embedded in the verifier.
# Each entry: (onset_seconds, [midi pitches]). Duration is fixed at 0.7 s.
CHORD_DURATION = 0.7
NOTE_SEQUENCE = [
    (0.3, [60, 64, 67]),
    (1.2, [62, 65, 69]),
    (2.1, [59, 62, 67]),
    (3.0, [60, 64]),
    (3.9, [55, 58, 62]),
    (4.8, [57, 60, 64]),
    (5.7, [53, 57]),
    (6.6, [48, 60, 67]),
]
TOTAL_DURATION = 7.6  # seconds


def _synthesize_tone(midi, n_samples, sr=SR):
    """Harmonic tone: fundamental + 6 integer harmonics with 1/h amplitude decay."""
    f0 = float(librosa.midi_to_hz(midi))
    t = np.arange(n_samples, dtype=np.float64) / sr
    sig = np.zeros(n_samples, dtype=np.float64)
    for h in range(1, 7):
        sig += (1.0 / h) * np.sin(2.0 * np.pi * h * f0 * t)
    # 10 ms linear fade in/out to avoid clicks
    fade = int(0.01 * sr)
    if fade > 0 and n_samples > 2 * fade:
        env = np.ones(n_samples, dtype=np.float64)
        env[:fade] = np.linspace(0.0, 1.0, fade)
        env[-fade:] = np.linspace(1.0, 0.0, fade)
        sig *= env
    return sig


def _generate_ground_truth_audio(seed=20260723):
    rng = np.random.default_rng(seed)
    n_total = int(round(TOTAL_DURATION * SR))
    y = np.zeros(n_total, dtype=np.float64)
    note_len = int(round(CHORD_DURATION * SR))
    for onset, pitches in NOTE_SEQUENCE:
        start = int(round(onset * SR))
        for p in pitches:
            tone = 0.3 * _synthesize_tone(p, note_len)
            end = min(start + note_len, n_total)
            y[start:end] += tone[: end - start]
    # low-level additive broadband noise
    y += rng.normal(0.0, 0.01, size=n_total)
    peak = np.max(np.abs(y))
    if peak > 0:
        y = 0.9 * y / peak
    return y.astype(np.float32)


def _build_ground_truth(n_frames):
    """Binary piano-roll (N_PITCHES, n_frames) and note list from NOTE_SEQUENCE."""
    frame_times = librosa.frames_to_time(
        np.arange(n_frames), sr=SR, hop_length=HOP
    )
    roll = np.zeros((N_PITCHES, n_frames), dtype=np.int64)
    notes = []
    for onset, pitches in NOTE_SEQUENCE:
        offset = onset + CHORD_DURATION
        for p in pitches:
            row = p - MIDI_MIN
            active = (frame_times >= onset) & (frame_times < offset)
            roll[row, active] = 1
            notes.append({"pitch": int(p), "onset_time": float(onset),
                          "offset_time": float(offset)})
    return roll, notes


def _prf(tp, fp, fn):
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    if precision + recall == 0:
        return precision, recall, 0.0
    f = 2 * precision * recall / (precision + recall)
    return precision, recall, f


def _runs_from_row(row):
    """Return list of (start, end_exclusive) runs of 1s in a binary row."""
    runs = []
    in_run = False
    start = 0
    for i, v in enumerate(row):
        if v == 1 and not in_run:
            in_run = True
            start = i
        elif v == 0 and in_run:
            in_run = False
            runs.append((start, i))
    if in_run:
        runs.append((start, len(row)))
    return runs


@pytest.fixture(scope="module")
def run_transcriber():
    # Clean previous outputs
    for pth in (PIANO_ROLL_PATH, NOTES_PATH):
        if os.path.exists(pth):
            os.remove(pth)
    os.makedirs(EVAL_OUT_DIR, exist_ok=True)

    # Synthesize deterministic evaluation mixture
    y = _generate_ground_truth_audio()
    sf.write(EVAL_MIXTURE, y, SR)

    result = subprocess.run(
        ["python3", TRANSCRIBE, "--input", EVAL_MIXTURE,
         "--output-dir", EVAL_OUT_DIR],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=600,
    )
    return result


def test_program_runs_and_outputs_exist(run_transcriber):
    result = run_transcriber
    assert result.returncode == 0, (
        f"transcribe.py exited with code {result.returncode}.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert os.path.isfile(PIANO_ROLL_PATH), (
        f"Expected piano-roll output at {PIANO_ROLL_PATH}."
    )
    assert os.path.isfile(NOTES_PATH), (
        f"Expected note list output at {NOTES_PATH}."
    )


def _expected_n_frames():
    y, _ = librosa.load(EVAL_MIXTURE, sr=SR, mono=True)
    return librosa.stft(y, n_fft=N_FFT, hop_length=HOP).shape[1]


def test_piano_roll_format(run_transcriber):
    assert run_transcriber.returncode == 0, "transcribe.py must succeed first."
    pr = np.load(PIANO_ROLL_PATH)
    assert pr.ndim == 2, f"piano_roll must be 2-D, got shape {pr.shape}."
    n_frames = _expected_n_frames()
    assert pr.shape == (N_PITCHES, n_frames), (
        f"piano_roll shape must be ({N_PITCHES}, {n_frames}), got {pr.shape}."
    )
    pr_int = np.asarray(pr)
    assert np.array_equal(pr_int, pr_int.astype(np.int64)), (
        "piano_roll must contain only integer values 0 and 1."
    )
    uniq = set(np.unique(pr_int.astype(np.int64)).tolist())
    assert uniq.issubset({0, 1}), (
        f"piano_roll must contain only 0 and 1, found values: {sorted(uniq)}."
    )


def test_notes_json_format(run_transcriber):
    assert run_transcriber.returncode == 0, "transcribe.py must succeed first."
    with open(NOTES_PATH) as f:
        notes = json.load(f)
    assert isinstance(notes, list), "notes.json must be a JSON array."
    prev_key = None
    for obj in notes:
        assert isinstance(obj, dict), "Each note must be a JSON object."
        assert set(obj.keys()) == {"pitch", "onset_time", "offset_time"}, (
            f"Each note must have exactly keys pitch/onset_time/offset_time, "
            f"got {sorted(obj.keys())}."
        )
        assert isinstance(obj["pitch"], int) and not isinstance(obj["pitch"], bool), (
            "pitch must be an integer MIDI number."
        )
        assert MIDI_MIN <= obj["pitch"] <= MIDI_MAX, (
            f"pitch {obj['pitch']} must be within [{MIDI_MIN}, {MIDI_MAX}]."
        )
        assert float(obj["offset_time"]) > float(obj["onset_time"]), (
            "offset_time must be strictly greater than onset_time."
        )
        key = (float(obj["onset_time"]), int(obj["pitch"]))
        if prev_key is not None:
            assert key >= prev_key, (
                "notes.json must be sorted by (onset_time, pitch) ascending."
            )
        prev_key = key


def test_frame_level_f_measure(run_transcriber):
    assert run_transcriber.returncode == 0, "transcribe.py must succeed first."
    pr = np.load(PIANO_ROLL_PATH).astype(np.int64)
    n_frames = _expected_n_frames()
    assert pr.shape == (N_PITCHES, n_frames), (
        f"piano_roll shape must be ({N_PITCHES}, {n_frames}), got {pr.shape}."
    )
    gt_roll, _ = _build_ground_truth(n_frames)
    tp = int(np.sum((pr == 1) & (gt_roll == 1)))
    fp = int(np.sum((pr == 1) & (gt_roll == 0)))
    fn = int(np.sum((pr == 0) & (gt_roll == 1)))
    precision, recall, f = _prf(tp, fp, fn)
    assert f >= 0.85, (
        f"Frame-level F-measure {f:.3f} is below 0.85 "
        f"(precision={precision:.3f}, recall={recall:.3f})."
    )


def test_note_level_f_measure(run_transcriber):
    assert run_transcriber.returncode == 0, "transcribe.py must succeed first."
    with open(NOTES_PATH) as f:
        pred_notes = json.load(f)
    n_frames = _expected_n_frames()
    _, gt_notes = _build_ground_truth(n_frames)

    gt_matched = [False] * len(gt_notes)
    tp = 0
    for pn in sorted(pred_notes, key=lambda o: (float(o["onset_time"]), int(o["pitch"]))):
        p = int(pn["pitch"])
        onset = float(pn["onset_time"])
        best = -1
        best_diff = None
        for i, gn in enumerate(gt_notes):
            if gt_matched[i] or gn["pitch"] != p:
                continue
            diff = abs(onset - gn["onset_time"])
            if diff <= 0.060 and (best_diff is None or diff < best_diff):
                best_diff = diff
                best = i
        if best >= 0:
            gt_matched[best] = True
            tp += 1
    fp = len(pred_notes) - tp
    fn = len(gt_notes) - tp
    precision, recall, f = _prf(tp, fp, fn)
    assert f >= 0.80, (
        f"Note-level F-measure {f:.3f} is below 0.80 "
        f"(precision={precision:.3f}, recall={recall:.3f}, "
        f"tp={tp}, fp={fp}, fn={fn})."
    )


def test_notes_consistent_with_piano_roll(run_transcriber):
    assert run_transcriber.returncode == 0, "transcribe.py must succeed first."
    pr = np.load(PIANO_ROLL_PATH).astype(np.int64)
    with open(NOTES_PATH) as f:
        pred_notes = json.load(f)

    # Enumerate maximal active runs across all pitch rows.
    roll_onsets = []  # (pitch, onset_frame)
    n_runs = 0
    for row_idx in range(pr.shape[0]):
        for (s, _e) in _runs_from_row(pr[row_idx]):
            n_runs += 1
            roll_onsets.append((MIDI_MIN + row_idx, s))

    assert len(pred_notes) == n_runs, (
        f"Number of notes ({len(pred_notes)}) must equal the number of maximal "
        f"active runs in the piano-roll ({n_runs})."
    )

    # Every note onset must correspond to a run start (frame index) for that pitch.
    roll_set = {}
    for pitch, s in roll_onsets:
        roll_set.setdefault(pitch, []).append(s)

    for pn in pred_notes:
        p = int(pn["pitch"])
        onset_frame = int(round(float(pn["onset_time"]) * SR / HOP))
        starts = roll_set.get(p, [])
        assert any(abs(onset_frame - s) <= 1 for s in starts), (
            f"Note pitch {p} onset_time {pn['onset_time']:.3f}s (frame ~{onset_frame}) "
            f"does not align with any active run start in the piano-roll."
        )
