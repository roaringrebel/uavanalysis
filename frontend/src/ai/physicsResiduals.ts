// ============================================================
// Physics-Informed Residuals
// ============================================================
// Compares telemetry observations to physics model expectations
// to identify deviations and generate physics-based anomaly scores.
// ============================================================

import { 
  EngineTelemetry, PhysicsExpected, PhysicsResult, 
  PhysicsResidual, HealthState, OperatingCondition 
} from '../types/engine';
import { HEALTH_THRESHOLDS } from '../config/engine.config';
import { AIModelInterface } from './modelInterface';

export interface PhysicsResidualInput {
  telemetry: EngineTelemetry;
  expected: PhysicsExpected;
  operatingCondition: OperatingCondition;
  timestamp: number;
}

export class PhysicsResidualModel implements AIModelInterface<PhysicsResidualInput, PhysicsResult> {
  readonly modelName = 'Physics-Informed Residual Model';
  readonly modelType = 'First-Principles / PINN';
  readonly isSimulated = true; // Still true because it's running locally in TS, though it's real logic

  async predict(input: PhysicsResidualInput): Promise<PhysicsResult> {
    const { telemetry, expected, timestamp } = input;

    const residuals: PhysicsResidual[] = [];
    let totalSeverityScore = 0;
    
    // Helper to calculate and categorize residual
    const evalParam = (name: string, act: number, exp: number) => {
      // Avoid division by zero
      const safeExp = Math.max(Math.abs(exp), 0.001); 
      const res = act - exp;
      const relError = Math.abs(res) / safeExp;

      let severity = HealthState.HEALTHY;
      let scoreContrib = 0;

      if (relError >= HEALTH_THRESHOLDS.residualCritical) {
        severity = HealthState.CRITICAL;
        scoreContrib = 1.0;
      } else if (relError >= HEALTH_THRESHOLDS.residualWarning) {
        severity = HealthState.WARNING;
        scoreContrib = 0.5;
      } else if (relError >= HEALTH_THRESHOLDS.residualNormal) {
        severity = HealthState.DEGRADED;
        scoreContrib = 0.2;
      }

      totalSeverityScore += scoreContrib;

      residuals.push({
        parameter: name,
        expected: exp,
        actual: act,
        residual: res,
        relativeError: relError,
        severity
      });
    };

    evalParam('RPM', telemetry.rpm, expected.rpm);
    evalParam('CHT', telemetry.cht, expected.cht);
    evalParam('EGT', telemetry.egt, expected.egt);
    evalParam('Oil Pressure', telemetry.oilPressure, expected.oilPressure);
    evalParam('Oil Temp', telemetry.oilTemp, expected.oilTemp);
    evalParam('Fuel Flow', telemetry.fuelFlow, expected.fuelFlow);
    evalParam('Vibration', telemetry.vibration, expected.vibration);

    // Normalize overall deviation (0-1)
    // Max possible score is residuals.length (all critical)
    const overallDeviation = Math.min(1.0, totalSeverityScore / (residuals.length * 0.5));

    return {
      residuals,
      overallDeviation,
      timestamp
    };
  }
}

export const physicsResidualModel = new PhysicsResidualModel();
