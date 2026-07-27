"use strict";

const { COLLECTION_NAME } = require("./schema");

const SUPPORTED_LANGS = new Set(["en", "fr", "de"]);
const DEFAULT_LANG = "en";

function normalizeLang(lang) {
  if (typeof lang === "string" && SUPPORTED_LANGS.has(lang)) {
    return lang;
  }
  return DEFAULT_LANG;
}

async function searchCatalog(client, rawQuery, rawLang) {
  const lang = normalizeLang(rawLang);
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";

  if (query === "") {
    return { hits: [] };
  }

  const nameField = `name_${lang}`;

  const results = await client
    .collections(COLLECTION_NAME)
    .documents()
    .search({
      q: query,
      query_by: nameField,
    });

  const hits = (results.hits || []).map((hit) => ({
    id: hit.document.id,
    name: hit.document[nameField],
  }));

  return { hits };
}

module.exports = { searchCatalog, normalizeLang, SUPPORTED_LANGS, DEFAULT_LANG };
