"""ViT-Small model for center line classification"""

import torch
import torch.nn as nn
import timm

from config import MODEL_CONFIG


class CenterLineClassifier(nn.Module):
    """ViT-Smallベースの中央線分類モデル"""

    def __init__(self, pretrained: bool = True):
        super().__init__()

        # ViT-Small backbone
        self.backbone = timm.create_model(
            MODEL_CONFIG["name"],
            pretrained=pretrained,
            num_classes=0,  # Remove classification head
        )

        # Get feature dimension
        with torch.no_grad():
            dummy_input = torch.randn(1, 3, MODEL_CONFIG["input_size"], MODEL_CONFIG["input_size"])
            features = self.backbone(dummy_input)
            feature_dim = features.shape[-1]

        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(feature_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 1),
        )

    def forward(self, x):
        features = self.backbone(x)
        logits = self.classifier(features)
        return logits.squeeze(-1)  # (batch_size,)

    def predict(self, x):
        """確率を返す"""
        with torch.no_grad():
            logits = self.forward(x)
            probs = torch.sigmoid(logits)
        return probs


def load_model(checkpoint_path: str, device: str = "cuda"):
    """学習済みモデルをロード"""
    model = CenterLineClassifier(pretrained=False)
    model.load_state_dict(torch.load(checkpoint_path, map_location=device))
    model.to(device)
    model.eval()
    return model


def count_parameters(model: nn.Module) -> int:
    """パラメータ数をカウント"""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)
