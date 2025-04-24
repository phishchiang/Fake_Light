import { mat4, vec3 } from 'wgpu-matrix';
import { GUI } from 'dat.gui';
import {
  cubeVertexArray,
  cubeVertexSize,
  cubeUVOffset,
  cubePositionOffset,
  cubeVertexCount,
} from './meshes/cube';
import lightWGSL from './light.wgsl?raw'; // Raw String Import but only specific to Vite.
import { ArcballCamera, WASDCamera } from './camera';
import { createInputHandler } from './input';
import { quitIfWebGPUNotAvailable } from './util';

import { loadGLB } from './loadGLB';

const canvas = document.querySelector('canvas') as HTMLCanvasElement;

// The input handler
const inputHandler = createInputHandler(window, canvas);

// The camera types
const initialCameraPosition = vec3.create(3, 2, 5);
const cameras = {
  arcball: new ArcballCamera({ position: initialCameraPosition }),
  WASD: new WASDCamera({ position: initialCameraPosition }),
};

const gui = new GUI();

// GUI parameters
const params: { 
  type: 'arcball' | 'WASD';
  uLowerRadiusValue: number;
  uAllRadiusValue: number;
  uLengthValue: number;
} = {
  type: 'arcball',
  uLowerRadiusValue: 1.0,
  uAllRadiusValue: 1.0,
  uLengthValue: 1.0,
};

// Callback handler for camera mode
let oldCameraType = params.type;
gui.add(params, 'type', ['arcball', 'WASD']).onChange(() => {
  // Copy the camera matrix from old to new
  const newCameraType = params.type;
  cameras[newCameraType].matrix = cameras[oldCameraType].matrix;
  oldCameraType = newCameraType;
});
gui.add(params, 'uLowerRadiusValue', 0.0, 1.0).step(0.01).onChange((value) => {
  // Update the uniform buffer when the value changes
  updateFloatUniform(uLowerRadiusBuffer, value);
});
gui.add(params, 'uAllRadiusValue', 0.0, 1.0).step(0.01).onChange((value) => {
  updateFloatUniform(uAllRadiusBuffer, value);
});
gui.add(params, 'uLengthValue', 0.0, 1.0).step(0.01).onChange((value) => {
  // Update the uniform buffer when the value changes
  updateFloatUniform(uLengthBuffer, value);
});

function updateFloatUniform(buffer: GPUBuffer, value: number) {
  const updatedFloatArray = new Float32Array([value]); // Convert the value to a Float32Array
  device.queue.writeBuffer(buffer, 0, updatedFloatArray.buffer, 0, updatedFloatArray.byteLength);
}

const adapter = await navigator.gpu?.requestAdapter({
  featureLevel: 'compatibility',
});
const device = await adapter?.requestDevice() as GPUDevice; // To explicitly use a type assertion to tell TypeScript that device is guaranteed to be a GPUDevice after the check.
quitIfWebGPUNotAvailable(adapter, device ?? null);

const context = canvas.getContext('webgpu') as GPUCanvasContext;

const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

window.addEventListener('resize', resize.bind(this));
function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const aspect = canvas.width / canvas.height;
  const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);
  context.configure({
    device,
    format: presentationFormat,
    // size: [canvas.width, canvas.height],
  });
  device.queue.writeBuffer(
    projectionBuffer,
    0,
    projectionMatrix.buffer,
    projectionMatrix.byteOffset,
    projectionMatrix.byteLength
  );
  const canvasSizeArray = new Float32Array([canvas.width, canvas.height]);
  device.queue.writeBuffer(canvasSizeBuffer, 0, canvasSizeArray.buffer, 0, canvasSizeArray.byteLength);
  console.log(canvasSizeArray)

  // Recreate the depth texture with the new canvas size
  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  // Update the depth attachment in the render pass descriptor
  renderPassDescriptor.depthStencilAttachment!.view = depthTexture.createView();
}

context.configure({
  device,
  format: presentationFormat,
});



