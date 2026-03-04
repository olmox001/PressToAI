#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
import chalk from 'chalk';
import {
    createPrompt,
    useState,
    useKeypress,
    usePrefix,
    isEnterKey,
    isUpKey,
    isDownKey,
    isSpaceKey
} from '@inquirer/core';

// Standard binary/ignored extensions
const IGNORE_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.mp4', '.avi', '.mov', '.mp3', '.wav', '.ogg',
    '.zip', '.tar', '.gz', '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.exe', '.dll', '.so', '.dylib', '.class', '.jar', '.pyc',
    '.ttf', '.otf', '.woff', '.woff2', '.eot'
]);

// Ignored directories
const IGNORE_DIRS = new Set([
    'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.next', '.nuxt'
]);

const CACHE_FILE = '.presstoai.json';

// --- Recursive File Find ---
function findFiles(dir, basePath, ig) {
    let results = [];
    const list = fs.readdirSync(dir);

    for (const file of list) {
        const fullPath = path.resolve(dir, file);
        const relPath = path.relative(basePath, fullPath);

        if (ig && ig.ignores(relPath)) {
            continue;
        }

        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (IGNORE_DIRS.has(file)) continue;
            results = results.concat(findFiles(fullPath, basePath, ig));
        } else {
            const ext = path.extname(file).toLowerCase();
            if (IGNORE_EXTS.has(ext)) continue;
            if (file === CACHE_FILE || file.endsWith('_full4ai.txt')) continue;

            results.push(relPath);
        }
    }
    return results;
}

// --- Format Output ---
function formatFileContent(relPath, fullPath) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    let formatted = `@@@ ${relPath} @@@\n`;

    for (let i = 0; i < lines.length; i++) {
        formatted += `${i + 1}:${lines[i]}\n`;
    }
    formatted += `\n`;
    return formatted;
}

// --- Tree Data Builder ---
function buildTree(files, knownMap) {
    const root = { type: 'directory', name: '.', path: '', expanded: true, children: [], level: -1 };

    for (const file of files) {
        const parts = file.split('/');
        let currentDir = root;
        let currentPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            const isFile = i === parts.length - 1;

            let node = currentDir.children.find(c => c.name === part);

            if (!node) {
                node = {
                    type: isFile ? 'file' : 'directory',
                    name: part,
                    path: currentPath,
                    level: currentDir.level + 1,
                    // Only root is expanded by default, others follow UX requirement
                    expanded: false
                };

                if (isFile) {
                    // Check cache. If new, selected by default.
                    node.selected = knownMap.has(currentPath) ? knownMap.get(currentPath) : true;
                    node.isNew = !knownMap.has(currentPath);
                } else {
                    node.children = [];
                }

                currentDir.children.push(node);
            }
            currentDir = node;
        }
    }

    // Sort: directories first, then files. Alphabetical within each type.
    const sortDir = (dir) => {
        dir.children.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        dir.children.forEach(c => {
            if (c.type === 'directory') sortDir(c);
        });
    };
    sortDir(root);

    return root.children; // Return children of virtual root
}


