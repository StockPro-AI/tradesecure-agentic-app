void import("./automation-login.mjs").catch((error) => {
  console.error(
    "Login-Automation fehlgeschlagen:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