async function setupMesh() {
  const { vertices, indices, uvs, vertexNormal} = await loadGLB('/assets/meshes/light.glb');

  // Ensure the number of UVs matches the number of vertices
  if (uvs.length / 2 !== vertices.length / 3) {
    console.error('UV count does not match vertex count!');
    throw new Error('UV count does not match vertex count!');
  }

// Interleave positions, UVs, and normals into a single array
const interleavedData = new Float32Array((vertices.length / 3) * 8); // 3 for position + 2 for UV + 3 for normal
for (let i = 0, j = 0; i < vertices.length / 3; i++) {
  interleavedData[j++] = vertices[i * 3];     // x
  interleavedData[j++] = vertices[i * 3 + 1]; // y
  interleavedData[j++] = vertices[i * 3 + 2]; // z
  interleavedData[j++] = uvs[i * 2];          // u
  interleavedData[j++] = uvs[i * 2 + 1];      // v
  interleavedData[j++] = vertexNormal[i * 3];     // nx
  interleavedData[j++] = vertexNormal[i * 3 + 1]; // ny
  interleavedData[j++] = vertexNormal[i * 3 + 2]; // nz
}

  // Create vertex buffer
  const vertexBuffer = device.createBuffer({
    size: interleavedData.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(interleavedData);
  vertexBuffer.unmap();

  // Create index buffer
  const indexBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
  });
  new Uint16Array(indexBuffer.getMappedRange()).set(indices);
  indexBuffer.unmap();

  return { vertexBuffer, indexBuffer, indexCount: indices.length };
}

// Call setupMesh and use the buffers in your render pass
const { vertexBuffer, indexBuffer, indexCount } = await setupMesh();


// Create a vertex buffer from the cube data.
const verticesBuffer = device.createBuffer({
  size: cubeVertexArray.byteLength,
  usage: GPUBufferUsage.VERTEX,
  mappedAtCreation: true,
});
new Float32Array(verticesBuffer.getMappedRange()).set(cubeVertexArray);
verticesBuffer.unmap();

