import { ObjectId } from "mongodb";
import { getDB } from "../db.js";
function generateColor() {
  const colors = [
    "#4ade80", "#60a5fa", "#f472b6",
    "#facc15", "#fb7185", "#34d399",
    "#a78bfa", "#f97316"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export async function findOrCreateGitHubUser(profile) {
  const db = await getDB();
  const users = db.collection("users");

  let user = await users.findOne({ githubId: profile.id });

  if (!user) {
    user = {
      githubId: profile.id,
      name: profile.name || profile.login,
      username: profile.login,
      avatar: profile.avatar_url,
      color: generateColor(),
      createdAt: new Date(),
    };

    const result = await users.insertOne(user);
    user._id = result.insertedId;
  }

  return user;
}
