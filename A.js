/*!
 * @name podcast-itunes
 * @description iTunes + BBC + ESL Podcast Plugin
 * @version v2.0.0
 * @author custom
 * @key csp_podcast
 */

const $config = argsify($config_str)
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
const headers = { 'User-Agent': UA }

const ITUNES_API = 'https://itunes.apple.com'

const FEATURED_FEEDS = [
  // ── 中文 ──────────────────────────────────────
  {
    id: 'hk_top',
    name: '🇭🇰 香港熱門',
    rss: 'https://itunes.apple.com/hk/rss/toppodcasts/limit=25/json',
    lang: 'zh-HK'
  },
  {
    id: 'hk_news',
    name: '📰 新聞時事',
    rss: 'https://itunes.apple.com/hk/rss/toppodcasts/limit=25/genre=1489/json',
    lang: 'zh-HK'
  },
  {
    id: 'hk_edu',
    name: '📚 教育',
    rss: 'https://itunes.apple.com/hk/rss/toppodcasts/limit=25/genre=1304/json',
    lang: 'zh-HK'
  },
  {
    id: 'hk_biz',
    name: '💼 商業財經',
    rss: 'https://itunes.apple.com/hk/rss/toppodcasts/limit=25/genre=1321/json',
    lang: 'zh-HK'
  },
  {
    id: 'hk_health',
    name: '🏃 健康',
    rss: 'https://itunes.apple.com/hk/rss/toppodcasts/limit=25/genre=1512/json',
    lang: 'zh-HK'
  },
  // ── UK / BBC ──────────────────────────────────
  {
    id: 'uk_top',
    name: '🇬🇧 UK Top',
    rss: 'https://itunes.apple.com/gb/rss/toppodcasts/limit=25/json',
    lang: 'en-GB'
  },
  {
    id: 'uk_news',
    name: '📰 UK News',
    rss: 'https://itunes.apple.com/gb/rss/toppodcasts/limit=25/genre=1489/json',
    lang: 'en-GB'
  },
  {
    id: 'bbc_learning',
    name: '🎓 BBC 6 Min English',
    rss: 'https://podcasts.files.bbci.co.uk/p02pc9zn.rss',
    lang: 'en-GB',
    type: 'rss_direct'
  },
  {
    id: 'bbc_english_speak',
    name: '💬 BBC English We Speak',
    rss: 'https://podcasts.files.bbci.co.uk/p02pc9tn.rss',
    lang: 'en-GB',
    type: 'rss_direct'
  },
  {
    id: 'bbc_global_news',
    name: '🌍 BBC Global News',
    rss: 'https://podcasts.files.bbci.co.uk/p02nq0gn.rss',
    lang: 'en-GB',
    type: 'rss_direct'
  },
  {
    id: 'bbc_in_our_time',
    name: '🧠 BBC In Our Time',
    rss: 'https://podcasts.files.bbci.co.uk/b006qykl.rss',
    lang: 'en-GB',
    type: 'rss_direct'
  },
  {
    id: 'bbc_world_service',
    name: '📡 BBC World Service',
    rss: 'https://podcasts.files.bbci.co.uk/p02nq0lx.rss',
    lang: 'en-GB',
    type: 'rss_direct'
  },
  // ── 英語學習（初級）─────────────────────────────
  {
    id: 'esl_beginner',
    name: '🐢 English at Your Own Pace',
    rss: 'https://feeds.feedburner.com/englishatyourownpace',
    lang: 'en',
    type: 'rss_direct'
  },
  {
    id: 'esl_pod',
    name: '📖 ESL Pod',
    rss: 'https://www.eslpod.com/website/eslpodcast.xml',
    lang: 'en',
    type: 'rss_direct'
  },
  {
    id: 'culips_esl',
    name: '🗣️ Culips ESL',
    rss: 'https://feeds.libsyn.com/51808/rss',
    lang: 'en',
    type: 'rss_direct'
  },
  {
    id: 'british_english_pod',
    name: '🇬🇧 British English Pod',
    rss: 'https://britishenglishpodcast.com/feed/podcast/',
    lang: 'en-GB',
    type: 'rss_direct'
  },
  {
    id: 'news_slow_english',
    name: '📰 News in Slow English',
    rss: 'https://www.newsinslowenglish.com/feed/podcast/',
    lang: 'en',
    type: 'rss_direct'
  },
  // ── 英文（美式/國際）─────────────────────────────
  {
    id: 'us_top',
    name: '🇺🇸 English Top',
    rss: 'https://itunes.apple.com/us/rss/toppodcasts/limit=25/json',
    lang: 'en'
  },
  {
    id: 'en_tech',
    name: '💻 Technology',
    rss: 'https://itunes.apple.com/us/rss/toppodcasts/limit=25/genre=1318/json',
    lang: 'en'
  },
  {
    id: 'en_comedy',
    name: '😂 Comedy',
    rss: 'https://itunes.apple.com/us/rss/toppodcasts/limit=25/genre=1303/json',
    lang: 'en'
  },
  {
    id: 'en_true_crime',
    name: '🔍 True Crime',
    rss: 'https://itunes.apple.com/us/rss/toppodcasts/limit=25/genre=1488/json',
    lang: 'en'
  },
]

