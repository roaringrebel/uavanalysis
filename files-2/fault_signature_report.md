# Fault-Signature Report — UAV Piston-Engine Synthetic Telemetry

**Synthetic data.** Produced by a lumped-parameter engine simulation. Not certified real-world aircraft maintenance data and must not be presented as such.

40,000 rows · 20 engines · 160 missions · 250 samples/mission · 4 s cadence.
Every engine flies all 8 classes once (20 missions per class), so all splits contain all classes.

---

## 1. The underlying normal model

Nothing is drawn as "random numbers + random label". Each mission integrates:

1. **Mission profile** — flight phase sequence with per-mission jitter sets throttle demand; throttle passes a 6 s lag.
2. **Rotational dynamics** — `rpm → RPM_IDLE + (RPM_MAX−RPM_IDLE)·throttle^0.92`, 5 s first-order lag, reduced by any torque loss the fault mechanism causes.
3. **Charge/load** — load rises with throttle and speed and is scaled by air density derived from ISA barometric pressure at the mission's altitude profile. Fuel flow follows `load^1.05 · n^0.55`.
4. **Thermal masses** — CHT (τ≈70 s) and oil (τ≈150 s) are first-order states pulled toward equilibria that depend on ambient temperature, load, and a *cooling effectiveness × ram-air airflow* term that varies by flight phase. EGT (τ≈20 s) follows load.
5. **Lubrication map** — `oil_pressure ≈ 0.95 + 3.35·n − 0.0125·max(0, oil_T − 90)`: pressure rises with pump speed and falls as hot oil thins.
6. **Vibration spectrum** — residual 1X grows with `n²` (centrifugal force), 2X is a fraction of 1X, plus a load- and speed-dependent broadband floor. `vibration_peak = rms × crest factor`, so impulsiveness is an independent observable.
7. **Unit variation and ageing** — per-engine cooling effectiveness, vibration floor, mixture trim, and `engine_operating_hours` (5–1400 h) shift the baseline. Sensor noise is AR-1 (temporally correlated), not white.

Because normality is *condition-dependent*, a hot CHT at high load on a 40 °C day is normal; the fault labels are driven by the mechanism, never by a threshold on a raw channel.

---

## 2. Mechanism → signature, class by class

### BEARING_DEGRADATION — `CRANKSHAFT_MAIN_BEARING`
Mechanism: raceway spalling → impulsive impacts + increased parasitic friction + clearance leakage.
* Broadband vibration and **2X** rise faster than 1X; growth scales as `severity^1.45 · n²`, so the same damage looks mild at idle and severe in the climb.
* **Crest factor climbs sharply** (+up to ~3.4) — impacts are impulsive, so `vibration_peak/vibration_rms` is the strongest discriminator against propeller imbalance.
* Friction adds ~9 °C to oil temperature; oil pressure sags ~0.2 bar.
* Above `progression > 0.65` the torque irregularity produces **RPM instability** (σ up to ~34 rpm).
* Variants: `progressive` (power-law growth) and `spalling_step` (plateau then discrete jumps — non-linear by design).

### PROPELLER_IMBALANCE — `PROPELLER_ROTOR_ASSEMBLY`
Mechanism: mass/pitch asymmetry → centrifugal force `m·e·ω²` once per revolution.
* **1X dominates**: mean `1X/RMS ≈ 0.87` at moderate/severe vs ≈0.71 at baseline; 2X gains only ~8 % of the increment.
* **Crest factor falls** (sinusoidal excitation, no impacts) — the mirror image of bearing damage.
* Amplitude scales with `n²` and mildly with load, so severity tracks RPM/load and can look almost healthy in descent.
* Oil pressure, oil temperature, CHT and EGT stay in their normal envelopes in the early stages.

### ENGINE_MISFIRE — `IGNITION_FUEL_DELIVERY`
Mechanism: intermittent failure to ignite → cycle-to-cycle torque holes.
* Bursty mask (1–5 samples, probability `0.10 + 0.55·severity`) — **no two misfire missions are alike** and the signature is intermittent rather than a trend.
* During bursts: **EGT drops** (up to −210 °C, unburnt charge leaving the cylinder) with added cylinder-to-cylinder scatter, **RPM jitter** (σ up to ~55 rpm), CHT falls slightly, fuel flow rises a few percent, torsional vibration appears at 1X/2X with an elevated crest factor.
* Falling EGT with rising vibration is the pattern that separates misfire from every thermal fault.

### LOW_OIL_PRESSURE — `OIL_PUMP_LUBRICATION_CIRCUIT`
Mechanism: pump wear / suction restriction → pressure deficit → boundary lubrication → friction heat.
* Pressure **residual** drops up to 1.85 bar below the value the RPM/oil-temperature map predicts — so labelling depends on the deficit versus expectation, not on an absolute bar value (low pressure at idle is normal).
* Oil temperature rises up to ~26 °C with the 150 s lag, i.e. the thermal effect *trails* the pressure event.
* Metal-to-metal contact adds broadband vibration and pressure fluctuation (cavitation) above `progression > 0.4`.
* Variants: `gradual` (progressive wear) and `sudden` (near step — pickup blockage or pump failure).

