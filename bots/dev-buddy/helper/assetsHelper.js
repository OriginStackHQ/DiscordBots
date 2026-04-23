const axios = require("axios");
const cheerio = require("cheerio");
const config = require("../config");

const scrapeWallpaper = async (url) => {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith("hdqwalls.com")) {
      throw new Error("Please provide a valid URL from hdqwalls.com only");
    }

    const { data: html } = await axios.get("https://api.scrapingdog.com/scrape", {
      params: {
        api_key: "68d38d88c6f245056cbe56ed",
        url: url,
        dynamic: "false",
      },
    });
    const $ = cheerio.load(html);

    // Title
    const title = $(".page-heading h1").text().trim();

    // Category is in the breadcrumb, second <li> contains <a> with category name
    const category = $(".breadcrumb li:nth-child(2) a").text().trim();

    // Tags
    const container = $(".wallpaper_detail").first();

    // Extract tags text inside the container
    const tags = [];
    container.find("a > li > span.btn-link").each((i, el) => {
      const tagText = $(el).text().replace(/,$/, "").trim();
      tags.push(tagText);
    });

    // Resolution
    const resolution = $("footer").find("a.btn-link_a").first().text().trim();

    // Size (MB)
    const dlOriginal = $("#dl_original").text().trim();
    const sizeMatch = dlOriginal.match(/\(([\d.]+MB)\)/);
    const size = sizeMatch ? sizeMatch[1] : "Unknown";

    // Extract download URL
    const downloadUrl = $("#dl_original").attr("href");

    return {
      title,
      category,
      resolution,
      size,
      tags,
      downloadUrl,
    };
  } catch (error) {
    console.error("Error scraping wallpaper:", error);
    throw new Error("Failed to scrape wallpaper. Please try again.");
  }
};

const getImdbData = async (imdbID) => {
  const apiKey = config.omdbApiKey;
  const url = `https://www.omdbapi.com/?i=${imdbID}&apiKey=${apiKey}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    if (data.Response === "False") throw new Error("Media not found");

    return {
      title: data.Title,
      year: data.Year,
      released: data.Released,
      genre: data.Genre,
      poster: data.Poster,
      imdbRating: data.imdbRating,
      imdbVotes: data.imdbVotes,
      type: data.Type.split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    };
  } catch (error) {
    console.error("Error fetching media data:", error.message);
    throw new Error("Failed to fetch IMDB data. Please try again.");
  }
};

const scrapeTemplate = async (url) => {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith("free-psd-templates.com")) {
      throw new Error("Please provide a valid URL from free-psd-templates.com only");
    }

    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    // Extract title
    const title = $("h1.entry-title").text().trim();

    // Extract fonts
    const fonts = [];
    $('p a[href*="fonts.google.com"]').each((i, el) => {
      const fontName = $(el).text().trim();
      const fontLink = $(el).attr("href");
      fonts.push({ name: fontName, url: fontLink });
    });

    // Extract tags
    const tags = [];
    $('.entry-tags a[rel="tag"]').each((i, el) => {
      tags.push($(el).text().trim());
    });

    // Extract download link
    const downloadPageUrl = $('a.btn[href*="/get/"]').attr("href");

    const { data: downloadPageHtml } = await axios.get(downloadPageUrl);
    const $download = cheerio.load(downloadPageHtml);

    const downloadUrl = $download("#link a.btn").attr("href");

    return {
      title,
      fonts,
      tags,
      downloadUrl,
    };
  } catch (error) {
    console.error("Error scraping template:", error.message);
    throw new Error("Failed to scrape template. Please try again.");
  }
};

const websiteInfo = async (url) => {
  try {
    const response = await axios.get(`https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true`);
    const data = response.data?.data;

    return {
      title: data.title || "New Website",
      description: data.description || "Check out this website",
      screenshotUrl: data.screenshot?.url,
    };
  } catch (error) {
    console.error("Error fetching website info:", error);
    throw new Error("Failed to fetch website info.");
  }
};

module.exports = { scrapeWallpaper, getImdbData, scrapeTemplate, websiteInfo };
