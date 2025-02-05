'use client';

import React from 'react'; // ^18.0.0
import { ThemeProvider as NextThemeProvider } from 'next-themes'; // ^0.2.1
import { useReducedMotion, useIsHighContrast } from '@react-aria/utils'; // ^3.0.0
import theme, { 
  colors, 
  typography, 
  tokens, 
  animations 
} from '../config/theme.config';

/**
 * Enhanced theme context interface with accessibility features
 */
interface ThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
  systemTheme: string | undefined;
  themes: string[];
  isHighContrast: boolean;
  toggleHighContrast: () => void;
  prefersReducedMotion: boolean;
  themeTransition: string;
  getThemeToken: (token: string) => string;
}

/**
 * Extended props interface for ThemeProvider component
 */
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
  enableHighContrast?: boolean;
  enableAnimations?: boolean;
  themeTransitionDuration?: number;
}

/**
 * Enhanced React context for theme management
 */
const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

/**
 * HTML attribute for theme
 */
const THEME_ATTRIBUTE = 'data-theme';

/**
 * Default theme transition duration in milliseconds
 */
const TRANSITION_DURATION = 200;

/**
 * Enhanced custom hook for accessing theme context and accessibility features
 */
export const useTheme = (): ThemeContextType => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Enhanced theme provider component with Material Design 3.0 and accessibility features
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system',
  enableHighContrast = true,
  enableAnimations = true,
  themeTransitionDuration = TRANSITION_DURATION
}) => {
  // System preference detection
  const prefersReducedMotion = useReducedMotion();
  const systemHighContrast = useIsHighContrast();
  
  // Theme state management
  const [isHighContrast, setIsHighContrast] = React.useState(
    enableHighContrast && systemHighContrast
  );

  // Theme transition management
  const themeTransition = React.useMemo(() => {
    if (prefersReducedMotion || !enableAnimations) return 'none';
    return `all ${themeTransitionDuration}ms ${animations.easing.easeInOut}`;
  }, [prefersReducedMotion, enableAnimations, themeTransitionDuration]);

  // High contrast mode toggle
  const toggleHighContrast = React.useCallback(() => {
    if (!enableHighContrast) return;
    setIsHighContrast(prev => !prev);
  }, [enableHighContrast]);

  // Theme token utility
  const getThemeToken = React.useCallback((token: string): string => {
    return tokens[token] || '';
  }, []);

  // Context value
  const contextValue = React.useMemo((): ThemeContextType => ({
    theme: defaultTheme,
    setTheme: () => {},
    systemTheme: undefined,
    themes: ['light', 'dark', 'system'],
    isHighContrast,
    toggleHighContrast,
    prefersReducedMotion: Boolean(prefersReducedMotion),
    themeTransition,
    getThemeToken
  }), [
    defaultTheme,
    isHighContrast,
    toggleHighContrast,
    prefersReducedMotion,
    themeTransition,
    getThemeToken
  ]);

  // Apply Material Design 3.0 styles
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-transition', themeTransition);
    
    // Apply typography scale
    Object.entries(typography.fontSize).forEach(([key, value]) => {
      root.style.setProperty(`--font-size-${key}`, value);
    });

    // Apply color tokens
    Object.entries(colors).forEach(([key, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([shade, color]) => {
          root.style.setProperty(`--color-${key}-${shade}`, color);
        });
      }
    });
  }, [themeTransition]);

  return (
    <NextThemeProvider
      attribute={THEME_ATTRIBUTE}
      defaultTheme={defaultTheme}
      enableSystem
      value={{
        light: 'light',
        dark: 'dark',
        system: 'system',
        'high-contrast': isHighContrast ? 'high-contrast' : defaultTheme
      }}
    >
      <ThemeContext.Provider value={contextValue}>
        <div
          style={{ transition: themeTransition }}
          className="theme-root"
          data-high-contrast={isHighContrast}
          data-reduced-motion={prefersReducedMotion}
        >
          {children}
        </div>
      </ThemeContext.Provider>
    </NextThemeProvider>
  );
};

export default ThemeProvider;