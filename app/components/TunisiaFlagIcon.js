import React from 'react';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

/**
 * Icona della bandiera della Tunisia a forma di cerchio
 * Caratteristiche:
 * - Cerchio rosso esterno
 * - Cerchio bianco interno
 * - Mezza luna rossa a sinistra
 * - Stella a 5 punte rossa a destra
 * 
 * @param {number} size - Dimensione dell'icona (default: 24)
 * @param {string} color - Colore del bordo (opzionale)
 */
const TunisiaFlagIcon = ({ size = 24, color }) => {
  const center = size / 2;
  const radius = size / 2 - 1;
  
  // Colori bandiera Tunisia
  const redColor = '#E70013';    // Rosso tunisino
  const whiteColor = '#FFFFFF';  // Bianco

  // Dimensioni relative
  const whiteCircleRadius = radius * 0.42;
  const crescentRadius = radius * 0.18;
  const starSize = radius * 0.16;
  const offset = radius * 0.08; // Spostamento laterale

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Cerchio rosso esterno (sfondo) */}
      <Circle
        cx={center}
        cy={center}
        r={radius}
        fill={redColor}
        stroke={color || redColor}
        strokeWidth={1}
      />
      
      {/* Cerchio bianco interno (centro) */}
      <Circle
        cx={center}
        cy={center}
        r={whiteCircleRadius}
        fill={whiteColor}
      />
      
      {/* Mezzaluna rossa - posizionata a sinistra */}
      <Path
        d={`
          M ${center - offset - crescentRadius * 0.3} ${center - crescentRadius}
          A ${crescentRadius} ${crescentRadius} 0 1 1 ${center - offset - crescentRadius * 0.3} ${center + crescentRadius}
          A ${crescentRadius * 0.85} ${crescentRadius * 0.85} 0 1 0 ${center - offset - crescentRadius * 0.3} ${center - crescentRadius}
          Z
        `}
        fill={redColor}
      />
      
      {/* Stella a 5 punte rossa - posizionata a destra */}
      <Polygon
        points={`
          ${center + offset + starSize * 0.3},${center - starSize * 0.9}
          ${center + offset + starSize * 0.6},${center - starSize * 0.3}
          ${center + offset + starSize * 1.2},${center - starSize * 0.3}
          ${center + offset + starSize * 0.7},${center + starSize * 0.1}
          ${center + offset + starSize * 0.85},${center + starSize * 0.7}
          ${center + offset + starSize * 0.3},${center + starSize * 0.4}
          ${center + offset - starSize * 0.25},${center + starSize * 0.7}
          ${center + offset - starSize * 0.1},${center + starSize * 0.1}
          ${center + offset - starSize * 0.6},${center - starSize * 0.3}
          ${center + offset},${center - starSize * 0.3}
        `}
        fill={redColor}
      />
    </Svg>
  );
};

export default TunisiaFlagIcon;
