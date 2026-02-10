"""Enhanced training script with various tuning options for systematic experiments"""

import argparse
import json
import time
from pathlib import Path
from datetime import datetime

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.cuda.amp import GradScaler, autocast
from torch.optim.lr_scheduler import CosineAnnealingLR, LinearLR, SequentialLR
from torchvision import transforms
from tqdm import tqdm

from config import MODELS_DIR, DATA_DIR, MODEL_CONFIG, IMAGE_CONFIG, PROJECT_ROOT
from dataset import CenterLineDataset
from model import CenterLineClassifier, count_parameters


# ============================================================
# Loss Functions
# ============================================================

class FocalLoss(nn.Module):
    """Focal Loss - hard exampleに重みを置く"""

    def __init__(self, alpha=1.0, gamma=2.0):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma

    def forward(self, inputs, targets):
        bce_loss = F.binary_cross_entropy_with_logits(inputs, targets, reduction="none")
        pt = torch.exp(-bce_loss)
        focal_loss = self.alpha * (1 - pt) ** self.gamma * bce_loss
        return focal_loss.mean()


class LabelSmoothingBCELoss(nn.Module):
    """BCEWithLogitsLoss with label smoothing"""

    def __init__(self, smoothing=0.05, pos_weight=None):
        super().__init__()
        self.smoothing = smoothing
        self.pos_weight = pos_weight

    def forward(self, inputs, targets):
        targets_smooth = targets * (1 - self.smoothing) + 0.5 * self.smoothing
        if self.pos_weight is not None:
            return F.binary_cross_entropy_with_logits(
                inputs, targets_smooth, pos_weight=self.pos_weight
            )
        return F.binary_cross_entropy_with_logits(inputs, targets_smooth)


# ============================================================
# Enhanced Data Augmentations
# ============================================================

def get_enhanced_transforms(is_training=True, augment_level="standard"):
    """複数レベルのデータ拡張"""
    input_size = MODEL_CONFIG["input_size"]
    crop_size = IMAGE_CONFIG["crop_size"]

    normalize = transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    )

    if not is_training:
        return transforms.Compose([
            transforms.CenterCrop(crop_size),
            transforms.Resize((input_size, input_size)),
            transforms.ToTensor(),
            normalize,
        ])

    if augment_level == "standard":
        return transforms.Compose([
            transforms.CenterCrop(crop_size),
            transforms.Resize((input_size, input_size)),
            transforms.RandomHorizontalFlip(p=0.3),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1),
            transforms.ToTensor(),
            normalize,
        ])

    elif augment_level == "strong":
        return transforms.Compose([
            transforms.CenterCrop(crop_size),
            transforms.Resize((input_size, input_size)),
            transforms.RandomHorizontalFlip(p=0.3),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.15, hue=0.03),
            transforms.RandomAffine(degrees=3, translate=(0.03, 0.03), scale=(0.97, 1.03)),
            transforms.RandomApply([transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 0.5))], p=0.2),
            transforms.ToTensor(),
            normalize,
            transforms.RandomErasing(p=0.15, scale=(0.02, 0.1)),
        ])

    elif augment_level == "heavy":
        return transforms.Compose([
            transforms.CenterCrop(crop_size),
            transforms.Resize((input_size, input_size)),
            transforms.RandomHorizontalFlip(p=0.3),
            transforms.RandAugment(num_ops=2, magnitude=7),
            transforms.ToTensor(),
            normalize,
            transforms.RandomErasing(p=0.25, scale=(0.02, 0.15)),
        ])

    raise ValueError(f"Unknown augment_level: {augment_level}")


# ============================================================
# Metrics
# ============================================================

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


# ============================================================
# Threshold Optimization
# ============================================================

def find_optimal_threshold(model, loader, device, target="balanced"):
    """最適な閾値を探索

    target:
        "balanced" - FPとFNのバランスを重視 (FP ≈ FN)
        "f1" - F1スコア最大化
    """
    model.eval()
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for batch in tqdm(loader, desc="Threshold optimization"):
            images = batch["image"].to(device)
            labels = batch["label"]
            with autocast():
                outputs = model(images)
            probs = torch.sigmoid(outputs).cpu().tolist()
            all_preds.extend(probs)
            all_labels.extend(labels.tolist())

    results = []
    for threshold in np.arange(0.30, 0.70, 0.005):
        metrics = calculate_metrics(all_preds, all_labels, threshold=threshold)
        fp_fn_diff = abs(metrics["fp"] - metrics["fn"])
        results.append({
            "threshold": round(float(threshold), 3),
            **metrics,
            "fp_fn_diff": fp_fn_diff,
        })

    if target == "balanced":
        # FP ≈ FN かつ F1が高いものを優先
        results.sort(key=lambda x: (x["fp_fn_diff"], -x["f1"]))
    else:
        results.sort(key=lambda x: -x["f1"])

    best = results[0]
    print(f"\n  Optimal threshold ({target}): {best['threshold']}")
    print(f"  F1={best['f1']:.4f}, P={best['precision']:.4f}, R={best['recall']:.4f}")
    print(f"  TP={best['tp']}, TN={best['tn']}, FP={best['fp']}, FN={best['fn']}")
    print(f"  |FP-FN|={best['fp_fn_diff']}")

    return best


