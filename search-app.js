const fs = require('fs');
const content = fs.readFileSync('App.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('Push') || line.includes('Listener')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
