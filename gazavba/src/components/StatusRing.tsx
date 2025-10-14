import React from "react";
import { View } from "react-native";

interface StatusRingProps {
  size?: number;
  segments?: number;
  color?: string;
  thickness?: number;
  backgroundColor?: string;
}

/**
 * Pure React Native implementation of a segmented ring similar to WhatsApp's
 * status indicator. We draw an outer circle using border styles and then add
 * small masks around the circumference to create gaps between segments.
 */
export function StatusRing({
  size = 68,
  segments = 1,
  color = "#25D366",
  thickness = 4,
  backgroundColor = "#fff",
}: StatusRingProps) {
  const safeSegments = Math.max(1, segments);
  const gapThickness = thickness + 4;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: color,
        }}
      />

      {safeSegments > 1 &&
        Array.from({ length: safeSegments }).map((_, index) => (
          <View
            key={index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              transform: [{ rotate: `${(360 / safeSegments) * index}deg` }],
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: gapThickness,
                height: gapThickness,
                borderRadius: gapThickness / 2,
                backgroundColor,
                marginTop: -gapThickness / 2,
              }}
            />
          </View>
        ))}

      <View
        style={{
          position: "absolute",
          width: size - thickness * 2,
          height: size - thickness * 2,
          borderRadius: (size - thickness * 2) / 2,
          backgroundColor,
        }}
      />
    </View>
  );
}

export default StatusRing;
