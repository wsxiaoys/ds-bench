import os
import glob
import csv
import numpy as np
import librosa
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

def extract_features(file_path, sr=22050):
    """
    Extracts a 1-D feature vector from a WAV file.
    Concatenates the temporal mean and standard deviation (over time frames) of:
    1. MFCCs with n_mfcc=20
    2. Spectral contrast with n_bands=6
    3. Zero crossing rate
    4. Spectral centroid
    """
    y, sr = librosa.load(file_path, sr=sr)
    
    # 1. MFCCs
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mean_mfcc = np.mean(mfccs, axis=1)
    std_mfcc = np.std(mfccs, axis=1)
    
    # 2. Spectral contrast
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=6)
    mean_contrast = np.mean(contrast, axis=1)
    std_contrast = np.std(contrast, axis=1)
    
    # 3. Zero crossing rate
    zcr = librosa.feature.zero_crossing_rate(y=y)
    mean_zcr = np.mean(zcr, axis=1)
    std_zcr = np.std(zcr, axis=1)
    
    # 4. Spectral centroid
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    mean_centroid = np.mean(centroid, axis=1)
    std_centroid = np.std(centroid, axis=1)
    
    # Concatenate temporal mean and std for each family
    feature_vector = np.concatenate([
        mean_mfcc, std_mfcc,
        mean_contrast, std_contrast,
        mean_zcr, std_zcr,
        mean_centroid, std_centroid
    ])
    
    return feature_vector

def main():
    train_speech_dir = "/home/user/train/speech"
    train_music_dir = "/home/user/train/music"
    test_dir = "/home/user/test"
    output_csv = "/home/user/predictions.csv"
    
    # Find all training files
    speech_files = sorted(glob.glob(os.path.join(train_speech_dir, "*.wav")))
    music_files = sorted(glob.glob(os.path.join(train_music_dir, "*.wav")))
    
    print(f"Found {len(speech_files)} speech training files.")
    print(f"Found {len(music_files)} music training files.")
    
    X_train = []
    y_train = []
    
    # Process speech training files
    for f in speech_files:
        print(f"Extracting features from speech train: {os.path.basename(f)}")
        features = extract_features(f)
        X_train.append(features)
        y_train.append("speech")
        
    # Process music training files
    for f in music_files:
        print(f"Extracting features from music train: {os.path.basename(f)}")
        features = extract_features(f)
        X_train.append(features)
        y_train.append("music")
        
    X_train = np.array(X_train)
    y_train = np.array(y_train)
    
    print(f"Training feature matrix shape: {X_train.shape}")
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    
    # Train Logistic Regression model
    model = LogisticRegression(random_state=42)
    model.fit(X_train_scaled, y_train)
    print("Logistic Regression model trained successfully.")
    
    # Find and process test files
    test_files = sorted(glob.glob(os.path.join(test_dir, "*.wav")))
    print(f"Found {len(test_files)} test files.")
    
    X_test = []
    test_filenames = []
    
    for f in test_files:
        basename = os.path.basename(f)
        print(f"Extracting features from test file: {basename}")
        features = extract_features(f)
        X_test.append(features)
        test_filenames.append(basename)
        
    X_test = np.array(X_test)
    X_test_scaled = scaler.transform(X_test)
    
    # Predict labels
    predictions = model.predict(X_test_scaled)
    
    # Write to CSV
    with open(output_csv, mode="w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["filename", "label"])
        for basename, label in zip(test_filenames, predictions):
            writer.writerow([basename, label])
            
    print(f"Predictions written to {output_csv}")
    
    # Display predictions
    print("\nGenerated Predictions:")
    print("filename,label")
    for basename, label in zip(test_filenames, predictions):
        print(f"{basename},{label}")

if __name__ == "__main__":
    main()
