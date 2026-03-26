const express = require("express");
const { createClient } = require("redis");

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const redis = createClient({ url: REDIS_URL });

redis.on("error", (err) => console.error("Redis error:", err));

(async () => {
  await redis.connect();
  console.log("Connected to Redis");
})();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderKioskPage({ message = "", order = null, formValues = {} } = {}) {
  const clientOrderId = formValues.clientOrderId || `kiosk-ui-${Date.now()}`;
  const item = formValues.item || "";
  const quantity = formValues.quantity || 1;

  return `
    <html>
      <head>
        <title>Campus Kiosk</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 700px;
            margin: 40px auto;
            line-height: 1.5;
          }
          input, button {
            padding: 8px;
            margin: 6px 0;
            width: 100%;
            box-sizing: border-box;
          }
          .box {
            border: 1px solid #ccc;
            padding: 16px;
            border-radius: 8px;
            margin-top: 20px;
          }
          .success {
            background: #f3fff3;
          }
          .duplicate {
            background: #fff8e6;
          }
          a {
            display: inline-block;
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <h1>Campus Snack Kiosk</h1>
        <p>Place an order below. Keep the same clientOrderId to simulate a retry or duplicate.</p>

        <form method="POST" action="/orders/form">
          <label>Client Order ID</label>
          <input
            type="text"
            name="clientOrderId"
            value="${escapeHtml(clientOrderId)}"
            required
          />

          <label>Item</label>
          <input
            type="text"
            name="item"
            value="${escapeHtml(item)}"
            placeholder="iced-latte"
            required
          />

          <label>Quantity</label>
          <input
            type="number"
            name="quantity"
            min="1"
            value="${escapeHtml(quantity)}"
            required
          />

          <button type="submit">Submit Order</button>
        </form>

        <a href="/dashboard">Open Monitoring Dashboard</a>

        ${
          message
            ? `<div class="box ${order && order.duplicate ? "duplicate" : "success"}">
                <h2>${escapeHtml(message)}</h2>
                ${
                  order
                    ? `
                    <p><strong>clientOrderId:</strong> ${escapeHtml(order.clientOrderId)}</p>
                    <p><strong>item:</strong> ${escapeHtml(order.item)}</p>
                    <p><strong>quantity:</strong> ${escapeHtml(order.quantity)}</p>
                    <p><strong>status:</strong> ${escapeHtml(order.status)}</p>
                    <p><strong>duplicate:</strong> ${escapeHtml(order.duplicate)}</p>
                    <p><strong>createdAt:</strong> ${escapeHtml(order.createdAt || "")}</p>
                    `
                    : ""
                }
              </div>`
            : ""
        }
      </body>
    </html>
  `;
}

function renderDashboard(orders) {
  const rows = orders
    .map((order) => {
      return `
        <tr>
          <td>${escapeHtml(order.clientOrderId)}</td>
          <td>${escapeHtml(order.item)}</td>
          <td>${escapeHtml(order.quantity)}</td>
          <td>${escapeHtml(order.status)}</td>
          <td>${escapeHtml(order.duplicate)}</td>
          <td>${escapeHtml(order.createdAt || "")}</td>
          <td>${escapeHtml(order.processingStartedAt || "")}</td>
          <td>${escapeHtml(order.completedAt || "")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <title>Monitoring Dashboard</title>
        <meta http-equiv="refresh" content="3" />
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f4f4f4;
          }
          a {
            display: inline-block;
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <h1>Monitoring Dashboard</h1>
        <p>This page refreshes every 3 seconds.</p>
        <a href="/">Back to Kiosk Page</a>

        <table>
          <thead>
            <tr>
              <th>Client Order ID</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>Status</th>
              <th>Duplicate</th>
              <th>Created</th>
              <th>Processing Started</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="8">No orders yet</td></tr>'}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

async function createOrReuseOrder({ clientOrderId, item, quantity }) {
  if (!clientOrderId || !item || !quantity) {
    return {
      statusCode: 400,
      body: { error: "Missing fields" }
    };
  }

  const key = `order:${clientOrderId}`;
  const existing = await redis.get(key);

  if (existing) {
    const order = JSON.parse(existing);
    return {
      statusCode: 200,
      body: {
        ...order,
        duplicate: true
      }
    };
  }

  const order = {
    clientOrderId,
    item,
    quantity: Number(quantity),
    status: "queued",
    duplicate: false,
    createdAt: new Date().toISOString()
  };

  await redis.set(key, JSON.stringify(order));
  await redis.rPush("queue:orders", clientOrderId);
  await redis.lPush("orders:recent", clientOrderId);
  await redis.lTrim("orders:recent", 0, 49);

  return {
    statusCode: 202,
    body: order
  };
}

app.get("/", (req, res) => {
  res.send(renderKioskPage());
});

app.post("/orders", async (req, res) => {
  try {
    const result = await createOrReuseOrder(req.body);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/orders/form", async (req, res) => {
  try {
    const result = await createOrReuseOrder(req.body);

    if (result.statusCode === 400) {
      return res
        .status(400)
        .send(
          renderKioskPage({
            message: "Invalid input",
            formValues: req.body
          })
        );
    }

    const message =
      result.statusCode === 202
        ? "New order accepted and queued"
        : "Duplicate order recognized safely";

    res.send(
      renderKioskPage({
        message,
        order: result.body,
        formValues: {
          clientOrderId: result.body.clientOrderId,
          item: result.body.item,
          quantity: result.body.quantity
        }
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("<h1>Internal server error</h1>");
  }
});

app.get("/orders/:id", async (req, res) => {
  try {
    const key = `order:${req.params.id}`;
    const data = await redis.get(key);

    if (!data) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(JSON.parse(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/dashboard", async (req, res) => {
  try {
    const recentIds = await redis.lRange("orders:recent", 0, 49);
    const uniqueIds = [...new Set(recentIds)];

    const orders = [];
    for (const id of uniqueIds) {
      const raw = await redis.get(`order:${id}`);
      if (raw) {
        orders.push(JSON.parse(raw));
      }
    }

    res.send(renderDashboard(orders));
  } catch (err) {
    console.error(err);
    res.status(500).send("<h1>Internal server error</h1>");
  }
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});