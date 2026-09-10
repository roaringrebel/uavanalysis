#!/usr/bin/env python3
"""
generate_fault_dataset.py
=========================
Physics-informed synthetic multivariate telemetry generator for UAV
piston-engine fault diagnosis (1D-CNN + BiLSTM training data).

Design principle
----------------
No label is drawn at random. Every mission simulates a small lumped-parameter
engine model (rotational dynamics, first-order thermal masses, lubrication
pressure map, RPM-dependent vibration spectrum). A fault is injected as a
*mechanism* that perturbs a physical parameter of that model; the sensor
signatures, their temporal progression and the labels all fall out of the
simulation.

    fault mechanism -> physical parameter change -> state evolution
    -> sensor response -> temporal progression -> label

Outputs (written to OUTDIR):
    fault_dataset.csv, train.csv, validation.csv, test.csv,
    metadata.json, fault_signature_report.md, plots/*.png

DISCLAIMER: fully synthetic. Not certified real-world aircraft maintenance
data and must not be represented as such.
"""

import json
import os
import numpy as np
import pandas as pd

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
SEED = 20260903
N_ENGINES = 20
MISSIONS_PER_ENGINE = 8          # one per fault class -> perfect class balance
SAMPLES_PER_MISSION = 250        # 250 * 160 missions = 40,000 rows
DT = 4.0                         # s between samples (~16.7 min mission)
OUTDIR = os.environ.get("OUTDIR", "/mnt/user-data/outputs")

FAULTS = ["NORMAL", "BEARING_DEGRADATION", "PROPELLER_IMBALANCE",
          "ENGINE_MISFIRE", "LOW_OIL_PRESSURE", "OVERHEATING",
          "COOLING_SYSTEM_FAILURE", "SENSOR_ANOMALY"]

AFFECTED_COMPONENT = {
    "NORMAL": "NONE",
    "BEARING_DEGRADATION": "CRANKSHAFT_MAIN_BEARING",
    "PROPELLER_IMBALANCE": "PROPELLER_ROTOR_ASSEMBLY",
    "ENGINE_MISFIRE": "IGNITION_FUEL_DELIVERY",
    "LOW_OIL_PRESSURE": "OIL_PUMP_LUBRICATION_CIRCUIT",
    "OVERHEATING": "COMBUSTION_THERMAL_MANAGEMENT",
    "COOLING_SYSTEM_FAILURE": "COOLING_CIRCUIT",
    "SENSOR_ANOMALY": "SENSOR_SIGNAL_CHAIN",
}

RPM_IDLE, RPM_MAX = 1800.0, 6800.0

# ----------------------------------------------------------------------------
# Mission profile (flight phases -> throttle demand)
# ----------------------------------------------------------------------------
PHASE_THROTTLE = {"GROUND_IDLE": 0.14, "TAKEOFF": 0.96, "CLIMB": 0.86,
                  "CRUISE": 0.64, "LOITER": 0.48, "DESCENT": 0.26,
                  "LANDING": 0.42}
# ram-air cooling effectiveness multiplier per phase (airspeed / duct flow)
PHASE_AIRFLOW = {"GROUND_IDLE": 0.55, "TAKEOFF": 0.80, "CLIMB": 0.86,
                 "CRUISE": 1.00, "LOITER": 0.94, "DESCENT": 1.12,
                 "LANDING": 0.90}
PHASE_ALT = {"GROUND_IDLE": 0.0, "TAKEOFF": 60.0, "CLIMB": 700.0,
             "CRUISE": 1500.0, "LOITER": 1350.0, "DESCENT": 500.0,
             "LANDING": 40.0}


