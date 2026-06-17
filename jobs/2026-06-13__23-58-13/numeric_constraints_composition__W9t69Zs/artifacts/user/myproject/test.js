for (let i = 0; i < 100000; i++) {
  const n = parseFloat((Math.random() * 10000).toFixed(2));
  if (Math.round(n * 100) / 100 !== n) {
    console.log("Failed for", n);
    process.exit(1);
  }
}
console.log("All passed");
