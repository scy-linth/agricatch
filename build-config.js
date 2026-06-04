const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'frontend', 'js', 'config.js');
const siteKey = process.env.RECAPTCHA_SITE_KEY || '6Ldmst0sAAAAAAV8rDvnnbsHQ1nJvvaiy2xfOZWj';

const configContent = `window.agriCatchConfig = {
  RECAPTCHA_SITE_KEY: '${siteKey}'
};
`;

fs.writeFileSync(configPath, configContent, 'utf8');
console.log('✅ config.js generated');
