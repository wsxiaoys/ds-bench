export const myStartupJobFn = async (args, context) => {
  const message = args.message || "Startup job executed";
  console.log(`[myStartupJob] Running background job with message: ${message}`);
  await context.entities.EventLog.create({
    data: {
      message
    }
  });
  console.log("[myStartupJob] EventLog entry created successfully.");
}
