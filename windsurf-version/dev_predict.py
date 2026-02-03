import sys, json, numpy as np
from PIL import Image
from tensorflow.keras.models import load_model

MODEL_PATH = 'OpNamingBot/data/model.h5'
CLASSES_PATH = 'OpNamingBot/data/classes.json'
if len(sys.argv) < 2:
    print("Usage: python dev_predict.py path/to/image.png")
    sys.exit(1)
IMG = sys.argv[1]

model = load_model(MODEL_PATH, compile=False)
with open(CLASSES_PATH, 'r') as f:
    classes = json.load(f)

# build inverse map (robust)
if all(isinstance(v, int) or (isinstance(v, str) and v.isdigit()) for v in classes.values()):
    inv = {int(v): k for k, v in classes.items()}
else:
    inv = {int(k): v for k, v in classes.items()}

img = Image.open(IMG).convert('RGB')
# apply same preprocessing as the bot: resize to 64x64 (adjust if your model uses a different size)
img = img.resize((64,64))
arr = np.array(img, dtype=np.float32) / 255.0
arr = np.expand_dims(arr, 0)

preds = model.predict(arr)
probs = preds[0]
topk = probs.argsort()[-5:][::-1]
print("Top-k predictions:")
for idx in topk:
    print(idx, inv.get(int(idx), f"idx_{idx}"), probs[int(idx)])
print("Top-1:", inv.get(int(topk[0]), "unknown"))