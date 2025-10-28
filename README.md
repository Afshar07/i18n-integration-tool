# i18n Integration Tool

Automated i18n integration tool for Nuxt.js and Vue.js applications. Automatically scans your codebase for Persian/Arabic text, generates translation keys, and transforms your code to use i18n functions.

## Installation

### Global Installation
```bash
npm install -g i18n-integration-tool
```

### Local Installation (in your project)
```bash
npm install --save-dev i18n-integration-tool
```

### Use with npx (no installation required)
```bash
npx i18n-integration-tool --help
```

## Quick Start

### 1. Initialize Configuration
```bash
# Create default configuration file
i18n-integrate config init

# Or with npx
npx i18n-integration-tool config init
```

### 2. Run Complete Workflow
```bash
# Scan, generate keys, transform files, and validate
i18n-integrate full

# With custom directories
i18n-integrate full -d src components pages
```

### 3. Individual Commands
```bash
# Scan for Persian/Arabic text
i18n-integrate scan -d src components

# Generate translation keys
i18n-integrate generate -i scan-results.json

# Transform source files
i18n-integrate transform -i generated-keys.json

# Validate integration
i18n-integrate validate
```

## Usage in Different Projects

### Nuxt.js Project
```bash
cd /path/to/your/nuxt-project
npx i18n-integration-tool full -d components pages layouts plugins middleware
```

### Vue.js Project
```bash
cd /path/to/your/vue-project
npx i18n-integration-tool full -d src/components src/views src/router
```

### Custom Project Structure
```bash
npx i18n-integration-tool scan -d /absolute/path/to/project/src -o results.json
```

## Configuration

### Default Configuration
The tool creates a configuration file `i18n-integration.config.json`:

```json
{
  "sourceDirectories": [
    "components",
    "pages", 
    "layouts",
    "plugins",
    "middleware",
    "composables",
    "store"
  ],
  "excludePatterns": [
    "node_modules/**",
    ".nuxt/**",
    "dist/**",
    "**/*.test.ts"
  ],
  "locales": {
    "source": "fa",
    "target": "en"
  },
  "keyGeneration": {
    "strategy": "semantic",
    "maxLength": 50,
    "useContext": true
  },
  "fileProcessing": {
    "createBackups": true,
    "dryRun": false,
    "batchSize": 10
  },
  "translationFiles": {
    "directory": "assets/locales",
    "format": "json"
  }
}
```

### Custom Configuration
```bash
# Set specific values
i18n-integrate config set locales.source fa
i18n-integrate config set keyGeneration.strategy hash

# Use custom config file
i18n-integrate scan -c /path/to/custom-config.json
```

## Command Reference

### Global Options
- `-c, --config <path>` - Path to configuration file
- `-v, --verbose` - Enable verbose logging  
- `--dry-run` - Perform dry run without making changes

### Scan Command
```bash
i18n-integrate scan [options]

Options:
  -d, --directories <dirs...>  Directories to scan
  -e, --exclude <patterns...>  Patterns to exclude
  -o, --output <file>          Output results to file
  --format <format>            Output format (json|table|csv)
```

### Generate Command
```bash
i18n-integrate generate [options]

Options:
  -i, --input <file>           Input scan results file
  -o, --output <file>          Output generated keys file
  --strategy <strategy>        Key generation strategy
  --max-length <length>        Maximum key length
  --no-context                 Disable context-aware generation
```

### Transform Command
```bash
i18n-integrate transform [options]

Options:
  -i, --input <file>           Input generated keys file
  -d, --directories <dirs...>  Directories to transform
  --backup                     Create backups before transformation
  --no-backup                  Skip creating backups
```

### Validate Command
```bash
i18n-integrate validate [options]

Options:
  -d, --directories <dirs...>  Directories to validate
  --check-keys                 Check for missing translation keys
  --check-syntax               Validate transformed code syntax
  --check-duplicates           Check for duplicate translations
```

