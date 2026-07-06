import json
import numpy as np
import librosa
import soundfile as sf

INPUT_PATH = '/home/user/input.wav'
OUTPUT_PATH = '/home/user/hierarchy.json'
HOP_LENGTH = 512
K_COARSE = 5  # between 4 and 8 inclusive


def main():
    # Load audio
    y, sr = sf.read(INPUT_PATH)
    duration = float(len(y) / sr)
    print(f"Sample rate: {sr}, Duration: {duration:.3f}s")

    # Beat tracking
    tempo, beats = librosa.beat.beat_track(
        y=y, sr=sr, hop_length=HOP_LENGTH, units='frames'
    )
    beats = np.asarray(beats, dtype=int)
    print(f"Tempo: {tempo}, #beats: {len(beats)}, first/last: {beats[0]}/{beats[-1]}")

    # Chroma CQT
    chroma = librosa.feature.chroma_cqt(
        y=y, sr=sr, hop_length=HOP_LENGTH
    )
    n_frames = chroma.shape[1]
    print(f"Chroma shape: {chroma.shape}, n_frames={n_frames}")

    # Beat-synchronous chroma
    chroma_sync = librosa.util.sync(chroma, beats, aggregate=np.median)
    print(f"Chroma sync shape: {chroma_sync.shape}")

    # Coarse agglomerative segmentation on beat-sync chroma
    boundaries_sync = librosa.segment.agglomerative(
        data=chroma_sync, k=K_COARSE
    )
    print(f"Agglomerative left-boundaries (sync): {boundaries_sync}")

    # Build full coarse left-boundary array in beat-sync coordinates.
    # Append the right edge (n_sync) so the last segment extends to the end.
    full_left_sync = np.unique(
        np.concatenate([boundaries_sync, [chroma_sync.shape[1]]])
    )
    print(f"Full coarse left edges (sync): {full_left_sync}")

    # Map each sync left-boundary to a frame index in the chroma.
    # Column i of chroma_sync corresponds to beat frame beats[i].
    # The appended end-column is the end of the chroma (n_frames).
    # The first boundary is forced to frame 0 so the first coarse
    # segment starts at time 0 and covers the pre-beat intro.
    coarse_frames = []
    for i, s in enumerate(full_left_sync):
        if i == 0:
            coarse_frames.append(0)
        elif s < len(beats):
            coarse_frames.append(int(beats[s]))
        else:
            coarse_frames.append(int(n_frames))
    coarse_frames = np.array(coarse_frames, dtype=int)
    print(f"Coarse boundaries (frames): {coarse_frames}")

    # Convert to time
    coarse_times = librosa.frames_to_time(
        coarse_frames, sr=sr, hop_length=HOP_LENGTH
    )
    # Clamp last to duration; ensure first starts at 0
    coarse_times[-1] = min(float(coarse_times[-1]), duration)
    coarse_times[0] = 0.0
    print(f"Coarse boundaries (time): {coarse_times}")

    # Build coarse list
    coarse = []
    for i in range(len(coarse_times) - 1):
        s = float(coarse_times[i])
        e = float(coarse_times[i + 1])
        coarse.append({"index": i, "start": round(s, 6), "end": round(e, 6)})
    print("Coarse segments:")
    for c in coarse:
        print(f"  {c['index']}: {c['start']:.3f} - {c['end']:.3f} "
              f"(len={c['end']-c['start']:.3f}s)")

    # ----- Fine subsegmentation -----
    fine = []
    for c_idx, c in enumerate(coarse):
        # Use coarse_frames directly to avoid precision loss via time_to_frames
        start_frame = int(coarse_frames[c_idx])
        end_frame = int(coarse_frames[c_idx + 1])
        seg_bounds = np.array([start_frame, end_frame], dtype=int)

        all_bounds = librosa.segment.subsegment(
            data=chroma, frames=seg_bounds, n_segments=3
        )
        all_bounds = np.asarray(all_bounds, dtype=int)
        # Filter to boundaries within [start_frame, end_frame]
        mask = (all_bounds >= start_frame) & (all_bounds <= end_frame)
        fine_bounds = all_bounds[mask]
        # Ensure start and end are present
        if fine_bounds[0] != start_frame:
            fine_bounds = np.concatenate([[start_frame], fine_bounds])
        if fine_bounds[-1] != end_frame:
            fine_bounds = np.concatenate([fine_bounds, [end_frame]])
        fine_bounds = np.unique(fine_bounds)
        print(f"Coarse {c_idx}: seg_bounds={seg_bounds.tolist()}, "
              f"all_bounds={all_bounds.tolist()}, "
              f"filtered={fine_bounds.tolist()}")

        if len(fine_bounds) != 4:
            print(f"  WARNING: expected 4 fine bounds, got {len(fine_bounds)}. "
                  f"Falling back to even distribution.")
            n_intervals = end_frame - start_frame
            inner1 = start_frame + n_intervals // 3
            inner2 = start_frame + 2 * n_intervals // 3
            fine_bounds = np.array(
                [start_frame, inner1, inner2, end_frame], dtype=int
            )

        fine_times = librosa.frames_to_time(
            fine_bounds, sr=sr, hop_length=HOP_LENGTH
        )
        # Clamp to coarse boundaries
        fine_times[0] = c["start"]
        fine_times[-1] = c["end"]

        # Enforce minimum fine segment length (0.1s) by adjusting if needed
        min_len = 0.1
        for j in range(3):
            seg_len = fine_times[j + 1] - fine_times[j]
            if seg_len < min_len:
                deficit = min_len - seg_len
                # Take from the next segment if it's longer, else from previous
                if j < 2 and (fine_times[j + 2] - fine_times[j + 1]) > min_len:
                    take = min(deficit,
                               (fine_times[j + 2] - fine_times[j + 1]) - min_len)
                    fine_times[j + 1] += take
                if fine_times[j + 1] - fine_times[j] < min_len and j > 0:
                    take = min(deficit,
                               (fine_times[j] - fine_times[j - 1]) - min_len)
                    fine_times[j] -= take

        for j in range(3):
            fine.append({
                "index": len(fine),
                "start": round(float(fine_times[j]), 6),
                "end": round(float(fine_times[j + 1]), 6),
                "parent_index": c_idx,
            })

    output = {"coarse": coarse, "fine": fine}

    with open(OUTPUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)

    print("\n=== OUTPUT ===")
    print(json.dumps(output, indent=2))

    # Sanity checks
    print("\n=== SANITY CHECKS ===")
    assert coarse[0]["start"] <= 0.3, f"First start {coarse[0]['start']} > 0.3"
    assert coarse[-1]["end"] >= duration - 0.5, (
        f"Last end {coarse[-1]['end']} < {duration - 0.5}"
    )
    for i in range(len(coarse) - 1):
        gap = coarse[i + 1]["start"] - coarse[i]["end"]
        seg_len = coarse[i]["end"] - coarse[i]["start"]
        assert -1e-6 <= gap <= 0.3, f"Coarse gap {gap:.4f} at {i}-{i+1}"
        assert seg_len > 0.5, f"Coarse seg {i} too short: {seg_len}"
    for c_idx, c in enumerate(coarse):
        kids = [f for f in fine if f["parent_index"] == c_idx]
        assert len(kids) == 3, f"Coarse {c_idx} has {len(kids)} kids"
        assert abs(kids[0]["start"] - c["start"]) < 0.05, (
            f"Kid 0 start {kids[0]['start']} != coarse start {c['start']}"
        )
        assert abs(kids[-1]["end"] - c["end"]) < 0.05, (
            f"Kid -1 end {kids[-1]['end']} != coarse end {c['end']}"
        )
        for j in range(len(kids) - 1):
            gap = kids[j + 1]["start"] - kids[j]["end"]
            seg_len = kids[j]["end"] - kids[j]["start"]
            assert -1e-6 <= gap <= 0.05, (
                f"Fine gap {gap:.4f} at coarse {c_idx} fine {j}"
            )
            assert seg_len > 0.1, f"Fine seg too short: {seg_len}"
    print("All sanity checks passed.")


if __name__ == "__main__":
    main()