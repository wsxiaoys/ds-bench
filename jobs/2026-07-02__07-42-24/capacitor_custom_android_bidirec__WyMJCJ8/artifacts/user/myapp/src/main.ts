import Counter from './counter';

async function runDriver() {
  console.log('Starting Counter plugin driver...');

  // 1. Subscribe to the 'change' event and store the returned handle
  const handle = await Counter.addListener('change', (state) => {
    console.log(`[Event Listener] Counter value changed to: ${state.value}`);
  });

  // 2. Drive the state with method calls
  console.log('Calling getValue...');
  let current = await Counter.getValue();
  console.log(`Current value (getValue): ${current.value}`);

  console.log('Calling increment...');
  let incremented = await Counter.increment();
  console.log(`Incremented value returned: ${incremented.value}`);

  console.log('Calling increment again...');
  incremented = await Counter.increment();
  console.log(`Incremented value returned: ${incremented.value}`);

  console.log('Calling getValue...');
  current = await Counter.getValue();
  console.log(`Current value (getValue): ${current.value}`);

  console.log('Calling reset...');
  const resetVal = await Counter.reset();
  console.log(`Reset value returned: ${resetVal.value}`);

  // 3. Deterministically detach the listener using .remove()
  console.log('Detaching event listener using handle.remove()...');
  await handle.remove();

  console.log('Driver run completed successfully.');
}

runDriver().catch((err) => {
  console.error('Error during driver execution:', err);
});
