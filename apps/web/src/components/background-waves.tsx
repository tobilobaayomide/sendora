/**
 * A quiet radial brand glow over the active theme background.
 * All colors come from the app theme, so light and dark mode stay in sync.
 */
export function RadialBackground() {
  return (
    <div
      aria-hidden="true"
      className="radial-background pointer-events-none fixed inset-0 -z-10"
    />
  );
}

// Keep the existing export available while callers migrate to the new name.
export const BackgroundWaves = RadialBackground;
