declare module 'polygon-clipping' {
  const polygonClipping: {
    union: (...args: unknown[]) => number[][][][];
    intersection: (...args: unknown[]) => number[][][][];
    difference: (...args: unknown[]) => number[][][][];
    xor: (...args: unknown[]) => number[][][][];
  };
  export default polygonClipping;
}
