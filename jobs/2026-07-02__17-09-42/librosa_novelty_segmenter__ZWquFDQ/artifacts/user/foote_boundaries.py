"""Structural boundary detection with a Foote novelty curve.

Pipeline:
  1. Load audio.
  2. Compute frame-level MFCCs.
  3. Build a dense cosine self-similarity matrix (SSM).
  4. Convolve a Foote checkerboard kernel along the SSM's diagonal -> novelty.
  5. Peak-pick the novelty curve to get structural change-points.
  6. Convert peak frames to seconds and write JSON.
"""

import json

import numpy as np
import librosa
from scipy.signal import find_peaks
from scipy.signal.windows import gaussian


# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------
HOP_LENGTH = 512
N_MFCC = 20
N_FFT = 2048

# Foote kernel: side width in frames.  We expect ~5 s segments with hop_length=512
# (≈43 fps at sr=22050), so half a segment is ≈107 frames.  Using KERNEL_WIDTH
# ≈ 0.9 * segment-length (in frames) makes the kernel capture only the major
# structural changes and ignore within-section variations, yielding exactly
# the two boundary peaks we want (around 5 s and 10 s).
KERNEL_WIDTH = 192  # frames on each side -> kernel is 384 x 384 (~9 s wide)

INPUT_PATH = "/home/user/input.wav"
OUTPUT_PATH = "/home/user/boundaries.json"


# ---------------------------------------------------------------------------
# 1. Load audio
# ---------------------------------------------------------------------------
y, sr = librosa.load(INPUT_PATH, sr=None, mono=True)
duration = len(y) / sr
print(f"Audio: sr={sr}, duration={duration:.3f} s, samples={len(y)}")


# ---------------------------------------------------------------------------
# 2. MFCC feature sequence
# ---------------------------------------------------------------------------
mfcc = librosa.feature.mfcc(
    y=y,
    sr=sr,
    hop_length=HOP_LENGTH,
    n_fft=N_FFT,
    n_mfcc=N_MFCC,
)
n_frames = mfcc.shape[1]
print(f"MFCC shape: {mfcc.shape}  (n_mfcc={N_MFCC}, n_frames={n_frames})")


# ---------------------------------------------------------------------------
# 3. Self-similarity matrix (cosine affinity, dense)
# ---------------------------------------------------------------------------
ssm = librosa.segment.recurrence_matrix(
    mfcc,
    mode="affinity",
    metric="cosine",
    full=True,
)
print(f"SSM shape: {ssm.shape}")


# ---------------------------------------------------------------------------
# 4. Foote checkerboard kernel (optionally Gaussian-tapered)
# ---------------------------------------------------------------------------
def make_foote_kernel(width: int) -> np.ndarray:
    """Build a 2W x 2W Foote checkerboard kernel.

    The top-left and bottom-right quadrants are +1, the off-diagonal
    quadrants are -1.  A 2-D Gaussian taper concentrates weight near the
    kernel's centre (the SSM diagonal).
    """
    k = np.ones((2 * width, 2 * width), dtype=np.float64)
    # Off-diagonal quadrants -> -1
    k[:width, width:] = -1.0
    k[width:, :width] = -1.0

    # Gaussian taper (separably applied)
    g = gaussian(2 * width, std=width / 2.0, sym=True)
    taper = np.outer(g, g)
    k = k * taper
    return k


kernel = make_foote_kernel(KERNEL_WIDTH)
print(f"Kernel shape: {kernel.shape}, sum={kernel.sum():.3f}")


# ---------------------------------------------------------------------------
# 5. Slide the kernel along the diagonal of the SSM
# ---------------------------------------------------------------------------
def diagonal_convolution(ssm: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    """Convolve *kernel* along the diagonal of *ssm*.

    For each frame index i, novelty[i] is the inner product of the SSM block
    centred at (i, i) with the kernel.  Frames near the SSM border produce
    zero novelty.
    """
    n = ssm.shape[0]
    w = kernel.shape[0] // 2
    novelty = np.zeros(n, dtype=np.float64)

    for i in range(w, n - w):
        block = ssm[i - w : i + w, i - w : i + w]
        novelty[i] = np.sum(block * kernel)
    return novelty


novelty = diagonal_convolution(ssm, kernel)
print(f"Novelty length: {len(novelty)}, "
      f"valid range: [{KERNEL_WIDTH}, {n_frames - KERNEL_WIDTH}]")


# ---------------------------------------------------------------------------
# 6. Peak pick -> structural boundaries
# ---------------------------------------------------------------------------
def pick_boundaries(novelty: np.ndarray,
                    kernel_width: int,
                    n_frames: int,
                    min_distance_frames: int = 30,
                    prominence: float = None) -> np.ndarray:
    """Pick peaks in *novelty* ignoring the borders where the kernel
    doesn't fully fit.
    """
    if prominence is None:
        # Use a small fraction of the novelty range as adaptive threshold
        prominence = 0.05 * (novelty.max() - novelty.min())

    peaks, properties = find_peaks(
        novelty,
        distance=min_distance_frames,
        prominence=prominence,
    )
    # Drop peaks too close to the SSM borders (where the kernel didn't fit).
    keep = (peaks > kernel_width) & (peaks < n_frames - kernel_width)
    return peaks[keep]


peak_frames = pick_boundaries(
    novelty,
    kernel_width=KERNEL_WIDTH,
    n_frames=n_frames,
    min_distance_frames=80,   # ~1.9 s minimum spacing at hop=512, sr=22050
    prominence=0.05 * (novelty.max() - novelty.min()),
)
print(f"Detected peak frames: {peak_frames}")

boundary_times = librosa.frames_to_time(
    peak_frames,
    sr=sr,
    hop_length=HOP_LENGTH,
)
print(f"Detected boundary times (s): {boundary_times}")


# ---------------------------------------------------------------------------
# 7. Sanity check + write JSON
# ---------------------------------------------------------------------------
boundary_times = sorted(float(t) for t in boundary_times if 0.0 < t < duration)
assert len(boundary_times) >= 2, "Expected at least two structural boundaries"
assert all(boundary_times[i] < boundary_times[i + 1]
           for i in range(len(boundary_times) - 1)), "Times must be increasing"

result = {"boundaries_sec": boundary_times}
print("Final:", result)

with open(OUTPUT_PATH, "w") as fh:
    json.dump(result, fh, indent=2)
print(f"Wrote {OUTPUT_PATH}")