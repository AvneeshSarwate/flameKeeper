const crypto = require("crypto");
const Airtable = require("airtable");
const { asyncForEach, markdownToHTML } = require("./util");
// Note that as of 02/2024 Airtable requires PATs instead of API keys. However
// the SDK interface hasn't changed, and the PAT is still provided via the
// apiKey param.
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const baseID = process.env.DEVELOPMENT_BASE_ID || "appiuLzmVDcFCntEr";
const base = airtable.base(baseID);
const { getLogger } = require("./logger");
const constants = require("./constants");
const mime = require("mime");
const s3 = require("./s3");

const USING_TEST_BASE = baseID === "appDMw3lOAQTw8dGQ";

class Composers {
  constructor() {
    this.logger = getLogger("Composers");
    this.tableName = "Composers";
    this.composerTable = base(this.tableName);
    this.composers = [];
  }

  async getComposers() {
    let composers = [];
    try {
      let records = await this.composerTable
        .select({
          view: "Grid view",
        })
        .all();
      await asyncForEach(records, async (record) => {
        let composer = this.parseComposer(record);
        let updates = {};
        if (!composer.key) {
          updates = {
            ...updates,
            key: crypto.randomBytes(16).toString("hex"),
          };
        }
        let photoUpdates = await this.validatePhoto(record, composer);
        if (photoUpdates) {
          updates = {
            ...updates,
            ...photoUpdates,
          };
        }
        if (Object.keys(updates).length > 0) {
          composer = await this.updateComposer(record.id, updates);
        }
        composers.push(composer);
      });
      this.logger.debug("loaded composers");
    } catch (err) {
      this.logger.error(`unable to get composers: ${err}`);
    }
    this.composers = composers;
    return this.composers;
  }

  async validatePhoto(record, composer) {
    let photoRecord = record.get("photo");
    if (!photoRecord || photoRecord.length < 1) {
      return;
    }
    let photoObj = photoRecord[0];
    let knownPhotoID = record.get("s3_photo_id");
    if (!knownPhotoID || knownPhotoID !== photoObj.id) {
      let s3URL = await this.uploadPhotoToS3(
        photoObj.id,
        photoObj.url,
        photoObj.type,
        composer.name
      );
      return {
        s3_photo_id: photoObj.id,
        s3_photo_url: s3URL,
      };
    }
  }

  async uploadPhotoToS3(
    airtablePhotoID,
    airtablePhotoURL,
    airtablePhotoType,
    name
  ) {
    let response = await fetch(airtablePhotoURL);
    let buffer = await response.arrayBuffer();
    let bytes = new Uint8Array(buffer);
    const filename = (
      [name, airtablePhotoID].join("-") +
      "." +
      mime.getExtension(airtablePhotoType)
    ).replace(/\s/g, "-");
    let uploadParams = {
      Bucket: constants.BUCKET_NAME,
      Key: filename,
      Body: bytes,
      ACL: "public-read",
    };
    await s3.upload(uploadParams).promise();
    return constants.filenameToS3URL(filename);
  }

  updateComposer(id, fields) {
    return new Promise((resolve, reject) => {
      this.composerTable
        .update(id, fields)
        .then((record) => {
          resolve(this.parseComposer(record));
        })
        .catch((err) => reject(err));
    });
  }

  parseComposer(record) {
    return {
      composerID: USING_TEST_BASE ? record.get("test_id") : record.id,
      name: record.get("name"),
      bio: markdownToHTML(record.get("bio")),
      photo: record.get("s3_photo_url"),
      key: record.get("key"),
      active: record.get("active") || false,
    };
  }

  isValidAccessCode(accessCode) {
    let composer = this.composers.find((c) => c.key == accessCode);
    if (composer) {
      if (composer.active) return { composer };
      return { error: "The access code provided is no longer valid." };
    } else return { error: "The access code provided was not recognized." };
  }

  isActive(composerID) {
    let composer = this.composers.find((c) => c.composerID == composerID);
    if (composer && composer.active) return true;
    return false;
  }
}

class Admins {
  constructor() {
    this.logger = getLogger("Admins");
    this.tableName = "Admins";
    this.adminTable = base(this.tableName);
    this.admins = [];
  }

