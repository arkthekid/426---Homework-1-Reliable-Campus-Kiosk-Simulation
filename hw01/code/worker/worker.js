const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL;
const PROCESSING_DELAY_MS = Number(process.env.PROCESSING_DELAY_MS || 4000);

const redis = createClient({ url: REDIS_URL });

redis.on("error", (err) => {
  console.error("Redis error in worker:", err);
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processOrders() {
  await redis.connect();
  console.log("Worker connected to Redis");

  while (true) {
    try {
      console.log("Worker waiting for next job...");

      const result = await redis.brPop("queue:orders", 0);
      const clientOrderId = result.element;

      console.log(`Worker picked up order ${clientOrderId}`);

      const key = `order:${clientOrderId}`;
      const raw = await redis.get(key);

      if (!raw) {
        console.log(`Order ${clientOrderId} not found in Redis, skipping`);
        continue;
      }

      const order = JSON.parse(raw);

      if (order.status === "completed") {
        console.log(`Order ${clientOrderId} already completed, skipping`);
        continue;
      }

      order.status = "processing";
      order.processingStartedAt = new Date().toISOString();
      await redis.set(key, JSON.stringify(order));

      console.log(`Order ${clientOrderId} is now processing`);

      await sleep(PROCESSING_DELAY_MS);

      order.status = "completed";
      order.completedAt = new Date().toISOString();
      await redis.set(key, JSON.stringify(order));

      console.log(`Order ${clientOrderId} completed`);
    } catch (error) {
      console.error("Worker loop error:", error);
      await sleep(1000);
    }
  }
}

processOrders().catch((error) => {
  console.error("Fatal worker error:", error);
  process.exit(1);
});