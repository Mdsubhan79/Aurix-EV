require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { Server } = require("socket.io");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { sheets, GOOGLE_SHEET_ID } = require("./googleSheets");

/* =========================================================================
   1. CLOUDINARY CONFIG
========================================================================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const scooterStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "voltline/scooters",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 900, height: 900, crop: "limit", quality: "auto" }],
  },
});
const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "voltline/logos",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "limit", quality: "auto" }],
  },
});
const uploadScooterImage = multer({ storage: scooterStorage });
const uploadLogo = multer({ storage: logoStorage });

/* =========================================================================
   2. MONGOOSE MODELS
========================================================================= */
const ownerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);
const Owner = mongoose.model("Owner", ownerSchema);

const businessSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true, unique: true },
    name: { type: String, required: true },
    tagline: { type: String, default: "" },
    address: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    gstin: { type: String, default: "" },
    gstRate: { type: Number, default: 18 },
    logoUrl: { type: String, default: "" },
    logoPublicId: { type: String, default: "" },
  },
  { timestamps: true }
);
const Business = mongoose.model("Business", businessSchema);

const scooterSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true, index: true },
    name: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },
    chassisNo: { type: String, default: "" },
    motorNo: { type: String, default: "" },
    features: { type: String, default: "" },
    warranty: { type: String, default: "" },
    batteryInfo: { type: String, default: "" },
    scooterPrice: { type: Number, default: 0 },
    batteryPrice: { type: Number, default: 0 },
    actualPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    stockStatus: { type: String, enum: ["in_stock", "sold", "service"], default: "in_stock" },
  },
  { timestamps: true }
);
scooterSchema.index({ name: "text", chassisNo: "text", motorNo: "text" });
const Scooter = mongoose.model("Scooter", scooterSchema);

const billItemSchema = new mongoose.Schema(
  {
    scooter: { type: mongoose.Schema.Types.ObjectId, ref: "Scooter" },
    name: String,
    description: { type: String, default: "" },
    chassisNo: { type: String, default: "" },
    motorNo: { type: String, default: "" },
    // vehicle spec fields shown on the printed invoice — all optional
    model: { type: String, default: "" },
    color: { type: String, default: "" },
    batteryType: { type: String, default: "" },
    motorPower: { type: String, default: "" },
    range: { type: String, default: "" },
    topSpeed: { type: String, default: "" },
    chargingTime: { type: String, default: "" },
    controller: { type: String, default: "" },
    wheelSize: { type: String, default: "" },
    actualPrice: { type: Number, default: 0 }, // cost price — internal only, never shown to customer
    sellingPrice: { type: Number, default: 0 }, // GST-INCLUSIVE unit price shown on invoice
    qty: { type: Number, default: 1 },
  },
  { _id: false }
);
const billSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true, index: true },
    invoiceNumber: { type: String, default: "" },
    date: { type: Date, required: true, default: Date.now },
    customerName: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    customerAddress: { type: String, default: "" },
    customerAadhar: { type: String, default: "" },
    location: { type: String, default: "" },
    type: { type: String, enum: ["sale", "service", "repair"], default: "sale" },
    serviceDesc: { type: String, default: "" },
    items: [billItemSchema],
    subtotal: { type: Number, default: 0 },
    gstRate: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMode: { type: String, default: "Cash" },
  },
  { timestamps: true }
);
billSchema.index({ owner: 1, date: -1 });
const Bill = mongoose.model("Bill", billSchema);

const expenseSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true, index: true },
    date: { type: Date, required: true, default: Date.now },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    location: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);
expenseSchema.index({ owner: 1, date: -1 });
const Expense = mongoose.model("Expense", expenseSchema);

const partnerSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    sharePercent: { type: Number, required: true },
  },
  { timestamps: true }
);
const Partner = mongoose.model("Partner", partnerSchema);

