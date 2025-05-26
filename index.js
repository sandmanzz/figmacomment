const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cookieParser());

const {
  FIGMA_CLIENT_ID,
  FIGMA_CLIENT_SECRET,
  REDIRECT_URI,
} = process.env;

// Step 1: Redirect user to Figma OAuth
app.get('/api/login', (req, res) => {
  const state = Math.random().toString(36).substring(2); // simple random string
  const authURL = `https://www.figma.com/oauth?client_id=${FIGMA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=file_read&state=${state}&response_type=code`;

  res.redirect(authURL);
});

// Step 2: Figma redirects back with a code
app.get('/api/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing code from Figma');
  }

  try {
    const tokenRes = await axios.post('https://www.figma.com/api/oauth/token', null, {
      params: {
        client_id: FIGMA_CLIENT_ID,
        client_secret: FIGMA_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
        grant_type: 'authorization_code',
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = tokenRes.data;

    // Store token in a cookie for simplicity
    res.cookie('figma_token', access_token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60, // 1 hour
    });

    res.send('✅ Login successful! You can now close this tab and return to the plugin.');
  } catch (err) {
    console.error('Error getting token:', err.response?.data || err.message);
    res.status(500).send('Failed to exchange code for token.');
  }
});

// Step 3: Get comments using Figma REST API
app.get('/api/comments', async (req, res) => {
  const token = req.cookies.figma_token;
  const fileKey = req.query.file_key;

  if (!token) {
    return res.status(401).send('Not logged in. Please log in via /api/login');
  }

  if (!fileKey) {
    return res.status(400).send('Missing file_key parameter');
  }

  try {
    const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}/comments`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error('Error fetching comments:', err.response?.data || err.message);
    res.status(500).send('Failed to fetch comments from Figma.');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