const appConfig = {
  ver: 1,
  name: 'Podcast',
  message: 'iTunes + BBC + ESL Podcast Plugin',
  desc: '廣東話 & English Podcasts',
  tabLibrary: {
    name: '探索',
    groups: [
      // 中文
      { name: '🇭🇰 香港熱門', type: 'playlist', ui: 0, showMore: true, ext: { gid: 'hk_top' } },
      { name: '📰 新聞時事', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'hk_news' } },
      { name: '📚 教育', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'hk_edu' } },
      { name: '💼 商業財經', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'hk_biz' } },
      { name: '🏃 健康', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'hk_health' } },
      // UK / BBC
      { name: '🇬🇧 UK Top', type: 'playlist', ui: 0, showMore: true, ext: { gid: 'uk_top' } },
      { name: '📰 UK News', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'uk_news' } },
      { name: '🎓 BBC 6 Min English', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'bbc_learning' } },
      { name: '💬 BBC English We Speak', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'bbc_english_speak' } },
      { name: '🌍 BBC Global News', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'bbc_global_news' } },
      { name: '🧠 BBC In Our Time', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'bbc_in_our_time' } },
      { name: '📡 BBC World Service', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'bbc_world_service' } },
      // 英語學習
      { name: '🐢 English at Your Own Pace', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'esl_beginner' } },
      { name: '📖 ESL Pod', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'esl_pod' } },
      { name: '🗣️ Culips ESL', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'culips_esl' } },
      { name: '🇬🇧 British English Pod', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'british_english_pod' } },
      { name: '📰 News in Slow English', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'news_slow_english' } },
      // 英文國際
      { name: '🇺🇸 English Top', type: 'playlist', ui: 0, showMore: true, ext: { gid: 'us_top' } },
      { name: '💻 Technology', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'en_tech' } },
      { name: '😂 Comedy', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'en_comedy' } },
      { name: '🔍 True Crime', type: 'playlist', ui: 1, showMore: false, ext: { gid: 'en_true_crime' } },
    ]
  },
  tabMe: {
    name: '我的',
    groups: [
      { name: '收藏節目', type: 'playlist' },
      { name: '收藏單集', type: 'song' },
    ]
  },
  tabSearch: {
    name: '搜索',
    groups: [
      { name: '節目', type: 'playlist', ext: { type: 'playlist' } },
      { name: '單集', type: 'song', ext: { type: 'song' } },
    ]
  }
}

async function getConfig() {
  return jsonify(appConfig)
}