// --- Custom Tree Prompt ---
const treePrompt = createPrompt((config, done) => {
    const [items, setItems] = useState(config.items);
    const [cursor, setCursor] = useState(0);
    const [windowOffset, setWindowOffset] = useState(0);
    const MAX_LINES = 15;

    // Flatten currently visible items
    const getVisibleItems = (nodes) => {
        let visible = [];
        for (const node of nodes) {
            visible.push(node);
            if (node.type === 'directory' && node.expanded && node.children) {
                visible = visible.concat(getVisibleItems(node.children));
            }
        }
        return visible;
    };

    const visibleItems = getVisibleItems(items);
    // Ensure cursor bounds
    const currentCursor = Math.max(0, Math.min(cursor, visibleItems.length - 1));
    const currentItem = visibleItems[currentCursor];

    useKeypress((key, rl) => {
        if (isEnterKey(key)) {
            // Gather all selected files
            const getSelected = (nodes) => {
                let sel = [];
                for (const n of nodes) {
                    if (n.type === 'file' && n.selected) sel.push(n.path);
                    if (n.type === 'directory' && n.children) sel = sel.concat(getSelected(n.children));
                }
                return sel;
            };
            done(getSelected(items));
            return;
        }

        if (isUpKey(key)) {
            const nextCursor = (currentCursor - 1 + visibleItems.length) % visibleItems.length;
            setCursor(nextCursor);
            // Auto-scroll logic
            if (nextCursor < windowOffset) {
                setWindowOffset(nextCursor);
            } else if (nextCursor >= windowOffset + MAX_LINES) {
                setWindowOffset(nextCursor - MAX_LINES + 1);
            }
        } else if (isDownKey(key)) {
            const nextCursor = (currentCursor + 1) % visibleItems.length;
            setCursor(nextCursor);
            // Auto-scroll logic
            if (nextCursor >= windowOffset + MAX_LINES) {
                setWindowOffset(nextCursor - MAX_LINES + 1);
            } else if (nextCursor < windowOffset) {
                setWindowOffset(nextCursor);
            }
        } else if (key.name === 'right') {
            if (currentItem && currentItem.type === 'directory' && !currentItem.expanded) {
                const toggleNode = (nodes) => nodes.map(n => {
                    if (n.path === currentItem.path) return { ...n, expanded: true };
                    if (n.children) return { ...n, children: toggleNode(n.children) };
                    return n;
                });
                setItems(toggleNode(items));
            }
        } else if (key.name === 'left') {
            if (currentItem && currentItem.type === 'directory' && currentItem.expanded) {
                const toggleNode = (nodes) => nodes.map(n => {
                    if (n.path === currentItem.path) return { ...n, expanded: false };
                    if (n.children) return { ...n, children: toggleNode(n.children) };
                    return n;
                });
                setItems(toggleNode(items));
            }
        } else if (isSpaceKey(key)) {
            // Determine what to toggle to
            let forceState = undefined;

            // If folder, recursively determine state: if *all* files are selected, we deselect. Otherwise select.
            if (currentItem.type === 'directory') {
                const countSelected = (nodes) => {
                    let total = 0, selected = 0;
                    for (const n of nodes) {
                        if (n.type === 'file') { total++; if (n.selected) selected++; }
                        if (n.type === 'directory' && n.children) {
                            const sub = countSelected(n.children);
                            total += sub.total;
                            selected += sub.selected;
                        }
                    }
                    return { total, selected };
                };
                const stats = countSelected(currentItem.children);
                // If all selected, force false. Otherwise force true.
                forceState = stats.selected < stats.total;
            } else {
                forceState = !currentItem.selected;
            }

            const toggleSelection = (nodes, targetPath) => {
                return nodes.map(n => {
                    if (n.path === targetPath || targetPath.startsWith(n.path + '/')) {
                        if (n.path === targetPath) {
                            if (n.type === 'file') return { ...n, selected: forceState };
                            if (n.type === 'directory') {
                                const setAll = (children) => children.map(c => ({
                                    ...c,
                                    selected: c.type === 'file' ? forceState : undefined,
                                    children: c.children ? setAll(c.children) : undefined
                                }));
                                return { ...n, children: setAll(n.children) };
                            }
                        }
                        if (n.children) return { ...n, children: toggleSelection(n.children, targetPath) };
                    }
                    return n;
                });
            };

            setItems(toggleSelection(items, currentItem.path));
        }
    });

    const prefix = usePrefix({});

    const windowedItems = visibleItems.slice(windowOffset, windowOffset + MAX_LINES);

    const lines = windowedItems.map((item, index) => {
        const isPointer = (index + windowOffset) === currentCursor;
        const pointer = isPointer ? chalk.cyan('❯') : ' ';
        const indent = '  '.repeat(item.level);

        let line = '';
        if (item.type === 'directory') {
            const icon = item.expanded ? '▼' : '▶';
            // Sub-count
            const countSelected = (nodes) => {
                let t = 0, s = 0;
                for (const n of nodes) {
                    if (n.type === 'file') { t++; if (n.selected) s++; }
                    if (n.type === 'directory' && n.children) {
                        const sub = countSelected(n.children);
                        t += sub.t; s += sub.s;
                    }
                }
                return { t, s };
            }
            const st = countSelected(item.children);

            line = `${indent}${icon} ${chalk.bold(item.name)} ${chalk.dim(`[${st.s}/${st.t} files]`)}`;

            if (isPointer) line = chalk.cyan(line);
        } else {
            const icon = item.selected ? chalk.green('◉') : chalk.dim('◯');
            const namePart = item.isNew ? chalk.yellowBright(item.name + ' (new)') : item.name;

            line = `${indent}${icon} ${namePart}`;
            if (isPointer) {
                line = `${indent}${icon} ${chalk.cyan(item.name)}`;
            }
        }

        return `${pointer} ${line}`;
    });

    let helpMsg = chalk.dim('\n(Arrows: Navigate, Right/Left: Expand/Collapse, Space: Select, Enter: Proceed)');
    if (visibleItems.length > MAX_LINES) {
        helpMsg += chalk.dim(`\nShowing ${windowOffset + 1}-${Math.min(windowOffset + MAX_LINES, visibleItems.length)} of ${visibleItems.length}`);
    }

    return `${prefix} ${chalk.bold(config.message)}\n${lines.join('\n')}${helpMsg}`;
});

