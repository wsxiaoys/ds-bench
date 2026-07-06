# Laplacian Structural Music Segmentation

## Background
Use `librosa` 0.11.0 to build a structural music segmentation pipeline that recovers song-section boundaries and re-uses cluster identities (A/B/A...) across repeating sections. The pipeline must beat-track the input, extract a beat-synchronous tonal feature, build a weighted recurrence graph that mixes path-enhanced repetition with sequential affinity, embed frames via the symmetric normalized graph Laplacian, and assign one section label per frame using temporally-constrained agglomerative clustering before mapping the labels back to absolute time intervals.

## Requirements
- Read the input WAV file from `/home/user/input.wav`.
- Detect beats, then aggregate a tonal feature (CQT magnitude or `chroma_cqt`) into beat-synchronous frames using `librosa.util.sync`.
- Construct a recurrence-based affinity matrix and enhance its diagonal paths with `librosa.segment.path_enhance`.
- Combine the path-enhanced repetition graph with a sequential (local) affinity term into a single symmetric weighted adjacency.
- Compute the symmetric normalized graph Laplacian, take its bottom eigenvectors, normalize the chosen eigenvector embedding, and cluster the per-beat embeddings into a small number of section types.
- Map cluster ids back to contiguous time intervals and write them to `/home/user/segments.json` as a JSON array of segment objects sorted chronologically by `start` time. Each segment object must contain:
  - `start`: numeric start timestamp in seconds (the first segment must start within 0.3 seconds of 0).
  - `end`: numeric end timestamp in seconds (the last segment must end within 0.5 seconds of the audio duration), satisfying `start < end`.
  - `label`: a single uppercase letter (e.g., `"A"`, `"B"`, `"C"`) matching the regex `^[A-Z]$`.

## Implementation Hints
- All `librosa` 0.11.0 feature/segment APIs are keyword-only except for primary data arrays. Verify signatures before calling.
- You may use any of: `librosa.load`, `librosa.beat.beat_track`, `librosa.cqt`, `librosa.feature.chroma_cqt`, `librosa.util.sync`, `librosa.util.fix_frames`, `librosa.segment.recurrence_matrix`, `librosa.segment.path_enhance`, `librosa.segment.agglomerative`, `librosa.frames_to_time`, plus NumPy / SciPy / scikit-learn helpers for eigendecomposition and clustering.
- Choose the Laplacian normalization, the number of eigenvectors `K`, the number of clusters, and the relative weighting of repetition vs. sequential affinity yourself; defaults that work on the librosa segmentation gallery example are a reasonable starting point.
- The audio at `/home/user/input.wav` is mono at 22050 Hz and has a clear A/B/A-style structure, so the output must demonstrate that at least one section label is re-used (proving repetition recovery, not just temporal partitioning).
- Ensure adjacent segments have no gaps larger than 0.3 seconds and no overlaps larger than 0.05 seconds.
- Each segment must have a duration strictly greater than 0.5 seconds.
- The output must contain at least 3 segments total, with at least 2 distinct labels, and at least one label must be reused across multiple segments.

