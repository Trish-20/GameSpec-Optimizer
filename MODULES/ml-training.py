import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np
import joblib
# Load CSV
try:
    df = pd.read_csv('./DATA/benchmark-data.csv')
except FileNotFoundError:
    print("Error: Dataset file not found. Please check the file path.")
    exit()

# expected values of each column
# storage_ssd(0, 1),graphics_preset(0 - low, 1 - Medium, 2 - High),shadow_quality and texture_quality(0 - low, 1 - medium, 2 - high, 3 - ultra),anti_aliasing(?),vsync(0, 1),performance_mode(-1 - battery saver, 0 - balanced mode, +1 - performance mode),expected_fps

print("First 5 rows of the dataset:\n", df.head())
print("\nDataset Information:\n")
print(df.info())

# Preprocess
try:
    # expected columns:
    # game_title,cpu_score,gpu_score,ram_score,gpu_vram_gb,storage_ssd,res_width,res_height,graphics_preset,shadow_quality,texture_quality,anti_aliasing,vsync,performance_mode,expected_fps
    df['graphics_preset'] = df['graphics_preset'].map({'Low': 0, 'Medium': 1, 'High': 2})
    df['shadow_quality'] = df['shadow_quality'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
    df['texture_quality'] = df['texture_quality'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
    df['vsync'] = df['vsync'].map({'On': 1, 'Off': 0})
    df['anti_aliasing'] = df['anti_aliasing'].map({'Off': 0, 'FXAA': 1, 'TAA': 2})
except Exception as e:
    print(f"Error data conversion: {e}")

# Drop game_title (non-numeric)
df = df.drop(columns=['game_title'], errors='ignore')

# Separate features (X) and target (y)
X = df.drop(columns=['expected_fps'])
y = df['expected_fps']

# Split the dataset into training and testing (80/20 split)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Initialize and train the Random Forest Regressor
model = RandomForestRegressor(n_estimators=200, random_state=42)
model.fit(X_train, y_train)

# Predict on test data
y_pred = model.predict(X_test)

# Evaluate model performance
mae = mean_absolute_error(y_test, y_pred)
mse = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, y_pred)
cvs = -cross_val_score(model, X, y, cv=5, scoring='neg_mean_absolute_error', n_jobs=-1)

print("\nModel Performance Metrics:")
print(f"Mean Absolute Error (MAE): {mae:.2f}")
print(f"Mean Squared Error (MSE): {mse:.2f}")
print(f"Root Mean Squared Error (RMSE): {rmse:.2f}")
print(f"R² Score: {r2:.3f}")
print("CV MAE (5-fold) mean:", cvs.mean())

# Save model for later use
# joblib.dump(model, './models/gamespec_optimizer.pkl')
# print("\nModel training complete and saved as gamespec_optimizer.pkl")