const fs = require('fs');
const path = require('path');

const panelPath = path.join(__dirname, '..', 'src', 'components', 'CollaborationThreadPanel.tsx');
const content = fs.readFileSync(panelPath, 'utf8');

const checks = [
  {
    name: 'Thread switch resets scroll readiness before render',
    test: /useLayoutEffect\(\(\) => \{\s*setIsScrollReady\(false\);[\s\S]*\}, \[businessId, entityType, entityId\]\);/m,
  },
  {
    name: 'Messages reveal only after bottom scroll is applied',
    test: /scrollThreadToBottom\(false, \(\) => \{\s*[\s\S]*setIsScrollReady\(true\);[\s\S]*\}\);/m,
  },
  {
    name: 'Image bubbles reserve fixed size during async image loading',
    test: /width:\s*220,\s*[\s\S]*height:\s*170,/m,
  },
  {
    name: 'Image loader placeholder is present',
    test: /<ActivityIndicator[\s\S]*size="small"/m,
  },
  {
    name: 'Thread Info uses full-screen mode on narrow web viewport',
    test: /const isNarrowWebViewport = Platform\.OS === 'web' && Dimensions\.get\('window'\)\.width <= 900;/,
  },
  {
    name: 'Thread Info modal animation is disabled',
    test: /visible=\{showThreadInfo && useFullscreenThreadInfo\}[\s\S]*animationType="none"/m,
  },
];

const failures = checks.filter((entry) => !entry.test.test(content));

if (failures.length > 0) {
  console.error('Thread regression smoke checks failed:');
  failures.forEach((failure) => {
    console.error(`- ${failure.name}`);
  });
  process.exit(1);
}

console.log(`Thread regression smoke checks passed (${checks.length} checks).`);
