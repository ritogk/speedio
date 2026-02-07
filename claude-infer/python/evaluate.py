"""評価スクリプト"""

import argparse
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_batch
import torch
from tqdm import tqdm

from config import DATA_DIR, MODELS_DIR, DB_CONFIG
from dataset import CenterLineDataset, get_transforms
from model import CenterLineClassifier
from train import calculate_metrics


def write_results_to_db(samples: list):
    """推論結果をDBのclaude_center_lineカラムに書き込み"""
    print("\nWriting results to database (claude_center_line)...")

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        update_query = """
            UPDATE locations
            SET claude_center_line = %s
            WHERE ST_Y(point) = %s AND ST_X(point) = %s
        """

        update_data = [
            (s["pred"] >= 0.5, s["lat"], s["lng"])
            for s in samples
        ]

        execute_batch(cursor, update_query, update_data, page_size=100)
        conn.commit()

        print(f"  Updated: {len(samples)} records")

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def evaluate_model(model_path: str = None, split: str = "test", batch_size: int = 16):
    """モデルを評価"""
    if model_path is None:
        model_path = MODELS_DIR / "vit_centerline_best.pt"
    else:
        model_path = Path(model_path)

    csv_path = DATA_DIR / f"{split}.csv"
    if not csv_path.exists():
        print(f"Error: {csv_path} not found")
        return

    # Device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    # Load model
    print(f"\nLoading model from {model_path}...")
    model = CenterLineClassifier(pretrained=False)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)
    model.eval()

    # Load data
    print(f"Loading {split} data...")
    transform = get_transforms(is_training=False)
    dataset = CenterLineDataset(csv_path, transform=transform)
    loader = torch.utils.data.DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=4,
    )

    # Evaluate
    print("\nEvaluating...")
    all_preds = []
    all_labels = []
    all_samples = []

    with torch.no_grad():
        for batch in tqdm(loader):
            images = batch["image"].to(device)
            labels = batch["label"]

            logits = model(images)
            probs = torch.sigmoid(logits).cpu().tolist()

            all_preds.extend(probs)
            all_labels.extend(labels.tolist())

            for i in range(len(probs)):
                all_samples.append({
                    "lat": batch["lat"][i].item() if torch.is_tensor(batch["lat"][i]) else batch["lat"][i],
                    "lng": batch["lng"][i].item() if torch.is_tensor(batch["lng"][i]) else batch["lng"][i],
                    "label": labels[i].item(),
                    "pred": probs[i],
                    "correct": (probs[i] >= 0.5) == (labels[i].item() == 1),
                })

    # Calculate metrics
    metrics = calculate_metrics(all_preds, all_labels)

    # Print results
    print("\n" + "=" * 50)
    print(f"Evaluation Results ({split} set)")
    print("=" * 50)
    print(f"Samples: {len(all_samples)}")
    print(f"\nMetrics:")
    print(f"  Accuracy:  {metrics['accuracy']:.4f} ({metrics['accuracy']*100:.1f}%)")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}")
    print(f"  F1 Score:  {metrics['f1']:.4f}")
    print(f"\nConfusion Matrix:")
    print(f"  TP (正解:あり, 予測:あり): {metrics['tp']}")
    print(f"  TN (正解:なし, 予測:なし): {metrics['tn']}")
    print(f"  FP (正解:なし, 予測:あり): {metrics['fp']}")
    print(f"  FN (正解:あり, 予測:なし): {metrics['fn']}")

    # Show error cases
    errors = [s for s in all_samples if not s["correct"]]
    if errors:
        print(f"\n Error cases ({len(errors)} total):")
        for e in errors[:10]:
            label_str = "あり" if e["label"] == 1 else "なし"
            pred_str = "あり" if e["pred"] >= 0.5 else "なし"
            print(f"  ({e['lat']:.6f}, {e['lng']:.6f}): 正解={label_str}, 予測={pred_str} (prob={e['pred']:.3f})")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")

    return metrics, all_samples


def main():
    parser = argparse.ArgumentParser(description="Evaluate the trained model")
    parser.add_argument("--model", type=str, help="Path to model checkpoint")
    parser.add_argument("--split", type=str, default="test", choices=["train", "val", "test"])
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--write-db", action="store_true", help="Write results to claude_center_line column in DB")
    args = parser.parse_args()

    metrics, samples = evaluate_model(
        model_path=args.model,
        split=args.split,
        batch_size=args.batch_size,
    )

    if args.write_db and samples:
        write_results_to_db(samples)


if __name__ == "__main__":
    main()
