const { google } = require("googleapis");

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // .env stores the key with literal \n sequences — convert them to real newlines
    private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

module.exports = { sheets, GOOGLE_SHEET_ID };
