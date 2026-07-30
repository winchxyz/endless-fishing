import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { ResourceManager } from '../core/ResourceManager.js';
import { parseStarCatalog, type StarCatalog } from '../astro/StarCatalog.js';
import type { EphemerisState } from '../astro/Ephemeris.js';
import starsVert from '../shaders/sky/stars.vert';
import starsFrag from '../shaders/sky/stars.frag';
import milkywayVert from '../shaders/sky/milkyway.vert';
import milkywayFrag from '../shaders/sky/milkyway.frag';

/**
 * The night sky: the real star catalogue plus a procedurally placed Milky Way.
 *
 * Both objects live in the **equatorial** frame and share one rotation matrix, rebuilt each
 * frame from local apparent sidereal time and latitude. That is the entire mechanism by which
 * the sky turns: one 3x3 matrix, no per-star work, and it is correct by construction rather
 * than by tuning — constellations rise in the right place, at the right time, for the right
 * hemisphere, and Polaris sits at an altitude equal to the observer's latitude because the
 * mathematics says it must.
 *
 * Drawn at a fixed radius centred on the camera, with depth writes off, so the whole sky is
 * effectively at infinity and the boat never sails into it.
 */

/** Radius of the celestial sphere in world units. Well inside the camera's far plane. */
const SPHERE_RADIUS = 9000;

export class StarField {
  readonly points: Points;
  readonly milkyWay: Mesh;

  private readonly starMaterial: ShaderMaterial;
  private readonly milkyWayMaterial: ShaderMaterial;
  private readonly geometry: BufferGeometry;
  private readonly milkyWayGeometry: SphereGeometry;
  private readonly rotation = new Matrix4();
  private readonly zenithEquatorial = new Vector3();
  readonly catalog: StarCatalog;

