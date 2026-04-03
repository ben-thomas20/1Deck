"use client"

import { GrainGradient } from "@paper-design/shaders-react"

export default function AnimatedGradientBackground() {
  return (
    <div className="absolute inset-0 -z-10">
      <GrainGradient
        style={{ height: "100%", width: "100%" }}
        colorBack="hsl(210, 25%, 5%)"
        softness={0.72}
        intensity={0.4}
        noise={0.03}
        shape="corners"
        offsetX={0}
        offsetY={0}
        scale={1}
        rotation={0}
        speed={0.6}
        colors={[
          "hsl(145, 55%, 22%)",
          "hsl(42, 65%, 40%)",
          "hsl(150, 40%, 15%)",
        ]}
      />
    </div>
  )
}
