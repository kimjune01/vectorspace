/**
 * Sidebar utility functions and shared patterns
 */

import { cn } from "@/lib/utils";

/**
 * Common CSS classes used across sidebar components
 */
export const sidebarClasses = {
  // Icon styling for sidebar components
  icon: "[&>svg]:size-4 [&>svg]:shrink-0",
  
  // Collapsible behavior classes
  collapsibleIcon: "group-data-[collapsible=icon]:hidden",
  collapsibleIconOnly: "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2",
  
  // Transition classes
  transition: "transition-all duration-200 ease-in-out",
  
  // Focus and hover states
  focusRing: "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  
  // Mobile responsive classes
  mobileHidden: "md:flex",
  mobileVisible: "md:hidden",
} as const;

/**
 * Helper function to create consistent sidebar component classes
 */
export function createSidebarClass(
  baseClass: string,
  ...additionalClasses: (string | undefined)[]
): string {
  return cn(
    baseClass,
    sidebarClasses.transition,
    ...additionalClasses
  );
}

/**
 * Helper function to create data attributes for sidebar components
 */
export function createSidebarDataAttributes(componentName: string) {
  return {
    "data-sidebar": componentName,
  };
}

/**
 * Utility type for sidebar component props with common patterns
 */
export interface SidebarComponentBase extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}