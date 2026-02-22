/**
 * GRE Vocabulary to Avery 5164 Labels - Corrected Script
 * Converts GRE vocabulary entries from markdown format to printable Avery 5164 labels.
 *
 * Usage: Open a Google Doc with GRE entries in markdown format, then run
 * Extensions > GRE to Labels > Convert to Avery 5164
 */

function onOpen() {
  DocumentApp.getUi()
    .createMenu('GRE to Labels')
    .addItem('Convert to Avery 5164', 'convertGREToAvery5164')
    .addToUi();
}

/**
 * Extracts a field value from markdown text by field name.
 * FIX: Regex terminator uses $ (not \\s*$) to avoid silent failure on multiline content.
 */
function extractField(text, fieldName) {
  var escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp(
    '(?:^|\\n)\\s*(?:\\d+\\.\\s*)?\\*\\*' + escaped + ':\\*\\*\\s*([\\s\\S]*?)' +
    '(?=\\n[\\t ]*(?:\\d+\\.\\s*)?\\*\\*[A-Za-z ]+:\\*\\*|$)',
    'i'
  );
  var match = text.match(re);
  if (match) {
    return cleanText(match[1].replace(/\n\s*/g, ' ').trim());
  }
  return '';
}

function cleanText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Parses GRE vocabulary entries from markdown text.
 */
function parseGREEntries(text) {
  var entries = [];
  var blocks = text.split(/(?=\n###\s+Word\s+\d+)/i);
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i].trim();
    if (!block) continue;
    // Skip preamble text before first Word heading
    if (!/^###\s+Word\s+\d+/i.test(block)) continue;
    var word = extractField(block, 'Word');
    if (!word && /^###\s+Word\s+\d+:/i.test(block)) {
      var wordLine = block.split('\n')[0];
      word = cleanText((wordLine.match(/:\s*(.*)$/) || [])[1] || '');
    }
    entries.push({
      word: word || '(no word)',
      partOfSpeech: extractField(block, 'Part of Speech'),
      definition: extractField(block, 'Definition'),
      example: extractField(block, 'Example'),
      raw: block
    });
  }
  return entries;
}

/**
 * Removes leading empty paragraph from a body element.
 * Called BEFORE appending new content to avoid skipping when PageBreak lands first.
 * Does NOT remove paragraphs that contain a page break (to preserve pagination).
 */
function removeLeadingEmptyParagraph(body) {
  var child = body.getChild(0);
  if (!child) return;
  if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
    var para = child.asParagraph();
    var text = para.getText();
    var hasPageBreak = false;
    for (var i = 0; i < para.getNumChildren(); i++) {
      if (para.getChild(i).getType() === DocumentApp.ElementType.PAGE_BREAK) {
        hasPageBreak = true;
        break;
      }
    }
    if (!hasPageBreak && (!text || text.trim() === '')) {
      child.removeFromParent();
    }
  }
}

/**
 * Populates a single label cell with word entry.
 * FIX: Handles falsy entry.word with fallback label so cell is never blank.
 */
function populateLabelCell(cell, entry) {
  var word = entry.word || '(no word)';
  var pos = entry.partOfSpeech || '';
  var def = entry.definition || '';
  var example = entry.example || '';

  var wordPara = cell.getChild(0);
  if (wordPara && wordPara.getType() === DocumentApp.ElementType.PARAGRAPH) {
    wordPara = wordPara.asParagraph();
  } else {
    wordPara = cell.appendParagraph('');
  }
  wordPara.setText(word).setBold(true);

  if (pos) cell.appendParagraph(pos).setBold(true);
  if (def) cell.appendParagraph(def);
  if (example) cell.appendParagraph('"' + example + '"');
}

/**
 * Converts GRE entries to Avery 5164 label format.
 * FIX 1: removeLeadingEmptyParagraph called before appending table (correct order).
 * FIX 2: Page breaks use appendParagraph('').insertPageBreak(0) instead of appendPageBreak().
 */
function convertGREToAvery5164() {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();

  // Avery 5164: 2 columns x 3 rows per sheet
  var COLS = 2;
  var ROWS = 3;
  var LABELS_PER_SHEET = COLS * ROWS;

  var sourceText = body.getText();
  body.clear();
  var entries = parseGREEntries(sourceText);

  if (entries.length === 0) {
    DocumentApp.getUi().alert('No GRE entries found.');
    return;
  }

  var totalSheets = Math.ceil(entries.length / LABELS_PER_SHEET);
  var labelIndex = 0;

  for (var sheet = 0; sheet < totalSheets; sheet++) {
    // FIX 1: Remove leading empty paragraph BEFORE appending new content
    if (sheet > 0) {
      removeLeadingEmptyParagraph(body);
    }

    var table = body.appendTable();
    table.setBorderWidth(0);
    // Remove the initial row created by appendTable()
    table.getRow(0).removeFromParent();

    for (var r = 0; r < ROWS; r++) {
      var row = table.appendTableRow();
      for (var c = 0; c < COLS; c++) {
        var cell = row.appendTableCell('');
        if (labelIndex < entries.length) {
          populateLabelCell(cell, entries[labelIndex]);
          labelIndex++;
        }
      }
    }

    // FIX 2: Use appendParagraph('').insertPageBreak(0) instead of appendPageBreak()
    if (sheet < totalSheets - 1) {
      var pbPara = body.appendParagraph('');
      pbPara.insertPageBreak(0);
      pbPara.setSpacingBefore(0);
      pbPara.setSpacingAfter(0);
    }
  }
}
