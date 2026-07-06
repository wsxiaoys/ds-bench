import os
import csv
import numpy as np
import librosa
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler


SAMPLE_RATE = 22050
TRAIN_SPEECH_DIR = "/home/user/train/speech"
TRAIN_MUSIC_DIR = "/home/user/train/music"
TEST_DIR = "/home/user/test"
OUT_CSV = "/home/user/predictions.csv"


def extract_features(path: str) -> np.ndarray:
    """Extract a fixed-size feature vector from an audio file."""
    y, sr = librosa.load(path, sr=SAMPLE_RATE)

    # Required feature families
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=6)
    zcr = librosa.feature.zero_crossing_rate(y=y)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)

    # Aggregate over time axis: mean + std for each family, then concatenate
    parts = []
    for feat in (mfcc, contrast, zcr, centroid):
        parts.append(np.mean(feat, axis=1))
        parts.append(np.std(feat, axis=1))

    return np.concatenate(parts)


def load_split(directory: str, label: str):
    """Return (X, y, filenames) for all WAVs in a directory."""
    X, y, names = [], [], []
    for fname in sorted(os.listdir(directory)):
        if not fname.lower().endswith(".wav"):
            continue
        X.append(extract_features(os.path.join(directory, fname)))
        y.append(label)
        names.append(fname)
    return np.vstack(X), np.array(y), names


def main():
    # Load training data
    Xs, ys, _ = load_split(TRAIN_SPEECH_DIR, "speech")
    Xm, ym, _ = load_split(TRAIN_MUSIC_DIR, "music")
    X_train = np.vstack([Xs, Xm])
    y_train = np.concatenate([ys, ym])

    # Standardize features (essential since MFCCs/centroid are on different scales)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)

    # Train classifier
    clf = LogisticRegression(max_iter=1000)
    clf.fit(X_train_scaled, y_train)

    # Sanity check on training
    train_pred = clf.predict(X_train_scaled)
    print(f"Train accuracy: {(train_pred == y_train).mean():.2%}")

    # Load test files (basenames, sorted, dedup)
    test_files = sorted(
        f for f in os.listdir(TEST_DIR) if f.lower().endswith(".wav")
    )
    seen = set()
    unique_files = []
    for f in test_files:
        if f not in seen:
            seen.add(f)
            unique_files.append(f)

    X_test = np.vstack(
        [extract_features(os.path.join(TEST_DIR, f)) for f in unique_files]
    )
    X_test_scaled = scaler.transform(X_test)
    preds = clf.predict(X_test_scaled)

    # Write CSV
    with open(OUT_CSV, "w", newline="") as fp:
        w = csv.writer(fp)
        w.writerow(["filename", "label"])
        for fname, label in zip(unique_files, preds):
            w.writerow([fname, label])

    print(f"\nWrote {len(unique_files)} predictions to {OUT_CSV}")
    print("Predictions:")
    for f, p in zip(unique_files, preds):
        print(f"  {f}: {p}")


if __name__ == "__main__":
    main()