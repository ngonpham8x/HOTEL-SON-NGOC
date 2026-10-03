import { createContext } from 'react';
import type { HotelContextType } from './HotelContext';

// Preserve context identity when Vite refreshes the provider or its exported hook.
export const HotelContext = createContext<HotelContextType | undefined>(undefined);