/* =========================================================================
   3. HELPERS
========================================================================= */
function signToken(ownerId) {
  return jwt.sign({ ownerId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Not authenticated. Please log in again." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.ownerId = decoded.ownerId;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

function getRangeDates(range) {
  const now = new Date();

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start;

  if (range === "today") {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    // Monday → Sunday
    start = new Date(now);

    const day = start.getDay(); // Sunday=0, Monday=1, ... Saturday=6
    const daysFromMonday = day === 0 ? 6 : day - 1;

    start.setDate(start.getDate() - daysFromMonday);
    start.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
  } else if (range === "year") {
    start = new Date(now.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date(0);
  }

  return { start, end };
}

function formatSheetDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// wraps async route handlers so thrown errors reach the error middleware
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/* =========================================================================
   4. EXPRESS + SOCKET.IO SETUP
========================================================================= */
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "*", methods: ["GET", "POST", "PUT", "DELETE"] },
});

function emitUpdate(event, payload) {
  io.emit(event, payload);
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, service: "voltline-server" }));

/* =========================================================================
   5. AUTH ROUTES
========================================================================= */
app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

    const owner = await Owner.findOne({ email: email.toLowerCase().trim() });
    if (!owner) return res.status(401).json({ message: "Invalid email or password." });

    const valid = await bcrypt.compare(password, owner.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid email or password." });

    const business = await Business.findOne({ owner: owner._id });
    const token = signToken(owner._id);

    res.json({
      token,
      owner: { id: owner._id, name: owner.name, email: owner.email },
      business: business || null,
    });
  })
);

app.get(
  "/api/auth/me",
  requireAuth,
  wrap(async (req, res) => {
    const owner = await Owner.findById(req.ownerId).select("-passwordHash");
    const business = await Business.findOne({ owner: req.ownerId });
    res.json({ owner, business: business || null });
  })
);

/* =========================================================================
   6. BUSINESS ROUTES
========================================================================= */
app.get(
  "/api/business",
  requireAuth,
  wrap(async (req, res) => {
    const business = await Business.findOne({ owner: req.ownerId });
    res.json(business || null);
  })
);

app.post(
  "/api/business",
  requireAuth,
  wrap(async (req, res) => {
    const existing = await Business.findOne({ owner: req.ownerId });
    if (existing) return res.status(400).json({ message: "Business already exists. Use update instead." });
    const business = await Business.create({ ...req.body, owner: req.ownerId });
    emitUpdate("business:updated", business);
    res.status(201).json(business);
  })
);

app.put(
  "/api/business",
  requireAuth,
  wrap(async (req, res) => {
    const business = await Business.findOneAndUpdate(
      { owner: req.ownerId },
      { $set: req.body },
      { new: true, upsert: true }
    );
    emitUpdate("business:updated", business);
    res.json(business);
  })
);

app.post(
  "/api/business/logo",
  requireAuth,
  uploadLogo.single("logo"),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });
    const existing = await Business.findOne({ owner: req.ownerId });
    if (existing?.logoPublicId) await cloudinary.uploader.destroy(existing.logoPublicId).catch(() => {});
    const business = await Business.findOneAndUpdate(
      { owner: req.ownerId },
      { $set: { logoUrl: req.file.path, logoPublicId: req.file.filename } },
      { new: true, upsert: true }
    );
    emitUpdate("business:updated", business);
    res.json(business);
  })
);

/* =========================================================================
   7. SCOOTER CATALOGUE ROUTES
========================================================================= */
app.get(
  "/api/scooters",
  requireAuth,
  wrap(async (req, res) => {
    const { q } = req.query;
    const filter = { owner: req.ownerId };
    if (q) filter.$text = { $search: q };
    const scooters = await Scooter.find(filter).sort({ createdAt: -1 });
    res.json(scooters);
  })
);

app.post(
  "/api/scooters",
  requireAuth,
  wrap(async (req, res) => {
    const scooter = await Scooter.create({ ...req.body, owner: req.ownerId });
    emitUpdate("scooter:created", scooter);
    res.status(201).json(scooter);
  })
);

app.put(
  "/api/scooters/:id",
  requireAuth,
  wrap(async (req, res) => {
    const scooter = await Scooter.findOneAndUpdate(
      { _id: req.params.id, owner: req.ownerId },
      { $set: req.body },
      { new: true }
    );
    if (!scooter) return res.status(404).json({ message: "Scooter not found." });
    emitUpdate("scooter:updated", scooter);
    res.json(scooter);
  })
);

