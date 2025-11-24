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

print("First 5 rows of the dataset:\n", df.head())
print("\nDataset Information:\n")
print(df.info())

# Preprocess
try:
    # Convert categorical columns to numeric
    df['graphics_preset'] = df['graphics_preset'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
    df['shadow_quality'] = df['shadow_quality'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
    df['texture_quality'] = df['texture_quality'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
    df['vsync'] = df['vsync'].map({'On': 1, 'Off': 0})
    df['anti_aliasing'] = df['anti_aliasing'].map({'Off': 0, 'FXAA': 1, 'TAA': 2})
    
    # Create performance ratio features (user hardware vs game minimum requirements)
    # These ratios help the model understand relative performance
    df['cpu_ratio'] = df['cpu_score'] / df['game_cpu_min']
    df['gpu_ratio'] = df['gpu_score'] / df['game_gpu_min']
    df['ram_ratio'] = df['ram_score'] / df['game_ram_min']
    
    # Calculate total pixels (resolution impact)
    df['total_pixels'] = df['res_width'] * df['res_height']
    
    print("\nCreated engineered features:")
    print(f"  - cpu_ratio: {df['cpu_ratio'].min():.2f} to {df['cpu_ratio'].max():.2f}")
    print(f"  - gpu_ratio: {df['gpu_ratio'].min():.2f} to {df['gpu_ratio'].max():.2f}")
    print(f"  - ram_ratio: {df['ram_ratio'].min():.2f} to {df['ram_ratio'].max():.2f}")
    
except Exception as e:
    print(f"Error data conversion: {e}")

# Drop game_title and now-redundant columns (we have ratios instead)
df = df.drop(columns=['game_title', 'res_width', 'res_height'], errors='ignore')

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

# Calculate MAPE (Mean Absolute Percentage Error) for better interpretation
mape = np.mean(np.abs((y_test - y_pred) / y_test)) * 100

print("\nModel Performance Metrics:")
print(f"Mean Absolute Error (MAE): {mae:.2f} FPS")
print(f"Mean Squared Error (MSE): {mse:.2f}")
print(f"Root Mean Squared Error (RMSE): {rmse:.2f} FPS")
print(f"R² Score: {r2:.3f} (explains {r2*100:.1f}% of variance)")
print(f"Mean Absolute Percentage Error (MAPE): {mape:.2f}%")
print(f"CV MAE (5-fold) mean: {cvs.mean():.2f} FPS")

# Show prediction examples
print("\nSample Predictions vs Actual:")
print("Actual FPS | Predicted FPS | Error")
print("-" * 40)
for i in range(min(10, len(y_test))):
    actual = y_test.iloc[i]
    predicted = y_pred[i]
    error = abs(actual - predicted)
    print(f"{actual:10.1f} | {predicted:13.1f} | {error:5.1f}")
    
# Feature importance
feature_importance = pd.DataFrame({
    'feature': X.columns,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False)

print("\nTop 10 Most Important Features:")
print(feature_importance.head(10).to_string(index=False))

# Save model for later use
# joblib.dump(model, './models/gamespec_optimizer.pkl')
# print("\nModel training complete and saved as gamespec_optimizer.pkl")