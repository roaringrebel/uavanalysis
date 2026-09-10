# AI Engine Diagnostic Model Training Report

This report summarizes the training metrics and assumptions for the RandomForest classifier used in the AeroTwin prototype.

## Model Summary
- **Model Type**: RandomForestClassifier (scikit-learn)
- **Parameters**: `n_estimators=100`, `max_depth=12`, `random_state=42`
- **Overall Accuracy**: 100.00%
- **Date**: 2026-08-30

## Classification Metrics
```
                   precision    recall  f1-score   support

     Bearing Wear       1.00      1.00      1.00       123
Fuel-Lean Misfire       1.00      1.00      1.00       121
          Healthy       1.00      1.00      1.00       712
   Oil Starvation       1.00      1.00      1.00       116
      Overheating       1.00      1.00      1.00       128

         accuracy                           1.00      1200
        macro avg       1.00      1.00      1.00      1200
     weighted avg       1.00      1.00      1.00      1200

```

## Feature Importance Ranking
Feature importance indicates which sensor parameters drove the classification decisions:

- **oil_temp**: 0.2345
- **vibration**: 0.2228
- **cht**: 0.1334
- **egt**: 0.1191
- **fuel_flow**: 0.0916
- **afr**: 0.0860
- **oil_pressure**: 0.0771
- **rpm**: 0.0332
- **voltage**: 0.0009
- **map**: 0.0006
- **ambient_temp**: 0.0005
- **altitude**: 0.0004

## Dataset Assumptions & Signatures
- **Overheating**: Characterized by coupled increases in CHT and EGT.
- **Oil Starvation**: Characterized by a sharp drop in oil pressure and corresponding spike in oil temperature.
- **Bearing Wear**: Driven primarily by spikes in vibration (RMS) and RPM instabilities.
- **Fuel-Lean Misfire**: Characterized by air-fuel ratios above stoichiometry (AFR > 16.0), EGT variance, and fuel flow deficits.
