// watch.js — cek RSS YouTube tiap channel, filter judul trailer/MV, kirim ke Discord.
// Jalan otomatis lewat GitHub Actions (lihat .github/workflows/watch.yml)

const fs = require('fs');
const path = require('path');

const CHANNELS_PATH = path.join(__dirname, '..', 'channels.json');
const SEEN_PATH = path.join(__dirname, '..', 'seen.json');
const MAX_SEEN = 1000; // batas jumlah ID disimpan, biar file gak membengkak

// Edit kata kunci di sini kalau mau lebih ketat/longgar
const KEYWORDS = [
  'trailer',
  'teaser',
  'official trailer',
  'music video',
  'official video',
  'official audio',
];

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function matchesKeyword(title) {
  const lower = title.toLowerCase();
  return KEYWORDS.some((kw) => lower.includes(kw));
}

function parseEntries(xml) {
  const entries = [];
  const entryBlocks = xml.split('<entry>').slice(1);
  for (const block of entryBlocks) {
    const videoId = (block.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const link = (block.match(/<link rel="alternate" href="(.*?)"/) || [])[1];
    const author = (block.match(/<name>(.*?)<\/name>/) || [])[1];
    const thumb = (block.match(/<media:thumbnail url="(.*?)"/) || [])[1];
    const published = (block.match(/<published>(.*?)<\/published>/) || [])[1];
    if (videoId && title && link) {
      entries.push({ videoId, title: decodeHtml(title), link, author, thumb, published });
    }
  }
  return entries;
}

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchChannelEntries(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: 'application/xml,text/xml,*/*',
    },
  });
  if (!res.ok) {
    console.error(`Gagal fetch channel ${channelId}: HTTP ${res.status}`);
    return [];
  }
  const xml = await res.text();
  const entries = parseEntries(xml);
  if (entries.length === 0) {
    console.log(`[debug] ${channelId} — 0 entry ke-parse. Cuplikan respons: ${xml.slice(0, 200)}`);
  }
  return entries;
}

async function sendToDiscord(entry, channelName) {
  const payload = {
    embeds: [
      {
        title: entry.title,
        url: entry.link,
        color: 0x5865f2,
        author: { name: channelName || entry.author },
        image: entry.thumb ? { url: entry.thumb } : undefined,
        timestamp: entry.published,
      },
    ],
  };
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`Gagal kirim ke Discord: HTTP ${res.status}`);
    return false; // gagal, jangan ditandain seen
  }
  return true;
}

async function main() {
  if (!WEBHOOK_URL) {
    console.error('DISCORD_WEBHOOK_URL belum di-set. Cek GitHub Secrets.');
    process.exit(1);
  }

  const channels = loadJson(CHANNELS_PATH, []);
  const seen = loadJson(SEEN_PATH, {});

  let newCount = 0;

  for (const channel of channels) {
    const entries = await fetchChannelEntries(channel.channelId);
    for (const entry of entries) {
      if (seen[entry.videoId]) continue;
      if (!matchesKeyword(entry.title)) continue;

      console.log(`Baru: [${channel.name}] ${entry.title}`);
      const ok = await sendToDiscord(entry, channel.name);
      if (ok) {
        seen[entry.videoId] = Date.now();
        newCount++;
      }
    }
  }

  // Pangkas seen.json biar gak membengkak — buang yang paling lama
  const seenIds = Object.keys(seen);
  if (seenIds.length > MAX_SEEN) {
    const sorted = seenIds.sort((a, b) => seen[a] - seen[b]);
    const toRemove = sorted.slice(0, seenIds.length - MAX_SEEN);
    toRemove.forEach((id) => delete seen[id]);
  }

  fs.writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 2));
  console.log(`Selesai. ${newCount} video baru dikirim.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