# ============================================================
# Training & Evaluation
# ============================================================

def train_epoch(model, loader, criterion, optimizer, scaler, device, grad_clip=0.0):
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

        with autocast():
            outputs = model(images)
            loss = criterion(outputs, labels)

        scaler.scale(loss).backward()

        if grad_clip > 0:
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)

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


# ============================================================
# Main Training
# ============================================================

def train(args):
    """学習メインループ"""
    if not (DATA_DIR / "train.csv").exists():
        print("Error: train.csv not found. Run prepare_data.py first.")
        return

    # Device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")
    if device == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # Print experiment config
    print(f"\n{'='*60}")
    print(f"Experiment: {args.exp_name}")
    print(f"{'='*60}")
    config_dict = vars(args)
    for k, v in config_dict.items():
        print(f"  {k}: {v}")
    print(f"{'='*60}\n")

    # Data
    print("Loading data...")
    train_transform = get_enhanced_transforms(is_training=True, augment_level=args.augment)
    eval_transform = get_enhanced_transforms(is_training=False)

    train_dataset = CenterLineDataset(DATA_DIR / "train.csv", transform=train_transform)
    val_dataset = CenterLineDataset(DATA_DIR / "val.csv", transform=eval_transform)
    test_dataset = CenterLineDataset(DATA_DIR / "test.csv", transform=eval_transform)

    train_loader = torch.utils.data.DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.workers,
        pin_memory=True,
        persistent_workers=True if args.workers > 0 else False,
    )
    val_loader = torch.utils.data.DataLoader(
        val_dataset,
        batch_size=args.batch_size * 2,
        shuffle=False,
        num_workers=args.workers,
        pin_memory=True,
        persistent_workers=True if args.workers > 0 else False,
    )
    test_loader = torch.utils.data.DataLoader(
        test_dataset,
        batch_size=args.batch_size * 2,
        shuffle=False,
        num_workers=args.workers,
        pin_memory=True,
        persistent_workers=True if args.workers > 0 else False,
    )

    print(f"  Train: {len(train_dataset)} samples, {len(train_loader)} batches")
    print(f"  Val: {len(val_dataset)} samples, {len(val_loader)} batches")
    print(f"  Test: {len(test_dataset)} samples, {len(test_loader)} batches")

    # Model
    print("\nInitializing model...")
    model = CenterLineClassifier(pretrained=True).to(device)
    print(f"  Parameters: {count_parameters(model):,}")

    # Loss function
    if args.loss == "bce":
        if args.label_smoothing > 0:
            criterion = LabelSmoothingBCELoss(smoothing=args.label_smoothing)
        else:
            criterion = nn.BCEWithLogitsLoss()
    elif args.loss == "focal":
        criterion = FocalLoss(alpha=1.0, gamma=args.focal_gamma)
    elif args.loss == "weighted_bce":
        # Compute pos_weight from training data
        n_pos = sum(1 for i in range(len(train_dataset)) if train_dataset.df.iloc[i]["has_center_line"])
        n_neg = len(train_dataset) - n_pos
        pos_weight = torch.tensor([n_neg / n_pos], device=device)
        print(f"  pos_weight: {pos_weight.item():.4f} (neg={n_neg}, pos={n_pos})")
        if args.label_smoothing > 0:
            criterion = LabelSmoothingBCELoss(smoothing=args.label_smoothing, pos_weight=pos_weight)
        else:
            criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    else:
        raise ValueError(f"Unknown loss: {args.loss}")

    print(f"  Loss: {args.loss} (label_smoothing={args.label_smoothing})")

    # Optimizer
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=args.weight_decay,
    )

    # Scheduler
    scheduler = get_scheduler_with_warmup(optimizer, args.warmup_epochs, args.epochs)

    # Mixed precision
    scaler = GradScaler()

    # Training loop
    best_f1 = 0
    patience_counter = 0
    MODELS_DIR.mkdir(exist_ok=True)
    model_suffix = f"_{args.exp_name}" if args.exp_name != "default" else ""
    best_model_path = MODELS_DIR / f"vit_centerline_best{model_suffix}.pt"
    last_model_path = MODELS_DIR / f"vit_centerline_last{model_suffix}.pt"

    print(f"\nStarting training: {args.epochs} epochs")
    print(f"Models: {best_model_path.name}, {last_model_path.name}")
    print()

    start_time = time.time()
    epoch_results = []

    for epoch in range(args.epochs):
        epoch_start = time.time()
        print(f"\nEpoch {epoch + 1}/{args.epochs} (lr={optimizer.param_groups[0]['lr']:.6f})")
        print("-" * 40)

        # Train
        train_loss, train_metrics = train_epoch(
            model, train_loader, criterion, optimizer, scaler, device,
            grad_clip=args.grad_clip,
        )

        # Validate
        val_loss, val_metrics = evaluate(model, val_loader, criterion, device)

        # Update scheduler
        scheduler.step()

        epoch_time = time.time() - epoch_start

        # Print metrics
        print(f"\nTrain Loss: {train_loss:.4f}")
        print(f"  Acc: {train_metrics['accuracy']:.4f}  F1: {train_metrics['f1']:.4f} (P={train_metrics['precision']:.4f}, R={train_metrics['recall']:.4f})")

        print(f"Val Loss: {val_loss:.4f}")
        print(f"  Acc: {val_metrics['accuracy']:.4f}  F1: {val_metrics['f1']:.4f} (P={val_metrics['precision']:.4f}, R={val_metrics['recall']:.4f})")
        print(f"  TP={val_metrics['tp']}, TN={val_metrics['tn']}, FP={val_metrics['fp']}, FN={val_metrics['fn']}")
        print(f"  |FP-FN|={abs(val_metrics['fp'] - val_metrics['fn'])}")
        print(f"  Time: {epoch_time:.1f}s")

        epoch_results.append({
            "epoch": epoch + 1,
            "train_loss": train_loss,
            "train_f1": train_metrics["f1"],
            "val_loss": val_loss,
            "val_f1": val_metrics["f1"],
            "val_precision": val_metrics["precision"],
            "val_recall": val_metrics["recall"],
            "val_tp": val_metrics["tp"],
            "val_tn": val_metrics["tn"],
            "val_fp": val_metrics["fp"],
            "val_fn": val_metrics["fn"],
            "lr": optimizer.param_groups[0]["lr"],
        })

        # Save best model
        if val_metrics["f1"] > best_f1:
            best_f1 = val_metrics["f1"]
            torch.save(model.state_dict(), best_model_path)
            print(f"\n  -> Best model saved! F1={best_f1:.4f}")
            patience_counter = 0
        else:
            patience_counter += 1
            print(f"\n  -> No improvement ({patience_counter}/{args.patience})")

        # Save last model
        torch.save(model.state_dict(), last_model_path)

        # Early stopping
        if patience_counter >= args.patience:
            print(f"\nEarly stopping at epoch {epoch + 1}")
            break

    total_time = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Training complete! ({total_time:.0f}s)")
    print(f"Best validation F1: {best_f1:.4f}")
    print(f"{'='*60}")

    # ============================================================
    # Post-training: Threshold optimization on validation set
    # ============================================================
    print("\n\nLoading best model for threshold optimization...")
    model.load_state_dict(torch.load(best_model_path, map_location=device))

    print("\n--- Threshold: Balanced FP/FN ---")
    balanced_result = find_optimal_threshold(model, val_loader, device, target="balanced")

    print("\n--- Threshold: Max F1 ---")
    f1_result = find_optimal_threshold(model, val_loader, device, target="f1")

    # ============================================================
    # Test set evaluation
    # ============================================================
    print(f"\n{'='*60}")
    print("Test Set Evaluation")
    print(f"{'='*60}")

    test_loss, test_metrics_default = evaluate(model, test_loader, criterion, device)
    print(f"\nThreshold=0.50:")
    print(f"  F1={test_metrics_default['f1']:.4f}, P={test_metrics_default['precision']:.4f}, R={test_metrics_default['recall']:.4f}")
    print(f"  TP={test_metrics_default['tp']}, TN={test_metrics_default['tn']}, FP={test_metrics_default['fp']}, FN={test_metrics_default['fn']}")
    print(f"  |FP-FN|={abs(test_metrics_default['fp'] - test_metrics_default['fn'])}")

    # Evaluate with balanced threshold
    all_preds = []
    all_labels = []
    model.eval()
    with torch.no_grad():
        for batch in test_loader:
            images = batch["image"].to(device)
            labels = batch["label"]
            with autocast():
                outputs = model(images)
            probs = torch.sigmoid(outputs).cpu().tolist()
            all_preds.extend(probs)
            all_labels.extend(labels.tolist())

    bal_thresh = balanced_result["threshold"]
    test_metrics_balanced = calculate_metrics(all_preds, all_labels, threshold=bal_thresh)
    print(f"\nThreshold={bal_thresh:.3f} (balanced):")
    print(f"  F1={test_metrics_balanced['f1']:.4f}, P={test_metrics_balanced['precision']:.4f}, R={test_metrics_balanced['recall']:.4f}")
    print(f"  TP={test_metrics_balanced['tp']}, TN={test_metrics_balanced['tn']}, FP={test_metrics_balanced['fp']}, FN={test_metrics_balanced['fn']}")
    print(f"  |FP-FN|={abs(test_metrics_balanced['fp'] - test_metrics_balanced['fn'])}")

    f1_thresh = f1_result["threshold"]
    test_metrics_f1 = calculate_metrics(all_preds, all_labels, threshold=f1_thresh)
    print(f"\nThreshold={f1_thresh:.3f} (max F1):")
    print(f"  F1={test_metrics_f1['f1']:.4f}, P={test_metrics_f1['precision']:.4f}, R={test_metrics_f1['recall']:.4f}")
    print(f"  TP={test_metrics_f1['tp']}, TN={test_metrics_f1['tn']}, FP={test_metrics_f1['fp']}, FN={test_metrics_f1['fn']}")
    print(f"  |FP-FN|={abs(test_metrics_f1['fp'] - test_metrics_f1['fn'])}")

    # ============================================================
    # Save experiment results
    # ============================================================
    output_dir = PROJECT_ROOT / "output"
    output_dir.mkdir(exist_ok=True)

    result = {
        "experiment": args.exp_name,
        "timestamp": datetime.now().isoformat(),
        "config": config_dict,
        "training_time_sec": total_time,
        "best_val_f1": best_f1,
        "epochs_trained": len(epoch_results),
        "epoch_results": epoch_results,
        "threshold_balanced": balanced_result,
        "threshold_f1": f1_result,
        "test_default": test_metrics_default,
        "test_balanced": test_metrics_balanced,
        "test_f1_thresh": test_metrics_f1,
    }

    result_path = output_dir / f"experiment_{args.exp_name}.json"
    with open(result_path, "w") as f:
        json.dump(result, f, indent=2, default=str)
    print(f"\nResults saved to {result_path}")

    return result