// --- Unbundle Logic ---
function unbundle(txtFilePath) {
    const content = fs.readFileSync(txtFilePath, 'utf8');
    const lines = content.split('\n');

    // Create base folder from filename
    const baseName = path.basename(txtFilePath, '.txt').replace('_full4ai', '');
    const outDir = path.resolve(path.dirname(txtFilePath), `${baseName}_reconstructed`);

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    let currentFile = null;
    let currentContent = [];
    let filesCreated = 0;

    const flushFile = () => {
        if (currentFile && currentContent.length > 0) {
            const outPath = path.join(outDir, currentFile);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });

            // Reconstruct the exact string. If the original had a trailing trailing newline,
            // it means the final split line was an empty string. The array join('\n') 
            // implicitly puts it back together perfectly IF we just join what we collected.
            fs.writeFileSync(outPath, currentContent.join('\n'), 'utf8');
            filesCreated++;
        }
    };

    const headerRegex = /^@@@\s+(.+?)\s+@@@$/;
    // Strict requirement: N:content
    const codeLineRegex = /^(\d+):(.*)$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const headerMatch = line.match(headerRegex);
        if (headerMatch) {
            flushFile();
            currentFile = headerMatch[1];
            currentContent = [];
            continue;
        }

        if (currentFile) {
            const codeMatch = line.match(codeLineRegex);
            if (codeMatch) {
                // Ignore the line number logic and just push the content string
                currentContent.push(codeMatch[2]);
            } else {
                // Blank lines between files etc
            }
        }
    }
    flushFile();

    console.log(`\n✅ Unbundled ${filesCreated} files successfully into:`);
    console.log(outDir);
}

// --- Main ---

