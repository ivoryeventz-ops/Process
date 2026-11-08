/**
 * Creates a Google Sheet from the quote data sent by the Quote Builder page.
 * One-time setup: see README.md ("Google Sheets button").
 */
var SECRET = 'change-me';   // must match SHEETS_KEY in index.html

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.key !== SECRET) throw new Error('Wrong key');

    var rows = d.rows || [];
    var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 1);
    rows = rows.map(function (r) { var c = r.slice(); while (c.length < width) c.push(''); return c; });

    var ss = SpreadsheetApp.create(d.title || 'Quote');
    var sh = ss.getSheets()[0];
    sh.getRange(1, 1, rows.length, width).setValues(rows);   // strings starting with "=" become formulas

    // Light formatting
    sh.getRange(1, 1, 4, 1).setFontWeight('bold');
    sh.getRange(6, 1, 1, width).setFontWeight('bold').setBackground('#f6f1e8');
    sh.getRange(7, 4, rows.length, 2).setNumberFormat('#,##0');
    sh.getRange(rows.length, 1, 1, width).setFontWeight('bold');
    sh.setColumnWidth(2, 380);
    sh.autoResizeColumns(1, 1);
    sh.setFrozenRows(6);

    return json({ url: ss.getUrl() });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
