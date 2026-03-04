import React, { createContext, useContext, useState, useCallback } from 'react';

const NavigationContext = createContext({
  currentRouteName: null,
  setCurrentRouteName: () => {},
});

export const NavigationProvider = ({ children }) => {
  const [currentRouteName, setCurrentRouteName] = useState(null);

  const setRoute = useCallback((routeName) => {
    setCurrentRouteName(routeName);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        currentRouteName,
        setCurrentRouteName: setRoute,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigationContext = () => useContext(NavigationContext);
