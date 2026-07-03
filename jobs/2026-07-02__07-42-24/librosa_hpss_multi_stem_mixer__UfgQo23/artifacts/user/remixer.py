import librosa
import soundfile as sf
import numpy as np

def align_length(signal, target_length):
    """Pad with zeros or truncate a 1D signal to match target_length."""
    current_length = len(signal)
    if current_length < target_length:
        # Pad with zeros at the end
        return np.pad(signal, (0, target_length - current_length), mode='constant')
    elif current_length > target_length:
        # Truncate to target_length
        return signal[:target_length]
    return signal

def main():
    input_path = '/home/user/input.wav'
    output_path = '/home/user/output.wav'

    print(f"Loading {input_path}...")
    # Read preserving native sample rate
    y, sr = librosa.load(input_path, sr=None)
    print(f"Original signal loaded. Length: {len(y)} samples, Sample Rate: {sr} Hz")

    # 1. Decompose into harmonic and percussive time-domain components
    print("Performing HPSS decomposition with margin=(1.0, 5.0)...")
    harmonic, percussive = librosa.effects.hpss(y, margin=(1.0, 5.0))
    print(f"HPSS done. Harmonic length: {len(harmonic)}, Percussive length: {len(percussive)}")

    # 2. Pitch-shift harmonic component up by 7 semitones
    print("Pitch-shifting harmonic component up by 7 semitones...")
    harmonic_shifted = librosa.effects.pitch_shift(harmonic, sr=sr, n_steps=7)
    print(f"Pitch-shifting done. Length: {len(harmonic_shifted)}")

    # 3. Time-stretch percussive component by a rate of 0.85
    print("Time-stretching percussive component by a rate of 0.85...")
    percussive_stretched = librosa.effects.time_stretch(percussive, rate=0.85)
    print(f"Time-stretching done. Length: {len(percussive_stretched)}")

    # 4. Re-align lengths to original input waveform length
    print("Re-aligning lengths and mixing...")
    harmonic_aligned = align_length(harmonic_shifted, len(y))
    percussive_aligned = align_length(percussive_stretched, len(y))
    
    mix = 0.7 * harmonic_aligned + 0.5 * percussive_aligned
    print(f"Mix created. Length: {len(mix)}")

    # 5. Trim leading and trailing silence (top_db=30)
    print("Trimming leading and trailing silence (top_db=30)...")
    mix_trimmed, _ = librosa.effects.trim(mix, top_db=30)
    print(f"Trimming done. Trimmed length: {len(mix_trimmed)}")

    # 6. Write result to output.wav at the same sample rate
    print(f"Writing mixed output to {output_path}...")
    sf.write(output_path, mix_trimmed, sr)
    print("Successfully completed!")

if __name__ == '__main__':
    main()
