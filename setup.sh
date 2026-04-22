#!/bin/bash
set -e
cd /Users/joenne/Documents/dev/obsidian-coffeelang

# Install dependencies
npm install

# Init git if needed and commit
if [ ! -d .git ]; then
  git init
  git remote add origin https://github.com/joennespreuwers/obsidian-coffeelang.git
fi

git add manifest.json versions.json package.json tsconfig.json esbuild.config.mjs .gitignore styles.css src/
git commit -m "Implement coffeelang Obsidian plugin: parser, syntax highlighting, preview views

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push -u origin main
