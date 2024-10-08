import { Client, Intents, Permissions, MessageEmbed } from 'discord.js';
import dayjs from 'dayjs';
import { keys } from './keys.js';
import { sleep, log } from './utils.js';
import { mongoConnect, insertGuild, getConfig, initUser, getUser, getRank, getTotalRank, incrUserStreak, clearUserStreak, zeroUserStreak } from './mongo.js';

const discord = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS] });

const nummoji = [
  ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'],
  [
    '<:_0:932432735987966013>',
    '<:_1:932432736248021022>',
    '<:_2:932432736097030204>',
    '<:_3:932432735669190657>',
    '<:_4:932432735698559037>',
    '<:_5:932432735820197989>',
    '<:_6:932432735367204974>',
    '<:_7:932432734733889617>',
    '<:_8:932432735069437993>',
    '<:_9:932432734880682014>'
  ],
  [
    '<:__0:932432736168333352>',
    '<:__1:932432735954436117>',
    '<:__2:932432736067657778>',
    '<:__3:932432735669219379>',
    '<:__4:932432736013144064>',
    '<:__5:932432735430139904>',
    '<:__6:932432735203647518>',
    '<:__7:932432734863908865>',
    '<:__8:932432734524170320>',
    '<:__9:932432734335426610>'
  ]
];


const commands = ['!bm', '!bm wen', '!bm rank'];

async function checkTime(userId, now) {
  const formerRaw = await getUser(userId).then( (t) => { return t.ts } );
  const formerTime = dayjs(formerRaw);
  if ((now >= formerTime.add(15,'hours') && now <= formerTime.endOf('day').add(1, 'day'))) {
    return 1;
  } else if (now > formerTime.endOf('day').add(1, 'day')) {
    return -1;
  } else {
    return 0;
  }
}

async function handleUser (userId, username) {
  const now = dayjs().valueOf();
  if (await getUser(userId) === null) {
    return await initUser(userId, username, now).then( () => {
      return 1;
    });
  } else {
    const check = await checkTime(userId, now);
    if (check === 1) {
      return await incrUserStreak(userId, now).then( (user) => {
        return user.streak;
      });
    } else if (check === -1) {
      return await clearUserStreak(userId, now).then( () => {
        return 1;
      });
    } else {
      return 0;
    }
  }
}

function numToEmoji (num) {
  var emoji = [];
  const numString = num.toString();
  const numArray = numString.split('');
  for (var i = 0; i < numArray.length; i++) {
    emoji.push(
      nummoji[i][numArray[i]]
    );
  }
  return emoji;
}

