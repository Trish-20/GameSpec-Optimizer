import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib

# Load CSV
df = pd.read_csv('benchmark_data.csv')

# Preprocess: encode categorical fields, convert resolution string to width & height numeric
df['width'] = df['resolution'].apply(lambda x: int(x.split('x')[0]))
df['height'] = df['resolution'].apply(lambda x: int(x.split('x')[1]))
# Example: drop original resolution
df = df.drop(columns=['resolution', 'cpu_model', 'gpu_model'])  # you may encode models later

# Features & target
X = df.drop(columns=['average_fps'])
y = df['average_fps']

# Simple split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train model
rf = RandomForestRegressor(n_estimators=100, random_state=42)
rf.fit(X_train, y_train)

# Save model
joblib.dump(rf, 'fps_predict_model.pkl')

# Example prediction
sample = X_test.iloc[0:1]
predicted = rf.predict(sample)
print("Predicted FPS:", predicted)
