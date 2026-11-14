// =============================================================================
// RAP PHIM PLUGIN - https://api.rapphim.tv  (ported from the Joe TV / TV Phim
// Android app's verified RpApi client, 2026-11-13)
// RapPhim's OWN public API + own stream CDN. No account, no token, and it
// answers from US IPs directly (no Vietnam tunnel needed).
//   GET /api/homepage/sections            -> {data:[{title, movies:[...]}]}
//   GET /api/movies/slug/{slug}           -> {data:{..., episodes:[{...,
//        sources:[{serverName, serverIndex, url, quality, type:"hls"}]}]}}
//   GET /api/movies/search/autocomplete?q= -> {data:{suggestions:[...]}}
// Fallback base if .tv dies: https://api.rapphim.vip (same paths).
// =============================================================================

var RP_BASE = "https://api.rapphim.tv";

function getManifest() {
    return JSON.stringify({
        "id": "rapphim",
        "name": "RapPhim",
        "version": "1.0.0",
        "baseUrl": RP_BASE,
        "iconUrl": "https://rapphim.tv/favicon.ico",
        "isEnabled": true,
        "type": "MOVIE"
    });
}

function getHomeSections() {
    // The API returns all rails in one payload; the plugin contract loads
    // one list per section, so RapPhim exposes a single merged rail.
    return JSON.stringify([
        { slug: 'sections', title: 'Mới Cập Nhật', type: 'Grid', path: '' }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'Mới cập nhật', slug: 'sections' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({ sort: [], category: [] });
}

function getUrlList(slug, filtersJson) {
    return RP_BASE + "/api/homepage/sections";
}

function getUrlSearch(keyword, filtersJson) {
    return RP_BASE + "/api/movies/search/autocomplete?q=" + encodeURIComponent(keyword || "");
}

function getUrlDetail(slug) {
    if (!slug) return "";
    if (slug.indexOf("http") === 0) return slug;
    return RP_BASE + "/api/movies/slug/" + slug;
}

function getUrlCategories() { return ""; }
function getUrlCountries()  { return ""; }
function getUrlYears()      { return ""; }

function rpMovie(o, posterKey) {
    var poster = o.poster || o.posterUrl || "";
    if (poster && poster.indexOf("/") === 0) poster = RP_BASE + poster;
    var year = 0;
    var y = o.releaseYear != null ? o.releaseYear : o.year;
    if (y != null) { var yi = parseInt(y); if (!isNaN(yi)) year = yi; }
    var total = o.totalEpisodes || o.episodeCount || 0;
    return {
        id: o.slug || "",
        title: o.title || o.name || "",
        origin_name: o.originalTitle || "",
        posterUrl: poster,
        backdropUrl: poster,
        description: o.description || "",
        year: year,
        quality: o.quality || "",
        episode_current: total > 1 ? (total + " tập") : (o.type === "series" ? "Đang chiếu" : "Full"),
        lang: o.lang || ""
    };
}

function parseListResponse(text) {
    try {
        var root = JSON.parse(text);
        var rails = root.data || [];
        var seen = {};
        var items = [];
        for (var i = 0; i < rails.length; i++) {
            var movies = rails[i].movies || [];
            for (var j = 0; j < movies.length; j++) {
                var m = rpMovie(movies[j]);
                if (m.id && !seen[m.id]) { seen[m.id] = true; items.push(m); }
            }
        }
        if (items.length > 60) items = items.slice(0, 60);
        return JSON.stringify({
            items: items,
            pagination: { currentPage: 1, totalPages: 1, totalItems: items.length, itemsPerPage: items.length }
        });
    } catch (e) {
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 0 } });
    }
}

function parseSearchResponse(text) {
    try {
        var root = JSON.parse(text);
        var sugg = (root.data && root.data.suggestions) || [];
        var items = [];
        for (var i = 0; i < sugg.length; i++) {
            var m = rpMovie(sugg[i]);
            if (m.id) items.push(m);
        }
        return JSON.stringify({
            items: items,
            pagination: { currentPage: 1, totalPages: 1, totalItems: items.length, itemsPerPage: items.length }
        });
    } catch (e) {
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 0 } });
    }
}

function rpQualityScore(q) {
    if (!q) return 0;
    var t = String(q).trim().toLowerCase();
    if (t === "auto") return 1;
    var digits = "";
    for (var i = 0; i < t.length; i++) {
        var ch = t.charAt(i);
        if (ch >= '0' && ch <= '9') digits += ch; else break;
    }
    return digits ? parseInt(digits) : 0;
}

