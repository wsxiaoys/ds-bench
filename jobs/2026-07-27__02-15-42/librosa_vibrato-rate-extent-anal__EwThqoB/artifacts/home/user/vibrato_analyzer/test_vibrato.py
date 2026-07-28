import numpy as np
import scipy.signal
import json

def analyze_segment(f0_segment, fs_pitch):
    """
    Analyze a single pitch segment (in Hz) to compute vibrato rate and extent.
    """
    n_samples = len(f0_segment)
    if n_samples < 15:
        return False, None, None

    # Convert to cents
    pitch_cents = 1200 * np.log2(f0_segment)

    # Detrend using a linear detrend first
    pitch_detrended_linear = scipy.signal.detrend(pitch_cents)

    # Design a bandpass filter [3.0, 10.0] Hz
    # Nyquist frequency
    nyq = fs_pitch / 2.0
    low_cutoff = 3.0
    high_cutoff = 10.0

    # Ensure cutoffs are valid for our sampling rate
    if low_cutoff >= nyq:
        return False, None, None
    
    high_cutoff = min(high_cutoff, nyq - 0.1)
    if high_cutoff <= low_cutoff:
        return False, None, None

    # Butterworth bandpass filter
    b, a = scipy.signal.butter(2, [low_cutoff / nyq, high_cutoff / nyq], btype='bandpass')
    
    # Filter to isolate vibrato oscillation
    try:
        p_vibrato = scipy.signal.filtfilt(b, a, pitch_detrended_linear)
    except Exception as e:
        # If filtering fails for any reason, return no vibrato
        return False, None, None

    # Compute FFT to find dominant frequency
    N = 8192
    fft_vals = np.fft.rfft(p_vibrato, n=N)
    fft_freqs = np.fft.rfftfreq(N, d=1.0/fs_pitch)

    # Find the peak frequency in the range [3.0, 10.0] Hz
    valid_idx = np.where((fft_freqs >= 3.0) & (fft_freqs <= min(10.0, nyq)))[0]
    if len(valid_idx) == 0:
        peak_freq = 0.0
    else:
        peak_idx = valid_idx[np.argmax(np.abs(fft_vals[valid_idx]))]
        peak_freq = fft_freqs[peak_idx]

    # Compute peak-to-peak extent
    extent = np.max(p_vibrato) - np.min(p_vibrato)

    # Classification rule:
    # dominant modulation frequency between 4 Hz and 9 Hz AND peak-to-peak extent of at least 20 cents
    has_vibrato = (4.0 <= peak_freq <= 9.0) and (extent >= 20.0)

    if has_vibrato:
        return True, float(peak_freq), float(extent)
    else:
        return False, None, None

# Test with synthetic signal
if __name__ == "__main__":
    fs_pitch = 43.0  # frames per second
    t = np.arange(100) / fs_pitch  # ~2.3 seconds
    
    # Let's create a signal with 6 Hz vibrato (extent 50 cents) and some slow drift (quadratic)
    # F0 = 220 Hz base
    f0_base = 220.0
    # Drift in cents: slow quadratic drift of 100 cents over 2.3 seconds
    drift_cents = 50 * t + 10 * (t**2)
    # Vibrato in cents: 6 Hz, peak-to-peak 50 cents (amplitude 25 cents)
    vibrato_cents = 25 * np.sin(2 * np.pi * 6.0 * t)
    
    total_cents = 1200 * np.log2(f0_base) + drift_cents + vibrato_cents
    f0_synthetic = 2 ** (total_cents / 1200.0)

    has_vib, rate, extent = analyze_segment(f0_synthetic, fs_pitch)
    print(f"Synthetic test 1 (Vibrato): has_vib={has_vib}, rate={rate:.2f} Hz, extent={extent:.2f} cents")

    # Let's create a signal with no vibrato (just drift and some high-frequency jitter)
    jitter_cents = 5 * np.sin(2 * np.pi * 15.0 * t)
    total_cents_novib = 1200 * np.log2(f0_base) + drift_cents + jitter_cents
    f0_synthetic_novib = 2 ** (total_cents_novib / 1200.0)

    has_vib_no, rate_no, extent_no = analyze_segment(f0_synthetic_novib, fs_pitch)
    print(f"Synthetic test 2 (No Vibrato): has_vib={has_vib_no}, rate={rate_no}, extent={extent_no}")
