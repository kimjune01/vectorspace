# VectorSpace Frontend

React + TypeScript frontend for the VectorSpace conversation discovery platform.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm run dev
```

The frontend will be available at http://localhost:5173

## Testing

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:coverage
```

## Building

```bash
# Build for production
pnpm run build

# Preview production build locally
pnpm run preview
```

## Key Features

- **Authentication** - Complete login/register flows with form validation
- **Conversation Discovery** - Browse and search public conversations
- **Semantic Search** - Real-time search with vector embeddings
- **Real-time Chat** - WebSocket integration with AI streaming responses
- **User Profiles** - Customizable profiles with image upload
- **Responsive Design** - Mobile-first approach with Tailwind CSS
- **Type Safety** - Full TypeScript coverage throughout

## Technology Stack

- **Vite** - Fast development and optimized builds
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Full type safety and IntelliSense
- **shadcn/ui** - Modern, accessible component library
- **Tailwind CSS** - Utility-first styling with design system
- **TanStack Query** - Server state management and caching
- **React Router** - Client-side routing with protected routes
- **Zustand** - Lightweight state management

## Architecture

### Components
- **UI Components** - Reusable shadcn/ui components in `/src/components/ui/`
- **Feature Components** - Page-specific components in `/src/components/`
- **Pages** - Route components in `/src/pages/`
- **Hooks** - Custom React hooks in `/src/hooks/`
- **Utils** - Helper functions in `/src/lib/`

### State Management
- **TanStack Query** - Server state, caching, and API calls
- **Zustand** - Client state (auth, UI state)
- **React Context** - Authentication context and protected routes

### Styling
- **Tailwind CSS** - Utility-first CSS framework
- **CSS Variables** - Dark/light theme support
- **Component Variants** - Type-safe component styling with class-variance-authority

## API Integration

The frontend integrates with the FastAPI backend:

- **Base URL**: `http://localhost:8000/api`
- **Authentication**: JWT Bearer tokens
- **WebSocket**: Real-time chat at `ws://localhost:8000/api/ws/conversations/{id}`
- **Error Handling**: Consistent error responses with proper HTTP status codes

## Development Guidelines

- **TypeScript First** - All components and functions are fully typed
- **Component Composition** - Prefer composition over inheritance
- **Responsive Design** - Mobile-first approach with breakpoint utilities
- **Accessibility** - ARIA labels and keyboard navigation support
- **Testing** - Unit tests for components and integration tests for workflows

## Production Deployment

For production deployment:

1. Build the application: `pnpm run build`
2. The `dist/` folder contains the static assets ready for deployment
3. Configure your web server to serve the SPA with proper routing fallbacks
4. Update the API base URL in the environment configuration

### Environment Variables

```bash
# API base URL (optional, defaults to localhost:8000)
VITE_API_BASE_URL=https://your-api-domain.com

# WebSocket URL (optional, defaults to localhost:8000)
VITE_WS_BASE_URL=wss://your-api-domain.com
```

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

All modern browsers with ES2020 support and WebSocket capabilities.