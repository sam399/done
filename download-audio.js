const fs = require('fs');
const https = require('https');
const path = require('path');

const url = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav';
const dest = path.join(__dirname, 'assets', 'alarm.wav');

// Ensure assets directory exists
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

const file = fs.createWriteStream(dest);
https.get(url, function(response) {
  response.pipe(file);
  file.on('finish', function() {
    file.close();
    console.log('Download completed successfully: ' + dest);
  });
}).on('error', function(err) {
  fs.unlink(dest, () => {});
  console.error('Error downloading file:', err.message);
});
