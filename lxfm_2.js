/*!
 * @name youtube-cantonese-audiobooks
 * @description 廣東話有聲書 YouTube Plugin
 * @version v1.0.0
 * @author custom
 * @key csp_yt_audiobook
 */

const $config = argsify($config_str)
const CryptoJS = createCryptoJS()
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
const IOS_UA = 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)'
const YT_API_KEY = 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc'

// 預設搜索頻道／播放清單
const FEATURED = [
  { id: 'search_cantonese',  name: '🎙️ 廣東話有聲書',   query: '廣東話有聲書' },
  { id: 'search_novel',      name: '📖 廣東話小說',      query: '廣東話小說朗讀' },
  { id: 'search_classic',    name: '🏛️ 廣東話經典名著',  query: '廣東話經典名著有聲書' },
  { id: 'search_kids',       name: '👧 廣東話兒童故事',  query: '廣東話兒童故事' },
  { id: 'search_biz',        name: '💼 廣東話商業書籍',  query: '廣東話商業書有聲書' },
  { id: 'search_health',     name: '🏃 廣東話健康養生',  query: '廣東話健康養生有聲書' },
]

const appConfig = {
  ver: 1,
  name: 'YT有聲書',
  message: '',
  desc: '廣東話 YouTube 有聲書',
  tabLibrary: {
    name: '探索',
    groups: FEATURED.map(f => ({
      name: f.name,
      type: 'playlist',
      ui: 1,
      showMore: false,
      ext: { gid: f.id }
    }))
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
      { name: '影片', type: 'playlist', ext: { type: 'video' } },
    ]
  }
}

async function getConfig() {
  try {
    await initSession()
  } catch (e) {}
  return jsonify(appConfig)
}

// 初始化 session — 取得 API key 同 context
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
    // fallback 用硬編碼 key
    $cache.set('yt_api_key', YT_API_KEY)
  }
}

function getApiKey() {
  return $cache.get('yt_api_key') || YT_API_KEY
}

function getContext() {
  try {
    return argsify($cache.get('yt_context')) || getDefaultContext()
  } catch (e) {
    return getDefaultContext()
  }
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
    d[t++] = 1 // videos only
    d[c] = t - c - 1
    const n = CryptoJS.lib.WordArray.create(d.slice(0, t))
    return encodeURIComponent(CryptoJS.enc.Base64.stringify(n))
  } catch (e) { return '' }
}

// 搜索 YouTube 影片
async function searchVideos(query, page) {
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
        const item = e.videoRenderer
        cards.push({
          id: item.videoId,
          name: item.title?.runs?.[0]?.text ?? '',
          cover: item.thumbnail?.thumbnails?.at(-1)?.url ?? '',
          artist: {
            id: item.ownerText?.runs?.[0]?.text ?? '',
            name: item.ownerText?.runs?.[0]?.text ?? '',
          },
          ext: { vid: item.videoId }
        })
      })

      // 儲存 continuation token
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
        if (token) $cache.set('yt_search_token', token)
      } catch (e) {}

    } else {
      // 翻頁
      const continuation = $cache.get('yt_search_token')
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
        const item = e.videoRenderer
        cards.push({
          id: item.videoId,
          name: item.title?.runs?.[0]?.text ?? '',
          cover: item.thumbnail?.thumbnails?.at(-1)?.url ?? '',
          artist: {
            id: item.ownerText?.runs?.[0]?.text ?? '',
            name: item.ownerText?.runs?.[0]?.text ?? '',
          },
          ext: { vid: item.videoId }
        })
      })

      try {
        const token = argsify(data)
          ?.onResponseReceivedCommands?.[0]
          ?.appendContinuationItemsAction
          ?.continuationItems?.[1]
          ?.continuationItemRenderer
          ?.continuationEndpoint
          ?.continuationCommand?.token
        if (token) $cache.set('yt_search_token', token)
      } catch (e) {}
    }

    return cards
  } catch (e) { return [] }
}

async function getPlaylists(ext) {
  try {
    const { page, gid } = argsify(ext)
    const feature = FEATURED.find(f => f.id === gid)
    if (!feature) return jsonify({ list: [] })

    // 確保 session 已初始化
    if (!$cache.get('yt_api_key')) {
      try { await initSession() } catch (e) {}
    }

    const cards = await searchVideos(feature.query, page)
    return jsonify({ list: cards })
  } catch (e) { return jsonify({ list: [] }) }
}

// 影片卡片點入 — 直接返回單個播放項目
async function getSongs(ext) {
  try {
    const { vid, name, cover } = argsify(ext)
    if (!vid) return jsonify({ list: [] })
    return jsonify({
      list: [{
        id: vid,
        name: name ?? '播放',
        cover: cover ?? '',
        artist: { id: '', name: '' },
        ext: { vid }
      }]
    })
  } catch (e) { return jsonify({ list: [] }) }
}

// 取得播放 URL
async function getSongInfo(ext) {
  try {
    const { vid } = argsify(ext)
    if (!vid) return jsonify({ urls: [] })

    const { data } = await $fetch.post(
      `https://www.youtube.com/youtubei/v1/player?key=${YT_API_KEY}&prettyPrint=false`,
      jsonify({
        context: {
          client: {
            clientName: 'IOS',
            clientVersion: '19.09.3',
            deviceModel: 'iPhone14,3',
            userAgent: IOS_UA,
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
          'X-YouTube-Client-Name': '5',
          'X-YouTube-Client-Version': '19.09.3',
          Origin: 'https://m.youtube.com',
          'User-Agent': IOS_UA,
          'content-type': 'application/json',
        }
      }
    )

    const playUrl = argsify(data)?.streamingData?.hlsManifestUrl ?? ''
    if (!playUrl) return jsonify({ urls: [] })
    return jsonify({ urls: [playUrl] })
  } catch (e) { return jsonify({ urls: [] }) }
}

async function search(ext) {
  try {
    const { text, page } = argsify(ext)
    if (!text) return jsonify({ list: [] })

    if (!$cache.get('yt_api_key')) {
      try { await initSession() } catch (e) {}
    }

    const cards = await searchVideos(text, page)
    return jsonify({ list: cards })
  } catch (e) { return jsonify({ list: [] }) }
}

async function getAlbums(ext) { return jsonify({ list: [] }) }
async function getArtists(ext) { return jsonify({ list: [] }) }