  async getAdmins() {
    let admins = [];
    try {
      let records = await this.adminTable
        .select({
          view: "Grid view",
        })
        .all();
      await asyncForEach(records, async (record) => {
        let admin = this.parseAdmin(record);
        admins.push(admin);
      });
      this.logger.debug("loaded admins");
    } catch (err) {
      this.logger.error("unable to get admins", err);
    }
    this.admins = admins;
    return this.admins;
  }

  parseAdmin(record) {
    return {
      adminID: record.id,
      name: record.get("name"),
      role: record.get("role"),
      description: markdownToHTML(record.get("description")),
      key: record.get("key"),
      active: record.get("active") || false,
    };
  }

  isValidAccessCode(accessCode) {
    let admin = this.admins.find((c) => c.key == accessCode);
    if (admin) {
      if (admin.active) return { admin };
      return { error: "The access code provided is no longer valid." };
    } else return { error: "The access code provided was not recognized." };
  }

  isActive(adminID) {
    let admin = this.admins.find((a) => a.adminID == adminID);
    if (admin && admin.active) return true;
    return false;
  }
}

class Copy {
  constructor() {
    this.logger = getLogger("Copy");
    this.tableName = "Copy";
    this.copyTable = base(this.tableName);
    this.copy = {};
  }

  async getCopy() {
    let copy = {};
    try {
      let records = await this.copyTable
        .select({
          view: "Grid view",
        })
        .all();
      await asyncForEach(records, async (record) => {
        let section = record.get("section");
        let sectionCopy;
        switch (section) {
          case "title":
          case "subtitle":
            sectionCopy = record.get("copy");
            break;
          case "introduction":
          case "how-it-works":
            sectionCopy = markdownToHTML(record.get("copy"));
            break;
          default:
            sectionCopy = record.get("copy");
        }
        if (section) copy[section] = sectionCopy;
      });
      this.logger.debug("loaded copy");
    } catch (err) {
      this.logger.error("unable to get copy", err);
    }
    this.copy = copy;
    return this.copy;
  }
}

class Style {
  constructor() {
    this.logger = getLogger("Style");
    this.tableName = "Style";
    this.styleTable = base(this.tableName);
    this.style = {};
  }

  async getStyle() {
    let style = {};
    style.gradient = {};
    style.font = {};
    try {
      let records = await this.styleTable
        .select({
          view: "Grid view",
        })
        .all();
      let gradientPrefix = "gradient-";
      let fontPrefix = "font-";
      await asyncForEach(records, async (record) => {
        let property = record.get("Property");
        let value = record.get("Value");
        if (property) {
          if (property.startsWith(gradientPrefix))
            style.gradient[property.slice(gradientPrefix.length)] = value;
          else if (property.startsWith(fontPrefix))
            style.font[property.slice(fontPrefix.length)] = value;
        }
      });
      this.logger.debug("loaded style");
    } catch (err) {
      this.logger.error("unable to get style", err);
    }
    this.style = style;
    return this.style;
  }
}

class AirtableManager {
  constructor() {
    this.logger = getLogger("AirtableManager");
    this.composers = new Composers();
    this.admins = new Admins();
    this.copy = new Copy();
    this.style = new Style();
    this.updatePeriod = 4000;
    this.updateStagger = this.updatePeriod / 4;
    this.start();
  }

  start() {
    this.logger.info(
      `starting airtable sync every ${
        this.updatePeriod / 1000
      }s, staggering calls by ${this.updateStagger / 1000}s`
    );
    this.interval = setInterval(this.sync.bind(this), this.updatePeriod);
  }

  stop() {
    clearInterval(this.interval);
  }

  async sync() {
    try {
      setTimeout(async () => {
        await this.composers.getComposers();
      }, this.updateStagger);
      setTimeout(async () => {
        await this.admins.getAdmins();
      }, this.updateStagger * 2);
      setTimeout(async () => {
        await this.copy.getCopy();
      }, this.updateStagger * 3);
      setTimeout(async () => {
        await this.style.getStyle();
      }, this.updateStagger * 4);
    } catch (err) {
      this.logger.error(err);
    }
  }
}

let airtableManager = new AirtableManager();

exports.Composers = airtableManager.composers;
exports.Admins = airtableManager.admins;
exports.Copy = airtableManager.copy;
exports.Style = airtableManager.style;
exports.AirtableManager = airtableManager;
