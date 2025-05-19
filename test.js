const puppeteer = require("puppeteer-core");
const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Directory for output
const OUTPUT_DIR = path.join(__dirname, "video");

// Function to prompt user for Player ID and Server ID
function askForInput() {
  return new Promise((resolve) => {
    rl.question("Enter Mobile Legends Player ID: ", (playerId) => {
      rl.question("Enter Server ID (e.g., 2001): ", (serverId) => {
        resolve({ playerId: playerId.trim(), serverId: serverId.trim() });
      });
    });
  });
}

async function fetchPlayerInfo() {
  let browser;
  try {
    // Get Player ID and Server ID from user
    const { playerId, serverId } = await askForInput();

    // Validate inputs
    if (!/^\d+$/.test(playerId) || !/^\d+$/.test(serverId)) {
      console.log("❌ Invalid Player ID or Server ID. Both must be numeric.");
      return;
    }

    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Output file path
    const outputFile = path.join(OUTPUT_DIR, `mlbb_player_${Date.now()}.txt`);

    console.log(`Fetching info for Player ID "${playerId}" on Server "${serverId}"...`);

    // Launch headless browser with Termux's firefox
    browser = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/firefox", // Use firefox in Termux
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Navigate to SEAGM top-up page
    await page.goto("https://www.seagm.com/en/mobile-legends-diamonds-top-up", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Enter Player ID and Server ID
    await page.type('input[name="user_id"]', playerId); // Adjust selector
    await page.type('input[name="zone_id"]', serverId); // Adjust selector

    // Submit form (may trigger verification)
    await page.click('button[type="submit"]'); // Adjust selector
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});

    // Scrape username (hypothetical selector)
    const username = await page.evaluate(() => {
      const element = document.querySelector(".username-display"); // Adjust selector
      return element ? element.innerText : "Unknown";
    });

    // Debug: Take screenshot
    const screenshotPath = path.join(OUTPUT_DIR, `debug_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });

    // Format output
    const outputMessage = `
🎮 Mobile Legends Player Info
🆔 Player ID: ${playerId}
🌍 Server: ${serverId}
👤 Username: ${username}
📝 Note: Detailed stats (rank, win rate) are unavailable due to site limitations
    `.trim();

    // Log to console
    console.log(outputMessage);

    // Save to file
    await fs.writeFile(outputFile, outputMessage);
    console.log(`✅ Output saved to ${outputFile}`);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    const errorMessage = `Error fetching player info: ${error.message}`;
    const errorFile = path.join(OUTPUT_DIR, `error_${Date.now()}.txt`);
    await fs.writeFile(errorFile, errorMessage).catch(() => {});
    console.log(`❌ Error saved to ${errorFile}`);
  } finally {
    if (browser) await browser.close();
    rl.close();
  }
}

// Run the fetch function
fetchPlayerInfo();
