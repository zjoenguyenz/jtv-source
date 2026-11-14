// =============================================================================
// VSMOV — harvested from the ConBangTV (ChimToTV) app on the owner's
// order (2026-11-13): an independent movie source with its own JSON
// API in the KKPhim format but under vsmov.com paths, added so JTV
// does not depend on one CDN family. Episode embeds live on
// vN.streamvsmov.com; parseEmbedResponse lifts the signed master
// playlist out of the embed page (the same extraction ChimToTV does).
// Its HLS segments are MPEG-TS disguised as PNG images (a small PNG
// stands in front of the TS data) — the app's HLS proxy strips that
// prefix when native playback fails, so these streams play in JTV.
// =============================================================================

var VS_API = "https://vsmov.com/api";
var VS_IMG_DEFAULT = "https://nguon.vsphim.com/storage/images/";

function getManifest() {
    return JSON.stringify({
        "id": "vsmov",
        "name": "VSMov",
        "version": "1.0.0",
        "baseUrl": "https://vsmov.com",
        "iconUrl": "https://vsmov.com/favicon.ico",
        "isEnabled": true,
        "type": "MOVIE"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: 'danh-sach/phim-moi-cap-nhat', title: 'Phim Mới Cập Nhật', type: 'Grid', path: 'api' },
        { slug: 'danh-sach/phim-bo', title: 'Phim Bộ', type: 'Horizontal', path: 'api' },
        { slug: 'danh-sach/phim-le', title: 'Phim Lẻ', type: 'Horizontal', path: 'api' },
        { slug: 'the-loai/hoat-hinh', title: 'Hoạt Hình', type: 'Horizontal', path: 'api' },
        { slug: 'danh-sach/subteam', title: 'Subteam', type: 'Horizontal', path: 'api' },
        { slug: 'quoc-gia/trung-quoc', title: 'Phim Trung Quốc', type: 'Horizontal', path: 'api' },
        { slug: 'quoc-gia/han-quoc', title: 'Phim Hàn Quốc', type: 'Horizontal', path: 'api' },
        { slug: 'quoc-gia/au-my', title: 'Phim Âu Mỹ', type: 'Horizontal', path: 'api' }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'Phim mới', slug: 'danh-sach/phim-moi-cap-nhat' },
        { name: 'Phim bộ', slug: 'danh-sach/phim-bo' },
        { name: 'Phim lẻ', slug: 'danh-sach/phim-le' },
        { name: 'Hoạt hình', slug: 'the-loai/hoat-hinh' },
        { name: 'Hoạt hình Trung Quốc', slug: 'the-loai/hoat-hinh?country=trung-quoc' },
        { name: 'Subteam', slug: 'danh-sach/subteam' },
        { name: 'Phim Trung Quốc', slug: 'quoc-gia/trung-quoc' },
        { name: 'Phim Hàn Quốc', slug: 'quoc-gia/han-quoc' },
        { name: 'Phim Âu Mỹ', slug: 'quoc-gia/au-my' },
        { name: 'Phim Nhật Bản', slug: 'quoc-gia/nhat-ban' },
        { name: 'Phim Thái Lan', slug: 'quoc-gia/thai-lan' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({ sort: [] });
}

// =============================================================================
// URL GENERATION
// =============================================================================

function vsPageUrl(path, page) {
    var sep = path.indexOf("?") !== -1 ? "&" : "?";
    return VS_API + "/" + path + sep + "page=" + page;
}

function getUrlList(slug, filtersJson) {
    try {
        var filters = JSON.parse(filtersJson || "{}");
        var page = filters.page || 1;
        var url = vsPageUrl(slug, page);
        if (filters.limit) url += "&limit=" + filters.limit;
        if (filters.country) url += "&country=" + filters.country;
        if (filters.year) url += "&year=" + filters.year;
        if (filters.category) url += "&category=" + filters.category;
        return url;
    } catch (e) {
        return VS_API + "/danh-sach/phim-moi-cap-nhat?page=1";
    }
}

function getUrlSearch(keyword, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;
    var limit = filters.limit || 24;
    return VS_API + "/tim-kiem?keyword=" + encodeURIComponent(keyword) + "&page=" + page + "&limit=" + limit;
}

function getUrlDetail(slug) {
    return VS_API + "/phim/" + slug;
}

function getUrlCategories() { return VS_API + "/the-loai"; }
function getUrlCountries() { return VS_API + "/quoc-gia"; }
function getUrlYears() { return ""; }

// =============================================================================
// PARSERS
// =============================================================================

function vsPoster(path, pathImage) {
    if (!path) return "";
    if (path.indexOf("http") === 0) return path;
    if (path.charAt(0) === "/") return "https://vsmov.com" + path;
    return (pathImage || VS_IMG_DEFAULT) + path;
}

function parseListResponse(apiResponseJson) {
    try {
        var response = JSON.parse(apiResponseJson);
        var items = response.items || (response.data && response.data.items) || [];
        var pathImage = response.pathImage || (response.data && response.data.pathImage) || "";
        var pagination = response.pagination || (response.data && response.data.pagination) || {};

        var movies = items.map(function (item) {
            return {
                id: item.slug,
                title: item.name,
                posterUrl: vsPoster(item.poster_url, pathImage),
                backdropUrl: vsPoster(item.thumb_url, pathImage),
                year: item.year || 0,
                quality: item.quality || "",
                episode_current: item.episode_current || "",
                lang: item.lang || ""
            };
        });

        return JSON.stringify({
            items: movies,
            pagination: {
                currentPage: pagination.currentPage || 1,
                totalPages: pagination.totalPages || 1,
                totalItems: pagination.totalItems || movies.length,
                itemsPerPage: pagination.totalItemsPerPage || 24
            }
        });
    } catch (error) {
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    }
}

function parseSearchResponse(apiResponseJson) {
    return parseListResponse(apiResponseJson);
}

function vsEpisodeName(name) {
    var s = String(name || "").trim();
    if (/^\d+$/.test(s)) return "Tập " + parseInt(s, 10);
    return s;
}

function parseMovieDetail(apiResponseJson) {
    try {
        var response = JSON.parse(apiResponseJson);
        var movie = response.movie || {};
        var episodes = response.episodes || [];
        var pathImage = response.pathImage || "";

        var servers = [];
        episodes.forEach(function (server) {
            var serverEpisodes = [];
            (server.server_data || []).forEach(function (ep) {
                var link = ep.link_m3u8 || ep.link_embed;
                if (!link) return;
                serverEpisodes.push({
                    id: link,
                    name: vsEpisodeName(ep.name),
                    slug: ep.slug
                });
            });
            if (serverEpisodes.length > 0) {
                servers.push({ name: server.server_name, episodes: serverEpisodes });
            }
        });

        var categories = (movie.category || []).map(function (c) { return c.name; }).join(", ");
        var countries = (movie.country || []).map(function (c) { return c.name; }).join(", ");
        var directors = (movie.director || []).join(", ");
        var actors = (movie.actor || []).join(", ");
        var ratingValue = 0;
        if (movie.tmdb && movie.tmdb.vote_average) ratingValue = movie.tmdb.vote_average;

        return JSON.stringify({
            id: movie.slug,
            title: movie.name,
            originName: movie.origin_name || "",
            posterUrl: vsPoster(movie.poster_url, pathImage),
            backdropUrl: vsPoster(movie.thumb_url, pathImage),
            description: (movie.content || "").replace(/<[^>]*>/g, ""),
            year: movie.year || 0,
            rating: ratingValue,
            quality: movie.quality || "",
            duration: movie.time || "",
            servers: servers,
            episode_current: movie.episode_current || "",
            lang: movie.lang || "",
            category: categories,
            country: countries,
            director: directors,
            casts: actors,
            status: movie.status || ""
        });
    } catch (error) { return "null"; }
}

function parseDetailResponse(text, pageUrl) {
    return parseEmbedResponse(text, pageUrl);
}

// The streamvsmov embed page carries either a ready signed master URL
// or a baseUrl + videoHash pair that composes one.
function parseEmbedResponse(html, pageUrl) {
    try {
        var signed = /signedMasterUrl\s*:\s*"(https?:\/\/[^"]+)"/.exec(html);
        if (signed) {
            return JSON.stringify({ url: signed[1], isEmbed: false, headers: { "Referer": "https://vsmov.com/" }, subtitles: [] });
        }
        var base = /baseUrl\s*=\s*"(https?:\/\/[^"]+)"/.exec(html);
        var hash = /videoHash\s*=\s*"([0-9a-zA-Z-]+)"/.exec(html);
        if (base && hash) {
            return JSON.stringify({ url: base[1] + "/stream/" + hash[1] + "/master.m3u8", isEmbed: false, headers: { "Referer": "https://vsmov.com/" }, subtitles: [] });
        }
    } catch (e) {}
    return JSON.stringify({ url: "", isEmbed: false, headers: {}, subtitles: [] });
}

function parseCategoriesResponse(apiResponseJson) {
    try {
        var response = JSON.parse(apiResponseJson);
        var items = (response.data && response.data.items) || response.items || (Array.isArray(response) ? response : []);
        return JSON.stringify(items.map(function (i) { return { name: i.name, slug: "the-loai/" + i.slug }; }));
    } catch (e) { return "[]"; }
}

function parseCountriesResponse(apiResponseJson) {
    try {
        var response = JSON.parse(apiResponseJson);
        var items = (response.data && response.data.items) || response.items || (Array.isArray(response) ? response : []);
        return JSON.stringify(items.map(function (i) { return { name: i.name, value: i.slug }; }));
    } catch (e) { return "[]"; }
}

function parseYearsResponse(apiResponseJson) {
    return "[]";
}
