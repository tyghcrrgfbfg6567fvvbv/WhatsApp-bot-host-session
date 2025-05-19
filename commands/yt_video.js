/**
 * @command
 * name: yt_video
 * title: YouTube Video Download
 * description: Download a YouTube video by URL and send it to the user
 * example: .yt_video https://www.youtube.com/watch?v=1q-oQ3UG-BM
 * subcommands:
 *   - cmd: <URL>
 *     desc: Provide the YouTube video URL
 */

const { exec } = require("child_process");
const util = require("util");
const fs = require("fs").promises;
const path = require("path");

// Promisify exec for async/await
const execPromise = util.promisify(exec);

// Directory for video output
const VIDEO_DIR = path.join(__dirname, "video");

// Function to simulate anime-style dot animation by sending new messages
async function showDotAnimation(XeonBotInc, sender) {
  const dotPatterns = [".", "..", "...", "...."];
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

module.exports = {
  name: "yt_video",
  description: "Download and send YouTube videos to the requesting WhatsApp user",
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
          text: "❌ Please provide a YouTube video URL (Example: .yt_video https://www.youtube.com/watch?v=VIDEO_ID)",
        });
        return;
      }

      // Extract the YouTube URL
      const url = args[1];

      // Validate URL
      if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
        await XeonBotInc.sendMessage(sender, {
          text: "❌ Invalid YouTube URL. Please provide a valid video URL.",
        });
        return;
      }

      // Show typing indicator
      await XeonBotInc.sendPresenceUpdate("composing", sender);

      // Show dot animation
      await showDotAnimation(XeonBotInc, sender);

      // Create video directory if it doesn't exist
      await fs.mkdir(VIDEO_DIR, { recursive: true });

      // Create a temporary file path
      const tempFile = path.join(VIDEO_DIR, `temp_video_${Date.now()}.mp4`);

      // Log download start
      console.log(
        `📥 INCOMING [${sender}]: Starting YouTube video download for URL "${url}"`
      );

      // Download with yt-dlp, re-encoding to H.264/AAC
      const command = `yt-dlp -f "best[ext=mp4][height<=720]" --recode-video mp4 --ffmpeg-location ffmpeg -o "${tempFile}" "${url}" --postprocessor-args "-c:v libx264 -c:a aac"`;
      const { stdout, stderr } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 });

      if (stderr && stderr.includes("ERROR")) {
        throw new Error(`Download failed: ${stderr}`);
      }

      // Verify file exists
      try {
        await fs.access(tempFile);
      } catch {
        throw new Error(`Download failed: Output file ${tempFile} not found`);
      }

      // Debug: Log video format with ffprobe
      try {
        const { stdout: ffprobeOutput } = await execPromise(`ffprobe -show_streams -print_format json "${tempFile}"`);
        console.log(`Video format details: ${ffprobeOutput}`);
      } catch (err) {
        console.warn(`Warning: ffprobe failed: ${err.message}`);
      }

      // Check file size (WhatsApp limit ~100MB)
      const stats = await fs.stat(tempFile);
      if (stats.size > 100 * 1024 * 1024) {
        throw new Error(`Video file too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). WhatsApp limit is ~100MB.`);
      }

      // Read the video file
      const videoBuffer = await fs.readFile(tempFile);

      // Send the video without caption
      await XeonBotInc.sendMessage(sender, {
        video: videoBuffer,
        mimetype: "video/mp4",
      });

      // Log successful upload
      console.log(
        `📤 OUTGOING [${sender}]: YouTube video uploaded for URL "${url}"`
      );

      // Clean up temporary file
      await fs.unlink(tempFile).catch((err) => {
        console.warn(`Warning: Failed to delete temp file ${tempFile}: ${err.message}`);
      });

    } catch (error) {
      console.error(
        `Error in yt_video command: ${error.message}`,
        error.stack
      );
      await XeonBotInc.sendMessage(msg.key.remoteJid, {
        text: `❌ An error occurred while downloading or sending the video: ${error.message}`,
      });
      console.log(
        `📥 INCOMING [${msg.key.remoteJid}]: ❌ An error occurred while downloading or sending the video.`
      );
    }
  },
};
