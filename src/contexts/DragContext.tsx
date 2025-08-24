import React, { createContext, useContext, useState, useEffect } from 'react';

interface DragContextType {
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
}

const DragContext = createContext<DragContextType | undefined>(undefined);

export const useDragContext = () => {
  const context = useContext(DragContext);
  if (!context) {
    throw new Error('useDragContext must be used within a DragProvider');
  }
  return context;
};

export const DragProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDragging, setIsDragging] = useState(false);

  // Listen for native drag events
  useEffect(() => {
    const handleDragStart = () => setIsDragging(true);
    const handleDragEnd = () => setIsDragging(false);
    const handleDrop = () => setIsDragging(false);

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <DragContext.Provider value={{ isDragging, setIsDragging }}>
      {children}
    </DragContext.Provider>
  );
};