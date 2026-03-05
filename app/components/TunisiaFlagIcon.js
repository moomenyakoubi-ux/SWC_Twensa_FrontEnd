import React from 'react';
import Svg, { Circle, Path, Polygon, Defs, ClipPath, G } from 'react-native-svg';

/**
 * Icona della bandiera della Tunisia a forma di cerchio
 * Bandiera ufficiale della Tunisia:
 * - Sfondo rosso
 * - Disco bianco centrale
 * - Mezzaluna rossa (concavità a destra)
 * - Stella a 5 punte rossa
 */
const TunisiaFlagIcon = ({ size = 24, color, isHome = false }) => {
  // Scala per il tasto Home (leggermente più grande delle altre icone)
  const scale = isHome ? 1.15 : 1.0;
  const s = size * scale;
  
  // Colore rosso ufficiale Tunisia
  const RED = '#E70013';
  const WHITE = '#FFFFFF';
  
  // Centro e raggio
  const cx = s / 2;
  const cy = s / 2;
  const r = (s / 2) - (isHome ? 1.5 : 1);
  
  // Raggi proporzionali (ingranditi)
  const whiteRadius = r * 0.52;      // Cerchio bianco più grande
  const moonRadius = r * 0.28;       // Raggio mezzaluna più grande
  const starRadius = r * 0.18;       // Raggio stella più grande
  
  // Posizioni: mezzaluna a sinistra, stella a destra
  const moonX = cx - r * 0.08;       // Leggermente a sinistra del centro
  const starX = cx + r * 0.15;       // A destra della mezzaluna
  
  // Genera i punti della stella a 5 punte
  const getStarPoints = (centerX, centerY, outerRadius, innerRadius) => {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * 36 - 90) * (Math.PI / 180); // -90 per puntare in alto
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      points.push(`${centerX + radius * Math.cos(angle)},${centerY + radius * Math.sin(angle)}`);
    }
    return points.join(' ');
  };

  return (
    <Svg 
      width={s} 
      height={s} 
      viewBox={`0 0 ${s} ${s}`}
      style={isHome ? { marginTop: -3, marginBottom: -3 } : {}}
    >
      <Defs>
        <ClipPath id="circleClip">
          <Circle cx={cx} cy={cy} r={r} />
        </ClipPath>
      </Defs>
      
      {/* Sfondo rosso */}
      <Circle 
        cx={cx} 
        cy={cy} 
        r={r} 
        fill={RED}
        stroke={color || RED}
        strokeWidth={isHome ? 1.5 : 1}
      />
      
      {/* Disco bianco centrale */}
      <Circle 
        cx={cx} 
        cy={cy} 
        r={whiteRadius} 
        fill={WHITE}
      />
      
      {/* Mezzaluna rossa - corretta: concavità verso destra */}
      {/* Due cerchi sovrapposti per creare la mezzaluna */}
      <G>
        {/* Cerchio rosso pieno */}
        <Circle 
          cx={moonX} 
          cy={cy} 
          r={moonRadius} 
          fill={RED}
        />
        {/* Cerchio bianco che "taglia" per fare la mezzaluna */}
        <Circle 
          cx={moonX + moonRadius * 0.35} 
          cy={cy} 
          r={moonRadius * 0.9} 
          fill={WHITE}
        />
      </G>
      
      {/* Stella a 5 punte rossa a destra */}
      <Polygon
        points={getStarPoints(starX, cy, starRadius, starRadius * 0.4)}
        fill={RED}
      />
    </Svg>
  );
};

export default TunisiaFlagIcon;
