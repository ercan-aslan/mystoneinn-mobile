import React, { createContext, useContext } from 'react';

export const NavigationContext = createContext({
  openReservation: () => {},
  navigateTo: () => {},
});

export function useAppNavigation() {
  return useContext(NavigationContext);
}
