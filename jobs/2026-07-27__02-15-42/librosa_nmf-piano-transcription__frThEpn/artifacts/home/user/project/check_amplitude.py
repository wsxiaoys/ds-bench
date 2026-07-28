import librosa
import numpy as np

y, sr = librosa.load('data/sample_mixture.wav', sr=22050)
print("Max absolute amplitude of sample mixture:", np.max(np.abs(y)))
