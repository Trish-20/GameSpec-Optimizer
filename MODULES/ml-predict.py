import sys
import json
import joblib
import os
import pandas as pd


def normalize_performance_mode(value):
    mapping = {
        'battery': -1,
        'balanced': 0,
        'performance': 1,
        '-1': -1,
        '0': 0,
        '1': 1
    }

    if isinstance(value, (int, float)):
        return int(value)

    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in mapping:
            return mapping[normalized]
        try:
            return int(float(normalized))
        except ValueError:
            return 0

    return 0

def predict_fps(input_data):
    """
    Expected input_data keys:
    - game_cpu_min, game_gpu_min, game_ram_min (game requirements)
    - cpu_score, gpu_score, ram_score (user hardware scores)
    - res_width, res_height (res)
    - graphics_preset, shadow_quality, texture_quality (Low/Medium/High/Ultra)
    - anti_aliasing (Off/FXAA/TAA)
    - vsync (On/Off)
    - performance_mode (battery/balanced/performance)
    """
    
    try:
        # Get script directory for model paths
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Load trained models
        gb_model = joblib.load(os.path.join(script_dir, 'gb_model.joblib'))
        xgb_model = joblib.load(os.path.join(script_dir, 'xgb_model.joblib'))
        feature_columns = joblib.load(os.path.join(script_dir, 'feature_columns.joblib'))
        
        # Map categorical values to numeric
        preset_map = {'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3}
        aa_map = {'Off': 0, 'FXAA': 1, 'TAA': 2}
        vsync_map = {'On': 1, 'Off': 0}
        
        # Calculate engineered features (same as training)
        cpu_ratio = input_data['cpu_score'] / input_data['game_cpu_min']
        gpu_ratio = input_data['gpu_score'] / input_data['game_gpu_min']
        ram_ratio = input_data['ram_score'] / input_data['game_ram_min']
        total_pixels = input_data['res_width'] * input_data['res_height']
        
        # Build feature array in correct order
        features = {
            'game_cpu_min': input_data['game_cpu_min'],
            'game_gpu_min': input_data['game_gpu_min'],
            'game_ram_min': input_data['game_ram_min'],
            'cpu_score': input_data['cpu_score'],
            'gpu_score': input_data['gpu_score'],
            'ram_score': input_data['ram_score'],
            'graphics_preset': preset_map.get(input_data.get('graphics_preset', 'Medium'), 1),
            'shadow_quality': preset_map.get(input_data.get('shadow_quality', 'Medium'), 1),
            'texture_quality': preset_map.get(input_data.get('texture_quality', 'Medium'), 1),
            'anti_aliasing': aa_map.get(input_data.get('anti_aliasing', 'Off'), 0),
            'vsync': vsync_map.get(input_data.get('vsync', 'Off'), 0),
            'performance_mode': normalize_performance_mode(input_data.get('performance_mode', 0)),
            'cpu_ratio': cpu_ratio,
            'gpu_ratio': gpu_ratio,
            'ram_ratio': ram_ratio,
            'total_pixels': total_pixels
        }
        
        # Create feature frame in correct column order
        feature_array = pd.DataFrame([[features[col] for col in feature_columns]], columns=feature_columns)
        
        # Ensemble prediction (average of both models)
        gb_pred = gb_model.predict(feature_array)[0]
        xgb_pred = xgb_model.predict(feature_array)[0]
        predicted_fps = (gb_pred + xgb_pred) / 2
        
        # Apply performance mode modifier if provided
        performance_mode = normalize_performance_mode(input_data.get('performance_mode', 0))
        if performance_mode == 1:
            predicted_fps *= 1.05  # +15%
        elif performance_mode == -1:
            predicted_fps *= 0.95  # -15%
        
        # Clamp to reasonable FPS range
        predicted_fps = max(1, min(predicted_fps, 500))
        
        return {
            'success': True,
            'predicted_fps': float(round(predicted_fps, 1)),
            'performance_mode': performance_mode,
            'hardware_ratios': {
                'cpu': round(cpu_ratio, 2),
                'gpu': round(gpu_ratio, 2),
                'ram': round(ram_ratio, 2)
            }
        }
        
    except FileNotFoundError as e:
        return {
            'success': False,
            'error': 'Models not found. Please run ml-training.py first.',
            'detail': str(e)
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == '__main__':
    # Read JSON input from command line argument or stdin
    if len(sys.argv) > 1:
        input_json = sys.argv[1]
    else:
        input_json = sys.stdin.read()
    
    try:
        input_data = json.loads(input_json)
        result = predict_fps(input_data)
    except json.JSONDecodeError as e:
        result = {
            'success': False,
            'error': 'Invalid JSON input',
            'detail': str(e)
        }
    
    # Output JSON result
    print(json.dumps(result))
