import json
import numpy as np
import librosa

# Load audio
y, sr = librosa.load('/home/user/input.wav', sr=None)
duration = float(librosa.get_duration(y=y, sr=sr))

# Detect onsets with backtrack=True
onset_frames = librosa.onset.onset_detect(y=y, sr=sr, backtrack=True)
onset_times = librosa.frames_to_time(onset_frames, sr=sr)

# Sort and dedupe (keep first of exact duplicates)
onset_times = np.sort(np.unique(np.round(onset_times, 6)))

fmin_hz = librosa.note_to_hz('C2')
fmax_hz = librosa.note_to_hz('C7')

# First pass: estimate pitch for each segment between onsets
def estimate_pitch(y_seg, sr, fmin, fmax):
    if len(y_seg) < int(0.05 * sr):
        return None
    try:
        f0, _, _ = librosa.pyin(y_seg, fmin=fmin, fmax=fmax, sr=sr)
    except Exception:
        return None
    voiced = f0[~np.isnan(f0)]
    if len(voiced) == 0:
        return None
    hz = float(np.median(voiced))
    midi = int(round(float(librosa.hz_to_midi(hz))))
    return max(0, min(127, midi))

# Build candidate onsets with their pitches
candidates = []
for i in range(len(onset_times)):
    start = float(onset_times[i])
    end = float(onset_times[i + 1]) if i + 1 < len(onset_times) else duration
    if end <= start:
        end = start + 1.0 / sr
    s = int(start * sr)
    e = max(int(end * sr), s + 1)
    y_seg = y[s:e]
    pitch = estimate_pitch(y_seg, sr, fmin_hz, fmax_hz)
    candidates.append({'time': start, 'end': end, 'pitch': pitch})

# Filter: remove onsets whose pitch equals the previous kept onset's pitch
# These are false duplicates from the onset detector
filtered = []
for c in candidates:
    if c['pitch'] is None:
        filtered.append(c)
        continue
    if filtered and filtered[-1]['pitch'] == c['pitch']:
        # False duplicate - skip it
        continue
    filtered.append(c)

# Now compute final boundaries: each note ends at the next kept onset (or end of audio)
# Then re-estimate pitch using the full segment
raw_notes = []
for i, c in enumerate(filtered):
    start = c['time']
    end = float(filtered[i + 1]['time']) if i + 1 < len(filtered) else duration
    if end <= start:
        end = start + 1.0 / sr
    s = int(start * sr)
    e = max(int(end * sr), s + 1)
    y_seg = y[s:e]
    pitch = estimate_pitch(y_seg, sr, fmin_hz, fmax_hz)
    if pitch is None:
        continue
    raw_notes.append({
        'onset_sec': start,
        'offset_sec': end,
        'pitch_midi': pitch,
    })

# Pre-compute RMS
hop_length = 512
rms_all = librosa.feature.rms(y=y, hop_length=hop_length)[0]
rms_times = librosa.frames_to_time(np.arange(len(rms_all)), sr=sr, hop_length=hop_length)

# Compute RMS for each note
for n in raw_notes:
    start_frame = int(np.searchsorted(rms_times, n['onset_sec']))
    end_frame = int(np.searchsorted(rms_times, n['offset_sec']))
    end_frame = max(end_frame, start_frame + 1)
    seg_rms = rms_all[start_frame:end_frame]
    if len(seg_rms) == 0:
        seg_rms = np.array([0.0])
    n['rms'] = float(np.mean(seg_rms))

# Velocity from RMS
if len(raw_notes) > 0:
    rms_vals = np.array([n['rms'] for n in raw_notes])
    rmin = float(rms_vals.min())
    rmax = float(rms_vals.max())
    for n in raw_notes:
        if rmax > rmin:
            v = 1 + int(round((n['rms'] - rmin) / (rmax - rmin) * 126))
        else:
            v = 100
        n['velocity'] = max(1, min(127, v))

max_offset = duration + 0.1
for n in raw_notes:
    if n['offset_sec'] > max_offset:
        n['offset_sec'] = max_offset
    if n['offset_sec'] <= n['onset_sec']:
        n['offset_sec'] = n['onset_sec'] + 1.0 / sr

final_notes = [
    {
        'onset_sec': float(n['onset_sec']),
        'offset_sec': float(n['offset_sec']),
        'pitch_midi': int(n['pitch_midi']),
        'velocity': int(n['velocity']),
    }
    for n in raw_notes
]

final_notes.sort(key=lambda x: x['onset_sec'])

with open('/home/user/notes.json', 'w') as f:
    json.dump(final_notes, f, indent=2)

print(f"Wrote {len(final_notes)} notes to /home/user/notes.json")
for n in final_notes:
    print(n)
