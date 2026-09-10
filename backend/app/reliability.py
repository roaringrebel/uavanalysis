import math

# Nominal operating bands: (min, max, penalty_weight)
NOMINAL_BANDS = {
    "rpm":          (4200, 5200, 0.02),
    "cht":          (90,   125,  0.5),
    "egt":          (750,  860,  0.1),
    "oil_pressure": (300,  480,  0.15),
    "oil_temp":     (80,   105,  0.8),
    "fuel_flow":    (15.0, 22.0, 1.5),
    "map":          (90,   112,  0.4),
    "vibration":    (0.2,  1.6,  12.0),
    "voltage":      (13.2, 15.0, 5.0),
    "afr":          (13.8, 15.4, 6.0),
}


def calculate_reliability(params: dict) -> int:
    """Compute mission reliability score 0-100 from parameter deviations."""
    score = 100.0
    for key, (min_val, max_val, weight) in NOMINAL_BANDS.items():
        if key in params:
            val = params[key]
            if val < min_val:
                score -= (min_val - val) * weight
            elif val > max_val:
                score -= (val - max_val) * weight
    return max(5, min(100, int(round(score))))


def calculate_maintenance_score(params: dict) -> int:
    """Composite maintenance health score 0-100 (independent of ML classifier)."""
    score = 100.0
    weights = {
        "rpm": 0.08, "cht": 0.16, "egt": 0.14, "oil_pressure": 0.18,
        "oil_temp": 0.12, "fuel_flow": 0.08, "vibration": 0.12,
        "voltage": 0.06, "afr": 0.06
    }
    for key, (min_val, max_val, _) in NOMINAL_BANDS.items():
        if key not in params or key not in weights:
            continue
        val = params[key]
        mid = (min_val + max_val) / 2.0
        half = (max_val - min_val) / 2.0
        dev = abs(val - mid) / half if half > 0 else 0
        penalty = min(1.0, max(0, dev - 1.0))  # penalty starts outside band
        score -= penalty * weights[key] * 100
    return max(0, min(100, int(round(score))))


def calculate_rul(reliability: int, confidence: float) -> int:
    """Remaining useful life in flight hours.
    Simple monotonic function: high reliability → high RUL; low confidence lowers it.
    Max ~240 hrs (10 days continuous), min 0.
    """
    base_rul = (reliability / 100.0) ** 1.5 * 240
    adjusted = base_rul * (0.5 + 0.5 * confidence)
    return max(0, int(round(adjusted)))


def calculate_failure_probability(reliability: int, confidence: float) -> float:
    """Failure probability over next 30 days (%).
    Inverse of reliability, scaled by confidence.
    """
    base = max(0, 100 - reliability)
    prob = base * (0.3 + 0.7 * confidence)
    return round(min(99.9, max(0.1, prob * 0.5)), 1)
