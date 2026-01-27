import express from "express";
import jwt from "jsonwebtoken";

import { findOrCreateGitHubUser } from "../models/User.js";

const router = express.Router();

// src/utils/auth.js



router.get("/github", (req, res) => {
  const redirectUri =
    "https://github.com/login/oauth/authorize" +
    `?client_id=${process.env.GITHUB_CLIENT_ID}` +
    `&scope=read:user`;

  res.redirect(redirectUri);
});

router.get("/github/callback", async (req, res) => {
  const { code } = req.query;

  try {
    // 1️⃣ Exchange code for access token
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2️⃣ Fetch GitHub user profile
    const profileRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const profile = await profileRes.json();

    // 3️⃣ Find or create user
    const user = await findOrCreateGitHubUser(profile);

    // 4️⃣ Issue JWT
    const jwtToken = jwt.sign(
      {
        id: user._id,
        name: user.name || user.login,
        avatar: user.avatar,
        color: user.color,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 5️⃣ Redirect back to frontend with token
    const frontendUrl = process.env.FRONTEND_URL;
    res.redirect(
      `${frontendUrl}/auth/success?token=${jwtToken}`
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth failed");
  }
});

router.get("/me", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    res.json({
      id: decoded.id,
      name: decoded.name,
      avatar: decoded.avatar,
      color: decoded.color,
    });

  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
});



export default router;
