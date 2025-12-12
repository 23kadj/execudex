#!/bin/bash
# Ensure .expo directories exist with proper permissions before prebuild
mkdir -p .expo/web
chmod -R 755 .expo 2>/dev/null || true
echo "✅ .expo directory structure created"

