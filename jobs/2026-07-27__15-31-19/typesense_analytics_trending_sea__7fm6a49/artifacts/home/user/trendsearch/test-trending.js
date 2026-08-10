const PORT = 3000;

async function run() {
  console.log('Sending search queries with different user-ids...');
  
  // To avoid the 4-second type-ahead pause restriction, we use different X-TYPESENSE-USER-ID.
  // Let's send searches for "laptop" (3 times)
  for (let i = 1; i <= 3; i++) {
    await fetch(`http://127.0.0.1:${PORT}/api/search?q=laptop`, {
      headers: {
        'X-Forwarded-For': `1.1.1.${i}`
      }
    });
  }

  // Let's send searches for "camera" (2 times)
  for (let i = 1; i <= 2; i++) {
    await fetch(`http://127.0.0.1:${PORT}/api/search?q=camera`, {
      headers: {
        'X-Forwarded-For': `2.2.2.${i}`
      }
    });
  }

  console.log('Queries sent. Now waiting 65 seconds for Typesense to flush analytics...');
  
  let timeLeft = 65;
  const interval = setInterval(() => {
    timeLeft -= 5;
    if (timeLeft > 0) {
      console.log(`${timeLeft} seconds remaining...`);
    } else {
      clearInterval(interval);
    }
  }, 5000);

  await new Promise(resolve => setTimeout(resolve, 65000));

  console.log('Fetching trending searches...');
  const res = await fetch(`http://127.0.0.1:${PORT}/api/trending`);
  const data = await res.json();
  console.log('Trending results:', JSON.stringify(data));
}

run().catch(console.error);