function parseDuration(str) {
  if (!str) return 0
  if (/^\d+$/.test(str)) return parseInt(str)
  const parts = str.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

async function loadRssEpisodes(feedUrl) {
  const { data } = await $fetch.get(feedUrl, { headers })
  const $ = cheerio.load(data, { xmlMode: true })

  const podcastName = $('channel > title').first().text()
  const podcastCover = $('channel > image > url').first().text()
    || $('itunes\\:image').first().attr('href')
    || ''

  const episodes = []
  $('item').each((i, el) => {
    const ele = $(el)
    const audioUrl = ele.find('enclosure').attr('url') ?? ''
    const duration = ele.find('itunes\\:duration').text() ?? ''
    const description = ele.find('description').text()
      || ele.find('itunes\\:summary').text()
      || ''
    const pubDate = ele.find('pubDate').text() ?? ''
    const episodeCover = ele.find('itunes\\:image').attr('href') ?? podcastCover
    const guid = ele.find('guid').text() || audioUrl

    if (!audioUrl) return

    episodes.push({
      id: guid,
      name: ele.find('title').text() || '',
      cover: episodeCover,
      duration: parseDuration(duration),
      artist: {
        id: podcastName,
        name: podcastName,
        cover: podcastCover,
      },
      ext: {
        pid: audioUrl,
        description: description.slice(0, 500),
        pubDate,
      }
    })
  })

  return episodes
}

async function loadItunesTopPodcasts(rssUrl) {
  const { data } = await $fetch.get(rssUrl, { headers })
  const info = argsify(data)
  const entries = info?.feed?.entry ?? []

  return entries.map((each) => {
    const id = each?.id?.attributes?.['im:id'] ?? ''
    const name = each?.['im:name']?.label ?? ''
    const cover = (each?.['im:image'] ?? []).slice(-1)[0]?.label ?? ''
    const artist = each?.['im:artist']?.label ?? ''

    return {
      id,
      name,
      cover,
      artist: {
        id,
        name: artist,
      },
      ext: {
        gid: 'podcast',
        id,
        type: 'podcast',
      }
    }
  })
}

async function getPlaylists(ext) {
  const { page, gid } = argsify(ext)
  if (page > 1) return jsonify({ list: [] })

  const feed = FEATURED_FEEDS.find(f => f.id === gid)
  if (!feed) return jsonify({ list: [] })

  if (feed.type === 'rss_direct') {
    const episodes = await loadRssEpisodes(feed.rss)
    return jsonify({ list: episodes })
  }

  const cards = await loadItunesTopPodcasts(feed.rss)
  return jsonify({ list: cards })
}

async function getSongs(ext) {
  const { page, id } = argsify(ext)
  if (page > 1) return jsonify({ list: [] })

  const lookupUrl = `${ITUNES_API}/lookup?id=${id}&entity=podcast`
  const { data } = await $fetch.get(lookupUrl, { headers })
  const info = argsify(data)
  const feedUrl = info?.results?.[0]?.feedUrl ?? ''

  if (!feedUrl) return jsonify({ list: [] })

  const episodes = await loadRssEpisodes(feedUrl)
  return jsonify({ list: episodes })
}

async function getAlbums(ext) {
  return jsonify({ list: [] })
}

async function getArtists(ext) {
  return jsonify({ list: [] })
}

async function search(ext) {
  const { text, page, type } = argsify(ext)
  if (page > 3) return jsonify({})

  if (type === 'playlist') {
    const url = `${ITUNES_API}/search?term=${encodeURIComponent(text)}&media=podcast&entity=podcast&limit=20&offset=${(page - 1) * 20}`
    const { data } = await $fetch.get(url, { headers })
    const results = argsify(data)?.results ?? []

    const cards = results.map((each) => ({
      id: `${each.collectionId}`,
      name: each.collectionName ?? '',
      cover: each.artworkUrl600 ?? each.artworkUrl100 ?? '',
      artist: {
        id: `${each.artistId ?? ''}`,
        name: each.artistName ?? '',
      },
      ext: {
        gid: 'podcast',
        id: `${each.collectionId}`,
        type: 'podcast',
        feedUrl: each.feedUrl ?? '',
      }
    }))

    return jsonify({ list: cards })
  }

  if (type === 'song') {
    const url = `${ITUNES_API}/search?term=${encodeURIComponent(text)}&media=podcast&entity=podcastEpisode&limit=20&offset=${(page - 1) * 20}`
    const { data } = await $fetch.get(url, { headers })
    const results = argsify(data)?.results ?? []

    const songs = results.map((each) => ({
      id: `${each.trackId}`,
      name: each.trackName ?? '',
      cover: each.artworkUrl600 ?? each.artworkUrl160 ?? '',
      duration: each.trackTimeMillis ? Math.floor(each.trackTimeMillis / 1000) : 0,
      artist: {
        id: `${each.collectionId ?? ''}`,
        name: each.collectionName ?? '',
        cover: '',
      },
      ext: {
        pid: each.episodeUrl ?? '',
        description: (each.description ?? '').slice(0, 500),
        pubDate: each.releaseDate ?? '',
      }
    }))

    return jsonify({ list: songs })
  }

  return jsonify({})
}

async function getSongInfo(ext) {
  const { pid, description, pubDate } = argsify(ext)
  if (!pid) return jsonify({ urls: [] })

  const lyric = [
    pubDate ? `📅 ${pubDate}` : '',
    '',
    description ?? '',
  ].filter(v => v !== undefined).join('\n')

  return jsonify({
    urls: [pid],
    lyric: lyric.trim(),
  })
}
