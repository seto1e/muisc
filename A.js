/*!
 * @name librivox-audiobooks
 * @description LibriVox Free Audiobooks Plugin
 * @version v1.0.0
 * @author custom
 * @key csp_librivox
 */

const $config = argsify($config_str)
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
const headers = { 'User-Agent': UA }
const LV_API = 'https://librivox.org/api/feed/audiobooks'

const GENRES = [
  { id: 'new',       name: '🆕 最新上架',    params: 'sort_order=desc&sort_field=catalog_date' },
  { id: 'popular',   name: '🔥 最多下載',    params: 'sort_order=desc&sort_field=listeners' },
  { id: 'fiction',   name: '📖 小說',        params: 'genre=Fiction' },
  { id: 'mystery',   name: '🔍 懸疑推理',    params: 'genre=Mystery+%26+Thriller' },
  { id: 'scifi',     name: '🚀 科幻',        params: 'genre=Science+Fiction' },
  { id: 'adventure', name: '🗺️ 冒險',        params: 'genre=Adventure' },
  { id: 'romance',   name: '💝 浪漫',        params: 'genre=Romance' },
  { id: 'history',   name: '🏛️ 歷史',        params: 'genre=History' },
  { id: 'philosophy',name: '🧠 哲學',        params: 'genre=Philosophy' },
  { id: 'religion',  name: '✝️ 宗教',        params: 'genre=Religion' },
  { id: 'poetry',    name: '🎭 詩歌',        params: 'genre=Poetry' },
  { id: 'children',  name: '👧 兒童',        params: 'genre=Children' },
]

const appConfig = {
  ver: 1,
  name: 'LibriVox',
  message: '',
  desc: '免費公域有聲書',
  tabLibrary: {
    name: '探索',
    groups: GENRES.map(g => ({
      name: g.name,
      type: 'playlist',
      ui: 1,
      showMore: false,
      ext: { gid: g.id }
    }))
  },
  tabMe: {
    name: '我的',
    groups: [
      { name: '收藏書目', type: 'playlist' },
      { name: '收藏章節', type: 'song' },
    ]
  },
  tabSearch: {
    name: '搜索',
    groups: [
      { name: '書名', type: 'playlist', ext: { type: 'title' } },
      { name: '作者', type: 'playlist', ext: { type: 'author' } },
    ]
  }
}

async function getConfig() {
  return jsonify(appConfig)
}

function parseDuration(str) {
  try {
    if (!str) return 0
    if (/^\d+$/.test(str)) return parseInt(str)
    const parts = str.split(':').map(Number)
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return 0
  } catch (e) { return 0 }
}

// LibriVox API 返回書目列表
async function fetchBooks(params, offset = 0, limit = 20) {
  try {
    const url = `${LV_API}?format=json&limit=${limit}&offset=${offset}&${params}`
    const { data } = await $fetch.get(url, { headers })
    const books = argsify(data)?.books ?? []
    return books.map(book => {
      try {
        const id = `${book.id}`
        const authors = (book.authors ?? []).map(a => `${a.first_name} ${a.last_name}`.trim()).join(', ')
        const cover = book.coverart_thumbnail
          ? book.coverart_thumbnail.replace('_thumbnail', '')
          : 'https://librivox.org/images/logo.png'
        return {
          id,
          name: book.title ?? '',
          cover,
          artist: { id, name: authors },
          ext: {
            bid: id,
            url_rss: book.url_rss ?? '',
            description: (book.description ?? '').replace(/<[^>]+>/g, '').slice(0, 300),
            language: book.language ?? '',
            totaltime: book.totaltime ?? '',
          }
        }
      } catch (e) { return null }
    }).filter(Boolean)
  } catch (e) { return [] }
}

// 用 RSS 取章節列表
async function fetchChapters(rssUrl, bookCover, bookName) {
  try {
    const { data } = await $fetch.get(rssUrl, { headers })
    const $ = cheerio.load(data, { xmlMode: true })
    const podcastCover = $('channel > image > url').first().text()
      || $('itunes\\:image').first().attr('href')
      || bookCover

    const chapters = []
    $('item').each((i, el) => {
      try {
        const ele = $(el)
        const audioUrl = ele.find('enclosure').attr('url') ?? ''
        if (!audioUrl) return
        chapters.push({
          id: ele.find('guid').text() || audioUrl,
          name: ele.find('title').text() || `Chapter ${i + 1}`,
          cover: podcastCover,
          duration: parseDuration(ele.find('itunes\\:duration').text()),
          artist: { id: bookName, name: bookName, cover: podcastCover },
          ext: {
            pid: audioUrl,
            description: (ele.find('description').text() || '').replace(/<[^>]+>/g, '').slice(0, 300),
            pubDate: ele.find('pubDate').text() || '',
          }
        })
      } catch (e) {}
    })
    return chapters
  } catch (e) { return [] }
}

async function getPlaylists(ext) {
  try {
    const { page, gid } = argsify(ext)
    const offset = (page - 1) * 20
    const genre = GENRES.find(g => g.id === gid)
    if (!genre) return jsonify({ list: [] })
    const books = await fetchBooks(genre.params, offset)
    return jsonify({ list: books })
  } catch (e) { return jsonify({ list: [] }) }
}

async function getSongs(ext) {
  try {
    const { page, bid, url_rss, name } = argsify(ext)
    if (page > 1 || !bid) return jsonify({ list: [] })

    let rssUrl = url_rss ?? ''

    // 如果 ext 沒有 url_rss，用 API 查
    if (!rssUrl) {
      try {
        const { data } = await $fetch.get(
          `${LV_API}?id=${bid}&format=json`,
          { headers }
        )
        rssUrl = argsify(data)?.books?.[0]?.url_rss ?? ''
      } catch (e) { rssUrl = '' }
    }

    if (!rssUrl) return jsonify({ list: [] })

    const chapters = await fetchChapters(rssUrl, '', name ?? '')
    return jsonify({ list: chapters })
  } catch (e) { return jsonify({ list: [] }) }
}

async function getSongInfo(ext) {
  try {
    const { pid, description, pubDate } = argsify(ext)
    if (!pid) return jsonify({ urls: [] })
    return jsonify({
      urls: [pid],
      lyric: [pubDate ? `📅 ${pubDate}` : '', '', description ?? ''].filter(Boolean).join('\n'),
    })
  } catch (e) { return jsonify({ urls: [] }) }
}

async function search(ext) {
  try {
    const { text, page, type } = argsify(ext)
    if (!text || page > 3) return jsonify({ list: [] })
    const offset = (page - 1) * 20

    let params = ''
    if (type === 'author') {
      params = `author=${encodeURIComponent(text)}`
    } else {
      // 書名搜索 — LibriVox 支援部分匹配
      params = `title=${encodeURIComponent(text)}`
    }

    const books = await fetchBooks(params, offset)
    return jsonify({ list: books })
  } catch (e) { return jsonify({ list: [] }) }
}

async function getAlbums(ext) { return jsonify({ list: [] }) }
async function getArtists(ext) { return jsonify({ list: [] }) }
