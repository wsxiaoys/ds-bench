import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface CounterPlugin {
  increment(options?: any): Promise<{ value: number }>;
  reset(options?: any): Promise<{ value: number }>;
  getValue(options?: any): Promise<{ value: number }>;
  addListener(
    eventName: 'change',
    listenerFunc: (state: { value: number }) => void
  ): Promise<PluginListenerHandle>;
}

const Counter = registerPlugin<CounterPlugin>('Counter');

export default Counter;
