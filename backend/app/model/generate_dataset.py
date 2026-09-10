import pandas as pd
import numpy as np
import os

# Set seed for reproducibility
np.random.seed(42)

def generate_engine_data(num_rows=6000):
    data = []
    
    # Target distribution
    # 60% Healthy
    # 10% Overheating
    # 10% Oil Starvation
    # 10% Bearing Wear
    # 10% Fuel-Lean Misfire
    
    for i in range(num_rows):
        # Determine class
        roll = np.random.random()
        if roll < 0.60:
            fault_type = "Healthy"
        elif roll < 0.70:
            fault_type = "Overheating"
        elif roll < 0.80:
            fault_type = "Oil Starvation"
        elif roll < 0.90:
            fault_type = "Bearing Wear"
        else:
            fault_type = "Fuel-Lean Misfire"
            
        # Default nominal values with small noise
        rpm = np.random.normal(4800, 150)
        cht = np.random.normal(110, 4)
        egt = np.random.normal(810, 12)
        oil_pressure = np.random.normal(380, 15)  # kPa
        oil_temp = np.random.normal(92, 3)
        fuel_flow = np.random.normal(18.5, 0.8)
        map_val = np.random.normal(101, 2)         # kPa
        vibration = np.random.normal(1.1, 0.15)
        voltage = np.random.normal(14.2, 0.2)
        altitude = np.random.normal(2500, 800)
        ambient_temp = 15 - (altitude / 1000) * 6.5 + np.random.normal(0, 2)
        afr = np.random.normal(14.7, 0.2)
        
        # Inject fault deviations
        if fault_type == "Overheating":
            # CHT high, EGT high, ambient temp often high or coolant leak simulated
            cht = np.random.normal(138, 5)
            egt = np.random.normal(895, 15)
            oil_temp = np.random.normal(114, 4)
            # Higher CHT is worse with high load/throttle
            rpm = np.random.normal(5200, 100)
            
        elif fault_type == "Oil Starvation":
            # Oil pressure drops significantly, oil temp spikes, vibration slightly up
            oil_pressure = np.random.normal(175, 18)
            oil_temp = np.random.normal(126, 6)
            vibration = np.random.normal(1.8, 0.25)
            cht = np.random.normal(122, 4)
            
        elif fault_type == "Bearing Wear":
            # Vibration level spikes, RPM becomes slightly unstable, voltage might sag
            vibration = np.random.normal(3.2, 0.4)
            rpm = np.random.normal(4600, 280)  # unstable
            oil_temp = np.random.normal(108, 4)
            
        elif fault_type == "Fuel-Lean Misfire":
            # AFR runs lean (high value), fuel flow rate drops, EGT fluctuations/spikes
            afr = np.random.normal(16.8, 0.4)
            fuel_flow = np.random.normal(13.2, 0.6)
            egt = np.random.normal(865, 35)    # fluctuating EGT
            rpm = np.random.normal(4400, 250)  # rough running/misfires
            vibration = np.random.normal(1.6, 0.2)
            
        # Bounds clipping for realistic physics
        rpm = np.clip(rpm, 1000, 6000)
        cht = np.clip(cht, 40, 160)
        egt = np.clip(egt, 300, 1000)
        oil_pressure = np.clip(oil_pressure, 20, 600)
        oil_temp = np.clip(oil_temp, 20, 150)
        fuel_flow = np.clip(fuel_flow, 1, 40)
        map_val = np.clip(map_val, 20, 150)
        vibration = np.clip(vibration, 0.05, 6.0)
        voltage = np.clip(voltage, 8.0, 18.0)
        altitude = np.clip(altitude, 0, 8000)
        afr = np.clip(afr, 8.0, 22.0)
        
        data.append({
            "rpm": rpm,
            "cht": cht,
            "egt": egt,
            "oil_pressure": oil_pressure,
            "oil_temp": oil_temp,
            "fuel_flow": fuel_flow,
            "map": map_val,
            "vibration": vibration,
            "voltage": voltage,
            "altitude": altitude,
            "ambient_temp": ambient_temp,
            "afr": afr,
            "fault_type": fault_type
        })
        
    df = pd.DataFrame(data)
    return df

if __name__ == "__main__":
    print("Generating synthetic aero engine telemetry...")
    df = generate_engine_data(6000)
    
    # Ensure save directory exists
    os.makedirs(os.path.dirname(__file__), exist_ok=True)
    csv_path = os.path.join(os.path.dirname(__file__), "engine_telemetry.csv")
    df.to_csv(csv_path, index=False)
    print(f"Generated {len(df)} rows. Saved dataset to: {csv_path}")
    print("\nDataset Class Distribution:")
    print(df["fault_type"].value_counts())
