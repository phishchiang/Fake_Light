struct Uniforms {
  modelMatrix : mat4x4<f32>,
  viewMatrix : mat4x4<f32>,
  projectionMatrix : mat4x4<f32>,
  uCamPosition : vec3f,
  canvasSize : vec2f,
  uOverallRadius : f32,
  uConeRadius : f32,
  uLightLength : f32,
  uTime : f32,
  uLightStep : f32,
  uLightSpeed : f32,
  uLightIntensity : f32,
  uLightColor : vec3f,
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
  @location(1) frag_model_position : vec3f,
  @location(2) frag_uv : vec2f,
}

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {

  let model_normal = (uniforms.modelMatrix * vec4(input.normal, 0.0)).xyz;
  let model_position = (uniforms.modelMatrix * vec4(input.position, 1.0)).xyz;

  // Scale the normal by uniforms.uOverallRadius
  let allRadiusNormal = input.normal * uniforms.uOverallRadius;
  var allRadiusPosition = vec4f((input.position + allRadiusNormal), 1.0);

  // Scale the normal by uniforms.uConeRadius
  let lowerRadiusNormal = input.normal * uniforms.uConeRadius * input.uv.y;
  var new_position = allRadiusPosition + vec4f(lowerRadiusNormal, 0.0);

  // Apply the translation matrix only for uLightLength
  let translateYMatrix = mat4x4<f32>(
    1.0, 0.0, 0.0, 0.0,  // Scale X by 1.0
    0.0, 1.0, 0.0, 0.0,  // Scale Y by 1.0
    0.0, 0.0, 1.0, 0.0,  // Scale Z by 1.0
    0.0, -uniforms.uLightLength - 2.0, 0.0, 1.0   // Translation along Y-axis
  );
  var transformedModelMatrix = uniforms.modelMatrix;
  if (input.uv.y > 0.5) {
    transformedModelMatrix = uniforms.modelMatrix * translateYMatrix;
  }

  return VertexOutput(
    uniforms.projectionMatrix * uniforms.viewMatrix * transformedModelMatrix * new_position, 
    input.normal,
    model_position,
    input.uv,
  );
}

struct FragmentInput {
  @builtin(position) Position : vec4f,
  @location(0) frag_normal : vec3f,
  @location(1) frag_model_position : vec3f,
  @location(2) frag_uv : vec2f,
}

@fragment
fn fragment_main(input: FragmentInput) -> @location(0) vec4f {

  let cam_dir = normalize(uniforms.uCamPosition - input.frag_model_position);
  var fresnel = pow(dot(input.frag_normal, cam_dir) * 1.0, 2.0);
  fresnel = clamp(fresnel, 0.0, 1.0);

  let light_step = uniforms.uLightStep; // Number should be divisible by 1.0
  let speed = uniforms.uTime * 0.1 * uniforms.uLightSpeed; // Speed of the light movement

  let uvDivided = ((input.frag_uv.x + (speed)) % (1.0/light_step)) * light_step;
  let sideGradient = smoothstep(0.0, 0.5, uvDivided) * (1.0 - smoothstep(0.5, 1.0, uvDivided));

  let fade_vertical = pow(1.0 - input.frag_uv.y, 2.0);

  var fadeMultiply = sideGradient * fresnel * fade_vertical * uniforms.uLightIntensity;
  var fadedColor = fadeMultiply * vec4f(uniforms.uLightColor, fadeMultiply);

  // var finalColor: vec4f = textureSample( myTexture, mySampler, input.frag_uv );
  // var finalColor = vec4f( input.Position.x/uniforms.canvasSize.x, input.Position.y/uniforms.canvasSize.y, 0.0, 1.0 ); // Red color
  // var finalColor = vec4f( sideGradient, 0.0, 0.0, 1.0 ); // Red color
  var finalColor = fadedColor; // Red color
  // finalColor *= uniforms.uOverallRadius;
  return finalColor;
}