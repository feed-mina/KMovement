'use client';
import { useEffect, useState } from 'react';

const TypewriterText = ({ meta }: any) => {
  const text = meta?.labelText || meta?.label_text || '';
  const cssClass = meta?.cssClass || meta?.css_class || '';
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, [text]);

  return <div className={cssClass}>{displayed || ' '}</div>;
};

TypewriterText.displayName = 'TypewriterText';
export default TypewriterText;