  private constructor(catalog: StarCatalog) {
    this.catalog = catalog;

    this.geometry = new BufferGeometry();
    // Positions are unit vectors from the catalogue, scaled onto the celestial sphere.
    const scaled = new Float32Array(catalog.positions.length);
    for (let i = 0; i < catalog.positions.length; i += 1) {
      scaled[i] = (catalog.positions[i] ?? 0) * SPHERE_RADIUS;
    }
    this.geometry.setAttribute('position', new BufferAttribute(scaled, 3));
    this.geometry.setAttribute('aMagnitude', new BufferAttribute(catalog.magnitudes, 1));
    this.geometry.setAttribute('aColour', new BufferAttribute(catalog.colours, 3));
    // A bounding sphere set by hand: computing it would work, but the object is deliberately
    // never frustum-culled and three would otherwise walk 9000 vertices to find what we know.
    this.geometry.boundingSphere = null;

    this.starMaterial = new ShaderMaterial({
      vertexShader: starsVert,
      fragmentShader: starsFrag,
      uniforms: {
        uPixelScale: { value: 2.2 },
        uNightFactor: { value: 0 },
        uTime: { value: 0 },
        uIntensity: { value: 1 },
        uMagnitudeLimit: { value: 6.5 },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    this.points = new Points(this.geometry, this.starMaterial);
    this.points.frustumCulled = false;
    this.points.matrixAutoUpdate = false;
    this.points.renderOrder = -900;

    // 32x24 segments is enough: the shader is smooth in direction and the mesh only has to be
    // fine enough that the perspective interpolation of the direction vector does not bend.
    this.milkyWayGeometry = new SphereGeometry(SPHERE_RADIUS * 0.99, 48, 32);
    this.milkyWayMaterial = new ShaderMaterial({
      vertexShader: milkywayVert,
      fragmentShader: milkywayFrag,
      uniforms: {
        uNightFactor: { value: 0 },
        uIntensity: { value: 1 },
        uZenithEquatorial: { value: new Vector3(0, 0, 1) },
      },
      side: BackSide,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.milkyWay = new Mesh(this.milkyWayGeometry, this.milkyWayMaterial);
    this.milkyWay.frustumCulled = false;
    this.milkyWay.matrixAutoUpdate = false;
    this.milkyWay.renderOrder = -901;
  }

  static async load(resources: ResourceManager): Promise<StarField> {
    const buffer = await resources.loadBinary('processed/stars/bsc5.bin');
    return new StarField(parseStarCatalog(buffer));
  }

  /**
   * Rebuild the equatorial → horizontal rotation and push the per-frame uniforms.
   *
   * The matrix is the composition of two reflections — one carrying right ascension into hour
   * angle, one tilting the celestial pole to the observer's latitude — which is why it comes
   * out as a proper rotation despite each half having a negative determinant.
   */
  update(state: EphemerisState, cameraPosition: Vector3, elapsedSeconds: number, nightFactor: number): void {
    const theta = state.siderealTime;
    const phi = (state.location.latitudeDeg * Math.PI) / 180;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    // world = A · B · equatorial, with
    //   B : (RA, Dec) → hour-angle frame     [[cosθ, sinθ, 0], [sinθ, −cosθ, 0], [0, 0, 1]]
    //   A : hour-angle frame → world         [[0, −1, 0], [cosφ, 0, sinφ], [sinφ, 0, −cosφ]]
    // Written out rather than multiplied at runtime: it is nine terms, and doing it by hand
    // makes the world convention (+X east, +Y up, −Z north) auditable in one place.
    this.rotation.set(
      -sinTheta, cosTheta, 0, 0,
      cosPhi * cosTheta, cosPhi * sinTheta, sinPhi, 0,
      sinPhi * cosTheta, sinPhi * sinTheta, -cosPhi, 0,
      0, 0, 0, 1,
    );
    this.rotation.setPosition(cameraPosition);

    this.points.matrix.copy(this.rotation);
    this.points.matrixWorld.copy(this.rotation);
    this.milkyWay.matrix.copy(this.rotation);
    this.milkyWay.matrixWorld.copy(this.rotation);

    // The zenith, expressed back in the equatorial frame, so the Milky Way shader can apply
    // horizon extinction without needing the inverse matrix.
    this.zenithEquatorial.set(cosPhi * cosTheta, cosPhi * sinTheta, sinPhi);

    setUniform(this.starMaterial, 'uNightFactor', nightFactor);
    setUniform(this.starMaterial, 'uTime', elapsedSeconds);
    setUniform(this.milkyWayMaterial, 'uNightFactor', nightFactor);
    const zenithUniform = this.milkyWayMaterial.uniforms['uZenithEquatorial'];
    if (zenithUniform !== undefined) {
      (zenithUniform.value as Vector3).copy(this.zenithEquatorial);
    }
  }

  /** Star sprite scale in pixels, and how faint a star may be. Driven by the quality preset. */
  configure(pixelScale: number, magnitudeLimit: number, intensity: number): void {
    setUniform(this.starMaterial, 'uPixelScale', pixelScale);
    setUniform(this.starMaterial, 'uMagnitudeLimit', magnitudeLimit);
    setUniform(this.starMaterial, 'uIntensity', intensity);
    setUniform(this.milkyWayMaterial, 'uIntensity', intensity);
  }

  dispose(): void {
    this.geometry.dispose();
    this.milkyWayGeometry.dispose();
    this.starMaterial.dispose();
    this.milkyWayMaterial.dispose();
  }
}

function setUniform(material: ShaderMaterial, name: string, value: number): void {
  const uniform = material.uniforms[name];
  if (uniform !== undefined) uniform.value = value;
}

/**
 * Zenith direction in the equatorial frame — exported because the horizon-extinction term in
 * the Milky Way shader is the only place outside this file that needs it, and having the
 * derivation in one place stops a second, subtly different copy appearing.
 */
export function zenithInEquatorialFrame(siderealTime: number, latitudeDeg: number): Vector3 {
  const phi = (latitudeDeg * Math.PI) / 180;
  return new Vector3(
    Math.cos(phi) * Math.cos(siderealTime),
    Math.cos(phi) * Math.sin(siderealTime),
    Math.sin(phi),
  );
}