def build_phase_schedule(rng):
    """Return a per-sample flight-phase array with mission-to-mission jitter."""
    base = [("GROUND_IDLE", 18), ("TAKEOFF", 18), ("CLIMB", 46),
            ("CRUISE", 62), ("LOITER", 48), ("DESCENT", 30),
            ("LANDING", 16), ("GROUND_IDLE", 12)]
    lens = [max(6, int(round(n * rng.uniform(0.75, 1.25)))) for _, n in base]
    scale = SAMPLES_PER_MISSION / sum(lens)
    lens = [max(5, int(round(l * scale))) for l in lens]
    while sum(lens) < SAMPLES_PER_MISSION:
        lens[3] += 1
    while sum(lens) > SAMPLES_PER_MISSION:
        lens[int(np.argmax(lens))] -= 1
    phases = []
    for (name, _), n in zip(base, lens):
        phases += [name] * n
    return np.array(phases[:SAMPLES_PER_MISSION])


def smooth_noise(rng, n, sigma, tau=8.0):
    """Temporally correlated (AR-1) noise: sensor noise that is not white."""
    a = np.exp(-1.0 / tau)
    w = rng.normal(0.0, sigma * np.sqrt(1 - a * a), n)
    out = np.empty(n)
    x = rng.normal(0.0, sigma)
    for i in range(n):
        x = a * x + w[i]
        out[i] = x
    return out


# ----------------------------------------------------------------------------
# Fault mechanism scheduling: onset, duration, ramp shape, severity ceiling
# ----------------------------------------------------------------------------
def severity_profile(rng, fault):
    """Return (sev[t] in [0,1], onset_idx, duration_samples, variant)."""
    n = SAMPLES_PER_MISSION
    sev = np.zeros(n)
    if fault == "NORMAL":
        return sev, -1, 0, "none"

    onset = int(rng.integers(25, 175))
    duration = int(min(n - onset, rng.integers(45, 230)))
    ceiling = float(rng.uniform(0.30, 1.0))

    if fault == "LOW_OIL_PRESSURE":
        variant = rng.choice(["gradual", "sudden"], p=[0.55, 0.45])
    elif fault == "BEARING_DEGRADATION":
        variant = rng.choice(["progressive", "spalling_step"], p=[0.6, 0.4])
    elif fault == "SENSOR_ANOMALY":
        variant = rng.choice(["bias", "drift", "dropout", "stuck",
                              "spike", "inconsistent"])
    else:
        variant = rng.choice(["gradual", "accelerating"], p=[0.5, 0.5])

    t = np.arange(duration) / max(1, duration - 1)
    if variant in ("sudden", "dropout", "stuck", "bias"):
        ramp = np.clip(t / 0.06, 0, 1)                      # near step change
    elif variant == "accelerating":
        ramp = t ** 2.2                                     # knee at the end
    elif variant == "spalling_step":
        ramp = np.clip(0.35 * t + 0.55 * (t > rng.uniform(0.4, 0.75)) +
                       0.25 * (t > 0.88), 0, 1)             # plateau + jumps
    elif variant == "spike":
        ramp = np.ones(duration)
    else:
        ramp = t ** rng.uniform(0.8, 1.4)                   # gradual, convex-ish
    sev[onset:onset + duration] = ceiling * ramp
    # residual after the window (damage does not heal)
    if onset + duration < n and fault not in ("SENSOR_ANOMALY",):
        sev[onset + duration:] = sev[onset + duration - 1]
    return sev, onset, duration, str(variant)


def stage_label(s):
    if s < 0.05:
        return "NORMAL"
    if s < 0.35:
        return "EARLY"
    if s < 0.70:
        return "MODERATE"
    return "SEVERE"


