import json
import torch
import numpy as np
from train import PriorityNet

def model_fn(model_dir):
    model = PriorityNet()
    model.load_state_dict(torch.load(f"{model_dir}/model.pth", map_location="cpu"))
    model.eval()
    return model

def input_fn(request_body, request_content_type):
    data = json.loads(request_body)
    features = [[d["elevation"], d["carbon"], d["biodiversity"], d["water"], d["land_degradation"]] for d in data]
    return torch.tensor(features, dtype=torch.float32)

def predict_fn(input_data, model):
    with torch.no_grad():
        return model(input_data)

def output_fn(prediction, response_content_type):
    scores = prediction.numpy().flatten().tolist()
    return json.dumps([{"priority": round(s, 4)} for s in scores])
