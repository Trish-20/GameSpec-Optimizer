import pandas as pd
import re

df = pd.read_csv("GPU-benchmarks-v7-import.csv")

def normalize_benchmark_name(value):
    if not isinstance(value, str):
        return value
    val = value.lower()
    val = re.sub(r'\(r\)|\(tm\)|™|®', '', val)
    val = re.sub(r'\b(nvidia|amd|intel|geforce|radeon)\b', '', val)
    val = re.sub(r'[^a-z0-9]+', ' ', val)
    val = re.sub(r'\s+', ' ', val).strip()
    return val

df['normalized_model'] = df['model'].apply(normalize_benchmark_name)
output_file = "GPU-benchmarks-v7-import-normalized.csv"
df.to_csv(output_file, index=False)
print(df[['model', 'normalized_model']].head(10))