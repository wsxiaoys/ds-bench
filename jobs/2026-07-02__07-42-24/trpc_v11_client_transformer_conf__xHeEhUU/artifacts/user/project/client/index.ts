import { trpc } from './trpc';

async function main() {
  try {
    const time = await trpc.getServerTime.query();
    if (!(time instanceof Date)) {
      console.error('Expected time to be a Date object, but got:', typeof time, time);
      process.exit(1);
    }
    console.log('Successfully fetched Date object:', time.toISOString());
    process.exit(0);
  } catch (err) {
    console.error('Failed to fetch:', err);
    process.exit(1);
  }
}

main();
