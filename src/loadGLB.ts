import { NodeIO } from '@gltf-transform/core';

export async function loadGLB(url: string): Promise<{ vertices: Float32Array; indices: Uint16Array; uvs: Float32Array ; vertexNormal: Float32Array }> {
  const io = new NodeIO();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();

  const document = await io.readBinary(new Uint8Array(arrayBuffer));
  const mesh = document.getRoot().listMeshes()[0]; // Assuming the first mesh is the one you want

  const primitive = mesh.listPrimitives()[0]; // Assuming the first primitive
  const positionAccessor = primitive.getAttribute('POSITION');
  const uvAccessor = primitive.getAttribute('TEXCOORD_0');
  const normalAccessor = primitive.getAttribute('NORMAL');
  const indicesAccessor = primitive.getIndices();

  if (!positionAccessor || !uvAccessor || !indicesAccessor || !normalAccessor) {
    throw new Error('Missing POSITION, TEXCOORD_0, or INDICES attribute in the glTF file.');
  }

  const vertices = new Float32Array(positionAccessor!.getArray()!);
  const uvs = new Float32Array(uvAccessor!.getArray()!);
  const indices = new Uint16Array(indicesAccessor!.getArray()!);
  const vertexNormal = new Float32Array(normalAccessor!.getArray()!);

  // console.log(primitive.getAttribute('NORMAL')!.getArray()!);
  // console.log(mesh);

  return { vertices, indices, uvs, vertexNormal };
}