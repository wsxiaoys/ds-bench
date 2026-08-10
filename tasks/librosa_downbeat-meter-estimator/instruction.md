# Downbeat & Time-Signature (Meter) Estimator

## Background
You are building a rhythm-analysis command-line tool with **librosa** (Python audio library). Given a recording of a steady percussive rhythm, the tool must track the beats, then infer the musical **meter** (how many beats make up one bar, e.g. 3 for 3/4 or 4 for 4/4) and locate the **downbeats** (the first beat of every bar). This requires going beyond plain beat tracking: you must analyze how the accent pattern repeats across beats to recover both the bar length and its phase.

## Requirements
Implement a rerunnable CLI program that reads one audio file and writes one JSON result file:
- Track the beats of the input signal and report the beat times (in seconds).
- Report the estimated global tempo in beats per minute.
- Compute a per-beat accent signal from **beat-synchronous features**: derive it from BOTH a beat-synchronous onset-strength envelope AND a beat-synchronous chroma-based novelty (harmonic change) signal, so that beats which begin a bar stand out from the others.
- Estimate the **meter** = the number of beats per bar, chosen from the candidate bar lengths {2, 3, 4, 6}, by measuring which candidate best explains the periodicity of the per-beat accent signal.
- Determine the **downbeat phase**: the beat offset (0-based, in the range `[0, meter)`) at which bars start, chosen so that the accumulated accent on the selected downbeats is maximized.
- Report the downbeats both as indices into the beat array and as times in seconds.

## Implementation Hints
- Project path: /home/user/project
- Command: `python3 estimate_downbeats.py --input <input_wav_path> --output <output_json_path>`
- The input is a single-channel (mono) PCM WAV file. Load it at its native sample rate.
- The program must be deterministic: running it twice on the same input must produce identical output.
- Write the result as a single JSON **object** to the `--output` path with EXACTLY these keys:
  - `tempo`: number — estimated global tempo in BPM.
  - `beat_times`: array of numbers — beat times in seconds, strictly ascending.
  - `meter`: integer — one of `2`, `3`, `4`, `6`.
  - `downbeat_indices`: array of integers — indices into `beat_times` marking the downbeats, strictly ascending.
  - `downbeat_times`: array of numbers — must equal `beat_times` gathered at `downbeat_indices`, in the same order.
- Downbeats occur once per bar: the values in `downbeat_indices` must form an arithmetic sequence whose common difference equals `meter`, with the first index in the range `[0, meter)`.
- Every index in `downbeat_indices` must be a valid index into `beat_times`.
- The estimated `meter` must exactly match the true number of beats per bar of the input.
- The estimated `tempo` must be within 5% of the true tempo of the input.
- Each reported downbeat time must fall on a true accented (bar-starting) beat of the input, within a tolerance of half of one beat period (i.e. `0.5 * 60 / true_tempo` seconds).

