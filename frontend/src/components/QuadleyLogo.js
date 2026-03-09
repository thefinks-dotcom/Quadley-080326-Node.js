import React from 'react';

const QuadleyLogo = ({ size = 120, className = '' }) => {
  return (
    <img 
      src="/quadley-logo.jpg" 
      alt="Quadley Logo"
      style={{ width: size, height: size, objectFit: 'contain' }}
      className={`quadley-logo ${className}`}
    />
  );
};

export default QuadleyLogo;
