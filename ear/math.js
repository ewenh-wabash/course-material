    export function scaleAndClamp(value, inMin, inMax, outMin, outMax) {
      // Prevent division by zero
      if (inMax === inMin) {
        throw new Error("Input range cannot be zero.");
      }

      // Linear scaling
      const scaled =
        ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;

      // Clamp to output range (works even if outMin > outMax)
      const minOut = Math.min(outMin, outMax);
      const maxOut = Math.max(outMin, outMax);

      return Math.min(Math.max(scaled, minOut), maxOut);
    }