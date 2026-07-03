import { registerPlugin } from '@capacitor/core';

/**
 * Echo plugin interface describing the methods exposed by the native
 * `EchoPlugin` Swift implementation.
 */
export interface EchoPlugin {
  /**
   * Echoes the provided `value` back to the JavaScript layer.
   */
  echo(options: { value: string }): Promise<{ value: string }>;
}

/**
 * Registered instance of the native `Echo` plugin. Capacitor routes calls
 * made on this proxy to the `EchoPlugin` Swift class registered with the
 * bridge in `MyViewController.capacitorDidLoad()`.
 */
export const Echo = registerPlugin<EchoPlugin>('Echo');