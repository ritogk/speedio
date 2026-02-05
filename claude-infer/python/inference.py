"""推論関数"""

import base64
from io import BytesIO
from pathlib import Path

import torch
from PIL import Image

from config import MODELS_DIR, MODEL_CONFIG
from dataset import get_transforms
from model import CenterLineClassifier


class CenterLineInference:
    """中央線検出の推論クラス"""

    def __init__(self, model_path: str | Path = None, device: str = None):
        """
        Args:
            model_path: モデルファイルのパス（Noneの場合はデフォルト）
            device: "cuda" or "cpu"（Noneの場合は自動判定）
        """
        if model_path is None:
            model_path = MODELS_DIR / "vit_centerline_best.pt"

        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"

        self.device = device
        self.transform = get_transforms(is_training=False)

        # Load model
        print(f"Loading model from {model_path}...")
        self.model = CenterLineClassifier(pretrained=False)
        self.model.load_state_dict(torch.load(model_path, map_location=device))
        self.model.to(device)
        self.model.eval()
        print(f"Model loaded on {device}")

    def predict_from_path(self, image_path: str | Path) -> dict:
        """画像パスから推論"""
        image = Image.open(image_path).convert("RGB")
        return self._predict_image(image)

    def predict_from_base64(self, image_base64: str) -> dict:
        """Base64エンコード画像から推論"""
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data)).convert("RGB")
        return self._predict_image(image)

    def predict_from_pil(self, image: Image.Image) -> dict:
        """PIL Imageから推論"""
        return self._predict_image(image.convert("RGB"))

    def _predict_image(self, image: Image.Image) -> dict:
        """画像から推論（内部メソッド）"""
        # Transform
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        # Inference
        with torch.no_grad():
            logits = self.model(tensor)
            prob = torch.sigmoid(logits).item()

        has_center_line = prob >= 0.5
        confidence = prob if has_center_line else 1 - prob

        return {
            "has_center_line": has_center_line,
            "probability": prob,
            "confidence": confidence,
        }

    def predict_batch(self, images: list) -> list:
        """バッチ推論

        Args:
            images: PIL ImageまたはパスのリストまたはBase64のリスト

        Returns:
            推論結果のリスト
        """
        # Prepare tensors
        tensors = []
        for img in images:
            if isinstance(img, str):
                if img.startswith("/") or img.startswith("."):
                    # File path
                    pil_image = Image.open(img).convert("RGB")
                else:
                    # Base64
                    image_data = base64.b64decode(img)
                    pil_image = Image.open(BytesIO(image_data)).convert("RGB")
            elif isinstance(img, Path):
                pil_image = Image.open(img).convert("RGB")
            else:
                pil_image = img.convert("RGB")

            tensors.append(self.transform(pil_image))

        batch = torch.stack(tensors).to(self.device)

        # Inference
        with torch.no_grad():
            logits = self.model(batch)
            probs = torch.sigmoid(logits).cpu().tolist()

        results = []
        for prob in probs:
            has_center_line = prob >= 0.5
            confidence = prob if has_center_line else 1 - prob
            results.append({
                "has_center_line": has_center_line,
                "probability": prob,
                "confidence": confidence,
            })

        return results


# Singleton instance for server use
_inference_instance = None


def get_inference() -> CenterLineInference:
    """シングルトンインスタンスを取得"""
    global _inference_instance
    if _inference_instance is None:
        _inference_instance = CenterLineInference()
    return _inference_instance


def main():
    """テスト用"""
    import argparse

    parser = argparse.ArgumentParser(description="Run inference on an image")
    parser.add_argument("image_path", type=str, help="Path to image file")
    args = parser.parse_args()

    inference = CenterLineInference()
    result = inference.predict_from_path(args.image_path)

    print(f"\nResult:")
    print(f"  has_center_line: {result['has_center_line']}")
    print(f"  probability: {result['probability']:.4f}")
    print(f"  confidence: {result['confidence']:.4f}")


if __name__ == "__main__":
    main()
