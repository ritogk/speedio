"""PyTorch Dataset for center line classification"""

import pandas as pd
from pathlib import Path
from PIL import Image

import torch
from torch.utils.data import Dataset
from torchvision import transforms

from config import MODEL_CONFIG, IMAGE_CONFIG, DATA_DIR


def get_transforms(is_training: bool = True):
    """画像変換を取得"""
    input_size = MODEL_CONFIG["input_size"]
    crop_size = IMAGE_CONFIG["crop_size"]

    if is_training:
        return transforms.Compose([
            transforms.CenterCrop(crop_size),  # 960x960に中央クロップ
            transforms.Resize((input_size, input_size)),
            transforms.RandomHorizontalFlip(p=0.3),  # 控えめに（道路の向きが変わるため）
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])
    else:
        return transforms.Compose([
            transforms.CenterCrop(crop_size),
            transforms.Resize((input_size, input_size)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])


class CenterLineDataset(Dataset):
    """中央線検出用データセット"""

    def __init__(self, csv_path: str | Path, transform=None):
        """
        Args:
            csv_path: CSVファイルのパス
            transform: 画像変換（Noneの場合はデフォルト）
        """
        self.df = pd.read_csv(csv_path)
        self.transform = transform

        # 有効なサンプルのみを保持
        valid_indices = []
        for idx in range(len(self.df)):
            image_path = Path(self.df.iloc[idx]["image_path"])
            if image_path.exists():
                valid_indices.append(idx)

        self.df = self.df.iloc[valid_indices].reset_index(drop=True)
        print(f"  Dataset: {len(self.df)} samples loaded from {csv_path}")

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        image_path = row["image_path"]
        label = 1 if row["has_center_line"] else 0

        # 画像読み込み
        image = Image.open(image_path).convert("RGB")

        if self.transform:
            image = self.transform(image)

        return {
            "image": image,
            "label": torch.tensor(label, dtype=torch.float32),
            "lat": row["lat"],
            "lng": row["lng"],
        }


def get_dataloaders(batch_size: int = 8, num_workers: int = 4):
    """Train/Val/Test DataLoaderを取得"""
    train_transform = get_transforms(is_training=True)
    eval_transform = get_transforms(is_training=False)

    train_dataset = CenterLineDataset(DATA_DIR / "train.csv", transform=train_transform)
    val_dataset = CenterLineDataset(DATA_DIR / "val.csv", transform=eval_transform)
    test_dataset = CenterLineDataset(DATA_DIR / "test.csv", transform=eval_transform)

    train_loader = torch.utils.data.DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True,
    )

    val_loader = torch.utils.data.DataLoader(
        val_dataset,
        batch_size=batch_size * 2,  # 評価時は大きいバッチでOK
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
    )

    test_loader = torch.utils.data.DataLoader(
        test_dataset,
        batch_size=batch_size * 2,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
    )

    return train_loader, val_loader, test_loader
