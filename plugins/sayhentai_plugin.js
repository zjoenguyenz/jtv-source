// =============================================================================
// SayHentai plugin v2.0.0 — rewritten 2026-11-13 for the site's new home.
// The operator abandoned the old Madara site at sayhentai.cx (now stuck
// behind a hard Cloudflare wall) and moved to sayhentai.wiki, a different
// platform (Halim-style theme): list /danh-sach, detail /truyen/<slug>.html,
// reader /doc-truyen/<slug>/chapter-<n>.html, images on image.shtcdn.top.
// No Cloudflare challenge on .wiki (verified from VM + on-device Safari).
// =============================================================================

function getManifest() {
    return JSON.stringify({
        "id": "sayhentai",
        "name": "SayHentai",
        "version": "2.0.0",
        "baseUrl": "https://sayhentai.wiki",
        "iconUrl": "https://sayhentai.wiki/favicon.ico",
        "isEnabled": true,
        "isAdult": true,
        "type": "MANGA",
        "layoutType": "VERTICAL"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: '', title: 'Truyện Mới Cập Nhật', type: 'Grid', path: '' }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'Mới Nhất', slug: '' },
        { name: 'Manhwa', slug: 'the-loai/manhwa' },
        { name: 'Drama', slug: 'the-loai/drama' },
        { name: 'Romance', slug: 'the-loai/romance' },
        { name: 'Action', slug: 'the-loai/action' },
        { name: 'Adult', slug: 'the-loai/adult' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({
        sort: [
            { name: 'Mới cập nhật', value: 'latest' }
        ],
        category: [
            { name: "Manhwa", value: "manhwa" },
            { name: "Drama", value: "drama" },
            { name: "Romance", value: "romance" },
            { name: "Action", value: "action" }
        ]
    });
}

// =============================================================================
// URL GENERATION
// =============================================================================

var BASE = "https://sayhentai.wiki";

function getUrlList(slug, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;

    if (filters.category) {
        return BASE + "/the-loai/" + filters.category + "?page=" + page;
    }
    if (slug && slug.indexOf('the-loai/') === 0) {
        return BASE + "/" + slug + "?page=" + page;
    }
    return BASE + "/danh-sach?page=" + page;
}

function getUrlSearch(keyword, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;
    var url = BASE + "/search?q=" + encodeURIComponent(keyword);
    if (page > 1) url += "&page=" + page;
    return url;
}

function getUrlDetail(slug) {
    if (!slug) return "";
    if (slug.indexOf("http") === 0) return slug;
    return BASE + "/truyen/" + slug + ".html";
}

function getUrlCategories() { return BASE + "/"; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// =============================================================================
// UTILS
// =============================================================================

var PluginUtils = {
    cleanText: function (text) {
        if (!text) return "";
        return text.replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim();
    }
};

// =============================================================================
// PARSERS
// =============================================================================

function parseListResponse(html) {
    var items = [];
    var foundSlugs = {};

    // Cards are <article class="thumb ..."> blocks containing a halim-thumb
    // anchor (href + title), a lazy cover (data-src) and an episode badge.
    var chunks = html.split(/<article[^>]*class="[^"]*thumb[^"]*"[^>]*>/i);
    for (var i = 1; i < chunks.length; i++) {
        var chunk = chunks[i].substring(0, 4000);

        var linkMatch = chunk.match(/<a[^>]*class="halim-thumb"[^>]*href="https:\/\/sayhentai\.wiki\/truyen\/([a-z0-9-]+?)(?:\.html)?"[^>]*title="([^"]*)"/i) ||
            chunk.match(/<a[^>]*href="https:\/\/sayhentai\.wiki\/truyen\/([a-z0-9-]+?)(?:\.html)?"[^>]*>/i);
        if (!linkMatch) continue;

        var slug = linkMatch[1];
        var title = linkMatch[2] ? PluginUtils.cleanText(linkMatch[2]) : "";
        if (!title) {
            var h2 = chunk.match(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
            if (h2) title = PluginUtils.cleanText(h2[1]);
        }

        var thumbMatch = chunk.match(/data-src="(https:\/\/image\.shtcdn\.top\/[^"]+)"/i) ||
            chunk.match(/<img[^>]+src="(https:\/\/image\.shtcdn\.top\/[^"]+)"/i);
        var thumb = thumbMatch ? thumbMatch[1] : "";

        var epMatch = chunk.match(/<span[^>]*class="episode"[^>]*>([\s\S]*?)<\/span>/i);
        var episode = epMatch ? PluginUtils.cleanText(epMatch[1]) : "";

        if (slug && !foundSlugs[slug]) {
            items.push({
                id: slug,
                title: title || slug,
                posterUrl: thumb,
                backdropUrl: thumb,
                description: "",
                episode_current: episode,
                quality: "HD",
                lang: "Vietsub"
            });
            foundSlugs[slug] = true;
        }
    }

    // Pagination: <li class="active"><a href="#">2</a></li>; total from page= links.
    var currentPage = 1;
    var curMatch = html.match(/<li[^>]*class="active"[^>]*>\s*<a[^>]*>(\d+)<\/a>/i);
    if (curMatch) currentPage = parseInt(curMatch[1]);

    var totalPages = currentPage;
    var pageRegex = /[?&]page=(\d+)/g;
    var pMatch;
    while ((pMatch = pageRegex.exec(html)) !== null) {
        var p = parseInt(pMatch[1]);
        if (p > totalPages) totalPages = p;
    }

    return JSON.stringify({
        items: items,
        pagination: {
            currentPage: currentPage,
            totalPages: totalPages || 1,
            totalItems: items.length * (totalPages || 1),
            itemsPerPage: items.length
        }
    });
}

