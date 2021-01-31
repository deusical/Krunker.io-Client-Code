const terser = require('terser');
const request = require('request');
const fs = require('fs');

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

function fromVries(bytes, keys) {
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

console.log('[KRUNKER] - Fetching XOR Keys...');

request.get('https://krunker.io/pkg/loader.wasm', (err, res, body) => {
    let keyString = body.match(/[a-f0-9]{100}/)[0];
    let keys = Buffer.from(keyString);

    console.log('[KRUNKER] - Got XOR Keys (%s)', keyString);
    console.log('[KRUNKER] - Fetching Version...');

    request.get('https://krunker.io/social.html', (err, res, body) => {
        let version = body.match(/(?<=\w+.exports=")[^"]+/)[0];

        console.log('[KRUNKER] - Got Version (%s)', version);

        request.get(`https://krunker.io/pkg/krunker.${version}.vries`, {
            encoding: null
        }, async (err, res, body) => {
            console.log('[KRUNKER] - Decoding Bytes...');

            let str = fromVries(body, keys);

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

            let gameVersion = code.match(/(?<=gameVersion\s=\s")[^"]+/)[0];

            if (!fs.existsSync('output')) fs.mkdirSync('output');
            if (!fs.existsSync(`output/${gameVersion}`)) fs.mkdirSync(`output/${gameVersion}`);

            fs.writeFile(`output/${gameVersion}/game.${version}.js`, str, (err) => {
                if (err) throw err;
                console.log('[KRUNKER] - Saved original to output/%s/game.%s.js', gameVersion, version);
            });

            fs.writeFile(`output/${gameVersion}/game_beautify.${version}.js`, code, (err) => {
                if (err) throw err;
                console.log('[KRUNKER] - Saved beautified to output/%s/game_beautify.%s.js', gameVersion, version);
            });
        });
    });
});
