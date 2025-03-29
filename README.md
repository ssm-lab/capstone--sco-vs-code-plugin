# EcoOptimizer VS Code Extension

A Visual Studio Code extension that helps developers write more energy-efficient code by detecting code smells and suggesting refactoring opportunities. This extension integrates with the EcoOptimizer refactoring tool to provide real-time feedback and improvements for your Python codebase.

## Features

- **Code Smell Detection**: Automatically detects energy-inefficient patterns in your Python code
- **Refactoring Suggestions**: Provides actionable refactoring recommendations to improve code efficiency
- **Carbon Metrics**: Tracks and displays the potential energy savings from your refactoring efforts
- **Customizable Filters**: Configure which code smells to detect and analyze
- **Interactive UI**: Dedicated views for refactoring details, code smells, and metrics

## Prerequisites

- Visual Studio Code 
- Python environment with EcoOptimizer package installed
- npm for extension development

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/your-repo/ecooptimizer-vs-code-plugin.git
   cd ecooptimizer-vs-code-plugin
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Compile the extension:
   ```
   npm run compile   
   ```

## Usage

1. Open your Python project in VS Code
2. Start the EcoOptimizer development server:
   ```bash
   python -m ecooptimizer.api.main
   ```

3. Press `F5` to start the extension in a new VS Code window
4. Use the sidebar to use the features

## Development

### Project Structure

- `src/`: Source code for the extension
  - `api/`: API integration with EcoOptimizer
  - `commands/`: VS Code command implementations
  - `providers/`: TreeView providers for the UI
  - `ui/`: UI components and views
  - `utils/`: Utility functions
  - `extension.ts`: Main extension entry point

### Available Scripts

- `npm run compile`: Compile the extension
- `npm run watch`: Watch for changes and recompile
- `npm test`: Run tests
- `npm run lint`: Run ESLint
- `npm run package`: Create production build

### Testing

The project uses Jest for testing. Run tests with:
```bash
npm test
```

## Contributors

- Sevhena Walker
- Tanveer Brar
- Ayushi Amin
- Mya Hussain
- Nivetha Kuruparan
