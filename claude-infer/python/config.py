"""設定管理"""

import os
from pathlib import Path
from dotenv import load_dotenv

# .envファイルを読み込み
load_dotenv(Path(__file__).parent.parent / ".env")

# API Keys
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# Database
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "speedia",
    "user": "postgres",
    "password": "postgres",
}

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
TMP_DIR = PROJECT_ROOT / "tmp"
MODELS_DIR = PROJECT_ROOT / "models"
DATA_DIR = PROJECT_ROOT / "data"
TARGETS_DIR = PROJECT_ROOT.parent / "html" / "targets"

# Model settings
MODEL_CONFIG = {
    "name": "vit_small_patch16_384",
    "input_size": 384,
    "num_classes": 2,
    "pretrained": True,
}

# Training settings
TRAIN_CONFIG = {
    "batch_size": 8,
    "learning_rate": 1e-4,
    "epochs": 20,
    "early_stopping_patience": 5,
    "val_split": 0.15,
    "test_split": 0.15,
}

# Image settings
IMAGE_CONFIG = {
    "width": 1280,
    "height": 960,
    "crop_size": 960,  # Center crop to square
}

# Ensure directories exist
TMP_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)
