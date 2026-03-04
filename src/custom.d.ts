// For custom web components like <behold-widget>
declare namespace JSX {
  interface IntrinsicElements {
    'behold-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      'feed-id': string; // Declare attributes it might use
    }, HTMLElement>;
  }
}

// Alternatively, for more robust web component typing, you might also declare it globally:
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'behold-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
