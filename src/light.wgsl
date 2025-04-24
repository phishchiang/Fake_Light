
@group(0) @binding(0) var<uniform> modelMatrix : mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix : mat4x4<f32>;
@group(0) @binding(2) var<uniform> projectionMatrix : mat4x4<f32>;
@group(0) @binding(3) var mySampler: sampler;
@group(0) @binding(4) var myTexture: texture_2d<f32>;
@group(0) @binding(5) var<uniform> uLowerRadius: f32;
@group(0) @binding(6) var<uniform> canvasSize: vec2f;
@group(0) @binding(7) var<uniform> uAllRadius: f32;
@group(0) @binding(8) var<uniform> uLength: f32;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
}

@vertex
fn vertex_main(
  @location(0) position : vec4f,
  @location(1) uv : vec2f,
  @location(2) normal: vec3<f32>,
) -> VertexOutput {
  // Scale the normal by uAllRadius
  let allRadiusNormal = normal * uAllRadius;
  // Offset the position by the scaled normal
  var allRadiusPosition = position + vec4f(allRadiusNormal, 0.0);

  // Scale the normal by uLowerRadius
  let lowerRadiusNormal = normal * uLowerRadius * uv.y;
  // Offset the position by the scaled normal
  var new_position = allRadiusPosition + vec4f(lowerRadiusNormal, 0.0);

  let translateYMatrix = mat4x4<f32>(
    1.0, 0.0, 0.0, 0.0,  // Scale X by 1.0
    0.0, 1.0, 0.0, 0.0, // Scale Y by 1.0
    0.0, 0.0, 1.0, 0.0,  // Scale Z by 1.0
    0.0, -uLength, 0.0, 1.0   // Translation along Y-axis
  );

  // Apply the translation matrix only if uv.y meets the condition
  var transformedModelMatrix = modelMatrix;
  if (uv.y > 0.5) {
    transformedModelMatrix = modelMatrix * translateYMatrix;
  }


  return VertexOutput(projectionMatrix * viewMatrix * transformedModelMatrix * new_position, uv);
}

@fragment
fn fragment_main(
    @builtin(position) Position : vec4f,
    @location(0) fragUV: vec2f
  ) -> @location(0) vec4f {
  // var finalColor: vec4f = textureSample(myTexture, mySampler, fragUV);
  // var finalColor = vec4f(Position.x/1000.0,Position.y/1000.0,Position.z/1000.0, 1.0); // Red color
  // var finalColor = vec4f(Position.x/canvasSize.x,Position.y/canvasSize.y, 0.0, 1.0); // Red color
  var finalColor = vec4f(fragUV.x,fragUV.y, 0.0, 1.0); // Red color
  finalColor *= uLowerRadius;
  return finalColor;
}
