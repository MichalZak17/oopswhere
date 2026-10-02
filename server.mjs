// Production entry (Docker / Coolify): the Astro Node server plus a graceful shutdown.
//
// On a redeploy Coolify starts the new container, waits for its health check, then stops
// the old one with SIGTERM. Node running as PID 1 ignores SIGTERM unless it handles it,
// so without this the old container would hang for the grace period and then be killed
// mid-request. Here it stops accepting connections, lets in-flight requests finish
// (each is bounded by the USOS timeouts) and exits.
process.env.ASTRO_NODE_AUTOSTART = "disabled";
const { startServer } = await import("./dist/server/entry.mjs");

const { server } = startServer();
const http = server.server;
const GRACE_MS = 8_000; // under Docker's default 10 s stop timeout

let stopping = false;
function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`${signal} received, draining connections`);
    // close() stops listening and drops idle keep-alive sockets (Node ≥ 19).
    http.close(() => process.exit(0));
    setTimeout(() => {
        http.closeAllConnections();
        process.exit(0);
    }, GRACE_MS).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
