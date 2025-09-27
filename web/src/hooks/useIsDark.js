import { useEffect, useState } from 'react';

export function useIsDark() {
  const getDark = () => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  };

  const [isDark, setIsDark] = useState(getDark);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;

    const update = () => setIsDark(el.classList.contains('dark'));
    update();

    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });

    const onStorage = (e) => {
      if (e.key === 'theme') update();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      try { observer.disconnect(); } catch {}
      try { window.removeEventListener('storage', onStorage); } catch {}
    };
  }, []);

  return isDark;
}





