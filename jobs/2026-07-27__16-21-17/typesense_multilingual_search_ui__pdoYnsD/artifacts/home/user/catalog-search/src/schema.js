"use strict";

const COLLECTION_NAME = "catalog";

const COLLECTION_SCHEMA = {
  name: COLLECTION_NAME,
  fields: [
    { name: "name_en", type: "string", locale: "en", stem: true },
    { name: "name_fr", type: "string", locale: "fr", stem: true },
    { name: "name_de", type: "string", locale: "de", stem: true },
  ],
};

module.exports = { COLLECTION_NAME, COLLECTION_SCHEMA };
