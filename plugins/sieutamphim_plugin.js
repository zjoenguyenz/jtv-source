// ========================================================
// SIÊU TẦM PHIM VAAPP PLUGIN — rewritten for sieutamphim.site
// (the site moved from sieutamphim.pro/Blogger to a custom
// WordPress theme at https://www.sieutamphim.site)
//
// URL scheme on the new site:
//   List (tag archive) : /tu-khoa/<tag>/  + /page/<n>/
//   Search             : /?s=<keyword>    (single page, no pagination)
//   Detail + watch     : /xem-phim/<slug>/
//   Episode watch page : /xem-phim/<slug>/tap-<n>-<server>-server
//                        (phim lẻ uses tap-Full-<server>-server)
// Player flow:
//   watch page JS holds encodedUrl = base64("/wp-content/themes/
//   sieutamphim/embed.php?url=<token>") -> embed.php page carries
//   <meta name="player-payload"> / data-payload =
//   base64(ROT13(final embed URL)) -> e.g. player.abyssplayer.com
// ========================================================

const BASE_URL = "https://www.sieutamphim.site";

// ========================================================
// CONFIGURATION & METADATA
// ========================================================

function getManifest() {
    return JSON.stringify({
        "id": "sieutamphim",
        "name": "Sưu Tầm Phim",
        "version": "2.0.0",
        "baseUrl": "https://www.sieutamphim.site",
        "iconUrl": "https://www.sieutamphim.site/wp-content/themes/sieutamphim/assets/list_source/sieu-tam-phim.webp",
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",
        "layoutType": "VERTICAL",
        "playerType": "embed"
    });
}

function log(msg) {
    if (typeof nativeLog !== 'undefined') {
        nativeLog("[STPhim] " + msg);
    }
}

function getSlugFromUrl(url) {
    if (!url) return "";
    var m = String(url).match(/\/xem-phim\/([^\/]+)\/?/i);
    if (m) return m[1];
    var cleanUrl = String(url).split("?")[0];
    var parts = cleanUrl.split("/");
    return parts[parts.length - 1] || parts[parts.length - 2] || "";
}

// ========================================================
// HOME
// ========================================================

function getHomeSections() {
    return JSON.stringify([
        { slug: "phim-moi", title: "Mới Cập Nhật", type: "Grid" },
        { slug: "phim-bo", title: "Phim Bộ Mới", type: "Horizontal" },
        { slug: "phim-le", title: "Phim Lẻ Mới", type: "Horizontal" },
        { slug: "long-tieng", title: "Phim Lồng Tiếng", type: "Horizontal" },
        { slug: "thuyet-minh", title: "Phim Thuyết Minh", type: "Horizontal" },
        { slug: "vietsub", title: "Phim Vietsub", type: "Horizontal" }
    ]);
}

// ========================================================
// CATEGORY
// ========================================================

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'Phim Bộ', slug: 'phim-bo' },
        { name: 'Phim Lẻ', slug: 'phim-le' },
        { name: 'Phim Mới', slug: 'phim-moi' },
        { name: 'Lồng Tiếng', slug: 'long-tieng' },
        { name: 'Thuyết Minh', slug: 'thuyet-minh' },
        { name: 'Vietsub', slug: 'vietsub' },
        { name: 'Phim Hàn Quốc', slug: 'phim-han-quoc' },
        { name: 'Phim Trung Quốc', slug: 'phim-trung-quoc' },
        { name: 'Phim Nhật Bản', slug: 'phim-nhat-ban' },
        { name: 'Phim Mỹ', slug: 'phim-my' },
        { name: 'Phim Việt Nam', slug: 'phim-viet-nam' },
        { name: 'Phim Thái Lan', slug: 'phim-thai-lan' },
        { name: 'TV Show', slug: 'tv-show' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({
        sort: [],
        category: []
    });
}

// ========================================================
// URL GENERATION
// ========================================================

