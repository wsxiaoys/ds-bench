import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

/**
 * Payload carried by the native "change" event and returned from
 * every Counter method.
 */
export interface CounterChangeEvent {
  value: number;
}

/**
 * Shape of the Counter plugin as seen from JavaScript.
 *
 * The native side is implemented in
 * `android/app/src/main/java/com/example/myapp/CounterPlugin.java`
 * and is registered with Capacitor under the name "Counter".
 */
export interface CounterPlugin {
  /** Increment the counter by 1 and emit a "change" event. */
  increment(): Promise<CounterChangeEvent>;
  /** Reset the counter to 0 and emit a "change" event. */
  reset(): Promise<CounterChangeEvent>;
  /** Read the current counter value (does not emit a "change" event). */
  getValue(): Promise<CounterChangeEvent>;
  /**
   * Subscribe to the native "change" event. The returned
   * {@link PluginListenerHandle} exposes `.remove()` which is the
   * only supported way to unsubscribe in Capacitor v8.
   */
  addListener(
    eventName: 'change',
    listenerFunc: (event: CounterChangeEvent) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const Counter = registerPlugin<CounterPlugin>('Counter');

export default Counter;