function parseMovieDetail(text, pageUrl) {
    try {
        var root = JSON.parse(text);
        var data = root.data;
        if (!data) return "null";
        var m = rpMovie(data);

        var eps = (data.episodes || []).slice();
        eps.sort(function (a, b) {
            var sa = a.season || 0, sb = b.season || 0;
            if (sa !== sb) return sa - sb;
            return (a.episodeNumber || 0) - (b.episodeNumber || 0);
        });
        var seriesShape = eps.length > 1 || data.type === "series";
        var multiSeason = false;
        if (eps.length) {
            var firstSeason = eps[0].season || 0;
            for (var i = 0; i < eps.length; i++) if ((eps[i].season || 0) !== firstSeason) { multiSeason = true; break; }
        }

        // Server order by lowest serverIndex.
        var order = [];
        var orderSeen = {};
        for (var i = 0; i < eps.length; i++) {
            var srcs = eps[i].sources || [];
            for (var j = 0; j < srcs.length; j++) {
                var nm = srcs[j].serverName || "Server";
                var key = (srcs[j].serverIndex != null ? srcs[j].serverIndex : j) + "|" + nm;
                if (!orderSeen[key]) { orderSeen[key] = true; order.push({ idx: srcs[j].serverIndex != null ? srcs[j].serverIndex : j, name: nm }); }
            }
        }
        order.sort(function (a, b) { return a.idx - b.idx; });
        var serversByName = {};
        var serverList = [];
        for (var i = 0; i < order.length; i++) {
            if (!serversByName[order[i].name]) {
                var srv = { name: order[i].name, episodes: [] };
                serversByName[order[i].name] = srv;
                serverList.push(srv);
            }
        }

        for (var i = 0; i < eps.length; i++) {
            var e = eps[i];
            var epName = "Full";
            if (seriesShape) {
                epName = "Tập " + (e.episodeNumber || "");
                if (multiSeason && (e.season || 0) > 0) epName = "S" + e.season + " · " + epName;
                if (e.title) epName = epName + "";
            }
            var best = {};
            var srcs = e.sources || [];
            for (var j = 0; j < srcs.length; j++) {
                var s = srcs[j];
                if (!s.url) continue;
                var sname = s.serverName || "Server";
                var score = rpQualityScore(s.quality);
                if (!best[sname] || score > best[sname].score) best[sname] = { url: s.url, score: score };
            }
            var names = Object.keys(best);
            for (var k = 0; k < names.length; k++) {
                var sv = serversByName[names[k]];
                if (sv) sv.episodes.push({ id: best[names[k]].url, name: epName, slug: "ep-" + (e.episodeNumber || i) });
            }
            if (names.length === 0 && e.videoUrl) {
                if (!serversByName["RapPhim"]) {
                    var fb = { name: "RapPhim", episodes: [] };
                    serversByName["RapPhim"] = fb;
                    serverList.push(fb);
                }
                serversByName["RapPhim"].episodes.push({ id: e.videoUrl, name: epName, slug: "ep-" + (e.episodeNumber || i) });
            }
        }
        serverList = serverList.filter(function (s) { return s.episodes.length > 0; });

        var cats = [];
        var catArr = data.categories || [];
        for (var i = 0; i < catArr.length; i++) if (catArr[i].name) cats.push(catArr[i].name);

        var desc = String(data.description || "").replace(/<[^>]*>/g, "").trim();

        return JSON.stringify({
            id: m.id,
            title: m.title,
            origin_name: m.origin_name,
            posterUrl: m.posterUrl,
            backdropUrl: m.backdropUrl,
            description: desc,
            year: m.year,
            rating: data.rating || 0,
            quality: data.quality || "",
            servers: serverList,
            episode_current: m.episode_current,
            lang: data.lang || "",
            category: cats.join(", "),
            country: data.country || "",
            director: "",
            casts: "",
            status: ""
        });
    } catch (e) {
        return "null";
    }
}

function parseDetailResponse(text, pageUrl) {
    // Episodes are direct HLS URLs; MovieService never needs this, but
    // return the page URL as a direct stream if it looks like one.
    if (pageUrl && /\.(m3u8|mp4)(\?|$)/i.test(pageUrl)) {
        return JSON.stringify({ url: pageUrl, isEmbed: false, headers: {}, subtitles: [] });
    }
    return JSON.stringify({ url: "", isEmbed: false, headers: {}, subtitles: [] });
}

function parseCategoriesResponse(html) { return "[]"; }
function parseCountriesResponse(html)  { return "[]"; }
function parseYearsResponse(html)      { return "[]"; }

if (typeof globalThis !== 'undefined') {
    globalThis.getManifest          = getManifest;
    globalThis.getHomeSections      = getHomeSections;
    globalThis.getPrimaryCategories = getPrimaryCategories;
    globalThis.getFilterConfig      = getFilterConfig;
    globalThis.getUrlList           = getUrlList;
    globalThis.getUrlSearch         = getUrlSearch;
    globalThis.getUrlDetail         = getUrlDetail;
    globalThis.getUrlCategories     = getUrlCategories;
    globalThis.getUrlCountries      = getUrlCountries;
    globalThis.getUrlYears          = getUrlYears;
    globalThis.parseListResponse    = parseListResponse;
    globalThis.parseSearchResponse  = parseSearchResponse;
    globalThis.parseMovieDetail     = parseMovieDetail;
    globalThis.parseDetailResponse  = parseDetailResponse;
    globalThis.parseCategoriesResponse = parseCategoriesResponse;
    globalThis.parseCountriesResponse  = parseCountriesResponse;
    globalThis.parseYearsResponse      = parseYearsResponse;
}
