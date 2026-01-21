import { MongoClient } from "mongodb";
import "dotenv/config";

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = "collab-editor";

let client;
let db;

export async function getDB() {
  if (db) return db;

  client = new MongoClient(MONGO_URL);
  await client.connect();

  db = client.db(DB_NAME);
  console.log("✅ Connected to MongoDB Atlas");

  return db;
}
