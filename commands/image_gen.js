/**
 * @command
 * name: image_gen
 * title: Anime Image Generator
 * description: Fetch high-quality anime images from Danbooru using tags (e.g., hug, kiss, solo)
 * example: .image_gen hug
 * subcommands:
 *   - cmd: <tag>
 *     desc: Replace `<tag>` with your desired keyword (e.g., `kiss`, `smile`, `blush`)
 */
const { exec } = require("child_process");
const { spawn } = require("child_process");
const util = require("util");
const fs = require("fs").promises;
const path = require("path");

// Promisify exec for async/await
const execPromise = util.promisify(exec);

// Path to JSON file for tracking shown images
const DATA_DIR = path.join(__dirname, "data");
const JSON_FILE = path.join(DATA_DIR, "images_shown.json");

// Function to simulate anime-style dot animation by sending new messages
async function showDotAnimation(XeonBotInc, sender) {
  const dotPatterns = [ ".", "..", "...", "...."];
  let lastMessageId = null;

  for (const dots of dotPatterns) {
    const message = await XeonBotInc.sendMessage(sender, {
      text: `Processing${dots}`,
    });
    
    if (message && message.key && message.key.id) {
      lastMessageId = message.key.id;
    } else {
      console.warn(`Warning: Invalid message key for dots "${dots}"`);
    }
    
    await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay
  }

  return lastMessageId;
}

// Function to read shown images from JSON
async function getShownImages() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const data = await fs.readFile(JSON_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      // File doesn't exist, create empty JSON
      await fs.writeFile(JSON_FILE, "{}");
      return {};
    }
    throw error;
  }
}

// Function to save shown image URL for a tag
async function saveShownImage(tag, url) {
  const shownImages = await getShownImages();
  shownImages[tag] = shownImages[tag] || [];
  shownImages[tag].push(url);
  await fs.writeFile(JSON_FILE, JSON.stringify(shownImages, null, 2));
}

module.exports = {
  name: "image_gen",
  description: "Fetch and send high-quality images from Danbooru based on tags",
  async execute(XeonBotInc, msg) {
    try {
      // Get the sender's details
      const sender = msg.key.remoteJid;

      // Get the command arguments
      const messageContent =
        msg.message.conversation ||
        (msg.message.extendedTextMessage &&
          msg.message.extendedTextMessage.text) ||
        "";

      const args = messageContent.slice(1).trim().split(" ");

      if (args.length < 2) {
        await XeonBotInc.sendMessage(sender, {
          text: "❌ Please provide at least one tag (Example: .image_gen hug kiss)",
        });
        return;
      }

      // Extract tags (up to two)
      const tags = args.slice(1, 3).join("+").toLowerCase();

      // Show typing indicator
      await XeonBotInc.sendPresenceUpdate("composing", sender);

      // Show dot animation (sends new messages)
      const finalMessageId = await showDotAnimation(XeonBotInc, sender);

      // Fetch data from Danbooru API using curl with limit=10
      const apiUrl = `https://danbooru.donmai.us/posts.json?tags=${tags}&limit=10`;
      const apiCommand = `curl -s "${apiUrl}"`;
      const { stdout: apiResponse, stderr: apiError } = await execPromise(apiCommand, {
        maxBuffer: 1024 * 1024 * 10, // 10MB for API response
      });

      if (apiError) {
        throw new Error(`API request failed: ${apiError}`);
      }

      const data = JSON.parse(apiResponse);

      if (!data || data.length === 0) {
        await XeonBotInc.sendMessage(sender, {
          text: "❌ No images found for the provided tags.",
        });
        return;
      }

      // Get shown images for this tag
      const shownImages = await getShownImages();
      const shownUrls = shownImages[tags] || [];

      // Filter for high-quality images (no safe rating requirement)
      const highQualityImages = data.filter(
        (post) =>
          post.score >= 2 && // Good score
          post.file_size >= 10 && // At least 1MB
          post.has_large === true && // High-quality available
          !shownUrls.includes(
            post.media_asset.variants.find((variant) => variant.type === "original")?.url
          ) // Exclude shown images
      );

      if (highQualityImages.length === 0) {
        await XeonBotInc.sendMessage(sender, {
          text:
            "❌ No new high-quality images found matching the criteria (score ≥ 5, size ≥ 1MB).",
        });
        return;
      }

      // Select the best image (highest score, then largest size)
      const selectedImage = highQualityImages.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.file_size - a.file_size;
      })[0];

      const imageUrl = selectedImage.media_asset.variants.find(
        (variant) => variant.type === "original"
      ).url;

      // Log high-quality image selection
      console.log(
        `📥 INCOMING [${sender}]: High-quality image selected for tags "${tags}" (score: ${selectedImage.score}, size: ${selectedImage.file_size} bytes)`
      );

      // Download the image using spawn to stream data
      const curl = spawn("curl", ["-s", imageUrl]);
      const chunks = [];

      // Collect streamed data
      curl.stdout.on("data", (chunk) => {
        chunks.push(chunk);
      });

      // Handle errors
      let curlError = "";
      curl.stderr.on("data", (data) => {
        curlError += data.toString();
      });

      // Wait for the process to complete
      await new Promise((resolve, reject) => {
        curl.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`Image download failed: ${curlError || `Exit code ${code}`}`));
          } else {
            resolve();
          }
        });
        curl.on("error", (err) => reject(new Error(`Curl process error: ${err.message}`)));
      });

      // Combine chunks into a single Buffer
      const imageBuffer = Buffer.concat(chunks);

      // Send the image without tags
      await XeonBotInc.sendMessage(sender, {
        image: imageBuffer,
      });

      // Save the shown image URL
      await saveShownImage(tags, imageUrl);

      // Log successful upload
      console.log(
        `📤 OUTGOING [${sender}]: High-quality image uploaded for tags "${tags}"`
      );

    } catch (error) {
      console.error(
        `Error in image_gen command: ${error.message}`,
        error.stack
      );
      await XeonBotInc.sendMessage(msg.key.remoteJid, {
        text:
          "❌ An error occurred while fetching or sending the image. Please check your tags or try again later.",
      });
      console.log(
        `📥 INCOMING [${msg.key.remoteJid}]: ❌ An error occurred while fetching or sending the image.`
      );
    }
  },
};
