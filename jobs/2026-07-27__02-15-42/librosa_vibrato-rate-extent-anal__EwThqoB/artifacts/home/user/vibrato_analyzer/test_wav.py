import numpy as np
import scipy.io.wavfile
import subprocess
import json

def generate_synthetic_audio(filename, sr=22050):
    # Duration: 6.0 seconds
    total_duration = 6.0
    t = np.arange(int(total_duration * sr)) / sr
    audio = np.zeros_like(t)

    # Note 1: 0.5s to 2.5s (duration 2.0s)
    # fc = 330 Hz, fm = 6.5 Hz, extent = 60 cents
    # Avib = (fc / 2) * (2^(E/2400) - 2^(-E/2400))
    fc1 = 330.0
    fm1 = 6.5
    E1 = 60.0
    Avib1 = (fc1 / 2.0) * (2**(E1 / 2400.0) - 2**(-E1 / 2400.0))
    
    # Phase for Note 1
    # phi(t) = 2*pi*fc*t - (Avib/fm)*cos(2*pi*fm*t)
    mask1 = (t >= 0.5) & (t < 2.5)
    t1 = t[mask1] - 0.5  # relative time for note 1
    phase1 = 2.0 * np.pi * fc1 * t1 - (Avib1 / fm1) * np.cos(2.0 * np.pi * fm1 * t1)
    # Add a slow pitch glide: start 50 cents lower and glide up
    # Let's add a slow linear glide in frequency
    # We can just keep it simple with pure vibrato first
    audio[mask1] = np.sin(phase1)

    # Note 2: 3.0s to 5.0s (duration 2.0s)
    # fc = 440 Hz, no vibrato (just a constant pitch)
    fc2 = 440.0
    mask2 = (t >= 3.0) & (t < 5.0)
    t2 = t[mask2] - 3.0
    phase2 = 2.0 * np.pi * fc2 * t2
    audio[mask2] = np.sin(phase2)

    # Normalize to 16-bit PCM range
    audio = audio / np.max(np.abs(audio)) * 0.9
    audio_int16 = (audio * 32767).astype(np.int16)

    scipy.io.wavfile.write(filename, sr, audio_int16)
    print(f"Generated synthetic WAV file: {filename}")

if __name__ == "__main__":
    wav_path = "/home/user/vibrato_analyzer/synthetic_test.wav"
    json_path = "/home/user/vibrato_analyzer/output.json"
    
    generate_synthetic_audio(wav_path)
    
    # Run the analyzer script
    cmd = ["python3", "/home/user/vibrato_analyzer/analyze_vibrato.py", "--input", wav_path, "--output", json_path]
    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    print("STDOUT:")
    print(result.stdout)
    print("STDERR:")
    print(result.stderr)
    print(f"Exit code: {result.returncode}")
    
    # Read and print the JSON results
    try:
        with open(json_path, "r") as f:
            data = json.load(f)
        print("JSON Output:")
        print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"Error reading JSON output: {e}")