# ----------------------------------------------------------------------------
# Core mission simulator
# ----------------------------------------------------------------------------
def simulate_mission(engine_id, mission_idx, fault, op_hours_start, t0, rng):
    n = SAMPLES_PER_MISSION
    phases = build_phase_schedule(rng)
    sev, onset, duration, variant = severity_profile(rng, fault)

    # --- ambient / airframe condition (mission-level) ---------------------
    amb_t_sl = rng.uniform(-2.0, 44.0)                 # sea-level ambient degC
    alt = np.array([PHASE_ALT[p] for p in phases]) * rng.uniform(0.7, 1.4)
    alt += smooth_noise(rng, n, 25.0, 12.0)
    amb_temp = amb_t_sl - 0.0065 * alt + smooth_noise(rng, n, 0.35, 15.0)
    amb_press = 1013.25 * (1 - 2.25577e-5 * np.clip(alt, 0, None)) ** 5.2559
    amb_press += smooth_noise(rng, n, 0.5, 20.0)

    # --- airframe/engine unit-to-unit variation ---------------------------
    wear = np.clip(op_hours_start / 1600.0, 0, 1)      # 0..1 fleet-life wear
    cool_base = rng.uniform(0.90, 1.08) - 0.10 * wear  # cooling effectiveness
    # per-mission vibration cross-coupling -> deliberate signature ambiguity
    prop_bb_coup = rng.uniform(0.05, 0.45)   # worn mounts smear imbalance energy
    bear_1x_coup = rng.uniform(0.15, 0.60)   # bearing wear can raise 1X too
    vib_base_unit = rng.uniform(0.90, 1.15) + 0.20 * wear
    op_bias = rng.uniform(-0.03, 0.03)                 # trim / mixture bias

    thr_demand = np.array([PHASE_THROTTLE[p] for p in phases])
    thr_demand = np.clip(thr_demand * (1 + op_bias) +
                         smooth_noise(rng, n, 0.020, 10.0), 0.08, 1.0)
    airflow = np.array([PHASE_AIRFLOW[p] for p in phases])

    # --- state arrays ------------------------------------------------------
    rpm = np.zeros(n); load = np.zeros(n); thr = np.zeros(n)
    oil_p = np.zeros(n); oil_t = np.zeros(n); cht = np.zeros(n)
    egt = np.zeros(n); fuel = np.zeros(n)
    v_rms = np.zeros(n); v_pk = np.zeros(n); v1x = np.zeros(n); v2x = np.zeros(n)
    v_bb = np.zeros(n)                                  # broadband component
    batt = np.zeros(n); alt_v = np.zeros(n)
    degr = np.zeros(n)

    # initial thermal state: cold-ish engine on the ramp
    oil_t_s = amb_temp[0] + rng.uniform(8, 30)
    cht_s = amb_temp[0] + rng.uniform(10, 40)
    egt_s = amb_temp[0] + 120.0
    rpm_s = RPM_IDLE * rng.uniform(0.95, 1.05)
    thr_s = thr_demand[0]

    misfire_burst = np.zeros(n)                         # intermittency mask
    if fault == "ENGINE_MISFIRE":
        for i in range(n):
            if sev[i] > 0.02:
                p = 0.10 + 0.55 * sev[i]                # bursty, not constant
                if rng.random() < p:
                    L = int(rng.integers(1, 6))
                    misfire_burst[i:i + L] = rng.uniform(0.5, 1.0)

    # thermal time constants (s)
    TAU_OIL, TAU_CHT, TAU_EGT = 150.0, 70.0, 20.0

    for i in range(n):
        s = sev[i]

        # ---- fault mechanism -> physical parameter perturbations --------
        cool_eff = cool_base
        tau_cht, tau_oil = TAU_CHT, TAU_OIL
        heat_extra = 0.0          # extra combustion heat into the head
        fric_extra = 0.0          # parasitic friction (heat into the oil)
        oil_p_loss = 0.0          # lubrication circuit pressure deficit
        torque_loss = 0.0

        if fault == "COOLING_SYSTEM_FAILURE":
            cool_eff *= (1.0 - 0.48 * s)                # reduced heat rejection
            tau_cht *= (1.0 + 2.0 * s)                  # slow thermal recovery
            tau_oil *= (1.0 + 1.2 * s)
        elif fault == "OVERHEATING":
            heat_extra = 38.0 * s                       # lean/timing -> hot burn
            fric_extra = 6.0 * s
        elif fault == "LOW_OIL_PRESSURE":
            oil_p_loss = 1.85 * s
            fric_extra = 26.0 * s                       # boundary lubrication
        elif fault == "BEARING_DEGRADATION":
            fric_extra = 9.0 * s
            oil_p_loss = 0.20 * s                       # clearance leakage
            torque_loss = 0.010 * s
        elif fault == "PROPELLER_IMBALANCE":
            torque_loss = 0.004 * s                     # aero penalty only
        elif fault == "ENGINE_MISFIRE":
            torque_loss = 0.16 * misfire_burst[i] * s

        # ---- throttle / rotational dynamics ----------------------------
        thr_s += (thr_demand[i] - thr_s) * (1 - np.exp(-DT / 6.0))
        rpm_cmd = RPM_IDLE + (RPM_MAX - RPM_IDLE) * thr_s ** 0.92
        rpm_cmd *= (1.0 - torque_loss)
        rpm_s += (rpm_cmd - rpm_s) * (1 - np.exp(-DT / 5.0))
        r = rpm_s + rng.normal(0, 6.0)
        # fault-driven RPM instability (cycle-to-cycle torque fluctuation)
        if fault == "ENGINE_MISFIRE":
            r += rng.normal(0, 55.0 * misfire_burst[i] * (0.3 + s))
        if fault == "BEARING_DEGRADATION" and s > 0.65:
            r += rng.normal(0, 34.0 * (s - 0.65) / 0.35)
        rpm[i] = r
        thr[i] = thr_s
        rn = np.clip(r / RPM_MAX, 0.05, 1.2)            # normalised speed

        # ---- load, fuel flow -------------------------------------------
        dens = amb_press[i] / 1013.25
        ld = np.clip(thr_s ** 1.1 * (0.55 + 0.45 * rn) * (0.90 + 0.10 * dens)
                     - 0.9 * torque_loss, 0.03, 1.05)
        load[i] = ld
        fuel[i] = (1.05 + 15.0 * ld ** 1.05 * rn ** 0.55) \
            * (1 + 0.06 * misfire_burst[i] * s) + smooth_noise(rng, 1, 0.05)[0]

        # ---- thermal states (first-order lumped masses) ----------------
        cht_eq = amb_temp[i] + 38.0 + 152.0 * ld ** 0.90 / \
            (cool_eff * (0.55 + 0.45 * airflow[i])) + heat_extra \
            - 22.0 * misfire_burst[i] * s
        oil_eq = amb_temp[i] + 30.0 + 68.0 * ld ** 0.85 / \
            (cool_eff * (0.65 + 0.35 * airflow[i])) \
            + 0.26 * heat_extra + fric_extra
        egt_eq = 560.0 + 300.0 * ld ** 0.80 + 1.15 * heat_extra
        if fault == "ENGINE_MISFIRE":
            egt_eq -= 210.0 * misfire_burst[i] * s      # unburnt charge
            egt_eq += rng.normal(0, 26.0 * s)           # cylinder-to-cyl scatter

        cht_s += (cht_eq - cht_s) * (1 - np.exp(-DT / tau_cht))
        oil_t_s += (oil_eq - oil_t_s) * (1 - np.exp(-DT / tau_oil))
        egt_s += (egt_eq - egt_s) * (1 - np.exp(-DT / TAU_EGT))
        cht[i] = cht_s
        oil_t[i] = oil_t_s
        egt[i] = egt_s

        # ---- lubrication pressure map ----------------------------------
        p = 0.95 + 3.35 * rn - 0.0125 * max(0.0, oil_t_s - 90.0) - oil_p_loss
        if fault == "LOW_OIL_PRESSURE" and s > 0.4:
            p += rng.normal(0, 0.09 * s)                # pump cavitation
        oil_p[i] = max(0.05, p)

        # ---- vibration spectrum (RPM-dependent excitation) -------------
        b1x = (0.16 + 0.52 * rn ** 2) * vib_base_unit   # residual imbalance
        b2x = 0.38 * b1x                                # misalignment/firing
        bbb = (0.14 + 0.30 * rn ** 2 + 0.16 * ld) * vib_base_unit
        crest = 3.1

        if fault == "BEARING_DEGRADATION":
            # spall -> impulsive broadband + harmonics, grows with speed^2
            g = s ** 1.45 * (0.35 + 1.85 * rn ** 2)
            bbb += 0.95 * g * rng.uniform(0.85, 1.20)
            b2x += 0.75 * g
            b1x += bear_1x_coup * g
            crest += 3.4 * s ** 1.2 * rng.uniform(0.8, 1.2)   # impulsiveness
        elif fault == "PROPELLER_IMBALANCE":
            # centrifugal force ~ m*e*omega^2 -> almost pure 1X
            g = s * (0.30 + 2.35 * rn ** 2) * (0.75 + 0.25 * ld)
            b1x += 1.00 * g
            b2x += 0.08 * g
            bbb += prop_bb_coup * g
            crest -= 0.55 * s                            # sinusoidal, low crest
        elif fault == "ENGINE_MISFIRE":
            g = misfire_burst[i] * s
            b1x += 0.30 * g * (0.4 + rn)                 # 0.5X/1X torsional
            b2x += 0.22 * g
            bbb += 0.45 * g * rng.uniform(0.6, 1.5)
            crest += 2.2 * g
        elif fault == "LOW_OIL_PRESSURE":
            bbb += 0.42 * s ** 1.3 * (0.3 + rn)          # metal-to-metal
            crest += 1.1 * s
        elif fault == "OVERHEATING":
            bbb += 0.10 * s
        elif fault == "COOLING_SYSTEM_FAILURE":
            bbb += 0.07 * s

        b1x = max(0.0, b1x + rng.normal(0, 0.018))
        b2x = max(0.0, b2x + rng.normal(0, 0.014))
        bbb = max(0.0, bbb + abs(rng.normal(0, 0.020)))
        v1x[i], v2x[i], v_bb[i] = b1x, b2x, bbb
        v_rms[i] = np.sqrt(b1x ** 2 + b2x ** 2 + bbb ** 2)
        v_pk[i] = v_rms[i] * max(1.6, crest + rng.normal(0, 0.18))

        # ---- electrical -------------------------------------------------
        chg = r > 2300
        alt_v[i] = (28.15 - 0.25 * ld if chg else 0.0) + rng.normal(0, 0.05)
        batt[i] = (25.9 - 0.35 * ld if chg else 24.3 - 0.9 * ld) + \
            rng.normal(0, 0.04)

        # ---- health / degradation index --------------------------------
        mech = {"BEARING_DEGRADATION": 0.62, "LOW_OIL_PRESSURE": 0.70,
                "OVERHEATING": 0.45, "COOLING_SYSTEM_FAILURE": 0.40,
                "PROPELLER_IMBALANCE": 0.35, "ENGINE_MISFIRE": 0.30,
                "SENSOR_ANOMALY": 0.0, "NORMAL": 0.0}[fault]
        thermal = 0.10 * max(0.0, (cht_s - 210.0) / 60.0)
        degr[i] = np.clip(0.16 * wear + mech * s ** 1.2 + thermal, 0, 1)

    # ------------------------------------------------------------------
    # SENSOR ANOMALY: corrupt the measurement chain, leave physics intact
    # ------------------------------------------------------------------
    sensor_channel = ""
    if fault == "SENSOR_ANOMALY":
        ch = rng.choice(["oil_pressure", "oil_temperature", "cht", "egt",
                         "rpm", "vibration_rms", "fuel_flow"])
        sensor_channel = str(ch)
        arr = {"oil_pressure": oil_p, "oil_temperature": oil_t, "cht": cht,
               "egt": egt, "rpm": rpm, "vibration_rms": v_rms,
               "fuel_flow": fuel}[ch]
        m = sev > 0.02
        idx = np.where(m)[0]
        span = float(np.percentile(arr, 90) - np.percentile(arr, 10) + 1e-6)
        if len(idx):
            if variant == "bias":
                arr[m] += np.sign(rng.normal()) * 0.35 * span * sev[m] / max(sev.max(), 1e-6)
            elif variant == "drift":
                arr[m] += 0.9 * span * sev[m]
            elif variant == "dropout":
                arr[idx] = 0.0 if ch != "rpm" else 0.0
            elif variant == "stuck":
                arr[idx] = arr[idx[0]]                  # frozen last-good value
            elif variant == "spike":
                for i in idx:
                    if rng.random() < 0.10:
                        arr[i] += rng.choice([-1, 1]) * rng.uniform(1.0, 3.0) * span
            elif variant == "inconsistent":
                # breaks a known physical relationship (e.g. oil_p vs rpm)
                arr[idx] = float(np.median(arr)) + \
                    0.25 * span * np.sin(np.arange(len(idx)) / 9.0)
        fs = {"oil_pressure": (0.0, 10.0), "oil_temperature": (-40.0, 250.0),
              "cht": (-40.0, 400.0), "egt": (0.0, 1300.0),
              "rpm": (0.0, 9999.0), "vibration_rms": (0.0, 8.0),
              "fuel_flow": (0.0, 40.0)}[ch]
        np.clip(arr, fs[0], fs[1], out=arr)      # ADC / gauge saturation
        if ch == "vibration_rms":
            v_pk[:] = v_rms * 3.1                # peak follows the bad channel

    # ------------------------------------------------------------------
    # assemble frame
    # ------------------------------------------------------------------
    ts = pd.to_datetime(t0) + pd.to_timedelta(np.arange(n) * DT, unit="s")
    stages = np.array([stage_label(s) for s in sev])
    row_fault = np.where(stages == "NORMAL", "NORMAL", fault)
    onset_ts = "" if onset < 0 else str(ts[onset])

    df = pd.DataFrame({
        "timestamp": ts,
        "engine_id": f"ENG_{engine_id:03d}",
        "mission_id": f"ENG_{engine_id:03d}_M{mission_idx:02d}",
        "flight_phase": phases,
        "engine_operating_hours": np.round(
            op_hours_start + np.arange(n) * DT / 3600.0, 4),
        "rpm": np.round(rpm, 1),
        "throttle": np.round(thr, 4),
        "engine_load": np.round(load, 4),
        "oil_pressure": np.round(oil_p, 3),
        "oil_temperature": np.round(oil_t, 2),
        "cht": np.round(cht, 2),
        "egt": np.round(egt, 2),
        "fuel_flow": np.round(fuel, 3),
        "vibration_rms": np.round(v_rms, 4),
        "vibration_peak": np.round(v_pk, 4),
        "vibration_1x": np.round(v1x, 4),
        "vibration_2x": np.round(v2x, 4),
        "battery_voltage": np.round(batt, 3),
        "alternator_voltage": np.round(alt_v, 3),
        "ambient_temperature": np.round(amb_temp, 2),
        "ambient_pressure": np.round(amb_press, 2),
        "degradation_index": np.round(degr, 4),
        "fault_type": row_fault,
        "fault_severity": stages,
        "fault_progression": np.round(sev, 4),
        "mission_fault_type": fault,
        "affected_component": np.where(stages == "NORMAL", "NONE",
                                       AFFECTED_COMPONENT[fault]),
        "fault_onset_timestamp": onset_ts,
        "fault_duration_s": 0 if onset < 0 else int(duration * DT),
        "fault_variant": variant,
        "sensor_channel_affected": sensor_channel,
    })
    return df


