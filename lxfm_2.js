/*!
 * @name youtube-cantonese-audiobooks
 * @description 廣東話有聲書 YouTube Plugin
 * @version v2.0.0
 * @author custom
 * @key csp_yt_audiobook
 */

const $config = argsify($config_str)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
const IOS_UA = 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)'
const YT_API_KEY = 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc'

const CHANNELS = [
  { id: 'guided_tales',      name: '🎙️ 導聽書說',      handle: '@guided_tales' },
  { id: 'hkreadingzone',     name: '🌅 曦晨讀書會',     handle: '@hkreadingzone' },
  { id: 'mingming',          name: '📖 名名讀書會',      handle: '@名名讀書會-廣東話' },
  { id: 'cantoneseaudio',    name: '📚 廣東話書',        handle: '@Cantoneseaudiobook' },
  { id: 'wesleyvillage',     name: '🏘️ 衛斯理村',       handle: '@WesleyVillage' },
  { id: 'natetsang',         name: '🌲 松樹下說書佬',    handle: '@Natetsang825' },
  { id: 'cantoaudiobook',    name: '👩 蘭茜夫人',        handle: '@CantoAudiobook' },
  { id: 'aladdin',           name: '🪔 Aladdin Project', handle: '@aladdinproject155' },
  { id: 'laoniang',          name: '🎭 老娘有聲台',      handle: '@CantonAudioBookXEndlessLove' },
  { id: 'hkstoryteller',     name: '📜 摩登說書人',      handle: '@hkstoryteller2020' },
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

// 取得頻道 ID
async function getChannelId(handle) {
  try {
    const url = `https://www.youtube.com/${encodeURIComponent(handle)}`
    const { data } = await $fetch.get(url, {
      headers: { 'User-Agent': UA }
    })
    const match = data.match(/"channelId":"(UC[^"]+)"/)
    return match ? match[1] : null
  } catch (e) { return null }
}

// 取得頻道影片列表
async function getChannelVideos(handle, page) {
  try {
    const apiKey = getApiKey()
    const context = getContext()
    const cards = []

    if (page === 1) {
      // 先取 channelId
      const channelId = await getChannelId(handle)
      if (!channelId) return []

      $cache.set(`yt_ch_${handle}_id`, channelId)
      $cache.set(`yt_ch_${handle}_last`, 'false')

      const url = `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`
      const { data } = await $fetch.post(url, jsonify({
        context,
        browseId: channelId,
        params: 'EgZ2aWRlb3MYAyAAMAE%3D', // videos tab
      }), {
        headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }
      })

      const items = argsify(data)
        ?.contents
        ?.twoColumnBrowseResultsRenderer
        ?.tabs?.[1]
        ?.tabRenderer
        ?.content
        ?.richGridRenderer
        ?.contents ?? []

      items.forEach(e => {
        if (e.richItemRenderer) {
          const item = e.richItemRenderer?.content?.videoRenderer
          if (!item) return
          const card = makeCard(item)
          if (card) cards.push(card)
        } else if (e.continuationItemRenderer) {
          const token = e.continuationItemRenderer
            ?.continuationEndpoint
            ?.continuationCommand?.token
          if (token) $cache.set(`yt_ch_${handle}_token`, token)
        }
      })

    } else {
      const isLast = $cache.get(`yt_ch_${handle}_last`)
      if (isLast === 'true') return []

      const continuation = $cache.get(`yt_ch_${handle}_token`)
      if (!continuation) return []

      const url = `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false`
      const { data } = await $fetch.post(url, jsonify({
        context,
        continuation,
      }), {
        headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }
      })

      const items = argsify(data)
        ?.onResponseReceivedActions?.[0]
        ?.appendContinuationItemsAction
        ?.continuationItems ?? []

      items.forEach(e => {
        if (e.richItemRenderer) {
          const item = e.richItemRenderer?.content?.videoRenderer
          if (!item) return
          const card = makeCard(item)
          if (card) cards.push(card)
        } else if (e.continuationItemRenderer) {
          const token = e.continuationItemRenderer
            ?.continuationEndpoint
            ?.continuationCommand?.token
          if (token) $cache.set(`yt_ch_${handle}_token`, token)
        }
      })

      if (cards.length < 10) $cache.set(`yt_ch_${handle}_last`, 'true')
    }

    return cards
  } catch (e) { return [] }
}

function makeCard(item) {
  try {
    const vid = item.videoId ?? ''
    if (!vid) return null
    const name = item.title?.runs?.[0]?.text ?? ''
    const cover = item.thumbnail?.thumbnails?.at(-1)?.url ?? ''
    const artistName = item.ownerText?.runs?.[0]?.text
      || item.shortBylineText?.runs?.[0]?.text
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

async function getPlaylists(ext) {
  try {
    const { page, gid } = argsify(ext)
    const channel = CHANNELS.find(ch => ch.id === gid)
    if (!channel) return jsonify({ list: [] })

    if (!$cache.get('yt_api_key')) {
      try { await initSession() } catch (e) {}
    }

    const cards = await getChannelVideos(channel.handle, page)
    return jsonify({ list: cards })
  } catch (e) { return jsonify({ list: [] }) }
}

// 點入影片卡片 → 返回自身作為單集
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
        ext: { vid, name, cover, artistName }
      }]
    })
  } catch (e) { return jsonify({ list: [] }) }
}

// 取得 HLS 播放串流
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

    const apiKey = getApiKey()
    const context = getContext()
    const cards = []

    if (page === 1) {
      const url = `https://www.youtube.com/youtubei/v1/search?key=${apiKey}`
      const { data } = await $fetch.post(url, jsonify({
        context,
        query: text,
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
        if (token) $cache.set('yt_search_token', token)
      } catch (e) {}

    } else {
      const continuation = $cache.get('yt_search_token')
      if (!continuation) return jsonify({ list: [] })

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
    }

    return jsonify({ list: cards })
  } catch (e) { return jsonify({ list: [] }) }
}

async function getAlbums(ext) { return jsonify({ list: [] }) }
async function getArtists(ext) { return jsonify({ list: [] }) }
