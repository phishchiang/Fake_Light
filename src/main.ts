import { mat4, vec3 } from 'wgpu-matrix';
import { GUI } from 'dat.gui';
import { cubeVertexArray, cubeVertexSize, cubeUVOffset, cubePositionOffset, cubeVertexCount } from './meshes/cube';
import lightWGSL from './light.wgsl?raw'; // Raw String Import but only specific to Vite.
import { ArcballCamera, WASDCamera } from './camera';
import { createInputHandler } from './input';
import { loadGLB } from './loadGLB';
import { getVertexLayout } from './getVertexLayout';
import { uniformConfig } from './uniformConfig';

const MESH_PATH = '/assets/meshes/light_color.glb';

export class WebGPUApp{
  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;
  private presentationFormat!: GPUTextureFormat;
  private uniformBindGroup!: GPUBindGroup;
  private renderPassDescriptor!: GPURenderPassDescriptor;
  private cubeTexture!: GPUTexture;
  private cameras: { [key: string]: any };
  private aspect!: number;
  private params: { 
    type: 'arcball' | 'WASD'; 
    uOverallRadius: number; 
    uConeRadius: number; 
    uLightLength: number; 
    uLightStep: number; 
    uLightSpeed: number; 
    uLightIntensity: number; 
  } = {
    type: 'arcball',
    uOverallRadius: 0.0,
    uConeRadius: 1.0,
    uLightLength: 1.0,
    uLightStep: 4.0,
    uLightSpeed: 1.0,
    uLightIntensity: 1.0,
  };
  private gui: GUI;
  private uTime: number = 0.0;
  private lastFrameMS: number;
  private demoVerticesBuffer!: GPUBuffer;
  private loadVerticesBuffer!: GPUBuffer;
  private loadIndexBuffer!: GPUBuffer;
  private loadIndexCount!: number;
  private uniformBuffer!: GPUBuffer;
  private loadVertexLayout!: { arrayStride: number; attributes: GPUVertexAttribute[]; };
  private modelMatrix: Float32Array;
  private viewMatrix: Float32Array;
  private projectionMatrix: Float32Array;
  private depthTexture!: GPUTexture;
  private sampler!: GPUSampler;
  private newCameraType!: string;
  private oldCameraType!: string;
  private inputHandler!: () => { 
    digital: { forward: boolean, backward: boolean, left: boolean, right: boolean, up: boolean, down: boolean, };
    analog: { x: number; y: number; zoom: number; touching: boolean };
  };
  private static readonly CLEAR_COLOR = [0.1, 0.1, 0.1, 1.0];
  private static readonly CAMERA_POSITION = vec3.create(3, 2, 5);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gui = new GUI();
    this.cameras = {
      arcball: new ArcballCamera({ position: WebGPUApp.CAMERA_POSITION }),
      WASD: new WASDCamera({ position: WebGPUApp.CAMERA_POSITION }),
    };
    this.oldCameraType = this.params.type;
    this.lastFrameMS = Date.now();
    this.sampler = {} as GPUSampler;

     // The input handler
    this.inputHandler = createInputHandler(window, this.canvas);

    // Initialize matrices
    this.modelMatrix = mat4.identity();
    this.viewMatrix = mat4.identity();
    this.projectionMatrix = mat4.identity();

