import React from 'react';
import { Image, StyleSheet } from 'react-native';

/**
 * Icona principale dell'app Twensa (porta tunisina stilizzata)
 * Logo che rappresenta Sidi Bou Said con colori blu gradient
 * #0066CC → #00CCFF (tech feel)
 */
const HomeIcon = ({ size = 40 }) => {
  return (
    <Image
      source={require('../assets/icon.png')}
      style={[styles.icon, { width: size, height: size }]}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  icon: {
    borderRadius: 8,
  },
});

export default HomeIcon;
