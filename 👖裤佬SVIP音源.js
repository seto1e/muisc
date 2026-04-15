/*!
 * @name lxfm-joox
 * @description JOOX Music Source for LX Music
 * @version v2.0.0
 * @author kobe (modified for JOOX)
 * @key csp_lxfm_joox
 */

const $config = argsify($config_str)
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
const headers = { 'User-Agent': UA }
const GD_API = 'https://music-api.gdstudio.xyz/api.php'

// ─── App 設定 ───────────────────────────────────────────────
const appConfig = {
  ver: 1,
  name: 'JOOX',
  message: '',
  desc: 'JOOX Music via GD Studio API',
  tabLibrary: {
    name: '主頁',
    groups: [
      {
        name: '推薦歌曲',
        type: 'song',
        ui: 0,
        showMore: true,
        ext: { gid: 'joox_hot' }
      },
      {
        name: '熱門歌單',
        type: 'playlist',
        ui: 1,
        showMore: true,
        ext: { gid: 'joox_playlist' }
      },
    ]
  },
  tabMe: {
    name: '我的',
    groups: [
      { name: '音樂', type: 'song' },
      { name: '歌單', type: 'playlist' },
      { name: '專輯', type: 'album' },
      { name: '歌手', type: 'artist' },
    ]
  },
  tabSearch: {
    name: '搜索',
    groups: [
      {
        name: '歌曲',
        type: 'song',
        ext: { type: 'song' }
      },
      {
        name: '歌單',
        type: 'playlist',
        ext: { type: 'playlist' }
      },
    ]
  }
}

async function getConfig() {
  return jsonify(appConfig)
}

// ─── 輔助：搜索 JOOX ─────────────────────────────────────────
async function gdSearch(name, page = 1, count = 20) {
  const url = `${GD_API}?types=search&source=joox&name=${encodeURIComponent(name)}&count=${count}&pages=${page}`
  const { data } = await $fetch.get(url, { headers })
  return Array.isArray(data) ? data : argsify(data)
}

// ─── 輔助：格式化單首歌 ──────────────────────────────────────
function formatSong(each) {
  const artists = Array.isArray(each.artist)
    ? each.artist
    : [{ name: each.artist ?? '' }]
  const artistName = artists.map(a => a.name ?? a).join('/')
  const songId = each.id ?? each.track_id ?? ''
  const songName = each.name ?? each.title ?? ''
  const picId = each.pic_id ?? ''
  const lyricId = each.lyric_id ?? songId

  return {
    id: `${songId}`,
    name: songName,
    cover: picId
      ? `${GD_API}?types=pic&source=joox&id=${picId}&size=500`
      : '',
    duration: each.duration ?? 0,
    artist: {
      id: `${artists[0]?.id ?? artistName}`,
      name: artistName,
      cover: '',
    },
    ext: {
      source: 'joox',
      songmid: `${songId}`,
      singer: artistName,
      songName: songName,
      lyricId: `${lyricId}`,
    }
  }
}

// ─── 主頁歌曲（熱門推薦，用搜索代替） ──────────────────────
async function getSongs(ext) {
  const { page, gid, id } = argsify(ext)

  // 熱門推薦：用熱門關鍵詞搜索
  if (gid === 'joox_hot') {
    if (page > 1) return jsonify({ list: [] })
    const results = await gdSearch('top hits', 1, 30)
    const list = Array.isArray(results) ? results : []
    return jsonify({ list: list.map(formatSong) })
  }

  // 歌單內歌曲
  if (gid === 'joox_playlist' && id) {
    if (page > 1) return jsonify({ list: [] })
    const url = `${GD_API}?types=playlist&source=joox_playlist&id=${encodeURIComponent(id)}`
    const { data } = await $fetch.get(url, { headers })
    const tracks = Array.isArray(data) ? data : (argsify(data)?.tracks ?? [])
    return jsonify({ list: tracks.map(formatSong) })
  }

  return jsonify({ list: [] })
}

// ─── 歌單列表 ────────────────────────────────────────────────
async function getPlaylists(ext) {
  const { page, gid } = argsify(ext)
  if (page > 1) return jsonify({ list: [] })

  if (gid === 'joox_playlist') {
    // gdstudio 暫時冇直接 JOOX playlist 列表端點
    // 用幾個固定熱門搜索詞代替展示歌單入口
    const keywords = ['Cantonese', 'Mandarin', 'K-pop', 'J-pop', 'HK Top']
    const cards = keywords.map((kw, i) => ({
      id: `search_${kw}`,
      name: `${kw} 精選`,
      cover: '',
      artist: { id: 'joox', name: 'JOOX' },
      ext: {
        gid: 'joox_search_playlist',
        id: `search_${kw}`,
        keyword: kw,
        type: 'playlist'
      }
    }))
    return jsonify({ list: cards })
  }

  return jsonify({ list: [] })
}

// ─── 搜索 ────────────────────────────────────────────────────
async function search(ext) {
  const { text, page, type } = argsify(ext)
  if (page > 5) return jsonify({})

  if (type === 'song') {
    const results = await gdSearch(text, page, 20)
    const list = Array.isArray(results) ? results : []
    return jsonify({ list: list.map(formatSong) })
  }

  if (type === 'playlist') {
    // 用搜索結果模擬歌單（按歌手名聚合）
    const results = await gdSearch(text, page, 20)
    const list = Array.isArray(results) ? results : []
    const cards = list.map((each) => {
      const artists = Array.isArray(each.artist)
        ? each.artist
        : [{ name: each.artist ?? '' }]
      const artistName = artists.map(a => a.name ?? a).join('/')
      return {
        id: `${each.id ?? ''}`,
        name: each.name ?? '',
        cover: each.pic_id
          ? `${GD_API}?types=pic&source=joox&id=${each.pic_id}&size=500`
          : '',
        artist: { id: artistName, name: artistName },
        ext: {
          gid: 'joox_playlist',
          id: `${each.id ?? ''}`,
          type: 'playlist'
        }
      }
    })
    return jsonify({ list: cards })
  }

  return jsonify({})
}

// ─── 獲取播放 URL（核心） ────────────────────────────────────
async function getSongInfo(ext) {
  const { source, songmid, singer, songName, lyricId } = argsify(ext)

  if (!songmid) return jsonify({ urls: [] })

  try {
    const { data } = await $fetch.get(
      `${GD_API}?types=url&source=joox&id=${encodeURIComponent(songmid)}&br=320`,
      { headers }
    )
    const info = typeof data === 'string' ? argsify(data) : data
    const soundurl = info?.url ?? null

    return jsonify({ urls: soundurl ? [soundurl] : [] })
  } catch (e) {
    return jsonify({ urls: [] })
  }
}

// ─── 獲取歌詞 ────────────────────────────────────────────────
async function getLyric(ext) {
  const { lyricId, songmid } = argsify(ext)
  const id = lyricId ?? songmid

  if (!id) return jsonify({ lyric: '', tlyric: '' })

  try {
    const { data } = await $fetch.get(
      `${GD_API}?types=lyric&source=joox&id=${encodeURIComponent(id)}`,
      { headers }
    )
    const info = typeof data === 'string' ? argsify(data) : data
    return jsonify({
      lyric: info?.lyric ?? info?.lrc ?? '',
      tlyric: info?.tlyric ?? '',
    })
  } catch (e) {
    return jsonify({ lyric: '', tlyric: '' })
  }
}

// ─── 專輯（備用） ────────────────────────────────────────────
async function getAlbums(ext) {
  return jsonify({ list: [] })
}

async function getArtists(ext) {
  return jsonify({ list: [] })
}
