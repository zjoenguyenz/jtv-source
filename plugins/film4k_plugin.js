// =============================================================================
// Film4K v1.0.0 — film4k.net public JSON API (no auth).
// Written 2026-11-14 from the TV side's leader-verified chain
// (LINK-HUNT B-1): catalogue /api/home (+type/genre/page filters),
// detail /api/title/<slug>, playback /api/watch/<slug> whose
// sources[] carry a FRESH tokenised /api/hls/<token>/master.m3u8.
// Plays from a US IP — no tunnel needed. Segments are PNG-prefixed
// fMP4 on a TikTok CDN; the app's HLS proxy strips the prefix when
// the native player rejects a segment.
// =============================================================================

function getManifest() {
    return JSON.stringify({
        "id": "film4k",
        "name": "Film4K",
        "version": "1.0.0",
        "baseUrl": "https://film4k.net",
        "iconUrl": "",
        "isEnabled": true,
        "isAdult": false,
        "type": "VIDEO",
        "playerType": "native",
        "layoutType": "HORIZONTAL"
    });
}

var F4_GENRES = ['Phim Hành Động', 'Phim Hài', 'Phim Chính Kịch', 'Phim Hình Sự', 'Phim Kinh Dị', 'Phim Hoạt Hình', 'Phim Phiêu Lưu', 'Phim Lãng Mạn', 'Phim Khoa Học Viễn Tưởng', 'Phim Giả Tượng'];

function getHomeSections() {
    return JSON.stringify([
        { slug: 'movie', title: 'Phim Lẻ', type: 'Horizontal', path: '' },
        { slug: 'tv', title: 'Phim Bộ', type: 'Horizontal', path: '' },
        { slug: 'genre:Phim Hành Động', title: 'Hành Động', type: 'Horizontal', path: '' },
        { slug: 'genre:Phim Hài', title: 'Phim Hài', type: 'Horizontal', path: '' },
        { slug: 'home', title: 'Mới Nhất', type: 'Grid', path: '' }
    ]);
}

function getPrimaryCategories() {
    var cats = [
        { name: 'Phim Lẻ', slug: 'movie' },
        { name: 'Phim Bộ', slug: 'tv' }
    ];
    for (var i = 0; i < F4_GENRES.length; i++) {
        cats.push({ name: F4_GENRES[i].replace(/^Phim /, ''), slug: 'genre:' + F4_GENRES[i] });
    }
    return JSON.stringify(cats);
}

function getFilterConfig() {
    return JSON.stringify({});
}

// =============================================================================
// URL GENERATION
// =============================================================================

var F4_BASE = "https://film4k.net";

function getUrlList(slug, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;
    if (slug === 'movie' || slug === 'tv') {
        return F4_BASE + "/api/home?type=" + slug + "&page=" + page;
    }
    if (slug && slug.indexOf('genre:') === 0) {
        return F4_BASE + "/api/home?genre=" + encodeURIComponent(slug.slice(6)) + "&page=" + page;
    }
    return F4_BASE + "/api/home?page=" + page;
}

function getUrlSearch(keyword, filtersJson) {
    return F4_BASE + "/api/search/suggest?q=" + encodeURIComponent(keyword);
}

function getUrlDetail(slug) {
    if (!slug) return "";
    if (slug.indexOf("http") === 0) return slug;
    return F4_BASE + "/api/title/" + slug;
}

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// =============================================================================
// LIST PARSING (home / type / genre lists + search suggestions share
// the same item shape)
// =============================================================================

function f4Title(t) {
    if (!t) return "";
    if (typeof t === 'string') return t;
    return t.vi || t.en || "";
}

function f4Poster(p, fallback) {
    if (!p) return fallback || "";
    if (typeof p === 'string') return p;
    return p.vi || p.en || fallback || "";
}

