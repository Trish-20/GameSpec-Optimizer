import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor
import numpy as np

try:
    df = pd.read_csv('./DATA/benchmark-data.csv')
except FileNotFoundError: 
    print("Error: Dataset file not found. Please check the file path.")
    exit()

print("First 5 rows of the dataset:\n", df.head())
print("\nDataset Information:\n")
print(df.info())

# Preproc
try:
    # categ to numeric column conversion
    df['graphics_preset'] = df['graphics_preset'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
    df['shadow_quality'] = df['shadow_quality'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
    df['texture_quality'] = df['texture_quality'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
    df['vsync'] = df['vsync'].map({'On': 1, 'Off': 0})
    df['anti_aliasing'] = df['anti_aliasing'].map({'Off': 0, 'FXAA': 1, 'TAA': 2})
    
    # direct comparison of user hardware to game reqs, creating performance ratio
    # to check how high or how low the user's hardware stands against the game's minimum requirements
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

# Drop game_title (replacement is min_gpu, cpu, etc.) and redundant columns (replaced by total px)
df = df.drop(columns=[
    'game_title', 
    'res_width', 'res_height'
], errors='ignore')

# Separate features (x) and target (y)
x = df.drop(columns=['expected_fps'])
y = df['expected_fps']

# 8:2 split
x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=44)

# Voting Ensemble (GB + XGB) - combines predictions from both models
print("\nTraining Voting Ensemble (GB + XGB)...")

# Gradient Boosting model - optimized parameters
gb_model = GradientBoostingRegressor(
    n_estimators=300,           # Optimal: avoids overfitting and under, 300 is over and 150 is under, 250 is slightly worse
    max_depth=8,
    learning_rate=0.05,         # Optimal: balanced convergence, 0.1 is dum, 0.03 is dum2
    subsample=0.8,
    random_state=44
)

# XGBoost model - aligned with GB optimal settings
xgb_model = XGBRegressor(
    n_estimators=400,           # Matched with GB
    max_depth=8,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.7,
    random_state=44,
    n_jobs=-1
)

# Train both models
gb_model.fit(x_train, y_train)
xgb_model.fit(x_train, y_train)

# Ensemble prediction = average of both
gb_pred = gb_model.predict(x_test)
xgb_pred = xgb_model.predict(x_test)
y_pred = (gb_pred + xgb_pred) / 2

# For cross-validation, we need a custom approach
# Use GB's CV as approximation (ensemble CV would require custom scorer)
cvs = -cross_val_score(gb_model, x, y, cv=5, scoring='neg_mean_absolute_error', n_jobs=-1)

# Evaluate model performance
mae = mean_absolute_error(y_test, y_pred)
mse = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, y_pred)
mape = np.mean(np.abs((y_test - y_pred) / y_test)) * 100 # Percentage of MAE

print("\nEnsemble Model Performance Metrics:")
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

# Save trained models for prediction use
import joblib
import os

model_dir = os.path.dirname(os.path.abspath(__file__))
joblib.dump(gb_model, os.path.join(model_dir, 'gb_model.joblib'))
joblib.dump(xgb_model, os.path.join(model_dir, 'xgb_model.joblib'))
joblib.dump(list(x.columns), os.path.join(model_dir, 'feature_columns.joblib'))

print("\nModels saved successfully:")
print(f"  - gb_model.joblib")
print(f"  - xgb_model.joblib")
print(f"  - feature_columns.joblib")

