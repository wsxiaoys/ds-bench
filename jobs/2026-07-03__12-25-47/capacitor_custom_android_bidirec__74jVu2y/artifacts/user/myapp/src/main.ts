import Counter from './counter';

async function run(): Promise<void> {
  const handle = await Counter.addListener('change', (event) => {
    // Native counter change observed
    console.log('Counter change event:', event.value);
  });

  // Drive the native state a few times
  await Counter.increment();
  await Counter.increment();
  await Counter.increment();
  const current = await Counter.getValue();
  console.log('Current value:', current.value);

  await Counter.reset();

  // Deterministically detach the listener via the handle
  await handle.remove();
}

run().catch((err) => {
  console.error(err);
});
