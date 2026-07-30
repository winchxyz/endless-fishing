import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  Scene,
  type ShaderMaterial,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';

/**
 * Renders one shader over a render target, with no camera involved.
 *
 * Used to build the atmosphere look-up tables and, later, the wake and cloud-shadow buffers.
 * The geometry is a single triangle rather than a quad: a quad is drawn as two triangles whose
 * shared diagonal makes the GPU shade the pixels along it twice, and a triangle that
 * over-covers the viewport avoids that entirely.
 *
 * One instance is shared by every pass — the geometry and camera are stateless, only the
 * material changes.
 */
export class FullScreenPass {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mesh: Mesh;
  private readonly geometry: BufferGeometry;

  constructor() {
    this.geometry = new BufferGeometry();
    // A triangle covering clip space twice over: (-1,-1), (3,-1), (-1,3).
    this.geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));

    this.mesh = new Mesh(this.geometry);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  render(renderer: WebGLRenderer, material: ShaderMaterial, target: WebGLRenderTarget | null): void {
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;

    this.mesh.material = material;
    renderer.setRenderTarget(target);
    renderer.autoClear = true;
    renderer.render(this.scene, this.camera);

    renderer.autoClear = previousAutoClear;
    renderer.setRenderTarget(previousTarget);
  }

  dispose(): void {
    this.geometry.dispose();
    this.scene.clear();
  }
}