### Nuxt.js Integration Validation
```bash
i18n-integrate validate-nuxt [options]

Options:
  --test-locale-switching      Test locale switching functionality
  --test-fallback              Test fallback mechanisms  
  --test-hot-reload            Test hot-reloading functionality
  --timeout <ms>               Test timeout in milliseconds
  --nuxt-config <path>         Path to nuxt.config.ts file
  --translations-path <path>   Path to translation files directory
  -o, --output <file>          Output detailed validation report
  --format <format>            Output format (json|html)
```

### Full Workflow Command
```bash
i18n-integrate full [options]

Options:
  -d, --directories <dirs...>  Directories to process
  -e, --exclude <patterns...>  Patterns to exclude
  --skip-validation            Skip final validation step
  --interactive                Prompt for confirmation at each step
```

## Programmatic Usage

You can also use the tool programmatically in your Node.js applications:

```javascript
const { 
  WorkflowOrchestrator, 
  ConfigManager, 
  FileScanner, 
  KeyManager 
} = require('i18n-integration-tool');

async function processProject() {
  // Create configuration
  const configManager = new ConfigManager();
  await configManager.load();
  
  // Override directories
  configManager.updateConfig({
    sourceDirectories: ['./src', './components']
  });
  
  // Run complete workflow
  const orchestrator = new WorkflowOrchestrator(configManager);
  const result = await orchestrator.executeWorkflow({
    skipValidation: false,
    saveIntermediateResults: true
  });
  
  console.log('Workflow completed:', result.success);
  console.log('Files processed:', result.processedFiles);
}

processProject().catch(console.error);
```

### Individual Components

```javascript
// Scan only
const scanner = new FileScanner({
  directories: ['./src'],
  excludePatterns: ['**/*.test.*']
});
const scanResult = await scanner.scan();

// Generate keys only
const keyManager = new KeyManager({
  strategy: 'semantic',
  maxLength: 50,
  useContext: true
});
const keys = await keyManager.generateKeys(scanResult.matches);
```

## Examples

### Example 1: Process External Vue Project
```bash
# Navigate to your Vue project
cd /path/to/my-vue-project

# Run with custom directories
npx i18n-integration-tool full -d src/components src/views src/router

# Or specify absolute paths from anywhere
npx i18n-integration-tool full -d /path/to/my-vue-project/src
```

### Example 2: Scan Only and Save Results
```bash
npx i18n-integration-tool scan -d ./src -o scan-results.json --format json
```

### Example 3: Use in CI/CD Pipeline
```bash
# In your CI script
npm install -g i18n-integration-tool
i18n-integrate validate -d src components --check-keys --check-syntax
```

### Example 4: Custom Configuration for Different Projects
```bash
# Create project-specific config
echo '{
  "sourceDirectories": ["./app", "./shared"],
  "locales": {"source": "ar", "target": "en"},
  "translationFiles": {"directory": "./locales"}
}' > my-project-config.json

# Use custom config
npx i18n-integration-tool full -c my-project-config.json
```

### Example 5: Validate Nuxt.js Integration
```bash
# Basic Nuxt validation (config and files only)
npx i18n-integration-tool validate-nuxt --test-locale-switching=false --test-fallback=false --test-hot-reload=false

# Full Nuxt integration testing (starts dev server)
npx i18n-integration-tool validate-nuxt --timeout 60000

# Generate HTML report
npx i18n-integration-tool validate-nuxt -o nuxt-validation-report.html --format html
```

## Output Files

The tool generates several output files:

- **Translation files**: `assets/locales/fa.json`, `assets/locales/en.json`
- **Scan results**: JSON file with found text matches
- **Generated keys**: JSON file with translation keys
- **Reports**: HTML/JSON reports with statistics and recommendations
- **Backups**: Automatic backups of modified files (if enabled)

## Requirements

- Node.js 16+ 
- TypeScript projects or JavaScript projects with Babel
- Vue.js 3+ or Nuxt.js 3+ (for Vue file processing)

## License

MIT License - see LICENSE file for details.