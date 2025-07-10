function getSafeAreaInsets() {
  const styles = getComputedStyle(document.documentElement);
  return {
    top: parseInt(styles.getPropertyValue("--safe-area-inset-top"), 10) || 0,
    right: parseInt(styles.getPropertyValue("--safe-area-inset-right"), 10) || 0,
    bottom: parseInt(styles.getPropertyValue("--safe-area-inset-bottom"), 10) || 0,
    left: parseInt(styles.getPropertyValue("--safe-area-inset-left"), 10) || 0,
  };
}

export { getSafeAreaInsets };
