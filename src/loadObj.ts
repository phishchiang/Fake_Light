import { Mesh } from 'webgl-obj-loader';

export async function loadObj(url: string): Promise<{ vertices: Float32Array; indices: Uint16Array; uvs: Float32Array }> {
  const response = await fetch(url);
  const objText = await response.text();

  const mesh = new Mesh(objText);

  // Convert the parsed data into Float32Array and Uint16Array
  const vertices = new Float32Array(mesh.vertices);
  const indices = new Uint16Array(mesh.indices);
  const uvs = new Float32Array(mesh.textures); // Extract UV data

  console.log(mesh)

  return { vertices, indices, uvs };
}