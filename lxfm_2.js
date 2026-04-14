/*!
 * @name youtube-cantonese-audiobooks
 * @description 廣東話有聲書 YouTube Plugin
 * @version v3.2.0
 * @author custom
 * @key csp_yt_audiobook
 */

const $config = argsify($config_str)
const CryptoJS = createCryptoJS()
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
const ANDROID_UA = 'com.google.android.youtube/18.11.34 (Linux; U; Android 11)'
const YT_API_KEY = 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc'

const CHANNELS = [
  { id: 'guided_tales',   name: '🎙️ 導聽書說',      query: '導聽書說 廣東話有聲書' },
  { id: 'hkreadingzone',  name: '🌅 曦晨讀書會',     query: '曦晨讀書會 廣東話' },
  { id: 'mingming',       name: '📖 名名讀書會',      query: '名名讀書會 廣東話' },
  { id: 'cantoneseaudio', name: '📚 廣東話書',        query: '廣東話書 Cantoneseaudiobook' },
  { id: 'wesleyvillage',  name: '🏘️ 衛斯理村',       query: '衛斯理村 Wesley Village 廣東話' },
  { id: 'natetsang',      name: '🌲 松樹下說書佬',    query: '松樹下說書佬 廣東話' },
  { id: 'cantoaudiobook', name: '👩 蘭茜夫人',        query: '蘭茜夫人 廣東話有聲書' },
  { id: 'aladdin',        name: '🪔 Aladdin Project', query: 'Aladdin Project 廣東話有聲書' },
  { id: 'laoniang',       name: '🎭 老娘有聲台',      query: '老娘有聲台 廣東話有聲書' },
  { id: 'hkstoryteller',  name: '📜 摩登說書人',      query: '摩登說書人 廣東話' },
]

const appConfig = {
  ver: 1,
  name: 'YT有聲書',
  message: '',
  desc: '廣東話 YouTube 有聲書頻道',
  tabLibrary: {
    name: '頻道',
    groups: CHANNELS.map(ch => ({
      name: ch.name,
      type: 'playlist',
      ui: 1,
      showMore: false,
      ext: { gid: ch.id }
    }))
  },
  tabMe: {
    name: '我的',
    groups: [
      { name: '收藏影片', type: 'playlist' },
      { name: '收藏單集', type: 'song' },
    ]
  },
  tabSearch: {
    name: '搜索',
    groups: [
      { name: '搜索影片', type: 'playlist', ext: { type: 'search' } },
    ]
  }
}

async function getConfig() {
  try { await initSession() } catch (e) {}
  return jsonify(appConfig)
}

async function initSession() {
  try {
    const { data } = await $fetch.get('https://www.youtube.com', {
      headers: { 'User-Agent': UA }
    })
    const match = data.replace(/\n/g, '').match(/ytplayer=\{\};ytcfg\.set\((.*?)\);/)
    if (!match) return
    const ytcfg = JSON.parse(match[1])
    $cache.set('yt_api_key', ytcfg.INNERTUBE_API_KEY || YT_API_KEY)
    $cache.set('yt_context', jsonify(ytcfg.INNERTUBE_CONTEXT))
  } catch (e) {
    $cache.set('yt_api_key', YT_API_KEY)
  }
}

function getApiKey() {
  return $cache.get('yt_api_key') || YT_API_KEY
}

function getContext() {
  try {
    return argsify($cache.get('yt_context')) || getDefaultContext()
  } catch (e) { return getDefaultContext() }
}

function getDefaultContext() {
  return {
    client: {
      clientName: 'WEB',
      clientVersion: '2.20231121.08.00',
      hl: 'zh-HK',
    }
  }
}

function getSearchParam() {
  try {
    const d = new Uint8Array(50)
    let t = 0
    d[t++] = 0x12
    const c = t++
    d[t++] = 0x10
    d[t++] = 1
    d[c] = t - c - 1
    const n = CryptoJS.lib.WordArray.create(d.slice(0, t))
    return encodeURIComponent(CryptoJS.enc.Base64.stringify(n))
  } catch (e) { return '' }
}

function makeCard(item) {
  try {
    const vid = item?.videoId ?? ''
    if (!vid) return null
    const name = item?.title?.runs?.[0]?.text ?? ''
    const cover = item?.thumbnail?.thumbnails?.at(-1)?.url ?? ''
    const artistName = item?.ownerText?.runs?.[0]?.text
      || item?.shortBylineText?.runs?.[0]?.text
      || ''
    return {
      id: vid,
      name,
      cover,
      artist: { id: artistName, name: artistName },
      ext: { vid, name, cover, artistName }
    }
  } catch (e) { return null }
}

