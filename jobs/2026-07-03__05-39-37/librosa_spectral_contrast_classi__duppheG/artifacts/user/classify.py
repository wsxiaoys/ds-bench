import os
import numpy as np
import librosa
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

SR = 22050

TRAIN_DIRS = {
    "speech": "/home/user/train/speech",
    "music": "/home/user/train/music",
}
TEST_DIR = "/home/user/test"
OUT_PATH = "/home/user/predictions.csv"


def extract_features(path):
    y, _ = librosa.load(path, sr=SR)

    mfcc = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=20)
    contrast = librosa.feature.spectral_contrast(y=y, sr=SR, n_bands=6)
    zcr = librosa.feature.zero_crossing_rate(y=y)
    centroid = librosa.feature.spectral_centroid(y=y, sr=SR)

    feats = []
    for feat in (mfcc, contrast, zcr, centroid):
        feats.append(np.mean(feat, axis=1))
        feats.append(np.std(feat, axis=1))

    return np.concatenate(feats)


def load_dir(directory):
    feats = []
    for fn in sorted(os.listdir(directory)):
        if not fn.lower().endswith(".wav"):
            continue
        feats.append((fn, extract_features(os.path.join(directory, fn))))
    return feats


def main():
    X, y = [], []
    for label, directory in TRAIN_DIRS.items():
        for fn, vec in load_dir(directory):
            X.append(vec)
            y.append(label)

    X = np.array(X)
    y = np.array(y)

    scaler = StandardScaler()
    X = scaler.fit_transform(X)

    model = LogisticRegression(max_iter=1000)
    model.fit(X, y)

    test_files = sorted(
        f for f in os.listdir(TEST_DIR) if f.lower().endswith(".wav")
    )
    X_test = np.array(
        [extract_features(os.path.join(TEST_DIR, fn)) for fn in test_files]
    )
    X_test = scaler.transform(X_test)
    preds = model.predict(X_test)

    with open(OUT_PATH, "w") as f:
        f.write("filename,label\n")
        for fn, label in zip(test_files, preds):
            f.write(f"{fn},{label}\n")

    print("Wrote", OUT_PATH)
    for fn, label in zip(test_files, preds):
        print(fn, label)


if __name__ == "__main__":
    main()