function f4ParseList(text) {
    var j;
    try { j = JSON.parse(text); } catch (e) { return { items: [], pagination: { currentPage: 1, totalPages: 1 } }; }
    var list = j.list || [];
    var items = [];
    for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (!it.slug) continue;
        var poster = f4Poster(it.poster, it.backdrop);
        items.push({
            id: it.slug,
            title: f4Title(it.title),
            posterUrl: poster,
            backdropUrl: it.backdrop || poster,
            year: it.year || 0
        });
    }
    var page = j.page || 1;
    var totalPages = page;
    if (typeof j.total === 'number' && list.length > 0) {
        totalPages = Math.max(page, Math.ceil(j.total / list.length));
    } else if (j.more) {
        totalPages = page + 1;
    }
    return { items: items, pagination: { currentPage: page, totalPages: totalPages } };
}

function parseListResponse(text) {
    return JSON.stringify(f4ParseList(text));
}

function parseSearchResponse(text) {
    return JSON.stringify(f4ParseList(text));
}

// =============================================================================
// DETAIL — /api/title/<slug>: meta in .movie, episode list in
// .episodes. Episode ids point at the watch endpoint (fresh token
// at tap time) with a #s<season>e<episode> fragment.
// =============================================================================

function parseMovieDetail(text, pageUrl) {
    try {
        var j = JSON.parse(text);
        var m = j.movie || {};
        var slug = m.slug || "";
        var title = f4Title(m.title);
        var poster = f4Poster(m.poster, m.backdrop);
        var overview = (m.overview && (m.overview.vi || m.overview.en)) || "";
        var genres = (m.genres && m.genres.vi) ? m.genres.vi.join(", ") : "";

        var episodes = [];
        var rawEps = j.episodes || [];
        for (var i = 0; i < rawEps.length; i++) {
            var ep = rawEps[i];
            var season = ep.season || 1;
            var number = ep.episode || (i + 1);
            var name = "Tập " + number;
            if (ep.title) name += " — " + ep.title;
            episodes.push({
                id: F4_BASE + "/api/watch/" + slug + "#s" + season + "e" + number,
                name: name,
                slug: "s" + season + "e" + number
            });
        }
        if (episodes.length === 0) {
            episodes.push({
                id: F4_BASE + "/api/watch/" + slug + "#s1e1",
                name: "Full",
                slug: "full"
            });
        }

        return JSON.stringify({
            id: slug,
            title: title,
            posterUrl: poster,
            backdropUrl: m.backdrop || poster,
            description: overview,
            servers: [{ name: "Server 1", episodes: episodes }],
            category: genres,
            status: m.mediaType === 'tv' ? "Đang chiếu" : "Full",
            year: m.year || 0
        });
    } catch (e) {
        return "null";
    }
}

// =============================================================================
// STREAM RESOLUTION — /api/watch/<slug> JSON: movies carry sources[]
// at the top level; series carry episodes[] with per-episode
// sources[]. The fragment selects the episode.
// =============================================================================

function parseDetailResponse(text, fetchedUrl) {
    try {
        var j = JSON.parse(text);
        var streamPath = "";
        if (j.sources && j.sources.length && j.sources[0].url) {
            streamPath = j.sources[0].url;
        }
        if (!streamPath && j.episodes && j.episodes.length) {
            var season = 1, number = 1;
            if (fetchedUrl) {
                var fm = fetchedUrl.match(/#s(\d+)e(\d+)/);
                if (fm) { season = parseInt(fm[1]); number = parseInt(fm[2]); }
            }
            var chosen = null;
            for (var i = 0; i < j.episodes.length; i++) {
                var ep = j.episodes[i];
                if ((ep.season || 1) === season && (ep.episode || (i + 1)) === number) { chosen = ep; break; }
            }
            if (!chosen) chosen = j.episodes[0];
            if (chosen && chosen.sources && chosen.sources.length) {
                streamPath = chosen.sources[0].url;
            }
        }
        if (!streamPath && j.hlsUrl) streamPath = j.hlsUrl;
        if (!streamPath) {
            return JSON.stringify({ url: "", isEmbed: false, headers: {} });
        }
        var url = streamPath.indexOf("http") === 0 ? streamPath : F4_BASE + streamPath;
        return JSON.stringify({
            url: url,
            isEmbed: false,
            headers: { "Referer": F4_BASE + "/" }
        });
    } catch (error) {
        return JSON.stringify({ url: "", isEmbed: false, headers: {} });
    }
}
