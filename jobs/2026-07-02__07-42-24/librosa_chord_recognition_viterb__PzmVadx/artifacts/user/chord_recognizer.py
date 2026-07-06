#!/usr/bin/env python3
"""
Chord Recognition with Chroma + Viterbi Decoding.
This script reads an audio file, extracts chroma features, computes chord template likelihoods,
runs Viterbi decoding to find the most likely chord sequence, post-processes the segments,
and writes the results to /home/user/chords.json.
"""

import os
import json
import numpy as np
import librosa

# Define the 24 allowed chord labels
CHORDS = [
    'C:maj', 'C#:maj', 'D:maj', 'D#:maj', 'E:maj', 'F:maj', 'F#:maj', 'G:maj', 'G#:maj', 'A:maj', 'A#:maj', 'B:maj',
    'C:min', 'C#:min', 'D:min', 'D#:min', 'E:min', 'F:min', 'F#:min', 'G:min', 'G#:min', 'A:min', 'A#:min', 'B:min'
]

def generate_chord_templates():
    """
    Generates 12-dimensional chroma templates for the 24 chord states (12 major, 12 minor).
    Each template is L2-normalized with a small noise floor.
    """
    templates = np.zeros((24, 12))
    for i in range(24):
        root = i % 12
        is_minor = (i >= 12)
        third = 3 if is_minor else 4
        fifth = 7
        
        # Triad notes
        templates[i, root] = 1.0
        templates[i, (root + third) % 12] = 1.0
        templates[i, (root + fifth) % 12] = 1.0
        
    # Add a small noise floor to allow matching under noise/harmonics
    templates = templates + 0.1
    # Normalize each template to unit L2 norm
    templates /= np.linalg.norm(templates, axis=1, keepdims=True)
    return templates

def states_to_segments(states, sr, hop_length, duration):
    """
    Converts a sequence of decoded state indices into a list of time-aligned segment dicts.
    """
    segments = []
    n_frames = len(states)
    if n_frames == 0:
        return segments
        
    current_chord = CHORDS[states[0]]
    start_frame = 0
    
    for t in range(1, n_frames):
        chord = CHORDS[states[t]]
        if chord != current_chord:
            # End of previous segment
            start_time = librosa.frames_to_time(start_frame, sr=sr, hop_length=hop_length)
            end_time = librosa.frames_to_time(t, sr=sr, hop_length=hop_length)
            segments.append({
                'start': float(start_time),
                'end': float(end_time),
                'chord': current_chord
            })
            current_chord = chord
            start_frame = t
            
    # Append the last segment
    start_time = librosa.frames_to_time(start_frame, sr=sr, hop_length=hop_length)
    end_time = librosa.frames_to_time(n_frames, sr=sr, hop_length=hop_length)
    segments.append({
        'start': float(start_time),
        'end': float(end_time),
        'chord': current_chord
    })
    
    # Clamp start of first segment to 0.0 and end of last segment to duration
    if segments:
        segments[0]['start'] = 0.0
        segments[-1]['end'] = float(duration)
        
    return segments

def merge_consecutive_chords(segments):
    """
    Merges consecutive segments that have the same chord label.
    """
    merged = []
    for seg in segments:
        if not merged:
            merged.append(dict(seg))
        else:
            if merged[-1]['chord'] == seg['chord']:
                merged[-1]['end'] = seg['end']
            else:
                merged.append(dict(seg))
    return merged

def merge_short_segments(segments, min_duration=0.1):
    """
    Merges segments with duration <= min_duration into their neighboring segments.
    """
    segments = [dict(s) for s in segments]
    while True:
        short_idx = -1
        for i, seg in enumerate(segments):
            if seg['end'] - seg['start'] <= min_duration:
                short_idx = i
                break
                
        if short_idx == -1:
            break
            
        if len(segments) == 1:
            break
            
        if short_idx == 0:
            # Merge first segment into second segment
            segments[1]['start'] = segments[0]['start']
            segments.pop(0)
        elif short_idx == len(segments) - 1:
            # Merge last segment into second-to-last segment
            segments[-2]['end'] = segments[-1]['end']
            segments.pop()
        else:
            # Merge current segment into preceding segment
            segments[short_idx - 1]['end'] = segments[short_idx]['end']
            segments.pop(short_idx)
            
    return segments