const uniformBufferSize = 4 * 16; // 4x4 matrix
// Create separate uniform buffers for model, view, and projection matrices
const modelBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const viewBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const projectionBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const uLowerRadiusBuffer = device.createBuffer({
  size: 4, //  the size should be 4 bytes for a single float
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const uAllRadiusBuffer = device.createBuffer({
  size: 4, //  the size should be 4 bytes for a single float
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const uLengthBuffer = device.createBuffer({
  size: 4, //  the size should be 4 bytes for a single float
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const canvasSizeBuffer = device.createBuffer({
  size: 8, // 8 bytes for a vec2 (2 floats)
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const canvasSizeArray = new Float32Array([canvas.width, canvas.height]);
device.queue.writeBuffer(canvasSizeBuffer, 0, canvasSizeArray.buffer, 0, canvasSizeArray.byteLength);

const updatedFloatArray = new Float32Array([1.0]); // Set the default value of uLowerRadiusValue to 1.0
device.queue.writeBuffer(uLowerRadiusBuffer, 0, updatedFloatArray.buffer, 0, updatedFloatArray.byteLength);
device.queue.writeBuffer(uAllRadiusBuffer, 0, updatedFloatArray.buffer, 0, updatedFloatArray.byteLength);
device.queue.writeBuffer(uLengthBuffer, 0, updatedFloatArray.buffer, 0, updatedFloatArray.byteLength);

const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Model Matrix
    { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
    { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
    { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
    { binding: 5, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // uLowerRadiusValue
    { binding: 6, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, 
    { binding: 7, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // uAllRadiusValue
    { binding: 8, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // uAllRadiusValue
  ],
});

const pipeline = device.createRenderPipeline({
  layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
  // layout: 'auto',
  vertex: {
    module: device.createShaderModule({
      code: lightWGSL,
    }),
    buffers: [
      {
        // arrayStride: cubeVertexSize,
        arrayStride: 8 * 4, // 3 floats for position + 2 floats for UV + 3 floats for normal
        attributes: [
          {
            // position
            shaderLocation: 0,
            offset: cubePositionOffset,
            format: 'float32x3',
          },
          {
            shaderLocation: 1, // UV
            offset: 3 * 4, // Offset after position
            format: 'float32x2',
          },
          {
            // normal
            shaderLocation: 2,
            offset: 5 * 4,  // Offset after position and UV
            format: 'float32x3',
          },
        ],
      },
    ],
  },
  fragment: {
    module: device.createShaderModule({
      code: lightWGSL,
    }),
    targets: [
      {
        format: presentationFormat,
      },
    ],
  },
  primitive: {
    topology: 'triangle-list',
    cullMode: 'none',
  },
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: 'depth24plus',
  },
});

const depthTexture = device.createTexture({
  size: [canvas.width, canvas.height],
  format: 'depth24plus',
  usage: GPUTextureUsage.RENDER_ATTACHMENT,
});


// Fetch the image and upload it into a GPUTexture.
let cubeTexture: GPUTexture;
{
  const response = await fetch('../assets/img/uv1.png');
  const imageBitmap = await createImageBitmap(await response.blob());

  cubeTexture = device.createTexture({
    size: [imageBitmap.width, imageBitmap.height, 1],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture: cubeTexture },
    [imageBitmap.width, imageBitmap.height]
  );
}

// Create a sampler with linear filtering for smooth interpolation.
const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
});

const uniformBindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    {
      binding: 0, // Model Matrix
      resource: {
        buffer: modelBuffer,
      },
    },
    {
      binding: 1, // View Matrix
      resource: {
        buffer: viewBuffer,
      },
    },
    {
      binding: 2, // Projection Matrix
      resource: {
        buffer: projectionBuffer,
      },
    },
    {
      binding: 3,
      resource: sampler,
    },
    {
      binding: 4,
      resource: cubeTexture.createView(),
    },
    {
      binding: 5,
      resource: { buffer: uLowerRadiusBuffer },
    },
    {
      binding: 6,
      resource: { buffer: canvasSizeBuffer },
    },
    {
      binding: 7,
      resource: { buffer: uAllRadiusBuffer },
    },
    {
      binding: 8,
      resource: { buffer: uLengthBuffer },
    },
  ],
});

const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: undefined, // Assigned later

      clearValue: [0.5, 0.5, 0.5, 1.0],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ] as Iterable< GPURenderPassColorAttachment | null | undefined>,
  depthStencilAttachment: {
    view: depthTexture.createView(),

    depthClearValue: 1.0,
    depthLoadOp: 'clear',
    depthStoreOp: 'store',
  },
};

const aspect = canvas.width / canvas.height;
const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);

function getViewMatrix(deltaTime: number) {
  const camera = cameras[params.type];
  const viewMatrix = camera.update(deltaTime, inputHandler());
  return viewMatrix;
}

device.queue.writeBuffer(
  projectionBuffer,
  0,
  projectionMatrix.buffer,
  projectionMatrix.byteOffset,
  projectionMatrix.byteLength
);

// Example model matrix (identity matrix for now)
const modelMatrix = mat4.identity();

// Write the updated matrices to their respective buffers
device.queue.writeBuffer(
  modelBuffer,
  0,
  modelMatrix.buffer,
  modelMatrix.byteOffset,
  modelMatrix.byteLength
);

let lastFrameMS = Date.now();

function frame() {
  const now = Date.now();
  const deltaTime = (now - lastFrameMS) / 1000;
  lastFrameMS = now;

  const ViewProjection = getViewMatrix(deltaTime);

  device.queue.writeBuffer(
    viewBuffer,
    0,
    ViewProjection.buffer,
    ViewProjection.byteOffset,
    ViewProjection.byteLength
  );

  renderPassDescriptor.colorAttachments[0].view = context
    .getCurrentTexture()
    .createView();

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, uniformBindGroup);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.setIndexBuffer(indexBuffer, 'uint16');
  passEncoder.drawIndexed(indexCount);
  // passEncoder.draw(cubeVertexCount);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);