    this.setupAndRender();
  }

  public async setupAndRender() {
    await this.initializeWebGPU();
    await this.loadGLBMesh();
    this.initializeBuffers();
    await this.loadTexture();
    this.initCam();
    this.createPipeline(this.presentationFormat);
    this.createUniformBindGroup();
    this.initializeGUI();
    this.setupEventListeners();
    this.renderFrame();
  }

  private async loadGLBMesh() {
    const { vertices, indices, vertexNormal, uvs, colors } = await loadGLB(MESH_PATH);

    // Ensure the number of UVs matches the number of vertices
    if (uvs!.length / 2 !== vertices.length / 3) {
      console.error('UV count does not match vertex count!');
      throw new Error('UV count does not match vertex count!');
    }

    this.loadVertexLayout = new getVertexLayout({ 
      position: vertices! && vertices.length > 0, 
      normal: vertexNormal! && vertexNormal!.length > 0, 
      color: colors! && colors!.length > 0, 
      uv: uvs! && uvs!.length > 0,
    }).build();

  // Interleave positions, normals, and UVs into a single array
  const interleavedData = new Float32Array((vertices.length / 3) * (this.loadVertexLayout.arrayStride / 4));
  for (let i = 0, j = 0; i < vertices.length / 3; i++) {
    interleavedData[j++] = vertices[i * 3 + 0]; // x
    interleavedData[j++] = vertices[i * 3 + 1]; // y
    interleavedData[j++] = vertices[i * 3 + 2]; // z
    if (vertexNormal! && vertexNormal!.length > 0) {
      interleavedData[j++] = vertexNormal[i * 3 + 0]; // nx
      interleavedData[j++] = vertexNormal[i * 3 + 1]; // ny
      interleavedData[j++] = vertexNormal[i * 3 + 2]; // nz
    }
    if (colors! && colors!.length > 0) {
      interleavedData[j++] = colors[i * 4 + 0]; // cr
      interleavedData[j++] = colors[i * 4 + 1]; // cg
      interleavedData[j++] = colors[i * 4 + 2]; // cb
      interleavedData[j++] = colors[i * 4 + 3]; // ca
    }
    if (uvs! && uvs!.length > 0) {
      interleavedData[j++] = uvs[i * 2 + 0]; // u
      interleavedData[j++] = uvs[i * 2 + 1]; // v
    }
  }

    // Create a GPUBuffer for the loaded vertices
    this.loadVerticesBuffer = this.device.createBuffer({
      size: interleavedData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.loadVerticesBuffer.getMappedRange()).set(interleavedData);
    this.loadVerticesBuffer.unmap();

    // Create index buffer
    this.loadIndexBuffer = this.device.createBuffer({
      size: indices!.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    new Uint16Array(this.loadIndexBuffer.getMappedRange()).set(indices!);
    this.loadIndexBuffer.unmap();

    this.loadIndexCount = indices!.length;
  }

  private initCam(){
    this.aspect = this.canvas.width / this.canvas.height;
    this.projectionMatrix = mat4.perspective((2 * Math.PI) / 5, this.aspect, 1, 100.0);
    
    const devicePixelRatio = window.devicePixelRatio;
    this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
    // Projection mat4x4<f32> 16 value 64 bytes, index 32
    this.device.queue.writeBuffer(this.uniformBuffer, 128, this.projectionMatrix.buffer, this.projectionMatrix.byteOffset, this.projectionMatrix.byteLength); // Projection matrix
  }

  private async loadTexture() {
    const response = await fetch('../assets/img/uv1.png');
    const imageBitmap = await createImageBitmap(await response.blob());

    this.cubeTexture = this.device.createTexture({
      size: [imageBitmap.width, imageBitmap.height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: this.cubeTexture },
      [imageBitmap.width, imageBitmap.height]
    );
  }

  private initializeBuffers() {
    /* 
    // Create a demo vertex buffer from the cube data.
    this.demoVerticesBuffer = this.device.createBuffer({
      size: cubeVertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.demoVerticesBuffer.getMappedRange()).set(cubeVertexArray);
    this.demoVerticesBuffer.unmap();
    */

   const uniformTotalSize = Object.values(uniformConfig)
    .filter((item) => typeof item === 'object' && 'size' in item) // Ensure the property has a `size`
    .reduce((sum, item) => sum + (item as { size: number }).size, 0);
   
   // Math.ceil(size / 16) * 16 to ensure it is a multiple of 16 bytes.
    const uniformBufferSize = Math.ceil((4 * (uniformTotalSize)) / 16) * 16;
    this.uniformBuffer = this.device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // To order your structure members from largest to smallest alignment requirements.
    const uniformData = new Float32Array(uniformBufferSize / 4);
    uniformData.set(this.modelMatrix, uniformConfig.modelMatrix.offset); // Model matrix
    uniformData.set(this.viewMatrix, uniformConfig.viewMatrix.offset); // View matrix
    uniformData.set(this.projectionMatrix, uniformConfig.projectionMatrix.offset); // Projection matrix
    uniformData.set(WebGPUApp.CAMERA_POSITION, uniformConfig.cameraPosition.offset); 
    uniformData.set([this.canvas.width, this.canvas.height], uniformConfig.canvasSize.offset);
    uniformData.set([this.params.uOverallRadius], uniformConfig.uOverallRadius.offset);
    uniformData.set([this.params.uConeRadius], uniformConfig.uConeRadius.offset);
    uniformData.set([this.params.uLightLength], uniformConfig.uLightLength.offset);
    uniformData.set([this.uTime], uniformConfig.uTime.offset);
    uniformData.set([this.params.uLightStep], uniformConfig.uLightStep.offset);
    uniformData.set([this.params.uLightSpeed], uniformConfig.uLightSpeed.offset);
    uniformData.set([this.params.uLightIntensity], uniformConfig.uLightIntensity.offset);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData.buffer, 0, uniformData.byteLength);
    console.log('print out the uniformData : ', uniformData);
  }

  private setupEventListeners() {
    window.addEventListener('resize', this.resize.bind(this));
  }


  private resize() {
    const devicePixelRatio = window.devicePixelRatio;
    this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;

    this.aspect = this.canvas.width / this.canvas.height;
    this.projectionMatrix = mat4.perspective((2 * Math.PI) / 5, this.aspect, 1, 100.0);
    this.context.configure({
      device: this.device,
      format: navigator.gpu.getPreferredCanvasFormat(),
    });
    // Projection mat4x4<f32> 16 value 64 bytes, index 32
    this.device.queue.writeBuffer(this.uniformBuffer, 128, this.projectionMatrix.buffer, this.projectionMatrix.byteOffset, this.projectionMatrix.byteLength); 

    // CanvasSize vec2f 2 value 8 bytes, index 48
    const canvasSizeArray = new Float32Array([this.canvas.width, this.canvas.height]);
    this.device.queue.writeBuffer(this.uniformBuffer, 192, canvasSizeArray.buffer, 0, canvasSizeArray.byteLength);

    // Recreate the depth texture to match the new canvas size
    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  private initializeGUI() {
    this.gui.add(this.params, 'type', ['arcball', 'WASD']).onChange(() => {
      this.newCameraType = this.params.type;
      this.cameras[this.newCameraType].matrix = this.cameras[this.oldCameraType].matrix;
      this.oldCameraType = this.newCameraType
    });
    this.gui.add(this.params, 'uOverallRadius', -0.75, 0.75).step(0.01).onChange((value) => {
      this.updateFloatUniform( 'uOverallRadius', value );
    });
    this.gui.add(this.params, 'uConeRadius', 0.0, 5.0).step(0.01).onChange((value) => {
      this.updateFloatUniform( 'uConeRadius', value );
    });
    this.gui.add(this.params, 'uLightLength', 0.0, 10.0).step(0.01).onChange((value) => {
      this.updateFloatUniform( 'uLightLength', value );
    });
    this.gui.add(this.params, 'uLightStep', 1.0, 10.0).step(1.0).onChange((value) => {
      this.updateFloatUniform( 'uLightStep', value );
    });
    this.gui.add(this.params, 'uLightSpeed', 0.0, 5.0).step(0.01).onChange((value) => {
      this.updateFloatUniform( 'uLightSpeed', value );
    });
    this.gui.add(this.params, 'uLightIntensity', 0.0, 10.0).step(0.01).onChange((value) => {
      this.updateFloatUniform( 'uLightIntensity', value );
    });
    
  }

  private updateFloatUniform(key: keyof typeof this.params, value: number) {
    let offset: number = 0;
    switch (key) {
      case 'uOverallRadius':
        offset = uniformConfig.uOverallRadius.offset * 4;
        break;
      case 'uConeRadius':
        offset = uniformConfig.uConeRadius.offset * 4;;
        break;
      case 'uLightLength':
        offset = uniformConfig.uLightLength.offset * 4;;
        break;
      case 'uLightStep':
        offset = uniformConfig.uLightStep.offset * 4;;
        break;
      case 'uLightSpeed':
        offset = uniformConfig.uLightSpeed.offset * 4;;
        break;
      case 'uLightIntensity':
        offset = uniformConfig.uLightIntensity.offset * 4;;
        break;
      // Add more cases as needed
      default:
        console.error(`Unknown key: ${key}`);
        return;
    }

    const updatedFloatArray = new Float32Array([value]);
    this.device.queue.writeBuffer(this.uniformBuffer, offset, updatedFloatArray.buffer, 0, updatedFloatArray.byteLength);
  }

  private async initializeWebGPU() {
    const adapter = await navigator.gpu?.requestAdapter({ featureLevel: 'compatibility' });
    this.device = await adapter?.requestDevice() as GPUDevice;

    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    const devicePixelRatio = window.devicePixelRatio;
    this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;

    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
    });

    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });


    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.renderPassDescriptor = {
      colorAttachments: [
        {
          view: undefined, // Assigned later
          clearValue: WebGPUApp.CLEAR_COLOR,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ] as Iterable< GPURenderPassColorAttachment | null | undefined>,
      depthStencilAttachment: {
        view: this.depthTexture.createView(), // Assign a valid GPUTextureView
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    };
  }

  private createUniformBindGroup() {
    this.uniformBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0, // Uniforms struct
          resource: { buffer: this.uniformBuffer },
        },
        {
          binding: 1,
          resource: this.sampler,
        },
        {
          binding: 2,
          resource: this.cubeTexture.createView(),
        },
      ],
    });
  }

  private createPipeline(presentationFormat: GPUTextureFormat) {
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0, // Uniforms struct
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1, // Sampler
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
        {
          binding: 2, // Texture
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        }, 
      ],
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: {
        module: this.device.createShaderModule({
          code: lightWGSL,
        }),
        buffers: [
          {
            arrayStride: this.loadVertexLayout.arrayStride,
            attributes: this.loadVertexLayout.attributes,
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({
          code: lightWGSL,
        }),
        targets: [
          {
            format: presentationFormat,
            // Enable Transparency
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
            writeMask: GPUColorWrite.ALL,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });
  }

  private getViewMatrix(deltaTime: number) {
    const camera = this.cameras[this.params.type];
    const viewMatrix =  camera.update(deltaTime, this.inputHandler());
    return viewMatrix;
  }

  private renderFrame() {
    const now = Date.now();
    const deltaTime = (now - this.lastFrameMS) / 1000;
    this.lastFrameMS = now;

    // Update the uniform uTime value
    this.uTime += deltaTime;
    const uTimeFloatArray = new Float32Array([this.uTime]);
    this.device.queue.writeBuffer(this.uniformBuffer, uniformConfig.uTime.offset * 4, uTimeFloatArray.buffer, 0, uTimeFloatArray.byteLength);

    this.viewMatrix = this.getViewMatrix(deltaTime);
    this.device.queue.writeBuffer(this.uniformBuffer, 64, this.viewMatrix.buffer, 0, this.viewMatrix.byteLength);

    const cameraPosition = this.cameras[this.params.type].position; // Get the current camera position
    const cameraPositionArray = new Float32Array([cameraPosition[0], cameraPosition[1], cameraPosition[2]]);
    this.device.queue.writeBuffer( this.uniformBuffer, uniformConfig.cameraPosition.offset * 4, cameraPositionArray.buffer, 0, cameraPositionArray.byteLength );

    (this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = this.context
    .getCurrentTexture()
    .createView();

    // Update the depth attachment view
    this.renderPassDescriptor.depthStencilAttachment!.view = this.depthTexture.createView();

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.uniformBindGroup);
    passEncoder.setVertexBuffer(0, this.loadVerticesBuffer);
    passEncoder.setIndexBuffer(this.loadIndexBuffer, 'uint16');
    passEncoder.draw(this.loadIndexCount);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(this.renderFrame.bind(this));
  }
}

const app = new WebGPUApp(document.getElementById('app') as HTMLCanvasElement);
