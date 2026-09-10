# AeroTwin — AI-Enabled Digital Twin for Aero Piston Engine Health Monitoring (MALE UAV)

**AeroTwin** is a real-time digital twin health monitoring and predictive maintenance dashboard for aero piston engines used in Medium-Altitude Long-Endurance (MALE) UAVs.

The application combines a modern light-theme aerospace monitoring dashboard, a live parameter-driven **3D digital twin (Rotax 912-class horizontally opposed 4-stroke boxer engine)** with real gear ratios and thermal shaders, and an integrated **Machine Learning diagnostic backend (RandomForest Classifier)**.

---

## ⚠️ Prototype Disclaimer

> [!WARNING]
> This software is an engineering **prototype**. Telemetry streams, fault simulation scenarios, and diagnostic classifiers are simulated for demonstration purposes. The 3D engine model is a generic/stylized mechanical visualization based on publicly documented 4-cylinder horizontally-opposed aero piston engine principles (Rotax 912-class architecture) and does not use proprietary CAD assets, manufacturer trademarks, or real in-flight UAV data.

---

## 🛠️ System Architecture

```
[React Frontend — react-router-dom]
   ├─ Sidebar (Functional NavLinks across all 5 pages)
   ├─ /            Dashboard (KPIs, Sensor List, 3D Boxer Twin, AI Insights, Trend Charts)
   ├─ /telemetry   Live Telemetry (Multi-parameter interactive chart, Pause/Resume, Raw Table)
   ├─ /analytics   Analytics & Reports (Health Trend, Fault Frequency, CSV Export)
   ├─ /tasks       Maintenance Tasks (Status tracking, Priority filters)
   ├─ /settings    Settings (Threshold sliders, Model metadata, Theme preferences)
   │                      ▲
   │               (Shared Zustand Store — stream never resets on navigation)
   │                      ▼
   └─ RunSimulationDrawer (Slide-over with 11 live sensor sliders & 6 fault presets)
                          │
                   POST /api/diagnose
                          ▼
            [FastAPI Backend + ML Engine]
            ├── RandomForest Classifier (Fault detection & feature importances)
            ├── Reliability Engine (RUL calculation, failure probability, maintenance score)
            └── WebSocket Service (Real-time simulated telemetry cycle)
```

---

## 🛩️ 3D Digital Twin Features (Section 7)

- **Horizontally Opposed Boxer Layout**: Two opposed cylinder banks across a split aluminum crankcase with mirrored piston motion.
- **Central Internal Camshaft**: Operates at **half crankshaft speed (`crank ÷ 2`)**, actuating overhead valves, springs, and pushrods.
- **PSRU Reduction Gearbox**: Front output propeller shaft rotating at **`crank ÷ 2.43`** (visibly slower than the crankshaft).
- **Hybrid Cooling System**:
  - **Air-Cooled Finned Cylinder Barrels**: Machined aluminum barrels remain neutral metal tone with ram-air cooling fins.
  - **Liquid-Cooled Cylinder Heads**: Independent coolant jackets with live **CHT thermal glow** (cool blue $\rightarrow$ chrome $\rightarrow$ amber $\rightarrow$ hot red $\rightarrow$ combustion orange).
- **Dual Redundant Electronic Ignition**: 2 spark plugs and plug leads per cylinder with synchronized 4-stroke combustion ignition pulses.
- **Dry-Sump Lubrication**: External oil tank with level cap, braided scavenge lines, and oil health reactive glow.
- **Twin Carburetors**: Separate carb bodies and intake runners per cylinder bank.
- **Exhaust Headers & 4-into-1 Collector**: Glows dynamically with live **EGT (Exhaust Gas Temp)**.
- **4 World-Anchored Floating Callouts (`<Html occlude>`)**: Pinned to Vibration, Oil Pressure, EGT, and RPM with live status badges.

---

## 🚀 Installation & Local Run

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### 1. One-Command Launcher (Windows)
Double-click `start.bat` in the root folder to start both frontend and backend concurrently.

### 2. Manual Launch

#### ML Backend (FastAPI)
```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Presentation Narration Script (3 Minutes)

Use this script during live reviews, viva, or demonstrations:

- **0:00 – Open (Problem Framing)**:
  *"MALE UAVs fly 15 to 30-hour missions with no in-flight maintenance. If the piston engine develops a fault mid-mission, there's no mechanic to catch it. AeroTwin is a digital twin dashboard that watches engine vital signs in real time, predicts faults before they become failures, and gives ground control a clear reliability picture for the rest of the mission."*

- **0:20 – Show the Overview**:
  *"At the top we have the engine's current state at a glance: status, remaining useful life, failure probability, and overall maintenance score. On the left, live sensor readings with trend sparklines. In the center, the digital twin itself."*

- **0:45 – Show the Twin is Alive**:
  *"The crankshaft and pistons are turning at a speed driven directly by live RPM. Notice the central camshaft turning at half crank speed, and the propeller reduction gearbox spinning at 1/2.4 ratio. Each callout is pinned to the real part it's measuring, and the entire block has a vibration micro-jitter that scales with live vibration sensor readings."*

- **1:10 – Show the Sidebar Navigation**:
  *"Every icon on the left is a working page reading from the same live engine state. Live Telemetry gives us the raw feed, Analytics tracks historical trends, Tasks manages maintenance items, and Settings allows tuning alert thresholds."*

- **1:35 – Run a Fault Scenario**:
  *"Let's simulate oil starvation developing mid-flight. I open Run Simulation, select Oil Starvation, and submit. Look at the twin: the dry-sump tank and cylinder heads shift from green to amber to glowing red, every KPI updates, and a new alert lands in the notification bell."*

- **2:05 – Predictive Insights**:
  *"The AI explains itself: oil pressure is below nominal and vibration is trending upward. That reasoning comes straight from the model's feature importances, grounded in real telemetry data."*

- **2:25 – Close**:
  *"The prototype runs on a synthetic dataset built from realistic fault signatures. The next step is training on flight-test telemetry and extending the RUL model with time-series forecasting."*
