# Chess.com Stats Viewer - Developer Guide

## Commands
- **Run locally**: Open `index.html` in a browser
- **Deploy**: Upload all files to a web server

## Code Style Guidelines

### JavaScript
- Use ES6 module syntax for imports/exports (`import`, `export`)
- Camel case for variable/function names (`usernamesToNames`, `fetchStats`)
- Arrow functions for methods and callbacks
- 4-space indentation
- Single quotes for strings
- Descriptive function and variable names
- Methods grouped by functionality in Vue components
- Use try/catch for error handling with API calls
- Console.error for logging errors

### CSS
- Class-based styling (BEM-like naming with double underscore for variants)
- Mobile-first responsive design with @media queries
- Colors defined using hex values or named CSS colors
- Flexbox for layouts

### HTML
- Vue.js templates with v-for, v-if directives
- Semantic HTML elements (table, section, header)
- Classes for styling, not inline styles
- Bind events with @ syntax (@click)

### Architecture
- Vue.js for UI components and reactivity
- Modular code organization (services, utils)
- Config file for constants and configuration
- API services isolated in separate modules
- Utility functions for reusable logic

### Data Flow
- Use Vue data properties for state management
- Computed properties for derived values
- Methods for user interactions and API calls
- ChessApi service for external API communication