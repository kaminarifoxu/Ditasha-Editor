import * as T from 'three';
// Equidistant circular fisheye: render a cube, then map lens rays to it.
export function createBoothFisheye() {
  let target, cube, quad, scene, camera;
  return {
    render(renderer, world, view, fov, alpha) {
      if (!target) {
        target = new T.WebGLCubeRenderTarget(512, {
          minFilter: T.LinearFilter,
          magFilter: T.LinearFilter,
          generateMipmaps: false,
        });
        target.texture.colorSpace = T.LinearSRGBColorSpace;
        cube = new T.CubeCamera(0.001, 1000, target);
        const material = new T.ShaderMaterial({
          uniforms: {
            map: { value: target.texture },
            aspect: { value: 1 },
            fov: { value: Math.PI },
            outsideAlpha: { value: 1 },
          },
          vertexShader:
            'varying vec2 uvOut;void main(){uvOut=uv;gl_Position=vec4(position.xy,0.,1.);}',
          fragmentShader: `uniform samplerCube map;uniform float aspect,fov,outsideAlpha;varying vec2 uvOut;
void main(){vec2 p=(uvOut-.5)*2.;p.x*=max(aspect,1.);p.y*=max(1./aspect,1.);float r=length(p);if(r>1.){gl_FragColor=vec4(0.,0.,0.,outsideAlpha);return;}float theta=r*fov*.5;vec2 axis=r>0.00001?p/r:vec2(0.);vec3 ray=vec3(axis*sin(theta),-cos(theta));gl_FragColor=textureCube(map,ray);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
          depthTest: false,
          depthWrite: false,
        });
        quad = new T.Mesh(new T.PlaneGeometry(2, 2), material);
        scene = new T.Scene();
        scene.add(quad);
        camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      }
      cube.position.copy(view.position);
      cube.quaternion.copy(view.quaternion);
      cube.near = view.near;
      cube.far = view.far;
      for (const child of cube.children) {
        child.near = view.near;
        child.far = view.far;
        child.updateProjectionMatrix();
      }
      cube.update(renderer, world);
      quad.material.uniforms.aspect.value = view.aspect;
      quad.material.uniforms.fov.value = (fov * Math.PI) / 180;
      quad.material.uniforms.outsideAlpha.value = alpha;
      renderer.render(scene, camera);
    },
    dispose() {
      target?.dispose();
      quad?.geometry.dispose();
      quad?.material.dispose();
    },
  };
}
