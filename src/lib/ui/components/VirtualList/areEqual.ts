// @flow
// @ts-nocheck

export function shallowDiffers(prev: Object, next: Object): boolean {
  for (let attribute in prev) {
    if (!(attribute in next)) {
      return true;
    }
  }
  for (let attribute in next) {
    if (prev[attribute] !== next[attribute]) {
      return true;
    }
  }
  return false;
}

// Custom comparison function for React.memo().
// It knows to compare individual style props and ignore the wrapper object.
// See https://reactjs.org/docs/react-api.html#reactmemo
export function areEqual(
  prevProps: Object,
  nextProps: Object
): boolean {
  const { style: prevStyle, ...prevRest } = prevProps;
  const { style: nextStyle, ...nextRest } = nextProps;

  return (
    !shallowDiffers(prevStyle, nextStyle) && !shallowDiffers(prevRest, nextRest)
  );
}