# ----------------------------------------------------------------------------
# Dataset build
# ----------------------------------------------------------------------------
def build():
    rng = np.random.default_rng(SEED)
    frames = []
    for e in range(1, N_ENGINES + 1):
        hours = float(rng.uniform(5, 1400))
        order = list(rng.permutation(FAULTS))       # each engine sees all 8
        t = pd.Timestamp("2026-03-01") + pd.Timedelta(days=int(rng.integers(0, 120)))
        for m, fault in enumerate(order, start=1):
            frames.append(simulate_mission(e, m, fault, hours, t, rng))
            hours += SAMPLES_PER_MISSION * DT / 3600.0 + float(rng.uniform(0.2, 3.0))
            t += pd.Timedelta(hours=float(rng.uniform(6, 96)))
    df = pd.concat(frames, ignore_index=True)
    return df.sort_values(["engine_id", "mission_id", "timestamp"]).reset_index(drop=True)


def split_by_engine(df, rng):
    """Group split on engine_id -> a physical mission never crosses splits."""
    engines = sorted(df.engine_id.unique())
    perm = list(rng.permutation(engines))
    train, val, test = perm[:14], perm[14:17], perm[17:]
    return (df[df.engine_id.isin(train)].copy(),
            df[df.engine_id.isin(val)].copy(),
            df[df.engine_id.isin(test)].copy(), train, val, test)


