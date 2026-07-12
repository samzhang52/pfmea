const fs = require('fs');
const path = require('path');
const base = 'C:/Users/vv/Documents/Pfmea生成/pfmea-generator';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Step 1: Replace literal \n (backslash + n) with actual newline
  // but only when followed by 'import' (our injected code)
  content = content.replace(/;\\\\nimport/g, ';\nimport');
  
  // Step 2: Fix .join('\n') that got split into two lines
  content = content.replace(/\.join\(\s*\n\s*\);/g, ".join('\n');");
  
  // Step 3: For remaining literal \n that should be newlines (in import areas)
  // Use a careful approach: replace \n only when preceded by ';' and followed by a word
  content = content.replace(/;\\n([a-zA-Z])/g, ';\n$1');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed: ' + path.basename(filePath));
}

fixFile(path.join(base, 'src/pages/SopPage.jsx'));
fixFile(path.join(base, 'src/pages/PfmeaPage.jsx'));
console.log('Done');
