/**
 * @command
 * name: ffinfo
 * title: Free Fire Player Info
 * description: Fetch Free Fire player stats by UID and region
 * example: .ffinfo 123456789 AS
 * subcommands:
 *   - cmd: <UID> <Region>
 *     desc: Provide the player UID and region code (e.g., AS, EU)
 */

const fetch = global.fetch || require('node-fetch');

module.exports = {
  name: 'ffinfo',
  description: 'Get Free Fire account information by UID and region',
  async execute(XeonBotInc, msg) {
    try {
      // Get the sender's details
      const sender = msg.key.remoteJid;
      
      // Get the command arguments
      const messageContent = msg.message.conversation || 
                          (msg.message.extendedTextMessage && 
                          msg.message.extendedTextMessage.text) || '';
      
      const args = messageContent.slice(1).trim().split(' ');
      
      if (args.length < 3) {
        await XeonBotInc.sendMessage(sender, { 
          text: "❌ Please provide UID and region (Example: .ffinfo 123456789 NA)" 
        });
        return;
      }
      
      const uid = args[1];
      const region = args[2];
      
      // Show typing indicator
      await XeonBotInc.sendPresenceUpdate('composing', sender);
      
      // Fetch data from API
      const response = await fetch(`https://brokenplayz23-ffinfo.onrender.com/api/account?uid=${uid}&region=${region}`);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format the response
      if (data.error) {
        await XeonBotInc.sendMessage(sender, { 
          text: `❌ Error: ${data.error}` 
        });
        return;
      }
      
      // Convert UNIX timestamp to readable date/time
      const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(parseInt(timestamp) * 1000);
        return date.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).replace(',', ',');
      };
      
      // Determine BR Rank Name based on ranking points
      const getBRRankName = (rank, points) => {
        if (!rank) return 'N/A';
        
        const ranks = {
          301: 'BRONZE',
          302: 'SILVER',
          303: 'GOLD',
          304: 'PLATINUM',
          305: 'DIAMOND',
          306: 'HEROIC',
          307: 'GRANDMASTER'
        };
        
        const rankName = ranks[rank] || 'UNKNOWN';
        let tier = '';
        
        if (rankName === 'HEROIC' && points) {
          const heroicStar = Math.floor((points - 4200) / 100) + 1;
          tier = ` Star ${heroicStar > 0 ? heroicStar : 1}`;
        } else if (rankName !== 'GRANDMASTER' && rankName !== 'HEROIC') {
          // Calculate tier I, II, III, IV
          const tiers = ['IV', 'III', 'II', 'I'];
          const tierIndex = Math.min(3, Math.floor(points / 400)) % 4;
          tier = ` ${tiers[tierIndex]}`;
        }
        
        return rankName + tier;
      };
      
      // Process the data to match your desired format
      const nickname = data.basicInfo?.nickname || 'Unknown Player';
      const serverRegion = data.basicInfo?.region || region;
      const accountUid = data.basicInfo?.accountId || uid;
      const level = data.basicInfo?.level || 'N/A';
      const exp = data.basicInfo?.exp || 'N/A';
      const likes = data.basicInfo?.liked || 'N/A';
      const brRank = getBRRankName(data.basicInfo?.rank, data.basicInfo?.rankingPoints);
      const brPoints = data.basicInfo?.rankingPoints || 'N/A';
      const csRank = getBRRankName(data.basicInfo?.csRank, data.basicInfo?.csRankingPoints);
      const csPoints = data.basicInfo?.csRankingPoints || 'N/A';
      const celebrityStatus = 'False🙂'; // Default value as it's not in the API
      const booyahPass = 'Basic🙂'; // Default value as it's not in the API
      const badges = data.basicInfo?.badgeCnt || 'N/A';
      const honorScore = data.creditScoreInfo?.creditScore || 'N/A';
      const createdAt = formatTimestamp(data.basicInfo?.createAt);
      const lastLogin = formatTimestamp(data.basicInfo?.lastLoginAt);
      
      // Guild info
      const guildName = data.clanBasicInfo?.clanName || 'N/A';
      const guildLevel = data.clanBasicInfo?.clanLevel || 'N/A';
      const guildMembers = data.clanBasicInfo?.memberNum || 'N/A';
      const guildCapacity = data.clanBasicInfo?.capacity || 'N/A';
      const guildId = data.clanBasicInfo?.clanId || 'N/A';
      
      // Guild leader info
      const leaderName = data.captainBasicInfo?.nickname || 'N/A';
      const leaderLevel = data.captainBasicInfo?.level || 'N/A';
      const leaderUID = data.captainBasicInfo?.accountId || 'N/A';
      const leaderBRRank = getBRRankName(data.captainBasicInfo?.rank, data.captainBasicInfo?.rankingPoints);
      const leaderCSRank = getBRRankName(data.captainBasicInfo?.csRank, data.captainBasicInfo?.csRankingPoints);
      const leaderCreatedAt = formatTimestamp(data.captainBasicInfo?.createAt);
      
      // Pet info
      const petName = 'N/A'; // Pet name not available in API
      const petLevel = data.petInfo?.level || 'N/A';
      const petExp = data.petInfo?.exp || 'N/A';
      
      // Social info
      const gender = '🙎🏻‍♂️ Male'; // Not available in API
      const bio = data.socialInfo?.signature || 'N/A';
      const rankShow = data.socialInfo?.rankShow || 'N/A';
      const languageShow = data.socialInfo?.language || 'N/A';
      
      // Create formatted message
      const formattedMessage = `🎮 Free Fire Profile - ${nickname}\n` +
        `👤 ACCOUNT BASIC INFO\n` +
        `🌍 Server: ${serverRegion} ${serverRegion === 'IND' ? '🇮🇳' : serverRegion === 'BD' ? '🇧🇩' : ''}\n` +
        `🆔 UID: ${accountUid}\n` +
        `🔰 Level: ${level}\n` +
        `⭐ EXP: ${exp}\n` +
        `👍 Likes: ${likes}\n` +
        `🏆 BR Rank: ${brRank}\n` +
        `🎖️ BR Points: ${brPoints}\n` +
        `🏆 CS Rank: ${csRank}\n` +
        `🎖️ CS Points: ${csPoints}\n` +
        `🌟 Celebrity Status: ${celebrityStatus}\n` +
        `🎫 Booyah Pass: ${booyahPass}\n` +
        `🎖️ BP Badges: ${badges}\n` +
        `💳 Honor Score: ${honorScore}\n` +
        `📅 Created: ${createdAt}\n` +
        `⏰ Last Login: ${lastLogin}\n` +
        `🏰 Guild Info\n` +
        `Name: ${guildName}\n` +
        `Level: ${guildLevel}\n` +
        `Members: ${guildMembers} / ${guildCapacity}\n` +
        `Guild ID: ${guildId}\n` +
        `👑 Guild Leader Info\n` +
        `Name: ${leaderName}\n` +
        `Level: ${leaderLevel}\n` +
        `UID: ${leaderUID}\n` +
        `BR Rank: ${leaderBRRank}\n` +
        `CS Rank: ${leaderCSRank}\n` +
        `Booyah Pass: Basic🙂\n` +
        `BP Badges: N/A\n` +
        `Created: ${leaderCreatedAt}\n` +
        `🐾 Pet\n` +
        `Name: ${petName}\n` +
        `Level: ${petLevel}\n` +
        `EXP: ${petExp}\n` +
        `💬 Social Info\n` +
        `Gender: ${gender}\n` +
        `Bio: ${bio}\n` +
        `Rank Show: ${rankShow}\n` +
        `Language Show: ${languageShow}\n` +
        `🌟 Follow Us & Stay Updated!`;
      
      // Send the formatted message
      await XeonBotInc.sendMessage(sender, { 
        text: formattedMessage 
      });
      
    } catch (error) {
      console.error('Error in ffinfo command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { 
        text: '❌ An error occurred while fetching the account information. Please check the UID and region are correct.'
      });
    }
  },
};
