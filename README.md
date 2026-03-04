# PressToAi
CLI to bundle folders into an LLM-optimized single text file, and unbundle them back losslessly.

## Installation
Run the installer script:
```bash
./install.sh
```

## Usage (Bundle)
Bundle a project folder into a single token-optimized text file:
```bash
PressToAi /path/to/folder
```

## Usage (Unbundle)
Restore the exact folder structure losslessly from a generated text file:
```bash
PressToAi /path/to/folder_full4ai.txt
```