# ----------------------------------------------------------------------------
# Diagnostic plots
# ----------------------------------------------------------------------------
def make_plots(df, outdir):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    pdir = os.path.join(outdir, "plots")
    os.makedirs(pdir, exist_ok=True)
    panels = [("rpm", "RPM"), ("oil_pressure", "Oil pressure [bar]"),
              ("oil_temperature", "Oil temp [C]"), ("cht", "CHT [C]"),
              ("egt", "EGT [C]"), ("vibration_rms", "Vib RMS [g]"),
              ("vibration_1x", "Vib 1X [g]"), ("vibration_2x", "Vib 2X [g]")]
    files = []
    for fault in FAULTS:
        sub = df[df.mission_fault_type == fault]
        # pick the mission that reaches the highest severity (clearest signature)
        mid = sub.groupby("mission_id").fault_progression.max().idxmax()
        m = sub[sub.mission_id == mid].reset_index(drop=True)
        x = np.arange(len(m)) * DT / 60.0
        fig, axes = plt.subplots(4, 2, figsize=(13, 11), sharex=True)
        for ax, (col, lab) in zip(axes.ravel(), panels):
            ax.plot(x, m[col], lw=0.9, color="#1f4e79")
            ax.set_ylabel(lab, fontsize=9)
            ax.grid(alpha=0.25)
            ax2 = ax.twinx()
            ax2.plot(x, m.fault_progression, lw=0.8, ls="--", color="#c0392b", alpha=0.6)
            ax2.set_ylim(0, 1.05); ax2.set_yticks([])
            on = m.index[m.fault_severity != "NORMAL"]
            if len(on):
                ax.axvline(on[0] * DT / 60.0, color="#c0392b", lw=0.8, alpha=0.7)
        for ax in axes[-1]:
            ax.set_xlabel("mission time [min]")
        fig.suptitle(f"{fault} — {mid} (variant: {m.fault_variant.iloc[0]}) "
                     f"| dashed red = fault progression", fontsize=12)
        fig.tight_layout(rect=[0, 0, 1, 0.97])
        p = os.path.join(pdir, f"{fault.lower()}_signature.png")
        fig.savefig(p, dpi=110); plt.close(fig)
        files.append(p)
    return files


