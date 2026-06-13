"""ViT-Small training script"""

import argparse
from pathlib import Path

import torch
import torch.nn as nn
from torch.cuda.amp import GradScaler, autocast
from tqdm import tqdm

from config import TRAIN_CONFIG, MODELS_DIR, DATA_DIR
from dataset import get_dataloaders
from model import CenterLineClassifier, count_parameters


def calculate_metrics(preds: list, labels: list, threshold: float = 0.5):
    """評価メトリクスを計算"""
    preds_binary = [1 if p >= threshold else 0 for p in preds]

    tp = sum(1 for p, l in zip(preds_binary, labels) if p == 1 and l == 1)
    tn = sum(1 for p, l in zip(preds_binary, labels) if p == 0 and l == 0)
    fp = sum(1 for p, l in zip(preds_binary, labels) if p == 1 and l == 0)
    fn = sum(1 for p, l in zip(preds_binary, labels) if p == 0 and l == 1)

    accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
    }


def train_epoch(model, loader, criterion, optimizer, scaler, device):
    """1エポックの学習"""
    model.train()
    total_loss = 0
    all_preds = []
    all_labels = []

    pbar = tqdm(loader, desc="Training")
    for batch in pbar:
        images = batch["image"].to(device)
        labels = batch["label"].to(device)

        optimizer.zero_grad()

        # Mixed precision
        with autocast():
            outputs = model(images)
            loss = criterion(outputs, labels)

        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        total_loss += loss.item()
        probs = torch.sigmoid(outputs).detach().cpu().tolist()
        all_preds.extend(probs)
        all_labels.extend(labels.cpu().tolist())

        pbar.set_postfix({"loss": f"{loss.item():.4f}"})

    avg_loss = total_loss / len(loader)
    metrics = calculate_metrics(all_preds, all_labels)
    return avg_loss, metrics


def evaluate(model, loader, criterion, device):
    """評価"""
    model.eval()
    total_loss = 0
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for batch in tqdm(loader, desc="Evaluating"):
            images = batch["image"].to(device)
            labels = batch["label"].to(device)

            with autocast():
                outputs = model(images)
                loss = criterion(outputs, labels)

            total_loss += loss.item()
            probs = torch.sigmoid(outputs).cpu().tolist()
            all_preds.extend(probs)
            all_labels.extend(labels.cpu().tolist())

    avg_loss = total_loss / len(loader)
    metrics = calculate_metrics(all_preds, all_labels)
    return avg_loss, metrics


def train(
    epochs: int = 20,
    batch_size: int = 8,
    learning_rate: float = 1e-4,
    patience: int = 5,
    num_workers: int = 4,
):
    """学習メインループ"""
    # Check for data
    if not (DATA_DIR / "train.csv").exists():
        print("Error: train.csv not found. Run prepare_data.py first.")
        return

    # Device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    if device == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # Data
    print("\nLoading data...")
    train_loader, val_loader, _ = get_dataloaders(batch_size=batch_size, num_workers=num_workers)
    print(f"  Train batches: {len(train_loader)}")
    print(f"  Val batches: {len(val_loader)}")

    # Model
    print("\nInitializing model...")
    model = CenterLineClassifier(pretrained=True).to(device)
    print(f"  Parameters: {count_parameters(model):,}")

    # Training setup
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    scaler = GradScaler()

    # Training loop
    best_f1 = 0
    patience_counter = 0
    MODELS_DIR.mkdir(exist_ok=True)
    best_model_path = MODELS_DIR / "vit_centerline_best.pt"
    last_model_path = MODELS_DIR / "vit_centerline_last.pt"

    print(f"\n{'='*60}")
    print(f"Starting training: {epochs} epochs, batch_size={batch_size}, lr={learning_rate}")
    print(f"{'='*60}\n")

    for epoch in range(epochs):
        print(f"\nEpoch {epoch + 1}/{epochs}")
        print("-" * 40)

        # Train
        train_loss, train_metrics = train_epoch(
            model, train_loader, criterion, optimizer, scaler, device
        )

        # Validate
        val_loss, val_metrics = evaluate(model, val_loader, criterion, device)

        # Update scheduler
        scheduler.step()

        # Print metrics
        print(f"\nTrain Loss: {train_loss:.4f}")
        print(f"  Accuracy: {train_metrics['accuracy']:.4f}")
        print(f"  F1: {train_metrics['f1']:.4f} (P={train_metrics['precision']:.4f}, R={train_metrics['recall']:.4f})")

        print(f"\nVal Loss: {val_loss:.4f}")
        print(f"  Accuracy: {val_metrics['accuracy']:.4f}")
        print(f"  F1: {val_metrics['f1']:.4f} (P={val_metrics['precision']:.4f}, R={val_metrics['recall']:.4f})")
        print(f"  TP={val_metrics['tp']}, TN={val_metrics['tn']}, FP={val_metrics['fp']}, FN={val_metrics['fn']}")

        # Save best model
        if val_metrics["f1"] > best_f1:
            best_f1 = val_metrics["f1"]
            torch.save(model.state_dict(), best_model_path)
            print(f"\n  -> Best model saved! F1={best_f1:.4f}")
            patience_counter = 0
        else:
            patience_counter += 1
            print(f"\n  -> No improvement ({patience_counter}/{patience})")

        # Save last model
        torch.save(model.state_dict(), last_model_path)

        # Early stopping
        if patience_counter >= patience:
            print(f"\nEarly stopping at epoch {epoch + 1}")
            break

    print(f"\n{'='*60}")
    print(f"Training complete!")
    print(f"Best validation F1: {best_f1:.4f}")
    print(f"Best model saved to: {best_model_path}")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="Train ViT-Small for center line detection")
    parser.add_argument("--epochs", type=int, default=TRAIN_CONFIG["epochs"])
    parser.add_argument("--batch-size", type=int, default=TRAIN_CONFIG["batch_size"])
    parser.add_argument("--lr", type=float, default=TRAIN_CONFIG["learning_rate"])
    parser.add_argument("--patience", type=int, default=TRAIN_CONFIG["early_stopping_patience"])
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    train(
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        patience=args.patience,
        num_workers=args.workers,
    )


if __name__ == "__main__":
    main()