function getUrlList(slug, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = parseInt(filters.page, 10) || 1;
    var tag = String(slug || "phim-moi").replace(/^tu-khoa\//, "").replace(/^\/+|\/+$/g, "");
    if (page <= 1) return BASE_URL + "/tu-khoa/" + tag + "/";
    return BASE_URL + "/tu-khoa/" + tag + "/page/" + page + "/";
}

function getUrlSearch(keyword, filtersJson) {
    // The new theme's search returns everything on one page.
    return BASE_URL + "/?s=" + encodeURIComponent(keyword || "");
}

function getUrlDetail(id) {
    if (!id) return "";
    if (String(id).indexOf("http") === 0) return id;
    return BASE_URL + "/xem-phim/" + id + "/";
}

// ========================================================
// PARSE LIST
// ========================================================

function parseListResponse(html) {
    try {
        var items = [];
        var used = {};

        // Movie cards: an <a> to /xem-phim/<slug>/ wrapping poster + title.
        // (Used by the tag archives, the homepage and search results alike.)
        var cardRegex = /<a[^>]+href="(https:\/\/www\.sieutamphim\.site\/xem-phim\/([^\/"]+)\/)"[^>]*>([\s\S]*?)<\/a>/gi;
        var m;
        while ((m = cardRegex.exec(html)) !== null) {
            var slug = m[2];
            var body = m[3];
            if (used[slug]) continue;
            if (body.indexOf("<img") === -1) continue; // text-only links are not cards
            used[slug] = true;

            var posterMatch = body.match(/<img[^>]+src="([^"]+)"/i) || body.match(/<img[^>]+data-src="([^"]+)"/i);
            var poster = posterMatch ? posterMatch[1] : "";
            if (poster.indexOf("//") === 0) poster = "https:" + poster;

            var titleMatch = body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || body.match(/<img[^>]+alt="([^"]+)"/i);
            var title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]*>/g, "")) : slug;

            var badgeMatch = body.match(/tag-content[^>]*>([\s\S]*?)<\/div>/i);
            var badge = badgeMatch ? decodeHtmlEntities(badgeMatch[1].replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim() : "";

            items.push({
                id: slug,
                title: title,
                posterUrl: poster,
                backdropUrl: poster,
                episode_current: badge
            });
        }

        // Total pages from the archive pagination (/page/<n>/ links).
        var totalPages = 1;
        var pageRegex = /\/page\/(\d+)\//g;
        var pm;
        while ((pm = pageRegex.exec(html)) !== null) {
            var n = parseInt(pm[1], 10);
            if (n > totalPages) totalPages = n;
        }

        return JSON.stringify({
            items: items,
            pagination: { currentPage: 1, totalPages: totalPages }
        });
    } catch (e) {
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    }
}

function parseSearchResponse(html) {
    return parseListResponse(html);
}

// ========================================================
// PARSE DETAIL
// ========================================================