def get_scheduler_with_warmup(optimizer, warmup_epochs, total_epochs):
    """Cosine annealing with linear warmup"""
    if warmup_epochs > 0:
        warmup_scheduler = LinearLR(
            optimizer, start_factor=0.1, end_factor=1.0, total_iters=warmup_epochs
        )
        cosine_scheduler = CosineAnnealingLR(
            optimizer, T_max=total_epochs - warmup_epochs
        )
        scheduler = SequentialLR(
            optimizer,
            schedulers=[warmup_scheduler, cosine_scheduler],
            milestones=[warmup_epochs],
        )
    else:
        scheduler = CosineAnnealingLR(optimizer, T_max=total_epochs)
    return scheduler


def main():
    parser = argparse.ArgumentParser(description="Enhanced ViT training with tuning options")

    # Experiment
    parser.add_argument("--exp-name", type=str, default="default", help="Experiment name")

    # Training basics
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--workers", type=int, default=4)

    # Scheduler
    parser.add_argument("--warmup-epochs", type=int, default=0, help="Warmup epochs (0=disable)")

    # Loss
    parser.add_argument("--loss", type=str, default="bce", choices=["bce", "focal", "weighted_bce"])
    parser.add_argument("--label-smoothing", type=float, default=0.0, help="Label smoothing (0=disable)")
    parser.add_argument("--focal-gamma", type=float, default=2.0, help="Focal loss gamma")

    # Augmentation
    parser.add_argument("--augment", type=str, default="standard",
                        choices=["standard", "strong", "heavy"])

    # Regularization
    parser.add_argument("--grad-clip", type=float, default=0.0, help="Gradient clipping (0=disable)")

    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
