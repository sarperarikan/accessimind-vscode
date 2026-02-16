const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'fix-log.txt');
fs.writeFileSync(logPath, '');
const log = (msg) => fs.appendFileSync(logPath, msg + '\n');

const extPath = path.join(__dirname, 'src', 'extension.ts');
let lines = fs.readFileSync(extPath, 'utf-8').split('\n');
log('Total lines before: ' + lines.length);

// 1. Remove wrongly placed status bar item (around lines 1228-1236)
let removed = 0;
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('showInBrowserStatusBarItem') ||
        lines[i].trim() === '// Show in Browser status bar item') {
        lines.splice(i, 1);
        removed++;
    }
}
// Also remove any empty lines that were part of the insertion
log('Removed ' + removed + ' wrongly placed status bar lines');

// 2. Remove wrongly placed fs and path imports (they were added to wrong place)
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === "import * as fs from \"fs\";" ||
        lines[i].trim() === "import * as path from \"path\";") {
        lines.splice(i, 1);
        log('Removed wrong import at line ' + (i + 1));
    }
}

// 3. Find the correct initializeStatusBar function and add status bar item
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function initializeStatusBar(context:')) {
        // Find the closing of this function (statusBarItem.show() followed by })
        for (let j = i; j < i + 30; j++) {
            if (lines[j] && lines[j].includes('statusBarItem.show()')) {
                // Insert before the closing }
                const statusBarCode = [
                    '',
                    '\t// Show in Browser status bar item',
                    "\tconst showInBrowserStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);",
                    "\tshowInBrowserStatusBarItem.command = 'wcagEnhancer.showInBrowser';",
                    "\tshowInBrowserStatusBarItem.text = '$(globe) Preview';",
                    "\tshowInBrowserStatusBarItem.tooltip = 'AccessiMind: Show in Browser - Live preview';",
                    "\tshowInBrowserStatusBarItem.show();",
                    "\tcontext.subscriptions.push(showInBrowserStatusBarItem);",
                ];
                // Insert after statusBarItem.show() line
                lines.splice(j + 1, 0, ...statusBarCode);
                log('Inserted status bar item after line ' + (j + 1) + ' in initializeStatusBar');
                break;
            }
        }
        break;
    }
}

// 4. Fix the showInBrowser function to use require() instead of imports 
// Find the showInBrowser function and update it to use require
let content = lines.join('\n');
// Replace "const os = require('os');" pattern - it should work but also need path and fs
// The function uses path, fs, and os. We need to use require() inside the function.
content = content.replace(
    /async function showInBrowser\(\): Promise<void> \{/,
    `async function showInBrowser(): Promise<void> {\n\tconst path = require('path');\n\tconst fs = require('fs');`
);
log('Added require statements to showInBrowser function');

fs.writeFileSync(extPath, content, 'utf-8');
log('Saved');

// Verify
const final = fs.readFileSync(extPath, 'utf-8');
log('Has showInBrowser with require: ' + final.includes("const path = require('path')"));
log('Has status bar in initializeStatusBar: ' + (final.indexOf('showInBrowserStatusBarItem') > final.indexOf('function initializeStatusBar')));
log('No standalone fs import: ' + !final.includes('import * as fs from'));
