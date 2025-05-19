/**
 * @command
 * name: system_call
 * title: Display Command Panel
 * description: Shows this advanced command menu with detailed descriptions
 * example: .system_call
 */

const fs = require('fs');
const path = require('path');

function extractCommandMetaFromComment(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/\/\*\*[\s\S]*?@command([\s\S]*?)\*\//);
  if (!match) return null;

  const raw = match[1].trim();
  const lines = raw.split('\n').map(l => l.replace(/^\s*\*\s?/, ''));
  let meta = {};
  let subcommands = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('subcommands:')) {
      i++;
      while (i < lines.length && lines[i].startsWith('-')) {
        const cmdLine = lines[i++].trim();
        const descLine = lines[i]?.trim();
        const cmdMatch = cmdLine.match(/cmd:\s*(.+)/);
        const descMatch = descLine?.match(/desc:\s*(.+)/);
        if (cmdMatch && descMatch) {
          subcommands.push({ cmd: cmdMatch[1], desc: descMatch[1] });
        }
        i++;
      }
    } else if (line.includes(':')) {
      const [key, ...val] = line.split(':');
      meta[key.trim()] = val.join(':').trim();
    }
  }

  if (subcommands.length) meta.subcommands = subcommands;
  return meta;
}

function formatCommand(meta) {
  let output = `🎯 \`.${meta.name}\`\n🔹 *${meta.title}*\n↳ ${meta.description}`;
  if (meta.example) output += `\n  • Example: \`${meta.example}\``;
  if (meta.subcommands && meta.subcommands.length) {
    meta.subcommands.forEach(sub => {
      output += `\n  • \`${sub.cmd}\`  – ${sub.desc}`;
    });
  }
  return output;
}

module.exports = {
  name: 'system_call',
  description: 'Display advanced command panel with detailed information',
  async execute(XeonBotInc, msg) {
    try {
      const sender = msg.key.remoteJid;
      const commandDir = __dirname;
      const files = fs.readdirSync(commandDir).filter(f => f.endsWith('.js'));

      let commandList = [];

      for (const file of files) {
        const filePath = path.join(commandDir, file);
        const meta = extractCommandMetaFromComment(filePath);
        if (meta?.name && meta?.title && meta?.description) {
          commandList.push(formatCommand(meta));
        }
      }

      // Sort alphabetically by command name (optional)
      commandList.sort((a, b) => a.localeCompare(b));

      const commandPanel = `🧿 *Shadow Monarch Bot – Command Panel*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n${commandList.join('\n\n')}\n\n━━━━━━━━━━━━━━━━━━━━━━━\n📌 Developed by *Dark Hacker*`;

      const assetsDir = path.join(__dirname, '../assets');
      const imagePath = path.join(assetsDir, 'command_panel.jpg');

      if (fs.existsSync(imagePath)) {
        const image = fs.readFileSync(imagePath);
        await XeonBotInc.sendMessage(sender, {
          image: image,
          caption: commandPanel
        });
      } else {
        await XeonBotInc.sendMessage(sender, {
          text: commandPanel
        });
      }

    } catch (error) {
      console.error('Error in system_call command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { text: 'An error occurred while processing the command.' });
    }
  },
};