function parseMovieDetail(html, url) {
    // A watch page (…/tap-…) is not a detail page.
    if (url && url.indexOf("/tap-") !== -1) {
        return JSON.stringify({ id: url, servers: [] });
    }
    try {
        var slug = getSlugFromUrl(url);

        var title = getMeta(html, "og:title");
        title = title.replace(/^Xem Phim\s+/i, "").replace(/\s+Mới Nhất$/i, "").replace(/\s*-\s*Siêu Tầm Phim$/i, "").trim();
        if (!title) {
            var h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1) title = h1[1].replace(/<[^>]*>/g, "").trim();
        }

        var poster = getMeta(html, "og:image");
        if (!poster) {
            var posterMatch = html.match(/\/assets\/posters\/[^"]+\.(?:webp|jpg|jpeg|png)/i);
            if (posterMatch) {
                var srcMatch = html.match(new RegExp('<img[^>]+src="([^"]*' + escapeRegExp(posterMatch[0]) + '[^"]*)"', "i"));
                poster = srcMatch ? srcMatch[1] : "";
            }
        }

        var description = getMeta(html, "og:description");
        if (!description) {
            var descMatch = html.match(/description-movie[^>]*>([\s\S]*?)<\/div>/i);
            if (descMatch) description = descMatch[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        }

        // Server codes: data-servers="[&quot;hx&quot;,&quot;vs&quot;]" on the
        // favourite button; fall back to the codes in tap-<n>-<code>-server links.
        var serverCodes = [];
        var dsMatch = html.match(/data-servers="([^"]*)"/i);
        if (dsMatch) {
            try {
                var parsed = JSON.parse(decodeHtmlEntities(dsMatch[1]));
                if (parsed && parsed.length) serverCodes = parsed;
            } catch (e) { /* fall through */ }
        }

        // Episode tokens present on this page, per server code
        // (tap-1-hx-server, tap-Full-hx-server, ...).
        var tokensByServer = {};
        var tapRegex = /\/tap-([^\/"-]+)-([a-z0-9]+)-server/gi;
        var tm;
        while ((tm = tapRegex.exec(html)) !== null) {
            var code = tm[2].toLowerCase();
            if (!tokensByServer[code]) tokensByServer[code] = [];
            if (tokensByServer[code].indexOf(tm[1]) === -1) tokensByServer[code].push(tm[1]);
            if (serverCodes.indexOf(code) === -1) serverCodes.push(code);
        }
        if (serverCodes.length === 0 && html.indexOf("iframe-container") !== -1) {
            serverCodes = ["hx"];
        }

        // Episode count the site itself declares: data-current-ep="45"
        // for series, data-current-ep="Full" for single movies.
        var currentEpMatch = html.match(/data-current-ep="([^"]*)"/i);
        var currentEp = currentEpMatch ? currentEpMatch[1] : "";
        var epCount = parseInt(currentEp, 10) || 0;

        var servers = [];
        for (var s = 0; s < serverCodes.length; s++) {
            var serverCode = String(serverCodes[s]).toLowerCase();
            var episodes = [];
            if (epCount > 0) {
                for (var j = 1; j <= epCount; j++) {
                    episodes.push({
                        id: BASE_URL + "/xem-phim/" + slug + "/tap-" + j + "-" + serverCode + "-server",
                        name: "Tập " + j,
                        slug: "tap-" + j
                    });
                }
            } else {
                var tokens = tokensByServer[serverCode] && tokensByServer[serverCode].length
                    ? tokensByServer[serverCode] : ["Full"];
                for (var k = 0; k < tokens.length; k++) {
                    episodes.push({
                        id: BASE_URL + "/xem-phim/" + slug + "/tap-" + tokens[k] + "-" + serverCode + "-server",
                        name: tokens[k] === "Full" ? "Full" : "Tập " + tokens[k],
                        slug: "tap-" + tokens[k]
                    });
                }
            }
            servers.push({
                name: serverCode.toUpperCase() + " Server",
                episodes: episodes
            });
        }

        return JSON.stringify({
            id: slug,
            title: decodeHtmlEntities(title),
            posterUrl: poster,
            backdropUrl: poster,
            description: decodeHtmlEntities(description),
            servers: servers,
            quality: "HD",
            episode_current: epCount > 0 ? String(epCount) : "Full",
            status: epCount > 1 ? "Đang cập nhật" : "Hoàn thành"
        });
    } catch (e) {
        log("Error in parseMovieDetail: " + e.message);
        return JSON.stringify({ servers: [] });
    }
}

// ========================================================
// PARSE VIDEO (STREAM)
// ========================================================

function resolvePlayer(html, url) {
    try {
        // 1) embed.php payload page: base64(ROT13(final embed URL))
        var payloadMatch = html.match(/player-payload"\s+content="([^"]+)"/i)
            || html.match(/data-payload="([^"]+)"/i);
        if (payloadMatch) {
            var decoded = base64Decode(payloadMatch[1]);
            var finalUrl = decoded;
            if (finalUrl.indexOf("http") !== 0) {
                var unrot = rot13(finalUrl);
                if (unrot.indexOf("http") === 0) finalUrl = unrot;
            }
            if (finalUrl.indexOf("http") === 0) {
                log("Decoded player payload: " + finalUrl);
                return JSON.stringify({
                    url: finalUrl,
                    isEmbed: true,
                    headers: { "Referer": BASE_URL + "/" }
                });
            }
        }

        // 2) Watch page: encodedUrl = base64(embed.php URL)
        var encMatch = html.match(/encodedUrl\s*=\s*"([^"]+)"/);
        if (encMatch && encMatch[1]) {
            var embedUrl = base64Decode(encMatch[1]);
            if (embedUrl) {
                if (embedUrl.indexOf("//") === 0) embedUrl = "https:" + embedUrl;
                else if (embedUrl.indexOf("/") === 0) embedUrl = BASE_URL + embedUrl;
                log("Decoded embed URL: " + embedUrl);
                return JSON.stringify({
                    url: embedUrl,
                    isEmbed: true,
                    headers: { "Referer": BASE_URL + "/" }
                });
            }
        }

        // 3) Direct stream in the page
        var m3u8 = html.match(/(https?:\/\/[^"' ]+\.m3u8[^"' ]*)/i);
        if (m3u8) {
            log("Found direct M3U8: " + m3u8[1]);
            return JSON.stringify({ url: m3u8[1], mimeType: "application/x-mpegURL", isEmbed: false });
        }

        // 4) Plain iframe embed
        var iframeMatch = html.match(/<iframe[^>]*src="([^"]+)"/i);
        if (iframeMatch) {
            var src = iframeMatch[1];
            if (src.indexOf("//") === 0) src = "https:" + src;
            if (src && src !== url && src.length > 5) {
                return JSON.stringify({ url: src, isEmbed: true, headers: { "Referer": BASE_URL + "/" } });
            }
        }

        // 5) Terminal embed page (e.g. the abyss player itself)
        return JSON.stringify({ url: url, isEmbed: true, headers: { "Referer": BASE_URL + "/" } });
    } catch (e) {
        log("Error in resolvePlayer: " + e.message);
        return JSON.stringify({ url: "", isEmbed: false });
    }
}

function parseDetailResponse(html, url) {
    return resolvePlayer(html, url);
}

function parseEmbedResponse(html, sourceUrl) {
    return resolvePlayer(html, sourceUrl);
}

// ========================================================
// HELPERS
// ========================================================

function getMeta(html, property) {
    var m = html.match(new RegExp('<meta[^>]+property="' + property + '"[^>]+content="([^"]*)"', "i"))
        || html.match(new RegExp('<meta[^>]+content="([^"]*)"[^>]+property="' + property + '"', "i"));
    return m ? m[1] : "";
}

function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function base64Decode(input) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var str = String(input).replace(/[^A-Za-z0-9+/=]/g, "");
    var output = "";
    for (var i = 0; i < str.length; i += 4) {
        var e1 = chars.indexOf(str.charAt(i));
        var e2 = chars.indexOf(str.charAt(i + 1));
        var e3 = chars.indexOf(str.charAt(i + 2));
        var e4 = chars.indexOf(str.charAt(i + 3));
        if (e1 < 0 || e2 < 0) break;
        output += String.fromCharCode((e1 << 2) | (e2 >> 4));
        if (e3 >= 0 && str.charAt(i + 2) !== "=") {
            output += String.fromCharCode(((e2 & 15) << 4) | (e3 >> 2));
        }
        if (e4 >= 0 && str.charAt(i + 3) !== "=") {
            output += String.fromCharCode(((e3 & 3) << 6) | e4);
        }
    }
    // UTF-8 decode (payloads are ASCII URLs, but stay safe)
    try {
        return decodeURIComponent(output.split("").map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(""));
    } catch (e) {
        return output;
    }
}

function rot13(str) {
    return String(str).replace(/[a-zA-Z]/g, function (c) {
        var base = c <= "Z" ? 65 : 97;
        return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
    });
}

function decodeHtmlEntities(str) {
    if (!str) return "";
    return String(str)
        .replace(/&#8211;/g, "-").replace(/&#8212;/g, "-")
        .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
        .replace(/&#8216;/g, "'").replace(/&#8217;/g, "'")
        .replace(/&#038;/g, "&").replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&").replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ").trim();
}

function parseCategoriesResponse(html) { return "[]"; }
function parseCountriesResponse(html) { return "[]"; }
function parseYearsResponse(html) { return "[]"; }

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }
