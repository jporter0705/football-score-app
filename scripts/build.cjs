const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const assets = ['index.html','weeks.js','sw.js','manifest.webmanifest','icon-192.png','icon-512.png'];
// Netlify can leave metadata from a prior build in the publish folder. Build a
// clean directory each time so only the explicitly listed public assets ship.
fs.rmSync(output, {recursive:true, force:true});
fs.mkdirSync(output, {recursive:true});
for (const name of assets) fs.copyFileSync(path.join(root,name),path.join(output,name));
console.log('Built v4.7.1: '+assets.length+' public app assets.');
