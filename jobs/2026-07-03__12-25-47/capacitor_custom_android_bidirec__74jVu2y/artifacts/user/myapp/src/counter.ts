import { registerPlugin } from '@capacitor/core';

export interface CounterChangeEvent {
  value: number;
}

export interface CounterPlugin {
  increment(options?: {}): Promise<{ value: number }>;
  reset(options?: {}): Promise<{ value: number }>;
  getValue(options?: {}): Promise<{ value: number }>;
  addListener(
    eventName: 'change',
    listenerFunc: (event: CounterChangeEvent) => void
  ): Promise<import('@capacitor/core').PluginListenerHandle>;
}

const Counter = registerPlugin<CounterPlugin>('Counter');

export default Counter;
