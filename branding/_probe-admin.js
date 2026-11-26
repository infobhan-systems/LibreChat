const fs = require('fs');
const main = fs.readFileSync('/app/dist/client/assets/main-DtwN7LRi.js', 'utf8');

// Find la= definition (resources)
const laDef = main.search(/[,;]la=/);
console.log('laDef search', laDef);
// try several patterns
for (const pat of ['la={en:', 'var la=', 'let la=', 'const la=', ',la=', 'la=ea', 'ea={translation']) {
  const i = main.indexOf(pat);
  console.log(pat, i, i < 0 ? null : JSON.stringify(main.slice(i, i + 120)));
}

// Find around com_auth_title - what object it's in
const auth = main.indexOf('com_auth_title:`InfobhanAI Admin Panel`');
console.log('\nauth at', auth);
// walk backwards to object start
console.log(JSON.stringify(main.slice(auth - 80, auth + 60)));

// Find .use(initReactI18next) and .init
const useInit = main.indexOf('initReactI18next');
console.log('\ninitReactI18next', useInit, JSON.stringify(main.slice(useInit - 50, useInit + 200)));

const resourcesLa = main.indexOf('resources:la');
console.log('\nresources:la context', JSON.stringify(main.slice(resourcesLa - 300, resourcesLa + 100)));

// Is there another copy of Admin Panel as a value assigned to com_auth_title with different quoting after our patch?
const re = /com_auth_title[`"':\s]+([^,}`]+)/g;
let m;
while ((m = re.exec(main))) {
  console.log('auth match', m[0]);
}
