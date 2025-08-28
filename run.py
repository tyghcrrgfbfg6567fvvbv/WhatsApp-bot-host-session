import subprocess
import sys

# List of required Node.js libraries from package.json
node_libraries = [
    "@adiwajshing/keyed-db",
    "@colors/colors",
    "@google/generative-ai",
    "@whiskeysockets/baileys",
    "axios",
    "cfonts",
    "chalk",
    "dotenv",
    "express",
    "fs-extra",
    "multer",
    "node-cache",
    "node-fetch",
    "path",
    "pino",
    "pino-pretty",
    "puppeteer-core",
    "qrcode-terminal",
    "socket.io",
    "uuid",
    "ytdl-core",
    "cheerio"
]

# Install Node.js libraries
for lib in node_libraries:
    print(f"Installing {lib}...")
    subprocess.run(["npm", "install", lib])

# Install nodemon globally if not present
try:
    subprocess.run(["npx", "nodemon", "--version"], check=True)
except subprocess.CalledProcessError:
    print("Installing nodemon globally...")
    subprocess.run(["npm", "install", "-g", "nodemon"])

# Run the bot using nodemon
print("Starting bot with nodemon...")
subprocess.run(["npx", "nodemon", "index.js"])
