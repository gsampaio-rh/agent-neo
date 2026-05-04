import { useEffect, useState } from 'react';

export function TryItDiagram() {
  const [typed, setTyped] = useState('');
  const example = 'Explore this container and find a way out...';

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i <= example.length) {
        setTyped(example.slice(0, i));
        i++;
      } else {
        clearInterval(id);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="onboarding-tryit">
      <div className="onboarding-tryit__input">
        <span className="onboarding-tryit__text">{typed}</span>
        <span className="onboarding-tryit__cursor">|</span>
      </div>
    </div>
  );
}
