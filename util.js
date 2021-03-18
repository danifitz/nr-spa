/**
 * https://stackoverflow.com/a/12785546
 */
var CSV = {
    parse: function (csv, reviver) {
        reviver = reviver || function (r, c, v) { return v; };
        var chars = csv.split(''), c = 0, cc = chars.length, start, end, table = [], row;
        while (c < cc) {
            table.push(row = []);
            while (c < cc && '\r' !== chars[c] && '\n' !== chars[c]) {
                start = end = c;
                if ('"' === chars[c]) {
                    start = end = ++c;
                    while (c < cc) {
                        if ('"' === chars[c]) {
                            if ('"' !== chars[c + 1]) {
                                break;
                            }
                            else {
                                chars[++c] = ''; // unescape ""
                            }
                        }
                        end = ++c;
                    }
                    if ('"' === chars[c]) {
                        ++c;
                    }
                    while (c < cc && '\r' !== chars[c] && '\n' !== chars[c] && ',' !== chars[c]) {
                        ++c;
                    }
                } else {
                    while (c < cc && '\r' !== chars[c] && '\n' !== chars[c] && ',' !== chars[c]) {
                        end = ++c;
                    }
                }
                row.push(reviver(table.length - 1, row.length, chars.slice(start, end).join('')));
                if (',' === chars[c]) {
                    ++c;
                }
            }
            if ('\r' === chars[c]) {
                ++c;
            }
            if ('\n' === chars[c]) {
                ++c;
            }
        }
        return table;
    },

    stringify: function (table, replacer) {
        replacer = replacer || function (r, c, v) { return v; };
        var csv = '', c, cc, r, rr = table.length, cell;
        for (r = 0; r < rr; ++r) {
            if (r) {
                csv += '\r\n';
            }
            for (c = 0, cc = table[r].length; c < cc; ++c) {
                if (c) {
                    csv += ',';
                }
                cell = replacer(r, c, table[r][c]);
                if (/[,\r\n"]/.test(cell)) {
                    cell = '"' + cell.replace(/"/g, '""') + '"';
                }
                csv += (cell || 0 === cell) ? cell : '';
            }
        }
        return csv;
    }
};

/**
 * Gets a CSV file from MS Sharepoint
 * @param {string} accessToken 
 * @param {string} siteUrl 
 * @param {string} folderName 
 * @param {string} fileName 
 */
 const getCsvFileFromSharepoint = (accessToken, siteUrl, folderName, fileName) => {
    var myHeaders = new Headers({
        'Authorization': 'Bearer' + accessToken
    });

    const request = new Request(`https://${siteUrl}/_api/web/GetFileByServerRelativeUrl('/${folderName}/${fileName})/$value`)
    fetch(request, { method: 'GET', headers: myHeaders }).then(response => {
        return response.blob();
    }).then(blob => {
        if (blob.type === 'text/csv') {
            return blob.text();
        } else {
            console.error('Downloaded blob is not of mime type text/csv, expected text/csv');
        }
    });
}

var fs = require('fs');
if (process.argv.length === 2) {
    console.log('Usage: call this program with the path to a CSV file as an argument i.e. node util.js file.csv')
} else if (process.argv[2] === '--help' || process.argv[2] === 'help' || process.argv[2] === '-h') {
    console.log('Usage: call this program with the path to a CSV file as an argument i.e. node util.js file.csv')
} else if (process.argv.length === 3 && process.argv[2].slice(process.argv[2].lastIndexOf('.'), process.argv[2].length) === '.csv') {
    const fileName = process.argv[2];
    fs.readFile(fileName, 'utf8', function (err, data) {
        if (err) throw err;

        const parsedCSV = CSV.parse(data);
        const parsedCSVString = JSON.stringify(parsedCSV);
        const buffer = new Buffer.from(parsedCSVString, 'utf-8');
        console.log(buffer.toString('base64'));
        process.exit(0);
    });
}