const express = require('express');
const cookieParser = require('cookie-parser');
const PocketBase = require('pocketbase').default;

const app = express();
const PORT = 3000;

// Use cookie-parser middleware
app.use(cookieParser());

// PocketBase Authentication Synchronization Middleware
app.use(async (req, res, next) => {
    // Instantiate a new PocketBase client for each request to ensure isolation
    const pb = new PocketBase('http://127.0.0.1:8090');
    req.pb = pb;

    // Load the auth state from the pb_auth cookie in the request headers
    // loadFromCookie parses the raw cookie header directly
    pb.authStore.loadFromCookie(req.headers.cookie || '');

    try {
        // Attempt to refresh the authentication state if a valid token is loaded
        if (pb.authStore.isValid) {
            await pb.collection('users').authRefresh();
        }
    } catch (err) {
        // Clear the auth store if validation or refresh fails
        pb.authStore.clear();
    }

    // Export the updated auth state to Set-Cookie and attach it to response headers
    // Set secure to false since we are testing locally over HTTP
    res.setHeader('Set-Cookie', pb.authStore.exportToCookie({ secure: false }));

    next();
});

// Protected route GET /profile
app.get('/profile', (req, res) => {
    if (req.pb.authStore.isValid && req.pb.authStore.record) {
        return res.status(200).json({
            id: req.pb.authStore.record.id,
            email: req.pb.authStore.record.email
        });
    } else {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