### OVERHEATING — `COMBUSTION_THERMAL_MANAGEMENT`
Mechanism: lean mixture / over-advanced timing → hotter combustion, cooling system intact.
* Extra heat (up to 38 °C) enters the head equilibrium, ~26 % of it reaches the oil; **EGT rises with CHT** (hot burn).
* **Time constants stay normal**, so temperatures fall back promptly when load is reduced — this is what separates it from cooling failure.
* Because the equilibrium already contains ambient temperature and load, hot/high-load flight is not labelled as a fault; only the *deviation* from the expected operating point is.

### COOLING_SYSTEM_FAILURE — `COOLING_CIRCUIT`
Mechanism: blocked duct / lost coolant flow → reduced heat rejection capacity.
* Cooling effectiveness falls up to 48 % → CHT rises progressively, oil follows.
* **τ_CHT is multiplied by up to 3× and τ_oil by 2.2×** — the diagnostic feature is *recovery*: after throttle reduction (descent) temperatures stay elevated instead of decaying.
* EGT stays near normal (combustion is unchanged), which distinguishes it from overheating; the pair (CHT high, EGT normal, slow decay) is the class signature.

### SENSOR_ANOMALY — `SENSOR_SIGNAL_CHAIN`
Mechanism: measurement-chain fault; **the simulated engine remains physically normal**.
* One channel of `oil_pressure, oil_temperature, cht, egt, rpm, vibration_rms, fuel_flow` is corrupted in one of six modes: `bias` (step offset ≈0.35 span), `drift` (ramp ≈0.9 span), `dropout` (to zero), `stuck` (frozen last-good value while operating point changes), `spike` (10 % of samples, ±1–3 span), `inconsistent` (channel oscillates around its median, breaking its physical relationship with RPM/load).
* Corrupted values are clipped to instrument full scale (ADC/gauge saturation).
* Detection requires **cross-channel consistency**: e.g. frozen oil pressure while RPM sweeps, or CHT drifting while EGT, load and ambient say nothing changed.

### NORMAL
Fault-free missions across the full ambient (−2…44 °C sea-level), altitude, wear (5–1400 h) and unit-variation space, so the normal class is wide rather than a single trace.

---

## 3. Progression, onset and duration

`fault_progression ∈ [0,1]` is the mechanism severity; labels are thresholded from it: NORMAL <0.05, EARLY 0.05–0.35, MODERATE 0.35–0.70, SEVERE ≥0.70.

* Onset index is uniform over samples 25–175 (≈1.7–11.7 min in), duration 45–230 samples (3–15 min) — **onset and duration differ in every mission**.
* Severity ceiling is `U(0.30, 1.0)`, so many missions never reach SEVERE (as in a real fleet).
* Ramp shapes: `gradual` (power law), `accelerating` (t^2.2 knee), `sudden` (step), `spalling_step` (plateau + jumps).
* Mechanical damage does not heal: after the injection window the severity holds at its last value.

Row-level distribution: NORMAL 21,988 · MODERATE 7,349 · EARLY 6,938 · SEVERE 3,725.

---

## 4. Designed ambiguity

* **Bearing vs imbalance**: both raise RMS. Per-mission cross-coupling coefficients (`prop_bb_coup ∈ [0.05,0.45]`, `bear_1x_coup ∈ [0.15,0.60]`) mean worn mounts smear imbalance energy into broadband, and bearing wear sometimes lifts 1X. A single spectral ratio is therefore not sufficient — crest-factor dynamics and progression shape are needed.
* **Overheating vs cooling failure**: nearly identical steady-state CHT; only the recovery time constant after load reduction separates them (a genuinely temporal feature — exactly what the BiLSTM half of the architecture should capture).
* **Low oil pressure vs bearing degradation**: both give rising oil temperature and vibration; ordering differs (pressure leads temperature in one, vibration leads in the other).
* **Sensor anomaly vs real fault**: a drifting CHT sensor and a real cooling failure look the same on one channel; only cross-channel physics disambiguates.
* **Misfire vs sensor spikes**: both intermittent; misfire correlates RPM, EGT and vibration simultaneously, spikes hit one channel.

Sanity check: a random forest on **single samples with no temporal context** reaches ≈0.77 accuracy on the held-out test engines. The classes are neither trivially separable nor noise — there is real headroom for a sequence model.

---

## 5. Splits and sequence construction

Grouped split on `engine_id`: 14 train / 3 validation / 3 test engines (28,000 / 6,000 / 6,000 rows). Because missions belong to exactly one engine, **no mission appears in two splits**, and no engine-specific baseline leaks across them.

Recommended windowing for the 1D-CNN + BiLSTM: length 64 samples (≈4.3 min), stride 8, **built inside a single `mission_id` only**; label the window by its last sample's `fault_type` / `fault_severity`. Fit scalers on train engines only. Useful engineered inputs: `vibration_1x/vibration_rms`, `vibration_peak/vibration_rms`, oil-pressure residual versus the RPM/temperature map, CHT minus its load/ambient expectation, and short-window standard deviation of RPM and EGT.

`mission_fault_type` is provided for analysis and stratification. It is mission-level ground truth including pre-onset samples — **do not feed it as a model input.**