function parseSearchResponse(html) {
    return parseListResponse(html);
}

function parseMovieDetail(html) {
    try {
        // Title
        var title = "";
        var ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
        if (ogTitle) title = PluginUtils.cleanText(ogTitle[1]).replace(/\s*-\s*SayHentai\s*$/i, "").replace(/^Truyện\s+/i, "");
        if (!title) {
            var h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1) title = PluginUtils.cleanText(h1[1]);
        }

        // Poster
        var poster = "";
        var ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
        if (ogImage) poster = ogImage[1];

        // Status: "Trạng Thái: </span><span...>Đã hoàn thành</span>"
        var status = "Đang tiến hành";
        var stIdx = html.indexOf("Trạng Thái:");
        if (stIdx >= 0) {
            var stText = PluginUtils.cleanText(html.substring(stIdx, stIdx + 260).replace(/^Trạng Thái:\s*/i, ""));
            if (stText) status = stText.split("Lượt Xem")[0].trim() || status;
        }

        // Description: text block after the "Nội dung" heading
        var description = "";
        var descIdx = html.indexOf("Nội dung");
        if (descIdx >= 0) {
            var raw = html.substring(descIdx, descIdx + 2600);
            var text = PluginUtils.cleanText(raw).replace(/^Nội dung( Truyện)?\s*/i, "");
            description = text.substring(0, 700);
        }

        // Chapters: <li class="chapter"><a href=".../doc-truyen/<slug>/<chap>.html" title="Chapter N">
        var chapters = [];
        var seenChap = {};
        var chapRegex = /<li[^>]*class="chapter"[^>]*>\s*<a[^>]+href="(https:\/\/sayhentai\.wiki\/doc-truyen\/[^"]+)"[^>]*>/gi;
        var cMatch;
        while ((cMatch = chapRegex.exec(html)) !== null) {
            if (!seenChap[cMatch[1]]) {
                seenChap[cMatch[1]] = true;
                chapters.push({ id: cMatch[1], url: cMatch[1] });
            }
        }
        // Fallback (e.g. oneshot pages without li.chapter): any reader links.
        if (chapters.length === 0) {
            var anyRegex = /<a[^>]+href="(https:\/\/sayhentai\.wiki\/doc-truyen\/[^"]+)"[^>]*>/gi;
            var aMatch;
            while ((aMatch = anyRegex.exec(html)) !== null) {
                if (!seenChap[aMatch[1]]) {
                    seenChap[aMatch[1]] = true;
                    chapters.push({ id: aMatch[1], url: aMatch[1] });
                }
            }
        }
        // Name + sort ascending by chapter number parsed from the URL tail.
        for (var k = 0; k < chapters.length; k++) {
            var tail = chapters[k].url.substring(chapters[k].url.lastIndexOf('/') + 1).replace(/\.html$/i, "");
            var numMatch = tail.match(/chapter-([\d.]+)/i);
            if (numMatch) {
                chapters[k].num = parseFloat(numMatch[1]);
                chapters[k].name = "Chapter " + numMatch[1];
                // Variants like chapter-8-v2-chinh-thuc are distinct releases.
                var rest = tail.substring(tail.toLowerCase().indexOf("chapter-" + numMatch[1]) + ("chapter-" + numMatch[1]).length).replace(/^-+/, "");
                if (rest) chapters[k].name += " (" + rest.split("-")[0] + ")";
            } else {
                chapters[k].num = 0;
                chapters[k].name = (tail.toLowerCase() === "oneshot") ? "Oneshot" : tail;
            }
            chapters[k].slug = tail;
            delete chapters[k].url;
        }
        chapters.sort(function (a, b) { return a.num - b.num; });
        for (var j = 0; j < chapters.length; j++) delete chapters[j].num;

        var servers = [{
            name: "Server 1",
            episodes: chapters
        }];

        // Categories: the manga's own genres are rel="category tag" anchors
        // (the plain /the-loai/ link set elsewhere is the site-wide menu).
        var categories = [];
        var seenCat = {};
        var catRegex = /<a[^>]+title="([^"]+)"[^>]*rel="category tag"[^>]*href="https:\/\/sayhentai\.wiki\/the-loai\/([a-z0-9-]+)"/gi;
        var cm;
        while ((cm = catRegex.exec(html)) !== null) {
            if (/^\d+$/.test(cm[2])) continue;
            var cname = PluginUtils.cleanText(cm[1]);
            if (cname && !seenCat[cname]) {
                seenCat[cname] = true;
                categories.push(cname);
            }
        }

        return JSON.stringify({
            id: "",
            title: title,
            posterUrl: poster,
            backdropUrl: poster,
            description: description,
            servers: servers,
            category: categories.join(", "),
            status: status,
            quality: "HD",
            lang: "Vietsub"
        });

    } catch (e) {
        return "null";
    }
}

