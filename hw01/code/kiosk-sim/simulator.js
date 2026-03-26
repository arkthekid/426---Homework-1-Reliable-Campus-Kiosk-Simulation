const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const API_BASE = process.env.KIOSK_SIM_API_BASE_URL || "http://api:3000";
const NUM_KIOSKS = Number(process.env.KIOSK_SIM_KIOSKS || 3);
const INTERVAL = Number(process.env.KIOSK_SIM_INTERVAL_MS || 2000);
const REUSE_RATE = Number(process.env.KIOSK_SIM_REUSE_EXISTING_ID_RATE || 0.3);
const STARTUP_DELAY_MS = Number(process.env.KIOSK_SIM_STARTUP_DELAY_MS || 0);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pad(num) {
  return String(num).padStart(4, "0");
}

async function sendOrder(payload) {
  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Request error:", err.message);
    return null;
  }
}

async function runKiosk(kioskId) {
  let counter = 1;
  const history = [];

  while (true) {
    let clientOrderId;

    if (history.length > 0 && Math.random() < REUSE_RATE) {
      clientOrderId = history[Math.floor(Math.random() * history.length)];
      console.log(`${kioskId} RETRYING order ${clientOrderId}`);
    } else {
      clientOrderId = `${kioskId}-${pad(counter++)}`;
      history.push(clientOrderId);
      console.log(`${kioskId} NEW order ${clientOrderId}`);
    }

    const payload = {
      clientOrderId,
      item: "latte",
      quantity: 1
    };

    const result = await sendOrder(payload);

    if (result) {
      console.log(
        `${kioskId} -> status: ${result.status}, duplicate: ${result.duplicate}`
      );
    }

    await sleep(INTERVAL);
  }
}

async function main() {
  console.log("Kiosk simulator started");

  if (STARTUP_DELAY_MS > 0) {
    console.log(
      `Kiosk simulator waiting ${STARTUP_DELAY_MS}ms before starting...`
    );
    await sleep(STARTUP_DELAY_MS);
  }

  const kiosks = [];

  for (let i = 1; i <= NUM_KIOSKS; i++) {
    const KIOSK_PREFIX = process.env.KIOSK_SIM_KIOSK_PREFIX || "kiosk";
    const kioskId = `${KIOSK_PREFIX}-${String(i).padStart(2, "0")}`;
    kiosks.push(runKiosk(kioskId));
  }

  await Promise.all(kiosks);
}

main().catch((err) => {
  console.error("Fatal kiosk-sim error:", err);
  process.exit(1);
});