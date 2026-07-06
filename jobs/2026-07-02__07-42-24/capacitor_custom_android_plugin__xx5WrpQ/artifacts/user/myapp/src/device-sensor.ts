import { registerPlugin } from '@capacitor/core';

export interface SensorReading {
  sensor: string;
  value: number;
  unit: string;
}

export interface IsAvailableResult {
  available: boolean;
}

export interface DeviceSensorPlugin {
  getReading(options: { sensor: string }): Promise<SensorReading>;
  isAvailable(options: { sensor: string }): Promise<IsAvailableResult>;
}

const DeviceSensor = registerPlugin<DeviceSensorPlugin>('DeviceSensor');

export default DeviceSensor;
