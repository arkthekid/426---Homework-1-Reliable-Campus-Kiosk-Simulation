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
        <title>Campus Snack Kiosk</title>
        <style>
          body {
            font-family: "Helvetica Neue", Arial, sans-serif;
            background: #f7f5fb;
            margin: 0;
            padding: 40px 20px;
            line-height: 1.5;
            color: #2f2a3a;
          }
          .container {
            max-width: 760px;
            margin: 0 auto;
            background: #ffffff;
            padding: 32px;
            border-radius: 18px;
            box-shadow: 0 10px 26px rgba(91, 75, 112, 0.12);
          }
          h1 {
            margin-top: 0;
            margin-bottom: 12px;
            font-size: 32px;
          }
          p {
            margin-bottom: 20px;
          }
          label {
            display: block;
            font-weight: 600;
            margin-top: 14px;
            margin-bottom: 6px;
          }
          input, button {
            width: 100%;
            box-sizing: border-box;
            padding: 10px 12px;
            border-radius: 10px;
            border: 1px solid #d8d2e3;
            font-size: 15px;
          }
          input {
            margin-bottom: 6px;
          }
          button {
            margin-top: 14px;
            border: none;
            background: #b8a2e3;
            color: white;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s ease;
          }
          button:hover {
            background: #a48ad9;
          }
          .box {
            border: 1px solid #ddd6ea;
            padding: 18px;
            border-radius: 14px;
            margin-top: 24px;
            box-shadow: 0 4px 14px rgba(91, 75, 112, 0.06);
          }
          .success {
            background: #eefbf3;
          }
          .duplicate {
            background: #fff7ed;
          }
          a {
            display: inline-block;
            margin-top: 18px;
            color: #6b4fb3;
            font-weight: 600;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          .footer {
            margin-top: 28px;
            font-size: 13px;
            color: #7a728a;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Campus Snack Kiosk</h1>
          <p>Place an order below.</p>

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

          <div class="footer">My Demo</div>
        </div>
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
        <title>Order Monitoring Dashboard</title>
        <meta http-equiv="refresh" content="3" />
        <style>
          body {
            font-family: "Helvetica Neue", Arial, sans-serif;
            background: #f7f5fb;
            margin: 0;
            padding: 40px 20px;
            color: #2f2a3a;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 32px;
            border-radius: 18px;
            box-shadow: 0 10px 26px rgba(91, 75, 112, 0.12);
          }
          h1 {
            margin-top: 0;
            margin-bottom: 12px;
            font-size: 32px;
          }
          p {
            margin-bottom: 16px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 20px;
            overflow: hidden;
            border-radius: 12px;
          }
          th, td {
            border: 1px solid #e7e1f1;
            padding: 10px;
            text-align: left;
            vertical-align: top;
            font-size: 14px;
          }
          th {
            background: #ece4fb;
            font-weight: 700;
          }
          tr:nth-child(even) {
            background: #faf8fe;
          }
          a {
            display: inline-block;
            margin-top: 10px;
            color: #6b4fb3;
            font-weight: 600;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          .footer {
            margin-top: 24px;
            font-size: 13px;
            color: #7a728a;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Order Monitoring Dashboard</h1>
          <p>This page refreshes every 3 seconds so order progress can be observed live.</p>
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

          <div class="footer">Reliable campus kiosk demo</div>
        </div>
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
        ? "Order accepted and added to the queue"
        : "Retry detected: existing order reused safely";

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