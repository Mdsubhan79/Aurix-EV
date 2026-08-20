const { google } = require("googleapis");
const path = require("path");

// CHANGE THIS to your exact downloaded Google Service Account JSON filename
const KEY_FILE = path.join(
  __dirname,
  "aurix-ev-54ad72c83457.json"
);

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

module.exports = {
  sheets,
  GOOGLE_SHEET_ID,
};