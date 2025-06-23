/**
 * Sidebar Components - Organized exports
 * 
 * This index file provides a clean interface for importing sidebar components
 * while maintaining the modular structure for better maintainability.
 */

// Core provider and hook
export { SidebarProvider, useSidebar } from './provider';

// Types and utilities  
export type { 
  SidebarContext, 
  SidebarProviderProps, 
  SidebarComponentProps,
  SidebarState 
} from './types';

export { 
  sidebarClasses, 
  createSidebarClass, 
  createSidebarDataAttributes 
} from './utils';

export type { SidebarComponentBase } from './utils';

// Re-export the original sidebar component
export { 
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger
} from '../sidebar';