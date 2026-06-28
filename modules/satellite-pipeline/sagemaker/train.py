import json
import torch
import torch.nn as nn
import numpy as np

class PriorityNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(5, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.net(x)

if __name__ == "__main__":
    with open("/opt/ml/input/data/training/training-data.json") as f:
        data = json.load(f)

    features = np.array([[d["elevation"], d["carbon"], d["biodiversity"], d["water"], d["land_degradation"]] for d in data])
    labels = np.array([[d["priority"]] for d in data])

    X = torch.tensor(features, dtype=torch.float32)
    y = torch.tensor(labels, dtype=torch.float32)

    model = PriorityNet()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    loss_fn = nn.MSELoss()

    for epoch in range(100):
        pred = model(X)
        loss = loss_fn(pred, y)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}, Loss: {loss.item():.6f}")

    torch.save(model.state_dict(), "/opt/ml/model/model.pth")
    print("Model saved.")
