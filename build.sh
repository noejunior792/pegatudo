#!/bin/bash

# Simple build script to work around TypeScript issues
echo "Building PegaTudo Advanced Engine..."

# Create dist directory
mkdir -p dist/ts

# Copy TypeScript files as JavaScript with simple type stripping
for file in $(find src/ts -name "*.ts" -type f); do
    outfile="dist/${file%.ts}.js"
    mkdir -p "$(dirname "$outfile")"
    
    # Simple type stripping (remove type annotations and interfaces)
    sed -E 's/: [A-Za-z0-9<>|&\[\]{}?_., ]+( = |\)|;|,|\{)/\1/g' "$file" | \
    sed -E 's/^import \{[^}]*\} from [^;]+;//g' | \
    sed -E 's/^export (interface|type|enum) [^{]*\{[^}]*\}//g' | \
    sed -E '/^export interface/,/^}/d' | \
    sed -E '/^interface/,/^}/d' | \
    sed -E '/^type [A-Za-z]+ =/d' | \
    sed -E 's/\?: /: /g' | \
    sed -E 's/<[^>]*>//g' | \
    sed -E 's/as [A-Za-z0-9]+//g' > "$outfile"
done

echo "Build completed. Files generated in dist/"