function parseDetailResponse(html) {
    try {
        var images = [];
        // Reader pages are <img class='simg' src='https://image.shtcdn.top/manga-images/...'>
        var tagRegex = /<img[^>]*class=['"]simg['"][^>]*>/gi;
        var tag;
        while ((tag = tagRegex.exec(html)) !== null) {
            var srcMatch = tag[0].match(/src=['"]([^'"]+)['"]/i);
            if (srcMatch && images.indexOf(srcMatch[1]) === -1) {
                images.push(srcMatch[1].replace(/&amp;/g, "&"));
            }
        }

        return JSON.stringify({
            images: images,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://sayhentai.wiki/"
            }
        });
    } catch (e) {
        return "{}";
    }
}

function parseCategoriesResponse(html) {
    var categories = [];
    var seen = {};
    var catRegex = /<a[^>]+href="https:\/\/sayhentai\.wiki\/the-loai\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var m;
    while ((m = catRegex.exec(html)) !== null) {
        if (/^\d+$/.test(m[1])) continue;
        var name = PluginUtils.cleanText(m[2]).replace(/^-\s*/, "");
        if (name && !seen[m[1]]) {
            seen[m[1]] = true;
            categories.push({ name: name, slug: "the-loai/" + m[1] });
        }
    }
    return JSON.stringify(categories);
}

function parseCountriesResponse(html) { return "[]"; }
function parseYearsResponse(html) { return "[]"; }