app.delete(
  "/api/scooters/:id",
  requireAuth,
  wrap(async (req, res) => {
    const scooter = await Scooter.findOneAndDelete({ _id: req.params.id, owner: req.ownerId });
    if (!scooter) return res.status(404).json({ message: "Scooter not found." });
    if (scooter.imagePublicId) await cloudinary.uploader.destroy(scooter.imagePublicId).catch(() => {});
    emitUpdate("scooter:deleted", { id: scooter._id });
    res.json({ message: "Scooter deleted.", id: scooter._id });
  })
);

app.post(
  "/api/scooters/:id/image",
  requireAuth,
  uploadScooterImage.single("image"),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });
    const existing = await Scooter.findOne({ _id: req.params.id, owner: req.ownerId });
    if (!existing) return res.status(404).json({ message: "Scooter not found." });
    if (existing.imagePublicId) await cloudinary.uploader.destroy(existing.imagePublicId).catch(() => {});
    const scooter = await Scooter.findOneAndUpdate(
      { _id: req.params.id, owner: req.ownerId },
      { $set: { imageUrl: req.file.path, imagePublicId: req.file.filename } },
      { new: true }
    );
    emitUpdate("scooter:updated", scooter);
    res.json(scooter);
  })
);

/* =========================================================================
   8. BILLING ROUTES
========================================================================= */
app.get(
  "/api/bills",
  requireAuth,
  wrap(async (req, res) => {
    const { range, from, to, location } = req.query;
    const filter = { owner: req.ownerId };
    if (range) {
      const { start, end } = getRangeDates(range);
      filter.date = { $gte: start, $lte: end };
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    if (location) filter.location = location;
    const bills = await Bill.find(filter).sort({ date: -1 });
    res.json(bills);
  })
);

function computeBillTotals(body) {
  const grandTotal = (body.items || []).reduce((s, it) => s + Number(it.sellingPrice || 0) * Number(it.qty || 1), 0);
  const rate = Number(body.gstRate) || 0;
  const gstAmount = rate > 0 ? +((grandTotal * rate) / (100 + rate)).toFixed(2) : 0;
  const subtotal = +(grandTotal - gstAmount).toFixed(2);
  const total = +grandTotal.toFixed(2);
  return { subtotal, gstAmount, total };
}

async function nextInvoiceNumber(ownerId, dateStr) {
  const year = new Date(dateStr || Date.now()).getFullYear();
  const countThisYear = await Bill.countDocuments({
    owner: ownerId,
    invoiceNumber: { $regex: `^INV/${year}/` },
  });
  return `INV/${year}/${String(countThisYear + 1).padStart(4, "0")}`;
}

app.post(
  "/api/bills",
  requireAuth,
  wrap(async (req, res) => {
    const body = req.body;
    const { subtotal, gstAmount, total } = computeBillTotals(body);
    const invoiceNumber = await nextInvoiceNumber(req.ownerId, body.date);
    const bill = await Bill.create({ ...body, owner: req.ownerId, subtotal, gstAmount, total, invoiceNumber });
    emitUpdate("bill:created", bill);
    res.status(201).json(bill);
  })
);

app.put(
  "/api/bills/:id",
  requireAuth,
  wrap(async (req, res) => {
    const body = req.body;
    const { subtotal, gstAmount, total } = computeBillTotals(body);
    const bill = await Bill.findOneAndUpdate(
      { _id: req.params.id, owner: req.ownerId },
      { $set: { ...body, subtotal, gstAmount, total } },
      { new: true }
    );
    if (!bill) return res.status(404).json({ message: "Bill not found." });
    emitUpdate("bill:updated", bill);
    res.json(bill);
  })
);

app.delete(
  "/api/bills/:id",
  requireAuth,
  wrap(async (req, res) => {
    const bill = await Bill.findOneAndDelete({ _id: req.params.id, owner: req.ownerId });
    if (!bill) return res.status(404).json({ message: "Bill not found." });
    emitUpdate("bill:deleted", { id: bill._id });
    res.json({ message: "Bill deleted.", id: bill._id });
  })
);

/* =========================================================================
   9. EXPENSE ROUTES
========================================================================= */
app.get(
  "/api/expenses",
  requireAuth,
  wrap(async (req, res) => {
    const { range } = req.query;
    const filter = { owner: req.ownerId };
    if (range) {
      const { start, end } = getRangeDates(range);
      filter.date = { $gte: start, $lte: end };
    }
    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.json(expenses);
  })
);

app.post(
  "/api/expenses",
  requireAuth,
  wrap(async (req, res) => {
    const expense = await Expense.create({ ...req.body, owner: req.ownerId });
    emitUpdate("expense:created", expense);
    res.status(201).json(expense);
  })
);

app.delete(
  "/api/expenses/:id",
  requireAuth,
  wrap(async (req, res) => {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, owner: req.ownerId });
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    emitUpdate("expense:deleted", { id: expense._id });
    res.json({ message: "Expense deleted.", id: expense._id });
  })
);

