import librosa
import numpy as np
import scipy
import scipy.sparse
import scipy.linalg
import scipy.ndimage
import sklearn.cluster
import json

def main():
    audio_path = '/home/user/input.wav'
    output_path = '/home/user/segments.json'
    
    # Load audio
    print(f"Loading audio from {audio_path}...")
    y, sr = librosa.load(audio_path, sr=None)
    duration = librosa.get_duration(y=y, sr=sr)
    print(f"Audio duration: {duration:.2f} seconds, Sample rate: {sr}")
    
    # 1. Beat tracking via onset envelope
    print("Tracking beats...")
    oenv = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr)
    n_beats = len(beats)
    print(f"Detected {n_beats} beats. Tempo: {tempo}")
    
    if n_beats < 5:
        raise ValueError("Too few beats detected to perform structural segmentation.")
        
    # Get beat times
    beat_times = librosa.frames_to_time(beats, sr=sr)
    
    # 2. Extract beat-synchronous CQT features
    print("Extracting CQT features...")
    BINS_PER_OCTAVE = 12 * 3
    N_OCTAVES = 7
    C = librosa.amplitude_to_db(
        np.abs(librosa.cqt(y=y, sr=sr, bins_per_octave=BINS_PER_OCTAVE, n_bins=N_OCTAVES * BINS_PER_OCTAVE)),
        ref=np.max
    )
    Csync = librosa.util.sync(C, beats, aggregate=np.median)
    print(f"Csync shape: {Csync.shape}")
    
    # 3. Construct recurrence-based affinity matrix
    print("Constructing recurrence matrix...")
    # width=3 prevents links within the same bar
    R = librosa.segment.recurrence_matrix(Csync, width=3, mode='affinity', sym=True)
    
    # 4. Path enhancement on recurrence matrix
    print("Enhancing diagonal paths...")
    # We choose a smoothing filter length n. Since the track is 33s, 50 beats,
    # n=15 is a reasonable filter length.
    R_smooth = librosa.segment.path_enhance(R, n=15, window='hann', n_filters=7)
    
    # 5. Compute sequential (local) affinity
    print("Computing sequential affinity...")
    path_distance = np.sum(np.diff(Csync, axis=1)**2, axis=0)
    sigma = np.median(path_distance)
    if sigma == 0:
        sigma = 1e-5
    path_sim = np.exp(-path_distance / sigma)
    R_path = np.diag(path_sim, k=1) + np.diag(path_sim, k=-1)
    
    # 6. Combine path-enhanced repetition with sequential affinity
    print("Combining graphs...")
    deg_path = np.sum(R_path, axis=1)
    deg_rec = np.sum(R_smooth, axis=1)
    denom = np.sum((deg_path + deg_rec)**2)
    if denom == 0:
        mu = 0.5
    else:
        mu = deg_path.dot(deg_path + deg_rec) / denom
    A = mu * R_smooth + (1 - mu) * R_path
    
    # 7. Compute symmetric normalized graph Laplacian and bottom eigenvectors
    print("Computing graph Laplacian and eigenvectors...")
    L = scipy.sparse.csgraph.laplacian(A, normed=True)
    evals, evecs = scipy.linalg.eigh(L)
    
    # Smooth eigenvectors to clean up discontinuities
    evecs = scipy.ndimage.median_filter(evecs, size=(9, 1))
    
    # Normalize eigenvectors
    Cnorm = np.cumsum(evecs**2, axis=1)**0.5
    k_eigen = min(5, n_beats)
    X = evecs[:, :k_eigen] / Cnorm[:, k_eigen-1:k_eigen]
    
    # 8. Temporally-constrained agglomerative clustering
    # We want to partition the beats into a small number of contiguous segments.
    # Let's use 6 segments.
    k_segments = min(6, n_beats - 1)
    print(f"Clustering beats into {k_segments} contiguous segments...")
    boundaries = librosa.segment.agglomerative(X.T, k_segments)
    print("Detected boundaries (beat indices):", boundaries)
    
    # Map boundaries to include the end of the track
    bound_beats = list(boundaries) + [n_beats]
    
    # 9. Compute segment features and cluster them to reuse labels
    print("Clustering segment features for label reuse...")
    segment_features = []
    for start, end in zip(bound_beats[:-1], bound_beats[1:]):
        seg_feat = np.mean(X[start:end], axis=0)
        segment_features.append(seg_feat)
    segment_features = np.array(segment_features)
    
    # We want 2 distinct labels (e.g. A and B)
    n_labels = 2
    KM = sklearn.cluster.KMeans(n_clusters=n_labels, random_state=42)
    segment_labels = KM.fit_predict(segment_features)
    print("Segment labels:", segment_labels)
    
    # Map cluster IDs to uppercase letters (first cluster seen gets 'A', next 'B')
    label_map = {}
    next_char = ord('A')
    for lbl in segment_labels:
        if lbl not in label_map:
            label_map[lbl] = chr(next_char)
            next_char += 1
            
    mapped_labels = [label_map[lbl] for lbl in segment_labels]
    print("Mapped segment labels:", mapped_labels)
    
    # 10. Map back to absolute time intervals
    print("Mapping segments to absolute times...")
    raw_segments = []
    for i, (start_beat, end_beat) in enumerate(zip(bound_beats[:-1], bound_beats[1:])):
        # Start time: first segment starts at 0.0, others start at the corresponding beat time
        if i == 0:
            start_time = 0.0
        else:
            start_time = float(beat_times[start_beat])
            
        # End time: last segment ends at the audio duration, others end at the corresponding beat time
        if i == len(bound_beats) - 2:
            end_time = float(duration)
        else:
            end_time = float(beat_times[end_beat])
            
        raw_segments.append({
            'start': start_time,
            'end': end_time,
            'label': mapped_labels[i]
        })
        
    print("Raw segments before merging:")
    for seg in raw_segments:
        print(f"  {seg['start']:.2f} - {seg['end']:.2f}: {seg['label']}")
        
    # 11. Merge adjacent segments with the same label
    merged_segments = []
    for seg in raw_segments:
        if not merged_segments:
            merged_segments.append(seg)
        else:
            prev = merged_segments[-1]
            if prev['label'] == seg['label']:
                # Merge them by updating the end time of the previous segment
                prev['end'] = seg['end']
            else:
                merged_segments.append(seg)
                
    print("Merged segments:")
    for seg in merged_segments:
        print(f"  {seg['start']:.2f} - {seg['end']:.2f}: {seg['label']}")
        
    # 12. Validate all constraints
    print("Validating constraints...")
    # First segment must start within 0.3 seconds of 0
    assert merged_segments[0]['start'] <= 0.3, f"First segment starts at {merged_segments[0]['start']}s (> 0.3s)"
    # Last segment must end within 0.5 seconds of the audio duration
    assert abs(merged_segments[-1]['end'] - duration) <= 0.5, f"Last segment ends at {merged_segments[-1]['end']}s (duration={duration}s)"
    # Each segment must have start < end
    for seg in merged_segments:
        assert seg['start'] < seg['end'], f"Invalid segment: start={seg['start']}, end={seg['end']}"
    # Adjacent segments have no gaps larger than 0.3 seconds and no overlaps larger than 0.05 seconds
    for i in range(len(merged_segments) - 1):
        gap = merged_segments[i+1]['start'] - merged_segments[i]['end']
        assert -0.05 <= gap <= 0.3, f"Invalid gap/overlap between segment {i} and {i+1}: {gap}s"
    # Each segment must have a duration strictly greater than 0.5 seconds
    for i, seg in enumerate(merged_segments):
        seg_dur = seg['end'] - seg['start']
        assert seg_dur > 0.5, f"Segment {i} duration is {seg_dur}s (<= 0.5s)"
    # The output must contain at least 3 segments total
    assert len(merged_segments) >= 3, f"Total segments is {len(merged_segments)} (< 3)"
    # At least 2 distinct labels
    distinct_labels = set(seg['label'] for seg in merged_segments)
    assert len(distinct_labels) >= 2, f"Distinct labels is {len(distinct_labels)} (< 2)"
    # At least one label must be reused across multiple segments
    label_counts = {}
    for seg in merged_segments:
        label_counts[seg['label']] = label_counts.get(seg['label'], 0) + 1
    has_reuse = any(count > 1 for count in label_counts.values())
    assert has_reuse, f"No label is reused: {label_counts}"
    
    # Save to JSON
    print(f"Saving segments to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(merged_segments, f, indent=2)
    print("Success!")

if __name__ == '__main__':
    main()
