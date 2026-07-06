# Chord Recognition with Chroma + Viterbi Decoding

## Background
Build a simple major/minor chord recognition pipeline using `librosa`. The pipeline must consume a single audio file, derive chroma observations, score them against 24 chord templates (12 major + 12 minor), and use Hidden Markov Model (HMM)-style Viterbi decoding to produce a temporally smooth chord sequence. The decoded state sequence must then be summarized as time-aligned chord segments.

## Requirements
- Read the input WAV file from `/home/user/input.wav`.
- Detect chords from the set of 24 labels:
  `C:maj, C#:maj, D:maj, D#:maj, E:maj, F:maj, F#:maj, G:maj, G#:maj, A:maj, A#:maj, B:maj, C:min, C#:min, D:min, D#:min, E:min, F:min, F#:min, G:min, G#:min, A:min, A#:min, B:min`.
- Use chroma observations together with `librosa.sequence.viterbi` to decode the most likely chord state per frame.
- Merge consecutive frames that share the same decoded chord into segments and write them to `/home/user/chords.json` as a JSON array of objects. The array must be sorted chronologically by `start` time. Each segment object must conform to the following schema:
  - `start`: start time of the segment in seconds (floating-point number)
  - `end`: end time of the segment in seconds (floating-point number, with `start < end`)
  - `chord`: the decoded chord label string (one of the 24 allowed labels)

## Implementation Hints
- Use a librosa chroma feature appropriate for tonal content to obtain a `(12, n_frames)` observation matrix.
- Define 24 chord templates corresponding to major and minor triads (one per root pitch class) and turn them into per-frame, per-state non-negative likelihoods that the Viterbi routine can consume.
- Build a 24x24 transition matrix that favors staying in the current chord (self-bias) while still allowing transitions to any other chord; remember that each row must sum to 1.
- Convert the decoded frame indices to seconds with `librosa.frames_to_time` (using the same `hop_length` used to compute the chroma) and clamp the final segment end to the audio duration so the segments cover the full track from near 0s to the audio duration without gaps or overlaps.
- Ensure each individual merged segment has a duration of more than 0.1 seconds.
- The pipeline must produce real variation and not a constant output, containing at least 2 distinct chord labels in the decoded output.
- Sanity-check the API signatures against the librosa 0.11.0 documentation; most feature and sequence functions are keyword-only.

