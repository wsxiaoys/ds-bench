import json
import librosa
import numpy as np

def main():
    # 1. Read input WAV file
    input_wav = "/home/user/input.wav"
    output_json = "/home/user/hierarchy.json"
    
    y, sr = librosa.load(input_wav)
    duration = librosa.get_duration(y=y, sr=sr)
    print(f"Loaded {input_wav}: duration={duration:.3f}s, sr={sr}")
    
    # 2. Beat tracking
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=512)
    print(f"Beat tracking found {len(beats)} beats. Tempo: {tempo}")
    
    # 3. Feature extraction (chroma_cqt)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
    print(f"Chroma CQT shape: {chroma.shape}")
    
    # 4. Beat-synchronous feature aggregation
    chroma_sync = librosa.util.sync(chroma, beats)
    print(f"Chroma sync shape: {chroma_sync.shape}")
    
    # Try different k values for agglomerative clustering to find one that satisfies all constraints
    valid_k = None
    selected_hierarchy = None
    
    for k in range(4, 9):
        print(f"\nEvaluating k={k}...")
        try:
            # 5. Coarse boundaries
            boundaries = librosa.segment.agglomerative(chroma_sync, k=k)
            # Map back to beat boundaries
            beat_boundaries = [0] + list(beats) + [chroma.shape[1]]
            coarse_frames = [beat_boundaries[b] for b in boundaries] + [chroma.shape[1]]
            
            # Convert to times and clamp the last boundary
            coarse_times = [float(librosa.frames_to_time(f, sr=sr, hop_length=512)) for f in coarse_frames]
            coarse_times[-1] = float(duration)
            
            # Validate coarse segment durations (> 0.5s)
            coarse_valid = True
            coarse_segments = []
            for i in range(len(coarse_times) - 1):
                c_start = coarse_times[i]
                c_end = coarse_times[i+1]
                c_dur = c_end - c_start
                if c_dur <= 0.5:
                    print(f"  Failed: coarse segment {i} duration {c_dur:.3f}s is <= 0.5s")
                    coarse_valid = False
                    break
                coarse_segments.append({
                    "index": i,
                    "start": c_start,
                    "end": c_end
                })
            
            if not coarse_valid:
                continue
                
            # 6. Fine sub-segmentation
            subseg = librosa.segment.subsegment(chroma, np.array(coarse_frames), n_segments=3)
            
            fine_segments = []
            fine_idx = 0
            fine_valid = True
            
            for i in range(len(coarse_frames) - 1):
                c_start_f = coarse_frames[i]
                c_end_f = coarse_frames[i+1]
                
                # Extract subsegments within this coarse segment
                sub_frames = subseg[(subseg >= c_start_f) & (subseg < c_end_f)]
                if len(sub_frames) != 3:
                    print(f"  Failed: coarse segment {i} has {len(sub_frames)} subsegments instead of 3")
                    fine_valid = False
                    break
                    
                # Construct fine segment times
                s0_t = coarse_segments[i]["start"]
                s1_t = float(librosa.frames_to_time(sub_frames[1], sr=sr, hop_length=512))
                s2_t = float(librosa.frames_to_time(sub_frames[2], sr=sr, hop_length=512))
                s3_t = coarse_segments[i]["end"]
                
                sub_times = [s0_t, s1_t, s2_t, s3_t]
                
                # Check fine segment durations (> 0.1s)
                for j in range(3):
                    f_start = sub_times[j]
                    f_end = sub_times[j+1]
                    f_dur = f_end - f_start
                    if f_dur <= 0.1:
                        print(f"  Failed: fine segment {fine_idx + j} duration {f_dur:.3f}s is <= 0.1s")
                        fine_valid = False
                        break
                    fine_segments.append({
                        "index": fine_idx + j,
                        "start": f_start,
                        "end": f_end,
                        "parent_index": i
                    })
                
                if not fine_valid:
                    break
                
                fine_idx += 3
                
            if fine_valid:
                print(f"  Success for k={k}!")
                valid_k = k
                selected_hierarchy = {
                    "coarse": coarse_segments,
                    "fine": fine_segments
                }
                break  # Found a valid hierarchy
                
        except Exception as e:
            print(f"  Exception for k={k}: {e}")
            
    if selected_hierarchy is None:
        print("Error: Could not find any k between 4 and 8 that satisfies all duration constraints!")
        return
        
    # Write to hierarchy.json
    with open(output_json, "w") as f:
        json.dump(selected_hierarchy, f, indent=2)
    print(f"\nSuccessfully wrote hierarchy to {output_json} using k={valid_k}")

if __name__ == "__main__":
    main()
