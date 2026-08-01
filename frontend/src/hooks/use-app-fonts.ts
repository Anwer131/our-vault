import { useFonts } from 'expo-font';

export function useAppFonts() {
  return useFonts({
    Fraunces_500Medium: 'https://fonts.gstatic.com/s/fraunces/v39/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk.ttf',
    Fraunces_600SemiBold: 'https://fonts.gstatic.com/s/fraunces/v39/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea9SremAk.ttf',
    Nunito_400Regular: 'https://fonts.gstatic.com/s/nunito/v31/XRXI3I6Li01BKofiOc5wtlZ2di8HDDshdTk3.ttf',
    Nunito_500Medium: 'https://fonts.gstatic.com/s/nunito/v31/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTk3.ttf',
    Nunito_600SemiBold: 'https://fonts.gstatic.com/s/nunito/v31/XRXI3I6Li01BKofiOc5wtlZ2di8HDIsidTk3.ttf',
  });
}
