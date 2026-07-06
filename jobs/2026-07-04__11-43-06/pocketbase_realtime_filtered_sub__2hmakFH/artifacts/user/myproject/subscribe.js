#!/usr/bin/env node
// subscribe.js
//
// CLI that opens a server-side filtered realtime SSE subscription on the
// PocketBase `messages` collection and prints one JSON line per event to
// stdout.
//
// Usage:
//   node subscribe.js --chat <chatId>

// Node.js does not provide a global EventSource, but the PocketBase
// realtime client uses it for the SSE connection. Install the `eventsource`
// polyfill on `globalThis` before importing the SDK so the SDK can pick it
// up.
import { EventSource as NodeEventSource } from 'eventsource';
if (typeof globalThis.EventSource === 'undefined') {
    globalThis.EventSource = NodeEventSource;
}

import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

// --- Tiny logger that only ever touches stderr -----------------------------
function logErr(...parts) {
    process.stderr.write(
        parts
            .map((p) => (typeof p === 'string' ? p : JSON.stringify(p)))
            .join(' ') + '\n',
    );
}

// --- Parse CLI args --------------------------------------------------------
function parseArgs(argv) {
    const args = { chat: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--chat') {
            const v = argv[i + 1];
            if (!v || v.startsWith('--')) {
                throw new Error('Missing value for --chat');
            }
            args.chat = v;
            i++;
        } else if (a === '-h' || a === '--help') {
            args.help = true;
        } else {
            throw new Error(`Unknown argument: ${a}`);
        }
    }
    return args;
}

function usage() {
    process.stderr.write(
        'Usage: node subscribe.js --chat <chatId>\n' +
            'Connects to PocketBase and streams realtime events from the\n' +
            '`messages` collection whose `chat` field equals <chatId>.\n',
    );
}

// --- Validate env ----------------------------------------------------------
function requireEnv(name) {
    const v = process.env[name];
    if (!v || !v.length) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return v;
}

// --- Sanitize chat id for PocketBase filter expression --------------------
// We only allow "safe" characters in the chat id so that the PocketBase
// filter string is well-formed and cannot be broken out of.
function isSafeChatId(id) {
    if (typeof id !== 'string') return false;
    if (id.length === 0 || id.length > 256) return false;
    return /^[A-Za-z0-9_\-:.]+$/.test(id);
}

// --- Main ------------------------------------------------------------------
async function main() {
    let args;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (err) {
        logErr(err.message);
        usage();
        process.exit(2);
    }

    if (args.help || !args.chat) {
        usage();
        process.exit(args.help ? 0 : 2);
    }

    if (!isSafeChatId(args.chat)) {
        logErr(
            'Invalid --chat value: must be 1-256 chars of [A-Za-z0-9_\\-:.]',
        );
        process.exit(2);
    }

    const email = requireEnv('PB_ADMIN_EMAIL');
    const password = requireEnv('PB_ADMIN_PASSWORD');

    // Keep stdout unbuffered so each event line is flushed immediately.
    if (process.stdout._handle && typeof process.stdout._handle.setBlocking === 'function') {
        try { process.stdout._handle.setBlocking(true); } catch (_) { /* ignore */ }
    }
    // Belt-and-suspenders: write directly to fd 1 with no buffering.
    const writeLine = (obj) => {
        const line = JSON.stringify(obj) + '\n';
        try {
            process.stdout.write(line);
        } catch (err) {
            logErr('Failed to write to stdout:', err.message);
        }
    };

    // Construct PocketBase client.
    const pb = new PocketBase(PB_URL);

    // Track our resources so SIGTERM can clean them up.
    let unsubscribe = null;
    let shuttingDown = false;
    let exited = false;

    const shutdown = async (code) => {
        if (exited) return;
        exited = true;
        shuttingDown = true;
        try {
            if (typeof unsubscribe === 'function') {
                try {
                    await unsubscribe();
                } catch (err) {
                    logErr('Error while unsubscribing:', err.message);
                }
                unsubscribe = null;
            }
        } catch (_) { /* ignore */ }
        try {
            pb.realtime.disconnect();
        } catch (_) { /* ignore */ }
        // Best-effort cancel any pending requests.
        try { pb.cancelAllRequests(); } catch (_) { /* ignore */ }
        process.exit(code);
    };

    const onSigterm = () => {
        // Must finish within 3 seconds; force-exit on timeout.
        const timer = setTimeout(() => {
            logErr('Forced exit after 3s shutdown timeout');
            process.exit(0);
        }, 3000);
        if (typeof timer.unref === 'function') timer.unref();
        shutdown(0).catch((err) => {
            logErr('Shutdown error:', err.message);
            process.exit(0);
        });
    };

    process.on('SIGTERM', onSigterm);
    process.on('SIGINT', onSigterm);

    // Authenticate as superuser.
    try {
        await pb.admins.authWithPassword(email, password);
    } catch (err) {
        logErr(
            'Failed to authenticate as superuser:',
            err && err.status ? `${err.status}` : '',
            err && err.message ? err.message : String(err),
        );
        process.exit(1);
    }

    // Build a server-side filter expression for the chat id.
    // Using the SDK's filter helper ensures proper string escaping.
    const filterExpr = pb.filter('chat={:chat}', { chat: args.chat });

    // Subscribe to all events on the messages collection, filtered
    // server-side by `chat` field.
    try {
        unsubscribe = await pb.collection('messages').subscribe(
            '*',
            (event) => {
                if (shuttingDown || exited) return;
                if (!event || typeof event !== 'object') return;
                const action = event.action;
                const record = event.record;
                if (!action || !record) return;
                if (
                    action !== 'create' &&
                    action !== 'update' &&
                    action !== 'delete'
                ) {
                    return;
                }
                writeLine({ action, record });
            },
            {
                filter: filterExpr,
            },
        );
    } catch (err) {
        logErr(
            'Failed to subscribe to messages:',
            err && err.status ? `${err.status}` : '',
            err && err.message ? err.message : String(err),
        );
        process.exit(1);
    }

    // Watch for unhandled async errors so we surface them rather than dying
    // silently.
    process.on('unhandledRejection', (reason) => {
        if (shuttingDown || exited) return;
        logErr('Unhandled rejection:', reason && reason.message ? reason.message : String(reason));
    });
}

main().catch((err) => {
    logErr('Fatal error:', err && err.message ? err.message : String(err));
    process.exit(1);
});