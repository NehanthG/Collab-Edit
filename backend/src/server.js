import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import { getDB } from "./db.js";

const PORT = process.env.PORT || 1234;

const server = new Server({
  port: PORT,

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
console.log(`🚀 Hocuspocus running on port ${PORT}`);