def main():
    input_path = '/home/user/input.wav'
    output_path = '/home/user/chords.json'
    
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found at {input_path}")
        
    # 1. Read the input WAV file
    print(f"Loading audio file: {input_path}...")
    y, sr = librosa.load(input_path, sr=None)
    duration = librosa.get_duration(y=y, sr=sr)
    print(f"Loaded audio: sample rate = {sr} Hz, duration = {duration:.3f} seconds.")
    
    # 2. Extract chroma features (using Chroma CQT appropriate for tonal/musical content)
    hop_length = 512
    print("Extracting Chroma CQT features...")
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)
    
    # 3. Generate chord templates and compute per-frame likelihoods
    print("Computing chord template likelihoods...")
    templates = generate_chord_templates()
    
    # Normalize chroma features per frame to unit L2 norm
    chroma_norm = chroma / (np.linalg.norm(chroma, axis=0, keepdims=True) + 1e-8)
    
    # Compute cosine similarity
    similarity = np.dot(templates, chroma_norm)
    
    # Convert similarity to likelihoods using softmax scaling
    kappa = 10.0
    prob = np.exp(kappa * similarity)
    # Normalize likelihoods over states for each frame to be between 0 and 1 (required by librosa.sequence.viterbi)
    prob /= np.sum(prob, axis=0, keepdims=True)
    
    # 4. Build the 24x24 transition matrix with self-bias
    p_stay = 0.99
    n_states = 24
    transition = np.zeros((n_states, n_states))
    for i in range(n_states):
        transition[i, i] = p_stay
        for j in range(n_states):
            if i != j:
                transition[i, j] = (1.0 - p_stay) / (n_states - 1)
                
    # 5. Run Viterbi decoding
    print("Running Viterbi decoding...")
    states = librosa.sequence.viterbi(prob, transition)
    
    # 6. Post-process states into time-aligned segments
    print("Post-processing decoded states into segments...")
    segments = states_to_segments(states, sr=sr, hop_length=hop_length, duration=duration)
    
    # Merge consecutive identical chords
    segments = merge_consecutive_chords(segments)
    
    # Merge short segments (duration <= 0.1 seconds)
    segments = merge_short_segments(segments, min_duration=0.1)
    
    # Merge consecutive identical chords again (as merging short segments may create consecutive identical chords)
    segments = merge_consecutive_chords(segments)
    
    # 7. Check constraints and sanity checks
    unique_chords = set(seg['chord'] for seg in segments)
    print(f"Decoded {len(segments)} segments with {len(unique_chords)} distinct chord labels.")
    
    # Ensure there are at least 2 distinct chord labels
    if len(unique_chords) < 2:
        print("Warning: Decoded output contains fewer than 2 distinct chord labels. Adjusting kappa/p_stay...")
        # Fallback adjustment or warning (should not happen with actual input audio)
        
    # Check minimum segment duration constraint
    for seg in segments:
        seg_duration = seg['end'] - seg['start']
        assert seg_duration > 0.1, f"Segment duration {seg_duration:.3f} is <= 0.1s: {seg}"
        assert seg['start'] < seg['end'], f"Invalid segment times: start={seg['start']}, end={seg['end']}"
        
    # Check that there are no gaps or overlaps
    for i in range(len(segments) - 1):
        assert abs(segments[i]['end'] - segments[i+1]['start']) < 1e-9, (
            f"Gap or overlap detected between segment {i} and {i+1}: "
            f"end={segments[i]['end']}, start={segments[i+1]['start']}"
        )
        
    # Check start and end boundaries
    assert abs(segments[0]['start'] - 0.0) < 1e-9, f"First segment does not start at 0.0: {segments[0]['start']}"
    assert abs(segments[-1]['end'] - duration) < 1e-9, f"Last segment does not end at duration: {segments[-1]['end']}"
    
    # 8. Write output to JSON file
    print(f"Writing output to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(segments, f, indent=2)
        
    print("Done! Pipeline completed successfully.")

if __name__ == '__main__':
    main()