async function run() {
    const targetDirInput = process.argv[2] || process.cwd();

    // --- Help / Doc Flags ---
    if (['-h', '--help', '-d', '--doc'].includes(targetDirInput.toLowerCase())) {
        console.log(`
${chalk.bold.green('PressToAi')} - The LLM-optimized project un/bundler.

${chalk.bold('USAGE:')}
  PressToAi [path]

${chalk.bold('COMMANDS:')}
  ${chalk.cyan('PressToAi')}                       Launch in the current directory.
  ${chalk.cyan('PressToAi /path/to/folder')}       Launch targetting a specific folder.
  ${chalk.cyan('PressToAi /path/to/bundle.txt')}   Unbundle (reverse) a previously generated bundle.
  ${chalk.cyan('PressToAi --help')}                Show this documentation.

${chalk.bold('FEATURES:')}
  - Interactive Tree View for selecting/excluding files.
  - Generates \`[folder]_full4ai.txt\` optimized for LLM token limits.
  - Caches your selections in \`.presstoai.json\` across runs.
  - Lossless inverse reconstruction (Unbundling) to exactly rebuild projects.
`);
        process.exit(0);
    }

    const targetPath = path.resolve(targetDirInput);

    if (!fs.existsSync(targetPath)) {
        console.error(chalk.red(`\n❌ Errore: Il progetto o il file specificato non è stato trovato.`));
        console.error(chalk.yellow(`Hai cercato in: ${targetPath}`));
        console.error(chalk.cyan(`Controlla che il percorso sia corretto e riprova!\n`));
        process.exit(1);
    }

    const stat = fs.statSync(targetPath);

    if (stat.isFile() && targetPath.endsWith('.txt')) {
        console.log(`\nPressToAi: Unbundle mode detected for ${targetPath}`);
        unbundle(targetPath);
        return;
    }

    if (!stat.isDirectory()) {
        console.error(`Error: Path is not a directory or a valid .txt bundle: ${targetPath}`);
        process.exit(1);
    }

    const targetDir = targetPath;
    const folderName = path.basename(targetDir);
    const cachePath = path.join(targetDir, CACHE_FILE);
    const outputPath = path.join(targetDir, `${folderName}_full4ai.txt`);

    // Load .gitignore
    let ig = ignore();
    const gitignorePath = path.join(targetDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        ig.add(fs.readFileSync(gitignorePath, 'utf8'));
    }

    // Find all files
    const currentFiles = findFiles(targetDir, targetDir, ig);

    if (currentFiles.length === 0) {
        console.log('No text files found to process.');
        return;
    }

    // Load cache
    let cache = {};
    if (fs.existsSync(cachePath)) {
        try {
            cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        } catch (e) {
            // Ignore
        }
    }

    const knownFilesMap = new Map();
    for (const item of (cache.files || [])) {
        knownFilesMap.set(item.path, item.selected);
    }

    // Build Tree
    const treeData = buildTree(currentFiles, knownFilesMap);

    // Prompt Custom Tree
    console.log(`\nPressToAi: Selecting files from ${targetDir}`);
    console.log(`Output will be written to ${outputPath}\n`);

    const selectedPaths = await treePrompt({
        message: 'Select files to include in the LLM text bundle:',
        items: treeData
    });

    // Save Cache
    const selectedSet = new Set(selectedPaths);
    const updatedCacheFiles = currentFiles.map(file => ({
        path: file,
        selected: selectedSet.has(file)
    }));

    fs.writeFileSync(cachePath, JSON.stringify({ files: updatedCacheFiles }, null, 2));

    if (selectedPaths.length === 0) {
        console.log('No files selected. Exiting.');
        return;
    }

    // Output Generation
    let finalBundle = '';
    finalBundle += `# PressToAi Bundle\n`;
    finalBundle += `Dir: ${targetDir}\n`;
    finalBundle += `Files: ${selectedPaths.length}\n\n`;

    console.log('\nProcessing files...');
    for (const relPath of selectedPaths) {
        const fullPath = path.join(targetDir, relPath);
        try {
            finalBundle += formatFileContent(relPath, fullPath);
        } catch (e) {
            console.warn(`Failed to process ${relPath}: ${e.message}`);
        }
    }

    fs.writeFileSync(outputPath, finalBundle);
    console.log(`\n✅ Successfully created LLM bundle at:`);
    console.log(outputPath);
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
