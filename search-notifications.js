const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // Look for calls to addPushTokenListener, getExpoPushTokenAsync, etc.
      if (content.includes('addPushTokenListener(') || content.includes('.addPushTokenListener(')) {
        console.log(`Found addPushTokenListener in: ${fullPath}`);
      }
    }
  }
}

searchDir('node_modules/expo-notifications');
