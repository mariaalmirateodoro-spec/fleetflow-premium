#!/bin/bash
export PATH="/c/Program Files/nodejs:/c/Program Files/Git/bin:$PATH"
export HOME="/c/Users/PGIAlmira"
cd "/d/Car Rental - App"
echo "node version: $(node --version)"
echo "npx version: $(npx --version)"
npx --yes vercel@latest deploy --prod --yes 2>&1
echo "EXIT: $?"