discord.on('messageCreate', async m => {
  if (!m.author.bot) {
    const botHasPermish = m.channel.permissionsFor(m.guild.me).has(
      Permissions.FLAGS.READ_MESSAGE_HISTORY&&
      Permissions.FLAGS.ADD_REACTIONS&&
      Permissions.FLAGS.EMBED_LINKS);
    const config = await getConfig(m.guild.id).then( (c) => { 
      if (c == undefined) { return 0 }
      else { return c }
    });

    const userId = m.author.id;
    const username = m.author.tag;

    try {
      if (m.content.indexOf('!bm setup') === 0) {
        try {
          if (m.channel.permissionsFor(m.author).has(Permissions.FLAGS.MANAGE_GUILD)) {
            var keyword = m.content.split('!bm setup')[1].trim();
            if (keyword === '') { keyword = 'bm'; }
            await insertGuild(m.guild.name, m.channel.name, m.channel.id, keyword);
            log(`New guild added! ${m.guild.name}, ${m.channel.name}, word: ${keyword}`, 'g');
            await discord.channels.cache.get(m.channelId).send(`Setup to track ${keyword} in ${m.channel.name}`);
          } else { 
            await discord.channels.cache.get(m.channelId).send('Must be a bot wrangler to perform setup!');
          }
        } catch (e) {
          console.log(e);
          return;
        }

      } else if (m.content === '!bm help') {
        if (botHasPermish) {
          const message = new MessageEmbed()
            .setTitle('👋')
            .setDescription(`thanks for adding me!\nmy purpose is to count your bm's\nsay bm once a day to increment your streak\nmiss a day and your streak gets reset :(\nwhen you have successfully bm'ed you'll see reaction emojis with your current streak\nif you haven't waited long enough since your last bm you'll see a ⏰ reaction`)
            .addField('other commands',"`!bm` responds with your current streak and running total\n`!bm wen` responds with wen you last said it and wen to say it next\n`!bm rank` displays the current streak leader board\n`!bm setup` setups me up to track in the channel where it is sent\n")
            .addField('===========================','bm')
            .addField('brought to you by', '[CanuDAO](https://discord.gg/dv7SXUaMKD)');
          try { 
            await discord.channels.cache.get(m.channelId).send({embeds:[message]});
          } catch(e) { return }
        } else {
          log(`Missing permissions in ${m.guild.name}, ${m.channel.name}`);
          try { 
            await discord.channels.cache.get(m.channelId).send("Missing permissions to send help message");
          } catch(e) { return }
        }
      
      } else if (config !== 0) {
          if (m.content.toLowerCase() === config.keyword && config.channelId === m.channel.id) {
            const streak = await handleUser(userId, username);
            if (streak === 0) {
              if (botHasPermish){
                try { await m.react('⏰'); } catch(e) { log(`ERROR: clock reaction ${m.guild.name}, ${m.channel.name}\n\t\t\t\t${e}`, 'e')}
              } else {
                log(`Missing permissions in ${m.guild.name}, ${m.channel.name}`,'e');
                try {
                  await discord.channels.cache.get(m.channelId).send("Missing permissions to react to message");
                } catch(e) { return }
              }
            } else {
              const streakmoji = numToEmoji(streak); 
              for (var i = 0; i < streakmoji.length; i++){
                if (botHasPermish){
                  try { m.react(streakmoji[i]); } catch(e) { log(`ERROR: nummoji reaction ${m.guild.name}, ${m.channel.name}\n\t\t\t\t${e}`, 'e')}
                } else {
                  log(`Missing permissions in ${m.guild.name}, ${m.channel.name}`);
                  try {
                    await discord.channels.cache.get(m.channelId).send("Missing permissions to react to message");
                  } catch(e) { return }
                }
              }
            }

          } else if (m.content === '!bm') {
            const now = dayjs().valueOf();
            const check = await checkTime(userId, now).catch( () => 0);
            if (check === -1) zeroUserStreak(userId);
            const user = await getUser(userId).then( (u) => {
              if (u === null) { return 0 }
              else { return u; } 
            });
            if (user === 0) {
              try { 
                await discord.channels.cache.get(m.channelId).send(`bm ${m.author}, you've never said bm, give it a try!`);
              } catch(e) { return }
            } else {
              try {
                await discord.channels.cache.get(m.channelId).send(`bm ${m.author}, you have a streak of ${user.streak} and overall have said ${config.keyword} ${user.history.length} times`);
              } catch(e) { return }
            }

          } else if (m.content === '!bm avg') {
            const avg = await getUser(userId).then( (t) => { 
              const history = t.history;
              const length = history.length;
              let ret = 0;
              history.forEach(h => {
                const i = dayjs(parseInt(h)).format('HH');
                ret = ret + parseInt(i);
              })
              return ret/length;
            });
            try {
              await discord.channels.cache.get(m.channelId).send(`You usually say ${config.keyword} around ${Math.round(avg)}:00`);
            } catch(e) { return }

          } else if (m.content === '!bm rank') {
              const cutoff = dayjs().subtract(2,'day').valueOf();
              const rank = await getRank(cutoff);
              (rank[0] == undefined || rank[0].streak === 0) ? rank[0] = ({'username': 'no one', 'streak': 'NA'}) : null;
              (rank[1] == undefined || rank[1].streak === 0) ? rank[1] = ({'username': 'no one', 'streak': 'NA'}) : null;
              (rank[2] == undefined || rank[2].streak === 0) ? rank[2] = ({'username': 'no one', 'streak': 'NA'}) : null;
              (rank[3] == undefined || rank[3].streak === 0) ? rank[3] = ({'username': 'no one', 'streak': 'NA'}) : null;
              (rank[4] == undefined || rank[4].streak === 0) ? rank[4] = ({'username': 'no one', 'streak': 'NA'}) : null;
              try { 
                await discord.channels.cache.get(m.channelId).send(
                `🥇 ${rank[0].username} -> ${rank[0].streak}\n🥈 ${rank[1].username} -> ${rank[1].streak}\n🥉 ${rank[2].username} -> ${rank[2].streak}\n4️⃣ ${rank[3].username} -> ${rank[3].streak}\n5️⃣ ${rank[4].username} -> ${rank[4].streak}`);
              } catch(e) { return }

          } else if (m.content === '!bm wen') {
            const formerRaw = await getUser(userId).then( (t) => { return t.ts } );
            const formerTime = dayjs(formerRaw);
            const lower = formerTime.add(15,'hours');
            const upper = formerTime.endOf('day').add(1, 'day');
            try {
              await discord.channels.cache.get(m.channelId).send(`You previously said ${config.keyword} at <t:${formerTime.unix()}>. Say it again after <t:${lower.unix()}> but before <t:${upper.unix()}>`);
            } catch(e) { return }
          
          } else if (m.content === '!bm rank total') {
            const rank = await getTotalRank();
            (rank[0] == undefined || rank[0].historyCount === 0) ? rank[0] = ({'username': 'no one', 'streak': 'NA'}) : null;
            (rank[1] == undefined || rank[1].historyCount === 0) ? rank[1] = ({'username': 'no one', 'streak': 'NA'}) : null;
            (rank[2] == undefined || rank[2].historyCount === 0) ? rank[2] = ({'username': 'no one', 'streak': 'NA'}) : null;
            (rank[3] == undefined || rank[3].historyCount === 0) ? rank[3] = ({'username': 'no one', 'streak': 'NA'}) : null;
            (rank[4] == undefined || rank[4].historyCount === 0) ? rank[4] = ({'username': 'no one', 'streak': 'NA'}) : null;
            try { 
              await discord.channels.cache.get(m.channelId).send(
              `**All time ranking**:\n🥇 ${rank[0].username} -> ${rank[0].historyCount}\n🥈 ${rank[1].username} -> ${rank[1].historyCount}\n🥉 ${rank[2].username} -> ${rank[2].historyCount}\n4️⃣ ${rank[3].username} -> ${rank[3].historyCount}\n5️⃣ ${rank[4].username} -> ${rank[4].historyCount}`);
            } catch(e) { return }

          }
      } else {
          if (commands.indexOf(m.content) > -1) {
            try {
              await discord.channels.cache.get(m.channelId).send('Do setup with\n```!bm setup```')
            } catch(e) { return }
          }
      }
    } catch(e) {
      console.log(e)
    }
  }
});

discord.once('ready', async c => {
  log(`Ready! Logged in as ${c.user.tag}`);
});

discord.login(keys.DISCORD_KEY);
await mongoConnect().then( (r) => {
  if (r === 1) { 
    log('MongoDB connected'); 
    return;
  } else {
    log('Error connecting.');
    process.exit();
  }
});
