require("dotenv").config();

const {
  sheets,
  GOOGLE_SHEET_ID,
} = require("./googleSheets3");

async function testGoogleSheet() {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID,
    });

    console.log("SUCCESS!");
    console.log(
      "Connected Google Sheet:",
      response.data.properties.title
    );

    console.log("\nAvailable sheets:");

    response.data.sheets.forEach((sheet) => {
      console.log(
        "-",
        sheet.properties.title
      );
    });

  } catch (error) {
    console.error(
      "Google Sheet connection failed:",
      error.message
    );
  }
}

testGoogleSheet();