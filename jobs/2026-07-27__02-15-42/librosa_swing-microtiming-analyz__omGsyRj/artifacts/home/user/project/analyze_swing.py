import numpy as np
import librosa
import scipy.signal
import json
import argparse
import sys
from sklearn.cluster import KMeans

def get_grid_point(k, s, b, P, K):
    if 0 <= k < K:
        b_val = b[k]
        P_val = P[k]
    elif k < 0:
        b_val = b[0] + k * P[0]
        P_val = P[0]
    else:
        b_val = b[K-1] + (k - (K-1)) * P[K-1]
        P_val = P[K-1]
        
    if s == 0:
        return b_val
    else:
        return b_val + P_val / 2

def get_expected_position(k, s, b, P, K, swing_ratio):
    if 0 <= k < K:
        b_val = b[k]
        P_val = P[k]
    elif k < 0:
        b_val = b[0] + k * P[0]
        P_val = P[0]
    else:
        b_val = b[K-1] + (k - (K-1)) * P[K-1]
        P_val = P[K-1]
        
    if s == 0:
        return b_val
    else:
        return b_val + P_val * swing_ratio / (1 + swing_ratio)

def analyze_swing(input_wav_path, output_json_path):
    try:
        # Load audio (force mono, sr=22050)
        y, sr = librosa.load(input_wav_path, sr=22050, mono=True)
        abs_y = np.abs(y)
        
        # Smooth absolute amplitude to get a robust envelope for peak detection
        window_len = int(0.005 * sr)  # 5ms window
        env = np.convolve(abs_y, np.ones(window_len)/window_len, mode='same')
        
        # Estimate noise floor of envelope
        noise_floor_env = np.percentile(env, 10)
        # Find peaks of envelope corresponding to clicks
        peaks, _ = scipy.signal.find_peaks(
            env, 
            distance=int(0.10 * sr), 
            prominence=max(0.01 * np.max(env), 3 * noise_floor_env)
        )
        
        if len(peaks) == 0:
            print("Error: No onset peaks detected.", file=sys.stderr)
            sys.exit(1)
            
        # Estimate noise floor and standard deviation of raw waveform
        noise_floor = np.percentile(abs_y, 10)
        noise_std_est = np.median(abs_y) / 0.6745
        
        onset_times = []
        onset_amplitudes = []
        
        for p in peaks:
            # Find local peak in raw absolute waveform around envelope peak p
            start_w = max(0, p - window_len)
            end_w = min(len(abs_y), p + window_len)
            local_peak_idx = start_w + np.argmax(abs_y[start_w : end_w])
            
            peak_val = abs_y[local_peak_idx]
            # Threshold adaptive to both local peak value and global noise floor/std
            threshold = max(noise_floor + 0.05 * (peak_val - noise_floor), noise_floor + 5 * noise_std_est)
            
            # Walk backwards to find onset (moment energy begins to rise)
            idx = local_peak_idx
            consecutive_below = 0
            min_samples_below = 15  # ~0.68ms at 22050 Hz
            onset_idx = local_peak_idx
            while idx > 0:
                if abs_y[idx] < threshold:
                    consecutive_below += 1
                    if consecutive_below >= min_samples_below:
                        onset_idx = idx + min_samples_below
                        break
                else:
                    consecutive_below = 0
                idx -= 1
            
            onset_times.append(onset_idx / sr)
            onset_amplitudes.append(peak_val)
            
        onset_times = np.array(onset_times)
        onset_amplitudes = np.array(onset_amplitudes)
        
        # Cluster peak amplitudes into 2 clusters: downbeats (louder) and offbeats (softer)
        kmeans = KMeans(n_clusters=2, random_state=0, n_init=10).fit(onset_amplitudes.reshape(-1, 1))
        labels = kmeans.labels_
        
        # Identify downbeat label as the cluster with the larger center
        if kmeans.cluster_centers_[0][0] > kmeans.cluster_centers_[1][0]:
            downbeat_label = 0
        else:
            downbeat_label = 1
            
        downbeat_onsets = onset_times[labels == downbeat_label]
        
        if len(downbeat_onsets) < 2:
            print("Error: Fewer than 2 downbeat onsets detected.", file=sys.stderr)
            sys.exit(1)
            
        # Estimate the beat period using the median interval between detected downbeats
        P_median = np.median(np.diff(downbeat_onsets))
        
        # Reconstruct the complete beat grid b (including any missing downbeats)
        b = [downbeat_onsets[0]]
        for i in range(1, len(downbeat_onsets)):
            last_b = b[-1]
            curr_d = downbeat_onsets[i]
            diff = curr_d - last_b
            num_beats = int(round(diff / P_median))
            if num_beats > 1:
                for j in range(1, num_beats):
                    b.append(last_b + j * (diff / num_beats))
            b.append(curr_d)
        b = np.array(b)
        
        K = len(b)
        P = np.zeros(K)
        for k in range(K - 1):
            P[k] = b[k+1] - b[k]
        P[K-1] = P[K-2]
        
        # Global tempo in BPM
        tempo = 60.0 / np.mean(P)
        
        # Assign each onset to the nearest straight grid point g(k, s)
        per_onset_list = []
        P_mean = np.mean(P)
        
        for t in onset_times:
            k_approx = int(round((t - b[0]) / P_mean))
            best_dist = float('inf')
            best_k = None
            best_s = None
            
            # Search nearby beat indices and subdivisions
            for k in range(k_approx - 3, k_approx + 4):
                for s in (0, 1):
                    g_val = get_grid_point(k, s, b, P, K)
                    dist = abs(t - g_val)
                    if dist < best_dist:
                        best_dist = dist
                        best_k = k
                        best_s = s
                        
            per_onset_list.append({
                'time': float(t),
                'beat_index': int(best_k),
                'subdivision': int(best_s)
            })
            
        # Sort by ascending time (already sorted, but to be absolutely sure)
        per_onset_list.sort(key=lambda x: x['time'])
        
        # Map (k, s) -> onset_time for swing ratio computation
        onset_map = {}
        for onset in per_onset_list:
            onset_map[(onset['beat_index'], onset['subdivision'])] = onset['time']
            
        # Compute swing ratio
        per_beat_ratios = []
        beat_indices = sorted(list(set(k for (k, s) in onset_map.keys())))
        
        for k in beat_indices:
            if (k, 0) in onset_map and (k, 1) in onset_map and (k+1, 0) in onset_map:
                t0 = onset_map[(k, 0)]
                t1 = onset_map[(k, 1)]
                t0_next = onset_map[(k+1, 0)]
                ratio = (t1 - t0) / (t0_next - t1)
                per_beat_ratios.append(ratio)
                
        if len(per_beat_ratios) > 0:
            swing_ratio = float(np.mean(per_beat_ratios))
        else:
            swing_ratio = 1.0  # Default fallback if no swing ratio can be computed
            
        # Compute micro-timing deviations
        deviations = []
        for onset in per_onset_list:
            expected_pos = get_expected_position(onset['beat_index'], onset['subdivision'], b, P, K, swing_ratio)
            dev_ms = 1000.0 * (onset['time'] - expected_pos)
            onset['deviation_ms'] = float(dev_ms)
            deviations.append(dev_ms)
            
        mean_microtiming_ms = float(np.mean(deviations))
        
        # Construct output JSON dictionary with exactly the requested keys
        output_data = {
            'tempo': float(tempo),
            'swing_ratio': float(swing_ratio),
            'mean_microtiming_ms': float(mean_microtiming_ms),
            'per_onset': per_onset_list
        }
        
        # Write to output JSON file
        with open(output_json_path, 'w') as f:
            json.dump(output_data, f, indent=4)
            
        print(f"Analysis completed successfully. Output written to {output_json_path}", file=sys.stderr)
        sys.exit(0)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Swing Ratio & Micro-Timing Analyzer')
    parser.add_argument('--input', required=True, help='Path to input WAV file')
    parser.add_argument('--output', required=True, help='Path to output JSON file')
    args = parser.parse_args()
    
    analyze_swing(args.input, args.output)
