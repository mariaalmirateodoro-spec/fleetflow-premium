#!/bin/bash
export PATH="/c/Program Files/nodejs:$PATH"
cd "/d/Car Rental - App"
echo "Running vercel deploy..."
npx vercel deploy --prod --yes 2>&1
echo "Exit: $?"
