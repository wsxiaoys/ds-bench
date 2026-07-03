import { registerPlugin } from '@capacitor/core';

export interface DeviceSensorReading {
  sensor: string;
  value: number;
  unit: string;
}

export interface DeviceSensorAvailability {
  available: boolean;
}

export interface DeviceSensorPlugin {
  getReading(options: { sensor: string }): Promise<DeviceSensorReading>;
  isAvailable(options: { sensor: string }): Promise<DeviceSensorAvailability>;
}

const DeviceSensor = registerPlugin<DeviceSensorPlugin>('DeviceSensor');

export default DeviceSensor;
