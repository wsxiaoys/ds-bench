# Monophonic Onset-Based MIDI Note Transcriber

## Background
Build a small offline monophonic note transcriber on top of librosa. The transcriber reads a short audio file containing a sequence of synthesized notes, detects where each note begins, estimates its pitch, quantizes the pitch to the nearest MIDI integer, and assigns a velocity proportional to the loudness of each note. The result is written to a JSON file describing every detected note.

## Requirements
- Read the input audio from `/home/user/input.wav`.
- Detect note onsets using `librosa.onset.onset_detect` with `backtrack=True` so each onset is snapped back to the local energy minimum.
- For every per-note segment, estimate the fundamental frequency with `librosa.pyin` and use the median of the voiced f0 values as the segment's pitch.
- Convert each segment's pitch from Hz to a MIDI integer using `librosa.hz_to_midi`.
- Derive a per-note integer velocity in `[1, 127]` from the per-note RMS energy.
- Write the resulting list of notes to `/home/user/notes.json` as a single JSON array of note objects, sorted strictly in ascending order by onset time.
- Each note object must contain exactly four keys:
  - `onset_sec` (float, seconds from the start of the audio)
  - `offset_sec` (float, strictly greater than `onset_sec` and no greater than the audio duration plus 0.1s)
  - `pitch_midi` (integer in `[0, 127]`)
  - `velocity` (integer in `[1, 127]`)

