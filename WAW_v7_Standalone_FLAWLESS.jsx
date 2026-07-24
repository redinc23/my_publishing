// ============================================================================
// WE ARE WOLF — InDesign Automation v7.0 Standalone
// Complete Single-File Edition
// ============================================================================
//
//  This is the STANDALONE version — everything in one file.
//  No #include directives needed. Just open in InDesign and run.
//
//  BEFORE RUNNING:
//    1. Have your .docx manuscript ready
//       (styles: Heading 1, Heading 2, Normal, No Indent, Caption, Centered)
//    2. Have all images in ONE folder
//       (ch01_electricity.jpg … ch12_wolf_final.jpg)
//    3. Save any open work — this creates a NEW document
//
//  QUICK START:
//    File > Scripts > Other Script... > [select this file] > Open
//
// ============================================================================
//  CHANGELOG v7.0.1 → v7.0.2 (hardening patch)
// ============================================================================
//  [FIX] Standalone startup now loads/normalizes config before Module 02
//        constants are computed.
//  [FIX] Added legacy config aliases (bodySize/bodyFont/exportDir/etc.) so
//        merged v6/v7 module code uses one consistent config object.
//  [FIX] Corrected syntax error in HTML report generator.
//  [FIX] Added WAW.Log.success(), fixed export log serialization, and removed
//        ES5 Array.indexOf usage for ExtendScript ES3 compatibility.
//  [FIX] Corrected SaveOptions.NO casing and removed undefined doc reference
//        from master-page rule creation.
//
// ============================================================================
//  CHANGELOG v7.0.0 → v7.0.1 (patch)
// ============================================================================
//  [FIX] anchoredFrame.place() used stale reference after cut/paste;
//        changed to anchoredItem.place() (would crash on every image)
//  [FIX] opticalMarginSize set to 0.25 (nearly zero); corrected to
//        BODY_SIZE (11 pt) — the API expects the reference font size
//  [FIX] Caption temp frame height was 20 (inches), changed to 1
//
// ============================================================================
//  CHANGELOG v6 → v7
// ============================================================================
//
//  [ARCHITECTURE] Modular rewrite — 5 specialized modules under WAW namespace
//  [ARCHITECTURE] Zero global state pollution — all data in WAW.* objects
//  [ARCHITECTURE] Transaction rollback — safe undo on errors
//  [CONFIG]       JSON config with 50+ validated settings
//  [UI]           Visual progress bar with per-step status updates
//  [LOGGING]      4-level logging (DEBUG/INFO/WARN/ERROR) with categories
//  [MASTER]       4 master spreads: A-Body, B-FrontBack, C-ChapterOpen, D-Blank
//  [STYLES]       24 paragraph + 7 character + 5 object styles
//  [STYLES]       GREP styles: auto-_italic_, **bold**, ALL CAPS small caps
//  [STYLES]       Nested line styles for figure captions, TOC entries
//  [SWATCHES]     Professional 6-color palette with tints
//  [SECTIONS]     Auto roman-numeral front matter, arabic body pages
//  [IMPORT]       Enhanced Word import with URL→hyperlink conversion
//  [IMPORT]       Table auto-detection & formatting (NEW)
//  [IMPORT]       Footnote/endnote styling (NEW)
//  [IMAGES]       Anchored objects — images flow WITH text thread
//  [IMAGES]       Image preflight: PPI, color mode, ICC profile checks
//  [IMAGES]       8 formats: .jpg .jpeg .png .tif .tiff .psd .eps .pdf
//  [TYPOGRAPHY]   Live TOC via InDesign native TOC feature
//  [TYPOGRAPHY]   Index generation support (NEW)
//  [TYPOGRAPHY]   Justification tuning: word/letter/glyph spacing
//  [TYPOGRAPHY]   Optical margin alignment + widow/orphan control
//  [PREFLIGHT]    4-category: text, fonts, links, layout
//  [EXPORT]       PDF/X-4 compliance, 6-preset fallback chain
//  [EXPORT]       EPUB export for digital distribution (NEW)
//  [EXPORT]       Document packaging for print handoff (NEW)
//  [EXPORT]       HTML report with color-coded issues (NEW)
//  [EXPORT]       Structured JSON log export (NEW)
//
// ============================================================================
//  MODULES INCLUDED (in load order)
// ============================================================================
//  Module 01: Core Architecture  — namespace, config, logging, utils, UI
//  Module 02: Document Setup     — masters, swatches, styles, sections
//  Module 03: Import & Place     — Word import, style remap, images
//  Module 04: Typography Engine  — TOC, GREP styles, polish, masters
//  Module 05: Export & Report    — preflight, PDF/IDML/EPUB, packaging
//  Module 06: Main Orchestrator  — pipeline execution, dialogs, error handling
//
//  VERSION:     7.0.3 PRODUCTION
//  DATE:        May 2026
//  EXTENDSCRIPT: ES3 (Adobe InDesign CC 2015+)
//  SIZE:        ~10,400 lines, ~380 KB
//  CHANGES:     Enhanced font fallback, pre-flight validation, improved error handling
// ============================================================================

#target "InDesign"



// ============================================================================
// MODULE 01: BEGIN
// ============================================================================

/**
 * ============================================================================
 * WE ARE WOLF — InDesign Automation v7.0
 * Core Architecture Module (01_core.jsx)
 * ============================================================================
 *
 * DESCRIPTION:
 *   The foundational module for the WAW automation pipeline. Provides
 *   namespace management, configuration, logging, utilities, progress UI,
 *   transaction rollback, and safe execution wrapping.
 *
 *   Must be loaded before all other WAW modules. Does not depend on any
 *   other module.
 *
 * COMPATIBILITY:
 *   Adobe InDesign CC 2015+ (ExtendScript / JavaScript ES3)
 *
 * AUTHOR:
 *   We Are Wolf Automation Team
 *
 * VERSION HISTORY:
 *   7.0.0 — Complete rewrite from v6.0 monolith to modular architecture
 *
 * CODING STANDARDS:
 *   - ES3 only: no Array.forEach, Object.keys, let/const, template literals
 *   - All measurements in points internally; conversion on input/output
 *   - JSDoc comments on every public function
 *   - try/catch around all external (file/UI/font) operations
 * ============================================================================
 */

// ============================================================================
// NAMESPACE INITIALIZATION
// ============================================================================

/**
 * Root namespace for the We Are Wolf InDesign Automation system.
 * @namespace WAW
 */
var WAW = {
    /** @type {string} Semantic version string */
    version: "7.0.2",

    /** @type {string} Human-readable system name */
    name: "We Are Wolf Automation",

    /** @type {Object|null} Resolved configuration object (set by WAW.Config.load) */
    config: null,

    /** @type {Object} Mutable runtime state shared across modules */
    state: {},

    /** @type {Object} Internal log buffer and current level */
    log: { entries: [], level: 2 },

    /** @type {Object} UI element references (progress dialog, etc.) */
    ui: { progress: null, dialog: null }
};

// Announce module load
$.writeln("[WAW] Loading Core Module v" + WAW.version);

// ============================================================================
// LOGGING SYSTEM — WAW.Log
// ============================================================================

/**
 * Structured logging subsystem with level-based filtering,
 * categorization, and persistent output.
 *
 * @namespace WAW.Log
 */
WAW.Log = {};

/** @type {number} Debug log level — verbose internal tracing */
WAW.Log.DEBUG = 0;

/** @type {number} Info log level — standard operational messages */
WAW.Log.INFO = 1;

/** @type {number} Warning log level — recoverable issues */
WAW.Log.WARN = 2;

/** @type {number} Error log level — failures requiring attention */
WAW.Log.ERROR = 3;

/** @type {Array} Internal buffer of log entries */
WAW.Log._entries = [];

/** @type {number} Current minimum log level (messages below are suppressed) */
WAW.Log._level = WAW.Log.INFO;

/** @type {number} Maximum number of entries to keep in memory */
WAW.Log._maxEntries = 5000;

/** @type {Array} Registered output callbacks for custom log targets */
WAW.Log._outputs = [];

/**
 * Level label lookup table for formatting.
 * @private
 */
WAW.Log._labels = ["DEBUG", "INFO ", "WARN ", "ERROR"];

/**
 * Core logging function. Records a message with timestamp, level, and optional category.
 *
 * @param {number} level   — One of WAW.Log.DEBUG / INFO / WARN / ERROR
 * @param {string} message — Primary log text
 * @param {string} [detail]   — Additional detail string (appended on new line)
 * @param {string} [category] — Functional category ("STYLE", "IMAGE", "EXPORT", etc.)
 * @returns {Object} The log entry object that was created
 */
WAW.Log.log = function(level, message, detail, category) {
    "use strict";

    // Normalize inputs
    if (typeof level !== "number") level = WAW.Log.INFO;
    if (typeof message !== "string") message = String(message);
    if (typeof detail === "undefined") detail = "";
    if (typeof category === "undefined") category = "GENERAL";

    // Create entry object
    var now = new Date();
    var entry = {
        timestamp: now.getTime(),
        timeString: WAW.Log._formatTime(now),
        level: level,
        levelLabel: WAW.Log._labels[level] || "?????",
        category: category,
        message: message,
        detail: detail
    };

    // Store in buffer (with overflow protection)
    WAW.Log._entries.push(entry);
    if (WAW.Log._entries.length > WAW.Log._maxEntries) {
        WAW.Log._entries.splice(0, Math.floor(WAW.Log._maxEntries * 0.2));
    }

    // Console output if level meets threshold
    if (level >= WAW.Log._level) {
        var line = "[" + entry.timeString + "] [" + entry.levelLabel + "] [" + category + "] " + message;
        $.writeln(line);
        if (detail && detail.length > 0) {
            $.writeln("    > " + detail);
        }
    }

    // Dispatch to any registered external outputs
    var i;
    for (i = 0; i < WAW.Log._outputs.length; i++) {
        try {
            WAW.Log._outputs[i](entry);
        } catch (e) {
            // Silently ignore output callback failures
        }
    }

    return entry;
};

/**
 * Log a debug-level message.
 *
 * @param {string} message — Primary log text
 * @param {string} [detail] — Additional detail
 * @param {string} [category] — Functional category
 * @returns {Object} Log entry
 */
WAW.Log.debug = function(message, detail, category) {
    return WAW.Log.log(WAW.Log.DEBUG, message, detail, category);
};

/**
 * Log an info-level message.
 *
 * @param {string} message — Primary log text
 * @param {string} [detail] — Additional detail
 * @param {string} [category] — Functional category
 * @returns {Object} Log entry
 */
WAW.Log.info = function(message, detail, category) {
    return WAW.Log.log(WAW.Log.INFO, message, detail, category);
};

/**
 * Log a warning-level message.
 *
 * @param {string} message — Primary log text
 * @param {string} [detail] — Additional detail
 * @param {string} [category] — Functional category
 * @returns {Object} Log entry
 */
WAW.Log.warn = function(message, detail, category) {
    return WAW.Log.log(WAW.Log.WARN, message, detail, category);
};

/**
 * Log a success-level message. Success is informational but named separately
 * because later modules call WAW.Log.success().
 */
WAW.Log.success = function(message, detail, category) {
    return WAW.Log.log(WAW.Log.INFO, message, detail, category || "SUCCESS");
};

/**
 * Log an error-level message, optionally capturing exception details.
 *
 * @param {string} message    — Primary error text
 * @param {Error} [exception] — ExtendScript Error object to capture
 * @param {string} [category] — Functional category
 * @returns {Object} Log entry
 */
WAW.Log.error = function(message, exception, category) {
    var detail = "";
    if (exception) {
        detail = "Exception: " + exception.toString();
        if (exception.line && exception.line > 0) {
            detail += " | Line: " + exception.line;
        }
        if (exception.fileName) {
            detail += " | File: " + exception.fileName;
        }
    }
    return WAW.Log.log(WAW.Log.ERROR, message, detail, category || "ERROR");
};

/**
 * Set the minimum log level. Messages below this level are suppressed from output.
 *
 * @param {number} level — One of WAW.Log.DEBUG / INFO / WARN / ERROR
 */
WAW.Log.setLevel = function(level) {
    if (typeof level === "number" && level >= 0 && level <= 3) {
        WAW.Log._level = level;
        WAW.Log.info("Log level set to " + WAW.Log._labels[level], "", "SYSTEM");
    }
};

/**
 * Register an external output callback that receives every log entry.
 *
 * @param {Function} callback — Function(entry) called for each log entry
 */
WAW.Log.addOutput = function(callback) {
    if (typeof callback === "function") {
        WAW.Log._outputs.push(callback);
    }
};

/**
 * Remove a previously registered output callback.
 *
 * @param {Function} callback — The callback to remove
 */
WAW.Log.removeOutput = function(callback) {
    var i;
    for (i = WAW.Log._outputs.length - 1; i >= 0; i--) {
        if (WAW.Log._outputs[i] === callback) {
            WAW.Log._outputs.splice(i, 1);
        }
    }
};

/**
 * Format a Date object as HH:MM:SS.mmm string.
 *
 * @private
 * @param {Date} date — Date to format
 * @returns {string} Formatted time string
 */
WAW.Log._formatTime = function(date) {
    var h = WAW.Utils.padLeft(String(date.getHours()), 2, "0");
    var m = WAW.Utils.padLeft(String(date.getMinutes()), 2, "0");
    var s = WAW.Utils.padLeft(String(date.getSeconds()), 2, "0");
    var ms = WAW.Utils.padLeft(String(date.getMilliseconds()), 3, "0");
    return h + ":" + m + ":" + s + "." + ms;
};

/**
 * Generate a formatted log report string from the current buffer.
 *
 * @param {number} [minLevel] — Minimum level to include (default: include all)
 * @returns {string} Multi-line formatted report
 */
WAW.Log.getReport = function(minLevel) {
    if (typeof minLevel !== "number") minLevel = WAW.Log.DEBUG;

    var lines = [];
    lines.push("================================================================================");
    lines.push("  WAW v" + WAW.version + " — Execution Log Report");
    lines.push("  Generated: " + new Date().toString());
    lines.push("  Total Entries: " + WAW.Log._entries.length);
    lines.push("================================================================================");
    lines.push("");

    var i;
    var entry;
    var count = 0;
    for (i = 0; i < WAW.Log._entries.length; i++) {
        entry = WAW.Log._entries[i];
        if (entry.level >= minLevel) {
            var line = entry.timeString + " [" + entry.levelLabel + "] [" + entry.category + "] " + entry.message;
            lines.push(line);
            if (entry.detail && entry.detail.length > 0) {
                lines.push("    > " + entry.detail);
            }
            count++;
        }
    }

    lines.push("");
    lines.push("================================================================================");
    lines.push("  End of Report — " + count + " entries displayed");
    lines.push("================================================================================");

    return lines.join("\r\n");
};

/**
 * Save the current log buffer to a timestamped text file.
 *
 * @param {string} folderPath — Destination folder path (e.g., "~/Desktop/WAW_Logs")
 * @param {number} [minLevel] — Minimum level to include (default: all)
 * @returns {boolean} True if file was written successfully
 */
WAW.Log.saveToFile = function(folderPath, minLevel) {
    "use strict";

    try {
        var folder = new Folder(folderPath);
        if (!folder.exists) {
            if (!folder.create()) {
                $.writeln("[WAW.Log] Failed to create log folder: " + folderPath);
                return false;
            }
        }

        var now = new Date();
        var ts = "" + now.getFullYear() +
                 WAW.Utils.padLeft(String(now.getMonth() + 1), 2, "0") +
                 WAW.Utils.padLeft(String(now.getDate()), 2, "0") + "_" +
                 WAW.Utils.padLeft(String(now.getHours()), 2, "0") +
                 WAW.Utils.padLeft(String(now.getMinutes()), 2, "0") +
                 WAW.Utils.padLeft(String(now.getSeconds()), 2, "0");

        var fileName = "WAW_Log_" + ts + ".txt";
        var file = new File(folder.absoluteURI + "/" + fileName);

        if (file.open("w")) {
            var report = WAW.Log.getReport(minLevel);
            file.write(report);
            file.close();
            $.writeln("[WAW.Log] Log saved to: " + file.fsName);
            return true;
        } else {
            $.writeln("[WAW.Log] Failed to open file for writing: " + file.fsName);
            return false;
        }
    } catch (e) {
        $.writeln("[WAW.Log] Exception saving log: " + e.toString());
        return false;
    }
};

/**
 * Clear all entries from the log buffer.
 */
WAW.Log.clear = function() {
    WAW.Log._entries = [];
    WAW.Log.info("Log buffer cleared", "", "SYSTEM");
};

/**
 * Get count of log entries at or above a given level.
 *
 * @param {number} [level] — Level threshold (default: ERROR)
 * @returns {number} Count of matching entries
 */
WAW.Log.count = function(level) {
    if (typeof level !== "number") level = WAW.Log.ERROR;
    var count = 0;
    var i;
    for (i = 0; i < WAW.Log._entries.length; i++) {
        if (WAW.Log._entries[i].level >= level) {
            count++;
        }
    }
    return count;
};

// ============================================================================
// UTILITY LIBRARY — WAW.Utils
// ============================================================================

/**
 * General-purpose utility functions used across the WAW pipeline.
 * All functions are ES3-safe and handle ExtendScript edge cases.
 *
 * @namespace WAW.Utils
 */
WAW.Utils = {};

/**
 * Ensure a folder exists on disk, creating it (and parent folders) if needed.
 *
 * @param {string} path — Folder path as string
 * @returns {Folder|null} The Folder object, or null on failure
 */
WAW.Utils.ensureFolder = function(path) {
    "use strict";
    try {
        var folder = new Folder(path);
        if (!folder.exists) {
            if (!folder.create()) {
                WAW.Log.error("Failed to create folder: " + path, null, "SYSTEM");
                return null;
            }
        }
        return folder;
    } catch (e) {
        WAW.Log.error("ensureFolder() exception for path: " + path, e, "SYSTEM");
        return null;
    }
};

/**
 * Sanitize a string for safe use as a filename.
 * Removes/replaces characters that are illegal in cross-platform filenames.
 *
 * @param {string} name — Raw name string
 * @returns {string} Sanitized filename
 */
WAW.Utils.safeFileName = function(name) {
    if (typeof name !== "string") name = String(name);
    var result = name;
    // Replace illegal characters with underscore
    result = result.replace(/[<>:"/\\|?*]/g, "_");
    // Remove control characters
    result = result.replace(/[\x00-\x1f\x7f]/g, "");
    // Trim trailing dots and spaces (problematic on Windows)
    result = result.replace(/[\s.]+$/, "");
    // Limit length
    if (result.length > 200) {
        result = result.substring(0, 200);
    }
    // Ensure not empty
    if (result.length === 0) {
        result = "untitled";
    }
    return result;
};

/**
 * Pad a string on the left to a minimum length with a fill character.
 * ES3-safe replacement for String.prototype.padStart.
 *
 * @param {string} str — Source string
 * @param {number} len — Desired minimum length
 * @param {string} ch  — Fill character (default: " ")
 * @returns {string} Padded string
 */
WAW.Utils.padLeft = function(str, len, ch) {
    if (typeof str !== "string") str = String(str);
    if (typeof len !== "number" || len <= 0) return str;
    if (typeof ch !== "string" || ch.length === 0) ch = " ";
    while (str.length < len) {
        str = ch + str;
    }
    return str;
};

/**
 * Convert a measurement string to InDesign points.
 * Handles strings like "6 in", "72 pt", "25.4 mm", "2.54 cm", "3p6", "100 px"
 *
 * @param {string|number} val — Measurement value (string with unit or numeric points)
 * @returns {number} Value in points, or 0 if unparseable
 */
WAW.Utils.toPoints = function(val) {
    if (typeof val === "number") return val;
    if (typeof val !== "string") return 0;

    var s = WAW.Utils.trim(val).toLowerCase();
    if (s.length === 0) return 0;

    // Extract numeric portion and unit
    var numMatch = s.match(/^([0-9]*\.?[0-9]+)\s*(in|inch|inches|pt|point|points|mm|millimeter|cm|centimeter|px|pixel|pica|picas|cicero|ciceros|p|pc)?$/);
    if (!numMatch) {
        // Try picas notation: 3p6 (3 picas, 6 points)
        var picaMatch = s.match(/^([0-9]+)p([0-9]+)$/);
        if (picaMatch) {
            var picas = parseFloat(picaMatch[1]);
            var pts = parseFloat(picaMatch[2]);
            return (picas * 12) + pts;
        }
        WAW.Log.warn("toPoints(): unable to parse measurement: " + val, "", "SYSTEM");
        return 0;
    }

    var num = parseFloat(numMatch[1]);
    var unit = numMatch[2] || "pt";

    switch (unit) {
        case "in":
        case "inch":
        case "inches":
            return num * 72;
        case "mm":
        case "millimeter":
            return num * 2.834645;
        case "cm":
        case "centimeter":
            return num * 28.34645;
        case "px":
        case "pixel":
            // Default to 72 PPI
            return num * 0.75;
        case "pica":
        case "picas":
        case "p":
        case "pc":
            return num * 12;
        case "cicero":
        case "ciceros":
            return num * 12.787875;
        case "pt":
        case "point":
        case "points":
        default:
            return num;
    }
};

/**
 * Convert a measurement value to inches (as a number).
 *
 * @param {string|number} val — Measurement value
 * @returns {number} Value in inches
 */
WAW.Utils.toInches = function(val) {
    return WAW.Utils.toPoints(val) / 72;
};

/**
 * Resolve a font by name or family+style, with a fallback chain.
 * Searches the active document and application font collections.
 *
 * @param {string} nameOrFamily — Font family name (e.g., "Minion Pro")
 * @param {string} [styleName]  — Font style name (e.g., "Regular")
 * @returns {Font|null} Resolved Font object, or null if not found
 */
WAW.Utils.safeFont = function(nameOrFamily, styleName) {
    "use strict";
    if (!nameOrFamily) return null;
    if (typeof styleName !== "string") styleName = "Regular";

    try {
        var doc = app.documents.length > 0 ? app.activeDocument : null;
        var f, i;

        // Try document fonts first (if a document is open)
        if (doc) {
            for (i = 0; i < doc.fonts.length; i++) {
                f = doc.fonts[i];
                if (f.name === nameOrFamily || f.fontFamily === nameOrFamily) {
                    if (!styleName || f.fontStyleName === styleName) {
                        return f;
                    }
                }
            }
        }

        // Try application fonts
        for (i = 0; i < app.fonts.length; i++) {
            f = app.fonts[i];
            if (f.name === nameOrFamily || f.fontFamily === nameOrFamily) {
                if (!styleName || f.fontStyleName === styleName) {
                    return f;
                }
            }
        }

        // Try partial match on family
        for (i = 0; i < app.fonts.length; i++) {
            f = app.fonts[i];
            if (f.fontFamily.indexOf(nameOrFamily) === 0) {
                if (!styleName || f.fontStyleName === styleName) {
                    WAW.Log.warn("Font fallback used: " + f.fontFamily + " " + f.fontStyleName + " for requested " + nameOrFamily + " " + styleName, "", "STYLE");
                    return f;
                }
            }
        }

        // Ultimate fallback: Try common serif fonts
        var fallbackFonts = ["Minion Pro", "Adobe Garamond Pro", "Garamond", "Times New Roman", "Georgia"];
        for (var fb = 0; fb < fallbackFonts.length; fb++) {
            for (i = 0; i < app.fonts.length; i++) {
                f = app.fonts[i];
                if (f.fontFamily === fallbackFonts[fb]) {
                    WAW.Log.warn("Font ultimate fallback to " + f.fontFamily + " " + f.fontStyleName + " for: " + nameOrFamily, "", "STYLE");
                    return f;
                }
            }
        }

        // Last resort: return first available font
        if (app.fonts.length > 0) {
            WAW.Log.error("Using first available font as last resort for: " + nameOrFamily, null, "STYLE");
            return app.fonts[0];
        }

        WAW.Log.error("safeFont(): NO FONTS AVAILABLE - critical error", null, "STYLE");
        return null;
    } catch (e) {
        WAW.Log.error("safeFont() exception for: " + nameOrFamily, e, "STYLE");
        return null;
    }
};

/**
 * Safely retrieve a named item from an InDesign collection.
 *
 * @param {Object} collection — InDesign collection (e.g., app.fonts, doc.paragraphStyles)
 * @param {string} name       — Name of item to retrieve
 * @param {*} [fallback]      — Value to return if not found
 * @returns {*} The collection item, or fallback value
 */
WAW.Utils.safeGet = function(collection, name, fallback) {
    "use strict";
    try {
        if (!collection || !collection.itemByName) {
            return fallback;
        }
        var item = collection.itemByName(name);
        // InDesign collections return invalid objects, not null, when missing
        if (item && item.isValid) {
            return item;
        }
    } catch (e) {
        // Collection may not support itemByName
    }
    return fallback;
};

/**
 * Iterate over an InDesign collection (or array) with a callback.
 * Provides ES3-safe iteration that handles collection quirks.
 *
 * @param {Object|Array} collection — Collection or array to iterate
 * @param {Function} callback       — Function(item, index) called for each element
 */
WAW.Utils.each = function(collection, callback) {
    "use strict";
    if (!collection || typeof callback !== "function") return;

    try {
        var length = collection.length;
        if (typeof length !== "number") return;

        var i;
        for (i = 0; i < length; i++) {
            try {
                var item = collection[i];
                if (item && item.isValid !== false) {
                    callback(item, i);
                }
            } catch (innerE) {
                // Continue iteration even if one item fails
            }
        }
    } catch (e) {
        WAW.Log.error("Utils.each() exception", e, "SYSTEM");
    }
};

/**
 * Check if a named item exists in an InDesign collection.
 *
 * @param {Object} collection — InDesign collection
 * @param {string} name       — Name to check for
 * @returns {boolean} True if the named item exists
 */
WAW.Utils.has = function(collection, name) {
    "use strict";
    try {
        if (!collection || !collection.itemByName) return false;
        var item = collection.itemByName(name);
        return (item && item.isValid);
    } catch (e) {
        return false;
    }
};

/**
 * Shallow-merge properties from source into target.
 * ES3-safe replacement for Object.assign.
 *
 * @param {Object} target — Destination object (modified in place)
 * @param {Object} source — Source object whose properties are copied
 * @returns {Object} The modified target object
 */
WAW.Utils.extend = function(target, source) {
    "use strict";
    if (!target || typeof target !== "object") target = {};
    if (!source || typeof source !== "object") return target;

    var key;
    for (key in source) {
        if (source.hasOwnProperty(key)) {
            // Only shallow-copy; don't recurse into nested objects
            if (typeof source[key] === "object" && source[key] !== null &&
                !(source[key] instanceof Array)) {
                // For nested plain objects, ensure target has an object then merge
                if (!target[key] || typeof target[key] !== "object") {
                    target[key] = {};
                }
                var subKey;
                for (subKey in source[key]) {
                    if (source[key].hasOwnProperty(subKey)) {
                        target[key][subKey] = source[key][subKey];
                    }
                }
            } else {
                target[key] = source[key];
            }
        }
    }
    return target;
};

/**
 * ES3-safe string trim polyfill.
 * Removes leading and trailing whitespace.
 *
 * @param {string} str — String to trim
 * @returns {string} Trimmed string
 */
WAW.Utils.trim = function(str) {
    if (typeof str !== "string") str = String(str);
    return str.replace(/^\s+|\s+$/g, "");
};

/**
 * Check if a value is numeric (finite number or numeric string).
 *
 * @param {*} val — Value to test
 * @returns {boolean} True if the value is numeric
 */
WAW.Utils.isNumeric = function(val) {
    if (typeof val === "number") {
        return isFinite(val);
    }
    if (typeof val === "string") {
        var trimmed = WAW.Utils.trim(val);
        if (trimmed.length === 0) return false;
        return !isNaN(Number(trimmed)) && isFinite(Number(trimmed));
    }
    return false;
};

/**
 * Parse a JSON-like configuration string into an object.
 * ES3-safe limited JSON parser for simple flat/semi-nested objects.
 * Supports strings, numbers, booleans, null, arrays, and one-level nested objects.
 *
 * @param {string} text — JSON text to parse
 * @returns {Object|null} Parsed object, or null on failure
 */
WAW.Utils.parseJSON = function(text) {
    "use strict";
    try {
        if (typeof text !== "string" || text.length === 0) return null;

        // Remove BOM and trim
        var clean = text.replace(/^\uFEFF/, "");
        clean = WAW.Utils.trim(clean);

        // Use InDesign's built-in JSON if available (CC 2018+)
        if (typeof JSON !== "undefined" && JSON.parse) {
            return JSON.parse(clean);
        }

        // Fallback: manual parsing for simple flat objects
        var result = {};
        var inString = false;
        var currentKey = "";
        var currentVal = "";
        var depth = 0;
        var expectingKey = true;
        var i;

        for (i = 0; i < clean.length; i++) {
            var ch = clean.charAt(i);

            if (ch === "\"" && (i === 0 || clean.charAt(i - 1) !== "\\")) {
                inString = !inString;
                if (!expectingKey) {
                    currentVal += ch;
                }
                continue;
            }

            if (inString) {
                if (expectingKey) {
                    currentKey += ch;
                } else {
                    currentVal += ch;
                }
                continue;
            }

            if (ch === "{" || ch === "[") {
                depth++;
                if (!expectingKey) currentVal += ch;
                continue;
            }

            if (ch === "}" || ch === "]") {
                depth--;
                if (!expectingKey && depth === 0) {
                    // End of value
                    WAW.Utils._assignParsedValue(result, currentKey, currentVal);
                    currentKey = "";
                    currentVal = "";
                    expectingKey = true;
                } else if (!expectingKey) {
                    currentVal += ch;
                }
                continue;
            }

            if (ch === ":" && depth === 1 && expectingKey) {
                expectingKey = false;
                continue;
            }

            if (ch === "," && depth === 1) {
                if (!expectingKey) {
                    WAW.Utils._assignParsedValue(result, currentKey, currentVal);
                    currentKey = "";
                    currentVal = "";
                    expectingKey = true;
                }
                continue;
            }

            if (!expectingKey) {
                currentVal += ch;
            }
        }

        // Handle last value if no trailing comma
        if (!expectingKey && currentKey.length > 0) {
            WAW.Utils._assignParsedValue(result, currentKey, currentVal);
        }

        return result;
    } catch (e) {
        WAW.Log.error("parseJSON() exception", e, "SYSTEM");
        return null;
    }
};

/**
 * Helper to assign a parsed string value with type inference.
 * @private
 */
WAW.Utils._assignParsedValue = function(obj, key, val) {
    key = WAW.Utils.trim(key).replace(/^"/, "").replace(/"$/, "");
    val = WAW.Utils.trim(val);

    if (val === "true") {
        obj[key] = true;
    } else if (val === "false") {
        obj[key] = false;
    } else if (val === "null") {
        obj[key] = null;
    } else if (/^".*"$/.test(val)) {
        // String literal
        obj[key] = val.replace(/^"/, "").replace(/"$/, "");
    } else if (/^\[.*\]$/.test(val)) {
        // Array — attempt simple split
        var inner = val.substring(1, val.length - 1);
        obj[key] = [];
        var parts = inner.split(",");
        var i;
        for (i = 0; i < parts.length; i++) {
            var part = WAW.Utils.trim(parts[i]);
            if (part.length > 0) {
                if (/^".*"$/.test(part)) {
                    obj[key].push(part.replace(/^"/, "").replace(/"$/, ""));
                } else if (WAW.Utils.isNumeric(part)) {
                    obj[key].push(Number(part));
                } else if (part === "true" || part === "false") {
                    obj[key].push(part === "true");
                } else {
                    obj[key].push(part);
                }
            }
        }
    } else if (WAW.Utils.isNumeric(val)) {
        obj[key] = Number(val);
    } else if (/^\{.*\}$/.test(val)) {
        // Nested object — store as-is for now, can be parsed recursively if needed
        obj[key] = val;
    } else {
        obj[key] = val;
    }
};

/**
 * Read a text file and return its contents as a string.
 *
 * @param {string} filePath — Absolute file path
 * @returns {string|null} File contents, or null on failure
 */
WAW.Utils.readTextFile = function(filePath) {
    "use strict";
    try {
        var file = new File(filePath);
        if (!file.exists) {
            WAW.Log.error("File not found: " + filePath, null, "SYSTEM");
            return null;
        }
        if (file.open("r")) {
            var contents = file.read();
            file.close();
            return contents;
        }
        return null;
    } catch (e) {
        WAW.Log.error("readTextFile() exception: " + filePath, e, "SYSTEM");
        return null;
    }
};

/**
 * Write a text string to a file.
 *
 * @param {string} filePath — Absolute file path
 * @param {string} text     — Text to write
 * @returns {boolean} True on success
 */
WAW.Utils.writeTextFile = function(filePath, text) {
    "use strict";
    try {
        var file = new File(filePath);
        if (file.open("w")) {
            file.write(text);
            file.close();
            return true;
        }
        return false;
    } catch (e) {
        WAW.Log.error("writeTextFile() exception: " + filePath, e, "SYSTEM");
        return false;
    }
};

/**
 * Convert a simple object to a JSON-like string.
 * ES3-safe serializer for configuration objects.
 *
 * @param {Object} obj   — Object to serialize
 * @param {number} [indent] — Indentation level (for pretty-printing)
 * @returns {string} JSON-like string representation
 */
WAW.Utils.toJSON = function(obj, indent) {
    "use strict";
    if (typeof indent !== "number") indent = 0;
    if (obj === null) return "null";
    if (typeof obj === "string") return "\"" + obj.replace(/"/g, "\\\"") + "\"";
    if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
    if (obj instanceof Array) {
        var arrItems = [];
        var i;
        for (i = 0; i < obj.length; i++) {
            arrItems.push(WAW.Utils.toJSON(obj[i], indent));
        }
        return "[" + arrItems.join(", ") + "]";
    }
    if (typeof obj === "object") {
        var keys = [];
        var k;
        for (k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        var pad = "";
        for (i = 0; i < indent; i++) pad += "  ";
        var childPad = pad + "  ";
        var lines = [];
        for (i = 0; i < keys.length; i++) {
            k = keys[i];
            lines.push(childPad + "\"" + k + "\": " + WAW.Utils.toJSON(obj[k], indent + 1));
        }
        if (lines.length === 0) return "{}";
        return "{\n" + lines.join(",\n") + "\n" + pad + "}";
    }
    return "\"" + String(obj) + "\"";
};


// ============================================================================
// CONFIGURATION SYSTEM — WAW.Config
// ============================================================================

/**
 * Centralized configuration management with validation,
 * defaults merging, and JSON file loading.
 *
 * @namespace WAW.Config
 */
WAW.Config = {};

/**
 * Resolved active configuration (set after load/validate).
 * @type {Object|null}
 */
WAW.Config._active = null;

/**
 * Internal flag: has the config been loaded.
 * @type {boolean}
 */
WAW.Config._loaded = false;

/**
 * Comprehensive default configuration.
 * All values must be valid and self-consistent.
 * @type {Object}
 */
WAW.Config.defaults = {
    // --- Document Setup ---
    pageWidth: "6 in",
    pageHeight: "9 in",
    pageSize: "Custom",
    facingPages: true,
    marginTop: "0.75 in",
    marginBottom: "0.75 in",
    marginInside: "0.875 in",
    marginOutside: "0.625 in",
    bleedTop: "0 in",
    bleedBottom: "0 in",
    bleedInside: "0 in",
    bleedOutside: "0 in",
    columnCount: 1,
    columnGutter: "0.25 in",
    documentIntent: DocumentIntent.PRINT_INTENT,

    // --- Typography Defaults ---
    bodyFontFamily: "Minion Pro",
    bodyFontStyle: "Regular",
    bodyFontSize: "11 pt",
    bodyLeading: "14 pt",
    bodyAlignment: Justification.LEFT_JUSTIFIED,
    paragraphSpacing: "0 pt",
    firstLineIndent: "0.25 in",

    heading1FontFamily: "Minion Pro",
    heading1FontStyle: "Bold",
    heading1FontSize: "24 pt",
    heading1Leading: "28 pt",
    heading1SpaceBefore: "18 pt",
    heading1SpaceAfter: "12 pt",

    heading2FontFamily: "Minion Pro",
    heading2FontStyle: "Bold",
    heading2FontSize: "18 pt",
    heading2Leading: "22 pt",
    heading2SpaceBefore: "14 pt",
    heading2SpaceAfter: "8 pt",

    heading3FontFamily: "Minion Pro",
    heading3FontStyle: "Bold Italic",
    heading3FontSize: "14 pt",
    heading3Leading: "18 pt",

    // --- Drop Caps ---
    dropCap: {
        enabled: true,
        lines: 3,
        characters: 1,
        fontFamily: "Minion Pro",
        fontStyle: "Regular"
    },

    // --- Running Headers / Footers ---
    runningHeader: {
        enabled: true,
        fontFamily: "Minion Pro",
        fontStyle: "Italic",
        fontSize: "9 pt",
        leftContent: "bookTitle",
        rightContent: "chapterTitle",
        showOnFirstPage: false
    },

    pageNumbers: {
        enabled: true,
        fontFamily: "Minion Pro",
        fontStyle: "Regular",
        fontSize: "9 pt",
        position: "footerOutside",
        startNumber: 1
    },

    // --- Image Handling ---
    imageResolution: 300,
    imageResolutionUnit: Resolution.PPI,
    imageDisplayQuality: DisplayQuality.HIGH_QUALITY,
    imageFrameFitting: FitOptions.FILL_PROPORTIONALLY,
    imageCaption: {
        enabled: true,
        fontFamily: "Minion Pro",
        fontStyle: "Italic",
        fontSize: "9 pt",
        prefix: "Figure ",
        position: "below"
    },
    imageBorder: {
        enabled: false,
        weight: "0.5 pt",
        color: "Black",
        type: StrokeWeight.ONE
    },

    // --- Table of Contents ---
    toc: {
        enabled: true,
        title: "Contents",
        titleFontFamily: "Minion Pro",
        titleFontStyle: "Bold",
        titleFontSize: "18 pt",
        entryFontFamily: "Minion Pro",
        entryFontStyle: "Regular",
        entryFontSize: "11 pt",
        entryLeading: "14 pt",
        includeLevels: [1, 2],
        leaderStyle: "\t.",
        leaderWeight: "0.25 pt"
    },

    // --- Section Numbering ---
    sectionNumbering: {
        frontMatter: {
            style: "roman",
            start: "i"
        },
        body: {
            style: "arabic",
            start: 1
        },
        backMatter: {
            style: "roman",
            start: "i"
        }
    },

    // --- Color Definitions ---
    colors: {
        bodyText: { model: ColorModel.PROCESS, space: ColorSpace.CMYK, values: [0, 0, 0, 100] },
        headingText: { model: ColorModel.PROCESS, space: ColorSpace.CMYK, values: [0, 0, 0, 100] },
        accent: { model: ColorModel.PROCESS, space: ColorSpace.CMYK, values: [0, 75, 100, 0] }
    },

    // --- Preflight Checks ---
    preflight: {
        enabled: true,
        resolution: {
            minimum: 300,
            unit: "PPI"
        },
        fonts: {
            allowSubstitutes: false,
            requireEmbedded: true
        },
        oversetText: {
            check: true,
            maxOversetFrames: 0
        },
        missingLinks: {
            check: true
        }
    },

    // --- Export Settings ---
    export: {
        formats: ["pdf", "idml", "package"],
        pdfPreset: "[High Quality Print]",
        pdfCompatibility: PDFExportCompatibility.ACROBAT_6,
        exportBleed: true,
        exportSlugs: false,
        outputFolder: ""
    },

    // --- UI & Progress ---
    progressUI: {
        enabled: true,
        showStepDetails: true,
        updateInterval: 100
    },

    // --- Logging ---
    logging: {
        level: "info",
        saveToFile: true,
        logFolder: ""
    }
};

/**
 * Normalize legacy shorthand keys used by the standalone modules.
 * The original modules were merged from older files that used names such as
 * bodySize/bodyFont/exportDir while the v7 defaults use bodyFontSize,
 * bodyFontFamily, and export.outputFolder.  Keeping these aliases in one place
 * prevents startup crashes and keeps user JSON configs backward compatible.
 *
 * @param {Object} cfg Configuration object to normalize in place
 * @returns {Object} The same configuration object
 */
WAW.Config.applyLegacyAliases = function(cfg) {
    "use strict";
    if (!cfg || typeof cfg !== "object") return cfg;

    var u = WAW.Utils;
    function missing(v) {
        return (typeof v === "undefined" || v === null || v === "");
    }
    function points(v, fallback) {
        if (missing(v)) v = fallback;
        if (typeof v === "number") return v;
        return u.toPoints(v);
    }
    function setIfMissing(name, value) {
        if (missing(cfg[name])) cfg[name] = value;
    }

    if (missing(cfg.bleed)) cfg.bleed = cfg.bleedTop || "0 in";
    setIfMissing("bodySize", points(cfg.bodyFontSize, "11 pt"));
    setIfMissing("bodyLeading", points(cfg.bodyLeading, "14 pt"));
    setIfMissing("bodyFont", cfg.bodyFontFamily || "Minion Pro");
    setIfMissing("chapterSize", points(cfg.heading1FontSize, "24 pt"));
    setIfMissing("partSize", points(cfg.heading2FontSize, "18 pt"));
    setIfMissing("captionSize", cfg.imageCaption ? points(cfg.imageCaption.fontSize, "9 pt") : 9);
    setIfMissing("gridStart", cfg.marginTop || "0.75 in");
    setIfMissing("gridIncrement", cfg.bodyLeading);
    setIfMissing("dropCapLines", cfg.dropCap && !missing(cfg.dropCap.lines) ? cfg.dropCap.lines : 3);
    setIfMissing("dropCapChars", cfg.dropCap && !missing(cfg.dropCap.characters) ? cfg.dropCap.characters : 1);
    setIfMissing("captionSpaceBefore", "0.125 in");
    setIfMissing("frontMatterPages", 8);

    if (!cfg.import || typeof cfg.import !== "object") cfg.import = {};
    if (!cfg.image || typeof cfg.image !== "object") cfg.image = {};
    if (missing(cfg.image.width)) cfg.image.width = "80%";
    if (missing(cfg.image.maxWidth)) cfg.image.maxWidth = 432;
    if (missing(cfg.image.objectStyle)) cfg.image.objectStyle = "WAW_Image Frame";

    if (!cfg.export || typeof cfg.export !== "object") cfg.export = {};
    if (missing(cfg.export.outputFolder) && !missing(cfg.exportDir)) cfg.export.outputFolder = cfg.exportDir;
    if (missing(cfg.export.outputFolder)) cfg.export.outputFolder = "~/Desktop/WeAreWolf_Output/";
    if (missing(cfg.export.exportDir)) cfg.export.exportDir = cfg.export.outputFolder;
    setIfMissing("exportDir", cfg.export.outputFolder);
    if (missing(cfg.export.filePrefix)) cfg.export.filePrefix = "WeAreWolf";
    if (missing(cfg.export.minPPI)) {
        cfg.export.minPPI = (cfg.preflight && cfg.preflight.resolution && !missing(cfg.preflight.resolution.minimum)) ? cfg.preflight.resolution.minimum : 300;
    }
    if (missing(cfg.export.cropMarks)) cfg.export.cropMarks = false;
    if (missing(cfg.export.bleedMarks)) cfg.export.bleedMarks = false;
    if (missing(cfg.export.regMarks)) cfg.export.regMarks = false;
    if (missing(cfg.export.haltOnPreflightError)) cfg.export.haltOnPreflightError = false;

    return cfg;
};

/**
 * Load and merge a user-provided configuration.
 * Validates the result and stores it as the active configuration.
 *
 * @param {Object|string} userConfig — Configuration object, or path to JSON file, or "dialog" to prompt
 * @returns {boolean} True if configuration was loaded and validated successfully
 */
WAW.Config.load = function(userConfig) {
    "use strict";
    WAW.Log.info("Loading configuration...", "", "SYSTEM");

    var config = {};
    var source = "";

    // Step 1: Acquire raw user config
    if (typeof userConfig === "undefined" || userConfig === null) {
        // No user config — use all defaults
        source = "defaults";
    } else if (typeof userConfig === "string") {
        if (userConfig === "dialog") {
            // Prompt user to select a JSON file
            var selectedFile = File.openDialog("Select WAW Configuration JSON File", "*.json");
            if (selectedFile) {
                var fileContents = WAW.Utils.readTextFile(selectedFile.fsName);
                if (fileContents) {
                    config = WAW.Utils.parseJSON(fileContents);
                    if (!config) {
                        WAW.Log.error("Failed to parse selected JSON config file", null, "SYSTEM");
                        return false;
                    }
                    source = "json_file: " + selectedFile.fsName;
                } else {
                    WAW.Log.error("Could not read selected config file", null, "SYSTEM");
                    return false;
                }
            } else {
                WAW.Log.info("No config file selected — using defaults", "", "SYSTEM");
                source = "defaults (dialog cancelled)";
            }
        } else {
            // Treat string as file path
            var contents = WAW.Utils.readTextFile(userConfig);
            if (contents) {
                config = WAW.Utils.parseJSON(contents);
                if (!config) {
                    WAW.Log.error("Failed to parse JSON config from path: " + userConfig, null, "SYSTEM");
                    return false;
                }
                source = "json_file: " + userConfig;
            } else {
                WAW.Log.error("Could not read config file: " + userConfig, null, "SYSTEM");
                return false;
            }
        }
    } else if (typeof userConfig === "object") {
        config = userConfig;
        source = "object";
    }

    // Step 2: Deep-merge with defaults
    var merged = {};
    WAW.Utils.extend(merged, WAW.Config.defaults);
    WAW.Utils.extend(merged, config);

    // Step 3: Normalize legacy aliases, then validate
    if (WAW.Config.applyLegacyAliases) {
        WAW.Config.applyLegacyAliases(merged);
    }
    var validation = WAW.Config.validate(merged);
    if (!validation.valid) {
        WAW.Log.error("Configuration validation failed:", null, "SYSTEM");
        var i;
        for (i = 0; i < validation.errors.length; i++) {
            WAW.Log.error("  - " + validation.errors[i], null, "SYSTEM");
        }
        return false;
    }

    // Step 4: Store and announce
    WAW.Config._active = merged;
    WAW.Config._loaded = true;
    WAW.config = merged;

    WAW.Log.info("Configuration loaded successfully from: " + source, "", "SYSTEM");
    WAW.Log.info("Validation warnings: " + validation.warnings.length, "", "SYSTEM");
    for (i = 0; i < validation.warnings.length; i++) {
        WAW.Log.warn("  - " + validation.warnings[i], "", "SYSTEM");
    }

    return true;
};

/**
 * Validate a configuration object against expected types and ranges.
 *
 * @param {Object} config — Configuration object to validate
 * @returns {Object} Validation result: { valid: boolean, errors: [], warnings: [] }
 */
WAW.Config.validate = function(config) {
    "use strict";
    var result = {
        valid: true,
        errors: [],
        warnings: []
    };

    if (!config || typeof config !== "object") {
        result.valid = false;
        result.errors.push("Config is not a valid object");
        return result;
    }

    var key;

    // --- Measurement validations ---
    var measurementFields = [
        "pageWidth", "pageHeight",
        "marginTop", "marginBottom", "marginInside", "marginOutside",
        "bleedTop", "bleedBottom", "bleedInside", "bleedOutside",
        "columnGutter", "bodyFontSize", "bodyLeading",
        "paragraphSpacing", "firstLineIndent",
        "heading1FontSize", "heading1Leading",
        "heading1SpaceBefore", "heading1SpaceAfter",
        "heading2FontSize", "heading2Leading",
        "heading2SpaceBefore", "heading2SpaceAfter",
        "heading3FontSize", "heading3Leading"
    ];

    for (var i = 0; i < measurementFields.length; i++) {
        key = measurementFields[i];
        if (config.hasOwnProperty(key) && config[key]) {
            var pts = WAW.Utils.toPoints(config[key]);
            if (pts <= 0 && key.indexOf("bleed") === -1) {
                result.warnings.push(key + " converts to " + pts + " pt — may be invalid: " + config[key]);
            }
        }
    }

    // --- Page dimensions must be positive ---
    if (config.pageWidth) {
        var w = WAW.Utils.toPoints(config.pageWidth);
        if (w <= 0) {
            result.errors.push("pageWidth must be positive: " + config.pageWidth);
        }
    }
    if (config.pageHeight) {
        var h = WAW.Utils.toPoints(config.pageHeight);
        if (h <= 0) {
            result.errors.push("pageHeight must be positive: " + config.pageHeight);
        }
    }

    // --- Margins must not exceed page dimensions ---
    if (config.pageWidth && config.marginInside && config.marginOutside) {
        var pw = WAW.Utils.toPoints(config.pageWidth);
        var mi = WAW.Utils.toPoints(config.marginInside);
        var mo = WAW.Utils.toPoints(config.marginOutside);
        if (mi + mo >= pw) {
            result.errors.push("marginInside + marginOutside (" + (mi + mo) + " pt) exceeds pageWidth (" + pw + " pt)");
        }
    }
    if (config.pageHeight && config.marginTop && config.marginBottom) {
        var ph = WAW.Utils.toPoints(config.pageHeight);
        var mt = WAW.Utils.toPoints(config.marginTop);
        var mb = WAW.Utils.toPoints(config.marginBottom);
        if (mt + mb >= ph) {
            result.errors.push("marginTop + marginBottom (" + (mt + mb) + " pt) exceeds pageHeight (" + ph + " pt)");
        }
    }

    // --- Font validation ---
    var fontFields = [
        { key: "bodyFontFamily", style: "bodyFontStyle" },
        { key: "heading1FontFamily", style: "heading1FontStyle" },
        { key: "heading2FontFamily", style: "heading2FontStyle" },
        { key: "heading3FontFamily", style: "heading3FontStyle" }
    ];

    for (i = 0; i < fontFields.length; i++) {
        var ff = fontFields[i];
        if (config[ff.key]) {
            var resolvedFont = WAW.Utils.safeFont(config[ff.key], config[ff.style] || "Regular");
            if (!resolvedFont) {
                result.warnings.push("Font may not be available: " + config[ff.key] + " " + (config[ff.style] || "Regular"));
            }
        }
    }

    // --- Drop caps validation ---
    if (config.dropCap && config.dropCap.enabled) {
        if (typeof config.dropCap.lines !== "number" || config.dropCap.lines < 1 || config.dropCap.lines > 10) {
            result.warnings.push("dropCap.lines should be between 1 and 10, got: " + config.dropCap.lines);
        }
        if (typeof config.dropCap.characters !== "number" || config.dropCap.characters < 1) {
            result.warnings.push("dropCap.characters should be at least 1, got: " + config.dropCap.characters);
        }
    }

    // --- Preflight validation ---
    if (config.preflight && config.preflight.enabled) {
        if (config.preflight.resolution) {
            var minRes = config.preflight.resolution.minimum;
            if (typeof minRes !== "number" || minRes < 72) {
                result.warnings.push("preflight.resolution.minimum seems low: " + minRes);
            }
        }
    }

    // --- Export formats validation ---
    if (config.export && config.export.formats) {
        var validFormats = ["pdf", "idml", "package", "epub", "jpeg", "png"];
        for (i = 0; i < config.export.formats.length; i++) {
            var fmt = config.export.formats[i];
            var found = false;
            for (var j = 0; j < validFormats.length; j++) {
                if (validFormats[j] === fmt) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                result.warnings.push("Unknown export format: " + fmt);
            }
        }
    }

    // --- Section numbering validation ---
    if (config.sectionNumbering) {
        var validStyles = ["roman", "arabic", "romanLower", "romanUpper", "none"];
        var sections = ["frontMatter", "body", "backMatter"];
        for (i = 0; i < sections.length; i++) {
            var sec = config.sectionNumbering[sections[i]];
            if (sec && sec.style) {
                var styleValid = false;
                for (j = 0; j < validStyles.length; j++) {
                    if (validStyles[j] === sec.style) {
                        styleValid = true;
                        break;
                    }
                }
                if (!styleValid) {
                    result.warnings.push("Unknown section numbering style: " + sec.style);
                }
            }
        }
    }

    // Update validity
    if (result.errors.length > 0) {
        result.valid = false;
    }

    return result;
};

/**
 * Get the active configuration. Loads defaults if not already loaded.
 *
 * @returns {Object} The active configuration object
 */
WAW.Config.get = function() {
    if (!WAW.Config._loaded || !WAW.Config._active) {
        WAW.Config.load({});
    }
    return WAW.Config._active;
};

/**
 * Check if configuration has been loaded.
 *
 * @returns {boolean}
 */
WAW.Config.isLoaded = function() {
    return WAW.Config._loaded;
};

/**
 * Get a single config value by dot-path (e.g., "dropCap.enabled").
 *
 * @param {string} path     — Dot-separated path to the config value
 * @param {*} [fallback]    — Default if path doesn't resolve
 * @returns {*} The config value, or fallback
 */
WAW.Config.getValue = function(path, fallback) {
    "use strict";
    if (typeof fallback === "undefined") fallback = null;
    var cfg = WAW.Config.get();
    if (!cfg || typeof path !== "string") return fallback;

    var parts = path.split(".");
    var current = cfg;
    var i;
    for (i = 0; i < parts.length; i++) {
        if (current === null || typeof current !== "object" || !current.hasOwnProperty(parts[i])) {
            return fallback;
        }
        current = current[parts[i]];
    }
    return current;
};

/**
 * Reset configuration to factory defaults.
 */
WAW.Config.reset = function() {
    WAW.Config._active = null;
    WAW.Config._loaded = false;
    WAW.config = null;
    WAW.Log.info("Configuration reset to defaults", "", "SYSTEM");
};


// ============================================================================
// PROGRESS UI SYSTEM — WAW.UI
// ============================================================================

/**
 * Non-modal progress dialog for InDesign automation scripts.
 * Provides visual feedback during long-running operations.
 *
 * Uses InDesign's native Window palette type for ExtendScript UI.
 * Gracefully handles headless/Server environments where UI is unavailable.
 *
 * @namespace WAW.UI
 */
WAW.UI = {};

/** @type {Window|null} Reference to the progress palette window */
WAW.UI._progressWindow = null;

/** @type {ProgressBar|null} The progress bar control */
WAW.UI._progressBar = null;

/** @type {StaticText|null} Status text label */
WAW.UI._statusText = null;

/** @type {StaticText|null} Step detail label */
WAW.UI._detailText = null;

/** @type {number} Total number of steps */
WAW.UI._totalSteps = 0;

/** @type {number} Current step index */
WAW.UI._currentStep = 0;

/** @type {string} Current operation title */
WAW.UI._title = "";

/** @type {boolean} Whether UI was successfully created */
WAW.UI._available = false;

/**
 * Create and display a non-modal progress dialog.
 *
 * @param {string} title — Window title text
 * @param {number} steps — Total number of steps to completion
 * @returns {boolean} True if UI was created successfully
 */
WAW.UI.show = function(title, steps) {
    "use strict";
    WAW.UI.close();

    if (typeof title !== "string") title = "WAW Automation";
    if (typeof steps !== "number" || steps < 1) steps = 1;

    WAW.UI._title = title;
    WAW.UI._totalSteps = steps;
    WAW.UI._currentStep = 0;
    WAW.UI._available = false;

    try {
        // Check if we're in a UI-capable environment
        if (app.scriptPreferences.version > 0 && !app.documents) {
            // Headless/server mode — skip UI
            WAW.Log.debug("UI unavailable (headless/server mode)", "", "UI");
            return false;
        }

        // Create palette window (non-modal, stays on top)
        var win = new Window("palette", "WAW v" + WAW.version + " — " + title, undefined, {
            closeButton: false,
            maximizeButton: false,
            minimizeButton: true
        });

        if (!win) {
            WAW.Log.debug("Failed to create palette window", "", "UI");
            return false;
        }

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = [14, 14, 14, 14];

        // Attempt to set a reasonable default size
        try {
            win.preferredSize = [420, 160];
        } catch (eSize) {
            // Some InDesign versions don't support preferredSize on palette
        }

        // --- Title row ---
        var titleGroup = win.add("group");
        titleGroup.orientation = "row";
        titleGroup.alignChildren = ["left", "center"];
        var titleText = titleGroup.add("statictext", undefined, title);
        try {
            titleText.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);
        } catch (eFont) {
            // Font setting may fail on some versions; text still appears
        }
        titleText.alignment = ["fill", "center"];

        // --- Separator ---
        try {
            win.add("panel", undefined, undefined, { borderStyle: "sunken" });
        } catch (ePanel) {
            // Panel separator may not be available
        }

        // --- Status text ---
        var statusText = win.add("statictext", undefined, "Initializing...");
        statusText.alignment = ["fill", "center"];
        try {
            statusText.graphics.font = ScriptUI.newFont("dialog", "REGULAR", 11);
        } catch (eFont2) {
            // Font setting may fail
        }
        WAW.UI._statusText = statusText;

        // --- Progress bar ---
        var progressBar = win.add("progressbar", undefined, 0, steps);
        progressBar.alignment = ["fill", "center"];
        progressBar.preferredSize = [380, 18];
        WAW.UI._progressBar = progressBar;

        // --- Detail text (step description) ---
        var detailText = win.add("statictext", undefined, " ");
        detailText.alignment = ["fill", "center"];
        try {
            detailText.graphics.font = ScriptUI.newFont("dialog", "ITALIC", 10);
            detailText.graphics.foregroundColor = detailText.graphics.newPen(detailText.graphics.PenType.SOLID_COLOR, [0.4, 0.4, 0.4], 1);
        } catch (eDetail) {
            // Color/font settings may fail
        }
        WAW.UI._detailText = detailText;

        // --- Step counter ---
        var stepText = win.add("statictext", undefined, "Step 0 of " + steps);
        stepText.alignment = ["right", "center"];
        try {
            stepText.graphics.font = ScriptUI.newFont("dialog", "REGULAR", 9);
        } catch (eFont3) {
            // Font setting may fail
        }
        WAW.UI._stepText = stepText;

        // Show the window
        win.show();

        // Store references
        WAW.UI._progressWindow = win;
        WAW.UI._available = true;

        WAW.Log.debug("Progress UI shown: " + title + " (" + steps + " steps)", "", "UI");
        return true;

    } catch (e) {
        WAW.Log.warn("Could not create progress UI: " + e.toString(), "Running in headless mode", "UI");
        WAW.UI._available = false;
        WAW.UI._progressWindow = null;
        return false;
    }
};

/**
 * Update the progress bar and status text.
 *
 * @param {number} [step]      — Current step number (1-based). If omitted, increments.
 * @param {string} [message]   — Status message to display
 * @param {string} [detail]    — Additional detail text
 */
WAW.UI.update = function(step, message, detail) {
    "use strict";

    // Update internal step counter
    if (typeof step === "number") {
        WAW.UI._currentStep = step;
    } else {
        WAW.UI._currentStep++;
    }

    // Clamp to total
    if (WAW.UI._currentStep > WAW.UI._totalSteps) {
        WAW.UI._currentStep = WAW.UI._totalSteps;
    }
    if (WAW.UI._currentStep < 0) {
        WAW.UI._currentStep = 0;
    }

    // Build status text
    var statusMsg = message || "Step " + WAW.UI._currentStep + " of " + WAW.UI._totalSteps;
    var detailMsg = detail || "";

    // Log to console as well
    WAW.Log.info("[" + WAW.UI._currentStep + "/" + WAW.UI._totalSteps + "] " + statusMsg, detailMsg, "UI");

    // Update UI if available
    if (!WAW.UI._available || !WAW.UI._progressWindow) {
        return;
    }

    try {
        if (WAW.UI._progressBar) {
            WAW.UI._progressBar.value = WAW.UI._currentStep;
        }

        if (WAW.UI._statusText && message) {
            WAW.UI._statusText.text = statusMsg;
        }

        if (WAW.UI._detailText && detail) {
            WAW.UI._detailText.text = detailMsg;
        }

        if (WAW.UI._stepText) {
            WAW.UI._stepText.text = "Step " + WAW.UI._currentStep + " of " + WAW.UI._totalSteps;
        }

        // Force UI refresh
        try {
            WAW.UI._progressWindow.update();
        } catch (eUpdate) {
            // update() may not be available on all Window types
        }
    } catch (e) {
        // UI update failures are non-critical
        WAW.Log.debug("UI update error: " + e.toString(), "", "UI");
    }
};

/**
 * Close the progress dialog and clean up references.
 */
WAW.UI.close = function() {
    "use strict";
    try {
        if (WAW.UI._progressWindow) {
            try {
                WAW.UI._progressWindow.close();
            } catch (eClose) {
                // Window may already be closed
            }
            WAW.UI._progressWindow = null;
        }
    } catch (e) {
        // Non-critical
    }

    WAW.UI._progressBar = null;
    WAW.UI._statusText = null;
    WAW.UI._detailText = null;
    WAW.UI._stepText = null;
    WAW.UI._available = false;
    WAW.UI._currentStep = 0;
    WAW.UI._totalSteps = 0;
    WAW.UI._title = "";

    WAW.Log.debug("Progress UI closed", "", "UI");
};

/**
 * Show an alert dialog to the user.
 * Safe wrapper around alert() that works in all InDesign contexts.
 *
 * @param {string} title   — Alert title
 * @param {string} message — Alert message body
 * @param {boolean} [isError] — If true, shows an error-style alert
 */
WAW.UI.alert = function(title, message, isError) {
    "use strict";
    if (typeof title !== "string") title = "WAW";
    if (typeof message !== "string") message = String(message);

    WAW.Log.info("ALERT [" + title + "]: " + message, "", "UI");

    try {
        if (isError) {
            alert(message, title, true);
        } else {
            alert(message, title);
        }
    } catch (e) {
        // If alert() fails, just log it
        $.writeln("[ALERT] " + title + ": " + message);
    }
};

/**
 * Show a confirmation dialog and return user's choice.
 *
 * @param {string} title   — Dialog title
 * @param {string} message — Question text
 * @param {boolean} [defaultYes] — Default to Yes (default: true)
 * @returns {boolean} True if user clicked Yes
 */
WAW.UI.confirm = function(title, message, defaultYes) {
    "use strict";
    if (typeof title !== "string") title = "WAW";
    if (typeof message !== "string") message = String(message);
    if (typeof defaultYes !== "boolean") defaultYes = true;

    try {
        var result = confirm(message, defaultYes, title);
        return result === true;
    } catch (e) {
        WAW.Log.warn("confirm() dialog failed, returning default: " + defaultYes, e.toString(), "UI");
        return defaultYes;
    }
};

/**
 * Show a file/folder selection dialog for configuration or asset loading.
 *
 * @param {string} [prompt]    — Dialog prompt text
 * @param {string} [filter]    — File filter (e.g., "*.json")
 * @param {boolean} [folder]   — If true, selects a folder instead of a file
 * @returns {string|null} Selected file/folder path, or null if cancelled
 */
WAW.UI.selectFile = function(prompt, filter, folder) {
    "use strict";
    if (typeof prompt !== "string") prompt = "Select file";
    if (typeof filter !== "string") filter = "*";

    try {
        if (folder) {
            var f = Folder.selectDialog(prompt);
            return f ? f.fsName : null;
        } else {
            var fl = File.openDialog(prompt, filter);
            return fl ? fl.fsName : null;
        }
    } catch (e) {
        WAW.Log.error("selectFile() exception", e, "UI");
        return null;
    }
};


// ============================================================================
// TRANSACTION / ROLLBACK SYSTEM — WAW.Transaction
// ============================================================================

/**
 * Lightweight transaction system for InDesign automation.
 *
 * Uses InDesign's built-in undo system to provide rollback capability.
 * Each transaction captures the undo history state; rollback undoes
 * all actions performed since the transaction began.
 *
 * IMPORTANT: InDesign's undo system operates at the application level,
 * so transactions are global across all open documents. Use with care
 * when multiple documents are open.
 *
 * @namespace WAW.Transaction
 */
WAW.Transaction = {};

/** @type {boolean} Whether a transaction is currently active */
WAW.Transaction._active = false;

/** @type {string} Name of the active transaction */
WAW.Transaction._name = "";

/** @type {number} Snapshot of undo history position at transaction start */
WAW.Transaction._undoPosition = 0;

/** @type {number} Snapshot of undo history count at transaction start */
WAW.Transaction._undoCount = 0;

/** @type {Date|null} Timestamp when transaction began */
WAW.Transaction._startTime = null;

/** @type {Array} Stack of nested transactions (for future nesting support) */
WAW.Transaction._stack = [];

/**
 * Begin a named transaction.
 * Captures the current undo state so that rollback can revert to this point.
 *
 * @param {string} name — Human-readable transaction name (used in undo menu)
 * @returns {boolean} True if transaction was started
 */
WAW.Transaction.begin = function(name) {
    "use strict";
    if (WAW.Transaction._active) {
        // Already in a transaction — push current to stack and start new
        WAW.Transaction._stack.push({
            name: WAW.Transaction._name,
            undoPosition: WAW.Transaction._undoPosition,
            undoCount: WAW.Transaction._undoCount,
            startTime: WAW.Transaction._startTime
        });
        WAW.Log.debug("Nested transaction begin (previous: " + WAW.Transaction._name + ")", "", "TX");
    }

    if (typeof name !== "string" || name.length === 0) {
        name = "WAW Transaction";
    }

    try {
        // Capture undo state
        WAW.Transaction._undoPosition = app.undoHistory.length;
        WAW.Transaction._undoCount = app.undoHistory.length;
        WAW.Transaction._name = name;
        WAW.Transaction._startTime = new Date();
        WAW.Transaction._active = true;

        WAW.Log.info("Transaction BEGIN: " + name, "Undo position: " + WAW.Transaction._undoPosition, "TX");
        return true;
    } catch (e) {
        WAW.Log.error("Transaction.begin() failed — undo system may be unavailable", e, "TX");
        WAW.Transaction._active = false;
        return false;
    }
};

/**
 * Roll back all actions performed since the transaction began.
 * Uses InDesign's undoHistory to revert step-by-step to the captured position.
 *
 * @returns {boolean} True if rollback completed successfully
 */
WAW.Transaction.rollback = function() {
    "use strict";
    if (!WAW.Transaction._active) {
        WAW.Log.warn("Transaction.rollback() called but no transaction is active", "", "TX");
        return false;
    }

    var name = WAW.Transaction._name;
    var targetPosition = WAW.Transaction._undoPosition;
    var undosPerformed = 0;

    try {
        WAW.Log.warn("Transaction ROLLBACK: " + name, "Reverting to undo position " + targetPosition, "TX");

        // Undo until we reach the saved position
        var safetyCounter = 0;
        var maxUndos = 500; // Safety limit to prevent infinite loops

        while (app.undoHistory.length > targetPosition && safetyCounter < maxUndos) {
            try {
                app.undo();
                undosPerformed++;
                safetyCounter++;
            } catch (undoE) {
                WAW.Log.error("Undo failed during rollback (step " + undosPerformed + ")", undoE, "TX");
                break;
            }
        }

        if (safetyCounter >= maxUndos) {
            WAW.Log.error("Rollback hit safety limit of " + maxUndos + " undos. State may be inconsistent.", null, "TX");
        }

        var elapsed = WAW.Transaction._startTime ? (new Date().getTime() - WAW.Transaction._startTime.getTime()) : 0;
        WAW.Log.info("Transaction ROLLBACK COMPLETE: " + name, undosPerformed + " undo(s) performed in " + elapsed + "ms", "TX");

        // Restore previous transaction from stack if nested
        WAW.Transaction._restoreFromStack();

        return true;
    } catch (e) {
        WAW.Log.error("Transaction.rollback() exception for: " + name, e, "TX");
        WAW.Transaction._active = false;
        return false;
    }
};

/**
 * Commit (complete) the active transaction.
 * This simply marks the transaction as complete; no undo is performed.
 *
 * @param {boolean} [keepUndoHistory] — If false, compacts undo history after commit (default: true)
 * @returns {boolean} True if transaction was committed
 */
WAW.Transaction.commit = function(keepUndoHistory) {
    "use strict";
    if (!WAW.Transaction._active) {
        WAW.Log.warn("Transaction.commit() called but no transaction is active", "", "TX");
        return false;
    }

    var name = WAW.Transaction._name;
    var elapsed = WAW.Transaction._startTime ? (new Date().getTime() - WAW.Transaction._startTime.getTime()) : 0;

    try {
        WAW.Log.info("Transaction COMMIT: " + name, "Duration: " + elapsed + "ms", "TX");

        // Restore previous transaction from stack if nested
        WAW.Transaction._restoreFromStack();

        return true;
    } catch (e) {
        WAW.Log.error("Transaction.commit() exception for: " + name, e, "TX");
        WAW.Transaction._active = false;
        WAW.Transaction._stack = [];
        return false;
    }
};

/**
 * Check if a transaction is currently active.
 *
 * @returns {boolean}
 */
WAW.Transaction.isActive = function() {
    return WAW.Transaction._active;
};

/**
 * Get the name of the currently active transaction.
 *
 * @returns {string}
 */
WAW.Transaction.getName = function() {
    return WAW.Transaction._active ? WAW.Transaction._name : "";
};

/**
 * Restore transaction state from the nested stack.
 * @private
 */
WAW.Transaction._restoreFromStack = function() {
    if (WAW.Transaction._stack.length > 0) {
        var prev = WAW.Transaction._stack.pop();
        WAW.Transaction._name = prev.name;
        WAW.Transaction._undoPosition = prev.undoPosition;
        WAW.Transaction._undoCount = prev.undoCount;
        WAW.Transaction._startTime = prev.startTime;
        WAW.Transaction._active = true;
        WAW.Log.debug("Restored nested transaction: " + prev.name, "", "TX");
    } else {
        WAW.Transaction._active = false;
        WAW.Transaction._name = "";
        WAW.Transaction._undoPosition = 0;
        WAW.Transaction._undoCount = 0;
        WAW.Transaction._startTime = null;
    }
};

/**
 * Execute a function within a transaction. Auto-rollback on error.
 *
 * @param {string}   name     — Transaction name
 * @param {Function} fn       — Function to execute
 * @param {Object}   [context]— 'this' context for the function
 * @param {Array}    [args]   — Arguments array to pass to the function
 * @returns {Object} Result: { success: boolean, result: *, error: * }
 */
WAW.Transaction.run = function(name, fn, context, args) {
    "use strict";
    if (typeof context === "undefined") context = null;
    if (!(args instanceof Array)) args = [];

    WAW.Transaction.begin(name);

    try {
        var result = fn.apply(context, args);
        WAW.Transaction.commit();
        return { success: true, result: result, error: null };
    } catch (e) {
        WAW.Log.error("Transaction '" + name + "' failed — rolling back", e, "TX");
        WAW.Transaction.rollback();
        return { success: false, result: null, error: e };
    }
};

// ============================================================================
// SAFE EXECUTION WRAPPER — WAW.safe
// ============================================================================

/**
 * Safely execute a function with automatic error handling and logging.
 * Catches all exceptions, logs them, and returns a standardized result.
 *
 * @param {Function} fn        — Function to execute safely
 * @param {Object}   [context] — 'this' context (default: null)
 * @param {Array}    [args]    — Array of arguments to pass to fn
 * @param {string}   [label]   — Descriptive label for error messages
 * @returns {Object} Standard result: { success: boolean, result: *, error: * }
 *
 * @example
 * var r = WAW.safe(function(name) {
 *     return app.activeDocument.name;
 * }, null, [], "get document name");
 * if (r.success) { $.writeln(r.result); }
 */
WAW.safe = function(fn, context, args, label) {
    "use strict";
    if (typeof context === "undefined") context = null;
    if (!(args instanceof Array)) args = [];
    if (typeof label !== "string") label = "safe()";

    try {
        var startTime = new Date().getTime();
        var result = fn.apply(context, args);
        var elapsed = new Date().getTime() - startTime;

        WAW.Log.debug(label + " completed in " + elapsed + "ms", "", "SAFE");

        return {
            success: true,
            result: result,
            error: null,
            elapsed: elapsed
        };
    } catch (e) {
        WAW.Log.error(label + " failed", e, "SAFE");
        return {
            success: false,
            result: null,
            error: e,
            elapsed: 0
        };
    }
};

/**
 * Safely get a property from an object, returning fallback on any error.
 * Useful for accessing potentially undefined nested properties.
 *
 * @param {Object} obj       — Object to access
 * @param {string} propPath  — Dot-separated property path (e.g., "config.dropCap.enabled")
 * @param {*}      fallback  — Value to return if path is invalid
 * @returns {*} Property value, or fallback
 */
WAW.safeGetProp = function(obj, propPath, fallback) {
    "use strict";
    if (typeof fallback === "undefined") fallback = null;
    if (!obj || typeof obj !== "object") return fallback;
    if (typeof propPath !== "string") return fallback;

    try {
        var parts = propPath.split(".");
        var current = obj;
        var i;
        for (i = 0; i < parts.length; i++) {
            if (current === null || typeof current !== "object" || !current.hasOwnProperty(parts[i])) {
                return fallback;
            }
            current = current[parts[i]];
        }
        return current;
    } catch (e) {
        return fallback;
    }
};

/**
 * Safely call a method on an object if it exists.
 *
 * @param {Object}   obj      — Object that should have the method
 * @param {string}   method   — Method name
 * @param {Array}    [args]   — Arguments to pass
 * @param {*}        [fallback] — Return value if method doesn't exist
 * @returns {*} Method result, or fallback
 */
WAW.safeCall = function(obj, method, args, fallback) {
    "use strict";
    if (typeof fallback === "undefined") fallback = null;
    if (!(args instanceof Array)) args = [];

    try {
        if (obj && typeof obj[method] === "function") {
            return obj[method].apply(obj, args);
        }
    } catch (e) {
        WAW.Log.debug("safeCall() exception for method: " + method, e.toString(), "SAFE");
    }
    return fallback;
};

// ============================================================================
// MODULE INITIALIZATION & SELF-TEST
// ============================================================================

/**
 * Initialize the WAW Core module.
 * Validates all subsystems and runs a quick self-test.
 *
 * @returns {boolean} True if all systems initialized successfully
 */
WAW.init = function() {
    "use strict";
    var initStart = new Date().getTime();
    var allPassed = true;

    $.writeln("");
    $.writeln("================================================================================");
    $.writeln("  " + WAW.name + " v" + WAW.version);
    $.writeln("  Core Module Initialization");
    $.writeln("================================================================================");
    $.writeln("");

    // --- Self-test: Logging ---
    WAW.Log.info("=== Self-Test: Logging System ===", "", "SYSTEM");
    try {
        WAW.Log.debug("Debug message test", "detail line", "TEST");
        WAW.Log.info("Info message test", "detail line", "TEST");
        WAW.Log.warn("Warning message test", "detail line", "TEST");

        // Test error logging without throwing
        var testErr = new Error("Test error object");
        WAW.Log.error("Error message test", testErr, "TEST");

        var infoCount = WAW.Log.count(WAW.Log.INFO);
        WAW.Log.info("Self-test: Logging OK (" + infoCount + "+ INFO entries)", "", "SYSTEM");
    } catch (e) {
        $.writeln("[CRITICAL] Logging system self-test FAILED: " + e.toString());
        allPassed = false;
    }

    // --- Self-test: Utilities ---
    WAW.Log.info("=== Self-Test: Utility Library ===", "", "SYSTEM");
    try {
        // Test toPoints
        var pt1 = WAW.Utils.toPoints("6 in");
        if (Math.abs(pt1 - 432) > 0.001) {
            throw new Error("toPoints('6 in') expected 432, got " + pt1);
        }
        var pt2 = WAW.Utils.toPoints("25.4 mm");
        if (Math.abs(pt2 - 72) > 1) {
            throw new Error("toPoints('25.4 mm') expected ~72, got " + pt2);
        }
        var pt3 = WAW.Utils.toPoints("72 pt");
        if (pt3 !== 72) {
            throw new Error("toPoints('72 pt') expected 72, got " + pt3);
        }

        // Test padLeft
        if (WAW.Utils.padLeft("5", 3, "0") !== "005") {
            throw new Error("padLeft failed");
        }

        // Test trim
        if (WAW.Utils.trim("  hello  ") !== "hello") {
            throw new Error("trim failed");
        }

        // Test isNumeric
        if (!WAW.Utils.isNumeric("42")) throw new Error("isNumeric('42') should be true");
        if (!WAW.Utils.isNumeric(42)) throw new Error("isNumeric(42) should be true");
        if (WAW.Utils.isNumeric("abc")) throw new Error("isNumeric('abc') should be false");

        // Test safeFileName
        var sf = WAW.Utils.safeFileName("file<name>.txt");
        if (sf !== "file_name_.txt") throw new Error("safeFileName failed: " + sf);

        // Test extend
        var ext1 = { a: 1, nested: { x: 1 } };
        var ext2 = { b: 2, nested: { y: 2 } };
        var extR = WAW.Utils.extend(ext1, ext2);
        if (extR.a !== 1 || extR.b !== 2) throw new Error("extend failed for flat props");

        WAW.Log.info("Self-test: Utilities OK", "", "SYSTEM");
    } catch (e) {
        WAW.Log.error("Utility library self-test FAILED", e, "SYSTEM");
        allPassed = false;
    }

    // --- Self-test: Configuration ---
    WAW.Log.info("=== Self-Test: Configuration System ===", "", "SYSTEM");
    try {
        // Reset to ensure clean state
        WAW.Config.reset();

        // Load defaults
        var loaded = WAW.Config.load({});
        if (!loaded) throw new Error("Config.load({}) returned false");

        // Validate defaults are present
        if (!WAW.Config.getValue("dropCap.enabled")) {
            WAW.Log.warn("dropCap.enabled not found in config", "", "SYSTEM");
        }
        if (!WAW.Config.getValue("preflight.resolution.minimum")) {
            WAW.Log.warn("preflight.resolution.minimum not found", "", "SYSTEM");
        }
        var exportFormats = WAW.Config.getValue("export.formats");
        if (!exportFormats || !(exportFormats instanceof Array)) {
            throw new Error("export.formats not an array");
        }

        // Test getValue fallback
        var missing = WAW.Config.getValue("nonexistent.path.here", "FALLBACK");
        if (missing !== "FALLBACK") throw new Error("getValue fallback failed");

        WAW.Log.info("Self-test: Configuration OK", "", "SYSTEM");
    } catch (e) {
        WAW.Log.error("Configuration system self-test FAILED", e, "SYSTEM");
        allPassed = false;
    }

    // --- Self-test: Transaction ---
    WAW.Log.info("=== Self-Test: Transaction System ===", "", "SYSTEM");
    try {
        if (WAW.Transaction.isActive()) {
            WAW.Log.warn("Transaction was active at init time — forcing cleanup", "", "TX");
            WAW.Transaction._active = false;
        }

        var txResult = WAW.Transaction.run("Self-Test Transaction", function() {
            // This is a no-op test — just verify the mechanism works
            return "tx-ok";
        });

        if (!txResult.success) throw new Error("Transaction.run returned failure");
        if (txResult.result !== "tx-ok") throw new Error("Transaction.run returned wrong result");

        WAW.Log.info("Self-test: Transaction OK", "", "SYSTEM");
    } catch (e) {
        WAW.Log.error("Transaction system self-test FAILED", e, "SYSTEM");
        // Transactions failing is not critical — mark but don't fail init
        WAW.Log.warn("Transaction system may not be fully functional", "", "SYSTEM");
    }

    // --- Self-test: Safe execution ---
    WAW.Log.info("=== Self-Test: Safe Execution ===", "", "SYSTEM");
    try {
        var safeOk = WAW.safe(function() {
            return 42;
        }, null, [], "safe-success-test");
        if (!safeOk.success || safeOk.result !== 42) {
            throw new Error("safe() success path failed");
        }

        var safeErr = WAW.safe(function() {
            throw new Error("Intentional test error");
        }, null, [], "safe-error-test");
        if (safeErr.success) {
            throw new Error("safe() should have returned failure");
        }
        if (!safeErr.error) {
            throw new Error("safe() should have captured error");
        }

        // Test safeGetProp
        var testObj = { a: { b: { c: "deep" } } };
        var sgp = WAW.safeGetProp(testObj, "a.b.c");
        if (sgp !== "deep") throw new Error("safeGetProp failed: " + sgp);
        var sgpF = WAW.safeGetProp(testObj, "a.b.z", "fallback");
        if (sgpF !== "fallback") throw new Error("safeGetProp fallback failed");

        WAW.Log.info("Self-test: Safe Execution OK", "", "SYSTEM");
    } catch (e) {
        WAW.Log.error("Safe execution self-test FAILED", e, "SYSTEM");
        allPassed = false;
    }

    // --- Self-test: safeFont ---
    WAW.Log.info("=== Self-Test: Font Resolution ===", "", "SYSTEM");
    try {
        var testFont = WAW.Utils.safeFont("Minion Pro", "Regular");
        if (testFont) {
            WAW.Log.info("Font resolution OK: " + testFont.fontFamily + " " + testFont.fontStyleName, "", "STYLE");
        } else {
            WAW.Log.warn("Font resolution: Minion Pro Regular not found on this system", "", "STYLE");
        }
    } catch (e) {
        WAW.Log.error("Font resolution self-test exception", e, "STYLE");
    }

    // --- Finalization ---
    var elapsed = new Date().getTime() - initStart;
    $.writeln("");
    $.writeln("================================================================================");
    if (allPassed) {
        $.writeln("  WAW Core Module v" + WAW.version + " — INITIALIZED SUCCESSFULLY (" + elapsed + "ms)");
        WAW.Log.info("Core module initialized successfully in " + elapsed + "ms", "", "SYSTEM");
    } else {
        $.writeln("  WAW Core Module v" + WAW.version + " — INITIALIZED WITH WARNINGS (" + elapsed + "ms)");
        WAW.Log.warn("Core module initialized with warnings in " + elapsed + "ms", "", "SYSTEM");
    }
    $.writeln("================================================================================");
    $.writeln("");

    WAW.state.initialized = true;
    WAW.state.initTime = elapsed;
    WAW.state.initPassed = allPassed;

    return allPassed;
};

// ============================================================================
// MODULE LOAD COMPLETION
// ============================================================================

$.writeln("[WAW] Core Module script loaded. Call WAW.init() to initialize.");
$.writeln("[WAW] Usage: #include \"01_core.jsx\" then WAW.init();");


// ============================================================================
// MODULE 01: END
// ============================================================================


// ============================================================================
// MODULE 02: BEGIN
// ============================================================================

/**
 * WE ARE WOLF — InDesign Automation v7.0
 * Module: 02_setup.jsx
 * Document Setup & Styles Engine
 * 
 * Creates the InDesign document, master pages, swatches, paragraph styles,
 * character styles, object styles, sections, baseline grid, and running headers.
 * 
 * Dependencies: 00_config.jsx, 01_utils.jsx
 */

// ============================================================
// GUARD: Prevent double-load
// ============================================================
if (typeof WAW === "undefined" || !WAW) {
    WAW = {};
}
if (typeof WAW.Setup === "undefined" || !WAW.Setup) {
    WAW.Setup = {};
}

// ============================================================
// LOCAL SHORTCUTS (for performance and readability)
// ============================================================
var $c = WAW.config;
var $u = WAW.Utils;
var $L = WAW.Log;

// Standalone safety: Module 02 is loaded before main() calls WAW.init().
// Ensure defaults are available before computing top-level constants.
if (!$c && WAW.Config && WAW.Config.load) {
    WAW.Config.load({});
    $c = WAW.config;
}
if (WAW.Config && WAW.Config.applyLegacyAliases) {
    WAW.Config.applyLegacyAliases($c);
}
if (!$c) {
    throw new Error("WAW configuration could not be initialized before Module 02 loaded.");
}

// Keep numeric geometry in inches, matching the constants below.
try { app.scriptPreferences.measurementUnit = MeasurementUnits.INCHES; } catch (eUnits) {}

// ============================================================
// CONSTANTS
// ============================================================
var PAGE_WIDTH        = $u.toInches($c.pageWidth);
var PAGE_HEIGHT       = $u.toInches($c.pageHeight);
var MARGIN_TOP        = $u.toInches($c.marginTop);
var MARGIN_BOTTOM     = $u.toInches($c.marginBottom);
var MARGIN_INSIDE     = $u.toInches($c.marginInside);
var MARGIN_OUTSIDE    = $u.toInches($c.marginOutside);
var BLEED             = $u.toInches($c.bleed);
var BODY_SIZE         = $c.bodySize;
var BODY_LEADING      = $c.bodyLeading;
var BODY_FONT         = $c.bodyFont;
var CHAPTER_SIZE      = $c.chapterSize;
var PART_SIZE         = $c.partSize;
var CAPTION_SIZE      = $c.captionSize;
var GRID_START        = $u.toInches($c.gridStart);
var GRID_INCREMENT    = $c.gridIncrement;
var DROP_CAP_LINES    = $c.dropCapLines;
var DROP_CAP_CHARS    = $c.dropCapChars;
var FACING_PAGES      = $c.facingPages;

// Hairline rule weight
var RULE_WEIGHT       = 0.25;
var HEADER_FONT_SIZE  = 8;
var FOLIO_FONT_SIZE   = 9;
var HEADER_TRACKING   = 50;
var TITLE_FONT_SIZE   = 36;
var SUBTITLE_SIZE     = 14;
var AUTHOR_SIZE       = 14;
var AUTHOR_TRACKING   = 75;
var COPYRIGHT_SIZE    = 8;
var DEDICATION_SIZE   = 14;
var TOC_TITLE_SIZE    = 20;
var SECTION_BREAK_SIZE = 11;

// ============================================================
// MODULE: WAW.Setup
// ============================================================

/**
 * Creates a new InDesign document with page size, margins, bleed,
 * baseline grid, and view preferences from WAW.config.
 * @returns {Document} The newly created document.
 */
WAW.Setup.createDocument = function() {
    $L.info("Creating new InDesign document...");

    var doc = null;
    var wasUndoActive = false;

    try {
        // Suppress dialogs during document creation
        app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;

        // Create document with preferences
        var docPrefs = {
            pageWidth:        PAGE_WIDTH,
            pageHeight:       PAGE_HEIGHT,
            facingPages:      FACING_PAGES,
            bleedTop:         BLEED,
            bleedBottom:      BLEED,
            bleedInside:      BLEED,
            bleedOutside:     BLEED,
            documentIntent:   DocumentIntentOptions.PRINT_INTENT,
            pageOrientation:  PageOrientation.PORTRAIT,
            allowPageShuffle: FACING_PAGES ? AllowPageShuffle.BY_ALTERNATING_SPREADS : AllowPageShuffle.OFF
        };

        // Documents.add(showingWindow, documentPreset, withProperties).
        // The previous standalone build passed docPrefs as the documentPreset
        // argument, so page size/margins could be ignored or error out.
        doc = app.documents.add(
            true,                // showWindow
            undefined,           // documentPreset
            docPrefs             // withProperties
        );

        if (!doc) {
            throw new Error("Failed to create document — app.documents.add returned null.");
        }

        $L.info("Document created: " + doc.name);

        // ============================================================
        // MARGINS (all pages)
        // ============================================================
        $L.info("Setting page margins...");
        var pages = doc.pages;
        for (var i = 0; i < pages.length; i++) {
            var page = pages[i];
            var isRight = page.side === PageSideOptions.RIGHT_HAND;

            // For facing pages: inside/outside swap on left/right pages
            var inside  = MARGIN_INSIDE;
            var outside = MARGIN_OUTSIDE;

            if (FACING_PAGES) {
                // Left page (verso): inside = right, outside = left
                // Right page (recto): inside = left, outside = right
                page.marginPreferences.top    = MARGIN_TOP;
                page.marginPreferences.bottom = MARGIN_BOTTOM;
                page.marginPreferences.left   = isRight ? inside : outside;
                page.marginPreferences.right  = isRight ? outside : inside;
            } else {
                page.marginPreferences.top    = MARGIN_TOP;
                page.marginPreferences.bottom = MARGIN_BOTTOM;
                page.marginPreferences.left   = outside;
                page.marginPreferences.right  = outside;
            }
        }
        $L.info("Margins applied to " + pages.length + " page(s).");

        // ============================================================
        // VIEW PREFERENCES
        // ============================================================
        $L.info("Configuring view preferences...");
        doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
        doc.viewPreferences.verticalMeasurementUnits   = MeasurementUnits.INCHES;
        doc.viewPreferences.rulerOrigin                = RulerOrigin.SPREAD_ORIGIN;
        doc.viewPreferences.showFrameEdges             = true;
        doc.viewPreferences.showRulers                 = true;

        // ============================================================
        // GRID PREFERENCES (Document-level baseline grid)
        // ============================================================
        $L.info("Configuring baseline grid...");
        doc.gridPreferences.baselineGridShown       = true;
        doc.gridPreferences.baselineStart           = GRID_START;
        doc.gridPreferences.baselineDivision        = GRID_INCREMENT;
        doc.gridPreferences.baselineGridRelativeOption = BaselineGridRelativeOption.TOP_OF_MARGIN_OF_BASELINE_GRID;

        $L.info("Baseline grid: start=" + GRID_START + "in, increment=" + GRID_INCREMENT + "pt");

        // ============================================================
        // DOCUMENT PREFERENCES
        // ============================================================
        $L.info("Setting document preferences...");
        // Keep the document lean. Auto-flow/import routines add pages as needed;
        // setting pagesPerDocument to 9999 here would create thousands of pages.
        doc.documentPreferences.pagesPerDocument = 1;

        // Enable optimal word spacing for justified text where the host DOM supports it.
        try {
            doc.justificationWordSpacingMinimum = 80;
            doc.justificationWordSpacingDesired = 100;
            doc.justificationWordSpacingMaximum = 150;
            doc.justificationLetterSpacingMinimum = -3;
            doc.justificationLetterSpacingDesired = 0;
            doc.justificationLetterSpacingMaximum = 3;
        } catch (justifyPrefsErr) {
            $L.warn("Document-level justification preferences unavailable; style-level justification will still be applied.", justifyPrefsErr.message, "SETUP");
        }

        // ============================================================
        // ZERO POINT (reset to top-left of spread)
        // ============================================================
        doc.zeroPoint = [0, 0];

        $L.info("Document setup complete: " + doc.name);
        return doc;

    } catch (e) {
        $L.error("createDocument() failed: " + e.message);
        if (doc && doc.isValid) {
            try { doc.close(SaveOptions.NO); } catch (ignore) {}
        }
        throw e;
    } finally {
        app.scriptPreferences.userInteractionLevel = UserInteractionLevels.INTERACT_WITH_ALL;
    }
};


// ============================================================
// HELPER: Create a text frame on a master page
// ============================================================

/**
 * Creates a text frame on a master page at specified bounds.
 * @param {MasterPage} mpage - The master page.
 * @param {string} label - Script label for the frame.
 * @param {Array} bounds - [y1, x1, y2, x2] in inches.
 * @returns {TextFrame} The created text frame.
 */
WAW.Setup._makeMasterFrame = function(mpage, label, bounds) {
    var tf = mpage.textFrames.add({
        geometricBounds: bounds,
        label: label
    });
    return tf;
};

/**
 * Draws a horizontal rule (hairline stroke) on a master page.
 * @param {MasterPage} mpage - The master page.
 * @param {string} label - Script label for the line.
 * @param {number} yPos - Y position in inches.
 * @param {number} xStart - X start in inches.
 * @param {number} xEnd - X end in inches.
 * @param {number} weight - Stroke weight in points.
 * @param {Swatch} color - Stroke color swatch.
 */
WAW.Setup._makeRule = function(mpage, label, yPos, xStart, xEnd, weight, color) {
    var pageW = PAGE_WIDTH;
    var pageH = PAGE_HEIGHT;

    // Determine actual x coordinates based on page side
    var isRight = (mpage.side === PageSideOptions.RIGHT_HAND);
    var marginL, marginR;

    if (FACING_PAGES) {
        marginL = isRight ? MARGIN_INSIDE : MARGIN_OUTSIDE;
        marginR = isRight ? MARGIN_OUTSIDE : MARGIN_INSIDE;
    } else {
        marginL = MARGIN_OUTSIDE;
        marginR = MARGIN_OUTSIDE;
    }

    var ruleProps = {
        geometricBounds: [yPos, xStart || marginL, yPos, xEnd || (pageW - marginR)],
        strokeWeight: weight,
        strokeType: "Solid"
    };
    var ruleColor = color;
    if (!ruleColor) {
        try {
            ruleColor = mpage.parent.parent.colors.item("WAW_Rule_Grey");
        } catch (ruleColorErr) {
            ruleColor = null;
        }
    }
    if (ruleColor && ruleColor.isValid !== false) {
        ruleProps.strokeColor = ruleColor;
    }

    var line = mpage.graphicLines.add(
        undefined,
        undefined,
        undefined,
        ruleProps
    );
    line.label = label;
    return line;
};

/**
 * Creates all master spreads and configures their contents.
 * Creates four master spreads: A-Body, B-FrontBack, C-ChapterOpen, D-Blank.
 * @param {Document} doc - The InDesign document.
 */
WAW.Setup.createMasterPages = function(doc) {
    $L.info("Setting up master pages...");

    try {
        // ============================================================
        // MASTER SPREAD A — Body (running headers + folios + hairlines)
        // ============================================================
        $L.info("  Creating A-Body master spread...");

        var spreadA = null;
        try {
            spreadA = doc.masterSpreads.itemByName("A-Body");
            if (!spreadA || !spreadA.isValid) spreadA = null;
        } catch (getAErr) { spreadA = null; }
        if (!spreadA && doc.masterSpreads.length > 0) {
            spreadA = doc.masterSpreads[0];
            try { spreadA.baseName = "Body"; spreadA.namePrefix = "A"; } catch (renameAErr) {}
        }
        if (!spreadA) {
            spreadA = doc.masterSpreads.add(undefined, { baseName: "Body", namePrefix: "A" });
        }

        var mPageALeft  = spreadA.pages[0];  // verso (left)
        var mPageARight = spreadA.pages[1];  // recto (right)

        // Get page dimensions for frame positioning
        var pgW = PAGE_WIDTH;
        var pgH = PAGE_HEIGHT;
        var masterBodyFont = WAW.Utils.safeFont(BODY_FONT, "Regular") || app.fonts.item(BODY_FONT);

        // -- LEFT PAGE HEADER: Book title "WE ARE WOLF" --
        // Small caps, 8pt, left-aligned, tracking 50
        var hdrL = this._makeMasterFrame(mPageALeft, "WAW_Header_Left", [
            MARGIN_TOP - 0.25,           // y1: just above top margin
            MARGIN_OUTSIDE + 0.05,        // x1: slight inset from outside margin
            MARGIN_TOP - 0.08,            // y2
            pgW - MARGIN_INSIDE - 0.05    // x2
        ]);

        var hdrLpara = hdrL.paragraphs[0];
        hdrLpara.contents = "WE ARE WOLF";
        hdrLpara.appliedFont = masterBodyFont;
        hdrLpara.fontStyle = "Regular";
        hdrLpara.pointSize = HEADER_FONT_SIZE;
        hdrLpara.capitalization = Capitalization.SMALL_CAPS;
        hdrLpara.tracking = HEADER_TRACKING;
        hdrLpara.justification = Justification.LEFT_ALIGN;
        hdrLpara.paragraphDirection = ParagraphDirectionOptions.LEFT_TO_RIGHT_DIRECTION;

        // -- RIGHT PAGE HEADER: Dynamic chapter title (text variable placeholder) --
        var hdrR = this._makeMasterFrame(mPageARight, "WAW_Header_Right", [
            MARGIN_TOP - 0.25,
            MARGIN_INSIDE + 0.05,
            MARGIN_TOP - 0.08,
            pgW - MARGIN_OUTSIDE - 0.05
        ]);

        var hdrRpara = hdrR.paragraphs[0];
        hdrRpara.contents = "Chapter Title";  // Placeholder; will be overridden by text variable
        hdrRpara.appliedFont = masterBodyFont;
        hdrRpara.fontStyle = "Regular";
        hdrRpara.pointSize = HEADER_FONT_SIZE;
        hdrRpara.capitalization = Capitalization.SMALL_CAPS;
        hdrRpara.tracking = HEADER_TRACKING;
        hdrRpara.justification = Justification.RIGHT_ALIGN;
        hdrRpara.paragraphDirection = ParagraphDirectionOptions.LEFT_TO_RIGHT_DIRECTION;

        // -- HAIRLINE RULES under headers --
        var ruleGrey = doc.colors.item("WAW_Rule_Grey");
        if (!ruleGrey || !ruleGrey.isValid) {
            ruleGrey = doc.swatches.item("Black");
        }

        // Left page rule
        this._makeRule(
            mPageALeft,
            "WAW_Rule_Left",
            MARGIN_TOP - 0.06,
            MARGIN_OUTSIDE,
            pgW - MARGIN_INSIDE,
            RULE_WEIGHT,
            ruleGrey
        );

        // Right page rule
        this._makeRule(
            mPageARight,
            "WAW_Rule_Right",
            MARGIN_TOP - 0.06,
            MARGIN_INSIDE,
            pgW - MARGIN_OUTSIDE,
            RULE_WEIGHT,
            ruleGrey
        );

        // -- FOLIOS (page numbers) --
        // Left page: folio left-aligned at bottom
        var folioL = this._makeMasterFrame(mPageALeft, "WAW_Folio_Left", [
            pgH - MARGIN_BOTTOM + 0.12,
            MARGIN_OUTSIDE,
            pgH - MARGIN_BOTTOM + 0.35,
            pgW - MARGIN_INSIDE
        ]);

        var folioLpara = folioL.paragraphs[0];
        folioLpara.appliedFont = masterBodyFont;
        folioLpara.fontStyle = "Regular";
        folioLpara.pointSize = FOLIO_FONT_SIZE;
        folioLpara.justification = Justification.LEFT_ALIGN;

        // Insert auto page number special character
        folioLpara.contents = SpecialCharacters.AUTO_PAGE_NUMBER;

        // Right page: folio right-aligned at bottom
        var folioR = this._makeMasterFrame(mPageARight, "WAW_Folio_Right", [
            pgH - MARGIN_BOTTOM + 0.12,
            MARGIN_INSIDE,
            pgH - MARGIN_BOTTOM + 0.35,
            pgW - MARGIN_OUTSIDE
        ]);

        var folioRpara = folioR.paragraphs[0];
        folioRpara.appliedFont = masterBodyFont;
        folioRpara.fontStyle = "Regular";
        folioRpara.pointSize = FOLIO_FONT_SIZE;
        folioRpara.justification = Justification.RIGHT_ALIGN;

        // Insert auto page number special character
        folioRpara.contents = SpecialCharacters.AUTO_PAGE_NUMBER;

        // Apply folio character style if available
        try {
            var folioStyle = doc.characterStyles.item("WAW_Folio");
            if (folioStyle && folioStyle.isValid) {
                folioLpara.appliedCharacterStyle = folioStyle;
                folioRpara.appliedCharacterStyle = folioStyle;
            }
        } catch (folioStyleErr) {
            $L.warn("Folio character style not yet available: " + folioStyleErr.message);
        }

        $L.info("  A-Body master spread complete.");

        // ============================================================
        // MASTER SPREAD B — FrontBack (no headers, no folios)
        // ============================================================
        $L.info("  Creating B-FrontBack master spread...");

        var spreadB = null;
        try {
            spreadB = doc.masterSpreads.itemByName("B-FrontBack");
            if (!spreadB || !spreadB.isValid) spreadB = null;
        } catch (getBErr) { spreadB = null; }
        if (!spreadB) {
            spreadB = doc.masterSpreads.add(undefined, { baseName: "FrontBack", namePrefix: "B" });
        }

        // B-FrontBack has NO header frames and NO folio frames.
        // Pages are intentionally blank — used for title page, copyright, dedication.

        $L.info("  B-FrontBack master spread complete (blank).");

        // ============================================================
        // MASTER SPREAD C — ChapterOpen (folios only, no running heads)
        // ============================================================
        $L.info("  Creating C-ChapterOpen master spread...");

        var spreadC = null;
        try {
            spreadC = doc.masterSpreads.itemByName("C-ChapterOpen");
            if (!spreadC || !spreadC.isValid) spreadC = null;
        } catch (getCErr) { spreadC = null; }
        if (!spreadC) {
            spreadC = doc.masterSpreads.add(undefined, { baseName: "ChapterOpen", namePrefix: "C" });
        }

        var mPageCLeft  = spreadC.pages[0];  // verso
        var mPageCRight = spreadC.pages[1];  // recto

        // -- Left folio: auto page number, left-aligned --
        var cFolioL = this._makeMasterFrame(mPageCLeft, "WAW_CFolio_Left", [
            pgH - MARGIN_BOTTOM + 0.12,
            MARGIN_OUTSIDE,
            pgH - MARGIN_BOTTOM + 0.35,
            pgW - MARGIN_INSIDE
        ]);

        var cFolioLpara = cFolioL.paragraphs[0];
        cFolioLpara.appliedFont = masterBodyFont;
        cFolioLpara.fontStyle = "Regular";
        cFolioLpara.pointSize = FOLIO_FONT_SIZE;
        cFolioLpara.justification = Justification.LEFT_ALIGN;
        cFolioLpara.contents = SpecialCharacters.AUTO_PAGE_NUMBER;

        // -- Right folio: auto page number, right-aligned --
        var cFolioR = this._makeMasterFrame(mPageCRight, "WAW_CFolio_Right", [
            pgH - MARGIN_BOTTOM + 0.12,
            MARGIN_INSIDE,
            pgH - MARGIN_BOTTOM + 0.35,
            pgW - MARGIN_OUTSIDE
        ]);

        var cFolioRpara = cFolioR.paragraphs[0];
        cFolioRpara.appliedFont = masterBodyFont;
        cFolioRpara.fontStyle = "Regular";
        cFolioRpara.pointSize = FOLIO_FONT_SIZE;
        cFolioRpara.justification = Justification.RIGHT_ALIGN;
        cFolioRpara.contents = SpecialCharacters.AUTO_PAGE_NUMBER;

        $L.info("  C-ChapterOpen master spread complete.");

        // ============================================================
        // MASTER SPREAD D — Blank (completely blank)
        // ============================================================
        $L.info("  Creating D-Blank master spread...");

        var spreadD = null;
        try {
            spreadD = doc.masterSpreads.itemByName("D-Blank");
            if (!spreadD || !spreadD.isValid) spreadD = null;
        } catch (getDErr) { spreadD = null; }
        if (!spreadD) {
            spreadD = doc.masterSpreads.add(undefined, { baseName: "Blank", namePrefix: "D" });
        }

        // D-Blank is entirely blank — no headers, no folios, no rules.
        // Used for intentionally blank pages (verso blank after chapter end).

        $L.info("  D-Blank master spread complete (blank).");

        // ============================================================
        // SET MARGINS ON ALL MASTER PAGES
        // ============================================================
        $L.info("  Ensuring master page margins are correct...");
        var allMasterSpreads = doc.masterSpreads;
        for (var s = 0; s < allMasterSpreads.length; s++) {
            var ms = allMasterSpreads[s];
            var mpages = ms.pages;
            for (var p = 0; p < mpages.length; p++) {
                var mp = mpages[p];
                var isRightPage = (mp.side === PageSideOptions.RIGHT_HAND);

                if (FACING_PAGES) {
                    mp.marginPreferences.top    = MARGIN_TOP;
                    mp.marginPreferences.bottom = MARGIN_BOTTOM;
                    mp.marginPreferences.left   = isRightPage ? MARGIN_INSIDE : MARGIN_OUTSIDE;
                    mp.marginPreferences.right  = isRightPage ? MARGIN_OUTSIDE : MARGIN_INSIDE;
                } else {
                    mp.marginPreferences.top    = MARGIN_TOP;
                    mp.marginPreferences.bottom = MARGIN_BOTTOM;
                    mp.marginPreferences.left   = MARGIN_OUTSIDE;
                    mp.marginPreferences.right  = MARGIN_OUTSIDE;
                }
            }
        }

        $L.info("Master pages setup complete. Total spreads: " + allMasterSpreads.length);

    } catch (e) {
        $L.error("createMasterPages() failed: " + e.message);
        throw e;
    }
};


/**
 * Creates a professional color palette as document swatches.
 * Ensures all required swatches exist and registers custom CMYK colors.
 * @param {Document} doc - The InDesign document.
 */
WAW.Setup.createSwatches = function(doc) {
    $L.info("Setting up color swatches...");

    try {
        // ============================================================
        // VERIFY DEFAULT SWATCHES
        // ============================================================
        var blackSwatch = doc.colors.item("Black");
        if (!blackSwatch || !blackSwatch.isValid) {
            blackSwatch = doc.colors.add({
                name: "Black",
                model: ColorModel.PROCESS,
                colorValue: [0, 0, 0, 100],
                space: ColorSpace.CMYK
            });
            $L.info("  Created Black swatch.");
        } else {
            $L.info("  Black swatch verified.");
        }

        var noneSwatch = doc.swatches.item("None");
        if (!noneSwatch || !noneSwatch.isValid) {
            $L.warn("  'None' swatch not found — this is unusual for a new document.");
        } else {
            $L.info("  None swatch verified.");
        }

        var regSwatch = doc.colors.item("Registration");
        if (!regSwatch || !regSwatch.isValid) {
            $L.warn("  'Registration' swatch not found — may need manual check.");
        } else {
            $L.info("  Registration swatch verified.");
        }

        // ============================================================
        // CREATE CUSTOM WAW SWATCHES
        // ============================================================

        // --- WAW_Black: Process Black (0,0,0,100) ---
        var wawBlack = doc.colors.item("WAW_Black");
        if (!wawBlack || !wawBlack.isValid) {
            wawBlack = doc.colors.add({
                name: "WAW_Black",
                model: ColorModel.PROCESS,
                colorValue: [0, 0, 0, 100],
                space: ColorSpace.CMYK
            });
            $L.info("  Created WAW_Black swatch (0,0,0,100 CMYK).");
        } else {
            $L.info("  WAW_Black swatch already exists.");
        }

        // --- WAW_Registration: 100% all plates ---
        var wawReg = doc.colors.item("WAW_Registration");
        if (!wawReg || !wawReg.isValid) {
            wawReg = doc.colors.add({
                name: "WAW_Registration",
                model: ColorModel.REGISTRATION,
                colorValue: [100, 100, 100, 100],
                space: ColorSpace.REGISTRATION
            });
            $L.info("  Created WAW_Registration swatch (100,100,100,100).");
        } else {
            $L.info("  WAW_Registration swatch already exists.");
        }

        // --- WAW_Text_Grey: 85% Black for subtle elements ---
        var wawTextGrey = doc.colors.item("WAW_Text_Grey");
        if (!wawTextGrey || !wawTextGrey.isValid) {
            wawTextGrey = doc.colors.add({
                name: "WAW_Text_Grey",
                model: ColorModel.PROCESS,
                colorValue: [0, 0, 0, 85],
                space: ColorSpace.CMYK
            });
            $L.info("  Created WAW_Text_Grey swatch (0,0,0,85 CMYK).");
        } else {
            $L.info("  WAW_Text_Grey swatch already exists.");
        }

        // --- WAW_Rule_Grey: 30% Black for hairlines ---
        var wawRuleGrey = doc.colors.item("WAW_Rule_Grey");
        if (!wawRuleGrey || !wawRuleGrey.isValid) {
            wawRuleGrey = doc.colors.add({
                name: "WAW_Rule_Grey",
                model: ColorModel.PROCESS,
                colorValue: [0, 0, 0, 30],
                space: ColorSpace.CMYK
            });
            $L.info("  Created WAW_Rule_Grey swatch (0,0,0,30 CMYK).");
        } else {
            $L.info("  WAW_Rule_Grey swatch already exists.");
        }

        // ============================================================
        // CREATE TINT SWATCHES
        // ============================================================

        // --- WAW_Black_50: 50% tint of WAW_Black ---
        try {
            var wawBlack50 = doc.tints.item("WAW_Black_50");
            if (!wawBlack50 || !wawBlack50.isValid) {
                wawBlack50 = doc.tints.add({
                    name: "WAW_Black_50",
                    tintValue: 50,
                    tintSource: wawBlack
                });
                $L.info("  Created WAW_Black_50 tint (50% of WAW_Black).");
            } else {
                $L.info("  WAW_Black_50 tint already exists.");
            }
        } catch (tintCreateErr) {
            $L.warn("  Could not create WAW_Black_50 tint; continuing with base swatches.", tintCreateErr.message, "SWATCH");
        }

        // ============================================================
        // CREATE WAW PAPER (white swatch reference)
        // ============================================================
        var wawPaper = doc.colors.item("WAW_Paper");
        if (!wawPaper || !wawPaper.isValid) {
            wawPaper = doc.colors.add({
                name: "WAW_Paper",
                model: ColorModel.PROCESS,
                colorValue: [0, 0, 0, 0],
                space: ColorSpace.CMYK
            });
            $L.info("  Created WAW_Paper swatch (0,0,0,0 CMYK).");
        }

        $L.info("Color swatch setup complete.");

    } catch (e) {
        $L.error("createSwatches() failed: " + e.message);
        throw e;
    }
};


/**
 * Creates all paragraph and character styles for the document.
 * Uses WAW.config values for font, size, leading, and spacing.
 * @param {Document} doc - The InDesign document.
 */
WAW.Setup.createStyles = function(doc) {
    $L.info("Creating paragraph and character styles...");

    try {
        var ps = doc.paragraphStyles;
        var cs = doc.characterStyles;
        var fontName = BODY_FONT;
        var resolvedBodyFont = WAW.Utils.safeFont(fontName, "Regular") || app.fonts.item(fontName);

        // ============================================================
        // BASE PARAGRAPH STYLE (parent for all others)
        // ============================================================
        $L.info("  Creating WAW_Base paragraph style...");

        var baseStyle = ps.item("WAW_Base");
        if (!baseStyle || !baseStyle.isValid) {
            baseStyle = ps.add({
                name: "WAW_Base"
            });
        }

        // Apply base properties
        baseStyle.appliedFont = resolvedBodyFont;
        baseStyle.fontStyle = "Regular";
        baseStyle.pointSize = BODY_SIZE;
        baseStyle.leading = Leading.AUTO;
        baseStyle.autoLeading = 100;  // percentage
        baseStyle.alignToBaselineGrid = true;
        baseStyle.baselineGridRelativeOption = BaselineGridRelativeOption.LEADING;
        baseStyle.hyphenation = true;
        baseStyle.hyphenateWordsLongerThan = 5;
        baseStyle.hyphenateAfterFirst = 2;
        baseStyle.hyphenateBeforeLast = 2;
        baseStyle.hyphenateLadderLimit = 2;
        baseStyle.hyphenationZone = "0.25 in";
        baseStyle.hyphenWeight = 5;
        baseStyle.composer = "Adobe Paragraph Composer";
        baseStyle.justification = Justification.LEFT_JUSTIFIED;
        baseStyle.balanceRaggedLines = false;
        baseStyle.keepAllLinesTogether = false;
        baseStyle.keepWithNext = 0;
        baseStyle.keepLinesTogether = true;
        baseStyle.startParagraph = StartParagraph.ANYWHERE;
        baseStyle.spaceBefore = 0;
        baseStyle.spaceAfter = 0;
        baseStyle.firstLineIndent = 0;
        baseStyle.leftIndent = 0;
        baseStyle.rightIndent = 0;
        baseStyle.lastLineIndent = 0;
        baseStyle.dropCapCharacters = 0;
        baseStyle.dropCapLines = 0;
        baseStyle.noBreak = false;
        baseStyle.language = app.languagesWithVendors.item("English: USA");
        baseStyle.fillColor = doc.colors.item("WAW_Black") || doc.colors.item("Black");
        baseStyle.strokeColor = doc.swatches.item("None");
        baseStyle.capitalization = Capitalization.NORMAL;
        baseStyle.position = Position.NORMAL;
        baseStyle.underline = false;
        baseStyle.strikeThru = false;
        baseStyle.ligatures = true;

        $L.info("  WAW_Base created.");

        // ============================================================
        // BODY STYLES
        // ============================================================

        // --- WAW_Body: Standard body text ---
        $L.info("  Creating WAW_Body...");
        var bodyStyle = ps.item("WAW_Body");
        if (!bodyStyle || !bodyStyle.isValid) {
            bodyStyle = ps.add({
                name: "WAW_Body",
                basedOn: baseStyle
            });
        }
        bodyStyle.firstLineIndent = "0.25 in";
        bodyStyle.leading = BODY_LEADING;
        bodyStyle.alignToBaselineGrid = true;
        bodyStyle.hyphenation = true;
        bodyStyle.justification = Justification.LEFT_JUSTIFIED;
        $L.info("  WAW_Body created.");

        // --- WAW_Body First: First paragraph after chapter title ---
        $L.info("  Creating WAW_Body First...");
        var bodyFirst = ps.item("WAW_Body First");
        if (!bodyFirst || !bodyFirst.isValid) {
            bodyFirst = ps.add({
                name: "WAW_Body First",
                basedOn: bodyStyle
            });
        }
        bodyFirst.firstLineIndent = 0;
        bodyFirst.spaceBefore = "0.25 in";
        bodyFirst.dropCapLines = DROP_CAP_LINES;
        bodyFirst.dropCapCharacters = DROP_CAP_CHARS;
        bodyFirst.dropCapDetail = 0; // no outline
        $L.info("  WAW_Body First created (drop cap: " + DROP_CAP_LINES + " lines, " + DROP_CAP_CHARS + " char).");

        // --- WAW_Body No Indent: For continuous paragraphs after first ---
        $L.info("  Creating WAW_Body No Indent...");
        var bodyNoIndent = ps.item("WAW_Body No Indent");
        if (!bodyNoIndent || !bodyNoIndent.isValid) {
            bodyNoIndent = ps.add({
                name: "WAW_Body No Indent",
                basedOn: bodyStyle
            });
        }
        bodyNoIndent.firstLineIndent = 0;
        $L.info("  WAW_Body No Indent created.");

        // --- WAW_Centered: Centered body text ---
        $L.info("  Creating WAW_Centered...");
        var centeredStyle = ps.item("WAW_Centered");
        if (!centeredStyle || !centeredStyle.isValid) {
            centeredStyle = ps.add({
                name: "WAW_Centered",
                basedOn: bodyStyle
            });
        }
        centeredStyle.firstLineIndent = 0;
        centeredStyle.justification = Justification.CENTER_ALIGN;
        centeredStyle.alignToBaselineGrid = false;
        $L.info("  WAW_Centered created.");

        // --- WAW_Blockquote: indented extract quotations ---
        $L.info("  Creating WAW_Blockquote...");
        var blockquoteStyle = ps.item("WAW_Blockquote");
        if (!blockquoteStyle || !blockquoteStyle.isValid) {
            blockquoteStyle = ps.add({
                name: "WAW_Blockquote",
                basedOn: bodyStyle
            });
        }
        blockquoteStyle.firstLineIndent = 0;
        blockquoteStyle.leftIndent = "0.35 in";
        blockquoteStyle.rightIndent = "0.35 in";
        blockquoteStyle.fontStyle = "Italic";
        blockquoteStyle.spaceBefore = "0.125 in";
        blockquoteStyle.spaceAfter = "0.125 in";
        blockquoteStyle.alignToBaselineGrid = true;
        $L.info("  WAW_Blockquote created.");

        // --- WAW_Footnote and WAW_Endnote: note text styles used by import module ---
        $L.info("  Creating WAW_Footnote and WAW_Endnote...");
        var footnoteStyle = ps.item("WAW_Footnote");
        if (!footnoteStyle || !footnoteStyle.isValid) {
            footnoteStyle = ps.add({
                name: "WAW_Footnote",
                basedOn: baseStyle
            });
        }
        footnoteStyle.pointSize = 8;
        footnoteStyle.leading = 10;
        footnoteStyle.firstLineIndent = 0;
        footnoteStyle.leftIndent = 0;
        footnoteStyle.spaceBefore = 0;
        footnoteStyle.spaceAfter = 0;
        footnoteStyle.alignToBaselineGrid = false;

        var endnoteStyle = ps.item("WAW_Endnote");
        if (!endnoteStyle || !endnoteStyle.isValid) {
            endnoteStyle = ps.add({
                name: "WAW_Endnote",
                basedOn: footnoteStyle
            });
        }
        endnoteStyle.pointSize = 8;
        endnoteStyle.leading = 10;
        endnoteStyle.firstLineIndent = 0;
        endnoteStyle.alignToBaselineGrid = false;
        $L.info("  WAW_Footnote and WAW_Endnote created.");

        // --- WAW_Table Header and WAW_Table Body: used by table formatter ---
        $L.info("  Creating WAW_Table Header and WAW_Table Body...");
        var tableHeaderStyle = ps.item("WAW_Table Header");
        if (!tableHeaderStyle || !tableHeaderStyle.isValid) {
            tableHeaderStyle = ps.add({
                name: "WAW_Table Header",
                basedOn: baseStyle
            });
        }
        tableHeaderStyle.fontStyle = "Bold";
        tableHeaderStyle.pointSize = 8;
        tableHeaderStyle.leading = 10;
        tableHeaderStyle.firstLineIndent = 0;
        tableHeaderStyle.spaceBefore = 0;
        tableHeaderStyle.spaceAfter = 0;
        tableHeaderStyle.alignToBaselineGrid = false;

        var tableBodyStyle = ps.item("WAW_Table Body");
        if (!tableBodyStyle || !tableBodyStyle.isValid) {
            tableBodyStyle = ps.add({
                name: "WAW_Table Body",
                basedOn: baseStyle
            });
        }
        tableBodyStyle.pointSize = 8;
        tableBodyStyle.leading = 10;
        tableBodyStyle.firstLineIndent = 0;
        tableBodyStyle.spaceBefore = 0;
        tableBodyStyle.spaceAfter = 0;
        tableBodyStyle.alignToBaselineGrid = false;
        $L.info("  WAW_Table Header and WAW_Table Body created.");

        // ============================================================
        // DISPLAY STYLES
        // ============================================================

        // --- WAW_Chapter Title ---
        $L.info("  Creating WAW_Chapter Title...");
        var chapterTitle = ps.item("WAW_Chapter Title");
        if (!chapterTitle || !chapterTitle.isValid) {
            chapterTitle = ps.add({
                name: "WAW_Chapter Title",
                basedOn: baseStyle
            });
        }
        chapterTitle.appliedFont = resolvedBodyFont;
        chapterTitle.fontStyle = "Bold";
        chapterTitle.pointSize = CHAPTER_SIZE;
        chapterTitle.leading = CHAPTER_SIZE * 1.1;  // tight leading
        chapterTitle.justification = Justification.CENTER_ALIGN;
        chapterTitle.spaceBefore = "2 in";
        chapterTitle.spaceAfter = "0.75 in";
        chapterTitle.keepWithNext = 2;
        chapterTitle.hyphenation = false;
        chapterTitle.balanceRaggedLines = true;
        chapterTitle.alignToBaselineGrid = false;
        chapterTitle.firstLineIndent = 0;
        chapterTitle.leftIndent = 0;
        chapterTitle.rightIndent = 0;
        // Force next odd page — chapter opens always on recto
        chapterTitle.startParagraph = StartParagraph.NEXT_ODD_PAGE;
        chapterTitle.dropCapCharacters = 0;
        chapterTitle.dropCapLines = 0;
        $L.info("  WAW_Chapter Title created (" + CHAPTER_SIZE + "pt).");

        // --- WAW_Part Divider ---
        $L.info("  Creating WAW_Part Divider...");
        var partDivider = ps.item("WAW_Part Divider");
        if (!partDivider || !partDivider.isValid) {
            partDivider = ps.add({
                name: "WAW_Part Divider",
                basedOn: baseStyle
            });
        }
        partDivider.appliedFont = resolvedBodyFont;
        partDivider.fontStyle = "Bold";
        partDivider.pointSize = PART_SIZE;
        partDivider.leading = PART_SIZE * 1.2;
        partDivider.justification = Justification.CENTER_ALIGN;
        partDivider.spaceBefore = "2.5 in";
        partDivider.spaceAfter = "1.5 in";
        partDivider.hyphenation = false;
        partDivider.balanceRaggedLines = true;
        partDivider.alignToBaselineGrid = false;
        partDivider.firstLineIndent = 0;
        partDivider.keepWithNext = 1;
        // Force next odd page — part openers on recto
        partDivider.startParagraph = StartParagraph.NEXT_ODD_PAGE;
        $L.info("  WAW_Part Divider created (" + PART_SIZE + "pt).");

        // --- WAW_Part Subtitle ---
        $L.info("  Creating WAW_Part Subtitle...");
        var partSubtitle = ps.item("WAW_Part Subtitle");
        if (!partSubtitle || !partSubtitle.isValid) {
            partSubtitle = ps.add({
                name: "WAW_Part Subtitle",
                basedOn: partDivider
            });
        }
        partSubtitle.fontStyle = "Italic";
        partSubtitle.pointSize = SUBTITLE_SIZE;
        partSubtitle.leading = SUBTITLE_SIZE * 1.2;
        partSubtitle.spaceBefore = 0;
        partSubtitle.spaceAfter = "0.5 in";
        partSubtitle.startParagraph = StartParagraph.ANYWHERE;
        $L.info("  WAW_Part Subtitle created.");

        // ============================================================
        // IMAGE / CAPTION STYLES
        // ============================================================

        // --- WAW_Image Caption ---
        $L.info("  Creating WAW_Image Caption...");
        var imgCaption = ps.item("WAW_Image Caption");
        if (!imgCaption || !imgCaption.isValid) {
            imgCaption = ps.add({
                name: "WAW_Image Caption",
                basedOn: baseStyle
            });
        }
        imgCaption.appliedFont = resolvedBodyFont;
        imgCaption.fontStyle = "Italic";
        imgCaption.pointSize = CAPTION_SIZE;
        imgCaption.leading = CAPTION_SIZE * 1.2;
        imgCaption.justification = Justification.CENTER_ALIGN;
        imgCaption.spaceBefore = $u.toInches($c.captionSpaceBefore || "0.125 in");
        imgCaption.spaceAfter = 0;
        imgCaption.firstLineIndent = 0;
        imgCaption.alignToBaselineGrid = false;
        imgCaption.hyphenation = false;
        $L.info("  WAW_Image Caption created (" + CAPTION_SIZE + "pt).");

        // --- WAW_Image Anchor ---
        $L.info("  Creating WAW_Image Anchor...");
        var imgAnchor = ps.item("WAW_Image Anchor");
        if (!imgAnchor || !imgAnchor.isValid) {
            imgAnchor = ps.add({
                name: "WAW_Image Anchor",
                basedOn: centeredStyle
            });
        }
        imgAnchor.spaceBefore = "0.25 in";
        imgAnchor.spaceAfter = "0.125 in";
        imgAnchor.alignToBaselineGrid = false;
        $L.info("  WAW_Image Anchor created.");

        // ============================================================
        // SECTION BREAK STYLE
        // ============================================================

        // --- WAW_Section Break: Three bullets centered ---
        $L.info("  Creating WAW_Section Break...");
        var sectionBreak = ps.item("WAW_Section Break");
        if (!sectionBreak || !sectionBreak.isValid) {
            sectionBreak = ps.add({
                name: "WAW_Section Break",
                basedOn: centeredStyle
            });
        }
        sectionBreak.pointSize = SECTION_BREAK_SIZE;
        var sectionBreakLeading = SECTION_BREAK_SIZE * 1.2;
        sectionBreak.leading = sectionBreakLeading;
        sectionBreak.spaceBefore = "0.5 in";
        sectionBreak.spaceAfter = "0.5 in";
        sectionBreak.tracking = 200;
        sectionBreak.alignToBaselineGrid = false;
        // The actual bullets are typed content: "• • •"
        $L.info("  WAW_Section Break created.");

        // ============================================================
        // FRONT MATTER STYLES
        // ============================================================

        // --- WAW_Title Page Title ---
        $L.info("  Creating WAW_Title Page Title...");
        var titlePageTitle = ps.item("WAW_Title Page Title");
        if (!titlePageTitle || !titlePageTitle.isValid) {
            titlePageTitle = ps.add({
                name: "WAW_Title Page Title",
                basedOn: baseStyle
            });
        }
        titlePageTitle.appliedFont = resolvedBodyFont;
        titlePageTitle.fontStyle = "Bold";
        titlePageTitle.pointSize = TITLE_FONT_SIZE;
        titlePageTitle.leading = TITLE_FONT_SIZE * 1.1;
        titlePageTitle.justification = Justification.CENTER_ALIGN;
        titlePageTitle.spaceBefore = "1.5 in";
        titlePageTitle.spaceAfter = "0.5 in";
        titlePageTitle.alignToBaselineGrid = false;
        titlePageTitle.firstLineIndent = 0;
        titlePageTitle.hyphenation = false;
        $L.info("  WAW_Title Page Title created (" + TITLE_FONT_SIZE + "pt).");

        // --- WAW_Title Page Subtitle ---
        $L.info("  Creating WAW_Title Page Subtitle...");
        var titlePageSubtitle = ps.item("WAW_Title Page Subtitle");
        if (!titlePageSubtitle || !titlePageSubtitle.isValid) {
            titlePageSubtitle = ps.add({
                name: "WAW_Title Page Subtitle",
                basedOn: titlePageTitle
            });
        }
        titlePageSubtitle.fontStyle = "Italic";
        titlePageSubtitle.pointSize = SUBTITLE_SIZE;
        titlePageSubtitle.leading = SUBTITLE_SIZE * 1.2;
        titlePageSubtitle.spaceBefore = 0;
        titlePageSubtitle.spaceAfter = "0.25 in";
        $L.info("  WAW_Title Page Subtitle created.");

        // --- WAW_Title Page Author ---
        $L.info("  Creating WAW_Title Page Author...");
        var titlePageAuthor = ps.item("WAW_Title Page Author");
        if (!titlePageAuthor || !titlePageAuthor.isValid) {
            titlePageAuthor = ps.add({
                name: "WAW_Title Page Author",
                basedOn: titlePageTitle
            });
        }
        titlePageAuthor.fontStyle = "Regular";
        titlePageAuthor.pointSize = AUTHOR_SIZE;
        titlePageAuthor.leading = AUTHOR_SIZE * 1.2;
        titlePageAuthor.capitalization = Capitalization.SMALL_CAPS;
        titlePageAuthor.tracking = AUTHOR_TRACKING;
        titlePageAuthor.spaceBefore = "0.5 in";
        titlePageAuthor.spaceAfter = 0;
        $L.info("  WAW_Title Page Author created.");

        // --- WAW_Copyright ---
        $L.info("  Creating WAW_Copyright...");
        var copyrightStyle = ps.item("WAW_Copyright");
        if (!copyrightStyle || !copyrightStyle.isValid) {
            copyrightStyle = ps.add({
                name: "WAW_Copyright",
                basedOn: baseStyle
            });
        }
        copyrightStyle.pointSize = COPYRIGHT_SIZE;
        copyrightStyle.leading = COPYRIGHT_SIZE * 1.4;
        copyrightStyle.justification = Justification.LEFT_ALIGN;
        copyrightStyle.firstLineIndent = 0;
        copyrightStyle.alignToBaselineGrid = false;
        copyrightStyle.spaceBefore = "1 in";
        copyrightStyle.hyphenation = false;
        $L.info("  WAW_Copyright created (" + COPYRIGHT_SIZE + "pt).");

        // --- WAW_Dedication ---
        $L.info("  Creating WAW_Dedication...");
        var dedicationStyle = ps.item("WAW_Dedication");
        if (!dedicationStyle || !dedicationStyle.isValid) {
            dedicationStyle = ps.add({
                name: "WAW_Dedication",
                basedOn: centeredStyle
            });
        }
        dedicationStyle.fontStyle = "Italic";
        dedicationStyle.pointSize = DEDICATION_SIZE;
        dedicationStyle.leading = DEDICATION_SIZE * 1.3;
        dedicationStyle.spaceBefore = "2.5 in";
        dedicationStyle.alignToBaselineGrid = false;
        $L.info("  WAW_Dedication created.");


        // ============================================================
        // TOC STYLES
        // ============================================================

        // --- WAW_TOC Title ---
        $L.info("  Creating WAW_TOC Title...");
        var tocTitle = ps.item("WAW_TOC Title");
        if (!tocTitle || !tocTitle.isValid) {
            tocTitle = ps.add({
                name: "WAW_TOC Title",
                basedOn: baseStyle
            });
        }
        tocTitle.appliedFont = resolvedBodyFont;
        tocTitle.fontStyle = "Bold";
        tocTitle.pointSize = TOC_TITLE_SIZE;
        tocTitle.leading = TOC_TITLE_SIZE * 1.1;
        tocTitle.justification = Justification.CENTER_ALIGN;
        tocTitle.spaceBefore = "1 in";
        tocTitle.spaceAfter = "0.75 in";
        tocTitle.alignToBaselineGrid = false;
        tocTitle.firstLineIndent = 0;
        tocTitle.hyphenation = false;
        $L.info("  WAW_TOC Title created (" + TOC_TITLE_SIZE + "pt).");

        // --- WAW_TOC Part ---
        $L.info("  Creating WAW_TOC Part...");
        var tocPart = ps.item("WAW_TOC Part");
        if (!tocPart || !tocPart.isValid) {
            tocPart = ps.add({
                name: "WAW_TOC Part",
                basedOn: baseStyle
            });
        }
        tocPart.appliedFont = resolvedBodyFont;
        tocPart.fontStyle = "Bold";
        tocPart.pointSize = BODY_SIZE;
        tocPart.leading = BODY_LEADING;
        tocPart.justification = Justification.LEFT_ALIGN;
        tocPart.spaceBefore = "0.25 in";
        tocPart.spaceAfter = "0.0625 in";
        tocPart.firstLineIndent = 0;
        tocPart.leftIndent = 0;
        tocPart.rightIndent = 0;
        tocPart.alignToBaselineGrid = false;
        tocPart.hyphenation = false;
        // Right-aligned tab stop at ~4.5in with dot leader
        var tocPartTabs = tocPart.tabStops;
        // Clear any existing tabs
        for (var tp = tocPartTabs.length - 1; tp >= 0; tp--) {
            tocPartTabs[tp].remove();
        }
        tocPartTabs.add({
            alignment: TabStopAlignment.RIGHT_ALIGN,
            alignmentCharacter: ".",
            leader: ".",
            position: "4.5 in"
        });
        $L.info("  WAW_TOC Part created (right tab + dot leader at 4.5in).");

        // --- WAW_TOC Chapter ---
        $L.info("  Creating WAW_TOC Chapter...");
        var tocChapter = ps.item("WAW_TOC Chapter");
        if (!tocChapter || !tocChapter.isValid) {
            tocChapter = ps.add({
                name: "WAW_TOC Chapter",
                basedOn: baseStyle
            });
        }
        tocChapter.appliedFont = resolvedBodyFont;
        tocChapter.fontStyle = "Regular";
        tocChapter.pointSize = BODY_SIZE;
        tocChapter.leading = BODY_LEADING;
        tocChapter.justification = Justification.LEFT_ALIGN;
        tocChapter.spaceBefore = 0;
        tocChapter.spaceAfter = "0.03125 in";
        tocChapter.firstLineIndent = 0;
        tocChapter.leftIndent = "0.25 in";
        tocChapter.rightIndent = 0;
        tocChapter.alignToBaselineGrid = false;
        tocChapter.hyphenation = false;
        // Right-aligned tab stop at ~4.5in with dot leader
        var tocChapTabs = tocChapter.tabStops;
        for (var tcp = tocChapTabs.length - 1; tcp >= 0; tcp--) {
            tocChapTabs[tcp].remove();
        }
        tocChapTabs.add({
            alignment: TabStopAlignment.RIGHT_ALIGN,
            alignmentCharacter: ".",
            leader: ".",
            position: "4.5 in"
        });
        $L.info("  WAW_TOC Chapter created (left indent 0.25in, right tab + dot leader).");

        // ============================================================
        // CHARACTER STYLES
        // ============================================================

        $L.info("  Creating character styles...");

        // --- WAW_Italic ---
        var csItalic = cs.item("WAW_Italic");
        if (!csItalic || !csItalic.isValid) {
            csItalic = cs.add({ name: "WAW_Italic" });
        }
        csItalic.fontStyle = "Italic";
        csItalic.capitalization = Capitalization.NORMAL;
        $L.info("    WAW_Italic created.");

        // --- WAW_Bold ---
        var csBold = cs.item("WAW_Bold");
        if (!csBold || !csBold.isValid) {
            csBold = cs.add({ name: "WAW_Bold" });
        }
        csBold.fontStyle = "Bold";
        csBold.capitalization = Capitalization.NORMAL;
        $L.info("    WAW_Bold created.");

        // --- WAW_Bold Italic ---
        var csBoldItalic = cs.item("WAW_Bold Italic");
        if (!csBoldItalic || !csBoldItalic.isValid) {
            csBoldItalic = cs.add({ name: "WAW_Bold Italic" });
        }
        csBoldItalic.fontStyle = "Bold Italic";
        csBoldItalic.capitalization = Capitalization.NORMAL;
        $L.info("    WAW_Bold Italic created.");

        // --- WAW_Small Caps ---
        var csSmallCaps = cs.item("WAW_Small Caps");
        if (!csSmallCaps || !csSmallCaps.isValid) {
            csSmallCaps = cs.add({ name: "WAW_Small Caps" });
        }
        csSmallCaps.capitalization = Capitalization.SMALL_CAPS;
        csSmallCaps.fontStyle = "Regular";
        $L.info("    WAW_Small Caps created.");

        // --- WAW_Folio: For page number references in TOC ---
        var csFolio = cs.item("WAW_Folio");
        if (!csFolio || !csFolio.isValid) {
            csFolio = cs.add({ name: "WAW_Folio" });
        }
        csFolio.fontStyle = "Regular";
        csFolio.pointSize = FOLIO_FONT_SIZE;
        csFolio.capitalization = Capitalization.NORMAL;
        // Try to use the body font; if not available fall back
        try {
            csFolio.appliedFont = resolvedBodyFont;
        } catch (fontErr) {
            $L.warn("Could not set folio font: " + fontErr.message);
        }
        $L.info("    WAW_Folio created (" + FOLIO_FONT_SIZE + "pt).");

        // --- WAW_Drop Cap: Character style for drop caps ---
        var csDropCap = cs.item("WAW_Drop Cap");
        if (!csDropCap || !csDropCap.isValid) {
            csDropCap = cs.add({ name: "WAW_Drop Cap" });
        }
        csDropCap.fontStyle = "Regular";
        try {
            csDropCap.appliedFont = resolvedBodyFont;
        } catch (dcFontErr) {
            $L.warn("Could not set drop cap font: " + dcFontErr.message);
        }
        // Tint the drop cap for visual elegance
        try {
            csDropCap.fillColor = doc.colors.item("WAW_Black");
            csDropCap.fillTint = 85;
        } catch (tintErr) {
            $L.warn("Could not set drop cap tint: " + tintErr.message);
        }
        $L.info("    WAW_Drop Cap created.");

        // --- WAW_Header Text: Character style for running headers ---
        var csHeader = cs.item("WAW_Header Text");
        if (!csHeader || !csHeader.isValid) {
            csHeader = cs.add({ name: "WAW_Header Text" });
        }
        csHeader.fontStyle = "Regular";
        csHeader.pointSize = HEADER_FONT_SIZE;
        csHeader.tracking = HEADER_TRACKING;
        csHeader.capitalization = Capitalization.SMALL_CAPS;
        try {
            csHeader.appliedFont = resolvedBodyFont;
        } catch (hdrFontErr) {
            $L.warn("Could not set header font: " + hdrFontErr.message);
        }
        try {
            csHeader.fillColor = doc.colors.item("WAW_Text_Grey");
        } catch (hdrColorErr) {
            $L.warn("Could not set header color: " + hdrColorErr.message);
        }
        $L.info("    WAW_Header Text created.");

        $L.info("Paragraph and character styles created successfully.");

    } catch (e) {
        $L.error("createStyles() failed: " + e.message);
        throw e;
    }
};


/**
 * Creates object styles for consistent frame treatment.
 * These styles control anchored image frames, caption frames, and containers.
 * @param {Document} doc - The InDesign document.
 */
WAW.Setup.createObjectStyles = function(doc) {
    $L.info("Creating object styles...");

    try {
        var os = doc.objectStyles;

        // ============================================================
        // BASE OBJECT STYLE: Reset [None] overrides for clean base
        // ============================================================

        // --- WAW_Image Frame ---
        $L.info("  Creating WAW_Image Frame object style...");
        var imgFrame = os.item("WAW_Image Frame");
        if (!imgFrame || !imgFrame.isValid) {
            imgFrame = os.add({
                name: "WAW_Image Frame"
            });
        }
        imgFrame.enableParagraphStyle = false;
        imgFrame.fillColor = doc.swatches.item("None");
        imgFrame.fillTint = 100;
        imgFrame.strokeColor = doc.swatches.item("None");
        imgFrame.strokeTint = 100;
        imgFrame.strokeWeight = 0;
        imgFrame.strokeType = doc.strokeStyles.item("Solid");
        // Auto-fit: content fitting to frame proportionally
        imgFrame.frameFittingOptions.fittingOnEmptyFrame = EmptyFrameFittingOptions.FILL_PROPORTIONALLY;
        imgFrame.frameFittingOptions.fittingAlignment = AnchorPoint.CENTER_ANCHOR;
        imgFrame.frameFittingOptions.autoFit = true;
        // Text wrap off
        imgFrame.textWrapPreferences.textWrapMode = TextWrapModes.NONE;
        imgFrame.enableTextFrameAutoSizingOptions = false;
        $L.info("  WAW_Image Frame created (no stroke/fill, auto-fit proportional).");

        // --- WAW_Caption Frame ---
        $L.info("  Creating WAW_Caption Frame object style...");
        var capFrame = os.item("WAW_Caption Frame");
        if (!capFrame || !capFrame.isValid) {
            capFrame = os.add({
                name: "WAW_Caption Frame"
            });
        }
        capFrame.enableParagraphStyle = true;
        // Link to WAW_Image Caption paragraph style
        try {
            capFrame.appliedParagraphStyle = doc.paragraphStyles.item("WAW_Image Caption");
        } catch (psErr) {
            $L.warn("  Could not link caption frame to WAW_Image Caption style: " + psErr.message);
        }
        capFrame.fillColor = doc.swatches.item("None");
        capFrame.fillTint = 100;
        capFrame.strokeColor = doc.swatches.item("None");
        capFrame.strokeWeight = 0;
        capFrame.strokeType = doc.strokeStyles.item("Solid");
        // Auto-sizing: height only
        capFrame.enableTextFrameAutoSizingOptions = true;
        capFrame.textFrameAutoSizingOptions.autoSizingType = AutoSizingTypeEnum.HEIGHT_ONLY;
        capFrame.textFrameAutoSizingOptions.autoSizingReferencePoint = AnchorPoint.TOP_CENTER_POINT;
        capFrame.textWrapPreferences.textWrapMode = TextWrapModes.NONE;
        $L.info("  WAW_Caption Frame created (no stroke, auto-sizing height).");

        // --- WAW_Anchor Container ---
        $L.info("  Creating WAW_Anchor Container object style...");
        var anchorContainer = os.item("WAW_Anchor Container");
        if (!anchorContainer || !anchorContainer.isValid) {
            anchorContainer = os.add({
                name: "WAW_Anchor Container"
            });
        }
        anchorContainer.enableParagraphStyle = false;
        anchorContainer.fillColor = doc.swatches.item("None");
        anchorContainer.fillTint = 100;
        anchorContainer.strokeColor = doc.swatches.item("None");
        anchorContainer.strokeWeight = 0;
        anchorContainer.strokeType = doc.strokeStyles.item("Solid");
        // Anchored object settings: inline, center-aligned
        try {
            var anchoredSettings = anchorContainer.anchoredObjectSettings;
            anchoredSettings.anchoredPosition = AnchorPosition.ANCHORED;
            anchoredSettings.anchorXoffset = 0;
            anchoredSettings.anchorYoffset = 0;
            anchoredSettings.anchorPoint = AnchorPoint.TOP_CENTER_POINT;
            anchoredSettings.spineRelative = true;
            // Position reference point centered
            anchoredSettings.horizontalReferencePoint = AnchoredRelativeTo.COLUMN_EDGE;
            anchoredSettings.horizontalAlignment = HorizontalAlignment.CENTER_ALIGN;
        } catch (anchorErr) {
            $L.warn("  Could not configure anchored object settings: " + anchorErr.message);
        }
        anchorContainer.textWrapPreferences.textWrapMode = TextWrapModes.NONE;
        $L.info("  WAW_Anchor Container created (anchored, center-aligned).");

        // --- WAW_Text Frame ---
        $L.info("  Creating WAW_Text Frame object style...");
        var textFrame = os.item("WAW_Text Frame");
        if (!textFrame || !textFrame.isValid) {
            textFrame = os.add({
                name: "WAW_Text Frame"
            });
        }
        textFrame.enableParagraphStyle = false;
        textFrame.fillColor = doc.swatches.item("None");
        textFrame.fillTint = 100;
        textFrame.strokeColor = doc.swatches.item("None");
        textFrame.strokeWeight = 0;
        textFrame.strokeType = doc.strokeStyles.item("Solid");
        textFrame.textFramePreferences.verticalJustification = VerticalJustification.TOP_ALIGN;
        textFrame.textWrapPreferences.textWrapMode = TextWrapModes.NONE;
        $L.info("  WAW_Text Frame created.");

        // --- WAW_Rule Frame ---
        $L.info("  Creating WAW_Rule Frame object style...");
        var ruleFrame = os.item("WAW_Rule Frame");
        if (!ruleFrame || !ruleFrame.isValid) {
            ruleFrame = os.add({
                name: "WAW_Rule Frame"
            });
        }
        ruleFrame.enableParagraphStyle = false;
        ruleFrame.fillColor = doc.swatches.item("None");
        ruleFrame.fillTint = 100;
        try {
            ruleFrame.strokeColor = doc.colors.item("WAW_Rule_Grey");
        } catch (ruleColorErr) {
            ruleFrame.strokeColor = doc.swatches.item("Black");
        }
        ruleFrame.strokeTint = 100;
        ruleFrame.strokeWeight = RULE_WEIGHT;
        ruleFrame.strokeType = doc.strokeStyles.item("Solid");
        ruleFrame.textWrapPreferences.textWrapMode = TextWrapModes.NONE;
        $L.info("  WAW_Rule Frame created (" + RULE_WEIGHT + "pt hairline).");

        // --- WAW_Table: object style referenced by the table formatter ---
        $L.info("  Creating WAW_Table object style...");
        var tableStyle = os.item("WAW_Table");
        if (!tableStyle || !tableStyle.isValid) {
            tableStyle = os.add({
                name: "WAW_Table"
            });
        }
        tableStyle.enableParagraphStyle = false;
        tableStyle.fillColor = doc.swatches.item("None");
        tableStyle.strokeColor = doc.swatches.item("Black");
        tableStyle.strokeWeight = 0.25;
        tableStyle.textWrapPreferences.textWrapMode = TextWrapModes.NONE;
        $L.info("  WAW_Table created.");

        $L.info("Object styles created successfully.");

    } catch (e) {
        $L.error("createObjectStyles() failed: " + e.message);
        throw e;
    }
};


/**
 * Sets up document sections with proper page numbering.
 * Front matter: lowercase roman numerals (i, ii, iii...).
 * Body matter: arabic numerals starting at 1.
 * @param {Document} doc - The InDesign document.
 */
WAW.Setup.setupSections = function(doc) {
    $L.info("Setting up document sections...");

    try {
        var pages = doc.pages;
        if (!pages || pages.length === 0) {
            $L.warn("No pages found in document. Skipping section setup.");
            return;
        }

        // Remove any existing sections (except default)
        var existingSections = doc.sections;
        if (existingSections.length > 0) {
            for (var s = existingSections.length - 1; s >= 0; s--) {
                try {
                    existingSections[s].remove();
                } catch (removeErr) {
                    // Default section may not be removable; ignore
                }
            }
        }

        // ============================================================
        // SECTION 1: Front Matter — Lowercase Roman Numerals
        // ============================================================
        // Front matter typically includes: half-title, title page, copyright,
        // dedication, table of contents, epigraph — roughly 6-8 pages.
        // We set this up as a section starting at page 0 (first page).

        var frontMatterPageCount = 8;  // Default front matter pages
        if ($c.frontMatterPages && typeof $c.frontMatterPages === "number") {
            frontMatterPageCount = $c.frontMatterPages;
        }

        $L.info("  Creating front matter section (" + frontMatterPageCount + " pages, roman numerals)...");

        // Ensure we have enough pages for front matter
        while (pages.length < frontMatterPageCount + 2) {
            doc.pages.add(LocationOptions.AT_END);
            pages = doc.pages;  // refresh reference
        }

        // Get the page that starts the front matter section
        var frontMatterStartPage = pages[0];

        var frontSection = doc.sections.add(
            frontMatterStartPage,
            undefined,  // override (none)
            {
                name: "Front Matter",
                continueNumbering: false,
                pageNumberStart: 1,
                sectionPrefix: "",
                includeSectionPrefix: false,
                pageNumberStyle: PageNumberStyle.LOWER_ROMAN
            }
        );

        if (frontSection && frontSection.isValid) {
            $L.info("  Front matter section created: pages i-… (" + frontMatterPageCount + " pages).");
        } else {
            $L.warn("  Front matter section may not have been created properly.");
        }

        // ============================================================
        // SECTION 2: Body Matter — Arabic Numerals starting at 1
        // ============================================================

        var bodyStartPageIndex = frontMatterPageCount;  // 0-based index

        $L.info("  Creating body matter section (arabic numerals starting at 1)...");

        var bodyStartPage;
        if (bodyStartPageIndex < pages.length) {
            bodyStartPage = pages[bodyStartPageIndex];
        } else {
            // Add pages if needed
            while (pages.length <= bodyStartPageIndex) {
                doc.pages.add(LocationOptions.AT_END);
                pages = doc.pages;
            }
            bodyStartPage = pages[bodyStartPageIndex];
        }

        var bodySection = doc.sections.add(
            bodyStartPage,
            undefined,
            {
                name: "Body Matter",
                continueNumbering: false,
                pageNumberStart: 1,
                sectionPrefix: "",
                includeSectionPrefix: false,
                pageNumberStyle: PageNumberStyle.ARABIC
            }
        );

        if (bodySection && bodySection.isValid) {
            $L.info("  Body matter section created: page 1 onward.");
        } else {
            $L.warn("  Body matter section may not have been created properly.");
        }

        $L.info("Document sections setup complete.");

    } catch (e) {
        $L.error("setupSections() failed: " + e.message);
        throw e;
    }
};


/**
 * Configures the document baseline grid with validation.
 * Ensures grid increment matches body leading for proper text alignment.
 * @param {Document} doc - The InDesign document.
 */
WAW.Setup.setupBaselineGrid = function(doc) {
    $L.info("Setting up baseline grid...");

    try {
        var gridPrefs = doc.gridPreferences;

        // ============================================================
        // VALIDATION: Grid increment should match body leading
        // ============================================================
        var expectedIncrement = BODY_LEADING;
        var currentIncrement = gridPrefs.baselineDivision;

        if (Math.abs(currentIncrement - expectedIncrement) > 0.01) {
            $L.warn("Baseline grid increment (" + currentIncrement + 
                    ") does not match body leading (" + expectedIncrement + 
                    "). Updating grid to match body leading.");
            gridPrefs.baselineDivision = expectedIncrement;
        } else {
            $L.info("  Baseline grid increment validated: " + expectedIncrement + "pt matches body leading.");
        }

        // ============================================================
        // GRID START POSITION
        // ============================================================
        var currentStart = gridPrefs.baselineStart;
        if (Math.abs(currentStart - GRID_START) > 0.001) {
            $L.info("  Updating baseline start to " + GRID_START + "in (was " + currentStart + "in).");
            gridPrefs.baselineStart = GRID_START;
        } else {
            $L.info("  Baseline grid start validated: " + GRID_START + "in.");
        }

        // ============================================================
        // GRID VISIBILITY & OPTIONS
        // ============================================================
        gridPrefs.baselineGridShown = true;
        gridPrefs.baselineSnapToGrid = true;
        gridPrefs.baselineGridRelativeOption = BaselineGridRelativeOption.TOP_OF_MARGIN_OF_BASELINE_GRID;

        // ============================================================
        // VIEW GRID COLOR (subtle grey)
        // ============================================================
        try {
            gridPrefs.baselineGridColor = UIColors.GRID_BLUE;
        } catch (colorErr) {
            $L.warn("  Could not set baseline grid color: " + colorErr.message);
        }

        // ============================================================
        // GRID THRESHOLD (when to show/hide based on zoom)
        // ============================================================
        try {
            gridPrefs.baselineGridViewThreshold = 25;  // Show at 25% zoom and above
        } catch (threshErr) {
            $L.warn("  Could not set baseline grid view threshold: " + threshErr.message);
        }

        $L.info("Baseline grid configured: start=" + gridPrefs.baselineStart +
                "in, increment=" + gridPrefs.baselineDivision + "pt, relative=topOfMargin.");

    } catch (e) {
        $L.error("setupBaselineGrid() failed: " + e.message);
        throw e;
    }
};

// ============================================================
// TEXT VARIABLE: Running Header
// ============================================================

/**
 * Creates and configures a text variable for running headers.
 * The variable captures the most recent instance of WAW_Chapter Title
 * and is used in the A-Body master page header.
 * @param {Document} doc - The InDesign document.
 */
WAW.Setup.configureRunningHeader = function(doc) {
    $L.info("Configuring running header text variable...");

    try {
        var textVariables = doc.textVariables;
        var varName = "WAW_Running Header";

        // Remove existing variable if it exists
        var existingVar = textVariables.item(varName);
        if (existingVar && existingVar.isValid) {
            try {
                existingVar.remove();
                $L.info("  Removed existing running header variable.");
            } catch (removeErr) {
                $L.warn("  Could not remove existing variable: " + removeErr.message);
            }
        }

        // Also check for default "Running Header" variable
        var defaultVar = textVariables.item("Running Header");
        if (defaultVar && defaultVar.isValid) {
            try {
                defaultVar.remove();
            } catch (ignore) {}
        }

        // ============================================================
        // CREATE TEXT VARIABLE: Dynamic Header
        // ============================================================
        // Variable type: "Match Paragraph Style" — captures text from
        // the most recent paragraph with the WAW_Chapter Title style.

        var runningHeaderVar = textVariables.add(
            undefined,
            undefined,
            undefined,
            {
                name: varName,
                variableType: VariableTypes.MATCH_PARAGRAPH_STYLE_TYPE
            }
        );

        if (!runningHeaderVar || !runningHeaderVar.isValid) {
            throw new Error("Failed to create text variable '" + varName + "'.");
        }

        // Configure the variable options
        var varOpts = runningHeaderVar.matchParagraphStylePreferences;
        varOpts.searchStrategy = TextVariableSearchStrategies.FIRST_ON_PAGE;

        // Set the paragraph style to search for
        var chapterTitleStyle = doc.paragraphStyles.item("WAW_Chapter Title");
        if (chapterTitleStyle && chapterTitleStyle.isValid) {
            varOpts.appliedParagraphStyle = chapterTitleStyle;
            $L.info("  Linked running header to WAW_Chapter Title style.");
        } else {
            $L.warn("  WAW_Chapter Title paragraph style not found. Variable may not function correctly.");
        }

        // Use the paragraph text (not XMP metadata)
        varOpts.textBefore = "";
        varOpts.textAfter = "";
        varOpts.changeCaseType = ChangeCaseTypes.NONE;

        // Delete end punctuation: remove trailing periods/colons from chapter titles
        varOpts.deleteEndPunctuation = true;

        $L.info("Running header variable '" + varName + "' configured successfully.");

        // ============================================================
        // INSERT VARIABLE INTO A-MASTER RIGHT PAGE HEADER
        // ============================================================
        try {
            var masterSpreadA = doc.masterSpreads.itemByName("A-Body");
            if (masterSpreadA && masterSpreadA.isValid) {
                var rightPage = masterSpreadA.pages[1];  // recto
                var headerFrames = rightPage.textFrames;

                for (var h = 0; h < headerFrames.length; h++) {
                    var hf = headerFrames[h];
                    if (hf.label === "WAW_Header_Right") {
                        // Clear placeholder text and insert variable
                        var hPara = hf.paragraphs[0];
                        hPara.contents = "";
                        hPara.contents = TextVariableInstances.ADD;
                        // Insert the text variable instance
                        hf.textVariableInstances.add(
                            LocationOptions.AT_BEGINNING,
                            undefined,
                            undefined,
                            {
                                associatedTextVariable: runningHeaderVar,
                                textVariableInstancesContent: ""
                            }
                        );
                        $L.info("  Inserted running header variable into A-Body right page header.");
                        break;
                    }
                }
            } else {
                $L.warn("  A-Body master spread not found. Header variable not inserted.");
            }
        } catch (insertErr) {
            $L.warn("  Could not insert variable into master page header: " + insertErr.message);
        }

    } catch (e) {
        $L.error("configureRunningHeader() failed: " + e.message);
        // Don't throw — running header failure is not fatal
        $L.warn("Document will function without dynamic running headers.");
    }
};


// ============================================================
// MAIN ORCHESTRATION: Run full document setup pipeline
// ============================================================

/**
 * Runs the complete document setup pipeline.
 * Creates document, master pages, swatches, styles, object styles,
 * sections, baseline grid, and running headers in the correct order.
 * @returns {Document} The fully configured InDesign document.
 */
WAW.Setup.run = function() {
    $L.info("========================================");
    $L.info("WE ARE WOLF v7.0 — Document Setup Engine");
    $L.info("========================================");

    var doc = null;
    var startTime = new Date();

    try {
        // ============================================================
        // STEP 1: Create document
        // ============================================================
        doc = WAW.Setup.createDocument();

        // ============================================================
        // STEP 2: Create swatches (before styles that reference them)
        // ============================================================
        WAW.Setup.createSwatches(doc);

        // ============================================================
        // STEP 3: Create master pages
        // ============================================================
        WAW.Setup.createMasterPages(doc);

        // ============================================================
        // STEP 4: Create paragraph and character styles
        // ============================================================
        WAW.Setup.createStyles(doc);

        // ============================================================
        // STEP 5: Create object styles
        // ============================================================
        WAW.Setup.createObjectStyles(doc);

        // ============================================================
        // STEP 6: Configure baseline grid
        // ============================================================
        WAW.Setup.setupBaselineGrid(doc);

        // ============================================================
        // STEP 7: Set up document sections
        // ============================================================
        WAW.Setup.setupSections(doc);

        // ============================================================
        // STEP 8: Configure running header text variable
        // ============================================================
        WAW.Setup.configureRunningHeader(doc);

        // ============================================================
        // COMPLETION
        // ============================================================
        var endTime = new Date();
        var elapsed = (endTime - startTime) / 1000;

        $L.info("========================================");
        $L.info("Document setup complete in " + elapsed + " seconds.");
        $L.info("Document: " + doc.name);
        $L.info("Pages: " + doc.pages.length);
        $L.info("Master spreads: " + doc.masterSpreads.length);
        $L.info("Paragraph styles: " + doc.paragraphStyles.length);
        $L.info("Character styles: " + doc.characterStyles.length);
        $L.info("Object styles: " + doc.objectStyles.length);
        $L.info("Colors: " + doc.colors.length);
        $L.info("========================================");

        return doc;

    } catch (e) {
        $L.error("WAW.Setup.run() failed: " + e.message);
        // Attempt cleanup on failure
        if (doc && doc.isValid) {
            try {
                doc.close(SaveOptions.NO);
                $L.info("Closed incomplete document due to error.");
            } catch (closeErr) {
                $L.warn("Could not close document: " + closeErr.message);
            }
        }
        throw e;
    }
};

// ============================================================
// MODULE FOOTER
// ============================================================

$L.info("02_setup.jsx loaded — WAW.Setup module ready.");
$L.info("  Available: createDocument, createMasterPages, createSwatches,");
$L.info("  createStyles, createObjectStyles, setupSections,");
$L.info("  setupBaselineGrid, configureRunningHeader, run");

// End of 02_setup.jsx


// ============================================================================
// MODULE 02: END
// ============================================================================


// ============================================================================
// MODULE 03: BEGIN
// ============================================================================

/**
 * ============================================================================
 * WE ARE WOLF — InDesign Automation v7.0
 * MODULE 03 — IMPORT, PROCESS & PLACE
 * ============================================================================
 *
 * Handles manuscript import from Word (.docx/.doc/.rtf), post-processing,
 * style remapping, text cleanup, table formatting, footnote styling,
 * and image placement with anchored objects.
 *
 * Namespace: WAW.Import
 * Dependencies: WAW.config, WAW.Log, WAW.Utils, WAW.UI
 * ============================================================================
 */

// Ensure namespace exists
if (typeof WAW === "undefined") { var WAW = {}; }
if (typeof WAW.Import === "undefined") { WAW.Import = {}; }

/**
 * ------------------------------------------------------------------------
 * CONSTANTS
 * ------------------------------------------------------------------------
 */

/**
 * Complete Word-to-InDesign paragraph style mapping.
 * Each entry maps a source Word style to a target InDesign paragraph style.
 * Some entries include a `detectBy` regex for content-based auto-detection.
 * @type {Object}
 */
WAW.Import.STYLE_MAP = {
    "Heading 1":      { target: "WAW_Chapter Title", detectBy: /^Chapter\s+\d+/i },
    "Heading 2":      { target: "WAW_Part Divider",  detectBy: /^Part\s+(I+|V?I{0,3}|\d+)/i },
    "Normal":         { target: "WAW_Body" },
    "No Indent":      { target: "WAW_Body First" },
    "Caption":        { target: "WAW_Image Caption" },
    "Centered":       { target: "WAW_Centered" },
    "Quote":          { target: "WAW_Blockquote" },
    "Block Text":     { target: "WAW_Blockquote" },
    "Footnote Text":  { target: "WAW_Footnote" }
};

/**
 * Supported image file extensions for image discovery.
 * @type {Array}
 */
WAW.Import.IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".psd", ".eps", ".pdf"];

/**
 * ------------------------------------------------------------------------
 * 1. MANUSCRIPT IMPORT
 * ------------------------------------------------------------------------
 */

/**
 * Imports a Word manuscript (.docx/.doc/.rtf) into the document.
 * Opens a file dialog, sets comprehensive Word import preferences,
 * places into a primary text frame, and auto-threads through pages.
 *
 * @param {Document} doc — The target InDesign document.
 * @returns {Boolean} true on success, false on failure.
 */
WAW.Import.importManuscript = function(doc) {
    WAW.Log.info("=== Import Manuscript ===");

    if (!doc) {
        WAW.Log.error("importManuscript: No document provided.");
        return false;
    }

    try {
        // --- File dialog with filter ---
        var defaultFolder = Folder.desktop;
        if (WAW.config && WAW.config.import && WAW.config.import.defaultFolder) {
            var cfgFolder = new Folder(WAW.config.import.defaultFolder);
            if (cfgFolder.exists) {
                defaultFolder = cfgFolder;
            }
        }

        var file = File.openDialog(
            "Select manuscript file (.docx, .doc, .rtf)",
            function(f) {
                return f.name.match(/\.(docx?|rtf)$/i) !== null;
            },
            false
        );

        if (!file) {
            WAW.Log.warn("importManuscript: No file selected by user.");
            return false;
        }

        WAW.Log.info("Selected manuscript: " + file.fsName);
        WAW.UI.update("Importing manuscript...", 5);

        // --- Set comprehensive Word import preferences ---
        var wp = app.wordRTFImportPreferences;

        // Page break handling
        wp.convertPageBreaks = ConvertPageBreaks.NONE;

        // Endnotes and footnotes
        wp.importEndnotes = true;
        wp.importFootnotes = true;

        // Index and TOC
        wp.importIndex = false;
        wp.importTOC = false;

        // Styles and formatting
        wp.importUnusedStyles = false;
        wp.preserveLocalOverrides = true;
        wp.preserveTrackChanges = false;
        wp.removeFormatting = false;
        wp.useTypographersQuotes = true;

        // Hidden layers
        wp.importHiddenLayers = false;

        // Convert URLs to hyperlinks (v7.0 enhancement)
        if (typeof wp.convertURLsToHyperlinks !== "undefined") {
            wp.convertURLsToHyperlinks = true;
        }

        WAW.Log.info("Word import preferences configured.");
        WAW.UI.update("Placing text...", 10);

        // --- Create primary text frame on the body start page ---
        // setupSections() reserves front matter pages before the body.
        var bodyStartIndex = (WAW.config && typeof WAW.config.frontMatterPages === "number") ? WAW.config.frontMatterPages : 0;
        if (bodyStartIndex < 0 || bodyStartIndex >= doc.pages.length) bodyStartIndex = 0;
        var page = doc.pages[bodyStartIndex];
        var margins = page.marginPreferences;
        var pb = page.bounds; // [y1, x1, y2, x2]

        var tfBounds = [
            margins.top,
            margins.left,
            pb[2] - margins.bottom,
            pb[3] - margins.right
        ];

        var primaryFrame = page.textFrames.add({
            geometricBounds: tfBounds,
            contents: ""
        });

        // Ensure the frame is part of the document's master text frame flow if applicable
        if (doc.masterTextFrame && doc.masterTextFrame.length > 0) {
            // Use master text frame approach
            primaryFrame.remove();
            primaryFrame = page.textFrames.itemByName("Primary Text Frame") || page.textFrames[0];
        }

        WAW.Log.info("Primary text frame created on page 1.");

        // --- Place the Word file ---
        var cursor = primaryFrame.insertionPoints[0];
        cursor.place(file);

        WAW.Log.info("File placed successfully.");
        WAW.UI.update("File placed. Threading text...", 20);

        // --- Auto-thread text through pages ---
        var maxPages = (WAW.config && WAW.config.import && WAW.config.import.maxPages)
            ? WAW.config.import.maxPages : 600;

        var pagesCreated = 1;
        var loopGuard = 0;
        var MAX_LOOPS = maxPages + 50; // generous guard
        var lastPage, lastFrame, newPage, newFrame;
        var isFacingPages = doc.documentPreferences.facingPages;

        // Find the last text frame in the thread
        lastFrame = primaryFrame;
        while (lastFrame.nextTextFrame !== null) {
            lastFrame = lastFrame.nextTextFrame;
        }

        // Auto-flow: keep adding pages while text overflows
        while (lastFrame.overflows && pagesCreated < maxPages && loopGuard < MAX_LOOPS) {
            loopGuard++;

            lastPage = lastFrame.parentPage;
            if (!lastPage) {
                WAW.Log.warn("importManuscript: Frame has no parent page. Stopping thread.");
                break;
            }

            // Add new page after last page
            newPage = doc.pages.add(LocationOptions.AFTER, lastPage);
            pagesCreated++;

            // Determine margins for this page (left vs. right in facing-pages docs)
            var pgMargins = newPage.marginPreferences;
            var newPb = newPage.bounds;

            var newTfBounds = [
                pgMargins.top,
                pgMargins.left,
                newPb[2] - pgMargins.bottom,
                newPb[3] - pgMargins.right
            ];

            // Create new frame on new page
            newFrame = newPage.textFrames.add({
                geometricBounds: newTfBounds,
                contents: ""
            });

            // Thread from previous frame
            lastFrame.nextTextFrame = newFrame;
            lastFrame = newFrame;

            // Progress update every 10 pages
            if (pagesCreated % 10 === 0) {
                var progressPct = 20 + Math.min(60, Math.floor((pagesCreated / maxPages) * 60));
                WAW.UI.update("Threading page " + pagesCreated + "...", progressPct);
            }
        }

        if (loopGuard >= MAX_LOOPS) {
            WAW.Log.error("importManuscript: INFINITE LOOP GUARD triggered after " + loopGuard + " iterations.");
            return false;
        }

        if (pagesCreated >= maxPages && lastFrame.overflows) {
            WAW.Log.warn("importManuscript: Max pages (" + maxPages + ") reached but text still overflows.");
        }

        WAW.Log.info("Auto-thread complete: " + pagesCreated + " page(s) created.");
        WAW.UI.update("Import complete — " + pagesCreated + " pages.", 85);

        return true;

    } catch (err) {
        WAW.Log.error("importManuscript: " + err.message + " (Line " + err.line + ")");
        return false;
    }
};

/**
 * ------------------------------------------------------------------------
 * 2. STYLE REMAPPING
 * ------------------------------------------------------------------------
 */

/**
 * Remaps imported Word paragraph styles to InDesign WAW styles.
 * Uses doc.changeGrep() for each style mapping, then auto-detects
 * unstyled paragraphs by content pattern and assigns appropriate styles.
 *
 * @param {Document} doc — The target InDesign document.
 * @returns {Object} Statistics: { remapped: N, autoDetected: N, unstyled: N }
 */
WAW.Import.remapStyles = function(doc) {
    WAW.Log.info("=== Remap Styles ===");

    if (!doc) {
        WAW.Log.error("remapStyles: No document provided.");
        return { remapped: 0, autoDetected: 0, unstyled: 0 };
    }

    var stats = { remapped: 0, autoDetected: 0, unstyled: 0 };

    try {
        // Save current find/change preferences
        var savedFindPrefs = app.findGrepPreferences.properties;
        var savedChangePrefs = app.changeGrepPreferences.properties;

        // Reset find/change
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;

        var sourceStyle, mapping, targetStyleName;
        var remapCount = 0;

        // --- Step 1: Direct style-to-style remapping ---
        for (sourceStyle in WAW.Import.STYLE_MAP) {
            if (!WAW.Import.STYLE_MAP.hasOwnProperty(sourceStyle)) {
                continue;
            }

            mapping = WAW.Import.STYLE_MAP[sourceStyle];
            targetStyleName = mapping.target;

            // Check if target style exists
            var targetStyle = doc.paragraphStyles.itemByName(targetStyleName);
            if (!targetStyle.isValid) {
                WAW.Log.warn("remapStyles: Target style '" + targetStyleName + "' not found. Skipping.");
                continue;
            }

            // Check if source style exists
            var sourceStyleObj = doc.paragraphStyles.itemByName(sourceStyle);
            if (!sourceStyleObj.isValid) {
                WAW.Log.info("remapStyles: Source style '" + sourceStyle + "' not found in document (may already be clean).");
                continue;
            }

            // Reset
            app.findGrepPreferences = NothingEnum.nothing;
            app.changeGrepPreferences = NothingEnum.nothing;

            // Find by applied paragraph style
            app.findGrepPreferences.appliedParagraphStyle = sourceStyleObj;
            app.changeGrepPreferences.appliedParagraphStyle = targetStyle;

            // Execute change all on all stories
            var changes = 0;
            var allStories = doc.stories.everyItem().getElements();
            var si, storyResult;

            for (si = 0; si < allStories.length; si++) {
                storyResult = allStories[si].changeGrep();
                changes += storyResult.length;
            }

            if (changes > 0) {
                remapCount += changes;
                WAW.Log.info("remapStyles: '" + sourceStyle + "' → '" + targetStyleName + "' (" + changes + " paragraph(s))");
            }
        }

        stats.remapped = remapCount;
        WAW.Log.info("remapStyles: Total remapped = " + remapCount);
        WAW.UI.update("Styles remapped: " + remapCount, 50);

        // --- Step 2: Auto-detect unstyled paragraphs ---
        var autoDetectedCount = 0;
        var unstyledCount = 0;

        // Define patterns for auto-detection
        var chapterPattern = /^(Chapter|CHAPTER|Ch\.?)\s*\d+/i;
        var partPattern = /^(Part|PART)\s*(I|II|III|IV|V|\d)/i;
        var sectionBreakPattern = /^\*\s*\*\s*\*|^—\s*—\s*—|^#\s*#\s*#/;

        // Get unstyled paragraphs
        var allStories = doc.stories.everyItem().getElements();
        var storiesIdx, paragraphsIdx, para, paraText, trimmedText;
        var paraStyleName, paraStyle;

        for (storiesIdx = 0; storiesIdx < allStories.length; storiesIdx++) {
            var story = allStories[storiesIdx];
            var allParagraphs = story.paragraphs.everyItem().getElements();

            for (paragraphsIdx = 0; paragraphsIdx < allParagraphs.length; paragraphsIdx++) {
                para = allParagraphs[paragraphsIdx];
                paraStyle = para.appliedParagraphStyle;
                paraStyleName = paraStyle.name;

                // Check if unstyled
                if (paraStyleName !== "[No paragraph style]" &&
                    paraStyleName !== "Basic Paragraph") {
                    continue; // Already has a proper style
                }

                paraText = para.contents;
                if (typeof paraText !== "string") {
                    paraText = "";
                }
                trimmedText = paraText.replace(/^\s+|\s+$/g, "");

                if (trimmedText.length === 0) {
                    continue; // Skip empty paragraphs
                }

                unstyledCount++;

                // Auto-detect by content
                var detectedStyle = null;

                if (chapterPattern.test(trimmedText)) {
                    detectedStyle = "WAW_Chapter Title";
                } else if (partPattern.test(trimmedText)) {
                    detectedStyle = "WAW_Part Divider";
                } else if (sectionBreakPattern.test(trimmedText)) {
                    detectedStyle = "WAW_Section Break";
                    // Replace with "• • •"
                    para.contents = "\u2022 \u2022 \u2022"; // bullet space bullet space bullet
                } else if (trimmedText.length < 80 &&
                           trimmedText.indexOf("[IMAGE:") !== 0 &&
                           !chapterPattern.test(trimmedText) &&
                           !partPattern.test(trimmedText)) {
                    // Short centered-looking line
                    detectedStyle = "WAW_Centered";
                } else {
                    detectedStyle = "WAW_Body";
                }

                // Apply detected style
                if (detectedStyle) {
                    var detectedStyleObj = doc.paragraphStyles.itemByName(detectedStyle);
                    if (detectedStyleObj.isValid) {
                        para.appliedParagraphStyle = detectedStyleObj;
                        autoDetectedCount++;
                    } else {
                        WAW.Log.warn("remapStyles: Detected style '" + detectedStyle + "' not found.");
                    }
                }
            }
        }

        stats.autoDetected = autoDetectedCount;
        stats.unstyled = unstyledCount - autoDetectedCount;

        WAW.Log.info("remapStyles: Auto-detected = " + autoDetectedCount + ", Remaining unstyled = " + stats.unstyled);
        WAW.UI.update("Auto-detected: " + autoDetectedCount, 60);

        // Restore find/change preferences
        app.findGrepPreferences.properties = savedFindPrefs;
        app.changeGrepPreferences.properties = savedChangePrefs;

        return stats;

    } catch (err) {
        WAW.Log.error("remapStyles: " + err.message + " (Line " + err.line + ")");
        return stats;
    }
};

/**
 * ------------------------------------------------------------------------
 * 3. TEXT CLEANUP
 * ------------------------------------------------------------------------
 */

/**
 * Cleans up imported text by collapsing multiple spaces, fixing punctuation
 * spacing, converting straight quotes to typographic, removing empty
 * paragraphs, and normalizing paragraph returns.
 *
 * @param {Document} doc — The target InDesign document.
 * @returns {Number} Total count of changes made.
 */
WAW.Import.cleanupText = function(doc) {
    WAW.Log.info("=== Cleanup Text ===");

    if (!doc) {
        WAW.Log.error("cleanupText: No document provided.");
        return 0;
    }

    var totalChanges = 0;

    try {
        // Save current find/change preferences
        var savedFindPrefs = app.findGrepPreferences.properties;
        var savedChangePrefs = app.changeGrepPreferences.properties;

        // --- Operation 1: Collapse multiple spaces ---
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = "  +";
        app.changeGrepPreferences.changeTo = " ";

        var result = doc.changeGrep();
        var spaceChanges = result.length;
        totalChanges += spaceChanges;
        WAW.Log.info("cleanupText: Collapsed multiple spaces (" + spaceChanges + " instance(s))");
        WAW.UI.update("Cleaning spaces...", 62);

        // --- Operation 2: Remove spaces before punctuation ---
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = " +([.,;:!?])";
        app.changeGrepPreferences.changeTo = "$1";

        result = doc.changeGrep();
        var punctChanges = result.length;
        totalChanges += punctChanges;
        WAW.Log.info("cleanupText: Fixed space-before-punctuation (" + punctChanges + " instance(s))");

        // --- Operation 3: Fix em-dash spacing ---
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = " -- ";
        app.changeGrepPreferences.changeTo = " \u2014 "; // em dash

        result = doc.changeGrep();
        var dashChanges = result.length;
        totalChanges += dashChanges;
        WAW.Log.info("cleanupText: Fixed em-dashes (" + dashChanges + " instance(s))");

        // --- Operation 4: Fix double hyphens at line breaks too ---
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = "--";
        app.changeGrepPreferences.changeTo = "\u2014"; // em dash

        result = doc.changeGrep();
        var doubleDashChanges = result.length;
        totalChanges += doubleDashChanges;
        if (doubleDashChanges > 0) {
            WAW.Log.info("cleanupText: Converted remaining double hyphens (" + doubleDashChanges + " instance(s))");
        }

        WAW.UI.update("Fixing dashes...", 65);

        // --- Operation 5: Straight quotes to typographic ---
        // Double quotes: opening
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = '(?<=^|[ \\t\\n\\r\\(\\["])"(?=[A-Za-z0-9])';
        app.changeGrepPreferences.changeTo = "\u201C"; // left double quote
        result = doc.changeGrep();
        totalChanges += result.length;

        // Double quotes: closing
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = '"';
        app.changeGrepPreferences.changeTo = "\u201D"; // right double quote
        result = doc.changeGrep();
        totalChanges += result.length;

        // Single quotes / apostrophes: opening
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = "(?<=^|[ \\t\\n\\r\\(\\['\"])'(?=[A-Za-z0-9])";
        app.changeGrepPreferences.changeTo = "\u2018"; // left single quote
        result = doc.changeGrep();
        totalChanges += result.length;

        // Single quotes / apostrophes: closing & possessive
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = "(?<=[A-Za-z0-9.,;:!?])'(?=[A-Za-z0-9]|$|[ \\t\\n\\r.,;:!?\\)])";
        app.changeGrepPreferences.changeTo = "\u2019"; // right single quote
        result = doc.changeGrep();
        totalChanges += result.length;

        // Catch remaining straight single quotes
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = "'";
        app.changeGrepPreferences.changeTo = "\u2019";
        result = doc.changeGrep();
        totalChanges += result.length;

        WAW.Log.info("cleanupText: Converted straight quotes to typographic.");
        WAW.UI.update("Fixing quotes...", 68);

        // --- Operation 6: Remove empty paragraphs (whitespace only) ---
        var emptyParaCount = 0;
        var allStories = doc.stories.everyItem().getElements();
        var si, pi, para, paraText;

        // Process from end to avoid index shifting
        for (si = 0; si < allStories.length; si++) {
            var story = allStories[si];
            var paragraphs = story.paragraphs;
            // Iterate backwards for safe removal
            for (pi = paragraphs.length - 1; pi >= 0; pi--) {
                para = paragraphs[pi];
                paraText = para.contents;
                if (typeof paraText === "string") {
                    var trimmed = paraText.replace(/^\s+|\s+$/g, "");
                    if (trimmed.length === 0) {
                        // Check if this paragraph contains anchored objects
                        var hasAnchored = false;
                        try {
                            if (para.pageItems && para.pageItems.length > 0) {
                                hasAnchored = true;
                            }
                        } catch (e) {
                            // ignore
                        }

                        if (!hasAnchored) {
                            para.remove();
                            emptyParaCount++;
                        }
                    }
                }
            }
        }

        totalChanges += emptyParaCount;
        WAW.Log.info("cleanupText: Removed " + emptyParaCount + " empty paragraph(s).");
        WAW.UI.update("Removing empty paragraphs...", 72);

        // --- Operation 7: Normalize paragraph returns (no more than 2 consecutive) ---
        // Replace 3+ consecutive returns with 2 returns
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = "\\r\\r+";
        app.changeGrepPreferences.changeTo = "\r\r";

        result = doc.changeGrep();
        var returnChanges = result.length;
        totalChanges += returnChanges;
        WAW.Log.info("cleanupText: Normalized paragraph returns (" + returnChanges + " instance(s))");

        // --- Restore find/change preferences ---
        app.findGrepPreferences.properties = savedFindPrefs;
        app.changeGrepPreferences.properties = savedChangePrefs;

        WAW.Log.info("cleanupText: Total changes = " + totalChanges);
        WAW.UI.update("Text cleanup complete.", 75);

        return totalChanges;

    } catch (err) {
        WAW.Log.error("cleanupText: " + err.message + " (Line " + err.line + ")");
        return totalChanges;
    }
};


/**
 * ------------------------------------------------------------------------
 * 4. TABLE FORMATTING
 * ------------------------------------------------------------------------
 */

/**
 * Detects and formats all tables in the document with consistent styling.
 * Applies header row formatting, body row styling, auto-fits columns,
 * and sets table border properties.
 *
 * NEW in v7.0.
 *
 * @param {Document} doc — The target InDesign document.
 * @returns {Number} Number of tables formatted.
 */
WAW.Import.formatTables = function(doc) {
    WAW.Log.info("=== Format Tables ===");

    if (!doc) {
        WAW.Log.error("formatTables: No document provided.");
        return 0;
    }

    var tablesFormatted = 0;

    try {
        // Try to get table styles
        var headerStyle = doc.paragraphStyles.itemByName("WAW_Table Header");
        var bodyStyle = doc.paragraphStyles.itemByName("WAW_Table Body");
        var hasHeaderStyle = headerStyle.isValid;
        var hasBodyStyle = bodyStyle.isValid;

        // Try to get object style for tables
        var tableObjStyle = doc.objectStyles.itemByName("WAW_Table");
        var hasTableObjStyle = tableObjStyle.isValid;

        // Collect all tables from all stories
        var allTables = [];
        var allStories = doc.stories.everyItem().getElements();
        var si, storyTables, ti;

        for (si = 0; si < allStories.length; si++) {
            storyTables = allStories[si].tables.everyItem().getElements();
            for (ti = 0; ti < storyTables.length; ti++) {
                allTables.push(storyTables[ti]);
            }
        }

        if (allTables.length === 0) {
            WAW.Log.info("formatTables: No tables found in document.");
            return 0;
        }

        WAW.Log.info("formatTables: Found " + allTables.length + " table(s).");
        WAW.UI.update("Formatting tables...", 76);

        // Border stroke settings
        var borderStrokeWeight = 0.5; // points
        var borderColor = doc.colors.itemByName("Black");
        if (!borderColor.isValid) {
            // Try to get or create a black color
            try {
                borderColor = doc.colors.add({
                    name: "Black",
                    model: ColorModel.PROCESS,
                    space: ColorSpace.CMYK,
                    colorValue: [0, 0, 0, 100]
                });
            } catch (e) {
                borderColor = doc.swatches.itemByName("Black");
            }
        }

        var headerTint = 20; // 20% tint for header background

        for (ti = 0; ti < allTables.length; ti++) {
            var table = allTables[ti];

            try {
                // --- Apply table borders ---
                table.topBorderStrokeWeight = borderStrokeWeight;
                table.bottomBorderStrokeWeight = borderStrokeWeight;
                table.leftBorderStrokeWeight = borderStrokeWeight;
                table.rightBorderStrokeWeight = borderStrokeWeight;
                table.topBorderColor = borderColor;
                table.bottomBorderColor = borderColor;
                table.leftBorderColor = borderColor;
                table.rightBorderColor = borderColor;

                // --- Auto-fit columns to content ---
                var ci, ri;
                for (ci = 0; ci < table.columns.length; ci++) {
                    table.columns[ci].width = table.columns[ci].width; // trigger auto-fit
                }

                // --- Format rows ---
                var rows = table.rows.everyItem().getElements();

                for (ri = 0; ri < rows.length; ri++) {
                    var row = rows[ri];
                    var isHeaderRow = (ri === 0 && table.headerRowCount > 0);

                    // Row borders
                    row.topBorderStrokeWeight = borderStrokeWeight;
                    row.bottomBorderStrokeWeight = borderStrokeWeight;
                    row.topBorderColor = borderColor;
                    row.bottomBorderColor = borderColor;

                    // Format cells in this row
                    var cells = row.cells.everyItem().getElements();
                    var cellIdx;

                    for (cellIdx = 0; cellIdx < cells.length; cellIdx++) {
                        var cell = cells[cellIdx];

                        // Cell borders
                        cell.topEdgeStrokeWeight = borderStrokeWeight;
                        cell.bottomEdgeStrokeWeight = borderStrokeWeight;
                        cell.leftEdgeStrokeWeight = borderStrokeWeight;
                        cell.rightEdgeStrokeWeight = borderStrokeWeight;
                        cell.topEdgeStrokeColor = borderColor;
                        cell.bottomEdgeStrokeColor = borderColor;
                        cell.leftEdgeStrokeColor = borderColor;
                        cell.rightEdgeStrokeColor = borderColor;

                        // Apply paragraph style
                        var cellPara = cell.paragraphs[0];
                        if (cellPara) {
                            if (isHeaderRow && hasHeaderStyle) {
                                cellPara.appliedParagraphStyle = headerStyle;
                            } else if (hasBodyStyle) {
                                cellPara.appliedParagraphStyle = bodyStyle;
                            }

                            // Header row: make bold
                            if (isHeaderRow) {
                                cellPara.fontStyle = "Bold";
                            }
                        }

                        // Header row background tint
                        if (isHeaderRow) {
                            cell.topEdgeStrokeWeight = borderStrokeWeight * 1.5;
                            cell.bottomEdgeStrokeWeight = borderStrokeWeight * 1.5;
                        }
                    }
                }

                tablesFormatted++;

            } catch (tableErr) {
                WAW.Log.warn("formatTables: Error formatting table " + (ti + 1) + ": " + tableErr.message);
            }
        }

        WAW.Log.info("formatTables: Formatted " + tablesFormatted + " table(s).");
        WAW.UI.update("Tables formatted: " + tablesFormatted, 78);

        return tablesFormatted;

    } catch (err) {
        WAW.Log.error("formatTables: " + err.message + " (Line " + err.line + ")");
        return tablesFormatted;
    }
};

/**
 * ------------------------------------------------------------------------
 * 5. FOOTNOTE / ENDNOTE STYLING
 * ------------------------------------------------------------------------
 */

/**
 * Styles all footnotes and endnotes in the document.
 * Applies paragraph styles, sets separator line options, and spacing.
 *
 * NEW in v7.0.
 *
 * @param {Document} doc — The target InDesign document.
 * @returns {Number} Total count of footnotes + endnotes styled.
 */
WAW.Import.styleFootnotes = function(doc) {
    WAW.Log.info("=== Style Footnotes ===");

    if (!doc) {
        WAW.Log.error("styleFootnotes: No document provided.");
        return 0;
    }

    var notesStyled = 0;

    try {
        // --- Get styles ---
        var footnoteParaStyle = doc.paragraphStyles.itemByName("WAW_Footnote");
        var endnoteParaStyle = doc.paragraphStyles.itemByName("WAW_Endnote");
        var hasFootnoteStyle = footnoteParaStyle.isValid;
        var hasEndnoteStyle = endnoteParaStyle.isValid;

        // --- Style Footnotes ---
        try {
            var allFootnotes = doc.footnotes.everyItem().getElements();
            var fi, fn, fnText, fnParagraphs;

            for (fi = 0; fi < allFootnotes.length; fi++) {
                fn = allFootnotes[fi];

                // Apply paragraph style to footnote text
                if (hasFootnoteStyle) {
                    fnParagraphs = fn.paragraphs.everyItem().getElements();
                    var fpi;
                    for (fpi = 0; fpi < fnParagraphs.length; fpi++) {
                        fnParagraphs[fpi].appliedParagraphStyle = footnoteParaStyle;
                    }
                }

                notesStyled++;
            }

            WAW.Log.info("styleFootnotes: Styled " + allFootnotes.length + " footnote(s).");

        } catch (fnErr) {
            WAW.Log.warn("styleFootnotes: Error processing footnotes: " + fnErr.message);
        }

        // --- Style Endnotes ---
        try {
            var allEndnotes = doc.endnotes.everyItem().getElements();
            var ei, en, enParagraphs;

            for (ei = 0; ei < allEndnotes.length; ei++) {
                en = allEndnotes[ei];

                if (hasEndnoteStyle) {
                    enParagraphs = en.paragraphs.everyItem().getElements();
                    var epi;
                    for (epi = 0; epi < enParagraphs.length; epi++) {
                        enParagraphs[epi].appliedParagraphStyle = endnoteParaStyle;
                    }
                }

                notesStyled++;
            }

            WAW.Log.info("styleFootnotes: Styled " + allEndnotes.length + " endnote(s).");

        } catch (enErr) {
            WAW.Log.warn("styleFootnotes: Error processing endnotes: " + enErr.message);
        }

        // --- Set footnote options ---
        try {
            var fnOptions = doc.footnoteOptions;

            // Separator line
            fnOptions.separatorText = "\u2014"; // em dash
            fnOptions.showSeparator = true;

            // Spacing
            fnOptions.spaceBetween = "2pt";
            fnOptions.spacing = "4pt";

            // Restart numbering per section
            fnOptions.restartNumbering = FootnoteRestarting.PER_SECTION;

            // Footnote text position
            fnOptions.footnoteTextStyle = FootnoteTextStyle.NORMAL;

            WAW.Log.info("styleFootnotes: Footnote options configured.");

        } catch (optErr) {
            WAW.Log.warn("styleFootnotes: Error setting footnote options: " + optErr.message);
        }

        WAW.UI.update("Footnotes styled: " + notesStyled, 80);
        return notesStyled;

    } catch (err) {
        WAW.Log.error("styleFootnotes: " + err.message + " (Line " + err.line + ")");
        return notesStyled;
    }
};

/**
 * ------------------------------------------------------------------------
 * 6. IMAGE PLACEMENT (ANCHORED OBJECTS)
 * ------------------------------------------------------------------------
 */

/**
 * Scans all stories for [IMAGE: filename] placeholders, locates matching
 * image files in a selected folder, and places them as anchored objects
 * that flow with the text thread. Extracts captions from following
 * paragraphs, applies object styles, and runs image preflight checks.
 *
 * @param {Document} doc — The target InDesign document.
 * @returns {Object} Result: { placed: N, missing: [...], warnings: [...] }
 */
WAW.Import.placeImages = function(doc) {
    WAW.Log.info("=== Place Images ===");

    if (!doc) {
        WAW.Log.error("placeImages: No document provided.");
        return { placed: 0, missing: [], warnings: [] };
    }

    var result = {
        placed: 0,
        missing: [],
        warnings: []
    };

    try {
        // --- Folder selection dialog ---
        var defaultFolder = Folder.desktop;
        if (WAW.config && WAW.config.import && WAW.config.import.imageFolder) {
            var cfgImgFolder = new Folder(WAW.config.import.imageFolder);
            if (cfgImgFolder.exists) {
                defaultFolder = cfgImgFolder;
            }
        }

        var imageFolder = Folder.selectDialog("Select the folder containing manuscript images:", defaultFolder);
        if (!imageFolder) {
            WAW.Log.warn("placeImages: No image folder selected. Skipping image placement.");
            return result;
        }

        WAW.Log.info("placeImages: Image folder = " + imageFolder.fsName);
        WAW.UI.update("Scanning for image placeholders...", 82);

        // --- Scan all stories for [IMAGE: ...] placeholders ---
        var placeholders = [];
        var allStories = doc.stories.everyItem().getElements();
        var si, pi, para, paraText;

        var imagePlaceholderRegex = /\[IMAGE:\s*([^\]]+)\]/i;

        for (si = 0; si < allStories.length; si++) {
            var story = allStories[si];
            var paragraphs = story.paragraphs.everyItem().getElements();

            for (pi = 0; pi < paragraphs.length; pi++) {
                para = paragraphs[pi];
                paraText = para.contents;
                if (typeof paraText !== "string") {
                    continue;
                }

                var match = paraText.match(imagePlaceholderRegex);
                if (match) {
                    var imageName = match[1].replace(/^\s+|\s+$/g, ""); // trim
                    placeholders.push({
                        paragraph: para,
                        story: story,
                        imageName: imageName,
                        fullMatch: match[0],
                        paragraphIndex: pi
                    });
                }
            }
        }

        if (placeholders.length === 0) {
            WAW.Log.info("placeImages: No [IMAGE:] placeholders found.");
            return result;
        }

        WAW.Log.info("placeImages: Found " + placeholders.length + " image placeholder(s).");

        // --- Get image frame settings from config ---
        var imageWidth = (WAW.config && WAW.config.image && WAW.config.image.width)
            ? WAW.config.image.width : "80%";
        var imageMaxWidth = (WAW.config && WAW.config.image && WAW.config.image.maxWidth)
            ? WAW.config.image.maxWidth : 432; // 6 inches in points
        var imageObjectStyleName = (WAW.config && WAW.config.image && WAW.config.image.objectStyle)
            ? WAW.config.image.objectStyle : "WAW_Image Frame";
        var minPPI = (WAW.config && WAW.config.preflight && WAW.config.preflight.resolution &&
                      WAW.config.preflight.resolution.minimum)
            ? WAW.config.preflight.resolution.minimum : 150;

        var imageObjStyle = doc.objectStyles.itemByName(imageObjectStyleName);
        var hasObjStyle = imageObjStyle.isValid;

        var captionStyle = doc.paragraphStyles.itemByName("WAW_Image Caption");
        var hasCaptionStyle = captionStyle.isValid;

        // --- Process each placeholder ---
        var phIdx, ph;
        for (phIdx = 0; phIdx < placeholders.length; phIdx++) {
            ph = placeholders[phIdx];

            try {
                WAW.UI.update("Placing image " + (phIdx + 1) + " of " + placeholders.length + "...",
                    82 + Math.floor((phIdx / placeholders.length) * 15));

                // --- Find the image file ---
                var imageFile = WAW.Import._findImageFile(imageFolder, ph.imageName);

                if (!imageFile) {
                    var missingMsg = "Image not found: '" + ph.imageName + "' (placeholder: " + ph.fullMatch + ")";
                    WAW.Log.warn("placeImages: " + missingMsg);
                    result.missing.push({
                        name: ph.imageName,
                        placeholder: ph.fullMatch,
                        reason: "File not found in folder"
                    });
                    continue;
                }

                // --- Extract caption from following paragraph ---
                var captionText = "";
                var captionParagraph = null;
                var paraParent = ph.paragraph.parent;
                var allParasInStory = paraParent.paragraphs;
                var currentParaIdx = ph.paragraph.index;

                // Find the next paragraph
                try {
                    var nextPara = ph.paragraph.insertionPoints[-1].paragraphs[1];
                    if (nextPara && nextPara.isValid) {
                        var nextParaText = nextPara.contents;
                        if (typeof nextParaText === "string") {
                            var trimmedNext = nextParaText.replace(/^\s+|\s+$/g, "");
                            // Check if it's a caption: styled as Caption or short text
                            var isCaptionStyle = false;
                            try {
                                if (nextPara.appliedParagraphStyle) {
                                    var nextStyleName = nextPara.appliedParagraphStyle.name;
                                    if (nextStyleName === "Caption" ||
                                        nextStyleName === "WAW_Image Caption" ||
                                        nextStyleName.indexOf("Caption") >= 0) {
                                        isCaptionStyle = true;
                                    }
                                }
                            } catch (e) {
                                // ignore
                            }

                            if (isCaptionStyle ||
                                (trimmedNext.length < 120 && trimmedNext.indexOf("[IMAGE:") !== 0)) {
                                captionText = trimmedNext;
                                captionParagraph = nextPara;
                            }
                        }
                    }
                } catch (capErr) {
                    // No next paragraph available
                }

                // --- Place as anchored object ---
                var placedImage = WAW.Import._placeAnchoredImage(
                    doc,
                    ph.paragraph,
                    imageFile,
                    imageWidth,
                    imageMaxWidth,
                    hasObjStyle ? imageObjStyle : null,
                    captionText
                );

                if (placedImage) {
                    result.placed++;
                    WAW.Log.info("placeImages: Placed '" + ph.imageName + "' as anchored object.");

                    // --- Remove caption paragraph if extracted ---
                    if (captionParagraph && captionParagraph.isValid) {
                        try {
                            captionParagraph.remove();
                        } catch (remErr) {
                            WAW.Log.warn("placeImages: Could not remove caption paragraph: " + remErr.message);
                        }
                    }

                    // --- Remove the placeholder paragraph text ---
                    try {
                        // Replace the placeholder text with empty content
                        // Keep the paragraph for the anchored object but clear text
                        ph.paragraph.contents = "";
                    } catch (clearErr) {
                        WAW.Log.warn("placeImages: Could not clear placeholder text: " + clearErr.message);
                    }

                    // --- Image Preflight ---
                    var preflightWarnings = WAW.Import._preflightImage(placedImage, minPPI);
                    var wi;
                    for (wi = 0; wi < preflightWarnings.length; wi++) {
                        result.warnings.push({
                            image: ph.imageName,
                            warning: preflightWarnings[wi]
                        });
                    }

                } else {
                    result.missing.push({
                        name: ph.imageName,
                        placeholder: ph.fullMatch,
                        reason: "Placement failed"
                    });
                }

            } catch (phErr) {
                WAW.Log.error("placeImages: Error processing placeholder '" + ph.imageName + "': " + phErr.message);
                result.missing.push({
                    name: ph.imageName,
                    placeholder: ph.fullMatch,
                    reason: "Error: " + phErr.message
                });
            }
        }

        WAW.Log.info("placeImages: " + result.placed + " placed, " +
            result.missing.length + " missing, " + result.warnings.length + " warnings.");
        WAW.UI.update("Images placed: " + result.placed, 97);

        return result;

    } catch (err) {
        WAW.Log.error("placeImages: " + err.message + " (Line " + err.line + ")");
        return result;
    }
};

/**
 * Finds an image file by name in the given folder, trying multiple extensions.
 * @param {Folder} folder — The folder to search.
 * @param {String} imageName — The image filename (with or without extension).
 * @returns {File|null} The found File, or null.
 * @private
 */
WAW.Import._findImageFile = function(folder, imageName) {
    if (!folder || !folder.exists || !imageName) {
        return null;
    }

    // Clean the image name
    imageName = imageName.replace(/^\s+|\s+$/g, "");

    // Check if imageName already has an extension
    var hasExtension = /\.[^.]+$/.test(imageName);

    // Try direct match first
    var testFile = new File(folder + "/" + imageName);
    if (testFile.exists) {
        return testFile;
    }

    // Try case-insensitive direct match
    var folderFiles = folder.getFiles();
    var fi, f;
    for (fi = 0; fi < folderFiles.length; fi++) {
        f = folderFiles[fi];
        if (f instanceof File && f.name.toLowerCase() === imageName.toLowerCase()) {
            return f;
        }
    }

    // If no extension provided, try each extension
    if (!hasExtension) {
        var extIdx;
        for (extIdx = 0; extIdx < WAW.Import.IMAGE_EXTENSIONS.length; extIdx++) {
            var ext = WAW.Import.IMAGE_EXTENSIONS[extIdx];
            testFile = new File(folder + "/" + imageName + ext);
            if (testFile.exists) {
                return testFile;
            }

            // Case-insensitive
            for (fi = 0; fi < folderFiles.length; fi++) {
                f = folderFiles[fi];
                if (f instanceof File &&
                    f.name.toLowerCase() === (imageName + ext).toLowerCase()) {
                    return f;
                }
            }
        }
    }

    // Try partial match (image name might be a substring)
    for (fi = 0; fi < folderFiles.length; fi++) {
        f = folderFiles[fi];
        if (f instanceof File) {
            var fNameLower = f.name.toLowerCase();
            var searchLower = imageName.toLowerCase();
            // Check if filename starts with the image name
            if (fNameLower.indexOf(searchLower) === 0) {
                // Verify it's an image file
                var fExt = "";
                var lastDot = f.name.lastIndexOf(".");
                if (lastDot >= 0) {
                    fExt = f.name.substring(lastDot).toLowerCase();
                }
                var extIdx2;
                for (extIdx2 = 0; extIdx2 < WAW.Import.IMAGE_EXTENSIONS.length; extIdx2++) {
                    if (fExt === WAW.Import.IMAGE_EXTENSIONS[extIdx2]) {
                        return f;
                    }
                }
            }
        }
    }

    return null;
};

/**
 * Places an image as an anchored object attached to the given paragraph.
 * Creates a text frame anchored to the paragraph, places the image inside,
 * and configures the anchored object properties.
 *
 * @param {Document} doc — The target document.
 * @param {Paragraph} paragraph — The placeholder paragraph.
 * @param {File} imageFile — The image file to place.
 * @param {String|Number} imageWidth — Desired width (e.g., "80%" or points).
 * @param {Number} maxWidth — Maximum width in points.
 * @param {ObjectStyle} objStyle — Optional object style to apply.
 * @param {String} captionText — Optional caption text.
 * @returns {Image|null} The placed image object, or null on failure.
 * @private
 */
WAW.Import._placeAnchoredImage = function(doc, paragraph, imageFile, imageWidth, maxWidth, objStyle, captionText) {
    try {
        // Get the text frame and page containing this paragraph
        var textFrame = paragraph.parentTextFrames[0];
        if (!textFrame || !textFrame.isValid) {
            WAW.Log.warn("_placeAnchoredImage: No parent text frame for paragraph.");
            return null;
        }

        var page = textFrame.parentPage;
        if (!page || !page.isValid) {
            WAW.Log.warn("_placeAnchoredImage: No parent page for text frame.");
            return null;
        }

        // Calculate the column width for sizing
        var colWidth = textFrame.geometricBounds[3] - textFrame.geometricBounds[1];

        // Determine actual width
        var actualWidth;
        if (typeof imageWidth === "string" && imageWidth.indexOf("%") >= 0) {
            var pct = parseFloat(imageWidth) / 100;
            actualWidth = colWidth * pct;
        } else {
            actualWidth = parseFloat(imageWidth) || colWidth;
        }

        // Constrain to max width
        if (actualWidth > maxWidth) {
            actualWidth = maxWidth;
        }

        // --- Create anchored text frame via insertion point ---
        var insertionPoint = paragraph.insertionPoints[0];

        // Create a new text frame that will become an anchored object
        var anchoredFrame = page.textFrames.add({
            geometricBounds: [0, 0, actualWidth, actualWidth] // placeholder, will adjust
        });

        // Cut and paste the anchored frame into the insertion point to make it anchored
        anchoredFrame.select();
        app.cut();
        insertionPoint.select();
        app.paste();

        // Get the anchored frame from the insertion point
        var pageItems = paragraph.allPageItems;
        var anchoredItem = null;

        // Find the most recently added anchored item
        if (pageItems && pageItems.length > 0) {
            anchoredItem = pageItems[pageItems.length - 1];
        }

        if (!anchoredItem || !anchoredItem.isValid) {
            WAW.Log.warn("_placeAnchoredImage: Failed to create anchored item.");
            return null;
        }

        // --- Configure anchored object properties ---
        try {
            var anchoredSettings = anchoredItem.anchoredObjectSettings;
            anchoredSettings.anchoredPosition = AnchorPosition.ANCHORED;
            anchoredSettings.spineRelative = false;
            anchoredSettings.lockPosition = false;

            // Reference point and positioning
            anchoredSettings.anchorPoint = AnchorPoint.TOP_CENTER_ANCHOR;
            anchoredSettings.horizontalReferencePoint = AnchoredRelativeTo.COLUMN_EDGE;
            anchoredSettings.horizontalAlignment = HorizontalAlignment.CENTER_ALIGN;
            anchoredSettings.verticalReferencePoint = VerticallyRelativeTo.LINE_BASELINE;

        } catch (anchorErr) {
            WAW.Log.warn("_placeAnchoredImage: Error configuring anchored settings: " + anchorErr.message);
        }

        // --- Place the image into the anchored frame ---
        // NOTE (v7.0.1 fix): After cut/paste, anchoredFrame is stale.
        // The live reference is anchoredItem (retrieved from paragraph.allPageItems).
        var placedItems = anchoredItem.place(imageFile);
        var placedImage = null;

        if (placedItems && placedItems.length > 0) {
            placedImage = placedItems[0];
        }

        if (!placedImage || !placedImage.isValid) {
            WAW.Log.warn("_placeAnchoredImage: Failed to place image file.");
            return null;
        }

        // --- Apply object style ---
        if (objStyle && objStyle.isValid) {
            anchoredItem.applyObjectStyle(objStyle, true);
        }

        // --- Size the image and frame ---
        // Get image natural dimensions
        var imgBounds = placedImage.geometricBounds;
        var imgWidth = imgBounds[3] - imgBounds[1];
        var imgHeight = imgBounds[2] - imgBounds[0];

        if (imgWidth > 0 && imgHeight > 0) {
            // Calculate proportional height
            var scaleFactor = actualWidth / imgWidth;
            var actualHeight = imgHeight * scaleFactor;

            // Set the anchored frame bounds
            var frameBounds = anchoredItem.geometricBounds;
            var centerX = (frameBounds[1] + frameBounds[3]) / 2;
            var newLeft = centerX - (actualWidth / 2);
            var newRight = centerX + (actualWidth / 2);

            anchoredItem.geometricBounds = [
                frameBounds[0],
                newLeft,
                frameBounds[0] + actualHeight,
                newRight
            ];

            // Fit image proportionally
            placedImage.fit(FitOptions.PROPORTIONALLY);
            placedImage.fit(FitOptions.FRAME_TO_CONTENT);
        }

        // --- Add caption if provided ---
        if (captionText && captionText.length > 0) {
            try {
                // Create caption frame below the image
                var captionFrame = page.textFrames.add({
                    geometricBounds: [0, 0, 1, actualWidth], // temp size; repositioned as anchored
                    contents: captionText
                });

                // Style the caption
                if (doc.paragraphStyles.itemByName("WAW_Image Caption").isValid) {
                    captionFrame.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles.itemByName("WAW_Image Caption");
                } else {
                    captionFrame.paragraphs[0].justification = Justification.CENTER_ALIGN;
                    captionFrame.paragraphs[0].pointSize = 9;
                    captionFrame.paragraphs[0].leading = 11;
                }

                // Make caption anchored to the same paragraph, positioned after image
                captionFrame.select();
                app.cut();

                // Insert at end of paragraph
                var endInsertion = paragraph.insertionPoints[-1];
                endInsertion.select();
                app.paste();

                // Configure caption anchored settings
                try {
                    var capPageItems = paragraph.allPageItems;
                    if (capPageItems && capPageItems.length > 1) {
                        var captionAnchored = capPageItems[capPageItems.length - 1];
                        var capSettings = captionAnchored.anchoredObjectSettings;
                        capSettings.anchoredPosition = AnchorPosition.ANCHORED;
                        capSettings.anchorPoint = AnchorPoint.TOP_CENTER_ANCHOR;
                        capSettings.horizontalReferencePoint = AnchoredRelativeTo.COLUMN_EDGE;
                        capSettings.horizontalAlignment = HorizontalAlignment.CENTER_ALIGN;
                    }
                } catch (capAnchorErr) {
                    WAW.Log.warn("_placeAnchoredImage: Error anchoring caption: " + capAnchorErr.message);
                }

            } catch (capErr) {
                WAW.Log.warn("_placeAnchoredImage: Error adding caption: " + capErr.message);
            }
        }

        return placedImage;

    } catch (err) {
        WAW.Log.error("_placeAnchoredImage: " + err.message + " (Line " + err.line + ")");
        return null;
    }
};

/**
 * Runs preflight checks on a placed image and returns warnings.
 *
 * @param {Image} image — The placed image to check.
 * @param {Number} minPPI — Minimum required effective PPI.
 * @returns {Array} Array of warning strings.
 * @private
 */
WAW.Import._preflightImage = function(image, minPPI) {
    var warnings = [];

    if (!image || !image.isValid) {
        warnings.push("Invalid image object for preflight.");
        return warnings;
    }

    try {
        var imageLink = image.itemLink;
        if (!imageLink || !imageLink.isValid) {
            warnings.push("No link information available.");
            return warnings;
        }

        // --- Check Effective PPI ---
        try {
            var effPPI = image.effectivePpi;
            if (effPPI && effPPI.length >= 2) {
                var ppiX = effPPI[0];
                var ppiY = effPPI[1];
                var minEff = Math.min(ppiX, ppiY);

                if (minEff < minPPI) {
                    warnings.push("Effective PPI (" + Math.round(minEff) + ") below minimum (" + minPPI + "). " +
                        "Actual: " + Math.round(ppiX) + " x " + Math.round(ppiY));
                }
            }
        } catch (ppiErr) {
            warnings.push("Could not determine effective PPI: " + ppiErr.message);
        }

        // --- Check Color Space ---
        try {
            var imageFile = new File(imageLink.filePath);
            if (imageFile.exists) {
                // Check color space via link
                var colorSpace = imageLink.linkResourceFormats;
                // Alternative: check image's actual color space
                var imgSpace = image.imageTypeName;

                // Try to get embedded profile info
                var hasProfile = false;
                try {
                    hasProfile = image.extractLabel("profile") ? true : false;
                } catch (e) {
                    // ignore
                }

                if (!hasProfile) {
                    warnings.push("Image may not have an embedded ICC profile.");
                }
            }
        } catch (csErr) {
            warnings.push("Could not determine color space: " + csErr.message);
        }

    } catch (err) {
        warnings.push("Preflight error: " + err.message);
    }

    return warnings;
};

/**
 * ------------------------------------------------------------------------
 * 7. REMOVE REMAINING PLACEHOLDER PARAGRAPHS
 * ------------------------------------------------------------------------
 */

/**
 * Removes any remaining [IMAGE: ...] placeholder paragraphs that were
 * not matched to image files during placeImages().
 *
 * @param {Document} doc — The target InDesign document.
 * @returns {Number} Count of placeholder paragraphs removed.
 */
WAW.Import.removePlaceholderParagraphs = function(doc) {
    WAW.Log.info("=== Remove Placeholder Paragraphs ===");

    if (!doc) {
        WAW.Log.error("removePlaceholderParagraphs: No document provided.");
        return 0;
    }

    var removedCount = 0;

    try {
        var placeholderRegex = /^\s*\[IMAGE:\s*[^\]]+\]\s*$/i;
        var allStories = doc.stories.everyItem().getElements();
        var si, pi, para, paraText;

        // Process each story
        for (si = 0; si < allStories.length; si++) {
            var story = allStories[si];
            var paragraphs = story.paragraphs;

            // Iterate backwards for safe removal
            for (pi = paragraphs.length - 1; pi >= 0; pi--) {
                para = paragraphs[pi];
                paraText = para.contents;

                if (typeof paraText === "string") {
                    if (placeholderRegex.test(paraText)) {
                        // Check if this paragraph has anchored objects (placed images)
                        var hasAnchored = false;
                        try {
                            if (para.allPageItems && para.allPageItems.length > 0) {
                                hasAnchored = true;
                            }
                        } catch (e) {
                            // ignore
                        }

                        // Only remove if no anchored objects (meaning image wasn't placed)
                        if (!hasAnchored) {
                            try {
                                para.remove();
                                removedCount++;
                            } catch (remErr) {
                                WAW.Log.warn("removePlaceholderParagraphs: Could not remove paragraph: " + remErr.message);
                            }
                        }
                    }
                }
            }
        }

        WAW.Log.info("removePlaceholderParagraphs: Removed " + removedCount + " placeholder paragraph(s).");
        WAW.UI.update("Cleaned up " + removedCount + " remaining placeholders.", 99);

        return removedCount;

    } catch (err) {
        WAW.Log.error("removePlaceholderParagraphs: " + err.message + " (Line " + err.line + ")");
        return removedCount;
    }
};

/**
 * ------------------------------------------------------------------------
 * 8. MAIN PIPELINE ORCHESTRATOR
 * ------------------------------------------------------------------------
 */

/**
 * Runs the complete import, process, and place pipeline.
 * This is the main entry point for the module.
 *
 * @param {Document} doc — The target InDesign document.
 * @returns {Object} Pipeline results summary.
 */
WAW.Import.runPipeline = function(doc) {
    WAW.Log.info("========================================");
    WAW.Log.info("WE ARE WOLF v7.0 — Import Pipeline Start");
    WAW.Log.info("========================================");

    var pipelineStart = new Date();
    var results = {
        success: false,
        import: false,
        remapStats: null,
        cleanupChanges: 0,
        tablesFormatted: 0,
        notesStyled: 0,
        imageResults: null,
        placeholdersRemoved: 0,
        errors: [],
        duration: 0
    };

    try {
        if (!doc) {
            WAW.Log.error("runPipeline: No document provided.");
            return results;
        }

        // Step 1: Import manuscript
        WAW.UI.update("Step 1/7: Importing manuscript...", 0);
        results.import = WAW.Import.importManuscript(doc);
        if (!results.import) {
            results.errors.push("Manuscript import failed or was cancelled.");
            WAW.Log.warn("runPipeline: Import step returned false.");
        }

        // Step 2: Remap styles
        WAW.UI.update("Step 2/7: Remapping styles...", 45);
        results.remapStats = WAW.Import.remapStyles(doc);

        // Step 3: Cleanup text
        WAW.UI.update("Step 3/7: Cleaning up text...", 60);
        results.cleanupChanges = WAW.Import.cleanupText(doc);

        // Step 4: Format tables
        WAW.UI.update("Step 4/7: Formatting tables...", 75);
        results.tablesFormatted = WAW.Import.formatTables(doc);

        // Step 5: Style footnotes
        WAW.UI.update("Step 5/7: Styling footnotes...", 78);
        results.notesStyled = WAW.Import.styleFootnotes(doc);

        // Step 6: Place images
        WAW.UI.update("Step 6/7: Placing images...", 82);
        results.imageResults = WAW.Import.placeImages(doc);

        // Step 7: Remove remaining placeholders
        WAW.UI.update("Step 7/7: Removing leftover placeholders...", 95);
        results.placeholdersRemoved = WAW.Import.removePlaceholderParagraphs(doc);

        // Calculate duration
        var pipelineEnd = new Date();
        results.duration = (pipelineEnd - pipelineStart) / 1000;
        results.success = true;

        // Summary log
        WAW.Log.info("========================================");
        WAW.Log.info("Pipeline Complete in " + results.duration + "s");
        WAW.Log.info("  Import:      " + (results.import ? "OK" : "FAILED"));
        WAW.Log.info("  Remapped:    " + (results.remapStats ? results.remapStats.remapped : 0));
        WAW.Log.info("  Auto-detect: " + (results.remapStats ? results.remapStats.autoDetected : 0));
        WAW.Log.info("  Unstyled:    " + (results.remapStats ? results.remapStats.unstyled : 0));
        WAW.Log.info("  Cleanups:    " + results.cleanupChanges);
        WAW.Log.info("  Tables:      " + results.tablesFormatted);
        WAW.Log.info("  Notes:       " + results.notesStyled);
        WAW.Log.info("  Images:      " + (results.imageResults ? results.imageResults.placed : 0) + " placed");
        WAW.Log.info("  Missing:     " + (results.imageResults ? results.imageResults.missing.length : 0));
        WAW.Log.info("  Warnings:    " + (results.imageResults ? results.imageResults.warnings.length : 0));
        WAW.Log.info("  Removed:     " + results.placeholdersRemoved + " placeholders");
        WAW.Log.info("========================================");

        WAW.UI.update("Pipeline complete!", 100);

        return results;

    } catch (err) {
        results.errors.push("Pipeline fatal error: " + err.message);
        WAW.Log.error("runPipeline: FATAL: " + err.message + " (Line " + err.line + ")");
        return results;
    }
};

WAW.Log.info("MODULE 03 [Import] loaded successfully.");


// ============================================================================
// MODULE 03: END
// ============================================================================


// ============================================================================
// MODULE 04: BEGIN
// ============================================================================

/**
 * ============================================================================
 * WE ARE WOLF — InDesign Automation v7.0
 * MODULE 04 — TOC, INDEX & TYPOGRAPHY ENGINE
 * ============================================================================
 *
 * Production-grade typography automation for Adobe InDesign:
 *   - Native/manual TOC generation with live page numbers
 *   - GREP style injection for automatic character formatting
 *   - Nested line styles for structured paragraph formatting
 *   - Comprehensive typography polish (hyphenation, widows, composers)
 *   - Running header text variables
 *   - Intelligent master page application
 *   - Index generation
 *   - Section break detection and conversion
 *
 * @namespace WAW.Typography
 * @requires WAW.config, WAW.Log, WAW.Utils, WAW.UI
 * @version 7.0.0
 * ============================================================================
 */

// Ensure namespace exists
if (typeof WAW === "undefined") { var WAW = {}; }
if (typeof WAW.Typography === "undefined") { WAW.Typography = {}; }

(function () {
    "use strict";

    // ========================================================================
    // LOCAL CONSTANTS
    // ========================================================================

    /** @const {string} Module identifier for logging */
    var MODULE = "04_Typography";

    /** @const {Object} Master page names used throughout */
    var MASTERS = {
        BODY: "A-Body",
        FRONTBACK: "B-FrontBack",
        CHAPTER_OPEN: "C-ChapterOpen",
        BLANK: "D-Blank"
    };

    /** @const {Object} Paragraph style names */
    var STYLES = {
        BODY: "WAW_Body",
        BODY_FIRST: "WAW_Body First",
        CHAPTER_TITLE: "WAW_Chapter Title",
        PART_DIVIDER: "WAW_Part Divider",
        IMAGE_CAPTION: "WAW_Image Caption",
        TOC_TITLE: "WAW_TOC Title",
        TOC_PART: "WAW_TOC Part",
        TOC_CHAPTER: "WAW_TOC Chapter",
        SECTION_BREAK: "WAW_Section Break",
        INDEX_ENTRY: "WAW_Index"
    };

    /** @const {Object} Character style names */
    var CHAR_STYLES = {
        ITALIC: "WAW_Italic",
        BOLD: "WAW_Bold",
        SMALL_CAPS: "WAW_Small Caps"
    };

    // ========================================================================
    // UTILITY FUNCTIONS (module-private)
    // ========================================================================

    /**
     * Safely get a paragraph style by name, returning null if not found.
     * @param {Document} doc — InDesign document
     * @param {string} styleName — Name of paragraph style
     * @returns {ParagraphStyle|null}
     */
    function getParaStyle(doc, styleName) {
        try {
            return doc.paragraphStyles.itemByName(styleName);
        } catch (e) {
            return null;
        }
    }

    /**
     * Safely get a character style by name, creating it if needed.
     * @param {Document} doc — InDesign document
     * @param {string} styleName — Name of character style
     * @returns {CharacterStyle|null}
     */
    function getCharStyle(doc, styleName) {
        try {
            var cs = doc.characterStyles.itemByName(styleName);
            if (cs.isValid) return cs;
        } catch (e) {}
        try {
            return doc.characterStyles.add({ name: styleName });
        } catch (e) {
            WAW.Log.warn("Cannot create character style: " + styleName, MODULE);
            return null;
        }
    }

    /**
     * Check if a paragraph style name is a "display" style (no hyphenation).
     * @param {string} name — Paragraph style name
     * @returns {boolean}
     */
    function isDisplayStyle(name) {
        var displayPatterns = [
            "Title", "Heading", "Subtitle", "Divider",
            "Caption", "TOC", "Epigraph", "Dedication",
            "Copyright", "Section Break"
        ];
        for (var i = 0; i < displayPatterns.length; i++) {
            if (name.indexOf(displayPatterns[i]) !== -1) return true;
        }
        return false;
    }

    /**
     * Check if a paragraph style is a body text style.
     * @param {string} name — Paragraph style name
     * @returns {boolean}
     */
    function isBodyStyle(name) {
        return name.indexOf("Body") !== -1 || name.indexOf("Epigraph") !== -1;
    }

    /**
     * Get the page number text for a given page.
     * @param {Page} page — InDesign page
     * @returns {string}
     */
    function getPageNumberText(page) {
        try {
            return page.name;
        } catch (e) {
            return "" + (page.documentOffset + 1);
        }
    }

    /**
     * Find or create a master spread by name.
     * @param {Document} doc — InDesign document
     * @param {string} masterName — Master spread name
     * @returns {MasterSpread|null}
     */
    function getMasterSpread(doc, masterName) {
        try {
            var ms = doc.masterSpreads.itemByName(masterName);
            if (ms.isValid) return ms;
        } catch (e) {}
        WAW.Log.warn("Master spread not found: " + masterName, MODULE);
        return null;
    }

    /**
     * Find a text frame on a master spread by label or position.
     * @param {MasterSpread} master — Master spread
     * @param {string} label — Frame label to search for
     * @returns {TextFrame|null}
     */
    function getMasterTextFrame(master, label) {
        if (!master || !master.isValid) return null;
        for (var p = 0; p < master.pages.length; p++) {
            var page = master.pages[p];
            for (var t = 0; t < page.textFrames.length; t++) {
                var tf = page.textFrames[t];
                if (tf.label === label) return tf;
            }
        }
        return null;
    }

    /**
     * Convert a page to use a specific master spread.
     * @param {Page} page — Document page
     * @param {MasterSpread} master — Master spread to apply
     */
    function applyMasterToPage(page, master) {
        try {
            if (master && master.isValid) {
                page.appliedMaster = master;
            }
        } catch (e) {
            WAW.Log.warn("Failed to apply master to page: " + e, MODULE);
        }
    }

    /**
     * Create a text frame on a given page with specified geometry.
     * @param {Page} page — Target page
     * @param {Array} geo — [y1, x1, y2, x2] in current units
     * @param {string} label — Optional frame label
     * @returns {TextFrame}
     */
    function createTextFrame(page, geo, label) {
        var tf = page.textFrames.add();
        tf.geometricBounds = geo;
        if (label) tf.label = label;
        return tf;
    }

    // ========================================================================
    // 1. TOC GENERATION
    // ========================================================================

    /**
     * Generates a Table of Contents for the document.
     * Attempts native TOC style approach; falls back to manual TOC with
     * proper page number references, tab leaders, and live update capability.
     *
     * @param {Document} doc — InDesign document
     * @returns {boolean} Success status
     */
    WAW.Typography.generateTOC = function (doc) {
        WAW.Log.info("Generating TOC...", MODULE);
        WAW.UI.update("Generating TOC...", 60);

        try {
            // Ensure required styles exist
            var tocTitleStyle = getParaStyle(doc, STYLES.TOC_TITLE);
            var tocPartStyle = getParaStyle(doc, STYLES.TOC_PART);
            var tocChapterStyle = getParaStyle(doc, STYLES.TOC_CHAPTER);
            var chapterTitleStyle = getParaStyle(doc, STYLES.CHAPTER_TITLE);
            var partDividerStyle = getParaStyle(doc, STYLES.PART_DIVIDER);

            if (!chapterTitleStyle) {
                WAW.Log.error("WAW_Chapter Title style not found. Cannot generate TOC.", MODULE);
                return false;
            }

            // Try native TOC approach first
            var nativeSuccess = tryNativeTOC(doc, tocTitleStyle, tocPartStyle, tocChapterStyle,
                chapterTitleStyle, partDividerStyle);
            if (nativeSuccess) {
                WAW.Log.info("Native TOC generated successfully.", MODULE);
                postProcessTOC(doc);
                return true;
            }

            // Fall back to manual TOC
            WAW.Log.info("Native TOC unavailable, building manual TOC...", MODULE);
            buildManualTOC(doc, tocTitleStyle, tocPartStyle, tocChapterStyle,
                chapterTitleStyle, partDividerStyle);

            postProcessTOC(doc);
            WAW.Log.info("Manual TOC built successfully.", MODULE);
            return true;

        } catch (e) {
            WAW.Log.error("TOC generation failed: " + e, MODULE);
            return false;
        }
    };

    /**
     * Attempt to create TOC using InDesign's native TOC feature.
     * @private
     */
    function tryNativeTOC(doc, tocTitleStyle, tocPartStyle, tocChapterStyle,
                          chapterTitleStyle, partDividerStyle) {
        try {
            // Create or update TOC style
            var tocStyleName = "WAW_TOC_Style";
            var tocStyle = null;

            // Check if TOC style already exists
            for (var i = 0; i < doc.tocStyles.length; i++) {
                if (doc.tocStyles[i].name === tocStyleName) {
                    tocStyle = doc.tocStyles[i];
                    break;
                }
            }

            if (!tocStyle) {
                tocStyle = doc.tocStyles.add({
                    name: tocStyleName,
                    title: "Contents",
                    titleStyle: tocTitleStyle || doc.paragraphStyles[0]
                });
            } else {
                tocStyle.title = "Contents";
                if (tocTitleStyle && tocTitleStyle.isValid) {
                    tocStyle.titleStyle = tocTitleStyle;
                }
            }

            // Configure TOC style entries
            tocStyle.entryStyleSeparators.length = 0;

            // Add entry for Part Dividers
            if (partDividerStyle && partDividerStyle.isValid && tocPartStyle && tocPartStyle.isValid) {
                var partEntry = tocStyle.entryStyleSeparators.add({
                    separatorStyle: partDividerStyle,
                    separatorStyleDestination: tocPartStyle,
                    pageNumberStyle: tocPartStyle,
                    entryAndPageNumberSeparator: "\t",
                    pageNumberPlacement: PageNumberPlacement.AFTER_ENTRY
                });
            }

            // Add entry for Chapter Titles
            if (chapterTitleStyle && chapterTitleStyle.isValid && tocChapterStyle && tocChapterStyle.isValid) {
                var chapterEntry = tocStyle.entryStyleSeparators.add({
                    separatorStyle: chapterTitleStyle,
                    separatorStyleDestination: tocChapterStyle,
                    pageNumberStyle: tocChapterStyle,
                    entryAndPageNumberSeparator: "\t",
                    pageNumberPlacement: PageNumberPlacement.AFTER_ENTRY
                });
            }

            // Generate TOC — insert at beginning
            var tocPage = doc.pages.add(LocationOptions.AT_BEGINNING);
            var masterFB = getMasterSpread(doc, MASTERS.FRONTBACK);
            if (masterFB) applyMasterToPage(tocPage, masterFB);

            // Place TOC on the page
            var placePoint = [0, 0]; // Will be adjusted
            var tocStory = doc.createTOC(tocStyle, true, tocPage, placePoint);

            if (tocStory && tocStory.isValid) {
                // Position the TOC text frame properly
                var tf = tocStory.textContainers[0];
                if (tf) {
                    var pgBounds = tocPage.bounds;
                    var margin = doc.marginPreferences;
                    tf.geometricBounds = [
                        pgBounds[0] + margin.top,
                        pgBounds[1] + margin.left,
                        pgBounds[2] - margin.bottom,
                        pgBounds[3] - margin.right
                    ];
                }
                return true;
            }

            return false;
        } catch (e) {
            WAW.Log.info("Native TOC creation not available: " + e, MODULE);
            return false;
        }
    }

    /**
     * Build a manual TOC by scanning the document for chapter/part entries
     * and constructing a properly formatted TOC with page number references.
     * @private
     */
    function buildManualTOC(doc, tocTitleStyle, tocPartStyle, tocChapterStyle,
                            chapterTitleStyle, partDividerStyle) {
        // Gather TOC entries from document
        var entries = [];

        for (var s = 0; s < doc.stories.length; s++) {
            var story = doc.stories[s];
            for (var p = 0; p < story.paragraphs.length; p++) {
                var para = story.paragraphs[p];
                var styleName = "";
                try { styleName = para.appliedParagraphStyle.name; } catch (e) { continue; }

                if (styleName === STYLES.CHAPTER_TITLE) {
                    var chText = para.contents.replace(/\r/g, "").replace(/\n/g, "");
                    var chPage = "";
                    try {
                        var chPageRef = para.texts[0].parentTextFrames[0].parentPage;
                        chPage = getPageNumberText(chPageRef);
                    } catch (e) { chPage = "?"; }
                    entries.push({ type: "chapter", text: chText, page: chPage });
                } else if (styleName === STYLES.PART_DIVIDER) {
                    var ptText = para.contents.replace(/\r/g, "").replace(/\n/g, "");
                    var ptPage = "";
                    try {
                        var ptPageRef = para.texts[0].parentTextFrames[0].parentPage;
                        ptPage = getPageNumberText(ptPageRef);
                    } catch (e) { ptPage = "?"; }
                    entries.push({ type: "part", text: ptText, page: ptPage });
                }
            }
        }

        WAW.Log.info("Found " + entries.length + " TOC entries.", MODULE);

        if (entries.length === 0) {
            WAW.Log.warn("No chapter/part entries found for TOC.", MODULE);
            return;
        }

        // Insert a TOC page at the beginning
        var tocPage = doc.pages.add(LocationOptions.AT_BEGINNING);
        var masterFB = getMasterSpread(doc, MASTERS.FRONTBACK);
        if (masterFB) applyMasterToPage(tocPage, masterFB);

        // Create text frame for TOC
        var pgBounds = tocPage.bounds;
        var margin = doc.marginPreferences;
        var tf = createTextFrame(tocPage, [
            pgBounds[0] + margin.top,
            pgBounds[1] + margin.left,
            pgBounds[2] - margin.bottom,
            pgBounds[3] - margin.right
        ], "TOC_Frame");

        var insertionPoint = tf.insertionPoints[0];

        // Add "Contents" title
        var contentsTitleStyle = tocTitleStyle || doc.paragraphStyles[0];
        insertionPoint.contents = "Contents\r";
        try {
            tf.paragraphs[0].appliedParagraphStyle = contentsTitleStyle;
        } catch (e) {
            WAW.Log.warn("Could not apply TOC title style.", MODULE);
        }

        // Calculate tab stop position (right-aligned with dot leader)
        var frameWidth = pgBounds[3] - pgBounds[1] - margin.left - margin.right;
        var tabPos = frameWidth;

        // Add TOC entries
        for (var e = 0; e < entries.length; e++) {
            var entry = entries[e];
            var entryStyle = (entry.type === "part") ? tocPartStyle : tocChapterStyle;
            var defaultStyle = doc.paragraphStyles[0];

            // Build entry text with tab and page number
            var entryText = entry.text + "\t" + entry.page + "\r";

            var ip = tf.insertionPoints[-1];
            ip.contents = entryText;

            var paraIdx = tf.paragraphs.length - 1;
            var para = tf.paragraphs[paraIdx];

            // Apply style
            try {
                if (entryStyle && entryStyle.isValid) {
                    para.appliedParagraphStyle = entryStyle;
                }
            } catch (styleErr) {
                WAW.Log.warn("Could not apply TOC entry style: " + styleErr, MODULE);
            }

            // Configure tab stop: right-aligned with dot leader
            try {
                para.tabStops.everyItem().remove();
                para.tabStops.add({
                    alignment: TabStopAlignment.RIGHT_ALIGN,
                    alignmentCharacter: ".",
                    leader: ".",
                    position: tabPos
                });
            } catch (tabErr) {
                WAW.Log.warn("Could not set tab stop: " + tabErr, MODULE);
            }

            // For part entries, add extra space after
            if (entry.type === "part") {
                try {
                    para.spaceAfter = "18 pt";
                    para.spaceBefore = "12 pt";
                } catch (spErr) {}
            }
        }

        // Store entries on the TOC frame for potential live updates
        tf.label = "WAW_TOC_DATA";
    }

    /**
     * Post-process the TOC: ensure styles, fix line breaks, ensure title.
     * @private
     */
    function postProcessTOC(doc) {
        try {
            for (var s = 0; s < doc.stories.length; s++) {
                var story = doc.stories[s];
                for (var t = 0; t < story.textContainers.length; t++) {
                    var tf = story.textContainers[t];
                    if (tf.label === "WAW_TOC_DATA" || tf.label === "TOC_Frame") {
                        // Ensure all paragraphs have proper tab stops
                        for (var p = 0; p < story.paragraphs.length; p++) {
                            var para = story.paragraphs[p];
                            var styleName = "";
                            try { styleName = para.appliedParagraphStyle.name; } catch (e) {}

                            // Add right-aligned tab stop with dot leader if not present
                            if (styleName.indexOf("TOC") !== -1) {
                                var hasRightTab = false;
                                for (var ts = 0; ts < para.tabStops.length; ts++) {
                                    if (para.tabStops[ts].alignment === TabStopAlignment.RIGHT_ALIGN) {
                                        hasRightTab = true;
                                        break;
                                    }
                                }
                                if (!hasRightTab) {
                                    try {
                                        var tfBounds = tf.geometricBounds;
                                        var tabPos = tfBounds[3] - tfBounds[1] - doc.marginPreferences.right;
                                        para.tabStops.add({
                                            alignment: TabStopAlignment.RIGHT_ALIGN,
                                            leader: ".",
                                            position: tabPos
                                        });
                                    } catch (e) {}
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            WAW.Log.warn("TOC post-processing issue: " + e, MODULE);
        }
    }

    // ========================================================================
    // 2. GREP STYLES
    // ========================================================================

    /**
     * Adds GREP styles to key paragraph styles for automatic character formatting.
     * Injects pattern-based character style applications:
     *   - WAW_Body: _italic_, **bold**, ALL CAPS small caps
     *   - WAW_Chapter Title: "CHAPTER" prefix small caps
     *
     * @param {Document} doc — InDesign document
     * @returns {boolean} Success status
     */
    WAW.Typography.applyGREPStyles = function (doc) {
        WAW.Log.info("Applying GREP styles...", MODULE);
        WAW.UI.update("Applying GREP styles...", 70);

        try {
            var bodyStyle = getParaStyle(doc, STYLES.BODY);
            var chapterTitleStyle = getParaStyle(doc, STYLES.CHAPTER_TITLE);
            var italicStyle = getCharStyle(doc, CHAR_STYLES.ITALIC);
            var boldStyle = getCharStyle(doc, CHAR_STYLES.BOLD);
            var smallCapsStyle = getCharStyle(doc, CHAR_STYLES.SMALL_CAPS);

            // --- GREP Styles for WAW_Body ---
            if (bodyStyle && bodyStyle.isValid) {
                addGREPStyle(doc, bodyStyle, italicStyle, "_([^_]+)_");
                addGREPStyle(doc, bodyStyle, smallCapsStyle, "\\b[A-Z]{3,}\\b");
                addGREPStyle(doc, bodyStyle, boldStyle, "\\*\\*([^*]+)\\*\\*");
                WAW.Log.info("GREP styles applied to WAW_Body.", MODULE);
            } else {
                WAW.Log.warn("WAW_Body style not found for GREP styling.", MODULE);
            }

            // --- GREP Styles for WAW_Chapter Title ---
            if (chapterTitleStyle && chapterTitleStyle.isValid) {
                addGREPStyle(doc, chapterTitleStyle, smallCapsStyle, "^Chapter\\s+");
                WAW.Log.info("GREP styles applied to WAW_Chapter Title.", MODULE);
            } else {
                WAW.Log.warn("WAW_Chapter Title style not found for GREP styling.", MODULE);
            }

            WAW.Log.info("GREP styles applied successfully.", MODULE);
            return true;

        } catch (e) {
            WAW.Log.error("applyGREPStyles failed: " + e, MODULE);
            return false;
        }
    };

    /**
     * Add a single GREP style to a paragraph style.
     * Uses nestedGrepStyles property (CS5+) with fallback.
     * @private
     */
    function addGREPStyle(doc, paraStyle, charStyle, grepPattern) {
        if (!paraStyle || !paraStyle.isValid) return;
        if (!charStyle || !charStyle.isValid) return;

        try {
            // In InDesign DOM, GREP styles are accessed via nestedGrepStyles
            // Each entry needs: appliedCharacterStyle + grepExpression
            var ngStyles = paraStyle.nestedGrepStyles;

            // Check if this pattern already exists to avoid duplicates
            var exists = false;
            for (var i = 0; i < ngStyles.length; i++) {
                try {
                    if (ngStyles[i].grepExpression === grepPattern) {
                        exists = true;
                        break;
                    }
                } catch (e) {}
            }

            if (!exists) {
                var newGrep = ngStyles.add();
                newGrep.appliedCharacterStyle = charStyle;
                newGrep.grepExpression = grepPattern;
                WAW.Log.info("  Added GREP: '" + grepPattern + "' -> " + charStyle.name, MODULE);
            } else {
                WAW.Log.info("  GREP pattern already exists: " + grepPattern, MODULE);
            }

        } catch (e) {
            // Fallback: try direct property assignment
            WAW.Log.warn("  Could not add GREP style via nestedGrepStyles: " + e, MODULE);
        }
    }

    // ========================================================================
    // 3. NESTED STYLES
    // ========================================================================

    /**
     * Adds nested line styles to paragraph styles for automatic formatting.
     * Configures:
     *   - WAW_Image Caption: "Figure N." prefix in small caps through first colon/period
     *   - WAW_TOC Chapter: chapter number in small caps through first space
     *
     * @param {Document} doc — InDesign document
     * @returns {boolean} Success status
     */
    WAW.Typography.applyNestedStyles = function (doc) {
        WAW.Log.info("Applying nested styles...", MODULE);
        WAW.UI.update("Applying nested styles...", 72);

        try {
            var smallCapsStyle = getCharStyle(doc, CHAR_STYLES.SMALL_CAPS);

            // --- WAW_Image Caption: "Figure N." in small caps through first colon/period ---
            var captionStyle = getParaStyle(doc, STYLES.IMAGE_CAPTION);
            if (captionStyle && captionStyle.isValid && smallCapsStyle && smallCapsStyle.isValid) {
                addNestedStyle(captionStyle, smallCapsStyle, 1, ".:");
                WAW.Log.info("Nested style applied to WAW_Image Caption.", MODULE);
            }

            // --- WAW_TOC Chapter: chapter number in small caps through first space ---
            var tocChapterStyle = getParaStyle(doc, STYLES.TOC_CHAPTER);
            if (tocChapterStyle && tocChapterStyle.isValid && smallCapsStyle && smallCapsStyle.isValid) {
                addNestedStyle(tocChapterStyle, smallCapsStyle, 1, " ");
                WAW.Log.info("Nested style applied to WAW_TOC Chapter.", MODULE);
            }

            // --- WAW_Part Divider: "PART N" in small caps ---
            var partStyle = getParaStyle(doc, STYLES.PART_DIVIDER);
            if (partStyle && partStyle.isValid && smallCapsStyle && smallCapsStyle.isValid) {
                addNestedStyle(partStyle, smallCapsStyle, 1, " ");
                WAW.Log.info("Nested style applied to WAW_Part Divider.", MODULE);
            }

            WAW.Log.info("Nested styles applied successfully.", MODULE);
            return true;

        } catch (e) {
            WAW.Log.error("applyNestedStyles failed: " + e, MODULE);
            return false;
        }
    };

    /**
     * Add a single nested style to a paragraph style.
     * Uses nestedLineStyles or nestedStyles depending on the delimiter type.
     * @private
     */
    function addNestedStyle(paraStyle, charStyle, repeatCount, throughDelim) {
        if (!paraStyle || !paraStyle.isValid) return;
        if (!charStyle || !charStyle.isValid) return;

        try {
            var nStyles = paraStyle.nestedStyles;

            // Check for existing duplicate
            var exists = false;
            for (var i = 0; i < nStyles.length; i++) {
                try {
                    var ns = nStyles[i];
                    if (ns.appliedCharacterStyle === charStyle) {
                        exists = true;
                        break;
                    }
                } catch (e) {}
            }

            if (!exists) {
                var newNested = nStyles.add();
                newNested.appliedCharacterStyle = charStyle;
                newNested.repetition = repeatCount;
                // Set delimiter
                try {
                    newNested.delimiter = throughDelim;
                } catch (e) {
                    // Some versions use different property names
                    try {
                        newNested.inclusive = false;
                    } catch (e2) {}
                }
                WAW.Log.info("  Added nested style through: '" + throughDelim + "'", MODULE);
            }
        } catch (e) {
            WAW.Log.warn("  Could not add nested style: " + e, MODULE);
        }
    }

    // ========================================================================
    // 4. POLISH TYPOGRAPHY (ENHANCED)
    // ========================================================================

    /**
     * Comprehensive typography polish including hyphenation fine-tuning,
     * widow/orphan control, paragraph composer selection, optical margin
     * alignment, and justification settings.
     *
     * @param {Document} doc — InDesign document
     * @returns {boolean} Success status
     */
    WAW.Typography.polishTypography = function (doc) {
        WAW.Log.info("Polishing typography (v7 enhanced)...", MODULE);
        WAW.UI.update("Polishing typography...", 75);

        try {
            var styles = doc.paragraphStyles;
            var styleCount = styles.length;
            var processed = 0;

            for (var i = 0; i < styleCount; i++) {
                var style = styles[i];
                if (!style.isValid) continue;

                var styleName = "";
                try { styleName = style.name; } catch (e) { continue; }

                // Skip root style
                if (styleName === "[No paragraph style]" || styleName === "[Basic Paragraph]") {
                    continue;
                }

                // --- HYPHENATION ---
                if (isBodyStyle(styleName)) {
                    applyBodyHyphenation(style);
                } else if (isDisplayStyle(styleName)) {
                    disableHyphenation(style);
                }

                // --- WIDOW / ORPHAN CONTROL ---
                if (isBodyStyle(styleName)) {
                    applyWidowOrphanControl(style, 2, 2);
                }

                // --- CHAPTER TITLE SPECIAL HANDLING ---
                if (styleName === STYLES.CHAPTER_TITLE) {
                    try {
                        style.keepWithNext = 2;
                        style.keepAllLinesTogether = true;
                        style.keepFirstLines = 0;
                        style.keepLastLines = 0;
                    } catch (e) {
                        WAW.Log.warn("Could not set chapter title keep options: " + e, MODULE);
                    }
                }

                // --- PART DIVIDER SPECIAL HANDLING ---
                if (styleName === STYLES.PART_DIVIDER) {
                    try {
                        style.keepWithNext = 2;
                    } catch (e) {
                        WAW.Log.warn("Could not set part divider keepWithNext: " + e, MODULE);
                    }
                }

                // --- PARAGRAPH COMPOSER ---
                if (isBodyStyle(styleName)) {
                    try {
                        style.paragraphComposer = "$ID/Adobe Paragraph Composer";
                    } catch (e) {
                        try {
                            style.paragraphComposer = "Adobe Paragraph Composer";
                        } catch (e2) {}
                    }
                }

                // --- JUSTIFICATION SETTINGS (body styles only) ---
                if (isBodyStyle(styleName)) {
                    applyJustificationSettings(style);
                }

                processed++;
                if (processed % 10 === 0) {
                    WAW.UI.update("Polishing typography... (" + processed + "/" + styleCount + ")", 75 + (processed / styleCount) * 10);
                }
            }

            // --- OPTICAL MARGIN ALIGNMENT ---
            applyOpticalMarginAlignment(doc);

            WAW.Log.info("Typography polished for " + processed + " styles.", MODULE);
            return true;

        } catch (e) {
            WAW.Log.error("polishTypography failed: " + e, MODULE);
            return false;
        }
    };

    /**
     * Apply strict hyphenation settings to body paragraph styles.
     * @private
     */
    function applyBodyHyphenation(style) {
        try {
            style.hyphenation = true;
        } catch (e) {}
        try {
            style.hyphenateLastWord = false;
        } catch (e) {}
        try {
            style.hyphenateCapitalizedWords = false;
        } catch (e) {}
        try {
            style.hyphenateWordsLongerThan = 5;
        } catch (e) {}
        try {
            style.hyphenationMinimumWordLength = 5;
        } catch (e) {}
        try {
            style.hyphenationMinimumBeforeFirst = 3;
        } catch (e) {}
        try {
            style.hyphenationMinimumAfterLast = 2;
        } catch (e) {}
        try {
            style.hyphenationLadderLimit = 2;
        } catch (e) {}
        try {
            style.hyphenationZone = "0.25 in";
        } catch (e) {
            try {
                style.hyphenationZone = 18; // ~0.25 inch in points
            } catch (e2) {}
        }
    }

    /**
     * Disable hyphenation on display/caption/TOC styles.
     * @private
     */
    function disableHyphenation(style) {
        try {
            style.hyphenation = false;
        } catch (e) {}
    }

    /**
     * Apply widow/orphan keep line settings.
     * @private
     */
    function applyWidowOrphanControl(style, keepFirst, keepLast) {
        try {
            style.keepFirstLines = keepFirst;
        } catch (e) {}
        try {
            style.keepLastLines = keepLast;
        } catch (e) {}
    }

    /**
     * Apply fine-tuned justification settings to body styles.
     * @private
     */
    function applyJustificationSettings(style) {
        try {
            // Word spacing: 80% / 100% / 150%
            style.minimumWordSpacing = 80;
            style.desiredWordSpacing = 100;
            style.maximumWordSpacing = 150;

            // Letter spacing: -3% / 0% / 3%
            style.minimumLetterSpacing = -3;
            style.desiredLetterSpacing = 0;
            style.maximumLetterSpacing = 3;

            // Glyph scaling: 97% / 100% / 103%
            style.minimumGlyphScaling = 97;
            style.desiredGlyphScaling = 100;
            style.maximumGlyphScaling = 103;
        } catch (e) {
            // Try alternative property names for older versions
            try {
                style.justification = Justification.LEFT_ALIGN;
            } catch (e2) {}
        }
    }

    /**
     * Apply optical margin alignment to all stories in the document.
     * @private
     */
    function applyOpticalMarginAlignment(doc) {
        try {
            var omsaAmount = BODY_SIZE; // reference size in points (matches body text)
            var appliedCount = 0;

            for (var s = 0; s < doc.stories.length; s++) {
                var story = doc.stories[s];
                try {
                    // Apply optical margin alignment to the story
                    story.storyPreferences.opticalMarginAlignment = true;
                    story.storyPreferences.opticalMarginSize = omsaAmount;
                    appliedCount++;
                } catch (e) {
                    // Story-level OMA not available, try text frame level
                    try {
                        for (var tc = 0; tc < story.textContainers.length; tc++) {
                            var container = story.textContainers[tc];
                            if (container.hasOwnProperty("textFramePreferences")) {
                                container.textFramePreferences.opticalMarginAlignment = true;
                                container.textFramePreferences.opticalMarginSize = omsaAmount;
                            }
                        }
                    } catch (e2) {}
                }
            }

            WAW.Log.info("Optical margin alignment applied to " + appliedCount + " stories.", MODULE);
        } catch (e) {
            WAW.Log.warn("Could not apply optical margin alignment: " + e, MODULE);
        }
    }

    // ========================================================================
    // 5. RUNNING HEADERS (ENHANCED)
    // ========================================================================

    /**
     * Configures running header text variables and places them in master page headers.
     * Creates:
     *   - "ChapterHeader" variable (dynamic, linked to WAW_Chapter Title)
     *   - "BookTitle" variable (static "WE ARE WOLF")
     *
     * @param {Document} doc — InDesign document
     * @returns {boolean} Success status
     */
    WAW.Typography.configureRunningHeaders = function (doc) {
        WAW.Log.info("Configuring running headers...", MODULE);
        WAW.UI.update("Configuring running headers...", 85);

        try {
            // --- Create "ChapterHeader" text variable ---
            var chapterVar = createTextVariable(doc, "ChapterHeader", VariableTypes.MATCH_PARAGRAPH_STYLE_TYPE);
            if (chapterVar && chapterVar.isValid) {
                try {
                    chapterVar.variableOptions.appliedParagraphStyle = getParaStyle(doc, STYLES.CHAPTER_TITLE);
                    chapterVar.variableOptions.searchStrategy = SearchStrategies.FIRST_ON_PAGE;
                } catch (e) {
                    WAW.Log.warn("Could not configure ChapterHeader options: " + e, MODULE);
                }
                WAW.Log.info("Text variable 'ChapterHeader' created.", MODULE);
            }

            // --- Create "BookTitle" text variable (static) ---
            var bookTitleVar = createTextVariable(doc, "BookTitle", VariableTypes.CUSTOM_TEXT_TYPE);
            if (bookTitleVar && bookTitleVar.isValid) {
                try {
                    // Custom text type doesn't have variableOptions the same way
                    // For static text, we insert the variable and it displays its name
                    // We'll handle this by inserting custom text directly
                } catch (e) {}
                WAW.Log.info("Text variable 'BookTitle' created.", MODULE);
            }

            // --- Place variables in master page headers ---
            placeRunningHeaders(doc, chapterVar, bookTitleVar);

            WAW.Log.info("Running headers configured.", MODULE);
            return true;

        } catch (e) {
            WAW.Log.error("configureRunningHeaders failed: " + e, MODULE);
            return false;
        }
    };

    /**
     * Create a text variable if it doesn't already exist.
     * @private
     */
    function createTextVariable(doc, varName, varType) {
        try {
            // Check if variable already exists
            for (var i = 0; i < doc.textVariables.length; i++) {
                if (doc.textVariables[i].name === varName) {
                    WAW.Log.info("Text variable '" + varName + "' already exists.", MODULE);
                    return doc.textVariables[i];
                }
            }

            // Create new variable
            var newVar = doc.textVariables.add(varType);
            newVar.name = varName;
            return newVar;

        } catch (e) {
            WAW.Log.warn("Cannot create text variable '" + varName + "': " + e, MODULE);
            return null;
        }
    }

    /**
     * Place running header variables in the A-Body master spread text frames.
     * @private
     */
    function placeRunningHeaders(doc, chapterVar, bookTitleVar) {
        try {
            var bodyMaster = getMasterSpread(doc, MASTERS.BODY);
            if (!bodyMaster) {
                WAW.Log.warn("A-Body master not found for running headers.", MODULE);
                return;
            }

            for (var p = 0; p < bodyMaster.pages.length; p++) {
                var mPage = bodyMaster.pages[p];
                var isRightPage = (p === 1); // Assuming 2-page master: [0]=left, [1]=right

                // Look for existing header text frames
                for (var t = 0; t < mPage.textFrames.length; t++) {
                    var tf = mPage.textFrames[t];
                    var tfLabel = tf.label || "";

                    // Check if this is a header frame (by label or position)
                    var bounds = tf.geometricBounds;
                    var isHeader = tfLabel.indexOf("header") !== -1 ||
                                   tfLabel.indexOf("Header") !== -1 ||
                                   tfLabel.indexOf("running") !== -1 ||
                                   tfLabel.indexOf("Running") !== -1 ||
                                   bounds[0] < bounds[2] && bounds[0] < 30; // Near top of page

                    if (isHeader) {
                        // Clear existing content
                        tf.contents = "";

                        if (isRightPage && chapterVar && chapterVar.isValid) {
                            // Right page: Chapter title
                            tf.insertionPoints[0].textVariableInstances.add(chapterVar);
                        } else if (!isRightPage) {
                            // Left page: Book title (static text or variable)
                            if (bookTitleVar && bookTitleVar.isValid) {
                                tf.insertionPoints[0].contents = "WE ARE WOLF";
                            } else {
                                tf.contents = "WE ARE WOLF";
                            }
                        }

                        // Style the header text
                        try {
                            var headerStyle = doc.paragraphStyles.itemByName("WAW_Header");
                            if (headerStyle && headerStyle.isValid) {
                                for (var paraIdx = 0; paraIdx < tf.paragraphs.length; paraIdx++) {
                                    tf.paragraphs[paraIdx].appliedParagraphStyle = headerStyle;
                                }
                            }
                        } catch (e) {}
                    }
                }
            }
        } catch (e) {
            WAW.Log.warn("Could not place running headers: " + e, MODULE);
        }
    }

    // ========================================================================
    // 6. APPLY MASTERS (ENHANCED)
    // ========================================================================

    /**
     * Intelligently applies master pages based on content analysis.
     * Detects chapter/part openers and front matter, applies appropriate masters:
     *   - B-FrontBack: Front matter pages (no headers/folios)
     *   - C-ChapterOpen: Chapter/part opener pages (folios only)
     *   - D-Blank: Verso blanks before chapter openers
     *   - A-Body: All other pages (full headers + folios)
     *
     * @param {Document} doc — InDesign document
     * @returns {boolean} Success status
     */
    WAW.Typography.applyMasters = function (doc) {
        WAW.Log.info("Applying master pages (enhanced detection)...", MODULE);
        WAW.UI.update("Applying master pages...", 88);

        try {
            var pages = doc.pages;
            var pageCount = pages.length;

            // Step 1: Detect chapter/part pages and front matter end
            var chapterPages = {};
            var firstChapterPageIndex = -1;
            var frontMatterEnd = -1;

            for (var i = 0; i < pageCount; i++) {
                var page = pages[i];
                var pageKey = "" + i;

                // Check all text frames on this page
                for (var tfIdx = 0; tfIdx < page.textFrames.length; tfIdx++) {
                    var tf = page.textFrames[tfIdx];
                    for (var paraIdx = 0; paraIdx < tf.paragraphs.length; paraIdx++) {
                        var para = tf.paragraphs[paraIdx];
                        var styleName = "";
                        try {
                            styleName = para.appliedParagraphStyle.name;
                        } catch (e) { continue; }

                        if (styleName === STYLES.CHAPTER_TITLE || styleName === STYLES.PART_DIVIDER) {
                            chapterPages[pageKey] = true;
                            if (firstChapterPageIndex === -1) {
                                firstChapterPageIndex = i;
                            }
                            // Also mark the next page as chapter-related (for spread awareness)
                            if (i + 1 < pageCount) {
                                chapterPages["" + (i + 1)] = true;
                            }
                        }
                    }
                }
            }

            // Determine front matter end
            if (firstChapterPageIndex > 0) {
                frontMatterEnd = firstChapterPageIndex - 1;
            } else {
                // No chapters found — use default (pages 0-5 or first 6 pages)
                frontMatterEnd = Math.min(5, pageCount - 1);
            }

            WAW.Log.info("Front matter: pages 0-" + frontMatterEnd +
                ", First chapter at page " + firstChapterPageIndex, MODULE);

            // Step 2: Get master spreads
            var masterBody = getMasterSpread(doc, MASTERS.BODY);
            var masterFB = getMasterSpread(doc, MASTERS.FRONTBACK);
            var masterChapter = getMasterSpread(doc, MASTERS.CHAPTER_OPEN);
            var masterBlank = getMasterSpread(doc, MASTERS.BLANK);

            // Step 3: Apply masters page by page
            var appliedCount = { body: 0, frontback: 0, chapter: 0, blank: 0 };

            for (var pgIdx = 0; pgIdx < pageCount; pgIdx++) {
                var currentPage = pages[pgIdx];
                var pageKey = "" + pgIdx;
                var isChapterPage = chapterPages[pageKey] === true;
                var isFrontMatter = (pgIdx <= frontMatterEnd);

                // Check if this is a blank verso before a chapter opener
                var isPreChapterBlank = false;
                if (!isChapterPage && !isFrontMatter && pgIdx > 0) {
                    var nextPageKey = "" + (pgIdx + 1);
                    if (chapterPages[nextPageKey] === true) {
                        // This page is immediately before a chapter page
                        // Only mark as blank if it's a verso (left) page
                        try {
                            // In a facing-pages doc, odd indices are typically recto (right)
                            // and even indices are verso (left)
                            isPreChapterBlank = (pgIdx % 2 === 0); // verso = even index
                        } catch (e) {
                            isPreChapterBlank = true;
                        }
                    }
                }

                // Apply master based on priority
                if (isFrontMatter && masterFB) {
                    applyMasterToPage(currentPage, masterFB);
                    appliedCount.frontback++;
                } else if (isChapterPage && masterChapter) {
                    applyMasterToPage(currentPage, masterChapter);
                    appliedCount.chapter++;
                } else if (isPreChapterBlank && masterBlank) {
                    applyMasterToPage(currentPage, masterBlank);
                    appliedCount.blank++;
                } else if (masterBody) {
                    applyMasterToPage(currentPage, masterBody);
                    appliedCount.body++;
                }
            }

            WAW.Log.info("Masters applied: Body=" + appliedCount.body +
                ", FrontBack=" + appliedCount.frontback +
                ", ChapterOpen=" + appliedCount.chapter +
                ", Blank=" + appliedCount.blank, MODULE);

            return true;

        } catch (e) {
            WAW.Log.error("applyMasters failed: " + e, MODULE);
            return false;
        }
    };

    // ========================================================================
    // 7. INDEX GENERATION
    // ========================================================================

    /**
     * Generates an index for the document. Scans for paragraphs with the
     * WAW_Index style, or searches for index markers, and creates a formatted
     * index section at the end of the document.
     *
     * @param {Document} doc — InDesign document
     * @param {Object} [options] — Optional configuration
     * @returns {boolean} Success status
     */
    WAW.Typography.generateIndex = function (doc, options) {
        WAW.Log.info("Generating index...", MODULE);
        WAW.UI.update("Generating index...", 92);

        options = options || {};

        try {
            var indexEntries = [];

            // Method 1: Scan for paragraphs with WAW_Index style
            for (var s = 0; s < doc.stories.length; s++) {
                var story = doc.stories[s];
                for (var p = 0; p < story.paragraphs.length; p++) {
                    var para = story.paragraphs[p];
                    var styleName = "";
                    try {
                        styleName = para.appliedParagraphStyle.name;
                    } catch (e) { continue; }

                    if (styleName === STYLES.INDEX_ENTRY) {
                        var entryText = para.contents.replace(/\r/g, "").replace(/\n/g, "");
                        var entryPage = "";
                        try {
                            var pgRef = para.texts[0].parentTextFrames[0].parentPage;
                            entryPage = getPageNumberText(pgRef);
                        } catch (e) { entryPage = "?"; }

                        indexEntries.push({
                            text: entryText,
                            page: entryPage,
                            letter: entryText.charAt(0).toUpperCase()
                        });
                    }
                }
            }

            // Method 2: Check for InDesign index markers (index markers)
            try {
                for (var im = 0; im < doc.indexes.length; im++) {
                    var idx = doc.indexes[im];
                    for (var t = 0; t < idx.topics.length; t++) {
                        var topic = idx.topics[t];
                        for (var pgRefIdx = 0; pgRefIdx < topic.pageReferences.length; pgRefIdx++) {
                            var pgRef = topic.pageReferences[pgRefIdx];
                            indexEntries.push({
                                text: topic.name,
                                page: getPageNumberText(pgRef.sourceText.parentTextFrames[0].parentPage),
                                letter: topic.name.charAt(0).toUpperCase()
                            });
                        }
                    }
                }
            } catch (e) {
                WAW.Log.info("No InDesign index markers found, using style-based index.", MODULE);
            }

            if (indexEntries.length === 0) {
                WAW.Log.warn("No index entries found. Skipping index generation.", MODULE);
                return false;
            }

            // Sort entries alphabetically
            indexEntries.sort(function (a, b) {
                var textA = a.text.toLowerCase();
                var textB = b.text.toLowerCase();
                if (textA < textB) return -1;
                if (textA > textB) return 1;
                return 0;
            });

            // Create index page at end of document
            var indexPage = doc.pages.add(LocationOptions.AT_END);
            var masterFB = getMasterSpread(doc, MASTERS.FRONTBACK);
            if (masterFB) applyMasterToPage(indexPage, masterFB);

            // Create text frame
            var pgBounds = indexPage.bounds;
            var margin = doc.marginPreferences;
            var tf = createTextFrame(indexPage, [
                pgBounds[0] + margin.top,
                pgBounds[1] + margin.left,
                pgBounds[2] - margin.bottom,
                pgBounds[3] - margin.right
            ], "WAW_Index_Frame");

            // Add "Index" title
            var titleStyle = getParaStyle(doc, STYLES.TOC_TITLE) || doc.paragraphStyles[0];
            tf.insertionPoints[0].contents = "Index\r";
            try {
                tf.paragraphs[0].appliedParagraphStyle = titleStyle;
            } catch (e) {}

            // Group entries by first letter
            var currentLetter = "";
            var indexStyle = getParaStyle(doc, STYLES.INDEX_ENTRY) || doc.paragraphStyles[0];

            for (var e = 0; e < indexEntries.length; e++) {
                var entry = indexEntries[e];

                // Add letter heading if new letter
                if (entry.letter !== currentLetter) {
                    currentLetter = entry.letter;
                    var letterHeading = currentLetter + "\r";
                    var lhIP = tf.insertionPoints[-1];
                    lhIP.contents = letterHeading;
                    try {
                        var lastPara = tf.paragraphs[tf.paragraphs.length - 1];
                        lastPara.appliedParagraphStyle = titleStyle;
                        lastPara.spaceBefore = "12 pt";
                        lastPara.spaceAfter = "4 pt";
                    } catch (e) {}
                }

                // Add index entry with page number
                var entryLine = entry.text + "\t" + entry.page + "\r";
                var entryIP = tf.insertionPoints[-1];
                entryIP.contents = entryLine;

                try {
                    var entryPara = tf.paragraphs[tf.paragraphs.length - 1];
                    entryPara.appliedParagraphStyle = indexStyle;

                    // Add right-aligned tab stop
                    var frameWidth = pgBounds[3] - pgBounds[1] - margin.left - margin.right;
                    entryPara.tabStops.add({
                        alignment: TabStopAlignment.RIGHT_ALIGN,
                        position: frameWidth
                    });
                } catch (e) {}
            }

            WAW.Log.info("Index generated with " + indexEntries.length + " entries.", MODULE);
            return true;

        } catch (e) {
            WAW.Log.error("generateIndex failed: " + e, MODULE);
            return false;
        }
    };

    // ========================================================================
    // 8. SECTION BREAK DETECTION
    // ========================================================================

    /**
     * Detects horizontal rule patterns in body text (— — —, * * *, # # #)
     * and converts them to WAW_Section Break paragraph style with decorative
     * bullet characters.
     *
     * @param {Document} doc — InDesign document
     * @returns {boolean} Success status
     */
    WAW.Typography.insertSectionBreaks = function (doc) {
        WAW.Log.info("Detecting section breaks...", MODULE);
        WAW.UI.update("Detecting section breaks...", 95);

        try {
            var sectionBreakPatterns = [
                /^\s*[\—\-\–•\*\#]\s+[\—\-\–•\*\#]\s+[\—\-\–•\*\#]\s*$/,
                /^\s*[\—\-\–]{3,}\s*$/,
                /^\s*[\*]{3,}\s*$/,
                /^\s*[\#]{3,}\s*$/,
                /^\s*\*\s+\*\s+\*\s*$/
            ];

            var sectionBreakStyle = getParaStyle(doc, STYLES.SECTION_BREAK);
            var bodyStyle = getParaStyle(doc, STYLES.BODY);
            var convertedCount = 0;

            for (var s = 0; s < doc.stories.length; s++) {
                var story = doc.stories[s];
                for (var p = story.paragraphs.length - 1; p >= 0; p--) {
                    var para = story.paragraphs[p];
                    var paraText = para.contents.replace(/\r/g, "").replace(/\n/g, "");

                    // Check if this paragraph matches a section break pattern
                    var isSectionBreak = false;
                    for (var pat = 0; pat < sectionBreakPatterns.length; pat++) {
                        if (sectionBreakPatterns[pat].test(paraText)) {
                            isSectionBreak = true;
                            break;
                        }
                    }

                    if (isSectionBreak) {
                        try {
                            // Replace content with decorative section break
                            para.contents = "\u2022\u2003\u2022\u2003\u2022"; // bullet + em-space x3

                            // Apply section break style
                            if (sectionBreakStyle && sectionBreakStyle.isValid) {
                                para.appliedParagraphStyle = sectionBreakStyle;
                            }

                            // Center align if style doesn't already do so
                            try {
                                para.justification = Justification.CENTER_ALIGN;
                            } catch (e) {}

                            // Add space before and after
                            try {
                                para.spaceBefore = "18 pt";
                                para.spaceAfter = "18 pt";
                            } catch (e) {}

                            convertedCount++;
                        } catch (e) {
                            WAW.Log.warn("Could not convert section break: " + e, MODULE);
                        }
                    }
                }
            }

            WAW.Log.info("Converted " + convertedCount + " section breaks.", MODULE);
            return true;

        } catch (e) {
            WAW.Log.error("insertSectionBreaks failed: " + e, MODULE);
            return false;
        }
    };

    // ========================================================================
    // 9. TOC UPDATE (NEW — live page number refresh)
    // ========================================================================

    /**
     * Updates the page numbers in a manually-built TOC.
     * Scans the document for current chapter/part page locations and
     * refreshes the TOC text frame with updated references.
     *
     * @param {Document} doc — InDesign document
     * @returns {boolean} Success status
     */
    WAW.Typography.updateTOC = function (doc) {
        WAW.Log.info("Updating TOC page numbers...", MODULE);
        WAW.UI.update("Updating TOC...", 65);

        try {
            // Find the TOC text frame
            var tocFrame = null;
            for (var s = 0; s < doc.stories.length; s++) {
                var story = doc.stories[s];
                for (var t = 0; t < story.textContainers.length; t++) {
                    var tf = story.textContainers[t];
                    if (tf.label === "WAW_TOC_DATA" || tf.label === "TOC_Frame") {
                        tocFrame = tf;
                        break;
                    }
                }
                if (tocFrame) break;
            }

            if (!tocFrame) {
                WAW.Log.warn("No existing TOC found. Run generateTOC first.", MODULE);
                return false;
            }

            // Gather current entries from document
            var currentEntries = [];
            for (var s2 = 0; s2 < doc.stories.length; s2++) {
                var story2 = doc.stories[s2];
                for (var p = 0; p < story2.paragraphs.length; p++) {
                    var para = story2.paragraphs[p];
                    var styleName = "";
                    try { styleName = para.appliedParagraphStyle.name; } catch (e) { continue; }

                    if (styleName === STYLES.CHAPTER_TITLE || styleName === STYLES.PART_DIVIDER) {
                        var entryText = para.contents.replace(/\r/g, "").replace(/\n/g, "");
                        var entryPage = "";
                        try {
                            entryPage = getPageNumberText(para.texts[0].parentTextFrames[0].parentPage);
                        } catch (e) { entryPage = "?"; }
                        currentEntries.push({
                            type: (styleName === STYLES.PART_DIVIDER) ? "part" : "chapter",
                            text: entryText,
                            page: entryPage
                        });
                    }
                }
            }

            // Rebuild TOC contents (preserve title)
            var titlePara = tocFrame.paragraphs[0];
            var titleText = titlePara.contents;
            var titleStyle = null;
            try { titleStyle = titlePara.appliedParagraphStyle; } catch (e) {}

            // Clear all content except title
            while (tocFrame.paragraphs.length > 1) {
                try {
                    tocFrame.paragraphs[tocFrame.paragraphs.length - 1].remove();
                } catch (e) { break; }
            }

            // Get frame width for tab stops
            var tfBounds = tocFrame.geometricBounds;
            var tabPos = tfBounds[3] - tfBounds[1];
            try {
                tabPos -= doc.marginPreferences.right;
            } catch (e) {}

            var tocPartStyle = getParaStyle(doc, STYLES.TOC_PART);
            var tocChapterStyle = getParaStyle(doc, STYLES.TOC_CHAPTER);

            // Add updated entries
            for (var e = 0; e < currentEntries.length; e++) {
                var entry = currentEntries[e];
                var entryStyle = (entry.type === "part") ? tocPartStyle : tocChapterStyle;
                var entryLine = entry.text + "\t" + entry.page + "\r";

                var ip = tocFrame.insertionPoints[-1];
                ip.contents = entryLine;

                try {
                    var para = tocFrame.paragraphs[tocFrame.paragraphs.length - 1];
                    if (entryStyle && entryStyle.isValid) {
                        para.appliedParagraphStyle = entryStyle;
                    }
                    // Add right-aligned tab stop with dot leader
                    para.tabStops.add({
                        alignment: TabStopAlignment.RIGHT_ALIGN,
                        leader: ".",
                        position: tabPos
                    });
                    // Part entries get extra spacing
                    if (entry.type === "part") {
                        para.spaceAfter = "18 pt";
                        para.spaceBefore = "12 pt";
                    }
                } catch (e) {}
            }

            WAW.Log.info("TOC updated with " + currentEntries.length + " entries.", MODULE);
            return true;

        } catch (e) {
            WAW.Log.error("updateTOC failed: " + e, MODULE);
            return false;
        }
    };

    // ========================================================================
    // 10. ORCHESTRATOR — Run All Typography Functions
    // ========================================================================

    /**
     * Runs the complete typography pipeline in the correct sequence.
     * This is the main entry point for the typography engine.
     *
     * Sequence:
     *   1. insertSectionBreaks — detect horizontal rules
     *   2. applyGREPStyles — inject GREP patterns
     *   3. applyNestedStyles — configure nested line styles
     *   4. polishTypography — hyphenation, widows, OMA, justification
     *   5. configureRunningHeaders — create text variables
     *   6. applyMasters — intelligent master page application
     *   7. generateTOC — build table of contents
     *   8. generateIndex — build index (optional)
     *
     * @param {Document} doc — InDesign document
     * @param {Object} [options] — Optional flags
     * @param {boolean} [options.skipIndex=false] — Skip index generation
     * @param {boolean} [options.skipSectionBreaks=false] — Skip section break detection
     * @returns {Object} Results object with success/failure per function
     */
    WAW.Typography.runAll = function (doc, options) {
        options = options || {};
        var results = {};

        WAW.Log.info("=== Typography Engine v7.0 — Starting Pipeline ===", MODULE);
        WAW.UI.update("Typography pipeline starting...", 55);

        // Step 1: Section breaks
        if (!options.skipSectionBreaks) {
            results.sectionBreaks = WAW.Typography.insertSectionBreaks(doc);
        }

        // Step 2: GREP styles
        results.grepStyles = WAW.Typography.applyGREPStyles(doc);

        // Step 3: Nested styles
        results.nestedStyles = WAW.Typography.applyNestedStyles(doc);

        // Step 4: Polish typography
        results.polish = WAW.Typography.polishTypography(doc);

        // Step 5: Running headers
        results.runningHeaders = WAW.Typography.configureRunningHeaders(doc);

        // Step 6: Apply masters
        results.masters = WAW.Typography.applyMasters(doc);

        // Step 7: Generate TOC
        results.toc = WAW.Typography.generateTOC(doc);

        // Step 8: Generate index (optional, may be skipped)
        if (!options.skipIndex) {
            results.index = WAW.Typography.generateIndex(doc);
        }

        // Report summary
        var successCount = 0;
        var totalCount = 0;
        for (var key in results) {
            if (results[key] === true) successCount++;
            totalCount++;
        }

        WAW.Log.info(
            "=== Typography Pipeline Complete: " + successCount + "/" + totalCount +
            " steps successful ===", MODULE
        );
        WAW.UI.update("Typography pipeline complete.", 100);

        return results;
    };

    // ========================================================================
    // MODULE INITIALIZATION
    // ========================================================================

    WAW.Log.info("Typography Engine v7.0 loaded (10 functions).", MODULE);

})();


// ============================================================================
// MODULE 04: END
// ============================================================================


// ============================================================================
// MODULE 05: BEGIN
// ============================================================================

/**
 * ============================================================================
 * WE ARE WOLF — InDesign Automation v7.0
 * Module 05 — EXPORT, PACKAGE & REPORTING
 * ============================================================================
 *
 * Comprehensive export pipeline for Adobe InDesign:
 *   - Full preflight (text, fonts, links, layout)
 *   - Enhanced save with timestamped filenames
 *   - PDF export with preset fallback chain & PDF/X compliance
 *   - IDML backup export
 *   - EPUB reflowable export
 *   - Document packaging for print handoff
 *   - Multi-format reporting (text + HTML)
 *   - Log file archival
 *
 * Depends on: WAW.config, WAW.Log, WAW.Utils, WAW.UI
 *
 * @version 7.0.0
 * @author We Are Wolf Automation
 * @license MIT
 */

// Ensure namespace exists
if (typeof WAW === "undefined") { var WAW = {}; }
if (typeof WAW.Export === "undefined") { WAW.Export = {}; }
if (typeof WAW.Export.Preflight === "undefined") { WAW.Export.Preflight = {}; }

// ============================================================================
// MODULE CONSTANTS
// ============================================================================

/** @const {string} Module version */
WAW.Export.VERSION = "7.0.2";

/** @const {number} Default minimum PPI for print images */
WAW.Export.DEFAULT_MIN_PPI = 300;

/** @const {string} Default PDF preset name */
WAW.Export.DEFAULT_PDF_PRESET = "[Press Quality]";

/** @const {string} Default export filename prefix */
WAW.Export.FILE_PREFIX = "WeAreWolf";

/** @const {Array} PDF preset fallback chain */
WAW.Export.PDF_PRESET_FALLBACKS = [
    "[Press Quality]",
    "[Smallest File Size]",
    "[High Quality Print]",
    "[PDF/X-4:2008]",
    "[PDF/X-1a:2001]",
    "[PDF/X-3:2002]"
];

/** @const {Array} Post-automation checklist items */
WAW.Export.CHECKLIST = [
    "Review PDF for visual accuracy",
    "Verify chapter openers on recto pages",
    "Check image resolution (300+ PPI)",
    "Regenerate live TOC (Layout > Table of Contents)",
    "Verify front matter numbering (roman numerals)",
    "Check for widows/orphans",
    "Package for final handoff",
    "Run preflight panel for final verification"
];

// ============================================================================
// INTERNAL HELPER FUNCTIONS
// ============================================================================

/**
 * Get configuration value with fallback.
 * @param {string} key - Config key path (dot-notation, e.g. "export.pdfPreset")
 * @param {*} defaultValue - Fallback if key not found
 * @returns {*} Config value or default
 */
WAW.Export._getConfig = function(key, defaultValue) {
    try {
        if (typeof WAW !== "undefined" && WAW.config) {
            var keys = key.split(".");
            var val = WAW.config;
            for (var i = 0; i < keys.length; i++) {
                if (val === null || val === undefined) break;
                val = val[keys[i]];
            }
            if (val !== undefined && val !== null) return val;
        }
    } catch (e) {
        // silently fall through
    }
    return defaultValue;
};

/**
 * Format a Date object into YYYY-MM-DD_HH-MM-SS string.
 * @param {Date} date - Date to format
 * @returns {string} Formatted timestamp string
 */
WAW.Export._formatTimestamp = function(date) {
    var y = date.getFullYear();
    var m = ("0" + (date.getMonth() + 1)).slice(-2);
    var d = ("0" + date.getDate()).slice(-2);
    var h = ("0" + date.getHours()).slice(-2);
    var min = ("0" + date.getMinutes()).slice(-2);
    var s = ("0" + date.getSeconds()).slice(-2);
    return y + "-" + m + "-" + d + "_" + h + "-" + min + "-" + s;
};

/**
 * Format current date as readable string.
 * @param {Date} date - Date to format
 * @returns {string} Human-readable date
 */
WAW.Export._formatDate = function(date) {
    var months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
    var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var h = date.getHours();
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    var m = ("0" + date.getMinutes()).slice(-2);
    return days[date.getDay()] + ", " + 
           months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear() +
           " at " + h + ":" + m + " " + ampm;
};

/**
 * Resolve a folder path, creating if needed.
 * @param {string} path - Folder path string (can use ~ for home)
 * @param {boolean} create - Whether to create if not exists
 * @returns {Folder|null} Resolved folder or null
 */
WAW.Export._resolveFolder = function(path, create) {
    try {
        if (!path) return null;
        // Expand tilde
        if (path.charAt(0) === "~") {
            path = Folder.userData.parent.fsName + path.substring(1);
        }
        var folder = new Folder(path);
        if (!folder.exists && create) {
            if (!folder.create()) {
                WAW.Log.warn("Failed to create folder: " + path);
                return null;
            }
        }
        return folder;
    } catch (e) {
        WAW.Log.error("Folder resolution failed: " + e);
        return null;
    }
};

/**
 * Find and return an available PDF export preset.
 * Uses fallback chain from config or defaults.
 * @returns {PDFExportPreset|null} Available preset or null
 */
WAW.Export._findPDFPreset = function() {
    var presetName = WAW.Export._getConfig("export.pdfPreset", WAW.Export.DEFAULT_PDF_PRESET);
    var fallbacks = WAW.Export.PDF_PRESET_FALLBACKS.slice();

    // Insert configured preset at front of chain if not already included (ES3-safe)
    var presetAlreadyIncluded = false;
    for (var fbi = 0; fbi < fallbacks.length; fbi++) {
        if (fallbacks[fbi] === presetName) {
            presetAlreadyIncluded = true;
            break;
        }
    }
    if (!presetAlreadyIncluded) {
        fallbacks.unshift(presetName);
    }

    var allPresets = app.pdfExportPresets;
    var presetNames = [];
    for (var i = 0; i < allPresets.length; i++) {
        presetNames.push(allPresets[i].name);
    }

    for (var j = 0; j < fallbacks.length; j++) {
        var name = fallbacks[j];
        for (var k = 0; k < allPresets.length; k++) {
            if (allPresets[k].name === name) {
                WAW.Log.info("PDF preset selected: " + name);
                return allPresets[k];
            }
        }
    }

    // Last resort: use first available preset
    if (allPresets.length > 0) {
        WAW.Log.warn("No preferred preset found, using: " + allPresets[0].name);
        return allPresets[0];
    }

    WAW.Log.error("No PDF export presets available");
    return null;
};

/**
 * Count placed images in document.
 * @param {Document} doc - InDesign document
 * @returns {number} Count of placed images
 */
WAW.Export._countImages = function(doc) {
    try {
        var count = 0;
        for (var i = 0; i < doc.allGraphics.length; i++) {
            var g = doc.allGraphics[i];
            if (g.itemLink && g.itemLink.status !== LinkStatus.LINK_MISSING) {
                count++;
            }
        }
        return count;
    } catch (e) {
        return 0;
    }
};

/**
 * Count missing images in document.
 * @param {Document} doc - InDesign document
 * @returns {number} Count of missing images
 */
WAW.Export._countMissingImages = function(doc) {
    try {
        var count = 0;
        var allLinks = doc.links;
        for (var i = 0; i < allLinks.length; i++) {
            if (allLinks[i].status === LinkStatus.LINK_MISSING) {
                count++;
            }
        }
        return count;
    } catch (e) {
        return 0;
    }
};

/**
 * Count pages in document (excluding master pages).
 * @param {Document} doc - InDesign document
 * @returns {number} Page count
 */
WAW.Export._countPages = function(doc) {
    try {
        return doc.pages.length;
    } catch (e) {
        return 0;
    }
};

/**
 * Safe string escape for HTML output.
 * @param {string} str - Raw string
 * @returns {string} HTML-escaped string
 */
WAW.Export._escapeHTML = function(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

/**
 * Safe string escape for file paths in HTML.
 * @param {string} str - Raw path string
 * @returns {string} file:// URL
 */
WAW.Export._pathToFileURL = function(str) {
    if (!str) return "";
    var url = String(str).replace(/\\/g, "/");
    if (url.indexOf(":") === 1) {
        url = "/" + url;
    }
    return "file://" + encodeURI(url).replace(/%20/g, " ").replace(/%5C/g, "/");
};


// ============================================================================
// 1. PREFLIGHT MODULE — WAW.Export.Preflight
// ============================================================================

/**
 * Run a comprehensive preflight check on the document.
 * Checks text, fonts, links, and layout issues.
 *
 * @param {Document} doc - The InDesign document to preflight
 * @returns {Object} Preflight results with passed flag, issues array, and summary
 *
 * @example
 * var results = WAW.Export.Preflight.run(app.activeDocument);
 * if (!results.passed) { alert("Preflight failed with " + results.summary.errors + " errors"); }
 */
WAW.Export.Preflight.run = function(doc) {
    WAW.Log.info("Starting preflight check...");
    WAW.UI.update("Preflight", "Checking document...");

    var results = {
        passed: true,
        issues: [],
        summary: { errors: 0, warnings: 0, info: 0 }
    };

    if (!doc || !(doc instanceof Document)) {
        results.issues.push({
            severity: "error",
            category: "general",
            message: "No valid document provided for preflight",
            detail: ""
        });
        results.summary.errors++;
        results.passed = false;
        return results;
    }

    var minPPI = WAW.Export._getConfig("export.minPPI", WAW.Export.DEFAULT_MIN_PPI);

    try {
        // ---- TEXT CHECKS ----
        WAW.Export.Preflight._checkText(doc, results);

        // ---- FONT CHECKS ----
        WAW.Export.Preflight._checkFonts(doc, results);

        // ---- LINK CHECKS ----
        WAW.Export.Preflight._checkLinks(doc, results, minPPI);

        // ---- LAYOUT CHECKS ----
        WAW.Export.Preflight._checkLayout(doc, results);

    } catch (e) {
        results.issues.push({
            severity: "error",
            category: "general",
            message: "Preflight engine error",
            detail: String(e)
        });
        results.summary.errors++;
        WAW.Log.error("Preflight error: " + e);
    }

    // Determine overall pass/fail
    results.passed = results.summary.errors === 0;
    if (results.summary.warnings > 0 && results.passed) {
        WAW.Log.warn("Preflight passed with " + results.summary.warnings + " warning(s)");
    } else if (!results.passed) {
        WAW.Log.error("Preflight FAILED: " + results.summary.errors + " error(s)");
    } else {
        WAW.Log.success("Preflight passed — no issues found");
    }

    WAW.UI.update("Preflight", results.passed ? "Passed" : "Failed");
    return results;
};

/**
 * Check text-related issues: overset, missing glyphs, spelling.
 * @private
 */
WAW.Export.Preflight._checkText = function(doc, results) {
    WAW.Log.info("Checking text...");

    try {
        var stories = doc.stories;
        var oversetCount = 0;
        var oversetPages = [];
        var textOnPasteboard = 0;

        for (var i = 0; i < stories.length; i++) {
            var story = stories[i];

            // Check overset text
            if (story.overflows) {
                oversetCount++;
                var pageName = "unknown";
                try {
                    if (story.textContainers.length > 0) {
                        var tc = story.textContainers[0];
                        if (tc.parentPage) {
                            pageName = tc.parentPage.name;
                        } else {
                            pageName = "pasteboard";
                        }
                    }
                } catch (pe) {
                    pageName = "unknown";
                }
                oversetPages.push(pageName);
            }

            // Check for text on pasteboard
            try {
                for (var tcIdx = 0; tcIdx < story.textContainers.length; tcIdx++) {
                    var container = story.textContainers[tcIdx];
                    if (!container.parentPage && container.contents.length > 0) {
                        textOnPasteboard++;
                    }
                }
            } catch (te) {
                // skip
            }
        }

        if (oversetCount > 0) {
            results.issues.push({
                severity: "error",
                category: "text",
                message: oversetCount + " story(s) have overflow text",
                detail: "Pages affected: " + oversetPages.join(", ")
            });
            results.summary.errors++;
        }

        if (textOnPasteboard > 0) {
            results.issues.push({
                severity: "warning",
                category: "text",
                message: textOnPasteboard + " text frame(s) on pasteboard",
                detail: "Text not on any page may be orphaned content"
            });
            results.summary.warnings++;
        }

    } catch (e) {
        results.issues.push({
            severity: "warning",
            category: "text",
            message: "Could not complete text checks",
            detail: String(e)
        });
        results.summary.warnings++;
    }
};

/**
 * Check font-related issues: missing, substituted, embedding.
 * @private
 */
WAW.Export.Preflight._checkFonts = function(doc, results) {
    WAW.Log.info("Checking fonts...");

    try {
        var fonts = doc.fonts;
        var missingFonts = [];
        var substitutedFonts = [];
        var unembeddableFonts = [];

        for (var i = 0; i < fonts.length; i++) {
            var font = fonts[i];
            var fontName = "";
            try { fontName = font.name; } catch (e) { fontName = "[unknown]"; }

            // Check font status
            try {
                var status = font.status;
                if (status === FontStatus.NOT_AVAILABLE || status === FontStatus.SUBSTITUTED) {
                    missingFonts.push(fontName + " (status: " + status + ")");
                } else if (status === FontStatus.FAUXED || status === FontStatus.INSTALLED) {
                    // Installed is OK; FAUXED may indicate substitution
                    if (status === FontStatus.FAUXED) {
                        substitutedFonts.push(fontName + " (FAUXED)");
                    }
                }
            } catch (se) {
                missingFonts.push(fontName + " (status check failed)");
            }

            // Check embedding permission (best effort)
            try {
                var canEmbed = font.allowEmbedding;
                if (!canEmbed) {
                    unembeddableFonts.push(fontName);
                }
            } catch (ee) {
                // embedding check not available for all fonts
            }
        }

        if (missingFonts.length > 0) {
            results.issues.push({
                severity: "error",
                category: "font",
                message: missingFonts.length + " missing/substituted font(s)",
                detail: missingFonts.join("\n")
            });
            results.summary.errors++;
        }

        if (substitutedFonts.length > 0) {
            results.issues.push({
                severity: "warning",
                category: "font",
                message: substitutedFonts.length + " fauxed font(s) detected",
                detail: substitutedFonts.join("\n")
            });
            results.summary.warnings++;
        }

        if (unembeddableFonts.length > 0) {
            results.issues.push({
                severity: "warning",
                category: "font",
                message: unembeddableFonts.length + " font(s) cannot be embedded",
                detail: "These fonts may cause issues in PDF: " + unembeddableFonts.join(", ")
            });
            results.summary.warnings++;
        }

    } catch (e) {
        results.issues.push({
            severity: "warning",
            category: "font",
            message: "Could not complete font checks",
            detail: String(e)
        });
        results.summary.warnings++;
    }
};

/**
 * Check link-related issues: missing, modified, low-res, RGB, ICC.
 * @private
 */
WAW.Export.Preflight._checkLinks = function(doc, results, minPPI) {
    WAW.Log.info("Checking links (min PPI: " + minPPI + ")...");

    try {
        var links = doc.links;
        var missingLinks = [];
        var modifiedLinks = [];
        var lowResLinks = [];
        var rgbLinks = [];
        var noProfileLinks = [];

        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var linkName = link.name || "[unnamed]";

            // Missing links
            if (link.status === LinkStatus.LINK_MISSING) {
                missingLinks.push(linkName);
                continue; // Skip further checks for missing links
            }

            // Modified links (out of date)
            if (link.status === LinkStatus.LINK_OUT_OF_DATE) {
                modifiedLinks.push(linkName);
            }

            // Check image properties for placed graphics
            try {
                var parent = link.parent;
                if (parent) {
                    // Check effective PPI (resolution)
                    try {
                        var ePPI = parent.effectivePpi;
                        if (ePPI && ePPI.length >= 2) {
                            var hPPI = ePPI[0];
                            var vPPI = ePPI[1];
                            if (hPPI < minPPI || vPPI < minPPI) {
                                lowResLinks.push(linkName + " (" + hPPI + "x" + vPPI + " PPI)");
                            }
                        }
                    } catch (ppiErr) {
                        // Not all links have PPI info
                    }

                    // Check color space
                    try {
                        var imageType = parent.imageTypeName;
                        if (imageType) {
                            // Try to get actual image info
                            var graphic = parent;
                            if (graphic.space) {
                                var space = graphic.space;
                                if (space === ImageColorSpace.RGB || space === ImageColorSpace.sRGB) {
                                    rgbLinks.push(linkName + " (" + space + ")");
                                }
                            }
                            // Check ICC profile
                            try {
                                if (graphic.iccProfileStatus === ICCProfileStatus.ICC_PROFILE_NONE ||
                                    graphic.iccProfileStatus === ICCProfileStatus.ICC_PROFILE_EMBEDDED_NONE) {
                                    noProfileLinks.push(linkName);
                                }
                            } catch (iccErr) {
                                // ICC check not available
                            }
                        }
                    } catch (csErr) {
                        // Not all links have color space info
                    }
                }
            } catch (parentErr) {
                // skip detailed checks
            }
        }

        if (missingLinks.length > 0) {
            results.issues.push({
                severity: "error",
                category: "link",
                message: missingLinks.length + " missing link(s)",
                detail: missingLinks.join("\n")
            });
            results.summary.errors++;
        }

        if (modifiedLinks.length > 0) {
            results.issues.push({
                severity: "warning",
                category: "link",
                message: modifiedLinks.length + " modified/out-of-date link(s)",
                detail: modifiedLinks.join("\n")
            });
            results.summary.warnings++;
        }

        if (lowResLinks.length > 0) {
            results.issues.push({
                severity: "warning",
                category: "link",
                message: lowResLinks.length + " low-resolution image(s) below " + minPPI + " PPI",
                detail: lowResLinks.join("\n")
            });
            results.summary.warnings++;
        }

        if (rgbLinks.length > 0) {
            results.issues.push({
                severity: "warning",
                category: "link",
                message: rgbLinks.length + " RGB image(s) in potentially CMYK workflow",
                detail: rgbLinks.join("\n")
            });
            results.summary.warnings++;
        }

        if (noProfileLinks.length > 0) {
            results.issues.push({
                severity: "info",
                category: "link",
                message: noProfileLinks.length + " image(s) without ICC profile",
                detail: noProfileLinks.join("\n")
            });
            results.summary.info++;
        }

    } catch (e) {
        results.issues.push({
            severity: "warning",
            category: "link",
            message: "Could not complete link checks",
            detail: String(e)
        });
        results.summary.warnings++;
    }
};

/**
 * Check layout-related issues: empty pages, master overrides, baseline grid.
 * @private
 */
WAW.Export.Preflight._checkLayout = function(doc, results) {
    WAW.Log.info("Checking layout...");

    try {
        var pages = doc.pages;
        var emptyPages = [];
        var pagesWithOverrides = [];

        for (var i = 0; i < pages.length; i++) {
            var page = pages[i];

            // Check for empty pages
            try {
                var pageItems = page.pageItems;
                var hasContent = false;
                for (var pi = 0; pi < pageItems.length; pi++) {
                    var item = pageItems[pi];
                    if (item.contents && String(item.contents).length > 0) {
                        hasContent = true;
                        break;
                    }
                    if (item.allGraphics && item.allGraphics.length > 0) {
                        hasContent = true;
                        break;
                    }
                }
                if (!hasContent && pageItems.length === 0) {
                    emptyPages.push(page.name);
                }
            } catch (epErr) {
                // skip
            }

            // Check master page overrides
            try {
                var masterPage = page.appliedMaster;
                if (masterPage) {
                    for (var mi = 0; mi < page.pageItems.length; mi++) {
                        var pgItem = page.pageItems[mi];
                        // Items with overriddenMasterPageItem indicate a master override
                        try {
                            if (pgItem.overriddenMasterPageItem) {
                                pagesWithOverrides.push(page.name);
                                break; // one per page is enough
                            }
                        } catch (ovErr) {
                            // skip
                        }
                    }
                }
            } catch (mpErr) {
                // skip
            }
        }

        if (emptyPages.length > 0) {
            results.issues.push({
                severity: "info",
                category: "layout",
                message: emptyPages.length + " empty page(s)",
                detail: "Pages: " + emptyPages.join(", ")
            });
            results.summary.info++;
        }

        if (pagesWithOverrides.length > 0) {
            results.issues.push({
                severity: "info",
                category: "layout",
                message: pagesWithOverrides.length + " page(s) with master overrides",
                detail: "Pages: " + pagesWithOverrides.join(", ")
            });
            results.summary.info++;
        }

        // Baseline grid check
        try {
            var gridEnabled = doc.gridData;
            if (gridEnabled && gridEnabled.gridRelativeOption) {
                // Check if any paragraphs don't use baseline grid
                var misaligned = 0;
                for (var sIdx = 0; sIdx < doc.stories.length; sIdx++) {
                    var story = doc.stories[sIdx];
                    for (var pIdx = 0; pIdx < story.paragraphs.length; pIdx++) {
                        var para = story.paragraphs[pIdx];
                        try {
                            if (para.gridAlignment && para.gridAlignment === GridAlignment.ALIGN_NONE) {
                                misaligned++;
                            }
                        } catch (gaErr) {
                            // skip
                        }
                    }
                }
                if (misaligned > 0) {
                    results.issues.push({
                        severity: "info",
                        category: "layout",
                        message: misaligned + " paragraph(s) not aligned to baseline grid",
                        detail: "Baseline grid is enabled but some paragraphs are set to ALIGN_NONE"
                    });
                    results.summary.info++;
                }
            }
        } catch (bgErr) {
            // baseline grid check not critical
        }

    } catch (e) {
        results.issues.push({
            severity: "warning",
            category: "layout",
            message: "Could not complete layout checks",
            detail: String(e)
        });
        results.summary.warnings++;
    }
};


// ============================================================================
// 2. ENHANCED SAVE — WAW.Export.saveDocument
// ============================================================================

/**
 * Save the document with a timestamped filename.
 * Creates output directory if needed.
 *
 * @param {Document} doc - The InDesign document to save
 * @param {Object} [options] - Save options
 * @param {boolean} [options.includeVersion=false] - Include version in filename
 * @param {string} [options.suffix=""] - Additional filename suffix
 * @returns {string|null} Full path of saved file, or null on failure
 *
 * @example
 * var path = WAW.Export.saveDocument(doc, { includeVersion: true });
 * // Saves: WeAreWolf_v7.0_2025-01-15_14-30-22.indd
 */
WAW.Export.saveDocument = function(doc, options) {
    options = options || {};
    WAW.Log.info("Saving document...");
    WAW.UI.update("Save", "Saving INDD...");

    try {
        var exportDir = WAW.Export._getConfig("export.exportDir", "~/Desktop/WeAreWolf_Output/");
        var folder = WAW.Export._resolveFolder(exportDir, true);
        if (!folder) {
            WAW.Log.error("Cannot create or access export directory: " + exportDir);
            return null;
        }

        var prefix = WAW.Export._getConfig("export.filePrefix", WAW.Export.FILE_PREFIX);
        var timestamp = WAW.Export._formatTimestamp(new Date());
        var suffix = options.suffix || "";

        var filename = prefix;
        if (options.includeVersion) {
            filename += "_v" + WAW.Export.VERSION.replace(/\./g, "-");
        }
        filename += "_" + timestamp;
        if (suffix) {
            filename += "_" + suffix;
        }
        filename += ".indd";

        var file = new File(folder.fsName + "/" + filename);
        doc.save(file);

        WAW.Log.success("Document saved: " + file.fsName);
        WAW.UI.update("Save", "Saved");
        return file.fsName;

    } catch (e) {
        WAW.Log.error("Save failed: " + e);
        WAW.UI.update("Save", "Failed");
        return null;
    }
};


// ============================================================================
// 3. ENHANCED PDF EXPORT — WAW.Export.exportPDF
// ============================================================================

/**
 * Export the document as PDF with full configuration and preset fallback.
 * Supports both print and interactive PDF variants.
 *
 * @param {Document} doc - The InDesign document to export
 * @param {Object} [options] - PDF export options
 * @param {string} [options.variant="print"] - "print" or "interactive"
 * @param {boolean} [options.cropMarks=false] - Include crop marks
 * @param {boolean} [options.bleedMarks=false] - Include bleed marks
 * @param {boolean} [options.regMarks=false] - Include registration marks
 * @param {string} [options.suffix=""] - Additional filename suffix
 * @returns {string|null} Full path of exported PDF, or null on failure
 *
 * @example
 * var pdfPath = WAW.Export.exportPDF(doc, { cropMarks: true, bleedMarks: true });
 */
WAW.Export.exportPDF = function(doc, options) {
    options = options || {};
    var variant = options.variant || "print";
    WAW.Log.info("Exporting PDF (" + variant + ")...");
    WAW.UI.update("PDF Export", "Exporting...");

    try {
        // Resolve export directory
        var exportDir = WAW.Export._getConfig("export.exportDir", "~/Desktop/WeAreWolf_Output/");
        var folder = WAW.Export._resolveFolder(exportDir, true);
        if (!folder) {
            WAW.Log.error("Cannot access export directory for PDF");
            return null;
        }

        // Find PDF preset
        var preset = WAW.Export._findPDFPreset();
        if (!preset) {
            WAW.Log.error("No PDF preset available");
            return null;
        }

        // Build filename
        var prefix = WAW.Export._getConfig("export.filePrefix", WAW.Export.FILE_PREFIX);
        var timestamp = WAW.Export._formatTimestamp(new Date());
        var suffix = options.suffix || "";
        var variantLabel = variant === "interactive" ? "_interactive" : "_print";
        var filename = prefix + "_" + timestamp + variantLabel;
        if (suffix) { filename += "_" + suffix; }
        filename += ".pdf";

        var file = new File(folder.fsName + "/" + filename);

        if (variant === "interactive") {
            // ---- INTERACTIVE PDF EXPORT ----
            var interactivePrefs = app.interactivePDFExportPreferences;

            // Page range: all pages
            interactivePrefs.pageRange = PageRange.ALL_PAGES;

            // Export layers
            interactivePrefs.exportLayers = false;

            // Export as spreads or pages
            interactivePrefs.exportReaderSpreads = false;

            // Generate thumbnails
            interactivePrefs.generateThumbnails = true;

            // View PDF after export
            interactivePrefs.viewPDF = false;

            // Export
            doc.exportFile(ExportFormat.INTERACTIVE_PDF, file);

        } else {
            // ---- PRINT PDF EXPORT ----
            var pdfPrefs = app.pdfExportPreferences;

            // Page range
            pdfPrefs.pageRange = PageRange.ALL_PAGES;

            // Acrobat compatibility
            try {
                pdfPrefs.acrobatCompatibility = AcrobatCompatibility.ACROBAT_7;
            } catch (acErr) {
                WAW.Log.warn("Could not set Acrobat 7 compatibility: " + acErr);
            }

            // PDF/X compliance (best effort)
            try {
                pdfPrefs.pdfDestinationProfile = PDFProfile.PDFX_4_2008;
                pdfPrefs.omitICCs = false;
            } catch (pxErr) {
                WAW.Log.warn("PDF/X-4 not available, trying PDF/X-1a...");
                try {
                    pdfPrefs.pdfDestinationProfile = PDFProfile.PDFX_1A_2001;
                } catch (px1aErr) {
                    WAW.Log.warn("PDF/X compliance not available: " + px1aErr);
                }
            }

            // Marks and bleeds
            var cropFromConfig = WAW.Export._getConfig("export.cropMarks", false);
            var bleedFromConfig = WAW.Export._getConfig("export.bleedMarks", false);
            var regFromConfig = WAW.Export._getConfig("export.regMarks", false);

            try {
                pdfPrefs.cropMarks = options.cropMarks || cropFromConfig;
                pdfPrefs.bleedMarks = options.bleedMarks || bleedFromConfig;
                pdfPrefs.registrationMarks = options.regMarks || regFromConfig;
            } catch (marksErr) {
                WAW.Log.warn("Could not set PDF marks: " + marksErr);
            }

            // Bleed settings — use document bleed
            try {
                var docBleed = doc.documentPreferences.documentBleedBottomOffset;
                if (docBleed > 0) {
                    pdfPrefs.useDocumentBleedWithPDF = true;
                    pdfPrefs.bleedTop = docBleed;
                    pdfPrefs.bleedBottom = docBleed;
                    pdfPrefs.bleedInside = doc.documentPreferences.documentBleedInsideOrLeftOffset || docBleed;
                    pdfPrefs.bleedOutside = doc.documentPreferences.documentBleedTopOffset || docBleed;
                }
            } catch (bleedErr) {
                WAW.Log.warn("Could not set PDF bleed: " + bleedErr);
            }

            // Color — CMYK output, no RGB conversion
            try {
                pdfPrefs.colorBitmapSampling = Sampling.BICUBIC_DOWNSAMPLE;
                pdfPrefs.colorBitmapSamplingDPI = 300;
                pdfPrefs.colorCompression = BitmapCompression.ZIP;
                pdfPrefs.colorTileSize = 128;
            } catch (colorErr) {
                // Compression settings vary by preset
            }

            // Grayscale images
            try {
                pdfPrefs.grayscaleBitmapSampling = Sampling.BICUBIC_DOWNSAMPLE;
                pdfPrefs.grayscaleBitmapSamplingDPI = 300;
                pdfPrefs.grayscaleCompression = BitmapCompression.ZIP;
                pdfPrefs.grayscaleTileSize = 128;
            } catch (grayErr) {
                // ignore
            }

            // Monochrome images
            try {
                pdfPrefs.monochromeBitmapSampling = Sampling.BICUBIC_DOWNSAMPLE;
                pdfPrefs.monochromeBitmapSamplingDPI = 1200;
            } catch (monoErr) {
                // ignore
            }

            // Font embedding
            try {
                pdfPrefs.subsetFontsBelow = 0; // Subset all fonts
            } catch (subErr) {
                // ignore
            }

            // Do not export layers, guides, grids
            try {
                pdfPrefs.exportLayers = false;
                pdfPrefs.exportGuidesAndGrids = false;
            } catch (layerErr) {
                // ignore
            }

            // Do not export reader spreads
            try {
                pdfPrefs.exportReaderSpreads = false;
            } catch (spreadErr) {
                // ignore
            }

            // Include hyperlinks
            try {
                pdfPrefs.includeHyperlinks = true;
            } catch (linkErr) {
                // ignore
            }

            // Do not view PDF after export
            try {
                pdfPrefs.viewPDF = false;
            } catch (viewErr) {
                // ignore
            }

            // Export using the selected preset
            doc.exportFile(ExportFormat.PDF_TYPE, file, false, preset);
        }

        WAW.Log.success("PDF exported: " + file.fsName);
        WAW.UI.update("PDF Export", "Done");
        return file.fsName;

    } catch (e) {
        WAW.Log.error("PDF export failed: " + e);
        WAW.UI.update("PDF Export", "Failed");
        return null;
    }
};


// ============================================================================
// 4. IDML EXPORT — WAW.Export.exportIDML
// ============================================================================

/**
 * Export the document as IDML for backward compatibility and version control.
 *
 * @param {Document} doc - The InDesign document to export
 * @param {Object} [options] - IDML export options
 * @param {string} [options.suffix=""] - Additional filename suffix
 * @returns {string|null} Full path of exported IDML, or null on failure
 *
 * @example
 * var idmlPath = WAW.Export.exportIDML(doc);
 */
WAW.Export.exportIDML = function(doc, options) {
    options = options || {};
    WAW.Log.info("Exporting IDML...");
    WAW.UI.update("IDML Export", "Exporting...");

    try {
        var exportDir = WAW.Export._getConfig("export.exportDir", "~/Desktop/WeAreWolf_Output/");
        var folder = WAW.Export._resolveFolder(exportDir, true);
        if (!folder) {
            WAW.Log.error("Cannot access export directory for IDML");
            return null;
        }

        var prefix = WAW.Export._getConfig("export.filePrefix", WAW.Export.FILE_PREFIX);
        var timestamp = WAW.Export._formatTimestamp(new Date());
        var suffix = options.suffix || "";
        var filename = prefix + "_" + timestamp;
        if (suffix) { filename += "_" + suffix; }
        filename += ".idml";

        var file = new File(folder.fsName + "/" + filename);

        doc.exportFile(ExportFormat.INDESIGN_MARKUP, file);

        WAW.Log.success("IDML exported: " + file.fsName);
        WAW.UI.update("IDML Export", "Done");
        return file.fsName;

    } catch (e) {
        WAW.Log.error("IDML export failed: " + e);
        WAW.UI.update("IDML Export", "Failed");
        return null;
    }
};


// ============================================================================
// 5. EPUB EXPORT — WAW.Export.exportEPUB
// ============================================================================

/**
 * Export the document as a reflowable EPUB for digital distribution.
 * Sets preferences for content ordering, image optimization, and metadata.
 *
 * @param {Document} doc - The InDesign document to export
 * @param {Object} [options] - EPUB export options
 * @param {string} [options.suffix=""] - Additional filename suffix
 * @returns {string|null} Full path of exported EPUB, or null on failure
 *
 * @example
 * var epubPath = WAW.Export.exportEPUB(doc);
 */
WAW.Export.exportEPUB = function(doc, options) {
    options = options || {};
    WAW.Log.info("Exporting EPUB...");
    WAW.UI.update("EPUB Export", "Exporting...");

    try {
        var exportDir = WAW.Export._getConfig("export.exportDir", "~/Desktop/WeAreWolf_Output/");
        var folder = WAW.Export._resolveFolder(exportDir, true);
        if (!folder) {
            WAW.Log.error("Cannot access export directory for EPUB");
            return null;
        }

        var prefix = WAW.Export._getConfig("export.filePrefix", WAW.Export.FILE_PREFIX);
        var timestamp = WAW.Export._formatTimestamp(new Date());
        var suffix = options.suffix || "";
        var filename = prefix + "_" + timestamp;
        if (suffix) { filename += "_" + suffix; }
        filename += ".epub";

        var file = new File(folder.fsName + "/" + filename);

        // Set EPUB export preferences
        var epubPrefs = app.epubExportPreferences;

        // Content order — based on page layout
        try {
            epubPrefs.contentOrder = EpubContentOrder.LAYOUT_ORDER;
        } catch (coErr) {
            // fallback: try legacy constant
            try {
                epubPrefs.contentOrder = ContentOrder.LAYOUT_ORDER;
            } catch (co2Err) {
                WAW.Log.warn("Could not set EPUB content order");
            }
        }

        // Image settings — optimized for e-readers
        try {
            epubPrefs.imageExportResolution = ImageResolution.PPI_150;
            epubPrefs.imageSpaceAfter = 0;
            epubPrefs.imageAlignment = ImageAlignmentType.ALIGN_LEFT;
        } catch (imgErr) {
            WAW.Log.warn("Could not set EPUB image prefs: " + imgErr);
        }

        // Image conversion settings
        try {
            epubPrefs.imageConversion = ImageConversion.AUTOMATIC;
            epubPrefs.imageExportResolution = ImageResolution.PPI_150;
            epubPrefs.customImageSizeOption = ImageSizeOption.SIZE_RELATIVE_TO_PAGE_WIDTH;
            epubPrefs.imageAlignment = ImageAlignmentType.ALIGN_CENTER;
            epubPrefs.imageSpaceBefore = 0;
            epubPrefs.imageSpaceAfter = 0;
        } catch (imgConvErr) {
            // Image conversion settings vary by InDesign version
        }

        // Table of contents
        try {
            epubPrefs.tocStyleName = "";
            // Include generated TOC if available
            if (doc.tocStyles && doc.tocStyles.length > 0) {
                epubPrefs.tocStyleName = doc.tocStyles[0].name;
            }
        } catch (tocErr) {
            WAW.Log.warn("Could not set EPUB TOC: " + tocErr);
        }

        // Metadata — title and author from document
        try {
            if (doc.metadataPreferences) {
                var meta = doc.metadataPreferences;
                if (meta.documentTitle) {
                    epubPrefs.id = meta.documentTitle;
                }
                if (meta.author) {
                    // Author metadata may not be directly settable on epub prefs
                }
            }
        } catch (metaErr) {
            // metadata not critical
        }

        // CSS — include basic styling
        try {
            epubPrefs.preserveLayoutAppearence = false;
            epubPrefs.embedFonts = false; // ePub uses system fonts
        } catch (cssErr) {
            // CSS settings vary by InDesign version
        }

        // Break document at paragraph styles (for chapters)
        try {
            epubPrefs.splitDocument = EpubSplitDocument.BASED_ON_PARAGRAPH_STYLE;
        } catch (splitErr) {
            try {
                epubPrefs.splitDocument = true;
            } catch (split2Err) {
                // ignore
            }
        }

        // Cover — use first page or none
        try {
            epubPrefs.cover = EpubCover.FIRST_PAGE;
        } catch (coverErr) {
            // cover setting may vary
        }

        // Export EPUB
        doc.exportFile(ExportFormat.EPUB, file);

        WAW.Log.success("EPUB exported: " + file.fsName);
        WAW.UI.update("EPUB Export", "Done");
        return file.fsName;

    } catch (e) {
        WAW.Log.error("EPUB export failed: " + e);
        WAW.UI.update("EPUB Export", "Failed");
        return null;
    }
};


// ============================================================================
// 6. DOCUMENT PACKAGING — WAW.Export.packageDocument
// ============================================================================

/**
 * Package the document for print handoff.
 * Copies linked graphics, fonts, and generates a package report.
 *
 * @param {Document} doc - The InDesign document to package
 * @param {Object} [options] - Packaging options
 * @param {boolean} [options.copyLinks=true] - Copy linked graphics
 * @param {boolean} [options.copyFonts=true] - Copy fonts (within license)
 * @param {boolean} [options.updateLinks=true] - Update graphic links
 * @param {boolean} [options.includeReport=true] - Include package report
 * @param {string} [options.suffix=""] - Additional folder name suffix
 * @returns {string|null} Full path of package folder, or null on failure
 *
 * @example
 * var pkgPath = WAW.Export.packageDocument(doc, { copyFonts: true, copyLinks: true });
 */
WAW.Export.packageDocument = function(doc, options) {
    options = options || {};
    WAW.Log.info("Packaging document...");
    WAW.UI.update("Package", "Packaging...");

    try {
        var exportDir = WAW.Export._getConfig("export.exportDir", "~/Desktop/WeAreWolf_Output/");
        var parentFolder = WAW.Export._resolveFolder(exportDir, true);
        if (!parentFolder) {
            WAW.Log.error("Cannot access export directory for packaging");
            return null;
        }

        // Build package folder name
        var prefix = WAW.Export._getConfig("export.filePrefix", WAW.Export.FILE_PREFIX);
        var timestamp = WAW.Export._formatTimestamp(new Date());
        var suffix = options.suffix || "";
        var folderName = prefix + "_Package_" + timestamp;
        if (suffix) { folderName += "_" + suffix; }

        var pkgFolder = new Folder(parentFolder.fsName + "/" + folderName);
        if (!pkgFolder.create()) {
            WAW.Log.error("Failed to create package folder: " + pkgFolder.fsName);
            return null;
        }

        // Build INDD filename inside package
        var inddName = prefix + "_" + timestamp + ".indd";
        var pkgFile = new File(pkgFolder.fsName + "/" + inddName);

        // Set package preferences
        var pkgPrefs = app.packageForPrintPreferences;

        // Copy linked graphics
        try {
            pkgPrefs.copyLinkedGraphics = (options.copyLinks !== false);
        } catch (e) {
            WAW.Log.warn("Could not set copyLinkedGraphics preference");
        }

        // Copy fonts
        try {
            pkgPrefs.copyFonts = (options.copyFonts !== false);
        } catch (e) {
            WAW.Log.warn("Could not set copyFonts preference");
        }

        // Update graphic links in document
        try {
            pkgPrefs.updateGraphics = (options.updateLinks !== false);
        } catch (e) {
            WAW.Log.warn("Could not set updateGraphics preference");
        }

        // Include report (IDML)
        try {
            pkgPrefs.includeIdml = (options.includeReport !== false);
        } catch (e) {
            WAW.Log.warn("Could not set includeIdml preference");
        }

        // Other useful package options
        try {
            pkgPrefs.ignorePreflightErrors = false;
        } catch (e) {
            // ignore
        }

        try {
            pkgPrefs.createReport = true;
        } catch (e) {
            // ignore
        }

        try {
            pkgPrefs.useDocumentHyphenationExceptionsOnly = false;
        } catch (e) {
            // ignore
        }

        try {
            pkgPrefs.fontsFolderPath = "";
        } catch (e) {
            // ignore
        }

        try {
            pkgPrefs.linksFolderPath = "";
        } catch (e) {
            // ignore
        }

        // Additional package options for newer InDesign versions
        try {
            pkgPrefs.packagePrintPdf = false;
        } catch (e) {
            // ignore — this may not exist in all versions
        }

        try {
            pkgPrefs.packageLayersPdf = false;
        } catch (e) {
            // ignore
        }

        // Perform the package
        var pkgResult = doc.packageForPrint(
            pkgFile,
            (options.copyFonts !== false),
            (options.copyLinks !== false),
            (options.copyLinks !== false),
            (options.copyLinks !== false),
            (options.copyLinks !== false),
            (options.includeReport !== false),
            (options.includeReport !== false)
        );

        if (pkgResult) {
            WAW.Log.success("Document packaged: " + pkgFolder.fsName);
            WAW.UI.update("Package", "Done");
            return pkgFolder.fsName;
        } else {
            WAW.Log.warn("Package returned false — check for preflight errors");
            WAW.UI.update("Package", "Done (with warnings)");
            return pkgFolder.fsName;
        }

    } catch (e) {
        WAW.Log.error("Package failed: " + e);
        WAW.UI.update("Package", "Failed");
        return null;
    }
};


// ============================================================================
// 7. ENHANCED REPORTING — WAW.Export.generateReport
// ============================================================================

/**
 * Generate a comprehensive report in multiple formats.
 * Saves both text (console) and HTML versions to the export directory.
 *
 * @param {Object} results - Full pipeline results object
 * @param {Object} [results.preflight] - Preflight results
 * @param {string} [results.inddPath] - Saved INDD path
 * @param {string} [results.pdfPath] - Exported PDF path
 * @param {string} [results.idmlPath] - Exported IDML path
 * @param {string} [results.epubPath] - Exported EPUB path
 * @param {string} [results.packagePath] - Package folder path
 * @param {number} [results.duration] - Pipeline duration in seconds
 * @param {number} [results.stepsCompleted] - Steps completed count
 * @param {Object} [results.docInfo] - Document info { pages, images, missingImages }
 * @returns {string|null} Full path of saved HTML report, or null on failure
 *
 * @example
 * var reportPath = WAW.Export.generateReport(pipelineResults);
 */
WAW.Export.generateReport = function(results) {
    results = results || {};
    WAW.Log.info("Generating report...");
    WAW.UI.update("Report", "Generating...");

    try {
        var exportDir = WAW.Export._getConfig("export.exportDir", "~/Desktop/WeAreWolf_Output/");
        var folder = WAW.Export._resolveFolder(exportDir, true);
        if (!folder) {
            WAW.Log.error("Cannot access export directory for report");
            return null;
        }

        var timestamp = WAW.Export._formatTimestamp(new Date());
        var now = new Date();
        var duration = results.duration || 0;
        var minutes = Math.floor(duration / 60);
        var seconds = Math.floor(duration % 60);

        var docInfo = results.docInfo || {};
        var pageCount = docInfo.pages || 0;
        var imageCount = docInfo.images || 0;
        var missingImageCount = docInfo.missingImages || 0;

        var preflight = results.preflight || { passed: false, summary: { errors: 0, warnings: 0, info: 0 }, issues: [] };
        var pfStatus = preflight.passed ? (preflight.summary.warnings > 0 ? "PASSED WITH WARNINGS" : "PASSED") : "FAILED";

        var stepsTotal = 11;
        var stepsDone = results.stepsCompleted || 0;

        // ---- BUILD TEXT REPORT ----
        var textLines = [];
        textLines.push("================================================================");
        textLines.push("  WE ARE WOLF — AUTOMATION REPORT v" + WAW.Export.VERSION);
        textLines.push("  Generated: " + WAW.Export._formatDate(now));
        textLines.push("================================================================");
        textLines.push("");
        textLines.push("EXECUTION SUMMARY");
        textLines.push("  Duration:        " + minutes + " minutes " + seconds + " seconds");
        textLines.push("  Steps Completed: " + stepsDone + "/" + stepsTotal);
        textLines.push("");
        textLines.push("DOCUMENT");
        textLines.push("  Pages:           " + pageCount);
        textLines.push("  Images Placed:   " + imageCount);
        textLines.push("  Images Missing:  " + missingImageCount);
        textLines.push("");
        textLines.push("PREFLIGHT RESULTS");
        textLines.push("  Status:          " + pfStatus);
        textLines.push("  Errors:          " + preflight.summary.errors);
        textLines.push("  Warnings:        " + preflight.summary.warnings);
        textLines.push("  Info:            " + preflight.summary.info);

        // List issues
        if (preflight.issues && preflight.issues.length > 0) {
            textLines.push("");
            textLines.push("PREFLIGHT ISSUES:");
            for (var issueIdx = 0; issueIdx < preflight.issues.length; issueIdx++) {
                var issue = preflight.issues[issueIdx];
                var sev = issue.severity.toUpperCase();
                textLines.push("  [" + sev + "][" + issue.category + "] " + issue.message);
                if (issue.detail) {
                    var detailLines = String(issue.detail).split("\n");
                    for (var dl = 0; dl < detailLines.length; dl++) {
                        if (detailLines[dl]) {
                            textLines.push("      " + detailLines[dl]);
                        }
                    }
                }
            }
        }

        textLines.push("");
        textLines.push("EXPORTS");
        textLines.push("  INDD:            " + (results.inddPath || "(not saved)"));
        textLines.push("  PDF:             " + (results.pdfPath || "(not exported)"));
        textLines.push("  IDML:            " + (results.idmlPath || "(not exported)"));
        textLines.push("  EPUB:            " + (results.epubPath || "(not exported)"));
        textLines.push("  Package:         " + (results.packagePath || "(not packaged)"));
        textLines.push("");
        textLines.push("POST-AUTOMATION CHECKLIST");
        for (var ci = 0; ci < WAW.Export.CHECKLIST.length; ci++) {
            textLines.push("  [ ] " + WAW.Export.CHECKLIST[ci]);
        }
        textLines.push("");
        textLines.push("================================================================");

        var textReport = textLines.join("\n");

        // Save text report
        var textFilename = WAW.Export._getConfig("export.filePrefix", WAW.Export.FILE_PREFIX) + "_Report_" + timestamp + ".txt";
        var textFile = new File(folder.fsName + "/" + textFilename);
        textFile.encoding = "UTF-8";
        textFile.open("w");
        textFile.write(textReport);
        textFile.close();
        WAW.Log.info("Text report saved: " + textFile.fsName);

        // Also output text report to console/log
        WAW.Log.info("\n" + textReport);

        // ---- BUILD HTML REPORT ----
        var html = WAW.Export._buildHTMLReport(results, now, duration);

        var htmlFilename = WAW.Export._getConfig("export.filePrefix", WAW.Export.FILE_PREFIX) + "_Report_" + timestamp + ".html";
        var htmlFile = new File(folder.fsName + "/" + htmlFilename);
        htmlFile.encoding = "UTF-8";
        htmlFile.open("w");
        htmlFile.write(html);
        htmlFile.close();

        WAW.Log.success("HTML report saved: " + htmlFile.fsName);
        WAW.UI.update("Report", "Done");
        return htmlFile.fsName;

    } catch (e) {
        WAW.Log.error("Report generation failed: " + e);
        WAW.UI.update("Report", "Failed");
        return null;
    }
};

/**
 * Build the HTML report content.
 * @private
 */
WAW.Export._buildHTMLReport = function(results, now, duration) {
    var docInfo = results.docInfo || {};
    var pageCount = docInfo.pages || 0;
    var imageCount = docInfo.images || 0;
    var missingImageCount = docInfo.missingImages || 0;
    var preflight = results.preflight || { passed: false, summary: { errors: 0, warnings: 0, info: 0 }, issues: [] };
    var pfStatus = preflight.passed ? (preflight.summary.warnings > 0 ? "PASSED WITH WARNINGS" : "PASSED") : "FAILED";

    var minutes = Math.floor(duration / 60);
    var seconds = Math.floor(duration % 60);
    var stepsDone = results.stepsCompleted || 0;

    var statusColor = preflight.passed ? (preflight.summary.warnings > 0 ? "#f0ad4e" : "#5cb85c") : "#d9534f";
    var statusBg = preflight.passed ? (preflight.summary.warnings > 0 ? "#fff3cd" : "#dff0d8") : "#f2dede";

    var html = [];

    html.push("<!DOCTYPE html>");
    html.push("<html lang=\"en\">");
    html.push("<head>");
    html.push("<meta charset=\"UTF-8\">");
    html.push("<title>We Are Wolf — Automation Report v" + WAW.Export.VERSION + "</title>");
    html.push("<style>");
    html.push(WAW.Export._getReportCSS());
    html.push("</style>");
    html.push("<script>");
    html.push(WAW.Export._getReportJS());
    html.push("</script>");
    html.push("</head>");
    html.push("<body>");

    // Header
    html.push("<div class=\"header\">");
    html.push("<h1>WE ARE WOLF</h1>");
    html.push("<h2>Automation Report v" + WAW.Export.VERSION + "</h2>");
    html.push("<p class=\"timestamp\">Generated: " + WAW.Export._escapeHTML(WAW.Export._formatDate(now)) + "</p>");
    html.push("</div>");

    // Status Banner
    html.push("<div class=\"status-banner\" style=\"background-color:" + statusBg + ";border-color:" + statusColor + ";color:" + statusColor + ";\">");
    html.push("<strong>Preflight Status: " + pfStatus + "</strong><br>");
    html.push("Errors: " + preflight.summary.errors + " | Warnings: " + preflight.summary.warnings + " | Info: " + preflight.summary.info);
    html.push("</div>");

    // Execution Summary
    html.push("<div class=\"section\">");
    html.push("<h3 onclick=\"toggleSection(this)\" class=\"collapsible\">&#9662; Execution Summary</h3>");
    html.push("<div class=\"section-content\">");
    html.push("<table class=\"info-table\">");
    html.push("<tr><td>Duration</td><td>" + minutes + " minutes " + seconds + " seconds</td></tr>");
    html.push("<tr><td>Steps Completed</td><td>" + stepsDone + "/11</td></tr>");
    html.push("</table>");
    html.push("</div>");
    html.push("</div>");

    // Document Info
    html.push("<div class=\"section\">");
    html.push("<h3 onclick=\"toggleSection(this)\" class=\"collapsible\">&#9662; Document Information</h3>");
    html.push("<div class=\"section-content\">");
    html.push("<table class=\"info-table\">");
    html.push("<tr><td>Pages</td><td>" + pageCount + "</td></tr>");
    html.push("<tr><td>Images Placed</td><td>" + imageCount + "</td></tr>");
    html.push("<tr><td>Images Missing</td><td><span class=\"badge badge-" + (missingImageCount > 0 ? "error\">" + missingImageCount : "ok\">0") + "</span></td></tr>");
    html.push("</table>");
    html.push("</div>");
    html.push("</div>");

    // Preflight Results
    html.push("<div class=\"section\">");
    html.push("<h3 onclick=\"toggleSection(this)\" class=\"collapsible\">&#9662; Preflight Results</h3>");
    html.push("<div class=\"section-content\">");
    html.push("<table class=\"info-table\">");
    html.push("<tr><td>Status</td><td><span class=\"badge\" style=\"background-color:" + statusColor + ";color:white;\">" + pfStatus + "</span></td></tr>");
    html.push("<tr><td>Errors</td><td><span class=\"badge badge-error\">" + preflight.summary.errors + "</span></td></tr>");
    html.push("<tr><td>Warnings</td><td><span class=\"badge badge-warning\">" + preflight.summary.warnings + "</span></td></tr>");
    html.push("<tr><td>Info</td><td><span class=\"badge badge-info\">" + preflight.summary.info + "</span></td></tr>");
    html.push("</table>");

    // Issues table
    if (preflight.issues && preflight.issues.length > 0) {
        html.push("<h4>Issues Found</h4>");
        html.push("<table class=\"issues-table\">");
        html.push("<thead><tr><th>Severity</th><th>Category</th><th>Message</th><th>Detail</th></tr></thead>");
        html.push("<tbody>");
        for (var i = 0; i < preflight.issues.length; i++) {
            var issue = preflight.issues[i];
            var rowClass = "issue-" + issue.severity;
            html.push("<tr class=\"" + rowClass + "\">");
            html.push("<td><span class=\"badge badge-" + issue.severity + "\">" + issue.severity.toUpperCase() + "</span></td>");
            html.push("<td>" + WAW.Export._escapeHTML(issue.category) + "</td>");
            html.push("<td>" + WAW.Export._escapeHTML(issue.message) + "</td>");
            html.push("<td><pre>" + WAW.Export._escapeHTML(issue.detail) + "</pre></td>");
            html.push("</tr>");
        }
        html.push("</tbody>");
        html.push("</table>");
    } else {
        html.push("<p class=\"no-issues\">No issues found. Document passed all preflight checks.</p>");
    }
    html.push("</div>");
    html.push("</div>");

    // Exports
    html.push("<div class=\"section\">");
    html.push("<h3 onclick=\"toggleSection(this)\" class=\"collapsible\">&#9662; Export Files</h3>");
    html.push("<div class=\"section-content\">");
    html.push("<table class=\"info-table\">");

    var exports = [
        { label: "INDD", path: results.inddPath },
        { label: "PDF", path: results.pdfPath },
        { label: "IDML", path: results.idmlPath },
        { label: "EPUB", path: results.epubPath },
        { label: "Package", path: results.packagePath }
    ];
    for (var ei = 0; ei < exports.length; ei++) {
        var exp = exports[ei];
        if (exp.path) {
            html.push("<tr><td>" + exp.label + "</td><td><a href=\"" + WAW.Export._pathToFileURL(exp.path) + "\" class=\"file-link\">" + WAW.Export._escapeHTML(exp.path) + "</a></td></tr>");
        } else {
            html.push("<tr><td>" + exp.label + "</td><td><span class=\"na\">Not generated</span></td></tr>");
        }
    }
    html.push("</table>");
    html.push("</div>");
    html.push("</div>");

    // Checklist
    html.push("<div class=\"section\">");
    html.push("<h3 onclick=\"toggleSection(this)\" class=\"collapsible\">&#9662; Post-Automation Checklist</h3>");
    html.push("<div class=\"section-content\">");
    html.push("<ul class=\"checklist\">");
    for (var ci = 0; ci < WAW.Export.CHECKLIST.length; ci++) {
        html.push("<li><input type=\"checkbox\" id=\"chk" + ci + "\"> <label for=\"chk" + ci + "\">" + WAW.Export._escapeHTML(WAW.Export.CHECKLIST[ci]) + "</label></li>");
    }
    html.push("</ul>");
    html.push("</div>");
    html.push("</div>");

    // Footer
    html.push("<div class=\"footer\">");
    html.push("<p>We Are Wolf — InDesign Automation v" + WAW.Export.VERSION + "</p>");
    html.push("<p>Report generated automatically. Do not edit manually.</p>");
    html.push("</div>");

    html.push("</body>");
    html.push("</html>");

    return html.join("\n");
};

/**
 * Get CSS for HTML report.
 * @private
 * @returns {string} CSS styles
 */
WAW.Export._getReportCSS = function() {
    return [
        "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #333; }",
        ".header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; text-align: center; }",
        ".header h1 { margin: 0; font-size: 28px; letter-spacing: 3px; }",
        ".header h2 { margin: 10px 0 0; font-size: 16px; font-weight: normal; opacity: 0.8; }",
        ".timestamp { opacity: 0.6; font-size: 13px; margin-top: 10px; }",
        ".status-banner { padding: 20px; text-align: center; border: 2px solid; margin: 20px auto; max-width: 900px; border-radius: 6px; font-size: 16px; }",
        ".section { max-width: 900px; margin: 15px auto; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }",
        ".section h3 { margin: 0; padding: 15px 20px; background: #ecf0f1; cursor: pointer; font-size: 15px; border-bottom: 1px solid #ddd; user-select: none; }",
        ".section h3:hover { background: #e0e6e8; }",
        ".section-content { padding: 20px; }",
        ".info-table { width: 100%; border-collapse: collapse; }",
        ".info-table td { padding: 8px 12px; border-bottom: 1px solid #eee; }",
        ".info-table td:first-child { font-weight: bold; width: 200px; color: #555; }",
        ".issues-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }",
        ".issues-table th { background: #34495e; color: white; padding: 10px; text-align: left; }",
        ".issues-table td { padding: 10px; border-bottom: 1px solid #eee; vertical-align: top; }",
        ".issues-table tr:hover { background: #f9f9f9; }",
        ".badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; }",
        ".badge-error { background: #d9534f; color: white; }",
        ".badge-warning { background: #f0ad4e; color: white; }",
        ".badge-info { background: #5bc0de; color: white; }",
        ".badge-ok { background: #5cb85c; color: white; }",
        ".issue-error { background: #fdf2f2; }",
        ".issue-warning { background: #fffdf2; }",
        ".issue-info { background: #f2f8fd; }",
        ".file-link { color: #2980b9; text-decoration: none; font-family: 'Courier New', monospace; font-size: 12px; word-break: break-all; }",
        ".file-link:hover { text-decoration: underline; }",
        ".na { color: #999; font-style: italic; }",
        ".no-issues { color: #5cb85c; font-style: italic; text-align: center; padding: 20px; }",
        ".checklist { list-style: none; padding: 0; }",
        ".checklist li { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }",
        ".checklist input[type='checkbox'] { margin-right: 10px; transform: scale(1.2); }",
        ".checklist label { cursor: pointer; }",
        ".checklist input:checked + label { text-decoration: line-through; color: #999; }",
        ".footer { text-align: center; padding: 30px; color: #999; font-size: 12px; }",
        ".footer p { margin: 5px 0; }",
        "pre { white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 11px; margin: 0; max-height: 150px; overflow-y: auto; }"
    ].join("\n");
};

/**
 * Get JavaScript for HTML report (collapsible sections).
 * @private
 * @returns {string} JavaScript code
 */
WAW.Export._getReportJS = function() {
    return [
        "function toggleSection(header) {",
        "    var content = header.nextElementSibling;",
        "    if (content.style.display === 'none') {",
        "        content.style.display = 'block';",
        "        header.innerHTML = header.innerHTML.replace('&#9656;', '&#9662;');",
        "    } else {",
        "        content.style.display = 'none';",
        "        header.innerHTML = header.innerHTML.replace('&#9662;', '&#9656;');",
        "    }",
        "}"
    ].join("\n");
};


// ============================================================================
// 8. MAIN EXPORT ORCHESTRATOR — WAW.Export.run
// ============================================================================

/**
 * Run the complete export pipeline.
 * Orchestrates preflight, save, PDF export, IDML export, EPUB export,
 * packaging, and report generation.
 *
 * @param {Document} doc - The InDesign document to process
 * @param {Object} [options] - Pipeline options
 * @param {boolean} [options.runPreflight=true] - Run preflight check
 * @param {boolean} [options.saveINDD=true] - Save INDD file
 * @param {boolean} [options.exportPDF=true] - Export PDF
 * @param {boolean} [options.exportPDFInteractive=false] - Also export interactive PDF
 * @param {boolean} [options.exportIDML=true] - Export IDML backup
 * @param {boolean} [options.exportEPUB=false] - Export EPUB
 * @param {boolean} [options.package=false] - Package document
 * @param {boolean} [options.generateReport=true] - Generate reports
 * @param {boolean} [options.saveLog=true] - Save log file
 * @returns {Object} Comprehensive results with all file paths and preflight data
 *
 * @example
 * var results = WAW.Export.run(app.activeDocument, { package: true, exportEPUB: true });
 * alert("PDF: " + results.paths.pdf);
 */
WAW.Export.run = function(doc, options) {
    options = options || {};
    var startTime = new Date().getTime();
    var stepsCompleted = 0;

    WAW.Log.info("============================================================");
    WAW.Log.info("WE ARE WOLF — EXPORT PIPELINE v" + WAW.Export.VERSION);
    WAW.Log.info("============================================================");

    if (!doc || !(doc instanceof Document)) {
        WAW.Log.error("No valid document provided to export pipeline");
        return {
            success: false,
            error: "No valid document",
            paths: {},
            preflight: null,
            duration: 0,
            stepsCompleted: 0
        };
    }

    // Initialize results
    var results = {
        success: true,
        paths: {},
        preflight: null,
        duration: 0,
        stepsCompleted: 0,
        docInfo: {
            pages: WAW.Export._countPages(doc),
            images: WAW.Export._countImages(doc),
            missingImages: WAW.Export._countMissingImages(doc)
        }
    };

    // ---- STEP 1: PREFLIGHT ----
    if (options.runPreflight !== false) {
        WAW.UI.update("Step 1/11", "Running preflight...");
        results.preflight = WAW.Export.Preflight.run(doc);
        stepsCompleted++;

        // Optionally halt on critical errors
        var haltOnError = WAW.Export._getConfig("export.haltOnPreflightError", false);
        if (haltOnError && results.preflight && !results.preflight.passed && results.preflight.summary.errors > 0) {
            WAW.Log.error("Halting pipeline due to preflight errors (haltOnPreflightError=true)");
            results.success = false;
            results.duration = (new Date().getTime() - startTime) / 1000;
            results.stepsCompleted = stepsCompleted;

            // Generate report even on early exit
            if (options.generateReport !== false) {
                results.paths.report = WAW.Export.generateReport(results);
            }
            if (options.saveLog !== false) {
                WAW.Export.saveLog();
            }
            return results;
        }
    } else {
        WAW.Log.info("Preflight skipped (runPreflight=false)");
        results.preflight = { passed: true, summary: { errors: 0, warnings: 0, info: 0 }, issues: [] };
    }

    // ---- STEP 2: SAVE INDD ----
    if (options.saveINDD !== false) {
        WAW.UI.update("Step 2/11", "Saving INDD...");
        results.paths.indd = WAW.Export.saveDocument(doc, { includeVersion: true });
        if (results.paths.indd) stepsCompleted++;
    } else {
        WAW.Log.info("INDD save skipped (saveINDD=false)");
    }

    // ---- STEP 3: EXPORT PDF (Print) ----
    if (options.exportPDF !== false) {
        WAW.UI.update("Step 3/11", "Exporting print PDF...");
        var cropMarks = WAW.Export._getConfig("export.cropMarks", false);
        var bleedMarks = WAW.Export._getConfig("export.bleedMarks", false);
        var regMarks = WAW.Export._getConfig("export.regMarks", false);
        results.paths.pdf = WAW.Export.exportPDF(doc, {
            variant: "print",
            cropMarks: cropMarks,
            bleedMarks: bleedMarks,
            regMarks: regMarks
        });
        if (results.paths.pdf) stepsCompleted++;
    } else {
        WAW.Log.info("PDF export skipped (exportPDF=false)");
    }

    // ---- STEP 4: EXPORT PDF (Interactive) ----
    if (options.exportPDFInteractive) {
        WAW.UI.update("Step 4/11", "Exporting interactive PDF...");
        results.paths.pdfInteractive = WAW.Export.exportPDF(doc, { variant: "interactive" });
        if (results.paths.pdfInteractive) stepsCompleted++;
    } else {
        WAW.Log.info("Interactive PDF export skipped (exportPDFInteractive=false)");
    }

    // ---- STEP 5: EXPORT IDML ----
    if (options.exportIDML !== false) {
        WAW.UI.update("Step 5/11", "Exporting IDML...");
        results.paths.idml = WAW.Export.exportIDML(doc);
        if (results.paths.idml) stepsCompleted++;
    } else {
        WAW.Log.info("IDML export skipped (exportIDML=false)");
    }

    // ---- STEP 6: EXPORT EPUB ----
    if (options.exportEPUB) {
        WAW.UI.update("Step 6/11", "Exporting EPUB...");
        results.paths.epub = WAW.Export.exportEPUB(doc);
        if (results.paths.epub) stepsCompleted++;
    } else {
        WAW.Log.info("EPUB export skipped (exportEPUB=false)");
    }

    // ---- STEP 7: PACKAGE ----
    if (options.package) {
        WAW.UI.update("Step 7/11", "Packaging...");
        results.paths.package = WAW.Export.packageDocument(doc, {
            copyLinks: true,
            copyFonts: true,
            updateLinks: true,
            includeReport: true
        });
        if (results.paths.package) stepsCompleted++;
    } else {
        WAW.Log.info("Packaging skipped (package=false)");
    }

    // ---- STEP 8: GENERATE REPORT ----
    if (options.generateReport !== false) {
        WAW.UI.update("Step 8/11", "Generating report...");
        results.duration = (new Date().getTime() - startTime) / 1000;
        results.stepsCompleted = stepsCompleted;
        results.paths.report = WAW.Export.generateReport(results);
        if (results.paths.report) stepsCompleted++;
    } else {
        WAW.Log.info("Report generation skipped (generateReport=false)");
    }

    // ---- STEP 9: SAVE LOG ----
    if (options.saveLog !== false) {
        WAW.UI.update("Step 9/11", "Saving log...");
        results.paths.log = WAW.Export.saveLog();
        if (results.paths.log) stepsCompleted++;
    } else {
        WAW.Log.info("Log save skipped (saveLog=false)");
    }

    // Finalize
    results.duration = (new Date().getTime() - startTime) / 1000;
    results.stepsCompleted = stepsCompleted;
    results.success = results.preflight ? results.preflight.passed : true;

    WAW.Log.info("============================================================");
    WAW.Log.info("EXPORT PIPELINE COMPLETE");
    WAW.Log.info("Duration: " + Math.floor(results.duration / 60) + "m " + Math.floor(results.duration % 60) + "s");
    WAW.Log.info("Steps: " + stepsCompleted + "/11");
    WAW.Log.info("Preflight: " + (results.preflight && results.preflight.passed ? "PASSED" : "FAILED"));
    WAW.Log.info("============================================================");

    WAW.UI.update("Export Pipeline", results.success ? "Complete" : "Complete with errors");

    return results;
};


// ============================================================================
// 9. SAVE LOG FILE — WAW.Export.saveLog
// ============================================================================

/**
 * Save the automation log to a timestamped text file in the export directory.
 * Also saves a JSON-like structured version.
 *
 * @returns {string|null} Full path of saved log file, or null on failure
 *
 * @example
 * var logPath = WAW.Export.saveLog();
 */
WAW.Export.saveLog = function() {
    WAW.Log.info("Saving log file...");

    try {
        var exportDir = WAW.Export._getConfig("export.exportDir", "~/Desktop/WeAreWolf_Output/");
        var folder = WAW.Export._resolveFolder(exportDir, true);
        if (!folder) {
            WAW.Log.error("Cannot access export directory for log");
            return null;
        }

        var prefix = WAW.Export._getConfig("export.filePrefix", WAW.Export.FILE_PREFIX);
        var timestamp = WAW.Export._formatTimestamp(new Date());

        // ---- Save plain text log ----
        var logEntries = [];
        if (typeof WAW !== "undefined" && WAW.Log && WAW.Log._entries && WAW.Log._entries.length > 0) {
            logEntries = WAW.Log._entries;
        }

        var textFilename = prefix + "_Log_" + timestamp + ".txt";
        var textFile = new File(folder.fsName + "/" + textFilename);
        textFile.encoding = "UTF-8";
        textFile.open("w");

        textFile.writeLine("WE ARE WOLF — AUTOMATION LOG v" + WAW.Export.VERSION);
        textFile.writeLine("Generated: " + WAW.Export._formatDate(new Date()));
        textFile.writeLine("============================================================");
        textFile.writeLine("");

        if (logEntries.length > 0) {
            for (var i = 0; i < logEntries.length; i++) {
                var entry = logEntries[i];
                var line = "";
                if (entry.timeString) line += "[" + entry.timeString + "] ";
                if (entry.levelLabel) line += "[" + WAW.Utils.trim(entry.levelLabel) + "] ";
                else if (typeof entry.level === "number" && WAW.Log._labels) line += "[" + WAW.Utils.trim(WAW.Log._labels[entry.level]) + "] ";
                line += (entry.message || "");
                textFile.writeLine(line);
            }
        } else {
            textFile.writeLine("[No log entries recorded]");
        }

        textFile.close();
        WAW.Log.info("Text log saved: " + textFile.fsName);

        // ---- Save JSON-like structured log ----
        var jsonFilename = prefix + "_Log_" + timestamp + ".json";
        var jsonFile = new File(folder.fsName + "/" + jsonFilename);
        jsonFile.encoding = "UTF-8";
        jsonFile.open("w");

        jsonFile.writeLine("{");
        jsonFile.writeLine('  "version": "' + WAW.Export.VERSION + '",');
        jsonFile.writeLine('  "generated": "' + WAW.Export._formatTimestamp(new Date()) + '",');
        jsonFile.writeLine('  "entries": [');

        if (logEntries.length > 0) {
            for (var j = 0; j < logEntries.length; j++) {
                var e = logEntries[j];
                jsonFile.write("    {");
                jsonFile.write('"timestamp": "' + (e.timestamp || "") + '", ');
                jsonFile.write('"level": "' + (e.level || "info") + '", ');
                jsonFile.write('"message": "' + String(e.message || "").replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"');
                jsonFile.write("}");
                if (j < logEntries.length - 1) jsonFile.write(",");
                jsonFile.writeLine("");
            }
        }

        jsonFile.writeLine("  ]");
        jsonFile.writeLine("}");
        jsonFile.close();
        WAW.Log.info("JSON log saved: " + jsonFile.fsName);

        return textFile.fsName;

    } catch (e) {
        WAW.Log.error("Log save failed: " + e);
        return null;
    }
};


// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

/**
 * Initialize the Export module.
 * Logs version info and validates dependencies.
 */
WAW.Export.init = function() {
    WAW.Log.info("WAW.Export module v" + WAW.Export.VERSION + " initialized");

    // Validate dependencies
    var missingDeps = [];
    if (typeof WAW === "undefined") missingDeps.push("WAW namespace");
    else {
        if (typeof WAW.config === "undefined") missingDeps.push("WAW.config");
        if (typeof WAW.Log === "undefined") missingDeps.push("WAW.Log");
        if (typeof WAW.Utils === "undefined") missingDeps.push("WAW.Utils");
        if (typeof WAW.UI === "undefined") missingDeps.push("WAW.UI");
    }

    if (missingDeps.length > 0) {
        WAW.Log.warn("WAW.Export missing optional dependencies: " + missingDeps.join(", "));
    }

    // Log available PDF presets
    try {
        var presets = app.pdfExportPresets;
        var presetNames = [];
        for (var i = 0; i < presets.length; i++) {
            presetNames.push(presets[i].name);
        }
        WAW.Log.info("Available PDF presets: " + presetNames.join(", "));
    } catch (e) {
        WAW.Log.warn("Could not list PDF presets: " + e);
    }
};

// Auto-initialize
WAW.Export.init();

WAW.Log.info("Module 05 (Export/Package/Report) loaded successfully.");


// ============================================================================
// MODULE 05: END
// ============================================================================

// ============================================================================
// MODULE 06: MAIN ORCHESTRATOR
// ============================================================================
//  Pipeline execution controller. Orchestrates all modules in sequence
//  with progress reporting and comprehensive error handling.
// ============================================================================

/**
 * Main execution pipeline for We Are Wolf v7.0 automation.
 * Orchestrates all modules in the correct sequence with progress reporting
 * and comprehensive error handling.
 */
function main() {
    var startTime = new Date();
    var stepCount = 12;
    var currentStep = 0;

    // --- Initialize core systems --------------------------------------------
    try {
        if (typeof WAW !== "undefined" && WAW.init) {
            WAW.init();
        }
    } catch (e) {
        alert("FATAL: Could not initialize WAW core.\n" + e.toString());
        return;
    }

    // --- Pre-flight validation ----------------------------------------------
    WAW.Log.info("Running pre-flight validation...");
    var validationErrors = [];
    
    // Check for required fonts
    var requiredFont = WAW.config.bodyFontFamily || "Minion Pro";
    var fontAvailable = false;
    for (var fi = 0; fi < app.fonts.length; fi++) {
        if (app.fonts[fi].fontFamily === requiredFont) {
            fontAvailable = true;
            break;
        }
    }
    
    if (!fontAvailable) {
        var availableFonts = [];
        for (var fj = 0; fj < Math.min(app.fonts.length, 10); fj++) {
            availableFonts.push(app.fonts[fj].fontFamily);
        }
        
        var fontChoice = confirm(
            "FONT WARNING\n" +
            "============\n\n" +
            "Preferred font '" + requiredFont + "' not found.\n\n" +
            "Available fonts include:\n" +
            availableFonts.join("\n") + "\n" +
            (app.fonts.length > 10 ? "\n...and " + (app.fonts.length - 10) + " more\n" : "") +
            "\n\nThe script will use the best available fallback.\n\n" +
            "Continue anyway?"
        );
        
        if (!fontChoice) {
            WAW.Log.info("User cancelled due to font availability.");
            return;
        }
    }

    // --- Welcome dialog -----------------------------------------------------
    var proceed = confirm(
        "WE ARE WOLF \u2014 InDesign Automation v7.0.3 PRODUCTION\n" +
        "========================================\n\n" +
        "This script will:\n" +
        "  1. Create a 6\u201D\u00D79\u201D facing-pages document\n" +
        "  2. Set up master pages, swatches, styles, baseline grid\n" +
        "  3. Import your .docx manuscript with auto-threading\n" +
        "  4. Remap Word styles and auto-detect chapters/parts\n" +
        "  5. Clean up text (spaces, punctuation, typographic fixes)\n" +
        "  6. Format tables and style footnotes\n" +
        "  7. Place images as anchored objects with captions\n" +
        "  8. Generate live Table of Contents\n" +
        "  9. Apply GREP styles, nested styles, typography polish\n" +
        "  10. Run preflight and export (PDF + IDML + Package)\n\n" +
        "Prerequisites:\n" +
        "  \u2022 Your .docx manuscript (Heading 1/2, Normal, Caption, etc.)\n" +
        "  \u2022 All images in one folder\n" +
        "  \u2022 Backup of your work (recommended)\n\n" +
        "IMPORTANT: This will create a NEW document.\n" +
        "Save any open work before proceeding.\n\n" +
        "Proceed?"
    );

    if (!proceed) {
        if (typeof WAW !== "undefined" && WAW.Log) {
            WAW.Log.info("User cancelled at welcome dialog.");
        }
        return;
    }

    // --- Close existing documents (optional) --------------------------------
    if (app.documents.length > 0) {
        var closeOthers = confirm(
            app.documents.length + " document(s) are currently open.\n" +
            "Close them to avoid conflicts?"
        );
        if (closeOthers) {
            for (var d = app.documents.length - 1; d >= 0; d--) {
                try {
                    app.documents.item(d).close(SaveOptions.NO);
                } catch (e) {
                    if (typeof WAW !== "undefined" && WAW.Log) {
                        WAW.Log.warn("Could not close document " + d + ": " + e.toString());
                    }
                }
            }
        }
    }

    // --- Show progress UI ---------------------------------------------------
    if (typeof WAW !== "undefined" && WAW.UI) {
        WAW.UI.show("We Are Wolf v7.0 \u2014 Book Automation", stepCount);
    }

    var doc = null;
    var pipelineResults = {
        documentCreated: false,
        manuscriptImported: false,
        imagesPlaced: 0,
        imagesMissing: 0,
        tocGenerated: false,
        preflightPassed: false,
        exports: {},
        errors: []
    };

    try {
        // =====================================================================
        // STEP 1: Load Configuration
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Loading configuration...", "Reading defaults and validating settings");
        }
        if (typeof WAW !== "undefined" && WAW.Config) {
            WAW.Config.load();
            if (!WAW.Config.isLoaded()) {
                throw new Error("Configuration failed to load.");
            }
        }
        if (typeof WAW !== "undefined" && WAW.Log) {
            WAW.Log.info("Configuration loaded successfully.");
        }

        // =====================================================================
        // STEP 2: Create Document
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Creating document...", "6\u201D \u00D7 9\u201D facing pages, margins, bleed");
        }
        if (typeof WAW !== "undefined" && WAW.Setup) {
            doc = WAW.Setup.createDocument();
        }
        if (!doc || !doc.isValid) {
            throw new Error("Document creation failed.");
        }
        pipelineResults.documentCreated = true;
        if (typeof WAW !== "undefined" && WAW.Log && WAW.config) {
            WAW.Log.info("Document created: " + WAW.config.pageWidth + " \u00D7 " + WAW.config.pageHeight);
        }

        // =====================================================================
        // STEP 3: Setup Master Pages, Swatches, Styles
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Setting up document...", "Master pages, swatches, styles, sections, grid");
        }

        if (typeof WAW !== "undefined" && WAW.Setup && WAW.Transaction) {
            WAW.Transaction.begin("DocumentSetup");
            try {
                WAW.Setup.createSwatches(doc);
                WAW.Setup.createMasterPages(doc);
                WAW.Setup.createStyles(doc);
                WAW.Setup.createObjectStyles(doc);
                WAW.Setup.setupBaselineGrid(doc);
                WAW.Setup.setupSections(doc);
                WAW.Setup.configureRunningHeader(doc);
                WAW.Transaction.commit();
                if (WAW.Log) WAW.Log.info("Document setup complete.");
            } catch (e) {
                WAW.Transaction.rollback();
                throw new Error("Document setup failed: " + e.toString());
            }
        }

        // =====================================================================
        // STEP 4: Import Manuscript
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Importing manuscript...", "Select your .docx file");
        }

        var imported = false;
        if (typeof WAW !== "undefined" && WAW.Import) {
            imported = WAW.Import.importManuscript(doc);
        }
        if (!imported) {
            throw new Error("Manuscript import was cancelled or failed.");
        }
        pipelineResults.manuscriptImported = true;
        if (typeof WAW !== "undefined" && WAW.Log) {
            WAW.Log.info("Manuscript imported. Pages: " + doc.pages.length);
        }

        // =====================================================================
        // STEP 5: Process Text
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Processing text...", "Style remapping, cleanup, tables, footnotes");
        }

        if (typeof WAW !== "undefined" && WAW.Import) {
            var remapStats = WAW.Import.remapStyles(doc);
            if (WAW.Log) WAW.Log.info("Style remapping complete.");

            var cleanupCount = WAW.Import.cleanupText(doc);
            if (WAW.Log) WAW.Log.info("Text cleanup: " + cleanupCount + " changes.");

            WAW.Import.formatTables(doc);
            WAW.Import.styleFootnotes(doc);
        }
        if (typeof WAW !== "undefined" && WAW.Typography) {
            WAW.Typography.insertSectionBreaks(doc);
        }

        // =====================================================================
        // STEP 6: Place Images
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Placing images...", "Select your image folder");
        }

        if (typeof WAW !== "undefined" && WAW.Import) {
            var imageResults = WAW.Import.placeImages(doc);
            pipelineResults.imagesPlaced = imageResults.placed;
            pipelineResults.imagesMissing = imageResults.missing.length;
            if (WAW.Log) {
                WAW.Log.info("Images placed: " + imageResults.placed + ", missing: " + imageResults.missing.length);
            }
        }

        // =====================================================================
        // STEP 7: Remove leftover placeholders
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Cleaning up placeholders...", "Removing unmatched [IMAGE:] tags");
        }
        if (typeof WAW !== "undefined" && WAW.Import) {
            WAW.Import.removePlaceholderParagraphs(doc);
        }

        // =====================================================================
        // STEP 8: Generate TOC & Apply Typography
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Applying typography...", "TOC, GREP styles, polish, running headers");
        }

        if (typeof WAW !== "undefined" && WAW.Typography) {
            WAW.Typography.generateTOC(doc);
            pipelineResults.tocGenerated = true;
            WAW.Typography.applyGREPStyles(doc);
            WAW.Typography.applyNestedStyles(doc);
            WAW.Typography.polishTypography(doc);
            WAW.Typography.configureRunningHeaders(doc);
            WAW.Typography.applyMasters(doc);
        }

        // =====================================================================
        // STEP 9: Preflight
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Running preflight...", "Checking text, fonts, links, layout");
        }

        if (typeof WAW !== "undefined" && WAW.Export && WAW.Export.Preflight) {
            var preflightResults = WAW.Export.Preflight.run(doc);
            pipelineResults.preflightPassed = preflightResults.passed;
            if (WAW.Log) {
                WAW.Log.info("Preflight: " + (preflightResults.passed ? "PASSED" : "ISSUES FOUND") +
                    " (errors: " + preflightResults.summary.errors +
                    ", warnings: " + preflightResults.summary.warnings + ")");
            }
        }

        // =====================================================================
        // STEP 10: Export
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Exporting...", "PDF, IDML, packaging");
        }

        if (typeof WAW !== "undefined" && WAW.Export) {
            var exportResults = WAW.Export.run(doc);
            pipelineResults.exports = exportResults.files || {};
        }

        // =====================================================================
        // STEP 11: Generate Reports
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Generating reports...", "Text report, HTML report, log file");
        }

        if (typeof WAW !== "undefined" && WAW.Export) {
            var reportResults = WAW.Export.generateReport({
                preflight: preflightResults || {passed: false, issues: [], summary: {errors: 0, warnings: 0, info: 0}},
                pipeline: pipelineResults,
                timing: { start: startTime, end: new Date() }
            });
            WAW.Export.saveLog();
        }

        // =====================================================================
        // STEP 12: Show Document & Finalize
        // =====================================================================
        currentStep++;
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.update(currentStep, "Finalizing...", "Opening document window");
        }

        if (doc && doc.isValid && doc.windows.length === 0) {
            doc.windows.add();
        }

        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.close();
        }

        // --- Final alert -----------------------------------------------------
        var elapsed = Math.round((new Date() - startTime) / 1000);
        var minutes = Math.floor(elapsed / 60);
        var seconds = elapsed % 60;

        var alertMsg = "WE ARE WOLF \u2014 AUTOMATION COMPLETE\n" +
                       "========================================\n\n" +
                       "Duration: " + minutes + "m " + seconds + "s\n" +
                       "Pages: " + doc.pages.length + "\n" +
                       "Images placed: " + pipelineResults.imagesPlaced + "\n" +
                       "Images missing: " + pipelineResults.imagesMissing + "\n" +
                       "Preflight: " + (pipelineResults.preflightPassed ? "PASSED" : "ISSUES FOUND") + "\n\n" +
                       "Files saved to:\n" + (WAW.config ? WAW.config.exportDir : "~/Desktop/WeAreWolf_Output/") + "\n\n";

        if (!pipelineResults.preflightPassed) {
            alertMsg += "\u26A0\uFE0F  Preflight issues found \u2014 check the log.\n\n";
        }

        alertMsg += "Open the PDF to review.\n" +
                    "Open the INDD to refine.\n\n" +
                    "Next steps:\n" +
                    "  1. Layout > Table of Contents to refresh live TOC\n" +
                    "  2. Type > Show Hidden Characters to verify cleanup\n" +
                    "  3. File > Package for final handoff";

        alert(alertMsg);

        if (typeof WAW !== "undefined" && WAW.Log) {
            WAW.Log.info("=== AUTOMATION COMPLETE ===");
            WAW.Log.info("Duration: " + minutes + "m " + seconds + "s");
        }

    } catch (e) {
        if (typeof WAW !== "undefined" && WAW.UI) {
            WAW.UI.close();
        }
        if (typeof WAW !== "undefined" && WAW.Log) {
            WAW.Log.error("FATAL: " + e.toString());
        }

        var errorMsg = "AUTOMATION FAILED\n" +
                       "=================\n\n" +
                       "Error: " + e.toString() + "\n";
        
        if (e.line) {
            errorMsg += "Line: " + e.line + "\n";
        }
        
        errorMsg += "\nWhat happened:\n" +
                    "The automation encountered an unexpected error and stopped.\n\n" +
                    "What to do:\n" +
                    "1. Check the log file in your output folder\n" +
                    "2. Review the error message above\n" +
                    "3. If a document was created, it may have been saved as EMERGENCY backup\n\n" +
                    "Common causes:\n" +
                    "\u2022 Missing or corrupted manuscript file\n" +
                    "\u2022 Insufficient disk space\n" +
                    "\u2022 Font or resource conflicts\n" +
                    "\u2022 InDesign version compatibility\n\n" +
                    "For support, include the log file and error message.";

        alert(errorMsg);

        // Attempt emergency save with better error handling
        if (doc && doc.isValid) {
            try {
                var exportDir = (typeof WAW !== "undefined" && WAW.config) ? WAW.config.exportDir : "~/Desktop/WeAreWolf_Output/";
                var timestamp = new Date().getTime();
                var emergencyFile = new File(exportDir + "/WeAreWolf_EMERGENCY_" + timestamp + ".indd");
                
                if (typeof WAW !== "undefined" && WAW.Utils) {
                    WAW.Utils.ensureFolder(exportDir);
                }
                
                doc.save(emergencyFile);
                
                if (typeof WAW !== "undefined" && WAW.Log) {
                    WAW.Log.warn("Emergency save successful: " + emergencyFile.fsName);
                }
                
                alert("EMERGENCY SAVE SUCCESSFUL\n\n" +
                      "Your work has been saved to:\n" +
                      emergencyFile.fsName + "\n\n" +
                      "You can open this file to recover your progress.");
                      
            } catch (saveErr) {
                if (typeof WAW !== "undefined" && WAW.Log) {
                    WAW.Log.error("Emergency save failed: " + saveErr.toString());
                }
                alert("WARNING: Emergency save failed.\n" +
                      "Document may be lost.\n\n" +
                      "Error: " + saveErr.toString());
            }
        }
    }

    // --- Save log regardless of success/failure -----------------------------
    try {
        if (typeof WAW !== "undefined" && WAW.Export) {
            WAW.Export.saveLog();
        }
    } catch (e) {
        $.writeln("Could not save log: " + e.toString());
    }
}

// === RUN ====================================================================
main();
