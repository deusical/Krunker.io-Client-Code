const terser = require('terser');
const request = require('request');
const fs = require('fs');

const keys = Buffer.from('e1f5bb730d17448e297a7e1ecf1481946fc33c4409e805203d9ddf034139eb8db57178b4cc5663d8f7c829d31b7ef761e517');

function fixKey(key) {
    let subKey = key - 48;

    if ((subKey & 255) < 10) {
        // empty
    } else if ((key - 65 & 255) <= 5) {
        subKey = key - 55;
    } else if ((key - 97 & 255) < 6) {
        subKey = key - 87;
    }

    return subKey;
}

function fromVries(bytes) {
    let buf = Buffer.alloc(bytes.length);

    for (let i = 0; i < bytes.length; i++) {
        let byte = bytes[i];

        let index = i * 2 % keys.length;

        let key = keys[index];
        let key2 = keys[index + 1];

        let subKey = fixKey(key);
        let xorKey = fixKey(key2);

        xorKey += subKey << 4;

        buf.writeUInt8(byte ^ xorKey, i);
    }

    return buf.toString();
}

console.log('[KRUNKER] - Fetching Version...');

request.get('https://krunker.io/social.html', (err, res, body) => {
    let version = body.match(/(?<=\w+.exports=")[^"]+/)[0];

    console.log('[KRUNKER] - Got Version (%s)', version);

    request.get('https://krunker.io/pkg/krunker.' + version + '.vries', {
        encoding: null
    }, async (err, res, body) => {
        console.log('[KRUNKER] - Decoding Bytes...');

        let str = fromVries(body);

        console.log('[KRUNKER] - Formatting Code...');

        let { code } = await terser.minify(str, {
            compress: {
                join_vars: false,
                hoist_vars: true,
                reduce_vars: false,
                collapse_vars: false,
                sequences: false
            },
            mangle: {
                keep_classnames: true,
                keep_fnames: true
            },
            output: {
                beautify: true
            },
            parse: {},
            rename: {}
        });

        fs.writeFile('game.js', str, (err) => {
            if (err) throw err;
            console.log('[KRUNKER] - Saved original to game.js');
        });

        fs.writeFile('game_beautify.js', code, (err) => {
            if (err) throw err;
            console.log('[KRUNKER] - Saved beautified to game_beautify.js');
        });
    });
});