async function searchVideos(query, page, cachePrefix) {
  try {
    const apiKey = getApiKey()
    const context = getContext()
    const cards = []

    if (page === 1) {
      const url = `https://www.youtube.com/youtubei/v1/search?key=${apiKey}`
      const { data } = await $fetch.post(url, jsonify({
        context,
        params: getSearchParam(),
        query,
      }), {
        headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }
      })

      const items = argsify(data)
        ?.contents
        ?.twoColumnSearchResultsRenderer
        ?.primaryContents
        ?.sectionListRenderer
        ?.contents?.[0]
        ?.itemSectionRenderer
        ?.contents ?? []

      items.forEach(e => {
        if (!e.videoRenderer) return
        const card = makeCard(e.videoRenderer)
        if (card) cards.push(card)
      })

      try {
        const token = argsify(data)
          ?.contents
          ?.twoColumnSearchResultsRenderer
          ?.primaryContents
          ?.sectionListRenderer
          ?.contents?.[1]
          ?.continuationItemRenderer
          ?.continuationEndpoint
          ?.continuationCommand?.token
        if (token) $cache.set(`${cachePrefix}_token`, token)
      } catch (e) {}

    } else {
      const continuation = $cache.get(`${cachePrefix}_token`)
      if (!continuation) return []

      const url = `https://www.youtube.com/youtubei/v1/search?prettyPrint=false`
      const { data } = await $fetch.post(url, jsonify({
        context,
        continuation,
      }), {
        headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }
      })

      const items = argsify(data)
        ?.onResponseReceivedCommands?.[0]
        ?.appendContinuationItemsAction
        ?.continuationItems?.[0]
        ?.itemSectionRenderer?.contents ?? []

      items.forEach(e => {
        if (!e.videoRenderer) return
        const card = makeCard(e.videoRenderer)
        if (card) cards.push(card)
      })

      try {
        const token = argsify(data)
          ?.onResponseReceivedCommands?.[0]
          ?.appendContinuationItemsAction
          ?.continuationItems?.[1]
          ?.continuationItemRenderer
          ?.continuationEndpoint
          ?.continuationCommand?.token
        if (token) $cache.set(`${cachePrefix}_token`, token)
      } catch (e) {}
    }

    return cards
  } catch (e) { return [] }
}

async function getPlaylists(ext) {
  try {
    const { page, gid } = argsify(ext)
    const channel = CHANNELS.find(ch => ch.id === gid)
    if (!channel) return jsonify({ list: [] })

    if (!$cache.get('yt_api_key')) {
      try { await initSession() } catch (e) {}
    }

    const cards = await searchVideos(channel.query, page, `yt_ch_${gid}`)
    return jsonify({ list: cards })
  } catch (e) { return jsonify({ list: [] }) }
}

async function getSongs(ext) {
  try {
    const { vid, name, cover, artistName } = argsify(ext)
    if (!vid) return jsonify({ list: [] })
    return jsonify({
      list: [{
        id: vid,
        name: name ?? '播放',
        cover: cover ?? '',
        duration: 0,
        artist: { id: artistName ?? '', name: artistName ?? '' },
        ext: { vid }
      }]
    })
  } catch (e) { return jsonify({ list: [] }) }
}

// Android client — 更大機會返回直接可播放 URL
async function getSongInfo(ext) {
  try {
    const { vid } = argsify(ext)
    if (!vid) return jsonify({ urls: [] })

    const { data } = await $fetch.post(
      `https://www.youtube.com/youtubei/v1/player?key=${YT_API_KEY}&prettyPrint=false`,
      jsonify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '18.11.34',
            androidSdkVersion: 30,
            hl: 'zh-HK',
            timeZone: 'UTC',
            utcOffsetMinutes: 0,
          }
        },
        videoId: vid,
        playbackContext: {
          contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' }
        },
        contentCheckOk: true,
        racyCheckOk: true,
      }),
      {
        headers: {
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': '18.11.34',
          Origin: 'https://www.youtube.com',
          'User-Agent': ANDROID_UA,
          'content-type': 'application/json',
        }
      }
    )

    const parsed = argsify(data)

    // 優先：adaptiveFormats 音頻直接 URL
    const audioFormats = (parsed?.streamingData?.adaptiveFormats ?? [])
      .filter(f => f.mimeType?.startsWith('audio/mp4') && f.url)
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))

    if (audioFormats.length > 0) {
      return jsonify({ urls: [audioFormats[0].url] })
    }

    // 備用：普通 formats 直接 URL
    const normalFormats = (parsed?.streamingData?.formats ?? [])
      .filter(f => f.url)
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))

    if (normalFormats.length > 0) {
      return jsonify({ urls: [normalFormats[0].url] })
    }

    // 最後備用：HLS
    const hlsUrl = parsed?.streamingData?.hlsManifestUrl ?? ''
    if (hlsUrl) return jsonify({ urls: [hlsUrl] })

    return jsonify({ urls: [] })
  } catch (e) { return jsonify({ urls: [] }) }
}

async function search(ext) {
  try {
    const { text, page } = argsify(ext)
    if (!text) return jsonify({ list: [] })

    if (!$cache.get('yt_api_key')) {
      try { await initSession() } catch (e) {}
    }

    const cards = await searchVideos(text, page, 'yt_search')
    return jsonify({ list: cards })
  } catch (e) { return jsonify({ list: [] }) }
}

async function getAlbums(ext) { return jsonify({ list: [] }) }
async function getArtists(ext) { return jsonify({ list: [] }) }
