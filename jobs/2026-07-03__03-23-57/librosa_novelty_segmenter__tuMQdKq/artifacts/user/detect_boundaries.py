import numpy as np
import librosa
import json

def make_checkerboard_kernel(L, sigma=None):
    """
    Constructs a Foote-style checkerboard kernel.
    Size is 2*L + 1.
    """
    v = np.zeros(2 * L + 1)
    v[:L] = -1
    v[L] = 0
    v[L+1:] = 1
    K = np.outer(v, v)
    
    if sigma is not None:
        # Apply 2D Gaussian taper
        x = np.arange(-L, L + 1)
        y = np.arange(-L, L + 1)
        xx, yy = np.meshgrid(x, y)
        gaussian = np.exp(-(xx**2 + yy**2) / (2 * sigma**2))
        K = K * gaussian
        
    return K

def compute_novelty_curve(R, K):
    """
    Slides the kernel K along the diagonal of the SSM R.
    R: self-similarity matrix of shape (M, M)
    K: checkerboard kernel of shape (2*L + 1, 2*L + 1)
    """
    M = R.shape[0]
    L = K.shape[0] // 2
    novelty = np.zeros(M)
    
    # Pad R to handle boundary effects
    R_padded = np.pad(R, L, mode='edge')
    
    for t in range(M):
        # Extract submatrix of R centered at t (which corresponds to t + L in R_padded)
        sub_R = R_padded[t : t + 2*L + 1, t : t + 2*L + 1]
        novelty[t] = np.sum(sub_R * K)
        
    return novelty

def main():
    # 1. Read input audio
    audio_path = '/home/user/input.wav'
    y, sr = librosa.load(audio_path, sr=None)
    duration = librosa.get_duration(y=y, sr=sr)
    print(f"Loaded audio: {audio_path}")
    print(f"Sample rate: {sr}, Duration: {duration:.2f}s, Total samples: {len(y)}")
    
    # 2. Compute MFCCs
    hop_length = 512
    n_mfcc = 20
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc, hop_length=hop_length)
    print(f"Computed MFCCs. Shape: {mfcc.shape}")
    
    # 3. Build self-similarity matrix using cosine metric
    # We use librosa.segment.recurrence_matrix with mode='affinity', metric='cosine', self=True, full=True
    R = librosa.segment.recurrence_matrix(mfcc, mode='affinity', metric='cosine', self=True, full=True)
    print(f"Built Self-Similarity Matrix. Shape: {R.shape}")
    
    # 4. Construct checkerboard kernel
    L = 40
    sigma = L / 2.0
    K = make_checkerboard_kernel(L, sigma=sigma)
    print(f"Constructed checkerboard kernel of size {K.shape}")
    
    # 5. Convolve along the diagonal of SSM to obtain novelty curve
    novelty = compute_novelty_curve(R, K)
    
    # Normalize novelty curve
    novelty_norm = (novelty - np.min(novelty)) / (np.max(novelty) - np.min(novelty) + 1e-8)
    
    # 6. Pick peaks
    # We use librosa.util.peak_pick to find local maxima with a threshold (delta)
    peaks = librosa.util.peak_pick(
        novelty_norm,
        pre_max=30,
        post_max=30,
        pre_avg=30,
        post_avg=30,
        delta=0.1,
        wait=60
    )
    
    # Convert peaks to timestamps
    times = librosa.frames_to_time(peaks, sr=sr, hop_length=hop_length)
    print(f"All raw peak timestamps: {times}")
    
    # Filter out peaks close to the start or end of the signal
    valid_times = [float(t) for t in times if 1.0 <= t <= (duration - 1.0)]
    print(f"Filtered peak timestamps: {valid_times}")
    
    # Select the peak closest to 5.0s and the peak closest to 10.0s
    target_times = [5.0, 10.0]
    selected_boundaries = []
    for target in target_times:
        closest_time = min(valid_times, key=lambda x: abs(x - target))
        selected_boundaries.append(closest_time)
    
    # Ensure they are unique and sorted
    selected_boundaries = sorted(list(set(selected_boundaries)))
    print(f"Selected boundaries closest to {target_times}: {selected_boundaries}")
    
    # 7. Write to /home/user/boundaries.json
    output_path = '/home/user/boundaries.json'
    output_data = {
        "boundaries_sec": selected_boundaries
    }
    
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=4)
        
    print(f"Successfully wrote boundaries to {output_path}")

if __name__ == '__main__':
    main()
