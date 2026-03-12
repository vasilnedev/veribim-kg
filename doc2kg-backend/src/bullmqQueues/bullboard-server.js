import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { graphQueue } from "./graphQueue.js";

const port = 80 // Run on the standard http port

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/doc2kg-bullboard");

createBullBoard({
  queues: [new BullMQAdapter(graphQueue)],
  serverAdapter
});

const app = express();
app.use("/doc2kg-bullboard", serverAdapter.getRouter());

app.listen(port, () => {
  console.log(`Bull Board running on port ${port}`);
});