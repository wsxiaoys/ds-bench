const fs = require('fs');
const { createTRPCProxyClient, httpSubscriptionLink } = require('@trpc/client');

const LOG_PATH = '/home/user/project/output.log';
const OUTPUT_PATH = '/home/user/project/output.json';

const logLine = (message) => {
  const line = `[client] ${new Date().toISOString()} ${message}`;
  fs.appendFileSync(LOG_PATH, `${line}\n`);
  console.log(line);
};

const client = createTRPCProxyClient({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000/trpc',
      EventSource: require('eventsource'),
    }),
  ],
});

const run = async () => {
  const values = [];

  await new Promise((resolve, reject) => {
    const subscription = client.countdown.subscribe(undefined, {
      onData(data) {
        values.push(data);
        logLine(`received ${data}`);
      },
      onError(error) {
        logLine(`subscription error: ${error?.message || error}`);
        subscription?.unsubscribe();
        reject(error);
      },
      onComplete() {
        logLine('subscription complete');
        resolve();
      },
    });
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(values));
  logLine(`wrote ${values.length} values to ${OUTPUT_PATH}`);
};

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
