const express = require('express');
const cookieParser = require('cookie-parser');
const PocketBase = require('pocketbase').default;

const app = express();
const PORT = 3000;

// Configure Express to parse cookies
app.use(cookieParser());

// SSR Authentication Synchronization Middleware
app.use(async (req, res, next) => {
  const pb = new PocketBase('http://127.0.0.1:8090');

  // Extract the PocketBase auth cookie (pb_auth) from the incoming request's Cookie header
  const cookieHeader = req.headers.cookie || '';
  pb.authStore.loadFromCookie(cookieHeader);

  try {
    // Attempt to refresh the authentication state if the store is valid
    if (pb.authStore.isValid) {
      await pb.collection('users').authRefresh();
    } else {
      // If the loaded store is already invalid, explicitly clear it to remove any invalid token
      pb.authStore.clear();
    }
  } catch (error) {
    // Clear the auth store in case of invalid/expired token or refresh failure
    pb.authStore.clear();
  }

  // Export the updated auth state back to a cookie and attach it to the response headers
  res.setHeader('Set-Cookie', pb.authStore.exportToCookie());

  // Attach the PocketBase instance to the request object for downstream handlers
  req.pb = pb;

  next();
});

// Protected route GET /profile
app.get('/profile', (req, res) => {
  if (req.pb.authStore.isValid && req.pb.authStore.record) {
    return res.status(200).json({
      id: req.pb.authStore.record.id,
      email: req.pb.authStore.record.email
    });
  }

  return res.status(401).json({
    error: 'Unauthorized'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
