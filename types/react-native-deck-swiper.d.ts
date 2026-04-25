declare module 'react-native-deck-swiper' {
  import * as React from 'react';
  import { StyleProp, TextStyle, ViewStyle } from 'react-native';

  export type OverlayLabel = {
    title?: string;
    style?: {
      label?: StyleProp<TextStyle>;
      wrapper?: StyleProp<ViewStyle>;
    };
  };

  export type SwiperProps<T> = {
    cards: T[];
    renderCard: (card: T, cardIndex: number) => React.ReactNode;
    onSwiped?: (cardIndex: number) => void;
    onSwipedLeft?: (cardIndex: number) => void;
    onSwipedRight?: (cardIndex: number) => void;
    onSwipedAll?: () => void;
    cardIndex?: number;
    backgroundColor?: string;
    stackSize?: number;
    stackScale?: number;
    stackSeparation?: number;
    verticalSwipe?: boolean;
    horizontalThreshold?: number;
    disableBottomSwipe?: boolean;
    disableTopSwipe?: boolean;
    animateOverlayLabelsOpacity?: boolean;
    overlayLabels?: {
      left?: OverlayLabel;
      right?: OverlayLabel;
      top?: OverlayLabel;
      bottom?: OverlayLabel;
    };
    containerStyle?: StyleProp<ViewStyle>;
    cardStyle?: StyleProp<ViewStyle>;
  };

  export default class Swiper<T> extends React.Component<SwiperProps<T>> {
    swipeLeft(): void;
    swipeRight(): void;
  }
}
