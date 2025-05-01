struct Uniforms {
  modelMatrix : mat4x4<f32>,
  viewMatrix : mat4x4<f32>,
  projectionMatrix : mat4x4<f32>,
  canvasSize : vec2f,
  uTestValue : f32,
  uTestValue_02 : f32,
  uTestValue_03 : f32,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_2d<f32>;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
  // @location(2) color : vec4f,
  @location(3) uv : vec2f,
}

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) frag_normal : vec3f,
  // @location(1) frag_color : vec4f,
  @location(2) frag_uv : vec2f,
}

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {

  // Scale the normal by uniforms.uTestValue
  let allRadiusNormal = input.normal * uniforms.uTestValue;
  // Offset the position by the scaled normal
  var allRadiusPosition = vec4f((input.position + allRadiusNormal), 1.0);

  // Scale the normal by uniforms.uTestValue_02
  let lowerRadiusNormal = input.normal * uniforms.uTestValue_02 * input.uv.y;
  // Offset the position by the scaled normal
  var new_position = allRadiusPosition + vec4f(lowerRadiusNormal, 0.0);

  let translateYMatrix = mat4x4<f32>(
    1.0, 0.0, 0.0, 0.0,  // Scale X by 1.0
    0.0, 1.0, 0.0, 0.0,  // Scale Y by 1.0
    0.0, 0.0, 1.0, 0.0,  // Scale Z by 1.0
    0.0, uniforms.uTestValue_03, 0.0, 1.0   // Translation along Y-axis
  );

  var transformedModelMatrix = uniforms.modelMatrix * translateYMatrix;

  return VertexOutput(
    uniforms.projectionMatrix * uniforms.viewMatrix * transformedModelMatrix * new_position, 
    input.normal,
    // input.color,
    input.uv,
  );
}

struct FragmentInput {
  @builtin(position) Position : vec4f,
  @location(0) frag_normal : vec3f,
  // @location(1) frag_color : vec4f,
  @location(2) frag_uv : vec2f,
}

@fragment
fn fragment_main(input: FragmentInput) -> @location(0) vec4f {
  var finalColor: vec4f = textureSample( myTexture, mySampler, input.frag_uv );
  // var finalColor = vec4f( input.Position.x/uniforms.canvasSize.x, input.Position.y/uniforms.canvasSize.y, 0.0, 1.0 ); // Red color
  // var finalColor = vec4f( input.frag_normal.x, input.frag_normal.y, input.frag_normal.z, 1.0 ); // Red color
  // finalColor *= uniforms.uTestValue;
  return finalColor;
}


/*
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
  
*/
