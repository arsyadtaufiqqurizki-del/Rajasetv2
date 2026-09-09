import { useCallback, useState, type KeyboardEvent } from 'react';

/**
 * Arrow-key/Home/End/Enter/Escape navigation for custom dropdown lists
 * (listbox or menu pattern) that keep DOM focus on a trigger/input and
 * track the "active" item via aria-activedescendant instead of moving focus.
 */
export function useListNav(itemCount: number, onSelect: (index: number) => void, onClose: () => void) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const reset = useCallback(() => setActiveIndex(-1), []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (itemCount > 0) setActiveIndex(prev => (prev + 1) % itemCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (itemCount > 0) setActiveIndex(prev => (prev - 1 + itemCount) % itemCount);
        break;
      case 'Home':
        if (itemCount > 0) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (itemCount > 0) {
          e.preventDefault();
          setActiveIndex(itemCount - 1);
        }
        break;
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < itemCount) {
          e.preventDefault();
          onSelect(activeIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [itemCount, activeIndex, onSelect, onClose]);

  return { activeIndex, setActiveIndex, handleKeyDown, reset };
}
