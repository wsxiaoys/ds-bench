import Counter from './counter';

/**
 * Driver script that exercises the bi-directional JS <-> Java path of
 * the Counter plugin.
 *
 * 1. Subscribe to the native "change" event with `addListener`.
 * 2. Drive the counter with `increment` / `getValue` / `reset` calls.
 * 3. Detach the listener deterministically by calling `.remove()` on
 *    the handle returned by `addListener` (this is the only supported
 *    removal path in Capacitor v8).
 */
async function run(): Promise<void> {
  // 1. Subscribe to the "change" event and store the handle. Awaiting
  //    the call gives us a PluginListenerHandle whose `.remove()`
  //    method detaches this exact subscription.
  const handle = await Counter.addListener('change', (event) => {
    // `event.value` is the integer emitted by the native side.
    console.log('Counter "change" event received:', event.value);
  });

  try {
    // 2a. Read the initial value (no event is emitted by getValue).
    const initial = await Counter.getValue();
    console.log('Initial counter value:', initial.value);

    // 2b. Increment twice — each call should fire a "change" event.
    await Counter.increment();
    await Counter.increment();

    // 2c. Read the current value.
    const current = await Counter.getValue();
    console.log('Counter value after two increments:', current.value);

    // 2d. Reset — fires a "change" event with value 0.
    await Counter.reset();

    const afterReset = await Counter.getValue();
    console.log('Counter value after reset:', afterReset.value);
  } finally {
    // 3. Always detach the listener via the stored handle.
    await handle.remove();
    console.log('Counter "change" listener removed via handle.');
  }
}

run().catch((err) => {
  console.error('Counter driver failed:', err);
});