/* =========================================================================
   10. PARTNER ROUTES
========================================================================= */
app.get(
  "/api/partners",
  requireAuth,
  wrap(async (req, res) => {
    const partners = await Partner.find({ owner: req.ownerId }).sort({ createdAt: 1 });
    res.json(partners);
  })
);

app.post(
  "/api/partners",
  requireAuth,
  wrap(async (req, res) => {
    const partner = await Partner.create({ ...req.body, owner: req.ownerId });
    emitUpdate("partner:created", partner);
    res.status(201).json(partner);
  })
);

app.delete(
  "/api/partners/:id",
  requireAuth,
  wrap(async (req, res) => {
    const partner = await Partner.findOneAndDelete({ _id: req.params.id, owner: req.ownerId });
    if (!partner) return res.status(404).json({ message: "Partner not found." });
    emitUpdate("partner:deleted", { id: partner._id });
    res.json({ message: "Partner deleted.", id: partner._id });
  })
);
/* =========================================================================
   11. DASHBOARD ANALYTICS
======================================================================== */

app.get(
  "/api/dashboard/summary",
  requireAuth,
  wrap(async (req, res) => {
    const range = req.query.range || "month";

    const { start, end } = getRangeDates(range);

    const owner = req.ownerId;

    const bills = await Bill.find({
      owner,
      date: {
        $gte: start,
        $lte: end,
      },
    }).sort({ date: -1 });

    const expenses = await Expense.find({
      owner,
      date: {
        $gte: start,
        $lte: end,
      },
    }).sort({ date: -1 });

    /* =========================
       TOTAL SALES
    ========================= */

    const totalSales = bills.reduce(
      (sum, bill) => {
        return sum + Number(bill.total || 0);
      },
      0
    );

    /* =========================
       GROSS PROFIT
    ========================= */

    const grossProfit = bills.reduce(
      (total, bill) => {
        const billProfit = (bill.items || []).reduce(
          (sum, item) => {
            const profit =
              (Number(item.sellingPrice || 0) -
                Number(item.actualPrice || 0)) *
              Number(item.qty || 1);

            return sum + profit;
          },
          0
        );

        return total + billProfit;
      },
      0
    );

    /* =========================
       TOTAL EXPENSES
    ========================= */

    const totalExpenses = expenses.reduce(
      (sum, expense) => {
        return sum + Number(expense.amount || 0);
      },
      0
    );

    /* =========================
       NET PROFIT
    ========================= */

    const netProfit =
      grossProfit - totalExpenses;

    /* =========================
       SALES BY LOCATION
    ========================= */

    const locationMap = {};

    bills.forEach((bill) => {
      const location =
        bill.location || "Unspecified";

      locationMap[location] =
        (locationMap[location] || 0) +
        Number(bill.total || 0);
    });

    const locations = Object.entries(locationMap)
      .map(([location, total]) => ({
        location,
        total,
      }))
      .sort((a, b) => b.total - a.total);

    /* =========================
       RESPONSE
    ========================= */

    res.json({
      range,

      billCount: bills.length,

      totalSales,

      grossProfit,

      totalExpenses,

      netProfit,

      locations,

      recentBills: bills.slice(0, 6),
    });
  })
);
/* =========================================================================
   11. GOOGLE SHEETS EXPORT
========================================================================= */
async function ensureSheetTab(title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
  const exists = meta.data.sheets.some((s) => s.properties.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
}

async function writeSheetTab(title, rows) {
  await ensureSheetTab(title);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${title}!A:Z`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${title}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}
/* =========================================================================
   11A. COMPLETE GOOGLE SHEET EXPORT
======================================================================== */
app.post(
  "/api/reports/export-complete",
  requireAuth,
  wrap(async (req, res) => {
    if (!GOOGLE_SHEET_ID) {
      return res.status(500).json({
        message: "GOOGLE_SHEET_ID is not configured on the server.",
      });
    }

    const ownerId = req.ownerId;

    const [
      business,
      bills,
      expenses,
      partners,
      scooters
    ] = await Promise.all([
      Business.findOne({ owner: ownerId }),
      Bill.find({ owner: ownerId }).sort({ date: -1 }),
      Expense.find({ owner: ownerId }).sort({ date: -1 }),
      Partner.find({ owner: ownerId }).sort({ createdAt: 1 }),
      Scooter.find({ owner: ownerId }).sort({ createdAt: -1 }),
    ]);

    /* ============================================================
       DASHBOARD
    ============================================================ */

    const totalSales = bills.reduce(
      (sum, bill) => sum + Number(bill.total || 0),
      0
    );

    const grossProfit = bills.reduce(
      (sum, bill) =>
        sum +
        (bill.items || []).reduce(
          (itemSum, item) =>
            itemSum +
            (Number(item.sellingPrice || 0) -
              Number(item.actualPrice || 0)) *
              Number(item.qty || 1),
          0
        ),
      0
    );

    const totalExpenses = expenses.reduce(
      (sum, expense) =>
        sum + Number(expense.amount || 0),
      0
    );

    const netProfit =
      grossProfit - totalExpenses;

    /* ============================================================
       BUSINESS
    ============================================================ */

    const businessRows = [
      [
        "Business Name",
        "Tagline",
        "Address",
        "Email",
        "Phone",
        "WhatsApp",
        "GSTIN",
        "GST Rate"
      ],
      [
        business?.name || "",
        business?.tagline || "",
        business?.address || "",
        business?.email || "",
        business?.phone || "",
        business?.whatsapp || "",
        business?.gstin || "",
        business?.gstRate || 0
      ]
    ];

    /* ============================================================
       DASHBOARD
    ============================================================ */

    const dashboardRows = [
      ["Metric", "Value"],
      ["Total Sales", totalSales],
      ["Gross Profit", grossProfit],
      ["Total Expenses", totalExpenses],
      ["Net Profit", netProfit],
      ["Total Bills", bills.length],
      ["Total Scooters", scooters.length],
      ["Total Partners", partners.length],
    ];

    /* ============================================================
       CATALOGUE
    ============================================================ */

    const catalogueRows = [
      [
        "Scooter Name",
        "Chassis Number",
        "Motor Number",
        "Warranty",
        "Features",
        "Battery Info",
        "Scooter Price",
        "Battery Price",
        "Actual Cost Price",
        "Selling Price",
        "Stock Status"
      ],

      ...scooters.map((s) => [
        s.name || "",
        s.chassisNo || "",
        s.motorNo || "",
        s.warranty || "",
        s.features || "",
        s.batteryInfo || "",
        Number(s.scooterPrice || 0),
        Number(s.batteryPrice || 0),
        Number(s.actualPrice || 0),
        Number(s.sellingPrice || 0),
        s.stockStatus || "",
      ])
    ];

    /* ============================================================
       BILLS
    ============================================================ */

    const billRows = [
      [
        "Invoice Number",
        "Date",
        "Customer Name",
        "Customer Phone",
        "Customer Address",
        "Customer Aadhar",
        "Location",
        "Bill Type",
        "Items",
        "Qty",
        "Subtotal",
        "GST Rate",
        "GST Amount",
        "Total",
        "Payment Mode"
      ],

      ...bills.map((b) => [
        b.invoiceNumber || "",
        formatSheetDate(b.date),
        b.customerName || "",
        b.customerPhone || "",
        b.customerAddress || "",
        b.customerAadhar || "",
        b.location || "",
        b.type || "",
        (b.items || [])
          .map(
            (item) =>
              `${item.name || ""} x${item.qty || 1}`
          )
          .join(", "),
        Number(b.subtotal || 0),
        Number(b.gstRate || 0),
        Number(b.gstAmount || 0),
        Number(b.total || 0),
        b.paymentMode || "",
        Number(b.items?.[0]?.qty || 1), 
      ])
    ];

    /* ============================================================
       BILL ITEMS
    ============================================================ */

    const billItemRows = [
      [
        "Invoice Number",
        "Customer Name",
        "Scooter",
        "Chassis Number",
        "Motor Number",
        "Description",
        "Actual Price",
        "Selling Price",
        "Quantity"
      ],

      ...bills.flatMap((b) =>
        (b.items || []).map((item) => [
          b.invoiceNumber || "",
          b.customerName || "",
          item.name || "",
          item.chassisNo || "",
          item.motorNo || "",
          item.description || "",
          Number(item.actualPrice || 0),
          Number(item.sellingPrice || 0),
          Number(item.qty || 1),
        ])
      )
    ];

    /* ============================================================
       EXPENSES
    ============================================================ */

    const expenseRows = [
      [
        "Date",
        "Category",
        "Amount",
        "Location",
        "Note"
      ],

      ...expenses.map((e) => [
        formatSheetDate(e.date),
        e.category || "",
        Number(e.amount || 0),
        e.location || "",
        e.note || "",
      ])
    ];

    /* ============================================================
       PARTNERS
    ============================================================ */

    const partnerRows = [
      [
        "Name",
        "Phone",
        "Share Percentage"
      ],

      ...partners.map((p) => [
        p.name || "",
        p.phone || "",
        Number(p.sharePercent || 0),
      ])
    ];

    /* ============================================================
       CLEAR OLD DATA
    ============================================================ */

    const rangesToClear = [
      "Business!A:Z",
      "Dashboard!A:Z",
      "Catalogue!A:Z",
      "Bills!A:Z",
      "Bill Items!A:Z",
      "Expenses!A:Z",
      "Partners!A:Z",
    ];

    await sheets.spreadsheets.values.batchClear({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        ranges: rangesToClear,
      },
    });

    /* ============================================================
       UPDATE ALL SHEETS
    ============================================================ */

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,

      requestBody: {
        valueInputOption: "USER_ENTERED",

        data: [
          {
            range: "Business!A1",
            values: businessRows,
          },

          {
            range: "Dashboard!A1",
            values: dashboardRows,
          },

          {
            range: "Catalogue!A1",
            values: catalogueRows,
          },

          {
            range: "Bills!A1",
            values: billRows,
          },

          {
            range: "Bill Items!A1",
            values: billItemRows,
          },

          {
            range: "Expenses!A1",
            values: expenseRows,
          },

          {
            range: "Partners!A1",
            values: partnerRows,
          },
        ],
      },
    });

    res.json({
      message: "Complete report exported successfully to Google Sheets.",
      dashboard: {
        totalSales,
        grossProfit,
        totalExpenses,
        netProfit,
      },
      counts: {
        bills: bills.length,
        scooters: scooters.length,
        expenses: expenses.length,
        partners: partners.length,
      },
    });
  })
);
/* =========================================================================
   13. ERROR HANDLING
========================================================================= */
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ message: err.message || "Something went wrong on the server." });
});

/* =========================================================================
   14. BOOT
========================================================================= */
async function seedOwnerIfMissing() {
  const email = (process.env.OWNER_EMAIL || "").toLowerCase().trim();
  if (!email) return;
  const existing = await Owner.findOne({ email });
  if (existing) return;
  const passwordHash = await bcrypt.hash(process.env.OWNER_PASSWORD || "changeme123", 10);
  await Owner.create({ name: process.env.OWNER_NAME || "Owner", email, passwordHash });
  console.log(`Seeded owner account: ${email} (login with OWNER_PASSWORD from .env)`);
}

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");
    await seedOwnerIfMissing();
    server.listen(PORT, () => console.log(`VoltLine server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
