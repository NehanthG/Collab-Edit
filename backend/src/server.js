import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import { getDB } from "./db.js";


const server =new Server({
  port: 1234,

  // 1️⃣ LOAD document when room is first accessed
  async onLoadDocument({ documentName }) {
    const db = await getDB();
    const docs = db.collection("documents");

    const record = await docs.findOne({ roomId: documentName });

    const ydoc = new Y.Doc();

    if (record?.ydoc) {
      Y.applyUpdate(ydoc, record.ydoc.buffer);
      console.log("📥 Loaded document:", documentName);
    } else {
      console.log("🆕 New document:", documentName);
    }

    return ydoc;
  },

  // 2️⃣ SAVE document on every update
  async onStoreDocument({ documentName, document }) {
    const db = await getDB();
    const docs = db.collection("documents");

    const update = Y.encodeStateAsUpdate(document);

    await docs.updateOne(
      { roomId: documentName },
      {
        $set: {
          roomId: documentName,
          ydoc: Buffer.from(update),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log("💾 Saved document:", documentName);
  },
});

server.listen();
console.log("🚀 Hocuspocus server running on ws://localhost:1234");

