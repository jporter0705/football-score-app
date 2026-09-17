const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const assets = ['index.html','weeks.js','sw.js','manifest.webmanifest','icon-192.png','icon-512.png'];
fs.mkdirSync(output, {recursive:true});
for (const name of fs.readdirSync(output)) {
  if (!assets.includes(name)) throw new Error('Unexpected file in publish directory: '+name);
}
for (const name of assets) fs.copyFileSync(path.join(root,name),path.join(output,name));
console.log('Built v4.6.0: '+assets.length+' public app assets.');