# ----------------------------------------------------------------------------
def main():
    os.makedirs(OUTDIR, exist_ok=True)
    df = build()
    rng = np.random.default_rng(SEED + 1)
    tr, va, te, e_tr, e_va, e_te = split_by_engine(df, rng)

    df.to_csv(os.path.join(OUTDIR, "fault_dataset.csv"), index=False)
    tr.to_csv(os.path.join(OUTDIR, "train.csv"), index=False)
    va.to_csv(os.path.join(OUTDIR, "validation.csv"), index=False)
    te.to_csv(os.path.join(OUTDIR, "test.csv"), index=False)
    make_plots(df, OUTDIR)

    def counts(x, col):
        return {str(k): int(v) for k, v in x[col].value_counts().items()}

    meta = {
        "name": "UAV piston-engine physics-informed synthetic fault dataset",
        "version": "1.0",
        "disclaimer": ("Fully synthetic, generated by a lumped-parameter engine "
                       "simulation. NOT certified real-world aircraft "
                       "maintenance data and must not be represented as such."),
        "generator": "generate_fault_dataset.py",
        "random_seed": SEED,
        "sampling_interval_s": DT,
        "rows": int(len(df)),
        "engines": int(df.engine_id.nunique()),
        "missions": int(df.mission_id.nunique()),
        "samples_per_mission": SAMPLES_PER_MISSION,
        "sequence_recommendation": {
            "window_length": 64, "stride": 8,
            "note": ("build windows within a single mission_id only; label a "
                     "window by the majority/last-sample fault_type & severity")
        },
        "fault_classes": FAULTS,
        "affected_component_map": AFFECTED_COMPONENT,
        "severity_thresholds_on_fault_progression": {
            "NORMAL": "<0.05", "EARLY": "0.05-0.35",
            "MODERATE": "0.35-0.70", "SEVERE": ">=0.70"},
        "columns": {
            "timestamp": "ISO timestamp, 4 s cadence",
            "engine_id": "physical engine unit (split key)",
            "mission_id": "unique flight; never spans splits",
            "flight_phase": "GROUND_IDLE/TAKEOFF/CLIMB/CRUISE/LOITER/DESCENT/LANDING",
            "engine_operating_hours": "cumulative unit life [h]",
            "rpm": "crankshaft speed [rev/min]",
            "throttle": "lagged throttle position [0-1]",
            "engine_load": "normalised brake load [0-1]",
            "oil_pressure": "gauge oil pressure [bar]",
            "oil_temperature": "oil sump temperature [degC]",
            "cht": "cylinder head temperature [degC]",
            "egt": "exhaust gas temperature [degC]",
            "fuel_flow": "volumetric fuel flow [L/h]",
            "vibration_rms": "broadband RMS acceleration [g]",
            "vibration_peak": "peak acceleration [g] (crest factor carries impulsiveness)",
            "vibration_1x": "order-1 (shaft speed) amplitude [g]",
            "vibration_2x": "order-2 amplitude [g]",
            "battery_voltage": "bus voltage [V]",
            "alternator_voltage": "alternator output [V], 0 below charge speed",
            "ambient_temperature": "OAT [degC], lapse-rate dependent",
            "ambient_pressure": "static pressure [hPa], ISA barometric",
            "degradation_index": "latent health loss [0-1]",
            "fault_type": "per-sample label (NORMAL until onset)",
            "fault_severity": "NORMAL/EARLY/MODERATE/SEVERE",
            "fault_progression": "continuous mechanism severity [0-1]",
            "mission_fault_type": "mission-level ground truth (for analysis only)",
            "affected_component": "component attribution",
            "fault_onset_timestamp": "onset time, empty for NORMAL missions",
            "fault_duration_s": "duration of the injected mechanism [s]",
            "fault_variant": "mechanism sub-type (gradual/sudden/spalling_step/...)",
            "sensor_channel_affected": "corrupted channel for SENSOR_ANOMALY",
        },
        "splits": {
            "strategy": "grouped by engine_id (mission-disjoint by construction)",
            "train": {"engines": e_tr, "rows": int(len(tr)),
                      "mission_fault_type_rows": counts(tr, "mission_fault_type")},
            "validation": {"engines": e_va, "rows": int(len(va)),
                           "mission_fault_type_rows": counts(va, "mission_fault_type")},
            "test": {"engines": e_te, "rows": int(len(te)),
                     "mission_fault_type_rows": counts(te, "mission_fault_type")},
        },
        "row_label_distribution": counts(df, "fault_type"),
        "severity_distribution": counts(df, "fault_severity"),
        "plots": [f"plots/{f.lower()}_signature.png" for f in FAULTS],
    }
    with open(os.path.join(OUTDIR, "metadata.json"), "w") as fh:
        json.dump(meta, fh, indent=2)

    print(f"rows={len(df)} missions={df.mission_id.nunique()} "
          f"train/val/test={len(tr)}/{len(va)}/{len(te)}")
    print(df.fault_type.value_counts())
    print(df.fault_severity.value_counts())


if __name__ == "__main__":
    main()
