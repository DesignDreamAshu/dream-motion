import type { Node } from '@dream-motion/shared';

type WebGLRendererOptions = {
  canvas: HTMLCanvasElement;
};

type DrawOptions = {
  nodes: Node[];
  background: string | null;
  width: number;
  height: number;
};

const vertexSource = `
attribute vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_translation;
uniform vec2 u_scale;
void main() {
  vec2 position = a_position * u_scale + u_translation;
  vec2 zeroToOne = position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
}
`;

const fragmentSource = `
precision mediump float;
uniform vec4 u_color;
void main() {
  gl_FragColor = u_color;
}
`;

const compileShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createProgram = (gl: WebGLRenderingContext, vs: string, fs: string) => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vs);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!vertexShader || !fragmentShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

export const createWebGLRenderer = (options: WebGLRendererOptions) => {
  const gl = options.canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false });
  if (!gl) return null;
  const program = createProgram(gl, vertexSource, fragmentSource);
  if (!program) return null;

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const translationLocation = gl.getUniformLocation(program, 'u_translation');
  const scaleLocation = gl.getUniformLocation(program, 'u_scale');
  const colorLocation = gl.getUniformLocation(program, 'u_color');
  const buffer = gl.createBuffer();
  if (!buffer) return null;

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const drawRect = (x: number, y: number, width: number, height: number) => {
    const x1 = x;
    const y1 = y;
    const x2 = x + width;
    const y2 = y + height;
    const verts = new Float32Array([
      x1, y1,
      x2, y1,
      x1, y2,
      x1, y2,
      x2, y1,
      x2, y2
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const setColor = (hex: string, opacity: number) => {
    const normalized = hex.replace('#', '');
    const value = parseInt(normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized, 16);
    const r = ((value >> 16) & 255) / 255;
    const g = ((value >> 8) & 255) / 255;
    const b = (value & 255) / 255;
    gl.uniform4f(colorLocation, r, g, b, opacity);
  };

  const draw = (input: DrawOptions) => {
    const { nodes, background, width, height } = input;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program);
    gl.uniform2f(resolutionLocation, width, height);
    gl.uniform2f(scaleLocation, 1, 1);
    gl.uniform2f(translationLocation, 0, 0);

    if (background) {
      setColor(background, 1);
      drawRect(0, 0, width, height);
    } else {
      gl.clearColor(1, 1, 1, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    nodes.forEach((node) => {
      if (!node.visible || node.opacity <= 0) return;
      if (node.type === 'rect' || node.type === 'ellipse') {
        const color = node.fill ?? '#111111';
        setColor(color, node.opacity);
        drawRect(node.x, node.y, node.width, node.height);
      }
    });
  };

  return { draw };
};
