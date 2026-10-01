import importlib.util
import os

from flask import Flask, jsonify, request


app = Flask(__name__)

model_path = os.path.join(os.path.dirname(__file__), 'MODULES', 'ml-predict.py')
spec = importlib.util.spec_from_file_location('ml_predict', model_path)
if spec is None or spec.loader is None:
    raise RuntimeError('Unable to load the prediction model module.')
ml_predict = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ml_predict)


@app.get('/health')
def health():
    return jsonify({'status': 'ok'})


@app.post('/predict')
def predict():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({'success': False, 'error': 'Invalid JSON input'}), 400

    result = ml_predict.predict_fps(payload)
    return jsonify(result), 200 if result.get('success') else 422