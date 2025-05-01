import { NodeIO } from '@gltf-transform/core';

export async function loadGLB(url: string): Promise<{ vertices: Float32Array; indices?: Uint16Array; vertexNormal?: Float32Array; uvs?: Float32Array; colors?: Float32Array }> {
  const io = new NodeIO();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();

  const document = await io.readBinary(new Uint8Array(arrayBuffer));
  const mesh = document.getRoot().listMeshes()[0]; // Assuming the first mesh is the one you want

  const primitive = mesh.listPrimitives()[0]; // Assuming the first primitive
  const positionAccessor = primitive.getAttribute('POSITION');
  const uvAccessor = primitive.getAttribute('TEXCOORD_0');
  const normalAccessor = primitive.getAttribute('NORMAL');
  const colorAccessor = primitive.getAttribute('COLOR_0');
  const indicesAccessor = primitive.getIndices();

  if (!positionAccessor) {
    throw new Error('Missing POSITION in the glTF file.');
  }

  const vertices = new Float32Array(positionAccessor!.getArray()!);
  const indices = indicesAccessor ? new Uint16Array(indicesAccessor.getArray()!) : undefined;
  const vertexNormal = normalAccessor ? new Float32Array(normalAccessor.getArray()!) : undefined;
  const uvs = uvAccessor ? new Float32Array(uvAccessor.getArray()!) : undefined;
  const colors = colorAccessor ? new Float32Array(colorAccessor.getArray()!) : undefined;

// console.log(colorAccessor.getType()) // to know what type of data from GLB
  return { vertices, indices, vertexNormal, uvs, colors };
}