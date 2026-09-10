import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os

def train_model():
    current_dir = os.path.dirname(__file__)
    csv_path = os.path.join(current_dir, "engine_telemetry.csv")
    
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}. Please run generate_dataset.py first.")
        
    print(f"Reading dataset from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    # Feature columns
    features = [
        "rpm", "cht", "egt", "oil_pressure", "oil_temp", 
        "fuel_flow", "map", "vibration", "voltage", 
        "altitude", "ambient_temp", "afr"
    ]
    target = "fault_type"
    
    X = df[features]
    y = df[target]
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print("Training RandomForest Classifier...")
    model = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    class_report = classification_report(y_test, y_pred)
    
    print(f"Model Training Complete. Accuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(class_report)
    
    # Save the model
    model_path = os.path.join(current_dir, "engine_model.joblib")
    joblib.dump(model, model_path)
    print(f"Model saved to: {model_path}")
    
    # Feature Importances
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]
    
    feature_imp_list = []
    for f in range(X.shape[1]):
        feature_name = features[indices[f]]
        importance_val = importances[indices[f]]
        feature_imp_list.append(f"- **{feature_name}**: {importance_val:.4f}")
        print(f"{f + 1}. feature {feature_name} ({importance_val:.4f})")
        
    # Write training report
    report_path = os.path.join(current_dir, "training_report.md")
    report_content = f"""# AI Engine Diagnostic Model Training Report

This report summarizes the training metrics and assumptions for the RandomForest classifier used in the AeroTwin prototype.

## Model Summary
- **Model Type**: RandomForestClassifier (scikit-learn)
- **Parameters**: `n_estimators=100`, `max_depth=12`, `random_state=42`
- **Overall Accuracy**: {accuracy * 100:.2f}%
- **Date**: 2026-08-30

## Classification Metrics
```
{class_report}
```

## Feature Importance Ranking
Feature importance indicates which sensor parameters drove the classification decisions:

{chr(10).join(feature_imp_list)}

## Dataset Assumptions & Signatures
- **Overheating**: Characterized by coupled increases in CHT and EGT.
- **Oil Starvation**: Characterized by a sharp drop in oil pressure and corresponding spike in oil temperature.
- **Bearing Wear**: Driven primarily by spikes in vibration (RMS) and RPM instabilities.
- **Fuel-Lean Misfire**: Characterized by air-fuel ratios above stoichiometry (AFR > 16.0), EGT variance, and fuel flow deficits.
"""
    with open(report_path, "w") as f:
        f.write(report_content)
        
    print(f"Training report saved to: {report_path}")

if __name__ == "__main__":
    train_model()
