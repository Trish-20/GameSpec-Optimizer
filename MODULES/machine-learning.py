import sys, json
import joblib
import pandas as pd

model = joblib.load('fps_predict_model.pkl')

# Parse input
hardware = json.loads(sys.argv[1])
# Convert to dataframe
df_in = pd.DataFrame([hardware])

# Preprocess like training
df_in['width'] = df_in['resolution'].apply(lambda x: int(x.split('x')[0]))
df_in['height'] = df_in['resolution'].apply(lambda x: int(x.split('x')[1]))
df_in = df_in.drop(columns=['resolution', 'cpu_model', 'gpu_model'])

prediction = model.predict(df_in)[0]

print(json.dumps({"predicted_fps": prediction}))


# flask tutorial: https://www.youtube.com/watch?v=0nr6TPKlrN0
# PREDICTIVE ML TUTORIAL: https://www.youtube.com/watch?v=rcXAb1eKZ_I&list=PLTgRMOcmRb3OhlETr90y_hIMpQLR-DyLz&index=2

# needed data: gpu and cpu benchmark scores, ram size