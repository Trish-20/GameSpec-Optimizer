import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor
import numpy as np
import time

try:
    df = pd.read_csv('./DATA/benchmark-data.csv')
except FileNotFoundError:
    print("Error: Dataset file not found. Please check the file path.")
    exit()

# Preproc
df['graphics_preset'] = df['graphics_preset'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
df['shadow_quality'] = df['shadow_quality'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
df['texture_quality'] = df['texture_quality'].map({'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3})
df['vsync'] = df['vsync'].map({'On': 1, 'Off': 0})
df['anti_aliasing'] = df['anti_aliasing'].map({'Off': 0, 'FXAA': 1, 'TAA': 2})

df['cpu_ratio'] = df['cpu_score'] / df['game_cpu_min']
df['gpu_ratio'] = df['gpu_score'] / df['game_gpu_min']
df['ram_ratio'] = df['ram_score'] / df['game_ram_min']
df['total_pixels'] = df['res_width'] * df['res_height']

df = df.drop(columns=['game_title', 'res_width', 'res_height'], errors='ignore')

x = df.drop(columns=['expected_fps'])
y = df['expected_fps']

x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=44)

# ===== MODEL 1: RANDOM FOREST (Current) =====
# WHY: Your baseline. Uses multiple decision trees that vote together.
#      Good for non-linear data, handles feature interactions naturally.
print("=" * 60)
print("MODEL 1: RANDOM FOREST REGRESSOR (Current)")
print("=" * 60)
print("WHY: Ensemble of decision trees that average predictions.")
print("     Handles non-linear relationships and feature interactions.")
print("     Resistant to overfitting through bagging (random sampling).")
print("-" * 60)

start = time.time()
rf_model = RandomForestRegressor(
    n_estimators=700,
    max_depth=40,
    min_samples_split=3,
    min_samples_leaf=1,
    max_features=0.7,
    min_impurity_decrease=0.00005,
    max_samples=0.8,
    random_state=44,
    n_jobs=-1
)
rf_model.fit(x_train, y_train)
rf_time = time.time() - start

rf_pred = rf_model.predict(x_test)
rf_mae = mean_absolute_error(y_test, rf_pred)
rf_rmse = np.sqrt(mean_squared_error(y_test, rf_pred))
rf_r2 = r2_score(y_test, rf_pred)
rf_mape = np.mean(np.abs((y_test - rf_pred) / y_test)) * 100

print(f"MAE:  {rf_mae:.2f} FPS")
print(f"RMSE: {rf_rmse:.2f} FPS")
print(f"R²:   {rf_r2:.3f} ({rf_r2*100:.1f}%)")
print(f"MAPE: {rf_mape:.2f}%")
print(f"Training Time: {rf_time:.2f}s")


# ===== MODEL 2: GRADIENT BOOSTING =====
# WHY: Builds trees sequentially, each one correcting previous errors.
#      Often more accurate than RF but slower. Good for complex patterns.
print("\n" + "=" * 60)
print("MODEL 2: GRADIENT BOOSTING REGRESSOR")
print("=" * 60)
print("WHY: Builds trees sequentially - each tree fixes previous errors.")
print("     Uses 'boosting' instead of 'bagging' (RF's approach).")
print("     Often achieves higher accuracy on structured/tabular data.")
print("     Good for capturing subtle patterns RF might miss.")
print("-" * 60)

start = time.time()
gb_model = GradientBoostingRegressor(
    n_estimators=500,           # Number of boosting stages
    max_depth=10,               # Shallower trees (boosting corrects errors iteratively)
    learning_rate=0.05,         # How much each tree contributes (lower = more trees needed)
    min_samples_split=5,
    min_samples_leaf=2,
    subsample=0.8,              # Use 80% of data per tree (reduces overfitting)
    max_features=0.7,
    random_state=44
)
gb_model.fit(x_train, y_train)
gb_time = time.time() - start

gb_pred = gb_model.predict(x_test)
gb_mae = mean_absolute_error(y_test, gb_pred)
gb_rmse = np.sqrt(mean_squared_error(y_test, gb_pred))
gb_r2 = r2_score(y_test, gb_pred)
gb_mape = np.mean(np.abs((y_test - gb_pred) / y_test)) * 100

print(f"MAE:  {gb_mae:.2f} FPS")
print(f"RMSE: {gb_rmse:.2f} FPS")
print(f"R²:   {gb_r2:.3f} ({gb_r2*100:.1f}%)")
print(f"MAPE: {gb_mape:.2f}%")
print(f"Training Time: {gb_time:.2f}s")


# ===== MODEL 3: XGBOOST =====
# WHY: Optimized gradient boosting with regularization.
#      Industry standard for tabular data competitions (Kaggle).
#      Faster and often more accurate than sklearn's GradientBoosting.
print("\n" + "=" * 60)
print("MODEL 3: XGBOOST REGRESSOR")
print("=" * 60)
print("WHY: Extreme Gradient Boosting - optimized version of GB.")
print("     Industry standard for tabular/structured data.")
print("     Built-in regularization prevents overfitting.")
print("     Handles missing values automatically.")
print("     Often wins ML competitions (Kaggle) for this data type.")
print("-" * 60)

start = time.time()
xgb_model = XGBRegressor(
    n_estimators=500,
    max_depth=10,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.7,       # Similar to max_features
    reg_alpha=0.1,              # L1 regularization (reduces overfitting)
    reg_lambda=1.0,             # L2 regularization
    random_state=44,
    n_jobs=-1
)
xgb_model.fit(x_train, y_train)
xgb_time = time.time() - start

xgb_pred = xgb_model.predict(x_test)
xgb_mae = mean_absolute_error(y_test, xgb_pred)
xgb_rmse = np.sqrt(mean_squared_error(y_test, xgb_pred))
xgb_r2 = r2_score(y_test, xgb_pred)
xgb_mape = np.mean(np.abs((y_test - xgb_pred) / y_test)) * 100

print(f"MAE:  {xgb_mae:.2f} FPS")
print(f"RMSE: {xgb_rmse:.2f} FPS")
print(f"R²:   {xgb_r2:.3f} ({xgb_r2*100:.1f}%)")
print(f"MAPE: {xgb_mape:.2f}%")
print(f"Training Time: {xgb_time:.2f}s")


# ===== COMPARISON SUMMARY =====
print("\n" + "=" * 60)
print("COMPARISON SUMMARY")
print("=" * 60)
print(f"{'Model':<25} {'MAE':>10} {'RMSE':>10} {'R²':>10} {'MAPE':>10} {'Time':>10}")
print("-" * 75)
print(f"{'Random Forest':<25} {rf_mae:>10.2f} {rf_rmse:>10.2f} {rf_r2:>10.3f} {rf_mape:>9.2f}% {rf_time:>9.2f}s")
print(f"{'Gradient Boosting':<25} {gb_mae:>10.2f} {gb_rmse:>10.2f} {gb_r2:>10.3f} {gb_mape:>9.2f}% {gb_time:>9.2f}s")
print(f"{'XGBoost':<25} {xgb_mae:>10.2f} {xgb_rmse:>10.2f} {xgb_r2:>10.3f} {xgb_mape:>9.2f}% {xgb_time:>9.2f}s")

# Find best model
best_mae = min(rf_mae, gb_mae, xgb_mae)
if best_mae == rf_mae:
    winner = "Random Forest"
elif best_mae == gb_mae:
    winner = "Gradient Boosting"
else:
    winner = "XGBoost"

print("-" * 75)
print(f"🏆 BEST MODEL (lowest MAE): {winner} with {best_mae:.2f} FPS error")
