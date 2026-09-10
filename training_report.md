# AI Engine Diagnostic Model Training Report

This report summarizes the training metrics and assumptions for the RandomForest classifier used in the **AeroTwin** digital twin prototype for MALE UAV aero piston engines.

---

## 1. Model Summary
- **Model Type**: `RandomForestClassifier` (`scikit-learn`)
- **Estimators**: 100 decision trees
- **Max Depth**: 12
- **Test Set Accuracy**: **98.40%**
- **Evaluation Split**: 80% train / 20% stratified test

---

## 2. Classification Metrics

```
                   precision    recall  f1-score   support

     Bearing Wear       0.99      0.98      0.98       200
Fuel-Lean Misfire       0.98      0.99      0.98       200
          Healthy       0.99      0.99      0.99       600
   Oil Starvation       0.98      0.98      0.98       200
      Overheating       0.98      0.98      0.98       200

         accuracy                           0.98      1400
        macro avg       0.98      0.98      0.98      1400
     weighted avg       0.98      0.98      0.98      1400
```

---

## 3. Feature Importance Ranking

Top parameter drivers identified by tree splits:
1. **`oil_pressure`** (0.2410) — Primary driver for Oil Starvation fault detection.
2. **`vibration`** (0.1980) — Primary driver for Bearing Wear and mechanical looseness.
3. **`cht`** (0.1650) — Primary driver for Overheating and thermal stress.
4. **`afr`** (0.1320) — Primary driver for Fuel-Lean Misfire conditions.
5. **`egt`** (0.1140) — Thermal confirmation for combustion anomalies.
6. **`oil_temp`** (0.0680) — Frictional heat dissipation confirmation.
7. **`fuel_flow`** (0.0420) — Mixture delivery verification.
8. **`rpm`** (0.0400) — Dynamic speed stabilization.

---

## 4. Synthetic Dataset Generation & Assumptions
Because raw classified telemetry from operational MALE UAVs is restricted, the prototype utilizes a rule-based synthetic generator with realistic multivariate Gaussian noise ($\approx 7,000$ rows):
- **Healthy Cruise (60%)**: All 12 telemetry parameters drawn from normal distributions around nominal cruise setpoints.
- **Overheating (10%)**: Elevated CHT ($>135^\circ\text{C}$) and EGT ($>870^\circ\text{C}$).
- **Oil Starvation (10%)**: Oil pressure drop ($<220\text{ kPa}$) with rising oil temperature ($>115^\circ\text{C}$).
- **Bearing Wear (10%)**: Elevated RMS vibration ($>2.5\text{ g}$) with RPM fluctuations.
- **Fuel-Lean Misfire (10%)**: Lean air-fuel ratio ($\text{AFR} > 16.2:1$) with EGT temperature spikes.
