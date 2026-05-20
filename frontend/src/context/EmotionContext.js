import { createContext, useState } from "react";

export const EmotionContext = createContext();

export function EmotionProvider({ children }) {
  const [emotionData, setEmotionData] = useState(null);

  return (
    <EmotionContext.Provider value={{ emotionData, setEmotionData }}>
      {children}
    </EmotionContext.Provider>
  );
}
